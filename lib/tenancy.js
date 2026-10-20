// Hosting many companies (accounts) on one server.
// Each account has its own data file and uploads folder, and is reached at <slug>.<PLATFORM_DOMAIN> or its own verified domain.
// A request runs "inside" its account (AsyncLocalStorage), so server code keeps using the one `db` object it always had.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

// DATA_DIR: where data and uploads are kept; point it at a persistent disk when hosting (a folder outside the deployed code, so redeploys keep it)
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
const PLATFORM_FILE = path.join(DATA_DIR, 'platform.json');
const PORT = process.env.PORT || 4000;
// PLATFORM_DOMAIN: the domain you sell from (e.g. jobmonkey.app). Accounts live at <slug>.<PLATFORM_DOMAIN>.
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
  { key: 'staffSchedules', group: 'Team', label: 'Staff schedules', desc: 'Weekly schedule and availability for each team member', pages: ['/staff-schedules'] },
  { key: 'signatures', group: 'Team', label: 'On-site signatures', desc: 'Collect a client’s signature on a job', api: [['POST', /^\/api\/jobs\/[^/]+\/signature$/]] },
  { key: 'gallery', group: 'Team', label: 'Project photo gallery', desc: 'Before, progress and after photos on jobs', pages: ['/project-gallery'], api: [['*', /^\/api\/photos(\/|$)/]] },
  { key: 'clientPortal', group: 'Clients', label: 'Client portal', desc: 'Clients see their visits, quotes and invoices and send work requests' , api: [['*', /^\/api\/portal\//]] },
  { key: 'referrals', group: 'Clients', label: 'Referral links', desc: 'Clients share a link; referred friends arrive as leads' },
  { key: 'clientImport', group: 'Clients', label: 'Client import & merge', desc: 'Import clients from a CSV file and merge duplicates', pages: ['/clients/import'], api: [['POST', /^\/api\/clients\/(import|merge)$/]] },
  { key: 'sms', group: 'Messages', label: 'Text messages', desc: 'Send quotes, invoices and reminders by text' },
  { key: 'emailTemplates', group: 'Messages', label: 'Custom email templates', desc: 'Edit the wording of quote, invoice and reminder emails', pages: ['/settings/emails'], api: [['PUT', /^\/api\/email-templates\//], ['DELETE', /^\/api\/email-templates\//]] },
  { key: 'expenses', group: 'Money', label: 'Expenses', desc: 'Track expenses and link them to jobs', pages: ['/expenses'], api: [['*', /^\/api\/expenses(\/|$)/]] },
  { key: 'reports', group: 'Money', label: 'Financial reports', desc: 'Revenue by month and popular services', pages: ['/reports'], api: [['GET', /^\/api\/reports$/]] },
  { key: 'taxSummary', group: 'Money', label: 'Tax summary', desc: 'Sales tax collected by month', pages: ['/tax-summary'], api: [['GET', /^\/api\/tax-summary$/]] },
  { key: 'ai', group: 'Extras', label: 'AI descriptions', desc: '“Write with AI” drafts product and service descriptions', api: [['POST', /^\/api\/services\/describe$/]] },
  { key: 'branding', group: 'Extras', label: 'Custom branding', desc: 'Own logo, brand color and browser icon', api: [['POST', /^\/api\/company\/(logo|icon)$/], ['DELETE', /^\/api\/company\/logo$/]] },
  { key: 'customDomain', group: 'Extras', label: 'Custom domain', desc: 'Use their own web address (e.g. app.theirbusiness.com)', api: [['*', /^\/api\/account\/domains/]] },
];
const FEATURE_KEYS = FEATURES.map((f) => f.key);
const ALWAYS_INCLUDED = ['Home dashboard', 'Clients', 'Jobs', 'Job calendar', 'Team members', 'Notifications log', 'Company profile & settings', 'Own web address (subdomain)'];
const pick = (...keys) => keys;
const CORE = pick('quotes', 'invoices', 'services', 'zelle', 'clientPortal', 'signatures');
const ADVANCED = [...CORE, 'staffSchedules', 'expenses', 'reports', 'gallery', 'emailTemplates', 'clientImport', 'sms', 'onlinePayments', 'branding'];
const DEFAULT_PLANS = [
  { id: 'core', name: 'Core', price: '$29/month', description: 'The essentials for a small crew.', maxUsers: 1, features: CORE },
  { id: 'advanced', name: 'Advanced', price: '$59/month', description: 'Payments, texting, reports and a bigger team.', maxUsers: 10, features: ADVANCED },
  { id: 'expert', name: 'Expert', price: '$99/month', description: 'Everything, including AI and your own domain.', maxUsers: 0, features: [...FEATURE_KEYS] },
];
// hidden plans never show on the pricing page or at checkout; only the platform owner can put an account on one
const TRIAL_PLAN = { id: 'trial', name: 'Trial', price: 'Free', description: 'Try everything free, by invitation.', maxUsers: 3, features: [...FEATURE_KEYS], hidden: true };

// ---------- platform store: plans, accounts, platform admins ----------
let platform;
const savePlatform = () => fs.writeFileSync(PLATFORM_FILE, JSON.stringify(platform, null, 2));
const RESERVED = new Set(['www', 'admin', 'api', 'app', 'mail', 'email', 'smtp', 'ftp', 'platform', 'static', 'assets', 'cdn', 'help', 'support', 'billing', 'status', 'blog', 'docs', 'ns1', 'ns2', 'signup', 'login', 'dashboard']);
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');
// reservedSlugs: addresses the platform owner holds back (Platform → Settings); only the owner can give them to an account
function slugProblem(slug, exceptId, { allowReserved = false } = {}) {
  if (!SLUG_RE.test(slug)) return 'Use 3–32 lowercase letters, numbers or dashes (not at the start or end)';
  if (RESERVED.has(slug)) return 'That address is reserved. Choose another.';
  if (!allowReserved && platform.reservedSlugs.some((r) => r.slug === slug)) return 'That address is reserved. Choose another.';
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
      settings: { productName: 'Job Monkey', contactEmail: '', allowSignups: false, signupPlan: 'core' },
      plans: [...DEFAULT_PLANS],
      tenants: [{ id: 'main', slug, name, planId: 'expert', status: 'active', domains: [], dir: '.', createdAt: new Date().toISOString().slice(0, 10) }],
      defaultTenantId: 'main', admins: [], sessions: {},
    };
  }
  platform.settings = { productName: 'Job Monkey', contactEmail: '', allowSignups: false, signupPlan: 'core', ...(platform.settings || {}) };
  platform.admins = platform.admins || []; platform.reservedSlugs = platform.reservedSlugs || []; platform.inquiries = platform.inquiries || []; platform.sessions = platform.sessions || {}; platform.resetTokens = platform.resetTokens || {};
  if (!platform.trialPlanAdded) { if (!platform.plans.some((p) => p.id === TRIAL_PLAN.id)) platform.plans.push({ ...TRIAL_PLAN, features: [...TRIAL_PLAN.features] }); platform.trialPlanAdded = true; } // once, so deleting it sticks
  for (const p of platform.plans) p.features = (p.features || []).filter((k) => FEATURE_KEYS.includes(k)); // drop features that no longer exist
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

function init(h) { Object.assign(hooks, h); loadPlatform(); }

module.exports = {
  init, db, run, current, store, saveStore, replaceStore, storeOf, uploadDir, isDefault,
  platform: () => platform, savePlatform, resolve, tenantUrl, subdomainUrl, platformUrl, hostOnly,
  FEATURES, FEATURE_KEYS, ALWAYS_INCLUDED, DEFAULT_PLANS, planOf, featuresOf, has, lockedPages, lockedFeatureFor,
  slugify, slugProblem, SLUG_RE, RESERVED, domainProblem, checkDns, createTenant, deleteTenant,
  PLATFORM_DOMAIN, ROOT_DOMAIN, devMode, DATA_DIR,
};
