// Cloudflare for SaaS: businesses' own domains (App Settings → Branding → Web address) are "custom hostnames" on the platform's
// Cloudflare zone. The business adds one CNAME to customers.<platform domain>; Cloudflare checks it, issues the domain's certificate,
// and its traffic goes through the edge Worker (cloudflare/edge-worker.js), which hands it to the app under a name the host knows.
// Needs CF_API_TOKEN (Zone → SSL and Certificates → Edit) and CF_ZONE_ID in .env. Without them, domains are set up by hand (SiteGround).
const crypto = require('crypto');

const API = 'https://api.cloudflare.com/client/v4';
const token = () => String(process.env.CF_API_TOKEN || '').trim();
const zone = () => String(process.env.CF_ZONE_ID || '').trim();
const enabled = () => !!(token() && zone());

async function call(method, path, body) {
  const r = await fetch(`${API}/zones/${zone()}${path}`, { method, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!j.success) { const x = (j.errors || [])[0] || {}; const e = new Error(x.message || `Cloudflare answered ${r.status}`); e.status = r.status; e.code = x.code; throw e; }
  return j.result;
}
// what the app keeps and shows: Cloudflare's id, whether the hostname is verified (its CNAME points here) and whether its certificate is out
const summary = (h) => ({ id: h.id, host: h.hostname, status: h.status || '', ssl: (h.ssl && h.ssl.status) || '',
  errors: [...(h.verification_errors || []), ...((h.ssl && h.ssl.validation_errors) || []).map((x) => x && x.message)].filter(Boolean) });
const live = (s) => !!s && s.status === 'active' && s.ssl === 'active';

async function find(host) { const list = await call('GET', `/custom_hostnames?hostname=${encodeURIComponent(host)}`); return list && list[0] ? summary(list[0]) : null; }
// add a domain (a certificate by HTTP validation, which passes on its own once the CNAME is in place); one already there is reused
async function add(host) {
  try { return summary(await call('POST', '/custom_hostnames', { hostname: host, ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } } })); } catch (e) {
    const f = /exist|duplicate/i.test(e.message) ? await find(host).catch(() => null) : null; if (f) return f; throw e;
  }
}
const get = async (id) => summary(await call('GET', `/custom_hostnames/${encodeURIComponent(id)}`));
const remove = (id) => call('DELETE', `/custom_hostnames/${encodeURIComponent(id)}`).catch((e) => { if (e.status !== 404) throw e; });
// the name businesses point their CNAME at: a proxied name on the platform's zone
const target = (rootHost) => String(process.env.CF_CNAME_TARGET || `customers.${rootHost}`).trim().toLowerCase();

// what to tell the business while a domain isn't working yet
function pendingText(s, cname) {
  if (s.status !== 'active') return `Waiting for ${s.host} to point here: add a CNAME record named ${s.host.split('.')[0]} with the value ${cname}. DNS changes can take up to a few hours.`
    + (s.errors.length ? ` (${s.errors[0]})` : '');
  return `${s.host} points here. Its secure connection (SSL certificate) is being issued, which usually takes a few minutes.`;
}

// ---------- requests that come through the edge Worker ----------
// The Worker names the domain the visitor typed (X-Worklio-Host) and their IP (X-Worklio-Client-IP), with the shared secret
// (X-Worklio-Edge = CF_EDGE_SECRET). Without the right secret the headers are ignored, so nobody can pose as another domain.
function fromEdge(req) {
  const secret = String(process.env.CF_EDGE_SECRET || ''); const sent = String(req.headers['x-worklio-edge'] || '');
  if (!secret || !sent || sent.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(secret))) return null;
  const host = String(req.headers['x-worklio-host'] || '').trim().toLowerCase();
  if (!/^[a-z0-9.-]{4,253}(:\d{1,5})?$/.test(host)) return null;
  return { host, ip: String(req.headers['x-worklio-client-ip'] || '').trim() };
}

// Cloudflare's own addresses (cloudflare.com/ips): with the site behind Cloudflare, the host's proxy sees these instead of the visitor,
// and Cloudflare puts the visitor's address in CF-Connecting-IP
const V4 = ['173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22'].map((c) => {
  const [ip, bits] = c.split('/'); return [ip.split('.').reduce((n, o) => n * 256 + Number(o), 0), 2 ** (32 - Number(bits))];
});
const V6 = /^(2400:cb00|2606:4700|2803:f800|2405:b500|2405:8100|2c0f:f248|2a06:98c[0-7]):/i;
function isCloudflareIp(raw) {
  const ip = String(raw || '').replace(/^::ffff:/i, '');
  if (V6.test(ip)) return true;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip); if (!m) return false;
  const n = ((+m[1] * 256 + +m[2]) * 256 + +m[3]) * 256 + +m[4];
  return V4.some(([base, size]) => n >= base && n < base + size);
}

module.exports = { enabled, add, get, find, remove, live, target, pendingText, fromEdge, isCloudflareIp };
