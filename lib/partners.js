// Creator partners (Alpha → Pricing → Creator partners): trade creators who send their followers to sign up, for a commission in cash.
// - Creators apply at /partners (or you add them in Alpha). Approving one gives them a discount code for their followers (e.g. MIKE20)
//   and a short link, /go/mike20: it counts the visit, remembers the creator for cookieDays and opens the pricing page with the code filled in.
// - A sign-up is theirs when it uses their code, or comes from their link within cookieDays (also the home page's no-code trial).
// - Commission (the program's terms, or the creator's own): a flat amount when the business first pays, and/or a percent of what it pays
//   each month for a number of months. Each amount waits holdDays before it can be paid out; if the business stops paying first, it's voided.
// - You pay creators yourself (PayPal, Venmo, bank) and record each payout in Alpha. Creators see their numbers at /partners/<token>.
// Nothing here charges or pays anyone: it keeps the ledger.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
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
  digest();
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

// ---------- how a creator wants to be paid ----------
const PAY_METHODS = ['PayPal', 'Venmo', 'Zelle', 'Cash App', 'Bank transfer', 'Check', 'Other'];
function payToOf(method, handle) {
  method = PAY_METHODS.includes(method) ? method : ''; handle = String(handle || '').trim().slice(0, 150); if (!method) return '';
  if (['Bank transfer', 'Check'].includes(method)) return method; // details by email, not on a web form
  if (!handle) fail(`Add your ${method === 'Other' ? 'payout details' : method + (method === 'PayPal' ? ' email' : method === 'Zelle' ? ' email or phone' : ' username')}`);
  return `${method}: ${handle}`;
}
// the creator changes it on their stats page
function setPayTo(token, b) {
  const c = /^[a-f0-9]{32}$/.test(String(token || '')) && list().find((x) => x.token === token); if (!c || c.status === 'declined') fail('Page not found', 404);
  const p = payToOf(b.method, b.handle); if (!p) fail('Choose how you’d like to be paid');
  const was = c.payTo || ''; c.payTo = p; c.payToAt = now(); tenancy.savePlatform();
  if (was !== p && h.tellPlatform) h.tellPlatform(`Creator payout details: ${c.name}`, `${c.name} changed how they’re paid${was ? ` from “${was}”` : ''} to “${p}”.`);
}

// ---------- the monthly payout list: an email to you on the 1st with who to pay, how much and where ----------
function digest() {
  const m = now().slice(0, 7); const p = P().partnerProgram; if (!p || !p.enabled) return;
  if (!P().partnerDigestMonth) { P().partnerDigestMonth = m; tenancy.savePlatform(); return; } // starts next month, not the day it's deployed
  if (P().partnerDigestMonth === m) return; P().partnerDigestMonth = m; tenancy.savePlatform();
  const due = list().filter((c) => c.status === 'active' || c.status === 'paused').map((c) => ({ c, t: totals(c) })).filter((x) => x.t.owed > 0);
  if (!due.length || !h.tellPlatform) return;
  const total = money(due.reduce((s, x) => s + x.t.owed, 0)); const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  h.tellPlatform(`Creator payouts for ${month}: ${usd(total)}`, `${due.length} creator${due.length === 1 ? ' is' : 's are'} owed confirmed commission. Pay them, then click Record payout on each one in Alpha → Pricing → Creator partners.\n\n${due.map(({ c, t }) => `- ${c.name}: ${usd(t.owed)} → ${c.payTo || 'no payout details yet (ask them)'}${c.w9At ? '' : ' · no tax form on file'}`).join('\n')}`);
}

// ---------- tax forms: a W-9 (US) or W-8BEN (outside the US), sent with the application or later ----------
// They hold a tax ID, so they're kept in DATA_DIR/partner-tax (never served by the website; only Alpha opens them, with Content-Disposition
// attachment and no caching), readable by the server only, and deleted when an application is declined or a creator is deleted.
const TAX_DIR = () => path.join(tenancy.DATA_DIR, 'partner-tax');
const TAX_TYPES = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };
function readTaxForm(b) {
  const kind = b.usBased === 'no' ? 'W-8BEN' : b.usBased === 'yes' ? 'W-9' : ''; if (!kind) fail('Tell us whether you’re based in the US');
  const m = /^data:([a-z/]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.taxForm || ''));
  if (!m) fail(`Attach your filled-in ${kind} (a PDF or a photo)`); if (!TAX_TYPES[m[1]]) fail(`Attach your ${kind} as a PDF, JPG or PNG`);
  const buf = Buffer.from(m[2], 'base64'); if (buf.length < 1000) fail(`That ${kind} file looks empty. Attach the filled-in form.`); if (buf.length > 8 * 1024 * 1024) fail(`Attach a ${kind} under 8 MB`);
  return { kind, type: m[1], buf, name: String(b.taxFormName || '').replace(/[^\w .()-]/g, '').slice(0, 80) };
}
function storeTaxForm(c, f) {
  dropTaxForm(c); fs.mkdirSync(TAX_DIR(), { recursive: true, mode: 0o700 });
  const file = `${c.id}-${crypto.randomBytes(8).toString('hex')}.${TAX_TYPES[f.type]}`; fs.writeFileSync(path.join(TAX_DIR(), file), f.buf, { mode: 0o600 });
  c.taxForm = { kind: f.kind, file, type: f.type, name: f.name, at: now() }; c.w9At = now(); // received; untick in Alpha if it isn't right
}
function dropTaxForm(c) { if (!c.taxForm) return; try { fs.unlinkSync(path.join(TAX_DIR(), c.taxForm.file)); } catch (e) { /* already gone */ } delete c.taxForm; c.w9At = ''; }
function taxFormFile(pid) {
  const c = byId(pid); if (!c || !c.taxForm) fail('No tax form on file', 404);
  const p = path.join(TAX_DIR(), path.basename(c.taxForm.file)); if (!fs.existsSync(p)) fail('The tax form file is missing', 404);
  return { path: p, type: c.taxForm.type, name: `${c.taxForm.kind} ${c.name}.${TAX_TYPES[c.taxForm.type]}`.replace(/[^\w .()-]/g, '') };
}
// Alpha (Upload tax form) or the creator's stats page
function setTaxForm(c, b) { if (!c || c.status === 'declined') fail('Creator not found', 404); storeTaxForm(c, readTaxForm(b)); tenancy.savePlatform(); }
const setTaxFormById = (pid, b) => setTaxForm(byId(pid), b);
function setTaxFormByToken(token, b) {
  const c = /^[a-f0-9]{32}$/.test(String(token || '')) && list().find((x) => x.token === token); setTaxForm(c, b);
  if (h.tellPlatform) h.tellPlatform(`Creator tax form: ${c.name}`, `${c.name} sent their ${c.taxForm.kind} from their stats page. Check it in Alpha → Pricing → Creator partners.`);
}

// ---------- applying: the /partners form ----------
const applyHits = new Map();
function apply(b, ip) {
  if (!program().enabled) fail('Applications are closed right now', 403);
  if (b.website) return null; // the hidden field only bots fill in
  const n = Date.now(); const hits = (applyHits.get(ip) || []).filter((x) => n - x < 3600e3); if (hits.length >= 5) fail('Too many applications from this connection. Try again later.', 429);
  const str = (k, len) => String(b[k] ?? '').trim().slice(0, len);
  const a = { name: str('name', 100), email: normEmail(b.email).slice(0, 200), handle: str('handle', 200), channel: str('channel', 300), network: str('network', 40), audience: str('audience', 40), trade: str('trade', 100), runsBusiness: str('runsBusiness', 10), message: str('message', 2000), payTo: payToOf(b.payMethod, b.payHandle) };
  if (!a.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) fail('Enter your name and a valid email address');
  if (!a.channel) fail('Add a link to the channel or profile you’d share us on');
  if (a.channel && !/^https?:\/\//i.test(a.channel)) a.channel = 'https://' + a.channel;
  const tax = readTaxForm(b); a.usBased = tax.kind === 'W-9' ? 'yes' : 'no'; // the W-9 or W-8BEN comes with the application
  hits.push(n); applyHits.set(ip, hits);
  let c = list().find((x) => normEmail(x.email) === a.email);
  if (c && c.status !== 'declined') { Object.assign(c, { ...a, updatedAt: now() }); storeTaxForm(c, tax); tenancy.savePlatform(); return c; } // applied again, or already a partner: keep one
  if (c) Object.assign(c, a, { status: 'applied', appliedAt: now() });
  else { c = { id: id(), token: crypto.randomBytes(16).toString('hex'), ...a, status: 'applied', appliedAt: now(), clicks: 0 }; list().push(c); }
  storeTaxForm(c, tax); tenancy.savePlatform();
  if (h.tellPlatform) h.tellPlatform(`Creator application: ${a.name}`, `${a.name} (${a.email}) applied to be a creator partner.\n\n${[a.network && `Network: ${a.network}`, a.audience && `Audience: ${a.audience}`, a.trade && `Trade: ${a.trade}`, `Channel: ${a.channel}`, a.handle && `Other profiles: ${a.handle}`].filter(Boolean).join('\n')}${a.message ? `\n\n${a.message}` : ''}\n\nReview it in Alpha → Pricing → Creator partners.`);
  return c;
}

// ---------- Alpha ----------
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,29}$/;
function clean(b, c = {}) {
  const str = (k, len) => (k in b ? String(b[k] ?? '').trim().slice(0, len) : c[k] || '');
  const out = { name: str('name', 100), email: normEmail(str('email', 200)), handle: str('handle', 200), channel: str('channel', 300), network: str('network', 40), audience: str('audience', 40), trade: str('trade', 100), notes: str('notes', 2000), payTo: str('payTo', 200) };
  if ('w9' in b) out.w9At = b.w9 === true || b.w9 === 'on' ? c.w9At || now() : ''; // W-9 received (US creators), before the first payout
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
    if (b.status === 'declined') dropTaxForm(c); // nobody's tax ID kept for an application you turned down
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
// the stats page link by email: from /partners ("Already a partner?") or Alpha's Email stats link. Only to the email on file, so nobody else gets a creator's numbers
function statsEmail(c) {
  const product = P().settings.productName;
  return `Hi ${c.name.split(' ')[0]},

Here's the link to your ${product} creator stats page, with your link visits, sign-ups and what you've earned:

${statsUrl(c)}

Bookmark it so it's handy. Keep it to yourself, since anyone with it can see your numbers.

Your link: ${linkOf(c)}
Your code: ${c.code}`;
}
async function emailStats(pid) {
  const c = byId(pid); if (!c) fail('Creator not found', 404); if (!c.email) fail('Add their email first'); if (!c.code) fail('Approve them first');
  if (!h.sendEmail) fail('Email isn’t set up', 503);
  const s = await h.sendEmail(c.email, `Your ${P().settings.productName} creator stats`, statsEmail(c)).catch((e) => ({ status: 'failed', detail: e.message }));
  if (!s || s.status !== 'sent') fail(`The email didn’t send${s && s.detail ? `: ${s.detail}` : ''}. Copy their stats page link instead.`, 502);
}
const linkHits = new Map(); // ip -> timestamps, and email -> last sent: 5 asks an hour per connection, one email per address every 10 minutes
async function requestStats(email, ip) {
  email = normEmail(email); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter the email you applied with');
  const n = Date.now(); const hits = (linkHits.get(ip) || []).filter((x) => n - x < 3600e3); if (hits.length >= 5) fail('Too many tries from this connection. Try again later.', 429); hits.push(n); linkHits.set(ip, hits);
  const c = list().find((x) => normEmail(x.email) === email && x.code && (x.status === 'active' || x.status === 'paused'));
  if (!c || n - (linkHits.get('e|' + email) || 0) < 600e3 || !h.sendEmail) return; // the same answer either way, so the form doesn't tell who's a partner
  linkHits.set('e|' + email, n); h.sendEmail(c.email, `Your ${P().settings.productName} creator stats`, statsEmail(c)).catch(() => {});
}
function remove(pid) { const c = byId(pid); if (!c) fail('Creator not found', 404); if (refs().some((r) => r.partnerId === pid) || payouts().some((x) => x.partnerId === pid)) fail('This creator has sign-ups or payouts, so keep them on the list. Pause them instead.'); dropTaxForm(c); P().partners = list().filter((x) => x !== c); tenancy.savePlatform(); }
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
  return { name: c.name, status: c.status, code: c.code, payTo: c.payTo || '', w9: !!c.w9At, link: c.code ? linkOf(c) : '', offer: offerText(c), terms: termsText(termsOf(c)), holdDays: program().holdDays, totals: totals(c),
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
<title>Your creator stats · ${esc(product)}</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/styles.css?v=53"><link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/home.css?v=21">
<style>.crs{max-width:880px;margin:0 auto;padding:28px 16px 60px}.crs h1{font-size:30px;margin:6px 0 4px}.crs .lead{color:var(--muted);margin:0 0 22px}
.crs-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin-bottom:16px}.crs-card h2{font-size:18px;margin:0 0 12px}
.crs-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px}@media (max-width:420px){.crs-tiles{grid-template-columns:1fr}}.crs-tile{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.crs-tile b{display:block;font-size:26px;color:var(--brand);line-height:1.2}.crs-tile span{font-size:13px;font-weight:600}.crs-tile small{display:block;color:var(--muted);font-size:12px;margin-top:2px}
.crs-link{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.crs-link code{flex:1 1 260px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;font-size:15px;overflow-wrap:anywhere;background:var(--tint)}
.crs table{width:100%;border-collapse:collapse;font-size:14px}.crs th,.crs td{text-align:left;padding:9px 8px;border-top:1px solid var(--line)}.crs th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border-top:0}
.crs-ideas{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.crs-ideas div{border:1px solid var(--line);border-radius:12px;padding:12px 14px}.crs-ideas b{display:block;margin-bottom:4px}.crs-ideas p{margin:0;color:var(--muted);font-size:14px}
.crs-note{font-size:14px;color:var(--muted)}.crs-pay{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.crs-pay p{flex:1 1 100%}.crs-pay select{flex:0 0 160px;width:160px;margin:0}.crs-pay input{flex:1 1 200px;margin:0}.crs-pay .btn{height:40px;margin:0}.crs-warn{border-left:4px solid var(--brand)}</style></head><body><main class="crs">
<span class="h-kicker">${esc(product)} creator partner</span><h1>Hi ${esc(s.name.split(' ')[0])}, here are your numbers</h1>
<p class="lead">${s.status === 'active' ? 'Updated every time you open this page.' : s.status === 'paused' ? 'Your link is paused right now, so new sign-ups aren’t counted. Contact us with any questions.' : 'Your application is in. We’ll email you your link and code once it’s approved.'}</p>
${s.code ? `<div class="crs-card"><h2>Your link and code</h2><div class="crs-link"><code id="crsLink">${esc(s.link)}</code><button class="btn" type="button" onclick="navigator.clipboard.writeText(document.getElementById('crsLink').textContent).then(()=>{this.textContent='Copied'})">Copy link</button></div>
<p class="crs-note" style="margin:10px 0 0">Code <strong>${esc(s.code)}</strong>${s.offer ? `: your followers get ${esc(s.offer)}` : ''}. A sign-up counts when it uses your code, or comes from your link within ${program().cookieDays} days.</p></div>` : ''}
<div class="crs-tiles">${tile(T.clicks.toLocaleString(), 'Link visits', `${T.clicksMonth} this month`)}${tile(T.signups, 'Sign-ups', `${T.paying} paying now`)}${tile(usd(T.owed), 'To be paid to you', `${usd(T.pending)} on hold, confirmed after ${s.holdDays} days`)}${tile(usd(T.paid), 'Paid to you so far', `${usd(T.earned + T.pending)} earned in all`)}</div>
<div class="crs-card"><h2>What you earn</h2><p style="margin:0">${esc(s.terms)}. Each amount is on hold for ${s.holdDays} days and is confirmed if the business is still paying then.</p></div>
<div class="crs-card"><h2>How we pay you</h2><form id="crsPay" class="crs-pay"><p style="margin:0 0 10px">${s.payTo ? `Right now: <strong>${esc(s.payTo)}</strong>${/^(Bank transfer|Check)$/.test(s.payTo) ? '. We’ll email you for the details before your first payout.' : ''}` : 'Tell us how you’d like to be paid. We pay confirmed amounts every month.'}</p>
<select name="method" aria-label="How to pay you">${PAY_METHODS.map((m) => `<option ${String(s.payTo).startsWith(m) ? 'selected' : ''}>${m}</option>`).join('')}</select><input name="handle" maxlength="150" aria-label="Your payout details" placeholder="Email, phone or username" value="${esc(s.payTo.includes(': ') ? s.payTo.split(': ').slice(1).join(': ') : '')}"><button class="btn" type="submit">Save</button><span class="crs-note" id="crsPayMsg" role="status"></span></form>
${s.w9 ? '' : `<form id="crsTax" class="crs-pay" style="margin-top:14px"><p style="margin:0"><strong>We need your tax form before your first payout.</strong> <span class="crs-note">In the US, a <a href="https://www.irs.gov/pub/irs-pdf/fw9.pdf" target="_blank" rel="noopener">W-9</a>; outside the US, a <a href="https://www.irs.gov/pub/irs-pdf/fw8ben.pdf" target="_blank" rel="noopener">W-8BEN</a>. Fill it in and attach it as a PDF or photo. Only our team can see it.</span></p><select name="usBased" aria-label="Where you’re based"><option value="yes">US: W-9</option><option value="no">Outside the US: W-8BEN</option></select><input type="file" name="file" accept="application/pdf,image/png,image/jpeg" aria-label="Your tax form" style="height:auto;padding:8px"><button class="btn" type="submit">Send</button><span class="crs-note" id="crsTaxMsg" role="status"></span></form>`}</div>
<div class="crs-card"><h2>Your sign-ups</h2>${s.referrals.length ? `<div style="overflow-x:auto"><table><thead><tr><th>#</th><th>Signed up</th><th>How</th><th>Status</th><th>Earned</th></tr></thead><tbody>${s.referrals.map((r) => `<tr><td>${r.n}</td><td>${day(r.signedUpAt)}</td><td>${r.via === 'code' ? 'Your code' : 'Your link'}</td><td>${STATUS[r.status][0]}</td><td>${usd(r.earned)}</td></tr>`).join('')}</tbody></table></div><p class="crs-note">Business names stay private.</p>` : '<p class="crs-note" style="margin:0">None yet. They show up here as soon as someone signs up with your link or code.</p>'}</div>
${s.payouts.length ? `<div class="crs-card"><h2>Payouts</h2><table><thead><tr><th>Date</th><th>Amount</th><th>Paid by</th></tr></thead><tbody>${s.payouts.map((x) => `<tr><td>${day(x.at)}</td><td>${usd(x.amount)}</td><td>${esc(x.method || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}
<div class="crs-card"><h2>Video ideas that work</h2><div class="crs-ideas">${ideas.map(([t, d]) => `<div><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div></div>
<div class="crs-card crs-warn"><h2>Say it’s a paid partnership</h2><p style="margin:0">Whenever you mention ${esc(product)}, use your network’s “Paid partnership” label or say #ad. The FTC requires it, and your followers trust you more for it.</p></div>
<p class="crs-note">Keep this page’s address to yourself, since anyone with it can see your numbers. Questions? ${P().settings.contactEmail ? `Email <a href="mailto:${esc(P().settings.contactEmail)}">${esc(P().settings.contactEmail)}</a>.` : 'Reply to your welcome email.'}</p>
</main><script>(function(){var f=document.getElementById('crsPay'),m=document.getElementById('crsPayMsg');function sync(){var off=/^(Bank transfer|Check)$/.test(f.method.value);f.handle.style.display=off?'none':'';f.handle.placeholder=f.method.value==='PayPal'?'Your PayPal email':f.method.value==='Zelle'?'Email or phone for Zelle':'Your username'}f.method.addEventListener('change',sync);sync();
var tf=document.getElementById('crsTax');if(tf)tf.addEventListener('submit',function(e){e.preventDefault();var tm=document.getElementById('crsTaxMsg'),file=tf.file.files[0];if(!file){tm.textContent='Choose the file first';return}if(file.size>8388608){tm.textContent='Attach a file under 8 MB';return}tm.textContent='Sending…';var rd=new FileReader();rd.onload=function(){fetch('/api/site/partner-tax/${token}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usBased:tf.usBased.value,taxForm:rd.result,taxFormName:file.name})}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'That didn’t send');location.reload()})}).catch(function(x){tm.textContent=x.message})};rd.readAsDataURL(file)});
f.addEventListener('submit',function(e){e.preventDefault();m.textContent='Saving…';fetch('/api/site/partner-pay/${token}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:f.method.value,handle:f.handle.value})}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'That didn’t save');location.reload()})}).catch(function(x){m.textContent=x.message})})})()</script></body></html>`;
}
// the /partners page's numbers
function publicTerms() { const p = program(); return { enabled: p.enabled, flat: p.flat, percent: p.percent, months: p.months, holdDays: p.holdDays, terms: termsText(p), offer: offerSummary(p.offer), pitch: p.pitch }; }

module.exports = { init, program, click, signedUp, refresh, apply, create, update, approve, remove, setPayTo, taxFormFile, setTaxFormById, setTaxFormByToken, emailStats, requestStats, addPayout, removePayout, saveProgram, adminView, statsFor, statsPage, publicTerms, welcomeText, usd };
