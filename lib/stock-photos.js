// Stock photos for Marketing → Plan pictures: real photos of a post's subject from Pexels (free for marketing, no credit needed).
// The key is set in Alpha → Settings → Integrations → Stock photos (or PEXELS_API_KEY). The free key allows 200 searches an hour,
// so each search is kept for a day. Photos reach the browser through image() (same address), so the page can draw them on its canvas.
const key = () => process.env.PEXELS_API_KEY || '';
const ready = () => !!key();
const cache = new Map(); // query → { at, list }
const DAY = 24 * 3600 * 1000;
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const okUrl = (u) => /^https:\/\/images\.pexels\.com\/photos\/\d+\/[\w.%-]+\.(jpe?g|png)(\?[\w=&.%-]*)?$/i.test(String(u || ''));

async function search(q) {
  if (!ready()) throw fail('Stock photos aren’t set up yet', 503);
  const query = String(q || '').replace(/[^\p{L}\p{N} '-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60).toLowerCase();
  if (!query) throw fail('Type what the photo should show');
  const hit = cache.get(query); if (hit && Date.now() - hit.at < DAY) return hit.list;
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12&orientation=square`, { headers: { Authorization: key() }, signal: AbortSignal.timeout(10000) });
  if (r.status === 429) throw fail('Too many photo searches right now. Try again in a few minutes.', 429);
  if (!r.ok) throw fail('Couldn’t search photos right now', 502);
  const j = await r.json();
  const list = (j.photos || []).filter((p) => p && p.src && okUrl(p.src.original)).map((p) => {
    const base = p.src.original.split('?')[0];
    return { id: String(p.id), thumb: `${base}?auto=compress&cs=tinysrgb&w=240&h=240&fit=crop`, src: `${base}?auto=compress&cs=tinysrgb&w=1200&h=1200&fit=crop`,
      by: String(p.photographer || '').slice(0, 80), link: /^https:\/\/www\.pexels\.com\//.test(p.url || '') ? p.url : 'https://www.pexels.com', alt: String(p.alt || '').slice(0, 160) };
  });
  cache.set(query, { at: Date.now(), list }); if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return list;
}
// one photo, fetched for the page (only Pexels image addresses)
async function image(u) {
  if (!okUrl(u)) throw fail('Not a Pexels photo', 404);
  const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw fail('Couldn’t load that photo', 502);
  const type = r.headers.get('content-type') || 'image/jpeg'; if (!/^image\//.test(type)) throw fail('Not a photo', 502);
  const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 8e6) throw fail('That photo is too big', 502);
  return { type, buf };
}
// a chosen photo saved on a post: only what search() returns
function clean(b) {
  if (!b || typeof b !== 'object') return '';
  if (!okUrl(b.src)) throw fail('Pick a photo from the list');
  return { id: String(b.id || '').slice(0, 20), src: b.src, thumb: okUrl(b.thumb) ? b.thumb : b.src, by: String(b.by || '').slice(0, 80), link: /^https:\/\/www\.pexels\.com\//.test(b.link || '') ? String(b.link).slice(0, 300) : 'https://www.pexels.com' };
}
module.exports = { ready, search, image, clean, okUrl };
