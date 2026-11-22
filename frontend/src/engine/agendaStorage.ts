import { toast as sonnerToast } from 'sonner';
import { api } from '../services/api';
import { uid, clone } from './agendaHelpers';

export const DEFAULT_SETTINGS = () => ({
  kind: 'settings',
  mode: 'confirm',
  workStart: '08:00',
  workEnd: '18:00',
  workDays: [1, 2, 3, 4, 5],
  categories: [
    { id: 'trabalho', name: 'Trabalho', color: '#2F5BEA' },
    { id: 'estudos', name: 'Estudos', color: '#8B5CF6' },
    { id: 'saude', name: 'Saúde', color: '#0E9F6E' },
    { id: 'pessoal', name: 'Pessoal', color: '#E8811A' },
    { id: 'reunioes', name: 'Reuniões', color: '#DB3F78' },
    { id: 'aniversariantes', name: 'Aniversariantes', color: '#E0A100' },
    { id: 'diasprof', name: 'Dias profissionais', color: '#0F8C8C' }
  ]
});

const PASTOR_AVATAR_KEY = 'agenda-pastor-avatar';

export function getPastorAvatar(): string {
  try {
    return localStorage.getItem(PASTOR_AVATAR_KEY) || '/pastor.jpg';
  } catch {
    return '/pastor.jpg';
  }
}

export function setPastorAvatar(dataUrl: string) {
  try {
    localStorage.setItem(PASTOR_AVATAR_KEY, dataUrl);
    window.dispatchEvent(new CustomEvent('pastor-avatar-changed', { detail: dataUrl }));
  } catch {}
}

export function resetPastorAvatar() {
  try {
    localStorage.removeItem(PASTOR_AVATAR_KEY);
    window.dispatchEvent(new CustomEvent('pastor-avatar-changed', { detail: '/pastor.jpg' }));
  } catch {}
}

export function normSettings(s: any) {
  const d = DEFAULT_SETTINGS();
  let cats = Array.isArray(s?.categories) && s.categories.length ? s.categories : d.categories;
  // Contas antigas podem ter só três categorias. Complete o conjunto do modelo
  // uma vez, mantendo cores e categorias personalizadas já salvas.
  if (!s?.categoryDefaultsMigrated) {
    const existing = new Map(cats.map((c: any) => [c.id, c]));
    cats = [
      ...d.categories.map((c) => existing.get(c.id) || c),
      ...cats.filter((c: any) => !d.categories.some((base) => base.id === c.id))
    ];
  }
  if (!s?.specialCats) {
    for (const k of d.categories.filter((c) => c.id === 'aniversariantes' || c.id === 'diasprof')) {
      if (!cats.some((c: any) => c.id === k.id)) cats = [...cats, k];
    }
  }
  return {
    ...d,
    ...s,
    mode: 'confirm',
    specialCats: true,
    categoryDefaultsMigrated: true,
    kind: 'settings',
    categories: cats,
    workDays: Array.isArray(s?.workDays) ? s.workDays : d.workDays
  };
}

export function toast(msg: string, kind?: string) {
  if (kind === 'warn') {
    sonnerToast.warning(msg);
  } else {
    sonnerToast(msg);
  }
}

export function browserNotify(title: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, tag: title + body, requireInteraction: true });
    }
  } catch {}
}

let audioCtx: AudioContext | null = null;
export function initAudio() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!audioCtx && Ctx) audioCtx = new Ctx();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}

export function chime() {
  try {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    [880, 1175, 880].forEach((f, i) => {
      const o = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.22 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.22 + 0.2);
      o.connect(g).connect(audioCtx!.destination);
      o.start(t + i * 0.22);
      o.stop(t + i * 0.22 + 0.22);
    });
  } catch {}
}

export function blobToB64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

export function b64ToBlob(b64: string, type?: string): Blob {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: type || 'application/octet-stream' });
}

export function compressImage(file: File, max = 1800, q = 0.82): Promise<Blob> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/jpeg', q);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error('img'));
    };
    img.src = url;
  });
}

export const FileStore = {
  idb: null as Promise<IDBDatabase> | null,
  openIdb(): Promise<IDBDatabase> {
    if (this.idb) return this.idb;
    this.idb = new Promise((res, rej) => {
      const r = indexedDB.open('agenda-arquivos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this.idb;
  },
  async idbOp(mode: IDBTransactionMode, fn: (st: IDBObjectStore) => IDBRequest): Promise<any> {
    const db = await this.openIdb();
    return new Promise((res, rej) => {
      const tx = db.transaction('files', mode);
      const req = fn(tx.objectStore('files'));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  },
  mode(): 'idb' | 'asset' | null {
    try {
      if (window.indexedDB) return 'idb';
    } catch {}
    return 'asset';
  },
  limit(m: string | null) {
    return (m === 'db' ? 10 : 20) * 1048576;
  },
  async put(file: Blob | File): Promise<{ id: string; store: string }> {
    const id = 'fidb_' + uid();
    try {
      await this.idbOp('readwrite', (st) => st.put(file, id));
    } catch {}
    // Sincroniza com o backend Node.js/PostgreSQL via Axios se tiver até 12MB
    if (file.size <= 12 * 1048576) {
      try {
        const dataBase64 = await blobToB64(file);
        await api.post('/agenda/files', {
          id,
          name: (file as File).name || 'arquivo',
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          dataBase64
        });
      } catch {}
    }
    return { id, store: 'idb' };
  },
  async blob(f: any): Promise<Blob> {
    try {
      const b = await this.idbOp('readonly', (st) => st.get(f.id));
      if (b) return b;
    } catch {}
    const { data } = await api.get(`/agenda/files/${encodeURIComponent(f.id)}`);
    if (data && data.dataBase64) {
      const blob = b64ToBlob(data.dataBase64, data.mimeType || f.type);
      try {
        await this.idbOp('readwrite', (st) => st.put(blob, f.id));
      } catch {}
      return blob;
    }
    throw new Error('missing');
  },
  async del(id: string) {
    try {
      await this.idbOp('readwrite', (st) => st.delete(id));
    } catch {}
    try {
      await api.delete(`/agenda/files/${encodeURIComponent(id)}`);
    } catch {}
  }
};

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = src;
    sc.onload = () => res();
    sc.onerror = () => rej();
    document.head.appendChild(sc);
  });
}

export async function renderPdf(blob: Blob, box: HTMLElement) {
  const w = window as any;
  if (!w.pdfjsLib) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    w.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  const pdf = await w.pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  box.innerHTML = '';
  box.className = 'pdfpages';
  const width = Math.min(900, box.clientWidth - 24 || 800);
  for (let n = 1; n <= Math.min(pdf.numPages, 60); n++) {
    const page = await pdf.getPage(n);
    const v1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: (width / v1.width) * (window.devicePixelRatio || 1) });
    const c = document.createElement('canvas');
    c.width = vp.width;
    c.height = vp.height;
    c.style.width = width + 'px';
    box.appendChild(c);
    await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise;
  }
}

export const stableStr = (v: any) =>
  v == null
    ? null
    : JSON.stringify(v, (_k, x) =>
        x && typeof x === 'object' && !Array.isArray(x)
          ? Object.keys(x)
              .sort()
              .reduce((o: any, kk) => ((o[kk] = x[kk]), o), {})
          : x
      );
