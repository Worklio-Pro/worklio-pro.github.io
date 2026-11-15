// Home Depot product search (App Marketplace → The Home Depot Pro), for pricing products and services.
// Home Depot has no public API, so searches go through SerpApi's Home Depot engine (https://serpapi.com/home-depot-search-api)
// with the platform's SerpApi key: saved in Alpha → Settings → Integrations → Home Depot, or SERPAPI_API_KEY in .env.
// Results are cached for an hour; each search uses one SerpApi credit.
const tenancy = require('./tenancy');
const CACHE_MS = 3600e3;
const cache = new Map(); // "query|zip" -> { at, list }
const hits = new Map(); // account id -> timestamps: 60 searches an hour

const apiKey = () => tenancy.platform().serpapiKey || process.env.SERPAPI_API_KEY || '';
const ready = () => !!apiKey();
const fail = (message, status) => Object.assign(new Error(message), { status });

// for Alpha: where the key comes from, never the key itself
const keyView = () => ({ on: ready(), saved: !!tenancy.platform().serpapiKey, fromEnv: !tenancy.platform().serpapiKey && !!process.env.SERPAPI_API_KEY,
  hint: apiKey() ? `…${apiKey().slice(-4)}` : '' });
// SerpApi's account details (plan and searches left); this call doesn't use a search credit
async function account(key = apiKey()) {
  if (!key) throw fail('Add your SerpApi key first', 400);
  let r; try { r = await fetch(`https://serpapi.com/account.json?api_key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(15000) }); } catch (e) { throw fail('Couldn’t reach SerpApi. Try again.', 502); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw fail(r.status === 401 || /invalid/i.test(j.error || '') ? 'SerpApi didn’t accept that key. Copy it again from your SerpApi dashboard.' : `SerpApi said: ${j.error || r.status}`, 400);
  return { plan: j.plan_name || '', perMonth: Number(j.searches_per_month) || 0, used: Number(j.this_month_usage) || 0, left: Number(j.total_searches_left ?? j.plan_searches_left) || 0 };
}
async function saveKey(key) {
  key = String(key || '').trim(); if (!/^[A-Za-z0-9]{20,100}$/.test(key)) throw fail('Paste the API key from your SerpApi dashboard', 400);
  const info = await account(key); tenancy.platform().serpapiKey = key; tenancy.savePlatform(); return info;
}
function removeKey() { delete tenancy.platform().serpapiKey; tenancy.savePlatform(); }
const money = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };

async function search(q, { zip = '', account = '' } = {}) {
  q = String(q || '').trim().slice(0, 120); if (q.length < 2) throw fail('Type at least 2 letters to search', 400);
  if (!ready()) throw fail('Home Depot search isn’t available yet', 503);
  const key = `${q.toLowerCase()}|${zip}`; const old = cache.get(key);
  if (old && Date.now() - old.at < CACHE_MS) return old.list;
  const now = Date.now(); const mine = (hits.get(account) || []).filter((t) => now - t < 3600e3);
  if (mine.length >= 60) throw fail('That’s a lot of searches in the last hour. Try again a little later.', 429);
  mine.push(now); hits.set(account, mine);
  const url = new URL('https://serpapi.com/search');
  url.search = new URLSearchParams({ engine: 'home_depot', q, ps: '12', api_key: apiKey(), ...(zip ? { delivery_zip: zip } : {}) });
  let r;
  try { r = await fetch(url, { signal: AbortSignal.timeout(20000) }); } catch (e) { throw fail('Couldn’t reach Home Depot search. Try again.', 502); }
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.error) {
    if (/hasn't returned any results/i.test(body.error || '')) return [];
    console.error('Home Depot search failed:', r.status, body.error || '');
    throw fail('Home Depot search isn’t working right now. Try again later.', 502);
  }
  const list = (body.products || []).map((p) => ({
    id: String(p.product_id || ''), title: String(p.title || ''), brand: String(p.brand || ''), model: String(p.model_number || ''),
    price: money(p.price), was: money(p.price_was), thumb: [].concat(...(Array.isArray(p.thumbnails) ? p.thumbnails : [])).find((u) => /^https:\/\//.test(u)) || '',
    link: /^https:\/\/www\.homedepot\.com\//.test(p.link || '') ? p.link : '', rating: Number(p.rating) || 0, reviews: Number(p.reviews) || 0,
  })).filter((p) => p.title && p.price && p.link);
  cache.set(key, { at: Date.now(), list }); if (cache.size > 500) cache.delete(cache.keys().next().value);
  return list;
}

// the Home Depot details saved on a product or service: only what the search returned, nothing a form could slip in
function clean(doc) {
  const cost = money(doc.hdCost); const link = String(doc.hdLink || '');
  if (!cost || !/^https:\/\/www\.homedepot\.com\//.test(link)) { for (const k of ['hdId', 'hdModel', 'hdCost', 'hdLink', 'hdAt']) delete doc[k]; return doc; }
  doc.hdCost = cost; doc.hdLink = link.slice(0, 500); doc.hdId = String(doc.hdId || '').slice(0, 40); doc.hdModel = String(doc.hdModel || '').slice(0, 60);
  doc.hdAt = /^\d{4}-\d{2}-\d{2}/.test(doc.hdAt || '') ? String(doc.hdAt).slice(0, 30) : new Date().toISOString();
  return doc;
}

module.exports = { ready, search, clean, keyView, account, saveKey, removeKey };
