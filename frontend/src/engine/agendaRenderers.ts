import { api } from '../services/api';
import tippy, { type Instance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import {
  HOUR_END,
  HOUR_START,
  LSK,
  MONTHS,
  MONTHS_EN,
  PPH,
  PRIO,
  QH,
  STATUS,
  WD,
  WD_EN,
  WD_LONG,
  addY,
  clone,
  dayDiff,
  dow,
  esc,
  fmtD,
  fmtDL,
  fmtDW,
  fmtDur,
  fmtFull,
  fmtH,
  fromMin,
  ic,
  jsPDF,
  noteToHtml,
  noteToPlain,
  nowMin,
  pad,
  parse,
  plural,
  safeColor,
  todayY,
  toMin,
  triggerBrowserDownload,
  uid,
  weekNo,
  weekStart,
  ymd
} from './agendaHelpers';
import {
  S,
  ST,
  Store,
  activeOn,
  cat,
  effStatus,
  ensureSettings,
  expand,
  findOcc,
  isRec,
  maybeDeleteAsset,
  occTitle,
  overlaps,
  pendingOccs,
  suggestAll,
  travelSegs,
  visible,
  withSubs
} from './agendaCore';
import { browserNotify, chime, toast, getPastorAvatar } from './agendaStorage';

export const $ = (s: string, r: Document | HTMLElement = document) => r.querySelector(s) as any;
export const $$ = (s: string, r: Document | HTMLElement = document) => [...r.querySelectorAll(s)] as any[];

const tooltipOccurrences = new Map<string, any>();
let activityTooltips: Instance[] = [];

function tooltipAttr(o: any) {
  tooltipOccurrences.set(o.key, o);
  return `data-tooltip-key="${esc(o.key)}"`;
}

function detailTooltip(titleText: string, details: Array<[string, string]>, notes = '') {
  const box = document.createElement('div');
  box.className = 'activity-tooltip';
  const title = document.createElement('strong');
  title.className = 'activity-tooltip-title';
  title.textContent = titleText;
  box.appendChild(title);
  for (const [label, value] of details) {
    const row = document.createElement('div');
    row.className = 'activity-tooltip-row';
    const key = document.createElement('span');
    key.textContent = label;
    const detail = document.createElement('span');
    detail.textContent = value;
    row.append(key, detail);
    box.appendChild(row);
  }
  if (notes) {
    const note = document.createElement('div');
    note.className = 'activity-tooltip-note';
    note.innerHTML = noteToHtml(notes);
    box.appendChild(note);
  }
  return box;
}

function tooltipContent(o: any) {
  if (!o) return detailTooltip('Atividade', []);
  const details: Array<[string, string]> = [
    ['Data', o.displayRange ? `${fmtDL(o.displayRange[0])} a ${fmtDL(o.displayRange[1])}` : fmtDL(o.date)],
    ['Horário', `${fmtH(o.start)}–${fmtH(o.end)}`],
    ['Categoria', cat(o.item.category).name],
    ['Estado', STATUS[effStatus(o)] || 'Planejada']
  ];
  if (o.rec) details.push(['Recorrência', 'Atividade recorrente']);
  if (o.isSub) details.push(['Atividade', o.item.title]);
  return detailTooltip(o.isSub ? o.sub.text : occTitle(o), details, noteToPlain(o.item.notes) ? String(o.item.notes || '').trim() : '');
}

function tooltipForReference(reference: Element) {
  const element = reference as HTMLElement;
  if (element.dataset.tooltipKey) return tooltipContent(tooltipOccurrences.get(element.dataset.tooltipKey));
  if (element.dataset.tooltipTravel) {
    const tr = S.travels.get(element.dataset.tooltipTravel);
    return tr
      ? detailTooltip(tr.title || 'Viagem', [
          ['Saída', `${fmtDL(tr.date)}, ${fmtH(tr.start)}`],
          ['Retorno', `${fmtDL(tr.endDate)}, ${fmtH(tr.end)}`]
        ])
      : detailTooltip('Viagem', []);
  }
  const [date, type] = (element.dataset.tooltipPeople || '').split('|');
  const people = date && type ? peopleOn(date)[type] || [] : [];
  return detailTooltip(PTYPES[type]?.label || 'Data especial', [
    ['Data', date ? fmtDL(date) : ''],
    ['Pessoas', people.map((person: any) => person.name).join(', ')]
  ]);
}

function attachActivityTooltips(root: HTMLElement) {
  const targets = [...root.querySelectorAll<HTMLElement>('[data-tooltip-key], [data-tooltip-travel], [data-tooltip-people]')];
  activityTooltips = tippy(targets, {
    content: tooltipForReference,
    theme: 'agenda',
    placement: 'top',
    delay: [180, 60],
    maxWidth: 300,
    appendTo: () => document.body,
    trigger: 'mouseenter focus',
    touch: false,
    onShow: () => {
      if (S.dragging) return false;
    }
  });
}

export const TABS: Array<[string, string, string]> = [
  ['agenda', 'Agenda', 'agenda'],
  ['pendencias', 'Pendências', 'pend'],
  ['resumo', 'Resumo', 'chart'],
  ['assistente', 'Assistente', 'ai'],
  ['datas', 'Aniversários', 'cake'],
  ['ajustes', 'Ajustes', 'gear']
];

export const PTYPES: Record<string, { label: string; one: string; cat: string }> = {
  aniversario: { label: 'Aniversariantes', one: 'aniversariante', cat: 'aniversariantes' },
  profissional: { label: 'Dias profissionais', one: 'dia profissional', cat: 'diasprof' }
};

export function putItem(it: any) {
  it.updatedAt = Date.now();
  S.items.set(it.id, it);
  Store.write(it.id);
  scheduleRender();
}

export function delItem(id: string) {
  const it = S.items.get(id);
  S.items.delete(id);
  Store.write(id);
  ((it && it.files) || []).forEach((f: any) => maybeDeleteAsset(f.id));
  scheduleRender();
}

export function saveSettings() {
  ensureSettings();
  Store.write('settings');
  render();
}

export function patchOcc(o: any, patch: any, opts: any = {}) {
  const it = clone(S.items.get(o.id));
  if (!it) return;
  if (isRec(it) && !opts.series) {
    it.overrides = it.overrides || {};
    it.overrides[o.origDate] = { ...(it.overrides[o.origDate] || {}), ...patch };
  } else {
    Object.assign(it, patch);
  }
  if (opts.hist) {
    it.history = [...(it.history || []), { at: Date.now(), text: opts.hist }].slice(-30);
  }
  putItem(it);
}

export function patchSub(o: any, patch: any, msg?: string) {
  const it = clone(S.items.get(o.id));
  if (!it) return;
  const x = (it.subtasks || []).find((y: any) => y.id === o.sub.id);
  if (!x) return;
  Object.assign(x, patch);
  putItem(it);
  render();
  if (msg) toast(msg);
}

export function warnConflicts(date: string, start: string, end: string, key: string) {
  const id = String(key || '').split('@')[0];
  const c = overlaps(
    { key, start, end },
    activeOn(date).filter((x) => x.id !== id)
  );
  if (c.length) {
    toast(`Conflito de horário com “${c[0].item.title}” (${fmtH(c[0].start)}–${fmtH(c[0].end)}).`, 'warn');
  }
}

export function applySug(s: any) {
  const o = s.o;
  const txt = `Remarcada de ${fmtDW(o.date)} ${fmtH(o.start)} para ${fmtDW(s.date)} ${fmtH(s.start)} (não concluída)`;
  if (o.rec) {
    const it = clone(S.items.get(o.id));
    if (!it) return;
    const nid = 'a_' + uid();
    it.overrides = it.overrides || {};
    it.overrides[o.origDate] = { ...(it.overrides[o.origDate] || {}), status: 'reagendada', movedTo: nid };
    putItem(it);
    const copy = {
      ...clone(it),
      id: nid,
      date: s.date,
      start: s.start,
      end: s.end,
      status: 'planejada',
      recur: { freq: 'none' },
      overrides: {},
      origin: { seriesId: it.id, date: o.origDate },
      history: [{ at: Date.now(), text: txt }],
      rescheduledCount: 1,
      autoResched: true,
      kept: false,
      createdAt: Date.now()
    };
    putItem(copy);
    return nid;
  } else {
    const it = clone(S.items.get(o.id));
    if (!it) return;
    Object.assign(it, { date: s.date, start: s.start, end: s.end, status: 'planejada', kept: false });
    it.rescheduledCount = (it.rescheduledCount || 0) + 1;
    it.history = [...(it.history || []), { at: Date.now(), text: txt }].slice(-30);
    putItem(it);
    return it.id;
  }
}

/* ---------- aniversariantes e dias profissionais ---------- */
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export function peopleOn(d: string) {
  const dt = parse(d);
  const dd = dt.getDate();
  const mm = dt.getMonth() + 1;
  const y = dt.getFullYear();
  const out: Record<string, any[]> = { aniversario: [], profissional: [] };
  for (const pe of S.people.values()) {
    let pd = +pe.day;
    const pm = +pe.month;
    if (pd === 29 && pm === 2 && !isLeap(y)) pd = 28;
    if (pd === dd && pm === mm && out[pe.type]) out[pe.type].push(pe);
  }
  out.aniversario.sort((a, b) => a.name.localeCompare(b.name));
  out.profissional.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function peopleChips(d: string, cls: string) {
  const on = peopleOn(d);
  return Object.keys(PTYPES)
    .filter((k) => on[k].length && !S.hidden.has(PTYPES[k].cat))
    .map(
      (k) =>
        `<button class="${cls}" data-pday="${d}" data-ptype="${k}" data-tooltip-people="${d}|${k}" style="--c:${safeColor(
          cat(PTYPES[k].cat).color
        )}">${ic(
          k === 'aniversario' ? 'cake' : 'note'
        )}<span>${PTYPES[k].label}</span><b>${on[k].length}</b></button>`
    )
    .join('');
}

export const greet = (pe: any) =>
  pe.type === 'aniversario'
    ? `Feliz aniversário, ${pe.name.split(' ')[0]}! Desejo muita saúde, paz e alegrias. Um grande abraço!`
    : `Parabéns pelo seu dia${pe.role ? ` (${pe.role})` : ''}, ${pe.name.split(' ')[0]}! Obrigado por tudo o que você faz. Um grande abraço!`;

export function waLink(pe: any) {
  return `https://wa.me/?text=${encodeURIComponent(greet(pe))}`;
}

export function parsePeople(text: string, type: string) {
  const out: any[] = [];
  const bad: string[] = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m =
      line.match(/(\d{1,2})\s*[\/.]\s*(\d{1,2})(?:[\/.]\d{2,4})?/) ||
      line.match(/\b(\d{1,2})-(\d{1,2})(?:-\d{4})?\b/);
    if (!m || m.index === undefined) {
      bad.push(line);
      continue;
    }
    const day = +m[1];
    const month = +m[2];
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      bad.push(line);
      continue;
    }
    const rest = line.slice(0, m.index) + ' ; ' + line.slice(m.index + m[0].length);
    const phoneM = rest.match(/\+?\d[\d\s().\-]{7,}\d/);
    const whatsapp = phoneM ? phoneM[0].replace(/\D/g, '') : '';
    const parts = (phoneM ? rest.replace(phoneM[0], ' ; ') : rest)
      .split(/[;,\t|]| - /)
      .map((x) => x.trim())
      .filter(Boolean);
    const name = parts[0] || '';
    const role = type === 'profissional' ? parts[1] || '' : '';
    if (!name) {
      bad.push(line);
      continue;
    }
    out.push({ name: name.slice(0, 80), day, month, whatsapp, role: role.slice(0, 60) });
  }
  return { out, bad };
}

export function addPerson(type: string, v: any) {
  if (S.readOnly) {
    toast('Esta agenda está disponível só para leitura.');
    return null;
  }
  const pe = {
    id: 'p_' + uid(),
    kind: 'person',
    type,
    name: v.name,
    day: +v.day,
    month: +v.month,
    whatsapp: v.whatsapp || '',
    role: v.role || '',
    createdAt: Date.now()
  };
  S.people.set(pe.id, pe);
  Store.write(pe.id);
  return pe;
}

export function peopleHTML() {
  const type = S.peopleTab;
  const P = PTYPES[type];
  const prof = type === 'profissional';
  const ro = S.readOnly ? 'disabled' : '';
  const list = [...S.people.values()]
    .filter((x) => x.type === type)
    .sort((a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name));
  const t = parse(todayY());
  const tm = t.getMonth() + 1;
  const td = t.getDate();
  const nextKey = (x: any) => {
    const k = x.month * 100 + x.day;
    const now = tm * 100 + td;
    return k >= now ? k : k + 1300;
  };
  const upcoming = list.slice().sort((a, b) => nextKey(a) - nextKey(b)).slice(0, 5);
  const days = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${i + 1 === td ? 'selected' : ''}>${i + 1}</option>`).join('');
  const months = MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === tm ? 'selected' : ''}>${m}</option>`).join('');
  const rows = list
    .map(
      (x) =>
        `<div class="prow2"><input class="inp" data-pe-f="name" data-id="${x.id}" value="${esc(
          x.name
        )}" aria-label="Nome" ${ro}>${
          prof
            ? `<input class="inp" data-pe-f="role" data-id="${x.id}" value="${esc(
                x.role || ''
              )}" placeholder="Profissão ou data" aria-label="Profissão" ${ro}>`
            : ''
        }<span class="pdate num">${pad(x.day)}/${pad(
          x.month
        )}</span><a class="btn btn-sm" target="_blank" rel="noopener" href="${esc(
          waLink(x)
        )}" title="Abre o WhatsApp com a mensagem pronta; escolha o contato na sua lista" aria-label="Enviar WhatsApp para ${esc(
          x.name
        )}">${ic('wa', 16)} Enviar WhatsApp</a>${
          S.readOnly ? '' : `<button class="sh" data-act="pe-del" data-id="${x.id}" aria-label="Remover ${esc(x.name)}">✕</button>`
        }</div>`
    )
    .join('');
  return `<section class="page">
    <div class="page-h"><div><h1>Aniversários e dias profissionais</h1><p>Coloque a lista com nome, dia e mês. Ela fica salva e aparece na agenda como uma linha só em cada dia; clique na linha para ver quem é.</p></div>
      <div class="seg" role="group">${Object.entries(PTYPES)
        .map(([k, v]) => `<button data-act="pe-tab" data-val="${k}" aria-pressed="${k === type}">${v.label}</button>`)
        .join('')}</div></div>
    <div class="card"><h2 style="margin-bottom:10px">Adicionar ${prof ? 'dia profissional' : 'aniversariante'}</h2>
      <form id="pe-form" class="pe-add"><input class="inp" id="pe-name" placeholder="Nome" aria-label="Nome" ${ro} required>${
    prof ? `<input class="inp" id="pe-role" placeholder="Profissão (ex.: Dia do Médico)" aria-label="Profissão" ${ro}>` : ''
  }<select class="inp" id="pe-day" aria-label="Dia" ${ro}>${days}</select><select class="inp" id="pe-month" aria-label="Mês" ${ro}>${months}</select><button class="btn btn-primary btn-sm" type="submit" ${ro}>Adicionar</button></form>
      <details style="margin-top:12px"><summary class="small" style="cursor:pointer">Colar uma lista inteira de uma vez</summary>
        <p class="note">Uma pessoa por linha: <span class="num">${
          prof ? 'Nome; dia/mês; Profissão' : 'Nome; dia/mês'
        }</span>. Exemplo: <span class="num">${prof ? 'Ana Souza; 18/10; Dia do Médico' : 'Ana Souza; 14/03'}</span></p>
        <textarea class="inp" id="pe-bulk" rows="6" style="width:100%" placeholder="Cole aqui a lista" ${ro}></textarea>
        <div class="actions" style="margin-top:8px"><button class="btn btn-sm btn-primary" data-act="pe-bulk" ${ro}>Salvar lista</button></div></details></div>
    ${
      upcoming.length
        ? `<div class="card"><h2 style="margin-bottom:10px">Próximos</h2><ul class="simple">${upcoming
            .map(
              (x) =>
                `<li><span class="dot" style="--c:${safeColor(cat(P.cat).color)}"></span>${esc(x.name)}${
                  x.role ? ` <span class="muted small">· ${esc(x.role)}</span>` : ''
                }<span class="muted num">${pad(x.day)}/${pad(x.month)}</span></li>`
            )
            .join('')}</ul></div>`
        : ''
    }
    <div class="card"><h2 style="margin-bottom:10px">${P.label} <span class="muted small num">${list.length}</span></h2>${
    rows || `<p class="muted" style="margin:0">Nenhum ${P.one} ainda.</p>`
  }</div>
  </section>`;
}

/* ---------- notificações e lembretes ---------- */
let titleFlash: any = null;
function flashTitle(msg: string) {
  const base = document.title;
  clearInterval(titleFlash);
  let on = false;
  let n = 0;
  titleFlash = setInterval(() => {
    document.title = (on = !on) ? '🔔 ' + msg : base;
    if (++n > 40 || document.hasFocus()) {
      clearInterval(titleFlash);
      document.title = base;
    }
  }, 1000);
}

export function notify(title: string, body: string, type: string) {
  S.notifs = [{ id: uid(), at: Date.now(), title, body, type, read: false }, ...S.notifs].slice(0, 50);
  Store.write('notifs');
  toast(`${title}: ${body}`);
  browserNotify(title, body);
  updateHeader();
  if (S.popOpen) renderPop();
}

export function loadFired(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LSK + ':fired') || '[]'));
  } catch {
    return new Set();
  }
}

export function saveFired(set: Set<string>) {
  const arr = [...set].slice(-300);
  try {
    localStorage.setItem(LSK + ':fired', JSON.stringify(arr));
  } catch {}
}

export function checkReminders(showModalFn?: (html: string, bind?: any, opts?: any) => HTMLElement) {
  if (!S.loaded) return;
  const t = todayY();
  const now = Date.now();
  const fired = loadFired();
  let changed = false;
  for (const o of withSubs(expand(t, addY(t, 1)), t, addY(t, 1))) {
    const r = +o.item.reminder || 0;
    if (!r || effStatus(o) !== 'planejada') continue;
    const startTs = parse(o.date).getTime() + toMin(o.start) * 60000;
    const fire = startTs - r * 60000;
    if (now < fire || now > startTs) continue;
    const k = `rem:${o.key}:${o.date}:${o.start}`;
    if (fired.has(k)) continue;
    fired.add(k);
    changed = true;
    const body = `${o.isSub ? `Subtarefa ${o.subNo}/${o.n}: ${o.sub.text} (${o.item.title})` : o.item.title}, ${
      o.date === t ? 'hoje' : 'amanhã'
    } das ${fmtH(o.start)} às ${fmtH(o.end)}`;
    notify('Lembrete', body, 'reminder');
    chime();
    try {
      navigator.vibrate && navigator.vibrate([200, 100, 200]);
    } catch {}
    flashTitle(body.slice(0, 40));
    if (showModalFn && !$('.overlay.remind')) {
      const w = showModalFn(
        `<div class="m-h"><svg class="i" viewBox="0 0 24 24" style="width:22px;height:22px"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg><h2>Lembrete</h2></div><div class="m-b"><p style="margin:0;font-size:17px">${esc(
          body
        )}</p></div><div class="m-f"><span class="sp"></span><button class="btn btn-primary" data-close>Ok</button></div>`,
        null,
        { cls: 'sm' }
      );
      w.classList.add('remind');
    }
  }
  if (changed) saveFired(fired);
}

/* ---------- cabeçalho, banner, navegação ---------- */
export function updateHeader() {
  const tabsEl = $('#tabs');
  const bnavEl = $('#bnav');
  if (!tabsEl || !bnavEl) return;
  const pc = S.loaded ? pendingOccs().length : 0;
  const html = TABS.map(
    ([id, label, icn]) =>
      `<button class="tab" data-tab="${id}" ${S.tab === id ? 'aria-current="page"' : ''}>${ic(icn)}<span>${label}</span>${
        id === 'pendencias' && pc
          ? `<span class="reddot" title="${pc} ${plural(pc, 'pendência', 'pendências')}" aria-label="${pc} ${plural(
              pc,
              'pendência',
              'pendências'
            )}"></span>`
          : ''
      }</button>`
  ).join('');
  tabsEl.innerHTML = html;
  bnavEl.innerHTML = html;
  const unread = S.notifs.filter((n: any) => !n.read).length;
  const bc = $('#bellcount');
  if (bc) bc.textContent = unread ? String(unread) : '';
  const utilityCount = $('#utility-count');
  if (utilityCount) utilityCount.textContent = unread ? String(unread) : '';
  renderNotifSubmenu();
}

export function renderNotifSubmenu() {
  const box = $('#notif-sub-list');
  if (!box) return;
  const unreadList = S.notifs.filter((n: any) => !n.read);
  const pc = pendingOccs();
  const subCount = $('#notif-sub-count');
  if (subCount) {
    const totalPending = unreadList.length + pc.length;
    subCount.textContent = totalPending ? String(totalPending) : '0';
  }
  const readAllBtn = $('#notif-sub-readall') as HTMLButtonElement | null;
  if (readAllBtn) {
    readAllBtn.style.display = unreadList.length ? 'inline-block' : 'none';
  }

  let html = '';

  // Pendências de remarcação da agenda
  if (pc.length) {
    html += `<div class="notif-sub-item pend-item" data-tab="pendencias" style="cursor:pointer;background:rgba(236,72,153,0.08);border-left:3px solid #EC4899;padding:9px 12px;margin-bottom:6px;border-radius:6px;transition:background 0.15s;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <span style="font-weight:700;font-size:12.5px;color:#EC4899">⚠️ ${pc.length} ${plural(pc.length, 'pendência para remarcar', 'pendências para remarcar')}</span>
        <span style="font-size:11px;font-weight:600;color:#EC4899;text-decoration:underline">Ver</span>
      </div>
      <p style="margin:2px 0 0;font-size:11.5px;color:var(--muted)">Atividades que não foram concluídas e precisam de novo horário.</p>
    </div>`;
  }

  // Notificações pendentes / não lidas
  if (unreadList.length) {
    html += unreadList
      .slice(0, 6)
      .map((n: any) => {
        const d = new Date(n.at);
        const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        return `<div class="notif-sub-item unread" data-notif-id="${n.id}" style="padding:9px 11px;border-bottom:1px solid var(--line);border-radius:6px;margin-bottom:4px;background:rgba(79,70,229,0.06);position:relative;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
            <b style="font-size:12.5px;color:var(--ink);">${esc(n.title)}</b>
            <span class="muted small" style="font-size:10.5px">${dateStr} ${timeStr}</span>
          </div>
          <div style="font-size:12px;color:var(--ink);margin-top:2px;line-height:1.35;opacity:0.9">${esc(n.body)}</div>
        </div>`;
      })
      .join('');
    if (unreadList.length > 6) {
      html += `<div style="text-align:center;padding:6px;font-size:11.5px;color:var(--muted)">+ ${unreadList.length - 6} outras notificações pendentes</div>`;
    }
  }

  if (!unreadList.length && !pc.length) {
    html = `<div style="text-align:center;padding:24px 12px;color:var(--muted)">
      <svg class="i" viewBox="0 0 24 24" style="width:26px;height:26px;margin:0 auto 6px;opacity:0.4;display:block">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </svg>
      <p style="margin:0;font-size:12.5px;font-weight:600">Nenhuma notificação pendente</p>
      <p style="margin:2px 0 0;font-size:11.5px">Lembretes e avisos aparecerão aqui.</p>
    </div>`;
  }

  box.innerHTML = html;
}

export function renderBanner() {
  const b = $('#banner');
  if (!b) return;
  let msg = '';
  let warn = false;
  if (S.readOnly) {
    msg = 'Você pode ver esta agenda, mas não alterá-la.';
    warn = true;
  } else if (S.loadErr) {
    msg = 'Não foi possível carregar seus dados. Recarregue a página para tentar de novo.';
    warn = true;
  }
  b.textContent = msg;
  b.className = 'banner' + (msg ? ' show' : '') + (warn ? ' warn' : '');
}

let renderQueued = false;
export function scheduleRender() {
  if (S.dragging) {
    S.pendingRender = true;
    return;
  }
  const a = document.activeElement;
  const m = $('#main');
  if (a && m && m.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) {
    S.pendingRender = true;
    updateHeader();
    return;
  }
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

export function render() {
  const m = $('#main');
  if (!m) {
    requestAnimationFrame(() => {
      if ($('#main')) render();
    });
    return;
  }
  S.pendingRender = false;
  activityTooltips.forEach((tip) => tip.destroy());
  activityTooltips = [];
  tooltipOccurrences.clear();
  updateHeader();
  renderBanner();
  document.body.classList.toggle('pasting', !!(S.pasteMode && S.clip));
  document.body.classList.toggle('touch-locked', !!S.touchLocked);
  const sc = m.querySelector('.g-scroll');
  if (sc) S.scroll = sc.scrollTop;
  m.innerHTML =
    S.tab === 'agenda'
      ? agendaHTML()
      : S.tab === 'pendencias'
      ? pendHTML()
      : S.tab === 'resumo'
      ? resumoHTML()
      : S.tab === 'datas'
      ? peopleHTML()
      : S.tab === 'assistente'
      ? chatHTML()
      : settingsHTML();
  const sc2 = m.querySelector('.g-scroll');
  if (sc2) sc2.scrollTop = S.scroll ?? (7 - HOUR_START) * PPH;
  attachActivityTooltips(m);
  if (S.tab === 'assistente') renderChat();
  if (S.popOpen) renderPop();
}

export function setTab(t: string) {
  if (!TABS.some((x) => x[0] === t)) t = 'agenda';
  S.tab = t;
  try {
    if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t);
  } catch {}
  render();
  const m = $('#main');
  if (m) m.scrollTop = 0;
}

/* ---------- agenda ---------- */
export function agendaHTML() {
  const isCustom = S.view === 'custom' && Array.isArray(S.customDays) && S.customDays.length > 0;
  const body =
    S.view === 'month'
      ? monthHTML()
      : S.view === 'year'
      ? yearHTML()
      : S.view === 'list'
      ? listHTML()
      : gridHTML(
          isCustom
            ? S.customDays
            : S.view === 'day'
            ? [S.cursor]
            : Array.from({ length: 7 }, (_, i) => addY(weekStart(S.cursor), i))
        );
  return `<div class="agenda${S.sideHidden ? ' side-hidden' : ''}"><aside class="side">${sideHTML()}</aside><section class="cal">${toolbarHTML()}${welcomeHTML()}${body}</section></div>`;
}

export function rangeLabel() {
  if (S.view === 'custom' && Array.isArray(S.customDays) && S.customDays.length > 0) {
    const sorted = [...S.customDays].sort();
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return `PLANNER - ${sorted.length} DIAS SELECIONADOS - ${fmtD(first)} A ${fmtD(last)}`;
  }
  const c = parse(S.cursor);
  const Y = c.getFullYear();
  if (S.view === 'day')
    return `PLANNER - WEEK ${weekNo(S.cursor)} - ${WD_EN[c.getDay()]} - ${fmtFull(S.cursor)} - ${MONTHS_EN[c.getMonth()]}`;
  if (S.view === 'month') {
    const a = ymd(new Date(Y, c.getMonth(), 1));
    const b = ymd(new Date(Y, c.getMonth() + 1, 0));
    return `PLANNER - WEEKS ${weekNo(a)}–${weekNo(b)} - ${fmtFull(a)} – ${fmtFull(b)} – ${MONTHS_EN[c.getMonth()]}`;
  }
  if (S.view === 'year') {
    const last = `${Y}-12-31`;
    const wl = weekNo(last) === 1 ? weekNo(addY(last, -7)) + 1 : weekNo(last);
    return `PLANNER - ${Y} - ${fmtFull(`${Y}-01-01`)} – ${fmtFull(last)} - WEEKS 1–${wl}`;
  }
  if (S.view === 'list') return S.q ? `PLANNER - SEARCH: “${esc(S.q)}”` : 'PLANNER - LIST';
  const a = weekStart(S.cursor);
  const b = addY(a, 6);
  const ma = parse(a).getMonth();
  const mb = parse(b).getMonth();
  return `PLANNER - WEEK ${weekNo(a)} - ${fmtFull(a)} – ${fmtFull(b)} – ${
    ma === mb ? MONTHS_EN[ma] : MONTHS_EN[ma] + ' / ' + MONTHS_EN[mb]
  }`;
}

export function toolbarHTML() {
  const v = (id: string, l: string) => `<button data-view="${id}" aria-pressed="${S.view === id}">${l}</button>`;
  const nav =
    S.view === 'list'
      ? ''
      : `<button class="btn btn-sm" data-act="today">Hoje</button><button class="iconbtn" data-act="prev" aria-label="Anterior">${ic(
          'left'
        )}</button><button class="iconbtn" data-act="next" aria-label="Próximo">${ic('right')}</button>`;
  const grid = S.view === 'day' || S.view === 'week' || S.view === 'custom';
  const hint =
    S.clip && grid
      ? `<span class="clipchip" role="status">Copiado: <b>${esc(S.clip.title)}</b><span class="muted num">${
          S.clip.days > 1 ? S.clip.days + ' dias · ' : ''
        }${fmtDur(S.clip.dur)}</span><button class="btn btn-sm ${
          S.pasteMode ? 'btn-primary' : ''
        }" data-act="pastemode">${
          S.pasteMode ? 'Clique numa linha para colar · Esc encerra' : 'Colar'
        }</button><button class="x" data-act="clipclear" aria-label="Esquecer a cópia">✕</button></span>`
      : '';
  const lockBtn = `<button type="button" class="btn btn-sm touch-lock-btn ${
    S.touchLocked ? 'is-locked' : 'is-unlocked'
  }" data-act="toggle-touch-lock" aria-pressed="${!!S.touchLocked}" title="${
    S.touchLocked
      ? 'Tela bloqueada para rolar com os dedos sem mover ou editar atividades. Toque para desbloquear e digitar/editar.'
      : 'Tela desbloqueada para digitar, mover e editar atividades. Toque para bloquear a rolagem.'
  }">${ic(S.touchLocked ? 'lock' : 'unlock', 15)}<span class="lock-lbl">${
    S.touchLocked ? 'Tela bloqueada' : 'Desbloqueada'
  }</span></button>`;
  return `<div class="toolbar"><button class="side-tg" data-act="side" aria-pressed="${!S.sideHidden}" aria-label="${
    S.sideHidden ? 'Mostrar calendário' : 'Ocultar calendário'
  }" title="${
    S.sideHidden ? 'Mostrar calendário' : 'Ocultar calendário'
  }"><svg class="i" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M9 4v16"/></svg></button>${nav}${lockBtn}<h2>${rangeLabel()}</h2><div class="tb-r">${hint}<div class="seg" role="group" aria-label="Visualização">${
    S.view === 'custom'
      ? `<button class="active" data-view="week" title="Voltar para a semana">${S.customDays?.length || 0} dias ✕</button>`
      : ''
  }${v(
    'day',
    'Dia'
  )}${v('week', 'Semana')}${v('month', 'Mês')}${v('year', 'Ano')}${v('list', 'Lista')}</div></div></div>`;
}

export function welcomeHTML() {
  if (!S.loaded || S.items.size) return '';
  return `<div class="welcome"><p><b>Sua agenda está vazia.</b> Dê dois cliques em qualquer linha do horário e escreva para criar uma atividade, ou carregue a semana de exemplo do plano para ver tudo funcionando.</p><button class="btn btn-primary btn-sm" data-act="seed" ${
    S.readOnly ? 'disabled' : ''
  }>Carregar semana de exemplo</button></div>`;
}

export function sideHTML() {
  const c = parse(S.cursor);
  const first = ymd(new Date(c.getFullYear(), c.getMonth(), 1));
  const start = weekStart(first);
  const days = Array.from({ length: 42 }, (_, i) => addY(start, i));
  const t = todayY();
  const has = new Set(
    visible(expand(days[0], days[41]))
      .filter((o) => o.status !== 'reagendada')
      .map((o) => o.date)
  );
  const customSet = new Set(S.view === 'custom' && Array.isArray(S.customDays) ? S.customDays : []);
  const mini = days
    .map(
      (d) =>
        `<button data-goto="${d}" class="${parse(d).getMonth() !== c.getMonth() ? 'out ' : ''}${d === t ? 'today ' : ''}${
          (customSet.size > 0 ? customSet.has(d) : d === S.cursor) ? 'sel ' : ''
        }${has.has(d) ? 'has' : ''}" aria-label="${fmtDL(d)}">${parse(d).getDate()}</button>`
    )
    .join('');
  const cats = ST()
    .categories.map(
      (k: any) =>
        `<label><input type="checkbox" data-cat="${esc(k.id)}" ${
          S.hidden.has(k.id) ? '' : 'checked'
        }><span class="dot" style="--c:${safeColor(k.color)}"></span>${esc(k.name)}</label>`
    )
    .join('');
  const today = withSubs(expand(t, t), t, t).filter((o) => o.status !== 'reagendada');
  const tl = today.length
    ? today
        .slice(0, 6)
        .map(
          (o) =>
            `<button class="trow" data-open="${esc(o.key)}" ${tooltipAttr(o)}><span class="dot" style="--c:${safeColor(
              cat(o.item.category).color
            )}"></span><span><b>${esc(occTitle(o))}</b><small class="num">${fmtH(o.start)}–${fmtH(o.end)}</small></span></button>`
        )
        .join('')
    : '<p class="muted small" style="margin:0">Nada marcado para hoje.</p>';
  const pc = S.loaded ? pendingOccs().length : 0;
  const store =
    S.storage === 'postgresql'
      ? 'Salvo no banco de dados'
      : S.storage === 'cloud'
      ? 'Sincronizado na sua conta'
      : S.storage === 'local'
      ? 'Salvo neste dispositivo (PWA)'
      : 'Carregando…';
  return `<div><div class="mini-h"><button data-act="mprev" aria-label="Mês anterior">${ic('left', 16)}</button><span>${
    MONTHS[c.getMonth()]
  } ${c.getFullYear()}</span><button class="mini-multi-btn ${S.multiSelectMode ? 'active' : ''}" data-act="toggle-multi" title="Multiseleção de dias (ou segure Ctrl/Cmd ao clicar)">${
    S.multiSelectMode ? '✓ Multi' : 'Multi'
  }</button><button data-act="mnext" aria-label="Próximo mês">${ic('right', 16)}</button></div>
    <div class="mini">${WD.map((w) => `<span>${w[0]}</span>`).join('')}${mini}</div></div>
    <div><h3>Hoje</h3><div class="todaylist">${peopleChips(t, 'ad-chip')}${tl}</div></div>
    <div class="pendcard"><b class="num">${pc}</b> <span class="muted">${plural(
    pc,
    'pendência',
    'pendências'
  )} para remarcar</span><div style="margin-top:8px"><button class="btn btn-sm" data-tab="pendencias">Revisar pendências</button></div></div>
    <div><h3>Categorias</h3><div class="cats">${cats}</div><button class="btn btn-sm" data-tab="ajustes" style="margin-top:8px">Adicionar categoria</button></div>
    <div class="store-chip">${ic('agenda', 14)} ${store}</div>`;
}

function layoutDay(list: any[]) {
  const res: any[] = [];
  let cluster: any[] = [];
  let end = -1;
  const flush = () => {
    const lanes: number[] = [];
    for (const o of cluster) {
      let i = lanes.findIndex((e) => e <= toMin(o.start));
      if (i < 0) {
        i = lanes.length;
        lanes.push(0);
      }
      lanes[i] = toMin(o.end);
      o._lane = i;
    }
    cluster.forEach((o) => (o._lanes = lanes.length));
    res.push(...cluster);
    cluster = [];
  };
  for (const o of list) {
    if (cluster.length && toMin(o.start) >= end) {
      flush();
      end = -1;
    }
    cluster.push(o);
    end = Math.max(end, toMin(o.end));
  }
  flush();
  return res;
}

export function markIcons(it: any) {
  const notes = !!noteToPlain(it.notes);
  const subs = it.subtasks || [];
  const done = subs.filter((x: any) => x.done).length;
  const nf = (it.files || []).length;
  const nl = (it.links || []).length;
  const na = nf + nl;
  const attLabel = [nf ? `${nf} ${plural(nf, 'arquivo', 'arquivos')}` : '', nl ? `${nl} ${plural(nl, 'link', 'links')}` : '']
    .filter(Boolean)
    .join(' e ');
  return (
    (na
      ? `<span class="ev-ic" title="Anexos: ${attLabel}" aria-label="Anexos: ${attLabel}">${ic('clip')}${na > 1 ? na : ''}</span>`
      : '') +
    (notes ? `<span class="ev-ic" title="Tem anotações" aria-label="Tem anotações">${ic('note')}</span>` : '') +
    (subs.length
      ? `<span class="ev-ic" title="Subtarefas: ${done} de ${subs.length} feitas" aria-label="Subtarefas: ${done} de ${
          subs.length
        } feitas">${ic('check')}${done}/${subs.length}</span>`
      : '')
  );
}

function evHTML(o: any, conflict?: boolean, run?: any) {
  if (o.isSub) {
    const s0 = Math.max(toMin(o.start), HOUR_START * 60);
    const top = ((s0 - HOUR_START * 60) / 60) * PPH;
    const h = Math.max(QH - 2, ((toMin(o.end) - s0) / 60) * PPH - 2);
    const w = 100 / o._lanes;
    const left = o._lane * w;
    const es = effStatus(o);
    const c = safeColor(cat(o.item.category).color);
    const short = toMin(o.end) - toMin(o.start) <= 30;
    return `<div class="ev subev st-${es}${short ? ' short' : ''}" ${tooltipAttr(o)} data-key="${esc(
      o.key
    )}" tabindex="0" role="button" aria-label="Subtarefa ${o.subNo} de ${o.n}: ${esc(o.sub.text)}, de ${esc(
      o.item.title
    )}, ${fmtH(o.start)} a ${fmtH(o.end)}" style="--c:${c};top:${top}px;height:${h}px;left:calc(${left}% + 2px);width:calc(${w}% - 4px)">
      <div class="ev-top"><div class="ev-t">${
        conflict ? '<span class="warnmark" title="Conflito de horário">!</span>' : ''
      }<span class="subn">${o.subNo}/${o.n}</span>${esc(o.sub.text)}</div></div>
      <div class="ev-m">${esc(o.item.title)}</div><span class="rz" aria-hidden="true"></span></div>`;
  }
  const s = Math.max(toMin(o.start), HOUR_START * 60);
  const top = ((s - HOUR_START * 60) / 60) * PPH;
  const h = Math.max(QH - 2, ((toMin(o.end) - s) / 60) * PPH - 2);
  const short = toMin(o.end) - toMin(o.start) <= 30;
  const w = run ? (run.k / run.n) * 100 : 100 / o._lanes;
  const left = run ? (run.i / run.n) * 100 : o._lane * w;
  const es = run ? run.es : effStatus(o);
  const c = safeColor(cat(o.item.category).color);
  const days = run ? `${fmtDW(run.first)} a ${fmtDW(run.last)} · ` : '';
  const plainNote = noteToPlain(o.item.notes);
  const hasNotes = !!plainNote;
  const noteSnippet = hasNotes ? plainNote.split(/\r?\n/)[0].slice(0, 60) : '';
  const quickNoteBtn = `<button type="button" class="ev-qnote-btn${hasNotes ? ' has-note' : ''}" data-qnote="${esc(
    o.key
  )}" title="${hasNotes ? 'Editar anotação rápida' : 'Adicionar anotação rápida'}" aria-label="Anotação rápida">${ic(
    'note',
    12
  )}</button>`;
  const notePreviewHtml =
    hasNotes && !short && h >= 44
      ? `<div class="ev-note-preview" data-qnote="${esc(o.key)}">${esc(noteSnippet)}</div>`
      : '';
  return `<div class="ev st-${es}${short ? ' short' : ''}" ${tooltipAttr(run ? { ...o, displayRange: [run.first, run.last] } : o)} data-key="${esc(o.key)}"${
    run ? ` data-span="1" data-first="${run.first}" data-last="${run.last}"` : ''
  } tabindex="0" role="button" aria-label="${esc(o.item.title)}, ${days}${fmtH(o.start)} a ${fmtH(o.end)}, ${
    STATUS[es]
  }" style="--c:${c};top:${top}px;height:${h}px;left:calc(${left}% + 2px);width:calc(${w}% - 4px)">
    <div class="ev-top"><div class="ev-t">${
      conflict ? '<span class="warnmark" title="Conflito de horário">!</span>' : ''
    }${esc(o.item.title)}</div>${quickNoteBtn}</div>${notePreviewHtml}
    <span class="rz" aria-hidden="true"></span><span class="rzx" aria-hidden="true" title="Arraste para os lados para ocupar outros dias"></span></div>`;
}

const mergeable = (o: any) =>
  o.rec &&
  o.item.recur.freq === 'daily' &&
  (o.item.span || o.item.recur.until) &&
  o._lanes === 1 &&
  o.date === o.origDate &&
  o.start === o.item.start &&
  o.end === o.item.end;

export function gridHTML(days: string[]) {
  const t = todayY();
  const nm = nowMin();
  const H = (HOUR_END - HOUR_START) * PPH;
  const st = ST();
  const n = days.length;
  S._gridDays = days;
  const ws = toMin(st.workStart);
  const we = toMin(st.workEnd);
  const head = `<div class="g-head"><div class="g-gut">SCHEDULES</div>${days
    .map(
      (d) =>
        `<button class="g-day ${d === t ? 'is-today' : ''}${
          d === S.cursor ? ' is-selected' : ''
        }" data-goto="${d}" aria-label="${fmtDL(d)}"><span>${
          WD_EN[dow(d)]
        } - ${fmtD(d)}</span></button>`
    )
    .join('')}</div>`;
  let hours = '';
  for (let h = HOUR_START + 1; h < HOUR_END; h++) {
    hours += `<span style="top:${(h - HOUR_START) * PPH}px">${pad(h)}:00</span>`;
  }
  const dayData = days.map((d) => {
    const list = visible(withSubs(expand(d, d), d, d)).filter((o) => o.status !== 'reagendada');
    return { list, active: list.filter((o) => o.status !== 'cancelada'), laid: layoutDay(list.slice()) };
  });
  const runs: any[] = [];
  const open: Record<string, any> = {};
  dayData.forEach((dd, i) => {
    for (const o of dd.laid) {
      if (!mergeable(o)) continue;
      const k = o.id + '|' + o.status;
      const r = open[k];
      if (r && r.end === i - 1) {
        r.end = i;
        r.occs.push(o);
      } else {
        open[k] = { start: i, end: i, occs: [o] };
        runs.push(open[k]);
      }
    }
  });
  const merged = new Set<string>();
  const big = runs.filter((r) => r.occs.length > 1);
  big.forEach((r) => r.occs.forEach((o: any) => merged.add(o.key)));
  const cols = days
    .map((d, i) => {
      const { active, laid } = dayData[i];
      const work = st.workDays.includes(dow(d));
      const off = work
        ? `<div class="offh" style="top:0;height:${Math.max(0, ((ws - HOUR_START * 60) / 60) * PPH)}px"></div><div class="offh" style="top:${
            ((we - HOUR_START * 60) / 60) * PPH
          }px;bottom:0"></div>`
        : '';
      const now =
        d === t && nm >= HOUR_START * 60
          ? `<div class="nowline" style="top:${((nm - HOUR_START * 60) / 60) * PPH}px"></div>`
          : '';
      const trips = travelSegs(d)
        .filter((x) => x.e > HOUR_START * 60)
        .map((x) => {
          const s1 = Math.max(x.s, HOUR_START * 60);
          const lab =
            d === x.tr.date || d === days[0]
              ? `<button class="trip-l" data-travel="${esc(x.tr.id)}" data-tooltip-travel="${esc(x.tr.id)}">Viagem${
                  x.tr.title ? ': ' + esc(x.tr.title) : ''
                } · volta ${fmtDW(x.tr.endDate)} ${fmtH(x.tr.end)}</button>`
              : '';
          return `<div class="trip" style="top:${((s1 - HOUR_START * 60) / 60) * PPH}px;height:${
            ((x.e - s1) / 60) * PPH
          }px">${lab}</div>`;
        })
        .join('');
      return `<div class="g-col ${work ? '' : 'off'}${
        d === S.cursor ? ' is-selected' : ''
      }" data-date="${d}" style="height:${H}px">${off}${trips}${laid
        .filter((o: any) => !merged.has(o.key))
        .map((o: any) =>
          evHTML(
            o,
            o.status !== 'cancelada' &&
              overlaps(
                o,
                active.filter((x: any) => x.id !== o.id)
              ).length > 0
          )
        )
        .join('')}${now}</div>`;
    })
    .join('');
  const spans = big
    .map((r) => {
      const ess = r.occs.map(effStatus);
      const same = ess.every((x: string) => x === ess[0]);
      return evHTML(r.occs[0], false, {
        i: r.start,
        k: r.occs.length,
        n,
        first: r.occs[0].date,
        last: r.occs[r.occs.length - 1].date,
        es: same ? ess[0] : 'planejada'
      });
    })
    .join('');
  const pcells = days.map((d) => peopleChips(d, 'ad-chip'));
  const allday = pcells.some(Boolean)
    ? `<div class="g-allday"><div class="g-gut">DATAS</div>${pcells.map((c) => `<div class="ad-cell">${c}</div>`).join('')}</div>`
    : '';
  return `<div class="g-scroll"><div class="g-inner ${n === 7 ? 'n7' : ''}" style="--n:${n};--pph:${PPH}px"><div class="g-top">${head}${allday}</div><div class="g-body"><div class="g-hours" style="height:${H}px">${hours}</div>${cols}<div class="g-span" style="height:${H}px">${spans}</div></div></div></div>`;
}

export function yearHTML() {
  const Y = parse(S.cursor).getFullYear();
  const t = todayY();
  const counts: Record<string, number> = {};
  for (const o of visible(expand(`${Y}-01-01`, `${Y}-12-31`))) {
    if (o.status !== 'reagendada' && o.status !== 'cancelada') counts[o.date] = (counts[o.date] || 0) + 1;
  }
  const months = MONTHS_EN.map((name, m) => {
    const first = ymd(new Date(Y, m, 1));
    const start = weekStart(first);
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = addY(start, i);
      const dd = parse(d);
      if (dd.getMonth() !== m) {
        cells += '<i></i>';
        continue;
      }
      const n = counts[d] || 0;
      const lv = n >= 4 ? 'l3' : n >= 2 ? 'l2' : n ? 'l1' : '';
      cells += `<button data-goto="${d}" class="${lv} ${d === t ? 'today' : ''} ${
        travelSegs(d).length ? 'trip-day' : ''
      }" aria-label="${fmtDL(d)}: ${n} ${plural(n, 'atividade', 'atividades')}" title="${
        n ? n + ' ' + plural(n, 'atividade', 'atividades') : ''
      }">${dd.getDate()}</button>`;
    }
    return `<div><button class="y-h" data-gomonth="${first}">${name}</button><div class="y-grid">${['S', 'M', 'T', 'W', 'T', 'F', 'S']
      .map((w) => `<span>${w}</span>`)
      .join('')}${cells}</div></div>`;
  }).join('');
  return `<div class="year-wrap"><div class="year">${months}</div><div class="y-legend"><span><i style="background:color-mix(in srgb,var(--accent) 18%,transparent)"></i>1 atividade</span><span><i style="background:color-mix(in srgb,var(--accent) 36%,transparent)"></i>2 a 3</span><span><i style="background:color-mix(in srgb,var(--accent) 60%,transparent)"></i>4 ou mais</span><span>Clique num dia para abrir, ou no nome do mês.</span></div></div>`;
}

export function monthHTML() {
  const c = parse(S.cursor);
  const first = ymd(new Date(c.getFullYear(), c.getMonth(), 1));
  const start = weekStart(first);
  const t = todayY();
  const days = Array.from({ length: 42 }, (_, i) => addY(start, i));
  const by: Record<string, any[]> = {};
  for (const o of visible(withSubs(expand(days[0], days[41]), days[0], days[41])).filter((o) => o.status !== 'reagendada')) {
    (by[o.date] = by[o.date] || []).push(o);
  }
  const cells = days
    .map((d) => {
      const l = by[d] || [];
      const chips = l
        .slice(0, 3)
        .map(
          (o) =>
            `<div class="chip st-${effStatus(o)}" ${tooltipAttr(o)} data-key="${esc(
              o.key
            )}" tabindex="0" role="button" style="--c:${safeColor(cat(o.item.category).color)}"><i></i><span class="chip-t">${esc(
              occTitle(o)
            )}</span>${o.isSub ? '' : markIcons(o.item)}<button type="button" class="chip-qnote-btn${
              noteToPlain(o.item.notes) ? ' has-note' : ''
            }" data-qnote="${esc(o.key)}" title="Anotação rápida" aria-label="Anotação rápida">${ic('note', 11)}</button></div>`
        )
        .join('');
      const tsegs = travelSegs(d);
      const tr0 = tsegs[0] && tsegs[0].tr;
      const tlab =
        tr0 && (d === tr0.date || dow(d) === 0)
          ? `<button class="m-trip" data-travel="${esc(tr0.id)}" data-tooltip-travel="${esc(tr0.id)}">Viagem${
              tr0.title ? ': ' + esc(tr0.title) : ''
            }</button>`
          : '';
      return `<div class="m-cell ${parse(d).getMonth() !== c.getMonth() ? 'out' : ''} ${d === t ? 'today' : ''} ${
        tr0 ? 'trip-day' : ''
      }" data-date="${d}"><button class="m-num" data-goto="${d}">${parse(d).getDate()}</button>${tlab}${peopleChips(
        d,
        'm-pchip'
      )}${chips}${l.length > 3 ? `<button class="m-more" data-goto="${d}">+${l.length - 3} mais</button>` : ''}</div>`;
    })
    .join('');
  return `<div class="month"><div class="m-head">${WD_EN.map(
    (w) => `<span><b class="full">${w}</b><b class="short">${w.slice(0, 3)}</b></span>`
  ).join('')}</div><div class="m-grid">${cells}</div></div>`;
}

export function matchQ(o: any, q: string) {
  if (!q) return true;
  q = q.toLowerCase();
  const it = o.item;
  return [
    it.title,
    it.notes,
    cat(it.category).name,
    ...(it.links || []).map((l: any) => l.label + ' ' + l.url),
    ...(it.files || []).map((f: any) => f.name),
    ...(it.subtasks || []).map((x: any) => x.text)
  ].some((x) => String(x || '').toLowerCase().includes(q));
}

export function listHTML() {
  const t = todayY();
  const range = S.q ? 'all' : S.listRange;
  const [a, b] = range === 'next' ? [t, addY(t, 30)] : range === 'past' ? [addY(t, -30), t] : [addY(t, -365), addY(t, 365)];
  let l = visible(withSubs(expand(a, b), a, b)).filter(
    (o) =>
      o.status !== 'reagendada' &&
      (matchQ(o, S.q) || (o.isSub && String(o.sub.text).toLowerCase().includes(S.q.toLowerCase())))
  );
  if (S.listStatus !== 'all') l = l.filter((o) => effStatus(o) === S.listStatus);
  if (range === 'past') l.reverse();
  const groups: Record<string, any[]> = {};
  for (const o of l) (groups[o.date] = groups[o.date] || []).push(o);
  const opt = (v: string, cur: string, label: string) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label}</option>`;
  const filt = `<div class="filters">${
    S.q
      ? `<span class="pill">Pesquisa: ${esc(S.q)}</span><button class="btn btn-sm" data-act="clearq">Limpar pesquisa</button>`
      : `<select class="inp" id="lrange" aria-label="Período">${opt('next', S.listRange, 'Próximos 30 dias')}${opt(
          'past',
          S.listRange,
          'Últimos 30 dias'
        )}${opt('all', S.listRange, 'Um ano para trás e para frente')}</select>`
  }
    <select class="inp" id="lstatus" aria-label="Status">${opt('all', S.listStatus, 'Todos os status')}${[
    'planejada',
    'concluida',
    'pendente',
    'cancelada'
  ]
    .map((s) => opt(s, S.listStatus, STATUS[s]))
    .join('')}</select><span class="muted small num">${l.length} ${plural(l.length, 'atividade', 'atividades')}</span></div>`;
  const body = Object.keys(groups).length
    ? Object.entries(groups)
        .map(
          ([d, os]) =>
            `<div class="lgroup"><h3>${fmtDL(d)}${d === t ? ' · hoje' : ''}</h3>${os
              .map((o) => {
                const es = effStatus(o);
                return `<button class="lrow" data-open="${esc(o.key)}" ${tooltipAttr(o)}><span class="dot" style="--c:${safeColor(
                  cat(o.item.category).color
                )}"></span><span class="num muted small">${fmtH(o.start)}–${fmtH(o.end)}</span><b>${esc(occTitle(o))} ${
                  o.isSub ? '' : markIcons(o.item)
                }</b><span class="pill p-${es}">${STATUS[es]}</span></button>`;
              })
              .join('')}</div>`
        )
        .join('')
    : `<p class="muted">Nenhuma atividade encontrada${S.q ? ' para essa pesquisa' : ' nesse período'}.</p>`;
  return `<div style="overflow:auto;flex:1"><div class="listwrap">${filt}${body}</div></div>`;
}

/* ---------- página de pendências ---------- */
export function pendHTML() {
  const sug = S.loaded ? suggestAll() : [];
  const rows = sug
    .map((s: any) => {
      const o = s.o;
      const k = o.key;
      const pr = o.item.priority || 'media';
      return `<div class="prow ${s.conflict ? 'is-conflict' : ''}">
      <div class="prow-main"><span class="dot" style="--c:${safeColor(cat(o.item.category).color)}"></span><div><b>${esc(
        o.item.title
      )}</b><span class="num">Era ${fmtDW(o.date)}, ${fmtH(o.start)}–${fmtH(o.end)} · prioridade ${PRIO[
        pr
      ].label.toLowerCase()}${o.item.fixed && o.item.deadline ? ` · prazo fixo ${fmtD(o.item.deadline)}` : ''}${
        o.rec ? ' · repete' : ''
      }</span></div></div>
      <div class="prow-sug">${
        s.conflict
          ? `<span class="err">${esc(s.conflict)}</span>`
          : `<span class="muted">Sugestão: ${fmtDW(s.date)}, ${fmtH(s.start)}–${fmtH(s.end)}</span>`
      }</div>
      <div class="prow-act"><button class="btn btn-primary btn-sm" data-act="pend-ok" data-key="${esc(k)}" ${
        S.readOnly ? 'disabled' : ''
      }>Remarcar</button><button class="btn btn-sm" data-act="pend-done" data-key="${esc(k)}" ${
        S.readOnly ? 'disabled' : ''
      }>Já concluí</button><button class="btn btn-sm" data-act="pend-keep" data-key="${esc(k)}" ${
        S.readOnly ? 'disabled' : ''
      }>Deixar como está</button></div></div>`;
    })
    .join('');
  const since = Date.now() - 14 * 864e5;
  const recent: Array<{ it: any; h: any }> = [];
  for (const it of S.items.values()) {
    for (const h of it.history || []) {
      if (h.at >= since && /^Remarcada/.test(h.text)) recent.push({ it, h });
    }
  }
  recent.sort((a, b) => b.h.at - a.h.at);
  const okCount = sug.filter((s: any) => !s.conflict).length;
  return `<section class="page">
    <div class="page-h"><div><h1>Pendências</h1><p>O que ficou sem concluir em dias anteriores. A agenda sugere um horário livre na próxima semana, respeitando a prioridade e o prazo fixo, e só remarca quando você autorizar.</p></div></div>
    <div class="flow"><div><b><em>1</em>Não concluída</b><small>A atividade passou do horário sem ser marcada como concluída.</small></div><div><b><em>2</em>Verifica</b><small>Olha a prioridade, o prazo fixo e os horários livres no seu horário útil.</small></div><div><b><em>3</em>Reagenda</b><small>Só com a sua autorização: você clica em Remarcar e o histórico fica guardado.</small></div></div>
    <div class="card modecard"><p><b>Nada muda de semana sem a sua autorização.</b> A agenda sugere um novo horário para cada pendência; você pode mudar a data e a hora e só então clicar em “Remarcar”.</p></div>
    ${
      !S.loaded
        ? '<p class="muted">Carregando…</p>'
        : sug.length
        ? `<div class="filters"><b class="num">${sug.length} ${plural(sug.length, 'pendência', 'pendências')}</b>${
            okCount
              ? `<button class="btn btn-sm btn-primary" data-act="pend-all" ${S.readOnly ? 'disabled' : ''}>Remarcar ${
                  okCount === sug.length ? 'todas' : `as ${okCount} com sugestão`
                }</button>`
              : ''
          }</div><div style="display:flex;flex-direction:column;gap:8px">${rows}</div>`
        : '<div class="card"><b>Nenhuma pendência.</b> <span class="muted">Tudo o que passou foi concluído, cancelado ou já está remarcado.</span></div>'
    }
    <div class="card"><h2 style="margin-bottom:10px">Remarcadas nos últimos 14 dias</h2>${
      recent.length
        ? `<ul class="simple">${recent
            .slice(0, 15)
            .map(
              (r) =>
                `<li><span class="dot" style="--c:${safeColor(cat(r.it.category).color)}"></span><span><b>${esc(
                  r.it.title
                )}</b> <span class="muted small">${esc(r.h.text.replace(/^Remarcada /, ''))}</span></span></li>`
            )
            .join('')}</ul>`
        : '<p class="muted" style="margin:0">Nada remarcado recentemente.</p>'
    }</div>
  </section>`;
}

/* ---------- resumo semanal ---------- */
export function weekStats(ws: string) {
  const we = addY(ws, 6);
  const l = expand(ws, we).filter((o) => o.status !== 'reagendada');
  const st: any = {
    total: l.length,
    done: 0,
    pend: 0,
    canc: 0,
    plan: 0,
    days: Array.from({ length: 7 }, () => ({ total: 0, done: 0 })),
    cats: {},
    pendList: [],
    cancList: []
  };
  for (const o of l) {
    const es = effStatus(o);
    const i = dayDiff(ws, o.date);
    const mins = toMin(o.end) - toMin(o.start);
    st.days[i].total++;
    const c = (st.cats[o.item.category || ''] = st.cats[o.item.category || ''] || { plan: 0, done: 0 });
    if (es !== 'cancelada') c.plan += mins;
    if (es === 'concluida') {
      st.done++;
      st.days[i].done++;
      c.done += mins;
    } else if (es === 'pendente') {
      st.pend++;
      st.pendList.push(o);
    } else if (es === 'cancelada') {
      st.canc++;
      st.cancList.push(o);
    } else {
      st.plan++;
    }
  }
  st.rate = st.total - st.canc > 0 ? Math.round((st.done / (st.total - st.canc)) * 100) : 0;
  return st;
}

export function weekLabel(ws: string) {
  const we = addY(ws, 6);
  return `${fmtD(ws)} a ${fmtD(we)}`;
}

function chartSVG(st: any) {
  const W = 560;
  const H = 220;
  const L = 34;
  const B = 30;
  const T = 18;
  const max = Math.max(1, ...st.days.map((d: any) => d.total));
  const step = Math.max(1, Math.ceil(max / 4));
  const top = step * Math.ceil(max / step);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const bw = (W - L - 10) / 7;
  let g = '';
  for (let v = 0; v <= top; v += step) {
    g += `<line x1="${L}" x2="${W - 6}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 8}" y="${
      y(v) + 4
    }" text-anchor="end">${v}</text>`;
  }
  const labels = WD;
  st.days.forEach((d: any, i: number) => {
    const x = L + i * bw + bw * 0.2;
    const w = bw * 0.6;
    g += `<rect x="${x}" y="${y(d.total)}" width="${w}" height="${y(0) - y(d.total)}" rx="4" fill="var(--soft)" stroke="var(--line)"/>`;
    if (d.done) {
      g += `<rect x="${x}" y="${y(d.done)}" width="${w}" height="${
        y(0) - y(d.done)
      }" rx="4" fill="var(--accent)"/><text class="v" x="${x + w / 2}" y="${y(d.done) - 6}" text-anchor="middle">${d.done}</text>`;
    }
    g += `<text x="${x + w / 2}" y="${H - 10}" text-anchor="middle">${labels[i]}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Atividades concluídas por dia">${g}</svg>`;
}

export function summaryText(ws: string) {
  const st = weekStats(ws);
  let t = `*Resumo semanal · ${weekLabel(ws)}*\nProgramadas: ${st.total} | Concluídas: ${st.done} | Pendentes: ${st.pend} | Canceladas: ${st.canc}\nTaxa de conclusão: ${st.rate}%`;
  if (st.pendList.length) {
    t += '\n\nPendentes:\n' + st.pendList.map((o: any) => `- ${o.item.title} (${fmtDW(o.date)}, ${fmtH(o.start)})`).join('\n');
  }
  return t;
}

export function resumoHTML() {
  const ws = S.sumWeek;
  const st = weekStats(ws);
  const cats = Object.entries(st.cats).sort((a: any, b: any) => b[1].plan - a[1].plan);
  const maxPlan = Math.max(1, ...cats.map((c: any) => c[1].plan));
  const hrs = (m: number) => (m / 60).toFixed(m % 60 ? 1 : 0).replace('.', ',') + ' h';
  const tile = (n: number, l: string, c: string) => `<div class="tile" style="--tc:${c}"><b>${n}</b><span>${l}</span></div>`;
  return `<section class="page">
    <div class="page-h"><div><h1>Resumo semanal</h1><p>Semana de ${weekLabel(ws)}. Taxa de conclusão: <b class="num">${
    st.rate
  }%</b> das atividades não canceladas.</p></div>
      <div class="filters"><button class="iconbtn" data-act="wprev" aria-label="Semana anterior">${ic(
        'left'
      )}</button><button class="btn btn-sm" data-act="wthis">Esta semana</button><button class="iconbtn" data-act="wnext" aria-label="Próxima semana">${ic(
    'right'
  )}</button></div></div>
    <div class="tiles">${tile(st.total, 'Programadas', 'var(--accent)')}${tile(st.done, 'Concluídas', 'var(--ok)')}${tile(
    st.pend,
    'Pendentes',
    'var(--warn)'
  )}${tile(st.canc, 'Canceladas', 'var(--bad)')}</div>
    <div class="two">
      <div class="card"><h2>Produtividade da semana</h2><p class="note" style="margin:2px 0 8px">Atividades concluídas por dia, sobre o total programado.</p>${chartSVG(
        st
      )}<div class="legend"><span><i style="background:var(--accent)"></i>Concluídas</span><span><i style="background:var(--soft);outline:1px solid var(--line)"></i>Programadas</span></div></div>
      <div class="card"><h2 style="margin-bottom:12px">Tempo por categoria</h2>${
        cats.length
          ? cats
              .map(([id, c]: [string, any]) => {
                const k = cat(id);
                return `<div class="catbar" style="--c:${safeColor(k.color)}"><span>${esc(
                  k.name
                )}</span><span class="track"><i style="width:${(c.plan / maxPlan) * 100}%"></i><u style="width:${
                  (c.done / maxPlan) * 100
                }%"></u></span><span class="num muted small">${hrs(c.done)} de ${hrs(c.plan)}</span></div>`;
              })
              .join('') + '<p class="note">Cor cheia: tempo concluído. Cor clara: tempo programado.</p>'
          : '<p class="muted">Sem atividades nesta semana.</p>'
      }</div>
    </div>
    <div class="card"><h2 style="margin-bottom:10px">O que ficou pendente</h2>${
      st.pendList.length
        ? `<ul class="simple">${st.pendList
            .map(
              (o: any) =>
                `<li><span class="dot" style="--c:${safeColor(cat(o.item.category).color)}"></span>${esc(
                  o.item.title
                )}<span class="muted num">${fmtDW(o.date)}, ${fmtH(o.start)}</span></li>`
            )
            .join('')}</ul>`
        : '<p class="muted" style="margin:0">Nada pendente nesta semana.</p>'
    }
      ${
        st.cancList.length
          ? `<h3 style="margin:14px 0 6px">Canceladas</h3><ul class="simple">${st.cancList
              .map(
                (o: any) =>
                  `<li><span class="dot" style="--c:${safeColor(cat(o.item.category).color)}"></span>${esc(
                    o.item.title
                  )}<span class="muted num">${fmtDW(o.date)}</span></li>`
              )
              .join('')}</ul>`
          : ''
      }</div>
    <div class="actions"><button class="btn btn-primary" data-act="pdf">${ic(
      'dl',
      16
    )} Baixar em PDF</button><button class="btn" data-act="copysum">${ic(
    'copy',
    16
  )} Copiar resumo</button><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(
    summaryText(ws)
  )}">${ic('wa', 16)} Enviar no WhatsApp</a></div>
  </section>`;
}

export async function downloadPDF() {
  const ws = S.sumWeek;
  const st = weekStats(ws);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const acc: [number, number, number] = [42, 76, 219];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(20);
  doc.text('Agenda Inteligente - Resumo semanal', 48, 64);
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text(`Semana de ${weekLabel(ws)}  |  Taxa de conclusao: ${st.rate}%`, 48, 84);
  const tiles: Array<[string, number]> = [
    ['Programadas', st.total],
    ['Concluidas', st.done],
    ['Pendentes', st.pend],
    ['Canceladas', st.canc]
  ];
  tiles.forEach(([l, n], i) => {
    const x = 48 + i * 126;
    doc.setDrawColor(220);
    doc.roundedRect(x, 104, 114, 62, 6, 6);
    doc.setTextColor(20);
    doc.setFontSize(24);
    doc.text(String(n), x + 12, 138);
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(l, x + 12, 156);
  });
  doc.setTextColor(20);
  doc.setFontSize(13);
  doc.text('Concluidas por dia', 48, 200);
  const max = Math.max(1, ...st.days.map((d: any) => d.total));
  const ch = 120;
  const base = 340;
  const labels = WD;
  st.days.forEach((d: any, i: number) => {
    const x = 60 + i * 68;
    const w = 40;
    const ht = (ch * d.total) / max;
    const hd = (ch * d.done) / max;
    doc.setFillColor(236, 239, 250);
    doc.rect(x, base - ht, w, ht, 'F');
    doc.setFillColor(...acc);
    if (hd) doc.rect(x, base - hd, w, hd, 'F');
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text(labels[i], x + w / 2, base + 16, { align: 'center' });
    doc.setTextColor(20);
    doc.text(`${d.done}/${d.total}`, x + w / 2, base - Math.max(ht, hd) - 6, { align: 'center' });
  });
  let y = 390;
  doc.setFontSize(13);
  doc.text('Pendentes', 48, y);
  y += 18;
  doc.setFontSize(11);
  if (!st.pendList.length) {
    doc.setTextColor(90);
    doc.text('Nada pendente nesta semana.', 48, y);
    y += 16;
  }
  for (const o of st.pendList) {
    if (y > 790) {
      doc.addPage();
      y = 64;
    }
    doc.setTextColor(20);
    doc.text(`- ${o.item.title}  (${fmtDW(o.date)}, ${fmtH(o.start)})`, 48, y);
    y += 16;
  }
  y += 10;
  doc.setFontSize(13);
  doc.text('Tempo por categoria', 48, y);
  y += 18;
  doc.setFontSize(11);
  for (const [id, c] of Object.entries(st.cats) as Array<[string, any]>) {
    if (y > 790) {
      doc.addPage();
      y = 64;
    }
    doc.text(
      `${cat(id).name}: ${(c.done / 60).toFixed(1).replace('.', ',')} h concluidas de ${(c.plan / 60)
        .toFixed(1)
        .replace('.', ',')} h`,
      48,
      y
    );
    y += 16;
  }
  triggerBrowserDownload(`resumo-semanal-${ws}.pdf`, doc.output('arraybuffer'));
  toast('Resumo salvo em PDF.');
}

/* ---------- assistente IA via Axios ---------- */
const SUGGESTIONS = [
  'O que deixei de fazer esta semana?',
  'Quais atividades tenho amanhã?',
  'Quais horários estão livres na sexta?',
  'Organize minhas pendências da próxima semana.',
  'Faça um resumo da minha produtividade no mês.'
];

export function chatHTML() {
  return `<section class="page chat"><div class="page-h"><div><h1>Assistente</h1><p>Pergunte sobre seus compromissos ou peça para organizar a semana. Antes de mudar qualquer coisa, eu mostro o que vou fazer e você confirma.</p></div></div>
    <div class="chat-log" id="chat-log"></div>
    <div class="sugg" id="chat-sugg">${SUGGESTIONS.map((s) => `<button data-ask="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <form class="chat-form" id="chat-form"><textarea id="chat-in" rows="1" placeholder="Pergunte sobre seus compromissos…" aria-label="Mensagem para o assistente"></textarea><button class="btn btn-primary" type="submit" id="chat-send">Enviar</button></form></section>`;
}

function mdLite(t: string) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^[-•] (.*)$/gm, '• $1')
    .replace(/\n/g, '<br>');
}

export function renderChat() {
  const log = $('#chat-log');
  if (!log) return;
  if (!S.chat.msgs.length) {
    log.innerHTML = `<div class="msg assistant">Olá! Sou a assistente da sua agenda. Posso dizer o que você tem marcado, achar horários livres, resumir sua semana e reorganizar pendências.</div>`;
  } else {
    log.innerHTML = S.chat.msgs
      .map((m: any) => {
        if (m.role === 'user') return `<div class="msg user">${esc(m.text)}</div>`;
        const props = (m.proposals || [])
          .map((pid: string) => {
            const p = S.chat.proposals.get(pid);
            if (!p) return '';
            return `<div class="prop ${p.state}"><b>${esc(p.resumo || 'Alterações propostas')}</b><ul>${p.acoes
              .map((a: any) => `<li>${esc(a.desc)}</li>`)
              .join('')}</ul>${
              p.state === 'open'
                ? `<div class="actions"><button class="btn btn-primary btn-sm" data-act="prop-ok" data-pid="${pid}" ${
                    S.readOnly ? 'disabled' : ''
                  }>Confirmar</button><button class="btn btn-sm" data-act="prop-no" data-pid="${pid}">Descartar</button></div>`
                : `<span class="small ${p.state === 'done' ? '' : 'muted'}">${
                    p.state === 'done' ? 'Feito. Alterações aplicadas na agenda.' : 'Descartado. Nada foi alterado.'
                  }</span>`
            }</div>`;
          })
          .join('');
        return `<div class="msg assistant">${m.text ? mdLite(m.text) : ''}${
          m.thinking ? `<span class="st">${esc(m.status || 'Consultando sua agenda…')}</span>` : ''
        }${m.error ? `<div class="er">${esc(m.error)}</div>` : ''}${props}</div>`;
      })
      .join('');
  }
  const sug = $('#chat-sugg');
  if (sug) sug.hidden = S.chat.msgs.length > 0;
  const send = $('#chat-send');
  if (send) send.disabled = S.chat.busy;
  const main = $('#main');
  if (main) main.scrollTop = main.scrollHeight;
}

export async function sendChat(text: string) {
  text = String(text || '').trim();
  if (!text || S.chat.busy) return;
  S.chat.msgs.push({ role: 'user', text });
  const m: any = { role: 'assistant', text: '', thinking: true, status: 'Consultando sua agenda…' };
  S.chat.msgs.push(m);
  S.chat.busy = true;
  renderChat();

  const t = todayY();
  const tom = addY(t, 1);
  const ws = weekStart(t);
  const occs = expand(addY(t, -14), addY(t, 21)).filter((o) => o.status !== 'reagendada');
  const activities = occs.map((o) => ({
    key: o.key,
    title: o.item.title,
    date: o.date,
    dayLabel: fmtDW(o.date),
    timeLabel: `${fmtH(o.start)}–${fmtH(o.end)}`,
    status: effStatus(o),
    statusLabel: STATUS[effStatus(o)],
    category: cat(o.item.category).name
  }));

  const pendingSuggestions = suggestAll().map((s: any) => ({
    key: s.o.key,
    title: s.o.item.title,
    oldLabel: `${fmtDW(s.o.date)} ${fmtH(s.o.start)}`,
    newLabel: s.date ? `${fmtDW(s.date)} ${fmtH(s.start)}–${fmtH(s.end)}` : '',
    date: s.date,
    start: s.start,
    end: s.end,
    conflict: s.conflict
  }));

  // Calcula horários livres na próxima sexta (ou dia citado)
  let freeDate = t;
  for (let i = 0; i < 7; i++) {
    const cand = addY(t, i);
    if (dow(cand) === 5) {
      freeDate = cand;
      break;
    }
  }
  const st = ST();
  const wsMin = toMin(st.workStart);
  const weMin = toMin(st.workEnd);
  const busy = activeOn(freeDate)
    .map((o) => [toMin(o.start), toMin(o.end)])
    .sort((a, b) => a[0] - b[0]);
  const freeSlots: Array<{ inicio: string; fim: string }> = [];
  let cur = wsMin;
  for (const [a, b] of busy) {
    if (a > cur && cur < weMin) freeSlots.push({ inicio: fmtH(fromMin(cur)), fim: fmtH(fromMin(Math.min(a, weMin))) });
    cur = Math.max(cur, b);
  }
  if (cur < weMin) freeSlots.push({ inicio: fmtH(fromMin(cur)), fim: fmtH(fromMin(weMin)) });

  const wSt = weekStats(ws);
  const catStats: Record<string, any> = {};
  for (const [cid, info] of Object.entries(wSt.cats) as Array<[string, any]>) {
    catStats[cat(cid).name] = {
      atividades: Math.round(info.plan / 60),
      concluidas: Math.round(info.done / 60),
      horas: (info.plan / 60).toFixed(1)
    };
  }

  try {
    const { data } = await api.post('/assistant/chat', {
      message: text,
      context: {
        today: t,
        todayLabel: fmtDL(t),
        tomorrow: tom,
        tomorrowLabel: fmtDL(tom),
        freeDayLabel: `em ${fmtDL(freeDate)}`,
        activities,
        pendingSuggestions,
        freeSlots,
        stats: {
          periodLabel: `Semana de ${weekLabel(ws)}`,
          total: wSt.total,
          concluida: wSt.done,
          pendente: wSt.pend,
          cancelada: wSt.canc,
          rate: wSt.rate,
          categories: catStats
        }
      }
    });
    m.text = data.text || '';
    m.thinking = false;
    if (data.proposal && Array.isArray(data.proposal.acoes) && data.proposal.acoes.length) {
      const pid = 'p' + uid();
      S.chat.proposals.set(pid, {
        resumo: data.proposal.resumo,
        acoes: data.proposal.acoes,
        state: 'open'
      });
      m.proposals = [pid];
    }
  } catch {
    // Fallback local determinístico caso o servidor esteja offline no PWA
    m.thinking = false;
    if ( pendingSuggestions.length && (text.toLowerCase().includes('organiz') || text.toLowerCase().includes('pend'))) {
      const valid = pendingSuggestions.filter((s: any) => !s.conflict && s.date);
      if (valid.length) {
        const pid = 'p' + uid();
        S.chat.proposals.set(pid, {
          resumo: `Reorganizar ${valid.length} pendência(s) na próxima semana`,
          acoes: valid.map((s: any) => ({
            tipo: 'mover',
            chave: s.key,
            data: s.date,
            inicio: s.start,
            fim: s.end,
            desc: `Mover “${s.title}” de ${s.oldLabel} para ${s.newLabel}`
          })),
          state: 'open'
        });
        m.proposals = [pid];
        m.text = `Preparei a remarcação de **${valid.length}** pendência(s) para horários livres da próxima semana. Confirme abaixo:`;
      } else {
        m.text = 'Suas pendências possuem prazo fixo vencido. Revise na aba **Pendências**.';
      }
    } else {
      m.text = `Resumo da sua semana (${weekLabel(ws)}): **${wSt.total}** atividades programadas, **${wSt.done}** concluídas (**${wSt.rate}%**) e **${wSt.pend}** pendentes.`;
    }
  } finally {
    S.chat.busy = false;
    renderChat();
  }
}

export function applyProposal(pid: string) {
  const p = S.chat.proposals.get(pid);
  if (!p || p.state !== 'open' || S.readOnly) return;
  for (const a of p.acoes) {
    const o = findOcc(a.chave);
    if (!o) continue;
    if (a.tipo === 'mover') {
      const patch: any = { date: a.data, start: a.inicio, end: a.fim, status: 'planejada' };
      if (!o.rec) patch.kept = false;
      patchOcc(o, patch, { hist: `Movida pelo assistente de ${fmtDW(o.date)} ${fmtH(o.start)} para ${fmtDW(a.data)} ${fmtH(a.inicio)}` });
    } else if (a.tipo === 'status') {
      patchOcc(o, { status: a.status }, { hist: `${o.rec ? fmtD(o.origDate) + ': ' : ''}marcada como ${STATUS[a.status].toLowerCase()} pelo assistente` });
    } else if (a.tipo === 'apagar') {
      if (o.rec) patchOcc(o, { deleted: true });
      else delItem(o.id);
    }
  }
  p.state = 'done';
  renderChat();
  toast('Alterações aplicadas.');
}

/* ---------- ajustes ---------- */
export function settingsHTML() {
  const st = ST();
  const ro = S.readOnly ? 'disabled' : '';
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const push = S.webPush;
  const pushMessage = !push
    ? 'Verificando a disponibilidade de notificações em segundo plano…'
    : !push.supported
    ? push.reason
    : !push.enabled
    ? push.reason || 'O servidor ainda não foi configurado para Web Push.'
    : push.subscribed
    ? `Ativo neste aparelho${push.devices > 1 ? ` · ${push.devices} aparelhos conectados` : ''}.`
    : 'Ative para receber avisos mesmo com a Agenda fechada.';
  const curTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  return `<section class="page">
    <div class="page-h"><div><h1>Ajustes</h1><p>Como a agenda organiza seu tempo, aparência Apple (Light/Dark), categorias e seus dados no PostgreSQL.</p></div></div>
    <div class="card"><h2 style="margin-bottom:10px">Aparência (MacBook, iPhone e iPad)</h2>
      <p class="muted" style="margin:0 0 10px">Escolha entre o modelo Escuro (Dark) e Claro (Light) da Agenda Inteligente.</p>
      <div class="seg" role="group">
        <button type="button" data-act="set-theme" data-val="dark" aria-pressed="${curTheme === 'dark'}">Modo Escuro (Dark)</button>
        <button type="button" data-act="set-theme" data-val="light" aria-pressed="${curTheme === 'light'}">Modo Claro (Light)</button>
      </div>
    </div>
    <div class="card"><h2 style="margin-bottom:10px">Foto do Pastor (Tela de Acesso & Perfil)</h2>
      <p class="muted" style="margin:0 0 14px">Personalize a foto oficial com destaque exibida na tela de acesso da Agenda Inteligente.</p>
      <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
        <div style="position:relative;width:84px;height:84px;border-radius:50%;overflow:hidden;border:3px solid var(--accent);box-shadow:0 6px 20px color-mix(in srgb, var(--accent) 35%, transparent);background:var(--surface)">
          <img id="avatar-preview-img" src="${getPastorAvatar()}" alt="Foto do Pastor" style="width:100%;height:100%;object-fit:cover;display:block">
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <label class="btn btn-sm btn-primary" style="cursor:pointer;margin:0">
              <svg class="i" viewBox="0 0 24 24" style="width:15px;height:15px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              Escolher Nova Foto
              <input type="file" id="inp-avatar-upload" accept="image/*" style="display:none">
            </label>
            <button class="btn btn-sm" id="btn-avatar-reset" type="button">Restaurar Foto Original</button>
          </div>
          <span class="muted small">Formatos suportados: JPG, PNG, WEBP. A alteração é imediata na tela de acesso e na agenda.</span>
        </div>
      </div>
    </div>
    <div class="card"><h2 style="margin-bottom:12px">Horário útil e pendências</h2>
      <div class="form-grid"><label class="field" for="s-ws">Começa às<input type="time" id="s-ws" value="${st.workStart}" ${ro}></label><label class="field" for="s-we">Termina às<input type="time" id="s-we" value="${st.workEnd}" ${ro}></label></div>
      <div class="field" style="margin-top:12px">Dias úteis<div class="days">${[0, 1, 2, 3, 4, 5, 6]
        .map(
          (g) =>
            `<label><input type="checkbox" data-sday="${g}" ${st.workDays.includes(g) ? 'checked' : ''} ${ro}>${WD[g]}</label>`
        )
        .join('')}</div></div>
      <p class="note">A agenda só usa o horário útil para procurar vagas ao remarcar. Você pode marcar atividades em qualquer horário.</p></div>
    <div class="card"><h2 style="margin-bottom:12px">Categorias e cores</h2>
      <p class="muted" style="margin:0 0 12px">Além das categorias do modelo, você pode adicionar outras e escolher o nome e a cor de cada uma.</p>
      <div id="catlist">${st.categories
        .map(
          (c: any, i: number) =>
            `<div class="catedit"><input type="color" value="${safeColor(
              c.color
            )}" data-catcolor="${i}" aria-label="Cor de ${esc(c.name)}" ${ro}><input class="inp" value="${esc(
              c.name
            )}" data-catname="${i}" aria-label="Nome da categoria" ${ro}><button class="btn btn-sm btn-danger" data-act="catdel" data-i="${i}" ${
              ro || st.categories.length <= 1 ? 'disabled' : ''
            }>Remover</button></div>`
        )
        .join('')}</div>
      <button class="btn btn-sm" data-act="catadd" ${ro}>Adicionar categoria</button></div>
    <div class="card"><h2 style="margin-bottom:8px">Notificações</h2>
      <p style="margin:0 0 10px" class="muted">Os lembretes aparecem na central de notificações (o sino) e como aviso na tela enquanto a agenda está aberta. ${
        perm === 'granted'
          ? 'Avisos do navegador estão ativados.'
          : perm === 'denied'
          ? 'O navegador bloqueou avisos para esta página.'
          : perm === 'unsupported'
          ? 'Este navegador não oferece avisos para esta página.'
          : ''
      }</p>
      <div class="actions">${
        perm === 'default' ? '<button class="btn btn-sm" data-act="notifperm">Ativar avisos do navegador</button>' : ''
      }<button class="btn btn-sm" data-act="notiftest">Testar lembrete</button></div>
      <p class="note">Com a agenda aberta (mesmo em outra aba), o lembrete toca um som, vibra no celular, pisca o título da aba e abre um aviso na tela. Para ser avisado com a agenda fechada, use o botão “Google Agenda” na atividade: o Google Agenda do seu iPhone/iPad/Mac avisa no horário.</p></div>
    <div class="card"><h2 style="margin-bottom:8px">Notificações Push</h2>
      <p class="muted" style="margin:0 0 10px">${esc(pushMessage || '')}</p>
      <div class="actions">${
        push?.supported && push?.enabled
          ? push.subscribed
            ? '<button class="btn btn-sm" data-act="webpush-test">Enviar teste Push</button><button class="btn btn-sm" data-act="webpush-disable">Desativar neste aparelho</button>'
            : '<button class="btn btn-sm btn-primary" data-act="webpush-enable">Ativar notificações Push</button>'
          : ''
      }</div>
      <p class="note">No iPad e iPhone, instale a Agenda na Tela de Início antes de ativar. No MacBook, Safari 16 ou superior pode receber avisos mesmo com o navegador fechado.</p></div>
    <div class="card"><h2 style="margin-bottom:8px">Seus dados</h2>
      <p class="muted" style="margin:0 0 10px">Sua agenda é sincronizada com o banco PostgreSQL (Prisma ORM) e armazenada em cache PWA no seu dispositivo Apple.</p>
      <div class="actions"><button class="btn btn-sm" data-act="export">${ic(
        'dl',
        16
      )} Exportar cópia de segurança</button><label class="btn btn-sm">Importar cópia<input type="file" id="imp" accept=".json,application/json" hidden ${ro}></label><button class="btn btn-sm" data-act="seed" ${ro}>Carregar semana de exemplo</button><button class="btn btn-sm btn-danger" data-act="wipe" ${ro}>Apagar todas as atividades</button></div></div>
  </section>`;
}

export function renderPop() {
  const root = $('#pop-root');
  if (!root) return;
  if (!S.popOpen) {
    root.innerHTML = '';
    return;
  }
  const list = S.notifs.slice(0, 30);
  root.innerHTML = `<div class="pop" role="dialog" aria-label="Notificações"><div class="pop-h"><b>Notificações</b>${
    list.some((n: any) => !n.read) ? '<button class="btn btn-sm" data-act="readall">Marcar como lidas</button>' : ''
  }</div>${
    list.length
      ? list
          .map(
            (n: any) =>
              `<div class="nrow ${n.read ? '' : 'unread'}"><b>${esc(n.title)}</b>${esc(
                n.body
              )}<br><small class="num">${new Date(n.at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}</small></div>`
          )
          .join('')
      : '<div class="nrow muted">Nenhuma notificação ainda. Lembretes e remarcações aparecem aqui.</div>'
  }</div>`;
}
