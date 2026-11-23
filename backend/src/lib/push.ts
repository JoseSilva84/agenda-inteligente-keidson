import webpush from 'web-push';
import { prisma } from './db';

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || '';
const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || '';
const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:suporte@devjosesilva.tech';

export const isWebPushConfigured = Boolean(publicKey && privateKey);

if (isWebPushConfigured) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch (error) {
    console.error('Erro ao configurar as chaves VAPID:', error);
  }
}

export function getWebPushPublicKey() {
  return publicKey;
}

export async function sendWebPushToUser(userId: string, payload: PushPayload) {
  if (!isWebPushConfigured) return { sent: 0, disabled: true };

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth }
          },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: 'high' }
        );
        sent += 1;
      } catch (error: any) {
        const statusCode = Number(error?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
          return;
        }
        console.error('Erro ao enviar Web Push:', statusCode || error?.message || error);
      }
    })
  );

  return { sent, disabled: false };
}
