// Web Push (RFC 8030/8291/8292) with Node's own crypto: no dependencies and no outside account. The platform has one VAPID key pair,
// made the first time it's needed and saved in platform.json. Each browser's subscription is saved on its login (users[].pushSubs).
const crypto = require('crypto');
const tenancy = require('./tenancy');

const b64 = (buf) => Buffer.from(buf).toString('base64url');
// the server POSTs to whatever address a browser gives it, so only the browsers' own push services are allowed
const PUSH_HOSTS = /^(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com)$/;

function keys() {
  const P = tenancy.platform();
  if (!P.pushKeys) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pub = publicKey.export({ format: 'jwk' });
    P.pushKeys = { publicKey: b64(Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')])), jwk: privateKey.export({ format: 'jwk' }) };
    tenancy.savePlatform();
  }
  return P.pushKeys;
}
const publicKey = () => keys().publicKey;

// a subscription from the browser, cleaned; null if it isn't a usable one
function cleanSub(s) {
  const k = (s && s.keys) || {}; let url;
  try { url = new URL(String(s && s.endpoint)); } catch (e) { return null; }
  if (url.protocol !== 'https:' || !PUSH_HOSTS.test(url.hostname)) return null;
  if (Buffer.from(String(k.p256dh || ''), 'base64url').length !== 65 || Buffer.from(String(k.auth || ''), 'base64url').length < 16) return null;
  return { endpoint: url.href, keys: { p256dh: String(k.p256dh), auth: String(k.auth) } };
}

// the message, encrypted so only that browser can read it (RFC 8291, aes128gcm)
function encrypt(sub, text) {
  const uaPub = Buffer.from(sub.keys.p256dh, 'base64url'); const auth = Buffer.from(sub.keys.auth, 'base64url');
  const ecdh = crypto.createECDH('prime256v1'); const asPub = ecdh.generateKeys(); const salt = crypto.randomBytes(16);
  const hkdf = (ikm, s, info, n) => Buffer.from(crypto.hkdfSync('sha256', ikm, s, info, n));
  const ikm = hkdf(ecdh.computeSecret(uaPub), auth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16); const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.from(text)), c.update(Buffer.from([2])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, body]);
}

// proves to the push service that the message comes from this server (RFC 8292). Apple refuses a token without a real contact in `sub`.
function vapidHeader(endpoint) {
  const k = keys(); const S = tenancy.platform().settings;
  const contact = S.contactEmail ? `mailto:${S.contactEmail}` : /^https:/.test(tenancy.platformUrl()) ? tenancy.platformUrl() : 'https://workliopro.com';
  const data = `${b64(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))}.${b64(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: contact }))}`;
  const sig = crypto.sign('sha256', Buffer.from(data), { key: crypto.createPrivateKey({ key: k.jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${data}.${b64(sig)}, k=${k.publicKey}`;
}

// send one message; true means this subscription is gone (the browser unsubscribed) and should be forgotten
async function send(sub, message) {
  const r = await fetch(sub.endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15e3),
    headers: { Authorization: vapidHeader(sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400' }, body: encrypt(sub, JSON.stringify(message)) });
  if (!r.ok && r.status !== 404 && r.status !== 410) console.error('push:', r.status, (await r.text().catch(() => '')).slice(0, 200));
  return r.status === 404 || r.status === 410;
}

module.exports = { publicKey, cleanSub, send, encrypt };
