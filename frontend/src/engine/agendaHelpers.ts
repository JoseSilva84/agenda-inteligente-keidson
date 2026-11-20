import { jsPDF } from 'jspdf';

export const HOUR_START = 4;
export const HOUR_END = 24;
export const PPH = 80;
export const QH = PPH / 4;
export const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WD_LONG = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const STATUS: Record<string, string> = {
  planejada: 'Planejada',
  concluida: 'Concluída',
  pendente: 'Pendente',
  cancelada: 'Cancelada',
  reagendada: 'Remarcada'
};
export const PRIO: Record<string, { label: string; w: number }> = {
  alta: { label: 'Alta', w: 0 },
  media: { label: 'Média', w: 1 },
  baixa: { label: 'Baixa', w: 2 }
};
export const REMINDERS: Array<[number, string]> = [
  [0, 'Sem lembrete'],
  [10, '10 min antes'],
  [30, '30 min antes'],
  [60, '1 hora antes'],
  [1440, '1 dia antes']
];
export const LSK = 'agenda-inteligente-v1';
export const WD_EN = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
export const MONTHS_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

export const ICON: Record<string, string> = {
  agenda: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  pend: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4M12 8v4l3 2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  ai: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h5"/>',
  check: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="m8 12 3 3 5-6"/>',
  yt: '<rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 7 8.5-7"/>',
  gcal: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 12.5v5M9.5 15h5"/>',
  cake: '<path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 5 0M12 12V8M12 5.5c.8-.8.8-1.7 0-2.5-.8.8-.8 1.7 0 2.5z"/>',
  clip: '<path d="m21 11.5-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/>',
  rep: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  wa: '<path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.3z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8a5 5 0 0 1-2.2-2.2l.8-1-1-2z"/>',
  dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
};

export const ic = (n: string, s?: number) =>
  `<svg class="i" viewBox="0 0 24 24"${s ? ` style="width:${s}px;height:${s}px"` : ''}>${ICON[n] || ''}</svg>`;

export const pad = (n: number | string) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addY = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const dow = (s: string) => parse(s).getDay();
export const weekStart = (s: string) => addY(s, -dow(s));
export const toMin = (t?: string) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const fromMin = (m: number) => {
  m = Math.max(0, Math.min(1439, Math.round(m)));
  return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
};
export const todayY = () => ymd(new Date());
export const nowMin = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
export const dayDiff = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
export const esc = (s: any) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
export const fmtD = (s: string) => {
  const d = parse(s);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};
export const fmtDW = (s: string) => `${WD[dow(s)].toLowerCase()} ${fmtD(s)}`;
export const fmtDL = (s: string) => {
  const d = parse(s);
  return `${WD_LONG[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
};
export const fmtH = (t: string) => {
  const [h, m] = String(t).split(':');
  return m === '00' ? `${+h}h` : `${+h}h${m}`;
};
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o ?? null));
export const validY = (s: any): string | null => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
export const validT = (s: any): string | null => (typeof s === 'string' && /^\d{1,2}:\d{2}$/.test(s) ? fromMin(toMin(s)) : null);
export const safeColor = (c?: string) => (/^#[0-9a-f]{6}$/i.test(c || '') ? (c as string) : '#7A8199');
export const plural = (n: number, s: string, p: string) => (n === 1 ? s : p);
export const fmtFull = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
export function weekNo(d: string) {
  const ws = weekStart(d);
  const Y = parse(addY(ws, 6)).getFullYear();
  return Math.floor(dayDiff(weekStart(`${Y}-01-01`), ws) / 7) + 1;
}
export function fmtDur(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? (r ? `${h}h${pad(r)}` : `${h}h`) : `${r} min`;
}

export function triggerBrowserDownload(filename: string, data: Blob | ArrayBuffer | string) {
  let blob: Blob;
  if (data instanceof Blob) blob = data;
  else if (data instanceof ArrayBuffer) blob = new Blob([data], { type: 'application/pdf' });
  else blob = new Blob([data], { type: 'application/json;charset=utf-8' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export { jsPDF };
