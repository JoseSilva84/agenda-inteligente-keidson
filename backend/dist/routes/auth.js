"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        if (!email || !password) {
            res.status(400).json({ error: 'Informe seu e-mail e senha.' });
            return;
        }
        const usePg = await (0, db_1.isPostgresConnected)();
        if (usePg) {
            const user = await db_1.prisma.user.findUnique({ where: { email } });
            if (!user || !(await bcryptjs_1.default.compare(password, user.passwordHash))) {
                res.status(401).json({ error: 'E-mail ou senha incorretos.' });
                return;
            }
            const token = (0, auth_1.signToken)({ userId: user.id, email: user.email, name: user.name, role: user.role });
            res.json({
                token,
                user: { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme }
            });
            return;
        }
        const store = (0, db_1.loadLocalStore)();
        const user = store.users.find((u) => u.email.toLowerCase() === email);
        if (!user || !(await bcryptjs_1.default.compare(password, user.passwordHash))) {
            res.status(401).json({ error: 'E-mail ou senha incorretos.' });
            return;
        }
        const token = (0, auth_1.signToken)({ userId: user.id, email: user.email, name: user.name, role: user.role });
        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme }
        });
    }
    catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ error: 'Erro interno ao autenticar.' });
    }
});
// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        if (!name || !email || password.length < 4) {
            res.status(400).json({ error: 'Preencha nome, e-mail válido e senha (mínimo 4 caracteres).' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const usePg = await (0, db_1.isPostgresConnected)();
        if (usePg) {
            const exists = await db_1.prisma.user.findUnique({ where: { email } });
            if (exists) {
                res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
                return;
            }
            const user = await db_1.prisma.user.create({
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
                            categories: db_1.DEFAULT_CATEGORIES,
                            specialCats: true
                        }
                    }
                }
            });
            const token = (0, auth_1.signToken)({ userId: user.id, email: user.email, name: user.name, role: user.role });
            res.status(201).json({
                token,
                user: { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme }
            });
            return;
        }
        const store = (0, db_1.loadLocalStore)();
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
            settings: { ...db_1.DEFAULT_SETTINGS },
            items: [],
            travels: [],
            people: [],
            notifs: [],
            files: {}
        };
        (0, db_1.saveLocalStore)(store);
        const token = (0, auth_1.signToken)({ userId: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role });
        res.status(201).json({
            token,
            user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, theme: newUser.theme }
        });
    }
    catch (err) {
        console.error('Erro no cadastro:', err);
        res.status(500).json({ error: 'Erro interno ao criar conta.' });
    }
});
// GET /api/auth/me
router.get('/me', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const usePg = await (0, db_1.isPostgresConnected)();
        if (usePg) {
            const user = await db_1.prisma.user.findUnique({ where: { id: userId } });
            if (!user) {
                res.status(404).json({ error: 'Usuário não encontrado.' });
                return;
            }
            res.json({
                user: { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme }
            });
            return;
        }
        const store = (0, db_1.loadLocalStore)();
        const user = store.users.find((u) => u.id === userId);
        if (!user) {
            res.status(404).json({ error: 'Usuário não encontrado.' });
            return;
        }
        res.json({
            user: { id: user.id, name: user.name, email: user.email, role: user.role, theme: user.theme }
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Erro ao buscar perfil.' });
    }
});
// PATCH /api/auth/theme
router.patch('/theme', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const theme = String(req.body.theme || 'dark');
        const usePg = await (0, db_1.isPostgresConnected)();
        if (usePg) {
            await db_1.prisma.user.update({ where: { id: userId }, data: { theme } });
            res.json({ ok: true, theme });
            return;
        }
        const store = (0, db_1.loadLocalStore)();
        const user = store.users.find((u) => u.id === userId);
        if (user) {
            user.theme = theme;
            (0, db_1.saveLocalStore)(store);
        }
        res.json({ ok: true, theme });
    }
    catch {
        res.status(500).json({ error: 'Erro ao atualizar tema.' });
    }
});
exports.default = router;
