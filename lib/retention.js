// The cancellation flow (Account and billing → Modify subscription → Cancel plan), set up in Alpha → Pricing → Cancellation flow.
// - Settings (P().retention): which steps show, the offers' terms, and the reasons a business picks from (each leads to an offer).
// - Log (P().cancelFlows): one row each time an owner picks a reason, with the offer shown, their feedback and how it ended.
const crypto = require('crypto');
const tenancy = require('./tenancy');

const P = () => tenancy.platform();
const OFFERS = ['sprint', 'tour', 'stay', 'extend', 'none'];
const OUTCOMES = { cancelled: 'Cancelled', stay: 'Took the stay discount', gift: 'Took the parting gift', extended: 'Extended the trial', sprint: 'Asked for the setup plan', tour: 'Asked for a tour', closed: 'Closed without cancelling' };
const DEFAULTS = {
  extend: { on: true, days: 7, after: 5 }, // a free trial can be extended once, from this day of the trial
  sprint: { on: true }, tour: { on: true },
  stay: { on: true, percent: 15, months: 3 }, // the offer when the price is the reason
  lose: { on: true }, feedback: { on: true, required: true },
  gift: { on: true, percent: 50 }, // the last offer, on the next bill
  password: { on: true }, yearly: false, // yearly: also make the two discounts to yearly billing
  reasons: [
    { id: 'setup', title: 'I’m struggling to set things up or get results.', text: 'I want to get going, but setting it up is holding me back.', offer: 'sprint' },
    { id: 'feature', title: 'A tool or feature isn’t working the way I expected.', text: 'Something isn’t doing what I need for my business.', offer: 'tour' },
    { id: 'price', title: 'The price doesn’t fit my budget right now.', text: 'I’m not ready for this cost until I see more results.', offer: 'stay' },
    { id: 'exploring', title: 'I’m just exploring and not ready to commit.', text: 'I want more time to decide.', offer: 'extend' },
  ],
};
const STEPS = ['extend', 'sprint', 'tour', 'stay', 'lose', 'feedback', 'gift', 'password'];
function config() {
  const c = P().retention || {}; const out = { yearly: !!c.yearly, reasons: Array.isArray(c.reasons) && c.reasons.length ? c.reasons : DEFAULTS.reasons };
  for (const k of STEPS) out[k] = { ...DEFAULTS[k], ...(c[k] || {}) };
  return out;
}
const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
function save(b = {}) {
  const c = config(); const on = (k) => (b[k] && 'on' in b[k] ? !!b[k].on : c[k].on);
  const next = {
    extend: { on: on('extend'), days: int(b.extend && b.extend.days, 1, 60, c.extend.days), after: int(b.extend && b.extend.after, 0, 60, c.extend.after) },
    sprint: { on: on('sprint') }, tour: { on: on('tour') },
    stay: { on: on('stay'), percent: int(b.stay && b.stay.percent, 1, 100, c.stay.percent), months: int(b.stay && b.stay.months, 1, 24, c.stay.months) },
    lose: { on: on('lose') }, feedback: { on: on('feedback'), required: b.feedback && 'required' in b.feedback ? !!b.feedback.required : c.feedback.required },
    gift: { on: on('gift'), percent: int(b.gift && b.gift.percent, 1, 100, c.gift.percent) },
    password: { on: on('password') }, yearly: 'yearly' in b ? !!b.yearly : c.yearly,
    reasons: c.reasons,
  };
  if (Array.isArray(b.reasons)) {
    const rs = b.reasons.slice(0, 8).map((r) => ({ id: /^[a-z0-9-]{1,24}$/.test(r.id || '') ? r.id : crypto.randomBytes(4).toString('hex'), title: str(r.title, 120), text: str(r.text, 200), offer: OFFERS.includes(r.offer) ? r.offer : 'none' })).filter((r) => r.title);
    if (!rs.length) { const e = new Error('Add at least one reason'); e.status = 400; throw e; }
    next.reasons = rs;
  }
  P().retention = next; tenancy.savePlatform(); return config();
}
// the Stripe coupon terms for a stay offer (lib/discounts.js stripeCoupon makes one per set of terms)
function coupon(kind) {
  const c = config();
  if (kind === 'stay') return { id: 'retention-stay', code: 'STAY' + c.stay.percent, type: 'percent', value: c.stay.percent, duration: c.stay.months > 1 ? 'repeating' : 'once', months: c.stay.months > 1 ? c.stay.months : 0, label: `${c.stay.percent}% off ${c.stay.months > 1 ? `the next ${c.stay.months} bills` : 'the next bill'}` };
  if (kind === 'gift') return { id: 'retention-gift', code: 'STAY' + c.gift.percent, type: 'percent', value: c.gift.percent, duration: 'once', months: 0, label: `${c.gift.percent}% off the next bill` };
  return null;
}

// ---------- the log ----------
const flows = () => (P().cancelFlows = P().cancelFlows || []);
const find = (t, id) => (id ? flows().find((f) => f.id === id && f.tenantId === t.id) : null);
// an owner picked a reason: the flow is on the log from here
function start(t, u, { id, reason }, extra = {}) {
  if (!/^[a-f0-9]{12}$/.test(String(id || ''))) return null;
  const r = config().reasons.find((x) => x.id === reason);
  let f = find(t, id);
  if (!f) { f = { id, tenantId: t.id, business: t.name, slug: t.slug, startedAt: new Date().toISOString(), user: u.name, email: u.email, ...extra }; flows().unshift(f); flows().length = Math.min(flows().length, 2000); }
  f.reason = reason; f.reasonTitle = r ? r.title : str(reason, 120); tenancy.savePlatform(); return f;
}
// the steps it reached, the offer shown, feedback, and how it ended (the first ending sticks; cancelling always wins)
function note(t, id, b = {}) {
  const f = find(t, id); if (!f) return null;
  if (b.offer && OFFERS.includes(b.offer)) f.offer = b.offer;
  if (b.gift) f.giftShown = true;
  if ('feedback' in b) f.feedback = str(b.feedback, 500);
  if (b.outcome && OUTCOMES[b.outcome] && (!f.outcome || f.outcome === 'closed' || b.outcome === 'cancelled')) { f.outcome = b.outcome; f.endedAt = new Date().toISOString(); }
  tenancy.savePlatform(); return f;
}
function adminView() {
  const L = flows(); const n = (fn) => L.filter(fn).length; const ended = L.filter((f) => f.outcome);
  const cancelled = n((f) => f.outcome === 'cancelled'); const kept = ended.length - cancelled;
  const byReason = config().reasons.map((r) => ({ id: r.id, title: r.title, count: n((f) => f.reason === r.id), cancelled: n((f) => f.reason === r.id && f.outcome === 'cancelled') }));
  return { config: config(), defaults: DEFAULTS, outcomes: OUTCOMES, flows: L.slice(0, 500),
    stats: { started: L.length, cancelled, kept, open: L.length - ended.length, keptRate: ended.length ? Math.round(kept / ended.length * 100) : null, byReason,
      byOutcome: Object.keys(OUTCOMES).map((k) => ({ k, label: OUTCOMES[k], count: n((f) => f.outcome === k) })) } };
}
function removeFlow(id) { P().cancelFlows = flows().filter((f) => f.id !== id); tenancy.savePlatform(); }

module.exports = { config, save, coupon, start, note, adminView, removeFlow, OUTCOMES };
