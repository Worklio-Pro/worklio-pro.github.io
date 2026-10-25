// Alpha → Social: posting to the platform's own TikTok account through TikTok's Content Posting API.
// The TikTok app's Client key and secret are set in Alpha → Settings → Integrations → TikTok (or TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET),
// through lib/social.js like the Google and Meta apps. The owner connects one TikTok account in Alpha → Social; its tokens stay in
// platform.json and never reach the browser.
// A post is a caption with one video or up to 35 photos, uploaded to <DATA_DIR>/social and served at /social-media/<file> on every
// address: TikTok downloads them from the platform's address (PULL_FROM_URL), so that domain must be verified in the TikTok app.
// It's posted now or at a set time (Direct Post), or sent to the TikTok inbox to finish in the TikTok app (drafts).
// Until TikTok audits the app, everything posted is private (only the account owner sees it).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const tenancy = require('./tenancy');
const social = require('./social');

const P = () => tenancy.platform();
const API = 'https://open.tiktokapis.com/v2';
const SCOPES = ['user.info.basic', 'video.publish', 'video.upload'];
const DIR = path.join(tenancy.DATA_DIR, 'social');
const FILE_RE = /^\/social-media\/([a-f0-9]{16}\.(mp4|mov|webm|jpg|webp))$/;
const TYPES = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', jpg: 'image/jpeg', webp: 'image/webp' };
const EXT = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'image/jpeg': 'jpg', 'image/webp': 'webp' }; // what TikTok accepts
const MAX_VIDEO = 250 * 1024 * 1024; const MAX_PHOTO = 20 * 1024 * 1024; const MAX_PHOTOS = 35;
const err = (message, status = 400) => Object.assign(new Error(message), { status });

// ---------- HTTP: TikTok answers { data, error: { code: 'ok' | …, message } }; the token endpoints answer { error, error_description } ----------
async function call(url, opts = {}) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
  const txt = await r.text(); let j; try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = { raw: txt }; }
  const e = j.error;
  if (!r.ok || (typeof e === 'string' && e) || (e && e.code && e.code !== 'ok')) {
    const code = typeof e === 'string' ? e : (e && e.code) || '';
    const msg = j.error_description || (e && e.message) || `TikTok said no (${r.status})`;
    throw Object.assign(new Error(MESSAGES[code] || msg), { status: r.status >= 500 ? 502 : 400, code });
  }
  return j;
}
// plain words for the errors people are likely to meet
const MESSAGES = {
  unaudited_client_can_only_post_to_private_accounts: 'Until TikTok approves your app, your TikTok account must be private and posts set to “Only me”. In the TikTok app: Profile → ☰ → Settings and privacy → Privacy → Private account. Then retry.',
  spam_risk_too_many_posts: 'TikTok has paused posting for this account for now (too many posts today). Try again later.',
  spam_risk_user_banned_from_posting: 'TikTok isn’t letting this account post right now.',
  privacy_level_option_mismatch: 'That privacy option isn’t available for this account. Choose another one.',
  url_ownership_unverified: 'TikTok can’t download from this address. Verify your domain under URL properties in the TikTok app.',
  access_token_invalid: 'TikTok signed this account out. Disconnect and connect again.',
  scope_not_authorized: 'The TikTok account didn’t allow posting. Disconnect and connect again, and allow every permission.',
  invalid_grant: 'TikTok signed this account out. Disconnect and connect again.',
};
const form = (o) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) });
const bearer = (tok, body) => ({ method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json; charset=UTF-8' }, body: JSON.stringify(body || {}) });

// ---------- the connected account ----------
const app = () => social.apps().tiktok;
const ready = () => social.ready('tiktok');
function startUrl(adminId) {
  const state = social.sign({ k: 'tiktok', t: 'alpha', u: adminId, n: crypto.randomBytes(6).toString('hex'), exp: Date.now() + 15 * 60e3 });
  return 'https://www.tiktok.com/v2/auth/authorize/?' + new URLSearchParams({ client_key: app().id, scope: SCOPES.join(','), response_type: 'code', redirect_uri: social.redirectUri('tiktok'), state });
}
const tokenInto = (conn, t) => Object.assign(conn, {
  openId: t.open_id || conn.openId, accessToken: t.access_token, expiresAt: Date.now() + ((t.expires_in || 86400) - 300) * 1000,
  refreshToken: t.refresh_token || conn.refreshToken, refreshExpiresAt: Date.now() + (t.refresh_expires_in || 31536000) * 1000, scope: t.scope || conn.scope || '',
});
async function connect(code) {
  const a = app();
  const t = await call(`${API}/oauth/token/`, form({ client_key: a.id, client_secret: a.secret, code, grant_type: 'authorization_code', redirect_uri: social.redirectUri('tiktok') }));
  const conn = tokenInto({ connectedAt: new Date().toISOString() }, t);
  const missing = SCOPES.filter((s) => !String(conn.scope).split(',').includes(s));
  if (missing.length) throw err(`TikTok didn’t allow ${missing.join(', ')}. Connect again and keep every permission switched on.`);
  const u = await call(`${API}/user/info/?fields=open_id,avatar_url,display_name`, { headers: { authorization: `Bearer ${conn.accessToken}` } }).catch(() => ({ data: {} }));
  const user = (u.data && u.data.user) || {};
  Object.assign(conn, { name: user.display_name || 'TikTok account', avatar: user.avatar_url || '' });
  P().tiktok = conn; tenancy.savePlatform(); return conn;
}
async function token() {
  const conn = P().tiktok; if (!conn) throw err('Connect your TikTok account first');
  if (conn.accessToken && conn.expiresAt > Date.now()) return conn.accessToken;
  const a = app();
  const t = await call(`${API}/oauth/token/`, form({ client_key: a.id, client_secret: a.secret, grant_type: 'refresh_token', refresh_token: conn.refreshToken }))
    .catch((e) => { throw err(`TikTok signed this account out (${e.message}). Disconnect and connect again.`); });
  tokenInto(conn, t); tenancy.savePlatform(); return conn.accessToken;
}
async function disconnect() {
  const conn = P().tiktok; const a = app();
  if (conn && a.id) await call(`${API}/oauth/revoke/`, form({ client_key: a.id, client_secret: a.secret, token: conn.accessToken })).catch(() => {});
  delete P().tiktok; tenancy.savePlatform();
}
const account = () => { const c = P().tiktok; return c ? { name: c.name, avatar: c.avatar, connectedAt: c.connectedAt } : null; };
// what this account may post right now: privacy options, which interactions it allows, longest video. TikTok wants this fetched for every post.
async function creator() {
  const r = await call(`${API}/post/publish/creator_info/query/`, bearer(await token()));
  const d = r.data || {};
  return { nickname: d.creator_nickname || '', username: d.creator_username || '', avatar: d.creator_avatar_url || '', privacy: d.privacy_level_options || [],
    commentOff: !!d.comment_disabled, duetOff: !!d.duet_disabled, stitchOff: !!d.stitch_disabled, maxSeconds: d.max_video_post_duration_sec || 0 };
}

// ---------- media: streamed to disk (not through the JSON body reader), served publicly for TikTok to download ----------
function upload(req) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase(); const ext = EXT[type];
    if (!ext) return reject(err('Upload an MP4, MOV or WebM video, or JPG or WebP photos (TikTok doesn’t take PNG or GIF)'));
    const video = type.startsWith('video/'); const max = video ? MAX_VIDEO : MAX_PHOTO;
    if (Number(req.headers['content-length'] || 0) > max) return reject(err(video ? 'Use a video under 250 MB' : 'Use photos under 20 MB'));
    fs.mkdirSync(DIR, { recursive: true });
    const file = `${crypto.randomBytes(8).toString('hex')}.${ext}`; const full = path.join(DIR, file); const out = fs.createWriteStream(full);
    let size = 0; let failed = false;
    const fail = (e) => { if (failed) return; failed = true; out.destroy(); fs.rm(full, () => {}); reject(e); };
    req.on('data', (c) => { size += c.length; if (size > max) { fail(err(video ? 'Use a video under 250 MB' : 'Use photos under 20 MB')); req.destroy(); } });
    req.on('error', fail); out.on('error', fail);
    req.pipe(out);
    out.on('finish', () => { if (!failed) resolve({ file, type: video ? 'video' : 'photo', size, name: String(req.headers['x-file-name'] || '').slice(0, 120) }); });
  });
}
// GET /social-media/<file> on every address; true when it answered. Videos answer byte ranges, so browsers can preview them.
function serve(req, res) {
  const m = FILE_RE.exec(req.url.split('?')[0]); if (!m) return false;
  const full = path.join(DIR, m[1]);
  fs.stat(full, (e, st) => {
    if (e || !st.isFile()) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[m[2]]); res.setHeader('Accept-Ranges', 'bytes'); res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    let start = 0; let end = st.size - 1;
    if (range) {
      start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2])); end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
      if (start > end || start >= st.size) { res.statusCode = 416; res.setHeader('Content-Range', `bytes */${st.size}`); return res.end(); }
      res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${st.size}`);
    }
    res.setHeader('Content-Length', end - start + 1);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(full, { start, end }).pipe(res);
  });
  return true;
}
const mediaUrl = (file) => `${tenancy.platformUrl()}/social-media/${file}`;
const removeMedia = (m) => { if (/^[a-f0-9]{16}\.(mp4|mov|webm|jpg|webp)$/.test(m.file)) fs.rm(path.join(DIR, m.file), () => {}); };

// ---------- posts ----------
const posts = () => { if (!P().socialPosts) P().socialPosts = []; return P().socialPosts; };
const STATUS = ['scheduled', 'posting', 'processing', 'posted', 'sent', 'failed'];
// (posts that failed before error codes were kept are recognised by their message)
const view = (p) => ({ ...p, errorCode: p.errorCode || (/^Until TikTok approves your app/.test(p.error || '') ? 'unaudited_client_can_only_post_to_private_accounts' : ''), media: p.media.map((m) => ({ ...m, url: `/social-media/${m.file}` })) });
const list = () => posts().slice().sort((a, b) => String(b.scheduledAt || b.createdAt).localeCompare(String(a.scheduledAt || a.createdAt))).slice(0, 200).map(view);
function create(b, admin) {
  const media = (Array.isArray(b.media) ? b.media : []).filter((m) => m && /^[a-f0-9]{16}\.(mp4|mov|webm|jpg|webp)$/.test(m.file) && fs.existsSync(path.join(DIR, m.file)))
    .map((m) => ({ file: m.file, type: /\.(mp4|mov|webm)$/.test(m.file) ? 'video' : 'photo', name: String(m.name || '').slice(0, 120) }));
  const videos = media.filter((m) => m.type === 'video');
  if (!media.length) throw err('Add a video or photos');
  if (videos.length > 1 || (videos.length && media.length > 1)) throw err('A TikTok post is one video, or photos (up to 35), not both');
  if (media.length > MAX_PHOTOS) throw err('Use 35 photos or fewer');
  const inbox = b.mode === 'inbox'; const caption = String(b.caption || '').trim().slice(0, 2200);
  const p = { id: crypto.randomBytes(6).toString('hex'), caption, media, kind: videos.length ? 'video' : 'photo', mode: inbox ? 'inbox' : 'direct', createdAt: new Date().toISOString(), createdBy: admin ? admin.name : '' };
  if (!inbox) {
    // TikTok's posting rules: a privacy level the person chose (no default), interactions off unless they turn them on, and an
    // honest commercial disclosure; branded content can't be private
    if (!b.privacy) throw err('Choose who can see this post');
    const yourBrand = !!b.yourBrand; const branded = !!b.branded;
    if (b.disclose && !yourBrand && !branded) throw err('You turned on content disclosure: choose Your brand, Branded content or both');
    if (branded && b.privacy === 'SELF_ONLY') throw err('Branded content can’t be private. Choose another privacy option.');
    Object.assign(p, { privacy: String(b.privacy), allowComment: !!b.allowComment, allowDuet: p.kind === 'video' && !!b.allowDuet, allowStitch: p.kind === 'video' && !!b.allowStitch, yourBrand: !!b.disclose && yourBrand, branded: !!b.disclose && branded });
  }
  const when = b.scheduledAt ? new Date(b.scheduledAt) : null;
  if (when && isNaN(when)) throw err('Choose a valid date and time');
  if (when && when < Date.now() - 60e3) throw err('Choose a time in the future');
  if (when && when > Date.now() + 90 * 864e5) throw err('Schedule posts up to 90 days ahead');
  Object.assign(p, { status: when ? 'scheduled' : 'posting', scheduledAt: when ? when.toISOString() : null });
  posts().push(p); tenancy.savePlatform();
  if (!when) publish(p).catch(() => {}); // the result shows in the post's status
  return view(p);
}
function remove(id) {
  const i = posts().findIndex((p) => p.id === id); if (i < 0) throw err('Post not found', 404);
  const p = posts()[i]; if (['posting', 'processing'].includes(p.status)) throw err('This post is being sent to TikTok. Wait until it finishes.');
  // media stays for posts that reached TikTok until they're removed from this list; it isn't needed after that
  p.media.forEach(removeMedia); posts().splice(i, 1); tenancy.savePlatform();
}
// a failed post, sent again now with the same media and settings (or as “Only me”: until TikTok approves the app, it takes only
// “Only me” posts, and only to a private account)
function retry(id, b = {}) {
  const p = posts().find((x) => x.id === id); if (!p) throw err('Post not found', 404);
  if (p.status !== 'failed') throw err('Only a failed post can be retried');
  if (!p.media.every((m) => fs.existsSync(path.join(DIR, m.file)))) throw err('This post’s video or photos are gone from the server. Make a new post.');
  if (b.privacy === 'SELF_ONLY' && p.mode === 'direct') { if (p.branded) throw err('Branded content can’t be private. Make a new post without branded content.'); p.privacy = 'SELF_ONLY'; }
  publish(p).catch(() => {}); return view(p);
}
async function publish(p) {
  Object.assign(p, { status: 'posting', error: '', errorCode: '', publishId: '', sentAt: new Date().toISOString() }); tenancy.savePlatform();
  try {
    const tok = await token(); const urls = p.media.map((m) => mediaUrl(m.file)); let r;
    if (p.kind === 'video') {
      if (p.mode === 'inbox') r = await call(`${API}/post/publish/inbox/video/init/`, bearer(tok, { source_info: { source: 'PULL_FROM_URL', video_url: urls[0] } }));
      else r = await call(`${API}/post/publish/video/init/`, bearer(tok, { post_info: { title: p.caption, privacy_level: p.privacy, disable_comment: !p.allowComment, disable_duet: !p.allowDuet, disable_stitch: !p.allowStitch, brand_organic_toggle: !!p.yourBrand, brand_content_toggle: !!p.branded }, source_info: { source: 'PULL_FROM_URL', video_url: urls[0] } }));
    } else {
      const info = { title: p.caption.split('\n')[0].slice(0, 90), description: p.caption.slice(0, 4000) };
      if (p.mode === 'direct') Object.assign(info, { privacy_level: p.privacy, disable_comment: !p.allowComment, auto_add_music: true, brand_organic_toggle: !!p.yourBrand, brand_content_toggle: !!p.branded });
      r = await call(`${API}/post/publish/content/init/`, bearer(tok, { post_info: info, source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: urls }, post_mode: p.mode === 'inbox' ? 'MEDIA_UPLOAD' : 'DIRECT_POST', media_type: 'PHOTO' }));
    }
    Object.assign(p, { publishId: (r.data || {}).publish_id, status: 'processing', sentAt: new Date().toISOString() });
  } catch (e) { Object.assign(p, { status: 'failed', error: e.message, errorCode: e.code || '' }); }
  tenancy.savePlatform(); return p;
}
// TikTok downloads and processes the media after the post is sent; ask how it went
async function check(p) {
  p.checkedAt = Date.now();
  try {
    const r = await call(`${API}/post/publish/status/fetch/`, bearer(await token(), { publish_id: p.publishId })); const d = r.data || {};
    if (d.status === 'PUBLISH_COMPLETE') Object.assign(p, { status: 'posted', postedAt: new Date().toISOString(), tiktokIds: d.publicaly_available_post_id || [] });
    else if (d.status === 'SEND_TO_USER_INBOX') Object.assign(p, { status: 'sent', postedAt: new Date().toISOString() });
    else if (d.status === 'FAILED') Object.assign(p, { status: 'failed', error: FAIL[d.fail_reason] || `TikTok couldn’t post it (${d.fail_reason || 'no reason given'})` });
  } catch (e) { if (Date.now() - new Date(p.sentAt) > 3600e3) Object.assign(p, { status: 'failed', error: e.message }); } // keep asking for an hour
  tenancy.savePlatform();
}
const FAIL = {
  file_format_check_failed: 'TikTok couldn’t read that file. Use an MP4 (H.264) video or JPG photos.',
  duration_check_failed: 'The video is longer than this account is allowed to post.',
  frame_rate_check_failed: 'TikTok needs a video between 23 and 60 frames per second.',
  picture_size_check_failed: 'TikTok couldn’t use one of the photos. Try smaller JPG photos.',
  video_pull_failed: 'TikTok couldn’t download the video from your site. Check the domain is verified in the TikTok app.',
  photo_pull_failed: 'TikTok couldn’t download the photos from your site. Check the domain is verified in the TikTok app.',
  publish_cancelled: 'The post was cancelled in TikTok.',
  auth_removed: 'The TikTok account disconnected this app. Connect again.',
  spam_risk_too_many_posts: MESSAGES.spam_risk_too_many_posts,
  spam_risk_user_banned_from_posting: MESSAGES.spam_risk_user_banned_from_posting,
};
// every 30 seconds: send what's due, and ask about posts TikTok is still processing (every 15 seconds at most per post)
let busy = false;
async function tick() {
  if (busy || !P()) return; busy = true;
  try {
    const now = Date.now();
    for (const p of posts().filter((x) => x.status === 'scheduled' && new Date(x.scheduledAt) <= now)) await publish(p);
    for (const p of posts().filter((x) => x.status === 'processing' && x.publishId && now - (x.checkedAt || 0) > 15e3)) await check(p);
    // a post that was being sent when the server stopped: say so instead of leaving it waiting
    posts().filter((x) => x.status === 'posting' && !x.publishId && now - new Date(x.sentAt || x.scheduledAt || x.createdAt) > 10 * 60e3)
      .forEach((x) => Object.assign(x, { status: 'failed', error: 'The server restarted while sending this post. Post it again.' }));
  } catch (e) { console.error('tiktok:', e.message); } finally { busy = false; }
}
function init() { setInterval(() => { tick(); }, 30e3).unref(); setTimeout(() => { tick(); }, 10e3).unref(); }

module.exports = { SCOPES, STATUS, ready, startUrl, connect, disconnect, account, creator, upload, serve, list, create, retry, remove, check, init };
