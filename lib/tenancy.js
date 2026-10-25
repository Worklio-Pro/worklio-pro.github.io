// Hosting many companies (accounts) on one server.
// Each account has its own data file and uploads folder, and is reached at <slug>.<PLATFORM_DOMAIN> or its own verified domain.
// A request runs "inside" its account (AsyncLocalStorage), so server code keeps using the one `db` object it always had.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const stripe = require('./stripe'); // plan price helpers

// DATA_DIR: where data and uploads are kept; point it at a persistent disk when hosting (a folder outside the deployed code, so redeploys keep it)
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
const PLATFORM_FILE = path.join(DATA_DIR, 'platform.json');
const PORT = process.env.PORT || 4000;
// PLATFORM_DOMAIN: the domain you sell from (e.g. yourapp.com). Accounts live at <slug>.<PLATFORM_DOMAIN>.
// Unset (local development): every unknown address opens the default account, and <slug>.localhost:<port> opens the others.
const PLATFORM_DOMAIN = String(process.env.PLATFORM_DOMAIN || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
const devMode = !PLATFORM_DOMAIN;
const ROOT_DOMAIN = PLATFORM_DOMAIN || `localhost:${PORT}`;
const PROTO = /^https:/.test(process.env.BASE_URL || '') ? 'https' : 'http';

// ---------- features a plan can include ----------
// pages: app pages that need it. api: [method ('*' = any), path pattern] the server refuses without it.
// Some features are also checked in code (text messages, card payments, Zelle, referrals, branding).
const FEATURES = [
  { key: 'quotes', group: 'Sales', label: 'Quotes', desc: 'Quotes clients approve and sign online, with deposits', pages: ['/quotes', '/quotes/new', '/quotes/edit'], api: [['*', /^\/api\/quotes(\/|$)/]] },
  { key: 'invoices', group: 'Sales', label: 'Invoices', desc: 'Invoices with online pay links and payment tracking', pages: ['/invoices', '/invoices/new', '/invoices/edit'], api: [['*', /^\/api\/invoices(\/|$)/], ['POST', /^\/api\/jobs\/[^/]+\/create-invoice$/]] },
  { key: 'services', group: 'Sales', label: 'Products & services catalog', desc: 'Saved products and services with prices', pages: ['/services'], api: [['*', /^\/api\/services(\/|$)/]] },
  { key: 'onlinePayments', group: 'Payments', label: 'Online card payments', desc: 'Clients pay invoices and deposits by card through the company’s own Stripe account', api: [['*', /^\/api\/integrations\/stripe(\/|$)/]] },
  { key: 'zelle', group: 'Payments', label: 'Zelle payments', desc: 'Zelle instructions on invoices and quotes' },
  { key: 'customRoles', group: 'Team', label: 'Custom roles & permissions', desc: 'Create team roles (plus Admin) and choose what each can see and do. Without it: Owner, Manager and Team Member', pages: ['/settings/roles'], api: [['PUT', /^\/api\/roles$/]] },
  { key: 'timeOff', group: 'Team', label: 'Time-off requests', desc: 'Team members ask for time off; managers approve it, see who’s off and take them off affected jobs', pages: ['/requests'], api: [['*', /^\/api\/time-off(\/|$)/]] },
  { key: 'signatures', group: 'Team', label: 'On-site signatures', desc: 'Collect a client’s signature on a job', api: [['POST', /^\/api\/jobs\/[^/]+\/signature$/]] },
  { key: 'gallery', group: 'Team', label: 'Project photo gallery', desc: 'Before, progress and after photos on jobs', pages: ['/project-gallery'], api: [['*', /^\/api\/photos(\/|$)/]] },
  { key: 'clientPortal', group: 'Clients', label: 'Client portal', desc: 'Clients see their visits, quotes and invoices and send work requests' , api: [['*', /^\/api\/portal\//]] },
  { key: 'referrals', group: 'Clients', label: 'Referral links', desc: 'Clients share a link; referred friends arrive as leads' },
  { key: 'reviews', group: 'Clients', label: 'Google reviews', desc: 'See and reply to Google reviews in the app (Google Business Profile connection)', pages: ['/reviews'], api: [['*', /^\/api\/reviews(\/|$)/]] },
  { key: 'onlineBooking', group: 'Clients', label: 'Online booking', desc: 'A booking page for new clients, linked from Google and the business’s website' },
  { key: 'clientImport', group: 'Clients', label: 'Client import & merge', desc: 'Import clients from a CSV file and merge duplicates', pages: ['/clients/import'], api: [['POST', /^\/api\/clients\/(import|merge)$/]] },
  { key: 'sms', group: 'Messages', label: 'Text messages', desc: 'Send quotes, invoices and reminders by text' },
  { key: 'numberPrefixes', group: 'Sales', label: 'Custom number prefixes', desc: 'Choose the letters in front of quote, job and invoice numbers (e.g. INV-)' },
  { key: 'emailTemplates', group: 'Messages', label: 'Custom email templates', desc: 'Edit the wording of quote, invoice and reminder emails', pages: ['/settings/emails'], api: [['PUT', /^\/api\/email-templates\//], ['DELETE', /^\/api\/email-templates\//]] },
  { key: 'expenses', group: 'Money', label: 'Expenses', desc: 'Track expenses and link them to jobs', pages: ['/expenses'], api: [['*', /^\/api\/expenses(\/|$)/]] },
  { key: 'reports', group: 'Money', label: 'Financial reports', desc: 'Revenue by month and popular services', pages: ['/reports'], api: [['GET', /^\/api\/reports$/]] },
  { key: 'taxSummary', group: 'Money', label: 'Tax summary', desc: 'Sales tax collected by month', pages: ['/tax-summary'], api: [['GET', /^\/api\/tax-summary$/]] },
  { key: 'ai', group: 'Extras', label: 'AI descriptions', desc: '“Write with AI” drafts product and service descriptions, in the catalog and on quote, invoice and job lines', api: [['POST', /^\/api\/services\/describe$/]] },
  { key: 'socialPosts', group: 'Extras', label: 'Social media posts', desc: 'Post project photos to Facebook and Instagram', pages: ['/social-posts'], api: [['*', /^\/api\/social-posts(\/|$)/]] },
  { key: 'branding', group: 'Extras', label: 'Custom branding', desc: 'Own logo, brand color and browser icon', api: [['POST', /^\/api\/company\/(logo|icon)$/], ['DELETE', /^\/api\/company\/logo$/]] },
  { key: 'customDomain', group: 'Extras', label: 'Custom domain', desc: 'Use their own web address (e.g. app.theirbusiness.com)', api: [['*', /^\/api\/account\/domains/]] },
];
const FEATURE_KEYS = FEATURES.map((f) => f.key);
const ALWAYS_INCLUDED = ['Home dashboard', 'Clients', 'Jobs', 'Calendar', 'Team members', 'Notifications log', 'Company profile & settings', 'Own web address (subdomain)'];
const pick = (...keys) => keys;
const CORE = pick('quotes', 'invoices', 'services', 'zelle', 'clientPortal', 'signatures');
const ADVANCED = [...CORE, 'reviews', 'onlineBooking', 'socialPosts', 'expenses', 'reports', 'gallery', 'emailTemplates', 'clientImport', 'sms', 'onlinePayments', 'branding', 'numberPrefixes'];
const DEFAULT_PLANS = [
  { id: 'core', name: 'Core', monthly: 29, yearly: 290, price: '$29/month or $290/year', description: 'The essentials for a small crew.', maxUsers: 1, features: CORE },
  { id: 'advanced', name: 'Advanced', monthly: 59, yearly: 590, price: '$59/month or $590/year', description: 'Payments, texting, reports and a bigger team.', maxUsers: 10, features: ADVANCED },
  { id: 'expert', name: 'Expert', monthly: 99, yearly: 990, price: '$99/month or $990/year', description: 'Everything, including AI and your own domain.', maxUsers: 0, features: [...FEATURE_KEYS] },
];
// hidden plans never show on the pricing page or at checkout; only the platform owner can put an account on one
const TRIAL_PLAN = { id: 'trial', name: 'Trial', monthly: null, yearly: null, priceLabel: 'Free', price: 'Free', description: 'Try everything free, by invitation.', maxUsers: 3, features: [...FEATURE_KEYS], hidden: true };

// ---------- platform store: plans, accounts, platform admins ----------
let platform;
const savePlatform = () => fs.writeFileSync(PLATFORM_FILE, JSON.stringify(platform, null, 2));
// addresses the platform itself may need some day (its own sites, email and DNS, look-alikes of sign-in or payment pages); no account can ever take one
const RESERVED = new Set([
  'www', 'www1', 'www2', 'web', 'site', 'home', 'admin', 'administrator', 'root', 'sysadmin', 'superuser', 'owner', 'staff', 'team', 'internal', 'intranet', 'platform',
  'api', 'apis', 'app', 'apps', 'mobile', 'ios', 'android', 'desktop', 'download', 'downloads', 'developer', 'developers', 'dev', 'sandbox', 'staging', 'stage', 'test', 'testing', 'demo', 'beta', 'alpha', 'preview', 'qa', 'uat', 'prod', 'production', 'local', 'localhost',
  'mail', 'email', 'emails', 'smtp', 'imap', 'pop', 'pop3', 'mx', 'webmail', 'send', 'bounce', 'bounces', 'newsletter', 'news', 'autodiscover', 'autoconfig', 'ftp', 'sftp', 'ssh', 'vpn', 'dns', 'ns1', 'ns2', 'ns3', 'ns4',
  'static', 'assets', 'cdn', 'img', 'images', 'media', 'files', 'uploads', 'storage', 'backup', 'backups',
  'help', 'support', 'docs', 'documentation', 'faq', 'guide', 'guides', 'learn', 'academy', 'community', 'forum', 'forums', 'chat', 'contact', 'feedback', 'status', 'blog', 'about', 'press', 'careers', 'jobs', 'legal', 'privacy', 'terms', 'security', 'trust', 'abuse', 'compliance',
  'signup', 'register', 'join', 'login', 'logout', 'signin', 'auth', 'oauth', 'sso', 'account', 'accounts', 'my', 'profile', 'secure', 'password', 'verify', 'dashboard', 'portal', 'console', 'manage',
  'billing', 'pay', 'payment', 'payments', 'checkout', 'invoice', 'invoices', 'quote', 'quotes', 'book', 'booking', 'bookings', 'schedule', 'store', 'shop', 'pricing', 'plans', 'upgrade', 'subscribe', 'wallet', 'stripe',
  'link', 'links', 'url', 'short', 'track', 'tracking', 'analytics', 'stats', 'metrics', 'events', 'webhook', 'webhooks', 'hooks', 'sms', 'text', 'voice', 'call', 'calls',
  'partner', 'partners', 'affiliate', 'affiliates', 'referral', 'referrals', 'reseller', 'resellers', 'marketplace', 'integrations', 'social',
  'tiktok', 'facebook', 'instagram', 'meta', 'messenger', 'whatsapp', 'threads', 'twitter', 'youtube', 'linkedin', 'pinterest', 'snapchat', 'reddit', 'nextdoor', 'yelp', 'google', 'gmb',
  'bluesky', 'mastodon', 'tumblr', 'discord', 'telegram', 'signal', 'wechat', 'twitch', 'vimeo', 'quora', 'medium', 'substack', 'thumbtack', 'angi', 'houzz', 'bbb',
  'official', 'null', 'undefined', 'example', 'default',
]);
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');
// reservedSlugs: addresses the platform owner holds back (Platform → Settings); only the owner can give them to an account
function slugProblem(slug, exceptId, { allowReserved = false } = {}) {
  if (!SLUG_RE.test(slug)) return 'Use 3–32 lowercase letters, numbers or dashes (not at the start or end)';
  if (RESERVED.has(slug)) return 'That address is reserved. Choose another.';
  if (!allowReserved && platform.reservedSlugs.some((r) => r.slug === slug)) return 'That address is reserved. Choose another.';
  if (!allowReserved && slug.startsWith('worklio')) return 'That address is reserved. Choose another.'; // anything that passes for us
  if (platform.tenants.some((t) => t.slug === slug && t.id !== exceptId)) return 'Another account already uses that address';
  return '';
}
function loadPlatform() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(PLATFORM_FILE)) { platform = JSON.parse(fs.readFileSync(PLATFORM_FILE, 'utf8')); }
  else {
    // first start of the multi-company version: the existing business (data/db.json) becomes the default account, files stay where they are
    let name = 'My Business';
    try { name = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'db.json'), 'utf8')).company.name || name; } catch (e) { /* new install */ }
    const slug = slugify(name).length >= 3 && !RESERVED.has(slugify(name)) ? slugify(name) : 'main';
    platform = {
      settings: { productName: 'Worklio Pro', contactEmail: '', allowSignups: false, signupPlan: 'core' },
      plans: [...DEFAULT_PLANS],
      tenants: [{ id: 'main', slug, name, planId: 'expert', status: 'active', domains: [], dir: '.', createdAt: new Date().toISOString().slice(0, 10) }],
      defaultTenantId: 'main', admins: [], sessions: {},
    };
  }
  platform.settings = { productName: 'Worklio Pro', contactEmail: '', allowSignups: false, signupPlan: 'core', ...(platform.settings || {}) };
  if (platform.settings.productName === 'Job Monkey') platform.settings.productName = 'Worklio Pro'; // the old default name
  platform.admins = platform.admins || []; platform.reservedSlugs = platform.reservedSlugs || []; platform.inquiries = platform.inquiries || []; platform.feedback = platform.feedback || []; platform.sessions = platform.sessions || {}; platform.resetTokens = platform.resetTokens || {};
  if (!platform.trialPlanAdded) { if (!platform.plans.some((p) => p.id === TRIAL_PLAN.id)) platform.plans.push({ ...TRIAL_PLAN, features: [...TRIAL_PLAN.features] }); platform.trialPlanAdded = true; } // once, so deleting it sticks
  for (const p of platform.plans) if (!('monthly' in p) && !('yearly' in p)) { // plans from before monthly/yearly prices: read their price text once
    const c = stripe.parsePriceText(p.price); p.monthly = c && c.interval === 'month' ? c.cents / 100 : null; p.yearly = c && c.interval === 'year' ? c.cents / 100 : null;
    if (!c) p.priceLabel = p.price || ''; p.price = stripe.planPriceText(p);
  }
  if (!platform.numberPrefixesAdded) { for (const p of platform.plans) if (!(p.features || []).includes('numberPrefixes')) (p.features = p.features || []).push('numberPrefixes'); platform.numberPrefixesAdded = true; }
  if (!platform.timeOffAdded) { for (const p of platform.plans) if (['expert', 'trial'].includes(p.id) && !(p.features || []).includes('timeOff')) (p.features = p.features || []).push('timeOff'); platform.timeOffAdded = true; } // once: an extra on the top plans
  if (!platform.customRolesAdded) { for (const p of platform.plans) if (['expert', 'trial'].includes(p.id) && !(p.features || []).includes('customRoles')) (p.features = p.features || []).push('customRoles'); platform.customRolesAdded = true; } // once: an extra on the top plans; add it to others in Alpha → Plans
  if (!platform.socialAdded) { for (const p of platform.plans) if (p.id !== 'core') for (const k of ['reviews', 'onlineBooking', 'socialPosts']) if (!(p.features || []).includes(k)) (p.features = p.features || []).push(k); platform.socialAdded = true; } // once: the connection features go on every plan but Core; untick them in Alpha → Plans // once: plans from before prefixes were a feature keep them until you untick it
  if (!platform.trialCodeFixed) { // once, so deleting or editing it in Alpha → Pricing sticks: sign up with TRIAL26 for 30 days free, no card
    platform.discounts = platform.discounts || []; const old = platform.discounts.find((d) => d.code === 'TRIAL26');
    if (old && old.type !== 'trial') Object.assign(old, { type: 'trial', trialDays: 30, value: 0, duration: 'once', months: 0, active: true }); // a TRIAL26 made before trial codes existed (e.g. 100% off) becomes the no-card trial, keeping its rules
    else if (!old && !platform.trialCodeAdded) platform.discounts.push({ id: 'trial26', code: 'TRIAL26', note: '30-day free trial, no card', active: true, type: 'trial', trialDays: 30, value: 0, duration: 'once', months: 0,
      plans: [], interval: 'any', startsAt: '', endsAt: '', maxUses: 0, onePerEmail: true, uses: [], createdAt: new Date().toISOString() });
    platform.trialCodeAdded = platform.trialCodeFixed = true;
  }
  for (const p of platform.plans) p.features = (p.features || []).filter((k) => FEATURE_KEYS.includes(k)); // drop features that no longer exist
  platform.betaFeatures = (platform.betaFeatures || []).filter((k) => FEATURE_KEYS.includes(k)); // features marked "Beta" in the platform console
  savePlatform();
}

// ---------- account stores ----------
const hooks = { seed: null, emptySeed: null, migrate: null };
const als = new AsyncLocalStorage();
const stores = new Map(); // tenant id -> loaded data
const tenantDir = (t) => path.join(DATA_DIR, t.dir || path.join('tenants', t.id));
const dbFile = (t) => path.join(tenantDir(t), 'db.json');
function storeOf(t) {
  if (stores.has(t.id)) return stores.get(t.id);
  fs.mkdirSync(path.join(tenantDir(t), 'uploads'), { recursive: true });
  const s = fs.existsSync(dbFile(t)) ? JSON.parse(fs.readFileSync(dbFile(t), 'utf8')) : hooks.seed();
  stores.set(t.id, s);
  als.run({ tenant: t, store: s }, () => { hooks.migrate(); saveStore(); }); // bring data saved by older versions up to date
  return s;
}
const ctx = () => { const c = als.getStore(); if (!c) throw new Error('No account selected for this request'); return c; };
const current = () => ctx().tenant;
const store = () => ctx().store;
function saveStore() { const c = ctx(); fs.writeFileSync(dbFile(c.tenant), JSON.stringify(c.store, null, 2)); }
function replaceStore(obj) { const c = ctx(); for (const k of Object.keys(c.store)) delete c.store[k]; Object.assign(c.store, obj); saveStore(); }
const run = (t, fn) => als.run({ tenant: t, store: storeOf(t) }, fn);
const uploadDir = () => path.join(tenantDir(current()), 'uploads');
// `db` for server code: always the data of the account the current request belongs to
const db = new Proxy({}, {
  get: (_, k) => store()[k],
  set: (_, k, v) => { store()[k] = v; return true; },
  deleteProperty: (_, k) => delete store()[k],
  has: (_, k) => k in store(),
  ownKeys: () => Reflect.ownKeys(store()),
  getOwnPropertyDescriptor: (_, k) => { const d = Reflect.getOwnPropertyDescriptor(store(), k); if (d) d.configurable = true; return d; },
});

// ---------- plans and features ----------
const planOf = (t) => platform.plans.find((p) => p.id === t.planId) || { id: t.planId, name: 'No plan', features: [], maxUsers: 1 };
const featuresOf = (t) => new Set(planOf(t).features);
const has = (key) => featuresOf(current()).has(key);
const isDefault = (t = current()) => t.id === platform.defaultTenantId;
// pages and API calls the current account's plan doesn't include
const isBeta = (key) => platform.betaFeatures.includes(key);
const betaPages = () => FEATURES.filter((x) => isBeta(x.key)).flatMap((x) => x.pages || []);
const lockedPages = (t) => { const f = featuresOf(t); return FEATURES.filter((x) => !f.has(x.key)).flatMap((x) => x.pages || []); };
function lockedFeatureFor(t, method, p) {
  const f = featuresOf(t);
  return FEATURES.find((x) => !f.has(x.key) && (x.api || []).some(([m, re]) => (m === '*' || m === method) && re.test(p)));
}

// ---------- web addresses ----------
const hostOnly = (h) => String(h || '').toLowerCase().replace(/:\d+$/, '');
// custom domains work only while the account's plan includes them (they come back if it's upgraded again)
const liveDomains = (t) => (featuresOf(t).has('customDomain') ? (t.domains || []).filter((d) => d.verified) : []);
const findByDomain = (host) => platform.tenants.find((t) => liveDomains(t).some((d) => d.host === host));
// which account (or the platform's own site) a Host header points at
function resolve(rawHost) {
  const host = String(rawHost || '').toLowerCase();
  const bare = hostOnly(host); const root = hostOnly(ROOT_DOMAIN);
  const suffix = '.' + root;
  if (bare.endsWith(suffix)) {
    const sub = bare.slice(0, -suffix.length);
    if (sub === 'www' && !devMode) return { kind: 'platform' };
    const t = platform.tenants.find((x) => x.slug === sub);
    return t ? { kind: 'tenant', tenant: t } : { kind: 'unknown' };
  }
  const byDomain = findByDomain(bare);
  if (byDomain) return { kind: 'tenant', tenant: byDomain };
  if (!devMode && bare === root) return { kind: 'platform' };
  if (devMode) return { kind: 'tenant', tenant: platform.tenants.find((t) => t.id === platform.defaultTenantId) || platform.tenants[0], dev: true };
  return { kind: 'unknown' };
}
const subdomainUrl = (t) => `${PROTO}://${t.slug}.${ROOT_DOMAIN}`;
// the address put in links (emails, texts, Stripe return pages): the primary verified domain, else the subdomain
function tenantUrl(t) {
  const live = liveDomains(t); const d = live.find((x) => x.primary) || live[0];
  if (d) return `${PROTO}://${d.host}`;
  if (devMode && isDefault(t) && process.env.BASE_URL) return process.env.BASE_URL.replace(/\/+$/, '');
  return subdomainUrl(t);
}
const platformUrl = () => (devMode ? (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, '') : `${PROTO}://${PLATFORM_DOMAIN}`);
// the help center: help.<platform domain> (help.localhost:<port> while developing); "help" is a reserved address, so no account can take it
const HELP_HOST = `help.${ROOT_DOMAIN}`;
const helpUrl = () => `${PROTO}://${HELP_HOST}`;
const isHelpHost = (raw) => hostOnly(raw) === hostOnly(HELP_HOST);
const DOMAIN_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
function domainProblem(host, t) {
  if (!DOMAIN_RE.test(host)) return 'Enter a domain like app.yourbusiness.com (no https:// or slashes)';
  if (host === hostOnly(ROOT_DOMAIN) || host.endsWith('.' + hostOnly(ROOT_DOMAIN))) return `Addresses on ${hostOnly(ROOT_DOMAIN)} are set by your account address`;
  const other = platform.tenants.find((x) => x.id !== t.id && (x.domains || []).some((d) => d.host === host));
  if (other) return 'Another account already uses that domain';
  return '';
}
// a domain is verified once its DNS points at this platform: a CNAME to the account's address (or the root), or the same A record
async function checkDns(host, t) {
  const dns = require('dns').promises;
  const targets = [`${t.slug}.${hostOnly(ROOT_DOMAIN)}`, hostOnly(ROOT_DOMAIN)];
  try { const c = await dns.resolveCname(host); if (c.some((x) => targets.includes(x.toLowerCase().replace(/\.$/, '')))) return { ok: true, how: 'CNAME' }; } catch (e) { /* no CNAME */ }
  try {
    const mine = new Set([...(process.env.SERVER_IP ? process.env.SERVER_IP.split(',').map((s) => s.trim()) : []), ...(devMode ? [] : await dns.resolve4(hostOnly(ROOT_DOMAIN)).catch(() => []))]);
    const theirs = await dns.resolve4(host);
    if (theirs.some((ip) => mine.has(ip))) return { ok: true, how: 'A record' };
    return { ok: false, detail: `${host} points to ${theirs.join(', ')}, not to this platform yet` };
  } catch (e) { return { ok: false, detail: `No DNS record found for ${host} yet. DNS changes can take up to a few hours.` }; }
}

// ---------- accounts ----------
function createTenant({ name, slug, planId, demo }) {
  const t = { id: crypto.randomBytes(6).toString('hex'), slug, name, planId, status: 'active', domains: [], createdAt: new Date().toISOString().slice(0, 10) };
  fs.mkdirSync(path.join(tenantDir(t), 'uploads'), { recursive: true });
  const s = demo ? hooks.seed() : hooks.emptySeed();
  s.company.name = name;
  fs.writeFileSync(dbFile(t), JSON.stringify(s, null, 2));
  platform.tenants.push(t); savePlatform();
  return t;
}
// deleting keeps a copy of the account's folder in data/deleted/, so a mistake can be undone by hand
function deleteTenant(t) {
  if (isDefault(t)) throw new Error('The default account can’t be deleted');
  const dest = path.join(DATA_DIR, 'deleted', `${t.slug}-${Date.now()}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(tenantDir(t))) fs.renameSync(tenantDir(t), dest);
  stores.delete(t.id); platform.tenants = platform.tenants.filter((x) => x.id !== t.id); savePlatform();
}

// a paid subscription has ended (cancelled, or switched to a free plan at the end of the period):
// move to the plan the owner picked, or pause the account until they subscribe again
// an account with a last day of access (t.expiresAt, set in Alpha) pauses the day after it; t.expiredOn remembers why. True when it just paused.
function expireIfDue(t) {
  if (!t.expiresAt || t.status !== 'active' || isDefault(t) || new Date().toISOString().slice(0, 10) <= t.expiresAt) return false;
  pause(t, t.billing && t.billing.status === 'trial' ? 'trial' : 'ended'); t.expiredOn = t.expiresAt; savePlatform(); return true;
}
// why a paused account is paused: 'trial' (its free trial or prepaid months ran out), 'ended' (its last day of access passed),
// 'cancelled' (a cancelled subscription ran out), 'billing' (a payment failed) or 'platform' (paused from Alpha).
// Accounts paused before the reason was recorded get it worked out from what's left.
function pauseReason(t) {
  if (t.status !== 'suspended') return null;
  if (t.pauseReason) return t.pauseReason;
  const b = t.billing || {};
  if (b.pausedForBilling) return 'billing';
  if (b.status === 'trial') return 'trial';
  return t.expiredOn ? 'ended' : 'platform';
}
// every reason but 'platform' is one the business fixes itself: choosing a plan, or updating its card
const reopenable = (t) => !isDefault(t) && !!pauseReason(t) && pauseReason(t) !== 'platform';
function pause(t, reason) {
  t.status = 'suspended'; t.pauseReason = reason; t.pausedOn = new Date().toISOString().slice(0, 10);
  if (reason === 'billing' || reason === 'cancelled') (t.billing || (t.billing = {})).pausedForBilling = true;
}
function resume(t) { t.status = 'active'; delete t.pauseReason; delete t.pausedOn; delete t.expiredOn; if (t.billing) delete t.billing.pausedForBilling; }
function endSubscription(t) {
  const b = t.billing || (t.billing = {});
  if (b.pendingPlanId && platform.plans.some((p) => p.id === b.pendingPlanId)) { t.planId = b.pendingPlanId; if (b.pausedForBilling || t.status === 'suspended') resume(t); delete b.pausedForBilling; }
  else if (!isDefault(t)) pause(t, b.endsAt ? 'cancelled' : 'billing'); // cancelled at the end of the period, or ended by failed payments
  delete b.pendingPlanId; delete b.endsAt; b.subscriptionId = null; b.subscriptionStatus = 'canceled'; savePlatform();
}
function init(h) { Object.assign(hooks, h); loadPlatform(); }

module.exports = {
  init, db, run, current, store, saveStore, replaceStore, storeOf, uploadDir, isDefault,
  platform: () => platform, savePlatform, resolve, tenantUrl, subdomainUrl, platformUrl, helpUrl, isHelpHost, hostOnly,
  FEATURES, FEATURE_KEYS, ALWAYS_INCLUDED, DEFAULT_PLANS, planOf, featuresOf, has, isBeta, betaPages, lockedPages, lockedFeatureFor,
  slugify, slugProblem, SLUG_RE, RESERVED, endSubscription, expireIfDue, pauseReason, reopenable, pause, resume, domainProblem, checkDns, createTenant, deleteTenant,
  PLATFORM_DOMAIN, ROOT_DOMAIN, devMode, DATA_DIR,
};
