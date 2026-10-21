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
const host = (u) => String(u || '').replace(/^https?:\/\//, '');

/* ===== login / first-run setup ===== */
function authView(state, err) {
  const setup = state.needsSetup;
  $('#root').innerHTML = `<div class="pf-auth card">${state.brand && state.brand.logo ? `<div class="pf-auth-logo">${brandImg(state.brand)}</div>` : ''}<h1>${setup ? 'Create the Alpha owner' : 'Alpha'}</h1>
<p class="muted">${setup ? `This login controls every account on ${esc(state.productName)}: plans, features and billing. Keep it to yourself.` : `Log in to manage ${esc(state.productName)}.`}</p>
<form id="af">${err ? `<div class="msg err" role="alert">${esc(err)}</div>` : ''}${setup ? '<label>Your name<input name="name" required autocomplete="name"></label>' : ''}
<label>Email<input name="email" type="email" required autocomplete="username"></label>
<label>Password${setup ? ' (10+ characters)' : ''}<input name="password" type="password" required autocomplete="${setup ? 'new-password' : 'current-password'}" ${setup ? 'minlength="10"' : ''}></label>
<button class="btn">${setup ? 'Create and continue' : 'Log in'}</button></form></div>`;
  $('#af input').focus();
  $('#af').addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target));
    try { await api('POST', setup ? '/api/platform/setup' : '/api/platform/login', b); boot(); } catch (x) { authView(state, x.message); }
  });
}

/* ===== shell ===== */
const ico = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TAB_ICONS = { // bottom bar icons (phones)
  help: ico('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.3-2.4 3.9"/><path d="M12 17.2h.01"/>'),
  accounts: ico('<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4"/>'),
  discounts: ico('<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="8" cy="8" r="1.5"/>'),
  messages: ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  plans: ico('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14.5 17.5l2 2 4-4"/>'),
  settings: ico('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
};
async function load() { D = await api('GET', '/api/platform/overview'); if (!draftPlans) { draftPlans = structuredClone(D.plans); draftBeta = [...D.betaFeatures]; } }
function render() {
  const tabs = [['accounts', 'Accounts'], ['plans', 'Plans & features'], ['discounts', 'Promotions'], ['messages', 'Messages'], ['help', 'Help Center'], ['settings', 'Settings']];
  document.title = `${tabs.find((t) => t[0] === tab)[1]} · ${D.settings.productName} Alpha`;
  $('#root').innerHTML = `<header class="pf-top"><div class="pf-bar"><div class="pf-brand">${brandImg(siteBrand(), 'dark')}${siteBrand().logoHasName ? '' : esc(D.settings.productName)} <small>Alpha</small></div>
<nav class="pf-tabs">${tabs.map(([k, l]) => `<a href="#${k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</nav>
<div class="pf-user"><span>${esc(D.admin.name)}</span><button type="button" data-act="logout">Log out</button></div></div></header>
${D.maintenance && D.maintenance.on ? `<div class="mt-bar" role="status"><strong>Maintenance mode is on.</strong> Visitors and businesses see the maintenance page; you can still use everything. <a href="#settings">Turn it off in Settings</a></div>` : ''}
<main class="pf-main" id="main"></main>
<nav class="pf-bnav" aria-label="Alpha sections">${tabs.map(([k, l]) => `<a href="#${k}" class="${tab === k ? 'on' : ''}"${tab === k ? ' aria-current="page"' : ''}>${TAB_ICONS[k]}<span>${SHORT_TABS[k] || l}</span></a>`).join('')}</nav>`;
  $('#main').dataset.tab = tab; // box title bands are styled per tab (platform.html)
  ({ accounts: accountsView, plans: plansView, discounts: promoView, messages: messagesView, help: helpView, settings: settingsView })[tab]($('#main'));
}
const TABS = ['accounts', 'plans', 'discounts', 'messages', 'help', 'settings'];
const SHORT_TABS = { plans: 'Plans', help: 'Help', discounts: 'Promos' }; // the phone tab bar has room for short names only
window.addEventListener('hashchange', () => { tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'accounts'; if (D) render(); });

/* ===== accounts ===== */
const statusChip = (a) => (a.status === 'active' ? `<span class="cstatus active">Active</span>${a.expiresAt ? `<div class="sm">Until ${fmtDate(a.expiresAt)}</div>` : ''}${a.billing && a.billing.status === 'paid' ? `<div class="sm">${a.billing.demo ? 'Demo checkout' : 'Paid by card'}</div>` : ''}`
  + (a.billing && a.billing.discountCode ? `<div class="sm">Code ${esc(a.billing.discountCode)}</div>` : '') : a.status === 'pending' ? '<span class="cstatus">Awaiting payment</span>' : `<span class="cstatus">${a.expiredOn ? 'Expired' : 'Paused'}</span>${a.expiredOn ? `<div class="sm">Access ended ${fmtDate(a.expiredOn)}</div>` : a.billing && a.billing.pausedForBilling ? '<div class="sm">Subscription ended</div>' : ''}`);
// a trial or test plan (Trial, or any plan hidden from the pricing page): suggest a last day of access two weeks out
const isTrialPlan = (id) => { const p = D.plans.find((x) => x.id === id); return !!p && (p.id === 'trial' || !!p.hidden); };
const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymdLocal(d); };
const expiryField = (v) => `<label>Last day of access (optional)<input name="expiresAt" type="date" min="${ymdLocal(new Date())}" value="${esc(v || '')}"></label>`;
const planName = (id) => (D.plans.find((p) => p.id === id) || {}).name || id;
function accountsView(main) {
  const active = D.accounts.filter((a) => a.status === 'active').length;
  const byPlan = D.plans.map((p) => `${D.accounts.filter((a) => a.planId === p.id).length} ${esc(p.name)}`).join(' · ');
  main.innerHTML = `<div class="head"><div><h1>Accounts</h1><p class="sub" style="margin:4px 0 0">Each business gets its own web address, data and logins.</p></div><button class="btn" data-act="newAccount">New account</button></div>
${D.devMode ? `<div class="note">Running locally: accounts open at <code>&lt;address&gt;.${esc(D.rootDomain)}</code> in this browser. Set <code>PLATFORM_DOMAIN</code> (e.g. yourapp.com) on your server to give each account <code>&lt;address&gt;.yourapp.com</code>.</div>` : ''}
<div class="stats"><div class="card"><div class="l">Accounts</div><div class="v">${D.accounts.length}</div></div><div class="card"><div class="l">Active</div><div class="v">${active}</div></div>
<div class="card"><div class="l">By plan</div><div style="margin-top:8px;font-size:14px">${byPlan}</div></div><div class="card"><div class="l">Logins across accounts</div><div class="v">${D.accounts.reduce((s, a) => s + a.users, 0)}</div></div></div>
<div class="card"><div class="tablewrap"><table class="acc"><thead><tr><th>Business</th><th>Web address</th><th>Plan</th><th>Status</th><th>Usage</th><th>Created</th><th></th></tr></thead><tbody>
${D.accounts.map((a) => `<tr data-id="${a.id}"><td><div class="nm">${esc(a.name)}${a.isDefault ? ' <span class="pf-chip">Your own account</span>' : ''}</div><div class="sm">${a.owner ? `${esc(a.owner.name)} · ${esc(a.owner.email)}${a.owner.active ? '' : ' · <em>invite not accepted</em>'}${a.owner.unconfirmed ? ' · <em>email not confirmed</em>' : ''}` : 'No owner login yet'}</div></td>
<td><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(host(a.url))}</a>${a.domains.length ? `<div class="chips">${a.domains.map((d) => `<span class="pf-chip ${d.verified ? 'ok' : 'wait'}" title="${d.verified ? 'Connected' : 'Waiting for DNS'}">${esc(d.host)}</span>`).join('')}</div>` : ''}</td>
<td><select data-plan="${a.id}" aria-label="Plan for ${esc(a.name)}">${D.plans.map((p) => `<option value="${esc(p.id)}" ${p.id === a.planId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></td>
<td>${statusChip(a)}${a.support.length ? ` <span class="pf-chip ${a.support.some((r) => r.status === 'granted') ? 'ok' : 'wait'}" title="Support Access">${a.support.some((r) => r.status === 'granted') ? 'Support access' : 'Access requested'}</span>` : ''}</td>
<td class="sm">${a.users} login${a.users === 1 ? '' : 's'} · ${a.clients} clients · ${a.jobs} jobs${a.lastLoginAt ? `<br>Last login ${fmtDate(a.lastLoginAt)}` : ''}</td>
<td class="sm">${fmtDate(a.createdAt)}</td>
<td><div class="acts"><button class="btn alt sm" data-act="editAccount" data-id="${a.id}">Manage</button></div></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No accounts yet.</td></tr>'}
</tbody></table></div></div>`;
  $$('[data-plan]', main).forEach((s) => s.addEventListener('change', async () => {
    const a = D.accounts.find((x) => x.id === s.dataset.plan);
    if (isTrialPlan(s.value) && !a.isDefault) { trialModal(a, s.value); s.value = a.planId; return; }
    try { await api('PUT', `/api/platform/accounts/${a.id}`, { planId: s.value }); toast(`${a.name} is now on ${planName(s.value)}`); await load(); render(); } catch (e) { toast(e.message, true); s.value = a.planId; }
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
  const m = modal(a.name, `<div class="am-grid"><div class="am-col"><form id="ef"><label>Business name<input name="name" value="${esc(a.name)}" required maxlength="100"></label>${slugField('slug', a.slug)}
<p class="muted" style="font-size:13px;margin:-4px 0 12px">Changing the address breaks links already sent to clients at the old address.</p>
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
  m.dataset.id = a.id;
  const f = $('#ef', m); wireSlug(f, a.slug);
  const xf = $('#xf', m); if (xf) xf.addEventListener('submit', async (e) => { e.preventDefault(); try { await api('PUT', `/api/platform/accounts/${a.id}`, { expiresAt: xf.expiresAt.value }); toast(xf.expiresAt.value ? `Last day of access: ${fmtDate(xf.expiresAt.value)}` : 'End date removed'); await load(); render(); A.editAccount({ id: a.id }); } catch (x) { toast(x.message, true); } });
  const sf = $('#saf', m);
  if (sf) sf.addEventListener('submit', async (e) => {
    e.preventDefault(); const b = $('button', sf); b.disabled = true;
    try { const who = a.logins.find((u) => u.id === sf.userId.value); const r = await api('POST', `/api/platform/accounts/${a.id}/support-access`, { userId: sf.userId.value, reason: sf.reason.value }); toast(r.emailed ? `Request sent to ${who.email}` : `Request saved. ${who.name} wasn’t emailed (email isn’t connected), so let them know to check Settings → Support Access.`); await load(); render(); A.editAccount({ id: a.id }); }
    catch (x) { b.disabled = false; toast(x.message, true); }
  });
  f.addEventListener('submit', async (e) => { e.preventDefault(); try { await api('PUT', `/api/platform/accounts/${a.id}`, Object.fromEntries(new FormData(f))); toast('Saved'); await load(); render(); A.editAccount({ id: a.id }); } catch (x) { toast(x.message, true); } });
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
function plansView(main) {
  const P = draftPlans; const groups = [...new Set(D.features.map((f) => f.group))];
  const used = (id) => D.accounts.filter((a) => a.planId === id).length;
  const usedText = (p) => `${used(p.id)} account${used(p.id) === 1 ? '' : 's'}`;
  const rmBtn = (p, i) => (P.length > 1 ? `<button type="button" class="rm-plan" data-act="rmPlan" data-i="${i}" ${used(p.id) ? `disabled title="Move its accounts to another plan first"` : ''}>Remove plan</button>` : '');
  const dirty = plansDirty();
  planIx = Math.min(planIx, P.length - 1);
  const head = `<div class="head"><div><h1>Plans & features</h1><p class="sub" style="margin:4px 0 0">Tick what each plan includes. Accounts get changes as soon as you save.</p></div><button class="btn alt" data-act="addPlan">Add plan</button></div>`;
  const savebar = `<div class="savebar"><span class="muted">${dirty ? 'Unsaved changes' : 'All changes saved'}</span>${dirty ? '<button type="button" class="btn alt" data-act="discardPlans">Discard</button>' : ''}<button type="button" class="btn" data-act="savePlans" ${dirty ? '' : 'disabled'}>Save plans</button></div>`;
  if (narrow.matches) {
    const i = planIx; const p = P[i];
    main.innerHTML = `${head}<div class="pl-pick" role="tablist">${P.map((x, j) => `<button type="button" role="tab" aria-selected="${j === i}" class="${j === i ? 'on' : ''}" data-act="pickPlan" data-i="${j}">${esc(x.name || 'Untitled')}${x.hidden ? ' <small>hidden</small>' : ''}</button>`).join('')}</div>
<div class="card pl-card"><details class="pl-det" ${detailsOpen ? 'open' : ''}><summary><span><strong>Plan details</strong><span class="muted">${esc(saveText(p))}</span></span><span class="muted">${usedText(p)}</span></summary><div class="pl-form">${planFields(p, i)}${rmBtn(p, i)}</div></details>
<div class="pl-feat"><div class="pl-h"><span>Features</span><span class="muted" data-count="${i}">${p.features.length} of ${D.features.length}</span></div>
<p class="pl-always"><strong>Always included:</strong> ${D.alwaysIncluded.map(esc).join(', ')}</p>
<div class="pl-cols muted"><span>Beta</span><span>Feature</span></div>
${groups.map((g) => `<div class="pl-grp">${esc(g)}</div>` + D.features.filter((f) => f.group === g).map((f) => `<div class="pl-item"><label class="pl-beta">${betaBox(f)}</label><label class="pl-row"><span><span class="mx-l">${esc(f.label)}${betaTag(f)}</span><span class="mx-d">${esc(f.desc)}</span></span><input type="checkbox" data-i="${i}" data-f="${f.key}" ${p.features.includes(f.key) ? 'checked' : ''}></label></div>`).join('')).join('')}</div>
${savebar}</div>`;
    $('.pl-det', main).addEventListener('toggle', (e) => { detailsOpen = e.target.open; });
  } else {
    main.innerHTML = `${head}<div class="card" style="padding-bottom:18px"><div class="tablewrap"><table class="matrix"><thead><tr><th class="bcol"><span class="muted" style="font-weight:400;font-size:13px">Beta</span></th><th class="fcol"><span class="muted" style="font-weight:400;font-size:13px">Plan details</span></th>
${P.map((p, i) => `<th>${planFields(p, i)}<div class="muted" style="font-size:12px">${usedText(p)}</div>${rmBtn(p, i)}</th>`).join('')}</tr></thead>
<tbody><tr class="grp"><td class="bcol"></td><td class="fcol">Always included</td>${P.map(() => '<td></td>').join('')}</tr>
${D.alwaysIncluded.map((l) => `<tr><td class="bcol"></td><td class="fcol"><div class="mx-l">${esc(l)}</div></td>${P.map(() => '<td class="always" aria-label="Included">✓</td>').join('')}</tr>`).join('')}
${groups.map((g) => `<tr class="grp"><td class="bcol"></td><td class="fcol">${esc(g)}</td>${P.map(() => '<td></td>').join('')}</tr>` + D.features.filter((f) => f.group === g).map((f) => `<tr><td class="bcol">${betaBox(f)}</td><td class="fcol"><div class="mx-l">${esc(f.label)}${betaTag(f)}</div><div class="mx-d">${esc(f.desc)}</div></td>
${P.map((p, i) => `<td><input type="checkbox" data-i="${i}" data-f="${f.key}" ${p.features.includes(f.key) ? 'checked' : ''} aria-label="${esc(f.label)} in ${esc(p.name)}"></td>`).join('')}</tr>`).join('')).join('')}
<tr class="count"><td class="bcol"></td><td class="fcol">Features ticked</td>${P.map((p, i) => `<td data-count="${i}">${p.features.length} of ${D.features.length}</td>`).join('')}</tr></tbody></table></div>
${savebar}</div>`;
  }
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
    $(`[data-count="${c.dataset.i}"]`, main).textContent = `${p.features.length} of ${D.features.length}`; markDirty(main);
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
function settingsView(main) {
  const s = D.settings; const site = `${location.origin}/pricing`;
  main.innerHTML = `<div class="head"><div><h1>Settings</h1></div></div>
<div class="set-grid"><div class="set-col"><div class="card" id="mtCard"></div>
<form id="sf" class="set-form"><div class="card"><h2>Your product</h2>
<div class="row"><label>Product name<input name="productName" value="${esc(s.productName)}" required maxlength="60"></label><label>Contact email<input name="contactEmail" type="email" value="${esc(s.contactEmail)}" placeholder="sales@yourapp.com"></label></div>
<p class="muted" style="font-size:13px;margin-top:-4px">The product name appears on the pricing page and in account emails. Accounts see the contact email when they want to change plans, and new sign-ups are reported to it.</p>
<div class="card-save"><button class="btn">Save</button></div></div>
<div class="card"><h2>Terms and privacy</h2>
<div class="row"><label>Legal business name<input name="legalName" value="${esc(s.legalName || '')}" maxlength="120" placeholder="e.g. Worklio Pro LLC"></label><label>Governing law<input name="governingLaw" value="${esc(s.governingLaw || '')}" maxlength="80" placeholder="e.g. the State of Texas"></label></div>
<p class="muted" style="font-size:13px;margin-top:-4px">Used in the <a href="/terms" target="_blank" rel="noopener">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>, which every address shows at /terms and /privacy. Leave the governing law blank to leave that sentence out. The wording itself is in lib/legal.js; have a lawyer review it.</p>
<div class="card-save"><button class="btn">Save</button></div></div>
<div class="card"><h2>Sign-ups</h2>
<label class="switchline"><input type="checkbox" name="allowSignups" ${s.allowSignups ? 'checked' : ''}> Let businesses create an account themselves on the pricing page</label>
<label style="max-width:320px">Plan for businesses that sign up without choosing one<select name="signupPlan">${D.plans.filter((p) => !p.hidden).map((p) => `<option value="${esc(p.id)}" ${p.id === s.signupPlan ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
<label style="max-width:320px">“Most popular” badge on the pricing page<select name="popularPlan"><option value="" ${!s.popularPlan ? 'selected' : ''}>Automatic (the middle plan)</option>${D.plans.filter((p) => !p.hidden).map((p) => `<option value="${esc(p.id)}" ${p.id === s.popularPlan ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="none" ${s.popularPlan === 'none' ? 'selected' : ''}>None</option></select></label>
<p class="muted" style="font-size:13px">Pricing page: <a href="${esc(site)}" target="_blank" rel="noopener">${esc(site)}</a>. Businesses that choose a paid plan pay for it at checkout before their account opens (see Integrations → Stripe below).</p>
<div class="card-save"><button class="btn">Save</button></div></div>
<div class="card"><h2>Accounts with a last day of access</h2>
<div class="row"><label>Show a banner in their app (days before)<input name="expiryBannerDays" type="number" min="0" max="60" value="${esc(s.expiryBannerDays ?? 7)}"></label><label>Email the owner a reminder (days before)<input name="expiryReminderDays" type="number" min="0" max="60" value="${esc(s.expiryReminderDays ?? 3)}"></label></div>
<p class="muted" style="font-size:13px;margin-top:-4px">For accounts you gave a last day of access (e.g. trials). Owners and admins see the banner; owners can choose a plan from it, which removes the end date. The reminder is sent once per end date; edit its wording in Messages → Email templates → Access ending soon. 0 means on the last day itself.</p>
<div class="card-save"><button class="btn">Save</button></div></div></form>
<div class="card" id="reserved"></div></div>
<div class="set-col"><div class="card" id="logoCard"></div>
<div class="card" id="integ"><h2>Integrations</h2><p class="muted">Checking…</p></div></div></div>`;
  $('#sf').addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); b.allowSignups = !!b.allowSignups;
    try { await api('PUT', '/api/platform/settings', b); await load(); toast('Settings saved'); render(); } catch (x) { toast(x.message, true); }
  });
  maintenanceCard($('#mtCard', main)); logoCard($('#logoCard', main)); reservedCard($('#reserved', main));
  integrationsCard($('#integ', main));
}
/* ===== promotions: discount codes, the referral program and its activity ===== */
let promoTab = 'codes'; let RF = null; // RF: the referral program and its activity (lib/referrals.js)
function promoView(main) {
  const due = RF ? RF.rewards.filter((w) => w.status === 'to send').length : 0;
  main.innerHTML = `<div class="head"><div><h1>Promotions</h1><p class="sub" style="margin:4px 0 0">Discount codes for sign-ups, and a referral program for the businesses on ${esc(D.settings.productName)}.</p></div></div>
<div class="hc-seg msg-seg" role="tablist">${[['codes', 'Discount codes'], ['program', 'Referral program'], ['activity', 'Referral activity']].map(([k, l]) => `<button type="button" role="tab" aria-selected="${promoTab === k}" class="${promoTab === k ? 'on' : ''}" data-act="promoTab" data-k="${k}">${l}${k === 'activity' && due ? ` <span class="msg-n">${due}</span>` : ''}</button>`).join('')}</div><div id="promoBody"></div>`;
  const box = $('#promoBody', main);
  if (promoTab === 'codes') return discountsView(box);
  if (!RF) { box.innerHTML = '<p class="muted">Loading…</p>'; api('GET', '/api/platform/referrals').then((r) => { RF = r; if (tab === 'discounts') promoView($('#main')); }).catch((x) => toast(x.message, true)); return; }
  (promoTab === 'program' ? referralProgramView : referralActivityView)(box);
}
A.promoTab = (d) => { promoTab = d.k; promoView($('#main')); };
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
const rpRedraw = () => { const f = $('#rpf'); if (f) f._readMiles(); const keep = f ? Object.fromEntries(new FormData(f)) : {}; referralProgramView($('#promoBody')); const g = $('#rpf'); Object.entries(keep).forEach(([k, v]) => { const el = g.elements[k]; if (el && el.type !== 'checkbox') el.value = v; }); if (f) g.enabled.checked = keep.enabled === 'on'; };
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
</tbody></table></div></div>` : `<div class="card" style="text-align:center;padding:36px 18px"><h2 style="margin:0 0 6px">No discount codes yet</h2><p class="muted" style="margin:0 0 14px">Create a code like <strong>SPRING20</strong> for 20% off the first 3 months, limited to the plans, dates and number of uses you choose.</p><button class="btn" data-act="discEdit">New discount code</button></div>`}`;
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
<div class="row"><label>Type<select name="type" ${lock}><option value="percent" ${x.type === 'percent' ? 'selected' : ''}>Percentage off</option><option value="amount" ${x.type === 'amount' ? 'selected' : ''}>Dollar amount off</option></select></label><label><span id="valLbl">${x.type === 'amount' ? 'Amount off ($)' : 'Percent off (%)'}</span><input name="value" type="number" min="0.01" step="0.01" value="${esc(x.value)}" required ${lock}></label></div>
<div class="row"><label>How long<select name="duration" ${lock}><option value="once" ${x.duration === 'once' ? 'selected' : ''}>The first payment only</option><option value="repeating" ${x.duration === 'repeating' ? 'selected' : ''}>A number of months</option><option value="forever" ${x.duration === 'forever' ? 'selected' : ''}>Every payment, for good</option></select></label><label id="monthsRow" ${x.duration === 'repeating' ? '' : 'hidden'}>Months<input name="months" type="number" min="1" max="36" value="${esc(x.months || 3)}" ${lock}></label></div>
<p class="muted" style="font-size:12px;margin:-4px 0 8px">On yearly billing, a discount for a number of months applies to the first year’s payment.</p>
<h3 class="hc-h3">Rules</h3>
<div class="disc-plans"><span class="muted" style="font-size:13px">Plans (none ticked = every paid plan)</span>${paid.map((p) => `<label class="switchline" style="margin:4px 0"><input type="checkbox" name="plans" value="${esc(p.id)}" ${(x.plans || []).includes(p.id) ? 'checked' : ''}> ${esc(p.name)}${p.hidden ? ' <span class="pf-chip">Hidden</span>' : ''}</label>`).join('')}</div>
<div class="row"><label>Billing<select name="interval"><option value="any" ${x.interval === 'any' ? 'selected' : ''}>Monthly or yearly</option><option value="month" ${x.interval === 'month' ? 'selected' : ''}>Monthly only</option><option value="year" ${x.interval === 'year' ? 'selected' : ''}>Yearly only</option></select></label><label>Total uses allowed (0 = no limit)<input name="maxUses" type="number" min="0" step="1" value="${esc(x.maxUses || 0)}"></label></div>
<div class="row"><label>Starts (optional)<input name="startsAt" type="date" value="${esc(x.startsAt)}"></label><label>Ends after (optional)<input name="endsAt" type="date" value="${esc(x.endsAt)}"></label></div>
<label class="switchline"><input type="checkbox" name="onePerEmail" ${x.onePerEmail ? 'checked' : ''}> Once per email address</label>
<label class="switchline"><input type="checkbox" name="active" ${x.active ? 'checked' : ''}> Active (people can use it now)</label>
${used ? `<h3 class="hc-h3">Used ${used} time${used === 1 ? '' : 's'}</h3><div class="tablewrap" style="max-height:180px;overflow:auto"><table class="acc">${x.uses.slice().reverse().map((u) => `<tr><td class="nm">${esc(u.business)}</td><td class="sm">${esc(u.email)}</td><td class="sm">${fmtDate(u.at)}</td></tr>`).join('')}</table></div>` : ''}
<div class="foot">${d.id ? '<button type="button" class="btn danger" data-act="discDelete" style="margin-right:auto">Delete</button>' : ''}<button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">${d.id ? 'Save' : 'Create code'}</button></div></form>`, { wide: true });
  const f = $('#df', m); m.discId = d.id || '';
  $('[name=type]', f).addEventListener('change', (e) => { $('#valLbl', f).textContent = e.target.value === 'amount' ? 'Amount off ($)' : 'Percent off (%)'; });
  $('[name=duration]', f).addEventListener('change', (e) => { $('#monthsRow', f).hidden = e.target.value !== 'repeating'; });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const fd = new FormData(f); const b = Object.fromEntries(fd); b.plans = fd.getAll('plans'); b.active = !!fd.get('active'); b.onePerEmail = !!fd.get('onePerEmail');
    if (used) { delete b.code; delete b.type; delete b.value; delete b.duration; delete b.months; }
    try { D.discounts = await api(d.id ? 'PUT' : 'POST', d.id ? `/api/platform/discounts/${d.id}` : '/api/platform/discounts', b); closeModal(); toast(d.id ? 'Discount saved' : `${String(b.code).toUpperCase()} created`); render(); } catch (x2) { toast(x2.message, true); }
  });
};
A.discDelete = async (d, el) => {
  const id = el.closest('.pf-modal').discId; const x = D.discounts.find((y) => y.id === id);
  if (!confirm(`Delete ${x.code}?${x.uses.length ? ' Businesses that already used it keep their discount in Stripe.' : ''} People can no longer use it.`)) return;
  D.discounts = await api('DELETE', `/api/platform/discounts/${id}`); closeModal(); toast(`${x.code} deleted`); render();
};
/* ===== messages: contact requests, user feedback and the platform's email templates ===== */
let msgTab = 'inquiries';
function messagesView(main) {
  const subs = [['inquiries', 'Contact requests', (D.inquiries || []).length], ['feedback', 'User feedback', (D.feedback || []).length], ['emails', 'Email templates']];
  main.innerHTML = `<div class="head"><div><h1>Messages</h1><p class="sub" style="margin:4px 0 0">What people send you, and the emails ${esc(D.settings.productName)} sends.</p></div></div>
<div class="hc-seg msg-seg" role="tablist">${subs.map(([k, l, n]) => `<button type="button" role="tab" aria-selected="${msgTab === k}" class="${msgTab === k ? 'on' : ''}" data-act="msgTab" data-k="${k}">${l}${n ? ` <span class="msg-n">${n}</span>` : ''}</button>`).join('')}</div>
<div class="card" style="max-width:860px" id="${msgTab}"></div>`;
  ({ inquiries: inquiriesCard, feedback: feedbackCard, emails: emailsCard })[msgTab]($('#' + msgTab, main));
}
A.msgTab = (d) => { msgTab = d.k; messagesView($('#main')); };
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
A.rmLogo = async (d) => { if (!confirm(d.k === 'dark' ? 'Remove the dark background version?' : 'Remove the logo? Pages and emails go back to the standard check mark.')) return; D.settings = await api('DELETE', `/api/platform/logo/${d.k}`); toast('Logo removed'); render(); };
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
  let I; try { I = await api('GET', '/api/platform/integrations'); } catch (x) { box.innerHTML = `<h2>Integrations</h2><p class="muted">${esc(x.message)}</p>`; return; }
  const on = (ok, yes = 'Connected', no = 'Not set up') => `<span class="cstatus ${ok ? 'active' : ''}">${ok ? yes : no}</span>`;
  const S = I.stripe; const copy = (v, label) => `<div class="linkbox"><input readonly value="${esc(v)}" aria-label="${esc(label)}"><button type="button" class="btn alt" data-act="copy">Copy</button></div>`;
  const ig = (title, status, inner) => `<section class="ig"><div class="ig-h"><h3>${title}</h3>${status}</div>${inner}</section>`;
  const env = (html) => `<p class="ig-env">Set in <code>.env</code>: ${html}</p>`;
  box.innerHTML = `<h2>Integrations</h2><p class="muted" style="font-size:13px;margin-top:0">Shared by every account. Keys go in the <code>.env</code> file next to <code>server.js</code> (restart after changing it) and are never shown here.</p>
${ig('Email', on(I.email, `Connected (${esc(I.email)})`), `<p class="ig-d">Every email the app sends, for every business: quotes, invoices, reminders, receipts and password resets, in each business’s name. Your own emails show your product name (or <code>EMAIL_FROM_NAME</code>) as the sender.</p>
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
${ig('Stripe', S.key ? `${on(true)} <span class="cstatus ${S.mode === 'live' ? 'active' : 'q-sent'}">${S.mode === 'live' ? 'Live' : 'Test mode'}</span>` : on(false), `<p class="ig-d">Your Stripe account: plan payments when businesses sign up, and “Connect with Stripe” for businesses’ card payments from their clients.</p>
${S.keyVar ? `<p class="ig-env">Using <code>${S.keyVar}</code> from <code>.env</code>.</p>` : env('<code>BILLING_STRIPE_SECRET_KEY</code> (or <code>STRIPE_SECRET_KEY</code>).')}
${S.key ? '' : '<div class="note">Without a Stripe key, sign-up checkout and businesses’ invoice pay pages run demo payments that charge nobody, and businesses can’t connect Stripe.</div>'}
<h4>Card payments for businesses (Stripe Connect)</h4>
<p class="muted ig-p">Each business sets up card payments once in its App Settings → Card payments, and clients’ payments go straight to that business. One-time setup: turn on <strong>Connect</strong> in your Stripe dashboard (Settings → Connect). ${I.connected} account${I.connected === 1 ? ' has' : 's have'} started: ${I.byMethod.standard} with Connect with Stripe, ${I.byMethod.embedded} set up in ${esc(D.settings.productName)}.</p>
<form id="cardSetupForm"><div class="cs-opts">${[['standard', 'Connect with Stripe', 'Businesses make or sign in to their own Stripe account on Stripe’s pages and manage it in their Stripe dashboard. No extra Stripe fees for you.'],
  ['embedded', `Set up in ${esc(D.settings.productName)}`, 'Businesses fill in Stripe’s form inside the app, with no Stripe account or login. You pay Stripe’s Connect fees for these accounts and cover losses Stripe can’t recover, such as disputes on an empty balance. Needs the publishable key below.'],
  ['both', 'Let each business choose', 'Shows both buttons. Handy while you find out what businesses prefer.']].map(([v, l, d]) => `<label class="cs-opt"><input type="radio" name="cardSetup" value="${v}" ${I.cardSetup === v ? 'checked' : ''}><span><strong>${l}</strong><small>${d}</small></span></label>`).join('')}</div>
<label>Stripe publishable key<input name="stripePublishableKey" placeholder="${I.pubKey ? esc(I.pubKey) + (I.pubKeyFromEnv ? ' (from .env)' : ' (saved)') : 'pk_live_… (Stripe → Developers → API keys)'}" autocomplete="off" spellcheck="false"></label>
<p class="muted ig-p" style="margin-top:-4px">Only needed for setting up in the app. Use the key from the same Stripe account and mode as your secret key. Leave it blank to keep the saved one. Businesses already set up keep working whichever way you choose.</p>
<div class="acts" style="justify-content:flex-start"><button class="btn alt">Save card payment setup</button></div></form>
<form id="feeForm" class="inline-form"><label>Your platform fee on each card payment (%)<input name="platformFeePercent" type="number" min="0" max="30" step="0.1" value="${esc(D.settings.platformFeePercent || 0)}"></label><button class="btn alt">Save fee</button></form>
<p class="muted ig-p">Payment confirmations: ${on(S.connectWebhook, 'Webhook connected', 'Webhook not set up')} In Stripe, add a webhook for <strong>events on connected accounts</strong> with <code>checkout.session.completed</code>, <code>checkout.session.async_payment_succeeded</code> and <code>account.updated</code>, then put its signing secret in <code>STRIPE_CONNECT_WEBHOOK_SECRET</code>.</p>
${copy(S.connectWebhookUrl, 'Connect webhook URL')}
<h4>Plan payments at sign-up</h4>
<p class="muted ig-p">${on(S.billingWebhook, 'Webhook connected', 'Webhook not set up')} Optional: add a webhook on your own account for <code>checkout.session.completed</code>, <code>customer.subscription.updated</code> and <code>customer.subscription.deleted</code>, with its signing secret in <code>BILLING_STRIPE_WEBHOOK_SECRET</code>. It pauses accounts whose subscription ends.</p>
${copy(S.billingWebhookUrl, 'Billing webhook URL')}
${I.localhost ? '<p class="muted ig-p" style="margin-top:8px">Stripe can’t reach localhost: set <code>BASE_URL</code> (or <code>PLATFORM_DOMAIN</code>) to your public address first.</p>' : ''}`)}
${ig('AI descriptions', on(I.ai), `<p class="ig-d">Claude drafts product and service descriptions, for plans with AI descriptions.</p>${env('<code>ANTHROPIC_API_KEY</code>.')}`)}`;
  $('#mailForm', box).addEventListener('submit', async (e) => {
    e.preventDefault(); try { await api('PUT', '/api/platform/mail-server', Object.fromEntries(new FormData(e.target))); toast('Mail server saved. Send a test email to check it.'); integrationsCard(box); } catch (x) { toast(x.message, true); }
  });
  $('#cardSetupForm', box).addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); if (!b.stripePublishableKey) delete b.stripePublishableKey;
    try { await api('PUT', '/api/platform/settings', b); await load(); toast('Card payment setup saved'); integrationsCard(box); } catch (x) { toast(x.message, true); }
  });
  $('#feeForm', box).addEventListener('submit', async (e) => {
    e.preventDefault(); try { await api('PUT', '/api/platform/settings', Object.fromEntries(new FormData(e.target))); await load(); toast('Platform fee saved'); } catch (x) { toast(x.message, true); }
  });
  [['#tEmail', 'test-email', 'Test email sent'], ['#tSms', 'test-sms', 'Test text sent']].forEach(([sel, path, ok]) => {
    const f = $(sel, box); if (f) f.addEventListener('submit', async (e) => {
      e.preventDefault(); try { const r = await api('POST', '/api/platform/' + path, Object.fromEntries(new FormData(f))); toast(r.status === 'sent' ? ok : r.detail || 'Not delivered', r.status !== 'sent'); } catch (x) { toast(x.message, true); }
    });
  });
}

A.rmMailServer = async () => { if (!confirm('Stop sending through your mail server?')) return; await api('DELETE', '/api/platform/mail-server'); toast('Mail server removed'); integrationsCard($('#integ')); };
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
<div class="stats"><div class="card"><div class="l">Articles</div><div class="v">${all.length}</div></div><div class="card"><div class="l">Topics</div><div class="v">${HC.topics.length}</div></div>
<div class="card"><div class="l">Votes</div><div class="v">${votes}</div></div><div class="card"><div class="l">Found it helpful</div><div class="v">${votes ? Math.round((yes / votes) * 100) + '%' : '—'}</div></div></div>
<div class="card"><h2>Articles</h2><div class="hc-tools"><select id="hcTopic" aria-label="Filter by topic"><option value="">All topics</option>${HC.topics.map((t) => `<option value="${esc(t.slug)}" ${t.slug === hcTopic ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select>
<input id="hcQ" type="search" placeholder="Search articles" value="${esc(hcQ)}" aria-label="Search articles"><span class="sm">Sort by Helpful to find the articles that need work first.</span></div>
<div class="tablewrap"><table class="acc hc-table"><thead><tr>${th('order', 'Article')}<th>Topic</th>${th('yes', '👍 Yes', 'r')}${th('no', '👎 No', 'r')}${th('helpful', 'Helpful', 'r')}<th></th></tr></thead><tbody>
${shown.map((a) => `<tr><td><button type="button" class="hc-link" data-act="hcEdit" data-slug="${esc(a.slug)}">${esc(hcFill(a.title))}</button><div class="sm">/articles/${esc(a.slug)}${HC.popular.includes(a.slug) ? ' · <span class="pf-chip">Popular</span>' : ''}</div></td>
<td class="sm">${esc(hcTopicName(a.topic))}</td><td class="r">${a.yes}</td><td class="r">${a.no}</td>
<td class="r">${a.pct === null ? '<span class="sm">No votes</span>' : `<span class="hc-pct ${a.pct >= 70 ? 'ok' : a.pct >= 40 ? 'mid' : 'bad'}">${a.pct}%</span>`}</td>
<td><div class="acts">${canMove ? `<button type="button" class="btn alt sm" data-act="hcMove" data-slug="${esc(a.slug)}" data-dir="up" aria-label="Move up" title="Move up in its topic">↑</button><button type="button" class="btn alt sm" data-act="hcMove" data-slug="${esc(a.slug)}" data-dir="down" aria-label="Move down" title="Move down in its topic">↓</button>` : ''}<a class="btn alt sm" href="${esc(HC.helpUrl)}/articles/${esc(a.slug)}" target="_blank" rel="noopener">View</a></div></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No articles match.</td></tr>'}
</tbody></table></div>${pager}</div>
<div class="card"><h2>What people were looking for</h2><p class="muted" style="font-size:13px;margin-top:0">After voting No, readers can say what was missing. Use it to improve the article.</p>
${HC.comments.length ? `<div class="inq-list">${HC.comments.slice(0, 50).map((c) => `<div class="inq"><div class="inq-h"><div><button type="button" class="hc-link" data-act="hcEdit" data-slug="${esc(c.slug)}">${esc(hcFill((HC.articles.find((a) => a.slug === c.slug) || { title: c.slug }).title))}</button><div class="sm">${esc(new Date(c.at).toLocaleString())}</div></div>
<button type="button" class="btn alt sm" data-act="hcRmComment" data-id="${esc(c.id)}">Delete</button></div><p class="inq-m">${esc(c.text)}</p></div>`).join('')}</div>` : '<p class="muted">Nothing yet.</p>'}</div>
<div class="grid2"><div class="card"><h2>Topics</h2><p class="muted" style="font-size:13px;margin-top:0">The cards on the help center’s home page, in this order. A topic can only be removed once it has no articles.</p><form id="hcTopics"><div id="hcTopicRows"></div>
<div class="foot" style="justify-content:space-between"><button type="button" class="btn alt sm" data-act="hcAddTopic">Add topic</button><button class="btn">Save topics</button></div></form></div>
<div class="card"><h2>Home page</h2><form id="hcHome"><h3 class="hc-h3">Popular articles</h3>${[0, 1, 2].map((i) => `<label class="sr" for="pop${i}">Popular article ${i + 1}</label><select id="pop${i}" name="popular" style="margin-bottom:8px"><option value="">None</option>${HC.articles.map((a) => `<option value="${esc(a.slug)}" ${HC.popular[i] === a.slug ? 'selected' : ''}>${esc(hcFill(a.title))}</option>`).join('')}</select>`).join('')}
<h3 class="hc-h3">Suggested searches</h3><p class="muted" style="font-size:13px;margin:0 0 8px">Shown under the search box, such as “How do I invite my team?”</p>${[0, 1, 2, 3, 4].map((i) => `<input name="suggested" maxlength="100" value="${esc(HC.suggested[i] || '')}" aria-label="Suggested search ${i + 1}" style="margin-bottom:8px">`).join('')}
<div class="foot"><button class="btn">Save home page</button></div></form></div></div>`;
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
A.logout = async () => { await api('POST', '/api/platform/logout', {}); D = null; draftPlans = null; draftBeta = null; boot(); };
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = A[el.dataset.act]; if (!fn) return; e.preventDefault();
  Promise.resolve(fn(el.dataset, el)).catch((x) => toast(x.message, true));
});

async function boot() {
  const state = await api('GET', '/api/platform/state');
  if (!state.admin) { document.title = 'Alpha'; return authView(state); }
  tab = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'accounts';
  await load(); render();
}
boot();
