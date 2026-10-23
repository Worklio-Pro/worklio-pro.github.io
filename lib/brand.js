// The application's own logo (platform console → Settings → Logo): shown on the home, pricing, checkout and help center pages,
// the platform console, account login pages and sidebars (when a business has no logo of its own) and in the platform's emails.
// The app icon (Settings → Your product → App icon) is the browser-tab and home-screen icon of the public pages, the Help Center
// and Alpha, and of every business's app until it uploads its own (App Settings → App icon).
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

module.exports = { brand, save, remove, serve, serveIcon, saveMedia };
