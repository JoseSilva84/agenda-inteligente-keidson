import { api } from '../services/api';
import {
  LSK,
  PRIO,
  addY,
  clone,
  dow,
  fmtD,
  fmtDW,
  fmtH,
  fromMin,
  nowMin,
  parse,
  todayY,
  toMin,
  uid,
  weekStart
} from './agendaHelpers';
import { DEFAULT_SETTINGS, FileStore, normSettings, stableStr, toast } from './agendaStorage';

export const S: any = {
  items: new Map<string, any>(),
  travels: new Map<string, any>(),
  people: new Map<string, any>(),
  peopleTab: 'aniversario',
  settings: null as any,
  notifs: [] as any[],
  tab: 'agenda',
  view: typeof window !== 'undefined' && window.innerWidth < 720 ? 'day' : 'week',
  cursor: todayY(),
  customDays: [] as string[],
  multiSelectMode: false,
  hidden: new Set<string>(),
  q: '',
  listRange: 'next',
  listStatus: 'all',
  storage: 'loading',
  readOnly: false,
  loaded: false,
  gotData: false,
  loadSlow: false,
  loadErr: null as any,
  sumWeek: weekStart(todayY()),
  dragging: false,
  pendingRender: false,
  scroll: undefined as number | undefined,
  suppressClick: 0,
  pendEdits: {} as Record<string, any>,
  lastDay: todayY(),
  popOpen: false,
  sideHidden: (() => {
    try {
      return localStorage.getItem(LSK + ':side') === '1';
    } catch {
      return false;
    }
  })(),
  clip: null as any,
  pasteMode: false,
  lastTap: null as any,
  hoverEl: null as HTMLElement | null,
  hoverSlot: null as { date: string; m: number } | null,
  _gridDays: [] as string[],
  chat: {
    turns: [] as any[],
    msgs: [] as any[],
    busy: false,
    ctl: null as AbortController | null,
    proposals: new Map<string, any>(),
    disabled: null as string | null
  },
  onRender: null as (() => void) | null,
  onAfterLoad: null as (() => void) | null
};

export const ST = () => S.settings || DEFAULT_SETTINGS();
export const ensureSettings = () => {
  if (!S.settings) S.settings = DEFAULT_SETTINGS();
  return S.settings;
};
export const cat = (id: string) =>
  ST().categories.find((c: any) => c.id === id) || { id: '', name: 'Sem categoria', color: '#7A8199' };
export const isRec = (it: any) => !!(it && it.recur && it.recur.freq && it.recur.freq !== 'none');

export function currentDoc(id: string) {
  if (id === 'settings') return S.settings ? { ...S.settings, kind: 'settings' } : null;
  if (id === 'notifs') return { kind: 'notifs', items: S.notifs.slice(0, 50) };
  const it = S.items.get(id) || S.travels.get(id) || S.people.get(id);
  if (!it) return null;
  return clone(it);
}

export const Undo = {
  shadow: new Map<string, string | null>(),
  undo: [] as any[],
  redo: [] as any[],
  pending: null as any[] | null,
  applying: false,
  seedAll() {
    this.shadow = new Map();
    for (const m of [S.items, S.travels, S.people]) {
      for (const [id] of m) this.shadow.set(id, stableStr(currentDoc(id)));
    }
    if (S.settings) this.shadow.set('settings', stableStr(currentDoc('settings')));
  },
  record(docId: string) {
    if (docId === 'notifs') return;
    const cur = stableStr(currentDoc(docId));
    const prev = this.shadow.has(docId) ? this.shadow.get(docId)! : null;
    if (cur === null) this.shadow.delete(docId);
    else this.shadow.set(docId, cur);
    if (this.applying || prev === cur) return;
    if (!this.pending) {
      this.pending = [];
      setTimeout(() => {
        const g = this.pending;
        this.pending = null;
        if (g && g.length) {
          this.undo.push(g);
          if (this.undo.length > 60) this.undo.shift();
          this.redo = [];
        }
      }, 0);
    }
    const e = this.pending.find((x) => x.id === docId);
    if (e) e.next = cur;
    else this.pending.push({ id: docId, prev, next: cur });
  },
  label(g: any[]) {
    const e = g[0];
    const v = JSON.parse(e.prev || e.next || 'null') || {};
    const what = v.title || v.name || (e.id === 'settings' ? 'ajustes' : '');
    return (what ? `“${what}”` : '') + (g.length > 1 ? ` e mais ${g.length - 1}` : '');
  },
  apply(g: any[], dir: 'undo' | 'redo') {
    this.applying = true;
    for (const e of g) {
      const raw = dir === 'undo' ? e.prev : e.next;
      const val = raw ? JSON.parse(raw) : null;
      if (e.id === 'settings') S.settings = val ? normSettings(val) : null;
      else {
        S.items.delete(e.id);
        S.travels.delete(e.id);
        S.people.delete(e.id);
        if (val) {
          const map =
            val.kind === 'activity'
              ? S.items
              : val.kind === 'travel'
              ? S.travels
              : val.kind === 'person'
              ? S.people
              : null;
          if (map) map.set(e.id, { ...val, id: e.id });
        }
      }
      Store.write(e.id);
    }
    this.applying = false;
    S.onRender && S.onRender();
  },
  doUndo() {
    if (this.pending && this.pending.length) {
      this.undo.push(this.pending);
      this.pending = null;
    }
    const g = this.undo.pop();
    if (!g) {
      toast('Nada para desfazer.');
      return;
    }
    this.apply(g, 'undo');
    this.redo.push(g);
    toast(`Desfeito ${this.label(g)}. ⌘+Shift+Z refaz.`);
  },
  doRedo() {
    const g = this.redo.pop();
    if (!g) {
      toast('Nada para refazer.');
      return;
    }
    this.apply(g, 'redo');
    this.undo.push(g);
    toast(`Refeito ${this.label(g)}.`);
  }
};

export const Store = {
  async start() {
    this.loadLocalCache();
    try {
      const { data } = await api.get('/agenda/bootstrap');
      S.items.clear();
      S.travels.clear();
      S.people.clear();
      for (const it of data.items || []) S.items.set(it.id, it);
      for (const tr of data.travels || []) S.travels.set(tr.id, tr);
      for (const pe of data.people || []) S.people.set(pe.id, pe);
      S.settings = data.settings ? normSettings(data.settings) : DEFAULT_SETTINGS();
      S.notifs = data.notifs || [];
      S.storage = data.storage === 'postgresql' ? 'postgresql' : 'cloud';
      S.loaded = true;
      S.gotData = true;
      this.saveLocal();
      Undo.seedAll();
      S.onAfterLoad && S.onAfterLoad();
      S.onRender && S.onRender();
    } catch {
      // Permanece com cache local PWA caso offline
      S.storage = 'local';
      S.loaded = true;
      S.gotData = true;
      Undo.seedAll();
      S.onAfterLoad && S.onAfterLoad();
      S.onRender && S.onRender();
    }
  },
  loadLocalCache() {
    try {
      const raw = localStorage.getItem(LSK);
      if (raw) {
        const o = JSON.parse(raw);
        for (const it of o.items || []) S.items.set(it.id, it);
        for (const tr of o.travels || []) S.travels.set(tr.id, tr);
        for (const pe of o.people || []) S.people.set(pe.id, pe);
        S.settings = o.settings ? normSettings(o.settings) : null;
        S.notifs = o.notifs || [];
      }
    } catch {}
  },
  saveLocal() {
    try {
      localStorage.setItem(
        LSK,
        JSON.stringify({
          items: [...S.items.values()],
          travels: [...S.travels.values()],
          people: [...S.people.values()],
          settings: S.settings,
          notifs: S.notifs.slice(0, 50)
        })
      );
    } catch {}
  },
  async write(docId: string) {
    Undo.record(docId);
    this.saveLocal();
    const data = currentDoc(docId);
    try {
      if (data) {
        await api.put(`/agenda/doc/${encodeURIComponent(docId)}`, data);
      } else {
        await api.delete(`/agenda/doc/${encodeURIComponent(docId)}`);
      }
    } catch {
      // Se offline no PWA, o dado já está salvo localmente
    }
  }
};

export function maybeDeleteAsset(aid?: string) {
  if (!aid) return;
  const used = () => [...S.items.values()].some((it: any) => (it.files || []).some((f: any) => f.id === aid));
  if (used()) return;
  setTimeout(() => {
    if (!used()) Promise.resolve().then(() => FileStore.del(aid)).catch(() => {});
  }, 5 * 60000);
}

/* ---------- ocorrências ---------- */
export function matches(it: any, d: string) {
  const r = it.recur;
  if (d < it.date) return false;
  if (r.until && d > r.until) return false;
  switch (r.freq) {
    case 'daily':
      return true;
    case 'weekdays': {
      const g = dow(d);
      return g >= 1 && g <= 5;
    }
    case 'weekly':
      return (r.days && r.days.length ? r.days : [dow(it.date)]).includes(dow(d));
    case 'monthly':
      return parse(d).getDate() === parse(it.date).getDate();
    case 'custom':
      return (r.dates || []).includes(d);
  }
  return false;
}

export function occ(it: any, origDate: string, ov: any) {
  const rec = isRec(it);
  return {
    key: rec ? it.id + '@' + origDate : it.id,
    id: it.id,
    item: it,
    origDate,
    date: (ov && ov.date) || origDate,
    start: (ov && ov.start) || it.start,
    end: (ov && ov.end) || it.end,
    status: rec ? (ov && ov.status) || 'planejada' : it.status || 'planejada',
    rec
  };
}

export function expand(from: string, to: string) {
  const out: any[] = [];
  for (const it of S.items.values()) {
    if (!isRec(it)) {
      if (it.date >= from && it.date <= to) out.push(occ(it, it.date, null));
      continue;
    }
    let lo = addY(from, -31);
    if (it.date > lo) lo = it.date;
    let hi = addY(to, 31);
    if (it.recur.until && it.recur.until < hi) hi = it.recur.until;
    for (let d = lo, n = 0; d <= hi && n < 1000; d = addY(d, 1), n++) {
      if (!matches(it, d)) continue;
      const ov = it.overrides && it.overrides[d];
      if (ov && ov.deleted) continue;
      const o = occ(it, d, ov);
      if (o.date >= from && o.date <= to) out.push(o);
    }
  }
  return out.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

export function subOccs(from: string, to: string) {
  const out: any[] = [];
  for (const it of S.items.values()) {
    const subs = it.subtasks || [];
    const n = subs.length;
    subs.forEach((x: any, i: number) => {
      if (!x.date || !x.start || x.date < from || x.date > to) return;
      const e = Math.min(1439, toMin(x.start) + Math.max(5, +x.dur || 30));
      out.push({
        key: 'sub:' + it.id + ':' + x.id,
        id: it.id,
        item: it,
        sub: x,
        subNo: i + 1,
        n,
        date: x.date,
        start: x.start,
        end: fromMin(e),
        status: x.done ? 'concluida' : 'planejada',
        rec: false,
        isSub: true
      });
    });
  }
  return out;
}

export const withSubs = (list: any[], from: string, to: string) =>
  list.concat(subOccs(from, to)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

export const occTitle = (o: any) =>
  o.isSub ? `${o.subNo}/${o.n} ${o.sub.text} · ${o.item.title}` : o.item.title;
export const parentKey = (it: any) => (isRec(it) ? it.id + '@' + it.date : it.id);

export function findOcc(key?: string | null) {
  if (!key) return null;
  if (key.startsWith('sub:')) {
    const [, id] = key.split(':');
    const it = S.items.get(id);
    if (!it) return null;
    return subOccs('0000-01-01', '9999-12-31').find((o) => o.key === key) || null;
  }
  const i = key.indexOf('@');
  if (i > 0) {
    const id = key.slice(0, i);
    const d = key.slice(i + 1);
    const it = S.items.get(id);
    if (!it || !isRec(it)) return null;
    return occ(it, d, it.overrides && it.overrides[d]);
  }
  const it = S.items.get(key);
  return it ? occ(it, it.date, null) : null;
}

export function effStatus(o: any) {
  if (o.status === 'planejada') {
    const t = todayY();
    if (o.date < t || (o.date === t && toMin(o.end) <= nowMin())) return 'pendente';
  }
  return o.status;
}

export const visible = (list: any[]) => list.filter((o) => !S.hidden.has(o.item.category || ''));
export const activeOn = (d: string) =>
  expand(d, d).filter((o) => !['cancelada', 'reagendada'].includes(o.status));
export const overlaps = (o: any, list: any[]) =>
  list.filter((x) => x.key !== o.key && toMin(x.start) < toMin(o.end) && toMin(o.start) < toMin(x.end));

export function travelSegs(d: string) {
  const out: Array<{ tr: any; s: number; e: number }> = [];
  for (const tr of S.travels.values()) {
    if (d < tr.date || d > tr.endDate) continue;
    const s0 = d === tr.date ? toMin(tr.start) : 0;
    const e0 = d === tr.endDate ? toMin(tr.end) : 1440;
    if (e0 > s0) out.push({ tr, s: s0, e: e0 });
  }
  return out;
}

export const travelText = (tr: any) =>
  `${tr.title || 'Viagem'} · saída ${fmtDW(tr.date)} ${fmtH(tr.start)} · retorno ${fmtDW(tr.endDate)} ${fmtH(tr.end)}`;

export function pendingOccs() {
  const t = todayY();
  return expand(addY(t, -30), addY(t, -1)).filter((o) => {
    if (effStatus(o) !== 'pendente') return false;
    if (o.item.autoResched === false) return false;
    if (o.rec) {
      const ov = o.item.overrides && o.item.overrides[o.origDate];
      if (ov && ov.kept) return false;
    } else if (o.item.kept) return false;
    return true;
  });
}

export function findSlot(o: any, taken: Record<string, Array<[number, number]>>) {
  const st = ST();
  const ws = toMin(st.workStart);
  const we = toMin(st.workEnd);
  const dur = Math.max(15, toMin(o.end) - toMin(o.start));
  const tomorrow = addY(todayY(), 1);
  const nextWeek = addY(weekStart(o.date), 7);
  let d = o.item.fixed ? tomorrow : nextWeek > tomorrow ? nextWeek : tomorrow;
  const deadline = o.item.fixed && o.item.deadline ? o.item.deadline : null;
  if (deadline && deadline < tomorrow) {
    return { o, conflict: `O prazo fixo (${fmtD(deadline)}) já passou. Escolha um novo horário.` };
  }
  for (let i = 0; i < 28; i++, d = addY(d, 1)) {
    if (deadline && d > deadline) {
      return { o, conflict: `Prazo fixo em ${fmtD(deadline)}: não há horário livre antes dele.` };
    }
    if (!st.workDays.includes(dow(d))) continue;
    const busy = activeOn(d)
      .filter((x) => x.key !== o.key)
      .map((x): [number, number] => [toMin(x.start), toMin(x.end)])
      .concat(taken[d] || [], travelSegs(d).map((x): [number, number] => [x.s, x.e]));
    const free = (s: number) => s >= ws && s + dur <= we && !busy.some(([a, b]) => s < b && a < s + dur);
    let s: number | null = null;
    const pref = toMin(o.start);
    if (free(pref)) s = pref;
    else {
      for (let m = ws; m + dur <= we; m += 30) {
        if (free(m)) {
          s = m;
          break;
        }
      }
    }
    if (s !== null) {
      (taken[d] = taken[d] || []).push([s, s + dur]);
      return { o, date: d, start: fromMin(s), end: fromMin(s + dur) };
    }
  }
  return { o, conflict: 'Nenhum horário livre nas próximas 4 semanas.' };
}

export function suggestAll() {
  const list = pendingOccs().sort(
    (a, b) =>
      PRIO[a.item.priority || 'media'].w - PRIO[b.item.priority || 'media'].w ||
      (a.date + a.start).localeCompare(b.date + b.start)
  );
  const taken: Record<string, Array<[number, number]>> = {};
  return list.map((o) => findSlot(o, taken));
}
