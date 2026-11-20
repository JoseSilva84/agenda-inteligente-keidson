"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
function ensureUserBucket(store, userId) {
    if (!store.userData[userId]) {
        store.userData[userId] = {
            settings: { ...db_1.DEFAULT_SETTINGS },
            items: [],
            travels: [],
            people: [],
            notifs: [],
            files: {}
        };
    }
    return store.userData[userId];
}
// GET /api/agenda/bootstrap — carrega toda a agenda do usuário autenticado
router.get('/bootstrap', async (req, res) => {
    try {
        const userId = req.user.userId;
        const usePg = await (0, db_1.isPostgresConnected)();
        if (usePg) {
            const [settingsRow, activities, travels, people, notifications] = await Promise.all([
                db_1.prisma.userSettings.findUnique({ where: { userId } }),
                db_1.prisma.activity.findMany({ where: { userId } }),
                db_1.prisma.travel.findMany({ where: { userId } }),
                db_1.prisma.person.findMany({ where: { userId } }),
                db_1.prisma.notification.findMany({ where: { userId }, orderBy: { at: 'desc' }, take: 50 })
            ]);
            const settings = settingsRow
                ? {
                    kind: 'settings',
                    mode: settingsRow.mode,
                    workStart: settingsRow.workStart,
                    workEnd: settingsRow.workEnd,
                    workDays: settingsRow.workDays,
                    categories: settingsRow.categories,
                    specialCats: settingsRow.specialCats
                }
                : { ...db_1.DEFAULT_SETTINGS };
            const items = activities.map((a) => ({
                id: a.id,
                kind: 'activity',
                title: a.title,
                date: a.date,
                start: a.start,
                end: a.end,
                status: a.status,
                category: a.category,
                priority: a.priority,
                recur: a.recur,
                reminder: a.reminder,
                fixed: a.fixed,
                deadline: a.deadline,
                autoResched: a.autoResched,
                kept: a.kept,
                span: a.span,
                notes: a.notes,
                subtasks: a.subtasks,
                links: a.links,
                files: a.files,
                history: a.history,
                overrides: a.overrides,
                origin: a.origin,
                rescheduledCount: a.rescheduledCount,
                createdAt: Number(a.createdAt),
                updatedAt: Number(a.updatedAt)
            }));
            const trList = travels.map((t) => ({
                id: t.id,
                kind: 'travel',
                title: t.title,
                date: t.date,
                start: t.start,
                endDate: t.endDate,
                end: t.end,
                notes: t.notes,
                updatedAt: Number(t.updatedAt)
            }));
            const peList = people.map((p) => ({
                id: p.id,
                kind: 'person',
                type: p.type,
                name: p.name,
                day: p.day,
                month: p.month,
                whatsapp: p.whatsapp,
                role: p.role,
                createdAt: Number(p.createdAt)
            }));
            const notifs = notifications.map((n) => ({
                id: n.id,
                at: Number(n.at),
                title: n.title,
                body: n.body,
                type: n.type,
                read: n.read
            }));
            res.json({ storage: 'postgresql', settings, items, travels: trList, people: peList, notifs });
            return;
        }
        const store = (0, db_1.loadLocalStore)();
        const bucket = ensureUserBucket(store, userId);
        res.json({
            storage: 'cloud',
            settings: bucket.settings || { ...db_1.DEFAULT_SETTINGS },
            items: bucket.items || [],
            travels: bucket.travels || [],
            people: bucket.people || [],
            notifs: bucket.notifs || []
        });
    }
    catch (err) {
        console.error('Erro em /bootstrap:', err);
        res.status(500).json({ error: 'Erro ao carregar dados da agenda.' });
    }
});
// PUT /api/agenda/doc/:docId — cria ou atualiza documento (activity, travel, person, settings, notifs)
router.put('/doc/:docId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const docId = req.params.docId;
        const data = req.body;
        const usePg = await (0, db_1.isPostgresConnected)();
        if (usePg) {
            if (docId === 'settings') {
                await db_1.prisma.userSettings.upsert({
                    where: { userId },
                    create: {
                        userId,
                        mode: data.mode || 'confirm',
                        workStart: data.workStart || '08:00',
                        workEnd: data.workEnd || '18:00',
                        workDays: data.workDays || [1, 2, 3, 4, 5],
                        categories: data.categories || db_1.DEFAULT_CATEGORIES,
                        specialCats: true
                    },
                    update: {
                        mode: data.mode || 'confirm',
                        workStart: data.workStart || '08:00',
                        workEnd: data.workEnd || '18:00',
                        workDays: data.workDays || [1, 2, 3, 4, 5],
                        categories: data.categories || db_1.DEFAULT_CATEGORIES,
                        specialCats: true
                    }
                });
                res.json({ ok: true });
                return;
            }
            if (docId === 'notifs') {
                const list = Array.isArray(data.items) ? data.items.slice(0, 50) : [];
                await db_1.prisma.notification.deleteMany({ where: { userId } });
                if (list.length > 0) {
                    await db_1.prisma.notification.createMany({
                        data: list.map((n) => ({
                            id: String(n.id),
                            userId,
                            at: BigInt(n.at || Date.now()),
                            title: String(n.title || ''),
                            body: String(n.body || ''),
                            type: String(n.type || 'info'),
                            read: Boolean(n.read)
                        }))
                    });
                }
                res.json({ ok: true });
                return;
            }
            if (data.kind === 'activity') {
                const payload = {
                    userId,
                    title: String(data.title || ''),
                    date: String(data.date || ''),
                    start: String(data.start || '09:00'),
                    end: String(data.end || '10:00'),
                    status: String(data.status || 'planejada'),
                    category: String(data.category || ''),
                    priority: String(data.priority || 'media'),
                    recur: data.recur || { freq: 'none' },
                    reminder: Number(data.reminder ?? 30),
                    fixed: Boolean(data.fixed),
                    deadline: String(data.deadline || ''),
                    autoResched: data.autoResched !== false,
                    kept: Boolean(data.kept),
                    span: Boolean(data.span),
                    notes: String(data.notes || ''),
                    subtasks: data.subtasks || [],
                    links: data.links || [],
                    files: data.files || [],
                    history: data.history || [],
                    overrides: data.overrides || {},
                    origin: data.origin || null,
                    rescheduledCount: Number(data.rescheduledCount || 0),
                    createdAt: BigInt(data.createdAt || Date.now()),
                    updatedAt: BigInt(data.updatedAt || Date.now())
                };
                await db_1.prisma.activity.upsert({
                    where: { id: docId },
                    create: { id: docId, ...payload },
                    update: payload
                });
                res.json({ ok: true });
                return;
            }
            if (data.kind === 'travel') {
                const payload = {
                    userId,
                    title: String(data.title || ''),
                    date: String(data.date || ''),
                    start: String(data.start || '08:00'),
                    endDate: String(data.endDate || data.date || ''),
                    end: String(data.end || '18:00'),
                    notes: String(data.notes || ''),
                    updatedAt: BigInt(data.updatedAt || Date.now())
                };
                await db_1.prisma.travel.upsert({
                    where: { id: docId },
                    create: { id: docId, ...payload },
                    update: payload
                });
                res.json({ ok: true });
                return;
            }
            if (data.kind === 'person') {
                const payload = {
                    userId,
                    type: String(data.type || 'aniversario'),
                    name: String(data.name || ''),
                    day: Number(data.day || 1),
                    month: Number(data.month || 1),
                    whatsapp: String(data.whatsapp || ''),
                    role: String(data.role || ''),
                    createdAt: BigInt(data.createdAt || Date.now())
                };
                await db_1.prisma.person.upsert({
                    where: { id: docId },
                    create: { id: docId, ...payload },
                    update: payload
                });
                res.json({ ok: true });
                return;
            }
        }
        // Fallback local store
        const store = (0, db_1.loadLocalStore)();
        const bucket = ensureUserBucket(store, userId);
        if (docId === 'settings') {
            bucket.settings = { ...data, kind: 'settings' };
        }
        else if (docId === 'notifs') {
            bucket.notifs = Array.isArray(data.items) ? data.items.slice(0, 50) : [];
        }
        else if (data.kind === 'activity') {
            const idx = bucket.items.findIndex((x) => x.id === docId);
            const item = { ...data, id: docId };
            if (idx >= 0)
                bucket.items[idx] = item;
            else
                bucket.items.push(item);
        }
        else if (data.kind === 'travel') {
            const idx = bucket.travels.findIndex((x) => x.id === docId);
            const tr = { ...data, id: docId };
            if (idx >= 0)
                bucket.travels[idx] = tr;
            else
                bucket.travels.push(tr);
        }
        else if (data.kind === 'person') {
            const idx = bucket.people.findIndex((x) => x.id === docId);
            const pe = { ...data, id: docId };
            if (idx >= 0)
                bucket.people[idx] = pe;
            else
                bucket.people.push(pe);
        }
        (0, db_1.saveLocalStore)(store);
        res.json({ ok: true });
    }
    catch (err) {
        console.error('Erro em PUT /doc/:docId:', err);
        res.status(500).json({ error: 'Erro ao salvar documento.' });
    }
});
// DELETE /api/agenda/doc/:docId
router.delete('/doc/:docId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const docId = req.params.docId;
        const usePg = await (0, db_1.isPostgresConnected)();
        if (usePg) {
            await Promise.allSettled([
                db_1.prisma.activity.deleteMany({ where: { id: docId, userId } }),
                db_1.prisma.travel.deleteMany({ where: { id: docId, userId } }),
                db_1.prisma.person.deleteMany({ where: { id: docId, userId } })
            ]);
            res.json({ ok: true });
            return;
        }
        const store = (0, db_1.loadLocalStore)();
        const bucket = ensureUserBucket(store, userId);
        bucket.items = bucket.items.filter((x) => x.id !== docId);
        bucket.travels = bucket.travels.filter((x) => x.id !== docId);
        bucket.people = bucket.people.filter((x) => x.id !== docId);
        (0, db_1.saveLocalStore)(store);
        res.json({ ok: true });
    }
    catch (err) {
        console.error('Erro em DELETE /doc/:docId:', err);
        res.status(500).json({ error: 'Erro ao remover documento.' });
    }
});
// POST /api/agenda/files — upload de anexo (Base64)
router.post('/files', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id, name, mimeType, size, dataBase64 } = req.body;
        if (!id || !dataBase64) {
            res.status(400).json({ error: 'Arquivo inválido.' });
            return;
        }
        const usePg = await (0, db_1.isPostgresConnected)();
        if (usePg) {
            await db_1.prisma.fileAsset.upsert({
                where: { id },
                create: { id, userId, name: name || 'arquivo', mimeType: mimeType || 'application/octet-stream', size: Number(size || 0), dataBase64 },
                update: { name: name || 'arquivo', mimeType: mimeType || 'application/octet-stream', size: Number(size || 0), dataBase64 }
            });
            res.status(201).json({ id, store: 'asset' });
            return;
        }
        const store = (0, db_1.loadLocalStore)();
        const bucket = ensureUserBucket(store, userId);
        bucket.files[id] = { id, name: name || 'arquivo', mimeType: mimeType || 'application/octet-stream', size: Number(size || 0), dataBase64 };
        (0, db_1.saveLocalStore)(store);
        res.status(201).json({ id, store: 'asset' });
    }
    catch (err) {
        console.error('Erro no upload de arquivo:', err);
        res.status(500).json({ error: 'Erro ao salvar anexo.' });
    }
});
// GET /api/agenda/files/:fileId
router.get('/files/:fileId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const fileId = req.params.fileId;
        const usePg = await (0, db_1.isPostgresConnected)();
        if (usePg) {
            const f = await db_1.prisma.fileAsset.findFirst({ where: { id: fileId, userId } });
            if (!f) {
                res.status(404).json({ error: 'Arquivo não encontrado.' });
                return;
            }
            res.json(f);
            return;
        }
        const store = (0, db_1.loadLocalStore)();
        const bucket = ensureUserBucket(store, userId);
        const f = bucket.files[fileId];
        if (!f) {
            res.status(404).json({ error: 'Arquivo não encontrado.' });
            return;
        }
        res.json(f);
    }
    catch {
        res.status(500).json({ error: 'Erro ao buscar arquivo.' });
    }
});
// DELETE /api/agenda/files/:fileId
router.delete('/files/:fileId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const fileId = req.params.fileId;
        const usePg = await (0, db_1.isPostgresConnected)();
        if (usePg) {
            await db_1.prisma.fileAsset.deleteMany({ where: { id: fileId, userId } });
            res.json({ ok: true });
            return;
        }
        const store = (0, db_1.loadLocalStore)();
        const bucket = ensureUserBucket(store, userId);
        delete bucket.files[fileId];
        (0, db_1.saveLocalStore)(store);
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ error: 'Erro ao excluir arquivo.' });
    }
});
exports.default = router;
