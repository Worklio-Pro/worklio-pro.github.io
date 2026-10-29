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
// regional settings (App Settings): first day of the week, date format, 12/24-hour time
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
// US phone numbers as (123) 456-7890 while typing; numbers starting with + (international) are left alone
const fmtUsPhone = (s) => {
  if (/^\s*\+/.test(s)) return s;
  let d = String(s || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') d = d.slice(1); d = d.slice(0, 10);
  return d.length > 6 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `(${d.slice(0, 3)}) ${d.slice(3)}` : d.length ? `(${d}` : '';
};
function phoneMask(input) {
  if (!input) return;
  input.value = fmtUsPhone(input.value);
  input.addEventListener('input', () => {
    if (/^\s*\+/.test(input.value)) return;
    const before = input.value.slice(0, input.selectionStart).replace(/\D/g, '').length; // keep the cursor after the same digit
    input.value = fmtUsPhone(input.value);
    let pos = 0; for (let n = 0; pos < input.value.length && n < before; pos++) if (/\d/.test(input.value[pos])) n++;
    input.setSelectionRange(pos, pos);
  });
}

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 && !url.startsWith('/api/auth/')) { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search); throw new Error('Please log in'); } // session ended
  if (!r.ok) { let m = 'Request failed'; let j = {}; try { j = await r.json(); m = j.error || m; } catch (e) { /* ignore */ } if (j.paused) toPlans(); throw new Error(m); }
  return r.json();
}
// a paused account (company.account.paused) is read-only: owners and admins who try to create, change or delete something
// go to Account and billing to choose a plan; everyone else sees a note to contact their owner or admin instead of the page
const pausedNow = () => !!(company.account && company.account.paused);
const PAUSED_FREE = ['/settings/billing', '/profile', '/forum', '/settings/support-access']; // pages that still work as normal
const PAUSED_ACTS = /^(new|edit|add|del|delete|rm|remove|save|create|mark|approve|collect|complete|reopen|merge|import|runImport|upload|send|setDeposit|undoDeposit|quoteToJob|jobInvoice|jobRemind|jobRequestOff|requestOff|manageStaff|tm(Invite|Revoke|HoursEdit)|role(Add|Rm|Save|Tick)|disc(Save|Delete)|rev(Edit|Delete)|sp(Drop|Move|Remove)|social(Connect|Disconnect|Choose)|connectStripe|pay(Bank|Disable|StripeRetry)|pdRefund|toDecide|toCancel|bookingSave|primaryDomain|checkDomain|resetTpl|importTemplate|clientDupes)/;
// what a paused account is told, by why it's paused: most reasons the business fixes itself (choose a plan, or update the card);
// only an account paused by the platform is told to get in touch. btn: the button's label (Explore plans / Update billing), or '' for none
function pausedMsg(pz) {
  const product = esc((company.account && company.account.productName) || 'Worklio Pro'); const ce = company.account && company.account.contactEmail; const on = pz.on ? esc(fmtDate(pz.on)) : '';
  const contact = ce ? `<a href="mailto:${esc(ce)}">${esc(ce)}</a>` : 'us';
  return {
    trial: { title: pz.prepaid ? `Your prepaid months ended${on ? ` on ${on}` : ''}` : `Your free trial ended${on ? ` on ${on}` : ''}`, text: `Choose a plan and pay to keep using ${product}. Your data is right where you left it.`, btn: 'Explore plans' },
    ended: { title: `Your access ended${on ? ` on ${on}` : ''}`, text: `Choose a plan and pay to keep using ${product}. Your data is right where you left it.`, btn: 'Explore plans' },
    cancelled: { title: `Your subscription ended${on ? ` on ${on}` : ''}`, text: `Choose a plan to start again. Your data is right where you left it.`, btn: 'Explore plans' },
    billing: pz.fixCard ? { title: 'We couldn’t collect your last payment', text: `Update your billing information to continue with ${product}. We’ll retry the payment right away, and your account opens again as soon as it goes through.`, btn: 'Update billing' }
      : { title: 'Your subscription ended because a payment didn’t go through', text: 'Choose a plan and add a card that works to continue. Your data is right where you left it.', btn: 'Explore plans' },
    platform: { title: 'Your account is paused', text: `${product} paused this account. Contact ${contact} to reopen it.`, btn: '' },
  }[pz.reason] || { title: 'Your account is paused', text: `Contact ${contact} to reopen it.`, btn: '' };
}
function toPlans() {
  if (!isAdminMe()) return;
  closeModal(); if (curPath() !== '/settings/billing') navigate('/settings/billing');
}
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !pausedNow() || !isAdminMe() || PAUSED_FREE.includes(curPath()) || el.closest('#topbar, #side, #bnav, #helpPanel') || !PAUSED_ACTS.test(el.dataset.act)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  toast('Your account is paused. Choose a plan to make changes again.', true); toPlans();
}, true);
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
// lists this login's role can't read (the server would refuse) load as empty
async function loadAll() {
  const names = ['clients', 'services', 'staff', 'quotes', 'jobs', 'invoices', 'expenses', 'tasks', 'events'];
  const res = await Promise.all(names.map((n) => (me && me.collections && !me.collections.includes(n) ? [] : api('GET', '/api/' + n))));
  const out = {}; names.forEach((n, i) => { out[n] = res[i]; });
  // time off (a plan feature): approved time off for the schedule and job warnings; requests waiting for whoever approves
  out.timeOff = []; out.timeOffWaiting = 0;
  if (planHas('timeOff')) { const T = await api('GET', '/api/time-off').catch(() => null); if (T) { out.timeOff = T.requests.filter((r) => r.status === 'approved'); out.timeOffWaiting = T.approver ? T.requests.filter((r) => r.status === 'pending' && !r.mine).length : 0; } }
  return out;
}
// approved time off for this team member covering a date (and the hours, if it's part of a day)
const offOn = (staffId, date, start, end) => (D.timeOff || []).find((r) => r.staffId === staffId && r.from <= date && r.to >= date && (!r.start || !start || (r.start < (end || start) && r.end > start)));
const clientName = (id) => (byId(D.clients, id) || {}).name || '—';
const staffDots = (ids) => (ids || []).map((id) => { const s = byId(D.staff, id); return s ? `<span title="${esc(s.name)}"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${esc(s.color)};margin-right:4px"></span>${esc(s.name)}</span>` : ''; }).join('<br>') || '<span class="muted">Unassigned</span>';
const clientOptions = (sel) => `<option value="">Select client…</option>` + D.clients.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');

/* ===== router ===== */
const PAGES = {};
const NAV = [
  ['Operations', [['/business-overview', 'Home'], ['/calendar', 'Calendar'], ['/requests', 'Requests'], ['/clients', 'Clients'], ['/quotes', 'Quotes'], ['/jobs', 'Jobs'], ['/invoices', 'Invoices']]],
  ['Money', [['/payments', 'Payments'], ['/services', 'Products & Services'], ['/expenses', 'Expenses'], ['/reports', 'Financial Reports'], ['/tax-summary', 'Tax Summary']]],
  ['Marketing', [['/reviews', 'Reviews'], ['/social-posts', 'Social Posts']]],
  ['Records', [['/project-gallery', 'Project Gallery'], ['/notifications', 'Notifications Log']]],
];
// the Settings pages live in the top bar's gear menu, not the sidebar
const SETTINGS_NAV = [['/settings/company', 'Company Profile'], ['/team', 'Manage Team'], ['/settings/roles', 'Roles & Permissions'], ['/settings/emails', 'Email Templates'], ['/settings', 'App Settings'], ['/settings/connections', 'Account Connections'], ['/marketplace', 'App Marketplace'], ['/settings/billing', 'Account and Billing'], ['/rewards', 'Refer & Earn'], ['/settings/support-access', 'Support Access']];
const navPaths = [...NAV.flatMap(([, items]) => items.map(([p]) => p)), ...SETTINGS_NAV.map(([p]) => p)];
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
// the owner and admins can do everything; anyone else has their role's permissions (Settings → Roles & Permissions), sent with /api/auth/me
const isAdminMe = () => ['owner', 'admin'].includes(role());
const canDo = (k) => isAdminMe() || !!(me && (me.perms || []).includes(k));
const OWNER_PAGES = ['/settings/billing']; // the business's subscription: the owner only
const memberCan = (path) => (OWNER_PAGES.includes(path) ? role() === 'owner' || (role() === 'admin' && pausedNow()) : isAdminMe() || !!(me && me.pages && me.pages.includes(path)));
// body classes that hide what a role can't do (styles.css): .limit for anyone but owner/admin, p-<permission> for each permission
function permClasses() { const b = document.body; const lim = !isAdminMe(); b.classList.toggle('limit', lim); [...b.classList].filter((c) => c.startsWith('p-')).forEach((c) => b.classList.remove(c)); if (lim) (me && me.perms || []).forEach((k) => b.classList.add('p-' + k.replace('.', '-'))); }
// the account's plan (from /api/company): features it includes and pages it doesn't. The server enforces the same.
const planHas = (f) => !(company.account && company.account.features) || company.account.features.includes(f);
const planLocked = (path) => !!(company.account && (company.account.lockedPages || []).includes(path));
const betaPage = (path) => !!(company.account && (company.account.betaPages || []).includes(path));
// the menu in the order and sections set in Alpha → Settings → Menu (sent with the account info); NAV is the default
function navList() {
  const ord = company.account && company.account.navOrder; if (!ord) return NAV;
  const label = Object.fromEntries(NAV.flatMap(([, items]) => items)); const home = Object.fromEntries(NAV.flatMap(([g, items]) => items.map(([p]) => [p, g])));
  const list = ord.filter((o) => label[o.path]); for (const p of Object.keys(label)) if (!list.some((o) => o.path === p)) list.push({ path: p, group: home[p] }); // pages Alpha doesn't know about yet
  return NAV.map(([g]) => [g, list.filter((o) => o.group === g).map((o) => [o.path, label[o.path]])]);
}
const navFor = () => navList().map(([g, items]) => [g, items.filter(([p]) => memberCan(p) && !planLocked(p))]).filter(([, items]) => items.length);
// the sidebar's Requests link shows how many time-off requests are waiting for this approver
// a page in beta testing (Alpha → Pricing → Plans & features) says so in a banner at the top, instead of a tag in the menu
const BETA_BAR = '<div class="beta-bar" role="status"><span class="beta-pill">Beta</span><span>This page is in beta testing. It works, but it may change and you might run into rough edges. <button type="button" class="link-btn" data-act="feedbackForm">Tell us</button> if something doesn’t look right.</span></div>';
function timeOffBadge() { const a = $('#side a[href="/requests"]'); if (a && D.timeOffWaiting) a.insertAdjacentHTML('beforeend', ` <span class="nav-n" title="Requests waiting for you">${D.timeOffWaiting}</span>`); }
function renderSide(path) {
  $('#side').innerHTML = `<div class="side-nav"><div class="brand">${company.logo ? `<a href="/" data-link class="brand-logo" title="Home"><img src="${esc(company.logo)}" alt="Home"></a>` : brandImg(company.account && company.account.product, 'dark')}<span>${esc(company.name || (company.account && company.account.productName) || 'Worklio Pro')}</span></div>` +
    navFor().map(([g, items]) => `<div class="grp">${g}</div>` + items.map(([p, l]) => `<a href="${p}" data-link class="nav-link ${p === path || (!navPaths.includes(path) && path.startsWith(p + '/')) ? 'on' : ''}">${navIcon(p)}<span class="nav-l">${l}</span></a>`).join('')).join('') + `</div>${themeSwitch()}${me ? `<div class="side-user"><a href="/profile" data-link class="side-user-name${path === '/profile' ? ' on' : ''}" title="My profile (${esc(me.email)})">${avatarHtml(me, 26)}<span>${esc(me.name)}</span></a><button type="button" data-act="logout">Log out</button></div>` : ''}`;
  $('#side').classList.remove('open');
  renderBottomNav(path);
}
// bottom tab bar (phones): the first four main pages this member can open, then More for the full menu
const bico = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const BNAV = [
  ['/business-overview', 'Home', '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>'],
  ['/calendar', 'Calendar', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'],
  ['/quotes', 'Quotes', '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'],
  ['/jobs', 'Jobs', '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'],
  ['/invoices', 'Invoices', '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>'],
  ['/clients', 'Clients', '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>'],
];
// sidebar icons: the phone tab bar's where it has one, so both match; the rest drawn in the same style
const NAV_ICONS = {
  ...Object.fromEntries(BNAV.map(([p, , d]) => [p, d])),
  '/requests': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M10 14l4 4M14 14l-4 4"/>',
  '/payments': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  '/services': '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="8" cy="8" r="1.5"/>',
  '/expenses': '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M21 12h-6a2 2 0 0 0 0 4h6v-4z"/><path d="M3 7h16"/>',
  '/reports': '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-9"/>',
  '/tax-summary': '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  '/reviews': '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  '/social-posts': '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
  '/project-gallery': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  '/notifications': '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
};
// Alpha → Settings → Menu icons can change them (sent with the account info)
const iconOf = (p) => (company.account && company.account.navIcons && company.account.navIcons[p]) || NAV_ICONS[p];
const navIcon = (p) => (iconOf(p) ? `<span class="nav-ic">${bico(iconOf(p))}</span>` : '<span class="nav-ic"></span>');
function renderBottomNav(path) {
  const items = BNAV.filter(([p]) => memberCan(p) && !planLocked(p)).slice(0, 4);
  $('#bnav').innerHTML = items.map(([p, l, d]) => { const on = p === path || (!navPaths.includes(path) && path.startsWith(p + '/')); return `<a href="${p}" data-link class="${on ? 'on' : ''}"${on ? ' aria-current="page"' : ''}>${bico(iconOf(p) || d)}<span>${l}</span></a>`; }).join('')
    + `<button type="button" data-act="toggleSide" aria-label="More menu" aria-expanded="false">${bico('<path d="M4 6h16M4 12h16M4 18h16"/>')}<span>More</span></button>`;
}
/* ===== top bar: feature search, help panel, settings (gear) menu ===== */
const svgIcon = (d, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.3-2.4 3.9"/><path d="M12 17.2h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  feedback: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v4M12 14h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  forum: '<path d="M17 9a6 6 0 0 0-11.5-2.4A5 5 0 0 0 3 15.3L2 19l3.7-1A6 6 0 0 0 17 9z"/><path d="M14 18.6A6 6 0 0 0 22 13a5 5 0 0 0-2.5-4.3"/>',
};
// Refer & Earn shows while the platform's referral program is on
const referralsOn = () => !!(company.account && company.account.referrals);
// App Marketplace shows unless Alpha turned it off
const marketplaceOn = () => !(company.account && company.account.marketplace === false);
const settingsFor = () => SETTINGS_NAV.filter(([p]) => memberCan(p) && !planLocked(p) && (p !== '/rewards' || referralsOn()) && (p !== '/marketplace' || marketplaceOn()));
// pages the search finds besides the menu items, and extra words each page answers to
const FEATURE_EXTRAS = [['/quotes/new', 'New quote', 'Quotes', 'create estimate'], ['/jobs/new', 'New job', 'Jobs', 'create schedule visit'], ['/invoices/new', 'New invoice', 'Invoices', 'create bill'],
  ['/clients/import', 'Import clients', 'Clients', 'csv upload spreadsheet'], ['/team/new', 'Add team member', 'Settings', 'invite staff employee user'],
  ['/payments/settings', 'Payment settings', 'Money', 'card online payouts processing rates disputes'], ['/profile', 'My profile', 'Account', 'password photo name email login'], ['/forum', 'Forum', 'Account', 'community ideas suggestions feature requests issues bugs vote']];
const FEATURE_WORDS = {
  '/business-overview': 'dashboard overview', '/calendar': 'schedule schedules appointments visits tasks events job calendar', '/clients': 'customers contacts',
  '/quotes': 'estimates proposals', '/jobs': 'work orders visits', '/invoices': 'billing', '/payments': 'card online stripe', '/services': 'catalog products price list items',
  '/expenses': 'costs receipts spending', '/reports': 'revenue profit charts', '/tax-summary': 'sales tax', '/project-gallery': 'photos pictures', '/reviews': 'google reviews ratings stars reply', '/social-posts': 'facebook instagram social media post marketing', '/notifications': 'emails texts sms sent messages log',
  '/requests': 'time off day off vacation sick leave request approve', '/settings/roles': 'roles permissions access manager technician what team can see do', '/settings/company': 'business details logo address phone social media facebook instagram tiktok tax', '/team': 'staff employees users access roles technicians', '/settings/emails': 'templates text messages sms reminders',
  '/settings': 'number prefixes branding brand color zelle defaults stripe card payments online payments regional time zone date format time format week', '/settings/connections': 'integrations google facebook instagram ai', '/marketplace': 'apps integrations connect quickbooks xero accounting home depot lowes supplies materials zapier chatgpt claude ai automation calendar slack gusto payroll', '/settings/billing': 'subscription plan upgrade payment method', '/settings/support-access': 'grant revoke help troubleshoot permission',
};
const featureList = () => {
  const open = (p) => PAGES[p] && memberCan(p) && !planLocked(p) && !planLocked(p.split('/').slice(0, 2).join('/')) && (p !== '/forum' || !!(company.account && company.account.forum));
  return [...navFor().flatMap(([g, items]) => items.map(([p, l]) => [p, l, g])), ...settingsFor().map(([p, l]) => [p, l, 'Settings']), ...FEATURE_EXTRAS.filter(([p]) => open(p))]
    .map(([p, l, g, k]) => ({ p, l, g, words: `${l} ${g} ${k || ''} ${FEATURE_WORDS[p] || ''}`.toLowerCase() }));
};
function searchFeatures(q) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean); if (!terms.length) return [];
  const rank = (f) => (f.l.toLowerCase().startsWith(terms[0]) ? 0 : f.l.toLowerCase().includes(terms[0]) ? 1 : 2);
  return featureList().filter((f) => terms.every((t) => f.words.includes(t))).sort((a, b) => rank(a) - rank(b)).slice(0, 8);
}
function buildTopbar() {
  // phones: the company logo (or name) in place of the search box
  $('#topbar').innerHTML = `<a href="/" data-link class="tb-logo" title="Home">${company.logo ? `<img src="${esc(company.logo)}" alt="${esc(company.name || 'Home')}">` : `<span>${esc(company.name || 'Home')}</span>`}</a><div class="tb-search" role="search">${svgIcon(ICONS.search, 18)}<input id="featSearch" type="search" placeholder="Press / to search" autocomplete="off" spellcheck="false" aria-label="Search features" role="combobox" aria-autocomplete="list" aria-controls="featResults" aria-expanded="false"><div id="featResults" class="tb-results" role="listbox" hidden></div></div>
<a class="tb-fb tb-ref" href="/rewards" data-link title="Refer other businesses and earn free months" hidden>${svgIcon(ICONS.gift, 18)}<span>Refer &amp; earn</span></a><a class="tb-fb tb-forum" href="/forum" data-link title="Suggest features and report issues, with other businesses" hidden>${svgIcon(ICONS.forum, 18)}<span>Forum</span></a><button type="button" class="tb-fb" data-act="feedbackForm" title="Send feedback about the app">${svgIcon(ICONS.feedback, 18)}<span>Feedback</span></button>
<button type="button" class="tb-icon" data-act="openHelp" title="Help and support" aria-label="Help and support">${svgIcon(ICONS.help)}</button>
<details class="menu tb-gear"><summary class="tb-icon" title="Settings" aria-label="Settings">${svgIcon(ICONS.gear)}</summary><div class="menu-list" id="gearMenu"></div></details>`;
  const input = $('#featSearch'); const box = $('#featResults'); let hits = []; let sel = 0;
  const show = () => {
    hits = searchFeatures(input.value); sel = 0;
    box.hidden = !input.value.trim(); input.setAttribute('aria-expanded', !box.hidden);
    box.innerHTML = hits.length ? hits.map((f, i) => `<a href="${f.p}" data-link role="option" id="fr${i}" class="${i === sel ? 'act' : ''}"><span>${esc(f.l)}</span><span class="muted">${esc(f.g)}</span></a>`).join('')
      : `<div class="tb-none muted">No features match “${esc(input.value.trim())}”</div>`;
  };
  const mark = () => { $$('a', box).forEach((a, i) => a.classList.toggle('act', i === sel)); input.setAttribute('aria-activedescendant', hits.length ? 'fr' + sel : ''); };
  input.addEventListener('input', show);
  input.addEventListener('focus', () => { if (input.value.trim()) show(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (hits.length) { sel = (sel + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length; mark(); } }
    else if (e.key === 'Enter' && hits[sel]) { e.preventDefault(); navigate(hits[sel].p); }
    else if (e.key === 'Escape') { e.stopPropagation(); if (input.value) { input.value = ''; show(); } else input.blur(); }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.tb-search')) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); } });
}
function renderTopbar(path) {
  if (!$('#featSearch')) buildTopbar();
  const input = $('#featSearch'); input.value = ''; input.blur(); $('#featResults').hidden = true; input.setAttribute('aria-expanded', 'false');
  const items = settingsFor(); const gear = $('.tb-gear'); gear.open = false; gear.hidden = !items.length;
  $('.tb-ref').hidden = !(referralsOn() && memberCan('/rewards'));
  const fo = $('.tb-forum'); fo.hidden = !(isAdminMe() && company.account && company.account.forum); fo.classList.toggle('on', path === '/forum'); // owners and admins, while the forum is open
  const isOn = (p) => p === path || (!navPaths.includes(path) && path.startsWith(p + '/'));
  $('summary', gear).classList.toggle('on', items.some(([p]) => isOn(p)));
  $('#gearMenu').innerHTML = '<div class="menu-h">Settings</div>' + items.map(([p, l]) => `<a href="${p}" data-link class="${isOn(p) ? 'on' : ''}">${l}</a>`).join('');
}
// short how-to guides shown in the help panel; each step can link to the page it mentions
const HELP_TOPICS = [
  { id: 'start', hc: 'get-started', title: 'Get Started', blurb: 'Set up your business details, branding and team so you’re ready to send your first quote.', steps: [
    ['Add your business name, address, logo and social media.', '/settings/company', 'Company Profile'],
    ['Set your time zone, number prefixes and branding defaults.', '/settings', 'App Settings'],
    ['Add your products and services so quotes and invoices fill in prices for you.', '/services', 'Products & Services'],
    ['Invite your team and choose what each person can access.', '/team', 'Manage Team']] },
  { id: 'schedule', hc: 'schedule', title: 'Schedule', blurb: 'Plan jobs on the calendar, assign team members and keep track of who’s working when.', steps: [
    ['Open the calendar and click a time to schedule a job, task or event.', '/calendar', 'Calendar'],
    ['Assign team members to a job from the job page.', '/jobs', 'Jobs'],
    ['Set each team member’s working hours.', '/team', 'Manage Team']] },
  { id: 'work', hc: 'work', title: 'Work', blurb: 'Every step of your workflow: quotes, jobs, invoices, payments and expenses.', steps: [
    ['Create a quote and send it to your client to approve.', '/quotes/new', 'New quote'],
    ['Turn approved work into a scheduled job.', '/jobs', 'Jobs'],
    ['Create an invoice from a finished job, or start one from scratch.', '/invoices/new', 'New invoice'],
    ['See the payments your clients have made.', '/payments', 'Payments'],
    ['Log what you spend on materials and running the business.', '/expenses', 'Expenses']] },
  { id: 'clients', hc: 'clients', title: 'Clients', blurb: 'Manage your clients and the messages you send them, including email templates and text messages.', steps: [
    ['Add clients one at a time or see everyone in one list.', '/clients', 'Clients'],
    ['Bring in an existing client list from a CSV file.', '/clients/import', 'Import clients'],
    ['Edit the emails and texts clients receive.', '/settings/emails', 'Email Templates'],
    ['See every email and text that was sent.', '/notifications', 'Notifications Log']] },
];
const helpOpen = () => $('#helpPanel').classList.contains('open');
function helpView(topicId) {
  const a = company.account || {}; const product = a.productName || 'Worklio Pro';
  const topic = HELP_TOPICS.find((t) => t.id === topicId);
  const head = `<div class="hp-head">${topic ? `<button type="button" class="tb-icon" data-act="helpTopic" data-id="" aria-label="Back">${svgIcon(ICONS.back)}</button>` : ''}<h2 id="helpTitle">${topic ? esc(topic.title) : 'Need a hand?'}</h2><button type="button" class="tb-icon" data-act="closeHelp" aria-label="Close help">${svgIcon(ICONS.close)}</button></div>`;
  let body;
  if (topic) {
    const steps = topic.steps.filter(([, p]) => !p || (memberCan(p) && !planLocked(p)));
    body = `<p class="hp-lead">${esc(topic.blurb)}</p><ol class="hp-steps">${steps.map(([t, p, l]) => `<li>${esc(t)}${p ? ` <a href="${p}" data-link>${esc(l)} →</a>` : ''}</li>`).join('')}</ol>${a.helpUrl ? `<a class="btn alt hp-wide" href="${esc(a.helpUrl)}/topics/${topic.hc}" target="_blank" rel="noopener">${svgIcon(ICONS.book, 18)} More in the Help Center</a>` : ''}`;
  } else {
    const topics = HELP_TOPICS.filter((t) => t.steps.some(([, p]) => memberCan(p) && !planLocked(p)));
    body = `${a.helpUrl ? `<a class="btn alt hp-wide" href="${esc(a.helpUrl)}" target="_blank" rel="noopener">${svgIcon(ICONS.help, 18)} Visit Help Center</a>` : `<button type="button" class="btn alt hp-wide" data-act="focusSearch">${svgIcon(ICONS.search, 18)} Search features</button>`}
<button type="button" class="btn alt hp-wide hp-tour" data-act="startTour">${svgIcon(ICONS.compass, 18)} Take a tour of the app</button>
<div class="hp-grp">Recommendations</div>
${topics.map((t) => `<button type="button" class="hp-topic" data-act="helpTopic" data-id="${t.id}"><strong>${esc(t.title)}</strong><span>${esc(t.blurb)}</span></button>`).join('')}`;
  }
  const foot = `<div class="hp-foot">
<div class="hp-link">${svgIcon(ICONS.user, 18)}<span>${esc(company.name || product)}${a.plan ? ` · ${esc(a.plan.name)} plan` : ''}</span></div>
${memberCan('/settings/support-access') ? `<a class="hp-link hp-nav" href="/settings/support-access" data-link>${svgIcon(ICONS.shield, 18)}<span>Support Access</span></a>` : ''}
<button type="button" class="btn hp-wide" data-act="supportForm">${svgIcon(ICONS.chat, 18)} Get Support</button><p class="muted hp-note">Send us a message and we’ll reply by email.</p><p class="hp-legal"><a href="/terms" target="_blank" rel="noopener">Terms of Service</a> · <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a></p>
</div>`;
  return head + `<div class="hp-body">${body}</div>` + foot;
}
function openHelp(topicId) {
  const p = $('#helpPanel'); p.innerHTML = helpView(topicId);
  p.classList.add('open'); p.setAttribute('aria-hidden', 'false'); $('#helpShade').hidden = false;
  const g = $('.tb-gear'); if (g) g.open = false;
  const f = $('.hp-head .tb-icon', p); if (f) f.focus();
}
function closeHelp() {
  if (!helpOpen()) return;
  const p = $('#helpPanel'); p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); $('#helpShade').hidden = true;
  const b = $('[data-act=openHelp]'); if (b) b.focus();
}
$('#helpShade').addEventListener('click', closeHelp);
const SUPPORT_TOPICS = ['Something isn’t working', 'How do I…?', 'Account and billing', 'Feature request', 'Other'];
// "Get Support": a contact form in a popup; the message goes to the platform's support inbox with the account details attached
// opts: title for the popup, and a topic to start with (e.g. "Account and billing" from the billing page)
function supportForm(opts = {}) {
  const page = location.href; closeHelp();
  const body = modal(opts.title || 'Contact support', `<form class="support-form" data-sticky>
<p class="muted" style="margin:0 0 14px">Tell us what you need help with and we’ll reply by email. Your business name, plan and the page you’re on are included for you.</p>
<div class="row"><label>Your name<input name="name" value="${esc(me ? me.name : '')}" readonly></label><label>Email for our reply<input name="email" type="email" required maxlength="200" value="${esc(me ? me.email : '')}"></label></div>
<div class="row"><label>Phone (optional)<input name="phone" type="tel" maxlength="40" value=""></label><label>Topic<select name="topic">${SUPPORT_TOPICS.map((t) => `<option ${t === opts.topic ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>
<label>Subject<input name="subject" maxlength="150" placeholder="A few words about the problem or question"></label>
<label>Message<textarea name="message" rows="6" maxlength="4000" required placeholder="What happened, what you expected, and the steps to see it"></textarea></label>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn" type="submit">Send message</button></div></form>`);
  const form = $('form', body); phoneMask($('[name=phone]', form)); $('[name=message]', form).focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('[type=submit]', form); btn.disabled = true; btn.textContent = 'Sending…';
    const f = Object.fromEntries(new FormData(form));
    try { await api('POST', '/api/support', { ...f, page }); }
    catch (err) { btn.disabled = false; btn.textContent = 'Send message'; throw err; }
    body.innerHTML = `<div class="support-sent"><h2>Message sent</h2><p class="muted">Thanks, ${esc((f.name || '').split(' ')[0] || 'we got it')}. We’ll reply to ${esc(f.email)} as soon as we can.</p><div class="foot"><button type="button" class="btn" data-act="closeModal">Done</button></div></div>`;
  });
}
// "Feedback" in the top bar: a 1–5 rating, what kind of feedback, and a message; goes to the platform console (User feedback) with the account and page attached
const FEEDBACK_KINDS = ['Idea or suggestion', 'Something isn’t working', 'Something I like', 'Other'];
const FEEDBACK_FACES = [['1', '😞', 'Very unhappy'], ['2', '🙁', 'Unhappy'], ['3', '😐', 'Okay'], ['4', '🙂', 'Happy'], ['5', '😍', 'Love it']];
function feedbackForm() {
  const page = location.href; closeHelp();
  const product = (company.account && company.account.productName) || 'the app';
  const body = modal('Send feedback', `<form class="fb-form" data-sticky>
<p class="muted" style="margin:0 0 14px">Tell us what’s working and what isn’t. Every message is read by the people who build ${esc(product)}.</p>
<fieldset class="fb-rate"><legend>How do you feel about ${esc(product)}?</legend><div>${FEEDBACK_FACES.map(([v, f, l]) => `<label title="${l}"><input type="radio" name="rating" value="${v}"><span aria-hidden="true">${f}</span><small>${l}</small></label>`).join('')}</div></fieldset>
<label>What’s it about?<select name="kind">${FEEDBACK_KINDS.map((k) => `<option>${esc(k)}</option>`).join('')}</select></label>
<label>Your feedback<textarea name="message" rows="5" maxlength="4000" placeholder="What would make your day easier? What got in your way?"></textarea></label>
<label class="fb-check"><input type="checkbox" name="contactOk" checked> You can email me at ${esc(me ? me.email : 'my login email')} about this</label>
<div class="fb-err" role="alert" hidden></div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn" type="submit">Send feedback</button></div></form>`);
  const form = $('form', body);
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(form)); const err = $('.fb-err', form);
    if (!f.rating && !String(f.message || '').trim()) { err.hidden = false; err.textContent = 'Pick a face or write a few words first.'; return; }
    const btn = $('[type=submit]', form); btn.disabled = true; btn.textContent = 'Sending…';
    try { await api('POST', '/api/feedback', { ...f, contactOk: !!f.contactOk, page }); }
    catch (x) { btn.disabled = false; btn.textContent = 'Send feedback'; throw x; }
    body.innerHTML = `<div class="support-sent"><div style="font-size:40px" aria-hidden="true">🙏</div><h2>Thanks for the feedback!</h2><p class="muted">It helps us decide what to improve next.</p><div class="foot"><button type="button" class="btn" data-act="closeModal">Done</button></div></div>`;
  });
}
// "/" (or Ctrl/⌘ K) jumps to the search box from anywhere except while typing
document.addEventListener('keydown', (e) => {
  const typing = e.target.closest('input, textarea, select, [contenteditable]');
  if (((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) && $('#featSearch') && $('#topbar').style.display !== 'none' && !$('#overlay')) { e.preventDefault(); closeHelp(); $('#featSearch').focus(); }
  if (e.key === 'Escape') closeHelp();
});
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
  if (path === '/time-off') { history.replaceState({}, '', '/requests'); return render(); } // the page's old address (links in earlier emails)
  if (path === '/staff-schedules') { history.replaceState({}, '', '/calendar'); return render(); } // Schedules became Calendar
  if (path === '/') { const start = memberCan('/business-overview') ? '/business-overview' : (navPaths.find((p) => memberCan(p) && !planLocked(p)) || '/profile'); history.replaceState({}, '', start); return render(); }
  const main = $('#main');
  const portal = path === '/client-portal' && new URLSearchParams(location.search).get('c');
  try { company = await api('GET', '/api/company'); } catch (e) { /* ignore */ }
  updateAppIcon();
  document.documentElement.style.setProperty('--brand', company.brandColor || '#2563eb');
  $('#side').style.display = portal ? 'none' : ''; $('#menuBtn').style.display = portal ? 'none' : ''; $('#bnav').style.display = portal ? 'none' : ''; $('#topbar').style.display = portal ? 'none' : '';
  closeHelp();
  main.className = portal ? 'portal' : '';
  showTheme(portal ? 'light' : getTheme()); // clients always see their portal in light mode
  const page = PAGES[path];
  permClasses();
  if (!portal) { renderSide(path); renderTopbar(path); }
  const sb = $('#supportBar'); sb.hidden = portal || !(me && me.support);
  if (!sb.hidden) sb.innerHTML = `${svgIcon(ICONS.shield, 18)}<span><strong>Support session.</strong> ${esc(me.support.adminName)} from ${esc((company.account && company.account.productName) || 'support')} is signed in as ${esc(me.name)} with the owner’s Support Access. It ends ${new Date(me.support.expires).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.</span><button type="button" class="btn alt sm" data-act="logout">End session</button>`;
  // the account's last day of access is near (set by the platform): owners and admins see it, owners can choose a plan
  const xb = $('#expiryBar'); const xp = !portal && company.account && company.account.expiry; const pz = !portal && pausedNow() && company.account.paused;
  xb.hidden = !((pz || (xp && xp.banner)) && isAdminMe());
  if (!xb.hidden && pz) { const m = pausedMsg(pz);
    xb.innerHTML = `<span><strong>${m.title}.</strong> ${m.text} Until then you can look around, but you can’t create, change or delete anything.</span>${m.btn && path !== '/settings/billing' ? `<a class="btn sm" href="/settings/billing" data-link>${m.btn}</a>` : ''}`; }
  else if (!xb.hidden) { const owner = role() === 'owner'; const ce = company.account.contactEmail;
    xb.innerHTML = `<span><strong>${xp.daysLeft < 0 ? 'Your access has ended.' : xp.prepaid ? `Your prepaid months end ${esc(xp.when)}${xp.daysLeft > 1 ? ` (${xp.daysLeft} days left)` : ''}.` : xp.trial ? `Your free trial ends ${esc(xp.when)}${xp.daysLeft > 1 ? ` (${xp.daysLeft} days left)` : ''}.` : `Your access to ${esc(company.account.productName)} ends ${esc(xp.when)}${xp.daysLeft > 1 ? ` (${xp.daysLeft} days left)` : ''}.`}</strong> ${owner ? (xp.trial ? 'Add a card to keep your account.' : 'Choose a plan to keep your account.') : 'Ask your account owner to choose a plan.'}${ce ? ` Questions? <a href="mailto:${esc(ce)}">${esc(ce)}</a>` : ''}</span>${owner && path !== '/settings/billing' ? `<a class="btn sm" href="/settings/billing" data-link>${xp.trial ? 'Add a card' : 'Choose a plan'}</a>` : ''}`; }
  if (pausedNow() && !portal && !isAdminMe()) { document.title = 'Account paused'; main.innerHTML = `<div class="card paused-card">${svgIcon(ICONS.shield, 28)}<h1>Your company’s account is paused</h1><p class="muted">You can’t use ${esc(company.name || 'your company')}’s account right now. Contact your company owner or admin to get it running again.</p></div>`; return; }
  if (pausedNow() && !portal && isAdminMe() && /\/(new|edit|import)$/.test(path)) { toast('Your account is paused. Choose a plan to make changes again.', true); history.replaceState({}, '', '/settings/billing'); return render(); }
  if (page && !memberCan(path)) { document.title = 'No access'; main.innerHTML = `<div class="card"><h1>You don't have access to this page</h1><p class="muted">Your access level doesn't include this page. Ask the account owner if you need more access.</p><p><a href="/calendar" data-link>Go to the job calendar</a></p></div>`; return; }
  if (page && planLocked(path)) { document.title = page.title; main.innerHTML = `<div class="card upgrade-card"><h1>${esc(page.title)} isn’t in your plan</h1><p class="muted">You’re on the ${esc(company.account.plan.name)} plan. Upgrade to get ${esc(page.title)} and more.</p><p><a href="/settings" data-link class="btn alt">See your plan</a></p></div>`; return; }
  if (!page) { document.title = 'Not found'; main.innerHTML = '<div class="card"><h1>Page not found</h1><p><a href="/business-overview" data-link>Go to dashboard</a></p></div>'; return; }
  document.title = `${page.title} · ${company.name || (company.account && company.account.productName) || 'Worklio Pro'}`;
  try { D = portal ? {} : await loadAll(); timeOffBadge(); await page.render(main); if (betaPage(path)) main.insertAdjacentHTML('afterbegin', BETA_BAR); }
  catch (e) { main.innerHTML = `<div class="card"><h2>Something went wrong</h2><p>${esc(e.message)}</p></div>`; }
  if (!portal && me && me.tourNew && !pausedNow() && typeof startTour === 'function') startTour(); // a new login's first visit (public/tour.js)
}
window.addEventListener('popstate', render);

const A = {}; // click actions
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-link]');
  if (link) { e.preventDefault(); if (link.closest('#overlay')) closeModal(); navigate(link.getAttribute('href')); return; } // a link in a popup closes it
  const el = e.target.closest('[data-act]');
  if (!el) return;
  e.preventDefault();
  if (el.closest('details.menu .menu-list')) el.closest('details.menu').open = false; // a menu item closes its menu
  const fn = A[el.dataset.act];
  if (fn) Promise.resolve(fn(el.dataset, el)).catch((err) => toast(err.message, true));
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
$('#menuBtn').addEventListener('click', () => $('#side').classList.toggle('open'));
A.toggleSide = (d, el) => { const open = $('#side').classList.toggle('open'); el.setAttribute('aria-expanded', open); };
// tapping outside the open menu drawer closes it
document.addEventListener('click', (e) => { const side = $('#side'); if (side.classList.contains('open') && !e.target.closest('#side, #menuBtn, [data-act="toggleSide"]')) { side.classList.remove('open'); const b = $('#bnav [data-act="toggleSide"]'); if (b) b.setAttribute('aria-expanded', 'false'); } });
// form submit handlers are async: show any save error (e.g. "Another invoice already uses number …") instead of failing silently
window.addEventListener('unhandledrejection', (e) => { if (e.reason && e.reason.message) { toast(e.reason.message, true); e.preventDefault(); } });
A.closeModal = closeModal;
// ⋯ menus close when you click anywhere else
document.addEventListener('click', (e) => $$('details.menu[open]').forEach((m) => { if (!m.contains(e.target)) m.open = false; }));
A.logout = async () => { await api('POST', '/api/auth/logout', {}); location.href = '/login'; };
A.openHelp = () => openHelp();
A.feedbackForm = () => feedbackForm();
A.closeHelp = closeHelp;
A.helpTopic = (d) => openHelp(d.id);
A.supportForm = (d) => supportForm({ title: d.title, topic: d.topic });
A.focusSearch = () => { closeHelp(); $('#featSearch').focus(); };
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
// line items reorder by dragging the dotted handle on the left (mouse or touch), or with the arrow keys while it has focus
const DRAG_DOTS = '<svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true"><circle cx="3" cy="3" r="1.6"/><circle cx="9" cy="3" r="1.6"/><circle cx="3" cy="9" r="1.6"/><circle cx="9" cy="9" r="1.6"/><circle cx="3" cy="15" r="1.6"/><circle cx="9" cy="15" r="1.6"/></svg>';
const flashRow = (row) => { row.classList.remove('moved'); void row.offsetWidth; row.classList.add('moved'); }; // brief highlight so it's clear what moved
document.addEventListener('pointerdown', (e) => {
  const h = e.target.closest('.item-row .drag-h'); if (!h || e.button !== 0) return;
  e.preventDefault(); const row = h.closest('.item-row'); const list = row.parentElement; const start = row.nextElementSibling;
  row.classList.add('dragging'); document.body.classList.add('row-drag'); h.setPointerCapture(e.pointerId);
  const move = (ev) => { // put the row before the first other row whose middle is below the pointer
    const next = [...list.children].filter((r) => r !== row).find((r) => { const b = r.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
    if ((next || null) !== row.nextElementSibling) list.insertBefore(row, next || null);
    if (ev.clientY < 60) window.scrollBy(0, -12); else if (ev.clientY > innerHeight - 60) window.scrollBy(0, 12);
  };
  const end = () => {
    h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', end); h.removeEventListener('pointercancel', end);
    row.classList.remove('dragging'); document.body.classList.remove('row-drag');
    if (row.nextElementSibling !== start) { flashRow(row); recalc(row.closest('form')); }
  };
  h.addEventListener('pointermove', move); h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
});
document.addEventListener('keydown', (e) => {
  const h = e.target.closest('.item-row .drag-h'); if (!h || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault(); const row = h.closest('.item-row'); const other = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
  if (!other) return;
  if (e.key === 'ArrowUp') other.before(row); else other.after(row);
  h.focus(); flashRow(row); recalc(row.closest('form'));
});
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
// Subtotal / Discount / Tax / Total rows (layout modeled on Jobber's): discount and tax are optional; without one, its row is an "Add …" link.
// The trash button on the tax row clears the rate (no tax); Add Tax fills in the company's default rate.
const totalsRows = (d) => { const rate = Number(d.taxRate ?? company.taxRate ?? 0); const on = rate > 0; return `<div class="tl"><span>Subtotal</span><span></span><span class="t-sub"></span><span></span></div>
${optRow({ label: 'Discount', name: 'discount', value: d.discountValue, type: d.discountType, pctLabel: '%' })}
<div class="tl opt-row"><span>Tax</span><span class="opt-edit" ${on ? '' : 'hidden'}><span class="unit tax-in"><input name="taxRate" type="number" step="any" min="0" value="${on ? esc(rate) : ''}" placeholder="0" aria-label="Tax rate"><span>%</span></span></span>
<span class="opt-amt" ${on ? '' : 'hidden'}><span class="t-tax"></span></span><button type="button" class="link-btn opt-add" data-act="addOpt" data-fill="${Number(company.taxRate) > 0 ? esc(company.taxRate) : ''}" ${on ? 'hidden' : ''}>Add Tax</button>
<span class="t-rm-c"><button type="button" class="t-rm" data-act="rmOpt" aria-label="Remove tax" title="Remove tax" ${on ? '' : 'hidden'}>${TRASH}</button></span></div>
<div class="tl grand"><strong>Total</strong><span></span><strong class="t-total"></strong><span></span></div>`; };
// an optional amount row (discount, deposit): "Add …" link until used, then amount + $/% picker + computed value + trash button.
// Inputs are named ${name}Value / ${name}Type; recalc fills .t-${name}.
const optRow = ({ label, name, value, type, pctLabel }) => { const on = Number(value) > 0; return `<div class="tl opt-row"><span>${label}</span><span class="opt-edit" ${on ? '' : 'hidden'}><span class="unit"><input name="${name}Value" type="number" step="any" min="0" value="${on ? esc(value) : ''}" placeholder="0" aria-label="${label} amount">
<select name="${name}Type" aria-label="${label} type"><option value="flat" ${type !== 'percent' ? 'selected' : ''}>$</option><option value="percent" ${type === 'percent' ? 'selected' : ''}>${pctLabel}</option></select></span></span>
<span class="opt-amt" ${on ? '' : 'hidden'}><span class="t-${name}"></span></span><button type="button" class="link-btn opt-add" data-act="addOpt" ${on ? 'hidden' : ''}>Add ${label}</button>
<span class="t-rm-c"><button type="button" class="t-rm" data-act="rmOpt" aria-label="Remove ${label.toLowerCase()}" title="Remove ${label.toLowerCase()}" ${on ? '' : 'hidden'}>${TRASH}</button></span></div>`; };
const TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>';
// invoice: take the quote deposit credit off this invoice (or put it back); saved with the invoice
const setDepCredit = (el, removed) => { const form = el.closest('form'); $('[name=depositCreditRemoved]', form).value = removed ? 'yes' : ''; recalc(form); };
A.applyDepCredit = (d, el) => setDepCredit(el, false);
A.addOpt = (d, el) => {
  const row = el.closest('.tl'); const input = $('.opt-edit input', row); el.hidden = true; $('.opt-edit', row).hidden = false; $('.opt-amt', row).hidden = false; $('.t-rm', row).hidden = false;
  if (!input.value && d.fill) { input.value = d.fill; recalc(el.closest('form')); } // tax: the company's default rate
  input.focus();
};
A.rmOpt = (d, el) => { const row = el.closest('.tl'); $('.opt-edit input', row).value = ''; $('.opt-edit', row).hidden = true; $('.opt-amt', row).hidden = true; el.hidden = true; $('.opt-add', row).hidden = false; recalc(el.closest('form')); };

/* ===== send dialog ===== */
function sendDialog(kind, doc, only) { // only: 'email' | 'sms' ticks just that channel; 'text' sends a text message and nothing else
  const c = byId(D.clients, doc.clientId) || {};
  if (only === 'text') return textDialog(kind, doc, c);
  if (only === 'email') return emailDialog(kind, doc, c);
  const mb = modal(`Send ${kind} ${doc.number}`, `<p>To <strong>${esc(c.name)}</strong></p>
<form><div class="chk"><label><input type="checkbox" name="ch" value="email" ${only === 'sms' ? '' : 'checked'}> Email ${c.email ? `(${esc(c.email)})` : '<span class="muted">(no email on file)</span>'}</label>
${planHas('sms') ? `<label><input type="checkbox" name="ch" value="sms" ${c.phone && c.smsConsent ? (only === 'sms' ? 'checked' : '') : 'disabled'}> Text message ${!c.phone ? '<span class="muted">(no phone on file)</span>' : c.smsConsent ? `(${esc(c.phone)})` : '<span class="muted">(hasn’t agreed to texts)</span>'}</label>` : ''}</div>
<p class="muted">The client gets a link to ${kind === 'invoice' ? 'view and pay this invoice online' : 'view and approve this quote'}. Every message is recorded in the Notifications Log.</p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Send</button></div></form>`);
  return sendSubmit(kind, doc, mb, () => $$('[name=ch]:checked', mb).map((x) => x.value));
}
// Email (More → Send as… → Email): To, subject and message start from the email template; a copy to yourself; attachments
// (files up to 10 MB in all, and the quote / invoice as a PDF). The server puts the template's button under the message (emailDoc in server.js).
const EMAIL_FILES_MAX = 10 * 1024 * 1024;
const fileIco = (pdf) => `<span class="em-ic${pdf ? ' pdf' : ''}">${QI(pdf ? '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>' : '<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>')}</span>`;
const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
function emailDialog(kind, doc, c) {
  const word = kind === 'invoice' ? 'invoice' : 'quote'; let files = []; let typed = false;
  const mb = modal(`Email ${word} #${doc.number} to ${c.name || 'the client'}`, `<form class="em-form" data-sticky novalidate><div class="em-grid"><div class="em-main">
<label class="fl"><span>To</span><input name="to" value="${esc(c.email || '')}" placeholder="Email address (separate several with commas)" autocomplete="off"></label>
<label class="fl"><span>Subject</span><input name="subject" maxlength="200" placeholder="Loading…"></label>
<label class="fl"><span>Message</span><textarea name="message" rows="11" placeholder="Loading…"></textarea></label>
<p class="muted em-note">Under your message, your client sees a button to ${kind === 'invoice' ? 'view and pay this invoice online' : 'view and approve this quote online'}.</p>
<label class="em-copy" hidden><input type="checkbox" name="copy"> Send me a copy <span class="muted em-me"></span></label></div>
<div class="em-side"><h3>Attachments</h3>
<div class="em-drop"><button type="button" class="btn alt sm em-pick">Select</button><span>Select or drag files here to upload</span><input type="file" multiple hidden></div>
<p class="em-use"></p><div class="em-bar"><i></i></div>
<div class="em-files"><label class="em-file"><input type="checkbox" name="pdf">${fileIco(true)}<span><b>${esc(word)}_${esc(String(doc.number).replace(/[^\w-]+/g, ''))}.pdf</b><small><a href="/api/${kind}s/${doc.id}/pdf" target="_blank">Preview</a></small></span></label><div class="em-up"></div></div></div></div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Send Email</button></div></form>`, true);
  const f = $('form', mb); const picker = $('input[type=file]', mb); const drop = $('.em-drop', mb);
  f.message.addEventListener('input', () => { typed = true; }); f.subject.addEventListener('input', () => { typed = true; });
  api('GET', `/api/${kind}s/${doc.id}/email-draft`).then((r) => {
    if (!typed) { f.subject.value = r.subject; f.message.value = r.message; } f.subject.placeholder = ''; f.message.placeholder = '';
    if (r.me) { $('.em-me', mb).textContent = `(${r.me})`; $('.em-copy', mb).hidden = false; }
  }).catch((x) => toast(x.message, true));
  const total = () => files.reduce((n, x) => n + x.size, 0);
  const draw = () => {
    $('.em-up', mb).innerHTML = files.map((x, i) => `<div class="em-file">${fileIco(false)}<span><b>${esc(x.name)}</b><small>${fmtSize(x.size)}</small></span><button type="button" class="icon-btn em-x" data-i="${i}" aria-label="Remove ${esc(x.name)}" title="Remove">${X_ICO}</button></div>`).join('');
    $('.em-use', mb).textContent = `You’ve attached ${(total() / 1048576).toFixed(2)} MB of the 10.00 MB limit.`;
    $('.em-bar i', mb).style.width = Math.min(100, total() / EMAIL_FILES_MAX * 100) + '%';
  };
  const add = (list) => [...list].forEach((file) => {
    if (total() + file.size > EMAIL_FILES_MAX) return toast(`${file.name} doesn’t fit in the 10 MB limit`, true);
    const rd = new FileReader();
    rd.onload = () => { files.push({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: String(rd.result).split(',')[1] || '' }); draw(); };
    rd.onerror = () => toast(`Couldn’t read ${file.name}`, true); rd.readAsDataURL(file);
  });
  $('.em-pick', mb).addEventListener('click', () => picker.click());
  picker.addEventListener('change', () => { add(picker.files); picker.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); add(e.dataTransfer.files); });
  $('.em-up', mb).addEventListener('click', (e) => { const b = e.target.closest('.em-x'); if (b) { files.splice(Number(b.dataset.i), 1); draw(); } });
  draw();
  return sendSubmit(kind, doc, mb, () => ['email'], () => {
    if (!f.message.value.trim()) throw new Error('Write a message first');
    return { email: { to: f.to.value, subject: f.subject.value, message: f.message.value, copy: f.copy.checked, pdf: f.pdf.checked, files: files.map(({ name, type, data }) => ({ name, type, data })) } };
  });
}
// Send Text (the button beside More): the client's mobile number, a message to edit and a preview of the text as it arrives,
// with the link and opt-out the server adds (smsWithLink in server.js). Texts only go to a client who agreed to them.
const TEXT_MAX = 160;
function textDialog(kind, doc, c) {
  const word = kind === 'invoice' ? 'invoice' : 'quote'; const co = company.name || '';
  const label = kind === 'invoice' ? 'View and pay your invoice here' : 'View your quote here';
  const why = !c.phone ? 'There’s no mobile number on file for this client. Add one on their client page first.' : !c.smsConsent ? 'This client hasn’t agreed to get texts. Ask them first, then tick “Agreed to receive text messages” on their client page.' : '';
  const mb = modal(`Send ${word} #${doc.number} to ${c.name || 'the client'} as a text message`, `<form class="tx-form">
<label class="fl tx-to"><span>To</span><input value="${c.phone ? esc(fmtUsPhone(c.phone)) : ''}" placeholder="No mobile number on file" readonly title="Texts go to the client’s mobile number on file"></label>
${why ? `<div class="notice">${why}</div>` : ''}
<div class="tx-grid"><div><label class="fl"><span>Message</span><textarea name="message" rows="5" maxlength="${TEXT_MAX}">${esc(`Hi ${c.name || 'there'}, here's your ${word} from ${co}.`)}</textarea></label><span class="tx-left"></span></div>
<div><div class="tx-bubble"></div><p class="muted tx-note">The link opens the ${word} so they can ${kind === 'invoice' ? 'view and pay it online' : 'view and approve it'}. Every text is recorded in the Notifications Log.</p></div></div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn" ${why ? 'disabled' : ''}>Send</button></div></form>`, true);
  const ta = $('textarea', mb); let link = '…';
  const show = () => {
    let m = ta.value.trim(); if (co && !m.toLowerCase().includes(co.toLowerCase())) m = `${co}: ${m}`;
    $('.tx-bubble', mb).textContent = `${m}\n\n${label} ${link}\n\nReply STOP to opt out.`; $('.tx-left', mb).textContent = TEXT_MAX - ta.value.length;
  };
  ta.addEventListener('input', show); show();
  // the short link the text will carry (…/s/CODE); the server adds the same one when it sends
  api('GET', `/api/${kind}s/${doc.id}/short-link`).then((r) => { link = r.url; show(); }).catch((x) => toast(x.message, true));
  return sendSubmit(kind, doc, mb, () => ['sms'], () => {
    if (!ta.value.trim()) throw new Error('Write a message first');
    return { message: ta.value.trim() };
  });
}
// sends on the chosen channels (plus anything extra, like a text's message), then shows how each one went
function sendSubmit(kind, doc, mb, pick, extra = () => ({})) {
  $('form', mb).addEventListener('submit', async (e) => {
    e.preventDefault();
    const channels = pick();
    if (!channels.length) return toast('Choose email, text, or both', true);
    const btn = e.submitter || $('.foot .btn:not(.alt)', mb); let r;
    try { if (btn) btn.disabled = true; r = await api('POST', `/api/${kind}s/${doc.id}/send`, { channels, ...extra() }); } // extra() can refuse too (no message yet)
    catch (x) { if (btn) btn.disabled = false; return toast(x.message, true); }
    const rows = r.results.map((x) => `<tr><td>${x.channel === 'email' ? 'Email' : 'Text'}</td><td>${esc(x.to || '—')}</td><td>${badge(x.status)}</td></tr>`).join('');
    const sim = r.results.some((x) => x.status === 'simulated');
    mb.innerHTML = `<div class="tablewrap"><table><tr><th>Channel</th><th>To</th><th>Status</th></tr>${rows}</table></div>
${sim ? '<div class="notice" style="margin-top:12px">Messages were recorded but not delivered because no email/SMS provider is connected yet. Contact support to get them switched on.</div>' : ''}
<div class="foot"><button class="btn" data-act="closeModal">Done</button></div>`;
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
// the Clients list shows 10 per page on phone screens (matches the 760px CSS breakpoint) and 20 on larger ones
const phoneMq = matchMedia('(max-width:760px)'); phoneMq.addEventListener('change', () => { if ($('#cq')) refresh(); });
let clientView = { status: 'all', tag: '', q: '', since: '', dupes: false, sort: 'name', dir: 1, page: 0 }; const clientSel = new Set();
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
      if ((v.status === 'archived') !== !!c.archived) return false; // archived clients show only under Status: Archived
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
    const per = phoneMq.matches ? 10 : 20; const pages = Math.max(1, Math.ceil(list.length / per)); v.page = Math.min(v.page, pages - 1);
    const shown = list.slice(v.page * per, (v.page + 1) * per);
    const sinceLabel = v.since === yStart ? 'this year' : 'past 30 days';
    const arrow = (k) => `<span class="sort ${v.sort === k ? 'on' : ''}">${v.sort === k ? (v.dir > 0 ? '▲' : '▼') : '⇅'}</span>`;
    main.innerHTML = `<div class="head"><h1>Clients</h1><div class="actions need-clients-edit"><button class="btn" data-act="newClient">New Client</button>
<details class="menu"><summary class="btn alt">⋯ More Actions</summary><div class="menu-list">${planHas('clientImport') ? '<a href="/clients/import" data-link class="admin-only">Import clients</a>' : ''}<button data-act="exportClients">Export to CSV</button></div></details></div></div>
<div class="cstats">
<button class="cstat" data-act="clientCard" data-k="leads"><div class="cs-h"><strong>New leads</strong><span>↗</span></div><div class="muted">Past 30 days</div><div class="cs-v">${leadsNow} ${change(leadsNow, leadsPrev)}</div></button>
<button class="cstat" data-act="clientCard" data-k="active"><div class="cs-h"><strong>New clients</strong><span>↗</span></div><div class="muted">Past 30 days</div><div class="cs-v">${actNow} ${change(actNow, actPrev)}</div></button>
<button class="cstat" data-act="clientCard" data-k="ytd"><div class="cs-h"><strong>Total new clients</strong><span>↗</span></div><div class="muted">Year to date</div><div class="cs-v">${ytd}</div></button>
<div class="cstat merge admin-only"><div>Merge duplicate clients into a single profile to keep information accurate.</div><div class="muted">${dup.count ? `${dup.count} possible duplicate${dup.count === 1 ? '' : 's'} found` : 'No duplicates found'}</div><button class="btn alt sm" data-act="clientDupes" ${dup.count ? '' : 'disabled'}>Merge Clients</button></div></div>
<h2 class="ftitle">Filtered clients <span class="muted">(${list.length} result${list.length === 1 ? '' : 's'})</span></h2>
<div class="cfilters"><label class="pill m-hide">Tag<select data-cv="tag"><option value="">All tags</option>${tags.map((t) => `<option ${v.tag === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
<label class="pill m-hide">Status<select data-cv="status">${[['all', 'Leads and Active'], ['lead', 'Leads'], ['active', 'Active'], ['archived', 'Archived']].map(([k, l]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
${v.since ? `<button class="pill on" data-act="clientClear" data-k="since">Created ${sinceLabel} ×</button>` : ''}${v.dupes ? '<button class="pill on" data-act="clientClear" data-k="dupes">Possible duplicates ×</button>' : ''}
<input id="cq" class="csearch" type="search" placeholder="Search clients…" value="${esc(v.q)}"></div>
${v.dupes ? '<div class="notice">Showing clients that share an email, phone number or name. Tick the profiles that are the same client, then click Merge.</div>' : ''}
${clientSel.size ? `<div class="bulk admin-only"><strong>${clientSel.size} selected</strong><button class="btn sm" data-act="mergeClients" ${clientSel.size > 1 ? '' : 'disabled title="Select at least two clients"'}>Merge</button><button class="btn danger sm" data-act="deleteSelClients">Delete</button><button class="btn alt sm" data-act="clientClearSel">Clear selection</button></div>` : ''}
<div class="card ctable clist"><div class="tablewrap"><table><tr><th style="width:36px" class="admin-only"><input type="checkbox" id="selAll" aria-label="Select all" ${shown.length && shown.every((c) => clientSel.has(c.id)) ? 'checked' : ''}></th>
<th><button class="th-btn" data-act="clientSort" data-k="name">Name ${arrow('name')}</button></th><th class="m-hide">Address</th><th class="m-hide">Tags</th><th class="m-hide">Status</th><th class="m-hide"><button class="th-btn" data-act="clientSort" data-k="last">Last Activity ${arrow('last')}</button></th></tr>
${shown.map((c) => `<tr class="crow" data-id="${c.id}"><td class="admin-only"><input type="checkbox" class="sel" value="${c.id}" ${clientSel.has(c.id) ? 'checked' : ''} aria-label="Select ${esc(c.name)}"></td>
<td><strong>${esc(c.company || c.name)}</strong>${c.company && c.name && c.name !== c.company ? `<div>${esc(c.name)}</div>` : ''}</td><td class="m-hide">${esc(c.address)}</td>
<td class="m-hide">${clientTags(c).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</td>
<td class="m-hide">${c.archived ? '<span class="cstatus q-draft">Archived</span>' : info[c.id].active ? '<span class="cstatus active">Active</span>' : '<span class="cstatus lead">Lead</span>'}</td><td class="m-hide">${activityLabel(info[c.id].last)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty">${D.clients.length ? 'No clients match these filters' : 'No clients yet'}</td></tr>`}</table></div>
${list.length > per ? `<div class="tfoot"><span>Showing ${v.page * per + 1}–${Math.min(list.length, (v.page + 1) * per)} of ${list.length}</span>
<span class="pager"><button class="btn alt sm" data-act="clientPage" data-d="-1" ${v.page ? '' : 'disabled'} aria-label="Previous page">‹</button><button class="btn alt sm" data-act="clientPage" data-d="1" ${v.page < pages - 1 ? '' : 'disabled'} aria-label="Next page">›</button></span></div>` : ''}</div>`;
    $$('[data-cv]').forEach((s) => s.addEventListener('change', (e) => { clientView[e.target.dataset.cv] = e.target.value; clientView.page = 0; refresh(); }));
    let t; $('#cq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(async () => { clientView.q = e.target.value; clientView.page = 0; await refresh(); const q = $('#cq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); });
    $('#selAll').addEventListener('change', (e) => { shown.forEach((c) => (e.target.checked ? clientSel.add(c.id) : clientSel.delete(c.id))); refresh(); });
    $$('.sel').forEach((b) => b.addEventListener('change', (e) => { e.target.checked ? clientSel.add(e.target.value) : clientSel.delete(e.target.value); refresh(); }));
    $$('.crow').forEach((r) => r.addEventListener('click', (e) => { if (!e.target.closest('input')) navigate('/clients/view?id=' + r.dataset.id); }));
  },
};
document.addEventListener('click', (e) => { $$('details.menu[open]').forEach((m) => { if (!m.contains(e.target)) m.open = false; }); });
A.clientCard = (d) => {
  const yStart = new Date().getFullYear() + '-01-01'; const ago30 = ymd(addDays(new Date(), -30));
  clientView = { ...clientView, status: d.k === 'leads' ? 'lead' : d.k === 'active' ? 'active' : 'all', since: d.k === 'ytd' ? yStart : ago30, dupes: false, page: 0 };
  refresh();
};
A.clientDupes = () => { clientView = { ...clientView, status: 'all', tag: '', q: '', since: '', dupes: true, sort: 'name', dir: 1, page: 0 }; refresh(); };
A.clientClear = (d) => { clientView[d.k] = d.k === 'dupes' ? false : ''; clientView.page = 0; refresh(); };
A.clientPage = (d) => { clientView.page += Number(d.d); refresh(); };
A.clientSort = (d) => { clientView.dir = clientView.sort === d.k ? -clientView.dir : (d.k === 'last' ? -1 : 1); clientView.sort = d.k; clientView.page = 0; refresh(); };
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
// a map with a pin on the service address, under the address field; it follows the address as it's typed
function clientMap(mb) {
  const box = $('.cmap', mb); const input = $('[name=address]', mb); let t; let shown = '';
  const show = () => {
    const a = input.value.trim(); box.hidden = !a; if (!a || a === shown) return; shown = a;
    $('iframe', box).src = 'https://maps.google.com/maps?q=' + encodeURIComponent(a) + '&z=15&output=embed'; // Google's own “Open in Maps” link is on the map
  };
  show(); input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(show, 700); });
}
// New client / Edit client: a page of its own (/clients/new, /clients/edit), or shown in place of the quote, job or invoice
// being edited (clientOverEditor), which comes back unchanged afterwards
const LEAD_SOURCES = ['Google', 'Facebook', 'Instagram', 'Nextdoor', 'Yelp', 'Referral', 'Repeat client', 'Website', 'Online booking', 'Yard sign', 'Vehicle', 'Other'];
const TITLES = ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.'];
// older clients have just a name: the first word is the first name; a company client's name is the company
const nameParts = (c) => {
  if (c.firstName != null || c.lastName != null) return { first: c.firstName || '', last: c.lastName || '', commercial: !!c.commercial };
  if (c.company && c.name === c.company) return { first: '', last: '', commercial: true };
  const w = String(c.name || '').trim().split(/\s+/).filter(Boolean); return { first: w[0] || '', last: w.slice(1).join(' '), commercial: false };
};
const blankProp = () => ({ id: '', name: '', street1: '', street2: '', city: '', state: '', zip: '', country: 'United States', contacts: [], taxRate: null });
// opts.cancel / opts.saved(client): shown over an editor; otherwise Cancel and Save go to the client's profile
function clientEditPage(main, c, opts = {}) {
  const isNew = !c.id; const n = nameParts(c); const back = isNew ? '/clients' : '/clients/view?id=' + c.id;
  let props = structuredClone(clientProps(c)); if (!props.length) props = [blankProp()];
  const contacts = structuredClone(c.contacts || []);
  let billing = props.findIndex((p) => sameAddr(propAddr(p), c.address)); if (billing < 0 && !String(c.address || '').trim()) billing = 0; // -1: a billing address of its own
  const rate = Number(company.taxRate) || 0; const dom = location.hostname.split('.').slice(-2).join('.');
  main.innerHTML = `<form class="ce" novalidate>${opts.cancel ? '' : `<a class="back" href="${back}" data-link>← ${isNew ? 'Clients' : esc(c.name)}</a>`}<h1>${isNew ? 'New Client' : 'Edit Client'}</h1>
<section class="ce-sec"><div class="ce-l"><h2>Primary contact details</h2><p class="muted">Provide the main point of contact to ensure smooth communication and reliable client records.</p></div><div class="ce-r">
<div class="ce-name"><label>Title<select name="title"><option value="">No title</option>${TITLES.map((t) => `<option ${c.title === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label>First name<input name="firstName" value="${esc(n.first)}" autocomplete="off"></label><label>Last name<input name="lastName" value="${esc(n.last)}" autocomplete="off"></label></div>
<label>Company name<input name="company" value="${esc(c.company)}" autocomplete="off"></label>
<div class="chk"><label><input type="checkbox" name="commercial" ${n.commercial ? 'checked' : ''}> Commercial client: Use company name as client name</label></div>
<h4>Communication</h4><label>Phone number<input name="phone" type="tel" value="${esc(c.phone)}" placeholder="+17135550100"></label><label>Email<input name="email" type="email" value="${esc(c.email)}"></label>
<details class="ce-comm"${c.smsConsent ? ' open' : ''}><summary>Communication settings</summary><div class="chk"><label><input type="checkbox" name="smsConsent" ${c.smsConsent ? 'checked' : ''}> Agreed to receive text messages</label></div>
<p class="muted">${c.smsConsent ? `Agreed ${esc(fmtDate(c.smsConsent.at.slice(0, 10)))}${c.smsConsent.source !== 'business' ? ' on the ' + esc(c.smsConsent.source) : ''}. ` : ''}Only tick this if the client said yes after you read them: “Can we text you at the number you just gave us about your quotes, invoices and appointments? Message frequency varies, and msg &amp; data rates may apply. Reply HELP for help or STOP at any time to opt out. Our text terms and privacy policy are at ${esc(dom)}/terms and ${esc(dom)}/privacy. Agreeing isn’t required to do business with us. Do you agree to receive texts?” If they say yes: “Thanks, you’re signed up. You’ll get a text confirming it.” Ticking this sends them that confirmation text.</p></details>
<h4>Lead information</h4><label>Lead source<input name="leadSource" list="ceLeads" value="${esc(c.leadSource || ((c.tags || []).includes('Online booking') ? 'Online booking' : ''))}" autocomplete="off"></label><datalist id="ceLeads">${LEAD_SOURCES.map((s) => `<option value="${s}">`).join('')}</datalist>
<details class="ce-acc"${contacts.length ? ' open' : ''}><summary>Additional contacts</summary><div class="ce-list" data-ce-contacts></div></details>
</div></section>
<section class="ce-sec"><div class="ce-l"><h2>Property address</h2><p class="muted">Enter the primary service address, billing address, or any additional locations where services may take place.</p><button type="button" class="btn alt" data-ce-add>Add Another Address</button></div><div class="ce-r" data-ce-props></div></section>
<div class="ce-foot">${isNew || opts.cancel ? '' : `<button type="button" class="btn alt ce-del admin-only" data-act="delClient" data-id="${c.id}">Delete</button>`}<span></span><button type="button" class="btn alt" data-ce-cancel>Cancel</button><button class="btn">${isNew ? 'Save Client' : 'Update Client'}</button></div></form>`;
  const f = $('form', main);
  const contactRows = (list, at) => `${list.map((x, i) => `<div class="ce-ct"><span><strong>${esc(x.name)}</strong>${[x.role, x.billing ? 'Billing contact' : '', x.phone, x.email].filter(Boolean).map((t) => ` <span class="muted">· ${esc(t)}</span>`).join('')}</span><button type="button" class="icon-btn cv-ib" data-ce-ctrm="${at}:${i}" aria-label="Remove ${esc(x.name)}">${cvIcons().x}</button></div>`).join('')}
<div class="ce-ctadd"><span class="muted">${at === 'c' ? 'Other people at this client you communicate with.' : 'For contacts with access limited to this property, e.g., tenants.'}</span><button type="button" class="btn alt sm" data-ce-ctadd="${at}">Add Contact</button></div>`;
  const drawContacts = () => { $('[data-ce-contacts]', f).innerHTML = contactRows(contacts, 'c'); };
  // property blocks: values are read back into props before anything redraws them
  const sync = () => $$('.ce-prop', f).forEach((el) => { const p = props[el.dataset.i]; $$('[data-k]', el).forEach((i) => { p[i.dataset.k] = i.value.trim(); });
    const m = $('[data-tax]', el).value; p.taxRate = m === 'default' ? null : m === 'none' ? 0 : Math.max(0, Number($('[data-taxrate]', el).value) || 0); });
  const drawProps = () => {
    $('[data-ce-props]', f).innerHTML = props.map((p, i) => { const m = p.taxRate == null || p.taxRate === '' ? 'default' : Number(p.taxRate) === 0 ? 'none' : 'custom';
      return `<div class="ce-prop" data-i="${i}">${props.length > 1 ? `<div class="ce-ph"><strong>${i === 0 ? 'Primary property' : `Property ${i + 1}`}</strong><button type="button" class="link-btn danger" data-ce-rm="${i}">Remove</button></div>` : ''}
<label>Property name<input data-k="name" value="${esc(p.name)}" placeholder="Optional, e.g. Rental home"></label>
<div class="pf-addr"><label class="pf-w">Street 1<input data-k="street1" value="${esc(p.street1)}" autocomplete="off"></label><label class="pf-w">Street 2<input data-k="street2" value="${esc(p.street2)}" autocomplete="off"></label>
<label>City<input data-k="city" value="${esc(p.city)}"></label><label>State<input data-k="state" value="${esc(p.state)}"></label><label>ZIP code<input data-k="zip" value="${esc(p.zip)}"></label>
<label>Country<select data-k="country">${['United States', 'Canada', 'Mexico', 'Other'].map((x) => `<option ${(p.country || 'United States') === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
<div class="ce-tax"><label>Tax rate<select data-tax><option value="default" ${m === 'default' ? 'selected' : ''}>Company default (${rate}%)</option><option value="none" ${m === 'none' ? 'selected' : ''}>No tax (0%)</option><option value="custom" ${m === 'custom' ? 'selected' : ''}>Custom rate</option></select></label>
<label ${m === 'custom' ? '' : 'hidden'}>Rate (%)<input data-taxrate type="number" step="any" min="0" value="${m === 'custom' ? esc(p.taxRate) : ''}"></label></div>
<div class="chk"><label><input type="checkbox" data-ce-bill="${i}" ${billing === i ? 'checked' : ''}> Billing address is the same as property address</label></div>
<details class="ce-acc"${(p.contacts || []).length ? ' open' : ''}><summary>Property contacts</summary><div class="ce-list">${contactRows(p.contacts || [], i)}</div></details></div>`; }).join('')
      + (billing < 0 ? `<label class="ce-billing">Billing address<input name="billingAddress" value="${esc(c.address)}" placeholder="Street, city, state, ZIP"></label>` : '');
  };
  drawContacts(); drawProps();
  const redraw = () => { const b = f.billingAddress && f.billingAddress.value; sync(); drawProps(); if (b != null && f.billingAddress) f.billingAddress.value = b; };
  f.addEventListener('change', (e) => {
    if (e.target.matches('[data-tax]')) { const r = e.target.closest('.ce-tax').lastElementChild; r.hidden = e.target.value !== 'custom'; if (!r.hidden) $('input', r).focus(); }
    if (e.target.matches('[data-ce-bill]')) { billing = e.target.checked ? Number(e.target.dataset.ceBill) : -1; redraw(); }
  });
  f.addEventListener('click', (e) => {
    const t = e.target.closest('[data-ce-add], [data-ce-rm], [data-ce-ctadd], [data-ce-ctrm], [data-ce-cancel]'); if (!t) return;
    if (t.matches('[data-ce-cancel]')) return opts.cancel ? opts.cancel() : navigate(back);
    if (t.matches('[data-ce-add]')) { sync(); props.push(blankProp()); drawProps(); $$('.ce-prop', f).pop().querySelector('[data-k=street1]').focus(); return; }
    if (t.matches('[data-ce-rm]')) { const i = Number(t.dataset.ceRm); sync(); props.splice(i, 1); billing = billing === i ? -1 : billing > i ? billing - 1 : billing; drawProps(); return; }
    if (t.matches('[data-ce-ctadd]')) { const at = t.dataset.ceCtadd; sync(); contactModal((x) => { if (at === 'c') { contacts.splice(0, contacts.length, ...withContact(contacts, x)); drawContacts(); } else { props[at].contacts = withContact(props[at].contacts || [], x); drawProps(); } }); return; }
    const [at, i] = t.dataset.ceCtrm.split(':'); sync(); if (at === 'c') { contacts.splice(Number(i), 1); drawContacts(); } else { props[at].contacts.splice(Number(i), 1); drawProps(); }
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); sync(); const v = (k) => f[k].value.trim();
    const name = (f.commercial.checked && v('company')) || [v('firstName'), v('lastName')].filter(Boolean).join(' ') || v('company');
    if (!name) { toast('Enter the client’s first name or company name', true); return f.firstName.focus(); }
    if (f.commercial.checked && !v('company')) { toast('Enter the company name, or untick Commercial client', true); return f.company.focus(); }
    if (v('email') && !f.email.checkValidity()) { toast('Check the email address', true); return f.email.focus(); }
    const kept = props.map((p, i) => ({ p, i })).filter(({ p }) => p.street1);
    const properties = kept.map(({ p }) => ({ ...p, id: p.id || rid() })); const bi = kept.findIndex(({ i }) => i === billing);
    const body = { title: v('title'), firstName: v('firstName'), lastName: v('lastName'), company: v('company'), commercial: f.commercial.checked, name, phone: v('phone'), email: v('email'),
      smsConsent: f.smsConsent.checked, leadSource: v('leadSource'), contacts, properties,
      address: bi >= 0 ? propAddr(properties[bi]) : f.billingAddress ? v('billingAddress') : properties[0] ? propAddr(properties[0]) : '' };
    const btn = $('.ce-foot button:not([type])', f); btn.disabled = true;
    try {
      const saved = isNew ? await api('POST', '/api/clients', body) : await api('PUT', '/api/clients/' + c.id, body);
      toast(isNew ? 'Client saved' : 'Client updated'); if (opts.saved) opts.saved(saved); else navigate('/clients/view?id=' + saved.id);
    } catch (err) { btn.disabled = false; toast(err.message, true); }
  });
  (n.commercial ? f.company : f.firstName).focus();
}
PAGES['/clients/new'] = { title: 'New client', render: (main) => clientEditPage(main, {}) };
PAGES['/clients/edit'] = {
  title: 'Edit client',
  render(main) { const c = byId(D.clients, qp('id')); if (!c) { main.innerHTML = '<div class="card"><h1>Client not found</h1><p><a href="/clients" data-link>Back to Clients</a></p></div>'; return; } clientEditPage(main, c); },
};
// Edit client details / Create new client from a quote, job or invoice: the client page shows in its place and, on Save or Cancel,
// the quote, job or invoice comes back exactly as it was (unsaved changes and all). done(client) gets the saved client.
function clientOverEditor(c, done) {
  const main = $('#main'); const held = [...main.childNodes]; const y = window.scrollY; const title = document.title;
  const restore = () => { main.replaceChildren(...held); document.title = title; window.scrollTo(0, y); };
  main.replaceChildren(); window.scrollTo(0, 0); document.title = `${c.id ? 'Edit' : 'New'} client · ${company.name || ''}`;
  clientEditPage(main, c, { cancel: restore, saved: (saved) => { restore(); done(saved); } });
}
// a client saved from an editor: the editor's own copy and its client picker show the change
function clientSavedInEditor(saved) {
  const c = byId(D.clients, saved.id); if (c) Object.assign(c, saved); else D.clients.push(saved);
  const pick = $('main form select[name=clientId]'); if (!pick) return;
  const o = $(`option[value="${saved.id}"]`, pick); if (o) o.textContent = saved.name;
  if (pick.value === saved.id) { pick._refreshing = true; pick.dispatchEvent(new Event('change', { bubbles: true })); pick._refreshing = false; } // same client, new details: not a change of client
}

/* ===== a client's profile (/clients/view?id=) ===== */
// "702 Old Oyster Trail, Sugar Land, TX 77479" → street, city, state and ZIP; anything else stays whole in the street column
function splitAddr(a) {
  const p = String(a || '').split(',').map((s) => s.trim()).filter(Boolean); if (p.length && /^(usa?|united states)$/i.test(p[p.length - 1])) p.pop();
  const m = p.length > 2 && /^(.+?)\s+(\d{5}(?:-\d{4})?)$/.exec(p[p.length - 1]);
  return m ? { street: p.slice(0, -2).join(', '), city: p[p.length - 2], state: m[1], zip: m[2] } : { street: p.join(', '), city: '', state: '', zip: '' };
}
const cvIcons = () => ({ // profile icons (QI is defined further down the file)
  mail: QI('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/>'), pin: QI('<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),
  edit: QI('<path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>'), plus: QI('<path d="M12 5v14M5 12h14"/>'), contact: QI('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17a3.5 3.5 0 0 1 7 0M15 9h3M15 13h3"/>'),
  user: QI('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M6.2 18.4a7 7 0 0 1 11.6 0"/>'), archive: QI('<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>'),
  merge: QI('<path d="M3 7h5l8 10h5M3 17h5l2.5-3.1M13.5 10.1L16 7h5M18 4l3 3-3 3M18 14l3 3-3 3"/>'), gear: QI('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  chev: QI('<path d="M9 6l6 6-6 6"/>'), note: QI('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'), x: QI('<path d="M18 6L6 18M6 6l12 12"/>'),
});
/* ===== properties: a client can have several; each quote, job, invoice, request and task is for one of them ===== */
const propAddr = (p) => [p.street1, p.street2, p.city, [p.state, p.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
const propFromAddr = (a, id = 'p0') => { const s = splitAddr(a); return { id, name: '', street1: s.street, street2: '', city: s.city, state: s.state, zip: s.zip, country: 'United States', contacts: [] }; };
// saved properties, or (clients from before properties) one made from their address
const clientProps = (c) => (!c ? [] : Array.isArray(c.properties) ? c.properties : String(c.address || '').trim() ? [propFromAddr(c.address)] : []);
const sameAddr = (a, b) => !!String(a || '').trim() && String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
// the property something is for: by its propertyId, else by its address (a blank address means the client's billing address)
const docProp = (c, x) => { const ps = clientProps(c); return ps.find((p) => x.propertyId && p.id === x.propertyId) || ps.find((p) => sameAddr(propAddr(p), x.address || c.address)); };
const rid = () => Math.random().toString(36).slice(2, 10);
const PI = { // icons for what can be made for a client or property (QI is defined further down the file, so they're made when used)
  get request() { return QI('<path d="M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/><path d="M4 14h4l1.5 2h5l1.5-2h4M12 3v9M8.5 8.5L12 12l3.5-3.5"/>', 'pi-req'); },
  get quote() { return QI('<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5L20 20M8 10h4"/>', 'pi-quote'); },
  get job() { return QI('<path d="M15 12l-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9"/><path d="M17.64 15L22 10.64M20.91 11.7l-1.25-1.25a3.2 3.2 0 0 1-.93-2.25v-.86L16 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>', 'ok'); },
  get task() { return QI('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 13l2 2 4-4"/>'); },
  get home() { return QI('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>'); },
  get pin() { return QI('<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'); },
  get cal() { return QI('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'); },
  get trash() { return QI('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>', 'bad'); },
};
const R_STATUS = { new: ['New', 'q-sent'], converted: ['Converted', 'q-converted'], closed: ['Closed', 'q-draft'], archived: ['Archived', 'q-draft'] };
// a client's work (requests, quotes, jobs and invoices), newest first, with the property each is for. Open = still needs something done
function clientWork(c, reqs) {
  const mine = (k) => D[k].filter((x) => x.clientId === c.id); const pid = (x) => (docProp(c, x) || {}).id || '';
  return [
    ...reqs.map((r) => { const [l, cls] = R_STATUS[r.status] || [r.status, 'q-draft']; return { type: 'requests', item: 'Request', title: r.title, addr: r.address, pid: pid(r), date: r.createdAt, label: l, cls, open: r.status === 'new', amount: null }; }),
    ...mine('quotes').map((q) => { const st = quoteStatus(q); return { type: 'quotes', item: `Quote #${q.number}`, title: q.title, addr: q.address || c.address, pid: pid(q), date: q.createdAt, label: Q_STATUS[st] || st, cls: 'q-' + st, open: !['converted', 'declined'].includes(st), amount: q.total, href: '/quotes/view?id=' + q.id }; }),
    ...mine('jobs').map((j) => { const st = jobStatus(j); return { type: 'jobs', item: `Job #${j.number}`, title: j.title, addr: j.address, pid: pid(j), date: j.date, label: J_STATUS[st], cls: J_CLASS[st], open: !['archived', 'cancelled'].includes(st), amount: canDo('jobs.prices') ? jobTotal(j) : null, href: '/jobs/edit?id=' + j.id }; }),
    ...mine('invoices').map((i) => ({ type: 'invoices', item: `Invoice #${i.number}`, title: i.subject, addr: i.address || c.address, pid: pid(i), date: i.issueDate, label: I_STATUS[i.displayStatus] || i.displayStatus, cls: I_CLASS[i.displayStatus], open: i.displayStatus !== 'paid', amount: i.total, href: '/invoices/view?id=' + i.id })),
  ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}
const workFilter = (work, v) => work.filter((w) => (!v.types.length || v.types.includes(w.type)) && (v.status === 'all' || (v.status === 'open') === w.open));
const workChips = (v, sel, act = 'cvType') => `<label class="pill">Status${sel('status', [['all', 'All'], ['open', 'Open'], ['closed', 'Closed']])}</label>
${[['requests', 'Requests', '', PI.request], ['quotes', 'Quotes', 'need-quotes', PI.quote], ['jobs', 'Jobs', '', PI.job], ['invoices', 'Invoices', 'need-invoices', QM.invoice]].map(([k, l, cls, ic]) => `<button type="button" class="pill cv-chip ${cls} ${v.types.includes(k) ? 'on' : ''}" data-act="${act}" data-k="${k}" aria-pressed="${v.types.includes(k)}">${ic}${l}</button>`).join('')}`;
const workTable = (work, showProp) => `<div class="tablewrap"><table class="cv-t"><tr><th>Item</th>${showProp ? '<th>Property</th>' : ''}<th>Date</th><th>Status</th><th class="r">Amount</th></tr>
${work.map((w) => `<tr${w.href ? ` class="crow" data-href="${w.href}"` : ''}><td><strong>${esc(w.item)}</strong>${w.title ? `<div class="muted">${esc(w.title)}</div>` : ''}</td>${showProp ? `<td>${esc(splitAddr(w.addr).street)}</td>` : ''}<td>${w.date ? fmtDate(String(w.date).slice(0, 10)) : ''}</td><td><span class="cstatus ${w.cls}">${esc(w.label)}</span></td><td class="r">${w.amount == null ? '' : money(w.amount)}</td></tr>`).join('') || `<tr><td colspan="${showProp ? 5 : 4}" class="empty">No results match your search</td></tr>`}</table></div>`;
// a client's visits (jobs) and tasks, newest first
function clientSched(c) {
  const pid = (x) => (docProp(c, x) || {}).id || '';
  return [...D.jobs.filter((j) => j.clientId === c.id).map((j) => ({ kind: 'job', pid: pid(j), date: j.date, time: j.anytime || !j.startTime ? '' : fmtTime(j.startTime), title: `Visit for Job #${j.number} - ${j.title}`, sub: j.description, staff: j.staffIds, done: j.status === 'completed', off: j.status === 'cancelled', href: '/jobs/edit?id=' + j.id })),
    ...(D.tasks || []).filter((t) => t.clientId === c.id).map((t) => ({ kind: 'task', pid: pid(t), date: t.date, time: t.anytime || !t.startTime ? '' : fmtTime(t.startTime), title: t.title, sub: t.description || t.notes || '', staff: t.staffIds, done: !!t.done, off: false }))]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
const schedTable = (sched) => { const today = ymd(new Date()); const state = (s) => (s.off ? 'Cancelled' : s.done ? 'Completed' : s.date < today ? 'Overdue' : s.date === today ? 'Today' : 'Upcoming');
  return `<div class="tablewrap"><table class="cv-t"><tr><th>Schedule</th><th>Title</th><th>Assigned</th></tr>${sched.map((s) => `<tr${s.href ? ` class="crow" data-href="${s.href}"` : ''}><td><strong>${fmtDate(s.date)}${s.time ? ', ' + s.time : ''}</strong><div class="muted">${state(s)}</div></td><td><strong>${esc(s.title)}</strong>${s.sub ? `<div class="muted cv-clip">${esc(s.sub)}</div>` : ''}</td><td>${staffDots(s.staff)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Nothing scheduled</td></tr>'}</table></div>`; };
// Request, Quote and Job for a client, or for one of their properties
const workMenuItems = (c, p) => { const q = `client=${c.id}${p ? '&property=' + encodeURIComponent(p.id) : ''}`;
  return `<button type="button" class="mi need-clients-edit" data-act="propRequest" data-client="${c.id}"${p ? ` data-id="${esc(p.id)}"` : ''}>${PI.request}Request</button><a class="mi need-quotes" href="/quotes/new?${q}" data-link>${PI.quote}Quote</a><a class="mi need-jobs-edit" href="/jobs/new?${q}" data-link>${PI.job}Job</a>`; };
// contacts: everyone at the client, or the people at one property (e.g. tenants)
function contactsCard(c, p, edit) {
  const list = (p ? p.contacts : c.contacts) || []; const at = `data-client="${c.id}"${p ? ` data-prop="${esc(p.id)}"` : ''}`;
  return `<section class="cv-card cv-contacts cvs-contacts"><div class="cv-cbar">${cvIcons().contact}<span><strong>Contacts</strong> – ${p ? 'People at this property, e.g. tenants' : 'Add contacts to keep track of everyone you communicate with'}</span>${edit ? `<button type="button" class="link-btn" data-act="contactAdd" ${at}>Add Contact</button>` : ''}</div>
${list.length ? `<div class="tablewrap"><table class="cv-t"><tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th></th></tr>${list.map((x) => `<tr><td><strong>${esc(x.name)}</strong>${x.billing ? '<div class="muted">Billing contact</div>' : ''}</td><td>${esc(x.role)}</td><td>${x.phone ? `<a href="tel:${esc(x.phone)}">${esc(x.phone)}</a>` : ''}</td><td>${x.email ? `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : ''}</td><td class="actions">${edit ? `<button type="button" class="icon-btn cv-ib" data-act="contactDel" ${at} data-cid="${esc(x.id)}" aria-label="Remove ${esc(x.name)}" title="Remove">${cvIcons().x}</button>` : ''}</td></tr>`).join('')}</table></div>` : ''}</section>`;
}
// save a client's properties (and, with extra, other details) and keep the loaded copy in step
async function saveProps(c, props, extra = {}) { const saved = await api('PUT', '/api/clients/' + c.id, { properties: props, ...extra }); Object.assign(c, saved); return saved; }
const contactsOf = (c, propId) => (propId ? (clientProps(c).find((p) => p.id === propId) || {}).contacts || [] : c.contacts || []);
async function saveContacts(c, propId, list) {
  if (!propId) { Object.assign(c, await api('PUT', '/api/clients/' + c.id, { contacts: list })); return; }
  await saveProps(c, clientProps(c).map((p) => (p.id === propId ? { ...p, contacts: list } : p)));
}
// Add contact popup; onAdd(contact) keeps it (on a saved client or property, or in the Edit client form until it's saved)
function contactModal(onAdd) {
  const sw = (n, l, on) => switchRow(n, l, on);
  const mb = modal('Add contact', `<form class="ctf"><h4>Details</h4><div class="ct-name"><label>Title<select name="title">${['No title', 'Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.'].map((t, i) => `<option value="${i ? t : ''}">${t}</option>`).join('')}</select></label><label>First name<input name="firstName" required autocomplete="off"></label><label>Last name<input name="lastName" autocomplete="off"></label></div>
<label>Role<input name="role" placeholder="e.g. Property manager, tenant"></label><div class="chk"><label><input type="checkbox" name="billing"> Set as billing contact</label></div>
<h4>Communication</h4><label>Phone number<input name="phone" type="tel"></label><label>Email<input name="email" type="email"></label>
<h4>Communication settings</h4><div class="ct-notify"><strong>Quotes and invoices</strong>${sw('quoteFollowups', 'Outstanding quote follow-ups', false)}${sw('invoiceFollowups', 'Overdue invoice follow-ups', false)}
<strong>Jobs and visits</strong>${sw('visitReminders', 'Upcoming assessment or visit reminders', true)}${sw('jobFollowups', 'Job closure follow-ups', false)}</div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Add Contact</button></div></form>`);
  const f = $('form', mb); f.firstName.focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const on = (n) => $(`input.sw[name=${n}]`, f).checked; const v = (n) => f[n].value.trim();
    const x = { id: rid(), title: v('title'), firstName: v('firstName'), lastName: v('lastName'), name: [v('title'), v('firstName'), v('lastName')].filter(Boolean).join(' '), role: v('role'), billing: f.billing.checked, phone: v('phone'), email: v('email'),
      notify: { quoteFollowups: on('quoteFollowups'), invoiceFollowups: on('invoiceFollowups'), visitReminders: on('visitReminders'), jobFollowups: on('jobFollowups') } };
    await onAdd(x); closeModal();
  });
}
const withContact = (list, x) => [...list.map((o) => (x.billing ? { ...o, billing: false } : o)), x]; // one billing contact
A.contactAdd = (d) => { const c = byId(D.clients, d.client); contactModal(async (x) => { await saveContacts(c, d.prop, withContact(contactsOf(c, d.prop), x)); toast('Contact added'); refresh(); }); };
A.contactDel = async (d) => { const c = byId(D.clients, d.client); if (!confirm('Remove this contact?')) return; await saveContacts(c, d.prop, contactsOf(c, d.prop).filter((x) => x.id !== d.cid)); toast('Contact removed'); refresh(); };
// New property / Edit property. after(property): instead of redrawing the page (the quote, job and invoice editors keep their unsaved changes)
function propertyForm(c, p, after) {
  const isNew = !p; p = p || { id: '', name: '', street1: '', street2: '', city: '', state: '', zip: '', country: 'United States', contacts: [] };
  const wasBilling = !isNew && sameAddr(propAddr(p), c.address); const rate = Number(company.taxRate) || 0;
  const mode = p.taxRate == null || p.taxRate === '' ? 'default' : Number(p.taxRate) === 0 ? 'none' : 'custom';
  const countries = ['United States', 'Canada', 'Mexico', 'Other'];
  const mb = modal(isNew ? 'New property' : 'Edit ' + propAddr(p), `<form class="pf"><label>Property name<input name="name" value="${esc(p.name)}" placeholder="Optional, e.g. Rental home"></label>
<div class="pf-addr"><label class="pf-w">Street 1<input name="street1" required value="${esc(p.street1)}"></label><label class="pf-w">Street 2<input name="street2" value="${esc(p.street2)}"></label>
<label>City<input name="city" value="${esc(p.city)}"></label><label>State<input name="state" value="${esc(p.state)}"></label><label>ZIP code<input name="zip" value="${esc(p.zip)}"></label>
<label>Country<select name="country">${countries.map((x) => `<option ${(p.country || 'United States') === x || (x === 'Other' && p.country && !countries.includes(p.country)) ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
<label>Tax rate<select name="taxMode"><option value="default" ${mode === 'default' ? 'selected' : ''}>Company default (${rate}%)</option><option value="none" ${mode === 'none' ? 'selected' : ''}>No tax (0%)</option><option value="custom" ${mode === 'custom' ? 'selected' : ''}>Custom rate</option></select></label>
<label class="pf-rate" ${mode === 'custom' ? '' : 'hidden'}>Tax rate for this property (%)<input name="taxRate" type="number" step="any" min="0" value="${mode === 'custom' ? esc(p.taxRate) : ''}"></label>
<div class="chk"><label><input type="checkbox" name="billing" ${wasBilling || (isNew && !String(c.address || '').trim()) ? 'checked' : ''} ${wasBilling ? 'disabled title="Make another property the billing address to change this"' : ''}> Billing address is the same as property address</label></div>
<details class="pf-contacts"><summary>Property contacts${(p.contacts || []).length ? ` (${p.contacts.length})` : ''}</summary><div class="pf-cbody"><span class="muted">For contacts with access limited to this property, e.g., tenants.${(p.contacts || []).length ? ' ' + p.contacts.map((x) => esc(x.name)).join(', ') : ''}</span><button type="button" class="btn alt sm" data-pf-contact>Add Contact</button></div></details>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  const f = $('form', mb); f.street1.focus();
  f.taxMode.addEventListener('change', () => { $('.pf-rate', f).hidden = f.taxMode.value !== 'custom'; if (f.taxMode.value === 'custom') f.taxRate.focus(); });
  const save = async () => {
    const v = (n) => f[n].value.trim();
    const np = { ...p, id: p.id || rid(), name: v('name'), street1: v('street1'), street2: v('street2'), city: v('city'), state: v('state'), zip: v('zip'), country: v('country'), contacts: p.contacts || [],
      taxRate: f.taxMode.value === 'default' ? null : f.taxMode.value === 'none' ? 0 : Math.max(0, Number(f.taxRate.value) || 0) };
    const props = clientProps(c).slice(); const i = props.findIndex((x) => x.id === np.id); if (i >= 0) props[i] = np; else props.push(np);
    await saveProps(c, props, wasBilling || f.billing.checked ? { address: propAddr(np) } : {}); // the billing address follows its property
    return np;
  };
  f.addEventListener('submit', async (e) => { e.preventDefault(); if (!f.reportValidity()) return; const np = await save(); closeModal(); toast(isNew ? 'Property added' : 'Property saved'); if (after) after(np); else refresh(); });
  $('[data-pf-contact]', f).addEventListener('click', async () => { if (!f.reportValidity()) return; const np = await save(); refresh(); A.contactAdd({ client: c.id, prop: np.id }); }); // saves the property first
}
A.propEdit = (d) => { const c = byId(D.clients, d.client); propertyForm(c, d.id ? clientProps(c).find((p) => p.id === d.id) : null); };
// a request taken down by the business (a call, a text, a visit)
A.propRequest = (d) => {
  const c = byId(D.clients, d.client); const props = clientProps(c); const p = props.find((x) => x.id === d.id);
  const mb = modal('New request', `<form><p class="muted" style="margin-top:0">For ${esc(c.name)}${p ? ` at ${esc(propAddr(p))}` : ''}</p><label>What do they need?<input name="title" required placeholder="e.g. Gutter repair"></label>
${!p && props.length > 1 ? `<label>Property<select name="propertyId">${props.map((x) => `<option value="${esc(x.id)}">${esc(propAddr(x))}</option>`).join('')}</select></label>` : ''}
<label>Details<textarea name="details" rows="4"></textarea></label><div class="row"><label>Preferred day<input type="date" name="preferredDate"></label><label>Preferred time<select name="preferredTime"><option value="any">Any time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></label></div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save request</button></div></form>`);
  const f = $('form', mb); f.title.focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const body = Object.fromEntries(new FormData(f)); const pp = p || props.find((x) => x.id === body.propertyId) || props[0];
    if (pp) { body.propertyId = pp.id; body.address = propAddr(pp); }
    await api('POST', `/api/clients/${c.id}/requests`, body); closeModal(); toast('Request saved'); refresh();
  });
};
// a task for a client or one of their properties (on the calendar like other tasks)
A.propTask = (d) => {
  const c = byId(D.clients, d.client); const p = clientProps(c).find((x) => x.id === d.id); const team = D.staff.filter((s) => s.status !== 'deactivated');
  const mb = modal('New task', `<form><p class="muted" style="margin-top:0">For ${esc(c.name)}${p ? ` at ${esc(propAddr(p))}` : ''}</p><label>Title<input name="title" required></label>
<div class="row3"><label>Date<input type="date" name="date" required value="${ymd(new Date())}"></label><label>Start<input type="time" name="startTime" value="09:00"></label><label>End<input type="time" name="endTime" value="10:00"></label></div>
<div class="chk"><label><input type="checkbox" name="anytime"> Anytime that day (no set time)</label></div>
<div class="muted qlabel">Assigned team</div><div class="team-pick">${team.map((s) => `<label><input type="checkbox" name="staff" value="${s.id}">${avatarHtml(s, 24)}${esc(s.name)}</label>`).join('') || '<span class="muted">Add team members on Manage Team first</span>'}</div>
<label>Notes<textarea name="description" rows="3"></textarea></label><div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save task</button></div></form>`);
  const f = $('form', mb); f.title.focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = new FormData(f); const any = !!fd.get('anytime');
    await api('POST', '/api/tasks', { title: fd.get('title'), date: fd.get('date'), startTime: any ? '' : fd.get('startTime'), endTime: any ? '' : fd.get('endTime'), anytime: any, clientId: c.id, address: p ? propAddr(p) : '', propertyId: p ? p.id : '', description: fd.get('description'), staffIds: fd.getAll('staff') });
    closeModal(); toast('Task saved'); refresh();
  });
};
A.propDelete = async (d) => {
  const c = byId(D.clients, d.client); const props = clientProps(c); const p = props.find((x) => x.id === d.id);
  if (props.length < 2) return toast('A client needs at least one property. Edit this one instead.', true);
  if (!confirm(`Delete the property at ${propAddr(p)}? Quotes, jobs and invoices for it keep its address.`)) return;
  const rest = props.filter((x) => x.id !== p.id);
  await saveProps(c, rest, sameAddr(propAddr(p), c.address) ? { address: propAddr(rest[0]) } : {}); toast('Property deleted'); navigate('/clients/view?id=' + c.id);
};
// a property's page (/clients/property?client=&id=): its client, tax rate, work, schedule and contacts
let ppState = { key: '', types: [], status: 'all' };
PAGES['/clients/property'] = {
  title: 'Property',
  async render(main) {
    const c = byId(D.clients, qp('client')); const p = clientProps(c).find((x) => x.id === qp('id'));
    if (!p) { main.innerHTML = `<div class="card"><h1>Property not found</h1><p><a href="${c ? '/clients/view?id=' + c.id : '/clients'}" data-link>Back</a></p></div>`; return; }
    if (ppState.key !== c.id + p.id) ppState = { key: c.id + p.id, types: [], status: 'all' };
    const v = ppState; const edit = canDo('clients.edit'); const CI = cvIcons(); const active = (clientInfo()[c.id] || {}).active;
    const reqs = await api('GET', `/api/clients/${c.id}/requests`).catch(() => []);
    const work = workFilter(clientWork(c, reqs).filter((w) => w.pid === p.id), v); const sched = clientSched(c).filter((s) => s.pid === p.id);
    const sel = (k, opts) => `<select data-ppf="${k}" aria-label="${k}">${opts.map(([val, l]) => `<option value="${val}" ${v[k] === val ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const rate = p.taxRate == null || p.taxRate === '' ? `Company default (${Number(company.taxRate) || 0}%)` : Number(p.taxRate) === 0 ? 'No tax (0%)' : `${p.taxRate}%`;
    const at = `data-client="${c.id}" data-id="${esc(p.id)}"`;
    main.innerHTML = `<div class="pp"><a class="back pp-back" href="/clients/view?id=${c.id}" data-link>← Back to ${esc(c.name)}</a>
<div class="pp-head"><div class="pp-title">${PI.home}<h1>${esc(propAddr(p))}</h1>${p.name ? `<div class="muted">${esc(p.name)}</div>` : ''}</div>
<div class="pp-acts"><details class="menu cv-more"><summary class="btn alt"><span class="more-dots" aria-hidden="true">•••</span> More</summary><div class="menu-list"><div class="mi-h">Create new</div>${workMenuItems(c, p)}<button type="button" class="mi need-jobs-edit" data-act="propTask" ${at}>${PI.task}Task</button>
${edit ? `<hr class="mi-sep"><button type="button" class="mi admin-only" data-act="propDelete" ${at}>${PI.trash}Delete property</button>` : ''}</div></details>
<a class="btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(propAddr(p))}" target="_blank" rel="noopener">${PI.pin}Show on Map</a></div>
${edit ? `<button type="button" class="icon-btn cv-ib pp-edit" data-act="propEdit" ${at} title="Edit Property" aria-label="Edit Property">${CI.edit}</button>` : ''}</div>
<div class="pp-info"><a class="pp-client" href="/clients/view?id=${c.id}" data-link><strong>${esc(c.name)} <span class="cdot ${active ? 'active' : 'lead'}"></span></strong>${c.phone ? `<span>${esc(c.phone)}</span>` : ''}${c.email ? `<span class="pp-mail">${esc(c.email)}</span>` : ''}</a>
<div class="cv-f"><span>Tax rate</span><div>${esc(rate)}</div></div></div>
<section class="cv-card"><div class="cv-ch"><h2>Work overview</h2><details class="menu cv-create"><summary class="cv-plus" aria-label="Create" title="Create">${CI.plus}</summary><div class="menu-list">${workMenuItems(c, p)}</div></details></div>
<div class="cv-filters">${workChips(v, sel, 'ppType')}</div>${workTable(work, false)}</section>
<section class="cv-card cv-contacts"><div class="cv-cbar">${PI.cal}<span><strong>Property schedule</strong> – ${sched.length ? 'Visits and tasks at this property' : 'Scheduled items will appear here'}</span>
<details class="menu cv-create"><summary class="link-btn">Add</summary><div class="menu-list"><button type="button" class="mi need-jobs-edit" data-act="propTask" ${at}>${PI.task}Task</button><button type="button" class="mi need-clients-edit" data-act="propRequest" ${at}>${PI.request}Request</button></div></details></div>
${sched.length ? `<div class="pp-sched">${schedTable(sched)}</div>` : ''}</section>
${contactsCard(c, p, edit)}</div>`;
    $$('[data-ppf]', main).forEach((s) => s.addEventListener('change', (e) => { ppState[e.target.dataset.ppf] = e.target.value; PAGES['/clients/property'].render(main); }));
    $$('tr[data-href]', main).forEach((r) => r.addEventListener('click', (e) => { if (!e.target.closest('a, button')) navigate(r.dataset.href); }));
  },
};
A.ppType = (d) => { const s = new Set(ppState.types); s.has(d.k) ? s.delete(d.k) : s.add(d.k); ppState.types = [...s]; PAGES['/clients/property'].render($('#main')); };
// the quote, job or invoice being edited is for this property: its address, and its tax rate when it has its own
function setProp(form, p) {
  const a = $('[name=address]', form); a.value = propAddr(p); const id = $('[name=propertyId]', form); if (id) id.value = p.id;
  a.dispatchEvent(new Event('input', { bubbles: true })); a.dispatchEvent(new Event('change', { bubbles: true }));
  const t = $('[name=taxRate]', form);
  if (t && p.taxRate != null && p.taxRate !== '') {
    t.value = Number(p.taxRate) ? p.taxRate : ''; const row = t.closest('.tl');
    if (row && Number(p.taxRate)) { [$('.opt-edit', row), $('.opt-amt', row), $('.t-rm', row)].forEach((el) => { if (el) el.hidden = false; }); const add = $('.opt-add', row); if (add) add.hidden = true; }
    recalc(form);
  }
}
// Select a property: when the client has several, a new quote, job or invoice has to be for one of them
function propertyPick(form, c) {
  const cur = $('[name=propertyId]', form); const props = clientProps(c);
  const mb = modal('Select a property', `<p class="muted" style="margin-top:0">${esc(c.name)} has ${props.length} properties. Which one is this for?</p>
<div class="pp-pick">${props.map((p) => `<button type="button" class="pp-opt${cur && cur.value === p.id ? ' on' : ''}" data-id="${esc(p.id)}">${PI.home}<span><strong>${esc(p.name || p.street1)}</strong><span class="muted">${esc(propAddr(p))}${sameAddr(propAddr(p), c.address) ? ' · Billing address' : ''}</span></span></button>`).join('')}</div>
<div class="foot">${canDo('clients.edit') ? '<button type="button" class="btn alt" data-pp-new>+ New property</button>' : ''}<button type="button" class="btn alt" data-pp-other>Enter a different address</button></div>`);
  $$('.pp-opt', mb).forEach((b) => b.addEventListener('click', () => { closeModal(); setProp(form, props.find((p) => p.id === b.dataset.id)); }));
  const nw = $('[data-pp-new]', mb); if (nw) nw.addEventListener('click', () => propertyForm(c, null, (np) => setProp(form, np)));
  $('[data-pp-other]', mb).addEventListener('click', () => { const id = $('[name=propertyId]', form); if (id) id.value = ''; changePropertyAddr(); });
}
// on every quote, job and invoice form: a hidden propertyId beside the address; a property is asked for when the client has several
function propertyField(sel) {
  const form = sel.form; const addr = form && $('[name=address]', form); if (!addr || $('[name=propertyId]', form)) return;
  const pid = document.createElement('input'); pid.type = 'hidden'; pid.name = 'propertyId'; pid.value = (form._doc && form._doc.propertyId) || ''; addr.after(pid);
  let changed = !(form._doc && form._doc.id) && !/\/jobs\/edit$/.test(curPath()); // a new one; an existing one with no property keeps the client's address
  const many = () => clientProps(byId(D.clients, sel.value)).length > 1;
  const need = () => changed && many() && !pid.value && !addr.value.trim();
  addr.addEventListener('input', (e) => { if (e.isTrusted) pid.value = ''; }); // typed in: an address of its own, not a saved property
  sel.addEventListener('change', () => { if (sel._refreshing) return; pid.value = ''; changed = true; if (many()) setTimeout(() => propertyPick(form, byId(D.clients, sel.value)), 0); });
  form.addEventListener('submit', (e) => { if (!need()) return; e.preventDefault(); e.stopImmediatePropagation(); toast('Choose the property this is for', true); propertyPick(form, byId(D.clients, sel.value)); }, true);
  const c = byId(D.clients, sel.value); const pre = c && clientProps(c).find((p) => p.id === qp('property'));
  if (pre && !addr.value.trim()) setTimeout(() => setProp(form, pre), 0); // Create new from a property's page
  else if (need()) setTimeout(() => propertyPick(form, c), 0);
}
let cvState = { id: '', tab: 'info', types: [], status: 'all', prop: '', propQ: '', sType: 'all', sStatus: 'all', edit: '' };
PAGES['/clients/view'] = {
  title: 'Client',
  async render(main) {
    const c = byId(D.clients, qp('id'));
    if (!c) { main.innerHTML = '<div class="card"><h1>Client not found</h1><p><a href="/clients" data-link>Back to Clients</a></p></div>'; return; }
    if (cvState.id !== c.id) cvState = { id: c.id, tab: 'info', types: [], status: 'all', prop: '', propQ: '', sType: 'all', sStatus: 'all', edit: '' };
    const v = cvState; const CI = cvIcons(); const edit = canDo('clients.edit'); const today = ymd(new Date());
    const [reqs, notifs] = await Promise.all([api('GET', `/api/clients/${c.id}/requests`).catch(() => []), canDo('notifications') ? api('GET', '/api/notifications').catch(() => null) : null]);
    const msgs = notifs && notifs.filter((n) => n.clientId === c.id); window.__notifs = notifs || [];
    const invoices = D.invoices.filter((x) => x.clientId === c.id);
    const active = (clientInfo()[c.id] || {}).active;
    const props = clientProps(c);
    const propList = props.filter((p) => !v.propQ || [p.name, propAddr(p)].join(' ').toLowerCase().includes(v.propQ.toLowerCase()));
    const work = workFilter(clientWork(c, reqs), v).filter((w) => !v.prop || w.pid === v.prop);
    // billing: sent invoices and the payments against them (deposits too); balance = what's still owed on sent invoices
    const sent = invoices.filter((i) => i.status !== 'draft');
    const pays = paymentRows().filter((p) => p.clientId === c.id).map((p) => ({ ...p, net: round2(p.amount - (p.refunded || 0)) }));
    const balance = round2(sent.reduce((s, i) => s + invBalance(i), 0)); const lifetime = round2(pays.reduce((s, p) => s + p.net, 0));
    const bill = [...sent.map((i) => ({ date: i.issueDate, html: `<td><a href="/invoices/view?id=${i.id}" data-link class="cv-it">${QM.invoice}Invoice #${esc(i.number)}</a></td><td>—</td><td>${fmtDate(i.issueDate)}</td><td class="r">${money(i.total)}</td>` })),
      ...pays.map((p) => ({ date: p.date, html: `<td><a href="/payments/view?id=${encodeURIComponent(p.id)}" data-link class="cv-it">${QM.pay}${p.doc[0] === 'quote' ? 'Deposit' : 'Payment'}</a></td><td>${p.doc[0] === 'quote' ? 'Quote' : 'Invoice'} #${esc(p.doc[1].number)}</td><td>${fmtDate(p.date)}</td><td class="r">−${money(p.net)}</td>` }))]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const sched = clientSched(c).filter((s) => (v.sType === 'all' || s.kind === v.sType) && (v.sStatus === 'all' || (v.sStatus === 'done' ? s.done : !s.done && !s.off)));
    const contacts = c.contacts || []; const tags = clientTags(c); const last = msgs && msgs[0];
    const portal = c.portalToken && planHas('clientPortal') ? location.origin + '/client-portal?c=' + c.portalToken : '';
    const sel = (k, opts) => `<select data-cvf="${k}" aria-label="${k}">${opts.map(([val, l]) => `<option value="${val}" ${v[k] === val ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const field = (l, val) => `<div class="cv-f"><span>${l}</span><div>${val || '<span class="muted">—</span>'}</div></div>`;
    const card = (title, body, act = '', cls = '') => `<section class="cv-card ${cls}"><div class="cv-ch"><h2>${title}</h2>${act}</div>${body}</section>`;
    const plus = (a, label, extra = '') => `<button type="button" class="cv-plus" data-act="${a}" aria-label="${label}" title="${label}"${extra}>${CI.plus}</button>`;
    const createMenu = (summary) => `<details class="menu cv-create">${summary}<div class="menu-list">${workMenuItems(c)}<button type="button" class="mi need-invoices" data-act="cvNewInvoice" data-id="${c.id}">${QM.invoice}Invoice</button></div></details>`;
    const info = `${card('Properties', `<div class="tablewrap"><table class="cv-t"><tr><th>Address</th><th>City</th><th>State</th><th>ZIP code</th><th></th></tr>
${propList.map((p) => `<tr class="crow" data-href="/clients/property?client=${c.id}&id=${encodeURIComponent(p.id)}"><td><strong>${esc([p.street1, p.street2].filter(Boolean).join(', '))}</strong>${p.name || sameAddr(propAddr(p), c.address) ? `<div class="muted">${esc([p.name, sameAddr(propAddr(p), c.address) ? 'Billing address' : ''].filter(Boolean).join(' · '))}</div>` : ''}</td><td>${esc(p.city)}</td><td>${esc(p.state)}</td><td>${esc(p.zip)}</td>
<td class="actions"><a class="icon-btn cv-ib" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(propAddr(p))}" target="_blank" rel="noopener" title="Show on map" aria-label="Show on map">${CI.pin}</a>${edit ? `<button type="button" class="icon-btn cv-ib" data-act="propEdit" data-client="${c.id}" data-id="${esc(p.id)}" title="Edit property" aria-label="Edit property">${CI.edit}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">${props.length ? 'No properties match your search' : 'No properties yet'}</td></tr>`}</table></div>`,
    `<div class="cv-acts">${props.length > 1 ? `<input type="search" class="cv-search" id="cvPropQ" placeholder="Search properties" value="${esc(v.propQ)}">` : ''}${edit ? plus('propEdit', 'New property', ` data-client="${c.id}"`) : ''}</div>`, 'cvs-properties')}
${contactsCard(c, null, edit)}
${card('Work overview', `<div class="cv-filters">${props.length > 1 ? `<label class="pill">Property${sel('prop', [['', 'All'], ...props.map((p) => [p.id, esc(p.name || p.street1)])])}</label>` : ''}${workChips(v, sel)}</div>${workTable(work, props.length > 1)}`,
  createMenu(`<summary class="cv-plus" aria-label="Create" title="Create">${CI.plus}</summary>`), 'cvs-work')}
${planHas('invoices') ? card('Billing', `<div class="tablewrap"><table class="cv-t"><tr><th>Item</th><th>Applied to</th><th>Date</th><th class="r">Amount</th></tr>${bill.map((b) => `<tr>${b.html}</tr>`).join('') || '<tr><td colspan="4" class="empty">No invoices or payments yet</td></tr>'}
<tr class="cv-bal"><td colspan="3"><strong>Current balance</strong></td><td class="r"><strong>${money(balance)}</strong></td></tr></table></div>`, plus('cvNewInvoice', 'New invoice', ` data-id="${c.id}"`), 'need-invoices cvs-billing') : ''}
${card('Client schedule', `<div class="cv-filters"><label class="pill">Type${sel('sType', [['all', 'All'], ['job', 'Visits'], ['task', 'Tasks']])}</label><label class="pill">Status${sel('sStatus', [['all', 'All'], ['open', 'Not done'], ['done', 'Completed']])}</label></div>${schedTable(sched)}`,
  `<details class="menu cv-create need-jobs-edit"><summary class="cv-plus" aria-label="Schedule" title="Schedule">${CI.plus}</summary><div class="menu-list"><button type="button" class="mi" data-act="newJobFor" data-id="${c.id}">${QM.job}Job</button><button type="button" class="mi" data-act="propTask" data-client="${c.id}">${PI.task}Task</button></div></details>`, 'cvs-schedule')}`;
    const comms = card('Communication', msgs ? `<div class="tablewrap"><table class="cv-t"><tr><th>Sent</th><th>Message</th><th>Channel</th><th>Status</th></tr>${msgs.map((n) => `<tr class="crow" data-act="viewNotif" data-id="${n.id}"><td>${esc(fmtStamp(n.at))}</td><td><strong>${esc(n.subject || n.kind)}</strong><div class="muted">${esc(n.to || '')}</div></td><td>${n.channel === 'sms' ? 'Text' : 'Email'}</td><td>${badge(n.status)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No emails or texts yet</td></tr>'}</table></div>`
      : '<p class="muted" style="margin:0">Your access level doesn’t include the notifications log.</p>');
    main.innerHTML = `<div class="cv" data-hide="${cvHidden().join(' ')}"><div class="cv-main">
<div class="cv-top"><a class="back" href="/clients" data-link>← Clients</a>${c.archived ? '<span class="cstatus q-draft">Archived</span>' : `<span class="cstatus ${active ? 'active' : 'lead'}">${active ? 'Active' : 'Lead'}</span>`}
<div class="cv-tacts">${c.email ? `<a class="btn alt cv-sq" href="mailto:${esc(c.email)}" title="Email ${esc(c.name)}" aria-label="Email ${esc(c.name)}">${CI.mail}</a>` : ''}
<details class="menu cv-more"><summary class="btn alt cv-sq" title="More actions" aria-label="More actions"><span class="more-dots" aria-hidden="true">•••</span></summary><div class="menu-list">
${portal ? `${c.email ? `<button type="button" class="mi need-clients-edit" data-act="cvLoginEmail">${CI.mail}Send Login Email</button>` : ''}<a class="mi" href="${esc(portal)}" target="_blank" rel="noopener">${CI.user}Log in as Client</a><hr class="mi-sep">` : ''}
<button type="button" class="mi need-clients-edit" data-act="cvArchive">${CI.archive}${c.archived ? 'Unarchive' : 'Archive'}</button><button type="button" class="mi admin-only" data-act="cvMerge" ${D.clients.length > 1 ? '' : 'disabled'}>${CI.merge}Merge Client</button><button type="button" class="mi admin-only" data-act="delClient" data-id="${c.id}">${QM.trash}Delete Client</button>
<hr class="mi-sep"><button type="button" class="mi" data-act="cvCustomize">${CI.gear}Customize view</button></div></details>
${createMenu('<summary class="btn">+ Create</summary>')}</div></div>
<div class="cv-name"><h1>${esc(c.name)}</h1>${edit ? `<a class="icon-btn cv-ib" href="/clients/edit?id=${c.id}" data-link title="Edit client" aria-label="Edit client">${CI.edit}</a>` : ''}</div>${c.company && c.company !== c.name ? `<div class="muted cv-co">${esc(c.company)}</div>` : ''}
<div class="cv-info"><div>${field('Main phone', c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '')}${field('Email', c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '')}${field('Text messages', c.smsConsent ? `Agreed ${esc(fmtDate(c.smsConsent.at.slice(0, 10)))}` : 'Not agreed')}</div>
<div>${field('Company', esc(c.company))}${field('Lead source', esc(c.leadSource || ((c.tags || []).includes('Online booking') ? 'Online booking' : '')))}${field('Client since', c.createdAt ? fmtDate(c.createdAt.slice(0, 10)) : '')}</div></div>
<div class="cv-tabs" role="tablist"><button type="button" role="tab" class="${v.tab === 'info' ? 'on' : ''}" aria-selected="${v.tab === 'info'}" data-act="cvTab" data-t="info">Client information</button><button type="button" role="tab" class="${v.tab === 'comms' ? 'on' : ''}" aria-selected="${v.tab === 'comms'}" data-act="cvTab" data-t="comms">Communication</button></div>
${v.tab === 'comms' ? comms : info}</div>
<aside class="cv-side">
${card('Overview', `<div class="cv-ov"><strong class="money">${money(lifetime)}</strong><span class="muted">Lifetime value</span></div><div class="cv-ov"><strong class="money">${money(balance)}</strong><span class="muted">Current balance</span></div>`, '', 'need-invoices cvs-overview')}
${card('Tags', `${tags.length ? `<div class="cv-tags">${tags.map((t) => `<span class="tag">${esc(t)}${edit ? `<button type="button" data-act="cvTagDel" data-t="${esc(t)}" aria-label="Remove tag ${esc(t)}">×</button>` : ''}</span>`).join('')}</div>` : '<p class="muted" style="margin:0">This client has no tags</p>'}
${v.edit === 'tag' ? '<form class="cv-tagf"><input name="tag" placeholder="New tag" required autocomplete="off"><button class="btn sm">Add</button></form>' : ''}`, edit ? plus('cvEdit', 'Add a tag', ' data-k="tag"') : '', 'cvs-tags')}
<section class="cv-card cvs-last"><button type="button" class="cv-last" data-act="cvTab" data-t="comms"><div class="cv-ch"><h2>Last communication</h2>${CI.chev}</div>${last ? `<div class="muted">${esc(fmtStamp(last.at))}</div><div class="cv-clip">${esc(last.subject || last.kind)}</div>` : `<p class="muted" style="margin:0">${msgs ? 'No emails or texts yet' : 'See the Communication tab'}</p>`}</button></section>
${card('Notes', v.edit === 'notes' ? `<form class="cv-notef"><textarea name="notes" rows="6" placeholder="Leave an internal note for yourself or a team member">${esc(c.notes)}</textarea><div class="foot"><button type="button" class="btn alt sm" data-act="cvEdit" data-k="">Cancel</button><button class="btn sm">Save</button></div></form>`
      : c.notes ? `<div class="cv-note">${esc(c.notes)}</div>${edit ? '<button type="button" class="link-btn" data-act="cvEdit" data-k="notes">Edit note</button>' : ''}`
        : edit ? `<button type="button" class="cv-empty-note" data-act="cvEdit" data-k="notes">${CI.note}<span>Leave an internal note for yourself or a team member</span></button>` : '<p class="muted" style="margin:0">No notes</p>', '', 'cvs-notes')}
</aside></div>`;
    $$('[data-cvf]', main).forEach((s) => s.addEventListener('change', (e) => { cvState[e.target.dataset.cvf] = e.target.value; cvDraw(); }));
    const pq = $('#cvPropQ', main); let t;
    if (pq) pq.addEventListener('input', () => { clearTimeout(t); t = setTimeout(async () => { cvState.propQ = pq.value; await cvDraw(); const q = $('#cvPropQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); });
    $$('tr[data-href]', main).forEach((r) => r.addEventListener('click', (e) => { if (!e.target.closest('a, button')) navigate(r.dataset.href); }));
    const save = async (body, msg) => { await api('PUT', '/api/clients/' + c.id, body); cvState.edit = ''; toast(msg); refresh(); };
    const tf = $('.cv-tagf', main); if (tf) { tf.tag.focus(); tf.addEventListener('submit', (e) => { e.preventDefault(); save({ tags: [...new Set([...tags, ...tf.tag.value.split(',').map((x) => x.trim()).filter(Boolean)])] }, 'Tag added').catch((err) => toast(err.message, true)); }); }
    const nf = $('.cv-notef', main); if (nf) { nf.notes.focus(); nf.addEventListener('submit', (e) => { e.preventDefault(); save({ notes: nf.notes.value }, 'Note saved').catch((err) => toast(err.message, true)); }); }
  },
};
// redraw the profile with its current filters and tab (the data is already loaded)
const cvDraw = () => PAGES['/clients/view'].render($('#main'));
const cvClient = () => byId(D.clients, cvState.id);
A.cvTab = (d) => { cvState.tab = d.t; cvDraw(); };
A.cvEdit = (d) => { cvState.edit = d.k; cvDraw(); };
A.cvType = (d) => { const s = new Set(cvState.types); s.has(d.k) ? s.delete(d.k) : s.add(d.k); cvState.types = [...s]; cvDraw(); };
A.cvTagDel = async (d) => { const c = cvClient(); await api('PUT', '/api/clients/' + c.id, { tags: clientTags(c).filter((t) => t !== d.t) }); toast('Tag removed'); refresh(); };
A.cvLoginEmail = async () => { const c = cvClient(); const r = await api('POST', `/api/clients/${c.id}/portal-email`, {}); toast(r.status === 'simulated' ? 'Login email logged (email isn’t set up yet)' : `Login email sent to ${c.email}`); refresh(); };
// archived clients leave the Clients list (Status: Archived shows them) and the client picker; their records stay
A.cvArchive = async () => { const c = cvClient(); await api('PUT', '/api/clients/' + c.id, { archived: !c.archived }); toast(c.archived ? 'Client unarchived' : 'Client archived'); refresh(); };
// merge another profile into this one (the Clients list's Merge does the same for ticked clients)
A.cvMerge = () => {
  const c = cvClient(); const dup = duplicateIds().ids; const same = (o) => dup.has(c.id) && dup.has(o.id) && (o.name.trim().toLowerCase() === c.name.trim().toLowerCase() || (o.email && o.email.toLowerCase() === String(c.email).toLowerCase()) || (o.phone && o.phone.replace(/\D/g, '').slice(-10) === String(c.phone || '').replace(/\D/g, '').slice(-10)));
  const others = D.clients.filter((o) => o.id !== c.id).sort((a, b) => same(b) - same(a) || a.name.localeCompare(b.name));
  const mb = modal('Merge client', `<form><p>Choose the profile to merge into <strong>${esc(c.name)}</strong>. It’s deleted once its details are moved over.</p>
<label>Client to merge<select name="other" required><option value="">Select a client…</option>${others.map((o) => `<option value="${o.id}">${esc(o.name)}${o.email || o.phone ? ' · ' + esc(o.email || o.phone) : ''}${same(o) ? ' (possible duplicate)' : ''}</option>`).join('')}</select></label>
<p class="muted">All their quotes, jobs, invoices and messages move to ${esc(c.name)}. Empty details here (email, phone, address, company) are filled in from theirs, tags are combined, and notes are added together.</p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Merge clients</button></div></form>`);
  $('form', mb).addEventListener('submit', async (e) => {
    e.preventDefault(); await api('POST', '/api/clients/merge', { keepId: c.id, mergeIds: [e.target.other.value] }); closeModal(); toast('Clients merged'); refresh();
  });
};
// Customize view: which cards the profile shows, remembered in this browser
const CV_SECTIONS = [['properties', 'Properties'], ['contacts', 'Contacts'], ['work', 'Work overview'], ['billing', 'Billing'], ['schedule', 'Client schedule'], ['overview', 'Overview'], ['tags', 'Tags'], ['last', 'Last communication'], ['notes', 'Notes']];
const cvHidden = () => { try { return JSON.parse(localStorage.getItem('clientViewHidden')) || []; } catch (e) { return []; } };
A.cvCustomize = () => {
  const hidden = cvHidden();
  const mb = modal('Customize view', `<form><p class="muted" style="margin-top:0">Choose the cards to show on client profiles. This is saved in this browser.</p>
<div class="cv-cust">${CV_SECTIONS.map(([k, l]) => `<label><input type="checkbox" name="${k}" ${hidden.includes(k) ? '' : 'checked'}> ${l}</label>`).join('')}</div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  $('form', mb).addEventListener('submit', (e) => {
    e.preventDefault(); const off = CV_SECTIONS.map(([k]) => k).filter((k) => !e.target[k].checked);
    try { localStorage.setItem('clientViewHidden', JSON.stringify(off)); } catch (err) { /* private mode: applies until the page reloads */ }
    closeModal(); const root = $('.cv'); if (root) root.dataset.hide = off.join(' ');
  });
};
A.cvNewInvoice = (d) => navigate('/invoices/new?client=' + d.id);
A.newClient = () => navigate('/clients/new');
// from a quote, invoice or job page: open the client's profile, or edit them, in the page. In an editor, Edit client shows the
// client page in the editor's place (the unsaved quote, invoice or job comes back afterwards) and the profile opens in a new tab.
const inEditor = () => !!$('main form select[name=clientId]');
A.editClient = (d) => (inEditor() ? clientOverEditor(byId(D.clients, d.id || clientMenuId()), clientSavedInEditor) : navigate('/clients/edit?id=' + d.id));
A.viewClient = (d) => { const id = d.id || clientMenuId(); if (inEditor()) window.open('/clients/view?id=' + id, '_blank', 'noopener'); else navigate('/clients/view?id=' + id); };
// the client chosen in a quote, invoice or job being edited
const clientMenuId = () => { const s = $('main form select[name=clientId]'); if (!s || !s.value) throw new Error('Choose a client first'); return s.value; };
// the ••• on the client card of every quote, invoice and job (page and editor): view the client, or edit their details.
// Without a client it acts on the one chosen in the editor, which also offers Change property and Change client (it shows once a client is chosen).
const clientMenu = (c) => `<details class="menu client-menu noprint"><summary class="icon-btn" title="Client options" aria-label="Client options"><span class="more-dots" aria-hidden="true">•••</span></summary><div class="menu-list">
<button type="button" class="mi" data-act="viewClient"${c ? ` data-id="${c.id}"` : ''}>${QM.eye}View client profile</button><button type="button" class="mi need-clients-edit" data-act="editClient"${c ? ` data-id="${c.id}"` : ''}>${QM.sign}Edit client details</button>
${c ? '' : `<button type="button" class="mi" data-act="changeProperty">${QI('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>')}Change property</button><button type="button" class="mi danger-text" data-act="changeClient">${QM.declined}Change client</button>`}</div></details>`;
// the property (service) address of the quote, invoice or job being edited: its own address field, else the client's address
const propInput = () => $('main form [name=address]');
// the client card's Change property: one of the client's properties, or any address for this one only
A.changeProperty = () => { const c = byId(D.clients, clientMenuId()); const f = propInput() && propInput().form; if (f && clientProps(c).length) propertyPick(f, c); else changePropertyAddr(); };
function changePropertyAddr() {
  const c = byId(D.clients, clientMenuId()); const inp = propInput(); if (!inp) return;
  const mb = modal('Change property', `<form><label>Property address<input name="address" value="${esc(inp.value || c.address || '')}" placeholder="Street, city, state, ZIP" autocomplete="off"></label>
<div class="cmap" hidden><iframe title="Map of the property address" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
<p class="muted" style="font-size:13px">For this ${inp.form._kind || 'job'} only. ${c.address ? `The client’s address is ${esc(c.address)}.` : 'The client has no address on file.'}</p>
<div class="foot">${c.address ? '<button type="button" class="btn alt" data-use-client>Use client’s address</button>' : ''}<button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  clientMap(mb); const f = $('form', mb);
  // quotes and invoices: blank follows the client's address
  const set = (v) => { inp.value = inp.type === 'hidden' && v === c.address ? '' : v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); closeModal(); };
  f.addEventListener('submit', (e) => { e.preventDefault(); set(f.address.value.trim()); });
  const same = $('[data-use-client]', mb); if (same) same.addEventListener('click', () => set(c.address));
}
A.changeClient = () => { const s = $('main form select[name=clientId]'); if (s && s._changeClient) s._changeClient(); };
// the client picker on quotes, invoices and jobs: a searchable list (name, address, email and phone, Active / Lead) with
// "Create new client" at the bottom. It drives the form's own <select name=clientId>, which stays hidden, so saving and the
// forms' change listeners work as before. Added to every such select as it appears (pages, editors and phone sheets).
// On a quote, invoice or job editor's client card, a chosen client shows as their name (the ••• menu's Change client brings the list back).
function clientPick(sel) {
  sel.dataset.cpick = '1'; sel.classList.add('cpick-native'); sel.tabIndex = -1;
  const box = document.createElement('div'); box.className = 'cpick';
  box.innerHTML = `<input class="cpick-in" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-label="Client" placeholder="Select a client" autocomplete="off">
<div class="cpick-pop" hidden><div class="cpick-list" role="listbox"></div>${canDo('clients.edit') ? `<button type="button" class="cpick-new"><span aria-hidden="true">+</span> Create new client</button>` : ''}</div><div class="cpick-err" hidden>Choose a client</div>`;
  sel.after(box);
  const card = sel.closest('.qclient-pick'); let changing = false; let chosen = null;
  if (card) { chosen = document.createElement('div'); chosen.className = 'cpick-chosen'; chosen.innerHTML = '<strong></strong><span class="cdot"></span>'; box.before(chosen); }
  const input = $('.cpick-in', box); const pop = $('.cpick-pop', box); const list = $('.cpick-list', box); const err = $('.cpick-err', box);
  let hits = []; let at = -1;
  const label = () => {
    input.value = sel.value ? clientName(sel.value) : ''; if (!card) return;
    const c = byId(D.clients, sel.value); card.classList.toggle('picked', !!c && !changing); if (!c) return;
    const active = (clientInfo()[c.id] || {}).active; $('strong', chosen).textContent = c.name;
    const dot = $('.cdot', chosen); dot.className = 'cdot ' + (active ? 'active' : 'lead'); dot.title = active ? 'Active client' : 'Lead';
  };
  const draw = () => {
    const q = input.value.trim().toLowerCase(); const cur = byId(D.clients, sel.value); const info = clientInfo();
    hits = D.clients.filter((c) => (!c.archived || c.id === sel.value) && (!q || (cur && q === cur.name.toLowerCase()) || [c.name, c.company, c.email, c.phone, c.address].some((v) => String(v || '').toLowerCase().includes(q))))
      .sort((a, b) => a.name.localeCompare(b.name));
    at = Math.max(0, hits.findIndex((c) => c.id === sel.value));
    list.innerHTML = hits.length ? hits.map((c, i) => { const contact = [c.email, c.phone].filter(Boolean).map(esc).join(' · '); const active = info[c.id] && info[c.id].active;
      return `<div class="cpick-opt${i === at ? ' on' : ''}" role="option" id="cpo-${c.id}" data-id="${c.id}" aria-selected="${c.id === sel.value}"><div class="cpick-txt"><strong>${esc(c.name)}</strong>${c.address || c.company ? `<span>${esc(c.address || c.company)}</span>` : ''}${contact ? `<span>${contact}</span>` : ''}</div><span class="cstatus ${active ? 'active' : 'lead'}">${active ? 'Active' : 'Lead'}</span></div>`; }).join('')
      : `<div class="cpick-none">${D.clients.length ? 'No clients match' : 'No clients yet'}</div>`;
  };
  const mark = () => { $$('.cpick-opt', list).forEach((o, i) => o.classList.toggle('on', i === at)); const o = $$('.cpick-opt', list)[at]; if (o) { o.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', o.id); } };
  const open = () => { if (!pop.hidden) return; draw(); pop.hidden = false; input.setAttribute('aria-expanded', 'true'); input.select(); mark(); };
  const close = () => { changing = false; pop.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); label(); };
  const choose = (id) => {
    if (!$(`option[value="${id}"]`, sel)) sel.insertAdjacentHTML('beforeend', `<option value="${id}">${esc(clientName(id))}</option>`); // a client just created
    sel.value = id; err.hidden = true; box.classList.remove('bad'); close(); sel.dispatchEvent(new Event('change', { bubbles: true }));
  };
  input.addEventListener('focus', open); input.addEventListener('click', open);
  input.addEventListener('input', () => { if (pop.hidden) open(); draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (pop.hidden) return open(); at = Math.max(0, Math.min(hits.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1))); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (!pop.hidden && hits[at]) choose(hits[at].id); }
    else if (e.key === 'Escape' && !pop.hidden) { e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close();
  });
  list.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the box while choosing
  list.addEventListener('click', (e) => { const o = e.target.closest('.cpick-opt'); if (o) choose(o.dataset.id); });
  const add = $('.cpick-new', box);
  if (add) { add.addEventListener('mousedown', (e) => e.preventDefault()); add.addEventListener('click', () => { const typed = input.value.trim(); close(); clientOverEditor(hits.length || !typed ? {} : { firstName: typed.split(' ')[0], lastName: typed.split(' ').slice(1).join(' ') }, (c) => { clientSavedInEditor(c); choose(c.id); }); }); }
  document.addEventListener('mousedown', (e) => { if (!pop.hidden && !box.contains(e.target)) close(); });
  sel.addEventListener('change', () => { if (pop.hidden) label(); });
  sel.addEventListener('invalid', (e) => { e.preventDefault(); err.hidden = false; box.classList.add('bad'); input.focus(); }); // the hidden select can't show the browser's own message
  sel._changeClient = () => { const m = card && $('details', card); if (m) m.open = false; changing = true; label(); input.focus(); };
  label(); propertyField(sel);
}
new MutationObserver(() => $$('select[name=clientId]:not([data-cpick])').forEach(clientPick)).observe(document.body, { childList: true, subtree: true });
A.delClient = async (d) => { if (!confirm('Delete this client? Their quotes, jobs and invoices stay in the system.')) return; await api('DELETE', '/api/clients/' + d.id); closeModal(); toast('Client deleted'); curPath().startsWith('/clients/') ? navigate('/clients') : refresh(); };

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
/* ===== invoice editor (layout modeled on Jobber's invoice page) ===== */
const TERMS = [['0', 'Due upon receipt'], ['7', 'Net 7'], ['14', 'Net 14'], ['15', 'Net 15'], ['30', 'Net 30'], ['45', 'Net 45'], ['60', 'Net 60'], ['custom', 'Custom date']];
// deposit paid on the quote behind the linked job, credited on that job's first invoice (mirrors invoiceCredits on the server)
function invDepositCredit(inv, jobId, total) {
  const job = byId(D.jobs, jobId); const q = job && job.quoteId && byId(D.quotes, job.quoteId);
  if (!q || !q.depositPaidAt) return null;
  const earlier = D.invoices.filter((i) => i.jobId === jobId && i.id !== inv.id && (!inv.id || (i.createdAt || '') < (inv.createdAt || '') || ((i.createdAt || '') === (inv.createdAt || '') && String(i.number) < String(inv.number))));
  if (earlier.length) return null;
  return { amount: Math.min(total, round2(Number(q.depositPaidAmount ?? q.depositFee) || 0)), date: q.depositPaidAt, quote: q.number, quoteId: q.id };
}
function invoiceForm(main, doc, preset) {
  const d = doc || {}; const p = preset || {}; const items = d.items && d.items.length ? d.items : [{}];
  const issue = d.issueDate || ymd(new Date());
  const due = d.dueDate || issue; // new invoices default to "Due upon receipt"
  const days = Math.round((parseD(due) - parseD(issue)) / 864e5);
  const terms = d.paymentTerms || (TERMS.some(([k]) => k === String(days)) ? String(days) : 'custom');
  const st = d.id ? d.displayStatus : 'draft';
  const on = (k) => d[k] !== 'off';
  main.innerHTML = `<form class="qform iform sform"><div class="qpage"><div class="qmain">
<div class="qtop"><div class="qtop-l"><a href="/invoices" data-link class="back">← Invoices</a>${iBadge(st)}${d.zelleSentAt && d.status !== 'paid' ? '<span class="badge zelle">Zelle sent</span>' : ''}</div></div>
<input name="subject" class="qtitle" value="${esc(d.subject || '')}" placeholder="Invoice subject (e.g. Camera System Install)" aria-label="Invoice subject">
<div class="qhead"><div class="qclient"><div class="qclient-pick"><select name="clientId" required aria-label="Client">${clientOptions(d.clientId || p.clientId)}</select>${clientMenu()}</div><div class="iclient"></div><input type="hidden" name="address" value="${esc(d.address || '')}"></div>
<dl class="qmeta"><dt>Invoice #</dt><dd><input name="number" class="num-in" maxlength="30" value="${esc(d.number || '')}" placeholder="Automatic" aria-label="Invoice number" title="Leave blank for the next automatic number"></dd>
<dt>Invoice for</dt><dd><select name="jobId" aria-label="Linked job"><option value="">No job</option>${D.jobs.map((j) => `<option value="${j.id}" ${(d.jobId || p.jobId) === j.id ? 'selected' : ''}>${esc(j.number + ' · ' + j.title)}</option>`).join('')}</select></dd>
<dt>Issued</dt><dd><input type="date" name="issueDate" value="${esc(issue)}" aria-label="Issue date"></dd>
<dt>Payment terms</dt><dd><select name="paymentTerms" aria-label="Payment terms">${TERMS.map(([k, l]) => `<option value="${k}" ${terms === k ? 'selected' : ''}>${l}</option>`).join('')}</select></dd>
<dt>Due date</dt><dd><input type="date" name="dueDate" value="${esc(due)}" aria-label="Due date"></dd></dl></div>
${itemsCard(items, `<input type="hidden" name="depositCreditRemoved" value="${d.depositCreditRemoved ? 'yes' : ''}"><div class="icredit"></div>`, d)}
<div class="qcard"><h2>Client message</h2><textarea name="notes" rows="3" placeholder="A message to your client, shown on the invoice">${esc(d.notes || '')}</textarea></div>
${discCard('invoice', d.id ? d.disclaimer || '' : company.invoiceDisclaimer ?? '')}
</div>
<aside class="qside"><div class="qcard pay-c"><h3>Client payments</h3><p class="muted">How the client can pay this invoice.</p>
${planHas('onlinePayments') ? switchRow('allowCard', 'Card payments', on('allowCard') && cardReady(), cardReady() ? '' : cardHint(), !cardReady()) : ''}
${planHas('zelle') ? switchRow('allowZelle', 'Zelle', on('allowZelle') && !!company.zelleRecipient, company.zelleRecipient ? '' : zelleHint(), !company.zelleRecipient) : ''}</div>
<div class="qcard view-c"><h3>Client view</h3><p class="muted">What the client sees on their invoice.</p>
${switchRow('showQty', 'Quantities', on('showQty'))}${switchRow('showUnit', 'Unit prices', on('showUnit'))}${switchRow('showLineTotals', 'Line item totals', on('showLineTotals'))}
${switchRow('showAccountBalance', 'Account balance', on('showAccountBalance'))}${switchRow('showLateStamp', 'Late stamp (if overdue)', on('showLateStamp'))}</div>
<div class="qcard"><h3>Notes</h3><textarea name="internalNotes" rows="6" placeholder="Leave an internal note for yourself or a team member. Clients never see this.">${esc(d.internalNotes || '')}</textarea></div></aside></div>
<div class="qsave noprint"><a class="btn alt" href="/invoices${d.id ? '/view?id=' + d.id : ''}" data-link>Cancel</a><button class="btn">Save</button></div></form>`;
  const form = $('form', main);
  const clientBox = () => {
    const c = byId(D.clients, $('[name=clientId]', form).value); const job = byId(D.jobs, $('[name=jobId]', form).value);
    $('.iclient', form).innerHTML = !c ? '<div class="muted">Choose a client</div>' : `<div class="muted qlabel">Billing address</div><div class="qaddr">${esc(c.address) || '<span class="muted">No address on file</span>'}</div>
<div class="muted qlabel" style="margin-top:10px">Property address</div><div class="qaddr">${invProperty(form.address.value, job, c) ? esc(invProperty(form.address.value, job, c)) : '(Same as billing address)'}</div>
${c.phone ? `<a class="qphone" href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : ''}${c.email ? `<a class="qphone" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}`;
  };
  // deposit credit, invoice balance and the client's account balance, refreshed with the totals
  form._afterRecalc = (total) => {
    const found = invDepositCredit(d, $('[name=jobId]', form).value, total); const removed = $('[name=depositCreditRemoved]', form).value === 'yes';
    const credit = removed ? null : found; const pays = d.payments || []; const paid = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const balance = Math.max(0, round2(total - (credit ? credit.amount : 0) - paid));
    const others = D.invoices.filter((i) => i.clientId === $('[name=clientId]', form).value && i.id !== d.id && i.status !== 'paid' && i.status !== 'draft').reduce((s, i) => s + invBalance(i), 0);
    $('.icredit', form).innerHTML = `${credit ? `<div class="crow-line dep-credit"><span>Deposit collected <span class="muted">· quote ${esc(credit.quote)}, ${fmtDate(credit.date)}</span></span><span>−${money(credit.amount)}</span></div>`
      : found ? `<div class="crow-line dep-credit off"><span class="muted">Deposit of ${money(found.amount)} from quote ${esc(found.quote)} not applied</span><button type="button" class="link-btn" data-act="applyDepCredit">Apply deposit</button></div>` : ''}
${[...pays].sort((a, b) => a.date.localeCompare(b.date)).map((p) => `<div class="crow-line dep-credit"><span>Payment · ${esc(payLabel(p.method))} <span class="muted">· ${fmtDate(p.date)}${p.reference ? ' · ' + esc(p.reference) : ''}</span></span><span>−${money(p.amount)}</span></div>`).join('')}
${d.id && d.status !== 'paid' && balance > 0 ? `<div class="collect-row"><button type="button" class="btn alt sm" data-act="collectPayment" data-id="${d.id}">+ Collect payment</button></div>` : ''}
<div class="ibal"><div><strong>Invoice balance</strong><strong>${money(d.status === 'paid' ? 0 : balance)}</strong></div><div><span>Account balance (including this ${d.status === 'paid' ? 'invoice' : d.status === 'draft' || !d.id ? 'draft' : 'invoice'})</span><span>${money(others + (d.status === 'paid' ? 0 : balance))}</span></div></div>`;
  };
  wireItems(form); clientBox();
  form._doc = d; form._kind = 'invoice';
  const setDue = () => { const t = $('[name=paymentTerms]', form).value; if (t !== 'custom') $('[name=dueDate]', form).value = ymd(addDays(parseD($('[name=issueDate]', form).value || ymd(new Date())), Number(t))); };
  form.addEventListener('change', (e) => {
    if (e.target.name === 'clientId') form.address.value = ''; // a new client: their address (or the job's)
    if (e.target.name === 'clientId' || e.target.name === 'jobId' || e.target.name === 'address') { clientBox(); recalc(form); }
    if (e.target.name === 'paymentTerms' || e.target.name === 'issueDate') setDue();
    if (e.target.name === 'dueDate') $('[name=paymentTerms]', form).value = 'custom';
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    body.items = readItems(form).filter((i) => i.desc);
    if (!body.items.length) return toast('Add at least one line item', true);
    const saved = d.id ? await api('PUT', `/api/invoices/${d.id}`, body) : await api('POST', '/api/invoices', body);
    if ($('#discDefault', form).checked) { await api('PUT', '/api/company', { invoiceDisclaimer: body.disclaimer }); company.invoiceDisclaimer = body.disclaimer; }
    toast('Invoice saved'); await navigate('/invoices/view?id=' + saved.id);
  });
}
const qp = (k) => new URLSearchParams(location.search).get(k);
function docPage(kind, isNew) {
  const form = kind === 'quote' ? quoteForm : invoiceForm;
  return {
    title: `${isNew ? 'New' : 'Edit'} ${kind}`,
    async render(main) {
      if (isNew) return phoneMq.matches ? mobileNew(kind, main, { clientId: qp('client') }) : form(main, null, { clientId: qp('client') });
      const doc = byId(D[kind + 's'], qp('id'));
      if (!doc) { main.innerHTML = `<div class="card"><h1>${kind === 'quote' ? 'Quote' : 'Invoice'} not found</h1><p><a href="/${kind}s" data-link>Back to the list</a></p></div>`; return; }
      form(main, doc);
      const at = { top: '.qtitle', items: '#items', message: '[name=notes]', terms: '[name=disclaimer]', notes: '[name=internalNotes]' }[location.hash.slice(1)];
      const el = at && $(at, main); if (el) { el.closest('.qcard, .qtitle').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); }
    },
  };
}

// Contract / Disclaimer section: saved with the rest of the quote or invoice; the trash button removes it right away
// shared by the quote and invoice editors (form._kind = 'quote' | 'invoice'); the default lives in company.quoteDisclaimer / invoiceDisclaimer
const discCard = (kind, text) => `<div class="qcard disc"><div class="qcard-h"><h2>Contract / Disclaimer</h2><button type="button" class="icon-btn" data-act="discDelete" title="Remove disclaimer" aria-label="Remove disclaimer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg></button></div>
<label class="fl"><span>Description</span><textarea name="disclaimer" rows="4" placeholder="${kind === 'quote' ? 'Terms the client agrees to, e.g. how long the quote is valid' : 'e.g. Thank you for your business. Payment terms, late fees, warranty'}">${esc(text)}</textarea></label>
<div class="chk admin-only"><label><input type="checkbox" id="discDefault"> Apply to all future ${kind}s</label></div></div>`;
async function saveDisclaimer(form, text, msg) {
  const doc = form._doc; const kind = form._kind; const asDefault = $('#discDefault', form).checked;
  if (asDefault) { await api('PUT', '/api/company', { [kind + 'Disclaimer']: text }); company[kind + 'Disclaimer'] = text; }
  if (doc.id) { await api('PUT', `/api/${kind}s/${doc.id}`, { disclaimer: text, ...(form._removeSig ? { removeSignature: true } : {}) }); doc.disclaimer = text; }
  $('#discDefault', form).checked = false;
  toast(doc.id ? msg + (asDefault ? `, and set as the default for new ${kind}s` : '') : asDefault ? `Set as the default for new ${kind}s. It will be saved with this ${kind}.` : `It will be saved with this ${kind}`);
}
A.discDelete = (d, el) => {
  const form = el.closest('form'); if (!confirm(`Remove the contract / disclaimer from this ${form._kind}?`)) return;
  $('[name=disclaimer]', form).value = ''; return saveDisclaimer(form, '', 'Disclaimer removed');
};

/* ===== quote editor (layout modeled on Jobber's quote page) ===== */
const DEFAULT_DISCLAIMER = 'This quote is valid for the next 30 days, after which values may be subject to change.';
function qItemRow(it) {
  // Jobber-style row: labeled boxes (name, qty, unit cost, markup, total) with the description full width underneath and a ⋯ menu.
  // Unit cost shows $; markup shows $ when flat, or % (percent of cost) from its selector.
  return `<div class="item-row qi"><button type="button" class="drag-h" aria-label="Drag to reorder (or use the arrow keys)" title="Drag to reorder">${DRAG_DOTS}</button><label class="fl qi-name"><span>Name</span><input class="desc" autocomplete="off" placeholder="Item name or catalog service" value="${esc(it.desc || '')}"></label>
<label class="fl"><span>Quantity</span><input class="qty" type="number" step="any" min="0" value="${it.qty ?? 1}"></label>
<label class="fl"><span>Unit cost</span><div class="affix"><i>$</i><input class="cost" type="number" step="any" min="0" value="${it.cost ?? it.price ?? 0}"></div></label>
<label class="fl mk${it.markupType === 'flat' ? ' flat' : ''}"><span>Markup</span><div class="affix"><i class="pre">$</i><input class="markup" type="number" step="any" value="${it.markup ?? 0}"><select class="mtype" aria-label="Markup type"><option value="percent">%</option><option value="flat" ${it.markupType === 'flat' ? 'selected' : ''}>$</option></select></div></label>
<div class="fl amt-box"><span>Total</span><div class="amt"></div></div>
<details class="menu row-menu"><summary aria-label="Line item options" title="Line item options">⋯</summary><div class="menu-list">
<button type="button" class="danger-text" data-act="rmItem">Remove line item</button></div></details>
<label class="fl qi-desc"><span>Description</span><textarea class="details" rows="3" placeholder="Shown to the client (optional)">${esc(it.details || '')}</textarea>${aiOn() ? AI_BTN : ''}</label></div>`;
}
// Rewrite in a line's description box (bottom left): a menu of tones (Cheerful, Casual, Professional, Shorter). It drafts from the line's name,
// or rewrites what's typed there. The revert button beside it puts back what was there before the first rewrite (and Ctrl/⌘ Z still works).
// Needs the plan's AI feature and AI turned on in App Settings.
const aiOn = () => planHas('ai');
const aiIco = (d) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const AI_SPARK = aiIco('<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>');
const AI_TONES = [['cheerful', 'Cheerful', '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>'],
  ['casual', 'Casual', '<path d="M3 15h16.5a2 2 0 0 1 0 4H5a2 2 0 0 1-2-2zM3 15V9l4 1 3 3h4l5.5 2"/>'],
  ['professional', 'Professional', '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'],
  ['shorter', 'Shorter', '<path d="M4 9h6M14 9h6M4 15h16"/>']];
const AI_BTN = `<div class="ai-bar"><details class="menu ai-menu"><summary class="ai-desc" title="Rewrite the description with AI">${AI_SPARK}<span>Rewrite</span></summary><div class="menu-list"><div class="ai-h">Make this more</div>
${AI_TONES.map(([k, l, d]) => `<button type="button" class="mi" data-act="aiItemDesc" data-tone="${k}">${aiIco(d)}${l}</button>`).join('')}</div></details>
<button type="button" class="ai-undo" data-act="aiUndo" disabled aria-label="Put back the original description" title="Put back the original description">${aiIco('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>')}</button></div>`;
const setBox = (box, text) => { box.focus(); box.select(); if (!document.execCommand('insertText', false, text)) box.value = text; box.dispatchEvent(new Event('input', { bubbles: true })); }; // insertText keeps undo working
A.aiItemDesc = async (d, el) => {
  const row = el.closest('.item-row'); const name = $('.desc', row); const box = $('.details', row); const menu = $('.ai-menu', row); const sum = $('summary', menu);
  menu.open = false;
  if (!name.value.trim()) { toast('Enter the item’s name first', true); return name.focus(); }
  const svc = D.services.find((s) => s.name === name.value.trim());
  menu.classList.add('busy'); $('span', sum).textContent = 'Writing…';
  try {
    const { description } = await api('POST', '/api/services/describe', { name: name.value, type: svc ? svc.type : 'service', notes: box.value, tone: d.tone });
    if (row._aiOrig === undefined) row._aiOrig = box.value; // the text from before the first rewrite, for revert
    setBox(box, description); $('.ai-undo', row).disabled = false;
  } finally { menu.classList.remove('busy'); $('span', sum).textContent = 'Rewrite'; }
};
A.aiUndo = (d, el) => { const row = el.closest('.item-row'); if (row._aiOrig === undefined) return; setBox($('.details', row), row._aiOrig); delete row._aiOrig; el.disabled = true; };
// hidden "off" + checkbox "on" with the same name: FormData keeps the last one, so unchecked saves "off".
// A disabled switch submits nothing, leaving the saved value alone.
// card payments are set up (App Settings → Card payments); until then the switch on quotes and invoices is off and greyed out
const cardReady = () => !!(company.account && company.account.cardReady);
const cardHint = () => (['owner', 'admin'].includes(role()) ? 'Set up card payments in <a href="/settings#payments" data-link>App Settings</a>' : 'Not set up yet: ask your account owner');
// Zelle needs the business's Zelle details (App Settings → Zelle payments)
const zelleHint = () => (['owner', 'admin'].includes(role()) ? 'Add your Zelle details in <a href="/settings#zelle" data-link>App Settings</a>' : 'Not set up yet: ask your account owner');
const switchRow = (name, label, on, note, disabled) => `<label class="sw-row"><span>${label}${note ? `<small class="muted">${note}</small>` : ''}</span>${disabled ? '<input type="checkbox" class="sw" disabled>' : `<input type="hidden" name="${name}" value="off"><input type="checkbox" class="sw" name="${name}" value="on" ${on ? 'checked' : ''}>`}<i></i></label>`;
function quoteForm(main, doc, preset) {
  const d = doc || {}; const p = preset || {}; const items = d.items && d.items.length ? d.items : [{}];
  const status = d.id ? quoteStatus(d) : 'draft'; const job = d.id ? quoteJob(d) : null;
  const addr = (id) => esc((byId(D.clients, id) || {}).address || '');
  main.innerHTML = `<form class="qform sform"><div class="qpage"><div class="qmain">
<div class="qtop"><div class="qtop-l"><a href="/quotes" data-link class="back">← Quotes</a>${qBadge(status)}</div></div>
<input name="title" class="qtitle" value="${esc(d.title || '')}" placeholder="Quote title (e.g. Backyard cleanup)" aria-label="Quote title">
<div class="qhead"><div class="qclient"><div class="qclient-pick"><select name="clientId" required aria-label="Client">${clientOptions(d.clientId || p.clientId)}</select>${clientMenu()}</div>
<div class="muted qlabel">Property address</div><div class="qaddr">${esc(d.address || '') || addr(d.clientId || p.clientId) || '<span class="muted">Choose a client</span>'}</div><input type="hidden" name="address" value="${esc(d.address || '')}"></div>
<dl class="qmeta"><dt>Quote #</dt><dd><input name="number" class="num-in" maxlength="30" value="${esc(d.number || '')}" placeholder="Automatic" aria-label="Quote number" title="Leave blank for the next automatic number"></dd>
<dt>Created</dt><dd>${fmtDate((d.createdAt || ymd(new Date())).slice(0, 10))}</dd>
<dt>Status</dt><dd><select name="status" aria-label="Status">${['draft', 'sent', 'approved', 'declined'].map((s) => `<option value="${s}" ${(d.status || 'draft') === s ? 'selected' : ''}>${Q_STATUS[s]}</option>`).join('')}</select></dd></dl></div>
${itemsCard(items, `${optRow({ label: 'Deposit', name: 'deposit', value: d.depositValue ?? d.depositFee, type: d.depositType, pctLabel: '% of total' })}<div class="dep-out muted"></div>${d.depositPaidAt ? `<div class="crow-line dep-credit"><span>Deposit collected <span class="muted">· ${fmtDate(d.depositPaidAt)}</span></span><span>−${money(depositPaid(d))}</span></div>` : ''}`, d)}
<div class="qcard"><h2>Client message</h2><textarea name="notes" rows="3" placeholder="A message to your client, shown on the quote">${esc(d.notes || '')}</textarea></div>
${discCard('quote', d.id ? d.disclaimer || '' : company.quoteDisclaimer ?? DEFAULT_DISCLAIMER)}
</div>
<aside class="qside"><div class="qcard pay-c"><h3>Client payments</h3><p class="muted">How the client can pay this quote's deposit.</p>
${planHas('onlinePayments') ? switchRow('allowCard', 'Card payments', d.allowCard !== 'off' && cardReady(), cardReady() ? '' : cardHint(), !cardReady()) : ''}
${planHas('zelle') ? switchRow('allowZelle', 'Zelle', d.allowZelle !== 'off' && !!company.zelleRecipient, company.zelleRecipient ? '' : zelleHint(), !company.zelleRecipient) : ''}</div>
<div class="qcard"><h3>Notes</h3><textarea name="internalNotes" rows="6" placeholder="Leave an internal note for yourself or a team member. Clients never see this.">${esc(d.internalNotes || '')}</textarea></div></aside></div>
<div class="qsave noprint"><a class="btn alt" href="/quotes${d.id ? '/view?id=' + d.id : ''}" data-link>Cancel</a><button class="btn">Save</button></div></form>`;
  const form = $('form', main); wireItems(form);
  form._doc = d; form._kind = 'quote';
  if (qp('unsign') === '1') form._removeSig = true; // confirmed on the quote page before opening the editor
  if (d.id && d.signedAt && d.depositPaidAt) guardSignature(form);
  form.addEventListener('change', (e) => {
    if (e.target.name === 'clientId') form.address.value = ''; // a new client: their address
    if (e.target.name === 'clientId' || e.target.name === 'address') $('.qaddr', form).innerHTML = esc(form.address.value) || addr(form.clientId.value) || '<span class="muted">No address on file</span>';
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    body.items = readItems(form).filter((i) => i.desc); if (form._removeSig) body.removeSignature = true;
    if (!body.items.length) return toast('Add at least one line item', true);
    const saved = d.id ? await api('PUT', `/api/quotes/${d.id}`, body) : await api('POST', '/api/quotes', body);
    if ($('#discDefault', form).checked) { await api('PUT', '/api/company', { quoteDisclaimer: body.disclaimer }); company.quoteDisclaimer = body.disclaimer; }
    toast('Quote saved'); await navigate('/quotes/view?id=' + saved.id);
  });
}
// a signed quote with its deposit paid: the first try at changing it (not the top bar, internal notes or payment switches)
// asks to confirm that saving removes the client's signature; nothing can change until they do
function guardSignature(form) {
  const stop = (e) => {
    const t = e.target;
    if (form._removeSig || !t.closest('.qmain') || t.closest('.qtop') || !t.closest('input, select, textarea, button, label')) return;
    e.preventDefault(); e.stopPropagation(); if (e.type === 'focusin') t.blur();
    if (!$('#overlay')) signatureDialog(() => { form._removeSig = true; toast('You can edit the quote now. The signature is removed when you save a change.'); });
  };
  ['pointerdown', 'click', 'focusin', 'keydown'].forEach((ev) => form.addEventListener(ev, stop, true));
}
function signatureDialog(onConfirm) {
  const mb = modal('Signature will be removed', `<p style="margin-top:0">Editing a paid quote will remove the client’s signature.</p>
<p>To request a new signature, mark the quote as Awaiting Response, and re-send.</p>
<label style="display:flex;align-items:center;gap:8px;font-weight:400"><input type="checkbox" class="sig-ok" style="width:auto;margin:0"> I understand</label>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button type="button" class="btn danger sig-rm" disabled>Remove Signature</button></div>`);
  $('.sig-ok', mb).addEventListener('change', (e) => { $('.sig-rm', mb).disabled = !e.target.checked; });
  $('.sig-rm', mb).addEventListener('click', () => { closeModal(); onConfirm(); });
}
/* ===== quote and invoice pages at /quotes/view and /invoices/view: read-only. The pencil at the top right of a section
   turns just that section into fields, with Cancel / Save at its bottom right. Payments show as links to their payment page and can't be edited anywhere. ===== */
const PENCIL = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const SECTION_NAMES = { visit: 'scheduled visit', top: 'details', items: 'products and services', message: 'client message', terms: 'contract / disclaimer', notes: 'internal notes', payments: 'client payments', clientView: 'client view' };
const editBtn = (kind, d, sec) => `<button type="button" class="icon-btn sec-edit${kind === 'job' ? ' need-jobs-edit' : ''}" data-act="editDoc" data-kind="${kind}" data-id="${d.id}" data-sec="${sec}" title="Edit ${SECTION_NAMES[sec]}" aria-label="Edit ${SECTION_NAMES[sec]}">${PENCIL}</button>`;
// a signed quote with its deposit paid: confirm first that editing removes the client's signature
A.editDoc = (x) => {
  const q = x.kind === 'quote' && byId(D.quotes, x.id);
  if (q && q.signedAt && q.depositPaidAt) return signatureDialog(() => editSection(x.kind, x.id, x.sec, true));
  return editSection(x.kind, x.id, x.sec);
};
// one section in edit mode on the quote / invoice page: the full editor is built (so its totals, deposit and client logic all work),
// then every other section is hidden behind its read-only copy from the page. Save sends the whole form, as the editor does.
function editSection(kind, id, sec, unsign) {
  const d = byId(D[kind + 's'], id); if (!d) return;
  const main = $('#main'); const y = window.scrollY;
  ({ quote: quoteForm, invoice: invoiceForm, job: jobPage })[kind](main, d);
  const form = $('form', main); form.classList.add('qview', 'sec-mode'); if (unsign) form._removeSig = true;
  const view = document.createElement('div'); view.innerHTML = ({ quote: quotePage, invoice: invoicePage, job: jobViewPage })[kind](d);
  const shown = (k) => { const b = $(`.sec-edit[data-sec="${k}"]`, view); return b && b.closest('.qcard, .vhead'); };
  const card = (sel) => { const el = $(sel, form); return el && el.closest('.qcard'); };
  const parts = { top: [$('.qtitle', form), $('.qhead', form)], items: [card('#items')], visit: [card('[name=date]')], message: [card('[name=notes]')],
    terms: [$('.disc', form)], notes: [card('[name=internalNotes]')], payments: [$('.pay-c', form)], clientView: [$('.view-c', form)] };
  Object.keys(parts).forEach((k) => { if (!parts[k][0] || !shown(k)) delete parts[k]; }); // only what this kind has (and this person may see)
  $('.qtop', form).replaceWith($('.qtop', view));
  const sig = $('.sig-card', view); if (sig && !$('.sig-card', form)) parts.items[0].after(sig); // quotes: the form has no signature card
  Object.entries(parts).forEach(([k, els]) => { if (k === sec) return; els[0].before(shown(k)); els.forEach((el) => { el.hidden = true; }); });
  $('.qsave', form).remove();
  const last = parts[sec][parts[sec].length - 1]; const foot = '<div class="foot sec-foot"><button type="button" class="btn alt" data-act="secCancel">Cancel</button><button class="btn">Save</button></div>';
  if (sec === 'top') last.insertAdjacentHTML('afterend', foot); else last.insertAdjacentHTML('beforeend', foot);
  window.scrollTo(0, y);
  const first = $('input:not([type=hidden]), textarea, select', parts[sec][0]); if (first) first.focus({ preventScroll: true });
}
A.secCancel = () => refresh();
A.sendDoc = (x) => { const d = byId(D[x.kind + 's'], x.id); if (!(d.items || []).length) return toast('Add a line item first', true); return sendDialog(x.kind, d, x.ch); };
const depositPaid = (q) => (q.depositPaidAt ? round2(Number(q.depositPaidAmount ?? q.depositFee) || 0) : 0);
const vt = (label, value, cls = '') => `<div class="vt ${cls}"><span>${label}</span><span>${value}</span></div>`;
const payLink = (rowId, label, date, extra = '') => `<a href="/payments/view?id=${encodeURIComponent(rowId)}" data-link class="pay-link">${label}</a> • ${fmtDate(String(date).slice(0, 10))}${extra}`;
const viewItems = (d) => `<table class="vitems"><thead><tr><th>Line Item</th><th class="r">Quantity</th><th class="r">Unit Price</th><th class="r">Total</th></tr></thead><tbody>
${(d.items || []).map((i) => `<tr><td><strong>${esc(i.desc)}</strong>${i.details ? `<div class="vd">${esc(i.details)}</div>` : ''}</td><td class="r">${esc(i.qty)}</td><td class="r">${money(i.price)}</td><td class="r">${money(round2(i.qty * i.price))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No line items</td></tr>'}</tbody></table>`;
const viewTotals = (d) => vt('Subtotal', money(d.subtotal || 0)) + (d.discount ? vt(`Discount${d.discountType === 'percent' ? ` (${d.discountValue}%)` : ''}`, '−' + money(d.discount)) : '')
  + vt(`Tax (${Number(d.taxRate) || 0}%)`, money(d.tax || 0)) + vt('<strong>Total</strong>', `<strong>${money(d.total || 0)}</strong>`, 'grand');
const textCard = (kind, d, sec, title, text, empty) => `<div class="qcard"><div class="qcard-h"><h2>${title}</h2>${editBtn(kind, d, sec)}</div>${text ? `<p class="vtext">${esc(text)}</p>` : `<p class="muted" style="margin:0">${empty}</p>`}</div>`;
const docCards = (kind, d) => textCard(kind, d, 'message', 'Client Message', d.notes, 'No message for the client')
  + textCard(kind, d, 'terms', 'Contract / Disclaimer', d.disclaimer, 'No contract or disclaimer')

const vpill = (on) => `<span class="vpill${on ? ' on' : ''}">${on ? 'On' : 'Off'}</span>`;
const vopts = (rows, empty) => rows.map(([l, on]) => `<div class="vopt"><span>${l}</span>${vpill(on)}</div>`).join('') || `<p class="muted" style="margin:0">${empty}</p>`;
// the right column: client payments, client view (invoices) and internal notes, each with its pencil
const docSide = (kind, d) => {
  const on = (k) => d[k] !== 'off';
  const pays = [planHas('onlinePayments') ? ['Card payments', on('allowCard') && cardReady()] : null, planHas('zelle') ? ['Zelle', on('allowZelle') && !!company.zelleRecipient] : null].filter(Boolean);
  const view = [['showQty', 'Quantities'], ['showUnit', 'Unit prices'], ['showLineTotals', 'Line item totals'], ['showAccountBalance', 'Account balance'], ['showLateStamp', 'Late stamp (if overdue)']].map(([k, l]) => [l, on(k)]);
  return `<aside class="qside"><div class="qcard"><div class="qcard-h"><h2>Client payments</h2>${editBtn(kind, d, 'payments')}</div>${vopts(pays, 'No online payment options on your plan')}</div>
${kind === 'invoice' ? `<div class="qcard"><div class="qcard-h"><h2>Client view</h2>${editBtn(kind, d, 'clientView')}</div>${vopts(view)}</div>` : ''}
${textCard(kind, d, 'notes', 'Internal Notes', d.internalNotes, 'No internal notes. Clients never see these.')}</aside>`;
};
function viewPage(kind) {
  return {
    title: kind === 'quote' ? 'Quote' : 'Invoice',
    async render(main) {
      const d = byId(D[kind + 's'], qp('id'));
      if (!d) { main.innerHTML = `<div class="card"><h1>${kind === 'quote' ? 'Quote' : 'Invoice'} not found</h1><p><a href="/${kind}s" data-link>Back to the list</a></p></div>`; return; }
      main.innerHTML = phoneMq.matches ? mobileDocPage(kind, d) : (kind === 'quote' ? quotePage : invoicePage)(d);
    },
  };
}
// the quote page's More menu (modeled on Jobber's): job and copy, Send as…, Mark as…, then preview, signature, PDF and delete
const QI = (d, cls = '') => `<svg class="mi-ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const QM = {
  job: QI('<path d="M15 12l-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9"/><path d="M17.64 15L22 10.64"/><path d="M20.91 11.7l-1.25-1.25a3.2 3.2 0 0 1-.93-2.25v-.86L16 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>', 'ok'),
  goJob: QI('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  copy: QI('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  email: QI('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/>'),
  text: QI('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  awaiting: QI('<path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9"/><path d="M22 7l-10 6L2 7"/><path d="M16 19h6M19 16v6"/>'),
  approved: QI('<path d="M20 6L9 17l-5-5"/>', 'ok'),
  declined: QI('<path d="M18 6L6 18M6 6l12 12"/>'),
  pay: QI('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>', 'ok'),
  invoice: QI('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>', 'ok'),
  calendar: QI('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  deposit: QI('<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
  eye: QI('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  sign: QI('<path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/><path d="M15 5l4 4"/>'),
  pdf: QI('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9.5 17.5c1.5-1 3-4 3.2-6.5.1-1.2-1.3-1.4-1.5-.3-.4 2.2 2.6 5.5 4.6 5.3 1.1-.1.9-1.5-.4-1.4-2.1.2-4.5 1.7-5.9 2.9z"/>', 'pdf'),
  trash: QI('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>', 'bad'),
};
function quoteMore(d, { job, canJob, c }) {
  const b = (act, icon, label, extra = '') => `<button type="button" class="mi" data-act="${act}" data-kind="quote" data-id="${d.id}" ${extra}>${QM[icon]}${label}</button>`;
  const marks = [d.status !== 'sent' ? b('markQuoteSent', 'awaiting', 'Awaiting Response') : '', d.status !== 'approved' ? b('approveQuote', 'approved', 'Approved') : '',
    d.status !== 'declined' && d.depositFee > 0 && !d.depositPaidAt ? b('markDepositPaid', 'deposit', `Deposit Paid${d.zelleSentAt ? ' (Zelle sent)' : ''}`) : ''].join('');
  return `<details class="menu more-menu"><summary class="btn alt"><span class="more-dots" aria-hidden="true">•••</span> More</summary><div class="menu-list">
${canJob ? b('quoteToJob', 'job', 'Convert to Job') : ''}${job ? `<a class="mi" href="/jobs/edit?id=${job.id}" data-link>${QM.goJob}Go to Job ${esc(job.number)}</a>` : ''}${b('copyQuote', 'copy', 'Create Similar Quote')}
<hr class="mi-sep"><div class="mi-h">Send as…</div>${b('sendDoc', 'email', 'Email', 'data-ch="email"')}${planHas('sms') && c.phone && c.smsConsent ? b('sendDoc', 'text', 'Text Message', 'data-ch="text"') : ''}
${marks ? `<hr class="mi-sep"><div class="mi-h">Mark as…</div>${marks}` : ''}
<hr class="mi-sep"><a class="mi" href="/p/quote/${d.token}" target="_blank">${QM.eye}Preview as Client</a>
${d.signedAt ? '' : `<a class="mi" href="/p/quote/${d.token}" target="_blank" title="Opens the client’s quote page, where they approve and sign">${QM.sign}Collect Signature</a>`}
<a class="mi" href="/api/quotes/${d.id}/pdf" target="_blank">${QM.pdf}Print or Save PDF</a>
${b('delDoc', 'trash', 'Delete')}</div></details>`;
}
const sendBtn = (kind, d) => (planHas('sms')
  ? `<button type="button" class="btn send-text" data-act="sendDoc" data-kind="${kind}" data-id="${d.id}" data-ch="text">${QI('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>')}Send Text</button>`
  : ''); // no texting on the plan: no button (email is under More → Send as…)
// the invoice page's More menu, laid out like the quote's
function invoiceMore(d, c) {
  const b = (act, icon, label, extra = '') => `<button type="button" class="mi" data-act="${act}" data-kind="invoice" data-id="${d.id}" ${extra}>${QM[icon]}${label}</button>`;
  const open = d.status !== 'paid';
  return `<details class="menu more-menu"><summary class="btn alt"><span class="more-dots" aria-hidden="true">•••</span> More</summary><div class="menu-list">
${open ? b('collectPayment', 'pay', 'Collect Payment') : ''}${b('copyInvoice', 'copy', 'Create Similar Invoice')}
${open ? `<hr class="mi-sep"><div class="mi-h">Send as…</div>${b('sendDoc', 'email', 'Email', 'data-ch="email"')}${planHas('sms') && c.phone && c.smsConsent ? b('sendDoc', 'text', 'Text Message', 'data-ch="text"') : ''}` : ''}
${d.status === 'draft' ? `<hr class="mi-sep"><div class="mi-h">Mark as…</div>${b('markInvoiceSent', 'awaiting', 'Awaiting Payment')}` : ''}
<hr class="mi-sep"><a class="mi" href="/pay/${d.token}" target="_blank">${QM.eye}${open ? 'Preview as Client' : 'View Receipt'}</a>
<a class="mi" href="/api/invoices/${d.id}/pdf" target="_blank">${QM.pdf}Print or Save PDF</a>
${b('delDoc', 'trash', 'Delete')}</div></details>`;
}
// Create Similar Invoice: a new draft for the same client with the same subject, line items, terms and client view (not linked to the job, so no deposit credit twice)
A.copyInvoice = async (x) => {
  const i = byId(D.invoices, x.id);
  const keep = ['clientId', 'subject', 'items', 'taxRate', 'discountType', 'discountValue', 'notes', 'disclaimer', 'internalNotes', 'allowCard', 'allowZelle', 'paymentTerms', 'showQty', 'showUnit', 'showLineTotals', 'showAccountBalance', 'showLateStamp'];
  const body = Object.fromEntries(keep.filter((k) => i[k] !== undefined).map((k) => [k, i[k]]));
  const today = ymd(new Date()); body.issueDate = today;
  if (body.paymentTerms && body.paymentTerms !== 'custom') body.dueDate = ymd(addDays(new Date(), Number(body.paymentTerms))); else { body.paymentTerms = '0'; body.dueDate = today; }
  const saved = await api('POST', '/api/invoices', body);
  toast(`Invoice ${saved.number} created`); return navigate('/invoices/view?id=' + saved.id);
};
A.markInvoiceSent = async (x) => { await api('PUT', '/api/invoices/' + x.id, { status: 'sent' }); toast('Invoice marked as awaiting payment'); return refresh(); };
// Create Similar Quote: a new draft for the same client with the same title, line items, prices and messages
A.copyQuote = async (x) => {
  const q = byId(D.quotes, x.id);
  const keep = ['clientId', 'title', 'items', 'taxRate', 'discountType', 'discountValue', 'depositType', 'depositValue', 'notes', 'disclaimer', 'internalNotes', 'allowCard', 'allowZelle'];
  const saved = await api('POST', '/api/quotes', Object.fromEntries(keep.filter((k) => q[k] !== undefined).map((k) => [k, q[k]])));
  toast(`Quote ${saved.number} created`); return navigate('/quotes/view?id=' + saved.id);
};
// Mark as Awaiting Response: back to Sent; if the client signed (and hasn't paid the deposit), they approve and sign again
A.markQuoteSent = async (x) => {
  const q = byId(D.quotes, x.id);
  if (q.signedAt && !confirm('Mark this quote as awaiting response? The client’s signature is removed and they approve and sign it again.')) return;
  await api('PUT', '/api/quotes/' + x.id, { status: 'sent' }); toast('Quote marked as awaiting response'); return refresh();
};
function quotePage(d) {
  const status = quoteStatus(d); const job = quoteJob(d); const c = byId(D.clients, d.clientId) || {};
  const canJob = d.status === 'approved' && !job && (!(d.depositFee > 0) || d.depositPaidAt); const paid = depositPaid(d);
  return `<div class="qview"><div class="qpage"><div class="qmain"><div class="qtop"><div class="qtop-l"><a href="/quotes" data-link class="back">← Quotes</a>${qBadge(status)}${d.signedAt ? `<span class="vsign">✓ Signed${d.signedName ? ' by ' + esc(d.signedName) : ''} · ${fmtDate(d.signedAt)}</span>` : ''}</div>
<div class="actions">${quoteMore(d, { job, canJob, c })}
${sendBtn('quote', d)}</div></div>
<div class="vhead"><div class="vtitle-row"><h1 class="vtitle">${esc(d.title || 'Untitled quote')}</h1>${editBtn('quote', d, 'top')}</div>
<div class="qhead"><div class="qclient"><div class="vclient"><span>${esc(c.name || 'No client')}</span>${c.id ? clientMenu(c) : ''}</div><div class="muted qlabel">Property address</div><div class="qaddr">${esc(d.address || c.address || '') || '<span class="muted">No address on file</span>'}</div></div>
<dl class="qmeta"><dt>Quote #</dt><dd>${esc(d.number)}</dd><dt>Created</dt><dd>${fmtDate((d.createdAt || '').slice(0, 10))}</dd>${d.depositFee > 0 ? `<dt>Required deposit</dt><dd>${money(d.depositFee)}</dd>` : ''}</dl></div></div>
<div class="qcard"><div class="qcard-h"><h2>Product / Service</h2>${editBtn('quote', d, 'items')}</div>${viewItems(d)}
<div class="vtotals">${viewTotals(d)}${d.depositFee > 0 ? vt('Required deposit', money(d.depositFee))
    + (d.depositPaidAt ? vt(payLink('q-' + d.id, 'Deposit collected', d.depositPaidAt), '−' + money(paid)) : '')
    + vt('Outstanding deposit', money(Math.max(0, round2(d.depositFee - paid)))) : ''}</div></div>
${d.signedAt ? `<div class="qcard sig-card"><div class="qcard-h"><h2>Client signature</h2><span class="cstatus q-approved">Signed</span></div>
${d.signature ? `<div class="sig-show"><img class="sig-img" src="${esc(d.signature.file)}" alt="Signature of ${esc(d.signedName || 'the client')}"></div>` : ''}
<p class="sig-meta">Signed${d.signedName ? ` by <strong>${esc(d.signedName)}</strong>` : ''} on ${esc(fmtStamp(d.signedAt))}${d.signature && d.signature.method === 'typed' ? ' <span class="muted">· typed signature</span>' : ''}</p></div>` : ''}
${docCards('quote', d)}</div>${docSide('quote', d)}</div></div>`;
}
// an invoice's property address when it differs from the billing address: its own, else its job's
const invProperty = (own, job, c) => { const a = own || (job && job.address) || ''; return a && a !== (c || {}).address ? a : ''; };
function invoicePage(d) {
  const c = byId(D.clients, d.clientId) || {}; const job = byId(D.jobs, d.jobId); const st = d.displayStatus || d.status;
  const termsLabel = (TERMS.find(([k]) => k === String(d.paymentTerms)) || [, 'Custom date'])[1];
  const pays = [...(d.payments || [])].sort((a, b) => a.date.localeCompare(b.date));
  const others = D.invoices.filter((i) => i.clientId === d.clientId && i.id !== d.id && i.status !== 'paid' && i.status !== 'draft').reduce((s, i) => s + invBalance(i), 0);
  return `<div class="qview"><div class="qpage"><div class="qmain"><div class="qtop"><div class="qtop-l"><a href="/invoices" data-link class="back">← Invoices</a>${iBadge(st)}${d.zelleSentAt && d.status !== 'paid' ? '<span class="badge zelle">Zelle sent</span>' : ''}</div>
<div class="actions">${invoiceMore(d, c)}
${d.status !== 'paid' ? sendBtn('invoice', d) : ''}</div></div>
<div class="vhead"><div class="vtitle-row"><h1 class="vtitle">${esc(d.subject || `Invoice ${d.number}`)}</h1>${editBtn('invoice', d, 'top')}</div>
<div class="qhead"><div class="qclient"><div class="vclient"><span>${esc(c.name || 'No client')}</span>${c.id ? clientMenu(c) : ''}</div><div class="muted qlabel">Billing address</div><div class="qaddr">${esc(c.address || '') || '<span class="muted">No address on file</span>'}</div>
<div class="muted qlabel" style="margin-top:10px">Property address</div><div class="qaddr">${invProperty(d.address, job, c) ? esc(invProperty(d.address, job, c)) : '(Same as billing address)'}</div>
${c.phone || c.email ? `<div class="vclient-c">${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : ''}${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}</div>` : ''}</div>
<dl class="qmeta"><dt>Invoice #</dt><dd>${esc(d.number)}</dd>${job ? `<dt>Invoice for</dt><dd><a href="/jobs/edit?id=${job.id}" data-link>${esc(job.number + ' · ' + job.title)}</a></dd>` : ''}
<dt>Issued</dt><dd>${fmtDate(d.issueDate)}</dd><dt>Payment terms</dt><dd>${esc(termsLabel)}</dd><dt>Due date</dt><dd>${fmtDate(d.dueDate)}</dd></dl></div></div>
<div class="qcard"><div class="qcard-h"><h2>Product / Service</h2>${editBtn('invoice', d, 'items')}</div>${viewItems(d)}
<div class="vtotals">${viewTotals(d)}${d.depositApplied ? vt(payLink('q-' + d.depositQuoteId, 'Deposit collected', d.depositAppliedAt, ` <span class="muted">· quote ${esc(d.depositQuote)}</span>`), '−' + money(d.depositApplied)) : ''}
${pays.map((p) => vt(payLink(p.id, 'Payment collected', p.date, ` <span class="muted">· ${esc(payLabel(p.method))}</span>`), '−' + money(p.amount))).join('')}
${!pays.length && d.status === 'paid' && d.paidAt ? vt(payLink('i-' + d.id, 'Paid', d.paidAt, d.paymentMethod ? ` <span class="muted">· ${esc(payLabel(d.paymentMethod))}</span>` : ''), '') : ''}
${vt('Invoice balance', money(invBalance(d)), 'strong')}${vt(`Account balance <span class="muted">(including this ${d.status === 'draft' ? 'draft' : 'invoice'})</span>`, money(others + invBalance(d)))}</div></div>
${docCards('invoice', d)}</div>${docSide('invoice', d)}</div></div>`;
}
/* ===== phones: the quote and invoice pages work like an app. Tap a section to change it: a full-screen page
   (details, line items, discount, deposit, messages) or a sheet from the bottom (tax, client payments, more actions).
   Each change saves on its own. Payments only link to their payment page. ===== */
const X_ICO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const CHEV = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const ARROW = '<svg class="md-arrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
// a full-screen page (full) or a sheet that slides up from the bottom; returns its form
function mSheet(title, html, { full = false, foot = '' } = {}) {
  mClose(true);
  const o = document.createElement('div'); o.id = 'msheet'; o.className = `msheet ${full ? 'full' : 'bottom'}`;
  o.innerHTML = `<div class="ms-panel" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="ms-head"><button type="button" class="ms-x" data-act="mClose" aria-label="Close">${X_ICO}</button><h2>${esc(title)}</h2><span class="ms-sp"></span></div>
<form class="ms-body" novalidate>${html}${foot ? `<div class="ms-foot">${foot}</div>` : ''}</form></div>`;
  o.addEventListener('mousedown', (e) => { if (e.target === o) mClose(); });
  document.body.appendChild(o); document.body.classList.add('ms-open');
  requestAnimationFrame(() => o.classList.add('on'));
  return $('form', o);
}
function mClose(now) {
  const o = $('#msheet'); if (!o) return; document.body.classList.remove('ms-open');
  if (now === true) return o.remove();
  o.classList.remove('on'); setTimeout(() => o.remove(), 220);
}
A.mClose = () => mClose();
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#msheet') && !$('#overlay')) mClose(); });
const mSaveBtn = (label = 'Save') => `<button class="btn ms-save">${label}</button>`;
const mField = (label, input) => `<label class="mf"><span>${label}</span>${input}</label>`;
// a signed quote with a paid deposit: confirmed once (signature dialog) before its first change on this page
let mUnsign = '';
async function mSave(kind, d, patch, msg) {
  if (d._fromQuote) patch = { items: d.items, taxRate: d.taxRate, discountType: d.discountType, discountValue: d.discountValue, ...patch };
  await api('PUT', `/api/${kind}s/${d.id}`, { ...patch, ...(mUnsign === d.id ? { removeSignature: true } : {}) });
  mClose(); toast(msg || 'Saved'); return refresh();
}
const onSubmit = (form, fn) => form.addEventListener('submit', async (e) => {
  e.preventDefault(); const b = $('.ms-save', form); if (b) b.disabled = true;
  try { await fn(new FormData(form)); } catch (x) { toast(x.message, true); if (b) b.disabled = false; }
});
A.mEdit = (x) => {
  const kind = x.kind; const found = byId(D[kind + 's'], x.id); if (!found) return; const d = kind === 'job' ? jobDoc(found) : found;
  const open = () => M_EDIT[x.sec](kind, d, x);
  if (kind === 'quote' && d.signedAt && d.depositPaidAt && mUnsign !== d.id) return signatureDialog(() => { mUnsign = d.id; open(); });
  return open();
};
// $ / % amount pages: discount and required deposit
function mAmount(kind, d, { title, label, type, value, name, pct }) {
  const f = mSheet(title, `<div class="mseg" role="radiogroup">${[['percent', `${pct} (%)`], ['flat', 'Fixed ($)']].map(([k, l]) => `<label><input type="radio" name="${name}Type" value="${k}" ${(type === 'percent') === (k === 'percent') ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
<label class="mf mf-amt"><span>${label}</span><span class="mf-in"><b class="pre">$</b><input name="${name}Value" type="number" inputmode="decimal" step="any" min="0" value="${Number(value) > 0 ? esc(value) : ''}" placeholder="0"><b class="suf">%</b><button type="button" class="mf-clear" aria-label="Clear">${X_ICO}</button></span></label>`, { full: true, foot: mSaveBtn() });
  const sync = () => f.classList.toggle('pct', f[name + 'Type'].value === 'percent'); sync();
  f.addEventListener('change', sync); $('.mf-clear', f).addEventListener('click', () => { f[name + 'Value'].value = ''; f[name + 'Value'].focus(); });
  setTimeout(() => f[name + 'Value'].focus(), 260);
  onSubmit(f, (fd) => mSave(kind, d, { [name + 'Type']: fd.get(name + 'Type'), [name + 'Value']: Math.max(0, Number(fd.get(name + 'Value')) || 0) }));
}
function mText(kind, d, title, name, placeholder, extra = '') {
  const f = mSheet(title, `${mField(title, `<textarea name="${name}" rows="6" placeholder="${esc(placeholder)}">${esc(d[name] || '')}</textarea>`)}${extra}`, { full: true, foot: mSaveBtn() });
  const t = f[name]; const grow = () => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
  t.addEventListener('input', grow); setTimeout(() => { grow(); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }, 260);
  return f;
}
const M_EDIT = {
  details(kind, d) {
    const q = kind === 'quote';
    const f = mSheet(q ? 'Quote details' : 'Invoice details', `${mField(q ? 'Title' : 'Subject', `<input name="${q ? 'title' : 'subject'}" value="${esc((q ? d.title : d.subject) || '')}" maxlength="120">`)}
${mField('Client', `<select name="clientId">${clientOptions(d.clientId)}</select>`)}
${mField(q ? 'Quote #' : 'Invoice #', `<input name="number" value="${esc(d.number || '')}" maxlength="30">`)}
${q ? mField('Status', `<select name="status">${['draft', 'sent', 'approved', 'declined'].map((s) => `<option value="${s}" ${d.status === s ? 'selected' : ''}>${Q_STATUS[s]}</option>`).join('')}</select>`)
    : `${mField('Invoice for', `<select name="jobId"><option value="">No job</option>${D.jobs.map((j) => `<option value="${j.id}" ${d.jobId === j.id ? 'selected' : ''}>${esc(j.number + ' · ' + j.title)}</option>`).join('')}</select>`)}
${mField('Issued', `<input type="date" name="issueDate" value="${esc(d.issueDate || '')}">`)}
${mField('Payment terms', `<select name="paymentTerms">${TERMS.map(([k, l]) => `<option value="${k}" ${String(d.paymentTerms || 'custom') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
${mField('Due date', `<input type="date" name="dueDate" value="${esc(d.dueDate || '')}">`)}`}`, { full: true, foot: mSaveBtn() });
    if (!q) f.addEventListener('change', (e) => {
      const t = f.paymentTerms.value;
      if ((e.target.name === 'paymentTerms' || e.target.name === 'issueDate') && t !== 'custom') f.dueDate.value = ymd(addDays(parseD(f.issueDate.value || ymd(new Date())), Number(t)));
      if (e.target.name === 'dueDate') f.paymentTerms.value = 'custom';
    });
    onSubmit(f, (fd) => { const b = Object.fromEntries(fd); if (!b.clientId) throw new Error('Choose a client'); return mSave(kind, d, b); });
  },
  item(kind, d, x) {
    const i = x.i === '' || x.i === undefined ? -1 : Number(x.i); const it = i >= 0 ? d.items[i] : { qty: 1 };
    const f = mSheet(i >= 0 ? 'Edit line item' : 'Add line item', `<div class="item-row m-item">${mField('Name', `<input class="desc" name="desc" list="mSvc" value="${esc(it.desc || '')}" maxlength="200" autocomplete="off">`)}
<datalist id="mSvc">${D.services.map((s) => `<option value="${esc(s.name)}">`).join('')}</datalist>
<label class="mf"><span>Description</span><textarea class="details" name="details" rows="4">${esc(it.details || '')}</textarea>${aiOn() ? AI_BTN : ''}</label></div>
${mField('Unit cost', `<span class="mf-in"><b class="pre">$</b><input name="cost" type="number" inputmode="decimal" step="any" min="0" value="${it.cost ?? it.price ?? ''}" placeholder="0"></span>`)}
<div class="mseg mk-seg" role="radiogroup" aria-label="Markup type">${[['percent', 'Percent (%)'], ['flat', 'Fixed ($)']].map(([k, l]) => `<label><input type="radio" name="markupType" value="${k}" ${(it.markupType === 'flat') === (k === 'flat') ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
<label class="mf mf-mk${it.markupType === 'flat' ? ' flat' : ''}"><span>Markup</span><span class="mf-in"><b class="pre">$</b><input name="markup" type="number" inputmode="decimal" step="any" value="${it.markup ?? 0}"><b class="suf">%</b></span></label>
${mField('Quantity', `<input name="qty" type="number" inputmode="decimal" step="any" min="0" value="${esc(it.qty ?? 1)}">`)}
<div class="m-total"><span>Total</span><strong class="m-tot"></strong></div>`, { full: true, foot: `${mSaveBtn('Save Line Item')}${i >= 0 ? '<button type="button" class="btn alt ms-more" data-act="mRmItem" aria-label="Delete line item" title="Delete line item">⋯</button>' : ''}` });
    f._ctx = { kind, d, i };
    // unit price = cost plus markup (% of cost, or flat $ per unit), as on the desktop editor and the server
    const unit = () => { const c = Math.max(0, Number(f.cost.value) || 0); const m = Number(f.markup.value) || 0; return round2(f.markupType.value === 'flat' ? c + m : c * (1 + m / 100)); };
    const tot = () => { $('.m-tot', f).textContent = money(round2(unit() * (Number(f.qty.value) || 0))); }; tot();
    f.addEventListener('input', tot);
    $('.mk-seg', f).addEventListener('change', () => { $('.mf-mk', f).classList.toggle('flat', f.markupType.value === 'flat'); tot(); });
    f.desc.addEventListener('change', () => { const s = D.services.find((v) => v.name === f.desc.value.trim()); if (!s) return; if (!f.cost.value) f.cost.value = s.price; if (!f.details.value) f.details.value = s.description || ''; tot(); });
    onSubmit(f, (fd) => {
      const desc = String(fd.get('desc')).trim(); if (!desc) throw new Error('Enter the item’s name');
      const cost = Math.max(0, Number(fd.get('cost')) || 0); const markup = Number(fd.get('markup')) || 0; const markupType = fd.get('markupType') === 'flat' ? 'flat' : 'percent';
      const item = { ...(i >= 0 ? it : {}), desc, details: String(fd.get('details')), qty: Number(fd.get('qty')) || 0, cost, markup, markupType, price: unit() };
      const items = [...(d.items || [])]; if (i >= 0) items[i] = item; else items.push(item);
      return mSave(kind, d, { items }, i >= 0 ? 'Line item saved' : 'Line item added');
    });
    if (i < 0) setTimeout(() => f.desc.focus(), 260);
  },
  discount: (kind, d) => mAmount(kind, d, { title: d.discount ? 'Edit discount' : 'Add discount', label: 'Discount', type: d.discountType, value: d.discountValue, name: 'discount', pct: 'Percent' }),
  deposit: (kind, d) => mAmount(kind, d, { title: 'Required deposit', label: 'Deposit', type: d.depositType, value: d.depositValue ?? d.depositFee, name: 'deposit', pct: 'Percent' }),
  tax(kind, d) {
    const rate = Number(d.taxRate) || 0;
    const f = mSheet(rate ? `Tax (${rate}%)` : 'Tax', `<div class="ms-list">${rate ? `<button type="button" data-k="change">${CHEV('M4 7h16M4 12h10M4 17h7')}Change tax rate</button><button type="button" data-k="remove">${X_ICO}Remove tax rate</button>` : `<button type="button" data-k="change">${CHEV('M12 5v14M5 12h14')}Add tax rate</button>`}</div>`);
    f.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      if (b.dataset.k === 'remove') return mSave(kind, d, { taxRate: 0 }, 'Tax removed').catch((x) => toast(x.message, true));
      const g = mSheet('Tax rate', mField('Tax rate', `<span class="mf-in"><input name="taxRate" type="number" inputmode="decimal" step="any" min="0" value="${rate || company.taxRate || ''}" placeholder="0"><b class="suf on">%</b></span>`), { full: true, foot: mSaveBtn() });
      setTimeout(() => g.taxRate.focus(), 260);
      onSubmit(g, (fd) => mSave(kind, d, { taxRate: Math.max(0, Number(fd.get('taxRate')) || 0) }, 'Tax rate saved'));
    });
  },
  payments(kind, d) {
    const f = mSheet('Client payments', `<div class="ms-sw">${planHas('onlinePayments') ? switchRow('allowCard', 'Accept card payments', d.allowCard !== 'off' && cardReady(), cardReady() ? '' : cardHint(), !cardReady()) : ''}
${planHas('zelle') ? switchRow('allowZelle', 'Accept Zelle', d.allowZelle !== 'off' && !!company.zelleRecipient, company.zelleRecipient ? '' : zelleHint(), !company.zelleRecipient) : ''}</div>
<p class="muted ms-note">Changes here only apply to this ${kind}.</p>`, { foot: mSaveBtn() });
    onSubmit(f, (fd) => mSave(kind, d, Object.fromEntries(fd)));
  },
  clientView(kind, d) {
    const on = (k) => d[k] !== 'off';
    const f = mSheet('Client view', `<div class="ms-sw">${switchRow('showQty', 'Quantities', on('showQty'))}${switchRow('showUnit', 'Unit prices', on('showUnit'))}${switchRow('showLineTotals', 'Line item totals', on('showLineTotals'))}
${switchRow('showAccountBalance', 'Account balance', on('showAccountBalance'))}${switchRow('showLateStamp', 'Late stamp (if overdue)', on('showLateStamp'))}</div>`, { foot: mSaveBtn() });
    onSubmit(f, (fd) => mSave(kind, d, Object.fromEntries(fd)));
  },
  message(kind, d) { onSubmit(mText(kind, d, 'Client message', 'notes', `A message to your client, shown on the ${kind}`), (fd) => mSave(kind, d, { notes: fd.get('notes') }, 'Message saved')); },
  terms(kind, d) {
    const f = mText(kind, d, 'Contract / disclaimer', 'disclaimer', kind === 'quote' ? 'Terms the client agrees to, e.g. how long the quote is valid' : 'e.g. Payment terms, late fees, warranty',
      isAdminMe() ? `<label class="m-chk"><input type="checkbox" name="asDefault"> Use for all future ${kind}s</label>` : '');
    onSubmit(f, async (fd) => {
      const text = String(fd.get('disclaimer')).trim();
      if (fd.get('asDefault')) { await api('PUT', '/api/company', { [kind + 'Disclaimer']: text }); company[kind + 'Disclaimer'] = text; }
      return mSave(kind, d, { disclaimer: text }, 'Contract / disclaimer saved');
    });
  },
  notes(kind, d) { onSubmit(mText(kind, d, 'Internal notes', 'internalNotes', 'Leave a note for yourself or a team member. Clients never see this.'), (fd) => mSave(kind, d, { internalNotes: fd.get('internalNotes') }, 'Notes saved')); },
};
A.mRmItem = async (x, el) => {
  const { kind, d, i } = el.closest('form')._ctx;
  if ((d.items || []).length < 2) return toast('A ' + kind + ' needs at least one line item', true);
  if (!confirm(`Delete “${d.items[i].desc}”?`)) return;
  await mSave(kind, d, { items: d.items.filter((_, j) => j !== i) }, 'Line item deleted');
};
// ⋯: the page's other actions, in a sheet
A.mMore = (x) => {
  const q = x.kind === 'quote'; const d = byId(D[x.kind + 's'], x.id); const job = q && quoteJob(d);
  const canJob = q && d.status === 'approved' && !job && (!(d.depositFee > 0) || d.depositPaidAt);
  const item = (act, label, extra = '') => `<button type="button" data-act="${act}" data-id="${d.id}" ${extra}>${label}</button>`;
  const f = mSheet('More', `<div class="ms-list">${q ? `<a href="/p/quote/${d.token}" target="_blank">View as client</a>
${d.status === 'sent' ? item('approveQuote', 'Mark approved') : ''}
${d.status !== 'declined' && d.depositFee > 0 && !d.depositPaidAt ? item('markDepositPaid', `Record deposit payment${d.zelleSentAt ? ' (Zelle sent)' : ''}`) : ''}
${canJob ? item('quoteToJob', 'Create job') : ''}${job ? `<a href="/jobs/edit?id=${job.id}" data-link>Go to job ${esc(job.number)}</a>` : ''}`
    : `<a href="/pay/${d.token}" target="_blank">${d.status === 'paid' ? 'View receipt' : 'View pay page'}</a>${d.status !== 'paid' ? item('collectPayment', 'Collect payment') : ''}`}
<a href="/${x.kind}s/edit?id=${d.id}" data-link>Edit everything at once</a>
${item('delDoc', `Delete ${x.kind}`, `data-kind="${x.kind}" class="danger-text"`)}</div>`);
  f.addEventListener('click', (e) => { if (e.target.closest('a, button[data-act]')) mClose(true); });
};
A.mTab = (x, el) => { $$('.md-tabs button').forEach((b) => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); $$('.md-pane').forEach((p) => { p.hidden = p.dataset.pane !== x.k; }); };
const mTap = (kind, d, sec, inner, cls = '', extra = '') => `<button type="button" class="md-tap ${cls}" data-act="mEdit" data-kind="${kind}" data-id="${d.id}" data-sec="${sec}" ${extra}>${inner}</button>`;
const mRow = (l, v, cls = '') => `<div class="md-tr ${cls}"><span>${l}</span><span class="md-v">${v}</span></div>`;
const mTapRow = (kind, d, sec, l, v) => mTap(kind, d, sec, `<span>${l}</span><span class="md-v">${v}</span>`, 'md-tr');
const mTextSec = (kind, d, sec, title, text, empty) => mTap(kind, d, sec, `<span class="md-sh">${title}${ARROW}</span>${text ? `<span class="md-text">${esc(text)}</span>` : `<span class="md-text muted">${empty}</span>`}`, 'md-sec');
function mobileDocPage(kind, d) {
  if (mUnsign && mUnsign !== d.id) mUnsign = '';
  const q = kind === 'quote'; const c = byId(D.clients, d.clientId) || {};
  const job = q ? quoteJob(d) : byId(D.jobs, d.jobId); const st = q ? quoteStatus(d) : d.displayStatus || d.status;
  const canJob = q && d.status === 'approved' && !job && (!(d.depositFee > 0) || d.depositPaidAt);
  const second = q ? (job && job.createdAt ? ['Converted', job.createdAt] : d.status === 'approved' && d.respondedAt ? ['Approved', d.respondedAt] : d.sentAt ? ['Sent', d.sentAt] : null) : ['Due', d.dueDate];
  const btn = (act, label, cls = '') => `<button type="button" class="btn ${cls}" data-act="${act}" data-kind="${kind}" data-id="${d.id}">${label}</button>`;
  const acts = q ? [canJob ? btn('quoteToJob', 'Create Job') : '', btn('sendDoc', d.sentAt ? 'Resend' : 'Send')]
    : [d.status !== 'paid' ? btn('collectPayment', 'Collect Payment') : '', d.status !== 'paid' ? btn('sendDoc', d.sentAt ? 'Resend' : 'Send') : `<a class="btn" href="/pay/${d.token}" target="_blank">View Receipt</a>`];
  const items = (d.items || []).map((it, i) => mTap(kind, d, 'item', `<strong>${esc(it.desc)}</strong>${it.details ? `<span class="md-det">${esc(it.details)}</span>` : ''}<span class="md-qp"><span>${esc(it.qty)} × ${money(it.price)}</span><span>${money(round2(it.qty * it.price))}</span></span>`, 'md-item', `data-i="${i}"`)).join('');
  const paid = q ? depositPaid(d) : 0; const pays = q ? [] : [...(d.payments || [])].sort((a, b) => a.date.localeCompare(b.date));
  const totals = mRow('Subtotal', money(d.subtotal || 0), 'b')
    + mTapRow(kind, d, 'discount', `Discount${d.discount && d.discountType === 'percent' ? ` (${d.discountValue}%)` : ''}`, d.discount ? '−' + money(d.discount) : money(0))
    + mTapRow(kind, d, 'tax', `Tax${Number(d.taxRate) ? ` (${d.taxRate}%)` : ''}`, money(d.tax || 0))
    + mRow('Total', money(d.total || 0), 'grand')
    + (q ? mTapRow(kind, d, 'deposit', 'Required deposit', money(d.depositFee || 0))
      + (d.depositPaidAt ? mRow(payLink('q-' + d.id, 'Deposit collected', d.depositPaidAt), '−' + money(paid)) + mRow('Outstanding deposit', money(Math.max(0, round2((d.depositFee || 0) - paid)))) : '')
      : (d.depositApplied ? mRow(payLink('q-' + d.depositQuoteId, 'Deposit collected', d.depositAppliedAt), '−' + money(d.depositApplied)) : '')
      + pays.map((p) => mRow(payLink(p.id, 'Payment collected', p.date, ` · ${esc(payLabel(p.method))}`), '−' + money(p.amount))).join('')
      + (!pays.length && d.status === 'paid' && d.paidAt ? mRow(payLink('i-' + d.id, 'Paid', d.paidAt), '') : '')
      + mRow('Balance due', money(invBalance(d)), 'b'));
  const yes = (v) => (v ? 'Yes' : 'No');
  const paySec = planHas('onlinePayments') || planHas('zelle') ? mTap(kind, d, 'payments', `<span class="md-sh">Client payments${ARROW}</span>${planHas('onlinePayments') ? `<span class="md-kv"><small>Accept card payments</small>${yes(d.allowCard !== 'off' && cardReady())}</span>` : ''}${planHas('zelle') ? `<span class="md-kv"><small>Accept Zelle</small>${yes(d.allowZelle !== 'off' && !!company.zelleRecipient)}</span>` : ''}`, 'md-sec') : '';
  const on = (k) => d[k] !== 'off';
  const viewSec = q ? '' : mTap(kind, d, 'clientView', `<span class="md-sh">Client view${ARROW}</span><span class="md-text muted">${[['showQty', 'Quantities'], ['showUnit', 'Unit prices'], ['showLineTotals', 'Line totals'], ['showAccountBalance', 'Account balance'], ['showLateStamp', 'Late stamp']].filter(([k]) => on(k)).map(([, l]) => l).join(', ') || 'Totals only'}</span>`, 'md-sec');
  return `<div class="mdoc"><a href="/${kind}s" data-link class="md-back" aria-label="Back to ${kind}s">${CHEV('M15 18l-6-6 6-6')}</a>
<div class="md-st">${q ? qBadge(st) : iBadge(st)}${q && d.signedAt ? `<span class="vsign">✓ Signed${d.signedName ? ' by ' + esc(d.signedName) : ''}</span>` : ''}</div>
${mTap(kind, d, 'details', `<span class="md-h">${q ? 'Quote' : 'Invoice'} #${esc(d.number)} for ${esc(c.name || 'no client')} for ${money(d.total || 0)}</span>${(q ? d.title : d.subject) ? `<span class="md-sub">${esc(q ? d.title : d.subject)}</span>` : ''}
<span class="md-dates"><span><small>${q ? 'Created' : 'Issued'}</small>${fmtDate(((q ? d.createdAt : d.issueDate) || '').slice(0, 10))}</span>${second && second[1] ? `<span><small>${second[0]}</small>${fmtDate(String(second[1]).slice(0, 10))}</span>` : ''}</span>`, 'md-head')}
<div class="md-acts">${acts.filter(Boolean).join('')}<button type="button" class="btn alt md-more" data-act="mMore" data-kind="${kind}" data-id="${d.id}" aria-label="More actions">⋯</button></div>
<div class="md-tabs" role="tablist"><button type="button" role="tab" class="on" aria-selected="true" data-act="mTab" data-k="doc">${q ? 'Quote' : 'Invoice'}</button><button type="button" role="tab" aria-selected="false" data-act="mTab" data-k="notes">Notes</button></div>
<div class="md-pane" data-pane="doc"><section class="md-block"><h2 class="md-sh">Product / Service</h2><div class="md-lh"><strong>Line items</strong><button type="button" class="md-plus" data-act="mEdit" data-kind="${kind}" data-id="${d.id}" data-sec="item" data-i="" aria-label="Add line item">${CHEV('M12 5v14M5 12h14')}</button></div>${items || '<p class="muted md-empty">No line items yet. Tap + to add one.</p>'}</section>
<section class="md-block md-totals">${totals}</section>${paySec}${viewSec}
${mTextSec(kind, d, 'message', 'Client message', d.notes, 'Add a message for the client')}
${mTextSec(kind, d, 'terms', 'Contract / disclaimer', d.disclaimer, 'Add a contract or disclaimer')}</div>
<div class="md-pane" data-pane="notes" hidden>${mTextSec(kind, d, 'notes', 'Internal notes', d.internalNotes, 'Add a note. Clients never see these.')}</div></div>`;
}
phoneMq.addEventListener('change', () => { if (/^\/(quotes|invoices|jobs)(\/|$)/.test(curPath())) refresh(); });
// phones: a new quote or invoice starts with its client and title; it's saved as a draft and opens on the tap-to-edit page, at Add line item
function mobileNew(kind, main, preset) {
  const q = kind === 'quote'; const job = kind === 'job';
  main.innerHTML = `<div class="mdoc mnew"><a href="/${kind}s" data-link class="md-back" aria-label="Back to ${kind}s">${CHEV('M15 18l-6-6 6-6')}</a>
<h1 class="md-h">New ${kind}</h1><p class="muted md-lead">${job ? 'Choose who it’s for and when. You’ll set the time and team next.' : 'Choose who it’s for. You’ll add line items next.'}</p>
<form class="mnew-f" novalidate>${mField('Client', `<select name="clientId">${clientOptions(preset.clientId)}</select>`)}
${mField(kind === 'invoice' ? 'Subject' : 'Title', `<input name="${kind === 'invoice' ? 'subject' : 'title'}" maxlength="120" placeholder="${q ? 'e.g. Backyard cleanup' : job ? 'e.g. Streamer Install' : 'e.g. Camera System Install'}">`)}
${job ? mField('Date', `<input type="date" name="date" value="${esc(preset.date || ymd(new Date()))}">`) : ''}
<button class="btn ms-save">Create ${kind}</button></form></div>`;
  const f = $('form', main);
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(f)); if (!b.clientId) return toast('Choose a client', true);
    if (job && !b.title.trim()) return toast('Enter the job title', true);
    const btn = $('.ms-save', f); btn.disabled = true;
    try {
      if (job) {
        const saved = await api('POST', '/api/jobs', { ...b, startTime: '09:00', endTime: '11:00', status: 'scheduled', staffIds: [], address: (byId(D.clients, b.clientId) || {}).address || '' });
        return navigate('/jobs/edit?id=' + saved.id);
      }
      const saved = await api('POST', `/api/${kind}s`, { ...b, items: [], disclaimer: q ? company.quoteDisclaimer ?? DEFAULT_DISCLAIMER : company.invoiceDisclaimer ?? '', ...(q ? {} : { paymentTerms: '0' }) });
      await navigate(`/${kind}s/view?id=${saved.id}`);
      A.mEdit({ kind, id: saved.id, sec: 'item', i: '' });
    } catch (x) { toast(x.message, true); btn.disabled = false; }
  });
}
/* ===== phones: Quotes, Jobs and Invoices as a simple list: search, status chips, then a row per record
   (client · date | amount | title · status). The + button starts a new one. ===== */
const mAmt = (n) => (n >= 1000 ? moneyShort(n) : '$' + Math.round(n || 0).toLocaleString());
const mDay = (s) => {
  if (!s) return ''; const d = String(s).slice(0, 10); const off = (n) => ymd(addDays(new Date(), n));
  return d === off(0) ? 'Today' : d === off(-1) ? 'Yesterday' : d === off(1) ? 'Tomorrow' : parseD(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
};
let mlState = null;
function mobileList(main, o) {
  mlState = o; const st = o.status;
  const chips = [...o.statuses].sort((a, b) => (b[0] === st) - (a[0] === st)); // the chosen one first
  const rows = [...o.list].sort((a, b) => String(o.date(b) || '').localeCompare(String(o.date(a) || '')));
  main.innerHTML = `<div class="mlist"><h1 class="ml-h">${o.title}</h1>
<label class="ml-search">${svgIcon(ICONS.search, 22)}<input type="search" id="mlq" placeholder="Search ${o.plural}" value="${esc(o.q)}" aria-label="Search ${o.plural}"></label>
<div class="ml-chips" role="group" aria-label="Filter by status">${chips.map(([k, l]) => `<button type="button" class="ml-chip${k === st ? ' on' : ''}" data-act="mlChip" data-k="${k === st ? 'all' : k}" aria-pressed="${k === st}">${esc(l)}${k === st ? `<span class="ml-x" aria-label="Clear filter">${X_ICO}</span>` : ''}</button>`).join('')}</div>
<h2 class="ml-sub">${st !== 'all' ? `${esc((o.statuses.find(([k]) => k === st) || [, ''])[1])} ${o.plural}` : o.q ? 'Results' : `Recent ${o.plural}`}</h2>
<div class="ml-rows">${rows.map((x) => { const r = o.row(x); return `<button type="button" class="ml-row" data-act="mlOpen" data-href="${esc(r.href)}"><span class="ml-ic">${svgIcon(NAV_ICONS[o.path], 24)}</span>
<span class="ml-main"><strong>${esc(r.name)}</strong><span class="ml-meta">${[r.date, r.amount, r.title ? esc(r.title) : ''].filter(Boolean).join('<i>|</i>')}</span></span>
<span class="ml-st"><span>${esc(r.label)}</span><i class="cstatus ${r.cls}"></i></span></button>`; }).join('') || `<p class="muted ml-empty">${o.list.length || o.q || st !== 'all' ? `No ${o.plural} match` : `No ${o.plural} yet`}</p>`}</div>
${o.newAct ? `<button type="button" class="ml-fab ${o.newCls || ''}" data-act="${o.newAct}" aria-label="New ${o.one}">${CHEV('M12 5v14M5 12h14')}</button>` : ''}</div>`;
  let t; $('#mlq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(async () => { o.onQ(e.target.value); await refresh(); const i = $('#mlq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); });
}
A.mlChip = (x) => { mlState.onStatus(x.k); refresh(); };
A.mlOpen = (x) => navigate(x.href);

/* ===== phones: the job page, tap-to-edit like quotes and invoices. Visit, team, details, instructions,
   line items and notes each open their own page or sheet; team members without “edit jobs” only view. ===== */
// a job without its own line items shows (and starts editing from) the quote it came from
function jobDoc(j) {
  if (j.items && j.items.length) return j;
  const q = byId(D.quotes, j.quoteId);
  return q && (q.items || []).length ? { ...j, items: q.items, taxRate: q.taxRate, discountType: q.discountType, discountValue: q.discountValue, subtotal: q.subtotal, discount: q.discount, tax: q.tax, total: q.total, _fromQuote: true } : j;
}
// the checks the job page makes before saving a visit: times, overlapping jobs, time off, working hours
function jobScheduleOk(id, body) {
  if (!body.anytime && body.endTime <= body.startTime) { toast('End time must be after start time', true); return false; }
  const clash = jobConflicts({ id, ...body });
  if (clash.length && !confirm(`Schedule conflict: ${clash.map((c) => c.number + ' ' + c.title).join(', ')} overlaps for an assigned staff member. Save anyway?`)) return false;
  const offHours = (body.staffIds || []).map((s) => byId(D.staff, s)).filter((s) => s && !withinHours(s, body.date, body.startTime, body.endTime));
  const away = (body.staffIds || []).map((s) => [byId(D.staff, s), offOn(s, body.date, body.startTime, body.endTime)]).filter(([s, r]) => s && r);
  if (away.length && !confirm(`Time off: ${away.map(([s, r]) => `${s.name} (${r.when})`).join(', ')} ${away.length === 1 ? 'has' : 'have'} approved time off then. Save anyway?`)) return false;
  if (offHours.length && !confirm(`Outside working hours: ${offHours.map((s) => s.name).join(', ')} ${offHours.length === 1 ? "isn't" : "aren't"} scheduled to work then (see Manage team). Save anyway?`)) return false;
  return true;
}
const jobTeam = (j) => D.staff.filter((s) => s.status !== 'deactivated' || (j.staffIds || []).includes(s.id));
const visitText = (j) => `${j.date ? parseD(j.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}${j.anytime ? ' · Anytime' : j.startTime ? ` · ${fmtTime(j.startTime)} – ${fmtTime(j.endTime)}` : ''}`;
Object.assign(M_EDIT, {
  jobDetails(kind, j) {
    const c = byId(D.clients, j.clientId) || {};
    const f = mSheet('Job details', `${mField('Title', `<input name="title" value="${esc(j.title || '')}" maxlength="120">`)}
${mField('Client', `<select name="clientId">${clientOptions(j.clientId)}</select>`)}
${mField('Property address', `<input name="address" value="${esc(j.address || '')}" placeholder="${esc(c.address || 'Defaults to the client’s address')}">`)}
${mField('Status', `<select name="status">${[['scheduled', 'Scheduled'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([k, l]) => `<option value="${k}" ${(j.status || 'scheduled') === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}`, { full: true, foot: mSaveBtn() });
    onSubmit(f, (fd) => {
      const b = Object.fromEntries(fd); if (!b.clientId) throw new Error('Choose a client'); if (!b.title.trim()) throw new Error('Enter the job title');
      if (!b.address.trim()) b.address = (byId(D.clients, b.clientId) || {}).address || '';
      return mSave(kind, j, b, 'Job saved');
    });
  },
  visit(kind, j) {
    const f = mSheet('Scheduled visit', `${mField('Date', `<input type="date" name="date" value="${esc(j.date || ymd(new Date()))}">`)}
<div class="m-two">${mField('Start', `<input type="time" name="startTime" value="${esc(j.startTime || '09:00')}">`)}${mField('End', `<input type="time" name="endTime" value="${esc(j.endTime || '11:00')}">`)}</div>
<label class="m-chk"><input type="checkbox" name="anytime" ${j.anytime ? 'checked' : ''}> Anytime that day (no set time)</label>`, { full: true, foot: mSaveBtn() });
    onSubmit(f, (fd) => {
      const b = { date: fd.get('date'), startTime: fd.get('startTime'), endTime: fd.get('endTime'), anytime: !!fd.get('anytime') };
      if (!b.date) throw new Error('Choose a date');
      if (!jobScheduleOk(j.id, { ...j, ...b })) { const s = $('.ms-save', f); if (s) s.disabled = false; return; }
      return mSave(kind, j, b, 'Visit saved');
    });
  },
  team(kind, j) {
    const team = jobTeam(j);
    const f = mSheet('Assigned team', `<div class="m-team">${team.map((s) => `<label class="m-chk"><input type="checkbox" name="staff" value="${s.id}" ${(j.staffIds || []).includes(s.id) ? 'checked' : ''}>${avatarHtml(s, 32)}<span>${esc(s.name)}</span></label>`).join('') || '<p class="muted">Add team members on Manage Team first.</p>'}</div>`, { foot: team.length ? mSaveBtn() : '' });
    onSubmit(f, (fd) => {
      const staffIds = fd.getAll('staff');
      if (!jobScheduleOk(j.id, { ...j, staffIds })) { const s = $('.ms-save', f); if (s) s.disabled = false; return; }
      return mSave(kind, j, { staffIds }, 'Team saved');
    });
  },
  instructions(kind, j) { onSubmit(mText(kind, j, 'Instructions', 'description', 'What the team needs to know for this visit'), (fd) => mSave(kind, j, { description: fd.get('description') }, 'Instructions saved')); },
});
// ⋯ on the job page
A.mJobMore = (x) => {
  const j = byId(D.jobs, x.id); const edit = canDo('jobs.edit');
  const f = mSheet('More', `<div class="ms-list">${!j.signature && planHas('signatures') ? `<button type="button" data-act="collectSignature" data-id="${j.id}">Collect signature</button>` : ''}
${edit ? `<button type="button" data-act="jobRemind" data-id="${j.id}">${planHas('sms') && byId(D.clients, j.clientId)?.smsConsent ? 'Text' : 'Email'} reminder to client</button>` : ''}
${planHas('invoices') ? `<button type="button" class="need-invoices" data-act="jobInvoice" data-id="${j.id}">Create invoice</button>` : ''}
${planHas('timeOff') && me && me.staffId && (j.staffIds || []).includes(me.staffId) && j.date >= ymd(new Date()) ? `<button type="button" data-act="jobRequestOff" data-id="${j.id}">Request off for this job</button>` : ''}
<a href="/calendar" data-link>Open calendar</a>${edit ? `<a href="/jobs/edit?id=${j.id}&full=1" data-link>Edit everything at once</a><button type="button" class="danger-text" data-act="delJob" data-id="${j.id}">Delete job</button>` : ''}</div>`);
  f.addEventListener('click', (e) => { if (e.target.closest('a, button[data-act]')) mClose(true); });
};
function mobileJobPage(j) {
  if (mUnsign) mUnsign = '';
  const d = jobDoc(j); const edit = canDo('jobs.edit'); const prices = canDo('jobs.prices');
  const c = byId(D.clients, j.clientId) || {}; const q = byId(D.quotes, j.quoteId); const st = jobStatus(j); const invs = jobInvoices(j);
  // read-only for team members who can't edit jobs: the same sections, not tappable
  const tap = (sec, inner, cls = '', extra = '') => (edit ? mTap('job', j, sec, inner, cls, extra) : `<div class="${cls}">${inner.replace(ARROW, '')}</div>`);
  const tapRow = (sec, l, v) => tap(sec, `<span>${l}</span><span class="md-v">${v}</span>`, 'md-tr');
  const textSec = (sec, title, text, empty) => tap(sec, `<span class="md-sh">${title}${ARROW}</span>${text ? `<span class="md-text">${esc(text)}</span>` : `<span class="md-text muted">${edit ? empty : 'None'}</span>`}`, 'md-sec');
  const btn = (act, label, cls = '') => `<button type="button" class="btn ${cls}" data-act="${act}" data-id="${j.id}">${label}</button>`;
  const acts = edit ? [j.status === 'scheduled' ? btn('completeJob', 'Mark Complete') : btn('reopenJob', 'Reopen', 'alt'), st === 'invoice' && planHas('invoices') ? btn('jobInvoice', 'Create Invoice', 'need-invoices') : ''] : [];
  const team = (j.staffIds || []).map((id) => byId(D.staff, id)).filter(Boolean);
  const items = (d.items || []).map((it, i) => tap('item', `<strong>${esc(it.desc)}</strong>${it.details ? `<span class="md-det">${esc(it.details)}</span>` : ''}<span class="md-qp"><span>${esc(it.qty)} × ${money(it.price)}</span><span>${money(round2(it.qty * it.price))}</span></span>`, 'md-item', `data-i="${i}"`)).join('');
  const paid = q ? depositPaid(q) : 0;
  const totals = (d.items || []).length ? mRow('Subtotal', money(d.subtotal || 0), 'b')
    + tapRow('discount', `Discount${d.discount && d.discountType === 'percent' ? ` (${d.discountValue}%)` : ''}`, d.discount ? '−' + money(d.discount) : money(0))
    + tapRow('tax', `Tax${Number(d.taxRate) ? ` (${d.taxRate}%)` : ''}`, money(d.tax || 0)) + mRow('Total', money(d.total || 0), 'grand')
    + (q && q.depositFee > 0 ? mRow('Required deposit', money(q.depositFee)) + (q.depositPaidAt ? mRow(payLink('q-' + q.id, 'Deposit collected', q.depositPaidAt), '−' + money(paid)) : '') + mRow('Outstanding deposit', money(Math.max(0, round2(q.depositFee - paid)))) : '') : '';
  const sig = j.signature;
  return `<div class="mdoc mjob"><a href="/jobs" data-link class="md-back" aria-label="Back to jobs">${CHEV('M15 18l-6-6 6-6')}</a>
<div class="md-st"><span class="cstatus ${J_CLASS[st]}">${J_STATUS[st]}</span>${sig ? '<span class="vsign">✓ Signed</span>' : ''}</div>
${tap('jobDetails', `<span class="md-h">Job #${esc(j.number)} for ${esc(c.name || 'no client')}${prices && jobTotal(j) !== null ? ` for ${money(jobTotal(j))}` : ''}</span>${j.title ? `<span class="md-sub">${esc(j.title)}</span>` : ''}
<span class="md-addr">${esc(j.address || c.address || '')}</span>`, 'md-head')}
${c.phone || c.email ? `<div class="md-contact">${c.phone ? `<a href="tel:${esc(c.phone)}">${CHEV('M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z')}Call</a>` : ''}${c.phone ? `<a href="sms:${esc(c.phone)}">${CHEV('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z')}Text</a>` : ''}${c.email ? `<a href="mailto:${esc(c.email)}">${CHEV('M4 4h16v16H4zM4 6l8 7 8-7')}Email</a>` : ''}${j.address || c.address ? `<a href="https://maps.google.com/?q=${encodeURIComponent(j.address || c.address)}" target="_blank" rel="noopener">${CHEV('M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z')}Map</a>` : ''}</div>` : ''}
<div class="md-acts">${acts.filter(Boolean).join('')}<button type="button" class="btn alt md-more" data-act="mJobMore" data-id="${j.id}" aria-label="More actions">⋯</button></div>
<div class="md-tabs" role="tablist"><button type="button" role="tab" class="on" aria-selected="true" data-act="mTab" data-k="doc">Job</button><button type="button" role="tab" aria-selected="false" data-act="mTab" data-k="notes">Notes</button></div>
<div class="md-pane" data-pane="doc">${tap('visit', `<span class="md-sh">Scheduled visit${ARROW}</span><span class="md-text">${esc(visitText(j))}</span>`, 'md-sec')}
${tap('team', `<span class="md-sh">Assigned team${ARROW}</span>${team.length ? `<span class="md-team">${team.map((s) => `<span>${avatarHtml(s, 28)}${esc(s.name)}</span>`).join('')}</span>` : `<span class="md-text muted">${edit ? 'Assign team members' : 'No one assigned'}</span>`}`, 'md-sec')}
${textSec('instructions', 'Instructions', j.description, 'Add instructions for the team')}
${prices ? `<section class="md-block"><h2 class="md-sh">Product / Service</h2><div class="md-lh"><strong>Line items</strong>${edit ? `<button type="button" class="md-plus" data-act="mEdit" data-kind="job" data-id="${j.id}" data-sec="item" data-i="" aria-label="Add line item">${CHEV('M12 5v14M5 12h14')}</button>` : ''}</div>${items || '<p class="muted md-empty">No line items yet.</p>'}</section>
${totals ? `<section class="md-block md-totals">${totals}</section>` : ''}` : ''}
${sig ? `<section class="md-block"><h2 class="md-sh">Client signature</h2><img class="sig-img" src="${esc(sig.file)}" alt="Signature of ${esc(sig.name)}"><p class="md-text">Signed by <strong>${esc(sig.name)}</strong> · ${esc(fmtStamp(sig.signedAt))}</p></section>`
    : planHas('signatures') ? `<button type="button" class="md-tap md-sec" data-act="collectSignature" data-id="${j.id}"><span class="md-sh">Client signature${ARROW}</span><span class="md-text muted">Collect the client’s signature</span></button>` : ''}
${prices && planHas('invoices') ? `<section class="md-block need-invoices"><div class="md-lh"><h2 class="md-sh" style="margin:0">Billing</h2>${edit ? `<button type="button" class="md-plus" data-act="jobInvoice" data-id="${j.id}" aria-label="Create invoice">${CHEV('M12 5v14M5 12h14')}</button>` : ''}</div>
${invs.map((i) => `<a class="md-inv" href="/invoices/view?id=${i.id}" data-link><span><strong>Invoice #${esc(i.number)}</strong><small>${esc(I_STATUS[i.displayStatus] || i.displayStatus)} · due ${fmtDate(i.dueDate)}</small></span><span>${money(i.total)}</span></a>`).join('') || '<p class="muted md-empty">No invoices yet. Create one when the work is done.</p>'}</section>` : ''}</div>
<div class="md-pane" data-pane="notes" hidden>${textSec('notes', 'Internal notes', j.internalNotes, 'Add a note. Clients never see these.')}</div></div>`;
}
PAGES['/quotes/new'] = docPage('quote', true); PAGES['/quotes/edit'] = docPage('quote', false);
PAGES['/invoices/new'] = docPage('invoice', true); PAGES['/invoices/edit'] = docPage('invoice', false);
PAGES['/quotes/view'] = viewPage('quote'); PAGES['/invoices/view'] = viewPage('invoice');
A.delDoc = async (d) => { if (!confirm('Delete this ' + d.kind + '?')) return; await api('DELETE', `/api/${d.kind}s/${d.id}`); closeModal(); /\/(edit|view)$/.test(curPath()) ? navigate(`/${d.kind}s`) : refresh(); };
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
    if (phoneMq.matches) return mobileList(main, { path: '/quotes', title: 'Quotes', plural: 'quotes', one: 'quote', list, q: v.q, status: v.status, statuses: order.map((s) => [s, Q_STATUS[s]]), date: (x) => x.createdAt,
      row: (x) => ({ name: cname(x), date: mDay(x.createdAt), amount: mAmt(x.total), title: x.title, label: Q_STATUS[quoteStatus(x)], cls: 'q-' + quoteStatus(x), href: '/quotes/view?id=' + x.id }),
      onStatus: (k) => { quoteView = { ...quoteView, status: k }; }, onQ: (t) => { quoteView.q = t; }, newAct: 'newQuote' });
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
    $$('.crow').forEach((r) => r.addEventListener('click', (e) => { if (!e.target.closest('input')) navigate('/quotes/view?id=' + r.dataset.id); }));
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
A.editQuote = (d) => navigate('/quotes/view?id=' + d.id);
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
    if (phoneMq.matches) return mobileList(main, { path: '/invoices', title: 'Invoices', plural: 'invoices', one: 'invoice', list, q: v.q, status: v.status, statuses: order.map((s) => [s, I_STATUS[s]]), date: (x) => x.issueDate,
      row: (x) => ({ name: cname(x), date: mDay(x.issueDate), amount: mAmt(x.total), title: invSubject(x), label: I_STATUS[x.displayStatus], cls: I_CLASS[x.displayStatus], href: '/invoices/view?id=' + x.id }),
      onStatus: (k) => { invView = { ...invView, status: k }; }, onQ: (t) => { invView.q = t; }, newAct: 'newInvoice' });
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
    $$('.crow').forEach((r) => r.addEventListener('click', () => navigate('/invoices/view?id=' + r.dataset.id)));
  },
};
A.invFilter = (d) => { invView = { ...invView, status: d.s }; refresh(); };
A.invCard = () => { invView = { ...invView, date: '30', status: 'all' }; refresh(); };
A.invSort = (d) => { invView.dir = invView.sort === d.k ? -invView.dir : (['client', 'status'].includes(d.k) ? 1 : -1); invView.sort = d.k; refresh(); };
A.exportInvoices = () => downloadCsv('invoices.csv', [['Invoice', 'Client', 'Company', 'Subject', 'Issued', 'Due', 'Status', 'Subtotal', 'Tax', 'Total', 'Balance', 'Paid on', 'Paid by'],
  ...D.invoices.map((i) => { const c = byId(D.clients, i.clientId) || {}; return [i.number, c.name || '', c.company || '', invSubject(i), i.issueDate, i.dueDate, I_STATUS[i.displayStatus], i.subtotal, i.tax, i.total, invBalance(i), i.paidAt || '', i.paymentMethod ? payLabel(i.paymentMethod) : '']; })]);
A.newInvoice = () => navigate('/invoices/new');
A.editInvoice = (d) => navigate('/invoices/view?id=' + d.id);
A.sendInvoice = (d) => sendDialog('invoice', byId(D.invoices, d.id));
// record a payment received outside the app (cash, check, Zelle…) on an invoice; part payments allowed
A.collectPayment = (d) => {
  const inv = byId(D.invoices, d.id); const owed = invBalance(inv);
  payDialog({ title: `Collect payment · ${inv.number}`, amount: owed, max: owed, method: inv.zelleSentAt ? 'zelle' : '',
    note: inv.zelleSentAt ? 'The client reported sending this by Zelle. Check your bank before recording it.' : '',
    async save(body) { const r = await api('POST', `/api/invoices/${inv.id}/payments`, body); toast(r.status === 'paid' ? `${inv.number} is paid in full` : `Payment recorded. ${money(r.balanceDue)} still owed`); refresh(); } });
};
A.markPaid = A.collectPayment;

/* ===== jobs ===== */
function jobConflicts(job) { return D.jobs.filter((j) => j.id !== job.id && j.status !== 'completed' && j.date === job.date && j.staffIds.some((s) => (job.staffIds || []).includes(s)) && j.startTime < job.endTime && job.startTime < j.endTime); }
/* ===== job page (layout modeled on Jobber's job page) at /jobs/new and /jobs/edit?id=… ===== */
/* ===== the job page at /jobs/edit (computers): read-only like the quote and invoice pages; a section's pencil edits just that
   section (editSection builds the job form behind it). New jobs, and /jobs/edit?full=1, use the whole form. ===== */
function jobMore(j) {
  const b = (act, icon, label, cls = '') => `<button type="button" class="mi ${cls}" data-act="${act}" data-id="${j.id}">${QM[icon]}${label}</button>`;
  const sms = planHas('sms') && byId(D.clients, j.clientId)?.smsConsent;
  const off = planHas('timeOff') && me && me.staffId && (j.staffIds || []).includes(me.staffId) && j.date >= ymd(new Date());
  return `<details class="menu more-menu"><summary class="btn alt"><span class="more-dots" aria-hidden="true">•••</span> More</summary><div class="menu-list">
${planHas('invoices') ? b('jobInvoice', 'invoice', 'Create Invoice', 'need-invoices') : ''}${j.signature || !planHas('signatures') ? '' : b('collectSignature', 'sign', 'Collect Signature')}
<div class="need-jobs-edit"><hr class="mi-sep"><div class="mi-h">Send as…</div>${b('jobRemind', sms ? 'text' : 'email', `${sms ? 'Text' : 'Email'} Reminder`)}</div>
<hr class="mi-sep">${off ? b('jobRequestOff', 'calendar', 'Request Off for This Job') : ''}<a class="mi" href="/calendar" data-link>${QM.calendar}Open Calendar</a>
${b('delJob', 'trash', 'Delete', 'need-jobs-edit')}</div></details>`;
}
function jobViewPage(j) {
  const d = jobDoc(j); const c = byId(D.clients, j.clientId) || {}; const q = byId(D.quotes, j.quoteId); const st = jobStatus(j);
  const team = (j.staffIds || []).map((id) => byId(D.staff, id)).filter(Boolean); const paid = q ? depositPaid(q) : 0;
  const none = (t) => `<span class="muted">${t}</span>`;
  return `<div class="qview jview"><div class="qpage"><div class="qmain"><div class="qtop"><div class="qtop-l"><a href="/jobs" data-link class="back">← Jobs</a><span class="cstatus ${J_CLASS[st]}">${J_STATUS[st]}</span>${j.signature ? '<span class="vsign">✓ Signed</span>' : ''}</div>
<div class="actions">${jobMore(j)}${j.status === 'scheduled' ? `<button type="button" class="btn need-jobs-edit" data-act="completeJob" data-id="${j.id}">Mark Complete</button>` : `<button type="button" class="btn alt need-jobs-edit" data-act="reopenJob" data-id="${j.id}">↺ Reopen Job</button>`}</div></div>
<div class="vhead"><div class="vtitle-row"><h1 class="vtitle">${esc(j.title || 'Untitled job')}</h1>${editBtn('job', j, 'top')}</div>
<div class="qhead"><div class="qclient"><div class="vclient"><span>${esc(c.name || 'No client')}</span>${c.id ? clientMenu(c) : ''}</div><div class="muted qlabel">Property address</div><div class="qaddr">${esc(j.address || c.address || '') || none('No address on file')}</div>
${c.phone || c.email ? `<div class="vclient-c">${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(fmtUsPhone(c.phone))}</a>` : ''}${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}</div>` : ''}</div>
<dl class="qmeta"><dt>Job #</dt><dd>${esc(j.number)}</dd><dt>Created</dt><dd>${fmtDate((j.createdAt || '').slice(0, 10))}</dd><dt>From quote</dt><dd>${q ? `<a href="/quotes/view?id=${q.id}" data-link>${esc(q.number)}</a>` : none('—')}</dd></dl></div></div>
${canDo('jobs.prices') ? `<div class="qcard"><div class="qcard-h"><h2>Product / Service</h2>${editBtn('job', j, 'items')}</div>${(d.items || []).length ? viewItems(d) + `<div class="vtotals">${viewTotals(d)}${q && q.depositFee > 0 ? vt('Required deposit', money(q.depositFee))
    + (q.depositPaidAt ? vt(payLink('q-' + q.id, 'Deposit collected', q.depositPaidAt), '−' + money(paid)) : '') + vt('Outstanding deposit', money(Math.max(0, round2(q.depositFee - paid)))) : ''}</div>` : '<p class="muted" style="margin:0">No line items</p>'}</div>` : ''}
<div class="qcard"><div class="qcard-h"><h2>Scheduled Visit</h2>${editBtn('job', j, 'visit')}</div><dl class="qmeta vvisit"><dt>When</dt><dd>${esc(visitText(j))}</dd>
<dt>Team</dt><dd>${team.length ? `<span class="vteam">${team.map((t) => `<span>${avatarHtml(t, 24)}${esc(t.name)}</span>`).join('')}</span>` : none('Nobody assigned yet')}</dd>
<dt>Instructions</dt><dd>${j.description ? `<p class="vtext">${esc(j.description)}</p>` : none('None')}</dd></dl></div>
${j.signature ? sigCard(j) : ''}${jobBilling(j, jobInvoices(j))}</div>
<aside class="qside">${textCard('job', j, 'notes', 'Internal Notes', j.internalNotes, 'No internal notes. Clients never see these.')}</aside></div></div>`;
}
// the Billing card (job form and job page): the job's invoices, and Create invoice
const jobBilling = (j, invs) => `<div class="qcard need-jobs-prices"><div class="qcard-h"><h2>Billing</h2>${j.id ? `<button type="button" class="btn alt sm" data-act="jobInvoice" data-id="${j.id}">+ Create invoice</button>` : ''}</div>
${!j.id ? '<p class="muted">Save the job first, then create invoices from it.</p>' : invs.length ? `<div class="tablewrap"><table class="mini"><tr><th>Invoice</th><th>Due date</th><th>Status</th><th>Subject</th><th class="r">Total</th><th class="r">Balance</th></tr>
${invs.map((i) => `<tr><td><a href="/invoices/view?id=${i.id}" data-link>${esc(i.number)}</a></td><td>${fmtDate(i.dueDate)}</td><td>${iBadge(i.displayStatus)}</td><td>${esc(invSubject(i))}</td><td class="r">${money(i.total)}</td><td class="r">${money(invBalance(i))}</td></tr>`).join('')}</table></div>`
    : '<p class="muted">No invoices yet. Create one when the work is done.</p>'}</div>`;
function jobPage(main, job, preset) {
  const j = job || {}; const p = preset || {};
  const q = byId(D.quotes, j.quoteId); const st = j.id ? jobStatus(j) : 'upcoming';
  const items = j.items && j.items.length ? j.items : q ? q.items : [{}];
  const invs = j.id ? jobInvoices(j) : [];
  const team = D.staff.filter((s) => s.status !== 'deactivated' || (j.staffIds || []).includes(s.id));
  main.innerHTML = `<form class="qform jform"><div class="qpage"><div class="qmain">
<div class="qtop"><div class="qtop-l"><a href="/jobs" data-link class="back">← Jobs</a><span class="cstatus ${J_CLASS[st]}">${J_STATUS[st]}</span></div>
<div class="actions">${j.id ? `<details class="menu"><summary class="btn alt">⋯ More</summary><div class="menu-list">
${j.signature || !planHas('signatures') ? '' : `<button type="button" data-act="collectSignature" data-id="${j.id}">Collect signature</button>`}${planHas('timeOff') && me && me.staffId && (j.staffIds || []).includes(me.staffId) && j.date >= ymd(new Date()) ? `<button type="button" data-act="jobRequestOff" data-id="${j.id}">Request off for this job</button>` : ''}
<button type="button" class="need-jobs-edit" data-act="jobRemind" data-id="${j.id}">${planHas('sms') && byId(D.clients, j.clientId)?.smsConsent ? 'Text' : 'Email'} reminder to client</button>${planHas('invoices') ? `<button type="button" class="need-invoices" data-act="jobInvoice" data-id="${j.id}">Create invoice</button>` : ''}
<a href="/calendar" data-link>Open calendar</a><button type="button" class="danger-text need-jobs-edit" data-act="delJob" data-id="${j.id}">Delete job</button></div></details>
${j.status === 'scheduled' ? `<button type="button" class="btn alt need-jobs-edit" data-act="completeJob" data-id="${j.id}">Mark complete</button>` : `<button type="button" class="btn alt need-jobs-edit" data-act="reopenJob" data-id="${j.id}">↺ Reopen job</button>`}
` : ''}</div></div>
<input name="title" class="qtitle" required value="${esc(j.title || '')}" placeholder="Job title (e.g. Streamer Install)" aria-label="Job title">
<div class="qhead"><div class="qclient"><div class="qclient-pick"><select name="clientId" required aria-label="Client">${clientOptions(j.clientId || p.clientId)}</select>${clientMenu()}</div>
<label class="fl"><span>Property address</span><input name="address" value="${esc(j.address || '')}" placeholder="Defaults to the client's address"></label><div class="jcontact"></div></div>
<dl class="qmeta"><dt>Job #</dt><dd>${j.number ? esc(j.number) : '<span class="muted">Assigned when saved</span>'}</dd>
<dt>Status</dt><dd><select name="status" aria-label="Status">${[['scheduled', 'Scheduled'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([k, l]) => `<option value="${k}" ${(j.status || 'scheduled') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></dd>
<dt>Created</dt><dd>${fmtDate((j.createdAt || ymd(new Date())).slice(0, 10))}</dd>
<dt>From quote</dt><dd>${q ? `<a href="/quotes/view?id=${q.id}" data-link>${esc(q.number)}</a>` : '<span class="muted">—</span>'}</dd></dl></div>
${!canDo('jobs.prices') ? '' : itemsCard(items, '<div class="jdeposit"></div>', j.taxRate !== undefined ? j : q || j)}
<div class="qcard"><h2>Scheduled visit</h2><div class="row3"><label>Date<input type="date" name="date" required value="${esc(j.date || p.date || ymd(new Date()))}"></label>
<label>Start<input type="time" name="startTime" value="${esc(j.startTime || '09:00')}"></label><label>End<input type="time" name="endTime" value="${esc(j.endTime || '11:00')}"></label></div>
<label class="switchline"><input type="checkbox" name="anytime" ${j.anytime ? 'checked' : ''}> Anytime that day (no set time)</label>
<div class="muted qlabel">Assigned team</div><div class="team-pick">${team.map((s) => `<label><input type="checkbox" name="staff" value="${s.id}" ${(j.staffIds || []).includes(s.id) ? 'checked' : ''}>${avatarHtml(s, 24)}${esc(s.name)}</label>`).join('') || '<span class="muted">Add team members on Manage Team first</span>'}</div>
<label>Instructions<textarea name="description" rows="3" placeholder="What the team needs to know for this visit">${esc(j.description || '')}</textarea></label></div>
${j.id && j.signature ? sigCard(j) : ''}
${jobBilling(j, invs)}</div>
<aside class="qside"><div class="qcard"><h3>Notes</h3><textarea name="internalNotes" rows="8" placeholder="Leave an internal note for yourself or a team member. Clients never see this.">${esc(j.internalNotes || '')}</textarea></div></aside></div>
<div class="qsave noprint${j.id ? ' need-jobs-edit' : ''}">${j.id ? '<button class="btn">Save</button>' : '<a class="btn alt" href="/jobs" data-link>Cancel</a><button class="btn">Save job</button>'}</div></form>`;
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
  if (!canDo('jobs.edit')) $$('input, select, textarea', form).forEach((el) => { el.disabled = true; }); // view only without “Create, edit and delete jobs”
  form.addEventListener('change', (e) => { if (e.target.name === 'clientId') contact(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = new FormData(form);
    const body = { title: fd.get('title'), clientId: fd.get('clientId'), status: fd.get('status'), address: fd.get('address') || (byId(D.clients, fd.get('clientId')) || {}).address || '', propertyId: fd.get('propertyId') || '', date: fd.get('date'), startTime: fd.get('startTime'), endTime: fd.get('endTime'), anytime: !!fd.get('anytime'), description: fd.get('description'), staffIds: fd.getAll('staff'), internalNotes: fd.get('internalNotes'), taxRate: fd.get('taxRate'), discountType: fd.get('discountType'), discountValue: fd.get('discountValue'), items: readItems(form).filter((i) => i.desc) };
    if (!jobScheduleOk(j.id, body)) return;
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
${s.statement ? `<p class="muted sig-stmt">“${esc(s.statement)}”</p>` : ''}<button type="button" class="btn danger sm need-jobs-edit" data-act="rmSignature" data-id="${j.id}">Remove signature</button>`
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
PAGES['/jobs/new'] = { title: 'New job', render: (main) => { const draft = typeof jobDraft !== 'undefined' && jobDraft; if (draft) jobDraft = null; if (!draft && phoneMq.matches) return mobileNew('job', main, { clientId: qp('client'), date: qp('date') }); jobPage(main, draft || null, { clientId: qp('client'), date: qp('date') }); } }; // a draft: Schedules → More Options
PAGES['/jobs/edit'] = {
  title: 'Job',
  render(main) {
    const j = byId(D.jobs, qp('id'));
    if (!j) { main.innerHTML = '<div class="card"><h1>Job not found</h1><p><a href="/jobs" data-link>Back to Jobs</a></p></div>'; return; }
    if (phoneMq.matches && qp('full') !== '1') { main.innerHTML = mobileJobPage(j); return; } // phones: tap-to-edit (⋯ → Edit everything at once opens this form)
    if (qp('full') === '1') return jobPage(main, j);
    main.innerHTML = jobViewPage(j);
  },
};
A.newJob = () => { closeModal(); navigate('/jobs/new'); };
A.newJobFor = (d) => { closeModal(); navigate('/jobs/new?client=' + d.id); };
A.newJobOn = (d) => !canDo('jobs.edit') || navigate('/jobs/new?date=' + d.date);
A.editJob = (d) => { closeModal(); navigate('/jobs/edit?id=' + d.id); };
A.delJob = async (d) => { if (!confirm('Delete this job?')) return; await api('DELETE', '/api/jobs/' + d.id); closeModal(); toast('Job deleted'); curPath() === '/jobs/edit' ? navigate('/jobs') : refresh(); };
A.reopenJob = async (d) => { await api('PUT', '/api/jobs/' + d.id, { status: 'scheduled' }); toast('Job reopened'); refresh(); };
A.jobInvoice = async (d) => { const inv = await api('POST', `/api/jobs/${d.id}/create-invoice`, {}); closeModal(); toast('Draft invoice created'); navigate('/invoices/view?id=' + inv.id); };
A.jobRemind = async (d) => { const r = await api('POST', `/api/jobs/${d.id}/remind`, {}); const x = r.results[0]; toast(x.status === 'simulated' ? 'Reminder logged (no message provider connected)' : x.status === 'failed' ? x.detail || 'Reminder failed' : `Reminder sent by ${x.channel === 'sms' ? 'text' : 'email'}`, x.status === 'failed'); }; // the server texts clients who agreed to texts, and emails the rest
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
    if (phoneMq.matches) return mobileList(main, { path: '/jobs', title: 'Jobs', plural: 'jobs', one: 'job', list, q: v.q, status: v.status, statuses: order.map((s) => [s, J_STATUS[s]]), date: (x) => (x.date || '') + (x.startTime || ''),
      row: (x) => ({ name: cname(x), date: mDay(x.date) + (x.anytime || !x.startTime ? '' : ' ' + fmtTime(x.startTime)), amount: canDo('jobs.prices') && jobTotal(x) !== null ? mAmt(jobTotal(x)) : '', title: x.title, label: J_STATUS[jobStatus(x)], cls: J_CLASS[jobStatus(x)], href: '/jobs/edit?id=' + x.id }),
      onStatus: (k) => { jobView = { ...jobView, status: k }; }, onQ: (t) => { jobView.q = t; }, newAct: 'newJob', newCls: 'need-jobs-edit' });
    main.innerHTML = `<div class="head"><h1>Jobs</h1><div class="actions"><button class="btn need-jobs-edit" data-act="newJob">New Job</button>
<details class="menu"><summary class="btn alt">⋯ More Actions</summary><div class="menu-list"><button data-act="exportJobs">Export to CSV</button><a href="/calendar" data-link>Open calendar</a></div></details></div></div>
<div class="cstats">
<div class="cstat"><strong class="cs-h">Overview</strong><div class="qov">${[['late', 'q-declined'], ['invoice', 'q-sent'], ['today', 'q-converted'], ['upcoming', 'q-approved']].map(([s, c]) => `<button data-act="jobFilter" data-s="${s}"><i class="dot ${c}"></i>${J_STATUS[s]} (${count(s)})</button>`).join('')}</div></div>
<button class="cstat" data-act="jobCard" data-k="recent"><div class="cs-h"><strong>Recent visits</strong><span>↗</span></div><div class="muted">Past 30 days</div><div class="cs-v">${recNow.length} ${change(recNow.length, recPrev.length)}</div><div class="muted money">${moneyShort(sum(recNow))}</div></button>
<button class="cstat" data-act="jobCard" data-k="upcoming"><div class="cs-h"><strong>Visits scheduled</strong><span>↗</span></div><div class="muted">Next 30 days</div><div class="cs-v">${upcoming.length}</div><div class="muted money">${moneyShort(sum(upcoming))}</div></button>
<div class="cstat need-invoices"><div class="cs-h"><strong>Requires invoicing</strong></div><div class="muted">Completed, not invoiced yet</div><div class="cs-v">${count('invoice')}</div><div class="muted">${moneyShort(sum(D.jobs.filter((j) => jobStatus(j) === 'invoice')))}</div></div></div>
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
