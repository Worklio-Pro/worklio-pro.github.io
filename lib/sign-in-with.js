'use strict';
// "Continue with Google" and "Continue with Apple": sign up and log in with a Google or Apple account instead of a password.
// Both sign-ins return to the platform address (<platform address>/sign-in/<provider>/callback); lib/platform.js finds the business
// by the email the provider has confirmed. The buttons only show once a provider's keys are set:
//   Google: LOGIN_GOOGLE_CLIENT_ID / LOGIN_GOOGLE_CLIENT_SECRET, or the Google app in Alpha → Settings → Integrations (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)
//   Apple:  APPLE_SERVICES_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY (the .p8 file's text) or APPLE_PRIVATE_KEY_PATH
const fs = require('fs');
const crypto = require('crypto');
const tenancy = require('./tenancy');
const social = require('./social');

const PROVIDERS = { google: 'Google', apple: 'Apple' };
const redirectUri = (p) => `${tenancy.platformUrl()}/sign-in/${p}/callback`;

function googleKeys() {
  if (process.env.LOGIN_GOOGLE_CLIENT_ID) return { id: process.env.LOGIN_GOOGLE_CLIENT_ID, secret: process.env.LOGIN_GOOGLE_CLIENT_SECRET || '' };
  const a = social.apps().google; return { id: a.id, secret: a.secret };
}
function appleKey() {
  const raw = process.env.APPLE_PRIVATE_KEY || (process.env.APPLE_PRIVATE_KEY_PATH && fs.existsSync(process.env.APPLE_PRIVATE_KEY_PATH) ? fs.readFileSync(process.env.APPLE_PRIVATE_KEY_PATH, 'utf8') : '');
  return raw.replace(/\\n/g, '\n').trim(); // a key pasted on one line in .env keeps its line breaks as \n
}
function ready(p) {
  if (p === 'google') { const k = googleKeys(); return !!(k.id && k.secret); }
  if (p === 'apple') return !!(process.env.APPLE_SERVICES_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && appleKey());
  return false;
}
// for the pages: which buttons to show
const available = () => Object.keys(PROVIDERS).filter(ready);

// Apple's "client secret" is a short-lived ES256 token signed with the .p8 key
function appleSecret() {
  const now = Math.floor(Date.now() / 1000); const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = `${b64({ alg: 'ES256', kid: process.env.APPLE_KEY_ID })}.${b64({ iss: process.env.APPLE_TEAM_ID, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: process.env.APPLE_SERVICES_ID })}`;
  const sig = crypto.sign('sha256', Buffer.from(body), { key: crypto.createPrivateKey(appleKey()), dsaEncoding: 'ieee-p1363' });
  return `${body}.${sig.toString('base64url')}`;
}

// where the person goes to sign in. state is signed (lib/social.js) and carries the nonce that the browser's cookie must match.
function authorizeUrl(p, state) {
  if (p === 'google') return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: googleKeys().id, redirect_uri: redirectUri('google'), response_type: 'code', scope: 'openid email profile', prompt: 'select_account', state });
  // Apple sends the name only the first time, and only with form_post (a POST back to the callback)
  return 'https://appleid.apple.com/auth/authorize?' + new URLSearchParams({ client_id: process.env.APPLE_SERVICES_ID, redirect_uri: redirectUri('apple'), response_type: 'code', scope: 'name email', response_mode: 'form_post', state });
}

const fail = (msg) => Object.assign(new Error(msg), { status: 400 });
// the code from the callback → { email, name, sub }. The ID token comes straight from the provider over HTTPS in exchange for
// our secret, so its claims are trusted as they are; the audience, issuer, expiry and confirmed email are still checked.
async function finish(p, code, appleUser) {
  const google = p === 'google'; const k = google ? googleKeys() : null;
  const r = await fetch(google ? 'https://oauth2.googleapis.com/token' : 'https://appleid.apple.com/auth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, signal: AbortSignal.timeout(15000),
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(p), client_id: google ? k.id : process.env.APPLE_SERVICES_ID, client_secret: google ? k.secret : appleSecret() }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id_token) { console.error(`${PROVIDERS[p]} sign-in:`, r.status, j.error || '', j.error_description || ''); throw fail(`${PROVIDERS[p]} didn’t finish signing you in. Try again.`); }
  let c; try { c = JSON.parse(Buffer.from(String(j.id_token).split('.')[1], 'base64url').toString()); } catch (e) { throw fail(`${PROVIDERS[p]} sent something unexpected. Try again.`); }
  const aud = google ? k.id : process.env.APPLE_SERVICES_ID;
  const issOk = google ? ['https://accounts.google.com', 'accounts.google.com'].includes(c.iss) : c.iss === 'https://appleid.apple.com';
  if ((Array.isArray(c.aud) ? !c.aud.includes(aud) : c.aud !== aud) || !issOk || !(c.exp * 1000 > Date.now())) throw fail(`${PROVIDERS[p]} sign-in couldn’t be checked. Try again.`);
  const email = String(c.email || '').trim().toLowerCase();
  if (!email || !(c.email_verified === true || c.email_verified === 'true')) throw fail(`Your ${PROVIDERS[p]} account doesn’t have a confirmed email address. Log in with your email and password instead.`);
  let name = google ? String(c.name || '').trim() : '';
  if (!google && appleUser) { try { const u = JSON.parse(appleUser); name = [u.name && u.name.firstName, u.name && u.name.lastName].filter(Boolean).join(' ').trim(); } catch (e) { /* no name sent */ } }
  return { email, name: name.slice(0, 100), sub: String(c.sub || '') };
}

module.exports = { PROVIDERS, ready, available, authorizeUrl, finish, redirectUri, sign: social.sign, verify: social.verify };
