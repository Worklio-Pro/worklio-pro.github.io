// Forum: owners and admins of every business post issues and feature requests, and like, comment and reply.
// It isn't a support queue: it shows what to improve. Managed in Alpha → Help Center → Forum (status, pin, lock, team replies, delete).
// Posts live in platform.json (P().forum.posts); settings in P().settings.forum.
// Everyone in the forum sees a short name (Ann A.) and the business name; Alpha sees the full name, email and account.
const crypto = require('crypto');
const tenancy = require('./tenancy');

const P = () => tenancy.platform();
const save = () => tenancy.savePlatform();
const newId = () => crypto.randomBytes(6).toString('hex');
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const fail = (msg, status = 400) => { throw Object.assign(new Error(msg), { status }); };

const KINDS = { idea: 'Feature request', issue: 'Issue' };
const STATUSES = { open: 'New', review: 'Under review', planned: 'Planned', progress: 'In progress', done: 'Done', declined: 'Not planned' };
const DEFAULTS = { on: true, emailNew: true, emailReplies: true };
const settings = () => ({ ...DEFAULTS, ...(P().settings.forum || {}) });
const posts = () => { const p = P(); p.forum = p.forum || { posts: [] }; return p.forum.posts; };
const find = (id) => posts().find((x) => x.id === id) || fail('That post was deleted', 404);
const findComment = (post, cid) => post.comments.find((c) => c.id === cid) || fail('That comment was deleted', 404);

// set by server.js: email someone, and look up a business login (null when it's gone or no longer an owner/admin)
let hooks = { send: async () => {}, user: () => null, notifyTo: () => '' };
const init = (h) => { hooks = { ...hooks, ...h }; };

// actor: a business login { t: account slug, u: user id, name, email, role, company } or the team { team: true, adminId, name }
const key = (a) => (a.team ? 'team' : `${a.t}|${a.u}`);
const shortName = (name) => { const [first, ...rest] = String(name || '').trim().split(/\s+/); const last = rest.pop(); return last ? `${first} ${last[0].toUpperCase()}.` : first || 'Someone'; };
const authorOf = (a) => (a.team ? { team: true, adminId: a.adminId, name: a.name } : { t: a.t, u: a.u, name: clip(a.name, 80), email: a.email, role: a.role, company: clip(a.company, 120) });
const productName = () => P().settings.productName || 'Worklio Pro';
// what other businesses see
const pubAuthor = (x) => (x.team ? { name: `${productName()} team`, team: true } : { name: shortName(x.name), company: x.company });

// rate limits, per login: 10 posts and 60 comments an hour
const hits = new Map();
function limit(a, kind, max) {
  const k = `${kind}|${key(a)}`; const now = Date.now(); const h = (hits.get(k) || []).filter((x) => now - x < 3600e3);
  if (h.length >= max) fail(kind === 'post' ? 'You’ve posted a lot in the last hour. Try again a little later.' : 'You’ve commented a lot in the last hour. Try again a little later.', 429);
  h.push(now); hits.set(k, h);
}
const mine = (x, a) => !a.team && !x.team && x.t === a.t && x.u === a.u;
const comments = (post) => post.comments.filter((c) => !c.deleted);

function summary(p, a) {
  return { id: p.id, at: p.at, kind: p.kind, title: p.title, excerpt: p.body.slice(0, 220), status: p.status, pinned: !!p.pinned, locked: !!p.locked,
    author: pubAuthor(p.author), mine: mine(p.author, a), likes: p.likes.length, liked: p.likes.includes(key(a)), comments: comments(p).length, lastAt: p.lastAt || p.at };
}
function detail(p, a) {
  return { ...summary(p, a), body: p.body, editedAt: p.editedAt || null, statusAt: p.statusAt || null,
    comments: p.comments.map((c) => ({ id: c.id, at: c.at, parentId: c.parentId || null, deleted: !!c.deleted, body: c.deleted ? '' : c.body, author: c.deleted ? null : pubAuthor(c.author),
      mine: !c.deleted && mine(c.author, a), likes: c.likes.length, liked: c.likes.includes(key(a)), editedAt: c.editedAt || null })) };
}
const meta = () => ({ kinds: KINDS, statuses: STATUSES });
const isOn = () => settings().on;
const closed = () => fail('The forum is closed right now', 404);

/* ===== the business app (owners and admins) ===== */
function list(a) {
  if (!isOn()) closed();
  return { ...meta(), posts: posts().map((p) => summary(p, a)) };
}
function get(id, a) { if (!isOn()) closed(); return { ...meta(), post: detail(find(id), a) }; }
function cleanPost(b) {
  const kind = KINDS[b.kind] ? b.kind : fail('Choose Feature request or Issue');
  const title = clip(b.title, 140); if (title.length < 4) fail('Give your post a short title');
  const body = clip(b.body, 6000); if (body.length < 10) fail('Add a few words about it');
  return { kind, title, body };
}
function create(a, b) {
  if (!isOn()) closed();
  const c = cleanPost(b || {}); limit(a, 'post', 10);
  const now = new Date().toISOString();
  const p = { id: newId(), at: now, ...c, status: 'open', author: authorOf(a), likes: [key(a)], comments: [], lastAt: now }; // you like your own post to start
  posts().unshift(p); save();
  const s = settings(); const to = hooks.notifyTo();
  if (s.emailNew && to) hooks.send('forumPost', to, { name: a.name, business: a.company, kind: KINDS[p.kind], title: p.title, message: p.body, link: `${tenancy.platformUrl()}/alpha#forum` }).catch(() => {});
  return { post: detail(p, a) };
}
function edit(a, id, b) {
  const p = find(id); if (!mine(p.author, a)) fail('You can only edit your own posts', 403); if (p.locked) fail('This post is locked', 403);
  Object.assign(p, cleanPost({ kind: p.kind, title: p.title, body: p.body, ...b }), { editedAt: new Date().toISOString() }); save();
  return { post: detail(p, a) };
}
function remove(a, id) {
  const p = find(id); if (!mine(p.author, a)) fail('You can only delete your own posts', 403);
  P().forum.posts = posts().filter((x) => x !== p); save(); return { ok: true };
}
function like(a, id) {
  if (!isOn()) closed();
  const p = find(id); const k = key(a); p.likes = p.likes.includes(k) ? p.likes.filter((x) => x !== k) : [...p.likes, k]; save();
  return { likes: p.likes.length, liked: p.likes.includes(k) };
}
function likeComment(a, id, cid) {
  if (!isOn()) closed();
  const c = findComment(find(id), cid); if (c.deleted) fail('That comment was deleted', 404);
  const k = key(a); c.likes = c.likes.includes(k) ? c.likes.filter((x) => x !== k) : [...c.likes, k]; save();
  return { likes: c.likes.length, liked: c.likes.includes(k) };
}
// a comment, or a reply to one (replies stay one level deep: a reply to a reply joins the same thread)
function comment(a, id, b) {
  if (!a.team && !isOn()) closed();
  const p = find(id); if (p.locked && !a.team) fail('This post is locked, so it can’t get new comments', 403);
  const body = clip((b || {}).body, 4000); if (!body) fail('Write a comment first');
  let parentId = null;
  if (b.parentId) { const parent = findComment(p, b.parentId); parentId = parent.parentId || parent.id; }
  if (!a.team) limit(a, 'comment', 60);
  const now = new Date().toISOString();
  const c = { id: newId(), at: now, parentId, body, author: authorOf(a), likes: [] };
  p.comments.push(c); p.lastAt = now; save();
  // let the post's author know, and whoever wrote the comment being replied to
  const told = new Set([key(a)]);
  const tell = (who, why) => { if (who.team || told.has(key(who))) return; told.add(key(who)); notify(who, p, why, a, body); };
  if (parentId) tell(findComment(p, parentId).author, 'replied to your comment on');
  tell(p.author, a.team ? 'replied to' : 'commented on');
  return a.team ? { post: adminView(p) } : { post: detail(p, a) };
}
function removeComment(a, id, cid) {
  const p = find(id); const c = findComment(p, cid);
  if (!a.team && !mine(c.author, a)) fail('You can only delete your own comments', 403);
  // a comment with replies leaves a “deleted” line so the replies still make sense
  if (!c.parentId && p.comments.some((x) => x.parentId === c.id && !x.deleted)) Object.assign(c, { deleted: true, body: '', likes: [] });
  else p.comments = p.comments.filter((x) => x !== c && !(x.parentId === c.id));
  save();
  return a.team ? { post: adminView(p) } : { post: detail(p, a) };
}

// emails to a business login about activity on their post or comment (Alpha → Help Center → Forum → Forum settings can turn them off)
const sentRecently = new Map(); // post|login -> time: one email per post per 10 minutes
function notify(who, p, why, from, text) {
  if (!settings().emailReplies) return;
  const k = `${p.id}|${key(who)}`; if (Date.now() - (sentRecently.get(k) || 0) < 600e3) return;
  const u = hooks.user(who.t, who.u); if (!u || !u.email) return; // gone, or no longer an owner or admin
  const t = P().tenants.find((x) => x.slug === who.t); if (!t) return;
  sentRecently.set(k, Date.now());
  const fromName = from.team ? `The ${productName()} team` : `${shortName(from.name)} from ${from.company}`;
  hooks.send('forumActivity', u.email, { name: u.name, title: p.title, what: `${fromName} ${why} your post`, message: text, link: `${tenancy.tenantUrl(t)}/forum?p=${p.id}` }).catch(() => {});
}

/* ===== Alpha ===== */
const fullAuthor = (x) => (x.team ? { team: true, name: x.name } : { name: x.name, email: x.email, role: x.role, company: x.company, account: (() => { const t = P().tenants.find((y) => y.slug === x.t); return t ? tenancy.tenantUrl(t) : ''; })() });
function adminView(p) {
  return { id: p.id, at: p.at, kind: p.kind, title: p.title, body: p.body, status: p.status, statusAt: p.statusAt || null, pinned: !!p.pinned, locked: !!p.locked, editedAt: p.editedAt || null, lastAt: p.lastAt || p.at,
    author: fullAuthor(p.author), likes: p.likes.length, comments: p.comments.map((c) => ({ id: c.id, at: c.at, parentId: c.parentId || null, deleted: !!c.deleted, body: c.body, author: c.deleted ? null : fullAuthor(c.author), likes: c.likes.length })) };
}
const adminList = () => ({ ...meta(), settings: settings(), posts: posts().map(adminView) });
const newCount = () => posts().filter((p) => p.status === 'open').length;
// status, pin, lock, type; a status change can carry a note, posted as a team reply
function adminUpdate(id, b, admin) {
  const p = find(id); b = b || {};
  if (b.kind !== undefined) p.kind = KINDS[b.kind] ? b.kind : fail('Unknown type');
  if (b.pinned !== undefined) p.pinned = !!b.pinned;
  if (b.locked !== undefined) p.locked = !!b.locked;
  let changed = false;
  if (b.status !== undefined && b.status !== p.status) { if (!STATUSES[b.status]) fail('Unknown status'); p.status = b.status; p.statusAt = new Date().toISOString(); changed = true; }
  save();
  const note = clip(b.note, 4000); const team = { team: true, adminId: admin.id, name: admin.name };
  if (note) return comment(team, p.id, { body: changed ? `Status: ${STATUSES[p.status]}\n\n${note}` : note });
  if (changed && p.status !== 'review') notify(p.author, p, `marked “${STATUSES[p.status]}”:`, team, `Status: ${STATUSES[p.status]}`);
  return { post: adminView(p) };
}
function adminRemove(id) { find(id); P().forum.posts = posts().filter((x) => x.id !== id); save(); return adminList(); }
function saveSettings(b) {
  const s = settings(); b = b || {};
  P().settings.forum = { on: b.on !== undefined ? !!b.on : s.on, emailNew: b.emailNew !== undefined ? !!b.emailNew : s.emailNew, emailReplies: b.emailReplies !== undefined ? !!b.emailReplies : s.emailReplies };
  save(); return adminList();
}

module.exports = { init, isOn, list, get, create, edit, remove, like, likeComment, comment, removeComment, adminList, adminView, adminUpdate, adminRemove, saveSettings, newCount, KINDS, STATUSES };
