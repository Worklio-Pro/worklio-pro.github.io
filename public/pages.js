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
    main.innerHTML = `<div class="head"><div><h1>Job Schedule</h1><p class="sub">All scheduled jobs by date. Click a job to edit, or the day number to add one.</p></div><button class="btn need-jobs-edit" data-act="newJob">+ New job</button></div>
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
// compact start time for the phone layout: 9a, 1:30p (12-hour) or 09:30 (24-hour)
const shortTime = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return company.timeFormat === '24' ? fmtTime(t) : `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'a' : 'p'}`; };
PAGES['/staff-schedules'] = {
  title: 'Staff Schedules',
  async render(main) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(staffWeek, i)); const today = ymd(new Date());
    const cell = (list) => list.map((j) => `<button class="chip ${j.status === 'completed' ? 'done' : ''}" data-act="editJob" data-id="${j.id}" title="${esc(fmtTime(j.startTime))} · ${esc(j.title)} · ${esc(clientName(j.clientId))}"><span class="c-full">${esc(j.startTime)}–${esc(j.endTime)}<br>${esc(j.title)}</span><span class="c-short">${shortTime(j.startTime)}</span></button>`).join('');
    const forPerson = (sid, s) => D.jobs.filter((j) => j.date === s && j.status !== 'cancelled' && (sid ? (j.staffIds || []).includes(sid) : !(j.staffIds || []).length)).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const row = (s) => {
      const week = days.map((d) => forPerson(s && s.id, ymd(d))); const h = week.flat().reduce((t, j) => t + hoursOf(j), 0);
      return `<tr><td class="person">${s ? `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${esc(s.color)};margin-right:6px"></span><span class="p-name">${esc(s.name)}</span><div class="muted p-role">${esc(s.role)}</div>` : 'Unassigned'}<div class="muted p-load">${week.flat().length} jobs · ${h.toFixed(1)}h</div></td>${week.map((l, i) => { const off = s && !staffHours(s)[WEEK[days[i].getDay()][0]].on; return `<td class="${ymd(days[i]) === today ? 'today' : ''} ${off ? 'off' : ''}">${cell(l) || (off ? '<span class="off-l">Off</span>' : '')}</td>`; }).join('')}</tr>`;
    };
    const unassigned = days.some((d) => forPerson(null, ymd(d)).length);
    main.innerHTML = `<div class="head"><div><h1>Staff Schedules</h1><p class="sub">Weekly workload and upcoming appointments for each team member.</p></div><div class="actions"><button class="btn alt admin-only" data-act="manageStaff">Manage staff</button><button class="btn need-jobs-edit" data-act="newJob">+ New job</button></div></div>
<div class="card sched-card"><div class="head" style="margin-bottom:10px"><div class="actions"><button class="btn alt sm" data-act="swPrev">‹</button><button class="btn alt sm" data-act="swToday">This week</button><button class="btn alt sm" data-act="swNext">›</button></div><h2 style="margin:0">Week of ${fmtDate(ymd(staffWeek))}</h2></div>
<div class="tablewrap"><table class="sched"><tr><th class="person"><span class="c-full">Team member</span><span class="c-short">Team</span></th>${days.map((d) => `<th class="${ymd(d) === today ? 'today' : ''}"><span class="c-full">${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span><span class="c-short">${d.toLocaleDateString('en-US', { weekday: 'narrow' })}<b>${d.getDate()}</b></span></th>`).join('')}</tr>
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
<hr class="tm-hr"><h2>Schedule</h2><h3>Working hours</h3>
<p class="muted">Working hours show on Staff Schedules (days off are marked) and you'll get a warning when a job is booked outside them.</p>
${hoursHtml(hours)}</div>
<div class="foot">${s.id && !isOwnerMember(s) ? `<button type="button" class="btn danger" data-act="delStaff" data-id="${s.id}">Remove team member</button>` : ''}<a class="btn alt" href="/team" data-link>Cancel</a><button class="btn">${s.id ? 'Save' : 'Add team member'}</button></div></form>${s.id ? '<div class="qcard login-card" id="loginCard"><h2>Login access</h2><p class="muted">Loading…</p></div>' : ''}`;
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

/* ===== /settings/roles: Roles & Permissions. Owner and Admin have full access; the business makes its other roles ===== */
let roleDraft = null; let roleData = null;
PAGES['/settings/roles'] = {
  title: 'Roles & Permissions',
  async render(main) {
    if (!roleDraft) { roleData = await api('GET', '/api/roles'); roleDraft = structuredClone(roleData.roles); }
    const C = roleData.catalog; const groups = [...new Set(C.map((p) => p.group))];
    const dirty = JSON.stringify(roleDraft.map(({ id, name, desc, perms }) => ({ id, name, desc, perms }))) !== JSON.stringify(roleData.roles.map(({ id, name, desc, perms }) => ({ id, name, desc, perms })));
    const head = (r, i) => `<th class="rp-col"><input class="rp-name" data-i="${i}" data-k="name" value="${esc(r.name)}" maxlength="40" placeholder="Role name" aria-label="Role name">
<input class="rp-desc" data-i="${i}" data-k="desc" value="${esc(r.desc || '')}" maxlength="160" placeholder="What this role is for" aria-label="Description">
<div class="rp-meta"><span class="muted">${r.users ? `${r.users} ${r.users === 1 ? 'person' : 'people'}` : 'No one yet'}</span><button type="button" class="link-btn danger" data-act="roleRm" data-i="${i}" ${r.users ? 'disabled title="Give these team members another role first"' : ''}>Remove</button></div></th>`;
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
A.roleAdd = () => { roleDraft.push({ id: '', name: '', desc: '', perms: ['schedule', 'clients.view', 'jobs.view'], users: 0 }); PAGES['/settings/roles'].render($('#main')); const n = $$('.rp-name'); n[n.length - 1].focus(); };
A.roleRm = (d) => { const r = roleDraft[d.i]; if (r.users) return; if (r.id && !confirm(`Remove the ${r.name} role?`)) return; roleDraft.splice(Number(d.i), 1); PAGES['/settings/roles'].render($('#main')); };
A.roleDiscard = () => { roleDraft = structuredClone(roleData.roles); PAGES['/settings/roles'].render($('#main')); };
A.roleSave = async (d, el) => {
  el.disabled = true;
  try { roleData = await api('PUT', '/api/roles', { roles: roleDraft.map(({ id, name, desc, perms }) => ({ id, name, desc, perms })) }); roleDraft = structuredClone(roleData.roles); toast('Roles saved. Team members see the changes the next time a page loads.'); PAGES['/settings/roles'].render($('#main')); }
  catch (x) { el.disabled = false; toast(x.message, true); }
};

/* ===== /reviews: Google reviews from the connected Business Profile, with replies ===== */
let revState = { filter: 'all', list: [], next: '' };
const starRow = (n, size = 16) => `<span class="stars" style="--sz:${size}px" aria-label="${n} out of 5 stars">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= Math.round(n) ? 'on' : ''}">★</i>`).join('')}</span>`;
PAGES['/reviews'] = {
  title: 'Reviews',
  async render(main) {
    const head = '<div class="head"><div><h1>Reviews</h1><p class="sub">Your Google reviews. Replies show publicly on Google under the review.</p></div></div>';
    const R = await api('GET', '/api/reviews');
    if (!R.connected) {
      main.innerHTML = `${head}<div class="card rv-empty"><div class="conn-ic">${CONN_ICONS.google}</div><h2>Connect your Google Business Profile</h2><p class="muted">See every Google review in one place and reply without leaving ${esc(company.account.productName)}.</p>
${['owner', 'admin'].includes(role()) ? '<a class="btn" href="/settings/connections" data-link>Go to Account Connections</a>' : '<p class="muted">Ask the account owner or an admin to connect it in Account Connections.</p>'}</div>`;
      return;
    }
    revState = { ...revState, list: R.reviews || [], next: R.next || '' };
    const noReply = revState.list.filter((r) => !r.reply).length;
    main.innerHTML = `${head}
<div class="card rv-sum"><div class="rv-avg"><strong>${(R.average || 0).toFixed(1)}</strong>${starRow(R.average || 0, 20)}<span class="muted">${R.total || 0} review${R.total === 1 ? '' : 's'} on Google</span></div>
<div class="rv-ask"><h3>Ask for reviews</h3><p class="muted">Send happy clients this link. It opens Google’s review form for ${esc(R.title || 'your business')}.</p>
${R.reviewUrl ? `<div class="copy-row"><input readonly value="${esc(R.reviewUrl)}" onclick="this.select()" aria-label="Review link"><button type="button" class="btn alt sm" data-act="copyInput">Copy</button></div>` : '<p class="muted">Google hasn’t given a review link for this profile yet.</p>'}
${R.mapsUrl ? `<p style="margin:10px 0 0;font-size:13px"><a href="${esc(R.mapsUrl)}" target="_blank" rel="noopener">See your profile on Google Maps</a></p>` : ''}</div></div>
<div class="tabs rv-tabs" role="tablist">${[['all', 'All'], ['open', `Needs a reply${noReply ? ` (${noReply})` : ''}`], ['replied', 'Replied']].map(([k, l]) => `<button type="button" role="tab" class="${revState.filter === k ? 'on' : ''}" data-act="revFilter" data-f="${k}">${l}</button>`).join('')}</div>
<div id="rvList"></div>`;
    drawReviews();
  },
};
function drawReviews() {
  const box = $('#rvList'); if (!box) return;
  const f = revState.filter; const list = revState.list.filter((r) => f === 'all' || (f === 'open' ? !r.reply : !!r.reply));
  const canReply = canDo('reviews');
  box.innerHTML = (list.length ? list.map((r) => `<article class="card rv" data-name="${esc(r.name)}">
<header>${r.photo ? `<img src="${esc(r.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="rv-ini">${esc((r.reviewer[0] || '?').toUpperCase())}</span>`}<div><strong>${esc(r.reviewer)}</strong><div>${starRow(r.stars)} <span class="muted">${fmtDate(String(r.createdAt || '').slice(0, 10))}</span></div></div></header>
${r.comment ? `<p class="rv-text">${esc(r.comment)}</p>` : '<p class="muted rv-text">A rating with no comment.</p>'}
${r.reply ? `<div class="rv-reply"><div class="rv-reply-h"><strong>Your reply</strong><span class="muted">${fmtDate(String(r.reply.updatedAt || '').slice(0, 10))}</span></div><p>${esc(r.reply.comment)}</p>
${canReply ? '<div class="rv-acts"><button type="button" class="link-btn" data-act="revEdit">Edit</button><button type="button" class="link-btn danger" data-act="revDelete">Delete</button></div>' : ''}</div>`
    : canReply ? '<div class="rv-acts"><button type="button" class="btn alt sm" data-act="revEdit">Reply</button></div>' : ''}
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
<p class="muted" style="font-size:12px;margin:0 0 8px">Your reply shows publicly on Google.</p><div class="rv-acts"><button type="button" class="btn alt sm" data-act="revCancel">Cancel</button><button class="btn sm">${r.reply ? 'Save reply' : 'Post reply'}</button></div>`;
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

/* ===== /social-posts: project photos to the connected Facebook Page and Instagram account ===== */
let spDraft = { photos: [], to: null }; // photos: [{ src, label }] picked from the gallery or the device
// Instagram only takes JPEGs: every photo is redrawn on white (no transparency) and sent as a JPEG, at most 1440px
async function toJpeg(src, max = 1440) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Couldn’t read a photo')); i.src = src; });
  const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.88);
}
PAGES['/social-posts'] = {
  title: 'Social Posts',
  async render(main) {
    const R = await api('GET', '/api/social-posts');
    const head = '<div class="head"><div><h1>Social Posts</h1><p class="sub">Share your work on Facebook and Instagram. Before-and-after photos from your jobs make great posts.</p></div></div>';
    if (!R.facebook && !R.instagram) {
      main.innerHTML = `${head}<div class="card rv-empty"><div class="conn-ic sp-ics">${CONN_ICONS.facebook}${CONN_ICONS.instagram}</div><h2>Connect Facebook or Instagram</h2><p class="muted">Then post photos from your Project Gallery to your Facebook Page and Instagram, right from here.</p>
${['owner', 'admin'].includes(role()) ? '<a class="btn" href="/settings/connections" data-link>Go to Account Connections</a>' : '<p class="muted">Ask the account owner or an admin to connect them in Account Connections.</p>'}</div>`;
      return;
    }
    if (!spDraft.to) spDraft.to = ['facebook', 'instagram'].filter((k) => R[k]);
    const dest = (k, name, label) => `<label class="sp-dest ${R[k] ? '' : 'off'}"><input type="checkbox" name="to" value="${k}" ${R[k] ? '' : 'disabled'} ${R[k] && spDraft.to.includes(k) ? 'checked' : ''}>${CONN_ICONS[k]}<span><strong>${name}</strong><small>${R[k] ? esc(label) : 'Not connected'}</small></span></label>`;
    const res = (p, k, name) => { const r = p.results[k]; if (!r) return ''; return r.status === 'posted' ? `<a class="conn-chip on" href="${esc(r.url)}" target="_blank" rel="noopener"><i></i>${name}: view post</a>` : `<span class="conn-chip bad" title="${esc(r.error)}"><i></i>${name}: didn’t post</span>`; };
    main.innerHTML = `${head}
<form class="card sp-new" id="spForm"><h2>New post</h2>
<div class="sp-dests">${dest('facebook', 'Facebook', R.facebook && R.facebook.name)}${dest('instagram', 'Instagram', R.instagram && '@' + R.instagram.username)}</div>
<div class="sp-photos" id="spPhotos"></div>
<div class="sp-add"><button type="button" class="btn alt sm" data-act="spGallery">Choose from Project Gallery</button><label class="btn alt sm">Upload photos<input type="file" accept="image/*" multiple hidden id="spFile"></label><span class="muted" style="font-size:13px">Up to 10 photos. The first one is the cover.</span></div>
<label>Caption<textarea name="caption" rows="4" maxlength="2200" placeholder="Another pool back to sparkling! Swipe to see the before and after. Call us for a free quote.">${esc(spDraft.caption || '')}</textarea></label>
<div class="sp-foot"><span class="muted" id="spCount" style="font-size:13px"></span><button class="btn">Post now</button></div></form>
<div class="card"><h2>Posted</h2>${(R.posts || []).length ? `<div class="sp-list">${R.posts.map((p) => `<div class="sp-row">${p.images[0] ? `<img src="${esc(p.images[0])}" alt="" loading="lazy">` : '<span class="sp-noimg"></span>'}
<div><p>${p.caption ? esc(p.caption.length > 220 ? p.caption.slice(0, 220) + '…' : p.caption) : '<span class="muted">No caption</span>'}</p><div class="sp-meta"><span class="muted">${fmtDate(p.createdAt.slice(0, 10))}${p.by ? ' · ' + esc(p.by) : ''}${p.images.length > 1 ? ` · ${p.images.length} photos` : ''}</span>${res(p, 'facebook', 'Facebook')}${res(p, 'instagram', 'Instagram')}</div>
${Object.values(p.results).filter((r) => r.status !== 'posted').map((r) => `<p class="sp-err">${esc(r.error)}</p>`).join('')}</div>
${['owner', 'admin'].includes(role()) ? `<button type="button" class="x sp-x" data-act="spRemove" data-id="${p.id}" title="Remove from this list (it stays on Facebook and Instagram)" aria-label="Remove from this list">×</button>` : ''}</div>`).join('')}</div>` : '<p class="muted" style="margin:0">Nothing posted yet.</p>'}</div>`;
    const f = $('#spForm'); const cap = f.caption;
    const count = () => { $('#spCount').textContent = `${cap.value.length} / 2,200`; spDraft.caption = cap.value; }; cap.addEventListener('input', count); count();
    $$('input[name=to]', f).forEach((c) => c.addEventListener('change', () => { spDraft.to = $$('input[name=to]:checked', f).map((x) => x.value); }));
    $('#spFile').addEventListener('change', async (e) => {
      for (const file of [...e.target.files]) { if (spDraft.photos.length >= 10) { toast('Up to 10 photos per post', true); break; } try { spDraft.photos.push({ src: await readFileAsDataUrl(file), label: file.name }); } catch (x) { toast('Couldn’t read ' + file.name, true); } }
      e.target.value = ''; drawSpPhotos();
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); const btn = $('.sp-foot .btn', f); const to = spDraft.to;
      if (!to.length) return toast('Choose Facebook, Instagram or both', true);
      if (to.includes('instagram') && !spDraft.photos.length) return toast('Instagram posts need at least one photo', true);
      if (!spDraft.photos.length && !cap.value.trim()) return toast('Add a photo or write a caption', true);
      btn.disabled = true; btn.textContent = 'Posting…';
      try {
        const images = []; for (const p of spDraft.photos) images.push(await toJpeg(p.src));
        const p = await api('POST', '/api/social-posts', { caption: cap.value, images, to });
        const bad = Object.entries(p.results).filter(([, r]) => r.status !== 'posted');
        if (bad.length) toast(`Didn’t post to ${bad.map(([k]) => (k === 'facebook' ? 'Facebook' : 'Instagram')).join(' or ')}: ${bad[0][1].error}`, true); else toast('Posted');
        if (bad.length < Object.keys(p.results).length) spDraft = { photos: [], to: null };
        refresh();
      } catch (x) { btn.disabled = false; btn.textContent = 'Post now'; toast(x.message, true); }
    });
    drawSpPhotos();
  },
};
function drawSpPhotos() {
  const box = $('#spPhotos'); if (!box) return;
  box.innerHTML = spDraft.photos.map((p, i) => `<figure><img src="${esc(p.src)}" alt="${esc(p.label)}">${i === 0 ? '<span class="sp-cover">Cover</span>' : ''}<div class="sp-tools">${i ? `<button type="button" data-act="spMove" data-i="${i}" title="Move earlier" aria-label="Move earlier">‹</button>` : ''}<button type="button" data-act="spDrop" data-i="${i}" title="Remove" aria-label="Remove photo">×</button></div></figure>`).join('');
  box.hidden = !spDraft.photos.length;
}
A.spDrop = (d) => { spDraft.photos.splice(+d.i, 1); drawSpPhotos(); };
A.spMove = (d) => { const i = +d.i; [spDraft.photos[i - 1], spDraft.photos[i]] = [spDraft.photos[i], spDraft.photos[i - 1]]; drawSpPhotos(); };
A.spRemove = async (d) => { if (!confirm('Remove this post from the list? It stays on Facebook and Instagram.')) return; await api('DELETE', '/api/social-posts/' + d.id); refresh(); };
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
// social media pages (Company Profile); the server turns a handle into the page's link
const SOCIAL = [['facebook', 'Facebook', 'facebook.com/yourbusiness'], ['instagram', 'Instagram', '@yourbusiness'], ['tiktok', 'TikTok', '@yourbusiness'], ['x', 'X (Twitter)', '@yourbusiness'],
  ['youtube', 'YouTube', '@yourbusiness'], ['linkedin', 'LinkedIn', 'linkedin.com/company/yourbusiness'], ['google', 'Google Business Profile', 'Link to your Google business page or reviews'], ['yelp', 'Yelp', 'yelp.com/biz/yourbusiness'], ['nextdoor', 'Nextdoor', 'nextdoor.com/pages/yourbusiness']];
// App Settings → Regional settings: time zone, date and time formats, first day of the week
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
function companySettingsHtml(c, logoBox = '') {
  const hasParts = ['addrStreet1', 'addrStreet2', 'addrCity', 'addrState', 'addrZip'].some((k) => c[k]);
  const v = (k) => esc(c[k] ?? '');
  const country = c.addrCountry || 'United States';
  return `<div class="cs-cols"><div class="cs-col"><div class="card cs"><h2>Company details</h2>
${fl('Company name', `<input name="name" required value="${v('name')}">`)}${fl('Phone number', `<input name="phone" type="tel" value="${v('phone')}">`)}
${fl('Website URL', `<input name="website" value="${v('website')}">`)}${fl('Email address', `<input name="email" type="email" value="${v('email')}">`)}
<div class="fl-group">${fl('Street 1', `<input name="addrStreet1" value="${hasParts ? v('addrStreet1') : esc(c.address || '')}">`)}${fl('Street 2', `<input name="addrStreet2" value="${v('addrStreet2')}">`)}
<div class="fl-split">${fl('City', `<input name="addrCity" value="${v('addrCity')}">`)}${fl('State', `<input name="addrState" value="${v('addrState')}">`)}</div>
<div class="fl-split">${fl('Zip code', `<input name="addrZip" value="${v('addrZip')}">`)}${flSelect('Country', 'addrCountry', [...new Set([...COUNTRIES, country])].map((x) => [x, x]), country)}</div></div>
${switchRow('addressPrivate', 'Keep address private', c.addressPrivate, 'We won’t show your address to clients in the client portal.')}
<hr class="cs-hr"><h3>Business hours</h3><p class="muted cs-note">Your usual opening times.</p>
${hoursHtml(staffHours({ hours: c.hours || { sat: { on: false, start: '09:00', end: '17:00' }, sun: { on: false, start: '09:00', end: '17:00' } } }), 'Closed')}
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
async function companyPage(main, full) {
  const c = company; const integ = full ? await api('GET', '/api/integrations') : null;
  // App Settings boxes; on App Settings they sit in two columns outside the form, so their fields say form="cf"
  const logoBox = planHas('branding') ? `<div class="card${full ? '' : ' cs'}"><h2>Logo</h2><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div id="logoPrev" style="width:120px;height:70px;border:1px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden">${c.logo ? `<img src="${esc(c.logo)}" style="max-width:100%;max-height:100%">` : '<span class="muted">No logo</span>'}</div><div><div class="logo-acts"><input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" style="width:auto">${c.logo ? '<button type="button" class="btn danger sm" data-act="removeLogo">Delete logo</button>' : ''}</div><div class="muted">Appears on quotes, invoices and the client portal.</div></div></div></div>` : '';
  const iconBox = full && planHas('branding') ? `<div class="card"><h2>App icon</h2><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div id="iconPrev" style="width:64px;height:64px;border:1px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden">${c.icon ? `<img src="${esc(c.icon)}" style="width:100%;height:100%;object-fit:contain">` : '<span class="muted">No icon</span>'}</div><div><input type="file" id="iconFile" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="width:auto"><div class="muted">Shown in the browser tab. A square image works best.</div></div></div></div>` : '';
  const brandBox = full ? `<div class="card"><h2>${planHas('branding') ? 'Branding and defaults' : 'Defaults'}</h2>${planHas('branding') ? `<div class="row"><label>Brand color<input form="cf" name="brandColor" type="color" value="${esc(c.brandColor || '#2563eb')}"></label></div>` : ''}<label>Invoice footer message<input form="cf" name="invoiceFooter" value="${esc(c.invoiceFooter)}"></label></div>` : '';
  const prefixBox = full ? planHas('numberPrefixes') ? `<div class="card"><h2>Number prefixes</h2><p class="muted" style="margin-top:0">The label in front of each quote, job and invoice number. Changes apply to new ones only; existing numbers stay as they are.</p>
<div class="row3 prefix-row">${[['quotePrefix', 'Quotes', 1005], ['jobPrefix', 'Jobs', 2010], ['invoicePrefix', 'Invoices', 3010]].map(([k, l, n]) => `<label>${l}<input form="cf" name="${k}" maxlength="10" value="${esc(docPrefix(k))}" data-sample="${n}"><span class="muted prefix-eg">e.g. ${esc(docPrefix(k))}${n}</span></label>`).join('')}</div></div>` : '' : '';
  const zelleBox = full && planHas('zelle') ? `<div class="card" id="zelle"><h2>Zelle payments</h2><p class="muted" style="margin-top:0">Shown to clients on the invoice pay page and the quote deposit step. Leave blank to hide Zelle. Zelle payments can’t be confirmed automatically: when a client reports one, check your bank, then use Mark paid.</p>
<div class="row"><label>Zelle email or phone<input form="cf" name="zelleRecipient" value="${esc(c.zelleRecipient || '')}" placeholder="payments@yourbusiness.com or +17135550100"></label><label>Name registered with Zelle<input form="cf" name="zelleName" value="${esc(c.zelleName || '')}" placeholder="e.g. TLB Group LLC"></label></div></div>` : '';
  const aiBox = full ? planHas('ai') ? `<div class="card"><h2>AI assistance</h2><p class="muted" style="margin-top:0">Shows a “Write with AI” button that drafts product and service descriptions from their name.${integ.ai ? '' : ' AI isn’t available on this service yet.'}</p>
<div class="ai-toggle"><span class="cstatus ${c.aiEnabled !== false ? 'active' : ''}">${c.aiEnabled !== false ? 'On' : 'Off'}</span><button type="button" class="btn alt sm" data-act="toggleAi">${c.aiEnabled !== false ? 'Turn off AI assistance' : 'Turn on AI assistance'}</button></div></div>` : '' : '';
  main.innerHTML = `<div class="head"><div><h1>${full ? 'App Settings' : 'Company settings'}</h1>${full ? '<p class="sub">Branding and defaults used on every quote and invoice. Business details, social media and tax settings are on <a href="/settings/company" data-link>Company Profile</a>.</p>' : ''}</div></div>
${full ? planCard(c.account) : ''}
${full ? `<div class="as-cols"><div class="as-col">${webAddressCard(c.account)}${iconBox}${brandBox}${regionalBox(c)}</div><div class="as-col">${payCard(integ)}${zelleBox}${aiBox}${prefixBox}</div></div>
<form id="cf"><div class="as-save"><button class="btn">Save changes</button></div></form>` : `<form id="cf" class="cs-form">${companySettingsHtml(c, logoBox)}<div class="cs-foot"><button class="btn">Update settings</button></div></form>`}`;
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
  if (full) { stripeReturnNotice(integ); const to = location.hash === '#payments' || location.hash === '#zelle' ? $(location.hash, main) : null; if (to) to.scrollIntoView({ block: 'start' }); } // back from Stripe, or a link to Card payments
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
  const beta = (f) => (f.beta ? ' <span class="beta-tag" title="This feature is in beta testing">Beta</span>' : '');
  const inc = a.featureList.filter((f) => f.included); const not = a.featureList.filter((f) => !f.included);
  const contact = a.contactEmail ? `<a href="mailto:${esc(a.contactEmail)}?subject=${encodeURIComponent('Plan change for ' + (company.name || a.slug))}">${esc(a.contactEmail)}</a>` : 'us';
  return `<div class="card plan-card"><div class="plan-head"><div><h2>Your plan: ${esc(a.plan.name)}</h2><p class="muted" style="margin:0">${a.maxUsers ? `Up to ${a.maxUsers} login${a.maxUsers === 1 ? '' : 's'}` : 'Unlimited logins'} · ${inc.length + a.alwaysIncluded.length} features</p></div>${not.length ? `<p class="muted" style="margin:0">To change your plan, contact ${contact}.</p>` : ''}</div>
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
  return { ...base, desc: inApp ? 'Let clients pay invoices and quote deposits by card. The money goes straight to your bank account.' : base.desc, status: connChip('off', 'Not connected'), button: 'Connect', body: `<ol class="pay-steps">${steps}</ol>
<p class="muted" style="font-size:13px">Stripe charges its standard card processing fees${S.feePercent ? `, plus a ${S.feePercent}% platform fee on each payment` : ''}. Until you ${inApp ? 'set up card payments' : 'connect'}, clients can’t pay by card.</p>
<div class="sms-test">${inApp ? '<a class="btn" href="/settings/card-payments" data-link>Set up card payments</a>' : ''}${viaStripe ? `<button type="button" class="btn ${inApp ? 'alt' : ''}" data-act="connectStripe">Connect with Stripe</button>` : ''}</div>
${inApp && viaStripe ? '<p class="muted" style="font-size:13px;margin-top:8px">Already use Stripe? <strong>Connect with Stripe</strong> links your own Stripe account instead, and you manage payments in your Stripe dashboard.</p>' : ''}` };
}
async function connectionsPage(main) {
  const [integ, C] = await Promise.all([api('GET', '/api/integrations'), api('GET', '/api/connections')]);
  connReturnNotice();
  const admin = ['owner', 'admin'].includes(role());
  const soon = { status: connChip('off', 'Coming soon'), button: '<button type="button" class="btn alt conn-btn" disabled title="Coming soon">Connect</button>' };
  const connect = (id) => ({ status: connChip('off', 'Not connected'), button: admin ? `<button type="button" class="btn alt conn-btn" data-act="socialConnect" data-kind="${id}">Connect</button>` : '' });
  const connected = (id, to, n) => ({ status: connChip('on', 'Connected'), connectedTo: `Connected to ${to}.${admin && n > 1 ? ` <button type="button" class="link-btn" data-act="socialChoose" data-kind="${id}">Change</button>` : ''}`,
    button: admin ? `<button type="button" class="btn alt conn-btn" data-act="socialDisconnect" data-kind="${id}">Disconnect</button>` : '' });
  const state = (id, x, to) => (!x.available ? soon : x.connected ? connected(id, to, x.choices) : connect(id));
  const G = C.google; const F = C.facebook; const I = C.instagram;
  // Google's features, each managed on its own (Jobber-style sub-rows)
  const sub = (title, desc, chip, btn) => `<div class="conn-sub"><div><h3>${title} ${chip}</h3><p>${desc}</p></div>${btn}</div>`;
  const gSubs = G.connected ? [
    G.reviewsPlan ? sub('Reviews', 'See your Google reviews and reply to them from here.', '', '<a class="btn alt sm" href="/reviews" data-link>Manage</a>') : '',
    G.bookingPlan ? sub('Online booking', 'Add a <strong>Book</strong> button to your Google Business Profile that opens your booking page.', G.booking ? connChip('on', 'On') : connChip('off', 'Off'), admin ? '<button type="button" class="btn alt sm" data-act="bookingManage">Manage</button>' : '') : '',
  ].join('') : '';
  const posts = C.postsPlan ? ' Then post your project photos from <a href="/social-posts" data-link>Social Posts</a>.' : '';
  const rows = [
    { id: 'google', icon: 'google', title: 'Google Business Profile', desc: 'Connect your Google Business Profile and manage which features use it.', ...state('google', G, `<strong>${esc(G.title)}</strong>`), body: gSubs },
    { id: 'facebook', icon: 'facebook', title: 'Facebook Business Page', desc: `Connect your Facebook Business Page and manage which features use it. You’ll need full admin permissions for the business profile to connect it.${F.connected ? posts : ''}`,
      ...state('facebook', F, F.link ? `<a href="${esc(F.link)}" target="_blank" rel="noopener"><strong>${esc(F.name)}</strong></a>` : `<strong>${esc(F.name)}</strong>`) },
    { id: 'instagram', icon: 'instagram', title: 'Instagram account', desc: `Connect your Instagram account to publish Instagram posts. You’ll need an Instagram professional account: either Business or Creator.${I.connected ? posts : ''}`,
      ...state('instagram', I, `<a href="https://www.instagram.com/${encodeURIComponent(I.username)}" target="_blank" rel="noopener"><strong>@${esc(I.username)}</strong></a>`) },
    ...(planHas('ai') ? [{ id: 'ai', icon: 'ai', feature: 'ai', title: 'AI descriptions', button: '', body: '', status: integ.ai ? connChip('on', company.aiEnabled !== false ? 'On' : 'Turned off') : connChip('off', 'Not available yet'),
      desc: `“Write with AI” drafts product and service descriptions from their name. ${integ.ai ? 'Turn it on or off in <a href="/settings" data-link>App Settings</a>.' : ''}` }] : []),
  ];
  // connections for features the platform marks as Beta get a Beta tag and a short notice
  const beta = (r) => !!(r.feature && company.account && (company.account.featureList || []).some((f) => f.key === r.feature && f.beta));
  main.innerHTML = `<div class="head"><div><h1>Account Connections</h1><p class="sub">Connect other accounts your business uses. Card payments are set up in <a href="/settings#payments" data-link>App Settings</a>; emails and texts to clients are sent for you.</p></div></div>
<div class="card conn-list">${rows.map((r) => `<section class="conn" id="conn-${r.id}"><div class="conn-ic">${CONN_ICONS[r.icon]}</div>
<div class="conn-main"><h2>${esc(r.title)}${beta(r) ? '<span class="beta-tag" title="This feature is in beta testing">Beta</span>' : ''} ${r.status}</h2>${r.connectedTo ? `<p class="conn-to">${r.connectedTo}</p>` : ''}<p>${r.desc}</p>${beta(r) ? '<p class="beta-note">This feature is in beta testing. It works, but it may change and you might run into rough edges. Tell us if something doesn’t look right.</p>' : ''}</div>
<div class="conn-act">${r.button || ''}</div>
${r.body ? `<div class="conn-body conn-subs">${r.body}</div>` : ''}</section>`).join('')}</div>
${admin ? '' : '<p class="muted" style="font-size:13px">Only the account owner or an admin can connect or disconnect accounts.</p>'}`;
  connectionsData = C;
}
let connectionsData = null;
const CONN_NAMES = { google: 'Google Business Profile', facebook: 'Facebook Page', instagram: 'Instagram account' };
// back from Google or Facebook's sign-in (lib/platform.js → /oauth/…/callback)
function connReturnNotice() {
  const q = new URLSearchParams(location.search); const ok = q.get('connected'); const bad = q.get('connect_error'); if (!ok && !bad) return;
  history.replaceState(null, '', location.pathname);
  if (ok) toast(`${CONN_NAMES[ok] || 'Account'} connected`);
  else toast(q.get('reason') === 'cancelled' ? 'Connection cancelled. Nothing was changed.' : `Couldn’t connect: ${q.get('reason') || 'something went wrong'}`, true);
}
A.socialConnect = async (d, el) => {
  el.disabled = true;
  try { const { url } = await api('POST', `/api/connections/${d.kind}/start`, {}); location.href = url; } catch (e) { el.disabled = false; toast(e.message, true); }
};
A.socialDisconnect = async (d) => {
  const why = { google: 'Your reviews will stop showing here, and the Book button comes off your Google profile.', facebook: 'You won’t be able to post to the Page from here.', instagram: 'You won’t be able to post to Instagram from here.' }[d.kind];
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
<p style="margin:16px 0 6px"><strong>Your booking page</strong></p><p class="muted" style="margin:0 0 8px;font-size:13px">Add it to your website, social media bio or email signature.</p>
<div class="copy-row"><input readonly value="${esc(G.bookingUrl)}" onclick="this.select()" aria-label="Booking page link"><button type="button" class="btn alt sm" data-act="copyInput">Copy</button><a class="btn alt sm" href="${esc(G.bookingUrl)}" target="_blank" rel="noopener">Open</a></div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button type="button" class="btn" data-act="bookingSave">Save</button></div>`);
  return mb;
};
A.bookingSave = async (d, el) => {
  const on = $('#bkOn').checked; el.disabled = true;
  try { await api('PUT', '/api/connections/google', { booking: on }); closeModal(); toast(on ? 'The Book button is on. Google can take a few hours to show it.' : 'The Book button is off'); refresh(); } catch (e) { el.disabled = false; toast(e.message, true); }
};
A.toggleConn = (d) => {
  const sec = $(`#conn-${d.id}`); const body = sec && $('.conn-body', sec); if (!body) return;
  body.hidden = !body.hidden; $('.conn-btn', sec).setAttribute('aria-expanded', String(!body.hidden));
  if (!body.hidden) { const f = $('input:not([disabled]):not([readonly]), select', body); if (f) f.focus(); }
};
// App Settings → Card payments: the one-time Stripe setup (Stripe Connect), so clients can pay invoices and deposits by card
function payCard(integ) {
  const r = stripeConn(integ);
  return `<div class="card pay-card" id="payments"><div class="pay-card-h">${CONN_ICONS.stripe}<div><h2>Card payments ${r.status}</h2><p class="muted" style="margin:0">${r.desc}</p></div></div>${r.body ? `<div class="pay-card-b">${r.body}</div>` : ''}
<p class="muted" style="font-size:13px;margin:12px 0 0">Emails and text messages to your clients are sent for you by ${esc(company.account.productName)}, in your business name.</p></div>`;
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
PAGES['/settings/emails'] = {
  title: 'Email Templates',
  // a list of the emails; clicking one opens it in an editor with a live preview
  async render(main) {
    TPL.list = await api('GET', '/api/email-templates');
    main.innerHTML = `<div class="head"><div><h1>Email Templates</h1><p class="sub">Edit the emails sent to clients. Each one shows your logo, business name and brand color (Company Profile and App Settings).</p></div></div>
<div class="card ctable"><div class="tablewrap"><table class="tpl-list"><tr><th>Email</th><th>When it’s sent</th><th>Subject</th><th></th></tr>
${TPL.list.map((t) => `<tr class="crow" data-act="editTpl" data-key="${t.key}"><td><strong>${esc(t.label)}</strong>${t.custom ? ' <span class="badge sent">customized</span>' : ''}</td><td class="muted">${esc(t.description)}</td><td class="tpl-subj">${esc(t.subject)}</td>
<td class="r"><button type="button" class="btn alt sm" data-act="editTpl" data-key="${t.key}">Edit</button></td></tr>`).join('')}</table></div></div>`;
  },
};
const TPL = { list: [] };
const tplSample = () => ({ client_name: 'Jane Smith', company_name: company.name || 'Your Business', quote_number: docPrefix('quotePrefix') + '1005', quote_title: 'Backyard cleanup', invoice_number: docPrefix('invoicePrefix') + '3010', total: '$1,250.00', due_date: fmtDate(ymd(addDays(new Date(), 14))), job_number: docPrefix('jobPrefix') + '2010', job_title: 'Gutter cleaning', date: fmtDate(ymd(addDays(new Date(), 2))), time: '09:00', address: '100 Main St, Houston, TX 77002', amount: '$1,250.00', paid_for: 'Invoice ' + docPrefix('invoicePrefix') + '3010', reference: 'pi_3Q8x2L4eZvKYlo2C' });
const tplLinks = () => ({ quote: location.origin + '/p/quote/abc123', invoice: location.origin + '/pay/abc123' });
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
    const docHref = `/${R.doc.kind}s/edit?id=${R.doc.id}`;
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
      X ? field('Paid through', X.card && X.card.wallet ? `Digital wallet (${esc(WALLET[X.card.wallet] || X.card.wallet)})` : 'Online payment page') : '',
      field('Transaction number', X ? `<code>${esc(X.chargeId || X.paymentIntent)}</code>` : P.reference ? esc(P.reference) : ''),
      !X ? field('Recorded by', esc(P.recordedBy)) : '',
      field('Details', `Payment applied to ${esc(docName)}`),
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
    const summary = `<div class="pd-sum"><h3>Payment summary</h3><div class="pd-l"><span>Payment amount</span><span>${money(P.amount)}</span></div>
${refunded ? `<div class="pd-l pd-ref"><span>Refunded</span><span>−${money(refunded)}</span></div>` : ''}
${X && X.fee != null ? `<div class="pd-l muted"><span>Processing fees</span><span>−${money(X.fee)}</span></div><div class="pd-l muted"><span>Net to you</span><span>${money(X.net - refunded)}</span></div>` : ''}
<div class="pd-l pd-tot"><span>Paid</span><span>${money(P.amount - refunded)}</span></div></div>`;
    const canRefund = ['owner', 'admin'].includes(role()) && P.refundable && !demo && P.amount - refunded > 0.004;
    const more = `<a class="mi" href="/api/payment-detail/${encodeURIComponent(P.id)}/pdf" download>${MI.pdf}Download PDF</a>${canRefund ? `<button type="button" class="mi" data-act="pdRefund">${MI.refund}Issue a Refund</button>` : ''}`;
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
    try { await api('POST', `/api/payment-detail/${encodeURIComponent(P.id)}/refund`, { amount: v, reason: f.reason.value, note: f.note.value }); closeModal(); toast(viaStripe ? `Refund of ${money(v)} sent` : `Refund of ${money(v)} recorded`); refresh(); }
    catch (x) { go.disabled = false; go.textContent = `Refund ${money(v)}`; toast(x.message, true); }
  });
};
A.pdCopy = async (d) => { try { await navigator.clipboard.writeText(d.v); toast('Transaction number copied'); } catch (e) { toast(d.v); } };
A.pdClient = (d) => clientForm(byId(D.clients, d.id));
A.pdReceipt = async (d, el) => {
  el.disabled = true; el.textContent = 'Sending…';
  try { const r = await api('POST', `/api/payment-detail/${encodeURIComponent(d.id)}/receipt`, {}); toast(`Receipt sent to ${r.to}`); refresh(); } catch (e) { toast(e.message, true); el.disabled = false; el.textContent = 'Send receipt'; }
};

const refundSum = (l) => (l || []).filter((r) => r.status !== 'failed' && r.status !== 'canceled').reduce((s, r) => s + (Number(r.amount) || 0), 0);
const refundStatus = (amount, refunded) => (refunded >= amount - 0.004 && refunded > 0 ? 'refunded' : refunded > 0 ? 'partly refunded' : 'succeeded');
function paymentRows() {
  const rows = [];
  for (const i of D.invoices) {
    for (const p of i.payments || []) rows.push({ id: p.id, clientId: i.clientId, doc: ['invoice', i], date: (p.date || '').slice(0, 10), method: p.method, amount: Number(p.amount) || 0, reference: p.reference || '', refunded: refundSum(p.refunds) });
    if (!(i.payments || []).length && i.status === 'paid' && i.paidAt) rows.push({ id: 'i-' + i.id, clientId: i.clientId, doc: ['invoice', i], date: i.paidAt.slice(0, 10), method: i.paymentMethod || 'other', amount: Number(i.paidAmount || i.total) || 0, reference: '' });
  }
  for (const q of D.quotes) if (q.depositPaidAt) rows.push({ id: 'q-' + q.id, clientId: q.clientId, doc: ['quote', q], date: q.depositPaidAt.slice(0, 10), method: q.depositMethod || 'other', amount: Number(q.depositPaidAmount ?? q.depositFee) || 0, reference: q.depositReference || '' });
  return rows;
}
const PAY_STATUS = { succeeded: ['Succeeded', 'paid'], processing: ['Processing', 'sent'], refunded: ['Refunded', 'draft'], 'partly refunded': ['Partly refunded', 'draft'], disputed: ['Disputed', 'overdue'], failed: ['Failed', 'failed'] };
const online = (m) => m === 'stripe' || m === 'demo' || m === 'demo-card';
let payView = { tab: 'overview', status: 'all', method: 'all', date: 'all', q: '', sort: 'date', dir: -1 };
PAGES['/payments'] = {
  title: 'Payments',
  async render(main) {
    const v = payView; const S = planHas('onlinePayments') ? await api('GET', '/api/payments/stripe').catch(() => ({ connected: false })) : { connected: false };
    const day = (s) => (s || '').slice(0, 10); const ago = (n) => ymd(addDays(new Date(), -n)); const tomorrow = ymd(addDays(new Date(), 1));
    const rows = paymentRows().map((r) => {
      const ch = r.method === 'stripe' && S.charges ? S.charges[r.reference] : null;
      return { ...r, status: (ch && ch.status) || refundStatus(r.amount, r.refunded || 0), payout: r.method === 'stripe' ? (ch && ch.payoutDate ? fmtDate(ch.payoutDate) : 'In Stripe') : online(r.method) ? 'Demo: no payout' : 'Manually deposited',
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
    const docLink = ([kind, d]) => `<a href="/${kind}s/edit?id=${d.id}" data-link>${kind === 'quote' ? 'Quote' : 'Invoice'} ${esc(d.number)}</a>`;
    const admin = !me || ['owner', 'admin'].includes(me.role);
    const overview = `<div class="cstats pay-stats">
<div class="cstat"><div class="cs-h"><strong>Upcoming payouts</strong></div><div class="cs-v">${money(upcoming)}</div><div class="muted">${!S.connected ? 'Payouts appear here once you connect Stripe and collect online payments' : UP.length ? `<button type="button" class="link-btn up-link" data-act="viewPayouts">View ${UP.length} payout${UP.length === 1 ? '' : 's'}</button>` : 'Upcoming payouts appear after you collect payments'}</div></div>
<button class="cstat" data-act="payInvoices"><div class="cs-h"><strong>Invoice payment time</strong><span>↗</span></div><div class="muted">Past 30 days</div><div class="pts">${stat(payDays, 30, true, (d) => `${d} ${d === 1 ? 'day' : 'days'}`)}</div></button>
<div class="cstat"><div class="cs-h"><strong>Invoices paid on time</strong></div><div class="muted">Last 60 days</div><div class="pts">${stat(onTime, 60, false, (p) => p + '%')}</div></div></div>
<h2 class="ftitle">All payments <span class="muted">(${list.length} result${list.length === 1 ? '' : 's'})</span></h2>
<div class="cfilters"><label class="pill">Status<select data-pv="status"><option value="all">All</option>${Object.entries(PAY_STATUS).map(([k, [l]]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
<label class="pill">Method<select data-pv="method"><option value="all">All</option><option value="online" ${v.method === 'online' ? 'selected' : ''}>Online</option>${methods.map((m) => `<option value="${esc(m)}" ${v.method === m ? 'selected' : ''}>${esc(payLabel(m))}</option>`).join('')}</select></label>
<label class="pill">📅 Date<select data-pv="date">${[['all', 'All'], ['30', 'Past 30 days'], ['90', 'Past 90 days'], ['year', 'This year']].map(([k, l]) => `<option value="${k}" ${v.date === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
<input id="pq" class="csearch" type="search" placeholder="Search payments…" value="${esc(v.q)}"></div>
<div class="card ctable"><div class="tablewrap"><table><tr>${th('client', 'Client')}${th('date', 'Payment date')}${th('status', 'Payment status')}${th('method', 'Method')}${th('payout', 'Payout date')}${th('amount', 'Amount', 'r')}</tr>
${list.map((r) => `<tr class="crow" data-id="${esc(r.id)}" title="See this payment"><td><strong>${esc(cname(r))}</strong><div class="pay-ref">${docLink(r.doc)}</div></td><td style="white-space:nowrap">${fmtDate(r.date)}</td>
<td><span class="badge ${PAY_STATUS[r.status][1]}">${PAY_STATUS[r.status][0]}</span></td><td>${r.method === 'stripe' ? '💳 ' : ''}${esc(r.methodLabel)}</td><td style="white-space:nowrap">${esc(r.payout)}</td><td class="r"><strong>${money(r.amount)}</strong></td></tr>`).join('')
  || `<tr><td colspan="6" class="empty">${rows.length ? 'No payments match these filters' : 'No payments yet. Payments show up here when clients pay online or you record a payment on an invoice.'}</td></tr>`}</table></div></div>`;
    const payouts = !S.connected ? `<div class="card"><h2>Payouts</h2><p class="muted">When clients pay online, Stripe sends the money to your bank account. ${admin ? '<a href="/settings#payments" data-link>Connect Stripe</a> in App Settings to start taking online payments.' : 'Ask the account owner to connect Stripe.'}</p></div>`
      : `<div class="card ctable"><div class="tablewrap"><table><tr><th>Arrival date</th><th>Status</th><th>Bank account</th><th class="r">Amount</th></tr>
${S.payouts.map((p) => `<tr><td>${fmtDate(p.arrival)}</td><td><span class="badge ${p.status === 'paid' ? 'paid' : p.status === 'failed' || p.status === 'canceled' ? 'failed' : 'sent'}">${esc({ paid: 'Paid', pending: 'Pending', in_transit: 'In transit', canceled: 'Canceled', failed: 'Failed' }[p.status] || p.status)}</span></td><td>${p.bank ? `${esc(p.bank.name)} •••• ${esc(p.bank.last4)}` : '—'}</td><td class="r"><strong>${money(p.amount)}</strong></td></tr>`).join('')
  || '<tr><td colspan="4" class="empty">No payouts yet. Stripe pays out after your first online payments clear.</td></tr>'}</table></div></div>`;
    main.innerHTML = `<div class="head"><h1>Payments</h1><div class="actions">${admin ? '<a class="btn alt" href="/payments/settings" data-link>Settings</a>' : ''}${S.connected ? `<a class="btn alt" href="https://dashboard.stripe.com/disputes" target="_blank" rel="noopener">Disputes${S.disputes.open ? ` (${S.disputes.open})` : ''}</a>` : ''}</div></div>
<nav class="ptabs">${[['overview', 'Overview'], ['payouts', 'Payouts']].map(([k, l]) => `<button type="button" class="${v.tab === k ? 'on' : ''}" data-act="payTab" data-t="${k}">${l}</button>`).join('')}</nav>
${v.tab === 'payouts' ? payouts : overview}`;
    $$('.crow', main).forEach((r) => r.addEventListener('click', (e) => { if (!e.target.closest('a')) navigate('/payments/view?id=' + encodeURIComponent(r.dataset.id)); }));
    $$('[data-pv]', main).forEach((s) => s.addEventListener('change', (e) => { payView[e.target.dataset.pv] = e.target.value; refresh(); }));
    let t; const q = $('#pq', main); if (q) q.addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(async () => { payView.q = e.target.value; await refresh(); const n = $('#pq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); });
  },
};
A.payTab = (d) => { payView.tab = d.t; refresh(); };
// "View N payouts": the dates and amounts Stripe expects, with a note that they can change
A.viewPayouts = () => {
  const L = payView.upcoming || []; const when = (u) => (u.next ? 'Next payout' : u.clearing ? 'When the payments clear' : new Date(u.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
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
    const P = { ...{ quoteCard: true, quoteAch: false, invoiceCard: true, invoiceAch: false, notifyEmail: true, emailReceipts: true, disabled: false }, ...(company.paySettings || {}) };
    const can = planHas('onlinePayments');
    const sw = (k, label, note, icon, disabled) => `<label class="sw-row pay-sw">${icon ? `<span class="pay-ic" aria-hidden="true">${icon}</span>` : ''}<span class="grow">${label}${note ? `<small class="muted">${note}</small>` : ''}</span><input type="checkbox" class="sw" data-pay="${k}" ${P[k] ? 'checked' : ''} ${disabled ? 'disabled' : ''}><i></i></label>`;
    const off = !can || P.disabled;
    const methodRows = (kind) => sw(kind + 'Card', 'Card payments', 'Credit or debit cards, Apple Pay, or Google Pay', '💳', off)
      + sw(kind + 'Ach', 'Bank payments (ACH)', S.connected ? 'Clients pay directly from their bank account. Turn on ACH Direct Debit in your Stripe account too.' : 'Clients pay directly from their bank account. Needs Stripe connected.', '🏦', off || !S.connected);
    const bal = S.balance ? S.balance.pending + S.balance.available : 0;
    main.innerHTML = `<div class="head"><div><a href="/payments" data-link class="muted">← Payments</a><h1>Payment settings</h1></div></div>
<div class="pay-grid"><div>
${!can ? '<div class="notice">Online payments aren’t included in your plan. You can still record cash, check and other payments on invoices.</div>' : !S.connected ? `<div class="notice">Set up card payments in <a href="/settings#payments" data-link>App Settings → Card payments</a> to take online payments. Until then, clients can’t pay by card.</div>` : ''}
<div class="card"><h2>Client payments</h2>
<h3 class="pay-h">Quote payments<small class="muted">Let clients pay deposits online when viewing quotes</small></h3>${methodRows('quote')}
<h3 class="pay-h">Invoice payments<small class="muted">Let clients pay online when viewing invoices</small></h3>${methodRows('invoice')}</div>
<div class="card"><h2>Notifications</h2>${sw('notifyEmail', 'Get notified of payments by email', `Sent to ${esc(company.email || 'your company email')} when a client pays online`)}${sw('emailReceipts', 'Automatically email receipts to clients', 'Sent from your business when a client pays online')}</div>
${can ? `<div class="card pay-off"><div><h2>${P.disabled ? 'Payments are disabled' : 'Disable payments'}</h2><p class="muted">${P.disabled ? 'Clients can’t pay quotes and invoices online. Zelle details and recorded payments still work.' : 'Clients can’t pay outstanding or new quotes and invoices online.'}</p></div>
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
      try { const r = await api('POST', '/api/account/billing/return', { sessionId: back }); toast(r.message); company = await api('GET', '/api/company'); } catch (err) { toast(err.message, true); }
    } else if (qs.has('canceled') || qs.has('upgrade')) history.replaceState(null, '', location.pathname);
    const B = billingData = await api('GET', '/api/account/billing'); const sub = B.subscription;
    const per = (i) => (i === 'year' ? 'yearly' : 'monthly');
    const ending = sub && sub.cancelAtPeriodEnd;
    const statusText = ending ? `Active until ${fmtDate(sub.periodEnd)}` : sub && sub.status === 'past_due' ? 'Payment past due' : B.status === 'suspended' ? 'Paused' : 'Active';
    const contact = '<button type="button" class="btn alt" data-act="supportForm" data-title="Contact us" data-topic="Account and billing">Contact us</button>'; // the support form, sent to the platform's inbox
    const addr = (a) => (a && a.line1 ? [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(', ') + (a.postal_code ? ' ' + a.postal_code : ''), a.country].filter((x) => x && x.trim()).map(esc).join('<br>') : '<span class="muted">No address yet</span>');
    const subText = !B.managed ? '<p class="muted">This is your platform’s own account, so it has no subscription.</p>'
      : ending && B.pendingPlan ? `<p>Your plan changes to <strong>${esc(B.pendingPlan)}</strong> on ${fmtDate(sub.periodEnd)}. You won’t be charged again.</p><button type="button" class="btn alt sm" data-act="billKeep">Stay on ${esc(B.plan.name)}</button>`
      : ending ? `<p>Your subscription is cancelled. You can keep using ${esc(B.productName)} until <strong>${fmtDate(sub.periodEnd)}</strong>, then the account is paused.</p><button type="button" class="btn" data-act="billKeep">Keep my subscription</button>`
      : sub ? `<p>You will be charged <strong>${money(sub.amount)} USD</strong> for your ${per(sub.interval)} ${esc(B.plan.name)} subscription on ${fmtDate(sub.periodEnd)}, and every ${sub.interval} after that. Plus taxes where applicable.</p>${sub.status === 'past_due' ? '<p class="bill-warn">Your last payment didn’t go through. Update your card and we’ll retry it right away.</p>' : ''}`
      : B.demo ? '<p class="muted">Your account was started with a demo checkout, so nothing is charged. Pick a plan to start a paid subscription.</p>'
      : !B.plan.charge ? `<p>You’re on the ${esc(B.plan.name)} plan${B.plan.price ? ` (${esc(B.plan.price)})` : ''}. There’s nothing to pay.</p>`
      : `<p class="muted">Your ${esc(B.plan.name)} plan isn’t billed automatically yet. Choose it under Change plan to set up automatic payments.</p>`;
    const inv = billingAll ? B.invoices : B.invoices.slice(0, 6);
    main.innerHTML = `<div class="head"><h1>Account and billing</h1></div>
<div class="card bill-ov"><div class="bill-h"><h2>Account overview</h2><div class="actions">${B.managed ? '<button type="button" class="btn" data-act="billPlans">Change plan</button>' : ''}${B.live && B.managed ? '<button type="button" class="btn alt" data-act="billCard">Update card</button>' : ''}</div></div>
<dl class="bill-dl"><div><dt>Active since</dt><dd>${B.activeSince ? fmtDate(B.activeSince) : '—'}</dd></div><div><dt>Account status</dt><dd>${esc(statusText)}</dd></div>
<div><dt>Current plan</dt><dd>${esc(B.plan.name)}${B.plan.charge ? ` <span class="muted">(${B.plan.charge.interval === 'year' ? 'yearly' : 'monthly'}, ${money(B.plan.charge.cents / 100).replace(/\.00$/, '')}/${B.plan.charge.interval})</span>` : B.plan.price ? ` <span class="muted">(${esc(B.plan.price)})</span>` : ''}</dd></div></dl></div>
<div class="bill-grid">
<div class="card"><div class="bill-h"><h2>Billing details</h2>${B.live && B.managed ? '<button type="button" class="btn alt sm" data-act="billEdit">Edit</button>' : ''}</div>
${B.card ? `<div class="bill-card"><span class="bill-brand">${esc(CARD_BRANDS[B.card.brand] || B.card.brand)}</span><div><small class="muted">CARD NUMBER</small><div>•••• ${esc(B.card.last4)}</div></div><div class="r"><small class="muted">EXPIRY</small><div>${String(B.card.expMonth).padStart(2, '0')}/${String(B.card.expYear).slice(-2)}</div></div></div>`
  : `<div class="bill-card"><span class="muted">No card on file.</span>${B.live && B.managed ? '<span></span><button type="button" class="btn alt sm" data-act="billCard">Add card</button>' : ''}</div>`}
${B.managed ? `<div class="bill-two"><div><strong>Name</strong><div>${esc(B.customer && B.customer.name) || '<span class="muted">—</span>'}</div>${B.customer && B.customer.email ? `<div class="muted" style="font-size:13px">${esc(B.customer.email)}</div>` : ''}</div><div><strong>Address</strong><div>${addr(B.customer && B.customer.address)}</div></div></div>` : ''}
<div class="bill-sub"><strong>Plan subscription</strong>${subText}</div></div>
<div class="card"><h2>Payment history</h2>${inv.length ? `<table class="bill-hist">${inv.map((i) => `<tr><td>${fmtDate(i.date)}</td><td class="r">${money(i.amount)} ${esc(i.currency)}</td>
<td><span class="badge ${i.status === 'paid' ? 'paid' : i.status === 'open' ? 'overdue' : 'draft'}">${esc({ paid: 'Paid', open: 'Unpaid', void: 'Void', uncollectible: 'Unpaid' }[i.status] || i.status)}</span></td>
<td class="r">${i.receiptUrl ? `<a class="btn alt sm" href="${esc(i.receiptUrl)}" target="_blank" rel="noopener">${i.status === 'open' ? 'Pay' : 'Receipt'}</a>` : ''}</td></tr>`).join('')}</table>${!billingAll && B.invoices.length > inv.length ? '<button type="button" class="link-btn" data-act="billMore">View more payments</button>' : ''}`
  : '<p class="muted">No payments yet.</p>'}</div>
${B.managed ? `<div class="card bill-change"><h2>Change subscription</h2><p>Switch plans any time. Moving to a bigger plan takes effect right away and you’re charged the difference for the rest of this billing period; moving to a smaller plan credits the difference to your next bill.</p>
${sub && !ending ? `<p class="muted">You can also cancel anytime. You keep using ${esc(B.productName)} until the end of the period you’ve paid for; after that the account is paused and your team can’t log in.</p>` : ''}
<div class="bill-acts">${contact}<button type="button" class="btn alt" data-act="billPlans">Change plan</button>${sub && !ending ? '<button type="button" class="link-btn bill-cancel" data-act="billCancel">Cancel subscription</button>' : ''}</div></div>` : ''}
</div>`;
    if (qs.has('upgrade') && B.managed) A.billPlans(); // from an “Upgrade your plan” link
  },
};
const billGo = async (url, body, el) => { // POST, then follow Stripe's page or show the result
  if (el) el.disabled = true;
  try { const r = await api('POST', url, body); if (r.redirect) { location.href = r.redirect; return; } closeModal(); toast(r.message || 'Saved'); refresh(); }
  catch (err) { toast(err.message, true); if (el) el.disabled = false; }
};
A.billMore = () => { billingAll = true; refresh(); };
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
<div class="bill-cardrow"><span>Card: ${billingData.card ? `${esc(CARD_BRANDS[billingData.card.brand] || billingData.card.brand)} •••• ${esc(billingData.card.last4)}` : 'none on file'}</span><button type="button" class="btn alt sm" data-act="billCard">${billingData.card ? 'Update card' : 'Add card'}</button></div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  $('#bdf', m).addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('button.btn:not(.alt)', e.target); btn.disabled = true;
    try { await api('PUT', '/api/account/billing/details', Object.fromEntries(new FormData(e.target))); closeModal(); toast('Billing details saved'); refresh(); } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
};
A.billCancel = () => {
  const B = billingData; const m = modal('Cancel subscription', `<form id="bcf"><p style="margin-top:0">Your ${esc(B.plan.name)} subscription will end on <strong>${fmtDate(B.subscription.periodEnd)}</strong>, and you won’t be charged again. Until then, everything keeps working as normal.</p>
<p class="muted">After that, the account is paused: you and your team can’t log in, and clients can’t open their quotes, invoices or portal. Your data is kept, so you can come back.</p>
<label>Why are you leaving? (optional)<textarea name="reason" rows="3" maxlength="500"></textarea></label>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Keep subscription</button><button class="btn danger">Cancel subscription</button></div></form>`);
  $('#bcf', m).addEventListener('submit', (e) => { e.preventDefault(); billGo('/api/account/billing/cancel', Object.fromEntries(new FormData(e.target)), $('.btn.danger', e.target)); });
};
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

/* ===== /rewards: Refer & Earn (the platform's referral program, set up in Alpha → Promotions) ===== */
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
