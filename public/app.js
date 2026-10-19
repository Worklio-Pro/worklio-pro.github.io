'use strict';
/* ===== helpers ===== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
// regional settings (Company Profile): first day of the week, date format, 12/24-hour time
const weekStartDay = () => (company.weekStart === 'sun' ? 0 : 1);
const dayInWeek = (d) => (d.getDay() - weekStartDay() + 7) % 7; // 0 = first column of the calendar
const startOfWeek = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -dayInWeek(x)); };
const fmtDate = (s) => {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-'); const f = company.dateFormat;
  return f === 'MM/DD/YYYY' ? `${m}/${d}/${y}` : f === 'DD/MM/YYYY' ? `${d}/${m}/${y}` : f === 'YYYY-MM-DD' ? `${y}-${m}-${d}` : parseD(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtTime = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return company.timeFormat === '24' ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const monthLabel = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); };
const byId = (arr, id) => (arr || []).find((x) => x.id === id);
const hoursOf = (j) => { const [a, b] = [j.startTime, j.endTime].map((t) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; }); return Math.max(0, (b - a) / 60); };
const badge = (s) => `<span class="badge ${esc(s)}">${esc(s)}</span>`;

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': '/application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 && !url.startsWith('/api/auth/')) { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search); throw new Error('Please log in'); } // session ended
  if (!r.ok) { let m = 'Request failed'; try { m = (await r.json()).error || m; } catch (e) { /* ignore */ } throw new Error(m); }
  return r.json();
}
function toast(msg, err) {
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg;
  $('#toast').appendChild(t); setTimeout(() => t.remove(), err ? 6000 : 3200);
}
function modal(title, html, wide) {
  closeModal();
  const o = document.createElement('div'); o.className = 'overlay'; o.id = 'overlay';
  o.innerHTML = `<div class="modal ${wide ? 'wide' : ''}"><div class="mh"><h3>${esc(title)}</h3><button class="x" data-act="closeModal" aria-label="Close">×</button></div><div class="mb">${html}</div></div>`;
  o.addEventListener('mousedown', (e) => { if (e.target === o && !o.querySelector('[data-sticky]')) closeModal(); }); // [data-sticky]: don't lose work (e.g. a signature) to a stray click
  document.body.appendChild(o); return $('.mb', o);
}
function closeModal() { const o = $('#overlay'); if (o) o.remove(); }

/* ===== state + data ===== */
let D = {}; let company = {};
// technicians can't read services, quotes, invoices or expenses (the server returns 403), so those load as empty lists
const TECH_DATA = ['clients', 'staff', 'jobs'];
async function loadAll() {
  const names = ['clients', 'services', 'staff', 'quotes', 'jobs', 'invoices', 'expenses'];
  const res = await Promise.all(names.map((n) => (isTech() && !TECH_DATA.includes(n) ? [] : api('GET', '/api/' + n))));
  const out = {}; names.forEach((n, i) => { out[n] = res[i]; }); return out;
}
const clientName = (id) => (byId(D.clients, id) || {}).name || '—';
const staffDots = (ids) => (ids || []).map((id) => { const s = byId(D.staff, id); return s ? `<span title="${esc(s.name)}"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${esc(s.color)};margin-right:4px"></span>${esc(s.name)}</span>` : ''; }).join('<br>') || '<span class="muted">Unassigned</span>';
const clientOptions = (sel) => `<option value="">Select client…</option>` + D.clients.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

/* ===== router ===== */
const PAGES = {};
const NAV = [
  ['Operations', [['/business-overview', 'Home'], ['/calendar', 'Job Calendar'], ['/staff-schedules', 'Staff Schedules'], ['/clients', 'Clients'], ['/quotes', 'Quotes'], ['/jobs', 'Jobs'], ['/invoices', 'Invoices']]],
  ['Money', [['/services', 'Products & Services'], ['/expenses', 'Expenses'], ['/reports', 'Financial Reports'], ['/tax-summary', 'Tax Summary']]],
  ['Records', [['/project-gallery', 'Project Gallery'], ['/notifications', 'Notifications Log']]],
  ['Settings', [['/settings/company', 'Company Profile'], ['/team', 'Manage Team'], ['/settings/emails', 'Email Templates'], ['/settings', 'App Settings']]],
];
const navPaths = NAV.flatMap(([, items]) => items.map(([p]) => p));
const curPath = () => location.pathname.replace(/\/+$/, '') || '/';
function navigate(url) { history.pushState({}, '', url); window.scrollTo(0, 0); return render(); }
function refresh() { return render(true); }
// theme: 'light' | 'dark' | 'system' (follows the OS); saved per browser, applied early by a script in index.html
const getTheme = () => { try { return localStorage.getItem('theme') || 'system'; } catch (e) { return 'system'; } };
// set the page theme without saving it (the client portal forces light this way)
function showTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name="color-scheme"]'); if (meta) meta.content = t === 'light' || t === 'dark' ? t : 'light dark';
}
function applyTheme(t) {
  showTheme(t);
  try { localStorage.setItem('theme', t); } catch (e) { /* private mode: still applies for this visit */ }
}
const themeSwitch = () => { const t = getTheme(); return `<div class="theme-sw" role="group" aria-label="Color theme">${[['light', '☀', 'Light'], ['dark', '☾', 'Dark'], ['system', '◐', 'Auto']].map(([k, i, l]) => `<button type="button" data-act="setTheme" data-t="${k}" class="${t === k ? 'on' : ''}" aria-pressed="${t === k}" title="${k === 'system' ? 'Match your device setting' : l + ' mode'}">${i} ${l}</button>`).join('')}</div>`; };
let me = null; // the logged-in staff account
// access levels (the server enforces the same rules): owner/admin see everything;
// a manager runs jobs, quotes, invoices and the Money section; a technician only views jobs (no prices), clients and the schedule
const role = () => (me && me.role) || 'owner';
const isTech = () => role() === 'technician';
const ROLE_PAGES = {
  technician: ['/calendar', '/staff-schedules', '/clients', '/jobs', '/jobs/edit', '/profile'],
  manager: ['/business-overview', '/calendar', '/staff-schedules', '/clients', '/quotes', '/quotes/new', '/quotes/edit', '/jobs', '/jobs/new', '/jobs/edit',
    '/invoices', '/invoices/new', '/invoices/edit', '/services', '/expenses', '/reports', '/tax-summary', '/project-gallery', '/profile'],
};
const memberCan = (path) => !ROLE_PAGES[role()] || ROLE_PAGES[role()].includes(path);
// the account's plan (from /api/company): features it includes and pages it doesn't. The server enforces the same.
const planHas = (f) => !(company.account && company.account.features) || company.account.features.includes(f);
const planLocked = (path) => !!(company.account && (company.account.lockedPages || []).includes(path));
const navFor = () => NAV.map(([g, items]) => [g, items.filter(([p]) => memberCan(p) && !planLocked(p))]).filter(([, items]) => items.length);
function renderSide(path) {
  $('#side').innerHTML = `<div class="side-nav"><div class="brand">${company.logo ? `<a href="/" data-link class="brand-logo" title="Home"><img src="${esc(company.logo)}" alt="Home"></a>` : ''}<span>${esc(company.name || (company.account && company.account.productName) || 'Fieldwork')}</span></div>` +
    navFor().map(([g, items]) => `<div class="grp">${g}</div>` + items.map(([p, l]) => `<a href="${p}" data-link class="${p === path || (!navPaths.includes(path) && path.startsWith(p + '/')) ? 'on' : ''}">${l}</a>`).join('')).join('') + `</div>${themeSwitch()}${me ? `<div class="side-user"><a href="/profile" data-link class="side-user-name${path === '/profile' ? ' on' : ''}" title="My profile (${esc(me.email)})">${avatarHtml(me, 26)}<span>${esc(me.name)}</span></a><button type="button" data-act="logout">Log out</button></div>` : ''}`;
  $('#side').classList.remove('open');
}
function updateAppIcon() {
  let link = $('link[rel="icon"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  const href = company.icon ? '/favicon.ico?v=' + encodeURIComponent(company.icon.split('/').pop()) : '/favicon.ico';
  if (link.getAttribute('href') !== href) link.href = href;
}
async function render() {
  const path = curPath();
  const isPortal = path === '/client-portal' && new URLSearchParams(location.search).get('c');
  if (!isPortal && !me) { try { me = await api('GET', '/api/auth/me'); } catch (e) { /* api() sends you to the login page */ } } // needed before picking the start page
  if (path === '/') { history.replaceState({}, '', isTech() ? '/calendar' : '/business-overview'); return render(); }
  const main = $('#main');
  const portal = path === '/client-portal' && new URLSearchParams(location.search).get('c');
  try { company = await api('GET', '/api/company'); } catch (e) { /* ignore */ }
  updateAppIcon();
  document.documentElement.style.setProperty('--brand', company.brandColor || '#2563eb');
  $('#side').style.display = portal ? 'none' : ''; $('#menuBtn').style.display = portal ? 'none' : '';
  main.className = portal ? 'portal' : '';
  showTheme(portal ? 'light' : getTheme()); // clients always see their portal in light mode
  const page = PAGES[path];
  document.body.classList.toggle('role-technician', isTech()); document.body.classList.toggle('role-manager', role() === 'manager');
  if (!portal) renderSide(path);
  if (page && !memberCan(path)) { document.title = 'No access'; main.innerHTML = `<div class="card"><h1>You don't have access to this page</h1><p class="muted">Your access level doesn't include this page. Ask the account owner if you need more access.</p><p><a href="/calendar" data-link>Go to the job calendar</a></p></div>`; return; }
  if (page && planLocked(path)) { document.title = page.title; main.innerHTML = `<div class="card upgrade-card"><h1>${esc(page.title)} isn’t in your plan</h1><p class="muted">You’re on the ${esc(company.account.plan.name)} plan. Upgrade to get ${esc(page.title)} and more.</p><p><a href="/settings" data-link class="btn alt">See your plan</a></p></div>`; return; }
  if (!page) { document.title = 'Not found'; main.innerHTML = '<div class="card"><h1>Page not found</h1><p><a href="/business-overview" data-link>Go to dashboard</a></p></div>'; return; }
  document.title = `${page.title} · ${company.name || (company.account && company.account.productName) || 'Fieldwork'}`;
  try { D = portal ? {} : await loadAll(); await page.render(main); }
  catch (e) { main.innerHTML = `<div class="card"><h2>Something went wrong</h2><p>${esc(e.message)}</p></div>`; }
}
window.addEventListener('popstate', render);

const A = {}; // click actions
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-link]');
  if (link) { e.preventDefault(); navigate(link.getAttribute('href')); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  e.preventDefault();
  const fn = A[el.dataset.act];
  if (fn) Promise.resolve(fn(el.dataset, el)).catch((err) => toast(err.message, true));
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
$('#menuBtn').addEventListener('click', () => $('#side').classList.toggle('open'));
// form submit handlers are async: show any save error (e.g. "Another invoice already uses number …") instead of failing silently
window.addEventListener('unhandledrejection', (e) => { if (e.reason && e.reason.message) { toast(e.reason.message, true); e.preventDefault(); } });
A.closeModal = closeModal;
// ⋯ menus close when you click anywhere else
document.addEventListener('click', (e) => $$('details.menu[open]').forEach((m) => { if (!m.contains(e.target)) m.open = false; }));
A.logout = async () => { await api('POST', '/api/auth/logout', {}); location.href = '/login'; };
A.setTheme = (d) => { applyTheme(d.t); $$('.theme-sw button').forEach((b) => { b.classList.toggle('on', b.dataset.t === d.t); b.setAttribute('aria-pressed', b.dataset.t === d.t); }); };

/* ===== line items editor (quotes + invoices) ===== */
const round2 = (n) => Math.round(n * 100) / 100;
// price = unit price the client sees (cost plus markup as % of cost or flat $ per unit); the server recomputes it the same way
const readItems = (root) => $$('.item-row', root).map((r) => {
  const cost = Number($('.cost', r).value) || 0; const markup = Number($('.markup', r).value) || 0; const markupType = $('.mtype', r).value;
  return { desc: $('.desc', r).value.trim(), details: $('.details', r).value, qty: Number($('.qty', r).value) || 0, cost, markup, markupType, price: round2(markupType === 'flat' ? cost + markup : cost * (1 + markup / 100)) };
});
function recalc(root) {
  if (!$('.calc', root)) return; // no Product / Service section (job page for technicians)
  const items = readItems(root); const rate = Number($('[name=taxRate]', root).value) || 0;
  $$('.item-row', root).forEach((r, i) => { $('.amt', r).textContent = money(items[i].qty * items[i].price); });
  const sub = round2(items.reduce((s, i) => s + i.qty * i.price, 0));
  // discount comes off the subtotal before tax (the server computes it the same way)
  const dv = Math.max(0, Number($('[name=discountValue]', root).value) || 0); const dPct = $('[name=discountType]', root).value === 'percent';
  const disc = Math.min(sub, round2(dPct ? sub * dv / 100 : dv));
  const tax = round2((sub - disc) * rate / 100); const total = round2(sub - disc + tax);
  $('.t-sub', root).textContent = money(sub); $('.t-discount', root).textContent = disc ? '−' + money(disc) : money(0);
  $('.t-tax', root).textContent = money(tax); $('.t-total', root).textContent = money(total);
  if ($('[name=depositValue]', root)) { // quotes: requested deposit
    const dv = Math.max(0, Number($('[name=depositValue]', root).value) || 0); const pct = $('[name=depositType]', root).value === 'percent';
    const dep = Math.min(total, round2(pct ? total * dv / 100 : dv));
    $('.t-deposit', root).textContent = money(dep); $('.dep-out', root).textContent = dep ? `Balance after deposit ${money(total - dep)}` : '';
  }
  if (root._afterRecalc) root._afterRecalc(total);
}
// typing or picking a catalog service name in a line's name box fills its cost and (empty) description
function wireItems(root) {
  root.addEventListener('input', () => recalc(root));
  root.addEventListener('change', (e) => {
    if (e.target.classList.contains('mtype')) e.target.closest('.mk').classList.toggle('flat', e.target.value === 'flat');
    if (e.target.classList.contains('desc')) {
      const s = D.services.find((x) => x.name === e.target.value); const row = e.target.closest('.item-row');
      if (s) { $('.cost', row).value = s.price; if (!$('.details', row).value) $('.details', row).value = s.description || ''; }
    }
    recalc(root);
  });
  recalc(root);
}
// catalog suggestions under a line item's name box (replaces the browser's datalist popup, which it positions badly)
const svcAc = { input: null, box: null, idx: -1, list: [] };
function svcAcClose() { if (svcAc.box) svcAc.box.remove(); Object.assign(svcAc, { input: null, box: null, idx: -1, list: [] }); }
function svcAcOpen(input) {
  const q = input.value.trim().toLowerCase();
  const list = D.services.filter((s) => !q || s.name.toLowerCase().includes(q));
  if (!list.length || (list.length === 1 && list[0].name.toLowerCase() === q)) return svcAcClose();
  if (svcAc.input !== input) { svcAcClose(); svcAc.input = input; svcAc.box = document.createElement('div'); svcAc.box.className = 'svc-ac'; svcAc.box.setAttribute('role', 'listbox'); input.after(svcAc.box); }
  svcAc.list = list; svcAc.idx = Math.min(svcAc.idx, list.length - 1);
  svcAc.box.innerHTML = list.map((s, i) => `<div role="option" class="${i === svcAc.idx ? 'on' : ''}" data-i="${i}"><span>${esc(s.name)}</span><span class="muted">${money(s.price)}${s.unit ? ' / ' + esc(s.unit) : ''}</span></div>`).join('');
}
function svcAcPick(i) {
  const s = svcAc.list[i]; const input = svcAc.input; if (!s || !input) return;
  input.value = s.name; svcAcClose(); input.dispatchEvent(new Event('change', { bubbles: true })); // wireItems fills cost + description
}
document.addEventListener('focusin', (e) => { if (e.target.matches('.qform .desc')) svcAcOpen(e.target); else if (!e.target.closest('.svc-ac')) svcAcClose(); });
document.addEventListener('input', (e) => { if (e.target.matches('.qform .desc')) { svcAc.idx = -1; svcAcOpen(e.target); } });
document.addEventListener('keydown', (e) => {
  if (!svcAc.box || e.target !== svcAc.input) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); svcAc.idx = (svcAc.idx + (e.key === 'ArrowDown' ? 1 : -1) + svcAc.list.length) % svcAc.list.length; svcAcOpen(svcAc.input); }
  else if (e.key === 'Enter' && svcAc.idx >= 0) { e.preventDefault(); svcAcPick(svcAc.idx); }
  else if (e.key === 'Escape') { e.stopPropagation(); svcAcClose(); }
  else if (e.key === 'Tab') svcAcClose();
}, true);
document.addEventListener('mousedown', (e) => {
  const opt = e.target.closest('.svc-ac [data-i]');
  if (opt) { e.preventDefault(); svcAcPick(Number(opt.dataset.i)); } else if (svcAc.box && e.target !== svcAc.input) svcAcClose();
});
A.addItem = (d, el) => { const root = el.closest('form'); $('#items', root).insertAdjacentHTML('beforeend', qItemRow({})); recalc(root); $$('.item-row', root).pop().querySelector('.desc').focus(); };
A.moveItem = (d, el) => {
  const row = el.closest('.item-row'); const other = d.dir === '-1' ? row.previousElementSibling : row.nextElementSibling;
  if (!other) return;
  d.dir === '-1' ? other.before(row) : other.after(row);
  row.classList.remove('moved'); void row.offsetWidth; row.classList.add('moved'); // brief highlight so it's clear what moved
  el.closest('details').open = false; $('.row-menu summary', row).focus();
  recalc(el.closest('form'));
};
A.rmItem = (d, el) => { // the last remaining line is cleared instead of removed
  const root = el.closest('form'); const row = el.closest('.item-row');
  if ($$('.item-row', root).length > 1) row.remove(); else row.outerHTML = qItemRow({});
  recalc(root);
};
// the Product / Service card shared by the quote and invoice editors; `extra` goes under the totals
const itemsCard = (items, extra, t) => `<div class="qcard"><h2>Product / Service</h2>
<div id="items">${(items && items.length ? items : [{}]).map(qItemRow).join('')}</div>
<button type="button" class="btn alt sm" data-act="addItem">+ Add line item</button>
<div class="totals qtotals"><div class="calc">${totalsRows(t || {})}</div>${extra}</div></div>`;
// Subtotal / Discount / Tax / Total rows (layout modeled on Jobber's): the discount is optional and starts as an "Add Discount" link
const totalsRows = (d) => `<div class="tl"><span>Subtotal</span><span></span><span class="t-sub"></span><span></span></div>
${optRow({ label: 'Discount', name: 'discount', value: d.discountValue, type: d.discountType, pctLabel: '%' })}
<div class="tl"><span>Tax</span><span class="unit tax-in"><input name="taxRate" type="number" step="any" min="0" value="${d.taxRate ?? company.taxRate ?? 0}" aria-label="Tax rate"><span>%</span></span><span class="t-tax"></span><span></span></div>
<div class="tl grand"><strong>Total</strong><span></span><strong class="t-total"></strong><span></span></div>`;
// an optional amount row (discount, deposit): "Add …" link until used, then amount + $/% picker + computed value + trash button.
// Inputs are named ${name}Value / ${name}Type; recalc fills .t-${name}.
const optRow = ({ label, name, value, type, pctLabel }) => { const on = Number(value) > 0; return `<div class="tl opt-row"><span>${label}</span><span class="opt-edit" ${on ? '' : 'hidden'}><span class="unit"><input name="${name}Value" type="number" step="any" min="0" value="${on ? esc(value) : ''}" placeholder="0" aria-label="${label} amount">
<select name="${name}Type" aria-label="${label} type"><option value="flat" ${type !== 'percent' ? 'selected' : ''}>$</option><option value="percent" ${type === 'percent' ? 'selected' : ''}>${pctLabel}</option></select></span></span>
<span class="opt-amt" ${on ? '' : 'hidden'}><span class="t-${name}"></span></span><button type="button" class="link-btn opt-add" data-act="addOpt" ${on ? 'hidden' : ''}>Add ${label}</button>
<span class="t-rm-c"><button type="button" class="t-rm" data-act="rmOpt" aria-label="Remove ${label.toLowerCase()}" title="Remove ${label.toLowerCase()}" ${on ? '' : 'hidden'}>${TRASH}</button></span></div>`; };
const TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>';
// invoice: take the quote deposit credit off this invoice (or put it back); saved with the invoice
const setDepCredit = (el, removed) => { const form = el.closest('form'); $('[name=depositCreditRemoved]', form).value = removed ? 'yes' : ''; recalc(form); };
A.rmDepCredit = (d, el) => setDepCredit(el, true);
A.applyDepCredit = (d, el) => setDepCredit(el, false);
A.addOpt = (d, el) => { const row = el.closest('.tl'); el.hidden = true; $('.opt-edit', row).hidden = false; $('.opt-amt', row).hidden = false; $('.t-rm', row).hidden = false; $('.opt-edit input', row).focus(); };
A.rmOpt = (d, el) => { const row = el.closest('.tl'); $('.opt-edit input', row).value = ''; $('.opt-edit', row).hidden = true; $('.opt-amt', row).hidden = true; el.hidden = true; $('.opt-add', row).hidden = false; recalc(el.closest('form')); };

/* ===== send dialog ===== */
function sendDialog(kind, doc) {
  const c = byId(D.clients, doc.clientId) || {};
  const mb = modal(`Send ${kind} ${doc.number}`, `<p>To <strong>${esc(c.name)}</strong></p>
<form><div class="chk"><label><input type="checkbox" name="ch" value="email" checked> Email ${c.email ? `(${esc(c.email)})` : '<span class="muted">(no email on file)</span>'}</label>
${planHas('sms') ? `<label><input type="checkbox" name="ch" value="sms" checked> Text message ${c.phone ? `(${esc(c.phone)})` : '<span class="muted">(no phone on file)</span>'}</label>` : ''}</div>
<p class="muted">The client gets a link to ${kind === 'invoice' ? 'view and pay this invoice online' : 'view and approve this quote'}. Every message is recorded in the Notifications Log.</p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Send</button></div></form>`);
  $('form', mb).addEventListener('submit', async (e) => {
    e.preventDefault();
    const channels = $$('[name=ch]:checked', mb).map((x) => x.value);
    if (!channels.length) return toast('Choose email, text, or both', true);
    const r = await api('POST', `/api/${kind}s/${doc.id}/send`, { channels });
    const rows = r.results.map((x) => `<tr><td>${x.channel === 'email' ? 'Email' : 'Text'}</td><td>${esc(x.to || '—')}</td><td>${badge(x.status)}</td><td class="muted">${esc(x.detail)}</td></tr>`).join('');
    const sim = r.results.some((x) => x.status === 'simulated');
    mb.innerHTML = `<div class="tablewrap"><table><tr><th>Channel</th><th>To</th><th>Status</th><th>Detail</th></tr>${rows}</table></div>
${sim ? '<div class="notice" style="margin-top:12px">Messages were recorded but not delivered because no email/SMS provider is connected yet. Contact support to get them switched on.</div>' : ''}
<div class="foot"><a class="btn alt" href="/notifications" data-link data-act="closeModal">View log</a><button class="btn" data-act="closeModal">Done</button></div>`;
    refresh();
  });
}

/* ===== clients ===== */
// Status is derived: a client with any job or invoice is Active, otherwise a Lead.
function clientInfo() {
  const today = ymd(new Date()); const info = {};
  D.clients.forEach((c) => { info[c.id] = { active: false, last: (c.createdAt || '').slice(0, 10) }; });
  const touch = (id, d, active) => { const x = info[id]; if (!x) return; if (active) x.active = true; d = (d || '').slice(0, 10); if (d && d <= today && d > x.last) x.last = d; };
  D.quotes.forEach((q) => touch(q.clientId, q.createdAt, false));
  D.jobs.forEach((j) => touch(j.clientId, j.date <= today ? j.date : j.createdAt, true));
  D.invoices.forEach((i) => { touch(i.clientId, i.issueDate, true); touch(i.clientId, i.paidAt, true); });
  return info;
}
function activityLabel(d) {
  if (!d) return '';
  const days = Math.round((parseD(ymd(new Date())) - parseD(d)) / 864e5);
  if (days === 0) return 'Today';
  if (days < 7) return parseD(d).toLocaleDateString('en-US', { weekday: 'short' });
  return parseD(d).toLocaleDateString('en-US', d.slice(0, 4) === String(new Date().getFullYear()) ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
// possible duplicates: same email, same 10-digit phone, or same name
function duplicateIds() {
  const groups = {}; const add = (k, id) => { if (k) (groups[k] = groups[k] || new Set()).add(id); };
  D.clients.forEach((c) => {
    const em = String(c.email || '').trim().toLowerCase(); if (em) add('e:' + em, c.id);
    const p = String(c.phone || '').replace(/\D/g, '').slice(-10); if (p.length === 10) add('p:' + p, c.id);
    add('n:' + String(c.name || '').trim().toLowerCase(), c.id);
  });
  const ids = new Set(); let count = 0;
  Object.values(groups).forEach((g) => { if (g.size > 1) { count++; g.forEach((id) => ids.add(id)); } });
  return { ids, count };
}
const clientTags = (c) => (Array.isArray(c.tags) ? c.tags : String(c.tags || '').split(',')).map((t) => t.trim()).filter(Boolean);
let clientView = { status: 'all', tag: '', q: '', since: '', dupes: false, sort: 'name', dir: 1 }; const clientSel = new Set();
PAGES['/clients'] = {
  title: 'Clients',
  async render(main) {
    const info = clientInfo(); const v = clientView; const today = ymd(new Date());
    const ago = (n) => ymd(addDays(new Date(), -n)); const yStart = new Date().getFullYear() + '-01-01';
    const created = (c) => (c.createdAt || '').slice(0, 10);
    const between = (c, from, to) => created(c) >= from && created(c) < to;
    const tomorrow = ymd(addDays(new Date(), 1));
    const leadsNow = D.clients.filter((c) => !info[c.id].active && between(c, ago(30), tomorrow)).length;
    const leadsPrev = D.clients.filter((c) => !info[c.id].active && between(c, ago(60), ago(30))).length;
    const actNow = D.clients.filter((c) => info[c.id].active && between(c, ago(30), tomorrow)).length;
    const actPrev = D.clients.filter((c) => info[c.id].active && between(c, ago(60), ago(30))).length;
    const ytd = D.clients.filter((c) => created(c) >= yStart).length;
    const change = (now, prev) => (prev ? `<span class="chg ${now >= prev ? 'up' : 'down'}">${now >= prev ? '↑' : '↓'} ${Math.abs(Math.round(((now - prev) / prev) * 100))}%</span>` : '');
    const dup = duplicateIds(); const tags = [...new Set(D.clients.flatMap(clientTags))].sort();
    let list = D.clients.filter((c) => {
      if (v.status === 'lead' && info[c.id].active) return false;
      if (v.status === 'active' && !info[c.id].active) return false;
      if (v.tag && !clientTags(c).includes(v.tag)) return false;
      if (v.since && created(c) < v.since) return false;
      if (v.dupes && !dup.ids.has(c.id)) return false;
      const s = [c.name, c.company, c.email, c.phone, c.address, ...clientTags(c)].join(' ').toLowerCase();
      return !v.q || s.includes(v.q.toLowerCase());
    });
    const key = (c) => (v.sort === 'last' ? info[c.id].last : (c.company || c.name || '').toLowerCase());
    list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * v.dir);
    [...clientSel].forEach((id) => { if (!byId(D.clients, id)) clientSel.delete(id); });
    const sinceLabel = v.since === yStart ? 'this year' : 'past 30 days';
    const arrow = (k) => `<span class="sort ${v.sort === k ? 'on' : ''}">${v.sort === k ? (v.dir > 0 ? '▲' : '▼') : '⇅'}</span>`;
    main.innerHTML = `<div class="head"><h1>Clients</h1><div class="actions no-tech"><button class="btn" data-act="newClient">New Client</button>
<details class="menu"><summary class="btn alt">⋯ More Actions</summary><div class="menu-list">${planHas('clientImport') ? '<a href="/clients/import" data-link class="admin-only">Import clients</a>' : ''}<button data-act="exportClients">Export to CSV</button></div></details></div></div>
<div class="cstats">
<button class="cstat" data-act="clientCard" data-k="leads"><div class="cs-h"><strong>New leads</strong><span>↗</span></div><div class="muted">Past 30 days</div><div class="cs-v">${leadsNow} ${change(leadsNow, leadsPrev)}</div></button>
<button class="cstat" data-act="clientCard" data-k="active"><div class="cs-h"><strong>New clients</strong><span>↗</span></div><div class="muted">Past 30 days</div><div class="cs-v">${actNow} ${change(actNow, actPrev)}</div></button>
<button class="cstat" data-act="clientCard" data-k="ytd"><div class="cs-h"><strong>Total new clients</strong><span>↗</span></div><div class="muted">Year to date</div><div class="cs-v">${ytd}</div></button>
<div class="cstat merge admin-only"><div>Merge duplicate clients into a single profile to keep information accurate.</div><div class="muted">${dup.count ? `${dup.count} possible duplicate${dup.count === 1 ? '' : 's'} found` : 'No duplicates found'}</div><button class="btn alt sm" data-act="clientDupes" ${dup.count ? '' : 'disabled'}>Merge Clients</button></div></div>
<h2 class="ftitle">Filtered clients <span class="muted">(${list.length} result${list.length === 1 ? '' : 's'})</span></h2>
<div class="cfilters"><label class="pill">Tag<select data-cv="tag"><option value="">All tags</option>${tags.map((t) => `<option ${v.tag === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
<label class="pill">Status<select data-cv="status">${[['all', 'Leads and Active'], ['lead', 'Leads'], ['active', 'Active']].map(([k, l]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
${v.since ? `<button class="pill on" data-act="clientClear" data-k="since">Created ${sinceLabel} ×</button>` : ''}${v.dupes ? '<button class="pill on" data-act="clientClear" data-k="dupes">Possible duplicates ×</button>' : ''}
<input id="cq" class="csearch" type="search" placeholder="Search clients…" value="${esc(v.q)}"></div>
${v.dupes ? '<div class="notice">Showing clients that share an email, phone number or name. Tick the profiles that are the same client, then click Merge.</div>' : ''}
${clientSel.size ? `<div class="bulk admin-only"><strong>${clientSel.size} selected</strong><button class="btn sm" data-act="mergeClients" ${clientSel.size > 1 ? '' : 'disabled title="Select at least two clients"'}>Merge</button><button class="btn danger sm" data-act="deleteSelClients">Delete</button><button class="btn alt sm" data-act="clientClearSel">Clear selection</button></div>` : ''}
<div class="card ctable"><div class="tablewrap"><table><tr><th style="width:36px" class="admin-only"><input type="checkbox" id="selAll" aria-label="Select all" ${list.length && list.every((c) => clientSel.has(c.id)) ? 'checked' : ''}></th>
<th><button class="th-btn" data-act="clientSort" data-k="name">Name ${arrow('name')}</button></th><th>Address</th><th>Tags</th><th>Status</th><th><button class="th-btn" data-act="clientSort" data-k="last">Last Activity ${arrow('last')}</button></th></tr>
${list.map((c) => `<tr class="crow" data-id="${c.id}"><td class="admin-only"><input type="checkbox" class="sel" value="${c.id}" ${clientSel.has(c.id) ? 'checked' : ''} aria-label="Select ${esc(c.name)}"></td>
<td><strong>${esc(c.company || c.name)}</strong>${c.company && c.name && c.name !== c.company ? `<div>${esc(c.name)}</div>` : ''}</td><td>${esc(c.address)}</td>
<td>${clientTags(c).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</td>
<td>${info[c.id].active ? '<span class="cstatus active">Active</span>' : '<span class="cstatus lead">Lead</span>'}</td><td>${activityLabel(info[c.id].last)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">${D.clients.length ? 'No clients match these filters' : 'No clients yet'}</td></tr>`}</table></div></div>`;
    $$('[data-cv]').forEach((s) => s.addEventListener('change', (e) => { clientView[e.target.dataset.cv] = e.target.value; refresh(); }));
    let t; $('#cq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(async () => { clientView.q = e.target.value; await refresh(); const q = $('#cq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); });
    $('#selAll').addEventListener('change', (e) => { list.forEach((c) => (e.target.checked ? clientSel.add(c.id) : clientSel.delete(c.id))); refresh(); });
    $$('.sel').forEach((b) => b.addEventListener('change', (e) => { e.target.checked ? clientSel.add(e.target.value) : clientSel.delete(e.target.value); refresh(); }));
    $$('.crow').forEach((r) => r.addEventListener('click', (e) => { if (!e.target.closest('input')) clientForm(byId(D.clients, r.dataset.id)); }));
  },
};
document.addEventListener('click', (e) => { $$('details.menu[open]').forEach((m) => { if (!m.contains(e.target)) m.open = false; }); });
A.clientCard = (d) => {
  const yStart = new Date().getFullYear() + '-01-01'; const ago30 = ymd(addDays(new Date(), -30));
  clientView = { ...clientView, status: d.k === 'leads' ? 'lead' : d.k === 'active' ? 'active' : 'all', since: d.k === 'ytd' ? yStart : ago30, dupes: false };
  refresh();
};
A.clientDupes = () => { clientView = { ...clientView, status: 'all', tag: '', q: '', since: '', dupes: true, sort: 'name', dir: 1 }; refresh(); };
A.clientClear = (d) => { clientView[d.k] = d.k === 'dupes' ? false : ''; refresh(); };
A.clientSort = (d) => { clientView.dir = clientView.sort === d.k ? -clientView.dir : (d.k === 'last' ? -1 : 1); clientView.sort = d.k; refresh(); };
A.clientClearSel = () => { clientSel.clear(); refresh(); };
A.deleteSelClients = async () => {
  if (!confirm(`Delete ${clientSel.size} client${clientSel.size === 1 ? '' : 's'}? Their quotes, jobs and invoices stay in the system.`)) return;
  for (const id of clientSel) await api('DELETE', '/api/clients/' + id);
  toast(`Deleted ${clientSel.size} client${clientSel.size === 1 ? '' : 's'}`); clientSel.clear(); refresh();
};
A.mergeClients = () => {
  const picked = [...clientSel].map((id) => byId(D.clients, id)).filter(Boolean);
  const count = (c) => ['quotes', 'jobs', 'invoices'].map((k) => D[k].filter((x) => x.clientId === c.id).length).reduce((a, b) => a + b, 0);
  const mb = modal(`Merge ${picked.length} clients`, `<form><p>Choose the profile to keep. The other ${picked.length - 1 === 1 ? 'profile is' : 'profiles are'} merged into it and deleted:</p>
<div class="merge-pick">${picked.map((c, i) => `<label><input type="radio" name="keep" value="${c.id}" ${i === 0 ? 'checked' : ''}><span><strong>${esc(c.company || c.name)}</strong>${c.company ? ` · ${esc(c.name)}` : ''}<br><span class="muted">${esc([c.email, c.phone, c.address].filter(Boolean).join(' · ')) || 'No contact details'} · ${count(c)} quotes/jobs/invoices</span></span></label>`).join('')}</div>
<p class="muted">All quotes, jobs, invoices and messages move to the kept profile. Empty details on it (email, phone, address, company) are filled in from the others, tags are combined, and notes are added together.</p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Merge clients</button></div></form>`);
  $('form', mb).addEventListener('submit', async (e) => {
    e.preventDefault(); const keepId = new FormData(e.target).get('keep');
    await api('POST', '/api/clients/merge', { keepId, mergeIds: picked.map((c) => c.id).filter((id) => id !== keepId) });
    closeModal(); clientSel.clear(); toast('Clients merged'); refresh();
  });
};
A.exportClients = () => {
  const info = clientInfo();
  downloadCsv('clients.csv', [['Name', 'Company', 'Email', 'Phone', 'Address', 'Tags', 'Status', 'Notes', 'Created'], ...D.clients.map((c) => [c.name, c.company || '', c.email, c.phone, c.address, clientTags(c).join(', '), info[c.id].active ? 'Active' : 'Lead', c.notes || '', (c.createdAt || '').slice(0, 10)])]);
};
function clientForm(c) {
  c = c || {};
  const mb = modal(c.id ? 'Edit client' : 'New client', `<form><div class="row"><label>Name<input name="name" required value="${esc(c.name)}"></label><label>Company (optional)<input name="company" value="${esc(c.company)}"></label></div>
<div class="row"><label>Email<input name="email" type="email" value="${esc(c.email)}"></label><label>Mobile (for texts)<input name="phone" value="${esc(c.phone)}" placeholder="+17135550100"></label></div>
<label>Service address<input name="address" value="${esc(c.address)}"></label><label>Tags (separate with commas)<input name="tags" value="${esc(clientTags(c).join(', '))}" placeholder="e.g. commercial, monthly"></label><label>Notes<textarea name="notes">${esc(c.notes)}</textarea></label>
${c.id && planHas('clientPortal') ? `<label>Client portal link<input readonly value="${esc(location.origin + '/client-portal?c=' + c.portalToken)}" onclick="this.select()"></label>` : ''}
<div class="foot">${c.id ? `<button type="button" class="btn danger admin-only" data-act="delClient" data-id="${c.id}">Delete</button><button type="button" class="btn alt no-tech" data-act="newQuoteFor" data-id="${c.id}">New quote</button><button type="button" class="btn alt no-tech" data-act="newJobFor" data-id="${c.id}">New job</button>` : ''}<button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn no-tech">Save</button></div></form>`);
  if (isTech()) $$('input, select, textarea', mb).forEach((el) => { if (el.readOnly !== undefined) el.readOnly = true; if (el.tagName === 'SELECT') el.disabled = true; }); // view-only for technicians
  $('form', mb).addEventListener('submit', async (e) => {
    e.preventDefault(); if (isTech()) return; const body = Object.fromEntries(new FormData(e.target));
    delete body.undefined; body.tags = [...new Set(String(body.tags || '').split(',').map((t) => t.trim()).filter(Boolean))];
    c.id ? await api('PUT', '/api/clients/' + c.id, body) : await api('POST', '/api/clients', body);
    closeModal(); toast('Client saved'); refresh();
  });
}
A.newClient = () => clientForm();
A.editClient = (d) => clientForm(byId(D.clients, d.id));
A.delClient = async (d) => { if (!confirm('Delete this client? Their quotes, jobs and invoices stay in the system.')) return; await api('DELETE', '/api/clients/' + d.id); closeModal(); refresh(); };

/* ===== quotes + invoices ===== */
// recorded deposit payment on a quote: edit amount/date, or mark it for removal (applied when the quote is saved)
// how a payment was made (the server accepts the same list); stripe / demo / manual are set by the app, not chosen
const PAY_METHODS = [['cash', 'Cash'], ['check', 'Check'], ['card', 'Credit/debit card'], ['bank', 'Bank payment'], ['zelle', 'Zelle'], ['cashapp', 'Cash App'], ['paypal', 'PayPal'], ['venmo', 'Venmo'], ['other', 'Other']];
const payLabel = (m) => (PAY_METHODS.find(([k]) => k === m) || [, { stripe: 'Online card (Stripe)', demo: 'Demo checkout', manual: 'Other' }[m] || m || 'Other'])[1];
const methodOptions = (sel) => PAY_METHODS.map(([k, l]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${l}</option>`).join('');
function payDialog({ title, amount, max, method, note, save }) {
  const mb = modal(title, `<form class="pay-form">${note ? `<p class="notice">${esc(note)}</p>` : ''}
<div class="row"><label class="fl"><span>Amount received</span><div class="affix"><i>$</i><input name="amount" type="number" step="0.01" min="0.01" ${max ? `max="${round2(max)}"` : ''} required value="${round2(amount || 0).toFixed(2)}"></div></label>
<label class="fl"><span>Payment method</span><select name="method" required><option value="" disabled ${method ? '' : 'selected'}>Choose…</option>${methodOptions(method)}</select></label></div>
<div class="row"><label class="fl"><span>Date received</span><input name="date" type="date" required max="${ymd(new Date())}" value="${ymd(new Date())}"></label>
<label class="fl"><span>Reference (optional)</span><input name="reference" maxlength="120" placeholder="Check #, transaction ID or note"></label></div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Record payment</button></div></form>`);
  $('form', mb).addEventListener('submit', async (e) => {
    e.preventDefault(); const body = Object.fromEntries(new FormData(e.target)); const btn = $('.foot .btn:not(.alt)', mb);
    if (!body.method) return toast('Choose how the payment was made', true);
    btn.disabled = true; try { await save(body); closeModal(); } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
  $('[name=amount]', mb).select();
}
const methodLabel = Object.fromEntries([...PAY_METHODS, ['stripe', 'online card (Stripe)'], ['demo', 'demo checkout'], ['manual', 'manual entry']]);
const depositPaymentCard = (d) => `<div class="card dep-pay"><h2>Deposit payment</h2>
<div class="dep-pay-edit"><p class="muted" style="margin-top:0">Recorded as paid${d.depositMethod ? ' by ' + esc(methodLabel[d.depositMethod] || d.depositMethod) : ''}. Correct the amount, date or method if needed, or remove the payment if it was recorded by mistake or refunded.</p>
<div class="row3"><label>Amount paid<input name="depositPaidAmount" type="number" step="0.01" min="0" value="${d.depositPaidAmount ?? d.depositFee ?? 0}"></label><label>Date paid<input name="depositPaidAt" type="date" value="${esc(d.depositPaidAt)}"></label>
<label>Method<select name="depositMethod">${PAY_METHODS.some(([k]) => k === d.depositMethod) ? '' : `<option value="${esc(d.depositMethod || 'other')}" selected>${esc(payLabel(d.depositMethod))}</option>`}${methodOptions(d.depositMethod)}</select></label></div>
<div class="row3"><label>Reference<input name="depositReference" maxlength="120" value="${esc(d.depositReference || '')}" placeholder="Check #, transaction ID or note"></label>
<div class="dep-pay-act"><button type="button" class="btn danger" data-act="removeDepositPay">Remove payment</button></div></div></div>
<div class="dep-pay-removed notice" hidden>The deposit payment will be removed when you save. The quote goes back to waiting for its deposit. <a href="#" data-act="undoDepositPay">Undo</a></div>
<input type="hidden" name="depositPayment" value="keep"></div>`;
A.removeDepositPay = (d, el) => {
  const card = el.closest('.dep-pay'); $('[name=depositPayment]', card).value = 'delete';
  $('.dep-pay-edit', card).hidden = true; $('.dep-pay-removed', card).hidden = false;
  $$('.dep-pay-edit input, .dep-pay-edit select', card).forEach((i) => { i.disabled = true; }); // not submitted while removed
};
A.undoDepositPay = (d, el) => {
  const card = el.closest('.dep-pay'); $('[name=depositPayment]', card).value = 'keep';
  $('.dep-pay-edit', card).hidden = false; $('.dep-pay-removed', card).hidden = true;
  $$('.dep-pay-edit input, .dep-pay-edit select', card).forEach((i) => { i.disabled = false; });
};
/* ===== invoice editor (layout modeled on Jobber's invoice page) ===== */
const TERMS = [['0', 'Due upon receipt'], ['7', 'Net 7'], ['14', 'Net 14'], ['15', 'Net 15'], ['30', 'Net 30'], ['45', 'Net 45'], ['60', 'Net 60'], ['custom', 'Custom date']];
// deposit paid on the quote behind the linked job, credited on that job's first invoice (mirrors invoiceCredits on the server)
function invDepositCredit(inv, jobId, total) {
  const job = byId(D.jobs, jobId); const q = job && job.quoteId && byId(D.quotes, job.quoteId);
  if (!q || !q.depositPaidAt) return null;
  const earlier = D.invoices.filter((i) => i.jobId === jobId && i.id !== inv.id && (!inv.id || (i.createdAt || '') < (inv.createdAt || '') || ((i.createdAt || '') === (inv.createdAt || '') && String(i.number) < String(inv.number))));
  if (earlier.length) return null;
  return { amount: Math.min(total, round2(Number(q.depositPaidAmount ?? q.depositFee) || 0)), date: q.depositPaidAt, quote: q.number };
}
function invoiceForm(main, doc, preset) {
  const d = doc || {}; const p = preset || {}; const items = d.items && d.items.length ? d.items : [{}];
  const issue = d.issueDate || ymd(new Date());
  const due = d.dueDate || issue; // new invoices default to "Due upon receipt"
  const days = Math.round((parseD(due) - parseD(issue)) / 864e5);
  const terms = d.paymentTerms || (TERMS.some(([k]) => k === String(days)) ? String(days) : 'custom');
  const st = d.id ? d.displayStatus : 'draft';
  const on = (k) => d[k] !== 'off';
  main.innerHTML = `<form class="qform iform"><div class="qpage"><div class="qmain">
<div class="qtop"><div class="qtop-l"><a href="/invoices" data-link class="back">← Invoices</a>${iBadge(st)}${d.zelleSentAt && d.status !== 'paid' ? '<span class="badge zelle">Zelle sent</span>' : ''}</div>
<div class="actions">${d.id ? `<details class="menu"><summary class="btn alt">⋯ More</summary><div class="menu-list">
<a href="/pay/${d.token}" target="_blank">${d.status === 'paid' ? 'View receipt' : 'View pay page'}</a>
${d.status !== 'paid' ? `<button type="button" data-act="collectPayment" data-id="${d.id}">Collect payment</button>` : ''}
<button type="button" class="danger-text" data-act="delDoc" data-kind="invoice" data-id="${d.id}">Delete invoice</button></div></details>
<button class="btn alt" name="after" value="save">Save</button>${d.status !== 'paid' ? '<button class="btn" name="after" value="send" title="Saves your changes, then sends">Send…</button>' : ''}`
    : '<a class="btn alt" href="/invoices" data-link>Cancel</a><button class="btn alt" name="after" value="save">Save</button><button class="btn" name="after" value="send">Save &amp; send…</button>'}</div></div>
<input name="subject" class="qtitle" value="${esc(d.subject || '')}" placeholder="Invoice subject (e.g. Camera System Install)" aria-label="Invoice subject">
<div class="qhead"><div class="qclient"><select name="clientId" required aria-label="Client">${clientOptions(d.clientId || p.clientId)}</select><div class="iclient"></div></div>
<dl class="qmeta"><dt>Invoice #</dt><dd><input name="number" class="num-in" maxlength="30" value="${esc(d.number || '')}" placeholder="Automatic" aria-label="Invoice number" title="Leave blank for the next automatic number"></dd>
<dt>Invoice for</dt><dd><select name="jobId" aria-label="Linked job"><option value="">No job</option>${D.jobs.map((j) => `<option value="${j.id}" ${(d.jobId || p.jobId) === j.id ? 'selected' : ''}>${esc(j.number + ' · ' + j.title)}</option>`).join('')}</select></dd>
<dt>Issued</dt><dd><input type="date" name="issueDate" value="${esc(issue)}" aria-label="Issue date"></dd>
<dt>Payment terms</dt><dd><select name="paymentTerms" aria-label="Payment terms">${TERMS.map(([k, l]) => `<option value="${k}" ${terms === k ? 'selected' : ''}>${l}</option>`).join('')}</select></dd>
<dt>Due date</dt><dd><input type="date" name="dueDate" value="${esc(due)}" aria-label="Due date"></dd></dl></div>
${itemsCard(items, `<input type="hidden" name="depositCreditRemoved" value="${d.depositCreditRemoved ? 'yes' : ''}"><div class="icredit"></div>`, d)}
<div class="qcard"><h2>Client message</h2><textarea name="notes" rows="3" placeholder="A message to your client, shown on the invoice">${esc(d.notes || '')}</textarea></div>
${discCard('invoice', d.id ? d.disclaimer || '' : company.invoiceDisclaimer ?? '')}
</div>
<aside class="qside"><div class="qcard"><h3>Client payments</h3><p class="muted">How the client can pay this invoice.</p>
${planHas('onlinePayments') ? switchRow('allowCard', 'Card payments', on('allowCard')) : ''}
${planHas('zelle') ? switchRow('allowZelle', 'Zelle', on('allowZelle') && !!company.zelleRecipient, company.zelleRecipient ? '' : 'Add your Zelle details in App Settings', !company.zelleRecipient) : ''}</div>
<div class="qcard"><h3>Client view</h3><p class="muted">What the client sees on their invoice.</p>
${switchRow('showQty', 'Quantities', on('showQty'))}${switchRow('showUnit', 'Unit prices', on('showUnit'))}${switchRow('showLineTotals', 'Line item totals', on('showLineTotals'))}
${switchRow('showAccountBalance', 'Account balance', on('showAccountBalance'))}${switchRow('showLateStamp', 'Late stamp (if overdue)', on('showLateStamp'))}</div>
<div class="qcard"><h3>Notes</h3><textarea name="internalNotes" rows="6" placeholder="Leave an internal note for yourself or a team member. Clients never see this.">${esc(d.internalNotes || '')}</textarea></div></aside></div></form>`;
  const form = $('form', main);
  const clientBox = () => {
    const c = byId(D.clients, $('[name=clientId]', form).value); const job = byId(D.jobs, $('[name=jobId]', form).value);
    $('.iclient', form).innerHTML = !c ? '<div class="muted">Choose a client</div>' : `<div class="muted qlabel">Billing address</div><div class="qaddr">${esc(c.address) || '<span class="muted">No address on file</span>'}</div>
<div class="muted qlabel" style="margin-top:10px">Property address</div><div class="qaddr">${job && job.address && job.address !== c.address ? esc(job.address) : '(Same as billing address)'}</div>
${c.phone ? `<a class="qphone" href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : ''}${c.email ? `<a class="qphone" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}`;
  };
  // deposit credit, invoice balance and the client's account balance, refreshed with the totals
  form._afterRecalc = (total) => {
    const found = invDepositCredit(d, $('[name=jobId]', form).value, total); const removed = $('[name=depositCreditRemoved]', form).value === 'yes';
    const credit = removed ? null : found; const pays = d.payments || []; const paid = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const balance = Math.max(0, round2(total - (credit ? credit.amount : 0) - paid));
    const others = D.invoices.filter((i) => i.clientId === $('[name=clientId]', form).value && i.id !== d.id && i.status !== 'paid' && i.status !== 'draft').reduce((s, i) => s + invBalance(i), 0);
    $('.icredit', form).innerHTML = `${credit ? `<div class="crow-line dep-credit"><span>Deposit collected <span class="muted">· quote ${esc(credit.quote)}, ${fmtDate(credit.date)}</span></span><span>−${money(credit.amount)}</span><button type="button" class="t-rm" data-act="rmDepCredit" aria-label="Remove deposit from this invoice" title="Remove deposit from this invoice">${TRASH}</button></div>`
      : found ? `<div class="crow-line dep-credit off"><span class="muted">Deposit of ${money(found.amount)} from quote ${esc(found.quote)} not applied</span><button type="button" class="link-btn" data-act="applyDepCredit">Apply deposit</button></div>` : ''}
${[...pays].sort((a, b) => a.date.localeCompare(b.date)).map((p) => `<div class="crow-line dep-credit"><span>Payment · ${esc(payLabel(p.method))} <span class="muted">· ${fmtDate(p.date)}${p.reference ? ' · ' + esc(p.reference) : ''}</span></span><span>−${money(p.amount)}</span><button type="button" class="t-rm" data-act="delInvPayment" data-id="${d.id}" data-pid="${p.id}" aria-label="Delete this payment" title="Delete this payment">${TRASH}</button></div>`).join('')}
${d.id && d.status !== 'paid' && balance > 0 ? `<div class="collect-row"><button type="button" class="btn alt sm" data-act="collectPayment" data-id="${d.id}">+ Collect payment</button></div>` : ''}
<div class="ibal"><div><strong>Invoice balance</strong><strong>${money(d.status === 'paid' ? 0 : balance)}</strong></div><div><span>Account balance (including this ${d.status === 'paid' ? 'invoice' : d.status === 'draft' || !d.id ? 'draft' : 'invoice'})</span><span>${money(others + (d.status === 'paid' ? 0 : balance))}</span></div></div>`;
  };
  wireItems(form); clientBox();
  form._doc = d; form._kind = 'invoice'; form._discSaved = $('[name=disclaimer]', form).value;
  const setDue = () => { const t = $('[name=paymentTerms]', form).value; if (t !== 'custom') $('[name=dueDate]', form).value = ymd(addDays(parseD($('[name=issueDate]', form).value || ymd(new Date())), Number(t))); };
  form.addEventListener('change', (e) => {
    if (e.target.name === 'clientId' || e.target.name === 'jobId') { clientBox(); recalc(form); }
    if (e.target.name === 'paymentTerms' || e.target.name === 'issueDate') setDue();
    if (e.target.name === 'dueDate') $('[name=paymentTerms]', form).value = 'custom';
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form)); const after = e.submitter && e.submitter.value; delete body.after;
    body.items = readItems(form).filter((i) => i.desc);
    if (!body.items.length) return toast('Add at least one line item', true);
    const saved = d.id ? await api('PUT', `/api/invoices/${d.id}`, body) : await api('POST', '/api/invoices', body);
    if ($('#discDefault', form).checked) { await api('PUT', '/api/company', { invoiceDisclaimer: body.disclaimer }); company.invoiceDisclaimer = body.disclaimer; }
    toast('Invoice saved');
    if (d.id) await refresh(); else await navigate('/invoices/edit?id=' + saved.id);
    if (after === 'send') sendDialog('invoice', saved);
  });
}
const qp = (k) => new URLSearchParams(location.search).get(k);
function docPage(kind, isNew) {
  const form = kind === 'quote' ? quoteForm : invoiceForm;
  return {
    title: `${isNew ? 'New' : 'Edit'} ${kind}`,
    async render(main) {
      if (isNew) return form(main, null, { clientId: qp('client') });
      const doc = byId(D[kind + 's'], qp('id'));
      if (!doc) { main.innerHTML = `<div class="card"><h1>${kind === 'quote' ? 'Quote' : 'Invoice'} not found</h1><p><a href="/${kind}s" data-link>Back to the list</a></p></div>`; return; }
      form(main, doc);
    },
  };
}

// Contract / Disclaimer section: saves on its own (just this field), so other unsaved edits on the quote are untouched
// shared by the quote and invoice editors (form._kind = 'quote' | 'invoice'); the default lives in company.quoteDisclaimer / invoiceDisclaimer
const discCard = (kind, text) => `<div class="qcard disc"><div class="qcard-h"><h2>Contract / Disclaimer</h2><button type="button" class="icon-btn" data-act="discDelete" title="Remove disclaimer" aria-label="Remove disclaimer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button></div>
<label class="fl"><span>Description</span><textarea name="disclaimer" rows="4" placeholder="${kind === 'quote' ? 'Terms the client agrees to, e.g. how long the quote is valid' : 'e.g. Thank you for your business. Payment terms, late fees, warranty'}">${esc(text)}</textarea></label>
<div class="chk admin-only"><label><input type="checkbox" id="discDefault"> Apply to all future ${kind}s</label></div>
<div class="foot"><button type="button" class="btn alt" data-act="discCancel">Cancel</button><button type="button" class="btn" data-act="discSave">Save</button></div></div>`;
async function saveDisclaimer(form, text, msg) {
  const doc = form._doc; const kind = form._kind; const asDefault = $('#discDefault', form).checked;
  if (asDefault) { await api('PUT', '/api/company', { [kind + 'Disclaimer']: text }); company[kind + 'Disclaimer'] = text; }
  if (doc.id) { await api('PUT', `/api/${kind}s/${doc.id}`, { disclaimer: text }); doc.disclaimer = text; }
  form._discSaved = text; $('#discDefault', form).checked = false;
  toast(doc.id ? msg + (asDefault ? `, and set as the default for new ${kind}s` : '') : asDefault ? `Set as the default for new ${kind}s. It will be saved with this ${kind}.` : `It will be saved with this ${kind}`);
}
A.discSave = (d, el) => { const form = el.closest('form'); return saveDisclaimer(form, $('[name=disclaimer]', form).value.trim(), 'Disclaimer saved'); };
A.discCancel = (d, el) => { const form = el.closest('form'); $('[name=disclaimer]', form).value = form._discSaved; $('#discDefault', form).checked = false; };
A.discDelete = (d, el) => {
  const form = el.closest('form'); if (!confirm(`Remove the contract / disclaimer from this ${form._kind}?`)) return;
  $('[name=disclaimer]', form).value = ''; return saveDisclaimer(form, '', 'Disclaimer removed');
};

/* ===== quote editor (layout modeled on Jobber's quote page) ===== */
const DEFAULT_DISCLAIMER = 'This quote is valid for the next 30 days, after which values may be subject to change.';
function qItemRow(it) {
  // Jobber-style row: labeled boxes (name, qty, unit cost, markup, total) with the description full width underneath and a ⋯ menu.
  // Unit cost shows $; markup shows $ when flat, or % (percent of cost) from its selector.
  return `<div class="item-row qi"><label class="fl qi-name"><span>Name</span><input class="desc" autocomplete="off" placeholder="Item name or catalog service" value="${esc(it.desc || '')}"></label>
<label class="fl"><span>Quantity</span><input class="qty" type="number" step="any" min="0" value="${it.qty ?? 1}"></label>
<label class="fl"><span>Unit cost</span><div class="affix"><i>$</i><input class="cost" type="number" step="any" min="0" value="${it.cost ?? it.price ?? 0}"></div></label>
<label class="fl mk${it.markupType === 'flat' ? ' flat' : ''}"><span>Markup</span><div class="affix"><i class="pre">$</i><input class="markup" type="number" step="any" value="${it.markup ?? 0}"><select class="mtype" aria-label="Markup type"><option value="percent">%</option><option value="flat" ${it.markupType === 'flat' ? 'selected' : ''}>$</option></select></div></label>
<div class="fl amt-box"><span>Total</span><div class="amt"></div></div>
<details class="menu row-menu"><summary aria-label="Line item options" title="Line item options">⋯</summary><div class="menu-list">
<button type="button" class="mv" data-act="moveItem" data-dir="-1">Move up</button><button type="button" class="mv" data-act="moveItem" data-dir="1">Move down</button><button type="button" class="danger-text" data-act="rmItem">Remove line item</button></div></details>
<label class="fl qi-desc"><span>Description</span><textarea class="details" rows="3" placeholder="Shown to the client (optional)">${esc(it.details || '')}</textarea></label></div>`;
}
// hidden "off" + checkbox "on" with the same name: FormData keeps the last one, so unchecked saves "off".
// A disabled switch submits nothing, leaving the saved value alone.
const switchRow = (name, label, on, note, disabled) => `<label class="sw-row"><span>${label}${note ? `<small class="muted">${note}</small>` : ''}</span>${disabled ? '<input type="checkbox" class="sw" disabled>' : `<input type="hidden" name="${name}" value="off"><input type="checkbox" class="sw" name="${name}" value="on" ${on ? 'checked' : ''}>`}<i></i></label>`;
function quoteForm(main, doc, preset) {
  const d = doc || {}; const p = preset || {}; const items = d.items && d.items.length ? d.items : [{}];
  const status = d.id ? quoteStatus(d) : 'draft'; const job = d.id ? quoteJob(d) : null;
  const canJob = d.status === 'approved' && !job && (!(d.depositFee > 0) || d.depositPaidAt);
  const addr = (id) => esc((byId(D.clients, id) || {}).address || '');
  main.innerHTML = `<form class="qform"><div class="qpage"><div class="qmain">
<div class="qtop"><div class="qtop-l"><a href="/quotes" data-link class="back">← Quotes</a>${qBadge(status)}</div>
<div class="actions">${d.id ? `<details class="menu"><summary class="btn alt">⋯ More</summary><div class="menu-list">
<a href="/p/quote/${d.token}" target="_blank">View as client</a>
${d.status === 'sent' ? `<button type="button" data-act="approveQuote" data-id="${d.id}">Mark approved</button>` : ''}
${d.status !== 'declined' && d.depositFee > 0 && !d.depositPaidAt ? `<button type="button" data-act="markDepositPaid" data-id="${d.id}">Record deposit payment${d.zelleSentAt ? ' (Zelle sent)' : ''}</button>` : ''}
${canJob ? `<button type="button" data-act="quoteToJob" data-id="${d.id}">Create job</button>` : ''}${job ? `<a href="/jobs" data-link>Go to job ${esc(job.number)}</a>` : ''}
<button type="button" class="danger-text" data-act="delDoc" data-kind="quote" data-id="${d.id}">Delete quote</button></div></details>
<button class="btn alt" name="after" value="save">Save</button><button class="btn" name="after" value="send" title="Saves your changes, then sends">Send…</button>`
    : '<a class="btn alt" href="/quotes" data-link>Cancel</a><button class="btn alt" name="after" value="save">Save</button><button class="btn" name="after" value="send">Save &amp; send…</button>'}</div></div>
<input name="title" class="qtitle" value="${esc(d.title || '')}" placeholder="Quote title (e.g. Backyard cleanup)" aria-label="Quote title">
<div class="qhead"><div class="qclient"><select name="clientId" required aria-label="Client">${clientOptions(d.clientId || p.clientId)}</select>
<div class="muted qlabel">Property address</div><div class="qaddr">${addr(d.clientId || p.clientId) || '<span class="muted">Choose a client</span>'}</div></div>
<dl class="qmeta"><dt>Quote #</dt><dd><input name="number" class="num-in" maxlength="30" value="${esc(d.number || '')}" placeholder="Automatic" aria-label="Quote number" title="Leave blank for the next automatic number"></dd>
<dt>Created</dt><dd>${fmtDate((d.createdAt || ymd(new Date())).slice(0, 10))}</dd>
<dt>Status</dt><dd><select name="status" aria-label="Status">${['draft', 'sent', 'approved', 'declined'].map((s) => `<option value="${s}" ${(d.status || 'draft') === s ? 'selected' : ''}>${Q_STATUS[s]}</option>`).join('')}</select></dd></dl></div>
${itemsCard(items, `${optRow({ label: 'Deposit', name: 'deposit', value: d.depositValue ?? d.depositFee, type: d.depositType, pctLabel: '% of total' })}<div class="dep-out muted"></div>`, d)}
${d.depositPaidAt ? depositPaymentCard(d) : ''}
<div class="qcard"><h2>Client message</h2><textarea name="notes" rows="3" placeholder="A message to your client, shown on the quote">${esc(d.notes || '')}</textarea></div>
${discCard('quote', d.id ? d.disclaimer || '' : company.quoteDisclaimer ?? DEFAULT_DISCLAIMER)}
</div>
<aside class="qside"><div class="qcard"><h3>Client payments</h3><p class="muted">How the client can pay this quote's deposit.</p>
${planHas('onlinePayments') ? switchRow('allowCard', 'Card payments', d.allowCard !== 'off') : ''}
${planHas('zelle') ? switchRow('allowZelle', 'Zelle', d.allowZelle !== 'off' && !!company.zelleRecipient, company.zelleRecipient ? '' : 'Add your Zelle details in App Settings', !company.zelleRecipient) : ''}</div>
<div class="qcard"><h3>Notes</h3><textarea name="internalNotes" rows="6" placeholder="Leave an internal note for yourself or a team member. Clients never see this.">${esc(d.internalNotes || '')}</textarea></div></aside></div></form>`;
  const form = $('form', main); wireItems(form);
  form._doc = d; form._kind = 'quote'; form._discSaved = $('[name=disclaimer]', form).value;
  form.addEventListener('change', (e) => {
    if (e.target.name === 'clientId') $('.qaddr', form).innerHTML = addr(e.target.value) || '<span class="muted">No address on file</span>';
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form)); const after = e.submitter && e.submitter.value; delete body.after;
    body.items = readItems(form).filter((i) => i.desc);
    if (!body.items.length) return toast('Add at least one line item', true);
    const saved = d.id ? await api('PUT', `/api/quotes/${d.id}`, body) : await api('POST', '/api/quotes', body);
    if ($('#discDefault', form).checked) { await api('PUT', '/api/company', { quoteDisclaimer: body.disclaimer }); company.quoteDisclaimer = body.disclaimer; }
    toast('Quote saved');
    if (d.id) { await refresh(); } else { await navigate('/quotes/edit?id=' + saved.id); }
    if (after === 'send') sendDialog('quote', saved);
  });
}
PAGES['/quotes/new'] = docPage('quote', true); PAGES['/quotes/edit'] = docPage('quote', false);
PAGES['/invoices/new'] = docPage('invoice', true); PAGES['/invoices/edit'] = docPage('invoice', false);
A.delDoc = async (d) => { if (!confirm('Delete this ' + d.kind + '?')) return; await api('DELETE', `/api/${d.kind}s/${d.id}`); closeModal(); curPath().endsWith('/edit') ? navigate(`/${d.kind}s`) : refresh(); };
A.newQuoteFor = (d) => { closeModal(); navigate('/quotes/new?client=' + d.id); };



// Converted = a job was created from the quote; otherwise the stored status (sent shows as "Awaiting response")
const Q_STATUS = { draft: 'Draft', sent: 'Awaiting response', approved: 'Approved', converted: 'Converted', declined: 'Declined' };
const quoteJob = (q) => D.jobs.find((j) => j.quoteId === q.id);
const quoteStatus = (q) => (quoteJob(q) ? 'converted' : q.status);
const qBadge = (s) => `<span class="cstatus q-${s}">${Q_STATUS[s] || esc(s)}</span>`;
const moneyShort = (n) => (n >= 1000 ? '$' + (n / 1000).toFixed(n >= 1e5 ? 0 : 1) + 'k' : money(n));
let quoteView = { status: 'all', date: 'all', q: '', sort: 'created', dir: -1 }; const quoteSel = new Set();
PAGES['/quotes'] = {
  title: 'Quotes',
  async render(main) {
    const v = quoteView; const day = (s) => (s || '').slice(0, 10);
    const ago = (n) => ymd(addDays(new Date(), -n)); const tomorrow = ymd(addDays(new Date(), 1));
    const sentOn = (q) => day(q.sentAt || (q.status !== 'draft' ? q.createdAt : ''));
    const convOn = (q) => day((quoteJob(q) || {}).createdAt);
    const inWin = (d, from, to) => d && d >= from && d < to;
    const sentNow = D.quotes.filter((q) => inWin(sentOn(q), ago(30), tomorrow)); const sentPrev = D.quotes.filter((q) => inWin(sentOn(q), ago(60), ago(30)));
    const convNow = D.quotes.filter((q) => inWin(convOn(q), ago(30), tomorrow)); const convPrev = D.quotes.filter((q) => inWin(convOn(q), ago(60), ago(30)));
    const rate = (list) => (list.length ? Math.round((list.filter(quoteJob).length / list.length) * 100) : 0);
    const sum = (list) => list.reduce((s, q) => s + (q.total || 0), 0);
    const change = (now, prev, pts) => (prev ? `<span class="chg ${now >= prev ? 'up' : 'down'}">${now >= prev ? '↑' : '↓'} ${pts ? Math.abs(now - prev) : Math.abs(Math.round(((now - prev) / prev) * 100))}%</span>` : '');
    const counts = {}; D.quotes.forEach((q) => { const s = quoteStatus(q); counts[s] = (counts[s] || 0) + 1; });
    const since = { '30': ago(30), '90': ago(90), year: new Date().getFullYear() + '-01-01' }[v.date] || '';
    const list = D.quotes.filter((q) => {
      if (v.status !== 'all' && quoteStatus(q) !== v.status) return false;
      if (since && day(q.createdAt) < since) return false;
      const c = byId(D.clients, q.clientId) || {};
      return !v.q || [q.number, q.title, c.name, c.company, c.address, money(q.total)].join(' ').toLowerCase().includes(v.q.toLowerCase());
    });
    const cname = (q) => { const c = byId(D.clients, q.clientId); return c ? c.company || c.name : '—'; };
    const order = Object.keys(Q_STATUS);
    const key = { client: (q) => cname(q).toLowerCase(), number: (q) => Number(String(q.number).replace(/\D/g, '')) || 0, created: (q) => q.createdAt || '', status: (q) => order.indexOf(quoteStatus(q)), total: (q) => q.total || 0 }[v.sort];
    list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * v.dir);
    [...quoteSel].forEach((id) => { if (!byId(D.quotes, id)) quoteSel.delete(id); });
    const th = (k, label, cls = '') => `<th class="${cls}"><button class="th-btn" data-act="quoteSort" data-k="${k}">${label} <span class="sort ${v.sort === k ? 'on' : ''}">${v.sort === k ? (v.dir > 0 ? '▲' : '▼') : '⇅'}</span></button></th>`;
    main.innerHTML = `<div class="head"><h1>Quotes</h1><div class="actions"><button class="btn" data-act="newQuote">New Quote</button>
<details class="menu"><summary class="btn alt">⋯ More Actions</summary><div class="menu-list"><button data-act="exportQuotes">Export to CSV</button></div></details></div></div>
<div class="cstats">
<div class="cstat"><strong class="cs-h">Overview</strong><div class="qov">${order.map((s) => `<button data-act="quoteFilter" data-s="${s}"><i class="dot q-${s}"></i>${Q_STATUS[s]} (${counts[s] || 0})</button>`).join('')}</div></div>
<button class="cstat" data-act="quoteCard" data-k="rate"><div class="cs-h"><strong>Conversion rate</strong><span>↗</span></div><div class="muted">Sent in the past 30 days that became jobs</div><div class="cs-v">${rate(sentNow)}% ${change(rate(sentNow), rate(sentPrev), true)}</div></button>
<button class="cstat" data-act="quoteCard" data-k="sent"><div class="cs-h"><strong>Sent</strong><span>↗</span></div><div class="muted">Past 30 days</div><div class="cs-v">${sentNow.length} ${change(sentNow.length, sentPrev.length)}</div><div class="muted">${moneyShort(sum(sentNow))}</div></button>
<button class="cstat" data-act="quoteCard" data-k="converted"><div class="cs-h"><strong>Converted</strong><span>↗</span></div><div class="muted">Past 30 days</div><div class="cs-v">${convNow.length} ${change(convNow.length, convPrev.length)}</div><div class="muted">${moneyShort(sum(convNow))}</div></button></div>
<h2 class="ftitle">All quotes <span class="muted">(${list.length} result${list.length === 1 ? '' : 's'})</span></h2>
<div class="cfilters"><label class="pill">Status<select data-qv="status"><option value="all">All</option>${order.map((s) => `<option value="${s}" ${v.status === s ? 'selected' : ''}>${Q_STATUS[s]}</option>`).join('')}</select></label>
<label class="pill">📅 Date<select data-qv="date">${[['all', 'All'], ['30', 'Past 30 days'], ['90', 'Past 90 days'], ['year', 'This year']].map(([k, l]) => `<option value="${k}" ${v.date === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
<input id="qq" class="csearch" type="search" placeholder="Search quotes…" value="${esc(v.q)}"></div>
${quoteSel.size ? `<div class="bulk"><strong>${quoteSel.size} selected</strong><button class="btn danger sm" data-act="deleteSelQuotes">Delete</button><button class="btn alt sm" data-act="quoteClearSel">Clear selection</button></div>` : ''}
<div class="card ctable"><div class="tablewrap"><table><tr><th style="width:36px"><input type="checkbox" id="qSelAll" aria-label="Select all" ${list.length && list.every((q) => quoteSel.has(q.id)) ? 'checked' : ''}></th>
${th('client', 'Client')}${th('number', 'Quote number')}<th>Property</th>${th('created', 'Created')}${th('status', 'Status')}${th('total', 'Total', 'r')}</tr>
${list.map((q) => { const c = byId(D.clients, q.clientId) || {}; return `<tr class="crow" data-id="${q.id}"><td><input type="checkbox" class="qsel" value="${q.id}" ${quoteSel.has(q.id) ? 'checked' : ''} aria-label="Select ${esc(q.number)}"></td>
<td><strong>${esc(cname(q))}</strong></td><td>${esc(q.number)}${q.title ? `<div>${esc(q.title)}</div>` : ''}</td><td>${esc(c.address || '')}</td><td style="white-space:nowrap">${fmtDate(day(q.createdAt))}</td>
<td>${qBadge(quoteStatus(q))}${q.zelleSentAt && !q.depositPaidAt ? ' <span class="badge zelle">Zelle sent</span>' : ''}</td><td class="r"><strong>${money(q.total)}</strong></td></tr>`; }).join('') || `<tr><td colspan="7" class="empty">${D.quotes.length ? 'No quotes match these filters' : 'No quotes yet'}</td></tr>`}</table></div></div>`;
    $$('[data-qv]').forEach((s) => s.addEventListener('change', (e) => { quoteView[e.target.dataset.qv] = e.target.value; refresh(); }));
    let t; $('#qq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(async () => { quoteView.q = e.target.value; await refresh(); const q = $('#qq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); });
    $('#qSelAll').addEventListener('change', (e) => { list.forEach((q) => (e.target.checked ? quoteSel.add(q.id) : quoteSel.delete(q.id))); refresh(); });
    $$('.qsel').forEach((b) => b.addEventListener('change', (e) => { e.target.checked ? quoteSel.add(e.target.value) : quoteSel.delete(e.target.value); refresh(); }));
    $$('.crow').forEach((r) => r.addEventListener('click', (e) => { if (!e.target.closest('input')) navigate('/quotes/edit?id=' + r.dataset.id); }));
  },
};
A.quoteFilter = (d) => { quoteView = { ...quoteView, status: d.s }; refresh(); };
A.quoteCard = (d) => { quoteView = { ...quoteView, date: '30', status: d.k === 'converted' ? 'converted' : 'all' }; refresh(); };
A.quoteSort = (d) => { quoteView.dir = quoteView.sort === d.k ? -quoteView.dir : (['created', 'total', 'number'].includes(d.k) ? -1 : 1); quoteView.sort = d.k; refresh(); };
A.quoteClearSel = () => { quoteSel.clear(); refresh(); };
A.deleteSelQuotes = async () => {
  if (!confirm(`Delete ${quoteSel.size} quote${quoteSel.size === 1 ? '' : 's'}? This can't be undone.`)) return;
  for (const id of quoteSel) await api('DELETE', '/api/quotes/' + id);
  toast(`Deleted ${quoteSel.size} quote${quoteSel.size === 1 ? '' : 's'}`); quoteSel.clear(); refresh();
};
A.exportQuotes = () => downloadCsv('quotes.csv', [['Quote', 'Title', 'Client', 'Company', 'Property', 'Created', 'Sent', 'Status', 'Subtotal', 'Tax', 'Total', 'Deposit', 'Deposit paid'],
  ...D.quotes.map((q) => { const c = byId(D.clients, q.clientId) || {}; return [q.number, q.title || '', c.name || '', c.company || '', c.address || '', (q.createdAt || '').slice(0, 10), (q.sentAt || '').slice(0, 10), Q_STATUS[quoteStatus(q)], q.subtotal, q.tax, q.total, q.depositFee || 0, q.depositPaidAt ? (q.depositPaidAmount ?? q.depositFee) : '']; })]);
A.newQuote = () => navigate('/quotes/new');
A.editQuote = (d) => navigate('/quotes/edit?id=' + d.id);
A.sendQuote = (d) => sendDialog('quote', byId(D.quotes, d.id));
A.approveQuote = async (d) => { await api('POST', `/api/quotes/${d.id}/approve`, {}); toast('Quote approved'); refresh(); };
A.setDeposit = (d) => {
  const q = byId(D.quotes, d.id);
  const mb = modal(`Set deposit for ${q.number}`, `<form><label>Deposit amount<input type="number" name="depositFee" step="0.01" min="0" required value="${q.depositFee || ''}"></label>
<div class="muted">Clients will need to pay this deposit before work begins and must electronically sign the quote.</div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Set deposit</button></div></form>`);
  $('form', mb).addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    await api('POST', `/api/quotes/${q.id}/set-deposit`, { depositFee: Number(fd.get('depositFee')) });
    closeModal(); toast('Deposit set'); refresh();
  });
};
A.markDepositPaid = (d) => {
  const q = byId(D.quotes, d.id);
  payDialog({ title: `Record deposit · ${q.number}`, amount: q.depositFee, max: q.total, method: q.zelleSentAt ? 'zelle' : '',
    note: q.zelleSentAt ? 'The client reported sending the deposit by Zelle. Check your bank before recording it.' : '',
    async save(body) { await api('POST', `/api/quotes/${q.id}/mark-deposit-paid`, body); toast('Deposit recorded'); refresh(); } });
};
A.quoteToJob = (d) => {
  const q = byId(D.quotes, d.id);
  const mb = modal(`Schedule job from ${q.number}`, `<form><div class="row3"><label>Date<input type="date" name="date" required value="${ymd(addDays(new Date(), 1))}"></label><label>Start<input type="time" name="startTime" value="09:00"></label><label>End<input type="time" name="endTime" value="11:00"></label></div>
<div class="muted">Assign staff</div><div class="chk">${D.staff.filter((s) => s.status !== 'deactivated').map((s) => `<label><input type="checkbox" name="staff" value="${s.id}">${esc(s.name)}</label>`).join('')}</div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Create job</button></div></form>`);
  $('form', mb).addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const job = await api('POST', `/api/quotes/${q.id}/convert-to-job`, { date: fd.get('date'), startTime: fd.get('startTime'), endTime: fd.get('endTime'), staffIds: fd.getAll('staff') });
    closeModal(); toast('Job scheduled'); navigate('/jobs/edit?id=' + job.id);
  });
};

// displayStatus from the server: draft, sent (not yet due), overdue, paid
const I_STATUS = { overdue: 'Past due', sent: 'Awaiting payment', partial: 'Partly paid', draft: 'Draft', paid: 'Paid' };
const I_CLASS = { overdue: 'q-declined', sent: 'q-sent', partial: 'q-converted', draft: 'q-draft', paid: 'q-approved' };
const iBadge = (s) => `<span class="cstatus ${I_CLASS[s] || ''}">${I_STATUS[s] || esc(s)}</span>`;
const invBalance = (i) => (i.status === 'paid' ? 0 : i.balanceDue ?? i.total ?? 0);
const invSubject = (i) => i.subject || (byId(D.jobs, i.jobId) || {}).title || ((i.items || [])[0] || {}).desc || '';
let invView = { status: 'all', date: 'all', q: '', sort: 'issued', dir: -1 };
PAGES['/invoices'] = {
  title: 'Invoices',
  async render(main) {
    const v = invView; const day = (s) => (s || '').slice(0, 10);
    const ago = (n) => ymd(addDays(new Date(), -n)); const tomorrow = ymd(addDays(new Date(), 1));
    const inWin = (d, from, to) => d && d >= from && d < to;
    const issued = (from, to) => D.invoices.filter((i) => i.status !== 'draft' && inWin(day(i.issueDate), from, to));
    const issNow = issued(ago(30), tomorrow); const issPrev = issued(ago(60), ago(30));
    const sum = (l) => l.reduce((s, i) => s + (i.total || 0), 0); const avg = (l) => (l.length ? sum(l) / l.length : 0);
    const change = (now, prev, lowerIsBetter) => { if (!prev) return ''; const up = now >= prev; const good = lowerIsBetter ? !up : up; return `<span class="chg ${good ? 'up' : 'down'}">${up ? '↑' : '↓'} ${Math.abs(Math.round(((now - prev) / prev) * 100))}%</span>`; };
    // average days from issue to payment, for invoices paid in the window; commercial = client has a company name
    const payDays = (from, to, commercial) => { const l = D.invoices.filter((i) => i.status === 'paid' && inWin(day(i.paidAt), from, to) && !!(byId(D.clients, i.clientId) || {}).company === commercial); return l.length ? Math.round(l.reduce((s, i) => s + Math.max(0, (parseD(day(i.paidAt)) - parseD(day(i.issueDate))) / 864e5), 0) / l.length) : null; };
    const pt = (commercial, label) => { const now = payDays(ago(30), tomorrow, commercial); const prev = payDays(ago(60), ago(30), commercial);
      return `<div class="pt"><div class="cs-v sm">${now === null ? '—' : now + (now === 1 ? ' day' : ' days')} ${now !== null && prev ? change(now, prev, true) : ''}</div><div class="muted">${label}</div></div>`; };
    const group = (s) => D.invoices.filter((i) => i.displayStatus === s);
    const since = { '30': ago(30), '90': ago(90), year: new Date().getFullYear() + '-01-01' }[v.date] || '';
    const cname = (i) => { const c = byId(D.clients, i.clientId); return c ? c.company || c.name : '—'; };
    const list = D.invoices.filter((i) => {
      if (v.status !== 'all' && i.displayStatus !== v.status) return false;
      if (since && day(i.issueDate) < since) return false;
      const c = byId(D.clients, i.clientId) || {};
      return !v.q || [i.number, invSubject(i), c.name, c.company, money(i.total)].join(' ').toLowerCase().includes(v.q.toLowerCase());
    });
    const order = Object.keys(I_STATUS);
    const key = { client: (i) => cname(i).toLowerCase(), number: (i) => Number(String(i.number).replace(/\D/g, '')) || 0, due: (i) => i.dueDate || '', issued: (i) => i.issueDate || '', status: (i) => order.indexOf(i.displayStatus), total: (i) => i.total || 0, balance: invBalance }[v.sort];
    list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * v.dir);
    const th = (k, label, cls = '') => `<th class="${cls}"><button class="th-btn" data-act="invSort" data-k="${k}">${label} <span class="sort ${v.sort === k ? 'on' : ''}">${v.sort === k ? (v.dir > 0 ? '▲' : '▼') : '⇅'}</span></button></th>`;
    main.innerHTML = `<div class="head"><h1>Invoices</h1><div class="actions"><button class="btn" data-act="newInvoice">New Invoice</button>
<details class="menu"><summary class="btn alt">⋯ More Actions</summary><div class="menu-list"><button data-act="exportInvoices">Export to CSV</button></div></details></div></div>
<div class="cstats">
<div class="cstat"><strong class="cs-h">Overview</strong><div class="qov">${[['overdue', 'q-declined'], ['sent', 'q-sent'], ['draft', 'q-draft']].map(([s, c]) => `<button data-act="invFilter" data-s="${s}"><i class="dot ${c}"></i><span class="grow">${I_STATUS[s]} (${group(s).length})</span><span>${moneyShort(sum(group(s)))}</span></button>`).join('')}</div></div>
<button class="cstat" data-act="invCard"><div class="cs-h"><strong>Issued</strong><span>↗</span></div><div class="muted">Past 30 days</div><div class="cs-v">${issNow.length} ${change(issNow.length, issPrev.length)}</div><div class="muted">${moneyShort(sum(issNow))}</div></button>
<div class="cstat"><div class="cs-h"><strong>Average invoice</strong></div><div class="muted">Past 30 days</div><div class="cs-v">${avg(issNow) >= 1000 ? moneyShort(avg(issNow)) : "$" + Math.round(avg(issNow))} ${change(avg(issNow), avg(issPrev))}</div></div>
<div class="cstat"><div class="cs-h"><strong>Invoice payment time</strong></div><div class="muted">Issue to payment, past 30 days</div><div class="pts">${pt(false, 'Residential')}${pt(true, 'Commercial')}</div></div></div>
<h2 class="ftitle">All invoices <span class="muted">(${list.length} result${list.length === 1 ? '' : 's'})</span></h2>
<div class="cfilters"><label class="pill">Status<select data-iv="status"><option value="all">All</option>${order.map((s) => `<option value="${s}" ${v.status === s ? 'selected' : ''}>${I_STATUS[s]}</option>`).join('')}</select></label>
<label class="pill">📅 Date<select data-iv="date">${[['all', 'All'], ['30', 'Issued past 30 days'], ['90', 'Issued past 90 days'], ['year', 'Issued this year']].map(([k, l]) => `<option value="${k}" ${v.date === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
<input id="iq" class="csearch" type="search" placeholder="Search invoices…" value="${esc(v.q)}"></div>
<div class="card ctable"><div class="tablewrap"><table><tr>${th('client', 'Client')}${th('number', 'Invoice number')}${th('due', 'Due date')}<th>Subject</th>${th('status', 'Status')}${th('total', 'Total', 'r')}${th('balance', 'Balance', 'r')}</tr>
${list.map((i) => `<tr class="crow" data-id="${i.id}"><td><strong>${esc(cname(i))}</strong></td><td>${esc(i.number)}</td>
<td style="white-space:nowrap">${i.status === 'paid' ? fmtDate(i.dueDate) : i.dueDate && i.dueDate <= i.issueDate ? 'Due upon receipt' : fmtDate(i.dueDate)}</td><td>${esc(invSubject(i))}</td>
<td>${iBadge(i.displayStatus)}${i.zelleSentAt && i.status !== 'paid' ? ` <span class="badge zelle" title="Client reported a Zelle payment on ${fmtDate(i.zelleSentAt)}">Zelle sent</span>` : ''}</td>
<td class="r"><strong>${money(i.total)}</strong></td><td class="r"><strong>${money(invBalance(i))}</strong></td></tr>`).join('') || `<tr><td colspan="7" class="empty">${D.invoices.length ? 'No invoices match these filters' : 'No invoices yet'}</td></tr>`}</table></div></div>`;
    $$('[data-iv]').forEach((s) => s.addEventListener('change', (e) => { invView[e.target.dataset.iv] = e.target.value; refresh(); }));
    let t; $('#iq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(async () => { invView.q = e.target.value; await refresh(); const q = $('#iq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); });
    $$('.crow').forEach((r) => r.addEventListener('click', () => navigate('/invoices/edit?id=' + r.dataset.id)));
  },
};
A.invFilter = (d) => { invView = { ...invView, status: d.s }; refresh(); };
A.invCard = () => { invView = { ...invView, date: '30', status: 'all' }; refresh(); };
A.invSort = (d) => { invView.dir = invView.sort === d.k ? -invView.dir : (['client', 'status'].includes(d.k) ? 1 : -1); invView.sort = d.k; refresh(); };
A.exportInvoices = () => downloadCsv('invoices.csv', [['Invoice', 'Client', 'Company', 'Subject', 'Issued', 'Due', 'Status', 'Subtotal', 'Tax', 'Total', 'Balance', 'Paid on', 'Paid by'],
  ...D.invoices.map((i) => { const c = byId(D.clients, i.clientId) || {}; return [i.number, c.name || '', c.company || '', invSubject(i), i.issueDate, i.dueDate, I_STATUS[i.displayStatus], i.subtotal, i.tax, i.total, invBalance(i), i.paidAt || '', i.paymentMethod ? payLabel(i.paymentMethod) : '']; })]);
A.newInvoice = () => navigate('/invoices/new');
A.editInvoice = (d) => navigate('/invoices/edit?id=' + d.id);
A.sendInvoice = (d) => sendDialog('invoice', byId(D.invoices, d.id));
// record a payment received outside the app (cash, check, Zelle…) on an invoice; part payments allowed
A.collectPayment = (d) => {
  const inv = byId(D.invoices, d.id); const owed = invBalance(inv);
  payDialog({ title: `Collect payment · ${inv.number}`, amount: owed, max: owed, method: inv.zelleSentAt ? 'zelle' : '',
    note: inv.zelleSentAt ? 'The client reported sending this by Zelle. Check your bank before recording it.' : '',
    async save(body) { const r = await api('POST', `/api/invoices/${inv.id}/payments`, body); toast(r.status === 'paid' ? `${inv.number} is paid in full` : `Payment recorded. ${money(r.balanceDue)} still owed`); refresh(); } });
};
A.markPaid = A.collectPayment;
A.delInvPayment = async (d) => {
  const inv = byId(D.invoices, d.id); const p = (inv.payments || []).find((x) => x.id === d.pid); if (!p) return;
  if (!confirm(`Delete the ${money(p.amount)} ${payLabel(p.method)} payment from ${fmtDate(p.date)}? Unsaved changes on this page will be lost.`)) return;
  await api('DELETE', `/api/invoices/${inv.id}/payments/${p.id}`); toast('Payment deleted'); refresh();
};

/* ===== jobs ===== */
function jobConflicts(job) { return D.jobs.filter((j) => j.id !== job.id && j.status !== 'completed' && j.date === job.date && j.staffIds.some((s) => (job.staffIds || []).includes(s)) && j.startTime < job.endTime && job.startTime < j.endTime); }
/* ===== job page (layout modeled on Jobber's job page) at /jobs/new and /jobs/edit?id=… ===== */
function jobPage(main, job, preset) {
  const j = job || {}; const p = preset || {};
  const q = byId(D.quotes, j.quoteId); const st = j.id ? jobStatus(j) : 'upcoming';
  const items = j.items && j.items.length ? j.items : q ? q.items : [{}];
  const invs = j.id ? jobInvoices(j) : [];
  const team = D.staff.filter((s) => s.status !== 'deactivated' || (j.staffIds || []).includes(s.id));
  main.innerHTML = `<form class="qform jform"><div class="qpage"><div class="qmain">
<div class="qtop"><div class="qtop-l"><a href="/jobs" data-link class="back">← Jobs</a><span class="cstatus ${J_CLASS[st]}">${J_STATUS[st]}</span></div>
<div class="actions">${j.id ? `<details class="menu"><summary class="btn alt">⋯ More</summary><div class="menu-list">
${j.signature || !planHas('signatures') ? '' : `<button type="button" data-act="collectSignature" data-id="${j.id}">Collect signature</button>`}
<button type="button" class="no-tech" data-act="jobRemind" data-id="${j.id}">${planHas('sms') ? 'Text' : 'Email'} reminder to client</button>${planHas('invoices') ? `<button type="button" class="no-tech" data-act="jobInvoice" data-id="${j.id}">Create invoice</button>` : ''}
<a href="/calendar" data-link>Open job calendar</a><button type="button" class="danger-text no-tech" data-act="delJob" data-id="${j.id}">Delete job</button></div></details>
${j.status === 'scheduled' ? `<button type="button" class="btn alt no-tech" data-act="completeJob" data-id="${j.id}">Mark complete</button>` : `<button type="button" class="btn alt no-tech" data-act="reopenJob" data-id="${j.id}">↺ Reopen job</button>`}
<button class="btn no-tech">Save</button>` : '<a class="btn alt" href="/jobs" data-link>Cancel</a><button class="btn">Save job</button>'}</div></div>
<input name="title" class="qtitle" required value="${esc(j.title || '')}" placeholder="Job title (e.g. Streamer Install)" aria-label="Job title">
<div class="qhead"><div class="qclient"><select name="clientId" required aria-label="Client">${clientOptions(j.clientId || p.clientId)}</select>
<label class="fl"><span>Property address</span><input name="address" value="${esc(j.address || '')}" placeholder="Defaults to the client's address"></label><div class="jcontact"></div></div>
<dl class="qmeta"><dt>Job #</dt><dd>${j.number ? esc(j.number) : '<span class="muted">Assigned when saved</span>'}</dd>
<dt>Status</dt><dd><select name="status" aria-label="Status">${[['scheduled', 'Scheduled'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([k, l]) => `<option value="${k}" ${(j.status || 'scheduled') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></dd>
<dt>Created</dt><dd>${fmtDate((j.createdAt || ymd(new Date())).slice(0, 10))}</dd>
<dt>From quote</dt><dd>${q ? `<a href="/quotes/edit?id=${q.id}" data-link>${esc(q.number)}</a>` : '<span class="muted">—</span>'}</dd></dl></div>
${isTech() ? '' : itemsCard(items, '<div class="jdeposit"></div>', j.taxRate !== undefined ? j : q || j)}
<div class="qcard"><h2>Scheduled visit</h2><div class="row3"><label>Date<input type="date" name="date" required value="${esc(j.date || p.date || ymd(new Date()))}"></label>
<label>Start<input type="time" name="startTime" value="${esc(j.startTime || '09:00')}"></label><label>End<input type="time" name="endTime" value="${esc(j.endTime || '11:00')}"></label></div>
<div class="muted qlabel">Assigned team</div><div class="team-pick">${team.map((s) => `<label><input type="checkbox" name="staff" value="${s.id}" ${(j.staffIds || []).includes(s.id) ? 'checked' : ''}>${avatarHtml(s, 24)}${esc(s.name)}</label>`).join('') || '<span class="muted">Add team members on Manage Team first</span>'}</div>
<label>Instructions<textarea name="description" rows="3" placeholder="What the team needs to know for this visit">${esc(j.description || '')}</textarea></label></div>
${j.id && j.signature ? sigCard(j) : ''}
<div class="qcard no-tech"><div class="qcard-h"><h2>Billing</h2>${j.id ? `<button type="button" class="btn alt sm" data-act="jobInvoice" data-id="${j.id}">+ Create invoice</button>` : ''}</div>
${!j.id ? '<p class="muted">Save the job first, then create invoices from it.</p>' : invs.length ? `<div class="tablewrap"><table class="mini"><tr><th>Invoice</th><th>Due date</th><th>Status</th><th>Subject</th><th class="r">Total</th><th class="r">Balance</th></tr>
${invs.map((i) => `<tr><td><a href="/invoices/edit?id=${i.id}" data-link>${esc(i.number)}</a></td><td>${fmtDate(i.dueDate)}</td><td>${iBadge(i.displayStatus)}</td><td>${esc(invSubject(i))}</td><td class="r">${money(i.total)}</td><td class="r">${money(invBalance(i))}</td></tr>`).join('')}</table></div>`
    : '<p class="muted">No invoices yet. Create one when the work is done.</p>'}</div></div>
<aside class="qside"><div class="qcard"><h3>Notes</h3><textarea name="internalNotes" rows="8" placeholder="Leave an internal note for yourself or a team member. Clients never see this.">${esc(j.internalNotes || '')}</textarea></div></aside></div></form>`;
  const form = $('form', main);
  const contact = () => {
    const c = byId(D.clients, $('[name=clientId]', form).value) || {};
    const addr = $('[name=address]', form); addr.placeholder = c.address || "Defaults to the client's address";
    $('.jcontact', form).innerHTML = [c.phone ? `<a class="qphone" href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '', c.email ? `<a class="qphone" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''].join('');
  };
  // deposit from the quote this job came from: required, collected, outstanding
  form._afterRecalc = () => {
    if (!q || !(q.depositFee > 0)) { $('.jdeposit', form).innerHTML = ''; return; }
    const paid = q.depositPaidAt ? Number(q.depositPaidAmount ?? q.depositFee) || 0 : 0;
    $('.jdeposit', form).innerHTML = `<div class="crow-line"><span>Required deposit${q.depositType === 'percent' ? ` (${q.depositValue}%)` : ''}</span><span>${money(q.depositFee)}</span></div>
${paid ? `<div class="crow-line"><span>Deposit collected <span class="muted">· ${fmtDate(q.depositPaidAt)}</span></span><span>−${money(paid)}</span></div>` : ''}
<div class="crow-line"><strong>Outstanding deposit</strong><strong>${money(Math.max(0, q.depositFee - paid))}</strong></div>`;
  };
  wireItems(form); contact();
  if (isTech()) $$('input, select, textarea', form).forEach((el) => { el.disabled = true; }); // technicians view jobs only
  form.addEventListener('change', (e) => { if (e.target.name === 'clientId') contact(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = new FormData(form);
    const body = { title: fd.get('title'), clientId: fd.get('clientId'), status: fd.get('status'), address: fd.get('address') || (byId(D.clients, fd.get('clientId')) || {}).address || '', date: fd.get('date'), startTime: fd.get('startTime'), endTime: fd.get('endTime'), description: fd.get('description'), staffIds: fd.getAll('staff'), internalNotes: fd.get('internalNotes'), taxRate: fd.get('taxRate'), discountType: fd.get('discountType'), discountValue: fd.get('discountValue'), items: readItems(form).filter((i) => i.desc) };
    if (body.endTime <= body.startTime) return toast('End time must be after start time', true);
    const clash = jobConflicts({ id: j.id, ...body });
    if (clash.length && !confirm(`Schedule conflict: ${clash.map((c) => c.number + ' ' + c.title).join(', ')} overlaps for an assigned staff member. Save anyway?`)) return;
    const offHours = body.staffIds.map((id) => byId(D.staff, id)).filter((s) => s && !withinHours(s, body.date, body.startTime, body.endTime));
    if (offHours.length && !confirm(`Outside working hours: ${offHours.map((s) => s.name).join(', ')} ${offHours.length === 1 ? "isn't" : "aren't"} scheduled to work then (see Manage team). Save anyway?`)) return;
    const saved = j.id ? await api('PUT', '/api/jobs/' + j.id, body) : await api('POST', '/api/jobs', body);
    toast('Job saved'); if (j.id) refresh(); else navigate('/jobs/edit?id=' + saved.id);
  });
}
/* ===== client signature on a job: any team member can collect it (job page ⋯ More → Collect signature); managers / admins can remove it ===== */
const SIG_STATEMENT = 'I confirm the work described above was completed to my satisfaction.';
const fmtStamp = (isoStr) => { const d = new Date(isoStr); return isNaN(d) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); };
const sigCard = (j) => { const s = j.signature; return `<div class="qcard sig-card"><div class="qcard-h"><h2>Client signature</h2>${s ? '<span class="cstatus q-approved">Signed</span>' : ''}</div>
${s ? `<div class="sig-show"><img class="sig-img" src="${esc(s.file)}" alt="Signature of ${esc(s.name)}"></div>
<p class="sig-meta">Signed by <strong>${esc(s.name)}</strong> on ${esc(fmtStamp(s.signedAt))}${s.collectedBy ? ` <span class="muted">· collected by ${esc(s.collectedBy)}</span>` : ''}</p>
${s.statement ? `<p class="muted sig-stmt">“${esc(s.statement)}”</p>` : ''}<button type="button" class="btn danger sm no-tech" data-act="rmSignature" data-id="${j.id}">Remove signature</button>`
    : ''}</div>`; };
A.collectSignature = (d) => {
  const j = byId(D.jobs, d.id); const c = byId(D.clients, j.clientId) || {};
  const mb = modal('Collect signature', `<form class="sig-form" data-sticky><div class="sig-job"><strong>${esc(j.title)}</strong> <span class="muted">#${esc(j.number)}</span><div class="muted">${esc(c.name || '')}${j.date ? ' · ' + fmtDate(j.date) : ''}</div></div>
<label class="fl"><span>Statement</span><textarea name="statement" rows="2" maxlength="300">${esc(SIG_STATEMENT)}</textarea></label>
<div class="sig-pad"><canvas aria-label="Signature pad. Sign with your finger, stylus or mouse"></canvas><span class="sig-line"></span><span class="sig-hint">Sign here</span>
<button type="button" class="link-btn sig-clear">Clear</button></div>
<label class="fl"><span>Name of person signing*</span><input name="name" required maxlength="100" value="${esc(c.name || '')}" autocomplete="off"></label>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save signature</button></div></form>`, true);
  const form = $('form', mb); const cv = $('canvas', mb); const pad = $('.sig-pad', mb); const ctx = cv.getContext('2d');
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1)); let inked = false; let last = null;
  const size = () => { const r = cv.getBoundingClientRect(); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111827'; };
  size();
  const at = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); last = at(e); ctx.beginPath(); ctx.arc(last.x, last.y, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#111827'; ctx.fill(); inked = true; pad.classList.add('inked'); });
  cv.addEventListener('pointermove', (e) => {
    if (!last) return; e.preventDefault();
    for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) { const p = at(ev); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; }
  });
  const end = () => { last = null; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  $('.sig-clear', mb).addEventListener('click', () => { ctx.clearRect(0, 0, cv.width, cv.height); inked = false; pad.classList.remove('inked'); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); if (!inked) return toast('Please sign in the box first', true);
    const b = Object.fromEntries(new FormData(form)); const btn = $('.foot .btn:not(.alt)', form); btn.disabled = true; btn.textContent = 'Saving…';
    try { await api('POST', `/api/jobs/${j.id}/signature`, { ...b, dataUrl: cv.toDataURL('image/png') }); closeModal(); toast('Signature saved'); refresh(); }
    catch (err) { toast(err.message, true); btn.disabled = false; btn.textContent = 'Save signature'; }
  });
};
A.rmSignature = async (d) => {
  if (!confirm('Remove this signature? Unsaved changes on this page will be lost. You can collect a new one afterwards.')) return;
  await api('DELETE', `/api/jobs/${d.id}/signature`); toast('Signature removed'); refresh();
};
PAGES['/jobs/new'] = { title: 'New job', render: (main) => jobPage(main, null, { clientId: qp('client'), date: qp('date') }) };
PAGES['/jobs/edit'] = {
  title: 'Job',
  render(main) {
    const j = byId(D.jobs, qp('id'));
    if (!j) { main.innerHTML = '<div class="card"><h1>Job not found</h1><p><a href="/jobs" data-link>Back to Jobs</a></p></div>'; return; }
    jobPage(main, j);
  },
};
A.newJob = () => { closeModal(); navigate('/jobs/new'); };
A.newJobFor = (d) => { closeModal(); navigate('/jobs/new?client=' + d.id); };
A.newJobOn = (d) => isTech() || navigate('/jobs/new?date=' + d.date);
A.editJob = (d) => { closeModal(); navigate('/jobs/edit?id=' + d.id); };
A.delJob = async (d) => { if (!confirm('Delete this job?')) return; await api('DELETE', '/api/jobs/' + d.id); closeModal(); toast('Job deleted'); curPath() === '/jobs/edit' ? navigate('/jobs') : refresh(); };
A.reopenJob = async (d) => { await api('PUT', '/api/jobs/' + d.id, { status: 'scheduled' }); toast('Job reopened'); refresh(); };
A.jobInvoice = async (d) => { const inv = await api('POST', `/api/jobs/${d.id}/create-invoice`, {}); closeModal(); toast('Draft invoice created'); navigate('/invoices/edit?id=' + inv.id); };
A.jobRemind = async (d) => { const r = await api('POST', `/api/jobs/${d.id}/remind`, { channels: [planHas('sms') ? 'sms' : 'email'] }); toast(r.results[0].status === 'simulated' ? 'Reminder logged (no message provider connected)' : 'Reminder ' + r.results[0].status, r.results[0].status === 'failed'); };
// Job status as shown on the Jobs page, derived from the stored status (scheduled/completed/cancelled), the date and invoices
const J_STATUS = { late: 'Late', today: 'Today', upcoming: 'Upcoming', invoice: 'Requires invoicing', archived: 'Archived', cancelled: 'Cancelled' };
const J_CLASS = { late: 'q-declined', today: 'q-converted', upcoming: 'q-approved', invoice: 'q-sent', archived: 'q-draft', cancelled: 'q-draft' };
const jobInvoices = (j) => D.invoices.filter((i) => i.jobId === j.id);
function jobStatus(j) {
  const today = ymd(new Date());
  if (j.status === 'cancelled') return 'cancelled';
  if (j.status === 'completed') return jobInvoices(j).length ? 'archived' : 'invoice';
  return j.date < today ? 'late' : j.date === today ? 'today' : 'upcoming';
}
// value of a job: its invoices, or the quote it came from when not invoiced yet
const jobTotal = (j) => { const inv = jobInvoices(j); if (inv.length) return inv.reduce((s, i) => s + (i.total || 0), 0); if (j.items && j.items.length) return j.total || 0; const q = byId(D.quotes, j.quoteId); return q ? q.total || 0 : null; };
let jobView = { status: 'all', staff: '', q: '', sort: 'schedule', dir: -1 };
PAGES['/jobs'] = {
  title: 'Jobs',
  async render(main) {
    const v = jobView; const today = ymd(new Date());
    const ago = (n) => ymd(addDays(new Date(), -n)); const ahead = (n) => ymd(addDays(new Date(), n));
    const live = D.jobs.filter((j) => j.status !== 'cancelled');
    const recent = (from, to) => live.filter((j) => j.date >= from && j.date < to);
    const recNow = recent(ago(30), ahead(1)); const recPrev = recent(ago(60), ago(30));
    const upcoming = D.jobs.filter((j) => j.status === 'scheduled' && j.date >= today && j.date <= ahead(30));
    const sum = (l) => l.reduce((s, j) => s + (jobTotal(j) || 0), 0);
    const change = (now, prev) => (prev ? `<span class="chg ${now >= prev ? 'up' : 'down'}">${now >= prev ? '↑' : '↓'} ${Math.abs(Math.round(((now - prev) / prev) * 100))}%</span>` : '');
    const count = (s) => D.jobs.filter((j) => jobStatus(j) === s).length;
    const cname = (j) => { const c = byId(D.clients, j.clientId); return c ? c.company || c.name : '—'; };
    const list = D.jobs.filter((j) => {
      if (v.status !== 'all' && jobStatus(j) !== v.status) return false;
      if (v.staff && !(j.staffIds || []).includes(v.staff)) return false;
      const c = byId(D.clients, j.clientId) || {};
      return !v.q || [j.number, j.title, j.address, c.name, c.company].join(' ').toLowerCase().includes(v.q.toLowerCase());
    });
    const order = Object.keys(J_STATUS);
    const key = { client: (j) => cname(j).toLowerCase(), number: (j) => Number(String(j.number).replace(/\D/g, '')) || 0, schedule: (j) => (j.date || '') + (j.startTime || ''), status: (j) => order.indexOf(jobStatus(j)), total: (j) => jobTotal(j) ?? -1 }[v.sort];
    list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * v.dir);
    const th = (k, label, cls = '') => `<th class="${cls}"><button class="th-btn" data-act="jobSort" data-k="${k}">${label} <span class="sort ${v.sort === k ? 'on' : ''}">${v.sort === k ? (v.dir > 0 ? '▲' : '▼') : '⇅'}</span></button></th>`;
    const team = (j) => (j.staffIds || []).map((id) => byId(D.staff, id)).filter(Boolean).map((s) => s.name).join(', ');
    main.innerHTML = `<div class="head"><h1>Jobs</h1><div class="actions"><button class="btn no-tech" data-act="newJob">New Job</button>
<details class="menu"><summary class="btn alt">⋯ More Actions</summary><div class="menu-list"><button data-act="exportJobs">Export to CSV</button><a href="/calendar" data-link>Open job calendar</a></div></details></div></div>
<div class="cstats">
<div class="cstat"><strong class="cs-h">Overview</strong><div class="qov">${[['late', 'q-declined'], ['invoice', 'q-sent'], ['today', 'q-converted'], ['upcoming', 'q-approved']].map(([s, c]) => `<button data-act="jobFilter" data-s="${s}"><i class="dot ${c}"></i>${J_STATUS[s]} (${count(s)})</button>`).join('')}</div></div>
<button class="cstat" data-act="jobCard" data-k="recent"><div class="cs-h"><strong>Recent visits</strong><span>↗</span></div><div class="muted">Past 30 days</div><div class="cs-v">${recNow.length} ${change(recNow.length, recPrev.length)}</div><div class="muted money">${moneyShort(sum(recNow))}</div></button>
<button class="cstat" data-act="jobCard" data-k="upcoming"><div class="cs-h"><strong>Visits scheduled</strong><span>↗</span></div><div class="muted">Next 30 days</div><div class="cs-v">${upcoming.length}</div><div class="muted money">${moneyShort(sum(upcoming))}</div></button>
<div class="cstat no-tech"><div class="cs-h"><strong>Requires invoicing</strong></div><div class="muted">Completed, not invoiced yet</div><div class="cs-v">${count('invoice')}</div><div class="muted">${moneyShort(sum(D.jobs.filter((j) => jobStatus(j) === 'invoice')))}</div></div></div>
<h2 class="ftitle">All jobs <span class="muted">(${list.length} result${list.length === 1 ? '' : 's'})</span></h2>
<div class="cfilters"><label class="pill">Status<select data-jv="status"><option value="all">All</option>${order.map((s) => `<option value="${s}" ${v.status === s ? 'selected' : ''}>${J_STATUS[s]}</option>`).join('')}</select></label>
<label class="pill">Team member<select data-jv="staff"><option value="">All</option>${D.staff.map((s) => `<option value="${s.id}" ${v.staff === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
<input id="jq" class="csearch" type="search" placeholder="Search jobs…" value="${esc(v.q)}"></div>
<div class="card ctable"><div class="tablewrap"><table><tr>${th('client', 'Client')}${th('number', 'Job number')}<th>Property</th>${th('schedule', 'Schedule')}${th('status', 'Status')}${th('total', 'Total', 'r money')}</tr>
${list.map((j) => { const st = jobStatus(j); const t = jobTotal(j); return `<tr class="crow" data-id="${j.id}"><td><strong>${esc(cname(j))}</strong></td><td>${esc(j.number)}${j.title ? `<div>${esc(j.title)}</div>` : ''}</td><td>${esc(j.address || (byId(D.clients, j.clientId) || {}).address || '')}</td>
<td>${j.status === 'completed' ? '<div class="sched-done">Completed</div>' : ''}${fmtDate(j.date)}${j.status !== 'completed' ? `<div class="muted">${esc(fmtTime(j.startTime))} – ${esc(fmtTime(j.endTime))}</div>` : ''}${team(j) ? `<div class="muted">${esc(team(j))}</div>` : ''}</td>
<td><span class="cstatus ${J_CLASS[st]}">${J_STATUS[st]}</span></td><td class="r money"><strong>${t === null ? '<span class="muted">—</span>' : money(t)}</strong></td></tr>`; }).join('') || `<tr><td colspan="6" class="empty">${D.jobs.length ? 'No jobs match these filters' : 'No jobs yet'}</td></tr>`}</table></div></div>`;
    $$('[data-jv]').forEach((s) => s.addEventListener('change', (e) => { jobView[e.target.dataset.jv] = e.target.value; refresh(); }));
    let tm; $('#jq').addEventListener('input', (e) => { clearTimeout(tm); tm = setTimeout(async () => { jobView.q = e.target.value; await refresh(); const q = $('#jq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); });
    $$('.crow').forEach((r) => r.addEventListener('click', () => navigate('/jobs/edit?id=' + r.dataset.id)));
  },
};
A.jobFilter = (d) => { jobView = { ...jobView, status: d.s }; refresh(); };
A.jobCard = (d) => { jobView = { ...jobView, status: d.k === 'upcoming' ? 'upcoming' : 'all', sort: 'schedule', dir: d.k === 'upcoming' ? 1 : -1 }; refresh(); };
A.jobSort = (d) => { jobView.dir = jobView.sort === d.k ? -jobView.dir : (['client', 'status'].includes(d.k) ? 1 : -1); jobView.sort = d.k; refresh(); };
A.exportJobs = () => downloadCsv('jobs.csv', [['Job', 'Title', 'Client', 'Company', 'Property', 'Date', 'Start', 'End', 'Team', 'Status', 'Total'],
  ...D.jobs.map((j) => { const c = byId(D.clients, j.clientId) || {}; return [j.number, j.title, c.name || '', c.company || '', j.address || '', j.date, j.startTime, j.endTime, (j.staffIds || []).map((id) => (byId(D.staff, id) || {}).name).filter(Boolean).join('; '), J_STATUS[jobStatus(j)], jobTotal(j) ?? '']; })]);
A.completeJob = async (d) => { await api('PUT', '/api/jobs/' + d.id, { status: 'completed' }); closeModal(); toast('Job completed. Create an invoice from the job when ready.'); refresh(); };
