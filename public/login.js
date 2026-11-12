'use strict';
// Login page: log in, first-run owner setup, forgot password, and reset (from the emailed ?reset= link).
// On the platform's own address (/sign-in, <body data-central>) it's the one login for every business: the email finds the business, or a list to choose from.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const params = new URLSearchParams(location.search);
// only same-site paths, so a crafted link can't send people elsewhere after login
const nextUrl = () => { const n = params.get('next') || '/'; return n.startsWith('/') && !n.startsWith('//') ? n : '/'; };
let state = {};
const central = document.body.hasAttribute('data-central');
let signIn = null; // central: the email and password while a business is chosen ({ pick: true } after Continue with Google / Apple)
// Continue with Google / Apple: always through the platform address; a business's own page says which business it is
const oauthHref = (p) => central ? `/sign-in/${p}?${new URLSearchParams({ next: nextUrl() })}`
  : `${state.signInWith.start}/${p}?${new URLSearchParams({ account: state.signInWith.account, next: nextUrl() })}`;
const oauthRow = () => (window.oauthButtons ? oauthButtons(central ? state.providers : state.signInWith && state.signInWith.providers, oauthHref, 'or log in with email') : '');

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.');
  return j;
}
const field = (name, label, type = 'text', extra = '') => `<label class="of${type === 'password' ? ' pw' : ''}"><span>${label}</span><input name="${name}" type="${type}" ${extra}>${type === 'password'
  ? '<button type="button" class="eye" aria-label="Show password" data-eye><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg></button>' : ''}</label>`;
const msg = (text, kind = 'err') => (text ? `<p class="msg ${kind}" role="${kind === 'err' ? 'alert' : 'status'}">${esc(text)}</p>` : '');

function show(view, note) {
  const p = $('#panel');
  if (view === 'login') {
    p.innerHTML = `${msg(note && note.text, note && note.kind)}${oauthRow()}<form id="f" novalidate>
${field('email', 'Email address*', 'email', 'autocomplete="username" required autofocus')}${field('password', 'Password*', 'password', 'autocomplete="current-password" required')}
<button type="button" class="linkish" data-go="forgot">Forgot password?</button>
<button class="btn go">Log In</button></form>
<p class="alt">Team member without an account? Ask the account owner to set you up.</p>${central ? `<p class="alt">New to ${esc(state.product.name || 'Worklio Pro')}? <a href="/pricing">Get started</a></p>` : ''}`;
    $('#f').addEventListener('submit', (e) => submit(e, central ? (b) => centralLogin(b) : async (b) => after(await post('/api/auth/login', b), nextUrl())));
    if (params.get('email')) { $('#f [name=email]').value = params.get('email'); $('#f [name=password]').focus(); } // from sign-up
  } else if (view === 'choose') {
    p.innerHTML = `<h1>Choose a business</h1><p class="lead">${state.pickEmail ? `${esc(state.pickEmail)} logs in to more than one business.` : 'Your email logs in to more than one business.'}</p>${msg(note && note.text)}
<div class="pick">${state.accounts.map((a) => `<button type="button" class="pick-row" data-account="${esc(a.id)}"><strong>${esc(a.name)}</strong><small>${esc(a.address)}</small></button>`).join('')}</div>
<p class="alt"><button type="button" class="linkish" data-go="login">Use a different email</button></p>`;
  } else if (view === 'setup') {
    p.innerHTML = `<h1>Create your owner account</h1><p class="lead">This is the first sign-in for ${esc(state.company.name || 'your business')}. You'll use it to log in from now on.</p>
<form id="f" novalidate>${msg(note && note.text)}${field('name', 'Your name*', 'text', 'autocomplete="name" required autofocus')}${field('email', 'Email address*', 'email', 'autocomplete="username" required')}
${field('password', 'Password* (8+ characters)', 'password', 'autocomplete="new-password" minlength="8" required')}<button class="btn go">Create account</button></form>`;
    $('#f').addEventListener('submit', (e) => submit(e, async (b) => { await post('/api/auth/setup', b); location.href = nextUrl(); }));
  } else if (view === 'forgot') {
    p.innerHTML = `<h1>Reset your password</h1><p class="lead">Enter your email and we'll send you a link to choose a new password.</p>
<form id="f" novalidate>${msg(note && note.text)}${state.emailReady ? '' : msg('Email sending isn’t set up on this server yet, so the reset email can’t be delivered. The account owner can reset a password from the server instead.', 'err')}
${field('email', 'Email address*', 'email', 'autocomplete="username" required autofocus')}<button class="btn go">Send reset link</button></form>
<p class="alt"><button type="button" class="linkish" data-go="login">Back to log in</button></p>`;
    $('#f').addEventListener('submit', (e) => submit(e, async (b) => { await post(central ? '/api/site/forgot' : '/api/auth/forgot', b); show('login', { text: central ? 'If that email has an account, a reset link is on its way from each business it logs in to. Check your inbox.' : 'If that email has an account, a reset link is on its way. Check your inbox.', kind: 'ok' }); }));
  } else if (view === 'invite') {
    p.innerHTML = state.invite ? `<h1>Welcome, ${esc(state.invite.name)}</h1><p class="lead">Choose a password to finish setting up your login for ${esc(state.company.name || 'the team')}.</p>
<form id="f" novalidate>${msg(note && note.text)}<label class="of"><span>Email address</span><input value="${esc(state.invite.email)}" readonly autocomplete="username"></label>
${field('password', 'Password* (8+ characters)', 'password', 'autocomplete="new-password" minlength="8" required autofocus')}<button class="btn go">Set password and log in</button></form>`
      : `<h1>Invite link expired</h1>${msg(state.inviteError || 'This invite link has expired or was replaced.')}<p class="lead">Ask the account owner to send you a new invite.</p><p class="alt"><button type="button" class="linkish" data-go="login">Go to log in</button></p>`;
    const f = $('#f'); if (f) f.addEventListener('submit', (e) => submit(e, async (b) => { after(await post('/api/auth/accept-invite', { token: params.get('invite'), password: b.password }), '/'); }));
  } else if (view === 'reset') {
    p.innerHTML = `<h1>Choose a new password</h1><p class="lead">You'll be logged in once it's saved, and signed out on other devices.</p>
<form id="f" novalidate>${msg(note && note.text)}${field('password', 'New password* (8+ characters)', 'password', 'autocomplete="new-password" minlength="8" required autofocus')}<button class="btn go">Save password</button></form>`;
    $('#f').addEventListener('submit', (e) => submit(e, async (b) => { after(await post('/api/auth/reset', { token: params.get('reset'), password: b.password }), '/'); }));
  } else if (view === 'twoStep') { // the second step: the code from the app, or (first time, when the company requires it) set up the app
    const T = state.twoStep; const setup = T.need === 'setup' && T.setup;
    p.innerHTML = `<h1>${setup ? 'Set up two-step login' : 'Two-step login'}</h1>
${setup ? `<p class="lead">${esc(state.company.name || 'Your company')} requires a code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, Authy, 1Password…) each time you log in. Open the app, add an account, and scan this QR code.</p>
<div class="ts-qr">${window.qrSvg ? qrSvg(setup.uri) : ''}</div><details class="ts-key"><summary>Can’t scan it?</summary><p>In the app, add an account by hand (time-based) with this key:</p><code>${esc(setup.secret.replace(/(.{4})/g, '$1 ').trim())}</code></details>`
    : '<p class="lead">Enter the 6-digit code your authenticator app shows. Don’t have your phone? Enter one of your backup codes.</p>'}
<form id="f" novalidate>${msg(note && note.text)}<label class="of"><span>${setup ? 'The 6-digit code the app now shows*' : 'Code*'}</span><input name="otp" class="ts-otp" required autofocus autocomplete="one-time-code" ${setup ? 'inputmode="numeric" maxlength="6"' : 'maxlength="12" autocapitalize="off" spellcheck="false"'} placeholder="123456"></label>
<button class="btn go">${setup ? 'Turn on and log in' : 'Log In'}</button></form>
<p class="alt"><button type="button" class="linkish" data-go="startOver">Back to log in</button></p>`;
    $('#f').addEventListener('submit', (e) => submit(e, async (b) => {
      if (!String(b.otp || '').trim()) throw new Error('Enter the code');
      let r; try { r = await post('/api/auth/two-step', { otp: b.otp }); } catch (err) { if (/expired/.test(err.message)) { state.twoStep = null; return show('login', { text: err.message }); } throw err; }
      if (r.backupCodes) { state.backupCodes = r.backupCodes; return show('backup'); }
      location.href = state.after || nextUrl();
    }));
  } else if (view === 'backup') { // shown once, right after it's turned on
    const codes = state.backupCodes;
    p.innerHTML = `<h1>Two-step login is on</h1><p class="lead">If you lose your phone, each of these codes logs you in once instead of the app’s code. Keep them somewhere safe, like a password manager. They won’t be shown again.</p>
<ol class="ts-codes">${codes.map((c) => `<li><code>${esc(c)}</code></li>`).join('')}</ol>
<p class="alt" style="text-align:left"><button type="button" class="linkish" data-copy-codes>Copy</button> · <button type="button" class="linkish" data-save-codes>Download</button></p>
<button type="button" class="btn go" data-codes-done>I’ve saved them</button>`;
  }
  const first = p.querySelector('[autofocus]'); if (first && !(view === 'login' && params.get('email'))) first.focus();
}
// the panel beside the form: an ad, update or notice set in Alpha → Settings → Login page
function promo(L) {
  if (!L || !L.show) { $('.auth').classList.add('solo'); return; }
  $('#promoHead').textContent = L.headline || '';
  const tag = $('#promoTag'); tag.textContent = L.tag || ''; tag.hidden = !L.tag;
  const link = L.buttonUrl && L.buttonLabel ? `<a class="btn" href="${esc(L.buttonUrl)}"${/^https?:/i.test(L.buttonUrl) ? ' target="_blank" rel="noopener"' : ''}>${esc(L.buttonLabel)}</a>` : '';
  $('#promoBody').innerHTML = `${L.title ? `<h2>${esc(L.title)}</h2>` : ''}${L.body ? `<p>${esc(L.body).replace(/\n/g, '<br>')}</p>` : ''}${(L.bullets || []).length ? `<ul>${L.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}${link}`;
  $('.auth-side').hidden = false;
}
// central: one business opens straight away; several show the list
async function centralLogin(b) {
  const r = await post('/api/site/sign-in', { ...b, next: nextUrl() }); // e.g. Create Post on ideas.<domain> opens the Board with the post filled in
  if (r.url) { location.href = r.url; return; }
  signIn = { email: b.email, password: b.password }; state.accounts = r.accounts; show('choose');
}
// a reply from login, invite or reset: logged in (go on), or { twoStep } (ask for the code)
function after(r, to) { if (r && r.twoStep) { state.twoStep = r.twoStep; state.after = to; return show('twoStep'); } location.href = to; }
async function submit(e, fn) {
  e.preventDefault(); const form = e.target; const btn = form.querySelector('.go'); const label = btn.textContent;
  const b = Object.fromEntries(new FormData(form));
  if (b.email !== undefined && !b.email.trim()) return flash(form, 'Enter your email address');
  if (b.password !== undefined && !b.password) return flash(form, 'Enter your password');
  btn.disabled = true; btn.textContent = 'Please wait…';
  try { await fn(b); } catch (err) { flash(form, err.message); btn.disabled = false; btn.textContent = label; }
}
// clears every message on the panel, including a note above the Google / Apple buttons
function flash(form, text) { document.querySelectorAll('#panel .msg').forEach((x) => x.remove()); form.insertAdjacentHTML('afterbegin', msg(text)); }

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go && go.dataset.go === 'startOver') { e.preventDefault(); state.twoStep = null; fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); return show('login'); } // drops the half-done login
  if (go) { e.preventDefault(); signIn = null; return show(go.dataset.go); }
  const codesText = () => `${state.company && state.company.name ? state.company.name + ' – ' : ''}backup codes for two-step login (each works once)\n\n${(state.backupCodes || []).join('\n')}\n`;
  if (e.target.closest('[data-copy-codes]')) navigator.clipboard.writeText(codesText()).then(() => { e.target.textContent = 'Copied'; }).catch(() => {});
  if (e.target.closest('[data-save-codes]')) { const u = URL.createObjectURL(new Blob([codesText()], { type: 'text/plain' })); const l = document.createElement('a'); l.href = u; l.download = 'backup-codes.txt'; l.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
  if (e.target.closest('[data-codes-done]')) location.href = state.after || nextUrl();
  const acct = e.target.closest('[data-account]');
  if (acct && signIn) {
    document.querySelectorAll('[data-account]').forEach((x) => { x.disabled = true; }); acct.querySelector('small').textContent = 'Opening…';
    post('/api/site/sign-in', { ...signIn, account: acct.dataset.account, next: nextUrl() }).then((r) => { location.href = r.url; })
      .catch((err) => { if (/match|Too many|expired/.test(err.message)) { signIn = null; show('login', { text: err.message }); } else show('choose', { text: err.message }); });
  }
  const eye = e.target.closest('[data-eye]');
  if (eye) { const i = eye.parentElement.querySelector('input'); const showing = i.type === 'text'; i.type = showing ? 'password' : 'text'; eye.setAttribute('aria-label', showing ? 'Show password' : 'Hide password'); eye.style.color = showing ? '' : 'var(--link)'; i.focus(); }
});

(async () => {
  if (central) {
    try { state = await (await fetch('/api/site/sign-in')).json(); } catch (e) { state = {}; }
    state.product = state.product || {}; const name = state.product.name || 'Worklio Pro';
    document.title = `Log in · ${name}`;
    $('#brand').innerHTML = `${brandImg(state.product)}${state.product.logoHasName ? '' : `<span>${esc(name)}</span>`}`;
    $('#promoCo').textContent = name; promo(state.loginPanel);
    const oauthError = params.get('oauth_error');
    if (params.get('pick')) { // back from Google / Apple with an email in several businesses
      const r = await fetch('/api/site/sign-in/pick'); const j = await r.json().catch(() => ({}));
      history.replaceState(null, '', oauthClean());
      if (r.ok && j.accounts.length) { signIn = { pick: true }; state.accounts = j.accounts; state.pickEmail = j.email; return show('choose'); }
      return show('login', { text: j.error || 'That sign-in expired. Try again.' });
    }
    if (oauthError) history.replaceState(null, '', oauthClean());
    return show('login', oauthError ? { text: oauthError } : undefined);
  }
  try { state = await (await fetch('/api/auth/state')).json(); } catch (e) { state = { company: {} }; }
  const co = state.company || {};
  document.title = `Log in · ${co.name || 'Worklio Pro'}`;
  $('#brand').innerHTML = `${co.logo ? `<img src="${esc(co.logo)}" alt="">` : ''}<span>${esc(co.name || 'Worklio Pro')}</span>`;
  const product = state.product || {}; // the Worklio Pro logo from the platform console, on the panel beside the form
  $('#promoCo').innerHTML = `${brandImg(product, 'dark')}${product.logoHasName ? '' : `<span>${esc(product.name || 'Worklio Pro')}</span>`}`;
  promo(state.loginPanel);
  if (params.get('invite')) {
    const r = await fetch('/api/auth/invite?token=' + encodeURIComponent(params.get('invite'))); const j = await r.json().catch(() => ({}));
    if (r.ok) state.invite = j; else state.inviteError = j.error;
    return show('invite');
  }
  if (state.user && !params.get('reset')) { location.href = nextUrl(); return; }
  if (state.twoStep && !params.get('reset')) return show('twoStep');
  if (params.get('oauth_error')) { const t = params.get('oauth_error'); history.replaceState(null, '', oauthClean()); if (!state.needsSetup && !params.get('reset')) return show('login', { text: t }); }
  show(params.get('reset') ? 'reset' : state.needsSetup ? 'setup' : 'login');
})();
