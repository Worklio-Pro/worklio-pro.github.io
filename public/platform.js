'use strict';
// Platform console: the accounts you host, the plans you sell and which features each plan includes.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.includes('/login') && !url.includes('/setup')) { boot(); throw new Error('Please log in'); }
  if (!r.ok) throw new Error(j.error || 'Something went wrong');
  return j;
}
function toast(msg, err) { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg; $('#toast').appendChild(t); setTimeout(() => t.remove(), err ? 6000 : 3200); }
function modal(title, html, { wide = false, sticky = false } = {}) {
  closeModal(); const o = document.createElement('div'); o.className = 'pf-ov'; o.id = 'ov';
  o.innerHTML = `<div class="pf-modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"${sticky ? ' data-sticky' : ''}><h2>${esc(title)}</h2>${html}</div>`;
  o.addEventListener('mousedown', (e) => { if (e.target === o && !sticky) closeModal(); }); document.body.appendChild(o);
  const f = $('input,select', o); if (f) f.focus(); return $('.pf-modal', o);
}
function closeModal() { const o = $('#ov'); if (o) o.remove(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#ov [data-sticky]')) closeModal(); });
const fmtDate = (s) => (s ? new Date(String(s).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');

let D = null; let tab = 'accounts'; let draftPlans = null; let draftBeta = null; // plans and Beta features being edited (saved with the Save button)
const plansDirty = () => JSON.stringify(draftPlans) !== JSON.stringify(D.plans) || JSON.stringify(draftBeta) !== JSON.stringify(D.betaFeatures);
const siteBrand = () => ({ name: D.settings.productName, logo: D.settings.logo || '', logoDark: D.settings.logoDark || '', logoHasName: !!(D.settings.logo && D.settings.logoHasName) });
const brandHtml = () => `${brandImg(siteBrand(), 'dark')}${siteBrand().logoHasName ? '' : esc(D.settings.productName)} <small>Alpha</small>`;
const host = (u) => String(u || '').replace(/^https?:\/\//, '');

/* ===== login / first-run setup ===== */
function authView(state, err) {
  const setup = state.needsSetup;
  $('#root').innerHTML = `<div class="pf-auth card">${state.brand && state.brand.logo ? `<div class="pf-auth-logo">${brandImg(state.brand)}</div>` : ''}<h1>${setup ? 'Create the Alpha owner' : 'Alpha'}</h1>
<p class="muted">${setup ? `This login controls every account on ${esc(state.productName)}: plans, features and billing. Keep it to yourself.` : `Log in to manage ${esc(state.productName)}.`}</p>
<form id="af">${err ? `<div class="msg err" role="alert">${esc(err)}</div>` : ''}${setup ? '<label>Your name<input name="name" required autocomplete="name"></label>' : ''}
<label>Email<input name="email" type="email" required autocomplete="username"></label>
<label>Password${setup ? ' (10+ characters)' : ''}<input name="password" type="password" required autocomplete="${setup ? 'new-password' : 'current-password'}" ${setup ? 'minlength="10"' : ''}></label>
<button class="btn">${setup ? 'Create and continue' : 'Log in'}</button></form>${setup ? '' : '<p class="pf-auth-alt"><a href="#" data-act="forgot">Forgot your password?</a></p>'}</div>`;
  A.forgot = () => forgotView(state, { step: 'email', email: $('#af [name=email]').value.trim() });
  $('#af input').focus();
  $('#af').addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target));
    try { await api('POST', setup ? '/api/platform/setup' : '/api/platform/login', b); boot(); } catch (x) { authView(state, x.message); }
  });
}

// Forgot your password? 1) your email  2) the 6-digit code we email you  3) a new password
function forgotView(state, f, err) {
  const brand = state.brand && state.brand.logo ? `<div class="pf-auth-logo">${brandImg(state.brand)}</div>` : '';
  const back = '<p class="pf-auth-alt"><a href="#" data-act="backToLogin">Back to log in</a></p>';
  const msg = err ? `<div class="msg err" role="alert">${esc(err)}</div>` : '';
  const steps = {
    email: ['Reset your password', 'Enter the email you log in with. We’ll email you a 6-digit code.', `<label>Email<input name="email" type="email" required autocomplete="username" value="${esc(f.email || '')}"></label><button class="btn">Email me a code</button>`],
    code: ['Check your email', `If <strong>${esc(f.email)}</strong> has an Alpha login, we sent it a 6-digit code. It works for 15 minutes.`, '<label>Verification code<input name="code" required inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" placeholder="123456" class="pf-code"></label><button class="btn">Continue</button><p class="pf-auth-alt"><a href="#" data-act="forgotResend">Send a new code</a></p>'],
    password: ['Choose a new password', 'Your other devices will be logged out.', '<label>New password (10+ characters)<input name="password" type="password" required minlength="10" autocomplete="new-password"></label><label>Type it again<input name="again" type="password" required minlength="10" autocomplete="new-password"></label><button class="btn">Save and log in</button>'],
  };
  const [title, lead, fields] = steps[f.step];
  $('#root').innerHTML = `<div class="pf-auth card">${brand}<h1>${title}</h1><p class="muted">${lead}</p><form id="fgf">${msg}${fields}</form>${back}</div>`;
  A.backToLogin = () => authView(state);
  A.forgotResend = async () => { try { await api('POST', '/api/platform/forgot', { email: f.email }); forgotView(state, f); toast('A new code is on its way'); } catch (x) { forgotView(state, f, x.message); } };
  $('#fgf input').focus();
  $('#fgf').addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); const btn = $('#fgf .btn'); btn.disabled = true;
    try {
      if (f.step === 'email') { await api('POST', '/api/platform/forgot', { email: b.email }); return forgotView(state, { step: 'code', email: b.email.trim().toLowerCase() }); }
      if (f.step === 'code') { const code = b.code.replace(/\D/g, ''); await api('POST', '/api/platform/forgot/verify', { email: f.email, code, check: true }); return forgotView(state, { ...f, step: 'password', code }); }
      if (b.password !== b.again) return forgotView(state, f, 'The two passwords don’t match');
      await api('POST', '/api/platform/forgot/verify', { email: f.email, code: f.code, password: b.password }); toast('Password changed'); boot();
    } catch (x) { forgotView(state, x.message.includes('Request a new one') ? { ...f, step: 'code' } : f, x.message); }
  });
}

// the link in a support user's welcome or password-reset email: /alpha?invite=…
async function inviteView(token, state) {
  const brand = state.brand && state.brand.logo ? `<div class="pf-auth-logo">${brandImg(state.brand)}</div>` : '';
  let I; try { I = await api('GET', '/api/platform/invite?token=' + encodeURIComponent(token)); }
  catch (x) { $('#root').innerHTML = `<div class="pf-auth card">${brand}<h1>Link expired</h1><p class="muted">${esc(x.message)}</p><a class="btn alt" href="/alpha">Go to the Alpha login</a></div>`; return; }
  const welcome = I.kind === 'invite'; document.title = welcome ? 'Activate your login · Alpha' : 'Choose a new password · Alpha';
  const draw = (err) => {
    $('#root').innerHTML = `<div class="pf-auth card">${brand}<h1>${welcome ? `Welcome, ${esc(I.name.split(/\s+/)[0])}` : 'Choose a new password'}</h1>
<p class="muted">${welcome ? `Choose a password to activate your support login for ${esc(I.productName)} Alpha.` : 'Choose a new password for your Alpha login.'}</p>
<form id="ivf">${err ? `<div class="msg err" role="alert">${esc(err)}</div>` : ''}<label>Email<input value="${esc(I.email)}" readonly autocomplete="username"></label>
<label>Password (10+ characters)<input name="password" type="password" required minlength="10" autocomplete="new-password"></label>
<label>Type it again<input name="again" type="password" required minlength="10" autocomplete="new-password"></label>
<button class="btn">${welcome ? 'Activate and log in' : 'Save and log in'}</button></form></div>`;
    $('#ivf [name=password]').focus();
    $('#ivf').addEventListener('submit', async (e) => {
      e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); if (b.password !== b.again) return draw('The two passwords don’t match');
      try { await api('POST', '/api/platform/invite', { token, password: b.password }); history.replaceState(null, '', '/alpha'); boot(); } catch (x) { draw(x.message); }
    });
  };
  draw();
}

/* ===== shell ===== */
const ico = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TAB_ICONS = { // bottom bar icons (phones), by section
  help: ico('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.3-2.4 3.9"/><path d="M12 17.2h.01"/>'),
  accounts: ico('<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4"/>'),
  pricing: ico('<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="8" cy="8" r="1.5"/>'),
  integrations: ico('<path d="M9 2v6M15 2v6"/><path d="M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>'),
  automations: ico('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>'),
  messages: ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  forum: ico('<path d="M17 9a6 6 0 0 0-11.5-2.4A5 5 0 0 0 3 15.3L2 19l3.7-1A6 6 0 0 0 17 9z"/><path d="M14 18.6A6 6 0 0 0 22 13a5 5 0 0 0-2.5-4.3"/>'),
  social: ico('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
  plans: ico('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14.5 17.5l2 2 4-4"/>'),
  settings: ico('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
};
async function load() { D = await api('GET', '/api/platform/overview'); if (!draftPlans) { draftPlans = structuredClone(D.plans); draftBeta = [...D.betaFeatures]; } }
// Live chat on its own: /alpha?popout=chat opens in a separate window, with just the chats
const POPOUT = new URLSearchParams(location.search).get('popout') === 'chat';
function render() {
  if (POPOUT) {
    tab = 'messages'; msgTab = 'chat'; document.title = `Live chat · ${D.settings.productName} Alpha`;
    $('#root').innerHTML = '<main class="pf-main pf-pop" id="main"><div class="card" id="chat"></div></main>';
    return chatCard($('#chat'));
  }
  const secs = NAV.map((n) => ({ ...n, pages: n.pages.filter((k) => tabsFor().includes(k)) })).filter((n) => n.pages.length);
  const cur = secs.find((n) => n.pages.includes(tab));
  const badge = (k) => (k === 'messages' && D.chatWaiting ? ` <span class="msg-n" title="Chats waiting for you">${D.chatWaiting}</span>` : k === 'help' && D.forumNew ? ` <span class="msg-n" title="New forum posts">${D.forumNew}</span>` : '');
  document.title = `${cur.l} · ${D.settings.productName} Alpha`;
  $('#root').innerHTML = `<header class="pf-top"><div class="pf-bar"><div class="pf-brand">${brandHtml()}</div>
<nav class="pf-tabs">${secs.map((n) => `<a href="#${n.pages[0]}" class="${n === cur ? 'on' : ''}">${n.l}${badge(n.k)}</a>`).join('')}</nav>
<details class="pf-user pf-menu"><summary>${esc(D.admin.name)}${isSupport() ? ' <small class="pf-role">Support</small>' : ''} <span aria-hidden="true">▾</span></summary><div class="pf-menu-list"><div class="pf-menu-who">${esc(D.admin.email)}</div><button type="button" data-act="myEmail">Change email</button><button type="button" data-act="myPassword">Change password</button><button type="button" data-act="logout">Log out</button></div></details></div></header>
${D.maintenance && D.maintenance.on ? `<div class="mt-bar" role="status"><strong>Maintenance mode is on.</strong> Visitors and businesses see the maintenance page; you can still use everything. ${isSupport() ? 'The owner can turn it off in Settings.' : '<a href="#settings" data-act="goMaint">Turn it off in Settings</a>'}</div>` : ''}
<main class="pf-main" id="main"></main>
<nav class="pf-bnav" aria-label="Alpha sections">${secs.filter((n) => !NOT_ON_PHONES.includes(n.k)).map((n) => `<a href="#${n.pages.includes(n.phone) ? n.phone : n.pages[0]}" class="${n === cur ? 'on' : ''}"${n === cur ? ' aria-current="page"' : ''}>${TAB_ICONS[n.k]}<span>${n.short || n.l}</span></a>`).join('')}</nav>`;
  $('#main').dataset.tab = tab; // box title bands are styled per tab (platform.html)
  ({ accounts: accountsView, plans: plansView, discounts: promoView, messages: messagesView, forum: forumView, help: helpView, social: socialView, settings: settingsView })[tab]($('#main'));
}
// the top bar: one link per section, opening its first page. Pricing (Plans & features, Promotions) and Help Center (articles, Forum)
// hold more than one page, switched by the tabs under their title. Integrations is part of Settings.
const NAV = [
  { k: 'accounts', l: 'Accounts', pages: ['accounts'] },
  { k: 'pricing', l: 'Pricing', pages: ['plans', 'discounts'], phone: 'discounts' },
  { k: 'messages', l: 'Messages', pages: ['messages'] },
  { k: 'help', l: 'Help Center', short: 'Help', pages: ['help', 'forum'] },
  { k: 'social', l: 'Social', pages: ['social'] },
  { k: 'settings', l: 'Settings', pages: ['settings'] },
];
const TABS = NAV.flatMap((n) => n.pages);
// support users (Settings → Alpha team) get Accounts, Messages, Forum and Help Center; the server enforces the same
const isSupport = () => !!(D && D.admin && D.admin.role === 'support');
const tabsFor = () => (isSupport() ? ['accounts', 'messages', 'forum', 'help'] : TABS);
const tabFromHash = () => {
  let h = location.hash.slice(1); if (h === 'pricing') h = 'plans';
  if (h === 'automations' && !isSupport()) { msgTab = 'automations'; return 'messages'; }
  if (h === 'integrations' && !isSupport()) { setTab = 'integrations'; return 'settings'; } // Integrations moved into Settings; old links still land there
  return tabsFor().includes(h) ? h : 'accounts';
};
const NOT_ON_PHONES = ['settings']; // left off the phone tab bar for everyone (it needs a bigger screen); there Pricing opens on Promotions
window.addEventListener('hashchange', () => { if (POPOUT) return; tab = tabFromHash(); if (tab === 'forum') { FR = null; frSel = ''; } if (D) render(); });

/* ===== accounts ===== */
const statusChip = (a) => (a.status === 'active' ? `<span class="cstatus active">Active</span>${a.expiresAt ? `<div class="sm">Until ${fmtDate(a.expiresAt)}</div>` : ''}${a.billing && a.billing.status === 'paid' ? `<div class="sm">${a.billing.demo ? 'Demo checkout' : 'Paid by card'}</div>` : a.billing && a.billing.status === 'trial' ? `<div class="sm">Free trial, no card${a.billing.trialCancelled ? ' (cancelled)' : ''}</div>` : ''}`
  + (a.billing && a.billing.discountCode ? `<div class="sm">Code ${esc(a.billing.discountCode)}</div>` : '') : a.status === 'pending' ? '<span class="cstatus">Awaiting payment</span>' : `<span class="cstatus">${{ trial: 'Trial ended', ended: 'Expired', cancelled: 'Cancelled', billing: 'Payment failed' }[a.pauseReason] || 'Paused'}</span>${a.expiredOn ? `<div class="sm">Access ended ${fmtDate(a.expiredOn)}</div>` : a.pauseReason === 'billing' ? '<div class="sm">Waiting for a card update</div>' : a.pauseReason === 'cancelled' ? '<div class="sm">Subscription ended</div>' : ''}`);
// a trial or test plan (Trial, or any plan hidden from the pricing page): suggest a last day of access two weeks out
const isTrialPlan = (id) => { const p = D.plans.find((x) => x.id === id); return !!p && (p.id === 'trial' || !!p.hidden); };
const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymdLocal(d); };
const expiryField = (v) => `<label>Last day of access (optional)<input name="expiresAt" type="date" min="${ymdLocal(new Date())}" value="${esc(v || '')}"></label>`;
const planName = (id) => (D.plans.find((p) => p.id === id) || {}).name || id;
// the industry a business picked at sign-up or in Company Profile (lib/industries.js); 'none' = not chosen yet
const indName = (k) => (D.industries.find((i) => i.slug === k) || {}).name || '';
const indLabel = (a) => (a.industry === 'other' ? `Other${a.industryOther ? ': ' + a.industryOther : ''}` : indName(a.industry));
const industryFields = (a) => `<label>Industry<select name="industry"><option value="">Not set</option>${D.industries.map((i) => `<option value="${esc(i.slug)}" ${i.slug === a.industry ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select></label>
<label data-other style="${a.industry === 'other' ? '' : 'display:none'}">Their industry<input name="industryOther" maxlength="80" value="${esc(a.industryOther || '')}"></label>`;
const wireIndustry = (f) => { const s = $('[name=industry]', f); s.addEventListener('change', () => { $('[data-other]', f).style.display = s.value === 'other' ? '' : 'none'; }); };
let accIndustry = ''; // the accounts list's industry filter: '' = all
function accountsView(main) {
  const active = D.accounts.filter((a) => a.status === 'active').length;
  const byPlan = D.plans.map((p) => `${D.accounts.filter((a) => a.planId === p.id).length} ${esc(p.name)}`).join(' · ');
  const count = (k) => D.accounts.filter((a) => (a.industry || 'none') === k).length;
  const top = D.industries.map((i) => [i, count(i.slug)]).filter(([, n]) => n).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([i, n]) => `${n} ${esc(i.name)}`).join(' · ');
  const shown = D.accounts.filter((a) => !accIndustry || (a.industry || 'none') === accIndustry);
  main.innerHTML = `<div class="head"><div><h1>Accounts</h1><p class="sub" style="margin:4px 0 0">Each business gets its own web address, data and logins.</p></div><button class="btn" data-act="newAccount">New account</button></div>
${D.devMode ? `<div class="note">Running locally: accounts open at <code>&lt;address&gt;.${esc(D.rootDomain)}</code> in this browser. Set <code>PLATFORM_DOMAIN</code> (e.g. yourapp.com) on your server to give each account <code>&lt;address&gt;.yourapp.com</code>.</div>` : ''}
<div class="stats"><div class="card"><div class="l">Accounts</div><div class="v">${D.accounts.length}</div></div><div class="card"><div class="l">Active</div><div class="v">${active}</div></div>
<div class="card"><div class="l">By plan</div><div style="margin-top:8px;font-size:14px">${byPlan}</div></div><div class="card"><div class="l">Logins across accounts</div><div class="v">${D.accounts.reduce((s, a) => s + a.users, 0)}</div></div>
<div class="card"><div class="l">Top industries</div><div style="margin-top:8px;font-size:14px">${top || 'None chosen yet'}</div></div></div>
<div class="acc-tools"><label>Industry<select id="accInd"><option value="">All industries (${D.accounts.length})</option>${[...D.industries, { slug: 'none', name: 'Not set yet' }].map((i) => `<option value="${esc(i.slug)}" ${i.slug === accIndustry ? 'selected' : ''}>${esc(i.name)} (${count(i.slug)})</option>`).join('')}</select></label>
<button type="button" class="btn alt sm" data-act="accountsCsv">Download CSV</button><span class="sm">${accIndustry ? `${shown.length} of ${D.accounts.length} accounts` : ''}</span></div>
<div class="card"><p class="sm muted acc-hint">Select a business to manage it.</p><div class="tablewrap"><table class="acc acc-list"><thead><tr><th>Business</th><th>Web address</th><th>Plan</th><th>Status</th></tr></thead><tbody>
${shown.map((a) => `<tr data-id="${a.id}" tabindex="0" aria-label="Manage ${esc(a.name)}"><td class="acc-biz"><div class="nm">${esc(a.name)}${a.isDefault ? ' <span class="pf-chip">Your own account</span>' : ''}</div><div class="sm">${a.owner ? `${esc(a.owner.name)} · ${esc(a.owner.email)}${a.owner.active ? '' : ' · <em>invite not accepted</em>'}${a.owner.unconfirmed ? ' · <em>email not confirmed</em>' : ''}` : 'No owner login yet'}</div></td>
<td><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(host(a.url))}</a>${a.domains.length ? `<div class="chips">${a.domains.map((d) => `<span class="pf-chip ${d.verified ? 'ok' : 'wait'}" title="${d.verified ? 'Connected' : 'Waiting for DNS'}">${esc(d.host)}</span>`).join('')}</div>` : ''}</td>
<td><select data-plan="${a.id}" aria-label="Plan for ${esc(a.name)}">${D.plans.map((p) => `<option value="${esc(p.id)}" ${p.id === a.planId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></td>
<td class="acc-st">${statusChip(a)}${a.support.length ? ` <span class="pf-chip ${a.support.some((r) => r.status === 'granted') ? 'ok' : 'wait'}" title="Support Access">${a.support.some((r) => r.status === 'granted') ? 'Support access' : 'Access requested'}</span>` : ''}</td>
</tr>`).join('') || `<tr><td colspan="4" class="muted">${accIndustry ? 'No accounts in this industry.' : 'No accounts yet.'}</td></tr>`}
</tbody></table></div></div>`;
  wirePlanSelects(main);
  $('#accInd', main).addEventListener('change', (e) => { accIndustry = e.target.value; accountsView(main); });
  // select a row (click, tap, or Enter/Space) to manage the business; its link and plan menu still work on their own.
  // On phones the row shows only the business and its status.
  $$('.acc tbody tr[data-id]', main).forEach((tr) => {
    tr.addEventListener('click', (e) => { if (!e.target.closest('a,button,select')) A.editAccount({ id: tr.dataset.id }); });
    tr.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === tr) { e.preventDefault(); A.editAccount({ id: tr.dataset.id }); } });
  });
}
function wirePlanSelects(root, after) {
  $$('[data-plan]', root).forEach((s) => s.addEventListener('change', async () => {
    const a = D.accounts.find((x) => x.id === s.dataset.plan);
    if (isTrialPlan(s.value) && !a.isDefault) { trialModal(a, s.value); s.value = a.planId; return; }
    try { await api('PUT', `/api/platform/accounts/${a.id}`, { planId: s.value }); toast(`${a.name} is now on ${planName(s.value)}`); await load(); render(); if (after) after(a); } catch (e) { toast(e.message, true); s.value = a.planId; }
  }));
}
function trialModal(a, planId) {
  const m = modal(`Move ${a.name} to ${planName(planId)}`, `<form id="tf"><p class="muted" style="margin-top:0">Choose the last day ${esc(a.name)} can use the account. The day after, it pauses until you resume it or move it to another plan.</p>
${expiryField(a.expiresAt || inDays(14))}<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Move to ${esc(planName(planId))}</button></div></form>`);
  $('#tf', m).addEventListener('submit', async (e) => {
    e.preventDefault(); try { await api('PUT', `/api/platform/accounts/${a.id}`, { planId, expiresAt: e.target.expiresAt.value }); closeModal(); toast(`${a.name} is now on ${planName(planId)}${e.target.expiresAt.value ? ` until ${fmtDate(e.target.expiresAt.value)}` : ''}`); await load(); render(); } catch (x) { toast(x.message, true); }
  });
}
function slugField(name, value) {
  return `<label>Web address<div class="slug"><input name="${name}" value="${esc(value)}" required autocomplete="off" spellcheck="false" maxlength="32"><span>.${esc(D.rootDomain)}</span></div><div class="hint" data-hint></div></label>`;
}
function wireSlug(form, initial) {
  const i = $('[name=slug]', form); const hint = $('[data-hint]', form); let t;
  const check = () => { clearTimeout(t); const v = i.value.trim().toLowerCase(); if (!v || v === initial) { hint.textContent = ''; return; }
    t = setTimeout(async () => { const r = await api('GET', '/api/site/slug-check?slug=' + encodeURIComponent(v)); hint.className = 'hint ' + (r.ok ? 'good' : 'bad'); hint.textContent = r.ok ? `${v}.${D.rootDomain} is available` : r.error; }, 250); };
  i.addEventListener('input', () => { i.dataset.touched = '1'; check(); }); return check;
}
const A = {};
// the accounts in the list (with its industry filter) as a spreadsheet: owner contacts by industry, for marketing
A.accountsCsv = () => {
  const rows = D.accounts.filter((a) => !accIndustry || (a.industry || 'none') === accIndustry);
  // names come from public sign-ups: a leading = + - @ is quoted so a spreadsheet never runs it as a formula
  const cell = (v) => { const t = String(v ?? '').replace(/^[=+\-@\t\r]/, "'$&"); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const head = ['Business', 'Owner', 'Owner email', 'Industry', 'Plan', 'Status', 'Web address', 'Clients', 'Jobs', 'Invoices', 'Created', 'Last login'];
  const lines = rows.map((a) => [a.name, a.owner ? a.owner.name : '', a.owner ? a.owner.email : '', indLabel(a), planName(a.planId), a.status, a.url, a.clients, a.jobs, a.invoices, (a.createdAt || '').slice(0, 10), (a.lastLoginAt || '').slice(0, 10)].map(cell).join(','));
  const url = URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }));
  const link = document.createElement('a'); link.href = url; link.download = `accounts${accIndustry ? '-' + accIndustry : ''}-${ymdLocal(new Date())}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
A.newAccount = () => {
  const m = modal('New account', `<form id="nf"><div class="row"><label>Business name<input name="name" required maxlength="100"></label>${slugField('slug', '')}</div>
<div class="row"><label>Plan<select name="planId">${D.plans.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${p.price ? ` (${esc(p.price)})` : ''}</option>`).join('')}</select></label>${expiryField('')}</div>
<div class="row"><label>Owner’s name<input name="ownerName" required maxlength="100" autocomplete="off"></label><label>Owner’s email<input name="ownerEmail" type="email" required autocomplete="off"></label></div>
<p class="muted" style="font-size:13px;margin:-6px 0 12px">Last day of access: leave blank to keep the account open. The day after the last day, it pauses until you resume it.</p>
<label class="switchline"><input type="checkbox" name="demo"> Start with demo clients, jobs and invoices</label>
<p class="muted" style="font-size:13px;margin:0">The owner gets an email with a link to choose their password. You’ll also see the link here to send yourself.</p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Create account</button></div></form>`, { wide: true });
  const f = $('#nf', m); const check = wireSlug(f, '');
  $('[name=planId]', f).addEventListener('change', (e) => { if (isTrialPlan(e.target.value) && !f.expiresAt.value) f.expiresAt.value = inDays(14); }); // a trial gets two weeks to start with
  $('[name=name]', f).addEventListener('input', (e) => { const s = $('[name=slug]', f); if (!s.dataset.touched) { s.value = slugify(e.target.value); check(); } });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(f)); b.demo = !!b.demo;
    try {
      const r = await api('POST', '/api/platform/accounts', b); await load(); render();
      showLink(`${r.account.name} is ready`, r.emailed ? `We emailed ${b.ownerEmail} a link to set their password. You can also send it yourself:` : `Email isn’t set up, so send ${b.ownerEmail} this link to set their password (it works for 7 days):`, r.link);
    } catch (x) { toast(x.message, true); }
  });
};
function showLink(title, text, link) {
  const m = modal(title, `<p class="muted" style="margin-top:0">${esc(text)}</p><div class="linkbox"><input readonly value="${esc(link)}" aria-label="Link"><button type="button" class="btn alt" data-act="copy">Copy</button></div>
<div class="foot"><button type="button" class="btn" data-act="closeModal">Done</button></div>`);
  $('input', m).select();
}
A.copy = (d, el) => { const i = el.parentElement.querySelector('input'); navigator.clipboard.writeText(i.value).then(() => toast('Copied'), () => { i.select(); toast('Press Ctrl+C to copy', true); }); };
A.editAccount = (d) => {
  const a = D.accounts.find((x) => x.id === d.id);
  const m = modal(a.name, `<div class="am-sum"><p class="sm">${a.owner ? `${esc(a.owner.name)} · ${esc(a.owner.email)}${a.owner.active ? '' : ' · <em>invite not accepted</em>'}${a.owner.unconfirmed ? ' · <em>email not confirmed</em>' : ''}` : 'No owner login yet'}</p>
<dl><div><dt>Web address</dt><dd><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(host(a.url))}</a></dd></div>
<div><dt>Status</dt><dd>${statusChip(a)}</dd></div>
<div><dt>Plan</dt><dd><select data-plan="${a.id}" aria-label="Plan for ${esc(a.name)}">${D.plans.map((p) => `<option value="${esc(p.id)}" ${p.id === a.planId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></dd></div>
<div><dt>Usage</dt><dd>${a.users} login${a.users === 1 ? '' : 's'} · ${a.clients} clients · ${a.jobs} jobs${a.lastLoginAt ? `<br>Last login ${fmtDate(a.lastLoginAt)}` : ''}</dd></div>
<div><dt>Industry</dt><dd>${a.industry ? esc(indLabel(a)) : 'Not set'}</dd></div>
<div><dt>Created</dt><dd>${fmtDate(a.createdAt)}</dd></div></dl></div>
<div class="am-grid"><div class="am-col"><form id="ef"><label>Business name<input name="name" value="${esc(a.name)}" required maxlength="100"></label>${slugField('slug', a.slug)}
<p class="muted" style="font-size:13px;margin:-4px 0 12px">Changing the address breaks links already sent to clients at the old address.</p>
${industryFields(a)}
<div class="foot" style="margin-top:0"><button class="btn">Save</button></div></form>
<h3 style="font-size:15px;margin:18px 0 6px">Owner login</h3><p class="muted" style="font-size:14px;margin:0 0 8px">${a.owner ? `${esc(a.owner.name)} (${esc(a.owner.email)}). ${a.owner.active ? 'Get a password reset link if they’re locked out.' : 'They haven’t chosen a password yet.'}` : 'No owner login.'}</p>
${a.owner ? `<button type="button" class="btn alt sm" data-act="ownerLink" data-id="${a.id}">${a.owner.active ? 'Get password reset link' : 'Get a new invite link'}</button>` : ''}
${a.isDefault ? '' : `<h3 style="font-size:15px;margin:18px 0 6px">Last day of access</h3><form id="xf" class="inline-form">${expiryField(a.expiresAt)}<button class="btn alt">Save date</button></form>
<p class="muted" style="font-size:13px;margin:-4px 0 0">${a.expiredOn ? `Its access ended on ${fmtDate(a.expiredOn)}. Choose a later date (or clear it), save, then resume the account.` : a.expiresAt ? `The account pauses after ${fmtDate(a.expiresAt)}. Clear the date to keep it open.` : 'No end date: the account stays open.'}</p>`}
</div><div class="am-col"><h3 style="font-size:15px;margin:18px 0 6px">Custom domains</h3>${a.domains.length ? `<table class="acc">${a.domains.map((x) => `<tr><td><strong>${esc(x.host)}</strong>${x.primary ? ' <span class="pf-chip">Main</span>' : ''}<div class="sm">${x.verified ? 'Connected' : 'Waiting for DNS'}</div></td>
<td><div class="acts">${x.verified ? `<button type="button" class="btn alt sm" data-act="domain" data-host="${esc(x.host)}" data-v="0">Unapprove</button>` : `<button type="button" class="btn alt sm" data-act="domain" data-host="${esc(x.host)}" data-v="1" title="Approve without waiting for DNS">Approve</button>`}<button type="button" class="btn danger sm" data-act="domain" data-host="${esc(x.host)}" data-rm="1">Remove</button></div></td></tr>`).join('')}</table>`
    : `<p class="muted" style="font-size:14px;margin:0">None. ${D.plans.find((p) => p.id === a.planId)?.features.includes('customDomain') ? 'The owner can add one under App Settings → Web address.' : 'Their plan doesn’t include custom domains.'}</p>`}
<h3 style="font-size:15px;margin:18px 0 6px">Support access</h3>${supportSection(a)}
<h3 style="font-size:15px;margin:18px 0 6px">Access</h3><div class="acts" style="justify-content:flex-start"><a class="btn alt sm" href="${esc(a.url)}/login" target="_blank" rel="noopener">Open login page</a>
<button type="button" class="btn alt sm" data-act="resetDemo" data-id="${a.id}">Reset to demo data</button>
${a.isDefault ? '' : `<button type="button" class="btn alt sm" data-act="status" data-id="${a.id}">${a.status === 'active' ? 'Pause account' : 'Resume account'}</button><button type="button" class="btn danger sm" data-act="delAccount" data-id="${a.id}">Delete account</button>`}</div>
${a.status === 'active' ? '' : a.status === 'pending' ? '<p class="muted" style="font-size:13px">Awaiting payment: they signed up for a paid plan but haven’t finished checkout. Resume the account to let them in without paying.</p>' : '<p class="muted" style="font-size:13px">Paused: nobody can log in, and client links show “account paused”. Data is kept.</p>'}
</div></div>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Close</button></div>`, { wide: true });
  m.dataset.id = a.id; m.tabIndex = -1; m.focus(); // focus the popup itself, not its first field (the plan menu), so nothing changes by accident
  wirePlanSelects(m, (x) => A.editAccount({ id: x.id }));
  const f = $('#ef', m); wireSlug(f, a.slug); wireIndustry(f);
  const xf = $('#xf', m); if (xf) xf.addEventListener('submit', async (e) => { e.preventDefault(); try { await api('PUT', `/api/platform/accounts/${a.id}`, { expiresAt: xf.expiresAt.value }); toast(xf.expiresAt.value ? `Last day of access: ${fmtDate(xf.expiresAt.value)}` : 'End date removed'); await load(); render(); A.editAccount({ id: a.id }); } catch (x) { toast(x.message, true); } });
  const sf = $('#saf', m);
  if (sf) sf.addEventListener('submit', async (e) => {
    e.preventDefault(); const b = $('button', sf); b.disabled = true;
    try { const who = a.logins.find((u) => u.id === sf.userId.value); const r = await api('POST', `/api/platform/accounts/${a.id}/support-access`, { userId: sf.userId.value, reason: sf.reason.value }); toast(r.emailed ? `Request sent to ${who.email}` : `Request saved. ${who.name} wasn’t emailed (email isn’t connected), so let them know to check Settings → Support Access.`); await load(); render(); A.editAccount({ id: a.id }); }
    catch (x) { b.disabled = false; toast(x.message, true); }
  });
  f.addEventListener('submit', async (e) => { e.preventDefault(); const b = Object.fromEntries(new FormData(f)); if (!b.industry) delete b.industry; try { await api('PUT', `/api/platform/accounts/${a.id}`, b); toast('Saved'); await load(); render(); A.editAccount({ id: a.id }); } catch (x) { toast(x.message, true); } });
};
// Support Access: ask any of the account's logins; they approve it on their Support Access page, and while it's granted
// you can open the account as them (with their access level). They, or the account owner, can revoke it any time.
const ROLE_NAMES = { owner: 'Owner', admin: 'Admin', manager: 'Manager', technician: 'Technician' };
function supportSection(a) {
  const rows = a.support.map((r) => `<tr><td><strong>${esc(r.userName)}</strong><div class="sm">${r.status === 'granted' ? `Granted until ${fmtDate(r.expiresAt)}` : `Waiting for approval · requested ${fmtDate(r.requestedAt)} by ${esc(r.adminName)}`}</div></td>
<td><div class="acts">${r.status === 'granted' ? `<button type="button" class="btn sm" data-act="supportOpen" data-id="${a.id}" data-r="${esc(r.id)}">Open account</button>` : ''}<button type="button" class="btn alt sm" data-act="supportEnd" data-id="${a.id}" data-r="${esc(r.id)}">${r.status === 'granted' ? 'End access' : 'Withdraw'}</button></div></td></tr>`).join('');
  const busy = new Set(a.support.map((r) => r.userId)); const free = a.logins.filter((u) => u.active && !busy.has(u.id));
  return `<p class="muted" style="font-size:14px;margin:0 0 8px">Ask someone on the account to let you in as them to troubleshoot. They get an email and approve it on their Support Access page. Access lasts four weeks unless they or the owner revoke it, and you sign in with their access level.</p>
${rows ? `<table class="acc" style="margin-bottom:10px">${rows}</table>` : ''}
${free.length ? `<form id="saf"><div class="linkbox" style="margin-bottom:8px"><select name="userId" aria-label="Who to ask">${free.map((u) => `<option value="${esc(u.id)}">${esc(u.name)} · ${ROLE_NAMES[u.role] || esc(u.role)} · ${esc(u.email)}</option>`).join('')}</select></div>
<div class="linkbox"><input name="reason" maxlength="500" placeholder="Reason, shown to them (optional)" aria-label="Reason for access"><button class="btn alt">Request access</button></div></form>`
    : `<p class="muted" style="font-size:13px;margin:0">${a.logins.some((u) => u.active) ? 'Everyone who can sign in already has an open request or grant.' : 'Nobody on this account can sign in yet, so there’s no one to approve a request.'}</p>`}`;
}
A.supportEnd = async (d) => {
  const a = D.accounts.find((x) => x.id === d.id); const r = a.support.find((x) => x.id === d.r); const granted = r && r.status === 'granted';
  if (!confirm(granted ? `End support access to ${r.userName}’s login? Open support sessions are signed out.` : `Withdraw the request to ${r ? r.userName : 'them'}?`)) return;
  try { await api('DELETE', `/api/platform/accounts/${a.id}/support-access/${encodeURIComponent(d.r)}`); toast(granted ? 'Support access ended' : 'Request withdrawn'); await load(); render(); A.editAccount({ id: a.id }); } catch (x) { toast(x.message, true); }
};
A.supportOpen = async (d) => {
  const w = window.open('', '_blank'); // open the tab now, while the click still counts, so it isn't blocked as a pop-up
  try { const r = await api('POST', `/api/platform/accounts/${d.id}/support-login`, { requestId: d.r }); if (w) { w.opener = null; w.location = r.link; } else location.href = r.link; }
  catch (x) { if (w) w.close(); toast(x.message, true); }
};
A.domain = async (d, el) => {
  const id = el.closest('.pf-modal').dataset.id;
  try { await api('POST', `/api/platform/accounts/${id}/domains`, d.rm ? { host: d.host, remove: true } : { host: d.host, verified: d.v === '1' }); await load(); render(); A.editAccount({ id }); } catch (x) { toast(x.message, true); }
};
A.ownerLink = async (d) => { try { const r = await api('POST', `/api/platform/accounts/${d.id}/owner-link`, {}); showLink(r.invite ? 'New invite link' : 'Password reset link', `Send this to ${r.owner.email}. It works for 7 days and replaces earlier links.`, r.link); } catch (x) { toast(x.message, true); } };
A.resetDemo = async (d) => {
  const a = D.accounts.find((x) => x.id === d.id);
  if (!confirm(`Replace ALL of ${a.name}’s clients, jobs, quotes and invoices with demo data? Logins and Stripe connection are kept. This can’t be undone.`)) return;
  try { await api('POST', `/api/platform/accounts/${a.id}/reset-demo`, {}); toast(`${a.name} now has demo data`); await load(); render(); A.editAccount({ id: a.id }); } catch (x) { toast(x.message, true); }
};
A.status = async (d) => {
  const a = D.accounts.find((x) => x.id === d.id); const pause = a.status === 'active';
  if (pause && !confirm(`Pause ${a.name}? Their team can’t log in and client links stop working until you resume it.`)) return;
  if (!pause && a.expiresAt && a.expiresAt < ymdLocal(new Date())) return toast('Its last day of access has passed. Choose a later date (or clear it) under Last day of access first.', true);
  try { await api('PUT', `/api/platform/accounts/${a.id}`, { status: pause ? 'suspended' : 'active' }); toast(pause ? 'Account paused' : 'Account resumed'); await load(); render(); A.editAccount({ id: a.id }); } catch (x) { toast(x.message, true); }
};
A.delAccount = async (d) => {
  const a = D.accounts.find((x) => x.id === d.id);
  const typed = prompt(`This removes ${a.name} and all its data from the platform (a copy is kept in data/deleted on the server).\n\nType ${a.slug} to confirm:`);
  if (typed === null) return;
  try { await api('DELETE', `/api/platform/accounts/${a.id}`, { confirm: typed.trim() }); closeModal(); toast('Account deleted'); await load(); render(); } catch (x) { toast(x.message, true); }
};

/* ===== plans & features ===== */
// how much the yearly price saves against 12 monthly payments
const saveText = (p) => (p.monthly > 0 && p.yearly > 0 ? (p.yearly < p.monthly * 12 ? `Yearly saves ${Math.round((1 - p.yearly / (p.monthly * 12)) * 100)}% ($${Math.round(p.yearly / 12 * 100) / 100}/mo)` : 'Yearly costs as much as 12 months') : p.yearly > 0 ? 'Yearly only' : p.monthly > 0 ? 'Monthly only' : 'No price: shows the label below');
// phones edit one plan at a time instead of scrolling a wide grid sideways
const narrow = matchMedia('(max-width:760px)');
narrow.addEventListener('change', () => { if (D && tab === 'plans') render(); });
let planIx = 0; let detailsOpen = false;
const planFields = (p, i) => `<label>Name<input class="pn" data-i="${i}" data-k="name" value="${esc(p.name)}" maxlength="40" aria-label="Plan name"></label><div class="pr-pair"><label>Monthly ($)<input type="number" inputmode="decimal" min="0" step="0.01" data-i="${i}" data-k="monthly" value="${p.monthly ?? ''}" placeholder="49" aria-label="Monthly price for ${esc(p.name)}"></label>
<label>Yearly ($)<input type="number" inputmode="decimal" min="0" step="0.01" data-i="${i}" data-k="yearly" value="${p.yearly ?? ''}" placeholder="490" aria-label="Yearly price for ${esc(p.name)}"></label></div>
<div class="pr-save muted" data-save="${i}">${saveText(p)}</div>
<label>Label when there’s no price<input data-i="${i}" data-k="priceLabel" value="${esc(p.priceLabel || '')}" maxlength="40" placeholder="Free or Contact us" aria-label="Price label for ${esc(p.name)}"></label>
<label>Team logins (0 = unlimited)<input type="number" inputmode="numeric" min="0" data-i="${i}" data-k="maxUsers" value="${p.maxUsers || 0}" aria-label="Team logins for ${esc(p.name)}"></label><label>Short description<input data-i="${i}" data-k="description" value="${esc(p.description)}" maxlength="200" aria-label="Description for ${esc(p.name)}"></label>
<label class="switchline" style="font-size:13px"><input type="checkbox" data-hide="${i}" ${p.hidden ? 'checked' : ''}> Hidden from public</label>`;
// a feature ticked as Beta shows a "Beta" tag to businesses (pricing page, checkout, their plan and menu)
const betaTag = (f) => `<span class="beta-tag" data-beta-tag="${f.key}" ${draftBeta.includes(f.key) ? '' : 'hidden'}>Beta</span>`;
const betaBox = (f) => `<input type="checkbox" data-beta="${f.key}" ${draftBeta.includes(f.key) ? 'checked' : ''} title="Show a Beta tag on this feature to businesses" aria-label="${esc(f.label)} is in beta">`;
// a feature that needs another one (Google reviews and Social posts need Account connections) is hidden from a plan without it
const offered = (p, f) => !f.needs || p.features.includes(f.needs);
const tickedCount = (p) => D.features.filter((f) => offered(p, f) && p.features.includes(f.key)).length;
function plansView(main) {
  const P = draftPlans; const groups = [...new Set(D.features.map((f) => f.group))];
  const used = (id) => D.accounts.filter((a) => a.planId === id).length;
  const usedText = (p) => `${used(p.id)} account${used(p.id) === 1 ? '' : 's'}`;
  const rmBtn = (p, i) => (P.length > 1 ? `<button type="button" class="rm-plan" data-act="rmPlan" data-i="${i}" ${used(p.id) ? `disabled title="Move its accounts to another plan first"` : ''}>Remove plan</button>` : '');
  const dirty = plansDirty();
  planIx = Math.min(planIx, P.length - 1);
  const head = `<div class="head"><div><h1>Pricing</h1><p class="sub" style="margin:4px 0 0">Tick what each plan includes. Accounts get changes as soon as you save.</p></div><button class="btn alt" data-act="addPlan">Add plan</button></div>${pricingSeg()}`;
  const savebar = `<div class="savebar"><span class="muted">${dirty ? 'Unsaved changes' : 'All changes saved'}</span>${dirty ? '<button type="button" class="btn alt" data-act="discardPlans">Discard</button>' : ''}<button type="button" class="btn" data-act="savePlans" ${dirty ? '' : 'disabled'}>Save plans</button></div>`;
  if (narrow.matches) {
    const i = planIx; const p = P[i];
    main.innerHTML = `${head}<div class="pl-pick" role="tablist">${P.map((x, j) => `<button type="button" role="tab" aria-selected="${j === i}" class="${j === i ? 'on' : ''}" data-act="pickPlan" data-i="${j}">${esc(x.name || 'Untitled')}${x.hidden ? ' <small>hidden</small>' : ''}</button>`).join('')}</div>
<div class="card pl-card"><details class="pl-det" ${detailsOpen ? 'open' : ''}><summary><span><strong>Plan details</strong><span class="muted">${esc(saveText(p))}</span></span><span class="muted">${usedText(p)}</span></summary><div class="pl-form">${planFields(p, i)}${rmBtn(p, i)}</div></details>
<div class="pl-feat"><div class="pl-h"><span>Features</span><span class="muted" data-count="${i}">${tickedCount(p)} of ${D.features.length}</span></div>
<p class="pl-always"><strong>Always included:</strong> ${D.alwaysIncluded.map(esc).join(', ')}</p>
<div class="pl-cols muted"><span>Beta</span><span>Feature</span></div>
${groups.map((g) => `<div class="pl-grp">${esc(g)}</div>` + D.features.filter((f) => f.group === g && offered(p, f)).map((f) => `<div class="pl-item"><label class="pl-beta">${betaBox(f)}</label><label class="pl-row"><span><span class="mx-l">${esc(f.label)}${betaTag(f)}</span><span class="mx-d">${esc(f.desc)}</span></span><input type="checkbox" data-i="${i}" data-f="${f.key}" ${p.features.includes(f.key) ? 'checked' : ''}></label></div>`).join('')).join('')}</div>
${savebar}</div>`;
    $('.pl-det', main).addEventListener('toggle', (e) => { detailsOpen = e.target.open; });
  } else {
    main.innerHTML = `${head}<div class="card" style="padding-bottom:18px"><div class="tablewrap"><table class="matrix"><thead><tr><th class="bcol"><span class="muted" style="font-weight:400;font-size:13px">Beta</span></th><th class="fcol"><span class="muted" style="font-weight:400;font-size:13px">Plan details</span></th>
${P.map((p, i) => `<th>${planFields(p, i)}<div class="muted" style="font-size:12px">${usedText(p)}</div>${rmBtn(p, i)}</th>`).join('')}</tr></thead>
<tbody><tr class="grp"><td class="bcol"></td><td class="fcol">Always included</td>${P.map(() => '<td></td>').join('')}</tr>
${D.alwaysIncluded.map((l) => `<tr><td class="bcol"></td><td class="fcol"><div class="mx-l">${esc(l)}</div></td>${P.map(() => '<td class="always" aria-label="Included">✓</td>').join('')}</tr>`).join('')}
${groups.map((g) => `<tr class="grp"><td class="bcol"></td><td class="fcol">${esc(g)}</td>${P.map(() => '<td></td>').join('')}</tr>` + D.features.filter((f) => f.group === g && P.some((p) => offered(p, f))).map((f) => `<tr><td class="bcol">${betaBox(f)}</td><td class="fcol"><div class="mx-l">${esc(f.label)}${betaTag(f)}</div><div class="mx-d">${esc(f.desc)}</div></td>
${P.map((p, i) => (offered(p, f) ? `<td><input type="checkbox" data-i="${i}" data-f="${f.key}" ${p.features.includes(f.key) ? 'checked' : ''} aria-label="${esc(f.label)} in ${esc(p.name)}"></td>` : `<td class="muted" title="Needs ${esc(D.features.find((x) => x.key === f.needs).label)}">–</td>`)).join('')}</tr>`).join('')).join('')}
<tr class="count"><td class="bcol"></td><td class="fcol">Features ticked</td>${P.map((p, i) => `<td data-count="${i}">${tickedCount(p)} of ${D.features.length}</td>`).join('')}</tr></tbody></table></div>
${savebar}</div>`;
  }
  sideLayout(main);
  // hidden plans stay off the pricing page and checkout; you can still put an account on one
  $$('input[data-hide]', main).forEach((c) => c.addEventListener('change', () => { const p = P[c.dataset.hide]; if (c.checked) p.hidden = true; else delete p.hidden; markDirty(main); }));
  $$('input[data-k]', main).forEach((i) => i.addEventListener('input', () => {
    const p = P[i.dataset.i]; const k = i.dataset.k;
    p[k] = k === 'maxUsers' ? Math.max(0, parseInt(i.value, 10) || 0) : k === 'monthly' || k === 'yearly' ? (Number(i.value) > 0 ? Number(i.value) : null) : i.value;
    if (k === 'monthly' || k === 'yearly') $(`[data-save="${i.dataset.i}"]`, main).textContent = saveText(p);
    if (k === 'name') { const tabBtn = $(`.pl-pick [data-i="${i.dataset.i}"]`, main); if (tabBtn) tabBtn.firstChild.textContent = i.value || 'Untitled'; }
    markDirty(main);
  }));
  $$('input[data-f]', main).forEach((c) => c.addEventListener('change', () => {
    const p = P[c.dataset.i]; p.features = c.checked ? [...new Set([...p.features, c.dataset.f])] : p.features.filter((k) => k !== c.dataset.f);
    $(`[data-count="${c.dataset.i}"]`, main).textContent = `${tickedCount(p)} of ${D.features.length}`; markDirty(main);
    if (D.features.some((f) => f.needs === c.dataset.f)) plansView(main); // show or hide the features that need it
  }));
  $$('input[data-beta]', main).forEach((c) => c.addEventListener('change', () => {
    const k = c.dataset.beta; const on = new Set(draftBeta); if (c.checked) on.add(k); else on.delete(k);
    draftBeta = D.features.map((f) => f.key).filter((x) => on.has(x)); $(`[data-beta-tag="${k}"]`, main).hidden = !c.checked; markDirty(main);
  }));
}
function markDirty(main) {
  const dirty = plansDirty(); const bar = $('.savebar', main);
  $('.muted', bar).textContent = dirty ? 'Unsaved changes' : 'All changes saved'; $('[data-act=savePlans]', bar).disabled = !dirty;
  if (dirty && !$('[data-act=discardPlans]', bar)) $('[data-act=savePlans]', bar).insertAdjacentHTML('beforebegin', '<button type="button" class="btn alt" data-act="discardPlans">Discard</button>');
}
A.addPlan = () => {
  const name = prompt('Name of the new plan:'); if (!name || !name.trim()) return;
  let id = slugify(name) || 'plan'; while (draftPlans.some((p) => p.id === id)) id += '-2';
  draftPlans.push({ id, name: name.trim(), monthly: null, yearly: null, priceLabel: '', price: '', description: '', maxUsers: 1, features: [] }); planIx = draftPlans.length - 1; render();
};
A.pickPlan = (d) => { planIx = Number(d.i); render(); };
A.rmPlan = (d) => { const p = draftPlans[d.i]; if (!confirm(`Remove the ${p.name} plan?`)) return; draftPlans.splice(Number(d.i), 1); render(); };
A.discardPlans = () => { draftPlans = structuredClone(D.plans); draftBeta = [...D.betaFeatures]; render(); };
A.savePlans = async () => {
  try { await api('PUT', '/api/platform/plans', { plans: draftPlans, betaFeatures: draftBeta }); await load(); draftPlans = structuredClone(D.plans); draftBeta = [...D.betaFeatures]; toast('Plans saved'); render(); } catch (x) { toast(x.message, true); }
};
window.addEventListener('beforeunload', (e) => { if (D && draftPlans && plansDirty()) e.preventDefault(); });

/* ===== settings ===== */
const IG_TABS = [['email', 'Email', 'Email'], ['sms', 'Text messages', 'Text messages (Twilio)'], ['stripe', 'Stripe', 'Stripe'], ['google', 'Google', 'Google Business Profile'], ['meta', 'Facebook & Instagram', 'Facebook & Instagram (Meta)'], ['tiktok', 'TikTok', 'TikTok'], ['ai', 'AI', 'AI descriptions'], ['marketplace', 'App Marketplace', 'App Marketplace']];
let igTab = 'email';
// Settings shows one box at a time, picked from a grouped list down the left (a dropdown on phones).
// The Integrations group is one page (setTab 'integrations') showing one service at a time (igTab).
const SET_GROUPS = [
  ['Product', [['product', 'Your product'], ['colors', 'Website colors'], ['icons', 'Menu'], ['seo', 'SEO'], ['terms', 'Terms and privacy']]],
  ['Team & access', [['team', 'Alpha team'], ['expiry', 'Access end dates'], ['reserved', 'Reserved addresses']]],
  ['Integrations', IG_TABS.map(([k, l]) => ['integrations:' + k, l])],
  ['System', [['maintenance', 'Maintenance mode']]],
];
let setTab = 'product';
const setKey = () => (setTab === 'integrations' ? 'integrations:' + igTab : setTab);
A.setTab = (d) => { const [k, ig] = d.k.split(':'); setTab = k; if (ig) igTab = ig; settingsView($('#main')); };
A.goMaint = () => { setTab = 'maintenance'; if (tab === 'settings') settingsView($('#main')); else location.hash = 'settings'; }; // the maintenance banner's link
function settingsView(main) {
  const s = D.settings; const site = `${location.origin}/pricing`;
  if (!SET_GROUPS.some(([, items]) => items.some(([k]) => k === setKey()))) setTab = 'product';
  const extra = (k) => (k === 'maintenance' && D.maintenance && D.maintenance.on ? ' <span class="msg-n mt-on">On</span>' : '');
  main.innerHTML = `<div class="head"><div><h1>Settings</h1></div></div>
<label class="set-pick"><span class="sr">Settings page</span><select>${SET_GROUPS.map(([g, items]) => `<optgroup label="${g}">${items.map(([k, l]) => `<option value="${k}" ${k === setKey() ? 'selected' : ''}>${l}</option>`).join('')}</optgroup>`).join('')}</select></label>
<div class="set-layout"><nav class="set-nav" aria-label="Settings">${SET_GROUPS.map(([g, items]) => `<div class="set-nav-g">${g}</div>${items.map(([k, l]) => `<button type="button" class="${k === setKey() ? 'on' : ''}" ${k === setKey() ? 'aria-current="page"' : ''} data-act="setTab" data-k="${k}">${k.startsWith('integrations:') ? `<i class="ig-dot" data-ig-dot="${k.slice(13)}"></i>` : ''}${l}${extra(k)}</button>`).join('')}`).join('')}</nav>
<div class="set-grid set-one"><div class="card" id="mtCard" data-set="maintenance"></div>
<div data-set="integrations"><p class="muted" style="margin:0 0 14px">Integrations are shared by every account. Keys in the <code>.env</code> file next to <code>server.js</code> need a restart after changing; secrets are never shown here.</p><div id="integ" class="ig-tabbed"><p class="muted">Checking…</p></div></div>
<form id="sf" class="set-form"><div class="card" data-set="product"><h2>Your product</h2>
<div class="row"><label>Product name<input name="productName" value="${esc(s.productName)}" required maxlength="60"></label><label>Contact email<input name="contactEmail" type="email" value="${esc(s.contactEmail)}" placeholder="sales@yourapp.com"></label></div>
<p class="muted" style="font-size:13px;margin-top:-4px">The product name appears on the pricing page and in account emails. Accounts see the contact email when they want to change plans, and new sign-ups are reported to it.</p>
<div class="card-save"><span class="as-status">Changes save automatically</span></div></div>
<div class="card" data-set="terms"><h2>Terms and privacy</h2>
<div class="row"><label>Legal business name<input name="legalName" value="${esc(s.legalName || '')}" maxlength="120" placeholder="e.g. Worklio Pro LLC"></label><label>Governing law<input name="governingLaw" value="${esc(s.governingLaw || '')}" maxlength="80" placeholder="e.g. the State of Texas"></label></div>
<p class="muted" style="font-size:13px;margin-top:-4px">Used in the <a href="/terms" target="_blank" rel="noopener">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>, which every address shows at /terms and /privacy. Leave the governing law blank to leave that sentence out. The wording itself is in lib/legal.js; have a lawyer review it.</p>
<div class="card-save"><span class="as-status">Changes save automatically</span></div></div>
</form>
<div class="set-pair" data-set="product"><div class="card" id="logoCard" data-set="product"></div>
<div class="set-col"><div class="card" id="iconCard" data-set="product"></div>
<form id="sf3" class="set-form"><div class="card" data-set="product"><h2>Sign-ups</h2>
<label class="switchline"><input type="checkbox" name="allowSignups" ${s.allowSignups ? 'checked' : ''}> Let businesses create an account themselves on the pricing page</label>
<label style="max-width:320px">Plan for businesses that sign up without choosing one<select name="signupPlan">${D.plans.filter((p) => !p.hidden).map((p) => `<option value="${esc(p.id)}" ${p.id === s.signupPlan ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
<label style="max-width:320px">“Most popular” badge on the pricing page<select name="popularPlan"><option value="" ${!s.popularPlan ? 'selected' : ''}>Automatic (the middle plan)</option>${D.plans.filter((p) => !p.hidden).map((p) => `<option value="${esc(p.id)}" ${p.id === s.popularPlan ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="none" ${s.popularPlan === 'none' ? 'selected' : ''}>None</option></select></label>
<p class="muted" style="font-size:13px">Pricing page: <a href="${esc(site)}" target="_blank" rel="noopener">${esc(site)}</a>. Businesses that choose a paid plan pay for it at checkout before their account opens (see <a href="#settings" data-act="setTab" data-k="integrations:stripe">Integrations → Stripe</a>).</p>
<div class="card-save"><span class="as-status">Changes save automatically</span></div></div>
</form></div></div>
<div class="card" id="colorsCard" data-set="colors"></div>
<div class="card" id="teamCard" data-set="team"></div><div class="card" id="iconsCard" data-set="icons"></div>
<form id="sf2" class="set-form"><div class="card" data-set="expiry"><h2>Accounts with a last day of access</h2>
<div class="row"><label>Show a banner in their app (days before)<input name="expiryBannerDays" type="number" min="0" max="60" value="${esc(s.expiryBannerDays ?? 7)}"></label><label>Email the owner a reminder (days before)<input name="expiryReminderDays" type="number" min="0" max="60" value="${esc(s.expiryReminderDays ?? 3)}"></label></div>
<p class="muted" style="font-size:13px;margin-top:-4px">For accounts you gave a last day of access (e.g. trials). Owners and admins see the banner; owners can choose a plan from it, which removes the end date. The reminder is sent once per end date; edit its wording in Messages → Email templates → Access ending soon. 0 means on the last day itself.</p>
<div class="card-save"><span class="as-status">Changes save automatically</span></div></div></form>
<div class="card" id="reserved" data-set="reserved"></div><div class="card" id="seoCard" data-set="seo"></div></div></div>`;
  $('.set-pick select', main).addEventListener('change', (e) => A.setTab({ k: e.target.value }));
  $$('[data-set]', main).forEach((c) => { c.hidden = c.dataset.set !== setTab; });
  $$('#sf, #sf2, #sf3', main).forEach((f) => autosave(f, async (b) => {
    if (f.elements.allowSignups) b.allowSignups = !!b.allowSignups; // only the form with the switch sends it
    const name = D.settings.productName; D.settings = await api('PUT', '/api/platform/settings', b);
    if (D.settings.productName !== name) { $('.pf-brand').innerHTML = brandHtml(); logoCard($('#logoCard', main)); iconCard($('#iconCard', main)); } // a new name: the header and previews show it
  }));
  maintenanceCard($('#mtCard', main)); logoCard($('#logoCard', main)); iconCard($('#iconCard', main)); colorsCard($('#colorsCard', main)); reservedCard($('#reserved', main)); teamCard($('#teamCard', main)); if (setTab === 'icons') iconsCard($('#iconsCard', main)); if (setTab === 'seo') seoCard($('#seoCard', main));
  integrationsCard($('#integ', main)); // always, so the list shows which services are set up
}
// Settings → SEO: each public page's title and description (with a search-result preview), indexing, verification, the share image and social profiles (lib/seo.js)
let SEO = null; let seoDraft = null;
const SEO_LIMITS = { title: 60, description: 155 };
const seoFill = (s, vars) => String(s).replace(/\{([a-z_]+)\}/g, (m, k) => (k in vars ? vars[k] : m)).replace(/\s+/g, ' ').trim();
async function seoCard(box) {
  if (!box) return;
  try { SEO = await api('GET', '/api/platform/seo'); } catch (x) { box.innerHTML = `<h2>SEO</h2><p class="muted">${esc(x.message)}</p>`; return; }
  seoDraft = { shareImage: SEO.shareImage }; seoDraw(box);
}
function seoDraw(box) {
  const S = SEO; const img = seoDraft.shareImage || S.defaultShareImage;
  const page = (p) => `<div class="seo-page" data-key="${p.key}"><div class="seo-ph"><div><strong>${esc(p.label)}</strong> <a class="sm" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url.replace(/^https?:\/\//, ''))}</a></div>
<button type="button" class="btn alt sm" data-act="seoReset" data-key="${p.key}">Use recommended</button></div>
<label>Title <span class="seo-n" data-n="title"></span><input name="title" value="${esc(p.title || p.recommended.title)}" maxlength="120"></label>
<label>Description <span class="seo-n" data-n="description"></span><textarea name="description" rows="2" maxlength="320">${esc(p.description || p.recommended.description)}</textarea></label>
<p class="sm muted" style="margin:-6px 0 8px">${p.tokens.map((t) => `<code>{${t}}</code>`).join(' ')}${p.template ? ' · one pattern for every page of this kind' : ''}</p>
<div class="seo-prev" aria-label="Search result preview"><span class="seo-url">${esc(p.url.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\//g, ' › '))}</span><span class="seo-t"></span><span class="seo-d"></span></div></div>`;
  box.innerHTML = `<form id="seof"><h2>Search engines</h2>
<label class="switchline"><input type="checkbox" name="indexing" ${S.indexing ? 'checked' : ''}> <span><strong>Show the public site in search results.</strong> Turn off before launch to keep Google out. Account apps, client links, checkout and Alpha are always hidden from search engines.</span></label>
<div class="row" style="margin-top:12px"><label>Google Search Console verification<input name="googleVerification" value="${esc(S.googleVerification)}" placeholder="Paste the meta tag or its content value" autocomplete="off"></label>
<label>Bing Webmaster Tools verification<input name="bingVerification" value="${esc(S.bingVerification)}" placeholder="Paste the meta tag or its content value" autocomplete="off"></label></div>
<p class="muted" style="font-size:13px;margin-top:-4px">After verifying, submit your sitemaps in Search Console and Bing: ${S.sitemaps.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a>`).join(' and ')}. Robots file: <a href="${esc(S.robots)}" target="_blank" rel="noopener">${esc(S.robots)}</a>.</p>
<h2 style="margin-top:22px">Pages</h2><p class="muted" style="font-size:13px;margin-top:-6px">What Google shows for each page. Keep titles under ${SEO_LIMITS.title} characters and descriptions under ${SEO_LIMITS.description} so they aren’t cut off. Tokens like <code>{product}</code> fill in automatically, so prices and names stay current.</p>
<div id="seoPages">${S.pages.map(page).join('')}</div>
<h2 style="margin-top:22px">Sharing</h2>
<div class="seo-share"><img src="${esc(img)}" alt="Share image" width="300" height="158"><div><p style="margin-top:0;font-size:14px">The picture shown when a page is shared on Facebook, LinkedIn, X, iMessage or Slack. Use 1200 × 630 pixels.</p>
<button type="button" class="btn alt sm" data-act="seoImg">Upload image</button>${seoDraft.shareImage ? ' <button type="button" class="btn alt sm" data-act="seoImgRm">Use the default</button>' : ''}</div></div>
<h2 style="margin-top:22px">Social profiles</h2><p class="muted" style="font-size:13px;margin-top:-6px">Linked to your business in Google’s results, so searches for ${esc(D.settings.productName)} can show them.</p>
<div class="seo-social">${Object.entries(S.socialLabels).map(([k, l]) => `<label>${esc(l)}<input name="social.${k}" value="${esc(S.social[k] || '')}" placeholder="https://" inputmode="url"></label>`).join('')}
<label>X handle<input name="social.xHandle" value="${esc(S.social.xHandle || '')}" placeholder="@workliopro"></label></div>
<div class="card-save"><button class="btn">Save SEO</button></div></form>`;
  const f = $('#seof', box);
  const update = (row) => { const k = row.dataset.key; const p = S.pages.find((x) => x.key === k); const vars = { ...S.sample };
    for (const n of ['title', 'description']) { const v = seoFill($(`[name=${n}]`, row).value, vars); const lim = SEO_LIMITS[n]; const c = $(`[data-n=${n}]`, row); c.textContent = `${v.length}/${lim}`; c.className = 'seo-n' + (v.length > lim ? ' over' : ''); }
    $('.seo-t', row).textContent = seoFill($('[name=title]', row).value, vars) || seoFill(p.recommended.title, vars);
    const d = seoFill($('[name=description]', row).value, vars); $('.seo-d', row).textContent = d.length > 158 ? d.slice(0, 155) + '…' : d; };
  $$('.seo-page', f).forEach((row) => { update(row); row.addEventListener('input', () => update(row)); });
  f._update = update;
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const b = { indexing: !!f.indexing.checked, googleVerification: f.googleVerification.value, bingVerification: f.bingVerification.value, shareImage: seoDraft.shareImage || '', social: {}, pages: {} };
    $$('[name^="social."]', f).forEach((i) => { b.social[i.name.slice(7)] = i.value; });
    $$('.seo-page', f).forEach((row) => { b.pages[row.dataset.key] = { title: $('[name=title]', row).value, description: $('[name=description]', row).value }; });
    if (!b.indexing && SEO.indexing && !confirm('Hide the whole public site from Google and other search engines? Pages already in results drop out over the next few weeks.')) return;
    try { SEO = await api('PUT', '/api/platform/seo', b); seoDraft = { shareImage: SEO.shareImage }; toast('SEO saved'); seoDraw(box); } catch (x) { toast(x.message, true); }
  });
}
A.seoReset = (d) => { const row = $(`.seo-page[data-key="${d.key}"]`); const p = SEO.pages.find((x) => x.key === d.key); $('[name=title]', row).value = p.recommended.title; $('[name=description]', row).value = p.recommended.description; $('#seof')._update(row); toast('Recommended text filled in. Save to keep it.'); };
// the image changes draw the card again, so typed changes are kept first
const seoKeep = () => { const f = $('#seof'); const keep = {}; $$('input:not([type=checkbox]), textarea', f).forEach((i) => { keep[(i.closest('.seo-page') ? i.closest('.seo-page').dataset.key + ':' : '') + i.name] = i.value; }); keep.indexing = f.indexing.checked; return keep; };
const seoRestore = (keep) => { const f = $('#seof'); $$('input:not([type=checkbox]), textarea', f).forEach((i) => { const k = (i.closest('.seo-page') ? i.closest('.seo-page').dataset.key + ':' : '') + i.name; if (k in keep) i.value = keep[k]; }); f.indexing.checked = keep.indexing; $$('.seo-page', f).forEach((row) => f._update(row)); };
A.seoImg = async () => { const url = await pickImage(); if (!url) return; const keep = seoKeep(); seoDraft.shareImage = url; seoDraw($('#seoCard')); seoRestore(keep); toast('Image uploaded. Save to use it.'); };
A.seoImgRm = () => { const keep = seoKeep(); seoDraft.shareImage = ''; seoDraw($('#seoCard')); seoRestore(keep); };
// the business app's menu (Settings → Menu): order and sections by drag and drop, and an icon from the built-in library for each link, for every account
let IC = null;
const icSvg = (d, size = 20) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
async function iconsCard(box, keep) {
  if (!box) return;
  if (!keep) { try { IC = await api('GET', '/api/platform/nav-icons'); } catch (x) { box.innerHTML = `<h2>Menu</h2><p class="muted">${esc(x.message)}</p>`; return; } }
  const lib = Object.fromEntries(IC.library.map((i) => [i.key, i]));
  const row = (l, i) => `<div class="ic-row" draggable="true" data-p="${esc(l.path)}"><span class="ic-handle" title="Drag to move" aria-hidden="true">⠿</span><span class="ic-prev">${icSvg(lib[l.icon].d)}</span><div class="ic-l"><strong>${esc(l.label)}</strong><span class="sm">${esc(lib[l.icon].label)}${l.icon === l.default ? ' · default icon' : ''}</span></div>
<div class="acts"><button type="button" class="btn alt sm ic-mv" data-act="icMove" data-p="${esc(l.path)}" data-dir="-1" aria-label="Move ${esc(l.label)} up" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="btn alt sm ic-mv" data-act="icMove" data-p="${esc(l.path)}" data-dir="1" aria-label="Move ${esc(l.label)} down" ${i === IC.links.length - 1 ? 'disabled' : ''}>↓</button>
${l.icon !== l.default ? `<button type="button" class="btn alt sm" data-act="icReset" data-p="${esc(l.path)}">Reset icon</button>` : ''}<button type="button" class="btn alt sm" data-act="icPick" data-p="${esc(l.path)}">Change icon</button></div></div>`;
  const section = (g) => { const items = IC.links.map((l, i) => [l, i]).filter(([l]) => l.group === g);
    return `<div class="ic-grp" data-g="${esc(g)}">${esc(g)}</div>${items.length ? items.map(([l, i]) => row(l, i)).join('') : `<div class="ic-empty" data-g="${esc(g)}">Drag links here. An empty section doesn’t show in the menu.</div>`}`; };
  box.innerHTML = `<div class="ic-head"><h2>Menu</h2>${IC.custom ? '<button type="button" class="btn alt sm" data-act="icResetOrder">Reset order</button>' : ''}</div>
<p class="muted" style="font-size:13px;margin-top:0">Every business’s menu (the sidebar and the phone menu). Drag a link by its handle to move it, even into another section, or use the arrows. Change any link’s icon. Changes show the next time a page loads.</p>
<div class="ic-wrap"><div class="ic-list">${IC.groups.map(section).join('')}</div>
<div class="ic-preview" aria-label="Preview"><div class="sm" style="margin-bottom:8px">Preview</div><div class="ic-side">${IC.groups.filter((g) => IC.links.some((l) => l.group === g)).map((g) => `<div class="ic-sg">${esc(g)}</div>` + IC.links.filter((l) => l.group === g).map((l) => `<div class="ic-sl">${icSvg(lib[l.icon].d, 18)}<span>${esc(l.label)}</span></div>`).join('')).join('')}</div></div></div>`;
  // drag and drop: drop on a link to go before or after it (and join its section), or on a section's name to go first in it
  const list = $('.ic-list', box); let dragP = null;
  const clear = () => $$('.ic-before, .ic-after, .ic-into', box).forEach((x) => x.classList.remove('ic-before', 'ic-after', 'ic-into'));
  $$('.ic-row', box).forEach((r) => {
    r.addEventListener('dragstart', (e) => { dragP = r.dataset.p; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragP); });
    r.addEventListener('dragend', () => { r.classList.remove('dragging'); clear(); dragP = null; });
  });
  const target = (e) => { const r = e.target.closest('.ic-row'); if (r && r.dataset.p !== dragP) { const b = r.getBoundingClientRect(); return { row: r, after: e.clientY > b.top + b.height / 2 }; } const g = e.target.closest('.ic-grp, .ic-empty'); return g ? { group: g } : null; };
  list.addEventListener('dragover', (e) => { if (!dragP) return; const t = target(e); if (!t) return; e.preventDefault(); clear(); if (t.row) t.row.classList.add(t.after ? 'ic-after' : 'ic-before'); else t.group.classList.add('ic-into'); });
  list.addEventListener('drop', (e) => {
    if (!dragP) return; const t = target(e); clear(); if (!t) return; e.preventDefault();
    const moving = IC.links.find((l) => l.path === dragP); const rest = IC.links.filter((l) => l !== moving);
    if (t.row) { const at = rest.findIndex((l) => l.path === t.row.dataset.p); moving.group = rest[at].group; rest.splice(at + (t.after ? 1 : 0), 0, moving); }
    else { const g = t.group.dataset.g; moving.group = g; const first = rest.findIndex((l) => l.group === g); rest.splice(first < 0 ? rest.length : first, 0, moving); }
    icSaveOrder(rest, box);
  });
}
// keep the sections in their fixed order, show the change right away, then save it
async function icSaveOrder(links, box) {
  IC.links = IC.groups.flatMap((g) => links.filter((l) => l.group === g)); iconsCard(box, true);
  try { IC = await api('PUT', '/api/platform/nav-order', { order: IC.links.map((l) => ({ path: l.path, group: l.group })) }); iconsCard(box, true); toast('Menu order saved'); } catch (x) { toast(x.message, true); iconsCard(box); }
}
// the arrows: within a section they swap with the neighbor; at a section's edge they move into the next section
A.icMove = (d) => {
  const L = IC.links.slice(); const i = L.findIndex((l) => l.path === d.p); const j = i + Number(d.dir); const cur = L[i]; const nb = L[j]; if (!nb) return;
  if (nb.group === cur.group) { L[i] = nb; L[j] = cur; } else cur.group = nb.group;
  icSaveOrder(L, $('#iconsCard'));
};
A.icResetOrder = async () => { if (!confirm('Put the menu back in its original order and sections? Icons you chose stay.')) return; try { IC = await api('PUT', '/api/platform/nav-order', { reset: true }); iconsCard($('#iconsCard'), true); toast('Menu order reset'); } catch (x) { toast(x.message, true); } };
A.icPick = (d) => {
  const l = IC.links.find((x) => x.path === d.p);
  const m = modal(`Icon for ${l.label}`, `<div class="ic-grid">${IC.library.map((i) => `<button type="button" class="ic-opt ${i.key === l.icon ? 'on' : ''}" data-act="icSet" data-p="${esc(l.path)}" data-k="${i.key}" title="${esc(i.label)}">${icSvg(i.d, 24)}<span>${esc(i.label)}${i.key === l.default ? ' (default)' : ''}</span></button>`).join('')}</div>
<div class="acts" style="margin-top:12px"><button type="button" class="btn alt" data-act="closeModal">Cancel</button></div>`, { wide: true });
  return m;
};
A.icSet = async (d) => { try { IC = await api('PUT', '/api/platform/nav-icons', { path: d.p, icon: d.k }); closeModal(); toast('Icon changed'); iconsCard($('#iconsCard')); } catch (x) { toast(x.message, true); } };
A.icReset = async (d) => { try { IC = await api('PUT', '/api/platform/nav-icons', { path: d.p, icon: null }); toast('Back to the default icon'); iconsCard($('#iconsCard')); } catch (x) { toast(x.message, true); } };
// the Alpha team: you (the owner) and support users, who see only Accounts, Messages, Forum and Help Center
async function teamCard(box) {
  let T; try { T = await api('GET', '/api/platform/team'); } catch (x) { box.innerHTML = `<h2>Alpha team</h2><p class="muted">${esc(x.message)}</p>`; return; }
  const when = (s) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never');
  const status = (a) => (a.role === 'owner' ? '<span class="cstatus active">Owner: everything</span>'
    : a.pending ? `<span class="cstatus q-sent">${a.linkExpired ? 'Link expired' : a.lastLoginAt ? 'Reset sent' : 'Invite sent'}</span>${a.linkSentAt ? `<div class="sm">${when(a.linkSentAt)}</div>` : ''}` : '<span class="cstatus">Support</span>');
  box.innerHTML = `<h2>Alpha team</h2><p class="muted" style="font-size:13px;margin-top:0">Support users log in at this same Alpha address and see only <strong>Accounts</strong>, <strong>Messages</strong> (including Live chat), <strong>Forum</strong> and <strong>Help Center</strong>. They get a welcome email with a link to choose their password.</p>
<div class="tablewrap"><table class="acc"><thead><tr><th>Name</th><th>Access</th><th>Last login</th><th></th></tr></thead><tbody>${T.map((a) => `<tr><td class="nm">${esc(a.name)}${a.id === D.admin.id ? ' <span class="sm">(you)</span>' : ''}<div class="sm">${esc(a.email)}</div></td>
<td>${status(a)}</td><td class="sm">${when(a.lastLoginAt)}</td>
<td><div class="acts">${a.role === 'support' ? `<button type="button" class="btn alt sm" data-act="teamLink" data-id="${a.id}" data-name="${esc(a.name)}" data-pending="${a.pending && !a.lastLoginAt ? 1 : ''}">${a.pending && !a.lastLoginAt ? 'Resend invite' : 'Send password reset'}</button><button type="button" class="btn danger sm" data-act="teamRm" data-id="${a.id}" data-name="${esc(a.name)}">Remove</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>
<button type="button" class="btn alt sm" data-act="teamAdd" style="margin-top:12px">+ Add a support user</button>`;
}
// after an invite or reset: confirm it was emailed, or hand over the link when email isn't working
function teamLinkResult(r, name) {
  if (r.invite.sent) return toast(r.invite.kind === 'invite' ? `Welcome email sent to ${name}` : `Password reset sent to ${name}`);
  modal(r.invite.kind === 'invite' ? 'Share the invite link' : 'Share the reset link', `<p>The email couldn’t be sent (${esc(r.invite.detail)}). Send ${esc(name)} this link yourself. It works for 7 days.</p>
<div class="linkbox"><input readonly value="${esc(r.invite.link)}" aria-label="Link"><button type="button" class="btn alt" data-act="copy">Copy</button></div>
<div class="acts" style="margin-top:12px"><button type="button" class="btn" data-act="closeModal">Done</button></div>`);
}
A.teamAdd = () => {
  const m = modal('Add a support user', `<form id="tmf"><p class="muted" style="margin-top:0">They’ll get a welcome email with a link to activate their login and choose a password. They’ll see Accounts, Messages, Forum and Help Center.</p>
<div class="row"><label>Name<input name="name" required maxlength="100" autocomplete="off"></label><label>Email<input name="email" type="email" required autocomplete="off"></label></div>
<div class="acts" style="margin-top:12px"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Send invite</button></div></form>`);
  $('#tmf', m).addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); const btn = $('button.btn:not(.alt)', e.target); btn.disabled = true;
    try { const r = await api('POST', '/api/platform/team', b); closeModal(); teamCard($('#teamCard')); teamLinkResult(r, b.name.trim().split(/\s+/)[0]); } catch (x) { btn.disabled = false; toast(x.message, true); }
  });
};
A.teamLink = async (d) => {
  if (!d.pending && !confirm(`Send ${d.name} a password reset? Their current password stops working until they choose a new one from the email.`)) return;
  try { const r = await api('POST', `/api/platform/team/${d.id}/link`, {}); teamCard($('#teamCard')); teamLinkResult(r, d.name); } catch (x) { toast(x.message, true); }
};
A.teamRm = async (d) => { if (!confirm(`Remove ${d.name}? They’re logged out right away and can’t log in to Alpha anymore.`)) return; try { await api('DELETE', '/api/platform/team/' + d.id); toast(`${d.name} removed`); teamCard($('#teamCard')); } catch (x) { toast(x.message, true); } };
// Settings → Integrations: one service at a time, picked from the Settings list; its dot shows whether the service is set up
function igTabs(box) {
  const secs = $$('section.ig', box);
  IG_TABS.forEach(([k, , title]) => {
    const sec = secs.find((s) => $('h3', s).textContent === title); if (!sec) return;
    sec.dataset.ig = k; sec.hidden = k !== igTab; const ok = !!$('.ig-h .cstatus.active', sec);
    const dot = $(`[data-ig-dot="${k}"]`); if (dot) { dot.classList.toggle('on', ok); dot.title = ok ? 'Set up' : 'Not set up'; }
  });
}
/* ===== social: the platform's own TikTok account (lib/tiktok.js). Connect it, then post a video or photos now, at a set time,
   or to TikTok drafts, and follow each post's status. The post form follows TikTok's posting rules: it shows the account it posts to,
   asks for a privacy level every time (no default), leaves comments, duets and stitches off until turned on, asks about commercial
   content, and shows the Music Usage Confirmation. ===== */
let SO = null; let soDraft = null; let soTimer = 0; // SO: the account and posts; soDraft: the post being written (its media already uploaded)
const SO_ST = { scheduled: ['Scheduled', 'q-sent'], posting: ['Sending', 'q-converted'], processing: ['TikTok is processing', 'q-converted'], posted: ['Posted', 'q-approved'], sent: ['In TikTok drafts', 'q-approved'], failed: ['Failed', 'q-declined'] };
const PRIVACY = { PUBLIC_TO_EVERYONE: 'Everyone', MUTUAL_FOLLOW_FRIENDS: 'Friends', FOLLOWER_OF_CREATOR: 'Followers', SELF_ONLY: 'Only me' };
const MUSIC_URL = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en';
const BC_URL = 'https://www.tiktok.com/legal/page/global/bc-policy/en';
const soWhen = (s) => (s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
async function socialView(main) {
  const q = new URLSearchParams(location.search); // back from TikTok's sign-in
  if (q.get('tiktok') || q.get('tiktok_error')) { if (q.get('tiktok')) toast('TikTok connected'); else toast(q.get('tiktok_error'), true); history.replaceState(null, '', location.pathname + '#social'); SO = null; }
  if (!SO) main.innerHTML = '<div class="head"><h1>Social</h1></div><p class="muted">Loading…</p>'; // fresh each time the page opens
  try { SO = await api('GET', '/api/platform/social'); } catch (x) { main.innerHTML = `<div class="head"><h1>Social</h1></div><div class="card">${esc(x.message)}</div>`; return; }
  if (tab !== 'social') return;
  const a = SO.account;
  main.innerHTML = `<div class="head"><div><h1>Social</h1><p class="sub" style="margin:4px 0 0">Post to ${esc(D.settings.productName)}’s TikTok, now, at a set time, or to your TikTok drafts.</p></div></div>
<div class="so-grid"><div><div class="card so-acct">${!SO.ready ? `<h2>TikTok</h2><p class="muted" style="margin:0">Add your TikTok app’s Client key and Client secret in <a href="#settings" data-act="setTab" data-k="integrations:tiktok">Settings → Integrations → TikTok</a>, then connect your account here.</p>`
    : !a ? `<h2>TikTok</h2><p class="muted">Connect the TikTok account ${esc(D.settings.productName)} posts to. You’ll sign in on TikTok and allow posting.</p><button type="button" class="btn" data-act="soConnect">Connect TikTok</button>`
      : `<h2>TikTok</h2><div class="so-who">${a.avatar ? `<img src="${esc(a.avatar)}" alt="" width="44" height="44">` : ''}<div><strong>${esc(a.name)}</strong><div class="sm muted">Connected ${fmtDate(a.connectedAt)}</div></div><button type="button" class="btn alt sm" data-act="soDisconnect">Disconnect</button></div>
<p class="muted sm" style="margin:12px 0 0">Until TikTok approves your app, keep this TikTok account private and post with “Only me”.</p>`}</div>
${a ? '<div class="card" id="soNew"><h2>New post</h2><p class="muted">Checking what this account can post…</p></div>' : ''}</div>
<div class="card so-list"><h2>Posts</h2>${soPosts()}</div></div>`;
  if (a) soCompose($('#soNew', main));
  clearTimeout(soTimer); // follow posts TikTok is still working on
  if (SO.posts.some((p) => ['posting', 'processing'].includes(p.status) || (p.status === 'scheduled' && new Date(p.scheduledAt) - Date.now() < 120e3))) soTimer = setTimeout(soRefresh, 10e3);
}
async function soRefresh() {
  if (tab !== 'social') return;
  try { const r = await api('GET', '/api/platform/social'); SO.posts = r.posts; SO.account = r.account; const box = $('.so-list'); if (box) box.innerHTML = `<h2>Posts</h2>${soPosts()}`; } catch (x) { /* next time */ }
  if (SO.posts.some((p) => ['posting', 'processing', 'scheduled'].includes(p.status))) soTimer = setTimeout(soRefresh, 10e3);
}
function soPosts() {
  if (!SO.posts.length) return '<p class="muted" style="margin:0">No posts yet.</p>';
  return SO.posts.map((p) => { const [l, c] = SO_ST[p.status] || [p.status, 'q-draft']; const m = p.media[0];
    return `<div class="so-post"><div class="so-thumb">${m.type === 'video' ? `<video src="${esc(m.url)}#t=0.5" muted preload="metadata"></video>` : `<img src="${esc(m.url)}" alt="">`}${p.media.length > 1 ? `<span>${p.media.length}</span>` : ''}</div>
<div class="so-pm"><div class="so-ph"><span class="cstatus ${c}">${l}</span><span class="sm muted">${p.status === 'scheduled' ? 'For ' + soWhen(p.scheduledAt) : soWhen(p.postedAt || p.sentAt || p.createdAt)}</span></div>
<div class="so-cap">${esc(p.caption || '(no caption)')}</div><div class="sm muted">${p.kind === 'video' ? 'Video' : `${p.media.length} photo${p.media.length === 1 ? '' : 's'}`} · ${p.mode === 'inbox' ? 'To TikTok drafts' : `Direct post · ${esc(PRIVACY[p.privacy] || p.privacy)}`}${p.createdBy ? ` · by ${esc(p.createdBy)}` : ''}</div>
${p.error ? `<div class="so-err">${esc(p.error)}</div>` : ''}</div>
${['posting', 'processing'].includes(p.status) ? '' : `<div class="so-acts">${p.status === 'failed' ? (p.errorCode === 'unaudited_client_can_only_post_to_private_accounts' && p.privacy !== 'SELF_ONLY' && !p.branded ? `<button type="button" class="btn sm" data-act="soRetry" data-id="${p.id}" data-private="1">Retry as “Only me”</button>` : `<button type="button" class="btn sm" data-act="soRetry" data-id="${p.id}">Retry</button>`) : ''}<button type="button" class="btn alt sm" data-act="soRemove" data-id="${p.id}">${p.status === 'scheduled' ? 'Cancel' : 'Remove'}</button></div>`}</div>`; }).join('');
}
A.soConnect = async () => { const r = await api('POST', '/api/platform/social/tiktok/connect', {}); location.href = r.url; };
A.soDisconnect = async () => { if (!confirm('Disconnect TikTok? Scheduled posts won’t go out until you connect again.')) return; await api('POST', '/api/platform/social/tiktok/disconnect', {}); SO = null; toast('TikTok disconnected'); socialView($('#main')); };
A.soRetry = async (d, el) => { el.disabled = true; try { await api('POST', `/api/platform/social/posts/${d.id}/retry`, d.private ? { privacy: 'SELF_ONLY' } : {}); toast('Sending to TikTok again'); } catch (x) { toast(x.message, true); } SO = null; socialView($('#main')); };
A.soRemove = async (d) => { const p = SO.posts.find((x) => x.id === d.id); if (!confirm(p.status === 'scheduled' ? 'Cancel this scheduled post?' : 'Remove this post from the list? It stays on TikTok.')) return; await api('DELETE', '/api/platform/social/posts/' + d.id); SO = null; socialView($('#main')); };
// the post form: TikTok's settings for this account are fetched each time, as TikTok asks
async function soCompose(box) {
  let C; try { C = await api('GET', '/api/platform/social/tiktok/creator'); } catch (x) { box.innerHTML = `<h2>New post</h2><p class="so-err" style="margin:0">${esc(x.message)}</p>`; return; }
  soDraft = soDraft || { media: [] };
  const off = (k) => (C[k] ? ' <small class="muted">(turned off in your TikTok settings)</small>' : '');
  box.innerHTML = `<h2>New post</h2><form id="soForm" novalidate><div class="so-who sm">${C.avatar ? `<img src="${esc(C.avatar)}" alt="" width="28" height="28">` : ''}<span>Posting to <strong>${esc(C.nickname || SO.account.name)}</strong>${C.username ? ` (@${esc(C.username)})` : ''}</span></div>
<div class="so-media" id="soMedia"></div>
<label class="so-pick"><input type="file" id="soFile" accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp" multiple hidden><span class="btn alt">Add a video or photos</span><small class="muted">One video${C.maxSeconds ? ` (up to ${Math.floor(C.maxSeconds / 60) ? Math.floor(C.maxSeconds / 60) + ' min' : C.maxSeconds + ' sec'})` : ''}, or up to 35 photos. MP4, MOV or WebM; JPG, PNG or WebP.</small></label>
<div class="so-cap-f"><label for="soCaption">Caption</label><textarea id="soCaption" name="caption" rows="4" maxlength="2200" placeholder="What’s this post about? #hashtags welcome">${esc(soDraft.caption || '')}</textarea>
<div class="so-cap-bar">${SO.ai ? `<details class="menu so-ai"><summary class="btn alt sm" title="Write a caption from the video or photos">✨ <span>Write with AI</span></summary><div class="menu-list"><div class="so-ai-h">Write it…</div>${SO_TONES.map(([k, l]) => `<button type="button" data-act="soAi" data-tone="${k}">${l}</button>`).join('')}</div></details>
<button type="button" class="btn alt sm so-undo" data-act="soAiUndo" hidden>Undo</button>` : ''}<small class="muted so-count"></small></div></div>
<fieldset class="so-mode"><legend>Where it goes</legend><label><input type="radio" name="mode" value="direct" ${soDraft.mode !== 'inbox' ? 'checked' : ''}> <span><strong>Post to TikTok</strong><small class="muted">It goes straight to your profile.</small></span></label>
<label><input type="radio" name="mode" value="inbox" ${soDraft.mode === 'inbox' ? 'checked' : ''}> <span><strong>Send to TikTok drafts</strong><small class="muted">You’ll get a notification in TikTok to edit and post it there.</small></span></label></fieldset>
<div class="so-direct"><label>Who can see this post<small class="muted so-hint">Until TikTok approves your app, choose “Only me”, and keep your TikTok account set to private. Otherwise TikTok refuses the post.</small><select name="privacy"><option value="" selected disabled>Choose…</option>${C.privacy.map((k) => `<option value="${esc(k)}">${esc(PRIVACY[k] || k)}</option>`).join('')}</select></label>
<div class="so-allow"><span class="lbl">Allow people to</span><label class="chk"><input type="checkbox" name="allowComment" ${C.commentOff ? 'disabled' : ''}> Comment${off('commentOff')}</label>
<label class="chk so-vid"><input type="checkbox" name="allowDuet" ${C.duetOff ? 'disabled' : ''}> Duet${off('duetOff')}</label><label class="chk so-vid"><input type="checkbox" name="allowStitch" ${C.stitchOff ? 'disabled' : ''}> Stitch${off('stitchOff')}</label></div>
<label class="chk"><input type="checkbox" name="disclose"> <span><strong>Disclose post content</strong><small class="muted">Turn on if this post promotes you, a brand, a product or a service.</small></span></label>
<div class="so-disc" hidden><label class="chk"><input type="checkbox" name="yourBrand"> <span><strong>Your brand</strong><small class="muted">You’re promoting yourself or your own business. TikTok labels it “Promotional content”.</small></span></label>
<label class="chk"><input type="checkbox" name="branded"> <span><strong>Branded content</strong><small class="muted">You’re promoting another brand or a third party. TikTok labels it “Paid partnership”.</small></span></label></div></div>
<fieldset class="so-whenf"><legend>When</legend><label><input type="radio" name="when" value="now" checked> Now</label><label><input type="radio" name="when" value="later"> Schedule</label><input type="datetime-local" name="at" hidden></fieldset>
<p class="so-legal sm muted"></p><div class="acts" style="justify-content:flex-start"><button class="btn" id="soGo" disabled>Post now</button></div></form>`;
  const f = $('#soForm', box); f._c = C;
  const sync = () => {
    const busy = soDraft.media.some((m) => !m.file);
    const direct = f.mode.value === 'direct'; const later = f.when.value === 'later'; const video = soDraft.media.some((m) => m.type === 'video');
    $('.so-direct', f).hidden = !direct; f.at.hidden = !later; $$('.so-vid', f).forEach((l) => { l.hidden = !video; });
    $('.so-disc', f).hidden = !f.disclose.checked;
    const branded = direct && f.disclose.checked && f.branded.checked;
    const own = $('option[value=SELF_ONLY]', f.privacy); if (own) { own.disabled = branded; own.textContent = branded ? 'Only me (not for branded content)' : PRIVACY.SELF_ONLY; if (branded && f.privacy.value === 'SELF_ONLY') f.privacy.value = ''; }
    $('.so-count', f).textContent = `${f.caption.value.length} / 2200`;
    const ai = $('.so-ai', f); if (ai) { ai.classList.toggle('off', !soDraft.media.length || busy); $('summary', ai).title = !soDraft.media.length ? 'Add a video or photos first' : busy ? 'Waiting for the upload to finish' : 'Write a caption from the video or photos'; }
    $('.so-legal', f).innerHTML = direct ? `By posting, you agree to TikTok’s ${branded ? `<a href="${BC_URL}" target="_blank" rel="noopener">Branded Content Policy</a> and ` : ''}<a href="${MUSIC_URL}" target="_blank" rel="noopener">Music Usage Confirmation</a>.${f.disclose.checked && !branded && f.yourBrand.checked ? ' Your post will be labeled “Promotional content”.' : branded ? ' Your post will be labeled “Paid partnership”.' : ''}` : 'TikTok will notify you to finish the post in the TikTok app.';
    const ok = soDraft.media.length && !busy && (!direct || (f.privacy.value && (!f.disclose.checked || f.yourBrand.checked || f.branded.checked))) && (!later || f.at.value);
    $('#soGo', f).disabled = !ok; $('#soGo', f).textContent = !direct ? (later ? 'Schedule to drafts' : 'Send to drafts') : later ? 'Schedule post' : 'Post now';
    soDraft.caption = f.caption.value; soDraft.mode = f.mode.value;
  };
  f._sync = sync; soMediaDraw(f); sync();
  f.addEventListener('input', sync); f.addEventListener('change', sync);
  $('#soFile', f).addEventListener('change', (e) => { soAdd(f, [...e.target.files]); e.target.value = ''; });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const go = $('#soGo', f); go.disabled = true;
    const b = { caption: f.caption.value, media: soDraft.media.map((m) => ({ file: m.file, name: m.name })), mode: f.mode.value, privacy: f.privacy.value, allowComment: f.allowComment.checked, allowDuet: f.allowDuet.checked, allowStitch: f.allowStitch.checked,
      disclose: f.disclose.checked, yourBrand: f.yourBrand.checked, branded: f.branded.checked, scheduledAt: f.when.value === 'later' && f.at.value ? new Date(f.at.value).toISOString() : null };
    try {
      const p = await api('POST', '/api/platform/social/posts', b); soDraft = null;
      toast(p.status === 'scheduled' ? `Scheduled for ${soWhen(p.scheduledAt)}` : p.mode === 'inbox' ? 'Sent. Open TikTok to finish your post from the notification.' : 'Sent to TikTok. It can take a few minutes to show on your profile.');
      SO = null; socialView($('#main'));
    } catch (x) { toast(x.message, true); go.disabled = false; }
  });
}
// Write with AI: Claude looks at up to 4 photos, or 4 frames taken from the video here in the browser, and writes the caption;
// what's already typed is sent along as notes. Undo puts back the text from before.
const SO_TONES = [['catchy', 'Catchy'], ['friendly', 'Friendly'], ['professional', 'Professional'], ['funny', 'Funny'], ['shorter', 'Short']];
const soJpeg = (src, w, h) => { const k = Math.min(1, 768 / Math.max(w, h)); const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8); };
async function soFrames() {
  const m = soDraft.media;
  if (m[0].type !== 'video') return Promise.all(m.slice(0, 4).map((p) => new Promise((r) => { const i = new Image(); i.onload = () => r(soJpeg(i, i.naturalWidth, i.naturalHeight)); i.onerror = () => r(null); i.src = p.preview; }))).then((l) => l.filter(Boolean));
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = m[0].preview;
  await new Promise((r, x) => { v.onloadeddata = r; v.onerror = () => x(new Error('Couldn’t read the video here. Write the caption yourself.')); });
  const out = [];
  for (const at of [0.1, 0.35, 0.6, 0.85]) {
    await new Promise((r) => { v.onseeked = r; v.currentTime = Math.min(v.duration - 0.05, v.duration * at) || 0; });
    out.push(soJpeg(v, v.videoWidth, v.videoHeight));
  }
  return out;
}
A.soAi = async (d, el) => {
  const f = $('#soForm'); const menu = el.closest('details'); menu.open = false;
  if (!soDraft.media.length) return toast('Add a video or photos first', true);
  if (soDraft.media.some((m) => !m.file)) return toast('Wait for the upload to finish', true);
  const sum = $('summary span', menu); menu.classList.add('busy'); sum.textContent = 'Writing…';
  try {
    const before = f.caption.value;
    const r = await api('POST', '/api/platform/social/caption', { images: await soFrames(), notes: before, tone: d.tone, kind: soDraft.media[0].type });
    f._aiBefore = before; f.caption.value = r.caption; $('.so-undo', f).hidden = false; f._sync(); f.caption.focus();
  } catch (x) { toast(x.message, true); } finally { menu.classList.remove('busy'); sum.textContent = 'Write with AI'; }
};
document.addEventListener('click', (e) => { $$('details.so-ai[open]').forEach((m) => { if (!m.contains(e.target)) m.open = false; }); });
A.soAiUndo = (d, el) => { const f = $('#soForm'); if (f._aiBefore === undefined) return; f.caption.value = f._aiBefore; delete f._aiBefore; el.hidden = true; f._sync(); };
function soMediaDraw(f) {
  $('#soMedia', f).innerHTML = soDraft.media.map((m, i) => `<div class="so-tile">${m.type === 'video' ? `<video src="${esc(m.preview)}" muted preload="metadata"></video>` : `<img src="${esc(m.preview)}" alt="">`}
${m.file ? '' : `<span class="so-prog">${m.pct || 0}%</span>`}<button type="button" class="so-x" data-act="soRmMedia" data-i="${i}" aria-label="Remove">×</button></div>`).join('');
}
A.soRmMedia = (d) => { const f = $('#soForm'); soDraft.media.splice(Number(d.i), 1); soMediaDraw(f); f._sync(); };
// TikTok takes JPG and WebP photos: PNGs (like app screenshots) become JPGs, and very large photos are scaled to 1920 px on the longer side
async function soPhoto(file) {
  if (file.type !== 'image/png' && file.size < 15e6) return file;
  const img = await createImageBitmap(file); const k = Math.min(1, 1920 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.9));
}
const soDuration = (file) => new Promise((r) => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => r(v.duration || 0); v.onerror = () => r(0); v.src = URL.createObjectURL(file); });
async function soAdd(f, files) {
  const C = f._c; const vids = files.filter((x) => x.type.startsWith('video/')); const pics = files.filter((x) => x.type.startsWith('image/'));
  const hasVideo = soDraft.media.some((m) => m.type === 'video');
  if (vids.length && (vids.length > 1 || pics.length || soDraft.media.length)) return toast('A TikTok post is one video, or photos (up to 35), not both', true);
  if (pics.length && hasVideo) return toast('A TikTok post is one video, or photos (up to 35), not both', true);
  if (soDraft.media.length + pics.length > 35) return toast('Use 35 photos or fewer', true);
  if (vids.length) { const s = await soDuration(vids[0]); if (C.maxSeconds && s > C.maxSeconds) return toast(`This account can post videos up to ${C.maxSeconds} seconds long. This one is ${Math.round(s)} seconds.`, true); }
  for (const raw of [...vids, ...pics]) {
    const file = raw.type.startsWith('image/') ? await soPhoto(raw) : raw;
    const m = { type: file.type.startsWith('video/') ? 'video' : 'photo', name: raw.name, preview: URL.createObjectURL(file), pct: 0 }; soDraft.media.push(m); soMediaDraw(f); f._sync();
    try {
      const r = await new Promise((resolve, reject) => {
        const x = new XMLHttpRequest(); x.open('POST', '/api/platform/social/media'); x.setRequestHeader('Content-Type', file.type); x.setRequestHeader('X-File-Name', encodeURIComponent(raw.name));
        x.upload.onprogress = (e) => { if (e.lengthComputable) { m.pct = Math.round((e.loaded / e.total) * 100); const p = $$('#soMedia .so-prog')[soDraft.media.indexOf(m)]; if (p) p.textContent = m.pct + '%'; } };
        x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch (e) { /* not JSON */ } if (x.status >= 200 && x.status < 300) resolve(j); else reject(new Error(j.error || `Upload failed (${x.status})`)); };
        x.onerror = () => reject(new Error('Upload failed. Check your connection and try again.')); x.send(file);
      });
      m.file = r.file;
    } catch (x) { toast(x.message, true); soDraft.media.splice(soDraft.media.indexOf(m), 1); }
    if ($('#soForm') === f) { soMediaDraw(f); f._sync(); }
  }
}

/* ===== promotions: discount codes, the referral program and its activity, and the Founding Supporters list ===== */
let promoTab = 'codes'; let RF = null; // RF: the referral program and its activity (lib/referrals.js)
let SP = null; // SP: the Founding Supporters list (lib/supporters.js)
function promoView(main) {
  const due = RF ? RF.rewards.filter((w) => w.status === 'to send').length : 0;
  main.innerHTML = `<div class="head"><div><h1>Pricing</h1><p class="sub" style="margin:4px 0 0">Discount codes for sign-ups, a referral program for the businesses on ${esc(D.settings.productName)}, and the Founding Supporters page.</p></div></div>
${pricingSeg(due)}<div id="promoBody"></div>`;
  sideLayout(main);
  const box = $('#promoBody', main);
  if (promoTab === 'codes') return discountsView(box);
  if (promoTab === 'supporters') { if (SP) return supportersView(box); box.innerHTML = '<p class="muted">Loading…</p>'; api('GET', '/api/platform/supporters').then((r) => { SP = r; if (tab === 'discounts' && promoTab === 'supporters') promoView($('#main')); }).catch((x) => toast(x.message, true)); return; }
  if (!RF) { box.innerHTML = '<p class="muted">Loading…</p>'; api('GET', '/api/platform/referrals').then((r) => { RF = r; if (tab === 'discounts') promoView($('#main')); }).catch((x) => toast(x.message, true)); return; }
  (promoTab === 'program' ? referralProgramView : referralActivityView)(box);
}
// Pricing's tabs: Plans & features is its own page (#plans); the rest are Promotions (#discounts)
const pricingSeg = (due = 0) => sideNav('Pricing', 'pricingTab', [['plans', 'Plans & features'], ['codes', 'Discount codes'], ['program', 'Referral program'], ['activity', 'Referral activity'], ['supporters', 'Founding Supporters']]
  .map(([k, l]) => [k, l, k === 'activity' && due ? due : undefined, tab === 'plans' ? k === 'plans' : promoTab === k, 'Rewards to send']));
A.pricingTab = (d) => {
  if (d.k === 'plans') { location.hash = 'plans'; return; }
  promoTab = d.k; if (tab === 'discounts') promoView($('#main')); else location.hash = 'discounts';
};
// pick an image file and upload it; resolves to its address (/brand/media-…)
const pickImage = () => new Promise((resolve) => {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/gif,image/webp';
  i.onchange = () => { const f = i.files[0]; if (!f) return resolve(''); if (f.size > 2 * 1024 * 1024) { toast('Use an image under 2 MB', true); return resolve(''); }
    const r = new FileReader(); r.onload = () => api('POST', '/api/platform/media', { dataUrl: r.result }).then((x) => resolve(x.url), (x) => { toast(x.message, true); resolve(''); }); r.readAsDataURL(f); };
  i.click();
});
let rfDraft = null; // the program form's milestones and images, while editing
function referralProgramView(box) {
  const p = RF.program; if (!rfDraft) rfDraft = { heroImage: p.heroImage, milestones: structuredClone(p.milestones) };
  const discs = D.discounts || [];
  const mileRow = (m, i) => `<div class="rp-mile" data-i="${i}"><button type="button" class="rp-img" data-act="rpMileImg" data-i="${i}" title="Choose a picture"${m.image ? ` style="background-image:url('${esc(m.image)}')"` : ''}>${m.image ? '' : '+ Picture'}</button>
<div class="rp-mile-f"><div class="row"><label>Reward<input data-k="title" value="${esc(m.title)}" maxlength="80" placeholder="e.g. $100 prepaid card"></label><label>Paying referrals needed<input data-k="count" type="number" min="1" value="${esc(m.count || '')}"></label></div>
<label>Description<input data-k="desc" value="${esc(m.desc)}" maxlength="300" placeholder="e.g. A prepaid card you can use anywhere cards are accepted"></label></div>
<button type="button" class="rm-plan" data-act="rpMileRm" data-i="${i}" title="Remove this milestone">Remove</button></div>`;
  box.innerHTML = `<form id="rpf" class="card" style="max-width:860px">
<label class="switchline"><input type="checkbox" name="enabled" ${p.enabled ? 'checked' : ''}> <span><strong>Referral program on.</strong> Owners and admins see “Refer &amp; earn” in their app.</span></label>
<h2 style="margin-top:14px">What businesses see</h2>
<div class="row"><label>Title<input name="title" value="${esc(p.title)}" maxlength="80"></label><label>Months of credit per paying referral<input name="months" type="number" min="0" max="24" value="${esc(p.months)}"></label></div>
<label>Introduction<textarea name="intro" rows="2" maxlength="400">${esc(p.intro)}</textarea></label>
<p class="muted" style="font-size:12px;margin:-6px 0 12px"><code>{{months}}</code> becomes the number of months. A referrer earns them when the business they referred pays for a plan: with Stripe, their next charge moves out by that many months; without a subscription yet, the months start when they subscribe.</p>
<div class="rp-hero"><button type="button" class="rp-img wide" data-act="rpHeroImg" title="Choose the header picture"${rfDraft.heroImage ? ` style="background-image:url('${esc(rfDraft.heroImage)}')"` : ''}>${rfDraft.heroImage ? '' : '+ Header picture (optional)'}</button>${rfDraft.heroImage ? '<button type="button" class="rm-plan" data-act="rpHeroRm">Remove picture</button>' : ''}</div>
<h2 style="margin-top:18px">The friend’s offer</h2>
<div class="row"><label>Discount code applied from a referral link<select name="friendDiscountId"><option value="">None</option>${discs.map((d) => `<option value="${d.id}" ${d.id === p.friendDiscountId ? 'selected' : ''}>${esc(d.code)} · ${esc(d.summary)}${d.status !== 'active' ? ` (${d.status})` : ''}</option>`).join('')}</select></label>
<label>How to describe it (optional)<input name="friendText" value="${esc(p.friendText)}" maxlength="200" placeholder="e.g. 30% off your first 3 months"></label></div>
<p class="muted" style="font-size:12px;margin:-6px 0 0">Make the code in Discount codes first. Its rules still apply (plans, dates, uses). Without a description, the code’s own summary is shown.</p>
<h2 style="margin-top:18px">Milestone rewards</h2><p class="muted" style="font-size:13px;margin-top:0">Prizes you send yourself when a business reaches a number of paying referrals. They show up in Referral activity to send.</p>
<div id="rpMiles">${rfDraft.milestones.map(mileRow).join('') || '<p class="muted" style="font-size:14px">No milestones yet.</p>'}</div>
<button type="button" class="btn alt sm" data-act="rpMileAdd">+ Add a milestone</button>
<h2 style="margin-top:18px">Video (optional)</h2>
<div class="row"><label>Title<input name="videoTitle" value="${esc(p.video.title)}" maxlength="80" placeholder="e.g. Refer in minutes, earn for months"></label><label>Video link<input name="videoUrl" value="${esc(p.video.url)}" maxlength="300" placeholder="https://www.youtube.com/watch?v=…"></label></div>
<label>Text<input name="videoText" value="${esc(p.video.text)}" maxlength="300" placeholder="e.g. A walkthrough of sharing your link and tracking referrals"></label>
<div class="savebar"><span class="muted">YouTube links play on the page; other links open in a new tab.</span><button class="btn">Save referral program</button></div></form>`;
  const f = $('#rpf', box);
  const readMiles = () => { $$('.rp-mile', f).forEach((row) => { const m = rfDraft.milestones[row.dataset.i]; $$('[data-k]', row).forEach((i) => { m[i.dataset.k] = i.value; }); }); };
  f._readMiles = readMiles;
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); readMiles(); const b = Object.fromEntries(new FormData(f)); b.enabled = !!f.enabled.checked;
    try { RF = await api('PUT', '/api/platform/referrals/program', { ...b, heroImage: rfDraft.heroImage, milestones: rfDraft.milestones }); rfDraft = null; await load(); toast(RF.program.enabled ? 'Referral program saved and on' : 'Referral program saved (off)'); render(); } catch (x) { toast(x.message, true); }
  });
}
// callers read the milestone fields before changing the list, so this only redraws (re-reading after a removal would use the old row numbers)
const rpRedraw = () => { const f = $('#rpf'); const keep = f ? Object.fromEntries(new FormData(f)) : {}; referralProgramView($('#promoBody')); const g = $('#rpf'); Object.entries(keep).forEach(([k, v]) => { const el = g.elements[k]; if (el && el.type !== 'checkbox') el.value = v; }); if (f) g.enabled.checked = keep.enabled === 'on'; };
A.rpMileAdd = () => { $('#rpf')._readMiles(); rfDraft.milestones.push({ title: '', desc: '', count: (rfDraft.milestones.slice(-1)[0] || { count: 0 }).count * 1 + 3 || 3, image: '' }); rpRedraw(); };
A.rpMileRm = (d) => { $('#rpf')._readMiles(); rfDraft.milestones.splice(Number(d.i), 1); rpRedraw(); };
A.rpMileImg = async (d) => { const url = await pickImage(); if (!url) return; $('#rpf')._readMiles(); rfDraft.milestones[d.i].image = url; rpRedraw(); };
A.rpHeroImg = async () => { const url = await pickImage(); if (!url) return; $('#rpf')._readMiles(); rfDraft.heroImage = url; rpRedraw(); };
A.rpHeroRm = () => { $('#rpf')._readMiles(); rfDraft.heroImage = ''; rpRedraw(); };
const RF_STATUS = { invited: ['Invited', ''], 'signed up': ['Signed up', 'q-sent'], subscribed: ['Subscribed', 'active'] };
function referralActivityView(box) {
  const W = RF.rewards; const L = RF.referrals;
  box.innerHTML = `<div class="card" style="max-width:960px"><h2>Rewards to send</h2>${W.length ? `<div class="tablewrap"><table class="acc"><thead><tr><th>Business</th><th>Reward</th><th>Reached</th><th>Status</th><th></th></tr></thead><tbody>
${W.map((w) => `<tr><td class="nm">${esc(w.business)}</td><td>${esc(w.title)}<div class="sm">${w.count} paying referral${w.count === 1 ? '' : 's'}</div></td><td class="sm">${fmtDate(w.at)}</td><td><span class="cstatus ${w.status === 'sent' ? 'active' : 'q-sent'}">${w.status === 'sent' ? `Sent ${fmtDate(w.sentAt)}` : 'To send'}</span></td>
<td><div class="acts"><button type="button" class="btn alt sm" data-act="rwMark" data-id="${w.id}" data-s="${w.status === 'sent' ? 'to send' : 'sent'}">${w.status === 'sent' ? 'Mark not sent' : 'Mark sent'}</button></div></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Nobody has reached a milestone yet.</p>'}</div>
${RF.leaders.length ? `<div class="card" style="max-width:960px"><h2>Credit earned</h2><div class="tablewrap"><table class="acc"><thead><tr><th>Business</th><th>Months earned</th><th>Months remaining</th></tr></thead><tbody>${RF.leaders.sort((a, b) => b.earned - a.earned).map((x) => `<tr><td class="nm">${esc(x.name)}</td><td>${x.earned}</td><td>${x.remaining}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
<div class="card" style="max-width:960px"><h2>All referrals</h2>${L.length ? `<div class="tablewrap"><table class="acc"><thead><tr><th>Referred by</th><th>Friend</th><th>Date</th><th>Status</th></tr></thead><tbody>
${L.map((r) => `<tr><td class="nm">${esc(r.referrer)}</td><td>${esc(r.name || '—')}${r.company ? ` · ${esc(r.company)}` : ''}<div class="sm">${esc(r.email)}${r.via === 'link' ? ' · used the link' : ''}</div></td><td class="sm">${fmtDate(r.invitedAt || r.signedUpAt)}</td>
<td><span class="cstatus ${RF_STATUS[r.status][1]}">${RF_STATUS[r.status][0]}</span>${r.status === 'subscribed' && r.creditMonths ? `<div class="sm">${r.creditMonths} month${r.creditMonths === 1 ? '' : 's'} credited${r.credit === 'banked' ? ' (waiting for a subscription)' : ''}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No referrals yet. Turn the program on in Referral program.</p>'}</div>`;
}
A.rwMark = async (d) => { RF = await api('POST', `/api/platform/referrals/rewards/${d.id}`, { status: d.s }); toast(d.s === 'sent' ? 'Marked as sent' : 'Marked as not sent'); promoView($('#main')); };
/* ===== the Founding Supporters list: a thank-you page at /supporters, and codes for prepaid months by email (lib/supporters.js) ===== */
// Select a supporter's row to edit them, email their code or remove them.
const spCodeState = (p) => { const c = p.code;
  if (c && c.redeemedAt) return `<span class="cstatus active">Redeemed</span> by ${esc(c.tenantName)} on ${fmtDate(c.redeemedAt)} · prepaid until ${fmtDate(c.until)}`;
  if (!p.reward) return 'No code: this tier doesn’t include a plan.';
  if (!p.email) return `Worth ${esc(p.reward)}. Add their email to send it.`;
  if (c && c.sentAt) return `${c.simulated ? 'Made, but not delivered (email isn’t set up)' : `Emailed ${fmtDate(c.sentAt)}`}${c.sentTo !== p.email ? ` to ${esc(c.sentTo)}` : ''} · worth ${esc(p.reward)}`;
  return `Not sent yet · worth ${esc(p.reward)}`; };
function supportersView(box) {
  const tierOpts = (cur) => ['', ...SP.tiers].map((t) => `<option value="${esc(t)}" ${t === (cur || '') ? 'selected' : ''}>${t ? esc(t) : 'No tier'}${SP.rewards[t] ? ` · ${esc(SP.rewards[t])}` : ''}</option>`).join('');
  const L = [...SP.people].sort((a, b) => (SP.tiers.indexOf(a.tier) + 1 || 99) - (SP.tiers.indexOf(b.tier) + 1 || 99) || a.name.localeCompare(b.name));
  const due = L.filter((p) => p.reward && p.email && !(p.code && p.code.sentAt)).length;
  box.innerHTML = `<div class="set-pair sp-top"><form id="spf" class="card"><h2>Public page</h2>
<label class="switchline"><input type="checkbox" name="enabled" ${SP.enabled ? 'checked' : ''}> <span><strong>Page on.</strong> Shows the list at <a href="/supporters" target="_blank" rel="noopener">/supporters</a>, with a link in the site’s footer. It stays hidden until it has at least one name.</span></label>
<label style="margin-top:12px">Title<input name="title" value="${esc(SP.title)}" maxlength="80" required></label>
<label>Introduction<textarea name="intro" rows="2" maxlength="400">${esc(SP.intro)}</textarea></label>
<p class="muted" style="font-size:12px;margin:-6px 0 0"><code>{product}</code> becomes the product name.</p>
<div class="savebar"><span class="muted">${SP.people.length} name${SP.people.length === 1 ? '' : 's'} on the list</span><button class="btn">Save page</button></div></form>
<form id="spAdd" class="card"><h2>Add supporters</h2>
<label>One supporter per line: a name, and their email if you have it<textarea name="names" rows="4" placeholder="Jordan Lee, jordan@example.com&#10;Acme Lawn Care, office@acmelawn.com"></textarea></label>
<p class="muted" style="font-size:12px;margin:-6px 0 12px">Paste from your Kickstarter backer survey: “Name, email”, “Name &lt;email&gt;” and spreadsheet columns all work. Anyone already on the list is skipped. Only the names show on the page.</p>
<div class="sp-addrow"><label>Reward tier<select name="tier">${tierOpts('Supporter')}</select></label><button class="btn">Add to the list</button></div></form></div>
<div class="card sp-list"><div class="bill-h"><h2>On the list</h2>${due ? `<button type="button" class="btn sm" data-act="spSendNew">Email codes to ${due} new supporter${due === 1 ? '' : 's'}</button>` : ''}</div>
<p class="muted" style="font-size:13px;margin:0 0 10px">Select a supporter to edit them, email their code or remove them. Each code works once, for a new account (at sign-up) or an existing one (Account and Billing), and is worth its tier’s plan for the months shown. Edit the email in Messages → Email templates → Founding Supporter code.</p>
${L.length ? `<div class="tablewrap"><table class="acc sp-table"><thead><tr><th>Name</th><th>Tier</th><th>Added</th></tr></thead><tbody>
${L.map((p) => `<tr data-id="${p.id}" tabindex="0" aria-label="Edit ${esc(p.name)}"><td class="nm">${esc(p.name)}<div class="sm">${p.email ? esc(p.email) : '<span class="muted">No email</span>'}</div></td>
<td><select class="sp-tier" data-id="${p.id}" aria-label="Tier for ${esc(p.name)}" ${p.code && p.code.redeemedAt ? 'disabled title="Their code is redeemed, so the tier is set"' : ''}>${tierOpts(p.tier)}</select></td><td class="sm">${fmtDate(p.addedAt)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No names yet. Add them above.</p>'}</div>`;
  $('#spf', box).addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const b = Object.fromEntries(new FormData(f)); b.enabled = !!f.enabled.checked;
    try { SP = await api('PUT', '/api/platform/supporters', b); toast(SP.enabled ? (SP.people.length ? 'Saved. The page is on' : 'Saved. The page shows once it has a name') : 'Saved (page off)'); supportersView(box); } catch (x) { toast(x.message, true); }
  });
  $('#spAdd', box).addEventListener('submit', async (e) => {
    e.preventDefault();
    try { SP = await api('POST', '/api/platform/supporters/people', Object.fromEntries(new FormData(e.target))); toast(`Added ${SP.added}${SP.skipped ? `, skipped ${SP.skipped} already on the list` : ''}`); supportersView(box); } catch (x) { toast(x.message, true); }
  });
  $$('.sp-tier', box).forEach((sel) => sel.addEventListener('change', async () => {
    try { SP = await api('PUT', '/api/platform/supporters/people/' + sel.dataset.id, { tier: sel.value }); toast('Tier changed'); supportersView(box); } catch (x) { toast(x.message, true); supportersView(box); }
  }));
  // select a row (click, tap, or Enter/Space) to open it; the tier menu still works on its own
  $$('.sp-table tbody tr[data-id]', box).forEach((tr) => {
    tr.addEventListener('click', (e) => { if (!e.target.closest('a,button,select')) A.spOpen({ id: tr.dataset.id }); });
    tr.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === tr) { e.preventDefault(); A.spOpen({ id: tr.dataset.id }); } });
  });
}
const spRedraw = () => supportersView($('#promoBody'));
// one supporter: name, email and tier to edit, their code to email, and Remove
A.spOpen = (d) => {
  const p = SP.people.find((x) => x.id === d.id); if (!p) return; const redeemed = !!(p.code && p.code.redeemedAt);
  const tierOpts = ['', ...SP.tiers].map((t) => `<option value="${esc(t)}" ${t === (p.tier || '') ? 'selected' : ''}>${t ? esc(t) : 'No tier'}${SP.rewards[t] ? ` · ${esc(SP.rewards[t])}` : ''}</option>`).join('');
  const sendBtn = p.reward && p.email && !redeemed ? `<button type="button" class="btn ${p.code && p.code.sentAt ? 'alt ' : ''}sm" data-act="spSend" data-id="${p.id}">${p.code && p.code.sentAt ? 'Resend code' : 'Email code'}</button>` : '';
  const m = modal(p.name, `<form id="spe"><div class="row"><label>Name on the page<input name="name" value="${esc(p.name)}" maxlength="80" required></label>
<label>Email<input name="email" type="email" value="${esc(p.email || '')}" maxlength="200"></label></div>
<p class="muted" style="font-size:12px;margin:-6px 0 10px">The email is only used to send their code. It’s never shown on the page.</p>
<label>Reward tier<select name="tier" ${redeemed ? 'disabled' : ''}>${tierOpts}</select></label>${redeemed ? '<p class="muted" style="font-size:12px;margin:-6px 0 10px">Their code is redeemed, so the tier is set.</p>' : ''}
<div class="sp-code"><div class="sp-code-h"><strong>Supporter code</strong>${p.code ? ` <code>${esc(p.code.code)}</code>` : ''}</div><p class="sm muted" style="margin:4px 0 0">${spCodeState(p)}</p>${sendBtn ? `<div class="acts sp-code-acts">${sendBtn}</div>` : ''}</div>
<p class="sm muted" style="margin:10px 0 0">Added ${fmtDate(p.addedAt)}</p>
<div class="foot"><button type="button" class="btn danger" data-act="spRm" data-id="${p.id}" style="margin-right:auto">Remove</button><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  m.tabIndex = -1; m.focus(); // the popup itself, not its first field
  $('#spe', m).addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); if (redeemed) delete b.tier;
    try { SP = await api('PUT', '/api/platform/supporters/people/' + p.id, b); closeModal(); toast('Saved'); spRedraw(); } catch (x) { toast(x.message, true); }
  });
};
A.spSend = async (d, el) => {
  const p = SP.people.find((x) => x.id === d.id); if (p.code && p.code.sentAt && !confirm(`Email ${p.name} their code again at ${p.email}? It’s the same code.`)) return;
  if (el) el.disabled = true;
  try { const r = await api('POST', `/api/platform/supporters/people/${d.id}/send`); SP = r; toast(r.simulated ? 'Code made, but not delivered: set up email in Integrations first' : `Code emailed to ${r.emailed}`, r.simulated); }
  catch (x) { toast(x.message, true); }
  spRedraw(); if ($('#spe')) A.spOpen({ id: d.id }); // the open popup shows the new state
};
A.spSendNew = async (d, el) => {
  const n = SP.people.filter((p) => p.reward && p.email && !(p.code && p.code.sentAt)).length;
  if (!confirm(`Email a code to ${n} supporter${n === 1 ? '' : 's'} who haven’t had one yet?`)) return;
  if (el) { el.disabled = true; el.textContent = 'Sending…'; }
  try { const r = await api('POST', '/api/platform/supporters/send-new'); SP = r; toast(`Emailed ${r.sent} code${r.sent === 1 ? '' : 's'}${r.failed.length ? `. ${r.failed.length} failed: ${r.failed.slice(0, 2).join('; ')}` : ''}`, !!r.failed.length); }
  catch (x) { toast(x.message, true); }
  spRedraw();
};
A.spRm = async (d) => {
  const p = SP.people.find((x) => x.id === d.id); if (!p) return;
  const note = p.code && !p.code.redeemedAt ? ' Their code stops working.' : p.code && p.code.redeemedAt ? ' Their redeemed prepaid months stay on their account.' : '';
  if (!confirm(`Remove ${p.name} from the Founding Supporters list?${note}`)) return;
  try { SP = await api('DELETE', '/api/platform/supporters/people/' + d.id); closeModal(); toast('Removed'); spRedraw(); } catch (x) { toast(x.message, true); }
};
/* ===== discounts: codes for sign-ups, each with its rules (lib/discounts.js) ===== */
const DISC_CHIP = { active: 'active', scheduled: 'q-sent', paused: '', expired: '', 'used up': '' };
const codeLink = (code) => `${location.origin}/pricing?code=${encodeURIComponent(code)}`;
function discountsView(main) {
  const L = D.discounts || [];
  main.innerHTML = `<div class="promo-bar"><p class="muted">Codes people enter when they sign up for a paid plan, on the pricing page or at checkout.</p><button class="btn" data-act="discEdit">New discount code</button></div>
${L.length ? `<div class="card"><div class="tablewrap"><table class="acc"><thead><tr><th>Code</th><th>Discount</th><th>Rules</th><th>Used</th><th>Status</th><th></th></tr></thead><tbody>
${L.map((d) => `<tr><td><div class="nm disc-code">${esc(d.code)}</div>${d.note ? `<div class="sm">${esc(d.note)}</div>` : ''}</td><td>${esc(d.summary)}</td><td class="sm">${d.rules.map(esc).join(' · ')}</td>
<td class="sm">${d.uses.length}${d.maxUses ? ` of ${d.maxUses}` : ''} used</td><td><span class="cstatus ${DISC_CHIP[d.status]}">${d.status[0].toUpperCase() + d.status.slice(1)}</span></td>
<td><div class="acts"><button type="button" class="btn alt sm" data-act="discLink" data-code="${esc(d.code)}">Copy link</button><button type="button" class="btn alt sm" data-act="discToggle" data-id="${d.id}">${d.active ? 'Pause' : 'Resume'}</button><button type="button" class="btn alt sm" data-act="discEdit" data-id="${d.id}">Edit</button></div></td></tr>`).join('')}
</tbody></table></div></div>` : `<div class="card" style="text-align:center;padding:36px 18px"><h2 style="margin:0 0 6px">No discount codes yet</h2><p class="muted" style="margin:0 0 14px">Create a code like <strong>SPRING20</strong> for 20% off the first 3 months, or a free trial with no card, limited to the plans, dates and number of uses you choose.</p><button class="btn" data-act="discEdit">New discount code</button></div>`}`;
}
A.discLink = (d) => navigator.clipboard.writeText(codeLink(d.code)).then(() => toast(`Link copied: people who open it get ${d.code} filled in`), () => toast(codeLink(d.code)));
A.discToggle = async (d) => { const x = D.discounts.find((y) => y.id === d.id); D.discounts = await api('PUT', `/api/platform/discounts/${d.id}`, { active: !x.active }); toast(x.active ? `${x.code} paused` : `${x.code} is active`); render(); };
A.discEdit = (d) => {
  const x = d.id ? D.discounts.find((y) => y.id === d.id) : { code: '', note: '', active: true, type: 'percent', value: 20, duration: 'repeating', months: 3, plans: [], interval: 'any', startsAt: '', endsAt: '', maxUses: 0, onePerEmail: true, uses: [] };
  const used = (x.uses || []).length; const lock = used ? 'disabled title="This code has been used, so its discount can’t change"' : '';
  const paid = D.plans.filter((p) => p.monthly || p.yearly);
  const m = modal(d.id ? `Edit ${x.code}` : 'New discount code', `<form id="df">
<div class="row"><label>Code<input name="code" value="${esc(x.code)}" required maxlength="30" placeholder="e.g. SPRING20" autocapitalize="characters" spellcheck="false" style="text-transform:uppercase" ${lock}></label><label>Note for you (optional)<input name="note" value="${esc(x.note)}" maxlength="200" placeholder="e.g. Trade show, April"></label></div>
<h3 class="hc-h3">Discount</h3>${used ? '<p class="muted" style="font-size:13px;margin:-4px 0 8px">This code has been used, so its code and discount are locked: businesses already pay with them. You can still change its rules, or pause it and create a new code.</p>' : ''}
<div class="row"><label>Type<select name="type" ${lock}><option value="percent" ${x.type === 'percent' ? 'selected' : ''}>Percentage off</option><option value="amount" ${x.type === 'amount' ? 'selected' : ''}>Dollar amount off</option><option value="trial" ${x.type === 'trial' ? 'selected' : ''}>Free trial, no card</option></select></label><label id="daysRow" ${x.type === 'trial' ? '' : 'hidden'}>Trial length (days)<input name="trialDays" type="number" min="1" max="90" step="1" value="${esc(x.trialDays || 30)}" ${lock}></label><label class="disc-off" ${x.type === 'trial' ? 'hidden' : ''}><span id="valLbl">${x.type === 'amount' ? 'Amount off ($)' : 'Percent off (%)'}</span><input name="value" type="number" min="0.01" step="0.01" value="${esc(x.value || 20)}" required ${lock}></label></div>
<p class="muted disc-trial" style="font-size:12px;margin:-4px 0 8px" ${x.type === 'trial' ? '' : 'hidden'}>People who sign up with this code skip checkout: their account opens with no card and is paused after the trial. They can add a card (first payment when the trial ends), change plan or cancel in Account and billing.</p>
<div class="row disc-off" ${x.type === 'trial' ? 'hidden' : ''}><label>How long<select name="duration" ${lock}><option value="once" ${x.duration === 'once' ? 'selected' : ''}>The first payment only</option><option value="repeating" ${x.duration === 'repeating' ? 'selected' : ''}>A number of months</option><option value="forever" ${x.duration === 'forever' ? 'selected' : ''}>Every payment, for good</option></select></label><label id="monthsRow" ${x.duration === 'repeating' ? '' : 'hidden'}>Months<input name="months" type="number" min="1" max="36" value="${esc(x.months || 3)}" ${lock}></label></div>
<p class="muted disc-off" style="font-size:12px;margin:-4px 0 8px" ${x.type === 'trial' ? 'hidden' : ''}>On yearly billing, a discount for a number of months applies to the first year’s payment.</p>
<h3 class="hc-h3">Rules</h3>
<div class="disc-plans"><span class="muted" style="font-size:13px">Plans (none ticked = every paid plan)</span>${paid.map((p) => `<label class="switchline" style="margin:4px 0"><input type="checkbox" name="plans" value="${esc(p.id)}" ${(x.plans || []).includes(p.id) ? 'checked' : ''}> ${esc(p.name)}${p.hidden ? ' <span class="pf-chip">Hidden</span>' : ''}</label>`).join('')}</div>
<div class="row"><label>Billing<select name="interval"><option value="any" ${x.interval === 'any' ? 'selected' : ''}>Monthly or yearly</option><option value="month" ${x.interval === 'month' ? 'selected' : ''}>Monthly only</option><option value="year" ${x.interval === 'year' ? 'selected' : ''}>Yearly only</option></select></label><label>Total uses allowed (0 = no limit)<input name="maxUses" type="number" min="0" step="1" value="${esc(x.maxUses || 0)}"></label></div>
<div class="row"><label>Starts (optional)<input name="startsAt" type="date" value="${esc(x.startsAt)}"></label><label>Ends after (optional)<input name="endsAt" type="date" value="${esc(x.endsAt)}"></label></div>
<label class="switchline"><input type="checkbox" name="onePerEmail" ${x.onePerEmail ? 'checked' : ''}> Once per email address</label>
<label class="switchline"><input type="checkbox" name="active" ${x.active ? 'checked' : ''}> Active (people can use it now)</label>
${used ? `<h3 class="hc-h3">Used ${used} time${used === 1 ? '' : 's'}</h3><div class="tablewrap" style="max-height:180px;overflow:auto"><table class="acc">${x.uses.slice().reverse().map((u) => `<tr><td class="nm">${esc(u.business)}</td><td class="sm">${esc(u.email)}</td><td class="sm">${fmtDate(u.at)}</td></tr>`).join('')}</table></div>` : ''}
<div class="foot">${d.id ? '<button type="button" class="btn danger" data-act="discDelete" style="margin-right:auto">Delete</button>' : ''}<button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">${d.id ? 'Save' : 'Create code'}</button></div></form>`, { wide: true });
  const f = $('#df', m); m.discId = d.id || '';
  $('[name=type]', f).addEventListener('change', (e) => { const trial = e.target.value === 'trial'; $('#valLbl', f).textContent = e.target.value === 'amount' ? 'Amount off ($)' : 'Percent off (%)';
    $('#daysRow', f).hidden = !trial; f.querySelectorAll('.disc-off').forEach((el) => { el.hidden = trial; }); $('.disc-trial', f).hidden = !trial; $('[name=value]', f).required = !trial; });
  $('[name=duration]', f).addEventListener('change', (e) => { $('#monthsRow', f).hidden = e.target.value !== 'repeating'; });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = new FormData(f); const b = Object.fromEntries(fd); b.plans = fd.getAll('plans'); b.active = !!fd.get('active'); b.onePerEmail = !!fd.get('onePerEmail');
    if (used) { delete b.code; delete b.type; delete b.value; delete b.duration; delete b.months; delete b.trialDays; }
    try { D.discounts = await api(d.id ? 'PUT' : 'POST', d.id ? `/api/platform/discounts/${d.id}` : '/api/platform/discounts', b); closeModal(); toast(d.id ? 'Discount saved' : `${String(b.code).toUpperCase()} created`); render(); } catch (x2) { toast(x2.message, true); }
  });
};
A.discDelete = async (d, el) => {
  const id = el.closest('.pf-modal').discId; const x = D.discounts.find((y) => y.id === id);
  if (!confirm(`Delete ${x.code}?${x.uses.length ? ' Businesses that already used it keep their discount in Stripe.' : ''} People can no longer use it.`)) return;
  D.discounts = await api('DELETE', `/api/platform/discounts/${id}`); closeModal(); toast(`${x.code} deleted`); render();
};
/* ===== Pricing, Messages and Help Center: their sections down the left like Settings (a dropdown on phones) ===== */
// items: [key, label, count, on, count's title]; a count of 0 stays in the page, hidden, so it can update live
const sideNav = (label, act, items) => `<label class="set-pick"><span class="sr">${label} section</span><select data-side-act="${act}">${items.map(([k, l, n, on]) => `<option value="${k}" ${on ? 'selected' : ''}>${esc(l)}${n ? ` (${n})` : ''}</option>`).join('')}</select></label>
<nav class="set-nav side-src" aria-label="${label}">${items.map(([k, l, n, on, title]) => `<button type="button" class="${on ? 'on' : ''}" ${on ? 'aria-current="page"' : ''} data-act="${act}" data-k="${k}">${l}${n === undefined ? '' : ` <span class="msg-n"${title ? ` title="${title}"` : ''}${n ? '' : ' hidden'}>${n}</span>`}</button>`).join('')}</nav>`;
// after rendering: the list goes in the left column and everything after it in the column beside it
function sideLayout(main) {
  const nav = $('.side-src', main); if (!nav) return;
  const wrap = document.createElement('div'); wrap.className = 'set-layout'; const col = document.createElement('div'); col.className = 'set-one';
  nav.after(wrap); while (wrap.nextSibling) col.appendChild(wrap.nextSibling); wrap.append(nav, col);
  const pick = $('.set-pick select', main); pick.addEventListener('change', (e) => A[pick.dataset.sideAct]({ k: e.target.value }));
}
/* ===== messages: contact requests, user feedback and the platform's email templates ===== */
let msgTab = 'chat';
function messagesView(main) {
  const subs = [['chat', 'Live chat', D.chatWaiting || 0], ['inquiries', 'Contact requests', (D.inquiries || []).length], ['feedback', 'User feedback', (D.feedback || []).length], ['apps', 'App requests'], ['emails', 'Email templates'], ...(isSupport() ? [] : [['automations', 'Automations']])];
  main.innerHTML = `<div class="head"><div><h1>Messages</h1><p class="sub" style="margin:4px 0 0">What people send you, and the emails ${esc(D.settings.productName)} sends.</p></div></div>
${sideNav('Messages', 'msgTab', subs.map(([k, l, n]) => [k, l, k === 'chat' ? n : n || undefined, msgTab === k]))}
${msgTab === 'automations' ? '<div id="automations"></div>' : `<div class="card" style="max-width:${msgTab === 'chat' ? 'none' : '860px'}" id="${msgTab}"></div>`}`;
  sideLayout(main);
  ({ chat: chatCard, inquiries: inquiriesCard, feedback: feedbackCard, apps: appRequestsCard, emails: emailsCard, automations: automationsView })[msgTab]($('#' + msgTab, main));
}
A.msgTab = (d) => { msgTab = d.k; messagesView($('#main')); };
/* ===== Messages → Live chat (lib/chat.js): chats from the chat button; the open chat refreshes every few seconds ===== */
let LC = null; let lcSel = ''; let lcTimer = null; let lcShown = '';
const LC_TZ = [['America/New_York', 'Eastern'], ['America/Chicago', 'Central'], ['America/Denver', 'Mountain'], ['America/Phoenix', 'Arizona'], ['America/Los_Angeles', 'Pacific'], ['America/Anchorage', 'Alaska'], ['Pacific/Honolulu', 'Hawaii']];
const LC_WHERE = { site: 'Website', help: 'Help Center', app: 'In the app' };
const LC_ST = { waiting: ['Waiting', 'q-sent'], live: ['Live', 'active'], bot: ['With the bot', ''], closed: ['Ended', ''] };
const lcAgo = (s) => { const m = Math.round((Date.now() - new Date(s)) / 60000); return m < 1 ? 'now' : m < 60 ? m + 'm' : m < 1440 ? Math.round(m / 60) + 'h' : new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
const lcLink = (t) => esc(t).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)'"]/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`).replace(/\n/g, '<br>');
function chatCard(box) {
  box.innerHTML = `<div class="lc-head"><h2>Live chat</h2><div class="acts">${POPOUT ? `<button type="button" class="btn alt sm" data-act="lcNotify" id="lcNotify" ${'Notification' in window && Notification.permission === 'default' ? '' : 'hidden'}>Turn on alerts</button>` : '<button type="button" class="btn alt sm" data-act="lcPopout" title="Open Live chat in its own window">Pop out ↗</button>'}<button type="button" class="btn alt sm" data-act="lcSettings">Chat settings</button></div></div>
${LC && !LC.settings.on ? '<div class="note">The chat button is off. Turn it on in <strong>Chat settings</strong> to show it on your site, help center and in the app.</div>' : ''}
${LC && LC.settings.on && LC.settings.hours.on && !LC.inHours ? `<div class="note">It’s outside your business hours (${esc(LC.hoursText)}), so people see your “no one is available” message and can leave one.</div>` : ''}
<div class="lc"><div class="lc-list" id="lcList"><p class="muted">Loading…</p></div><div class="lc-conv" id="lcConv"><p class="muted lc-empty">Choose a chat to read it and reply.</p></div></div>`;
  lcLoad(); clearInterval(lcTimer);
  lcTimer = setInterval(() => { if (tab !== 'messages' || msgTab !== 'chat' || !$('#lcList')) { clearInterval(lcTimer); return; } lcLoad(); }, 4000);
}
async function lcLoad() {
  try { LC = await api('GET', '/api/platform/chats'); } catch (x) { return; }
  lcAlert(LC.chats); const L = $('#lcList'); if (!L) return;
  const waiting = LC.chats.filter((c) => c.status === 'waiting' || (c.status === 'live' && c.unread)).length;
  if (D.chatWaiting !== waiting) { D.chatWaiting = waiting; const n = $('.side-src [data-k=chat] .msg-n'); if (n) { n.textContent = waiting; n.hidden = !waiting; } }
  L.innerHTML = LC.chats.length ? LC.chats.map((c) => `<button type="button" class="lc-row ${c.id === lcSel ? 'on' : ''} ${c.unread ? 'new' : ''}" data-act="lcOpen" data-id="${c.id}">
<span class="lc-r1"><strong>${esc(c.name || 'Visitor')}</strong><span class="sm">${lcAgo(c.updatedAt)}</span></span>
<span class="lc-r2 sm">${c.business ? esc(c.business) : LC_WHERE[c.where]}${c.visitorOnline && c.status !== 'closed' ? ' · <span class="lc-on">online</span>' : ''}</span>
<span class="lc-r3">${LC_ST[c.status][1] || c.status === 'bot' ? `<span class="cstatus ${LC_ST[c.status][1]}">${LC_ST[c.status][0]}</span>` : ''}<span class="sm">${c.last ? esc((c.last.from === 'agent' ? 'You: ' : c.last.from === 'bot' ? 'Bot: ' : '') + c.last.text) : ''}</span>${c.unread ? `<b class="msg-n">${c.unread}</b>` : ''}</span></button>`).join('')
    : `<p class="muted" style="padding:12px">No chats yet.${LC.settings.on ? ' They’ll show up here as people use the chat button.' : ''}</p>`;
  if (lcSel) lcConv();
}
A.lcOpen = (d) => { lcSel = d.id; lcShown = ''; $$('.lc-row').forEach((r) => r.classList.toggle('on', r.dataset.id === d.id)); $('.lc').classList.add('open'); lcConv(); };
A.lcPopout = () => {
  const w = window.open('/alpha?popout=chat', 'worklio-live-chat', 'popup,width=1040,height=760');
  if (!w) location.href = '/alpha?popout=chat'; else w.focus(); // pop-ups blocked: open it here instead
};
A.lcNotify = async () => { const p = await Notification.requestPermission(); $('#lcNotify').hidden = true; if (p === 'granted') toast('You’ll get an alert when someone wants to talk to a person'); };
// the pop-out window: the number waiting in its title, and an alert (if allowed) when someone new asks for a person
let lcKnown = null;
function lcAlert(chats) {
  const waiting = chats.filter((c) => c.status === 'waiting'); const n = chats.filter((c) => c.status === 'waiting' || (c.status === 'live' && c.unread)).length;
  if (POPOUT) document.title = `${n ? `(${n}) ` : ''}Live chat · ${D.settings.productName} Alpha`;
  const fresh = lcKnown ? waiting.filter((c) => !lcKnown.has(c.id)) : []; lcKnown = new Set(waiting.map((c) => c.id));
  if (fresh.length && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const c = fresh[0]; const note = new Notification(`${c.name || 'A visitor'} wants to talk to a person`, { body: c.last ? c.last.text : '', tag: 'chat-' + c.id });
    note.onclick = () => { window.focus(); A.lcOpen({ id: c.id }); note.close(); };
  }
}
A.lcBack = () => { lcSel = ''; $('.lc').classList.remove('open'); };
async function lcConv() {
  let c; try { c = await api('GET', '/api/platform/chats/' + lcSel); } catch (x) { lcSel = ''; $('#lcConv').innerHTML = `<p class="muted lc-empty">${esc(x.message)}</p>`; return; }
  const box = $('#lcConv'); if (!box || c.id !== lcSel) return;
  const sig = c.id + c.messages.length + c.status;
  if (!$('.lc-msgs', box) || !lcShown.startsWith(c.id)) {
    box.innerHTML = `<div class="lc-ch"><button type="button" class="lc-back" data-act="lcBack" aria-label="Back to chats">‹</button><div><strong>${esc(c.name || 'Visitor')}</strong><div class="sm" id="lcMeta"></div></div><div class="acts"><span id="lcSt"></span><button type="button" class="btn alt sm" data-act="lcClose" id="lcEnd">End chat</button><button type="button" class="btn danger sm" data-act="lcDel">Delete</button></div></div>
<div class="lc-msgs"></div><form class="lc-reply" id="lcForm"><button type="button" class="btn alt lc-att" data-act="lcAttach" title="Send a file (up to 10 MB)" aria-label="Send a file">📎</button><input type="file" id="lcFile" multiple hidden accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"><textarea name="text" rows="2" placeholder="Write a reply… (Enter sends, Shift+Enter for a new line)" maxlength="4000"></textarea><button class="btn">Send</button></form>`;
    const f = $('#lcForm'); const ta = f.text;
    $('#lcFile').addEventListener('change', async (e) => {
      const files = [...e.target.files].slice(0, 3); e.target.value = '';
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) { toast(`${file.name} is over 10 MB`, true); continue; }
        try {
          const r = await fetch(`/api/platform/chats/${lcSel}/files?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
          const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'The file couldn’t be sent');
        } catch (x) { toast(x.message, true); }
      }
      lcShown = ''; lcLoad();
    });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit(); } });
    f.addEventListener('submit', async (e) => {
      e.preventDefault(); const text = ta.value.trim(); if (!text) return; const btn = $('button', f); btn.disabled = true;
      try { await api('POST', `/api/platform/chats/${lcSel}/reply`, { text }); ta.value = ''; lcShown = ''; lcLoad(); } catch (x) { toast(x.message, true); } btn.disabled = false; ta.focus();
    });
  }
  $('#lcMeta').innerHTML = [c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : 'No email', c.business || LC_WHERE[c.where], c.page ? `<a href="${esc(c.page)}" target="_blank" rel="noopener">page</a>` : '', c.visitorOnline ? '<span class="lc-on">online now</span>' : ''].filter(Boolean).join(' · ');
  $('#lcSt').innerHTML = `<span class="cstatus ${LC_ST[c.status][1]}">${LC_ST[c.status][0]}</span>`; $('#lcEnd').hidden = c.status === 'closed';
  if (lcShown === sig) return; lcShown = sig;
  const m = $('.lc-msgs', box);
  m.innerHTML = c.messages.map((x) => x.from === 'system' ? `<div class="lc-sys">${esc(x.text)}</div>`
    : `<div class="lc-m ${x.from}"><span class="lc-who">${x.from === 'visitor' ? esc(c.name || 'Visitor') : x.from === 'bot' ? 'Bot' : esc(x.agent || 'You')} · ${new Date(x.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>${x.file ? lcFile(c.id, x.file) : lcLink(x.text)}${x.links ? `<ul>${x.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a></li>`).join('')}</ul>` : ''}</div>`).join('');
  m.scrollTop = m.scrollHeight; m.querySelectorAll('img').forEach((i) => i.addEventListener('load', () => { m.scrollTop = m.scrollHeight; }, { once: true })); // pictures load after the scroll
}
A.lcAttach = () => $('#lcFile').click();
const lcSize = (n) => (n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB');
function lcFile(cid, f) {
  const url = `/api/platform/chats/${cid}/files/${f.id}`;
  if (f.deleted) return `<div class="lc-fgone">📎 ${esc(f.name)} (deleted after the time set in Chat settings)</div>`;
  if (f.image) return `<a href="${url}" target="_blank" rel="noopener"><img class="lc-fimg" src="${url}" alt="${esc(f.name)}" loading="lazy"></a><a class="lc-fdl" href="${url}?download" download="${esc(f.name)}">Download ${esc(f.name)} (${lcSize(f.size)})</a>`;
  return `<a class="lc-fcard" href="${url}?download" download="${esc(f.name)}"><i>${esc(f.name.split('.').pop().toUpperCase().slice(0, 4))}</i><span><b>${esc(f.name)}</b><small>${lcSize(f.size)} · Download</small></span></a>`;
}
A.lcClose = async () => { await api('POST', `/api/platform/chats/${lcSel}/close`); lcShown = ''; toast('Chat ended'); lcLoad(); };
A.lcDel = async () => { if (!confirm('Delete this chat? This can’t be undone.')) return; await api('DELETE', '/api/platform/chats/' + lcSel); lcSel = ''; chatCard($('#chat')); toast('Chat deleted'); };
A.lcSettings = () => {
  const s = LC.settings; const ans = (x = {}) => `<div class="lc-ans"><div class="row"><label>Question (shown as a button)<input name="q" value="${esc(x.q || '')}" maxlength="120" placeholder="How much does it cost?"></label><label>Also answers when the message has<input name="keywords" value="${esc(x.keywords || '')}" maxlength="300" placeholder="price, cost, plans"></label></div>
<label>Answer<textarea name="a" rows="2" maxlength="1500" placeholder="Use {site} for your site address and {product} for the product name">${esc(x.a || '')}</textarea></label><button type="button" class="link-btn" data-act="lcAnsRm">Remove</button></div>`;
  const m = modal('Chat settings', `<form id="lcsf"><label class="switchline"><input type="checkbox" name="on" ${s.on ? 'checked' : ''}> Show the chat button</label>
<p class="muted" style="font-size:13px;margin:4px 0 6px">Show it on:</p><div class="lc-where">${Object.entries(LC_WHERE).map(([k, l]) => `<label class="switchline"><input type="checkbox" name="where" value="${k}" ${s.where.includes(k) ? 'checked' : ''}> ${k === 'site' ? 'Your website (home and pricing pages)' : k === 'help' ? 'The help center' : 'Inside the business app'}</label>`).join('')}</div>
<label>Greeting<textarea name="greeting" rows="2" maxlength="500">${esc(s.greeting)}</textarea></label>
<h3 style="margin:8px 0 4px;font-size:15px">When no one is available</h3>
<p class="muted" style="font-size:13px;margin:0 0 8px">No one is available when Live chat isn’t open in Alpha (here or in the pop-out window), or it’s outside the business hours below. People then see this message and can leave one with their email; you get an email${D.settings.contactEmail ? ` at ${esc(D.settings.contactEmail)}` : ' (add a contact email in Settings)'}.</p>
<label>Message<textarea name="offline" rows="3" maxlength="500">${esc(s.offline)}</textarea></label>
<p class="muted" style="font-size:13px;margin:-4px 0 10px"><code>{hours}</code> shows your business hours, e.g. “(Mon–Fri, 9 AM–5 PM CDT)”.</p>
<label>Contact form link<input name="contactUrl" value="${esc(s.contactUrl || '')}" maxlength="300" placeholder="{site}/pricing#contact" spellcheck="false"></label>
<p class="muted" style="font-size:13px;margin:-4px 0 12px">Shown as “Or use our contact form”. <code>{site}/pricing#contact</code> opens the Contact us form on your pricing page. Leave it blank to hide it.</p>
<label class="switchline"><input type="checkbox" name="hoursOn" ${s.hours.on ? 'checked' : ''}> Only chat live during business hours</label>
<div class="lc-hours"><label>Time zone<select name="tz">${LC_TZ.map(([z, l]) => `<option value="${z}" ${s.hours.tz === z ? 'selected' : ''}>${l}</option>`).join('')}${LC_TZ.some(([z]) => z === s.hours.tz) ? '' : `<option value="${esc(s.hours.tz)}" selected>${esc(s.hours.tz)}</option>`}</select></label>
<label>Opens<input type="time" name="open" value="${esc(s.hours.open)}"></label><label>Closes<input type="time" name="close" value="${esc(s.hours.close)}"></label></div>
<div class="lc-days">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => `<label><input type="checkbox" name="day" value="${i}" ${s.hours.days.includes(i) ? 'checked' : ''}> ${d}</label>`).join('')}</div>
<h3 style="margin:8px 0 4px;font-size:15px">Files</h3>
<label class="switchline"><input type="checkbox" name="files" ${s.files !== false ? 'checked' : ''}> Let people attach photos and files (up to 10 MB: photos, PDFs, Word, Excel, CSV, text)</label>
<label style="max-width:320px">Delete files after (days; 0 keeps them)<input type="number" name="fileDays" min="0" max="3650" value="${esc(s.fileDays ?? 90)}"></label>
<p class="muted" style="font-size:13px;margin:-4px 0 12px">Files are stored privately on your server and only the person who sent them and you can open them. Deleting a chat deletes its files.</p>
<label class="switchline"><input type="checkbox" name="ai" ${s.ai && LC.ai ? 'checked' : ''} ${LC.ai ? '' : 'disabled'}> Let AI answer from your help center articles and plans</label>
<p class="muted" style="font-size:13px;margin:0 0 12px">${LC.ai ? 'Saved answers below are used first. AI answers only from your articles, plans and saved answers, and suggests a person when it isn’t sure.' : 'Needs <code>ANTHROPIC_API_KEY</code> (see Integrations → AI). Until then, the bot answers with your saved answers and matching help articles.'}</p>
<h3 style="margin:8px 0 4px;font-size:15px">Saved answers</h3><p class="muted" style="font-size:13px;margin:0 0 8px">The first four questions show as buttons when a chat starts.</p>
<div id="lcAns">${s.answers.map(ans).join('')}</div><button type="button" class="btn alt sm" data-act="lcAnsAdd">Add an answer</button>
<div class="acts" style="margin-top:16px"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`, { wide: true });
  A.lcAnsAdd = () => { $('#lcAns').insertAdjacentHTML('beforeend', ans()); $('#lcAns .lc-ans:last-child input').focus(); };
  A.lcAnsRm = (d, el) => el.closest('.lc-ans').remove();
  $('#lcsf', m).addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    // without an AI key the AI switch is greyed out, so the saved choice is kept
    const b = { on: f.on.checked, ai: LC.ai ? f.ai.checked : LC.settings.ai, where: [...f.querySelectorAll('[name=where]:checked')].map((x) => x.value), greeting: f.greeting.value, offline: f.offline.value, contactUrl: f.contactUrl.value, files: f.files.checked, fileDays: f.fileDays.value,
      hours: { on: f.hoursOn.checked, tz: f.tz.value, open: f.open.value, close: f.close.value, days: [...f.querySelectorAll('[name=day]:checked')].map((x) => +x.value) },
      answers: [...f.querySelectorAll('.lc-ans')].map((r) => ({ q: r.querySelector('[name=q]').value, keywords: r.querySelector('[name=keywords]').value, a: r.querySelector('[name=a]').value })) };
    try { await api('PUT', '/api/platform/chat-settings', b); closeModal(); toast('Chat settings saved'); chatCard($('#chat')); } catch (x) { toast(x.message, true); }
  });
};
// messages from "Contact us" on the pricing page and "Get Support" in the app (also emailed to the contact email)
function inquiriesCard(box) {
  const L = D.inquiries || [];
  box.innerHTML = `<h2>Contact requests</h2><p class="muted" style="font-size:13px;margin-top:0">Messages sent with “Contact us” on the <a href="/pricing" target="_blank" rel="noopener">pricing page</a>, support requests sent with “Get Support” in an account’s help panel, and messages from the help center’s contact form. ${D.settings.contactEmail ? `Each one is also emailed to ${esc(D.settings.contactEmail)}; reply to that email to answer.` : 'Add a contact email in <a href="#settings">Settings</a> to get them by email too.'}</p>
${L.length ? `<div class="inq-list">${L.slice(0, 50).map((m) => `<div class="inq"><div class="inq-h"><div><strong>${esc(m.name)}</strong>${m.company ? ` · ${m.account ? `<a href="${esc(m.account)}" target="_blank" rel="noopener">${esc(m.company)}</a>` : esc(m.company)}` : ''}${m.source === 'support' ? ' <span class="pf-chip">Support</span>' : m.source === 'help' ? ' <span class="pf-chip">Help Center</span>' : ''}${m.plan ? ` <span class="pf-chip">${esc(m.plan)}</span>` : ''}${m.topic ? ` <span class="pf-chip">${esc(m.topic)}</span>` : ''}
<div class="sm"><a href="mailto:${esc(m.email)}">${esc(m.email)}</a>${m.phone ? ` · <a href="tel:${esc(m.phone)}">${esc(m.phone)}</a>` : ''} · ${esc(new Date(m.at).toLocaleString())}${D.settings.contactEmail && m.emailed === false ? ' · <span style="color:var(--danger)">email not delivered</span>' : ''}</div></div>
<button type="button" class="btn alt sm" data-act="rmInquiry" data-id="${esc(m.id)}">Delete</button></div><p class="inq-m">${esc(m.message)}</p>${m.page ? `<div class="sm">Sent from <a href="${esc(m.page)}" target="_blank" rel="noopener">${esc(m.page)}</a></div>` : ''}</div>`).join('')}</div>` : '<p class="muted">No messages yet.</p>'}`;
}
A.rmInquiry = async (d) => { if (!confirm('Delete this message?')) return; D.inquiries = await api('DELETE', `/api/platform/inquiries/${encodeURIComponent(d.id)}`); messagesView($('#main')); toast('Message deleted'); };
// ratings and messages sent with "Feedback" in an account's top bar (also emailed to the contact email)
const FB_FACES = { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😍' };
function feedbackCard(box) {
  const L = D.feedback || []; const rated = L.filter((m) => m.rating); const avg = rated.length ? rated.reduce((s, m) => s + m.rating, 0) / rated.length : 0;
  box.innerHTML = `<h2>User feedback</h2><p class="muted" style="font-size:13px;margin-top:0">Sent with the “Feedback” button in an account’s top bar. ${D.settings.contactEmail ? `Each one is also emailed to ${esc(D.settings.contactEmail)}.` : 'Add a contact email in <a href="#settings">Settings</a> to get them by email too.'}</p>
${rated.length ? `<p class="fb-sum"><strong>${FB_FACES[Math.round(avg)]} ${avg.toFixed(1)} / 5</strong> <span class="muted">average from ${rated.length} rating${rated.length === 1 ? '' : 's'}</span></p>` : ''}
${L.length ? `<div class="inq-list">${L.slice(0, 100).map((m) => `<div class="inq"><div class="inq-h"><div>${m.rating ? `<span title="${m.rating} out of 5">${FB_FACES[m.rating]}</span> ` : ''}<strong>${esc(m.name)}</strong> · ${m.account ? `<a href="${esc(m.account)}" target="_blank" rel="noopener">${esc(m.company)}</a>` : esc(m.company)} <span class="pf-chip">${esc(m.kind)}</span>${m.plan ? ` <span class="pf-chip">${esc(m.plan)}</span>` : ''}
<div class="sm">${esc(m.role)} · ${m.contactOk ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : 'Prefers not to be contacted'} · ${esc(new Date(m.at).toLocaleString())}${D.settings.contactEmail && m.emailed === false ? ' · <span style="color:var(--danger)">email not delivered</span>' : ''}</div></div>
<button type="button" class="btn alt sm" data-act="rmFeedback" data-id="${esc(m.id)}">Delete</button></div>${m.message ? `<p class="inq-m">${esc(m.message)}</p>` : ''}${m.page ? `<div class="sm">Sent from <a href="${esc(m.page)}" target="_blank" rel="noopener">${esc(m.page)}</a></div>` : ''}</div>`).join('')}</div>` : '<p class="muted">No feedback yet.</p>'}`;
}
// businesses' "I want this" on App Marketplace apps (lib/marketplace.js), most wanted first, and apps they suggested
function appRequestsCard(box) {
  const R = D.appRequests || { apps: [], suggestions: [] }; const acct = (m) => (m.account ? `<a href="${esc(m.account)}" target="_blank" rel="noopener">${esc(m.company)}</a>` : esc(m.company));
  box.innerHTML = `<h2>App requests</h2><p class="muted" style="font-size:13px;margin-top:0">Apps businesses asked for with “I want this” in Settings → App Marketplace, most wanted first.</p>
${R.apps.length ? `<div class="inq-list">${R.apps.map((a) => `<div class="inq"><div class="inq-h"><div><strong>${esc(a.name)}</strong> <span class="pf-chip">${esc(a.category)}</span>
<div class="sm">${a.accounts.length} business${a.accounts.length === 1 ? '' : 'es'}</div></div></div><p class="inq-m">${a.accounts.map((m) => `${acct(m)} <span class="muted">(${esc(m.name)}, ${esc(new Date(m.at).toLocaleDateString())})</span>`).join('<br>')}</p></div>`).join('')}</div>` : '<p class="muted">No requests yet.</p>'}
<h2 style="margin-top:24px">Suggested apps</h2><p class="muted" style="font-size:13px;margin-top:0">Apps that aren’t in the marketplace, sent with “Suggest an app”.</p>
${R.suggestions.length ? `<div class="inq-list">${R.suggestions.slice(0, 100).map((m) => `<div class="inq"><div class="inq-h"><div><strong>${esc(m.app)}</strong> · ${acct(m)}
<div class="sm">${esc(m.name)} · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a> · ${esc(new Date(m.at).toLocaleString())}</div></div>
<button type="button" class="btn alt sm" data-act="rmAppSuggestion" data-id="${esc(m.id)}">Delete</button></div>${m.note ? `<p class="inq-m">${esc(m.note)}</p>` : ''}</div>`).join('')}</div>` : '<p class="muted">No suggestions yet.</p>'}`;
}
A.rmAppSuggestion = async (d) => { if (!confirm('Delete this suggestion?')) return; D.appRequests = await api('DELETE', `/api/platform/app-suggestions/${encodeURIComponent(d.id)}`); messagesView($('#main')); toast('Suggestion deleted'); };
A.rmFeedback = async (d) => { if (!confirm('Delete this feedback?')) return; D.feedback = await api('DELETE', `/api/platform/feedback/${encodeURIComponent(d.id)}`); messagesView($('#main')); toast('Feedback deleted'); };
// the platform's own emails (lib/emails.js): sign-up, invites, password resets, notices to businesses and to you
let EM = null;
const EM_GROUPS = [['users', 'Emails to businesses and their teams'], ['you', 'Emails to you']];
async function emailsCard(box) {
  if (!EM) { box.innerHTML = '<h2>Email templates</h2><p class="muted">Loading…</p>'; try { EM = await api('GET', '/api/platform/emails'); } catch (x) { box.innerHTML = `<h2>Email templates</h2><p class="muted">${esc(x.message)}</p>`; return; } }
  box.innerHTML = `<h2>Email templates</h2><p class="muted" style="font-size:13px;margin-top:0">The emails ${esc(D.settings.productName)} sends by itself, styled like your home page. Edit the wording; words in <code>{{double braces}}</code> are filled in when each email is sent. Businesses’ emails to their own clients (quotes, invoices, reminders) are edited by each business in its App Settings.</p>
${EM_GROUPS.map(([g, title]) => `<h3 class="hc-h3" style="margin-top:18px">${title}</h3><div class="inq-list">${EM.filter((t) => t.group === g).map((t) => `<div class="inq"><div class="inq-h"><div><strong>${esc(t.label)}</strong>${t.custom ? ' <span class="pf-chip ok">Edited</span>' : ''}<div class="sm">${esc(t.when)}</div><div class="sm em-subj">Subject: ${esc(t.subject)}</div></div>
<button type="button" class="btn alt sm" data-act="emailEdit" data-k="${t.key}">Edit</button></div></div>`).join('')}</div>`).join('')}`;
}
A.emailEdit = (d) => {
  const t = EM.find((x) => x.key === d.k);
  const m = modal(t.label, `<p class="muted" style="margin:-8px 0 14px;font-size:13px">${esc(t.when)}</p>
<div class="em-grid"><div><label>Subject<input name="subject" value="${esc(t.subject)}" maxlength="200"></label>
<label>Message<textarea name="body" class="hc-body em-body" rows="16" spellcheck="true">${esc(t.body)}</textarea></label>
<div class="em-vars"><span class="muted">Insert:</span>${Object.entries(t.vars).map(([k, label]) => `<button type="button" class="pf-chip" data-act="emailVar" data-v="${k}" title="${esc(label)}">{{${k}}}</button>`).join('')}</div>
<details class="hc-cheat"><summary>Formatting</summary><ul><li><code># Heading</code> on the first line is the big title</li><li>Leave a blank line between paragraphs</li><li><code>**bold**</code> for bold</li><li><code>[Button text]({{link}})</code> on its own line is a button; inside a sentence it’s a link</li><li><code>&gt; {{message}}</code> puts text in a shaded box (left out when it’s empty)</li></ul></details></div>
<div><div class="hc-bodyhead"><span>Preview, with example details</span></div><div class="em-psubj" id="emSubj"></div><iframe id="emFrame" class="em-frame" title="Email preview" sandbox=""></iframe></div></div>
<div class="foot"><span style="margin-right:auto;display:flex;gap:8px;flex-wrap:wrap">${t.custom ? '<button type="button" class="btn alt" data-act="emailReset">Restore default</button>' : ''}<button type="button" class="btn alt" data-act="emailTest">Send test to me</button></span>
<button type="button" class="btn alt" data-act="emailCancel">Cancel</button><button type="button" class="btn" data-act="emailSave">Save</button></div>`, { wide: true, sticky: true }); m.classList.add('em');
  m.emKey = t.key; const vals = () => ({ subject: $('[name=subject]', m).value, body: $('[name=body]', m).value });
  m.emDirty = () => { const v = vals(); return v.subject !== t.subject || v.body !== t.body; };
  let timer; let seq = 0;
  const preview = async () => { const n = ++seq; try { const r = await api('POST', `/api/platform/emails/${t.key}/preview`, vals()); if (n !== seq || !document.body.contains(m)) return; $('#emSubj', m).textContent = r.subject; $('#emFrame', m).srcdoc = r.html; } catch (x) { toast(x.message, true); } };
  $$('input,textarea', m).forEach((i) => i.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(preview, 300); }));
  m.emVals = vals; preview();
};
A.emailVar = (d, el) => { // put {{name}} at the cursor in the message (or the subject, if that was the last field used)
  const m = el.closest('.pf-modal'); const f = m.emField && document.body.contains(m.emField) ? m.emField : $('[name=body]', m);
  const s = f.selectionStart ?? f.value.length; const ins = `{{${d.v}}}`; f.setRangeText(ins, s, f.selectionEnd ?? s, 'end'); f.focus(); f.dispatchEvent(new Event('input'));
};
document.addEventListener('focusin', (e) => { const m = e.target.closest && e.target.closest('.pf-modal'); if (m && m.emKey && e.target.matches('[name=subject],[name=body]')) m.emField = e.target; });
A.emailSave = async (d, el) => { const m = el.closest('.pf-modal'); EM = await api('PUT', `/api/platform/emails/${m.emKey}`, m.emVals()); closeModal(); toast('Email saved'); emailsCard($('#emails')); };
A.emailCancel = (d, el) => { const m = el.closest('.pf-modal'); if (m.emDirty() && !confirm('Discard your changes to this email?')) return; closeModal(); };
A.emailReset = async (d, el) => {
  const m = el.closest('.pf-modal'); if (!confirm('Go back to the default wording for this email? Your changes to it are removed.')) return;
  EM = await api('DELETE', `/api/platform/emails/${m.emKey}`); closeModal(); toast('Default restored'); emailsCard($('#emails'));
};
A.emailTest = async (d, el) => {
  const m = el.closest('.pf-modal'); el.disabled = true;
  try { const r = await api('POST', `/api/platform/emails/${m.emKey}/test`, m.emVals()); toast(r.status === 'sent' ? `Test sent to ${r.to}` : r.detail || 'Not delivered', r.status !== 'sent'); } finally { el.disabled = false; }
};
// the application logo (lib/brand.js): the home, pricing, checkout and help center pages, this console, account logins and sidebars (when a business has no logo of its own) and emails
function logoCard(box) {
  const s = D.settings; const b = siteBrand();
  const tile = (kind, title, src, bg, hint) => `<div class="lg-tile"><div class="lg-h"><strong>${title}</strong><span class="muted">${hint}</span></div>
<div class="lg-prev" style="background:${bg}">${src ? `<img src="${esc(src)}" alt="">` : '<span class="muted">No logo yet</span>'}</div>
<div class="lg-acts"><label class="btn alt sm">${src ? 'Replace' : 'Upload'}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" data-logo="${kind}" hidden></label>${src ? `<button type="button" class="btn alt sm" data-act="rmLogo" data-k="${kind}">Remove</button>` : ''}</div></div>`;
  box.innerHTML = `<h2>Logo</h2><p class="muted" style="font-size:13px;margin-top:0">Your application’s logo, used on the home, pricing, checkout and help center pages, in this console, on account login pages and sidebars (until a business adds its own logo) and at the top of every email in Messages → Email templates.</p>
<div class="lg-grid">${tile('light', 'Logo', s.logo, '#ffffff', 'For light backgrounds')}${tile('dark', 'Dark background version', s.logoDark, '#0f1f3d', 'Optional')}</div>
<label class="switchline"><input type="checkbox" id="logoHasName" ${s.logoHasName ? 'checked' : ''} ${s.logo ? '' : 'disabled'}> The logo already shows the name “${esc(s.productName)}”, so don’t repeat it next to the logo</label>
<p class="muted" style="font-size:13px;margin:0">PNG or JPG works everywhere. Email apps don’t show SVG or WebP, so with one of those your emails keep the standard check mark. Up to 700 KB; a logo about 3 to 5 times as wide as it is tall fits best. Without a dark background version, the logo sits on a small white tile on dark backgrounds.</p>
${b.logo ? `<div class="lg-sample"><span class="muted">Header preview</span><div class="lg-bar">${brandImg(b, 'dark')}${b.logoHasName ? '' : `<strong>${esc(s.productName)}</strong>`}</div></div>` : ''}`;
  $$('[data-logo]', box).forEach((i) => i.addEventListener('change', () => {
    const f = i.files[0]; if (!f) return; if (f.size > 700 * 1024) { toast('Use an image under 700 KB', true); i.value = ''; return; }
    const r = new FileReader(); r.onload = async () => { try { D.settings = await api('POST', `/api/platform/logo/${i.dataset.logo}`, { dataUrl: r.result }); toast('Logo saved'); render(); } catch (x) { toast(x.message, true); } }; r.readAsDataURL(f);
  }));
  $('#logoHasName', box).addEventListener('change', async (e) => { try { D.settings = await api('PUT', '/api/platform/settings', { logoHasName: e.target.checked }); render(); } catch (x) { toast(x.message, true); } });
}
A.rmLogo = async (d) => {
  if (!confirm(d.k === 'icon' ? 'Remove the app icon? Browser tabs go back to the standard icon.' : d.k === 'dark' ? 'Remove the dark background version?' : 'Remove the logo? Pages and emails go back to the standard check mark.')) return;
  D.settings = await api('DELETE', `/api/platform/logo/${d.k}`);
  if (d.k === 'icon') { toast('App icon removed'); iconCard($('#iconCard')); refreshTabIcon(); } else { toast('Logo removed'); render(); }
};
// the app icon (lib/brand.js): browser tabs, bookmarks, Google results and phones' home screens, for the public pages, the Help Center, Alpha,
// and every business's app
const refreshTabIcon = () => { const l = $('link[rel=icon]'); if (l) l.href = '/favicon.ico?v=' + Date.now(); };
function iconCard(box) {
  if (!box) return; const s = D.settings;
  box.innerHTML = `<h2>App icon</h2><p class="muted" style="font-size:13px;margin-top:0">The small square picture in browser tabs, bookmarks and Google search results, and on a phone’s home screen when someone saves your site. Used on your home, pricing and help center pages, here in Alpha, and in every business’s app.</p>
<div class="ai-row"><div class="ai-prev">${s.icon ? `<img src="${esc(s.icon)}" alt="App icon">` : '<span class="muted">None</span>'}</div>
<div class="ai-tabs"><span class="muted" style="font-size:12px">Browser tab</span><div class="ai-tab"><span class="ai-fav">${s.icon ? `<img src="${esc(s.icon)}" alt="">` : ''}</span><span class="ai-t">${esc(s.productName)}</span><span aria-hidden="true">×</span></div></div></div>
<div class="lg-acts"><label class="btn alt sm">${s.icon ? 'Replace' : 'Upload'}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-icon hidden></label>${s.icon ? '<button type="button" class="btn alt sm" data-act="rmLogo" data-k="icon">Remove</button>' : ''}</div>
<p class="muted" style="font-size:13px;margin:10px 0 0">A square PNG at least 512 × 512 pixels works best (phones need PNG or JPG). Simple, bold shapes stay clear at tab size. Up to 700 KB.</p>`;
  $('[data-icon]', box).addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return; if (f.size > 700 * 1024) { toast('Use an image under 700 KB', true); e.target.value = ''; return; }
    const r = new FileReader(); r.onload = () => {
      const img = new Image(); img.onload = async () => { // a wide image is squashed into a square, so say so (it still uploads)
        try { D.settings = await api('POST', '/api/platform/logo/icon', { dataUrl: r.result }); iconCard(box); refreshTabIcon();
          toast(img.naturalWidth && Math.abs(img.naturalWidth - img.naturalHeight) > 2 ? `App icon saved. It’s ${img.naturalWidth} × ${img.naturalHeight}; a square image looks best.` : 'App icon saved'); } catch (x) { toast(x.message, true); }
      }; img.src = r.result;
    }; r.readAsDataURL(f);
  });
}
// Settings → Website colors (lib/brand.js): every color of the public site, Help Center, Alpha and the businesses' apps. Only changes from the defaults are saved.
let SC = null; let scOpen = false;
const reloadTheme = () => { const l = $('link[href^="/theme.css"]'); if (l) l.href = '/theme.css?v=' + Date.now(); $$('link[rel=stylesheet][href^="/styles.css"]').forEach((c) => { c.href = c.href.split('&')[0] + '&t=' + Date.now(); }); };
async function colorsCard(box) {
  if (!box) return;
  if (!SC) { try { SC = await api('GET', '/api/platform/site-colors'); } catch (x) { box.innerHTML = `<h2>Website colors</h2><p class="muted">${esc(x.message)}</p>`; return; } }
  const cur = D.settings.siteColors || {};
  const swatch = (k, def, label) => `<input type="color" data-k="${esc(k)}" data-def="${esc(def)}" value="${esc(cur[k] || def)}" aria-label="${esc(label)}" title="${esc(label)}">`;
  const reset = (k) => (cur[k] || cur[k + ':dark'] ? `<button type="button" class="btn alt sm" data-act="colorReset" data-k="${esc(k)}">Reset</button>` : '');
  const row = (r) => `<div class="sc-row"><span class="sc-sw">${swatch(r.key, r.light, r.dark ? r.label + ', light mode' : r.label)}${r.dark ? swatch(r.key + ':dark', r.dark, r.label + ', dark mode') : ''}</span><div class="sc-l"><strong>${esc(r.label)}</strong>${r.note ? `<small class="muted">${esc(r.note)}</small>` : ''}</div>${reset(r.key)}</div>`;
  box.innerHTML = `<h2>Website colors</h2><p class="muted" style="font-size:13px;margin-top:0">Every color on your public website, the Help Center, Alpha and every business’s app. Where there are two swatches, the first is light mode and the second is dark mode; one swatch is used in both. A business’s accent color (App Settings) changes only its client portal. Changes show the next time a page loads.</p>
<div class="sc-pair">${SC.groups.map((g) => `<section class="sc-group"><h3 class="sc-g">${esc(g.name)}</h3>${g.rows.map(row).join('')}</section>`).join('')}</div>
<details class="sc-other" ${scOpen ? 'open' : ''}><summary>All other colors (${SC.others.length})</summary><p class="muted" style="font-size:13px">Every remaining color in the site’s styles, most used first, shown with where it’s first used. Changing one changes it everywhere it appears.</p><div class="sc-pair">${SC.others.map((o) => `<div class="sc-row"><span class="sc-sw">${swatch(o.color, o.color, o.color)}</span><div class="sc-l"><strong>${esc(o.color)}</strong><small class="muted">Used ${o.n} time${o.n === 1 ? '' : 's'}, first in <code>${esc(o.where)}</code></small></div>${reset(o.color)}</div>`).join('')}</div></details>
${Object.keys(cur).length ? '<div class="lg-acts"><button type="button" class="btn alt sm" data-act="colorResetAll">Reset all colors</button></div>' : ''}`;
  $('.sc-other', box).addEventListener('toggle', (e) => { scOpen = e.target.open; });
  box.onchange = () => saveColors(Object.fromEntries($$('input[type=color]', box).filter((i) => i.value !== i.dataset.def).map((i) => [i.dataset.k, i.value])));
}
const saveColors = async (siteColors) => {
  try { D.settings = await api('PUT', '/api/platform/settings', { siteColors }); reloadTheme(); toast('Website colors saved'); } catch (x) { toast(x.message, true); }
  colorsCard($('#colorsCard'));
};
A.colorReset = (d) => { const c = { ...(D.settings.siteColors || {}) }; delete c[d.k]; delete c[d.k + ':dark']; saveColors(c); };
A.colorResetAll = () => { if (confirm('Put every website color back to its default?')) saveColors({}); };
// a settings form saves itself: text a moment after typing stops (or on leaving the field), switches and menus right away.
// Each card shows how it went where its Save button used to be. save(fields) sends them and throws on a problem.
function autosave(form, save) {
  const snap = () => JSON.stringify([...new FormData(form)].concat($$('input[type=checkbox]', form).map((c) => [c.name, c.checked])));
  let last = snap(); let timer; let queue = Promise.resolve(); let at = null;
  const status = (el, text, cls = '') => { const s = el && el.closest('.card') && $('.as-status', el.closest('.card')); if (s) { s.textContent = text; s.className = 'as-status ' + cls; } };
  const run = (el) => { clearTimeout(timer); queue = queue.then(async () => {
    const now = snap(); if (now === last) { if (el && $('.as-status.editing', el.closest('.card'))) status(el, '✓ Saved', 'ok'); return; }
    const bad = $$('input,select,textarea', form).find((i) => !i.checkValidity());
    if (bad) { status(bad, bad.validationMessage || 'Check this field', 'err'); return; }
    status(el, 'Saving…');
    try { await save(Object.fromEntries(new FormData(form))); last = now; status(el, '✓ Saved', 'ok'); } catch (x) { status(el, x.message, 'err'); }
  }); };
  form.addEventListener('input', (e) => { at = e.target; if (e.target.matches('input[type=checkbox], select')) return; status(e.target, 'Editing…', 'editing'); clearTimeout(timer); timer = setTimeout(() => run(e.target), 900); });
  form.addEventListener('change', (e) => run(e.target));
  form.addEventListener('submit', (e) => { e.preventDefault(); run(at || $('input,select', form)); }); // Enter in a field saves now
};
// maintenance mode (lib/maintenance.js): everyone but you sees the maintenance page
function maintenanceCard(box) {
  const m = D.maintenance || {}; const link = m.secret ? `${location.origin}/?bypass=${m.secret}` : '';
  box.innerHTML = `<h2>Maintenance mode <span class="cstatus ${m.on ? 'q-sent' : ''}" style="margin-left:6px">${m.on ? 'On' : 'Off'}</span></h2>
<p class="muted" style="font-size:13px;margin-top:0">While it’s on, every address (your home and pricing pages, checkout, the help center and every business’s app and client links) shows a maintenance page. You can still use everything while you’re logged in here. Alpha, Stripe payments and webhooks keep working.</p>
<form id="mtf"><label>Title<input name="title" value="${esc(m.title || '')}" maxlength="120" placeholder="We’ll be back soon"></label>
<label>Message<textarea name="message" rows="3" maxlength="1000" placeholder="${esc(D.settings.productName)} is getting some scheduled improvements. Everything will be back shortly. Thanks for your patience.">${esc(m.message || '')}</textarea></label>
<label style="max-width:360px">Expected back (optional)<input name="until" value="${esc(m.until || '')}" maxlength="80" placeholder="e.g. Today at 2:00 PM Central"></label>
<div class="acts" style="justify-content:flex-start">${m.on ? '<button class="btn alt" data-v="keep">Save wording</button><button type="button" class="btn" data-act="mtSet" data-on="0">Turn off maintenance mode</button>' : '<button class="btn alt" data-v="keep">Save wording</button><button type="button" class="btn danger" data-act="mtSet" data-on="1">Turn on maintenance mode</button>'}<a class="btn alt" href="/api/platform/maintenance/preview" target="_blank" rel="noopener">Preview page</a></div></form>
${link ? `<h3 style="font-size:15px;margin:18px 0 6px">Your access while it’s on</h3><p class="muted" style="font-size:13px;margin:0 0 8px">This browser gets through automatically on ${esc(D.rootDomain)} and every business address under it. On a business’s own domain (or another browser or phone), open any page with this link’s ending, e.g. <code>app.theirbusiness.com/?bypass=…</code>:</p>
<div class="linkbox"><input readonly value="${esc(link)}" aria-label="Bypass link"><button type="button" class="btn alt" data-act="copy">Copy</button></div>
<p class="muted" style="font-size:12px;margin:6px 0 0">Keep it private: anyone with it can see the site. <button type="button" class="linkish" data-act="mtNewCode">Make a new link</button> to stop old ones working.</p>` : ''}`;
  $('#mtf', box).addEventListener('submit', async (e) => { e.preventDefault(); try { D.maintenance = await api('PUT', '/api/platform/maintenance', Object.fromEntries(new FormData(e.target))); toast('Saved'); render(); } catch (x) { toast(x.message, true); } });
}
A.mtSet = async (d) => {
  const on = d.on === '1'; if (on && !confirm('Turn on maintenance mode? Everyone except you will see the maintenance page until you turn it off.')) return;
  D.maintenance = await api('PUT', '/api/platform/maintenance', { ...Object.fromEntries(new FormData($('#mtf'))), on }); toast(on ? 'Maintenance mode is on' : 'Maintenance mode is off: the site is open again'); render();
};
A.mtNewCode = async () => { if (!confirm('Make a new bypass link? Old links stop working; this browser keeps working.')) return; D.maintenance = await api('PUT', '/api/platform/maintenance', { newCode: true, ...(D.maintenance.on ? { on: true } : {}) }); toast('New link made'); render(); };
// addresses held back from sign-ups; giving one to an account (new account or Manage → web address) releases it
function reservedCard(box) {
  const R = D.reservedSlugs || [];
  box.innerHTML = `<h2>Reserved addresses</h2><p class="muted" style="font-size:13px;margin-top:0">Hold back web addresses (<code>&lt;address&gt;.${esc(D.rootDomain)}</code>) so businesses can’t take them when they sign up. You can still give one to an account yourself; it then leaves this list.</p>
${R.length ? `<div class="tablewrap"><table class="acc"><thead><tr><th>Address</th><th>Note</th><th>Reserved</th><th></th></tr></thead><tbody>${R.map((r) => `<tr><td class="nm">${esc(r.slug)}<div class="sm">${esc(r.slug)}.${esc(D.rootDomain)}</div></td><td>${esc(r.note) || '<span class="muted">—</span>'}</td><td class="sm">${esc(r.createdAt)}</td>
<td><div class="acts"><button type="button" class="btn alt sm" data-act="unreserve" data-slug="${esc(r.slug)}">Release</button></div></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No reserved addresses yet.</p>'}
<form id="rf" class="row" style="margin-top:12px;align-items:end"><label>Address<input name="slug" required maxlength="32" placeholder="e.g. acme" autocapitalize="off" spellcheck="false"></label><label>Note (optional)<input name="note" maxlength="100" placeholder="Who it’s for"></label><div><button class="btn">Reserve</button></div></form>`;
  $('#rf', box).addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); b.slug = b.slug.trim().toLowerCase();
    try { D.reservedSlugs = await api('POST', '/api/platform/reserved', b); toast(`${b.slug} reserved`); reservedCard(box); } catch (x) { toast(x.message, true); }
  });
}
A.unreserve = async (d) => {
  if (!confirm(`Release ${d.slug}? Anyone signing up could then take it.`)) return;
  D.reservedSlugs = await api('DELETE', `/api/platform/reserved/${encodeURIComponent(d.slug)}`); toast(`${d.slug} released`); reservedCard($('#reserved'));
};
// the server-wide services every account uses: set in the .env file next to server.js, checked and tested here
async function integrationsCard(box) {
  let I; try { I = await api('GET', '/api/platform/integrations'); } catch (x) { box.innerHTML = `<div class="card"><p class="muted" style="margin:0">${esc(x.message)}</p></div>`; return; }
  const on = (ok, yes = 'Connected', no = 'Not set up') => `<span class="cstatus ${ok ? 'active' : ''}">${ok ? yes : no}</span>`;
  const S = I.stripe; const copy = (v, label) => `<div class="linkbox"><input readonly value="${esc(v)}" aria-label="${esc(label)}"><button type="button" class="btn alt" data-act="copy">Copy</button></div>`;
  const ig = (title, status, inner) => `<section class="ig"><div class="ig-h"><h3>${title}</h3>${status}</div>${inner}</section>`;
  const env = (html) => `<p class="ig-env">Set in <code>.env</code>: ${html}</p>`;
  box.innerHTML = `<div class="ig-grid"><div class="ig-col">${ig('Email', on(I.email, `Connected (${esc(I.email)})`), `<p class="ig-d">Every email the app sends, for every business: quotes, invoices, reminders, receipts and password resets, in each business’s name. Your own emails show your product name (or <code>EMAIL_FROM_NAME</code>) as the sender.</p>
${I.mailServer ? `<p class="ig-env">Using your mail server below (${esc(I.mailServer.from)}).</p>` : env('<code>GMAIL_USER</code> + <code>GMAIL_APP_PASSWORD</code>, or <code>SENDGRID_API_KEY</code> + <code>EMAIL_FROM</code>; or use your own mail server below.')}
<h4>Your mail server</h4><p class="muted ig-p">Send from a mailbox at your own domain, such as a SiteGround email account. It replaces ${I.envEmail ? esc(I.envEmail) + ' from the .env file' : 'the .env email settings'}. In SiteGround: Site Tools → Email → Accounts → ⋮ → Mail Configuration shows the outgoing (SMTP) server.</p>
<form id="mailForm" class="mail-form"><div class="row"><label>Outgoing mail server<input name="host" value="${esc(I.mailServer ? I.mailServer.host : '')}" placeholder="mail.yourdomain.com" autocapitalize="off" spellcheck="false"></label><label>Port (SSL/TLS)<input value="465" readonly></label></div>
<div class="row"><label>Username (the full email address)<input name="user" value="${esc(I.mailServer ? I.mailServer.user : '')}" placeholder="hello@yourdomain.com" autocomplete="off" autocapitalize="off" spellcheck="false"></label><label>Password<input name="pass" type="password" autocomplete="new-password" ${I.mailServer ? 'placeholder="Saved. Leave blank to keep it."' : ''}></label></div>
<div class="row"><label>Send from<input name="from" type="email" value="${esc(I.mailServer ? I.mailServer.from : '')}" placeholder="Same as the username"></label><div></div></div>
<div class="acts" style="justify-content:flex-start"><button class="btn alt">${I.mailServer ? 'Save mail server' : 'Use this mail server'}</button>${I.mailServer ? `<button type="button" class="btn danger sm" data-act="rmMailServer">${I.envEmail ? `Go back to ${esc(I.envEmail)}` : 'Remove'}</button>` : ''}</div></form>
<h4>Send a test</h4>${I.email ? '<form id="tEmail" class="inline-form"><label>Test email to<input name="to" type="email" required placeholder="you@example.com"></label><button class="btn alt">Send test email</button></form>' : '<p class="muted ig-p">Set up email first. Until then, emails are recorded in each account’s Notifications Log but not delivered.</p>'}`)}
${ig('Text messages (Twilio)', on(I.sms), `<p class="ig-d">Every business’s texts to clients (on plans with text messages), sent from your Twilio number and starting with the business’s name.</p>
${env('<code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> and <code>TWILIO_FROM</code> (your Twilio number, or a Messaging Service SID starting with MG).')}
<h4>Send a test</h4>${I.sms ? '<form id="tSms" class="inline-form"><label>Test text to<input name="to" required placeholder="+17135550100"></label><button class="btn alt">Send test text</button></form>' : '<p class="muted ig-p">Set up Twilio first. Until then, texts are recorded in each account’s Notifications Log but not delivered.</p>'}`)}
${ig('AI descriptions', D.settings.aiDescriptions === false ? on(false, '', 'Off') : on(I.ai), `<p class="ig-d">Claude drafts product and service descriptions and rewrites client messages and contracts, for plans with AI descriptions, and writes captions for your posts in Social (Write with AI).</p>
<label class="sw-row"><span>AI descriptions in every account<small class="muted">Off hides Write with AI and Rewrite from every business, and from your plan lists. Your Social captions and the help chat keep working.</small></span><input type="checkbox" class="sw" id="aiOn" ${D.settings.aiDescriptions !== false ? 'checked' : ''}><i></i></label>
${env('<code>ANTHROPIC_API_KEY</code>.')}`)}
${ig('App Marketplace', on(D.settings.marketplace !== false, 'On', 'Off'), `<p class="ig-d">Settings → App Marketplace in every account: owners and admins browse apps, connect the ones that work today and vote for the rest (see Messages → App requests).</p>
<label class="switchline"><input type="checkbox" id="mkOn" ${D.settings.marketplace !== false ? 'checked' : ''}> Show the App Marketplace in every account</label>
<p class="muted ig-p">Turned off, the page is hidden and Home Depot search stops in the product and service form. Google, Facebook, Instagram, Stripe and AI keep working: they’re set up on their own pages.</p>
<h4>Home Depot prices ${on(I.homeDepot)}</h4><p class="muted ig-p">Businesses that turn on The Home Depot can search Home Depot products and prices from the product and service form. Home Depot has no public API, so searches go through <a href="https://serpapi.com/home-depot-search-api" target="_blank" rel="noopener">SerpApi</a>: each new search uses one SerpApi credit (repeat searches within an hour are free), up to 60 an hour per business.</p>${env('<code>SERPAPI_API_KEY</code> (from your SerpApi dashboard).')}`)}
</div><div class="ig-col">${socialGroups(I, ig, on, copy)}</div></div>
<div class="ig-wide">${ig('Stripe', S.key ? `${on(true)} <span class="cstatus ${S.mode === 'live' ? 'active' : 'q-sent'}">${S.mode === 'live' ? 'Live' : 'Test mode'}</span>` : on(false), `<div class="ig-2"><div><p class="ig-d">Your Stripe account: plan payments when businesses sign up, and “Connect with Stripe” for businesses’ card payments from their clients.</p>
${S.keyVar ? `<p class="ig-env">Using <code>${S.keyVar}</code> from <code>.env</code>.</p>` : env('<code>BILLING_STRIPE_SECRET_KEY</code> (or <code>STRIPE_SECRET_KEY</code>).')}
${S.key ? '' : '<div class="note">Without a Stripe key, sign-up checkout and businesses’ invoice pay pages run demo payments that charge nobody, and businesses can’t connect Stripe.</div>'}
<h4>Card payments for businesses (Stripe Connect)</h4>
<p class="muted ig-p">Each business sets up card payments once in its App Settings → Card payments, and clients’ payments go straight to that business. One-time setup: turn on <strong>Connect</strong> in your Stripe dashboard (Settings → Connect). ${I.connected} account${I.connected === 1 ? ' has' : 's have'} started: ${I.byMethod.standard} with Connect with Stripe, ${I.byMethod.embedded} set up in ${esc(D.settings.productName)}.</p>
<form id="cardSetupForm"><div class="cs-opts">${[['standard', 'Connect with Stripe', 'Businesses make or sign in to their own Stripe account on Stripe’s pages and manage it in their Stripe dashboard. No extra Stripe fees for you.'],
  ['embedded', `Set up in ${esc(D.settings.productName)}`, 'Businesses fill in Stripe’s form inside the app, with no Stripe account or login. As with Connect with Stripe, Stripe’s fees come out of each business’s own payments and Stripe covers negative balances. Needs the publishable key below, and Stripe’s Site links (below).'],
  ['both', 'Let each business choose', 'Shows both buttons. Handy while you find out what businesses prefer.']].map(([v, l, d]) => `<label class="cs-opt"><input type="radio" name="cardSetup" value="${v}" ${I.cardSetup === v ? 'checked' : ''}><span><strong>${l}</strong><small>${d}</small></span></label>`).join('')}</div>
${I.cardSetup === 'both' && !I.pubKey ? '<div class="note">Businesses only see Connect with Stripe until you add the publishable key below.</div>' : ''}
<label>Stripe publishable key<input name="stripePublishableKey" placeholder="${I.pubKey ? esc(I.pubKey) + (I.pubKeyFromEnv ? ' (from .env)' : ' (saved)') : 'pk_live_… (Stripe → Developers → API keys)'}" autocomplete="off" spellcheck="false"></label>
<p class="muted ig-p" style="margin-top:-4px">Only needed for setting up in the app. Use the key from the same Stripe account and mode as your secret key. Leave it blank to keep the saved one. Businesses already set up keep working whichever way you choose.</p>
<div class="acts" style="justify-content:flex-start"><button class="btn alt">Save card payment setup</button></div></form>
${I.cardSetup !== 'standard' ? `<h4>Stripe Site links (for setting up in the app)</h4><p class="muted ig-p">Stripe emails businesses set up in the app when it needs something from them, and links to these pages. Before going live, add them on Stripe’s <a href="https://dashboard.stripe.com/settings/connect/site-links" target="_blank" rel="noopener">Site links</a> page (or Settings → Connect → Emails → <strong>Preview and customize</strong> → <strong>Manage URLs</strong>). For each one, choose <strong>Yes</strong> (it’s an embedded component), paste the link and click <strong>Validate</strong>. Test mode works without them. Each sends the business to the right page in its own account.</p>
${[['Account management and Notification banner', 'account'], ['Payments', 'payments'], ['Payouts', 'payouts'], ['Balances', 'balances'], ['Documents', 'documents']].map(([l, k]) => `<label class="ig-p" style="display:block;margin:6px 0 2px">${l}</label>${copy(I.platformUrl + '/stripe/go/' + k, l)}`).join('')}` : ''}
</div><div><form id="feeForm" class="inline-form"><label>Your platform fee on each card payment (%)<input name="platformFeePercent" type="number" min="0" max="30" step="0.1" value="${esc(D.settings.platformFeePercent || 0)}"></label><button class="btn alt">Save fee</button></form>
<p class="muted ig-p">Payment confirmations: ${on(S.connectWebhook, 'Webhook connected', 'Webhook not set up')} In Stripe, add a webhook for <strong>events on connected accounts</strong> with <code>checkout.session.completed</code>, <code>checkout.session.async_payment_succeeded</code> and <code>account.updated</code>, then put its signing secret in <code>STRIPE_CONNECT_WEBHOOK_SECRET</code>.</p>
${copy(S.connectWebhookUrl, 'Connect webhook URL')}
<h4>Plan payments at sign-up</h4>
<p class="muted ig-p">${on(S.billingWebhook, 'Webhook connected', 'Webhook not set up')} Optional: add a webhook on your own account for <code>checkout.session.completed</code>, <code>customer.subscription.updated</code> and <code>customer.subscription.deleted</code>, with its signing secret in <code>BILLING_STRIPE_WEBHOOK_SECRET</code>. It pauses accounts whose subscription ends.</p>
${copy(S.billingWebhookUrl, 'Billing webhook URL')}
${I.localhost ? '<p class="muted ig-p" style="margin-top:8px">Stripe can’t reach localhost: set <code>BASE_URL</code> (or <code>PLATFORM_DOMAIN</code>) to your public address first.</p>' : ''}</div></div>`)}
</div>`;
  igTabs(box);
  $('#aiOn', box).addEventListener('change', async (e) => {
    const want = e.target.checked; e.target.disabled = true;
    try { D.settings = await api('PUT', '/api/platform/settings', { aiDescriptions: want }); toast(want ? 'AI descriptions are on' : 'AI descriptions are off in every account'); integrationsCard(box); }
    catch (x) { e.target.checked = !want; e.target.disabled = false; toast(x.message, true); }
  });
  $('#mkOn', box).addEventListener('change', async (e) => {
    const want = e.target.checked; e.target.disabled = true;
    try { D.settings = await api('PUT', '/api/platform/settings', { marketplace: want }); toast(want ? 'App Marketplace is on' : 'App Marketplace is off in every account'); integrationsCard(box); }
    catch (x) { e.target.checked = !want; e.target.disabled = false; toast(x.message, true); }
  });
  $('#mailForm', box).addEventListener('submit', async (e) => {
    e.preventDefault(); try { await api('PUT', '/api/platform/mail-server', Object.fromEntries(new FormData(e.target))); toast('Mail server saved. Send a test email to check it.'); integrationsCard(box); } catch (x) { toast(x.message, true); }
  });
  $('#cardSetupForm', box).addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); if (!b.stripePublishableKey) delete b.stripePublishableKey;
    try { await api('PUT', '/api/platform/settings', b); await load(); toast('Card payment setup saved'); integrationsCard(box); } catch (x) { toast(x.message, true); }
  });
  $$('.oa-form', box).forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault(); try { await api('PUT', '/api/platform/oauth-apps/' + f.dataset.p, Object.fromEntries(new FormData(f))); toast(f.dataset.p === 'tiktok' ? 'Saved. Connect your account in Social.' : 'Saved. Businesses can connect now.'); integrationsCard(box); } catch (x) { toast(x.message, true); }
  }));
  $('#feeForm', box).addEventListener('submit', async (e) => {
    e.preventDefault(); try { await api('PUT', '/api/platform/settings', Object.fromEntries(new FormData(e.target))); await load(); toast('Platform fee saved'); } catch (x) { toast(x.message, true); }
  });
  [['#tEmail', 'test-email', 'Test email sent'], ['#tSms', 'test-sms', 'Test text sent']].forEach(([sel, path, ok]) => {
    const f = $(sel, box); if (f) f.addEventListener('submit', async (e) => {
      e.preventDefault(); try { const r = await api('POST', '/api/platform/' + path, Object.fromEntries(new FormData(f))); toast(r.status === 'sent' ? ok : r.detail || 'Not delivered', r.status !== 'sent'); } catch (x) { toast(x.message, true); }
    });
  });
}

// Account Connections (lib/social.js): the Google and Meta apps businesses sign in through
function socialGroups(I, ig, on, copy) {
  const G = I.social.google; const M = I.social.meta; const T = I.social.tiktok; const n = (k, c) => `${c} business${c === 1 ? '' : 'es'} connected${k ? ' ' + k : ''}`;
  const form = (p, x, idLabel, idPh, secLabel) => `<form class="oa-form" data-p="${p}"><div class="row"><label>${idLabel}<input name="id" value="${esc(x.fromEnv ? '' : x.id)}" placeholder="${x.fromEnv ? esc(x.id) + ' (from .env)' : idPh}" autocomplete="off" spellcheck="false"></label>
<label>${secLabel}<input name="secret" type="password" autocomplete="new-password" placeholder="${x.secret ? 'Saved. Leave blank to keep it' : ''}"></label></div>
<div class="acts" style="justify-content:flex-start"><button class="btn alt">Save</button>${x.id && !x.fromEnv ? `<button type="button" class="btn danger sm" data-act="rmOauthApp" data-p="${p}">Remove</button>` : ''}</div></form>`;
  return ig('Google Business Profile', on(G.id && G.secret, 'Ready', 'Not set up'), `<p class="ig-d">Businesses connect their Google Business Profile in Account Connections to see and reply to Google reviews, and to add a <strong>Book</strong> button to their Google profile. ${n('', G.connected)}.</p>
<ol class="ig-steps"><li>In <a href="https://console.cloud.google.com/" target="_blank" rel="noopener">Google Cloud</a>, create a project. Google gives Business Profile API access by request: <a href="https://developers.google.com/my-business/content/prereqs" target="_blank" rel="noopener">apply here</a>, then turn on the <em>My Business Account Management</em>, <em>My Business Business Information</em>, <em>My Business Place Actions</em> and <em>Google My Business</em> APIs.</li>
<li>Set up the OAuth consent screen (External) with the <code>business.manage</code> scope, then publish it.</li>
<li>Credentials → Create credentials → OAuth client ID → Web application. Add this <strong>Authorized redirect URI</strong>:</li></ol>
${copy(G.redirectUri, 'Google redirect URI')}
<p class="muted ig-p" style="margin-top:8px">Then paste the client’s ID and secret here. Or set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in <code>.env</code>.</p>
${form('google', G, 'Client ID', '….apps.googleusercontent.com', 'Client secret')}${I.localhost ? '<p class="muted ig-p">Google only sends people back to a public address: set <code>BASE_URL</code> (or <code>PLATFORM_DOMAIN</code>) first.</p>' : ''}`)
  + ig('Facebook & Instagram (Meta)', on(M.id && M.secret, 'Ready', 'Not set up'), `<p class="ig-d">Businesses connect their Facebook Page and Instagram professional account in Account Connections, then post project photos to them. ${n('to Facebook', M.connected.facebook)}, ${M.connected.instagram} to Instagram.</p>
<ol class="ig-steps"><li>On <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener">Meta for Developers</a>, create an app of type <strong>Business</strong> and add <strong>Facebook Login for Business</strong>.</li>
<li>In Facebook Login → Settings, add this <strong>Valid OAuth Redirect URI</strong>:</li></ol>
${copy(M.redirectUri, 'Meta redirect URI')}
<ol class="ig-steps" start="3"><li>Request Advanced Access in App Review for <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>pages_manage_posts</code>, <code>business_management</code>, <code>instagram_basic</code> and <code>instagram_content_publish</code>. Until Meta approves them, only people with a role on your app can connect.</li>
<li>App settings → Basic has the App ID and App secret. Paste them here, or set <code>META_APP_ID</code> and <code>META_APP_SECRET</code> in <code>.env</code>.</li></ol>
${form('meta', M, 'App ID', '1234567890123456', 'App secret')}`)
  + ig('TikTok', on(T.id && T.secret, T.connected ? 'Connected' : 'Ready', 'Not set up'), `<p class="ig-d">Your own TikTok account, for posting from <a href="#social">Social</a>. Businesses don’t use this.</p>
<ol class="ig-steps"><li>On <a href="https://developers.tiktok.com/apps/" target="_blank" rel="noopener">TikTok for Developers</a>, create an app with <strong>Login Kit</strong> and the <strong>Content Posting API</strong> (with Direct Post on), and the scopes <code>user.info.basic</code>, <code>video.publish</code> and <code>video.upload</code>.</li>
<li>In Login Kit, add this <strong>Redirect URI</strong> under Web:</li></ol>
${copy(T.redirectUri, 'TikTok redirect URI')}
<ol class="ig-steps" start="3"><li>Under URL properties, verify your domain. TikTok downloads your posts’ videos and photos from it.</li>
<li>Paste the app’s Client key and Client secret here. While testing, use the Sandbox keys; switch to the Production keys once TikTok approves the app. Or set <code>TIKTOK_CLIENT_KEY</code> and <code>TIKTOK_CLIENT_SECRET</code> in <code>.env</code>.</li></ol>
${form('tiktok', T, 'Client key', 'e.g. sbaw1234abcd5678', 'Client secret')}${I.localhost ? '<p class="muted ig-p">TikTok only sends people back to a public address: set <code>BASE_URL</code> (or <code>PLATFORM_DOMAIN</code>) first.</p>' : ''}`);
}
A.rmOauthApp = async (d) => {
  if (!confirm('Remove these keys? Businesses won’t be able to connect, and connected ones stop working until you add keys again.')) return;
  await api('DELETE', '/api/platform/oauth-apps/' + d.p); toast('Keys removed'); integrationsCard($('#integ'));
};
A.rmMailServer = async () => { if (!confirm('Stop sending through your mail server?')) return; await api('DELETE', '/api/platform/mail-server'); toast('Mail server removed'); integrationsCard($('#integ')); };
/* ===== Automations (lib/automations.js): emails to businesses by schedule and rules ===== */
let AU = null;
const AU_TZ = [['America/New_York', 'Eastern'], ['America/Chicago', 'Central'], ['America/Denver', 'Mountain'], ['America/Phoenix', 'Arizona'], ['America/Los_Angeles', 'Pacific']];
const auHour = (h) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
// "3 days after an account signs up", "1 day before…", "The day an account starts paying"
const AU_SAME_DAY = { signup: 'The day an account signs up', paid: 'The day an account starts paying', expiry: 'On an account’s last day of access', inactive: 'The day after anyone last logged in' };
const auWhen = (a) => (a.trigger === 'date' ? `On ${fmtDate(a.date)}` : !Number(a.days) ? AU_SAME_DAY[a.trigger] : `${a.days} ${Number(a.days) === 1 ? AU.triggers[a.trigger].replace('days', 'day') : AU.triggers[a.trigger]}`);
// ready-made starting points
const AU_STARTERS = {
  welcome: { name: 'Welcome tips', trigger: 'signup', days: 1, hour: 9, subject: 'Three quick wins in {{product}}', body: '# Welcome aboard, {{name}}\n\nHere are three things that get {{business}} running fast:\n\n**1. Add your first client.** Import them from a spreadsheet or add them one by one.\n\n**2. Send a quote.** Clients approve and sign it online.\n\n**3. Schedule the job.** Your team sees it on the calendar.\n\n[Open {{business}}]({{account_url}})' },
  setup: { name: 'Finish setting up', trigger: 'signup', days: 3, hour: 10, rules: { clientsMax: 0 }, subject: '{{name}}, your account is ready when you are', body: '# Let’s get {{business}} set up\n\nYou signed up a few days ago but haven’t added a client yet. It takes about two minutes, and our help center walks you through it.\n\n[Add your first client]({{account_url}}/clients)\n\nQuestions? Just reply to this email.' },
  inactive: { name: 'We miss you', trigger: 'inactive', days: 14, hour: 10, rules: { statuses: ['active'] }, subject: 'Anything we can help with, {{name}}?', body: '# It’s been a little while\n\nNo one from {{business}} has logged in for two weeks. If something got in the way, reply and tell us. We read every message.\n\n[Log in to {{business}}]({{account_url}})' },
  ending: { name: 'Last day reminder', trigger: 'expiry', days: 2, hour: 9, subject: 'Your {{product}} access ends in {{days_left}} days', body: '# Keep {{business}} running\n\nYour access ends in **{{days_left}} days**. Choose a plan to keep your clients, jobs and invoices.\n\n[Choose a plan]({{billing_url}})' },
  thanks: { name: 'Thanks for subscribing', trigger: 'paid', days: 0, hour: 11, subject: 'Thank you for choosing {{product}}', body: '# Thank you, {{name}}\n\nWe’re glad {{business}} is on the {{plan}} plan. If you ever need a hand, our help center has step-by-step guides.\n\n[Visit the help center]({{help_url}})' },
};
async function automationsView(main) {
  if (!AU) { main.innerHTML = '<p class="muted">Loading…</p>'; try { AU = await api('GET', '/api/platform/automations'); } catch (x) { main.innerHTML = `<div class="card">${esc(x.message)}</div>`; return; } }
  const summary = (a) => `${auWhen(a)} · ${auHour(a.hour)} ${(AU_TZ.find((z) => z[0] === a.tz) || [, a.tz])[1]}${a.weekdays ? ', weekdays' : ''} · to the ${a.to === 'admins' ? 'owner and admins' : 'owner'}`;
  const ruleText = (a) => { const r = a.rules || {}; const out = [];
    if (r.plans.length) out.push(r.plans.map((p) => (AU.plans.find((x) => x.id === p) || { name: p }).name).join(' or ') + ' plan');
    if (r.statuses.length) out.push(r.statuses.map((s) => AU.statuses[s]).join(' or '));
    if ((r.industries || []).length) out.push(r.industries.map((i) => (AU.industries.find((x) => x.slug === i) || { name: i }).name).join(' or '));
    for (const [k, l] of [['clients', 'clients'], ['jobs', 'jobs'], ['invoices', 'invoices']]) { const lo = r[k + 'Min']; const hi = r[k + 'Max']; if (lo !== '' && hi !== '') out.push(`${lo}–${hi} ${l}`); else if (lo !== '') out.push(`${lo}+ ${l}`); else if (hi !== '') out.push(hi === 0 ? `no ${l}` : `up to ${hi} ${l}`); }
    if (r.cards !== 'any') out.push(r.cards === 'yes' ? 'card payments set up' : 'no card payments'); if (r.confirmed !== 'any') out.push(r.confirmed === 'yes' ? 'email confirmed' : 'email not confirmed');
    return out.length ? out.join(' · ') : 'Every account'; };
  main.innerHTML = `<div class="au-top"><div><p class="sub" style="margin:0">Emails to businesses that send themselves, by time and rules. Checked every hour; each account gets each one once per event.${AU.optedOut ? ` ${AU.optedOut} ${AU.optedOut === 1 ? 'person has' : 'people have'} unsubscribed.` : ''}</p></div>
<div class="acts"><button type="button" class="btn alt" data-act="auRun" title="Check every automation now instead of waiting for the hourly run">Run now</button><button type="button" class="btn" data-act="auNew">New automation</button></div></div>
<div class="card"><h2>Your automations</h2>${AU.automations.length ? `<div class="au-list">${AU.automations.map((a) => `<div class="au-row ${a.enabled ? '' : 'off'}">
<label class="au-sw" title="${a.enabled ? 'On' : 'Off'}"><input type="checkbox" data-act="auToggle" data-id="${a.id}" ${a.enabled ? 'checked' : ''}><i></i></label>
<div class="au-main"><strong>${esc(a.name)}</strong><div class="sm">${esc(summary(a))}</div><div class="sm">Who: ${esc(ruleText(a))}</div></div>
<div class="au-stats"><div><b>${a.sentCount || 0}</b><span>sent</span></div>${a.enabled ? `<div><b>${a.waiting}</b><span>due now</span></div>` : ''}<div class="sm">${a.lastSentAt ? `Last ${fmtDate(a.lastSentAt.slice(0, 10))}` : 'Not sent yet'}</div></div>
<div class="acts"><button type="button" class="btn alt sm" data-act="auEdit" data-id="${a.id}">Edit</button><button type="button" class="btn danger sm" data-act="auDel" data-id="${a.id}">Delete</button></div></div>`).join('')}</div>`
    : '<p class="muted">No automations yet. Start with one of these:</p>'}
${AU.automations.length ? '' : `<div class="au-starters">${Object.entries(AU_STARTERS).map(([k, s]) => `<button type="button" class="au-starter" data-act="auNew" data-k="${k}"><strong>${esc(s.name)}</strong><span class="sm">${esc(auWhen(s))}</span></button>`).join('')}</div>`}</div>
<div class="card"><h2>Recently sent</h2>${AU.log.length ? `<div class="tablewrap"><table class="acc"><thead><tr><th>When</th><th>Automation</th><th>Business</th><th>To</th><th>Status</th></tr></thead><tbody>${AU.log.slice(0, 50).map((l) => `<tr><td class="sm">${esc(new Date(l.at).toLocaleString())}</td><td>${esc(l.automation)}</td><td>${esc(l.business)}</td><td class="sm">${esc(l.to)}</td><td><span class="cstatus ${l.status === 'sent' ? 'active' : l.status === 'failed' ? 'q-draft' : 'q-sent'}" title="${esc(l.detail)}">${esc(l.status === 'simulated' ? 'Not sent (email not set up)' : l.status)}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted" style="margin:0">Nothing sent yet.</p>'}</div>`;
}
A.auRun = async (d, el) => { el.disabled = true; try { AU = await api('POST', '/api/platform/automations/run'); toast('Checked every automation'); automationsView($('#automations')); } catch (x) { toast(x.message, true); el.disabled = false; } };
A.auToggle = async (d, el) => {
  const a = AU.automations.find((x) => x.id === d.id);
  if (el.checked && !confirm(`Turn on “${a.name}”? It starts sending at the next hourly check${a.catchUp ? ', including to accounts already past this point' : ''}.`)) { el.checked = false; return; }
  try { AU = await api('POST', `/api/platform/automations/${d.id}/enable`, { on: el.checked }); toast(el.checked ? 'Automation on' : 'Automation off'); automationsView($('#automations')); } catch (x) { el.checked = !el.checked; toast(x.message, true); }
};
A.auDel = async (d) => { const a = AU.automations.find((x) => x.id === d.id); if (!confirm(`Delete “${a.name}”? Its send history stays in the log.`)) return; AU = await api('DELETE', '/api/platform/automations/' + d.id); toast('Automation deleted'); automationsView($('#automations')); };
A.auNew = (d) => auEditor({ trigger: 'signup', days: 1, hour: 9, tz: 'America/Chicago', to: 'owner', rules: {}, ...(d.k ? structuredClone(AU_STARTERS[d.k]) : { name: '', subject: '', body: '' }) });
A.auEdit = (d) => auEditor(structuredClone(AU.automations.find((x) => x.id === d.id)));
function auEditor(a) {
  const r = { plans: [], statuses: [], clientsMin: '', clientsMax: '', jobsMin: '', jobsMax: '', invoicesMin: '', invoicesMax: '', cards: 'any', confirmed: 'any', ...(a.rules || {}) };
  const opt = (v, cur, l) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`;
  const range = (k, l) => `<div class="au-range"><span>${l}</span><input type="number" min="0" name="${k}Min" value="${esc(r[k + 'Min'])}" placeholder="any" aria-label="${l} at least"><span>to</span><input type="number" min="0" name="${k}Max" value="${esc(r[k + 'Max'])}" placeholder="any" aria-label="${l} at most"></div>`;
  const m = modal(a.id ? `Edit “${a.name}”` : 'New automation', `<form id="auf" class="au-form">
${a.id ? '' : `<label>Start from<select id="auStart"><option value="">Blank</option>${Object.entries(AU_STARTERS).map(([k, s]) => opt(k, '', s.name)).join('')}</select></label>`}
<label>Name (only you see it)<input name="name" required maxlength="80" value="${esc(a.name || '')}" placeholder="e.g. Welcome tips"></label>
<h3 class="au-h">When</h3>
<div class="row"><label>Trigger<select name="trigger">${Object.entries(AU.triggers).map(([k, l]) => opt(k, a.trigger, k === 'date' ? 'On a date (one time)' : l.replace(/^days /, '').replace(/^./, (c) => c.toUpperCase()))).join('')}</select></label>
<label class="au-days">Days<input type="number" name="days" min="0" max="3650" value="${esc(a.days ?? 1)}"></label><label class="au-date">Date<input type="date" name="date" value="${esc(a.date || '')}"></label></div>
<div class="row"><label>Send at<select name="hour">${Array.from({ length: 24 }, (_, i) => opt(i, a.hour ?? 9, auHour(i))).join('')}</select></label><label>Time zone<select name="tz">${AU_TZ.map(([z, l]) => opt(z, a.tz || 'America/Chicago', l)).join('')}</select></label></div>
<label class="switchline"><input type="checkbox" name="weekdays" ${a.weekdays ? 'checked' : ''}> Weekdays only (waits for Monday)</label>
<label class="switchline au-catch"><input type="checkbox" name="catchUp" ${a.catchUp ? 'checked' : ''}> Also send to accounts already past this point when it’s turned on</label>
<h3 class="au-h">Who</h3>
<div class="row"><label>Send to<select name="to">${opt('owner', a.to, 'The account owner')}${opt('admins', a.to, 'The owner and admins')}</select></label><div></div></div>
<div class="au-checks"><span>Plans</span>${AU.plans.map((p) => `<label><input type="checkbox" name="plans" value="${esc(p.id)}" ${r.plans.includes(p.id) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('')}<em>none ticked = all plans</em></div>
<div class="au-checks"><span>Status</span>${Object.entries(AU.statuses).map(([k, l]) => `<label><input type="checkbox" name="statuses" value="${k}" ${r.statuses.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}<em>none ticked = any status</em></div>
<div class="au-checks"><span>Industry</span>${AU.industries.map((i) => `<label><input type="checkbox" name="industries" value="${esc(i.slug)}" ${(r.industries || []).includes(i.slug) ? 'checked' : ''}> ${esc(i.name)}</label>`).join('')}<em>none ticked = any industry</em></div>
${range('clients', 'Clients')}${range('jobs', 'Jobs')}${range('invoices', 'Invoices')}
<div class="row"><label>Card payments<select name="cards">${opt('any', r.cards, 'Any')}${opt('yes', r.cards, 'Set up')}${opt('no', r.cards, 'Not set up')}</select></label><label>Owner’s email<select name="confirmed">${opt('any', r.confirmed, 'Any')}${opt('yes', r.confirmed, 'Confirmed')}${opt('no', r.confirmed, 'Not confirmed')}</select></label></div>
<h3 class="au-h">Email</h3>
<label>Subject<input name="subject" required maxlength="200" value="${esc(a.subject || '')}"></label>
<label>Message<textarea name="body" rows="10" required>${esc(a.body || '')}</textarea></label>
<div class="au-vars"><span class="sm">Insert:</span>${['product', ...Object.keys(AU.vars)].map((v) => `<button type="button" class="au-var" data-act="auVar" data-v="${v}" title="${esc(v === 'product' ? 'Your product name' : AU.vars[v])}">{{${v}}}</button>`).join('')}</div>
<p class="muted" style="font-size:12px;margin:4px 0 10px"><code># </code>starts a heading, <code>**bold**</code>, and a line with just <code>[Button text](link)</code> becomes a button. An unsubscribe link is added at the end.</p>
<div id="auPreview"></div>
<div class="acts au-foot"><button type="button" class="btn alt" data-act="auWho">Who gets it?</button><button type="button" class="btn alt" data-act="auTest">Send me a test</button><span style="flex:1"></span><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`, { wide: true, sticky: true });
  const f = $('#auf', m); f.dataset.id = a.id || '';
  const showWhen = () => { const t = f.trigger.value; $('.au-days', f).hidden = t === 'date'; $('.au-date', f).hidden = t !== 'date'; $('.au-catch', f).hidden = t === 'date'; };
  f.trigger.addEventListener('change', showWhen); showWhen();
  const st = $('#auStart', f); if (st) st.addEventListener('change', () => { if (st.value) auEditor({ trigger: 'signup', days: 1, hour: 9, tz: 'America/Chicago', to: 'owner', rules: {}, ...structuredClone(AU_STARTERS[st.value]) }); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const b = auRead(f);
    try { AU = await api(a.id ? 'PUT' : 'POST', a.id ? `/api/platform/automations/${a.id}` : '/api/platform/automations', b); closeModal(); toast(a.id ? 'Automation saved' : 'Automation saved. Turn it on when you’re ready.'); automationsView($('#automations')); } catch (x) { toast(x.message, true); }
  });
}
function auRead(f) {
  const fd = new FormData(f); const g = (k) => fd.get(k);
  return { id: f.dataset.id || undefined, name: g('name'), trigger: g('trigger'), days: g('days'), date: g('date'), hour: g('hour'), tz: g('tz'), weekdays: !!g('weekdays'), catchUp: !!g('catchUp'), to: g('to'), subject: g('subject'), body: g('body'),
    rules: { plans: fd.getAll('plans'), statuses: fd.getAll('statuses'), industries: fd.getAll('industries'), clientsMin: g('clientsMin'), clientsMax: g('clientsMax'), jobsMin: g('jobsMin'), jobsMax: g('jobsMax'), invoicesMin: g('invoicesMin'), invoicesMax: g('invoicesMax'), cards: g('cards'), confirmed: g('confirmed') } };
}
A.auVar = (d) => { const ta = $('#auf [name=body]'); const s = ta.selectionStart; const ins = `{{${d.v}}}`; ta.value = ta.value.slice(0, s) + ins + ta.value.slice(ta.selectionEnd); ta.focus(); ta.selectionStart = ta.selectionEnd = s + ins.length; };
A.auWho = async () => {
  const box = $('#auPreview'); box.innerHTML = '<p class="muted">Checking accounts…</p>';
  try {
    const L = await api('POST', '/api/platform/automations/preview', auRead($('#auf'))); const ready = L.filter((x) => x.ready); const done = L.filter((x) => x.sent); const later = L.filter((x) => !x.ready && !x.sent);
    box.innerHTML = `<div class="au-who"><strong>${L.length} account${L.length === 1 ? '' : 's'} match the rules</strong>: ${ready.length} due now, ${later.length} later or already past, ${done.length} already sent.
${L.length ? `<ul>${L.slice(0, 12).map((x) => `<li>${esc(x.business)} <span class="sm">${esc(x.plan)} · ${x.sent ? 'sent' : x.ready ? 'due now' : `due ${fmtDate(x.due)}`} · ${x.to.length ? esc(x.to.join(', ')) : 'no one to email'}</span></li>`).join('')}${L.length > 12 ? `<li class="sm">and ${L.length - 12} more</li>` : ''}</ul>` : ''}</div>`;
  } catch (x) { box.innerHTML = `<p class="msg err">${esc(x.message)}</p>`; }
};
A.auTest = async (d, el) => {
  el.disabled = true; try { const r = await api('POST', '/api/platform/automations/test', auRead($('#auf'))); toast(r.status === 'sent' ? `Test sent to ${D.admin.email} (filled in with ${r.example})` : `Not sent: ${r.detail || r.status}`, r.status !== 'sent'); } catch (x) { toast(x.message, true); } el.disabled = false;
};

/* ===== actions ===== */
A.closeModal = closeModal;

/* ===== help center: articles, topics, home page and feedback (help.<platform domain>) ===== */
let HC = null; let hcSort = { k: 'order', dir: 1 }; let hcTopic = ''; let hcQ = ''; let hcPage = 1;
const HC_PER_PAGE = 10; // articles per page in the list
const hcLoad = async () => { HC = await api('GET', '/api/platform/help'); };
const hcFill = (s) => String(s).replace(/\{product\}/g, D.settings.productName); // {product} in articles becomes the product name
const hcStats = (slug) => { const f = HC.feedback[slug] || { yes: 0, no: 0 }; const n = f.yes + f.no; return { ...f, n, pct: n ? Math.round((f.yes / n) * 100) : null }; };
const hcTopicName = (slug) => (HC.topics.find((t) => t.slug === slug) || {}).title || slug;
const hcSlugify = (s) => String(s || '').toLowerCase().replace(/\{product\}/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
// one part at a time: Articles (with what readers were looking for), Topics, Home page
let hcTab = 'articles';
// Help Center's tabs: the articles' three parts (#help) and the Forum (#forum)
const helpSeg = () => sideNav('Help Center', 'hcTab', [['articles', 'Articles', HC ? HC.comments.length : 0, 'What people were looking for'], ['topics', 'Topics'], ['home', 'Home page'], ['forum', 'Forum', D.forumNew, 'New posts']]
  .map(([k, l, n, title]) => [k, l, n || undefined, tab === 'forum' ? k === 'forum' : hcTab === k, title]));
A.hcTab = (d) => {
  if (d.k === 'forum') { if (tab === 'forum') A.frBack(); else location.hash = 'forum'; return; }
  hcTab = d.k; if (tab === 'help') helpView($('#main')); else location.hash = 'help';
};
async function helpView(main) {
  if (!HC) { main.innerHTML = '<p class="muted">Loading…</p>'; try { await hcLoad(); } catch (x) { main.innerHTML = `<div class="card">${esc(x.message)}</div>`; return; } }
  const all = HC.articles.map((a, i) => ({ ...a, i, ...hcStats(a.slug) }));
  const votes = all.reduce((s, a) => s + a.n, 0); const yes = all.reduce((s, a) => s + a.yes, 0);
  const q = hcQ.toLowerCase();
  const rows = all.filter((a) => (!hcTopic || a.topic === hcTopic) && (!q || `${a.title} ${a.slug} ${a.summary}`.toLowerCase().includes(q)));
  const key = { order: (a) => a.i, title: (a) => hcFill(a.title).toLowerCase(), yes: (a) => a.yes, no: (a) => a.no, helpful: (a) => (a.pct === null ? -1 : a.pct) }[hcSort.k];
  rows.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : a.i - b.i) * hcSort.dir);
  const th = (k, l, cls = '') => `<th class="${cls}"><button type="button" class="hc-sort${hcSort.k === k ? ' on' : ''}" data-act="hcSort" data-k="${k}">${l}${hcSort.k === k ? (hcSort.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`;
  const canMove = hcSort.k === 'order' && hcSort.dir === 1 && !q;
  const pages = Math.max(1, Math.ceil(rows.length / HC_PER_PAGE)); hcPage = Math.min(Math.max(1, hcPage), pages);
  const from = (hcPage - 1) * HC_PER_PAGE; const shown = rows.slice(from, from + HC_PER_PAGE);
  const pager = rows.length > HC_PER_PAGE ? `<nav class="hc-pager" aria-label="Article pages"><span class="sm">Showing ${from + 1}–${from + shown.length} of ${rows.length}</span><div class="acts">
<button type="button" class="btn alt sm" data-act="hcPage" data-p="${hcPage - 1}" ${hcPage > 1 ? '' : 'disabled'}>‹ Previous</button>${Array.from({ length: pages }, (_, i) => `<button type="button" class="btn sm ${i + 1 === hcPage ? '' : 'alt'}" data-act="hcPage" data-p="${i + 1}" ${i + 1 === hcPage ? 'aria-current="page"' : ''} aria-label="Page ${i + 1}">${i + 1}</button>`).join('')}
<button type="button" class="btn alt sm" data-act="hcPage" data-p="${hcPage + 1}" ${hcPage < pages ? '' : 'disabled'}>Next ›</button></div></nav>` : `<p class="sm" style="margin:10px 0 0">${rows.length} article${rows.length === 1 ? '' : 's'}</p>`;
  main.innerHTML = `<div class="head"><div><h1>Help Center</h1><p class="sub" style="margin:4px 0 0">Articles at <a href="${esc(HC.helpUrl)}" target="_blank" rel="noopener">${esc(host(HC.helpUrl))}</a>. Changes go live as soon as you save. Write <code>{product}</code> for the product name.</p></div><button class="btn" data-act="hcEdit">New article</button></div>
${helpSeg()}
<div class="stats"><div class="card"><div class="l">Articles</div><div class="v">${all.length}</div></div><div class="card"><div class="l">Topics</div><div class="v">${HC.topics.length}</div></div>
<div class="card"><div class="l">Votes</div><div class="v">${votes}</div></div><div class="card"><div class="l">Found it helpful</div><div class="v">${votes ? Math.round((yes / votes) * 100) + '%' : '—'}</div></div></div>
<div class="card" data-hc="articles"><h2>Articles</h2><div class="hc-tools"><select id="hcTopic" aria-label="Filter by topic"><option value="">All topics</option>${HC.topics.map((t) => `<option value="${esc(t.slug)}" ${t.slug === hcTopic ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select>
<input id="hcQ" type="search" placeholder="Search articles" value="${esc(hcQ)}" aria-label="Search articles"><span class="sm">Sort by Helpful to find the articles that need work first.</span></div>
<div class="tablewrap"><table class="acc hc-table"><thead><tr>${th('order', 'Article')}<th>Topic</th>${th('yes', '👍 Yes', 'r')}${th('no', '👎 No', 'r')}${th('helpful', 'Helpful', 'r')}<th></th></tr></thead><tbody>
${shown.map((a) => `<tr><td><button type="button" class="hc-link" data-act="hcEdit" data-slug="${esc(a.slug)}">${esc(hcFill(a.title))}</button><div class="sm">/articles/${esc(a.slug)}${HC.popular.includes(a.slug) ? ' · <span class="pf-chip">Popular</span>' : ''}</div></td>
<td class="sm">${esc(hcTopicName(a.topic))}</td><td class="r">${a.yes}</td><td class="r">${a.no}</td>
<td class="r">${a.pct === null ? '<span class="sm">No votes</span>' : `<span class="hc-pct ${a.pct >= 70 ? 'ok' : a.pct >= 40 ? 'mid' : 'bad'}">${a.pct}%</span>`}</td>
<td><div class="acts">${canMove ? `<button type="button" class="btn alt sm" data-act="hcMove" data-slug="${esc(a.slug)}" data-dir="up" aria-label="Move up" title="Move up in its topic">↑</button><button type="button" class="btn alt sm" data-act="hcMove" data-slug="${esc(a.slug)}" data-dir="down" aria-label="Move down" title="Move down in its topic">↓</button>` : ''}<a class="btn alt sm" href="${esc(HC.helpUrl)}/articles/${esc(a.slug)}" target="_blank" rel="noopener">View</a></div></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No articles match.</td></tr>'}
</tbody></table></div>${pager}</div>
<div class="card" data-hc="articles"><h2>What people were looking for</h2><p class="muted" style="font-size:13px;margin-top:0">After voting No, readers can say what was missing. Use it to improve the article.</p>
${HC.comments.length ? `<div class="inq-list">${HC.comments.slice(0, 50).map((c) => `<div class="inq"><div class="inq-h"><div><button type="button" class="hc-link" data-act="hcEdit" data-slug="${esc(c.slug)}">${esc(hcFill((HC.articles.find((a) => a.slug === c.slug) || { title: c.slug }).title))}</button><div class="sm">${esc(new Date(c.at).toLocaleString())}</div></div>
<button type="button" class="btn alt sm" data-act="hcRmComment" data-id="${esc(c.id)}">Delete</button></div><p class="inq-m">${esc(c.text)}</p></div>`).join('')}</div>` : '<p class="muted">Nothing yet.</p>'}</div>
<div class="hc-one"><div class="card" data-hc="topics"><h2>Topics</h2><p class="muted" style="font-size:13px;margin-top:0">The cards on the help center’s home page, in this order. A topic can only be removed once it has no articles.</p><form id="hcTopics"><div id="hcTopicRows"></div>
<div class="foot" style="justify-content:space-between"><button type="button" class="btn alt sm" data-act="hcAddTopic">Add topic</button><button class="btn">Save topics</button></div></form></div>
<div class="card" data-hc="home"><h2>Home page</h2><form id="hcHome"><h3 class="hc-h3">Popular articles</h3>${[0, 1, 2].map((i) => `<label class="sr" for="pop${i}">Popular article ${i + 1}</label><select id="pop${i}" name="popular" style="margin-bottom:8px"><option value="">None</option>${HC.articles.map((a) => `<option value="${esc(a.slug)}" ${HC.popular[i] === a.slug ? 'selected' : ''}>${esc(hcFill(a.title))}</option>`).join('')}</select>`).join('')}
<h3 class="hc-h3">Suggested searches</h3><p class="muted" style="font-size:13px;margin:0 0 8px">Shown under the search box, such as “How do I invite my team?”</p>${[0, 1, 2, 3, 4].map((i) => `<input name="suggested" maxlength="100" value="${esc(HC.suggested[i] || '')}" aria-label="Suggested search ${i + 1}" style="margin-bottom:8px">`).join('')}
<div class="foot"><button class="btn">Save home page</button></div></form></div></div>`;
  sideLayout(main);
  $$('[data-hc]', main).forEach((c) => { c.hidden = c.dataset.hc !== hcTab; });
  $('#hcTopic', main).addEventListener('change', (e) => { hcTopic = e.target.value; hcPage = 1; helpView(main); });
  let t; $('#hcQ', main).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { hcQ = e.target.value; hcPage = 1; helpView(main); $('#hcQ').focus(); $('#hcQ').setSelectionRange(hcQ.length, hcQ.length); }, 200); });
  hcDrawTopics(HC.topics.map((x) => ({ ...x, was: x.slug })));
  $('#hcTopics', main).addEventListener('submit', async (e) => { e.preventDefault(); try { HC = await api('PUT', '/api/platform/help/topics', { topics: hcReadTopics() }); toast('Topics saved'); helpView(main); } catch (x) { toast(x.message, true); } });
  $('#hcHome', main).addEventListener('submit', async (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    try { HC = await api('PUT', '/api/platform/help/home', { popular: f.getAll('popular').filter(Boolean), suggested: f.getAll('suggested') }); toast('Home page saved'); helpView(main); } catch (x) { toast(x.message, true); }
  });
}
// topics editor: one row per topic, with up/down and remove
const hcReadTopics = () => $$('#hcTopicRows .hc-trow').map((r) => ({ was: r.dataset.was || '', title: $('[name=title]', r).value, slug: $('[name=slug]', r).value, icon: $('[name=icon]', r).value, desc: $('[name=desc]', r).value }));
function hcDrawTopics(list) {
  const box = $('#hcTopicRows'); const count = (s) => HC.articles.filter((a) => a.topic === s).length;
  box.innerHTML = list.map((t, i) => `<div class="hc-trow" data-was="${esc(t.was || '')}"><div class="hc-tgrid"><input name="title" value="${esc(t.title)}" placeholder="Topic name" maxlength="80" aria-label="Topic name" required>
<select name="icon" aria-label="Icon">${HC.icons.map((ic) => `<option ${ic === t.icon ? 'selected' : ''}>${ic}</option>`).join('')}</select>
<div class="acts"><button type="button" class="btn alt sm" data-act="hcTopicMove" data-i="${i}" data-dir="-1" aria-label="Move up" ${i ? '' : 'disabled'}>↑</button><button type="button" class="btn alt sm" data-act="hcTopicMove" data-i="${i}" data-dir="1" aria-label="Move down" ${i < list.length - 1 ? '' : 'disabled'}>↓</button><button type="button" class="btn alt sm" data-act="hcTopicRm" data-i="${i}" ${t.was && count(t.was) ? `disabled title="Has ${count(t.was)} articles"` : ''}>Remove</button></div></div>
<input name="desc" value="${esc(t.desc)}" placeholder="Short description" maxlength="300" aria-label="Description"><div class="sm">/topics/<input name="slug" class="hc-slug" value="${esc(t.slug)}" maxlength="60" aria-label="Topic web address"> · ${t.was ? `${count(t.was)} article${count(t.was) === 1 ? '' : 's'}` : 'new'}</div></div>`).join('');
}
A.hcAddTopic = () => { const l = hcReadTopics(); l.push({ title: '', slug: '', icon: 'help', desc: '' }); hcDrawTopics(l); $$('#hcTopicRows [name=title]').pop().focus(); };
A.hcTopicRm = (d) => { const l = hcReadTopics(); l.splice(Number(d.i), 1); hcDrawTopics(l); };
A.hcTopicMove = (d) => { const l = hcReadTopics(); const i = Number(d.i); const j = i + Number(d.dir); [l[i], l[j]] = [l[j], l[i]]; hcDrawTopics(l); };
A.hcPage = (d) => { hcPage = Number(d.p); helpView($('#main')); $('.hc-table').scrollIntoView({ block: 'nearest' }); };
A.hcSort = (d) => { hcPage = 1; hcSort = hcSort.k === d.k ? { k: d.k, dir: -hcSort.dir } : { k: d.k, dir: d.k === 'order' || d.k === 'title' ? 1 : d.k === 'helpful' ? 1 : -1 }; helpView($('#main')); };
A.hcMove = async (d) => { try { HC = await api('POST', `/api/platform/help/articles/${encodeURIComponent(d.slug)}/move`, { dir: d.dir }); helpView($('#main')); } catch (x) { toast(x.message, true); } };
A.hcRmComment = async (d) => { if (!confirm('Delete this comment?')) return; try { HC = await api('DELETE', `/api/platform/help/comments/${encodeURIComponent(d.id)}`); helpView($('#main')); } catch (x) { toast(x.message, true); } };
// the article editor: fields, the body as HTML, and a preview
A.hcEdit = (d) => {
  const a = HC.articles.find((x) => x.slug === d.slug) || null; const s = a ? hcStats(a.slug) : null;
  const mine = a ? HC.comments.filter((c) => c.slug === a.slug) : [];
  const m = modal(a ? 'Edit article' : 'New article', `<form id="hcf">
${a ? `<div class="hc-fb">👍 ${s.yes} · 👎 ${s.no} · ${s.pct === null ? 'no votes yet' : `${s.pct}% found it helpful`}${mine.length ? ` · ${mine.length} comment${mine.length === 1 ? '' : 's'}` : ''}${s.n || mine.length ? ' <button type="button" class="linkish" data-act="hcReset">Reset</button>' : ''}</div>` : ''}
<label>Title<input name="title" required maxlength="150" value="${esc(a ? a.title : '')}"></label>
<div class="pr-pair"><label>Topic<select name="topic" required>${HC.topics.map((t) => `<option value="${esc(t.slug)}" ${(a ? a.topic : hcTopic) === t.slug ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></label>
<label>Web address<div class="hc-addr"><span>/articles/</span><input name="slug" required maxlength="80" value="${esc(a ? a.slug : '')}" spellcheck="false"></div></label></div>
<label>Summary <span class="sm">(one line, shown in lists and search)</span><input name="summary" required maxlength="300" value="${esc(a ? a.summary : '')}"></label>
<label>Search keywords <span class="sm">(other words people might search for)</span><input name="keywords" maxlength="300" value="${esc(a ? a.keywords || '' : '')}"></label>
<div class="hc-bodyhead"><span>Article</span><div class="hc-seg" role="group" aria-label="Editor view"><button type="button" class="on" data-v="visual" aria-pressed="true">Visual</button><button type="button" data-v="html" aria-pressed="false">HTML</button></div></div>
<div class="hc-rte"></div>
<textarea name="body" class="hc-body" rows="18" spellcheck="false" aria-label="Article body (HTML)" hidden>${esc(a ? a.body : '<p>Start with a sentence on what this article helps with.</p>\n<h2>Steps</h2>\n<ol class="steps"><li>First step.</li><li>Second step.</li></ol>\n<div class="tip">A helpful tip.</div>')}</textarea>
<details class="hc-cheat hc-htmlhelp" hidden><summary>HTML formatting</summary><ul><li><code>&lt;h2&gt;Section&lt;/h2&gt;</code> and <code>&lt;p&gt;Paragraph&lt;/p&gt;</code></li><li><code>&lt;ol class="steps"&gt;&lt;li&gt;…&lt;/li&gt;&lt;/ol&gt;</code> numbered steps; <code>&lt;ul&gt;</code> for bullets</li>
<li><code>&lt;div class="note"&gt;…&lt;/div&gt;</code> and <code>&lt;div class="tip"&gt;…&lt;/div&gt;</code> callouts</li><li><code>&lt;strong&gt;</code> for button and menu names; <code>&lt;kbd&gt;/&lt;/kbd&gt;</code> for keys</li><li>Link to another article: <code>&lt;a href="/articles/first-steps"&gt;First steps&lt;/a&gt;</code></li><li><code>{product}</code> becomes “${esc(D.settings.productName)}”</li></ul></details>
${mine.length ? `<details class="hc-cheat"><summary>What people were looking for (${mine.length})</summary>${mine.slice(0, 20).map((c) => `<p class="inq-m">${esc(c.text)} <span class="sm">· ${esc(new Date(c.at).toLocaleDateString())}</span></p>`).join('')}</details>` : ''}
<div class="foot" style="justify-content:space-between">${a ? '<button type="button" class="btn danger" data-act="hcDelete">Delete</button>' : '<span></span>'}<div style="display:flex;gap:8px"><button type="button" class="btn alt" data-act="hcCancel">Cancel</button><button class="btn">${a ? 'Save' : 'Publish'}</button></div></div></form>`, { wide: true, sticky: true });
  const f = $('#hcf', m); m.dataset.slug = a ? a.slug : ''; let dirty = false; let slugTouched = !!a;
  f.addEventListener('input', (e) => { dirty = true; if (e.target.name === 'slug') slugTouched = true; if (e.target.name === 'title' && !slugTouched) f.slug.value = hcSlugify(f.title.value); });
  m.hcDirty = () => dirty;
  m.hcDestroy = () => ed.destroy();
  // Visual: the formatting bar (public/hc-editor.js); HTML: the raw article, for anything the bar doesn't do
  const ed = window.hcEditor.create($('.hc-rte', m), { html: f.body.value, articles: HC.articles.filter((x) => !a || x.slug !== a.slug).map((x) => ({ slug: x.slug, title: hcFill(x.title) })), onChange: () => { dirty = true; } });
  let visual = true;
  $('.hc-seg', m).addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b || (b.dataset.v === 'visual') === visual) return;
    visual = b.dataset.v === 'visual';
    if (visual) ed.set(f.body.value); else f.body.value = ed.html();
    $$('.hc-seg button', m).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    $('.hc-rte', m).hidden = !visual; f.body.hidden = visual; $('.hc-htmlhelp', m).hidden = visual;
    (visual ? ed : f.body).focus();
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('.foot .btn:not(.alt):not(.danger)', f); btn.disabled = true;
    if (visual) f.body.value = ed.html();
    const body = Object.fromEntries(new FormData(f));
    try {
      HC = a ? await api('PUT', `/api/platform/help/articles/${encodeURIComponent(a.slug)}`, body) : await api('POST', '/api/platform/help/articles', body);
      ed.destroy(); closeModal(); toast(a ? 'Article saved' : 'Article published'); helpView($('#main'));
    } catch (x) { btn.disabled = false; toast(x.message, true); }
  });
  f.title.focus();
};
A.hcCancel = (d, el) => { const m = el.closest('.pf-modal'); if (m.hcDirty && m.hcDirty() && !confirm('Discard your changes to this article?')) return; if (m.hcDestroy) m.hcDestroy(); closeModal(); };
A.hcDelete = async (d, el) => {
  const slug = el.closest('.pf-modal').dataset.slug; const a = HC.articles.find((x) => x.slug === slug);
  if (!confirm(`Delete “${hcFill(a.title)}”? Links to /articles/${slug} will stop working, and its votes are kept until you reset them.`)) return;
  try { HC = await api('DELETE', `/api/platform/help/articles/${encodeURIComponent(slug)}`); closeModal(); toast('Article deleted'); helpView($('#main')); } catch (x) { toast(x.message, true); }
};
A.hcReset = async (d, el) => {
  const slug = el.closest('.pf-modal').dataset.slug; if (!confirm('Reset this article’s votes and comments to zero?')) return;
  try { HC = await api('POST', `/api/platform/help/articles/${encodeURIComponent(slug)}/reset-feedback`, {}); toast('Feedback reset'); el.closest('.hc-fb').textContent = '👍 0 · 👎 0 · no votes yet'; helpView($('#main')); } catch (x) { toast(x.message, true); }
};
// change your own email (top bar → your name): password, then a code sent to the new address
A.myEmail = () => {
  $$('details.pf-menu[open]').forEach((m) => { m.open = false; });
  const m = modal('Change your email', `<form id="mef"><p class="muted" style="margin-top:0">You log in with <strong>${esc(D.admin.email)}</strong>. We’ll send a code to the new address to make sure it’s yours.</p>
<label>New email<input name="email" type="email" required autocomplete="email"></label>
<label>Your password<input name="password" type="password" required autocomplete="current-password"></label>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Send code</button></div></form>`);
  $('#mef', m).addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); const btn = $('button.btn:not(.alt)', e.target); btn.disabled = true;
    try { const r = await api('POST', '/api/platform/me/email', b); myEmailCode(r.email); } catch (x) { btn.disabled = false; toast(x.message, true); }
  });
};
function myEmailCode(email) {
  const m = modal('Enter the code', `<form id="mec"><p class="muted" style="margin-top:0">We sent a 6-digit code to <strong>${esc(email)}</strong>. It works for 15 minutes.</p>
<label>Code<input name="code" required inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" placeholder="123456" class="pf-code"></label>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Change email</button></div></form>`);
  $('#mec', m).addEventListener('submit', async (e) => {
    e.preventDefault(); const code = new FormData(e.target).get('code'); const btn = $('button.btn:not(.alt)', e.target); btn.disabled = true;
    try {
      const r = await api('POST', '/api/platform/me/email/verify', { code }); const old = D.admin.email; D.admin.email = r.email; closeModal(); render(); toast(`You now log in with ${r.email}`);
      // your contact email in Settings was the old address: offer to switch it too
      if (r.contactEmailWas) {
        modal('Update your contact email too?', `<p>Your contact email in Settings (where new sign-ups, messages and chats are sent) is still <strong>${esc(old)}</strong>.</p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Keep it</button><button type="button" class="btn" data-act="useNewContact">Use ${esc(r.email)}</button></div>`);
        A.useNewContact = async () => { try { await api('PUT', '/api/platform/settings', { contactEmail: r.email }); await load(); closeModal(); render(); toast('Contact email updated'); } catch (x) { toast(x.message, true); } };
      }
    } catch (x) { btn.disabled = false; toast(x.message, true); if (/Start again/.test(x.message)) closeModal(); }
  });
}
// change your own password (top bar → your name)
A.myPassword = () => {
  $$('details.pf-menu[open]').forEach((m) => { m.open = false; });
  const m = modal('Change your password', `<form id="mpf"><label>Current password<input name="current" type="password" required autocomplete="current-password"></label>
<label>New password (10+ characters)<input name="password" type="password" required minlength="10" autocomplete="new-password"></label>
<label>Type the new password again<input name="again" type="password" required minlength="10" autocomplete="new-password"></label>
<p class="muted" style="font-size:13px;margin:0">You stay logged in here; any other devices are logged out.</p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Change password</button></div></form>`);
  $('#mpf', m).addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target));
    if (b.password !== b.again) return toast('The new passwords don’t match', true);
    try { await api('PUT', '/api/platform/me/password', { current: b.current, password: b.password }); closeModal(); toast('Password changed'); } catch (x) { toast(x.message, true); }
  });
};
document.addEventListener('click', (e) => { $$('details.pf-menu[open]').forEach((m) => { if (!m.contains(e.target)) m.open = false; }); });
A.logout = async () => { await api('POST', '/api/platform/logout', {}); D = null; draftPlans = null; draftBeta = null; boot(); };
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = A[el.dataset.act]; if (!fn) return; e.preventDefault();
  Promise.resolve(fn(el.dataset, el)).catch((x) => toast(x.message, true));
});

async function boot() {
  const state = await api('GET', '/api/platform/state');
  const invite = new URLSearchParams(location.search).get('invite'); if (invite) return inviteView(invite, state);
  if (!state.admin) { document.title = 'Alpha'; return authView(state); }
  await load(); tab = tabFromHash(); render();
}
boot();

/* ===== Forum (lib/forum.js): issues and feature requests from businesses' owners and admins.
   Set a post's status (with an optional note, posted as a team reply), pin or lock it, reply as the team, delete posts and comments. ===== */
let FR = null; let frSel = ''; const frView = { kind: 'all', status: '', sort: 'new', q: '' };
const frAgo = (iso) => { const s = (Date.now() - new Date(iso)) / 1000; return s < 3600 ? `${Math.max(1, Math.floor(s / 60))} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : fmtDate(iso); };
const frWho = (a) => (!a ? '' : a.team ? `<span class="fr-team">${esc(D.settings.productName)} team</span> <span class="muted">(${esc(a.name)})</span>`
  : `<strong>${esc(a.name)}</strong> · ${a.account ? `<a href="${esc(a.account)}" target="_blank" rel="noopener">${esc(a.company)}</a>` : esc(a.company)} · <span class="muted">${esc(a.role)} · <a href="mailto:${esc(a.email)}">${esc(a.email)}</a></span>`);
const frChip = (cls, l) => `<span class="fr-chip ${cls}">${esc(l)}</span>`;
async function forumView(main) {
  if (!FR) { main.innerHTML = `<div class="head"><h1>Help Center</h1></div>${helpSeg()}<p class="muted">Loading…</p>`; sideLayout(main); try { FR = await api('GET', '/api/platform/forum'); } catch (e) { main.innerHTML = `<div class="head"><h1>Help Center</h1></div>${helpSeg()}<p class="muted">${esc(e.message)}</p>`; sideLayout(main); return; } }
  D.forumNew = FR.posts.filter((p) => p.status === 'open').length;
  const p = frSel && FR.posts.find((x) => x.id === frSel); if (!p) frSel = '';
  return p ? frPost(main, p) : frList(main);
}
function frList(main) {
  const v = frView; const K = FR.kinds; const S = FR.statuses; const s = FR.settings; const q = v.q.trim().toLowerCase();
  const list = FR.posts.filter((p) => (v.kind === 'all' || p.kind === v.kind) && (!v.status || p.status === v.status)
    && (!q || [p.title, p.body, p.author.name, p.author.company, p.author.email].join(' ').toLowerCase().includes(q)));
  const by = { new: (a, b) => b.at.localeCompare(a.at), top: (a, b) => b.likes - a.likes || b.at.localeCompare(a.at), active: (a, b) => b.lastAt.localeCompare(a.lastAt), talk: (a, b) => b.comments.length - a.comments.length };
  list.sort(by[v.sort]);
  const n = (f) => FR.posts.filter(f).length;
  main.innerHTML = `<div class="head"><div><h1>Help Center</h1><p class="sub" style="margin:4px 0 0">Forum: issues and feature requests from businesses’ owners and admins, who can like and comment on each other’s posts. Set a status so everyone sees what’s planned.</p></div>
${isSupport() ? '' : '<button type="button" class="btn alt" data-act="frSettings">Forum settings</button>'}</div>
${helpSeg()}
${s.on ? '' : '<div class="mt-bar" role="status" style="margin:0 0 14px;border-radius:10px"><strong>The forum is closed.</strong> Businesses don’t see it. Open it again in Forum settings.</div>'}
<div class="stats fr-stats"><div class="card"><div class="l">New, not reviewed yet</div><div class="v">${n((p) => p.status === 'open')}</div></div><div class="card"><div class="l">Feature requests</div><div class="v">${n((p) => p.kind === 'idea')}</div></div>
<div class="card"><div class="l">Issues</div><div class="v">${n((p) => p.kind === 'issue')}</div></div><div class="card"><div class="l">Planned or in progress</div><div class="v">${n((p) => p.status === 'planned' || p.status === 'progress')}</div></div></div>
<div class="fr-bar"><div class="hc-seg" role="tablist">${[['all', 'All'], ['idea', 'Feature requests'], ['issue', 'Issues']].map(([k, l]) => `<button type="button" class="${v.kind === k ? 'on' : ''}" data-act="frKind" data-k="${k}">${l}</button>`).join('')}</div>
<select data-frv="status" aria-label="Status"><option value="">Any status</option>${Object.entries(S).map(([k, l]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
<select data-frv="sort" aria-label="Sort">${[['new', 'Newest'], ['top', 'Most liked'], ['active', 'Recent activity'], ['talk', 'Most comments']].map(([k, l]) => `<option value="${k}" ${v.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
<input type="search" id="frQ" placeholder="Search posts, people, businesses…" value="${esc(v.q)}"></div>
<div class="card fr-card">${list.length ? `<table class="hc-table fr-table"><thead><tr><th class="r">Likes</th><th>Post</th><th>Status</th><th class="r">Comments</th><th>Last activity</th></tr></thead><tbody>
${list.map((p) => `<tr data-act="frOpen" data-id="${esc(p.id)}"><td class="r"><strong>${p.likes}</strong></td><td><div class="fr-tl">${p.pinned ? '📌 ' : ''}${p.locked ? '🔒 ' : ''}<strong>${esc(p.title)}</strong></div>
<div class="sm">${frChip('k-' + p.kind, K[p.kind])} ${esc(p.author.name)} · ${esc(p.author.company)} · ${frAgo(p.at)}</div></td><td>${frChip('s-' + p.status, S[p.status])}</td><td class="r">${p.comments.filter((c) => !c.deleted).length}</td><td class="sm">${frAgo(p.lastAt)}</td></tr>`).join('')}</tbody></table>`
  : `<p class="muted" style="margin:0">${FR.posts.length ? 'No posts match.' : 'No posts yet. Owners and admins open the forum from the Forum button in their app’s top bar.'}</p>`}</div>`;
  sideLayout(main);
  $$('[data-frv]', main).forEach((el) => el.addEventListener('change', () => { frView[el.dataset.frv] = el.value; frList(main); }));
  let t; $('#frQ').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { frView.q = e.target.value; frList(main); const i = $('#frQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
}
function frPost(main, p) {
  const K = FR.kinds; const S = FR.statuses;
  const one = (c) => `<div class="fr-c ${c.author && c.author.team ? 'team' : ''}">${c.deleted ? '<p class="muted" style="margin:0;font-style:italic">Deleted by its author</p>' : `<div class="sm">${frWho(c.author)} · ${frAgo(c.at)}${c.likes ? ` · 👍 ${c.likes}` : ''}</div>
<div class="fr-body">${esc(c.body)}</div><div class="fr-acts"><button type="button" class="link-btn" data-act="frReplyTo" data-c="${esc(c.id)}">Reply</button><button type="button" class="link-btn danger-text" data-act="frDelC" data-c="${esc(c.id)}">Delete</button></div>`}</div>`;
  const top = p.comments.filter((c) => !c.parentId);
  main.innerHTML = `<p style="margin:0 0 10px"><a href="#forum" data-act="frBack">‹ All posts</a></p>
<div class="fr-grid"><div><div class="card"><div class="fr-tags">${frChip('k-' + p.kind, K[p.kind])} ${frChip('s-' + p.status, S[p.status])}${p.pinned ? ' 📌 Pinned' : ''}${p.locked ? ' 🔒 Locked' : ''}</div>
<h2 class="fr-h">${esc(p.title)}</h2><div class="sm">${frWho(p.author)}<br>${new Date(p.at).toLocaleString()}${p.editedAt ? ' · edited' : ''} · 👍 ${p.likes} like${p.likes === 1 ? '' : 's'}</div>
<div class="fr-body">${esc(p.body)}</div></div>
<div class="card"><h2>Comments</h2>${top.map((c) => `${one(c)}${p.comments.filter((r) => r.parentId === c.id).map((r) => `<div class="fr-reply">${one(r)}</div>`).join('')}`).join('') || '<p class="muted">No comments yet.</p>'}
<form id="frReply" class="fr-form"><div class="sm" id="frReplyTo" hidden></div><label>Reply as the ${esc(D.settings.productName)} team<textarea name="body" rows="3" maxlength="4000" required placeholder="Everyone in the forum sees this, with a team badge."></textarea></label>
<input type="hidden" name="parentId"><div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn">Post reply</button></div></form></div></div>
<div><div class="card"><h2>Manage</h2><form id="frManage"><label>Status<select name="status">${Object.entries(S).map(([k, l]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
<label>Note with the status change (optional)<textarea name="note" rows="3" maxlength="4000" placeholder="e.g. Thanks! This is planned for next month."></textarea></label>
<label>Type<select name="kind">${Object.entries(K).map(([k, l]) => `<option value="${k}" ${p.kind === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
<label class="chk"><input type="checkbox" name="pinned" ${p.pinned ? 'checked' : ''}> Pin to the top of the forum</label><label class="chk"><input type="checkbox" name="locked" ${p.locked ? 'checked' : ''}> Lock (no new comments)</label>
<button class="btn" style="width:100%;margin-top:6px">Save</button></form>
<p class="muted" style="font-size:12px">The author gets an email when the status changes${FR.settings.emailReplies ? '' : ' (turned off in Settings)'}. A note is posted as a team reply.</p>
<button type="button" class="btn danger" style="width:100%" data-act="frDel">Delete post</button></div></div></div>`;
  $('#frManage').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const btn = $('button.btn', f); btn.disabled = true;
    try { const r = await api('PUT', `/api/platform/forum/${encodeURIComponent(p.id)}`, { status: f.status.value, note: f.note.value, kind: f.kind.value, pinned: f.pinned.checked, locked: f.locked.checked }); frPut(r.post); toast('Saved'); render(); }
    catch (x) { toast(x.message, true); btn.disabled = false; }
  });
  $('#frReply').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target; const btn = $('button.btn', f); btn.disabled = true;
    try { const r = await api('POST', `/api/platform/forum/${encodeURIComponent(p.id)}/comments`, { body: f.body.value, parentId: f.parentId.value || null }); frPut(r.post); toast('Reply posted'); render(); }
    catch (x) { toast(x.message, true); btn.disabled = false; }
  });
}
const frPut = (post) => { const i = FR.posts.findIndex((x) => x.id === post.id); if (i >= 0) FR.posts[i] = post; };
A.frOpen = (d) => { frSel = d.id; render(); window.scrollTo(0, 0); };
A.frBack = () => { frSel = ''; render(); };
A.frKind = (d) => { frView.kind = d.k; frList($('#main')); };
A.frReplyTo = (d) => {
  const p = FR.posts.find((x) => x.id === frSel); const c = p.comments.find((x) => x.id === d.c); const f = $('#frReply');
  f.parentId.value = d.c; const w = $('#frReplyTo'); w.hidden = false; w.innerHTML = `Replying to ${esc(c.author.team ? 'the team' : c.author.name)} · <button type="button" class="link-btn" data-act="frReplyClear">Cancel</button>`; f.body.focus();
};
A.frReplyClear = () => { const f = $('#frReply'); f.parentId.value = ''; $('#frReplyTo').hidden = true; };
A.frDelC = async (d) => { if (!confirm('Delete this comment? Its replies are deleted too.')) return; try { const r = await api('DELETE', `/api/platform/forum/${encodeURIComponent(frSel)}/comments/${encodeURIComponent(d.c)}`); frPut(r.post); toast('Comment deleted'); render(); } catch (x) { toast(x.message, true); } };
A.frDel = async () => { if (!confirm('Delete this post and all its comments? This can’t be undone.')) return; try { FR = await api('DELETE', `/api/platform/forum/${encodeURIComponent(frSel)}`); frSel = ''; toast('Post deleted'); render(); } catch (x) { toast(x.message, true); } };
A.frSettings = () => {
  const s = FR.settings;
  const m = modal('Forum settings', `<form><label class="chk"><input type="checkbox" name="on" ${s.on ? 'checked' : ''}> <span><strong>Forum is open</strong><br><span class="muted">Owners and admins see a Forum button in their app’s top bar. Closed, it’s hidden and posts are kept.</span></span></label>
<label class="chk"><input type="checkbox" name="emailNew" ${s.emailNew ? 'checked' : ''}> <span><strong>Email me about new posts</strong><br><span class="muted">${D.settings.contactEmail ? `Sent to ${esc(D.settings.contactEmail)}` : 'Add a contact email in Settings first'}.</span></span></label>
<label class="chk"><input type="checkbox" name="emailReplies" ${s.emailReplies ? 'checked' : ''}> <span><strong>Email authors about replies and status changes</strong><br><span class="muted">At most one email per post every 10 minutes.</span></span></label>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Save</button></div></form>`);
  $('form', m).addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.target;
    try { FR = await api('PUT', '/api/platform/forum/settings', { on: f.on.checked, emailNew: f.emailNew.checked, emailReplies: f.emailReplies.checked }); closeModal(); toast('Forum settings saved'); render(); } catch (x) { toast(x.message, true); }
  });
};
