'use strict';
// "Page not found" for the public website, the help centre and Ideas: the product logo, Yoya (the Worklio Pro Yorkie) and a friendly
// message, nothing else. The business app has the same page in public/app.js (page404Html); the help centre draws it in help.js.
const fs = require('fs');
const path = require('path');
const brandLib = require('./brand');

const YOYA = path.join(__dirname, '..', 'public', 'img', 'yoya-404.webp');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// GET /img/yoya-404.webp on every address (the help centre and Ideas don't serve the app's images); true when it answered
function serveImage(req, res) {
  if (req.url.split('?')[0] !== '/img/yoya-404.webp') return false;
  fs.readFile(YOYA, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', 'image/webp'); res.setHeader('Cache-Control', 'public, max-age=86400'); res.end(buf);
  });
  return true;
}

// the logo: the dark-background version in dark mode (or the logo on a white tile), and the name beside it unless the logo has it
function logo(b) {
  const name = b.name || 'Worklio Pro';
  const img = b.logo ? `<img class="lg lg-l" src="${esc(b.logo)}" alt="">${b.logoDark ? `<img class="lg lg-d" src="${esc(b.logoDark)}" alt="">` : ''}` : '';
  return `<a class="logo${b.logoDark ? '' : ' solo'}" href="/" aria-label="${esc(name)} home">${img}${img && b.logoHasName ? '' : `<span>${esc(name)}</span>`}</a>`;
}

// the whole page; home: where Take me home goes (each site's own home)
function page({ home = '/' } = {}) {
  const b = brandLib.brand();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Page not found · ${esc(b.name || 'Worklio Pro')}</title><link rel="icon" href="/favicon.ico">
<style>
:root{--bg:#f1f5fb;--text:#0f172a;--muted:#64748b;--brand:#2563eb;--line:#d1d5db;--card:#fff;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0b1220;--text:#e2e8f0;--muted:#94a3b8;--line:#2f3e5e;--card:#121b2f;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;justify-content:center}
main{max-width:560px;width:100%;padding:28px 16px 48px;text-align:center;display:flex;flex-direction:column;align-items:center}
.logo{display:inline-flex;align-items:center;gap:10px;margin:8px 0 18px;font-size:24px;font-weight:800;color:var(--text);text-decoration:none}
.lg{display:block;height:44px;width:auto;max-width:240px;object-fit:contain}.lg-d{display:none}
@media (prefers-color-scheme:dark){.lg-d{display:block}.logo:has(.lg-d) .lg-l{display:none}.solo .lg-l{background:#fff;padding:3px 6px;border-radius:8px}}
.dog{width:min(400px,86vw);height:auto}
.code{margin-top:8px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
h1{margin:6px 0 10px;font-size:30px}p{margin:0 0 22px;font-size:16px;line-height:1.5;color:var(--muted)}
.acts{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.btn{display:inline-block;padding:10px 18px;border-radius:8px;border:1px solid var(--brand);background:var(--brand);color:#fff;font:inherit;font-size:15px;font-weight:600;text-decoration:none;cursor:pointer}
.btn.alt{background:var(--card);color:var(--text);border-color:var(--line)}
</style></head><body><main>
${logo(b)}
<img class="dog" src="/img/yoya-404.webp" width="800" height="800" alt="Yoya, the ${esc(b.name || 'Worklio Pro')} Yorkie, in a polo shirt with a laptop">
<div class="code">Error 404</div><h1>Ruh-roh! This page ran off.</h1>
<p>Yoya sniffed under every couch cushion, but couldn’t find the page you’re looking for. It may have moved, or the link might be a little off.</p>
<div class="acts"><a class="btn" href="${esc(home)}">Take me home</a><button type="button" class="btn alt" onclick="history.length > 1 ? history.back() : location.assign('${esc(home)}')">Go back</button></div>
</main></body></html>`;
}

// answer with the page and a 404 status (so search engines drop the address)
function send(res, opts) {
  res.statusCode = 404; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'private, no-store');
  res.end(page(opts));
}

module.exports = { page, send, serveImage };
