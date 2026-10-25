// Account Connections: Google Business Profile, Facebook Pages and Instagram. Also holds the TikTok app's keys for Alpha → Social (lib/tiktok.js).
// The platform's Google and Meta app keys are set in Alpha → Settings → Integrations (or GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, META_APP_ID / META_APP_SECRET).
// A business signs in with Google or Facebook; the sign-in returns to the platform address (one redirect URI to register with each),
// which saves the connection in that business's account. Tokens live in the account's secrets and never reach the browser.
const crypto = require('crypto');
const tenancy = require('./tenancy');

const P = () => tenancy.platform();
const META_V = 'v21.0';
const GRAPH = `https://graph.facebook.com/${META_V}`;

// ---------- the platform's app keys ----------
function apps() {
  const a = P().oauthApps || {};
  return {
    google: { id: (a.google && a.google.id) || process.env.GOOGLE_CLIENT_ID || '', secret: (a.google && a.google.secret) || process.env.GOOGLE_CLIENT_SECRET || '', fromEnv: !(a.google && a.google.id) && !!process.env.GOOGLE_CLIENT_ID },
    meta: { id: (a.meta && a.meta.id) || process.env.META_APP_ID || '', secret: (a.meta && a.meta.secret) || process.env.META_APP_SECRET || '', fromEnv: !(a.meta && a.meta.id) && !!process.env.META_APP_ID },
    tiktok: { id: (a.tiktok && a.tiktok.id) || process.env.TIKTOK_CLIENT_KEY || '', secret: (a.tiktok && a.tiktok.secret) || process.env.TIKTOK_CLIENT_SECRET || '', fromEnv: !(a.tiktok && a.tiktok.id) && !!process.env.TIKTOK_CLIENT_KEY },
  };
}
const appKey = (kind) => (kind === 'google' || kind === 'tiktok' ? kind : 'meta'); // Facebook and Instagram both sign in with Facebook (Meta)
const ready = (kind) => { const a = apps()[appKey(kind)]; return !!(a.id && a.secret); };
const redirectUri = (provider) => `${tenancy.platformUrl()}/oauth/${provider}/callback`;
function saveApp(provider, b) {
  if (!['google', 'meta', 'tiktok'].includes(provider)) throw Object.assign(new Error('Unknown connection'), { status: 404 });
  const id = String(b.id || '').trim().slice(0, 200); const old = (P().oauthApps || {})[provider] || {};
  const secret = String(b.secret || '').trim().slice(0, 200) || (old.id === id ? old.secret : '');
  if (provider === 'google' && !/^[\w.-]+\.apps\.googleusercontent\.com$/.test(id)) throw Object.assign(new Error('Paste the Client ID from Google Cloud (it ends in .apps.googleusercontent.com)'), { status: 400 });
  if (provider === 'meta' && !/^\d{6,20}$/.test(id)) throw Object.assign(new Error('Paste the App ID from Meta for Developers (numbers only)'), { status: 400 });
  if (provider === 'tiktok' && !/^[A-Za-z0-9]{6,64}$/.test(id)) throw Object.assign(new Error('Paste the Client key from your app on TikTok for Developers'), { status: 400 });
  if (!secret) throw Object.assign(new Error(provider === 'meta' ? 'Paste the App secret too' : 'Paste the Client secret too'), { status: 400 });
  P().oauthApps = { ...(P().oauthApps || {}), [provider]: { id, secret } }; tenancy.savePlatform();
}
function removeApp(provider) { if (P().oauthApps) { delete P().oauthApps[provider]; tenancy.savePlatform(); } }
// for Alpha: never the secrets themselves
function appsView() {
  const a = apps(); const used = (k) => P().tenants.filter((t) => (t.social || []).includes(k)).length;
  return {
    google: { id: a.google.id, secret: !!a.google.secret, fromEnv: a.google.fromEnv, redirectUri: redirectUri('google'), connected: used('google') },
    meta: { id: a.meta.id, secret: !!a.meta.secret, fromEnv: a.meta.fromEnv, redirectUri: redirectUri('meta'), connected: { facebook: used('facebook'), instagram: used('instagram') } },
    tiktok: { id: a.tiktok.id, secret: !!a.tiktok.secret, fromEnv: a.tiktok.fromEnv, redirectUri: redirectUri('tiktok'), connected: !!P().tiktok },
  };
}

// ---------- sign-in: a signed "state" says which account and login started it; it's good for 15 minutes ----------
function stateKey() { if (!P().oauthStateKey) { P().oauthStateKey = crypto.randomBytes(32).toString('hex'); tenancy.savePlatform(); } return P().oauthStateKey; }
const mac = (body) => crypto.createHmac('sha256', stateKey()).update(body).digest('base64url');
const sign = (o) => { const body = Buffer.from(JSON.stringify(o)).toString('base64url'); return `${body}.${mac(body)}`; };
function verify(s) {
  const [body, m] = String(s || '').split('.'); if (!body || !m) return null; const want = mac(body);
  if (m.length !== want.length || !crypto.timingSafeEqual(Buffer.from(m), Buffer.from(want))) return null;
  try { const o = JSON.parse(Buffer.from(body, 'base64url').toString()); return o.exp > Date.now() ? o : null; } catch (e) { return null; }
}
const META_SCOPES = {
  facebook: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'business_management'],
  instagram: ['pages_show_list', 'pages_read_engagement', 'business_management', 'instagram_basic', 'instagram_content_publish'],
};
function startUrl(kind, tenantId, userId) {
  const a = apps()[appKey(kind)]; const state = sign({ k: kind, t: tenantId, u: userId, n: crypto.randomBytes(6).toString('hex'), exp: Date.now() + 15 * 60e3 });
  if (kind === 'google') return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: a.id, redirect_uri: redirectUri('google'), response_type: 'code', scope: 'https://www.googleapis.com/auth/business.manage', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state });
  return `https://www.facebook.com/${META_V}/dialog/oauth?` + new URLSearchParams({ client_id: a.id, redirect_uri: redirectUri('meta'), response_type: 'code', scope: META_SCOPES[kind].join(','), state });
}

// ---------- HTTP ----------
async function call(url, opts = {}) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
  const txt = await r.text(); let j; try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = { raw: txt }; }
  if (!r.ok || j.error) {
    const e = j.error; const msg = typeof e === 'string' ? j.error_description || e : (e && (e.error_user_msg || e.message)) || `The request failed (${r.status})`;
    throw Object.assign(new Error(msg), { status: r.status >= 400 && r.status < 500 ? 400 : 502 });
  }
  return j;
}
const form = (o) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) });
const json = (method, o) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

// ---------- Google Business Profile ----------
// conn: the saved connection; refreshing the access token changes it, so callers save the account afterwards
async function googleToken(conn) {
  if (conn.accessToken && conn.expiresAt > Date.now()) return conn.accessToken;
  const a = apps().google;
  const t = await call('https://oauth2.googleapis.com/token', form({ client_id: a.id, client_secret: a.secret, refresh_token: conn.refreshToken, grant_type: 'refresh_token' }))
    .catch((e) => { throw Object.assign(new Error(`Google stopped allowing access (${e.message}). Disconnect and connect again.`), { status: 400, reconnect: true }); });
  conn.accessToken = t.access_token; conn.expiresAt = Date.now() + ((t.expires_in || 3600) - 120) * 1000;
  return conn.accessToken;
}
async function google(conn, method, url, body) {
  const tok = await googleToken(conn); const opts = body ? json(method, body) : { method };
  opts.headers = { ...(opts.headers || {}), authorization: `Bearer ${tok}` };
  return call(url, opts);
}
// every location the Google account manages
async function googleLocations(conn) {
  const { accounts = [] } = await google(conn, 'GET', 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20');
  const out = [];
  for (const acc of accounts) {
    const r = await google(conn, 'GET', `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?pageSize=100&readMask=name,title,storefrontAddress,metadata`);
    for (const l of r.locations || []) {
      const ad = l.storefrontAddress || {};
      out.push({ account: acc.name, location: l.name, title: l.title || acc.accountName || 'Your business', address: [...(ad.addressLines || []), ad.locality, ad.administrativeArea].filter(Boolean).join(', '),
        mapsUrl: (l.metadata && l.metadata.mapsUri) || '', reviewUrl: (l.metadata && l.metadata.newReviewUri) || '', placeId: (l.metadata && l.metadata.placeId) || '' });
    }
  }
  return out;
}
async function googleConnect(code) {
  const a = apps().google;
  const t = await call('https://oauth2.googleapis.com/token', form({ code, client_id: a.id, client_secret: a.secret, redirect_uri: redirectUri('google'), grant_type: 'authorization_code' }));
  if (!t.refresh_token) throw new Error('Google didn’t allow ongoing access. Try connecting again.');
  const conn = { refreshToken: t.refresh_token, accessToken: t.access_token, expiresAt: Date.now() + ((t.expires_in || 3600) - 120) * 1000, connectedAt: new Date().toISOString(), reviews: true, booking: false };
  const locs = await googleLocations(conn);
  if (!locs.length) throw new Error('That Google account doesn’t manage a Business Profile. Sign in with the Google account that owns your business on Google.');
  return Object.assign(conn, locs[0], { choices: locs.length });
}
async function googleRevoke(conn) { await call('https://oauth2.googleapis.com/revoke', form({ token: conn.refreshToken })).catch(() => {}); }
const STARS = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
async function googleReviews(conn, pageToken) {
  const r = await google(conn, 'GET', `https://mybusiness.googleapis.com/v4/${conn.account}/${conn.location}/reviews?pageSize=50${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`);
  return {
    average: r.averageRating || 0, total: r.totalReviewCount || 0, next: r.nextPageToken || '',
    reviews: (r.reviews || []).map((v) => ({ id: v.reviewId, name: v.name, reviewer: (v.reviewer && v.reviewer.displayName) || 'A Google user', photo: (v.reviewer && v.reviewer.profilePhotoUrl) || '',
      stars: STARS[v.starRating] || 0, comment: (v.comment || '').replace(/\s*\(Translated by Google\)[\s\S]*$/, ''), createdAt: v.createTime, updatedAt: v.updateTime,
      reply: v.reviewReply ? { comment: v.reviewReply.comment, updatedAt: v.reviewReply.updateTime } : null })),
  };
}
const ownReview = (conn, name) => { if (!String(name).startsWith(`${conn.account}/${conn.location}/reviews/`)) throw Object.assign(new Error('Review not found'), { status: 404 }); };
async function googleReply(conn, name, comment) { ownReview(conn, name); return google(conn, 'PUT', `https://mybusiness.googleapis.com/v4/${name}/reply`, { comment }); }
async function googleDeleteReply(conn, name) { ownReview(conn, name); return google(conn, 'DELETE', `https://mybusiness.googleapis.com/v4/${name}/reply`); }
// online booking: an "Appointment" button on the Google profile that opens the business's booking page
async function googleBookingLink(conn, uri) {
  const base = `https://mybusinessplaceactions.googleapis.com/v1/${conn.location}/placeActionLinks`;
  const { placeActionLinks = [] } = await google(conn, 'GET', base);
  const mine = placeActionLinks.filter((l) => l.placeActionType === 'APPOINTMENT' && l.providerType !== 'AGGREGATOR_3P');
  if (!uri) { for (const l of mine) if (conn.bookingLink === l.name || l.uri === conn.bookingUri) await google(conn, 'DELETE', `https://mybusinessplaceactions.googleapis.com/v1/${l.name}`).catch(() => {}); conn.bookingLink = ''; conn.bookingUri = ''; return; }
  const have = mine.find((l) => l.uri === uri);
  const l = have || await google(conn, 'POST', base, { uri, placeActionType: 'APPOINTMENT', isPreferred: true });
  conn.bookingLink = l.name; conn.bookingUri = uri;
}

// ---------- Facebook Pages and Instagram (Meta) ----------
const graph = (path, params = {}) => call(`${GRAPH}/${path}?${new URLSearchParams(params)}`);
const graphPost = (path, params) => call(`${GRAPH}/${path}`, form(params));
// the Pages the person manages, each with its Page token and any Instagram professional account linked to it
async function metaPages(userToken) {
  const r = await graph('me/accounts', { fields: 'id,name,link,access_token,instagram_business_account{id,username,profile_picture_url}', limit: 100, access_token: userToken });
  return (r.data || []).map((p) => ({ id: p.id, name: p.name, link: p.link || `https://www.facebook.com/${p.id}`, token: p.access_token,
    ig: p.instagram_business_account ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username || '' } : null }));
}
async function metaConnect(kind, code) {
  const a = apps().meta;
  const short = await graph('oauth/access_token', { client_id: a.id, client_secret: a.secret, redirect_uri: redirectUri('meta'), code });
  const long = await graph('oauth/access_token', { grant_type: 'fb_exchange_token', client_id: a.id, client_secret: a.secret, fb_exchange_token: short.access_token });
  const pages = await metaPages(long.access_token); const at = new Date().toISOString();
  if (kind === 'facebook') {
    if (!pages.length) throw new Error('No Facebook Page came through. Connect again and choose your business Page (you need full admin access to it).');
    const p = pages[0]; return { pageId: p.id, name: p.name, link: p.link, token: p.token, userToken: long.access_token, choices: pages.length, connectedAt: at };
  }
  const withIg = pages.filter((p) => p.ig);
  if (!withIg.length) throw new Error('No Instagram professional account came through. Switch your Instagram to a Business or Creator account, link it to your Facebook Page, then connect again.');
  const p = withIg[0]; return { igId: p.ig.id, username: p.ig.username, pageId: p.id, token: p.token, userToken: long.access_token, choices: withIg.length, connectedAt: at };
}
// switching to another Page or Instagram account the same sign-in can manage
async function metaChoices(kind, conn) {
  const pages = await metaPages(conn.userToken);
  return kind === 'facebook' ? pages.map((p) => ({ id: p.id, label: p.name, page: p })) : pages.filter((p) => p.ig).map((p) => ({ id: p.ig.id, label: '@' + p.ig.username, page: p }));
}
async function metaRevoke(conn) { await call(`${GRAPH}/me/permissions?access_token=${encodeURIComponent(conn.userToken)}`, { method: 'DELETE' }).catch(() => {}); }
// photo posts: images must be at public addresses (JPEG for Instagram)
async function facebookPost(conn, { caption, images }) {
  if (!images.length) return graphPost(`${conn.pageId}/feed`, { message: caption, access_token: conn.token });
  if (images.length === 1) return graphPost(`${conn.pageId}/photos`, { url: images[0], caption, access_token: conn.token });
  const ids = []; for (const url of images) ids.push((await graphPost(`${conn.pageId}/photos`, { url, published: 'false', access_token: conn.token })).id);
  const p = { message: caption, access_token: conn.token }; ids.forEach((id, i) => { p[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
  return graphPost(`${conn.pageId}/feed`, p);
}
async function instagramPost(conn, { caption, images }) {
  if (!images.length) throw Object.assign(new Error('Instagram posts need at least one photo'), { status: 400 });
  let creation;
  if (images.length === 1) creation = (await graphPost(`${conn.igId}/media`, { image_url: images[0], caption, access_token: conn.token })).id;
  else {
    const kids = []; for (const url of images.slice(0, 10)) kids.push((await graphPost(`${conn.igId}/media`, { image_url: url, is_carousel_item: 'true', access_token: conn.token })).id);
    creation = (await graphPost(`${conn.igId}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption, access_token: conn.token })).id;
  }
  // Instagram processes the photos first; publishing too soon fails, so wait until it's ready (up to ~30 seconds)
  for (let i = 0; i < 15; i++) {
    const s = await graph(creation, { fields: 'status_code', access_token: conn.token });
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw Object.assign(new Error('Instagram couldn’t use those photos. Try JPEG photos under 8 MB.'), { status: 400 });
    await new Promise((r) => setTimeout(r, 2000));
  }
  const r = await graphPost(`${conn.igId}/media_publish`, { creation_id: creation, access_token: conn.token });
  const m = await graph(r.id, { fields: 'permalink', access_token: conn.token }).catch(() => ({}));
  return { id: r.id, permalink: m.permalink || '' };
}

module.exports = {
  apps, ready, redirectUri, saveApp, removeApp, appsView, startUrl, sign, verify,
  googleConnect, googleLocations, googleRevoke, googleReviews, googleReply, googleDeleteReply, googleBookingLink,
  metaConnect, metaChoices, metaRevoke, facebookPost, instagramPost,
};
