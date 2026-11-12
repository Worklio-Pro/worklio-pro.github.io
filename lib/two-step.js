// Two-step login for Alpha: a 6-digit code from an authenticator app (TOTP, RFC 6238: 30-second codes, SHA-1),
// or one of 10 one-time backup codes. No library needed.
// On an Alpha login: a.twoStep = { secret (base32), lastStep (the last 30-second step used, so a code works once), backup: [sha256 of each unused code], on }
// While setting it up: a.twoStepPending = { secret, expires }
const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function toBase32(buf) {
  let bits = 0; let val = 0; let out = '';
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function fromBase32(s) {
  let bits = 0; let val = 0; const out = [];
  for (const ch of String(s).replace(/=+$/, '').toUpperCase()) { const i = B32.indexOf(ch); if (i < 0) continue; val = (val << 5) | i; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}

const STEP = 30;
const stepNow = () => Math.floor(Date.now() / 1000 / STEP);
function codeAt(secret, step) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', fromBase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
// the step a code belongs to (this one, or one either side for a phone clock that's a little off), or null
function matchStep(secret, code, after = -1) {
  if (!/^\d{6}$/.test(code)) return null;
  const now = stepNow();
  for (const s of [now, now - 1, now + 1]) if (s > after && same(codeAt(secret, s), code)) return s;
  return null;
}

const newSecret = () => toBase32(crypto.randomBytes(20));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const cleanBackup = (c) => String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// 10 codes like "k7m2-9xqp"; only their hashes are kept
function newBackupCodes() {
  const ABC = 'abcdefghjkmnpqrstuvwxyz23456789';
  const codes = Array.from({ length: 10 }, () => { const r = crypto.randomBytes(8); const s = Array.from(r, (b) => ABC[b % ABC.length]).join(''); return `${s.slice(0, 4)}-${s.slice(4)}`; });
  return { codes, hashes: codes.map((c) => sha(cleanBackup(c))) };
}

const isOn = (a) => !!(a && a.twoStep && a.twoStep.on);
// a code from the app, or a backup code (used up). true when it's right; the login's record is changed, so save after
function verify(a, raw) {
  const t = a.twoStep; if (!t || !t.on) return false;
  const code = String(raw || '').trim();
  const digits = code.replace(/\s/g, '');
  if (/^\d{6}$/.test(digits)) { const s = matchStep(t.secret, digits, t.lastStep ?? -1); if (s === null) return false; t.lastStep = s; return true; }
  const h = sha(cleanBackup(code)); const i = (t.backup || []).findIndex((x) => same(x, h));
  if (i < 0) return false;
  t.backup.splice(i, 1); t.backupUsedAt = new Date().toISOString(); return true;
}
// start (or keep) setting up: the secret the app adds, for 15 minutes
function pending(a) {
  if (!a.twoStepPending || a.twoStepPending.expires < Date.now()) a.twoStepPending = { secret: newSecret(), expires: Date.now() + 15 * 60e3 };
  return a.twoStepPending;
}
// the app's first code proves it was added: two-step login is on, with fresh backup codes (returned once). null when the code is wrong
function confirm(a, raw) {
  const p = a.twoStepPending; if (!p || p.expires < Date.now()) return null;
  const s = matchStep(p.secret, String(raw || '').replace(/\s/g, '')); if (s === null) return null;
  const { codes, hashes } = newBackupCodes();
  a.twoStep = { on: true, secret: p.secret, lastStep: s, backup: hashes, since: new Date().toISOString() }; delete a.twoStepPending;
  return codes;
}
function renewBackup(a) { const { codes, hashes } = newBackupCodes(); a.twoStep.backup = hashes; return codes; }
// what the app scans: otpauth://totp/<issuer>:<email>?secret=…&issuer=…
const uri = (issuer, email, secret) => `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
const view = (a) => ({ on: isOn(a), backupLeft: isOn(a) ? (a.twoStep.backup || []).length : 0, since: isOn(a) ? a.twoStep.since || '' : '' });

module.exports = { isOn, verify, pending, confirm, renewBackup, uri, view, codeAt, stepNow };
