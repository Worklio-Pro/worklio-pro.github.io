// Spam protection for the public forms (contact, help center, sign-up, partners, chat, and each business's booking, referral and business page forms).
// Nothing for real people to do: the checks are invisible.
//   1. a stamp of when the page was opened, signed by the server (GET /api/hc, or a hidden field on server-made pages):
//      a form sent without one, with a forged one, or within a few seconds of opening the page didn't come from a person on the page
//   2. a real tap, click or keypress on the page (the browser marks those isTrusted; a script posting the form makes none)
//   3. the hidden "website" field that only bots fill in
//   4. what spam looks like: links in a name, a pile of links in a message, names like "LZjtYwPqoKFa"
// Bots caught by 3 or 4 get the normal "sent" answer, so they don't try again; nothing is saved or emailed.
// 1 and 2 answer with a short note instead, in case a real person ever trips them (they can just send again).
const crypto = require('crypto');
const tenancy = require('./tenancy');

const MIN_MS = 3000; // a person takes longer than this to fill in a form
const MAX_MS = 7 * 864e5; // a stamp from a tab left open for a week is too old
const key = () => { const P = tenancy.platform(); if (!P.formKey) { P.formKey = crypto.randomBytes(32).toString('hex'); tenancy.savePlatform(); } return P.formKey; };
const mac = (t) => crypto.createHmac('sha256', key()).update('hc|' + t).digest('base64url').slice(0, 22);
const stamp = () => { const t = Date.now().toString(36); return `${t}.${mac(t)}`; };
const age = (s) => {
  const m = /^([a-z0-9]{6,12})\.([\w-]{22})$/.exec(String(s || '')); if (!m) return null;
  const a = Buffer.from(mac(m[1])); const b = Buffer.from(m[2]); if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return Date.now() - parseInt(m[1], 36);
};

const LINK = /https?:\/\/|www\.|\[url|<a\s/gi;
const links = (s) => (String(s || '').match(LINK) || []).length;
// one long word with capitals scattered through it: "LZjtYwPqoKFa" (McDonald, MacKenzie and JoAnne are fine)
const junkName = (s) => { const w = String(s || '').trim(); return !/\s/.test(w) && w.length >= 8 && (w.slice(1).match(/[A-Z]/g) || []).length >= 3 && (w.match(/[a-z]/g) || []).length >= 3; };

// b: the form's fields. names: a person's name (no links, no junk); orgs: a business name (no links: "TLBGroup" is a fine
// business name, so the junk check isn't used there); texts: free-text fields.
// Returns null when it looks like a person, { bot } to quietly drop it, or { error } to show.
function check(b, { form = 'form', ip = '', names = ['name'], orgs = ['company'], texts = ['message'], min = MIN_MS } = {}) {
  b = b || {}; let why = '';
  if (b.website) why = 'hidden field filled in';
  else if (names.some((k) => links(b[k]) || junkName(b[k])) || orgs.some((k) => links(b[k]))) why = 'link or junk in a name';
  else if (texts.reduce((n, k) => n + links(b[k]), 0) >= 3) why = 'too many links';
  if (why) { console.log(`[spam] ${form}: blocked (${why}) from ${ip}`); return { bot: why }; }
  const a = age(b.hc);
  if (a === null || a > MAX_MS) { console.log(`[spam] ${form}: no valid page stamp from ${ip}`); return { error: a === null ? 'Something went wrong sending this. Reload the page and try again.' : 'This page has been open a long time. Reload it and send again.' }; }
  if (a < min) { console.log(`[spam] ${form}: sent ${a} ms after opening, from ${ip}`); return { error: 'That was fast! Check your details, then send again.' }; }
  if (String(b.hi) !== '1') { console.log(`[spam] ${form}: no tap or keypress, from ${ip}`); return { error: 'Something went wrong sending this. Reload the page and try again.' }; }
  return null;
}

// GET /api/hc on every address: a fresh stamp for pages that aren't made by the server
function serve(req, res) {
  if (req.url.split('?')[0] !== '/api/hc' || req.method !== 'GET') return false;
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ t: stamp() })); return true;
}

// for server-made forms: the stamp, and a field set to 1 by the first real tap, click or keypress
const fields = () => `<input type="hidden" name="hc" value="${stamp()}"><input type="hidden" name="hi" value="">`
  + '<script>(function(){var d=function(e){if(!e.isTrusted)return;document.querySelectorAll(\'input[name=hi]\').forEach(function(i){i.value=\'1\'});};[\'pointerdown\',\'keydown\',\'input\'].forEach(function(n){addEventListener(n,d,true)});})();</script>';

module.exports = { check, serve, stamp, fields };
