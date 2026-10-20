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
<div class="card"><h2>Team productivity (completed jobs per month)</h2><div class="tablewrap"><table><tr><th>Team member</th>${labels.map((l) => `<th class="r">${l}</th>`).join('')}<th class="r">Upcoming</th></tr>
${o.productivity.map((p) => `<tr><td><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${esc(p.color)};margin-right:6px"></span>${esc(p.name)}</td>${p.completedByMonth.map((n) => `<td class="r">${n}</td>`).join('')}<td class="r">${p.upcoming}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No staff yet</td></tr>'}</table></div></div>`;
  },
};

/* ===== /calendar ===== */
const cal = { view: 'month', date: new Date() };
PAGES['/calendar'] = {
  title: 'Job Calendar',
  async render(main) {
    const today = ymd(new Date()); const jobsOn = (s) => D.jobs.filter((j) => j.date === s && j.status !== 'cancelled').sort((a, b) => a.startTime.localeCompare(b.startTime));
    const chip = (j) => { const s = byId(D.staff, (j.staffIds || [])[0]); return `<button class="chip ${j.status === 'completed' ? 'done' : ''}" style="border-left-color:${s ? esc(s.color) : '#9ca3af'}" data-act="editJob" data-id="${j.id}" title="${esc(j.title + ' · ' + clientName(j.clientId))}">${esc(fmtTime(j.startTime))} ${esc(j.title)}</button>`; };
    let start; let count; let title;
    if (cal.view === 'week') { start = startOfWeek(cal.date); count = 7; title = `Week of ${fmtDate(ymd(start))}`; }
    else { const f = new Date(cal.date.getFullYear(), cal.date.getMonth(), 1); start = startOfWeek(f); count = Math.ceil((dayInWeek(f) + new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate()) / 7) * 7; title = cal.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
    const wk = startOfWeek(cal.view === 'week' ? cal.date : new Date());
    const load = Array.from({ length: 7 }, (_, i) => { const s = ymd(addDays(wk, i)); const js = jobsOn(s); return { s, n: js.length, h: js.reduce((t, j) => t + hoursOf(j), 0) }; });
    const maxH = Math.max(...load.map((l) => l.h), 1);
    let cells = Array.from({ length: 7 }, (_, i) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][(i + weekStartDay()) % 7]).map((d) => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < count; i++) {
      const d = addDays(start, i); const s = ymd(d); const out = cal.view === 'month' && d.getMonth() !== cal.date.getMonth();
      const js = jobsOn(s); const cap = cal.view === 'month' ? 3 : 99;
      cells += `<div class="day ${out ? 'out' : ''} ${s === today ? 'today' : ''}"><div class="dn" data-act="newJobOn" data-date="${s}" title="Add job on this day"><span>${d.getDate()}</span><span class="muted">+</span></div>${js.slice(0, cap).map(chip).join('')}${js.length > cap ? `<div class="muted">+${js.length - cap} more</div>` : ''}</div>`;
    }
    main.innerHTML = `<div class="head"><div><h1>Job Schedule</h1><p class="sub">All scheduled jobs by date. Click a job to edit, or the day number to add one.</p></div><button class="btn no-tech" data-act="newJob">+ New job</button></div>
<div class="load">${load.map((l) => `<div><strong>${parseD(l.s).toLocaleDateString('en-US', { weekday: 'short' })} ${parseD(l.s).getDate()}</strong><div class="muted">${l.n} job${l.n === 1 ? '' : 's'} · ${l.h.toFixed(1)}h</div><div class="bar"><i style="width:${(l.h / maxH) * 100}%"></i></div></div>`).join('')}</div>
<div class="card"><div class="head" style="margin-bottom:10px"><div class="actions"><button class="btn alt sm" data-act="calPrev">‹</button><button class="btn alt sm" data-act="calToday">Today</button><button class="btn alt sm" data-act="calNext">›</button></div><h2 style="margin:0">${esc(title)}</h2>
<div class="tabs" style="margin:0"><button class="${cal.view === 'month' ? 'on' : ''}" data-act="calView" data-v="month">Month</button><button class="${cal.view === 'week' ? 'on' : ''}" data-act="calView" data-v="week">Week</button></div></div>
<div class="cal ${cal.view}">${cells}</div></div>`;
  },
};
A.calPrev = () => { cal.date = cal.view === 'week' ? addDays(cal.date, -7) : new Date(cal.date.getFullYear(), cal.date.getMonth() - 1, 1); refresh(); };
A.calNext = () => { cal.date = cal.view === 'week' ? addDays(cal.date, 7) : new Date(cal.date.getFullYear(), cal.date.getMonth() + 1, 1); refresh(); };
A.calToday = () => { cal.date = new Date(); refresh(); };
A.calView = (d) => { cal.view = d.v; refresh(); };

/* ===== /staff-schedules ===== */
let staffWeek = startOfWeek(new Date());
PAGES['/staff-schedules'] = {
  title: 'Staff Schedules',
  async render(main) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(staffWeek, i)); const today = ymd(new Date());
    const cell = (list) => list.map((j) => `<button class="chip ${j.status === 'completed' ? 'done' : ''}" data-act="editJob" data-id="${j.id}" title="${esc(clientName(j.clientId))}">${esc(j.startTime)}–${esc(j.endTime)}<br>${esc(j.title)}</button>`).join('');
    const forPerson = (sid, s) => D.jobs.filter((j) => j.date === s && j.status !== 'cancelled' && (sid ? (j.staffIds || []).includes(sid) : !(j.staffIds || []).length)).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const row = (s) => {
      const week = days.map((d) => forPerson(s && s.id, ymd(d))); const h = week.flat().reduce((t, j) => t + hoursOf(j), 0);
      return `<tr><td class="person">${s ? `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${esc(s.color)};margin-right:6px"></span>${esc(s.name)}<div class="muted">${esc(s.role)}</div>` : 'Unassigned'}<div class="muted">${week.flat().length} jobs · ${h.toFixed(1)}h</div></td>${week.map((l, i) => { const off = s && !staffHours(s)[WEEK[days[i].getDay()][0]].on; return `<td class="${ymd(days[i]) === today ? 'today' : ''} ${off ? 'off' : ''}">${cell(l) || (off ? '<span class="off-l">Off</span>' : '')}</td>`; }).join('')}</tr>`;
    };
    const unassigned = days.some((d) => forPerson(null, ymd(d)).length);
    main.innerHTML = `<div class="head"><div><h1>Staff Schedules</h1><p class="sub">Weekly workload and upcoming appointments for each team member.</p></div><div class="actions"><button class="btn alt admin-only" data-act="manageStaff">Manage staff</button><button class="btn no-tech" data-act="newJob">+ New job</button></div></div>
<div class="card"><div class="head" style="margin-bottom:10px"><div class="actions"><button class="btn alt sm" data-act="swPrev">‹</button><button class="btn alt sm" data-act="swToday">This week</button><button class="btn alt sm" data-act="swNext">›</button></div><h2 style="margin:0">Week of ${fmtDate(ymd(staffWeek))}</h2></div>
<div class="tablewrap"><table class="sched"><tr><th>Team member</th>${days.map((d) => `<th class="${ymd(d) === today ? 'today' : ''}">${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</th>`).join('')}</tr>
${D.staff.filter((s) => staffActive(s) || days.some((d) => forPerson(s.id, ymd(d)).length)).map(row).join('') || '<tr><td colspan="8" class="empty">No staff yet. Use “Manage staff” to add your team.</td></tr>'}${unassigned ? row(null) : ''}</table></div></div>`;
  },
};
A.swPrev = () => { staffWeek = addDays(staffWeek, -7); refresh(); };
A.swNext = () => { staffWeek = addDays(staffWeek, 7); refresh(); };
A.swToday = () => { staffWeek = startOfWeek(new Date()); refresh(); };
A.manageStaff = () => navigate('/team');

/* ===== /team ===== */
// Team members are the staff list (also used for job assignment and Staff Schedules). There are no logins yet,
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
<p class="sub" style="margin-top:-6px">Manage your team members in one place. Team members can be assigned to jobs and appear on Staff Schedules.</p>
<div class="cfilters"><div class="search-x" style="max-width:none"><input id="tq" type="search" placeholder="Search team members" value="${esc(v.q)}" aria-label="Search team members"><button type="button" class="icon-btn" data-act="teamClear" aria-label="Clear search" ${v.q ? '' : 'hidden'}>✕</button></div></div>
<h2 class="ftitle" style="font-size:15px">Team members (${list.length})</h2>
<div class="card ctable"><div class="tablewrap"><table><tr>${th('name', 'Name')}${th('role', 'Role')}${th('last', 'Last job')}<th>Next job</th>${th('status', 'Status')}<th>Login</th><th>Contact</th></tr>
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
// shared working-hours editor (team member page + My profile): a read view and an edit table toggled by Edit/Done
const hoursHtml = (hours, closed = 'Not working') => `<div class="hours-wrap"><table class="hours view">${WEEK.map(([k, l]) => `<tr><td>${l}</td><td>${hours[k].on ? `${fmtTime(hours[k].start)} – ${fmtTime(hours[k].end)}` : `<span class="muted">${closed}</span>`}</td></tr>`).join('')}</table>
<table class="hours edit" hidden>${WEEK.map(([k, l]) => `<tr data-day="${k}"><td><label class="hours-on"><input type="checkbox" ${hours[k].on ? 'checked' : ''}> ${l}</label></td><td><input type="time" class="h-start" value="${hours[k].start}" aria-label="${l} start"></td><td>–</td><td><input type="time" class="h-end" value="${hours[k].end}" aria-label="${l} end"></td></tr>`).join('')}</table>
<button type="button" class="link-btn" data-act="tmHoursEdit">Edit</button></div>`;
const readHoursFrom = (root) => Object.fromEntries($$('.hours.edit tr', root).map((r) => [r.dataset.day, { on: $('input[type=checkbox]', r).checked, start: $('.h-start', r).value || '09:00', end: $('.h-end', r).value || '17:00' }]));
const wireHours = (root) => $$('.hours.edit input[type=checkbox]', root).forEach((c) => { const sync = () => $$('input[type=time]', c.closest('tr')).forEach((i) => { i.disabled = !c.checked; }); c.addEventListener('change', sync); sync(); });
const badHours = (h) => { const bad = WEEK.find(([k]) => h[k].on && h[k].end <= h[k].start); return bad ? `${bad[1]}: the end time must be after the start time` : ''; };
const avatarHtml = (s, size) => (s.photo ? `<img class="avatar" src="${esc(s.photo)}" alt="" style="width:${size}px;height:${size}px;object-fit:cover">` : `<span class="avatar" style="background:${esc(s.color || '#64748b')};width:${size}px;height:${size}px;font-size:${Math.round(size / 2.6)}px">${esc(initials(s.name))}</span>`);
function teamMemberPage(main, s) {
  s = s || {}; const palette = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#db2777'];
  const hours = staffHours(s); let photo = s.photo || '';
  main.innerHTML = `<a href="/team" data-link class="back">← Manage team</a><h1 class="tm-title">${esc(s.name) || 'New team member'}</h1>
<form class="tmform"><div class="qcard"><h2>Personal info</h2>
<div class="tm-photo"><span class="tm-av">${avatarHtml({ ...s, name: s.name || '?' }, 72)}</span><label class="btn alt sm">Upload image<input type="file" id="tmPhoto" accept="image/png,image/jpeg,image/webp" hidden></label>
<button type="button" class="btn alt sm" data-act="tmPhotoRemove" ${photo ? '' : 'hidden'}>Remove</button></div>
<div class="tm-grid"><div>
<label class="fl"><span>Full name</span><input name="name" required value="${esc(s.name)}"></label>
<label class="fl"><span>Email address</span><input name="email" type="email" value="${esc(s.email)}"></label>
<label class="fl"><span>Mobile phone number</span><input name="phone" value="${esc(s.phone)}" placeholder="+17135550100"></label>
<label class="fl"><span>Role</span><input name="role" value="${esc(s.role)}" placeholder="e.g. Owner, Technician, Installer"></label></div>
<div class="addr"><input name="street" value="${esc(s.street)}" placeholder="Street address" aria-label="Street address"><input name="city" value="${esc(s.city)}" placeholder="City" aria-label="City">
<input name="state" value="${esc(s.state)}" placeholder="State" aria-label="State"><div class="addr-row"><input name="zip" value="${esc(s.zip)}" placeholder="ZIP code" aria-label="ZIP code"><input name="country" value="${esc(s.country || 'United States')}" placeholder="Country" aria-label="Country"></div></div></div>
<div class="row tm-extra"><label>Calendar color<input name="color" type="color" value="${esc(s.color || palette[D.staff.length % palette.length])}"></label>
<label>Status<select name="status"><option value="active">Active</option><option value="deactivated" ${s.status === 'deactivated' ? 'selected' : ''}>Deactivated (hidden from scheduling)</option></select></label></div>
<hr class="tm-hr"><h2>Schedule</h2><h3>Working hours</h3>
<p class="muted">Working hours show on Staff Schedules (days off are marked) and you'll get a warning when a job is booked outside them.</p>
${hoursHtml(hours)}</div>
<div class="foot">${s.id ? `<button type="button" class="btn danger" data-act="delStaff" data-id="${s.id}">Remove team member</button>` : ''}<a class="btn alt" href="/team" data-link>Cancel</a><button class="btn">${s.id ? 'Save' : 'Add team member'}</button></div></form>${s.id ? '<div class="qcard login-card" id="loginCard"><h2>Login access</h2><p class="muted">Loading…</p></div>' : ''}`;
  const form = $('form', main); if (s.id) renderLoginCard(s);
  const readHours = () => readHoursFrom(form); wireHours(form);
  $('#tmPhoto').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; if (f.size > 8e6) return toast('Image must be under 8 MB', true);
    photo = await resizeImage(f, 256); $('.tm-av', form).innerHTML = avatarHtml({ photo }, 72); $('[data-act=tmPhotoRemove]', form).hidden = false;
  });
  form._clearPhoto = () => { photo = ''; $('.tm-av', form).innerHTML = avatarHtml({ ...s, photo: '', name: $('[name=name]', form).value || '?' }, 72); $('[data-act=tmPhotoRemove]', form).hidden = true; };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(form)); b.photo = photo; b.hours = readHours();
    const bad = badHours(b.hours); if (bad) return toast(bad, true);
    s.id ? await api('PUT', '/api/staff/' + s.id, b) : await api('POST', '/api/staff', b);
    toast(s.id ? 'Team member saved' : 'Team member added'); navigate('/team');
  });
}
// ---- team logins: who can sign in, and with what access ----
let teamUsers = [];
const userFor = (s) => teamUsers.find((u) => u.staffId === s.id) || (s.email ? teamUsers.find((u) => u.email === String(s.email).trim().toLowerCase()) : null);
const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', manager: 'Manager', technician: 'Technician' };
const ROLE_CLASS = { owner: 'active', admin: 'active', manager: 'q-approved', technician: 'q-converted' };
// what each access level can do; the server enforces the same rules
const ROLE_OPTIONS = [
  ['technician', 'Technician: view jobs, clients and the schedule only (no prices)'],
  ['manager', 'Manager: add, edit and delete jobs, quotes and invoices, plus the Money section'],
  ['admin', 'Admin: full access, including team and settings'],
];
const loginBadge = (u) => (!u ? '<span class="muted">No login</span>' : u.status === 'invited' ? '<span class="cstatus q-sent">Invited</span>' : `<span class="cstatus ${ROLE_CLASS[u.role] || 'active'}">${ROLE_LABEL[u.role] || esc(u.role)}</span>`);
const roleSelect = (u) => `<label class="role-pick">Access<select id="loginRole">
${ROLE_OPTIONS.map(([k, l]) => `<option value="${k}" ${(u ? u.role : 'technician') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
async function renderLoginCard(s, note) {
  const box = $('#loginCard'); if (!box) return;
  teamUsers = await api('GET', '/api/users'); const u = userFor(s);
  let body;
  if (u && u.role === 'owner') body = `<p>Account owner, logs in as <strong>${esc(u.email)}</strong>. Owners always have full access.</p>`;
  else if (!u && !String(s.email || '').includes('@')) body = '<p class="muted">Add an email address above and save, then you can invite them to log in.</p>';
  else if (!u) body = `<p class="muted">${esc(s.name)} can't log in yet. Send an invite to <strong>${esc(s.email)}</strong> so they can set a password.</p>${roleSelect(null)}<div class="foot" style="justify-content:flex-start"><button type="button" class="btn" data-act="tmInvite" data-id="${s.id}">Invite to log in</button></div>`;
  else body = `<p>${u.status === 'invited' ? `Invited ${fmtDate((u.invitedAt || '').slice(0, 10))}. Waiting for them to set a password.` : `Logs in as <strong>${esc(u.email)}</strong>${u.lastLoginAt ? ` · last login ${fmtDate(u.lastLoginAt.slice(0, 10))}` : ''}.`}</p>
${staffActive(s) ? '' : '<p class="notice">This team member is deactivated, so their login is turned off until you reactivate them.</p>'}${roleSelect(u)}
<div class="foot" style="justify-content:flex-start">${u.status === 'invited' ? `<button type="button" class="btn alt" data-act="tmInvite" data-id="${s.id}">Resend invite</button>` : ''}<button type="button" class="btn danger" data-act="tmRevoke" data-id="${s.id}">Remove login access</button></div>`;
  box.innerHTML = `<div class="qcard-h"><h2>Login access</h2>${loginBadge(u)}</div>${body}${note || ''}`;
  const sel = $('#loginRole', box);
  if (sel && u && u.role !== 'owner') sel.addEventListener('change', async () => { await api('PUT', '/api/users/' + u.id, { role: sel.value }); toast(`${s.name} is now ${sel.value === 'admin' ? 'an' : 'a'} ${ROLE_LABEL[sel.value].toLowerCase()}`); renderLoginCard(s); });
}
A.tmInvite = async (d) => {
  const s = byId(D.staff, d.id); const role = ($('#loginRole') || {}).value || 'technician';
  const r = await api('POST', '/api/users/invite', { staffId: s.id, role });
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
A.tmHoursEdit = (d, el) => { const w = el.closest('.hours-wrap'); const editing = $('.hours.edit', w).hidden; $('.hours.edit', w).hidden = !editing; $('.hours.view', w).hidden = editing; el.textContent = editing ? 'Done' : 'Edit'; };
A.tmPhotoRemove = (d, el) => el.closest('form')._clearPhoto();
PAGES['/team/new'] = { title: 'Add team member', render: (main) => teamMemberPage(main) };
PAGES['/team/edit'] = {
  title: 'Team member',
  render(main) {
    const s = byId(D.staff, new URLSearchParams(location.search).get('id'));
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
let svcView = { q: '', sort: 'name', dir: 1 };
const svcType = (s) => (s.type === 'product' ? 'Product' : 'Service');
PAGES['/services'] = {
  title: 'Products & Services',
  async render(main) {
    const v = svcView;
    const list = D.services.filter((s) => !v.q || [s.name, s.description, svcType(s)].join(' ').toLowerCase().includes(v.q.toLowerCase()));
    const key = { name: (s) => (s.name || '').toLowerCase(), type: (s) => svcType(s) + (s.name || '').toLowerCase(), price: (s) => Number(s.price) || 0 }[v.sort];
    list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * v.dir);
    const th = (k, label, cls = '') => `<th class="${cls}"><button class="th-btn" data-act="svcSort" data-k="${k}">${label} <span class="sort ${v.sort === k ? 'on' : ''}">${v.sort === k ? (v.dir > 0 ? '▲' : '▼') : '⇅'}</span></button></th>`;
    main.innerHTML = `<div class="head"><div><h1>Products &amp; services</h1><p class="sub">Add and update your products and services to stay organized when creating quotes, jobs and invoices.</p></div></div>
<div class="cfilters"><div class="search-x"><input id="sq" type="search" placeholder="Search" value="${esc(v.q)}" aria-label="Search products and services"><button type="button" class="icon-btn" data-act="svcClear" aria-label="Clear search" ${v.q ? '' : 'hidden'}>✕</button></div>
<button class="btn" data-act="newService" style="margin-left:auto">+ Add Item</button></div>
<div class="card ctable"><div class="tablewrap"><table><tr>${th('name', 'Name')}<th>Description</th>${th('type', 'Type')}${th('price', 'Price', 'r')}</tr>
${list.map((s) => `<tr class="crow" data-id="${s.id}"><td><strong>${esc(s.name)}</strong></td><td>${esc(s.description)}</td><td>${svcType(s)}</td><td class="r" style="white-space:nowrap">${money(s.price)}<span class="muted"> / ${esc(s.unit || (s.type === 'product' ? 'each' : 'job'))}</span></td></tr>`).join('')
  || `<tr><td colspan="4" class="empty">${D.services.length ? 'Nothing matches your search' : 'No products or services yet. Add your first one.'}</td></tr>`}</table></div></div>`;
    let t; $('#sq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(async () => { svcView.q = e.target.value; await refresh(); const q = $('#sq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); });
    $$('.crow').forEach((r) => r.addEventListener('click', () => serviceForm(byId(D.services, r.dataset.id))));
  },
};
A.svcSort = (d) => { svcView.dir = svcView.sort === d.k ? -svcView.dir : 1; svcView.sort = d.k; refresh(); };
A.svcClear = () => { svcView.q = ''; refresh().then(() => $('#sq').focus()); };
function serviceForm(s) {
  s = s || {};
  const mb = modal(s.id ? 'Edit item' : 'New item', `<form><div class="row"><label>Name<input name="name" required value="${esc(s.name)}"></label>
<label>Type<select name="type">${[['service', 'Service'], ['product', 'Product']].map(([k, l]) => `<option value="${k}" ${(s.type || 'service') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
<label>Description<textarea name="description" placeholder="Shown on quote and invoice lines">${esc(s.description)}</textarea></label>
${company.aiEnabled !== false && planHas('ai') ? '<div class="ai-row"><button type="button" class="btn alt sm" id="aiDesc">✨ Write with AI</button></div>' : ''}
<div class="row"><label>Standard price ($)<input name="price" type="number" step="0.01" min="0" required value="${s.price ?? ''}"></label><label>Unit<input name="unit" value="${esc(s.unit || '')}" placeholder="job, hour, visit, each"></label></div>
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
  $('form', mb).addEventListener('submit', async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); s.id ? await api('PUT', '/api/services/' + s.id, b) : await api('POST', '/api/services', b); closeModal(); toast(`${b.type === 'product' ? 'Product' : 'Service'} saved`); refresh(); });
}
A.newService = () => serviceForm(); A.editService = (d) => serviceForm(byId(D.services, d.id));
A.delService = async (d) => { if (!confirm('Delete this item? Quotes and invoices that already use it keep their lines.')) return; await api('DELETE', '/api/services/' + d.id); closeModal(); refresh(); };

/* ===== /expenses ===== */
let expJob = '';
const CATS = ['Materials', 'Subcontractor', 'Fuel', 'Equipment', 'Software', 'Insurance', 'Other'];
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
<div class="tablewrap"><table><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th>Project</th><th class="r">Amount</th><th></th></tr>${list.map((e) => `<tr><td>${fmtDate(e.date)}</td><td>${esc(e.category)}</td><td>${esc(e.vendor)}</td><td>${esc(e.description)}</td><td>${jobLabel(e.jobId)}</td><td class="r">${money(e.amount)}</td><td class="actions"><button class="btn alt sm" data-act="editExpense" data-id="${e.id}">Edit</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No expenses logged</td></tr>'}</table></div></div>`;
    $('#expJob').addEventListener('change', (e) => { expJob = e.target.value; refresh(); });
  },
};
function expenseForm(x) {
  x = x || {};
  const mb = modal(x.id ? 'Edit expense' : 'Log expense', `<form><div class="row"><label>Date<input type="date" name="date" required value="${esc(x.date || ymd(new Date()))}"></label><label>Amount ($)<input name="amount" type="number" step="0.01" min="0" required value="${x.amount ?? ''}"></label></div>
<div class="row"><label>Category<select name="category">${CATS.map((c) => `<option ${x.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label>Vendor / payee<input name="vendor" value="${esc(x.vendor)}"></label></div>
<label>Description<input name="description" value="${esc(x.description)}"></label>
<label>Project (job)<select name="jobId"><option value="">General business expense</option>${D.jobs.map((j) => `<option value="${j.id}" ${x.jobId === j.id ? 'selected' : ''}>${esc(j.number + ' · ' + j.title + ' (' + clientName(j.clientId) + ')')}</option>`).join('')}</select></label>
<div class="foot">${x.id ? `<button type="button" class="btn danger" data-act="delExpense" data-id="${x.id}">Delete</button>` : ''}<button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  $('form', mb).addEventListener('submit', async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); b.jobId = b.jobId || null; x.id ? await api('PUT', '/api/expenses/' + x.id, b) : await api('POST', '/api/expenses', b); closeModal(); toast('Expense saved'); refresh(); });
}
A.newExpense = () => expenseForm(); A.editExpense = (d) => expenseForm(byId(D.expenses, d.id));
A.delExpense = async (d) => { if (!confirm('Delete this expense?')) return; await api('DELETE', '/api/expenses/' + d.id); closeModal(); refresh(); };

/* ===== /reports ===== */
PAGES['/reports'] = {
  title: 'Financial Reports',
  async render(main) {
    const r = await api('GET', '/api/reports'); const labels = r.revenueByMonth.map((m) => monthLabel(m.month));
    const totalAll = r.paidTotal + r.pendingTotal || 1; const maxSvc = Math.max(...r.popularServices.map((s) => s.count), 1);
    main.innerHTML = `<div class="head"><div><h1>Financial Reports</h1><p class="sub">Revenue, invoice status and your most popular services.</p></div><button class="btn alt noprint" onclick="window.print()">Print</button></div>
<div class="grid g4">${stat('Revenue this month', money(r.thisMonthRevenue))}${stat('Paid invoices', money(r.paidTotal), r.paidCount + ' invoices')}${stat('Pending invoices', money(r.pendingTotal), r.pendingCount + ' invoices · ' + money(r.overdueTotal) + ' overdue')}${stat('Expenses logged', money(r.totalExpenses), 'Net of paid revenue: ' + money(r.paidTotal - r.totalExpenses))}</div>
<div class="grid g2" style="margin-top:16px"><div class="card"><h2>Total monthly revenue (last 12 months)</h2>${bars(r.revenueByMonth.map((m) => m.revenue), labels, (v) => (v ? '$' + Math.round(v) : ''))}</div>
<div class="card"><h2>Paid vs pending</h2><p>Paid <strong>${money(r.paidTotal)}</strong></p><div class="meter"><i style="width:${(r.paidTotal / totalAll) * 100}%"></i></div><p style="margin-top:14px">Pending <strong>${money(r.pendingTotal)}</strong></p><div class="meter"><i style="width:${(r.pendingTotal / totalAll) * 100}%;background:var(--warn)"></i></div><p class="muted" style="margin-top:14px">Drafts are excluded. Pending includes sent and overdue invoices.</p></div></div>
<div class="card"><h2>Popular services</h2><div class="tablewrap"><table><tr><th>Service</th><th class="r">Units sold</th><th class="r">Revenue</th><th style="width:30%"></th></tr>${r.popularServices.map((s) => `<tr><td>${esc(s.name)}</td><td class="r">${s.count}</td><td class="r">${money(s.revenue)}</td><td><div class="meter"><i style="width:${(s.count / maxSvc) * 100}%"></i></div></td></tr>`).join('') || '<tr><td colspan="4" class="empty">No invoiced services yet</td></tr>'}</table></div></div>`;
  },
};

/* ===== /tax-summary ===== */
let taxYear = String(new Date().getFullYear());
PAGES['/tax-summary'] = {
  title: 'Tax Summary',
  async render(main) {
    const t = await api('GET', '/api/tax-summary?year=' + taxYear);
    main.innerHTML = `<div class="head"><div><h1>Tax Summary</h1><p class="sub">Sales tax collected on paid invoices, for end-of-year accounting. Counted by payment date.</p></div>
<div class="actions noprint"><select id="yr" style="width:auto">${t.years.map((y) => `<option ${y === t.year ? 'selected' : ''}>${y}</option>`).join('')}</select><button class="btn alt" data-act="taxCsv">Export CSV</button><button class="btn alt" onclick="window.print()">Print</button></div></div>
<div class="grid g3">${stat('Total tax collected ' + t.year, money(t.totalTax), t.invoices.length + ' paid invoices')}${stat('Taxable sales', money(t.totalTaxable))}${stat('Gross receipts', money(t.totalTaxable + t.totalTax))}</div>
<div class="card" style="margin-top:16px"><h2>By month</h2><div class="tablewrap"><table><tr><th>Month</th><th class="r">Invoices</th><th class="r">Taxable sales</th><th class="r">Tax collected</th><th class="r">Total received</th></tr>${t.byMonth.map((m) => `<tr><td>${monthLabel(m.month)}</td><td class="r">${m.invoices}</td><td class="r">${money(m.taxable)}</td><td class="r">${money(m.tax)}</td><td class="r">${money(m.total)}</td></tr>`).join('')}
<tr><th>Total</th><th class="r">${t.invoices.length}</th><th class="r">${money(t.totalTaxable)}</th><th class="r">${money(t.totalTax)}</th><th class="r">${money(t.totalTaxable + t.totalTax)}</th></tr></table></div></div>
<div class="card"><h2>Paid invoices</h2><div class="tablewrap"><table><tr><th>Invoice</th><th>Client</th><th>Paid</th><th class="r">Subtotal</th><th class="r">Rate</th><th class="r">Tax</th><th class="r">Total</th></tr>${t.invoices.map((i) => `<tr><td>${esc(i.number)}</td><td>${esc(i.client)}</td><td>${fmtDate(i.paidAt)}</td><td class="r">${money(i.subtotal)}</td><td class="r">${i.taxRate}%</td><td class="r">${money(i.tax)}</td><td class="r">${money(i.total)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No paid invoices in ' + t.year + '</td></tr>'}</table></div></div>`;
    $('#yr').addEventListener('change', (e) => { taxYear = e.target.value; refresh(); });
    A.taxCsv = () => downloadCsv(`tax-summary-${t.year}.csv`, [['Invoice', 'Client', 'Paid', 'Subtotal', 'Tax rate %', 'Tax', 'Total'], ...t.invoices.map((i) => [i.number, i.client, i.paidAt, i.subtotal, i.taxRate, i.tax, i.total])]);
  },
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
    const sel = (k, opts) => `<select data-nf="${k}" style="width:auto"><option value="">All</option>${opts.map((o) => `<option ${notifFilter[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
    main.innerHTML = `<div class="head"><div><h1>Notifications Log</h1><p class="sub">Every email and text message sent to clients for quotes, jobs and invoices.</p></div><div class="actions">Type ${sel('kind', ['quote', 'job', 'invoice'])} Channel ${sel('channel', ['email', 'sms'])}</div></div>
<div class="card"><div class="tablewrap"><table><tr><th>Sent</th><th>Client</th><th>Channel</th><th>Type</th><th>Ref</th><th>Status</th><th></th></tr>${list.map((n) => `<tr><td>${new Date(n.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td><td>${esc(n.clientName)}<div class="muted">${esc(n.to || '')}</div></td><td>${n.channel === 'email' ? 'Email' : 'Text'}</td><td>${esc(n.kind)}</td><td>${esc(n.refNumber)}</td><td>${badge(n.status)}</td><td class="actions"><button class="btn alt sm" data-act="viewNotif" data-id="${n.id}">View</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Nothing sent yet. Send a quote or invoice and it will appear here.</td></tr>'}</table></div></div>`;
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
    document.documentElement.style.setProperty('--brand', p.company.brandColor || '#2563eb');
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
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const cpIcon = (k, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CP_ICON[k]}</svg>`;
const CP_NAV = [[['requests', 'Requests'], ['estimates', 'Estimates'], ['appointments', 'Appointments'], ['invoices', 'Invoices']], [['wallet', 'Wallet']], [['contact', 'Contact Us']]];
const CP_STATUS = { new: 'Received', sent: 'Awaiting your approval', approved: 'Approved', declined: 'Declined', converted: 'Approved', scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled', paid: 'Paid', overdue: 'Overdue', unpaid: 'Due', partial: 'Partly paid' };
const cpBadge = (s) => `<span class="cp-badge cp-${esc(s)}">${esc(CP_STATUS[s] || s)}</span>`;
const cpEmpty = (icon, title, text, action = '') => `<div class="cp-empty"><div class="cp-empty-ic">${cpIcon(icon, 24)}</div><h2>${title}</h2><p>${text}</p>${action}</div>`;
const TIME_LABEL = { any: 'Any time', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
function renderPortal(main, tok, p) {
  const today = ymd(new Date());
  const quotes = p.quotes.filter((q) => q.status !== 'draft');
  const invoices = p.invoices.filter((i) => i.status !== 'draft');
  const openInv = invoices.filter((i) => i.displayStatus !== 'paid');
  const upcoming = p.jobs.filter((j) => j.status === 'scheduled' && j.date >= today).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const past = p.jobs.filter((j) => !upcoming.includes(j));
  const co = p.company;
  const newReqBtn = `<button type="button" class="cp-btn" data-cp="new-request">${cpIcon('plus', 18)} New Request</button>`;
  const row = (title, sub, right) => `<div class="cp-item"><div class="cp-item-main"><strong>${title}</strong>${sub.filter(Boolean).map((x) => `<div class="cp-sub">${x}</div>`).join('')}</div><div class="cp-item-side">${right}</div></div>`;
  const head = (title, action = '') => `<div class="cp-head"><h1>${title}</h1>${action}</div>`;
  const views = {
    requests: () => (p.requests.length ? head('Requests', newReqBtn) + `<div class="cp-list">${p.requests.map((r) => row(esc(r.title), [`Sent ${fmtDate(r.createdAt.slice(0, 10))}`, r.preferredDate || r.preferredTime !== 'any' ? `Preferred: ${r.preferredDate ? fmtDate(r.preferredDate) : 'any day'}, ${TIME_LABEL[r.preferredTime].toLowerCase()}` : '', r.details ? esc(r.details) : ''], cpBadge(r.status))).join('')}</div>`
      : cpEmpty('requests', 'Get work done', 'Send us a request to fill us in on the details', newReqBtn)),
    'new-request': () => `${head('New request')}<form class="cp-form" id="cpReq">
<label class="fl"><span>What do you need done?*</span><input name="title" required maxlength="120" placeholder="e.g. Install 4 security cameras"></label>
<label class="fl"><span>Details</span><textarea name="details" rows="5" maxlength="4000" placeholder="Anything that helps us prepare: sizes, access, photos you can describe…"></textarea></label>
<label class="fl"><span>Service address</span><input name="address" maxlength="300" value="${esc(p.client.address || '')}"></label>
<div class="cp-row"><label class="fl"><span>Preferred date</span><input name="preferredDate" type="date" min="${today}"></label>
<label class="fl"><span>Preferred time</span><select name="preferredTime">${Object.entries(TIME_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label></div>
<div class="cp-actions"><button type="button" class="cp-btn ghost" data-cp="requests">Cancel</button><button class="cp-btn primary">Send request</button></div></form>`,
    estimates: () => (quotes.length ? head('Estimates') + `<div class="cp-list">${quotes.map((q) => row(`${esc(q.title || 'Estimate')} <span class="cp-num">#${esc(q.number)}</span>`, [`Sent ${fmtDate((q.sentAt || q.createdAt).slice(0, 10))}`, `Total ${money(q.total)}`, q.depositFee > 0 ? (q.depositPaidAt ? `Deposit paid ${money(q.depositPaidAmount ?? q.depositFee)}` : `Deposit ${money(q.depositFee)}`) : ''], `${cpBadge(q.status)}<a class="cp-btn ${q.status === 'sent' ? 'primary' : ''}" href="${esc(q.link)}">${q.status === 'sent' ? 'Review' : 'View'}</a>`)).join('')}</div>`
      : cpEmpty('estimates', 'No estimates yet', 'When we send you an estimate, you can review and approve it here.')),
    appointments: () => (p.jobs.length ? head('Appointments') + (upcoming.length ? `<h3 class="cp-sec">Upcoming</h3><div class="cp-list">${upcoming.map((j) => row(esc(j.title), [`${fmtDate(j.date)} · ${fmtTime(j.startTime)} – ${fmtTime(j.endTime)}`, esc(j.address)], cpBadge('scheduled'))).join('')}</div>` : '')
      + (past.length ? `<h3 class="cp-sec">Past</h3><div class="cp-list">${past.map((j) => row(esc(j.title), [fmtDate(j.date), esc(j.address)], cpBadge(j.status))).join('')}</div>` : '')
      : cpEmpty('appointments', 'No appointments', 'Your scheduled visits will show up here.')),
    invoices: () => (invoices.length ? head('Invoices') + (openInv.length ? `<div class="cp-due"><span>Balance due</span><strong>${money(openInv.reduce((s, i) => s + (i.balanceDue ?? i.total), 0))}</strong></div>` : '')
      + `<div class="cp-list">${[...openInv, ...invoices.filter((i) => i.displayStatus === 'paid')].map((i) => row(`${esc(i.subject || 'Invoice')} <span class="cp-num">#${esc(i.number)}</span>`, [i.displayStatus === 'paid' ? `Paid ${fmtDate((i.paidAt || i.issueDate).slice(0, 10))}` : `Due ${fmtDate(i.dueDate)}`, i.displayStatus === 'paid' ? money(i.total) : `${money(i.balanceDue ?? i.total)}${i.depositApplied > 0 ? ` after ${money(i.depositApplied)} deposit` : ''}`], `${cpBadge(i.displayStatus)}<a class="cp-btn ${i.displayStatus === 'paid' ? '' : 'primary'}" href="${esc(i.link)}">${i.displayStatus === 'paid' ? 'Receipt' : 'Pay now'}</a>`)).join('')}</div>`
      : cpEmpty('invoices', 'No invoices', 'Invoices we send you will show up here, ready to pay online.')),
    wallet: () => cpEmpty('wallet', 'No saved payment methods', 'Pay any invoice by card or Zelle when you open it. Card details are handled securely by Stripe and are never stored by us.'),
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
  const nav = (cur) => CP_NAV.map((grp) => grp.map(([k, l]) => `<button type="button" class="cp-nav ${cur === k || (cur === 'new-request' && k === 'requests') ? 'on' : ''}" data-cp="${k}">${cpIcon(k)}<span>${l}</span></button>`).join('')).join('<hr>')
    + (p.referralLink ? `<hr><button type="button" class="cp-nav cp-refer ${cur === 'refer' ? 'on' : ''}" data-cp="refer">${cpIcon('refer')}<span>Refer a Friend</span></button>` : '');
  const show = (section) => {
    if (!views[section] || (section === 'refer' && !p.referralLink)) section = 'requests';
    $('.cp-navs', main).innerHTML = nav(section); $('.cp-main', main).innerHTML = views[section]();
    if (location.hash.slice(1) !== section) history.replaceState({}, '', location.pathname + location.search + '#' + section);
    const f = $('#cpReq', main);
    if (f) f.addEventListener('submit', async (e) => {
      e.preventDefault(); const btn = $('.primary', f); btn.disabled = true; btn.textContent = 'Sending…';
      try { const r = await api('POST', `/api/portal/${encodeURIComponent(tok)}/requests`, Object.fromEntries(new FormData(f))); p.requests.unshift(r); toast('Request sent. We’ll be in touch soon.'); show('requests'); }
      catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = 'Send request'; }
    });
    const on = $('.cp-navs', main); const cur = $('.cp-nav.on', on); if (cur && on.scrollWidth > on.clientWidth) on.scrollLeft = cur.offsetLeft - 12; // phone: keep the selected tab visible
    main.scrollTop = 0; window.scrollTo(0, 0);
  };
  main.innerHTML = `<div class="cp"><aside class="cp-side"><div class="cp-brand">${co.logo ? `<img src="${esc(co.logo)}" alt="${esc(co.name)}">` : `<div class="cp-mono">${esc(initials(co.name || '?'))}</div>`}</div>
<div class="cp-co">${esc(co.name)}</div><nav class="cp-navs" aria-label="Client hub"></nav></aside><section class="cp-main" aria-live="polite"></section></div>`;
  main.onclick = async (e) => {
    const b = e.target.closest('[data-cp]'); if (b) { e.preventDefault(); show(b.dataset.cp); return; }
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
function companySettingsHtml(c) {
  const hasParts = ['addrStreet1', 'addrStreet2', 'addrCity', 'addrState', 'addrZip'].some((k) => c[k]);
  const v = (k) => esc(c[k] ?? '');
  const country = c.addrCountry || 'United States';
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tz = c.timezone || browserTz;
  const zones = Intl.supportedValuesOf('timeZone').map((z) => [z, `(${tzOffset(z)}) ${z}`]);
  const sample = ymd(new Date()); const fmtWith = (f) => { const saved = company.dateFormat; company.dateFormat = f; const out = fmtDate(sample); company.dateFormat = saved; return out; };
  return `<div class="card cs"><h2>Company details</h2>
${fl('Company name', `<input name="name" required value="${v('name')}">`)}${fl('Phone number', `<input name="phone" type="tel" value="${v('phone')}">`)}
${fl('Website URL', `<input name="website" value="${v('website')}">`)}${fl('Email address', `<input name="email" type="email" value="${v('email')}">`)}
<div class="fl-group">${fl('Street 1', `<input name="addrStreet1" value="${hasParts ? v('addrStreet1') : esc(c.address || '')}">`)}${fl('Street 2', `<input name="addrStreet2" value="${v('addrStreet2')}">`)}
<div class="fl-split">${fl('City', `<input name="addrCity" value="${v('addrCity')}">`)}${fl('State', `<input name="addrState" value="${v('addrState')}">`)}</div>
<div class="fl-split">${fl('Zip code', `<input name="addrZip" value="${v('addrZip')}">`)}${flSelect('Country', 'addrCountry', [...new Set([...COUNTRIES, country])].map((x) => [x, x]), country)}</div></div>
${switchRow('addressPrivate', 'Keep address private', c.addressPrivate, 'We won’t show your address to clients in the client portal.')}
<hr class="cs-hr"><h3>Business hours</h3><p class="muted cs-note">Your usual opening times.</p>
${hoursHtml(staffHours({ hours: c.hours || { sat: { on: false, start: '09:00', end: '17:00' }, sun: { on: false, start: '09:00', end: '17:00' } } }), 'Closed')}
${switchRow('showHours', 'Show business hours', c.showHours, 'Display your business hours on the client portal.')}</div>
<div class="card cs"><h2>Tax settings</h2>
<div class="row">${fl('Tax ID name (ex: GST)', `<input name="taxIdName" value="${v('taxIdName')}">`)}${fl('Tax ID number', `<input name="taxIdNumber" value="${v('taxIdNumber')}">`)}</div>
<p class="muted cs-note">Tax ID name and number will appear on invoices.</p>
<h3>Default tax rate</h3>
<div class="tax-rate">${fl('Tax name', `<input name="taxName" value="${v('taxName')}" placeholder="e.g. TX Sales Tax">`)}${fl('Tax rate (%)', `<input name="taxRate" type="number" step="any" min="0" value="${c.taxRate ?? 0}">`)}${fl('Internal tax description', `<input name="taxDescription" value="${v('taxDescription')}">`)}</div>
<p class="muted cs-note">Used on new quotes, jobs and invoices. The tax name shows on documents that use this rate.</p></div>
<div class="card cs"><h2>Zelle payments</h2><p class="muted cs-note">Shown to clients on the invoice pay page and the quote deposit step. Leave blank to hide Zelle. Zelle payments can't be confirmed automatically: when a client reports one, check your bank, then use Mark paid.</p>
<div class="row">${fl('Zelle email or phone', `<input name="zelleRecipient" value="${v('zelleRecipient')}" placeholder="payments@yourbusiness.com or +17135550100">`)}${fl('Name registered with Zelle', `<input name="zelleName" value="${v('zelleName')}" placeholder="e.g. TLB Group LLC">`)}</div></div>
<div class="card cs"><h2>Regional settings</h2>
${flSelect('Timezone', 'timezone', zones, tz)}
${flSelect('Date format', 'dateFormat', ['MMM D, YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].map((f) => [f, fmtWith(f)]), c.dateFormat || 'MMM D, YYYY')}
${flSelect('Time format', 'timeFormat', [['12', '12 Hour (1:30 PM)'], ['24', '24 Hour (13:30)']], c.timeFormat || '12')}
${flSelect('First day of the week', 'weekStart', [['sun', 'Sunday'], ['mon', 'Monday']], c.weekStart || 'mon')}</div>`;
}
async function companyPage(main, full) {
  const c = company; const integ = full ? await api('GET', '/api/integrations') : null;
  main.innerHTML = `<div class="head"><div><h1>${full ? 'App Settings' : 'Company settings'}</h1>${full ? '<p class="sub">Branding and defaults used on every quote and invoice. Business details, tax, Zelle and regional settings are on <a href="/settings/company" data-link>Company Profile</a>.</p>' : ''}</div></div>
${full ? planCard(c.account) + webAddressCard(c.account) : ''}
<form id="cf"${full ? '' : ' class="cs-form"'}>${full ? '' : companySettingsHtml(c)}
${planHas('branding') ? `<div class="card${full ? '' : ' cs'}"><h2>Logo</h2><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div id="logoPrev" style="width:120px;height:70px;border:1px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden">${c.logo ? `<img src="${esc(c.logo)}" style="max-width:100%;max-height:100%">` : '<span class="muted">No logo</span>'}</div><div><div class="logo-acts"><input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" style="width:auto">${c.logo ? '<button type="button" class="btn danger sm" data-act="removeLogo">Delete logo</button>' : ''}</div><div class="muted">Appears on quotes, invoices and the client portal.</div></div></div></div>` : ''}
${full && planHas('branding') ? `<div class="card"><h2>App icon</h2><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div id="iconPrev" style="width:64px;height:64px;border:1px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden">${c.icon ? `<img src="${esc(c.icon)}" style="width:100%;height:100%;object-fit:contain">` : '<span class="muted">No icon</span>'}</div><div><input type="file" id="iconFile" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="width:auto"><div class="muted">Shown in the browser tab. A square image works best.</div></div></div></div>` : ''}
${full ? `<div class="card"><h2>${planHas('branding') ? 'Branding and defaults' : 'Defaults'}</h2>${planHas('branding') ? `<div class="row"><label>Brand color<input name="brandColor" type="color" value="${esc(c.brandColor || '#2563eb')}"></label></div>` : ''}<label>Invoice footer message<input name="invoiceFooter" value="${esc(c.invoiceFooter)}"></label></div>
<div class="card"><h2>Number prefixes</h2><p class="muted" style="margin-top:0">The label in front of each quote, job and invoice number. Changes apply to new ones only; existing numbers stay as they are.</p>
<div class="row3 prefix-row">${[['quotePrefix', 'Quotes', 1005], ['jobPrefix', 'Jobs', 2010], ['invoicePrefix', 'Invoices', 3010]].map(([k, l, n]) => `<label>${l}<input name="${k}" maxlength="10" value="${esc(docPrefix(k))}" data-sample="${n}"><span class="muted prefix-eg">e.g. ${esc(docPrefix(k))}${n}</span></label>`).join('')}</div></div>
${planHas('ai') ? `<div class="card"><h2>AI assistance</h2><p class="muted" style="margin-top:0">Shows a “Write with AI” button that drafts product and service descriptions from their name.${integ.ai ? '' : ' AI isn’t available on this service yet.'}</p>
<div class="ai-toggle"><span class="cstatus ${c.aiEnabled !== false ? 'active' : ''}">${c.aiEnabled !== false ? 'On' : 'Off'}</span><button type="button" class="btn alt sm" data-act="toggleAi">${c.aiEnabled !== false ? 'Turn off AI assistance' : 'Turn on AI assistance'}</button></div></div>` : ''}` : ''}
${full ? '<button class="btn">Save changes</button>' : '<div class="cs-foot"><button class="btn">Update settings</button></div>'}</form>
${full ? `<div class="card"><h2>Payments and messages</h2><p class="muted" style="margin:0">Card payments (Stripe), text messages (Twilio) and your own email are set up in <a href="/settings/connections" data-link>Account Connections</a>.</p></div>` : ''}`;
  $$('.prefix-row input').forEach((i) => i.addEventListener('input', () => { i.nextElementSibling.textContent = 'e.g. ' + i.value.trim() + i.dataset.sample; }));
  if (!full) { wireHours(main); phoneMask($('#cf input[name=phone]', main)); }
  $('#cf').addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target));
    if (!full) { b.hours = readHoursFrom(e.target); const bad = badHours(b.hours); if (bad) return toast(bad, true); }
    await api('PUT', '/api/company', b); toast('Settings saved'); refresh();
  });
  A.toggleAi = async () => { const on = c.aiEnabled === false; await api('PUT', '/api/company', { aiEnabled: on }); toast(on ? 'AI assistance turned on' : 'AI assistance turned off'); refresh(); };
  A.removeLogo = async () => {
    if (!confirm('Delete your logo? It will be removed from quotes, invoices and the client portal.')) return;
    try { await api('DELETE', '/api/company/logo'); toast('Logo deleted'); refresh(); } catch (err) { toast(err.message, true); }
  };
  wireAccountCards(main);
  if ($('#logoFile')) $('#logoFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; if (f.size > 4e6) return toast('Logo must be under 4 MB', true);
    const dataUrl = f.type === 'image/svg+xml' ? await readFileAsDataUrl(f) : await resizeImage(f, 600);
    await api('POST', '/api/company/logo', { dataUrl }); toast('Logo updated'); refresh();
  });
  if ($('#iconFile')) $('#iconFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.type === 'image/svg+xml' && f.size > 1e6) { e.target.value = ''; return toast('SVG icons must be under 1 MB', true); }
    try {
      const dataUrl = f.type === 'image/svg+xml' ? await readFileAsDataUrl(f) : await resizeImage(f, 256);
      await api('POST', '/api/company/icon', { dataUrl }); toast('App icon updated'); refresh();
    } catch (err) { toast(err.message || 'Couldn’t upload that image', true); e.target.value = ''; }
  });
}
/* ===== App Settings: plan, web address, card payments ===== */
function planCard(a) {
  if (!a) return '';
  const inc = a.featureList.filter((f) => f.included); const not = a.featureList.filter((f) => !f.included);
  const contact = a.contactEmail ? `<a href="mailto:${esc(a.contactEmail)}?subject=${encodeURIComponent('Plan change for ' + (company.name || a.slug))}">${esc(a.contactEmail)}</a>` : 'us';
  return `<div class="card plan-card"><div class="plan-head"><div><h2>Your plan: ${esc(a.plan.name)}</h2><p class="muted" style="margin:0">${a.maxUsers ? `Up to ${a.maxUsers} login${a.maxUsers === 1 ? '' : 's'}` : 'Unlimited logins'} · ${inc.length + a.alwaysIncluded.length} features</p></div>${not.length ? `<p class="muted" style="margin:0">To change your plan, contact ${contact}.</p>` : ''}</div>
<div class="plan-cols"><div><h3>Included</h3><ul class="feat-list">${a.alwaysIncluded.map((l) => `<li class="on">${esc(l)}</li>`).join('')}${inc.map((f) => `<li class="on" title="${esc(f.desc)}">${esc(f.label)}</li>`).join('')}</ul></div>
${not.length ? `<div><h3>Available on other plans</h3><ul class="feat-list">${not.map((f) => `<li title="${esc(f.desc)}">${esc(f.label)}</li>`).join('')}</ul></div>` : ''}</div></div>`;
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
    : `<p class="muted">Want to use your own domain, like app.yourbusiness.com? Custom domains are included on other plans.</p>`}</div>`;
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
  ai: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="3" y="3" width="42" height="42" rx="10" fill="#7C3AED"/><path fill="#fff" d="M22 11l2.6 7.4L32 21l-7.4 2.6L22 31l-2.6-7.4L12 21l7.4-2.6zM33 27l1.3 3.7L38 32l-3.7 1.3L33 37l-1.3-3.7L28 32l3.7-1.3z"/></svg>',
};
// card payments go to the business's own Stripe account, connected with Stripe Connect (Stripe hosts the sign-up and verification)
function stripeConn(integ) {
  const S = integ.stripe; const mode = integ.paymentsMode === 'live' ? connChip('on', 'Live') : connChip('wait', 'Test mode');
  const base = { id: 'stripe', icon: 'stripe', title: 'Stripe', desc: 'Let clients pay invoices and quote deposits by card. The money goes straight to your Stripe account.' };
  if (!S) return { ...base, status: connChip('off', 'Not in your plan'), button: '', body: '' , desc: base.desc + ' Card payments are included on other plans.' };
  if (S.chargesEnabled && integ.payments) return { ...base, status: connChip('on', 'Connected') + mode, button: 'Manage', body: `<p>Connected to <strong>${esc(S.name || 'your Stripe account')}</strong>. Payouts, refunds and receipts are managed in Stripe.${S.feePercent ? ` A ${S.feePercent}% platform fee applies to each card payment.` : ''}</p>
<div class="sms-test"><a class="btn alt" href="https://dashboard.stripe.com" target="_blank" rel="noopener">Open Stripe dashboard</a><button type="button" class="btn danger sm" data-act="rmStripe">Disconnect</button></div>` };
  if (S.ownKeys || S.serverKey) return { ...base, status: connChip('on', 'Connected') + mode, button: 'Manage', body: `<p>Card payments use ${S.serverKey ? 'the Stripe key in the server settings' : 'the Stripe API keys you saved earlier'}.${S.available ? ' You can switch to Connect with Stripe, which is simpler to look after.' : ''}</p>
<div class="sms-test">${S.available ? '<button type="button" class="btn" data-act="connectStripe">Connect with Stripe</button>' : ''}${S.ownKeys ? '<button type="button" class="btn danger sm" data-act="rmStripe">Remove saved keys</button>' : ''}</div>` };
  if (!S.available) return { ...base, status: connChip('off', 'Not available yet'), button: '', body: '', desc: base.desc + ' Until card payments are switched on for this service, the pay page runs a demo checkout that charges nobody.' };
  if (S.accountId) return { ...base, status: connChip('wait', 'Setup not finished'), button: 'Manage', open: true, body: `<p>${S.detailsSubmitted ? 'Stripe is reviewing your details. This usually takes a few minutes; you’ll be able to take card payments once it’s done.' : 'You started connecting Stripe but didn’t finish. Pick up where you left off: it takes about 5 minutes.'}</p>
<div class="sms-test"><button type="button" class="btn" data-act="connectStripe">${S.detailsSubmitted ? 'Review details in Stripe' : 'Finish setting up Stripe'}</button><button type="button" class="btn alt" data-act="refreshStripe">Check again</button><button type="button" class="btn danger sm" data-act="rmStripe">Cancel</button></div>` };
  return { ...base, status: connChip('off', 'Not connected'), button: 'Connect', body: `<ol class="pay-steps"><li>Click <strong>Connect with Stripe</strong>. You’ll go to Stripe’s secure site.</li><li>Set up your Stripe account: your business details and the bank account for payouts.</li><li>You come back here, and clients can pay you by card.</li></ol>
<p class="muted" style="font-size:13px">Stripe charges its standard card processing fees${S.feePercent ? `, plus a ${S.feePercent}% platform fee on each payment` : ''}. Until you connect, the pay page runs a demo checkout that charges nobody.</p>
<button type="button" class="btn" data-act="connectStripe">Connect with Stripe</button>` };
}
// email and texts: the business's own Gmail/SendGrid/SMTP and Twilio accounts, or the service's (set up by the platform)
function emailConn(integ) {
  const E = integ.ownEmail || {}; const p = E.provider || 'gmail';
  const saved = (has) => (has ? 'placeholder="Saved. Leave blank to keep it."' : '');
  const show = (k) => (p === k ? '' : ' hidden');
  const status = integ.ownEmail ? connChip('on', `Your ${esc({ gmail: 'Gmail', sendgrid: 'SendGrid', smtp: 'mail server' }[E.provider])}`) : integ.serverEmail ? connChip('on', 'Using our email service') : connChip('off', 'Not connected');
  return { id: 'email', icon: 'email', title: 'Email', status, button: integ.ownEmail ? 'Manage' : 'Connect',
    desc: `Send quotes, invoices, reminders and password resets from your own mailbox. ${integ.ownEmail ? `Emails come from ${esc(E.from || E.user)}.` : integ.serverEmail ? 'Until you connect, emails are sent for you in your business name.' : 'Until email is connected, messages are kept in the Notifications Log but not delivered.'}`,
    body: `<p class="muted" style="font-size:13px;margin-top:0">Client replies go to ${esc(company.email || 'your company email')}.</p>
<form id="emailForm"><div class="row"><label>Send with<select name="provider">${[['gmail', 'Gmail or Google Workspace'], ['sendgrid', 'SendGrid'], ['smtp', 'Another mail server (SMTP)']].map(([v, l]) => `<option value="${v}" ${v === p ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
<label>Sender name<input name="fromName" maxlength="100" value="${esc(E.fromName)}" placeholder="${esc(company.name || 'Your business')}"></label></div>
<div class="row" data-for="gmail"${show('gmail')}><label>Gmail address<input name="user" type="email" value="${esc(E.provider === 'gmail' ? E.user : '')}" placeholder="you@gmail.com"></label>
<label>App password<input name="pass" type="password" autocomplete="new-password" ${saved(E.provider === 'gmail')}></label></div>
<p class="muted" data-for="gmail" style="font-size:13px"${show('gmail')}>Turn on 2-Step Verification, then create an app password at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener">myaccount.google.com/apppasswords</a>. Your normal Google password won’t work.</p>
<div class="row" data-for="sendgrid"${show('sendgrid')}><label>API key<input name="apiKey" type="password" autocomplete="off" ${saved(E.provider === 'sendgrid')}></label>
<label>From address<input name="from" type="email" value="${esc(E.provider === 'sendgrid' ? E.from : '')}" placeholder="office@yourbusiness.com"></label></div>
<p class="muted" data-for="sendgrid" style="font-size:13px"${show('sendgrid')}>Use a key with Mail Send access, and a sender address verified in SendGrid.</p>
<div class="row" data-for="smtp"${show('smtp')}><label>SMTP server<input name="host" value="${esc(E.host)}" placeholder="smtp.yourmailhost.com"></label><label>Port (SSL/TLS)<input name="port" type="number" value="465" readonly></label></div>
<div class="row" data-for="smtp"${show('smtp')}><label>Username<input name="user" value="${esc(E.provider === 'smtp' ? E.user : '')}"></label><label>Password<input name="pass" type="password" autocomplete="new-password" ${saved(E.provider === 'smtp')}></label></div>
<div class="row" data-for="smtp"${show('smtp')}><label>From address<input name="from" type="email" value="${esc(E.provider === 'smtp' ? E.from : '')}" placeholder="office@yourbusiness.com"></label></div>
<div class="sms-test"><button class="btn">Save email settings</button>${integ.email ? '<button type="button" class="btn alt" data-act="testMsg" data-ch="email">Send a test email</button>' : ''}${integ.ownEmail ? `<button type="button" class="btn danger sm" data-act="rmSender" data-kind="email">${integ.serverEmail ? 'Use our email service instead' : 'Disconnect'}</button>` : ''}</div></form>` };
}
function twilioConn(integ) {
  const T = integ.ownTwilio || {};
  const base = { id: 'twilio', icon: 'twilio', title: 'Twilio text messages' };
  if (!planHas('sms')) return { ...base, status: connChip('off', 'Not in your plan'), button: '', body: '', desc: 'Send quotes, invoices and appointment reminders by text. Text messages are included on other plans.' };
  const status = integ.ownTwilio ? connChip('on', 'Connected') : connChip('off', 'Not connected');
  return { ...base, status, button: integ.ownTwilio ? 'Manage' : 'Connect',
    desc: `Send quotes, invoices and appointment reminders by text from your own Twilio number. ${integ.ownTwilio ? `Texts come from ${esc(T.from)}.` : 'Connect your Twilio account to start texting clients. Until then, texts are kept in the Notifications Log but not delivered.'}`,
    body: `<p class="muted" style="font-size:13px;margin-top:0">Find these at <a href="https://console.twilio.com" target="_blank" rel="noopener">console.twilio.com</a> → Account Info.</p>
<form id="twilioForm"><div class="row"><label>Account SID<input name="sid" value="${esc(T.sid)}" placeholder="AC…" autocomplete="off" spellcheck="false"></label><label>Auth Token<input name="token" type="password" autocomplete="new-password" ${integ.ownTwilio ? 'placeholder="Saved. Leave blank to keep it."' : ''}></label></div>
<div class="row"><label>Twilio phone number<input name="from" value="${esc(T.from)}" placeholder="(713) 555-0100 or MG…"></label></div>
<div class="sms-test"><button class="btn">Save Twilio settings</button>${integ.sms ? '<button type="button" class="btn alt" data-act="testMsg" data-ch="sms">Send a test text</button>' : ''}${integ.ownTwilio ? '<button type="button" class="btn danger sm" data-act="rmSender" data-kind="twilio">Disconnect</button>' : ''}</div></form>` };
}
async function connectionsPage(main) {
  const integ = await api('GET', '/api/integrations');
  const soon = (id, icon, title, desc) => ({ id, icon, title, desc, status: connChip('off', 'Coming soon'), button: 'Connect', disabled: true, body: '' });
  const rows = [
    soon('google', 'google', 'Google Business Profile', 'Connect your Google Business Profile and manage which features use it.'),
    soon('facebook', 'facebook', 'Facebook Business Page', 'Connect your Facebook Business Page and manage which features use it. You’ll need full admin permissions for the business profile to connect it.'),
    soon('instagram', 'instagram', 'Instagram account', 'Connect your Instagram account to publish Instagram posts. You’ll need an Instagram professional account: either Business or Creator.'),
    stripeConn(integ), twilioConn(integ), emailConn(integ),
    ...(planHas('ai') ? [{ id: 'ai', icon: 'ai', title: 'AI descriptions', button: '', body: '', status: integ.ai ? connChip('on', company.aiEnabled !== false ? 'On' : 'Turned off') : connChip('off', 'Not available yet'),
      desc: `“Write with AI” drafts product and service descriptions from their name. ${integ.ai ? 'Turn it on or off in <a href="/settings" data-link>App Settings</a>.' : ''}` }] : []),
  ];
  main.innerHTML = `<div class="head"><div><h1>Account Connections</h1><p class="sub">Connect the accounts your business uses to take payments and message clients.</p></div></div>
<div class="card conn-list">${rows.map((r) => `<section class="conn" id="conn-${r.id}"><div class="conn-ic">${CONN_ICONS[r.icon]}</div>
<div class="conn-main"><h2>${esc(r.title)} ${r.status}</h2><p>${r.desc}</p></div>
<div class="conn-act">${r.button ? `<button type="button" class="btn alt conn-btn" ${r.disabled ? 'disabled title="Coming soon"' : `data-act="toggleConn" data-id="${r.id}" aria-expanded="${r.open ? 'true' : 'false'}"`}>${r.button}</button>` : ''}</div>
${r.body ? `<div class="conn-body"${r.open ? '' : ' hidden'}>${r.body}</div>` : ''}</section>`).join('')}</div>`;
  wireMessages(main); stripeReturnNotice(integ);
  const open = new URLSearchParams(location.search).get('open'); if (open) A.toggleConn({ id: open });
}
A.toggleConn = (d) => {
  const sec = $(`#conn-${d.id}`); const body = sec && $('.conn-body', sec); if (!body) return;
  body.hidden = !body.hidden; $('.conn-btn', sec).setAttribute('aria-expanded', String(!body.hidden));
  if (!body.hidden) { const f = $('input:not([disabled]):not([readonly]), select', body); if (f) f.focus(); }
};
function wireMessages(main) {
  const ef = $('#emailForm', main); if (!ef) return;
  const sel = $('[name=provider]', ef);
  const pick = () => $$('[data-for]', ef).forEach((el) => { el.hidden = el.dataset.for !== sel.value; $$('input', el).forEach((i) => { i.disabled = el.hidden; }); });
  sel.addEventListener('change', pick); pick();
  ef.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('PUT', '/api/integrations/email', Object.fromEntries(new FormData(ef))); toast('Email settings saved. Send a test to check them.'); refresh(); } catch (err) { toast(err.message, true); }
  });
  const tf = $('#twilioForm', main);
  if (tf) {
    phoneMask($('[name=from]', tf));
    tf.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await api('PUT', '/api/integrations/twilio', Object.fromEntries(new FormData(tf))); toast('Twilio settings saved. Send a test to check them.'); refresh(); } catch (err) { toast(err.message, true); }
    });
  }
}
A.testMsg = async (d, el) => {
  const sms = d.ch === 'sms'; const to = prompt(sms ? 'Send a test text to which mobile number?' : 'Send a test email to which address?', sms ? '' : (me && me.email) || company.email || ''); if (!to) return;
  el.disabled = true;
  try { const r = await api('POST', '/api/integrations/test', { channel: d.ch, to }); toast(r.status === 'sent' ? `Test ${sms ? 'text' : 'email'} sent` : r.detail || 'Not delivered', r.status !== 'sent'); }
  finally { el.disabled = false; }
};
A.rmSender = async (d) => {
  if (!confirm(d.kind === 'email' ? 'Remove your email settings?' : 'Remove your Twilio settings?')) return;
  await api('DELETE', `/api/integrations/${d.kind}`); toast('Removed'); refresh();
};
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
A.rmStripe = async () => { if (!confirm('Disconnect Stripe? Clients won’t be able to pay by card until you connect it again. Your Stripe account and its money aren’t affected.')) return; await api('POST', '/api/integrations/stripe/disconnect', {}); toast('Stripe disconnected'); refresh(); };

PAGES['/settings/company'] = { title: 'Company Profile', render: (m) => companyPage(m, false) };
PAGES['/settings'] = { title: 'App Settings', render: (m) => companyPage(m, true) };
PAGES['/settings/connections'] = { title: 'Account Connections', render: connectionsPage };
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
<div class="tablewrap"><table class="map-tbl"><tr><th>Column in your file</th><th>Example</th><th style="width:220px">Import as</th></tr>
${s.headers.map((h, i) => `<tr><td><strong>${esc(h)}</strong></td><td class="muted">${esc((s.rows.find((r) => (r[i] || '').trim()) || [])[i] || '')}</td><td><select data-map="${i}">${IMPORT_FIELDS.map(([v, l]) => `<option value="${v}" ${s.map[i] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td></tr>`).join('')}</table></div>
${hasName ? '' : '<div class="notice" style="margin-top:12px">Choose which column holds the client name (Full name, First/Last name, or Company).</div>'}</div>
<div class="card"><h2>3. Review and import</h2>
<p><strong>${plan.length}</strong> rows: <strong>${n('new')}</strong> new, <strong>${n('dupe')}</strong> already in your client list or repeated in the file${n('noname') ? `, <strong>${n('noname')}</strong> without a name (skipped)` : ''}.</p>
<div class="chk"><label><input type="checkbox" id="skipDupes" ${s.skipDupes ? 'checked' : ''}> Skip clients already in my list (same email, phone or name)</label></div>
<div class="tablewrap"><table><tr><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th></th></tr>
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

/* ===== /settings/emails ===== */
const fillTpl = (text, vars) => String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m));
PAGES['/settings/emails'] = {
  title: 'Email Templates',
  async render(main) {
    const list = await api('GET', '/api/email-templates');
    const sample = { client_name: 'Jane Smith', company_name: company.name || 'Your Business', quote_number: docPrefix('quotePrefix') + '1005', quote_title: 'Backyard cleanup', invoice_number: docPrefix('invoicePrefix') + '3010', total: '$1,250.00', due_date: fmtDate(ymd(addDays(new Date(), 14))), job_number: docPrefix('jobPrefix') + '2010', job_title: 'Gutter cleaning', date: fmtDate(ymd(addDays(new Date(), 2))), time: '09:00', address: '100 Main St, Houston, TX 77002' };
    const links = { quote: location.origin + '/p/quote/abc123', invoice: location.origin + '/pay/abc123' };
    main.innerHTML = `<div class="head"><div><h1>Email Templates</h1><p class="sub">Edit the emails sent to clients. Placeholders in {{double braces}} are replaced with the real details when each email is sent.</p></div></div>
${list.map((t) => `<form class="card tpl" data-key="${t.key}"><div class="tpl-head"><div><h2>${esc(t.label)} ${t.custom ? '<span class="badge sent">customized</span>' : ''}</h2><div class="muted">${esc(t.description)}</div></div></div>
<div class="row"><div><label>Subject<input name="subject" value="${esc(t.subject)}" required></label><label>Message<textarea name="body" rows="10" required>${esc(t.body)}</textarea></label>
<div class="muted" style="margin-bottom:6px">Insert a placeholder at the cursor:</div><div class="chips">${Object.entries(t.vars).map(([k, l]) => `<button type="button" class="btn alt sm" data-act="insVar" data-v="${k}" title="${esc(l)}">${esc(l)}</button>`).join('')}</div></div>
<div><div class="muted" style="font-size:13px">Preview with sample details</div><div class="tpl-preview"><div class="pv-subj"></div><div class="pv-body"></div></div><div class="pv-warn notice" hidden></div></div></div>
<div class="foot">${t.custom ? `<button type="button" class="btn alt" data-act="resetTpl" data-key="${t.key}">Reset to default</button>` : ''}<button class="btn">Save ${esc(t.label.toLowerCase())} email</button></div></form>`).join('')}`;
    $$('form.tpl', main).forEach((form) => {
      const t = list.find((x) => x.key === form.dataset.key); const vars = { ...sample, link: links[t.key] || '' };
      const preview = () => {
        const subj = $('[name=subject]', form).value; const body = $('[name=body]', form).value;
        $('.pv-subj', form).textContent = fillTpl(subj, vars); $('.pv-body', form).textContent = fillTpl(body, vars);
        const unknown = [...new Set([...(subj + body).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).filter((k) => !(k in t.vars)))];
        const w = $('.pv-warn', form); w.hidden = !unknown.length; w.textContent = unknown.length ? `Not a placeholder for this email, so it will be sent as typed: ${unknown.map((k) => '{{' + k + '}}').join(', ')}` : '';
      };
      form.addEventListener('input', preview);
      form.addEventListener('focusin', (e) => { if (e.target.name === 'subject' || e.target.name === 'body') form._field = e.target; });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await api('PUT', '/api/email-templates/' + t.key, { subject: $('[name=subject]', form).value, body: $('[name=body]', form).value });
        toast(t.label + ' email saved'); refresh();
      });
      preview();
    });
  },
};
A.insVar = (d, el) => {
  const form = el.closest('form'); const f = form._field || $('[name=body]', form); const tag = `{{${d.v}}}`;
  const a = f.selectionStart ?? f.value.length; const b = f.selectionEnd ?? a;
  f.value = f.value.slice(0, a) + tag + f.value.slice(b); f.focus(); f.setSelectionRange(a + tag.length, a + tag.length);
  f.dispatchEvent(new Event('input', { bubbles: true }));
};
A.resetTpl = async (d) => { if (!confirm('Replace your wording with the original default email?')) return; await api('DELETE', '/api/email-templates/' + d.key); toast('Template reset'); refresh(); };


render();
/* ===== /profile: anyone signed in edits their own info, photo and password ===== */
PAGES['/profile'] = {
  title: 'My profile',
  async render(main) {
    const p = await api('GET', '/api/auth/profile'); let photo = p.photo || '';
    const pw = (name, label, ac) => `<label class="fl pwf"><span>${label}</span><input name="${name}" type="password" autocomplete="${ac}"><button type="button" class="eye" data-act="pfEye" aria-label="Show password">Show</button></label>`;
    main.innerHTML = `<h1 class="tm-title">My profile</h1>
<form class="tmform" id="pfInfo"><div class="qcard"><div class="qcard-h"><h2>Personal info</h2>${loginBadge({ role: p.role })}</div>
<div class="tm-photo"><span class="tm-av">${avatarHtml(p, 72)}</span><label class="btn alt sm">Upload photo<input type="file" id="pfPhoto" accept="image/png,image/jpeg,image/webp" hidden></label>
<button type="button" class="btn alt sm" data-act="pfPhotoRemove" ${photo ? '' : 'hidden'}>Remove</button></div>
<div class="tm-grid"><div>
<label class="fl"><span>Full name</span><input name="name" required autocomplete="name" value="${esc(p.name)}"></label>
<label class="fl"><span>Email address (used to log in)</span><input name="email" type="email" required autocomplete="email" value="${esc(p.email)}"></label>
<div id="pfEmailPw" hidden>${pw('currentPassword', 'Current password (needed to change your email)', 'current-password')}</div>
<label class="fl"><span>Mobile phone number</span><input name="phone" autocomplete="tel" value="${esc(p.phone)}" placeholder="+17135550100"></label>
${p.jobTitle ? `<p class="muted">Role: ${esc(p.jobTitle)}. Ask the account owner to change your role or access.</p>` : ''}</div>
<div class="addr"><input name="street" value="${esc(p.street)}" placeholder="Street address" aria-label="Street address" autocomplete="address-line1"><input name="city" value="${esc(p.city)}" placeholder="City" aria-label="City" autocomplete="address-level2">
<input name="state" value="${esc(p.state)}" placeholder="State" aria-label="State" autocomplete="address-level1"><div class="addr-row"><input name="zip" value="${esc(p.zip)}" placeholder="ZIP code" aria-label="ZIP code" autocomplete="postal-code"><input name="country" value="${esc(p.country || 'United States')}" placeholder="Country" aria-label="Country" autocomplete="country-name"></div></div></div>
<div class="foot"><button class="btn">Save profile</button></div></div></form>
${p.linked ? `<form class="tmform" id="pfHours"><div class="qcard login-card"><h2>Working hours</h2>
<p class="muted">When you're available to work. Your hours show on Staff Schedules (days off are marked) and the office gets a warning if a job is booked outside them.</p>
${hoursHtml(staffHours(p))}<div class="foot"><button class="btn">Save hours</button></div></div></form>` : ''}
<form class="tmform" id="pfPass"><div class="qcard login-card"><h2>Change password</h2><p class="muted">Use at least 8 characters. Changing it signs you out on your other devices.</p>
<div class="pf-pw"><input type="email" name="username" value="${esc(p.email)}" autocomplete="username" hidden>
${pw('currentPassword', 'Current password', 'current-password')}${pw('newPassword', 'New password', 'new-password')}${pw('confirm', 'Confirm new password', 'new-password')}</div>
<div class="foot"><button class="btn">Update password</button></div></div></form>`;
    const info = $('#pfInfo'); const email = $('[name=email]', info);
    email.addEventListener('input', () => { $('#pfEmailPw').hidden = email.value.trim().toLowerCase() === p.email; });
    $('#pfPhoto').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return; if (f.size > 8e6) return toast('Image must be under 8 MB', true);
      photo = await resizeImage(f, 256); $('.tm-av', info).innerHTML = avatarHtml({ photo }, 72); $('[data-act=pfPhotoRemove]', info).hidden = false;
    });
    info._clearPhoto = () => { photo = ''; $('.tm-av', info).innerHTML = avatarHtml({ ...p, photo: '', name: $('[name=name]', info).value || '?' }, 72); $('[data-act=pfPhotoRemove]', info).hidden = true; };
    info.addEventListener('submit', async (e) => {
      e.preventDefault(); const b = Object.fromEntries(new FormData(info)); b.photo = photo;
      const saved = await api('POST', '/api/auth/profile', b);
      me = { ...me, name: saved.name, email: saved.email, photo: saved.photo }; toast('Profile saved'); refresh();
    });
    const hf = $('#pfHours');
    if (hf) {
      wireHours(hf);
      hf.addEventListener('submit', async (e) => {
        e.preventDefault(); const hours = readHoursFrom(hf); const bad = badHours(hours); if (bad) return toast(bad, true);
        await api('POST', '/api/auth/hours', { hours }); toast('Working hours saved'); refresh();
      });
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
