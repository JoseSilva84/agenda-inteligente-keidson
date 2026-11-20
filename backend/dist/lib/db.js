"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.DEFAULT_SETTINGS = exports.DEFAULT_CATEGORIES = void 0;
exports.isPostgresConnected = isPostgresConnected;
exports.loadLocalStore = loadLocalStore;
exports.saveLocalStore = saveLocalStore;
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
exports.DEFAULT_CATEGORIES = [
    { id: 'trabalho', name: 'Trabalho', color: '#2F5BEA' },
    { id: 'estudos', name: 'Estudos', color: '#8B5CF6' },
    { id: 'saude', name: 'Saúde', color: '#0E9F6E' },
    { id: 'pessoal', name: 'Pessoal', color: '#E8811A' },
    { id: 'reunioes', name: 'Reuniões', color: '#DB3F78' },
    { id: 'aniversariantes', name: 'Aniversariantes', color: '#E0A100' },
    { id: 'diasprof', name: 'Dias profissionais', color: '#0F8C8C' }
];
exports.DEFAULT_SETTINGS = {
    kind: 'settings',
    mode: 'confirm',
    workStart: '08:00',
    workEnd: '18:00',
    workDays: [1, 2, 3, 4, 5],
    categories: exports.DEFAULT_CATEGORIES,
    specialCats: true
};
exports.prisma = new client_1.PrismaClient({
    log: ['error', 'warn']
});
let pgAvailable = null;
async function isPostgresConnected() {
    if (pgAvailable !== null)
        return pgAvailable;
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        pgAvailable = true;
        console.log('✅ [Database] Conectado ao PostgreSQL via Prisma ORM.');
        await ensureDefaultUserPg();
        return true;
    }
    catch (err) {
        pgAvailable = false;
        console.warn('⚠️ [Database] PostgreSQL não acessível localmente. Ativando persistência local JSON espelhada (pronta para PostgreSQL no Coolify).');
        ensureDefaultUserLocal();
        return false;
    }
}
async function ensureDefaultUserPg() {
    const email = 'keidson@agendainteligente.com';
    const existing = await exports.prisma.user.findUnique({ where: { email } });
    if (!existing) {
        const passwordHash = await bcryptjs_1.default.hash('123456', 10);
        await exports.prisma.user.create({
            data: {
                name: 'Keidson',
                email,
                passwordHash,
                role: 'owner',
                theme: 'dark',
                settings: {
                    create: {
                        mode: 'confirm',
                        workStart: '08:00',
                        workEnd: '18:00',
                        workDays: [1, 2, 3, 4, 5],
                        categories: exports.DEFAULT_CATEGORIES,
                        specialCats: true
                    }
                }
            }
        });
    }
}
const DATA_DIR = path_1.default.join(process.cwd(), 'data');
const DATA_FILE = path_1.default.join(DATA_DIR, 'local-postgres-mirror.json');
function loadLocalStore() {
    try {
        if (!fs_1.default.existsSync(DATA_DIR))
            fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
        if (fs_1.default.existsSync(DATA_FILE)) {
            return JSON.parse(fs_1.default.readFileSync(DATA_FILE, 'utf-8'));
        }
    }
    catch { }
    return { users: [], userData: {} };
}
function saveLocalStore(data) {
    try {
        if (!fs_1.default.existsSync(DATA_DIR))
            fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
        fs_1.default.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
    catch (e) {
        console.error('Erro ao salvar store local:', e);
    }
}
function ensureDefaultUserLocal() {
    const store = loadLocalStore();
    const email = 'keidson@agendainteligente.com';
    if (!store.users.some((u) => u.email === email)) {
        const id = 'usr_keidson_owner';
        const passwordHash = bcryptjs_1.default.hashSync('123456', 10);
        store.users.push({
            id,
            name: 'Keidson',
            email,
            passwordHash,
            role: 'owner',
            theme: 'dark',
            createdAt: new Date().toISOString()
        });
        store.userData[id] = {
            settings: { ...exports.DEFAULT_SETTINGS },
            items: [],
            travels: [],
            people: [],
            notifs: [],
            files: {}
        };
        saveLocalStore(store);
    }
}
