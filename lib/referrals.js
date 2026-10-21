// The referral program (set up in Alpha → Promotions): businesses invite other businesses to sign up.
// - Each account has a referral link (/pricing?ref=<code>); invites by email carry the same link.
// - The friend gets the program's discount code applied at sign-up (a code from Alpha → Promotions → Discount codes).
// - When the friend becomes a paying customer, the referrer earns free months: with Stripe, their next renewal moves out
//   by that many months (the subscription's trial_end); without a subscription yet, the months wait and start when they subscribe.
// - Milestones (e.g. a $100 prepaid card at 3 paying referrals) are prizes the platform owner sends; Alpha lists who's due one.
const crypto = require('crypto');
const tenancy = require('./tenancy');
const stripe = require('./stripe');

const P = () => tenancy.platform();
let h = {}; // helpers from server.js: sendTemplate(key, to, vars, opts), ownerOf(t) -> { name, email }, tellPlatform(title, message)
const init = (helpers) => { h = helpers; };
const id = () => crypto.randomBytes(5).toString('hex');
const now = () => new Date().toISOString();
const normEmail = (s) => String(s || '').trim().toLowerCase();
const DEFAULTS = {
  enabled: false, title: 'Refer and get rewarded', intro: 'Get {{months}} months of credit when a business you refer subscribes. Score extra rewards as you refer more friends.',
  months: 3, friendDiscountId: '', friendText: '', heroImage: '', video: { title: '', text: '', url: '' }, milestones: [],
};
const program = () => { const p = { ...DEFAULTS, ...(P().referral || {}) }; p.video = { ...DEFAULTS.video, ...(p.video || {}) }; p.milestones = p.milestones || []; return p; };
const list = () => (P().referrals = P().referrals || []);
const rewards = () => (P().referralRewards = P().referralRewards || []);
const friendDiscount = () => { const p = program(); return p.friendDiscountId ? (P().discounts || []).find((d) => d.id === p.friendDiscountId) : null; };
const fill = (s) => String(s || '').replace(/\{\{\s*months\s*\}\}/g, String(program().months));
// open to an account? not your own account, and only while the program is on
const openTo = (t) => !!(t && program().enabled && !tenancy.isDefault(t));

// each account's own code, made the first time it's needed
function codeOf(t) {
  if (!t.refCode) { do t.refCode = crypto.randomBytes(4).toString('hex'); while (P().tenants.some((x) => x !== t && x.refCode === t.refCode)); tenancy.savePlatform(); }
  return t.refCode;
}
const linkOf = (t) => `${tenancy.platformUrl()}/pricing?ref=${codeOf(t)}`;
const byCode = (code) => (code ? P().tenants.find((t) => t.refCode === String(code).trim().toLowerCase() && openTo(t)) : null);

// ---------- credit (free months) ----------
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const credit = (t) => (t.referralCredit = t.referralCredit || { earned: 0, banked: 0, appliedUntil: '' });
// months still to come: banked months plus the free time already added to the subscription
function remaining(t) {
  const c = credit(t); let m = c.banked || 0;
  if (c.appliedUntil && c.appliedUntil > now().slice(0, 10)) m += Math.max(0, Math.ceil((Date.parse(c.appliedUntil) - Date.now()) / (30.44 * 864e5)));
  return Math.min(m, c.earned || 0);
}
// give months: push the live subscription's next charge out, or bank them for when the account subscribes
async function giveMonths(t, months) {
  const c = credit(t); c.earned = (c.earned || 0) + months; const key = stripe.platformKey(); const subId = t.billing && t.billing.subscriptionId;
  if (key && subId) {
    try {
      const sub = await stripe.request(key, 'GET', `subscriptions/${encodeURIComponent(subId)}`);
      if (!['canceled', 'incomplete_expired'].includes(sub.status)) {
        const end = Math.max(sub.trial_end || 0, sub.current_period_end || (sub.items && sub.items.data[0] && sub.items.data[0].current_period_end) || 0, Math.floor(Date.now() / 1000));
        const until = Math.floor(addMonths(end * 1000, months).getTime() / 1000);
        await stripe.request(key, 'POST', `subscriptions/${encodeURIComponent(subId)}`, { trial_end: String(until), proration_behavior: 'none' });
        c.appliedUntil = new Date(until * 1000).toISOString().slice(0, 10); tenancy.savePlatform(); return 'applied';
      }
    } catch (e) { console.error('Referral credit:', e.message); }
  }
  c.banked = (c.banked || 0) + months; tenancy.savePlatform(); return 'banked';
}
// a new subscription (Account and billing → choose a plan) starts with the banked free months: Checkout params to add
function bankedTrial(t) {
  const c = credit(t); if (!c.banked) return {};
  const until = addMonths(Date.now(), c.banked); const ts = String(Math.floor(until.getTime() / 1000));
  return { 'subscription_data[trial_end]': ts, 'metadata[creditUntil]': until.toISOString().slice(0, 10) };
}
// that subscription went through: the banked months are now on it
function useBanked(t, until) { if (!until) return; const c = credit(t); c.appliedUntil = until; c.banked = 0; tenancy.savePlatform(); }

// ---------- the referral's life: invited → signed up → subscribed ----------
function invite(t, by, { firstName, company, email }) {
  if (!openTo(t)) throw Object.assign(new Error('The referral program isn’t available'), { status: 403 });
  email = normEmail(email); firstName = String(firstName || '').trim().slice(0, 60); company = String(company || '').trim().slice(0, 100);
  if (!firstName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter your friend’s first name and email address'), { status: 400 });
  const own = h.ownerOf(t); if (own && own.email === email) throw Object.assign(new Error('That’s your own email address'), { status: 400 });
  if (P().tenants.some((x) => x.billing && normEmail(x.billing.email) === email)) throw Object.assign(new Error(`${email} already has an account`), { status: 400 });
  const today = now().slice(0, 10); if (list().filter((r) => r.referrerId === t.id && r.invitedAt && r.invitedAt.startsWith(today)).length >= 25) throw Object.assign(new Error('You’ve sent 25 invitations today. Try again tomorrow.'), { status: 429 });
  let r = list().find((x) => x.referrerId === t.id && x.email === email);
  if (r && r.status !== 'invited') throw Object.assign(new Error(`${email} already signed up with your link`), { status: 400 });
  if (!r) { r = { id: id(), referrerId: t.id, email, status: 'invited', via: 'invite' }; list().push(r); }
  Object.assign(r, { name: firstName, company, invitedAt: now(), invitedBy: by.name }); tenancy.savePlatform();
  const d = friendDiscount();
  return h.sendTemplate('referralInvite', email, { friend_name: firstName, referrer_name: by.name, referrer_business: t.name, offer: friendOffer(d), link: linkOf(t) }, { server: true, replyTo: by.email })
    .then((s) => ({ referral: r, emailed: s.status === 'sent', detail: s.detail }));
}
const friendOffer = (d) => program().friendText || (d ? `${d.code}: ${require('./discounts').describe(d)}` : '');
// sign-up with a referral code (lib/platform.js): link the new account to its referrer
function signedUp(t, code) {
  const ref = byCode(code); if (!ref || ref === t) return null;
  const email = normEmail(t.billing && t.billing.email); const own = h.ownerOf(ref); if (own && own.email === email) return null; // no referring yourself
  t.referredBy = ref.id;
  let r = list().find((x) => x.referrerId === ref.id && x.email === email && x.status === 'invited');
  if (!r) { r = { id: id(), referrerId: ref.id, email, name: (t.billing && t.billing.ownerName) || '', company: t.name, via: 'link' }; list().push(r); }
  Object.assign(r, { status: 'signed up', tenantId: t.id, company: t.name, signedUpAt: now() }); tenancy.savePlatform(); return r;
}
// the referred account now pays: reward its referrer (once)
async function paid(t) {
  if (!t.referredBy) return; const r = list().find((x) => x.tenantId === t.id); const ref = P().tenants.find((x) => x.id === t.referredBy);
  if (!r || r.status === 'subscribed' || !ref) return;
  const months = program().months || 0; Object.assign(r, { status: 'subscribed', subscribedAt: now(), creditMonths: months }); tenancy.savePlatform();
  const own = h.ownerOf(ref);
  if (months) { r.credit = await giveMonths(ref, months); tenancy.savePlatform(); if (own) h.sendTemplate('referralCredit', own.email, { name: own.name, friend_business: t.name, months: String(months), total: String(credit(ref).earned), link: `${tenancy.tenantUrl(ref)}/rewards` }, { server: true }).catch(() => {}); }
  // milestones reached with this one
  const count = list().filter((x) => x.referrerId === ref.id && x.status === 'subscribed').length;
  for (const m of program().milestones) {
    if (count < m.count || rewards().some((w) => w.tenantId === ref.id && w.milestoneId === m.id)) continue;
    rewards().push({ id: id(), tenantId: ref.id, business: ref.name, milestoneId: m.id, title: m.title, count: m.count, at: now(), status: 'to send' }); tenancy.savePlatform();
    if (own) h.sendTemplate('referralMilestone', own.email, { name: own.name, reward: m.title, count: String(m.count), link: `${tenancy.tenantUrl(ref)}/rewards` }, { server: true }).catch(() => {});
    h.tellPlatform(`Referral reward to send: ${m.title} for ${ref.name}`, `${ref.name} reached ${m.count} paying referral${m.count === 1 ? '' : 's'} and unlocked “${m.title}”. Mark it as sent in Alpha → Promotions → Referral activity once it’s on its way.`);
  }
}

// ---------- what pages show ----------
// the business's Refer & earn page
function pageFor(t) {
  const p = program(); const mine = list().filter((r) => r.referrerId === t.id).sort((a, b) => ((b.invitedAt || b.signedUpAt) > (a.invitedAt || a.signedUpAt) ? 1 : -1));
  const subscribed = mine.filter((r) => r.status === 'subscribed').length; const c = credit(t); const d = friendDiscount();
  return { title: p.title, intro: fill(p.intro), months: p.months, friendOffer: friendOffer(d), heroImage: p.heroImage, video: p.video.url ? p.video : null, link: linkOf(t),
    milestones: p.milestones.map((m) => ({ ...m, done: subscribed >= m.count, reward: rewards().find((w) => w.tenantId === t.id && w.milestoneId === m.id) || null })),
    stats: { sent: mine.filter((r) => r.invitedAt).length, signedUp: mine.filter((r) => r.status !== 'invited').length, subscribed, earned: c.earned || 0, remaining: remaining(t), banked: c.banked || 0 },
    referrals: mine.map(({ name, company, email, status, invitedAt, signedUpAt, subscribedAt, via }) => ({ name, company, email, status, via, date: invitedAt || signedUpAt, signedUpAt, subscribedAt })) };
}
// the pricing page, opened from a referral link: who invited them and their offer
function landing(code) { const ref = byCode(code); if (!ref) return null; const d = friendDiscount(); return { business: ref.name, offer: friendOffer(d), code: d && d.active !== false ? d.code : '' }; }
// Alpha
function adminView() {
  const name = (tid) => (P().tenants.find((t) => t.id === tid) || {}).name || 'Deleted account';
  return { program: program(), referrals: list().slice().reverse().map((r) => ({ ...r, referrer: name(r.referrerId) })), rewards: rewards().slice().reverse(),
    leaders: P().tenants.filter((t) => t.referralCredit && t.referralCredit.earned).map((t) => ({ name: t.name, earned: t.referralCredit.earned, remaining: remaining(t) })) };
}
function saveProgram(b) {
  const str = (v, n) => String(v ?? '').trim().slice(0, n); const cur = program();
  const months = Math.floor(Number(b.months)); if (!(months >= 0 && months <= 24)) throw Object.assign(new Error('Set the months of credit from 0 to 24'), { status: 400 });
  if (b.friendDiscountId && !(P().discounts || []).some((d) => d.id === b.friendDiscountId)) throw Object.assign(new Error('Choose one of your discount codes for friends'), { status: 400 });
  const url = str(b.videoUrl, 300); if (url && !/^https:\/\//i.test(url)) throw Object.assign(new Error('Use a video link that starts with https://'), { status: 400 });
  const milestones = (Array.isArray(b.milestones) ? b.milestones : []).map((m) => ({ id: m.id || id(), title: str(m.title, 80), desc: str(m.desc, 300), count: Math.floor(Number(m.count)), image: /^\/brand\/media-\d+\.(png|jpg|gif|webp)$/.test(m.image || '') ? m.image : '' }));
  for (const m of milestones) { if (!m.title) throw Object.assign(new Error('Give every milestone a reward name'), { status: 400 }); if (!(m.count >= 1 && m.count <= 1000)) throw Object.assign(new Error(`Set how many referrals “${m.title}” needs (1 or more)`), { status: 400 }); }
  milestones.sort((a, b) => a.count - b.count);
  P().referral = { enabled: b.enabled === true || b.enabled === 'on', title: str(b.title, 80) || DEFAULTS.title, intro: str(b.intro, 400), months, friendDiscountId: str(b.friendDiscountId, 20), friendText: str(b.friendText, 200),
    heroImage: /^\/brand\/media-\d+\.(png|jpg|gif|webp)$/.test(b.heroImage || '') ? b.heroImage : '', video: { title: str(b.videoTitle, 80), text: str(b.videoText, 300), url }, milestones };
  tenancy.savePlatform(); return cur;
}
function markReward(rid, status) { const w = rewards().find((x) => x.id === rid); if (!w) throw Object.assign(new Error('Reward not found'), { status: 404 }); w.status = status === 'sent' ? 'sent' : 'to send'; w.sentAt = w.status === 'sent' ? now() : ''; tenancy.savePlatform(); }

module.exports = { init, program, openTo, codeOf, linkOf, invite, signedUp, paid, bankedTrial, useBanked, pageFor, landing, adminView, saveProgram, markReward };
