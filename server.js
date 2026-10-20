const express = require('./lib/mini-express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const tls = require('tls');
const support = require('./lib/support');

// load settings such as Twilio credentials from .env next to this file (values already in the environment win)
if (fs.existsSync(path.join(__dirname, '.env'))) process.loadEnvFile(path.join(__dirname, '.env'));

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `https://workliopro.com/public`;
// many companies (accounts) on one server: see lib/tenancy.js. `db` below is the data of the account the current request is for.
const tenancy = require('./lib/tenancy');
const emails = require('./lib/emails');
const brandLib = require('./lib/brand');
const stripeLib = require('./lib/stripe');
const { db, uploadDir } = tenancy;
const baseUrl = () => tenancy.tenantUrl(tenancy.current()); // this account's web address, for links in messages

// ---------- tiny JSON store ----------
const uid = () => crypto.randomBytes(5).toString('hex');
const token = () => crypto.randomBytes(12).toString('hex');
const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

function seed() {
  const staff = [
    { id: 's1', name: 'Marcus Reed', role: 'Lead Technician', phone: '+17135550101', email: 'marcus@example.com', color: '#2563eb' },
    { id: 's2', name: 'Priya Nair', role: 'Technician', phone: '+17135550102', email: 'priya@example.com', color: '#16a34a' },
    { id: 's3', name: 'Tom Alvarez', role: 'Installer', phone: '+17135550103', email: 'tom@example.com', color: '#d97706' },
  ];
  const services = [
    { id: 'v1', name: 'Lawn Maintenance', description: 'Mow, edge, blow and haul clippings.', price: 65, unit: 'visit' },
    { id: 'v2', name: 'Gutter Cleaning', description: 'Clear gutters and downspouts, flush and inspect.', price: 140, unit: 'job' },
    { id: 'v3', name: 'Pressure Washing', description: 'Driveway, patio or siding wash.', price: 220, unit: 'job' },
    { id: 'v4', name: 'Sprinkler Repair', description: 'Diagnose and repair zone issues.', price: 95, unit: 'hour' },
    { id: 'v5', name: 'Tree Trimming', description: 'Prune and remove branches up to 6 inches.', price: 350, unit: 'job' },
  ];
  const clients = [
    { id: 'c1', name: 'Hannah Brooks', email: 'hannah@example.com', phone: '+17135550201', address: '412 Willow Creek Dr, Houston, TX 77008', notes: 'Gate code 4412', createdAt: daysFromNow(-120), portalToken: token() },
    { id: 'c2', name: 'Delgado Dental', email: 'office@delgadodental.example', phone: '+17135550202', address: '88 Main St, Houston, TX 77002', notes: '', createdAt: daysFromNow(-75), portalToken: token() },
    { id: 'c3', name: 'Oakridge HOA', email: 'board@oakridgehoa.example', phone: '+17135550203', address: '1 Oakridge Blvd, Houston, TX 77024', notes: 'Monthly contract', createdAt: daysFromNow(-40), portalToken: token() },
    { id: 'c4', name: 'Samir Patel', email: 'samir@example.com', phone: '+17135550204', address: '2290 Bayou Ln, Houston, TX 77019', notes: '', createdAt: daysFromNow(-8), portalToken: token() },
  ];
  const mk = (items, taxRate) => {
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
    const tax = Math.round(subtotal * taxRate) / 100;
    return { items, taxRate, subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
  };
  const quotes = [
    { id: 'q1', number: 'Q-1001', clientId: 'c4', title: 'Backyard refresh', status: 'sent', createdAt: daysFromNow(-5), token: token(), notes: 'Valid for 30 days.', depositFee: 0, depositStatus: null, signedAt: null, depositPaidAt: null, ...mk([{ desc: 'Tree Trimming', qty: 1, price: 350 }, { desc: 'Lawn Maintenance', qty: 1, price: 65 }], 8.25) },
    { id: 'q2', number: 'Q-1002', clientId: 'c3', title: 'Spring pressure wash', status: 'approved', createdAt: daysFromNow(-20), token: token(), notes: '', depositFee: 200, depositStatus: 'pending', signedAt: daysFromNow(-19), depositPaidAt: null, ...mk([{ desc: 'Pressure Washing', qty: 2, price: 220 }], 8.25) },
  ];
  const jobs = [
    { id: 'j1', number: 'J-2001', clientId: 'c1', title: 'Weekly lawn care', description: 'Standard mow and edge.', date: daysFromNow(0), startTime: '09:00', endTime: '10:30', staffIds: ['s1'], status: 'scheduled', quoteId: null, address: '412 Willow Creek Dr, Houston, TX 77008', createdAt: daysFromNow(-30) },
    { id: 'j2', number: 'J-2002', clientId: 'c2', title: 'Gutter cleaning', description: '', date: daysFromNow(1), startTime: '13:00', endTime: '15:00', staffIds: ['s2'], status: 'scheduled', quoteId: null, address: '88 Main St, Houston, TX 77002', createdAt: daysFromNow(-10) },
    { id: 'j3', number: 'J-2003', clientId: 'c3', title: 'Spring pressure wash', description: 'Clubhouse and walkways.', date: daysFromNow(2), startTime: '08:00', endTime: '14:00', staffIds: ['s1', 's3'], status: 'scheduled', quoteId: 'q2', address: '1 Oakridge Blvd, Houston, TX 77024', createdAt: daysFromNow(-15) },
    { id: 'j4', number: 'J-2004', clientId: 'c1', title: 'Sprinkler repair', description: 'Zone 3 not firing.', date: daysFromNow(-12), startTime: '10:00', endTime: '12:00', staffIds: ['s2'], status: 'completed', quoteId: null, address: '412 Willow Creek Dr, Houston, TX 77008', createdAt: daysFromNow(-20) },
    { id: 'j5', number: 'J-2005', clientId: 'c2', title: 'Lawn maintenance', description: '', date: daysFromNow(-35), startTime: '09:00', endTime: '10:00', staffIds: ['s3'], status: 'completed', quoteId: null, address: '88 Main St, Houston, TX 77002', createdAt: daysFromNow(-40) },
    { id: 'j6', number: 'J-2006', clientId: 'c3', title: 'Tree trimming', description: '', date: daysFromNow(-50), startTime: '08:00', endTime: '12:00', staffIds: ['s1', 's3'], status: 'completed', quoteId: null, address: '1 Oakridge Blvd, Houston, TX 77024', createdAt: daysFromNow(-55) },
  ];
  const invoices = [
    { id: 'i1', number: 'INV-3001', clientId: 'c1', jobId: 'j4', status: 'paid', issueDate: daysFromNow(-11), dueDate: daysFromNow(3), paidAt: daysFromNow(-9), token: token(), createdAt: daysFromNow(-11), notes: '', ...mk([{ desc: 'Sprinkler Repair', qty: 2, price: 95 }], 8.25) },
    { id: 'i2', number: 'INV-3002', clientId: 'c2', jobId: 'j5', status: 'paid', issueDate: daysFromNow(-34), dueDate: daysFromNow(-20), paidAt: daysFromNow(-30), token: token(), createdAt: daysFromNow(-34), notes: '', ...mk([{ desc: 'Lawn Maintenance', qty: 1, price: 65 }], 8.25) },
    { id: 'i3', number: 'INV-3003', clientId: 'c3', jobId: 'j6', status: 'paid', issueDate: daysFromNow(-49), dueDate: daysFromNow(-35), paidAt: daysFromNow(-44), token: token(), createdAt: daysFromNow(-49), notes: '', ...mk([{ desc: 'Tree Trimming', qty: 1, price: 350 }], 8.25) },
    { id: 'i4', number: 'INV-3004', clientId: 'c3', jobId: null, status: 'sent', issueDate: daysFromNow(-6), dueDate: daysFromNow(8), paidAt: null, token: token(), createdAt: daysFromNow(-6), notes: 'Monthly contract, October', ...mk([{ desc: 'Lawn Maintenance', qty: 4, price: 65 }], 8.25) },
  ];
  const expenses = [
    { id: 'e1', date: daysFromNow(-11), category: 'Materials', vendor: 'Home Depot', description: 'Sprinkler heads and fittings', amount: 38.4, jobId: 'j4' },
    { id: 'e2', date: daysFromNow(-48), category: 'Subcontractor', vendor: 'Lone Star Chipping', description: 'Debris haul-off', amount: 120, jobId: 'j6' },
    { id: 'e3', date: daysFromNow(-3), category: 'Fuel', vendor: 'Shell', description: 'Truck fuel', amount: 74.15, jobId: null },
  ];
  return {
    company: { name: 'Your Business Name', email: 'hello@example.com', phone: '+17135550100', website: '', address: '100 Commerce St, Houston, TX 77002', logo: '', icon: '', taxRate: 8.25, paymentTermsDays: 14, invoiceFooter: 'Thank you for your business!', brandColor: '#0f766e' },
    clients, services, staff, quotes, jobs, invoices, expenses, notifications: [], photos: [],
    counters: { quote: 1002, job: 2006, invoice: 3004 },
  };
}
// a new account that starts without demo data
function emptySeed() {
  return {
    company: { name: '', email: '', phone: '', website: '', address: '', logo: '', icon: '', taxRate: 0, paymentTermsDays: 14, invoiceFooter: 'Thank you for your business!', brandColor: '#0f766e' },
    clients: [], services: [], staff: [], quotes: [], jobs: [], invoices: [], expenses: [], notifications: [], photos: [],
    counters: { quote: 1000, job: 2000, invoice: 3000 }, users: [], sessions: {}, resetTokens: {},
  };
}
const save = () => tenancy.saveStore();
// run once each time an account's data is loaded: brings data saved by older versions up to date
function migrate() {
  ensureAuthStore(); ensureOwnerStaff();
  for (const u of db.users) if (u.role === 'member') u.role = 'technician'; // the old "team member" role is now Technician
  [...db.quotes, ...db.invoices].forEach(computeTotals); // cost/markup fields, deposit amount
  // the first client importer stored the company as a "Company: …" line in notes; move it to the company field
  db.clients.forEach((c) => {
    const m = !c.company && /^Company: (.+)$/m.exec(c.notes || '');
    if (m) { c.company = m[1].trim(); c.notes = c.notes.replace(m[0], '').trim(); }
  });
}
tenancy.init({ seed, emptySeed, migrate });

// ---------- company settings: address parts, regional settings, business hours ----------
const ADDRESS_PARTS = ['addrStreet1', 'addrStreet2', 'addrCity', 'addrState', 'addrZip', 'addrCountry'];
const composeAddress = (c) => [c.addrStreet1, c.addrStreet2, [c.addrCity, [c.addrState, c.addrZip].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(', ');
const TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));
const REGIONAL = {
  timezone: (v) => v === '' || TIMEZONES.has(v),
  dateFormat: (v) => ['MMM D, YYYY', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].includes(v),
  timeFormat: (v) => ['12', '24'].includes(v),
  weekStart: (v) => ['sun', 'mon'].includes(v),
};
// dates like "today" and "due in 14 days" follow the business's time zone, not the server's (set at the start of each request)
const SERVER_TZ = process.env.TZ;
const applyTimezone = () => { const tz = db.company.timezone || SERVER_TZ; if (tz) process.env.TZ = tz; else delete process.env.TZ; };
function readHours(raw) { // uses DAYS / HHMM from the team-hours code below (only called from request handlers)
  let h = raw; if (typeof h === 'string') { try { h = JSON.parse(h); } catch (e) { return null; } }
  if (!h || typeof h !== 'object') return null;
  const t = (s) => HHMM.test(s || '');
  const out = {};
  for (const d of DAYS) { const x = h[d] || {}; const on = !!x.on; if (on && !(t(x.start) && t(x.end) && x.end > x.start)) return null; out[d] = { on, start: t(x.start) ? x.start : '09:00', end: t(x.end) ? x.end : '17:00' }; }
  return out;
}

// ---------- helpers ----------
const round2 = (n) => Math.round(n * 100) / 100;
function computeTotals(doc) {
  // price is the client-facing unit price: cost plus a markup (% of cost, or a flat $ per unit). Older items without a cost use their price as the cost.
  doc.items = (doc.items || []).filter((i) => i.desc).map((i) => {
    const cost = Number(i.cost ?? i.price) || 0; const markup = Number(i.markup) || 0; const markupType = i.markupType === 'flat' ? 'flat' : 'percent';
    return { desc: String(i.desc), details: i.details ? String(i.details) : '', qty: Number(i.qty) || 0, cost, markup, markupType, price: round2(markupType === 'flat' ? cost + markup : cost * (1 + markup / 100)) };
  });
  doc.taxRate = Number(doc.taxRate) || 0;
  doc.subtotal = round2(doc.items.reduce((s, i) => s + i.qty * i.price, 0));
  // optional discount before tax: a flat amount or a percentage of the subtotal
  doc.discountType = doc.discountType === 'percent' ? 'percent' : 'flat';
  doc.discountValue = Math.max(0, Number(doc.discountValue) || 0);
  doc.discount = Math.min(doc.subtotal, round2(doc.discountType === 'percent' ? doc.subtotal * doc.discountValue / 100 : doc.discountValue));
  doc.tax = round2((doc.subtotal - doc.discount) * doc.taxRate / 100);
  doc.total = round2(doc.subtotal - doc.discount + doc.tax);
  // deposit: a flat fee or a percentage of the total. Older quotes only have depositFee, treated as flat.
  doc.depositType = doc.depositType === 'percent' ? 'percent' : 'flat';
  doc.depositValue = Math.max(0, Number(doc.depositValue ?? doc.depositFee) || 0);
  doc.depositFee = Math.min(doc.total, round2(doc.depositType === 'percent' ? doc.total * doc.depositValue / 100 : doc.depositValue));
  return doc;
}
// admin edits to a recorded deposit payment from the quote editor: change amount/date, or remove the payment
function applyDepositPaymentEdit(doc, upd) {
  const action = upd.depositPayment; delete doc.depositPayment;
  if (action === 'delete') {
    doc.depositPaidAt = null; doc.depositPaidAmount = null; doc.depositMethod = null; doc.depositReference = null; doc.zelleSentAt = null;
    doc.depositStatus = doc.signedAt ? 'pending' : null;
  } else if (doc.depositPaidAt) {
    doc.depositPaidAmount = Math.max(0, round2(Number(doc.depositPaidAmount ?? doc.depositFee) || 0));
    if ('depositMethod' in upd && !PAY_METHODS[upd.depositMethod]) doc.depositMethod = db.quotes.find((x) => x.id === doc.id)?.depositMethod || 'other'; // only listed methods can be chosen
    if ('depositReference' in upd) doc.depositReference = String(upd.depositReference || '').trim().slice(0, 120);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(doc.depositPaidAt))) doc.depositPaidAt = iso(new Date());
  } else { delete doc.depositPaidAmount; } // no payment recorded: ignore stray fields
}
const money = (n) => '$' + Number(n).toFixed(2);
const findClient = (id) => db.clients.find((c) => c.id === id);
function invoiceStatus(inv) {
  if (inv.status === 'paid') return 'paid';
  if (inv.status !== 'draft' && inv.dueDate && inv.dueDate < iso(new Date())) return 'overdue';
  if (inv.status !== 'draft' && (inv.payments || []).length) return 'partial'; // some paid, balance remaining
  return inv.status;
}
// A deposit paid on the quote behind this invoice's job is credited against it (only on the job's first invoice).
// Computed on read, never stored, so it follows later edits to the deposit payment.
// balanceDue = total − deposit credit − recorded payments (0 once paid, unless ignoreStatus)
function invoiceCredits(inv, ignoreStatus) {
  const job = inv.jobId && db.jobs.find((j) => j.id === inv.jobId);
  const q = job && job.quoteId && db.quotes.find((x) => x.id === job.quoteId);
  const first = job && db.invoices.filter((i) => i.jobId === job.id).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || String(a.number).localeCompare(String(b.number)))[0];
  // inv.depositCreditRemoved: the admin deleted the deposit line from this invoice, so it isn't credited here
  const credit = q && q.depositPaidAt && first && first.id === inv.id && !inv.depositCreditRemoved ? Math.min(inv.total || 0, round2(Number(q.depositPaidAmount ?? q.depositFee) || 0)) : 0;
  const paid = round2((inv.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const balance = Math.max(0, round2((inv.total || 0) - credit - paid));
  return { depositApplied: credit, depositAppliedAt: credit ? q.depositPaidAt : null, depositQuote: credit ? q.number : null, amountPaid: paid, balanceDue: !ignoreStatus && inv.status === 'paid' ? 0 : balance };
}
const withStatus = (inv) => ({ ...inv, displayStatus: invoiceStatus(inv), ...invoiceCredits(inv) });

// ---------- messaging adapters (email / SMS) ----------
// minimal SMTP client over TLS (port 465): enough to send through Gmail with an app password, no npm packages
function smtpSend({ host, port, user, pass }, { from, fromName, to, replyTo, subject, text, html }) {
  const clean = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim(); // no header injection
  const word = (s) => (/[^\x20-\x7e]/.test(s) ? `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=` : s);
  const b64 = (s) => Buffer.from(String(s)).toString('base64').replace(/.{76}/g, '$&\r\n');
  const part = (type, s) => [`Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', b64(s)];
  const edge = 'b' + crypto.randomBytes(12).toString('hex'); // an HTML email goes as multipart/alternative with a plain-text copy
  const msg = [
    `From: ${/[^\x20-\x7e]/.test(clean(fromName)) ? word(clean(fromName)) : `"${clean(fromName).replace(/["\\]/g, '')}"`} <${clean(from)}>`,
    `To: <${clean(to)}>`, ...(replyTo ? [`Reply-To: <${clean(replyTo)}>`] : []),
    `Subject: ${word(clean(subject))}`, `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${clean(from).split('@')[1] || 'localhost'}>`,
    'MIME-Version: 1.0',
    ...(html ? [`Content-Type: multipart/alternative; boundary="${edge}"`, '', `--${edge}`, ...part('text/plain', text), `--${edge}`, ...part('text/html', html), `--${edge}--`] : part('text/plain', text)),
  ].join('\r\n');
  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host, port, servername: host });
    let buf = ''; let waiting = null; const ready = [];
    const fail = (e) => { sock.destroy(); reject(e); };
    sock.setTimeout(20000, () => fail(new Error('Email server timed out')));
    sock.on('error', fail);
    sock.on('data', (d) => {
      buf += d.toString('utf8'); let m;
      while ((m = buf.match(/^(?:\d{3}-[^\r\n]*\r\n)*(\d{3}) [^\r\n]*\r\n/))) { // full (possibly multi-line) reply
        buf = buf.slice(m[0].length); const r = { code: Number(m[1]), text: m[0].trim().split('\r\n').pop() };
        if (waiting) { const w = waiting; waiting = null; w(r); } else ready.push(r);
      }
    });
    const reply = () => new Promise((r) => { if (ready.length) r(ready.shift()); else waiting = r; });
    const step = async (line, expect) => { if (line) sock.write(line + '\r\n'); const r = await reply(); if (r.code !== expect) throw new Error(r.text); };
    (async () => {
      await step(null, 220); await step('EHLO localhost', 250);
      await step('AUTH PLAIN ' + Buffer.from(`\0${user}\0${pass}`).toString('base64'), 235);
      await step(`MAIL FROM:<${clean(from)}>`, 250); await step(`RCPT TO:<${clean(to)}>`, 250); await step('DATA', 354);
      sock.write(msg + '\r\n.\r\n'); await step(null, 250);
      sock.end('QUIT\r\n');
    })().then(resolve, fail);
  });
}
// each account can send through its own email and Twilio accounts (App Settings → Messages); otherwise the server's .env settings are used
const EMAIL_LABELS = { gmail: 'Gmail', sendgrid: 'SendGrid', smtp: 'SMTP' };
const ownEmail = () => { const e = secrets().email; return e && EMAIL_LABELS[e.provider] ? e : null; };
const envTwilio = () => { const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env; return sid && token && from ? { sid, token, from } : null; };
const ownTwilio = () => { const t = secrets().twilio; return t && t.sid && t.token && t.from ? t : null; };
// texts to clients go only through the business's own Twilio account; the server's TWILIO_* settings are for platform tests
const smsReady = () => !!ownTwilio();
const serverEmailProvider = () => (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? 'Gmail' : process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM ? 'SendGrid' : '');
const emailProvider = () => { const e = ownEmail(); return e ? EMAIL_LABELS[e.provider] : serverEmailProvider(); };
async function sendgridSend(key, { from, fromName, to, replyTo, subject, text, html }) {
  const msg = { personalizations: [{ to: [{ email: to }] }], from: { email: from, name: fromName }, subject, content: [{ type: 'text/plain', value: text }, ...(html ? [{ type: 'text/html', value: html }] : [])] };
  if (replyTo) msg.reply_to = { email: replyTo };
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(msg) });
  if (r.ok) return;
  const j = await r.json().catch(() => ({}));
  throw new Error(`${r.status}: ${(j.errors || []).map((e) => e.message).join('; ') || 'request rejected'}`);
}
// server: true sends through the server's own settings even inside an account (platform emails, platform tests)
async function sendEmail(to, subject, body, { server = false, replyTo: replyOverride = '', html = '' } = {}) {
  if (!to) return { status: 'failed', detail: 'Client has no email address' };
  const mine = !server && ownEmail();
  if (mine) {
    const label = EMAIL_LABELS[mine.provider];
    const msg = { from: mine.from || mine.user, fromName: mine.fromName || db.company.name, to, replyTo: db.company.email, subject, text: body, html };
    try {
      if (mine.provider === 'sendgrid') await sendgridSend(mine.apiKey, msg);
      else await smtpSend({ host: mine.provider === 'gmail' ? 'smtp.gmail.com' : mine.host, port: mine.provider === 'gmail' ? 465 : Number(mine.port) || 465, user: mine.user, pass: mine.pass }, msg);
      return { status: 'sent', detail: `${label} (your account)` };
    } catch (e) {
      return { status: 'failed', detail: `${label}: ${e.message}${mine.provider === 'gmail' && /^535/.test(e.message) ? ' (use a Google app password, not your normal password)' : ''}` };
    }
  }
  const { SENDGRID_API_KEY: key, EMAIL_FROM: from, GMAIL_USER: gUser, GMAIL_APP_PASSWORD: gPass } = process.env;
  // the server's email service is shared by every account; only the default account uses EMAIL_FROM_NAME / EMAIL_REPLY_TO, the others send as themselves
  const own = tenancy.isDefault(); const fromName = own ? process.env.EMAIL_FROM_NAME : db.company.name; const replyTo = replyOverride || (own ? process.env.EMAIL_REPLY_TO : db.company.email);
  if (serverEmailProvider() === 'Gmail') {
    try {
      await smtpSend({ host: 'smtp.gmail.com', port: 465, user: gUser, pass: gPass.replace(/\s/g, '') },
        { from: from || gUser, fromName: fromName || db.company.name, to, replyTo: replyTo || db.company.email, subject, text: body, html });
      return { status: 'sent', detail: 'Gmail' };
    } catch (e) {
      return { status: 'failed', detail: `Gmail: ${e.message}${/^535/.test(e.message) ? ' (check GMAIL_USER and use a Google app password, not your normal password)' : ''}` };
    }
  }
  if (key && from) {
    try { await sendgridSend(key, { from, fromName: fromName || db.company.name, to, replyTo: replyTo || db.company.email, subject, text: body, html }); return { status: 'sent', detail: 'SendGrid' }; }
    catch (e) { return { status: 'failed', detail: `SendGrid ${e.message}` }; }
  }
  return { status: 'simulated', detail: 'No email provider configured (set GMAIL_USER and GMAIL_APP_PASSWORD, or SENDGRID_API_KEY and EMAIL_FROM)' };
}
// the platform's own emails (lib/emails.js; edited in the platform console under Messages → Email templates)
async function sendTemplate(key, to, vars, opts = {}) { const m = emails.render(key, vars); return { ...(await sendEmail(to, m.subject, m.text, { ...opts, html: m.html })), subject: m.subject, text: m.text }; }
// Twilio needs E.164 numbers (+17135550100); assume US/Canada for bare 10-digit numbers
function toE164(phone) {
  const s = String(phone || '').trim(); const digits = s.replace(/\D/g, '');
  if (s.startsWith('+')) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return digits ? '+' + digits : '';
}
async function sendSms(to, body, { server = false } = {}) {
  if (!to) return { status: 'failed', detail: 'Client has no phone number' };
  const mine = !server && ownTwilio(); const { sid, token: auth, from } = (server ? envTwilio() : mine) || {};
  if (sid && auth && from) {
    try {
      // TWILIO_FROM can be a Twilio phone number or a Messaging Service SID (starts with MG)
      const params = { To: toE164(to), Body: body, ...(from.startsWith('MG') ? { MessagingServiceSid: from } : { From: toE164(from) }) };
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${auth}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
      });
      const j = await r.json().catch(() => ({}));
      return r.ok ? { status: 'sent', detail: `Twilio ${j.sid || ''}${mine ? ' (your account)' : ''}`.trim() } : { status: 'failed', detail: `Twilio ${r.status}${j.code ? ' (error ' + j.code + ')' : ''}: ${j.message || 'request rejected'}` };
    } catch (e) { return { status: 'failed', detail: e.message }; }
  }
  return { status: 'simulated', detail: server ? 'No SMS provider configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)' : 'Texting isn’t connected: connect your Twilio account in Settings → Account Connections' };
}
async function notify({ clientId, channel, kind, refId, refNumber, subject, body }) {
  const c = findClient(clientId);
  if (channel === 'sms' && !tenancy.has('sms')) return { id: uid(), at: new Date().toISOString(), clientId, channel, kind, status: 'failed', detail: 'Text messages aren’t included in your plan' };
  const res = channel === 'email' ? await sendEmail(c && c.email, subject, body) : await sendSms(c && c.phone, body);
  const entry = { id: uid(), at: new Date().toISOString(), clientId, clientName: c ? c.name : 'Unknown', channel, kind, refId, refNumber, to: channel === 'email' ? (c && c.email) : (c && c.phone), subject: subject || '', body, status: res.status, detail: res.detail };
  db.notifications.unshift(entry);
  return entry;
}

// ---------- app ----------
const app = express();
app.use(express.json({ limit: '15mb' }));
// pick the account from the web address and run the rest of the request inside it
const notice = (title, text) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="font-family:system-ui,sans-serif;background:#f4f6f8;color:#111827;margin:0"><div style="max-width:520px;margin:64px auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 1px 4px rgba(0,0,0,.08)"><h1 style="margin:0 0 8px;font-size:22px">${esc(title)}</h1><p style="color:#4b5563;line-height:1.5">${text}</p></div></body></html>`;
app.use((req, res, next) => {
  const r = tenancy.resolve(req.headers.host);
  const isApi = req.path.startsWith('/api/'); const P = tenancy.platform().settings;
  if (r.kind !== 'tenant') return isApi ? res.status(404).json({ error: 'No account at this address' }) : res.status(404).send(notice('No account here', `There’s no ${esc(P.productName)} account at this address. Check the link you were given.`));
  if (r.tenant.billing && r.tenant.billing.endsAt && iso(new Date()) > r.tenant.billing.endsAt) tenancy.endSubscription(r.tenant); // cancelled period is over (the webhook usually does this first)
  if (r.tenant.status === 'pending') { // signed up for a paid plan but hasn't finished checkout
    const msg = `This account is waiting for its first payment. Use the checkout link from your sign-up to finish, or sign up again at <a href="${esc(tenancy.platformUrl())}/pricing">${esc(tenancy.platformUrl().replace(/^https?:\/\//, ''))}/pricing</a>.${P.contactEmail ? ` Questions? Contact ${esc(P.contactEmail)}.` : ''}`;
    return isApi ? res.status(403).json({ error: 'This account isn’t paid for yet' }) : res.status(403).send(notice('Finish your checkout', msg));
  }
  if (r.tenant.status === 'suspended') {
    const msg = `This account is paused.${P.contactEmail ? ` Contact ${esc(P.contactEmail)} for help.` : ''}`;
    return isApi ? res.status(403).json({ error: 'This account is paused' }) : res.status(403).send(notice('Account paused', msg));
  }
  tenancy.run(r.tenant, () => { applyTimezone(); next(); });
});

// ---------- staff accounts + login ----------
// Passwords: scrypt with a per-user salt. Sessions: random token in an HttpOnly cookie; only its SHA-256 is stored.
const SESSION_DAYS = 30;
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const hashPassword = (pw, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(String(pw), salt, 64).toString('hex') });
const checkPassword = (pw, u) => { const a = Buffer.from(hashPassword(pw, u.salt).hash, 'hex'); const b = Buffer.from(u.passwordHash, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const normEmail = (e) => String(e || '').trim().toLowerCase();
// linked team member: by staffId, or by matching email (e.g. an owner who is also on the team)
const staffOfUser = (u) => (db.staff || []).find((s) => s.id === u.staffId) || (db.staff || []).find((s) => normEmail(s.email) === u.email);
const publicUser = (u) => u && { id: u.id, name: u.name, email: u.email, role: u.role, photo: (staffOfUser(u) || u).photo || '' };
// a login linked to a team member stops working when that member is deactivated
const staffBlocked = (u) => { const st = u.staffId && db.staff.find((x) => x.id === u.staffId); return !!(st && st.status === 'deactivated'); };
const isAdmin = (u) => !!u && (u.role === 'owner' || u.role === 'admin');
const isOwnerStaff = (s) => (db.users || []).some((u) => u.role === 'owner' && u.staffId === s.id);
// the owner is always on the team: link their login to a team member record (matching email), or create one
function ensureOwnerStaff() {
  const u = (db.users || []).find((x) => x.role === 'owner'); if (!u) return;
  db.staff = db.staff || [];
  let st = db.staff.find((s) => s.id === u.staffId) || db.staff.find((s) => String(s.email || '').trim().toLowerCase() === u.email);
  if (!st) { st = { id: uid(), name: u.name, email: u.email, phone: '', role: 'Owner', color: '#2563eb', status: 'active', createdAt: iso(new Date()) }; db.staff.unshift(st); }
  if (st.status === 'deactivated') st.status = 'active';
  u.staffId = st.id;
}
function ensureAuthStore() { db.users = db.users || []; db.sessions = db.sessions || {}; db.resetTokens = db.resetTokens || {}; }
function cookies(req) { return Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))])); }
function currentUser(req) {
  if (req._user !== undefined) return req._user;
  const s = db.sessions[sha(cookies(req).sid || '')];
  const u = s && s.expires > Date.now() && (!s.support || support.sessionOk(tenancy.current(), s.support)) ? db.users.find((x) => x.id === s.userId) : null;
  req._user = u && u.passwordHash && !staffBlocked(u) ? u : null; // invited-but-unfinished and deactivated members can't use sessions
  req._support = req._user && s.support ? s.support : null; // a platform admin in the account through Support Access
  return req._user;
}
function startSession(res, user, { expires = Date.now() + SESSION_DAYS * 864e5, support: sup } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now(); for (const [k, s] of Object.entries(db.sessions)) if (s.expires < now) delete db.sessions[k]; // prune old ones
  db.sessions[sha(token)] = { userId: user.id, expires, ...(sup ? { support: sup } : {}) }; save();
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.round((expires - now) / 1000)}${BASE_URL.startsWith('https') ? '; Secure' : ''}`);
}
// simple brute-force guard: 10 failed logins per email+IP in 15 minutes
const failures = new Map();
const tooMany = (key) => { const f = failures.get(key); return f && f.n >= 10 && Date.now() - f.t < 15 * 60e3; };
const recordFailure = (key) => { const f = failures.get(key); failures.set(key, f && Date.now() - f.t < 15 * 60e3 ? { n: f.n + 1, t: f.t } : { n: 1, t: Date.now() }); };

// Everything requires login except what clients use (quote/pay pages, client portal), the login page, and static assets.
const PUBLIC_API = (req) => req.path === '/api/stripe/webhook' || req.path.startsWith('/api/auth/') || req.path.startsWith('/api/portal/') || (req.method === 'GET' && req.path === '/api/company');
app.use((req, res, next) => {
  const p = req.path;
  if (p.startsWith('/api/')) return PUBLIC_API(req) || currentUser(req) ? next() : res.status(401).json({ error: 'Please log in' });
  if (p === '/login' || p === '/support-login' || p === '/client-portal' || p.startsWith('/p/') || p.startsWith('/pay/') || p.startsWith('/refer/') || p.startsWith('/uploads/') || /\.(js|css|png|jpe?g|gif|webp|svg|ico)$/i.test(p)) return next();
  if (currentUser(req)) return next();
  res.redirect('/login' + (p !== '/' ? '?next=' + encodeURIComponent(req.url) : ''));
});
// Access levels: owner/admin can do everything. Others only reach the routes listed for their role:
//  technician: view jobs (no prices), clients and the schedule
//  manager: add/edit/delete jobs, quotes and invoices, the Money section (products & services, expenses, reports, tax), add/edit clients
const ROLES = ['admin', 'manager', 'technician']; // assignable to team members (the owner role is fixed)
const ID = '[^/]+';
const route = (method, re) => [method, new RegExp('^/api/' + re + '$')];
const SUPPORT_API = [route('GET', 'account/support-access'), route('POST', `account/support-access/${ID}/(grant|decline|revoke)`)];
const ROLE_API = {
  technician: [route('GET', '(jobs|clients|staff|company)'), route('GET', 'auth/.+'), route('POST', 'auth/.+'), route('POST', 'support'), route('POST', 'feedback'), ...SUPPORT_API, route('POST', `jobs/${ID}/signature`)],
  manager: [
    route('GET', 'auth/.+'), route('POST', 'auth/.+'), route('POST', 'support'), route('POST', 'feedback'), ...SUPPORT_API,
    route('GET', '(jobs|clients|staff|services|photos|company|quotes|invoices|expenses|reports|tax-summary|overview|email-templates)'), route('GET', 'payments/stripe'),
    route('POST', '(jobs|quotes|invoices|expenses|services|clients|photos)'), route('POST', 'services/describe'), route('PUT', `(jobs|quotes|invoices|expenses|services|clients)/${ID}`),
    route('DELETE', `(jobs|quotes|invoices|expenses|services|photos)/${ID}`),
    route('POST', `quotes/${ID}/(send|approve|convert-to-job|mark-deposit-paid|set-deposit)`), route('POST', `invoices/${ID}/(send|mark-paid|payments)`), route('DELETE', `invoices/${ID}/payments/${ID}`), route('POST', `jobs/${ID}/(create-invoice|remind|signature)`), route('DELETE', `jobs/${ID}/signature`),
  ],
};
// a support session works like the owner, but can't change the owner's own login, the subscription, or support access itself
const SUPPORT_BLOCKED = /^\/api\/(auth\/(password|profile|hours)|account\/(billing|support-access)(\/.*)?)$/;
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && currentUser(req) && req._support && SUPPORT_BLOCKED.test(req.path)) return res.status(403).json({ error: 'Support sessions can’t change this. Ask the account owner.' });
  next();
});
app.use('/api', (req, res, next) => {
  const u = currentUser(req); if (!u || isAdmin(u)) return next();
  if ((ROLE_API[u.role] || []).some(([m, re]) => m === req.method && re.test(req.path))) return next();
  res.status(403).json({ error: 'Your access level doesn’t include this. Ask the account owner.' });
});
// features the account's plan doesn't include: lists come back empty (so pages still load), everything else is refused
app.use('/api', (req, res, next) => {
  const f = tenancy.lockedFeatureFor(tenancy.current(), req.method, req.path); if (!f) return next();
  if (req.method === 'GET' && /^\/api\/[a-z-]+$/.test(req.path) && COLLECTIONS.includes(req.path.slice(5))) return res.json([]);
  res.status(403).json({ error: `${f.label} isn’t included in your ${tenancy.planOf(tenancy.current()).name} plan`, upgrade: f.key });
});
// technicians see jobs without prices, totals or line items
const isMemberReq = (req) => { const u = currentUser(req); return !!u && u.role === 'technician'; };
// what a team member may see/change on a job: no prices, totals or line items
const MONEY_KEYS = ['items', 'subtotal', 'discount', 'discountType', 'discountValue', 'tax', 'total', 'taxRate', 'depositType', 'depositValue', 'depositFee'];
const jobForMember = (j) => Object.fromEntries(Object.entries(j).filter(([k]) => !MONEY_KEYS.includes(k)));
const MEMBER_JOB_FIELDS = ['title', 'clientId', 'address', 'date', 'startTime', 'endTime', 'staffIds', 'status', 'description', 'internalNotes'];

// ---------- team logins (owner/admin only; the /api guard above blocks members) ----------
const INVITE_DAYS = 7;
const userRow = (u) => ({ ...publicUser(u), staffId: u.staffId || null, status: u.passwordHash ? 'active' : 'invited', invitedAt: u.invitedAt || null, lastLoginAt: u.lastLoginAt || null });
app.get('/api/users', (req, res) => res.json(db.users.map(userRow)));
app.post('/api/users/invite', async (req, res) => { // invite (or re-invite) a team member; returns the link so it can also be shared by hand
  const st = db.staff.find((x) => x.id === (req.body && req.body.staffId)); if (!st) return res.status(404).json({ error: 'Team member not found' });
  const email = normEmail(st.email); if (!email.includes('@')) return res.status(400).json({ error: 'Add an email address for this team member first' });
  const role = ROLES.includes(req.body.role) ? req.body.role : 'technician';
  let user = db.users.find((u) => u.staffId === st.id) || db.users.find((u) => u.email === email);
  if (user && user.role === 'owner') return res.status(400).json({ error: 'This email belongs to the account owner' });
  if (user && user.passwordHash) return res.status(400).json({ error: 'They already have a login' });
  const max = tenancy.planOf(tenancy.current()).maxUsers || 0;
  if (max && !user && db.users.length >= max) return res.status(403).json({ error: `Your ${tenancy.planOf(tenancy.current()).name} plan includes ${max} login${max === 1 ? '' : 's'}. Upgrade to add more of your team.`, upgrade: 'users' });
  if (!user) { user = { id: uid(), createdAt: iso(new Date()) }; db.users.push(user); }
  Object.assign(user, { name: st.name, email, role, staffId: st.id, invitedAt: iso(new Date()), invitedBy: currentUser(req).id });
  for (const [k, t] of Object.entries(db.resetTokens)) if (t.userId === user.id) delete db.resetTokens[k]; // old invite links stop working
  const tok = crypto.randomBytes(32).toString('hex'); db.resetTokens[sha(tok)] = { userId: user.id, expires: Date.now() + INVITE_DAYS * 864e5, invite: true }; save();
  const link = `${baseUrl()}/login?invite=${tok}`;
  const sent = await sendTemplate('teamInvite', email, { name: st.name, inviter: currentUser(req).name, business: db.company.name, link, days: String(INVITE_DAYS) });
  res.json({ user: userRow(user), link, emailed: sent.status === 'sent', detail: sent.detail });
});
app.put('/api/users/:id', (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id); if (!u) return res.status(404).json({ error: 'Not found' });
  if (u.role === 'owner') return res.status(400).json({ error: 'The owner’s role can’t be changed' });
  u.role = ROLES.includes(req.body && req.body.role) ? req.body.role : 'technician'; save(); res.json(userRow(u));
});
function removeUser(u) {
  db.users = db.users.filter((x) => x.id !== u.id);
  for (const [k, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[k]; // signs them out right away
  for (const [k, t] of Object.entries(db.resetTokens)) if (t.userId === u.id) delete db.resetTokens[k];
}
app.delete('/api/users/:id', (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id); if (!u) return res.status(404).json({ error: 'Not found' });
  if (u.role === 'owner') return res.status(400).json({ error: 'The owner’s login can’t be removed' });
  if (u.id === currentUser(req).id) return res.status(400).json({ error: 'You can’t remove your own login' });
  removeUser(u); save(); res.json({ ok: true });
});
// invite acceptance (public: the token is the proof)
app.get('/api/auth/invite', (req, res) => {
  const t = db.resetTokens[sha(req.query.token || '')]; const u = t && t.invite && t.expires > Date.now() && db.users.find((x) => x.id === t.userId);
  if (!u) return res.status(400).json({ error: 'This invite link has expired or was replaced. Ask for a new one.' });
  res.json({ name: u.name, email: u.email });
});
app.post('/api/auth/accept-invite', (req, res) => {
  const k = sha((req.body && req.body.token) || ''); const t = db.resetTokens[k]; const u = t && t.invite && t.expires > Date.now() && db.users.find((x) => x.id === t.userId);
  if (!u) return res.status(400).json({ error: 'This invite link has expired or was replaced. Ask for a new one.' });
  if (String((req.body && req.body.password) || '').length < 8) return res.status(400).json({ error: 'Use a password with at least 8 characters' });
  if (staffBlocked(u)) return res.status(403).json({ error: 'Your login access is turned off. Ask the account owner.' });
  const { salt, hash } = hashPassword(req.body.password); Object.assign(u, { salt, passwordHash: hash, lastLoginAt: new Date().toISOString() }); delete db.resetTokens[k];
  startSession(res, u); res.json(publicUser(u));
});
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/api/auth/state', (req, res) => res.json({ needsSetup: !db.users.length, user: publicUser(currentUser(req)), company: { name: db.company.name, logo: db.company.logo, brandColor: db.company.brandColor }, product: brandLib.brand(), emailReady: !!emailProvider() }));
app.get('/api/auth/me', (req, res) => (currentUser(req) ? res.json({ ...publicUser(currentUser(req)), ...(req._support ? { support: { adminName: req._support.adminName, expires: req._support.expires } } : {}) }) : res.status(401).json({ error: 'Please log in' })));
app.post('/api/auth/setup', (req, res) => { // first run only: create the owner account
  if (db.users.length) return res.status(403).json({ error: 'An account already exists. Log in instead.' });
  const { name, email, password } = req.body || {};
  if (!String(name || '').trim() || !normEmail(email).includes('@')) return res.status(400).json({ error: 'Enter your name and email address' });
  if (String(password || '').length < 8) return res.status(400).json({ error: 'Use a password with at least 8 characters' });
  const { salt, hash } = hashPassword(password);
  const user = { id: uid(), name: String(name).trim(), email: normEmail(email), role: 'owner', salt, passwordHash: hash, createdAt: iso(new Date()) };
  db.users.push(user); ensureOwnerStaff(); save(); startSession(res, user); res.json(publicUser(user));
});
app.post('/api/auth/login', (req, res) => {
  const email = normEmail(req.body && req.body.email); const key = tenancy.current().id + '|' + email + '|' + req.socket.remoteAddress;
  if (tooMany(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes or reset your password.' });
  const user = db.users.find((u) => u.email === email);
  if (!user || !user.passwordHash || !checkPassword(String((req.body && req.body.password) || ''), user)) { recordFailure(key); return res.status(401).json({ error: 'That email and password don’t match an account' }); }
  if (staffBlocked(user)) return res.status(403).json({ error: 'Your login access is turned off. Ask the account owner.' });
  failures.delete(key); user.lastLoginAt = new Date().toISOString(); startSession(res, user); res.json(publicUser(user));
});
app.post('/api/auth/logout', (req, res) => {
  delete db.sessions[sha(cookies(req).sid || '')]; save();
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.json({ ok: true });
});
app.get('/api/auth/verify-email', (req, res) => {
  const h = sha(String(req.query.token || '')); const u = db.users.find((x) => x.emailVerify && x.emailVerify.hash === h);
  const login = `<a href="/login?email=${encodeURIComponent(u ? u.email : '')}">Log in</a>`;
  if (!u || u.emailVerify.expires < Date.now()) return res.status(400).send(notice('This link doesn’t work', `It was already used or is more than 7 days old. ${login} and you can keep using your account.`));
  delete u.emailVerify; u.emailVerifiedAt = new Date().toISOString(); save();
  sendTemplate('welcome', u.email, { name: u.name, business: db.company.name || tenancy.current().name, account_url: baseUrl() }, { server: true }).catch(() => {});
  res.send(notice('Email confirmed', `Thanks, ${esc(u.name)}. Your email address is confirmed. ${login}`));
});
app.post('/api/auth/forgot', async (req, res) => { // always answers the same, so it doesn't reveal which emails have accounts
  const user = db.users.find((u) => u.email === normEmail(req.body && req.body.email));
  if (user) {
    const token = crypto.randomBytes(32).toString('hex'); db.resetTokens[sha(token)] = { userId: user.id, expires: Date.now() + 60 * 60e3 }; save();
    await sendTemplate('passwordReset', user.email, { name: user.name, business: db.company.name, link: `${baseUrl()}/login?reset=${token}` });
  }
  res.json({ ok: true });
});
app.post('/api/auth/reset', (req, res) => {
  const k = sha((req.body && req.body.token) || ''); const t = db.resetTokens[k];
  if (!t || t.expires < Date.now()) return res.status(400).json({ error: 'This reset link has expired. Ask for a new one.' });
  if (String((req.body && req.body.password) || '').length < 8) return res.status(400).json({ error: 'Use a password with at least 8 characters' });
  const user = db.users.find((u) => u.id === t.userId); if (!user) return res.status(400).json({ error: 'Account not found' });
  const { salt, hash } = hashPassword(req.body.password); user.salt = salt; user.passwordHash = hash; delete db.resetTokens[k];
  for (const [sk, s] of Object.entries(db.sessions)) if (s.userId === user.id) delete db.sessions[sk]; // sign out everywhere
  startSession(res, user); res.json(publicUser(user));
});

// ---- my profile: any logged-in user edits their own name, contact info, photo and password ----
// Photo and contact details live on the linked team member record (so they show on schedules); an owner without one keeps them on the user.
const PROFILE_FIELDS = ['phone', 'street', 'city', 'state', 'zip', 'country'];
const profileOf = (u) => { const st = staffOfUser(u); const src = st || u; return { ...publicUser(u), ...Object.fromEntries(PROFILE_FIELDS.map((k) => [k, src[k] || ''])), color: (st && st.color) || '', jobTitle: (st && st.role) || '', linked: !!st, hours: (st && st.hours) || null }; };
app.get('/api/auth/profile', (req, res) => { const u = currentUser(req); if (!u) return res.status(401).json({ error: 'Please log in' }); res.json(profileOf(u)); });
app.post('/api/auth/profile', (req, res) => {
  const u = currentUser(req); if (!u) return res.status(401).json({ error: 'Please log in' });
  const b = req.body || {}; const name = String(b.name || '').trim(); const email = normEmail(b.email);
  if (!name) return res.status(400).json({ error: 'Enter your name' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (email !== u.email) { // the email is the login, so changing it needs the current password
    if (db.users.some((x) => x.id !== u.id && x.email === email)) return res.status(400).json({ error: 'Another login already uses that email' });
    const key = 'pw|' + u.id; if (tooMany(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    if (!checkPassword(String(b.currentPassword || ''), u)) { recordFailure(key); return res.status(400).json({ error: 'Your current password is incorrect' }); }
  }
  const st = staffOfUser(u); const src = st || u;
  if ('photo' in b && b.photo && b.photo !== src.photo) {
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.photo)) return res.status(400).json({ error: 'Use a PNG, JPG or WebP image' });
    if (b.photo.length > 2e6) return res.status(400).json({ error: 'That image is too large' });
  }
  for (const k of PROFILE_FIELDS) if (k in b) src[k] = String(b[k] || '').trim();
  if ('photo' in b) src.photo = b.photo || '';
  if (st) { st.name = name; st.email = email; }
  u.name = name; u.email = email; save(); res.json(profileOf(u));
});
// a team member sets their own weekly availability (shown on Staff Schedules, used for booking warnings)
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
app.post('/api/auth/hours', (req, res) => {
  const u = currentUser(req); if (!u) return res.status(401).json({ error: 'Please log in' });
  const st = staffOfUser(u); if (!st) return res.status(400).json({ error: 'Your login isn’t linked to a team member, so there are no hours to set.' });
  const h = (req.body && req.body.hours) || {}; const hours = {};
  for (const d of DAYS) {
    const x = h[d] || {}; if (!HHMM.test(x.start || '') || !HHMM.test(x.end || '')) return res.status(400).json({ error: 'Enter a start and end time for every day' });
    if (x.on && x.end <= x.start) return res.status(400).json({ error: 'Each end time must be after its start time' });
    hours[d] = { on: !!x.on, start: x.start, end: x.end };
  }
  st.hours = hours; save(); res.json(profileOf(u));
});
app.post('/api/auth/password', (req, res) => {
  const u = currentUser(req); if (!u) return res.status(401).json({ error: 'Please log in' });
  const { currentPassword, newPassword } = req.body || {}; const key = 'pw|' + u.id;
  if (tooMany(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  if (!checkPassword(String(currentPassword || ''), u)) { recordFailure(key); return res.status(400).json({ error: 'Your current password is incorrect' }); }
  if (String(newPassword || '').length < 8) return res.status(400).json({ error: 'Use a new password with at least 8 characters' });
  const { salt, hash } = hashPassword(newPassword); u.salt = salt; u.passwordHash = hash; failures.delete(key);
  const mine = sha(cookies(req).sid || ''); // keep this session, sign out everywhere else
  for (const [sk, s] of Object.entries(db.sessions)) if (s.userId === u.id && sk !== mine) delete db.sessions[sk];
  save(); res.json({ ok: true });
});

app.use('/uploads', (req, res, next) => express.static(uploadDir())(req, res, next)); // each account's own uploads folder
app.use(express.static(path.join(__dirname, 'public')));

const COLLECTIONS = ['clients', 'services', 'staff', 'quotes', 'jobs', 'invoices', 'expenses', 'photos'];

// the account's plan: which features it has, which pages are locked, its web addresses
function accountInfo() {
  const t = tenancy.current(); const plan = tenancy.planOf(t);
  return {
    slug: t.slug, plan: { id: plan.id, name: plan.name }, features: plan.features, lockedPages: tenancy.lockedPages(t), betaPages: tenancy.betaPages(), maxUsers: plan.maxUsers || 0,
    url: tenancy.tenantUrl(t), subdomainUrl: tenancy.subdomainUrl(t), rootDomain: tenancy.ROOT_DOMAIN, serverIp: process.env.SERVER_IP || '',
    domains: (t.domains || []).map(({ host, verified, primary, addedAt, verifiedAt }) => ({ host, verified: !!verified, primary: !!primary, addedAt, verifiedAt: verifiedAt || null })),
    productName: tenancy.platform().settings.productName, product: brandLib.brand(), contactEmail: tenancy.platform().settings.contactEmail, helpUrl: tenancy.helpUrl(), managed: !tenancy.isDefault(),
    featureList: tenancy.FEATURES.map(({ key, label, desc }) => ({ key, label, desc, beta: tenancy.isBeta(key), included: plan.features.includes(key) })), alwaysIncluded: tenancy.ALWAYS_INCLUDED,
  };
}
app.get('/api/company', (req, res) => res.json({ ...db.company, account: accountInfo() }));
app.put('/api/company', (req, res) => {
  if (!tenancy.has('branding')) delete req.body.brandColor; // custom branding is a plan feature
  for (const k of Object.keys(PREFIX_DEFAULTS)) if (k in req.body) {
    const v = String(req.body[k] ?? '').trim();
    if (v.length > 10 || !/^[A-Za-z0-9 #._\/-]*$/.test(v)) return res.status(400).json({ error: 'Number prefixes can be up to 10 letters, numbers, spaces or # . _ / -' });
    req.body[k] = v;
  }
  const b = req.body;
  for (const [k, ok] of Object.entries(REGIONAL)) if (k in b && !ok(b[k])) return res.status(400).json({ error: `Choose a valid ${k === 'timezone' ? 'time zone' : k === 'dateFormat' ? 'date format' : k === 'timeFormat' ? 'time format' : 'first day of the week'}` });
  if ('hours' in b) { const h = readHours(b.hours); if (!h) return res.status(400).json({ error: 'Check the business hours: each open day needs an end time after its start time' }); b.hours = h; }
  const allowed = ['name', 'email', 'phone', 'website', 'address', 'logo', 'taxRate', 'paymentTermsDays', 'invoiceFooter', 'brandColor', 'zelleRecipient', 'zelleName', 'quoteDisclaimer', 'invoiceDisclaimer', ...Object.keys(PREFIX_DEFAULTS),
    ...ADDRESS_PARTS, 'taxIdName', 'taxIdNumber', 'taxName', 'taxDescription', 'hours', ...Object.keys(REGIONAL)];
  for (const k of allowed) if (k in b) db.company[k] = k === 'taxRate' || k === 'paymentTermsDays' ? Number(b[k]) || 0 : typeof b[k] === 'string' ? b[k].trim().slice(0, 500) : b[k];
  for (const k of ['aiEnabled', 'addressPrivate', 'showHours']) if (k in b) db.company[k] = b[k] === true || b[k] === 'on' || b[k] === 'true';
  if (ADDRESS_PARTS.some((k) => k in b)) db.company.address = composeAddress(db.company); // the one-line address used everywhere else
  if ('timezone' in b) applyTimezone();
  save(); res.json({ ...db.company, account: accountInfo() });
});
app.post('/api/company/logo', (req, res) => {
  const { dataUrl } = req.body;
  const m = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return res.status(400).json({ error: 'Invalid image' });
  const ext = m[1] === 'svg+xml' ? 'svg' : m[1] === 'jpeg' ? 'jpg' : m[1];
  const file = `logo-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(uploadDir(), file), Buffer.from(m[2], 'base64'));
  db.company.logo = `/uploads/${file}`; save(); res.json(db.company);
});
app.delete('/api/company/logo', (req, res) => {
  const old = /^\/uploads\/(logo-[\w-]+\.\w+)$/.exec(db.company.logo || '');
  if (old) fs.rm(path.join(uploadDir(), old[1]), () => {});
  db.company.logo = ''; save(); res.json(db.company);
});
app.post('/api/company/icon', (req, res) => {
  const { dataUrl } = req.body;
  const m = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl || '');
  if (!m || dataUrl.length > 2e6) return res.status(400).json({ error: 'Invalid icon image' });
  const ext = m[1] === 'svg+xml' ? 'svg' : m[1] === 'jpeg' ? 'jpg' : m[1];
  const file = `icon-${Date.now()}-${uid()}.${ext}`;
  fs.writeFileSync(path.join(uploadDir(), file), Buffer.from(m[2], 'base64'));
  const old = /^\/uploads\/(icon-[\w-]+\.\w+)$/.exec(db.company.icon || '');
  if (old) fs.rm(path.join(uploadDir(), old[1]), () => {});
  db.company.icon = `/uploads/${file}`; save(); res.json(db.company);
});
app.get('/favicon.ico', (req, res) => {
  const m = /^\/uploads\/(icon-[\w-]+\.\w+)$/.exec(db.company.icon || '');
  if (!m) { res.statusCode = 404; return res.end(); }
  res.setHeader('Cache-Control', 'no-cache'); // browsers recheck, so a new icon shows on the next page load
  res.sendFile(path.join(uploadDir(), m[1]));
});

app.get('/api/notifications', (req, res) => res.json(db.notifications));

// ---------- the account's own domain (Custom domain feature) ----------
// Add a domain, point its DNS at the platform, then Check: once the DNS points here it's verified and starts working.
const accountDomain = (req) => { const t = tenancy.current(); const host = tenancy.hostOnly(String(req.params.host || '').trim()); return { t, host, d: (t.domains || []).find((x) => x.host === host) }; };
app.post('/api/account/domains', (req, res) => {
  const t = tenancy.current(); const host = tenancy.hostOnly(String((req.body && req.body.host) || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
  const bad = tenancy.domainProblem(host, t); if (bad) return res.status(400).json({ error: bad });
  t.domains = t.domains || [];
  if (t.domains.some((d) => d.host === host)) return res.status(400).json({ error: 'You already added that domain' });
  if (t.domains.length >= 5) return res.status(400).json({ error: 'You can add up to 5 domains' });
  t.domains.push({ host, verified: false, primary: false, addedAt: new Date().toISOString() }); tenancy.savePlatform(); res.status(201).json(accountInfo());
});
app.post('/api/account/domains/:host/check', async (req, res) => {
  const { t, d } = accountDomain(req); if (!d) return res.status(404).json({ error: 'Domain not found' });
  const r = await tenancy.checkDns(d.host, t);
  if (r.ok && !d.verified) { d.verified = true; d.verifiedAt = new Date().toISOString(); if (!t.domains.some((x) => x.primary)) d.primary = true; tenancy.savePlatform(); }
  res.json({ ...r, account: accountInfo() });
});
app.post('/api/account/domains/:host/primary', (req, res) => {
  const { t, d } = accountDomain(req); if (!d) return res.status(404).json({ error: 'Domain not found' });
  if (!d.verified) return res.status(400).json({ error: 'Verify the domain before making it the main address' });
  t.domains.forEach((x) => { x.primary = x === d; }); tenancy.savePlatform(); res.json(accountInfo());
});
app.delete('/api/account/domains/:host', (req, res) => {
  const { t, d } = accountDomain(req); if (!d) return res.status(404).json({ error: 'Domain not found' });
  t.domains = t.domains.filter((x) => x !== d);
  if (d.primary) { const next = t.domains.find((x) => x.verified); if (next) next.primary = true; }
  tenancy.savePlatform(); res.json(accountInfo());
});
// "Connect with Stripe" (Online card payments feature): the business signs up for or finishes its Stripe account on Stripe's own pages
const connectReturn = () => `${baseUrl()}/settings/connections?stripe=connected`;
async function stripeOnboardingLink() {
  const key = stripeLib.platformKey(); const sec = { ...secrets() }; const t = tenancy.current();
  if (!sec.stripeAccountId) {
    const a = await stripeLib.request(key, 'POST', 'accounts', { type: 'standard', ...(db.company.email ? { email: db.company.email } : {}), 'business_profile[name]': db.company.name || t.name, 'metadata[tenantId]': t.id });
    sec.stripeAccountId = a.id; sec.stripeChargesEnabled = !!a.charges_enabled; db.secrets = sec; save();
    t.stripeAccountId = a.id; tenancy.savePlatform(); // so the platform's Connect webhook can find this account
  }
  const l = await stripeLib.request(key, 'POST', 'account_links', { account: sec.stripeAccountId, type: 'account_onboarding', refresh_url: `${baseUrl()}/stripe/connect`, return_url: connectReturn() });
  return l.url;
}
// read the connected account's status from Stripe (charges switch on once Stripe has verified the business)
async function syncStripeAccount() {
  const sec = { ...secrets() }; if (!sec.stripeAccountId || !stripeLib.platformKey()) return;
  try {
    const a = await stripeLib.request(stripeLib.platformKey(), 'GET', 'accounts/' + encodeURIComponent(sec.stripeAccountId));
    Object.assign(sec, { stripeChargesEnabled: !!a.charges_enabled, stripeDetailsSubmitted: !!a.details_submitted, stripeAccountName: (a.settings && a.settings.dashboard && a.settings.dashboard.display_name) || (a.business_profile && a.business_profile.name) || a.email || '' });
    db.secrets = sec; save();
  } catch (e) { console.error('Stripe account check failed:', e.message); }
}
app.post('/api/integrations/stripe/connect', async (req, res) => {
  if (!stripeLib.platformKey()) return res.status(503).json({ error: 'Card payments aren’t available on this server yet. Contact support.' });
  try { res.json({ url: await stripeOnboardingLink() }); } catch (e) { console.error('Stripe Connect failed:', e.message); res.status(502).json({ error: `Stripe couldn’t start the setup: ${e.message}` }); }
});
// Stripe sends people here when an onboarding link has expired: make a fresh one
app.get('/stripe/connect', async (req, res) => {
  if (!isAdmin(currentUser(req)) || !tenancy.has('onlinePayments') || !stripeLib.platformKey()) return res.redirect('/settings');
  try { res.redirect(await stripeOnboardingLink()); } catch (e) { res.redirect('/settings/connections?stripe=error'); }
});
// forget the connected account (and any older pasted keys); the business keeps its Stripe account and its money
app.post('/api/integrations/stripe/disconnect', (req, res) => {
  const t = tenancy.current(); delete t.stripeAccountId; tenancy.savePlatform();
  const sec = { ...secrets() }; for (const k of ['stripeAccountId', 'stripeChargesEnabled', 'stripeDetailsSubmitted', 'stripeAccountName', 'stripeSecretKey', 'stripeWebhookSecret']) delete sec[k];
  db.secrets = sec; save(); res.json({ ok: true });
});
// the account's own email and Twilio accounts (owner/admin only: these routes aren't in ROLE_API). Blank secrets keep the saved ones.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
app.put('/api/integrations/email', (req, res) => {
  const b = req.body || {}; const provider = String(b.provider || ''); const old = ownEmail() && ownEmail().provider === provider ? ownEmail() : {};
  const str = (k, n = 200) => String(b[k] || '').trim().slice(0, n);
  const e = { provider, fromName: str('fromName', 100) };
  if (provider === 'gmail') {
    Object.assign(e, { user: str('user').toLowerCase(), pass: str('pass').replace(/\s/g, '') || old.pass || '' }); e.from = e.user;
    if (!EMAIL_RE.test(e.user)) return res.status(400).json({ error: 'Enter your Gmail address' });
    if (!e.pass) return res.status(400).json({ error: 'Enter a Google app password (myaccount.google.com/apppasswords)' });
  } else if (provider === 'sendgrid') {
    Object.assign(e, { apiKey: str('apiKey', 300) || old.apiKey || '', from: str('from').toLowerCase() });
    if (!e.apiKey) return res.status(400).json({ error: 'Enter your SendGrid API key' });
    if (!EMAIL_RE.test(e.from)) return res.status(400).json({ error: 'Enter the sender address you verified in SendGrid' });
  } else if (provider === 'smtp') {
    Object.assign(e, { host: str('host').toLowerCase(), port: Math.floor(Number(b.port)) || 465, user: str('user'), pass: str('pass') || old.pass || '', from: str('from').toLowerCase() });
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(e.host)) return res.status(400).json({ error: 'Enter the SMTP server, e.g. smtp.yourmailhost.com' });
    if (e.port !== 465) return res.status(400).json({ error: 'Use your mail server’s SSL/TLS port 465' });
    if (!e.user || !e.pass) return res.status(400).json({ error: 'Enter the SMTP username and password' });
    if (!EMAIL_RE.test(e.from)) return res.status(400).json({ error: 'Enter the address emails come from' });
  } else return res.status(400).json({ error: 'Choose Gmail, SendGrid or another mail server' });
  db.secrets = { ...secrets(), email: e }; save(); res.json({ ok: true });
});
app.delete('/api/integrations/email', (req, res) => { const sec = { ...secrets() }; delete sec.email; db.secrets = sec; save(); res.json({ ok: true }); });
app.put('/api/integrations/twilio', (req, res) => {
  if (!tenancy.has('sms')) return res.status(403).json({ error: 'Text messages aren’t included in your plan' });
  const b = req.body || {}; const old = ownTwilio() || {};
  const sid = String(b.sid || '').trim(); const token = String(b.token || '').trim() || (sid === old.sid ? old.token : ''); const raw = String(b.from || '').trim();
  const from = /^MG[0-9a-f]{32}$/i.test(raw) ? raw : toE164(raw);
  if (!/^AC[0-9a-f]{32}$/i.test(sid)) return res.status(400).json({ error: 'Enter your Twilio Account SID (starts with AC)' });
  if (!token) return res.status(400).json({ error: 'Enter your Twilio Auth Token' });
  if (!/^MG/i.test(from) && !/^\+\d{10,15}$/.test(from)) return res.status(400).json({ error: 'Enter your Twilio phone number, e.g. (713) 555-0100, or a Messaging Service SID (MG…)' });
  db.secrets = { ...secrets(), twilio: { sid, token, from } }; save(); res.json({ ok: true });
});
app.delete('/api/integrations/twilio', (req, res) => { const sec = { ...secrets() }; delete sec.twilio; db.secrets = sec; save(); res.json({ ok: true }); });
app.post('/api/integrations/test', async (req, res) => {
  const b = req.body || {}; const to = String(b.to || '').trim();
  if (b.channel === 'sms') {
    if (!tenancy.has('sms')) return res.status(403).json({ error: 'Text messages aren’t included in your plan' });
    return res.json(await sendSms(to, `Test message from ${db.company.name}. Text messages are working.`));
  }
  if (!EMAIL_RE.test(to)) return res.status(400).json({ error: 'Enter an email address to send the test to' });
  res.json(await sendEmail(to, `Test email from ${db.company.name}`, `This is a test email from ${db.company.name}. Emails to your clients are working.`));
});

// ---------- AI: draft a product/service description from its name (needs ANTHROPIC_API_KEY) ----------
let anthropic = null;
const aiClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) { const Anthropic = require('@anthropic-ai/sdk'); anthropic = new Anthropic(); }
  return anthropic;
};
app.post('/api/services/describe', async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 200);
  const kind = req.body.type === 'product' ? 'product' : 'service';
  if (!name) return res.status(400).json({ error: 'Enter a name first' });
  if (db.company.aiEnabled === false) return res.status(403).json({ error: 'AI assistance is turned off in App Settings' });
  const client = aiClient();
  if (!client) return res.status(503).json({ error: 'AI descriptions need ANTHROPIC_API_KEY in the .env file' });
  const Anthropic = require('@anthropic-ai/sdk');
  try {
    const r = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // if the request is declined, the API retries it on a suitable fallback model
      output_config: { effort: 'low' },
      system: `You write line-item descriptions for the quotes and invoices of ${db.company.name || 'a field service business'}, a field service business. The customer reads them.
Given the name of a ${kind}, write one or two plain sentences (under 40 words) saying what it includes or what the customer gets.
Plain text only: no markdown, no quotes, no price, no heading. Don't invent specifics such as brands, warranties, durations or quantities that the name doesn't state.`,
      messages: [{ role: 'user', content: `${kind === 'product' ? 'Product' : 'Service'} name: ${name}` }],
    });
    if (r.stop_reason === 'refusal') return res.status(422).json({ error: 'The AI couldn\u2019t write a description for that name. Try rewording it.' });
    const description = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!description) return res.status(502).json({ error: 'The AI returned an empty description. Try again.' });
    res.json({ description });
  } catch (err) {
    console.error('AI description failed:', err.message);
    if (err instanceof Anthropic.AuthenticationError) return res.status(502).json({ error: 'Your ANTHROPIC_API_KEY was rejected. Check it in the .env file.' });
    if (err instanceof Anthropic.RateLimitError) return res.status(503).json({ error: 'The AI is busy right now. Try again in a minute.' });
    if (err instanceof Anthropic.APIError && err.status) return res.status(502).json({ error: `The AI service returned an error (${err.status}). Try again.` });
    res.status(502).json({ error: 'Couldn\u2019t reach the AI service. Check your internet connection.' });
  }
});

// generic list / get
app.get('/api/:col', (req, res, next) => {
  const col = req.params.col;
  if (!COLLECTIONS.includes(col)) return next();
  if (col === 'jobs' && isMemberReq(req)) return res.json(db.jobs.map(jobForMember));
  res.json(col === 'invoices' ? db.invoices.map(withStatus) : db[col]);
});

// quote / job / invoice numbers: automatic (Q-1001, J-2001, INV-3001…), or typed in by an admin for quotes and invoices; always unique.
// The prefixes are set in App Settings; changing one only affects numbers made afterwards.
// A typed number in the usual format (e.g. Q-2000) moves the counter on, so the next automatic one follows it.
const PREFIX_DEFAULTS = { quotePrefix: 'Q-', jobPrefix: 'J-', invoicePrefix: 'INV-' };
const docPrefix = (k) => db.company[k] ?? PREFIX_DEFAULTS[k];
const NUMBERING = { quotes: ['quotePrefix', 'quote'], jobs: ['jobPrefix', 'job'], invoices: ['invoicePrefix', 'invoice'] };
const DOC_NUM = { quotes: NUMBERING.quotes, invoices: NUMBERING.invoices }; // the ones that can be typed in
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function nextNumber(col) {
  const [pk, key] = NUMBERING[col]; const prefix = docPrefix(pk); let n;
  do n = prefix + ++db.counters[key]; while (db[col].some((d) => String(d.number).toLowerCase() === n.toLowerCase()));
  return n;
}
function customNumber(col, raw, id) {
  const num = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!num) return { error: 'Enter a number' };
  if (num.length > 30) return { error: 'Keep the number to 30 characters or fewer' };
  const label = col === 'quotes' ? 'quote' : 'invoice';
  if (db[col].some((d) => d.id !== id && String(d.number).toLowerCase() === num.toLowerCase())) return { error: `Another ${label} already uses number ${num}` };
  const [pk, key] = DOC_NUM[col]; const m = new RegExp('^' + escRe(docPrefix(pk)) + '(\\d+)$', 'i').exec(num);
  if (m && Number(m[1]) > db.counters[key]) db.counters[key] = Number(m[1]);
  return { number: num };
}

// create
app.post('/api/:col', (req, res, next) => {
  const col = req.params.col;
  if (!COLLECTIONS.includes(col) || col === 'photos') return next();
  let b = req.body || {};
  if (col === 'jobs' && isMemberReq(req)) b = Object.fromEntries(Object.entries(b).filter(([k]) => MEMBER_JOB_FIELDS.includes(k)));
  let doc = { ...b, id: uid(), createdAt: iso(new Date()) };
  if (DOC_NUM[col] && String(b.number || '').trim()) { const r = customNumber(col, b.number); if (r.error) return res.status(400).json({ error: r.error }); doc.number = r.number; }
  if (col === 'clients') { doc.portalToken = token(); }
  if (col === 'quotes') {
    doc.number = doc.number || nextNumber('quotes'); doc.status = b.status || 'draft'; doc.token = token();
    if (b.taxRate === undefined) doc.taxRate = db.company.taxRate; computeTotals(doc);
  }
  if (col === 'invoices') {
    doc.number = doc.number || nextNumber('invoices'); doc.status = b.status || 'draft'; doc.token = token(); doc.paidAt = null;
    doc.issueDate = b.issueDate || iso(new Date());
    doc.dueDate = b.dueDate || doc.issueDate; // default terms: due upon receipt
    if (b.taxRate === undefined) doc.taxRate = db.company.taxRate; computeTotals(doc);
  }
  if (col === 'jobs') {
    delete doc.signature;
    doc.number = nextNumber('jobs'); doc.status = b.status || 'scheduled'; doc.staffIds = b.staffIds || [];
    if (!doc.address && b.clientId) { const c = findClient(b.clientId); if (c) doc.address = c.address; }
    if (Array.isArray(b.items)) { if (b.taxRate === undefined) doc.taxRate = db.company.taxRate; computeTotals(doc); }
  }
  if (col === 'expenses') doc.amount = Number(b.amount) || 0;
  if (col === 'services') doc.price = Number(b.price) || 0;
  db[col].push(doc); save(); res.status(201).json(col === 'invoices' ? withStatus(doc) : col === 'jobs' && isMemberReq(req) ? jobForMember(doc) : doc);
});

// update
app.put('/api/:col/:id', (req, res, next) => {
  const col = req.params.col;
  if (!COLLECTIONS.includes(col)) return next();
  const i = db[col].findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  const protectedKeys = ['id', 'number', 'token', 'portalToken', 'createdAt'];
  let upd = { ...req.body }; protectedKeys.forEach((k) => delete upd[k]);
  if (DOC_NUM[col] && String((req.body || {}).number || '').trim() && req.body.number !== db[col][i].number) { // renumber a quote / invoice
    const r = customNumber(col, req.body.number, req.params.id); if (r.error) return res.status(400).json({ error: r.error }); upd.number = r.number;
  }
  if (col === 'jobs' && isMemberReq(req)) upd = Object.fromEntries(Object.entries(upd).filter(([k]) => MEMBER_JOB_FIELDS.includes(k)));
  let doc = { ...db[col][i], ...upd };
  if (col === 'quotes') applyDepositPaymentEdit(doc, upd);
  if (col === 'quotes' || col === 'invoices' || (col === 'jobs' && Array.isArray(doc.items))) computeTotals(doc); // jobs are priced once they have line items
  if (col === 'jobs') { if (db.jobs[i].signature) doc.signature = db.jobs[i].signature; else delete doc.signature; } // signatures only via /signature
  if (col === 'invoices') { // payments change only through their own endpoints, never through an invoice edit
    if (db.invoices[i].payments) doc.payments = db.invoices[i].payments; else delete doc.payments;
    if ((doc.payments || []).length) settleInvoice(doc);
  }
  if (col === 'staff' && isOwnerStaff(doc) && doc.status === 'deactivated') return res.status(400).json({ error: 'The account owner can’t be deactivated' });
  if (col === 'expenses') doc.amount = Number(doc.amount) || 0;
  if (col === 'services') doc.price = Number(doc.price) || 0;
  db[col][i] = doc; save(); res.json(col === 'invoices' ? withStatus(doc) : col === 'jobs' && isMemberReq(req) ? jobForMember(doc) : doc);
});

app.delete('/api/:col/:id', (req, res, next) => {
  const col = req.params.col;
  if (!COLLECTIONS.includes(col)) return next();
  const i = db[col].findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  if (col === 'staff' && isOwnerStaff(db.staff[i])) return res.status(400).json({ error: 'The account owner can’t be removed from the team' });
  const [removed] = db[col].splice(i, 1);
  if (col === 'staff') db.users.filter((u) => u.staffId === removed.id && u.role !== 'owner').forEach(removeUser);
  if (col === 'photos' && removed.file) fs.rmSync(path.join(uploadDir(), path.basename(removed.file)), { force: true });
  save(); res.json({ ok: true });
});

// photos
// ---- client signature on a job: collected on the team member's device (finger or mouse), saved as a PNG ----
// Anyone who can open the job may collect it; only managers / admins can remove one (so a technician can't overwrite it).
app.post('/api/jobs/:id/signature', (req, res) => {
  const j = db.jobs.find((x) => x.id === req.params.id); if (!j) return res.status(404).json({ error: 'Job not found' });
  const u = currentUser(req);
  if (j.signature && !isAdmin(u) && u.role !== 'manager') return res.status(400).json({ error: 'This job is already signed. Ask a manager to remove the signature first.' });
  const b = req.body || {}; const name = String(b.name || '').trim().slice(0, 100);
  if (!name) return res.status(400).json({ error: 'Enter the name of the person signing' });
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(b.dataUrl || '');
  if (!m || m[1].length < 200) return res.status(400).json({ error: 'Please sign in the box first' });
  if (m[1].length > 2e6) return res.status(400).json({ error: 'That signature image is too large' });
  const file = `sig-${token()}.png`; // unguessable name: uploads are served without login
  fs.writeFileSync(path.join(uploadDir(), file), Buffer.from(m[1], 'base64'));
  removeSignatureFile(j);
  j.signature = { file: `/uploads/${file}`, name, statement: String(b.statement || '').trim().slice(0, 300), signedAt: new Date().toISOString(), collectedBy: u ? u.name : '' };
  save(); res.status(201).json(isMemberReq(req) ? jobForMember(j) : j);
});
app.delete('/api/jobs/:id/signature', (req, res) => {
  const j = db.jobs.find((x) => x.id === req.params.id); if (!j) return res.status(404).json({ error: 'Job not found' });
  removeSignatureFile(j); delete j.signature; save(); res.json(j);
});
function removeSignatureFile(j) {
  const f = j.signature && /^\/uploads\/(sig-[a-f0-9]+\.png)$/.exec(j.signature.file || '');
  if (f) fs.rm(path.join(uploadDir(), f[1]), () => {});
}

app.post('/api/photos', (req, res) => {
  const { dataUrl, jobId, caption, type } = req.body;
  const m = /^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return res.status(400).json({ error: 'Invalid image' });
  const file = `photo-${Date.now()}-${uid()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(uploadDir(), file), Buffer.from(m[2], 'base64'));
  const doc = { id: uid(), jobId, caption: caption || '', type: type || 'progress', file: `/uploads/${file}`, createdAt: iso(new Date()) };
  db.photos.push(doc); save(); res.status(201).json(doc);
});

// ---------- workflow ----------
const quoteLink = (q) => `${baseUrl()}/p/quote/${q.token}`;
const invoiceLink = (inv) => `${baseUrl()}/pay/${inv.token}`;

// ---------- email templates (edited on Settings → Email Templates, stored in db.emailTemplates) ----------
const EMAIL_TEMPLATES = {
  quote: {
    label: 'Quote', description: 'Sent when you send a quote to a client.',
    subject: 'Quote {{quote_number}} from {{company_name}}',
    body: 'Hello {{client_name}},\n\nYour quote {{quote_number}} for {{total}} is ready.\nView and approve it here: {{link}}\n\n{{company_name}}',
    vars: { client_name: 'Client name', company_name: 'Your business name', quote_number: 'Quote number', quote_title: 'Quote title', total: 'Quote total', link: 'Link to view and approve' },
  },
  invoice: {
    label: 'Invoice', description: 'Sent when you send an invoice to a client.',
    subject: 'Invoice {{invoice_number}} from {{company_name}}',
    body: 'Hello {{client_name}},\n\nInvoice {{invoice_number}} for {{total}} is due {{due_date}}.\nPay securely online: {{link}}\n\n{{company_name}}',
    vars: { client_name: 'Client name', company_name: 'Your business name', invoice_number: 'Invoice number', total: 'Invoice total', due_date: 'Due date', link: 'Link to view and pay' },
  },
  reminder: {
    label: 'Appointment reminder', description: 'Sent when you send a job reminder by email.',
    subject: 'Appointment reminder from {{company_name}}',
    body: 'Hello {{client_name}},\n\nThis is a reminder of your appointment "{{job_title}}" on {{date}} at {{time}}.\nAddress: {{address}}\n\n{{company_name}}',
    vars: { client_name: 'Client name', company_name: 'Your business name', job_number: 'Job number', job_title: 'Job title', date: 'Appointment date', time: 'Start time', address: 'Job address' },
  },
};
const emailTemplate = (key) => ({ subject: EMAIL_TEMPLATES[key].subject, body: EMAIL_TEMPLATES[key].body, ...((db.emailTemplates || {})[key] || {}) });
const fillTemplate = (text, vars) => String(text).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m));
const niceDate = (s) => {
  if (!s) return '';
  const [y, m, d] = String(s).slice(0, 10).split('-'); const f = db.company.dateFormat;
  return f === 'MM/DD/YYYY' ? `${m}/${d}/${y}` : f === 'DD/MM/YYYY' ? `${d}/${m}/${y}` : f === 'YYYY-MM-DD' ? `${y}-${m}-${d}` : new Date(s.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
function renderEmail(key, vars) { const t = emailTemplate(key); return { subject: fillTemplate(t.subject, vars), body: fillTemplate(t.body, vars) }; }

app.get('/api/email-templates', (req, res) => res.json(Object.entries(EMAIL_TEMPLATES).map(([key, d]) => {
  const t = emailTemplate(key);
  return { key, label: d.label, description: d.description, vars: d.vars, subject: t.subject, body: t.body, defaultSubject: d.subject, defaultBody: d.body, custom: !!(db.emailTemplates || {})[key] };
})));
app.put('/api/email-templates/:key', (req, res) => {
  const key = req.params.key; if (!EMAIL_TEMPLATES[key]) return res.status(404).json({ error: 'Unknown template' });
  const subject = String((req.body && req.body.subject) || '').trim(); const body = String((req.body && req.body.body) || '').trim();
  if (!subject || !body) return res.status(400).json({ error: 'Subject and message are required' });
  db.emailTemplates = { ...(db.emailTemplates || {}), [key]: { subject, body } }; save(); res.json({ ok: true });
});
app.delete('/api/email-templates/:key', (req, res) => {
  if (db.emailTemplates) delete db.emailTemplates[req.params.key]; save(); res.json({ ok: true });
});

app.post('/api/quotes/:id/send', async (req, res) => {
  const q = db.quotes.find((x) => x.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const channels = (req.body.channels && req.body.channels.length) ? req.body.channels : ['email'];
  const link = quoteLink(q); const co = db.company.name;
  const results = [];
  const email = renderEmail('quote', { client_name: findClient(q.clientId)?.name || '', company_name: co, quote_number: q.number, quote_title: q.title || '', total: money(q.total), link });
  for (const ch of channels) {
    results.push(await notify({ clientId: q.clientId, channel: ch, kind: 'quote', refId: q.id, refNumber: q.number,
      subject: email.subject, body: ch === 'email' ? email.body : `${co}: Quote ${q.number} (${money(q.total)}) is ready: ${link}` }));
  }
  if (q.status === 'draft') q.status = 'sent'; if (!q.sentAt) q.sentAt = iso(new Date());
  save(); res.json({ quote: q, results });
});

app.post('/api/quotes/:id/approve', (req, res) => {
  const q = db.quotes.find((x) => x.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  q.status = req.body.status === 'declined' ? 'declined' : 'approved'; q.respondedAt = iso(new Date()); save(); res.json(q);
});

app.post('/api/quotes/:id/convert-to-job', (req, res) => {
  const q = db.quotes.find((x) => x.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const c = findClient(q.clientId);
  const job = { id: uid(), number: nextNumber('jobs'), clientId: q.clientId, title: q.title || 'Job from ' + q.number, description: q.items.map((i) => `${i.qty} x ${i.desc}`).join(', '), date: req.body.date || daysFromNow(1), startTime: req.body.startTime || '09:00', endTime: req.body.endTime || '11:00', staffIds: req.body.staffIds || [], status: 'scheduled', quoteId: q.id, address: c ? c.address : '', createdAt: iso(new Date()), items: q.items.map((i) => ({ ...i })), taxRate: q.taxRate, discountType: q.discountType, discountValue: q.discountValue };
  computeTotals(job);
  db.jobs.push(job); if (q.status !== 'approved') q.status = 'approved'; save(); res.status(201).json(job);
});

app.post('/api/jobs/:id/create-invoice', (req, res) => {
  const j = db.jobs.find((x) => x.id === req.params.id);
  if (!j) return res.status(404).json({ error: 'Not found' });
  const q = j.quoteId && db.quotes.find((x) => x.id === j.quoteId);
  const items = j.items && j.items.length ? j.items : q ? q.items : [{ desc: j.title, qty: 1, price: 0 }]; // the job's own lines win
  const inv = computeTotals({ id: uid(), number: nextNumber('invoices'), clientId: j.clientId, jobId: j.id, subject: j.title, status: 'draft', issueDate: iso(new Date()), dueDate: iso(new Date()), paymentTerms: '0', paidAt: null, token: token(), createdAt: iso(new Date()), notes: '', items: items.map((i) => ({ ...i })), taxRate: j.items && j.items.length ? j.taxRate : q ? q.taxRate : db.company.taxRate, ...(() => { const src = j.items && j.items.length ? j : q || {}; return { discountType: src.discountType, discountValue: src.discountValue }; })() });
  db.invoices.push(inv); save(); res.status(201).json(withStatus(inv));
});

app.post('/api/invoices/:id/send', async (req, res) => {
  const inv = db.invoices.find((x) => x.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  const channels = (req.body.channels && req.body.channels.length) ? req.body.channels : ['email'];
  const link = invoiceLink(inv); const co = db.company.name;
  const results = [];
  const email = renderEmail('invoice', { client_name: findClient(inv.clientId)?.name || '', company_name: co, invoice_number: inv.number, total: money(inv.total), due_date: niceDate(inv.dueDate), link });
  for (const ch of channels) {
    results.push(await notify({ clientId: inv.clientId, channel: ch, kind: 'invoice', refId: inv.id, refNumber: inv.number,
      subject: email.subject, body: ch === 'email' ? email.body : `${co}: Invoice ${inv.number} (${money(inv.total)}) due ${inv.dueDate}. Pay online: ${link}` }));
  }
  if (inv.status === 'draft') inv.status = 'sent';
  save(); res.json({ invoice: withStatus(inv), results });
});

// ---------- payments recorded by staff (owner, admin, manager) ----------
// An invoice keeps a list of payments (part payments allowed); it becomes "paid" once they cover the balance.
// A quote deposit records one payment. Online card payments through Stripe use the method "stripe".
const PAY_METHODS = { other: 'Other', bank: 'Bank payment', cash: 'Cash', check: 'Check', card: 'Credit/debit card', cashapp: 'Cash App', paypal: 'PayPal', venmo: 'Venmo', zelle: 'Zelle' };
function readPayment(b, max) {
  const amount = round2(Number(b.amount));
  if (!(amount > 0)) return { error: 'Enter the amount received' };
  if (max !== undefined && amount > round2(max) + 0.004) return { error: `That's more than the ${money(max)} still owed` };
  if (!PAY_METHODS[b.method]) return { error: 'Choose how the payment was made' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : iso(new Date());
  if (date > iso(new Date())) return { error: 'The payment date can’t be in the future' };
  return { payment: { amount, method: b.method, date, reference: String(b.reference || '').trim().slice(0, 120) } };
}
// paid / reopened from the payments list (keeps the most recent payment's date and method on the invoice)
function settleInvoice(inv) {
  const { balanceDue } = invoiceCredits(inv, true);
  if (balanceDue <= 0.004 && (inv.payments || []).length) {
    const last = [...inv.payments].sort((a, b) => a.date.localeCompare(b.date)).pop();
    Object.assign(inv, { status: 'paid', paidAt: last.date, paymentMethod: last.method });
  } else if (inv.status === 'paid') { Object.assign(inv, { status: 'sent', paidAt: null, paymentMethod: null }); }
  else if (inv.status === 'draft' && (inv.payments || []).length) inv.status = 'sent';
}
app.post('/api/invoices/:id/payments', (req, res) => {
  const inv = db.invoices.find((x) => x.id === req.params.id); if (!inv) return res.status(404).json({ error: 'Not found' });
  const owed = invoiceCredits(inv, true).balanceDue;
  if (!(owed > 0)) return res.status(400).json({ error: 'This invoice has nothing left to pay' });
  const r = readPayment(req.body || {}, owed); if (r.error) return res.status(400).json({ error: r.error });
  const u = currentUser(req);
  inv.payments = [...(inv.payments || []), { id: uid(), ...r.payment, recordedBy: u ? u.name : '', createdAt: new Date().toISOString() }];
  settleInvoice(inv); save(); res.status(201).json(withStatus(inv));
});
app.delete('/api/invoices/:id/payments/:pid', (req, res) => {
  const inv = db.invoices.find((x) => x.id === req.params.id); if (!inv) return res.status(404).json({ error: 'Not found' });
  const before = (inv.payments || []).length; inv.payments = (inv.payments || []).filter((p) => p.id !== req.params.pid);
  if (inv.payments.length === before) return res.status(404).json({ error: 'Payment not found' });
  settleInvoice(inv); save(); res.json(withStatus(inv));
});

app.post('/api/invoices/:id/mark-paid', (req, res) => {
  const inv = db.invoices.find((x) => x.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  const method = PAY_METHODS[req.body.method] ? req.body.method : 'other'; const owed = invoiceCredits(inv, true).balanceDue; const u = currentUser(req);
  if (owed > 0) inv.payments = [...(inv.payments || []), { id: uid(), amount: owed, method, date: iso(new Date()), reference: '', recordedBy: u ? u.name : '', createdAt: new Date().toISOString() }];
  settleInvoice(inv); if (inv.status !== 'paid') Object.assign(inv, { status: 'paid', paidAt: iso(new Date()), paymentMethod: method });
  save(); res.json(withStatus(inv));
});

app.post('/api/jobs/:id/remind', async (req, res) => {
  const j = db.jobs.find((x) => x.id === req.params.id);
  if (!j) return res.status(404).json({ error: 'Not found' });
  const co = db.company.name;
  const channels = (req.body.channels && req.body.channels.length) ? req.body.channels : [tenancy.has('sms') ? 'sms' : 'email'];
  const email = renderEmail('reminder', { client_name: findClient(j.clientId)?.name || '', company_name: co, job_number: j.number, job_title: j.title, date: niceDate(j.date), time: j.startTime, address: j.address || '' });
  const results = [];
  for (const ch of channels) {
    results.push(await notify({ clientId: j.clientId, channel: ch, kind: 'job', refId: j.id, refNumber: j.number,
      subject: email.subject, body: ch === 'email' ? email.body : `${co}: reminder for "${j.title}" on ${j.date} at ${j.startTime}.` }));
  }
  res.json({ results }); save();
});

// ---------- public payment + quote pages ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function shell(title, inner) {
  const co = db.company;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="icon" href="/favicon.ico">
<style>body{font-family:system-ui,sans-serif;background:#f4f6f8;margin:0;color:#111827}.card{max-width:640px;margin:24px auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
h1{margin:0 0 4px;font-size:22px}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px 4px;border-bottom:1px solid #e5e7eb;text-align:left}.r{text-align:right}
.btn{background:${esc(co.brandColor)};color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:16px;cursor:pointer}.btn.alt{background:#fff;color:#111;border:1px solid #d1d5db}.muted{color:#6b7280;font-size:14px}.badge{display:inline-block;padding:2px 10px;border-radius:99px;background:#e5e7eb;font-size:13px}.paid{background:#dcfce7;color:#166534}
input{padding:10px;border:1px solid #d1d5db;border-radius:8px;width:100%;box-sizing:border-box;margin:4px 0 10px}</style></head><body><div class="card">
<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">${co.logo ? `<img src="${esc(co.logo)}" style="height:48px">` : ''}<div><strong>${esc(co.name)}</strong><div class="muted">${esc(co.email)} · ${esc(co.phone)}</div></div></div>${inner}</div></body></html>`;
}
// o.qty / o.unit / o.line = false hide those columns (invoice "Client view" switches); o.invoice shows the deposit credit
function itemsTable(d, o = {}) {
  const qty = o.qty !== false; const unit = o.unit !== false; const line = o.line !== false; const span = 1 + qty + unit;
  const row = (label, value) => `<tr><td colspan="${span}" class="r">${label}</td><td class="r">${value}</td></tr>`;
  return `<table><tr><th>Description</th>${qty ? '<th class="r">Qty</th>' : ''}${unit ? '<th class="r">Price</th>' : ''}<th class="r">${line ? 'Amount' : ''}</th></tr>${d.items.map((i) => `<tr><td>${esc(i.desc)}${i.details ? `<div class="muted" style="white-space:pre-line">${esc(i.details)}</div>` : ''}</td>${qty ? `<td class="r">${i.qty}</td>` : ''}${unit ? `<td class="r">${money(i.price)}</td>` : ''}<td class="r">${line ? money(i.qty * i.price) : ''}</td></tr>`).join('')}
${row('Subtotal', money(d.subtotal))}${d.discount > 0 ? row(`Discount${d.discountType === 'percent' ? ` (${d.discountValue}%)` : ''}`, '−' + money(d.discount)) : ''}${row(`${esc(Number(d.taxRate) === Number(db.company.taxRate) && db.company.taxName ? db.company.taxName : 'Tax')} (${d.taxRate}%)`, money(d.tax))}${row('<strong>Total</strong>', `<strong>${money(d.total)}</strong>`)}
${o.invoice ? (d.depositApplied > 0 ? row(`Deposit collected (quote ${esc(d.depositQuote)}, ${esc(niceDate(d.depositAppliedAt))})`, '−' + money(d.depositApplied)) + row('<strong>Balance due</strong>', `<strong>${money(d.balanceDue)}</strong>`) : '')
    : d.depositFee > 0 ? row(`Deposit${d.depositType === 'percent' ? ` (${d.depositValue}%)` : ''}`, money(d.depositFee)) + row('Balance after deposit', money(d.total - d.depositFee)) : ''}</table>`;
}

// Zelle has no API for receiving payments: show the business's Zelle details, let the client report they sent it,
// and the business confirms it (Mark paid / Mark deposit paid) once it shows up in their bank.
function zelleBox(amount, memo, action, sentAt) {
  const z = db.company.zelleRecipient; if (!z || !tenancy.has('zelle')) return '';
  return `<div style="background:#f5f3ff;padding:16px;border-radius:8px;margin-top:16px;border:1px solid #c4b5fd">
<h3 style="margin-top:0">Pay with Zelle</h3>
<p style="margin:0 0 6px">Send <strong>${money(amount)}</strong> with Zelle to:</p>
<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><strong style="font-size:18px">${esc(z)}</strong><button type="button" class="btn alt" style="padding:6px 12px;font-size:14px" data-v="${esc(z)}" onclick="navigator.clipboard.writeText(this.dataset.v);this.textContent='Copied'">Copy</button></div>
${db.company.zelleName ? `<div class="muted">Registered to ${esc(db.company.zelleName)}. Check this name before you send.</div>` : ''}
<p class="muted">Use your bank's app or the Zelle app, and put <strong>${esc(memo)}</strong> in the memo.</p>
${sentAt ? `<p style="margin-bottom:0">✓ You told us you sent this payment on ${esc(niceDate(sentAt))}. We'll confirm it once it arrives.</p>`
    : `<form method="post" action="${esc(action)}"><button class="btn alt">I've sent the payment by Zelle</button></form>`}
</div>`;
}
// ---------- Stripe (online card payments) ----------
// Each business takes card payments into its own Stripe account, connected with "Connect with Stripe" in App Settings (Stripe Connect):
// the platform's key (BILLING_STRIPE_SECRET_KEY or STRIPE_SECRET_KEY) acts on the business's account, so the money goes straight to it.
// Older setups that pasted their own secret key keep working, and the default account can still use STRIPE_SECRET_KEY on its own.
// Payments are confirmed when the client returns to the success URL, and by a webhook, which also catches clients who close the tab:
// STRIPE_CONNECT_WEBHOOK_SECRET for connected accounts (lib/platform.js), or the account's own STRIPE_WEBHOOK_SECRET / saved secret.
const secrets = () => db.secrets || {};
const connectedAccount = () => { const s = secrets(); return s.stripeAccountId && s.stripeChargesEnabled && stripeLib.platformKey() ? s.stripeAccountId : ''; };
const stripeKey = () => (!tenancy.has('onlinePayments') ? '' : connectedAccount() ? stripeLib.platformKey() : secrets().stripeSecretKey || (tenancy.isDefault() ? process.env.STRIPE_SECRET_KEY : '') || '');
const stripeWebhookSecret = () => secrets().stripeWebhookSecret || (tenancy.isDefault() ? process.env.STRIPE_WEBHOOK_SECRET : '') || '';
const stripeMode = () => stripeLib.modeOf(stripeKey());
const stripeApi = (method, endpoint, params) => stripeLib.request(stripeKey(), method, endpoint, params, connectedAccount());
// ---------- payment settings (Payments → Settings) ----------
const PAY_DEFAULTS = { quoteCard: true, quoteAch: false, invoiceCard: true, invoiceAch: false, notifyEmail: true, emailReceipts: true, disabled: false };
const paySettings = () => ({ ...PAY_DEFAULTS, ...(db.company.paySettings || {}) });
// the online methods a client can use for an invoice or a quote deposit ([] = none); bank (ACH) needs a live Stripe connection
function onlineMethods(kind, doc) {
  const s = paySettings(); if (s.disabled || !tenancy.has('onlinePayments') || doc.allowCard === 'off') return [];
  return [s[kind + 'Card'] && 'card', s[kind + 'Ach'] && stripeKey() && 'us_bank_account'].filter(Boolean);
}
const payButtonLabel = (methods, amount, what = '') => (methods.length > 1 ? `Pay ${what}${money(amount)} online` : methods[0] === 'us_bank_account' ? `Pay ${what}${money(amount)} from your bank` : `Pay ${what}${money(amount)} with card`);
// a Checkout page for one amount; meta = { invoiceId } or { quoteId }; methods = Stripe payment method types
async function stripeCheckout({ amount, name, client, meta, successUrl, cancelUrl, methods = ['card'] }) {
  const p = {
    mode: 'payment', 'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)), 'line_items[0][price_data][product_data][name]': name,
    success_url: successUrl + (successUrl.includes('?') ? '&' : '?') + 'session_id={CHECKOUT_SESSION_ID}', cancel_url: cancelUrl,
    'payment_intent_data[description]': `${db.company.name}: ${name}`,
  };
  for (const [k, v] of Object.entries(meta)) { p[`metadata[${k}]`] = v; p[`payment_intent_data[metadata][${k}]`] = v; }
  const fee = Number(tenancy.platform().settings.platformFeePercent) || 0; // your cut of each card payment, through Stripe Connect only
  if (connectedAccount() && fee > 0) p['payment_intent_data[application_fee_amount]'] = String(Math.round(amount * fee)); // amount is dollars, fee is %
  if (client && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email || '')) p.customer_email = client.email; // Stripe emails the receipt
  methods.forEach((m, i) => { p[`payment_method_types[${i}]`] = m; });
  try { return await stripeApi('POST', 'checkout/sessions', p); } catch (e) {
    if (methods.length < 2 || !/payment method type|us_bank_account/i.test(e.message)) throw e;
    for (const k of Object.keys(p)) if (k.startsWith('payment_method_types')) delete p[k]; // bank payments not switched on in their Stripe account: card only
    p['payment_method_types[0]'] = 'card'; return stripeApi('POST', 'checkout/sessions', p);
  }
}
// record a paid Checkout session on its invoice or quote (safe to call more than once for the same session)
function applyStripeSession(s) {
  if (!s || s.payment_status !== 'paid') return null;
  const amount = round2((Number(s.amount_total) || 0) / 100); const meta = s.metadata || {};
  const tell = (what, clientId) => {
    const c = findClient(clientId); const set = paySettings();
    if (set.emailReceipts && c && c.email) { // receipt to the client, from the business
      const rb = `Hi ${c.name},\n\nThank you for your payment of ${money(amount)} for ${what}.\n\nPaid on ${niceDate(iso(new Date()))}\nPayment reference: ${s.payment_intent || s.id}\n\n${db.company.name}`;
      notify({ clientId, channel: 'email', kind: 'receipt', refId: meta.invoiceId || meta.quoteId, refNumber: '', subject: `Receipt from ${db.company.name}`, body: rb }).then(() => save()).catch(() => {});
    }
    if (!set.notifyEmail || !db.company.email) return;
    const how = (s.payment_method_types || []).includes('us_bank_account') && !(s.payment_method_types || []).includes('card') ? 'from their bank account' : 'online';
    sendTemplate('paymentReceived', db.company.email, { client: c ? c.name : 'A client', amount: money(amount), what, how, reference: s.payment_intent || s.id, business: db.company.name, account_url: baseUrl() }).then((sent) => {
      db.notifications.unshift({ id: uid(), at: new Date().toISOString(), clientId, clientName: c ? c.name : '', channel: 'email', kind: 'payment', refId: meta.invoiceId || meta.quoteId, refNumber: '', to: db.company.email, subject: sent.subject, body: sent.text, status: sent.status, detail: sent.detail }); save();
    }).catch(() => {});
  };
  if (meta.invoiceId) {
    const inv = db.invoices.find((x) => x.id === meta.invoiceId);
    if (!inv || inv.stripeSessionId === s.id) return inv;
    inv.payments = [...(inv.payments || []), { id: uid(), amount, method: 'stripe', date: iso(new Date()), reference: s.payment_intent || s.id, recordedBy: 'Stripe', createdAt: new Date().toISOString() }];
    Object.assign(inv, { paidAmount: amount, stripeSessionId: s.id, stripePaymentIntent: s.payment_intent || null }); settleInvoice(inv);
    save(); tell(`invoice ${inv.number}`, inv.clientId); return inv;
  }
  if (meta.quoteId) {
    const q = db.quotes.find((x) => x.id === meta.quoteId);
    if (!q || q.stripeSessionId === s.id) return q;
    Object.assign(q, { depositPaidAt: iso(new Date()), depositStatus: 'paid', depositPaidAmount: amount, depositMethod: 'stripe', depositReference: s.payment_intent || s.id, stripeSessionId: s.id, stripePaymentIntent: s.payment_intent || null });
    save(); tell(`the deposit on quote ${q.number}`, q.clientId); return q;
  }
  return null;
}
async function confirmStripeReturn(sessionId) {
  if (!stripeKey() || !/^cs_[A-Za-z0-9_]+$/.test(sessionId || '')) return;
  try { applyStripeSession(await stripeApi('GET', 'checkout/sessions/' + encodeURIComponent(sessionId))); } catch (e) { console.error('Stripe confirm failed:', e.message); }
}
// webhook for an account's own Stripe keys (connected accounts use the platform's Connect webhook instead)
app.post('/api/stripe/webhook', (req, res) => {
  const secret = stripeWebhookSecret();
  if (!secret) return res.status(503).json({ error: 'Webhook not configured' });
  if (!stripeLib.signatureOk(req._raw || '', req.headers['stripe-signature'], secret)) return res.status(400).json({ error: 'Invalid signature' });
  const ev = req.body || {};
  if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') applyStripeSession(ev.data && ev.data.object);
  res.json({ received: true });
});
// ---------- Payments page ----------
// settings (owner/admin only: not in ROLE_API)
app.put('/api/payments/settings', (req, res) => {
  const b = req.body || {}; const s = paySettings();
  for (const k of Object.keys(PAY_DEFAULTS)) if (k in b) s[k] = b[k] === true;
  db.company.paySettings = s; save(); res.json(s);
});
// what Stripe knows: balance, payouts, disputes, and each charge's status and payout date (keyed by payment intent, the reference on recorded payments)
app.get('/api/payments/stripe', async (req, res) => {
  if (!tenancy.has('onlinePayments') || !stripeKey()) return res.json({ connected: false });
  const get = (ep) => stripeApi('GET', ep).catch((e) => { console.error('Stripe:', e.message); return null; });
  const [bal, charges, payouts, disputes] = await Promise.all([get('balance'), get('charges?limit=100&expand[]=data.balance_transaction'), get('payouts?limit=50&expand[]=data.destination'), get('disputes?limit=100')]);
  const day = (t) => (t ? iso(new Date(t * 1000)) : null); const usd = (l) => round2((l || []).filter((x) => x.currency === 'usd').reduce((s, x) => s + x.amount, 0) / 100);
  const acct = (d) => (d && typeof d === 'object' ? { name: d.bank_name || d.brand || 'Bank account', last4: d.last4 || '' } : null);
  const charge = {};
  for (const c of (charges && charges.data) || []) if (c.payment_intent) {
    charge[c.payment_intent] = { payoutDate: day(c.balance_transaction && c.balance_transaction.available_on),
      status: c.disputed ? 'disputed' : c.refunded ? 'refunded' : c.amount_refunded ? 'partly refunded' : c.status === 'failed' ? 'failed' : c.status === 'pending' ? 'processing' : 'succeeded' };
  }
  const pl = (payouts && payouts.data) || []; const dl = (disputes && disputes.data) || [];
  res.json({ connected: true, mode: stripeMode(), feePercent: connectedAccount() ? Number(tenancy.platform().settings.platformFeePercent) || 0 : 0, balance: bal ? { available: usd(bal.available), pending: usd(bal.pending) } : null, charges: charge,
    payouts: pl.map((p) => ({ id: p.id, amount: round2(p.amount / 100), arrival: day(p.arrival_date), status: p.status, bank: acct(p.destination) })),
    bank: (pl.map((p) => acct(p.destination)).find(Boolean)) || null,
    disputes: { open: dl.filter((d) => /needs_response|under_review/.test(d.status)).length, total: dl.length } });
});
function tellBusinessZelle(what, amount, clientName) {
  if (!db.company.email) return;
  sendTemplate('zelleReported', db.company.email, { client: clientName || 'A client', amount: money(amount), what, business: db.company.name, account_url: baseUrl() }).catch(() => {});
}

app.get('/pay/:token', (req, res) => {
  const inv = db.invoices.find((x) => x.token === req.params.token);
  if (!inv) return res.status(404).send(shell('Not found', '<h1>Invoice not found</h1>'));
  const c = findClient(inv.clientId); const x = withStatus(inv); const st = x.displayStatus; const due = x.balanceDue;
  const live = !!stripeKey(); const on = (k) => inv[k] !== 'off'; const methods = onlineMethods('invoice', inv);
  const account = db.invoices.filter((i) => i.clientId === inv.clientId && i.status !== 'paid' && i.status !== 'draft').reduce((s, i) => s + withStatus(i).balanceDue, 0);
  const card = !methods.length ? '' : live
    ? `<form method="post" action="/pay/${esc(inv.token)}/checkout"><button class="btn">${payButtonLabel(methods, due)}</button></form>${methods.length > 1 ? '<p class="muted">Card or bank account (ACH)</p>' : ''}`
    : !methods.includes('card') ? '' : `<p class="muted">Demo mode: card payments aren’t connected yet, so this simulates a card payment and nobody is charged.</p>
<form method="post" action="/pay/${esc(inv.token)}/demo"><label>Name on card<input name="name" required value="${esc(c?.name)}"></label><label>Card number<input name="card" required placeholder="4242 4242 4242 4242"></label><button class="btn">Pay ${money(due)}</button></form>`;
  const zelle = on('allowZelle') ? zelleBox(due, `Invoice ${inv.number}`, `/pay/${inv.token}/zelle-sent`, inv.zelleSentAt) : '';
  res.send(shell(`Invoice ${inv.number}`, `<h1>Invoice ${esc(inv.number)} <span class="badge ${st === 'paid' ? 'paid' : ''}">${esc(st === 'overdue' ? 'past due' : st)}</span></h1>
${st === 'overdue' && on('showLateStamp') ? '<div style="display:inline-block;margin:8px 0;padding:4px 14px;border:2px solid #dc2626;color:#dc2626;border-radius:6px;font-weight:800;letter-spacing:.08em;transform:rotate(-2deg)">PAST DUE</div>' : ''}
${db.company.taxIdNumber ? `<div class="muted">${esc(db.company.taxIdName || 'Tax ID')}: ${esc(db.company.taxIdNumber)}</div>` : ''}<div class="muted">Billed to ${esc(c?.name)}${inv.subject ? ` · ${esc(inv.subject)}` : ''} · Issued ${esc(niceDate(inv.issueDate))} · Due ${inv.dueDate && inv.dueDate <= inv.issueDate ? 'upon receipt' : esc(niceDate(inv.dueDate))}</div>
${itemsTable(x, { qty: on('showQty'), unit: on('showUnit'), line: on('showLineTotals'), invoice: true })}
${on('showAccountBalance') && st !== 'paid' && account > 0 ? `<p class="muted" style="text-align:right">Account balance (all open invoices): <strong>${money(account)}</strong></p>` : ''}
${inv.notes ? `<p style="white-space:pre-wrap">${esc(inv.notes)}</p>` : ''}
${st === 'paid' ? `<p>Paid on ${esc(niceDate(inv.paidAt))}. Thank you!</p>` : card + zelle + (!card && !zelle ? `<p class="muted">Please contact ${esc(db.company.name)} at ${esc(db.company.phone || db.company.email)} to arrange payment.</p>` : '')}
${inv.disclaimer ? `<div style="margin:16px 0;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;white-space:pre-wrap" class="muted">${esc(inv.disclaimer)}</div>` : `<p class="muted">${esc(db.company.invoiceFooter)}</p>`}`));
});
app.use('/pay', express.urlencoded({ extended: false }));
app.post('/pay/:token/zelle-sent', (req, res) => {
  const inv = db.invoices.find((x) => x.token === req.params.token);
  if (!inv) return res.status(404).send('Not found');
  if (inv.status !== 'paid' && !inv.zelleSentAt) { inv.zelleSentAt = iso(new Date()); save(); tellBusinessZelle(`invoice ${inv.number}`, withStatus(inv).balanceDue, findClient(inv.clientId)?.name); }
  res.redirect(`/pay/${inv.token}`);
});
app.post('/pay/:token/demo', (req, res) => {
  const inv = db.invoices.find((x) => x.token === req.params.token);
  if (!inv) return res.status(404).send('Not found');
  if (stripeKey()) return res.status(400).send('Demo payments are disabled when Stripe is configured');
  if (!onlineMethods('invoice', inv).includes('card')) return res.status(400).send('Card payment is not available for this invoice');
  inv.status = 'paid'; inv.paidAt = iso(new Date()); inv.paymentMethod = 'demo-card'; save(); res.redirect(`/pay/${inv.token}`);
});
app.post('/pay/:token/checkout', async (req, res) => {
  const inv = db.invoices.find((x) => x.token === req.params.token);
  if (!inv || !stripeKey() || !onlineMethods('invoice', inv).length) return res.status(400).send('Payments unavailable');
  const due = withStatus(inv).balanceDue;
  if (inv.status === 'paid' || !(due > 0)) return res.redirect(`/pay/${inv.token}`);
  try {
    const s = await stripeCheckout({ amount: due, name: `Invoice ${inv.number}`, client: findClient(inv.clientId), meta: { invoiceId: inv.id }, successUrl: `${baseUrl()}/pay/${inv.token}/success`, cancelUrl: `${baseUrl()}/pay/${inv.token}`, methods: onlineMethods('invoice', inv) });
    res.redirect(303, s.url);
  } catch (e) { res.status(502).send(shell('Payment error', `<h1>Payment error</h1><p>${esc(e.message)}</p><p><a href="/pay/${esc(inv.token)}">Back to the invoice</a></p>`)); }
});
app.get('/pay/:token/success', async (req, res) => {
  const inv = db.invoices.find((x) => x.token === req.params.token);
  if (!inv) return res.status(404).send('Not found');
  await confirmStripeReturn(req.query.session_id);
  res.redirect(`/pay/${inv.token}`);
});

app.get('/p/quote/:token', (req, res) => {
  const q = db.quotes.find((x) => x.token === req.params.token);
  if (!q) return res.status(404).send(shell('Not found', '<h1>Quote not found</h1>'));
  const c = findClient(q.clientId);
  let depositSection = '';
  if (q.status === 'approved' && q.depositFee > 0) {
    if (!q.signedAt) {
      depositSection = `<div style="background:#f0fdf4;padding:16px;border-radius:8px;margin-top:16px;border:1px solid #86efac">
<h3 style="margin-top:0">Next step: Review and sign</h3>
<p>To proceed with this quote, please review the terms and provide your electronic signature below.</p>
<form method="post" action="/p/quote/${esc(q.token)}/sign" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
<input type="text" name="fullName" placeholder="Full name (signature)" required style="flex:1;min-width:200px">
<button class="btn">Sign agreement</button>
</form>
</div>`;
    } else if (!q.depositPaidAt) {
      depositSection = `<div style="background:#fef3c7;padding:16px;border-radius:8px;margin-top:16px;border:1px solid #fcd34d">
<h3 style="margin-top:0">Deposit required: ${money(q.depositFee)}</h3>
<p>Your quote has been signed. A deposit of ${money(q.depositFee)} is required to proceed with the work.</p>
${onlineMethods('quote', q).length && (stripeKey() || onlineMethods('quote', q).includes('card')) ? `<form method="post" action="/p/quote/${esc(q.token)}/pay-deposit" style="display:flex;gap:8px">
<button class="btn">${payButtonLabel(onlineMethods('quote', q), q.depositFee, 'deposit of ')}</button>
</form>` : ''}
${q.allowZelle !== 'off' ? zelleBox(q.depositFee, `Deposit for quote ${q.number}`, `/p/quote/${q.token}/zelle-sent`, q.zelleSentAt) : ''}
${!onlineMethods('quote', q).length && (q.allowZelle === 'off' || !db.company.zelleRecipient || !tenancy.has('zelle')) ? `<p class="muted">Please contact ${esc(db.company.name)} at ${esc(db.company.phone || db.company.email)} to arrange your deposit payment.</p>` : ''}
</div>`;
    } else {
      depositSection = `<div style="background:#f0fdf4;padding:16px;border-radius:8px;margin-top:16px;border:1px solid #86efac">
<h3 style="margin-top:0">✓ Deposit paid</h3>
<p>Thank you! Your deposit of ${money(q.depositPaidAmount ?? q.depositFee)} has been received. We will begin work shortly.</p>
</div>`;
    }
  }
  res.send(shell(`Quote ${q.number}`, `<h1>Quote ${esc(q.number)} <span class="badge">${esc(q.status)}</span></h1><div class="muted">Prepared for ${esc(c?.name)} · ${esc(q.title)}</div>${itemsTable(q)}${q.notes ? `<p style="white-space:pre-wrap">${esc(q.notes)}</p>` : ''}
${q.disclaimer ? `<div style="margin:16px 0;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px"><strong>Contract / Disclaimer</strong><p class="muted" style="margin:6px 0 0;white-space:pre-wrap">${esc(q.disclaimer)}</p></div>` : ''}
${(q.status === 'sent' || q.status === 'draft') && q.depositFee > 0 ? `<div style="background:#eff6ff;padding:14px 16px;border-radius:8px;margin-bottom:16px;border:1px solid #bfdbfe"><strong>Deposit required: ${money(q.depositFee)}</strong>${q.depositType === 'percent' ? ` (${q.depositValue}% of the total)` : ''}<div class="muted" style="margin-top:4px">After you approve, you'll sign the quote and pay this deposit online before work begins.</div></div>` : ''}
${q.status === 'sent' || q.status === 'draft' ? `<form method="post" action="/p/quote/${esc(q.token)}/respond" style="display:flex;gap:8px"><button class="btn" name="r" value="approved">Approve quote</button><button class="btn alt" name="r" value="declined">Decline</button></form>` : ''}${depositSection}`));
});
app.use('/p', express.urlencoded({ extended: false }));
app.post('/p/quote/:token/respond', (req, res) => {
  const q = db.quotes.find((x) => x.token === req.params.token);
  if (!q) return res.status(404).send('Not found');
  if (['sent', 'draft'].includes(q.status)) { q.status = req.body.r === 'declined' ? 'declined' : 'approved'; q.respondedAt = iso(new Date()); save(); }
  res.redirect(`/p/quote/${q.token}`);
});
app.post('/p/quote/:token/sign', (req, res) => {
  const q = db.quotes.find((x) => x.token === req.params.token);
  if (!q || q.status !== 'approved') return res.status(400).send('Quote not available for signing');
  q.signedAt = iso(new Date()); q.signedName = String(req.body.fullName || '');
  if (!q.depositStatus) q.depositStatus = 'pending';
  save();
  res.redirect(`/p/quote/${q.token}`);
});
app.post('/p/quote/:token/zelle-sent', (req, res) => {
  const q = db.quotes.find((x) => x.token === req.params.token);
  if (!q) return res.status(404).send('Not found');
  if (q.depositFee > 0 && !q.depositPaidAt && !q.zelleSentAt) { q.zelleSentAt = iso(new Date()); save(); tellBusinessZelle(`the deposit on quote ${q.number}`, q.depositFee, findClient(q.clientId)?.name); }
  res.redirect(`/p/quote/${q.token}`);
});
app.post('/api/quotes/:id/mark-deposit-paid', (req, res) => {
  const q = db.quotes.find((x) => x.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const b = { amount: q.depositFee, method: 'other', ...(req.body || {}) }; if (b.method === 'manual') b.method = 'other';
  const r = readPayment(b, q.total); if (r.error) return res.status(400).json({ error: r.error });
  Object.assign(q, { depositPaidAt: r.payment.date, depositStatus: 'paid', depositMethod: r.payment.method, depositPaidAmount: r.payment.amount, depositReference: r.payment.reference });
  save(); res.json(q);
});
app.post('/p/quote/:token/pay-deposit', (req, res) => {
  const q = db.quotes.find((x) => x.token === req.params.token);
  if (!q || !q.depositFee) return res.status(400).send('No deposit required');
  const methods = onlineMethods('quote', q); if (!methods.length || (!stripeKey() && !methods.includes('card'))) return res.status(400).send('Online payment is not available for this quote');
  if (q.depositPaidAt) return res.redirect(`/p/quote/${q.token}`);
  if (stripeKey()) {
    stripeCheckout({ amount: q.depositFee, name: `Deposit for Quote ${q.number}`, client: findClient(q.clientId), meta: { quoteId: q.id }, successUrl: `${baseUrl()}/p/quote/${q.token}/deposit-success`, cancelUrl: `${baseUrl()}/p/quote/${q.token}`, methods })
      .then((s) => res.redirect(303, s.url))
      .catch((e) => res.status(502).send(shell('Payment error', `<h1>Payment error</h1><p>${esc(e.message)}</p><p><a href="/p/quote/${esc(q.token)}">Back to the quote</a></p>`)));
  } else {
    q.depositPaidAt = iso(new Date()); q.depositStatus = 'paid'; q.depositPaidAmount = q.depositFee; q.depositMethod = 'demo';
    save();
    res.redirect(`/p/quote/${q.token}`);
  }
});
app.get('/p/quote/:token/deposit-success', async (req, res) => {
  const q = db.quotes.find((x) => x.token === req.params.token);
  if (!q) return res.status(404).send('Not found');
  await confirmStripeReturn(req.query.session_id);
  res.redirect(`/p/quote/${q.token}`);
});

// ---------- set deposit fee ----------
app.post('/api/quotes/:id/set-deposit', (req, res) => {
  const q = db.quotes.find((x) => x.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  if (q.status !== 'approved') return res.status(400).json({ error: 'Quote must be approved first' });
  q.depositType = 'flat'; q.depositValue = Number(req.body.depositFee) || 0; computeTotals(q);
  if (!q.depositStatus) q.depositStatus = q.depositFee > 0 ? 'pending' : null;
  save();
  res.json(q);
});

// ---------- client portal data ----------
// strip what clients must not see: internal notes and the business's cost/markup per line
function forClient(doc) {
  const { internalNotes, ...rest } = doc;
  return { ...rest, items: (doc.items || []).map(({ cost, markup, markupType, ...it }) => it) };
}
// a client's visits: schedule details only (no internal notes, prices or line items)
const PORTAL_JOB_FIELDS = ['id', 'number', 'title', 'description', 'date', 'startTime', 'endTime', 'address', 'status'];
const jobForClient = (j) => Object.fromEntries(PORTAL_JOB_FIELDS.map((k) => [k, j[k]]));
const REQ_FIELDS = ['id', 'title', 'details', 'address', 'preferredDate', 'preferredTime', 'status', 'createdAt'];
const requestForClient = (r) => Object.fromEntries(REQ_FIELDS.map((k) => [k, r[k]]));
app.get('/api/portal/:token', (req, res) => {
  const c = db.clients.find((x) => x.portalToken === req.params.token);
  if (!c) return res.status(404).json({ error: 'Invalid portal link' });
  res.json({
    company: { name: db.company.name, logo: db.company.logo, email: db.company.email, phone: db.company.phone, brandColor: db.company.brandColor, address: db.company.addressPrivate ? '' : db.company.address, website: db.company.website, hours: db.company.showHours ? db.company.hours || null : null },
    client: { id: c.id, name: c.name, email: c.email, phone: c.phone, address: c.address },
    referralLink: tenancy.has('referrals') ? referralLink(c) : null,
    requests: (db.requests || []).filter((r) => r.clientId === c.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(requestForClient),
    jobs: db.jobs.filter((j) => j.clientId === c.id).sort((a, b) => b.date.localeCompare(a.date)).map(jobForClient),
    quotes: db.quotes.filter((q) => q.clientId === c.id).map((q) => ({ ...forClient(q), link: quoteLink(q) })),
    invoices: db.invoices.filter((i) => i.clientId === c.id).map((i) => ({ ...forClient(withStatus(i)), link: invoiceLink(i) })),
  });
});

// ---------- referrals ----------
// Each client gets a public referral link (/refer/<code>) to share. It is separate from their private portal link.
// A friend who opens it can send a work request: they're added as a new client (a lead) marked "referred by", and the business is emailed.
const referralCode = (c) => { if (!c.referralCode) { c.referralCode = crypto.randomBytes(5).toString('hex'); save(); } return c.referralCode; };
const referralLink = (c) => `${baseUrl()}/refer/${referralCode(c)}`;
const referHits = new Map(); // ip -> [timestamps]: at most 5 referral requests per hour per address
app.use('/refer', express.urlencoded({ extended: false }));
app.use('/refer', (req, res, next) => (tenancy.has('referrals') ? next() : res.status(404).send(shell('Link not found', '<h1>Link not found</h1><p class="muted">This referral link is no longer valid.</p>'))));
function referPage(c, { error, values = {} } = {}) {
  const v = (k) => esc(values[k] || '');
  const first = String(c.name || '').trim().split(/\s+/)[0];
  return shell(`${db.company.name}: request service`, `<h1>Get work done with ${esc(db.company.name)}</h1>
<p class="muted">${first ? `${esc(first)} recommended us. ` : ''}Tell us what you need and we'll get back to you${db.company.phone ? `, or call <a href="tel:${esc(db.company.phone)}">${esc(db.company.phone)}</a>` : ''}.</p>
${error ? `<p style="color:#b91c1c;font-weight:600">${esc(error)}</p>` : ''}
<form method="post" style="margin-top:16px">
<label>Your name*<input name="name" required maxlength="100" value="${v('name')}" autocomplete="name"></label>
<label>Email<input name="email" type="email" maxlength="120" value="${v('email')}" autocomplete="email"></label>
<label>Phone<input name="phone" maxlength="40" value="${v('phone')}" autocomplete="tel"></label>
<label>Service address<input name="address" maxlength="300" value="${v('address')}" autocomplete="street-address"></label>
<label>What do you need done?*<input name="title" required maxlength="120" value="${v('title')}"></label>
<label>Details<textarea name="details" rows="4" maxlength="4000" style="padding:10px;border:1px solid #d1d5db;border-radius:8px;width:100%;box-sizing:border-box;margin:4px 0 10px;font:inherit">${v('details')}</textarea></label>
<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<button class="btn">Send request</button></form>`);
}
app.get('/refer/:code', (req, res) => {
  const c = db.clients.find((x) => x.referralCode && x.referralCode === req.params.code);
  if (!c) return res.status(404).send(shell('Link not found', '<h1>Link not found</h1><p class="muted">This referral link is no longer valid.</p>'));
  res.send(referPage(c));
});
app.post('/refer/:code', async (req, res) => {
  const c = db.clients.find((x) => x.referralCode && x.referralCode === req.params.code);
  if (!c) return res.status(404).send(shell('Link not found', '<h1>Link not found</h1>'));
  const b = req.body || {}; const clip = (k, n) => String(b[k] || '').trim().slice(0, n);
  const done = shell('Request sent', `<h1>Thanks${clip('name', 100) ? ', ' + esc(clip('name', 100).split(/\s+/)[0]) : ''}!</h1><p class="muted">We got your request and will be in touch soon.</p>`);
  if (b.website) return res.send(done); // honeypot: bots fill every field
  const ip = req.socket.remoteAddress; const now = Date.now(); const hits = (referHits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (hits.length >= 5) return res.status(429).send(referPage(c, { error: 'Too many requests from this connection. Please call or email us instead.', values: b }));
  const name = clip('name', 100); const title = clip('title', 120); const email = clip('email', 120).toLowerCase(); const phone = clip('phone', 40);
  if (!name || !title) return res.status(400).send(referPage(c, { error: 'Please enter your name and what you need done.', values: b }));
  if (!email && !phone) return res.status(400).send(referPage(c, { error: 'Please give us an email or phone number so we can reach you.', values: b }));
  hits.push(now); referHits.set(ip, hits);
  const created = iso(new Date());
  const lead = { id: uid(), name, email, phone, address: clip('address', 300), company: '', tags: ['Referral'], notes: `Referred by ${c.name}`, referredBy: c.id, portalToken: token(), createdAt: created };
  db.clients.push(lead);
  db.requests = db.requests || [];
  const r = { id: uid(), clientId: lead.id, title, details: clip('details', 4000), address: lead.address, preferredDate: '', preferredTime: 'any', status: 'new', referredBy: c.id, createdAt: new Date().toISOString() };
  db.requests.push(r);
  const details = emails.details([['Name', name], ['Phone', phone], ['Email', email], ['Address', r.address || 'not given'], ['Referred by', c.name]]);
  const sent = await sendTemplate('referral', db.company.email, { name, referrer: c.name, title, details, request: r.details, business: db.company.name, account_url: baseUrl() });
  db.notifications.unshift({ id: uid(), at: r.createdAt, clientId: lead.id, clientName: name, channel: 'email', kind: 'referral', refId: r.id, refNumber: '', to: db.company.email || '', subject: `Referral: ${title}`, body: sent.text, status: sent.status, detail: sent.detail });
  save(); res.send(done);
});

// a client asks for work from their portal: saved as a request and emailed to the business
app.post('/api/portal/:token/requests', async (req, res) => {
  const c = db.clients.find((x) => x.portalToken === req.params.token);
  if (!c) return res.status(404).json({ error: 'Invalid portal link' });
  db.requests = db.requests || [];
  const b = req.body || {}; const clip = (v, n) => String(v || '').trim().slice(0, n);
  const title = clip(b.title, 120); if (!title) return res.status(400).json({ error: 'Tell us what you need done' });
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  if (db.requests.filter((r) => r.clientId === c.id && r.createdAt > dayAgo).length >= 10) return res.status(429).json({ error: 'You’ve sent several requests today. Please call or email us instead.' });
  const preferredDate = /^\d{4}-\d{2}-\d{2}$/.test(b.preferredDate || '') ? b.preferredDate : '';
  const preferredTime = ['morning', 'afternoon', 'evening'].includes(b.preferredTime) ? b.preferredTime : 'any';
  const r = { id: uid(), clientId: c.id, title, details: clip(b.details, 4000), address: clip(b.address, 300) || c.address || '', preferredDate, preferredTime, status: 'new', createdAt: new Date().toISOString() };
  db.requests.push(r);
  const details = emails.details([['Client', c.name], ['Phone', c.phone], ['Email', c.email], ['Address', r.address || 'not given'], ['Preferred', `${preferredDate || 'any day'}, ${preferredTime === 'any' ? 'any time' : preferredTime}`]]);
  const sent = await sendTemplate('workRequest', db.company.email, { client: c.name, title, details, request: r.details, business: db.company.name, account_url: baseUrl() });
  db.notifications.unshift({ id: uid(), at: r.createdAt, clientId: c.id, clientName: c.name, channel: 'email', kind: 'request', refId: r.id, refNumber: '', to: db.company.email || '', subject: `New request: ${title}`, body: sent.text, status: sent.status, detail: sent.detail });
  save(); res.status(201).json(requestForClient(r));
});

// ---------- reports ----------
const monthKey = (d) => String(d).slice(0, 7);
function lastMonths(n) {
  const out = []; const now = new Date();
  for (let i = n - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
  return out;
}
app.get('/api/reports', (req, res) => {
  const months = lastMonths(12);
  const paid = db.invoices.filter((i) => i.status === 'paid');
  const pending = db.invoices.filter((i) => i.status !== 'paid' && i.status !== 'draft');
  const revenueByMonth = months.map((m) => ({ month: m, revenue: round2(paid.filter((i) => monthKey(i.paidAt) === m).reduce((s, i) => s + i.total, 0)) }));
  const svc = {};
  db.invoices.filter((i) => i.status !== 'draft').forEach((i) => i.items.forEach((it) => { const s = svc[it.desc] || (svc[it.desc] = { name: it.desc, count: 0, revenue: 0 }); s.count += it.qty; s.revenue += it.qty * it.price; }));
  const popularServices = Object.values(svc).map((s) => ({ ...s, revenue: round2(s.revenue) })).sort((a, b) => b.count - a.count || b.revenue - a.revenue);
  const thisMonth = months[months.length - 1];
  const totalExpenses = round2(db.expenses.reduce((s, e) => s + e.amount, 0));
  res.json({
    revenueByMonth, popularServices,
    thisMonthRevenue: revenueByMonth[revenueByMonth.length - 1].revenue,
    paidTotal: round2(paid.reduce((s, i) => s + i.total, 0)), paidCount: paid.length,
    pendingTotal: round2(pending.reduce((s, i) => s + i.total, 0)), pendingCount: pending.length,
    overdueTotal: round2(pending.filter((i) => invoiceStatus(i) === 'overdue').reduce((s, i) => s + i.total, 0)),
    totalExpenses, thisMonth,
  });
});

app.get('/api/tax-summary', (req, res) => {
  const year = String(req.query.year || new Date().getFullYear());
  const paid = db.invoices.filter((i) => i.status === 'paid' && String(i.paidAt).startsWith(year));
  const byMonth = Array.from({ length: 12 }, (_, k) => { const m = `${year}-${String(k + 1).padStart(2, '0')}`; const list = paid.filter((i) => monthKey(i.paidAt) === m); return { month: m, invoices: list.length, taxable: round2(list.reduce((s, i) => s + i.subtotal - (i.discount || 0), 0)), tax: round2(list.reduce((s, i) => s + i.tax, 0)), total: round2(list.reduce((s, i) => s + i.total, 0)) }; });
  const years = [...new Set(db.invoices.filter((i) => i.status === 'paid').map((i) => String(i.paidAt).slice(0, 4)).concat([String(new Date().getFullYear())]))].sort();
  res.json({ year, years, byMonth, totalTax: round2(paid.reduce((s, i) => s + i.tax, 0)), totalTaxable: round2(paid.reduce((s, i) => s + i.subtotal - (i.discount || 0), 0)), invoices: paid.map((i) => ({ number: i.number, client: findClient(i.clientId)?.name, paidAt: i.paidAt, subtotal: i.subtotal, taxRate: i.taxRate, tax: i.tax, total: i.total })) });
});

app.get('/api/overview', (req, res) => {
  const months = lastMonths(6);
  const paid = db.invoices.filter((i) => i.status === 'paid');
  const revenue = months.map((m) => round2(paid.filter((i) => monthKey(i.paidAt) === m).reduce((s, i) => s + i.total, 0)));
  const growth = revenue.map((r, i) => (i === 0 ? null : revenue[i - 1] > 0 ? round2(((r - revenue[i - 1]) / revenue[i - 1]) * 100) : null));
  const newClients = months.map((m) => db.clients.filter((c) => monthKey(c.createdAt) === m).length);
  const productivity = db.staff.map((s) => ({ id: s.id, name: s.name, color: s.color, completedByMonth: months.map((m) => db.jobs.filter((j) => j.status === 'completed' && j.staffIds.includes(s.id) && monthKey(j.date) === m).length), upcoming: db.jobs.filter((j) => j.status === 'scheduled' && j.staffIds.includes(s.id) && j.date >= iso(new Date())).length }));
  res.json({ months, revenue, growth, newClients, totalClients: db.clients.length, productivity, openQuotes: db.quotes.filter((q) => q.status === 'sent').length, jobsThisMonth: db.jobs.filter((j) => monthKey(j.date) === months[months.length - 1]).length });
});

// bulk client import (rows are parsed and column-matched in the browser on /clients/import)
app.post('/api/clients/import', (req, res) => {
  const rows = Array.isArray(req.body && req.body.clients) ? req.body.clients : [];
  if (rows.length > 5000) return res.status(400).json({ error: 'Import up to 5,000 clients at a time' });
  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  let added = 0;
  for (const r of rows) {
    const name = str(r.name, 200); if (!name) continue;
    db.clients.push({ id: uid(), name, company: str(r.company, 200), tags: [], email: str(r.email, 200), phone: str(r.phone, 50), address: str(r.address, 500), notes: str(r.notes, 5000), createdAt: iso(new Date()), portalToken: token() });
    added++;
  }
  save(); res.json({ added });
});
// merge duplicate clients into one profile: move their records over, fill empty details, combine tags and notes
app.post('/api/clients/merge', (req, res) => {
  const keep = findClient(req.body && req.body.keepId);
  const others = [...new Set((req.body && req.body.mergeIds) || [])].filter((id) => id !== (keep && keep.id)).map(findClient).filter(Boolean);
  if (!keep || !others.length) return res.status(400).json({ error: 'Choose a client to keep and at least one to merge into it' });
  const ids = new Set(others.map((c) => c.id));
  for (const col of ['quotes', 'jobs', 'invoices', 'notifications']) (db[col] || []).forEach((x) => { if (ids.has(x.clientId)) { x.clientId = keep.id; if (col === 'notifications') x.clientName = keep.name; } });
  const tags = (c) => (Array.isArray(c.tags) ? c.tags : String(c.tags || '').split(',')).map((t) => t.trim()).filter(Boolean);
  for (const o of others) {
    for (const k of ['email', 'phone', 'address', 'company']) if (!keep[k] && o[k]) keep[k] = o[k];
    keep.tags = [...new Set([...tags(keep), ...tags(o)])];
    if (o.notes && !(keep.notes || '').includes(o.notes)) keep.notes = [keep.notes, o.notes].filter(Boolean).join('\n\n');
    if (o.createdAt && (!keep.createdAt || o.createdAt < keep.createdAt)) keep.createdAt = o.createdAt; // client since the earliest profile
  }
  db.clients = db.clients.filter((c) => !ids.has(c.id)); save(); res.json(keep);
});
// what this account's App Settings shows: which messages work, and the state of its card payments
app.get('/api/integrations', async (req, res) => {
  const sec = secrets(); if (sec.stripeAccountId && !sec.stripeChargesEnabled) await syncStripeAccount(); // e.g. just back from Stripe
  const s = secrets(); const pay = tenancy.has('onlinePayments');
  res.json({
    email: !!emailProvider(), sms: smsReady(), ai: !!process.env.ANTHROPIC_API_KEY,
    serverEmail: !!serverEmailProvider(),
    // the account's own senders, without passwords, tokens or keys
    ownEmail: (({ provider, user, from, fromName, host, port } = {}) => (provider ? { provider, user: user || '', from: from || '', fromName: fromName || '', host: host || '', port: port || '' } : null))(ownEmail() || undefined),
    ownTwilio: ownTwilio() ? { sid: ownTwilio().sid, from: ownTwilio().from } : null,
    payments: !!stripeKey(), paymentsMode: stripeKey() ? stripeMode() : null,
    stripe: pay ? {
      available: !!stripeLib.platformKey(), accountId: s.stripeAccountId || null, chargesEnabled: !!s.stripeChargesEnabled, detailsSubmitted: !!s.stripeDetailsSubmitted, name: s.stripeAccountName || '',
      ownKeys: !!s.stripeSecretKey && !connectedAccount(), serverKey: tenancy.isDefault() && !s.stripeSecretKey && !connectedAccount() && !!process.env.STRIPE_SECRET_KEY,
      feePercent: Number(tenancy.platform().settings.platformFeePercent) || 0, // charged only on payments through Connect
    } : null,
  });
});

// ---------- Account and billing: the business's own subscription to this service (owner only) ----------
// Plans are billed by the platform's Stripe account (lib/platform.js sign-up checkout); t.billing holds the Stripe customer and subscription.
// The owner changes the plan, card and billing details here; Stripe charges the subscription automatically.
const ownerOnly = (req, res) => { const u = currentUser(req); if (u && u.role === 'owner') return true; res.status(403).json({ error: 'Only the account owner can manage billing' }); return false; };
const billingCall = (method, endpoint, params) => stripeLib.request(stripeLib.platformKey(), method, endpoint, params);
const unix = (t) => (t ? iso(new Date(t * 1000)) : null);
app.get('/api/account/billing', async (req, res) => {
  if (!ownerOnly(req, res)) return;
  const t = tenancy.current(); const P = tenancy.platform(); const plan = tenancy.planOf(t); const b = t.billing || {}; let charge = stripeLib.planCharge(plan, b.interval);
  const out = { activeSince: (b.paidAt || t.createdAt || '').slice(0, 10), status: t.status, plan: { id: plan.id, name: plan.name, price: plan.price || '', charge },
    productName: P.settings.productName, contactEmail: P.settings.contactEmail, live: !!stripeLib.platformKey(), billed: !!(b.customerId && stripeLib.platformKey()),
    demo: !!b.demo, managed: !tenancy.isDefault(), plans: P.plans.filter((p) => !p.hidden || p.id === plan.id).map((p) => ({ id: p.id, name: p.name, price: p.price || '', description: p.description || '', month: (stripeLib.planCharge(p, 'month') || {}).interval === 'month' ? stripeLib.planCharge(p, 'month').cents / 100 : null, year: (stripeLib.planCharge(p, 'year') || {}).interval === 'year' ? stripeLib.planCharge(p, 'year').cents / 100 : null })),
    interval: charge ? charge.interval : b.interval || 'month',
    card: null, customer: null, subscription: null, invoices: [], endsAt: b.endsAt || null, pendingPlan: b.pendingPlanId ? (P.plans.find((p) => p.id === b.pendingPlanId) || {}).name || null : null };
  if (out.billed) {
    const get = (ep) => billingCall('GET', ep).catch((e) => { console.error('Billing:', e.message); return null; });
    const [cust, sub, inv] = await Promise.all([get(`customers/${encodeURIComponent(b.customerId)}?expand[]=invoice_settings.default_payment_method`),
      b.subscriptionId ? get(`subscriptions/${encodeURIComponent(b.subscriptionId)}?expand[]=default_payment_method`) : null, get(`invoices?customer=${encodeURIComponent(b.customerId)}&limit=24`)]);
    const pm = (sub && typeof sub.default_payment_method === 'object' && sub.default_payment_method) || (cust && cust.invoice_settings && typeof cust.invoice_settings.default_payment_method === 'object' && cust.invoice_settings.default_payment_method);
    if (pm && pm.card) out.card = { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
    if (cust && !cust.deleted) out.customer = { name: cust.name || (pm && pm.billing_details && pm.billing_details.name) || b.ownerName || '', email: cust.email || b.email || '', address: cust.address || (pm && pm.billing_details && pm.billing_details.address) || null };
    if (sub) {
      const item = sub.items && sub.items.data && sub.items.data[0]; const price = item && item.price;
      out.subscription = { status: sub.status, cancelAtPeriodEnd: !!sub.cancel_at_period_end, cancelAt: unix(sub.cancel_at), startedAt: unix(sub.start_date),
        periodEnd: unix(sub.current_period_end || (item && item.current_period_end)), amount: price && price.unit_amount != null ? round2(price.unit_amount / 100) : charge ? charge.cents / 100 : null,
        interval: (price && price.recurring && price.recurring.interval) || (charge && charge.interval) || 'month' };
      if (out.subscription.startedAt) out.activeSince = out.subscription.startedAt;
      out.interval = out.subscription.interval; out.plan.charge = charge = stripeLib.planCharge(plan, out.interval);
    }
    out.invoices = ((inv && inv.data) || []).filter((i) => i.status !== 'draft').map((i) => ({ id: i.id, date: unix(i.status_transitions && i.status_transitions.paid_at) || unix(i.created), amount: round2((i.amount_paid || i.total || 0) / 100),
      currency: String(i.currency || 'usd').toUpperCase(), status: i.status, receiptUrl: i.hosted_invoice_url || null, pdf: i.invoice_pdf || null }));
    out.moreInvoices = !!(inv && inv.has_more);
  }
  res.json(out);
});
// one Stripe product per plan (per test/live mode), so subscriptions and invoices show the plan's name
async function planProduct(plan) {
  const P = tenancy.platform(); P.stripeProducts = P.stripeProducts || {}; const k = `${stripeLib.modeOf(stripeLib.platformKey())}:${plan.id}`;
  if (P.stripeProducts[k]) return P.stripeProducts[k];
  const p = await billingCall('POST', 'products', { name: `${P.settings.productName} ${plan.name}`, 'metadata[planId]': plan.id });
  P.stripeProducts[k] = p.id; tenancy.savePlatform(); return p.id;
}
const periodEndOf = (sub) => unix(sub.current_period_end || (sub.items && sub.items.data[0] && sub.items.data[0].current_period_end));
const tellPlatform = (title, message) => { const to = tenancy.platform().settings.contactEmail; if (to) sendTemplate('accountActivity', to, { title, message, link: tenancy.tenantUrl(tenancy.current()) }, { server: true }).catch(() => {}); };
// "Get Support" in the app's help panel: saved for the platform console (Messages → Contact requests) and emailed to the contact address
const supportHits = new Map(); // account+user -> timestamps: 5 requests per hour
app.post('/api/support', async (req, res) => {
  const u = currentUser(req); const t = tenancy.current(); const b = req.body || {};
  const key = `${t.slug}|${u.id}`; const now = Date.now(); const hits = (supportHits.get(key) || []).filter((x) => now - x < 3600e3);
  if (hits.length >= 5) return res.status(429).json({ error: 'You’ve sent several requests in the last hour. We’ll get back to you soon.' });
  const str = (k, n) => String(b[k] || '').trim().slice(0, n);
  const email = normEmail(b.email || u.email).slice(0, 200); const subject = str('subject', 150); const message = str('message', 4000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address so we can reply' });
  if (!message) return res.status(400).json({ error: 'Tell us what you need help with' });
  hits.push(now); supportHits.set(key, hits);
  const P = tenancy.platform(); const plan = tenancy.planOf(t);
  const m = { id: crypto.randomBytes(6).toString('hex'), at: new Date().toISOString(), source: 'support', name: u.name, email, phone: str('phone', 40), company: db.company.name || t.slug,
    plan: plan.name, topic: str('topic', 60), account: tenancy.tenantUrl(t), page: /^https?:\/\//i.test(str('page', 300)) ? str('page', 300) : '', message: subject ? `${subject}\n\n${message}` : message };
  P.inquiries = P.inquiries || []; P.inquiries.unshift(m); P.inquiries.length = Math.min(P.inquiries.length, 500); tenancy.savePlatform();
  const to = P.settings.contactEmail;
  if (to) {
    const details = emails.details([['Name', `${m.name} (${u.role})`], ['Email', m.email], ['Phone', m.phone], ['Business', m.company], ['Plan', m.plan], ['Account', m.account], ['Topic', m.topic], ['Page', m.page]]);
    const sent = await sendTemplate('supportRequest', to, { name: m.name, business: m.company, subject: subject || m.topic || 'Help needed', details, message }, { server: true, replyTo: m.email }).catch((e) => ({ status: 'failed', detail: e.message }));
    m.emailed = sent.status === 'sent'; tenancy.savePlatform();
  }
  res.json({ ok: true });
});
// "Feedback" in the app's top bar: a rating and a message from any login, saved for the platform console (Messages → User feedback) and emailed to the contact address
const FEEDBACK_KINDS = ['Idea or suggestion', 'Something isn’t working', 'Something I like', 'Other'];
const feedbackHits = new Map(); // account+user -> timestamps: 10 per hour
app.post('/api/feedback', async (req, res) => {
  const u = currentUser(req); const t = tenancy.current(); const b = req.body || {};
  const key = `${t.slug}|${u.id}`; const now = Date.now(); const hits = (feedbackHits.get(key) || []).filter((x) => now - x < 3600e3);
  if (hits.length >= 10) return res.status(429).json({ error: 'Thanks! You’ve sent a lot of feedback in the last hour. Try again a little later.' });
  const message = String(b.message || '').trim().slice(0, 4000); const rating = Math.round(Number(b.rating)) || 0;
  if (!message && !rating) return res.status(400).json({ error: 'Pick a rating or write a few words' });
  hits.push(now); feedbackHits.set(key, hits);
  const P = tenancy.platform(); const plan = tenancy.planOf(t); const page = String(b.page || '').slice(0, 300);
  const m = { id: crypto.randomBytes(6).toString('hex'), at: new Date().toISOString(), name: u.name, email: u.email, role: u.role, company: db.company.name || t.slug, plan: plan.name, account: tenancy.tenantUrl(t),
    rating: rating >= 1 && rating <= 5 ? rating : 0, kind: FEEDBACK_KINDS.includes(b.kind) ? b.kind : 'Other', message, contactOk: !!b.contactOk, page: /^https?:\/\//i.test(page) ? page : '' };
  P.feedback = P.feedback || []; P.feedback.unshift(m); P.feedback.length = Math.min(P.feedback.length, 1000); tenancy.savePlatform();
  const to = P.settings.contactEmail;
  if (to) {
    const details = emails.details([['From', `${m.name} (${m.role})`], ['Business', m.company], ['Plan', m.plan], ['Account', m.account], ['Page', m.page], ['OK to contact', m.contactOk ? `yes, ${m.email}` : 'no']]);
    const sent = await sendTemplate('feedback', to, { name: m.name, business: m.company, rating: m.rating ? `${m.rating}/5` : 'no rating', kind: m.kind, details, message: m.message || '(no message)' }, { server: true, ...(m.contactOk ? { replyTo: m.email } : {}) }).catch((e) => ({ status: 'failed', detail: e.message }));
    m.emailed = sent.status === 'sent'; tenancy.savePlatform();
  }
  res.json({ ok: true });
});
// ---------- Support Access (lib/support.js): any login can grant the platform's support team access for four weeks ----------
support.setOwnerLookup((t) => tenancy.run(t, () => { const o = db.users.find((u) => u.role === 'owner'); return o && { id: o.id, name: o.name }; }));
// the console's one-time link: signs the support admin in as the person who granted access, until the grant ends or is revoked
app.get('/support-login', (req, res) => {
  const t = tenancy.current(); const s = support.redeem(t, req.query.token);
  const user = s && db.users.find((u) => u.id === s.userId && u.passwordHash && !staffBlocked(u));
  if (!user) return res.status(400).send(notice('This support link doesn’t work', 'It was already used, is more than a few minutes old, or support access has ended. Get a new link from the platform console.'));
  startSession(res, user, { expires: s.expires, support: { requestId: s.requestId, adminName: s.adminName, expires: s.expires } });
  res.redirect('/');
});
// signs out every support session of one grant (runs inside the account)
const endSupportSessions = (requestId) => { for (const [k, s] of Object.entries(db.sessions)) if (s.support && s.support.requestId === requestId) delete db.sessions[k]; save(); };
const supportRow = ({ id, userId, userName, adminName, reason, requestedAt, status, grantedAt, grantedBy, expiresAt, endedAt, endedBy, lastUsedAt }) => ({ id, userId, userName, adminName, reason, requestedAt, status, grantedAt, grantedBy, expiresAt, endedAt, endedBy, lastUsedAt });
// each person sees their own requests; the owner also sees (and can revoke) everyone else's
const supportState = (t, u) => {
  const all = support.requests(t); const mine = all.filter((r) => r.userId === u.id); const cur = mine.find(support.isOpen) || null;
  const owner = u.role === 'owner'; const others = owner ? all.filter((r) => r.userId !== u.id) : [];
  return { current: cur ? supportRow(cur) : null, team: others.filter(support.isOpen).map(supportRow), history: [...mine.filter((r) => r !== cur), ...others.filter((r) => !support.isOpen(r))].sort((a, b) => (b.requestedAt > a.requestedAt ? 1 : -1)).map(supportRow),
    isOwner: owner, grantDays: support.GRANT_DAYS, productName: tenancy.platform().settings.productName };
};
const tellSupportAdmin = (r, title, message) => { if (r.adminEmail) sendTemplate('accountActivity', r.adminEmail, { title, message, link: `${tenancy.platformUrl()}/platform` }, { server: true }).catch(() => {}); };
app.get('/api/account/support-access', (req, res) => res.json(supportState(tenancy.current(), currentUser(req))));
app.post('/api/account/support-access/:id/:action', (req, res) => {
  const u = currentUser(req); const t = tenancy.current(); const { id, action } = req.params; let r;
  try {
    if (action === 'grant' || action === 'decline') r = support.answer(t, id, u, action === 'grant');
    else if (action === 'revoke') {
      const x = support.requests(t).find((y) => y.id === id); if (x && x.userId !== u.id && u.role !== 'owner') return res.status(403).json({ error: 'Only the account owner can revoke someone else’s support access' });
      r = support.end(t, id, u.name); endSupportSessions(r.id);
    } else return res.status(404).json({ error: 'Not found' });
  } catch (e) { return res.status(400).json({ error: e.message }); }
  const what = { granted: `granted support access to ${r.userName === u.name ? 'their login' : `${r.userName}’s login`} until ${niceDate(r.expiresAt.slice(0, 10))}`, declined: 'declined your support access request', revoked: `revoked support access to ${r.userName === u.name ? 'their login' : `${r.userName}’s login`}`, cancelled: `withdrew the request for ${r.userName}’s login` }[r.status];
  tellSupportAdmin(r, `${t.name}: support access ${r.status}`, `${u.name} ${what} at ${t.name}.`);
  res.json(supportState(t, u));
});
const stripeError = (res, what, e) => { console.error(`Billing ${what}:`, e.message); res.status(502).json({ error: /card|declin|insufficient|authentication/i.test(e.message) ? `Your card couldn’t be charged: ${e.message} Update your card and try again.` : `Stripe couldn’t ${what}: ${e.message}` }); };
async function liveSubscription(b) {
  if (!b.subscriptionId) return null;
  const sub = await billingCall('GET', `subscriptions/${encodeURIComponent(b.subscriptionId)}`).catch(() => null);
  return sub && !['canceled', 'incomplete_expired'].includes(sub.status) ? sub : null;
}
// switch plan: paid → paid changes the subscription price now (difference charged or credited, prorated);
// → free takes effect when the paid period ends; free/no subscription → paid goes through Stripe Checkout
app.post('/api/account/billing/plan', async (req, res) => {
  if (!ownerOnly(req, res)) return;
  const t = tenancy.current(); const P = tenancy.platform(); const u = currentUser(req);
  if (tenancy.isDefault(t)) return res.status(400).json({ error: 'Your platform’s own account doesn’t have a plan to change' });
  const to = P.plans.find((p) => p.id === (req.body && req.body.planId) && !p.hidden); if (!to) return res.status(400).json({ error: 'Choose a plan' });
  const from = tenancy.planOf(t); const b = t.billing || (t.billing = {});
  const want = req.body.interval === 'year' ? 'year' : 'month'; const c = stripeLib.planCharge(to, want);
  if (c && c.interval !== want) return res.status(400).json({ error: `${to.name} isn’t available ${want === 'year' ? 'yearly' : 'monthly'}` });
  const label = `${to.name}${c ? ` (${want === 'year' ? 'yearly' : 'monthly'})` : ''}`;
  const switched = (message) => { if (c) b.interval = c.interval; tenancy.savePlatform(); tellPlatform(`Plan changed: ${t.name} → ${label}`, `${u.name} (${u.email}) changed ${t.name} from ${from.name} to ${label}. ${message}`); res.json({ ok: true, message }); };
  try {
    const sub = stripeLib.platformKey() ? await liveSubscription(b) : null;
    const nowInterval = (sub && sub.items.data[0].price.recurring && sub.items.data[0].price.recurring.interval) || b.interval || 'month';
    if (to.id === t.planId && !b.pendingPlanId && (!c || c.interval === nowInterval)) return res.status(400).json({ error: `You’re already on ${label}` });
    if (!stripeLib.platformKey()) { t.planId = to.id; delete b.pendingPlanId; delete b.endsAt; return switched(`You’re now on ${label}.`); } // no Stripe on this server: demo
    if (!c) { // free plan
      if (!sub) { t.planId = to.id; delete b.pendingPlanId; delete b.endsAt; return switched(`You’re now on ${to.name}.`); }
      if (to.id === t.planId) { delete b.pendingPlanId; delete b.endsAt; await billingCall('POST', `subscriptions/${sub.id}`, { cancel_at_period_end: 'false' }); return switched(`You’ll stay on ${to.name}.`); }
      await billingCall('POST', `subscriptions/${sub.id}`, { cancel_at_period_end: 'true' });
      b.pendingPlanId = to.id; b.endsAt = periodEndOf(sub);
      return switched(`You’ll move to ${to.name} on ${niceDate(b.endsAt)}, when your paid period ends. You won’t be charged again.`);
    }
    if (sub) {
      const item = sub.items.data[0];
      const s2 = await billingCall('POST', `subscriptions/${sub.id}`, { 'items[0][id]': item.id, 'items[0][price_data][currency]': 'usd', 'items[0][price_data][product]': await planProduct(to),
        'items[0][price_data][unit_amount]': String(c.cents), 'items[0][price_data][recurring][interval]': c.interval, proration_behavior: 'always_invoice', payment_behavior: 'error_if_incomplete',
        cancel_at_period_end: 'false', 'metadata[planId]': to.id });
      t.planId = to.id; delete b.pendingPlanId; delete b.endsAt; b.subscriptionStatus = s2.status;
      return switched(c.interval !== nowInterval ? `You’re now on ${label}. Your unused time is credited and the new ${c.interval}ly price of ${money(c.cents / 100)} is charged now; it renews every ${c.interval}.`
        : `You’re now on ${label}. Any difference for the rest of this billing period is charged or credited now, and you’ll pay ${money(c.cents / 100)} each ${c.interval} from your next bill.`);
    }
    // no paid subscription yet: pay at Stripe Checkout; the plan switches when the payment goes through
    const p = { mode: 'subscription', client_reference_id: t.id, 'metadata[tenantId]': t.id, 'metadata[planId]': to.id, 'metadata[interval]': c.interval, 'subscription_data[metadata][tenantId]': t.id,
      'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][product]': await planProduct(to),
      'line_items[0][price_data][unit_amount]': String(c.cents), 'line_items[0][price_data][recurring][interval]': c.interval,
      success_url: `${baseUrl()}/settings/billing?checkout={CHECKOUT_SESSION_ID}`, cancel_url: `${baseUrl()}/settings/billing` };
    if (b.customerId) p.customer = b.customerId; else p.customer_email = u.email;
    const s = await billingCall('POST', 'checkout/sessions', p); res.json({ redirect: s.url });
  } catch (e) { stripeError(res, 'change the plan', e); }
});
// back from Checkout (new subscription) or the card page (new card): check the session with Stripe, then apply it
app.post('/api/account/billing/return', async (req, res) => {
  if (!ownerOnly(req, res)) return;
  const t = tenancy.current(); const b = t.billing || (t.billing = {}); const id = String((req.body && req.body.sessionId) || '');
  if (!/^cs_[A-Za-z0-9_]+$/.test(id) || !stripeLib.platformKey()) return res.status(400).json({ error: 'That payment link isn’t valid' });
  try {
    const s = await billingCall('GET', `checkout/sessions/${encodeURIComponent(id)}?expand[]=setup_intent`);
    if (!s.metadata || s.metadata.tenantId !== t.id || s.status !== 'complete') return res.status(400).json({ error: 'That payment wasn’t completed' });
    if (s.mode === 'subscription') {
      const to = tenancy.platform().plans.find((p) => p.id === s.metadata.planId);
      if (to && s.subscription && b.subscriptionId !== s.subscription) {
        const from = tenancy.planOf(t); t.planId = to.id;
        Object.assign(b, { customerId: s.customer, subscriptionId: s.subscription, status: 'paid', subscriptionStatus: 'active', interval: s.metadata.interval === 'year' ? 'year' : 'month' }); delete b.pendingPlanId; delete b.endsAt; delete b.demo;
        if (b.pausedForBilling) { t.status = 'active'; delete b.pausedForBilling; }
        tenancy.savePlatform(); tellPlatform(`New subscription: ${t.name} → ${to.name}`, `${currentUser(req).name} subscribed ${t.name} to ${to.name} (was ${from.name}).`);
      }
      return res.json({ ok: true, message: to ? `You’re now on ${to.name}. Thank you!` : 'Payment received' });
    }
    const pm = s.setup_intent && s.setup_intent.payment_method; if (!pm) return res.status(400).json({ error: 'No card was saved' });
    await useCard(b, typeof pm === 'string' ? pm : pm.id);
    res.json({ ok: true, message: 'Your card is updated' });
  } catch (e) { stripeError(res, 'finish', e); }
});
// make a card the one every future charge uses, and retry any bill that's still unpaid
async function useCard(b, pm) {
  await billingCall('POST', `customers/${encodeURIComponent(b.customerId)}`, { 'invoice_settings[default_payment_method]': pm });
  if (b.subscriptionId) await billingCall('POST', `subscriptions/${encodeURIComponent(b.subscriptionId)}`, { default_payment_method: pm }).catch(() => {});
  const open = await billingCall('GET', `invoices?customer=${encodeURIComponent(b.customerId)}&status=open&limit=10`).catch(() => null);
  for (const i of (open && open.data) || []) await billingCall('POST', `invoices/${i.id}/pay`, { payment_method: pm }).catch((e) => console.error('Billing retry:', e.message));
}
async function ensureCustomer(t, u) {
  const b = t.billing || (t.billing = {}); if (b.customerId) return b.customerId;
  const c = await billingCall('POST', 'customers', { email: u.email, name: u.name, 'metadata[tenantId]': t.id, description: t.name });
  b.customerId = c.id; tenancy.savePlatform(); return c.id;
}
// new card: Stripe's secure card page (Checkout in setup mode), so card numbers never touch this server
app.post('/api/account/billing/card', async (req, res) => {
  if (!ownerOnly(req, res)) return;
  if (!stripeLib.platformKey()) return res.status(400).json({ error: 'Card payments aren’t set up on this server' });
  const t = tenancy.current();
  try {
    const customer = await ensureCustomer(t, currentUser(req));
    const s = await billingCall('POST', 'checkout/sessions', { mode: 'setup', customer, currency: 'usd', 'payment_method_types[0]': 'card', 'metadata[tenantId]': t.id,
      success_url: `${baseUrl()}/settings/billing?card={CHECKOUT_SESSION_ID}`, cancel_url: `${baseUrl()}/settings/billing` });
    res.json({ redirect: s.url });
  } catch (e) { stripeError(res, 'open the card page', e); }
});
// name, email and address on bills and receipts
app.put('/api/account/billing/details', async (req, res) => {
  if (!ownerOnly(req, res)) return;
  if (!stripeLib.platformKey()) return res.status(400).json({ error: 'Billing isn’t set up on this server' });
  const b = req.body || {}; const str = (k, n = 200) => String(b[k] || '').trim().slice(0, n);
  if (!str('name')) return res.status(400).json({ error: 'Enter the name for your bills' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str('email'))) return res.status(400).json({ error: 'Enter the email address for receipts' });
  try {
    const customer = await ensureCustomer(tenancy.current(), currentUser(req));
    await billingCall('POST', `customers/${encodeURIComponent(customer)}`, { name: str('name'), email: str('email').toLowerCase(), 'address[line1]': str('line1'), 'address[line2]': str('line2'),
      'address[city]': str('city', 100), 'address[state]': str('state', 100), 'address[postal_code]': str('postal_code', 20), 'address[country]': str('country', 2).toUpperCase() || 'US' });
    res.json({ ok: true });
  } catch (e) { stripeError(res, 'save your billing details', e); }
});
// cancel at the end of the paid period (the account keeps working until then), or undo that
app.post('/api/account/billing/cancel', async (req, res) => {
  if (!ownerOnly(req, res)) return;
  const t = tenancy.current(); const b = t.billing || {}; const undo = !!(req.body && req.body.undo); const u = currentUser(req);
  if (!stripeLib.platformKey()) return res.status(400).json({ error: 'This account doesn’t have a subscription to cancel. Contact us to close it.' });
  try {
    const sub = await liveSubscription(b); if (!sub) return res.status(400).json({ error: 'This account doesn’t have a subscription to cancel. Contact us to close it.' });
    const s = await billingCall('POST', `subscriptions/${sub.id}`, { cancel_at_period_end: undo ? 'false' : 'true', ...(undo ? {} : { 'cancellation_details[comment]': String((req.body && req.body.reason) || '').slice(0, 500) }) });
    delete b.pendingPlanId; if (undo) delete b.endsAt; else b.endsAt = periodEndOf(s); tenancy.savePlatform();
    tellPlatform(`${undo ? 'Cancellation withdrawn' : 'Subscription cancelled'}: ${t.name}`, `${u.name} (${u.email}) ${undo ? 'kept the subscription' : `cancelled the ${tenancy.planOf(t).name} plan for ${t.name}. It keeps working until ${niceDate(b.endsAt)}, then it’s paused`}.${!undo && req.body && req.body.reason ? `\n\nReason: ${req.body.reason}` : ''}`);
    res.json({ ok: true, endsAt: b.endsAt || null });
  } catch (e) { stripeError(res, 'update the subscription', e); }
});

// SPA fallback for every other page route
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- platform console + pricing/sign-up (lib/platform.js) ----------
// the owner login of a new account: with a password (self sign-up) or invited to choose one (created from the console). Runs inside the account.
function createOwner(t, { name, email, password }) {
  const user = { id: uid(), name, email: normEmail(email), role: 'owner', createdAt: iso(new Date()) };
  if (password) { const { salt, hash } = hashPassword(password); Object.assign(user, { salt, passwordHash: hash }); }
  db.users.push(user); ensureOwnerStaff(); save(); return user;
}
// self sign-ups confirm their email: the link (7 days) marks the owner's email confirmed and sends the welcome email. Runs inside the account.
function sendVerifyEmail(t) {
  const u = db.users.find((x) => x.role === 'owner'); if (!u || u.emailVerifiedAt) return Promise.resolve(null);
  const tok = crypto.randomBytes(32).toString('hex'); u.emailVerify = { hash: sha(tok), expires: Date.now() + 7 * 864e5 }; save();
  return sendTemplate('verifyEmail', u.email, { name: u.name, business: db.company.name || t.name, link: `${baseUrl()}/api/auth/verify-email?token=${tok}`, account_url: baseUrl() }, { server: true }).catch(() => null);
}
// a fresh link for the owner: choose a password (not set yet) or reset it
function ownerLink(t) {
  const u = db.users.find((x) => x.role === 'owner'); if (!u) return null;
  for (const [k, x] of Object.entries(db.resetTokens)) if (x.userId === u.id) delete db.resetTokens[k];
  const tok = crypto.randomBytes(32).toString('hex'); const invite = !u.passwordHash;
  db.resetTokens[sha(tok)] = { userId: u.id, expires: Date.now() + INVITE_DAYS * 864e5, invite }; save();
  return { owner: publicUser(u), invite, link: `${baseUrl()}/login?${invite ? 'invite' : 'reset'}=${tok}` };
}
// platform console → account → Reset to demo data (logins and keys survive)
const resetDemo = () => { const keep = { users: db.users, sessions: db.sessions, resetTokens: db.resetTokens, secrets: db.secrets }; tenancy.replaceStore({ ...seed(), ...keep }); };
const tenantStats = (t) => tenancy.run(t, () => {
  const owner = db.users.find((u) => u.role === 'owner');
  return { owner: owner ? { name: owner.name, email: owner.email, active: !!owner.passwordHash, unconfirmed: !!owner.emailVerify && !owner.emailVerifiedAt } : null, users: db.users.length,
    logins: db.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: !!u.passwordHash && !staffBlocked(u) })), clients: db.clients.length, jobs: db.jobs.length, invoices: db.invoices.length,
    lastLoginAt: db.users.map((u) => u.lastLoginAt || '').sort().pop() || null };
});
const helpApp = require('./lib/help')({ sendTemplate, normEmail, emails });
const legal = require('./lib/legal');
const platformApp = require('./lib/platform')({
  hashPassword, checkPassword, sha, normEmail, cookies, tooMany, recordFailure, clearFailures: (k) => failures.delete(k),
  createOwner, ownerLink, sendVerifyEmail, tenantStats, endSupportSessions, sendEmail, sendTemplate, sendSms, emailProvider: serverEmailProvider, applyStripeSession, syncStripeAccount, resetDemo, setCompanyEmail: (e) => { if (!db.company.email) { db.company.email = e; save(); } },
});
// which app answers: the platform's (its own domain, or /platform… while developing) or an account's
const PLATFORM_PATHS = /^\/(platform(\/.*)?|home|pricing|signup|checkout\/.*|checkout\.(js|html)|api\/platform\/.*|api\/site(\/.*)?)$/;
function dispatch(req, res) {
  if (brandLib.serve(req, res)) return; // the application logo (lib/brand.js), on every address
  const p = req.url.split('?')[0]; const r = tenancy.resolve(req.headers.host);
  // pages and API replies depend on who is logged in: hosting caches (e.g. SiteGround's dynamic cache) must never store or share them
  if (!/\.(js|css|png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(p)) res.setHeader('Cache-Control', 'private, no-store');
  else if (/\.(js|css)$/i.test(p)) res.setHeader('Cache-Control', 'no-cache'); // the app's code: always check for a newer version, so a deploy shows up right away
  if (legal.kindOf(p)) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(legal.page(legal.kindOf(p))); } // Terms + Privacy: the same on every address
  if (tenancy.isHelpHost(req.headers.host)) return helpApp(req, res);
  if (r.kind === 'platform' || p === '/api/site/domain-allowed' || (r.dev && PLATFORM_PATHS.test(p))) return platformApp(req, res);
  app(req, res);
}

const rp = process.argv.indexOf('--reset-password');
if (rp > 0) { // emergency reset from the terminal: node server.js --reset-password you@example.com NewPassword [account-address]
  const slug = process.argv[rp + 3]; const t = slug ? tenancy.platform().tenants.find((x) => x.slug === slug) : tenancy.platform().tenants.find((x) => tenancy.isDefault(x));
  if (!t) { console.error(`No account with the address ${slug}`); process.exit(1); }
  tenancy.run(t, () => {
    const u = db.users.find((x) => x.email === normEmail(process.argv[rp + 1])); const pw = process.argv[rp + 2] || '';
    if (!u || pw.length < 8) { console.error(u ? 'Password must be at least 8 characters' : `No login with that email in ${t.name}`); process.exit(1); }
    Object.assign(u, (({ salt, hash }) => ({ salt, passwordHash: hash }))(hashPassword(pw))); save(); console.log(`Password updated for ${u.email} (${t.name})`); process.exit(0);
  });
}
const rpp = process.argv.indexOf('--reset-platform-password');
if (rpp > 0) { // same for the platform console login: node server.js --reset-platform-password you@example.com NewPassword
  const P = tenancy.platform(); const a = P.admins.find((x) => x.email === normEmail(process.argv[rpp + 1])); const pw = process.argv[rpp + 2] || '';
  if (!a) { console.error(P.admins.length ? `No platform login with that email. Platform logins: ${P.admins.map((x) => x.email).join(', ')}` : 'There is no platform login yet: open /platform to create one'); process.exit(1); }
  if (pw.length < 10) { console.error('Password must be at least 10 characters'); process.exit(1); }
  Object.assign(a, (({ salt, hash }) => ({ salt, passwordHash: hash }))(hashPassword(pw)));
  for (const [k, s] of Object.entries(P.sessions)) if (s.adminId === a.id) delete P.sessions[k]; // log out everywhere
  tenancy.savePlatform(); console.log(`Platform password updated for ${a.email}`); process.exit(0);
}
require('http').createServer(dispatch).listen(PORT, () => {
  console.log(`App running at ${BASE_URL}`);
  console.log(tenancy.devMode ? `Platform console: ${BASE_URL}/platform (set PLATFORM_DOMAIN to host accounts on their own addresses)` : `Platform: ${tenancy.platformUrl()}  ·  accounts at <address>.${tenancy.PLATFORM_DOMAIN}`);
});
