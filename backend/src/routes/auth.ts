import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma, isPostgresConnected, loadLocalStore, saveLocalStore, DEFAULT_SETTINGS, DEFAULT_CATEGORIES } from '../lib/db';
import { signToken, authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const login = String(req.body.login || req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!login || !password) {
      res.status(400).json({ error: 'Informe seu login e senha.' });
      return;
    }

    const usePg = await isPostgresConnected();
    if (usePg) {
      const user = await prisma.user.findUnique({ where: { email: login } });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        res.status(401).json({ error: 'Login ou senha incorretos.' });
        return;
      }
      const token = signToken({ userId: user.id, email: user.email, name: user.name, role: user.role });
      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme }
      });
      return;
    }

    const store = loadLocalStore();
    const user = store.users.find((u) => u.email.toLowerCase() === login);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Login ou senha incorretos.' });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, name: user.name, role: user.role });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno ao autenticar.' });
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!name || !email || password.length < 4) {
      res.status(400).json({ error: 'Preencha nome, e-mail válido e senha (mínimo 4 caracteres).' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const usePg = await isPostgresConnected();

    if (usePg) {
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) {
        res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
        return;
      }

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: 'user',
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

      const token = signToken({ userId: user.id, email: user.email, name: user.name, role: user.role });
      res.status(201).json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme }
      });
      return;
    }

    const store = loadLocalStore();
    if (store.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
      return;
    }

    const id = 'usr_' + Date.now().toString(36);
    const newUser = {
      id,
      name,
      email,
      passwordHash,
      role: 'user',
      theme: 'dark',
      createdAt: new Date().toISOString()
    };
    store.users.push(newUser);
    store.userData[id] = {
      settings: { ...DEFAULT_SETTINGS },
      items: [],
      travels: [],
      people: [],
      notifs: [],
      files: {}
    };
    saveLocalStore(store);

    const token = signToken({ userId: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role });
    res.status(201).json({
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, theme: newUser.theme }
    });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    res.status(500).json({ error: 'Erro interno ao criar conta.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const usePg = await isPostgresConnected();
    if (usePg) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado.' });
        return;
      }
      res.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme }
      });
      return;
    }

    const store = loadLocalStore();
    const user = store.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
});

// PATCH /api/auth/theme
router.patch('/theme', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const theme = String(req.body.theme || 'dark');
    const usePg = await isPostgresConnected();
    if (usePg) {
      await prisma.user.update({ where: { id: userId }, data: { theme } });
      res.json({ ok: true, theme });
      return;
    }
    const store = loadLocalStore();
    const user = store.users.find((u) => u.id === userId);
    if (user) {
      user.theme = theme;
      saveLocalStore(store);
    }
    res.json({ ok: true, theme });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar tema.' });
  }
});

// POST /api/auth/verify-password
router.post('/verify-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const password = String(req.body.password || '');
    if (!password) {
      res.status(400).json({ error: 'Informe a senha do sistema.' });
      return;
    }

    const usePg = await isPostgresConnected();
    if (usePg) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        res.status(401).json({ error: 'Senha incorreta. Tente novamente.' });
        return;
      }
      res.json({ ok: true });
      return;
    }

    const store = loadLocalStore();
    const user = store.users.find((u) => u.id === userId);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Senha incorreta. Tente novamente.' });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao validar a senha.' });
  }
});

export default router;
