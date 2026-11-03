// Bluesky: a business connects its own account with its handle and an app password (Bluesky → Settings → Privacy and security → App passwords),
// so there's no developer app to set up. Posts go to the account's own server (PDS), found from the handle, through the AT Protocol.
// The app password is kept in the account's secrets like the other connections' tokens; a new session is started for each post.
const ENTRY = 'https://bsky.social';
const MAX_TEXT = 300; const MAX_IMAGES = 4; const MAX_IMAGE_BYTES = 1000000; // Bluesky's limits: graphemes, photos per post, bytes per photo
const err = (message, status = 400) => Object.assign(new Error(message), { status });

async function call(url, opts = {}) {
  let r; try { r = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) }); } catch (e) { throw err('Couldn’t reach Bluesky. Try again in a minute.', 502); }
  const txt = await r.text(); let j; try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = {}; }
  if (!r.ok) {
    if (r.status === 401) throw err('Bluesky didn’t accept that handle and app password. Check them, or create a new app password in Bluesky.');
    throw err(j.message || `Bluesky answered with an error (${r.status})`, r.status === 429 ? 429 : r.status >= 500 ? 502 : 400);
  }
  return j;
}
const xrpc = (service, method, body, token) => call(`${service}/xrpc/${method}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

// "@name", "name" (a bsky.social account) or a custom-domain handle → "name.bsky.social" / "name.com"
function cleanHandle(h) {
  const s = String(h || '').trim().replace(/^@/, '').replace(/^https?:\/\/bsky\.app\/profile\//, '').replace(/\/.*$/, '').toLowerCase();
  if (!s) return '';
  return s.includes('.') ? s : `${s}.bsky.social`;
}
// the handle's account (DID) and the server it lives on
async function resolve(handle) {
  const { did } = await call(`${ENTRY}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`).catch(() => { throw err(`There’s no Bluesky account called @${handle}`); });
  const doc = await call(did.startsWith('did:web:') ? `https://${did.slice(8)}/.well-known/did.json` : `https://plc.directory/${did}`);
  const svc = (doc.service || []).find((s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer');
  if (!svc) throw err('Couldn’t find that account’s Bluesky server', 502);
  return { did, service: String(svc.serviceEndpoint).replace(/\/+$/, '') };
}
async function session(c) { return xrpc(c.service, 'com.atproto.server.createSession', { identifier: c.did, password: c.appPassword }); }

// checks the handle and app password, and returns the connection to save
async function connect(handle, appPassword) {
  const h = cleanHandle(handle); const pw = String(appPassword || '').trim();
  if (!h) throw err('Enter your Bluesky handle, like yourbusiness.bsky.social');
  if (!pw) throw err('Enter an app password from Bluesky');
  const { did, service } = await resolve(h);
  const s = await xrpc(service, 'com.atproto.server.createSession', { identifier: did, password: pw });
  return { did, service, handle: s.handle || h, appPassword: pw, connectedAt: new Date().toISOString() };
}

const graphemes = (s) => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)].length;
// links and #hashtags as rich text, so they're clickable (Bluesky counts their positions in UTF-8 bytes)
function facets(text) {
  const out = []; const bytes = (i) => Buffer.byteLength(text.slice(0, i));
  for (const m of text.matchAll(/https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]'’]/g)) out.push({ index: { byteStart: bytes(m.index), byteEnd: bytes(m.index + m[0].length) }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }] });
  for (const m of text.matchAll(/(^|\s)#([\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)/gu)) {
    const start = m.index + m[1].length; out.push({ index: { byteStart: bytes(start), byteEnd: bytes(start + 1 + m[2].length) }, features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[2] }] });
  }
  return out;
}
// a JPEG's width and height (from its start-of-frame marker), so Bluesky shows it uncropped
function jpegSize(buf) {
  for (let i = 2; i + 9 < buf.length;) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1]; const len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}
// what's wrong with a post for Bluesky, or '' (checked before anything is posted anywhere)
function problem({ caption, jpegs }) {
  if (graphemes(caption) > MAX_TEXT) return `Bluesky posts can be up to ${MAX_TEXT} characters`;
  if (jpegs.length > MAX_IMAGES) return `Bluesky posts can have up to ${MAX_IMAGES} photos`;
  if (jpegs.some((b) => b.length > MAX_IMAGE_BYTES)) return 'Each photo must be under 1 MB for Bluesky';
  if (!caption && !jpegs.length) return 'Add a photo or write a caption';
  return '';
}
// posts the caption and photos; returns the post's address on bsky.app
async function post(c, { caption, jpegs }) {
  const bad = problem({ caption, jpegs }); if (bad) throw err(bad);
  const s = await session(c);
  const images = [];
  for (const buf of jpegs) {
    const up = await call(`${c.service}/xrpc/com.atproto.repo.uploadBlob`, { method: 'POST', headers: { 'content-type': 'image/jpeg', authorization: `Bearer ${s.accessJwt}` }, body: buf });
    const size = jpegSize(buf); images.push({ alt: '', image: up.blob, ...(size ? { aspectRatio: size } : {}) });
  }
  const record = { $type: 'app.bsky.feed.post', text: caption, createdAt: new Date().toISOString(), langs: ['en'] };
  const f = facets(caption); if (f.length) record.facets = f;
  if (images.length) record.embed = { $type: 'app.bsky.embed.images', images };
  const r = await xrpc(c.service, 'com.atproto.repo.createRecord', { repo: s.did, collection: 'app.bsky.feed.post', record }, s.accessJwt);
  return { uri: r.uri, url: `https://bsky.app/profile/${s.handle || c.handle}/post/${String(r.uri).split('/').pop()}` };
}

module.exports = { connect, post, problem, cleanHandle, facets, jpegSize, MAX_TEXT, MAX_IMAGES };
