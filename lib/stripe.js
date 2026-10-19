// Small Stripe REST helper shared by the account app (client card payments) and the platform (plan billing, Stripe Connect).
const crypto = require('crypto');

// YOUR Stripe account: plan subscriptions at sign-up, and the platform behind every business's "Connect with Stripe"
const platformKey = () => process.env.BILLING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
const modeOf = (key) => (/^(sk|rk)_live_/.test(key || '') ? 'live' : 'test');

// account: a connected account id (acct_…) to act on its behalf with the platform key ("Stripe-Account" header)
async function request(key, method, endpoint, params, account) {
  const r = await fetch('https://api.stripe.com/v1/' + endpoint, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(account ? { 'Stripe-Account': account } : {}), ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || `Stripe error ${r.status}`);
  return j;
}

// webhooks: Stripe signs the raw body ("Stripe-Signature: t=…,v1=…")
function signatureOk(raw, header, secret) {
  const parts = Object.fromEntries(String(header || '').split(',').map((kv) => kv.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v]));
  const sigs = String(header || '').split(',').filter((kv) => kv.trim().startsWith('v1=')).map((kv) => kv.trim().slice(3));
  if (!parts.t || !sigs.length || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex'));
  return sigs.some((s) => { const b = Buffer.from(s); return b.length === expected.length && crypto.timingSafeEqual(b, expected); });
}

module.exports = { platformKey, modeOf, request, signatureOk };
