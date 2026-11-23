import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getWebPushPublicKey, isWebPushConfigured, sendWebPushToUser } from '../lib/push';
import { isPostgresConnected, prisma } from '../lib/db';

const router = Router();
router.use(authMiddleware);

function readSubscription(body: any) {
  const endpoint = String(body?.endpoint || '').trim();
  const p256dh = String(body?.keys?.p256dh || '').trim();
  const auth = String(body?.keys?.auth || '').trim();
  const contentEncoding = String(body?.contentEncoding || 'aes128gcm').trim();
  if (!endpoint.startsWith('https://') || !p256dh || !auth) return null;
  if (endpoint.length > 4096 || p256dh.length > 1024 || auth.length > 1024) return null;
  return { endpoint, p256dh, auth, contentEncoding };
}

router.get('/public-key', async (_req: Request, res: Response) => {
  if (!isWebPushConfigured) {
    res.status(503).json({ enabled: false, error: 'Web Push ainda não está configurado no servidor.' });
    return;
  }
  res.json({ enabled: true, publicKey: getWebPushPublicKey() });
});

router.get('/status', async (req: Request, res: Response) => {
  if (!(await isPostgresConnected())) {
    res.status(503).json({ enabled: false, error: 'Web Push requer o banco de dados PostgreSQL.' });
    return;
  }
  const devices = await prisma.pushSubscription.count({ where: { userId: req.user!.userId } });
  res.json({ enabled: isWebPushConfigured, devices });
});

router.post('/subscribe', async (req: Request, res: Response) => {
  const subscription = readSubscription(req.body);
  if (!subscription) {
    res.status(400).json({ error: 'Inscrição de notificações inválida.' });
    return;
  }
  if (!isWebPushConfigured) {
    res.status(503).json({ error: 'Web Push ainda não está configurado no servidor.' });
    return;
  }
  if (!(await isPostgresConnected())) {
    res.status(503).json({ error: 'Web Push requer o banco de dados PostgreSQL.' });
    return;
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId: req.user!.userId,
      ...subscription,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500)
    },
    update: {
      userId: req.user!.userId,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      contentEncoding: subscription.contentEncoding,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500)
    }
  });
  res.status(201).json({ ok: true });
});

router.delete('/subscribe', async (req: Request, res: Response) => {
  const endpoint = String(req.body?.endpoint || '').trim();
  if (!endpoint) {
    res.status(400).json({ error: 'Informe o aparelho que deve deixar de receber notificações.' });
    return;
  }
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user!.userId } });
  res.json({ ok: true });
});

router.post('/test', async (req: Request, res: Response) => {
  if (!(await isPostgresConnected())) {
    res.status(503).json({ error: 'Web Push requer o banco de dados PostgreSQL.' });
    return;
  }
  const result = await sendWebPushToUser(req.user!.userId, {
    title: 'Agenda Inteligente',
    body: 'As notificações estão ativas neste aparelho.',
    url: '/#agenda',
    tag: `agenda-push-test-${Date.now()}`
  });
  if (result.disabled) {
    res.status(503).json({ error: 'Web Push ainda não está configurado no servidor.' });
    return;
  }
  res.json({ ok: true, sent: result.sent });
});

export default router;
