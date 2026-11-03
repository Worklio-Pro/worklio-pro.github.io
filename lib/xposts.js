// X: a business posts with its own X developer app (developer.x.com), because X bills the app for every post (pay-per-use credits).
// The business pastes the app's API key and secret and the access token and secret it generated for its own X account (with Read and write
// permission), so there's no sign-in to set up on the platform. Requests are signed with OAuth 1.0a; the keys stay in the account's secrets.
const crypto = require('crypto');
const API = 'https://api.x.com/2';
const MAX_TEXT = 280; const MAX_IMAGES = 4; const MAX_IMAGE_BYTES = 5e6; // X's limits: characters, photos per post, bytes per photo
const err = (message, status = 400) => Object.assign(new Error(message), { status });

// RFC 3986 encoding, as OAuth 1.0a signs it
const pct = (s) => encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
function authHeader(c, method, url) {
  const o = { oauth_consumer_key: c.apiKey, oauth_nonce: crypto.randomBytes(16).toString('hex'), oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: String(Math.floor(Date.now() / 1000)), oauth_token: c.accessToken, oauth_version: '1.0' };
  const u = new URL(url); const all = [...u.searchParams, ...Object.entries(o)].map(([k, v]) => [pct(k), pct(v)]).sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : 1) : a < b ? -1 : 1));
  const base = [method, pct(u.origin + u.pathname), pct(all.map(([k, v]) => `${k}=${v}`).join('&'))].join('&');
  o.oauth_signature = crypto.createHmac('sha1', `${pct(c.apiSecret)}&${pct(c.accessSecret)}`).update(base).digest('base64');
  return 'OAuth ' + Object.entries(o).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(', ');
}
// body: a JSON object or FormData (FormData fields aren't part of the signature)
async function call(c, method, path, body) {
  const url = API + path; const headers = { authorization: authHeader(c, method, url) };
  if (body && !(body instanceof FormData)) headers['content-type'] = 'application/json';
  let r; try { r = await fetch(url, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) }); } catch (e) { throw err('Couldn’t reach X. Try again in a minute.', 502); }
  const txt = await r.text(); let j; try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = {}; }
  if (r.ok && !(j.errors && !j.data)) return j;
  const msg = (j.errors && j.errors[0] && (j.errors[0].detail || j.errors[0].message)) || j.detail || j.title || `X answered with an error (${r.status})`;
  if (r.status === 401) throw err('X didn’t accept those keys. Check all four, or generate a new access token and secret in your X developer app.');
  if (r.status === 402) throw err('Your X developer account is out of credits. Add credits at developer.x.com, then post again.');
  if (r.status === 403 && /permi|oauth1/i.test(msg)) throw err('X says this app can’t post. In your X developer app, set the app permissions to Read and write, then generate a new access token and secret and connect again.');
  if (r.status === 429) throw err('X says you’ve posted too often. Wait a few minutes and try again.', 429);
  throw err(`X: ${msg}`, r.status >= 500 ? 502 : 400);
}

// checks the four keys by asking X whose account they are, and returns the connection to save
async function connect(b) {
  const c = Object.fromEntries(['apiKey', 'apiSecret', 'accessToken', 'accessSecret'].map((k) => [k, String(b[k] || '').trim()]));
  if (Object.values(c).some((v) => !v || v.length > 200 || /\s/.test(v))) throw err('Paste all four: the API key and secret, and the access token and secret');
  const { data: me = {} } = await call(c, 'GET', '/users/me');
  return { ...c, userId: me.id || '', username: me.username || '', name: me.name || me.username || 'X account', connectedAt: new Date().toISOString() };
}
// what would stop a post, checked before posting anywhere
function problem({ caption, jpegs }) {
  if (caption.length > MAX_TEXT) return `X posts can be up to ${MAX_TEXT} characters`;
  if (jpegs.length > MAX_IMAGES) return `X posts can have up to ${MAX_IMAGES} photos. Remove some or untick X.`;
  if (jpegs.some((b) => b.length > MAX_IMAGE_BYTES)) return 'Each photo on X must be under 5 MB';
  if (!caption && !jpegs.length) return 'Add a photo or write a caption';
  return '';
}
// the photos go up first (X keeps them for a day), then the post with their IDs
async function post(c, { caption, jpegs }) {
  const ids = [];
  for (const buf of jpegs.slice(0, MAX_IMAGES)) {
    const f = new FormData(); f.append('media', new Blob([buf], { type: 'image/jpeg' }), 'photo.jpg'); f.append('media_category', 'tweet_image'); f.append('media_type', 'image/jpeg');
    const { data = {} } = await call(c, 'POST', '/media/upload', f);
    if (!data.id) throw err('X didn’t take the photo. Try again.', 502); ids.push(data.id);
  }
  const { data = {} } = await call(c, 'POST', '/tweets', { ...(caption ? { text: caption } : {}), ...(ids.length ? { media: { media_ids: ids } } : {}) });
  return { url: `https://x.com/${c.username || 'i'}/status/${data.id}` };
}

module.exports = { connect, post, problem, MAX_TEXT, MAX_IMAGES, authHeader };
