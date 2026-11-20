import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export const DEFAULT_CATEGORIES = [
  { id: 'trabalho', name: 'Trabalho', color: '#2F5BEA' },
  { id: 'estudos', name: 'Estudos', color: '#8B5CF6' },
  { id: 'saude', name: 'Saúde', color: '#0E9F6E' },
  { id: 'pessoal', name: 'Pessoal', color: '#E8811A' },
  { id: 'reunioes', name: 'Reuniões', color: '#DB3F78' },
  { id: 'aniversariantes', name: 'Aniversariantes', color: '#E0A100' },
  { id: 'diasprof', name: 'Dias profissionais', color: '#0F8C8C' }
];

export const DEFAULT_SETTINGS = {
  kind: 'settings',
  mode: 'confirm',
  workStart: '08:00',
  workEnd: '18:00',
  workDays: [1, 2, 3, 4, 5],
  categories: DEFAULT_CATEGORIES,
  specialCats: true
};

export const prisma = new PrismaClient({
  log: ['error', 'warn']
});

let pgAvailable: boolean | null = null;

export async function isPostgresConnected(): Promise<boolean> {
  if (pgAvailable !== null) return pgAvailable;
  try {
    await prisma.$queryRaw`SELECT 1`;
    pgAvailable = true;
    console.log('✅ [Database] Conectado ao PostgreSQL via Prisma ORM.');
    await ensureDefaultUserPg();
    return true;
  } catch (err) {
    pgAvailable = false;
    console.warn('⚠️ [Database] PostgreSQL não acessível localmente. Ativando persistência local JSON espelhada (pronta para PostgreSQL no Coolify).');
    ensureDefaultUserLocal();
    return false;
  }
}

export const getAdminConfig = () => ({
  login: (
    process.env.ADMIN_LOGIN ||
    process.env.ADMIN_EMAIL ||
    process.env.INITIAL_USER_EMAIL ||
    'keidson.rodrigues'
  )
    .toLowerCase()
    .trim(),
  password: process.env.ADMIN_PASSWORD || process.env.INITIAL_USER_PASSWORD || '123456',
  name: process.env.ADMIN_NAME || 'Pr. Keidson Rodrigues'
});

async function ensureDefaultUserPg() {
  const { login, password, name } = getAdminConfig();
  const loginUser = await prisma.user.findUnique({ where: { email: login } });
  const existing = loginUser || (await prisma.user.findFirst({ where: { role: 'owner' }, orderBy: { createdAt: 'asc' } }));

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        name,
        email: login,
        passwordHash,
        role: 'owner',
        theme: 'dark',
        settings: {
          create: {
            mode: 'confirm',
            workStart: '08:00',
            workEnd: '18:00',
            workDays: [1, 2, 3, 4, 5],
            categories: DEFAULT_CATEGORIES,
            specialCats: true
          }
        }
      }
    });
    return;
  }

  const passwordMatches = await bcrypt.compare(password, existing.passwordHash);
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      email: login,
      name,
      role: 'owner',
      ...(passwordMatches ? {} : { passwordHash: await bcrypt.hash(password, 10) })
    }
  });
}

// Local JSON fallback store when PostgreSQL is offline during local dev
export interface LocalStoreData {
  users: Array<{
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: string;
    theme: string;
    createdAt: string;
  }>;
  userData: Record<
    string,
    {
      settings: any;
      items: any[];
      travels: any[];
      people: any[];
      notifs: any[];
      files: Record<string, { id: string; name: string; mimeType: string; size: number; dataBase64: string }>;
    }
  >;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'local-postgres-mirror.json');

export function loadLocalStore(): LocalStoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch {}
  return { users: [], userData: {} };
}

export function saveLocalStore(data: LocalStoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Erro ao salvar store local:', e);
  }
}

function ensureDefaultUserLocal() {
  const store = loadLocalStore();
  const { login, password, name } = getAdminConfig();
  const user = store.users.find((u) => u.email.toLowerCase() === login) || store.users.find((u) => u.role === 'owner');

  if (!user) {
    const id = 'usr_keidson_owner';
    const passwordHash = bcrypt.hashSync(password, 10);
    store.users.push({
      id,
      name,
      email: login,
      passwordHash,
      role: 'owner',
      theme: 'dark',
      createdAt: new Date().toISOString()
    });
    store.userData[id] = {
      settings: { ...DEFAULT_SETTINGS },
      items: [],
      travels: [],
      people: [],
      notifs: [],
      files: {}
    };
    saveLocalStore(store);
    return;
  }

  user.email = login;
  user.name = name;
  user.role = 'owner';
  if (!bcrypt.compareSync(password, user.passwordHash)) {
    user.passwordHash = bcrypt.hashSync(password, 10);
  }
  saveLocalStore(store);
}
