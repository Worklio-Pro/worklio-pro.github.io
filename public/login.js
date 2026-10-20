'use strict';
// Login page: log in, first-run owner setup, forgot password, and reset (from the emailed ?reset= link).
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const params = new URLSearchParams(location.search);
// only same-site paths, so a crafted link can't send people elsewhere after login
const nextUrl = () => { const n = params.get('next') || '/'; return n.startsWith('/') && !n.startsWith('//') ? n : '/'; };
let state = {};

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
    p.innerHTML = `<form id="f" novalidate>${msg(note && note.text, note && note.kind)}
${field('email', 'Email address*', 'email', 'autocomplete="username" required autofocus')}${field('password', 'Password*', 'password', 'autocomplete="current-password" required')}
<button type="button" class="linkish" data-go="forgot">Forgot password?</button>
<button class="btn go">Log In</button></form>
<p class="alt">Team member without an account? Ask the account owner to set you up.</p>`;
    $('#f').addEventListener('submit', (e) => submit(e, async (b) => { await post('/api/auth/login', b); location.href = nextUrl(); }));
    if (params.get('email')) { $('#f [name=email]').value = params.get('email'); $('#f [name=password]').focus(); } // from sign-up
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
    $('#f').addEventListener('submit', (e) => submit(e, async (b) => { await post('/api/auth/forgot', b); show('login', { text: 'If that email has an account, a reset link is on its way. Check your inbox.', kind: 'ok' }); }));
  } else if (view === 'invite') {
    p.innerHTML = state.invite ? `<h1>Welcome, ${esc(state.invite.name)}</h1><p class="lead">Choose a password to finish setting up your login for ${esc(state.company.name || 'the team')}.</p>
<form id="f" novalidate>${msg(note && note.text)}<label class="of"><span>Email address</span><input value="${esc(state.invite.email)}" readonly autocomplete="username"></label>
${field('password', 'Password* (8+ characters)', 'password', 'autocomplete="new-password" minlength="8" required autofocus')}<button class="btn go">Set password and log in</button></form>`
      : `<h1>Invite link expired</h1>${msg(state.inviteError || 'This invite link has expired or was replaced.')}<p class="lead">Ask the account owner to send you a new invite.</p><p class="alt"><button type="button" class="linkish" data-go="login">Go to log in</button></p>`;
    const f = $('#f'); if (f) f.addEventListener('submit', (e) => submit(e, async (b) => { await post('/api/auth/accept-invite', { token: params.get('invite'), password: b.password }); location.href = '/'; }));
  } else if (view === 'reset') {
    p.innerHTML = `<h1>Choose a new password</h1><p class="lead">You'll be logged in once it's saved, and signed out on other devices.</p>
<form id="f" novalidate>${msg(note && note.text)}${field('password', 'New password* (8+ characters)', 'password', 'autocomplete="new-password" minlength="8" required autofocus')}<button class="btn go">Save password</button></form>`;
    $('#f').addEventListener('submit', (e) => submit(e, async (b) => { await post('/api/auth/reset', { token: params.get('reset'), password: b.password }); location.href = '/'; }));
  }
  const first = p.querySelector('[autofocus]'); if (first && !(view === 'login' && params.get('email'))) first.focus();
}
async function submit(e, fn) {
  e.preventDefault(); const form = e.target; const btn = form.querySelector('.go'); const label = btn.textContent;
  const b = Object.fromEntries(new FormData(form));
  if (b.email !== undefined && !b.email.trim()) return flash(form, 'Enter your email address');
  if (b.password !== undefined && !b.password) return flash(form, 'Enter your password');
  btn.disabled = true; btn.textContent = 'Please wait…';
  try { await fn(b); } catch (err) { flash(form, err.message); btn.disabled = false; btn.textContent = label; }
}
function flash(form, text) { const old = form.querySelector('.msg'); if (old) old.remove(); form.insertAdjacentHTML('afterbegin', msg(text)); }

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]'); if (go) { e.preventDefault(); return show(go.dataset.go); }
  const eye = e.target.closest('[data-eye]');
  if (eye) { const i = eye.parentElement.querySelector('input'); const showing = i.type === 'text'; i.type = showing ? 'password' : 'text'; eye.setAttribute('aria-label', showing ? 'Show password' : 'Hide password'); eye.style.color = showing ? '' : 'var(--link)'; i.focus(); }
});

(async () => {
  try { state = await (await fetch('/api/auth/state')).json(); } catch (e) { state = { company: {} }; }
  const co = state.company || {};
  if (co.brandColor) document.documentElement.style.setProperty('--brand', co.brandColor);
  document.title = `Log in · ${co.name || 'Worklio Pro'}`;
  $('#brand').innerHTML = `${co.logo ? `<img src="${esc(co.logo)}" alt="">` : ''}<span>${esc(co.name || 'Worklio Pro')}</span>`;
  $('#promoCo').textContent = co.name || 'Your business';
  if (params.get('invite')) {
    const r = await fetch('/api/auth/invite?token=' + encodeURIComponent(params.get('invite'))); const j = await r.json().catch(() => ({}));
    if (r.ok) state.invite = j; else state.inviteError = j.error;
    return show('invite');
  }
  if (state.user && !params.get('reset')) { location.href = nextUrl(); return; }
  show(params.get('reset') ? 'reset' : state.needsSetup ? 'setup' : 'login');
})();
