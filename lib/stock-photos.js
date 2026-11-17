// Stock photos for Marketing → Plan pictures: real photos of a post's subject, free for marketing.
// Pixabay (PIXABAY_API_KEY, set in Alpha → Settings → Integrations → Stock photos) or Pexels (PEXELS_API_KEY in .env; Pexels stopped
// giving out new keys in 2026). Searches are kept for a day, as both ask. A photo picked for a post is saved in the business's uploads
// (Pixabay doesn't allow lasting links to its images, and its links expire), and the page draws the post's picture from that copy.
const fs = require('fs');
const path = require('path');

const provider = () => (process.env.PIXABAY_API_KEY ? 'pixabay' : process.env.PEXELS_API_KEY ? 'pexels' : '');
const ready = () => !!provider();
const cache = new Map(); // provider:query → { at, list }
const DAY = 24 * 3600 * 1000;
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const PEXELS = /^https:\/\/images\.pexels\.com\/photos\/\d+\/[\w.%-]+\.(jpe?g|png)(\?[\w=&.%-]*)?$/i;
const PIXABAY = /^https:\/\/(pixabay\.com\/get\/|cdn\.pixabay\.com\/photo\/)[\w/.%-]+\.(jpe?g|png)$/i;
const remoteOk = (u) => PEXELS.test(String(u || '')) || PIXABAY.test(String(u || ''));
const credit = (u) => (/^https:\/\/(www\.)?(pexels|pixabay)\.com\//.test(u || '') ? String(u).slice(0, 300) : '');

async function get(url, headers) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (r.status === 429) throw fail('Too many photo searches right now. Try again in a few minutes.', 429);
  if (!r.ok) throw fail('Couldn’t search photos right now', 502);
  return r.json();
}
async function search(q) {
  const p = provider(); if (!p) throw fail('Stock photos aren’t set up yet', 503);
  const query = String(q || '').replace(/[^\p{L}\p{N} '-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60).toLowerCase();
  if (!query) throw fail('Type what the photo should show');
  const hit = cache.get(p + ':' + query); if (hit && Date.now() - hit.at < DAY) return hit.list;
  let list;
  if (p === 'pixabay') {
    const j = await get(`https://pixabay.com/api/?key=${encodeURIComponent(process.env.PIXABAY_API_KEY)}&q=${encodeURIComponent(query)}&image_type=photo&safesearch=true&per_page=12`);
    list = (j.hits || []).filter((h) => h && PIXABAY.test(h.largeImageURL || '')).map((h) => ({ id: 'pb' + h.id, src: h.largeImageURL, thumb: PIXABAY.test(h.previewURL || '') ? h.previewURL : h.webformatURL,
      by: String(h.user || '').slice(0, 80), link: credit(h.pageURL) || 'https://pixabay.com', alt: String(h.tags || '').slice(0, 160), source: 'Pixabay' }));
  } else {
    const j = await get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12&orientation=square`, { Authorization: process.env.PEXELS_API_KEY });
    list = (j.photos || []).filter((x) => x && x.src && PEXELS.test(x.src.original)).map((x) => { const base = x.src.original.split('?')[0];
      return { id: 'px' + x.id, src: `${base}?auto=compress&cs=tinysrgb&w=1200&h=1200&fit=crop`, thumb: `${base}?auto=compress&cs=tinysrgb&w=240&h=240&fit=crop`,
        by: String(x.photographer || '').slice(0, 80), link: credit(x.url) || 'https://www.pexels.com', alt: String(x.alt || '').slice(0, 160), source: 'Pexels' }; });
  }
  cache.set(p + ':' + query, { at: Date.now(), list }); if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return list;
}
// a photo picked for a post: saved once in the business's uploads (stock-<id>.jpg), then used from there
async function keep(b, dir) {
  if (!b || typeof b !== 'object') return '';
  const id = String(b.id || ''); if (!/^(pb|px)\d{1,12}$/.test(id)) throw fail('Pick a photo from the list');
  const file = `stock-${id}.${/\.png(\?|$)/i.test(b.src || '') ? 'png' : 'jpg'}`; const full = path.join(dir, file);
  if (!fs.existsSync(full)) {
    if (!remoteOk(b.src)) throw fail('Pick a photo from the list');
    const r = await fetch(b.src, { signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (!r || !r.ok || !/^image\//.test(r.headers.get('content-type') || '')) throw fail('Couldn’t get that photo. Try another one.', 502);
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 8e6) throw fail('That photo is too big. Try another one.');
    fs.writeFileSync(full, buf);
  }
  return { id, src: `/uploads/${file}`, thumb: remoteOk(b.thumb) ? b.thumb : `/uploads/${file}`, by: String(b.by || '').slice(0, 80), link: credit(b.link) || '', source: b.source === 'Pexels' ? 'Pexels' : 'Pixabay' };
}
module.exports = { ready, provider, search, keep };
