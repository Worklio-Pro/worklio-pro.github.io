// Languages for what a business's clients see: quote and invoice emails, PDFs, the quote page and the pay page.
// Each client has a language (client.lang); blank means the business's default (company.clientLang, App Settings → General → Languages).
//
// Text is written in English in the code and looked up by that English: tx('Subtotal') is "Subtotal" in English and the
// dictionary's "Subtotal" in Spanish. {name} in the text is filled from the values passed: tx('Pay {amount} with card', { amount }).
// A phrase missing from a dictionary shows in English, so nothing is ever blank.
//
// Adding a language: a dictionary file in lib/i18n/ (copy es.js), a line in LANGUAGES, then `node lib/i18n.js` to list anything missing.
// A regional variant (say es-ES) can hold only the phrases that differ: `base` names the language it falls back to.
const { AsyncLocalStorage } = require('async_hooks');

const LANGUAGES = {
  en: { name: 'English', native: 'English', locale: 'en-US' },
  es: { name: 'Spanish', native: 'Español', locale: 'es-US' },
};
const DICT = { es: require('./i18n/es') };

const valid = (l) => typeof l === 'string' && Object.prototype.hasOwnProperty.call(LANGUAGES, l);
// the client's language, else the business's default, else English
const pick = (...langs) => langs.find(valid) || 'en';

// The language in use is set around a piece of work (a page, an email, a PDF) with run(); code inside reads it with current()
const als = new AsyncLocalStorage();
const current = () => als.getStore() || 'en';
const run = (lang, fn) => (current() === pick(lang) ? fn() : als.run(pick(lang), fn));
const locale = (lang = current()) => LANGUAGES[pick(lang)].locale;

const fill = (s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s);
const lookup = (lang, en) => {
  for (let l = lang; l && l !== 'en'; l = LANGUAGES[l] && LANGUAGES[l].base) { const d = DICT[l] && DICT[l].strings; if (d && Object.prototype.hasOwnProperty.call(d, en)) return d[en]; }
  return en;
};
const tx = (en, vars) => fill(lookup(current(), en), vars);
// a dictionary's own default email templates ({ quote: { subject, body }, … }); English ones live with the templates in server.js
const emailDefaults = (lang = current()) => (DICT[lang] && DICT[lang].emails) || {};
const list = () => Object.entries(LANGUAGES).map(([code, l]) => ({ code, name: l.name, native: l.native }));

module.exports = { LANGUAGES, valid, pick, run, current, locale, tx, emailDefaults, list };

// `node lib/i18n.js`: every tx('…') phrase in the server that a dictionary is missing, and phrases a dictionary has that nothing uses
if (require.main === module) {
  const fs = require('fs'); const path = require('path');
  const src = ['../server.js'].map((f) => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n');
  // the phrases: every quoted string in tx(…)'s first argument (so tx(q ? 'QUOTE' : 'INVOICE') counts both), and any string marked /*tx*/'…'
  const used = new Set(); const str = /(['`])((?:\\.|(?!\1)[^\\])*)\1/g; const add = (s) => used.add(s.replace(/\\(['`\\])/g, '$1'));
  for (let i = src.indexOf('tx('); i >= 0; i = src.indexOf('tx(', i + 3)) {
    if (/[\w$.]/.test(src[i - 1] || '')) continue; // another name ending in tx(
    let depth = 0; let j = i + 3; let q = null;
    for (; j < src.length; j++) { const ch = src[j]; if (q) { if (ch === '\\') j++; else if (ch === q) q = null; continue; } if (ch === "'" || ch === '`') q = ch; else if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) { if (!depth) break; depth--; } else if (ch === ',' && !depth) break; }
    let m; const arg = src.slice(i + 3, j); while ((m = str.exec(arg))) if (!m[2].includes('${')) add(m[2]);
  }
  for (const m of src.matchAll(/\/\*tx\*\/\s*(['`])((?:\\.|(?!\1)[^\\])*)\1/g)) add(m[2]);
  let gaps = 0;
  for (const [code, d] of Object.entries(DICT)) {
    if (LANGUAGES[code].base) continue; // a variant only holds what differs
    const missing = [...used].filter((k) => !(k in d.strings)); const unused = Object.keys(d.strings).filter((k) => !used.has(k));
    console.log(`${code}: ${used.size - missing.length}/${used.size} phrases translated`);
    missing.forEach((k) => console.log('  missing:', JSON.stringify(k))); unused.forEach((k) => console.log('  unused: ', JSON.stringify(k)));
    gaps += missing.length;
  }
  process.exit(gaps ? 1 : 0);
}
