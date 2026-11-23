import { api } from './api';

type PushStatus = {
  supported: boolean;
  subscribed: boolean;
  enabled: boolean;
  devices: number;
  reason?: string;
};

function isIosOrIpad() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone);
}

function toUint8Array(base64Url: string) {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64Url.length / 4) * 4, '=');
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function isSupported() {
  return Boolean(window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
}

async function registration() {
  return navigator.serviceWorker.ready;
}

export async function getWebPushStatus(): Promise<PushStatus> {
  if (!isSupported()) {
    return { supported: false, subscribed: false, enabled: false, devices: 0, reason: 'Este navegador não oferece suporte a notificações Push.' };
  }
  try {
    const [worker, response] = await Promise.all([registration(), api.get('/push/status')]);
    const subscription = await worker.pushManager.getSubscription();
    return { supported: true, subscribed: Boolean(subscription), enabled: Boolean(response.data.enabled), devices: Number(response.data.devices || 0) };
  } catch (error: any) {
    return { supported: true, subscribed: false, enabled: false, devices: 0, reason: error?.response?.data?.error || 'Não foi possível consultar as notificações Push.' };
  }
}

export async function enableWebPush() {
  if (!isSupported()) throw new Error('Este navegador não oferece suporte a notificações Push.');
  if (isIosOrIpad() && !isStandalone()) {
    throw new Error('No iPad e iPhone, instale a Agenda na Tela de Início antes de ativar as notificações.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('A permissão de notificações não foi concedida.');

  const { data } = await api.get('/push/public-key');
  if (!data?.publicKey) throw new Error('O servidor ainda não está pronto para Web Push.');
  const worker = await registration();
  let subscription = await worker.pushManager.getSubscription();
  if (!subscription) {
    subscription = await worker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toUint8Array(data.publicKey)
    });
  }
  await api.post('/push/subscribe', subscription.toJSON());
  return getWebPushStatus();
}

export async function disableWebPush() {
  if (!isSupported()) return getWebPushStatus();
  const worker = await registration();
  const subscription = await worker.pushManager.getSubscription();
  if (subscription) {
    await api.delete('/push/subscribe', { data: { endpoint: subscription.endpoint } });
    await subscription.unsubscribe();
  }
  return getWebPushStatus();
}

export async function testWebPush() {
  const { data } = await api.post('/push/test');
  return Number(data.sent || 0);
}
