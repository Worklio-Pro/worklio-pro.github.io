// The platform side: your console for accounts, plans and features (Alpha, at /alpha), and the public pricing + sign-up page.
// Served on PLATFORM_DOMAIN itself (and www.), or on any address while PLATFORM_DOMAIN is unset (local development).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('./mini-express');
const tenancy = require('./tenancy');
const stripe = require('./stripe');
const support = require('./support');
const helpStore = require('./help-store');
const emails = require('./emails');
const brandLib = require('./brand');
const discounts = require('./discounts');
const referrals = require('./referrals');
const partners = require('./partners');
const maintenance = require('./maintenance');
const marketplace = require('./marketplace');
const social = require('./social');
const tiktok = require('./tiktok');
const networks = require('./networks');
const accounting = require('./accounting');
const chat = require('./chat');
const legal = require('./legal');
const iconsLib = require('./icons');
const automations = require('./automations');
const forum = require('./forum');
const industries = require('./industries');
const features = require('./features');
const supporters = require('./supporters');
const seo = require('./seo');
const retention = require('./retention');

module.exports = function platformApp(h) {
  // h: helpers from server.js: hashPassword, checkPassword, sha, normEmail, cookies, tooMany, recordFailure, clearFailures, createOwner, ownerLink, tenantStats, sendEmail, sendSms, emailProvider,
  // applyStripeSession, syncStripeAccount, resetDemo (each runs inside an account)
  const app = express();
  const PUB = path.join(__dirname, '..', 'public');
  const P = () => tenancy.platform();
  const secure = /^https:/.test(process.env.BASE_URL || '') ? '; Secure' : '';
  app.use(express.json({ limit: '4mb' })); // room for an image upload (referral program pictures)

  // ---------- pages ----------
  app.get('/alpha', (req, res) => res.sendFile(path.join(PUB, 'platform.html')));
  app.get('/alpha/*', (req, res) => res.sendFile(path.join(PUB, 'platform.html')));
  const oldAddress = (req, res) => res.redirect(301, '/alpha'); // the console's old address
  app.get('/platform', oldAddress); app.get('/platform/*', oldAddress);
  const noIcon = (req, res) => res.status(404).end(); // no app icon uploaded (server.js serves it when there is one)
  app.get('/favicon.ico', noIcon); app.get('/apple-touch-icon.png', noIcon);
  // the public pages get the Features menu (lib/features.js), the Industries menu (and the home page its trades strip) from lib/industries.js, the Founding Supporters link while that list is on,
  // and their title, description, share tags and structured data from lib/seo.js (Alpha → Settings → SEO)
  const withIndustries = (file, page) => (req, res) => res.send(page(features.fill(fs.readFileSync(path.join(PUB, file), 'utf8')).replace('<!--industries-menu-->', industries.menu()).replace('<!--legal-owner-->', legal.owner()).replace('<!--industries-strip-->', industries.strip()).replace('<!--supporters-link-->', supporters.footerLink())));
  const site = withIndustries('site.html', seo.pricingPage); // /signup is the same page, so both point search engines at /pricing
  app.get('/pricing', site); app.get('/signup', site);
  // the guest home page (features); while developing (no PLATFORM_DOMAIN) it's at /home, since / is the account app
  const home = withIndustries('home.html', seo.homePage);
  if (tenancy.devMode) app.get('/home', home);
  else { app.get('/', home); app.get('/home', (req, res) => res.redirect(301, '/')); } // one address for the home page
  // one page per industry, and the list of them
  // the features page: the 15 main features with screenshots
  app.get('/features', withIndustries('features.html', seo.featuresPage));
  app.get('/marketing', withIndustries('marketing.html', seo.marketingPage)); // Every job markets itself
  // creator partners (lib/partners.js; Alpha → Pricing → Creator partners): the page creators apply on (while the program is on), each creator's stats page, and their tracked link
  const partnersPage = withIndustries('partners.html', seo.partnersPage);
  app.get('/partners', (req, res) => (partners.program().enabled ? partnersPage(req, res) : res.redirect(tenancy.devMode ? '/home' : '/')));
  app.get('/partners/:token', (req, res) => { const html = partners.statsPage(req.params.token); if (!html) return res.status(404).send('<!doctype html><meta charset="utf-8"><title>Not found</title><p style="font:16px system-ui;padding:40px">This page isn’t available. Check the link in your welcome email.</p>'); res.send(html); });
  app.get('/go/:code', (req, res) => { const c = partners.click(req.params.code, req.socket.remoteAddress); if (!c) return res.redirect('/pricing'); res.setHeader('Set-Cookie', c.cookie); res.redirect(c.to); });
  app.get('/quote-from-photos', withIndustries('quote-from-photos.html', seo.snapQuotePage)); // Snap to quote
  app.get('/industries', (req, res) => res.send(industries.indexPage()));
  app.get('/industries/:slug', (req, res) => { const html = industries.page(req.params.slug); if (!html) return res.redirect('/industries'); res.send(html); });
  // the Founding Supporters page (lib/supporters.js; Alpha → Pricing); off or empty, it goes to the home page
  app.get('/supporters', (req, res) => { const html = supporters.page(); if (!html) return res.redirect(tenancy.devMode ? '/home' : '/'); res.send(html); });

  // ---------- public: plans for the pricing page, sign-up ----------
  // a sale that's on now: the sale price per period (only where it's below the regular one) and its last day
  const publicSale = (p) => { if (!stripe.saleOn(p)) return null; const v = (s, r) => (Number(s) > 0 && Number(r) > 0 && Number(s) < Number(r) ? Number(s) : null);
    const m = v(p.saleMonthly, p.monthly); const y = v(p.saleYearly, p.yearly); return m || y ? { monthly: m, yearly: y, ends: p.saleEnds || null, name: p.saleName || '' } : null; };
  const publicPlan = (p) => ({ id: p.id, name: p.name, price: p.price, monthly: Number(p.monthly) > 0 ? Number(p.monthly) : null, yearly: Number(p.yearly) > 0 ? Number(p.yearly) : null, priceLabel: p.priceLabel || '', sale: publicSale(p), description: p.description, maxUsers: p.maxUsers || 0, extraUser: p.maxUsers > 0 && Number(p.extraUser) > 0 ? Number(p.extraUser) : null, smsLimit: Number(p.smsLimit) || 0, features: [...tenancy.usableFeatures(p.features)] });
  const periodOf = (v) => (v === 'year' ? 'year' : 'month');
  const catalog = () => tenancy.FEATURES.map(({ key, group, label, desc, needs }) => ({ key, group, label, desc, needs, beta: tenancy.isBeta(key) }));
  app.get('/api/site', (req, res) => {
    const s = P().settings;
    res.json({ productName: s.productName, brand: brandLib.brand(), contactEmail: s.contactEmail, allowSignups: !!s.allowSignups, signupPlan: s.signupPlan, popularPlan: s.popularPlan || '', plans: P().plans.filter((p) => !p.hidden).map((p) => ({ ...publicPlan(p), paid: !!planCharge(p) })), features: catalog(), alwaysIncluded: tenancy.ALWAYS_INCLUDED, rootDomain: tenancy.ROOT_DOMAIN, home: tenancy.devMode ? '/home' : '/', industries: industries.CHOICES, trialPlan: SITE_TRIAL.planId, trialCode: siteTrial({ planId: SITE_TRIAL.planId, interval: 'month' }).code });
  });
  app.get('/api/site/partners', (req, res) => res.json(partners.publicTerms()));
  app.post('/api/site/partner-stats-link', async (req, res) => { try { await partners.requestStats((req.body || {}).email, req.socket.remoteAddress); res.json({ ok: true }); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } }); // "Already a partner?" on /partners
  app.post('/api/site/partner-apply', (req, res) => { try { partners.apply(req.body || {}, req.socket.remoteAddress); res.json({ ok: true }); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  app.get('/api/site/ref/:code', (req, res) => { const l = referrals.landing(req.params.code); if (!l) return res.status(404).json({ error: 'Referral link not found' }); res.json(l); });
  // sign-up's web address: a taken or reserved one is just "<address> is not available" (no hint about who has it or why)
  const signupSlugProblem = (slug) => { const bad = tenancy.slugProblem(slug); return bad && tenancy.SLUG_RE.test(slug) ? `${slug}.${tenancy.ROOT_DOMAIN} is not available` : bad; };
  app.get('/api/site/slug-check', (req, res) => { const slug = String(req.query.slug || '').toLowerCase(); const bad = signupSlugProblem(slug); res.json({ ok: !bad, error: bad || null }); });
  // for an HTTPS proxy that issues certificates on demand (e.g. Caddy's on_demand_tls "ask"): 200 only for addresses we serve
  app.get('/api/site/domain-allowed', (req, res) => {
    const r = tenancy.resolve(String(req.query.domain || ''));
    if ((r.kind === 'tenant' && !r.dev) || r.kind === 'platform') return res.json({ ok: true });
    res.status(404).json({ ok: false });
  });
  // "Contact us" on the pricing page: saved for the platform console (Messages → Contact requests) and emailed to the contact address
  const contactHits = new Map(); // ip -> timestamps: 5 messages per hour per address
  app.post('/api/site/contact', async (req, res) => {
    const b = req.body || {}; if (b.website) return res.json({ ok: true }); // hidden field only bots fill in
    const ip = req.socket.remoteAddress; const now = Date.now(); const hits = (contactHits.get(ip) || []).filter((t) => now - t < 3600e3);
    if (hits.length >= 5) return res.status(429).json({ error: 'Too many messages from this connection. Try again later.' });
    const str = (k, n) => String(b[k] || '').trim().slice(0, n);
    const m = { id: crypto.randomBytes(6).toString('hex'), at: new Date().toISOString(), name: str('name', 100), email: h.normEmail(b.email).slice(0, 200), phone: str('phone', 40), company: str('company', 100), message: str('message', 4000) };
    const plan = P().plans.find((p) => p.id === b.plan && !p.hidden); m.plan = plan ? plan.name : '';
    if (!m.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) return res.status(400).json({ error: 'Enter your name and a valid email address' });
    if (!m.message) return res.status(400).json({ error: 'Write a short message' });
    hits.push(now); contactHits.set(ip, hits);
    P().inquiries.unshift(m); P().inquiries.length = Math.min(P().inquiries.length, 500); tenancy.savePlatform();
    const to = P().settings.contactEmail;
    if (to) {
      const details = emails.details([['Name', m.name], ['Email', m.email], ['Phone', m.phone], ['Business', m.company], ['Interested in', m.plan]]);
      const sent = await tenancy.run(defaultTenant(), () => h.sendTemplate('contactRequest', to, { name: m.name, details, message: m.message }, { server: true, replyTo: m.email })).catch((e) => ({ status: 'failed', detail: e.message }));
      m.emailed = sent.status === 'sent'; tenancy.savePlatform();
    }
    res.json({ ok: true });
  });
  const codeHits = new Map(); // ip -> timestamps: 30 code checks per 10 minutes, so codes can't be guessed
  // one login for every business (h.loginsFor in server.js): email and password find the business, or a list to choose from when the email is in several.
  // The same page as an account's login (login.html); data-central switches it to this mode. The phone app opens here too.
  app.get('/sign-in', (req, res) => res.send(fs.readFileSync(path.join(PUB, 'login.html'), 'utf8').replace('<body>', '<body data-central>')));
  app.get('/login', (req, res) => res.redirect('/sign-in'));
  app.get('/api/site/sign-in', (req, res) => res.json({ product: brandLib.brand(), emailReady: !!h.emailProvider() }));
  app.post('/api/site/sign-in', (req, res) => {
    const b = req.body || {}; const email = h.normEmail(b.email); const key = 'central|' + email + '|' + req.socket.remoteAddress;
    if (h.tooMany(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes or reset your password.' });
    const pw = String(b.password || '');
    const ok = h.loginsFor(email).filter((x) => x.active && h.checkPassword(pw, x.user)); // each business keeps its own password, so only the ones it matches
    if (!ok.length) { h.recordFailure(key); return res.status(401).json({ error: 'That email and password don’t match an account' }); }
    h.clearFailures(key);
    const pick = b.account ? ok.find((x) => x.t.id === b.account) : ok.length === 1 ? ok[0] : null;
    if (pick) return res.json({ url: h.handoffUrl(pick.t, pick.user, b.next) });
    res.json({ accounts: ok.map((x) => ({ id: x.t.id, name: x.business, address: tenancy.tenantUrl(x.t).replace(/^https?:\/\//, '') })).sort((a, c) => a.name.localeCompare(c.name)) });
  });
  // forgot password without knowing the business: a reset email from each business the email has a login in. Always answers the same.
  app.post('/api/site/forgot', async (req, res) => {
    const email = h.normEmail(req.body && req.body.email); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter your email address' });
    if (hit('site-ip|' + req.socket.remoteAddress, 10, 3600e3) || hit('site-em|' + email, 3, 15 * 60e3)) return res.status(429).json({ error: 'Too many emails requested. Wait 15 minutes and try again.' });
    for (const x of h.loginsFor(email).filter((y) => y.active)) await tenancy.run(x.t, () => h.sendPasswordReset(x.user)).catch((e) => console.error('reset email:', e.message));
    res.json({ ok: true });
  });
  // one email, one business: a new account can't use an email that already logs in somewhere (someone on two teams is invited, and picks the business at /sign-in).
  // An unpaid sign-up doesn't count once it's left: signing up again replaces it, unless its Stripe checkout started in the last day (it could still be paid).
  const RECENT_CHECKOUT = 24 * 3600e3;
  const unpaid = (t) => t.status === 'pending' && t.billing && t.billing.status === 'pending';
  const checkoutLive = (t) => !!t.billing.checkoutStartedAt && Date.now() - Date.parse(t.billing.checkoutStartedAt) < RECENT_CHECKOUT;
  const emailInUse = (email) => h.loginsFor(email).find((x) => !unpaid(x.t) || checkoutLive(x.t));
  app.post('/api/site/discount-check', (req, res) => {
    const ip = req.socket.remoteAddress; const now = Date.now(); const hits = (codeHits.get(ip) || []).filter((t) => now - t < 600e3);
    if (hits.length >= 30) return res.status(429).json({ error: 'Too many tries. Wait a few minutes and try again.' }); hits.push(now); codeHits.set(ip, hits);
    const b = req.body || {};
    const sup = supporters.check(b.code); // a Founding Supporter code: its tier's plan, prepaid, whichever plan is chosen
    if (sup) return res.status(sup.error ? 400 : 200).json(sup.error ? { error: sup.error } : { ok: true, code: sup.p.code.code, summary: sup.summary, trial: true, prepaid: true, planId: sup.plan.id, plan: sup.plan.name, months: sup.months, endsAt: supporters.prepaidEnd(new Date().toISOString().slice(0, 10), sup.months) });
    const plan = P().plans.find((p) => p.id === (discounts.planFor(b.code) || b.plan) && !p.hidden); const c = plan && planCharge(plan, periodOf(b.interval));
    if (!c) return res.status(400).json({ error: 'Discount codes apply to paid plans' });
    const r = discounts.check(b.code, { planId: plan.id, interval: c.interval, email: h.normEmail(b.email) });
    res.status(r.error ? 400 : 200).json(r.error ? { error: r.error } : { ok: true, planId: plan.id, ...discounts.priced(r.d, c.cents) }); // planId: the plan the code picked, for the form
  });
  const SITE_TRIAL = { id: '', code: '', type: 'trial', trialDays: 30, planId: 'expert' }; // the home page's trial: like a trial code, without a code, for Unlimited
  // ...and with the TRIAL26 code applied when it can be (active, a free-trial code, works with Unlimited), so it's counted in Alpha → Discounts
  const siteTrial = (ctx) => { const r = discounts.check('TRIAL26', ctx); return r.d && r.d.type === 'trial' ? r.d : SITE_TRIAL; };
  const signupHits = new Map(); // ip -> timestamps: 5 sign-ups per hour per address
  app.post('/api/site/signup', async (req, res) => {
    const s = P().settings; if (!s.allowSignups) return res.status(403).json({ error: 'Sign-ups are closed. Contact us to get an account.' });
    const ip = req.socket.remoteAddress; const now = Date.now(); const hits = (signupHits.get(ip) || []).filter((t) => now - t < 3600e3);
    if (hits.length >= 5) return res.status(429).json({ error: 'Too many sign-ups from this connection. Try again later.' });
    const b = req.body || {}; const company = String(b.company || '').trim().slice(0, 100); const slug = String(b.slug || '').trim().toLowerCase();
    const name = String(b.name || '').trim().slice(0, 100); const email = h.normEmail(b.email); const password = String(b.password || '');
    if (!company) return res.status(400).json({ error: 'Enter your business name' });
    const industry = industries.choose(b.industry, b.industryOther); if (industry.error) return res.status(400).json({ error: industry.error });
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter your name and a valid email address' });
    const taken = emailInUse(email);
    if (taken) return res.status(409).json({ error: unpaid(taken.t) ? 'You started paying for an account with this email in the last day. Finish on the Stripe page, or sign up again tomorrow.' : `That email already has a ${s.productName} login. Log in instead, or use a different email.`, signIn: !unpaid(taken.t) });
    for (const x of h.loginsFor(email)) if (unpaid(x.t)) tenancy.deleteTenant(x.t); // left at checkout: replaced by this sign-up (a copy stays in data/deleted/), so its address can be picked again
    const bad = signupSlugProblem(slug); if (bad) return res.status(400).json({ error: bad });
    if (password.length < 8) return res.status(400).json({ error: 'Use a password with at least 8 characters' });
    const sup = supporters.check(b.code); if (sup && sup.error) return res.status(400).json({ error: sup.error }); // a Founding Supporter code decides the plan
    const open = P().plans.filter((p) => !p.hidden); const plan = sup ? sup.plan : open.find((p) => p.id === (b.trial && open.some((x) => x.id === SITE_TRIAL.planId) ? SITE_TRIAL.planId : discounts.planFor(b.code) || b.plan)) || open.find((p) => p.id === s.signupPlan) || open[0];
    if (!plan) return res.status(400).json({ error: 'Sign-ups are closed right now' });
    const paid = planCharge(plan, periodOf(b.interval)); let disc = null; // a discount code only matters for a paid plan
    if (paid && !sup && b.trial) disc = siteTrial({ planId: plan.id, interval: paid.interval, email }); // "Start 30-day trial" on the home page: Unlimited free for 30 days with TRIAL26, no card
    else if (paid && !sup && String(b.code || '').trim()) { const r = discounts.check(b.code, { planId: plan.id, interval: paid.interval, email }); if (r.error) return res.status(400).json({ error: r.error }); disc = r.d; }
    else if (paid && !sup && b.ref) { const l = referrals.landing(b.ref); const r = l && l.code ? discounts.check(l.code, { planId: plan.id, interval: paid.interval, email }) : null; if (r && r.d) disc = r.d; } // the referral offer, when it fits
    hits.push(now); signupHits.set(ip, hits);
    const t = tenancy.createTenant({ name: company, slug, planId: plan.id, demo: false });
    tenancy.run(t, () => { h.createOwner(t, { name, email, password }); h.setCompanyEmail(email); h.setCompanyIndustry(industry); h.setCompanyPhone(String(b.phone || '').trim().slice(0, 40)); });
    // a paid plan waits at the checkout page until it's paid; a free one starts right away
    const tok = crypto.randomBytes(24).toString('hex');
    const charge = planCharge(plan, periodOf(b.interval));
    t.billing = { tokenHash: h.sha(tok), email, ownerName: name, status: charge ? 'pending' : 'free', interval: charge ? charge.interval : periodOf(b.interval), createdAt: new Date().toISOString(), ...(disc && disc.id ? { discount: { id: disc.id, code: disc.code } } : {}) };
    if (b.ref) referrals.signedUp(t, b.ref); // came from another business's referral link
    partners.signedUp(t, { discountId: disc && disc.id, cookie: req.headers.cookie }); // a creator's code or link (lib/partners.js)
    if (charge && disc && disc.type === 'trial') { startTrial(t, disc); return res.status(201).json({ url: loginUrl(t) }); } // a free-trial code: no checkout, no card
    if (sup) { // prepaid months from a supporter code: no checkout, no card
      const until = supporters.startPrepaid(t, sup, new Date().toISOString().slice(0, 10)); t.status = 'active'; supporters.redeemed(t, sup, until); // saves
      supporters.sendThanks(t, email, name, (k, to, v) => tenancy.run(defaultTenant(), () => h.sendTemplate(k, to, v, { server: true }))).catch(() => {}); // the thank-you email with the good news
      notifySignup(t, sup.plan, `Founding Supporter code ${sup.p.code.code}: ${sup.months} months of ${sup.plan.name} prepaid, no card`); return res.status(201).json({ url: loginUrl(t) });
    }
    if (charge) { t.status = 'pending'; tenancy.savePlatform(); return res.status(201).json({ url: `/checkout/${tok}` }); }
    tenancy.savePlatform(); notifySignup(t, plan, 'free plan');
    res.status(201).json({ url: loginUrl(t) });
  });

  // ---------- checkout: paying for the plan of a new sign-up ----------
  // Stripe Checkout in subscription mode, into YOUR Stripe account: BILLING_STRIPE_SECRET_KEY, else STRIPE_SECRET_KEY.
  // Without a key the page runs a demo checkout that starts the account without charging anyone.
  // Payment is confirmed when the customer returns from Stripe and, with BILLING_STRIPE_WEBHOOK_SECRET set, by the webhook at
  // <platform address>/api/site/stripe-webhook, which also pauses an account whose subscription is cancelled or unpaid.
  const billingKey = stripe.platformKey;
  const billingApi = (method, endpoint, params) => stripe.request(billingKey(), method, endpoint, params);
  const planCharge = stripe.planCharge;
  const loginUrl = (t) => `${tenancy.tenantUrl(t)}/login?email=${encodeURIComponent((t.billing && t.billing.email) || '')}`;
  const byToken = (tok) => /^[a-f0-9]{48}$/.test(tok || '') && P().tenants.find((t) => t.billing && t.billing.tokenHash === h.sha(tok));
  // the account is open: the owner confirms their email (then gets the welcome email), and you hear about the sign-up
  function notifySignup(t, plan, how) {
    tenancy.run(t, () => h.sendVerifyEmail(t));
    const s = P().settings; if (!s.contactEmail) return; const b = t.billing || {};
    tenancy.run(t, () => h.sendTemplate('newSignup', s.contactEmail, { owner: b.ownerName, email: b.email, business: t.name, plan: plan.name, how, account_url: tenancy.tenantUrl(t) }, { server: true })).catch(() => {});
  }
  // turn the account on after payment (safe to call more than once)
  function activate(t, info = {}) {
    if (t.billing.status === 'paid') return;
    Object.assign(t.billing, { status: 'paid', paidAt: new Date().toISOString(), ...info });
    t.status = 'active'; discounts.redeem(t); tenancy.savePlatform(); referrals.paid(t).catch(() => {}); // reward whoever referred them
    const plan = tenancy.planOf(t); const code = t.billing.discount ? ` with code ${t.billing.discount.code}` : '';
    notifySignup(t, plan, (info.demo ? 'demo checkout, nothing charged' : `paid ${plan.price} by card`) + code);
  }
  // a free-trial code: the account opens now with no card; its last day of access is the trial's end, then it pauses
  // (the owner adds a card, changes plan or cancels in Account and billing; see /api/account/billing in server.js)
  function startTrial(t, d) {
    const endsAt = discounts.trialEnd(d);
    Object.assign(t.billing, { status: 'trial', ...(d.id ? { discount: { id: d.id, code: d.code } } : {}), trial: { code: d.code, days: d.trialDays, startedAt: new Date().toISOString(), endsAt } });
    t.status = 'active'; t.expiresAt = endsAt; discounts.redeem(t); tenancy.savePlatform();
    notifySignup(t, tenancy.planOf(t), `${d.trialDays}-day free trial ${d.code ? `with code ${d.code}` : 'from the home page'}, no card`);
  }
  function codeFor(t) { // { d } for the account's code if it still applies, else null (and the code is dropped with a note for the page)
    const b = t.billing; if (!b.discount) return null; const c = planCharge(tenancy.planOf(t), b.interval);
    if (!c) { delete b.discount; tenancy.savePlatform(); return null; } // a free plan has nothing to discount
    const r = discounts.check(b.discount.code, { planId: t.planId, interval: c.interval, email: b.email });
    if (!r.error) return r; b.discountNote = `Code ${b.discount.code} was removed: ${r.error}`; delete b.discount; tenancy.savePlatform(); return null;
  }
  // Stripe's payment form on the checkout page itself (card and Link): needs a publishable key from the same Stripe account and mode as the billing key
  const billingPubKey = () => { const k = process.env.BILLING_STRIPE_PUBLISHABLE_KEY || P().settings.stripePublishableKey || process.env.STRIPE_PUBLISHABLE_KEY || '';
    return k && billingKey() && (k.startsWith('pk_live_') ? 'live' : 'test') === stripe.modeOf(billingKey()) ? k : ''; };
  const checkoutView = (t) => {
    const plan = tenancy.planOf(t); const c = planCharge(plan, t.billing.interval); const dc = c && codeFor(t); const note = t.billing.discountNote || ''; delete t.billing.discountNote;
    return { interval: c ? c.interval : periodOf(t.billing.interval), company: t.name, address: tenancy.subdomainUrl(t).replace(/^https?:\/\//, ''), email: t.billing.email, status: t.billing.status,
      productName: P().settings.productName, brand: brandLib.brand(), contactEmail: P().settings.contactEmail, live: !!billingKey(), embedded: !!billingPubKey(), testMode: /^(sk|rk)_test_/.test(billingKey()),
      plan: { ...publicPlan(plan), charge: c }, plans: P().plans.filter((p) => !p.hidden || p.id === t.planId).map((p) => (p.id === t.planId ? plan : p)).map((p) => ({ ...publicPlan(p), charge: planCharge(p, t.billing.interval) })), features: catalog(), alwaysIncluded: tenancy.ALWAYS_INCLUDED,
      loginUrl: t.billing.status === 'pending' ? null : loginUrl(t), trialEndsAt: t.billing.status === 'trial' ? t.expiresAt || null : null, discount: dc ? discounts.priced(dc.d, c.cents) : null, discountNote: note };
  };
  app.get('/checkout/:token', (req, res) => res.sendFile(path.join(PUB, 'checkout.html')));
  app.get('/api/site/checkout/:token', (req, res) => { const t = byToken(req.params.token); if (!t) return res.status(404).json({ error: 'This checkout link isn’t valid. Sign up again or contact us.' }); res.json(checkoutView(t)); });
  // switch plans before paying; choosing a free plan starts the account straight away
  app.post('/api/site/checkout/:token/plan', (req, res) => {
    const t = byToken(req.params.token); if (!t) return res.status(404).json({ error: 'This checkout link isn’t valid' });
    if (t.billing.status !== 'pending') return res.status(400).json({ error: 'This account is already set up' });
    const plan = P().plans.find((p) => p.id === (req.body && req.body.planId) && (!p.hidden || p.id === t.planId)); if (!plan) return res.status(400).json({ error: 'Choose a plan' });
    t.planId = plan.id; if (req.body.interval) t.billing.interval = periodOf(req.body.interval); // monthly or yearly
    if (!planCharge(plan, t.billing.interval)) { t.billing.status = 'free'; t.status = 'active'; notifySignup(t, plan, 'free plan'); }
    tenancy.savePlatform(); res.json(checkoutView(t));
  });
  // add, change or remove the discount code at checkout ({ code: '' } removes it)
  app.post('/api/site/checkout/:token/code', (req, res) => {
    const t = byToken(req.params.token); if (!t) return res.status(404).json({ error: 'This checkout link isn’t valid' });
    if (t.billing.status !== 'pending') return res.status(400).json({ error: 'This account is already set up' });
    const ip = req.socket.remoteAddress; const now = Date.now(); const hits = (codeHits.get(ip) || []).filter((x) => now - x < 600e3);
    if (hits.length >= 30) return res.status(429).json({ error: 'Too many tries. Wait a few minutes and try again.' }); hits.push(now); codeHits.set(ip, hits);
    const code = String((req.body && req.body.code) || '').trim();
    if (!code) { delete t.billing.discount; tenancy.savePlatform(); return res.json(checkoutView(t)); }
    const planId = discounts.planFor(code) || t.planId; // a code for one plan switches to it
    const c = planCharge(P().plans.find((p) => p.id === planId), t.billing.interval); const r = c ? discounts.check(code, { planId, interval: c.interval, email: t.billing.email }) : { error: 'Discount codes apply to paid plans' };
    if (r.error) return res.status(400).json({ error: r.error }); t.planId = planId;
    if (r.d.type === 'trial') { startTrial(t, r.d); return res.json(checkoutView(t)); } // the account opens right away
    t.billing.discount = { id: r.d.id, code: r.d.code }; tenancy.savePlatform(); res.json(checkoutView(t));
  });
  app.post('/api/site/checkout/:token/pay', async (req, res) => {
    const tok = req.params.token; const t = byToken(tok); if (!t) return res.status(404).json({ error: 'This checkout link isn’t valid' });
    if (t.billing.status !== 'pending') return res.json({ url: loginUrl(t) });
    const plan = tenancy.planOf(t); const c = planCharge(plan, t.billing.interval);
    const hadCode = !!t.billing.discount; const dc = codeFor(t); // checked again: it may have expired or run out since it was added
    if (hadCode && !dc) return res.status(409).json({ error: (t.billing.discountNote || 'Your discount code no longer applies.') + ' Check the new total before paying.', reload: true });
    if (dc && dc.d.type === 'trial') { startTrial(t, dc.d); return res.json({ url: loginUrl(t) }); } // a free-trial code: no Stripe, no card
    if (!billingKey()) { tenancy.lockSale(t, plan.id, stripe.saleLock(plan)); activate(t, { demo: true }); return res.json({ url: loginUrl(t) }); } // demo checkout
    const back = `${tenancy.platformUrl()}/checkout/${tok}`;
    try {
      const p = {
        mode: 'subscription', customer_email: t.billing.email, client_reference_id: t.id, 'metadata[tenantId]': t.id, 'subscription_data[metadata][tenantId]': t.id,
        'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(c.cents),
        'line_items[0][price_data][recurring][interval]': c.interval, 'line_items[0][price_data][product_data][name]': `${P().settings.productName} ${plan.name}`,
        'line_items[0][price_data][product_data][description]': `${t.name} (${tenancy.subdomainUrl(t).replace(/^https?:\/\//, '')})`,
        success_url: `${back}/done?session_id={CHECKOUT_SESSION_ID}`, cancel_url: back, 'payment_method_types[0]': 'card', // and Link (lib/stripe.js)
        ...stripe.saleLockMeta(plan), // a sale price is kept for good once this is paid (applySession → activate); no planId, which marks an Account and Billing checkout
      };
      const pk = req.body && req.body.embedded && billingPubKey(); // the form on this page instead of Stripe's own page
      if (pk) { Object.assign(p, { ui_mode: 'embedded', return_url: p.success_url }); delete p.success_url; delete p.cancel_url; }
      if (t.billing.customerId) { delete p.customer_email; p.customer = t.billing.customerId; }
      if (dc) { p['discounts[0][coupon]'] = await discounts.stripeCoupon(billingKey(), dc.d); if (dc.d.type === 'percent' && dc.d.value === 100 && dc.d.duration === 'forever') p.payment_method_collection = 'if_required'; } // free for good: no card needed
      let s; try { s = await stripe.checkoutSession(billingKey(), p); } catch (e) { // the form on the page didn't work out: Stripe's own page
        if (!pk) throw e; console.error('Embedded checkout failed:', e.message); delete p.ui_mode; delete p.return_url; Object.assign(p, { success_url: `${back}/done?session_id={CHECKOUT_SESSION_ID}`, cancel_url: back }); s = await stripe.checkoutSession(billingKey(), p);
      }
      t.billing.checkoutStartedAt = new Date().toISOString(); tenancy.savePlatform(); // a sign-up with this email can't replace it for a day
      res.json(s.client_secret && s.ui_mode === 'embedded' ? { clientSecret: s.client_secret, publishableKey: pk } : { redirect: s.url });
    } catch (e) { console.error('Billing checkout failed:', e.message); res.status(502).json({ error: 'We couldn’t start the card payment. Try again in a moment.' }); }
  });
  const applySession = (s) => {
    const t = s && s.metadata && P().tenants.find((x) => x.id === s.metadata.tenantId);
    if (!t || !t.billing || s.mode === 'setup' || s.status !== 'complete' || !['paid', 'no_payment_required'].includes(s.payment_status)) return t; // setup = a card update (Account and billing handles it)
    if (s.metadata.planId && P().plans.some((p) => p.id === s.metadata.planId)) { // a plan picked in Account and billing
      referrals.useBanked(t, s.metadata.creditUntil); referrals.paid(t).catch(() => {}); if (t.billing.retention) delete t.billing.retention.pending; // a trial's stay offer is on the subscription now
      t.planId = s.metadata.planId; tenancy.lockSale(t, t.planId, s.metadata); delete t.expiresAt; Object.assign(t.billing, { customerId: s.customer || t.billing.customerId || null, subscriptionId: s.subscription || null, status: 'paid', interval: s.metadata.interval === 'year' ? 'year' : 'month' });
      delete t.billing.pendingPlanId; delete t.billing.endsAt; delete t.billing.demo; if (tenancy.reopenable(t)) { tenancy.resume(t); delete t.billing.trial; } delete t.billing.pausedForBilling; tenancy.savePlatform(); return t;
    }
    tenancy.lockSale(t, t.planId, s.metadata); // paid at a sale price: it's theirs for good
    activate(t, { customerId: s.customer || null, subscriptionId: s.subscription || null, sessionId: s.id }); return t;
  };
  // back from Stripe: check the session with Stripe (never trust the address alone), then off to their login page
  app.get('/checkout/:token/done', async (req, res) => {
    const t = byToken(req.params.token); if (!t) return res.redirect('/pricing');
    const id = String(req.query.session_id || '');
    if (t.billing.status === 'pending' && billingKey() && /^cs_[A-Za-z0-9_]+$/.test(id)) {
      try { const s = await billingApi('GET', 'checkout/sessions/' + encodeURIComponent(id)); if (s.metadata && s.metadata.tenantId === t.id) applySession(s); } catch (e) { console.error('Billing confirm failed:', e.message); }
    }
    res.redirect(t.billing.status === 'pending' ? `/checkout/${req.params.token}?unpaid=1` : loginUrl(t));
  });
  app.post('/api/site/stripe-webhook', (req, res) => {
    const secret = process.env.BILLING_STRIPE_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: 'Webhook not configured' });
    if (!stripe.signatureOk(req._raw || '', req.headers['stripe-signature'], secret)) return res.status(400).json({ error: 'Invalid signature' });
    const ev = req.body || {}; const o = (ev.data && ev.data.object) || {};
    if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') applySession(o);
    if (ev.type === 'customer.subscription.updated' || ev.type === 'customer.subscription.deleted') {
      // pause an account whose subscription ends or goes unpaid; resume it if billing paused it and it's paid up again
      const t = P().tenants.find((x) => x.billing && x.billing.subscriptionId === o.id);
      if (t && !tenancy.isDefault(t) && ev.type === 'customer.subscription.deleted') tenancy.endSubscription(t); // switches to a picked free plan, or pauses
      else if (t && !tenancy.isDefault(t)) {
        const off = ['canceled', 'unpaid', 'incomplete_expired'].includes(o.status);
        if (off && t.status === 'active') tenancy.pause(t, 'billing');
        else if (!off && o.status === 'active' && tenancy.pauseReason(t) === 'billing') tenancy.resume(t);
        t.billing.subscriptionStatus = o.status; tenancy.savePlatform();
      }
    }
    res.json({ received: true });
  });
  // Stripe Connect: events from businesses' connected Stripe accounts (a "Connected accounts" webhook endpoint in your Stripe dashboard)
  app.post('/api/site/stripe-connect-webhook', (req, res) => {
    const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: 'Webhook not configured' });
    if (!stripe.signatureOk(req._raw || '', req.headers['stripe-signature'], secret)) return res.status(400).json({ error: 'Invalid signature' });
    const ev = req.body || {}; const t = ev.account && P().tenants.find((x) => x.stripeAccountId === ev.account);
    if (t) {
      const o = (ev.data && ev.data.object) || {};
      if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') tenancy.run(t, () => h.applyStripeSession(o));
      if (ev.type === 'account.updated') tenancy.run(t, () => h.syncStripeAccount()).catch(() => {});
    }
    res.json({ received: true });
  });

  // ---------- Stripe's emails to businesses set up in the app ("Site links" in Stripe's Connect settings) ----------
  // Stripe adds ?stripe_account_id=acct_…; send the business to the right page of its own account (it logs in there if needed)
  const STRIPE_GO = { account: '/settings/card-payments', documents: '/settings/card-payments', payments: '/payments', payouts: '/payments', balances: '/payments' };
  app.get('/stripe/go/:where', (req, res) => {
    const path = STRIPE_GO[req.params.where]; const id = String(req.query.stripe_account_id || '');
    const t = path && /^acct_[A-Za-z0-9]+$/.test(id) && P().tenants.find((x) => x.stripeAccountId === id);
    res.redirect(t ? tenancy.tenantUrl(t) + path : '/');
  });

  // ---------- chat (lib/chat.js): emails you when someone asks for a person, and the visitor when you reply after they've left ----------
  chat.init({ notify: (kind, c, text) => {
    const run = (key, to, vars, opts) => tenancy.run(defaultTenant(), () => h.sendTemplate(key, to, vars, { server: true, ...opts })).catch((e) => console.error('chat email:', e.message));
    if (kind === 'waiting' && P().settings.contactEmail) {
      const convo = c.messages.filter((m) => m.from !== 'system').slice(-8).map((m) => `${m.from === 'visitor' ? (c.name || 'Visitor') : 'Bot'}: ${m.file ? `[file: ${m.file.name}]` : m.text}`).join('\n');
      run('chatWaiting', P().settings.contactEmail, { name: c.name || 'A visitor', details: emails.details([['Email', c.email], ['Business', c.business], ['Page', c.page]]), conversation: convo, alpha_url: `${tenancy.platformUrl()}/alpha#messages` }, c.email ? { replyTo: c.email } : {});
    }
    if (kind === 'reply') run('chatReply', c.email, { name: c.name || 'there', agent: (c.messages.filter((m) => m.from === 'agent').pop() || {}).agent || P().settings.productName, message: text, page: c.page || tenancy.platformUrl() }, P().settings.contactEmail ? { replyTo: P().settings.contactEmail } : {});
  } });

  // ---------- Automations (lib/automations.js): checked hourly; emails go out through the server's email settings ----------
  automations.init({
    stats: (t) => h.tenantStats(t),
    sendEmail: (t, to, m) => tenancy.run(defaultTenant(), () => h.sendEmail(to, m.subject, m.text, { server: true, html: m.html })),
  });
  // the unsubscribe link in automation emails: no login, a signed link
  app.get('/api/site/unsubscribe', (req, res) => {
    const ok = automations.unsubscribe(req.query.e, req.query.t); const name = String(P().settings.productName).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ok ? 'Unsubscribed' : 'Link not valid'}</title>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#eef3fb;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box">
<div style="background:#fff;border:1px solid #dbe4f0;border-radius:16px;padding:32px;max-width:420px;text-align:center"><h1 style="font-size:22px;margin:0 0 8px">${ok ? 'You’re unsubscribed' : 'This link isn’t valid'}</h1>
<p style="color:#64748b;margin:0">${ok ? `You won’t get ${name}’s tips and reminder emails anymore. Emails about your account itself, like receipts and password resets, still arrive.` : 'Copy the whole link from the email and try again.'}</p></div></body>`);
  });

  // ---------- Account Connections sign-in (lib/social.js): Google and Facebook send the business back here, then on to its own address ----------
  app.get('/oauth/:provider/callback', async (req, res) => {
    const st = social.verify(req.query.state);
    if (req.params.provider === 'tiktok' && (!st || st.t === 'alpha')) { // Alpha → Social: the platform's own TikTok account, back to Alpha (a business's TikTok goes on below)
      const back = (q) => res.redirect(`/alpha?${new URLSearchParams(q)}#social`);
      if (!st || st.k !== 'tiktok' || st.t !== 'alpha') return res.status(400).send('This sign-in link has expired. Go back to Alpha → Social and connect again.');
      if (req.query.error || !req.query.code) return back({ tiktok_error: String(req.query.error_description || 'You cancelled connecting TikTok').slice(0, 300) });
      try { await tiktok.connect(String(req.query.code)); return back({ tiktok: 'connected' }); } catch (e) { return back({ tiktok_error: String(e.message || 'Something went wrong').slice(0, 300) }); }
    }
    const t = st && P().tenants.find((x) => x.id === st.t);
    if (!t || social.appKey(st.k) !== req.params.provider) return res.status(400).send('This sign-in link has expired. Go back to Account Connections and try connecting again.');
    const books = accounting.has(st.k); // QuickBooks or Xero: back to Settings → QuickBooks & Xero
    const back = (q) => res.redirect(`${tenancy.tenantUrl(t)}${books ? '/settings/accounting' : st.b === '/social-posts' ? '/social-posts' : '/settings/connections'}?${new URLSearchParams(q)}`);
    // the person said no → "cancelled"; anything else is the network's own reason (e.g. LinkedIn's unauthorized_scope_error), shown as-is
    const cancelled = !req.query.error || /access_denied|cancel/i.test(String(req.query.error));
    if (req.query.error || !req.query.code) return back({ connect_error: st.k, reason: cancelled ? 'cancelled' : `${books ? accounting.PROVIDERS[st.k].name : networks.has(st.k) ? networks.NETWORKS[st.k].name : st.k}: ${String(req.query.error_description || req.query.error).slice(0, 250)}` });
    try {
      const code = String(req.query.code);
      if (books) { const conn = await accounting.PROVIDERS[st.k].connect(code, req.query); tenancy.run(t, () => h.saveAccounting(st.k, conn)); return back({ connected: st.k }); }
      const conn = st.k === 'google' ? await social.googleConnect(code) : networks.has(st.k) ? await networks.NETWORKS[st.k].connect(code) : await social.metaConnect(st.k, code);
      tenancy.run(t, () => h.saveConnection(st.k, conn)); back({ connected: st.k });
    } catch (e) { back({ connect_error: st.k, reason: String(e.message || 'Something went wrong').slice(0, 300) }); }
  });

  // ---------- platform admin login (separate from any account's logins) ----------
  const DAYS = 14;
  const adminOf = (req) => { const s = P().sessions[h.sha(h.cookies(req).psid || '')]; return s && s.expires > Date.now() ? P().admins.find((a) => a.id === s.adminId) : null; };
  // Alpha logins: the owner (full access) and support users (Accounts, Messages, Forum and Help Center only)
  const roleOf = (a) => (a && a.role === 'support' ? 'support' : 'owner');
  const pub = (a) => a && { id: a.id, name: a.name, email: a.email, role: roleOf(a) };
  function startSession(res, a) {
    const tok = crypto.randomBytes(32).toString('hex'); const now = Date.now();
    for (const [k, s] of Object.entries(P().sessions)) if (s.expires < now) delete P().sessions[k];
    P().sessions[h.sha(tok)] = { adminId: a.id, expires: now + DAYS * 864e5 }; tenancy.savePlatform();
    res.setHeader('Set-Cookie', `psid=${tok}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${DAYS * 86400}${secure}`);
  }
  app.get('/api/platform/state', (req, res) => { if (adminOf(req) && maintenance.isOn()) res.setHeader('Set-Cookie', maintenance.passCookie()); res.json({ needsSetup: !P().admins.length, admin: pub(adminOf(req)), productName: P().settings.productName, brand: brandLib.brand() }); }); // logged in during maintenance: your browser gets the pass
  app.post('/api/platform/setup', (req, res) => { // first visit only: create the platform owner
    if (P().admins.length) return res.status(403).json({ error: 'The Alpha owner already exists. Log in instead.' });
    const b = req.body || {}; const name = String(b.name || '').trim(); const email = h.normEmail(b.email);
    if (!name || !email.includes('@')) return res.status(400).json({ error: 'Enter your name and email address' });
    if (String(b.password || '').length < 10) return res.status(400).json({ error: 'Use a password with at least 10 characters' });
    const { salt, hash } = h.hashPassword(b.password);
    const a = { id: crypto.randomBytes(5).toString('hex'), name, email, role: 'owner', salt, passwordHash: hash, createdAt: new Date().toISOString() };
    P().admins.push(a); if (!P().settings.contactEmail) P().settings.contactEmail = email; startSession(res, a); res.json(pub(a));
  });
  app.post('/api/platform/login', (req, res) => {
    const email = h.normEmail(req.body && req.body.email); const key = 'platform|' + email + '|' + req.socket.remoteAddress;
    if (h.tooMany(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    const a = P().admins.find((x) => x.email === email);
    if (a && !a.passwordHash) return res.status(401).json({ error: 'Your login isn’t active yet. Use the link in the email we sent you to choose a password, or ask the owner to send a new one.' });
    if (!a || !h.checkPassword(String((req.body && req.body.password) || ''), a)) { h.recordFailure(key); return res.status(401).json({ error: 'That email and password don’t match' }); }
    h.clearFailures(key); a.lastLoginAt = new Date().toISOString(); startSession(res, a); res.json(pub(a));
  });
  app.post('/api/platform/logout', (req, res) => {
    delete P().sessions[h.sha(h.cookies(req).psid || '')]; tenancy.savePlatform();
    res.setHeader('Set-Cookie', 'psid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); res.json({ ok: true });
  });
  // Forgot your password? A 6-digit code by email (15 minutes, 5 tries), then a new password. The reply never says whether the email has a login.
  const forgotHits = new Map(); // email or ip -> timestamps
  const hit = (k, max, ms) => { const now = Date.now(); const l = (forgotHits.get(k) || []).filter((t) => now - t < ms); if (l.length >= max) return true; l.push(now); forgotHits.set(k, l); return false; };
  const codeHash = (a, code) => h.sha(`${a.id}|${code}`);
  app.post('/api/platform/forgot', async (req, res) => {
    const email = h.normEmail(req.body && req.body.email); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter your email address' });
    if (hit('ip|' + req.socket.remoteAddress, 10, 3600e3) || hit('em|' + email, 3, 15 * 60e3)) return res.status(429).json({ error: 'Too many codes requested. Wait 15 minutes and try again.' });
    const a = P().admins.find((x) => x.email === email);
    if (a) {
      const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0'); a.resetCode = { hash: codeHash(a, code), expires: Date.now() + 15 * 60e3, tries: 0 }; tenancy.savePlatform();
      const sent = await tenancy.run(defaultTenant(), () => h.sendTemplate('alphaCode', a.email, { name: a.name.split(/\s+/)[0], code, alpha_url: `${tenancy.platformUrl()}/alpha` }, { server: true })).catch((e) => ({ status: 'failed', detail: e.message }));
      if (sent.status !== 'sent') console.error(`Alpha verification code for ${a.email} wasn't emailed (${sent.detail || sent.status}). Reset from the terminal instead: node server.js --reset-platform-password ${a.email} NewPassword`);
    }
    res.json({ ok: true }); // the same reply either way
  });
  app.post('/api/platform/forgot/verify', (req, res) => {
    const b = req.body || {}; const email = h.normEmail(b.email); const code = String(b.code || '').replace(/\D/g, '');
    const a = P().admins.find((x) => x.email === email); const rc = a && a.resetCode;
    const bad = () => res.status(400).json({ error: 'That code isn’t right or has expired. Request a new one.' });
    if (!rc || rc.expires < Date.now() || rc.tries >= 5) return bad();
    if (codeHash(a, code) !== rc.hash) { rc.tries += 1; tenancy.savePlatform(); return res.status(400).json({ error: rc.tries >= 5 ? 'Too many wrong codes. Request a new one.' : 'That code isn’t right. Check the email and try again.' }); }
    if (b.check) return res.json({ ok: true }); // the code is right: now ask for the new password
    if (String(b.password || '').length < 10) return res.status(400).json({ error: 'Use a password with at least 10 characters' });
    const { salt, hash } = h.hashPassword(b.password); Object.assign(a, { salt, passwordHash: hash, passwordChangedAt: new Date().toISOString(), lastLoginAt: new Date().toISOString() });
    if (!a.activatedAt) a.activatedAt = new Date().toISOString(); delete a.resetCode; delete a.invite;
    for (const [k, s] of Object.entries(P().sessions)) if (s.adminId === a.id) delete P().sessions[k]; // every other device logs in again
    startSession(res, a); res.json(pub(a));
  });
  const byInvite = (token) => { const hash = h.sha(String(token || '')); const a = token && P().admins.find((x) => x.invite && x.invite.hash === hash); return a && a.invite.expires > Date.now() ? a : null; };
  app.get('/api/platform/invite', (req, res) => {
    const a = byInvite(req.query.token); if (!a) return res.status(400).json({ error: 'This link has expired or was already used. Ask the Alpha owner to send a new one.' });
    res.json({ name: a.name, email: a.email, kind: a.invite.kind, productName: P().settings.productName });
  });
  app.post('/api/platform/invite', (req, res) => {
    const b = req.body || {}; const a = byInvite(b.token); if (!a) return res.status(400).json({ error: 'This link has expired or was already used. Ask the Alpha owner to send a new one.' });
    if (String(b.password || '').length < 10) return res.status(400).json({ error: 'Use a password with at least 10 characters' });
    const { salt, hash } = h.hashPassword(b.password); Object.assign(a, { salt, passwordHash: hash, activatedAt: a.activatedAt || new Date().toISOString(), lastLoginAt: new Date().toISOString() }); delete a.invite;
    startSession(res, a); res.json(pub(a));
  });
  app.use('/api/platform', (req, res, next) => (adminOf(req) ? next() : res.status(401).json({ error: 'Please log in' })));
  // support users reach only what the Accounts, Messages, Forum and Help Center tabs use; everything else is the owner's
  const SUPPORT_API = /^\/api\/platform\/(overview|accounts(\/.*)?|chats(\/.*)?|chat-settings|forum(\/(?!settings$)[^/]+(\/.*)?)?|inquiries\/[^/]+|feedback\/[^/]+|emails(\/.*)?|help(\/.*)?|media|logout|me\/(password|email(\/verify)?))$/;
  app.use('/api/platform', (req, res, next) => (roleOf(adminOf(req)) === 'owner' || SUPPORT_API.test(req.path) ? next() : res.status(403).json({ error: 'Your Alpha login doesn’t include this. Ask the owner.' })));
  // change your own password (any Alpha login): the current one first; your other devices are logged out
  app.put('/api/platform/me/password', (req, res) => {
    const a = adminOf(req); const b = req.body || {}; const key = 'platform-pw|' + a.id;
    if (h.tooMany(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    if (!h.checkPassword(String(b.current || ''), a)) { h.recordFailure(key); return res.status(400).json({ error: 'Your current password isn’t right' }); }
    const pw = String(b.password || '');
    if (pw.length < 10) return res.status(400).json({ error: 'Use a new password with at least 10 characters' });
    if (h.checkPassword(pw, a)) return res.status(400).json({ error: 'Choose a password different from your current one' });
    h.clearFailures(key); const { salt, hash } = h.hashPassword(pw); a.salt = salt; a.passwordHash = hash; a.passwordChangedAt = new Date().toISOString();
    const mine = h.sha(h.cookies(req).psid || ''); for (const [k, s] of Object.entries(P().sessions)) if (s.adminId === a.id && k !== mine) delete P().sessions[k];
    tenancy.savePlatform(); res.json({ ok: true });
  });
  // change your own email (any Alpha login): your password, then a 6-digit code sent to the new address; the old address is told afterwards
  app.post('/api/platform/me/email', async (req, res) => {
    const a = adminOf(req); const b = req.body || {}; const email = h.normEmail(b.email); const key = 'platform-pw|' + a.id;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter the new email address' });
    if (email === a.email) return res.status(400).json({ error: 'That’s already your email' });
    if (P().admins.some((x) => x.email === email)) return res.status(400).json({ error: 'Another Alpha login already uses that email' });
    if (h.tooMany(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    if (!h.checkPassword(String(b.password || ''), a)) { h.recordFailure(key); return res.status(400).json({ error: 'Your password isn’t right' }); }
    if (hit('chg|' + a.id, 3, 15 * 60e3)) return res.status(429).json({ error: 'Too many codes requested. Wait 15 minutes and try again.' });
    h.clearFailures(key);
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0'); a.emailChange = { email, hash: codeHash(a, 'email|' + email + '|' + code), expires: Date.now() + 15 * 60e3, tries: 0 }; tenancy.savePlatform();
    const sent = await tenancy.run(defaultTenant(), () => h.sendTemplate('alphaEmailCode', email, { name: a.name.split(/\s+/)[0], code }, { server: true })).catch((e) => ({ status: 'failed', detail: e.message }));
    if (sent.status !== 'sent') return res.status(502).json({ error: `The code couldn’t be emailed (${sent.detail || 'email isn’t set up'}). Your email hasn’t changed.` });
    res.json({ ok: true, email });
  });
  app.post('/api/platform/me/email/verify', async (req, res) => {
    const a = adminOf(req); const ch = a.emailChange; const code = String((req.body && req.body.code) || '').replace(/\D/g, '');
    if (!ch || ch.expires < Date.now() || ch.tries >= 5) return res.status(400).json({ error: 'That code has expired. Start again.' });
    if (codeHash(a, 'email|' + ch.email + '|' + code) !== ch.hash) { ch.tries += 1; tenancy.savePlatform(); return res.status(400).json({ error: ch.tries >= 5 ? 'Too many wrong codes. Start again.' : 'That code isn’t right. Check the email and try again.' }); }
    if (P().admins.some((x) => x !== a && x.email === ch.email)) return res.status(400).json({ error: 'Another Alpha login already uses that email' });
    const old = a.email; a.email = ch.email; a.emailChangedAt = new Date().toISOString(); delete a.emailChange; tenancy.savePlatform();
    tenancy.run(defaultTenant(), () => h.sendTemplate('alphaEmailChanged', old, { name: a.name.split(/\s+/)[0], new_email: a.email, alpha_url: `${tenancy.platformUrl()}/alpha` }, { server: true })).catch(() => {});
    res.json({ ...pub(a), contactEmailWas: roleOf(a) === 'owner' && P().settings.contactEmail === old });
  });
  // ---------- the Alpha team (owner only, Settings): support users ----------
  const teamRow = (a) => ({ ...pub(a), createdAt: a.createdAt || '', lastLoginAt: a.lastLoginAt || '', pending: !a.passwordHash, linkSentAt: a.invite ? a.invite.sentAt : '', linkExpired: !!(a.invite && a.invite.expires < Date.now()) });
  // the welcome email (new support user) or a password reset: a link to choose a password, good for 7 days; if email isn't working, the link comes back for you to share
  async function sendAlphaLink(a, inviter) {
    const kind = a.passwordHash ? 'reset' : 'invite'; const token = crypto.randomBytes(24).toString('hex');
    a.invite = { hash: h.sha(token), kind, expires: Date.now() + 7 * 864e5, sentAt: new Date().toISOString() };
    if (kind === 'reset') { a.passwordHash = null; endSessions(a.id); } // the old password stops working until they choose a new one
    tenancy.savePlatform();
    const link = `${tenancy.platformUrl()}/alpha?invite=${token}`;
    const sent = await tenancy.run(defaultTenant(), () => h.sendTemplate(kind === 'invite' ? 'alphaInvite' : 'alphaReset', a.email, { name: a.name.split(/\s+/)[0], inviter: inviter || 'The owner', link, alpha_url: `${tenancy.platformUrl()}/alpha` }, { server: true })).catch((e) => ({ status: 'failed', detail: e.message }));
    return { kind, sent: sent.status === 'sent', detail: sent.status === 'sent' ? '' : sent.detail || 'Email isn’t set up', link: sent.status === 'sent' ? '' : link };
  }
  const teamView = () => P().admins.map(teamRow);
  const endSessions = (adminId) => { for (const [k, s] of Object.entries(P().sessions)) if (s.adminId === adminId) delete P().sessions[k]; };
  app.get('/api/platform/team', (req, res) => res.json(teamView()));
  app.post('/api/platform/team', async (req, res) => {
    const b = req.body || {}; const name = String(b.name || '').trim().slice(0, 100); const email = h.normEmail(b.email);
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter their name and email address' });
    if (P().admins.some((a) => a.email === email)) return res.status(400).json({ error: 'There’s already an Alpha login with that email' });
    const a = { id: crypto.randomBytes(5).toString('hex'), name, email, role: 'support', salt: '', passwordHash: null, createdAt: new Date().toISOString(), addedBy: adminOf(req).id };
    P().admins.push(a); const invite = await sendAlphaLink(a, adminOf(req).name); res.json({ team: teamView(), invite });
  });
  // resend the welcome email (not activated yet), or send a password reset (active)
  app.post('/api/platform/team/:id/link', async (req, res) => {
    const a = P().admins.find((x) => x.id === req.params.id); if (!a) return res.status(404).json({ error: 'Login not found' });
    if (roleOf(a) === 'owner') return res.status(400).json({ error: 'The owner’s password can’t be reset from here' });
    const invite = await sendAlphaLink(a, adminOf(req).name); res.json({ team: teamView(), invite });
  });
  app.put('/api/platform/team/:id', (req, res) => {
    const a = P().admins.find((x) => x.id === req.params.id); if (!a) return res.status(404).json({ error: 'Login not found' });
    const b = req.body || {};
    if ('name' in b) { const n = String(b.name || '').trim().slice(0, 100); if (!n) return res.status(400).json({ error: 'Enter a name' }); a.name = n; }
    tenancy.savePlatform(); res.json(teamView());
  });
  app.delete('/api/platform/team/:id', (req, res) => {
    const a = P().admins.find((x) => x.id === req.params.id); if (!a) return res.status(404).json({ error: 'Login not found' });
    if (roleOf(a) === 'owner') return res.status(400).json({ error: 'The owner’s login can’t be removed' });
    P().admins = P().admins.filter((x) => x !== a); endSessions(a.id); tenancy.savePlatform(); res.json(teamView());
  });

  // ---------- accounts ----------
  const accountRow = (t) => (tenancy.expireIfDue(t), {
    id: t.id, expiresAt: t.expiresAt || '', expiredOn: t.expiredOn || '', pauseReason: tenancy.pauseReason(t), name: t.name, slug: t.slug, planId: t.planId, status: t.status, createdAt: t.createdAt, isDefault: tenancy.isDefault(t),
    url: tenancy.tenantUrl(t), subdomainUrl: tenancy.subdomainUrl(t), domains: t.domains || [], ...h.tenantStats(t),
    support: support.summary(t),
    billing: t.billing ? { status: t.billing.status, paidAt: t.billing.paidAt || null, discountCode: t.billing.discount ? t.billing.discount.code : '', trialCancelled: !!(t.billing.trial && t.billing.trial.cancelled), demo: !!t.billing.demo, subscriptionStatus: t.billing.subscriptionStatus || null, pausedForBilling: !!t.billing.pausedForBilling, prepaid: supporters.prepaidInfo(t) } : null,
  });
  app.get('/api/platform/overview', (req, res) => {
    res.json({ settings: P().settings, plans: P().plans, betaFeatures: P().betaFeatures, features: catalog(), alwaysIncluded: tenancy.ALWAYS_INCLUDED, accounts: P().tenants.map(accountRow), industries: industries.CHOICES, rootDomain: tenancy.ROOT_DOMAIN, devMode: tenancy.devMode, admin: pub(adminOf(req)), chatWaiting: chat.waitingCount(), forumNew: forum.newCount(), reservedSlugs: P().reservedSlugs, inquiries: P().inquiries, feedback: P().feedback || [], appRequests: marketplace.requestsView(P()), discounts: discounts.listView(), maintenance: maintenance.state() });
  });
  const findTenant = (id) => P().tenants.find((t) => t.id === id);
  // the last day an account can be used (YYYY-MM-DD, '' = no end); it pauses the day after
  const today = () => new Date().toISOString().slice(0, 10);
  const expiryProblem = (v, t) => (!v ? '' : !/^\d{4}-\d{2}-\d{2}$/.test(v) ? 'Choose a date for the last day of access' : v < today() ? 'The last day of access can’t be in the past' : t && tenancy.isDefault(t) ? 'Your own account can’t expire' : '');
  app.post('/api/platform/accounts', async (req, res) => {
    const b = req.body || {}; const name = String(b.name || '').trim().slice(0, 100); const slug = String(b.slug || '').trim().toLowerCase();
    const ownerName = String(b.ownerName || '').trim().slice(0, 100); const ownerEmail = h.normEmail(b.ownerEmail);
    if (!name) return res.status(400).json({ error: 'Enter the business name' });
    const bad = tenancy.slugProblem(slug, null, { allowReserved: true }); if (bad) return res.status(400).json({ error: bad });
    if (!P().plans.some((p) => p.id === b.planId)) return res.status(400).json({ error: 'Choose a plan' });
    if (!ownerName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) return res.status(400).json({ error: 'Enter the owner’s name and email address' });
    // an email with a login elsewhere: from Alpha you can still use it once you confirm (sign-in then lists both businesses to choose from); public sign-ups can't
    const taken = emailInUse(ownerEmail); if (taken && !b.sameEmailOk) return res.status(409).json({ error: `${ownerEmail} already has a login at ${taken.business}${unpaid(taken.t) ? ' (waiting for payment)' : ''}.`, sameEmail: true, business: taken.business });
    const expiresAt = String(b.expiresAt || ''); const ex = expiryProblem(expiresAt); if (ex) return res.status(400).json({ error: ex });
    const t = tenancy.createTenant({ name, slug, planId: b.planId, demo: !!b.demo }); releaseSlug(slug); if (expiresAt) { t.expiresAt = expiresAt; tenancy.savePlatform(); }
    const r = tenancy.run(t, () => { h.createOwner(t, { name: ownerName, email: ownerEmail }); h.setCompanyEmail(ownerEmail); return h.ownerLink(t); });
    const sent = await tenancy.run(t, () => h.sendTemplate('accountReady', ownerEmail, { name: ownerName, business: name, link: r.link, account_url: tenancy.tenantUrl(t) }, { server: true }));
    res.status(201).json({ account: accountRow(t), link: r.link, emailed: sent.status === 'sent', detail: sent.detail });
  });
  app.put('/api/platform/accounts/:id', (req, res) => {
    const t = findTenant(req.params.id); if (!t) return res.status(404).json({ error: 'Account not found' });
    const b = req.body || {};
    if ('slug' in b) { const slug = String(b.slug || '').trim().toLowerCase(); if (slug !== t.slug) { const bad = tenancy.slugProblem(slug, t.id, { allowReserved: true }); if (bad) return res.status(400).json({ error: bad }); releaseSlug(slug); t.slug = slug; } }
    if ('name' in b) { const n = String(b.name || '').trim().slice(0, 100); if (!n) return res.status(400).json({ error: 'Enter the business name' }); t.name = n; }
    if ('industry' in b) { const i = industries.choose(b.industry, b.industryOther); if (i.error) return res.status(400).json({ error: i.error }); tenancy.run(t, () => h.setCompanyIndustry(i)); }
    if ('planId' in b) { if (!P().plans.some((p) => p.id === b.planId)) return res.status(400).json({ error: 'Choose a plan' }); t.planId = b.planId; supporters.setPrepaidPlan(t, b.planId); }
    if ('expiresAt' in b && t.billing && t.billing.prepaid && !t.billing.subscriptionId) return res.status(400).json({ error: 'This account is prepaid: change its last prepaid day in its Prepaid section' });
    if ('expiresAt' in b) { const v = String(b.expiresAt || ''); const ex = expiryProblem(v, t); if (ex) return res.status(400).json({ error: ex }); if (v) t.expiresAt = v; else delete t.expiresAt; }
    if (b.status === 'active' && t.expiresAt && t.expiresAt < today()) return res.status(400).json({ error: `Its last day of access (${t.expiresAt}) has passed. Choose a later date or remove it to resume the account.` });
    if ('status' in b) { if (!['active', 'suspended'].includes(b.status)) return res.status(400).json({ error: 'Unknown status' }); if (b.status === 'suspended' && tenancy.isDefault(t)) return res.status(400).json({ error: 'The default account can’t be paused' });
      if (b.status === 'active') tenancy.resume(t); else if (t.status !== 'suspended') tenancy.pause(t, 'platform'); } // paused here: only you can reopen it
    tenancy.savePlatform(); res.json(accountRow(t));
  });
  // a prepaid account (Founding Supporter code): move its last prepaid day, or end the prepaid months now.
  // With a card on a Stripe subscription, the next charge moves to the day after (or is taken now when ending).
  const dayAfterUnix = (day) => String(Math.floor((Date.parse(day + 'T12:00:00Z') + 864e5) / 1000));
  app.post('/api/platform/accounts/:id/prepaid', async (req, res) => {
    const t = findTenant(req.params.id); if (!t) return res.status(404).json({ error: 'Account not found' });
    const b = t.billing || {}; const x = b.prepaid; if (!x) return res.status(400).json({ error: 'This account isn’t prepaid' });
    const q = req.body || {}; const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
    const sub = b.subscriptionId; if (sub && !billingKey()) return res.status(400).json({ error: 'Stripe isn’t connected, so this account’s card billing can’t change here' });
    try {
      if (q.action === 'until') {
        if (!isDay(q.until) || q.until < today()) return res.status(400).json({ error: 'Choose a last prepaid day from today on' });
        if (sub) await billingApi('POST', `subscriptions/${encodeURIComponent(sub)}`, { trial_end: dayAfterUnix(q.until), proration_behavior: 'none' });
        supporters.setPrepaidUntil(t, q.until);
      } else if (q.action === 'end') {
        const pause = q.then === 'pause';
        if (!sub && !pause && (!isDay(q.trialUntil) || q.trialUntil < today())) return res.status(400).json({ error: 'Choose the last day of the free trial, from today on' });
        if (sub) await billingApi('POST', `subscriptions/${encodeURIComponent(sub)}`, { trial_end: 'now', proration_behavior: 'none' });
        supporters.endPrepaid(t, { pause, trialUntil: q.trialUntil });
      } else return res.status(400).json({ error: 'Unknown change' });
    } catch (e) { return res.status(502).json({ error: `Stripe couldn’t update the subscription: ${e.message}` }); }
    res.json(accountRow(t));
  });
  // ---------- an account's subscription (Accounts → a business → Subscription): what Stripe has, and changing it from Alpha ----------
  // Every change goes to Stripe first, then the app's own record (plan, interval, end date) follows, so the two never disagree.
  const enc = encodeURIComponent;
  const dash = (p) => `https://dashboard.stripe.com/${stripe.modeOf(billingKey()) === 'test' ? 'test/' : ''}${p}`;
  const dayOf = (s) => (s ? new Date(s * 1000).toISOString().slice(0, 10) : null);
  const unixOf = (day) => String(Math.floor(Date.parse(day + 'T12:00:00Z') / 1000));
  const subEnd = (s) => s.current_period_end || (s.items && s.items.data[0] && s.items.data[0].current_period_end) || 0;
  const liveSub = async (t) => { const b = t.billing || {}; if (!billingKey() || !b.subscriptionId) return null;
    const s = await billingApi('GET', `subscriptions/${enc(b.subscriptionId)}?expand[]=default_payment_method&expand[]=discounts`).catch(() => null);
    return s && !['canceled', 'incomplete_expired'].includes(s.status) ? s : null; };
  const couponText = (c) => (c ? `${c.percent_off ? `${c.percent_off}% off` : `$${(c.amount_off || 0) / 100} off`}${c.duration === 'forever' ? ', every bill' : c.duration === 'repeating' ? `, ${c.duration_in_months} months` : ', one bill'}` : '');
  async function subscriptionView(t) {
    const b = t.billing || {}; const key = billingKey();
    const out = { live: !!key, mode: key ? stripe.modeOf(key) : null, customerId: b.customerId || null, stripeUrl: b.customerId && key ? dash(`customers/${b.customerId}`) : null,
      subscription: null, card: null, invoices: [], pendingPlan: b.pendingPlanId || null, interval: b.interval || 'month', log: (b.adminLog || []).slice(0, 15) };
    if (!key || !b.customerId) return out;
    const [sub, inv, cust] = await Promise.all([liveSub(t), billingApi('GET', `invoices?customer=${enc(b.customerId)}&limit=12`).catch(() => null),
      billingApi('GET', `customers/${enc(b.customerId)}?expand[]=invoice_settings.default_payment_method`).catch(() => null)]);
    const pm = (sub && typeof sub.default_payment_method === 'object' && sub.default_payment_method) || (cust && cust.invoice_settings && typeof cust.invoice_settings.default_payment_method === 'object' && cust.invoice_settings.default_payment_method);
    if (pm && pm.card) out.card = { brand: pm.card.brand, last4: pm.card.last4, exp: `${String(pm.card.exp_month).padStart(2, '0')}/${String(pm.card.exp_year).slice(-2)}` };
    else if (pm && pm.type === 'link') out.card = { brand: 'Link', last4: '', exp: '', email: (pm.link && pm.link.email) || '' };
    if (sub) {
      const item = h.planItem(sub); const price = (item && item.price) || {}; const seats = h.seatItem(sub);
      const d = (sub.discounts || []).find((x) => x && typeof x === 'object') || (sub.discount && typeof sub.discount === 'object' ? sub.discount : null);
      const coupon = d && (d.coupon || (d.source && d.source.coupon && typeof d.source.coupon === 'object' ? d.source.coupon : null));
      out.subscription = { id: sub.id, url: dash(`subscriptions/${sub.id}`), status: sub.status, cancelAtPeriodEnd: !!sub.cancel_at_period_end, cancelAt: dayOf(sub.cancel_at),
        periodEnd: dayOf(subEnd(sub)), trialEnd: sub.status === 'trialing' ? dayOf(sub.trial_end) : null, paused: sub.pause_collection ? { resumesAt: dayOf(sub.pause_collection.resumes_at) } : null,
        amount: price.unit_amount != null ? price.unit_amount / 100 : null, interval: (price.recurring && price.recurring.interval) || b.interval || 'month',
        extraLogins: seats ? { count: seats.quantity || 0, amount: ((seats.price && seats.price.unit_amount) || 0) / 100 } : null,
        discount: coupon ? { name: coupon.name || coupon.id, text: couponText(coupon), end: dayOf(d.end) } : null };
    }
    out.invoices = ((inv && inv.data) || []).filter((i) => i.status !== 'draft').map((i) => ({ id: i.id, date: dayOf((i.status_transitions && i.status_transitions.paid_at) || i.created),
      amount: (i.amount_paid || i.total || 0) / 100, status: i.status, receiptUrl: i.hosted_invoice_url || null, refunded: (b.refunds || {})[i.id] || null }));
    return out;
  }
  const logIt = (t, req, what) => { const b = t.billing; b.adminLog = [{ at: new Date().toISOString(), by: (adminOf(req) || {}).name || 'Alpha', what }, ...(b.adminLog || [])].slice(0, 40); };
  app.get('/api/platform/accounts/:id/subscription', async (req, res) => {
    const t = findTenant(req.params.id); if (!t) return res.status(404).json({ error: 'Account not found' });
    try { res.json(await subscriptionView(t)); } catch (e) { res.status(502).json({ error: `Stripe couldn’t be read: ${e.message}` }); }
  });
  app.post('/api/platform/accounts/:id/subscription', async (req, res) => {
    const t = findTenant(req.params.id); if (!t) return res.status(404).json({ error: 'Account not found' });
    if (!billingKey()) return res.status(400).json({ error: 'Stripe isn’t connected (Settings → Integrations → Stripe)' });
    const b = t.billing || (t.billing = {}); const q = req.body || {}; const fail = (m) => res.status(400).json({ error: m }); let what = '';
    try {
      if (q.action === 'refund') { // a paid bill, in full or in part
        const inv = await billingApi('GET', `invoices/${enc(String(q.invoiceId || ''))}`).catch(() => null);
        if (!inv || inv.customer !== b.customerId) return fail('That bill isn’t this account’s');
        if (!inv.amount_paid) return fail('That bill wasn’t paid, so there’s nothing to refund');
        const left = inv.amount_paid - (((b.refunds || {})[inv.id] || {}).cents || 0); const cents = q.amount ? Math.round(Number(q.amount) * 100) : left;
        if (!(cents > 0) || cents > left) return fail(`Refund between $0.01 and $${(left / 100).toFixed(2)}`);
        let pay = { payment_intent: inv.payment_intent, charge: inv.charge };
        if (!pay.payment_intent && !pay.charge) { const ip = await billingApi('GET', `invoice_payments?invoice=${enc(inv.id)}`).catch(() => null); const p = ip && ip.data && ip.data.find((x) => x.status === 'paid'); pay = { payment_intent: p && p.payment && p.payment.payment_intent, charge: p && p.payment && p.payment.charge }; }
        const target = pay.payment_intent ? { payment_intent: typeof pay.payment_intent === 'string' ? pay.payment_intent : pay.payment_intent.id } : pay.charge ? { charge: typeof pay.charge === 'string' ? pay.charge : pay.charge.id } : null;
        if (!target) return fail('Stripe didn’t say how that bill was paid. Refund it in the Stripe dashboard.');
        await billingApi('POST', 'refunds', { ...target, amount: String(cents), 'metadata[tenantId]': t.id });
        b.refunds = b.refunds || {}; const r = b.refunds[inv.id] || { cents: 0 }; b.refunds[inv.id] = { cents: r.cents + cents, at: new Date().toISOString() };
        what = `Refunded $${(cents / 100).toFixed(2)} of the ${dayOf(inv.created)} bill`;
      } else {
        const sub = await liveSub(t); if (!sub) return fail('This account has no active subscription in Stripe');
        const url = `subscriptions/${sub.id}`; const item = h.planItem(sub); const end = Math.max(subEnd(sub), sub.status === 'trialing' ? sub.trial_end || 0 : 0); // free time pushes the period end out
        if (q.action === 'plan') {
          const to = P().plans.find((p) => p.id === q.planId); if (!to) return fail('Choose a plan');
          const c = planCharge(to, q.interval === 'year' ? 'year' : 'month');
          if (!c) { // a free plan: it starts when the paid period ends, as when the business picks one itself
            await billingApi('POST', url, { cancel_at_period_end: 'true' }); b.pendingPlanId = to.id; b.endsAt = dayOf(end); what = `Moves to ${to.name} (free) on ${dayOf(end)}`;
          } else {
            const now = q.when === 'now';
            await billingApi('POST', url, { 'items[0][id]': item.id, 'items[0][price_data][currency]': 'usd', 'items[0][price_data][product]': await h.planProduct(to), 'items[0][price_data][unit_amount]': String(c.cents),
              'items[0][price_data][recurring][interval]': c.interval, proration_behavior: now ? 'always_invoice' : 'none', cancel_at_period_end: 'false', 'metadata[planId]': to.id,
              ...(await h.seatParams(sub, to, c.interval, tenancy.run(t, () => h.extraCount(to)))) }); // the extra logins line moves with it
            t.planId = to.id; b.interval = c.interval; delete b.pendingPlanId; delete b.endsAt; supporters.setPrepaidPlan(t, to.id);
            what = `Plan changed to ${to.name}, $${c.cents / 100}/${c.interval}${now ? ', difference charged or credited now' : ', new price from the next bill'}`;
          }
        } else if (q.action === 'cancel') {
          if (q.when === 'now') { await billingApi('DELETE', url); b.endsAt = today(); delete b.pendingPlanId; tenancy.endSubscription(t); what = 'Cancelled now: the account is paused'; }
          else { await billingApi('POST', url, { cancel_at_period_end: 'true' }); b.endsAt = dayOf(end); delete b.pendingPlanId; what = `Cancels at the end of the period (${dayOf(end)})`; }
        } else if (q.action === 'undoCancel') {
          await billingApi('POST', url, { cancel_at_period_end: 'false' }); delete b.endsAt; delete b.pendingPlanId; what = 'Cancellation undone';
        } else if (q.action === 'pause') {
          const until = String(q.until || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until <= today()) return fail('Choose a day after today to start billing again');
          await billingApi('POST', url, { 'pause_collection[behavior]': 'void', 'pause_collection[resumes_at]': unixOf(until) }); what = `Billing paused until ${until} (the account stays open)`;
        } else if (q.action === 'resume') {
          await billingApi('POST', url, { pause_collection: '' }); what = 'Billing resumed';
        } else if (q.action === 'freeTime') {
          const days = Math.round(Number(q.days)); if (!(days >= 1 && days <= 730)) return fail('Give between 1 and 730 days');
          const from = Math.max(sub.trial_end || 0, end, Math.floor(Date.now() / 1000)); const next = from + days * 86400;
          await billingApi('POST', url, { trial_end: String(next), proration_behavior: 'none' }); what = `${days} free day${days === 1 ? '' : 's'}: next charge ${dayOf(next)}`;
        } else if (q.action === 'discount') {
          const d = (P().discounts || []).find((x) => x.id === q.discountId && x.type !== 'trial'); if (!d) return fail('Choose a discount code');
          await billingApi('POST', url, { 'discounts[0][coupon]': await discounts.stripeCoupon(billingKey(), d) }); what = `Discount ${d.code} applied (${discounts.describe(d)})`;
        } else if (q.action === 'removeDiscount') {
          await billingApi('POST', url, { discounts: '' }).catch(() => billingApi('DELETE', `${url}/discount`)); what = 'Discount removed';
        } else return fail('Unknown change');
      }
    } catch (e) { return res.status(502).json({ error: `Stripe couldn’t make that change: ${e.message}` }); }
    logIt(t, req, what); tenancy.savePlatform();
    try { res.json({ message: what, view: await subscriptionView(t), account: accountRow(t) }); } catch (e) { res.json({ message: what, account: accountRow(t) }); }
  });
  app.post('/api/platform/accounts/:id/owner-link', (req, res) => {
    const t = findTenant(req.params.id); if (!t) return res.status(404).json({ error: 'Account not found' });
    const r = tenancy.run(t, () => h.ownerLink(t)); if (!r) return res.status(400).json({ error: 'This account has no owner login yet' });
    res.json(r);
  });
  // Support Access: ask one of the account's logins for access, withdraw or end it, and open the account as them while it's granted
  app.post('/api/platform/accounts/:id/support-access', async (req, res) => {
    const t = findTenant(req.params.id); if (!t) return res.status(404).json({ error: 'Account not found' });
    const user = h.tenantStats(t).logins.find((u) => u.id === (req.body && req.body.userId));
    if (!user) return res.status(400).json({ error: 'Choose who to ask' });
    if (!user.active) return res.status(400).json({ error: `${user.name} can’t sign in (no password yet, or their access is turned off), so they can’t approve a request` });
    let r; try { r = support.request(t, adminOf(req), user, req.body.reason); } catch (e) { return res.status(400).json({ error: e.message }); }
    const sent = await tenancy.run(t, () => h.sendTemplate('supportAccessRequest', user.email, { name: user.name, admin: r.adminName, business: t.name, reason: r.reason || '', link: `${tenancy.tenantUrl(t)}/settings/support-access` }, { server: true })).catch((e) => ({ status: 'failed', detail: e.message }));
    res.json({ account: accountRow(t), emailed: sent.status === 'sent' });
  });
  app.delete('/api/platform/accounts/:id/support-access/:requestId', (req, res) => {
    const t = findTenant(req.params.id); if (!t) return res.status(404).json({ error: 'Account not found' });
    let r; try { r = support.end(t, req.params.requestId, `${adminOf(req).name} (${P().settings.productName} support)`); } catch (e) { return res.status(400).json({ error: e.message }); }
    tenancy.run(t, () => h.endSupportSessions(r.id));
    res.json(accountRow(t));
  });
  app.post('/api/platform/accounts/:id/support-login', (req, res) => {
    const t = findTenant(req.params.id); if (!t) return res.status(404).json({ error: 'Account not found' });
    if (t.status !== 'active') return res.status(400).json({ error: 'This account is paused or waiting for payment, so nobody can sign in' });
    try { res.json({ link: support.loginLink(t, adminOf(req), req.body && req.body.requestId) }); } catch (e) { res.status(400).json({ error: e.message }); }
  });
  // deleted accounts: the copies kept in data/deleted, and erasing them for good (owner only, like everything outside SUPPORT_API)
  app.get('/api/platform/deleted', (req, res) => res.json(tenancy.listDeleted()));
  app.delete('/api/platform/deleted/:name', (req, res) => { try { tenancy.purgeDeleted(req.params.name); res.json(tenancy.listDeleted()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  app.post('/api/platform/deleted/purge-all', (req, res) => {
    if ((req.body && req.body.confirm) !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm' });
    try { const n = tenancy.purgeAllDeleted(); res.json({ erased: n, list: tenancy.listDeleted() }); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/platform/accounts/:id', (req, res) => {
    const t = findTenant(req.params.id); if (!t) return res.status(404).json({ error: 'Account not found' });
    if ((req.body && req.body.confirm) !== t.slug) return res.status(400).json({ error: 'Type the account address to confirm' });
    try { tenancy.deleteTenant(t); } catch (e) { return res.status(400).json({ error: e.message }); }
    res.json({ ok: true });
  });
  // you can approve a domain by hand (e.g. while its DNS is still updating) or remove it
  app.post('/api/platform/accounts/:id/domains', (req, res) => {
    const t = findTenant(req.params.id); if (!t) return res.status(404).json({ error: 'Account not found' });
    const d = (t.domains || []).find((x) => x.host === String((req.body && req.body.host) || ''));
    if (!d) return res.status(404).json({ error: 'Domain not found' });
    if (req.body.remove) { t.domains = t.domains.filter((x) => x !== d); if (d.primary) { const n = t.domains.find((x) => x.verified); if (n) n.primary = true; } }
    else { d.verified = !!req.body.verified; d.verifiedAt = d.verified ? new Date().toISOString() : null; if (d.verified && !t.domains.some((x) => x.primary)) d.primary = true; if (!d.verified) d.primary = false; }
    tenancy.savePlatform(); res.json(accountRow(t));
  });

  app.post('/api/platform/accounts/:id/reset-demo', (req, res) => {
    const t = findTenant(req.params.id); if (!t) return res.status(404).json({ error: 'Account not found' });
    tenancy.run(t, () => h.resetDemo()); res.json({ ok: true });
  });

  // ---------- integrations: the server-wide services every account uses (set in .env) ----------
  const defaultTenant = () => P().tenants.find((t) => tenancy.isDefault(t)) || P().tenants[0];
  app.get('/api/platform/integrations', (req, res) => {
    const base = tenancy.platformUrl(); const key = stripe.platformKey();
    res.json({
      aiChat: chat.settings().ai, email: h.emailProvider() || '', mailServer: P().mailServer ? { host: P().mailServer.host, user: P().mailServer.user, from: P().mailServer.from } : null, envEmail: process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? `Gmail (${process.env.GMAIL_USER})` : process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM ? 'SendGrid' : '', sms: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM), ai: !!process.env.ANTHROPIC_API_KEY, homeDepot: !!process.env.SERPAPI_API_KEY,
      stripe: { key: !!key, mode: key ? stripe.modeOf(key) : null, keyVar: process.env.BILLING_STRIPE_SECRET_KEY ? 'BILLING_STRIPE_SECRET_KEY' : key ? 'STRIPE_SECRET_KEY' : null,
        billingWebhook: !!process.env.BILLING_STRIPE_WEBHOOK_SECRET, connectWebhook: !!process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
        billingWebhookUrl: `${base}/api/site/stripe-webhook`, connectWebhookUrl: `${base}/api/site/stripe-connect-webhook` },
      baseUrl: process.env.BASE_URL || '', platformDomain: tenancy.PLATFORM_DOMAIN, localhost: /localhost|127\.0\.0\.1/.test(base),
      connected: P().tenants.filter((t) => t.stripeAccountId).length, platformUrl: base,
      // how businesses set up card payments, the publishable key Stripe's in-app form needs, and how many used each way
      cardSetup: ['standard', 'embedded', 'both'].includes(P().settings.cardSetup) ? P().settings.cardSetup : 'standard',
      pubKey: (P().settings.stripePublishableKey || process.env.STRIPE_PUBLISHABLE_KEY || '').replace(/^(pk_(?:test|live)_.{6}).*$/, '$1…'), pubKeyFromEnv: !P().settings.stripePublishableKey && !!process.env.STRIPE_PUBLISHABLE_KEY,
      social: social.appsView(), // Google and Meta app keys for Account Connections (never the secrets)
      socialSoon: social.soonView(), // networks shown as Coming soon to businesses
      byMethod: { standard: P().tenants.filter((t) => t.stripeAccountId && t.stripeAccountType !== 'embedded').length, embedded: P().tenants.filter((t) => t.stripeAccountId && t.stripeAccountType === 'embedded').length },
    });
  });
  // your own mail server for the platform's email (e.g. a SiteGround mailbox): SSL on port 465; the password is never sent back to the browser
  app.put('/api/platform/mail-server', (req, res) => {
    const b = req.body || {}; const str = (k) => String(b[k] || '').trim().slice(0, 200); const old = P().mailServer || {};
    const m = { host: str('host').toLowerCase(), port: 465, user: str('user'), pass: str('pass') || (old.user === str('user') && old.host === str('host').toLowerCase() ? old.pass : ''), from: (str('from') || str('user')).toLowerCase() };
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(m.host)) return res.status(400).json({ error: 'Enter the outgoing mail server, e.g. mail.yourdomain.com' });
    if (!m.user || !m.pass) return res.status(400).json({ error: 'Enter the mailbox’s username (the full email address) and password' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.from)) return res.status(400).json({ error: 'Enter the address emails come from' });
    P().mailServer = m; tenancy.savePlatform(); res.json({ ok: true });
  });
  // the Google and Meta apps businesses sign in through (Account Connections); a blank secret keeps the saved one
  const appDo = (fn) => (req, res) => { try { fn(req); res.json(social.appsView()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  app.put('/api/platform/oauth-apps/:provider', appDo((req) => social.saveApp(req.params.provider, req.body || {})));
  app.delete('/api/platform/oauth-apps/:provider', appDo((req) => social.removeApp(req.params.provider)));
  // networks businesses see as Coming soon even with the keys saved (lib/social.js)
  app.put('/api/platform/social-soon/:kind', (req, res) => { try { social.setSoon(req.params.kind, !!(req.body || {}).soon); res.json(social.soonView()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  app.delete('/api/platform/mail-server', (req, res) => { delete P().mailServer; tenancy.savePlatform(); res.json({ ok: true }); });
  // tests run as your own (default) account, so they use its business name
  app.post('/api/platform/test-email', async (req, res) => {
    const to = h.normEmail(req.body && req.body.to); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: 'Enter an email address' });
    res.json(await tenancy.run(defaultTenant(), () => h.sendTemplate('test', to, {}, { server: true })));
  });
  app.post('/api/platform/test-sms', async (req, res) => {
    const to = String((req.body && req.body.to) || '').trim(); if (!to) return res.status(400).json({ error: 'Enter a phone number to text' });
    res.json(await tenancy.run(defaultTenant(), () => h.sendSms(to, `Test message from ${P().settings.productName}. Text messaging is connected.`, { server: true })));
  });

  // ---------- the application logo (lib/brand.js): kind is "light" (the main logo) or "dark" (a version for dark backgrounds) ----------
  app.post('/api/platform/logo/:kind', (req, res) => { try { brandLib.save(req.params.kind, req.body && req.body.dataUrl); res.json(P().settings); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  app.delete('/api/platform/logo/:kind', (req, res) => { if (!['light', 'dark', 'icon'].includes(req.params.kind)) return res.status(404).json({ error: 'Unknown logo' }); brandLib.remove(req.params.kind); res.json(P().settings); });
  // ---------- discount codes (lib/discounts.js) ----------
  const discDo = (fn) => (req, res) => { try { fn(req); res.json(discounts.listView()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  app.post('/api/platform/discounts', discDo((req) => discounts.create(req.body || {})));
  app.put('/api/platform/discounts/:id', discDo((req) => discounts.update(req.params.id, req.body || {})));
  app.delete('/api/platform/discounts/:id', discDo((req) => discounts.remove(req.params.id)));
  app.post('/api/platform/discounts/:id/remove-use', discDo((req) => discounts.removeUse(req.params.id, String((req.body && req.body.tenantId) || ''), String((req.body && req.body.at) || ''))));
  // ---------- maintenance mode (lib/maintenance.js) ----------
  app.put('/api/platform/maintenance', (req, res) => { const m = maintenance.save(req.body || {}); if (m.on) res.setHeader('Set-Cookie', maintenance.passCookie()); res.json(m); });
  app.get('/api/platform/maintenance/preview', (req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(maintenance.page()); });
  // ---------- the cancellation flow (lib/retention.js): its steps and offers, and the log of each flow ----------
  const rtDo = (fn) => (req, res) => { try { fn(req); res.json(retention.adminView()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  app.get('/api/platform/retention', rtDo(() => {}));
  app.get('/api/platform/retention/test', (req, res) => {
    const price = (p, i) => { const c = planCharge(p, i); return c && c.interval === i ? c.cents / 100 : null; };
    res.json({ productName: P().settings.productName, plans: P().plans.filter((p) => !p.hidden).map((p) => ({ id: p.id, name: p.name, hidden: false, month: price(p, 'month'), year: price(p, 'year') })) });
  });
  app.put('/api/platform/retention', rtDo((req) => retention.save(req.body || {})));
  app.delete('/api/platform/retention/flows/:id', rtDo((req) => retention.removeFlow(req.params.id)));
  // ---------- the referral program (lib/referrals.js) ----------
  app.get('/api/platform/referrals', (req, res) => res.json(referrals.adminView()));
  app.put('/api/platform/referrals/program', (req, res) => { try { referrals.saveProgram(req.body || {}); res.json(referrals.adminView()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  app.post('/api/platform/referrals/rewards/:id', (req, res) => { try { referrals.markReward(req.params.id, req.body && req.body.status); res.json(referrals.adminView()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  // ---------- creator partners (lib/partners.js) ----------
  partners.init({ sendEmail: (to, subject, body) => tenancy.run(defaultTenant(), () => h.sendEmail(to, subject, body, { server: true })),
    tellPlatform: (title, message) => { const to = P().settings.contactEmail; if (to) tenancy.run(defaultTenant(), () => h.sendTemplate('accountActivity', to, { title, message, link: `${tenancy.platformUrl()}/alpha#discounts` }, { server: true })).catch(() => {}); } });
  setInterval(() => { try { partners.refresh(); } catch (e) { console.error('Creator commission:', e.message); } }, 6 * 3600e3).unref(); // commission as businesses keep paying
  const crDo = (fn) => async (req, res) => { try { const r = await fn(req); res.json({ ...partners.adminView(), ...(r || {}) }); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  app.get('/api/platform/partners', crDo(() => null));
  app.put('/api/platform/partners/program', crDo((req) => { partners.saveProgram(req.body || {}); }));
  app.post('/api/platform/partners', crDo((req) => { partners.create(req.body || {}); }));
  app.put('/api/platform/partners/:id', crDo((req) => { partners.update(req.params.id, req.body || {}); }));
  app.post('/api/platform/partners/:id/send-stats', crDo(async (req) => { await partners.emailStats(req.params.id); }));
  app.post('/api/platform/partners/:id/approve', crDo(async (req) => { const r = await partners.approve(req.params.id, req.body || {}); return { emailed: r.emailed }; }));
  app.get('/api/platform/partners/:id/welcome', crDo((req) => { const c = (P().partners || []).find((x) => x.id === req.params.id); if (!c || !c.code) throw Object.assign(new Error('Give them a code first'), { status: 400 }); return { welcome: partners.welcomeText(c) }; }));
  app.delete('/api/platform/partners/:id', crDo((req) => { partners.remove(req.params.id); }));
  app.post('/api/platform/partners/:id/payouts', crDo((req) => { partners.addPayout(req.params.id, req.body || {}); }));
  app.delete('/api/platform/partners/:id/payouts/:pid', crDo((req) => { partners.removePayout(req.params.id, req.params.pid); }));
  const supDo = (fn) => (req, res) => { try { const r = fn(req); res.json({ ...supporters.adminView(), ...(r || {}) }); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  app.get('/api/platform/seo', (req, res) => res.json(seo.adminView()));
  app.put('/api/platform/seo', (req, res) => { try { seo.save(req.body || {}); res.json(seo.adminView()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  app.get('/api/platform/supporters', (req, res) => res.json(supporters.adminView()));
  app.put('/api/platform/supporters', supDo((req) => supporters.saveSettings(req.body || {})));
  app.post('/api/platform/supporters/people', supDo((req) => supporters.add(req.body || {})));
  app.put('/api/platform/supporters/people/:id', supDo((req) => supporters.update(req.params.id, req.body || {})));
  app.delete('/api/platform/supporters/people/:id', supDo((req) => supporters.remove(req.params.id)));
  const supSend = (key, to, vars) => tenancy.run(defaultTenant(), () => h.sendTemplate(key, to, vars, { server: true })).catch((e) => ({ status: 'failed', detail: e.message }));
  const supAsync = (fn) => async (req, res) => { try { const r = await fn(req); res.json({ ...supporters.adminView(), ...(r || {}) }); } catch (e) { res.status(e.status || 500).json({ error: e.message, ...supporters.adminView() }); } };
  app.post('/api/platform/supporters/people/:id/send', supAsync((req) => supporters.sendCode(req.params.id, supSend)));
  app.post('/api/platform/supporters/send-new', supAsync(() => supporters.sendNew(supSend)));
  // ---------- Alpha → Social: the platform's own TikTok account (lib/tiktok.js) ----------
  const ttDo = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message, code: e.code }); } };
  app.post('/api/platform/social/caption', ttDo((req) => tiktok.caption(req.body || {})));
  app.get('/api/platform/social', ttDo(() => ({ ai: !!process.env.ANTHROPIC_API_KEY && tenancy.aiOn('aiCaptions'), ready: tiktok.ready(), account: tiktok.account(), posts: tiktok.list(), redirectUri: social.redirectUri('tiktok') })));
  app.post('/api/platform/social/tiktok/connect', ttDo((req) => { if (!tiktok.ready()) throw Object.assign(new Error('Add your TikTok app keys in Settings → Integrations first'), { status: 400 }); return { url: tiktok.startUrl(adminOf(req).id) }; }));
  app.post('/api/platform/social/tiktok/disconnect', ttDo(async () => { await tiktok.disconnect(); return { ok: true }; }));
  app.get('/api/platform/social/tiktok/creator', ttDo(() => tiktok.creator()));
  app.post('/api/platform/social/media', ttDo((req) => tiktok.upload(req))); // the file itself is the body (not JSON), streamed to disk
  app.post('/api/platform/social/posts', ttDo((req) => tiktok.create(req.body || {}, adminOf(req))));
  app.post('/api/platform/social/posts/:id/retry', ttDo((req) => tiktok.retry(req.params.id, req.body || {})));
  app.delete('/api/platform/social/posts/:id', ttDo((req) => { tiktok.remove(req.params.id); return { ok: true }; }));
  app.post('/api/platform/media', (req, res) => { try { res.json({ url: brandLib.saveMedia(req.body && req.body.dataUrl) }); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  // ---------- email templates: the platform's own emails (lib/emails.js) ----------
  app.get('/api/platform/emails', (req, res) => res.json(emails.list()));
  const emailDo = (fn) => (req, res) => { try { fn(req); res.json(emails.list()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  app.put('/api/platform/emails/:key', emailDo((req) => emails.save(req.params.key, req.body || {})));
  app.delete('/api/platform/emails/:key', emailDo((req) => emails.reset(req.params.key)));
  // preview and test-send what's in the editor (saved or not), filled in with example values
  const draft = (req) => { const k = req.params.key; if (!emails.TEMPLATES[k]) return null; const b = req.body || {}; return emails.render(k, { ...emails.sample(k), site_url: `${/^https/.test(process.env.BASE_URL || '') ? 'https' : 'http'}://${req.headers.host}` }, { subject: String(b.subject || ''), body: String(b.body || '') }); };
  app.post('/api/platform/emails/:key/preview', (req, res) => { const m = draft(req); if (!m) return res.status(404).json({ error: 'Unknown email' }); res.json(m); });
  app.post('/api/platform/emails/:key/test', async (req, res) => {
    const m = draft(req); if (!m) return res.status(404).json({ error: 'Unknown email' });
    const to = adminOf(req).email;
    res.json({ to, ...(await tenancy.run(defaultTenant(), () => h.sendEmail(to, `[Test] ${m.subject}`, m.text, { server: true, html: m.html }))) });
  });
  // ---------- plans: names, prices and which features each includes ----------
  const PLAN_ID = /^[a-z0-9][a-z0-9-]{0,30}$/;
  app.put('/api/platform/plans', (req, res) => {
    const list = Array.isArray(req.body && req.body.plans) ? req.body.plans : null;
    if (!list || !list.length) return res.status(400).json({ error: 'Keep at least one plan' });
    const ids = new Set(); const out = [];
    for (const p of list) {
      const id = String(p.id || '').trim().toLowerCase(); const name = String(p.name || '').trim().slice(0, 40);
      if (!PLAN_ID.test(id) || ids.has(id)) return res.status(400).json({ error: `Each plan needs its own short ID (letters, numbers, dashes): “${id || '(blank)'}”` });
      if (!name) return res.status(400).json({ error: 'Every plan needs a name' });
      const maxUsers = Math.max(0, Math.floor(Number(p.maxUsers) || 0));
      const amt = (v) => { const n = Math.round(Number(String(v ?? '').replace(/[$,\s]/g, '')) * 100) / 100; return n > 0 ? Math.min(n, 1e6) : null; };
      const priced = { monthly: amt(p.monthly), yearly: amt(p.yearly), priceLabel: String(p.priceLabel || '').trim().slice(0, 40) };
      // the sale: each sale price must be below the regular one for that period; the last day is optional
      const sale = { saleMonthly: amt(p.saleMonthly), saleYearly: amt(p.saleYearly), saleEnds: /^\d{4}-\d{2}-\d{2}$/.test(String(p.saleEnds || '')) ? p.saleEnds : '', saleName: String(p.saleName || '').replace(/\s+/g, ' ').trim().slice(0, 30) };
      for (const [k, r] of [['saleMonthly', 'monthly'], ['saleYearly', 'yearly']]) {
        if (sale[k] && !priced[r]) return res.status(400).json({ error: `${name}: a ${r} sale price needs a regular ${r} price` });
        if (sale[k] && sale[k] >= priced[r]) return res.status(400).json({ error: `${name}: the ${r} sale price must be lower than the regular $${priced[r]}` });
      }
      if (sale.saleMonthly || sale.saleYearly) Object.assign(priced, { saleMonthly: sale.saleMonthly, saleYearly: sale.saleYearly, ...(sale.saleEnds ? { saleEnds: sale.saleEnds } : {}), ...(sale.saleName ? { saleName: sale.saleName } : {}) });
      const extraUser = maxUsers > 0 ? amt(p.extraUser) : null; // dollars a month for each login past maxUsers (empty: no extra logins)
      const smsLimit = Math.max(0, Math.floor(Number(p.smsLimit) || 0)); // texts a month (0 = no limit)
      ids.add(id); out.push({ id, name, ...priced, price: stripe.planPriceText(priced), description: String(p.description || '').trim().slice(0, 200), maxUsers, ...(extraUser ? { extraUser } : {}), smsLimit, features: [...new Set((p.features || []).filter((k) => tenancy.FEATURE_KEYS.includes(k)))], ...(p.hidden ? { hidden: true } : {}) });
    }
    const orphan = P().tenants.find((t) => !ids.has(t.planId));
    if (orphan) return res.status(400).json({ error: `${orphan.name} is on the plan you removed. Move it to another plan first.` });
    if (out.every((p) => p.hidden)) return res.status(400).json({ error: 'Keep at least one plan visible on the pricing page' });
    if (Array.isArray(req.body.betaFeatures)) P().betaFeatures = tenancy.FEATURE_KEYS.filter((k) => req.body.betaFeatures.includes(k));
    const locked = tenancy.lockPrices(P().plans, out); // a higher price, or fewer logins, is for new accounts: the ones on the plan keep theirs
    P().plans = out; if (!out.some((p) => p.id === P().settings.signupPlan && !p.hidden)) P().settings.signupPlan = out.find((p) => !p.hidden).id;
    tenancy.savePlatform(); res.json({ plans: P().plans, betaFeatures: P().betaFeatures, locked });
  });
  // ---------- reserved addresses: held back from sign-ups; giving one to an account releases it ----------
  const releaseSlug = (slug) => { const n = P().reservedSlugs.length; P().reservedSlugs = P().reservedSlugs.filter((r) => r.slug !== slug); if (P().reservedSlugs.length !== n) tenancy.savePlatform(); };
  app.post('/api/platform/reserved', (req, res) => {
    const b = req.body || {}; const slug = String(b.slug || '').trim().toLowerCase(); const note = String(b.note || '').trim().slice(0, 100);
    if (!tenancy.SLUG_RE.test(slug)) return res.status(400).json({ error: 'Use 3–32 lowercase letters, numbers or dashes (not at the start or end)' });
    if (tenancy.RESERVED.has(slug) || P().reservedSlugs.some((r) => r.slug === slug)) return res.status(400).json({ error: `${slug} is already reserved` });
    if (P().tenants.some((t) => t.slug === slug)) return res.status(400).json({ error: `An account already uses ${slug}` });
    P().reservedSlugs.push({ slug, note, createdAt: new Date().toISOString().slice(0, 10) }); tenancy.savePlatform(); res.status(201).json(P().reservedSlugs);
  });
  // ---------- help center: articles, topics, home page and "Was this article helpful?" feedback ----------
  const helpState = () => { const H = helpStore.content(); return { ...H, feedback: helpStore.feedback(), comments: helpStore.comments(), icons: helpStore.ICONS, helpUrl: tenancy.helpUrl(), productName: P().settings.productName }; };
  const helpDo = (fn) => (req, res) => { try { fn(req); res.json(helpState()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  app.get('/api/platform/help', (req, res) => res.json(helpState()));
  app.post('/api/platform/help/articles', helpDo((req) => helpStore.createArticle(req.body || {})));
  app.put('/api/platform/help/articles/:slug', helpDo((req) => helpStore.updateArticle(req.params.slug, req.body || {})));
  app.delete('/api/platform/help/articles/:slug', helpDo((req) => helpStore.deleteArticle(req.params.slug)));
  app.post('/api/platform/help/articles/:slug/move', helpDo((req) => helpStore.moveArticle(req.params.slug, req.body && req.body.dir)));
  app.post('/api/platform/help/articles/:slug/reset-feedback', helpDo((req) => helpStore.resetFeedback(req.params.slug)));
  app.put('/api/platform/help/topics', helpDo((req) => helpStore.saveTopics(req.body && req.body.topics)));
  app.put('/api/platform/help/home', helpDo((req) => helpStore.saveHome(req.body || {})));
  app.delete('/api/platform/help/comments/:id', helpDo((req) => helpStore.deleteComment(req.params.id)));
  // Automations (owner only): list, edit, turn on or off, see who'd get one, send yourself a test, run now
  const autoDo = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  app.get('/api/platform/automations', autoDo(() => automations.view()));
  app.post('/api/platform/automations', autoDo((req) => { automations.create(req.body || {}); return automations.view(); }));
  app.put('/api/platform/automations/:id', autoDo((req) => { automations.update(req.params.id, req.body || {}); return automations.view(); }));
  app.post('/api/platform/automations/:id/enable', autoDo((req) => { automations.setEnabled(req.params.id, !!(req.body || {}).on); return automations.view(); }));
  app.delete('/api/platform/automations/:id', autoDo((req) => { automations.remove(req.params.id); return automations.view(); }));
  app.post('/api/platform/automations/preview', autoDo((req) => automations.audience(req.body || {})));
  app.post('/api/platform/automations/test', autoDo((req) => automations.test(req.body || {}, adminOf(req).email, adminOf(req).name)));
  app.post('/api/platform/automations/run', autoDo(async () => { await automations.run(); return automations.view(); }));
  // the business app's menu icons (Settings → Menu icons): one from the library for each link
  app.get('/api/platform/site-colors', (req, res) => res.json(brandLib.siteColorsView()));
  app.get('/api/platform/nav-icons', (req, res) => res.json(iconsLib.view()));
  app.put('/api/platform/nav-order', (req, res) => { try { if ((req.body || {}).reset) iconsLib.resetOrder(); else iconsLib.setOrder((req.body || {}).order); res.json(iconsLib.view()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  app.put('/api/platform/nav-icons', (req, res) => { try { iconsLib.choose(String((req.body || {}).path || ''), (req.body || {}).icon || null); res.json(iconsLib.view()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  // Forum (lib/forum.js): post as the team, set a post's status, pin or lock it, reply as the team, delete posts and comments
  const forumDo = (fn) => (req, res) => { try { res.json(fn(req, req.body || {})); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  const team = (req) => { const a = adminOf(req); return { team: true, adminId: a.id, name: a.name }; };
  app.get('/api/platform/forum', forumDo(() => forum.adminList()));
  // Help Center → Comparison's rows (lib/compare.js). Not in SUPPORT_API, so only the Alpha owner gets them
  app.get('/api/platform/compare', (req, res) => res.json(require('./compare')));
  app.post('/api/platform/forum', forumDo((req, b) => forum.adminCreate(b, adminOf(req))));
  app.put('/api/platform/forum/settings', forumDo((req, b) => forum.saveSettings(b)));
  app.put('/api/platform/forum/:id', forumDo((req, b) => forum.adminUpdate(req.params.id, b, adminOf(req))));
  app.delete('/api/platform/forum/:id', forumDo((req) => forum.adminRemove(req.params.id)));
  app.post('/api/platform/forum/:id/comments', forumDo((req, b) => forum.comment(team(req), req.params.id, b)));
  app.delete('/api/platform/forum/:id/comments/:cid', forumDo((req) => forum.removeComment(team(req), req.params.id, req.params.cid)));
  // Live chat (Messages tab): polling this also marks you online for the chat button
  const chatDo = (fn) => (req, res) => { try { res.json(fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  app.get('/api/platform/chats', chatDo(() => chat.list()));
  app.get('/api/platform/chats/:id', chatDo((req) => chat.get(req.params.id)));
  app.post('/api/platform/chats/:id/reply', chatDo((req) => chat.reply(req.params.id, req.body && req.body.text, (adminOf(req).name || '').split(/\s+/)[0] || 'Support')));
  app.get('/api/platform/chats/:id/files/:fid', (req, res) => chat.agentFile(res, req.params.id, req.params.fid, 'download' in (req.query || {})));
  app.post('/api/platform/chats/:id/files', async (req, res) => { // the file itself is the request body (not JSON)
    try { res.json(await chat.agentUpload(req, req.params.id, (adminOf(req).name || '').split(/\s+/)[0] || 'Support', String((req.query || {}).name || ''))); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'The file couldn’t be saved' }); }
  });
  app.post('/api/platform/chats/:id/close', chatDo((req) => chat.close(req.params.id)));
  app.delete('/api/platform/chats/:id', chatDo((req) => { chat.remove(req.params.id); return chat.list(); }));
  app.put('/api/platform/chat-settings', chatDo((req) => chat.saveSettings(req.body || {})));
  app.delete('/api/platform/app-suggestions/:id', (req, res) => { P().appSuggestions = marketplace.requestsView(P()).suggestions.filter((m) => m.id !== req.params.id); tenancy.savePlatform(); res.json(marketplace.requestsView(P())); });
  app.delete('/api/platform/feedback/:id', (req, res) => { P().feedback = (P().feedback || []).filter((m) => m.id !== req.params.id); tenancy.savePlatform(); res.json(P().feedback); });
  app.delete('/api/platform/inquiries/:id', (req, res) => { P().inquiries = P().inquiries.filter((m) => m.id !== req.params.id); tenancy.savePlatform(); res.json(P().inquiries); });
  app.delete('/api/platform/reserved/:slug', (req, res) => { releaseSlug(req.params.slug); res.json(P().reservedSlugs); });

  app.put('/api/platform/settings', (req, res) => {
    const b = req.body || {}; const s = P().settings;
    if ('productName' in b) { const n = String(b.productName || '').trim().slice(0, 60); if (!n) return res.status(400).json({ error: 'Enter a product name' }); s.productName = n; }
    if ('contactEmail' in b) { const e = h.normEmail(b.contactEmail); if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ error: 'Enter a valid contact email' }); s.contactEmail = e; }
    for (const k of ['expiryBannerDays', 'expiryReminderDays']) if (k in b) { const n = Math.floor(Number(b[k])); if (!(n >= 0 && n <= 60)) return res.status(400).json({ error: 'Use a number of days from 0 to 60' }); s[k] = n; }
    const prevSetup = s.cardSetup;
    if ('cardSetup' in b) { if (!['standard', 'embedded', 'both'].includes(b.cardSetup)) return res.status(400).json({ error: 'Choose how businesses set up card payments' }); s.cardSetup = b.cardSetup; }
    if ('stripePublishableKey' in b) { // Stripe's in-app setup form needs it; it must be from the same Stripe account and mode as the secret key
      const k = String(b.stripePublishableKey || '').trim(); const sk = stripe.platformKey();
      if (k && !/^pk_(test|live)_[A-Za-z0-9]+$/.test(k)) return res.status(400).json({ error: 'Paste the publishable key from Stripe (it starts with pk_live_ or pk_test_)' });
      if (k && sk && (k.startsWith('pk_live_') ? 'live' : 'test') !== stripe.modeOf(sk)) return res.status(400).json({ error: `That's a ${k.startsWith('pk_live_') ? 'live' : 'test'} key, but your secret key is in ${stripe.modeOf(sk)} mode. Use the matching publishable key.` });
      s.stripePublishableKey = k;
    }
    // setting up in the app needs the publishable key: without it, businesses would see no way to start
    if (s.cardSetup === 'embedded' && !(s.stripePublishableKey || process.env.STRIPE_PUBLISHABLE_KEY)) { s.cardSetup = prevSetup; return res.status(400).json({ error: 'Add your Stripe publishable key first: setting up in the app needs it. Until then, businesses use Connect with Stripe.' }); }
    // Alpha → Settings → Website colors (lib/brand.js): only the colors changed from the defaults are sent
    if ('siteColors' in b) {
      const out = {};
      for (const [k, v] of Object.entries(b.siteColors || {})) { const c = String(v).toLowerCase(); if (!brandLib.validColorKey(k) || !/^#[0-9a-f]{6}$/.test(c)) return res.status(400).json({ error: 'Choose a valid color' }); out[k] = c; }
      s.siteColors = out;
    }
    if ('logoHasName' in b) s.logoHasName = b.logoHasName === true || b.logoHasName === 'on';
    if ('legalName' in b) s.legalName = String(b.legalName || '').trim().slice(0, 120);
    if ('governingLaw' in b) s.governingLaw = String(b.governingLaw || '').trim().slice(0, 80);
    if ('allowSignups' in b) s.allowSignups = b.allowSignups === true || b.allowSignups === 'on';
    for (const k of ['aiDescriptions', 'aiRewrite', 'aiCaptions', 'aiSnapQuote']) if (k in b) s[k] = b[k] === true; // Integrations → AI (lib/tenancy.js)
    if ('marketplace' in b) s.marketplace = b.marketplace === true || b.marketplace === 'on'; // App Marketplace in every account (lib/marketplace.js)
    if ('platformFeePercent' in b) { const f = Number(b.platformFeePercent || 0); if (!(f >= 0 && f <= 30)) return res.status(400).json({ error: 'Set a platform fee between 0 and 30%' }); s.platformFeePercent = Math.round(f * 100) / 100; }
    // the plan with the "Most popular" badge on the pricing page: '' picks the middle one, 'none' shows no badge
    if ('popularPlan' in b) { const v = String(b.popularPlan || ''); if (v && v !== 'none' && !P().plans.some((p) => p.id === v && !p.hidden)) return res.status(400).json({ error: 'Choose a plan to mark as most popular' }); s.popularPlan = v; }
    if ('signupPlan' in b) { if (!P().plans.some((p) => p.id === b.signupPlan && !p.hidden)) return res.status(400).json({ error: 'Choose a plan for new sign-ups' }); s.signupPlan = b.signupPlan; }
    tenancy.savePlatform(); res.json(s);
  });

  app.use(express.static(PUB));
  app.get('*', (req, res) => (req.path.startsWith('/api/') ? res.status(404).json({ error: 'Not found' }) : res.redirect(tenancy.devMode ? '/alpha' : '/')));
  return app;
};
