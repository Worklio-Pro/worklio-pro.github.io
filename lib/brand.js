// The application's own logo (platform console → Settings → Logo): shown on the home, pricing, checkout and help center pages,
// the platform console, account login pages and sidebars (when a business has no logo of its own) and in the platform's emails.
// The app icon (Settings → Your product → App icon) is the browser-tab and home-screen icon of the public pages, the Help Center
// and Alpha, and of every business's app.
// Files live in <DATA_DIR>/brand and are served at /brand/<file> on every address.
const fs = require('fs');
const path = require('path');
const tenancy = require('./tenancy');

const DIR = path.join(tenancy.DATA_DIR, 'brand');
const FILE_RE = /^\/brand\/((?:logo(?:-dark)?|icon|media)-\d+\.(png|jpg|gif|webp|svg))$/; // media-…: other images (referral program pictures)
const TYPES = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
const KEYS = { light: 'logo', dark: 'logoDark', icon: 'icon' };
const PREFIX = { logo: 'logo', logoDark: 'logo-dark', icon: 'icon' };
const MAX = 700 * 1024;

// Alpha → Settings → Website colors, on every page of the site, Help Center, Alpha and the business app. Saved in settings.siteColors, only where changed:
// the named colors below by CSS variable ("--text", "--text:dark" for dark mode's), and any other color in the stylesheets by its value ("#ea7a1f")
const SITE_COLORS = [
  ['Buttons and highlights', [['--brand', 'Buttons and highlights', '#2563eb', '', 'Also selected items and focused fields'], ['--btn-text', 'Button text', '#ffffff']]],
  ['Text', [['--text', 'Main text', '#0f172a', '#e2e8f0'], ['--muted', 'Secondary text', '#64748b', '#94a3b8'], ['--link', 'Links', '#2563eb', '#9db9f6']]],
  ['Icons', [['--icon', 'Icons', '#64748b', '#94a3b8', 'Icons in lists, rows and menus'], ['--tool-icon', 'Toolbar and action icons', '#64748b', '#94a3b8', 'Top bar, delete and search buttons'], ['--nav-icon', 'Navigation menu icons', '#cbd5e1'], ['--bnav-text', 'Phone menu icons and text', '#64748b', '#94a3b8'], ['--bnav-on', 'Phone menu selected', '#2563eb', '#2563eb']]],
  ['Navigation menu', [['--side', 'Background', '#0f1f3d', '#070d1a', 'Also Alpha’s top bar and the home page’s dark band'], ['--nav-text', 'Text', '#cbd5e1'], ['--nav-hover', 'Hovered item', '#1e3a6e'], ['--nav-on', 'Selected item', '#2563eb', '', 'Follows Buttons and highlights until changed'], ['--nav-on-text', 'Selected item text', '#ffffff']]],
  ['Website and Help Center header', [['--header-bg', 'Background', '#ffffff', '#121b2f', 'The Help Center’s header starts out navy'], ['--header-text', 'Text', '#0f172a', '#e2e8f0'], ['--hero', 'Help Center banner', '#0f1f3d', '#070d1a'], ['--hero-2', 'Help Center banner, second shade', '#173062', '#13254b'], ['--hero-text', 'Help Center banner text', '#ffffff', '#ffffff']]],
  ['Backgrounds', [['--bg', 'Page', '#f1f5fb', '#0b1220'], ['--card', 'Cards and menus', '#ffffff', '#121b2f'], ['--surface-2', 'Hovered rows and panels', '#f8fafc', '#0f172a'], ['--tint', 'Tinted areas', '#eef3fb', '#172440'], ['--tint-strong', 'Strong tint', '#e0e7ff', '#1e2f57'], ['--tint-border', 'Tint border', '#c7d2fe', '#30457a'], ['--tint-fg', 'Text on tint', '#1e3a8a', '#c7d7fe'], ['--soft', 'Help Center soft tint', '#eef3fb', '#172440']]],
  ['Lines and fields', [['--input-border', 'Input border', '#d1d5db', '#2f3e5e'], ['--border', 'Other borders', '#d1d5db', '#2f3e5e', 'Secondary buttons and outlines'], ['--line', 'Dividers', '#dbe4f0', '#22304d'], ['--switch-off', 'Switch turned off', '#cbd5e1', '#3a4a68']]],
  ['Status', [['--danger', 'Danger', '#dc2626', '#ef4444'], ['--ok', 'Success', '#16a34a', '#22c55e'], ['--warn', 'Warning', '#d97706', '#f59e0b'], ['--ok-bg', 'Green badge', '#dcfce7', '#0f2f1f'], ['--ok-fg', 'Green badge text', '#166534', '#86efac'], ['--info-bg', 'Blue badge', '#dbeafe', '#172554'], ['--info-fg', 'Blue badge text', '#1e40af', '#93c5fd'], ['--bad-bg', 'Red badge', '#fee2e2', '#3b1219'], ['--bad-fg', 'Red badge text', '#991b1b', '#fca5a5'], ['--warn-bg', 'Amber badge', '#fef3c7', '#352708'], ['--warn-fg', 'Amber badge text', '#92400e', '#fcd34d'], ['--warn-border', 'Amber badge border', '#fde68a', '#5c4310'], ['--violet-bg', 'Violet badge', '#ede9fe', '#2b1d57'], ['--violet-fg', 'Violet badge text', '#5b21b6', '#c4b5fd'], ['--neutral-bg', 'Gray badge', '#f1f5f9', '#1e293b'], ['--neutral-fg', 'Gray badge text', '#475569', '#cbd5e1']]],
];
const NAMED = SITE_COLORS.flatMap(([, rows]) => rows);
const saved = () => tenancy.platform().settings.siteColors || {};
const siteColor = (k) => saved()[k] || '';
const validColorKey = (k) => /^#[0-9a-f]{6}$/.test(k) || NAMED.some(([v, , , dark]) => k === v || (dark && k === v + ':dark'));
// :not(#_) outranks the dark mode tokens. The accent color of a business's portal also leads its links, so those skip a chosen link color
function themeCss() {
  const css = (list) => list.filter(([, c]) => c).map(([v, c]) => `${v}:${c}`).join(';');
  const mode = (sel, list, link) => { const a = css(list); const l = css(link); return (a ? `${sel}{${a}}` : '') + (l ? `${sel}:not([data-accent]){${l}}` : ''); };
  const both = css(NAMED.filter(([, , , dark]) => !dark).map(([v]) => [v, saved()[v]]));
  const pairs = NAMED.filter(([v, , , dark]) => dark && v !== '--link');
  const light = pairs.map(([v]) => [v, saved()[v]]); const dark = pairs.map(([v]) => [v, saved()[v + ':dark']]);
  const lightLink = [['--link', saved()['--link']]]; const darkLink = [['--link', saved()['--link:dark']]];
  return [both ? `:root:not(#_){${both}}` : '',
    mode(':root[data-theme=light]:not(#_)', light, lightLink), `@media (prefers-color-scheme:light){${mode(':root:not(#_):not([data-theme=dark])', light, lightLink)}}`,
    mode(':root[data-theme=dark]:not(#_)', dark, darkLink), `@media (prefers-color-scheme:dark){${mode(':root:not(#_):not([data-theme=light])', dark, darkLink)}}`].join('\n');
}
// every other color: a changed one is swapped in the stylesheets and pages' <style> blocks as they're sent. Only in declarations, so "#add" as a selector is safe; the variables above have their own controls
const six = (h) => { const x = h.slice(1).toLowerCase(); return x.length === 3 ? '#' + [...x].map((c) => c + c).join('') : x.length === 6 ? '#' + x : ''; };
const eachDecl = (css, fn) => css.replace(/([\w-]+)(\s*:)([^;{}]*)(?=[;}])/g, (m, prop, colon, val) => (prop.startsWith('--') ? m : prop + colon + val.replace(/#[0-9a-f]{3,8}\b/gi, fn)));
function recolor(buf, ext) {
  const map = Object.entries(saved()).filter(([k]) => k[0] === '#'); if (!map.length) return buf;
  const m = Object.fromEntries(map); const swap = (css) => eachDecl(css, (h) => m[six(h)] || h);
  const s = buf.toString('utf8');
  return Buffer.from(ext === '.css' ? swap(s) : s.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (x, a, css, z) => a + swap(css) + z));
}
require('./mini-express').recolor = recolor;
let others = null;
function otherColors() { // what's in the files, most used first, each with where it's first used
  if (others) return others;
  const seen = {};
  for (const f of ['styles.css', 'home.css', 'help.css', 'platform.html', 'login.html', 'site.html', 'checkout.html', 'features.html', 'home.html', 'help.html', 'index.html']) {
    let s = fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8');
    if (f.endsWith('.html')) s = (s.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n').replace(/<\/?style[^>]*>/gi, '');
    s.replace(/([^{}]*)\{([^{}]*)\}/g, (x, sel, body) => { eachDecl(body + ';', (h) => { const c = six(h); if (c) { const e = seen[c] = seen[c] || { color: c, n: 0, where: sel.trim().split(',')[0].slice(0, 60) }; e.n++; } return h; }); return x; });
  }
  others = Object.values(seen).sort((a, b) => b.n - a.n); return others;
}
const siteColorsView = () => ({ groups: SITE_COLORS.map(([name, rows]) => ({ name, rows: rows.map(([key, label, light, dark, note]) => ({ key, label, light, dark, note })) })), others: otherColors() });
// GET /theme.css on any address; true when it answered
function serveTheme(req, res) {
  if (req.url.split('?')[0] !== '/theme.css') return false;
  res.setHeader('Content-Type', 'text/css; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache'); // browsers recheck, so new colors show on the next page load
  res.end(themeCss()); return true;
}

// what pages need to draw the logo: { name, logo, logoDark, logoHasName }
const brand = () => { const s = tenancy.platform().settings; return { name: s.productName, logo: s.logo || '', logoDark: s.logoDark || '', logoHasName: !!(s.logo && s.logoHasName) }; };

function save(kind, dataUrl) {
  const key = KEYS[kind]; if (!key) throw Object.assign(new Error('Unknown logo'), { status: 400 });
  const m = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw Object.assign(new Error('Upload a PNG, JPG, GIF, WebP or SVG image'), { status: 400 });
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > MAX) throw Object.assign(new Error('Use an image under 700 KB'), { status: 400 });
  const ext = m[1] === 'svg+xml' ? 'svg' : m[1] === 'jpeg' ? 'jpg' : m[1];
  fs.mkdirSync(DIR, { recursive: true });
  if (key === 'icon' && m[1] === 'gif') throw Object.assign(new Error('Upload a PNG, JPG, WebP or SVG image for the app icon'), { status: 400 });
  const file = `${PREFIX[key]}-${Date.now()}.${ext}`; // a new name each time, so browsers and email clients never show an old copy
  fs.writeFileSync(path.join(DIR, file), buf);
  remove(kind, { keepSetting: true }); tenancy.platform().settings[key] = `/brand/${file}`; tenancy.savePlatform();
}
function remove(kind, { keepSetting = false } = {}) {
  const s = tenancy.platform().settings; const key = KEYS[kind]; const old = FILE_RE.exec(s[key] || '');
  if (old) fs.rm(path.join(DIR, old[1]), () => {});
  if (!keepSetting) { s[key] = ''; tenancy.savePlatform(); }
}
// any other image for the platform's pages (no SVG): returns its address
function saveMedia(dataUrl) {
  const m = /^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw Object.assign(new Error('Upload a PNG, JPG, GIF or WebP image'), { status: 400 });
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > 2 * 1024 * 1024) throw Object.assign(new Error('Use an image under 2 MB'), { status: 400 });
  fs.mkdirSync(DIR, { recursive: true }); const file = `media-${Date.now()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`; fs.writeFileSync(path.join(DIR, file), buf); return `/brand/${file}`;
}
// GET /brand/<file> on any address; true when it answered
function serve(req, res) {
  const m = FILE_RE.exec(req.url.split('?')[0]); if (!m) return false;
  fs.readFile(path.join(DIR, m[1]), (err, buf) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[m[2]]); res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'"); res.setHeader('X-Content-Type-Options', 'nosniff'); // an SVG can't run scripts
    res.end(buf);
  });
  return true;
}

// the app icon at /favicon.ico (and /apple-touch-icon.png for phones' home screens, which need PNG or JPG). True when it answered.
function serveIcon(req, res) {
  const p = req.url.split('?')[0]; if (p !== '/favicon.ico' && p !== '/apple-touch-icon.png') return false;
  const m = FILE_RE.exec(tenancy.platform().settings.icon || ''); if (!m || (p === '/apple-touch-icon.png' && !['png', 'jpg'].includes(m[2]))) return false;
  fs.readFile(path.join(DIR, m[1]), (err, buf) => {
    if (err) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', TYPES[m[2]]); res.setHeader('Cache-Control', 'no-cache'); // browsers recheck, so a new icon shows on the next page load
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'"); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(buf);
  });
  return true;
}

module.exports = { brand, save, remove, serve, serveIcon, saveMedia, serveTheme, siteColor, validColorKey, siteColorsView };
