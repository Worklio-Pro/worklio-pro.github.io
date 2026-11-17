// Keys that used to live only in .env, now also set in Alpha → Settings → Integrations (AI, Text messages, Google login, Stock photos).
// A key saved in Alpha is kept in platform.json and put into process.env when the server starts and when it's saved, so every place
// that reads process.env picks it up with no restart. Removing it brings back the .env value, if there was one.
const tenancy = require('./tenancy');

// the keys each card sets; secret: never shown back, only its last 4 characters
const GROUPS = {
  ai: [{ name: 'ANTHROPIC_API_KEY', secret: true, test: /^sk-ant-[\w-]{20,}$/, hint: 'Paste the API key from the Claude Console (it starts with sk-ant-)' }],
  sms: [
    { name: 'TWILIO_ACCOUNT_SID', test: /^AC[0-9a-f]{32}$/i, hint: 'Paste the Account SID from your Twilio console (AC followed by 32 letters and numbers)' },
    { name: 'TWILIO_AUTH_TOKEN', secret: true, test: /^[0-9a-f]{32}$/i, hint: 'Paste the Auth Token from your Twilio console (32 letters and numbers)' },
    { name: 'TWILIO_FROM', test: /^(\+[1-9]\d{6,14}|MG[0-9a-f]{32})$/i, hint: 'Enter your Twilio number with its country code (e.g. +15125550100), or a Messaging Service SID starting with MG' },
  ],
  // Marketing → Plan: stock photos of each post's subject (lib/stock-photos.js)
  photos: [{ name: 'PEXELS_API_KEY', secret: true, test: /^[A-Za-z0-9]{30,100}$/, hint: 'Paste the API key from pexels.com/api (letters and numbers)' }],
  googleLogin: [
    { name: 'LOGIN_GOOGLE_CLIENT_ID', test: /^[\w.-]+\.apps\.googleusercontent\.com$/, hint: 'Paste the Client ID from Google Cloud (it ends in .apps.googleusercontent.com)' },
    { name: 'LOGIN_GOOGLE_CLIENT_SECRET', secret: true, test: /^[\w-]{10,}$/, hint: 'Paste the Client secret from Google Cloud' },
  ],
};
const orig = {}; // what .env had, before any saved key
const saved = () => tenancy.platform().envKeys || {};
const fail = (message) => Object.assign(new Error(message), { status: 400 });

function apply(name) { const v = saved()[name]; if (v) process.env[name] = v; else if (orig[name]) process.env[name] = orig[name]; else delete process.env[name]; }
function init() {
  for (const list of Object.values(GROUPS)) for (const k of list) { orig[k.name] = process.env[k.name] || ''; apply(k.name); }
}
// b: { NAME: value }. A blank secret keeps the saved one; the card saves all its keys together, so they come from one place
function save(group, b) {
  const list = GROUPS[group]; if (!list) throw Object.assign(new Error('Unknown setting'), { status: 404 });
  const next = {};
  for (const k of list) {
    const v = String((b || {})[k.name] || '').trim() || (k.secret ? saved()[k.name] || '' : '');
    if (!v) throw fail(k.hint); if (!k.test.test(v)) throw fail(k.hint);
    next[k.name] = v;
  }
  tenancy.platform().envKeys = { ...saved(), ...next }; tenancy.savePlatform(); list.forEach((k) => apply(k.name));
}
function remove(group) {
  const list = GROUPS[group]; if (!list) throw Object.assign(new Error('Unknown setting'), { status: 404 });
  const s = { ...saved() }; list.forEach((k) => delete s[k.name]); tenancy.platform().envKeys = s; tenancy.savePlatform(); list.forEach((k) => apply(k.name));
}
// for Alpha: never a secret itself
const view = () => Object.fromEntries(Object.entries(GROUPS).map(([g, list]) => [g, {
  saved: list.some((k) => saved()[k.name]), fromEnv: !list.some((k) => saved()[k.name]) && list.every((k) => orig[k.name]),
  keys: Object.fromEntries(list.map((k) => { const v = process.env[k.name] || ''; return [k.name, k.secret ? (v ? `…${v.slice(-4)}` : '') : v]; })),
}]));

module.exports = { GROUPS, init, save, remove, view };
