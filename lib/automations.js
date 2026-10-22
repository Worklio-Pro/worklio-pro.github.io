// Automations (Alpha → Automations): emails to businesses sent on a schedule by rules.
// Each automation has a trigger (a moment in an account's life, or a set date), rules for which accounts qualify,
// a send time, and an email. The server checks every hour. An account gets each automation once per moment
// (e.g. once per signup; again for "inactive" only after someone logs in and goes quiet again), and every email
// carries an unsubscribe link. Stored in platform.json: automations, automationSent (who got what), automationLog.
const crypto = require('crypto');
const tenancy = require('./tenancy');
const emails = require('./emails');

const P = () => tenancy.platform();
const save = () => tenancy.savePlatform();
const DAY = 864e5;
const fail = (m) => Object.assign(new Error(m), { status: 400 });
let h = null; // helpers from lib/platform.js: stats(t), sendEmail(...), runAs(t, fn)

const TRIGGERS = {
  signup: 'days after an account signs up',
  inactive: 'days after anyone in the account last logged in',
  expiry: 'days before an account’s last day of access',
  paid: 'days after an account starts paying',
  date: 'on a date (one time)',
};
const STATUSES = { active: 'Active', pending: 'Awaiting payment', suspended: 'Paused' };
const VARS = { name: 'Recipient’s first name', business: 'Business name', plan: 'Plan name', account_url: 'The account’s web address', billing_url: 'Their Account and Billing page',
  days_left: 'Days until the last day of access', signup_date: 'Sign-up date', last_login: 'Last login date', clients: 'Number of clients', jobs: 'Number of jobs', invoices: 'Number of invoices', help_url: 'Help center' };

const list = () => (P().automations = P().automations || []);
const sent = () => (P().automationSent = P().automationSent || {});
const log = () => (P().automationLog = P().automationLog || []);
const optOut = () => (P().automationOptOut = P().automationOptOut || {});

// ---------- dates in the automation's time zone ----------
const partsIn = (tz, d = new Date()) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(d).map((p) => [p.type, p.value]));
const dayIn = (tz, d) => { const p = partsIn(tz, d); return `${p.year}-${p.month}-${p.day}`; };
const addDays = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10);
const nice = (ymd) => (ymd ? new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');

// ---------- the moment an automation is about, for one account (null: not applicable) ----------
// anchor: what the moment is tied to (so it's sent once per signup, once per end date, once per quiet spell…); due: the day it's due
function moment(a, t, s) {
  const tz = a.tz; const n = Number(a.days) || 0;
  if (a.trigger === 'signup') return t.createdAt ? { anchor: 'signup', due: addDays(dayIn(tz, new Date(t.createdAt)), n) } : null;
  if (a.trigger === 'inactive') { const last = s.lastLoginAt || t.createdAt; return last ? { anchor: 'login:' + last, due: addDays(dayIn(tz, new Date(last)), n) } : null; }
  if (a.trigger === 'expiry') return t.expiresAt ? { anchor: 'expiry:' + t.expiresAt, due: addDays(t.expiresAt, -n) } : null;
  if (a.trigger === 'paid') return t.billing && t.billing.paidAt ? { anchor: 'paid:' + t.billing.paidAt, due: addDays(dayIn(tz, new Date(t.billing.paidAt)), n) } : null;
  if (a.trigger === 'date') return a.date ? { anchor: 'date:' + a.date, due: a.date } : null;
  return null;
}
// the rules: plan, status, how much they use the app, card payments, a confirmed email
function matches(a, t, s) {
  const r = a.rules || {};
  if ((r.plans || []).length && !r.plans.includes(t.planId)) return false;
  if ((r.statuses || []).length && !r.statuses.includes(t.status)) return false;
  for (const k of ['clients', 'jobs', 'invoices']) {
    if (r[k + 'Min'] !== '' && r[k + 'Min'] != null && s[k] < Number(r[k + 'Min'])) return false;
    if (r[k + 'Max'] !== '' && r[k + 'Max'] != null && s[k] > Number(r[k + 'Max'])) return false;
  }
  if (r.cards === 'yes' && !t.stripeAccountId) return false;
  if (r.cards === 'no' && t.stripeAccountId) return false;
  if (r.confirmed === 'yes' && (!s.owner || s.owner.unconfirmed)) return false;
  if (r.confirmed === 'no' && !(s.owner && s.owner.unconfirmed)) return false;
  return true;
}
const key = (a, t, anchor) => `${a.id}|${t.id}|${anchor}`;
// is it time? the due day has come (and for a new automation, the moment came after it was turned on, unless it's told to catch up)
function due(a, t, s, now = new Date()) {
  const m = moment(a, t, s); if (!m) return null;
  const today = dayIn(a.tz, now); const p = partsIn(a.tz, now);
  if (m.due > today) return null;
  if (!a.catchUp && a.trigger !== 'date' && m.due < dayIn(a.tz, new Date(a.enabledAt || a.createdAt || Date.now()))) return null;
  if (a.trigger === 'expiry' && t.expiresAt < today) return null; // already over
  if (a.trigger === 'date' && m.due < today && !a.catchUp) return null; // a one-time send only on its day
  if (Number(p.hour) < Number(a.hour || 0)) return null;
  if (a.weekdays && ['Sat', 'Sun'].includes(p.weekday)) return null;
  return m;
}
const accounts = () => P().tenants.filter((t) => !tenancy.isDefault(t));
// who'd get it: everyone who qualifies now, whether it's due yet, and whether they already got it
function audience(a) {
  return accounts().map((t) => { const s = h.stats(t); const m = moment(a, t, s); return { t, s, m, ok: matches(a, t, s) }; })
    .filter((x) => x.m && x.ok).map((x) => ({ id: x.t.id, business: x.t.name, plan: (P().plans.find((p) => p.id === x.t.planId) || {}).name || x.t.planId, due: x.m.due,
      sent: !!sent()[key(a, x.t, x.m.anchor)], ready: !!due(a, x.t, x.s) && !sent()[key(a, x.t, x.m.anchor)], to: recipients(a, x.s).map((r) => r.email) }));
}
function recipients(a, s) {
  const people = a.to === 'admins' ? (s.logins || []).filter((l) => l.active && (l.role === 'owner' || l.role === 'admin')) : s.owner && s.owner.email ? [{ name: s.owner.name, email: s.owner.email }] : [];
  return people.filter((p) => p.email && !optOut()[p.email.toLowerCase()]);
}

// ---------- the email ----------
const unsubToken = (email) => crypto.createHmac('sha256', P().oauthStateKey || (P().oauthStateKey = crypto.randomBytes(32).toString('hex'))).update('unsub|' + email.toLowerCase()).digest('base64url').slice(0, 24);
const unsubUrl = (email) => `${tenancy.platformUrl()}/api/site/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
function varsFor(t, s, person) {
  const plan = P().plans.find((p) => p.id === t.planId) || {}; const url = tenancy.tenantUrl(t);
  const left = t.expiresAt ? Math.max(0, Math.round((Date.parse(t.expiresAt) - Date.parse(new Date().toISOString().slice(0, 10))) / DAY)) : '';
  return { name: String(person.name || '').split(/\s+/)[0] || 'there', business: t.name, plan: plan.name || '', account_url: url, billing_url: url + '/settings/billing', days_left: String(left),
    signup_date: nice((t.createdAt || '').slice(0, 10)), last_login: s.lastLoginAt ? nice(s.lastLoginAt.slice(0, 10)) : 'never', clients: String(s.clients), jobs: String(s.jobs), invoices: String(s.invoices), help_url: tenancy.helpUrl() };
}
function compose(a, vars, email) {
  // every automation email can be turned off by whoever gets it
  return emails.render('automation', vars, { subject: a.subject, body: `${a.body}\n\nDon’t want these emails? [Unsubscribe](${unsubUrl(email)})` });
}
async function sendOne(a, t, s, person) {
  const m = compose(a, varsFor(t, s, person), person.email);
  return h.sendEmail(t, person.email, m);
}

// ---------- the hourly run ----------
let running = false;
async function run() {
  if (running) return; running = true;
  try {
    for (const a of list().filter((x) => x.enabled)) {
      for (const t of accounts()) {
        let s; try { s = h.stats(t); } catch (e) { continue; }
        const m = due(a, t, s); if (!m || !matches(a, t, s)) continue;
        const k = key(a, t, m.anchor); if (sent()[k]) continue;
        sent()[k] = new Date().toISOString(); save(); // claimed first, so a slow send can't go out twice
        for (const person of recipients(a, s)) {
          const r = await sendOne(a, t, s, person).catch((e) => ({ status: 'failed', detail: e.message }));
          log().unshift({ id: crypto.randomBytes(5).toString('hex'), at: new Date().toISOString(), automationId: a.id, automation: a.name, tenantId: t.id, business: t.name, to: person.email, status: r.status, detail: r.detail || '' });
          a.sentCount = (a.sentCount || 0) + (r.status === 'sent' ? 1 : 0);
        }
        if (log().length > 2000) P().automationLog = log().slice(0, 2000);
        a.lastSentAt = new Date().toISOString(); save();
      }
      if (a.trigger === 'date' && a.date < dayIn(a.tz)) { a.enabled = false; save(); } // a one-time send is done after its day
    }
  } finally { running = false; }
}

// ---------- editing (Alpha) ----------
function clean(b, old = {}) {
  const str = (v, n) => String(v ?? '').trim().slice(0, n);
  const a = { ...old, name: str(b.name, 80), trigger: TRIGGERS[b.trigger] ? b.trigger : 'signup', days: Math.max(0, Math.min(3650, Math.floor(Number(b.days) || 0))),
    date: /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : '', hour: Math.max(0, Math.min(23, Math.floor(Number(b.hour) || 0))), tz: str(b.tz, 60) || 'America/Chicago',
    weekdays: !!b.weekdays, catchUp: !!b.catchUp, to: b.to === 'admins' ? 'admins' : 'owner', subject: str(b.subject, 200), body: String(b.body || '').slice(0, 8000) };
  const r = b.rules || {}; const num = (v) => (v === '' || v == null ? '' : Math.max(0, Math.floor(Number(v)) || 0));
  a.rules = { plans: (r.plans || []).filter((p) => P().plans.some((x) => x.id === p)), statuses: (r.statuses || []).filter((x) => STATUSES[x]),
    clientsMin: num(r.clientsMin), clientsMax: num(r.clientsMax), jobsMin: num(r.jobsMin), jobsMax: num(r.jobsMax), invoicesMin: num(r.invoicesMin), invoicesMax: num(r.invoicesMax),
    cards: ['yes', 'no'].includes(r.cards) ? r.cards : 'any', confirmed: ['yes', 'no'].includes(r.confirmed) ? r.confirmed : 'any' };
  if (!a.name) throw fail('Give the automation a name');
  if (!a.subject || !a.body.trim()) throw fail('Write the email’s subject and message');
  try { new Intl.DateTimeFormat('en-US', { timeZone: a.tz }); } catch (e) { throw fail('Choose a time zone'); }
  if (a.trigger === 'date' && !a.date) throw fail('Choose the date to send it');
  return a;
}
function create(b) { const a = { id: crypto.randomBytes(5).toString('hex'), createdAt: new Date().toISOString(), enabled: false, sentCount: 0, ...clean(b) }; list().push(a); save(); return a; }
function update(id, b) {
  const i = list().findIndex((x) => x.id === id); if (i < 0) throw Object.assign(new Error('Automation not found'), { status: 404 });
  const a = clean(b, list()[i]); list()[i] = a; save(); return a;
}
function setEnabled(id, on) {
  const a = list().find((x) => x.id === id); if (!a) throw Object.assign(new Error('Automation not found'), { status: 404 });
  if (on && !a.enabled) a.enabledAt = new Date().toISOString(); a.enabled = !!on; save(); return a;
}
function remove(id) { P().automations = list().filter((x) => x.id !== id); save(); }
function view() {
  return { automations: list().map((a) => ({ ...a, waiting: a.enabled ? audience(a).filter((x) => x.ready).length : 0 })), log: log().slice(0, 200), triggers: TRIGGERS, statuses: STATUSES, vars: VARS,
    plans: P().plans.map((p) => ({ id: p.id, name: p.name })), optedOut: Object.keys(optOut()).length };
}
// "Send me a test": the email as the first account that qualifies would get it (or sample values)
async function test(b, to, adminName) {
  const a = clean(b); const pick = accounts().map((t) => ({ t, s: h.stats(t) })).find((x) => matches(a, x.t, x.s));
  const vars = pick ? varsFor(pick.t, pick.s, { name: adminName }) : { name: String(adminName || '').split(/\s+/)[0], business: 'Sample Pools', plan: 'Advanced', account_url: tenancy.platformUrl(), billing_url: tenancy.platformUrl(), days_left: '3', signup_date: nice(new Date().toISOString().slice(0, 10)), last_login: 'never', clients: '12', jobs: '30', invoices: '18', help_url: tenancy.helpUrl() };
  const m = compose({ ...a, subject: '[Test] ' + a.subject }, vars, to);
  return { ...(await h.sendEmail(null, to, m)), example: pick ? pick.t.name : 'sample values' };
}
function unsubscribe(email, token) {
  const e = String(email || '').toLowerCase(); if (!e || token !== unsubToken(e)) return false;
  optOut()[e] = new Date().toISOString(); save(); return true;
}

module.exports = { init: (helpers) => { h = helpers; setTimeout(() => run().catch((e) => console.error('automations:', e.message)), 15e3); setInterval(() => run().catch((e) => console.error('automations:', e.message)), 3600e3).unref(); },
  run, view, create, update, setEnabled, remove, audience: (b) => audience({ ...clean(b), id: b.id || 'preview' }), test, unsubscribe, VARS };
