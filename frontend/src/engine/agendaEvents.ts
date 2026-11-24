import {
  HOUR_START,
  LSK,
  PPH,
  QH,
  addY,
  clone,
  dayDiff,
  esc,
  fmtD,
  fmtDL,
  fmtDW,
  fmtH,
  fromMin,
  nowMin,
  pad,
  parse,
  plural,
  todayY,
  toMin,
  triggerBrowserDownload,
  uid,
  validT,
  validY,
  weekStart,
  ymd
} from './agendaHelpers';
import { S, Store, Undo, ensureSettings, findOcc, isRec, suggestAll } from './agendaCore';
import { chime, initAudio, normSettings, toast, setPastorAvatar, resetPastorAvatar } from './agendaStorage';
import { disableWebPush, enableWebPush, getWebPushStatus, testWebPush } from '../services/webPush';
import {
  $,
  $$,
  TABS,
  addPerson,
  applyProposal,
  applySug,
  checkReminders,
  delItem,
  downloadPDF,
  notify,
  parsePeople,
  patchOcc,
  patchSub,
  putItem,
  render,
  renderChat,
  renderPop,
  saveSettings,
  scheduleRender,
  sendChat,
  setTab,
  summaryText,
  updateHeader,
  warnConflicts
} from './agendaRenderers';
import {
  ask,
  askPassword,
  blankItem,
  closeModal,
  copyOcc,
  copyText,
  openEditor,
  openPeopleDay,
  openQuickNote,
  openResched,
  openStudy,
  openTravel,
  openNotifHistory,
  seed,
  showModal
} from './agendaModals';

export function navPeriod(k: number) {
  if (S.view === 'day') S.cursor = addY(S.cursor, k);
  else if (S.view === 'week') S.cursor = addY(S.cursor, 7 * k);
  else if (S.view === 'custom') {
    if (S.customDays && S.customDays.length) {
      S.customDays = S.customDays.map((d: string) => addY(d, 7 * k));
    }
    S.cursor = addY(S.cursor, 7 * k);
  } else if (S.view === 'year') {
    const c = parse(S.cursor);
    S.cursor = ymd(new Date(c.getFullYear() + k, 0, 1));
  } else {
    const c = parse(S.cursor);
    S.cursor = ymd(new Date(c.getFullYear(), c.getMonth() + k, 1));
  }
  render();
}

let drag: any = null;
let sel: any = null;
let quick: any = null;

function quarterAt(col: HTMLElement, y: number) {
  const r = col.getBoundingClientRect();
  return Math.max(HOUR_START * 60, Math.min(1440 - 15, HOUR_START * 60 + Math.floor((y - r.top) / QH) * 15));
}

function colAtX(x: number) {
  return $$('.g-col').find((c) => {
    const r = c.getBoundingClientRect();
    return x >= r.left && x < r.right;
  });
}

function spanGeom(d1: string, d2: string) {
  const days = S._gridDays || [];
  if (!days.length) return null;
  let [a, b] = d1 <= d2 ? [d1, d2] : [d2, d1];
  if (b < days[0] || a > days[days.length - 1]) return null;
  if (a < days[0]) a = days[0];
  if (b > days[days.length - 1]) b = days[days.length - 1];
  const i = days.indexOf(a);
  const k = days.indexOf(b) - i + 1;
  const n = days.length;
  return { left: `calc(${(i / n) * 100}% + 2px)`, width: `calc(${(k / n) * 100}% - 4px)` };
}

function spanBox(d1: string, d2: string, lo: number, hi: number, label: string, dashed?: boolean) {
  const layer = $('.g-span');
  const g = spanGeom(d1, d2);
  if (!layer || !g) return [];
  const x = document.createElement('div');
  x.className = 'selbox' + (dashed ? ' ghostspan' : '');
  x.style.left = g.left;
  x.style.width = g.width;
  x.style.top = ((lo - HOUR_START * 60) / 60) * PPH + 'px';
  x.style.height = Math.max(QH, ((hi - lo) / 60) * PPH) + 'px';
  x.textContent = label;
  layer.appendChild(x);
  return [x];
}

function startSel(e: PointerEvent) {
  const col = (e.target as HTMLElement).closest('.g-col') as HTMLElement | null;
  if (!col) return;
  if (e.pointerType === 'touch' && S.touchLocked && !(S.pasteMode && S.clip)) {
    return;
  }
  if (S.readOnly) {
    toast('Esta agenda está disponível só para leitura.');
    return;
  }
  S.dragging = true;
  const m = quarterAt(col, e.clientY);
  sel = {
    col,
    date: col.dataset.date!,
    date2: col.dataset.date!,
    a: m,
    b: m,
    x0: e.clientX,
    y0: e.clientY,
    touch: e.pointerType === 'touch',
    moved: false,
    boxes: [] as HTMLElement[]
  };
}

function drawSel() {
  const lo = Math.min(sel.a, sel.b);
  const hi = Math.max(sel.a, sel.b) + 15;
  sel.boxes.forEach((x: HTMLElement) => x.remove());
  const n = Math.abs(dayDiff(sel.date, sel.date2)) + 1;
  sel.boxes = spanBox(
    sel.date,
    sel.date2,
    lo,
    hi,
    `${fmtH(fromMin(lo))}–${fmtH(fromMin(Math.min(hi, 1439)))}${n > 1 ? ` · ${n} dias` : ''}`
  );
}

function moveSel(e: PointerEvent) {
  if (!sel.moved) {
    if (Math.hypot(e.clientX - sel.x0, e.clientY - sel.y0) < 6) return;
    if (sel.touch) {
      cancelSel();
      return;
    }
    sel.moved = true;
  }
  e.preventDefault();
  sel.b = quarterAt(sel.col, e.clientY);
  const c = colAtX(e.clientX);
  if (c) sel.date2 = c.dataset.date;
  drawSel();
}

function cancelSel() {
  if (sel) sel.boxes.forEach((x: HTMLElement) => x.remove());
  sel = null;
  S.dragging = false;
  if (S.pendingRender) render();
}

function endSel() {
  const s = sel;
  sel = null;
  S.dragging = false;
  s.boxes.forEach((x: HTMLElement) => x.remove());
  const lo = Math.min(s.a, s.b);
  const hi = Math.max(s.a, s.b) + 15;
  const [d1, d2] = s.date <= s.date2 ? [s.date, s.date2] : [s.date2, s.date];
  if (S.pendingRender) render();
  if (S.pasteMode && S.clip) {
    S.suppressClick = Date.now();
    pasteAt(s.date, s.a);
    return;
  }
  if (!s.moved) {
    const now = Date.now();
    const lt = S.lastTap;
    S.lastTap = { date: s.date, a: s.a, at: now };
    if (!lt || lt.date !== s.date || lt.a !== s.a || now - lt.at > 450) return;
    S.lastTap = null;
  }
  const col = $(`.g-col[data-date="${d1}"]`);
  if (!col) return;
  S.suppressClick = Date.now();
  showQuick(col, lo, hi, d2);
}

function showQuick(col: HTMLElement, a: number, b: number, last?: string) {
  const el = document.createElement('div');
  el.className = 'quick';
  el.style.top = ((a - HOUR_START * 60) / 60) * PPH + 'px';
  el.style.height = Math.max(QH, ((b - a) / 60) * PPH) + 'px';
  const multi = last && last > col.dataset.date!;
  const g = spanGeom(col.dataset.date!, last || col.dataset.date!);
  const layer = $('.g-span');
  if (g && layer) {
    el.style.left = g.left;
    el.style.width = g.width;
  } else {
    el.style.left = '2px';
    el.style.right = '2px';
  }
  const range = multi ? `${fmtDW(col.dataset.date!)} a ${fmtDW(last!)}, ` : '';
  el.innerHTML = `<input aria-label="Nova atividade ${range || 'em ' + fmtDL(col.dataset.date!) + ', '}${fmtH(
    fromMin(a)
  )}" placeholder="${range}${fmtH(fromMin(a))}–${fmtH(fromMin(Math.min(b, 1439)))} · escreva e tecle Enter">`;
  (g && layer ? layer : col).appendChild(el);
  const inp = el.querySelector('input')!;
  const extra: HTMLElement[] = [];
  const q: any = (quick = { el, inp, date: col.dataset.date!, last: multi ? last : null, a, b, extra });
  inp.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      commitQuick(q);
    } else if (ev.key === 'Escape') {
      ev.stopPropagation();
      q.cancel = true;
      inp.blur();
    }
  });
  inp.addEventListener('blur', () => commitQuick(q));
  inp.focus();
}

function commitQuick(q: any) {
  if (q.done) return;
  q.done = true;
  if (quick === q) quick = null;
  const t = q.inp.value.trim();
  q.el.remove();
  q.extra.forEach((x: HTMLElement) => x.remove());
  if (q.cancel || !t) {
    scheduleRender();
    return;
  }
  const it = blankItem({ date: q.date, start: fromMin(q.a), end: fromMin(Math.min(q.b, 1439)) });
  it.title = t.slice(0, 120);
  it.history = [{ at: Date.now(), text: q.last ? `Criada de ${fmtDW(q.date)} a ${fmtDW(q.last)}` : 'Criada' }];
  if (q.last) {
    it.recur = { freq: 'daily', days: [], until: q.last };
    (it as any).span = true;
  }
  putItem(it);
  for (let d = q.date; d <= (q.last || q.date); d = addY(d, 1)) warnConflicts(d, it.start, it.end, it.id);
}

export function pasteAt(date: string, startMin: number) {
  const c = S.clip;
  if (!c) return;
  if (S.readOnly) {
    toast('Esta agenda está disponível só para leitura.');
    return;
  }
  const s0 = Math.max(0, Math.min(1439 - 15, startMin));
  const e0 = Math.min(1439, s0 + c.dur);
  const it: any = blankItem({ date, start: fromMin(s0), end: fromMin(e0) });
  Object.assign(it, {
    title: c.title,
    category: c.category,
    priority: c.priority,
    notes: c.notes,
    subtasks: clone(c.subtasks || []),
    links: clone(c.links),
    files: clone(c.files),
    reminder: c.reminder,
    history: [{ at: Date.now(), text: 'Criada por copiar e colar' }]
  });
  const last = addY(date, c.days - 1);
  if (c.days > 1) {
    it.recur = { freq: 'daily', days: [], until: last };
    it.span = true;
  }
  putItem(it);
  render();
  toast(`“${c.title}” colada em ${fmtDW(date)}${c.days > 1 ? ` a ${fmtDW(last)}` : ''}, ${fmtH(it.start)}–${fmtH(it.end)}.`);
  for (let d = date; d <= last; d = addY(d, 1)) warnConflicts(d, it.start, it.end, it.id);
}

function shiftSeries(id: string, delta: number, ns: string, ne: string, hist: string) {
  const it = clone(S.items.get(id));
  if (!it) return;
  const ov: Record<string, any> = {};
  for (const [k, v] of Object.entries(it.overrides || {}) as Array<[string, any]>) {
    const nv = { ...v };
    if (nv.start === it.start && nv.end === it.end) {
      delete nv.start;
      delete nv.end;
    }
    if (nv.date) nv.date = addY(nv.date, delta);
    ov[addY(k, delta)] = nv;
  }
  it.overrides = ov;
  it.date = addY(it.date, delta);
  if (it.recur && it.recur.until) it.recur.until = addY(it.recur.until, delta);
  it.start = ns;
  it.end = ne;
  it.span = true;
  it.history = [...(it.history || []), { at: Date.now(), text: hist }].slice(-30);
  putItem(it);
}

function applySpanMerged(o: any, nd: string, _first: string, last: string) {
  const it = clone(S.items.get(o.id));
  if (!it) return;
  const until = it.recur.until;
  if (until && last !== until) {
    render();
    toast('Esta atividade continua em outros dias. Para mudar o período, abra os detalhes.', 'warn');
    return;
  }
  if (nd < it.date) it.date = nd;
  else it.recur = { ...it.recur, until: nd };
  it.span = true;
  it.history = [...(it.history || []), { at: Date.now(), text: `Período alterado para ${fmtDW(it.date)} a ${fmtDW(it.recur.until)}` }].slice(-30);
  putItem(it);
  render();
  toast(`“${it.title}” agora ocupa de ${fmtDW(it.date)} a ${fmtDW(it.recur.until)}.`);
}

function applySpan(o: any, nd: string) {
  const it = clone(S.items.get(o.id));
  if (!it) return;
  if (!isRec(it)) {
    const [a, b] = nd < it.date ? [nd, it.date] : [it.date, nd];
    const orig = it.date;
    const st = it.status;
    Object.assign(it, { date: a, recur: { freq: 'daily', days: [], until: b }, overrides: {}, status: 'planejada', span: true });
    if (st && st !== 'planejada') it.overrides[orig] = { status: st };
    it.history = [...(it.history || []), { at: Date.now(), text: `Ampliada para ${fmtDW(a)} a ${fmtDW(b)}` }].slice(-30);
    putItem(it);
    render();
    toast(`“${it.title}” agora ocupa de ${fmtDW(a)} a ${fmtDW(b)}, das ${fmtH(it.start)} às ${fmtH(it.end)}.`);
    for (let d = a; d <= b; d = addY(d, 1)) warnConflicts(d, it.start, it.end, it.id);
    return;
  }
  if (it.recur.freq === 'daily') {
    if (nd < it.date) it.date = nd;
    else if (it.recur.until && nd > it.recur.until) it.recur.until = nd;
    else {
      render();
      toast('Esses dias já fazem parte desta atividade.');
      return;
    }
    it.history = [...(it.history || []), { at: Date.now(), text: `Ampliada até ${fmtDW(nd)}` }].slice(-30);
    putItem(it);
    render();
    toast(`“${it.title}” ampliada até ${fmtDW(nd)}.`);
    return;
  }
  render();
  toast('Esta atividade já se repete em dias da semana escolhidos.', 'warn');
}

function startInline(el: HTMLElement, o: any) {
  if (S.readOnly) {
    openEditor(o.key);
    return;
  }
  const t = el.querySelector('.ev-t');
  if (!t) return;
  const inp = document.createElement('input');
  inp.className = 'ev-inp';
  inp.value = o.item.title;
  inp.setAttribute('aria-label', 'Nome da atividade');
  t.replaceWith(inp);
  inp.focus();
  inp.select();
  let done = false;
  const finish = (save: boolean) => {
    if (done) return;
    done = true;
    const v = inp.value.trim();
    const cur = S.items.get(o.id);
    if (save && v && cur && v !== cur.title) {
      const it = clone(cur);
      it.title = v.slice(0, 120);
      putItem(it);
    }
    scheduleRender();
  };
  inp.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      inp.blur();
    } else if (ev.key === 'Escape') {
      ev.stopPropagation();
      done = true;
      scheduleRender();
      inp.blur();
    }
  });
  inp.addEventListener('blur', () => finish(true));
}

function forceEditor(key?: string | null, preset?: any) {
  if (sel) cancelSel();
  drag = null;
  S.dragging = false;
  S.suppressClick = 0;
  openEditor(key, preset);
}

function endDrag(cancel: boolean) {
  const d = drag;
  drag = null;
  if (!d) return;
  S.dragging = false;
  if (d.ghost) d.ghost.remove();
  if (!d.moved) {
    if (!cancel) {
      if (d.kind === 'grid' && !d.o.isSub) startInline(d.el, d.o);
      else openEditor(d.o.key);
    }
    return;
  }
  S.suppressClick = Date.now();
  const o = d.o;
  (d.boxes || []).forEach((x: HTMLElement) => x.remove());
  if (o.isSub) {
    if (cancel || !d.nd || d.mode === 'span') {
      render();
      return;
    }
    const ns = fromMin(d.ns);
    const dur = Math.max(5, Math.min(d.ne, 1439) - d.ns);
    if (d.nd === o.date && ns === o.start && dur === toMin(o.end) - toMin(o.start)) {
      render();
      return;
    }
    patchSub(o, { date: d.nd, start: ns, dur }, `Subtarefa ${o.subNo}/${o.n} em ${fmtDW(d.nd)}, ${fmtH(ns)}–${fmtH(fromMin(d.ns + dur))}.`);
    return;
  }
  if (d.mode === 'span') {
    if (cancel || !d.nd) {
      render();
      return;
    }
    if (d.merged) {
      if (d.nd !== d.last) applySpanMerged(o, d.nd, d.first, d.last);
      else render();
    } else if (d.nd !== o.date) applySpan(o, d.nd);
    else render();
    return;
  }
  if (d.merged && !cancel && d.nd) {
    const ns = fromMin(d.ns);
    const ne = fromMin(Math.min(d.ne, 1439));
    if (d.mode === 'resize') {
      shiftSeries(o.id, 0, ns, ne, `Horário alterado para ${fmtH(ns)}–${fmtH(ne)} em todos os dias`);
      toast(`“${o.item.title}” agora vai das ${fmtH(ns)} às ${fmtH(ne)}.`);
    } else {
      const delta = dayDiff(d.first, d.nd);
      if (!delta && ns === o.start && ne === o.end) {
        render();
        return;
      }
      shiftSeries(
        o.id,
        delta,
        ns,
        ne,
        `Movida para ${fmtDW(addY(d.first, delta))} a ${fmtDW(addY(d.last, delta))}, ${fmtH(ns)}–${fmtH(ne)}`
      );
      toast(`“${o.item.title}” movida para ${fmtDW(addY(d.first, delta))} a ${fmtDW(addY(d.last, delta))}, ${fmtH(ns)}.`);
    }
    render();
    return;
  }
  if (cancel || !d.nd || (d.nd === o.date && fromMin(d.ns) === o.start && fromMin(d.ne) === o.end)) {
    render();
    return;
  }
  const ns = fromMin(d.ns);
  const ne = fromMin(Math.min(d.ne, 1439));
  const hist =
    d.mode === 'resize'
      ? `Duração alterada para ${fmtH(ns)}–${fmtH(ne)}`
      : `Movida de ${fmtDW(o.date)} ${fmtH(o.start)} para ${fmtDW(d.nd)} ${fmtH(ns)}`;
  const patch: any = { date: d.nd, start: ns, end: ne };
  if (!o.rec) patch.kept = false;
  patchOcc(o, patch, { hist });
  render();
  toast(
    d.mode === 'resize'
      ? `“${o.item.title}” agora vai das ${fmtH(ns)} às ${fmtH(ne)}.`
      : `“${o.item.title}” movida para ${fmtDW(d.nd)}, ${fmtH(ns)}${o.rec ? ' (só neste dia)' : ''}.`
  );
  warnConflicts(d.nd, ns, ne, o.key);
}

function pendSug(key: string) {
  const s: any = suggestAll().find((x) => x.o.key === key);
  if (!s) return null;
  const e = S.pendEdits[key] || {};
  const date = e.date || s.date;
  const start = e.start || s.start;
  if (!validY(date) || !validT(start)) return { error: 'Escolha a nova data e o horário.' };
  const dur = toMin(s.o.end) - toMin(s.o.start);
  return { o: s.o, date, start: validT(start)!, end: fromMin(Math.min(1439, toMin(start) + dur)) };
}

let engineInitialized = false;

async function refreshWebPushStatus() {
  S.webPush = await getWebPushStatus();
  if (S.tab === 'ajustes') render();
}

export function initAgendaEngine(onSetTheme?: (mode: 'dark' | 'light') => void) {
  S.onRender = () => render();
  S.onAfterLoad = () => {
    checkReminders(showModal);
    void refreshWebPushStatus();
  };

  const h = location.hash.slice(1);
  if (TABS.some((x) => x[0] === h)) S.tab = h;

  render();
  Store.start();

  if (engineInitialized) return;
  engineInitialized = true;

  document.addEventListener('pointerdown', () => initAudio(), { passive: true });

  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type !== 'push-subscription-change') return;
    void enableWebPush().then(refreshWebPushStatus).catch(() => {});
  });

  // Navegação entre períodos/semanas ao deslizar horizontalmente no trackpad (2 ou 3 dedos) ou swipe touch
  let trackpadDeltaX = 0;
  let trackpadTimer: any = null;
  let trackpadCooldown = false;

  document.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if ($('.overlay') || S.dragging || S.pasteMode) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest('input, textarea, select, .mini, .pick, .utility-menu, .ai-assistant-modal')) return;

      const dx = e.shiftKey ? e.deltaY : e.deltaX;
      if (Math.abs(dx) > Math.abs(e.deltaY) * 0.7 && Math.abs(dx) > 12) {
        if (trackpadCooldown) return;
        trackpadDeltaX += dx;

        clearTimeout(trackpadTimer);
        trackpadTimer = setTimeout(() => {
          trackpadDeltaX = 0;
        }, 180);

        if (Math.abs(trackpadDeltaX) >= 50) {
          const dir = trackpadDeltaX > 0 ? 1 : -1;
          trackpadDeltaX = 0;
          trackpadCooldown = true;
          setTimeout(() => {
            trackpadCooldown = false;
          }, 380);

          navPeriod(dir);
        }
      }
    },
    { passive: true }
  );

  let touchStartX = 0;
  let touchStartY = 0;
  document.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      if ($('.overlay') || S.dragging) return;
      if (e.touches.length >= 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    },
    { passive: true }
  );

  document.addEventListener(
    'touchend',
    (e: TouchEvent) => {
      if ($('.overlay') || S.dragging) return;
      if (e.changedTouches.length >= 1) {
        const diffX = e.changedTouches[0].clientX - touchStartX;
        const diffY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(diffX) > Math.abs(diffY) * 1.2 && Math.abs(diffX) > 60) {
          navPeriod(diffX < 0 ? 1 : -1);
        }
      }
    },
    { passive: true }
  );

  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.ctrlKey) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, .quick, .trip-l, [data-qnote]')) return;
    const el = t.closest('.ev, .chip') as HTMLElement | null;
    if (!el) {
      startSel(e);
      return;
    }
    if (e.pointerType === 'touch' && S.touchLocked) {
      return;
    }
    const o = findOcc(el.dataset.key);
    if (!o) return;
    drag = {
      el,
      o,
      x0: e.clientX,
      y0: e.clientY,
      moved: false,
      pid: e.pointerId,
      kind: el.classList.contains('ev') ? 'grid' : 'month',
      mode: t.closest('.rz') ? 'resize' : t.closest('.rzx') ? 'span' : 'move'
    };
    if (drag.kind === 'grid') {
      const r = el.getBoundingClientRect();
      drag.grabDy = e.clientY - r.top;
      drag.col0 = el.parentElement;
      if (el.dataset.span) {
        drag.merged = true;
        drag.first = el.dataset.first;
        drag.last = el.dataset.last;
        const c = colAtX(e.clientX);
        drag.grabOff = c ? dayDiff(drag.first, c.dataset.date) : 0;
      }
    }
  });

  document.addEventListener(
    'pointermove',
    (e) => {
      if (sel) {
        moveSel(e);
        return;
      }
      if (!drag) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
        if (S.readOnly) {
          drag = null;
          return;
        }
        drag.moved = true;
        S.dragging = true;
        drag.el.classList.add('dragging');
        try {
          drag.el.setPointerCapture(drag.pid);
        } catch {}
        if (drag.kind === 'month') {
          const g = drag.el.cloneNode(true) as HTMLElement;
          const r = drag.el.getBoundingClientRect();
          g.classList.add('ghost');
          g.style.width = r.width + 'px';
          document.body.appendChild(g);
          drag.ghost = g;
        }
      }
      e.preventDefault();
      const o = drag.o;
      const dur = toMin(o.end) - toMin(o.start);
      if (drag.kind === 'grid') {
        const cols = $$('.g-col');
        const col =
          cols.find((c) => {
            const r = c.getBoundingClientRect();
            return e.clientX >= r.left && e.clientX < r.right;
          }) || drag.el.parentElement;
        if (drag.mode === 'span') {
          drag.nd = col.dataset.date;
          drag.ns = toMin(o.start);
          drag.ne = toMin(o.end);
          (drag.boxes || []).forEach((x: HTMLElement) => x.remove());
          const from = drag.merged ? drag.first : o.date;
          drag.boxes = spanBox(
            from,
            drag.nd,
            toMin(o.start),
            toMin(o.end),
            `${o.item.title} · ${Math.abs(dayDiff(from, drag.nd)) + 1} dias`,
            true
          );
          return;
        }
        if (drag.mode === 'move' && drag.merged) {
          const r = col.getBoundingClientRect();
          let m = HOUR_START * 60 + ((e.clientY - r.top - drag.grabDy) / PPH) * 60;
          m = Math.round(m / 15) * 15;
          m = Math.max(0, Math.min(1440 - dur, m));
          drag.nd = addY(col.dataset.date, -drag.grabOff);
          drag.ns = m;
          drag.ne = m + dur;
          const k = dayDiff(drag.first, drag.last);
          const g = spanGeom(drag.nd, addY(drag.nd, k));
          if (g) {
            drag.el.style.left = g.left;
            drag.el.style.width = g.width;
          }
          drag.el.style.top = ((Math.max(m, HOUR_START * 60) - HOUR_START * 60) / 60) * PPH + 'px';
        } else if (drag.mode === 'move') {
          const r = col.getBoundingClientRect();
          let m = HOUR_START * 60 + ((e.clientY - r.top - drag.grabDy) / PPH) * 60;
          m = Math.round(m / 15) * 15;
          m = Math.max(0, Math.min(1440 - dur, m));
          drag.nd = col.dataset.date;
          drag.ns = m;
          drag.ne = m + dur;
          if (drag.el.parentElement !== col) col.appendChild(drag.el);
          drag.el.style.top = ((Math.max(m, HOUR_START * 60) - HOUR_START * 60) / 60) * PPH + 'px';
          drag.el.style.left = '2px';
          drag.el.style.width = 'calc(100% - 4px)';
        } else {
          const r = drag.col0.getBoundingClientRect();
          const s = toMin(o.start);
          let m = HOUR_START * 60 + ((e.clientY - r.top) / PPH) * 60;
          m = Math.round(m / 15) * 15;
          m = Math.max(s + 15, Math.min(1439, m));
          drag.nd = o.date;
          drag.ns = s;
          drag.ne = m;
          drag.el.style.height = Math.max(QH - 2, ((m - Math.max(s, HOUR_START * 60)) / 60) * PPH - 2) + 'px';
        }
        let mm = drag.el.querySelector('.ev-m');
        if (!mm) {
          mm = document.createElement('div');
          mm.className = 'ev-m';
          drag.el.querySelector('.ev-top').after(mm);
        }
        mm.textContent = `${fmtH(fromMin(drag.ns))}–${fmtH(fromMin(drag.ne))}`;
      } else {
        drag.ghost.style.left = e.clientX + 8 + 'px';
        drag.ghost.style.top = e.clientY + 8 + 'px';
        const cell = $$('.m-cell').find((c) => {
          const r = c.getBoundingClientRect();
          return e.clientX >= r.left && e.clientX < r.right && e.clientY >= r.top && e.clientY < r.bottom;
        });
        $$('.m-cell.drop').forEach((c) => c !== cell && c.classList.remove('drop'));
        if (cell) {
          cell.classList.add('drop');
          drag.nd = cell.dataset.date;
          drag.ns = toMin(o.start);
          drag.ne = toMin(o.end);
        }
      }
    },
    { passive: false }
  );

  document.addEventListener('pointerup', () => {
    if (sel) endSel();
    else endDrag(false);
  });
  document.addEventListener('pointercancel', () => {
    if (sel) cancelSel();
    else endDrag(true);
  });

  document.addEventListener('contextmenu', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.overlay')) return;
    const qEl = t.closest('.quick');
    if (qEl && quick) {
      e.preventDefault();
      const q = quick;
      q.done = true;
      quick = null;
      q.el.remove();
      q.extra.forEach((x: HTMLElement) => x.remove());
      forceEditor(null, {
        date: q.date,
        start: fromMin(q.a),
        end: fromMin(Math.min(q.b, 1439)),
        title: q.inp.value.trim(),
        recur: q.last ? { freq: 'daily', days: [], until: q.last } : null
      });
      return;
    }
    const el = t.closest('.ev, .chip') as HTMLElement | null;
    if (el) {
      e.preventDefault();
      const a = document.activeElement as HTMLElement | null;
      if (a && a.classList.contains('ev-inp')) a.blur();
      forceEditor(el.dataset.key);
      return;
    }
    const col = t.closest('.g-col') as HTMLElement | null;
    if (col) {
      e.preventDefault();
      const m = quarterAt(col, e.clientY);
      forceEditor(null, { date: col.dataset.date, start: fromMin(m), end: fromMin(Math.min(1439, m + 60)) });
    }
  });

  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 2) return;
      const t = e.touches[0];
      const hit = document.elementFromPoint(t.clientX, t.clientY);
      const el = hit && (hit.closest('.ev, .chip') as HTMLElement | null);
      if (!el) return;
      e.preventDefault();
      forceEditor(el.dataset.key);
    },
    { passive: false }
  );

  document.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-close]')) {
      const c = t.closest('[data-close]') as HTMLElement;
      closeModal(t.closest('.overlay') as HTMLElement);
      if (c.dataset.tab) setTab(c.dataset.tab);
      return;
    }
    const qn = t.closest('[data-qnote]') as HTMLElement | null;
    if (qn) {
      e.preventDefault();
      e.stopPropagation();
      openQuickNote(qn.dataset.qnote);
      return;
    }
    if (t.closest('#notif-sub-readall')) {
      S.notifs = S.notifs.map((n: any) => ({ ...n, read: true }));
      Store.write('notifs');
      updateHeader();
      toast('Notificações marcadas como lidas.');
      return;
    }
    if (t.closest('[data-act="open-notif-history"]')) {
      const details = document.querySelector('.utility-menu') as HTMLDetailsElement | null;
      if (details) details.open = false;
      openNotifHistory();
      return;
    }
    const notifItem = t.closest('.notif-sub-item') as HTMLElement | null;
    if (notifItem) {
      const details = document.querySelector('.utility-menu') as HTMLDetailsElement | null;
      if (details) details.open = false;
      if (notifItem.dataset.tab) {
        setTab(notifItem.dataset.tab);
        return;
      }
      if (notifItem.dataset.notifId) {
        const notif = S.notifs.find((n: any) => n.id === notifItem.dataset.notifId);
        if (notif) {
          notif.read = true;
          Store.write('notifs');
          updateHeader();
        }
      }
      return;
    }
    if (t.closest('#bell')) {
      // Abre o histórico diretamente ou foca o painel
      openNotifHistory();
      return;
    }
    if (t.closest('.overlay')) return;
    const tab = t.closest('[data-tab]') as HTMLElement | null;
    if (tab) {
      setTab(tab.dataset.tab!);
      return;
    }
    const gm = t.closest('[data-gomonth]') as HTMLElement | null;
    if (gm) {
      S.cursor = gm.dataset.gomonth;
      S.view = 'month';
      render();
      return;
    }
    const pd = t.closest('[data-pday]') as HTMLElement | null;
    if (pd) {
      openPeopleDay(pd.dataset.pday!, pd.dataset.ptype!);
      return;
    }
    const trb = t.closest('[data-travel]') as HTMLElement | null;
    if (trb) {
      openTravel(trb.dataset.travel);
      return;
    }
    const go = t.closest('[data-goto]') as HTMLElement | null;
    if (go) {
      const targetDate = go.dataset.goto!;
      const fromMini = !!go.closest('.mini');
      const isMulti = fromMini && (e.ctrlKey || e.metaKey || e.shiftKey || S.multiSelectMode);

      if (isMulti) {
        if (!Array.isArray(S.customDays)) S.customDays = [];
        if (e.shiftKey && S.cursor) {
          const [d1, d2] = S.cursor <= targetDate ? [S.cursor, targetDate] : [targetDate, S.cursor];
          const diff = Math.min(dayDiff(d1, d2), 14);
          const range: string[] = [];
          for (let i = 0; i <= diff; i++) {
            range.push(addY(d1, i));
          }
          S.customDays = Array.from(new Set([...S.customDays, ...range])).sort();
        } else {
          if (S.customDays.includes(targetDate)) {
            S.customDays = S.customDays.filter((d: string) => d !== targetDate);
          } else {
            S.customDays = [...S.customDays, targetDate].sort();
          }
        }
        if (S.customDays.length === 0) {
          S.customDays = [targetDate];
        }
        S.cursor = targetDate;
        S.view = S.customDays.length > 1 ? 'custom' : 'week';
        S.tab = 'agenda';
        render();
        return;
      }

      S.customDays = [];
      S.cursor = targetDate;
      if (fromMini || go.closest('.g-day') || S.view === 'week') {
        S.view = 'week';
      } else {
        S.view = 'day';
      }
      S.tab = 'agenda';
      render();
      return;
    }
    const vw = t.closest('[data-view]') as HTMLElement | null;
    if (vw) {
      S.customDays = [];
      S.view = vw.dataset.view;
      render();
      return;
    }
    const op = t.closest('[data-open]') as HTMLElement | null;
    if (op) {
      openEditor(op.dataset.open);
      return;
    }
    const ak = t.closest('[data-ask]') as HTMLElement | null;
    if (ak) {
      sendChat(ak.dataset.ask!);
      return;
    }
    if (t.closest('#btn-avatar-reset')) {
      resetPastorAvatar();
      const img = document.getElementById('avatar-preview-img') as HTMLImageElement;
      if (img) img.src = '/pastor.jpg';
      toast('Foto restaurada para a imagem padrão.');
      return;
    }
    const a = t.closest('[data-act]') as HTMLElement | null;
    if (a) {
      const act = a.dataset.act;
      if (act === 'toggle-touch-lock') {
        S.touchLocked = !S.touchLocked;
        try {
          localStorage.setItem(LSK + ':touchLock', S.touchLocked ? '1' : '0');
        } catch {}
        render();
        toast(
          S.touchLocked
            ? '🔒 Tela bloqueada: movimente com os dedos livremente sem editar ou mover atividades.'
            : '🔓 Tela desbloqueada: toque em uma atividade ou horário para digitar e editar.'
        );
        return;
      }
      if (act === 'toggle-multi') {
        S.multiSelectMode = !S.multiSelectMode;
        if (!S.multiSelectMode) {
          S.customDays = [];
          S.view = 'week';
        } else if (!S.customDays || S.customDays.length === 0) {
          S.customDays = [S.cursor];
          S.view = 'custom';
        }
        render();
        return;
      }
      if (act === 'set-theme' && onSetTheme) {
        onSetTheme((a.dataset.val as 'dark' | 'light') || 'dark');
        setTimeout(() => render(), 20);
        return;
      }
      if (act === 'new') {
        openEditor(null, { date: S.tab === 'agenda' ? S.cursor : todayY() });
        return;
      }
      if (act === 'today') {
        S.cursor = todayY();
        render();
        return;
      }
      if (act === 'prev' || act === 'next') {
        navPeriod(act === 'prev' ? -1 : 1);
        return;
      }
      if (act === 'mprev' || act === 'mnext') {
        const c = parse(S.cursor);
        S.cursor = ymd(new Date(c.getFullYear(), c.getMonth() + (act === 'mprev' ? -1 : 1), 1));
        render();
        return;
      }
      if (act === 'seed') {
        seed();
        return;
      }
      if (act === 'pe-tab') {
        S.peopleTab = a.dataset.val;
        render();
        return;
      }
      if (act === 'pe-del') {
        const pe = S.people.get(a.dataset.id);
        if (!pe) return;
        const v = await ask('Remover da lista', `Remover “${pe.name}”?`, [
          { label: 'Cancelar', value: null },
          { label: 'Remover', value: 'y', kind: 'btn-danger' }
        ]);
        if (!v) return;
        S.people.delete(pe.id);
        Store.write(pe.id);
        render();
        return;
      }
      if (act === 'pe-bulk') {
        const { out, bad } = parsePeople($('#pe-bulk').value, S.peopleTab);
        for (const v of out) addPerson(S.peopleTab, v);
        render();
        toast(
          `${out.length} ${plural(out.length, 'pessoa salva', 'pessoas salvas')} na agenda.${
            bad.length
              ? ` ${bad.length} ${plural(
                  bad.length,
                  'linha não foi entendida',
                  'linhas não foram entendidas'
                )}: confira se têm o dia/mês.`
              : ''
          }`,
          bad.length ? 'warn' : ''
        );
        return;
      }
      if (act === 'side') {
        S.sideHidden = !S.sideHidden;
        try {
          localStorage.setItem(LSK + ':side', S.sideHidden ? '1' : '0');
        } catch {}
        render();
        return;
      }
      if (act === 'pastemode') {
        S.pasteMode = !S.pasteMode;
        render();
        if (S.pasteMode) toast('Clique na linha onde o compromisso deve começar. Pode colar várias vezes; tecle Esc para parar.');
        return;
      }
      if (act === 'clipclear') {
        S.clip = null;
        S.pasteMode = false;
        render();
        return;
      }
      if (act === 'clearq') {
        S.q = '';
        const qIn = $('#q');
        if (qIn) qIn.value = '';
        render();
        return;
      }
      if (act === 'pend-ok') {
        openResched(a.dataset.key!);
        return;
      }
      if (act === 'pend-all') {
        const okN = suggestAll().filter((x: any) => !x.conflict).length;
        const v = await ask('Remarcar todas', `Remarcar ${okN} ${plural(okN, 'pendência', 'pendências')} para os horários sugeridos?`, [
          { label: 'Cancelar', value: null },
          { label: 'Remarcar todas', value: 'y', kind: 'btn-primary' }
        ]);
        if (!v) return;
        const sug = suggestAll();
        let n = 0;
        for (const x of sug) {
          const s: any = pendSug(x.o.key);
          if (s && !s.error) {
            applySug(s);
            n++;
          }
        }
        S.pendEdits = {};
        render();
        toast(`${n} ${plural(n, 'atividade remarcada', 'atividades remarcadas')} para a próxima semana.`);
        return;
      }
      if (act === 'pend-done') {
        const o = findOcc(a.dataset.key);
        if (o) {
          patchOcc(o, { status: 'concluida' }, { hist: `${o.rec ? fmtD(o.origDate) + ': ' : ''}marcada como concluída` });
          render();
          toast('Marcada como concluída.');
        }
        return;
      }
      if (act === 'pend-keep') {
        const o = findOcc(a.dataset.key);
        if (o) {
          patchOcc(o, { kept: true }, {});
          render();
          toast('Mantida no dia original. Ela continua como pendente.');
        }
        return;
      }
      if (act === 'wprev') {
        S.sumWeek = addY(S.sumWeek, -7);
        render();
        return;
      }
      if (act === 'wnext') {
        S.sumWeek = addY(S.sumWeek, 7);
        render();
        return;
      }
      if (act === 'wthis') {
        S.sumWeek = weekStart(todayY());
        render();
        return;
      }
      if (act === 'pdf') {
        downloadPDF();
        return;
      }
      if (act === 'copysum') {
        copyText(summaryText(S.sumWeek));
        return;
      }
      if (act === 'prop-ok') {
        applyProposal(a.dataset.pid!);
        return;
      }
      if (act === 'prop-no') {
        const p = S.chat.proposals.get(a.dataset.pid);
        if (p) {
          p.state = 'discarded';
          renderChat();
        }
        return;
      }
      if (act === 'readall') {
        S.notifs = S.notifs.map((n: any) => ({ ...n, read: true }));
        Store.write('notifs');
        updateHeader();
        renderPop();
        return;
      }
      if (act === 'notiftest') {
        const body = 'Teste: assim você será avisado das suas atividades no MacBook, iPhone e iPad.';
        notify('Lembrete', body, 'reminder');
        chime();
        showModal(
          `<div class="m-h"><svg class="i" viewBox="0 0 24 24" style="width:22px;height:22px"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg><h2>Lembrete</h2></div><div class="m-b"><p style="margin:0;font-size:17px">${esc(
            body
          )}</p></div><div class="m-f"><span class="sp"></span><button class="btn btn-primary" data-close>Ok</button></div>`,
          null,
          { cls: 'sm' }
        );
        return;
      }
      if (act === 'notifperm') {
        try {
          await Notification.requestPermission();
        } catch {}
        render();
        return;
      }
      if (act === 'webpush-enable') {
        try {
          S.webPush = await enableWebPush();
          toast('Notificações Push ativadas neste aparelho.');
        } catch (error: any) {
          toast(error?.message || 'Não foi possível ativar as notificações Push.', 'warn');
        }
        render();
        return;
      }
      if (act === 'webpush-disable') {
        try {
          S.webPush = await disableWebPush();
          toast('Notificações Push desativadas neste aparelho.');
        } catch (error: any) {
          toast(error?.message || 'Não foi possível desativar as notificações Push.', 'warn');
        }
        render();
        return;
      }
      if (act === 'webpush-test') {
        try {
          const sent = await testWebPush();
          toast(sent ? 'Teste enviado para este aparelho.' : 'Nenhum aparelho inscrito recebeu o teste.', sent ? undefined : 'warn');
        } catch (error: any) {
          toast(error?.response?.data?.error || 'Não foi possível enviar o teste Push.', 'warn');
        }
        return;
      }
      if (act === 'catadd') {
        const s = ensureSettings();
        const palette = ['#0EA5A4', '#C2410C', '#4D7C0F', '#7C3AED', '#BE185D', '#0369A1'];
        s.categories = [
          ...s.categories,
          { id: 'c_' + uid(), name: 'Nova categoria', color: palette[s.categories.length % palette.length] }
        ];
        saveSettings();
        return;
      }
      if (act === 'catdel') {
        const s = ensureSettings();
        const i = +a.dataset.i!;
        const c = s.categories[i];
        const used = [...S.items.values()].filter((it: any) => it.category === c.id).length;
        const v = await ask(
          'Remover categoria',
          used
            ? `“${c.name}” é usada por ${used} ${plural(used, 'atividade', 'atividades')}. Elas ficam sem categoria.`
            : `Remover “${c.name}”?`,
          [
            { label: 'Cancelar', value: null },
            { label: 'Remover', value: 'y', kind: 'btn-danger' }
          ]
        );
        if (!v) return;
        s.categories = s.categories.filter((_: any, j: number) => j !== i);
        saveSettings();
        return;
      }
      if (act === 'export') {
        const data = JSON.stringify(
          {
            app: 'agenda-inteligente',
            version: 1,
            exportedAt: new Date().toISOString(),
            settings: S.settings,
            items: [...S.items.values()],
            travels: [...S.travels.values()],
            people: [...S.people.values()]
          },
          null,
          2
        );
        triggerBrowserDownload(`agenda-copia-${todayY()}.json`, data);
        toast('Cópia de segurança salva.');
        return;
      }
      if (act === 'wipe') {
        const pwdOk = await askPassword(
          'Confirmação de segurança',
          'Para evitar exclusão acidental, digite a senha do sistema antes de prosseguir:'
        );
        if (!pwdOk) return;
        const v = await ask(
          'Apagar todas as atividades',
          `Isso apaga as ${S.items.size} atividades e seus anexos. Não dá para desfazer. Exporte uma cópia antes, se quiser guardar.`,
          [
            { label: 'Cancelar', value: null },
            { label: 'Apagar tudo', value: 'y', kind: 'btn-danger' }
          ]
        );
        if (!v) return;
        for (const id of [...S.items.keys()]) delItem(id);
        render();
        toast('Todas as atividades foram apagadas.');
        return;
      }
      return;
    }
    if (Date.now() - S.suppressClick < 350) return;
    const cell = t.closest('.m-cell') as HTMLElement | null;
    if (cell && !t.closest('.chip')) {
      const isTouchDevice = window.innerWidth <= 900 || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      if (isTouchDevice && S.touchLocked) return;
      openEditor(null, { date: cell.dataset.date, start: '09:00', end: '10:00' });
    }
  });

  document.addEventListener('mouseover', (e) => {
    const t = e.target as HTMLElement;
    S.hoverEl = t.closest ? (t.closest('.ev, .chip') as HTMLElement | null) : null;
  });

  document.addEventListener(
    'mousemove',
    (e) => {
      const t = e.target as HTMLElement;
      const col = t.closest ? (t.closest('.g-col') as HTMLElement | null) : null;
      S.hoverSlot = col && !t.closest('.ev') ? { date: col.dataset.date!, m: quarterAt(col, e.clientY) } : null;
    },
    { passive: true }
  );

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && ((e.key || '').toLowerCase() === 'z' || (e.key || '').toLowerCase() === 'y')) {
      const a = document.activeElement as HTMLElement | null;
      if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
      if ($('.overlay') || S.dragging || S.readOnly) return;
      e.preventDefault();
      if ((e.key || '').toLowerCase() === 'y' || e.shiftKey) Undo.doRedo();
      else Undo.doUndo();
      return;
    }
    const mod = (e.ctrlKey || e.metaKey) && !e.altKey;
    const k = (e.key || '').toLowerCase();
    const typing = () => {
      const a = document.activeElement as HTMLElement | null;
      return a && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
    };
    if (mod && k === 'c' && !typing() && !$('.overlay')) {
      const a = document.activeElement as HTMLElement | null;
      const el =
        a && a.matches && a.matches('.ev, .chip') ? a : S.hoverEl && S.hoverEl.isConnected ? S.hoverEl : null;
      const o = el && findOcc(el.dataset.key);
      if (o) {
        e.preventDefault();
        copyOcc(o, el);
      }
      return;
    }
    if (mod && k === 'v' && S.clip && !$('.overlay')) {
      if (quick && e.target === quick.inp && !quick.inp.value) {
        e.preventDefault();
        const q = quick;
        q.done = true;
        quick = null;
        q.el.remove();
        pasteAt(q.date, q.a);
        return;
      }
      if (!typing() && S.hoverSlot) {
        e.preventDefault();
        pasteAt(S.hoverSlot.date, S.hoverSlot.m);
      }
      return;
    }
    if (e.key === 'Escape' && S.pasteMode && !$('.overlay')) {
      S.pasteMode = false;
      render();
      return;
    }
    if (e.key === 'Escape') {
      if (S.popOpen) {
        S.popOpen = false;
        renderPop();
      } else closeModal();
      return;
    }
    const t = e.target as HTMLElement;
    if ((e.key === 'Enter' || e.key === ' ') && t.matches && t.matches('.ev, .chip')) {
      e.preventDefault();
      openEditor(t.dataset.key);
    }
    if (e.key === 'Enter' && !e.shiftKey && t.id === 'chat-in') {
      e.preventDefault();
      const inp = t as HTMLTextAreaElement;
      const v = inp.value;
      inp.value = '';
      sendChat(v);
    }
  });

  document.addEventListener('submit', (e) => {
    const t = e.target as HTMLElement;
    if (t.id === 'pe-form') {
      e.preventDefault();
      const name = $('#pe-name').value.trim();
      if (!name) {
        $('#pe-name').focus();
        return;
      }
      const pe = addPerson(S.peopleTab, {
        name: name.slice(0, 80),
        day: $('#pe-day').value,
        month: $('#pe-month').value,
        role: $('#pe-role') ? $('#pe-role').value.trim() : ''
      });
      if (pe) {
        render();
        toast(`${pe.name} salvo para ${pad(pe.day)}/${pad(pe.month)}.`);
        setTimeout(() => {
          const n = $('#pe-name');
          if (n) n.focus();
        }, 0);
      }
      return;
    }
    if (t.id === 'chat-form') {
      e.preventDefault();
      const i = $('#chat-in');
      const v = i.value;
      i.value = '';
      sendChat(v);
    }
  });

  document.addEventListener('change', async (e) => {
    const t = e.target as HTMLInputElement;
    if (t.closest('.overlay')) return;
    if (t.dataset.cat !== undefined) {
      t.checked ? S.hidden.delete(t.dataset.cat) : S.hidden.add(t.dataset.cat);
      render();
      return;
    }
    if (t.id === 'lrange') {
      S.listRange = t.value;
      render();
      return;
    }
    if (t.id === 'lstatus') {
      S.listStatus = t.value;
      render();
      return;
    }
    if (t.dataset.peF) {
      const pe = S.people.get(t.dataset.id);
      if (!pe) return;
      let v = t.value.trim();
      if (t.dataset.peF === 'whatsapp') v = v.replace(/\D/g, '');
      if (t.dataset.peF === 'name' && !v) {
        t.value = pe.name;
        return;
      }
      pe[t.dataset.peF] = v;
      Store.write(pe.id);
      t.blur();
      render();
      return;
    }
    if (t.dataset.pe) {
      const k = t.dataset.key!;
      S.pendEdits[k] = { ...(S.pendEdits[k] || {}), [t.dataset.pe]: t.value };
      return;
    }
    if (t.id === 's-ws' || t.id === 's-we') {
      const s = ensureSettings();
      const v = validT(t.value);
      if (!v) return;
      if (t.id === 's-ws') s.workStart = v;
      else s.workEnd = v;
      if (toMin(s.workEnd) <= toMin(s.workStart)) {
        toast('O fim do horário útil precisa ser depois do início.', 'warn');
        return;
      }
      saveSettings();
      return;
    }
    if (t.dataset.sday !== undefined) {
      const s = ensureSettings();
      const g = +t.dataset.sday;
      const set = new Set<number>(s.workDays);
      t.checked ? set.add(g) : set.delete(g);
      s.workDays = [...set].sort();
      saveSettings();
      return;
    }
    if (t.dataset.catcolor !== undefined) {
      const s = ensureSettings();
      s.categories = s.categories.map((c: any, i: number) => (i === +t.dataset.catcolor! ? { ...c, color: t.value } : c));
      saveSettings();
      return;
    }
    if (t.dataset.catname !== undefined) {
      const s = ensureSettings();
      const v = t.value.trim().slice(0, 40);
      if (!v) return;
      s.categories = s.categories.map((c: any, i: number) => (i === +t.dataset.catname! ? { ...c, name: v } : c));
      t.blur();
      saveSettings();
      return;
    }
    if (t.id === 'inp-avatar-upload' && t.files && t.files[0]) {
      const file = t.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          setPastorAvatar(dataUrl);
          const img = document.getElementById('avatar-preview-img') as HTMLImageElement;
          if (img) img.src = dataUrl;
          toast('Foto do Pastor atualizada com sucesso!');
        }
      };
      reader.readAsDataURL(file);
      t.value = '';
      return;
    }
    if (t.id === 'imp' && t.files && t.files[0]) {
      try {
        const o = JSON.parse(await t.files[0].text());
        const items = Array.isArray(o.items) ? o.items.filter((x: any) => x && x.id && x.title && validY(x.date)) : [];
        if (!items.length) throw new Error('empty');
        const v = await ask(
          'Importar cópia',
          `Importar ${items.length} ${plural(
            items.length,
            'atividade',
            'atividades'
          )}? Atividades com o mesmo código serão substituídas.`,
          [
            { label: 'Cancelar', value: null },
            { label: 'Importar', value: 'y', kind: 'btn-primary' }
          ]
        );
        if (v) {
          if (o.settings) {
            S.settings = normSettings(o.settings);
            Store.write('settings');
          }
          for (const it of items) putItem({ ...it, kind: 'activity' });
          for (const pe of Array.isArray(o.people) ? o.people : []) {
            if (pe && pe.id && pe.name) {
              S.people.set(pe.id, { ...pe, kind: 'person' });
              Store.write(pe.id);
            }
          }
          for (const tr of Array.isArray(o.travels) ? o.travels : []) {
            if (tr && tr.id && validY(tr.date) && validY(tr.endDate)) {
              S.travels.set(tr.id, { ...tr, kind: 'travel' });
              Store.write(tr.id);
            }
          }
          render();
          toast('Cópia importada.');
        }
      } catch {
        toast('Esse arquivo não é uma cópia de segurança da agenda.', 'warn');
      }
      t.value = '';
    }
  });

  document.addEventListener('focusout', () =>
    setTimeout(() => {
      if (!S.pendingRender || S.dragging) return;
      const a = document.activeElement;
      const m = $('#main');
      if (a && m && m.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
      render();
    }, 0)
  );

  window.addEventListener('hashchange', () => {
    const h = location.hash.slice(1);
    if (h && h !== S.tab && TABS.some((x) => x[0] === h)) setTab(h);
  });

  setInterval(() => {
    if (todayY() !== S.lastDay) {
      S.lastDay = todayY();
      scheduleRender();
    } else if (S.tab === 'agenda' && !S.dragging) {
      const nl = $('.nowline');
      if (nl) nl.style.top = ((nowMin() - HOUR_START * 60) / 60) * PPH + 'px';
    }
    checkReminders(showModal);
  }, 30000);
}
