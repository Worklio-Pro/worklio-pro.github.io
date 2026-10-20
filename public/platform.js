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
function modal(title, html) {
  closeModal(); const o = document.createElement('div'); o.className = 'pf-ov'; o.id = 'ov';
  o.innerHTML = `<div class="pf-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${html}</div>`;
  o.addEventListener('mousedown', (e) => { if (e.target === o) closeModal(); }); document.body.appendChild(o);
  const f = $('input,select', o); if (f) f.focus(); return $('.pf-modal', o);
}
function closeModal() { const o = $('#ov'); if (o) o.remove(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
const fmtDate = (s) => (s ? new Date(String(s).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');

let D = null; let tab = 'accounts'; let draftPlans = null; let draftBeta = null; // plans and Beta features being edited (saved with the Save button)
const plansDirty = () => JSON.stringify(draftPlans) !== JSON.stringify(D.plans) || JSON.stringify(draftBeta) !== JSON.stringify(D.betaFeatures);
const host = (u) => String(u || '').replace(/^https?:\/\//, '');

/* ===== login / first-run setup ===== */
function authView(state, err) {
  const setup = state.needsSetup;
  $('#root').innerHTML = `<div class="pf-auth card"><h1>${setup ? 'Create the platform owner' : 'Platform console'}</h1>
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
  accounts: ico('<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4"/>'),
  plans: ico('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14.5 17.5l2 2 4-4"/>'),
  settings: ico('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
};
async function load() { D = await api('GET', '/api/platform/overview'); if (!draftPlans) { draftPlans = structuredClone(D.plans); draftBeta = [...D.betaFeatures]; } }
function render() {
  const tabs = [['accounts', 'Accounts'], ['plans', 'Plans & features'], ['settings', 'Settings']];
  document.title = `${tabs.find((t) => t[0] === tab)[1]} · ${D.settings.productName} platform`;
  $('#root').innerHTML = `<header class="pf-top"><div class="pf-bar"><div class="pf-brand">${esc(D.settings.productName)} <small>Platform</small></div>
<nav class="pf-tabs">${tabs.map(([k, l]) => `<a href="#${k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</nav>
<div class="pf-user"><span>${esc(D.admin.name)}</span><button type="button" data-act="logout">Log out</button></div></div></header>
<main class="pf-main" id="main"></main>
<nav class="pf-bnav" aria-label="Platform sections">${tabs.map(([k, l]) => `<a href="#${k}" class="${tab === k ? 'on' : ''}"${tab === k ? ' aria-current="page"' : ''}>${TAB_ICONS[k]}<span>${l}</span></a>`).join('')}</nav>`;
  ({ accounts: accountsView, plans: plansView, settings: settingsView })[tab]($('#main'));
}
window.addEventListener('hashchange', () => { tab = ['accounts', 'plans', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'accounts'; if (D) render(); });

/* ===== accounts ===== */
const statusChip = (a) => (a.status === 'active' ? `<span class="cstatus active">Active</span>${a.billing && a.billing.status === 'paid' ? `<div class="sm">${a.billing.demo ? 'Demo checkout' : 'Paid by card'}</div>` : ''}`
  : a.status === 'pending' ? '<span class="cstatus">Awaiting payment</span>' : `<span class="cstatus">Paused</span>${a.billing && a.billing.pausedForBilling ? '<div class="sm">Subscription ended</div>' : ''}`);
const planName = (id) => (D.plans.find((p) => p.id === id) || {}).name || id;
function accountsView(main) {
  const active = D.accounts.filter((a) => a.status === 'active').length;
  const byPlan = D.plans.map((p) => `${D.accounts.filter((a) => a.planId === p.id).length} ${esc(p.name)}`).join(' · ');
  main.innerHTML = `<div class="head"><div><h1>Accounts</h1><p class="sub" style="margin:4px 0 0">Each business gets its own web address, data and logins.</p></div><button class="btn" data-act="newAccount">New account</button></div>
${D.devMode ? `<div class="note">Running locally: accounts open at <code>&lt;address&gt;.${esc(D.rootDomain)}</code> in this browser. Set <code>PLATFORM_DOMAIN</code> (e.g. yourapp.com) on your server to give each account <code>&lt;address&gt;.yourapp.com</code>.</div>` : ''}
<div class="stats"><div class="card"><div class="l">Accounts</div><div class="v">${D.accounts.length}</div></div><div class="card"><div class="l">Active</div><div class="v">${active}</div></div>
<div class="card"><div class="l">By plan</div><div style="margin-top:8px;font-size:14px">${byPlan}</div></div><div class="card"><div class="l">Logins across accounts</div><div class="v">${D.accounts.reduce((s, a) => s + a.users, 0)}</div></div></div>
<div class="card"><div class="tablewrap"><table class="acc"><thead><tr><th>Business</th><th>Web address</th><th>Plan</th><th>Status</th><th>Usage</th><th>Created</th><th></th></tr></thead><tbody>
${D.accounts.map((a) => `<tr data-id="${a.id}"><td><div class="nm">${esc(a.name)}${a.isDefault ? ' <span class="pf-chip">Your own account</span>' : ''}</div><div class="sm">${a.owner ? `${esc(a.owner.name)} · ${esc(a.owner.email)}${a.owner.active ? '' : ' · <em>invite not accepted</em>'}` : 'No owner login yet'}</div></td>
<td><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(host(a.url))}</a>${a.domains.length ? `<div class="chips">${a.domains.map((d) => `<span class="pf-chip ${d.verified ? 'ok' : 'wait'}" title="${d.verified ? 'Connected' : 'Waiting for DNS'}">${esc(d.host)}</span>`).join('')}</div>` : ''}</td>
<td><select data-plan="${a.id}" aria-label="Plan for ${esc(a.name)}">${D.plans.map((p) => `<option value="${esc(p.id)}" ${p.id === a.planId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></td>
<td>${statusChip(a)}</td>
<td class="sm">${a.users} login${a.users === 1 ? '' : 's'} · ${a.clients} clients · ${a.jobs} jobs${a.lastLoginAt ? `<br>Last login ${fmtDate(a.lastLoginAt)}` : ''}</td>
<td class="sm">${fmtDate(a.createdAt)}</td>
<td><div class="acts"><button class="btn alt sm" data-act="editAccount" data-id="${a.id}">Manage</button></div></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No accounts yet.</td></tr>'}
</tbody></table></div></div>`;
  $$('[data-plan]', main).forEach((s) => s.addEventListener('change', async () => {
    const a = D.accounts.find((x) => x.id === s.dataset.plan);
    try { await api('PUT', `/api/platform/accounts/${a.id}`, { planId: s.value }); toast(`${a.name} is now on ${planName(s.value)}`); await load(); render(); } catch (e) { toast(e.message, true); s.value = a.planId; }
  }));
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
  const m = modal('New account', `<form id="nf"><label>Business name<input name="name" required maxlength="100"></label>${slugField('slug', '')}
<label>Plan<select name="planId">${D.plans.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}${p.price ? ` (${esc(p.price)})` : ''}</option>`).join('')}</select></label>
<div class="row"><label>Owner’s name<input name="ownerName" required maxlength="100" autocomplete="off"></label><label>Owner’s email<input name="ownerEmail" type="email" required autocomplete="off"></label></div>
<label class="switchline"><input type="checkbox" name="demo"> Start with demo clients, jobs and invoices</label>
<p class="muted" style="font-size:13px;margin:0">The owner gets an email with a link to choose their password. You’ll also see the link here to send yourself.</p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Create account</button></div></form>`);
  const f = $('#nf', m); const check = wireSlug(f, '');
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
  const m = modal(a.name, `<form id="ef"><label>Business name<input name="name" value="${esc(a.name)}" required maxlength="100"></label>${slugField('slug', a.slug)}
<p class="muted" style="font-size:13px;margin:-4px 0 12px">Changing the address breaks links already sent to clients at the old address.</p>
<div class="foot" style="margin-top:0"><button class="btn">Save</button></div></form>
<h3 style="font-size:15px;margin:18px 0 6px">Custom domains</h3>${a.domains.length ? `<table class="acc">${a.domains.map((x) => `<tr><td><strong>${esc(x.host)}</strong>${x.primary ? ' <span class="pf-chip">Main</span>' : ''}<div class="sm">${x.verified ? 'Connected' : 'Waiting for DNS'}</div></td>
<td><div class="acts">${x.verified ? `<button type="button" class="btn alt sm" data-act="domain" data-host="${esc(x.host)}" data-v="0">Unapprove</button>` : `<button type="button" class="btn alt sm" data-act="domain" data-host="${esc(x.host)}" data-v="1" title="Approve without waiting for DNS">Approve</button>`}<button type="button" class="btn danger sm" data-act="domain" data-host="${esc(x.host)}" data-rm="1">Remove</button></div></td></tr>`).join('')}</table>`
    : `<p class="muted" style="font-size:14px;margin:0">None. ${D.plans.find((p) => p.id === a.planId)?.features.includes('customDomain') ? 'The owner can add one under App Settings → Web address.' : 'Their plan doesn’t include custom domains.'}</p>`}
<h3 style="font-size:15px;margin:18px 0 6px">Owner login</h3><p class="muted" style="font-size:14px;margin:0 0 8px">${a.owner ? `${esc(a.owner.name)} (${esc(a.owner.email)}). ${a.owner.active ? 'Get a password reset link if they’re locked out.' : 'They haven’t chosen a password yet.'}` : 'No owner login.'}</p>
${a.owner ? `<button type="button" class="btn alt sm" data-act="ownerLink" data-id="${a.id}">${a.owner.active ? 'Get password reset link' : 'Get a new invite link'}</button>` : ''}
<h3 style="font-size:15px;margin:18px 0 6px">Access</h3><div class="acts" style="justify-content:flex-start"><a class="btn alt sm" href="${esc(a.url)}/login" target="_blank" rel="noopener">Open login page</a>
<button type="button" class="btn alt sm" data-act="resetDemo" data-id="${a.id}">Reset to demo data</button>
${a.isDefault ? '' : `<button type="button" class="btn alt sm" data-act="status" data-id="${a.id}">${a.status === 'active' ? 'Pause account' : 'Resume account'}</button><button type="button" class="btn danger sm" data-act="delAccount" data-id="${a.id}">Delete account</button>`}</div>
${a.status === 'active' ? '' : a.status === 'pending' ? '<p class="muted" style="font-size:13px">Awaiting payment: they signed up for a paid plan but haven’t finished checkout. Resume the account to let them in without paying.</p>' : '<p class="muted" style="font-size:13px">Paused: nobody can log in, and client links show “account paused”. Data is kept.</p>'}
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Close</button></div>`);
  m.dataset.id = a.id;
  const f = $('#ef', m); wireSlug(f, a.slug);
  f.addEventListener('submit', async (e) => { e.preventDefault(); try { await api('PUT', `/api/platform/accounts/${a.id}`, Object.fromEntries(new FormData(f))); toast('Saved'); await load(); render(); A.editAccount({ id: a.id }); } catch (x) { toast(x.message, true); } });
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
<form id="sf" class="card" style="max-width:720px"><h2>Your product</h2>
<div class="row"><label>Product name<input name="productName" value="${esc(s.productName)}" required maxlength="60"></label><label>Contact email<input name="contactEmail" type="email" value="${esc(s.contactEmail)}" placeholder="sales@yourapp.com"></label></div>
<p class="muted" style="font-size:13px;margin-top:-4px">The product name appears on the pricing page and in account emails. Accounts see the contact email when they want to change plans, and new sign-ups are reported to it.</p>
<h2 style="margin-top:20px">Sign-ups</h2>
<label class="switchline"><input type="checkbox" name="allowSignups" ${s.allowSignups ? 'checked' : ''}> Let businesses create an account themselves on the pricing page</label>
<label style="max-width:320px">Plan for businesses that sign up without choosing one<select name="signupPlan">${D.plans.filter((p) => !p.hidden).map((p) => `<option value="${esc(p.id)}" ${p.id === s.signupPlan ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
<p class="muted" style="font-size:13px">Pricing page: <a href="${esc(site)}" target="_blank" rel="noopener">${esc(site)}</a>. Businesses that choose a paid plan pay for it at checkout before their account opens (see Integrations → Stripe below).</p>
<div class="foot" style="display:flex;justify-content:flex-end"><button class="btn">Save settings</button></div></form>
<div class="card" style="max-width:720px" id="inquiries"></div>
<div class="card" style="max-width:720px" id="reserved"></div>
<div class="card" style="max-width:720px" id="integ"><h2>Integrations</h2><p class="muted">Checking…</p></div>
<div class="card" style="max-width:720px"><h2>Web addresses</h2>
${D.devMode ? `<p>You’re running without <code>PLATFORM_DOMAIN</code>, so this server answers as your own account on any address, and other accounts open at <code>&lt;address&gt;.${esc(D.rootDomain)}</code>.</p>` : `<p>Accounts open at <code>&lt;address&gt;.${esc(D.rootDomain)}</code>. The pricing page is at <code>${esc(D.rootDomain)}</code>.</p>`}
<p class="muted" style="font-size:14px">To go live: point <code>*.yourapp.com</code> and <code>yourapp.com</code> at this server in DNS, set <code>PLATFORM_DOMAIN=yourapp.com</code> and <code>BASE_URL=https://yourapp.com</code>, and put an HTTPS proxy in front (the README has a Caddy example that also issues certificates for custom domains).</p></div>`;
  $('#sf').addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); b.allowSignups = !!b.allowSignups;
    try { await api('PUT', '/api/platform/settings', b); await load(); toast('Settings saved'); render(); } catch (x) { toast(x.message, true); }
  });
  inquiriesCard($('#inquiries', main)); reservedCard($('#reserved', main));
  integrationsCard($('#integ', main));
}
// messages from "Contact us" on the pricing page (also emailed to the contact email)
function inquiriesCard(box) {
  const L = D.inquiries || [];
  box.innerHTML = `<h2>Contact requests</h2><p class="muted" style="font-size:13px;margin-top:0">Messages sent with “Contact us” on the <a href="/pricing" target="_blank" rel="noopener">pricing page</a>. ${D.settings.contactEmail ? `Each one is also emailed to ${esc(D.settings.contactEmail)}; reply to that email to answer.` : 'Add a contact email above to get them by email too.'}</p>
${L.length ? `<div class="inq-list">${L.slice(0, 50).map((m) => `<div class="inq"><div class="inq-h"><div><strong>${esc(m.name)}</strong>${m.company ? ` · ${esc(m.company)}` : ''}${m.plan ? ` <span class="pf-chip">${esc(m.plan)}</span>` : ''}
<div class="sm"><a href="mailto:${esc(m.email)}">${esc(m.email)}</a>${m.phone ? ` · <a href="tel:${esc(m.phone)}">${esc(m.phone)}</a>` : ''} · ${esc(new Date(m.at).toLocaleString())}${D.settings.contactEmail && m.emailed === false ? ' · <span style="color:var(--danger)">email not delivered</span>' : ''}</div></div>
<button type="button" class="btn alt sm" data-act="rmInquiry" data-id="${esc(m.id)}">Delete</button></div><p class="inq-m">${esc(m.message)}</p></div>`).join('')}</div>` : '<p class="muted">No messages yet.</p>'}`;
}
A.rmInquiry = async (d) => { if (!confirm('Delete this message?')) return; D.inquiries = await api('DELETE', `/api/platform/inquiries/${encodeURIComponent(d.id)}`); inquiriesCard($('#inquiries')); toast('Message deleted'); };
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
  box.innerHTML = `<h2>Integrations</h2><p class="muted" style="font-size:13px;margin-top:0">Shared by every account. Set these in the <code>.env</code> file next to <code>server.js</code> and restart. Keys are never shown here.</p>
<div class="tablewrap"><table class="acc">
<tr><td><strong>Email</strong><div class="sm">Quotes, invoices, reminders and password resets, sent in each business’s name</div></td><td>${on(I.email, `Connected (${esc(I.email)})`)}</td><td class="sm"><code>GMAIL_USER</code> + <code>GMAIL_APP_PASSWORD</code>, or <code>SENDGRID_API_KEY</code> + <code>EMAIL_FROM</code></td></tr>
<tr><td><strong>Text messages</strong><div class="sm">Twilio, for your own test texts only. Each business connects its own Twilio account in Account Connections</div></td><td>${on(I.sms)}</td><td class="sm"><code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>, <code>TWILIO_FROM</code></td></tr>
<tr><td><strong>AI descriptions</strong><div class="sm">Claude, for plans with AI descriptions</div></td><td>${on(I.ai)}</td><td class="sm"><code>ANTHROPIC_API_KEY</code></td></tr>
<tr><td><strong>Stripe</strong><div class="sm">Your Stripe account: plan payments at sign-up, and “Connect with Stripe” for businesses’ card payments</div></td><td>${S.key ? `${on(true)} <span class="cstatus ${S.mode === 'live' ? 'active' : 'q-sent'}">${S.mode === 'live' ? 'Live' : 'Test mode'}</span>` : on(false)}</td><td class="sm">${S.keyVar ? `Using <code>${S.keyVar}</code>` : '<code>BILLING_STRIPE_SECRET_KEY</code> (or <code>STRIPE_SECRET_KEY</code>)'}</td></tr>
</table></div>
${S.key ? '' : '<div class="note" style="margin-top:12px">Without a Stripe key, sign-up checkout and businesses’ invoice pay pages run demo payments that charge nobody, and businesses can’t connect Stripe.</div>'}
<h3 style="font-size:15px;margin:18px 0 6px">Card payments for businesses (Stripe Connect)</h3>
<p class="muted" style="font-size:14px;margin:0 0 8px">Each business clicks <strong>Connect with Stripe</strong> in its App Settings, sets up its own Stripe account on Stripe’s pages, and clients’ payments go straight to it. ${I.connected} account${I.connected === 1 ? ' has' : 's have'} started connecting. One-time setup: turn on <strong>Connect</strong> in your Stripe dashboard (Settings → Connect).</p>
<form id="feeForm" class="inline-form"><label>Your platform fee on each card payment (%)<input name="platformFeePercent" type="number" min="0" max="30" step="0.1" value="${esc(D.settings.platformFeePercent || 0)}"></label><button class="btn alt">Save fee</button></form>
<p class="muted" style="font-size:13px;margin:0 0 6px">Payment confirmations: ${on(S.connectWebhook, 'Webhook connected', 'Webhook not set up')} In Stripe, add a webhook for <strong>events on connected accounts</strong> with <code>checkout.session.completed</code>, <code>checkout.session.async_payment_succeeded</code> and <code>account.updated</code>, then put its signing secret in <code>STRIPE_CONNECT_WEBHOOK_SECRET</code>.</p>
${copy(S.connectWebhookUrl, 'Connect webhook URL')}
<h3 style="font-size:15px;margin:18px 0 6px">Plan payments at sign-up</h3>
<p class="muted" style="font-size:13px;margin:0 0 6px">${on(S.billingWebhook, 'Webhook connected', 'Webhook not set up')} Optional: add a webhook on your own account for <code>checkout.session.completed</code>, <code>customer.subscription.updated</code> and <code>customer.subscription.deleted</code>, with its signing secret in <code>BILLING_STRIPE_WEBHOOK_SECRET</code>. It pauses accounts whose subscription ends.</p>
${copy(S.billingWebhookUrl, 'Billing webhook URL')}
${I.localhost ? '<p class="muted" style="font-size:13px">Stripe can’t reach localhost: set <code>BASE_URL</code> (or <code>PLATFORM_DOMAIN</code>) to your public address first.</p>' : ''}
<h3 style="font-size:15px;margin:18px 0 6px">Send a test</h3>
${I.email ? '<form id="tEmail" class="inline-form"><label>Test email to<input name="to" type="email" required placeholder="you@example.com"></label><button class="btn alt">Send test email</button></form>' : ''}
${I.sms ? '<form id="tSms" class="inline-form"><label>Test text to<input name="to" required placeholder="+17135550100"></label><button class="btn alt">Send test text</button></form>' : ''}
${!I.email && !I.sms ? '<p class="muted" style="font-size:14px;margin:0">Connect email or text messages to send a test. Until then, messages are recorded in each account’s Notifications Log but not delivered.</p>' : ''}`;
  $('#feeForm', box).addEventListener('submit', async (e) => {
    e.preventDefault(); try { await api('PUT', '/api/platform/settings', Object.fromEntries(new FormData(e.target))); await load(); toast('Platform fee saved'); } catch (x) { toast(x.message, true); }
  });
  [['#tEmail', 'test-email', 'Test email sent'], ['#tSms', 'test-sms', 'Test text sent']].forEach(([sel, path, ok]) => {
    const f = $(sel, box); if (f) f.addEventListener('submit', async (e) => {
      e.preventDefault(); try { const r = await api('POST', '/api/platform/' + path, Object.fromEntries(new FormData(f))); toast(r.status === 'sent' ? ok : r.detail || 'Not delivered', r.status !== 'sent'); } catch (x) { toast(x.message, true); }
    });
  });
}

/* ===== actions ===== */
A.closeModal = closeModal;
A.logout = async () => { await api('POST', '/api/platform/logout', {}); D = null; draftPlans = null; draftBeta = null; boot(); };
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const fn = A[el.dataset.act]; if (!fn) return; e.preventDefault();
  Promise.resolve(fn(el.dataset, el)).catch((x) => toast(x.message, true));
});

async function boot() {
  const state = await api('GET', '/api/platform/state');
  if (!state.admin) { document.title = 'Platform console'; return authView(state); }
  tab = ['accounts', 'plans', 'settings'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'accounts';
  await load(); render();
}
boot();
