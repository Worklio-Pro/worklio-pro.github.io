// Team roles: each business makes its own (Settings → Roles & Permissions). Owner and Admin are built in with full access;
// every other role is a name and a set of permissions from the catalog below. Each permission opens app pages and API routes,
// so the server and the app enforce exactly the same thing.
const ID = '[^/]+';
const route = (method, re) => [method, new RegExp('^/api/' + re + '$')];
const crypto = require('crypto');

// every login gets these: their own profile, password and hours, help, feedback, support access requests, and the basics pages load
const COMMON_API = [route('GET', 'auth/.+'), route('POST', 'auth/.+'), route('POST', 'support'), route('POST', 'feedback'), route('GET', 'account/support-access'),
  route('POST', `account/support-access/${ID}/(grant|decline|revoke)`), route('GET', '(company|staff)')];
const COMMON_PAGES = ['/profile', '/settings/support-access'];
// pages that list clients or services in a picker need to read them, even without the Clients or Products permission
const READ_PICKERS = [route('GET', 'clients'), route('GET', 'services')];

const PERMS = [
  { key: 'home', group: 'Operations', label: 'Home dashboard', desc: 'The Home page and the summary numbers above lists', pages: ['/business-overview'], api: [route('GET', 'overview')] },
  { key: 'schedule', group: 'Operations', label: 'Job calendar and staff schedules', desc: 'See the calendar and everyone’s weekly schedule', pages: ['/calendar', '/staff-schedules'], api: [route('GET', 'jobs')], feature: null },
  { key: 'clients.view', group: 'Clients', label: 'See clients', desc: 'Client list and details', pages: ['/clients'], api: [route('GET', 'clients')] },
  { key: 'clients.edit', group: 'Clients', label: 'Add and edit clients', needs: 'clients.view', api: [route('POST', 'clients'), route('PUT', `clients/${ID}`)] },
  { key: 'jobs.view', group: 'Jobs', label: 'See jobs', desc: 'Job details, notes and photos, and collect client signatures', pages: ['/jobs', '/jobs/edit'], api: [route('GET', 'jobs'), route('POST', `jobs/${ID}/signature`)] },
  { key: 'jobs.edit', group: 'Jobs', label: 'Create, edit and delete jobs', desc: 'Schedule and assign work, send reminders, mark jobs complete', needs: 'jobs.view', pages: ['/jobs/new'],
    api: [...READ_PICKERS, route('POST', 'jobs'), route('PUT', `jobs/${ID}`), route('DELETE', `jobs/${ID}`), route('POST', `jobs/${ID}/(remind|create-invoice)`), route('DELETE', `jobs/${ID}/signature`)] },
  { key: 'jobs.prices', group: 'Jobs', label: 'See prices on jobs', desc: 'Line items, totals and billing on jobs', needs: 'jobs.view' },
  { key: 'quotes', group: 'Sales', label: 'Quotes', desc: 'Create, edit, send and approve quotes and deposits', feature: 'quotes', pages: ['/quotes', '/quotes/new', '/quotes/edit'],
    api: [...READ_PICKERS, route('GET', '(quotes|email-templates)'), route('POST', 'quotes'), route('PUT', `quotes/${ID}`), route('DELETE', `quotes/${ID}`), route('POST', `quotes/${ID}/(send|approve|convert-to-job|mark-deposit-paid|set-deposit)`)] },
  { key: 'invoices', group: 'Sales', label: 'Invoices', desc: 'Create, edit and send invoices and record payments', feature: 'invoices', pages: ['/invoices', '/invoices/new', '/invoices/edit'],
    api: [...READ_PICKERS, route('GET', '(invoices|email-templates)'), route('POST', 'invoices'), route('PUT', `invoices/${ID}`), route('DELETE', `invoices/${ID}`), route('POST', `invoices/${ID}/(send|mark-paid|payments)`), route('DELETE', `invoices/${ID}/payments/${ID}`)] },
  { key: 'payments', group: 'Money', label: 'Payments', desc: 'See payments and payouts, download receipts and send them to clients', pages: ['/payments', '/payments/view'],
    api: [route('GET', '(quotes|invoices)'), route('GET', 'payments/stripe'), route('GET', 'payment-detail/[\\w-]+'), route('GET', 'payment-detail/[\\w-]+/pdf'), route('POST', 'payment-detail/[\\w-]+/receipt')] },
  { key: 'services', group: 'Money', label: 'Products & services', desc: 'Manage the price list', feature: 'services', pages: ['/services'], api: [route('GET', 'services'), route('POST', '(services|services/describe)'), route('PUT', `services/${ID}`), route('DELETE', `services/${ID}`)] },
  { key: 'expenses', group: 'Money', label: 'Expenses', feature: 'expenses', pages: ['/expenses'], api: [route('GET', 'expenses'), route('POST', 'expenses'), route('PUT', `expenses/${ID}`), route('DELETE', `expenses/${ID}`)] },
  { key: 'reports', group: 'Money', label: 'Financial reports and tax summary', feature: 'reports', pages: ['/reports', '/tax-summary'], api: [route('GET', '(reports|tax-summary)')] },
  { key: 'gallery', group: 'Records', label: 'Project gallery', desc: 'See and upload job photos', feature: 'gallery', pages: ['/project-gallery'], api: [route('GET', 'photos'), route('POST', 'photos'), route('DELETE', `photos/${ID}`)] },
  { key: 'notifications', group: 'Records', label: 'Notifications log', desc: 'Every email and text sent to clients', pages: ['/notifications'], api: [route('GET', 'notifications')] },
  { key: 'reviews', group: 'Marketing', label: 'Google reviews', desc: 'Read and reply to reviews', feature: 'reviews', pages: ['/reviews'], api: [route('GET', 'reviews'), route('PUT', 'reviews/reply'), route('DELETE', 'reviews/reply')] },
  { key: 'social', group: 'Marketing', label: 'Social posts', desc: 'Post to Facebook and Instagram', feature: 'socialPosts', pages: ['/social-posts'], api: [route('GET', 'social-posts'), route('POST', 'social-posts')] },
];
const KEYS = PERMS.map((p) => p.key);
const byKey = Object.fromEntries(PERMS.map((p) => [p.key, p]));

// the starting roles: exactly the access Manager and Technician had before roles could be edited
const DEFAULT_ROLES = [
  { id: 'manager', name: 'Manager', desc: 'Runs jobs, quotes and invoices, and the Money section', perms: ['home', 'schedule', 'clients.view', 'clients.edit', 'jobs.view', 'jobs.edit', 'jobs.prices', 'quotes', 'invoices', 'payments', 'services', 'expenses', 'reports', 'gallery', 'reviews', 'social'] },
  { id: 'technician', name: 'Technician', desc: 'Sees their jobs, clients and the schedule, without prices', perms: ['schedule', 'clients.view', 'jobs.view'] },
];
const defaults = () => JSON.parse(JSON.stringify(DEFAULT_ROLES));
// without the Custom roles feature (a paid plan feature): Owner plus these two fixed levels, with the same access as the starting roles
const fixed = () => [{ ...defaults()[0] }, { ...defaults()[1], name: 'Team Member' }];

// a permission that needs another (e.g. editing clients needs seeing them) brings it along
const complete = (perms) => { const s = new Set((perms || []).filter((k) => byKey[k])); for (const k of [...s]) if (byKey[k].needs) s.add(byKey[k].needs); return KEYS.filter((k) => s.has(k)); };
const isAdminRole = (role) => role === 'owner' || role === 'admin';
// what a login can do: owner/admin everything; anyone else their role's permissions (none if the role was deleted)
function permsOf(roles, role) { if (isAdminRole(role)) return [...KEYS]; const r = (roles || []).find((x) => x.id === role); return r ? complete(r.perms) : []; }
const can = (roles, role, key) => isAdminRole(role) || permsOf(roles, role).includes(key);
function routesFor(roles, role) { return [...COMMON_API, ...permsOf(roles, role).flatMap((k) => byKey[k].api || [])]; }
function pagesFor(roles, role) { return [...COMMON_PAGES, ...permsOf(roles, role).flatMap((k) => byKey[k].pages || [])]; }
const allows = (routes, method, path) => routes.some(([m, re]) => m === method && re.test(path));
const nameOf = (roles, role) => (role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : ((roles || []).find((x) => x.id === role) || {}).name || 'No role');

// save the whole list from the Roles & Permissions page; a role still given to someone can't be deleted
function validate(list, inUse) {
  const fail = (m) => Object.assign(new Error(m), { status: 400 });
  if (!Array.isArray(list)) throw fail('Nothing to save');
  if (list.length > 30) throw fail('Up to 30 roles');
  const out = []; const names = new Set();
  for (const r of list) {
    const name = String(r.name || '').trim().slice(0, 40); if (!name) throw fail('Give every role a name');
    const lower = name.toLowerCase(); if (lower === 'owner' || lower === 'admin') throw fail(`“${name}” is a built-in role. Choose another name.`);
    if (names.has(lower)) throw fail(`There are two roles named “${name}”`); names.add(lower);
    const id = /^[a-z0-9_-]{2,40}$/.test(r.id || '') && !isAdminRole(r.id) ? r.id : 'r' + crypto.randomBytes(4).toString('hex');
    out.push({ id, name, desc: String(r.desc || '').trim().slice(0, 160), perms: complete(r.perms) });
  }
  for (const [roleId, n] of Object.entries(inUse)) if (!isAdminRole(roleId) && n && !out.some((r) => r.id === roleId)) throw fail(`Move the ${n} team member${n === 1 ? '' : 's'} with that role to another role before deleting it`);
  return out;
}
// for the Roles & Permissions page: the catalog without routes
const catalog = () => PERMS.map(({ key, group, label, desc, needs, feature }) => ({ key, group, label, desc: desc || '', needs: needs || null, feature: feature || null }));

module.exports = { defaults, fixed, permsOf, can, routesFor, pagesFor, allows, nameOf, validate, catalog, isAdminRole, KEYS };
