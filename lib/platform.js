// The platform side: your console for accounts, plans and features (Alpha, at /alpha), and the public pricing + sign-up page.
// Served on PLATFORM_DOMAIN itself (and www.), or on any address while PLATFORM_DOMAIN is unset (local development).
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
  const site = (req, res) => res.sendFile(path.join(PUB, 'site.html'));
  app.get('/pricing', site); app.get('/signup', site);
  // the guest home page (features); while developing (no PLATFORM_DOMAIN) it's at /home, since / is the account app
  const home = (req, res) => res.sendFile(path.join(PUB, 'home.html'));
  app.get('/home', home);
  if (!tenancy.devMode) app.get('/', home);

  // ---------- public: plans for the pricing page, sign-up ----------
  const publicPlan = (p) => ({ id: p.id, name: p.name, price: p.price, monthly: Number(p.monthly) > 0 ? Number(p.monthly) : null, yearly: Number(p.yearly) > 0 ? Number(p.yearly) : null, priceLabel: p.priceLabel || '', description: p.description, maxUsers: p.maxUsers || 0, features: p.features });
  const periodOf = (v) => (v === 'year' ? 'year' : 'month');
  const catalog = () => tenancy.FEATURES.map(({ key, group, label, desc }) => ({ key, group, label, desc, beta: tenancy.isBeta(key) }));
  app.get('/api/site', (req, res) => {
    const s = P().settings;
    res.json({ productName: s.productName, brand: brandLib.brand(), contactEmail: s.contactEmail, allowSignups: !!s.allowSignups, signupPlan: s.signupPlan, popularPlan: s.popularPlan || '', plans: P().plans.filter((p) => !p.hidden).map((p) => ({ ...publicPlan(p), paid: !!planCharge(p) })), features: catalog(), alwaysIncluded: tenancy.ALWAYS_INCLUDED, rootDomain: tenancy.ROOT_DOMAIN, home: tenancy.devMode ? '/home' : '/' });
  });
  app.get('/api/site/ref/:code', (req, res) => { const l = referrals.landing(req.params.code); if (!l) return res.status(404).json({ error: 'Referral link not found' }); res.json(l); });
  app.get('/api/site/slug-check', (req, res) => { const slug = String(req.query.slug || '').toLowerCase(); const bad = tenancy.slugProblem(slug); res.json({ ok: !bad, error: bad || null }); });
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
  app.post('/api/site/discount-check', (req, res) => {
    const ip = req.socket.remoteAddress; const now = Date.now(); const hits = (codeHits.get(ip) || []).filter((t) => now - t < 600e3);
    if (hits.length >= 30) return res.status(429).json({ error: 'Too many tries. Wait a few minutes and try again.' }); hits.push(now); codeHits.set(ip, hits);
    const b = req.body || {}; const plan = P().plans.find((p) => p.id === b.plan && !p.hidden); const c = plan && planCharge(plan, periodOf(b.interval));
    if (!c) return res.status(400).json({ error: 'Discount codes apply to paid plans' });
    const r = discounts.check(b.code, { planId: plan.id, interval: c.interval, email: h.normEmail(b.email) });
    res.status(r.error ? 400 : 200).json(r.error ? { error: r.error } : { ok: true, ...discounts.priced(r.d, c.cents) });
  });
  const signupHits = new Map(); // ip -> timestamps: 5 sign-ups per hour per address
  app.post('/api/site/signup', async (req, res) => {
    const s = P().settings; if (!s.allowSignups) return res.status(403).json({ error: 'Sign-ups are closed. Contact us to get an account.' });
    const ip = req.socket.remoteAddress; const now = Date.now(); const hits = (signupHits.get(ip) || []).filter((t) => now - t < 3600e3);
    if (hits.length >= 5) return res.status(429).json({ error: 'Too many sign-ups from this connection. Try again later.' });
    const b = req.body || {}; const company = String(b.company || '').trim().slice(0, 100); const slug = String(b.slug || '').trim().toLowerCase();
    const name = String(b.name || '').trim().slice(0, 100); const email = h.normEmail(b.email); const password = String(b.password || '');
    if (!company) return res.status(400).json({ error: 'Enter your business name' });
    const bad = tenancy.slugProblem(slug); if (bad) return res.status(400).json({ error: bad });
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter your name and a valid email address' });
    if (password.length < 8) return res.status(400).json({ error: 'Use a password with at least 8 characters' });
    const open = P().plans.filter((p) => !p.hidden); const plan = open.find((p) => p.id === b.plan) || open.find((p) => p.id === s.signupPlan) || open[0];
    if (!plan) return res.status(400).json({ error: 'Sign-ups are closed right now' });
    const paid = planCharge(plan, periodOf(b.interval)); let disc = null; // a discount code only matters for a paid plan
    if (paid && String(b.code || '').trim()) { const r = discounts.check(b.code, { planId: plan.id, interval: paid.interval, email }); if (r.error) return res.status(400).json({ error: r.error }); disc = r.d; }
    else if (paid && b.ref) { const l = referrals.landing(b.ref); const r = l && l.code ? discounts.check(l.code, { planId: plan.id, interval: paid.interval, email }) : null; if (r && r.d) disc = r.d; } // the referral offer, when it fits
    hits.push(now); signupHits.set(ip, hits);
    const t = tenancy.createTenant({ name: company, slug, planId: plan.id, demo: false });
    tenancy.run(t, () => { h.createOwner(t, { name, email, password }); h.setCompanyEmail(email); });
    // a paid plan waits at the checkout page until it's paid; a free one starts right away
    const tok = crypto.randomBytes(24).toString('hex');
    const charge = planCharge(plan, periodOf(b.interval));
    t.billing = { tokenHash: h.sha(tok), email, ownerName: name, status: charge ? 'pending' : 'free', interval: charge ? charge.interval : periodOf(b.interval), createdAt: new Date().toISOString(), ...(disc ? { discount: { id: disc.id, code: disc.code } } : {}) };
    if (b.ref) referrals.signedUp(t, b.ref); // came from another business's referral link
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
  function codeFor(t) { // { d } for the account's code if it still applies, else null (and the code is dropped with a note for the page)
    const b = t.billing; if (!b.discount) return null; const c = planCharge(tenancy.planOf(t), b.interval);
    if (!c) { delete b.discount; tenancy.savePlatform(); return null; } // a free plan has nothing to discount
    const r = discounts.check(b.discount.code, { planId: t.planId, interval: c.interval, email: b.email });
    if (!r.error) return r; b.discountNote = `Code ${b.discount.code} was removed: ${r.error}`; delete b.discount; tenancy.savePlatform(); return null;
  }
  const checkoutView = (t) => {
    const plan = tenancy.planOf(t); const c = planCharge(plan, t.billing.interval); const dc = c && codeFor(t); const note = t.billing.discountNote || ''; delete t.billing.discountNote;
    return { interval: c ? c.interval : periodOf(t.billing.interval), company: t.name, address: tenancy.subdomainUrl(t).replace(/^https?:\/\//, ''), email: t.billing.email, status: t.billing.status,
      productName: P().settings.productName, brand: brandLib.brand(), contactEmail: P().settings.contactEmail, live: !!billingKey(), testMode: /^(sk|rk)_test_/.test(billingKey()),
      plan: { ...publicPlan(plan), charge: c }, plans: P().plans.filter((p) => !p.hidden || p.id === t.planId).map((p) => ({ ...publicPlan(p), charge: planCharge(p, t.billing.interval) })), features: catalog(), alwaysIncluded: tenancy.ALWAYS_INCLUDED,
      loginUrl: t.billing.status === 'pending' ? null : loginUrl(t), discount: dc ? discounts.priced(dc.d, c.cents) : null, discountNote: note };
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
    const c = planCharge(tenancy.planOf(t), t.billing.interval); const r = c ? discounts.check(code, { planId: t.planId, interval: c.interval, email: t.billing.email }) : { error: 'Discount codes apply to paid plans' };
    if (r.error) return res.status(400).json({ error: r.error });
    t.billing.discount = { id: r.d.id, code: r.d.code }; tenancy.savePlatform(); res.json(checkoutView(t));
  });
  app.post('/api/site/checkout/:token/pay', async (req, res) => {
    const tok = req.params.token; const t = byToken(tok); if (!t) return res.status(404).json({ error: 'This checkout link isn’t valid' });
    if (t.billing.status !== 'pending') return res.json({ url: loginUrl(t) });
    const plan = tenancy.planOf(t); const c = planCharge(plan, t.billing.interval);
    const hadCode = !!t.billing.discount; const dc = codeFor(t); // checked again: it may have expired or run out since it was added
    if (hadCode && !dc) return res.status(409).json({ error: (t.billing.discountNote || 'Your discount code no longer applies.') + ' Check the new total before paying.', reload: true });
    if (!billingKey()) { activate(t, { demo: true }); return res.json({ url: loginUrl(t) }); } // demo checkout
    const back = `${tenancy.platformUrl()}/checkout/${tok}`;
    try {
      const p = {
        mode: 'subscription', customer_email: t.billing.email, client_reference_id: t.id, 'metadata[tenantId]': t.id, 'subscription_data[metadata][tenantId]': t.id,
        'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(c.cents),
        'line_items[0][price_data][recurring][interval]': c.interval, 'line_items[0][price_data][product_data][name]': `${P().settings.productName} ${plan.name}`,
        'line_items[0][price_data][product_data][description]': `${t.name} (${tenancy.subdomainUrl(t).replace(/^https?:\/\//, '')})`,
        success_url: `${back}/done?session_id={CHECKOUT_SESSION_ID}`, cancel_url: back,
      };
      if (t.billing.customerId) { delete p.customer_email; p.customer = t.billing.customerId; }
      if (dc) { p['discounts[0][coupon]'] = await discounts.stripeCoupon(billingKey(), dc.d); if (dc.d.type === 'percent' && dc.d.value === 100 && dc.d.duration === 'forever') p.payment_method_collection = 'if_required'; } // free for good: no card needed
      const s = await billingApi('POST', 'checkout/sessions', p);
      res.json({ redirect: s.url });
    } catch (e) { console.error('Billing checkout failed:', e.message); res.status(502).json({ error: 'We couldn’t start the card payment. Try again in a moment.' }); }
  });
  const applySession = (s) => {
    const t = s && s.metadata && P().tenants.find((x) => x.id === s.metadata.tenantId);
    if (!t || !t.billing || s.mode === 'setup' || s.status !== 'complete' || !['paid', 'no_payment_required'].includes(s.payment_status)) return t; // setup = a card update (Account and billing handles it)
    if (s.metadata.planId && P().plans.some((p) => p.id === s.metadata.planId)) { // a plan picked in Account and billing
      referrals.useBanked(t, s.metadata.creditUntil); referrals.paid(t).catch(() => {});
      t.planId = s.metadata.planId; delete t.expiresAt; Object.assign(t.billing, { customerId: s.customer || t.billing.customerId || null, subscriptionId: s.subscription || null, status: 'paid', interval: s.metadata.interval === 'year' ? 'year' : 'month' });
      delete t.billing.pendingPlanId; delete t.billing.endsAt; delete t.billing.demo; if (t.billing.pausedForBilling) { t.status = 'active'; delete t.billing.pausedForBilling; } tenancy.savePlatform(); return t;
    }
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
        if (off && t.status === 'active') { t.status = 'suspended'; t.billing.pausedForBilling = true; }
        else if (!off && o.status === 'active' && t.billing.pausedForBilling) { t.status = 'active'; delete t.billing.pausedForBilling; }
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

  // ---------- platform admin login (separate from any account's logins) ----------
  const DAYS = 14;
  const adminOf = (req) => { const s = P().sessions[h.sha(h.cookies(req).psid || '')]; return s && s.expires > Date.now() ? P().admins.find((a) => a.id === s.adminId) : null; };
  const pub = (a) => a && { id: a.id, name: a.name, email: a.email };
  function startSession(res, a) {
    const tok = crypto.randomBytes(32).toString('hex'); const now = Date.now();
    for (const [k, s] of Object.entries(P().sessions)) if (s.expires < now) delete P().sessions[k];
    P().sessions[h.sha(tok)] = { adminId: a.id, expires: now + DAYS * 864e5 }; tenancy.savePlatform();
    res.setHeader('Set-Cookie', `psid=${tok}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${DAYS * 86400}${secure}`);
  }
  app.get('/api/platform/state', (req, res) => res.json({ needsSetup: !P().admins.length, admin: pub(adminOf(req)), productName: P().settings.productName, brand: brandLib.brand() }));
  app.post('/api/platform/setup', (req, res) => { // first visit only: create the platform owner
    if (P().admins.length) return res.status(403).json({ error: 'The Alpha owner already exists. Log in instead.' });
    const b = req.body || {}; const name = String(b.name || '').trim(); const email = h.normEmail(b.email);
    if (!name || !email.includes('@')) return res.status(400).json({ error: 'Enter your name and email address' });
    if (String(b.password || '').length < 10) return res.status(400).json({ error: 'Use a password with at least 10 characters' });
    const { salt, hash } = h.hashPassword(b.password);
    const a = { id: crypto.randomBytes(5).toString('hex'), name, email, salt, passwordHash: hash, createdAt: new Date().toISOString() };
    P().admins.push(a); if (!P().settings.contactEmail) P().settings.contactEmail = email; startSession(res, a); res.json(pub(a));
  });
  app.post('/api/platform/login', (req, res) => {
    const email = h.normEmail(req.body && req.body.email); const key = 'platform|' + email + '|' + req.socket.remoteAddress;
    if (h.tooMany(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    const a = P().admins.find((x) => x.email === email);
    if (!a || !h.checkPassword(String((req.body && req.body.password) || ''), a)) { h.recordFailure(key); return res.status(401).json({ error: 'That email and password don’t match' }); }
    h.clearFailures(key); startSession(res, a); res.json(pub(a));
  });
  app.post('/api/platform/logout', (req, res) => {
    delete P().sessions[h.sha(h.cookies(req).psid || '')]; tenancy.savePlatform();
    res.setHeader('Set-Cookie', 'psid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); res.json({ ok: true });
  });
  app.use('/api/platform', (req, res, next) => (adminOf(req) ? next() : res.status(401).json({ error: 'Please log in' })));

  // ---------- accounts ----------
  const accountRow = (t) => (tenancy.expireIfDue(t), {
    id: t.id, expiresAt: t.expiresAt || '', expiredOn: t.expiredOn || '', name: t.name, slug: t.slug, planId: t.planId, status: t.status, createdAt: t.createdAt, isDefault: tenancy.isDefault(t),
    url: tenancy.tenantUrl(t), subdomainUrl: tenancy.subdomainUrl(t), domains: t.domains || [], ...h.tenantStats(t),
    support: support.summary(t),
    billing: t.billing ? { status: t.billing.status, paidAt: t.billing.paidAt || null, discountCode: t.billing.discount ? t.billing.discount.code : '', demo: !!t.billing.demo, subscriptionStatus: t.billing.subscriptionStatus || null, pausedForBilling: !!t.billing.pausedForBilling } : null,
  });
  app.get('/api/platform/overview', (req, res) => {
    res.json({ settings: P().settings, plans: P().plans, betaFeatures: P().betaFeatures, features: catalog(), alwaysIncluded: tenancy.ALWAYS_INCLUDED, accounts: P().tenants.map(accountRow), rootDomain: tenancy.ROOT_DOMAIN, devMode: tenancy.devMode, admin: pub(adminOf(req)), reservedSlugs: P().reservedSlugs, inquiries: P().inquiries, feedback: P().feedback || [], discounts: discounts.listView() });
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
    if ('planId' in b) { if (!P().plans.some((p) => p.id === b.planId)) return res.status(400).json({ error: 'Choose a plan' }); t.planId = b.planId; }
    if ('expiresAt' in b) { const v = String(b.expiresAt || ''); const ex = expiryProblem(v, t); if (ex) return res.status(400).json({ error: ex }); if (v) t.expiresAt = v; else delete t.expiresAt; }
    if (b.status === 'active' && t.expiresAt && t.expiresAt < today()) return res.status(400).json({ error: `Its last day of access (${t.expiresAt}) has passed. Choose a later date or remove it to resume the account.` });
    if (b.status === 'active') delete t.expiredOn;
    if ('status' in b) { if (!['active', 'suspended'].includes(b.status)) return res.status(400).json({ error: 'Unknown status' }); if (b.status === 'suspended' && tenancy.isDefault(t)) return res.status(400).json({ error: 'The default account can’t be paused' }); t.status = b.status; }
    tenancy.savePlatform(); res.json(accountRow(t));
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
      email: h.emailProvider() || '', mailServer: P().mailServer ? { host: P().mailServer.host, user: P().mailServer.user, from: P().mailServer.from } : null, envEmail: process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? `Gmail (${process.env.GMAIL_USER})` : process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM ? 'SendGrid' : '', sms: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM), ai: !!process.env.ANTHROPIC_API_KEY,
      stripe: { key: !!key, mode: key ? stripe.modeOf(key) : null, keyVar: process.env.BILLING_STRIPE_SECRET_KEY ? 'BILLING_STRIPE_SECRET_KEY' : key ? 'STRIPE_SECRET_KEY' : null,
        billingWebhook: !!process.env.BILLING_STRIPE_WEBHOOK_SECRET, connectWebhook: !!process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
        billingWebhookUrl: `${base}/api/site/stripe-webhook`, connectWebhookUrl: `${base}/api/site/stripe-connect-webhook` },
      baseUrl: process.env.BASE_URL || '', platformDomain: tenancy.PLATFORM_DOMAIN, localhost: /localhost|127\.0\.0\.1/.test(base),
      connected: P().tenants.filter((t) => t.stripeAccountId).length,
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
  app.delete('/api/platform/logo/:kind', (req, res) => { if (!['light', 'dark'].includes(req.params.kind)) return res.status(404).json({ error: 'Unknown logo' }); brandLib.remove(req.params.kind); res.json(P().settings); });
  // ---------- discount codes (lib/discounts.js) ----------
  const discDo = (fn) => (req, res) => { try { fn(req); res.json(discounts.listView()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  app.post('/api/platform/discounts', discDo((req) => discounts.create(req.body || {})));
  app.put('/api/platform/discounts/:id', discDo((req) => discounts.update(req.params.id, req.body || {})));
  app.delete('/api/platform/discounts/:id', discDo((req) => discounts.remove(req.params.id)));
  // ---------- the referral program (lib/referrals.js) ----------
  app.get('/api/platform/referrals', (req, res) => res.json(referrals.adminView()));
  app.put('/api/platform/referrals/program', (req, res) => { try { referrals.saveProgram(req.body || {}); res.json(referrals.adminView()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
  app.post('/api/platform/referrals/rewards/:id', (req, res) => { try { referrals.markReward(req.params.id, req.body && req.body.status); res.json(referrals.adminView()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
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
      ids.add(id); out.push({ id, name, ...priced, price: stripe.planPriceText(priced), description: String(p.description || '').trim().slice(0, 200), maxUsers, features: [...new Set((p.features || []).filter((k) => tenancy.FEATURE_KEYS.includes(k)))], ...(p.hidden ? { hidden: true } : {}) });
    }
    const orphan = P().tenants.find((t) => !ids.has(t.planId));
    if (orphan) return res.status(400).json({ error: `${orphan.name} is on the plan you removed. Move it to another plan first.` });
    if (out.every((p) => p.hidden)) return res.status(400).json({ error: 'Keep at least one plan visible on the pricing page' });
    if (Array.isArray(req.body.betaFeatures)) P().betaFeatures = tenancy.FEATURE_KEYS.filter((k) => req.body.betaFeatures.includes(k));
    P().plans = out; if (!out.some((p) => p.id === P().settings.signupPlan && !p.hidden)) P().settings.signupPlan = out.find((p) => !p.hidden).id;
    tenancy.savePlatform(); res.json({ plans: P().plans, betaFeatures: P().betaFeatures });
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
  app.delete('/api/platform/feedback/:id', (req, res) => { P().feedback = (P().feedback || []).filter((m) => m.id !== req.params.id); tenancy.savePlatform(); res.json(P().feedback); });
  app.delete('/api/platform/inquiries/:id', (req, res) => { P().inquiries = P().inquiries.filter((m) => m.id !== req.params.id); tenancy.savePlatform(); res.json(P().inquiries); });
  app.delete('/api/platform/reserved/:slug', (req, res) => { releaseSlug(req.params.slug); res.json(P().reservedSlugs); });

  app.put('/api/platform/settings', (req, res) => {
    const b = req.body || {}; const s = P().settings;
    if ('productName' in b) { const n = String(b.productName || '').trim().slice(0, 60); if (!n) return res.status(400).json({ error: 'Enter a product name' }); s.productName = n; }
    if ('contactEmail' in b) { const e = h.normEmail(b.contactEmail); if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ error: 'Enter a valid contact email' }); s.contactEmail = e; }
    for (const k of ['expiryBannerDays', 'expiryReminderDays']) if (k in b) { const n = Math.floor(Number(b[k])); if (!(n >= 0 && n <= 60)) return res.status(400).json({ error: 'Use a number of days from 0 to 60' }); s[k] = n; }
    if ('logoHasName' in b) s.logoHasName = b.logoHasName === true || b.logoHasName === 'on';
    if ('legalName' in b) s.legalName = String(b.legalName || '').trim().slice(0, 120);
    if ('governingLaw' in b) s.governingLaw = String(b.governingLaw || '').trim().slice(0, 80);
    if ('allowSignups' in b) s.allowSignups = b.allowSignups === true || b.allowSignups === 'on';
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
