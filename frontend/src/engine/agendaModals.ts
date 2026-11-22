import {
  MONTHS,
  REMINDERS,
  STATUS,
  WD,
  addY,
  clone,
  dayDiff,
  dow,
  esc,
  fmtD,
  fmtDL,
  fmtDW,
  fmtDur,
  fmtH,
  fromMin,
  ic,
  nowMin,
  parse,
  plural,
  safeColor,
  todayY,
  toMin,
  triggerBrowserDownload,
  uid,
  validT,
  validY,
  weekStart,
  ymd
} from './agendaHelpers';
import {
  S,
  ST,
  Store,
  activeOn,
  cat,
  ensureSettings,
  findOcc,
  isRec,
  maybeDeleteAsset,
  overlaps,
  parentKey,
  suggestAll,
  travelSegs,
  travelText
} from './agendaCore';
import { FileStore, compressImage, renderPdf, toast } from './agendaStorage';
import {
  $,
  $$,
  PTYPES,
  applySug,
  delItem,
  peopleOn,
  putItem,
  render,
  scheduleRender,
  setTab,
  waLink,
  warnConflicts
} from './agendaRenderers';

export function showModal(html: string, bind?: ((w: HTMLElement) => void) | null, opts: any = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.innerHTML = `<div class="modal ${opts.cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
  const root = $('#modal-root');
  if (root) root.appendChild(wrap);
  wrap.addEventListener('mousedown', (e) => {
    if (e.target === wrap) closeModal(wrap);
  });
  (wrap as any)._onClose = opts.onClose;
  if (bind) bind(wrap);
  const f = wrap.querySelector('[autofocus]') as HTMLElement | null;
  if (f) f.focus();
  return wrap;
}

export function closeModal(w?: HTMLElement | null) {
  const root = $('#modal-root');
  w = w || (root && root.lastElementChild);
  if (!w) return;
  if ((w as any)._onClose) (w as any)._onClose();
  w.remove();
  if (S.pendingRender) render();
}

export function ask(title: string, text: string, buttons: Array<{ label: string; value: any; kind?: string }>) {
  return new Promise<any>((res) => {
    let done = false;
    const w = showModal(
      `<div class="m-h"><h2>${esc(title)}</h2></div><div class="m-b"><p style="margin:0">${esc(
        text
      )}</p></div><div class="m-f"><span class="sp"></span>${buttons
        .map((b, i) => `<button class="btn ${b.kind || ''}" data-ans="${i}">${esc(b.label)}</button>`)
        .join('')}</div>`,
      (wEl) =>
        wEl.addEventListener('click', (e) => {
          const b = (e.target as HTMLElement).closest('[data-ans]') as HTMLElement | null;
          if (!b) return;
          done = true;
          const v = buttons[+b.dataset.ans!].value;
          closeModal(wEl);
          res(v);
        }),
      {
        cls: 'sm',
        onClose: () => {
          if (!done) res(null);
        }
      }
    );
    return w;
  });
}

export function blankItem(p: any = {}) {
  const d = p.date || S.cursor || todayY();
  let s = p.start;
  if (!s) s = d === todayY() ? fromMin(Math.min(22 * 60, Math.ceil((nowMin() + 1) / 30) * 30)) : '09:00';
  const e = p.end || fromMin(Math.min(1439, toMin(s) + 60));
  return {
    id: 'a_' + uid(),
    kind: 'activity',
    title: p.title || '',
    date: d,
    start: s,
    end: e,
    status: 'planejada',
    category: (ST().categories[0] || {}).id || '',
    priority: 'media',
    recur: p.recur || { freq: 'none' },
    reminder: 30,
    fixed: false,
    deadline: '',
    autoResched: true,
    notes: '',
    links: [],
    files: [],
    history: [],
    overrides: {},
    createdAt: Date.now()
  };
}

export function copyOcc(o: any, el?: HTMLElement | null) {
  if (o.isSub) {
    toast('Para copiar, use a atividade principal desta subtarefa.');
    return;
  }
  const it = o.item;
  let days = 1;
  if (el && el.dataset.span) days = dayDiff(el.dataset.first!, el.dataset.last!) + 1;
  else if (it.span && isRec(it) && it.recur.freq === 'daily' && it.recur.until) days = dayDiff(it.date, it.recur.until) + 1;
  S.clip = {
    title: it.title,
    category: it.category,
    priority: it.priority || 'media',
    notes: it.notes || '',
    subtasks: (it.subtasks || []).map((x: any) => ({ id: uid(), text: x.text, done: false, dur: x.dur || 30 })),
    links: clone(it.links || []),
    files: clone(it.files || []),
    reminder: it.reminder ?? 30,
    fixed: !!it.fixed,
    dur: Math.max(15, toMin(o.end) - toMin(o.start)),
    days
  };
  render();
  toast(
    `Copiado: “${it.title}”${days > 1 ? `, ${days} dias` : ''}, ${fmtDur(
      S.clip.dur
    )}. Aponte para uma linha e tecle ⌘+V / Ctrl+V, ou use o botão Colar.`
  );
}

export function openTravel(id?: string | null, preset: any = {}) {
  if (!id && S.readOnly) {
    toast('Esta agenda está disponível só para leitura.');
    return;
  }
  const tr = id ? S.travels.get(id) : null;
  if (id && !tr) return;
  const v = tr
    ? clone(tr)
    : {
        id: 't_' + uid(),
        kind: 'travel',
        title: preset.title || '',
        date: preset.date || todayY(),
        start: preset.start || '08:00',
        endDate: addY(preset.date || todayY(), 1),
        end: '18:00',
        notes: ''
      };
  const ro = S.readOnly;
  showModal(
    `<form id="trform" novalidate><div class="m-h"><svg class="i" viewBox="0 0 24 24" style="width:20px;height:20px"><path d="M2.5 19.5h19M3.6 13.4l3.1 2.9 13-4.4c1.2-.4 1.6-1.6.9-2.4-.5-.6-1.4-.8-2.2-.5L14.6 10.4 7.9 6.5l-1.7.6 4.1 5-4 1.3-1.7-1.3z"/></svg><input class="title" id="tr-title" placeholder="Destino da viagem" value="${esc(
      v.title
    )}" ${tr ? '' : 'autofocus'} aria-label="Destino da viagem" ${ro ? 'readonly' : ''}></div>
    <div class="m-b">
      ${
        !tr
          ? `<div class="seg kind-seg" role="group"><button type="button" data-act="to-activity" aria-pressed="false">Atividade</button><button type="button" data-act="to-study" aria-pressed="false">Estudos</button><button type="button" aria-pressed="true">Viagem</button></div>`
          : ''
      }
      <p class="note" style="margin:0">O período fica sombreado na agenda, do momento da saída até a volta. Você continua podendo marcar atividades por cima.</p>
      <div class="form-grid"><label class="field" for="tr-d1">Saída: dia<input type="date" id="tr-d1" value="${
        v.date
      }"></label><label class="field" for="tr-t1">Saída: hora<input type="time" id="tr-t1" value="${v.start}" step="300"></label></div>
      <div class="form-grid"><label class="field" for="tr-d2">Retorno: dia<input type="date" id="tr-d2" value="${
        v.endDate
      }"></label><label class="field" for="tr-t2">Retorno: hora<input type="time" id="tr-t2" value="${v.end}" step="300"></label></div>
      <label class="field" for="tr-notes">Anotações<textarea id="tr-notes" rows="3" placeholder="Voo, hotel, contatos…">${esc(
        v.notes || ''
      )}</textarea></label>
      <div class="err-msg" id="tr-err" role="alert"></div>
    </div>
    <div class="m-f">${
      tr && !ro ? '<button type="button" class="btn btn-danger btn-sm" data-act="tr-del">Apagar viagem</button>' : ''
    }<span class="sp"></span><button type="button" class="btn" data-close>Cancelar</button>${
      ro ? '' : `<button type="submit" class="btn btn-primary">${tr ? 'Salvar' : 'Sombrear período'}</button>`
    }</div></form>`,
    (w) => {
      w.addEventListener('click', async (e) => {
        const b = (e.target as HTMLElement).closest('button');
        if (!b) return;
        if (b.dataset.act === 'to-activity') {
          const p = {
            date: $('#tr-d1', w).value || v.date,
            start: $('#tr-t1', w).value || '09:00',
            title: $('#tr-title', w).value
          };
          closeModal(w);
          openEditor(null, p);
        }
        if (b.dataset.act === 'to-study') {
          const p = {
            date: ($('#tr-d1', w) as HTMLInputElement)?.value || v.date,
            start: ($('#tr-t1', w) as HTMLInputElement)?.value || '09:00',
            title: ($('#tr-title', w) as HTMLInputElement)?.value,
            notes: ($('#tr-notes', w) as HTMLTextAreaElement)?.value
          };
          closeModal(w);
          openStudy(null, p);
        }
        if (b.dataset.act === 'tr-del') {
          const ok = await ask('Apagar viagem', `Apagar a viagem “${v.title || 'Viagem'}” e tirar o sombreamento?`, [
            { label: 'Cancelar', value: null },
            { label: 'Apagar', value: 'y', kind: 'btn-danger' }
          ]);
          if (!ok) return;
          S.travels.delete(v.id);
          Store.write(v.id);
          closeModal(w);
          render();
          toast('Viagem apagada.');
        }
      });
      $('#trform', w).addEventListener('submit', (e: Event) => {
        e.preventDefault();
        const d1 = validY($('#tr-d1', w).value);
        const t1 = validT($('#tr-t1', w).value);
        const d2 = validY($('#tr-d2', w).value);
        const t2 = validT($('#tr-t2', w).value);
        const err = $('#tr-err', w);
        if (!d1 || !t1 || !d2 || !t2) {
          err.textContent = 'Preencha o dia e a hora da saída e do retorno.';
          return;
        }
        if (d2 + t2 <= d1 + t1) {
          err.textContent = 'O retorno precisa ser depois da saída.';
          return;
        }
        Object.assign(v, {
          title: $('#tr-title', w).value.trim().slice(0, 120),
          date: d1,
          start: t1,
          endDate: d2,
          end: t2,
          notes: $('#tr-notes', w).value,
          kind: 'travel',
          updatedAt: Date.now()
        });
        S.travels.set(v.id, v);
        Store.write(v.id);
        closeModal(w);
        render();
        toast(`Período sombreado: ${travelText(v)}.`);
      });
    }
  );
}

export function openStudy(id?: string | null, preset: any = {}) {
  if (S.readOnly) {
    toast('Esta agenda está disponível só para leitura.');
    return;
  }
  const v = {
    title: preset.title || '',
    date: preset.date || todayY(),
    start: preset.start || '09:00',
    end: preset.end || fromMin(Math.min(1439, toMin(preset.start || '09:00') + 60)),
    notes: preset.notes || '',
    revTime: preset.start || '09:00',
    revDur: 30
  };

  const intervals = [
    { step: 1, days: 1, label: '1ª Revisão', desc: 'Amanhã (+1 dia)', active: true },
    { step: 2, days: 3, label: '2ª Revisão', desc: 'Daqui a 3 dias (+3 dias)', active: true },
    { step: 3, days: 7, label: '3ª Revisão', desc: 'Daqui a 7 dias (+7 dias)', active: true },
    { step: 4, days: 14, label: '4ª Revisão', desc: 'Daqui a 14 dias (+14 dias)', active: true },
    { step: 5, days: 30, label: '5ª Revisão', desc: 'Daqui a 30 dias (+30 dias)', active: true }
  ];

  const renderRevRows = () => {
    return intervals
      .map((it, idx) => {
        const targetDate = addY(v.date, it.days);
        const targetFormatted = fmtDW(targetDate);
        return `<div class="st-rev-row" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 12px;border:1px solid var(--line);border-radius:9px;background:${
          it.active ? 'var(--surface)' : 'transparent'
        };opacity:${it.active ? '1' : '0.55'};transition:all 0.15s">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;user-select:none">
            <input type="checkbox" class="st-rev-check" data-idx="${idx}" ${it.active ? 'checked' : ''} style="accent-color:#8B5CF6;width:16px;height:16px">
            <div>
              <span style="font-weight:700;font-size:13.5px;color:var(--ink)">${it.label}</span>
              <span class="muted small" style="margin-left:6px">${it.desc}</span>
            </div>
          </label>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12.5px;font-weight:600;color:#8B5CF6">${targetFormatted}</span>
          </div>
        </div>`;
      })
      .join('');
  };

  showModal(
    `<form id="studyform" novalidate>
      <div class="m-h">
        <span class="dot" style="--c:#8B5CF6;width:14px;height:14px"></span>
        <input class="title" id="st-title" placeholder="Tema ou assunto do estudo (ex: As 70 Semanas, Anatomia…)" value="${esc(
          v.title
        )}" autofocus aria-label="Tema do estudo">
      </div>
      <div class="m-b">
        <div class="seg kind-seg" role="group">
          <button type="button" data-act="to-activity" aria-pressed="false">Atividade</button>
          <button type="button" aria-pressed="true">Estudos</button>
          <button type="button" data-act="to-travel" aria-pressed="false">Viagem</button>
        </div>
        <p class="note" style="margin:0">Cadastre a sessão de estudos. A agenda calculará e agendará automaticamente todas as <b>sessões de revisão espaçada</b> para fixação definitiva na memória.</p>
        
        <div class="row3">
          <label class="field" for="st-date">Data do estudo<input type="date" id="st-date" value="${v.date}" required></label>
          <label class="field" for="st-start">Início<input type="time" id="st-start" value="${v.start}" step="300"></label>
          <label class="field" for="st-end">Fim<input type="time" id="st-end" value="${v.end}" step="300"></label>
          <label class="field" for="st-dur">Duração<select id="st-dur">${durOptions(toMin(v.end) - toMin(v.start))}</select></label>
        </div>

        <div class="spaced-rep-box" style="margin-top:12px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:14px 16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:18px;">🧠</span>
              <span style="font-weight:700;font-size:14px;color:var(--ink)">Revisões Espaçadas Automáticas</span>
            </div>
            <span class="muted small" style="font-weight:600">Curva de Fixação</span>
          </div>
          <p class="note" style="margin:0 0 10px 0;font-size:12px">Marque as revisões programadas. As datas são calculadas automaticamente a partir do dia estudado:</p>
          
          <div class="spaced-rep-list" id="st-rev-list" style="display:grid;gap:6px;">
            ${renderRevRows()}
          </div>

          <div style="display:flex;align-items:center;gap:12px;margin-top:12px;padding-top:10px;border-top:1px dashed var(--line);flex-wrap:wrap;">
            <label class="field" for="st-rev-time" style="margin:0;flex:1 1 170px">Horário das revisões
              <input type="time" id="st-rev-time" value="${v.revTime}" step="300">
            </label>
            <label class="field" for="st-rev-dur" style="margin:0;flex:1 1 170px">Duração de cada revisão
              <select id="st-rev-dur">
                <option value="15">15 minutos (Rápida)</option>
                <option value="30" selected>30 minutos (Padrão)</option>
                <option value="45">45 minutos</option>
                <option value="60">1 hora (Completa)</option>
              </select>
            </label>
          </div>
        </div>

        <label class="field" for="st-notes" style="margin-top:12px">Anotações do estudo / Resumo<textarea id="st-notes" rows="3" placeholder="Resumo do conteúdo, tópicos das 70 semanas, versículos, referências ou páginas para rever…">${esc(
          v.notes || ''
        )}</textarea></label>
        <div class="err-msg" id="st-err" role="alert"></div>
      </div>
      <div class="m-f">
        <span class="sp"></span>
        <button type="button" class="btn" data-close>Cancelar</button>
        <button type="submit" class="btn btn-primary" style="background:#7C3AED;border-color:#6D28D9;color:#fff">Agendar Estudo e Revisões</button>
      </div>
    </form>`,
    (w) => {
      const updateRevList = () => {
        const box = $('#st-rev-list', w);
        if (box) box.innerHTML = renderRevRows();
      };

      const syncDur = () => {
        const sel = $('#st-dur', w);
        if (sel) sel.innerHTML = durOptions(toMin(v.end) - toMin(v.start));
      };

      w.addEventListener('input', (e: Event) => {
        const t = e.target as HTMLInputElement;
        if (t.id === 'st-title') v.title = t.value;
        else if (t.id === 'st-date') {
          v.date = t.value;
          updateRevList();
        } else if (t.id === 'st-start') {
          const dur = toMin(v.end) - toMin(v.start);
          v.start = t.value;
          if (dur > 0 && t.value) {
            v.end = fromMin(Math.min(1439, toMin(t.value) + dur));
            const endEl = $('#st-end', w) as HTMLInputElement | null;
            if (endEl) endEl.value = v.end;
          }
          syncDur();
        } else if (t.id === 'st-end') {
          v.end = t.value;
          syncDur();
        } else if (t.id === 'st-notes') {
          v.notes = t.value;
        } else if (t.id === 'st-rev-time') {
          v.revTime = t.value;
        }
      });

      w.addEventListener('change', (e: Event) => {
        const t = e.target as HTMLInputElement;
        if (t.id === 'st-dur') {
          if (t.value) {
            v.end = fromMin(Math.min(1439, toMin(v.start) + +t.value));
            const endEl = $('#st-end', w) as HTMLInputElement | null;
            if (endEl) endEl.value = v.end;
            syncDur();
          }
        } else if (t.id === 'st-rev-dur') {
          v.revDur = +t.value || 30;
        } else if (t.classList.contains('st-rev-check')) {
          const idx = +t.dataset.idx!;
          if (intervals[idx]) {
            intervals[idx].active = t.checked;
            updateRevList();
          }
        }
      });

      w.addEventListener('click', (e: MouseEvent) => {
        const b = (e.target as HTMLElement).closest('button');
        if (!b) return;
        if (b.dataset.act === 'to-activity') {
          const p = {
            date: ($('#st-date', w) as HTMLInputElement)?.value || v.date,
            start: ($('#st-start', w) as HTMLInputElement)?.value || v.start,
            end: ($('#st-end', w) as HTMLInputElement)?.value || v.end,
            title: ($('#st-title', w) as HTMLInputElement)?.value,
            notes: ($('#st-notes', w) as HTMLTextAreaElement)?.value
          };
          closeModal(w);
          openEditor(null, p);
        } else if (b.dataset.act === 'to-travel') {
          const p = {
            date: ($('#st-date', w) as HTMLInputElement)?.value || v.date,
            start: ($('#st-start', w) as HTMLInputElement)?.value || v.start,
            title: ($('#st-title', w) as HTMLInputElement)?.value,
            notes: ($('#st-notes', w) as HTMLTextAreaElement)?.value
          };
          closeModal(w);
          openTravel(null, p);
        }
      });

      $('#studyform', w).addEventListener('submit', (e: Event) => {
        e.preventDefault();
        const err = $('#st-err', w);
        const title = ($('#st-title', w) as HTMLInputElement).value.trim();
        const date = validY(($('#st-date', w) as HTMLInputElement).value);
        const start = validT(($('#st-start', w) as HTMLInputElement).value);
        const end = validT(($('#st-end', w) as HTMLInputElement).value);
        const notes = ($('#st-notes', w) as HTMLTextAreaElement).value.trim();

        if (!title) {
          err.textContent = 'Informe o tema ou assunto do estudo (ex: As 70 Semanas).';
          $('#st-title', w).focus();
          return;
        }
        if (!date || !start || !end) {
          err.textContent = 'Preencha a data e os horários do estudo.';
          return;
        }
        if (toMin(end) <= toMin(start)) {
          err.textContent = 'O horário de fim precisa ser posterior ao de início.';
          return;
        }

        const activeRev = intervals.filter((x) => x.active);
        const mainId = 's_' + uid();
        const cleanTitle = title.toLowerCase().startsWith('estudo') ? title : `Estudo: ${title}`;

        // Atividade Principal do Estudo
        const mainItem = {
          id: mainId,
          kind: 'activity',
          title: cleanTitle,
          date,
          start,
          end,
          category: 'estudos',
          priority: 'alta',
          status: 'planejada',
          notes: [
            notes,
            '',
            '🧠 Sessão de Estudo com Revisão Espaçada:',
            ...activeRev.map((r) => `• ${r.label} (${r.desc}): ${fmtDW(addY(date, r.days))}`)
          ]
            .filter(Boolean)
            .join('\n'),
          recur: { freq: 'none' },
          reminder: 15,
          fixed: false,
          autoResched: true,
          subtasks: [],
          links: [],
          files: [],
          history: [{ at: Date.now(), text: 'Sessão de estudos criada com Revisão Espaçada' }]
        };
        putItem(mainItem);

        // Atividades de cada Revisão Espaçada
        const revTime = validT(($('#st-rev-time', w) as HTMLInputElement).value) || start;
        const revDur = v.revDur || 30;
        const revEnd = fromMin(Math.min(1439, toMin(revTime) + revDur));

        activeRev.forEach((rev, i) => {
          const revDate = addY(date, rev.days);
          const revId = 's_rev_' + uid();
          const revItem = {
            id: revId,
            kind: 'activity',
            title: `Revisão ${i + 1}/${activeRev.length}: ${title}`,
            date: revDate,
            start: revTime,
            end: revEnd,
            category: 'estudos',
            priority: 'media',
            status: 'planejada',
            notes: [
              `🧠 Revisão Espaçada (${rev.label} · ${rev.desc})`,
              `Assunto original: ${cleanTitle}`,
              `Estudado em: ${fmtDL(date)}`,
              notes ? `\nAnotações do estudo original:\n${notes}` : ''
            ]
              .filter(Boolean)
              .join('\n'),
            recur: { freq: 'none' },
            reminder: 15,
            fixed: false,
            autoResched: true,
            subtasks: [],
            links: [],
            files: [],
            history: [{ at: Date.now(), text: `Revisão agendada (${rev.desc}) para fixação na memória` }]
          };
          putItem(revItem);
        });

        closeModal(w);
        render();
        toast(`Estudo "${title}" e ${activeRev.length} revisões agendadas com sucesso!`);
      });
    }
  );
}

export function openPeopleDay(d: string, type: string) {
  const list = peopleOn(d)[type] || [];
  showModal(
    `<div class="m-h"><span class="dot" style="--c:${safeColor(
      cat(PTYPES[type].cat).color
    )};width:14px;height:14px"></span><h2>${PTYPES[type].label} · ${fmtDL(d)}</h2></div>
    <div class="m-b">${
      list.length
        ? `<ul class="simple plist">${list
            .map(
              (pe) =>
                `<li><span><span class="pname">${esc(pe.name)}</span>${
                  pe.role ? ` <span class="muted small">· ${esc(pe.role)}</span>` : ''
                }</span><a class="btn btn-sm" target="_blank" rel="noopener" href="${esc(
                  waLink(pe)
                )}" title="Abre o WhatsApp com a mensagem pronta; escolha o contato na sua lista">${ic(
                  'wa',
                  16
                )} Enviar WhatsApp</a></li>`
            )
            .join('')}</ul>`
        : '<p class="muted">Ninguém nesta data.</p>'
    }</div>
    <div class="m-f"><button class="btn btn-sm" data-close data-tab="datas">Editar lista</button><span class="sp"></span><button class="btn" data-close>Fechar</button></div>`,
    null,
    { cls: 'sm' }
  );
}

const DURS = [5, 10, 15, 30, 45, 60, ...Array.from({ length: 22 }, (_, i) => 90 + i * 30)];
export function durOptions(cur: number) {
  const has = DURS.includes(cur);
  return (
    (has ? '' : `<option value="" selected>${cur > 0 ? fmtDur(cur) + ' (personalizado)' : 'Personalizado'}</option>`) +
    DURS.map((m) => `<option value="${m}" ${m === cur ? 'selected' : ''}>${fmtDur(m)}</option>`).join('')
  );
}

export function openEditor(key?: string | null, preset: any = {}) {
  if (Date.now() - S.suppressClick < 350) return;
  if (key && key.startsWith('sub:')) {
    const so = findOcc(key);
    if (!so) return;
    key = parentKey(so.item);
  }
  if (!key && S.readOnly) {
    toast('Esta agenda está disponível só para leitura.');
    return;
  }
  const o = key ? findOcc(key) : null;
  if (key && !o) return;
  const base = o ? clone(o.item) : blankItem(preset);
  const d = {
    title: base.title || '',
    date: o ? o.date : base.date,
    start: o ? o.start : base.start,
    end: o ? o.end : base.end,
    status: o ? o.status : base.status,
    category: base.category,
    priority: base.priority || 'media',
    recur: clone(base.recur || { freq: 'none' }),
    reminder: +base.reminder || 0,
    fixed: !!base.fixed,
    deadline: base.deadline || '',
    autoResched: base.autoResched !== false,
    notes: base.notes || '',
    subtasks: clone(base.subtasks || []),
    links: clone(base.links || []),
    files: clone(base.files || []),
    scope: 'one'
  };
  const ed = { o, base, rec: !!o && o.rec, d, newUploads: [] as string[], removed: [] as string[], saved: false, pickMonth: '' };
  showModal(
    `<form id="edform" novalidate>${editorInner(ed)}</form>`,
    (w) => bindEditor(w, ed),
    {
      onClose: () => {
        if (!ed.saved) ed.newUploads.forEach(maybeDeleteAsset);
      }
    }
  );
}

function editorInner(ed: any) {
  const d = ed.d;
  const ro = S.readOnly;
  const catOpts = ST()
    .categories.map((c: any) => `<option value="${esc(c.id)}" ${c.id === d.category ? 'selected' : ''}>${esc(c.name)}</option>`)
    .join('');
  const seg = (name: string, val: string, opts: Array<[string, string]>) =>
    `<div class="seg" role="group">${opts
      .map(([v, l]) => `<button type="button" data-seg="${name}" data-val="${v}" aria-pressed="${v === val}">${l}</button>`)
      .join('')}</div>`;
  const freq = d.recur.freq || 'none';
  const days = [0, 1, 2, 3, 4, 5, 6]
    .map((g) => `<label><input type="checkbox" data-wday="${g}" ${(d.recur.days || []).includes(g) ? 'checked' : ''}>${WD[g]}</label>`)
    .join('');
  const hist = (ed.base.history || []).slice().reverse().slice(0, 8);
  const isNew = !ed.o;
  const moved = ed.o && ed.o.status === 'reagendada';
  const share = `<span class="share"><a class="btn btn-sm" data-share="wa" target="_blank" rel="noopener" href="https://wa.me/">${ic(
    'wa',
    16
  )} WhatsApp</a><a class="btn btn-sm" data-share="mail" target="_blank" rel="noopener" href="mailto:">${ic(
    'mail',
    16
  )} E-mail</a><a class="btn btn-sm" data-share="gcal" target="_blank" rel="noopener" href="https://calendar.google.com/" title="Leva o compromisso para o Google Agenda">${ic(
    'gcal',
    16
  )} Google Agenda</a></span>`;
  return `<div class="m-h"><span class="dot" id="ed-dot" style="--c:${safeColor(
    cat(d.category).color
  )};width:14px;height:14px"></span><input class="title" id="ed-title" placeholder="Nome da atividade" value="${esc(
    d.title
  )}" ${isNew ? 'autofocus' : ''} aria-label="Nome da atividade"></div>
  <div class="m-b">
    ${
      isNew
        ? `<div class="seg kind-seg" role="group"><button type="button" aria-pressed="true">Atividade</button><button type="button" data-act="to-study" aria-pressed="false">Estudos</button><button type="button" data-act="to-travel" aria-pressed="false">Viagem</button></div>`
        : ''
    }
    ${
      ed.rec
        ? `<div class="info">Atividade que se repete. Status e data valem só para ${fmtDL(
            ed.o.origDate
          )}; os demais campos valem para todas as repetições.</div>`
        : ''
    }
    ${
      moved
        ? `<div class="info">Esta repetição não foi concluída e foi remarcada.${
            ed.base.overrides && ed.base.overrides[ed.o.origDate] && S.items.get(ed.base.overrides[ed.o.origDate].movedTo)
              ? ` <button type="button" class="btn btn-sm" data-act="open-moved">Abrir a nova data</button>`
              : ''
          }</div>`
        : ''
    }
    <div class="row3">
      <label class="field" for="ed-date">${ed.rec ? 'Data deste dia' : 'Data'}<input type="date" id="ed-date" value="${d.date}" required></label>
      <label class="field" for="ed-start">Início<input type="time" id="ed-start" value="${d.start}" step="300"></label>
      <label class="field" for="ed-end">Fim<input type="time" id="ed-end" value="${d.end}" step="300"></label>
      <label class="field" for="ed-dur">Tempo da atividade<select id="ed-dur">${durOptions(toMin(d.end) - toMin(d.start))}</select></label>
    </div>
    ${
      ed.rec
        ? `<div class="check" style="gap:14px"><label class="check"><input type="radio" name="scope" value="one" checked> Horário só neste dia</label><label class="check"><input type="radio" name="scope" value="series"> Horário em todas as repetições</label></div>`
        : ''
    }
    <div id="ed-conflict"></div>
    <div class="form-grid">
      <label class="field" for="ed-cat">Categoria<select id="ed-cat">${catOpts}</select></label>
      <div class="field">Prioridade${seg('priority', d.priority, [
        ['alta', 'Alta'],
        ['media', 'Média'],
        ['baixa', 'Baixa']
      ])}</div>
    </div>
    <div class="field">Status${seg('status', d.status === 'reagendada' ? '' : d.status, [
      ['planejada', 'Planejada'],
      ['concluida', 'Concluída'],
      ['pendente', 'Pendente'],
      ['cancelada', 'Cancelada']
    ])}</div>
    <div class="form-grid">
      <label class="field" for="ed-freq">Repetir<select id="ed-freq">${[
        ['none', 'Não repete'],
        ['daily', 'Todos os dias'],
        ['weekdays', 'Dias úteis (seg a sex)'],
        ['weekly', 'Toda semana'],
        ['monthly', 'Todo mês'],
        ['custom', 'Dias escolhidos no calendário']
      ]
        .map(([v, l]) => `<option value="${v}" ${v === freq ? 'selected' : ''}>${l}</option>`)
        .join('')}</select></label>
      <label class="field" for="ed-rem">Lembrete<select id="ed-rem">${REMINDERS.map(
        ([v, l]) => `<option value="${v}" ${v === d.reminder ? 'selected' : ''}>${l}</option>`
      ).join('')}</select></label>
    </div>
    <div id="ed-recur" ${freq === 'none' || freq === 'custom' ? 'hidden' : ''} class="form-grid">
      <div class="field" id="ed-days" ${freq === 'weekly' ? '' : 'hidden'}>Dias da semana<div class="days">${days}</div></div>
      <label class="field" for="ed-until" id="ed-untilwrap" ${
        freq === 'custom' ? 'hidden' : ''
      }>Repetir até (opcional)<input type="date" id="ed-until" value="${esc(d.recur.until || '')}"></label>
    </div>
    <div class="field" id="ed-cal" ${
      freq === 'custom' ? '' : 'hidden'
    }>Clique nos dias em que a atividade acontece<div class="pick-wrap" id="ed-pick"></div></div>
    <div class="form-grid">
      <label class="check"><input type="checkbox" id="ed-fixed" ${d.fixed ? 'checked' : ''}> Tem prazo fixo</label>
      <label class="field" for="ed-deadline" id="ed-dlwrap" ${
        d.fixed ? '' : 'hidden'
      }>Prazo final<input type="date" id="ed-deadline" value="${esc(d.deadline)}"></label>
    </div>
    <label class="check"><input type="checkbox" id="ed-auto" ${
      d.autoResched ? 'checked' : ''
    }> Se não for concluída, remarcar para a próxima semana</label>
    <div class="sect"><h3>Subtarefas</h3><div class="subs" id="ed-subs"></div>${
      ro
        ? ''
        : `<div class="addlink" style="grid-template-columns:1fr auto"><input class="inp" id="sub-new" placeholder="Nova subtarefa (Enter adiciona)" aria-label="Nova subtarefa"><button type="button" class="btn btn-sm" data-act="addsub">Adicionar</button></div>`
    }</div>
    <label class="field" for="ed-notes">Anotações<textarea id="ed-notes" rows="3" placeholder="Pauta, detalhes, o que levar…">${esc(
      d.notes
    )}</textarea></label>
    <div class="sect"><h3>Arquivos e links</h3><div id="ed-att"></div>
      ${
        !ro
          ? `<div class="actions"><label class="btn btn-sm">${ic(
              'clip',
              16
            )} Anexar PDF<input type="file" id="ed-file" multiple hidden accept="application/pdf,.pdf,text/plain,.txt"></label><label class="btn btn-sm">${ic(
              'clip',
              16
            )} Anexar fotos<input type="file" id="ed-file2" multiple hidden accept="image/*"></label><label class="btn btn-sm">${ic(
              'clip',
              16
            )} Anexar vídeo<input type="file" id="ed-file3" multiple hidden accept="video/mp4,video/webm,video/quicktime"></label></div><p class="note">PDF, fotos e vídeos até 20 MB cada.</p>`
          : ''
      }
      <div class="addlink"><input class="inp" id="ln-url" placeholder="Link do YouTube, site, reunião…" aria-label="Endereço do link"><input class="inp" id="ln-label" placeholder="Nome (opcional)" aria-label="Nome do link"><button type="button" class="btn btn-sm" data-act="addlink">Adicionar</button></div>
    </div>
    ${
      hist.length
        ? `<div class="sect"><h3>Histórico</h3><ul class="hist">${hist
            .map((h: any) => `<li>${esc(h.text)} <span class="num">· ${new Date(h.at).toLocaleDateString('pt-BR')}</span></li>`)
            .join('')}</ul></div>`
        : ''
    }
    <div class="err-msg" id="ed-err" role="alert"></div>
  </div>
  <div class="m-f">${
    !isNew && !ro ? `<button type="button" class="btn btn-danger btn-sm" data-act="del">Apagar</button>` : ''
  }${
    !isNew ? `<button type="button" class="btn btn-sm" data-act="copy-ed">${ic('copy', 16)} Copiar</button>` : ''
  }${share}<span class="sp"></span><button type="button" class="btn" data-close>Cancelar</button>${
    ro ? '' : `<button type="submit" class="btn btn-primary">${isNew ? 'Criar atividade' : 'Salvar'}</button>`
  }</div>`;
}

const isYT = (u?: string) => /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(u || '');
function subsHTML(ed: any) {
  const ro = S.readOnly;
  const subs = ed.d.subtasks;
  const n = subs.length;
  const dis = ro ? 'disabled' : '';
  if (!n) {
    return '<p class="note" style="margin:0">Divida a atividade em passos menores. Coloque dia, hora e tempo em cada um para ele aparecer na agenda como 1/5, 2/5…</p>';
  }
  return (
    subs
      .map(
        (x: any, i: number) =>
          `<div class="sub ${x.done ? 'done' : ''}"><input type="checkbox" data-sub-done="${i}" ${
            x.done ? 'checked' : ''
          } ${dis} aria-label="Feita"><span class="subno">${i + 1}/${n}</span><input class="inp sub-txt" data-sub-text="${i}" value="${esc(
            x.text
          )}" ${
            ro ? 'readonly' : ''
          } aria-label="Subtarefa ${i + 1}"><input type="date" class="inp sub-date" data-sub-date="${i}" value="${esc(
            x.date || ''
          )}" ${dis} aria-label="Dia da subtarefa ${i + 1}"><input type="time" class="inp sub-time" data-sub-start="${i}" value="${esc(
            x.start || ''
          )}" step="300" ${dis} aria-label="Hora da subtarefa ${i + 1}"><select class="inp sub-dur" data-sub-dur="${i}" ${dis} aria-label="Tempo da subtarefa ${
            i + 1
          }">${durOptions(+x.dur || 30)}</select><a class="sh" data-share="wa" data-subi="${i}" href="https://wa.me/" target="_blank" rel="noopener" title="Enviar pelo WhatsApp">${ic(
            'wa',
            16
          )}</a><a class="sh" data-share="mail" data-subi="${i}" href="mailto:" target="_blank" rel="noopener" title="Enviar por e-mail">${ic(
            'mail',
            16
          )}</a>${ro ? '' : `<button type="button" data-rm-sub="${i}" aria-label="Remover subtarefa ${i + 1}">✕</button>`}</div>`
      )
      .join('') + '<p class="note" style="margin:4px 0 0">Com dia e hora, a subtarefa aparece na agenda com o número dela, por exemplo 2/5.</p>'
  );
}

function attHTML(ed: any) {
  const d = ed.d;
  const kind = (f: any) => {
    const t = f.type || '';
    if (t.includes('pdf') || /\.pdf$/i.test(f.name)) return 'PDF';
    if (t.startsWith('image/')) return 'Imagem';
    if (t.startsWith('video/')) return 'Vídeo';
    if (/\.docx$/i.test(f.name)) return 'DOCX';
    return 'Texto';
  };
  const size = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const files = d.files
    .map(
      (f: any, i: number) =>
        `<div class="att"><span class="k">${kind(f)}</span><span class="nm" title="${esc(f.name)}">${esc(
          f.name
        )}</span><span class="muted small num">${size(
          f.size || 0
        )}</span><button type="button" class="btn btn-sm" data-view-file="${i}">Abrir</button>${
          S.readOnly
            ? ''
            : `<button type="button" class="btn btn-sm btn-danger" data-rm-file="${i}" aria-label="Remover ${esc(
                f.name
              )}">Remover</button>`
        }</div>`
    )
    .join('');
  const links = d.links
    .map((l: any, i: number) => {
      const yt = isYT(l.url);
      return `<div class="att"><span class="k">${yt ? 'YouTube' : 'Link'}</span>${
        yt ? ic('yt', 16) : ''
      }<a class="nm" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(
        l.label || (yt ? 'Vídeo do YouTube' : l.url)
      )}</a>${S.readOnly ? '' : `<button type="button" class="btn btn-sm btn-danger" data-rm-link="${i}">Remover</button>`}</div>`;
    })
    .join('');
  return files + links || '<p class="note" style="margin:0">Nenhum anexo ainda.</p>';
}

function gcalLink(title: string, date: string, start: string, end: string, details: string) {
  const f = (dt: string, tm: string) => dt.replace(/-/g, '') + 'T' + tm.replace(':', '') + '00';
  let tz = 'America/Sao_Paulo';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz;
  } catch {}
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title
  )}&dates=${f(date, start)}/${f(date, end)}&details=${encodeURIComponent(details || '')}&ctz=${encodeURIComponent(tz)}`;
}

function normRecur(r: any, date: string) {
  const freq = r.freq || 'none';
  if (freq === 'none') return { freq: 'none' };
  if (freq === 'custom') {
    const dates = [...new Set((r.dates || []).filter(validY))] as string[];
    dates.sort();
    return { freq, days: [], dates, until: dates[dates.length - 1] || date };
  }
  return { freq, days: freq === 'weekly' ? (r.days && r.days.length ? r.days : [dow(date)]) : [], until: r.until || '' };
}

function bindEditor(w: HTMLElement, ed: any) {
  const d = ed.d;
  const f = $('#edform', w);
  const refreshAtt = () => {
    $('#ed-att', w).innerHTML = attHTML(ed);
  };
  const refreshConflict = () => {
    const box = $('#ed-conflict', w);
    if (!d.date || !d.start || !d.end) {
      box.innerHTML = '';
      return;
    }
    const c = overlaps({ key: ed.o ? ed.o.key : '__new', start: d.start, end: d.end }, activeOn(d.date));
    box.innerHTML = c.length
      ? `<div class="info bad">Conflito de horário com ${c
          .map((x: any) => `“${esc(x.item.title)}” (${fmtH(x.start)}–${fmtH(x.end)})`)
          .join(', ')}.</div>`
      : '';
  };
  const refreshSubs = () => {
    $('#ed-subs', w).innerHTML = subsHTML(ed);
  };
  refreshSubs();
  const addSub = () => {
    const inp = $('#sub-new', w);
    const v = inp.value.trim();
    if (!v) return;
    d.subtasks.push({ id: uid(), text: v.slice(0, 160), done: false, date: '', start: '', dur: 30 });
    inp.value = '';
    refreshSubs();
    inp.focus();
  };
  f.addEventListener('keydown', (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (
      e.key === 'Enter' &&
      (t.id === 'sub-new' || t.dataset.subText !== undefined || t.id === 'ln-url' || t.id === 'ln-label')
    ) {
      e.preventDefault();
      if (t.id === 'sub-new') addSub();
      else if (t.id.startsWith('ln-')) $('[data-act=addlink]', w).click();
    }
  });
  ed.pickMonth = ed.pickMonth || (d.date || todayY()).slice(0, 8) + '01';
  const refreshPick = () => {
    const box = $('#ed-pick', w);
    if (!box) return;
    const m0 = ed.pickMonth;
    const c = parse(m0);
    const start = weekStart(m0);
    const sel = new Set<string>(d.recur.dates || []);
    const t0 = todayY();
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const x = addY(start, i);
      const out = parse(x).getMonth() !== c.getMonth();
      cells += `<button type="button" class="${out ? 'out' : ''} ${
        x === t0 ? 'today' : ''
      }" data-pick="${x}" aria-pressed="${sel.has(x)}" aria-label="${fmtDL(x)}" ${
        out ? 'tabindex="-1"' : ''
      }>${parse(x).getDate()}</button>`;
    }
    const n = sel.size;
    const list = [...sel].sort();
    box.innerHTML = `<div class="pick-h"><button type="button" data-pickmove="-1" aria-label="Mês anterior">${ic(
      'left',
      16
    )}</button><span>${MONTHS[c.getMonth()]} ${c.getFullYear()}</span><button type="button" data-pickmove="1" aria-label="Próximo mês">${ic(
      'right',
      16
    )}</button></div>
      <div class="pick">${WD.map((x) => `<span>${x[0]}</span>`).join('')}${cells}</div>
      <p class="note" style="margin:0">${
        n
          ? `${n} ${plural(n, 'dia escolhido', 'dias escolhidos')}: ${list.slice(0, 8).map(fmtD).join(', ')}${n > 8 ? '…' : ''}`
          : 'Nenhum dia escolhido ainda.'
      } ${n ? '<button type="button" class="btn btn-sm" data-act="pick-clear">Limpar</button>' : ''}</p>`;
  };
  refreshPick();
  const shareText = () =>
    `Olá! Você tem uma atividade ${d.date === todayY() ? 'hoje' : 'em ' + fmtDW(d.date)}.\nAtividade: ${
      d.title || '(sem nome)'
    }\nHorário: ${fmtH(d.start)} às ${fmtH(d.end)}${d.notes.trim() ? '\nAnotações: ' + d.notes.trim().slice(0, 300) : ''}`;
  const subText = (x: any) => {
    const i = d.subtasks.indexOf(x);
    return `Olá! Subtarefa ${i + 1}/${d.subtasks.length} da atividade “${d.title || '(sem nome)'}”.\nSubtarefa: ${x.text}${
      x.date ? `\nDia: ${fmtDW(x.date)}` : ''
    }${
      x.start ? `\nHorário: ${fmtH(x.start)} às ${fmtH(fromMin(Math.min(1439, toMin(x.start) + (+x.dur || 30))))}` : ''
    }`;
  };
  const setHref = (e: Event) => {
    const t = e.target as HTMLElement;
    const a = t.closest && (t.closest('[data-share]') as HTMLAnchorElement | null);
    if (!a) return;
    const kind = a.dataset.share;
    const sub = a.dataset.subi !== undefined ? d.subtasks[+a.dataset.subi] : null;
    if (sub) {
      const txt = subText(sub);
      a.href =
        kind === 'wa'
          ? 'https://wa.me/?text=' + encodeURIComponent(txt)
          : kind === 'mail'
          ? `mailto:?subject=${encodeURIComponent('Subtarefa: ' + sub.text)}&body=${encodeURIComponent(txt)}`
          : gcalLink(
              `${sub.text} (${d.title})`,
              sub.date || d.date,
              sub.start || d.start,
              fromMin(Math.min(1439, toMin(sub.start || d.start) + (+sub.dur || 30))),
              txt
            );
      return;
    }
    const txt = shareText();
    a.href =
      kind === 'wa'
        ? 'https://wa.me/?text=' + encodeURIComponent(txt)
        : kind === 'mail'
        ? `mailto:?subject=${encodeURIComponent('Agenda: ' + (d.title || 'atividade'))}&body=${encodeURIComponent(txt)}`
        : gcalLink(d.title || 'Atividade', d.date, d.start, d.end, txt);
  };
  w.addEventListener('pointerdown', setHref, true);
  w.addEventListener('focusin', setHref);
  w.addEventListener('mouseover', setHref);
  const syncDur = () => {
    const sel = $('#ed-dur', w);
    if (sel) sel.innerHTML = durOptions(toMin(d.end) - toMin(d.start));
  };
  refreshAtt();
  refreshConflict();
  f.addEventListener('input', (e: Event) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'ed-title') d.title = t.value;
    else if (t.id === 'ed-date') {
      d.date = t.value;
      refreshConflict();
    } else if (t.id === 'ed-start') {
      const dur = toMin(d.end) - toMin(d.start);
      d.start = t.value;
      if (dur > 0 && t.value) {
        d.end = fromMin(Math.min(1439, toMin(t.value) + dur));
        $('#ed-end', w).value = d.end;
      }
      syncDur();
      refreshConflict();
    } else if (t.id === 'ed-end') {
      d.end = t.value;
      syncDur();
      refreshConflict();
    } else if (t.id === 'ed-notes') d.notes = t.value;
    else if (t.dataset.subText !== undefined) {
      const x = d.subtasks[+t.dataset.subText];
      if (x) x.text = t.value;
    } else if (t.id === 'ed-until') d.recur.until = t.value;
    else if (t.id === 'ed-deadline') d.deadline = t.value;
  });
  f.addEventListener('change', (e: Event) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'ed-dur') {
      if (t.value) {
        d.end = fromMin(Math.min(1439, toMin(d.start) + +t.value));
        $('#ed-end', w).value = d.end;
        if (toMin(d.start) + +t.value > 1439) toast('A atividade termina às 23h59 para não passar da meia-noite.');
        syncDur();
        refreshConflict();
      }
    } else if (t.id === 'ed-cat') {
      d.category = t.value;
      $('#ed-dot', w).style.setProperty('--c', safeColor(cat(d.category).color));
    } else if (t.id === 'ed-rem') d.reminder = +t.value;
    else if (t.id === 'ed-freq') {
      d.recur.freq = t.value;
      $('#ed-recur', w).hidden = t.value === 'none' || t.value === 'custom';
      $('#ed-days', w).hidden = t.value !== 'weekly';
      $('#ed-cal', w).hidden = t.value !== 'custom';
      $('#ed-untilwrap', w).hidden = t.value === 'custom';
      if (t.value === 'custom') {
        if (!(d.recur.dates || []).length) d.recur.dates = [d.date];
        refreshPick();
      }
      if (t.value === 'weekly' && !(d.recur.days || []).length) {
        d.recur.days = [dow(d.date)];
        $$('[data-wday]', w).forEach((x) => (x.checked = +x.dataset.wday === dow(d.date)));
      }
      d.autoResched = t.value === 'none';
      $('#ed-auto', w).checked = d.autoResched;
    } else if (t.dataset.wday !== undefined) {
      const g = +t.dataset.wday;
      const s = new Set<number>(d.recur.days || []);
      t.checked ? s.add(g) : s.delete(g);
      d.recur.days = [...s];
    } else if (t.id === 'ed-fixed') {
      d.fixed = t.checked;
      $('#ed-dlwrap', w).hidden = !t.checked;
      if (t.checked && !d.deadline) {
        d.deadline = d.date;
        $('#ed-deadline', w).value = d.date;
      }
    } else if (t.id === 'ed-auto') d.autoResched = t.checked;
    else if (t.name === 'scope') d.scope = t.value;
    else if (t.id === 'ed-file' || t.id === 'ed-file2' || t.id === 'ed-file3') {
      if (t.files) uploadFiles(t.files, ed, refreshAtt).then(() => (t.value = ''));
    } else if (t.dataset.subDate !== undefined) {
      const x = d.subtasks[+t.dataset.subDate];
      if (x) {
        x.date = t.value;
        if (t.value && !x.start) {
          x.start = d.start;
          x.dur = x.dur || 30;
          refreshSubs();
        }
      }
    } else if (t.dataset.subStart !== undefined) {
      const x = d.subtasks[+t.dataset.subStart];
      if (x) {
        x.start = validT(t.value) || '';
        if (x.start && !x.date) {
          x.date = d.date;
          refreshSubs();
        }
      }
    } else if (t.dataset.subDur !== undefined) {
      const x = d.subtasks[+t.dataset.subDur];
      if (x && t.value) x.dur = +t.value;
    } else if (t.dataset.subDone !== undefined) {
      const x = d.subtasks[+t.dataset.subDone];
      if (x) {
        x.done = t.checked;
        t.closest('.sub')?.classList.toggle('done', t.checked);
      }
    }
  });
  w.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest('button, [data-close]') as HTMLElement | null;
    if (!b) return;
    if (b.dataset.pick) {
      const set = new Set<string>(d.recur.dates || []);
      set.has(b.dataset.pick) ? set.delete(b.dataset.pick) : set.add(b.dataset.pick);
      d.recur.dates = [...set].sort();
      refreshPick();
      return;
    }
    if (b.dataset.pickmove) {
      const c = parse(ed.pickMonth);
      ed.pickMonth = ymd(new Date(c.getFullYear(), c.getMonth() + +b.dataset.pickmove, 1));
      refreshPick();
      return;
    }
    if (b.dataset.act === 'pick-clear') {
      d.recur.dates = [];
      refreshPick();
      return;
    }
    if (b.dataset.seg) {
      d[b.dataset.seg] = b.dataset.val;
      $$(`[data-seg="${b.dataset.seg}"]`, w).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    } else if (b.dataset.viewFile !== undefined) openViewer(d.files[+b.dataset.viewFile]);
    else if (b.dataset.rmFile !== undefined) {
      const [x] = d.files.splice(+b.dataset.rmFile, 1);
      if (x) ed.removed.push(x.id);
      refreshAtt();
    } else if (b.dataset.rmLink !== undefined) {
      d.links.splice(+b.dataset.rmLink, 1);
      refreshAtt();
    } else if (b.dataset.act === 'addlink') {
      let url = $('#ln-url', w).value.trim();
      const label = $('#ln-label', w).value.trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      try {
        new URL(url);
      } catch {
        toast('Esse link não parece válido.');
        return;
      }
      d.links.push({ url, label });
      $('#ln-url', w).value = '';
      $('#ln-label', w).value = '';
      refreshAtt();
    } else if (b.dataset.act === 'del') deleteFromEditor(ed, w);
    else if (b.dataset.act === 'addsub') addSub();
    else if (b.dataset.rmSub !== undefined) {
      d.subtasks.splice(+b.dataset.rmSub, 1);
      refreshSubs();
    } else if (b.dataset.act === 'to-study') {
      const p = {
        date: d.date,
        start: d.start,
        end: d.end,
        title: d.title,
        notes: d.notes
      };
      closeModal(w);
      openStudy(null, p);
    } else if (b.dataset.act === 'to-travel') {
      const p = { date: d.date, start: d.start, title: d.title };
      closeModal(w);
      openTravel(null, p);
    } else if (b.dataset.act === 'copy-ed') {
      const o = findOcc(ed.o.key);
      if (o) {
        closeModal(w);
        copyOcc(o, null);
      }
    } else if (b.dataset.act === 'open-moved') {
      const nid = ed.base.overrides[ed.o.origDate].movedTo;
      closeModal(w);
      openEditor(nid);
    }
  });
  f.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    saveEditor(ed, w);
  });
}

async function uploadFiles(list: FileList, ed: any, refresh: () => void) {
  const m = FileStore.mode();
  for (const orig of [...list]) {
    const name = orig.name;
    let file: Blob | File = orig;
    const ok =
      /^(image\/|application\/pdf|text\/plain|video\/(mp4|webm|quicktime))/.test(orig.type) ||
      /\.(pdf|txt|jpe?g|png|webp|gif|heic|mp4|webm|mov)$/i.test(name);
    if (!ok) {
      toast(`“${name}”: anexe PDF, fotos, vídeos (MP4) ou TXT.`, 'warn');
      continue;
    }
    if (orig.type.startsWith('image/') && orig.size > 1.8 * 1048576) {
      try {
        file = await compressImage(orig);
      } catch {
        file = orig;
      }
    }
    const lim = FileStore.limit(m);
    if (file.size > lim) {
      toast(`“${name}” passa de ${lim / 1048576} MB. Envie um arquivo menor.`, 'warn');
      continue;
    }
    toast(`Anexando “${name}”…`);
    try {
      const r = await FileStore.put(file);
      ed.d.files.push({ ...r, name, type: file.type || orig.type || '', size: file.size });
      ed.newUploads.push(r.id);
      refresh();
      toast(`“${name}” anexado.`);
    } catch {
      toast(`Não foi possível anexar “${name}”.`, 'warn');
    }
  }
}

function saveEditor(ed: any, w: HTMLElement) {
  const d = ed.d;
  const err = $('#ed-err', w);
  if (!d.title.trim()) {
    err.textContent = 'Dê um nome à atividade.';
    $('#ed-title', w).focus();
    return;
  }
  if (!validY(d.date) || !validT(d.start) || !validT(d.end)) {
    err.textContent = 'Preencha data, início e fim.';
    return;
  }
  if (toMin(d.end) <= toMin(d.start)) {
    err.textContent = 'O fim precisa ser depois do início.';
    return;
  }
  if (d.recur.freq !== 'custom' && d.recur.until && d.recur.until < d.date) {
    err.textContent = 'A data final da repetição precisa ser depois do início.';
    return;
  }
  if (d.recur.freq === 'custom' && !(d.recur.dates || []).length) {
    err.textContent = 'Escolha no calendário pelo menos um dia para repetir.';
    return;
  }
  try {
    if (+d.reminder && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  } catch {}
  const isNew = !ed.o;
  const it = isNew ? ed.base : clone(S.items.get(ed.o.id));
  if (!it) {
    closeModal(w);
    return;
  }
  const wasRec = isRec(it);
  const hist: string[] = [];
  Object.assign(it, {
    subtasks: d.subtasks.filter((x: any) => String(x.text || '').trim()),
    title: d.title.trim(),
    category: d.category,
    priority: d.priority,
    reminder: +d.reminder || 0,
    fixed: d.fixed,
    deadline: d.fixed ? d.deadline : '',
    autoResched: d.autoResched,
    notes: d.notes,
    links: d.links,
    files: d.files
  });
  if (isNew) {
    Object.assign(it, {
      date: d.date,
      start: d.start,
      end: d.end,
      status: d.status || 'planejada',
      recur: normRecur(d.recur, d.date)
    });
    if (it.recur.freq === 'custom') it.date = it.recur.dates[0];
    if (isRec(it) && d.status && d.status !== 'planejada') it.overrides = { [d.date]: { status: d.status } };
    hist.push('Criada');
  } else if (wasRec) {
    const o = ed.o;
    const newRecur: any = normRecur(d.recur, it.date);
    if (newRecur.freq === 'none') {
      Object.assign(it, {
        date: d.date,
        start: d.start,
        end: d.end,
        status: d.status === 'reagendada' ? 'planejada' : d.status,
        recur: newRecur,
        overrides: {}
      });
      hist.push('Deixou de repetir');
    } else {
      it.recur = newRecur;
      it.overrides = it.overrides || {};
      if (newRecur.freq === 'custom') it.date = newRecur.dates[0];
      const ov = { ...(it.overrides[o.origDate] || {}) };
      if (d.scope === 'series') {
        if (d.start !== it.start || d.end !== it.end) hist.push(`Horário da série alterado para ${fmtH(d.start)}–${fmtH(d.end)}`);
        it.start = d.start;
        it.end = d.end;
        delete ov.start;
        delete ov.end;
      } else if (d.start !== o.start || d.end !== o.end) {
        ov.start = d.start;
        ov.end = d.end;
        hist.push(`${fmtD(o.origDate)}: horário alterado para ${fmtH(d.start)}–${fmtH(d.end)}`);
      }
      if (d.date !== o.date) {
        ov.date = d.date;
        hist.push(`${fmtD(o.origDate)}: movida para ${fmtDW(d.date)}`);
      }
      if (d.status && d.status !== o.status) {
        ov.status = d.status;
        hist.push(`${fmtD(o.origDate)}: marcada como ${STATUS[d.status].toLowerCase()}`);
      }
      if (Object.keys(ov).length) it.overrides[o.origDate] = ov;
    }
  } else {
    if (d.status && d.status !== it.status) hist.push(`Marcada como ${STATUS[d.status].toLowerCase()}`);
    if (d.date !== it.date || d.start !== it.start || d.end !== it.end) {
      hist.push(`Horário alterado para ${fmtDW(d.date)} ${fmtH(d.start)}–${fmtH(d.end)}`);
      it.kept = false;
    }
    Object.assign(it, {
      date: d.date,
      start: d.start,
      end: d.end,
      status: d.status || it.status,
      recur: normRecur(d.recur, d.date)
    });
    if (isRec(it)) it.overrides = {};
    if (it.recur.freq === 'custom') it.date = it.recur.dates[0];
  }
  if (hist.length) {
    it.history = [...(it.history || []), ...hist.map((text) => ({ at: Date.now(), text }))].slice(-30);
  }
  ed.saved = true;
  putItem(it);
  ed.removed.forEach(maybeDeleteAsset);
  closeModal(w);
  render();
  toast(isNew ? `“${it.title}” criada para ${fmtDW(d.date)}, ${fmtH(d.start)}.` : 'Alterações salvas.');
  warnConflicts(d.date, d.start, d.end, ed.o ? ed.o.key : it.id);
}

async function deleteFromEditor(ed: any, w: HTMLElement) {
  const o = ed.o;
  if (o.rec) {
    const v = await ask('Apagar atividade que se repete', `“${o.item.title}” se repete. O que você quer apagar?`, [
      { label: 'Cancelar', value: null },
      { label: 'Só este dia', value: 'one' },
      { label: 'Todas as repetições', value: 'all', kind: 'btn-danger' }
    ]);
    if (!v) return;
    if (v === 'one') {
      const it = clone(S.items.get(o.id));
      if (it) {
        it.overrides = it.overrides || {};
        it.overrides[o.origDate] = { ...(it.overrides[o.origDate] || {}), deleted: true };
        it.history = [...(it.history || []), { at: Date.now(), text: `${fmtD(o.origDate)}: apagada` }].slice(-30);
        putItem(it);
      }
    } else delItem(o.id);
  } else {
    const v = await ask('Apagar atividade', `Apagar “${o.item.title}” e seus anexos? Isso não pode ser desfeito.`, [
      { label: 'Cancelar', value: null },
      { label: 'Apagar', value: 'yes', kind: 'btn-danger' }
    ]);
    if (!v) return;
    delItem(o.id);
  }
  ed.saved = true;
  closeModal(w);
  render();
  toast('Atividade apagada.');
}

export function openViewer(f: any) {
  if (!f) return;
  let objUrl: string | null = null;
  const isPdf = (f.type || '').includes('pdf') || /\.pdf$/i.test(f.name);
  showModal(
    `<div class="viewer-h"><b>${esc(f.name)}</b><div><button class="btn btn-sm" data-act="fdl">${ic(
      'dl',
      16
    )} Baixar</button><button class="btn btn-sm" data-close>Fechar</button></div></div><div class="viewer-b" id="vb"><p class="muted">Abrindo…</p></div>`,
    async (w) => {
      const box = $('#vb', w);
      let blob: Blob;
      try {
        blob = await FileStore.blob(f);
      } catch {
        box.innerHTML = `<p class="muted">Não foi possível abrir este arquivo.</p>`;
        return;
      }
      w.addEventListener('click', (e) => {
        if (!(e.target as HTMLElement).closest('[data-act=fdl]')) return;
        triggerBrowserDownload(f.name, blob);
      });
      const t = blob.type || f.type || '';
      objUrl = URL.createObjectURL(blob);
      if (t.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(f.name)) {
        box.innerHTML = `<img src="${objUrl}" alt="${esc(f.name)}">`;
      } else if (t.startsWith('video/')) {
        box.innerHTML = `<video src="${objUrl}" controls playsinline></video>`;
      } else if (isPdf) {
        try {
          await renderPdf(blob, box);
        } catch {
          box.innerHTML = `<iframe src="${objUrl}" title="${esc(f.name)}"></iframe>`;
        }
      } else if (t.startsWith('text/') || /\.txt$/i.test(f.name)) {
        const pre = document.createElement('pre');
        pre.textContent = await blob.text();
        box.innerHTML = '';
        box.appendChild(pre);
      } else {
        box.innerHTML = '<p class="muted">Não há pré-visualização para este tipo de arquivo. Use o botão Baixar.</p>';
      }
    },
    {
      cls: 'viewer',
      onClose: () => {
        if (objUrl) URL.revokeObjectURL(objUrl);
      }
    }
  );
}

export function openResched(key: string) {
  const sg: any = suggestAll().find((x) => x.o.key === key);
  if (!sg) return;
  const o = sg.o;
  const dur0 = Math.max(5, toMin(o.end) - toMin(o.start));
  const v = { date: sg.date || addY(todayY(), 1), start: sg.start || o.start, dur: dur0 };
  showModal(
    `<form id="rsform" novalidate><div class="m-h"><span class="dot" style="--c:${safeColor(
      cat(o.item.category).color
    )};width:14px;height:14px"></span><h2>Remarcar “${esc(o.item.title)}”</h2></div>
    <div class="m-b">
      <p class="muted" style="margin:0">Era ${fmtDL(o.date)}, ${fmtH(o.start)}–${fmtH(o.end)}.${
      o.item.fixed && o.item.deadline ? ` Prazo fixo: ${fmtD(o.item.deadline)}.` : ''
    }</p>
      ${
        sg.conflict
          ? `<div class="info bad">${esc(sg.conflict)}</div>`
          : `<div class="info">Sugestão da agenda: ${fmtDL(sg.date)}, ${fmtH(sg.start)}. Você pode trocar.</div>`
      }
      <div class="form-grid" style="grid-template-columns:1.3fr 1fr 1fr"><label class="field" for="rs-date">Nova data<input type="date" id="rs-date" value="${
        v.date
      }"></label><label class="field" for="rs-start">Início<input type="time" id="rs-start" value="${
      v.start
    }" step="300"></label><label class="field" for="rs-dur">Tempo<select id="rs-dur">${durOptions(v.dur)}</select></label></div>
      <div id="rs-free"></div><div id="rs-conf"></div><div class="err-msg" id="rs-err" role="alert"></div>
    </div>
    <div class="m-f"><span class="sp"></span><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn btn-primary">Confirmar remarcação</button></div></form>`,
    (w) => {
      const upd = () => {
        const d = validY($('#rs-date', w).value);
        const st = validT($('#rs-start', w).value);
        const free = $('#rs-free', w);
        const conf = $('#rs-conf', w);
        if (!d) {
          free.innerHTML = '';
          conf.innerHTML = '';
          return;
        }
        const stt = ST();
        const ws = toMin(stt.workStart);
        const we = toMin(stt.workEnd);
        const busy = activeOn(d)
          .filter((x) => x.key !== o.key)
          .map((x) => [toMin(x.start), toMin(x.end)])
          .concat(travelSegs(d).map((x) => [x.s, x.e]))
          .sort((a, b) => a[0] - b[0]);
        const gaps: Array<[number, number]> = [];
        let cur = ws;
        for (const [a, b] of busy) {
          if (a > cur) gaps.push([cur, Math.min(a, we)]);
          cur = Math.max(cur, b);
          if (cur >= we) break;
        }
        if (cur < we) gaps.push([cur, we]);
        const ok = gaps.filter(([a, b]) => b - a >= v.dur);
        free.innerHTML = `<p class="note" style="margin:0">Horários livres em ${fmtDW(d)} (${stt.workStart}–${stt.workEnd}): ${
          ok.length
            ? ok
                .map(
                  ([a, b]) =>
                    `<button type="button" class="btn btn-sm" data-rs-pick="${fromMin(a)}">${fmtH(fromMin(a))}–${fmtH(
                      fromMin(b)
                    )}</button>`
                )
                .join(' ')
            : 'nenhum com esse tempo.'
        }</p>`;
        if (st) {
          const c = overlaps(
            { key: o.key, start: st, end: fromMin(Math.min(1439, toMin(st) + v.dur)) },
            activeOn(d).filter((x) => x.id !== o.id)
          );
          conf.innerHTML = c.length
            ? `<div class="info bad">Conflita com ${c
                .map((x: any) => `“${esc(x.item.title)}” (${fmtH(x.start)}–${fmtH(x.end)})`)
                .join(', ')}.</div>`
            : '';
        }
      };
      upd();
      w.addEventListener('input', upd);
      w.addEventListener('change', (e) => {
        const t = e.target as HTMLSelectElement;
        if (t.id === 'rs-dur' && t.value) v.dur = +t.value;
        upd();
      });
      w.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest('[data-rs-pick]') as HTMLElement | null;
        if (b) {
          $('#rs-start', w).value = b.dataset.rsPick;
          upd();
        }
      });
      $('#rsform', w).addEventListener('submit', (e: Event) => {
        e.preventDefault();
        const d = validY($('#rs-date', w).value);
        const st = validT($('#rs-start', w).value);
        const err = $('#rs-err', w);
        if (!d || !st) {
          err.textContent = 'Escolha a nova data e o horário.';
          return;
        }
        if (d < todayY()) {
          err.textContent = 'Escolha uma data de hoje em diante.';
          return;
        }
        const s2 = { o, date: d, start: st, end: fromMin(Math.min(1439, toMin(st) + v.dur)) };
        const nid = applySug(s2);
        closeModal(w);
        render();
        toast(`“${o.item.title}” remarcada para ${fmtDW(d)}, ${fmtH(st)}.`);
        if (nid) warnConflicts(d, s2.start, s2.end, nid);
      });
    },
    {}
  );
}

export function exampleWeek() {
  const ws = addY(weekStart(todayY()), 1);
  const d = (i: number) => addY(ws, i);
  const mk = (i: number, s: string, e: string, title: string, catId: string, extra: any = {}) => {
    const it = blankItem({ date: d(i), start: s, end: e });
    Object.assign(
      it,
      { title, category: catId, notes: 'Atividade de exemplo.', history: [{ at: Date.now(), text: 'Criada (exemplo)' }] },
      extra
    );
    return it;
  };
  return [
    mk(0, '09:00', '10:00', 'Reunião de planejamento', 'reunioes', { status: 'concluida', priority: 'alta' }),
    mk(0, '14:00', '15:00', 'Aula de inglês', 'estudos', {
      recur: { freq: 'weekly', days: [1, 3], until: '' },
      autoResched: false,
      overrides: { [d(0)]: { status: 'concluida' } }
    }),
    mk(1, '11:00', '12:00', 'Ligar para o cliente', 'trabalho', {
      priority: 'alta',
      links: [{ url: 'https://meet.google.com', label: 'Sala da reunião' }]
    }),
    mk(2, '09:00', '10:30', 'Estudar', 'estudos', { status: 'concluida' }),
    mk(2, '14:00', '16:00', 'Projeto', 'trabalho'),
    mk(3, '11:00', '12:00', 'Academia', 'saude', { status: 'concluida' }),
    mk(4, '09:00', '11:00', 'Relatório semanal', 'trabalho', { priority: 'alta', fixed: true, deadline: d(4) }),
    mk(4, '14:00', '15:00', 'Revisão', 'trabalho', { priority: 'baixa' }),
    mk(7, '08:00', '08:30', 'Planejar a semana', 'pessoal', { reminder: 10 })
  ];
}

export async function seed() {
  if (S.readOnly) return;
  if (S.items.size) {
    const v = await ask(
      'Carregar semana de exemplo',
      'Isso adiciona 9 atividades de exemplo à sua agenda (as suas continuam lá).',
      [
        { label: 'Cancelar', value: null },
        { label: 'Adicionar', value: 'y', kind: 'btn-primary' }
      ]
    );
    if (!v) return;
  }
  ensureSettings();
  Store.write('settings');
  for (const it of exampleWeek()) putItem(it);
  S.cursor = todayY();
  S.tab = 'agenda';
  render();
  toast('Semana de exemplo carregada. As atividades de dias anteriores aparecem em Pendências.');
}

export async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    toast('Resumo copiado.');
  } catch {
    showModal(
      `<div class="m-h"><h2>Copie o resumo</h2></div><div class="m-b"><textarea class="inp" rows="9" readonly style="width:100%">${esc(
        t
      )}</textarea></div><div class="m-f"><span class="sp"></span><button class="btn" data-close>Fechar</button></div>`,
      (w) => {
        const a = $('textarea', w);
        a.focus();
        a.select();
      },
      { cls: 'sm' }
    );
  }
}

export { setTab };
