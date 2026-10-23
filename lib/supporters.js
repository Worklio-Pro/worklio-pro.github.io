// The Founding Supporters list (managed in Alpha → Promotions → Founding Supporters): a public thank-you page at /supporters
// naming the people who backed the product, e.g. on Kickstarter. Names are grouped by reward tier, biggest first.
// While the list is off, /supporters goes to the home page and the footer link is hidden.
//
// Supporter codes: a tier that comes with a plan (REWARDS) gets a one-time code, emailed from Alpha, worth that many prepaid months.
// - New account: entered at sign-up on the pricing page (lib/platform.js), the account opens on the tier's plan with no card,
//   prepaid until t.expiresAt (a free trial underneath: adding a card starts billing when the prepaid months end).
// - Existing account: redeemed in Account and billing (server.js /api/account/billing/redeem). A live subscription moves to
//   the tier's plan and its next charge moves out by the months; otherwise the account gets prepaid months as above.
// While prepaid months run (t.billing.prepaid), the plan can't be changed, so a Core code can't become free Expert time.
const crypto = require('crypto');
const tenancy = require('./tenancy');
const industries = require('./industries');

const P = () => tenancy.platform();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fail = (msg, status = 400) => { throw Object.assign(new Error(msg), { status }); };
const TIERS = ['Founding Crew', 'Expert', 'Advanced', 'Core', 'Supporter']; // page order; '' is "no tier", listed last
const REWARDS = { 'Founding Crew': { planId: 'expert', months: 36 }, Expert: { planId: 'expert', months: 12 }, Advanced: { planId: 'advanced', months: 12 }, Core: { planId: 'core', months: 12 } };
const DEFAULTS = { enabled: false, title: 'Our Founding Supporters', intro: 'These people backed {product} before anyone else did. Thank you for helping us build it.', people: [] };
// always the same saved object (missing settings filled in), so a change made through one lookup is the one that's saved
const store = () => { const s = (P().supporters = P().supporters || {}); for (const [k, v] of Object.entries(DEFAULTS)) if (!(k in s)) s[k] = Array.isArray(v) ? [] : v; return s; };
const tierOf = (s) => (TIERS.includes(s) ? s : '');
const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80);
const EMAIL_RE = /[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+/;
const cleanEmail = (s) => String(s || '').trim().toLowerCase();
const fill = (s) => esc(s).replace(/\{product\}/g, esc(P().settings.productName || 'Worklio Pro'));
const normCode = (s) => String(s || '').trim().toUpperCase();
const niceDate = (s) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// the plan and months a supporter's tier is worth: { plan, months } or null (no plan in this tier, or the plan is gone)
function rewardOf(p) {
  const r = REWARDS[p.tier]; if (!r) return null;
  const plan = P().plans.find((x) => x.id === r.planId); return plan ? { plan, months: r.months } : null;
}
const rewardText = (r) => `${r.months} months of ${r.plan.name}`;

const isOn = () => !!store().enabled && store().people.length > 0;
const adminView = () => {
  const s = store();
  return { enabled: s.enabled, title: s.title, intro: s.intro, tiers: TIERS, rewards: Object.fromEntries(TIERS.map((t) => { const r = rewardOf({ tier: t }); return [t, r ? rewardText(r) : '']; })),
    people: s.people.map((p) => ({ ...p, reward: (rewardOf(p) && rewardText(rewardOf(p))) || '' })) };
};

function saveSettings(b) {
  const s = store(); const title = String(b.title || '').trim();
  if (!title) fail('Give the page a title');
  Object.assign(s, { enabled: !!b.enabled, title: title.slice(0, 80), intro: String(b.intro || '').trim().slice(0, 400) });
  tenancy.savePlatform();
}
// one supporter per line (e.g. pasted from a Kickstarter backer export): a name, optionally with an email anywhere on the line
// ("Jordan Lee, jordan@example.com", "Jordan Lee <jordan@example.com>" or tab-separated). Anyone already on the list is skipped.
function add(b) {
  const s = store(); const tier = tierOf(b.tier);
  const lines = String(b.names || '').split(/\r?\n/).map((l) => { const m = l.match(EMAIL_RE); const email = m ? cleanEmail(m[0]) : ''; return { email, name: cleanName((m ? l.replace(m[0], ' ') : l).replace(/[<>,;\t]+/g, ' ')) || email.split('@')[0] }; }).filter((x) => x.name);
  if (!lines.length) fail('Enter at least one name');
  let added = 0;
  for (const { name, email } of lines) {
    if (s.people.some((x) => (email && x.email === email) || x.name.toLowerCase() === name.toLowerCase())) continue;
    s.people.push({ id: crypto.randomBytes(5).toString('hex'), name, email, tier, addedAt: new Date().toISOString() }); added++;
  }
  tenancy.savePlatform();
  return { added, skipped: lines.length - added };
}
const byId = (id) => store().people.find((p) => p.id === id) || fail('That supporter isn’t on the list', 404);
function update(id, b) {
  const x = byId(id);
  if ('name' in b) { const name = cleanName(b.name); if (!name) fail('Enter a name'); x.name = name; }
  if ('email' in b) { const email = cleanEmail(b.email); if (email && !EMAIL_RE.test(email)) fail('Enter a valid email address'); x.email = email; }
  if ('tier' in b) { if (x.code && x.code.redeemedAt && tierOf(b.tier) !== x.tier) fail(`${x.name} already redeemed their code, so their tier can’t change`); x.tier = tierOf(b.tier); }
  tenancy.savePlatform();
}
function remove(id) {
  const s = store(); byId(id); s.people = s.people.filter((p) => p.id !== id); tenancy.savePlatform();
}

// ---------- codes ----------
const newCode = () => { let c; do c = 'FS-' + crypto.randomBytes(4).toString('hex').toUpperCase().replace(/(.{4})/, '$1-'); while (store().people.some((p) => p.code && p.code.code === c)); return c; };
// email a supporter their code (made the first time); send(key, to, vars) sends a platform email template
async function sendCode(id, send) {
  const p = byId(id); const r = rewardOf(p);
  if (!r) fail(p.tier && REWARDS[p.tier] ? `The ${REWARDS[p.tier].planId} plan no longer exists` : `The ${p.tier || 'no-tier'} reward doesn’t include a plan, so there’s no code to send`);
  if (!p.email) fail(`Add an email address for ${p.name} first`);
  if (p.code && p.code.redeemedAt) fail(`${p.name} already redeemed their code`);
  if (!p.code) p.code = { code: newCode(), createdAt: new Date().toISOString() };
  const link = `${tenancy.platformUrl()}/pricing?code=${encodeURIComponent(p.code.code)}`;
  const sent = await send('supporterCode', p.email, { name: p.name.split(/\s+/)[0], tier: p.tier, reward: rewardText(r), plan: r.plan.name, months: String(r.months), code: p.code.code, signup_link: link });
  if (sent.status !== 'sent' && sent.status !== 'simulated') { tenancy.savePlatform(); fail(`Couldn’t email ${p.email}: ${sent.detail || sent.status}`, 502); }
  Object.assign(p.code, { sentAt: new Date().toISOString(), sentTo: p.email, simulated: sent.status === 'simulated' || undefined }); tenancy.savePlatform();
  return { emailed: p.email, simulated: sent.status === 'simulated' };
}
// codes for everyone with a plan reward and an email who hasn't been sent one yet
async function sendNew(send) {
  const due = store().people.filter((p) => rewardOf(p) && p.email && !(p.code && p.code.sentAt));
  let sent = 0; const failed = [];
  for (const p of due) { try { await sendCode(p.id, send); sent++; } catch (e) { failed.push(`${p.name}: ${e.message}`); } }
  return { sent, failed };
}
// a code typed at sign-up or in Account and billing: null if it isn't a supporter code at all (so it can be a discount code),
// else { p, plan, months } or { error }
function check(code) {
  const c = normCode(code); if (!c) return null;
  const p = store().people.find((x) => x.code && x.code.code === c); if (!p) return /^FS-/.test(c) ? { error: 'That supporter code isn’t valid. Check it against your email.' } : null;
  if (p.code.redeemedAt) return { error: 'That supporter code has already been used' };
  const r = rewardOf(p); if (!r) return { error: 'That supporter code no longer includes a plan. Contact us.' };
  return { p, plan: r.plan, months: r.months, summary: `Founding Supporter: ${rewardText(r)} prepaid, no card needed` };
}
const addMonths = (day, n) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); };
const dayBefore = (day) => new Date(Date.parse(day + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10);
// the last prepaid day for months starting on `from` (a day), e.g. Oct 23 + 12 months → Oct 22 next year
const prepaidEnd = (from, months) => dayBefore(addMonths(from, months));
// prepaid months with no subscription: the account runs on the plan until the last prepaid day (a trial underneath)
function startPrepaid(t, ck, from) {
  const until = prepaidEnd(from, ck.months); const b = t.billing || (t.billing = {});
  Object.assign(b, { status: 'trial', trial: { code: ck.p.code.code, prepaid: true, months: ck.months, startedAt: new Date().toISOString(), endsAt: until } });
  delete b.pendingPlanId; delete b.endsAt;
  t.planId = ck.plan.id; t.expiresAt = until;
  if (tenancy.reopenable(t)) tenancy.resume(t); // paused for a reason the business can fix (not from Alpha)
  return until;
}
// the code is used: remember where, and lock the plan while the prepaid months run
function redeemed(t, ck, until) {
  Object.assign(ck.p.code, { redeemedAt: new Date().toISOString(), tenantId: t.id, tenantName: t.name, planId: ck.plan.id, months: ck.months, until });
  t.billing.prepaid = { code: ck.p.code.code, planId: ck.plan.id, months: ck.months, until };
  tenancy.savePlatform();
}
// the plan is locked until this day (inclusive), or null
const lockedUntil = (t) => { const x = t.billing && t.billing.prepaid; return x && x.until >= new Date().toISOString().slice(0, 10) ? x.until : null; };

// ---------- the public page ----------
const footerLink = () => (isOn() ? '<a href="/supporters">Founding Supporters</a>' : '');
function page() {
  if (!isOn()) return null;
  const s = store();
  const groups = [...TIERS, ''].map((t) => [t, s.people.filter((p) => p.tier === t).sort((a, b) => a.name.localeCompare(b.name))]).filter(([, l]) => l.length);
  return industries.shell({ head: require('./seo').supportersHead(),
    body: `
    <section class="h-hero"><div class="h-wrap i-hero-solo">
      <span class="h-eyebrow">Thank you</span>
      <h1>${esc(s.title)}</h1>
      ${s.intro ? `<p class="lead">${fill(s.intro)}</p>` : ''}
    </div></section>
    <section class="h-sec" style="padding-top:12px"><div class="h-wrap s-tiers">
      ${groups.map(([t, l]) => `<div class="s-tier${t === 'Founding Crew' ? ' s-top' : ''}"><h2>${t ? esc(t) : 'Supporters'} <span>${l.length}</span></h2><ul>${l.map((p) => `<li>${esc(p.name)}</li>`).join('')}</ul></div>`).join('')}
    </div></section>` });
}

module.exports = { TIERS, isOn, adminView, saveSettings, add, update, remove, sendCode, sendNew, check, startPrepaid, prepaidEnd, redeemed, lockedUntil, niceDate, page, footerLink };
