// Small Stripe REST helper shared by the account app (client card payments) and the platform (plan billing, Stripe Connect).
const crypto = require('crypto');

// YOUR Stripe account: plan subscriptions at sign-up, and the platform behind every business's "Connect with Stripe"
const platformKey = () => process.env.BILLING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
const modeOf = (key) => (/^(sk|rk)_live_/.test(key || '') ? 'live' : 'test');

// account: a connected account id (acct_…) to act on its behalf with the platform key ("Stripe-Account" header)
async function request(key, method, endpoint, params, account) {
  const r = await fetch('https://api.stripe.com/v1/' + endpoint, {
    method, signal: AbortSignal.timeout(8000), // a slow Stripe never holds a page for long
    headers: { Authorization: `Bearer ${key}`, ...(account ? { 'Stripe-Account': account } : {}), ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: params ? new URLSearchParams(params) : undefined,
  }).catch((e) => { throw new Error(e.name === 'TimeoutError' ? 'Stripe took too long to answer. Try again in a moment.' : `Couldn’t reach Stripe (${e.message})`); });
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

// Plan prices: p.monthly and p.yearly (dollars, either may be empty); p.priceLabel is shown when neither is set ("Free", "Contact us").
// Plans saved before monthly/yearly existed only have the text p.price ("$29/month", "$290 per year").
function parsePriceText(text) {
  const m = String(text || '').match(/\$\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(?:(?:\/|per|a)\s*(mo|month|yr|year|annum))?/i);
  if (!m) return null;
  const cents = Math.round(Number(m[1].replace(/,/g, '')) * 100); if (!cents) return null;
  return { cents, interval: /^(yr|year|annum)$/i.test(m[2] || '') ? 'year' : 'month' };
}
const centsOf = (v) => (Number(v) > 0 ? Math.round(Number(v) * 100) : 0);
// what a plan costs for a billing period ('month' or 'year'); falls back to the period the plan offers. null = free.
function planCharge(p, interval) {
  if (!p) return null;
  if (!('monthly' in p) && !('yearly' in p)) return parsePriceText(p.price);
  const m = centsOf(p.monthly); const y = centsOf(p.yearly);
  if (interval === 'year' && y) return { cents: y, interval: 'year' };
  if (interval === 'month' && m) return { cents: m, interval: 'month' };
  return m ? { cents: m, interval: 'month' } : y ? { cents: y, interval: 'year' } : null;
}
const dollars = (cents) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
// the price as text, for lists and emails: "$59/month or $590/year"
function planPriceText(p) {
  const m = centsOf(p.monthly); const y = centsOf(p.yearly);
  return [m && `${dollars(m)}/month`, y && `${dollars(y)}/year`].filter(Boolean).join(' or ') || String(p.priceLabel || '').trim() || 'Free';
}

module.exports = { platformKey, modeOf, request, signatureOk, planCharge, planPriceText, parsePriceText };
