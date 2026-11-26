import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma, isPostgresConnected, loadLocalStore, saveLocalStore, DEFAULT_SETTINGS, DEFAULT_CATEGORIES, DATA_DIR } from '../lib/db';
import { authMiddleware } from '../middleware/auth';

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function safeFileKey(id: string): string {
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function writeFileDiskCache(userId: string, id: string, name: string, mimeType: string, dataBase64: string) {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const key = safeFileKey(id);
    const binPath = path.join(UPLOADS_DIR, `${key}.bin`);
    const metaPath = path.join(UPLOADS_DIR, `${key}.meta.json`);
    const buf = Buffer.from(dataBase64, 'base64');
    fs.writeFileSync(binPath, buf);
    fs.writeFileSync(
      metaPath,
      JSON.stringify({ id, userId, name, mimeType, size: buf.length }),
      'utf-8'
    );
  } catch (err) {
    console.warn('Aviso: falha ao gravar cache de arquivo em disco:', err);
  }
}

function removeFileDiskCache(id: string) {
  try {
    const key = safeFileKey(id);
    const binPath = path.join(UPLOADS_DIR, `${key}.bin`);
    const metaPath = path.join(UPLOADS_DIR, `${key}.meta.json`);
    if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  } catch {}
}

async function ensureDiskCachedFile(
  userId: string,
  fileId: string
): Promise<{ binPath: string; name: string; mimeType: string; size: number } | null> {
  const key = safeFileKey(fileId);
  const binPath = path.join(UPLOADS_DIR, `${key}.bin`);
  const metaPath = path.join(UPLOADS_DIR, `${key}.meta.json`);

  if (fs.existsSync(binPath) && fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (!meta.userId || meta.userId === userId) {
        const stat = fs.statSync(binPath);
        return {
          binPath,
          name: meta.name || 'arquivo',
          mimeType: meta.mimeType || 'application/octet-stream',
          size: stat.size
        };
      }
    } catch {}
  }

  const usePg = await isPostgresConnected();
  if (usePg) {
    const f = await prisma.fileAsset.findFirst({ where: { id: fileId, userId } });
    if (!f) return null;
    writeFileDiskCache(userId, f.id, f.name, f.mimeType, f.dataBase64);
    if (fs.existsSync(binPath)) {
      const stat = fs.statSync(binPath);
      return { binPath, name: f.name, mimeType: f.mimeType, size: stat.size };
    }
  } else {
    const store = loadLocalStore();
    const bucket = ensureUserBucket(store, userId);
    const f = bucket.files[fileId];
    if (!f) return null;
    writeFileDiskCache(userId, f.id, f.name, f.mimeType, f.dataBase64);
    if (fs.existsSync(binPath)) {
      const stat = fs.statSync(binPath);
      return { binPath, name: f.name, mimeType: f.mimeType, size: stat.size };
    }
  }

  return null;
}

const router = Router();
router.use(authMiddleware);

function ensureUserBucket(store: ReturnType<typeof loadLocalStore>, userId: string) {
  if (!store.userData[userId]) {
    store.userData[userId] = {
      settings: { ...DEFAULT_SETTINGS },
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
router.get('/bootstrap', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const usePg = await isPostgresConnected();

    if (usePg) {
      const [settingsRow, activities, travels, people, notifications] = await Promise.all([
        prisma.userSettings.findUnique({ where: { userId } }),
        prisma.activity.findMany({ where: { userId } }),
        prisma.travel.findMany({ where: { userId } }),
        prisma.person.findMany({ where: { userId } }),
        prisma.notification.findMany({ where: { userId }, orderBy: { at: 'desc' }, take: 50 })
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
        : { ...DEFAULT_SETTINGS };

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
        goal: (a as any).goal || null,
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

    const store = loadLocalStore();
    const bucket = ensureUserBucket(store, userId);
    res.json({
      storage: 'cloud',
      settings: bucket.settings || { ...DEFAULT_SETTINGS },
      items: bucket.items || [],
      travels: bucket.travels || [],
      people: bucket.people || [],
      notifs: bucket.notifs || []
    });
  } catch (err) {
    console.error('Erro em /bootstrap:', err);
    res.status(500).json({ error: 'Erro ao carregar dados da agenda.' });
  }
});

// PUT /api/agenda/doc/:docId — cria ou atualiza documento (activity, travel, person, settings, notifs)
router.put('/doc/:docId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const docId = req.params.docId;
    const data = req.body;
    const usePg = await isPostgresConnected();

    if (usePg) {
      if (docId === 'settings') {
        await prisma.userSettings.upsert({
          where: { userId },
          create: {
            userId,
            mode: data.mode || 'confirm',
            workStart: data.workStart || '08:00',
            workEnd: data.workEnd || '18:00',
            workDays: data.workDays || [1, 2, 3, 4, 5],
            categories: data.categories || DEFAULT_CATEGORIES,
            specialCats: true
          },
          update: {
            mode: data.mode || 'confirm',
            workStart: data.workStart || '08:00',
            workEnd: data.workEnd || '18:00',
            workDays: data.workDays || [1, 2, 3, 4, 5],
            categories: data.categories || DEFAULT_CATEGORIES,
            specialCats: true
          }
        });
        res.json({ ok: true });
        return;
      }

      if (docId === 'notifs') {
        const list = Array.isArray(data.items) ? data.items.slice(0, 50) : [];
        await prisma.notification.deleteMany({ where: { userId } });
        if (list.length > 0) {
          await prisma.notification.createMany({
            data: list.map((n: any) => ({
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
          goal: data.goal || null,
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
        await prisma.activity.upsert({
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
        await prisma.travel.upsert({
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
        await prisma.person.upsert({
          where: { id: docId },
          create: { id: docId, ...payload },
          update: payload
        });
        res.json({ ok: true });
        return;
      }
    }

    // Fallback local store
    const store = loadLocalStore();
    const bucket = ensureUserBucket(store, userId);

    if (docId === 'settings') {
      bucket.settings = { ...data, kind: 'settings' };
    } else if (docId === 'notifs') {
      bucket.notifs = Array.isArray(data.items) ? data.items.slice(0, 50) : [];
    } else if (data.kind === 'activity') {
      const idx = bucket.items.findIndex((x) => x.id === docId);
      const item = { ...data, id: docId };
      if (idx >= 0) bucket.items[idx] = item;
      else bucket.items.push(item);
    } else if (data.kind === 'travel') {
      const idx = bucket.travels.findIndex((x) => x.id === docId);
      const tr = { ...data, id: docId };
      if (idx >= 0) bucket.travels[idx] = tr;
      else bucket.travels.push(tr);
    } else if (data.kind === 'person') {
      const idx = bucket.people.findIndex((x) => x.id === docId);
      const pe = { ...data, id: docId };
      if (idx >= 0) bucket.people[idx] = pe;
      else bucket.people.push(pe);
    }

    saveLocalStore(store);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro em PUT /doc/:docId:', err);
    res.status(500).json({ error: 'Erro ao salvar documento.' });
  }
});

// DELETE /api/agenda/doc/:docId
router.delete('/doc/:docId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const docId = req.params.docId;
    const usePg = await isPostgresConnected();

    if (usePg) {
      await Promise.allSettled([
        prisma.activity.deleteMany({ where: { id: docId, userId } }),
        prisma.travel.deleteMany({ where: { id: docId, userId } }),
        prisma.person.deleteMany({ where: { id: docId, userId } })
      ]);
      res.json({ ok: true });
      return;
    }

    const store = loadLocalStore();
    const bucket = ensureUserBucket(store, userId);
    bucket.items = bucket.items.filter((x) => x.id !== docId);
    bucket.travels = bucket.travels.filter((x) => x.id !== docId);
    bucket.people = bucket.people.filter((x) => x.id !== docId);
    saveLocalStore(store);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro em DELETE /doc/:docId:', err);
    res.status(500).json({ error: 'Erro ao remover documento.' });
  }
});

// POST /api/agenda/files — upload de anexo (Base64 + Cache Binário em Disco para Streaming)
router.post('/files', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id, name, mimeType, size, dataBase64 } = req.body;
    if (!id || !dataBase64) {
      res.status(400).json({ error: 'Arquivo inválido.' });
      return;
    }

    const cleanName = name || 'arquivo';
    const cleanMime = mimeType || 'application/octet-stream';
    const cleanSize = Number(size || 0);

    // Salva em disco em data/uploads para streaming leve via HTTP Range (206 Partial Content)
    writeFileDiskCache(userId, id, cleanName, cleanMime, dataBase64);

    const usePg = await isPostgresConnected();
    if (usePg) {
      await prisma.fileAsset.upsert({
        where: { id },
        create: { id, userId, name: cleanName, mimeType: cleanMime, size: cleanSize, dataBase64 },
        update: { name: cleanName, mimeType: cleanMime, size: cleanSize, dataBase64 }
      });
      res.status(201).json({ id, store: 'asset' });
      return;
    }

    const store = loadLocalStore();
    const bucket = ensureUserBucket(store, userId);
    bucket.files[id] = { id, name: cleanName, mimeType: cleanMime, size: cleanSize, dataBase64 };
    saveLocalStore(store);
    res.status(201).json({ id, store: 'asset' });
  } catch (err) {
    console.error('Erro no upload de arquivo:', err);
    res.status(500).json({ error: 'Erro ao salvar anexo.' });
  }
});

// GET /api/agenda/files/:fileId/stream — streaming binário com suporte a HTTP Range (vídeo, áudio, PDF e documentos)
router.get('/files/:fileId/stream', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const fileId = req.params.fileId;
    const cached = await ensureDiskCachedFile(userId, fileId);
    if (!cached) {
      res.status(404).json({ error: 'Arquivo não encontrado.' });
      return;
    }

    const { binPath, name, mimeType, size } = cached;
    const isDownload = req.query.download === '1';
    const encodedName = encodeURIComponent(name);

    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename*=UTF-8''${encodedName}`
    );

    const range = req.headers.range;
    if (range && size > 0) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
      if (isNaN(start) || isNaN(end) || start >= size || end >= size || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
        return;
      }
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', String(chunkSize));
      fs.createReadStream(binPath, { start, end }).pipe(res);
      return;
    }

    res.setHeader('Content-Length', String(size));
    fs.createReadStream(binPath).pipe(res);
  } catch (err) {
    console.error('Erro no streaming de arquivo:', err);
    res.status(500).json({ error: 'Erro ao transmitir arquivo.' });
  }
});

// GET /api/agenda/files/:fileId
router.get('/files/:fileId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const fileId = req.params.fileId;
    const usePg = await isPostgresConnected();

    if (usePg) {
      const f = await prisma.fileAsset.findFirst({ where: { id: fileId, userId } });
      if (!f) {
        res.status(404).json({ error: 'Arquivo não encontrado.' });
        return;
      }
      res.json(f);
      return;
    }

    const store = loadLocalStore();
    const bucket = ensureUserBucket(store, userId);
    const f = bucket.files[fileId];
    if (!f) {
      res.status(404).json({ error: 'Arquivo não encontrado.' });
      return;
    }
    res.json(f);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar arquivo.' });
  }
});

// DELETE /api/agenda/files/:fileId
router.delete('/files/:fileId', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const fileId = req.params.fileId;
    removeFileDiskCache(fileId);
    const usePg = await isPostgresConnected();

    if (usePg) {
      await prisma.fileAsset.deleteMany({ where: { id: fileId, userId } });
      res.json({ ok: true });
      return;
    }

    const store = loadLocalStore();
    const bucket = ensureUserBucket(store, userId);
    delete bucket.files[fileId];
    saveLocalStore(store);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir arquivo.' });
  }
});

export default router;
