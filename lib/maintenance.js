// Maintenance mode (Alpha → Settings): every address shows an "Under maintenance" page, except
// - Alpha itself (so you can turn it off), Stripe webhooks and the HTTPS certificate check, and the app's static files;
// - browsers with the bypass cookie: set for you while you're logged into Alpha (on your domain and every subdomain),
//   or by opening any address with ?bypass=<code> (for a business's own domain).
const crypto = require('crypto');
const tenancy = require('./tenancy');
const brandLib = require('./brand');

const P = () => tenancy.platform();
const state = () => (P().maintenance = P().maintenance || { on: false, title: '', message: '', until: '', secret: '' });
const isOn = () => !!state().on;
const COOKIE = 'mbypass';
const secure = /^https:/.test(process.env.BASE_URL || '') ? '; Secure' : '';

function save(b) {
  const m = state(); const str = (v, n) => String(v ?? '').trim().slice(0, n);
  if ('on' in b) m.on = b.on === true || b.on === 'on';
  if ('title' in b) m.title = str(b.title, 120);
  if ('message' in b) m.message = str(b.message, 1000);
  if ('until' in b) m.until = str(b.until, 80);
  if (!m.secret || b.newCode) m.secret = crypto.randomBytes(12).toString('hex');
  if (m.on && !m.since) m.since = new Date().toISOString(); if (!m.on) delete m.since;
  tenancy.savePlatform(); return m;
}
// the pass cookie for the platform owner: on the platform's domain and all its subdomains (businesses, help center)
function passCookie() {
  const d = tenancy.PLATFORM_DOMAIN ? `; Domain=.${tenancy.hostOnly(tenancy.PLATFORM_DOMAIN)}` : '';
  return `${COOKIE}=${state().secret}; Path=/; Max-Age=${14 * 86400}; SameSite=Lax; HttpOnly${d}${secure}`;
}
const cookieOf = (req) => { const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]+)`).exec(req.headers.cookie || ''); return m ? m[1] : ''; };
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const hasPass = (req) => { const c = cookieOf(req); return !!c && !!state().secret && same(c, state().secret); };

// what keeps working during maintenance
const EXEMPT = [
  /^\/(alpha|platform)(\/.*)?$/, /^\/api\/platform\//, // Alpha
  /^\/api\/site\/(stripe-webhook|stripe-connect-webhook|domain-allowed)$/, /^\/api\/stripe\/webhook$/, // Stripe and the certificate check
  /\.(js|css|png|jpe?g|gif|webp|svg|ico|woff2?)$/i, /^\/brand\//, // static files (the page and Alpha need them)
];
// called first for every request: true when it answered (the maintenance page, or a bypass redirect)
function handle(req, res) {
  if (!isOn()) return false;
  const url = new URL(req.url, 'http://x'); const code = url.searchParams.get('bypass');
  if (code) { // ?bypass=<code>: remember it on this address, then carry on without it in the address bar
    if (state().secret && same(code, state().secret)) {
      url.searchParams.delete('bypass'); res.statusCode = 302;
      res.setHeader('Set-Cookie', `${COOKIE}=${state().secret}; Path=/; Max-Age=${14 * 86400}; SameSite=Lax; HttpOnly${secure}`);
      res.setHeader('Location', url.pathname + (url.search || '')); res.end(); return true;
    }
  }
  if (hasPass(req) || EXEMPT.some((re) => re.test(url.pathname))) return false;
  const m = state(); res.statusCode = 503; res.setHeader('Retry-After', '3600'); res.setHeader('Cache-Control', 'no-store');
  if (url.pathname.startsWith('/api/')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `${P().settings.productName} is down for maintenance. Please try again soon.`, maintenance: true })); return true; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(page(m)); return true;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// the page: the home page's look (logo, pale blue, white card), light and dark
function page(m = state()) {
  const s = P().settings; const b = brandLib.brand(); const title = m.title || 'We’ll be back soon';
  const message = m.message || `${s.productName} is getting some scheduled improvements. Everything will be back shortly. Thanks for your patience.`;
  const logo = b.logo ? `<img src="${esc(b.logo)}" alt="${esc(b.name)}" class="logo${b.logoDark ? ' l' : ''}">${b.logoDark ? `<img src="${esc(b.logoDark)}" alt="${esc(b.name)}" class="logo d">` : ''}${b.logoHasName ? '' : `<span>${esc(b.name)}</span>`}`
    : `<span>${esc(b.name)}</span>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} · ${esc(s.productName)}</title><meta name="color-scheme" content="light dark">
<style>
:root{--brand:#2563eb;--bg:#eef3fb;--card:#fff;--text:#0f172a;--muted:#64748b;--line:#dbe4f0}
@media (prefers-color-scheme:dark){:root{--bg:#0b1220;--card:#121b2f;--text:#e2e8f0;--muted:#94a3b8;--line:#22304d}.logo.l{display:none}.logo.d{display:block!important}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px;background:linear-gradient(180deg,var(--bg),var(--card));color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px;margin-bottom:28px}
.logo{height:40px;width:auto;max-width:220px}.logo.d{display:none}
.card{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:40px 32px;max-width:540px;width:100%;text-align:center;box-shadow:0 10px 30px rgba(15,23,42,.08)}
.ic{width:72px;height:72px;margin:0 auto 18px;border-radius:50%;background:color-mix(in srgb,var(--brand) 14%,transparent);color:var(--brand);display:grid;place-items:center}
h1{font-size:clamp(26px,5vw,34px);letter-spacing:-.02em;margin:0 0 12px}p{color:var(--muted);line-height:1.6;font-size:17px;margin:0 0 12px;white-space:pre-line}
.until{display:inline-block;margin-top:6px;padding:8px 14px;border-radius:99px;background:color-mix(in srgb,var(--brand) 10%,transparent);color:var(--text);font-size:15px;font-weight:600}
.foot{margin-top:24px;font-size:14px;color:var(--muted)}.foot a{color:var(--brand)}
</style></head><body>
<div class="brand">${logo}</div>
<main class="card"><div class="ic"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg></div>
<h1>${esc(title)}</h1><p>${esc(message)}</p>${m.until ? `<div class="until">Expected back: ${esc(m.until)}</div>` : ''}</main>
${s.contactEmail ? `<div class="foot">Need help now? <a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a></div>` : ''}
</body></html>`;
}

module.exports = { state, isOn, save, passCookie, handle, page };
