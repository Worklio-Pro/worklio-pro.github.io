'use strict';
/* ===== shared UI bits ===== */
function bars(values, labels, fmt) {
  const max = Math.max(...values, 1); fmt = fmt || ((v) => v);
  return `<div class="bars">${values.map((v, i) => `<div class="b"><em>${esc(fmt(v))}</em><i style="height:${Math.max(1, (v / max) * 120)}px"></i><span>${esc(labels[i])}</span></div>`).join('')}</div>`;
}
const stat = (l, v, extra) => `<div class="card stat"><div class="l">${l}</div><div class="v">${v}</div>${extra ? `<div class="muted">${extra}</div>` : ''}</div>`;
const pct = (n) => (n === null || n === undefined ? '—' : `<span class="${n >= 0 ? 'pos' : 'neg'}">${n >= 0 ? '▲' : '▼'} ${Math.abs(n)}%</span>`);
function downloadCsv(name, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click();
}
// number prefixes from App Settings (same defaults as the server)
const PREFIX_DEFAULTS = { quotePrefix: 'Q-', jobPrefix: 'J-', invoicePrefix: 'INV-' };
const docPrefix = (k) => company[k] ?? PREFIX_DEFAULTS[k];
const readFileAsDataUrl = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
async function resizeImage(file, max) {
  const url = await readFileAsDataUrl(file);
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return url;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  // PNG and WebP can carry transparency; JPEG would fill it with black
  return file.type === 'image/png' || file.type === 'image/webp' ? c.toDataURL(file.type, 0.85) : c.toDataURL('image/jpeg', 0.85);
}

/* ===== /business-overview ===== */
PAGES['/business-overview'] = {
  title: 'Home',
  async render(main) {
    const o = await api('GET', '/api/overview'); const labels = o.months.map(monthLabel);
    const last = o.revenue.length - 1;
    main.innerHTML = `<div class="head"><div><h1>Home</h1><p class="sub">Revenue growth, client acquisition and team productivity.</p></div>
<div class="actions"><button class="btn alt" data-act="newQuote">+ Quote</button><button class="btn alt" data-act="newJob">+ Job</button><button class="btn" data-act="newInvoice">+ Invoice</button></div></div>
<div class="grid g4">${stat('Revenue this month', money(o.revenue[last]), 'vs last month ' + pct(o.growth[last]))}${stat('New clients this month', o.newClients[last], o.totalClients + ' total clients')}${stat('Jobs this month', o.jobsThisMonth)}${stat('Quotes awaiting approval', o.openQuotes)}</div>
<div class="grid g2" style="margin-top:16px"><div class="card"><h2>Monthly revenue (paid invoices)</h2>${bars(o.revenue, labels, (v) => (v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + Math.round(v)))}
<div class="muted">Growth: ${o.growth.map((g, i) => (i ? `${labels[i]} ${pct(g)}` : '')).filter(Boolean).join(' · ')}</div></div>
<div class="card"><h2>Client acquisition</h2>${bars(o.newClients, labels)}<div class="muted">New clients added per month</div></div></div>
<div class="card"><h2>Team productivity (completed jobs per month)</h2><div class="tablewrap"><table class="m-tprod"><tr><th>Team member</th>${labels.map((l) => `<th class="r">${l}</th>`).join('')}<th class="r">Upcoming</th></tr>
${o.productivity.map((p) => `<tr><td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${esc(p.color)};margin-right:6px"></span>${esc(p.name)}</td>${p.completedByMonth.map((n) => `<td class="r">${n}</td>`).join('')}<td class="r">${p.upcoming}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No staff yet</td></tr>'}</table></div></div>`;
  },
};

/* ===== /calendar (Calendar): a week or day on a time grid, or a whole month with everyone's jobs, tasks and events.
   Click an empty time to add a Job, Task or Event there; drag anything to another day or time to move it. ===== */
const SC_START = 6; const SC_END = 21; const SC_HOUR = 48; // the grid runs 6 AM to 9 PM, 48px per hour
let scState = { anchor: new Date(), view: innerWidth < 700 ? 'day' : 'week', hidden: [] };
try { const saved = JSON.parse(localStorage.getItem('sched') || '{}'); if (saved.view) scState.view = innerWidth < 700 && saved.view === 'week' ? 'day' : saved.view; if (saved.hidden) scState.hidden = saved.hidden; } catch (e) { /* private mode */ }
const scSave = () => { try { localStorage.setItem('sched', JSON.stringify({ view: scState.view, hidden: scState.hidden })); } catch (e) { /* private mode */ } };
const scMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const scTime = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const scDays = () => (scState.view !== 'week' ? [new Date(scState.anchor.getFullYear(), scState.anchor.getMonth(), scState.anchor.getDate())] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(scState.anchor), i)));
// everything on one day: jobs, tasks and events, filtered by the team calendars shown
function scItems(day) {
  const shownStaff = (ids) => { const list = ids || []; return list.length ? list.some((id) => !scState.hidden.includes(id)) : !scState.hidden.includes('none'); };
  const out = [];
  for (const j of D.jobs) if (j.date === day && j.status !== 'cancelled' && shownStaff(j.staffIds)) out.push({ kind: 'job', id: j.id, title: j.title, sub: clientName(j.clientId), start: j.startTime, end: j.endTime, anytime: !!j.anytime, staffIds: j.staffIds || [], done: j.status === 'completed' });
  for (const t of D.tasks || []) if (t.date === day && shownStaff(t.staffIds)) out.push({ kind: 'task', id: t.id, title: t.title, sub: t.clientId ? clientName(t.clientId) : t.address || '', start: t.startTime, end: t.endTime, anytime: !!t.anytime, staffIds: t.staffIds || [], done: !!t.done });
  for (const e of D.events || []) if (e.date === day) out.push({ kind: 'event', id: e.id, title: e.title, sub: '', start: e.startTime, end: e.endTime, anytime: !!e.anytime, staffIds: [] });
  return out;
}
const scColor = (it) => { const s = byId(D.staff, it.staffIds[0]); return it.kind === 'event' ? '#7c3aed' : s ? s.color : '#64748b'; };
// overlapping items share the width of the day
function scLayout(items) {
  const L = items.map((it) => ({ ...it, s: scMin(it.start), e: Math.max(scMin(it.end), scMin(it.start) + 15) })).sort((a, b) => a.s - b.s || b.e - a.e);
  let group = []; let groupEnd = -1; const done = [];
  const flush = () => { const cols = []; for (const it of group) { let c = cols.findIndex((end) => end <= it.s); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = it.e; it.col = c; } group.forEach((it) => { it.cols = cols.length; done.push(it); }); group = []; };
  for (const it of L) { if (it.s >= groupEnd && group.length) flush(); group.push(it); groupEnd = Math.max(groupEnd, it.e); }
  flush(); return done;
}
PAGES['/calendar'] = {
  title: 'Calendar',
  async render(main) {
    const days = scDays(); const today = ymd(new Date()); const edit = canDo('jobs.edit');
    const views = `<div class="sc-views">${[['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ...(planHas('dispatchMap') ? [['map', 'Map']] : [])].map(([k, l]) => `<button type="button" class="${scState.view === k ? 'on' : ''}" data-act="scView" data-v="${k}">${l}</button>`).join('')}</div>`;
    if (scState.view === 'map' && !planHas('dispatchMap')) scState.view = 'day';
    if (scState.view === 'map') return scMapRender(main, edit, `<div class="sc-bar"><button type="button" class="btn alt sm" data-act="scToday">Today</button><button type="button" class="btn alt sm sc-arrow" data-act="scStep" data-n="-1" aria-label="Previous day">‹</button><button type="button" class="btn alt sm sc-arrow" data-act="scStep" data-n="1" aria-label="Next day">›</button>
<h1 class="sc-range">${esc(scState.anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}</h1><span style="flex:1"></span>${views}</div>`);
    const a = scState.anchor; const first = new Date(a.getFullYear(), a.getMonth(), 1); const gridStart = startOfWeek(first);
    const range = scState.view === 'month' ? first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : scState.view === 'day' ? a.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : `${days[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}–${days[0].getMonth() === days[6].getMonth() ? days[6].getDate() : days[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, ${days[6].getFullYear()}`;
    const week = scState.view === 'month' ? [] : days.map(ymd);
    const mini = `<div class="sc-mini"><div class="sc-mini-h"><strong>${first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong><span><button type="button" data-act="scMonth" data-n="-1" aria-label="Previous month">‹</button><button type="button" data-act="scMonth" data-n="1" aria-label="Next month">›</button></span></div>
<div class="sc-mini-g">${Array.from({ length: 7 }, (_, i) => `<span class="dow">${addDays(gridStart, i).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}</span>`).join('')}${Array.from({ length: 42 }, (_, i) => { const d = addDays(gridStart, i); const s = ymd(d);
      return d.getMonth() !== first.getMonth() && i >= 35 ? '' : `<button type="button" class="${d.getMonth() !== first.getMonth() ? 'out ' : ''}${week.includes(s) ? 'in ' : ''}${s === today ? 'today' : ''}" data-act="scGo" data-d="${s}">${d.getDate()}</button>`; }).join('')}</div></div>`;
    const team = [['none', 'Unassigned', '#64748b'], ...D.staff.filter(staffActive).map((s) => [s.id, s.name, s.color])];
    const lane = (s) => { const it = scItems(s).filter((x) => x.anytime); const off = D.staff.filter((st) => !scState.hidden.includes(st.id)).map((st) => [st, offOn(st.id, s)]).filter(([, r]) => r && !r.start);
      return `<div class="sc-lane" data-d="${s}">${off.map(([st]) => `<span class="sc-off" title="Approved time off">${esc(st.name.split(' ')[0])} off</span>`).join('')}${it.map((x) => `<div class="sc-chip k-${x.kind}${x.done ? ' done' : ''}" style="--c:${esc(scColor(x))}" data-kind="${x.kind}" data-id="${x.id}" ${edit ? 'data-drag="1"' : ''}>${esc(x.title)}</div>`).join('')}</div>`; };
    const col = (s) => `<div class="sc-col${s === today ? ' today' : ''}" data-d="${s}">${scLayout(scItems(s).filter((x) => !x.anytime && x.start)).map((x) => { const top = (Math.max(x.s, SC_START * 60) - SC_START * 60) / 60 * SC_HOUR; const h = Math.max(18, (Math.min(x.e, SC_END * 60) - Math.max(x.s, SC_START * 60)) / 60 * SC_HOUR);
      return `<div class="sc-item k-${x.kind}${x.done ? ' done' : ''}" style="--c:${esc(scColor(x))};top:${top}px;height:${h}px;left:calc(${(100 / x.cols) * x.col}% + 2px);width:calc(${100 / x.cols}% - 4px)" data-kind="${x.kind}" data-id="${x.id}" data-start="${x.start}" data-end="${x.end}" ${edit ? 'data-drag="1"' : ''} title="${esc(`${fmtTime(x.start)}–${fmtTime(x.end)} · ${x.title}${x.sub ? ' · ' + x.sub : ''}`)}">
<span class="sc-t">${esc(fmtTime(x.start))}</span><strong>${esc(x.title)}</strong>${x.sub && h > 40 ? `<span class="sc-s">${esc(x.sub)}</span>` : ''}</div>`; }).join('')}${s === today && new Date().getHours() >= SC_START && new Date().getHours() < SC_END ? `<div class="sc-now" style="top:${(new Date().getHours() * 60 + new Date().getMinutes() - SC_START * 60) / 60 * SC_HOUR}px"></div>` : ''}</div>`;
    main.innerHTML = `<div class="sc">
<aside class="sc-side">${mini}<div class="sc-team"><h3>Team calendars</h3>${team.map(([id, n, c]) => `<label><input type="checkbox" data-act="scTeam" data-id="${esc(id)}" ${scState.hidden.includes(id) ? '' : 'checked'} style="accent-color:${esc(c)}"> ${esc(n)}</label>`).join('')}</div>
${edit ? '<p class="muted sc-tip">Click a time to add a job, task or event. Drag anything to move it.</p>' : ''}</aside>
<section class="sc-main"><div class="sc-bar"><button type="button" class="btn alt sm" data-act="scToday">Today</button><button type="button" class="btn alt sm sc-arrow" data-act="scStep" data-n="-1" aria-label="Previous">‹</button><button type="button" class="btn alt sm sc-arrow" data-act="scStep" data-n="1" aria-label="Next">›</button>
<h1 class="sc-range">${esc(range)}</h1><span style="flex:1"></span>${views}</div>
${scState.view === 'month' ? scMonthHtml(first, today, edit) : `<div class="sc-grid" style="--days:${days.length}">
<div class="sc-head"><div class="sc-gut">${esc(Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace('_', ' '))}</div>${days.map((d) => `<div class="sc-dh${ymd(d) === today ? ' today' : ''}"><span>${d.toLocaleDateString('en-US', { weekday: 'short' })}</span><b>${d.getDate()}</b></div>`).join('')}</div>
<div class="sc-head sc-anyrow"><div class="sc-gut">Anytime</div>${week.map(lane).join('')}</div>
<div class="sc-body" id="scBody"><div class="sc-hours">${Array.from({ length: SC_END - SC_START }, (_, i) => `<div style="height:${SC_HOUR}px"><span>${fmtTime(scTime((SC_START + i) * 60)).replace(':00', '')}</span></div>`).join('')}</div>
<div class="sc-cols" style="height:${(SC_END - SC_START) * SC_HOUR}px">${week.map(col).join('')}</div></div></div>`}</section></div>`;
    if (scState.view === 'month') return scMonthWire(main, edit);
    const body = $('#scBody'); const nowH = new Date().getHours(); body.scrollTop = Math.max(0, ((week.includes(today) ? nowH - 1 : 7) - SC_START) * SC_HOUR);
    scWire(main, edit);
  },
};
A.scView = (d) => { scState.view = d.v; scSave(); refresh(); };
A.scToday = () => { scState.anchor = new Date(); refresh(); };
A.scStep = (d) => { if (scState.view === 'month') return A.scMonth(d); scState.anchor = addDays(scState.anchor, Number(d.n) * (scState.view === 'week' ? 7 : 1)); refresh(); };
A.scMonth = (d) => { const a = scState.anchor; scState.anchor = new Date(a.getFullYear(), a.getMonth() + Number(d.n), 1); refresh(); };
A.scGo = (d) => { scState.anchor = parseD(d.d); if (d.day) { scState.view = 'day'; scSave(); } refresh(); };
A.scTeam = (d, el) => { scState.hidden = el.checked ? scState.hidden.filter((x) => x !== d.id) : [...new Set([...scState.hidden, d.id])]; scSave(); refresh(); };
// clicks on empty time, and dragging items to a new day or time (pointer events: works with a mouse and on touch screens)
function scWire(main, edit) {
  const cols = $$('.sc-col', main); const lanes = $$('.sc-lane', main);
  const at = (x, y) => { const c = cols.find((el) => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right; }); if (!c) return null; const r = c.getBoundingClientRect(); return { col: c, day: c.dataset.d, min: SC_START * 60 + (y - r.top) / SC_HOUR * 60 }; };
  if (edit) cols.forEach((c) => c.addEventListener('click', (e) => {
    if (e.target.closest('.sc-item') || scDragged) return;
    const p = at(e.clientX, e.clientY); const start = Math.min(SC_END * 60 - 60, Math.max(SC_START * 60, Math.floor(p.min / 30) * 30));
    scQuick({ date: p.day, startTime: scTime(start), endTime: scTime(start + 60) }, e.clientX, e.clientY);
  }));
  if (edit) lanes.forEach((l) => l.addEventListener('click', (e) => { if (e.target.closest('.sc-chip')) return; scQuick({ date: l.dataset.d, startTime: '09:00', endTime: '10:00', anytime: true }, e.clientX, e.clientY); }));
  $$('.sc-item, .sc-chip', main).forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; const sx = e.clientX; const sy = e.clientY; const box = el.getBoundingClientRect(); const grabY = sy - box.top; let ghost = null; let target = null;
      const isChip = el.classList.contains('sc-chip'); const dur = isChip ? 60 : scMin(el.dataset.end) - scMin(el.dataset.start);
      const move = (m) => {
        if (!el.dataset.drag) return;
        if (!ghost && Math.hypot(m.clientX - sx, m.clientY - sy) < 5) return;
        if (!ghost) { ghost = el.cloneNode(true); ghost.classList.add('sc-ghost'); ghost.style.width = box.width + 'px'; ghost.style.height = box.height + 'px'; document.body.appendChild(ghost); el.classList.add('sc-dragging'); }
        const lane = isChip && lanes.find((l) => { const r = l.getBoundingClientRect(); return m.clientX >= r.left && m.clientX <= r.right && m.clientY >= r.top && m.clientY <= r.bottom; });
        if (lane) { target = { day: lane.dataset.d, anytime: true }; ghost.style.left = m.clientX - 20 + 'px'; ghost.style.top = m.clientY - 10 + 'px'; ghost.querySelector('.sc-t') && (ghost.querySelector('.sc-t').textContent = 'Anytime'); return; }
        const p = at(m.clientX, m.clientY - grabY); if (!p) return;
        const start = Math.max(SC_START * 60, Math.min(SC_END * 60 - Math.min(dur, 60), Math.round(p.min / 15) * 15));
        target = { day: p.day, start }; const r = p.col.getBoundingClientRect();
        ghost.style.left = r.left + 2 + 'px'; ghost.style.width = r.width - 4 + 'px'; ghost.style.top = r.top + (start - SC_START * 60) / 60 * SC_HOUR + 'px';
        const t = ghost.querySelector('.sc-t'); if (t) t.textContent = `${fmtTime(scTime(start))}–${fmtTime(scTime(start + dur))}`;
      };
      const up = async () => {
        removeEventListener('pointermove', move); removeEventListener('pointerup', up);
        if (!ghost) { scOpen(el.dataset.kind, el.dataset.id, sx, sy); return; } // a click
        ghost.remove(); el.classList.remove('sc-dragging'); scDragged = true; setTimeout(() => { scDragged = false; }, 0);
        if (!target) return;
        const upd = target.anytime ? { date: target.day, anytime: true } : { date: target.day, startTime: scTime(target.start), endTime: scTime(target.start + dur), anytime: false };
        const col = { job: 'jobs', task: 'tasks', event: 'events' }[el.dataset.kind];
        try { await api('PUT', `/api/${col}/${el.dataset.id}`, upd); toast(`Moved to ${fmtDate(target.day)}${target.anytime ? ' (anytime)' : `, ${fmtTime(upd.startTime)}`}`); refresh(); } catch (x) { toast(x.message, true); refresh(); }
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    });
  });
}
let scDragged = false;

/* Calendar → Month: every day of the month in a grid, with each day's jobs, tasks and events in time order (Anytime first) and who's off.
   Click a day's empty space to add something on that day, its number (or "+N more") to open the day, and drag an item to another day to move it (it keeps its time). */
const SC_MONTH_MAX = 3; // items shown in a day before "+N more"
function scMonthHtml(first, today, edit) {
  const start = startOfWeek(first); const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const n = Math.ceil((Math.round((last - start) / 864e5) + 1) / 7) * 7;
  const order = (x) => (x.anytime || !x.start ? -1 : scMin(x.start));
  const short = (t) => fmtTime(t).replace(':00', '').replace(/ ?([AP])M/i, (m, ap) => ap.toLowerCase());
  const cell = (d) => { const s = ymd(d);
    const its = scItems(s).sort((a, b) => order(a) - order(b));
    const off = D.staff.filter((st) => staffActive(st) && !scState.hidden.includes(st.id) && offOn(st.id, s));
    const shown = its.length > SC_MONTH_MAX + 1 ? its.slice(0, SC_MONTH_MAX) : its;
    return `<div class="sc-mc${d.getMonth() !== first.getMonth() ? ' out' : ''}${s === today ? ' today' : ''}" data-d="${s}">
<button type="button" class="sc-mn" data-act="scGo" data-d="${s}" data-day="1" aria-label="Open ${esc(d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }))}">${d.getDate() === 1 ? esc(d.toLocaleDateString('en-US', { month: 'short' })) + ' ' : ''}${d.getDate()}</button>
${off.map((st) => `<span class="sc-off" title="Approved time off">${esc(st.name.split(' ')[0])} off</span>`).join('')}
${shown.map((x) => { const any = x.anytime || !x.start; return `<div class="sc-mi k-${x.kind}${x.done ? ' done' : ''}${any ? ' any' : ''}" style="--c:${esc(scColor(x))}" data-kind="${x.kind}" data-id="${x.id}" ${edit ? 'data-drag="1"' : ''} title="${esc(`${any ? 'Anytime' : `${fmtTime(x.start)}–${fmtTime(x.end)}`} · ${x.title}${x.sub ? ' · ' + x.sub : ''}`)}">${any ? '' : `<span class="sc-t">${esc(short(x.start))}</span>`}<span class="sc-mt">${esc(x.title)}</span></div>`; }).join('')}
${its.length > shown.length ? `<button type="button" class="sc-more" data-act="scGo" data-d="${s}" data-day="1">+${its.length - shown.length} more</button>` : ''}</div>`; };
  return `<div class="sc-month"><div class="sc-mh">${Array.from({ length: 7 }, (_, i) => `<span>${addDays(start, i).toLocaleDateString('en-US', { weekday: 'short' })}</span>`).join('')}</div>
<div class="sc-mg">${Array.from({ length: n }, (_, i) => cell(addDays(start, i))).join('')}</div></div>`;
}
function scMonthWire(main, edit) {
  const cells = $$('.sc-mc', main);
  if (edit) cells.forEach((c) => c.addEventListener('click', (e) => {
    if (e.target.closest('.sc-mi, button') || scDragged) return;
    scQuick({ date: c.dataset.d, startTime: '09:00', endTime: '10:00' }, e.clientX, e.clientY);
  }));
  $$('.sc-mi', main).forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; const sx = e.clientX; const sy = e.clientY; const box = el.getBoundingClientRect(); let ghost = null; let target = null;
      const move = (m) => {
        if (!el.dataset.drag) return;
        if (!ghost && Math.hypot(m.clientX - sx, m.clientY - sy) < 5) return;
        if (!ghost) { ghost = el.cloneNode(true); ghost.classList.add('sc-ghost'); ghost.style.width = box.width + 'px'; document.body.appendChild(ghost); el.classList.add('sc-dragging'); }
        ghost.style.left = m.clientX - (sx - box.left) + 'px'; ghost.style.top = m.clientY - (sy - box.top) + 'px';
        const c = cells.find((x) => { const r = x.getBoundingClientRect(); return m.clientX >= r.left && m.clientX <= r.right && m.clientY >= r.top && m.clientY <= r.bottom; });
        cells.forEach((x) => x.classList.toggle('drop', x === c)); target = c ? c.dataset.d : null;
      };
      const up = async () => {
        removeEventListener('pointermove', move); removeEventListener('pointerup', up);
        if (!ghost) { scOpen(el.dataset.kind, el.dataset.id, sx, sy); return; } // a click
        ghost.remove(); el.classList.remove('sc-dragging'); cells.forEach((x) => x.classList.remove('drop')); scDragged = true; setTimeout(() => { scDragged = false; }, 0);
        if (!target || target === el.closest('.sc-mc').dataset.d) return;
        const col = { job: 'jobs', task: 'tasks', event: 'events' }[el.dataset.kind];
        try { await api('PUT', `/api/${col}/${el.dataset.id}`, { date: target }); toast(`Moved to ${fmtDate(target)}`); refresh(); } catch (x) { toast(x.message, true); refresh(); }
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    });
  });
}

/* ===== Calendar → Map (dispatch map): one day's jobs on a map, numbered in each team member's color in visiting order, with a line for each
   person's route from the business address. The list beside it groups visits by person: drag a visit onto someone to assign it (or use
   Assign to in its pin), and Best order puts a person's visits in the shortest driving order with new times. Plan feature: dispatchMap. ===== */
let dmLeaflet = null; let dmMap = null; let dmToken = 0; let dmPins = {};
const loadLeaflet = () => dmLeaflet || (dmLeaflet = new Promise((ok, no) => {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(l);
  const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
  s.onload = () => ok(window.L); s.onerror = () => { dmLeaflet = null; no(new Error('The map couldn’t load. Check your connection and try again.')); }; document.head.appendChild(s);
}));
const dmMin = (j) => (j.anytime || !j.startTime ? 1440 : scMin(j.startTime));
const dmWhen = (j) => (j.anytime || !j.startTime ? 'Anytime' : `${fmtTime(j.startTime)}–${fmtTime(j.endTime)}`);
// Google Maps directions through a person's stops in order, starting from where the phone is (Google allows 9 stops between)
const dmDirections = (stops) => { const a = stops.map((j) => j.address).filter(Boolean).slice(0, 10); if (!a.length) return '';
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(a[a.length - 1])}${a.length > 1 ? '&waypoints=' + encodeURIComponent(a.slice(0, -1).join('|')) : ''}`; };
async function scMapRender(main, edit, bar) {
  const token = ++dmToken; const date = ymd(scState.anchor);
  main.innerHTML = `<div class="dm">${bar}<div class="dm-body"><aside class="dm-list" id="dmList"><p class="muted">Loading…</p></aside><div class="dm-map" id="dmMap" role="region" aria-label="Map of the day’s jobs"></div></div></div>`;
  let data; let L;
  try { [data, L] = await Promise.all([api('GET', '/api/dispatch?date=' + date), loadLeaflet()]); } catch (x) { if (token === dmToken) $('#dmList').innerHTML = `<p class="danger-text">${esc(x.message)}</p>`; return; }
  if (token !== dmToken || !$('#dmMap')) return; // moved to another day or page while loading
  const team = D.staff.filter(staffActive);
  const groups = [{ id: '', name: 'Unassigned', color: '#64748b' }, ...team.map((s) => ({ id: s.id, name: s.name, color: s.color || '#0f766e', s }))]
    .map((g) => ({ ...g, jobs: data.jobs.filter((j) => (g.id ? j.staffIds.includes(g.id) : !j.staffIds.filter((x) => byId(D.staff, x)).length)).sort((a, b) => dmMin(a) - dmMin(b)) }))
    .filter((g) => g.id || g.jobs.length);
  const owner = {}; groups.forEach((g) => g.jobs.forEach((j, i) => { if (!owner[j.id]) owner[j.id] = { g, n: i + 1 }; })); // a visit with two people shows in the first one's color
  const item = (g, j, i) => `<li class="dm-job${j.status === 'completed' ? ' done' : ''}" data-id="${j.id}" data-g="${esc(g.id)}" ${edit ? 'draggable="true"' : ''}>
<span class="dm-n" style="--c:${esc(g.color)}">${i + 1}</span><span class="dm-t"><span class="dm-when">${esc(dmWhen(j))}${j.status === 'completed' ? ' · Completed' : ''}</span>
<strong>${esc(j.title || 'Job #' + j.number)}</strong><span class="muted">${esc([j.client, j.address].filter(Boolean).join(' · ') || 'No address')}</span>${j.address && j.lat === undefined ? `<span class="dm-warn">${j.unplaced ? 'Address not found on the map' : 'Finding on the map…'}</span>` : ''}</span></li>`;
  const movable = (g) => g.jobs.filter((j) => j.status !== 'completed' && j.lat !== undefined).length;
  $('#dmList').innerHTML = `${data.base && data.base.lat === undefined ? `<p class="dm-note">${data.pending ? 'Finding your business address on the map…' : 'Your business address (Settings → Company Profile) couldn’t be found on the map, so routes start at the first visit.'}</p>` : !data.base ? '<p class="dm-note">Add your business address in Settings → Company Profile so routes start there.</p>' : ''}
${data.pending ? `<p class="dm-note">Finding ${data.pending} address${data.pending === 1 ? '' : 'es'} on the map…</p>` : ''}
${!data.jobs.length ? `<p class="muted dm-empty">No jobs on ${esc(fmtDate(date))}.</p>` : ''}
${groups.map((g) => `<section class="dm-g" data-g="${esc(g.id)}"><div class="dm-gh"><span class="dm-dot" style="background:${esc(g.color)}"></span><strong>${esc(g.name)}</strong><span class="muted">${g.jobs.length ? `${g.jobs.length} visit${g.jobs.length === 1 ? '' : 's'}` : 'No visits'}</span>
<span class="dm-acts">${g.jobs.some((j) => j.address) ? `<a class="btn alt sm" href="${esc(dmDirections(g.jobs.filter((j) => j.status !== 'completed')) || dmDirections(g.jobs))}" target="_blank" rel="noopener" title="Driving directions through these visits in Google Maps">Directions</a>` : ''}${edit && movable(g) > 1 ? `<button type="button" class="btn sm" data-act="dmOptimize" data-g="${esc(g.id)}">Best order</button>` : ''}</span></div>
${g.jobs.length ? `<ol class="dm-jobs">${g.jobs.map((j, i) => item(g, j, i)).join('')}</ol>` : edit ? '<div class="dm-drop muted">Drag a visit here to assign it</div>' : ''}</section>`).join('')}
${edit && data.jobs.length ? '<p class="muted dm-tip">Drag a visit onto someone to assign it to them.</p>' : ''}`;
  // the map
  if (dmMap) { dmMap.remove(); dmMap = null; }
  dmMap = L.map('dmMap', { scrollWheelZoom: true }); dmPins = {};
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(dmMap);
  const pts = [];
  const home = data.base && data.base.lat !== undefined ? [data.base.lat, data.base.lng] : null;
  if (home) { pts.push(home); L.marker(home, { icon: L.divIcon({ className: 'dm-home', html: '<span title="Your business">⌂</span>', iconSize: [28, 28], iconAnchor: [14, 14] }), zIndexOffset: -100 }).addTo(dmMap).bindPopup(`<strong>${esc(company.name || 'Your business')}</strong><br>${esc(data.base.address)}`); }
  for (const g of groups) {
    const line = g.jobs.filter((j) => j.lat !== undefined).map((j) => [j.lat, j.lng]);
    if (g.id && line.length) L.polyline(home ? [home, ...line] : line, { color: g.color, weight: 3, opacity: 0.75, dashArray: '6 6' }).addTo(dmMap);
  }
  for (const j of data.jobs) {
    if (j.lat === undefined) continue; const { g, n } = owner[j.id]; pts.push([j.lat, j.lng]);
    const others = j.staffIds.map((x) => byId(D.staff, x)).filter(Boolean);
    const m = L.marker([j.lat, j.lng], { icon: L.divIcon({ className: 'dm-pin' + (j.status === 'completed' ? ' done' : ''), html: `<span style="--c:${esc(g.color)}">${n}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }), title: j.title }).addTo(dmMap);
    m.bindPopup(`<div class="dm-pop"><span class="muted">${esc(dmWhen(j))}</span><strong>${esc(j.title || 'Job #' + j.number)}</strong><span>${esc(j.client)}</span><span class="muted">${esc(j.address)}</span>
<span class="muted">${others.length ? esc(others.map((s) => s.name).join(', ')) : 'Unassigned'}</span>
${edit && j.status !== 'completed' ? `<label class="dm-assign">Assign to <select data-id="${j.id}"><option value="">Unassigned</option>${team.map((s) => `<option value="${s.id}" ${j.staffIds[0] === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>` : ''}
<a href="/jobs/edit?id=${j.id}" data-dm-open="${j.id}">Open job #${esc(String(j.number))} ›</a></div>`);
    dmPins[j.id] = m;
  }
  if (pts.length) dmMap.fitBounds(pts, { padding: [40, 40], maxZoom: 14 }); else dmMap.setView([39.5, -98.35], 4);
  dmMap.on('popupopen', (e) => { const el = e.popup.getElement(); const sel = $('select', el); const open = $('[data-dm-open]', el);
    if (open) open.addEventListener('click', (ev) => { ev.preventDefault(); navigate('/jobs/edit?id=' + open.dataset.dmOpen); });
    if (sel) sel.addEventListener('change', () => dmAssign(sel.dataset.id, null, sel.value)); });
  setTimeout(() => dmMap && dmMap.invalidateSize(), 0);
  // clicking a visit in the list shows its pin; dragging assigns it
  $$('.dm-job', main).forEach((li) => {
    li.addEventListener('click', () => { const m = dmPins[li.dataset.id]; if (!m) return; dmMap.setView(m.getLatLng(), Math.max(dmMap.getZoom(), 13)); m.openPopup(); if (innerWidth < 900) $('#dmMap').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    if (edit) li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ id: li.dataset.id, from: li.dataset.g })); e.dataTransfer.effectAllowed = 'move'; li.classList.add('dm-dragging'); });
    li.addEventListener('dragend', () => li.classList.remove('dm-dragging'));
  });
  if (edit) $$('.dm-g', main).forEach((sec) => {
    sec.addEventListener('dragover', (e) => { e.preventDefault(); sec.classList.add('dm-over'); });
    sec.addEventListener('dragleave', (e) => { if (!sec.contains(e.relatedTarget)) sec.classList.remove('dm-over'); });
    sec.addEventListener('drop', (e) => { e.preventDefault(); sec.classList.remove('dm-over'); let d; try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (x) { return; } if (d.from !== sec.dataset.g) dmAssign(d.id, d.from, sec.dataset.g); });
  });
  if (data.pending) setTimeout(() => { if (token === dmToken && curPath() === '/calendar' && scState.view === 'map') scMapRender(main, edit, bar); }, 1500); // more addresses are being looked up
}
// moves a visit from one person to another (from: null replaces the whole team, as the pin's Assign to does)
async function dmAssign(id, from, to) {
  const j = byId(D.jobs, id); if (!j) return;
  const now = (j.staffIds || []).filter((x) => byId(D.staff, x));
  const ids = from === null ? (to ? [to] : []) : to ? [...new Set(now.map((x) => (x === from ? to : x)).concat(from ? [] : [to]))] : now.filter((x) => x !== from);
  try { await api('PUT', '/api/jobs/' + id, { staffIds: ids }); const s = byId(D.staff, to); toast(s ? `Assigned to ${s.name}` : 'Unassigned'); refresh(); } catch (x) { toast(x.message, true); }
}
// Best order: shows the new order and times first; Save sets them
A.dmOptimize = async (d) => {
  const date = ymd(scState.anchor); const who = d.g ? (byId(D.staff, d.g) || {}).name : 'Unassigned visits';
  const show = async (start) => {
    let r; try { r = await api('POST', '/api/dispatch/optimize', { date, staffId: d.g, start }); } catch (x) { return toast(x.message, true); }
    const first = r.order[0] ? r.order[0].startTime : '08:00'; const shared = r.order.filter((o) => o.shared.length);
    const b = modal(`Best order for ${who}`, `<p class="sub">${esc(fmtDate(date))} · about <strong>${r.miles} mi</strong> and ${r.driveMinutes >= 60 ? `${Math.floor(r.driveMinutes / 60)} h ${r.driveMinutes % 60 ? (r.driveMinutes % 60) + ' min' : ''}` : r.driveMinutes + ' min'} of driving${r.before > r.miles + 0.2 ? `, ${(r.before - r.miles).toFixed(1)} mi less than now` : r.before ? ' (the same as now)' : ''}.${r.base ? ' Starts from your business address.' : ''}</p>
<label class="fl dm-start"><span>First visit starts at</span><input type="time" name="start" value="${esc(first)}"></label>
<ol class="dm-plan">${r.order.map((o) => `<li><span class="dm-when">${esc(fmtTime(o.startTime))}–${esc(fmtTime(o.endTime))}</span><strong>${esc(o.title || 'Job #' + o.number)}</strong><span class="muted">${esc(o.address)}</span><span class="muted dm-drive">${o.drive ? `${o.drive} min drive · ${o.miles} mi` : ''}</span></li>`).join('')}</ol>
${shared.length ? `<p class="dm-note">${shared.map((o) => `${esc(o.title || 'Job #' + o.number)} is also on ${esc(o.shared.join(' and '))}’s route; its time changes for them too.`).join(' ')}</p>` : ''}
${r.unplaced.length ? `<p class="muted">Not on the map, left as they are: ${r.unplaced.map((o) => esc(o.title || 'Job #' + o.number)).join(', ')}.</p>` : ''}
<p class="muted" style="font-size:12px">Drive times are estimates from straight-line distance. Completed visits aren’t moved.</p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button type="button" class="btn" id="dmSave">Save these times</button></div>`);
    $('[name=start]', b).addEventListener('change', (e) => { if (/^\d{2}:\d{2}$/.test(e.target.value)) show(e.target.value); });
    $('#dmSave', b).addEventListener('click', async (e) => { e.target.disabled = true;
      try { await api('POST', '/api/dispatch/optimize', { date, staffId: d.g, start: $('[name=start]', b).value, apply: true }); closeModal(); toast(`${r.order.length} visits put in the best order`); refresh(); } catch (x) { e.target.disabled = false; toast(x.message, true); } });
  };
  show();
};
// open what was clicked: a job opens its page; a task or event opens in the quick pop-up to edit
function scOpen(kind, id, x, y) {
  if (kind === 'job') return navigate('/jobs/edit?id=' + id);
  const it = byId(kind === 'task' ? D.tasks : D.events, id); if (!it) return;
  scQuick({ ...it }, x, y, kind);
}
// the quick pop-up: Job / Task / Event with the date and time filled in; drag it by its top bar
function scQuick(p, x, y, editKind) {
  $$('.qc').forEach((el) => el.remove());
  let kind = editKind || 'job'; const edit = !!editKind && p.id;
  const box = document.createElement('div'); box.className = 'qc'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', edit ? 'Edit' : 'Add to the schedule');
  const draw = () => {
    const team = D.staff.filter(staffActive);
    const opened = box._open || {};
    box.innerHTML = `<div class="qc-bar" title="Drag to move"><span class="qc-grip" aria-hidden="true">⠿</span><span class="qc-h">${edit ? `Edit ${kind}` : ''}</span><button type="button" class="qc-x" aria-label="Close">×</button></div>
${edit ? '' : `<div class="qc-tabs" role="tablist">${[['job', 'Job'], ['task', 'Task'], ['event', 'Event']].map(([k, l]) => `<button type="button" role="tab" aria-selected="${kind === k}" class="${kind === k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>`}
<form class="qc-f">${kind !== 'event' ? `<div class="qc-cl"><input name="client" role="combobox" aria-expanded="false" aria-autocomplete="list" placeholder="Search client or address" autocomplete="off" value="${esc(p.clientId ? (byId(D.clients, p.clientId) || {}).name || '' : p.address || '')}" ${kind === 'job' ? 'required' : ''}><input type="hidden" name="clientId" value="${esc(p.clientId || '')}"><div class="qc-cl-pop" role="listbox" hidden></div></div>` : ''}
<input name="title" placeholder="Title" required maxlength="120" value="${esc(p.title || '')}">
${opened.notes || p.description || p.details ? `<textarea name="notes" rows="2" placeholder="${kind === 'event' ? 'Details' : 'Instructions'}">${esc(p.description || p.details || '')}</textarea>` : `<button type="button" class="qc-add" data-open="notes">+ ${kind === 'event' ? 'Add Details' : 'Add Instructions'}</button>`}
${kind === 'job' ? (opened.item ? '<div class="qc-item"><input name="itemDesc" placeholder="Product or service"><input name="itemQty" type="number" min="0" step="any" value="1" aria-label="Quantity"><input name="itemPrice" type="number" min="0" step="0.01" placeholder="Price" aria-label="Price"></div>' : '<button type="button" class="qc-add" data-open="item">+ Add Line Item</button>') : ''}
${kind !== 'event' ? (opened.assign || (p.staffIds || []).length ? `<div class="qc-team">${team.map((s) => `<label><input type="checkbox" name="staff" value="${s.id}" ${(p.staffIds || []).includes(s.id) ? 'checked' : ''}>${avatarHtml(s, 20)} ${esc(s.name)}</label>`).join('') || '<span class="muted">Add team members first</span>'}</div>` : '<button type="button" class="qc-add" data-open="assign">+ Assign</button>') : ''}
<div class="qc-when"><label class="fl"><span>Start date</span><input type="date" name="date" required value="${esc(p.date || ymd(new Date()))}"></label>
<div class="qc-times" ${p.anytime ? 'hidden' : ''}><label class="fl"><span>Start</span><input type="time" name="startTime" value="${esc(p.startTime || '09:00')}"></label><label class="fl"><span>End</span><input type="time" name="endTime" value="${esc(p.endTime || '10:00')}"></label></div></div>
<label class="qc-any"><input type="checkbox" name="anytime" ${p.anytime ? 'checked' : ''}> Anytime</label>
<div class="qc-foot${!edit && kind !== 'job' ? ' one' : ''}">${edit ? '<button type="button" class="btn danger" data-qc="delete">Delete</button>' : kind === 'job' ? `<button type="button" class="btn alt" data-qc="more">More Options</button>` : ''}<button class="btn">Save</button></div></form>`;
    const f = $('.qc-f', box);
    if (f.client) qcClientPick(box, f, () => { keep(); return p; }, draw);
    $$('.qc-tabs button', box).forEach((b) => b.addEventListener('click', () => { keep(); kind = b.dataset.k; draw(); }));
    $$('.qc-add', box).forEach((b) => b.addEventListener('click', () => { keep(); box._open = { ...(box._open || {}), [b.dataset.open]: true }; draw(); const t = $(`[name=${b.dataset.open === 'notes' ? 'notes' : b.dataset.open === 'item' ? 'itemDesc' : 'staff'}]`, box); if (t) t.focus(); }));
    $('.qc-x', box).addEventListener('click', () => box.remove());
    f.anytime.addEventListener('change', () => { $('.qc-times', box).hidden = f.anytime.checked; });
    const more = $('[data-qc=more]', box); if (more) more.addEventListener('click', () => { const v = read(); if (kind === 'job') { jobDraft = { title: v.title, clientId: v.clientId, date: v.date, startTime: v.startTime || '09:00', endTime: v.endTime || '10:00', staffIds: v.staffIds, description: v.notes, items: v.items }; box.remove(); navigate('/jobs/new'); } else { toast('Tasks and events have everything right here'); } });
    const del = $('[data-qc=delete]', box); if (del) del.addEventListener('click', async () => { if (!confirm(`Delete this ${kind}?`)) return; try { await api('DELETE', `/api/${kind}s/${p.id}`); box.remove(); toast(`${kind === 'task' ? 'Task' : 'Event'} deleted`); refresh(); } catch (x) { toast(x.message, true); } });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); const v = read();
      if (kind === 'job' && !v.clientId) return toast('Choose a client from the list', true);
      if (!v.anytime && v.endTime <= v.startTime) return toast('The end time must be after the start time', true);
      const btn = $('.qc-foot .btn:not(.alt):not(.danger)', box); btn.disabled = true;
      try {
        if (kind === 'job') await api('POST', '/api/jobs', { title: v.title, clientId: v.clientId, address: (byId(D.clients, v.clientId) || {}).address || '', date: v.date, startTime: v.startTime || '09:00', endTime: v.endTime || '10:00', anytime: v.anytime, staffIds: v.staffIds, description: v.notes, ...(v.items ? { items: v.items } : {}) });
        else { const doc = { title: v.title, date: v.date, startTime: v.anytime ? '' : v.startTime, endTime: v.anytime ? '' : v.endTime, anytime: v.anytime, ...(kind === 'task' ? { clientId: v.clientId, address: v.clientId ? '' : v.address, description: v.notes, staffIds: v.staffIds } : { details: v.notes }) };
          await api(edit ? 'PUT' : 'POST', edit ? `/api/${kind}s/${p.id}` : `/api/${kind}s`, doc); }
        box.remove(); toast(`${kind[0].toUpperCase() + kind.slice(1)} ${edit ? 'saved' : 'added'}`); refresh();
      } catch (x) { btn.disabled = false; toast(x.message, true); }
    });
  };
  // what's typed carries over when switching tabs or opening a section
  const read = () => { const f = $('.qc-f', box); const fd = new FormData(f); const typed = String(fd.get('client') || '').trim(); const picked = byId(D.clients, String(fd.get('clientId') || ''));
    const opt = picked && picked.name === typed ? { dataset: { id: picked.id } } : null;
    const desc = String(fd.get('itemDesc') || '').trim();
    return { clientId: opt ? opt.dataset.id : '', address: opt ? '' : typed, title: String(fd.get('title') || '').trim(), notes: String(fd.get('notes') || ''), date: fd.get('date'), startTime: fd.get('startTime') || '', endTime: fd.get('endTime') || '', anytime: !!fd.get('anytime'), staffIds: fd.getAll('staff'),
      items: desc ? [{ desc, qty: Number(fd.get('itemQty')) || 1, cost: Number(fd.get('itemPrice')) || 0, price: Number(fd.get('itemPrice')) || 0, markup: 0, markupType: 'percent' }] : null }; };
  const keep = () => { const v = read(); Object.assign(p, { clientId: v.clientId, address: v.address, title: v.title, description: v.notes, details: v.notes, date: v.date, startTime: v.startTime, endTime: v.endTime, anytime: v.anytime, staffIds: v.staffIds }); };
  draw(); document.body.appendChild(box);
  // place it beside the click, inside the window
  const w = box.offsetWidth; const h = box.offsetHeight; box.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 12)) + 'px'; box.style.top = Math.max(8, Math.min(innerHeight - h - 8, y - 40)) + 'px';
  const t = $('[name=client]', box) || $('[name=title]', box); t.focus();
  // move it by dragging the top bar
  $('.qc-bar', box).addEventListener('pointerdown', (e) => {
    if (e.target.closest('.qc-x')) return; e.preventDefault(); const ox = e.clientX - box.offsetLeft; const oy = e.clientY - box.offsetTop;
    const mv = (m) => { box.style.left = Math.max(0, Math.min(innerWidth - 60, m.clientX - ox)) + 'px'; box.style.top = Math.max(0, Math.min(innerHeight - 40, m.clientY - oy)) + 'px'; };
    const end = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', end); };
    addEventListener('pointermove', mv); addEventListener('pointerup', end);
  });
}
// the quick pop-up's client search: matches show right under the box, with New client at the bottom.
// The list is position:fixed so the pop-up's own scrolling doesn't clip it
function qcClientPick(box, f, hold, redraw) {
  const input = f.client; const idIn = f.clientId; const pop = $('.qc-cl-pop', box);
  let hits = []; let at = -1; const canNew = canDo('clients.edit');
  const place = () => { const r = input.getBoundingClientRect(); const below = innerHeight - r.bottom - 8; const above = r.top - 8;
    pop.style.left = r.left + 'px'; pop.style.width = r.width + 'px';
    if (below >= 200 || below >= above) { pop.style.top = r.bottom + 4 + 'px'; pop.style.bottom = ''; pop.style.maxHeight = Math.max(120, below - 4) + 'px'; }
    else { pop.style.top = ''; pop.style.bottom = innerHeight - r.top + 4 + 'px'; pop.style.maxHeight = above - 4 + 'px'; } };
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    hits = D.clients.filter((c) => !c.archived && (!q || [c.name, c.company, c.email, c.phone, c.address].some((v) => String(v || '').toLowerCase().includes(q))))
      .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50);
    at = hits.length ? Math.max(0, hits.findIndex((c) => c.id === idIn.value)) : -1;
    pop.innerHTML = (hits.length ? hits.map((c, i) => `<div class="qc-cl-opt${i === at ? ' on' : ''}" role="option" data-id="${c.id}"><strong>${esc(c.name)}</strong>${c.address || c.company ? `<span>${esc(c.address || c.company)}</span>` : ''}</div>`).join('')
      : `<div class="qc-cl-none">${D.clients.length ? 'No clients match' : 'No clients yet'}</div>`)
      + (canNew ? '<button type="button" class="qc-cl-new"><span aria-hidden="true">+</span> New client</button>' : '');
  };
  const mark = () => { $$('.qc-cl-opt', pop).forEach((o, i) => o.classList.toggle('on', i === at)); const o = $$('.qc-cl-opt', pop)[at]; if (o) o.scrollIntoView({ block: 'nearest' }); };
  const open = () => { draw(); pop.hidden = false; place(); input.setAttribute('aria-expanded', 'true'); };
  const close = () => { pop.hidden = true; input.setAttribute('aria-expanded', 'false'); };
  const choose = (c) => { idIn.value = c.id; input.value = c.name; close(); };
  const addNew = () => {
    const typed = input.value.trim(); const w = typed.split(/\s+/).filter(Boolean); const p = hold(); close(); box.hidden = true;
    clientOverEditor(w.length && !hits.length ? { firstName: w[0], lastName: w.slice(1).join(' ') } : {},
      (c) => { clientSavedInEditor(c); p.clientId = c.id; p.address = ''; box.hidden = false; redraw(); const t = $('[name=title]', box); if (t) t.focus(); },
      () => { box.hidden = false; });
  };
  input.addEventListener('focus', open); input.addEventListener('click', () => { if (pop.hidden) open(); });
  input.addEventListener('input', () => { idIn.value = ''; if (pop.hidden) open(); else { draw(); place(); } });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (pop.hidden) return open(); if (!hits.length) return; at = Math.max(0, Math.min(hits.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1))); mark(); }
    else if (e.key === 'Enter' && !pop.hidden && hits[at]) { e.preventDefault(); choose(hits[at]); }
    else if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close();
  });
  pop.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the box while choosing
  pop.addEventListener('click', (e) => { if (e.target.closest('.qc-cl-new')) return addNew(); const o = e.target.closest('.qc-cl-opt'); if (o) choose(byId(D.clients, o.dataset.id)); });
  input.addEventListener('blur', close);
  box.addEventListener('scroll', () => { if (!pop.hidden) place(); });
  $('.qc-bar', box).addEventListener('pointerdown', close); // dragging the pop-up: the list would be left behind
}
let jobDraft = null; // More Options: the quick pop-up's job, opened in the full job form
A.manageStaff = () => navigate('/team');

/* ===== /requests (Team Requests, in Settings): team members ask for time off; the owner, admins and anyone who can edit jobs approve it (a plan feature) ===== */
const TO_STATUS = { pending: ['Waiting', 'q-sent'], approved: ['Approved', 'active'], declined: ['Declined', 'q-draft'], canceled: ['Canceled', 'q-draft'] };
const toJobs = (r) => (r.jobs && r.jobs.length ? `<div class="to-jobs"><strong>${r.jobs.length} job${r.jobs.length === 1 ? '' : 's'} then:</strong> ${r.jobs.map((j) => `<a href="/jobs/edit?id=${j.id}" data-link>${esc(j.number)} ${esc(j.title)}</a> <span class="muted">(${fmtDate(j.date)}${j.startTime ? ', ' + esc(fmtTime(j.startTime)) : ''})</span>`).join(', ')}</div>` : '');
PAGES['/requests'] = {
  title: 'Team Requests',
  async render(main) {
    const T = await api('GET', '/api/time-off'); const today = ymd(new Date()); toState = T;
    const review = T.approver ? T.requests.filter((r) => r.status === 'pending' && !r.mine) : [];
    const mine = T.requests.filter((r) => r.mine);
    const off = T.requests.filter((r) => r.status === 'approved' && r.to >= today).sort((a, b) => a.from.localeCompare(b.from));
    const past = T.approver ? T.requests.filter((r) => !r.mine && r.status !== 'pending' && !(r.status === 'approved' && r.to >= today)).slice(0, 20) : [];
    const who = (r) => `<span class="to-dot" style="background:${esc(r.color || '#64748b')}"></span><strong>${esc(r.person)}</strong>`;
    const badge = (r) => `<span class="cstatus ${TO_STATUS[r.status][1]}">${TO_STATUS[r.status][0]}</span>`;
    main.innerHTML = `<div class="head"><div><h1>Team Requests</h1><p class="sub">${T.approver ? 'Requests from your team, and who’s off.' : 'Ask for time off and see who’s off.'} Approved time off shows on the Calendar.</p></div>
${T.canRequest ? '<button class="btn" data-act="requestOff">Request time off</button>' : ''}</div>
${T.approver ? `<div class="card"><h2>Waiting for you${review.length ? ` <span class="msg-n">${review.length}</span>` : ''}</h2>${review.length ? `<div class="to-list">${review.map((r) => `<div class="to-row"><div class="to-main"><div>${who(r)} · ${esc(r.when)}</div><p class="to-reason">${esc(r.reason)}</p>${toJobs(r)}<div class="muted to-meta">Asked ${fmtDate((r.createdAt || '').slice(0, 10))}</div></div>
<div class="to-acts"><button type="button" class="btn alt to-big" data-act="toDecide" data-id="${r.id}" data-ok="">Decline</button><button type="button" class="btn to-big" data-act="toDecide" data-id="${r.id}" data-ok="1">Approve</button></div></div>`).join('')}</div>` : '<p class="muted" style="margin:0">No requests waiting.</p>'}</div>` : ''}
${T.canRequest ? `<div class="card"><h2>Your requests</h2>${mine.length ? `<div class="to-list">${mine.map((r) => `<div class="to-row"><div class="to-main"><div><strong>${esc(r.when)}</strong> ${badge(r)}</div><p class="to-reason">${esc(r.reason)}</p>${r.note ? `<p class="to-note"><strong>${esc(r.decidedBy)}:</strong> ${esc(r.note)}</p>` : r.decidedBy && r.status !== 'canceled' ? `<div class="muted to-meta">${TO_STATUS[r.status][0]} by ${esc(r.decidedBy)}</div>` : ''}${r.status === 'pending' ? toJobs(r) : ''}</div>
<div class="to-acts">${['pending', 'approved'].includes(r.status) && r.to >= today ? `<button type="button" class="btn alt sm" data-act="toCancel" data-id="${r.id}">Cancel</button>` : ''}</div></div>`).join('')}</div>` : '<p class="muted" style="margin:0">You haven’t asked for time off yet.</p>'}</div>` : ''}
<div class="card"><h2>Who’s off</h2>${off.length ? `<div class="to-list">${off.map((r) => `<div class="to-row"><div class="to-main"><div>${who(r)} · ${esc(r.when)}${r.from <= today ? ' <span class="cstatus active">Off now</span>' : ''}</div></div>
<div class="to-acts">${T.approver && !r.mine ? `<button type="button" class="btn alt sm" data-act="toCancel" data-id="${r.id}">Cancel</button>` : ''}</div></div>`).join('')}</div>` : '<p class="muted" style="margin:0">No one has time off coming up.</p>'}</div>
${past.length ? `<div class="card"><h2>Recent decisions</h2><div class="to-list">${past.map((r) => `<div class="to-row"><div class="to-main"><div>${who(r)} · ${esc(r.when)} ${badge(r)}</div><div class="muted to-meta">${r.decidedBy ? `${TO_STATUS[r.status][0]} by ${esc(r.decidedBy)}` : ''}${r.note ? ` · “${esc(r.note)}”` : ''}</div></div></div>`).join('')}</div></div>` : ''}`;
  },
};
let toState = null;
// ask for time off; from a job page it starts with that job's day and hours
A.requestOff = (d, el, pre = {}) => {
  const today = ymd(new Date());
  const m = modal('Request time off', `<form id="tof"><label class="switchline"><input type="checkbox" name="allDay" ${pre.start ? '' : 'checked'}> All day</label>
<div class="row"><label>${pre.start ? 'Day' : 'First day'}<input type="date" name="from" required min="${today}" value="${esc(pre.from || today)}"></label><label class="to-to" ${pre.start ? 'hidden' : ''}>Last day<input type="date" name="to" min="${today}" value="${esc(pre.from || today)}"></label></div>
<div class="row to-hours" ${pre.start ? '' : 'hidden'}><label>From<input type="time" name="start" value="${esc(pre.start || '08:00')}"></label><label>To<input type="time" name="end" value="${esc(pre.end || '17:00')}"></label></div>
<label>Reason<textarea name="reason" rows="3" maxlength="500" required placeholder="e.g. Doctor’s appointment"></textarea></label>
<div id="toConf" class="to-conf"></div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Send request</button></div></form>`);
  const f = $('#tof', m.closest('.modal') || document);
  const read = () => { const all = f.allDay.checked; return { allDay: all, from: f.from.value, to: all ? f.to.value || f.from.value : f.from.value, start: all ? '' : f.start.value, end: all ? '' : f.end.value }; };
  // the jobs you're assigned to then, so whoever approves knows what needs covering
  const conf = () => { const r = read(); const jobs = (D.jobs || []).filter((j) => (j.staffIds || []).includes(me && me.staffId) && !['cancelled', 'completed'].includes(j.status) && j.date >= r.from && j.date <= r.to && (r.allDay || (j.startTime < r.end && (j.endTime || j.startTime) > r.start)));
    $('#toConf').innerHTML = jobs.length ? `<p class="notice">You’re assigned to ${jobs.length} job${jobs.length === 1 ? '' : 's'} then: ${jobs.map((j) => `${esc(j.number)} ${esc(j.title)} (${fmtDate(j.date)})`).join(', ')}. Your manager will see this.</p>` : ''; };
  f.allDay.addEventListener('change', () => { $('.to-to', f).hidden = !f.allDay.checked; $('.to-hours', f).hidden = f.allDay.checked; conf(); });
  f.from.addEventListener('change', () => { if (f.to.value < f.from.value) f.to.value = f.from.value; f.to.min = f.from.value; conf(); });
  [f.to, f.start, f.end].forEach((x) => x.addEventListener('change', conf)); conf();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('button.btn:not(.alt)', f); btn.disabled = true;
    try { await api('POST', '/api/time-off', { ...read(), reason: f.reason.value, jobId: pre.jobId || '' }); closeModal(); toast('Request sent. You’ll get an email when it’s decided.'); curPath() === '/requests' ? refresh() : navigate('/requests'); }
    catch (x) { btn.disabled = false; toast(x.message, true); }
  });
};
A.jobRequestOff = (d) => { $$('details.menu[open]').forEach((x) => { x.open = false; }); const j = byId(D.jobs, d.id); A.requestOff(d, null, { from: j.date, start: j.startTime, end: j.endTime || '', jobId: j.id }); };
A.toDecide = (d) => {
  const r = toState.requests.find((x) => x.id === d.id); const ok = !!d.ok;
  const m = modal(ok ? `Approve ${r.person}’s time off` : `Decline ${r.person}’s time off`, `<form id="tdf"><p style="margin-top:0"><strong>${esc(r.when)}</strong></p><p class="to-reason">${esc(r.reason)}</p>
${ok && r.jobs.length ? `<label class="switchline"><input type="checkbox" name="unassign" checked> Take ${esc(r.person.split(' ')[0])} off the ${r.jobs.length} job${r.jobs.length === 1 ? '' : 's'} then, so I can reassign ${r.jobs.length === 1 ? 'it' : 'them'}</label>${toJobs(r)}` : ''}
<label>Note to ${esc(r.person.split(' ')[0])} (optional)<textarea name="note" rows="2" maxlength="500" placeholder="${ok ? 'e.g. Enjoy your time off' : 'e.g. We’re short-staffed that week'}"></textarea></label>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn ${ok ? '' : 'danger'}">${ok ? 'Approve' : 'Decline'}</button></div></form>`);
  const f = $('#tdf', m.closest('.modal') || document);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('button.btn:not(.alt)', f); btn.disabled = true;
    try { const res = await api('POST', `/api/time-off/${r.id}/decide`, { approve: ok, note: f.note.value, unassign: !!(f.unassign && f.unassign.checked) }); closeModal();
      toast(ok ? `Approved${res.removedFrom ? `. ${r.person.split(' ')[0]} was taken off ${res.removedFrom} job${res.removedFrom === 1 ? '' : 's'}; reassign ${res.removedFrom === 1 ? 'it' : 'them'} in Jobs.` : ''}` : 'Declined'); refresh(); }
    catch (x) { btn.disabled = false; toast(x.message, true); }
  });
};
A.toCancel = async (d) => { const r = toState.requests.find((x) => x.id === d.id); if (!confirm(`Cancel ${r.mine ? 'your' : `${r.person}’s`} time off ${r.when}?`)) return; try { await api('POST', `/api/time-off/${d.id}/cancel`, {}); toast('Time off canceled'); refresh(); } catch (x) { toast(x.message, true); } };

/* ===== /team ===== */
// Team members are the staff list (also used for job assignment and the Calendar). There are no logins yet,
// so "last active" is the member's most recent job, and adding a member doesn't send an invitation.
const staffActive = (s) => s.status !== 'deactivated';
const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
let teamView = { q: '', sort: 'name', dir: 1, per: 25, page: 0 };
PAGES['/team'] = {
  title: 'Manage Team',
  async render(main) {
    const v = teamView; const today = ymd(new Date()); teamUsers = await api('GET', '/api/users');
    const lastJob = (s) => D.jobs.filter((j) => (j.staffIds || []).includes(s.id) && j.status !== 'cancelled' && j.date <= today).map((j) => j.date).sort().pop() || '';
    const nextJob = (s) => D.jobs.filter((j) => (j.staffIds || []).includes(s.id) && j.status === 'scheduled' && j.date >= today).map((j) => j.date).sort()[0] || '';
    const list = D.staff.filter((s) => !v.q || [s.name, s.role, s.email, s.phone].join(' ').toLowerCase().includes(v.q.toLowerCase()));
    const key = { name: (s) => (s.name || '').toLowerCase(), role: (s) => (s.role || '').toLowerCase(), last: lastJob, status: (s) => (staffActive(s) ? 0 : 1) }[v.sort];
    list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * v.dir);
    const pages = Math.max(1, Math.ceil(list.length / v.per)); v.page = Math.min(v.page, pages - 1);
    const shown = list.slice(v.page * v.per, (v.page + 1) * v.per);
    const th = (k, label) => `<th><button class="th-btn" data-act="teamSort" data-k="${k}">${label} <span class="sort ${v.sort === k ? 'on' : ''}">${v.sort === k ? (v.dir > 0 ? '▲' : '▼') : '⇅'}</span></button></th>`;
    const active = D.staff.filter(staffActive).length;
    main.innerHTML = `<div class="head"><h1>Manage team</h1><div class="actions"><span class="seat-pill"><strong>${active}</strong> active member${active === 1 ? '' : 's'}</span><button class="btn" data-act="newStaff">Add Team Member</button></div></div>
<p class="sub" style="margin-top:-6px">Manage your team members in one place. Team members can be assigned to jobs and appear on the Calendar.</p>
<div class="cfilters"><div class="search-x" style="max-width:none"><input id="tq" type="search" placeholder="Search team members" value="${esc(v.q)}" aria-label="Search team members"><button type="button" class="icon-btn" data-act="teamClear" aria-label="Clear search" ${v.q ? '' : 'hidden'}>✕</button></div></div>
<h2 class="ftitle" style="font-size:15px">Team members (${list.length})</h2>
<div class="card ctable"><div class="tablewrap"><table class="m-team"><tr>${th('name', 'Name')}${th('role', 'Role')}${th('last', 'Last job')}<th>Next job</th>${th('status', 'Status')}<th>Login</th><th>Contact</th></tr>
${shown.map((s) => `<tr class="crow" data-id="${s.id}"><td><span class="tname">${avatarHtml(s, 32)}<a href="#" data-act="editStaff" data-id="${s.id}">${esc(s.name)}</a></span></td>
<td>${esc(s.role) || '<span class="muted">—</span>'}</td><td>${lastJob(s) ? fmtDate(lastJob(s)) : '<span class="muted">No jobs yet</span>'}</td><td>${nextJob(s) ? fmtDate(nextJob(s)) : '<span class="muted">—</span>'}</td>
<td>${staffActive(s) ? '<span class="cstatus active">Active</span>' : '<span class="cstatus q-draft">Deactivated</span>'}</td><td>${loginBadge(userFor(s))}</td>
<td class="muted">${[s.phone ? `<a href="tel:${esc(s.phone)}">${esc(s.phone)}</a>` : '', s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : ''].filter(Boolean).join('<br>') || '—'}</td></tr>`).join('')
  || `<tr><td colspan="7" class="empty">${D.staff.length ? 'No team members match your search' : 'No team members yet. Add your first one.'}</td></tr>`}</table></div>
<div class="tfoot"><span>Showing ${list.length ? v.page * v.per + 1 : 0}–${Math.min(list.length, (v.page + 1) * v.per)} of ${list.length} item${list.length === 1 ? '' : 's'}</span>
<span class="pager"><select id="tper" aria-label="Items per page">${[25, 50, 100].map((n) => `<option ${v.per === n ? 'selected' : ''}>${n}</option>`).join('')}</select> per page
<button class="btn alt sm" data-act="teamPage" data-d="-1" ${v.page ? '' : 'disabled'} aria-label="Previous page">‹</button><button class="btn alt sm" data-act="teamPage" data-d="1" ${v.page < pages - 1 ? '' : 'disabled'} aria-label="Next page">›</button></span></div></div>`;
    let t; $('#tq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(async () => { teamView.q = e.target.value; teamView.page = 0; await refresh(); const q = $('#tq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); });
    $('#tper').addEventListener('change', (e) => { teamView.per = Number(e.target.value); teamView.page = 0; refresh(); });
    $$('.crow').forEach((r) => r.addEventListener('click', (e) => { if (!e.target.closest('a')) navigate('/team/edit?id=' + r.dataset.id); }));
  },
};
A.teamSort = (d) => { teamView.dir = teamView.sort === d.k ? -teamView.dir : (d.k === 'last' ? -1 : 1); teamView.sort = d.k; refresh(); };
A.teamClear = () => { teamView.q = ''; refresh().then(() => $('#tq').focus()); };
A.teamPage = (d) => { teamView.page += Number(d.d); refresh(); };
// working hours: { sun: { on, start, end }, … }; members without saved hours work Mon–Fri 9–5
const WEEK = [['sun', 'Sunday'], ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday']];
function staffHours(s) {
  const h = (s && s.hours) || {};
  return Object.fromEntries(WEEK.map(([k]) => [k, h[k] || { on: !['sun', 'sat'].includes(k), start: '09:00', end: '17:00' }]));
}
// is `date` (YYYY-MM-DD) start–end inside the member's hours? used to warn when scheduling jobs
function withinHours(s, date, start, end) {
  const h = staffHours(s)[WEEK[parseD(date).getDay()][0]];
  return h.on && start >= h.start && end <= h.end;
}
// shared working-hours editor (team member page + My profile + Company Profile): a read view and an edit table toggled by Edit/Done; on phones a row opens a sheet from the bottom instead
const hoursHtml = (hours, closed = 'Not working', { toggle = true } = {}) => `<div class="hours-wrap" data-closed="${esc(closed)}"><table class="hours view">${WEEK.map(([k, l]) => `<tr data-act="editHoursRow" data-day="${k}"><td>${l}</td><td>${hours[k].on ? `${fmtTime(hours[k].start)} – ${fmtTime(hours[k].end)}` : `<span class="muted">${closed}</span>`}</td></tr>`).join('')}</table>
<table class="hours edit" hidden>${WEEK.map(([k, l]) => `<tr data-day="${k}"><td><label class="hours-on"><input type="checkbox" ${hours[k].on ? 'checked' : ''}> ${l}</label></td><td><input type="time" class="h-start" value="${hours[k].start}" aria-label="${l} start"></td><td>–</td><td><input type="time" class="h-end" value="${hours[k].end}" aria-label="${l} end"></td></tr>`).join('')}</table>
${toggle ? '<button type="button" class="link-btn" data-act="tmHoursEdit">Edit</button>' : ''}</div>`;
const readHoursFrom = (root) => Object.fromEntries($$('.hours.edit tr', root).map((r) => [r.dataset.day, { on: $('input[type=checkbox]', r).checked, start: $('.h-start', r).value || '09:00', end: $('.h-end', r).value || '17:00' }]));
const wireHours = (root) => $$('.hours.edit input[type=checkbox]', root).forEach((c) => { const sync = () => $$('input[type=time]', c.closest('tr')).forEach((i) => { i.disabled = !c.checked; }); c.addEventListener('change', sync); sync(); });
const badHours = (h) => { const bad = WEEK.find(([k]) => h[k].on && h[k].end <= h[k].start); return bad ? `${bad[1]}: the end time must be after the start time` : ''; };
const avatarHtml = (s, size) => (s.photo ? `<img class="avatar" src="${esc(s.photo)}" alt="" style="width:${size}px;height:${size}px;object-fit:cover">` : `<span class="avatar" style="background:${esc(s.color || '#64748b')};width:${size}px;height:${size}px;font-size:${Math.round(size / 2.6)}px">${esc(initials(s.name))}</span>`);
function teamMemberPage(main, s) {
  s = s || {}; const palette = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#db2777'];
  const hours = staffHours(s); let photo = s.photo || '';
  const req = s.id ? '' : '*'; // a new team member needs a name, email and mobile number
  main.innerHTML = `<a href="/team" data-link class="back">← Manage team</a><h1 class="tm-title">${esc(s.name) || 'New team member'}</h1>
<form class="tmform"><div class="qcard"><h2>Personal info</h2>
<div class="tm-photo"><span class="tm-av">${avatarHtml({ ...s, name: s.name || '?' }, 72)}</span><label class="btn alt sm">Upload image<input type="file" id="tmPhoto" accept="image/png,image/jpeg,image/webp" hidden></label>
<button type="button" class="btn alt sm" data-act="tmPhotoRemove" ${photo ? '' : 'hidden'}>Remove</button></div>
<div class="tm-grid"><div>
<label class="fl"><span>Full name${req}</span><input name="name" required maxlength="100" autocomplete="off" value="${esc(s.name)}"></label>
<label class="fl"><span>Email address${req}</span><input name="email" type="email" ${s.id ? '' : 'required'} autocomplete="off" value="${esc(s.email)}"></label>
<label class="fl"><span>Mobile phone number${req}</span><input name="phone" type="tel" ${s.id ? '' : 'required'} autocomplete="off" value="${esc(s.phone)}" placeholder="(713) 555-0100"></label>
<label class="fl"><span>Role</span><input name="role" value="${esc(s.role)}" placeholder="e.g. Owner, Technician, Installer"></label></div>
<div class="addr"><input name="street" value="${esc(s.street)}" placeholder="Street address" aria-label="Street address"><input name="city" value="${esc(s.city)}" placeholder="City" aria-label="City">
<input name="state" value="${esc(s.state)}" placeholder="State" aria-label="State"><div class="addr-row"><input name="zip" value="${esc(s.zip)}" placeholder="ZIP code" aria-label="ZIP code"><input name="country" value="${esc(s.country || 'United States')}" placeholder="Country" aria-label="Country"></div></div></div>
<div class="row tm-extra"><label>Calendar color<input name="color" type="color" value="${esc(s.color || palette[D.staff.length % palette.length])}"></label>
${isOwnerMember(s) ? '' : `<label>Status<select name="status"><option value="active">Active</option><option value="deactivated" ${s.status === 'deactivated' ? 'selected' : ''}>Deactivated (hidden from scheduling)</option></select></label>`}</div>
<hr class="tm-hr"><h2>Schedule</h2>${s.id ? `<div data-hours-root><div class="cs-hours-h"><h3>Working hours</h3>${hoursPencil('working hours')}</div>
<p class="muted">You'll get a warning when a job is booked outside them.</p>
${autoHoursHtml(hours, 'Not working')}${hoursFoot}</div>` : `<h3>Working hours</h3>
<p class="muted">You'll get a warning when a job is booked outside them.</p>
${hoursHtml(hours)}`}</div>
${s.id ? (isOwnerMember(s) ? '' : `<div class="foot"><button type="button" class="btn danger" data-act="delStaff" data-id="${s.id}">Remove team member</button></div>`)
    : '<div class="foot"><a class="btn alt" href="/team" data-link>Cancel</a><button class="btn">Add team member</button></div>'}</form>${s.id ? '<div class="qcard login-card" id="loginCard"><h2>Login access</h2><p class="muted">Loading…</p></div>' : ''}`;
  const form = $('form', main); if (s.id) renderLoginCard(s);
  const readHours = () => readHoursFrom(form); if (!s.id) wireHours(form);
  $('#tmPhoto').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; if (f.size > 8e6) return toast('Image must be under 8 MB', true);
    photo = await resizeImage(f, 256); e.target.value = ''; $('.tm-av', form).innerHTML = avatarHtml({ photo }, 72); $('[data-act=tmPhotoRemove]', form).hidden = false; if (s.id) saveMember();
  });
  form._clearPhoto = () => { photo = ''; $('.tm-av', form).innerHTML = avatarHtml({ ...s, photo: '', name: $('[name=name]', form).value || '?' }, 72); $('[data-act=tmPhotoRemove]', form).hidden = true; if (s.id) saveMember(); };
  // a team member who's already added saves on their own, like My profile: a field when it changes, the photo when it's uploaded or removed,
  // the working hours with their pencil. A new one is added with the Add team member button.
  const body = () => ({ ...Object.fromEntries(new FormData(form)), photo });
  let last = JSON.stringify(body()); let busy = false; let again = false;
  async function saveMember() {
    if (busy) { again = true; return; }
    const b = body(); if (JSON.stringify(b) === last) return;
    if (!form.checkValidity()) return form.reportValidity();
    busy = true;
    try {
      const saved = await api('PUT', '/api/staff/' + s.id, b); const emailWas = s.email;
      Object.assign(s, saved); const k = D.staff.findIndex((x) => x.id === s.id); if (k >= 0) D.staff[k] = { ...D.staff[k], ...saved };
      $('.tm-title', main).textContent = s.name; last = JSON.stringify(body()); toast('Team member saved');
      if (s.email !== emailWas) renderLoginCard(s); // the login card offers an invite to the email on file
    } catch (err) { toast(err.message, true); }
    busy = false; if (again) { again = false; saveMember(); }
  }
  if (s.id) {
    form.addEventListener('change', (e) => { if (e.target.id !== 'tmPhoto' && !e.target.closest('.hours-wrap')) saveMember(); });
    wireHoursEditor($('[data-hours-root]', form), hours, 'Not working', async (h) => {
      const saved = await api('PUT', '/api/staff/' + s.id, { hours: h }); Object.assign(s, saved); const k = D.staff.findIndex((x) => x.id === s.id); if (k >= 0) D.staff[k] = { ...D.staff[k], ...saved };
      toast('Working hours saved');
    });
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); if (s.id) return saveMember();
    const b = Object.fromEntries(new FormData(form)); b.photo = photo; b.hours = readHours();
    const bad = badHours(b.hours); if (bad) return toast(bad, true);
    if (!s.id && String(b.phone || '').replace(/\D/g, '').length < 10) { toast('Enter a mobile number with the area code', true); return $('[name=phone]', form).focus(); }
    s.id ? await api('PUT', '/api/staff/' + s.id, b) : await api('POST', '/api/staff', b);
    toast(s.id ? 'Team member saved' : 'Team member added'); navigate('/team');
  });
}
// ---- team logins: who can sign in, and with what access ----
let teamUsers = [];
const userFor = (s) => teamUsers.find((u) => u.staffId === s.id) || (s.email ? teamUsers.find((u) => u.email === String(s.email).trim().toLowerCase()) : null);
const isOwnerMember = (s) => !!(s && s.id && teamUsers.some((u) => u.role === 'owner' && u.staffId === s.id));
// the business's roles (Settings → Roles & Permissions), plus Admin; the server enforces what each can do
let teamRoles = []; let teamCustom = false; // teamCustom: the plan includes Custom roles (otherwise Manager and Team Member only)
const roleOptions = (cur) => [...teamRoles.map((r) => [r.id, r.name + (r.desc ? `: ${r.desc}` : '')]), ...(teamCustom || cur === 'admin' ? [['admin', 'Admin: full access, including team and settings']] : [])];
const loginBadge = (u) => (!u ? '<span class="muted">No login</span>' : u.status === 'invited' ? '<span class="cstatus q-sent">Invited</span>' : `<span class="cstatus ${['owner', 'admin'].includes(u.role) ? 'active' : 'q-approved'}">${esc(u.roleName || u.role)}</span>`);
const roleSelect = (u) => { const opts = roleOptions(u && u.role); const cur = u ? u.role : (teamRoles.find((r) => r.id === 'technician') || teamRoles[0] || { id: 'admin' }).id;
  return `<label class="role-pick">Role<select id="loginRole">${opts.some(([k]) => k === cur) ? '' : '<option value="" selected disabled>Choose a role</option>'}${opts.map(([k, l]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
<p class="muted" style="font-size:13px;margin:6px 0 0">${teamCustom ? 'Change what each role can do in <a href="/settings/roles" data-link>Roles &amp; Permissions</a>.' : `Want your own roles and an Admin role? <strong>Custom roles &amp; permissions</strong> is included on other plans.${role() === 'owner' ? ' <a href="/settings/billing?upgrade=1" data-link>See plans</a>' : ''}`}</p>`; };
async function renderLoginCard(s, note) {
  const box = $('#loginCard'); if (!box) return;
  [teamUsers, teamRoles] = await Promise.all([api('GET', '/api/users'), api('GET', '/api/roles').then((r) => { teamCustom = r.custom; return r.roles; })]); const u = userFor(s);
  let body;
  if (u && u.role === 'owner') body = `<p>Account owner, logs in as <strong>${esc(u.email)}</strong>. Owners always have full access.</p>`;
  else if (!u && !String(s.email || '').includes('@')) body = '<p class="muted">Add an email address above and save, then you can invite them to log in.</p>';
  else if (!u) body = `<p class="muted">${esc(s.name)} can't log in yet. Send an invite to <strong>${esc(s.email)}</strong> so they can set a password.</p>${roleSelect(null)}<div class="foot" style="justify-content:flex-start"><button type="button" class="btn" data-act="tmInvite" data-id="${s.id}">Invite to log in</button></div>`;
  else body = `<p>${u.status === 'invited' ? `Invited ${fmtDate((u.invitedAt || '').slice(0, 10))}. Waiting for them to set a password.` : `Logs in as <strong>${esc(u.email)}</strong>${u.lastLoginAt ? ` · last login ${fmtDate(u.lastLoginAt.slice(0, 10))}` : ''}.`}</p>
${staffActive(s) ? '' : '<p class="notice">This team member is deactivated, so their login is turned off until you reactivate them.</p>'}${roleSelect(u)}
<div class="foot" style="justify-content:flex-start">${u.status === 'invited' ? `<button type="button" class="btn alt" data-act="tmInvite" data-id="${s.id}">Resend invite</button>` : ''}<button type="button" class="btn danger" data-act="tmRevoke" data-id="${s.id}">Remove login access</button></div>`;
  box.innerHTML = `<div class="qcard-h"><h2>Login access</h2>${loginBadge(u)}</div>${body}${note || ''}`;
  const sel = $('#loginRole', box);
  if (sel && u && u.role !== 'owner') sel.addEventListener('change', async () => { await api('PUT', '/api/users/' + u.id, { role: sel.value }); toast(`${s.name}’s role is now ${sel.options[sel.selectedIndex].text.split(':')[0]}`); renderLoginCard(s); });
}
A.tmInvite = async (d) => {
  const s = byId(D.staff, d.id); const role = ($('#loginRole') || {}).value; if (!role) return toast('Choose a role first', true);
  let r;
  try { r = await api('POST', '/api/users/invite', { staffId: s.id, role }); }
  catch (e) { // past the plan's included logins: say what the extra login costs, then invite on a yes
    const x = e.data && e.data.confirmExtra; if (!x) throw e;
    const price = `${money(x.cents / 100).replace(/\.00$/, '')} a ${x.interval}`;
    const when = !x.billed ? 'Nothing is charged on this server.' : x.trial ? 'It’s added to your bill when your trial ends.' : 'The part of this billing period that’s left is added to your next bill.';
    if (!confirm(`Your ${x.plan} plan includes ${x.included} login${x.included === 1 ? '' : 's'}. Inviting ${s.name} adds an extra login for ${price} (${x.extra} extra in all). ${when} Removing a login takes it off.\n\nInvite ${s.name}?`)) return;
    r = await api('POST', '/api/users/invite', { staffId: s.id, role, confirmExtra: true });
  }
  const note = r.emailed ? `<p class="msg-ok">Invite emailed to ${esc(s.email)}. The link works for 7 days.</p>`
    : `<div class="notice" style="margin-top:12px">The invite email couldn't be sent (${esc(r.detail || 'email not set up')}). Send ${esc(s.name)} this link yourself, by text for example. It works for 7 days:
<div class="copy-row"><input readonly value="${esc(r.link)}" onclick="this.select()" aria-label="Invite link"><button type="button" class="btn alt sm" data-act="copyInput">Copy</button></div></div>`;
  toast(r.emailed ? 'Invite sent' : 'Invite link created'); renderLoginCard(s, note);
};
A.tmRevoke = async (d) => {
  const s = byId(D.staff, d.id); const u = userFor(s); if (!u) return;
  if (!confirm(`Remove ${s.name}'s login? They'll be signed out right away. Their team member record and jobs stay.`)) return;
  await api('DELETE', '/api/users/' + u.id); toast('Login access removed'); renderLoginCard(s);
};
A.copyInput = async (d, el) => { const i = el.parentElement.querySelector('input'); try { await navigator.clipboard.writeText(i.value); } catch (e) { i.select(); document.execCommand('copy'); } el.textContent = 'Copied'; };
// phones: tap a day to change it. The sheet fills in the page's form, which keeps the change when the page is saved.
A.editHoursRow = (d, el) => {
  if (!phoneMq.matches) return;
  const w = el.closest('.hours-wrap'); const edit = (k) => $(`.hours.edit tr[data-day="${k}"]`, w);
  const f = mSheet('Edit hours', `${mField('Day', `<select name="day">${WEEK.map(([k, l]) => `<option value="${k}" ${k === d.day ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
<label class="m-chk"><input type="checkbox" name="on"> Open this day</label>${mField('Open time', '<input type="time" name="start">')}${mField('Close time', '<input type="time" name="end">')}
${mSaveBtn('Done')}${w.dataset.autosave ? '' : '<p class="muted ms-note">Tap Save on the page to keep your changes.</p>'}`);
  const sync = () => { f.start.disabled = f.end.disabled = !f.on.checked; };
  const load = () => { const r = edit(f.day.value); f.on.checked = $('input[type=checkbox]', r).checked; f.start.value = $('.h-start', r).value; f.end.value = $('.h-end', r).value; sync(); };
  f.day.addEventListener('change', load); f.on.addEventListener('change', sync); load();
  f.addEventListener('submit', (e) => {
    e.preventDefault(); if (f.on.checked && (!f.start.value || !f.end.value || f.end.value <= f.start.value)) return toast('The close time must be after the open time', true);
    const r = edit(f.day.value); const c = $('input[type=checkbox]', r); c.checked = f.on.checked; $('.h-start', r).value = f.start.value; $('.h-end', r).value = f.end.value; c.dispatchEvent(new Event('change'));
    $(`.hours.view tr[data-day="${f.day.value}"] td:last-child`, w).innerHTML = f.on.checked ? `${fmtTime(f.start.value)} – ${fmtTime(f.end.value)}` : `<span class="muted">${esc(w.dataset.closed)}</span>`;
    mClose(); w.dispatchEvent(new CustomEvent('hourschange', { bubbles: true }));
  });
};
// hours that save on their own (My profile, Company Profile): the pencil (hoursPencil) shows the edit table with Cancel / Save (hoursFoot);
// on phones the pencil is hidden and Done in a day's sheet saves. The pencil, foot and hours sit inside an element with data-hours-root.
const autoHoursHtml = (hours, closed) => hoursHtml(hours, closed, { toggle: false }).replace('class="hours-wrap"', 'class="hours-wrap" data-autosave="1"');
const hoursPencil = (what) => `<button type="button" class="icon-btn hours-pen" data-act="hoursEdit" title="Edit ${what}" aria-label="Edit ${what}">${PENCIL}</button>`;
const hoursFoot = '<div class="foot hours-foot" hidden><button type="button" class="btn alt" data-act="hoursCancel">Cancel</button><button type="button" class="btn" data-act="hoursSave">Save</button></div>';
// save(hours): stores them (throws on failure)
function wireHoursEditor(root, hours, closed, save) {
  const editing = (on) => { $('.hours.edit', root).hidden = !on; $('.hours.view', root).hidden = on; $('.hours-pen', root).hidden = on; $('.hours-foot', root).hidden = !on; };
  const redraw = () => { $('.hours-wrap', root).outerHTML = autoHoursHtml(hours, closed); wireHours(root); editing(false); };
  const commit = async () => {
    const h = readHoursFrom(root); const bad = badHours(h); if (bad) { toast(bad, true); return false; }
    try { await save(h); } catch (err) { toast(err.message, true); return false; }
    hours = h; return true;
  };
  wireHours(root);
  root._hoursEdit = () => editing(true); root._hoursCancel = redraw; root._hoursSave = async () => { if (await commit()) redraw(); };
  root.addEventListener('hourschange', async () => { if (!(await commit())) redraw(); });
}
A.hoursEdit = (d, el) => el.closest('[data-hours-root]')._hoursEdit();
A.hoursCancel = (d, el) => el.closest('[data-hours-root]')._hoursCancel();
A.hoursSave = (d, el) => el.closest('[data-hours-root]')._hoursSave();
A.tmHoursEdit = (d, el) => { const w = el.closest('.hours-wrap'); const editing = $('.hours.edit', w).hidden; $('.hours.edit', w).hidden = !editing; $('.hours.view', w).hidden = editing; el.textContent = editing ? 'Done' : 'Edit'; };
A.tmPhotoRemove = (d, el) => el.closest('form')._clearPhoto();
PAGES['/team/new'] = { title: 'Add team member', render: (main) => teamMemberPage(main) };
PAGES['/team/edit'] = {
  title: 'Team member',
  async render(main) {
    const s = byId(D.staff, new URLSearchParams(location.search).get('id'));
    teamUsers = await api('GET', '/api/users').catch(() => teamUsers); // to tell whether this is the owner
    if (!s) { main.innerHTML = '<div class="card"><h1>Team member not found</h1><p><a href="/team" data-link>Back to Manage team</a></p></div>'; return; }
    teamMemberPage(main, s);
  },
};
A.newStaff = () => navigate('/team/new'); A.editStaff = (d) => navigate('/team/edit?id=' + d.id);
A.delStaff = async (d) => {
  if (!confirm('Remove this team member? Their jobs become unassigned. To keep their job history, set their status to Deactivated instead.')) return;
  await api('DELETE', '/api/staff/' + d.id);
  for (const j of D.jobs.filter((x) => (x.staffIds || []).includes(d.id))) await api('PUT', '/api/jobs/' + j.id, { staffIds: j.staffIds.filter((x) => x !== d.id) });
  toast('Team member removed'); navigate('/team');
};

/* ===== /services ===== */
let svcView = { q: '', sort: 'name', dir: 1, cat: '' }; // cat: one category ('__none' = items without one), '' = all
const svcSel = new Set(); // checked items, for Edit (category, type) and Delete on the bar above the table
const svcType = (s) => (s.type === 'product' ? 'Product' : 'Service');
// the catalog's categories (Products & services → Category), A–Z, one per spelling ignoring case
const svcCats = () => { const m = new Map(); (D.services || []).forEach((s) => { const c = String(s.category || '').trim(); if (c && !m.has(c.toLowerCase())) m.set(c.toLowerCase(), c); }); return [...m.values()].sort((a, b) => a.localeCompare(b)); };
const svcCatIs = (s, cat) => !cat || (cat === '__none' ? !String(s.category || '').trim() : String(s.category || '').trim().toLowerCase() === cat.toLowerCase());
PAGES['/services'] = {
  title: 'Products & Services',
  async render(main) {
    const v = svcView;
    const cats = svcCats(); if (v.cat && v.cat !== '__none' && !cats.some((c) => c.toLowerCase() === v.cat.toLowerCase())) v.cat = '';
    const list = D.services.filter((s) => svcCatIs(s, v.cat) && (!v.q || [s.name, s.description, svcType(s), s.category].join(' ').toLowerCase().includes(v.q.toLowerCase())));
    const key = { name: (s) => (s.name || '').toLowerCase(), type: (s) => svcType(s) + (s.name || '').toLowerCase(), cat: (s) => (s.category ? '0' + s.category.toLowerCase() : '1') + '|' + (s.name || '').toLowerCase(), price: (s) => Number(s.price) || 0 }[v.sort];
    list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * v.dir);
    { const shown = new Set(list.map((s) => s.id)); [...svcSel].forEach((id) => { if (!shown.has(id)) svcSel.delete(id); }); } // only what's on screen stays checked (a search or filter never leaves hidden items to delete)
    const th = (k, label, cls = '') => `<th class="${cls}"><button class="th-btn" data-act="svcSort" data-k="${k}">${label} <span class="sort ${v.sort === k ? 'on' : ''}">${v.sort === k ? (v.dir > 0 ? '▲' : '▼') : '⇅'}</span></button></th>`;
    main.innerHTML = `<div class="head"><div><h1>Products &amp; services</h1><p class="sub">Add and update your products and services to stay organized when creating quotes, jobs and invoices.</p></div></div>
${mxPromo()}<div class="cfilters"><div class="search-x"><input id="sq" type="search" placeholder="Search" value="${esc(v.q)}" aria-label="Search products and services"><button type="button" class="icon-btn" data-act="svcClear" aria-label="Clear search" ${v.q ? '' : 'hidden'}>✕</button></div>
${cats.length ? `<select id="svcCat" aria-label="Category" style="width:auto"><option value="">All categories</option>${cats.map((c) => `<option value="${esc(c)}" ${v.cat.toLowerCase() === c.toLowerCase() ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="__none" ${v.cat === '__none' ? 'selected' : ''}>No category</option></select>` : ''}
<span style="margin-left:auto"></span>${cats.length ? '<button type="button" class="btn alt" data-act="svcCatsEdit">Categories</button>' : ''}<a class="btn alt" href="/services/import" data-link>Import</a><button class="btn" data-act="newService">+ Add Item</button></div>
${svcSel.size ? `<div class="bulk"><strong>${svcSel.size} selected</strong><button class="btn sm" data-act="svcBulkEdit">Edit</button><button class="btn danger sm" data-act="svcBulkDelete">Delete</button><button class="btn alt sm" data-act="svcClearSel">Clear selection</button></div>` : ''}
<div class="card ctable"><div class="tablewrap"><table><tr><th class="sel-td"><input type="checkbox" id="svcSelAll" aria-label="Select all" ${list.length && list.every((s) => svcSel.has(s.id)) ? 'checked' : ''} ${list.length ? '' : 'disabled'}></th>${th('name', 'Name')}<th class="svc-desc">Description</th>${cats.length ? th('cat', 'Category') : ''}${th('type', 'Type')}${th('price', 'Price', 'r')}</tr>
${list.map((s) => `<tr class="crow" data-id="${s.id}"><td class="sel-td"><input type="checkbox" class="svcsel" value="${s.id}" ${svcSel.has(s.id) ? 'checked' : ''} aria-label="Select ${esc(s.name)}"></td><td><strong>${esc(s.name)}</strong></td><td class="svc-desc">${esc(s.description)}</td>${cats.length ? `<td>${s.category ? `<span class="svc-cat">${esc(s.category)}</span>` : '<span class="muted">—</span>'}</td>` : ''}<td>${svcType(s)}</td><td class="r" style="white-space:nowrap">${money(s.price)}<span class="muted"> / ${esc(s.unit || (s.type === 'product' ? 'each' : 'job'))}</span></td></tr>`).join('')
  || `<tr><td colspan="${cats.length ? 6 : 5}" class="empty">${D.services.length ? 'Nothing matches your search' : 'No products or services yet. Add your first one.'}</td></tr>`}</table></div></div>`;
    $('#svcSelAll').addEventListener('change', (e) => { list.forEach((s) => (e.target.checked ? svcSel.add(s.id) : svcSel.delete(s.id))); refresh(); });
    $$('.svcsel').forEach((b) => b.addEventListener('change', (e) => { e.target.checked ? svcSel.add(e.target.value) : svcSel.delete(e.target.value); refresh(); }));
    if ($('#svcCat')) $('#svcCat').addEventListener('change', (e) => { svcView.cat = e.target.value; refresh(); });
    let t; $('#sq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(async () => { svcView.q = e.target.value; await refresh(); const q = $('#sq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); });
    $$('.crow').forEach((r) => r.addEventListener('click', (e) => {
      const cell = e.target.closest('.sel-td'); if (!cell) return serviceForm(byId(D.services, r.dataset.id));
      if (e.target.matches('input')) return; const b = $('input', cell); b.checked = !b.checked; b.dispatchEvent(new Event('change')); // a tap beside the box checks it instead of opening the item
    }));
  },
};
A.svcClearSel = () => { svcSel.clear(); refresh(); };
// Categories (by Import): each category with its item count and a box to rename it. The server renames it everywhere it's kept
// (items, quote/job/invoice lines, expenses) so reports stay together; renaming onto a name already used merges the two.
A.svcCatsEdit = () => {
  const mb = modal('Categories', '<p class="muted">Rename a category on all its items. Quotes, jobs, invoices and expenses that use it change too, so reports keep it together.</p><div class="svc-cats"></div><div class="foot"><button type="button" class="btn alt" data-act="closeModal">Done</button></div>');
  const box = $('.svc-cats', mb);
  const draw = () => {
    const n = (c) => D.services.filter((s) => svcCatIs(s, c)).length;
    box.innerHTML = svcCats().map((c) => `<form class="svc-catrow" data-cat="${esc(c)}"><input name="to" value="${esc(c)}" maxlength="40" aria-label="Name of ${esc(c)}"><span class="muted">${n(c)} item${n(c) === 1 ? '' : 's'}</span><button class="btn alt sm" disabled>Rename</button></form>`).join('') || '<p class="muted">No categories left.</p>';
  };
  draw();
  box.addEventListener('input', (e) => { const f = e.target.form; if (f) $('button', f).disabled = !f.to.value.trim() || f.to.value.trim() === f.dataset.cat; });
  box.addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const from = f.dataset.cat; const to = f.to.value.trim(); if (!to || to === from) return;
    const merge = svcCats().find((c) => c !== from && c.toLowerCase() === to.toLowerCase());
    if (merge && !confirm(`“${merge}” is already a category. Put the items in “${from}” into “${merge}”?`)) return;
    $('button', f).disabled = true;
    try {
      const r = await api('POST', '/api/services/rename-category', { from, to: merge || to });
      if (svcView.cat && svcView.cat.toLowerCase() === from.toLowerCase()) svcView.cat = r.name;
      toast(`Renamed to “${r.name}” on ${r.items} item${r.items === 1 ? '' : 's'}`); await refresh(); draw();
    } catch (x) { toast(x.message, true); $('button', f).disabled = false; }
  });
};
A.svcBulkDelete = async () => {
  const n = svcSel.size; if (!n) return;
  if (!confirm(`Delete ${n} item${n === 1 ? '' : 's'}? Quotes and invoices that already use ${n === 1 ? 'it' : 'them'} keep their lines. This can't be undone.`)) return;
  try { const r = await api('POST', '/api/services/delete', { ids: [...svcSel] }); svcSel.clear(); toast(`Deleted ${r.deleted} item${r.deleted === 1 ? '' : 's'}`); refresh(); } catch (x) { toast(x.message, true); }
};
// Edit on the selection bar: set the category and/or type of every checked item at once ("Keep as is" leaves that field alone)
A.svcBulkEdit = () => {
  const n = svcSel.size; if (!n) return;
  const mb = modal(`Edit ${n} item${n === 1 ? '' : 's'}`, `<form><label>Category<select name="catMode"><option value="keep">Keep as is</option><option value="set">Change to…</option><option value="none">No category</option></select></label>
<div class="svc-bcat" hidden>${catField('category', '', 'New category', 'Typed exactly as you want it shown. Pick one already used, or type a new one.')}</div>
<label>Type<select name="type"><option value="">Keep as is</option><option value="service">Service</option><option value="product">Product</option></select></label>
<p class="muted">Prices, names and descriptions stay as they are. Quotes and invoices already made don't change.</p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  const f = $('form', mb); const box = $('.svc-bcat', f);
  f.catMode.addEventListener('change', () => { box.hidden = f.catMode.value !== 'set'; if (!box.hidden) f.category.focus(); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const mode = f.catMode.value; const body = { ids: [...svcSel] };
    if (mode === 'set') { if (!f.category.value.trim()) { toast('Type the new category, or choose No category', true); return f.category.focus(); } body.category = f.category.value; }
    if (mode === 'none') body.category = '';
    if (f.type.value) body.type = f.type.value;
    if (!('category' in body) && !body.type) return toast('Choose what to change', true);
    try { const r = await api('POST', '/api/services/bulk-edit', body); closeModal(); svcSel.clear(); toast(`Updated ${r.updated} item${r.updated === 1 ? '' : 's'}`); refresh(); } catch (x) { toast(x.message, true); }
  });
};
A.svcSort = (d) => { svcView.dir = svcView.sort === d.k ? -svcView.dir : 1; svcView.sort = d.k; refresh(); };
A.svcClear = () => { svcView.q = ''; refresh().then(() => $('#sq').focus()); };
// a category box: type a new one or pick one already used from the list that opens under it
// (its own list, like the line-item name box: the browser's datalist popup can open away from the box, outside the dialog)
const catField = (name, value, label = 'Category', hint = 'e.g. Low voltage, T-shirts. Reports can show each category on its own.') => `<label>${label}<span class="cat-wrap"><input name="${name}" class="cat-in" maxlength="40" value="${esc(value || '')}" placeholder="None" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false"></span><small class="muted">${hint}</small></label>`;
const catAc = { input: null, box: null, idx: -1, list: [] };
function catAcClose() { if (catAc.box) catAc.box.remove(); if (catAc.input) catAc.input.setAttribute('aria-expanded', 'false'); Object.assign(catAc, { input: null, box: null, idx: -1, list: [] }); }
function catAcOpen(input) {
  const q = input.value.trim().toLowerCase();
  const list = svcCats().filter((c) => !q || c.toLowerCase().includes(q));
  if (!list.length || (list.length === 1 && list[0].toLowerCase() === q)) return catAcClose();
  if (catAc.input !== input) { catAcClose(); catAc.input = input; catAc.box = document.createElement('div'); catAc.box.className = 'svc-ac cat-ac'; catAc.box.setAttribute('role', 'listbox'); input.after(catAc.box); input.setAttribute('aria-expanded', 'true'); }
  catAc.list = list; catAc.idx = Math.min(catAc.idx, list.length - 1);
  catAc.box.innerHTML = list.map((c, i) => `<div role="option" class="${i === catAc.idx ? 'on' : ''}" data-i="${i}"><span>${esc(c)}</span></div>`).join('');
}
function catAcPick(i) { const c = catAc.list[i]; const input = catAc.input; if (c === undefined || !input) return; input.value = c; catAcClose(); input.dispatchEvent(new Event('change', { bubbles: true })); }
document.addEventListener('focusin', (e) => { if (e.target.matches && e.target.matches('.cat-in')) { catAc.idx = -1; catAcOpen(e.target); } });
document.addEventListener('input', (e) => { if (e.target.matches && e.target.matches('.cat-in')) { catAc.idx = -1; catAcOpen(e.target); } });
document.addEventListener('focusout', (e) => { if (e.target === catAc.input) catAcClose(); });
document.addEventListener('keydown', (e) => {
  if (!catAc.box || e.target !== catAc.input) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); catAc.idx = (catAc.idx + (e.key === 'ArrowDown' ? 1 : -1) + catAc.list.length) % catAc.list.length; catAcOpen(catAc.input); }
  else if (e.key === 'Enter' && catAc.idx >= 0) { e.preventDefault(); catAcPick(catAc.idx); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); catAcClose(); }
}, true);
document.addEventListener('mousedown', (e) => { const opt = e.target.closest && e.target.closest('.cat-ac [data-i]'); if (opt) { e.preventDefault(); catAcPick(Number(opt.dataset.i)); } else if (e.target.closest && e.target.closest('.cat-ac')) e.preventDefault(); });
function serviceForm(s) {
  s = s || {};
  const mb = modal(s.id ? 'Edit item' : 'New item', `<form><div class="row"><label>Name<input name="name" required value="${esc(s.name)}"></label>
<label>Type<select name="type">${[['service', 'Service'], ['product', 'Product']].map(([k, l]) => `<option value="${k}" ${(s.type || 'service') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
<div id="hdSlot">${['hdId', 'hdModel', 'hdCost', 'hdLink', 'hdAt'].map((k) => `<input type="hidden" name="${k}" value="${esc(s[k] ?? '')}">`).join('')}<p class="hd-note" id="hdNote"${s.hdCost ? '' : ' hidden'}>${s.hdCost ? hdNote(s) : ''}</p></div>
<label>Description<textarea name="description" placeholder="Shown on quote and invoice lines">${esc(s.description)}</textarea></label>
${aiOn() ? '<div class="ai-row"><button type="button" class="btn alt sm" id="aiDesc">✨ Write with AI</button></div>' : ''}
<div class="row"><label>Standard price ($)<input name="price" type="number" step="0.01" min="0" required value="${s.price ?? ''}"></label><label>Unit<input name="unit" value="${esc(s.unit || '')}" placeholder="job, hour, visit, each"></label></div>
${catField('category', s.id ? s.category : (svcView.cat && svcView.cat !== '__none' ? svcView.cat : ''))}
<div class="foot">${s.id ? `<button type="button" class="btn danger" data-act="delService" data-id="${s.id}">Delete</button>` : ''}<button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  if ($('#aiDesc', mb)) $('#aiDesc', mb).addEventListener('click', async (e) => {
    const f = $('form', mb); const nameIn = $('[name=name]', f); const desc = $('[name=description]', f); const btn = e.currentTarget;
    if (!nameIn.value.trim()) { toast('Enter a name first', true); return nameIn.focus(); }
    if (desc.value.trim() && !confirm('Replace the current description?')) return;
    btn.disabled = true; btn.textContent = 'Writing…';
    try { desc.value = (await api('POST', '/api/services/describe', { name: nameIn.value, type: $('[name=type]', f).value })).description; desc.focus(); }
    catch (err) { toast(err.message, true); }
    finally { btn.disabled = false; btn.textContent = '✨ Write with AI'; }
  });
  hdPicker(mb);
  $('form', mb).addEventListener('submit', async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); s.id ? await api('PUT', '/api/services/' + s.id, b) : await api('POST', '/api/services', b); closeModal(); toast(`${b.type === 'product' ? 'Product' : 'Service'} saved`); refresh(); });
}
/* Products & services → Search Home Depot (lib/homedepot.js), when it's on in App Marketplace */
const hdNote = (h) => `From Home Depot: <strong>${money(h.hdCost)}</strong>${h.hdModel ? ` · Model ${esc(h.hdModel)}` : ''} · checked ${esc(new Date(h.hdAt).toLocaleDateString())} · <a href="${esc(h.hdLink)}" target="_blank" rel="noopener">View ↗</a>`;
let HD = null; // this account's Home Depot settings, loaded once
async function hdPicker(mb) {
  if (!HD) HD = await api('GET', '/api/home-depot').catch(() => ({}));
  const slot = $('#hdSlot', mb); if (!HD.on || !slot) return;
  slot.insertAdjacentHTML('afterbegin', `<div class="ai-row"><button type="button" class="btn alt sm" id="hdOpen" aria-expanded="false">Search Home Depot</button></div>
<div class="hd-pick" id="hdPick" hidden><div class="hd-q"><input id="hdQ" type="search" placeholder="Search Home Depot products" aria-label="Search Home Depot products"><button type="button" class="btn sm" id="hdGo">Search</button></div>
<div id="hdRes" class="hd-res" aria-live="polite"></div></div>`);
  const f = $('form', mb); const q = $('#hdQ', mb); const box = $('#hdRes', mb); let list = [];
  $('#hdOpen', mb).addEventListener('click', (e) => { const p = $('#hdPick', mb); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-expanded', String(!p.hidden)); if (!p.hidden) { if (!q.value) q.value = $('[name=name]', f).value; q.focus(); if (q.value.trim().length > 1) go(); } });
  const go = async () => {
    const term = q.value.trim(); if (term.length < 2) return toast('Type at least 2 letters to search', true);
    box.innerHTML = '<p class="muted">Searching Home Depot…</p>';
    try {
      list = (await api('GET', `/api/home-depot/search?q=${encodeURIComponent(term)}`)).products;
      box.innerHTML = list.length ? list.map((x, i) => `<button type="button" class="hd-item" data-i="${i}">${x.thumb ? `<img src="${esc(x.thumb)}" alt="" loading="lazy">` : '<span class="hd-noimg"></span>'}
<span class="hd-t"><strong>${esc(x.title)}</strong><small>${esc([x.brand, x.model && 'Model ' + x.model].filter(Boolean).join(' · '))}</small></span>
<span class="hd-p">${money(x.price)}${x.was ? `<s>${money(x.was)}</s>` : ''}</span></button>`).join('') + `<p class="muted hd-src">Prices from homedepot.com${HD.zip ? ` for ${esc(HD.zip)}` : ''}${HD.markup ? `. Your ${HD.markup}% markup is added when you pick one.` : '.'}</p>`
        : `<p class="muted">No Home Depot products match “${esc(term)}”.</p>`;
    } catch (err) { box.innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
  };
  $('#hdGo', mb).addEventListener('click', go);
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } }); // not the item form's Save
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.hd-item'); if (!b) return; const x = list[+b.dataset.i];
    const name = $('[name=name]', f); if (!name.value.trim() || name.value.trim() === x.title || confirm(`Change the name to “${x.title}”?`)) name.value = x.title.slice(0, 200);
    $('[name=type]', f).value = 'product'; const unit = $('[name=unit]', f); if (!unit.value.trim()) unit.value = 'each';
    $('[name=price]', f).value = (Math.round(x.price * (1 + (HD.markup || 0) / 100) * 100) / 100).toFixed(2);
    const h = { hdId: x.id, hdModel: x.model, hdCost: x.price, hdLink: x.link, hdAt: new Date().toISOString() };
    for (const [k, v] of Object.entries(h)) $(`[name=${k}]`, f).value = v;
    const note = $('#hdNote', mb); note.innerHTML = hdNote(h); note.hidden = false;
    $('#hdPick', mb).hidden = true; $('#hdOpen', mb).setAttribute('aria-expanded', 'false');
    toast(HD.markup ? `Price filled in: ${money(x.price)} plus your ${HD.markup}% markup` : `Price filled in from Home Depot`);
  });
}
A.newService = () => serviceForm(); A.editService = (d) => serviceForm(byId(D.services, d.id));
A.delService = async (d) => { if (!confirm('Delete this item? Quotes and invoices that already use it keep their lines.')) return; await api('DELETE', '/api/services/' + d.id); closeModal(); refresh(); };

/* ===== /services/import: products and services from a CSV (parseCsv is under /clients/import) ===== */
const SVC_FIELDS = [['', "Don't import"], ['name', 'Name'], ['description', 'Description'], ['type', 'Type (product or service)'], ['price', 'Price'], ['unit', 'Unit'], ['category', 'Category'], ['active', 'Active (no = skip)']];
const SVC_GUESS = [['price', /price|rate|cost|amount/], ['description', /desc|details/], ['category', /^(category|group|department|division|business|business line|service line)$/], ['type', /^(type|kind|item type)$/], ['unit', /^(unit|uom|unit of measure)$/], ['active', /^(active|enabled|status)$/], ['name', /^(name|item|product|service|(item|product|service) ?name|title)$/]];
let svcImport = null;
const svcRow = (row, map) => { const v = {}; map.forEach((f, i) => { if (f && (row[i] || '').trim()) v[f] = row[i].trim(); });
  return { name: v.name || '', description: v.description || '', type: /product|material|part|goods/i.test(v.type || '') ? 'product' : 'service', price: Number(String(v.price || '').replace(/[^0-9.-]/g, '')) || 0, unit: v.unit || '', category: v.category || '', inactive: /^(false|no|n|0|inactive|archived)$/i.test(v.active || '') }; };
function svcImportPlan() {
  const norm = (x) => String(x || '').trim().toLowerCase(); const seen = new Set(D.services.map((s) => norm(s.name)));
  return svcImport.rows.map((r) => { const c = svcRow(r, svcImport.map);
    const status = !c.name ? 'noname' : c.inactive ? 'inactive' : seen.has(norm(c.name)) ? 'dupe' : 'new'; if (c.name && !c.inactive) seen.add(norm(c.name)); return { c, status }; });
}
PAGES['/services/import'] = {
  title: 'Import products & services',
  async render(main) {
    svcImport = null;
    main.innerHTML = `<div class="head"><div><a href="/services" data-link class="back">← Products &amp; services</a><h1>Import products &amp; services</h1><p class="sub">Add your price list at once from a spreadsheet or another app's export.</p></div></div>
<div class="card"><h2>1. Choose a CSV file</h2><p class="muted" style="margin-top:0">Save your list as <strong>CSV</strong>. The first row should be column names, such as Name, Description, Type and Price. <a href="#" data-act="svcImportTemplate">Download a sample file</a></p>
<input type="file" id="svcFile" accept=".csv,.txt,text/csv" style="width:auto"></div><div id="svcStep"></div>`;
    $('#svcFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (/\.(xlsx?|numbers)$/i.test(f.name)) return toast('Save the spreadsheet as CSV first, then choose the .csv file', true);
      const rows = parseCsv(await f.text());
      if (rows.length < 2) return toast('No items found. The file needs a header row and at least one item row.', true);
      const headers = rows[0]; const width = Math.max(...rows.map((r) => r.length)); while (headers.length < width) headers.push('Column ' + (headers.length + 1));
      const map = headers.map(() => ''); SVC_GUESS.forEach(([field, re]) => { const i = headers.findIndex((h, k) => !map[k] && re.test(h.trim().toLowerCase())); if (i >= 0 && !map.includes(field)) map[i] = field; });
      svcImport = { fileName: f.name, headers, rows: rows.slice(1), map, skipDupes: true }; svcImportStep();
    });
  },
};
function svcImportStep() {
  const s = svcImport; const plan = svcImportPlan(); const n = (st) => plan.filter((p) => p.status === st).length;
  const take = plan.filter((p) => p.status === 'new' || (p.status === 'dupe' && !s.skipDupes));
  const tag = { new: '<span class="badge approved">new</span>', dupe: `<span class="badge ${s.skipDupes ? 'draft' : 'sent'}">${s.skipDupes ? 'already in list, skip' : 'duplicate'}</span>`, noname: '<span class="badge declined">no name, skip</span>', inactive: '<span class="badge draft">inactive, skip</span>' };
  $('#svcStep').innerHTML = `<div class="card"><h2>2. Match the columns</h2><p class="muted" style="margin-top:0">We matched the columns in <strong>${esc(s.fileName)}</strong> automatically. Check them and change any that are wrong.</p>
<div class="tablewrap"><table class="map-tbl m-map"><tr><th>Column in your file</th><th>Example</th><th style="width:220px">Import as</th></tr>
${s.headers.map((h, i) => `<tr><td><strong>${esc(h)}</strong></td><td class="muted">${esc((s.rows.find((r) => (r[i] || '').trim()) || [])[i] || '')}</td><td><select data-smap="${i}">${SVC_FIELDS.map(([v, l]) => `<option value="${v}" ${s.map[i] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td></tr>`).join('')}</table></div>
${s.map.includes('name') ? '' : '<div class="notice" style="margin-top:12px">Choose which column holds the item name.</div>'}</div>
<div class="card"><h2>3. Review and import</h2>
<p><strong>${plan.length}</strong> rows: <strong>${n('new')}</strong> new, <strong>${n('dupe')}</strong> already in your list or repeated in the file${n('inactive') ? `, <strong>${n('inactive')}</strong> inactive (skipped)` : ''}${n('noname') ? `, <strong>${n('noname')}</strong> without a name (skipped)` : ''}.</p>
<div class="chk"><label><input type="checkbox" id="svcSkip" ${s.skipDupes ? 'checked' : ''}> Skip items already in my list (same name)</label></div>
<div class="tablewrap"><table class="m-svcimp"><tr><th>Name</th><th>Type</th>${s.map.includes('category') ? '<th>Category</th>' : ''}<th>Description</th><th class="r">Price</th><th></th></tr>
${plan.slice(0, 100).map((p) => `<tr><td>${esc(p.c.name) || '<span class="muted">—</span>'}</td><td>${p.c.type === 'product' ? 'Product' : 'Service'}</td>${s.map.includes('category') ? `<td>${esc(p.c.category)}</td>` : ''}<td>${esc(p.c.description)}</td><td class="r">${money(p.c.price)}${p.c.unit ? `<span class="muted"> / ${esc(p.c.unit)}</span>` : ''}</td><td>${tag[p.status]}</td></tr>`).join('')}</table></div>
${plan.length > 100 ? `<p class="muted">Showing the first 100 of ${plan.length} rows.</p>` : ''}
<div class="foot"><a class="btn alt" href="/services" data-link>Cancel</a><button class="btn" data-act="runSvcImport" ${take.length ? '' : 'disabled'}>Import ${take.length} item${take.length === 1 ? '' : 's'}</button></div></div>`;
  $$('[data-smap]').forEach((sel) => sel.addEventListener('change', (e) => { s.map[Number(e.target.dataset.smap)] = e.target.value; svcImportStep(); }));
  $('#svcSkip').addEventListener('change', (e) => { s.skipDupes = e.target.checked; svcImportStep(); });
}
A.runSvcImport = async (d, el) => {
  const s = svcImport; if (!s) return;
  const services = svcImportPlan().filter((p) => p.status === 'new' || (p.status === 'dupe' && !s.skipDupes)).map(({ c }) => ({ name: c.name, description: c.description, type: c.type, price: c.price, unit: c.unit, category: c.category }));
  el.disabled = true; el.textContent = 'Importing…';
  try { const r = await api('POST', '/api/services/import', { services }); toast(`Imported ${r.added} item${r.added === 1 ? '' : 's'}`); navigate('/services'); }
  catch (err) { el.disabled = false; el.textContent = `Import ${services.length} items`; throw err; }
};
A.svcImportTemplate = () => downloadCsv('products-services-sample.csv', [['Name', 'Description', 'Type', 'Price', 'Unit', 'Category'], ['Service call', 'Diagnose the problem on site', 'Service', '89', 'visit', 'Repairs'], ['Outlet cover', 'White duplex wall plate', 'Product', '4.50', 'each', 'Parts']]);

/* ===== /expenses ===== */
let expJob = '';
const CATS = ['Materials', 'Subcontractor', 'Fuel', 'Equipment', 'Software', 'Insurance', 'Other'];
/* ===== Timesheets (plan feature "timesheets"): clock in and out, a week of time per person, approval and payroll export.
   Everyone sees their own time; the owner, admins and anyone who edits jobs see everyone's, fix entries and approve them.
   Pay rates and labor cost: the owner and admins only (the server leaves them out for anyone else). ===== */
let tsWeek = ''; let tsWho = ''; let TS = null;
const tsMonday = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - dayInWeek(x)); return x; };
const tsAdd = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const tsClock = (iso) => fmtTime(new Date(iso).toTimeString().slice(0, 5));
const tsH = (h) => (Math.round(h * 100) / 100).toFixed(2);
const tsLocal = (iso) => { const d = new Date(iso); return `${ymd(d)}T${d.toTimeString().slice(0, 5)}`; }; // for datetime-local inputs
const OVERTIME_H = 40; // hours in a week before overtime
PAGES['/timesheets'] = {
  title: 'Timesheets',
  async render(main) {
    const start = tsWeek ? new Date(tsWeek + 'T00:00') : tsMonday(new Date()); const end = tsAdd(start, 7);
    TS = await api('GET', `/api/time?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`);
    D.clock = { ...(D.clock || {}), canClock: TS.canClock, open: TS.open };
    const M = TS.manager; const people = [...new Map(TS.entries.map((e) => [e.staffId, e.person])).entries()];
    const list = TS.entries.filter((e) => !tsWho || e.staffId === tsWho);
    const byPerson = {}; for (const e of list) (byPerson[e.staffId] = byPerson[e.staffId] || { name: e.person, color: e.color, entries: [] }).entries.push(e);
    const total = list.reduce((s, e) => s + e.hours, 0); const waiting = list.filter((e) => e.end && !e.approvedAt);
    const over = Object.values(byPerson).reduce((s, p) => s + Math.max(0, p.entries.reduce((t, e) => t + e.hours, 0) - OVERTIME_H), 0);
    const cost = TS.admin ? list.reduce((s, e) => s + e.hours * (e.rate || 0), 0) : 0;
    const range = `${fmtDate(ymd(start))} – ${fmtDate(ymd(tsAdd(end, -1)))}`; const thisWeek = ymd(start) === ymd(tsMonday(new Date()));
    // my clock: on the clock (with Clock out), or Clock in on one of my jobs that's still to do, or no job
    const mine = D.jobs.filter((j) => j.status === 'scheduled' && (j.staffIds || []).includes(me && me.staffId)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const o = TS.open;
    const clockCard = !TS.canClock ? '' : `<div class="card ts-clock ${o ? 'on' : ''}">${o ? `<div><div class="ts-big">⏱ On the clock · ${clockSince(o.start)}</div><div class="muted">Since ${tsClock(o.start)}${o.job ? ` on <a href="/jobs/edit?id=${esc(o.job.id)}" data-link>${esc(o.job.number)} ${esc(o.job.title)}</a>` : ', no job'}</div></div>
<button type="button" class="btn ts-btn" data-act="clockOut">Clock Out</button>` : `<div><div class="ts-big">You’re off the clock</div><label class="ts-job">Job<select id="tsJob"><option value="">No job (shop time, travel…)</option>${mine.map((j) => `<option value="${j.id}">${esc(j.number)} · ${esc(j.title || '')}${j.date ? ' · ' + esc(fmtDate(j.date)) : ''}</option>`).join('')}</select></label></div>
<button type="button" class="btn ts-btn" data-act="tsClockIn">Clock In</button>`}</div>`;
    const row = (e) => `<tr class="${e.end ? '' : 'ts-live'}"><td>${esc(fmtDate(ymd(new Date(e.start))))}</td><td>${e.job ? `<a href="/jobs/edit?id=${esc(e.job.id)}" data-link>${esc(e.job.number)}</a> ${esc(e.job.title)}` : e.jobId ? '<span class="muted">Deleted job</span>' : '<span class="muted">No job</span>'}${e.note ? `<div class="muted sm">${esc(e.note)}</div>` : ''}</td>
<td>${tsClock(e.start)}</td><td>${e.end ? tsClock(e.end) : '<span class="cstatus q-converted">On the clock</span>'}</td><td class="r">${tsH(e.hours)}${e.hours > 12 ? ' <span title="Over 12 hours: check it wasn’t left running">⚠️</span>' : ''}</td>
${TS.admin ? `<td class="r m-hide">${e.rate ? money(e.hours * e.rate) : '<span class="muted">—</span>'}</td>` : ''}<td>${e.approvedAt ? `<span class="cstatus active" title="Approved by ${esc(e.approvedBy)}">Approved</span>` : e.end ? '<span class="cstatus q-sent">Waiting</span>' : ''}</td>
${M ? `<td class="actions">${e.end && !e.approvedAt ? `<button type="button" class="btn alt sm" data-act="tsApprove" data-ids="${e.id}">Approve</button>` : ''}<button type="button" class="btn alt sm row-edit" data-act="tsEdit" data-id="${e.id}">Edit</button></td>` : ''}</tr>`;
    const person = ([id, p]) => { const h = p.entries.reduce((s, e) => s + e.hours, 0); const w = p.entries.filter((e) => e.end && !e.approvedAt);
      return `<div class="card ts-person"><div class="ts-ph"><h2><span class="to-dot" style="background:${esc(p.color || '#64748b')}"></span>${esc(p.name)}</h2><div class="ts-pt"><strong>${tsH(h)} h</strong>${h > OVERTIME_H ? ` <span class="cstatus q-declined" title="Over ${OVERTIME_H} hours this week">${tsH(h - OVERTIME_H)} h overtime</span>` : ''}
${M && w.length ? `<button type="button" class="btn sm" data-act="tsApprove" data-ids="${w.map((e) => e.id).join(',')}">Approve ${w.length}</button>` : ''}</div></div>
<div class="tablewrap"><table class="m-ts"><tr><th>Day</th><th>Job</th><th>In</th><th>Out</th><th class="r">Hours</th>${TS.admin ? '<th class="r m-hide">Cost</th>' : ''}<th>Status</th>${M ? '<th></th>' : ''}</tr>${p.entries.map(row).join('')}</table></div></div>`; };
    main.innerHTML = `<div class="head"><div><h1>Timesheets</h1><p class="sub">${M ? 'Your team’s hours, clocked in and out on jobs. Check them, fix what’s wrong and approve them for payroll.' : 'Clock in and out, and see your hours.'}${TS.admin ? ' Hours on a job count as labor cost in Financial Reports → Job profit.' : ''}</p></div>
<div class="ts-acts">${TS.admin ? '<button type="button" class="btn alt" data-act="tsRates">Pay rates</button>' : ''}${M ? '<button type="button" class="btn alt" data-act="tsCsv">Export CSV</button><button type="button" class="btn" data-act="tsEdit">Add time</button>' : ''}</div></div>
${clockCard}
<div class="ts-bar"><div class="ts-week"><button type="button" class="btn alt sm" data-act="tsWeekGo" data-n="-7" aria-label="Previous week">‹</button><strong>${range}</strong><button type="button" class="btn alt sm" data-act="tsWeekGo" data-n="7" aria-label="Next week">›</button>${thisWeek ? '' : '<button type="button" class="link-btn" data-act="tsWeekGo" data-n="0">This week</button>'}</div>
${M && people.length > 1 ? `<label class="ts-who"><span class="sr">Team member</span><select id="tsWho"><option value="">Everyone</option>${people.map(([id, n]) => `<option value="${esc(id)}" ${tsWho === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` : ''}</div>
<div class="grid ${TS.admin ? 'g4' : 'g3'}">${stat('Hours', tsH(total), M ? `${Object.keys(byPerson).length} ${Object.keys(byPerson).length === 1 ? 'person' : 'people'}` : 'This week')}${stat('Overtime', tsH(over), `Over ${OVERTIME_H} h a week`)}${stat('Waiting for approval', waiting.length, waiting.length && M ? `<button type="button" class="link-btn" data-act="tsApprove" data-ids="${waiting.map((e) => e.id).join(',')}">Approve all</button>` : 'Entries')}${TS.admin ? stat('Labor cost', money(cost), Object.keys(TS.rates || {}).length ? 'At each person’s pay rate' : '<button type="button" class="link-btn" data-act="tsRates">Set pay rates</button>') : ''}</div>
${Object.entries(byPerson).map(person).join('') || `<div class="card"><p class="muted" style="margin:0">No time ${tsWho ? 'for this person ' : ''}this week.${TS.canClock ? ' Clock in above, or from a job’s page.' : ''}</p></div>`}`;
    const who = $('#tsWho'); if (who) who.addEventListener('change', (e) => { tsWho = e.target.value; refresh(); });
  },
};
A.tsWeekGo = (d) => { const n = Number(d.n); tsWeek = n ? ymd(tsAdd(tsWeek ? new Date(tsWeek + 'T00:00') : tsMonday(new Date()), n)) : ''; refresh(); };
A.tsClockIn = () => A.clockIn({ id: ($('#tsJob') || {}).value || '' });
A.tsApprove = async (d) => { try { const r = await api('POST', '/api/time/approve', { ids: String(d.ids).split(',') }); toast(`Approved ${r.approved} ${r.approved === 1 ? 'entry' : 'entries'}`); refresh(); } catch (x) { toast(x.message, true); } };
A.tsCsv = () => {
  const rows = TS.entries.filter((e) => e.end && (!tsWho || e.staffId === tsWho));
  downloadCsv(`timesheets-${tsWeek || ymd(tsMonday(new Date()))}.csv`, [['Team member', 'Date', 'Clock in', 'Clock out', 'Hours', 'Job', 'Job title', 'Note', 'Approved', 'Approved by', ...(TS.admin ? ['Pay rate', 'Cost'] : [])],
    ...rows.map((e) => [e.person, ymd(new Date(e.start)), tsClock(e.start), tsClock(e.end), tsH(e.hours), e.job ? e.job.number : '', e.job ? e.job.title : '', e.note || '', e.approvedAt ? 'Yes' : 'No', e.approvedBy || '', ...(TS.admin ? [e.rate || '', e.rate ? (e.hours * e.rate).toFixed(2) : ''] : [])])]);
};
// add or fix an entry (managers)
A.tsEdit = (d) => {
  const e = d.id ? TS.entries.find((x) => x.id === d.id) : null; const now = new Date();
  const jobs = D.jobs.filter((j) => j.status !== 'cancelled').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const m = modal(e ? `Edit ${e.person}’s time` : 'Add time', `<form id="tsf"><label>Team member<select name="staffId" required ${e ? 'disabled' : ''}><option value="">Choose…</option>${D.staff.filter((s) => s.status !== 'deactivated' || (e && e.staffId === s.id)).map((s) => `<option value="${s.id}" ${(e ? e.staffId : tsWho) === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
<label>Job<select name="jobId"><option value="">No job</option>${jobs.map((j) => `<option value="${j.id}" ${e && e.jobId === j.id ? 'selected' : ''}>${esc(j.number)} · ${esc(j.title || '')}</option>`).join('')}</select></label>
<div class="row"><label>Clock in<input type="datetime-local" name="start" required value="${esc(e ? tsLocal(e.start) : `${ymd(now)}T08:00`)}"></label><label>Clock out<input type="datetime-local" name="end" ${e && !e.end ? '' : 'required'} value="${esc(e ? (e.end ? tsLocal(e.end) : '') : `${ymd(now)}T16:00`)}"></label></div>
<label>Note<input name="note" maxlength="500" value="${esc(e ? e.note || '' : '')}" placeholder="e.g. Forgot to clock out"></label>
${e && e.approvedAt ? '<p class="notice">This entry is approved. Saving a change sends it back for approval.</p>' : ''}
<div class="foot">${e ? '<button type="button" class="btn alt danger-text" data-act="tsDel" style="margin-right:auto">Delete</button>' : ''}<button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  const f = $('#tsf', m.closest('.modal') || document);
  A.tsDel = async () => { if (!confirm('Delete this time entry?')) return; try { await api('DELETE', '/api/time/' + e.id); closeModal(); toast('Entry deleted'); refresh(); } catch (x) { toast(x.message, true); } };
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault(); const b = $('button.btn:not(.alt)', f); b.disabled = true;
    const body = { jobId: f.jobId.value, start: new Date(f.start.value).toISOString(), end: f.end.value ? new Date(f.end.value).toISOString() : null, note: f.note.value };
    try { if (e) await api('PUT', '/api/time/' + e.id, body); else await api('POST', '/api/time', { ...body, staffId: f.staffId.value }); closeModal(); toast('Saved'); refresh(); }
    catch (x) { b.disabled = false; toast(x.message, true); }
  });
};
// pay rates (owner and admins): dollars an hour, for labor cost
A.tsRates = () => {
  const r = TS.rates || {};
  const m = modal('Pay rates', `<form id="tsr"><p class="muted" style="margin-top:0">What each person costs you an hour. Only the owner and admins see these. They turn hours on a job into labor cost in Job profit.</p>
<div class="ts-rates">${D.staff.filter((s) => s.status !== 'deactivated').map((s) => `<label><span>${esc(s.name)}</span><span class="ts-rate"><span>$</span><input type="number" name="${s.id}" min="0" max="10000" step="0.01" value="${r[s.id] || ''}" placeholder="0.00"><span class="muted">/h</span></span></label>`).join('')}</div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  const f = $('#tsr', m.closest('.modal') || document);
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault(); const rates = { ...r }; $$('input', f).forEach((i) => { rates[i.name] = i.value; });
    try { await api('PUT', '/api/time/rates', { rates }); closeModal(); toast('Pay rates saved'); refresh(); } catch (x) { toast(x.message, true); }
  });
};

PAGES['/expenses'] = {
  title: 'Expense Tracker',
  async render(main) {
    const list = D.expenses.filter((e) => !expJob || (expJob === 'none' ? !e.jobId : e.jobId === expJob)).sort((a, b) => b.date.localeCompare(a.date));
    const total = list.reduce((s, e) => s + e.amount, 0);
    const byCat = {}; D.expenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
    const jobLabel = (id) => { const j = byId(D.jobs, id); return j ? `${j.number} · ${j.title}` : '<span class="muted">General</span>'; };
    main.innerHTML = `<div class="head"><div><h1>Expense Tracker</h1><p class="sub">Log material costs, subcontractor fees and other spending against specific projects.</p></div><button class="btn" data-act="newExpense">+ Log expense</button></div>
<div class="grid g3">${stat('Total shown', money(total), list.length + ' expenses')}${stat('All expenses', money(D.expenses.reduce((s, e) => s + e.amount, 0)))}<div class="card"><div class="l muted">By category</div>${Object.entries(byCat).map(([k, v]) => `<div style="display:flex;justify-content:space-between"><span>${esc(k)}</span><span>${money(v)}</span></div>`).join('') || '<span class="muted">None yet</span>'}</div></div>
<div class="card" style="margin-top:16px"><label style="max-width:360px">Filter by project<select id="expJob"><option value="">All projects</option><option value="none" ${expJob === 'none' ? 'selected' : ''}>General (no project)</option>${D.jobs.map((j) => `<option value="${j.id}" ${expJob === j.id ? 'selected' : ''}>${esc(j.number + ' · ' + j.title)}</option>`).join('')}</select></label>
<div class="tablewrap"><table class="m-exp"><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th>Project</th><th class="r">Amount</th></tr>${list.map((e) => `<tr class="crow" data-act="editExpense" data-id="${e.id}" title="Edit expense"><td>${fmtDate(e.date)}</td><td>${esc(e.category)}</td><td>${esc(e.vendor)}</td><td>${esc(e.description)}</td><td>${jobLabel(e.jobId)}${e.bizCat ? ` <span class="svc-cat">${esc(e.bizCat)}</span>` : ''}</td><td class="r">${money(e.amount)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No expenses logged</td></tr>'}</table></div></div>`;
    $('#expJob').addEventListener('change', (e) => { expJob = e.target.value; refresh(); });
  },
};
function expenseForm(x) {
  x = x || {};
  const mb = modal(x.id ? 'Edit expense' : 'Log expense', `<form><div class="row"><label>Date<input type="date" name="date" required value="${esc(x.date || ymd(new Date()))}"></label><label>Amount ($)<input name="amount" type="number" step="0.01" min="0" required value="${x.amount ?? ''}"></label></div>
<div class="row"><label>Category<select name="category">${CATS.map((c) => `<option ${x.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label>Vendor / payee<input name="vendor" value="${esc(x.vendor)}"></label></div>
<label>Description<input name="description" value="${esc(x.description)}"></label>
<label>Project (job)<select name="jobId"><option value="">General business expense</option>${D.jobs.map((j) => `<option value="${j.id}" ${x.jobId === j.id ? 'selected' : ''}>${esc(j.number + ' · ' + j.title + ' (' + clientName(j.clientId) + ')')}</option>`).join('')}</select></label>
${svcCats().length || x.bizCat ? catField('bizCat', x.bizCat, 'Counts toward', 'A products & services category, for its own reports. Leave empty for the whole business (or the job’s category when a job is picked).') : ''}
<div class="foot">${x.id ? `<button type="button" class="btn danger" data-act="delExpense" data-id="${x.id}">Delete</button>` : ''}<button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  $('form', mb).addEventListener('submit', async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); b.jobId = b.jobId || null; x.id ? await api('PUT', '/api/expenses/' + x.id, b) : await api('POST', '/api/expenses', b); closeModal(); toast('Expense saved'); refresh(); });
}
A.newExpense = () => expenseForm(); A.editExpense = (d) => expenseForm(byId(D.expenses, d.id));
A.delExpense = async (d) => { if (!confirm('Delete this expense?')) return; await api('DELETE', '/api/expenses/' + d.id); closeModal(); refresh(); };

/* ===== /reports: every report in groups; each opens at /reports/view?r=<key> ===== */
// [key, name, what it shows, { feature (plan feature it needs), href (a page of its own) }]. overview, pl, jobs and aging have their own layouts (RPT below);
// the rest are list reports from /api/reports/list/<key>: summary numbers, a chart, a side breakdown, then a table to search, sort, pick columns for and export.
const RPT_HUB = [
  ['Money', [
    ['overview', 'Financial overview', 'Revenue by month, paid vs pending, and your most popular services'],
    ['pl', 'Profit & loss', 'Income minus expenses, on a cash or accrual basis'],
    ['transactions', 'Transaction list', 'All payments, deposits and refunds'],
    ['invoices', 'Invoices', 'Invoices with totals, payments and balances'],
    ['projected', 'Projected income', 'Projected income from invoices awaiting payment'],
    ['aging', 'Aged receivables', 'Invoices that are late by 30, 60 and 90+ days'],
    ['balances', 'Client balance summary', 'What each client has been invoiced, has paid and still owes'],
    ['jobs', 'Job profit', 'What each job brought in against what it cost'],
    ['tax', 'Taxation', 'Sales tax collected, by month and by invoice', { feature: 'taxSummary', href: '/tax-summary' }],
  ]],
  ['Work', [
    ['visits', 'Visits', 'Every job and visit, with its team, status and invoices'],
    ['oneoff', 'One-off jobs', 'Jobs that don’t repeat, with client and invoice details'],
    ['recurring', 'Recurring jobs', 'Each repeating job, its visits and what it’s invoiced', { feature: 'recurringJobs' }],
    ['requests', 'Requests', 'Work requests and where they came from'],
    ['quotes', 'Quotes', 'Quotes with totals, approvals and deposits', { feature: 'quotes' }],
    ['productivity', 'Team productivity', 'Jobs, hours and revenue for each team member'],
    ['products', 'Products & services', 'How much each product and service is quoted, scheduled and invoiced'],
    ['timesheets', 'Timesheets', 'All time tracked by the team', { feature: 'timesheets' }],
  ]],
  ['Clients', [
    ['clients', 'Clients', 'All clients, with the lead channel they came from'],
    ['leadsource', 'Lead source', 'Clients, quotes and revenue by lead source'],
    ['communications', 'Client communications', 'All emails and texts sent through Worklio Pro'],
    ['contacts', 'Client contact info', 'All clients and their contact info'],
    ['properties', 'Property list', 'All properties and their details'],
    ['reengage', 'Client re-engagement', 'Clients who haven’t had a completed job in the past 12 months'],
    ['memberships', 'Service plans', 'Every client on a service plan', { feature: 'servicePlans' }],
  ]],
  ['Expenses', [
    ['expenses', 'Expenses', 'All tracked expenses and their details', { feature: 'expenses' }],
  ]],
];
// each group's color (a CSS class) and what's in it
const RPT_GROUP = { Money: ['money', 'Income, profit, and what clients owe'], Work: ['work', 'Jobs, quotes, requests and your team'], Clients: ['clients', 'Who your clients are and where they come from'], Expenses: ['spend', 'What the business spends'] };
// each report's icon (24×24 strokes)
const RPT_ICON = {
  overview: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-9"/>', pl: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>', transactions: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  invoices: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>', projected: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15h6"/>',
  aging: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>', balances: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>', jobs: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  tax: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>', visits: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  oneoff: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>', recurring: '<path d="M4 12a8 8 0 0 1 14-5.3L20 8M20 4v4h-4M20 12a8 8 0 0 1-14 5.3L4 16M4 20v-4h4"/>',
  requests: '<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1 2h6l1-2h5"/>', quotes: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h4"/>',
  productivity: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>', products: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>',
  timesheets: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4"/>', clients: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', leadsource: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  communications: '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>', contacts: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M8.5 17a3.5 3.5 0 0 1 7 0"/>',
  properties: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', reengage: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  memberships: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>', expenses: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
};
// starred reports, shown first; kept in this browser
const rptStars = () => { try { return JSON.parse(localStorage.getItem('rptStars') || '[]'); } catch (e) { return []; } };
const rptStarSave = (L) => { try { localStorage.setItem('rptStars', JSON.stringify(L)); } catch (e) { /* storage blocked */ } };
let rptGroupOn = 'all';
const rptMeta = (k) => RPT_HUB.flatMap(([, L]) => L).find((x) => x[0] === k) || [k, 'Report', ''];
const RPT_RANGES = [['thisMonth', 'This month'], ['lastMonth', 'Last month'], ['thisQuarter', 'This quarter'], ['lastQuarter', 'Last quarter'], ['thisYear', 'This year'], ['lastYear', 'Last year'], ['last12', 'Last 12 months'], ['all', 'All time'], ['custom', 'Custom dates']];
const rpt = { tab: 'overview', range: 'thisYear', from: '', to: '', basis: 'cash', cat: '' }; // cat: one products & services category ('__none' = no category), '' = everything
try { Object.assign(rpt, JSON.parse(localStorage.getItem('rptView') || '{}')); } catch (e) { /* no saved view */ }
const rptSave = () => { try { localStorage.setItem('rptView', JSON.stringify(rpt)); } catch (e) { /* storage blocked */ } };
function rptDates() {
  const n = new Date(); const y = n.getFullYear(); const m = n.getMonth(); const q = Math.floor(m / 3) * 3; const d = (yy, mm, dd) => ymd(new Date(yy, mm, dd));
  switch (rpt.range) {
    case 'thisMonth': return [d(y, m, 1), d(y, m + 1, 0)];
    case 'lastMonth': return [d(y, m - 1, 1), d(y, m, 0)];
    case 'thisQuarter': return [d(y, q, 1), d(y, q + 3, 0)];
    case 'lastQuarter': return [d(y, q - 3, 1), d(y, q, 0)];
    case 'lastYear': return [d(y - 1, 0, 1), d(y - 1, 11, 31)];
    case 'last12': return [d(y, m - 11, 1), d(y, m + 1, 0)];
    case 'all': return ['2000-01-01', ymd(n)];
    case 'custom': return [rpt.from || d(y, 0, 1), rpt.to || ymd(n)];
    default: return [d(y, 0, 1), d(y, 11, 31)];
  }
}
// the category picker (only once the catalog has categories), and the query string it adds to a report's address
const rptCatOk = () => { const cats = svcCats(); if (rpt.cat && rpt.cat !== '__none' && !cats.some((c) => c.toLowerCase() === rpt.cat.toLowerCase())) rpt.cat = ''; return cats; };
const rptCatQ = () => (rptCatOk().length && rpt.cat ? '&cat=' + encodeURIComponent(rpt.cat) : '');
const rptCatName = () => (!rpt.cat ? '' : rpt.cat === '__none' ? 'No category' : (svcCats().find((c) => c.toLowerCase() === rpt.cat.toLowerCase()) || rpt.cat));
const rptCatSel = () => { const cats = rptCatOk(); return cats.length ? `<select data-rpt="cat" aria-label="Category" class="rpt-cat"><option value="">All categories</option>${cats.map((c) => `<option value="${esc(c)}" ${rpt.cat.toLowerCase() === c.toLowerCase() ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="__none" ${rpt.cat === '__none' ? 'selected' : ''}>No category</option></select>` : ''; };
const rptRangeBar = (withBasis) => { const [from, to] = rptDates(); return `<div class="rpt-bar noprint">${rptCatSel()}<select data-rpt="range" aria-label="Dates">${RPT_RANGES.map(([k, l]) => `<option value="${k}" ${rpt.range === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
${rpt.range === 'custom' ? `<input type="date" data-rpt="from" value="${from}" aria-label="From"><span class="muted">to</span><input type="date" data-rpt="to" value="${to}" aria-label="To">` : rpt.range === 'all' ? '' : `<span class="muted">${fmtDate(from)} – ${fmtDate(to)}</span>`}
${withBasis ? `<div class="tabs rpt-basis" role="group" aria-label="Accounting method">${[['cash', 'Cash basis'], ['accrual', 'Accrual basis']].map(([k, l]) => `<button type="button" class="${rpt.basis === k ? 'on' : ''}" data-act="rptBasis" data-b="${k}">${l}</button>`).join('')}</div>` : ''}</div>`; };
A.rptBasis = (d) => { rpt.basis = d.b; rptSave(); refresh(); };
A.rptCat = (d) => { rpt.cat = d.c; rptSave(); refresh(); window.scrollTo(0, 0); };
const rptCatSlug = () => { const n = rptCatName(); return n ? n.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join('-') + '-' : ''; };
const rptBack = '<a class="rpt-back noprint" href="/reports" data-link>‹ Reports</a>';
const rptHead = (sub, csv) => `<div class="head"><div>${rptBack}<h1>${esc(rptMeta(rpt.tab)[1])}${rptCatName() ? ` <span class="rpt-cat-h">· ${esc(rptCatName())}</span>` : ''}</h1><p class="sub">${sub}</p></div><div class="actions noprint"><button class="btn alt" onclick="window.print()">Print</button>${csv ? '<button class="btn" data-act="rptCsv">Export CSV</button>' : ''}</div></div>`;
const signed = (n) => `<span class="${n < 0 ? 'neg' : ''}">${n < 0 ? '−' + money(-n) : money(n)}</span>`;
const marginTxt = (m) => (m === null || m === undefined ? '—' : m + '%');
const RPT = {
  async pl(main) {
    const [from, to] = rptDates(); const r = await api('GET', `/api/reports/profit-loss?from=${from}&to=${to}&basis=${rpt.basis}${rptCatQ()}`);
    const rows = (list) => list.map((x) => `<tr><td style="padding-left:24px">${esc(x.name)}</td><td class="r">${money(x.amount)}</td></tr>`).join('');
    main.innerHTML = rptHead('Income minus expenses for the dates you choose.', true) + rptRangeBar(true) + `
<div class="grid g4">${stat('Income', money(r.totalIncome), r.basis === 'cash' ? 'Payments received, before sales tax' : 'Invoiced, before sales tax')}${stat('Expenses', money(r.totalExpenses))}${stat('Net profit', signed(r.net), 'Margin ' + marginTxt(r.margin))}${stat('Sales tax collected', money(r.taxCollected), 'Owed to the state, not income')}</div>
${r.byMonth.length > 1 ? `<div class="card" style="margin-top:16px"><h2>Net profit by month</h2>${bars(r.byMonth.map((m) => Math.max(0, m.net)), r.byMonth.map((m) => monthLabel(m.month)), (v) => (v ? '$' + Math.round(v) : ''))}${r.byMonth.some((m) => m.net < 0) ? `<p class="muted">Months with a loss: ${r.byMonth.filter((m) => m.net < 0).map((m) => `${monthLabel(m.month)} (${'−' + money(-m.net)})`).join(', ')}</p>` : ''}</div>` : ''}
<div class="card" style="margin-top:16px"><h2>Profit and loss</h2><div class="tablewrap"><table class="pl">
<tr><th>Income</th><th class="r"></th></tr>${rows(r.income) || '<tr><td colspan="2" class="empty">No income in these dates</td></tr>'}<tr class="pl-sum"><td>Total income</td><td class="r">${money(r.totalIncome)}</td></tr>
<tr><th>Expenses</th><th class="r"></th></tr>${rows(r.expenses) || '<tr><td colspan="2" class="empty">No expenses in these dates</td></tr>'}<tr class="pl-sum"><td>Total expenses</td><td class="r">${money(r.totalExpenses)}</td></tr>
<tr class="pl-net"><td>Net profit</td><td class="r">${signed(r.net)}</td></tr></table></div>
${rpt.cat && rpt.cat !== '__none' ? `<p class="muted">Only ${esc(rptCatName())}: the lines on quotes and invoices in this category, and expenses counted toward it (picked on the expense, or from its job).${r.sharedExpenses ? ` Expenses for the whole business (${money(r.sharedExpenses)} in these dates) aren’t included.` : ''}</p>` : ''}
<p class="muted">${r.basis === 'cash' ? 'Cash basis: income counts on the day it’s paid (deposits included, refunds taken off). Each payment is split across the invoice’s lines.' : 'Accrual basis: income counts on the invoice date, whether or not it’s been paid. Drafts are left out.'} Expenses count on their date. Labor isn’t included unless you log it as an expense.</p></div>`;
    A.rptCsv = () => downloadCsv(`profit-loss-${rptCatSlug()}${from}-to-${to}.csv`, [['Profit and loss', `${from} to ${to}`, r.basis === 'cash' ? 'Cash basis' : 'Accrual basis', ...(rptCatName() ? [rptCatName()] : [])], [], ['Income', ''], ...r.income.map((x) => [x.name, x.amount]), ['Total income', r.totalIncome], [], ['Expenses', ''], ...r.expenses.map((x) => [x.name, x.amount]), ['Total expenses', r.totalExpenses], [], ['Net profit', r.net], ['Sales tax collected (not income)', r.taxCollected]]);
  },
  async jobs(main) {
    const [from, to] = rptDates(); const r = await api('GET', `/api/reports/jobs?from=${from}&to=${to}${rptCatQ()}`); const J = r.jobs;
    const rev = J.reduce((s, j) => s + j.revenue, 0); const cost = J.reduce((s, j) => s + j.costs, 0); const losing = J.filter((j) => j.profit < 0).length;
    main.innerHTML = rptHead('What each job brought in against what it cost.', true) + rptRangeBar(false) + `
<div class="grid g4">${stat('Jobs', J.length, 'With invoices or expenses')}${stat('Invoiced', money(rev), 'Before sales tax')}${stat('Job costs', money(cost), planHas('timesheets') ? `${money(J.reduce((s, j) => s + (j.labor || 0), 0))} of it labor` : 'Expenses logged to jobs')}${stat('Profit', signed(rev - cost), `Margin ${rev ? Math.round((rev - cost) / rev * 1000) / 10 + '%' : '—'}${losing ? ` · ${losing} at a loss` : ''}`)}</div>
<div class="card" style="margin-top:16px"><div class="tablewrap"><table class="m-jprofit"><tr><th>Job</th><th>Client</th>${svcCats().length && !rpt.cat ? '<th class="m-hide">Category</th>' : ''}<th>Date</th><th class="r">Invoiced</th><th class="r">Expenses</th>${planHas('timesheets') ? '<th class="r m-hide">Labor</th>' : ''}<th class="r">Profit</th><th class="r">Margin</th></tr>
${J.map((j) => `<tr><td><a href="/jobs/edit?id=${esc(j.id)}" data-link>${esc(j.number)}</a> ${esc(j.title)}</td><td>${esc(j.client)}</td>${svcCats().length && !rpt.cat ? `<td class="m-hide">${j.category ? esc(j.category) : '<span class="muted">—</span>'}</td>` : ''}<td>${fmtDate(j.date)}</td><td class="r">${money(j.revenue)}</td><td class="r">${money(j.expenses ?? j.costs)}</td>${planHas('timesheets') ? `<td class="r m-hide">${money(j.labor || 0)}</td>` : ''}<td class="r">${signed(j.profit)}</td><td class="r">${marginTxt(j.margin)}</td></tr>`).join('') || `<tr><td colspan="${(planHas('timesheets') ? 8 : 7) + (svcCats().length && !rpt.cat ? 1 : 0)}" class="empty">No jobs with invoices or costs in these dates${rpt.cat ? ' in this category' : ''}</td></tr>`}</table></div>
<p class="muted">Jobs count by their scheduled date. Invoiced is every invoice for the job except drafts, after discounts. Expenses are the ones linked to the job in Expenses.${svcCats().length ? ' A job’s category is the one most of its lines are in.' : ''}${planHas('timesheets') ? ' Labor is the time logged to the job in Timesheets, at each person’s pay rate (set by the owner or an admin in Timesheets → Pay rates).' : ''}</p></div>`;
    A.rptCsv = () => downloadCsv(`job-profit-${rptCatSlug()}${from}-to-${to}.csv`, [['Job', 'Title', 'Client', 'Category', 'Date', 'Status', 'Invoiced', 'Expenses', 'Labor', 'Costs', 'Profit', 'Margin %'], ...J.map((j) => [j.number, j.title, j.client, j.category || '', j.date, j.status, j.revenue, j.expenses ?? j.costs, j.labor || 0, j.costs, j.profit, j.margin ?? ''])]);
  },
  async aging(main) {
    const r = await api('GET', '/api/reports/aging?' + rptCatQ().slice(1)); const L = { current: 'Not yet due', d1_30: '1–30 days', d31_60: '31–60 days', d61_90: '61–90 days', d90: 'Over 90 days' };
    main.innerHTML = rptHead(`What clients owe you, by how long it’s been past due. As of ${fmtDate(r.asOf)}.`, true) + (svcCats().length ? `<div class="rpt-bar noprint">${rptCatSel()}</div>` : '') + `
<div class="grid g4">${stat('Total owed', money(r.totals.total), r.invoices.length + ' invoices')}${stat('Not yet due', money(r.totals.current))}${stat('Past due', money(r.totals.total - r.totals.current))}${stat('Over 90 days', money(r.totals.d90))}</div>
<div class="card" style="margin-top:16px"><h2>By client</h2><div class="tablewrap"><table class="m-aging"><tr><th>Client</th>${r.buckets.map((b) => `<th class="r">${L[b]}</th>`).join('')}<th class="r">Total</th></tr>
${r.clients.map((c) => `<tr><td><a href="/clients/view?id=${esc(c.clientId)}" data-link>${esc(c.client)}</a></td>${r.buckets.map((b) => `<td class="r">${c[b] ? money(c[b]) : '<span class="muted">—</span>'}</td>`).join('')}<td class="r"><strong>${money(c.total)}</strong></td></tr>`).join('') || `<tr><td colspan="${r.buckets.length + 2}" class="empty">Nothing owed. Every sent invoice is paid.</td></tr>`}
${r.clients.length ? `<tr class="pl-sum"><td>Total</td>${r.buckets.map((b) => `<td class="r">${money(r.totals[b])}</td>`).join('')}<td class="r">${money(r.totals.total)}</td></tr>` : ''}</table></div></div>
${r.invoices.length ? `<div class="card"><h2>Invoices</h2><div class="tablewrap"><table class="m-aginv"><tr><th>Invoice</th><th>Client</th><th>Due</th><th class="r">Days past due</th><th class="r">Balance</th></tr>${r.invoices.map((i) => `<tr><td><a href="/invoices/view?id=${esc(i.id)}" data-link>${esc(i.number)}</a></td><td>${esc(i.client)}</td><td>${i.dueDate ? fmtDate(i.dueDate) : '—'}</td><td class="r">${i.daysOverdue || '<span class="muted">Not due</span>'}</td><td class="r">${money(i.balance)}</td></tr>`).join('')}</table></div></div>` : ''}`;
    A.rptCsv = () => downloadCsv(`unpaid-invoices-${rptCatSlug()}${r.asOf}.csv`, [['Invoice', 'Client', 'Issued', 'Due', 'Days past due', 'Balance', 'Invoice total'], ...r.invoices.map((i) => [i.number, i.client, i.issueDate, i.dueDate, i.daysOverdue, i.balance, i.total])]);
  },
};
RPT.overview = async (main) => {
    const r = await api('GET', '/api/reports?' + rptCatQ().slice(1)); const labels = r.revenueByMonth.map((m) => monthLabel(m.month));
    const totalAll = r.paidTotal + r.pendingTotal || 1; const maxSvc = Math.max(...r.popularServices.map((s) => s.count), 1);
    const maxCat = Math.max(...(r.byCategory || []).map((c) => c.revenue), 1);
    main.innerHTML = `${rptHead(rpt.cat ? 'Revenue, invoice status and the most popular items in this category.' : 'Revenue, invoice status and your most popular services.')}${svcCats().length ? `<div class="rpt-bar noprint">${rptCatSel()}</div>` : ''}
<div class="grid g4">${stat('Revenue this month', money(r.thisMonthRevenue))}${stat('Paid invoices', money(r.paidTotal), r.paidCount + ' invoices')}${stat('Pending invoices', money(r.pendingTotal), r.pendingCount + ' invoices · ' + money(r.overdueTotal) + ' overdue')}${stat('Expenses logged', money(r.totalExpenses), 'Net of paid revenue: ' + money(r.paidTotal - r.totalExpenses))}</div>
<div class="grid g2" style="margin-top:16px"><div class="card"><h2>Total monthly revenue (last 12 months)</h2>${bars(r.revenueByMonth.map((m) => m.revenue), labels, (v) => (v ? '$' + Math.round(v) : ''))}</div>
<div class="card"><h2>Paid vs pending</h2><p>Paid <strong>${money(r.paidTotal)}</strong></p><div class="meter"><i style="width:${(r.paidTotal / totalAll) * 100}%"></i></div><p style="margin-top:14px">Pending <strong>${money(r.pendingTotal)}</strong></p><div class="meter"><i style="width:${(r.pendingTotal / totalAll) * 100}%;background:var(--warn)"></i></div><p class="muted" style="margin-top:14px">Drafts are excluded. Pending includes sent and overdue invoices.</p></div></div>
${!rpt.cat && (r.byCategory || []).length ? `<div class="card"><h2>Revenue by category (last 12 months)</h2><div class="tablewrap"><table class="m-pop rpt-bycat"><tr><th>Category</th><th class="r">Paid revenue</th><th style="width:30%"></th></tr>${r.byCategory.map((c) => `<tr><td><button type="button" class="link-btn" data-act="rptCat" data-c="${c.name ? esc(c.name) : '__none'}">${c.name ? esc(c.name) : 'No category'}</button></td><td class="r">${money(c.revenue)}</td><td><div class="meter"><i style="width:${(c.revenue / maxCat) * 100}%"></i></div></td></tr>`).join('')}</table></div><p class="muted">Each paid invoice is split across its lines’ categories (tax included). Pick a category to see all its reports on their own.</p></div>` : ''}
<div class="card"><h2>Popular services</h2><div class="tablewrap"><table class="m-pop"><tr><th>Service</th><th class="r">Units sold</th><th class="r">Revenue</th><th style="width:30%"></th></tr>${r.popularServices.map((s) => `<tr><td>${esc(s.name)}</td><td class="r">${s.count}</td><td class="r">${money(s.revenue)}</td><td><div class="meter"><i style="width:${(s.count / maxSvc) * 100}%"></i></div></td></tr>`).join('') || '<tr><td colspan="4" class="empty">No invoiced services yet</td></tr>'}</table></div></div>`;
};

// the Reports page: chips to pick a group, a search box, starred reports first, then each group's reports as tiles
// (a tile is greyed with a lock when the report isn't in the plan)
PAGES['/reports'] = {
  title: 'Reports',
  async render(main) {
    const stars = rptStars(); const all = RPT_HUB.flatMap(([g, L]) => L.map((x) => [g, x]));
    const tile = (g, [k, name, desc, o = {}]) => {
      if (o.href && !memberCan(o.href) && planHas(o.feature)) return ''; // a page of its own this login can't open
      const locked = o.feature && !planHas(o.feature); const on = stars.includes(k);
      return `<div class="rpt-tile rt-${RPT_GROUP[g][0]}${locked ? ' off' : ''}" data-g="${esc(g)}" data-find="${esc((name + ' ' + desc + ' ' + g).toLowerCase())}">
<span class="rt-ic">${svgIcon(RPT_ICON[k] || RPT_ICON.overview, 20)}</span>
<span class="rt-txt"><a href="${locked ? '/settings/billing' : o.href || '/reports/view?r=' + k}" data-link class="rt-name">${esc(name)}</a><span>${esc(desc)}</span>
${locked ? `<small class="rt-lock">${svgIcon('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 13)} ${memberCan('/settings/billing') ? 'Upgrade to use' : 'Not in your plan'}</small>` : ''}</span>
${locked ? '' : `<button type="button" class="rt-star ${on ? 'on' : ''}" data-act="rptStar" data-k="${k}" aria-pressed="${on}" aria-label="${on ? 'Unstar' : 'Star'} ${esc(name)}" title="${on ? 'Remove from Starred' : 'Add to Starred'}">${svgIcon('<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>', 17)}</button>`}</div>`;
    };
    const starred = stars.map((k) => all.find(([, x]) => x[0] === k)).filter(Boolean);
    main.innerHTML = `<div class="head"><div><h1>Reports</h1><p class="sub">See how the business is doing, and export any report to a spreadsheet.</p></div></div>
<div class="rpt-filter"><div class="rpt-chips" role="group" aria-label="Show">${[['all', 'All reports'], ...RPT_HUB.map(([g]) => [g, g])].map(([v, l]) => `<button type="button" class="rpt-chip ${rptGroupOn === v ? 'on' : ''}" data-act="rptGroup" data-g="${esc(v)}" aria-pressed="${rptGroupOn === v}">${esc(l)}</button>`).join('')}</div>
<label class="rpt-findw">${svgIcon('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 16)}<input type="search" class="rpt-find" placeholder="Search reports" aria-label="Search reports"></label></div>
${starred.length ? `<section class="rpt-sec rpt-starred"><div class="rpt-sec-h"><h2>Starred</h2><span class="muted">Your go-to reports</span></div><div class="rpt-tiles">${starred.map(([g, x]) => tile(g, x)).join('')}</div></section>` : ''}
${RPT_HUB.map(([g, L]) => `<section class="rpt-sec" data-g="${esc(g)}"><div class="rpt-sec-h"><h2><i class="rt-dot rt-${RPT_GROUP[g][0]}"></i>${esc(g)}</h2><span class="muted">${esc(RPT_GROUP[g][1])}</span></div><div class="rpt-tiles">${L.map((x) => tile(g, x)).join('')}</div></section>`).join('')}
<p class="muted rpt-none" hidden>No report matches your search.</p>
${starred.length ? '' : '<p class="muted rpt-tip">Tip: star the reports you use most to keep them at the top.</p>'}`;
    const filter = () => { const q = $('.rpt-find', main).value.trim().toLowerCase();
      $$('.rpt-sec', main).forEach((s) => { let n = 0; $$('.rpt-tile', s).forEach((t) => { const on = (rptGroupOn === 'all' || t.dataset.g === rptGroupOn) && (!q || t.dataset.find.includes(q)); t.hidden = !on; n += on; }); s.hidden = !n; });
      $('.rpt-none', main).hidden = $$('.rpt-sec:not([hidden])', main).length > 0; };
    $('.rpt-find', main).addEventListener('input', filter); filter();
  },
};
A.rptGroup = (d) => { rptGroupOn = d.g; refresh(); };
A.rptStar = (d) => { const L = rptStars(); rptStarSave(L.includes(d.k) ? L.filter((k) => k !== d.k) : [...L, d.k]); refresh(); };

// one report: the four with their own layouts (RPT), else a list report
PAGES['/reports/view'] = {
  title: 'Reports',
  async render(main) {
    const k = qp('r') || 'overview'; const meta = rptMeta(k); const o = meta[3] || {}; rpt.tab = k;
    if (o.href) return navigate(o.href);
    if (o.feature && !planHas(o.feature)) { main.innerHTML = `<div class="head"><div>${rptBack}<h1>${esc(meta[1])}</h1></div></div><div class="card empty">This report isn’t in your plan.${memberCan('/settings/billing') ? ' <a href="/settings/billing" data-link>See plans</a>' : ''}</div>`; return; }
    if (RPT[k]) await RPT[k](main); else await rptList(main, k);
    $$('[data-rpt]', main).forEach((el) => el.addEventListener('change', (e) => { const f = e.target.dataset.rpt; if (f === 'range' && e.target.value === 'custom') { [rpt.from, rpt.to] = rptDates(); } rpt[f] = e.target.value; rptSave(); refresh(); }));
  },
};
// a list report's look, remembered in this browser: rows per page, and the columns hidden on each report
let rptPer = 25; try { rptPer = Number(localStorage.getItem('rptPer')) || 25; } catch (e) { /* storage blocked */ }
const rptHiddenAll = () => { try { return JSON.parse(localStorage.getItem('rptCols') || '{}'); } catch (e) { return {}; } };
const rptHidden = (k) => rptHiddenAll()[k] || [];
const rptHide = (k, list) => { try { localStorage.setItem('rptCols', JSON.stringify({ ...rptHiddenAll(), [k]: list })); } catch (e) { /* storage blocked */ } };
const RPT_NUM = ['money', 'num', 'hrs', 'pct'];
const rptWhen = (v) => { const d = new Date(v); return isNaN(d) ? null : d; };
function rptCell(c, r) {
  const v = r[c.k]; if (v === '' || v === null || v === undefined) return '<span class="muted">—</span>';
  let t;
  if (c.t === 'money') t = v < 0 ? `<span class="neg">−${money(-v)}</span>` : money(v);
  else if (c.t === 'date') t = fmtDate(v);
  else if (c.t === 'time') { const d = rptWhen(v); t = d ? `${fmtDate(ymd(d))} ${fmtTime(`${d.getHours()}:${d.getMinutes()}`)}` : esc(v); }
  else if (c.t === 'hrs') t = (Math.round(v * 100) / 100).toFixed(2);
  else if (c.t === 'pct') t = v + '%';
  else t = esc(v);
  const href = r[c.k + '$']; return href ? `<a href="${esc(href)}" data-link>${t}</a>` : t;
}
const rptCsvVal = (c, v) => { if (c.t === 'time' && v) { const d = rptWhen(v); return d ? `${ymd(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : v; } return v ?? ''; };
// bars for each day, week or month (the server picks), one bar per series side by side
function rptChart(c) {
  if (!c || !c.labels.length || !c.series.some((s) => s.values.some(Boolean))) return '';
  const max = Math.max(1, ...c.series.flatMap((s) => s.values)); const fv = (v) => (c.money ? money(v) : String(Math.round(v * 100) / 100));
  const lbl = (l) => (c.unit === 'month' ? monthLabel(l) : parseD(l).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  const step = Math.ceil(c.labels.length / 8);
  return `<div class="rpt-legend">${c.series.map((s, i) => `<span><i class="s${i}"></i>${esc(s.name)}${c.unit === 'week' ? ' (by week)' : c.unit === 'month' ? ' (by month)' : ''}</span>`).join('')}</div>
<div class="rpt-chart" role="img" aria-label="${esc(c.series.map((s) => `${s.name}: ${fv(s.total)}`).join(', '))}">${c.labels.map((l, i) => `<div class="rc-col" title="${esc(lbl(l) + ' · ' + c.series.map((s) => `${s.name} ${fv(s.values[i])}`).join(' · '))}"><div class="rc-bars">${c.series.map((s, k) => `<i class="s${k}" style="height:${(s.values[i] / max) * 100}%"></i>`).join('')}</div>${i % step === 0 ? `<span>${esc(lbl(l))}</span>` : ''}</div>`).join('')}</div>`;
}
// the side card: each status (method, category…) with how many and how much
function rptSide(s, when) {
  if (!s || !s.rows.length) return '';
  const fv = (v) => (s.fmt === 'money' ? money(v) : s.fmt === 'hrs' ? (Math.round(v * 100) / 100).toFixed(2) + ' h' : '');
  const top = s.rows.slice(0, 8); const rest = s.rows.length - top.length;
  return `<div class="card rpt-side"><h3>${esc(s.title)}</h3>${when ? `<p class="muted">${when}</p>` : ''}<ul>${top.map((x) => `<li><span>${esc(x.l)} <em>(${x.n})</em></span><b>${fv(x.v)}</b></li>`).join('')}
${rest > 0 ? `<li class="muted"><span>${rest} more</span></li>` : ''}<li class="tot"><span>Total <em>(${s.rows.reduce((a, x) => a + x.n, 0)})</em></span><b>${fv(s.rows.reduce((a, x) => a + x.v, 0))}</b></li></ul></div>`;
}
async function rptList(main, k) {
  const all = rpt.range === 'all'; const [from, to] = rptDates(); const meta = rptMeta(k);
  const r = await api('GET', `/api/reports/list/${k}?from=${all ? 'all' : from}&to=${all ? 'all' : to}`);
  const st = { q: '', status: '', sort: '', dir: 1, page: 0 };
  const statuses = r.columns.some((c) => c.k === 'status') ? [...new Set(r.rows.map((x) => x.status).filter(Boolean))].sort() : [];
  const when = !r.dated ? 'As of today' : all ? 'All time' : `${fmtDate(from)} – ${fmtDate(to)}`;
  const top = (r.stats || []).length || r.chart ? `<div class="rpt-top ${r.side && r.side.rows.length ? '' : 'one'}"><div class="card rpt-sum"><div class="rpt-stats">${(r.stats || []).map(([l, v, x]) => `<div><span class="l">${esc(l)}</span><strong>${esc(v)}</strong>${x ? `<small class="muted">${esc(x)}</small>` : ''}</div>`).join('')}</div>${rptChart(r.chart)}</div>${rptSide(r.side, when)}</div>` : '';
  const range = r.dated ? `<select data-rpt="range" aria-label="Dates">${RPT_RANGES.map(([v, l]) => `<option value="${v}" ${rpt.range === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
${rpt.range === 'custom' ? `<input type="date" data-rpt="from" value="${from}" aria-label="From"><span class="muted">to</span><input type="date" data-rpt="to" value="${to}" aria-label="To">` : all ? '' : `<span class="muted rpt-dates">${fmtDate(from)} – ${fmtDate(to)}</span>`}` : '<span class="muted">As of today</span>';
  main.innerHTML = `<div class="head"><div>${rptBack}<h1>${esc(meta[1])}</h1><p class="sub">${esc(meta[2])}</p></div><div class="actions noprint"><button class="btn alt" onclick="window.print()">Print</button></div></div>
${top}<div class="rpt-bar rpt-tools noprint">${range}<input type="search" class="rpt-q" placeholder="Search" aria-label="Search this report">${statuses.length > 1 ? `<select class="rpt-st" aria-label="Status"><option value="">All statuses</option>${statuses.map((s) => `<option>${esc(s)}</option>`).join('')}</select>` : ''}
<span class="rpt-sp"></span><button type="button" class="btn alt" data-act="rptCols">Edit columns</button><button type="button" class="btn" data-act="rptCsv">Export CSV</button></div>
<div class="card rpt-tbl"><div class="tablewrap"></div><div class="rpt-pager noprint"></div></div>
${r.note ? `<p class="muted rpt-note">${esc(r.note)}</p>` : ''}`;
  const cols = () => { const h = rptHidden(k); const C = r.columns.filter((c) => !h.includes(c.k)); return C.length ? C : r.columns; };
  const rows = () => {
    const q = st.q.trim().toLowerCase();
    const L = r.rows.filter((x) => (!st.status || x.status === st.status) && (!q || r.columns.some((c) => String(x[c.k] ?? '').toLowerCase().includes(q))));
    const c = st.sort && r.columns.find((x) => x.k === st.sort); if (!c) return L; const num = RPT_NUM.includes(c.t);
    return L.sort((a, b) => (num ? (Number(a[c.k]) || 0) - (Number(b[c.k]) || 0) : String(a[c.k] ?? '').localeCompare(String(b[c.k] ?? ''), undefined, { numeric: true })) * st.dir);
  };
  const tbl = $('.rpt-tbl', main);
  const draw = () => {
    const C = cols(); const L = rows(); const pages = Math.max(1, Math.ceil(L.length / rptPer)); st.page = Math.min(st.page, pages - 1);
    const P = L.slice(st.page * rptPer, (st.page + 1) * rptPer); const cls = (c) => (RPT_NUM.includes(c.t) ? ' class="r"' : '');
    const sums = L.length > 1 && C.some((c) => c.sum);
    $('.tablewrap', tbl).innerHTML = `<table class="rpt-t"><thead><tr>${C.map((c) => `<th${cls(c)}><button type="button" class="rpt-sort ${st.sort === c.k ? 'on' : ''}" data-k="${c.k}">${esc(c.l)}<i aria-hidden="true">${st.sort === c.k ? (st.dir > 0 ? '▲' : '▼') : '↕'}</i></button></th>`).join('')}</tr></thead>
<tbody>${P.map((x) => `<tr>${C.map((c) => `<td${cls(c)}>${rptCell(c, x)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${C.length}" class="empty">${r.rows.length ? 'Nothing matches your search' : r.dated && !all ? 'Nothing in these dates' : 'Nothing to show yet'}</td></tr>`}</tbody>
${sums ? `<tfoot><tr>${C.map((c, i) => `<td${cls(c)}>${c.sum ? rptCell(c, { [c.k]: Math.round(L.reduce((a, x) => a + (Number(x[c.k]) || 0), 0) * 100) / 100 }) : i === 0 ? 'Total' : ''}</td>`).join('')}</tr></tfoot>` : ''}</table>`;
    $('.rpt-pager', tbl).innerHTML = `<span class="muted">${L.length ? `Showing ${st.page * rptPer + 1}–${st.page * rptPer + P.length} of ${L.length}` : 'No rows'}</span>
<label class="rpt-per"><select aria-label="Rows per page">${[10, 25, 50, 100].map((n) => `<option ${n === rptPer ? 'selected' : ''}>${n}</option>`).join('')}</select> per page</label>
<button type="button" class="btn alt" data-pg="-1" aria-label="Previous page" ${st.page ? '' : 'disabled'}>‹</button><button type="button" class="btn alt" data-pg="1" aria-label="Next page" ${st.page < pages - 1 ? '' : 'disabled'}>›</button>`;
  };
  tbl.addEventListener('click', (e) => {
    const s = e.target.closest('.rpt-sort'); if (s) { if (st.sort === s.dataset.k) st.dir = -st.dir; else { st.sort = s.dataset.k; const c = r.columns.find((x) => x.k === st.sort); st.dir = RPT_NUM.includes(c.t) || c.t === 'date' || c.t === 'time' ? -1 : 1; } st.page = 0; draw(); return; }
    const p = e.target.closest('[data-pg]'); if (p) { st.page += Number(p.dataset.pg); draw(); }
  });
  tbl.addEventListener('change', (e) => { if (e.target.closest('.rpt-per')) { rptPer = Number(e.target.value); try { localStorage.setItem('rptPer', rptPer); } catch (x) { /* storage blocked */ } st.page = 0; draw(); } });
  $('.rpt-q', main).addEventListener('input', (e) => { st.q = e.target.value; st.page = 0; draw(); });
  const sel = $('.rpt-st', main); if (sel) sel.addEventListener('change', (e) => { st.status = e.target.value; st.page = 0; draw(); });
  A.rptCsv = () => { const C = cols(); downloadCsv(`${meta[1].toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join('-')}-${r.dated && !all ? `${from}-to-${to}` : ymd(new Date())}.csv`, [C.map((c) => c.l), ...rows().map((x) => C.map((c) => rptCsvVal(c, x[c.k])))]); };
  A.rptCols = () => {
    const h = rptHidden(k);
    const mb = modal('Edit columns', `<p class="muted" style="margin-top:0">Pick the columns to show. Export CSV includes the same ones.</p><div class="rpt-colpick">${r.columns.map((c) => `<label class="chk"><input type="checkbox" value="${c.k}" ${h.includes(c.k) ? '' : 'checked'}> ${esc(c.l)}</label>`).join('')}</div>
<div class="foot"><button type="button" class="btn alt" data-all>Show all</button><button type="button" class="btn" data-act="closeModal">Done</button></div>`);
    const save = () => { const off = $$('input', mb).filter((x) => !x.checked).map((x) => x.value); if (off.length === r.columns.length) { $$('input', mb)[0].checked = true; off.shift(); } rptHide(k, off); draw(); };
    mb.addEventListener('change', save); $('[data-all]', mb).addEventListener('click', () => { $$('input', mb).forEach((x) => { x.checked = true; }); save(); });
  };
  draw();
}

/* ===== /tax-summary ===== */
let taxYear = String(new Date().getFullYear());
PAGES['/tax-summary'] = {
  title: 'Tax Summary',
  async render(main) {
    const t = await api('GET', '/api/tax-summary?year=' + taxYear);
    main.innerHTML = `<div class="head"><div><h1>Tax Summary</h1><p class="sub">Sales tax collected on paid invoices, for end-of-year accounting. Counted by payment date.</p></div>
<div class="actions noprint"><select id="yr" style="width:auto">${t.years.map((y) => `<option ${y === t.year ? 'selected' : ''}>${y}</option>`).join('')}</select><button class="btn alt" data-act="taxCsv">Export CSV</button><button class="btn alt" onclick="window.print()">Print</button></div></div>
<div class="grid g3">${stat('Total tax collected ' + t.year, money(t.totalTax), t.invoices.length + ' paid invoices')}${stat('Taxable sales', money(t.totalTaxable))}${stat('Gross receipts', money(t.totalTaxable + t.totalTax))}</div>
<div class="card" style="margin-top:16px"><h2>By month</h2><div class="tablewrap"><table class="m-taxm"><tr><th>Month</th><th class="r">Invoices</th><th class="r">Taxable sales</th><th class="r">Tax collected</th><th class="r">Total received</th></tr>${t.byMonth.map((m) => `<tr><td>${monthLabel(m.month)}</td><td class="r">${m.invoices}</td><td class="r">${money(m.taxable)}</td><td class="r">${money(m.tax)}</td><td class="r">${money(m.total)}</td></tr>`).join('')}
<tr><th>Total</th><th class="r">${t.invoices.length}</th><th class="r">${money(t.totalTaxable)}</th><th class="r">${money(t.totalTax)}</th><th class="r">${money(t.totalTaxable + t.totalTax)}</th></tr></table></div></div>
<div class="card"><h2>Paid invoices</h2><div class="tablewrap"><table class="m-taxi"><tr><th>Invoice</th><th>Client</th><th>Paid</th><th class="r">Subtotal</th><th class="r">Rate</th><th class="r">Tax</th><th class="r">Total</th></tr>${t.invoices.map((i) => `<tr><td>${esc(i.number)}</td><td>${esc(i.client)}</td><td>${fmtDate(i.paidAt)}</td><td class="r">${money(i.subtotal)}</td><td class="r">${i.taxRate}%</td><td class="r">${money(i.tax)}</td><td class="r">${money(i.total)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No paid invoices in ' + t.year + '</td></tr>'}</table></div></div>`;
    $('#yr').addEventListener('change', (e) => { taxYear = e.target.value; refresh(); });
    A.taxCsv = () => downloadCsv(`tax-summary-${t.year}.csv`, [['Invoice', 'Client', 'Paid', 'Subtotal', 'Tax rate %', 'Tax', 'Total'], ...t.invoices.map((i) => [i.number, i.client, i.paidAt, i.subtotal, i.taxRate, i.tax, i.total])]);
  },
};

/* ===== /settings/roles: Roles & Permissions. Owner and Admin have full access; the business makes its other roles ===== */
let roleDraft = null; let roleData = null; let roleSel = 0; // roleSel: the role shown on a phone
PAGES['/settings/roles'] = {
  title: 'Roles & Permissions',
  async render(main) {
    if (!roleDraft) { roleData = await api('GET', '/api/roles'); roleDraft = structuredClone(roleData.roles); }
    const C = roleData.catalog; const groups = [...new Set(C.map((p) => p.group))];
    const dirty = JSON.stringify(roleDraft.map(({ id, name, desc, perms }) => ({ id, name, desc, perms }))) !== JSON.stringify(roleData.roles.map(({ id, name, desc, perms }) => ({ id, name, desc, perms })));
    const head = (r, i) => `<th class="rp-col"><input class="rp-name" data-i="${i}" data-k="name" value="${esc(r.name)}" maxlength="40" placeholder="Role name" aria-label="Role name">
<input class="rp-desc" data-i="${i}" data-k="desc" value="${esc(r.desc || '')}" maxlength="160" placeholder="What this role is for" aria-label="Description">
<div class="rp-meta"><span class="muted">${r.users ? `${r.users} ${r.users === 1 ? 'person' : 'people'}` : 'No one yet'}</span><button type="button" class="link-btn danger" data-act="roleRm" data-i="${i}" ${r.users ? 'disabled title="Give these team members another role first"' : ''}>Remove</button></div></th>`;
    const saveBar = `<div class="rp-save"><span class="muted">${dirty ? 'Unsaved changes' : 'All changes saved'}</span>${dirty ? '<button type="button" class="btn alt" data-act="roleDiscard">Discard</button>' : ''}<button type="button" class="btn" data-act="roleSave" ${dirty ? '' : 'disabled'}>Save roles</button></div>`;
    // phones: one role at a time (chips to switch), its permissions as a list of switches, instead of a wide table
    if (phoneMq.matches) {
      roleSel = Math.max(0, Math.min(roleSel, roleDraft.length - 1)); const r = roleDraft[roleSel]; const i = roleSel;
      main.innerHTML = `<div class="head"><div><h1>Roles &amp; Permissions</h1><p class="sub">Choose what each team role can see and do. Give someone a role in <a href="/team" data-link>Manage Team</a>.</p></div></div>
<p class="rpm-full"><span class="rpm-ok">✓</span><span><strong>Owner</strong> and <strong>Admins</strong>${roleData.admins ? ` (${roleData.admins})` : ''} always have full access.</span></p>
<div class="rpm-chips">${roleDraft.map((x, k) => `<button type="button" class="ml-chip ${k === i ? 'on' : ''}" data-act="roleSel" data-i="${k}">${esc(x.name || 'New role')}</button>`).join('')}<button type="button" class="ml-chip rpm-add" data-act="roleAdd">+ Add role</button></div>
${r ? `<div class="card rpm"><label class="mf"><span>Role name</span><input class="rp-name" data-i="${i}" data-k="name" value="${esc(r.name)}" maxlength="40" placeholder="Role name"></label>
<label class="mf"><span>What this role is for</span><input class="rp-desc" data-i="${i}" data-k="desc" value="${esc(r.desc || '')}" maxlength="160" placeholder="Optional"></label>
<div class="rpm-meta"><span class="muted">${r.users ? `${r.users} ${r.users === 1 ? 'person has' : 'people have'} this role` : 'No one has this role yet'}</span><button type="button" class="link-btn danger" data-act="roleRm" data-i="${i}" ${r.users ? 'disabled' : ''}>Remove role</button></div>
${groups.map((g) => `<h3 class="rpm-grp">${esc(g)}</h3>` + C.filter((p) => p.group === g).map((p) => `<label class="sw-row rpm-row"><span><strong>${esc(p.label)}</strong>${p.feature && !planHas(p.feature) ? ' <span class="badge draft">Not in your plan</span>' : ''}${p.desc ? `<small class="muted">${esc(p.desc)}</small>` : ''}${p.needs ? `<small class="muted rp-needs">Includes “${esc(C.find((x) => x.key === p.needs).label)}”</small>` : ''}</span><input type="checkbox" class="sw" data-act="roleTick" data-i="${i}" data-k="${p.key}" ${r.perms.includes(p.key) ? 'checked' : ''}><i></i></label>`).join('')).join('')}</div>
${saveBar}` : '<div class="card"><p class="muted" style="margin:0">No roles yet. Add one to choose what those team members can see and do.</p></div>'}
<p class="muted" style="font-size:13px">Settings pages are for the Owner and Admins only.</p>`;
      $$('.rp-name, .rp-desc', main).forEach((el) => el.addEventListener('input', () => { roleDraft[el.dataset.i][el.dataset.k] = el.value; const s = $('.rp-save', main); if (s) { s.querySelector('.muted').textContent = 'Unsaved changes'; s.querySelector('[data-act=roleSave]').disabled = false; } }));
      return;
    }
    const cell = (r, i, p) => `<td class="rp-c"><input type="checkbox" data-act="roleTick" data-i="${i}" data-k="${p.key}" ${r.perms.includes(p.key) ? 'checked' : ''} aria-label="${esc(r.name || 'New role')}: ${esc(p.label)}"></td>`;
    main.innerHTML = `<div class="head"><div><h1>Roles &amp; Permissions</h1><p class="sub">Choose what each team role can see and do. The <strong>Owner</strong> and <strong>Admins</strong> always have full access. Give someone a role in <a href="/team" data-link>Manage Team</a>.</p></div>
<button type="button" class="btn" data-act="roleAdd">+ Add role</button></div>
<div class="card rp-card"><div class="tablewrap"><table class="rp"><thead><tr><th class="rp-first">Permission</th><th class="rp-fixed">Owner<div class="muted">Full access</div></th><th class="rp-fixed">Admin<div class="muted">Full access${roleData.admins ? ` · ${roleData.admins}` : ''}</div></th>${roleDraft.map(head).join('')}</tr></thead>
<tbody>${groups.map((g) => `<tr class="rp-grp"><td class="rp-first">${esc(g)}</td><td></td><td></td>${roleDraft.map(() => '<td></td>').join('')}</tr>` + C.filter((p) => p.group === g).map((p) => `<tr><td class="rp-first"><strong>${esc(p.label)}</strong>${p.feature && !planHas(p.feature) ? ' <span class="badge draft" title="Your plan doesn’t include this yet">Not in your plan</span>' : ''}${p.desc ? `<div class="muted">${esc(p.desc)}</div>` : ''}${p.needs ? `<div class="muted rp-needs">Includes “${esc(C.find((x) => x.key === p.needs).label)}”</div>` : ''}</td>
<td class="rp-c rp-yes" aria-label="Included">✓</td><td class="rp-c rp-yes" aria-label="Included">✓</td>${roleDraft.map((r, i) => cell(r, i, p)).join('')}</tr>`).join('')).join('')}</tbody></table></div>
<div class="rp-save"><span class="muted">${dirty ? 'Unsaved changes' : 'All changes saved'}</span>${dirty ? '<button type="button" class="btn alt" data-act="roleDiscard">Discard</button>' : ''}<button type="button" class="btn" data-act="roleSave" ${dirty ? '' : 'disabled'}>Save roles</button></div></div>
<p class="muted" style="font-size:13px">Settings pages (company profile, app settings, team, roles, email templates, connections and billing) are for the Owner and Admins only.</p>`;
    $$('.rp-name, .rp-desc', main).forEach((el) => el.addEventListener('input', () => { roleDraft[el.dataset.i][el.dataset.k] = el.value; const s = $('.rp-save', main); if (s) { s.querySelector('.muted').textContent = 'Unsaved changes'; s.querySelector('[data-act=roleSave]').disabled = false; } }));
  },
};
// ticking a permission brings along the one it needs (editing clients needs seeing them); unticking one removes those that need it
A.roleTick = (d, el) => {
  const r = roleDraft[d.i]; const C = roleData.catalog; const set = new Set(r.perms);
  if (el.checked) { set.add(d.k); const p = C.find((x) => x.key === d.k); if (p.needs) set.add(p.needs); } else { set.delete(d.k); C.filter((x) => x.needs === d.k).forEach((x) => set.delete(x.key)); }
  r.perms = C.map((x) => x.key).filter((k) => set.has(k)); PAGES['/settings/roles'].render($('#main'));
};
A.roleSel = (d) => { roleSel = Number(d.i); PAGES['/settings/roles'].render($('#main')); };
A.roleAdd = () => { roleSel = roleDraft.length; roleDraft.push({ id: '', name: '', desc: '', perms: ['schedule', 'clients.view', 'jobs.view'], users: 0 }); PAGES['/settings/roles'].render($('#main')); const n = $$('.rp-name'); n[n.length - 1].focus(); };
A.roleRm = (d) => { const r = roleDraft[d.i]; if (r.users) return; if (r.id && !confirm(`Remove the ${r.name} role?`)) return; roleDraft.splice(Number(d.i), 1); PAGES['/settings/roles'].render($('#main')); };
A.roleDiscard = () => { roleDraft = structuredClone(roleData.roles); PAGES['/settings/roles'].render($('#main')); };
A.roleSave = async (d, el) => {
  el.disabled = true;
  try { roleData = await api('PUT', '/api/roles', { roles: roleDraft.map(({ id, name, desc, perms }) => ({ id, name, desc, perms })) }); roleDraft = structuredClone(roleData.roles); toast('Roles saved. Team members see the changes the next time a page loads.'); PAGES['/settings/roles'].render($('#main')); }
  catch (x) { el.disabled = false; toast(x.message, true); }
};

/* ===== /reviews: reviews clients sent through their private link, and Google reviews from the connected Business Profile, with replies ===== */
let revState = { source: 'clients', filter: 'all', list: [], next: '' };
const starRow = (n, size = 16) => `<span class="stars" style="--sz:${size}px" aria-label="${n} out of 5 stars">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= Math.round(n) ? 'on' : ''}">★</i>`).join('')}</span>`;
PAGES['/reviews'] = {
  title: 'Reviews',
  async render(main) {
    const google = revState.source === 'google';
    main.innerHTML = `<div class="head"><div><h1>Reviews</h1><p class="sub">${google ? 'Your Google reviews. Replies show publicly on Google under the review.' : 'What clients say after a job is completed or an invoice is paid. Only your team and the client who wrote each one see them, and only that client can change them. You can reply.'}</p></div></div>
<div class="tabs rv-src" role="tablist">${[['clients', 'From your clients'], ['google', 'Google']].map(([k, l]) => `<button type="button" role="tab" class="${revState.source === k ? 'on' : ''}" data-act="revSource" data-s="${k}">${l}</button>`).join('')}</div><div id="rvBody"></div>`;
    await (google ? renderGoogleReviews : renderClientReviews)($('#rvBody', main));
  },
};
A.revSource = (d) => { revState.source = d.s; PAGES['/reviews'].render($('#main')); };
const crvRef = (r) => { const what = `${r.kind === 'job' ? 'Job' : 'Invoice'} ${esc(r.refNumber || '')}`; const can = r.kind === 'job' ? canDo('jobs.view') : canDo('invoices'); return (can ? `<a href="/${r.kind === 'job' ? 'jobs/edit' : 'invoices/view'}?id=${r.refId}" data-link>${what}</a>` : what) + (r.title ? ` · ${esc(r.title)}` : ''); };
const clientReviewCard = (r) => `<article class="card rv crv" data-id="${esc(r.id)}"><header><span class="rv-ini">${esc((r.clientName[0] || '?').toUpperCase())}</span><div><strong>${r.clientId && canDo('clients.view') ? `<a href="/clients/view?id=${r.clientId}" data-link>${esc(r.clientName)}</a>` : esc(r.clientName)}</strong><div>${starRow(r.stars)} <span class="muted">${fmtDate(r.submittedAt.slice(0, 10))}${r.editedAt ? ` · Edited by the client ${fmtDate(r.editedAt.slice(0, 10))}` : ''}</span></div></div></header>
${(r.answers || []).map((a) => `<div class="rv-ans"><strong>${esc(a.question)}</strong><div>${a.type === 'stars' ? starRow(a.answer) : esc(a.answer)}</div></div>`).join('')}${r.comment ? `<p class="rv-text">${esc(r.comment)}</p>` : (r.answers || []).length ? '' : '<p class="muted rv-text">A rating with no comment.</p>'}${(r.media || []).length ? rvMediaHtml(r.media) : ''}<p class="muted rv-for">${crvRef(r)}</p>${r.reply ? `<div class="rv-reply"><div class="rv-reply-h"><strong>Your reply</strong><span class="muted">${fmtDate(r.reply.updatedAt.slice(0, 10))}</span></div><p>${esc(r.reply.comment)}</p><div class="rv-acts"><button type="button" class="link-btn" data-act="crvEdit">Edit</button><button type="button" class="link-btn danger" data-act="crvDelete">Delete</button></div></div>` : '<div class="rv-acts"><button type="button" class="btn alt" data-act="crvEdit">Reply</button></div>'}</article>`;
const crvOf = (el) => { const card = el.closest('.crv'); return { card, r: revState.clients.find((x) => x.id === card.dataset.id) }; };
const crvRedraw = (card, r) => { card.outerHTML = clientReviewCard(r); };
A.crvEdit = (d, el) => {
  const { card, r } = crvOf(el); const box = $('.rv-reply', card) || $('.rv-acts', card);
  const f = document.createElement('form'); f.className = 'rv-form';
  f.innerHTML = `<label>Your reply<textarea name="comment" rows="4" maxlength="2000" required placeholder="Thank ${esc(r.clientName.split(' ')[0])} for the review">${esc(r.reply ? r.reply.comment : '')}</textarea></label>
<p class="muted" style="font-size:12px;margin:0 0 8px">The client sees your reply${r.reply ? '' : ' and gets an email with it'}. You can’t change their review.</p><div class="rv-acts"><button type="button" class="btn alt" data-act="crvCancel">Cancel</button><button class="btn">${r.reply ? 'Save reply' : 'Send reply'}</button></div>`;
  box.replaceWith(f); $('textarea', f).focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('button.btn:not(.alt)', f); btn.disabled = true;
    try { r.reply = await api('PUT', `/api/reviews/client/${encodeURIComponent(r.id)}/reply`, { comment: f.comment.value }); toast('Reply saved'); crvRedraw(card, r); } catch (err) { btn.disabled = false; toast(err.message, true); }
  });
};
A.crvCancel = (d, el) => { const { card, r } = crvOf(el); crvRedraw(card, r); };
A.crvDelete = async (d, el) => {
  const { card, r } = crvOf(el); if (!confirm('Delete your reply? The client won’t see it anymore.')) return;
  try { await api('DELETE', `/api/reviews/client/${encodeURIComponent(r.id)}/reply`); r.reply = null; toast('Reply deleted'); crvRedraw(card, r); } catch (e) { toast(e.message, true); }
};
async function renderClientReviews(box) {
  const R = await api('GET', '/api/reviews/client'); const S = R.settings; revState.questions = R.questions; revState.clients = R.reviews;
  const sw = (k, label, note) => `<label class="sw-row"><span>${label}<small class="muted">${note}</small></span><input type="checkbox" class="sw" data-rvset="${k}" ${S[k] ? 'checked' : ''}><i></i></label>`;
  box.innerHTML = `<div class="rv-top"><div class="rv-left"><div class="card rv-sum"><div class="rv-avg"><strong>${R.average.toFixed(1)}</strong>${starRow(R.average, 20)}<span class="muted">${R.total} review${R.total === 1 ? '' : 's'}${R.waiting ? `, ${R.waiting} waiting` : ''}</span></div>
<div class="rv-ask"><h3>Ask clients automatically</h3><p class="muted">Clients with an email address get a private review link. A job and its invoice count as one request, and a client is asked at most once every ${R.gapDays} days.</p>
${sw('afterJob', 'When a job is completed', 'The email goes out as soon as the job is marked complete')}${sw('afterInvoice', 'When an invoice is paid', 'Also adds a Leave a review button to the paid invoice page')}${sw('notifyEmail', 'Email me new reviews', `Sent to ${esc(company.email || 'your company email')}`)}</div></div>
<div class="card"><h2>Your questions</h2><p class="muted">Clients see these on the review form, after the star rating. Choose which modules ask each one.</p><div id="rvQs"></div><div class="rv-acts"><button type="button" class="btn alt" data-act="rvqAdd">Add question</button><button type="button" class="btn" data-act="rvqSave">Save questions</button></div></div></div>
<div class="card rv-prev"><div class="rv-prev-h"><h2>What clients see</h2><div class="seg" role="tablist" aria-label="Review form for">${[['job', 'After a job'], ['invoice', 'After an invoice']].map(([k, l]) => `<button type="button" role="tab" class="${(revState.prevKind || 'job') === k ? 'on' : ''}" data-act="rvPrevKind" data-k="${k}">${l}</button>`).join('')}</div></div><p class="muted">An example of the review form with your questions. It changes as you edit them.</p><div id="rvPrev" class="rv-prev-form" aria-hidden="true"></div></div></div>
${R.reviews.length ? R.reviews.map(clientReviewCard).join('') : '<div class="card"><p class="muted" style="margin:0">No client reviews yet. They’ll show here as clients answer.</p></div>'}`;
  drawReviewQuestions();
  const qs = $('#rvQs', box); ['input', 'change'].forEach((ev) => qs.addEventListener(ev, drawReviewPreview));
  box.addEventListener('change', async (e) => {
    const c = e.target.closest('[data-rvset]'); if (!c) return;
    try { await api('PUT', '/api/reviews/settings', { [c.dataset.rvset]: c.checked }); toast('Saved'); } catch (x) { c.checked = !c.checked; toast(x.message, true); }
  });
}
function drawReviewQuestions() {
  const box = $('#rvQs'); if (!box) return; const Q = revState.questions;
  box.innerHTML = Q.length ? Q.map((q, i) => `<div class="rvq" data-i="${i}" data-id="${esc(q.id || '')}"><button type="button" class="drag-h rvq-drag" aria-label="Drag to reorder (or use the arrow keys)" title="Drag to reorder">${DRAG_DOTS}</button><input name="text" maxlength="200" placeholder="e.g. Did we arrive on time?" aria-label="Question" value="${esc(q.text)}">
<select name="type" aria-label="Answer type">${[['stars', 'Star rating'], ['yesno', 'Yes or no'], ['text', 'Written answer']].map(([k, l]) => `<option value="${k}" ${q.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
<span class="rvq-opts"><label><input type="checkbox" name="job" ${q.modules.includes('job') ? 'checked' : ''}> Jobs</label><label><input type="checkbox" name="invoice" ${q.modules.includes('invoice') ? 'checked' : ''}> Invoices</label><label><input type="checkbox" name="required" ${q.required ? 'checked' : ''}> Required</label><button type="button" class="icon-btn rvq-rm" data-act="rvqRm" title="Remove question" aria-label="Remove question">${TRASH}</button></span></div>`).join('') : '<p class="muted" style="margin:0">No questions yet. Clients are asked for a star rating and a comment.</p>';
  drawReviewPreview();
}
// the right-hand example: the client's review form as it looks with the questions on screen (saved or not), for a job or an invoice
function drawReviewPreview() {
  const box = $('#rvPrev'); if (!box) return; const kind = revState.prevKind || 'job';
  const Q = ($('#rvQs .rvq') ? readReviewQuestions() : revState.questions).filter((q) => q.text.trim() && q.modules.includes(kind));
  const stars = () => '<div class="rvp-stars">' + '<i>★</i>'.repeat(5) + '</div>';
  const field = (q) => `<div class="rvp-q"><div class="rvp-l">${esc(q.text)}${q.required ? '' : ' <span class="muted">(optional)</span>'}</div>${q.type === 'stars' ? stars() : q.type === 'yesno' ? '<div class="rvp-yn"><span><i></i>Yes</span><span><i></i>No</span></div>' : '<div class="rvp-box sm"></div>'}</div>`;
  const biz = esc(company.name || 'us');
  box.innerHTML = `<h3>How did we do?</h3><p class="muted">Jane, tell ${biz} about ${kind === 'job' ? 'your recent job' : 'invoice INV-1024'}. Your review goes to the business and isn’t posted publicly.</p>
<div class="rvp-q"><div class="rvp-l">Your overall rating</div>${stars()}</div>${Q.map(field).join('')}
<div class="rvp-box"><span class="muted">Share details of your own experience with ${biz}</span></div><div class="rvp-add">Add photos &amp; videos</div><div class="rvp-btn">Send review</div>`;
}
A.rvPrevKind = (d) => { revState.prevKind = d.k; $$('.rv-prev .seg button').forEach((b) => b.classList.toggle('on', b.dataset.k === d.k)); drawReviewPreview(); };
const readReviewQuestions = () => $$('#rvQs .rvq').map((el) => ({ id: el.dataset.id, text: $('[name=text]', el).value, type: $('[name=type]', el).value, modules: ['job', 'invoice'].filter((m) => $(`[name=${m}]`, el).checked), required: $('[name=required]', el).checked }));
A.rvqAdd = () => { revState.questions = [...readReviewQuestions(), { id: '', text: '', type: 'stars', modules: ['job', 'invoice'], required: false }]; drawReviewQuestions(); const all = $$('#rvQs [name=text]'); all[all.length - 1].focus(); };
A.rvqRm = (d, el) => { const i = Number(el.closest('.rvq').dataset.i); revState.questions = readReviewQuestions().filter((q, n) => n !== i); drawReviewQuestions(); };
// questions reorder by dragging the dotted handle (mouse or touch), or with the arrow keys while it has focus; the order is kept on Save questions
const rvqMoved = (row) => { $$('#rvQs .rvq').forEach((r, i) => { r.dataset.i = i; }); row.classList.remove('moved'); void row.offsetWidth; row.classList.add('moved'); drawReviewPreview(); };
document.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('.rvq .rvq-drag'); if (!h || e.button !== 0) return;
  e.preventDefault(); const row = h.closest('.rvq'); const list = row.parentElement; const start = row.nextElementSibling;
  row.classList.add('dragging'); document.body.classList.add('row-drag'); // listened for on the window: moving the row would drop a pointer capture on the handle
  const move = (ev) => {
    const next = [...list.children].filter((r) => r !== row).find((r) => { const b = r.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
    if ((next || null) !== row.nextElementSibling) list.insertBefore(row, next || null);
    if (ev.clientY < 60) window.scrollBy(0, -12); else if (ev.clientY > innerHeight - 60) window.scrollBy(0, 12);
  };
  const end = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
    row.classList.remove('dragging'); document.body.classList.remove('row-drag');
    if (row.nextElementSibling !== start) rvqMoved(row);
  };
  addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end);
});
document.addEventListener('keydown', (e) => {
  const h = e.target.closest('.rvq .rvq-drag'); if (!h || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault(); const row = h.closest('.rvq'); const other = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling; if (!other) return;
  if (e.key === 'ArrowUp') other.before(row); else other.after(row);
  h.focus(); rvqMoved(row);
});
A.rvqSave = async (d, el) => {
  el.disabled = true;
  try { revState.questions = await api('PUT', '/api/reviews/questions', { questions: readReviewQuestions() }); drawReviewQuestions(); toast('Questions saved'); } catch (x) { toast(x.message, true); }
  el.disabled = false;
};
async function renderGoogleReviews(main) {
    const R = await api('GET', '/api/reviews');
    if (!R.connected) {
      main.innerHTML = `<div class="card rv-empty"><div class="conn-ic">${CONN_ICONS.google}</div><h2>Connect your Google Business Profile</h2><p class="muted">See every Google review in one place and reply without leaving ${esc(company.account.productName)}.</p>
${['owner', 'admin'].includes(role()) ? '<a class="btn" href="/settings/connections" data-link>Go to Account Connections</a>' : '<p class="muted">Ask the account owner or an admin to connect it in Account Connections.</p>'}</div>`;
      return;
    }
    revState = { ...revState, list: R.reviews || [], next: R.next || '' };
    const noReply = revState.list.filter((r) => !r.reply).length;
    main.innerHTML = `
<div class="card rv-sum"><div class="rv-avg"><strong>${(R.average || 0).toFixed(1)}</strong>${starRow(R.average || 0, 20)}<span class="muted">${R.total || 0} review${R.total === 1 ? '' : 's'} on Google</span></div>
<div class="rv-ask"><h3>Ask for reviews</h3><p class="muted">Send happy clients this link. It opens Google’s review form for ${esc(R.title || 'your business')}.</p>
${R.reviewUrl ? `<div class="copy-row"><input readonly value="${esc(R.reviewUrl)}" onclick="this.select()" aria-label="Review link"><button type="button" class="btn alt" data-act="copyInput">Copy</button></div>` : '<p class="muted">Google hasn’t given a review link for this profile yet.</p>'}
${R.mapsUrl ? `<p style="margin:10px 0 0;font-size:13px"><a href="${esc(R.mapsUrl)}" target="_blank" rel="noopener">See your profile on Google Maps</a></p>` : ''}</div></div>
<div class="tabs rv-tabs" role="tablist">${[['all', 'All'], ['open', `Needs a reply${noReply ? ` (${noReply})` : ''}`], ['replied', 'Replied']].map(([k, l]) => `<button type="button" role="tab" class="${revState.filter === k ? 'on' : ''}" data-act="revFilter" data-f="${k}">${l}</button>`).join('')}</div>
<div id="rvList"></div>`;
    drawReviews();
}
function drawReviews() {
  const box = $('#rvList'); if (!box) return;
  const f = revState.filter; const list = revState.list.filter((r) => f === 'all' || (f === 'open' ? !r.reply : !!r.reply));
  const canReply = canDo('reviews');
  box.innerHTML = (list.length ? list.map((r) => `<article class="card rv" data-name="${esc(r.name)}">
<header>${r.photo ? `<img src="${esc(r.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="rv-ini">${esc((r.reviewer[0] || '?').toUpperCase())}</span>`}<div><strong>${esc(r.reviewer)}</strong><div>${starRow(r.stars)} <span class="muted">${fmtDate(String(r.createdAt || '').slice(0, 10))}</span></div></div></header>
${r.comment ? `<p class="rv-text">${esc(r.comment)}</p>` : '<p class="muted rv-text">A rating with no comment.</p>'}
${r.reply ? `<div class="rv-reply"><div class="rv-reply-h"><strong>Your reply</strong><span class="muted">${fmtDate(String(r.reply.updatedAt || '').slice(0, 10))}</span></div><p>${esc(r.reply.comment)}</p>
${canReply ? '<div class="rv-acts"><button type="button" class="link-btn" data-act="revEdit">Edit</button><button type="button" class="link-btn danger" data-act="revDelete">Delete</button></div>' : ''}</div>`
    : canReply ? '<div class="rv-acts"><button type="button" class="btn alt" data-act="revEdit">Reply</button></div>' : ''}
</article>`).join('') : `<div class="card"><p class="muted" style="margin:0">${f === 'open' ? 'Every review has a reply. Nice work.' : f === 'replied' ? 'No replies yet.' : 'No reviews yet. Share your review link with happy clients.'}</p></div>`)
    + (revState.next ? '<div style="text-align:center;margin:12px 0"><button type="button" class="btn alt" data-act="revMore">Show more reviews</button></div>' : '');
}
A.revFilter = (d) => { revState.filter = d.f; $$('.rv-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.f === d.f)); drawReviews(); };
A.revMore = async (d, el) => {
  el.disabled = true;
  try { const R = await api('GET', '/api/reviews?page=' + encodeURIComponent(revState.next)); revState.list.push(...(R.reviews || [])); revState.next = R.next || ''; drawReviews(); } catch (e) { el.disabled = false; toast(e.message, true); }
};
const revOf = (el) => { const card = el.closest('.rv'); return { card, r: revState.list.find((x) => x.name === card.dataset.name) }; };
A.revEdit = (d, el) => {
  const { card, r } = revOf(el); const box = $('.rv-reply', card) || $('.rv-acts', card);
  const f = document.createElement('form'); f.className = 'rv-form';
  f.innerHTML = `<label>Your reply<textarea name="comment" rows="4" maxlength="4000" required placeholder="Thank ${esc(r.reviewer.split(' ')[0])} for the review">${esc(r.reply ? r.reply.comment : '')}</textarea></label>
<p class="muted" style="font-size:12px;margin:0 0 8px">Your reply shows publicly on Google.</p><div class="rv-acts"><button type="button" class="btn alt" data-act="revCancel">Cancel</button><button class="btn">${r.reply ? 'Save reply' : 'Post reply'}</button></div>`;
  box.replaceWith(f); $('textarea', f).focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('button.btn:not(.alt)', f); btn.disabled = true;
    try { r.reply = await api('PUT', '/api/reviews/reply', { name: r.name, comment: f.comment.value }); toast('Reply posted to Google'); drawReviews(); } catch (err) { btn.disabled = false; toast(err.message, true); }
  });
};
A.revCancel = () => drawReviews();
A.revDelete = async (d, el) => {
  const { r } = revOf(el); if (!confirm('Delete your reply? It comes off Google too.')) return;
  try { await api('DELETE', '/api/reviews/reply?name=' + encodeURIComponent(r.name)); r.reply = null; toast('Reply deleted'); drawReviews(); } catch (e) { toast(e.message, true); }
};

/* ===== /automations: the business's own rules that message clients and the team (lib/business-automations.js) ===== */
let AB = null;
const abHour = (h) => `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
const AB_STARTERS = {
  quote: { name: 'Quote follow-up', trigger: 'quoteSent', days: 3, hour: 9, to: 'client', channels: ['email'], subject: 'Any questions about your quote?', body: 'Hello {{first_name}},\n\nWe sent you quote {{number}} a few days ago and wanted to check if you have any questions.\n\n[View your quote]({{link}})\n\nThank you,\n{{company_name}}', smsBody: '{{company_name}}: Any questions about quote {{number}}? View it here: {{link}}' },
  overdue: { name: 'Overdue invoice reminder', trigger: 'invoiceOverdue', days: 3, hour: 9, to: 'client', channels: ['email'], subject: 'Invoice {{number}} is overdue', body: 'Hello {{first_name}},\n\nInvoice {{number}} was due {{due_date}} and {{balance}} is still open.\n\n[View and pay]({{link}})\n\nThank you,\n{{company_name}}', smsBody: '{{company_name}}: Invoice {{number}} is overdue, with {{balance}} open. Pay here: {{link}}' },
  visit: { name: 'Job reminder', trigger: 'jobUpcoming', days: 1, hour: 9, to: 'client', channels: ['email'], subject: 'Your appointment on {{date}}', body: 'Hello {{first_name}},\n\nThis is a reminder that we’ll be there on {{date}} at {{time}} for {{title}}.\n\nNeed to change it? Call us at {{company_phone}}.\n\n{{company_name}}', smsBody: '{{company_name}}: Reminder of your appointment on {{date}} at {{time}}.' },
  thanks: { name: 'Thank you after a job', trigger: 'jobCompleted', days: 1, hour: 10, to: 'client', channels: ['email'], subject: 'Thank you, {{first_name}}', body: 'Hello {{first_name}},\n\nThank you for choosing {{company_name}}. If anything isn’t right with {{title}}, reply to this email and we’ll fix it.', smsBody: '' },
  quiet: { name: 'Win back quiet clients', trigger: 'clientQuiet', days: 180, hour: 10, to: 'client', channels: ['email'], subject: 'It’s been a while, {{first_name}}', body: 'Hello {{first_name}},\n\nIt’s been a while since our last visit. If there’s anything we can help with, we’d love to hear from you.\n\n[Request work]({{portal_link}})\n\n{{company_name}}', smsBody: '' },
  team: { name: 'Tell the team about overdue invoices', trigger: 'invoiceOverdue', days: 14, hour: 8, to: 'team', channels: ['push', 'email'], subject: '{{client_name}}: invoice {{number}} is 14 days overdue', body: 'Invoice {{number}} for {{client_name}} still has {{balance}} open. It was due {{due_date}}.', smsBody: '' },
};
const abBadge = (a) => `<span class="badge ${a.enabled ? 'approved' : 'draft'}">${a.enabled ? 'Active' : 'Not active'}</span>`;
const abChannel = { email: 'Email', sms: 'Text', push: 'App notification' };
PAGES['/automations'] = {
  title: 'Automations',
  async render(main) {
    AB = await api('GET', '/api/automations');
    const t = AB.triggers;
    const row = (a) => `<a class="ab-row ${a.enabled ? '' : 'off'}" href="/automations/edit?id=${a.id}" data-link><div class="ab-main"><strong>${esc(a.name)}</strong><div class="muted">${esc(t[a.trigger].label)}: ${a.days} ${esc(t[a.trigger].when)}, at ${abHour(a.hour)}</div><div class="muted">To ${a.to === 'team' ? 'your team' : 'the client'} by ${a.channels.map((c) => abChannel[c].toLowerCase()).join(' and ')} · ${a.sentCount || 0} sent</div></div>${abBadge(a)}<span class="ab-go" aria-hidden="true">›</span></a>`;
    const starters = Object.entries(AB_STARTERS).map(([k, s]) => `<a class="ab-starter" href="/automations/edit?k=${k}" data-link><strong>${esc(s.name)}</strong><span class="muted">${esc(t[s.trigger].label)}</span></a>`).join('');
    main.innerHTML = `<div class="head"><div><h1>Automations</h1><p class="sub">Send follow-ups and reminders on their own. Turning one on only affects what comes due from that day on, so it won’t message old quotes or invoices.</p></div><div class="actions"><a class="btn" href="/automations/edit" data-link>New automation</a></div></div>
<div class="card"><h2>Your automations</h2>${AB.automations.length ? `<div class="ab-list">${AB.automations.map(row).join('')}</div>` : '<p class="muted">None yet. Start with a template below.</p>'}</div>
<div class="card"><h2>Start from a template</h2><div class="ab-starters">${starters}</div></div>
<div class="card"><h2>Recently sent</h2>${AB.log.length ? `<div class="tablewrap"><table class="m-ablog"><tr><th>When</th><th>Automation</th><th>Client</th><th>By</th><th>Status</th></tr>${AB.log.map((l) => `<tr><td>${esc(new Date(l.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))}</td><td>${esc(l.automation)}</td><td>${esc(l.clientName)}${l.refNumber ? ` (${esc(l.refNumber)})` : ''}</td><td>${esc(abChannel[l.channel] || l.channel)}</td><td>${esc(l.status)}${l.detail ? `<small class="muted" style="display:block">${esc(l.detail)}</small>` : ''}</td></tr>`).join('')}</table></div>` : '<p class="muted">Nothing sent yet.</p>'}</div>`;
  },
};
PAGES['/automations/edit'] = {
  title: 'Automation',
  async render(main) {
    AB = await api('GET', '/api/automations');
    const id = qp('id'); const found = id && AB.automations.find((x) => x.id === id);
    if (id && !found) { main.innerHTML = '<a class="back" href="/automations" data-link>← Automations</a><div class="card"><h2>Automation not found</h2><p class="muted">It may have been deleted.</p></div>'; return; }
    abEditor(main, structuredClone(found || AB_STARTERS[qp('k')] || { name: '', trigger: 'quoteSent', days: 3, hour: 9, to: 'client', channels: ['email'], subject: '', body: '', smsBody: '' }));
  },
};
// the editor is a visual flow (trigger → wait → who → actions) on a canvas; tapping a step opens its settings in the panel on the right
const AB_IC = {
  trigger: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  wait: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  who: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  sms: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  push: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  preview: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
const abIco = (d, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
function abEditor(main, a) {
  const t = AB.triggers; const groups = { quote: 'Quotes', invoice: 'Invoices', job: 'Jobs', client: 'Clients' };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const trigOpts = Object.entries(groups).map(([k, g]) => `<h5 class="wf-g">${g}</h5>${Object.entries(t).filter(([, x]) => x.kind === k).map(([id, x]) => `<label class="wf-opt"><input type="radio" name="trigger" value="${id}" ${a.trigger === id ? 'checked' : ''}><span><strong>${esc(x.label)}</strong><small>${esc(cap(x.when))}</small></span></label>`).join('')}`).join('');
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((h) => `<option value="${h}" ${a.hour === h ? 'selected' : ''}>${abHour(h)}</option>`).join('');
  const tags = AB.tags.length ? `<div class="ab-checks"><span>Only clients tagged</span>${AB.tags.map((g) => `<label><input type="checkbox" name="tags" value="${esc(g)}" ${(a.tags || []).includes(g) ? 'checked' : ''}> ${esc(g)}</label>`).join('')}</div>` : '';
  main.innerHTML = `<div class="head wf-head"><div class="wf-title"><a class="back" href="/automations" data-link>← Automations</a><input class="wf-name" name="name" form="abf" maxlength="80" required placeholder="Name this automation" value="${esc(a.name)}" aria-label="Automation name"><p class="sub" id="abState">${a.id ? '' : 'Save it first. You can activate it after that.'}</p></div><div class="actions">${a.id ? '<button type="button" class="btn alt" id="abDelete">Delete</button><button type="button" class="btn alt" id="abToggle"></button>' : ''}<button class="btn" type="submit" form="abf">Save</button></div></div>
<form id="abf" class="wf">
<div class="wf-canvas"><div class="wf-tools"><button type="button" class="btn alt sm" id="abPreview">Who would get this?</button><button type="button" class="btn alt sm" id="abTest">Email me a test</button></div><div class="wf-scroll" id="wfScroll"><div class="wf-flow" id="wfFlow"></div></div><div class="wf-zoom" role="group" aria-label="Zoom"><button type="button" data-z="out" title="Zoom out" aria-label="Zoom out">−</button><button type="button" data-z="reset" id="wfZl" title="Back to 100%">100%</button><button type="button" data-z="in" title="Zoom in" aria-label="Zoom in">+</button><button type="button" data-z="fit" title="Fit to screen" aria-label="Fit to screen">${abIco('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', 15)}</button></div></div>
<div class="wf-scrim" id="wfScrim"></div>
<aside class="wf-panel" id="wfPanel" aria-label="Step settings">
<div class="wf-ph"><span class="wf-ic" id="wfIc"></span><div class="wf-pt"><small id="wfKind"></small><h3 id="wfTitle"></h3></div><button type="button" class="wf-x" id="wfClose" aria-label="Close">×</button></div>
<div class="wf-pb" id="wfBody">
<section data-p="trigger"><p class="muted wf-lead">What starts this automation.</p>${trigOpts}</section>
<section data-p="wait"><div class="row"><label>Days<input name="days" type="number" min="0" max="365" value="${a.days}"></label><label>Send at<select name="hour">${hours}</select></label></div><p class="muted ab-when" id="abWhen"></p></section>
<section data-p="who"><h4 class="ab-h">Send to</h4><div class="ab-checks"><label><input type="radio" name="to" value="client" ${a.to !== 'team' ? 'checked' : ''}> The client</label><label><input type="radio" name="to" value="team" ${a.to === 'team' ? 'checked' : ''}> Your team</label></div><p class="muted" id="abNote"></p><h4 class="ab-h">Only if</h4>${tags}<label id="abMinW">The amount is at least<input name="minAmount" type="number" min="0" step="0.01" value="${a.minAmount || ''}" placeholder="Any amount"></label>${tags ? '' : '<p class="muted wf-lead" id="abNoTags">Tag clients to send this to only some of them.</p>'}</section>
<section data-p="msg"><p class="muted wf-lead" id="abMsgNote"></p><label><span id="abSubjL">Subject</span><input name="subject" maxlength="200" value="${esc(a.subject)}"></label><label>Message<textarea name="body" rows="10" maxlength="10000">${esc(a.body)}</textarea></label><div class="ab-vars"></div></section>
<section data-p="sms"><p class="muted wf-lead">Only goes to clients who agreed to texts. “Reply STOP to opt out.” is added if it isn’t there.</p><label>Text<textarea name="smsBody" rows="4" maxlength="480">${esc(a.smsBody)}</textarea></label><div class="ab-vars"></div></section>
<section data-p="add"><p class="muted wf-lead">Choose what this automation does. You can add more than one.</p><div class="wf-adds" id="abAdd"></div></section>
<section data-p="preview"><div id="abWho"></div></section>
</div>
<div class="wf-pf"><button type="button" class="btn alt wf-rm" id="abRemove">Remove action</button><button type="button" class="btn wf-done" id="wfDone">Done</button></div>
</aside></form>`;
  const f = $('#abf', main); const panel = $('#wfPanel', f); let last = f.elements.body;
  let ch = [...(a.channels || [])]; let sel = 'trigger';
  const chosen = (name) => $$(`[name="${name}"]:checked`, f).map((x) => x.value);
  const tr = () => t[f.elements.trigger.value]; const to = () => f.elements.to.value;
  const allowed = () => (to() === 'team' ? ['push', 'email'] : ['email', ...(tr().sms && AB.sms ? ['sms'] : [])]);
  const actTitle = (c) => (c === 'email' ? (to() === 'team' ? 'Email your team' : 'Send email') : c === 'sms' ? 'Send text' : 'App notification');
  const waitText = () => `${Number(f.elements.days.value) || 0} ${tr().when}`.replace(/^1 days/, '1 day');
  const miss = (c) => (c === 'sms' ? !f.elements.smsBody.value.trim() : !f.elements.subject.value.trim() || !f.elements.body.value.trim());
  const sum = (c) => (miss(c) ? 'Write the message' : c === 'sms' ? f.elements.smsBody.value.trim() : f.elements.subject.value.trim());
  const why = (c) => {
    if (ch.includes(c)) return 'Already added';
    if (allowed().includes(c)) return '';
    if (c === 'push') return 'App notifications go to your team. Change Send to.';
    return to() === 'team' ? 'Texts go to clients only' : !AB.sms ? 'Text messages aren’t in your plan' : 'Clients agree to texts about their quotes, invoices and appointments, not promotions';
  };
  const ADDS = { email: ['Send email', () => (to() === 'team' ? 'To your company email' : 'With an unsubscribe link at the bottom')], sms: ['Send text', () => 'A text message to the client’s mobile'], push: ['App notification', () => 'To the owner, admins and the job’s crew'] };
  const node = (id, ic, kind, title, sub, cls = '') => `<div class="wf-step"><button type="button" class="wf-node ${cls} ${sel === id ? 'on' : ''}" data-n="${id}"><span class="wf-ic ic-${ic}">${abIco(AB_IC[ic])}</span><span class="wf-nt"><small>${kind}</small><strong>${esc(title)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}</span>${cls === 'warn' ? '<span class="wf-warn" title="Needs a message">!</span>' : ''}</button>${ch.includes(id) ? `<button type="button" class="wf-del" data-del="${id}" aria-label="Remove ${esc(title)}" title="Remove">×</button>` : ''}</div>`;
  const draw = () => {
    const x = tr(); const min = Number(f.elements.minAmount.value) || 0; const tg = chosen('tags');
    const filt = [tg.length ? `Tagged ${tg.join(', ')}` : '', min > 0 && x.kind !== 'client' ? `${money(min)} or more` : ''].filter(Boolean).join(' · ') || (to() === 'team' ? 'Owner, admins and job crew' : 'Every client');
    $('#wfFlow', f).innerHTML = [
      node('trigger', 'trigger', 'Trigger', x.label, groups[x.kind]),
      node('wait', 'wait', 'Wait', `${Number(f.elements.days.value) || 0} day${Number(f.elements.days.value) == 1 ? '' : 's'}, at ${abHour(Number(f.elements.hour.value))}`, cap(x.when.replace(/^days /, ''))),
      node('who', 'who', 'Send to', to() === 'team' ? 'Your team' : 'The client', filt),
      ...ch.map((c) => node(c, c, 'Action', actTitle(c), sum(c), miss(c) ? 'warn' : '')),
    ].join('<i class="wf-line"></i>') + `<i class="wf-line"></i><button type="button" class="wf-plus ${sel === 'add' ? 'on' : ''}" data-n="add" title="Add an action" aria-label="Add an action">${abIco(AB_IC.plus, 16)}</button>${ch.length ? '' : '<span class="wf-hint">Add an action</span>'}<i class="wf-line"></i><span class="wf-end">End</span>`;
  };
  const META = { trigger: ['trigger', 'Trigger', 'When it starts'], wait: ['wait', 'Wait', 'When it sends'], who: ['who', 'Send to', 'Who gets it'], add: ['plus', 'Actions', 'Add an action'], preview: ['preview', 'Preview', 'Who would get this?'] };
  const show = (id, open = true) => {
    sel = id; const sec = id === 'email' || id === 'push' ? 'msg' : id;
    const [ic, kind, title] = META[id] || [id, 'Action', actTitle(id)];
    $$('[data-p]', f).forEach((s) => { s.hidden = s.dataset.p !== sec; });
    $('#wfIc', f).className = `wf-ic ic-${ic}`; $('#wfIc', f).innerHTML = abIco(AB_IC[ic]);
    $('#wfKind', f).textContent = kind; $('#wfTitle', f).textContent = title;
    $('#abRemove', f).hidden = !ch.includes(id);
    if (sec === 'msg') {
      $('#abSubjL', f).textContent = id === 'push' && !ch.includes('email') ? 'Title' : 'Subject';
      $('#abMsgNote', f).textContent = id === 'push' ? `Goes to the owner and admins, and to the crew on a job. Shortened to fit.${ch.includes('email') ? ' Uses the same subject and message as the email.' : ''}` : to() === 'team' ? `Goes to your company email.${ch.includes('push') ? ' The app notification uses this subject and message too.' : ''}` : 'Every email has an unsubscribe link at the bottom.';
      last = f.elements.body;
    }
    if (sec === 'sms') last = f.elements.smsBody;
    if (sec === 'add') $('#abAdd', f).innerHTML = Object.entries(ADDS).map(([c, [label, desc]]) => { const w = why(c); return `<button type="button" class="wf-add" data-add="${c}" ${w ? 'disabled' : ''}><span class="wf-ic ic-${c}">${abIco(AB_IC[c])}</span><span><strong>${label}</strong><small>${esc(w || desc())}</small></span></button>`; }).join('');
    $('#wfBody', f).scrollTop = 0;
    panel.classList.toggle('open', open); $('#wfScrim', f).classList.toggle('open', open);
    draw();
  };
  const close = () => { panel.classList.remove('open'); $('#wfScrim', f).classList.remove('open'); };
  const refresh = () => {
    const x = tr();
    $('#abWhen', f).textContent = `${cap(waitText())}. Times are in your business’s time zone.`;
    $('#abMinW', f).hidden = x.kind === 'client';
    $('#abNote', f).textContent = to() === 'team' ? 'App notifications go to the owner and admins, and to the crew on a job. Email goes to your company email.' : x.sms ? (AB.sms ? 'Texts only go to clients who agreed to them. Every email has an unsubscribe link.' : 'Every email has an unsubscribe link.') : 'Email only: clients agree to texts about their quotes, invoices and appointments, not promotions. Every email has an unsubscribe link.';
    const vars = `<span class="muted">Insert:</span>${Object.entries(AB.vars[f.elements.trigger.value]).map(([k, l]) => `<button type="button" class="ab-var" data-v="${k}" title="${esc(l)}">${esc(l)}</button>`).join('')}`;
    $$('.ab-vars', f).forEach((v) => { v.innerHTML = vars; });
    draw();
  };
  const read = () => ({ id: a.id || '', name: f.elements.name.value, trigger: f.elements.trigger.value, days: f.elements.days.value, hour: f.elements.hour.value, tags: chosen('tags'), minAmount: $('#abMinW', f).hidden ? 0 : f.elements.minAmount.value, to: to(), channels: ch, subject: f.elements.subject.value, body: f.elements.body.value, smsBody: f.elements.smsBody.value });
  // zoom, for a long flow: the buttons, or ctrl/⌘ + scroll on the canvas
  const flow = $('#wfFlow', f); let zoom = 1;
  const setZoom = (z) => { zoom = Math.round(Math.max(0.3, Math.min(1.5, z)) * 100) / 100; flow.style.zoom = zoom; $('#wfZl', f).textContent = `${Math.round(zoom * 100)}%`; };
  const fit = () => { flow.style.zoom = 1; const sc = $('#wfScroll', f); setZoom(Math.min(1, (sc.clientHeight - 8) / flow.scrollHeight, (sc.clientWidth - 8) / flow.scrollWidth)); };
  $('.wf-zoom', f).addEventListener('click', (e) => { const b = e.target.closest('[data-z]'); if (!b) return; const z = b.dataset.z; if (z === 'fit') fit(); else setZoom(z === 'reset' ? 1 : zoom + (z === 'in' ? 0.1 : -0.1)); });
  $('#wfScroll', f).addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(zoom - Math.sign(e.deltaY) * 0.1); }, { passive: false });
  f.addEventListener('focusin', (e) => { if (['subject', 'body', 'smsBody'].includes(e.target.name)) last = e.target; });
  f.addEventListener('change', (e) => {
    if (e.target.name === 'to') ch = e.target.value === 'team' ? ['push', 'email'] : ['email'];
    if (e.target.name === 'trigger') ch = ch.filter((c) => allowed().includes(c));
    refresh();
  });
  f.addEventListener('input', (e) => { if (e.target.name === 'days') refresh(); else if (['subject', 'body', 'smsBody', 'minAmount'].includes(e.target.name)) draw(); });
  f.addEventListener('click', (e) => {
    const n = e.target.closest('[data-n]'); if (n) return show(n.dataset.n);
    const d = e.target.closest('[data-del]'); if (d) { ch = ch.filter((c) => c !== d.dataset.del); return show('add', false); }
    const ad = e.target.closest('[data-add]'); if (ad) { ch = allowed().filter((c) => ch.includes(c) || c === ad.dataset.add); return show(ad.dataset.add); }
    const b = e.target.closest('[data-v]'); if (!b) return;
    const s = last.selectionStart ?? last.value.length; last.setRangeText(`{{${b.dataset.v}}}`, s, last.selectionEnd ?? s, 'end'); last.focus(); draw();
  });
  $('#abRemove', f).addEventListener('click', () => { ch = ch.filter((c) => c !== sel); show('add'); });
  [$('#wfClose', f), $('#wfDone', f), $('#wfScrim', f)].forEach((b) => b.addEventListener('click', close));
  $('#abPreview', f).addEventListener('click', async () => {
    try { const r = await api('POST', '/api/automations/preview', read());
      $('#abWho', f).innerHTML = r.total ? `<p><strong>${r.total} in the next 30 days</strong></p><ul class="wf-who">${r.rows.map((x) => `<li><span>${esc(x.client)}${x.ref ? ` <span class="muted">${esc(x.ref)}</span>` : ''}</span><span class="muted">${esc(new Date(x.due + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}</span>${x.skip ? `<small>Won’t send: ${esc(x.skip)}</small>` : ''}</li>`).join('')}</ul>` : '<p class="muted">Nobody in the next 30 days.</p>';
      show('preview');
    } catch (x) { toast(x.message, true); }
  });
  $('#abTest', f).addEventListener('click', async () => { try { const r = await api('POST', '/api/automations/test', read()); toast(r.status === 'simulated' ? `Test logged for ${r.to} (no email provider set up)` : `Test sent to ${r.to}`); } catch (x) { toast(x.message, true); } });
  // a save error opens the step it's about
  const stepFor = (m) => (/subject and a message/.test(m) ? (ch.includes('email') ? 'email' : 'push') : /text message/.test(m) ? 'sms' : /how to send/.test(m) ? 'add' : /\{\{/.test(m) ? ch.find((c) => c !== 'sms') || 'sms' : /quiet/.test(m) ? 'wait' : /when it should/.test(m) ? 'trigger' : '');
  const failed = (x) => { toast(x.message, true); const s = stepFor(x.message); if (s) show(s); else if (/name/.test(x.message)) f.elements.name.focus(); };
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await api(a.id ? 'PUT' : 'POST', a.id ? `/api/automations/${a.id}` : '/api/automations', read());
      if (a.id) { a.name = f.elements.name.value.trim(); toast('Automation saved'); return; }
      toast('Saved. Activate it when you’re ready.'); navigate(`/automations/edit?id=${r.automations[r.automations.length - 1].id}`);
    } catch (x) { failed(x); }
  });
  refresh(); show('trigger', false);
  if (!a.id) return;
  const showState = () => { $('#abState', main).innerHTML = `${abBadge(a)} ${a.sentCount || 0} sent`; $('#abToggle', main).textContent = a.enabled ? 'Deactivate' : 'Activate'; };
  showState();
  $('#abToggle', main).addEventListener('click', async () => {
    try { // activating saves first, so what goes live is what's on screen
      if (!a.enabled) await api('PUT', `/api/automations/${a.id}`, read());
      const r = await api('POST', `/api/automations/${a.id}`, { on: !a.enabled });
      a.enabled = r.automations.find((x) => x.id === a.id).enabled; showState(); toast(a.enabled ? 'Automation activated' : 'Automation deactivated');
    } catch (x) { failed(x); }
  });
  $('#abDelete', main).addEventListener('click', async () => {
    if (!confirm(`Delete “${a.name}”?`)) return;
    try { await api('DELETE', `/api/automations/${a.id}`); toast('Automation deleted'); navigate('/automations'); } catch (x) { toast(x.message, true); }
  });
}

/* ===== /social-posts: project photos to the connected Facebook Page and Instagram account ===== */
let spDraft = { photos: [], to: null }; // photos: [{ src, label }] picked from the gallery or the device
// Instagram only takes JPEGs: every photo is redrawn on white (no transparency) and sent as a JPEG, at most 1440px
async function toJpeg(src, max = 1440, maxBytes = 0) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Couldn’t read a photo')); i.src = src; });
  const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  let q = 0.88; let out = c.toDataURL('image/jpeg', q);
  while (maxBytes && q > 0.5 && out.length * 0.75 > maxBytes) { q -= 0.08; out = c.toDataURL('image/jpeg', q); } // base64 is 4/3 of the bytes
  return out;
}
// the networks in the post form: key, name, the account it posts to, and its limits (the server checks the same):
// text = caption length (Bluesky counts graphemes), needsPhoto / needsText / needsVideo, maxPhotos
const SP_NETS = [
  ['facebook', 'Facebook', (R) => R.facebook.name, { text: 63206 }],
  ['instagram', 'Instagram', (R) => '@' + R.instagram.username, { text: 2200, needsPhoto: true }],
  ['linkedin', 'LinkedIn', (R) => R.linkedin.name, { text: 3000 }],
  ['tiktok', 'TikTok', (R) => R.tiktok.name, { text: 4000, needsPhoto: true }],
  ['youtube', 'YouTube', (R) => R.youtube.name, { text: 5000, needsVideo: true }],
  ['threads', 'Threads', (R) => '@' + R.threads.username, { text: 500 }],
  ['x', 'X', (R) => '@' + R.x.username, { text: 280, maxPhotos: 4 }],
  ['pinterest', 'Pinterest', (R) => R.pinterest.name, { text: 500, needsPhoto: true }],
  ['bluesky', 'Bluesky', (R) => '@' + R.bluesky.handle, { text: 300, graphemes: true, maxPhotos: 4 }],
  ['google', 'Google Business Profile', (R) => R.google.title, { text: 1500, needsText: true }],
];
const SP_NAMES = Object.fromEntries(SP_NETS.map(([k, n]) => [k, k === 'google' ? 'Google' : n]));
const SP_LIMITS = Object.fromEntries(SP_NETS.map(([k, , , l]) => [k, l]));
const MUSIC_TERMS = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en';
const graphemeCount = (t) => (typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(t)].length : [...t].length);
// Bluesky: the business's handle and an app password (made in Bluesky's settings), checked by signing in
A.bskyConnect = () => {
  const body = modal('Connect Bluesky', `<form class="bsky-form"><p class="muted" style="margin:0 0 14px">Use an <strong>app password</strong>, not your Bluesky password. In Bluesky, go to <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener">Settings → Privacy and security → App passwords</a>, add one called “Worklio Pro” and paste it here. You can revoke it there any time.</p>
<label>Bluesky handle<input name="handle" required autocomplete="off" spellcheck="false" placeholder="yourbusiness.bsky.social"></label>
<label>App password<input name="appPassword" required autocomplete="off" spellcheck="false" placeholder="xxxx-xxxx-xxxx-xxxx"></label>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Connect</button></div></form>`);
  const f = $('form', body); f.handle.focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('.foot .btn:not(.alt)', f); btn.disabled = true; btn.textContent = 'Connecting…';
    try { const C = await api('POST', '/api/connections/bluesky', { handle: f.handle.value, appPassword: f.appPassword.value }); closeModal(); toast(`Bluesky connected as @${C.bluesky.handle}`); refresh(); }
    catch (x) { btn.disabled = false; btn.textContent = 'Connect'; toast(x.message, true); }
  });
};
// X: the keys from the business's own X developer app (X bills that app for each post), checked with X before they're saved
A.xConnect = () => {
  const body = modal('Connect X', `<form class="bsky-form"><p class="muted" style="margin:0 0 10px">X charges for each post made through its API, so you post with your own X developer app and X bills your developer account. Posts with a link cost more than posts without one. See prices at <a href="https://developer.x.com" target="_blank" rel="noopener">developer.x.com</a>.</p>
<ol class="pay-steps" style="margin:0 0 14px"><li>Sign in at <a href="https://developer.x.com" target="_blank" rel="noopener">developer.x.com</a> with your business’s X account and add credits.</li>
<li>Create an app. In its <strong>User authentication settings</strong>, set the app permissions to <strong>Read and write</strong>.</li>
<li>Under <strong>Keys and tokens</strong>, copy the API key and secret, then generate an access token and secret, and paste all four here.</li></ol>
<label>API key<input name="apiKey" required autocomplete="off" spellcheck="false"></label>
<label>API key secret<input name="apiSecret" required autocomplete="off" spellcheck="false"></label>
<label>Access token<input name="accessToken" required autocomplete="off" spellcheck="false"></label>
<label>Access token secret<input name="accessSecret" required autocomplete="off" spellcheck="false"></label>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Connect</button></div></form>`);
  const f = $('form', body); f.apiKey.focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('.foot .btn:not(.alt)', f); btn.disabled = true; btn.textContent = 'Connecting…';
    try { const C = await api('POST', '/api/connections/x', Object.fromEntries(['apiKey', 'apiSecret', 'accessToken', 'accessSecret'].map((k) => [k, f[k].value]))); closeModal(); toast(`X connected as @${C.x.username}`); refresh(); }
    catch (x) { btn.disabled = false; btn.textContent = 'Connect'; toast(x.message, true); }
  });
};
// Marketing → Connect your social accounts: the business connects its own accounts here (the same connections as Account Connections)
const MK_ICONS = {
  // Google's G on a white tile, built when drawn (CONN_ICONS comes later in this file)
  get google() { return '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3.5" y="3.5" width="41" height="41" rx="10" fill="#fff" stroke="#dadce0"/><g transform="translate(10 10) scale(.583)">' + CONN_ICONS.google.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') + '</g></svg>'; },
};
// connections a network has signed out: said at the top of Marketing, so nobody finds out from a failed post
function marketingBroken(C) {
  const out = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'pinterest', 'threads', 'google'].filter((k) => C[k] && C[k].connected && C[k].broken);
  if (!out.length) return '';
  const names = out.map((k) => CONN_LABEL[k]); const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
  const admin = ['owner', 'admin'].includes(role());
  return `<div class="notice mk-notice"><strong>${esc(list)} ${out.length > 1 ? 'need' : 'needs'} reconnecting.</strong> ${out.length > 1 ? 'They' : 'It'} signed Worklio Pro out, so nothing can be posted there until ${out.length > 1 ? 'they’re' : 'it’s'} connected again. ${admin ? out.map((k) => `<button type="button" class="btn sm" data-act="socialConnect" data-kind="${k}" data-back="/social-posts">Reconnect ${esc(CONN_LABEL[k])}</button>`).join(' ') : 'Ask the account owner or an admin to reconnect.'}</div>`;
}
function marketingConnect(C) {
  const admin = ['owner', 'admin'].includes(role());
  const card = (name, icon, body, on) => `<div class="mk-card${on ? ' on' : ''}"><span class="mk-ic">${icon}</span><strong>${name}</strong>${body}</div>`;
  const soon = '<span class="mk-btn soon">Coming soon</span>';
  const ask = '<small class="muted">Ask the account owner or an admin to connect it</small>';
  // the business signs in with its own account on each network
  // who: the account it's connected to; a network the server doesn't list yet shows Coming soon
  const fix = (kind) => `<span class="mk-bad">Needs reconnecting</span>${admin ? `<button type="button" class="mk-btn" data-act="socialConnect" data-kind="${kind}" data-back="/social-posts">Reconnect</button>` : '<small class="muted">Ask the account owner or an admin to reconnect it</small>'}`;
  const live = (kind, name, who) => { const x = C[kind] || {}; return card(name, CONN_ICONS[kind], x.connected && x.broken ? fix(kind) : x.connected
    ? `<span class="mk-on">Connected</span><small class="muted">${esc(who(x))}</small>${admin ? `<a class="mk-link" href="/settings/connections#conn-${kind}" data-link>Manage</a>` : ''}`
    : !x.available ? soon
      : admin ? `<button type="button" class="mk-btn" data-act="socialConnect" data-kind="${kind}" data-back="/social-posts">+ Connect</button>` : '<small class="muted">Ask the account owner or an admin to connect it</small>', x.connected); };
  const G = C.google || {};
  const gbp = card('Google Business Profile', MK_ICONS.google, G.connected && G.broken ? fix('google') : G.connected
    ? `<span class="mk-on">Connected</span><small class="muted">${esc(G.title)}</small>${admin ? '<a class="mk-link" href="/settings/connections#conn-google" data-link>Manage</a>' : ''}`
    : !G.available ? soon : admin ? '<button type="button" class="mk-btn" data-act="socialConnect" data-kind="google" data-back="/social-posts">+ Connect</button>' : '<small class="muted">Ask the account owner or an admin to connect it</small>', G.connected);
  const B = C.bluesky || {};
  const bsky = card('Bluesky', CONN_ICONS.bluesky, B.connected
    ? `<span class="mk-on">Connected</span><small class="muted">@${esc(B.handle)}</small>${admin ? '<a class="mk-link" href="/settings/connections#conn-bluesky" data-link>Manage</a>' : ''}`
    : B.available === false ? soon : admin ? '<button type="button" class="mk-btn" data-act="bskyConnect">+ Connect</button>' : ask, B.connected);
  const X = C.x || {};
  const xCard = card('X', CONN_ICONS.x, X.connected
    ? `<span class="mk-on">Connected</span><small class="muted">@${esc(X.username)}</small>${admin ? '<a class="mk-link" href="/settings/connections#conn-x" data-link>Manage</a>' : ''}`
    : X.available === false ? soon : admin ? '<button type="button" class="mk-btn" data-act="xConnect">+ Connect</button>' : ask, X.connected);
  return `${marketingBroken(C)}<section class="mk-connect"><h2>Connect your social accounts</h2><p class="muted">Pick where you want to publish. You can add or remove networks anytime.</p>
<div class="mk-grp">Major networks</div><div class="mk-grid">${live('facebook', 'Facebook', (x) => x.name)}${live('instagram', 'Instagram', (x) => '@' + x.username)}${live('linkedin', 'LinkedIn', (x) => x.name)}${live('tiktok', 'TikTok', (x) => x.name)}${live('youtube', 'YouTube', (x) => x.name)}</div>
<div class="mk-grp">More networks</div><div class="mk-grid">${bsky}${live('pinterest', 'Pinterest', (x) => x.name)}${live('threads', 'Threads', (x) => '@' + x.username)}${xCard}${gbp}</div></section>`;
}
/* ===== Marketing → Every job markets itself: posts drafted from finished jobs, waiting for approval (lib/job-posts.js) ===== */
// where a job's post can go: TikTok needs its own options and YouTube a video, so those are posted from New post
const JP_NETS = ['facebook', 'instagram', 'google', 'linkedin', 'threads', 'pinterest', 'bluesky', 'x'];
const JP_TONES = [['friendly', 'Friendly'], ['proud', 'Proud'], ['professional', 'Professional'], ['shorter', 'Shorter']];
let jpTo = null; // the networks ticked for job posts on this visit (shared by every draft)
let jpTimer = 0;
function jobPostsSection(J, R) {
  if (!J || !J.included) return '';
  const admin = ['owner', 'admin'].includes(role());
  const nets = SP_NETS.filter(([k]) => JP_NETS.includes(k) && R[k]);
  if (!jpTo) jpTo = nets.map(([k]) => k);
  const s = J.stats.month; const L = J.stats.last;
  const tile = (v, l, sub) => `<div class="jp-stat"><strong>${Number(v).toLocaleString('en-US')}</strong><span>${l}</span><small>${sub}</small></div>`;
  const last = L.posts ? `<p class="muted jp-last">Last month: ${L.posts} post${L.posts === 1 ? '' : 's'} from jobs${J.booking ? `, ${L.visits} booking page visit${L.visits === 1 ? '' : 's'} and ${L.requests} request${L.requests === 1 ? '' : 's'} from them` : ''}.</p>` : '';
  const draft = (d) => d.status === 'writing'
    ? `<div class="jp-draft"><div class="jp-top"><strong>${esc(d.jobNumber ? d.jobNumber + ' · ' : '')}${esc(d.jobTitle)}</strong></div><p class="muted" style="margin:0">Writing the caption…</p></div>`
    : `<form class="jp-draft" data-id="${d.id}">
<div class="jp-top"><strong>${esc(d.jobNumber ? d.jobNumber + ' · ' : '')}${esc(d.jobTitle)}</strong>${d.town ? `<span class="muted">${esc(d.town)}</span>` : ''}<a class="mk-link" href="/jobs/edit?id=${d.jobId}" data-link>Open job</a></div>
<p class="muted jp-hint">Tick the photos to post (up to 10). The first one ticked is the cover.</p>
<div class="jp-photos">${d.photos.map((p) => `<label title="${esc(p.label)}"><input type="checkbox" name="pic" value="${esc(p.url)}" ${p.picked ? 'checked' : ''}><img src="${esc(p.url)}" alt="${esc(p.label)} photo" loading="lazy"><span>${esc(p.label)}</span></label>`).join('')}</div>
<label>Caption${d.ai ? ' <small class="muted">written by AI from the photos and the job. Change anything you like.</small>' : ''}<textarea name="caption" rows="6" maxlength="2200">${esc(d.caption)}</textarea></label>
${J.ai ? `<div class="jp-tones"><span class="muted">Write it again:</span>${JP_TONES.map(([k, n]) => `<button type="button" class="btn alt sm" data-act="jpRewrite" data-id="${d.id}" data-tone="${k}">${n}</button>`).join('')}</div>` : ''}
${nets.length ? `<div class="sp-dests">${nets.map(([k, n, who]) => `<label class="sp-dest"><input type="checkbox" name="to" value="${k}" ${jpTo.includes(k) ? 'checked' : ''}>${CONN_ICONS[k]}<span><strong>${n}</strong><small>${esc(who(R))}</small></span></label>`).join('')}</div>` : '<p class="muted">Connect a social account above to post this.</p>'}
${J.booking && nets.length ? '<p class="muted jp-hint">A link to your booking page is added on Facebook, LinkedIn and Threads, and to the Google and Pinterest buttons, so you can see the requests your posts bring in.</p>' : ''}
<div class="sp-foot"><button type="button" class="btn alt" data-act="jpSkip" data-id="${d.id}">Skip this one</button><button class="btn"${nets.length ? '' : ' disabled'}>Post now</button></div></form>`;
  const done = (d) => `<div class="sp-row">${d.photos.find((p) => p.picked) ? `<img src="${esc(d.photos.find((p) => p.picked).url)}" alt="" loading="lazy">` : '<span class="sp-noimg"></span>'}
<div><p><strong>${esc(d.jobNumber ? d.jobNumber + ' · ' : '')}${esc(d.jobTitle)}</strong></p><div class="sp-meta"><span class="muted">Posted ${fmtDate(d.postedAt.slice(0, 10))}${d.by ? ' by ' + esc(d.by) : ''}</span>
${Object.entries(d.results).filter(([, r]) => r.status === 'posted' && r.url).map(([k, r]) => `<a class="conn-chip on" href="${esc(r.url)}" target="_blank" rel="noopener"><i></i>${SP_NAMES[k] || k}</a>`).join('')}
${J.booking ? `<span class="muted">${d.visits} visit${d.visits === 1 ? '' : 's'} · ${d.requests} request${d.requests === 1 ? '' : 's'}</span>` : ''}</div></div><span></span></div>`;
  return `<section class="card jp" id="jobPosts"><div class="jp-head"><div><h2>Every job markets itself${J.beta ? '<span class="beta-tag">Beta</span>' : ''}</h2>
<p class="muted">When a job is completed and has photos, it becomes a ready-to-post social post${J.ai ? ' with a caption written by AI' : ''}. Check it here and post it to your accounts with one tap. Nothing goes out until you approve it.</p></div>
${admin ? `<div class="jp-set"><label class="sp-chk"><input type="checkbox" id="jpOn" ${J.settings.on ? 'checked' : ''}> Make posts from finished jobs</label><label class="sp-chk"><input type="checkbox" id="jpMail" ${J.settings.notify ? 'checked' : ''}> Email the owner when one is ready</label></div>` : ''}</div>
<div class="jp-stats">${tile(s.posts, 'Posts from jobs', 'this month')}${tile(s.reviews, 'Client reviews', 'this month')}${J.booking ? tile(s.visits, 'Booking page visits', 'from your posts this month') + tile(s.requests, 'Booking requests', 'from your posts this month') : ''}</div>${last}
<h3 class="jp-h">Ready to post${J.ready.length ? ` (${J.ready.length})` : ''}</h3>
${J.ready.length ? J.ready.map(draft).join('') : `<p class="muted jp-empty">${J.settings.on ? 'Nothing waiting. Complete a job with before and after photos (in Project Gallery, a job note or a checklist) and its post shows up here.' : 'Making posts from finished jobs is turned off.'}</p>`}
${J.done.length ? `<h3 class="jp-h">Posted from jobs</h3><div class="sp-list">${J.done.map(done).join('')}</div>` : ''}</section>`;
}
function bindJobPosts(J, R) {
  clearTimeout(jpTimer); if (!J || !J.included) return;
  if (J.ready.some((d) => d.status === 'writing')) jpTimer = setTimeout(() => { if (location.pathname === '/social-posts') refresh(); }, 4000); // the caption is being written
  const setting = (id, key) => { const el = $('#' + id); if (el) el.addEventListener('change', async () => { try { await api('PUT', '/api/social-posts/jobs/settings', { [key]: el.checked }); toast('Saved'); if (key === 'on') refresh(); } catch (x) { el.checked = !el.checked; toast(x.message, true); } }); };
  setting('jpOn', 'on'); setting('jpMail', 'notify');
  for (const f of $$('form.jp-draft')) {
    const id = f.dataset.id; const cap = f.caption; let saved = cap.value;
    const picked = () => $$('input[name=pic]:checked', f).map((c) => c.value);
    $$('input[name=pic]', f).forEach((c) => c.addEventListener('change', async () => {
      if (picked().length > 10) { c.checked = false; return toast('Up to 10 photos per post', true); }
      try { await api('PUT', '/api/social-posts/jobs/' + id, { picked: picked() }); } catch (x) { toast(x.message, true); }
    }));
    cap.addEventListener('blur', async () => { if (cap.value === saved) return; try { await api('PUT', '/api/social-posts/jobs/' + id, { caption: cap.value }); saved = cap.value; } catch (x) { toast(x.message, true); } });
    $$('input[name=to]', f).forEach((c) => c.addEventListener('change', () => { jpTo = $$('input[name=to]:checked', f).map((x) => x.value); $$('form.jp-draft input[name=to]').forEach((x) => { x.checked = jpTo.includes(x.value); }); }));
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); const btn = $('.sp-foot .btn:not(.alt)', f); const to = $$('input[name=to]:checked', f).map((x) => x.value); const pics = picked(); const text = cap.value.trim();
      if (!to.length) return toast('Choose where to post', true);
      if (!pics.length) return toast('Tick at least one photo', true);
      for (const k of to) {
        const Lm = SP_LIMITS[k]; const n = SP_NAMES[k]; const len = Lm.graphemes ? graphemeCount(text) : text.length;
        if (len > Lm.text) return toast(`${n} posts can be up to ${Lm.text.toLocaleString('en-US')} characters. Shorten the caption or untick ${n}.`, true);
        if (Lm.needsText && !text) return toast(`${n} posts need a caption`, true);
        if (Lm.maxPhotos && pics.length > Lm.maxPhotos) return toast(`${n} posts can have up to ${Lm.maxPhotos} photos. Untick some photos or untick ${n}.`, true);
      }
      btn.disabled = true; btn.textContent = 'Posting…';
      try {
        const images = []; for (const src of pics) images.push(await toJpeg(src, 1440, to.includes('bluesky') ? 950000 : 0));
        const p = await api('POST', '/api/social-posts', { caption: cap.value, images, to, draftId: id });
        const bad = Object.entries(p.results).filter(([, r]) => r.status !== 'posted');
        if (bad.length) toast(`Didn’t post to ${bad.map(([k]) => SP_NAMES[k]).join(' or ')}: ${bad[0][1].error}`, true); else toast('Posted');
        refresh();
      } catch (x) { btn.disabled = false; btn.textContent = 'Post now'; toast(x.message, true); }
    });
  }
}
A.jpRewrite = async (d, el) => {
  const btns = $$(`[data-act=jpRewrite][data-id="${d.id}"]`); btns.forEach((b) => { b.disabled = true; }); const was = el && el.textContent; if (el) el.textContent = 'Writing…';
  try { await api('POST', `/api/social-posts/jobs/${d.id}/caption`, { tone: d.tone }); refresh(); } catch (x) { btns.forEach((b) => { b.disabled = false; }); if (el) el.textContent = was; toast(x.message, true); }
};
A.jpSkip = async (d) => { try { await api('DELETE', '/api/social-posts/jobs/' + d.id); toast('Skipped. It won’t be posted.'); refresh(); } catch (x) { toast(x.message, true); } };
PAGES['/social-posts'] = {
  title: 'Marketing',
  async render(main) {
    const [R, C, J] = await Promise.all([api('GET', '/api/social-posts'), api('GET', '/api/connections'), planHas('jobPosts') ? api('GET', '/api/social-posts/jobs').catch(() => null) : null]);
    connReturnNotice();
    const head = `<div class="mk-hero"><h1>Grow your audience by posting across platforms in minutes</h1><p class="sub">One place for your business’s social media. Create a post once and publish it to every account you connect. Before-and-after photos from your jobs make great posts.</p></div>
${jobPostsSection(J, R)}${marketingConnect(C)}`;
    if (!SP_NETS.some(([k]) => R[k])) { main.innerHTML = head; bindJobPosts(J, R); return; }
    if (!spDraft.to) spDraft.to = Object.keys(SP_NAMES).filter((k) => R[k]);
    const dest = (k, name, label) => `<label class="sp-dest ${R[k] ? '' : 'off'}"><input type="checkbox" name="to" value="${k}" ${R[k] ? '' : 'disabled'} ${R[k] && spDraft.to.includes(k) ? 'checked' : ''}>${CONN_ICONS[k]}<span><strong>${name}</strong><small>${R[k] ? esc(label) : 'Not connected'}</small></span></label>`;
    const res = (p, k, name) => { const r = p.results[k]; if (!r) return ''; return r.status === 'posted' ? `<a class="conn-chip on" href="${esc(r.url)}" target="_blank" rel="noopener"><i></i>${name}: view post</a>` : `<span class="conn-chip bad" title="${esc(r.error)}"><i></i>${name}: didn’t post</span>`; };
    main.innerHTML = `${head}
<form class="card sp-new" id="spForm"><h2>New post</h2>
<div class="sp-dests">${SP_NETS.filter(([k]) => R[k]).map(([k, n, who]) => dest(k, n, R[k] && who(R))).join('')}</div>
<div class="sp-tt" id="spTt" hidden></div>
<div class="sp-tt" id="spYt" hidden></div>
<div class="sp-photos" id="spPhotos"></div>
<div class="sp-add"><button type="button" class="btn alt sm" data-act="spGallery">Choose from Project Gallery</button><label class="btn alt sm">Upload photos<input type="file" accept="image/*" multiple hidden id="spFile"></label>${R.youtube ? '<label class="btn alt sm">Add video<input type="file" accept="video/mp4,video/quicktime,video/webm" hidden id="spVid"></label>' : ''}<span class="muted" style="font-size:13px">Up to 10 photos. The first one is the cover; Pinterest and Google use only that one, Bluesky and X up to 4.${R.youtube ? ' Only YouTube uses the video.' : ''}</span></div>
<div class="sp-video" id="spVideo" hidden></div>
<label>Caption<textarea name="caption" rows="4" maxlength="2200" placeholder="Another pool back to sparkling! Swipe to see the before and after. Call us for a free quote.">${esc(spDraft.caption || '')}</textarea></label>
<div class="sp-foot"><span class="muted" id="spCount" style="font-size:13px"></span><button class="btn">Post now</button></div></form>
<div class="card"><h2>Posted</h2>${(R.posts || []).length ? `<div class="sp-list">${R.posts.map((p) => `<div class="sp-row">${p.images[0] ? `<img src="${esc(p.images[0])}" alt="" loading="lazy">` : '<span class="sp-noimg"></span>'}
<div><p>${p.caption ? esc(p.caption.length > 220 ? p.caption.slice(0, 220) + '…' : p.caption) : '<span class="muted">No caption</span>'}</p><div class="sp-meta"><span class="muted">${fmtDate(p.createdAt.slice(0, 10))}${p.by ? ' · ' + esc(p.by) : ''}${p.images.length > 1 ? ` · ${p.images.length} photos` : ''}${p.video ? ' · video' : ''}</span>${SP_NETS.map(([k]) => res(p, k, SP_NAMES[k])).join('')}</div>
${Object.values(p.results).filter((r) => r.status !== 'posted').map((r) => `<p class="sp-err">${esc(r.error)}</p>`).join('')}${Object.values(p.results).some((r) => r.status !== 'posted' && r.reconnect) ? spReconnect() : ''}</div>
${['owner', 'admin'].includes(role()) ? `<button type="button" class="x sp-x" data-act="spRemove" data-id="${p.id}" title="Remove from this list (it stays on the networks it was posted to)" aria-label="Remove from this list">×</button>` : ''}</div>`).join('')}</div>` : '<p class="muted" style="margin:0">Nothing posted yet.</p>'}</div>`;
    const f = $('#spForm'); const cap = f.caption;
    const len = (k, t) => (SP_LIMITS[k].graphemes ? graphemeCount(t) : t.length);
    // the caption limit: the shortest of the ticked networks'
    const count = () => {
      const k = spDraft.to.filter((x) => SP_LIMITS[x]).sort((a, b) => SP_LIMITS[a].text - SP_LIMITS[b].text)[0];
      const max = k ? SP_LIMITS[k].text : 2200; const n = k ? len(k, cap.value) : cap.value.length; const el = $('#spCount');
      el.textContent = `${n.toLocaleString('en-US')} / ${max.toLocaleString('en-US')}${k && spDraft.to.length > 1 ? ` (${SP_NAMES[k]})` : ''}`; el.classList.toggle('sp-over', n > max); spDraft.caption = cap.value;
    };
    cap.addEventListener('input', count); count();
    $$('input[name=to]', f).forEach((c) => c.addEventListener('change', () => { spDraft.to = $$('input[name=to]:checked', f).map((x) => x.value); count(); spTikTok(); spYouTube(); }));
    spTikTok(); spYouTube();
    const vid = $('#spVid');
    if (vid) vid.addEventListener('change', (e) => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      if (file.size > 500e6) return toast('Videos can be up to 500 MB', true);
      spDraft.video = file; spDraft.videoPath = ''; drawSpVideo();
    });
    drawSpVideo();
    $('#spFile').addEventListener('change', async (e) => {
      for (const file of [...e.target.files]) { if (spDraft.photos.length >= 10) { toast('Up to 10 photos per post', true); break; } try { spDraft.photos.push({ src: await readFileAsDataUrl(file), label: file.name }); } catch (x) { toast('Couldn’t read ' + file.name, true); } }
      e.target.value = ''; drawSpPhotos();
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); const btn = $('.sp-foot .btn', f); const to = spDraft.to;
      if (!to.length) return toast('Choose where to post', true);
      const text = cap.value.trim();
      for (const k of to) {
        const L = SP_LIMITS[k]; const n = SP_NAMES[k]; if (!L) continue;
        if (len(k, text) > L.text) return toast(`${n} posts can be up to ${L.text.toLocaleString('en-US')} characters. Shorten the caption or untick ${n}.`, true);
        if (L.needsPhoto && !spDraft.photos.length) return toast(`${n} posts need at least one photo`, true);
        if (L.needsText && !text) return toast(`${n} posts need a caption`, true);
        if (L.maxPhotos && spDraft.photos.length > L.maxPhotos) return toast(`${n} posts can have up to ${L.maxPhotos} photos. Remove some or untick ${n}.`, true);
        if (L.needsVideo && !spDraft.video) return toast(`${n} posts need a video. Click Add video, or untick ${n}.`, true);
      }
      const tt = to.includes('tiktok') ? spDraft.tiktok || {} : null;
      if (tt && !tt.privacy) return toast('Choose who can see the TikTok post', true);
      const yt = to.includes('youtube') ? spDraft.youtube || {} : null;
      if (yt && !yt.privacy) return toast('Choose who can see the YouTube video', true);
      if (!spDraft.photos.length && !cap.value.trim() && !yt) return toast('Add a photo or write a caption', true);
      btn.disabled = true; btn.textContent = 'Posting…';
      try {
        // the video goes up first, as the file itself; it's kept for another try if the post doesn't go out
        if (yt && !spDraft.videoPath) spDraft.videoPath = await spUploadVideo(spDraft.video, (pct) => { btn.textContent = `Uploading video ${pct}%`; });
        btn.textContent = 'Posting…';
        const images = []; for (const p of spDraft.photos) images.push(await toJpeg(p.src, 1440, to.includes('bluesky') ? 950000 : 0));
        const p = await api('POST', '/api/social-posts', { caption: cap.value, images, to, ...(tt ? { tiktok: tt } : {}), ...(yt ? { youtube: yt, video: spDraft.videoPath } : {}) });
        const bad = Object.entries(p.results).filter(([, r]) => r.status !== 'posted');
        if (bad.length) toast(`Didn’t post to ${bad.map(([k]) => SP_NAMES[k]).join(' or ')}: ${bad[0][1].error}`, true); else toast('Posted');
        if (bad.length < Object.keys(p.results).length) spDraft = { photos: [], to: null };
        refresh();
      } catch (x) { btn.disabled = false; btn.textContent = 'Post now'; toast(x.message, true); }
    });
    drawSpPhotos(); bindJobPosts(J, R);
  },
};
// the post's video (YouTube only): its name and size, with a button to take it off
function drawSpVideo() {
  const box = $('#spVideo'); if (!box) return; const v = spDraft.video; box.hidden = !v; if (!v) return;
  box.innerHTML = `${CONN_ICONS.youtube}<span><strong>${esc(v.name)}</strong> <small class="muted">${v.size < 1e6 ? `${Math.ceil(v.size / 1e3)} KB` : `${(v.size / 1e6).toFixed(1)} MB`}</small></span><button type="button" class="x" data-act="spDropVideo" title="Remove video" aria-label="Remove video">×</button>`;
}
A.spDropVideo = () => { spDraft.video = null; spDraft.videoPath = ''; drawSpVideo(); };
// sends the video as the file itself (it can be large), with progress; resolves to its address on the server
const spUploadVideo = (file, progress) => new Promise((resolve, reject) => {
  const x = new XMLHttpRequest(); x.open('POST', '/api/social-posts/video'); x.setRequestHeader('content-type', file.type || 'application/octet-stream');
  x.upload.onprogress = (e) => { if (e.lengthComputable) progress(Math.floor((e.loaded / e.total) * 100)); };
  x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch (e) { /* not JSON */ } if (x.status < 300 && j.video) resolve(j.video); else reject(new Error(j.error || 'The video didn’t finish uploading. Please try again.')); };
  x.onerror = () => reject(new Error('The video didn’t finish uploading. Check your connection and try again.'));
  x.send(file);
});
// YouTube's choices for the video: its title (the caption's first line if left empty), who can see it, and whether it's made for kids
async function spYouTube() {
  const box = $('#spYt'); if (!box) return; const on = spDraft.to.includes('youtube'); box.hidden = !on; if (!on || box.dataset.loaded) return;
  box.dataset.loaded = '1';
  const y = spDraft.youtube = spDraft.youtube || { title: '', privacy: '', kids: false };
  box.innerHTML = `<h3>${CONN_ICONS.youtube}YouTube video</h3>
<div class="sp-tt-row"><label>Title<input name="ytTitle" maxlength="100" value="${esc(y.title)}" placeholder="The caption’s first line"></label>
<label>Who can see it<select name="ytPrivacy"><option value="">Choose…</option>${[['public', 'Public'], ['unlisted', 'Unlisted'], ['private', 'Private']].map(([k, n]) => `<option value="${k}" ${y.privacy === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
<label class="sp-chk"><input type="checkbox" name="ytKids" ${y.kids ? 'checked' : ''}> Made for kids</label></div>
<p class="muted">The caption becomes the video’s description. A vertical video up to 3 minutes long becomes a YouTube Short. Until Google approves this app, uploaded videos stay private.</p>`;
  box.querySelector('[name=ytTitle]').addEventListener('input', (e) => { y.title = e.target.value; });
  box.querySelector('[name=ytPrivacy]').addEventListener('change', (e) => { y.privacy = e.target.value; });
  box.querySelector('[name=ytKids]').addEventListener('change', (e) => { y.kids = e.target.checked; });
}
// a network signed the business out: owners and admins get a button to fix it; everyone else is told who can
const spReconnect = () => ['owner', 'admin'].includes(role()) ? '<p style="margin:6px 0 0"><a class="btn sm" href="/settings/connections" data-link>Go to Account Connections to reconnect</a></p>' : '<p class="muted" style="margin:6px 0 0">Ask the account owner or an admin to connect it again.</p>';
const TT_HINT = { SELF_ONLY: 'Until TikTok approves this app, posts can only be private.' };
async function spTikTok() {
  const box = $('#spTt'); if (!box) return; const on = spDraft.to.includes('tiktok'); box.hidden = !on; if (!on || box.dataset.loaded) return;
  box.dataset.loaded = '1'; box.innerHTML = '<p class="muted" style="margin:0">Checking your TikTok account…</p>';
  let c; try { c = await api('GET', '/api/social-posts/tiktok'); } catch (x) { box.innerHTML = `<p class="sp-err" style="margin:0">${esc(x.message)}</p>${x.data && x.data.reconnect ? spReconnect() : ''}`; delete box.dataset.loaded; return; }
  const t = spDraft.tiktok = spDraft.tiktok || { privacy: '', comments: !c.commentsOff, brand: false };
  const only = c.privacy.length === 1 && c.privacy[0].id === 'SELF_ONLY';
  box.innerHTML = `<h3>${CONN_ICONS.tiktok}TikTok · posting as ${esc(c.nickname)}${c.username ? ` <span class="muted">@${esc(c.username)}</span>` : ''}</h3>
<div class="sp-tt-row"><label>Who can see this post<select name="ttPrivacy"><option value="">Choose…</option>${c.privacy.map((o) => `<option value="${o.id}" ${t.privacy === o.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>
<label class="sp-chk"><input type="checkbox" name="ttComments" ${t.comments && !c.commentsOff ? 'checked' : ''} ${c.commentsOff ? 'disabled' : ''}> Allow comments</label>
<label class="sp-chk"><input type="checkbox" name="ttBrand" ${t.brand ? 'checked' : ''}> This post promotes my business</label></div>
${only ? `<p class="muted">${TT_HINT.SELF_ONLY}</p>` : ''}<p class="muted" id="ttBrandNote" ${t.brand ? '' : 'hidden'}>TikTok labels it “Promotional content”.</p>
<p class="muted">By posting, you agree to TikTok’s <a href="${MUSIC_TERMS}" target="_blank" rel="noopener">Music Usage Confirmation</a>.</p>`;
  box.querySelector('[name=ttPrivacy]').addEventListener('change', (e) => { t.privacy = e.target.value; });
  box.querySelector('[name=ttComments]').addEventListener('change', (e) => { t.comments = e.target.checked; });
  box.querySelector('[name=ttBrand]').addEventListener('change', (e) => { t.brand = e.target.checked; $('#ttBrandNote').hidden = !t.brand; });
}
function drawSpPhotos() {
  const box = $('#spPhotos'); if (!box) return;
  box.innerHTML = spDraft.photos.map((p, i) => `<figure><img src="${esc(p.src)}" alt="${esc(p.label)}">${i === 0 ? '<span class="sp-cover">Cover</span>' : ''}<div class="sp-tools">${i ? `<button type="button" data-act="spMove" data-i="${i}" title="Move earlier" aria-label="Move earlier">‹</button>` : ''}<button type="button" data-act="spDrop" data-i="${i}" title="Remove" aria-label="Remove photo">×</button></div></figure>`).join('');
  box.hidden = !spDraft.photos.length;
}
A.spDrop = (d) => { spDraft.photos.splice(+d.i, 1); drawSpPhotos(); };
A.spMove = (d) => { const i = +d.i; [spDraft.photos[i - 1], spDraft.photos[i]] = [spDraft.photos[i], spDraft.photos[i - 1]]; drawSpPhotos(); };
A.spRemove = async (d) => { if (!confirm('Remove this post from the list? It stays on the networks it was posted to.')) return; await api('DELETE', '/api/social-posts/' + d.id); refresh(); };
// pick from the Project Gallery, newest first, grouped by job
A.spGallery = async () => {
  const mb = modal('Choose photos', '<p class="muted">Loading…</p>', true);
  const photos = (await api('GET', '/api/photos')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!photos.length) { mb.innerHTML = '<p>No photos yet. Add before, progress and after photos to jobs in <a href="/project-gallery" data-link>Project Gallery</a>.</p><div class="foot"><button type="button" class="btn alt" data-act="closeModal">Close</button></div>'; return; }
  const jobs = [...new Set(photos.map((p) => p.jobId))];
  mb.innerHTML = `<form id="spPick"><div class="sp-pick">${jobs.map((jid) => { const j = byId(D.jobs, jid); return `<h4>${j ? esc(j.number + ' · ' + j.title) : 'Other photos'}</h4><div class="sp-grid">${photos.filter((p) => p.jobId === jid).map((p) => `<label><input type="checkbox" value="${p.id}" ${spDraft.photos.some((x) => x.src === p.file) ? 'checked disabled' : ''}><img src="${esc(p.file)}" alt="${esc(p.caption)}" loading="lazy">${badge(p.type)}</label>`).join('')}</div>`; }).join('')}</div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Add photos</button></div></form>`;
  $('#spPick', mb).addEventListener('submit', (e) => {
    e.preventDefault(); const ids = $$('input:checked:not(:disabled)', e.target).map((c) => c.value);
    for (const id of ids) { if (spDraft.photos.length >= 10) { toast('Up to 10 photos per post', true); break; } const p = photos.find((x) => x.id === id); spDraft.photos.push({ src: p.file, label: p.caption || p.type }); }
    closeModal(); drawSpPhotos();
  });
};

/* ===== /project-gallery ===== */
let galJob = '';
PAGES['/project-gallery'] = {
  title: 'Project Gallery',
  async render(main) {
    const photos = await api('GET', '/api/photos'); D.photos = photos;
    const list = photos.filter((p) => !galJob || p.jobId === galJob).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    main.innerHTML = `<div class="head"><div><h1>Project Gallery</h1><p class="sub">Progress and completion photos for client jobs.</p></div><button class="btn" data-act="uploadPhotos">+ Upload photos</button></div>
<div class="card"><label style="max-width:360px">Filter by job<select id="galJob"><option value="">All jobs</option>${D.jobs.map((j) => `<option value="${j.id}" ${galJob === j.id ? 'selected' : ''}>${esc(j.number + ' · ' + j.title)}</option>`).join('')}</select></label>
${list.length ? `<div class="gallery">${list.map((p) => { const j = byId(D.jobs, p.jobId); return `<figure><img src="${esc(p.file)}" alt="${esc(p.caption)}" loading="lazy" data-act="viewPhoto" data-id="${p.id}"><figcaption>${badge(p.type)} <strong>${esc(j ? j.number + ' · ' + j.title : 'Job removed')}</strong><div class="muted">${esc(p.caption)}</div></figcaption></figure>`; }).join('')}</div>` : '<div class="empty">No photos yet. Upload progress or completion photos for a job.</div>'}</div>`;
    $('#galJob').addEventListener('change', (e) => { galJob = e.target.value; refresh(); });
  },
};
A.uploadPhotos = () => {
  if (!D.jobs.length) return toast('Create a job first', true);
  const mb = modal('Upload photos', `<form><label>Job<select name="jobId" required>${D.jobs.map((j) => `<option value="${j.id}" ${galJob === j.id ? 'selected' : ''}>${esc(j.number + ' · ' + j.title + ' (' + clientName(j.clientId) + ')')}</option>`).join('')}</select></label>
<div class="row"><label>Type<select name="type"><option>before</option><option selected>progress</option><option>after</option></select></label><label>Caption<input name="caption" placeholder="Optional"></label></div>
<label>Photos<input type="file" name="files" accept="image/*" multiple required></label><div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Upload</button></div></form>`);
  $('form', mb).addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = new FormData(e.target); const files = [...e.target.files.files]; const btn = $('button.btn:not(.alt)', mb); btn.disabled = true; btn.textContent = 'Uploading…';
    try { for (const f of files) await api('POST', '/api/photos', { jobId: fd.get('jobId'), type: fd.get('type'), caption: fd.get('caption'), dataUrl: await resizeImage(f, 1600) }); }
    catch (err) { btn.disabled = false; btn.textContent = 'Upload'; throw err; }
    closeModal(); toast(files.length + ' photo(s) uploaded'); refresh();
  });
};
A.viewPhoto = (d) => {
  const p = byId(D.photos, d.id); const j = byId(D.jobs, p.jobId);
  modal(j ? j.number + ' · ' + j.title : 'Photo', `<img src="${esc(p.file)}" style="width:100%;border-radius:8px"><p>${badge(p.type)} ${esc(p.caption)}</p><div class="foot"><button class="btn danger" data-act="delPhoto" data-id="${p.id}">Delete photo</button><button class="btn alt" data-act="closeModal">Close</button></div>`, true);
};
A.delPhoto = async (d) => { if (!confirm('Delete this photo?')) return; await api('DELETE', '/api/photos/' + d.id); closeModal(); refresh(); };

/* ===== /notifications ===== */
let notifFilter = { kind: '', channel: '' };
PAGES['/notifications'] = {
  title: 'Notifications Log',
  async render(main) {
    const all = await api('GET', '/api/notifications'); window.__notifs = all;
    const list = all.filter((n) => (!notifFilter.kind || n.kind === notifFilter.kind) && (!notifFilter.channel || n.channel === notifFilter.channel));
    const sel = (k, opts) => `<select data-nf="${k}" style="width:auto;margin:0"><option value="">All</option>${opts.map((o) => `<option ${notifFilter[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    main.innerHTML = `<div class="head"><div><h1>Notifications Log</h1><p class="sub">Every email and text message sent to clients for quotes, jobs and invoices.</p></div><div class="actions nf-filters" style="align-items:center;gap:20px"><label style="display:flex;align-items:center;gap:8px;margin:0">Type ${sel('kind', ['quote', 'job', 'invoice', 'review', 'automation'])}</label><label style="display:flex;align-items:center;gap:8px;margin:0">Channel ${sel('channel', ['email', 'sms'])}</label></div></div>
${phoneMq.matches ? `<div class="card nf-list">${list.map((n) => `<button type="button" class="ml-row" data-act="viewNotif" data-id="${n.id}"><span class="ml-main"><strong>${esc(n.clientName || n.to || 'Client')}</strong><span class="ml-meta">${n.channel === 'email' ? 'Email' : 'Text'}<i>·</i>${esc(n.kind)}${n.refNumber ? ` ${esc(n.refNumber)}` : ''}</span><span class="ml-meta">${new Date(n.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${n.to ? `<i>·</i>${esc(n.to)}` : ''}</span></span><span class="nf-st">${badge(n.status)}</span></button>`).join('') || '<p class="ml-empty muted">Nothing sent yet. Send a quote or invoice and it will appear here.</p>'}</div>` : `<div class="card"><div class="tablewrap"><table class="m-notif"><tr><th>Sent</th><th>Client</th><th>Channel</th><th>Type</th><th>Ref</th><th>Status</th></tr>${list.map((n) => `<tr class="crow" data-act="viewNotif" data-id="${n.id}" title="View message"><td>${new Date(n.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td><td>${esc(n.clientName)}<div class="muted">${esc(n.to || '')}</div></td><td>${n.channel === 'email' ? 'Email' : 'Text'}</td><td>${esc(n.kind)}</td><td>${esc(n.refNumber)}</td><td>${badge(n.status)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nothing sent yet. Send a quote or invoice and it will appear here.</td></tr>'}</table></div></div>`}`;
    $$('[data-nf]').forEach((s) => s.addEventListener('change', (e) => { notifFilter[e.target.dataset.nf] = e.target.value; refresh(); }));
  },
};
A.viewNotif = (d) => { const n = window.__notifs.find((x) => x.id === d.id); modal('Message to ' + n.clientName, `<p>${badge(n.status)} <span class="muted">${esc(n.detail)}</span></p>${n.subject ? `<p><strong>${esc(n.subject)}</strong></p>` : ''}<pre style="white-space:pre-wrap;font:inherit;background:var(--surface-2);padding:12px;border-radius:8px">${esc(n.body)}</pre>`); };

/* ===== /client-portal ===== */
PAGES['/client-portal'] = {
  title: 'Client Portal',
  async render(main) {
    const tok = new URLSearchParams(location.search).get('c');
    if (!tok) { history.replaceState({}, '', '/clients'); return render(); } // no staff page here: each client's portal link is on their record
    let p;
    try { p = await api('GET', '/api/portal/' + encodeURIComponent(tok)); } catch (e) { main.innerHTML = '<div class="cp-invalid"><h1>Link not valid</h1><p>This portal link is invalid or has expired. Please contact your service provider.</p></div>'; return; }
    if (p.company.accentColor) { document.documentElement.style.setProperty('--brand', p.company.accentColor); document.documentElement.dataset.accent = ''; }
    document.title = `${p.company.name || 'Client portal'} · Client hub`;
    renderPortal(main, tok, p);
  },
};
/* ===== client hub (layout modeled on Jobber's client hub): sidebar of sections, content on the right, always light ===== */
const CP_ICON = {
  requests: '<path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M4 13h4l1.5 2.5h5L16 13h4"/><path d="M12 4v7m-3-3 3 3 3-3"/>',
  estimates: '<circle cx="10" cy="10" r="5"/><path d="m14 14 6 6"/><path d="M8.5 10h3M10 8.5v3"/>',
  appointments: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4m8-4v4"/>',
  invoices: '<path d="M6 3h9l4 4v14H6z"/><path d="M14.5 10.5c-.4-.9-1.3-1.5-2.5-1.5-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4 0 1.1-1.1 1.9-2.5 1.9-1.2 0-2.1-.6-2.5-1.5M12 7.5V9m0 8v1.5"/>',
  wallet: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
  contact: '<path d="M5 4h3.5l1.5 4.5-2 1.5a12 12 0 0 0 6 6l1.5-2 4.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5A16.5 16.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z"/>',
  refer: '<path d="M7 11v9H4v-9zM7 11l4-7c1.4 0 2.3 1 2 2.4L12.5 10H18a2 2 0 0 1 2 2.3l-1.1 6A2 2 0 0 1 17 20H7"/>',
  reviews: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
};
const cpIcon = (k, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CP_ICON[k]}</svg>`;
const CP_NAV = [[['requests', 'Requests'], ['estimates', 'Estimates'], ['appointments', 'Appointments'], ['invoices', 'Invoices'], ['reviews', 'Reviews']], [['wallet', 'Wallet']], [['contact', 'Contact Us']]];
const CP_STATUS = { new: 'Received', sent: 'Awaiting your approval', approved: 'Approved', declined: 'Declined', converted: 'Approved', scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled', paid: 'Paid', overdue: 'Overdue', unpaid: 'Due', partial: 'Partly paid' };
const cpBadge = (s) => `<span class="cp-badge cp-${esc(s)}">${esc(CP_STATUS[s] || s)}</span>`;
const cpEmpty = (icon, title, text, action = '') => `<div class="cp-empty"><div class="cp-empty-ic">${cpIcon(icon, 24)}</div><h2>${title}</h2><p>${text}</p>${action}</div>`;
const rvMediaHtml = (media) => `<div class="rv-media">${media.map((m) => (m.type === 'video' ? `<video src="${esc(m.url)}" controls preload="metadata" playsinline></video>` : `<a href="${esc(m.url)}" target="_blank" rel="noopener"><img src="${esc(m.url)}" alt="Photo from the review"></a>`)).join('')}</div>`;
const TIME_LABEL = { any: 'Any time', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
function renderPortal(main, tok, p) {
  const today = ymd(new Date());
  const quotes = p.quotes.filter((q) => q.status !== 'draft');
  const invoices = p.invoices.filter((i) => i.status !== 'draft');
  const openInv = invoices.filter((i) => i.displayStatus !== 'paid');
  const upcoming = p.jobs.filter((j) => j.status === 'scheduled' && j.date >= today).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const past = p.jobs.filter((j) => !upcoming.includes(j));
  const co = p.company;
  // logged in to the business, New Request shows greyed out: only the client sends requests (the server refuses too)
  const reqOff = p.reviewsViewOnly ? ' disabled title="Only your client can send a request. You’re previewing as the business."' : '';
  const newReqBtn = `<button type="button" class="cp-btn" data-cp="new-request"${reqOff}>${cpIcon('plus', 18)} New Request</button>`;
  const row = (title, sub, right) => `<div class="cp-item"><div class="cp-item-main"><strong>${title}</strong>${sub.filter(Boolean).map((x) => `<div class="cp-sub">${x}</div>`).join('')}</div><div class="cp-item-side">${right}</div></div>`;
  const head = (title, action = '') => `<div class="cp-head"><h1>${title}</h1>${action}</div>`;
  // the review form opens on one finished job or invoice; its questions are the ones the business set for that module
  let reviewing = null;
  // logged in to the business, the review buttons show but are greyed out: only the client can write or change a review
  const rvOff = p.reviewsViewOnly ? ' disabled title="Only your client can write or edit reviews. You’re previewing as the business."' : '';
  const rvBtn = (id) => { const i = p.reviewable.findIndex((x) => x.refs.includes(id)); return i < 0 ? '' : `<button type="button" class="cp-btn primary" data-cp="write-review" data-rv="${i}"${rvOff}>Write a review</button>`; };
  const rvVal = (q) => ((reviewing.edit && reviewing.edit.answers) || []).find((a) => a.questionId === q.id)?.answer;
  const rvStars = (name, label, required, value) => `<div class="cp-rv-stars" role="radiogroup" aria-label="${esc(label)}">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="${name}_${n}" name="${name}" value="${n}" ${required ? 'required' : ''} ${Number(value) === n ? 'checked' : ''}><label for="${name}_${n}" title="${n} out of 5" aria-label="${n} out of 5 stars">★</label>`).join('')}</div>`;
  const rvField = (q) => { const name = 'q_' + q.id; const need = q.required ? 'required' : ''; const val = rvVal(q);
    return `<div class="cp-rv-q"><div class="cp-rv-l">${esc(q.text)}${q.required ? '' : ' <span class="cp-num">(optional)</span>'}</div>${q.type === 'stars' ? rvStars(name, q.text, q.required, val)
      : q.type === 'yesno' ? ['Yes', 'No'].map((v) => `<label class="cp-rv-yn"><input type="radio" name="${name}" value="${v}" ${need} ${val === v ? 'checked' : ''}> ${v}</label>`).join('') : `<textarea name="${name}" rows="3" maxlength="1000" ${need}>${esc(val ?? '')}</textarea>`}</div>`; };
  const RV_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm';
  // the review popup, like writing one on Google: stars, the business's questions, the review and its photos and videos
  const openReview = (item) => {
    reviewing = item; const edit = item.edit; let have = edit ? [...(edit.media || [])] : []; const gone = []; let added = [];
    closeModal();
    const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'overlay';
    ov.innerHTML = `<form class="modal cp-rv-modal" role="dialog" aria-modal="true" aria-label="${edit ? 'Edit your review' : 'Write a review'}"><h2>${esc(co.name)}</h2>
<p class="cp-sub">${esc(item.title || (item.kind === 'job' ? 'Your job' : 'Your invoice'))}${item.number ? ` (#${esc(item.number)})` : ''}. Your review goes to the business and isn’t posted publicly.</p>
<div class="cp-rv-top">${rvStars('stars', 'Your overall rating', true, edit && edit.stars)}</div>${(p.reviewQuestions[item.kind] || []).map(rvField).join('')}
<textarea name="comment" rows="4" maxlength="2000" aria-label="Your review" placeholder="Share details of your own experience with ${esc(co.name)}">${esc((edit && edit.comment) || '')}</textarea>
<div class="cp-rv-tiles"></div><label class="cp-rv-add">${cpIcon('camera', 18)} Add photos &amp; videos<input type="file" multiple accept="${RV_ACCEPT}" hidden></label>
<div class="cp-actions"><button type="button" class="cp-btn ghost" data-rv-cancel>Cancel</button><button class="cp-btn primary">${edit ? 'Save changes' : 'Send review'}</button></div></form>`;
    $('.cp', main).append(ov); const f = $('form', ov); const tiles = $('.cp-rv-tiles', f); const pick = $('input[type=file]', f);
    const tile = (src, video, rm) => { const d = document.createElement('div'); d.className = 'cp-rv-tile'; d.innerHTML = (video ? '<span>Video</span>' : `<img src="${esc(src)}" alt="">`) + '<button type="button" aria-label="Remove">×</button>'; $('button', d).onclick = rm; tiles.append(d); };
    const draw = () => { tiles.textContent = '';
      have.forEach((m) => tile(m.url, m.type === 'video', () => { gone.push(m.id); have = have.filter((x) => x !== m); draw(); }));
      added.forEach((x) => { const v = x.type.startsWith('video'); tile(v ? '' : URL.createObjectURL(x), v, () => { added = added.filter((y) => y !== x); draw(); }); }); };
    draw();
    pick.onchange = () => { for (const x of pick.files) { const v = x.type.startsWith('video'); if (have.length + added.length >= 10) { toast('Up to 10 photos and videos on a review', true); break; } if (x.size > (v ? 100e6 : 15e6)) { toast(`${x.name} is too large. Photos can be up to 15 MB and videos up to 100 MB.`, true); continue; } added.push(x); } pick.value = ''; draw(); };
    $('[data-rv-cancel]', f).onclick = closeModal;
    f.onsubmit = async (e) => {
      e.preventDefault(); const btn = $('.primary', f); const label = btn.textContent; btn.disabled = true; btn.textContent = 'Sending…';
      const fields = Object.fromEntries(new FormData(f)); const base = `/api/portal/${encodeURIComponent(tok)}/reviews`;
      let r;
      try { r = edit ? await api('PUT', `${base}/${encodeURIComponent(edit.id)}`, fields) : await api('POST', base, { ...fields, kind: item.kind, id: item.id }); }
      catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = label; return; }
      if (edit) p.reviews[p.reviews.indexOf(edit)] = r; else { p.reviews.unshift(r); p.reviewable = p.reviewable.filter((x) => x !== item); }
      const mediaUrl = `${base}/${encodeURIComponent(r.id)}/media`; let bad = 0; const keep = (x) => { p.reviews[p.reviews.findIndex((y) => y.id === x.id)] = x; };
      for (const id of gone) { try { keep(await api('DELETE', `${mediaUrl}/${encodeURIComponent(id)}`)); } catch (err) { bad++; } }
      for (let n = 0; n < added.length; n++) { btn.textContent = `Uploading ${n + 1} of ${added.length}…`;
        try { const u = await fetch(mediaUrl, { method: 'POST', headers: { 'Content-Type': added[n].type || 'application/octet-stream' }, body: added[n] }); const j = await u.json().catch(() => ({})); if (u.ok) keep(j); else { bad++; toast(j.error || 'A file didn’t upload', true); } } catch (err) { bad++; } }
      reviewing = null; closeModal(); toast(bad ? `Your review was saved, but ${bad} file${bad === 1 ? '' : 's'} didn’t upload. Choose Edit to try again.` : edit ? 'Your review was updated.' : 'Thank you! Your review was sent.', !!bad); show('reviews');
    };
    $('[name=stars]:checked', f) ? $('textarea[name=comment]', f).focus() : $('.cp-rv-top input:last-of-type', f).focus();
  };
  const rvMedia = (r) => ((r.media || []).length ? rvMediaHtml(r.media) : '');
  const views = {
    requests: () => (p.requests.length ? head('Requests', newReqBtn) + `<div class="cp-list">${p.requests.map((r) => row(esc(r.title), [`Sent ${fmtDate(r.createdAt.slice(0, 10))}`, r.preferredDate || r.preferredTime !== 'any' ? `Preferred: ${r.preferredDate ? fmtDate(r.preferredDate) : 'any day'}, ${TIME_LABEL[r.preferredTime].toLowerCase()}` : '', r.details ? esc(r.details) : ''], cpBadge(r.status))).join('')}</div>`
      : cpEmpty('requests', 'Get work done', 'Send us a request to fill us in on the details', newReqBtn)),
    'new-request': () => `${head('New request')}<form class="cp-form" id="cpReq">
<label class="fl"><span>What do you need done?*</span><input name="title" required maxlength="120" placeholder="e.g. Install 4 security cameras"></label>
<label class="fl"><span>Details</span><textarea name="details" rows="5" maxlength="4000" placeholder="Anything that helps us prepare: sizes, access, photos you can describe…"></textarea></label>
<label class="fl"><span>Service address</span><input name="address" maxlength="300" value="${esc(p.client.address || '')}"></label>
<div class="cp-row"><label class="fl"><span>Preferred date</span><input name="preferredDate" type="date" min="${today}"></label>
<label class="fl"><span>Preferred time</span><select name="preferredTime">${Object.entries(TIME_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label></div>
${p.client.smsConsent ? `<p class="cp-sub" style="margin:4px 0 12px">You get texts from us at ${esc(p.client.phone)}. Reply STOP to any text to stop them.</p>` : `<label class="fl"><span>Mobile phone (for texts)</span><input name="phone" type="tel" maxlength="40" autocomplete="tel" value="${esc(p.client.phone || '')}"></label>
<label style="display:flex;gap:10px;align-items:flex-start;margin:0 0 14px;font-size:14px;line-height:1.45"><input type="checkbox" name="smsConsent" value="1" style="width:auto;margin:3px 0 0;flex:none">
<span>Text me updates from ${esc(p.client.smsBrand || 'Worklio Pro')} about my request, quotes, invoices and appointments with ${esc(co.name)}. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help. Agreeing isn’t a condition of service. See the <a href="/terms#sms" target="_blank" rel="noopener">Terms</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>`}
<div class="cp-actions"><button type="button" class="cp-btn ghost" data-cp="requests">Cancel</button><button class="cp-btn primary">Send request</button></div></form>`,
    estimates: () => (quotes.length ? head('Estimates') + `<div class="cp-list">${quotes.map((q) => row(`${esc(q.title || 'Estimate')} <span class="cp-num">#${esc(q.number)}</span>`, [`Sent ${fmtDate((q.sentAt || q.createdAt).slice(0, 10))}`, `Total ${money(q.total)}`, q.depositFee > 0 ? (q.depositPaidAt ? `Deposit paid ${money(q.depositPaidAmount ?? q.depositFee)}` : `Deposit ${money(q.depositFee)}`) : ''], `${cpBadge(q.status)}<a class="cp-btn ${q.status === 'sent' ? 'primary' : ''}" href="${esc(q.link)}">${q.status === 'sent' ? 'Review' : 'View'}</a>`)).join('')}</div>`
      : cpEmpty('estimates', 'No estimates yet', 'When we send you an estimate, you can review and approve it here.')),
    appointments: () => (p.jobs.length ? head('Appointments') + (upcoming.length ? `<h3 class="cp-sec">Upcoming</h3><div class="cp-list">${upcoming.map((j) => row(esc(j.title), [`${fmtDate(j.date)} · ${fmtTime(j.startTime)} – ${fmtTime(j.endTime)}`, esc(j.address)], cpBadge('scheduled'))).join('')}</div>` : '')
      + (past.length ? `<h3 class="cp-sec">Past</h3><div class="cp-list">${past.map((j) => row(esc(j.title), [fmtDate(j.date), esc(j.address)], `${cpBadge(j.status)}${(j.forms || []).map((f) => `<button type="button" class="cp-btn" data-cp-form="${esc(j.id)}:${esc(f.id)}">${esc(f.name)}</button>`).join('')}${rvBtn(j.id)}`)).join('')}</div>` : '')
      : cpEmpty('appointments', 'No appointments', 'Your scheduled visits will show up here.')),
    invoices: () => (invoices.length ? head('Invoices') + (openInv.length ? `<div class="cp-due"><span>Balance due</span><strong>${money(openInv.reduce((s, i) => s + (i.balanceDue ?? i.total), 0))}</strong></div>` : '')
      + `<div class="cp-list">${[...openInv, ...invoices.filter((i) => i.displayStatus === 'paid')].map((i) => row(`${esc(i.subject || 'Invoice')} <span class="cp-num">#${esc(i.number)}</span>`, [i.displayStatus === 'paid' ? `Paid ${fmtDate((i.paidAt || i.issueDate).slice(0, 10))}` : `Due ${fmtDate(i.dueDate)}`, i.displayStatus === 'paid' ? money(i.total) : `${money(i.balanceDue ?? i.total)}${i.depositApplied > 0 ? ` after ${money(i.depositApplied)} deposit` : ''}`], `${cpBadge(i.displayStatus)}${i.displayStatus !== 'paid' && p.reviewsViewOnly ? '<button type="button" class="cp-btn primary" disabled title="Only your client can pay. You’re previewing as the business.">Pay now</button>' : `<a class="cp-btn ${i.displayStatus === 'paid' ? '' : 'primary'}" href="${esc(i.link)}">${i.displayStatus === 'paid' ? 'Receipt' : 'Pay now'}</a>`}${i.displayStatus === 'paid' ? rvBtn(i.id) : ''}`)).join('')}</div>`
      : cpEmpty('invoices', 'No invoices', 'Invoices we send you will show up here, ready to pay online.')),
    reviews: () => (p.reviews.length || p.reviewable.length ? head('Reviews') + (p.reviewsViewOnly ? '<p class="cp-note">You’re previewing as the business, so the review buttons are turned off. Your client can use them.</p>' : '') + (p.reviewable.length ? `<h3 class="cp-sec">Waiting for your review</h3><div class="cp-list">${p.reviewable.map((x, i) => row(`${esc(x.title || (x.kind === 'job' ? 'Job' : 'Invoice'))}${x.number ? ` <span class="cp-num">#${esc(x.number)}</span>` : ''}`, [x.kind === 'job' ? `Completed ${fmtDate(x.date)}` : `Paid ${fmtDate(x.date)}`], `<button type="button" class="cp-btn primary" data-cp="write-review" data-rv="${i}"${rvOff}>Write a review</button>`)).join('')}</div>` : '')
      + (p.reviews.length ? `<h3 class="cp-sec">Your reviews</h3><div class="cp-list">${p.reviews.map((r, i) => row(`${esc(r.title || (r.kind === 'job' ? 'Job' : 'Invoice'))}${r.refNumber ? ` <span class="cp-num">#${esc(r.refNumber)}</span>` : ''}`, [`Sent ${fmtDate(r.submittedAt.slice(0, 10))}${r.editedAt ? ` · Edited ${fmtDate(r.editedAt.slice(0, 10))}` : ''}`, ...r.answers.map((a) => `${esc(a.question)} ${a.type === 'stars' ? starRow(a.answer, 14) : esc(a.answer)}`), r.comment ? esc(r.comment) : '', rvMedia(r), r.reply ? `<b>Reply from ${esc(co.name)}:</b> ${esc(r.reply.comment)}` : ''], `${starRow(r.stars)}<button type="button" class="cp-btn" data-cp="write-review" data-rve="${i}"${rvOff}>Edit</button>`)).join('')}</div>` : '')
      : cpEmpty('reviews', 'No reviews yet', `When a job is completed or an invoice is paid, you can review it here.`)),
    wallet: () => cpEmpty('wallet', 'No saved payment methods', 'Pay any invoice by card, Zelle, Venmo, Cash App or PayPal when you open it. Card details are handled securely by Stripe and are never stored by us.'),
    contact: () => `${head('Contact us')}<div class="cp-card">${co.logo ? `<img src="${esc(co.logo)}" alt="" class="cp-card-logo">` : ''}<h2>${esc(co.name)}</h2>
${co.phone ? `<a class="cp-contact" href="tel:${esc(co.phone)}">${cpIcon('contact', 18)} ${esc(co.phone)}</a>` : ''}${co.email ? `<a class="cp-contact" href="mailto:${esc(co.email)}">✉ ${esc(co.email)}</a>` : ''}
${co.address ? `<div class="cp-contact cp-addr">${esc(co.address)}</div>` : ''}${co.website ? `<a class="cp-contact" href="${esc(/^https?:/.test(co.website) ? co.website : 'https://' + co.website)}" target="_blank" rel="noopener">${esc(co.website)}</a>` : ''}
${co.hours ? `<h3 class="cp-sec">Business hours</h3><table class="cp-hours">${WEEK.map(([k, l]) => `<tr><td>${l}</td><td>${co.hours[k] && co.hours[k].on ? `${fmtTime(co.hours[k].start)} – ${fmtTime(co.hours[k].end)}` : 'Closed'}</td></tr>`).join('')}</table>` : ''}</div>`,
    // referral: their public referral link (never the private portal link) with copy / email / Outlook / Gmail options
    refer: () => { const link = p.referralLink; const subject = `Check out ${co.name}`; const body = `I recommend ${co.name}. You can request service here:\n${link}`;
      const q = (o) => Object.entries(o).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
      return `<div class="cp-refer-card"><h1>Share Your Referral Link</h1><p>Help us serve our community by recommending us to your friends and family!</p><p class="cp-refer-lead">Copy or share our link below:</p>
<div class="cp-copy"><label class="fl"><span>Referral link</span><input id="cpRefLink" readonly value="${esc(link)}" onclick="this.select()"></label><button type="button" class="cp-out" data-cp-copy><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2"/></svg><span>Copy Link</span></button></div>
<a class="cp-out wide" href="mailto:?${q({ subject, body })}">Email</a>
<a class="cp-out wide" href="https://outlook.live.com/mail/0/deeplink/compose?${q({ subject, body })}" target="_blank" rel="noopener">Outlook</a>
<a class="cp-out wide" href="https://mail.google.com/mail/?${q({ view: 'cm', fs: '1', su: subject, body })}" target="_blank" rel="noopener">Gmail</a></div>`; },
  };
  const nav = (cur) => `<button type="button" class="cp-newreq" data-cp="new-request"${reqOff}>${cpIcon('plus', 18)} New Request</button>` + CP_NAV.map((grp) => grp.filter(([k]) => k !== 'reviews' || p.reviews).map(([k, l]) => `<button type="button" class="cp-nav ${cur === k || (cur === 'new-request' && k === 'requests') ? 'on' : ''}" data-cp="${k}">${cpIcon(k)}<span>${l}</span></button>`).join('')).join('<hr>')
    + (p.referralLink ? `<hr><button type="button" class="cp-nav cp-refer ${cur === 'refer' ? 'on' : ''}" data-cp="refer">${cpIcon('refer')}<span>Refer a Friend</span></button>` : '');
  const show = (section) => {
    if (!views[section] || (section === 'new-request' && p.reviewsViewOnly) || (section === 'refer' && !p.referralLink) || (section === 'reviews' && !p.reviews)) section = 'requests';
    $('.cp-navs', main).innerHTML = nav(section); $('.cp-main', main).innerHTML = views[section]();
    if (location.hash.slice(1) !== section) history.replaceState({}, '', location.pathname + location.search + '#' + section);
    const f = $('#cpReq', main);
    if (f) f.addEventListener('submit', async (e) => {
      e.preventDefault(); const btn = $('.primary', f); btn.disabled = true; btn.textContent = 'Sending…';
      try { const r = await api('POST', `/api/portal/${encodeURIComponent(tok)}/requests`, Object.fromEntries(new FormData(f))); p.requests.unshift(r); p.client.smsConsent = r.smsConsent; p.client.phone = r.phone; toast('Request sent. We’ll be in touch soon.'); show('requests'); }
      catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = 'Send request'; }
    });
    setMenu(false);
    main.scrollTop = 0; window.scrollTo(0, 0);
  };
  main.innerHTML = `<div class="cp"><aside class="cp-side"><div class="cp-brand">${co.logo ? `<img src="${esc(co.logo)}" alt="${esc(co.name)}">` : `<div class="cp-mono">${esc(initials(co.name || '?'))}</div>`}</div>
<div class="cp-co">${esc(co.name)}</div><button type="button" class="cp-burger" aria-label="Open menu" aria-expanded="false" aria-controls="cpNavs">${cpIcon('menu', 26)}</button><nav class="cp-navs" id="cpNavs" aria-label="Client hub"></nav></aside><section class="cp-main" aria-live="polite"></section></div>`;
  // phones: the menu folds away behind a hamburger button
  function setMenu(open) {
    const side = $('.cp-side', main); const btn = $('.cp-burger', main); if (!side || !btn) return;
    side.classList.toggle('open', open); btn.setAttribute('aria-expanded', open); btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); btn.innerHTML = cpIcon(open ? 'close' : 'menu', 26);
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('.cp-side.open', main)) { setMenu(false); $('.cp-burger', main).focus(); } });
  main.onclick = async (e) => {
    if (e.target.closest('.cp-burger')) return setMenu(!$('.cp-side.open', main));
    if ($('.cp-side.open', main) && !e.target.closest('.cp-navs')) setMenu(false);
    const fb = e.target.closest('[data-cp-form]'); if (fb) { const [jid, fid] = fb.dataset.cpForm.split(':'); const j = p.jobs.find((x) => x.id === jid); const f = j && j.forms.find((x) => x.id === fid); if (f) modal(f.name, `<div class="jf-fill jf-done">${f.description ? `<p class="muted jf-desc">${esc(f.description)}</p>` : ''}<div class="jf-fin">Finished ${esc(fmtDate(f.completedAt.slice(0, 10)))} · ${esc(j.title)}</div><div class="jf-items">${f.fields.map((x) => jfField(x, f.answers[x.id], true)).join('')}</div><div class="jf-foot"><a class="cp-btn" href="/api/portal/${encodeURIComponent(tok)}/forms/${esc(f.id)}/pdf" target="_blank" rel="noopener">Download PDF</a></div></div>`, true); return; } // a finished checklist the business shares
    const b = e.target.closest('[data-cp]'); if (b) { e.preventDefault(); if (b.dataset.rv) return openReview(p.reviewable[Number(b.dataset.rv)]); if (b.dataset.rve) { const r = p.reviews[Number(b.dataset.rve)]; return openReview({ kind: r.kind, title: r.title, number: r.refNumber, edit: r }); } show(b.dataset.cp); return; }
    const cp = e.target.closest('[data-cp-copy]');
    if (cp) {
      const i = $('#cpRefLink', main); try { await navigator.clipboard.writeText(i.value); } catch (err) { i.select(); document.execCommand('copy'); }
      $('span', cp).textContent = 'Copied!'; setTimeout(() => { if (cp.isConnected) $('span', cp).textContent = 'Copy Link'; }, 2000);
    }
  };
  show(location.hash.slice(1));
}

/* ===== /settings and /settings/company ===== */
const COUNTRIES = ['United States', 'Canada', 'Mexico', 'United Kingdom', 'Ireland', 'Australia', 'New Zealand'];
const fl = (label, input) => `<label class="fl"><span>${label}</span>${input}</label>`;
const flSelect = (label, name, opts, cur) => fl(label, `<select name="${name}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`);
const tzOffset = (tz) => { try { return new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName').value.replace(/^GMT$/, 'GMT+00:00'); } catch (e) { return ''; } };
// Company Profile: company details (contact, address, business hours), tax settings and regional settings
// social media pages (Company Profile); the server turns a handle into the page's link
const SOCIAL = [['facebook', 'Facebook', 'facebook.com/yourbusiness'], ['instagram', 'Instagram', '@yourbusiness'], ['tiktok', 'TikTok', '@yourbusiness'], ['x', 'X (Twitter)', '@yourbusiness'],
  ['youtube', 'YouTube', '@yourbusiness'], ['linkedin', 'LinkedIn', 'linkedin.com/company/yourbusiness'], ['google', 'Google Business Profile', 'Link to your Google business page or reviews'], ['yelp', 'Yelp', 'yelp.com/biz/yourbusiness'], ['nextdoor', 'Nextdoor', 'nextdoor.com/pages/yourbusiness']];
// App Settings → General → Regional settings: time zone, date and time formats, first day of the week
function regionalBox(c) {
  const tz = c.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = Intl.supportedValuesOf('timeZone').map((z) => [z, `(${tzOffset(z)}) ${z}`]);
  const sample = ymd(new Date()); const fmtWith = (f) => { const saved = company.dateFormat; company.dateFormat = f; const out = fmtDate(sample); company.dateFormat = saved; return out; };
  return `<div class="card cs"><h2>Regional settings</h2>
${flSelect('Timezone', 'timezone', zones, tz)}
${flSelect('Date format', 'dateFormat', ['MMM D, YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].map((f) => [f, fmtWith(f)]), c.dateFormat || 'MMM D, YYYY')}
${flSelect('Time format', 'timeFormat', [['12', '12 Hour (1:30 PM)'], ['24', '24 Hour (13:30)']], c.timeFormat || '12')}
${flSelect('First day of the week', 'weekStart', [['sun', 'Sunday'], ['mon', 'Monday']], c.weekStart || 'mon')}</div>`.replace(/<select name=/g, '<select form="cf" name=');
}
// the kind of business (asked at sign-up; the choices come with the account info)
function industryHtml(c) {
  const L = (c.account && c.account.industries) || []; if (!L.length) return '';
  return `<div class="fl-split">${flSelect('Industry', 'industry', [['', 'Choose your industry'], ...L.map((i) => [i.slug, i.name])], c.industry || '')}
${fl('Your industry', `<input name="industryOther" maxlength="80" value="${esc(c.industryOther || '')}">`).replace('<label class="fl"', `<label class="fl" data-other ${c.industry === 'other' ? '' : 'hidden'}`)}</div>`;
}
const businessHours = (c) => staffHours({ hours: c.hours || { sat: { on: false, start: '09:00', end: '17:00' }, sun: { on: false, start: '09:00', end: '17:00' } } });
function companySettingsHtml(c, logoBox = '') {
  const hasParts = ['addrStreet1', 'addrStreet2', 'addrCity', 'addrState', 'addrZip'].some((k) => c[k]);
  const v = (k) => esc(c[k] ?? '');
  const country = c.addrCountry || 'United States';
  return `<div class="cs-cols"><div class="cs-col"><div class="card cs"><h2>Company details</h2>
${fl('Company name', `<input name="name" required value="${v('name')}">`)}${fl('Phone number', `<input name="phone" type="tel" value="${v('phone')}">`)}
${fl('Website URL', `<input name="website" value="${v('website')}">`)}${fl('Email address', `<input name="email" type="email" value="${v('email')}">`)}
${industryHtml(c)}
<div class="fl-group">${fl('Street 1', `<input name="addrStreet1" value="${hasParts ? v('addrStreet1') : esc(c.address || '')}">`)}${fl('Street 2', `<input name="addrStreet2" value="${v('addrStreet2')}">`)}
<div class="fl-split">${fl('City', `<input name="addrCity" value="${v('addrCity')}">`)}${fl('State', `<input name="addrState" value="${v('addrState')}">`)}</div>
<div class="fl-split">${fl('Zip code', `<input name="addrZip" value="${v('addrZip')}">`)}${flSelect('Country', 'addrCountry', [...new Set([...COUNTRIES, country])].map((x) => [x, x]), country)}</div></div>
${switchRow('addressPrivate', 'Keep address private', c.addressPrivate, 'We won’t show your address to clients in the client portal.')}
<hr class="cs-hr"><div data-hours-root><div class="cs-hours-h"><h3>Business hours</h3>${hoursPencil('business hours')}</div><p class="muted cs-note">Your usual opening times.</p>
${autoHoursHtml(businessHours(c), 'Closed')}${hoursFoot}</div>
${switchRow('showHours', 'Show business hours', c.showHours, 'Display your business hours on the client portal.')}</div>
</div><div class="cs-col">${logoBox}<div class="card cs"><h2>Social media</h2><p class="muted cs-note">Paste a link to your page, or just your handle (like @yourbusiness). Leave any you don’t use blank.</p>
<div class="cs-soc">${SOCIAL.map(([k, l, ph]) => fl(l, `<input name="social_${k}" value="${esc((c.social || {})[k] || '')}" placeholder="${ph}" autocomplete="off" autocapitalize="off" spellcheck="false">`)).join('')}</div></div>

<div class="card cs"><h2>Tax settings</h2>
<div class="row">${fl('Tax ID name (ex: GST)', `<input name="taxIdName" value="${v('taxIdName')}">`)}${fl('Tax ID number', `<input name="taxIdNumber" value="${v('taxIdNumber')}">`)}</div>
<p class="muted cs-note">Tax ID name and number will appear on invoices.</p>
<h3>Default tax rate</h3>
<div class="tax-rate">${fl('Tax name', `<input name="taxName" value="${v('taxName')}" placeholder="e.g. TX Sales Tax">`)}${fl('Tax rate (%)', `<input name="taxRate" type="number" step="any" min="0" value="${c.taxRate ?? 0}">`)}${fl('Internal tax description', `<input name="taxDescription" value="${v('taxDescription')}">`)}</div>
<p class="muted cs-note">Used on new quotes, jobs and invoices. The tax name shows on documents that use this rate.</p></div></div></div>`;
}
// App Settings → Payments → Late fees (company.lateFee): its own little form, saved as soon as something changes. The server adds the fee hourly.
function lateFeeCard(c) {
  const lf = c.lateFee || {}; const opt = (v, l, cur) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`;
  return `<div class="card" id="late-fees"><h2>Late fees</h2><p class="muted" style="margin-top:0">Add a fee to invoices still unpaid after their due date. It goes on the invoice as a “Late fee” line (never discounted or taxed), and the client’s invoice page says when it will be added. Only invoices due after you turn this on get one. Switch it off on any invoice under Client payments, or delete the line to waive a fee.</p>
<form id="lff">${switchRow('on', 'Charge late fees', !!lf.on)}
<div class="lf-fields"${lf.on ? '' : ' hidden'}><div class="row"><label>Fee<div class="lf-amt"><input name="amount" type="number" min="0" step="any" inputmode="decimal" value="${lf.amount || ''}" placeholder="e.g. 25"><select name="type" aria-label="Fee type">${opt('flat', '$ flat fee', lf.type || 'flat')}${opt('percent', '% of the balance', lf.type)}</select></div></label>
<label>Added<select name="days">${[0, 3, 5, 7, 10, 14, 30].map((n) => opt(n, n ? `${n} days after the due date` : 'The day after the due date', lf.days || 0)).join('')}</select></label></div>
<label>How often<select name="times">${[1, 2, 3, 6, 12].map((n) => opt(n, n === 1 ? 'Once' : `Again every 30 days while unpaid, up to ${n} times`, lf.times || 1)).join('')}</select></label>
${switchRow('email', 'Email the client when a fee is added', lf.email !== false, 'Uses the “Late fee added” template in Email Templates')}</div></form></div>`;
}
function wireLateFees() {
  const f = $('#lff'); if (!f) return;
  f.addEventListener('submit', (e) => e.preventDefault());
  f.addEventListener('change', async () => {
    const fd = new FormData(f); const b = { on: fd.getAll('on').includes('on'), type: fd.get('type'), amount: fd.get('amount'), days: fd.get('days'), times: fd.get('times'), email: fd.getAll('email').includes('on') };
    $('.lf-fields', f).hidden = !b.on;
    if (b.on && !(Number(b.amount) > 0)) return $('[name=amount]', f).focus(); // waits for the amount
    try { const saved = await api('PUT', '/api/company', { lateFee: b }); company = { ...company, ...saved }; toast(b.on ? 'Late fees saved' : 'Late fees are off'); } catch (err) { toast(err.message, true); }
  });
}
// App Settings → General → Saved discounts: the list, and Edit (the dialog in app.js, also opened from a document's discount menu)
const savedDiscCard = () => `<div class="card" id="saved-discounts"><h2>Saved discounts</h2><p class="muted" style="margin-top:0">Discounts you give often, each with a name. Pick one on a quote, job or invoice instead of typing it; its name shows to your client.</p>
${savedDiscs().length ? `<div class="sd-view">${savedDiscs().map((x) => `<div><span>${esc(x.name)}</span><span class="muted">${discAmt(x)}</span></div>`).join('')}</div>` : '<p class="muted">None yet.</p>'}
<button type="button" class="btn alt sm" data-act="sdEdit">${savedDiscs().length ? 'Edit saved discounts' : '+ Add a discount'}</button></div>`;
A.sdEdit = () => savedDiscountsDialog(() => refresh());
// App Settings → General → Matrix line items: turns on "+ Add matrix item" (sizes × colors grid) beside "+ Add line item"; saves as you change it
// Matrix pricing is a paid add-on (company.account.matrixAddon: state 'off' | 'on' | 'ending' | 'included', its price); only the owner adds or removes it
const mxAddon = () => (company.account && company.account.matrixAddon) || null;
const mxPrice = (x) => `${money(x.cents / 100).replace(/\.00$/, '')}/${x.interval}`;
const mxIntro = '<p class="muted" style="margin-top:0">For items sold in sizes and colors, like custom t-shirts. Adds <strong>+ Add matrix item</strong> beside <strong>+ Add line item</strong> on quotes, jobs and invoices: a grid with a cost for each size, your markup, and how many of each size and color. Regular line items stay as they are.</p>';
const mxOwner = () => !!(me && me.role === 'owner');
const mxCard = () => {
  const x = mxAddon();
  if (!mxAllowed()) return x && x.cents ? mxOffer(x) : '';
  const m = company.matrixItems || {};
  const foot = !x || x.state === 'included' ? '' : x.state === 'ending' ? `<p class="muted sm" style="margin:12px 0 0">Add-on removed: matrix pricing stays on until ${fmtDate(x.endsAt)}.${mxOwner() ? ' <button type="button" class="link-btn" data-act="mxBuy">Keep it</button>' : ''}</p>`
    : `<p class="muted sm" style="margin:12px 0 0">Matrix pricing add-on, ${mxPrice(x)}.${mxOwner() ? ' <button type="button" class="link-btn" data-act="mxRemove">Remove add-on</button>' : ''}</p>`;
  return `<div class="card" id="matrix-items"><h2>Matrix line items</h2>${mxIntro}
<form id="mxf">${switchRow('on', 'Matrix line items', !!m.on)}<div class="mx-fields"${m.on ? '' : ' hidden'}>
<label>Sizes to start with<input name="sizes" value="${esc((m.sizes && m.sizes.length ? m.sizes : MX_SIZES).join(', '))}" placeholder="S, M, L, XL, 2XL"></label>
<label>Colors to start with<input name="colors" value="${esc((m.colors || []).join(', '))}" placeholder="Optional, e.g. Black, White, Navy"></label>
<p class="muted sm">Separate them with commas. You can change them on each item.</p></div></form>${foot}</div>`; };
// the offer, before the add-on: what it does (a sample grid), the price, Add matrix pricing, and How it works (opens below)
const MX_DEMO = { sizes: ['S', 'M', 'L', 'XL'], price: [12, 12, 12, 14], rows: [['Black', [10, 12, 8, 4]], ['White', [6, 8, 6, 2]]] };
function mxOffer(x) {
  const d = MX_DEMO; const n = d.rows.reduce((s, [, q]) => s + q.reduce((a, b) => a + b, 0), 0);
  const total = d.rows.reduce((s, [, q]) => s + q.reduce((a, b, i) => a + b * d.price[i], 0), 0);
  const trial = !!(company.account && company.account.expiry && company.account.expiry.trial);
  const amt = money(x.cents / 100).replace(/\.00$/, '');
  return `<div class="card mx-offer" id="matrix-items">
<div class="mx-offer-top"><div class="mx-offer-copy"><span class="mx-badge">Add-on</span><h2>Price by size and color</h2>
<p>Selling shirts, hats or uniforms? Build the whole order in one grid: a cost for each size, your markup, and how many of each color. Totals add up as you type.</p></div>
<div class="mx-demo" aria-hidden="true"><table><thead><tr><th></th>${d.sizes.map((s) => `<th>${s}</th>`).join('')}</tr></thead><tbody>
<tr class="mx-demo-pr"><th>Price</th>${d.price.map((p) => `<td>$${p}</td>`).join('')}</tr>
${d.rows.map(([c, q]) => `<tr><th>${c}</th>${q.map((v) => `<td><span>${v}</span></td>`).join('')}</tr>`).join('')}</tbody></table>
<div class="mx-demo-tot"><span>${n} pieces</span><b>${money(total).replace(/\.00$/, '')}</b></div></div></div>
<ul class="mx-perks"><li>One line on the quote instead of a dozen</li><li>Your markup on every size, automatically</li><li>Each size and color listed on the client’s quote, invoice and PDF</li></ul>
<div class="mx-buy"><div class="mx-price"><b>${amt}</b><span>/${x.interval}</span><small>${trial ? 'Free during your trial · ' : ''}Remove anytime</small></div>
<div class="mx-buy-act">${mxOwner() ? '<button type="button" class="btn" data-act="mxBuy">Add matrix pricing</button>' : '<span class="muted sm">Ask your account owner to add it.</span>'}
<button type="button" class="link-btn" data-act="mxHow" aria-expanded="false">How it works</button></div></div>
<div class="mx-how" hidden><ol>
<li><strong>Add it</strong> here. ${trial ? 'It’s free until your trial ends, then' : 'It’s'} ${amt}/${x.interval} on your subscription${trial ? '' : '; the part of this billing period that’s left goes on your next bill'}.</li>
<li><strong>Set your sizes and colors</strong> on this card (like S–2XL, Black, White). You can change them on any item.</li>
<li><strong>Click + Add matrix item</strong> on a quote, job or invoice. Enter each size’s cost and your markup (% or $ per piece), then the quantities.</li></ol>
<p class="muted sm">Your regular line items don’t change. If you remove the add-on, it stays on until the end of the period you’ve paid for, and quotes and invoices that already have a grid keep it.</p></div></div>`;
}
// Products & services: a banner for the add-on (owners and admins, until it's added or they close it; closing is remembered in this browser)
const MX_PROMO_KEY = 'mxPromoHidden';
const mxPromoHidden = () => { try { return localStorage.getItem(MX_PROMO_KEY) === '1'; } catch (e) { return false; } };
const mxPromo = () => {
  const x = mxAddon(); if (mxAllowed() || !x || !x.cents || !isAdminMe() || mxPromoHidden()) return '';
  const trial = !!(company.account && company.account.expiry && company.account.expiry.trial);
  return `<div class="mx-promo"><div class="mx-promo-ic" aria-hidden="true">${['S', 'M', 'L', '10', '12', '8', '6', '8', '6'].map((v, i) => `<i${i < 3 ? ' class="h"' : ''}>${v}</i>`).join('')}</div>
<div class="mx-promo-txt"><strong>Sell shirts, hats or uniforms? Price the whole order by size and color.</strong><span>One grid instead of a dozen lines: a cost per size, your markup, and quantities for each color. ${money(x.cents / 100).replace(/\.00$/, '')}/${x.interval}${trial ? ', free during your trial' : ''}.</span></div>
<button type="button" class="btn sm" data-act="mxSee">See matrix pricing</button><button type="button" class="icon-btn mx-promo-x" data-act="mxPromoHide" aria-label="Hide this">✕</button></div>`;
};
A.mxPromoHide = () => { try { localStorage.setItem(MX_PROMO_KEY, '1'); } catch (e) { /* stays hidden until the page reloads */ } const p = $('.mx-promo'); if (p) p.remove(); };
// open App Settings → General at the Matrix line items card, and point it out
A.mxSee = async () => { await navigate('/settings'); const c = $('#matrix-items'); if (!c) return; c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c.classList.remove('mx-flash'); void c.offsetWidth; c.classList.add('mx-flash'); };
A.mxHow = (_, b) => { const h = $('#matrix-items .mx-how'); if (!h) return; h.hidden = !h.hidden; if (b) { b.setAttribute('aria-expanded', String(!h.hidden)); b.textContent = h.hidden ? 'How it works' : 'Hide details'; } };
async function mxAddonSet(on) {
  try { const r = await api('POST', '/api/account/addons/matrix', { on }); company.account = { ...company.account, ...r.account }; toast(r.message); refresh(); }
  catch (e) { toast(e.message, true); }
}
A.mxBuy = () => { const x = mxAddon(); if (!x) return; if (x.state === 'ending' || confirm(`Add matrix pricing for ${mxPrice(x)}?\n\nIt’s added to your subscription; the part of this billing period that’s left is on your next bill (free during a free trial). You can remove it anytime.`)) mxAddonSet(true); };
A.mxRemove = () => { if (confirm('Remove the matrix pricing add-on?\n\nIt stays on until the end of the period you’ve paid for, and you won’t be charged for it again. Quotes, jobs and invoices that already have a grid keep it.')) mxAddonSet(false); };
function wireMx() {
  const f = $('#mxf'); if (!f) return;
  f.addEventListener('submit', (e) => e.preventDefault());
  f.addEventListener('change', async () => {
    const fd = new FormData(f); const b = { on: fd.getAll('on').includes('on'), sizes: mxList(fd.get('sizes')), colors: mxList(fd.get('colors')) };
    $('.mx-fields', f).hidden = !b.on;
    try { const saved = await api('PUT', '/api/company', { matrixItems: b }); company = { ...company, ...saved }; toast(b.on ? 'Matrix line items saved' : 'Matrix line items are off'); } catch (err) { toast(err.message, true); }
  });
}
// App Settings tabs; the hash keeps the tab (links to #payments, #zelle, #pay-apps or #late-fees open Payments). Every card stays in the page so form="cf" fields still save.
const AS_TABS = [['general', 'General'], ['white-label', 'White Label'], ['payments', 'Payments']];
function wireAsTabs(main) {
  const tabOf = (h) => (h === 'saved-discounts' ? 'general' : ['zelle', 'pay-apps', 'late-fees'].includes(h) ? 'payments' : AS_TABS.some(([t]) => t === h) ? h : 'general');
  const show = (t, keep) => {
    $$('[data-as-tab]', main).forEach((b) => { const on = b.dataset.asTab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    $$('.as-panel', main).forEach((p) => { p.hidden = p.id !== 'as-' + t; });
    if (!keep) history.replaceState(history.state, '', location.pathname + location.search + (t === 'general' ? '' : '#' + t));
  };
  $$('[data-as-tab]', main).forEach((b) => b.addEventListener('click', () => show(b.dataset.asTab)));
  show(tabOf(location.hash.slice(1)), true);
}
async function companyPage(main, full) {
  const c = company; const integ = full ? await api('GET', '/api/integrations') : null;
  // App Settings boxes; on App Settings they sit in two columns outside the form, so their fields say form="cf"
  const logoBox = planHas('branding') ? `<div class="card${full ? '' : ' cs'}"><h2>Logo</h2><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div id="logoPrev" style="width:120px;height:70px;border:1px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden">${c.logo ? `<img src="${esc(c.logo)}" style="max-width:100%;max-height:100%">` : '<span class="muted">No logo</span>'}</div><div class="logo-side"><div class="logo-acts"><input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" style="width:auto">${c.logo ? '<button type="button" class="btn danger sm" data-act="removeLogo">Delete logo</button>' : ''}</div><div class="muted">Appears on quotes, invoices and the client portal.</div></div></div></div>` : '';
  const brandBox = full && planHas('branding') ? `<div class="card"><h2>Branding</h2><div class="row"><label>Brand color<input form="cf" name="brandColor" type="color" value="${esc(c.brandColor || '#2563eb')}"><span class="muted">Used on quotes, invoices and emails to clients.</span></label><label>Accent color<input form="cf" name="accentColor" type="color" value="${esc(c.accentColor || c.defaultAccent)}"><span class="muted">Used on your client portal.${c.accentColor ? ' <button type="button" class="linkbtn" data-act="resetAccent">Reset</button>' : ''}</span></label></div></div>` : '';
  const defaultsBox = full ? `<div class="card"><h2>Defaults</h2><label>Invoice footer message<input form="cf" name="invoiceFooter" value="${esc(c.invoiceFooter)}"></label></div>` : '';
  const prefixBox = full ? planHas('numberPrefixes') ? `<div class="card"><h2>Number prefixes</h2><p class="muted" style="margin-top:0">The label in front of each quote, job and invoice number. Changes apply to new ones only; existing numbers stay as they are.</p>
<div class="row3 prefix-row">${[['quotePrefix', 'Quotes', 1005], ['jobPrefix', 'Jobs', 2010], ['invoicePrefix', 'Invoices', 3010]].map(([k, l, n]) => `<label>${l}<input form="cf" name="${k}" maxlength="10" value="${esc(docPrefix(k))}" data-sample="${n}"><span class="muted prefix-eg">e.g. ${esc(docPrefix(k))}${n}</span></label>`).join('')}</div></div>` : '' : '';
  const zelleBox = full && planHas('zelle') ? `<div class="card" id="zelle"><h2>Zelle payments</h2><p class="muted" style="margin-top:0">Shown to clients on the invoice pay page and the quote deposit step. Leave blank to hide Zelle. Zelle payments can’t be confirmed automatically: when a client reports one, check your bank, then use Collect Payment.</p>
<div class="row"><label>Zelle email or phone<input form="cf" name="zelleRecipient" value="${esc(c.zelleRecipient || '')}" placeholder="payments@yourbusiness.com or +17135550100"></label><label>Name registered with Zelle<input form="cf" name="zelleName" value="${esc(c.zelleName || '')}" placeholder="e.g. TLB Group LLC"></label></div></div>` : '';
  const appsBox = full && planHas('zelle') ? `<div class="card" id="pay-apps"><h2>Venmo, Cash App and PayPal</h2><p class="muted" style="margin-top:0">Clients get a button that opens the app with the amount filled in, on the invoice pay page and the quote deposit step. Leave one blank to hide it. Use a business profile: Venmo and Cash App don’t allow business payments to personal accounts. These payments can’t be confirmed automatically: when a client reports one, check the app, then use Collect Payment.</p>
<div class="row3"><label>Venmo username<input form="cf" name="venmoHandle" value="${esc(c.venmoHandle ? '@' + c.venmoHandle : '')}" placeholder="@YourBusiness" autocomplete="off"></label><label>Cash App $Cashtag<input form="cf" name="cashappTag" value="${esc(c.cashappTag ? '$' + c.cashappTag : '')}" placeholder="$YourBusiness" autocomplete="off"></label><label>PayPal.me name<input form="cf" name="paypalHandle" value="${esc(c.paypalHandle ? 'paypal.me/' + c.paypalHandle : '')}" placeholder="paypal.me/YourBusiness" autocomplete="off"></label></div></div>` : '';
  main.innerHTML = `<div class="head"><div><h1>${full ? 'App Settings' : 'Company settings'}</h1>${full ? '<p class="sub">Defaults, white label and payments for every quote and invoice. Business details, social media and tax settings are on <a href="/settings/company" data-link>Company Profile</a>.</p>' : ''}</div></div>
${full ? `<div class="as-tabs" role="tablist">${AS_TABS.map(([t, n]) => `<button type="button" role="tab" data-as-tab="${t}" aria-controls="as-${t}">${n}</button>`).join('')}</div>
<div class="as-panel" id="as-general" role="tabpanel">${planCard(c.account)}<div class="as-cols"><div class="as-col">${regionalBox(c)}${mxCard()}</div><div class="as-col">${defaultsBox}${savedDiscCard()}${prefixBox}</div></div></div>
<div class="as-panel" id="as-white-label" role="tabpanel"><div class="as-cols"><div class="as-col">${webAddressCard(c.account)}</div><div class="as-col">${brandBox || `<div class="card"><h2>Branding</h2><p class="muted" style="margin:0">Your own brand and accent colors on quotes, invoices, emails and the client portal come with a plan that includes Branding.</p></div>`}</div></div></div>
<div class="as-panel" id="as-payments" role="tabpanel"><div class="as-cols"><div class="as-col">${payCard(integ)}${zelleBox}</div><div class="as-col">${appsBox}${lateFeeCard(c)}</div></div></div>
<form id="cf"></form>` :`<form id="cf" class="cs-form">${companySettingsHtml(c, logoBox)}</form>`}`;
  if (full) { wireLateFees(); wireMx(); wireAsTabs(main); }
  $$('.prefix-row input').forEach((i) => i.addEventListener('input', () => { i.nextElementSibling.textContent = 'e.g. ' + i.value.trim() + i.dataset.sample; }));
  const ind = $('#cf select[name=industry]', main); if (ind) ind.addEventListener('change', () => { $('#cf [data-other]', main).hidden = ind.value !== 'other'; });
  if (!full) { // Company Profile saves on its own: a field as soon as it changes, the business hours with their pencil
    const cf = $('#cf'); const key = () => JSON.stringify(Object.fromEntries(new FormData(cf)));
    let last = key(); let busy = false; let again = false;
    const saveFields = async () => {
      if (busy) { again = true; return; }
      if (key() === last) return;
      if (!cf.checkValidity()) return cf.reportValidity();
      const b = Object.fromEntries(new FormData(cf));
      if (b.industry === 'other' && !String(b.industryOther || '').trim()) { $('[name=industryOther]', cf).focus(); return; } // wait for their own words
      if ('industry' in b && !b.industry) delete b.industry; // not chosen yet: leave it unset
      busy = true;
      try { const saved = await api('PUT', '/api/company', b); company = { ...company, ...saved }; last = key(); toast('Settings saved'); } catch (err) { toast(err.message, true); }
      busy = false; if (again) { again = false; saveFields(); }
    };
    cf.addEventListener('change', (e) => { if (!e.target.closest('.hours-wrap')) saveFields(); });
    cf.addEventListener('submit', (e) => { e.preventDefault(); saveFields(); });
    wireHoursEditor($('[data-hours-root]', cf), businessHours(c), 'Closed', async (hours) => { const saved = await api('PUT', '/api/company', { hours }); company = { ...company, ...saved }; toast('Business hours saved'); });
  } else { // App Settings saves on its own too: a field as soon as it changes (its fields sit outside the form and say form="cf")
    const cf = $('#cf'); const key = () => JSON.stringify(Object.fromEntries(new FormData(cf)));
    let last = key(); let busy = false; let again = false;
    const saveFields = async () => {
      if (busy) { again = true; return; }
      if (key() === last) return;
      const bad = [...cf.elements].find((el) => el.willValidate && !el.checkValidity()); if (bad) return bad.reportValidity();
      const b = Object.fromEntries(new FormData(cf));
      if (!company.accentColor && b.accentColor === company.defaultAccent) delete b.accentColor; // left alone: keeps following the product's color
      const accentSet = !!b.accentColor && !company.accentColor; // first custom accent: re-render to show its Reset link
      busy = true;
      try { const saved = await api('PUT', '/api/company', b); company = { ...company, ...saved }; last = key(); toast('Settings saved'); if (accentSet) { busy = false; return refresh(); } } catch (err) { toast(err.message, true); }
      busy = false; if (again) { again = false; saveFields(); }
    };
    [...cf.elements].forEach((el) => {
      el.addEventListener('change', saveFields);
      if (el.tagName === 'INPUT') el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveFields(); } });
    });
  }
  A.resetAccent = async () => { try { await api('PUT', '/api/company', { accentColor: '' }); toast('Accent color reset'); refresh(); } catch (err) { toast(err.message, true); } };
  A.removeLogo = async () => {
    if (!confirm('Delete your logo? It will be removed from quotes, invoices and the client portal.')) return;
    try { await api('DELETE', '/api/company/logo'); toast('Logo deleted'); refresh(); } catch (err) { toast(err.message, true); }
  };
  wireAccountCards(main);
  if (full) { stripeReturnNotice(integ); const to = ['#zelle', '#pay-apps', '#late-fees'].includes(location.hash) ? $(location.hash, main) : null; if (to) to.scrollIntoView({ block: 'start' }); } // back from Stripe, or a link to Card payments
  if ($('#logoFile')) $('#logoFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; if (f.size > 4e6) return toast('Logo must be under 4 MB', true);
    const dataUrl = f.type === 'image/svg+xml' ? await readFileAsDataUrl(f) : await resizeImage(f, 600);
    await api('POST', '/api/company/logo', { dataUrl }); toast('Logo updated'); refresh();
  });
}
/* ===== App Settings: plan, web address, card payments ===== */
function planCard(a) {
  if (!a) return '';
  const beta = (f) => (f.beta ? ' <span class="beta-tag" title="This feature is in beta testing">Beta</span>' : '');
  const inc = a.featureList.filter((f) => f.included); const not = a.featureList.filter((f) => !f.included);
  const contact = a.contactEmail ? `<a href="mailto:${esc(a.contactEmail)}?subject=${encodeURIComponent('Plan change for ' + (company.name || a.slug))}">${esc(a.contactEmail)}</a>` : 'us';
  return `<div class="card plan-card"><div class="plan-head"><div><h2>Your plan: ${esc(a.plan.name)}</h2><p class="muted" style="margin:0">${a.maxUsers ? (a.extraUser ? `${a.maxUsers} login${a.maxUsers === 1 ? '' : 's'} included, more at ${money(a.extraUser).replace(/\.00$/, '')}/month each` : `Up to ${a.maxUsers} login${a.maxUsers === 1 ? '' : 's'}`) : 'Unlimited logins'} · ${inc.length + a.alwaysIncluded.length} features</p></div>${not.length ? `<p class="muted" style="margin:0">To change your plan, contact ${contact}.</p>` : ''}</div>
<div class="plan-cols"><div><h3>Included</h3><ul class="feat-list">${a.alwaysIncluded.map((l) => `<li class="on">${esc(l)}</li>`).join('')}${inc.map((f) => `<li class="on" title="${esc(f.desc)}"><span>${esc(f.label)}${beta(f)}</span></li>`).join('')}</ul></div>
${not.length ? `<div><h3>Available on other plans</h3><ul class="feat-list">${not.map((f) => `<li title="${esc(f.desc)}"><span>${esc(f.label)}${beta(f)}</span></li>`).join('')}</ul></div>` : ''}</div></div>`;
}
function webAddressCard(a) {
  if (!a) return '';
  const own = planHas('customDomain'); const target = `${a.slug}.${a.rootDomain.replace(/:\d+$/, '')}`;
  return `<div class="card"><h2>Web address</h2><p style="margin-top:0">Your team logs in and clients open their links at <a href="${esc(a.url)}" target="_blank" rel="noopener"><strong>${esc(a.url.replace(/^https?:\/\//, ''))}</strong></a>.</p>
${a.url !== a.subdomainUrl ? `<p class="muted">Your ${esc(a.productName)} address <a href="${esc(a.subdomainUrl)}" target="_blank" rel="noopener">${esc(a.subdomainUrl.replace(/^https?:\/\//, ''))}</a> keeps working too.</p>` : ''}
${own ? `<h3>Your own domain</h3>${a.domains.length ? `<div class="tablewrap"><table class="domains"><tr><th>Domain</th><th>Status</th><th></th></tr>${a.domains.map((d) => `<tr><td><strong>${esc(d.host)}</strong>${d.primary ? ' <span class="cstatus active">Main address</span>' : ''}</td>
<td>${d.verified ? '<span class="cstatus active">Connected</span>' : '<span class="cstatus q-sent">Waiting for DNS</span>'}</td>
<td class="r dom-acts">${d.verified ? '' : `<button type="button" class="btn alt sm" data-act="checkDomain" data-host="${esc(d.host)}">Check now</button>`}${d.verified && !d.primary ? `<button type="button" class="btn alt sm" data-act="primaryDomain" data-host="${esc(d.host)}">Make main address</button>` : ''}<button type="button" class="btn danger sm" data-act="rmDomain" data-host="${esc(d.host)}">Remove</button></td></tr>`).join('')}</table></div>` : ''}
<form id="domainForm" class="sms-test"><label>Add a domain<input name="host" placeholder="app.yourbusiness.com" autocomplete="off"></label><button class="btn alt">Add domain</button></form>
<div class="dns-help"><strong>Connect it at your domain provider</strong> (GoDaddy, Namecheap, Cloudflare…):<ol>
<li>Add a <strong>CNAME</strong> record. Name: the part before your domain (e.g. <code>app</code>). Value: <code>${esc(target)}</code></li>
${a.serverIp ? `<li>For a domain without a prefix (yourbusiness.com), add an <strong>A</strong> record pointing to <code>${esc(a.serverIp)}</code> instead.</li>` : ''}
<li>Come back and press <strong>Check now</strong>. DNS changes can take up to a few hours.</li></ol></div>`
    : `<p class="muted">Want to use your own domain, like app.yourbusiness.com? Custom domains are included on other plans. ${role() === 'owner' ? '<a href="/settings/billing?upgrade=1" data-link>Upgrade your plan</a>' : 'Ask the account owner to upgrade your plan.'}</p>`}</div>`;
}
/* ===== /settings/connections: Account Connections ===== */
const connChip = (kind, text) => `<span class="conn-chip ${kind}"><i></i>${text}</span>`;
const CONN_ICONS = {
  google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z"/></svg>',
  facebook: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#1877F2"/><path fill="#fff" d="M26.6 46V30.2h5.3l.8-6.2h-6.1v-3.9c0-1.8.5-3 3.1-3H33v-5.5c-.6-.1-2.5-.3-4.7-.3-4.6 0-7.8 2.8-7.8 8V24h-5.2v6.2h5.2V46z"/></svg>',
  instagram: '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><radialGradient id="igg" cx="30%" cy="107%" r="150%"><stop offset="0" stop-color="#fdf497"/><stop offset=".05" stop-color="#fdf497"/><stop offset=".45" stop-color="#fd5949"/><stop offset=".6" stop-color="#d6249f"/><stop offset=".9" stop-color="#285AEB"/></radialGradient></defs><rect x="3" y="3" width="42" height="42" rx="11" fill="url(#igg)"/><rect x="12" y="12" width="24" height="24" rx="7" fill="none" stroke="#fff" stroke-width="3"/><circle cx="24" cy="24" r="5.5" fill="none" stroke="#fff" stroke-width="3"/><circle cx="31" cy="17" r="1.8" fill="#fff"/></svg>',
  stripe: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#635BFF"/><path fill="#fff" d="M22.4 19.6c0-1.2 1-1.7 2.6-1.7 2.3 0 5.2.7 7.5 1.9v-7c-2.5-1-5-1.4-7.5-1.4-6.1 0-10.2 3.2-10.2 8.6 0 8.4 11.5 7 11.5 10.7 0 1.4-1.2 1.9-2.9 1.9-2.5 0-5.7-1-8.3-2.4v7.1c2.8 1.2 5.6 1.7 8.3 1.7 6.3 0 10.6-3.1 10.6-8.6 0-9-11.6-7.4-11.6-10.8z"/></svg>',
  twilio: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#F22F46"/><circle cx="24" cy="24" r="13" fill="none" stroke="#fff" stroke-width="3.2"/><circle cx="19.6" cy="19.6" r="3.1" fill="#fff"/><circle cx="28.4" cy="19.6" r="3.1" fill="#fff"/><circle cx="19.6" cy="28.4" r="3.1" fill="#fff"/><circle cx="28.4" cy="28.4" r="3.1" fill="#fff"/></svg>',
  email: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="var(--brand)"/><rect x="11" y="15" width="26" height="18" rx="2.5" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M12 17l12 9 12-9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/></svg>',
  bluesky: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#1185FE"/><path fill="#fff" d="M16.5 14.6c2.9 2.2 6 6.6 7.5 9 1.5-2.4 4.6-6.8 7.5-9 2.1-1.6 5.5-2.8 5.5 1.1 0 .8-.4 6.6-.7 7.5-.9 3.3-4.3 4.1-7.3 3.6 5.2.9 6.5 3.8 3.7 6.7-5.4 5.5-7.7-1.4-8.3-3.1l-.4-1.1-.4 1.1c-.6 1.7-2.9 8.6-8.3 3.1-2.8-2.9-1.5-5.8 3.7-6.7-3 .5-6.4-.3-7.3-3.6-.3-.9-.7-6.7-.7-7.5 0-3.9 3.4-2.7 5.5-1.1z"/></svg>',
  youtube: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#FF0000"/><rect x="10" y="14" width="28" height="20" rx="6" fill="#fff"/><path fill="#FF0000" d="M21 19v10l8.5-5z"/></svg>',
  x: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#000"/><path fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" d="M15 14l18 20M33 14L15 34"/></svg>',
  linkedin: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#0A66C2"/><rect x="12.5" y="20" width="5" height="15" fill="#fff"/><circle cx="15" cy="14.6" r="3" fill="#fff"/><path fill="#fff" d="M22 20h4.8v2.2c.7-1.3 2.4-2.6 5-2.6 5 0 5.9 3.2 5.9 7.4V35h-5v-7.1c0-1.7 0-3.9-2.4-3.9s-2.8 1.9-2.8 3.8V35H22z"/></svg>',
  tiktok: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#000"/><path fill="#fff" d="M26.5 11h4.3c.3 2.9 2.3 5 5.2 5.3v4.3c-1.9 0-3.7-.6-5.2-1.6v9a7.6 7.6 0 1 1-7.6-7.6l1.1.1v4.4a3.2 3.2 0 1 0 2.2 3.1z"/></svg>',
  pinterest: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#E60023"/><path fill="#fff" d="M24.6 11c-7.4 0-11.2 5.3-11.2 9.7 0 2.7 1 5 3.2 5.9.4.1.7 0 .8-.4l.3-1.3c.1-.4.1-.5-.2-.9-.7-.8-1.1-1.8-1.1-3.2 0-4.2 3.1-7.9 8.1-7.9 4.4 0 6.9 2.7 6.9 6.3 0 4.7-2.1 8.8-5.2 8.8-1.7 0-3-1.4-2.6-3.2.5-2.1 1.5-4.3 1.5-5.8 0-1.4-.7-2.5-2.3-2.5-1.8 0-3.2 1.9-3.2 4.3 0 1.6.5 2.6.5 2.6l-2.2 9.1c-.6 2.7-.1 6 0 6.3h.4c.2-.3 2.4-3 3.1-5.8l1.2-4.7c.6 1.2 2.4 2.2 4.2 2.2 5.5 0 9.2-5 9.2-11.7C35.5 15.7 31.3 11 24.6 11z"/></svg>',
  threads: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#000"/><text x="24" y="32.5" text-anchor="middle" font-family="system-ui,sans-serif" font-size="25" font-weight="700" fill="#fff">@</text></svg>',
  ai: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#7C3AED"/><path fill="#fff" d="M22 11l2.6 7.4L32 21l-7.4 2.6L22 31l-2.6-7.4L12 21l7.4-2.6zM33 27l1.3 3.7L38 32l-3.7 1.3L33 37l-1.3-3.7L28 32l3.7-1.3z"/></svg>',
};
// card payments go to the business's own Stripe account, connected with Stripe Connect (Stripe hosts the sign-up and verification)
function stripeConn(integ) {
  const S = integ.stripe; const mode = integ.paymentsMode === 'live' ? connChip('on', 'Live') : connChip('wait', 'Test mode');
  const base = { id: 'stripe', icon: 'stripe', feature: 'onlinePayments', title: 'Stripe', desc: 'Let clients pay invoices and quote deposits by card. The money goes straight to your Stripe account.' };
  if (!S) return { ...base, status: connChip('off', 'Not in your plan'), button: '', body: '' , desc: base.desc + ' Card payments are included on other plans.' };
  const fee = S.feePercent ? ` A ${S.feePercent}% platform fee applies to each card payment.` : '';
  // set up in the app (no Stripe login): its status, the payout bank, and the in-app form to finish or update it
  if (S.accountType === 'embedded') {
    const bank = S.bank ? `${esc(S.bank.name)} ••${esc(S.bank.last4)}` : 'your bank account';
    if (S.chargesEnabled && integ.payments) return { ...base, desc: 'Clients pay invoices and quote deposits by card.', status: connChip('on', 'Connected') + mode + (S.due ? connChip('wait', 'Action needed') : ''), button: 'Manage', body: `${S.due ? '<div class="notice">Stripe needs a little more information to keep your payouts going.</div>' : ''}<p>Clients can pay you by card. Payouts go to <strong>${bank}</strong>.${fee}</p>
<div class="sms-test"><a class="btn ${S.due ? '' : 'alt'}" href="/settings/card-payments" data-link>${S.due ? 'Add the missing details' : 'Update business or payout details'}</a><button type="button" class="btn danger sm" data-act="rmStripe" data-kind="embedded">Turn off card payments</button></div>` };
    return { ...base, desc: 'Clients pay invoices and quote deposits by card.', status: connChip('wait', 'Setup not finished'), button: 'Manage', open: true, body: `<p>${S.detailsSubmitted && !S.due ? 'Stripe is reviewing your details. This usually takes a few minutes; you’ll be able to take card payments once it’s done.' : 'You started setting up card payments but didn’t finish. Pick up where you left off.'}</p>
<div class="sms-test"><a class="btn" href="/settings/card-payments" data-link>Finish setup</a><button type="button" class="btn alt" data-act="refreshStripe">Check again</button><button type="button" class="btn danger sm" data-act="rmStripe" data-kind="embedded">Cancel</button></div>` };
  }
  if (S.chargesEnabled && integ.payments) return { ...base, status: connChip('on', 'Connected') + mode, button: 'Manage', body: `<p>Connected to <strong>${esc(S.name || 'your Stripe account')}</strong>. Payouts, refunds and receipts are managed in Stripe.${S.feePercent ? ` A ${S.feePercent}% platform fee applies to each card payment.` : ''}</p>
<div class="sms-test"><a class="btn alt" href="https://dashboard.stripe.com" target="_blank" rel="noopener">Open Stripe dashboard</a><button type="button" class="btn danger sm" data-act="rmStripe">Disconnect</button></div>` };
  // the platform's own business: payments go straight to the platform's Stripe account (the key in .env), nothing to set up
  if (S.serverKey) return { ...base, desc: 'Clients pay invoices and quote deposits by card.', status: connChip('on', 'Connected') + mode, button: 'Manage', body: '<p>Card payments for your business go straight to your platform’s Stripe account (the key in the server settings), so there’s nothing to set up here. Payouts, refunds and receipts are managed in Stripe.</p><div class="sms-test"><a class="btn alt" href="https://dashboard.stripe.com" target="_blank" rel="noopener">Open Stripe dashboard</a></div>' };
  // older accounts with Stripe keys pasted in: can switch to the setup the platform offers now
  if (S.ownKeys) { const M = S.methods || ['standard'];
    return { ...base, status: connChip('on', 'Connected') + mode, button: 'Manage', body: `<p>Card payments use the Stripe API keys you saved earlier.${S.available && M.length ? ' You can switch to the newer setup, which is simpler to look after.' : ''}</p>
<div class="sms-test">${S.available && M.includes('embedded') ? '<a class="btn" href="/settings/card-payments" data-link>Set up card payments</a>' : ''}${S.available && M.includes('standard') ? '<button type="button" class="btn" data-act="connectStripe">Connect with Stripe</button>' : ''}<button type="button" class="btn danger sm" data-act="rmStripe">Remove saved keys</button></div>` }; }
  if (!S.available) return { ...base, status: connChip('off', 'Not available yet'), button: '', body: '', desc: base.desc + ' Until card payments are switched on for this service, clients can’t pay by card.' };
  if (S.accountId) return { ...base, status: connChip('wait', 'Setup not finished'), button: 'Manage', open: true, body: `<p>${S.detailsSubmitted ? 'Stripe is reviewing your details. This usually takes a few minutes; you’ll be able to take card payments once it’s done.' : 'You started connecting Stripe but didn’t finish. Pick up where you left off: it takes about 5 minutes.'}</p>
<div class="sms-test"><button type="button" class="btn" data-act="connectStripe">${S.detailsSubmitted ? 'Review details in Stripe' : 'Finish setting up Stripe'}</button><button type="button" class="btn alt" data-act="refreshStripe">Check again</button><button type="button" class="btn danger sm" data-act="rmStripe">Cancel</button></div>` };
  // not set up yet: the ways the platform offers (Alpha → Settings → Integrations → Stripe)
  const M = S.methods || ['standard']; const inApp = M.includes('embedded'); const viaStripe = M.includes('standard');
  if (!M.length) return { ...base, status: connChip('off', 'Not available yet'), button: '', body: '', desc: base.desc + ' Until card payments are switched on for this service, clients can’t pay by card.' };
  const steps = inApp ? '<li>Click <strong>Set up card payments</strong>.</li><li>Enter your business details and the bank account for payouts, right here. It takes about 10 minutes, and you don’t need a Stripe account.</li><li>Clients can pay you by card.</li>'
    : '<li>Click <strong>Connect with Stripe</strong>. You’ll go to Stripe’s secure site.</li><li>Set up your Stripe account: your business details and the bank account for payouts.</li><li>You come back here, and clients can pay you by card.</li>';
  // both ways offered: two options side by side with "or" between them
  if (inApp && viaStripe) return { ...base, desc: 'Let clients pay invoices and quote deposits by card. The money goes straight to your bank account. There are two ways to set it up: pick one.', status: connChip('off', 'Not connected'), button: 'Connect', body: `<div class="pay-opts">
<div class="pay-opt"><div class="pay-opt-tag">Option 1 · Recommended</div><h3>Set up right here</h3><p class="muted">Enter your business details and the bank account for payouts in Worklio Pro. It takes about 10 minutes, and you don’t need a Stripe account.</p><a class="btn" href="/settings/card-payments" data-link>Set up card payments</a></div>
<div class="pay-or"><span>or</span></div>
<div class="pay-opt"><div class="pay-opt-tag">Option 2</div><h3>Already use Stripe?</h3><p class="muted">Link your own Stripe account. You’ll sign in on Stripe’s secure site and manage payments in your Stripe dashboard.</p><button type="button" class="btn alt" data-act="connectStripe">Connect with Stripe</button></div>
</div>
<p class="muted" style="font-size:13px">Stripe charges its standard card processing fees${S.feePercent ? `, plus a ${S.feePercent}% platform fee on each payment` : ''}. Until you set up card payments, clients can’t pay by card.</p>` };
  return { ...base, desc: inApp ? 'Let clients pay invoices and quote deposits by card. The money goes straight to your bank account.' : base.desc, status: connChip('off', 'Not connected'), button: 'Connect', body: `<ol class="pay-steps">${steps}</ol>
<p class="muted" style="font-size:13px">Stripe charges its standard card processing fees${S.feePercent ? `, plus a ${S.feePercent}% platform fee on each payment` : ''}. Until you ${inApp ? 'set up card payments' : 'connect'}, clients can’t pay by card.</p>
<div class="sms-test">${inApp ? '<a class="btn" href="/settings/card-payments" data-link>Set up card payments</a>' : ''}${viaStripe ? `<button type="button" class="btn ${inApp ? 'alt' : ''}" data-act="connectStripe">Connect with Stripe</button>` : ''}</div>
` };
}
async function connectionsPage(main) {
  const [integ, C] = await Promise.all([api('GET', '/api/integrations'), api('GET', '/api/connections')]);
  connReturnNotice();
  const admin = ['owner', 'admin'].includes(role());
  const soon = { status: connChip('off', 'Coming soon'), button: '<button type="button" class="btn alt conn-btn" disabled title="Coming soon">Connect</button>' };
  const connect = (id) => ({ status: connChip('off', 'Not connected'), button: admin ? `<button type="button" class="btn alt conn-btn" data-act="socialConnect" data-kind="${id}">Connect</button>` : '' });
  const connected = (id, to, n) => ({ status: connChip('on', 'Connected'), connectedTo: `Connected to ${to}.${admin && n > 1 ? ` <button type="button" class="link-btn" data-act="socialChoose" data-kind="${id}">Change</button>` : ''}`,
    button: admin ? `<button type="button" class="btn alt conn-btn" data-act="socialDisconnect" data-kind="${id}">Disconnect</button>` : '' });
  // signed out by the network (or LinkedIn's yearly sign-in ending soon): Reconnect goes straight to its sign-in, which replaces the connection
  const reBtn = (id) => (admin ? `<button type="button" class="btn conn-btn" data-act="socialConnect" data-kind="${id}">Reconnect</button>` : '');
  const ask = admin ? '' : ' Ask the account owner or an admin to reconnect it.';
  const broken = (id, to) => ({ status: connChip('bad', 'Needs reconnecting'), connectedTo: `Connected to ${to}. ${esc(CONN_LABEL[id] || CONN_NAMES[id])} signed Worklio Pro out, so nothing can be posted there until it’s reconnected.${admin ? ' Click <strong>Reconnect</strong> and sign in again; it takes about a minute.' : ask}`, button: reBtn(id) });
  const ending = (id, to, x) => ({ ...connected(id, to, x.choices), status: connChip('wait', 'Reconnect soon'), connectedTo: `Connected to ${to}. ${esc(CONN_LABEL[id] || CONN_NAMES[id])} asks you to sign in again every so often: reconnect by ${esc(fmtDate(x.endsAt.slice(0, 10)))} so posts keep going out.${ask}`, button: reBtn(id) });
  const state = (id, x, to) => (x.connected ? (x.broken ? broken(id, to) : x.endsAt ? ending(id, to, x) : connected(id, to, x.choices)) : !x.available ? soon : connect(id)); // already connected: still shown, so it can be disconnected
  const G = C.google; const F = C.facebook; const I = C.instagram; const B = C.bluesky || {};
  // Google's features, each managed on its own (Jobber-style sub-rows)
  const sub = (title, desc, chip, btn) => `<div class="conn-sub"><div><h3>${title} ${chip}</h3><p>${desc}</p></div>${btn}</div>`;
  const gSubs = G.connected ? [
    G.reviewsPlan ? sub('Reviews', 'See client and Google reviews, and reply to Google reviews from here.', '', '<a class="btn alt sm" href="/reviews" data-link>Manage</a>') : '',
    C.postsPlan ? sub('Posts', 'Share updates with a photo on your Business Profile from Marketing, along with your other social accounts.', '', '<a class="btn alt sm" href="/social-posts" data-link>Manage</a>') : '',
    G.bookingPlan ? sub('Online booking', 'Add a <strong>Book</strong> button to your Google Business Profile that opens your booking page.', G.booking ? connChip('on', 'On') : connChip('off', 'Off'), admin ? '<button type="button" class="btn alt sm" data-act="bookingManage">Manage</button>' : '') : '',
  ].join('') : '';
  const posts = C.postsPlan ? ' Then post your project photos from <a href="/social-posts" data-link>Marketing</a>.' : '';
  const rows = [
    { id: 'google', icon: 'google', title: 'Google Business Profile', desc: 'Connect your Google Business Profile and manage which features use it.', ...state('google', G, `<strong>${esc(G.title)}</strong>`), body: gSubs },
    { id: 'facebook', icon: 'facebook', title: 'Facebook Business Page', desc: `Connect your Facebook Business Page and manage which features use it. You’ll need full admin permissions for the business profile to connect it.${F.connected ? posts : ''}`,
      ...state('facebook', F, F.link ? `<a href="${esc(F.link)}" target="_blank" rel="noopener"><strong>${esc(F.name)}</strong></a>` : `<strong>${esc(F.name)}</strong>`) },
    { id: 'instagram', icon: 'instagram', title: 'Instagram account', desc: `Connect your Instagram account to publish Instagram posts. You sign in with Instagram (no Facebook needed). You’ll need an Instagram professional account: either Business or Creator.${I.connected ? posts : ''}`,
      ...state('instagram', I, `<a href="https://www.instagram.com/${encodeURIComponent(I.username)}" target="_blank" rel="noopener"><strong>@${esc(I.username)}</strong></a>`) },
    ...[['linkedin', 'LinkedIn page', 'Connect a LinkedIn company page you’re an admin of to publish posts there.', (x) => (x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener"><strong>${esc(x.name)}</strong></a>` : `<strong>${esc(x.name)}</strong>`)],
      ['tiktok', 'TikTok account', 'Connect your TikTok account to publish photo posts. Until TikTok approves this app, posts can only be private.', (x) => `<strong>${esc(x.name)}</strong>`],
      ['threads', 'Threads account', 'Connect your Threads account to publish posts there.', (x) => `<a href="https://www.threads.net/@${encodeURIComponent(x.username)}" target="_blank" rel="noopener"><strong>@${esc(x.username)}</strong></a>`],
      ['pinterest', 'Pinterest account', 'Connect your Pinterest account to save your photos as Pins on one of your boards.', (x) => `the board <strong>${esc(x.name)}</strong>${x.username ? ` (@${esc(x.username)})` : ''}`],
      ['youtube', 'YouTube channel', 'Connect your YouTube channel to upload videos of your work. A vertical video up to 3 minutes long becomes a YouTube Short. Until Google approves this app, uploaded videos stay private.', (x) => (x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener"><strong>${esc(x.name)}</strong></a>` : `<strong>${esc(x.name)}</strong>`)]]
      .map(([id, title, desc, to]) => { const x = C[id] || {}; return { id, icon: id, title, desc: desc + (x.connected ? (id === 'youtube' ? posts.replace('project photos', 'videos') : posts) : ''), ...state(id, x, x.connected ? to(x) : '') }; }),
    { id: 'bluesky', icon: 'bluesky', title: 'Bluesky account', desc: `Connect your Bluesky account with an app password to publish posts there.${B.connected ? posts : ''}`,
      ...(B.connected ? { status: connChip('on', 'Connected'), connectedTo: `Connected to <a href="https://bsky.app/profile/${encodeURIComponent(B.handle)}" target="_blank" rel="noopener"><strong>@${esc(B.handle)}</strong></a>.`,
        button: admin ? '<button type="button" class="btn alt conn-btn" data-act="socialDisconnect" data-kind="bluesky">Disconnect</button>' : '' }
        : B.available === false ? soon : { status: connChip('off', 'Not connected'), button: admin ? '<button type="button" class="btn alt conn-btn" data-act="bskyConnect">Connect</button>' : '' }) },
    { id: 'x', icon: 'x', title: 'X account', desc: `Connect your X account with your own X developer app to publish posts there. X bills your developer account for each post.${C.x && C.x.connected ? posts : ''}`,
      ...(C.x && C.x.connected ? { status: connChip('on', 'Connected'), connectedTo: `Connected to <a href="https://x.com/${encodeURIComponent(C.x.username)}" target="_blank" rel="noopener"><strong>@${esc(C.x.username)}</strong></a>.`,
        button: admin ? '<button type="button" class="btn alt conn-btn" data-act="socialDisconnect" data-kind="x">Disconnect</button>' : '' }
        : C.x && C.x.available === false ? soon : { status: connChip('off', 'Not connected'), button: admin ? '<button type="button" class="btn alt conn-btn" data-act="xConnect">Connect</button>' : '' }) },
    ...(aiOn() ? [{ id: 'ai', icon: 'ai', feature: 'ai', title: 'AI descriptions', button: '', body: '', status: integ.ai ? connChip('on', 'On') : connChip('off', 'Not available yet'),
      desc: `“Write with AI” drafts product and service descriptions from their name.` }] : []),
  ];
  // connections for features the platform marks as Beta get a Beta tag and a short notice
  const beta = (r) => !!(r.feature && company.account && (company.account.featureList || []).some((f) => f.key === r.feature && f.beta));
  main.innerHTML = `<div class="head"><div><h1>Account Connections</h1><p class="sub">Manage the accounts your business has connected: change the Page, account or board you use, disconnect, and set up Google reviews and booking.${planHas('socialPosts') ? ' To post to social media, go to <a href="/social-posts" data-link>Marketing</a>.' : ''} Card payments are set up in <a href="/settings#payments" data-link>App Settings</a>; emails and texts to clients are sent for you.</p></div></div>
<div class="conn-list">${rows.map((r) => `<section class="card conn${r.body ? ' wide' : ''}" id="conn-${r.id}"><div class="conn-top"><div class="conn-ic">${CONN_ICONS[r.icon]}</div>
<div class="conn-main"><h2>${esc(r.title)}${beta(r) ? '<span class="beta-tag" title="This feature is in beta testing">Beta</span>' : ''}</h2>${r.status}</div></div>
<div class="conn-main">${r.connectedTo ? `<p class="conn-to">${r.connectedTo}</p>` : ''}<p>${r.desc}</p>${beta(r) ? '<p class="beta-note">This feature is in beta testing. It works, but it may change and you might run into rough edges. Tell us if something doesn’t look right.</p>' : ''}</div>
${r.button ? `<div class="conn-act">${r.button}</div>` : ''}
${r.body ? `<div class="conn-body conn-subs">${r.body}</div>` : ''}</section>`).join('')}</div>
${admin ? '' : '<p class="muted" style="font-size:13px">Only the account owner or an admin can connect or disconnect accounts.</p>'}`;
  connectionsData = C;
}
let connectionsData = null;
// the network's own name, used in "TikTok signed Worklio Pro out"
const CONN_LABEL = { google: 'Google', facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', pinterest: 'Pinterest', threads: 'Threads', tiktok: 'TikTok', youtube: 'YouTube' };
const CONN_NAMES = { google: 'Google Business Profile', facebook: 'Facebook Page', instagram: 'Instagram account', bluesky: 'Bluesky account', linkedin: 'LinkedIn page', pinterest: 'Pinterest account', threads: 'Threads account', tiktok: 'TikTok account', youtube: 'YouTube channel', x: 'X account', quickbooks: 'QuickBooks', xero: 'Xero' };
// back from Google or Facebook's sign-in (lib/platform.js → /oauth/…/callback)
function connReturnNotice() {
  const q = new URLSearchParams(location.search); const ok = q.get('connected'); const bad = q.get('connect_error'); if (!ok && !bad) return;
  history.replaceState(null, '', location.pathname);
  if (ok) toast(`${CONN_NAMES[ok] || 'Account'} connected`);
  else toast(q.get('reason') === 'cancelled' ? 'Connection cancelled. Nothing was changed.' : `Couldn’t connect: ${q.get('reason') || 'something went wrong'}`, true);
}
A.socialConnect = async (d, el) => {
  el.disabled = true;
  try { const { url } = await api('POST', `/api/connections/${d.kind}/start`, d.back ? { back: d.back } : {}); location.href = url; } catch (e) { el.disabled = false; toast(e.message, true); }
};
A.socialDisconnect = async (d) => {
  const why = { google: 'Your reviews will stop showing here, and the Book button comes off your Google profile.', facebook: 'You won’t be able to post to the Page from here.', instagram: 'You won’t be able to post to Instagram from here.', bluesky: 'You won’t be able to post to Bluesky from here. You can also revoke the app password in Bluesky.', x: 'You won’t be able to post to X from here. You can also regenerate the keys in your X developer app.' }[d.kind] || `You won’t be able to post to ${CONN_NAMES[d.kind].replace(/ (page|account|channel)$/, '')} from here.`;
  if (!confirm(`Disconnect your ${CONN_NAMES[d.kind]}? ${why}`)) return;
  try { await api('DELETE', `/api/connections/${d.kind}`); toast(`${CONN_NAMES[d.kind]} disconnected`); refresh(); } catch (e) { toast(e.message, true); }
};
// another location, Page or Instagram account the same sign-in manages
A.socialChoose = async (d) => {
  const mb = modal(`Change ${CONN_NAMES[d.kind]}`, '<p class="muted">Loading…</p>');
  try {
    const list = await api('GET', `/api/connections/${d.kind}/choices`);
    mb.innerHTML = `<form id="chooseForm"><div class="choose-list">${list.map((x) => `<label class="choose-row"><input type="radio" name="choice" value="${esc(x.id)}" ${x.current ? 'checked' : ''}><span><strong>${esc(x.label)}</strong>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span></label>`).join('')}</div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Use this one</button></div></form>`;
    $('#chooseForm', mb).addEventListener('submit', async (e) => {
      e.preventDefault(); const choice = new FormData(e.target).get('choice'); const btn = $('button.btn:not(.alt)', e.target); btn.disabled = true;
      try { await api('PUT', `/api/connections/${d.kind}`, { choice }); closeModal(); toast('Connection updated'); refresh(); } catch (err) { btn.disabled = false; toast(err.message, true); }
    });
  } catch (e) { mb.innerHTML = `<p>${esc(e.message)}</p><div class="foot"><button type="button" class="btn alt" data-act="closeModal">Close</button></div>`; }
};
// Google → Online booking: the Book button on the Google profile, and the booking page link to share anywhere
A.bookingManage = () => {
  const G = (connectionsData || {}).google || {};
  const mb = modal('Online booking', `<p>New clients can ask for a visit from your booking page. Requests arrive in <a href="/clients" data-link>Clients</a> as leads, and you get an email.</p>
<label class="sw-row"><span>Show a Book button on Google<small class="muted">On your Business Profile in Google Search and Maps. Google can take a few hours to show it.</small></span><input type="checkbox" class="sw" id="bkOn" ${G.booking ? 'checked' : ''}><i></i></label>
<p style="margin:16px 0 6px"><strong>Your booking page</strong></p><p class="muted" style="margin:0 0 8px;font-size:13px">Add it to your social media bio or email signature. To put the form on your website, see <a href="/settings/booking" data-link>Online Booking</a>.</p>
<div class="copy-row"><input readonly value="${esc(G.bookingUrl)}" onclick="this.select()" aria-label="Booking page link"><button type="button" class="btn alt sm" data-act="copyInput">Copy</button><a class="btn alt sm" href="${esc(G.bookingUrl)}" target="_blank" rel="noopener">Open</a></div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button type="button" class="btn" data-act="bookingSave">Save</button></div>`);
  return mb;
};
A.bookingSave = async (d, el) => {
  const on = $('#bkOn').checked; el.disabled = true;
  try { await api('PUT', '/api/connections/google', { booking: on }); closeModal(); toast(on ? 'The Book button is on. Google can take a few hours to show it.' : 'The Book button is off'); refresh(); } catch (e) { el.disabled = false; toast(e.message, true); }
};
// Settings → Online Booking: the booking page link, the Book button on Google, and the widget for the business's own website.
// The widget's choices live in the code it makes (data-mode, data-text, data-color), so nothing is saved here
const BK_MODES = [['inline', 'Form on the page', 'The booking form sits in your page, where you paste the code.'], ['button', 'Book button', 'A button where you paste the code. It opens the form in a popup.'], ['float', 'Button in the corner', 'A round button stays in the bottom-right corner of the page and opens the form in a popup.']];
let bkW = null;
const bkCode = (src = bkW.script) => { const w = bkW; return `<script src="${src}"${w.mode !== 'inline' ? ` data-mode="${w.mode}"${w.text !== 'Book now' ? ` data-text="${esc(w.text)}"` : ''}` : ''}${w.color.toLowerCase() !== w.brand.toLowerCase() ? ` data-color="${w.color}"` : ''}></script>`; };
// a pretend web page with the code on it, so the preview is the real widget (loaded from this address: the same account, and it works on a test copy too)
const bkPreview = () => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui,sans-serif;background:#f8fafc;color:#334155;min-height:100vh}header{background:#fff;border-bottom:1px solid #e2e8f0;padding:14px 20px;font-weight:700;font-size:15px}main{padding:24px 20px 40px}.l{height:10px;background:#e2e8f0;border-radius:5px;margin:0 0 10px}</style></head><body><header>Your website</header><main><div class="l" style="width:55%"></div><div class="l" style="width:85%"></div><div class="l" style="width:70%;margin-bottom:24px"></div>${bkCode(location.origin + '/book/widget.js')}</main></body></html>`;
function bkRefresh(preview = true) {
  const box = $('#bkCode'); if (!box) return; box.value = bkCode();
  $('#bkTextRow').hidden = bkW.mode === 'inline';
  $$('[data-act="bkMode"]').forEach((b) => { b.classList.toggle('on', b.dataset.mode === bkW.mode); b.setAttribute('aria-pressed', String(b.dataset.mode === bkW.mode)); });
  $('#bkModeNote').textContent = BK_MODES.find(([k]) => k === bkW.mode)[2];
  if (preview) $('#bkPrev').srcdoc = bkPreview();
}
PAGES['/settings/booking'] = {
  title: 'Online Booking',
  async render(main) {
    const B = await api('GET', '/api/booking');
    bkW = { script: B.script, brand: B.color, color: B.color, mode: 'inline', text: 'Book now' };
    const L = B.last30; const host = B.url.replace(/^https?:\/\//, '');
    const google = !B.google.connected ? `<a href="/settings/connections" data-link>Connect your Google Business Profile</a> to add a <strong>Book</strong> button to it in Search and Maps.`
      : `The <strong>Book</strong> button on your Google Business Profile is <strong>${B.google.booking ? 'on' : 'off'}</strong>. Change it in <a href="/settings/connections" data-link>Account Connections</a> → Google → Online booking.`;
    main.innerHTML = `<div class="head"><div><h1>Online Booking</h1><p class="sub">New clients ask for a visit from your booking page. Each request arrives in <a href="/clients" data-link>Clients</a> as a lead, and you get an email.</p></div></div>
<div class="card ob-card"><h2>Your booking page</h2><p class="muted">Share it anywhere: your social media bio, email signature or a text to a new client.</p>
<div class="copy-row"><input readonly value="${esc(B.url)}" onclick="this.select()" aria-label="Booking page link"><button type="button" class="btn alt sm" data-act="copyInput">Copy</button><a class="btn alt sm" href="${esc(B.url)}" target="_blank" rel="noopener">Open</a></div>
<p class="muted ob-google">${google}</p>
<p class="muted ob-stats">Last 30 days: <strong>${L.total}</strong> booking${L.total === 1 ? '' : 's'}${L.website ? `, ${L.website} from your website${L.sites.length ? ` (${L.sites.map(([s, n]) => `${esc(s)}${L.sites.length > 1 ? ` ${n}` : ''}`).join(', ')})` : ''}` : ''}.</p></div>
<div class="card ob-card"><h2>Add it to your website</h2><p class="muted">Copy the code below and paste it into your website where you want it. Most website builders have a block for this, called <strong>Custom HTML</strong>, <strong>Embed</strong> or <strong>Code</strong>.</p>
<div class="ob-grid"><div class="ob-opts">
<p class="ob-l">Style</p><div class="tabs ob-modes" role="group" aria-label="Style">${BK_MODES.map(([k, l]) => `<button type="button" data-act="bkMode" data-mode="${k}">${l}</button>`).join('')}</div>
<p class="muted ob-note" id="bkModeNote"></p>
<label id="bkTextRow">Button text<input id="bkText" maxlength="40" value="Book now"></label>
<label>Color<span class="bp-color"><input id="bkColor" maxlength="7" spellcheck="false" value="${esc(B.color)}"><input type="color" id="bkColorPick" value="${esc(B.color.toLowerCase())}" aria-label="Color"></span></label>
<p class="ob-l">Code</p><textarea id="bkCode" class="ob-code" readonly rows="4" onclick="this.select()" aria-label="Code for your website"></textarea>
<div class="ob-actions"><button type="button" class="btn" data-act="bkCopy">Copy code</button><a href="${esc((company.account && company.account.helpUrl) || '')}/articles/online-booking" target="_blank" rel="noopener" class="btn alt">How to add it</a></div>
<p class="muted ob-small">The form always shows your latest business name and details, so you only add the code once. Requests sent from it say which website they came from.</p></div>
<div class="ob-prev"><p class="ob-l">Preview</p><iframe id="bkPrev" title="Preview of the booking widget on a website"></iframe><p class="muted ob-small">This is your real form: a request sent here arrives in Clients.</p></div></div></div>`;
    bkRefresh();
    let t = 0; const later = () => { clearTimeout(t); t = setTimeout(() => bkRefresh(), 400); };
    $('#bkText').addEventListener('input', (e) => { bkW.text = e.target.value.trim().slice(0, 40) || 'Book now'; bkRefresh(false); later(); });
    $('#bkColor').addEventListener('input', (e) => { const v = e.target.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) { bkW.color = v; $('#bkColorPick').value = v.toLowerCase(); bkRefresh(false); later(); } });
    $('#bkColorPick').addEventListener('input', (e) => { bkW.color = e.target.value; $('#bkColor').value = e.target.value; bkRefresh(false); later(); });
  },
};
A.bkMode = (d) => { bkW.mode = d.mode; bkRefresh(); };
A.bkCopy = async (d, el) => { const c = bkCode(); try { await navigator.clipboard.writeText(c); } catch (e) { const t = $('#bkCode'); t.select(); document.execCommand('copy'); } el.textContent = 'Copied'; setTimeout(() => { el.textContent = 'Copy code'; }, 2000); };
A.toggleConn = (d) => {
  const sec = $(`#conn-${d.id}`); const body = sec && $('.conn-body', sec); if (!body) return;
  body.hidden = !body.hidden; $('.conn-btn', sec).setAttribute('aria-expanded', String(!body.hidden));
  if (!body.hidden) { const f = $('input:not([disabled]):not([readonly]), select', body); if (f) f.focus(); }
};
// App Settings → Payments → Card payments: the one-time Stripe setup (Stripe Connect), so clients can pay invoices and deposits by card
function payCard(integ) {
  const r = stripeConn(integ);
  return `<div class="card pay-card" id="payments"><div class="pay-card-h">${CONN_ICONS.stripe}<div><h2>Card payments ${r.status}</h2><p class="muted" style="margin:0">${r.desc}</p></div></div>${r.body ? `<div class="pay-card-b">${r.body}</div>` : ''}
<p class="muted" style="font-size:13px;margin:12px 0 0">Emails to your clients are sent for you by ${esc(company.account.productName)} in your business name. Texts come from ${esc(company.account.productName)} and name your business.</p></div>`;
}
function stripeReturnNotice(integ) {
  const q = new URLSearchParams(location.search).get('stripe'); if (!q) return;
  history.replaceState(null, '', location.pathname);
  if (q === 'error') return toast('Stripe couldn’t continue the setup. Try again.', true);
  const S = integ.stripe || {}; toast(S.chargesEnabled ? 'Stripe is connected. Clients can now pay by card.' : 'Stripe setup saved. Finish any remaining steps to start taking card payments.', !S.chargesEnabled);
}
function wireAccountCards(main) {
  const df = $('#domainForm', main);
  if (df) df.addEventListener('submit', async (e) => {
    e.preventDefault(); const host = new FormData(df).get('host').trim(); if (!host) return toast('Enter a domain', true);
    try { await api('POST', '/api/account/domains', { host }); toast('Domain added. Now set up its DNS record.'); refresh(); } catch (err) { toast(err.message, true); }
  });
}
A.checkDomain = async (d, el) => {
  el.disabled = true; el.textContent = 'Checking…';
  try { const r = await api('POST', `/api/account/domains/${encodeURIComponent(d.host)}/check`, {}); toast(r.ok ? `${d.host} is connected` : r.detail, !r.ok); if (r.ok) refresh(); }
  finally { el.disabled = false; el.textContent = 'Check now'; }
};
A.primaryDomain = async (d) => { await api('POST', `/api/account/domains/${encodeURIComponent(d.host)}/primary`, {}); toast(`Links now use ${d.host}`); refresh(); };
A.rmDomain = async (d) => { if (!confirm(`Remove ${d.host}? It stops opening your account.`)) return; await api('DELETE', `/api/account/domains/${encodeURIComponent(d.host)}`); toast('Domain removed'); refresh(); };
A.connectStripe = async (d, el) => {
  el.disabled = true; el.textContent = 'Opening Stripe…';
  try { const r = await api('POST', '/api/integrations/stripe/connect', {}); location.href = r.url; } catch (err) { toast(err.message, true); el.disabled = false; el.textContent = 'Connect with Stripe'; }
};
A.refreshStripe = () => refresh();
A.rmStripe = async (d) => {
  const inApp = d && d.kind === 'embedded';
  if (!confirm(inApp ? 'Turn off card payments? Clients won’t be able to pay by card, and you’ll need to set card payments up again to turn them back on. Payouts already on their way still arrive.' : 'Disconnect Stripe? Clients won’t be able to pay by card until you connect it again. Your Stripe account and its money aren’t affected.')) return;
  await api('POST', '/api/integrations/stripe/disconnect', {}); toast(inApp ? 'Card payments turned off' : 'Stripe disconnected'); refresh();
};
/* ===== /settings/card-payments: card payment setup inside the app (Stripe's embedded form; no Stripe account for the business) ===== */
const CONNECT_JS = 'https://connect-js.stripe.com/v1.0/connect.js';
const loadConnectJs = () => new Promise((resolve, reject) => {
  if (window.StripeConnect && window.StripeConnect.init) return resolve(window.StripeConnect);
  window.StripeConnect = window.StripeConnect || {}; window.StripeConnect.onLoad = () => resolve(window.StripeConnect);
  if (!document.querySelector(`script[src="${CONNECT_JS}"]`)) { const s = document.createElement('script'); s.src = CONNECT_JS; s.async = true; s.onerror = () => reject(new Error('Stripe’s setup form couldn’t load. Check your connection and try again.')); document.head.appendChild(s); }
});
PAGES['/settings/card-payments'] = {
  title: 'Card payments setup',
  async render(main) {
    const integ = await api('GET', '/api/integrations'); const S = integ.stripe || {};
    const done = S.accountType === 'embedded' && S.chargesEnabled && !S.due; // set up: show the form for updating details and the payout bank
    main.innerHTML = `<div class="head"><div><a href="/settings#payments" data-link class="muted">← App Settings</a><h1>${done ? 'Business and payout details' : 'Set up card payments'}</h1>
<p class="sub">${done ? 'Update your business details or the bank account your payouts go to.' : 'Enter your business details and the bank account for payouts. It takes about 10 minutes, and you can stop and come back any time.'}</p></div></div>
<div class="card cp-setup"><div id="cpBanner"></div><div id="cpForm"><p class="muted">Loading the secure form…</p></div></div>
<p class="muted" style="font-size:13px">Your details go securely to Stripe, our payment processor, which verifies businesses as banks require. ${esc(company.account.productName)} never sees your full SSN or bank account number. <a href="${esc(company.account.helpUrl || '')}/articles/set-up-payments" target="_blank" rel="noopener">How card payments work</a></p>`;
    if (S.accountType && S.accountType !== 'embedded') { $('#cpForm', main).innerHTML = '<p>Card payments are connected with your own Stripe account. Manage your details and bank account in your Stripe dashboard.</p><a class="btn alt" href="https://dashboard.stripe.com" target="_blank" rel="noopener">Open Stripe dashboard</a>'; return; }
    try {
      const first = await api('POST', '/api/integrations/stripe/embedded', {}); let fresh = first.clientSecret;
      const SC = await loadConnectJs();
      const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#2563eb';
      const instance = SC.init({ publishableKey: first.publishableKey, fetchClientSecret: async () => { if (fresh) { const s = fresh; fresh = null; return s; } return (await api('POST', '/api/integrations/stripe/embedded', {})).clientSecret; },
        appearance: { variables: { colorPrimary: brand, fontFamily: 'inherit', borderRadius: '8px' } } });
      const box = $('#cpForm', main); box.innerHTML = '';
      if (done) { $('#cpBanner', main).appendChild(instance.create('notification-banner')); box.appendChild(instance.create('account-management')); }
      else {
        const ob = instance.create('account-onboarding');
        ob.setOnExit(async () => { const r = await api('GET', '/api/integrations').catch(() => ({})); const ok = r.stripe && r.stripe.chargesEnabled; toast(ok ? 'Card payments are on. Clients can now pay you by card.' : 'Saved. Finish any remaining steps to start taking card payments.', !ok); navigate('/settings#payments'); });
        box.appendChild(ob);
      }
    } catch (err) { $('#cpForm', main).innerHTML = `<div class="notice">${esc(err.message)}</div><a class="btn alt" href="/settings#payments" data-link>Back to App Settings</a>`; }
  },
};

PAGES['/settings/company'] = { title: 'Company Profile', render: (m) => companyPage(m, false) };
PAGES['/settings'] = { title: 'App Settings', render: (m) => companyPage(m, true) };
PAGES['/settings/connections'] = { title: 'Account Connections', render: connectionsPage };

/* ===== /settings/accounting: QuickBooks Online and Xero (server.js → accounting sync, lib/accounting.js) =====
   Connect one, choose the accounts things go to and the date to start from, then turn on sending. One way: Worklio → the books. */
const BOOKS_LOGO = { quickbooks: ['qb', '#2CA01C'], xero: ['x', '#13B5EA'] };
const booksLogo = (k) => `<span class="mkt-logo mono" style="background:${BOOKS_LOGO[k][1]};color:#fff">${BOOKS_LOGO[k][0]}</span>`;
let BK = null; let bkOpts = null; let bkPoll = null;
const bkWhen = (s) => (s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never');
const bkSelect = (name, label, list, val, hint, blank = 'Choose…') => `<label>${label}<select name="${name}"><option value="">${blank}</option>${(list || []).map((o) => `<option value="${esc(o.id)}" ${String(val) === String(o.id) ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>${hint ? `<span class="muted">${hint}</span>` : ''}</label>`;
async function booksPage(main) {
  clearTimeout(bkPoll); connReturnNotice();
  BK = await api('GET', '/api/accounting'); const admin = ['owner', 'admin'].includes(role());
  const head = `<div class="head"><div><h1>QuickBooks &amp; Xero</h1><p class="sub">Send your clients, invoices, payments and expenses to your accounting software automatically, so your books stay up to date without typing anything twice.</p></div></div>`;
  if (!BK.connected) {
    bkOpts = null;
    main.innerHTML = head + `<div class="conn-list">${BK.providers.map((p) => `<section class="card conn" id="conn-${p.id}"><div class="conn-top"><div class="conn-ic">${booksLogo(p.id)}</div><div class="conn-main"><h2>${esc(p.name)}</h2>${p.available ? connChip('off', 'Not connected') : connChip('off', 'Coming soon')}</div></div>
<div class="conn-main"><p>${p.id === 'quickbooks' ? 'Sign in to QuickBooks and choose your company. Clients become customers, and invoices, payments and expenses are recorded in QuickBooks.' : 'Sign in to Xero and choose your organisation. Clients become contacts, and invoices, payments and expenses are recorded in Xero.'}</p></div>
${admin && p.available ? `<div class="conn-act"><button type="button" class="btn alt conn-btn" data-act="booksConnect" data-kind="${p.id}">Connect</button></div>` : ''}</section>`).join('')}</div>
<div class="card"><h2>How it works</h2><ul class="mkt-does"><li>You choose a start date. Only invoices and expenses from that day on are sent, so nothing you’ve already entered by hand is duplicated.</li><li>Every 15 minutes, new and edited invoices go over, then the payments on them, then your expenses.</li><li>It’s one way: changes you make in QuickBooks or Xero don’t come back here.</li></ul></div>
${admin ? '' : '<p class="muted" style="font-size:13px">Only the account owner or an admin can connect accounting software.</p>'}`;
    return;
  }
  const S = BK.settings; const qb = BK.connected === 'quickbooks'; const W = BK.waiting; const waiting = W.invoices + W.payments + W.expenses;
  const last = BK.lastResult; const status = BK.syncing ? connChip('wait', 'Sending…') : BK.needsReconnect ? connChip('off', 'Sign in again') : BK.auto ? connChip('on', 'On') : connChip('off', 'Off');
  main.innerHTML = head + `
<section class="card conn wide"><div class="conn-top"><div class="conn-ic">${booksLogo(BK.connected)}</div><div class="conn-main"><h2>${esc(BK.name)}</h2>${status}</div></div>
<div class="conn-main"><p class="conn-to">Connected to <strong>${esc(BK.company)}</strong>${qb && BK.sandbox ? ' <span class="badge draft">Sandbox</span>' : ''}.</p>
${BK.needsReconnect ? `<p class="note">${esc(BK.name)} signed you out, so nothing is being sent. Connect again to pick up where it left off.</p>` : ''}
<p>${BK.auto ? 'New and changed records are sent every 15 minutes.' : 'Sending is off. Choose your accounts below, then turn it on.'} Last sent ${bkWhen(BK.lastSyncAt)}${last && !BK.syncing ? ` (${last.sent} sent${last.failed ? `, ${last.failed} couldn’t be sent` : ''}${last.more ? ', more to go' : ''})` : ''}.</p></div>
${admin ? `<div class="conn-act">${BK.needsReconnect ? `<button type="button" class="btn conn-btn" data-act="booksConnect" data-kind="${BK.connected}">Connect again</button>` : `<button type="button" class="btn alt conn-btn" data-act="booksSync" ${BK.syncing ? 'disabled' : ''}>${BK.syncing ? 'Sending…' : 'Sync now'}</button>`}<button type="button" class="btn alt conn-btn" data-act="booksDisconnect">Disconnect</button></div>` : ''}</section>
<div class="grid g4">${stat('Invoices sent', BK.sent.invoices, W.invoices ? `${W.invoices} waiting` : 'All sent')}${stat('Payments sent', BK.sent.payments, W.payments ? `${W.payments} waiting` : 'All sent')}${stat('Expenses sent', BK.sent.expenses, W.expenses ? `${W.expenses} waiting` : 'All sent')}${stat(qb ? 'Customers' : 'Contacts', BK.sent.clients, 'Added with their invoices')}</div>
${BK.errors.length ? `<div class="card" style="margin-top:16px"><h2>Couldn’t be sent (${BK.errors.length})</h2><p class="muted" style="margin-top:0">Fix the problem (usually a setting below, or the record in ${esc(BK.name)}), then choose <strong>Sync now</strong>.</p><div class="tablewrap"><table><tr><th>Record</th><th>Problem</th><th>When</th></tr>${BK.errors.map((e) => `<tr><td>${esc(e.label)}</td><td>${esc(e.msg)}</td><td>${bkWhen(e.at)}</td></tr>`).join('')}</table></div></div>` : ''}
<form class="card" id="bkForm" style="margin-top:16px"><h2>Settings</h2><div id="bkFields"><p class="muted">Loading your ${qb ? 'QuickBooks' : 'Xero'} accounts…</p></div></form>
<div class="card"><h2>Recent activity</h2>${BK.log.length ? `<div class="tablewrap"><table><tr><th>When</th><th>Record</th><th>Result</th></tr>${BK.log.map((l) => `<tr><td>${bkWhen(l.at)}</td><td>${esc(l.label)}</td><td>${l.ok ? connChip('on', 'Sent') : `${connChip('off', 'Failed')} <span class="muted">${esc(l.msg)}</span>`}</td></tr>`).join('')}</table></div>` : '<p class="muted">Nothing sent yet.</p>'}
<p class="muted" style="margin-bottom:0">Not sent: drafts, refunds, deleted invoices and expenses, and anything dated before your start date. Record those in ${esc(BK.name)} yourself.${qb ? '' : ' Xero won’t let a paid invoice be edited, so change those in Xero.'}</p></div>`;
  if (BK.syncing) bkPoll = setTimeout(() => { if (curPath() === '/settings/accounting') booksPage(main); }, 3000);
  if (!admin) { $('#bkFields').innerHTML = '<p class="muted">Only the account owner or an admin can change these settings.</p>'; return; }
  try { bkOpts = bkOpts || await api('GET', '/api/accounting/options'); } catch (e) { $('#bkFields').innerHTML = `<p class="note">Couldn’t load your accounts: ${esc(e.message)}</p>`; return; }
  const O = bkOpts; const D = O.defaults || {}; const v = (k) => S[k] || D[k] || '';
  $('#bkFields').innerHTML = `<label>Send records dated from<input type="date" name="startDate" value="${esc(BK.startDate)}" required><span class="muted">Invoices and expenses before this date aren’t sent. Pick the day after your books were last brought up to date.</span></label>
<h3 class="bk-h">Invoices and payments</h3><div class="row">${qb ? bkSelect('itemId', 'Product/service for invoice lines', O.items, v('itemId'), 'Each line keeps its own description and price. The product/service decides the income account.')
    : bkSelect('salesAccount', 'Sales account for invoice lines', O.salesAccounts, v('salesAccount'))}
${qb ? bkSelect('depositAccount', 'Deposit payments to', O.depositAccounts, v('depositAccount'), 'Undeposited Funds lets you group payments into bank deposits in QuickBooks.')
    : bkSelect('depositAccount', 'Payments go to', O.depositAccounts, v('depositAccount'), 'The bank account client payments land in.')}</div>
${qb ? '<p class="muted">Sales tax: each invoice is marked taxable when it has tax, with the tax total from here. QuickBooks’ automated sales tax may adjust it.</p>' : `<div class="row">${bkSelect('taxType', 'Tax rate for taxed invoices', O.taxRates, v('taxType'), 'The tax amount on each invoice is kept exactly as it is here.')}</div>`}
<h3 class="bk-h">Expenses</h3><div class="row">${bkSelect('bankAccount', 'Paid from', O.bankAccounts, v('bankAccount'), qb ? 'A bank or credit card account.' : 'A bank account.')}${bkSelect('expenseAccount', 'Expense account', O.expenseAccounts, v('expenseAccount'), 'Used for any category not matched below.')}</div>
${BK.categories.length ? `<details class="bk-cats"${Object.keys(BK.categoryAccounts).length ? ' open' : ''}><summary>Match expense categories to accounts</summary><div class="tablewrap"><table><tr><th>Category</th><th>${esc(BK.name)} account</th></tr>${BK.categories.map((c) => `<tr><td>${esc(c)}</td><td><select data-cat="${esc(c)}" aria-label="Account for ${esc(c)}"><option value="">Expense account above</option>${O.expenseAccounts.map((a) => `<option value="${esc(a.id)}" ${BK.categoryAccounts[c] === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></td></tr>`).join('')}</table></div></details>` : ''}
<label class="bk-auto"><input type="checkbox" name="auto" ${BK.auto ? 'checked' : ''}> <span><strong>Send automatically</strong> <span class="muted">every 15 minutes</span></span></label>
<div class="acts" style="justify-content:flex-start;gap:8px"><button class="btn">Save</button>${BK.sent.invoices + BK.sent.expenses ? '<button type="button" class="btn alt" data-act="booksReset">Send everything again…</button>' : ''}</div>`;
  $('#bkForm').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target; const val = (n) => (f.elements[n] ? f.elements[n].value : '');
    const settings = Object.fromEntries(['itemId', 'salesAccount', 'taxType', 'depositAccount', 'bankAccount', 'expenseAccount'].map((k) => [k, val(k)]));
    const auto = f.elements.auto.checked;
    if (auto) { const need = qb ? [['itemId', 'the product/service for invoice lines']] : [['salesAccount', 'the sales account'], ['depositAccount', 'the account payments go to']];
      const miss = need.find(([k]) => !settings[k]); if (miss) return toast(`Choose ${miss[1]} before turning on sending`, true); }
    const categoryAccounts = Object.fromEntries($$('[data-cat]', f).map((s) => [s.dataset.cat, s.value]));
    try { BK = await api('PUT', '/api/accounting', { startDate: val('startDate'), settings, categoryAccounts, auto }); toast(auto ? 'Saved. Sending starts within 15 minutes, or choose Sync now.' : 'Saved'); booksPage(main); } catch (x) { toast(x.message, true); }
  };
}
PAGES['/settings/accounting'] = { title: 'QuickBooks & Xero', render: booksPage };
A.booksConnect = async (d) => { try { const r = await api('POST', `/api/accounting/${d.kind}/start`); location.href = r.url; } catch (x) { toast(x.message, true); } };
A.booksSync = async () => { try { await api('POST', '/api/accounting/sync'); booksPage($('#main')); } catch (x) { toast(x.message, true); } };
A.booksDisconnect = async () => {
  if (!confirm(`Disconnect ${BK.name}? Nothing more is sent. What’s already in ${BK.name} stays there.`)) return;
  try { await api('DELETE', '/api/accounting'); toast(`${BK.name} disconnected`); booksPage($('#main')); } catch (x) { toast(x.message, true); }
};
A.booksReset = async () => {
  if (!confirm(`Send everything from the start date again? Only do this if you deleted what was sent from ${BK.name}, or you’ll get duplicates.`)) return;
  try { await api('POST', '/api/accounting/reset'); toast('Everything from the start date will be sent again'); booksPage($('#main')); } catch (x) { toast(x.message, true); }
};

/* ===== /settings/business-page: the page the business QR code opens (lib/business-page.js), with a phone preview ===== */
// two tabs, each with its sections; Next goes through them in order, from Business details on to QR code appearance
const BP_TABS = [['details', 'Business details', [['info', 'Your information'], ['styles', 'Styles'], ['links', 'Links'], ['exchange', 'Exchange contact'], ['usage', 'Usage limits']]],
  ['qr', 'QR code appearance', [['qrcolor', 'Color'], ['qrshape', 'Shape & form'], ['qrlogo', 'Logo'], ['qrbg', 'Page background'], ['qrrim', 'Rim content']]]];
const BP_ORDER = BP_TABS.flatMap(([t, , secs]) => secs.map(([k]) => [k, t]));
const QR_COLORS = [['bg', 'Background color'], ['dots', 'Dots color'], ['mBorder', 'Marker border color'], ['mCenter', 'Marker center color']];
// the samples a QR code's logo can be: network logos (CONN_ICONS) and simple icons in a dark circle
const QR_GLYPHS = {
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>', email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', book: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
};
function qrLogoHref(key, companyLogo) {
  if (!key) return ''; if (key === 'company') return companyLogo || ''; if (/^(data:|\/uploads\/)/.test(key)) return key;
  const svg = QR_GLYPHS[key] ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="23" fill="#111827"/><g transform="translate(12 12)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${QR_GLYPHS[key]}</g></svg>`
    : (CONN_ICONS[key] || '').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  return svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) : '';
}
// the saved QR look, ready for qrStyled (public/qr.js); qrInline makes its images data: URLs, which a downloaded PNG needs
const qrStyleFor = (q, companyLogo) => ({ ...q, logo: qrLogoHref(q.logo, companyLogo) });
async function qrInline(st) {
  const data = async (u) => (!u || u.startsWith('data:') ? u : readFileAsDataUrl(await (await fetch(u)).blob()));
  return { ...st, logo: await data(st.logo), bgImg: await data(st.bgImg) };
}
const BP_COLORS = [['pageColor', 'Page color'], ['textColor', 'Text color'], ['iconColor', 'Logo / icon'], ['buttonColor', 'Button color'], ['buttonTextColor', 'Button text color']];
let bp = null; // { page (what's being edited), V (from the server) }
// a logo as a PNG (keeps a transparent background), at most max pixels on its longer side
async function toPng(src, max) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/png');
}
PAGES['/settings/business-page'] = {
  title: 'Business Page',
  async render(main) {
    bpAt = 'info';
    const V = await api('GET', '/api/business-page'); const P = { ...V.page, links: bpWithDefaults(V.page.links.map((l) => ({ ...l }))), qr: { ...V.page.qr, header: { ...V.page.qr.header }, footer: { ...V.page.qr.footer } } }; bp = { page: P, V };
    const Q = P.qr; const qrUrl = V.url + '?qr=1';
    // a choice in Shape & form, shown as a small QR code drawn that way
    // zoomed in on what the choice changes: a corner marker, or some dots (the sample code is 21 modules with a 4-module margin)
    const ZOOM = { dot: '10.5 10.5 8 8', border: '3.5 3.5 8 8', center: '5 5 5 5' };
    const opt = (k, v, label) => `<button type="button" class="bp-opt" data-act="bpQrOpt" data-k="${k}" data-v="${v}" title="${label}" aria-label="${label}">${qrStyled('Worklio', { [k]: v, ...(k === 'border' && v === 'circle' ? { center: 'circle' } : {}), ...(k === 'center' ? { border: 'circle' } : {}) }).replace(/viewBox="[^"]*"/, (m) => (ZOOM[k] ? `viewBox="${ZOOM[k]}"` : m))}${k === 'frame' ? `<span>${label}</span>` : ''}</button>`;
    const color = (name, label) => `<label>${label}<span class="bp-color"><input name="${name}" maxlength="7" spellcheck="false"><input type="color" data-for="${name}" aria-label="${label}"></span></label>`;
    const rim = (k, title) => `<h3 class="bp-h3">${title}</h3><label>${title} text<input name="qr_${k}Text" maxlength="40" placeholder="Scan me"></label>
<div class="bp-two"><label>Font family<select name="qr_${k}Font">${V.qrFonts.map((n) => `<option>${n}</option>`).join('')}</select></label>${color(`qr_${k}Color`, 'Color')}</div>`;
    const admin = ['owner', 'admin'].includes(role());
    const range = (k) => `<div class="bp-range"><input type="range" name="${k}" min="0" max="100" step="1"><output data-for="${k}"></output></div>`;
    const sw = (name, title, note) => `<label class="sw-row"><span>${title}<small class="muted">${note}</small></span><input type="checkbox" class="sw" name="${name}"><i></i></label>`;
    main.innerHTML = `<div class="head"><div><h1>Business Page</h1><p class="sub">The page people see when they scan your QR code: your details, links and a Save contact button. Your page: <a href="${esc(V.url)}" target="_blank" rel="noopener">${esc(V.url.replace(/^https?:\/\//, ''))}</a></p></div></div>
<div class="bp-tabs" role="tablist">${BP_TABS.map(([t, n], i) => `<button type="button" role="tab" data-act="bpTab" data-tab="${t}" class="${i ? '' : 'on'}">${n}</button>`).join('')}</div>
<div class="bp-edit">${BP_TABS.map(([t, , secs], ti) => `<nav class="bp-nav" data-tab="${t}" ${ti ? 'hidden' : ''}>${secs.map(([k, n], i) => `<button type="button" data-act="bpSec" data-sec="${k}" class="${i || ti ? '' : 'on'}">${n}</button>`).join('')}</nav>`).join('')}
<form class="card bp-form" id="bpForm" novalidate><fieldset class="bp-fs" ${admin ? '' : 'disabled'}>
<section data-sec="info"><h2>Your information</h2>
<span class="bp-lbl">Company logo</span><div class="bp-img"><span class="bp-thumb round" id="bpLogo"></span><label class="btn alt sm">Browse<input type="file" accept="image/png,image/jpeg,image/webp" hidden id="bpLogoFile"></label>${V.companyLogo ? '<button type="button" class="btn alt sm" data-act="bpLogo" data-v="company">Use company logo</button>' : ''}<button type="button" class="link-btn danger" data-act="bpLogo" data-v="">Remove</button></div>
<span class="bp-lbl">Logo opacity</span>${range('logoOpacity')}
<label>Company name<input name="name" maxlength="100" required></label>
<label>Company description<textarea name="description" rows="3" maxlength="500" placeholder="What you do, in a sentence or two"></textarea></label>
<div class="bp-two"><label>Email address<input name="email" type="email" maxlength="120"></label><label>Website<input name="website" maxlength="300" placeholder="yourbusiness.com"></label></div>
<div class="bp-two"><label>Company phone<input name="phone" type="tel" maxlength="40"></label><label>Address<input name="address" maxlength="300" placeholder="Leave empty to keep it off the page"></label></div></section>
<section data-sec="styles" hidden><h2>Styles</h2>
<span class="bp-lbl">Sample cover images</span><div class="bp-covers">${Object.entries(V.covers).map(([k, css]) => `<button type="button" class="bp-cov" data-act="bpCover" data-c="${k}" style="background:${esc(css)}" aria-label="Cover ${k}"></button>`).join('')}<label class="bp-cov bp-cov-up" title="Your own image"><span id="bpCoverUp">+</span><input type="file" accept="image/png,image/jpeg,image/webp" hidden id="bpCoverFile"></label></div>
<span class="bp-lbl">Cover opacity</span>${range('coverOpacity')}
<div class="bp-colors">${BP_COLORS.map(([k, n]) => `<label>${n}<span class="bp-color"><input name="${k}" maxlength="7" spellcheck="false"><input type="color" data-for="${k}" aria-label="${n}"></span></label>`).join('')}</div>
${sw('showLabels', 'Show icon labels', 'Names under the Phone, Email and Website buttons.')}</section>
<section data-sec="links" hidden><h2>Links</h2><p class="muted bp-note">Add your social media and other pages. For most networks you can enter just your handle, like @yourbusiness.</p>
<div id="bpLinks"></div><select id="bpAdd" aria-label="Add another network"></select><div class="bp-cbox" id="bpCustomBox" hidden></div><button type="button" class="bp-addcustom" id="bpAddCustom" data-act="bpCustom">+ Add custom link</button></section>
<section data-sec="exchange" hidden><h2>Exchange contact</h2>${sw('exchange', 'Show a contact form', 'People can leave their name, email, phone and a message. Each one comes to you as a new request, and the person is added to your clients.')}</section>
<section data-sec="usage" hidden><h2>Usage limits</h2><p class="muted bp-note">Control how many times your QR code can be scanned and how long it keeps working. The link itself (${esc(V.url.replace(/^https?:\/\//, ''))}) always works.</p>
${sw('scanOn', 'Scan limit', 'The QR code stops working after this many scans.')}<label class="bp-sub">Number of scans<input name="scanMax" type="number" min="1" max="10000000" step="1"></label>
${sw('expOn', 'Expiry', 'After this date, scanning the QR code shows an “expired” page instead of your business page.')}<label class="bp-sub">Last day it works<input name="expDate" type="date"></label>
<p class="muted bp-note">Scanned ${V.scans.toLocaleString('en-US')} time${V.scans === 1 ? '' : 's'} so far.${V.scans && admin ? ' <button type="button" class="link-btn" data-act="bpResetScans">Reset the count</button>' : ''}</p></section>
<section data-sec="qrcolor" hidden><h2>Color</h2><div class="bp-stack">${QR_COLORS.map(([k, n]) => color('qr_' + k, n)).join('')}</div>
<p class="muted bp-note">Keep the dots much darker than the background, or phones may not be able to read the code.</p></section>
<section data-sec="qrshape" hidden><h2>Shape &amp; form</h2>
<span class="bp-lbl">QR shape</span><div class="bp-opts">${opt('shape', 'square', 'Square')}${opt('shape', 'rounded', 'Rounded')}${opt('shape', 'circle', 'Circle')}</div>
<span class="bp-lbl">Dots</span><div class="bp-opts">${opt('dot', 'square', 'Squares')}${opt('dot', 'rounded', 'Rounded')}${opt('dot', 'dots', 'Dots')}${opt('dot', 'diamond', 'Diamonds')}${opt('dot', 'vertical', 'Vertical lines')}${opt('dot', 'horizontal', 'Horizontal lines')}</div>
<span class="bp-lbl">Marker border</span><div class="bp-opts">${opt('border', 'square', 'Square')}${opt('border', 'rounded', 'Rounded')}${opt('border', 'circle', 'Circle')}</div>
<span class="bp-lbl">Marker center</span><div class="bp-opts">${opt('center', 'square', 'Square')}${opt('center', 'circle', 'Circle')}</div>
<span class="bp-lbl">Border and frame</span><div class="bp-opts wide">${opt('frame', 'none', 'None')}${opt('frame', 'border', 'Border')}${opt('frame', 'frame', 'Frame')}</div></section>
<section data-sec="qrlogo" hidden><h2>Logo</h2><span class="bp-lbl">Upload image</span><div class="bp-img"><span class="bp-thumb" id="bpQrLogo"></span><label class="btn alt sm">Browse<input type="file" accept="image/png,image/jpeg,image/webp" hidden id="bpQrLogoFile"></label></div>
<span class="bp-lbl">Or use one of these</span><div class="bp-logos"><button type="button" class="bp-lg" data-act="bpQrLogo" data-v="" title="No logo" aria-label="No logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg></button>${V.qrLogos.filter((k) => k !== 'company' || V.companyLogo).map((k) => `<button type="button" class="bp-lg" data-act="bpQrLogo" data-v="${k}" title="${k === 'company' ? 'Company logo' : esc(k)}" aria-label="${k === 'company' ? 'Company logo' : esc(k)}"><img src="${esc(qrLogoHref(k, V.companyLogo))}" alt=""></button>`).join('')}</div>
${sw('qr_logoClear', 'Remove dots behind the logo', 'Clears the dots under the logo so it stands out. The code still scans.')}</section>
<section data-sec="qrbg" hidden><h2>Page background</h2><p class="muted bp-note">A picture behind your QR code and its text. The code itself keeps its background color so it stays readable.</p>
<span class="bp-lbl">Upload image</span><div class="bp-img"><span class="bp-thumb" id="bpQrBg"></span><label class="btn alt sm">Browse<input type="file" accept="image/png,image/jpeg,image/webp" hidden id="bpQrBgFile"></label><button type="button" class="link-btn danger" data-act="bpQrBgNone">Remove</button></div>
<span class="bp-lbl">Transparency</span>${range('qr_bgOpacity')}</section>
<section data-sec="qrrim" hidden><h2>Rim content</h2><p class="muted bp-note">Text above and below your QR code, like “Scan me” or your business name.</p>${rim('header', 'Header')}${rim('footer', 'Footer')}</section>
<div class="bp-foot"><button type="button" class="btn alt" data-act="bpStep" data-d="-1" id="bpPrevBtn">← Previous</button><span class="bp-gap"></span><a class="btn alt" href="${esc(V.url)}?preview=1">View page</a><button type="button" class="btn alt" data-act="bpStep" data-d="1" id="bpNextBtn">Next →</button>${admin ? '<button class="btn" id="bpSave">Save changes</button>' : ''}</div>
${admin ? '' : '<p class="muted" style="font-size:13px">Only the account owner or an admin can change the business page.</p>'}
</fieldset></form>
<div class="bp-phone" id="bpPhone"><iframe id="bpPrev" title="Preview of your business page" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe></div>
<div class="bp-qrbox" id="bpQrBox" hidden><div class="bp-qrimg" id="bpQr"></div><div class="bp-qr-acts"><button type="button" class="btn alt sm" data-act="bpQrDownload">Download</button><button type="button" class="btn alt sm" data-act="bpQrCopy">Copy link</button></div><p class="muted">Saved changes apply to your QR code everywhere it’s shown. Codes you’ve already printed keep working.</p></div></div>`;
    const f = $('#bpForm');
    // the form shows bp.page; every change goes back into it and refreshes the preview
    for (const k of ['name', 'description', 'email', 'website', 'phone', 'address', 'logoOpacity', 'coverOpacity', ...BP_COLORS.map(([c]) => c)]) f.elements[k].value = P[k] ?? '';
    f.showLabels.checked = P.showLabels; f.exchange.checked = P.exchange;
    f.scanOn.checked = P.scanLimit.on; f.scanMax.value = P.scanLimit.max; f.expOn.checked = P.expiry.on; f.expDate.value = P.expiry.date;
    QR_COLORS.forEach(([k]) => { f.elements['qr_' + k].value = Q[k]; });
    f.qr_logoClear.checked = Q.logoClear; f.qr_bgOpacity.value = Q.bgOpacity;
    for (const k of ['header', 'footer']) { f.elements[`qr_${k}Text`].value = Q[k].text; f.elements[`qr_${k}Font`].value = Q[k].font; f.elements[`qr_${k}Color`].value = Q[k].color; }
    $$('input[type=color][data-for]', f).forEach((c) => { const v = f.elements[c.dataset.for].value; if (/^#[0-9a-f]{6}$/i.test(v)) c.value = v.toLowerCase(); });
    const read = () => {
      QR_COLORS.forEach(([k]) => { Q[k] = f.elements['qr_' + k].value.trim(); });
      Q.logoClear = f.qr_logoClear.checked; Q.bgOpacity = +f.qr_bgOpacity.value;
      for (const k of ['header', 'footer']) Q[k] = { text: f.elements[`qr_${k}Text`].value, font: f.elements[`qr_${k}Font`].value, color: f.elements[`qr_${k}Color`].value.trim() };
      for (const k of ['name', 'description', 'email', 'website', 'phone', 'address']) P[k] = f.elements[k].value;
      P.logoOpacity = +f.logoOpacity.value; P.coverOpacity = +f.coverOpacity.value;
      BP_COLORS.forEach(([k]) => { P[k] = f.elements[k].value.trim(); });
      P.showLabels = f.showLabels.checked; P.exchange = f.exchange.checked;
      P.scanLimit = { on: f.scanOn.checked, max: +f.scanMax.value || 100 }; P.expiry = { on: f.expOn.checked, date: f.expDate.value };
      $$('#bpLinks .bp-link').forEach((row, i) => { P.links[i].url = $('[data-f=url]', row).value; });
      bpDraw(); bpPreview();
    };
    // a color picker fills in its hex box, and a valid hex code moves the picker
    f.addEventListener('input', (e) => {
      if (e.target.type === 'color') f.elements[e.target.dataset.for].value = e.target.value.toUpperCase();
      else { const pick = e.target.name && $(`input[type=color][data-for="${e.target.name}"]`, f); if (pick && /^#[0-9a-f]{6}$/i.test(e.target.value)) pick.value = e.target.value.toLowerCase(); }
      if (e.target.type !== 'file') read();
    });
    f.addEventListener('change', (e) => { if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') read(); });
    $('#bpQrLogoFile').addEventListener('change', async (e) => { const file = e.target.files[0]; e.target.value = ''; if (!file) return; try { Q.logo = await toPng(await readFileAsDataUrl(file), 300); read(); } catch (x) { toast('Couldn’t read that image', true); } });
    $('#bpQrBgFile').addEventListener('change', async (e) => { const file = e.target.files[0]; e.target.value = ''; if (!file) return; try { Q.bgImg = await toJpeg(await readFileAsDataUrl(file), 1200); read(); } catch (x) { toast('Couldn’t read that image', true); } });
    $('#bpLogoFile').addEventListener('change', async (e) => { const file = e.target.files[0]; e.target.value = ''; if (!file) return; try { P.logo = await toPng(await readFileAsDataUrl(file), 400); read(); } catch (x) { toast('Couldn’t read that image', true); } });
    $('#bpCoverFile').addEventListener('change', async (e) => { const file = e.target.files[0]; e.target.value = ''; if (!file) return; try { P.cover = await toJpeg(await readFileAsDataUrl(file), 1200); read(); } catch (x) { toast('Couldn’t read that image', true); } });
    $('#bpAdd').addEventListener('change', (e) => { if (!e.target.value) return; P.links.push({ kind: e.target.value, url: '' }); bpLinks(); const ins = $$('#bpLinks [data-f=url]'); ins[ins.length - 1].focus(); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); read(); const btn = $('#bpSave'); btn.disabled = true;
      try { const r = await api('PUT', '/api/business-page', P); bp.V = r; Object.assign(P, { logo: r.page.logo, cover: r.page.cover, links: bpWithDefaults(r.page.links.map((l) => ({ ...l }))) }); Object.assign(Q, { logo: r.page.qr.logo, bgImg: r.page.qr.bgImg }); bpLinks(); bpDraw(); toast('Business page saved'); }
      catch (x) { toast(x.message, true); } finally { btn.disabled = false; }
    });
    bpLinks(); bpDraw(); bpPreview(); bpGo('info');
  },
};
let bpAt = 'info'; // the section showing
// shows a section: its tab, its place in the left menu, the phone (Business details) or the QR code (QR code appearance), and Previous / Next
function bpGo(sec) {
  bpAt = sec; const tab = BP_ORDER.find(([k]) => k === sec)[1]; const i = BP_ORDER.findIndex(([k]) => k === sec);
  $$('.bp-tabs button').forEach((b) => { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-selected', b.dataset.tab === tab); });
  $$('.bp-nav').forEach((n) => { n.hidden = n.dataset.tab !== tab; }); $$('.bp-nav button').forEach((b) => b.classList.toggle('on', b.dataset.sec === sec));
  $$('#bpForm section').forEach((s) => { s.hidden = s.dataset.sec !== sec; });
  $('#bpPhone').hidden = tab !== 'details'; $('#bpQrBox').hidden = tab !== 'qr';
  $('#bpPrevBtn').disabled = i === 0; $('#bpNextBtn').hidden = i === BP_ORDER.length - 1;
  $('#bpNextBtn').textContent = BP_ORDER[i + 1] && BP_ORDER[i + 1][1] !== tab ? 'Next: QR code appearance →' : 'Next →';
}
// the parts of the form drawn from bp.page: the logo, the chosen cover, the opacity numbers
function bpDraw() {
  const P = bp.page; const logo = P.logo === 'company' ? bp.V.companyLogo : P.logo;
  const box = $('#bpLogo'); if (!box) return; box.style.backgroundImage = logo ? `url("${logo}")` : ''; box.textContent = logo ? '' : '—';
  $$('.bp-cov[data-c]').forEach((b) => b.classList.toggle('on', b.dataset.c === P.cover));
  const own = !bp.V.covers[P.cover]; const up = $('#bpCoverUp').parentElement; up.classList.toggle('on', own); up.style.background = own ? `url("${P.cover}") center/cover` : ''; $('#bpCoverUp').textContent = own ? '' : '+';
  $$('.bp-range output').forEach((o) => { o.textContent = `${o.dataset.for === 'qr_bgOpacity' ? P.qr.bgOpacity : P[o.dataset.for]}%`; });
  // QR code appearance: the chosen options and logo, the pictures, and the code itself
  const Q = P.qr; const thumb = (id, u) => { const t = $(id); t.style.backgroundImage = u ? `url("${u}")` : ''; t.textContent = u ? '' : '—'; };
  $$('.bp-opt').forEach((b) => b.classList.toggle('on', Q[b.dataset.k] === b.dataset.v));
  $$('.bp-lg').forEach((b) => b.classList.toggle('on', (Q.logo || '') === b.dataset.v));
  thumb('#bpQrLogo', /^(data:|\/uploads\/)/.test(Q.logo || '') ? Q.logo : ''); thumb('#bpQrBg', Q.bgImg);
  $('#bpQr').innerHTML = qrStyled(bp.V.url + '?qr=1', qrStyleFor(Q, bp.V.companyLogo)) || '<p class="muted">Check the colors: each one needs a hex code like #1A2B3C.</p>';
}
// the Links list: one row per link, in the order they show on the page. X, Instagram, Facebook, LinkedIn and YouTube always have a row
// (an empty one isn't saved); rows move by dragging the dotted handle, like line items on quotes and invoices
const BP_DEFAULT_LINKS = ['x', 'instagram', 'facebook', 'linkedin', 'youtube'];
const BP_EXAMPLE = { facebook: 'https://www.facebook.com/yourbusiness', linkedin: 'https://www.linkedin.com/company/yourbusiness', google: 'Link to your Google reviews', yelp: 'https://www.yelp.com/biz/yourbusiness', nextdoor: 'Link to your Nextdoor page' };
const bpWithDefaults = (links) => [...links, ...BP_DEFAULT_LINKS.filter((k) => !links.some((l) => l.kind === k)).map((kind) => ({ kind, url: '' }))];
const bpIcon = (k, size = 20) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(bp.V.icons[k] || bp.V.icons.link).svg}</svg>`;
const BP_TRASH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
function bpLinks() {
  const P = bp.page; const N = bp.V.networks; const used = P.links.map((l) => l.kind);
  const more = Object.entries(N).filter(([k]) => !used.includes(k));
  $('#bpAdd').hidden = !more.length; $('#bpAdd').innerHTML = `<option value="">+ Add another network…</option>${more.map(([k, n]) => `<option value="${k}">${esc(n.name)}</option>`).join('')}`;
  $('#bpLinks').innerHTML = P.links.map((l, i) => {
    const custom = l.kind === 'custom'; const name = custom ? l.label : N[l.kind].name;
    const label = custom ? `<button type="button" class="bp-lname edit" data-act="bpCustom" data-i="${i}" title="Change the name or icon">${bpIcon(l.icon || 'link')}<span>${esc(name)}</span></button>` : `<span class="bp-lname">${bpIcon(l.kind)}<span>${esc(name)}</span></span>`;
    return `<div class="bp-link" data-i="${i}"><button type="button" class="drag-h bp-drag" aria-label="Drag to reorder (or use the arrow keys)" title="Drag to reorder">${DRAG_DOTS}</button>
<div class="bp-lbox">${label}<input data-f="url" maxlength="300" aria-label="${esc(name)} link" placeholder="${custom ? 'https://' : esc(BP_EXAMPLE[l.kind] || (N[l.kind].handle ? 'Eg: @yourbusiness' : 'Link to your page'))}" value="${esc(l.url || '')}"></div>
<button type="button" class="bp-trash" data-act="bpRm" data-i="${i}" title="Remove" aria-label="Remove ${esc(name)}">${BP_TRASH}</button></div>`;
  }).join('');
}
// dragging a row by its handle (mouse or touch), or the arrow keys while the handle has focus; then the links take the rows' new order
const bpReorder = () => { const old = bp.page.links; bp.page.links = $$('#bpLinks .bp-link').map((r) => old[+r.dataset.i]); bpLinks(); bpPreview(); };
document.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('.bp-link .bp-drag'); if (!h || e.button !== 0) return;
  e.preventDefault(); const row = h.closest('.bp-link'); const list = row.parentElement; const start = row.nextElementSibling;
  row.classList.add('dragging'); document.body.classList.add('row-drag'); // listened for on the window: moving the row would drop a pointer capture on the handle
  const move = (ev) => {
    const next = [...list.children].filter((r) => r !== row).find((r) => { const b = r.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
    if ((next || null) !== row.nextElementSibling) list.insertBefore(row, next || null);
  };
  const end = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
    row.classList.remove('dragging'); document.body.classList.remove('row-drag');
    if (row.nextElementSibling !== start) bpReorder();
  };
  addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end);
});
document.addEventListener('keydown', (e) => {
  const h = e.target.closest('.bp-link .bp-drag'); if (!h || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault(); const row = h.closest('.bp-link'); const other = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling; if (!other) return;
  if (e.key === 'ArrowUp') other.before(row); else other.after(row);
  const at = [...row.parentElement.children].indexOf(row); bpReorder(); $$('#bpLinks .bp-drag')[at].focus();
});
A.bpRm = (d) => { bp.page.links.splice(+d.i, 1); bpLinks(); bpPreview(); };
// + Add custom link, or a custom link's name clicked: its name, address and icon (searchable), saved into the list
let bpEdit = null; // { i (the link's place, or -1 for a new one), icon }
A.bpCustom = (d) => {
  const i = d.i === undefined ? -1 : +d.i; const l = i >= 0 ? bp.page.links[i] : { label: '', url: '', icon: '' }; bpEdit = { i, icon: l.icon || '' };
  const box = $('#bpCustomBox'); box.hidden = false; $('#bpAddCustom').hidden = true;
  box.innerHTML = `<div class="bp-two"><label>Name<input id="bpCName" maxlength="40" placeholder="Enter name, like Our menu" value="${esc(l.label)}"></label><label>URL<input id="bpCUrl" maxlength="300" placeholder="Enter URL" value="${esc(l.url)}"></label></div>
<span class="bp-lbl">Icon</span><button type="button" class="bp-ipick" data-act="bpIconOpen" aria-expanded="false"><span id="bpCIcon"></span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
<div class="bp-ipop" id="bpIPop" hidden><input type="search" id="bpISearch" placeholder="Search for an icon" aria-label="Search for an icon"><div class="bp-igrid" id="bpIGrid"></div></div>
<div class="bp-cfoot"><button type="button" class="btn alt" data-act="bpCustomCancel">Cancel</button><button type="button" class="btn" data-act="bpCustomSave" id="bpCSave">Save</button></div>`;
  const ok = () => { $('#bpCSave').disabled = !$('#bpCName').value.trim() || !$('#bpCUrl').value.trim(); };
  ['#bpCName', '#bpCUrl'].forEach((s) => { $(s).addEventListener('input', (e) => { e.stopPropagation(); ok(); }); $(s).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!$('#bpCSave').disabled) A.bpCustomSave(); } }); });
  $('#bpISearch').addEventListener('input', (e) => { e.stopPropagation(); bpIconGrid(); });
  $('#bpISearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
  bpIconChosen(); ok(); $('#bpCName').focus();
};
function bpIconChosen() { const k = bpEdit.icon; $('#bpCIcon').innerHTML = k ? `${bpIcon(k)}<span>${esc(bp.V.icons[k].name.split(' ')[0])}</span>` : `${bpIcon('website')}<span class="muted">Select an icon (optional)</span>`; }
function bpIconGrid() {
  const q = $('#bpISearch').value.trim().toLowerCase();
  $('#bpIGrid').innerHTML = Object.entries(bp.V.icons).filter(([k, x]) => !q || x.name.toLowerCase().includes(q) || k.includes(q))
    .map(([k, x]) => `<button type="button" class="bp-ic${k === bpEdit.icon ? ' on' : ''}" data-act="bpIconPick" data-k="${k}" title="${esc(x.name.split(' ')[0])}" aria-label="${esc(x.name.split(' ')[0])}">${bpIcon(k, 22)}</button>`).join('') || '<p class="muted" style="margin:6px">No icons match.</p>';
}
A.bpIconOpen = (d, el) => { const pop = $('#bpIPop'); pop.hidden = !pop.hidden; el.setAttribute('aria-expanded', !pop.hidden); if (!pop.hidden) { bpIconGrid(); $('#bpISearch').focus(); } };
A.bpIconPick = (d) => { bpEdit.icon = bpEdit.icon === d.k ? '' : d.k; $('#bpIPop').hidden = true; bpIconChosen(); };
A.bpCustomCancel = () => { bpEdit = null; $('#bpCustomBox').hidden = true; $('#bpAddCustom').hidden = false; };
A.bpCustomSave = () => {
  const l = { kind: 'custom', label: $('#bpCName').value.trim(), url: $('#bpCUrl').value.trim(), ...(bpEdit.icon ? { icon: bpEdit.icon } : {}) };
  if (bpEdit.i >= 0) bp.page.links[bpEdit.i] = l; else bp.page.links.push(l);
  A.bpCustomCancel(); bpLinks(); bpPreview();
};
let bpTimer = 0;
function bpPreview() {
  clearTimeout(bpTimer);
  bpTimer = setTimeout(async () => {
    const P = bp.page; const frame = $('#bpPrev'); if (!frame) return;
    try { const r = await api('POST', '/api/business-page/preview', { ...P, logo: P.logo === 'company' ? bp.V.companyLogo : P.logo }); if (r.html) frame.srcdoc = r.html; } catch (x) { /* keep the last preview */ }
  }, 250);
}
A.bpSec = (d) => bpGo(d.sec);
A.bpTab = (d) => bpGo(BP_TABS.find(([t]) => t === d.tab)[2][0][0]);
A.bpStep = (d) => { const i = BP_ORDER.findIndex(([k]) => k === bpAt) + Number(d.d); if (BP_ORDER[i]) { bpGo(BP_ORDER[i][0]); window.scrollTo(0, 0); } };
A.bpQrOpt = (d) => { bp.page.qr[d.k] = d.v; if (d.k === 'border' && d.v === 'circle') bp.page.qr.center = 'circle'; bpDraw(); };
A.bpQrLogo = (d) => { bp.page.qr.logo = d.v; bpDraw(); };
A.bpQrBgNone = () => { bp.page.qr.bgImg = ''; bpDraw(); };
A.bpQrDownload = async () => {
  try { const png = await qrStyledPng(bp.V.url + '?qr=1', await qrInline(qrStyleFor(bp.page.qr, bp.V.companyLogo)));
    const a = document.createElement('a'); a.href = png; a.download = `${(bp.page.name || 'qr-code').replace(/[^\w-]+/g, '-').toLowerCase()}-qr.png`; a.click(); } catch (x) { toast('Couldn’t make the image. Try again.', true); }
};
A.bpQrCopy = async () => { await navigator.clipboard.writeText(bp.V.url); toast('Link copied'); };
A.bpCover = (d) => { bp.page.cover = d.c; bpDraw(); bpPreview(); };
A.bpLogo = (d) => { bp.page.logo = d.v === 'company' ? bp.V.companyLogo : ''; bpDraw(); bpPreview(); };
A.bpRm = (d) => { bp.page.links.splice(+d.i, 1); bpLinks(); bpPreview(); };
A.bpResetScans = async () => {
  if (!confirm('Reset the scan count to 0? If a scan limit is on, the QR code works again until it reaches the limit.')) return;
  try { bp.V = await api('PUT', '/api/business-page', { ...bp.page, resetScans: true }); toast('Scan count reset'); refresh(); } catch (x) { toast(x.message, true); }
};
/* ===== /marketplace: App Marketplace (lib/marketplace.js) ===== */
// apps that connect today open the page they're set up on; the rest take "I want this", which Alpha counts
CONN_ICONS.claude = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#D97757"/><path stroke="#fff" stroke-width="3.4" stroke-linecap="round" d="M24 12v24M12 24h24M15.5 15.5l17 17M32.5 15.5l-17 17"/></svg>';
let MKT = null; const mktView = { cat: '', q: '' };
const mktLogo = (a) => (a.icon && CONN_ICONS[a.icon] ? `<span class="mkt-logo">${CONN_ICONS[a.icon]}</span>` : `<span class="mkt-logo mono" style="background:${esc(a.bg)};color:${esc(a.fg)}${a.mono.length > 2 ? ';font-size:13px' : ''}">${esc(a.mono)}</span>`);
function mktState(a) {
  if (!a.live) return a.requested ? { chip: connChip('wait', 'Requested'), btn: `<button type="button" class="btn alt sm" data-act="mktWant" data-id="${a.id}" data-on="" aria-pressed="true">✓ Requested</button>` }
    : { chip: connChip('off', 'Coming soon'), btn: `<button type="button" class="btn sm" data-act="mktWant" data-id="${a.id}" data-on="1">I want this</button>` };
  // Home Depot is set up in a popup here; the others on their own page
  const go = (label, cls) => (a.id === 'homedepot' ? `<button type="button" class="btn ${cls} sm" data-act="hdManage">${label}</button>` : `<a class="btn ${cls} sm" href="${esc(a.go)}" data-link>${label}</a>`);
  if (!a.planOk) return { chip: connChip('off', 'Not in your plan'), btn: role() === 'owner' ? '<a class="btn alt sm" href="/settings/billing" data-link>See plans</a>' : '' };
  if (a.connected) return { chip: connChip('on', a.id === 'claude' ? 'On' : 'Connected'), btn: go('Manage', 'alt') };
  if (!a.available) return { chip: connChip('off', 'Not available yet'), btn: '' };
  return { chip: connChip('off', 'Not connected'), btn: go('Connect', '') };
}
const mktCard = (a) => { const s = mktState(a);
  return `<article class="mkt-card"><button type="button" class="mkt-open" data-act="mktApp" data-id="${a.id}" aria-label="About ${esc(a.name)}"></button>${mktLogo(a)}
<div class="mkt-txt"><h3>${esc(a.name)}</h3><span class="mkt-cat">${esc(a.category)}</span></div><p>${esc(a.tagline)}</p><div class="mkt-foot">${s.chip}${s.btn}</div></article>`; };
function mktList() {
  const q = mktView.q.trim().toLowerCase(); const c = mktView.cat;
  const hit = (a) => !q || `${a.name} ${a.category} ${a.tagline} ${a.about}`.toLowerCase().includes(q);
  const pick = MKT.apps.filter((a) => hit(a) && (!c || (c === 'connected' ? a.live && a.connected && a.planOk : a.category === c)));
  if (!pick.length) return `<div class="empty">No apps match${q ? ` “${esc(mktView.q.trim())}”` : ''}. <button type="button" class="link-btn" data-act="mktSuggest">Suggest an app</button></div>`;
  const grid = (list) => `<div class="mkt-grid">${list.map(mktCard).join('')}</div>`;
  if (q || c) return grid(pick);
  // everything: the featured apps, then each category
  return `<h2 class="mkt-h">Featured</h2>${grid(pick.filter((a) => a.featured))}` + MKT.categories.map((k) => { const L = pick.filter((a) => a.category === k); return L.length ? `<h2 class="mkt-h">${esc(k)}</h2>${grid(L)}` : ''; }).join('');
}
const mktShow = () => { const box = $('#mktList'); if (box) box.innerHTML = mktList(); $$('.mkt-tabs button').forEach((b) => { const on = b.dataset.cat === mktView.cat; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); };
PAGES['/marketplace'] = {
  title: 'App Marketplace',
  async render(main) {
    if (!marketplaceOn()) { main.innerHTML = '<div class="head"><div><h1>App Marketplace</h1></div></div><div class="card empty">The App Marketplace isn’t available right now.</div>'; return; }
    MKT = await api('GET', '/api/marketplace');
    const tabs = [['', 'All apps'], ...(MKT.apps.some((a) => a.live && a.connected && a.planOk) ? [['connected', 'Connected']] : []), ...MKT.categories.map((k) => [k, k])];
    main.innerHTML = `<div class="head"><div><h1>App Marketplace</h1><p class="sub">Connect the apps your business already uses. Apps marked <strong>Coming soon</strong> are on the way: tap <strong>I want this</strong> and the most-wanted ones are built first.</p></div>
<button type="button" class="btn alt" data-act="mktSuggest">Suggest an app</button></div>
<div class="cfilters"><div class="search-x"><input id="mq" type="search" placeholder="Search apps" value="${esc(mktView.q)}" aria-label="Search apps"><button type="button" class="icon-btn" data-act="mktClear" aria-label="Clear search" ${mktView.q ? '' : 'hidden'}>✕</button></div></div>
<div class="tabs mkt-tabs" role="group" aria-label="Categories">${tabs.map(([k, l]) => `<button type="button" data-act="mktCat" data-cat="${esc(k)}">${esc(l)}</button>`).join('')}</div>
<div id="mktList"></div>`;
    if (!tabs.some(([k]) => k === mktView.cat)) mktView.cat = '';
    mktShow();
    $('#mq').addEventListener('input', (e) => { mktView.q = e.target.value; $('[data-act="mktClear"]').hidden = !mktView.q; mktShow(); });
  },
};
A.mktCat = (d) => { mktView.cat = d.cat; mktShow(); };
A.mktClear = () => { mktView.q = ''; const q = $('#mq'); q.value = ''; $('[data-act="mktClear"]').hidden = true; mktShow(); q.focus(); };
// an app's details: what it is, what connecting it does, and its button
A.mktApp = (d) => {
  const a = MKT.apps.find((x) => x.id === d.id); if (!a) return; const s = mktState(a);
  modal(a.name, `<div class="mkt-det">${mktLogo(a)}<div><span class="mkt-cat">${esc(a.category)}</span><div style="margin-top:6px">${s.chip}</div></div></div>
<p>${esc(a.about)}</p><p style="margin-bottom:6px"><strong>${a.live ? 'What you can do' : 'When it’s ready, you’ll be able to'}</strong></p><ul class="mkt-does">${a.does.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
${a.live ? '' : '<p class="muted" style="font-size:13px">This connection isn’t built yet. Tap <strong>I want this</strong> to vote for it.</p>'}
<div class="foot"><a class="btn alt" href="${esc(a.site)}" target="_blank" rel="noopener">Visit website ↗</a>${s.btn.replace(' sm"', '"')}</div>`);
};
A.mktWant = async (d, el) => {
  const on = !!d.on; el.disabled = true;
  try {
    MKT = await api('POST', `/api/marketplace/${encodeURIComponent(d.id)}/request`, { on }); const a = MKT.apps.find((x) => x.id === d.id);
    toast(on ? `Thanks! We’ve noted that you want ${a.name}. The most-wanted apps are built first.` : `Request for ${a.name} removed`);
    if ($('#overlay')) A.mktApp(d); mktShow();
  } catch (e) { el.disabled = false; toast(e.message, true); }
};
// Home Depot: on or off, the ZIP code for local prices, and the markup added to a price picked in the product form
A.hdManage = async () => {
  const H = await api('GET', '/api/home-depot');
  const mb = modal('The Home Depot', `<form id="hdForm"><p class="muted" style="margin-top:0">Search Home Depot from the product and service form, and fill in an item’s price from it.</p>
<label class="sw-row"><span>Search Home Depot when adding products and services<small class="muted">Adds a Search Home Depot button to the form.</small></span><input type="checkbox" class="sw" name="on" ${H.on ? 'checked' : ''}><i></i></label>
<div class="row"><label>ZIP code <span class="muted">(optional)</span><input name="zip" inputmode="numeric" maxlength="5" pattern="\\d{5}" value="${esc(H.zip)}" placeholder="For local prices"></label>
<label>Markup (%)<input name="markup" type="number" min="0" max="500" step="0.1" value="${H.markup}"></label></div>
<p class="muted" style="font-size:13px">The markup is added to the Home Depot price when you pick a product. With 20%, a $10.00 item is priced at $12.00. Prices are the ones shown on homedepot.com, not your Pro Xtra pricing, and can change.</p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  const f = $('#hdForm', mb);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(f)); const btn = $('button.btn:not(.alt)', f); btn.disabled = true;
    try { const r = await api('PUT', '/api/home-depot', { on: !!b.on, zip: b.zip, markup: b.markup }); closeModal(); toast(r.on ? 'Home Depot is on. Search it from the product and service form.' : 'Home Depot is off');
      if ($('#mktList')) { MKT = await api('GET', '/api/marketplace'); mktShow(); } } catch (err) { btn.disabled = false; toast(err.message, true); }
  });
};
A.mktSuggest = () => {
  const mb = modal('Suggest an app', `<form id="mktSugForm"><p class="muted" style="margin-top:0">Don’t see an app you use? Tell us, and what you’d like it to do here.</p>
<label>App name<input name="app" required maxlength="80" placeholder="e.g. Jobsite supplier, CRM or accounting app"></label>
<label>What would you use it for? <span class="muted">(optional)</span><textarea name="note" rows="4" maxlength="1000"></textarea></label>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Send suggestion</button></div></form>`);
  const f = $('#mktSugForm', mb); $('input', f).focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('button.btn:not(.alt)', f); btn.disabled = true;
    try { await api('POST', '/api/marketplace/suggest', Object.fromEntries(new FormData(f))); closeModal(); toast('Thanks! Your suggestion was sent.'); } catch (err) { btn.disabled = false; toast(err.message, true); }
  });
};
/* ===== /clients/import ===== */
// CSV parser: quoted fields, embedded commas/newlines, "" escapes, BOM; detects comma, semicolon or tab
function parseCsv(text) {
  text = text.replace(/^﻿/, ''); const first = text.split(/\r?\n/)[0] || '';
  const delim = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
const IMPORT_FIELDS = [['', "Don't import"], ['name', 'Full name'], ['first', 'First name'], ['last', 'Last name'], ['company', 'Company'], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Full address'], ['street', 'Street'], ['street2', 'Street line 2'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP / postal code'], ['notes', 'Notes']];
const IMPORT_GUESS = [ // checked in order; first matching column wins each field
  ['email', /e-?mail/], ['phone', /phone|mobile|cell|tel/], ['first', /^(first|given)( ?name)?$/], ['last', /^(last|family)( ?name)?$|^surname$/],
  ['company', /company|business|organi[sz]ation/], ['street2', /(address|street).*(2|line 2)|^(apt|suite|unit)/], ['zip', /zip|postal|postcode/],
  ['city', /city|town/], ['state', /state|province|region/], ['address', /formatted|full address|^address$|^service address|^billing address$/],
  ['street', /street|address( line)? ?1/], ['notes', /note|comment/], ['name', /^(full ?name|name|display ?name|(client|customer|contact)( ?name)?)$/],
];
function guessMapping(headers) {
  const map = headers.map(() => ''); const used = new Set();
  const usable = (h) => !/label|type$/.test(h); // Google Contacts has "E-mail 1 - Label" next to "E-mail 1 - Value"
  IMPORT_GUESS.forEach(([field, re]) => {
    const i = headers.findIndex((h, k) => !map[k] && usable(h.trim().toLowerCase()) && re.test(h.trim().toLowerCase()));
    if (i >= 0 && !used.has(field)) { map[i] = field; used.add(field); }
  });
  return map;
}
function rowToClient(row, map) {
  const v = {}; map.forEach((field, i) => { if (field && (row[i] || '').trim()) v[field] = (v[field] ? v[field] + ' ' : '') + row[i].trim(); });
  const person = v.name || [v.first, v.last].filter(Boolean).join(' ');
  const cityLine = [v.city, [v.state, v.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return {
    name: person || v.company || '', company: v.company || '', email: (v.email || '').split(/[\s,;]+/)[0], phone: v.phone || '',
    address: (v.address || [v.street, v.street2, cityLine].filter(Boolean).join(', ')).replace(/\s*\n\s*/g, ', '),
    notes: v.notes || '',
  };
}
let importState = null;
PAGES['/clients/import'] = {
  title: 'Import clients',
  async render(main) {
    importState = null;
    main.innerHTML = `<div class="head"><div><a href="/clients" data-link class="back">← Clients</a><h1>Import clients</h1><p class="sub">Add many clients at once from a spreadsheet or contacts export.</p></div></div>
<div class="card"><h2>1. Choose a CSV file</h2>
<p class="muted" style="margin-top:0">Export your list as <strong>CSV</strong> from Excel or Numbers (File → Save As / Export → CSV), Google Sheets (File → Download → CSV), Google Contacts, Outlook or QuickBooks. The first row should be column names. <a href="#" data-act="importTemplate">Download a sample file</a></p>
<input type="file" id="importFile" accept=".csv,.txt,text/csv" style="width:auto"></div>
<div id="importStep"></div>`;
    $('#importFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (/\.(xlsx?|numbers)$/i.test(f.name)) return toast('Save the spreadsheet as CSV first, then choose the .csv file', true);
      const rows = parseCsv(await f.text());
      if (rows.length < 2) return toast('No clients found. The file needs a header row and at least one client row.', true);
      const headers = rows[0]; const width = Math.max(...rows.map((r) => r.length));
      while (headers.length < width) headers.push('Column ' + (headers.length + 1));
      importState = { fileName: f.name, headers, rows: rows.slice(1), map: guessMapping(headers), skipDupes: true };
      renderImportStep();
    });
  },
};
function importPlan() {
  const s = importState; const norm = (x) => String(x || '').trim().toLowerCase(); const digits = (x) => String(x || '').replace(/\D/g, '').slice(-10);
  const seen = { email: new Set(D.clients.map((c) => norm(c.email)).filter(Boolean)), phone: new Set(D.clients.map((c) => digits(c.phone)).filter((p) => p.length === 10)), name: new Set(D.clients.map((c) => norm(c.name))) };
  return s.rows.map((r) => {
    const c = rowToClient(r, s.map); let status = 'new';
    if (!c.name) status = 'noname';
    else if ((c.email && seen.email.has(norm(c.email))) || (digits(c.phone).length === 10 && seen.phone.has(digits(c.phone))) || seen.name.has(norm(c.name))) status = 'dupe';
    if (status !== 'noname') { if (c.email) seen.email.add(norm(c.email)); if (digits(c.phone).length === 10) seen.phone.add(digits(c.phone)); seen.name.add(norm(c.name)); }
    return { c, status };
  });
}
function renderImportStep() {
  const s = importState; const plan = importPlan();
  const willImport = plan.filter((p) => p.status === 'new' || (p.status === 'dupe' && !s.skipDupes));
  const n = (st) => plan.filter((p) => p.status === st).length;
  const hasName = s.map.some((f) => ['name', 'first', 'last', 'company'].includes(f));
  const tag = { new: '<span class="badge approved">new</span>', dupe: `<span class="badge ${s.skipDupes ? 'draft' : 'sent'}">${s.skipDupes ? 'already in list, skip' : 'duplicate'}</span>`, noname: '<span class="badge declined">no name, skip</span>' };
  $('#importStep').innerHTML = `<div class="card"><h2>2. Match the columns</h2><p class="muted" style="margin-top:0">We matched the columns in <strong>${esc(s.fileName)}</strong> automatically. Check them and change any that are wrong.</p>
<div class="tablewrap"><table class="map-tbl m-map"><tr><th>Column in your file</th><th>Example</th><th style="width:220px">Import as</th></tr>
${s.headers.map((h, i) => `<tr><td><strong>${esc(h)}</strong></td><td class="muted">${esc((s.rows.find((r) => (r[i] || '').trim()) || [])[i] || '')}</td><td><select data-map="${i}">${IMPORT_FIELDS.map(([v, l]) => `<option value="${v}" ${s.map[i] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td></tr>`).join('')}</table></div>
${hasName ? '' : '<div class="notice" style="margin-top:12px">Choose which column holds the client name (Full name, First/Last name, or Company).</div>'}</div>
<div class="card"><h2>3. Review and import</h2>
<p><strong>${plan.length}</strong> rows: <strong>${n('new')}</strong> new, <strong>${n('dupe')}</strong> already in your client list or repeated in the file${n('noname') ? `, <strong>${n('noname')}</strong> without a name (skipped)` : ''}.</p>
<div class="chk"><label><input type="checkbox" id="skipDupes" ${s.skipDupes ? 'checked' : ''}> Skip clients already in my list (same email, phone or name)</label></div>
<div class="tablewrap"><table class="m-climp"><tr><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th></th></tr>
${plan.slice(0, 100).map((p) => `<tr><td>${esc(p.c.name) || '<span class="muted">—</span>'}</td><td>${esc(p.c.email)}</td><td>${esc(p.c.phone)}</td><td>${esc(p.c.address)}</td><td>${tag[p.status]}</td></tr>`).join('')}</table></div>
${plan.length > 100 ? `<p class="muted">Showing the first 100 of ${plan.length} rows.</p>` : ''}
<div class="foot"><a class="btn alt" href="/clients" data-link>Cancel</a><button class="btn" data-act="runImport" ${willImport.length ? '' : 'disabled'}>Import ${willImport.length} client${willImport.length === 1 ? '' : 's'}</button></div></div>`;
  $$('[data-map]').forEach((sel) => sel.addEventListener('change', (e) => { s.map[Number(e.target.dataset.map)] = e.target.value; renderImportStep(); }));
  $('#skipDupes').addEventListener('change', (e) => { s.skipDupes = e.target.checked; renderImportStep(); });
}
A.runImport = async (d, el) => {
  const s = importState; if (!s) return;
  const clients = importPlan().filter((p) => p.status === 'new' || (p.status === 'dupe' && !s.skipDupes)).map((p) => p.c);
  el.disabled = true; el.textContent = 'Importing…';
  try { const r = await api('POST', '/api/clients/import', { clients }); toast(`Imported ${r.added} client${r.added === 1 ? '' : 's'}`); navigate('/clients'); }
  catch (err) { el.disabled = false; el.textContent = `Import ${clients.length} clients`; throw err; }
};
A.importTemplate = () => downloadCsv('client-import-sample.csv', [['Name', 'Email', 'Phone', 'Address', 'Notes'], ['Jane Smith', 'jane@example.com', '(713) 555-0100', '100 Main St, Houston, TX 77002', 'Gate code 1234'], ['Carlos Rivera', 'carlos@example.com', '281-555-0142', '22 Oak Ln, Katy, TX 77494', '']]);

/* ===== /settings/preferences: this login's appearance (saved per browser) and push notifications ===== */
const pushCapable = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const pushSubHere = async () => { if (!pushCapable()) return null; const r = await navigator.serviceWorker.getRegistration('/'); return r ? r.pushManager.getSubscription() : null; };
// stop notifications on this device (also when logging out, so a shared phone doesn't keep getting them)
async function pushOffHere() {
  const s = await pushSubHere(); if (!s) return;
  await api('POST', '/api/auth/push/unsubscribe', { endpoint: s.endpoint }).catch(() => {}); await s.unsubscribe();
}
// calendar link: this login's private iCal feed (server.js, calendarFeed), for Google Calendar, Outlook and Apple Calendar
const calScopeRows = (F, cur) => !F.canAll ? '' : `<div class="choose-list" role="radiogroup" aria-label="What the calendar shows">${[['mine', 'Just my work', 'Jobs, tasks and events you’re assigned to, and your time off'], ['all', 'Everyone’s schedule', 'Every team member’s jobs, tasks and events, with who’s on each']].map(([v, l, s]) => `<label class="choose-row"><input type="radio" name="calScope" value="${v}" ${cur === v ? 'checked' : ''}><span><strong>${l}</strong><small class="muted" style="display:block">${s}</small></span></label>`).join('')}</div>`;
function calCard(F) {
  const noStaff = !F.hasStaff && (F.on ? F.scope : 'mine') === 'mine' ? `<div class="notice">Your login isn’t linked to a team member, so no work is assigned to you and your calendar will be empty.${F.canAll ? ' Choose <strong>Everyone’s schedule</strong>, or ask' : ' Ask'} the account owner to link you in Manage Team.</div>` : '';
  const head = '<h2>Calendar link</h2><p class="muted">See your work in Google Calendar, Outlook or Apple Calendar. Changes you make here show there on their own. It only goes one way: change jobs here, not in your calendar app.</p>';
  if (!F.on) return `${head}${noStaff}${calScopeRows(F, 'mine')}<button type="button" class="btn" id="calOn">Get my calendar link</button>`;
  return `${head}${noStaff}
<div style="display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 10px"><a class="btn" href="${esc(F.google)}" target="_blank" rel="noopener">Add to Google Calendar</a><a class="btn alt" href="${esc(F.webcal)}">Add to Apple Calendar or Outlook</a></div>
<p class="muted" style="margin:0">Or copy your link and paste it into your calendar app (in Outlook on the web: <strong>Add calendar → Subscribe from web</strong>; in Google Calendar on a computer: <strong>Other calendars → + → From URL</strong>).</p>
<div class="copy-row"><input readonly value="${esc(F.url)}" onclick="this.select()" aria-label="Your calendar link"><button type="button" class="btn alt sm" data-act="copyInput">Copy</button></div>
<p class="muted" style="font-size:13px">Keep this link to yourself: anyone who has it can see your schedule. Google Calendar checks for changes every few hours, so a change can take up to a day to show there. Apple Calendar and Outlook check more often. ${F.fetchedAt ? `Last checked by a calendar app: ${esc(fmtDate(F.fetchedAt))}.` : 'No calendar app has checked it yet.'}</p>
${calScopeRows(F, F.scope)}
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px"><button type="button" class="btn alt sm" id="calReset">Get a new link</button><button type="button" class="btn alt sm" id="calOff">Turn off</button></div>`;
}
function wireCal(box, F) {
  box.innerHTML = calCard(F);
  const call = async (m, p, body, msg) => { try { const N = await api(m, p, body); wireCal(box, N); if (msg) toast(msg); } catch (err) { toast(err.message, true); wireCal(box, F); } };
  const picked = () => { const r = box.querySelector('input[name=calScope]:checked'); return r ? r.value : 'mine'; };
  $('#calOn', box)?.addEventListener('click', () => call('POST', '/api/auth/calendar-feed', { scope: picked() }, 'Your calendar link is ready'));
  if (F.on) box.querySelectorAll('input[name=calScope]').forEach((r) => r.addEventListener('change', () => call('POST', '/api/auth/calendar-feed', { scope: r.value }, 'Saved. Your calendar shows the change the next time it checks.')));
  $('#calReset', box)?.addEventListener('click', () => { if (confirm('Get a new link? The old one stops working, so you’ll need to add the new one to your calendar app again (and remove the old calendar there).')) call('POST', '/api/auth/calendar-feed/reset', {}, 'New link ready. Add it to your calendar app.'); });
  $('#calOff', box)?.addEventListener('click', () => { if (confirm('Turn off your calendar link? Your calendar app stops getting your work. Remove the calendar there too.')) call('DELETE', '/api/auth/calendar-feed', null, 'Calendar link turned off'); });
}
const apCard = (t, label, cur) => `<button type="button" class="ap-card ${cur === t ? 'on' : ''}" data-act="setTheme" data-t="${t}" aria-pressed="${cur === t}"><span class="ap-pic ap-${t}" aria-hidden="true">${t === 'system' ? '<i class="ap-half"></i>' : ''}<b></b><b></b><u></u><u></u></span><span class="ap-name">${label}</span></button>`;
PAGES['/settings/preferences'] = {
  title: 'Preferences',
  async render(main) {
    const [P, F] = await Promise.all([api('GET', '/api/auth/push'), api('GET', '/api/auth/calendar-feed').catch(() => ({ allowed: false }))]); const capable = pushCapable(); let here = !!(await pushSubHere().catch(() => null));
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const quotes = canDo('quotes') && planHas('quotes');
    const kinds = [['overview', 'Today’s work overview', 'Each morning, if there are jobs today', true], ['schedule', 'Today’s schedule changed', 'A job today is added, moved, reassigned or cancelled', true],
      ['request', 'New request', 'A client asks for work from their portal or a referral', canDo('clients.view')], ['booking', 'New online booking', 'Someone books on your booking page', canDo('clients.view') && planHas('onlineBooking')],
      ['quoteViewed', 'Client viewed quote', 'The first time a client opens a sent quote', quotes], ['quoteChanges', 'Client asked for changes', 'A client clicks Request Changes on a quote', quotes], ['quoteApproved', 'Client approved quote', 'A client approves a quote', quotes], ['review', 'New client review', 'A client leaves a review', canDo('reviews') && planHas('reviews')], ['automation', 'Your automations', 'An automation you set up to notify the team', planHas('automations')], ['jobPost', 'A post is ready to approve', 'A finished job’s photos became a social post', canDo('social') && planHas('jobPosts')]].filter((k) => k[3]);
    const why = !capable ? (ios ? 'On iPhone and iPad, add this app to your Home Screen first (Share → Add to Home Screen), then open it from there and come back to this page. Needs iOS 16.4 or later.' : 'This browser can’t receive push notifications. Try Chrome, Edge, Firefox or Safari.')
      : Notification.permission === 'denied' ? 'Notifications are blocked for this app. Allow them in your browser or device settings, then come back to this page.' : '';
    const t = getTheme();
    main.innerHTML = `<h1 class="tm-title">Preferences</h1>
<div class="qcard pref-card"><h2>Appearance</h2><p class="muted">Saved on this browser or phone. Your clients always see their pages in light mode.</p><div class="ap-cards">${apCard('system', 'System', t)}${apCard('light', 'Light', t)}${apCard('dark', 'Dark', t)}</div></div>
<div class="qcard pref-card"><h2>Push notifications</h2><p class="muted">Receive push notifications on your phone, tablet or computer. Turn them on for each device you use.</p>
${why ? `<div class="notice">${why}</div>` : ''}
<label class="sw-row"><span>Notifications on this device</span><input type="checkbox" class="sw" id="pushHere" ${here ? 'checked' : ''} ${why ? 'disabled' : ''}><i></i></label>
${kinds.map(([k, label, note]) => `<label class="sw-row"><span>${label}<small class="muted">${note}</small></span><input type="checkbox" class="sw" data-push="${k}" ${P.prefs[k] ? 'checked' : ''}><i></i></label>`).join('')}</div>
${F.allowed ? '<div class="qcard pref-card" id="calendar"></div>' : ''}`;
    if (F.allowed) { wireCal($('#calendar', main), F); if (location.hash === '#calendar') $('#calendar', main).scrollIntoView({ block: 'start' }); }
    const kindBoxes = $$('[data-push]', main); const dim = () => kindBoxes.forEach((c) => { c.disabled = !here; }); dim();
    const box = $('#pushHere', main);
    box.addEventListener('change', async () => {
      box.disabled = true;
      try {
        if (box.checked) {
          if (await Notification.requestPermission() !== 'granted') throw new Error(Notification.permission === 'denied' ? 'Notifications are blocked. Allow them in your browser or device settings.' : 'Notifications weren’t turned on.');
          await navigator.serviceWorker.register('/sw.js'); const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(atob(P.publicKey.replace(/-/g, '+').replace(/_/g, '/')), (x) => x.charCodeAt(0)) });
          await api('POST', '/api/auth/push/subscribe', { subscription: sub.toJSON() }).catch(async (err) => { await sub.unsubscribe(); throw err; });
          toast('Notifications are on for this device');
        } else { await pushOffHere(); toast('Notifications are off for this device'); }
        here = box.checked;
      } catch (err) { box.checked = here; toast(err.message, true); }
      box.disabled = false; dim();
    });
    kindBoxes.forEach((c) => c.addEventListener('change', async () => {
      try { await api('POST', '/api/auth/push/prefs', { [c.dataset.push]: c.checked }); toast('Saved'); } catch (err) { c.checked = !c.checked; toast(err.message, true); }
    }));
  },
};

/* ===== /settings/emails ===== */
PAGES['/settings/emails'] = {
  title: 'Email Templates',
  // a list of the emails; clicking one opens it in an editor with a live preview
  async render(main) {
    TPL.list = await api('GET', '/api/email-templates');
    main.innerHTML = `<div class="head"><div><h1>Email Templates</h1><p class="sub">Edit the emails sent to clients. Each one shows your logo, business name and brand color (Company Profile and App Settings).</p></div></div>
<div class="card ctable"><div class="tablewrap"><table class="tpl-list"><tr><th>Email</th><th>When it’s sent</th><th>Subject</th><th></th></tr>
${TPL.list.map((t) => `<tr class="crow" data-act="editTpl" data-key="${t.key}"><td><strong>${esc(t.label)}</strong>${t.custom ? ' <span class="badge sent">customized</span>' : ''}</td><td class="muted">${esc(t.description)}</td><td class="tpl-subj">${esc(t.subject)}</td>
<td class="r"><button type="button" class="btn alt sm row-edit" data-act="editTpl" data-key="${t.key}">Edit</button></td></tr>`).join('')}</table></div></div>`;
  },
};
const TPL = { list: [] };
const tplSample = () => ({ work: 'Gutter cleaning', reply: 'Thank you! It was a pleasure working with you.', client_name: 'Jane Smith', company_name: company.name || 'Your Business', company_email: company.email || 'hello@yourbusiness.com', sent_date: fmtDate(ymd(new Date())), quote_number: docPrefix('quotePrefix') + '1005', quote_title: 'Backyard cleanup', invoice_number: docPrefix('invoicePrefix') + '3010', total: '$1,250.00', fee: '$25.00', balance: '$1,275.00', due_date: fmtDate(ymd(addDays(new Date(), 14))), job_number: docPrefix('jobPrefix') + '2010', job_title: 'Gutter cleaning', date: fmtDate(ymd(addDays(new Date(), 2))), time: '09:00', address: '100 Main St, Houston, TX 77002', amount: '$1,250.00', paid_for: 'Invoice ' + docPrefix('invoicePrefix') + '3010', reference: 'pi_3Q8x2L4eZvKYlo2C', staff_name: 'Alex Rivera', eta: '20 minutes', arrival_time: '2:35 PM' });
const tplLinks = () => ({ quote: location.origin + '/p/quote/abc123', invoice: location.origin + '/pay/abc123', reviewRequest: location.origin + '/p/review/abc123', reviewReply: location.origin + '/p/review/abc123' });
A.editTpl = (d) => {
  const t = TPL.list.find((x) => x.key === d.key); if (!t) return; const vars = { ...tplSample(), link: tplLinks()[t.key] || '' };
  const body = modal(`${t.label} email`, `<form class="tpl" data-sticky><p class="muted" style="margin:-4px 0 12px">${esc(t.description)}</p>
<div class="tpl-grid"><div><label>Subject<input name="subject" value="${esc(t.subject)}" required></label><label>Message<textarea name="body" rows="14" required>${esc(t.body)}</textarea></label>
<div class="muted" style="margin-bottom:6px">Insert a placeholder at the cursor:</div><div class="chips">${Object.entries(t.vars).map(([k, l]) => `<button type="button" class="btn alt sm" data-act="insVar" data-v="${k}" title="${esc(l)}">${esc(l)}</button>`).join('')}</div>
<details class="tpl-fmt"><summary>Formatting</summary><ul><li><code># Heading</code> on the first line is the big title</li><li>Leave a blank line between paragraphs</li><li><code>**bold**</code> for bold</li><li><code>[Button text]({{link}})</code> on its own line is a button</li><li>Lines starting with <code>&gt;</code> go in a shaded box</li></ul></details>
<div class="pv-warn notice" hidden></div></div>
<div><div class="muted" style="font-size:13px">Preview with sample details</div><div class="tpl-preview"><div class="pv-subj"></div><iframe class="pv-frame" title="Email preview" sandbox=""></iframe></div></div></div>
<div class="foot">${t.custom ? `<button type="button" class="btn alt" data-act="resetTpl" data-key="${t.key}" style="margin-right:auto">Reset to default</button>` : ''}<button type="button" class="btn alt" data-act="tplCancel">Cancel</button><button class="btn">Save</button></div></form>`, true);
  body.parentElement.classList.add('tpl-modal');
  const form = $('form', body); let timer; let seq = 0;
  const draw = async () => { // the styled email, drawn by the server so it matches what clients get
    const n = ++seq; const r = await api('POST', `/api/email-templates/${t.key}/preview`, { subject: form.subject.value, body: form.body.value, vars }).catch(() => null);
    if (!r || n !== seq || !document.body.contains(form)) return; $('.pv-subj', form).textContent = r.subject; $('.pv-frame', form).srcdoc = r.html;
  };
  const preview = () => {
    clearTimeout(timer); timer = setTimeout(draw, 300);
    const unknown = [...new Set([...(form.subject.value + form.body.value).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((x) => x[1]).filter((k) => !(k in t.vars)))];
    const w = $('.pv-warn', form); w.hidden = !unknown.length; w.textContent = unknown.length ? `Not a placeholder for this email, so it will be sent as typed: ${unknown.map((k) => '{{' + k + '}}').join(', ')}` : '';
  };
  form.addEventListener('input', preview);
  form.addEventListener('focusin', (e) => { if (e.target.name === 'subject' || e.target.name === 'body') form._field = e.target; });
  form._dirty = () => form.subject.value !== t.subject || form.body.value !== t.body;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await api('PUT', '/api/email-templates/' + t.key, { subject: form.subject.value, body: form.body.value });
    closeModal(); toast(t.label + ' email saved'); refresh();
  });
  draw(); form.body.focus();
};
A.tplCancel = (d, el) => { const f = el.closest('form'); if (f._dirty() && !confirm('Discard your changes to this email?')) return; closeModal(); };
A.insVar = (d, el) => {
  const form = el.closest('form'); const f = form._field || $('[name=body]', form); const tag = `{{${d.v}}}`;
  const a = f.selectionStart ?? f.value.length; const b = f.selectionEnd ?? a;
  f.value = f.value.slice(0, a) + tag + f.value.slice(b); f.focus(); f.setSelectionRange(a + tag.length, a + tag.length);
  f.dispatchEvent(new Event('input', { bubbles: true }));
};
A.resetTpl = async (d) => { if (!confirm('Replace your wording with the original default email?')) return; await api('DELETE', '/api/email-templates/' + d.key); closeModal(); toast('Template reset'); refresh(); };


render();
/* ===== /profile: anyone signed in edits their own info, photo and password ===== */
PAGES['/profile'] = {
  title: 'My profile',
  async render(main) {
    const p = await api('GET', '/api/auth/profile'); let photo = p.photo || '';
    const pw = (name, label, ac) => `<label class="fl pwf"><span>${label}</span><input name="${name}" type="password" autocomplete="${ac}"><button type="button" class="eye" data-act="pfEye" aria-label="Show password">Show</button></label>`;
    main.innerHTML = `<h1 class="tm-title">My profile</h1>
<form class="tmform" id="pfInfo"><div class="qcard"><div class="qcard-h"><h2>Personal info</h2>${loginBadge({ role: p.role, roleName: me && me.roleName })}</div>
<div class="tm-photo"><span class="tm-av">${avatarHtml(p, 72)}</span><label class="btn alt sm">Upload photo<input type="file" id="pfPhoto" accept="image/png,image/jpeg,image/webp" hidden></label>
<button type="button" class="btn alt sm" data-act="pfPhotoRemove" ${photo ? '' : 'hidden'}>Remove</button></div>
<div class="tm-grid"><div>
<label class="fl"><span>Full name</span><input name="name" required autocomplete="name" value="${esc(p.name)}"></label>
<label class="fl"><span>Email address (used to log in)</span><input name="email" type="email" required autocomplete="email" value="${esc(p.email)}"></label>
<div id="pfEmailPw" hidden>${pw('currentPassword', 'Current password (needed to change your email)', 'current-password')}</div>
<label class="fl"><span>Mobile phone number</span><input name="phone" type="tel" autocomplete="tel" value="${esc(p.phone)}" placeholder="(123) 456-7890"></label>
${p.jobTitle ? `<p class="muted">Role: ${esc(p.jobTitle)}. Ask the account owner to change your role or access.</p>` : ''}</div>
<div class="addr"><input name="street" value="${esc(p.street)}" placeholder="Street address" aria-label="Street address" autocomplete="address-line1"><input name="city" value="${esc(p.city)}" placeholder="City" aria-label="City" autocomplete="address-level2">
<input name="state" value="${esc(p.state)}" placeholder="State" aria-label="State" autocomplete="address-level1"><div class="addr-row"><input name="zip" value="${esc(p.zip)}" placeholder="ZIP code" aria-label="ZIP code" autocomplete="postal-code"><input name="country" value="${esc(p.country || 'United States')}" placeholder="Country" aria-label="Country" autocomplete="country-name"></div></div></div>
</div></form>
<div class="pf-cols">${p.linked ? `<form class="tmform" id="pfHours" data-hours-root><div class="qcard login-card"><div class="qcard-h"><h2>Working hours</h2>${hoursPencil('working hours')}</div>
<p class="muted">When you're available to work. The office gets a warning if a job is booked outside them.</p>
${autoHoursHtml(staffHours(p), 'Not working')}${hoursFoot}</div></form>` : ''}
<form class="tmform" id="pfPass"><div class="qcard login-card"><h2>Change password</h2><p class="muted">Use at least 8 characters. Changing it signs you out on your other devices.</p>
<div class="pf-pw"><input type="email" name="username" value="${esc(p.email)}" autocomplete="username" hidden>
${pw('currentPassword', 'Current password', 'current-password')}${pw('newPassword', 'New password', 'new-password')}${pw('confirm', 'Confirm new password', 'new-password')}</div>
<div class="foot"><button class="btn">Update password</button></div></div></form></div>`;
    const info = $('#pfInfo'); const email = $('[name=email]', info);
    email.addEventListener('input', () => { $('#pfEmailPw').hidden = email.value.trim().toLowerCase() === p.email; });
    $('#pfPhoto').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return; if (f.size > 8e6) return toast('Image must be under 8 MB', true);
      photo = await resizeImage(f, 256); e.target.value = ''; $('.tm-av', info).innerHTML = avatarHtml({ photo }, 72); $('[data-act=pfPhotoRemove]', info).hidden = false; save();
    });
    info._clearPhoto = () => { photo = ''; $('.tm-av', info).innerHTML = avatarHtml({ ...p, photo: '', name: $('[name=name]', info).value || '?' }, 72); $('[data-act=pfPhotoRemove]', info).hidden = true; save(); };
    // saves on its own when a field changes or the photo changes (one save at a time; a change made meanwhile saves right after)
    const body = () => ({ ...Object.fromEntries(new FormData(info)), photo });
    const key = (b) => JSON.stringify({ ...b, currentPassword: undefined }); // the password box alone (say, filled in by a password manager) isn't a change
    let last = key(body()); let busy = false; let again = false;
    async function save() {
      if (busy) { again = true; return; }
      const b = body(); if (key(b) === last) return;
      if (!info.checkValidity()) return info.reportValidity();
      if (b.email.trim().toLowerCase() !== p.email && !b.currentPassword) { $('[name=currentPassword]', info).focus(); return toast('Enter your current password to change your email', true); }
      busy = true;
      try {
        const saved = await api('POST', '/api/auth/profile', b);
        p.email = saved.email; $('[name=currentPassword]', info).value = ''; $('#pfEmailPw').hidden = true; last = key(body());
        me = { ...me, name: saved.name, email: saved.email, photo: saved.photo }; renderTopbar(curPath()); toast('Profile saved');
      } catch (err) { toast(err.message, true); }
      busy = false; if (again) { again = false; save(); }
    }
    info.addEventListener('change', (e) => { if (e.target.id !== 'pfPhoto') save(); });
    info.addEventListener('submit', (e) => { e.preventDefault(); save(); });
    const hf = $('#pfHours');
    if (hf) {
      wireHoursEditor(hf, staffHours(p), 'Not working', async (hours) => { await api('POST', '/api/auth/hours', { hours }); toast('Working hours saved'); });
      hf.addEventListener('submit', (e) => { e.preventDefault(); hf._hoursSave(); });
    }
    const pass = $('#pfPass');
    pass.addEventListener('submit', async (e) => {
      e.preventDefault(); const b = Object.fromEntries(new FormData(pass));
      if (!b.currentPassword) return toast('Enter your current password', true);
      if (b.newPassword.length < 8) return toast('Use a new password with at least 8 characters', true);
      if (b.newPassword !== b.confirm) return toast('The new passwords don’t match', true);
      await api('POST', '/api/auth/password', { currentPassword: b.currentPassword, newPassword: b.newPassword });
      pass.reset(); toast('Password updated');
    });
  },
};
A.pfPhotoRemove = (d, el) => el.closest('form')._clearPhoto();
A.pfEye = (d, el) => { const i = el.parentElement.querySelector('input'); const showing = i.type === 'text'; i.type = showing ? 'password' : 'text'; el.textContent = showing ? 'Show' : 'Hide'; el.setAttribute('aria-label', showing ? 'Show password' : 'Hide password'); i.focus(); };

/* ===== /payments: payment history, payouts and payment settings ===== */
// every payment the business has received: invoice payments, quote deposits, and older invoices marked paid without a payment record
/* ===== /payments/view?id=…: one payment, with its timeline (opened from a row on Payments) ===== */
const CARD_BRAND = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', diners: 'Diners Club', jcb: 'JCB', unionpay: 'UnionPay' };
const WALLET = { apple_pay: 'Apple Pay', google_pay: 'Google Pay', samsung_pay: 'Samsung Pay', link: 'Link', amex_express_checkout: 'Amex Express Checkout', masterpass: 'Masterpass', visa_checkout: 'Visa Checkout' };
const pdWhen = (s) => { if (!s) return ''; const d = new Date(s); return `${fmtDate(s.slice(0, 10))} @ ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`; };
PAGES['/payments/view'] = {
  title: 'Payment',
  async render(main) {
    const rowId = new URLSearchParams(location.search).get('id');
    let R; try { R = await api('GET', '/api/payment-detail/' + encodeURIComponent(rowId || '')); } catch (e) { main.innerHTML = `<div class="card"><h2>Payment not found</h2><p class="muted">${esc(e.message)}</p><a class="btn alt" href="/payments" data-link>Back to Payments</a></div>`; return; }
    const P = R.payment; const X = R.stripe; const C = R.client; const docName = `${R.doc.kind === 'quote' ? 'Quote' : 'Invoice'} #${R.doc.number}`;
    const docHref = `/${R.doc.kind}s/view?id=${R.doc.id}`;
    const refunded = Math.max(P.refunded || 0, X ? X.refunded || 0 : 0); // refunds made here, or in Stripe's dashboard
    const status = X && !['succeeded', 'refunded', 'partly refunded'].includes(X.status) ? X.status : refundStatus(P.amount, refunded); const [stLabel, stCls] = PAY_STATUS[status] || PAY_STATUS.succeeded;
    const isOnline = online(P.method); const demo = isOnline && P.method !== 'stripe';
    const methodLabel = X ? (X.card ? (X.card.funding === 'debit' ? 'Debit card' : 'Credit card') : X.bank ? 'Bank payment (ACH)' : 'Online payment') : demo ? 'Demo checkout' : payLabel(P.method);
    const field = (label, value) => (value ? `<div class="pd-f"><span>${label}</span><div>${value}</div></div>` : '');
    const details = [
      field('Transaction date', esc(fmtDate(P.date))),
      field('Method', esc(methodLabel)),
      X && X.card ? field('Card number', `•••• •••• •••• ${esc(X.card.last4)} ${esc(CARD_BRAND[X.card.brand] || X.card.brand || '')}`) : '',
      X && X.card && X.card.expMonth ? field('Expiry', `${String(X.card.expMonth).padStart(2, '0')}/${String(X.card.expYear).slice(-2)}`) : '',
      X && X.bank ? field('Bank account', `${esc(X.bank.name)} •••• ${esc(X.bank.last4)}`) : '',
      X ? field(X.card ? 'Name on card' : 'Account holder', esc(X.name)) : '',
      X ? field('Billing address', esc(X.address)) : '',
      X ? field('Paid through', X.card && X.card.wallet ? `Digital wallet (${esc(WALLET[X.card.wallet] || X.card.wallet)})` : X.link ? `Link by Stripe${X.link.email ? ` (${esc(X.link.email)})` : ''}` : 'Online payment page') : '',
      field('Transaction number', X ? `<code>${esc(X.chargeId || X.paymentIntent)}</code>` : P.reference ? esc(P.reference) : ''),
      !X ? field('Recorded by', esc(P.recordedBy)) : '',
      field('Details', `Payment applied to ${esc(docName)}${P.tip ? `, plus a ${money(P.tip)} tip from the client` : ''}`),
      field('Applied to', `<a href="${docHref}" data-link>${esc(docName)}</a>`),
      field('Note', esc(P.note)),
    ].join('');
    // timeline: collected, then the payout (Stripe), or "recorded" for payments you entered yourself
    const step = (state, title, sub) => `<li class="tl-${state}"><span class="tl-ic">${state === 'done' ? '✓' : state === 'now' ? '<i class="tl-spin"></i>' : ''}</span><div><strong>${title}</strong>${sub ? `<small>${sub}</small>` : ''}</div></li>`;
    function refundSteps() { return P.refunds.map((r) => step(r.status === 'pending' ? 'now' : r.status === 'failed' || r.status === 'canceled' ? 'todo' : 'done', `${r.status === 'pending' ? 'Refund pending' : r.status === 'failed' ? 'Refund failed' : 'Refunded'} ${money(r.amount)}`, `${esc(pdWhen(r.at))}${r.by ? ` by ${esc(r.by)}` : ''}${r.stripe ? '' : '<br>Recorded: you returned this yourself'}`)); }
    let steps;
    if (X) {
      const po = X.payout;
      steps = [step('done', 'Payment collected', esc(pdWhen(X.created))),
        ...refundSteps(), !P.refunds.length && X.refunded ? step('done', `Refunded ${money(X.refunded)}`, 'In your Stripe dashboard') : '',
        !po ? step('now', 'Upcoming payout', 'Waiting for Stripe to schedule it')
          : po.status === 'deposited' ? step('done', 'Paid out', '') + step('done', 'Deposited', esc(fmtDate(po.date.slice(0, 10))))
            : po.status === 'on_the_way' ? step('now', 'Payout on the way', `Arrives ${esc(fmtDate(po.date.slice(0, 10)))}`) + step('todo', 'Deposited', '')
              : step('now', 'Upcoming payout', `Estimated ${esc(fmtDate(po.date.slice(0, 10)))}`) + step('todo', 'Deposited', '')].join('');
    } else if (demo) steps = step('done', 'Payment collected', esc(fmtDate(P.date))) + step('todo', 'No payout', 'Demo payments charge nobody');
    else steps = step('done', 'Payment recorded', `${esc(P.createdAt ? pdWhen(P.createdAt) : fmtDate(P.date))}${P.recordedBy ? ` by ${esc(P.recordedBy)}` : ''}`) + step('done', 'Deposited', 'You deposit this payment yourself') + refundSteps().join('');
    const sent = R.receipts.length ? `<h3 class="tl-h">Receipts</h3><ul class="tl-list">${R.receipts.map((r) => `<li>${r.status === 'failed' ? 'Not delivered to' : 'Sent to'} ${esc(r.to)}<small>${esc(pdWhen(r.at))}</small></li>`).join('')}</ul>` : '';
    const summary = `<div class="pd-sum"><h3>Payment summary</h3>${P.tip ? `<div class="pd-l"><span>Toward ${esc(docName)}</span><span>${money(P.amount - P.tip)}</span></div><div class="pd-l"><span>Tip</span><span>${money(P.tip)}</span></div>` : ''}<div class="pd-l"><span>Payment amount</span><span>${money(P.amount)}</span></div>
${refunded ? `<div class="pd-l pd-ref"><span>Refunded</span><span>−${money(refunded)}</span></div>` : ''}
${X && X.fee != null ? `<div class="pd-l muted"><span>Processing fees</span><span>−${money(X.fee)}</span></div><div class="pd-l muted"><span>Net to you</span><span>${money(X.net - refunded)}</span></div>` : ''}
<div class="pd-l pd-tot"><span>Paid</span><span>${money(P.amount - refunded)}</span></div></div>`;
    const canRefund = ['owner', 'admin'].includes(role()) && P.refundable && !demo && P.amount - refunded > 0.004;
    const more = `<a class="mi" href="/api/payment-detail/${encodeURIComponent(P.id)}/pdf" download title="Receipt">${MI.pdf}Download PDF</a>${canRefund ? `<button type="button" class="mi" data-act="pdRefund">${MI.refund}Issue a Refund</button>` : ''}`;
    pdState = { P, X, refunded, docName };
    main.innerHTML = `<div class="pd"><div class="pd-main">
<div class="pd-top"><a class="pd-back" href="/payments" data-link aria-label="Back to Payments">‹ Payments</a><span class="badge ${stCls}">${stLabel}</span>
<div class="pd-acts"><details class="menu"><summary class="btn alt">⋯ More</summary><div class="menu-list">${more}</div></details>${C && C.email ? `<button type="button" class="btn" data-act="pdReceipt" data-id="${esc(P.id)}">Send receipt</button>` : ''}</div></div>
<div class="pd-amt">${money(P.amount)}</div>
${R.stripeError ? `<div class="note">Couldn’t load the card details from Stripe: ${esc(R.stripeError)}</div>` : ''}
${C ? `<div class="card pd-client"><div class="pd-cn"><strong>${esc(C.name)}</strong>${C.company ? `<span class="muted"> · ${esc(C.company)}</span>` : ''}<button type="button" class="link-btn" data-act="pdClient" data-id="${C.id}">View client</button></div>
${C.address ? `<div class="pd-addr">${esc(C.address).replace(/,\s*/, '<br>')}</div>` : ''}${C.phone ? `<a href="tel:${esc(C.phone)}">${esc(fmtUsPhone(C.phone))}</a>` : ''}${C.email ? `<a href="mailto:${esc(C.email)}">${esc(C.email)}</a>` : ''}</div>` : ''}
<div class="card">${summary}</div>
<h2 class="pd-h">Details</h2><div class="pd-grid">${details}</div></div>
<aside class="pd-side"><h2>Timeline</h2><ol class="tl">${steps}</ol>${sent}
${X && X.payout && X.payout.estimate ? `<p class="muted pd-note">Payout dates are estimates until the money is deposited. <a href="${esc((company.account && company.account.helpUrl) || '')}/articles/payout-schedule" target="_blank" rel="noopener">About payout schedules</a></p>` : ''}</aside></div>`;
  },
};
// the More menu's icons
const MI = {
  pdf: '<svg class="mi-ic pdf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9.5 17.5c1.5-1 3-4 3.2-6.5.1-1.2-1.3-1.4-1.5-.3-.4 2.2 2.6 5.5 4.6 5.3 1.1-.1.9-1.5-.4-1.4-2.1.2-4.5 1.7-5.9 2.9z"/></svg>',
  refund: '<svg class="mi-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
};
let pdState = null;
// Issue a refund: back through Stripe for card and bank payments; recorded only for payments you entered (you hand that money back yourself)
A.pdRefund = () => {
  $$('details.menu[open]').forEach((x) => { x.open = false; });
  const { P, X, refunded, docName } = pdState; const left = Math.round((P.amount - refunded) * 100) / 100; const viaStripe = P.method === 'stripe';
  const m = modal('Issue a refund', `<form id="rfForm">
<p class="muted" style="margin-top:0">${viaStripe ? `The money goes back to the client’s ${X && X.card ? `${esc(CARD_BRAND[X.card.brand] || 'card')} ending in ${esc(X.card.last4)}` : 'card or bank account'}. Refunds usually arrive in 5 to 10 business days. Stripe’s processing fee isn’t returned.` : `This records a refund on this ${esc(payLabel(P.method).toLowerCase())} payment. Give the money back to the client yourself; nothing is sent automatically.`}</p>
<div class="row"><label>Amount to refund<div class="money-in"><span>$</span><input name="amount" type="number" min="0.01" max="${left}" step="0.01" value="${left.toFixed(2)}" required></div><small class="muted">Up to ${money(left)}${refunded ? ` (${money(refunded)} already refunded)` : ''}</small></label>
<label>Reason<select name="reason"><option value="requested_by_customer">Requested by the client</option><option value="duplicate">Duplicate payment</option><option value="fraudulent">Fraudulent</option><option value="other">Other</option></select></label></div>
<label>Note (optional, only you see it)<textarea name="note" rows="2" maxlength="500" placeholder="e.g. Job canceled"></textarea></label>
<p class="muted" style="font-size:13px">${esc(docName)} will show the refunded amount as unpaid again.</p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn danger" id="rfGo">Refund ${money(left)}</button></div></form>`);
  const f = $('#rfForm', m.closest('.modal') || document); const go = $('#rfGo');
  f.amount.addEventListener('input', () => { const v = Number(f.amount.value); go.textContent = v > 0 ? `Refund ${money(v)}` : 'Refund'; });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const v = Number(f.amount.value);
    if (!(v > 0) || v > left + 0.004) return toast(`Enter an amount up to ${money(left)}`, true);
    if (!confirm(`Refund ${money(v)} to the client?${viaStripe ? ' This can’t be undone.' : ''}`)) return;
    go.disabled = true; go.textContent = 'Refunding…';
    try { await api('POST', `/api/payment-detail/${encodeURIComponent(P.id)}/refund`, { amount: v, reason: f.reason.value, note: f.note.value }); payStripe.at = 0; closeModal(); toast(viaStripe ? `Refund of ${money(v)} sent` : `Refund of ${money(v)} recorded`); refresh(); }
    catch (x) { go.disabled = false; go.textContent = `Refund ${money(v)}`; toast(x.message, true); }
  });
};
A.pdCopy = async (d) => { try { await navigator.clipboard.writeText(d.v); toast('Transaction number copied'); } catch (e) { toast(d.v); } };
A.pdClient = (d) => navigate('/clients/view?id=' + d.id);
A.pdReceipt = async (d, el) => {
  el.disabled = true; el.textContent = 'Sending…';
  try { const r = await api('POST', `/api/payment-detail/${encodeURIComponent(d.id)}/receipt`, {}); toast(`Receipt sent to ${r.to}`); refresh(); } catch (e) { toast(e.message, true); el.disabled = false; el.textContent = 'Send receipt'; }
};

const refundSum = (l) => (l || []).filter((r) => r.status !== 'failed' && r.status !== 'canceled').reduce((s, r) => s + (Number(r.amount) || 0), 0);
const refundStatus = (amount, refunded) => (refunded >= amount - 0.004 && refunded > 0 ? 'refunded' : refunded > 0 ? 'partly refunded' : 'succeeded');
function paymentRows() {
  const rows = [];
  for (const i of D.invoices) {
    for (const p of i.payments || []) rows.push({ id: p.id, clientId: i.clientId, doc: ['invoice', i], date: (p.date || '').slice(0, 10), method: p.method, amount: (Number(p.amount) || 0) + (Number(p.tip) || 0), tip: Number(p.tip) || 0, reference: p.reference || '', refunded: refundSum(p.refunds) });
    if (!(i.payments || []).length && i.status === 'paid' && i.paidAt && !i.paidByDeposit) rows.push({ id: 'i-' + i.id, clientId: i.clientId, doc: ['invoice', i], date: i.paidAt.slice(0, 10), method: i.paymentMethod || 'other', amount: Number(i.paidAmount || i.total) || 0, reference: '' });
  }
  for (const q of D.quotes) if (q.depositPaidAt) rows.push({ id: 'q-' + q.id, clientId: q.clientId, doc: ['quote', q], date: q.depositPaidAt.slice(0, 10), method: q.depositMethod || 'other', amount: Number(q.depositPaidAmount ?? q.depositFee) || 0, reference: q.depositReference || '' });
  return rows;
}
const PAY_STATUS = { succeeded: ['Succeeded', 'paid'], processing: ['Processing', 'sent'], refunded: ['Refunded', 'draft'], 'partly refunded': ['Partly refunded', 'draft'], disputed: ['Disputed', 'overdue'], failed: ['Failed', 'failed'] };
const online = (m) => m === 'stripe' || m === 'demo' || m === 'demo-card';
// Stripe's details for the Payments page: the last answer is shown at once (even while a newer one loads); it's asked for again after a minute
let payStripe = { data: null, at: 0, loading: false, error: '' };
function payStripeState() {
  if (!planHas('onlinePayments') || (company.account && company.account.cardReady === false)) return { connected: false }; // no card payments set up: nothing to ask Stripe
  if (!payStripe.loading && Date.now() - payStripe.at > 60e3) {
    payStripe.loading = true; payStripe.error = '';
    api('GET', '/api/payments/stripe').then((d) => { payStripe = { data: d, at: Date.now(), loading: false, error: '' }; }, (e) => { payStripe = { ...payStripe, loading: false, error: e.message, at: Date.now() - 50e3 }; })
      .then(() => { if (curPath() === '/payments' && !document.activeElement.matches('input, select, textarea')) PAGES['/payments'].render($('#main')); });
  }
  if (payStripe.data) return { ...payStripe.data, error: payStripe.error };
  return { connected: true, loading: !payStripe.error, failed: !!payStripe.error, error: payStripe.error, charges: {}, payouts: [], disputes: { open: 0 }, upcoming: [] };
}
A.payStripeRetry = () => { payStripe.at = 0; PAGES['/payments'].render($('#main')); };
// Payouts tab filters and sort
let poView = { method: 'all', date: 'all', sort: 'date', dir: -1 };
function poRange(k) {
  const d = new Date(); const ago = (n) => ymd(addDays(d, -n));
  if (k === 'week') { const w = addDays(d, -((d.getDay() + 6) % 7)); return { from: ymd(w), to: ymd(addDays(w, 6)) }; }
  if (k === 'month') return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  if (k === '30' || k === '90') return { from: ago(Number(k)), to: '' };
  if (k === 'year') return { from: d.getFullYear() + '-01-01', to: '' };
  return { from: '', to: '' };
}
A.poSort = (d) => { poView = { ...poView, sort: d.k, dir: poView.sort === d.k ? -poView.dir : -1 }; PAGES['/payments'].render($('#main')); };
A.poEmail = async (d, el) => {
  el.disabled = true; el.textContent = 'Sending…'; const r0 = poRange(poView.date);
  try { const r = await api('POST', '/api/payments/payouts/email', { method: poView.method, from: r0.from, to: r0.to }); toast(r.status === 'sent' ? `Emailed ${r.count} payout${r.count === 1 ? '' : 's'} to ${r.to}` : 'Email isn’t set up on this service yet, so the CSV couldn’t be sent', r.status !== 'sent'); }
  catch (x) { toast(x.message, true); }
  el.disabled = false; el.textContent = 'Email CSV';
};
let payView = { tab: 'overview', status: 'all', method: 'all', date: 'all', q: '', sort: 'date', dir: -1 };
PAGES['/payments'] = {
  title: 'Payments',
  async render(main) {
    // the list draws right away from Worklio's records; Stripe's details (statuses, payout dates, upcoming payouts) fill in when they arrive
    const v = payView; const S = payStripeState();
    const day = (s) => (s || '').slice(0, 10); const ago = (n) => ymd(addDays(new Date(), -n)); const tomorrow = ymd(addDays(new Date(), 1));
    const rows = paymentRows().map((r) => {
      const ch = r.method === 'stripe' && S.charges ? S.charges[r.reference] : null;
      return { ...r, status: (ch && ch.status) || refundStatus(r.amount, r.refunded || 0), payout: r.method === 'stripe' ? (S.loading && !ch ? 'Checking Stripe…' : S.failed ? '—' : ch && ch.payoutDate ? fmtDate(ch.payoutDate) : ch && ch.paidOut ? 'Paid out' : 'In Stripe') : online(r.method) ? 'Demo: no payout' : 'Manually deposited',
        payoutKey: ch && ch.payoutDate ? ch.payoutDate : '', methodLabel: r.method === 'stripe' ? 'Online (Stripe)' : online(r.method) ? 'Demo checkout' : payLabel(r.method) };
    });
    const cname = (r) => { const c = byId(D.clients, r.clientId); return c ? c.company || c.name : 'Unknown client'; };
    const change = (now, prev, lowerIsBetter) => { if (now === null || !prev) return '<span class="chg flat">—%</span>'; const up = now >= prev; const good = lowerIsBetter ? !up : up; return `<span class="chg ${now === prev ? 'flat' : good ? 'up' : 'down'}">${up ? '↑' : '↓'} ${Math.abs(Math.round(((now - prev) / prev) * 100))}%</span>`; };
    const commercialOf = (i) => !!(byId(D.clients, i.clientId) || {}).company;
    // average days from issue to payment (invoices paid in the window), and the share of invoices paid by their due date
    const paidIn = (from, to, commercial) => D.invoices.filter((i) => i.status === 'paid' && day(i.paidAt) >= from && day(i.paidAt) < to && commercialOf(i) === commercial);
    const payDays = (l) => (l.length ? Math.round(l.reduce((s, i) => s + Math.max(0, (parseD(day(i.paidAt)) - parseD(day(i.issueDate))) / 864e5), 0) / l.length) : null);
    const onTime = (l) => (l.length ? Math.round((l.filter((i) => !i.dueDate || day(i.paidAt) <= i.dueDate).length / l.length) * 100) : null);
    const stat = (fn, n, lowerIsBetter, fmt) => [false, true].map((com) => { const now = fn(paidIn(ago(n), tomorrow, com)); const prev = fn(paidIn(ago(2 * n), ago(n), com));
      return `<div class="pt"><div class="cs-v sm">${now === null ? '—' : fmt(now)} ${change(now, prev, lowerIsBetter)}</div><div class="muted">${com ? 'Commercial' : 'Residential'}</div></div>`; }).join('');
    // upcoming payouts from Stripe (soonest first); the box shows their total and a link to the list
    // without dated entries from Stripe (or before the server has them), fall back to the balance: what's ready now, and what's still clearing
    const B = S.balance || { available: 0, pending: 0 };
    const UP = S.upcoming && S.upcoming.length ? S.upcoming : [...(B.available > 0 ? [{ date: null, amount: B.available, next: true }] : []), ...(B.pending > 0 ? [{ date: null, amount: B.pending, clearing: true }] : [])];
    payView.upcoming = UP; const upcoming = UP.reduce((s, u) => s + u.amount, 0);
    const since = { '30': ago(30), '90': ago(90), year: new Date().getFullYear() + '-01-01' }[v.date] || '';
    const list = rows.filter((r) => (v.status === 'all' || r.status === v.status) && (v.method === 'all' || (v.method === 'online' ? online(r.method) : r.method === v.method)) && (!since || r.date >= since)
      && (!v.q || [cname(r), r.doc[1].number, r.methodLabel, money(r.amount), r.reference].join(' ').toLowerCase().includes(v.q.toLowerCase())));
    const key = { client: (r) => cname(r).toLowerCase(), date: (r) => r.date, status: (r) => r.status, method: (r) => r.methodLabel, payout: (r) => r.payoutKey || r.payout, amount: (r) => r.amount }[v.sort];
    list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * v.dir);
    const th = (k, label, cls = '') => `<th class="${cls}"><button class="th-btn" data-act="paySort" data-k="${k}">${label} <span class="sort ${v.sort === k ? 'on' : ''}">${v.sort === k ? (v.dir > 0 ? '▲' : '▼') : '⇅'}</span></button></th>`;
    const methods = [...new Set(rows.filter((r) => !online(r.method)).map((r) => r.method))];
    const docLink = ([kind, d]) => `<a href="/${kind}s/view?id=${d.id}" data-link>${kind === 'quote' ? 'Quote' : 'Invoice'} ${esc(d.number)}</a>`;
    const admin = !me || ['owner', 'admin'].includes(me.role);
    const upBox = `<div class="cstat"><div class="cs-h"><strong>Upcoming payouts</strong></div><div class="cs-v">${S.loading || S.failed ? '<span class="pay-wait">—</span>' : money(upcoming)}</div><div class="muted">${S.loading ? 'Checking Stripe…' : S.failed ? 'Not available right now' : !S.connected ? 'Payouts appear here once you connect Stripe and collect online payments' : UP.length ? `<button type="button" class="link-btn up-link" data-act="viewPayouts">View ${UP.length} payout${UP.length === 1 ? '' : 's'}</button>` : 'Upcoming payouts appear after you collect payments'}</div></div>`;
    const overview = `<div class="cstats pay-stats">
${upBox}
<button class="cstat" data-act="payInvoices"><div class="cs-h"><strong>Invoice payment time</strong><span>↗</span></div><div class="muted">Past 30 days</div><div class="pts">${stat(payDays, 30, true, (d) => `${d} ${d === 1 ? 'day' : 'days'}`)}</div></button>
<div class="cstat"><div class="cs-h"><strong>Invoices paid on time</strong></div><div class="muted">Last 60 days</div><div class="pts">${stat(onTime, 60, false, (p) => p + '%')}</div></div></div>
<h2 class="ftitle">All payments <span class="muted">(${list.length} result${list.length === 1 ? '' : 's'})</span></h2>
<div class="cfilters"><label class="pill">Status<select data-pv="status"><option value="all">All</option>${Object.entries(PAY_STATUS).map(([k, [l]]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
<label class="pill">Method<select data-pv="method"><option value="all">All</option><option value="online" ${v.method === 'online' ? 'selected' : ''}>Online</option>${methods.map((m) => `<option value="${esc(m)}" ${v.method === m ? 'selected' : ''}>${esc(payLabel(m))}</option>`).join('')}</select></label>
<label class="pill">📅 Date<select data-pv="date">${[['all', 'All'], ['30', 'Past 30 days'], ['90', 'Past 90 days'], ['year', 'This year']].map(([k, l]) => `<option value="${k}" ${v.date === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
<input id="pq" class="csearch" type="search" placeholder="Search payments…" value="${esc(v.q)}"></div>
<div class="card ctable"><div class="tablewrap"><table class="m-pay"><tr>${th('client', 'Client')}${th('date', 'Payment date')}${th('status', 'Payment status')}${th('method', 'Method')}${th('payout', 'Payout date')}${th('amount', 'Amount', 'r')}</tr>
${list.map((r) => `<tr class="crow" data-id="${esc(r.id)}" title="See this payment"><td><strong>${esc(cname(r))}</strong><div class="pay-ref">${docLink(r.doc)}</div></td><td style="white-space:nowrap">${fmtDate(r.date)}</td>
<td><span class="badge ${PAY_STATUS[r.status][1]}">${PAY_STATUS[r.status][0]}</span></td><td>${r.method === 'stripe' ? '💳 ' : ''}${esc(r.methodLabel)}</td><td style="white-space:nowrap">${esc(r.payout)}</td><td class="r"><strong>${money(r.amount)}</strong></td></tr>`).join('')
  || `<tr><td colspan="6" class="empty">${rows.length ? 'No payments match these filters' : 'No payments yet. Payments show up here when clients pay online or you record a payment on an invoice.'}</td></tr>`}</table></div></div>`;
    // Payouts tab: upcoming (same box as Overview), what reached the bank this week and month, and every payout with filters
    const PO_STATUS = { paid: ['Paid', 'paid'], pending: ['Pending', 'sent'], in_transit: ['In transit', 'sent'], canceled: ['Canceled', 'failed'], failed: ['Failed', 'failed'] };
    const d0 = new Date(); const wk = addDays(d0, -((d0.getDay() + 6) % 7)); const wkEnd = addDays(wk, 6); const mo = new Date(d0.getFullYear(), d0.getMonth(), 1); const moEnd = new Date(d0.getFullYear(), d0.getMonth() + 1, 0);
    const short = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const deposited = (from, to) => (S.payouts || []).filter((p) => p.status === 'paid' && p.arrival >= ymd(from) && p.arrival <= ymd(to)).reduce((s, p) => s + p.amount, 0);
    const pv = poView; const range = poRange(pv.date);
    const pl = (S.payouts || []).filter((p) => (pv.method === 'all' || p.method === pv.method) && (!range.from || p.arrival >= range.from) && (!range.to || p.arrival <= range.to))
      .sort((a, b) => (pv.sort === 'amount' ? a.amount - b.amount : a.arrival.localeCompare(b.arrival)) * pv.dir);
    const poTh = (k, label, cls = '') => `<th class="${cls}"><button class="th-btn" data-act="poSort" data-k="${k}">${label} <span class="sort ${pv.sort === k ? 'on' : ''}">${pv.sort === k ? (pv.dir > 0 ? '▲' : '▼') : '⇅'}</span></button></th>`;
    const payouts = S.loading || S.failed ? `<div class="card"><h2>Payouts</h2><p class="muted">${S.failed ? 'Payouts didn’t load from Stripe. Try again in a moment.' : 'Loading payouts from Stripe…'}</p></div>`
      : !S.connected ? `<div class="card"><h2>Payouts</h2><p class="muted">When clients pay online, Stripe sends the money to your bank account. ${admin ? '<a href="/settings#payments" data-link>Set up card payments</a> in App Settings to start taking online payments.' : 'Ask the account owner to set up card payments.'}</p></div>`
      : `<div class="cstats po-stats">${upBox}
<div class="cstat"><div class="cs-h"><strong>Deposited <span class="po-q" title="Payouts that have reached your bank account">?</span></strong></div>
<div class="cs-v">${money(deposited(wk, wkEnd))}</div><div class="muted">This week (${short(wk)} - ${short(wkEnd)})</div><div class="cs-v po-v2">${money(deposited(mo, moEnd))}</div><div class="muted">This month (${short(mo)} - ${short(moEnd)})</div></div></div>
<h2 class="ftitle">All payouts <span class="muted">(${pl.length} result${pl.length === 1 ? '' : 's'})</span></h2>
<div class="cfilters"><label class="pill">Method<select data-po="method">${[['all', 'All'], ['standard', 'Standard'], ['instant', 'Instant']].map(([k, l]) => `<option value="${k}" ${pv.method === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
<label class="pill">📅 Date<select data-po="date">${[['all', 'All'], ['week', 'This week'], ['month', 'This month'], ['30', 'Past 30 days'], ['90', 'Past 90 days'], ['year', 'This year']].map(([k, l]) => `<option value="${k}" ${pv.date === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
<button type="button" class="btn alt" data-act="poEmail" ${pl.length ? '' : 'disabled'}>Email CSV</button></div>
<div class="card ctable"><div class="tablewrap"><table class="po-table"><tr>${poTh('date', 'Date')}<th>Type</th><th>Payout status</th>${poTh('amount', 'Amount', 'r')}</tr>
${pl.map((p) => `<tr><td><strong>${fmtDate(p.arrival)}</strong><div class="po-id">${esc(p.id)}</div></td><td>${p.method === 'instant' ? 'Instant' : 'Standard'}</td><td><span class="badge ${(PO_STATUS[p.status] || ['', 'sent'])[1]}">${esc((PO_STATUS[p.status] || [p.status])[0])}</span></td><td class="r"><strong>${money(p.amount)}</strong></td></tr>`).join('')
  || `<tr><td colspan="4" class="empty">${(S.payouts || []).length ? 'No payouts match these filters' : 'No payouts yet. Stripe pays out after your first online payments clear.'}</td></tr>`}</table></div></div>`;
    main.innerHTML = `<div class="head"><h1>Payments</h1><div class="actions">${admin ? '<a class="btn alt" href="/payments/settings" data-link>Settings</a>' : ''}${S.connected ? `<a class="btn alt" href="https://dashboard.stripe.com/disputes" target="_blank" rel="noopener">Disputes${S.disputes.open ? ` (${S.disputes.open})` : ''}</a>` : ''}</div></div>
${S.error ? `<div class="notice pay-note">Stripe’s details didn’t load (${esc(S.error)}). The list below is from your records. <button type="button" class="link-btn" data-act="payStripeRetry">Try again</button></div>` : S.partial ? '<div class="notice pay-note">Some details from Stripe didn’t load, so a few statuses or payout dates may be missing. <button type="button" class="link-btn" data-act="payStripeRetry">Try again</button></div>' : ''}
<nav class="ptabs">${[['overview', 'Overview'], ['payouts', 'Payouts']].map(([k, l]) => `<button type="button" class="${v.tab === k ? 'on' : ''}" data-act="payTab" data-t="${k}">${l}</button>`).join('')}</nav>
${v.tab === 'payouts' ? payouts : overview}`;
    $$('.crow', main).forEach((r) => r.addEventListener('click', (e) => { if (!e.target.closest('a')) navigate('/payments/view?id=' + encodeURIComponent(r.dataset.id)); }));
    $$('[data-pv]', main).forEach((s) => s.addEventListener('change', (e) => { payView[e.target.dataset.pv] = e.target.value; refresh(); }));
    $$('[data-po]', main).forEach((s) => s.addEventListener('change', (e) => { poView[e.target.dataset.po] = e.target.value; PAGES['/payments'].render(main); }));
    let t; const q = $('#pq', main); if (q) q.addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(async () => { payView.q = e.target.value; await refresh(); const n = $('#pq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); });
  },
};
A.payTab = (d) => { payView.tab = d.t; refresh(); };
// "View N payouts": the dates and amounts Stripe expects, with a note that they can change
A.viewPayouts = () => {
  const L = payView.upcoming || []; const when = (u) => (u.date ? new Date(u.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : u.next ? 'Next payout' : 'When the payments clear'); // undated: manual payouts, or no schedule from Stripe
  modal('Upcoming payouts', `<table class="up-table"><tr><th>Date</th><th class="r">Amount</th></tr>
${L.map((u) => `<tr><td>${when(u)}${u.inTransit ? `<div class="muted">On its way${u.bank && u.bank.last4 ? ` to ${esc(u.bank.name)} ••${esc(u.bank.last4)}` : ''}</div>` : ''}</td><td class="r">${money(u.amount)}</td></tr>`).join('')}</table>
<p class="up-note">Payout amounts and dates are estimates and may change until they’re deposited. <a href="${esc((company.account && company.account.helpUrl) || '')}/articles/payout-schedule" target="_blank" rel="noopener">Learn more about payout schedules</a></p>`);
};
A.paySort = (d) => { if (payView.sort === d.k) payView.dir *= -1; else { payView.sort = d.k; payView.dir = d.k === 'client' || d.k === 'method' ? 1 : -1; } refresh(); };
A.payInvoices = () => navigate('/invoices');

PAGES['/payments/settings'] = {
  title: 'Payment settings',
  async render(main) {
    const S = planHas('onlinePayments') ? await api('GET', '/api/payments/stripe').catch(() => ({ connected: false })) : { connected: false };
    const P = { ...{ quoteCard: true, quoteAch: false, invoiceCard: true, invoiceAch: false, link: true, tips: false, notifyEmail: true, emailReceipts: true, disabled: false }, ...(company.paySettings || {}) };
    const can = planHas('onlinePayments');
    const sw = (k, label, note, icon, disabled) => `<label class="sw-row pay-sw">${icon ? `<span class="pay-ic" aria-hidden="true">${icon}</span>` : ''}<span class="grow">${label}${note ? `<small class="muted">${note}</small>` : ''}</span><input type="checkbox" class="sw" data-pay="${k}" ${P[k] ? 'checked' : ''} ${disabled ? 'disabled' : ''}><i></i></label>`;
    const off = !can || P.disabled;
    const methodRows = (kind) => sw(kind + 'Card', 'Card payments', 'Credit or debit cards, Apple Pay, or Google Pay', '💳', off)
      + sw(kind + 'Ach', 'Bank payments (ACH)', S.connected ? 'Clients pay directly from their bank account. Turn on ACH Direct Debit in your Stripe account too.' : 'Clients pay directly from their bank account. Needs Stripe connected.', '🏦', off || !S.connected);
    const bal = S.balance ? S.balance.pending + S.balance.available : 0;
    main.innerHTML = `<div class="head"><div><a href="/payments" data-link class="muted">← Payments</a><h1>Payment settings</h1></div></div>
<div class="pay-grid"><div>
${!can ? '<div class="notice">Online payments aren’t included in your plan. You can still record cash, check and other payments on invoices.</div>' : !S.connected ? `<div class="notice">Set up card payments in <a href="/settings#payments" data-link>App Settings → Payments → Card payments</a> to take online payments. Until then, clients can’t pay by card.</div>` : ''}
<div class="card"><h2>Client payments</h2>
<h3 class="pay-h">Quote payments<small class="muted">Let clients pay deposits online when viewing quotes</small></h3>${methodRows('quote')}
<h3 class="pay-h">Invoice payments<small class="muted">Let clients pay online when viewing invoices</small></h3>${methodRows('invoice')}
${sw('tips', 'Let clients add a tip', 'When they pay an invoice online, clients can add 10%, 15%, 20% or an amount of their own. The tip is shown on the payment and isn’t part of the invoice.', '💵', off || !(P.invoiceCard || P.invoiceAch))}
<h3 class="pay-h">Faster checkout<small class="muted">On every payment page that takes cards</small></h3>${sw('link', 'Link by Stripe', 'Clients who saved their details with Link pay in one click, with a code sent to their phone. Same rate as cards.', '⚡', off || !(P.quoteCard || P.invoiceCard))}</div>
<div class="card"><h2>Notifications</h2>${sw('notifyEmail', 'Get notified of payments by email', `Sent to ${esc(company.email || 'your company email')} when a client pays online`)}${sw('emailReceipts', 'Automatically email receipts to clients', 'Sent from your business when a client pays online')}</div>
${can ? `<div class="card pay-off"><div><h2>${P.disabled ? 'Payments are disabled' : 'Disable payments'}</h2><p class="muted">${P.disabled ? 'Clients can’t pay quotes and invoices online. Zelle, Venmo, Cash App, PayPal and recorded payments still work.' : 'Clients can’t pay outstanding or new quotes and invoices online.'}</p></div>
<button type="button" class="btn ${P.disabled ? '' : 'danger'}" data-act="payDisable" data-on="${P.disabled ? '0' : '1'}">${P.disabled ? 'Turn payments back on' : 'Disable payments'}</button></div>` : ''}
</div><aside>
<div class="card"><h2>Standard payouts</h2>
<div class="pay-side"><div><strong>Upcoming payouts</strong><div class="muted">${money(bal)}</div></div>${S.connected ? '<button type="button" class="btn alt sm" data-act="payTabPayouts">View payouts</button>' : ''}</div>
<div class="pay-side"><div><strong>Payout to</strong><div class="muted">${(() => { const b = S.bank || (company.account && company.account.payoutBank); return b ? `${esc(b.name)} • Ending in ${esc(b.last4)}` : S.connected ? 'Your bank account in Stripe' : 'No bank account yet'; })()}</div></div>${can ? '<button type="button" class="btn alt sm" data-act="payBank" aria-label="Update bank account">⋯</button>' : ''}</div></div>
${S.connected ? `<div class="card"><h2>Disputes</h2><div class="pay-side"><div><strong>${S.disputes.open ? 'Action required' : 'No action required'}</strong><div class="muted">${S.disputes.open} open dispute${S.disputes.open === 1 ? '' : 's'}</div></div><a class="btn alt sm" href="https://dashboard.stripe.com/disputes" target="_blank" rel="noopener">View disputes</a></div></div>` : ''}
<div class="card"><h2>Processing rates</h2><table class="pay-rates"><tr><td>Credit / debit cards</td><td class="r">2.9% + 30¢</td></tr><tr><td>Bank payments (ACH)</td><td class="r">0.8%, max $5</td></tr></table>
<p class="muted" style="font-size:12px;margin:8px 0 0">Stripe’s standard US rates${S.feePercent ? `, plus a ${S.feePercent}% platform fee` : ''}. Your Stripe account shows your exact rates.</p></div>
</aside></div>`;
    $$('[data-pay]', main).forEach((c) => c.addEventListener('change', async () => {
      try { company.paySettings = await api('PUT', '/api/payments/settings', { [c.dataset.pay]: c.checked }); toast('Saved'); } catch (err) { c.checked = !c.checked; toast(err.message, true); }
    }));
  },
};
A.payTabPayouts = () => { payView.tab = 'payouts'; navigate('/payments'); };
A.payDisable = async (d) => {
  const on = d.on === '1'; if (on && !confirm('Disable online payments? Clients won’t be able to pay quotes or invoices online until you turn them back on.')) return;
  company.paySettings = await api('PUT', '/api/payments/settings', { disabled: on }); toast(on ? 'Online payments disabled' : 'Online payments are back on'); refresh();
};
// where payouts go, and where to change it: depends on how the business set up card payments
A.payBank = () => {
  const a = company.account || {}; const bank = a.payoutBank; const cancel = '<button type="button" class="btn alt" data-act="closeModal">Cancel</button>';
  const stripeLink = '<a class="btn" href="https://dashboard.stripe.com/settings/payouts" target="_blank" rel="noopener">Update in Stripe</a>';
  const body = {
    // set up in the app: no Stripe dashboard, so the bank account is changed with Stripe's form in the app
    embedded: `<p>${bank ? `Payouts go to <strong>${esc(bank.name)} ••${esc(bank.last4)}</strong>.` : 'Payouts go to the bank account you added when you set up card payments.'} To use a different account, update your payout details. Stripe verifies the new account and keeps it secure.</p>
<p class="muted" style="font-size:13px">Payouts already on their way still go to the current account.</p>
<div class="foot">${cancel}<a class="btn" href="/settings/card-payments" data-link>Update payout details</a></div>`,
    standard: `<p>Payouts go to the bank account in your Stripe account. Stripe verifies it and keeps it secure, so you add or change it there, using your online banking login or your account and routing numbers.</p>
<div class="foot">${cancel}${stripeLink}</div>`,
    server: `<p>Payouts for your business go to the bank account in your platform’s Stripe account. Change it in your Stripe dashboard.</p>
<div class="foot">${cancel}${stripeLink}</div>`,
  }[a.cardSetupType] || `<p>You’ll add the bank account for payouts when you set up card payments. Stripe verifies it and keeps it secure.</p>
<div class="foot">${cancel}<a class="btn" href="/settings#payments" data-link>Set up card payments</a></div>`;
  return modal(a.cardSetupType === null || a.cardSetupType === undefined ? 'Add a bank account' : 'Update bank account', body);
};

/* ===== /settings/billing: Account and billing (the business's subscription to this service; owner only) ===== */
// Plan changes, cancelling, the card and billing details all go through Stripe from here; Stripe charges the plan automatically.
const CARD_BRANDS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', diners: 'Diners Club', jcb: 'JCB', unionpay: 'UnionPay' };
let billingData = null; let billingAll = false;
PAGES['/settings/billing'] = {
  title: 'Account and billing',
  async render(main) {
    const qs = new URLSearchParams(location.search); const back = qs.get('checkout') || qs.get('card');
    if (back) { // back from Stripe's payment or card page
      history.replaceState(null, '', location.pathname);
      try { const r = await api('POST', '/api/account/billing/return', { sessionId: back }); toast(r.message); const was = pausedNow(); company = await api('GET', '/api/company'); if (was && !pausedNow()) return refresh(); } catch (err) { toast(err.message, true); }
    } else if (qs.has('canceled') || qs.has('upgrade')) history.replaceState(null, '', location.pathname);
    const B = billingData = await api('GET', '/api/account/billing'); const sub = B.subscription;
    const per = (i) => (i === 'year' ? 'yearly' : 'monthly');
    const ending = sub && sub.cancelAtPeriodEnd; const T = B.trial;
    const withs = [B.extra && B.extra.count ? `${B.extra.count} extra login${B.extra.count === 1 ? '' : 's'}` : '', B.matrix ? 'matrix pricing' : ''].filter(Boolean); // the lines beside the plan's
    const MX = B.matrixAddon && ['on', 'ending', 'included'].includes(B.matrixAddon.state) ? B.matrixAddon : null; // the overview's Add-ons row
    const statusText = T ? `${T.prepaid ? 'Prepaid until' : T.cancelled ? 'Trial cancelled, ends' : 'Free trial until'} ${fmtDate(T.endsAt)}` : ending ? `Active until ${fmtDate(sub.periodEnd)}` : sub && sub.status === 'past_due' ? 'Payment past due' : B.status === 'suspended' ? 'Paused' : 'Active';
    const contact = '<button type="button" class="btn alt" data-act="supportForm" data-title="Contact us" data-topic="Account and billing">Contact us</button>'; // the support form, sent to the platform's inbox
    const addr = (a) => (a && a.line1 ? [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(', ') + (a.postal_code ? ' ' + a.postal_code : ''), a.country].filter((x) => x && x.trim()).map(esc).join('<br>') : '<span class="muted">No address yet</span>');
    const subText = !B.managed ? '<p class="muted">This is your platform’s own account, so it has no subscription.</p>'
      : T && T.prepaid ? `<p>Your Founding Supporter code prepaid ${esc(B.plan.name)} until <strong>${fmtDate(T.endsAt)}</strong>, with no card on file. ${B.live ? `Add a card to keep your account after that: your first payment${B.plan.charge ? ` of ${money(B.plan.charge.cents / 100)}/${B.plan.charge.interval}` : ''} is taken when your prepaid months end.` : 'After that, the account is paused unless you choose a plan.'}</p>${B.live ? '<button type="button" class="btn" data-act="billCard">Add card</button>' : ''}`
      : T && T.cancelled ? `<p>Your free trial is cancelled. You can keep using ${esc(B.productName)} until <strong>${fmtDate(T.endsAt)}</strong>, then the account is paused.</p><button type="button" class="btn" data-act="billKeep">Keep my trial</button>`
      : T ? `<p>You’re on a free trial of ${esc(B.plan.name)} until <strong>${fmtDate(T.endsAt)}</strong>, with no card on file. ${B.live ? `Add a card to keep your account after that: your first payment${B.plan.charge ? ` of ${money(B.plan.charge.cents / 100)}/${B.plan.charge.interval}` : ''} is taken when the trial ends, and you can cancel anytime before then.` : 'After that, the account is paused unless you choose a plan.'}</p>${B.live ? '<button type="button" class="btn" data-act="billCard">Add card</button>' : ''}`
      : ending && B.pendingPlan ? `<p>Your plan changes to <strong>${esc(B.pendingPlan)}</strong> on ${fmtDate(sub.periodEnd)}. You won’t be charged again.</p><button type="button" class="btn alt sm" data-act="billKeep">Stay on ${esc(B.plan.name)}</button>`
      : ending ? `<p>Your subscription is cancelled. You can keep using ${esc(B.productName)} until <strong>${fmtDate(sub.periodEnd)}</strong>, then the account is paused.</p><button type="button" class="btn" data-act="billKeep">Keep my subscription</button>`
      : sub ? `${B.prepaidUntil ? `<p>Prepaid with your Founding Supporter code until <strong>${fmtDate(B.prepaidUntil)}</strong>.</p>` : ''}<p>You will be charged <strong>${money(sub.amount + (B.extra ? (B.extra.count * B.extra.cents) / 100 : 0) + (B.matrix ? B.matrix.cents / 100 : 0))} USD</strong> for your ${per(sub.interval)} ${esc(B.plan.name)} subscription${withs.length ? ` (with ${withs.join(' and ')})` : ''} on ${fmtDate(sub.periodEnd)}, and every ${sub.interval} after that. Plus taxes where applicable.</p>${sub.status === 'past_due' ? '<p class="bill-warn">Your last payment didn’t go through. Update your card and we’ll retry it right away.</p>' : ''}`
      : B.demo ? '<p class="muted">Your account was started with a demo checkout, so nothing is charged. Pick a plan to start a paid subscription.</p>'
      : !B.plan.charge ? `<p>You’re on the ${esc(B.plan.name)} plan${B.plan.price ? ` (${esc(B.plan.price)})` : ''}. There’s nothing to pay.</p>`
      : `<p class="muted">Your ${esc(B.plan.name)} plan isn’t billed automatically yet. Choose it under Modify subscription to set up automatic payments.</p>`;
    const inv = billingAll ? B.invoices : B.invoices.slice(0, 6);
    const paused = B.paused ? explorePlans(B) : '';
    if (B.paused && !B.isOwner) { main.innerHTML = `<div class="head"><h1>Account and billing</h1></div>${paused}`; return; } // an admin choosing a plan for a paused account
    main.innerHTML = `<div class="head"><h1>Account and billing</h1></div>${paused}
<div class="card bill-ov"><div class="bill-h"><h2>Account overview</h2><div class="actions">${B.live && B.managed ? `<button type="button" class="btn alt" data-act="billCard">${B.card ? 'Update card' : 'Add card'}</button>` : ''}</div></div>
<dl class="bill-dl"><div><dt>Active since</dt><dd>${B.activeSince ? fmtDate(B.activeSince) : '—'}</dd></div><div><dt>Account status</dt><dd>${esc(statusText)}</dd></div>
<div><dt>Current plan</dt><dd>${esc(B.plan.name)}${B.plan.charge ? ` <span class="muted">(${B.plan.charge.interval === 'year' ? 'yearly' : 'monthly'}, ${money(B.plan.charge.cents / 100).replace(/\.00$/, '')}/${B.plan.charge.interval})</span>` : B.plan.price ? ` <span class="muted">(${esc(B.plan.price)})</span>` : ''}${B.plan.locked ? `<div class="muted" style="font-size:13px">Your ${B.plan.locked.name ? `${esc(B.plan.locked.name)} ` : ''}price is locked since ${fmtDate(B.plan.locked.since)} for as long as you stay on ${esc(B.plan.name)}, monthly or yearly.</div>` : ''}</dd></div>
<div><dt>Team logins</dt><dd>${B.usage.logins}${B.plan.maxUsers ? ` <span class="muted">(${B.plan.maxUsers} included${B.plan.extraUser ? `, then ${money(B.plan.extraUser).replace(/\.00$/, '')}/month each` : ''})</span>` : ' <span class="muted">(unlimited)</span>'}${B.extra && B.extra.count ? `<div class="muted" style="font-size:13px">${B.extra.count} extra login${B.extra.count === 1 ? '' : 's'} × ${money(B.extra.cents / 100).replace(/\.00$/, '')}/${B.extra.interval}</div>` : ''}</dd></div>
${MX ? `<div><dt>Add-ons</dt><dd>Matrix pricing <span class="muted">(${MX.state === 'included' ? 'included' : `${money((B.matrix ? B.matrix.cents : MX.cents) / 100).replace(/\.00$/, '')}/${B.matrix ? B.matrix.interval : MX.interval}${MX.state === 'ending' ? `, ends ${fmtDate(MX.endsAt)}` : ''}`})</span><div class="muted" style="font-size:13px"><button type="button" class="link-btn" data-act="mxSee">Manage in App Settings</button></div></dd></div>` : ''}
${B.usage.texts && B.usage.texts.limit ? `<div><dt>Texts this month</dt><dd>${B.usage.texts.sent.toLocaleString('en-US')} of ${B.usage.texts.limit.toLocaleString('en-US')}${B.usage.texts.sent >= B.usage.texts.limit ? ' <span class="muted">(used up: texts start again on the 1st)</span>' : ''}</dd></div>` : ''}</dl></div>
<div class="bill-grid">
<div class="card"><div class="bill-h"><h2>Billing details</h2>${B.live && B.managed ? '<button type="button" class="btn alt" data-act="billEdit">Edit</button>' : ''}</div>
${B.card ? `<div class="bill-card"><span class="bill-brand">${esc(CARD_BRANDS[B.card.brand] || B.card.brand)}</span><div><small class="muted">CARD NUMBER</small><div>•••• ${esc(B.card.last4)}</div></div><div class="r"><small class="muted">EXPIRY</small><div>${String(B.card.expMonth).padStart(2, '0')}/${String(B.card.expYear).slice(-2)}</div></div></div>`
  : B.link ? `<div class="bill-card"><span class="bill-brand">Link</span><div><small class="muted">PAYING WITH LINK</small><div>${esc(B.link.email) || 'Saved details'}</div></div><div></div></div>`
  : `<div class="bill-card"><span class="muted">No card on file.</span>${B.live && B.managed ? '<span></span><button type="button" class="btn alt" data-act="billCard">Add card</button>' : ''}</div>`}
${B.managed ? `<div class="bill-two"><div><strong>Name</strong><div>${esc(B.customer && B.customer.name) || '<span class="muted">—</span>'}</div>${B.customer && B.customer.email ? `<div class="muted" style="font-size:13px">${esc(B.customer.email)}</div>` : ''}</div><div><strong>Address</strong><div>${addr(B.customer && B.customer.address)}</div></div></div>` : ''}
<div class="bill-sub"><strong>Plan subscription</strong>${subText}</div></div>
<div class="card"><h2>Payment history</h2>${inv.length ? `<table class="bill-hist">${inv.map((i) => `<tr><td>${fmtDate(i.date)}</td><td class="r">${money(i.amount)} ${esc(i.currency)}</td>
<td><span class="badge ${i.status === 'paid' ? 'paid' : i.status === 'open' ? 'overdue' : 'draft'}">${esc({ paid: 'Paid', open: 'Unpaid', void: 'Void', uncollectible: 'Unpaid' }[i.status] || i.status)}</span></td>
<td class="r">${i.receiptUrl ? `<a class="btn alt sm" href="${esc(i.receiptUrl)}" target="_blank" rel="noopener">${i.status === 'open' ? 'Pay' : 'Receipt'}</a>` : ''}</td></tr>`).join('')}</table>${!billingAll && B.invoices.length > inv.length ? '<button type="button" class="link-btn" data-act="billMore">View more payments</button>' : ''}`
  : '<p class="muted">No payments yet.</p>'}</div>
${B.managed ? `<div class="card bill-change"><h2>Change subscription</h2><p${B.prepaidUntil ? " hidden" : ""}>Switch plans any time. Moving to a bigger plan takes effect right away and you’re charged the difference for the rest of this billing period; moving to a smaller plan credits the difference to your next bill.</p>
${B.prepaidUntil ? `<p class="muted">Your ${esc(B.plan.name)} plan is prepaid until ${fmtDate(B.prepaidUntil)}, so it can’t be changed before then. Contact us if you need a different plan.</p>` : ''}
${T && !T.cancelled && !T.prepaid ? `<p class="muted">You can also cancel your free trial. You keep using ${esc(B.productName)} until ${fmtDate(T.endsAt)}; after that the account is paused and your team can’t log in.</p>` : ''}
${sub && !ending ? `<p class="muted">You can also cancel anytime. You keep using ${esc(B.productName)} until the end of the period you’ve paid for; after that the account is paused and your team can’t log in.</p>` : ''}
<div class="bill-acts"><button type="button" class="btn" data-act="billModify">Modify subscription</button>${contact}${(sub && !ending) || (T && !T.cancelled && !T.prepaid) ? `<button type="button" class="link-btn bill-cancel" data-act="billCancel">Cancel ${T ? 'free trial' : 'subscription'}</button>` : ''}</div></div>` : ''}
${B.managed ? `<div class="card"><h2>Have a supporter code?</h2><p class="muted">Founding Supporters get a code by email worth prepaid months of their reward’s plan.</p>
<div class="bill-redeem"><input id="supCode" aria-label="Supporter code" placeholder="FS-XXXX-XXXX" maxlength="30" autocomplete="off" spellcheck="false"><button type="button" class="btn" data-act="billRedeem">Redeem</button></div></div>` : ''}
</div>`;
    if (qs.has('upgrade') && B.managed) A.billPlans(); // from an “Upgrade your plan” link
  },
};
// a paused account: the plans laid out like the pricing page; choosing one pays at Stripe's checkout (or reopens a free plan right away)
let xpPeriod = null;
function explorePlans(B) {
  const P = B.paused; const m = pausedMsg(P);
  if (!P.canChoosePlan) return `<div class="card xp-hero"><h2>${m.title}</h2><p class="muted">${m.text} Your data is safe, and you can still look around.</p></div>`;
  if (P.fixCard) return `<div class="card xp-hero xp-fix"><h2>${m.title}</h2><p class="muted">${m.text}</p>${B.live ? `<button type="button" class="btn" data-act="billCard">${B.card ? 'Update card' : 'Add card'}</button>` : ''}</div>`;
  const plans = B.plans.filter((p) => !p.hidden);
  const both = plans.some((p) => p.month) && plans.some((p) => p.year); const best = Math.max(0, ...plans.filter((p) => p.month && p.year).map((p) => Math.round((1 - p.year / (p.month * 12)) * 100)));
  const period = xpPeriod || (plans.some((p) => p.month) ? 'month' : 'year');
  const picked = plans.findIndex((p) => p.id === B.popularPlan); const mid = B.popularPlan === 'none' ? -1 : picked >= 0 ? picked : plans.length >= 3 ? Math.floor(plans.length / 2) : -1;
  const amount = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const per = (p) => (period === 'year' && p.year ? 'year' : p.month ? 'month' : p.year ? 'year' : '');
  const priceHtml = (p) => {
    const k = per(p); const v = k && p[k];
    if (!v) return `<div class="price">${esc(p.price || 'Free')}</div><div class="per">&nbsp;</div>`;
    const save = p.month && p.year ? Math.round((1 - p.year / (p.month * 12)) * 100) : 0;
    return `<div class="price">${amount(v)}<small>/${k}</small></div><div class="per">${k === 'year' ? `${amount(Math.round(v / 12 * 100) / 100)}/month, billed yearly${save > 0 ? ` · <strong>save ${save}%</strong>` : ''}` : period === 'year' ? 'Billed monthly only' : p.year ? `or ${amount(p.year)}/year` : 'Billed monthly'}</div>`;
  };
  return `<div class="xp"><div class="xp-hero"><h2>${m.title}</h2><p class="muted">${m.text}</p></div>
${both ? `<div class="xp-period" role="radiogroup" aria-label="Billing period">${[['month', 'Monthly'], ['year', `Yearly${best > 0 ? ` <span class="xp-save">Save up to ${best}%</span>` : ''}`]].map(([k, l]) => `<button type="button" role="radio" aria-checked="${period === k}" class="${period === k ? 'on' : ''}" data-act="xpPeriod" data-per="${k}">${l}</button>`).join('')}</div>` : ''}
<div class="xp-plans">${plans.map((p, i) => `<article class="card xp-plan ${i === mid ? 'pop' : ''}"><span class="xp-tag">${i === mid ? 'Most popular' : p.id === B.plan.id ? 'Your last plan' : ''}</span><h3>${esc(p.name)}</h3>
${priceHtml(p)}<p class="desc">${esc(p.description)}</p>
<ul><li>${p.maxUsers ? `${p.maxUsers} team login${p.maxUsers === 1 ? '' : 's'}${p.extraUser ? `, then ${money(p.extraUser).replace(/\.00$/, '')}/month each` : ''}` : 'Unlimited team logins'}</li>${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}${(B.alwaysIncluded || []).map((l) => `<li class="base">${esc(l)}</li>`).join('')}</ul>
<button type="button" class="btn ${i === mid ? '' : 'alt'}" data-act="xpChoose" data-id="${esc(p.id)}" data-per="${per(p) || 'month'}">Choose ${esc(p.name)}</button></article>`).join('')}</div>
<p class="xp-foot muted">${B.live ? 'Paid plans are paid securely at Stripe’s checkout, and your account opens again as soon as the payment goes through.' : ''} Questions? <button type="button" class="link-btn" data-act="supportForm" data-title="Contact us" data-topic="Account and billing">Contact us</button></p></div>`;
}
A.xpPeriod = (d) => { xpPeriod = d.per; refresh(); };
A.xpChoose = (d, el) => billGo('/api/account/billing/plan', { planId: d.id, interval: d.per }, el);
const billGo = async (url, body, el) => { // POST, then follow Stripe's page or show the result
  if (el) el.disabled = true;
  try { const r = await api('POST', url, body); if (r.redirect) { location.href = r.redirect; return; } closeModal(); toast(r.message || 'Saved'); refresh(); }
  catch (err) { toast(err.message, true); if (el) el.disabled = false; }
};
A.billMore = () => { billingAll = true; refresh(); };
A.billRedeem = (d, el) => { const code = $('#supCode').value.trim(); if (!code) { toast('Enter your supporter code', true); return; } billGo('/api/account/billing/redeem', { code }, el); };
A.billCard = (d, el) => billGo('/api/account/billing/card', {}, el);
A.billPlans = () => {
  const B = billingData; const sub = B.subscription; let period = B.interval === 'year' ? 'year' : 'month';
  const both = B.plans.some((p) => p.month && p.year); const amt = (n) => money(n).replace(/\.00$/, '');
  const isCurrent = (p) => !B.pendingPlan && p.id === B.plan.id && (!B.plan.charge || (p[period] ? B.interval === period : true));
  const m = modal('Change plan', `<form id="bpf">${both ? '<div class="bill-period" role="radiogroup" aria-label="Billing period"></div>' : ''}<div class="bill-plans"></div>
<p class="muted" id="bpNote" style="font-size:13px"></p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn" id="bpGo" disabled>Switch plan</button></div></form>`);
  const f = $('#bpf', m); const go = $('#bpGo', m); const note = $('#bpNote', m);
  const priceFor = (p) => p[period] || p.month || p.year; const perFor = (p) => (p[period] ? period : p.month ? 'month' : 'year');
  const draw = (keep) => {
    if (both) $('.bill-period', f).innerHTML = [['month', 'Monthly'], ['year', 'Yearly']].map(([k, l]) => `<button type="button" role="radio" aria-checked="${period === k}" class="${period === k ? 'on' : ''}" data-per="${k}">${l}</button>`).join('');
    $('.bill-plans', f).innerHTML = B.plans.map((p) => { const v = priceFor(p); const save = p.month && p.year && perFor(p) === 'year' ? Math.round((1 - p.year / (p.month * 12)) * 100) : 0;
      return `<label class="bill-plan"><input type="radio" name="planId" value="${esc(p.id)}" ${(keep || B.plan.id) === p.id ? 'checked' : ''} ${isCurrent(p) ? 'disabled' : ''}>
<span><strong>${esc(p.name)}</strong> · ${v ? `${amt(v)}/${perFor(p)}${save > 0 ? ` <span class="cstatus active">Save ${save}%</span>` : ''}` : esc(p.price || 'Free')}${isCurrent(p) ? ' <span class="cstatus active">Current plan</span>' : ''}<small class="muted">${esc(p.description)}</small></span></label>`; }).join('');
    sync();
  };
  const sync = () => {
    const p = B.plans.find((x) => x.id === (new FormData(f)).get('planId')); go.disabled = !p || isCurrent(p);
    if (!p || isCurrent(p)) { note.textContent = ''; go.textContent = 'Switch plan'; return; }
    const v = priceFor(p); const per = perFor(p); go.textContent = p.id === B.plan.id ? `Switch to ${per === 'year' ? 'yearly' : 'monthly'} billing` : `Switch to ${p.name}`;
    note.textContent = !v ? (sub ? `You’ll keep ${B.plan.name} until ${fmtDate(sub.periodEnd)}, then move to ${p.name}. You won’t be charged again.` : `You’ll move to ${p.name} right away.`)
      : sub && per !== B.interval ? `Your unused time is credited, then ${amt(v)} is charged to your card${B.card ? ` ending in ${B.card.last4}` : ''} now and every ${per} after that.`
      : B.trial ? `You’ll move to ${p.name} now. It’s free until your trial ends on ${fmtDate(B.trial.endsAt)}, then ${amt(v)}/${per} once you add a card.`
      : sub ? `Your card${B.card ? ` ending in ${B.card.last4}` : ''} is charged or credited the difference for the rest of this billing period, then ${amt(v)}/${per} from your next bill.`
      : `You’ll go to Stripe’s secure checkout to pay ${amt(v)}/${per}. After that, Stripe charges your card automatically every ${per}.`;
  };
  f.addEventListener('change', sync);
  f.addEventListener('click', (e) => { const b = e.target.closest('[data-per]'); if (b) { period = b.dataset.per; draw((new FormData(f)).get('planId')); } });
  draw();
  f.addEventListener('submit', (e) => { e.preventDefault(); const p = B.plans.find((x) => x.id === (new FormData(f)).get('planId')); billGo('/api/account/billing/plan', { planId: p.id, interval: perFor(p) }, go); });
};
A.billEdit = () => {
  const C = (billingData.customer || {}); const a = C.address || {};
  const m = modal('Billing details', `<form id="bdf"><div class="row"><label>Name on bills<input name="name" required maxlength="200" value="${esc(C.name || company.name || '')}"></label><label>Email for receipts<input name="email" type="email" required value="${esc(C.email || (me && me.email) || '')}"></label></div>
<label>Address<input name="line1" maxlength="200" value="${esc(a.line1 || '')}" autocomplete="address-line1"></label><label>Apartment, suite (optional)<input name="line2" maxlength="200" value="${esc(a.line2 || '')}" autocomplete="address-line2"></label>
<div class="row3"><label>City<input name="city" maxlength="100" value="${esc(a.city || '')}"></label><label>State<input name="state" maxlength="100" value="${esc(a.state || '')}"></label><label>ZIP code<input name="postal_code" maxlength="20" value="${esc(a.postal_code || '')}"></label></div>
<label>Country<select name="country">${[['US', 'United States'], ['CA', 'Canada'], ['GB', 'United Kingdom'], ['AU', 'Australia'], ['MX', 'Mexico']].map(([k, l]) => `<option value="${k}" ${(a.country || 'US') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
<div class="bill-cardrow"><span>Card: ${billingData.card ? `${esc(CARD_BRANDS[billingData.card.brand] || billingData.card.brand)} •••• ${esc(billingData.card.last4)}` : billingData.link ? `Link${billingData.link.email ? ` (${esc(billingData.link.email)})` : ''}` : 'none on file'}</span><button type="button" class="btn alt" data-act="billCard">${billingData.card || billingData.link ? 'Update card' : 'Add card'}</button></div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  $('#bdf', m).addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('button.btn:not(.alt)', e.target); btn.disabled = true;
    try { await api('PUT', '/api/account/billing/details', Object.fromEntries(new FormData(e.target))); closeModal(); toast('Billing details saved'); refresh(); } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
};
// Modify subscription: upgrade, extend the trial or downgrade; Cancel plan walks through why, an offer that fits the reason,
// what pauses, feedback and a last discount, then the owner's password confirms it (server: /api/account/billing/retain and /cancel)
// Modify subscription and the cancel steps: public/cancelflow.js (shared with Alpha's Test the flow)
A.billModify = (d) => cancelFlow(billingData, { step: d && d.step, me, company, api, toast, fmtDate, money, billGo, plans: () => A.billPlans() });
A.billCancel = () => A.billModify({ step: 'reasons' });
A.billKeep = (d, el) => billGo('/api/account/billing/cancel', { undo: true }, el);

/* ===== /settings/support-access: let the support team into your login for four weeks (everyone; the owner also sees the whole team) ===== */
const shortName = (n) => { const [first, ...rest] = String(n || 'Support').trim().split(/\s+/); return rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first; };
const SUPPORT_STATUS = { pending: 'Waiting for approval', granted: 'Granted', expired: 'Expired', revoked: 'Revoked', declined: 'Declined', cancelled: 'Withdrawn' };
PAGES['/settings/support-access'] = {
  title: 'Support Access',
  async render(main) {
    const S = await api('GET', '/api/account/support-access'); const r = S.current; const product = esc(S.productName || 'our');
    const ends = fmtDate((r && r.expiresAt ? new Date(r.expiresAt) : addDays(new Date(), S.grantDays)).toISOString().slice(0, 10));
    const who = `your ${product} ${S.isOwner ? 'account' : 'login'}`;
    const terms = `<p>By providing access to ${who}, you’re granting ${product} support:</p>
<ul><li>Permission to access ${who} for a four week period, ending on ${ends}</li><li>Permission to create, modify, or delete data in your account if necessary to resolve the issue</li></ul>
<p>Support signs in as you (${esc(me.name)}) and sees exactly what you see. Once granted, access may be revoked at any time from this page by clicking on the “Revoke” button.</p>`;
    const reason = r && r.reason ? `<blockquote class="sa-reason">${esc(r.reason)}</blockquote>` : '';
    const card = !r ? `<div class="card sa-card"><h2>No access requests</h2><p class="muted">When ${product} support needs to look at ${who} to help with an issue, their request will show up here, and nothing changes until you approve it. Need help now? Use <a href="#" data-act="supportForm">Get Support</a>.</p></div>`
      : r.status === 'pending' ? `<div class="card sa-card pending"><h2>Access Requested</h2><p><strong>${esc(shortName(r.adminName))}</strong> is requesting access to ${who} to assist in troubleshooting an issue.</p>${reason}${terms}
<div class="sa-acts"><button type="button" class="btn" data-act="supportAnswer" data-id="${esc(r.id)}" data-a="grant">Grant Access</button><button type="button" class="btn alt" data-act="supportAnswer" data-id="${esc(r.id)}" data-a="decline">Decline</button></div></div>`
      : `<div class="card sa-card granted"><h2>Access Granted</h2><p><strong>${esc(shortName(r.adminName))}</strong> is requesting access to ${who} to assist in troubleshooting an issue.</p>${reason}${terms}
<p class="muted">Granted on ${fmtDate(r.grantedAt.slice(0, 10))}${r.lastUsedAt ? ` · last used ${fmtDate(r.lastUsedAt.slice(0, 10))}` : ' · not used yet'}</p>
<div class="sa-acts"><button type="button" class="btn alt sa-revoke" data-act="supportAnswer" data-id="${esc(r.id)}" data-a="revoke">Revoke Access</button></div></div>`;
    // the owner: everyone else's open requests and grants, which they can revoke
    const team = S.isOwner && S.team.length ? `<h2 class="sa-h">Your Team</h2><p class="muted" style="margin:-4px 0 12px">Support access your team members were asked for or have granted. You can revoke any of it.</p>
<div class="card sa-hist"><table><thead><tr><th>Team member</th><th>Requested by</th><th>Status</th><th></th></tr></thead><tbody>
${S.team.map((x) => `<tr><td>${esc(x.userName)}</td><td>${esc(shortName(x.adminName))}${x.reason ? `<div class="muted">${esc(x.reason)}</div>` : ''}</td><td>${x.status === 'granted' ? `Granted until ${fmtDate(x.expiresAt.slice(0, 10))}` : SUPPORT_STATUS.pending}</td>
<td class="r"><button type="button" class="btn alt sm sa-revoke" data-act="supportAnswer" data-id="${esc(x.id)}" data-a="revoke" data-who="${esc(x.userName)}">${x.status === 'granted' ? 'Revoke' : 'Cancel request'}</button></td></tr>`).join('')}</tbody></table></div>` : '';
    const col = S.isOwner; // the owner's history covers the whole team
    main.innerHTML = `<h1 class="sa-title">Grant Access to Your Account</h1>${card}${team}
<h2 class="sa-h">Previous Requests</h2><div class="card sa-hist"><table><thead><tr>${col ? '<th>Team member</th>' : ''}<th>Requested by</th><th>Status</th><th class="r">Ended</th></tr></thead><tbody>
${S.history.length ? S.history.map((h) => `<tr>${col ? `<td>${esc(h.userName || '')}</td>` : ''}<td>${esc(shortName(h.adminName))}${h.reason ? `<div class="muted">${esc(h.reason)}</div>` : ''}</td><td>${SUPPORT_STATUS[h.status] || esc(h.status)}</td><td class="r">${h.endedAt ? fmtDate(h.endedAt.slice(0, 10)) : '—'}</td></tr>`).join('')
  : `<tr><td colspan="${col ? 4 : 3}" class="muted">No previous requests.</td></tr>`}</tbody></table></div>`;
  },
};
A.supportAnswer = async (d, el) => {
  if (d.a === 'revoke' && !confirm(d.who ? `Revoke support access to ${d.who}’s login? Anyone from support signed in as them is signed out right away.` : 'Revoke support access? Anyone from support who is signed in is signed out right away.')) return;
  el.disabled = true;
  try { await api('POST', `/api/account/support-access/${encodeURIComponent(d.id)}/${d.a}`, {}); toast({ grant: 'Support access granted', decline: 'Request declined', revoke: 'Support access revoked' }[d.a]); refresh(); }
  catch (err) { el.disabled = false; throw err; }
};

/* ===== /rewards: Refer & Earn (the platform's referral program, set up in Alpha → Pricing) ===== */
const REF_STATUS = { invited: ['Invited', ''], 'signed up': ['Signed up', 'q-sent'], subscribed: ['Subscribed', 'active'] };
// a YouTube link plays in the page; any other video opens in a new tab
const youTubeId = (u) => { const m = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(u || ''); return m ? m[1] : ''; };
PAGES['/rewards'] = {
  title: 'Refer & Earn',
  async render(main) {
    const R = await api('GET', '/api/rewards'); const s = R.stats;
    const share = encodeURIComponent(R.link); const text = encodeURIComponent(`I run my business on ${company.account.productName}. Try it:`);
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const yt = R.video && youTubeId(R.video.url);
    main.innerHTML = `<div class="rf-page"><section class="rf-hero${R.heroImage ? ' has-img' : ''}"><div class="rf-hero-copy"><h1>${esc(R.title)}</h1><p>${esc(R.intro)}</p>${R.friendOffer ? `<p class="rf-offer">Your friends get <strong>${esc(R.friendOffer)}</strong>.</p>` : ''}
<button type="button" class="rf-copy" data-act="copyRefLink">Copy your referral link</button>
<form id="refForm" class="rf-form"><div class="rf-row"><input name="firstName" placeholder="First name" aria-label="Friend’s first name" required maxlength="60"><input name="company" placeholder="Company name" aria-label="Friend’s company" maxlength="100"></div>
<input name="email" type="email" placeholder="Email" aria-label="Friend’s email" required>
<p class="rf-fine">By submitting, you confirm you know this person and have their permission to share their information. We’ll send them one email with your referral link.</p>
<div class="rf-actions"><button class="btn">Invite</button><span class="rf-share" aria-label="Share your link"><button type="button" data-act="copyRefLink" title="Copy link" aria-label="Copy link">${svgIcon('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>', 18)}</button>
<a href="mailto:?subject=${encodeURIComponent(`Try ${company.account.productName}`)}&body=${text}%20${share}" title="Share by email" aria-label="Share by email">${svgIcon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', 18)}</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=${share}" target="_blank" rel="noopener" title="Share on Facebook" aria-label="Share on Facebook"><b>f</b></a>
<a href="https://www.linkedin.com/sharing/share-offsite/?url=${share}" target="_blank" rel="noopener" title="Share on LinkedIn" aria-label="Share on LinkedIn"><b>in</b></a>
<a href="https://twitter.com/intent/tweet?text=${text}&url=${share}" target="_blank" rel="noopener" title="Share on X" aria-label="Share on X"><b>𝕏</b></a></span></div></form></div>
${R.heroImage ? `<div class="rf-hero-img" style="background-image:url('${esc(R.heroImage)}')" role="img" aria-label=""></div>` : ''}</section>
<div class="rf-steps"><div>${svgIcon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', 22)}<h3>Enter your friend’s details</h3><p>Fill in the form, or share your link, and we’ll send them a personalized invite.</p></div>
<div>${svgIcon('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>', 22)}<h3>Your friend gets a head start</h3><p>${R.friendOffer ? `They sign up with your link and get ${esc(R.friendOffer)}.` : 'They sign up with your link and get set up in minutes.'}</p></div>
<div>${svgIcon(ICONS.gift, 22)}<h3>Earn rewards for every referral</h3><p>${R.months ? `Get ${plural(R.months, 'month')} of credit for every business that subscribes` : 'Earn rewards as your friends subscribe'}${R.milestones.length ? ', and unlock milestone rewards as you refer more.' : '.'}</p></div></div>
${R.milestones.length ? `<h2 class="rf-h">Milestone rewards</h2><p class="muted rf-sub">Bonus rewards on top of your regular credit. The more friends that subscribe, the more rewards you get.</p>
<div class="rf-miles">${R.milestones.map((m, i) => { const next = R.milestones.findIndex((x) => !x.done); const pct = Math.min(100, Math.round((s.subscribed / m.count) * 100)); return `<article class="card rf-mile${m.done ? ' done' : ''}">
<div class="rf-mile-img"${m.image ? ` style="background-image:url('${esc(m.image)}')"` : ''}>${m.image ? '' : svgIcon(ICONS.gift, 44)}<span class="rf-badge">${m.done ? (m.reward && m.reward.status === 'sent' ? 'Sent' : 'Unlocked') : i === next ? 'In progress' : 'Locked'}</span></div>
<h3>${esc(m.title)}</h3>${m.desc ? `<p>${esc(m.desc)}</p>` : ''}<div class="rf-prog"><span style="width:${pct}%"></span></div><div class="muted rf-count">${Math.min(s.subscribed, m.count)} of ${plural(m.count, 'referral')}</div></article>`; }).join('')}</div>` : ''}
<h2 class="rf-h">Your stats</h2>
<div class="rf-stats"><div class="card"><span>Referrals sent</span><b>${s.sent}</b><small>invitation${s.sent === 1 ? '' : 's'}</small></div><div class="card"><span>Signed up</span><b>${s.signedUp}</b><small>${s.subscribed} paying</small></div>
<div class="card"><span>Total credit earned</span><b>${s.earned}</b><small>month${s.earned === 1 ? '' : 's'}</small></div><div class="card"><span>Credit remaining</span><b>${s.remaining}</b><small>month${s.remaining === 1 ? '' : 's'}${s.banked ? ', starting when you subscribe' : ''}</small></div></div>
<h2 class="rf-h">All referrals</h2>
<div class="card ctable"><div class="tablewrap"><table><tr><th>Name</th><th class="m-hide">Email</th><th>Date referred</th><th>Status</th></tr>
${R.referrals.map((r) => `<tr><td><strong>${esc(r.name || '—')}</strong>${r.company ? `<div class="muted">${esc(r.company)}</div>` : ''}<div class="muted m-only">${esc(r.email)}</div></td><td class="m-hide">${esc(r.email)}</td><td>${fmtDate((r.date || '').slice(0, 10))}${r.via === 'link' ? '<div class="muted">Used your link</div>' : ''}</td><td><span class="cstatus ${REF_STATUS[r.status][1]}">${REF_STATUS[r.status][0]}</span></td></tr>`).join('') || '<tr><td colspan="4" class="empty">You haven’t sent any referrals yet.</td></tr>'}</table></div></div>
${R.video ? `<section class="rf-video card"><div><h2>${esc(R.video.title || 'How referrals work')}</h2>${R.video.text ? `<p>${esc(R.video.text)}</p>` : ''}${yt ? '' : `<a class="btn" href="${esc(R.video.url)}" target="_blank" rel="noopener">Watch the video</a>`}</div>
${yt ? `<div class="rf-embed"><iframe src="https://www.youtube-nocookie.com/embed/${yt}" title="${esc(R.video.title || 'Video')}" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>` : ''}</section>` : ''}</div>`;
    main._refLink = R.link;
    $('#refForm', main).addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; const b = $('.btn', f); b.disabled = true;
      try { const r = await api('POST', '/api/rewards/invite', Object.fromEntries(new FormData(f))); toast(r.emailed ? `Invitation sent to ${f.email.value}` : `Saved. The email wasn’t sent (${r.detail || 'email isn’t set up'}), so share your link instead.`, !r.emailed); refresh(); }
      catch (err) { b.disabled = false; toast(err.message, true); }
    });
  },
};
A.copyRefLink = () => { const l = $('#main')._refLink; navigator.clipboard.writeText(l).then(() => toast('Referral link copied'), () => prompt('Copy your referral link:', l)); };


/* ===== Service plans & memberships (a plan feature): plans the business sells on repeat, and the clients on them ===== */
let SP = { plans: [], memberships: [], mrr: 0 }; let spShow = 'active';
const SP_EVERY = { month: 'month', quarter: 'quarter', year: 'year' };
const spPrice = (x) => `${money(x.price)} / ${SP_EVERY[x.interval]}`;
const spVisits = (n) => (!n ? 'No visits included' : n === 12 ? '1 visit a month' : `${n} visit${n === 1 ? '' : 's'} a year`);
PAGES['/service-plans'] = {
  title: 'Service Plans',
  async render(main) {
    SP = await api('GET', '/api/service-plans');
    const active = SP.memberships.filter((m) => m.status === 'active'); const soon = ymd(addDays(new Date(), 30));
    const due = active.filter((m) => m.nextBill <= soon); const list = SP.memberships.filter((m) => spShow === 'all' || m.status === 'active');
    const plans = SP.plans.filter((p) => !p.archived); const archived = SP.plans.filter((p) => p.archived);
    const planCard = (p) => `<div class="card sp-plan${p.archived ? ' sp-arch' : ''}"><div class="sp-ph"><h3>${esc(p.name)}</h3><button type="button" class="btn alt sm" data-act="spPlan" data-id="${p.id}">Edit</button></div>
<div class="sp-price">${spPrice(p)}</div>${p.description ? `<p class="muted sp-desc">${esc(p.description)}</p>` : ''}
<ul class="sp-facts"><li>${spVisits(p.visitsPerYear)}</li><li>${p.discount ? `${p.discount}% off other work for members` : 'No member discount'}</li><li>${p.taxable ? 'Sales tax added' : 'No sales tax'}</li></ul>
<div class="sp-pf"><span class="muted">${p.members} active member${p.members === 1 ? '' : 's'}</span>${p.archived ? '<span class="cstatus q-draft">Archived</span>' : `<button type="button" class="link-btn" data-act="spJoin" data-plan="${p.id}">+ Add a client</button>`}</div></div>`;
    const row = (m) => `<tr><td><a href="/clients/view?id=${esc(m.clientId)}" data-link><strong>${esc(m.client)}</strong></a></td><td>${esc(m.name)}<div class="muted sm">${spPrice(m)}</div></td>
<td>${fmtDate(m.start)}</td><td>${m.status === 'active' ? fmtDate(m.nextBill) : '<span class="muted">—</span>'}</td>
<td>${m.nextVisit ? `<a href="/jobs/edit?id=${esc(m.nextVisit.id)}" data-link>${fmtDate(m.nextVisit.date)}</a>` : '<span class="muted">—</span>'}</td>
<td class="r">${m.unpaid ? `<span class="sp-owe">${money(m.unpaid)}</span>` : money(0)}</td>
<td>${m.status === 'active' ? `<span class="cstatus active">Active</span>${m.autoSend ? '' : '<div class="muted sm">Invoices not emailed automatically</div>'}` : `<span class="cstatus q-draft" title="${esc(m.canceledBy ? 'By ' + m.canceledBy : '')}">Canceled ${m.canceledAt ? fmtDate(m.canceledAt.slice(0, 10)) : ''}</span>`}</td>
<td class="actions">${m.status === 'active' ? `<details class="menu"><summary class="btn alt sm" aria-label="Membership options">•••</summary><div class="menu-list"><button type="button" data-act="spAuto" data-id="${m.id}">${m.autoSend ? 'Stop emailing invoices' : 'Email invoices automatically'}</button><button type="button" class="danger-text" data-act="spCancel" data-id="${m.id}">Cancel membership</button></div></details>` : ''}</td></tr>`;
    main.innerHTML = `<div class="head"><div><h1>Service Plans</h1><p class="sub">Plans your clients pay for on repeat, with visits included. Each billing period an invoice is made for every member, and their visits are scheduled ahead as repeating jobs.</p></div>
<div class="ts-acts"><button type="button" class="btn alt" data-act="spPlan">New plan</button>${plans.length ? '<button type="button" class="btn" data-act="spJoin">Add a client</button>' : ''}</div></div>
<div class="grid g3">${stat('Active members', active.length, `${plans.length} plan${plans.length === 1 ? '' : 's'}`)}${stat('Monthly recurring revenue', money(SP.mrr), `${money(SP.mrr * 12)} a year`)}${stat('Billing in the next 30 days', due.length, due.length ? money(due.reduce((s, m) => s + m.price, 0)) : 'Nothing due')}</div>
<div class="card"><div class="sp-mh"><h2>Members</h2>${SP.memberships.length > active.length ? `<label class="ts-who"><select id="spShow" aria-label="Show"><option value="active">Active</option><option value="all" ${spShow === 'all' ? 'selected' : ''}>Active and canceled</option></select></label>` : ''}</div>
${list.length ? `<div class="tablewrap"><table class="m-sp"><tr><th>Client</th><th>Plan</th><th>Since</th><th>Next bill</th><th>Next visit</th><th class="r">Unpaid</th><th>Status</th><th></th></tr>${list.map(row).join('')}</table></div>`
    : `<p class="muted" style="margin:0">${plans.length ? 'No clients on a plan yet. Add one with Add a client, or from a client’s page.' : 'Make a plan first (New plan), then add clients to it.'}</p>`}</div>
<h2 class="sp-h">Plans</h2><div class="sp-plans">${plans.map(planCard).join('') || '<div class="card"><p class="muted" style="margin:0">No plans yet. A plan is a price billed every month, quarter or year, with the visits it includes, like “Comfort Club: $19/month, 2 tune-ups a year, 15% off repairs”.</p><p style="margin:12px 0 0"><button type="button" class="btn" data-act="spPlan">New plan</button></p></div>'}</div>
${archived.length ? `<details class="sp-archd"><summary class="muted">Archived plans (${archived.length})</summary><div class="sp-plans">${archived.map(planCard).join('')}</div></details>` : ''}`;
    const sh = $('#spShow'); if (sh) sh.addEventListener('change', (e) => { spShow = e.target.value; refresh(); });
  },
};
// a plan: new or edited (changes apply to clients who join from now on)
A.spPlan = (d) => {
  const p = (d && d.id && SP.plans.find((x) => x.id === d.id)) || { interval: 'month', visitsPerYear: 2, visitHours: 1, discount: 0 };
  const mb = modal(p.id ? 'Edit plan' : 'New service plan', `<form class="sp-form"><label>Name<input name="name" required maxlength="80" value="${esc(p.name || '')}" placeholder="e.g. Comfort Club"></label>
<label>What’s included<textarea name="description" rows="2" maxlength="1000" placeholder="e.g. Two tune-ups a year and priority scheduling">${esc(p.description || '')}</textarea></label>
<div class="row"><label>Price ($)<input name="price" type="number" step="0.01" min="0" required value="${p.price ?? ''}"></label><label>Billed every<select name="interval">${Object.keys(SP_EVERY).map((k) => `<option value="${k}" ${p.interval === k ? 'selected' : ''}>${SP_EVERY[k]}</option>`).join('')}</select></label></div>
<div class="row"><label>Visits included<select name="visitsPerYear">${[0, 1, 2, 3, 4, 6, 12].map((n) => `<option value="${n}" ${Number(p.visitsPerYear) === n ? 'selected' : ''}>${spVisits(n)}</option>`).join('')}</select></label><label>Each visit takes (hours)<input name="visitHours" type="number" step="0.5" min="0.5" max="12" value="${esc(p.visitHours ?? 1)}"></label></div>
<label>Visit title<input name="visitTitle" maxlength="120" value="${esc(p.visitTitle || '')}" placeholder="${esc((p.name || 'Plan') + ' visit')}"></label>
<div class="row"><label>Member discount (%)<input name="discount" type="number" step="0.5" min="0" max="100" value="${esc(p.discount ?? 0)}"><span class="muted sm">Taken off members’ new quotes and invoices automatically</span></label>
<label class="switchline sp-tax"><input type="checkbox" name="taxable" ${p.taxable ? 'checked' : ''}> Add sales tax to the plan’s invoices</label></div>
${p.id ? `<p class="muted sm" style="margin:0">Changes apply to clients who join from now on.${p.members ? ` The ${p.members} current member${p.members === 1 ? ' keeps' : 's keep'} the price and terms they joined with.` : ''}</p>` : ''}
<div class="foot">${p.id ? `<button type="button" class="btn alt" data-act="spArchive" data-id="${p.id}">${p.archived ? 'Unarchive' : 'Archive'}</button>${p.members ? '' : `<button type="button" class="btn danger" data-act="spDelPlan" data-id="${p.id}">Delete</button>`}` : ''}<button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save plan</button></div></form>`);
  $('form', mb).addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); b.taxable = !!b.taxable; b.archived = !!p.archived;
    try { p.id ? await api('PUT', '/api/service-plans/' + p.id, b) : await api('POST', '/api/service-plans', b); closeModal(); toast('Plan saved'); refresh(); } catch (x) { toast(x.message, true); }
  });
};
A.spArchive = async (d) => { const p = SP.plans.find((x) => x.id === d.id); try { await api('PUT', '/api/service-plans/' + p.id, { archived: !p.archived }); closeModal(); toast(p.archived ? 'Plan unarchived' : 'Plan archived: nobody new can join it'); refresh(); } catch (x) { toast(x.message, true); } };
A.spDelPlan = async (d) => { if (!confirm('Delete this plan?')) return; try { await api('DELETE', '/api/service-plans/' + d.id); closeModal(); toast('Plan deleted'); refresh(); } catch (x) { toast(x.message, true); } };
// put a client on a plan (from Service Plans, or a client's page)
A.spJoin = async (d) => {
  SP = await api('GET', '/api/service-plans');
  const plans = SP.plans.filter((p) => !p.archived); if (!plans.length) return toast('Make a plan first on Service Plans', true);
  const today = ymd(new Date()); const team = D.staff.filter((s) => s.status !== 'deactivated');
  const mb = modal('Add a client to a plan', `<form class="sp-form"><label>Client<select name="clientId" required>${clientOptions(d.client || '')}</select></label>
<label>Plan<select name="planId" required>${plans.map((p) => `<option value="${p.id}" ${d.plan === p.id ? 'selected' : ''}>${esc(p.name)} · ${spPrice(p)}</option>`).join('')}</select></label>
<div class="row"><label>Starts<input type="date" name="start" required value="${today}"><span class="muted sm">The first invoice is made on this day</span></label><label class="sp-v">First visit<input type="date" name="firstVisit" value="${today}"></label></div>
<div class="sp-v"><div class="row"><label>Visit time<input type="time" name="startTime" value="09:00"></label><span></span></div>
<div class="muted qlabel">Team for the visits</div><div class="team-pick">${team.map((s) => `<label><input type="checkbox" name="staff" value="${s.id}">${avatarHtml(s, 24)}${esc(s.name)}</label>`).join('') || '<span class="muted">Add team members on Manage Team first</span>'}</div></div>
<label class="switchline"><input type="checkbox" name="autoSend" checked> Email each invoice to the client automatically, with the pay link</label>
<p class="muted sm sp-sum" style="margin:0"></p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Add to plan</button></div></form>`, true);
  const f = $('form', mb);
  const draw = () => { const p = plans.find((x) => x.id === f.planId.value); $$('.sp-v', f).forEach((el) => { el.hidden = !p.visitsPerYear; });
    const c = byId(D.clients, f.clientId.value); f.autoSend.disabled = !!c && !c.email; if (c && !c.email) f.autoSend.checked = false;
    $('.sp-sum', f).textContent = `${spPrice(p)} from ${fmtDate(f.start.value || today)}${p.visitsPerYear ? `, ${spVisits(p.visitsPerYear).toLowerCase()} from ${fmtDate(f.firstVisit.value || f.start.value || today)}` : ''}${p.discount ? `, ${p.discount}% off other work` : ''}.${c && !c.email ? ' This client has no email address, so send their invoices yourself.' : ''}`; };
  f.addEventListener('change', (e) => { if (e.target.name === 'start' && f.firstVisit.value < e.target.value) f.firstVisit.value = e.target.value; draw(); }); draw();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = new FormData(f); const btn = $('.foot .btn:not(.alt)', f); btn.disabled = true;
    try {
      const r = await api('POST', '/api/memberships', { clientId: fd.get('clientId'), planId: fd.get('planId'), start: fd.get('start'), firstVisit: fd.get('firstVisit'), startTime: fd.get('startTime'), staffIds: fd.getAll('staff'), autoSend: !!fd.get('autoSend') });
      closeModal(); toast(`Added to ${r.membership.name}${r.visits ? ` · ${r.visits} visit${r.visits === 1 ? '' : 's'} scheduled` : ''}${r.invoices.length ? ` · invoice ${r.invoices.map((i) => i.number).join(', ')} ${r.invoices[0].status === 'sent' ? 'emailed' : 'made'}` : ''}`); refresh();
    } catch (x) { toast(x.message, true); btn.disabled = false; }
  });
};
A.spAuto = async (d) => { const m = SP.memberships.find((x) => x.id === d.id); try { await api('PUT', '/api/memberships/' + m.id, { autoSend: !m.autoSend }); toast(m.autoSend ? 'Invoices won’t be emailed automatically' : 'Invoices will be emailed automatically'); refresh(); } catch (x) { toast(x.message, true); } };
A.spCancel = async (d) => {
  const m = SP.memberships.find((x) => x.id === d.id) || {};
  if (!confirm(`Cancel ${m.client || 'this client'}’s ${m.name || ''} plan? No more invoices are made, and upcoming plan visits nobody has worked on are removed. Invoices already made stay.`)) return;
  try { const r = await api('POST', `/api/memberships/${d.id}/cancel`); toast(`Membership canceled${r.removed ? ` · ${r.removed} upcoming visit${r.removed === 1 ? '' : 's'} removed` : ''}`); refresh(); } catch (x) { toast(x.message, true); }
};


/* ===== Settings → Checklists & Forms (a plan feature): the business's checklist templates. Filling them in on a job is in app.js (jfOpenForm) ===== */
let JF = { templates: [], types: {} };
const JF_STARTERS = [
  { name: 'Job completion checklist', description: 'Before leaving the site', requiredToComplete: true, fields: [
    { type: 'check', label: 'Work matches what was quoted', required: true }, { type: 'check', label: 'Work area cleaned up and debris removed', required: true },
    { type: 'check', label: 'Walked the client through the finished work' }, { type: 'photo', label: 'After photos', required: true }, { type: 'longtext', label: 'Notes for the office' }] },
  { name: 'Site safety check', description: 'Before starting work', fields: [
    { type: 'yesno', label: 'Work area is clear of hazards', required: true }, { type: 'yesno', label: 'PPE worn by everyone on site', required: true },
    { type: 'yesno', label: 'Power / water shut off where needed' }, { type: 'text', label: 'Hazards noted' }] },
  { name: 'Equipment inspection', description: 'Record the equipment and its condition', fields: [
    { type: 'heading', label: 'Equipment' }, { type: 'text', label: 'Make and model', required: true }, { type: 'text', label: 'Serial number' }, { type: 'number', label: 'Age (years)' },
    { type: 'heading', label: 'Condition' }, { type: 'choice', label: 'Overall condition', options: ['Good', 'Fair', 'Poor'], required: true }, { type: 'yesno', label: 'Operating safely', required: true },
    { type: 'photo', label: 'Photos of the equipment' }, { type: 'longtext', label: 'Recommended repairs' }] },
];
const jfTypeIco = { heading: 'H', check: '☑', yesno: '✓✗', text: 'Aa', longtext: '¶', number: '#', choice: '◉', date: '📅', photo: '📷' };
PAGES['/settings/job-forms'] = {
  title: 'Checklists & Forms',
  async render(main) {
    JF = await api('GET', '/api/form-templates');
    const live = JF.templates.filter((t) => !t.archived); const arch = JF.templates.filter((t) => t.archived);
    const card = (t) => { const n = t.fields.filter((f) => f.type !== 'heading').length; const svcNames = (t.services || []).map((id) => (byId(D.services || [], id) || {}).name).filter(Boolean);
      const tags = [t.autoAdd && 'On every new job', svcNames.length && esc(`On jobs with ${svcNames.length > 2 ? `${svcNames.slice(0, 2).join(', ')} +${svcNames.length - 2}` : svcNames.join(' or ')}`), t.requiredToComplete && 'Required before completing', t.clientVisible && 'Shared with the client'].filter(Boolean);
      return `<div class="card jf-tpl${t.archived ? ' sp-arch' : ''}"><div class="sp-ph"><h3>${esc(t.name)}</h3>${JF.manage ? `<button type="button" class="btn alt sm" data-act="jfTpl" data-id="${t.id}">Edit</button>` : ''}</div>
${t.description ? `<p class="muted sp-desc">${esc(t.description)}</p>` : ''}<p class="jf-tn">${n} item${n === 1 ? '' : 's'}${t.fields.some((f) => f.type === 'photo') ? ' · photos' : ''}</p>
${tags.length ? `<div class="jf-tags">${tags.map((x) => `<span>${x}</span>`).join('')}</div>` : ''}</div>`; };
    main.innerHTML = `<div class="head"><div><h1>Checklists &amp; Forms</h1><p class="sub">Checklists your team fills in on a job: inspections, safety checks, required photos. Add one to a job from its page, or have it added to every new job or to jobs with certain products or services.</p></div>
${JF.manage ? '<div class="ts-acts"><button type="button" class="btn" data-act="jfTpl">New checklist</button></div>' : ''}</div>
${live.length ? `<div class="sp-plans">${live.map(card).join('')}</div>` : `<div class="card"><p style="margin:0 0 12px"><strong>No checklists yet.</strong> Start from one of these and change it to suit you, or make your own.</p>
<div class="jf-starters">${JF_STARTERS.map((s, i) => `<button type="button" class="jf-row" data-act="jfTpl" data-starter="${i}"><span class="jf-ic">${svgIcon(JF_ICO, 22)}</span><span class="jf-main"><strong>${esc(s.name)}</strong><small>${esc(s.description)} · ${s.fields.filter((f) => f.type !== 'heading').length} items</small></span></button>`).join('')}</div></div>`}
${arch.length ? `<details class="sp-archd"><summary class="muted">Archived (${arch.length})</summary><div class="sp-plans">${arch.map(card).join('')}</div></details>` : ''}`;
  },
};
// the editor: name, settings and the items (type, wording, required, choices), each movable
A.jfTpl = (d) => {
  const src = d.id ? JF.templates.find((x) => x.id === d.id) : d.starter !== undefined ? JF_STARTERS[Number(d.starter)] : null;
  const t = structuredClone(src || { name: '', description: '', fields: [{ type: 'check', label: '', required: false }] }); t.fields = t.fields.map((f) => ({ options: [], ...f, _k: Math.random().toString(36).slice(2) }));
  const types = Object.entries(JF.types);
  const row = (f, i) => `<div class="jf-erow" data-k="${f._k}"><div class="jf-etop"><select data-e="type" aria-label="Item type">${types.map(([k, l]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${jfTypeIco[k] || ''}  ${l}</option>`).join('')}</select>
<span class="jf-emove"><button type="button" class="btn alt sm" data-e="up" ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button type="button" class="btn alt sm" data-e="down" ${i < t.fields.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button><button type="button" class="btn alt sm" data-e="del" aria-label="Remove item">✕</button></span></div>
<input data-e="label" maxlength="200" value="${esc(f.label)}" placeholder="${f.type === 'heading' ? 'Section name, e.g. Outdoor unit' : 'What to check or fill in, e.g. Filter replaced'}" aria-label="Item wording">
${f.type === 'choice' ? `<textarea data-e="options" rows="2" placeholder="One choice per line, e.g.&#10;Good&#10;Fair&#10;Poor" aria-label="Choices">${esc((f.options || []).join('\n'))}</textarea>` : ''}
${f.type === 'heading' ? '' : `<label class="jf-ereq"><input type="checkbox" data-e="required" ${f.required ? 'checked' : ''}> Required</label>`}</div>`;
  const html = `<div class="jf-ed"><label>Name<input name="name" maxlength="80" required value="${esc(t.name)}" placeholder="e.g. AC tune-up checklist"></label>
<label>Description<input name="description" maxlength="500" value="${esc(t.description || '')}" placeholder="Optional, e.g. Before leaving the site"></label>
<fieldset class="jf-when"><legend>When it goes on a job</legend>
<label class="jf-share"><input type="radio" name="when" value="manual" ${!t.autoAdd && !(t.services || []).length ? 'checked' : ''}><span>Only when someone adds it from the job page</span></label>
<label class="jf-share"><input type="radio" name="when" value="all" ${t.autoAdd ? 'checked' : ''}><span>On every new job automatically</span></label>
<label class="jf-share"><input type="radio" name="when" value="services" ${!t.autoAdd && (t.services || []).length ? 'checked' : ''}><span>On jobs with these products or services</span></label>
<div class="jf-svcs" ${!t.autoAdd && (t.services || []).length ? '' : 'hidden'}>${(D.services || []).length ? `<input type="search" class="jf-svcq" placeholder="Search your products and services" aria-label="Search products and services"><div class="jf-svclist">${[...D.services].sort((a, b) => String(a.name).localeCompare(String(b.name))).map((s) => `<label class="jf-ereq" data-n="${esc(String(s.name || '').toLowerCase())}"><input type="checkbox" name="svc" value="${esc(s.id)}" ${(t.services || []).includes(s.id) ? 'checked' : ''}> ${esc(s.name)}</label>`).join('')}</div>
<p class="muted sm" style="margin:0">It’s added when a job has one of these as a line item: on a new job (from a quote too), or when one is added to a job that’s still to do.</p>` : '<p class="muted sm" style="margin:0">Add your products and services in <a href="/services" data-link>Products &amp; Services</a> first.</p>'}</div></fieldset>
<div class="jf-opts"><label class="jf-share"><input type="checkbox" name="requiredToComplete" ${t.requiredToComplete ? 'checked' : ''}><span>It has to be finished before the job can be marked complete</span></label>
<label class="jf-share"><input type="checkbox" name="clientVisible" ${t.clientVisible ? 'checked' : ''}><span>Show it in the client’s portal once finished</span></label></div>
<h3 class="jf-eh">Items</h3><div class="jf-erows"></div><button type="button" class="btn alt" data-e="add">+ Add item</button>
${t.id ? '<p class="muted sm" style="margin:0">Changes apply to checklists added from now on. Ones already on jobs keep what they had.</p>' : ''}</div>`;
  const foot = `${t.id ? `<button type="button" class="btn alt" data-act="jfTplArchive" data-id="${t.id}">${t.archived ? 'Unarchive' : 'Archive'}</button><button type="button" class="btn danger" data-act="jfTplDel" data-id="${t.id}">Delete</button>` : ''}<button type="button" class="btn" data-e="save">Save checklist</button>`;
  const phone = phoneMq.matches; const title = t.id ? 'Edit checklist' : 'New checklist';
  const box = phone ? mSheet(title, html, { full: true, foot }) : modal(title, `${html}<div class="foot">${foot.replace('<button type="button" class="btn" data-e="save">', '<button type="button" class="btn alt" data-act="closeModal">Cancel</button><button type="button" class="btn" data-e="save">')}</div>`, true);
  const root = box.closest('#msheet, #overlay'); const rows = $('.jf-erows', root); if (box.tagName === 'FORM') box.addEventListener('submit', (e) => e.preventDefault());
  $('.modal', root)?.setAttribute('data-sticky', ''); // a stray click outside doesn't lose the edits
  const draw = () => { rows.innerHTML = t.fields.map(row).join(''); };
  const at = (el) => { const r = el.closest('.jf-erow'); return r ? t.fields.findIndex((f) => f._k === r.dataset.k) : -1; };
  draw();
  root.addEventListener('input', (e) => { const i = at(e.target); if (i < 0) return; const k = e.target.dataset.e;
    if (k === 'label') t.fields[i].label = e.target.value; if (k === 'options') t.fields[i].options = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean); });
  const svcBox = $('.jf-svcs', root); const svcQ = $('.jf-svcq', root);
  if (svcQ) svcQ.addEventListener('input', () => { const q = svcQ.value.trim().toLowerCase(); $$('.jf-svclist label', root).forEach((l) => { l.hidden = !!q && !l.dataset.n.includes(q); }); });
  root.addEventListener('change', (e) => { if (e.target.name === 'when') { svcBox.hidden = e.target.value !== 'services'; return; } const i = at(e.target); if (i < 0) return; const k = e.target.dataset.e;
    if (k === 'required') t.fields[i].required = e.target.checked;
    if (k === 'type') { t.fields[i].type = e.target.value; if (e.target.value === 'heading') t.fields[i].required = false; draw(); $(`[data-k="${t.fields[i]._k}"] [data-e=label]`, rows).focus(); } });
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-e]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT' || b.tagName === 'TEXTAREA') return; const k = b.dataset.e; const i = at(b);
    if (k === 'add') { const last = t.fields[t.fields.length - 1]; t.fields.push({ type: last && last.type !== 'heading' ? last.type : 'check', label: '', required: false, options: [], _k: Math.random().toString(36).slice(2) }); draw(); $$('[data-e=label]', rows).pop().focus(); return; }
    if (k === 'up' && i > 0) { [t.fields[i - 1], t.fields[i]] = [t.fields[i], t.fields[i - 1]]; draw(); return; }
    if (k === 'down' && i < t.fields.length - 1) { [t.fields[i + 1], t.fields[i]] = [t.fields[i], t.fields[i + 1]]; draw(); return; }
    if (k === 'del') { t.fields.splice(i, 1); draw(); return; }
    if (k === 'save') {
      const v = (n) => $(`[name=${n}]`, root); const body = { name: v('name').value, description: v('description').value, autoAdd: $('[name=when]:checked', root).value === 'all',
        services: $('[name=when]:checked', root).value === 'services' ? $$('[name=svc]:checked', root).map((x) => x.value) : [], requiredToComplete: v('requiredToComplete').checked, clientVisible: v('clientVisible').checked, archived: !!t.archived,
        fields: t.fields.map(({ _k, ...f }) => f).filter((f) => f.label.trim()) };
      if ($('[name=when]:checked', root).value === 'services' && !body.services.length) return toast('Tick at least one product or service, or choose another option', true);
      b.disabled = true;
      try { t.id ? await api('PUT', '/api/form-templates/' + t.id, body) : await api('POST', '/api/form-templates', body); closeModal(); mClose(); toast('Checklist saved'); refresh(); } catch (x) { toast(x.message, true); b.disabled = false; }
    }
  });
};
A.jfTplArchive = async (d) => { const t = JF.templates.find((x) => x.id === d.id); try { await api('PUT', '/api/form-templates/' + t.id, { archived: !t.archived }); closeModal(); mClose(); toast(t.archived ? 'Checklist unarchived' : 'Checklist archived: it can’t be added to jobs'); refresh(); } catch (x) { toast(x.message, true); } };
A.jfTplDel = async (d) => { if (!confirm('Delete this checklist? Ones already on jobs stay as they are.')) return; try { await api('DELETE', '/api/form-templates/' + d.id); closeModal(); mClose(); toast('Checklist deleted'); refresh(); } catch (x) { toast(x.message, true); } };
