// Support access: the platform console asks one of an account's logins (any access level) for access, that person grants it
// for four weeks and can revoke it any time (so can the account owner). While it's granted, the console makes one-time
// sign-in links that open a support session as that person, with their access level.
// Requests and links live on the account's record in platform.json (t.supportAccess, t.supportLinks).
const crypto = require('crypto');
const tenancy = require('./tenancy');

const GRANT_DAYS = 28; // four weeks
const LINK_MINUTES = 2; // a sign-in link is used straight away
const SESSION_HOURS = 8; // a support session lasts a working day at most (and never past the grant)
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const nowIso = () => new Date().toISOString();

// requests from before they were made to one login belonged to the owner: server.js tells us who that is
let ownerOf = () => null;
const setOwnerLookup = (fn) => { ownerOf = fn; };
const list = (t) => (t.supportAccess = t.supportAccess || []);
// grants past their end date become "expired" the next time anyone looks
function requests(t) {
  const now = nowIso(); let changed = false;
  for (const r of list(t)) {
    if (r.status === 'granted' && r.expiresAt <= now) { r.status = 'expired'; r.endedAt = r.expiresAt; changed = true; }
    if (!r.userId) { const o = ownerOf(t); if (o) { r.userId = o.id; r.userName = o.name; changed = true; } }
  }
  if (changed) tenancy.savePlatform();
  return list(t);
}
const isOpen = (r) => r.status === 'pending' || r.status === 'granted';
const pending = (t, userId) => requests(t).find((r) => r.status === 'pending' && r.userId === userId) || null;
const active = (t, userId) => requests(t).find((r) => r.status === 'granted' && r.userId === userId) || null;
const open = (t) => requests(t).filter(isOpen);
const summary = (t) => open(t).map((r) => ({ id: r.id, status: r.status, userId: r.userId, userName: r.userName, adminName: r.adminName, requestedAt: r.requestedAt, expiresAt: r.expiresAt || null }));

function request(t, admin, user, reason) {
  if (pending(t, user.id)) throw new Error(`There’s already a request waiting for ${user.name}`);
  if (active(t, user.id)) throw new Error(`${user.name} has already granted support access`);
  const r = { id: crypto.randomBytes(6).toString('hex'), userId: user.id, userName: user.name, adminId: admin.id, adminName: admin.name, adminEmail: admin.email, reason: String(reason || '').trim().slice(0, 500), requestedAt: nowIso(), status: 'pending' };
  list(t).unshift(r); t.supportAccess.length = Math.min(t.supportAccess.length, 200); tenancy.savePlatform();
  return r;
}
// the answer of the person asked: grant (four weeks from now) or decline
function answer(t, id, user, grant) {
  const theirs = requests(t).find((x) => x.id === id && x.status === 'pending' && x.userId !== user.id);
  if (theirs) throw new Error(`Only ${theirs.userName} can answer this request`);
  const r = pending(t, user.id); if (!r || r.id !== id) throw new Error('This request is no longer waiting for your answer');
  Object.assign(r, grant ? { status: 'granted', grantedAt: nowIso(), grantedBy: user.name, expiresAt: new Date(Date.now() + GRANT_DAYS * 864e5).toISOString() }
    : { status: 'declined', endedAt: nowIso(), endedBy: user.name });
  tenancy.savePlatform(); return r;
}
// ends a grant (revoked) or withdraws a request (cancelled); `by` is who did it
function end(t, id, by) {
  const r = requests(t).find((x) => x.id === id && isOpen(x)); if (!r) throw new Error('There’s no open request or grant to end');
  Object.assign(r, { status: r.status === 'granted' ? 'revoked' : 'cancelled', endedAt: nowIso(), endedBy: by });
  for (const [k, x] of Object.entries(t.supportLinks || {})) if (x.requestId === r.id) delete t.supportLinks[k];
  tenancy.savePlatform(); return r;
}
const grantById = (t, id) => requests(t).find((r) => r.id === id && r.status === 'granted') || null;
function loginLink(t, admin, requestId) {
  const r = grantById(t, requestId); if (!r) throw new Error('This person hasn’t granted support access, or it has ended');
  const tok = crypto.randomBytes(32).toString('hex'); const now = Date.now();
  t.supportLinks = Object.fromEntries(Object.entries(t.supportLinks || {}).filter(([, x]) => x.expires > now));
  t.supportLinks[sha(tok)] = { requestId: r.id, adminId: admin.id, adminName: admin.name, expires: now + LINK_MINUTES * 60e3 };
  tenancy.savePlatform();
  return `${tenancy.tenantUrl(t)}/support-login?token=${tok}`;
}
// a sign-in link works once, within a few minutes, while its grant is still in force
function redeem(t, tok) {
  const k = sha(tok || ''); const x = (t.supportLinks || {})[k]; if (!x) return null;
  delete t.supportLinks[k];
  const r = grantById(t, x.requestId);
  if (x.expires < Date.now() || !r) { tenancy.savePlatform(); return null; }
  r.lastUsedAt = nowIso(); r.uses = (r.uses || 0) + 1; tenancy.savePlatform();
  return { requestId: r.id, userId: r.userId, adminName: x.adminName, expires: Math.min(Date.parse(r.expiresAt), Date.now() + SESSION_HOURS * 3600e3) };
}
// a support session only lasts while its grant does
const sessionOk = (t, s) => !!(s && grantById(t, s.requestId));

module.exports = { GRANT_DAYS, setOwnerLookup, requests, isOpen, pending, active, open, summary, request, answer, end, loginLink, redeem, sessionOk };
