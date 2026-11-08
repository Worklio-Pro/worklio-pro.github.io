// Marketing → Connect your social accounts: Instagram, LinkedIn company pages, Pinterest boards, Threads, TikTok and YouTube, each connected by the business itself.
// Each network's app keys come from lib/social.js apps() (the .env variables in README → Going live). The sign-in returns to
// /oauth/<network>/callback on the platform address (lib/platform.js), which saves the connection inside the business's account.
// A connection holds its tokens; posting refreshes them when they're about to run out and the caller saves the account.
const crypto = require('crypto');
const fs = require('fs');
const social = require('./social');

const err = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });
const app = (kind) => social.apps()[social.appKey(kind)];
const form = (o) => new URLSearchParams(Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)));
const soon = (ms) => Date.now() + ms;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch, reading JSON and turning each network's error shape into a message; returns { body, headers }
async function call(name, url, opts = {}) {
  let r; try { r = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) }); } catch (e) { throw err(`Couldn’t reach ${name}. Try again in a minute.`, 502); }
  const txt = await r.text(); let j; try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = {}; }
  const e = j.error;
  const failed = !r.ok || (typeof e === 'string' && e) || (e && typeof e === 'object' && e.code && e.code !== 'ok') || (e && typeof e === 'object' && !e.code && e.message);
  if (failed) {
    const msg = (typeof e === 'string' ? j.error_description || e : e && (e.error_user_msg || e.message)) || j.error_message || j.message || j.error_description || `${name} answered with an error (${r.status})`;
    if (r.status === 401) { console.error(`${name} 401: ${msg}${j.log_id ? ` (log ${j.log_id})` : ''}`); throw expired(name); } // the network no longer accepts the sign-in: say how to fix it
    throw err(`${name}: ${msg}${j.log_id ? ` (log ${j.log_id})` : ''}`, r.status >= 500 ? 502 : 400);
  }
  return { body: j, headers: r.headers };
}
const json = (method, body, headers = {}) => ({ method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const bearer = (tok, more = {}) => ({ authorization: `Bearer ${tok}`, ...more });
// a token that has run out with no way to refresh it: the business connects again
// shown to the business as it is (Marketing, Ready to post, posting results), so it says how to fix it
const expired = (name) => err(`${name} has signed Worklio Pro out, so it needs to be connected again. To fix it, the account owner or an admin goes to Settings → Account Connections, clicks Disconnect next to ${name}, then connects ${name} again.`, 400, { reconnect: true });
// refreshing a sign-in: a refusal (refresh token revoked, expired or replaced, or the app's keys changed) means connecting again; a network hiccup stays as it is
const refreshed = (name, p) => p.catch((e) => { throw e.status && e.status < 500 ? expired(name) : e; });

/* ---------- LinkedIn: posts as a company page the person is an admin of (Community Management API) ---------- */
const LI = 'https://api.linkedin.com/rest';
const LI_VERSION = () => process.env.LINKEDIN_VERSION || '202609'; // LinkedIn's API version (YYYYMM); each one works for about a year
const liHeaders = (tok) => bearer(tok, { 'LinkedIn-Version': LI_VERSION(), 'X-Restli-Protocol-Version': '2.0.0' });
const li = async (conn, method, path, body) => (await call('LinkedIn', `${LI}${path}`, body ? json(method, body, liHeaders(await liToken(conn))) : { method, headers: liHeaders(await liToken(conn)) }));
async function liToken(conn) {
  if (conn.expiresAt > Date.now()) return conn.token;
  if (!conn.refreshToken || conn.refreshExpiresAt < Date.now()) throw expired('LinkedIn');
  const a = app('linkedin');
  const { body: t } = await refreshed('LinkedIn', call('LinkedIn', 'https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', body: form({ grant_type: 'refresh_token', refresh_token: conn.refreshToken, client_id: a.id, client_secret: a.secret }) }));
  Object.assign(conn, liTokens(t)); return conn.token;
}
const liTokens = (t) => ({ token: t.access_token, expiresAt: soon(((t.expires_in || 5184000) - 300) * 1000), ...(t.refresh_token ? { refreshToken: t.refresh_token, refreshExpiresAt: soon(((t.refresh_token_expires_in || 31536000) - 300) * 1000) } : {}) });
// the company pages this person administers
async function liPages(conn) {
  const { body } = await li(conn, 'GET', '/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED');
  const out = [];
  for (const el of body.elements || []) {
    const id = String(el.organization || '').split(':').pop(); if (!id) continue;
    const { body: o } = await li(conn, 'GET', `/organizations/${id}`).catch(() => ({ body: {} }));
    out.push({ id: el.organization, label: o.localizedName || `Company page ${id}`, link: o.vanityName ? `https://www.linkedin.com/company/${o.vanityName}` : '' });
  }
  return out;
}
// LinkedIn's "little text" format: reserved characters escaped, #hashtags as hashtag links
const liText = (s) => s.replace(/(^|\s)#([\p{L}\p{N}]+)|[\\|{}@[\]()<>*_~#]/gu, (m, sp, tag) => (tag ? `${sp}{hashtag|\\#|${tag}}` : '\\' + m));
const linkedin = {
  name: 'LinkedIn', limits: { text: 3000, photos: 20 },
  startUrl: (state) => 'https://www.linkedin.com/oauth/v2/authorization?' + form({ response_type: 'code', client_id: app('linkedin').id, redirect_uri: social.redirectUri('linkedin'), state, scope: 'r_organization_social w_organization_social rw_organization_admin' }),
  async connect(code) {
    const a = app('linkedin');
    const { body: t } = await call('LinkedIn', 'https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', body: form({ grant_type: 'authorization_code', code, redirect_uri: social.redirectUri('linkedin'), client_id: a.id, client_secret: a.secret }) });
    const conn = { ...liTokens(t), connectedAt: new Date().toISOString() };
    const pages = await liPages(conn);
    if (!pages.length) throw err('That LinkedIn account isn’t an admin of a company page. Sign in with an admin of your business’s LinkedIn page.');
    return Object.assign(conn, { org: pages[0].id, name: pages[0].label, link: pages[0].link, choices: pages.length });
  },
  async choices(conn) { return (await liPages(conn)).map((p) => ({ id: p.id, label: p.label, sub: '', current: p.id === conn.org })); },
  async choose(conn, id) { const pages = await liPages(conn); const p = pages.find((x) => x.id === id); if (!p) throw err('Choose one of your company pages'); Object.assign(conn, { org: p.id, name: p.label, link: p.link, choices: pages.length }); },
  async post(conn, { caption, jpegs }) {
    const ids = [];
    for (const buf of jpegs.slice(0, 20)) {
      const { body: up } = await li(conn, 'POST', '/images?action=initializeUpload', { initializeUploadRequest: { owner: conn.org } });
      await call('LinkedIn', up.value.uploadUrl, { method: 'PUT', headers: bearer(conn.token, { 'content-type': 'application/octet-stream' }), body: buf });
      ids.push(up.value.image);
    }
    const post = { author: conn.org, commentary: liText(caption), visibility: 'PUBLIC', lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false,
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] } };
    if (ids.length === 1) post.content = { media: { id: ids[0] } };
    else if (ids.length > 1) post.content = { multiImage: { images: ids.map((id) => ({ id })) } };
    const { headers } = await li(conn, 'POST', '/posts', post);
    const urn = headers.get('x-restli-id') || '';
    return { url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : conn.link || '' };
  },
  async revoke(conn) { const a = app('linkedin'); await call('LinkedIn', 'https://www.linkedin.com/oauth/v2/revoke', { method: 'POST', body: form({ client_id: a.id, client_secret: a.secret, token: conn.token }) }).catch(() => {}); },
};

/* ---------- Pinterest: a Pin on one of the business's boards (API v5) ---------- */
const PIN = 'https://api.pinterest.com/v5';
const pinBasic = () => { const a = app('pinterest'); return 'Basic ' + Buffer.from(`${a.id}:${a.secret}`).toString('base64'); };
const pinTokens = (t) => ({ token: t.access_token, expiresAt: soon(((t.expires_in || 2592000) - 300) * 1000), ...(t.refresh_token ? { refreshToken: t.refresh_token, refreshExpiresAt: soon(((t.refresh_token_expires_in || 31536000) - 300) * 1000) } : {}) });
async function pinToken(conn) {
  if (conn.expiresAt > Date.now()) return conn.token;
  if (!conn.refreshToken || conn.refreshExpiresAt < Date.now()) throw expired('Pinterest');
  const { body: t } = await refreshed('Pinterest', call('Pinterest', `${PIN}/oauth/token`, { method: 'POST', headers: { authorization: pinBasic() }, body: form({ grant_type: 'refresh_token', refresh_token: conn.refreshToken }) }));
  Object.assign(conn, pinTokens(t)); return conn.token;
}
// while the app only has Trial access, Pinterest takes Pins only in its sandbox, with a token from the app's Configure page:
// PINTEREST_SANDBOX_TOKEN sends boards and Pins there (only the app's owner can see them); signing in still uses the real account
const pinSandbox = (path) => !!process.env.PINTEREST_SANDBOX_TOKEN && /^\/(boards|pins)\b/.test(path);
const pin = async (conn, method, path, body) => {
  const [base, token] = pinSandbox(path) ? ['https://api-sandbox.pinterest.com/v5', process.env.PINTEREST_SANDBOX_TOKEN] : [PIN, await pinToken(conn)];
  return (await call('Pinterest', `${base}${path}`, body ? json(method, body, bearer(token)) : { method, headers: bearer(token) })).body;
};
const pinBoards = async (conn) => ((await pin(conn, 'GET', '/boards?page_size=100')).items || []).map((b) => ({ id: b.id, label: b.name }));
// Pinterest only takes a public web address: "yourbusiness.com" gets https://, and a local address (while developing) is left off
const pinLink = (u) => { try { const x = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`); return /\./.test(x.hostname) && !/(^|\.)localhost$/.test(x.hostname) ? x.href : ''; } catch (e) { return ''; } };
const pinterest = {
  name: 'Pinterest', limits: { text: 500, photos: 1, needsPhoto: true },
  startUrl: (state) => 'https://www.pinterest.com/oauth/?' + form({ client_id: app('pinterest').id, redirect_uri: social.redirectUri('pinterest'), response_type: 'code', scope: 'boards:read,boards:write,pins:read,pins:write,user_accounts:read', state }),
  async connect(code) {
    const { body: t } = await call('Pinterest', `${PIN}/oauth/token`, { method: 'POST', headers: { authorization: pinBasic() }, body: form({ grant_type: 'authorization_code', code, redirect_uri: social.redirectUri('pinterest') }) });
    const conn = { ...pinTokens(t), connectedAt: new Date().toISOString() };
    const me = await pin(conn, 'GET', '/user_account'); const boards = await pinBoards(conn);
    if (!boards.length) throw err('That Pinterest account has no boards yet. Make a board on Pinterest, then connect again.');
    return Object.assign(conn, { username: me.username || '', board: boards[0].id, name: boards[0].label, choices: boards.length });
  },
  async choices(conn) { return (await pinBoards(conn)).map((b) => ({ id: b.id, label: b.label, sub: '', current: b.id === conn.board })); },
  async choose(conn, id) { const boards = await pinBoards(conn); const b = boards.find((x) => x.id === id); if (!b) throw err('Choose one of your boards'); Object.assign(conn, { board: b.id, name: b.label, choices: boards.length }); },
  // the first photo (sent with the Pin, so Pinterest doesn't have to fetch it), the caption as the description (its first line, shortened, as the title) and a link to the business
  async post(conn, { caption, images, jpegs = [], link }) {
    if (!images.length) throw err('Pinterest Pins need a photo');
    const title = (caption.split('\n')[0] || '').slice(0, 100);
    link = pinLink(link);
    const r = await pin(conn, 'POST', '/pins', { board_id: conn.board, title, description: caption, ...(link ? { link } : {}), media_source: jpegs[0] ? { source_type: 'image_base64', content_type: 'image/jpeg', data: jpegs[0].toString('base64') } : { source_type: 'image_url', url: images[0] } });
    return { url: `https://www.pinterest.com/pin/${r.id}/` };
  },
};

/* ---------- Instagram: a photo or a carousel, with Instagram Login (Instagram API with Instagram Login; no Facebook account or Page needed) ----------
   The account must be an Instagram professional account (Business or Creator). Instagram fetches the photos from their public address. */
const IG = 'https://graph.instagram.com';
const IG_V = 'v21.0';
async function igToken(conn) {
  if (!conn.userId) throw expired('Instagram'); // connected the old way, through Facebook
  // long-lived tokens last 60 days; refresh in the last week (Instagram allows it once a token is a day old)
  if (conn.expiresAt - Date.now() < 7 * 864e5 && conn.expiresAt > Date.now()) {
    const t = await call('Instagram', `${IG}/refresh_access_token?` + form({ grant_type: 'ig_refresh_token', access_token: conn.token })).then((x) => x.body).catch(() => null);
    if (t && t.access_token) Object.assign(conn, { token: t.access_token, expiresAt: soon(((t.expires_in || 5184000) - 300) * 1000) });
  }
  if (conn.expiresAt <= Date.now()) throw expired('Instagram');
  return conn.token;
}
const igPost = async (conn, path, params) => (await call('Instagram', `${IG}/${IG_V}/${path}`, { method: 'POST', body: form({ ...params, access_token: await igToken(conn) }) })).body;
const igGet = async (conn, path, params) => (await call('Instagram', `${IG}/${IG_V}/${path}?` + form({ ...params, access_token: await igToken(conn) }))).body;
async function igReady(conn, id) { // Instagram processes the photos first; publishing too soon fails
  for (let i = 0; i < 15; i++) {
    const s = await igGet(conn, id, { fields: 'status_code' });
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw err('Instagram couldn’t use those photos. Try JPEG photos under 8 MB.');
    await wait(2000);
  }
}
const instagram = {
  name: 'Instagram', limits: { text: 2200, photos: 10, needsPhoto: true },
  startUrl: (state) => 'https://www.instagram.com/oauth/authorize?' + form({ client_id: app('instagram').id, redirect_uri: social.redirectUri('instagram'), response_type: 'code', scope: 'instagram_business_basic,instagram_business_content_publish', state }),
  async connect(code) {
    const a = app('instagram');
    const { body: r } = await call('Instagram', 'https://api.instagram.com/oauth/access_token', { method: 'POST', body: form({ client_id: a.id, client_secret: a.secret, grant_type: 'authorization_code', redirect_uri: social.redirectUri('instagram'), code }) });
    const s = (r.data && r.data[0]) || r; // older answers wrap it in data: [ … ]
    const perms = Array.isArray(s.permissions) ? s.permissions : String(s.permissions || '').split(',');
    if (s.permissions && !perms.includes('instagram_business_content_publish')) throw err('Instagram didn’t allow posting. Connect again and keep every permission switched on.');
    const { body: l } = await call('Instagram', `${IG}/access_token?` + form({ grant_type: 'ig_exchange_token', client_secret: a.secret, access_token: s.access_token }));
    const conn = { token: l.access_token, expiresAt: soon(((l.expires_in || 5184000) - 300) * 1000), connectedAt: new Date().toISOString(), userId: String(s.user_id || '') };
    const me = await igGet(conn, 'me', { fields: 'user_id,username,account_type' });
    if (me.account_type === 'PERSONAL') throw err('That’s a personal Instagram account. In Instagram, switch it to a Business or Creator account (Settings → Account type and tools), then connect again.');
    return Object.assign(conn, { userId: String(me.user_id || conn.userId), username: me.username || '', link: me.username ? `https://www.instagram.com/${me.username}` : '' });
  },
  async post(conn, { caption, images }) {
    if (!images.length) throw err('Instagram posts need at least one photo');
    let id;
    if (images.length === 1) id = (await igPost(conn, `${conn.userId}/media`, { image_url: images[0], caption })).id;
    else {
      const kids = []; for (const url of images.slice(0, 10)) kids.push((await igPost(conn, `${conn.userId}/media`, { image_url: url, is_carousel_item: 'true' })).id);
      for (const k of kids) await igReady(conn, k);
      id = (await igPost(conn, `${conn.userId}/media`, { media_type: 'CAROUSEL', children: kids.join(','), caption })).id;
    }
    await igReady(conn, id);
    const r = await igPost(conn, `${conn.userId}/media_publish`, { creation_id: id });
    const m = await igGet(conn, r.id, { fields: 'permalink' }).catch(() => ({}));
    return { url: m.permalink || `https://www.instagram.com/${conn.username}` };
  },
};

/* ---------- Threads: text, a photo or a carousel (Threads API, its own Meta app ID) ---------- */
const TH = 'https://graph.threads.net';
async function thToken(conn) {
  // long-lived tokens last 60 days; refresh in the last week (Threads allows it once a token is a day old)
  if (conn.expiresAt - Date.now() < 7 * 864e5 && conn.expiresAt > Date.now()) {
    const t = await call('Threads', `${TH}/refresh_access_token?` + form({ grant_type: 'th_refresh_token', access_token: conn.token })).then((x) => x.body).catch(() => null);
    if (t && t.access_token) Object.assign(conn, { token: t.access_token, expiresAt: soon(((t.expires_in || 5184000) - 300) * 1000) });
  }
  if (conn.expiresAt <= Date.now()) throw expired('Threads');
  return conn.token;
}
const thPost = async (conn, path, params) => (await call('Threads', `${TH}/v1.0/${path}`, { method: 'POST', body: form({ ...params, access_token: await thToken(conn) }) })).body;
const thGet = async (conn, path, params) => (await call('Threads', `${TH}/v1.0/${path}?` + form({ ...params, access_token: await thToken(conn) }))).body;
async function thReady(conn, id) { // Threads processes the media first; publishing too soon fails
  for (let i = 0; i < 15; i++) {
    const s = await thGet(conn, id, { fields: 'status,error_message' });
    if (s.status === 'FINISHED') return;
    if (s.status === 'ERROR' || s.status === 'EXPIRED') throw err(`Threads couldn’t use those photos${s.error_message ? ` (${s.error_message})` : ''}`);
    await wait(2000);
  }
}
const threads = {
  name: 'Threads', limits: { text: 500, photos: 20 },
  startUrl: (state) => 'https://threads.net/oauth/authorize?' + form({ client_id: app('threads').id, redirect_uri: social.redirectUri('threads'), scope: 'threads_basic,threads_content_publish', response_type: 'code', state }),
  async connect(code) {
    const a = app('threads');
    const { body: s } = await call('Threads', `${TH}/oauth/access_token`, { method: 'POST', body: form({ client_id: a.id, client_secret: a.secret, grant_type: 'authorization_code', redirect_uri: social.redirectUri('threads'), code }) });
    const { body: l } = await call('Threads', `${TH}/access_token?` + form({ grant_type: 'th_exchange_token', client_secret: a.secret, access_token: s.access_token }));
    const conn = { token: l.access_token, expiresAt: soon(((l.expires_in || 5184000) - 300) * 1000), connectedAt: new Date().toISOString() };
    const me = await thGet(conn, 'me', { fields: 'id,username' });
    return Object.assign(conn, { userId: me.id || String(s.user_id), username: me.username || '' });
  },
  async post(conn, { caption, images }) {
    let id;
    if (!images.length) id = (await thPost(conn, `${conn.userId}/threads`, { media_type: 'TEXT', text: caption })).id;
    else if (images.length === 1) id = (await thPost(conn, `${conn.userId}/threads`, { media_type: 'IMAGE', image_url: images[0], text: caption })).id;
    else {
      const kids = []; for (const url of images.slice(0, 20)) kids.push((await thPost(conn, `${conn.userId}/threads`, { media_type: 'IMAGE', image_url: url, is_carousel_item: 'true' })).id);
      for (const k of kids) await thReady(conn, k);
      id = (await thPost(conn, `${conn.userId}/threads`, { media_type: 'CAROUSEL', children: kids.join(','), text: caption })).id;
    }
    await thReady(conn, id);
    const r = await thPost(conn, `${conn.userId}/threads_publish`, { creation_id: id });
    const m = await thGet(conn, r.id, { fields: 'permalink' }).catch(() => ({}));
    return { url: m.permalink || `https://www.threads.net/@${conn.username}` };
  },
};

/* ---------- TikTok: a photo post on the business's own account (Content Posting API, Direct Post) ----------
   The platform's own TikTok account (Alpha → Social) is lib/tiktok.js; this uses the same TikTok app. TikTok downloads the photos from
   the business's <slug>.<root domain> address, so the root domain must be verified in the TikTok app. Until TikTok audits the app,
   posts can only be private ("Only me"). */
const TT = 'https://open.tiktokapis.com/v2';
// TikTok's token endpoints answer "The request parameters are malformed" to the ";charset=UTF-8" fetch adds to a URLSearchParams body, so send the plain type
const ttForm = (o) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form(o).toString() });
const ttTokens = (t) => ({ token: t.access_token, expiresAt: soon(((t.expires_in || 86400) - 300) * 1000), refreshToken: t.refresh_token, refreshExpiresAt: soon(((t.refresh_expires_in || 31536000) - 300) * 1000), openId: t.open_id });
async function ttToken(conn) {
  if (conn.expiresAt > Date.now()) return conn.token;
  if (!conn.refreshToken || conn.refreshExpiresAt < Date.now()) throw expired('TikTok');
  const a = app('tiktok');
  const { body: t } = await refreshed('TikTok', call('TikTok', `${TT}/oauth/token/`, ttForm({ client_key: a.id, client_secret: a.secret, grant_type: 'refresh_token', refresh_token: conn.refreshToken })));
  Object.assign(conn, ttTokens(t)); return conn.token;
}
const tt = async (conn, path, body) => (await call('TikTok', `${TT}${path}`, json('POST', body || {}, bearer(await ttToken(conn), { 'content-type': 'application/json; charset=UTF-8' })))).body.data || {};
const TT_PRIVACY = { PUBLIC_TO_EVERYONE: 'Everyone', MUTUAL_FOLLOW_FRIENDS: 'Friends', FOLLOWER_OF_CREATOR: 'Followers', SELF_ONLY: 'Only me' };
const tiktok = {
  name: 'TikTok', limits: { text: 4000, photos: 10, needsPhoto: true },
  startUrl: (state) => 'https://www.tiktok.com/v2/auth/authorize/?' + form({ client_key: app('tiktok').id, scope: 'user.info.basic,video.publish', response_type: 'code', redirect_uri: social.redirectUri('tiktok'), state }),
  async connect(code) {
    const a = app('tiktok');
    const { body: t } = await call('TikTok', `${TT}/oauth/token/`, ttForm({ client_key: a.id, client_secret: a.secret, code, grant_type: 'authorization_code', redirect_uri: social.redirectUri('tiktok') }));
    const conn = { ...ttTokens(t), connectedAt: new Date().toISOString() };
    const { body: u } = await call('TikTok', `${TT}/user/info/?fields=open_id,display_name`, { headers: bearer(conn.token) });
    return Object.assign(conn, { name: (u.data && u.data.user && u.data.user.display_name) || 'TikTok account' });
  },
  // what TikTok lets this account post right now (asked before each post, as TikTok requires): who can see it, and whether comments can be on
  async creator(conn) {
    const d = await tt(conn, '/post/publish/creator_info/query/');
    if (d.creator_username) conn.username = d.creator_username;
    return { nickname: d.creator_nickname || conn.name, username: d.creator_username || '', privacy: (d.privacy_level_options || []).map((k) => ({ id: k, label: TT_PRIVACY[k] || k })), commentsOff: !!d.comment_disabled };
  },
  // options: { privacy, comments, brand } chosen in the post form
  async post(conn, { caption, images, options = {} }) {
    if (!images.length) throw err('TikTok posts need at least one photo');
    const c = await tiktok.creator(conn);
    if (!options.privacy) throw err('Choose who can see the TikTok post');
    if (!c.privacy.some((p) => p.id === options.privacy)) throw err(`TikTok only lets this account post to: ${c.privacy.map((p) => p.label).join(', ') || 'no one yet'}. Choose one of those.`);
    const title = (caption.split('\n')[0] || '').slice(0, 90);
    const d = await tt(conn, '/post/publish/content/init/', {
      post_info: { title, description: caption, privacy_level: options.privacy, disable_comment: c.commentsOff || !options.comments, auto_add_music: true, brand_organic_toggle: !!options.brand },
      source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: images.slice(0, 35) }, post_mode: 'DIRECT_POST', media_type: 'PHOTO',
    });
    // TikTok finishes the post on its own; there's no link to it until then, so link the profile
    return { url: c.username ? `https://www.tiktok.com/@${c.username}` : 'https://www.tiktok.com/', publishId: d.publish_id };
  },
  async revoke(conn) { const a = app('tiktok'); await call('TikTok', `${TT}/oauth/revoke/`, ttForm({ client_key: a.id, client_secret: a.secret, token: conn.token })).catch(() => {}); },
};

/* ---------- YouTube: a video uploaded to the business's channel (YouTube Data API v3) ----------
   Signs in with the platform's Google app (Alpha → Settings → Integrations → Google), so its redirect URI is Google's. The Google Cloud
   project needs the YouTube Data API v3 turned on. Until Google audits the project for the API, every upload is locked to private. */
const YT = 'https://www.googleapis.com/youtube/v3';
async function ytToken(conn) {
  if (conn.expiresAt > Date.now()) return conn.token;
  const a = app('youtube');
  const { body: t } = await call('YouTube', 'https://oauth2.googleapis.com/token', { method: 'POST', body: form({ client_id: a.id, client_secret: a.secret, refresh_token: conn.refreshToken, grant_type: 'refresh_token' }) })
    .catch((e) => { throw (e.status && e.status < 500) || /invalid_grant|expired|revoked/i.test(e.message) ? expired('YouTube') : e; });
  Object.assign(conn, { token: t.access_token, expiresAt: soon(((t.expires_in || 3600) - 120) * 1000) }); return conn.token;
}
const ytChannel = async (conn) => ((await call('YouTube', `${YT}/channels?part=snippet&mine=true`, { headers: bearer(await ytToken(conn)) })).body.items || [])[0];
const YT_PRIVACY = { public: 'Public', unlisted: 'Unlisted', private: 'Private' };
const VIDEO_TYPES = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
// YouTube turns down titles and descriptions with < or >
const ytText = (s, max) => s.replace(/[<>]/g, '').slice(0, max).trim();
const youtube = {
  name: 'YouTube', limits: { text: 5000, photos: 0, needsVideo: true },
  startUrl: (state) => 'https://accounts.google.com/o/oauth2/v2/auth?' + form({ client_id: app('youtube').id, redirect_uri: social.redirectUri('google'), response_type: 'code', access_type: 'offline', prompt: 'consent', state,
    scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly' }),
  async connect(code) {
    const a = app('youtube');
    const { body: t } = await call('YouTube', 'https://oauth2.googleapis.com/token', { method: 'POST', body: form({ code, client_id: a.id, client_secret: a.secret, redirect_uri: social.redirectUri('google'), grant_type: 'authorization_code' }) });
    if (!t.refresh_token) throw err('Google didn’t allow ongoing access. Try connecting again.');
    const conn = { token: t.access_token, expiresAt: soon(((t.expires_in || 3600) - 120) * 1000), refreshToken: t.refresh_token, connectedAt: new Date().toISOString() };
    const ch = await ytChannel(conn);
    if (!ch) throw err('That Google account doesn’t have a YouTube channel yet. Create one on YouTube, then connect again.');
    const handle = String(ch.snippet.customUrl || '').replace(/^@/, '');
    return Object.assign(conn, { channelId: ch.id, name: ch.snippet.title || 'YouTube channel', username: handle, link: handle ? `https://www.youtube.com/@${handle}` : `https://www.youtube.com/channel/${ch.id}` });
  },
  // video: { file, size, ext } saved on the server; options: { title, privacy, kids } chosen in the post form
  async post(conn, { caption, video, options = {} }) {
    if (!video) throw err('YouTube posts need a video');
    if (!YT_PRIVACY[options.privacy]) throw err('Choose who can see the YouTube video');
    const title = ytText(options.title || caption.split('\n')[0] || '', 100) || 'New video';
    const meta = { snippet: { title, description: ytText(caption, 5000), categoryId: '22' }, status: { privacyStatus: options.privacy, selfDeclaredMadeForKids: !!options.kids } };
    const { headers } = await call('YouTube', 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      json('POST', meta, bearer(await ytToken(conn), { 'x-upload-content-type': VIDEO_TYPES[video.ext], 'x-upload-content-length': String(video.size) })));
    const at = headers.get('location'); if (!at) throw err('YouTube didn’t start the upload. Try again.', 502);
    // the video itself, streamed from disk; a long one can take several minutes
    let r; try { r = await fetch(at, { method: 'PUT', headers: { 'content-type': VIDEO_TYPES[video.ext], 'content-length': String(video.size) }, body: fs.createReadStream(video.file), duplex: 'half', signal: AbortSignal.timeout(30 * 60e3) }); }
    catch (e) { throw err('The video didn’t finish uploading to YouTube. Try again.', 502); }
    const v = await r.json().catch(() => ({}));
    if (!r.ok || !v.id) throw err(`YouTube: ${(v.error && v.error.message) || `the upload failed (${r.status})`}`, r.status >= 500 ? 502 : 400);
    return { url: `https://www.youtube.com/watch?v=${v.id}` };
  },
  async revoke(conn) { await call('YouTube', 'https://oauth2.googleapis.com/revoke', { method: 'POST', body: form({ token: conn.refreshToken }) }).catch(() => {}); },
};

const NETWORKS = { instagram, linkedin, pinterest, threads, tiktok, youtube };
const has = (kind) => Object.prototype.hasOwnProperty.call(NETWORKS, kind);
// the sign-in link for a business (tenantId) and its person (userId); back: the page to return to
const startUrl = (kind, tenantId, userId, back) => NETWORKS[kind].startUrl(social.sign({ k: kind, t: tenantId, u: userId, n: crypto.randomBytes(6).toString('hex'), exp: Date.now() + 15 * 60e3, ...(back ? { b: back } : {}) }));

module.exports = { NETWORKS, has, startUrl, liText, TT_PRIVACY, YT_PRIVACY, VIDEO_TYPES };
