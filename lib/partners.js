// Creator partners (Alpha → Pricing → Creator partners): trade creators who send their followers to sign up, for a commission in cash.
// - Creators apply at /partners (or you add them in Alpha). Approving one gives them a discount code for their followers (e.g. MIKE20)
//   and a short link, /go/mike20: it counts the visit, remembers the creator for cookieDays and opens the pricing page with the code filled in.
// - A sign-up is theirs when it uses their code, or comes from their link within cookieDays (also the home page's no-code trial).
// - Commission (the program's terms, or the creator's own): a flat amount when the business first pays, and/or a percent of what it pays
//   each month for a number of months. Each amount waits holdDays before it can be paid out; if the business stops paying first, it's voided.
// - You pay creators yourself (PayPal, Venmo, bank) and record each payout in Alpha. Creators see their numbers at /partners/<token>.
// Nothing here charges or pays anyone: it keeps the ledger.
const crypto = require('crypto');
const tenancy = require('./tenancy');
const stripe = require('./stripe');
const discounts = require('./discounts');

const P = () => tenancy.platform();
let h = {}; // from lib/platform.js: sendEmail(to, subject, body), tellPlatform(title, message)
const init = (helpers) => { h = helpers; };
const id = () => crypto.randomBytes(5).toString('hex');
const now = () => new Date().toISOString();
const normEmail = (s) => String(s || '').trim().toLowerCase();
const fail = (msg, status = 400) => { throw Object.assign(new Error(msg), { status }); };
const money = (n) => Math.round(Number(n || 0) * 100) / 100;
const usd = (n) => '$' + money(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const addMonths = (iso, n) => { const x = new Date(iso); x.setMonth(x.getMonth() + n); return x.toISOString(); };
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString();

const DEFAULTS = {
  enabled: false, flat: 50, percent: 0, months: 0, holdDays: 30, cookieDays: 60,
  offer: { type: 'percent', value: 20, duration: 'repeating', months: 3, trialDays: 0 }, // what a new creator's followers get
  pitch: 'Show other trade business owners how you run yours, and earn cash for every business that signs up with your link.',
};
const program = () => { const p = { ...DEFAULTS, ...(P().partnerProgram || {}) }; p.offer = { ...DEFAULTS.offer, ...(p.offer || {}) }; return p; };
const list = () => (P().partners = P().partners || []);
const refs = () => (P().partnerReferrals = P().partnerReferrals || []);
const payouts = () => (P().partnerPayouts = P().partnerPayouts || []);
const byId = (pid) => list().find((x) => x.id === pid);
const discountOf = (c) => (c.discountId ? (P().discounts || []).find((d) => d.id === c.discountId) : null);
const slugOf = (c) => String(c.code || '').toLowerCase();
const linkOf = (c) => `${tenancy.platformUrl()}/go/${slugOf(c)}`;
const statsUrl = (c) => `${tenancy.platformUrl()}/partners/${c.token}`;
const termsOf = (c) => { const p = program(); const o = c.terms || {}; return { flat: o.flat ?? p.flat, percent: o.percent ?? p.percent, months: o.months ?? p.months }; };
const termsText = (t) => [t.flat > 0 ? `${usd(t.flat)} when a business you send starts paying` : '', t.percent > 0 && t.months > 0 ? `${t.percent}% of what it pays for its first ${t.months} month${t.months === 1 ? '' : 's'}` : ''].filter(Boolean).join(', plus ') || 'No commission set yet';
const offerText = (c) => { const d = discountOf(c); return d ? discounts.describe(d) : ''; };

// ---------- the link: /go/<code> ----------
const clickHits = new Map(); // ip|creator -> day: a visitor counts once a day
function byLink(slug) { slug = String(slug || '').toLowerCase(); return slug ? list().find((c) => c.status === 'active' && slugOf(c) === slug) : null; }
function click(slug, ip) {
  const c = byLink(slug); if (!c) return null;
  const day = now().slice(0, 10); const k = `${ip}|${c.id}`;
  if (clickHits.get(k) !== day) {
    clickHits.set(k, day); if (clickHits.size > 50000) clickHits.clear();
    c.clicks = (c.clicks || 0) + 1; const m = day.slice(0, 7); c.clicksByMonth = c.clicksByMonth || {}; c.clicksByMonth[m] = (c.clicksByMonth[m] || 0) + 1; tenancy.savePlatform();
  }
  const d = discountOf(c);
  return { creator: c, cookie: `wp_partner=${slugOf(c)}; Max-Age=${program().cookieDays * 86400}; Path=/; SameSite=Lax${tenancy.devMode ? '' : '; Secure'}`, to: `/pricing${d && d.active !== false ? `?code=${encodeURIComponent(d.code)}` : ''}` };
}
const cookieSlug = (header) => { const m = /(?:^|;\s*)wp_partner=([a-z0-9_-]{1,30})/.exec(String(header || '')); return m ? m[1] : ''; };

// ---------- a sign-up (lib/platform.js): theirs by code, else by the link's cookie ----------
function signedUp(t, { discountId, cookie }) {
  if (!program().enabled) return null;
  const c = (discountId && list().find((x) => x.status === 'active' && x.discountId === discountId)) || byLink(cookieSlug(cookie)); if (!c) return null;
  const email = normEmail(t.billing && t.billing.email); if (email && email === normEmail(c.email)) return null; // no signing yourself up
  if (refs().some((r) => r.tenantId === t.id)) return null;
  const r = { id: id(), partnerId: c.id, tenantId: t.id, business: t.name, email, via: discountId && c.discountId === discountId ? 'code' : 'link', signedUpAt: now(), status: 'signed up', terms: termsOf(c), monthsSeen: 0, entries: [] };
  refs().push(r); t.partnerId = c.id; tenancy.savePlatform();
  if (h.tellPlatform) h.tellPlatform(`Creator sign-up: ${t.name} from ${c.name}`, `${t.name} signed up with ${c.name}’s ${r.via === 'code' ? `code ${c.code}` : 'link'}. Commission is earned when it starts paying.`);
  return r;
}

// ---------- commission: worked out from each business's billing, so every way of starting to pay counts ----------
const paying = (t) => !!t && !tenancy.isDefault(t) && t.status === 'active' && !!t.billing && t.billing.status === 'paid' && !t.billing.demo;
// what the business pays for month i (1 = the first), after its sign-up discount, in dollars a month
function monthly(t, i) {
  const c = stripe.planCharge(tenancy.planOf(t), t.billing.interval); if (!c) return 0;
  let cents = c.interval === 'year' ? c.cents / 12 : c.cents;
  const d = t.billing.discount && (P().discounts || []).find((x) => x.id === t.billing.discount.id);
  if (d && d.type !== 'trial' && (d.duration === 'forever' || (d.duration === 'repeating' && i <= d.months) || (d.duration === 'once' && i === 1))) cents -= d.type === 'percent' ? cents * d.value / 100 : Math.min(cents, d.value * 100);
  return Math.max(0, cents) / 100;
}
function refresh() {
  const p = program(); let changed = false; const at = now();
  for (const r of refs()) {
    const t = P().tenants.find((x) => x.id === r.tenantId); const on = paying(t);
    if (!r.firstPaidAt) { if (!on) { if (!t && r.status !== 'closed') { r.status = 'closed'; changed = true; } continue; } r.firstPaidAt = at; r.status = 'paying'; changed = true; }
    const elapsed = Math.floor((Date.now() - Date.parse(r.firstPaidAt)) / (30.44 * 864e5)) + 1; // months started since the first payment
    if (on) {
      if (r.status !== 'paying') { r.status = 'paying'; changed = true; }
      if (r.terms.flat > 0 && !r.entries.some((e) => e.kind === 'signup')) { r.entries.push({ id: id(), kind: 'signup', amount: money(r.terms.flat), at: r.firstPaidAt, availableAt: addDays(r.firstPaidAt, p.holdDays) }); changed = true; }
      if (r.terms.percent > 0) for (let i = r.monthsSeen + 1; i <= Math.min(elapsed, r.terms.months); i++) {
        const when = addMonths(r.firstPaidAt, i - 1); const amount = money(monthly(t, i) * r.terms.percent / 100);
        if (amount > 0) r.entries.push({ id: id(), kind: 'month', month: i, amount, at: when, availableAt: addDays(when, p.holdDays) }); changed = true;
      }
      if (r.monthsSeen !== Math.min(elapsed, r.terms.months || 0)) { r.monthsSeen = Math.min(elapsed, r.terms.months || 0); changed = true; }
    } else {
      // stopped paying: amounts still on hold are voided, and the months without paying don't count
      for (const e of r.entries) if (!e.void && Date.parse(e.availableAt) > Date.now()) { e.void = true; e.voidedAt = at; changed = true; }
      if (r.monthsSeen < Math.min(elapsed, r.terms.months || 0)) { r.monthsSeen = Math.min(elapsed, r.terms.months || 0); changed = true; }
      if (r.status !== 'stopped') { r.status = 'stopped'; r.stoppedAt = at; changed = true; }
    }
  }
  if (changed) tenancy.savePlatform();
}
// one creator's totals
function totals(c) {
  const mine = refs().filter((r) => r.partnerId === c.id); const all = mine.flatMap((r) => r.entries.filter((e) => !e.void)); const t = Date.now();
  const earned = money(all.filter((e) => Date.parse(e.availableAt) <= t).reduce((s, e) => s + e.amount, 0));
  const pending = money(all.filter((e) => Date.parse(e.availableAt) > t).reduce((s, e) => s + e.amount, 0));
  const paid = money(payouts().filter((x) => x.partnerId === c.id).reduce((s, x) => s + x.amount, 0));
  const month = now().slice(0, 7);
  return { clicks: c.clicks || 0, clicksMonth: (c.clicksByMonth || {})[month] || 0, signups: mine.length, paying: mine.filter((r) => r.status === 'paying').length,
    everPaid: mine.filter((r) => r.firstPaidAt).length, earned, pending, paid, owed: money(earned - paid) };
}

// ---------- applying: the /partners form ----------
const applyHits = new Map();
function apply(b, ip) {
  if (!program().enabled) fail('Applications are closed right now', 403);
  if (b.website) return null; // the hidden field only bots fill in
  const n = Date.now(); const hits = (applyHits.get(ip) || []).filter((x) => n - x < 3600e3); if (hits.length >= 5) fail('Too many applications from this connection. Try again later.', 429);
  const str = (k, len) => String(b[k] ?? '').trim().slice(0, len);
  const a = { name: str('name', 100), email: normEmail(b.email).slice(0, 200), handle: str('handle', 200), channel: str('channel', 300), network: str('network', 40), audience: str('audience', 40), trade: str('trade', 100), runsBusiness: str('runsBusiness', 10), message: str('message', 2000) };
  if (!a.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) fail('Enter your name and a valid email address');
  if (!a.channel) fail('Add a link to the channel or profile you’d share us on');
  if (a.channel && !/^https?:\/\//i.test(a.channel)) a.channel = 'https://' + a.channel;
  hits.push(n); applyHits.set(ip, hits);
  let c = list().find((x) => normEmail(x.email) === a.email);
  if (c && c.status !== 'declined') { Object.assign(c, { ...a, updatedAt: now() }); tenancy.savePlatform(); return c; } // applied again, or already a partner: keep one
  if (c) Object.assign(c, a, { status: 'applied', appliedAt: now() });
  else { c = { id: id(), token: crypto.randomBytes(16).toString('hex'), ...a, status: 'applied', appliedAt: now(), clicks: 0 }; list().push(c); }
  tenancy.savePlatform();
  if (h.tellPlatform) h.tellPlatform(`Creator application: ${a.name}`, `${a.name} (${a.email}) applied to be a creator partner.\n\n${[a.network && `Network: ${a.network}`, a.audience && `Audience: ${a.audience}`, a.trade && `Trade: ${a.trade}`, `Channel: ${a.channel}`, a.handle && `Other profiles: ${a.handle}`].filter(Boolean).join('\n')}${a.message ? `\n\n${a.message}` : ''}\n\nReview it in Alpha → Pricing → Creator partners.`);
  return c;
}

// ---------- Alpha ----------
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,29}$/;
function clean(b, c = {}) {
  const str = (k, len) => (k in b ? String(b[k] ?? '').trim().slice(0, len) : c[k] || '');
  const out = { name: str('name', 100), email: normEmail(str('email', 200)), handle: str('handle', 200), channel: str('channel', 300), network: str('network', 40), audience: str('audience', 40), trade: str('trade', 100), notes: str('notes', 2000), payTo: str('payTo', 200) };
  if (!out.name) fail('Enter the creator’s name'); if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) fail('Enter a valid email address');
  if ('terms' in b) { // their own commission, or null for the program's
    const t = b.terms; if (!t) out.terms = null;
    else { const flat = money(t.flat); const percent = money(t.percent); const months = Math.floor(Number(t.months) || 0);
      if (!(flat >= 0 && flat <= 5000) || !(percent >= 0 && percent <= 100) || !(months >= 0 && months <= 36)) fail('Set a commission from $0 to $5,000, 0–100% and 0–36 months');
      out.terms = { flat, percent, months }; }
  }
  return out;
}
// the creator's code: an existing unused discount code with that name, or a new one with the program's follower offer
function giveCode(c, code) {
  code = discounts.normCode(code); if (!CODE_RE.test(code)) fail('Use 3–30 letters, numbers, dashes or underscores for the code, e.g. MIKE20');
  if (list().some((x) => x !== c && x.code === code)) fail(`${code} already belongs to another creator`);
  if (c.code === code && discountOf(c)) return;
  const have = (P().discounts || []).find((d) => d.code === code);
  if (have) { c.discountId = have.id; c.code = code; return; }
  const o = program().offer;
  const d = discounts.create({ code, note: `Creator partner: ${c.name}`, active: true, type: o.type, value: o.value, duration: o.duration, months: o.months, trialDays: o.trialDays, onePerEmail: true });
  c.discountId = d.id; c.code = code;
}
function create(b) {
  const c = { id: id(), token: crypto.randomBytes(16).toString('hex'), ...clean(b), status: 'active', approvedAt: now(), clicks: 0 };
  if (c.email && list().some((x) => normEmail(x.email) === c.email)) fail(`${c.email} is already on the list`);
  giveCode(c, b.code); list().push(c); tenancy.savePlatform(); return c;
}
function update(pid, b) {
  const c = byId(pid); if (!c) fail('Creator not found', 404);
  Object.assign(c, clean(b, c));
  if (b.code && discounts.normCode(b.code) !== c.code) { if (refs().some((r) => r.partnerId === c.id && r.via === 'code')) fail('Followers have used this code, so it stays. Give them a new creator entry for a different code.'); giveCode(c, b.code); }
  if (b.status && ['active', 'paused', 'declined', 'applied'].includes(b.status)) {
    if (b.status === 'active' && !c.code) fail('Give them a code first');
    c.status = b.status; if (b.status === 'active' && !c.approvedAt) c.approvedAt = now();
    const d = discountOf(c); if (d && b.status !== 'active' && d.active) discounts.update(d.id, { active: false }); // pausing the creator pauses their code
    if (d && b.status === 'active' && !d.active) discounts.update(d.id, { active: true });
  }
  tenancy.savePlatform(); return c;
}
async function approve(pid, { code, email }) {
  const c = byId(pid); if (!c) fail('Creator not found', 404);
  giveCode(c, code); c.status = 'active'; c.approvedAt = c.approvedAt || now(); const d = discountOf(c); if (d && !d.active) discounts.update(d.id, { active: true });
  tenancy.savePlatform();
  if (email && c.email && h.sendEmail) { const s = await h.sendEmail(c.email, `You’re in: your ${P().settings.productName} creator link`, welcomeText(c)).catch((e) => ({ status: 'failed', detail: e.message })); return { creator: c, emailed: s && s.status === 'sent' }; }
  return { creator: c, emailed: false };
}
function welcomeText(c) {
  const product = P().settings.productName; const t = termsOf(c); const offer = offerText(c);
  return `Hi ${c.name.split(' ')[0]},

Welcome to the ${product} creator program. Here's everything you need.

Your link: ${linkOf(c)}
Your code: ${c.code}${offer ? ` (your followers get ${offer})` : ''}

What you earn: ${termsText(t)}. Each amount is confirmed ${program().holdDays} days after it's earned, as long as the business is still paying.

Your stats page, with clicks, sign-ups and what you've earned: ${statsUrl(c)}
Keep it to yourself, since anyone with it can see your numbers.

A few things that work best:
- Show it on a real job. Finishing a job and showing the post that "writes itself" from your before and after photos goes over well.
- Say what it replaced for you (spreadsheets, paper quotes, another app) and what it costs.
- Put the link in your bio or description and say the code out loud.

One rule: tell people it's a paid partnership. Use your network's "Paid partnership" label or #ad, as the FTC requires.

Reply to this email any time with questions.`;
}
function remove(pid) { const c = byId(pid); if (!c) fail('Creator not found', 404); if (refs().some((r) => r.partnerId === pid) || payouts().some((x) => x.partnerId === pid)) fail('This creator has sign-ups or payouts, so keep them on the list. Pause them instead.'); P().partners = list().filter((x) => x !== c); tenancy.savePlatform(); }
function addPayout(pid, b) {
  const c = byId(pid); if (!c) fail('Creator not found', 404); const amount = money(b.amount);
  if (!(amount > 0 && amount <= 100000)) fail('Enter the amount you paid'); const at = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date + 'T12:00:00.000Z' : now();
  payouts().push({ id: id(), partnerId: c.id, amount, at, method: String(b.method || '').trim().slice(0, 60), note: String(b.note || '').trim().slice(0, 300) }); tenancy.savePlatform();
}
function removePayout(pid, xid) { const n = payouts().length; P().partnerPayouts = payouts().filter((x) => !(x.id === xid && x.partnerId === pid)); if (P().partnerPayouts.length === n) fail('Payout not found', 404); tenancy.savePlatform(); }
function saveProgram(b) {
  const flat = money(b.flat); const percent = money(b.percent); const months = Math.floor(Number(b.months) || 0); const holdDays = Math.floor(Number(b.holdDays)); const cookieDays = Math.floor(Number(b.cookieDays));
  if (!(flat >= 0 && flat <= 5000)) fail('Set the flat commission from $0 to $5,000'); if (!(percent >= 0 && percent <= 100) || !(months >= 0 && months <= 36)) fail('Set the monthly commission from 0 to 100% and 0 to 36 months');
  if (!(holdDays >= 0 && holdDays <= 120)) fail('Set the hold from 0 to 120 days'); if (!(cookieDays >= 1 && cookieDays <= 365)) fail('Remember a link for 1 to 365 days');
  const o = b.offer || {}; const offer = { type: ['percent', 'amount', 'trial'].includes(o.type) ? o.type : 'percent', value: money(o.value), duration: ['once', 'repeating', 'forever'].includes(o.duration) ? o.duration : 'repeating', months: Math.floor(Number(o.months) || 0), trialDays: Math.floor(Number(o.trialDays) || 0) };
  if (offer.type === 'trial' ? !(offer.trialDays >= 1 && offer.trialDays <= 90) : !(offer.value > 0 && (offer.type === 'amount' || offer.value <= 100))) fail(offer.type === 'trial' ? 'Set the followers’ free trial from 1 to 90 days' : 'Set the followers’ discount');
  if (offer.type !== 'trial' && offer.duration === 'repeating' && !(offer.months >= 1 && offer.months <= 36)) fail('Set how many months the followers’ discount lasts (1 to 36)');
  P().partnerProgram = { enabled: b.enabled === true, flat, percent, months, holdDays, cookieDays, offer, pitch: String(b.pitch || '').trim().slice(0, 300) || DEFAULTS.pitch };
  tenancy.savePlatform();
}
const offerSummary = (o) => (o.type === 'trial' ? `${o.trialDays}-day free trial, no card needed` : discounts.describe({ ...o, months: o.months }));
function adminView() {
  refresh(); const name = (tid) => (P().tenants.find((t) => t.id === tid) || {}).name;
  return { program: program(), programTerms: termsText(program()), offer: offerSummary(program().offer),
    creators: list().slice().reverse().map((c) => ({ ...c, link: c.code ? linkOf(c) : '', stats: statsUrl(c), offer: offerText(c), termsText: termsText(termsOf(c)), totals: totals(c),
      referrals: refs().filter((r) => r.partnerId === c.id).map((r) => ({ ...r, business: name(r.tenantId) || r.business, earned: money(r.entries.filter((e) => !e.void).reduce((s, e) => s + e.amount, 0)) })).reverse(),
      payouts: payouts().filter((x) => x.partnerId === c.id).slice().reverse() })) };
}
// the creator's own page
function statsFor(token) {
  if (!/^[a-f0-9]{32}$/.test(String(token || ''))) return null; const c = list().find((x) => x.token === token); if (!c || c.status === 'declined') return null;
  refresh();
  return { name: c.name, status: c.status, code: c.code, link: c.code ? linkOf(c) : '', offer: offerText(c), terms: termsText(termsOf(c)), holdDays: program().holdDays, totals: totals(c),
    referrals: refs().filter((r) => r.partnerId === c.id).map((r, i) => ({ n: i + 1, signedUpAt: r.signedUpAt, status: r.status, via: r.via, earned: money(r.entries.filter((e) => !e.void).reduce((s, e) => s + e.amount, 0)) })).reverse(),
    payouts: payouts().filter((x) => x.partnerId === c.id).map(({ amount, at, method }) => ({ amount, at, method })).reverse() };
}
// /partners/<token>: the creator's own page, with no login (the address is the key; it isn't in search results)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const day = (s) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const STATUS = { 'signed up': ['Signed up', 'Not paying yet'], paying: ['Paying', ''], stopped: ['Stopped paying', ''], closed: ['Closed', ''] };
function statsPage(token) {
  const s = statsFor(token); if (!s) return null; const product = P().settings.productName; const T = s.totals;
  const tile = (n, l, sub = '') => `<div class="crs-tile"><b>${n}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const ideas = [
    ['Finish a job on camera', `Mark a real job done and show the social post ${product} drafts from your before and after photos.`],
    ['Quote on the spot', 'Build and send a quote from the driveway, then show the client approving it on their phone.'],
    ['“What I use to run my business”', 'Walk through your day: schedule, jobs, invoices, getting paid by card.'],
    ['Before and after', 'What you used before (paper, spreadsheets, another app), what it cost, and what changed.'],
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="color-scheme" content="light dark">
<title>Your creator stats · ${esc(product)}</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/styles.css?v=53"><link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/home.css?v=14">
<style>.crs{max-width:880px;margin:0 auto;padding:28px 16px 60px}.crs h1{font-size:30px;margin:6px 0 4px}.crs .lead{color:var(--muted);margin:0 0 22px}
.crs-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin-bottom:16px}.crs-card h2{font-size:18px;margin:0 0 12px}
.crs-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px}@media (max-width:420px){.crs-tiles{grid-template-columns:1fr}}.crs-tile{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.crs-tile b{display:block;font-size:26px;color:var(--brand);line-height:1.2}.crs-tile span{font-size:13px;font-weight:600}.crs-tile small{display:block;color:var(--muted);font-size:12px;margin-top:2px}
.crs-link{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.crs-link code{flex:1 1 260px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;font-size:15px;overflow-wrap:anywhere;background:var(--tint)}
.crs table{width:100%;border-collapse:collapse;font-size:14px}.crs th,.crs td{text-align:left;padding:9px 8px;border-top:1px solid var(--line)}.crs th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border-top:0}
.crs-ideas{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.crs-ideas div{border:1px solid var(--line);border-radius:12px;padding:12px 14px}.crs-ideas b{display:block;margin-bottom:4px}.crs-ideas p{margin:0;color:var(--muted);font-size:14px}
.crs-note{font-size:14px;color:var(--muted)}.crs-warn{border-left:4px solid var(--brand)}</style></head><body><main class="crs">
<span class="h-kicker">${esc(product)} creator partner</span><h1>Hi ${esc(s.name.split(' ')[0])}, here are your numbers</h1>
<p class="lead">${s.status === 'active' ? 'Updated every time you open this page.' : s.status === 'paused' ? 'Your link is paused right now, so new sign-ups aren’t counted. Contact us with any questions.' : 'Your application is in. We’ll email you your link and code once it’s approved.'}</p>
${s.code ? `<div class="crs-card"><h2>Your link and code</h2><div class="crs-link"><code id="crsLink">${esc(s.link)}</code><button class="btn" type="button" onclick="navigator.clipboard.writeText(document.getElementById('crsLink').textContent).then(()=>{this.textContent='Copied'})">Copy link</button></div>
<p class="crs-note" style="margin:10px 0 0">Code <strong>${esc(s.code)}</strong>${s.offer ? `: your followers get ${esc(s.offer)}` : ''}. A sign-up counts when it uses your code, or comes from your link within ${program().cookieDays} days.</p></div>` : ''}
<div class="crs-tiles">${tile(T.clicks.toLocaleString(), 'Link visits', `${T.clicksMonth} this month`)}${tile(T.signups, 'Sign-ups', `${T.paying} paying now`)}${tile(usd(T.owed), 'To be paid to you', `${usd(T.pending)} on hold, confirmed after ${s.holdDays} days`)}${tile(usd(T.paid), 'Paid to you so far', `${usd(T.earned + T.pending)} earned in all`)}</div>
<div class="crs-card"><h2>What you earn</h2><p style="margin:0">${esc(s.terms)}. Each amount is on hold for ${s.holdDays} days and is confirmed if the business is still paying then.</p></div>
<div class="crs-card"><h2>Your sign-ups</h2>${s.referrals.length ? `<div style="overflow-x:auto"><table><thead><tr><th>#</th><th>Signed up</th><th>How</th><th>Status</th><th>Earned</th></tr></thead><tbody>${s.referrals.map((r) => `<tr><td>${r.n}</td><td>${day(r.signedUpAt)}</td><td>${r.via === 'code' ? 'Your code' : 'Your link'}</td><td>${STATUS[r.status][0]}</td><td>${usd(r.earned)}</td></tr>`).join('')}</tbody></table></div><p class="crs-note">Business names stay private.</p>` : '<p class="crs-note" style="margin:0">None yet. They show up here as soon as someone signs up with your link or code.</p>'}</div>
${s.payouts.length ? `<div class="crs-card"><h2>Payouts</h2><table><thead><tr><th>Date</th><th>Amount</th><th>Paid by</th></tr></thead><tbody>${s.payouts.map((x) => `<tr><td>${day(x.at)}</td><td>${usd(x.amount)}</td><td>${esc(x.method || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}
<div class="crs-card"><h2>Video ideas that work</h2><div class="crs-ideas">${ideas.map(([t, d]) => `<div><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div></div>
<div class="crs-card crs-warn"><h2>Say it’s a paid partnership</h2><p style="margin:0">Whenever you mention ${esc(product)}, use your network’s “Paid partnership” label or say #ad. The FTC requires it, and your followers trust you more for it.</p></div>
<p class="crs-note">Keep this page’s address to yourself, since anyone with it can see your numbers. Questions? ${P().settings.contactEmail ? `Email <a href="mailto:${esc(P().settings.contactEmail)}">${esc(P().settings.contactEmail)}</a>.` : 'Reply to your welcome email.'}</p>
</main></body></html>`;
}
// the /partners page's numbers
function publicTerms() { const p = program(); return { enabled: p.enabled, flat: p.flat, percent: p.percent, months: p.months, holdDays: p.holdDays, terms: termsText(p), offer: offerSummary(p.offer), pitch: p.pitch }; }

module.exports = { init, program, click, signedUp, refresh, apply, create, update, approve, remove, addPayout, removePayout, saveProgram, adminView, statsFor, statsPage, publicTerms, welcomeText, usd };
