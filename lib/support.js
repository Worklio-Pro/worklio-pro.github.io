// Support access: the platform console asks to get into an account, the account owner grants it for four weeks
// and can revoke it any time. While it's granted, the console makes one-time sign-in links that open a support session.
// Requests and links live on the account's record in platform.json (t.supportAccess, t.supportLinks).
const crypto = require('crypto');
const tenancy = require('./tenancy');

const GRANT_DAYS = 28; // four weeks
const LINK_MINUTES = 2; // a sign-in link is used straight away
const SESSION_HOURS = 8; // a support session lasts a working day at most (and never past the grant)
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const nowIso = () => new Date().toISOString();

const list = (t) => (t.supportAccess = t.supportAccess || []);
// grants past their end date become "expired" the next time anyone looks
function requests(t) {
  const now = nowIso(); let changed = false;
  for (const r of list(t)) if (r.status === 'granted' && r.expiresAt <= now) { r.status = 'expired'; r.endedAt = r.expiresAt; changed = true; }
  if (changed) tenancy.savePlatform();
  return list(t);
}
const pending = (t) => requests(t).find((r) => r.status === 'pending') || null;
const active = (t) => requests(t).find((r) => r.status === 'granted') || null;
const summary = (t) => { const r = pending(t) || active(t); return r ? { id: r.id, status: r.status, adminName: r.adminName, requestedAt: r.requestedAt, expiresAt: r.expiresAt || null } : null; };

function request(t, admin, reason) {
  if (pending(t)) throw new Error('There’s already a request waiting for the owner');
  if (active(t)) throw new Error('This account has already granted support access');
  const r = { id: crypto.randomBytes(6).toString('hex'), adminId: admin.id, adminName: admin.name, adminEmail: admin.email, reason: String(reason || '').trim().slice(0, 500), requestedAt: nowIso(), status: 'pending' };
  list(t).unshift(r); t.supportAccess.length = Math.min(t.supportAccess.length, 50); tenancy.savePlatform();
  return r;
}
// the owner's answer: grant (four weeks from now) or decline
function answer(t, id, user, grant) {
  const r = pending(t); if (!r || r.id !== id) throw new Error('This request is no longer waiting for an answer');
  Object.assign(r, grant ? { status: 'granted', grantedAt: nowIso(), grantedBy: user.name, expiresAt: new Date(Date.now() + GRANT_DAYS * 864e5).toISOString() }
    : { status: 'declined', endedAt: nowIso(), endedBy: user.name });
  tenancy.savePlatform(); return r;
}
// ends a grant (revoked) or withdraws a request (cancelled); `by` is who did it
function end(t, id, by) {
  const r = requests(t).find((x) => x.id === id && (x.status === 'granted' || x.status === 'pending')); if (!r) throw new Error('There’s no open request or grant to end');
  Object.assign(r, { status: r.status === 'granted' ? 'revoked' : 'cancelled', endedAt: nowIso(), endedBy: by });
  for (const [k, x] of Object.entries(t.supportLinks || {})) if (x.requestId === r.id) delete t.supportLinks[k];
  tenancy.savePlatform(); return r;
}
function loginLink(t, admin) {
  const r = active(t); if (!r) throw new Error('The account owner hasn’t granted support access');
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
  const r = active(t);
  if (x.expires < Date.now() || !r || r.id !== x.requestId) { tenancy.savePlatform(); return null; }
  r.lastUsedAt = nowIso(); r.uses = (r.uses || 0) + 1; tenancy.savePlatform();
  return { requestId: r.id, adminName: x.adminName, expires: Math.min(Date.parse(r.expiresAt), Date.now() + SESSION_HOURS * 3600e3) };
}
// a support session only lasts while its grant does
const sessionOk = (t, s) => { const r = active(t); return !!(r && s && r.id === s.requestId); };

module.exports = { GRANT_DAYS, requests, pending, active, summary, request, answer, end, loginLink, redeem, sessionOk };
