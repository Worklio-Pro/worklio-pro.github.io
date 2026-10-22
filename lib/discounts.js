// Discount codes for sign-ups (Alpha → Discounts): each code has its discount and the rules for when it can be used.
// A code is entered on the pricing page's sign-up form or at checkout (or arrives in a link: /pricing?code=SPRING20).
// Stripe applies it as a coupon on the subscription, so "first 3 months" and "every payment" renew correctly.
// A free-trial code (type 'trial', e.g. TRIAL26) skips checkout instead: the account opens with no card and pauses after d.trialDays,
// unless the owner adds a card (billing starts when the trial ends) in Account and billing. They can also change plan or cancel there.
const crypto = require('crypto');
const tenancy = require('./tenancy');
const stripe = require('./stripe');

const P = () => tenancy.platform();
const all = () => (P().discounts = P().discounts || []);
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,29}$/;
const normCode = (s) => String(s || '').trim().toUpperCase();
const normEmail = (s) => String(s || '').trim().toLowerCase();
const today = () => new Date().toISOString().slice(0, 10);
const dollars = (cents) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
const niceDate = (s) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fail = (msg, status = 400) => { throw Object.assign(new Error(msg), { status }); };

// ---------- wording ----------
const offText = (d) => (d.type === 'percent' ? `${d.value}% off` : `${dollars(Math.round(d.value * 100))} off`);
const durationText = (d) => (d.duration === 'once' ? 'the first payment' : d.duration === 'forever' ? 'every payment' : `the first ${d.months} month${d.months === 1 ? '' : 's'}`);
const describe = (d) => d.type === 'trial' ? `${d.trialDays}-day free trial, no card needed` : `${offText(d)} ${d.duration === 'forever' ? 'every payment' : durationText(d)}`;
// where a code stands today: active, paused, scheduled, expired or used up
function status(d) {
  if (!d.active) return 'paused';
  if (d.startsAt && today() < d.startsAt) return 'scheduled';
  if (d.endsAt && today() > d.endsAt) return 'expired';
  if (d.maxUses && (d.uses || []).length >= d.maxUses) return 'used up';
  return 'active';
}
function rulesText(d) {
  const plans = (d.plans || []).map((id) => (P().plans.find((p) => p.id === id) || {}).name).filter(Boolean);
  return [plans.length ? `${plans.join(', ')} only` : 'All paid plans', d.interval === 'month' ? 'monthly billing only' : d.interval === 'year' ? 'yearly billing only' : '',
    d.startsAt ? `from ${niceDate(d.startsAt)}` : '', d.endsAt ? `until ${niceDate(d.endsAt)}` : '', d.maxUses ? `${d.maxUses} use${d.maxUses === 1 ? '' : 's'} in total` : '', d.onePerEmail ? 'once per email address' : ''].filter(Boolean);
}

// ---------- checking a code against a sign-up ----------
// ctx: { planId, interval ('month'|'year'), email }. Returns { d } or { error } with a message for the person signing up.
function check(code, ctx) {
  const c = normCode(code); if (!c) return { error: 'Enter a discount code' };
  const d = all().find((x) => x.code === c);
  const st = d ? status(d) : '';
  if (!d || st === 'paused') return { error: `${c} isn’t a valid discount code` };
  if (st === 'scheduled') return { error: `${c} can be used from ${niceDate(d.startsAt)}` };
  if (st === 'expired') return { error: `${c} expired on ${niceDate(d.endsAt)}` };
  if (st === 'used up') return { error: `${c} has been used the maximum number of times` };
  const plan = P().plans.find((p) => p.id === ctx.planId);
  if (!plan || !stripe.planCharge(plan, ctx.interval)) return { error: 'Discount codes apply to paid plans' };
  if ((d.plans || []).length && !d.plans.includes(plan.id)) { const names = d.plans.map((id) => (P().plans.find((p) => p.id === id) || {}).name).filter(Boolean); return { error: `${c} works with ${names.join(' or ') || 'other plans'}, not ${plan.name}` }; }
  const charge = stripe.planCharge(plan, ctx.interval);
  if (d.interval && d.interval !== 'any' && charge.interval !== d.interval) return { error: `${c} is for ${d.interval === 'year' ? 'yearly' : 'monthly'} billing. Switch to ${d.interval === 'year' ? 'yearly' : 'monthly'} to use it.` };
  if (d.onePerEmail && ctx.email && (d.uses || []).some((u) => u.email === normEmail(ctx.email))) return { error: `${c} has already been used with ${normEmail(ctx.email)}` };
  return { d };
}
// what the person pays with the code: the first payment, and what renewals cost (for the checkout page)
function priced(d, cents) {
  if (d.type === 'trial') return { code: d.code, summary: describe(d), trial: true, days: d.trialDays, endsAt: trialEnd(d), off: cents, first: 0, duration: 'trial', months: 0, renews: cents };
  const off = d.type === 'percent' ? Math.round(cents * d.value / 100) : Math.min(cents, Math.round(d.value * 100));
  return { code: d.code, summary: describe(d), off, first: cents - off, duration: d.duration, months: d.months || 0, renews: d.duration === 'forever' ? cents - off : cents };
}

// a trial that starts today: its last day of access (today is day 1)
const trialEnd = (d) => new Date(Date.now() + (d.trialDays - 1) * 864e5).toISOString().slice(0, 10);

// ---------- the Stripe coupon behind a code (one per set of terms, made the first time it's needed) ----------
async function stripeCoupon(key, d) {
  const terms = `${stripe.modeOf(key)}:${d.type}:${d.value}:${d.duration}:${d.months || 0}`; P().stripeCoupons = P().stripeCoupons || {};
  if (P().stripeCoupons[terms]) return P().stripeCoupons[terms];
  const params = { name: `${d.code} (${describe(d)})`.slice(0, 40), duration: d.duration, 'metadata[discountId]': d.id };
  if (d.type === 'percent') params.percent_off = String(d.value); else { params.amount_off = String(Math.round(d.value * 100)); params.currency = 'usd'; }
  if (d.duration === 'repeating') params.duration_in_months = String(d.months);
  const c = await stripe.request(key, 'POST', 'coupons', params);
  P().stripeCoupons[terms] = c.id; tenancy.savePlatform(); return c.id;
}

// ---------- recording a use (when the account is paid for and opens) ----------
function redeem(t, info = {}) {
  const b = t.billing || {}; if (!b.discount || b.discount.redeemed) return;
  const d = all().find((x) => x.id === b.discount.id); b.discount.redeemed = new Date().toISOString();
  if (d) { d.uses = d.uses || []; d.uses.push({ tenantId: t.id, business: t.name, email: normEmail(b.email), at: b.discount.redeemed, ...info }); }
  tenancy.savePlatform();
}

// ---------- editing codes (Alpha → Discounts) ----------
function clean(b, id) {
  const str = (k, n) => String(b[k] ?? '').trim().slice(0, n);
  const d = { code: normCode(b.code), note: str('note', 200), active: b.active !== false && b.active !== 'off',
    type: ['amount', 'trial'].includes(b.type) ? b.type : 'percent', trialDays: Math.floor(Number(b.trialDays)) || 0, value: Math.round(Number(b.value) * 100) / 100,
    duration: ['once', 'repeating', 'forever'].includes(b.duration) ? b.duration : 'once', months: Math.floor(Number(b.months)) || 0,
    plans: [...new Set((Array.isArray(b.plans) ? b.plans : []).filter((p) => P().plans.some((x) => x.id === p)))],
    interval: ['month', 'year'].includes(b.interval) ? b.interval : 'any',
    startsAt: /^\d{4}-\d{2}-\d{2}$/.test(b.startsAt || '') ? b.startsAt : '', endsAt: /^\d{4}-\d{2}-\d{2}$/.test(b.endsAt || '') ? b.endsAt : '',
    maxUses: Math.max(0, Math.floor(Number(b.maxUses)) || 0), onePerEmail: b.onePerEmail === true || b.onePerEmail === 'on' };
  if (d.type === 'trial') { if (!(d.trialDays >= 1 && d.trialDays <= 90)) fail('Set how many days the free trial lasts (1 to 90)'); Object.assign(d, { value: 0, duration: 'once', months: 0 }); }
  else d.trialDays = 0;
  if (!CODE_RE.test(d.code)) fail('Use 3–30 letters, numbers, dashes or underscores for the code, starting with a letter or number');
  if (all().some((x) => x.code === d.code && x.id !== id)) fail(`There’s already a code called ${d.code}`);
  if (d.type === 'percent' && !(d.value > 0 && d.value <= 100)) fail('Set a percentage between 1 and 100');
  if (d.type === 'amount' && !(d.value > 0 && d.value <= 100000)) fail('Set the dollar amount off');
  if (d.duration === 'repeating' && !(d.months >= 1 && d.months <= 36)) fail('Set how many months the discount lasts (1 to 36)');
  if (d.duration !== 'repeating') d.months = 0;
  if (d.startsAt && d.endsAt && d.endsAt < d.startsAt) fail('The end date is before the start date');
  return d;
}
function create(b) { const d = { id: crypto.randomBytes(5).toString('hex'), ...clean(b), uses: [], createdAt: new Date().toISOString() }; all().push(d); tenancy.savePlatform(); return d; }
function update(id, b) {
  const d = all().find((x) => x.id === id); if (!d) fail('Discount not found', 404);
  // once a code has been used, its discount terms stay as they were (businesses already pay with them); its rules can still change
  const next = clean({ ...d, ...b }, id);
  if ((d.uses || []).length && (next.code !== d.code || next.type !== d.type || next.value !== d.value || next.duration !== d.duration || next.months !== d.months || next.trialDays !== (d.trialDays || 0))) fail('This code has been used, so its code and discount can’t change. Pause it and create a new one instead.');
  Object.assign(d, next); tenancy.savePlatform(); return d;
}
function remove(id) { P().discounts = all().filter((x) => x.id !== id); tenancy.savePlatform(); }
// for the Alpha list
const listView = () => all().map((d) => ({ ...d, status: status(d), summary: describe(d), rules: rulesText(d) }));

module.exports = { check, priced, trialEnd, stripeCoupon, redeem, create, update, remove, listView, describe, normCode };
