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
const referrals = require('./lib/referrals');
const supporters = require('./lib/supporters');
const discountsLib = require('./lib/discounts');
const retention = require('./lib/retention');
const seo = require('./lib/seo');
const maintenance = require('./lib/maintenance');
const stripeLib = require('./lib/stripe');
const social = require('./lib/social');
const bluesky = require('./lib/bluesky');
const networks = require('./lib/networks'); // LinkedIn, Pinterest, Threads, TikTok and YouTube for Marketing
const accounting = require('./lib/accounting'); // QuickBooks Online and Xero (Settings → QuickBooks & Xero)
const xposts = require('./lib/xposts'); // X, with the business's own developer app
const businessPage = require('./lib/business-page'); // the page the business QR code opens
const changelog = require('./lib/changelog'); // what's new: the top bar's bell (the full list is on ideas.<domain>/changelog)
const tiktokLib = require('./lib/tiktok'); tiktokLib.init(); // Alpha → Social: scheduled TikTok posts, checked every 30 seconds
const rolesLib = require('./lib/roles');
const iconsLib = require('./lib/icons');
const { createPdf } = require('./lib/pdf');
const chat = require('./lib/chat');
const forum = require('./lib/forum');
const industries = require('./lib/industries');
const marketplace = require('./lib/marketplace');
const homeDepot = require('./lib/homedepot');
const push = require('./lib/push');
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
    company: { name: 'Your Business Name', email: 'hello@example.com', phone: '+17135550100', website: '', address: '100 Commerce St, Houston, TX 77002', logo: '', taxRate: 8.25, paymentTermsDays: 14, invoiceFooter: 'Thank you for your business!', brandColor: '#0f766e' },
    clients, services, staff, quotes, jobs, invoices, expenses, notifications: [], photos: [],
    counters: { quote: 1002, job: 2006, invoice: 3004 },
  };
}
// a new account that starts without demo data
function emptySeed() {
  return {
    company: { name: '', email: '', phone: '', website: '', address: '', logo: '', taxRate: 0, paymentTermsDays: 14, invoiceFooter: 'Thank you for your business!', brandColor: '#0f766e' },
    clients: [], services: [], staff: [], quotes: [], jobs: [], invoices: [], expenses: [], notifications: [], photos: [],
    counters: { quote: 1000, job: 2000, invoice: 3000 }, users: [], sessions: {}, resetTokens: {},
  };
}
const save = () => tenancy.saveStore();
// run once each time an account's data is loaded: brings data saved by older versions up to date
function migrate() {
  ensureAuthStore(); ensureOwnerStaff();
  db.tasks = db.tasks || []; db.events = db.events || []; // the Schedules page's tasks and events (besides jobs)
  for (const u of db.users) if (u.role === 'member') u.role = 'technician'; // the old "team member" role is now Technician
  if (!Array.isArray(db.roles)) db.roles = rolesLib.defaults(); // team roles (Settings → Roles & Permissions) start as Manager and Technician
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
// Good / Better / Best: a quote can offer 2–3 options. options: [{ id, name, desc }], recommended: an option's id or '', chosenOption: the one the
// client (or the business) picked when it was approved. Each line item has opt: its option's id, or '' for an item in every option. The quote's
// totals and deposit are always the chosen option's, or the recommended (else first) one's until a choice is made, so payments, lists and reports
// work as they do for any quote; optionTotals has every option's.
const hasOptions = (q) => Array.isArray(q.options) && q.options.length >= 2;
const optionItems = (q, id) => (q.items || []).filter((i) => !i.opt || i.opt === id);
const shownOption = (q) => (hasOptions(q) ? q.options.find((o) => o.id === q.chosenOption) || q.options.find((o) => o.id === q.recommended) || q.options[0] : null);
// the line items that go on the job and invoice: the chosen option's (without their option marks)
const quoteItems = (q) => (hasOptions(q) ? (q.chosenOption ? optionItems(q, q.chosenOption) : []) : q.items || []).map(({ opt, ...i }) => ({ ...i }));
function sumItems(doc, items) {
  const subtotal = round2(items.reduce((s, i) => s + i.qty * i.price, 0));
  // late fee lines (invoices) are in the subtotal but never discounted or taxed
  const base = round2(subtotal - items.filter((i) => i.lateFee).reduce((s, i) => s + i.qty * i.price, 0));
  const discount = Math.min(base, round2(doc.discountType === 'percent' ? base * doc.discountValue / 100 : doc.discountValue));
  const tax = round2((base - discount) * doc.taxRate / 100); const total = round2(subtotal - discount + tax);
  const depositFee = Math.min(total, round2(doc.depositType === 'percent' ? total * doc.depositValue / 100 : doc.depositValue));
  return { subtotal, discount, tax, total, depositFee };
}
// Products & services categories (e.g. "Low voltage", "Custom t-shirts"): each catalog item can have one. A quote, job or invoice line
// keeps the category of the catalog item with its name when it's saved (cat), so reports can show each category on its own.
const cleanCat = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
const catMaps = new WeakMap(); // each account's catalog: name -> category, rebuilt when it changes (reports look up every line)
const catalogCat = (name) => {
  const list = db.services || []; let c = catMaps.get(list);
  if (!c || c.n !== list.length || Date.now() - c.at > 2000) { c = { at: Date.now(), n: list.length, map: new Map() }; for (const s of list) { const k = String(s.name || '').trim().toLowerCase(); if (k && s.category && !c.map.has(k)) c.map.set(k, cleanCat(s.category)); } catMaps.set(list, c); }
  return c.map.get(String(name || '').trim().toLowerCase()) || '';
};
// ---- matrix line items: a heading line (item.matrix: sizes, each with a price; colors; a quantity per size and color) and its sub items
// ("M · Navy", item.mx), rebuilt here from the grid every time so they always match it. App Settings → General turns the editor's button on.
const mxList = (a) => [...new Set((Array.isArray(a) ? a : []).map((x) => String(x == null ? '' : x).replace(/\|/g, '/').trim().slice(0, 30)).filter((x) => x && x !== '__proto__'))].slice(0, 20);
// who may use them: the default account always; others when Alpha includes Matrix pricing for free (t.matrixPricing, the business's page in
// the Alpha console), or while the owner pays for the add-on (t.addons.matrix, App Settings → General; see "paid add-ons" below)
const matrixFree = (t) => tenancy.isDefault(t) || !!t.matrixPricing;
// the matrix add-on while it's on: { since, by, endsAt? }. endsAt: removed, kept until the end of the period already paid for (its last day)
const matrixPaid = (t) => { const a = t.addons && t.addons.matrix; return a && (!a.endsAt || a.endsAt >= iso(new Date())) ? a : null; };
const matrixAllowed = (t = tenancy.current()) => matrixFree(t) || !!matrixPaid(t);
function mxClean(m) {
  const sizes = mxList(m.sizes); const colors = mxList(m.colors); if (!sizes.length) return null;
  const p = m.price && typeof m.price === 'object' ? m.price : {}; const q = m.qty && typeof m.qty === 'object' ? m.qty : {}; const price = {}; const qty = {};
  for (const s of sizes) { price[s] = round2(Math.max(0, Number(p[s]) || 0)); for (const c of colors.length ? colors : ['']) { const n = round2(Math.max(0, Number(q[`${s}|${c}`]) || 0)); if (n) qty[`${s}|${c}`] = n; } }
  return { sizes, colors, price, qty, markup: round2(Number(m.markup) || 0), markupType: m.markupType === 'flat' ? 'flat' : 'percent' }; // price: each size's cost; the markup is the item's
}
const mxLines = (m) => (m.colors.length ? m.colors : ['']).flatMap((c) => m.sizes.map((s) => { const n = m.qty[`${s}|${c}`] || 0; return n ? { desc: [s, c].filter(Boolean).join(' · '), qty: n, cost: m.price[s], markup: m.markup, markupType: m.markupType, sub: true, mx: true } : null; }).filter(Boolean));
function mxExpand(items) {
  const out = [];
  for (const i of items || []) {
    if (!i || i.mx) continue; // a matrix line's sub items come from its grid
    const m = i.matrix && typeof i.matrix === 'object' ? mxClean(i.matrix) : null;
    if (!m) { if (i.matrix) { const { matrix, ...rest } = i; out.push(rest); } else out.push(i); continue; }
    if (!i.desc) continue;
    const cat = catalogCat(i.desc) || cleanCat(i.cat);
    out.push({ ...i, matrix: m, qty: 1, cost: 0, markup: 0, markupType: 'percent', sub: false, needsPrice: false }, ...mxLines(m).map((l) => ({ ...l, opt: i.opt, ...(cat ? { cat } : {}) })));
  }
  return out;
}
function computeTotals(doc) {
  // the options (quotes only): 2 or 3, each named; anything else means no options
  const opts = Array.isArray(doc.options) ? doc.options.slice(0, 3).map((o) => ({ id: /^[a-z0-9]{4,16}$/.test(o && o.id) ? o.id : uid(), name: String((o && o.name) || '').trim().slice(0, 60), desc: String((o && o.desc) || '').trim().slice(0, 500) })) : [];
  const ids = new Set(opts.map((o) => o.id));
  // price is the client-facing unit price: cost plus a markup (% of cost, or a flat $ per unit). Older items without a cost use their price as the cost.
  doc.items = mxExpand(doc.items).filter((i) => i.desc).map((i) => {
    const cost = Number(i.cost ?? i.price) || 0; const markup = Number(i.markup) || 0; const markupType = i.markupType === 'flat' ? 'flat' : 'percent';
    const price = round2(markupType === 'flat' ? cost + markup : cost * (1 + markup / 100));
    const cat = catalogCat(i.desc) || cleanCat(i.cat);
    return { desc: String(i.desc), details: i.details ? String(i.details) : '', qty: Number(i.qty) || 0, cost, markup, markupType, price, ...(cat ? { cat } : {}), ...(i.needsPrice && !(price > 0) ? { needsPrice: true } : {}), ...(i.lateFee ? { lateFee: true } : {}), ...(typeof i.job === 'string' && /^[\w-]{1,40}$/.test(i.job) ? { job: i.job } : {}), ...(opts.length >= 2 ? { opt: ids.has(i.opt) ? i.opt : '' } : {}), ...(i.sub ? { sub: true } : {}), ...(i.matrix ? { matrix: i.matrix } : {}), ...(i.mx ? { mx: true } : {}) };
  });
  if (doc.items[0]) delete doc.items[0].sub; // a sub item sits under the line above it
  doc.taxRate = Number(doc.taxRate) || 0;
  // optional discount before tax: a flat amount or a percentage of the subtotal
  doc.discountType = doc.discountType === 'percent' ? 'percent' : 'flat';
  doc.discountValue = Math.max(0, Number(doc.discountValue) || 0);
  doc.discountName = doc.discountValue > 0 ? String(doc.discountName || '').trim().slice(0, 60) : ''; // a saved discount's name (Settings → Saved discounts), shown in place of "Discount"
  // deposit: a flat fee or a percentage of the total. Older quotes only have depositFee, treated as flat.
  doc.depositType = doc.depositType === 'percent' ? 'percent' : 'flat';
  doc.depositValue = Math.max(0, Number(doc.depositValue ?? doc.depositFee) || 0);
  if (opts.length >= 2) {
    doc.options = opts; if (!ids.has(doc.recommended)) doc.recommended = ''; if (!ids.has(doc.chosenOption)) doc.chosenOption = null;
    doc.optionTotals = Object.fromEntries(opts.map((o) => [o.id, sumItems(doc, optionItems(doc, o.id))]));
    Object.assign(doc, doc.optionTotals[shownOption(doc).id]);
  } else {
    delete doc.options; delete doc.recommended; delete doc.chosenOption; delete doc.optionTotals;
    Object.assign(doc, sumItems(doc, doc.items));
  }
  return doc;
}
// what a quote shows: one part per option with its own items and totals, or, once one is chosen (or without options), the quote itself
const quoteParts = (q) => (!hasOptions(q) ? [{ doc: q }] : q.chosenOption ? [{ opt: shownOption(q), chosen: true, doc: { ...q, items: optionItems(q, q.chosenOption) } }]
  : q.options.map((o) => ({ opt: o, recommended: q.recommended === o.id, doc: { ...q, items: optionItems(q, o.id), ...q.optionTotals[o.id] } })));
// options need names, and an approved quote needs the option that was picked. Each option needs a line item of its own before the
// quote goes to the client (sent, or marked Awaiting response); a draft can be saved while its items are still being sorted into options
function optionsProblem(q) {
  if (!hasOptions(q)) return q.status !== 'draft' ? snapQuote.unpricedProblem(q) : ''; // Snap to quote: nothing at $0 waiting for a price
  const unnamed = q.options.findIndex((o) => !o.name); if (unnamed >= 0) return `Give option ${unnamed + 1} a name`;
  if (q.status !== 'draft') { const e = optionsEmpty(q) || snapQuote.unpricedProblem(q); if (e) return e; }
  if (q.status === 'approved' && !q.chosenOption) return 'Choose the option the client picked';
  return '';
}
const optionsEmpty = (q) => { const empty = hasOptions(q) && q.options.find((o) => !q.items.some((i) => i.opt === o.id)); return empty ? `Give the “${empty.name}” option a line item of its own first` : ''; };
// what the client agreed to when they signed: everything they see on the quote and its deposit payment (not internal notes or the payment switches)
const QUOTE_TERMS = ['title', 'clientId', 'number', 'status', 'notes', 'disclaimer', 'items', 'options', 'chosenOption', 'taxRate', 'discountType', 'discountValue', 'depositType', 'depositValue', 'depositFee', 'total', 'depositPaidAt', 'depositPaidAmount', 'depositMethod', 'depositReference'];
const quoteTerms = (q) => JSON.stringify(QUOTE_TERMS.map((k) => (typeof q[k] === 'string' ? q[k].replace(/\r\n/g, '\n') : q[k] ?? '')));
// payments are recorded, paid online and refunded through their own endpoints; a quote or invoice edit can never change one
const PAYMENT_FIELDS = { quotes: ['depositPaidAt', 'depositPaidAmount', 'depositMethod', 'depositReference', 'depositStatus', 'depositRefunds', 'depositPayment'],
  invoices: ['payments', 'paidAt', 'paidAmount', 'paymentMethod', 'stripeSessionId', 'stripePaymentIntent'] };
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
// money given back on a payment (Payments → a payment → Issue a refund)
const refundedOf = (list) => round2((list || []).filter((r) => r.status !== 'failed' && r.status !== 'canceled').reduce((s, r) => s + (Number(r.amount) || 0), 0));
// what an invoice payment still counts toward the invoice: a tip the client added (p.tip) isn't part of the invoice, and refunds come off the tip first
const paidPart = (p) => round2((Number(p.amount) || 0) - Math.max(0, refundedOf(p.refunds) - (Number(p.tip) || 0)));
// balanceDue = total − deposit credit − recorded payments, less refunds (0 once paid, unless ignoreStatus)
function invoiceCredits(inv, ignoreStatus) {
  const job = inv.jobId && db.jobs.find((j) => j.id === inv.jobId);
  const q = job && job.quoteId && db.quotes.find((x) => x.id === job.quoteId);
  const first = job && db.invoices.filter((i) => i.jobId === job.id).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || String(a.number).localeCompare(String(b.number)))[0];
  // inv.depositCreditRemoved: the admin deleted the deposit line from this invoice, so it isn't credited here
  const credit = q && q.depositPaidAt && first && first.id === inv.id && !inv.depositCreditRemoved ? Math.min(inv.total || 0, Math.max(0, round2((Number(q.depositPaidAmount ?? q.depositFee) || 0) - refundedOf(q.depositRefunds)))) : 0;
  const paid = round2((inv.payments || []).reduce((s, p) => s + paidPart(p), 0));
  const balance = Math.max(0, round2((inv.total || 0) - credit - paid));
  return { depositApplied: credit, depositAppliedAt: credit ? q.depositPaidAt : null, depositQuote: credit ? q.number : null, depositQuoteId: credit ? q.id : null, amountPaid: paid, balanceDue: !ignoreStatus && inv.status === 'paid' ? 0 : balance };
}
const withStatus = (inv) => ({ ...inv, displayStatus: invoiceStatus(inv), ...invoiceCredits(inv) });

// ---------- messaging adapters (email / SMS) ----------
// minimal SMTP client over TLS (port 465): enough to send through Gmail with an app password, no npm packages
function smtpSend({ host, port, user, pass }, { from, fromName, to, replyTo, subject, text, html, attachments = [] }) {
  const clean = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim(); // no header injection
  const word = (s) => (/[^\x20-\x7e]/.test(s) ? `=?UTF-8?B?${Buffer.from(s).toString('base64')}?=` : s);
  const b64 = (s) => Buffer.from(String(s)).toString('base64').replace(/.{76}/g, '$&\r\n');
  const part = (type, s) => [`Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', b64(s)];
  const edge = 'b' + crypto.randomBytes(12).toString('hex'); // an HTML email goes as multipart/alternative with a plain-text copy
  const body = () => (html ? [`Content-Type: multipart/alternative; boundary="${edge}"`, '', `--${edge}`, ...part('text/plain', text), `--${edge}`, ...part('text/html', html), `--${edge}--`] : part('text/plain', text));
  // with files: multipart/mixed, the message first, then each file (e.g. a CSV export)
  const outer = 'm' + crypto.randomBytes(12).toString('hex');
  const file = (a) => [`Content-Type: ${clean(a.type || 'application/octet-stream')}; name="${clean(a.name).replace(/"/g, '')}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${clean(a.name).replace(/"/g, '')}"`, '', Buffer.from(a.content).toString('base64').replace(/.{76}/g, '$&\r\n')];
  const mixed = () => [`Content-Type: multipart/mixed; boundary="${outer}"`, '', `--${outer}`, ...body(), ...attachments.flatMap((a) => [`--${outer}`, ...file(a)]), `--${outer}--`];
  const msg = [
    `From: ${/[^\x20-\x7e]/.test(clean(fromName)) ? word(clean(fromName)) : `"${clean(fromName).replace(/["\\]/g, '')}"`} <${clean(from)}>`,
    `To: <${clean(to)}>`, ...(replyTo ? [`Reply-To: <${clean(replyTo)}>`] : []),
    `Subject: ${word(clean(subject))}`, `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${clean(from).split('@')[1] || 'localhost'}>`,
    'MIME-Version: 1.0',
    ...(attachments.length ? mixed() : body()),
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
// every account's email and texts go through the platform's own settings (Alpha → Settings → Integrations, or .env)
const envTwilio = () => { const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env; return sid && token && from ? { sid, token, from } : null; };
const smsReady = () => !!envTwilio();
// the platform's own mail server, set in Alpha → Settings → Integrations (e.g. a SiteGround mailbox); it takes priority over the .env settings
const platformSmtp = () => { const m = tenancy.platform().mailServer; return m && m.host && m.user && m.pass ? m : null; };
const serverEmailProvider = () => (platformSmtp() ? 'Mail server' : process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? 'Gmail' : process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM ? 'SendGrid' : '');
const emailProvider = serverEmailProvider;
async function sendgridSend(key, { from, fromName, to, replyTo, subject, text, html, attachments = [] }) {
  const msg = { personalizations: [{ to: [{ email: to }] }], from: { email: from, name: fromName }, subject, content: [{ type: 'text/plain', value: text }, ...(html ? [{ type: 'text/html', value: html }] : [])] };
  if (replyTo) msg.reply_to = { email: replyTo };
  if (attachments.length) msg.attachments = attachments.map((a) => ({ filename: a.name, type: a.type, content: Buffer.from(a.content).toString('base64'), disposition: 'attachment' }));
  const r = await fetch('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(msg) });
  if (r.ok) return;
  const j = await r.json().catch(() => ({}));
  throw new Error(`${r.status}: ${(j.errors || []).map((e) => e.message).join('; ') || 'request rejected'}`);
}
// server: true sends through the server's own settings even inside an account (platform emails, platform tests)
async function sendEmail(to, subject, body, { server = false, replyTo: replyOverride = '', html = '', attachments = [] } = {}) { // attachments: [{ name, type, content }]
  if (!to) return { status: 'failed', detail: 'Client has no email address' };
  const { SENDGRID_API_KEY: key, EMAIL_FROM: from, GMAIL_USER: gUser, GMAIL_APP_PASSWORD: gPass } = process.env;
  // the server's email service is shared by every account. A business's emails (to its clients and team) carry its name, with replies to its email;
  // the platform's own emails (server: true) carry EMAIL_FROM_NAME (else the product name), with replies to EMAIL_REPLY_TO (else the contact email)
  const PS = tenancy.platform().settings;
  const fromName = server ? process.env.EMAIL_FROM_NAME || PS.productName : db.company.name;
  const replyTo = replyOverride || (server ? process.env.EMAIL_REPLY_TO || PS.contactEmail : db.company.email);
  const ms = platformSmtp();
  if (ms) {
    try {
      await smtpSend({ host: ms.host, port: Number(ms.port) || 465, user: ms.user, pass: ms.pass }, { from: ms.from || ms.user, fromName: fromName || db.company.name, to, replyTo: replyTo || db.company.email, subject, text: body, html, attachments });
      return { status: 'sent', detail: `Mail server (${ms.host})` };
    } catch (e) { return { status: 'failed', detail: `Mail server ${ms.host}: ${e.message}${/^535/.test(e.message) ? ' (check the username and password in Alpha → Settings → Integrations)' : ''}` }; }
  }
  if (serverEmailProvider() === 'Gmail') {
    try {
      await smtpSend({ host: 'smtp.gmail.com', port: 465, user: gUser, pass: gPass.replace(/\s/g, '') },
        { from: from || gUser, fromName: fromName || db.company.name, to, replyTo: replyTo || db.company.email, subject, text: body, html, attachments });
      return { status: 'sent', detail: 'Gmail' };
    } catch (e) {
      return { status: 'failed', detail: `Gmail: ${e.message}${/^535/.test(e.message) ? ' (check GMAIL_USER and use a Google app password, not your normal password)' : ''}` };
    }
  }
  if (key && from) {
    try { await sendgridSend(key, { from, fromName: fromName || db.company.name, to, replyTo: replyTo || db.company.email, subject, text: body, html, attachments }); return { status: 'sent', detail: 'SendGrid' }; }
    catch (e) { return { status: 'failed', detail: `SendGrid ${e.message}` }; }
  }
  return { status: 'simulated', detail: server ? 'No email provider set up (Alpha → Settings → Integrations, or GMAIL_* / SENDGRID_* in .env)' : 'Email isn’t set up on this service yet' };
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
// texts a month: each plan's smsLimit (0 = no limit) caps what an account sends through the platform's Twilio number.
// db.smsUsage = { month: 'YYYY-MM', sent, warned, warned80 }; the owner is emailed once a month at 80% (warned80) and once when the limit is reached (warned).
const smsMonth = () => new Date().toISOString().slice(0, 7);
function smsUsage() {
  const plan = tenancy.planOf(tenancy.current()); const u = db.smsUsage && db.smsUsage.month === smsMonth() ? db.smsUsage : { month: smsMonth(), sent: 0 };
  return { sent: u.sent || 0, limit: Number(plan.smsLimit) || 0, plan: plan.name };
}
const SMS_WARN_AT = 0.8; // the owner is told when this share of the month's texts is used (and the app shows a banner)
function smsWarnOwner(title, message) {
  const o = db.users.find((x) => x.role === 'owner');
  if (o && o.email) sendTemplate('accountActivity', o.email, { title, message, link: `${baseUrl()}/settings/billing` }, { server: true }).catch(() => {});
}
// after a text goes out (or before one is blocked): email the owner once a month at 80%, and once when they're all used
function smsWarnings() {
  const u = smsUsage(); if (!u.limit || !db.smsUsage) return;
  const m = smsMonth(); const name = db.company.name || tenancy.current().name; const n = (x) => x.toLocaleString('en-US');
  if (u.sent >= u.limit) {
    if (db.smsUsage.warned === m) return;
    db.smsUsage.warned = m; db.smsUsage.warned80 = m; save();
    smsWarnOwner('You’ve used this month’s text messages', `${name} has sent ${n(u.limit)} text messages this month, which is what the ${u.plan} plan includes. Texts to clients won’t go out until the 1st; emails still do. To send more now, change your plan in Account and billing.`);
  } else if (u.sent >= Math.ceil(u.limit * SMS_WARN_AT) && db.smsUsage.warned80 !== m) {
    db.smsUsage.warned80 = m; save();
    smsWarnOwner(`You’ve used ${Math.floor((u.sent / u.limit) * 100)}% of this month’s text messages`, `${name} has sent ${n(u.sent)} of the ${n(u.limit)} text messages the ${u.plan} plan includes this month, so ${n(u.limit - u.sent)} are left. Once they’re used, texts to clients won’t go out until the 1st; emails still do. To get more, change your plan in Account and billing.`);
  }
}
function smsAtLimit() {
  const u = smsUsage(); if (!u.limit || u.sent < u.limit) return null;
  smsWarnings(); // in case the limit was reached another way (a move to a plan with fewer texts)
  return { status: 'failed', detail: `This month’s ${u.limit.toLocaleString('en-US')} texts on the ${u.plan} plan are used. Texts start again on the 1st, or change plan in Account and billing.` };
}
async function sendSms(to, body, { server = false } = {}) {
  if (!to) return { status: 'failed', detail: 'Client has no phone number' };
  const { sid, token: auth, from } = envTwilio() || {};
  if (sid && auth && from) {
    if (!server) { const full = smsAtLimit(); if (full) return full; }
    try {
      // TWILIO_FROM can be a Twilio phone number or a Messaging Service SID (starts with MG)
      const params = { To: toE164(to), Body: body, ...(from.startsWith('MG') ? { MessagingServiceSid: from } : { From: toE164(from) }) };
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${auth}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && !server) { const m = smsMonth(); if (!db.smsUsage || db.smsUsage.month !== m) db.smsUsage = { month: m, sent: 0, warned: (db.smsUsage || {}).warned || '', warned80: (db.smsUsage || {}).warned80 || '' }; db.smsUsage.sent++; save(); smsWarnings(); }
      return r.ok ? { status: 'sent', detail: `Twilio ${j.sid || ''}`.trim() } : { status: 'failed', detail: `Twilio ${r.status}${j.code ? ' (error ' + j.code + ')' : ''}: ${j.message || 'request rejected'}` };
    } catch (e) { return { status: 'failed', detail: e.message }; }
  }
  return { status: 'simulated', detail: server ? 'No SMS provider configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)' : 'Text messages aren’t set up on this service yet' };
}
// branded short links for texts (<platform domain>/s/<code>): carriers filter public shorteners like bit.ly. Kept in platform.json; one code per address
const SHORT_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // 32 letters, so each random byte maps evenly; no 0/o or 1/l
const shortLinks = () => (tenancy.platform().shortLinks = tenancy.platform().shortLinks || {});
function shortLink(url) {
  const L = shortLinks(); let code = Object.keys(L).find((k) => L[k] === url);
  if (!code) { do code = Array.from(crypto.randomBytes(7), (b) => SHORT_ALPHABET[b % 32]).join(''); while (L[code]); L[code] = url; tenancy.savePlatform(); }
  return `${tenancy.platformUrl()}/s/${code}`;
}
// the one text a client gets right after opting in (A2P 10DLC requires it), whichever way they opted in
async function optInText(c) {
  if (!c || !c.smsConsent || !c.phone || !tenancy.has('sms')) return;
  await notify({ clientId: c.id, channel: 'sms', kind: 'optin', refId: c.id, refNumber: '', subject: '',
    body: `You're signed up for texts about your quotes, invoices and appointments. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.` });
  save();
}
// clients' texts come from the platform (it's the registered A2P 10DLC sender), on behalf of the business: "Worklio Pro for Brightside Cleaning: …"
const smsBrand = () => tenancy.platform().settings.productName || 'Worklio Pro';
const smsSender = () => (db.company.name && db.company.name !== smsBrand() ? `${smsBrand()} for ${db.company.name}` : smsBrand());
const smsBranded = (body) => { const p = `${smsSender()}: `; return String(body).startsWith(p) ? body : p + body; };
async function notify({ clientId, channel, kind, refId, refNumber, subject, body, html = '', to = '', attachments = [] }) { // to: an email address other than the client's (texts always go to the client's number)
  const c = findClient(clientId);
  if (channel === 'sms' && !tenancy.has('sms')) return { id: uid(), at: new Date().toISOString(), clientId, channel, kind, status: 'failed', detail: 'Text messages aren’t included in your plan' };
  // texts only go to clients who agreed to them (A2P 10DLC): ticked on their client profile, or on the booking / referral form
  if (channel === 'sms' && !(c && c.smsConsent)) return { id: uid(), at: new Date().toISOString(), clientId, channel, kind, status: 'failed', detail: 'This client hasn’t agreed to receive text messages' };
  const email = channel === 'email' ? to || (c && c.email) : '';
  if (channel === 'sms') body = smsBranded(body);
  const res = channel === 'email' ? await sendEmail(email, subject, body, { html, attachments }) : await sendSms(c && c.phone, body);
  const entry = { id: uid(), at: new Date().toISOString(), clientId, clientName: c ? c.name : 'Unknown', channel, kind, refId, refNumber, to: channel === 'email' ? email : (c && c.phone), subject: subject || '', body, status: res.status, detail: res.detail };
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
  tenancy.expireIfDue(r.tenant); // its last day of access has passed
  // paused: the team can still log in and look around (read-only, see pausedGuard); clients' quote, pay, portal and booking pages stay closed
  const clientSide = isApi ? req.path.startsWith('/api/portal/') || req.path === '/api/stripe/webhook' : /^\/(p|pay|refer|cal)\/|^\/(client-portal|book)$/.test(req.path);
  if (r.tenant.status === 'suspended' && clientSide) {
    const msg = `${r.tenant.expiredOn ? `This account’s access ended on ${esc(new Date(r.tenant.expiredOn + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}.` : 'This account is paused.'}${P.contactEmail ? ` Contact ${esc(P.contactEmail)} for help.` : ''}`;
    return isApi ? res.status(403).json({ error: r.tenant.expiredOn ? 'This account’s access has ended' : 'This account is paused' }) : res.status(403).send(notice(r.tenant.expiredOn ? 'Access ended' : 'Account paused', msg));
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
const publicUser = (u) => u && { id: u.id, name: u.name, email: u.email, role: u.role, roleName: rolesLib.nameOf(teamRoles(), roleKey(u)), photo: (staffOfUser(u) || u).photo || '' };
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
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.round((expires - now) / 1000)}${BASE_URL.startsWith('https') && !plainLocal(res.req) ? '; Secure' : ''}`);
}
// ideas.<domain> uses the same login: while someone is logged in at <business>.<domain>, a cookie on the whole domain names the business (nothing secret),
// so ideas.<domain> knows where to ask for a one-time pass (GET /ideas/sso). Not on custom domains or while developing (no shared parent domain there)
const IDEAS_HINT = 'wp_acct';
const addCookie = (res, c) => { const h = res.getHeader('Set-Cookie'); res.setHeader('Set-Cookie', [...(h ? [].concat(h) : []), c]); };
const onSubdomain = (req) => !tenancy.devMode && tenancy.hostOnly(req.headers.host || '').endsWith('.' + tenancy.hostOnly(tenancy.ROOT_DOMAIN));
function ideasHint(req, res, on) {
  if (!onSubdomain(req)) return;
  const slug = tenancy.current().slug; if (on && cookies(req)[IDEAS_HINT] === slug) return;
  addCookie(res, `${IDEAS_HINT}=${on ? slug : ''}; Domain=.${tenancy.hostOnly(tenancy.ROOT_DOMAIN)}; Path=/; SameSite=Lax; HttpOnly; Max-Age=${on ? SESSION_DAYS * 86400 : 0}${BASE_URL.startsWith('https') ? '; Secure' : ''}`);
}
// plain http to this Mac or the home network (e.g. a phone testing at http://192.168.x.x:3000): browsers drop Secure cookies there, so login would bounce back to the login page
const plainLocal = (req) => !!req && !req.socket.encrypted && req.headers['x-forwarded-proto'] !== 'https'
  && /^(localhost|[^.]+\.localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(tenancy.hostOnly(req.headers.host || ''));
// simple brute-force guard: 10 failed logins per email+IP in 15 minutes
const failures = new Map();
const tooMany = (key) => { const f = failures.get(key); return f && f.n >= 10 && Date.now() - f.t < 15 * 60e3; };
const recordFailure = (key) => { const f = failures.get(key); failures.set(key, f && Date.now() - f.t < 15 * 60e3 ? { n: f.n + 1, t: f.t } : { n: 1, t: Date.now() }); };

// Everything requires login except what clients use (quote/pay pages, client portal), the login page, and static assets.
const PUBLIC_API = (req) => req.path === '/api/stripe/webhook' || req.path.startsWith('/api/auth/') || req.path.startsWith('/api/portal/') || (req.method === 'GET' && req.path === '/api/company');
app.use((req, res, next) => {
  const p = req.path;
  if (currentUser(req)) ideasHint(req, res, true);
  if (p.startsWith('/api/')) return PUBLIC_API(req) || currentUser(req) ? next() : res.status(401).json({ error: 'Please log in' });
  if (p === '/login' || p === '/login/handoff' || p === '/ideas/sso' || p === '/manifest.webmanifest' || p === '/support-login' || p === '/client-portal' || p.startsWith('/p/') || p.startsWith('/pay/') || p.startsWith('/refer/') || p.startsWith('/cal/') || p === '/book' || p === '/card' || p.startsWith('/card/') || p.startsWith('/uploads/') || /\.(js|css|png|jpe?g|gif|webp|svg|ico)$/i.test(p)) return next();
  if (currentUser(req)) return next();
  res.redirect('/login' + (p !== '/' ? '?next=' + encodeURIComponent(req.url) : ''));
});
// Access: the owner and admins can do everything. Everyone else gets the permissions of their role (lib/roles.js),
// which the business edits in Settings → Roles & Permissions; each permission opens certain pages and API routes.
// Custom roles is a plan feature. Without it there are three levels: Owner, Manager and Team Member (fixed);
// a login whose role isn't one of those (e.g. after a downgrade) gets Team Member access. Existing admins keep full access.
const customRolesOn = () => tenancy.has('customRoles');
const teamRoles = () => (customRolesOn() ? db.roles || [] : rolesLib.fixed());
const roleKey = (u) => (rolesLib.isAdminRole(u.role) || teamRoles().some((r) => r.id === u.role) ? u.role : 'technician');
const roleValid = (r) => (r === 'admin' ? customRolesOn() : teamRoles().some((x) => x.id === r));
const defaultRole = () => (teamRoles().find((r) => r.id === 'technician') || teamRoles()[0] || { id: 'admin' }).id;
const can = (u, key) => !!u && rolesLib.can(teamRoles(), roleKey(u), key);
// a support session works like the owner, but can't change the owner's own login, the subscription, or support access itself
const SUPPORT_BLOCKED = /^\/api\/(auth\/(password|profile|hours|push(\/.*)?|calendar-feed(\/.*)?)|account\/(billing|support-access)(\/.*)?)$/;
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && currentUser(req) && req._support && SUPPORT_BLOCKED.test(req.path)) return res.status(403).json({ error: 'Support sessions can’t change this. Ask the account owner.' });
  next();
});
app.use('/api', (req, res, next) => {
  const u = currentUser(req); if (!u || isAdmin(u) || PUBLIC_API(req)) return next(); // client-facing routes (portal etc.) work for any login, as they do with no login
  if (rolesLib.allows(rolesLib.routesFor(teamRoles(), roleKey(u)), req.method, req.path)) return next();
  res.status(403).json({ error: 'Your access level doesn’t include this. Ask the account owner.' });
});
// a paused account is read-only: anything that creates, changes or deletes is refused, except choosing a plan (owner/admin),
// logging in and out, your own profile, and asking for help. The app sends owners and admins to Account and billing when it sees `paused`.
const PAUSED_OK = /^\/api\/(auth\/.*|account\/(billing|support-access)(\/.*)?|support|feedback|help\/.*|chat\/.*)$/;
const isPaused = () => tenancy.current().status === 'suspended';
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || !isPaused() || PAUSED_OK.test(req.path)) return next();
  const u = currentUser(req);
  res.status(403).json({ error: isAdmin(u) ? 'Your account is paused. Choose a plan to make changes again.' : 'Your company’s account is paused. Contact your company owner or admin.', paused: true });
});
// features the account's plan doesn't include: lists come back empty (so pages still load), everything else is refused
app.use('/api', (req, res, next) => {
  const f = tenancy.lockedFeatureFor(tenancy.current(), req.method, req.path); if (!f) return next();
  if (req.method === 'GET' && /^\/api\/[a-z-]+$/.test(req.path) && COLLECTIONS.includes(req.path.slice(5))) return res.json([]);
  res.status(403).json({ error: `${f.label} isn’t included in your ${tenancy.planOf(tenancy.current()).name} plan`, upgrade: f.key });
});
// without the "See prices on jobs" permission, jobs come without prices, totals or line items
const isMemberReq = (req) => { const u = currentUser(req); return !!u && !can(u, 'jobs.prices'); };
// what a team member may see/change on a job: no prices, totals or line items
const MONEY_KEYS = ['items', 'subtotal', 'discount', 'discountType', 'discountValue', 'discountName', 'tax', 'total', 'taxRate', 'depositType', 'depositValue', 'depositFee'];
const jobForMember = (j) => Object.fromEntries(Object.entries(j).filter(([k]) => !MONEY_KEYS.includes(k)));
// the portal link opens the client's quotes and invoices with prices, so only logins that can see prices get it (hides Log in as Client)
const clientForMember = (c) => { const { portalToken, ...rest } = c; return rest; };
const MEMBER_JOB_FIELDS = ['title', 'clientId', 'address', 'propertyId', 'date', 'startTime', 'endTime', 'anytime', 'staffIds', 'status', 'description', 'internalNotes'];

// ---------- team logins (owner/admin only; the /api guard above blocks members) ----------
const INVITE_DAYS = 7;
const userRow = (u) => ({ ...publicUser(u), staffId: u.staffId || null, status: u.passwordHash ? 'active' : 'invited', invitedAt: u.invitedAt || null, lastLoginAt: u.lastLoginAt || null });
app.get('/api/users', (req, res) => res.json(db.users.map(userRow)));
// ---------- Time off (a plan feature): team members ask for time off; the owner, admins and anyone who can edit jobs approve it ----------
// A request covers whole days (from–to) or some hours of one day. Approving can take the person off the jobs they're assigned to then.
const t12 = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`; };
const timeOffWhen = (r) => (r.from === r.to ? niceDate(r.from) : `${niceDate(r.from)} to ${niceDate(r.to)}`) + (r.start ? `, ${t12(r.start)}–${t12(r.end)}` : '');
const canApproveTimeOff = (u) => isAdmin(u) || can(u, 'jobs.edit');
// jobs this person is on during the request (not cancelled or done)
const timeOffJobs = (staffId, r) => db.jobs.filter((j) => (j.staffIds || []).includes(staffId) && !['cancelled', 'completed'].includes(j.status) && j.date >= r.from && j.date <= r.to
  && (!r.start || (j.startTime < r.end && (j.endTime || j.startTime) > r.start)));
const timeOffRow = (r, u) => { const s = db.staff.find((x) => x.id === r.staffId); const mine = u && u.staffId === r.staffId; const full = mine || canApproveTimeOff(u);
  return { id: r.id, staffId: r.staffId, person: s ? s.name : 'Former team member', color: s ? s.color : '', from: r.from, to: r.to, start: r.start || '', end: r.end || '', status: r.status, when: timeOffWhen(r), mine,
    ...(full ? { reason: r.reason, note: r.note || '', createdAt: r.createdAt, decidedBy: r.decidedBy || '', decidedAt: r.decidedAt || '', jobs: timeOffJobs(r.staffId, r).map((j) => ({ id: j.id, number: j.number, title: j.title, date: j.date, startTime: j.startTime })) } : {}) }; };
app.get('/api/time-off', (req, res) => {
  const u = currentUser(req); db.timeOff = db.timeOff || []; const approver = canApproveTimeOff(u);
  // everyone sees who's off (approved) on the schedule; requests themselves: your own, or all of them if you approve
  const list = db.timeOff.filter((r) => r.status === 'approved' || approver || r.staffId === u.staffId).sort((a, b) => (b.status === 'pending') - (a.status === 'pending') || b.from.localeCompare(a.from)); // waiting ones first, then newest dates
  res.json({ approver, canRequest: !!db.staff.find((s) => s.id === u.staffId), requests: list.slice(0, 300).map((r) => timeOffRow(r, u)) });
});
app.post('/api/time-off', async (req, res) => {
  const u = currentUser(req); const s = db.staff.find((x) => x.id === u.staffId); if (!s) return res.status(400).json({ error: 'Your login isn’t linked to a team member. Ask the owner.' });
  const b = req.body || {}; const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || ''); const tm = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t || '');
  const from = b.from; const to = b.allDay === false ? b.from : b.to || b.from;
  if (!ok(from) || !ok(to)) return res.status(400).json({ error: 'Choose the dates you’ll be off' });
  if (to < from) return res.status(400).json({ error: 'The last day can’t be before the first day' });
  if (from < iso(new Date())) return res.status(400).json({ error: 'Time off can’t start in the past' });
  if ((Date.parse(to) - Date.parse(from)) / 864e5 > 90) return res.status(400).json({ error: 'Ask for up to 90 days at a time' });
  const part = b.allDay === false; if (part && (!tm(b.start) || !tm(b.end) || b.end <= b.start)) return res.status(400).json({ error: 'Choose a start time and a later end time' });
  const reason = String(b.reason || '').trim().slice(0, 500); if (!reason) return res.status(400).json({ error: 'Add a short reason' });
  db.timeOff = db.timeOff || [];
  if (db.timeOff.some((r) => r.staffId === s.id && ['pending', 'approved'].includes(r.status) && r.from <= to && r.to >= from && (!part || !r.start || (r.start < b.end && r.end > b.start)))) return res.status(400).json({ error: 'You already asked for time off then' });
  const r = { id: uid(), staffId: s.id, userId: u.id, from, to, start: part ? b.start : '', end: part ? b.end : '', reason, status: 'pending', createdAt: new Date().toISOString(), jobId: String(b.jobId || '') };
  db.timeOff.push(r); save();
  // tell everyone who can approve it (not the person asking)
  const jobs = timeOffJobs(s.id, r); const jobsText = jobs.length ? `They’re assigned to ${jobs.length} job${jobs.length === 1 ? '' : 's'} then: ${jobs.map((j) => `${j.number} ${j.title} (${niceDate(j.date)})`).join('; ')}.` : 'They aren’t assigned to any jobs then.';
  for (const a of db.users.filter((x) => x.id !== u.id && x.passwordHash && x.email && canApproveTimeOff(x) && !staffBlocked(x))) {
    sendTemplate('timeOffRequested', a.email, { name: a.name.split(/\s+/)[0], person: s.name, when: timeOffWhen(r), reason, jobs: jobsText, business: db.company.name, link: `${baseUrl()}/requests` }).catch(() => {});
  }
  res.status(201).json(timeOffRow(r, u));
});
app.post('/api/time-off/:id/decide', async (req, res) => {
  const u = currentUser(req); if (!canApproveTimeOff(u)) return res.status(403).json({ error: 'Ask the owner, an admin or a manager to decide this' });
  const r = (db.timeOff || []).find((x) => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'Request not found' });
  if (r.status !== 'pending') return res.status(400).json({ error: `This request was already ${r.status}` });
  if (r.staffId === u.staffId && !isAdmin(u)) return res.status(403).json({ error: 'Someone else needs to decide your own request' });
  const b = req.body || {}; const approve = !!b.approve;
  Object.assign(r, { status: approve ? 'approved' : 'declined', note: String(b.note || '').trim().slice(0, 500), decidedBy: u.name, decidedAt: new Date().toISOString() });
  let removed = 0; if (approve && b.unassign) for (const j of timeOffJobs(r.staffId, r)) { j.staffIds = j.staffIds.filter((x) => x !== r.staffId); removed++; }
  save();
  const who = db.users.find((x) => x.id === r.userId) || db.users.find((x) => x.staffId === r.staffId);
  if (who && who.email) sendTemplate('timeOffDecided', who.email, { name: who.name.split(/\s+/)[0], decision: approve ? 'approved' : 'declined', when: timeOffWhen(r), note: r.note ? `> ${r.note}` : '', decider: u.name, business: db.company.name, link: `${baseUrl()}/requests` }).catch(() => {});
  res.json({ ...timeOffRow(r, u), removedFrom: removed });
});
// cancel your own request (before it starts); approvers can cancel anyone's approved time off too
app.post('/api/time-off/:id/cancel', (req, res) => {
  const u = currentUser(req); const r = (db.timeOff || []).find((x) => x.id === req.params.id); if (!r) return res.status(404).json({ error: 'Request not found' });
  if (r.staffId !== u.staffId && !canApproveTimeOff(u)) return res.status(403).json({ error: 'You can only cancel your own time off' });
  if (!['pending', 'approved'].includes(r.status)) return res.status(400).json({ error: `This request was already ${r.status}` });
  if (r.to < iso(new Date())) return res.status(400).json({ error: 'This time off is already over' });
  r.status = 'canceled'; r.canceledBy = u.name; save(); res.json(timeOffRow(r, u));
});

// ---------- Time tracking & timesheets (a plan feature) ----------
// Every team member clocks in and out (on a job, or without one for shop time, travel and the like). The owner, admins and anyone who can
// edit jobs see everyone's time, add and fix entries, and approve them for payroll. Pay rates are kept apart from the team list (which every
// login can read) and only the owner and admins see or set them; they turn hours on a job into labor cost in Financial reports → Job profit.
// db.timeEntries: { id, staffId, jobId, start, end (null while on the clock), note, approvedAt, approvedBy, createdAt, editedBy }
const canManageTime = (u) => isAdmin(u) || can(u, 'jobs.edit');
const timeList = () => (db.timeEntries = db.timeEntries || []);
const payRates = () => (db.payRates = db.payRates || {});
const openEntry = (staffId) => staffId && timeList().find((e) => e.staffId === staffId && !e.end);
const entryHours = (e) => Math.max(0, ((e.end ? new Date(e.end) : new Date()) - new Date(e.start)) / 36e5);
const timeRow = (e, u) => { const j = e.jobId && db.jobs.find((x) => x.id === e.jobId); const s = db.staff.find((x) => x.id === e.staffId);
  return { ...e, person: s ? s.name : 'Former team member', color: s ? s.color : '', job: j ? { id: j.id, number: j.number, title: j.title || '' } : null, hours: Math.round(entryHours(e) * 100) / 100,
    ...(isAdmin(u) ? { rate: Number(payRates()[e.staffId]) || 0 } : {}) }; };
const timeWhen = (v, label) => { const d = new Date(v); if (!v || isNaN(d)) throw Object.assign(new Error(`Enter the ${label} time`), { status: 400 }); return d.toISOString(); };
// labor cost per job from time logged to it, at each person's pay rate (Job profit report)
const laborByJob = () => { const r = payRates(); const out = {}; for (const e of timeList()) if (e.jobId && e.end && r[e.staffId]) out[e.jobId] = (out[e.jobId] || 0) + entryHours(e) * Number(r[e.staffId]); return out; };
app.get('/api/time/status', (req, res) => { const u = currentUser(req); const e = openEntry(u.staffId); res.json({ canClock: !!db.staff.find((s) => s.id === u.staffId), open: e ? timeRow(e, u) : null }); });
app.get('/api/time', (req, res) => {
  const u = currentUser(req); const manager = canManageTime(u);
  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 7 * 864e5); const to = req.query.to ? new Date(req.query.to) : new Date();
  // entries that overlap the range; team members get only their own
  const list = timeList().filter((e) => (manager || e.staffId === u.staffId) && new Date(e.start) < to && (!e.end || new Date(e.end) > from)).sort((a, b) => a.start.localeCompare(b.start));
  res.json({ manager, admin: isAdmin(u), staffId: u.staffId || null, canClock: !!db.staff.find((s) => s.id === u.staffId), open: openEntry(u.staffId) ? timeRow(openEntry(u.staffId), u) : null,
    entries: list.slice(0, 3000).map((e) => timeRow(e, u)), ...(isAdmin(u) ? { rates: payRates() } : {}) });
});
// clock in, on a job or not; clocking in again while on the clock switches: the open entry ends now and a new one starts
app.post('/api/time/clock-in', (req, res) => {
  const u = currentUser(req); if (!db.staff.find((s) => s.id === u.staffId)) return res.status(400).json({ error: 'Your login isn’t linked to a team member, so there’s no timesheet to clock in on' });
  const jobId = String((req.body || {}).jobId || ''); const j = jobId && db.jobs.find((x) => x.id === jobId); if (jobId && !j) return res.status(404).json({ error: 'Job not found' });
  if (j && !canManageTime(u) && !(j.staffIds || []).includes(u.staffId)) return res.status(403).json({ error: 'You can only clock in on jobs you’re assigned to' });
  const now = new Date().toISOString(); const was = openEntry(u.staffId);
  if (was && (was.jobId || '') === jobId) return res.json({ open: timeRow(was, u) });
  if (was) was.end = now;
  const e = { id: uid(), staffId: u.staffId, jobId, start: now, end: null, note: '', approvedAt: null, approvedBy: '', createdAt: now }; timeList().push(e); save();
  res.status(201).json({ open: timeRow(e, u), switched: was ? timeRow(was, u) : null });
});
app.post('/api/time/clock-out', (req, res) => {
  const u = currentUser(req); const e = openEntry(u.staffId); if (!e) return res.status(400).json({ error: 'You’re not clocked in' });
  e.end = new Date().toISOString(); const note = String((req.body || {}).note || '').trim().slice(0, 500); if (note) e.note = note; save(); res.json({ entry: timeRow(e, u) });
});
// managers: add, fix and remove anyone's entries; a change to an approved entry needs approving again
const manageTime = (fn) => (req, res) => { const u = currentUser(req); if (!canManageTime(u)) return res.status(403).json({ error: 'Only managers can change timesheets' }); try { fn(req, res, u, req.body || {}); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
const fillEntry = (e, b, u) => {
  if (b.staffId !== undefined) { if (!db.staff.find((s) => s.id === b.staffId)) throw Object.assign(new Error('Choose a team member'), { status: 400 }); e.staffId = b.staffId; }
  if (b.jobId !== undefined) { if (b.jobId && !db.jobs.find((x) => x.id === b.jobId)) throw Object.assign(new Error('Job not found'), { status: 404 }); e.jobId = b.jobId || ''; }
  if (b.start !== undefined) e.start = timeWhen(b.start, 'start');
  if (b.end !== undefined) e.end = b.end ? timeWhen(b.end, 'end') : null;
  if (b.note !== undefined) e.note = String(b.note || '').trim().slice(0, 500);
  if (e.end && e.end <= e.start) throw Object.assign(new Error('The end time has to be after the start time'), { status: 400 });
  if (entryHours(e) > 24) throw Object.assign(new Error('An entry can’t be longer than 24 hours. Split it into one entry per day.'), { status: 400 });
  if (!e.end && timeList().some((x) => x !== e && x.staffId === e.staffId && !x.end)) throw Object.assign(new Error('This person is already on the clock. Give this entry an end time.'), { status: 400 });
  e.approvedAt = null; e.approvedBy = ''; e.editedBy = u.name;
};
app.post('/api/time', manageTime((req, res, u, b) => { const e = { id: uid(), staffId: '', jobId: '', start: '', end: null, note: '', createdAt: new Date().toISOString() }; if (!b.staffId) b.staffId = ''; fillEntry(e, { jobId: '', ...b }, u); timeList().push(e); save(); res.status(201).json(timeRow(e, u)); }));
// pay rates (owner and admins): dollars an hour per team member
app.put('/api/time/rates', (req, res) => {
  const u = currentUser(req); if (!isAdmin(u)) return res.status(403).json({ error: 'Only the owner and admins can set pay rates' });
  const r = (req.body || {}).rates || {}; const out = {};
  for (const s of db.staff) { const v = Number(r[s.id]); if (r[s.id] !== undefined && r[s.id] !== '' && (!isFinite(v) || v < 0 || v > 10000)) return res.status(400).json({ error: `Enter ${s.name}’s pay rate in dollars an hour` }); if (v > 0) out[s.id] = Math.round(v * 100) / 100; }
  db.payRates = out; save(); res.json({ rates: out });
});
app.put('/api/time/:id', manageTime((req, res, u, b) => { const e = timeList().find((x) => x.id === req.params.id); if (!e) return res.status(404).json({ error: 'Entry not found' }); const was = { ...e }; try { fillEntry(e, b, u); } catch (x) { Object.assign(e, was); throw x; } save(); res.json(timeRow(e, u)); }));
app.delete('/api/time/:id', manageTime((req, res) => { const i = timeList().findIndex((x) => x.id === req.params.id); if (i < 0) return res.status(404).json({ error: 'Entry not found' }); timeList().splice(i, 1); save(); res.json({ ok: true }); }));
// approve finished entries for payroll (ids from the page: the week, one person's week, or one entry)
app.post('/api/time/approve', manageTime((req, res, u, b) => {
  const ids = new Set(Array.isArray(b.ids) ? b.ids : []); const now = new Date().toISOString(); let n = 0;
  for (const e of timeList()) if (ids.has(e.id) && e.end && !e.approvedAt) { e.approvedAt = now; e.approvedBy = u.name; n++; }
  save(); res.json({ approved: n });
}));

// ---------- Recurring jobs (a plan feature) ----------
// A job repeats on a rule: every N days, every N weeks on chosen weekdays, or every N months (on the same date, or the same weekday, e.g.
// the 2nd Tuesday or the last Friday). Each visit is an ordinary job (its own number, team, time, invoices, timesheet hours) linked by seriesId,
// so the calendar, client portal, reminders and reports work unchanged. Visits are made ahead (2 months for daily, 6 for weekly, 12 for
// monthly) and the hourly tick tops them up while the series runs. Deleting one visit skips it; it doesn't come back.
// db.jobSeries: { id, rule: { freq: day|week|month, every, days (weekly, 0 = Sunday), monthBy (monthly: date|weekday), end: never|count|until, count, until },
//   start (first visit's date), through (latest visit made), made (visits made), template (job fields copied to new visits), ended, createdAt, createdBy }
const SERIES_FIELDS = ['title', 'clientId', 'address', 'propertyId', 'startTime', 'endTime', 'anytime', 'staffIds', 'description', 'items', 'taxRate', 'discountType', 'discountValue', 'discountName', 'membershipId'];
const seriesList = () => (db.jobSeries = db.jobSeries || []);
const findSeries = (id) => id && seriesList().find((s) => s.id === id);
const pickSeries = (j, keys = SERIES_FIELDS) => Object.fromEntries(keys.filter((k) => j[k] !== undefined).map((k) => [k, structuredClone(j[k])]));
const repeatBad = (m) => Object.assign(new Error(m), { status: 400 });
const dayUTC = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const ymdUTC = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const addDaysYmd = (s, n) => { const d = dayUTC(s); return ymdUTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n); };
function cleanRepeatRule(r, start) {
  r = r || {}; const freq = r.freq; if (!['day', 'week', 'month'].includes(freq)) throw repeatBad('Choose how often the job repeats');
  const max = { day: 365, week: 52, month: 24 }[freq]; const every = Math.floor(Number(r.every) || 1);
  if (every < 1 || every > max) throw repeatBad(`Repeat every 1 to ${max} ${freq}s`);
  const out = { freq, every };
  if (freq === 'week') { const days = [...new Set((Array.isArray(r.days) ? r.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(); out.days = days.length ? days : [dayUTC(start).getUTCDay()]; }
  if (freq === 'month') { out.monthBy = r.monthBy === 'weekday' ? 'weekday' : 'date'; const n = Math.ceil(dayUTC(start).getUTCDate() / 7); if (out.monthBy === 'weekday') out.nth = Number(r.nth) === -1 || n >= 5 ? -1 : n; } // nth: which weekday of the month (-1 the last)
  out.end = ['count', 'until'].includes(r.end) ? r.end : 'never';
  if (out.end === 'count') { out.count = Math.floor(Number(r.count)); if (!(out.count >= 2 && out.count <= 500)) throw repeatBad('A repeating job ends after 2 to 500 visits'); }
  if (out.end === 'until') { out.until = String(r.until || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(out.until) || isNaN(dayUTC(out.until))) throw repeatBad('Choose the date the job stops repeating'); if (out.until <= start) throw repeatBad('The end date has to be after the first visit'); if (out.until > addDaysYmd(start, 5 * 366)) throw repeatBad('Repeat for 5 years at most'); }
  return out;
}
// the series' dates in order, from its first visit
function* repeatDates(rule, start) {
  const s = dayUTC(start); const Y = s.getUTCFullYear(); const M = s.getUTCMonth(); const D0 = s.getUTCDate();
  for (let k = 0; k < 20000; k++) {
    if (rule.freq === 'day') yield ymdUTC(Y, M, D0 + k * rule.every);
    else if (rule.freq === 'week') { if (k % rule.every) continue; const sun = D0 - s.getUTCDay() + k * 7; for (const d of rule.days) { const v = ymdUTC(Y, M, sun + d); if (v >= start) yield v; } }
    else {
      if (k % rule.every) continue; const last = new Date(Date.UTC(Y, M + k + 1, 0)).getUTCDate();
      if (rule.monthBy !== 'weekday') { yield ymdUTC(Y, M + k, Math.min(D0, last)); continue; }
      const nth = rule.nth || Math.ceil(D0 / 7); const off = (s.getUTCDay() - new Date(Date.UTC(Y, M + k, 1)).getUTCDay() + 7) % 7; // the 5th one is "the last" (not every month has one)
      yield ymdUTC(Y, M + k, nth === -1 || nth >= 5 ? 1 + off + 7 * Math.floor((last - 1 - off) / 7) : 1 + off + (nth - 1) * 7);
    }
  }
}
// make the visits that are due up to the horizon; returns how many were made
function fillSeries(s) {
  if (s.ended) return 0; const today = localNow().date; const horizon = addDaysYmd(today > s.through ? today : s.through, { day: 62, week: 183, month: 366 }[s.rule.freq]); let n = 0;
  for (const d of repeatDates(s.rule, s.start)) {
    if (d <= s.through) continue;
    if ((s.rule.end === 'until' && d > s.rule.until) || (s.rule.end === 'count' && s.made >= s.rule.count)) { s.ended = true; break; }
    if (d > horizon || n >= 200) break;
    if (db.jobs.some((x) => x.seriesId === s.id && x.date === d)) { s.made++; s.through = d; continue; } // a visit kept from before a change of rule is already on that day
    const job = autoForms({ ...structuredClone(s.template), id: uid(), number: nextNumber('jobs'), date: d, status: 'scheduled', seriesId: s.id, createdAt: iso(new Date()) });
    if (Array.isArray(job.items) && job.items.length) computeTotals(job);
    db.jobs.push(job); s.made++; s.through = d; n++;
  }
  return n;
}
// a visit nobody has worked on yet: changing or stopping the repeat removes it (visits with invoices, hours, a signature, notes or photos stay)
const untouchedVisit = (j) => j.status === 'scheduled' && !j.signature && !(j.noteEntries || []).length && !db.invoices.some((i) => i.jobId === j.id) && !timeList().some((e) => e.jobId === j.id) && !(db.photos || []).some((p) => p.jobId === j.id);
function dropFollowing(j) {
  const later = db.jobs.filter((x) => x.seriesId === j.seriesId && x.id !== j.id && x.date > j.date); const gone = new Set(later.filter(untouchedVisit).map((x) => x.id));
  db.jobs = db.jobs.filter((x) => !gone.has(x.id)); return { removed: gone.size, kept: later.length - gone.size };
}
const forgetEmptySeries = (id) => { if (id && !db.jobs.some((x) => x.seriesId === id)) db.jobSeries = seriesList().filter((s) => s.id !== id); };
// what the job pages show: the rule, and where this visit falls in the series
function repeatInfo(j) {
  const s = findSeries(j.seriesId); if (!s) return null; const all = db.jobs.filter((x) => x.seriesId === s.id).sort((a, b) => a.date.localeCompare(b.date));
  const next = all.find((x) => x.date > j.date && x.status === 'scheduled');
  return { rule: s.rule, start: s.start, ended: !!s.ended, index: all.findIndex((x) => x.id === j.id) + 1, visits: all.length, next: next ? { id: next.id, date: next.date } : null };
}
const withRepeat = (j) => (j && j.seriesId ? { ...j, repeat: repeatInfo(j) } : j);
// start repeating from this job, or change the repeat from this visit on (following visits nobody has worked on are made again on the new rule)
app.post('/api/jobs/:id/repeat', (req, res) => {
  const j = db.jobs.find((x) => x.id === req.params.id); if (!j) return res.status(404).json({ error: 'Job not found' });
  if (j.status === 'cancelled') return res.status(400).json({ error: 'A cancelled job can’t repeat' }); if (!j.date) return res.status(400).json({ error: 'Give the job a date first' });
  let rule; try { rule = cleanRepeatRule((req.body || {}).rule, j.date); } catch (e) { return res.status(e.status || 500).json({ error: e.message }); }
  let removed = 0; let kept = 0; const old = findSeries(j.seriesId);
  if (old) { ({ removed, kept } = dropFollowing(j)); delete old.rule.count; Object.assign(old.rule, { end: 'until', until: addDaysYmd(j.date, -1) }); old.ended = true; }
  const s = { id: uid(), rule, start: j.date, through: j.date, made: 1, template: pickSeries(j), ended: false, createdAt: new Date().toISOString(), createdBy: (currentUser(req) || {}).name || '' };
  seriesList().push(s); if (old) db.jobs.forEach((x) => { if (x.seriesId === old.id && x.date > j.date) x.seriesId = s.id; }); j.seriesId = s.id; if (old) forgetEmptySeries(old.id); // visits kept (they have work on them) go on with the new repeat
  const created = fillSeries(s); save(); res.json({ created, removed, kept, job: withRepeat(j) });
});
// stop repeating after this visit: following visits nobody has worked on are removed
app.delete('/api/jobs/:id/repeat', (req, res) => {
  const j = db.jobs.find((x) => x.id === req.params.id); if (!j) return res.status(404).json({ error: 'Job not found' }); const s = findSeries(j.seriesId);
  if (!s) return res.status(400).json({ error: 'This job doesn’t repeat' });
  const r = dropFollowing(j); delete s.rule.count; Object.assign(s.rule, { end: 'until', until: j.date }); s.ended = true; save(); res.json(r);
});
// job edits saved for "this and following visits" (?following=title,staffIds…: the fields that changed): they change on later scheduled visits,
// and on visits made from now on; other fields a later visit was given on its own stay
function applyToFollowing(doc, upd, list) {
  const s = findSeries(doc.seriesId); if (!s) return 0; const want = String(list || '').split(','); const keys = SERIES_FIELDS.filter((k) => k in upd && want.includes(k)); if (!keys.length) return 0;
  Object.assign(s.template, pickSeries(doc, keys)); let n = 0;
  for (const o of db.jobs) if (o.seriesId === s.id && o.id !== doc.id && o.date > doc.date && o.status === 'scheduled') { Object.assign(o, pickSeries(doc, keys)); if (Array.isArray(o.items) && o.items.length) computeTotals(o); n++; }
  return n;
}
// hourly: top up running series (a series whose client was deleted stops)
function extendSeries() {
  for (const t of tenancy.platform().tenants) {
    if (t.status !== 'active') continue;
    tenancy.run(t, () => {
      if (!(tenancy.has('recurringJobs') || tenancy.has('servicePlans')) || !(db.jobSeries || []).some((s) => !s.ended)) return; let n = 0; // service plans' visits are repeating jobs too
      for (const s of db.jobSeries) if (!s.ended) { if (!findClient(s.template.clientId)) { s.ended = true; n++; } else n += fillSeries(s); }
      if (n) save();
    });
  }
}

// ---------- Service plans & memberships (a plan feature) ----------
// A service plan is what the business sells on repeat: a price billed every month, quarter or year, the visits it includes (e.g. 2 tune-ups a
// year) and a member discount on other work. A client on a plan is a membership: its visits are a repeating job series (Recurring jobs), and an
// invoice is made at the start of each billing period (emailed with the pay link when Auto-send is on). Members' new quotes and invoices get
// the plan's discount. Canceling stops the billing and removes upcoming visits nobody has worked on.
// db.servicePlans: { id, name, description, price, interval: month|quarter|year, visitsPerYear, visitTitle, visitHours, discount, taxable, archived, createdAt }
// db.memberships: { id, clientId, planId, name, price, interval, visitsPerYear, discount, taxable (copied from the plan when they joined), start,
//   nextBill, bills (invoices made), autoSend, seriesId, status: active|canceled, createdAt, createdBy, canceledAt, canceledBy }
const PLAN_MONTHS = { month: 1, quarter: 3, year: 12 };
const VISITS_PER_YEAR = [0, 1, 2, 3, 4, 6, 12];
const svcPlans = () => (db.servicePlans = db.servicePlans || []);
const memberships = () => (db.memberships = db.memberships || []);
const addMonthsYmd = (s, n) => { const d = dayUTC(s); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n + 1, 0)).getUTCDate(); return ymdUTC(d.getUTCFullYear(), d.getUTCMonth() + n, Math.min(d.getUTCDate(), last)); };
const ymdOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(dayUTC(s));
function cleanPlan(b) {
  const name = String(b.name || '').trim().slice(0, 80); if (!name) throw repeatBad('Give the plan a name');
  const price = Math.round(Number(b.price) * 100) / 100; if (!isFinite(price) || price < 0 || price > 100000) throw repeatBad('Enter the plan’s price');
  const interval = PLAN_MONTHS[b.interval] ? b.interval : 'month'; const visitsPerYear = VISITS_PER_YEAR.includes(Number(b.visitsPerYear)) ? Number(b.visitsPerYear) : 0;
  const visitHours = Math.min(12, Math.max(0.5, Number(b.visitHours) || 2)); const discount = Math.min(100, Math.max(0, Math.round((Number(b.discount) || 0) * 100) / 100));
  return { name, description: String(b.description || '').trim().slice(0, 1000), price, interval, visitsPerYear, visitTitle: String(b.visitTitle || '').trim().slice(0, 120), visitHours, discount, taxable: !!b.taxable, archived: !!b.archived };
}
// the biggest discount among a client's active plans (0 without the feature or a plan)
// the discount's label on totals: its saved name (or "Discount"), plus the percentage. Plain text: escape it for HTML.
const discLabel = (d) => `${d.discountName || 'Discount'}${d.discountType === 'percent' ? ` (${d.discountValue}%)` : ''}`;
const memberDiscount = (clientId) => (tenancy.has('servicePlans') ? Math.max(0, ...memberships().filter((m) => m.clientId === clientId && m.status === 'active').map((m) => Number(m.discount) || 0)) : 0);
const applyMemberDiscount = (doc) => { if (Number(doc.discountValue) > 0 || doc.membershipId) return; const pct = memberDiscount(doc.clientId); if (pct) { doc.discountType = 'percent'; doc.discountValue = pct; doc.memberDiscount = true; } };
const nextVisit = (m) => { const today = localNow().date; return m.seriesId ? db.jobs.filter((j) => j.seriesId === m.seriesId && j.status === 'scheduled' && j.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] : null; };
const membershipRow = (m) => { const c = findClient(m.clientId); const v = nextVisit(m); const invs = db.invoices.filter((i) => i.membershipId === m.id);
  return { ...m, client: c ? c.name : 'Deleted client', nextVisit: v ? { id: v.id, date: v.date } : null, invoices: invs.length, unpaid: round2(invs.filter((i) => i.status !== 'draft').reduce((s, i) => s + invoiceCredits(i).balanceDue, 0)) }; };
const monthly = (m) => (Number(m.price) || 0) / PLAN_MONTHS[m.interval];
// make the invoices that are due (one per billing period), and email them when the membership says so
function billMembership(m) {
  const today = localNow().date; const made = [];
  while (m.status === 'active' && m.nextBill && m.nextBill <= today && made.length < 12) {
    const c = findClient(m.clientId); if (!c) { m.status = 'canceled'; m.canceledAt = new Date().toISOString(); m.canceledBy = 'Client deleted'; break; }
    const from = m.nextBill; const to = addDaysYmd(addMonthsYmd(m.start, (m.bills + 1) * PLAN_MONTHS[m.interval]), -1);
    const terms = Number(c.paymentTerms) || 0;
    const inv = computeTotals({ id: uid(), number: nextNumber('invoices'), clientId: c.id, membershipId: m.id, subject: `${m.name} service plan`, status: 'draft', issueDate: from, dueDate: addDaysYmd(from, terms), paymentTerms: String(terms),
      paidAt: null, token: token(), createdAt: iso(new Date()), notes: '', disclaimer: db.company.invoiceDisclaimer ?? '', taxRate: m.taxable ? db.company.taxRate : 0, discountType: 'flat', discountValue: 0,
      items: [{ desc: `${m.name} service plan`, details: `${niceDate(from)} – ${niceDate(to)}`, qty: 1, cost: m.price, markup: 0, markupType: 'percent', price: m.price }] });
    db.invoices.push(inv); made.push(inv); m.bills++; m.nextBill = addMonthsYmd(m.start, m.bills * PLAN_MONTHS[m.interval]);
    if (m.autoSend && c.email) { inv.status = 'sent'; const email = renderEmail('invoice', docVars('invoice', inv));
      notify({ clientId: c.id, channel: 'email', kind: 'invoice', refId: inv.id, refNumber: inv.number, subject: email.subject, html: email.html, body: email.body }).catch((e) => console.error('service plan invoice email:', e.message)); }
  }
  return made;
}
// hourly: bill the memberships that are due
function billMemberships() {
  for (const t of tenancy.platform().tenants) {
    if (t.status !== 'active') continue;
    tenancy.run(t, () => { if (!tenancy.has('servicePlans') || !(db.memberships || []).some((m) => m.status === 'active')) return; let n = 0; for (const m of db.memberships) n += billMembership(m).length; if (n) save(); });
  }
}
const planView = () => ({ plans: svcPlans().map((p) => ({ ...p, members: memberships().filter((m) => m.planId === p.id && m.status === 'active').length })),
  memberships: memberships().map(membershipRow).sort((a, b) => (a.status === b.status ? a.client.localeCompare(b.client) : a.status === 'active' ? -1 : 1)),
  mrr: round2(memberships().filter((m) => m.status === 'active').reduce((s, m) => s + monthly(m), 0)) });
const planRoute = (fn) => (req, res) => { try { fn(req, res, req.body || {}); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
app.get('/api/service-plans', (req, res) => res.json(planView()));
app.post('/api/service-plans', planRoute((req, res, b) => { const p = { id: uid(), ...cleanPlan(b), createdAt: new Date().toISOString() }; svcPlans().push(p); save(); res.status(201).json(p); }));
// a plan's changes apply to clients who join from now on; current members keep the price and terms they joined with
app.put('/api/service-plans/:id', planRoute((req, res, b) => { const p = svcPlans().find((x) => x.id === req.params.id); if (!p) return res.status(404).json({ error: 'Plan not found' }); Object.assign(p, cleanPlan({ ...p, ...b })); save(); res.json(p); }));
app.delete('/api/service-plans/:id', (req, res) => {
  const i = svcPlans().findIndex((x) => x.id === req.params.id); if (i < 0) return res.status(404).json({ error: 'Plan not found' });
  if (memberships().some((m) => m.planId === req.params.id)) return res.status(400).json({ error: 'Clients have been on this plan, so it can’t be deleted. Archive it instead: nobody new can join it.' });
  svcPlans().splice(i, 1); save(); res.json({ ok: true });
});
// put a client on a plan: their first bill (on the start date, or now when that's today or earlier) and their visits from the first visit date
app.post('/api/memberships', planRoute((req, res, b) => {
  const c = findClient(b.clientId); if (!c) return res.status(400).json({ error: 'Choose a client' });
  const p = svcPlans().find((x) => x.id === b.planId && !x.archived); if (!p) return res.status(400).json({ error: 'Choose a service plan' });
  const today = localNow().date; const start = ymdOk(b.start) ? b.start : today;
  const m = { id: uid(), clientId: c.id, planId: p.id, name: p.name, price: p.price, interval: p.interval, visitsPerYear: p.visitsPerYear, discount: p.discount, taxable: p.taxable, start, nextBill: start, bills: 0,
    autoSend: b.autoSend !== false && !!c.email, seriesId: '', status: 'active', createdAt: new Date().toISOString(), createdBy: (currentUser(req) || {}).name || '' };
  let visits = 0;
  if (p.visitsPerYear) {
    const date = ymdOk(b.firstVisit) ? b.firstVisit : start; const st = /^\d{2}:\d{2}$/.test(b.startTime || '') ? b.startTime : '09:00';
    const endMin = Math.min(23 * 60 + 59, Number(st.slice(0, 2)) * 60 + Number(st.slice(3)) + Math.round(p.visitHours * 60)); const et = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    const prop = (c.properties || []).find((x) => x.id === b.propertyId);
    const j = { id: uid(), number: nextNumber('jobs'), clientId: c.id, title: p.visitTitle || `${p.name} visit`, description: `Included in the ${p.name} service plan`, date, startTime: st, endTime: et,
      staffIds: (Array.isArray(b.staffIds) ? b.staffIds : []).filter((s) => db.staff.some((x) => x.id === s)), status: 'scheduled', address: String(b.address || c.address || ''), propertyId: prop ? prop.id : '', membershipId: m.id, createdAt: iso(new Date()) };
    autoForms(j); db.jobs.push(j);
    const rule = cleanRepeatRule({ freq: 'month', every: 12 / p.visitsPerYear, monthBy: 'date', end: 'never' }, date);
    const s = { id: uid(), rule, start: date, through: date, made: 1, template: pickSeries(j), ended: false, createdAt: new Date().toISOString(), createdBy: m.createdBy };
    seriesList().push(s); j.seriesId = s.id; m.seriesId = s.id; visits = 1 + fillSeries(s);
  }
  memberships().push(m); const bills = billMembership(m); save();
  res.status(201).json({ membership: membershipRow(m), visits, invoices: bills.map((i) => ({ id: i.id, number: i.number, status: i.status })) });
}));
app.put('/api/memberships/:id', planRoute((req, res, b) => { const m = memberships().find((x) => x.id === req.params.id); if (!m) return res.status(404).json({ error: 'Membership not found' }); if (b.autoSend !== undefined) m.autoSend = !!b.autoSend; save(); res.json(membershipRow(m)); }));
// cancel: no more bills; upcoming visits nobody has worked on are removed (invoices already made stay)
app.post('/api/memberships/:id/cancel', (req, res) => {
  const m = memberships().find((x) => x.id === req.params.id); if (!m) return res.status(404).json({ error: 'Membership not found' }); if (m.status !== 'active') return res.status(400).json({ error: 'This membership is already canceled' });
  const today = localNow().date; m.status = 'canceled'; m.canceledAt = new Date().toISOString(); m.canceledBy = (currentUser(req) || {}).name || '';
  const s = findSeries(m.seriesId); let removed = 0;
  if (s) { const gone = new Set(db.jobs.filter((j) => j.seriesId === s.id && j.date > today && untouchedVisit(j)).map((j) => j.id)); removed = gone.size; db.jobs = db.jobs.filter((j) => !gone.has(j.id)); delete s.rule.count; Object.assign(s.rule, { end: 'until', until: today }); s.ended = true; forgetEmptySeries(s.id); }
  save(); res.json({ membership: membershipRow(m), removed });
});

// Dispatch map (Calendar → Map): where a day's jobs are, and the shortest order for each person to visit them.
// Addresses become map points through the US Census geocoder (free, no key), then OpenStreetMap's Nominatim for anything it can't place
// (at most one request a second, as its rules ask). Results are kept per account in db.geo, so an address is looked up once.
// Distances are straight-line miles times 1.3 for roads, at an average 30 mph: estimates, not turn-by-turn driving times.
const geoKey = (a) => String(a || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 300);
let nominatimNext = 0; // the next moment Nominatim may be asked (shared by every account on this server)
async function geocodeAddress(addr) {
  const q = String(addr || '').trim(); if (!q) return null;
  try {
    const r = await fetch('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=' + encodeURIComponent(q), { signal: AbortSignal.timeout(6000) });
    if (r.ok) { const m = (((await r.json()).result || {}).addressMatches || [])[0]; if (m && m.coordinates) return { lat: +m.coordinates.y, lng: +m.coordinates.x }; }
  } catch (e) { /* try the next one */ }
  try {
    const wait = nominatimNext - Date.now(); nominatimNext = Math.max(Date.now(), nominatimNext) + 1100;
    if (wait > 0) await new Promise((ok) => setTimeout(ok, wait));
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q), { headers: { 'User-Agent': 'WorklioPro/1.0 (dispatch map)' }, signal: AbortSignal.timeout(6000) });
    if (r.ok) { const m = (await r.json())[0]; if (m) return { lat: +m.lat, lng: +m.lon }; }
    else return undefined; // busy or refused: try again later
  } catch (e) { return undefined; }
  return null; // neither could place it
}
// looks up addresses not seen before (within a time budget, so the page isn't held up); misses are retried after a week
async function placeAddresses(list, budgetMs = 7000) {
  db.geo = db.geo || {}; const t0 = Date.now(); let changed = false; const todo = [];
  for (const a of new Set(list.map(geoKey).filter(Boolean))) { const g = db.geo[a]; if (!g || (g.miss && Date.now() - Date.parse(g.at) > 7 * 864e5)) todo.push(a); }
  for (const a of todo) {
    if (Date.now() - t0 > budgetMs) break;
    const p = await geocodeAddress(a); if (p === undefined) continue;
    db.geo[a] = p && isFinite(p.lat) && isFinite(p.lng) ? { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), at: new Date().toISOString() } : { miss: true, at: new Date().toISOString() }; changed = true;
  }
  if (changed) save();
  return todo.filter((a) => !db.geo[a]).length; // still waiting
}
const placeOf = (addr) => { const g = (db.geo || {})[geoKey(addr)]; return g && !g.miss ? { lat: g.lat, lng: g.lng } : null; };
const jobAddress = (j) => String(j.address || (findClient(j.clientId) || {}).address || '').trim();
const roadMiles = (a, b) => { const R = 3958.8; const r = (x) => (x * Math.PI) / 180; const dLat = r(b.lat - a.lat); const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 1.3; };
const driveMin = (miles) => (miles < 0.1 ? 0 : Math.max(5, Math.ceil((miles / 30) * 60 / 5) * 5)); // 30 mph, to the next 5 minutes
const routeMiles = (base, pts) => pts.reduce((s, p, i) => s + roadMiles(i ? pts[i - 1] : base || p, p), 0);
// the visiting order with the fewest miles: nearest next stop, then 2-opt swaps until nothing improves (exact for a day's few stops is not needed)
function shortestOrder(base, pts) {
  if (pts.length < 2) return pts.slice();
  const left = pts.slice(); const order = []; let at = base || left[0];
  while (left.length) { let k = 0; left.forEach((p, i) => { if (roadMiles(at, p) < roadMiles(at, left[k])) k = i; }); at = left.splice(k, 1)[0]; order.push(at); }
  for (let better = true, n = 0; better && n < 50; n++) {
    better = false;
    for (let i = 0; i < order.length - 1; i++) for (let j = i + 1; j < order.length; j++) {
      const flip = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
      if (routeMiles(base, flip) < routeMiles(base, order) - 0.01) { order.splice(0, order.length, ...flip); better = true; }
    }
  }
  return order;
}
const dayJobs = (date) => db.jobs.filter((j) => j.date === date && j.status !== 'cancelled');
app.get('/api/dispatch', async (req, res) => {
  const date = String(req.query.date || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Choose a day' });
  const jobs = dayJobs(date); const base = String(db.company.address || '').trim();
  const pending = await placeAddresses([base, ...jobs.map(jobAddress)]);
  res.json({ date, pending, base: base ? { address: base, ...(placeOf(base) || {}) } : null,
    jobs: jobs.map((j) => { const c = findClient(j.clientId) || {}; const addr = jobAddress(j);
      return { id: j.id, number: j.number, title: j.title, client: c.company || c.name || '', address: addr, startTime: j.startTime, endTime: j.endTime, anytime: !!j.anytime,
        staffIds: j.staffIds || [], status: j.status, seriesId: j.seriesId || '', ...(placeOf(addr) || {}), unplaced: !!addr && !placeOf(addr) && !!(db.geo || {})[geoKey(addr)] }; }) });
});
// a person's best order for the day, and new times: the day starts at `start` (or their first visit), each visit keeps its length
// (anytime visits take an hour) and the drive between stops is added. With apply: true the times are saved.
app.post('/api/dispatch/optimize', async (req, res) => {
  const b = req.body || {}; const date = String(b.date || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Choose a day' });
  const sid = String(b.staffId || ''); if (sid && !db.staff.some((s) => s.id === sid)) return res.status(404).json({ error: 'Team member not found' });
  const mine = dayJobs(date).filter((j) => (sid ? (j.staffIds || []).includes(sid) : !(j.staffIds || []).length) && j.status !== 'completed');
  const baseAddr = String(db.company.address || '').trim(); await placeAddresses([baseAddr, ...mine.map(jobAddress)]);
  const base = placeOf(baseAddr); const placed = mine.filter((j) => placeOf(jobAddress(j))); const rest = mine.filter((j) => !placeOf(jobAddress(j)));
  if (placed.length < 2) return res.status(400).json({ error: placed.length ? 'There’s only one visit on the map to put in order' : 'None of these visits has an address on the map' });
  const mins = (t) => { const [h, m] = String(t || '').split(':').map(Number); return h * 60 + (m || 0); };
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const len = (j) => (j.anytime || !j.startTime || !j.endTime ? 60 : Math.max(15, mins(j.endTime) - mins(j.startTime)));
  const timed = mine.filter((j) => !j.anytime && j.startTime);
  const first = /^\d{2}:\d{2}$/.test(b.start || '') ? mins(b.start) : timed.length ? Math.min(...timed.map((j) => mins(j.startTime))) : 8 * 60;
  const pts = placed.map((j) => ({ j, ...placeOf(jobAddress(j)) }));
  const nowOrder = [...pts].sort((x, y) => (x.j.anytime ? 1440 : mins(x.j.startTime)) - (y.j.anytime ? 1440 : mins(y.j.startTime)));
  const order = shortestOrder(base, pts);
  let t = first; let prev = base; const out = [];
  order.forEach((p, i) => { // the first visit starts the day (the drive there comes before it); each later one starts after the drive from the last
    const miles = prev ? roadMiles(prev, p) : 0; const drive = prev ? driveMin(miles) : 0; if (i) t += drive;
    const start = Math.min(t, 23 * 60); const end = Math.min(start + len(p.j), 23 * 60 + 59);
    out.push({ id: p.j.id, number: p.j.number, title: p.j.title, address: jobAddress(p.j), startTime: hhmm(start), endTime: hhmm(end), miles: +miles.toFixed(1), drive,
      shared: (p.j.staffIds || []).filter((x) => x !== sid).map((x) => (db.staff.find((st) => st.id === x) || {}).name).filter(Boolean) });
    t = end; prev = p;
  });
  const result = { order: out, unplaced: rest.map((j) => ({ id: j.id, number: j.number, title: j.title })), miles: +routeMiles(base, order).toFixed(1), before: +routeMiles(base, nowOrder).toFixed(1),
    driveMinutes: out.reduce((n, o) => n + o.drive, 0), base: baseAddr };
  if (b.apply) {
    for (const o of out) { const j = db.jobs.find((x) => x.id === o.id); if (j) Object.assign(j, { startTime: o.startTime, endTime: o.endTime, anytime: false }); }
    save(); result.applied = true;
  }
  res.json(result);
});

// ---------- Job checklists & forms (a plan feature) ----------
// Templates are made on Settings → Checklists & Forms by anyone who can edit jobs. A template can be added to every new job on its own, has to be
// finished before its job can be marked complete, and/or shows in the client's portal once finished. On a job, the template's fields are copied
// into the form, so changing a template later never changes forms already on jobs. Anyone who can open a job fills in its forms (photos too).
// db.formTemplates: { id, name, description, fields: [{ id, type, label, required, options }], autoAdd, requiredToComplete, clientVisible, archived, createdAt, updatedAt }
// job.forms: [{ id, templateId, name, description, fields, answers: { fieldId: value }, requiredToComplete, clientVisible, addedAt, addedBy, updatedAt, updatedBy, completedAt, completedBy }]
const FORM_TYPES = { heading: 'Section heading', check: 'Checkbox', yesno: 'Pass / Fail / N/A', text: 'Short answer', longtext: 'Long answer', number: 'Number', choice: 'Choose one', date: 'Date', photo: 'Photos' };
const FORM_PHOTO_RE = /^\/uploads\/(form-[a-f0-9]+\.(?:png|jpg|webp))$/;
const formTemplates = () => (db.formTemplates = db.formTemplates || []);
const canManageForms = (u) => isAdmin(u) || can(u, 'jobs.edit');
const formFail = (msg, status = 400) => Object.assign(new Error(msg), { status });
function cleanTemplate(b) {
  const name = String(b.name || '').trim().slice(0, 80); if (!name) throw formFail('Give the checklist a name');
  const ids = new Set();
  const fields = (Array.isArray(b.fields) ? b.fields : []).slice(0, 100).map((f) => {
    const type = FORM_TYPES[f && f.type] ? f.type : 'check'; const label = String(f.label || '').trim().slice(0, 200);
    let id = /^[a-z0-9]{4,16}$/.test(f.id || '') && !ids.has(f.id) ? f.id : uid(); ids.add(id);
    const options = type === 'choice' ? [...new Set((Array.isArray(f.options) ? f.options : String(f.options || '').split(/\n|,/)).map((o) => String(o).trim().slice(0, 80)).filter(Boolean))].slice(0, 30) : [];
    return { id, type, label, required: type !== 'heading' && !!f.required, options };
  }).filter((f) => f.label);
  if (!fields.some((f) => f.type !== 'heading')) throw formFail('Add at least one item to fill in');
  const bad = fields.find((f) => f.type === 'choice' && f.options.length < 2); if (bad) throw formFail(`Give “${bad.label}” at least two choices`);
  const autoAdd = !!b.autoAdd; // services: Products & Services whose line items bring the checklist onto a job (not needed when it goes on every job)
  const services = autoAdd ? [] : [...new Set((Array.isArray(b.services) ? b.services : []).filter((id) => db.services.some((s) => s.id === id)))].slice(0, 100);
  return { name, description: String(b.description || '').trim().slice(0, 500), fields, autoAdd, services, requiredToComplete: !!b.requiredToComplete, clientVisible: !!b.clientVisible, archived: !!b.archived };
}
const formFromTemplate = (t, by) => { const now = new Date().toISOString();
  return { id: uid(), templateId: t.id, name: t.name, description: t.description, fields: structuredClone(t.fields), answers: {}, requiredToComplete: t.requiredToComplete, clientVisible: t.clientVisible, addedAt: now, addedBy: by || '', updatedAt: now, updatedBy: '', completedAt: null, completedBy: '' }; };
// line items keep the service's name, not a link to it, so a job matches a template when one of its items has the name of a chosen service
const normName = (s) => String(s || '').trim().toLowerCase();
const formMatchesJob = (t, job) => { if (!(t.services || []).length || !(job.items || []).length) return false;
  const names = new Set(db.services.filter((s) => t.services.includes(s.id)).map((s) => normName(s.name))); return job.items.some((it) => names.has(normName(it.desc))); };
// a new job (made on the job page, from a quote, by a repeat or a service plan) gets the templates set to go on every new job, and those
// whose products or services are among its line items
function autoForms(job, by) {
  if (!tenancy.has('jobForms')) return job;
  job.forms = formTemplates().filter((t) => !t.archived && (t.autoAdd || formMatchesJob(t, job))).map((t) => formFromTemplate(t, by || 'Added automatically'));
  if (!job.forms.length) delete job.forms; return job;
}
// a job still to do whose line items changed: checklists for products or services it didn't have before are added (none is ever removed)
function matchFormsOnEdit(was, job, by) {
  if (!tenancy.has('jobForms') || job.status !== 'scheduled' || JSON.stringify(was.items || []) === JSON.stringify(job.items || [])) return 0;
  const have = new Set((job.forms || []).map((f) => f.templateId));
  const add = formTemplates().filter((t) => !t.archived && !have.has(t.id) && formMatchesJob(t, job) && !formMatchesJob(t, was)).map((t) => formFromTemplate(t, by || 'Added automatically'));
  if (add.length) job.forms = [...(job.forms || []), ...add]; return add.length;
}
const answered = (f, v) => (f.type === 'check' ? v === true : f.type === 'photo' ? Array.isArray(v) && v.length > 0 : v !== undefined && v !== null && String(v).trim() !== '');
const formMissing = (form) => form.fields.filter((f) => f.required && !answered(f, form.answers[f.id]));
// one answer, checked against its field; photos change only through their own route (removing one is allowed here)
function cleanAnswer(f, v, was) {
  if (v === null || v === undefined || v === '') return undefined;
  switch (f.type) {
    case 'check': return v === true || v === 'true' ? true : undefined;
    case 'yesno': return ['pass', 'fail', 'na'].includes(v) ? v : undefined;
    case 'text': return String(v).slice(0, 300);
    case 'longtext': return String(v).slice(0, 5000);
    case 'number': { const n = Number(v); if (!isFinite(n)) throw formFail(`Enter a number for “${f.label}”`); return n; }
    case 'choice': if (!f.options.includes(String(v))) throw formFail(`Choose one of the options for “${f.label}”`); return String(v);
    case 'date': if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw formFail(`Enter a date for “${f.label}”`); return String(v);
    case 'photo': { const keep = new Set((Array.isArray(v) ? v : []).map((p) => p && p.url)); const list = (Array.isArray(was) ? was : []).filter((p) => keep.has(p.url)); return list.length ? list : undefined; }
    default: return undefined;
  }
}
const rmFormPhoto = (p) => { const m = FORM_PHOTO_RE.exec((p && p.url) || ''); if (m) fs.rm(path.join(uploadDir(), m[1]), { force: true }, () => {}); };
const formPhotos = (form) => form.fields.filter((f) => f.type === 'photo').flatMap((f) => form.answers[f.id] || []);
const jobFormReply = (req, j) => (isMemberReq(req) ? jobForMember(j) : j);
const formRoute = (fn) => (req, res) => { try { fn(req, res, currentUser(req), req.body || {}); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
const findJobForm = (req) => { const j = db.jobs.find((x) => x.id === req.params.id); if (!j) throw formFail('Job not found', 404); const form = req.params.fid && (j.forms || []).find((x) => x.id === req.params.fid); if (req.params.fid && !form) throw formFail('Form not found', 404); return { j, form }; };

app.get('/api/form-templates', (req, res) => res.json({ templates: formTemplates(), types: FORM_TYPES, manage: canManageForms(currentUser(req)) }));
app.post('/api/form-templates', formRoute((req, res, u, b) => {
  if (!canManageForms(u)) throw formFail('Only people who can edit jobs can change checklists', 403);
  const now = new Date().toISOString(); const t = { id: uid(), ...cleanTemplate(b), createdAt: now, updatedAt: now }; formTemplates().push(t); save(); res.status(201).json(t);
}));
app.put('/api/form-templates/:tid', formRoute((req, res, u, b) => {
  if (!canManageForms(u)) throw formFail('Only people who can edit jobs can change checklists', 403);
  const t = formTemplates().find((x) => x.id === req.params.tid); if (!t) throw formFail('Checklist not found', 404);
  Object.assign(t, cleanTemplate({ ...t, ...b }), { updatedAt: new Date().toISOString() }); save(); res.json(t);
}));
// deleting a template leaves the forms already on jobs as they are
app.delete('/api/form-templates/:tid', formRoute((req, res, u) => {
  if (!canManageForms(u)) throw formFail('Only people who can edit jobs can change checklists', 403);
  const i = formTemplates().findIndex((x) => x.id === req.params.tid); if (i < 0) throw formFail('Checklist not found', 404);
  formTemplates().splice(i, 1); save(); res.json({ ok: true });
}));
// add a checklist to a job (anyone who can edit jobs)
app.post('/api/jobs/:id/forms', formRoute((req, res, u, b) => {
  const { j } = findJobForm(req); const t = formTemplates().find((x) => x.id === b.templateId && !x.archived); if (!t) throw formFail('Choose a checklist');
  if ((j.forms || []).length >= 20) throw formFail('A job can have up to 20 checklists and forms');
  j.forms = [...(j.forms || []), formFromTemplate(t, u.name)]; save(); res.status(201).json(jobFormReply(req, j));
}));
app.delete('/api/jobs/:id/forms/:fid', formRoute((req, res) => {
  const { j, form } = findJobForm(req); formPhotos(form).forEach(rmFormPhoto);
  j.forms = j.forms.filter((x) => x !== form); if (!j.forms.length) delete j.forms; save(); res.json(jobFormReply(req, j));
}));
// fill in (anyone who can open the job): the answers sent replace those fields' answers; complete: true finishes it (every required item
// answered), complete: false opens it again; clientVisible (people who edit jobs) shows or hides it in the client's portal once finished
app.put('/api/jobs/:id/forms/:fid', formRoute((req, res, u, b) => {
  const { j, form } = findJobForm(req); const now = new Date().toISOString();
  if (b.answers && typeof b.answers === 'object') {
    if (form.completedAt && b.complete !== false) throw formFail('This form is finished. Tap Edit to change it.', 409);
    for (const f of form.fields) {
      if (f.type === 'heading' || !(f.id in b.answers)) continue;
      const v = cleanAnswer(f, b.answers[f.id], form.answers[f.id]);
      if (f.type === 'photo') (form.answers[f.id] || []).filter((p) => !(v || []).includes(p)).forEach(rmFormPhoto);
      if (v === undefined) delete form.answers[f.id]; else form.answers[f.id] = v;
    }
    form.updatedAt = now; form.updatedBy = u.name;
  }
  if (b.clientVisible !== undefined) { if (!canManageForms(u)) throw formFail('Only people who can edit jobs can share forms with the client', 403); form.clientVisible = !!b.clientVisible; }
  if (b.complete === true && !form.completedAt) {
    const miss = formMissing(form); if (miss.length) throw formFail(`Fill in ${miss.length === 1 ? `“${miss[0].label}”` : `the ${miss.length} required items (${miss.slice(0, 3).map((f) => `“${f.label}”`).join(', ')}${miss.length > 3 ? '…' : ''})`} first`);
    form.completedAt = now; form.completedBy = u.name;
  }
  if (b.complete === false) { form.completedAt = null; form.completedBy = ''; }
  save(); res.json(jobFormReply(req, j));
}));
// a photo for a photo item, added to it right away (up to 10 on an item)
app.post('/api/jobs/:id/forms/:fid/photo', formRoute((req, res, u, b) => {
  const { j, form } = findJobForm(req); const f = form.fields.find((x) => x.id === b.fieldId && x.type === 'photo'); if (!f) throw formFail('Photo item not found', 404);
  if (form.completedAt) throw formFail('This form is finished. Tap Edit to change it.', 409);
  const list = form.answers[f.id] || []; if (list.length >= 10) throw formFail('Up to 10 photos on an item');
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.dataUrl || ''); if (!m) throw formFail('Add a photo (PNG, JPG or WebP)');
  if (m[2].length > 12e6) throw formFail('That photo is too large');
  const file = `form-${token()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`; fs.writeFileSync(path.join(uploadDir(), file), Buffer.from(m[2], 'base64')); // unguessable: uploads are served without login
  form.answers[f.id] = [...list, { url: `/uploads/${file}`, at: new Date().toISOString(), by: u.name }]; form.updatedAt = new Date().toISOString(); form.updatedBy = u.name;
  save(); res.status(201).json(jobFormReply(req, j)); jobPosts.maybeDraft(j);
}));
// the client portal: finished forms the business shares, with their answers (no names of who filled them in)
const formForClient = (f) => ({ id: f.id, name: f.name, description: f.description, completedAt: f.completedAt, fields: f.fields.map(({ id, type, label, options }) => ({ id, type, label, options })), answers: f.answers });
const sharedForms = (j) => (tenancy.has('jobForms') ? (j.forms || []).filter((f) => f.completedAt && f.clientVisible).map(formForClient) : []);
// a checklist as a PDF: the business, the job, then each item with its answer and photos. The client's copy leaves out who filled it in.
const FORM_YESNO = { pass: ['Pass', '#15803d'], fail: ['Fail', '#b91c1c'], na: ['N/A', '#475569'] };
function formPdf(j, form, forClient) {
  const co = db.company; const c = findClient(j.clientId) || {}; const pdf = createPdf(); const L = 58; const R = 554; const INK = '#111827'; const GRAY = '#6b7280'; const BOTTOM = 740; let y = 72;
  const read = (u) => { const m = /^\/uploads\/([\w.-]+)$/.exec(u || ''); if (!m) return null; try { return fs.readFileSync(path.join(uploadDir(), m[1])); } catch (e) { return null; } };
  const room = (h) => { if (y + h > BOTTOM) { pdf.addPage(); y = 64; } };
  pdf.text(L, y, co.name || '', { size: 15, bold: true, color: INK }); y += 18;
  const reach = [co.phone && fmtUsPhone(co.phone), co.email].filter(Boolean).join('  |  '); if (reach) { pdf.text(L, y, reach, { size: 10, color: INK }); y += 14; }
  const logo = read(co.logo); if (logo) pdf.image(logo, R - 120, 54, 120, 54, { alignRight: true });
  y = Math.max(y, 112) + 18;
  y = pdf.para(L, y, form.name, R - L, { size: 18, bold: true, color: INK, lineHeight: 22 }) + 2;
  if (form.description) y = pdf.para(L, y, form.description, R - L, { size: 10.5, color: GRAY, lineHeight: 14 });
  y += 6; pdf.rect(L, y, R - L, 58, { fill: '#f1f5fb' });
  const facts = [['Job', `#${j.number}${j.title ? ' · ' + j.title : ''}`], ['Client', c.name || ''], ['Address', j.address || c.address || ''], ['Visit', j.date ? niceDate(j.date) : '']];
  facts.forEach(([k, v], i) => { const fx = L + 10 + (i % 2) * ((R - L) / 2); const fy = y + 20 + Math.floor(i / 2) * 22; pdf.text(fx, fy, k, { size: 8.5, bold: true, color: GRAY }); const t = String(v); pdf.text(fx + 48, fy, t.length > 40 ? t.slice(0, 39) + '…' : t, { size: 10, color: INK }); });
  y += 72;
  const n = form.fields.filter((f) => f.type !== 'heading'); const done = n.filter((f) => answered(f, form.answers[f.id])).length;
  const status = form.completedAt ? `Finished ${niceDate(form.completedAt.slice(0, 10))}${!forClient && form.completedBy ? ` by ${form.completedBy}` : ''}` : `Not finished: ${done} of ${n.length} done`;
  pdf.text(L, y, status, { size: 10.5, bold: true, color: form.completedAt ? '#15803d' : '#b45309' }); y += 20;
  const ANS = 330; // answers start here; long answers and photos go under their item
  for (const f of form.fields) {
    const v = form.answers[f.id];
    if (f.type === 'heading') { room(40); y += 10; pdf.text(L, y, f.label.toUpperCase(), { size: 10, bold: true, color: GRAY }); y += 6; pdf.line(L, y, R, y, { color: '#cbd5e1', w: 1 }); y += 16; continue; }
    const label = f.label + (f.required && !forClient ? ' *' : '');
    if (f.type === 'photo' || f.type === 'longtext') {
      room(34); y = pdf.para(L, y, label, R - L, { size: 10.5, bold: true, color: INK, lineHeight: 14 }) + 2;
      if (f.type === 'longtext') { if (v) for (const para of String(v).split('\n')) { room(14); y = para.trim() ? pdf.para(L, y, para, R - L, { size: 10.5, color: INK, lineHeight: 14 }) : y + 6; } else { pdf.text(L, y, '—', { size: 10.5, color: GRAY }); y += 14; } }
      else { const list = v || []; if (!list.length) { pdf.text(L, y, 'No photos', { size: 10.5, color: GRAY }); y += 14; }
        const PW = 156; const PH = 117; const GAP = 12; let col = 0; let skipped = 0;
        for (const p of list) { const buf = read(p.url); if (col === 0) room(PH + 6); const r = buf && pdf.image(buf, L + col * (PW + GAP), y, PW, PH); if (!r) { skipped++; continue; } col++; if (col === 3) { col = 0; y += PH + GAP; } }
        if (col) y += PH + GAP; if (skipped) { pdf.text(L, y, `${skipped} photo${skipped === 1 ? '' : 's'} can’t be shown in a PDF (open the checklist in the app)`, { size: 9, color: GRAY }); y += 14; } }
      y += 6; pdf.line(L, y - 4, R, y - 4, { color: '#e5e7eb' }); y += 8; continue;
    }
    let ans = '—'; let color = GRAY;
    if (f.type === 'check') { ans = v === true ? 'Done' : 'Not done'; color = v === true ? '#15803d' : GRAY; }
    else if (f.type === 'yesno') { if (FORM_YESNO[v]) [ans, color] = FORM_YESNO[v]; }
    else if (f.type === 'date') { if (v) { ans = niceDate(v); color = INK; } }
    else if (v !== undefined && v !== null && String(v) !== '') { ans = String(v); color = INK; }
    room(24); const top = y;
    const ly = pdf.para(L, top, label, ANS - L - 14, { size: 10.5, color: INK, lineHeight: 14 });
    const ay = pdf.para(ANS, top, ans, R - ANS, { size: 10.5, bold: f.type === 'yesno' || f.type === 'check', color, lineHeight: 14 });
    y = Math.max(ly, ay) + 2; pdf.line(L, y - 4, R, y - 4, { color: '#e5e7eb' }); y += 8;
  }
  return pdf.toBuffer(`${form.name} · Job ${j.number}`);
}
const formPdfName = (j, form) => `${form.name.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'checklist'}_${String(j.number).replace(/[^\w-]+/g, '')}.pdf`;
const sendFormPdf = (res, j, form, forClient) => { res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="${formPdfName(j, form)}"`); res.end(formPdf(j, form, forClient)); };
app.get('/api/jobs/:id/forms/:fid/pdf', formRoute((req, res) => { const { j, form } = findJobForm(req); sendFormPdf(res, j, form, false); }));
// the client's copy, from their portal link: only finished checklists the business shares
app.get('/api/portal/:token/forms/:fid/pdf', (req, res) => {
  const c = db.clients.find((x) => x.portalToken === req.params.token); if (!c || !tenancy.has('jobForms')) return res.status(404).json({ error: 'Not found' });
  for (const j of db.jobs) if (j.clientId === c.id) { const f = (j.forms || []).find((x) => x.id === req.params.fid && x.completedAt && x.clientVisible); if (f) return sendFormPdf(res, j, f, true); }
  res.status(404).json({ error: 'Not found' });
});

// Roles & Permissions (owner/admin): the catalog, the roles, and how many logins have each; saving replaces the whole list
const rolesView = () => ({ custom: customRolesOn(), catalog: rolesLib.catalog(), roles: teamRoles().map((r) => ({ ...r, users: db.users.filter((u) => u.role !== 'owner' && u.role !== 'admin' && roleKey(u) === r.id).length })), admins: db.users.filter((u) => u.role === 'admin').length });
app.get('/api/roles', (req, res) => res.json(rolesView()));
app.put('/api/roles', (req, res) => {
  const inUse = {}; for (const u of db.users) inUse[u.role] = (inUse[u.role] || 0) + 1;
  try { db.roles = rolesLib.validate(req.body && req.body.roles, inUse); save(); res.json(rolesView()); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
// the login cap: the current plan's, or a scheduled downgrade's if that's lower (so logins can't be added after booking one)
const logins = (n) => `${n} login${n === 1 ? '' : 's'}`;
// A plan with extra logins (extraUser in Alpha → Plans) has no cap while the account can be billed for them; see syncSeats.
function loginLimit() {
  const t = tenancy.current(); const pending = t.billing && t.billing.pendingPlanId && tenancy.platform().plans.find((p) => p.id === t.billing.pendingPlanId);
  const cur = tenancy.planOf(t);
  const caps = [canBuyExtra(t, cur) ? null : cur, pending].filter((p) => p && p.maxUsers > 0).sort((a, b) => a.maxUsers - b.maxUsers);
  return caps[0] ? { max: caps[0].maxUsers, name: caps[0].name } : null;
}
app.post('/api/users/invite', async (req, res) => { // invite (or re-invite) a team member; returns the link so it can also be shared by hand
  const st = db.staff.find((x) => x.id === (req.body && req.body.staffId)); if (!st) return res.status(404).json({ error: 'Team member not found' });
  const email = normEmail(st.email); if (!email.includes('@')) return res.status(400).json({ error: 'Add an email address for this team member first' });
  const role = roleValid(req.body.role) ? req.body.role : defaultRole();
  let user = db.users.find((u) => u.staffId === st.id) || db.users.find((u) => u.email === email);
  if (user && user.role === 'owner') return res.status(400).json({ error: 'This email belongs to the account owner' });
  if (user && user.passwordHash) return res.status(400).json({ error: 'They already have a login' });
  const lim = loginLimit();
  if (lim && !user && db.users.length >= lim.max) return res.status(403).json({ error: `Your ${lim.name} plan includes ${logins(lim.max)}. Upgrade to add more of your team.`, upgrade: 'users' });
  const t = tenancy.current(); const cur = tenancy.planOf(t); const addsExtra = !user && canBuyExtra(t, cur) && db.users.length >= cur.maxUsers;
  if (addsExtra && !req.body.confirmExtra) { // say what it costs first; the app asks, then sends confirmExtra
    const c = stripeLib.seatCharge(cur, (t.billing && t.billing.interval) || 'month'); const n = db.users.length + 1 - cur.maxUsers;
    return res.status(409).json({ error: `Your ${cur.name} plan includes ${logins(cur.maxUsers)}.`, confirmExtra: { plan: cur.name, included: cur.maxUsers, extra: n, cents: c.cents, interval: c.interval, trial: onTrial(t), billed: !!stripeLib.platformKey() } });
  }
  if (!user) { user = { id: uid(), createdAt: iso(new Date()) }; db.users.push(user); }
  Object.assign(user, { name: st.name, email, role, staffId: st.id, invitedAt: iso(new Date()), invitedBy: currentUser(req).id });
  for (const [k, t] of Object.entries(db.resetTokens)) if (t.userId === user.id) delete db.resetTokens[k]; // old invite links stop working
  const tok = crypto.randomBytes(32).toString('hex'); db.resetTokens[sha(tok)] = { userId: user.id, expires: Date.now() + INVITE_DAYS * 864e5, invite: true }; save();
  const link = `${baseUrl()}/login?invite=${tok}`;
  const sent = await sendTemplate('teamInvite', email, { name: st.name, inviter: currentUser(req).name, business: db.company.name, link, days: String(INVITE_DAYS) });
  if (addsExtra) seatsChanged();
  res.json({ user: userRow(user), link, emailed: sent.status === 'sent', detail: sent.detail });
});
app.put('/api/users/:id', (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id); if (!u) return res.status(404).json({ error: 'Not found' });
  if (u.role === 'owner') return res.status(400).json({ error: 'The owner’s role can’t be changed' });
  if (!roleValid(req.body && req.body.role)) return res.status(400).json({ error: req.body && req.body.role === 'admin' ? 'The Admin role comes with Custom roles, which isn’t in your plan' : 'Choose one of your roles' });
  u.role = req.body.role; save(); res.json(userRow(u));
});
function removeUser(u) {
  db.users = db.users.filter((x) => x.id !== u.id);
  for (const [k, s] of Object.entries(db.sessions)) if (s.userId === u.id) delete db.sessions[k]; // signs them out right away
  for (const [k, t] of Object.entries(db.resetTokens)) if (t.userId === u.id) delete db.resetTokens[k];
  seatsChanged(); // one fewer extra login to pay for
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
app.get('/api/auth/state', (req, res) => res.json({ needsSetup: !db.users.length, user: publicUser(currentUser(req)), company: { name: db.company.name, logo: db.company.logo }, product: brandLib.brand(), emailReady: !!emailProvider() }));
// what this login may open: its permissions, the pages they unlock, and which lists it can load
const accessOf = (u) => { const rk = roleKey(u); const routes = rolesLib.routesFor(teamRoles(), rk); return { staffId: u.staffId || null, perms: rolesLib.permsOf(teamRoles(), rk), pages: rolesLib.isAdminRole(u.role) ? null : rolesLib.pagesFor(teamRoles(), rk), collections: rolesLib.isAdminRole(u.role) ? COLLECTIONS : COLLECTIONS.filter((c) => rolesLib.allows(routes, 'GET', '/api/' + c)) }; };
// the app tour (public/tour.js) starts by itself once for logins made since it launched; finishing or skipping it marks it seen
const TOUR_SINCE = '2026-10-26';
const tourNew = (u, req) => !req._support && !u.tourAt && String(u.createdAt || '') >= TOUR_SINCE;
// the Founding Supporter thank-you popup (public/app.js) shows once, for the owner, after a code is claimed
app.post('/api/account/supporter-thanks', (req, res) => {
  const u = currentUser(req); if (!u) return res.status(401).json({ error: 'Please log in' });
  if (u.role === 'owner' && !req._support) supporters.thanksSeen(tenancy.current());
  res.json({ ok: true });
});
app.post('/api/auth/tour', (req, res) => {
  const u = currentUser(req); if (!u) return res.status(401).json({ error: 'Please log in' });
  if (!req._support && !u.tourAt) { u.tourAt = iso(new Date()); save(); }
  res.json({ ok: true });
});
app.get('/api/auth/me', (req, res) => (currentUser(req) ? res.json({ ...publicUser(currentUser(req)), ...accessOf(currentUser(req)), tourNew: tourNew(currentUser(req), req), supporterThanks: currentUser(req).role === 'owner' && !req._support ? supporters.thanks(tenancy.current()) : null, ...(req._support ? { support: { adminName: req._support.adminName, expires: req._support.expires } } : {}) }) : res.status(401).json({ error: 'Please log in' })));
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
  const s = db.sessions[sha(cookies(req).sid || '')]; delete db.sessions[sha(cookies(req).sid || '')]; save();
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); ideasHint(req, res, false);
  if (s) ideasApp.logoutUser(tenancy.current().id, s.userId); // logged out here: logged out on ideas.<domain> too
  res.json({ ok: true });
});
app.get('/api/auth/verify-email', (req, res) => {
  const h = sha(String(req.query.token || '')); const u = db.users.find((x) => x.emailVerify && x.emailVerify.hash === h);
  const login = `<a href="/login?email=${encodeURIComponent(u ? u.email : '')}">Log in</a>`;
  if (!u || u.emailVerify.expires < Date.now()) return res.status(400).send(notice('This link doesn’t work', `It was already used or is more than 7 days old. ${login} and you can keep using your account.`));
  delete u.emailVerify; u.emailVerifiedAt = new Date().toISOString(); save();
  sendTemplate('welcome', u.email, { name: u.name, business: db.company.name || tenancy.current().name, account_url: baseUrl() }, { server: true }).catch(() => {});
  res.send(notice('Email confirmed', `Thanks, ${esc(u.name)}. Your email address is confirmed. ${login}`));
});
// the "choose a new password" email (1 hour). Runs inside the account.
function sendPasswordReset(user) {
  const token = crypto.randomBytes(32).toString('hex'); db.resetTokens[sha(token)] = { userId: user.id, expires: Date.now() + 60 * 60e3 }; save();
  return sendTemplate('passwordReset', user.email, { name: user.name, business: db.company.name, link: `${baseUrl()}/login?reset=${token}` });
}
app.post('/api/auth/forgot', async (req, res) => { // always answers the same, so it doesn't reveal which emails have accounts
  const user = db.users.find((u) => u.email === normEmail(req.body && req.body.email));
  if (user) await sendPasswordReset(user);
  res.json({ ok: true });
});

// ---------- one login for every business (<platform address>/sign-in, and the phone app) ----------
// every login with this email, in any business: [{ t, user, business, active }]. active: has a password and isn't deactivated.
function loginsFor(email) {
  const e = normEmail(email); if (!e) return [];
  return tenancy.platform().tenants.flatMap((t) => tenancy.run(t, () => db.users.filter((u) => u.email === e)
    .map((user) => ({ t, user, business: db.company.name || t.name, active: !!user.passwordHash && !staffBlocked(user) }))));
}
// the central login hands the person to their business's own address with a one-time link (1 minute), which logs them in there,
// then opens next: a page in the app (only an address on the same site, starting with one /)
const handoffs = new Map(); // token hash -> { tenantId, userId, expires }
function handoffUrl(t, user, next) {
  const tok = crypto.randomBytes(32).toString('hex'); const now = Date.now();
  for (const [k, x] of handoffs) if (x.expires < now) handoffs.delete(k);
  const to = typeof next === 'string' && next.length < 4000 && /^\/(?!\/)[^\s\\]*$/.test(next) ? next : '/';
  handoffs.set(sha(tok), { tenantId: t.id, userId: user.id, expires: now + 60e3, next: to });
  return `${tenancy.tenantUrl(t)}/login/handoff?token=${tok}`;
}
app.get('/login/handoff', (req, res) => {
  const k = sha(String(req.query.token || '')); const x = handoffs.get(k); handoffs.delete(k);
  const user = x && x.expires > Date.now() && x.tenantId === tenancy.current().id && db.users.find((u) => u.id === x.userId);
  if (!user || !user.passwordHash || staffBlocked(user)) return res.redirect('/login');
  user.lastLoginAt = new Date().toISOString(); startSession(res, user); res.redirect(x.next || '/');
});
// ideas.<domain> asks who is logged in here: back to it with a one-time pass (1 minute), or with none=1 when nobody is
const ideasPasses = new Map(); // pass hash -> { tenantId, userId, expires }
app.get('/ideas/sso', (req, res) => {
  const back = typeof req.query.r === 'string' && /^\/(?!\/)[^\s\\]*$/.test(req.query.r) ? req.query.r : '/';
  const u = currentUser(req); if (!u || req._support) return res.redirect(`${tenancy.ideasUrl()}/sso?none=1&r=${encodeURIComponent(back)}`);
  const tok = crypto.randomBytes(32).toString('hex'); const now = Date.now();
  for (const [k, x] of ideasPasses) if (x.expires < now) ideasPasses.delete(k);
  ideasPasses.set(sha(tok), { tenantId: tenancy.current().id, userId: u.id, expires: now + 60e3 });
  res.redirect(`${tenancy.ideasUrl()}/sso?token=${tok}&r=${encodeURIComponent(back)}`);
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
// a team member sets their own weekly availability (shown on Schedules, used for booking warnings)
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
// ---- push notifications (Gear → Preferences): each login picks what it gets; each browser or phone it turns them on for is saved on the login ----
const PUSH_KINDS = ['overview', 'schedule', 'request', 'booking', 'quoteViewed', 'quoteApproved', 'review', 'automation', 'jobPost'];
const pushPrefs = (u) => Object.fromEntries(PUSH_KINDS.map((k) => [k, !u.pushPrefs || u.pushPrefs[k] !== false]));
const isOwnerOrAdmin = (u) => u.role === 'owner' || u.role === 'admin';
// never throws: a notification must not get in the way of the work that caused it. A subscription the browser has dropped is forgotten.
const pushOne = (u, sub, message) => push.send(sub, message).then((gone) => { if (gone) { u.pushSubs = u.pushSubs.filter((x) => x.endpoint !== sub.endpoint); save(); } }).catch((e) => console.error('push:', e.message));
// send to these logins, skipping anyone who turned this kind off
function pushTo(users, kind, message) {
  for (const u of new Set(users)) {
    if (!(u.pushSubs || []).length || !pushPrefs(u)[kind] || !u.passwordHash || staffBlocked(u)) continue;
    for (const sub of u.pushSubs) pushOne(u, sub, { tag: kind, ...message });
  }
}
// the date and hour now where the business is (the server's clock can be on another time zone's day)
function localNow() {
  const at = (tz) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  let p; try { p = at(db.company.timezone || SERVER_TZ || undefined); } catch (e) { p = at(undefined); }
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
const pushTime = (t) => { if (db.company.timeFormat === '24') return t; const [h, m] = String(t).split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const usersWhoCan = (perm) => db.users.filter((u) => can(u, perm));
const jobCrew = (j) => db.users.filter((u) => u.staffId && (j.staffIds || []).includes(u.staffId));
// a change to today's jobs goes to the people on the job and the owner and admins, not to whoever made it
function pushScheduleChange(was, job, actor) {
  const today = localNow().date; const onToday = (j) => !!j && j.date === today && !['cancelled', 'completed'].includes(j.status);
  if (!onToday(was) && !onToday(job)) return;
  if (job && job.status === 'completed') return; // finishing a job isn't a schedule change
  const sameTime = was && job && ['date', 'startTime', 'endTime', 'anytime'].every((k) => (was[k] || '') === (job[k] || ''));
  const sameCrew = was && job && [...(was.staffIds || [])].sort().join() === [...(job.staffIds || [])].sort().join();
  if (onToday(was) && onToday(job) && sameTime && sameCrew) return;
  const at = job && !job.anytime && job.startTime ? pushTime(job.startTime) : '';
  const what = !onToday(was) ? `added to today${at ? ` at ${at}` : ''}` : !job || job.status === 'cancelled' ? 'cancelled' : job.date !== today ? 'moved off today' : sameTime ? 'has a change to its team' : `moved to ${at || 'anytime today'}`;
  const j = job || was;
  pushTo([...db.users.filter(isOwnerOrAdmin), ...jobCrew(was || {}), ...jobCrew(job || {})].filter((u) => !actor || u.id !== actor.id), 'schedule',
    { title: 'Today’s schedule changed', body: `${j.title || j.number} ${what}`, url: '/calendar' });
}
const pushNewRequest = (kind, c, r) => pushTo(usersWhoCan('clients.view'), kind, { title: kind === 'booking' ? 'New online booking' : 'New request', body: `${c.name}: ${r.title}`, url: `/clients/view?id=${c.id}` });
// once a day, around 7 in the morning where the business is: each login's own jobs today; the owner and admins get the whole team's
function pushOverviews() {
  for (const t of tenancy.platform().tenants) {
    if (t.status !== 'active') continue;
    tenancy.run(t, () => {
      if (!db.users.some((u) => (u.pushSubs || []).length)) return;
      const { date, hour } = localNow(); if (hour < 7 || hour > 9 || db.pushOverviewOn === date) return;
      db.pushOverviewOn = date; save();
      const today = db.jobs.filter((j) => j.date === date && !['cancelled', 'completed'].includes(j.status)).sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
      for (const u of db.users) {
        const list = isOwnerOrAdmin(u) ? today : today.filter((j) => (j.staffIds || []).includes(u.staffId)); if (!list.length) continue;
        const first = list.find((j) => !j.anytime && j.startTime);
        pushTo([u], 'overview', { title: 'Today’s work overview', body: `${list.length} job${list.length === 1 ? '' : 's'} today${first ? `, starting at ${pushTime(first.startTime)}` : ''}`, url: '/calendar' });
      }
    });
  }
}
app.get('/api/auth/push', (req, res) => { const u = currentUser(req); if (!u) return res.status(401).json({ error: 'Please log in' }); res.json({ publicKey: push.publicKey(), prefs: pushPrefs(u) }); });
app.post('/api/auth/push/subscribe', (req, res) => {
  const u = currentUser(req); if (!u) return res.status(401).json({ error: 'Please log in' });
  const sub = push.cleanSub(req.body && req.body.subscription); if (!sub) return res.status(400).json({ error: 'This browser’s push service isn’t supported' });
  for (const x of db.users) if (x.pushSubs) x.pushSubs = x.pushSubs.filter((s) => s.endpoint !== sub.endpoint); // a shared device notifies only whoever turned it on last
  u.pushSubs = [...(u.pushSubs || []), sub].slice(-10); save();
  pushOne(u, sub, { title: 'Notifications are on', body: 'You’ll get your notifications on this device.', tag: 'welcome', url: '/settings/preferences' });
  res.json({ ok: true });
});
app.post('/api/auth/push/unsubscribe', (req, res) => {
  const u = currentUser(req); if (!u) return res.status(401).json({ error: 'Please log in' });
  u.pushSubs = (u.pushSubs || []).filter((s) => s.endpoint !== String((req.body && req.body.endpoint) || '')); save(); res.json({ ok: true });
});
app.post('/api/auth/push/prefs', (req, res) => {
  const u = currentUser(req); if (!u) return res.status(401).json({ error: 'Please log in' });
  const P = pushPrefs(u); for (const k of PUSH_KINDS) if (req.body && k in req.body) P[k] = !!req.body[k];
  u.pushPrefs = P; save(); res.json(P);
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

// ---------- calendar feed: each login's private iCal link (Settings → Preferences) ----------
// Google Calendar, Outlook and Apple Calendar subscribe to /cal/<token>.ics and fetch it again every few hours. It's one-way: changes made here show there.
// u.calFeed = { token, scope: 'mine' (visits assigned to their team member) | 'all' (everyone's, needs the Calendar permission), createdAt, fetchedAt }
// Never prices; the client's phone only for logins that can see clients. Paused or ended accounts stop serving it (see the account middleware)
const feedOk = (u) => can(u, 'schedule') || can(u, 'jobs.view');
const feedScope = (u) => (u.calFeed && u.calFeed.scope === 'all' && can(u, 'schedule') ? 'all' : 'mine');
function feedView(u) {
  const f = u.calFeed; const st = staffOfUser(u); const base = { allowed: feedOk(u), canAll: can(u, 'schedule'), hasStaff: !!st };
  if (!f) return { ...base, on: false };
  const url = `${baseUrl()}/cal/${f.token}.ics`; const webcal = url.replace(/^https?:/, 'webcal:');
  return { ...base, on: true, scope: feedScope(u), url, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`, createdAt: f.createdAt, fetchedAt: f.fetchedAt || null };
}
const feedUser = (req) => { const u = currentUser(req); if (!u) return null; if (!feedOk(u)) throw Object.assign(new Error('Your access level doesn’t include the calendar. Ask the account owner.'), { status: 403 }); return u; };
const feedRoute = (fn) => (req, res) => { try { const u = feedUser(req); if (!u) return res.status(401).json({ error: 'Please log in' }); fn(u, req.body || {}); save(); res.json(feedView(u)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
app.get('/api/auth/calendar-feed', (req, res) => { const u = currentUser(req); if (!u) return res.status(401).json({ error: 'Please log in' }); res.json(feedView(u)); });
app.post('/api/auth/calendar-feed', feedRoute((u, b) => { // turn it on, or change what it shows (the link stays the same)
  u.calFeed = u.calFeed || { token: crypto.randomBytes(24).toString('hex'), scope: 'mine', createdAt: new Date().toISOString() };
  if (b.scope) { if (b.scope === 'all' && !can(u, 'schedule')) throw Object.assign(new Error('Your access level doesn’t include everyone’s calendar'), { status: 403 }); u.calFeed.scope = b.scope === 'all' ? 'all' : 'mine'; }
}));
app.post('/api/auth/calendar-feed/reset', feedRoute((u) => { if (!u.calFeed) throw Object.assign(new Error('Your calendar link isn’t on'), { status: 400 }); Object.assign(u.calFeed, { token: crypto.randomBytes(24).toString('hex'), createdAt: new Date().toISOString(), fetchedAt: null }); }));
app.delete('/api/auth/calendar-feed', feedRoute((u) => { delete u.calFeed; }));

// iCalendar text (RFC 5545): escape text, fold lines at 75 bytes, CRLF endings
const icsText = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function icsFold(line) {
  const out = []; let cur = ''; let bytes = 0;
  for (const ch of line) { const n = Buffer.byteLength(ch); if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; } cur += ch; bytes += n; }
  out.push(cur); return out.join('\r\n ');
}
const icsUtc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsDay = (ymd) => String(ymd).replace(/-/g, '');
// "2026-11-09" + "14:30" in the account's time zone (applyTimezone set process.env.TZ for this request) → a UTC stamp
const icsAt = (ymd, hm) => icsUtc(new Date(`${ymd}T${hm}:00`));
const addHour = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h >= 23 ? '23:59' : `${String(h + 1).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`; };
// one event: all day when there's no start time (multi-day for time off), else start/end, an hour long when there's no end
function icsEvent({ uid: id, date, to, start, end, summary, location, description, url, status }) {
  const L = ['BEGIN:VEVENT', `UID:${id}`, `DTSTAMP:${icsUtc(new Date())}`];
  if (!start) L.push(`DTSTART;VALUE=DATE:${icsDay(date)}`, `DTEND;VALUE=DATE:${icsDay(addDaysYmd(to || date, 1))}`);
  else L.push(`DTSTART:${icsAt(date, start)}`, `DTEND:${icsAt(date, end && end > start ? end : addHour(start))}`);
  L.push(`SUMMARY:${icsText(summary)}`);
  if (location) L.push(`LOCATION:${icsText(location)}`);
  if (description) L.push(`DESCRIPTION:${icsText(description)}`);
  if (url) L.push(`URL:${url}`);
  if (status) L.push(`STATUS:${status}`);
  L.push('END:VEVENT'); return L;
}
// what goes in the feed: from 60 days back to 400 days ahead; cancelled jobs and finished tasks are left out
function calendarFeed(u) {
  const scope = feedScope(u); const st = staffOfUser(u); const mine = (ids) => scope === 'all' || (!!st && (ids || []).includes(st.id));
  const from = addDaysYmd(localNow().date, -60); const until = addDaysYmd(localNow().date, 400); const inRange = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && d >= from && d <= until;
  const host = tenancy.hostOnly(new URL(baseUrl()).host); const phones = can(u, 'clients.view');
  const names = (ids) => (ids || []).map((id) => (db.staff.find((s) => s.id === id) || {}).name).filter(Boolean).join(', ');
  const clientLines = (c) => (c ? [`Client: ${c.name}`, ...(phones && c.phone ? [`Phone: ${c.phone}`] : [])] : []);
  const timed = (x) => (x.anytime || !x.startTime ? {} : { start: x.startTime, end: x.endTime });
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${icsText(tenancy.platform().settings.productName || 'Worklio Pro')}//Calendar feed//EN`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(tenancy.platform().settings.productName || 'Worklio Pro')}`, // the name calendar apps give it when it's added (people can rename it there) `X-WR-CALDESC:${icsText(scope === 'all' ? 'Everyone’s jobs, tasks and events' : 'Your jobs, tasks and events')}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  if (feedOk(u)) {
    for (const j of db.jobs) {
      if (j.status === 'cancelled' || !inRange(j.date) || !mine(j.staffIds)) continue; const c = findClient(j.clientId);
      L.push(...icsEvent({ uid: `job-${j.id}@${host}`, date: j.date, ...timed(j), summary: c ? `${j.title || 'Job'} · ${c.name}` : j.title || 'Job', location: j.address,
        description: [`Job #${j.number}${j.status === 'completed' ? ' (completed)' : ''}`, ...clientLines(c), ...(scope === 'all' && names(j.staffIds) ? [`Team: ${names(j.staffIds)}`] : []), ...(j.description ? ['', j.description] : []), '', `${baseUrl()}/jobs/edit?id=${j.id}`].join('\n'),
        url: `${baseUrl()}/jobs/edit?id=${j.id}` }));
    }
    for (const [col, word] of [['tasks', 'Task'], ['events', '']]) for (const x of db[col] || []) {
      if (x.done || !inRange(x.date) || !mine(x.staffIds)) continue; const c = findClient(x.clientId);
      L.push(...icsEvent({ uid: `${col}-${x.id}@${host}`, date: x.date, ...timed(x), summary: `${word ? word + ': ' : ''}${x.title}${c ? ` · ${c.name}` : ''}`, location: x.address,
        description: [...clientLines(c), ...(scope === 'all' && names(x.staffIds) ? [`Team: ${names(x.staffIds)}`] : []), ...(x.description ? ['', x.description] : [])].join('\n').trim() }));
    }
    for (const r of db.timeOff || []) {
      if (r.status !== 'approved' || !(r.to >= from && r.from <= until) || !mine([r.staffId])) continue; const who = (db.staff.find((s) => s.id === r.staffId) || {}).name || '';
      L.push(...icsEvent({ uid: `timeoff-${r.id}@${host}`, date: r.from, to: r.start ? '' : r.to, ...(r.start ? { start: r.start, end: r.end } : {}), summary: scope === 'all' ? `${who}: time off` : 'Time off' }));
    }
  }
  L.push('END:VCALENDAR'); return L.map(icsFold).join('\r\n') + '\r\n';
}
app.get('/cal/:token.ics', (req, res) => {
  const t = String(req.params.token || ''); const u = /^[0-9a-f]{48}$/.test(t) && db.users.find((x) => x.calFeed && x.calFeed.token === t);
  if (!u || !u.passwordHash || staffBlocked(u)) { res.statusCode = 404; return res.end('Calendar not found'); } // turned off, reset, or the login was removed or deactivated
  const today = localNow().date; if (u.calFeed.fetchedAt !== today) { u.calFeed.fetchedAt = today; save(); } // "Last checked" on Preferences (a day is enough; calendars fetch often)
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8'); res.setHeader('Content-Disposition', 'inline; filename="calendar.ics"'); res.setHeader('Cache-Control', 'private, max-age=900');
  res.end(calendarFeed(u));
});

app.use('/uploads', (req, res, next) => express.static(uploadDir())(req, res, next)); // each account's own uploads folder
app.use(express.static(path.join(__dirname, 'public')));

const COLLECTIONS = ['clients', 'services', 'staff', 'quotes', 'jobs', 'invoices', 'expenses', 'photos', 'tasks', 'events'];
// a task or event on Schedules: what it is and when (a whole day when anytime)
function calItemProblem(b, partial) {
  if ((!partial || 'title' in b) && !String(b.title || '').trim()) return 'Give it a title';
  if ((!partial || 'date' in b) && !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return 'Choose a date';
  if (!b.anytime && (b.startTime || b.endTime) && !(String(b.endTime) > String(b.startTime))) return 'The end time must be after the start time';
  return '';
}

// on a free trial from a trial code (lib/discounts.js) and no card yet: t.expiresAt is the trial's last day
const onTrial = (t) => !!(t.billing && t.billing.status === 'trial' && t.billing.trial && t.expiresAt);
// an account with a last day of access (Alpha): days left (0 = today is the last day), and whether to warn yet
const expiryOf = (t) => {
  if (!t.expiresAt || tenancy.isDefault(t)) return null; const S = tenancy.platform().settings;
  const daysLeft = Math.round((Date.parse(t.expiresAt) - Date.parse(iso(new Date()))) / 864e5);
  return { lastDay: t.expiresAt, daysLeft, trial: onTrial(t), prepaid: !!(onTrial(t) && t.billing.trial.prepaid), banner: daysLeft <= (S.expiryBannerDays ?? 7), remind: daysLeft >= 0 && daysLeft <= (S.expiryReminderDays ?? 3) };
};
const whenText = (x) => (x.daysLeft === 0 ? 'today' : x.daysLeft === 1 ? 'tomorrow' : `on ${new Date(x.lastDay + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`);
// once a day (checked hourly): email each owner whose last day is close, once per end date
function remindExpiring() {
  for (const t of tenancy.platform().tenants) {
    const x = t.status === 'active' && expiryOf(t); if (!x || !x.remind || t.expiryReminded === t.expiresAt || (t.billing && t.billing.trial && t.billing.trial.cancelled)) continue;
    t.expiryReminded = t.expiresAt; tenancy.savePlatform();
    tenancy.run(t, () => {
      const o = db.users.find((u) => u.role === 'owner'); if (!o || !o.email) return;
      sendTemplate('expiryReminder', o.email, { name: o.name, business: db.company.name || t.name, plan: tenancy.planOf(t).name, when: whenText(x), days_left: String(x.daysLeft), link: `${baseUrl()}/settings/billing` }, { server: true }).catch(() => {});
    });
  }
}
// a paused account its owner can reopen by choosing a plan: paused because its subscription or last day of access ended (not paused from Alpha)
const canReopen = (t) => tenancy.reopenable(t);
// what the app shows a paused account: why, since when, and how the business fixes it (fixCard: a subscription is waiting on a card that works)
const pausedInfo = (t) => { const reason = tenancy.pauseReason(t); if (!reason) return null; const b = t.billing || {};
  return { reason, on: t.expiredOn || t.pausedOn || null, prepaid: !!(b.trial && b.trial.prepaid), canChoosePlan: canReopen(t), fixCard: reason === 'billing' && !!b.subscriptionId }; };
// the account's plan: which features it has, which pages are locked, its web addresses
function accountInfo() {
  const t = tenancy.current(); const plan = tenancy.planOf(t);
  return {
    slug: t.slug, plan: { id: plan.id, name: plan.name }, features: [...tenancy.featuresOf(t)], lockedPages: tenancy.lockedPages(t), betaPages: tenancy.betaPages(), siteUrl: tenancy.platformUrl(), maxUsers: plan.maxUsers || 0, extraUser: plan.maxUsers > 0 && plan.extraUser ? plan.extraUser : null,
    url: tenancy.tenantUrl(t), subdomainUrl: tenancy.subdomainUrl(t), rootDomain: tenancy.ROOT_DOMAIN, serverIp: process.env.SERVER_IP || '',
    domains: (t.domains || []).map(({ host, verified, primary, addedAt, verifiedAt }) => ({ host, verified: !!verified, primary: !!primary, addedAt, verifiedAt: verifiedAt || null })),
    marketplace: marketplace.isOn(tenancy.platform()), // Alpha → Settings → App Marketplace
    aiDescriptions: tenancy.aiOn('aiDescriptions'), aiRewrite: tenancy.aiOn('aiRewrite'), // Alpha → Settings → Integrations → AI
    navIcons: iconsLib.navIcons(), navOrder: iconsLib.order(), // the menu's icons, order and sections (Alpha → Settings → Menu)
    productName: tenancy.platform().settings.productName, product: brandLib.brand(), contactEmail: tenancy.platform().settings.contactEmail, helpUrl: tenancy.helpUrl(), ideasUrl: tenancy.ideasUrl(), managed: !tenancy.isDefault(),
    matrixPricing: matrixAllowed(t), matrixAddon: matrixInfo(t), // matrix line items: included by Alpha, or the paid add-on
    referrals: referrals.openTo(t), cardReady: !!stripeKey(), // card payments set up (App Settings → Payments → Card payments)
    // how: 'embedded' (set up in the app, payout bank changed in the app), 'standard' (own Stripe account), 'server' (the platform's own account), or null
    cardSetupType: secrets().stripeAccountId ? secrets().stripeAccountType || 'standard' : stripeKey() ? 'server' : null, payoutBank: secrets().stripeBank || null,
    expiry: (() => { const x = expiryOf(t); return x && { ...x, when: whenText(x) }; })(),
    paused: pausedInfo(t),
    texts: (() => { const u = smsUsage(); return u.limit && tenancy.has('sms') ? { sent: u.sent, limit: u.limit, warnAt: SMS_WARN_AT, plan: u.plan } : null; })(), // texts this month (the app's banner at 80% and 100%)
    industries: industries.CHOICES, // the Industry choices in Company Profile
    featureList: tenancy.FEATURES.filter((f) => f.key !== 'ai' || tenancy.aiForBusinesses()).map(({ key, label, desc }) => ({ key, label, desc, beta: tenancy.isBeta(key), included: tenancy.featuresOf(t).has(key) })), alwaysIncluded: tenancy.ALWAYS_INCLUDED,
  };
}
// the color of the business's client portal, or '' for the product's own color (none chosen or a plan without branding)
const accentColor = () => (tenancy.has('branding') && db.company.accentColor) || '';
const DEFAULT_BUTTON = '#2563eb';
app.get('/api/company', (req, res) => res.json({ ...db.company, defaultAccent: brandLib.siteColor('--brand') || DEFAULT_BUTTON, account: accountInfo() }));
// social media pages a business can list; a handle becomes the page's link on networks that use handles
const SOCIAL = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', youtube: 'YouTube', linkedin: 'LinkedIn', google: 'Google Business Profile', yelp: 'Yelp', nextdoor: 'Nextdoor' };
const SOCIAL_HANDLE = { facebook: (h) => `https://www.facebook.com/${h}`, instagram: (h) => `https://www.instagram.com/${h}`, tiktok: (h) => `https://www.tiktok.com/@${h}`, x: (h) => `https://x.com/${h}`, youtube: (h) => `https://www.youtube.com/@${h}` };
function socialUrl(k, v) {
  if (/^@?[A-Za-z0-9._-]{1,60}$/.test(v) && !/\.(com|net|org|co|app|biz|us)$/i.test(v) && SOCIAL_HANDLE[k]) return SOCIAL_HANDLE[k](v.replace(/^@/, ''));
  const u = /^https?:\/\//i.test(v) ? v : /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v) ? 'https://' + v : ''; // "facebook.com/page" without https://
  try { const p = new URL(u); return ['http:', 'https:'].includes(p.protocol) && p.hostname.includes('.') ? p.href : ''; } catch (e) { return ''; }
}
app.put('/api/company', (req, res) => {
  if (!tenancy.has('branding')) { delete req.body.brandColor; delete req.body.accentColor; } // custom branding is a plan feature
  if (req.body.accentColor && !/^#[0-9a-f]{6}$/i.test(req.body.accentColor)) return res.status(400).json({ error: 'Choose a valid accent color' });
  if (!tenancy.has('numberPrefixes')) for (const k of Object.keys(PREFIX_DEFAULTS)) delete req.body[k]; // so are custom number prefixes (saved ones keep working)
  for (const k of Object.keys(PREFIX_DEFAULTS)) if (k in req.body) {
    const v = String(req.body[k] ?? '').trim();
    if (v.length > 10 || !/^[A-Za-z0-9 #._\/-]*$/.test(v)) return res.status(400).json({ error: 'Number prefixes can be up to 10 letters, numbers, spaces or # . _ / -' });
    req.body[k] = v;
  }
  const b = req.body;
  for (const [k, ok] of Object.entries(REGIONAL)) if (k in b && !ok(b[k])) return res.status(400).json({ error: `Choose a valid ${k === 'timezone' ? 'time zone' : k === 'dateFormat' ? 'date format' : k === 'timeFormat' ? 'time format' : 'first day of the week'}` });
  // the kind of business (asked at sign-up; lib/industries.js): saved as industry + industryOther
  if ('industry' in b) { const i = industries.choose(b.industry, b.industryOther); if (i.error) return res.status(400).json({ error: i.error }); Object.assign(db.company, i); }
  if ('hours' in b) { const h = readHours(b.hours); if (!h) return res.status(400).json({ error: 'Check the business hours: each open day needs an end time after its start time' }); b.hours = h; }
  // social media pages (Company Profile): a link, or a handle for the networks that have them
  if (Object.keys(b).some((k) => k.startsWith('social_'))) {
    const social = {};
    for (const [k, label] of Object.entries(SOCIAL)) {
      const v = String(b['social_' + k] || '').trim().slice(0, 300); if (!v) continue;
      const url = socialUrl(k, v); if (!url) return res.status(400).json({ error: `Enter a link to your ${label} page${SOCIAL_HANDLE[k] ? ' or your handle, like @yourbusiness' : ''}` });
      social[k] = url;
    }
    db.company.social = social;
  }
  const allowed = ['name', 'email', 'phone', 'website', 'address', 'logo', 'taxRate', 'paymentTermsDays', 'invoiceFooter', 'brandColor', 'accentColor', 'zelleRecipient', 'zelleName', 'quoteDisclaimer', 'invoiceDisclaimer', ...Object.keys(PREFIX_DEFAULTS),
    ...ADDRESS_PARTS, 'taxIdName', 'taxIdNumber', 'taxName', 'taxDescription', 'hours', ...Object.keys(REGIONAL)];
  const handles = {}; // Venmo / Cash App / PayPal.me: a pasted link and a leading @ or $ are fine
  for (const m of PAY_APPS) if (m.field in b) { const h = payHandle(b[m.field], m.host); if (h === null) return res.status(400).json({ error: `Enter your ${m.label} ${m.what}, like ${m.eg}` }); handles[m.field] = h; }
  for (const k of allowed) if (k in b) db.company[k] = k === 'taxRate' || k === 'paymentTermsDays' ? Number(b[k]) || 0 : typeof b[k] === 'string' ? b[k].trim().slice(0, 500) : b[k];
  Object.assign(db.company, handles);
  if (b.lateFee && typeof b.lateFee === 'object') { try { db.company.lateFee = cleanLateFee(b.lateFee, db.company.lateFee); } catch (e) { return res.status(400).json({ error: e.message }); } }
  for (const k of ['addressPrivate', 'showHours']) if (k in b) db.company[k] = b[k] === true || b[k] === 'on' || b[k] === 'true';
  if (ADDRESS_PARTS.some((k) => k in b)) db.company.address = composeAddress(db.company); // the one-line address used everywhere else
  if ('savedDiscounts' in b) { // Saved discounts for quick select on quotes, jobs and invoices: a name, $ or %, and the amount
    const list = (Array.isArray(b.savedDiscounts) ? b.savedDiscounts : []).slice(0, 30).map((x) => ({ id: x && typeof x.id === 'string' && /^[a-z0-9]{4,16}$/.test(x.id) ? x.id : uid(), name: String((x && x.name) || '').trim().slice(0, 60), type: x && x.type === 'percent' ? 'percent' : 'flat', value: Math.round(Math.max(0, Number(x && x.value) || 0) * 100) / 100 }));
    const bad = list.find((x) => !x.name || !(x.value > 0) || (x.type === 'percent' && x.value > 100));
    if (bad) return res.status(400).json({ error: bad.name ? `Give “${bad.name}” an amount${bad.type === 'percent' ? ' from 0.01 to 100%' : ''}` : 'Give each saved discount a name' });
    db.company.savedDiscounts = list;
  }
  if (b.matrixItems && typeof b.matrixItems === 'object' && !matrixAllowed()) return res.status(403).json({ error: 'Matrix line items come with the matrix pricing add-on. The account owner can add it in App Settings → General → Matrix line items.' });
  if (b.matrixItems && typeof b.matrixItems === 'object') db.company.matrixItems = { on: !!b.matrixItems.on, sizes: mxList(b.matrixItems.sizes), colors: mxList(b.matrixItems.colors) }; // matrix line items
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
// every business uses the Worklio Pro app icon (Alpha → Settings → App icon), or the built-in one until that's uploaded
const APP_ICON_DIR = path.join(__dirname, 'public', 'img', 'app');
app.get('/favicon.ico', (req, res) => { if (!brandLib.serveIcon(req, res)) res.sendFile(path.join(APP_ICON_DIR, 'icon-192.png')); });

// Install on a phone (Add to Home Screen): the app opens full screen with the business's name and the app icon, on the same server and data as the website
app.get('/apple-touch-icon.png', (req, res) => { if (!brandLib.serveIcon(req, res)) res.sendFile(path.join(APP_ICON_DIR, 'icon-180.png')); });
app.get('/manifest.webmanifest', (req, res) => {
  const name = db.company.name || brandLib.brand().name || 'Worklio Pro'; const own = /\.(png|jpg)$/.exec(tenancy.platform().settings.icon || ''); // home screens need a PNG or JPG
  const icons = own ? [{ src: tenancy.platform().settings.icon, sizes: 'any', type: own[1] === 'png' ? 'image/png' : 'image/jpeg' }]
    : [192, 512].map((n) => ({ src: `/img/app/icon-${n}.png`, sizes: `${n}x${n}`, type: 'image/png', purpose: 'any maskable' }));
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.end(JSON.stringify({ id: '/', name, short_name: name.length > 12 ? name.split(/\s+/)[0].slice(0, 12) : name, start_url: '/', scope: '/', display: 'standalone',
    background_color: '#f1f5fb', theme_color: brandLib.siteColor('--brand') || DEFAULT_BUTTON, icons }));
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
// How businesses set up card payments (Alpha → Settings → Integrations → Stripe):
//   'standard' "Connect with Stripe": the business makes or signs in to its own Stripe account on Stripe's pages (the default)
//   'embedded' "Set up in Worklio Pro": Stripe's setup form inside the app; no Stripe login or dashboard for the business. Stripe
//              covers negative balances and charges its fees to the business's account, as with Connect with Stripe
//   'both'     each business picks
const cardSetup = () => { const v = tenancy.platform().settings.cardSetup; return ['standard', 'embedded', 'both'].includes(v) ? v : 'standard'; };
const stripePubKey = () => tenancy.platform().settings.stripePublishableKey || process.env.STRIPE_PUBLISHABLE_KEY || '';
// the ways a business without an account can start now (embedded needs the publishable key for Stripe's form)
const setupMethods = () => { const m = cardSetup(); return [m !== 'embedded' && 'standard', m !== 'standard' && stripePubKey() && 'embedded'].filter(Boolean); };
// "Connect with Stripe" (Online card payments feature): the business signs up for or finishes its Stripe account on Stripe's own pages
const connectReturn = () => `${baseUrl()}/settings?stripe=connected#payments`; // back to App Settings → Payments → Card payments
async function stripeOnboardingLink() {
  const key = stripeLib.platformKey(); const sec = { ...secrets() }; const t = tenancy.current();
  if (sec.stripeAccountId && sec.stripeAccountType === 'embedded') throw new Error('Card payments were set up in the app. Use Finish setup in App Settings → Payments → Card payments.');
  if (!sec.stripeAccountId && !setupMethods().includes('standard')) throw new Error('Set up card payments with the Set up card payments button instead');
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
  clearPayCache(); // Stripe told us something changed
  const sec = { ...secrets() }; if (!sec.stripeAccountId || !stripeLib.platformKey()) return;
  try {
    const a = await stripeLib.request(stripeLib.platformKey(), 'GET', 'accounts/' + encodeURIComponent(sec.stripeAccountId));
    const bank = a.external_accounts && a.external_accounts.data && a.external_accounts.data[0]; const req = a.requirements || {}; // Stripe gives bank names in capitals: shown as "Chase"
    Object.assign(sec, { stripeChargesEnabled: !!a.charges_enabled, stripePayoutsEnabled: !!a.payouts_enabled, stripeDetailsSubmitted: !!a.details_submitted, stripeAccountName: (a.settings && a.settings.dashboard && a.settings.dashboard.display_name) || (a.business_profile && a.business_profile.name) || a.email || '',
      stripeBank: bank ? { name: bank.bank_name ? bank.bank_name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : bank.brand ? `${bank.brand} card` : 'Bank account', last4: bank.last4 || '' } : null, stripeDue: (req.currently_due || []).length + (req.past_due || []).length });
    db.secrets = sec; save();
  } catch (e) { console.error('Stripe account check failed:', e.message); }
}
app.post('/api/integrations/stripe/connect', async (req, res) => {
  if (!stripeLib.platformKey()) return res.status(503).json({ error: 'Card payments aren’t available on this server yet. Contact support.' });
  try { res.json({ url: await stripeOnboardingLink() }); } catch (e) { console.error('Stripe Connect failed:', e.message); res.status(502).json({ error: `Stripe couldn’t start the setup: ${e.message}` }); }
});
// "Set up in Worklio Pro": make the business's account (owned by the platform) the first time, then a session for Stripe's
// setup form in the app (and, once set up, its form for updating details and the payout bank account)
app.post('/api/integrations/stripe/embedded', async (req, res) => {
  const key = stripeLib.platformKey(); if (!key) return res.status(503).json({ error: 'Card payments aren’t available on this server yet. Contact support.' });
  if (!stripePubKey()) return res.status(503).json({ error: 'Setting up card payments in the app isn’t available yet. Contact support.' });
  const sec = { ...secrets() }; const t = tenancy.current();
  if (sec.stripeAccountId && sec.stripeAccountType !== 'embedded') return res.status(400).json({ error: 'Card payments are connected with your own Stripe account. Manage them in Stripe.' });
  if (!sec.stripeAccountId && !setupMethods().includes('embedded')) return res.status(400).json({ error: 'Use Connect with Stripe to set up card payments' });
  try {
    if (!sec.stripeAccountId) {
      const a = await stripeLib.request(key, 'POST', 'accounts', { country: 'US', ...(db.company.email ? { email: db.company.email } : {}), 'business_profile[name]': db.company.name || t.name, 'metadata[tenantId]': t.id,
        // no Stripe Dashboard; Stripe collects the details (embedded form), covers negative balances, and charges its fees to the business's account
        'controller[stripe_dashboard][type]': 'none', 'controller[requirement_collection]': 'stripe', 'controller[losses][payments]': 'stripe', 'controller[fees][payer]': 'account',
        'capabilities[card_payments][requested]': 'true', 'capabilities[transfers][requested]': 'true', 'capabilities[us_bank_account_ach_payments][requested]': 'true' });
      Object.assign(sec, { stripeAccountId: a.id, stripeAccountType: 'embedded', stripeChargesEnabled: !!a.charges_enabled }); db.secrets = sec; save();
      t.stripeAccountId = a.id; t.stripeAccountType = 'embedded'; tenancy.savePlatform(); // the Connect webhook finds the account by this; Alpha counts the methods
    }
    const s = await stripeLib.request(key, 'POST', 'account_sessions', { account: sec.stripeAccountId,
      'components[account_onboarding][enabled]': 'true', 'components[account_onboarding][features][external_account_collection]': 'true',
      'components[account_management][enabled]': 'true', 'components[account_management][features][external_account_collection]': 'true',
      'components[notification_banner][enabled]': 'true' });
    res.json({ clientSecret: s.client_secret, publishableKey: stripePubKey() });
  } catch (e) { console.error('Stripe in-app setup failed:', e.message); res.status(502).json({ error: `Stripe couldn’t start the setup: ${e.message}` }); }
});
// Stripe sends people here when an onboarding link has expired: make a fresh one
app.get('/stripe/connect', async (req, res) => {
  if (!isAdmin(currentUser(req)) || !tenancy.has('onlinePayments') || !stripeLib.platformKey()) return res.redirect('/settings');
  try { res.redirect(await stripeOnboardingLink()); } catch (e) { res.redirect('/settings?stripe=error#payments'); }
});
// forget the connected account (and any older pasted keys); the business keeps its Stripe account and its money
app.post('/api/integrations/stripe/disconnect', (req, res) => {
  const t = tenancy.current(); delete t.stripeAccountId; tenancy.savePlatform();
  delete t.stripeAccountType; tenancy.savePlatform();
  const sec = { ...secrets() }; for (const k of ['stripeAccountId', 'stripeAccountType', 'stripeChargesEnabled', 'stripePayoutsEnabled', 'stripeDetailsSubmitted', 'stripeAccountName', 'stripeBank', 'stripeDue', 'stripeSecretKey', 'stripeWebhookSecret']) delete sec[k];
  db.secrets = sec; save(); res.json({ ok: true });
});
// the account's own email and Twilio accounts (owner/admin only: no role permission opens these routes). Blank secrets keep the saved ones.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
// From a quote, invoice or job line, the description already typed comes along as notes to polish (facts kept, nothing invented).
let anthropic = null;
const aiClient = () => {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) { const Anthropic = require('@anthropic-ai/sdk'); anthropic = new Anthropic(); }
  return anthropic;
};
// asks Claude for a short text and answers with { [key]: text }, or the error to show
async function aiWrite(res, what, input, key, request) {
  const Anthropic = require('@anthropic-ai/sdk');
  try {
    const r = await aiClient().beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default', // if the request is declined, the API retries it on a suitable fallback model
      output_config: { effort: 'low' },
      ...request,
    });
    if (r.stop_reason === 'refusal') return res.status(422).json({ error: `The AI couldn\u2019t write ${what === 'text' ? 'anything' : `a ${what}`} for ${input}. Try rewording it.` });
    const out = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!out) return res.status(502).json({ error: `The AI returned an empty ${what}. Try again.` });
    res.json({ [key]: out });
  } catch (err) {
    console.error(`AI ${what} failed:`, err.message);
    if (err instanceof Anthropic.AuthenticationError) return res.status(502).json({ error: 'Your ANTHROPIC_API_KEY was rejected. Check it in the .env file.' });
    if (err instanceof Anthropic.RateLimitError) return res.status(503).json({ error: 'The AI is busy right now. Try again in a minute.' });
    if (err instanceof Anthropic.APIError && err.status) return res.status(502).json({ error: `The AI service returned an error (${err.status}). Try again.` });
    res.status(502).json({ error: 'Couldn\u2019t reach the AI service. Check your internet connection.' });
  }
}
// bulk import into Products & services (rows are parsed and column-matched in the browser on /services/import)
app.post('/api/services/import', (req, res) => {
  const rows = Array.isArray(req.body && req.body.services) ? req.body.services : [];
  if (rows.length > 5000) return res.status(400).json({ error: 'Import up to 5,000 items at a time' });
  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  let added = 0;
  for (const r of rows) {
    const name = str(r.name, 200); if (!name) continue;
    const price = Math.max(0, Math.round((Number(String(r.price ?? '').replace(/[^0-9.-]/g, '')) || 0) * 100) / 100);
    db.services.push({ id: uid(), name, type: r.type === 'product' ? 'product' : 'service', description: str(r.description, 5000), price, unit: str(r.unit, 40), category: cleanCat(r.category) });
    added++;
  }
  save(); res.json({ added });
});
// bulk delete from Products & services (the checkboxes on /services); quotes and invoices that use an item keep their lines
app.post('/api/services/delete', (req, res) => {
  const ids = new Set((Array.isArray(req.body && req.body.ids) ? req.body.ids : []).map(String));
  if (!ids.size) return res.status(400).json({ error: 'Select at least one item' });
  let deleted = 0;
  for (let i = db.services.length - 1; i >= 0; i--) if (ids.has(db.services[i].id)) { db.services.splice(i, 1); deleted++; }
  catMaps.delete(db.services); save(); res.json({ deleted });
});
// bulk edit from Products & services: set the category (blank = none) and/or the type of the checked items; a field left out stays as it is
app.post('/api/services/bulk-edit', (req, res) => {
  const b = req.body || {}; const ids = new Set((Array.isArray(b.ids) ? b.ids : []).map(String));
  if (!ids.size) return res.status(400).json({ error: 'Select at least one item' });
  const setCat = typeof b.category === 'string'; const type = b.type === 'product' || b.type === 'service' ? b.type : '';
  if (!setCat && !type) return res.status(400).json({ error: 'Nothing to change' });
  let updated = 0;
  for (const s of db.services) { if (!ids.has(s.id)) continue; if (setCat) s.category = cleanCat(b.category); if (type) s.type = type; updated++; }
  catMaps.delete(db.services); save(); res.json({ updated });
});
// rename a category everywhere it's saved: catalog items, the category kept on quote/job/invoice lines (and repeating-job templates),
// and expenses' "Counts toward", so reports keep one name. Matched ignoring case; renaming onto a category already used merges the two.
app.post('/api/services/rename-category', (req, res) => {
  const from = cleanCat(req.body && req.body.from); const to = cleanCat(req.body && req.body.to);
  if (!from) return res.status(400).json({ error: 'Pick the category to rename' });
  if (!to) return res.status(400).json({ error: 'Type the new name' });
  const is = (c) => cleanCat(c).toLowerCase() === from.toLowerCase();
  let items = 0;
  for (const s of db.services) if (is(s.category)) { s.category = to; items++; }
  if (!items) return res.status(404).json({ error: 'No items have that category' });
  for (const col of ['quotes', 'jobs', 'invoices', 'jobSeries']) for (const d of db[col] || []) for (const i of (d && d.items) || []) if (i && i.cat && is(i.cat)) i.cat = to;
  for (const e of db.expenses || []) if (e.bizCat && is(e.bizCat)) e.bizCat = to;
  catMaps.delete(db.services); save(); res.json({ items, name: to });
});
app.post('/api/services/describe', async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 200);
  const kind = req.body.type === 'product' ? 'product' : 'service';
  const notes = String(req.body.notes || '').trim().slice(0, 2000);
  // Rewrite on a quote/invoice/job line: the tone picked from its menu
  const tone = { cheerful: 'Make it warm, upbeat and friendly.', casual: 'Make it relaxed and conversational, the way you’d explain it to a neighbor.', professional: 'Make it polished, clear and businesslike.',
    shorter: 'Make it as short as you can: one sentence, under 20 words, keeping only the key facts (this overrides the length limits above).' }[req.body.tone] || '';
  if (!tenancy.aiOn('aiDescriptions')) return res.status(403).json({ error: 'AI descriptions are turned off' });
  if (!name) return res.status(400).json({ error: 'Enter a name first' });
  const client = aiClient();
  if (!client) return res.status(503).json({ error: 'AI descriptions need ANTHROPIC_API_KEY in the .env file' });
  await aiWrite(res, 'description', 'that name', 'description', {
    system: `You write line-item descriptions for the quotes and invoices of ${db.company.name || 'a field service business'}, a field service business. The customer reads them.
Given the name of a ${kind}, write one or two plain sentences (under 40 words) saying what it includes or what the customer gets.
If the business gave notes, turn them into that description: keep every fact in them (it may run longer, up to about 80 words, to fit them) and fix spelling and grammar.
Plain text only: no markdown, no quotes, no price, no heading. Don't invent specifics such as brands, warranties, durations or quantities that the name or notes don't state.${tone ? `\n${tone}` : ''}`,
    messages: [{ role: 'user', content: `${kind === 'product' ? 'Product' : 'Service'} name: ${name}${notes ? `\n\nNotes from the business:\n${notes}` : ''}` }],
  });
});
// Rewrite in a quote's or invoice's Client message and Contract / Disclaimer boxes: polishes what's typed, in the tone picked from its menu
app.post('/api/ai/rewrite', async (req, res) => {
  const b = req.body || {}; const text = String(b.text || '').trim().slice(0, 8000); const doc = b.doc === 'invoice' ? 'invoice' : 'quote'; const terms = b.field === 'disclaimer';
  if (!tenancy.aiOn('aiRewrite')) return res.status(403).json({ error: 'AI rewriting is turned off' });
  if (!text) return res.status(400).json({ error: 'Type something first, then rewrite it' });
  if (!aiClient()) return res.status(503).json({ error: 'AI rewriting needs ANTHROPIC_API_KEY in the .env file' });
  const tone = { cheerful: 'Make it warm, upbeat and friendly.', casual: 'Make it relaxed and conversational.', professional: 'Make it polished, clear and businesslike.',
    shorter: terms ? 'Make it as short as you can without dropping any term.' : 'Make it as short as you can, keeping only the key facts.' }[b.tone] || '';
  await aiWrite(res, 'text', 'that text', 'text', {
    system: `You rewrite the ${terms ? 'contract / disclaimer terms' : 'message to the client'} on a${doc === 'invoice' ? 'n invoice' : ' quote'} from ${db.company.name || 'a field service business'}, a field service business. The client reads it.
Rewrite the text you're given and fix spelling and grammar. Keep every fact in it, and don't invent specifics such as prices, dates, brands, warranties or promises it doesn't state.${terms ? '\nThese are terms the client may be held to: keep every obligation, condition, number, date and time period with the same meaning. Don’t add, remove, soften or strengthen any term.' : ''}
Plain text only: no markdown, no quotes around it, no heading and no comments about the rewrite. Keep separate paragraphs or lines where the text has them.${tone ? `\n${tone}` : ''}`,
    messages: [{ role: 'user', content: `Text to rewrite:\n${text}` }],
  });
});

// generic list / get
app.get('/api/:col', (req, res, next) => {
  const col = req.params.col;
  if (!COLLECTIONS.includes(col)) return next();
  if (col === 'jobs') return res.json(db.jobs.map((j) => withRepeat(isMemberReq(req) ? jobForMember(j) : j)));
  if (col === 'clients' && isMemberReq(req)) return res.json(db.clients.map(clientForMember));
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
  let b = req.body || {}; delete b.noteEntries; delete b.seriesId; delete b.repeat; delete b.membershipId; delete b.memberDiscount; delete b.forms; // checklists only through /forms; notes only through /notes; repeats only through /repeat; service plans make their own
  if (col === 'jobs' && isMemberReq(req)) b = Object.fromEntries(Object.entries(b).filter(([k]) => MEMBER_JOB_FIELDS.includes(k)));
  if (col === 'staff') { // a new team member needs a name, an email and a mobile number
    const name = String(b.name || '').trim(); const email = String(b.email || '').trim(); const phone = String(b.phone || '').replace(/\D/g, '');
    if (!name) return res.status(400).json({ error: 'Enter the team member’s full name' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter the team member’s email address' });
    if (phone.length < 10) return res.status(400).json({ error: 'Enter the team member’s mobile number with the area code' });
  }
  if (col === 'tasks' || col === 'events') { const bad = calItemProblem(b); if (bad) return res.status(400).json({ error: bad }); }
  if (PAYMENT_FIELDS[col]) { b = { ...b }; PAYMENT_FIELDS[col].forEach((k) => delete b[k]); } // payments only through their own endpoints
  let doc = { ...b, id: uid(), createdAt: iso(new Date()) };
  if (DOC_NUM[col] && String(b.number || '').trim()) { const r = customNumber(col, b.number); if (r.error) return res.status(400).json({ error: r.error }); doc.number = r.number; }
  if (col === 'clients') { doc.portalToken = token(); doc.smsConsent = b.smsConsent ? { at: new Date().toISOString(), source: 'business' } : null; }
  if (col === 'quotes') {
    doc.number = doc.number || nextNumber('quotes'); doc.status = b.status || 'draft'; doc.token = token();
    if (!tenancy.has('quoteOptions')) { delete doc.options; delete doc.chosenOption; } // Good / Better / Best is a plan feature
    if (b.taxRate === undefined) doc.taxRate = db.company.taxRate; applyMemberDiscount(doc); computeTotals(doc); // a service plan member's discount
    const bad = optionsProblem(doc); if (bad) return res.status(400).json({ error: bad });
  }
  if (col === 'invoices') {
    doc.number = doc.number || nextNumber('invoices'); doc.status = b.status || 'draft'; doc.token = token(); doc.paidAt = null;
    doc.issueDate = b.issueDate || iso(new Date());
    doc.dueDate = b.dueDate || doc.issueDate; // default terms: due upon receipt
    if (b.taxRate === undefined) doc.taxRate = db.company.taxRate; applyMemberDiscount(doc); computeTotals(doc); // a service plan member's discount
  }
  if (col === 'jobs') {
    delete doc.signature;
    doc.number = nextNumber('jobs'); doc.status = b.status || 'scheduled'; doc.staffIds = b.staffIds || [];
    if (!doc.address && b.clientId) { const c = findClient(b.clientId); if (c) doc.address = c.address; }
    if (Array.isArray(b.items)) { if (b.taxRate === undefined) doc.taxRate = db.company.taxRate; computeTotals(doc); }
    autoForms(doc, (currentUser(req) || {}).name);
  }
  if (col === 'expenses') { doc.amount = Number(b.amount) || 0; doc.bizCat = cleanCat(b.bizCat); }
  if (col === 'services') { doc.price = Number(b.price) || 0; doc.category = cleanCat(b.category); homeDepot.clean(doc); catMaps.delete(db.services); }
  db[col].push(doc); save(); if (col === 'clients') optInText(doc).catch(() => {}); if (col === 'jobs') pushScheduleChange(null, doc, currentUser(req));
  res.status(201).json(col === 'invoices' ? withStatus(doc) : col === 'jobs' && isMemberReq(req) ? jobForMember(doc) : col === 'clients' && isMemberReq(req) ? clientForMember(doc) : doc);
});

// update
app.put('/api/:col/:id', (req, res, next) => {
  const col = req.params.col;
  if (!COLLECTIONS.includes(col)) return next();
  const i = db[col].findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  const protectedKeys = ['id', 'number', 'token', 'portalToken', 'createdAt', 'seriesId', 'repeat', 'membershipId', 'forms']; // checklists change only through /forms
  let upd = { ...req.body }; protectedKeys.forEach((k) => delete upd[k]); delete upd.noteEntries; // notes change only through /notes
  if (col === 'invoices') { delete upd.signedAt; delete upd.signedName; delete upd.signature; delete upd.lateFees; delete upd.jobIds; } // signatures only through /signature; the late fees charged and a combined invoice's jobs stay
  (PAYMENT_FIELDS[col] || []).forEach((k) => delete upd[k]);
  if (col === 'invoices' && (upd.status === 'paid' || db.invoices[i].status === 'paid')) delete upd.status; // paid only by its payments
  if (col === 'invoices' && upd.depositCreditRemoved && !db.invoices[i].depositCreditRemoved) delete upd.depositCreditRemoved; // a collected deposit stays credited
  const removeSignature = col === 'quotes' && upd.removeSignature === true; if (col === 'quotes') { delete upd.removeSignature; delete upd.signedAt; delete upd.signedName; delete upd.signature; } // signatures only from the client's quote page
  if (DOC_NUM[col] && String((req.body || {}).number || '').trim() && req.body.number !== db[col][i].number) { // renumber a quote / invoice
    const r = customNumber(col, req.body.number, req.params.id); if (r.error) return res.status(400).json({ error: r.error }); upd.number = r.number;
  }
  if (col === 'jobs' && isMemberReq(req)) upd = Object.fromEntries(Object.entries(upd).filter(([k]) => MEMBER_JOB_FIELDS.includes(k)));
  if (col === 'quotes' && !tenancy.has('quoteOptions') && Array.isArray(upd.options) && upd.options.length) delete upd.options; // Good / Better / Best is a plan feature (turning options off always works)
  if (col === 'tasks' || col === 'events') { const bad = calItemProblem({ ...db[col][i], ...upd }); if (bad) return res.status(400).json({ error: bad }); }
  if (col === 'clients' && 'smsConsent' in upd) upd.smsConsent = upd.smsConsent ? db.clients[i].smsConsent || { at: new Date().toISOString(), source: 'business' } : null; // keeps when and where they first agreed
  let doc = { ...db[col][i], ...upd };
  // sent back to the client (Draft or Sent) before any deposit is paid: they approve and sign again, so the old signature goes
  if (col === 'quotes' && ['draft', 'sent'].includes(doc.status) && doc.status !== db.quotes[i].status && !doc.depositPaidAt) {
    doc.signedAt = null; doc.signedName = null; delete doc.signature; if (doc.depositStatus === 'pending') doc.depositStatus = null;
    doc.chosenOption = null; // they pick an option again
  }
  if (col === 'quotes' || col === 'invoices' || (col === 'jobs' && Array.isArray(doc.items))) computeTotals(doc); // jobs are priced once they have line items
  if (col === 'quotes') { if (Array.isArray(upd.items)) snapQuote.carryNeedsPrice(db[col][i], doc); else if (doc.aiDraft && doc.status !== 'draft') delete doc.aiDraft; const bad = optionsProblem(doc); if (bad) return res.status(400).json({ error: bad }); }
  // a signed quote with its deposit paid: any change to it removes the client's signature, once the business confirms (the quote editor asks first).
  // The business then marks it Awaiting response and re-sends it so the client signs again.
  const was = db[col][i];
  if (col === 'quotes' && was.signedAt && was.depositPaidAt && doc.signedAt && quoteTerms(doc) !== quoteTerms(computeTotals(structuredClone(was)))) {
    if (!removeSignature) return res.status(409).json({ error: 'Saving these changes removes the client’s signature. Reload the quote and confirm first.' });
    doc.signedAt = null; doc.signedName = null; delete doc.signature;
  }
  if (col === 'jobs') { if (db.jobs[i].signature) doc.signature = db.jobs[i].signature; else delete doc.signature; } // signatures only via /signature
  if (col === 'invoices') { // payments change only through their own endpoints, never through an invoice edit
    if (db.invoices[i].payments) doc.payments = db.invoices[i].payments; else delete doc.payments;
    if ((doc.payments || []).length) settleInvoice(doc);
  }
  if (col === 'staff' && isOwnerStaff(doc) && doc.status === 'deactivated') return res.status(400).json({ error: 'The account owner can’t be deactivated' });
  if (col === 'expenses') { doc.amount = Number(doc.amount) || 0; doc.bizCat = cleanCat(doc.bizCat); }
  if (col === 'services') { doc.price = Number(doc.price) || 0; doc.category = cleanCat(doc.category); homeDepot.clean(doc); catMaps.delete(db.services); }
  if (col === 'quotes' && was.signature && !doc.signature) removeSignatureFile(was);
  if (col === 'jobs' && doc.status === 'completed' && was.status !== 'completed' && tenancy.has('jobForms')) { // a checklist that has to be finished first
    const open = (doc.forms || []).filter((f) => f.requiredToComplete && !f.completedAt); if (open.length) return res.status(400).json({ error: `Finish ${open.length === 1 ? `the “${open[0].name}” checklist` : `the ${open.length} required checklists`} before marking this job complete`, formId: open[0].id });
  }
  if (col === 'jobs' && doc.status === 'completed' && was.status !== 'completed') doc.completedAt = iso(new Date()); // the "job completed" automations count from this
  const following = col === 'jobs' && req.query.following && doc.seriesId && tenancy.has('recurringJobs') ? applyToFollowing(doc, upd, req.query.following) : 0; // Save → "This and following visits"
  if (col === 'jobs') matchFormsOnEdit(was, doc, (currentUser(req) || {}).name); // new line items can bring their checklists
  db[col][i] = doc; save(); if (col === 'clients' && doc.smsConsent && !was.smsConsent) optInText(doc).catch(() => {}); if (col === 'jobs') { pushScheduleChange(was, doc, currentUser(req)); if (doc.status === 'completed' && was.status !== 'completed') { askForReview('job', doc); jobPosts.maybeDraft(doc); } }
  res.json(col === 'invoices' ? withStatus(doc) : col === 'jobs' ? { ...withRepeat(isMemberReq(req) ? jobForMember(doc) : doc), ...(following ? { following } : {}) } : col === 'clients' && isMemberReq(req) ? clientForMember(doc) : doc);
});

app.delete('/api/:col/:id', (req, res, next) => {
  const col = req.params.col;
  if (!COLLECTIONS.includes(col)) return next();
  const i = db[col].findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  if (col === 'staff' && isOwnerStaff(db.staff[i])) return res.status(400).json({ error: 'The account owner can’t be removed from the team' });
  const [removed] = db[col].splice(i, 1); if (col === 'jobs') { pushScheduleChange(removed, null, currentUser(req)); forgetEmptySeries(removed.seriesId); } // deleting a repeating job's visit skips it; with none left, the repeat ends
  if (col === 'staff') db.users.filter((u) => u.staffId === removed.id && u.role !== 'owner').forEach(removeUser);
  if (col === 'staff') (db.timeOff || []).filter((r) => r.staffId === removed.id && (r.status === 'pending' || (r.status === 'approved' && r.to >= iso(new Date())))).forEach((r) => { r.status = 'canceled'; r.canceledBy = 'Removed from the team'; }); // nothing left waiting for someone who's gone
  if (col === 'jobs') (removed.forms || []).forEach((f) => formPhotos(f).forEach(rmFormPhoto));
  if (col === 'photos' && removed.file) fs.rmSync(path.join(uploadDir(), path.basename(removed.file)), { force: true });
  save(); res.json({ ok: true });
});

// photos
// a signature collected on the team member's phone for an invoice
app.post('/api/invoices/:id/signature', (req, res) => {
  const d = db.invoices.find((x) => x.id === req.params.id); if (!d) return res.status(404).json({ error: 'Not found' });
  const name = String((req.body && req.body.name) || '').trim().slice(0, 100); if (!name) return res.status(400).json({ error: 'Enter the name of the person signing' });
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec((req.body && req.body.dataUrl) || '');
  if (!m || m[1].length < 200) return res.status(400).json({ error: 'Please sign in the box first' });
  if (m[1].length > 2e6) return res.status(400).json({ error: 'That signature image is too large' });
  const file = `sig-${token()}.png`; fs.writeFileSync(path.join(uploadDir(), file), Buffer.from(m[1], 'base64')); const u = currentUser(req); removeSignatureFile(d);
  d.signedAt = iso(new Date()); d.signedName = name; d.signature = { file: `/uploads/${file}`, method: 'drawn', collectedBy: u ? u.name : '' };
  addSignedNote('invoice', d); save(); res.status(201).json(withStatus(d));
});
// ---- notes on a quote, job or invoice: text, files and photos, and where else they show (internal: clients never get them) ----
const NOTE_LINKS = { quotes: ['jobs'], jobs: ['invoices'], invoices: ['jobs'] };
const NOTE_FILE_RE = /^\/uploads\/((?:note|signed)-[a-f0-9]+\.(?:png|jpg|webp|pdf))$/;
const NOTE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' };
const rmNoteFile = (f) => { const m = NOTE_FILE_RE.exec((f && f.url) || ''); if (m) fs.rm(path.join(uploadDir(), m[1]), { force: true }, () => {}); };
function saveNoteFiles(list) { // [{ name, dataUrl }] → stored files. The name is what people see; the address is unguessable, since uploads are served without login
  return (Array.isArray(list) ? list : []).slice(0, 10).map((x) => {
    const m = /^data:([\w/.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec((x && x.dataUrl) || ''); const ext = m && NOTE_TYPES[m[1]]; if (!ext) throw Object.assign(new Error('Attach a photo (PNG, JPG or WebP) or a PDF'), { status: 400 });
    const file = `note-${token()}.${ext}`; fs.writeFileSync(path.join(uploadDir(), file), Buffer.from(m[2], 'base64'));
    return { name: String(x.name || file).replace(/[\\/]+/g, '-').slice(0, 120), url: `/uploads/${file}`, type: ext === 'pdf' ? 'pdf' : 'image' };
  });
}
for (const col of ['quotes', 'jobs', 'invoices']) {
  const docOf = (req) => db[col].find((x) => x.id === req.params.id);
  const reply = (req, res, d) => res.json(d.noteEntries || []);
  const links = (b) => (Array.isArray(b.links) ? b.links.filter((k) => NOTE_LINKS[col].includes(k)) : []);
  app.post(`/api/${col}/:id/notes`, (req, res) => {
    const d = docOf(req); if (!d) return res.status(404).json({ error: 'Not found' }); const b = req.body || {}; const text = String(b.text || '').trim().slice(0, 5000);
    let files; try { files = saveNoteFiles(b.add); } catch (e) { return res.status(e.status || 500).json({ error: e.message }); }
    if (!text && !files.length) return res.status(400).json({ error: 'Write a note or attach a file' });
    const u = currentUser(req); d.noteEntries = [{ id: uid(), text, at: new Date().toISOString(), by: u ? u.name : '', files, links: links(b) }, ...(d.noteEntries || [])]; save(); reply(req, res, d);
    if (col === 'jobs' && files.some((f) => f.type === 'image')) jobPosts.maybeDraft(d); // a photo on a finished job can make its post
  });
  app.put(`/api/${col}/:id/notes/:note`, (req, res) => {
    const d = docOf(req); const n = d && (d.noteEntries || []).find((x) => x.id === req.params.note); if (!n) return res.status(404).json({ error: 'Not found' }); const b = req.body || {};
    let added; try { added = saveNoteFiles(b.add); } catch (e) { return res.status(e.status || 500).json({ error: e.message }); }
    const keep = Array.isArray(b.keep) ? n.files.filter((f) => b.keep.includes(f.url)) : n.files; const text = String(b.text || '').trim().slice(0, 5000);
    if (!text && !keep.length && !added.length) return res.status(400).json({ error: 'Write a note or attach a file' });
    n.files.filter((f) => !keep.includes(f)).forEach(rmNoteFile); n.text = text; n.files = [...keep, ...added]; n.links = links(b); n.editedAt = new Date().toISOString(); save(); reply(req, res, d);
  });
  app.delete(`/api/${col}/:id/notes/:note`, (req, res) => {
    const d = docOf(req); const n = d && (d.noteEntries || []).find((x) => x.id === req.params.note); if (!n) return res.status(404).json({ error: 'Not found' });
    (n.files || []).forEach(rmNoteFile); d.noteEntries = d.noteEntries.filter((x) => x !== n); save(); reply(req, res, d);
  });
}
// after signing: a new note holding the signed copy as a PDF, one per signature. The signature itself is already saved, so a problem here never stops it.
function addSignedNote(kind, d) {
  try {
    const file = `signed-${token()}.pdf`; fs.writeFileSync(path.join(uploadDir(), file), signedPdf(kind, d)); const num = String(d.number).replace(/[^\w-]+/g, ''); const nth = (d.noteEntries || []).filter((n) => n.signed).length + 1;
    d.noteEntries = [{ id: uid(), text: `Signed copy of ${kind} #${d.number}${nth > 1 ? ` (signature ${nth})` : ''}`, at: new Date().toISOString(), by: brandLib.brand().name || 'Worklio Pro', signed: true, links: [], files: [{ name: `signed-copy-${kind}-${num}${nth > 1 ? `-${nth}` : ''}.pdf`, url: `/uploads/${file}`, type: 'pdf' }] }, ...(d.noteEntries || [])];
  } catch (e) { console.error('Signed copy failed:', e.message); }
}
// the signed copy: the business and its logo, who it's for, a box of the key facts, the line items (a job's show no prices), terms and the signature
function signedPdf(kind, d) {
  const job = kind === 'job'; const q = kind === 'quote'; const co = db.company; const c = findClient(d.clientId) || {}; const pdf = createPdf(); const L = 58; const R = 554; const BLUE = '#5b94c5'; const GRAY = '#f1f1f1'; const INK = '#111827';
  const read = (u) => { const m = /^\/uploads\/([\w.-]+)$/.exec(u || ''); if (!m) return null; try { return fs.readFileSync(path.join(uploadDir(), m[1])); } catch (e) { return null; } };
  const on = (k) => kind !== 'invoice' || d[k] !== 'off'; let y = 72;
  pdf.text(L, y, co.name || '', { size: 15, bold: true, color: INK }); y += 18;
  if (co.phone) { pdf.text(L, y, fmtUsPhone(co.phone), { size: 10, color: INK }); y += 14; }
  const reach = [co.email, co.website && co.website.replace(/^https?:\/\//, '')].filter(Boolean).join('  |  '); if (reach) { pdf.text(L, y, reach, { size: 10, color: INK }); y += 14; }
  const logo = read(co.logo); if (logo) pdf.image(logo, R - 120, 60, 120, 60, { alignRight: true });
  // who it's for, and the facts in a box
  const top = 150; let ly = top + 8; pdf.text(L, ly, 'RECIPIENT:', { size: 8.5, bold: true, color: INK }); ly += 22; pdf.text(L, ly, c.name || '', { size: 12, bold: true, color: INK }); ly += 16;
  const where = String(d.address || c.address || '').split(',').map((s) => s.trim()).filter(Boolean); const lines = where.length > 2 ? [where.slice(0, -2).join(', '), where.slice(-2).join(', ')] : where.length ? [where.join(', ')] : [];
  for (const t of lines) ly = pdf.para(L, ly, t, 240, { size: 10, color: INK, lineHeight: 14 });
  const word = job ? 'Job' : q ? 'Quote' : 'Invoice'; const bx = 322; const facts = (job ? [['Scheduled', d.date ? niceDate(d.date) : 'Not Scheduled'], ['Description', d.title || '']] : q ? [['Created', niceDate(String(d.createdAt || '').slice(0, 10))], ['Description', d.title || ''], ...(hasOptions(d) && d.chosenOption ? [['Option', shownOption(d).name]] : []), ['Total', money(d.total || 0)]] : [['Issued', niceDate(d.issueDate)], ['Due', niceDate(d.dueDate)], ['Description', d.subject || ''], ['Total', money(d.total || 0)]]).filter(([, v]) => v);
  pdf.rect(bx, top, R - bx, 34, { fill: BLUE }); pdf.text(bx + 11, top + 22, `${word} #${d.number}`, { size: 14, bold: true, color: '#ffffff' }); pdf.rect(bx, top + 34, R - bx, facts.length * 21, { fill: GRAY });
  facts.forEach(([k, v], i) => { const ry = top + 34 + i * 21 + 15; pdf.text(bx + 11, ry, k, { size: 10, color: INK }); pdf.text(R - 11, ry, v.length > 28 ? v.slice(0, 27) + '…' : v, { size: 10, color: INK, align: 'right' }); });
  y = Math.max(ly, top + 34 + facts.length * 21) + 16;
  // line items
  const qtyOn = on('showQty'); const unitOn = !job && on('showUnit'); const lineOn = !job && on('showLineTotals'); const cDesc = L + 140; const cQty = job ? R - 6 : unitOn || lineOn ? 400 : R - 6; const cUnit = 474; const descW = (cQty - 36) - cDesc;
  const head = () => { pdf.rect(L, y, R - L, 22, { fill: BLUE }); const o = { size: 10, bold: true, color: '#ffffff' }; pdf.text(L + 6, y + 15, 'Product/Service', o); pdf.text(cDesc + 6, y + 15, 'Description', o); if (qtyOn) pdf.text(cQty, y + 15, 'Qty.', { ...o, align: 'right' }); if (unitOn) pdf.text(cUnit, y + 15, 'Unit price', { ...o, align: 'right' }); if (lineOn) pdf.text(R - 6, y + 15, 'Total', { ...o, align: 'right' }); y += 22; };
  head();
  for (const it of q && hasOptions(d) ? optionItems(d, shownOption(d).id) : d.items || []) { // a quote with options: the option signed for
    const need = Math.ceil(pdf.width(it.details || '', 10) / Math.max(40, descW)) + String(it.details || '').split('\n').length; if (y + 26 + need * 13 > 720) { pdf.addPage(); y = 64; head(); }
    const tp = y + 16; const ind = it.sub ? 12 : 0; const inc = included(it); const hd = heading(it); const a = pdf.para(L + 6 + ind, tp, it.desc, 128 - ind, { size: 10, color: INK, lineHeight: 13 }); let b = tp; for (const t of String(it.details || '').split('\n').filter((s) => s.trim())) b = pdf.para(cDesc + 6, b, t, descW, { size: 10, color: INK, lineHeight: 13 });
    if (qtyOn && !inc && !hd) pdf.text(cQty, tp, String(it.qty), { size: 10, color: INK, align: 'right' }); if (unitOn && !inc && !hd) pdf.text(cUnit, tp, money(it.price), { size: 10, color: INK, align: 'right' }); if (lineOn && !hd) pdf.text(R - 6, tp, inc ? 'Included' : money(round2(it.qty * it.price)), { size: 10, color: INK, align: 'right' }); y = Math.max(a, b) + 4;
  }
  pdf.line(L, y, R, y, { color: '#a3a3a3', w: 1.5 }); y += 8;
  if (!job) { // totals
    const row = (k, v, bold) => { if (y + 20 > 720) { pdf.addPage(); y = 64; } pdf.text(R - 130, y + 12, k, { size: 10, bold, color: INK }); pdf.text(R - 6, y + 12, v, { size: 10, bold, color: INK, align: 'right' }); y += 18; };
    row('Subtotal', money(d.subtotal || 0)); if (d.discount > 0) row(discLabel(d), '-' + money(d.discount)); if (Number(d.taxRate)) row(`Tax (${d.taxRate}%)`, money(d.tax || 0)); row('Total', money(d.total || 0), true);
    if (q && d.depositFee > 0) row('Required deposit', money(d.depositFee)); if (!q) row('Balance due', money(withStatus(d).balanceDue ?? d.total), true);
  }
  // terms on the left, the date and the signature on the right
  const when = job ? d.signature && d.signature.signedAt : d.signedAt; const who = job ? d.signature && d.signature.name : d.signedName; y = Math.max(y + 34, job ? 560 : y + 34); if (y + 70 > 730) { pdf.addPage(); y = 90; }
  const sigY = y; const terms = job ? (d.signature && d.signature.statement) || '' : d.disclaimer || ''; const sx = 372; const line = sigY + 34;
  pdf.text(sx, line - 4, when ? niceDate(String(when).slice(0, 10)) : '', { size: 10, color: INK }); const pic = read(d.signature && d.signature.file); if (pic) pdf.image(pic, sx + 66, line - 46, R - sx - 66, 54, { alignBottom: true });
  pdf.line(sx, line, R, line, { color: '#6b7280', w: 0.75 }); pdf.text(sx, line + 13, 'Date', { size: 8, color: INK }); pdf.text(sx + 84, line + 13, 'Client Signature', { size: 8, color: INK }); if (who) pdf.text(sx + 84, line + 24, who, { size: 8, color: INK });
  let ty = sigY; for (const para of String(terms).split('\n')) { if (ty > 730) { pdf.addPage(); ty = 64; } ty = para.trim() ? pdf.para(L, ty, para, 290, { size: 9, color: INK, lineHeight: 11.5 }) : ty + 6; }
  return pdf.toBuffer(`Signed ${word.toLowerCase()} ${d.number}`);
}
// ---- client signature on a job: collected on the team member's device (finger or mouse), saved as a PNG ----
// Anyone who can open the job may collect it; only managers / admins can remove one (so a technician can't overwrite it).
app.post('/api/jobs/:id/signature', (req, res) => {
  const j = db.jobs.find((x) => x.id === req.params.id); if (!j) return res.status(404).json({ error: 'Job not found' });
  const u = currentUser(req);
  const b = req.body || {}; const name = String(b.name || '').trim().slice(0, 100);
  if (!name) return res.status(400).json({ error: 'Enter the name of the person signing' });
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(b.dataUrl || '');
  if (!m || m[1].length < 200) return res.status(400).json({ error: 'Please sign in the box first' });
  if (m[1].length > 2e6) return res.status(400).json({ error: 'That signature image is too large' });
  const file = `sig-${token()}.png`; // unguessable name: uploads are served without login
  fs.writeFileSync(path.join(uploadDir(), file), Buffer.from(m[1], 'base64'));
  removeSignatureFile(j);
  j.signature = { file: `/uploads/${file}`, name, statement: String(b.statement || '').trim().slice(0, 300), signedAt: new Date().toISOString(), collectedBy: u ? u.name : '' };
  addSignedNote('job', j); save(); res.status(201).json(isMemberReq(req) ? jobForMember(j) : j);
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
  jobPosts.maybeDraft(db.jobs.find((j) => j.id === jobId)); // a photo on a finished job can make its post
});

// ---------- workflow ----------
const quoteLink = (q) => `${baseUrl()}/p/quote/${q.token}`;
const invoiceLink = (inv) => `${baseUrl()}/pay/${inv.token}`;
// a text written in the Send Text box: the business's message, then the link and how to opt out. notify() puts "Worklio Pro for <business>:" in front.
// The box previews the same thing.
function smsWithLink(message, label, link) {
  const m = String(message || '').trim().slice(0, 320);
  return `${m}\n\n${label} ${shortLink(link)}\n\nReply STOP to opt out.`;
}

// ---------- email templates (edited on Settings → Email Templates, stored in db.emailTemplates) ----------
const EMAIL_TEMPLATES = {
  quote: {
    label: 'Quote', description: 'Sent when you send a quote to a client.',
    subject: 'Quote {{quote_number}} from {{company_name}}',
    body: '# Your quote is ready\n\nHello {{client_name}},\n\nThank you for asking us to quote on your project {{quote_title}}.\n\nThe quote total is {{total}} as of {{sent_date}}.\n\nIf you have any questions or concerns regarding this quote, please don\x27t hesitate to get in touch with us at {{company_email}}.\n\n[View and approve quote]({{link}})\n\nThank you,\n{{company_name}}',
    vars: { client_name: 'Client name', company_name: 'Your business name', company_email: 'Your business email', quote_number: 'Quote number', sent_date: 'Date the quote is sent', quote_title: 'Quote title', total: 'Quote total', link: 'Link to view and approve' },
  },
  invoice: {
    label: 'Invoice', description: 'Sent when you send an invoice to a client.',
    subject: 'Invoice {{invoice_number}} from {{company_name}}',
    body: '# Invoice {{invoice_number}}\n\nHello {{client_name}},\n\nInvoice {{invoice_number}} for **{{total}}** is due {{due_date}}. You can view it and pay securely online.\n\n[View and pay invoice]({{link}})\n\nThank you for your business,\n{{company_name}}',
    vars: { client_name: 'Client name', company_name: 'Your business name', company_email: 'Your business email', invoice_number: 'Invoice number', sent_date: 'Date the invoice is sent', total: 'Invoice total', due_date: 'Due date', link: 'Link to view and pay' },
  },
  reminder: {
    label: 'Appointment reminder', description: 'Sent when you send a job reminder by email.',
    subject: 'Appointment reminder from {{company_name}}',
    body: '# Appointment reminder\n\nHello {{client_name}},\n\nThis is a reminder of your appointment with us:\n\n> **{{job_title}}**\n> {{date}} at {{time}}\n> {{address}}\n\nNeed to change it? Just reply to this email.\n\n{{company_name}}',
    vars: { client_name: 'Client name', company_name: 'Your business name', company_email: 'Your business email', job_number: 'Job number', job_title: 'Job title', date: 'Appointment date', time: 'Start time', address: 'Job address' },
  },
  onMyWay: {
    label: 'On my way', description: 'Sent when a team member taps On my way on a job, to clients who don’t get texts.',
    subject: '{{staff_name}} is on the way',
    body: '# We\x27re on the way\n\nHello {{client_name}},\n\n{{staff_name}} from {{company_name}} is heading to you now and should arrive in about **{{eta}}** (around {{arrival_time}}).\n\n> **{{job_title}}**\n> {{address}}\n\nSee you soon,\n{{company_name}}',
    vars: { client_name: 'Client name', company_name: 'Your business name', company_email: 'Your business email', staff_name: 'Team member on the way', eta: 'Minutes until they arrive', arrival_time: 'About when they arrive', job_number: 'Job number', job_title: 'Job title', address: 'Job address' },
  },
  receipt: {
    label: 'Payment receipt', description: 'Sent when a client pays online, if you turned on email receipts in App Settings.',
    subject: 'Receipt from {{company_name}}',
    body: '# Thank you for your payment\n\nHello {{client_name}},\n\nWe received your payment of **{{amount}}** for {{paid_for}}.\n\n> Paid on {{date}}\n> Payment reference: {{reference}}\n\nThank you,\n{{company_name}}',
    vars: { client_name: 'Client name', company_name: 'Your business name', company_email: 'Your business email', amount: 'Amount paid', paid_for: 'What was paid, e.g. Invoice INV-3010', date: 'Payment date', reference: 'Payment reference' },
  },
  reviewRequest: {
    label: 'Review request', description: 'Sent when a job is completed or an invoice is paid, if you turned this on in Reviews.',
    subject: 'How did we do, {{client_name}}?',
    body: '# How did we do?\n\nHello {{client_name}},\n\nThanks for choosing {{company_name}} for {{work}}. We\x27d love to hear how it went.\n\n[Leave a review]({{link}})\n\nThank you,\n{{company_name}}',
    vars: { client_name: 'Client name', company_name: 'Your business name', company_email: 'Your business email', work: 'The job or invoice title', link: 'Link to leave a review' },
  },
  reviewReply: {
    label: 'Reply to a review', description: 'Sent the first time you reply to a client’s review in Reviews.',
    subject: '{{company_name}} replied to your review',
    body: '# We replied to your review\n\nHello {{client_name}},\n\nThanks for your review of {{work}}. Here\x27s our reply:\n\n> {{reply}}\n\n[See your review]({{link}})\n\nThank you,\n{{company_name}}',
    vars: { client_name: 'Client name', company_name: 'Your business name', company_email: 'Your business email', work: 'The job or invoice title', reply: 'Your reply', link: 'Link to their review' },
  },
  portal: {
    label: 'Client portal login', description: 'Sent when you choose Send Login Email on a client’s profile.',
    subject: 'Your client portal for {{company_name}}',
    body: '# Your client portal\n\nHello {{client_name}},\n\nIn your client portal you can see your upcoming visits, quotes and invoices, pay online and ask us for more work.\n\n[Open my client portal]({{link}})\n\nKeep this email: the link is yours alone and works any time. Questions? Reach us at {{company_email}}.\n\nThank you,\n{{company_name}}',
    vars: { client_name: 'Client name', company_name: 'Your business name', company_email: 'Your business email', link: 'Link to their client portal' },
  },
};
const emailTemplate = (key) => ({ subject: EMAIL_TEMPLATES[key].subject, body: EMAIL_TEMPLATES[key].body, ...((db.emailTemplates || {})[key] || {}) });
const niceDate = (s) => {
  if (!s) return '';
  const [y, m, d] = String(s).slice(0, 10).split('-'); const f = db.company.dateFormat;
  return f === 'MM/DD/YYYY' ? `${m}/${d}/${y}` : f === 'DD/MM/YYYY' ? `${d}/${m}/${y}` : f === 'YYYY-MM-DD' ? `${y}-${m}-${d}` : new Date(s.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
// the business's emails to clients: styled like the platform's emails, with the business's logo, name and brand color (lib/emails.js)
// US numbers as (713) 555-0100, like the phone box in Company Profile (public/app.js fmtUsPhone); other international numbers stay as typed
const fmtUsPhone = (s) => { const t = String(s || '').trim(); let d = t.replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') d = d.slice(1); else if (/^\+/.test(t)) return t; return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : t; };
const companyBrand = (origin = baseUrl()) => ({ name: db.company.name || 'Your business', logoUrl: db.company.logo ? origin.replace(/\/+$/, '') + db.company.logo : '', color: db.company.brandColor,
  contact: [fmtUsPhone(db.company.phone), db.company.email, db.company.website] });
function renderEmail(key, vars, t = emailTemplate(key), origin) { const m = emails.renderBusiness(t, { company_email: db.company.email || '', ...vars }, companyBrand(origin)); return { ...m, body: m.text }; }

app.get('/api/email-templates', (req, res) => res.json(Object.entries(EMAIL_TEMPLATES).map(([key, d]) => {
  const t = emailTemplate(key);
  return { key, label: d.label, description: d.description, vars: d.vars, subject: t.subject, body: t.body, defaultSubject: d.subject, defaultBody: d.body, custom: !!(db.emailTemplates || {})[key] };
})));
// the editor's preview: what's in the form (saved or not) with the sample details it sends, logo loaded from this page's own address
app.post('/api/email-templates/:key/preview', (req, res) => {
  const key = req.params.key; if (!EMAIL_TEMPLATES[key]) return res.status(404).json({ error: 'Unknown template' });
  const b = req.body || {}; const vars = Object.fromEntries(Object.entries(b.vars || {}).map(([k, v]) => [k, String(v ?? '').slice(0, 300)]));
  const m = renderEmail(key, vars, { subject: String(b.subject || ''), body: String(b.body || '') }, `${/^https/.test(process.env.BASE_URL || '') ? 'https' : 'http'}://${req.headers.host}`);
  res.json({ subject: m.subject, html: m.html });
});
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
  const empty = optionsEmpty(q) || snapQuote.unpricedProblem(q); if (empty) return res.status(400).json({ error: empty }); // every option needs its own line item, and every item a price, before the client sees it
  const channels = (req.body.channels && req.body.channels.length) ? req.body.channels : ['email'];
  const link = quoteLink(q); const co = db.company.name;
  const results = [];
  const email = renderEmail('quote', docVars('quote', q));
  if (channels.includes('email') && req.body.email) { const r = await emailDoc(req, 'quote', q); if (r.error) return res.status(400).json(r); results.push(...r.results); }
  for (const ch of channels) {
    if (ch === 'email' && req.body.email) continue;
    results.push(await notify({ clientId: q.clientId, channel: ch, kind: 'quote', refId: q.id, refNumber: q.number,
      subject: email.subject, html: ch === 'email' ? email.html : '', body: ch === 'email' ? email.body : req.body.message ? smsWithLink(req.body.message, 'View your quote here', link) : `Quote ${q.number} (${money(q.total)}) is ready: ${shortLink(link)} Reply STOP to opt out.` }));
  }
  if (q.status === 'draft') q.status = 'sent'; if (!q.sentAt) q.sentAt = iso(new Date());
  save(); res.json({ quote: q, results });
});

// approving a quote with options needs one of them: an option's id → it; nothing needed (no options, or one already chosen) → null; missing → false
const pickOption = (q, id) => (!hasOptions(q) ? null : q.options.some((o) => o.id === id) ? id : q.chosenOption ? null : false);
app.post('/api/quotes/:id/approve', (req, res) => {
  const q = db.quotes.find((x) => x.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const approve = req.body.status !== 'declined'; const pick = pickOption(q, req.body.option); if (approve && pick === false) return res.status(400).json({ error: 'Choose the option the client picked' });
  q.status = approve ? 'approved' : 'declined'; q.respondedAt = iso(new Date()); if (approve && pick) { q.chosenOption = pick; computeTotals(q); } save(); res.json(q);
});

// a signature collected on the team member's phone: signing accepts the quote, so a draft or sent one is approved too (the same record as the client's own page).
// Several people can sign: the newest shows on the quote, and each one's signed copy stays in its own note
app.post('/api/quotes/:id/signature', (req, res) => {
  const q = db.quotes.find((x) => x.id === req.params.id); if (!q) return res.status(404).json({ error: 'Not found' });
  if (!['draft', 'sent', 'approved'].includes(q.status)) return res.status(400).json({ error: 'This quote can’t be signed' });
  const pick = pickOption(q, req.body && req.body.option); if (pick === false) return res.status(400).json({ error: 'Choose the option the client is signing for' }); if (pick) { q.chosenOption = pick; computeTotals(q); }
  const name = String((req.body && req.body.name) || '').trim().slice(0, 100); if (!name) return res.status(400).json({ error: 'Enter the name of the person signing' });
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec((req.body && req.body.dataUrl) || '');
  if (!m || m[1].length < 200) return res.status(400).json({ error: 'Please sign in the box first' });
  if (m[1].length > 2e6) return res.status(400).json({ error: 'That signature image is too large' });
  const file = `sig-${token()}.png`; // unguessable name: uploads are served without login
  fs.writeFileSync(path.join(uploadDir(), file), Buffer.from(m[1], 'base64'));
  removeSignatureFile(q); const u = currentUser(req);
  if (q.status !== 'approved') { q.status = 'approved'; q.respondedAt = iso(new Date()); }
  q.signedAt = iso(new Date()); q.signedName = name; q.signature = { file: `/uploads/${file}`, method: 'drawn', collectedBy: u ? u.name : '' };
  if (q.depositFee > 0 && !q.depositStatus) q.depositStatus = 'pending';
  addSignedNote('quote', q); save(); res.status(201).json(q);
});

app.post('/api/quotes/:id/convert-to-job', (req, res) => {
  const q = db.quotes.find((x) => x.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  if (hasOptions(q) && !q.chosenOption) return res.status(400).json({ error: 'Mark the quote approved with the option the client picked first' });
  const c = findClient(q.clientId); const qItems = quoteItems(q);
  const job = { id: uid(), number: nextNumber('jobs'), clientId: q.clientId, title: q.title || 'Job from ' + q.number, description: qItems.map((i, k) => (i.matrix ? '' : `${i.qty} x ${i.mx ? `${(qItems.slice(0, k).reverse().find((h) => h.matrix) || {}).desc || ''} (${i.desc})`.trim() : i.desc}`)).filter(Boolean).join(', '), date: req.body.date || daysFromNow(1), startTime: req.body.startTime || '09:00', endTime: req.body.endTime || '11:00', staffIds: req.body.staffIds || [], status: 'scheduled', quoteId: q.id, address: q.address || (c ? c.address : ''), createdAt: iso(new Date()), items: qItems, taxRate: q.taxRate, discountType: q.discountType, discountValue: q.discountValue };
  computeTotals(job); autoForms(job, (currentUser(req) || {}).name);
  db.jobs.push(job); if (q.status !== 'approved') q.status = 'approved'; save(); pushScheduleChange(null, job, currentUser(req)); res.status(201).json(job);
});

app.post('/api/jobs/:id/create-invoice', (req, res) => {
  const j = db.jobs.find((x) => x.id === req.params.id);
  if (!j) return res.status(404).json({ error: 'Not found' });
  const l = jobLines(j);
  const inv = computeTotals({ id: uid(), number: nextNumber('invoices'), clientId: j.clientId, jobId: j.id, subject: j.title, status: 'draft', issueDate: iso(new Date()), dueDate: iso(new Date()), paymentTerms: '0', paidAt: null, token: token(), createdAt: iso(new Date()), notes: '', items: l.items, taxRate: l.taxRate, discountType: l.discountType, discountValue: l.discountValue, discountName: l.discountName });
  applyMemberDiscount(inv); computeTotals(inv); // a service plan member's discount, when the job had none
  db.invoices.push(inv); save(); res.status(201).json(withStatus(inv));
});
// what a job's invoice is made of: the job's own lines win (else its quote's, with options the chosen one's), with the same tax and discount
function jobLines(j) {
  const q = j.quoteId && db.quotes.find((x) => x.id === j.quoteId); const own = !!(j.items && j.items.length);
  const items = own ? j.items : q && quoteItems(q).length ? quoteItems(q) : [{ desc: j.title, qty: 1, price: 0 }];
  const src = own ? j : q || {};
  return { q, items: items.map((i) => ({ ...i })), taxRate: own ? j.taxRate : q ? q.taxRate : db.company.taxRate, discountType: src.discountType, discountValue: src.discountValue, discountName: src.discountName || '' };
}

// ---------- Batch invoicing (Invoices → Invoice completed jobs) ----------
// Completed jobs with no invoice yet, invoiced in one go: one invoice per job, or one per client with their jobs together (each line keeps its
// job in item.job, and the invoice lists them in jobIds; jobId is the first). A job with its own discount or a deposit paid on its quote gets an
// invoice of its own even then, and only jobs with the same tax rate are put together, so discounts, deposit credits and tax stay right.
// Service plan visits are left out (the plan bills for them). Due dates follow each client's payment terms. With send, invoices are emailed
// with the pay link to clients who have an email address (and something to pay); the rest stay drafts.
const jobInvoiced = (j) => db.invoices.some((i) => i.jobId === j.id || (i.jobIds || []).includes(j.id));
const batchJobs = () => db.jobs.filter((j) => j.status === 'completed' && !j.membershipId && findClient(j.clientId) && !jobInvoiced(j));
const ownInvoice = (l) => !!(l.q && l.q.depositPaidAt) || Number(l.discountValue) > 0;
app.get('/api/invoices/batch', (req, res) => res.json(batchJobs().map((j) => {
  const l = jobLines(j); const c = findClient(j.clientId); const t = computeTotals({ clientId: j.clientId, items: l.items, taxRate: l.taxRate, discountType: l.discountType, discountValue: l.discountValue, discountName: l.discountName });
  applyMemberDiscount(t); computeTotals(t);
  return { id: j.id, number: j.number, title: j.title, date: j.date || '', clientId: c.id, client: c.company || c.name, email: !!c.email, total: t.total, taxRate: Number(l.taxRate) || 0, own: ownInvoice(l) };
}).sort((a, b) => a.client.localeCompare(b.client) || a.date.localeCompare(b.date))));
app.post('/api/invoices/batch', async (req, res) => {
  const b = req.body || {}; const want = new Set(Array.isArray(b.jobIds) ? b.jobIds : []);
  const jobs = batchJobs().filter((j) => want.has(j.id)).sort((x, y) => (x.date || '').localeCompare(y.date || ''));
  if (!jobs.length) return res.status(400).json({ error: 'Choose at least one completed job that isn’t invoiced yet' });
  const groups = []; const byKey = {};
  for (const j of jobs) {
    const l = jobLines(j);
    if (!b.combine || ownInvoice(l)) { groups.push([{ j, l }]); continue; }
    const k = j.clientId + '|' + (Number(l.taxRate) || 0); if (!byKey[k]) groups.push((byKey[k] = [])); byKey[k].push({ j, l });
  }
  const today = localNow().date; const made = [];
  for (const g of groups) {
    const { j, l } = g[0]; const c = findClient(j.clientId); const terms = Math.max(0, Number(c.paymentTerms) || 0); const one = g.length === 1;
    const where = (x) => [x.number, x.date ? niceDate(x.date) : '', x.address && x.address !== c.address ? x.address : ''].filter(Boolean).join(' · ');
    const items = one ? l.items : g.flatMap((x) => x.l.items.map((i) => ({ ...i, job: x.j.id, details: [where(x.j), i.details].filter(Boolean).join('\n') })));
    const first = g[0].j.date; const last = g[g.length - 1].j.date;
    const inv = computeTotals({ id: uid(), number: nextNumber('invoices'), clientId: c.id, jobId: j.id, ...(one ? {} : { jobIds: g.map((x) => x.j.id) }),
      subject: one ? j.title : `${g.length} jobs${first ? `, ${niceDate(first)}${last && last !== first ? ` – ${niceDate(last)}` : ''}` : ''}`,
      status: 'draft', issueDate: today, dueDate: addDaysYmd(today, terms), paymentTerms: String(terms), paidAt: null, token: token(), createdAt: iso(new Date()), notes: '',
      disclaimer: db.company.invoiceDisclaimer ?? '', items, taxRate: l.taxRate, discountType: one ? l.discountType : 'flat', discountValue: one ? l.discountValue : 0, discountName: one ? l.discountName : '' });
    applyMemberDiscount(inv); computeTotals(inv); db.invoices.push(inv); made.push(inv);
  }
  let sent = 0;
  if (b.send) for (const inv of made) {
    const c = findClient(inv.clientId); if (!c.email || !(inv.total > 0)) continue;
    inv.status = 'sent'; sent++; const email = renderEmail('invoice', docVars('invoice', inv));
    notify({ clientId: c.id, channel: 'email', kind: 'invoice', refId: inv.id, refNumber: inv.number, subject: email.subject, html: email.html, body: email.body }).then(() => save()).catch((e) => console.error('batch invoice email:', e.message));
  }
  save();
  res.status(201).json({ invoices: made.map((i) => ({ id: i.id, number: i.number, clientId: i.clientId, total: i.total, status: i.status, jobs: (i.jobIds || [i.jobId]).length })), sent, drafts: made.length - sent });
});

// ---------- Late fees (App Settings → Payments → Late fees) ----------
// db.company.lateFee: { on, type: flat|percent (of the balance due), amount, days (grace days after the due date), times (1 = once, else again
// every 30 days while unpaid, up to this many), email (tell the client), since (the day they were turned on) }.
// Checked hourly: a past-due invoice gets a "Late fee" line (item.lateFee: never discounted or taxed) and an entry in inv.lateFees. Only
// invoices due on or after `since` (clients with older invoices weren't told), never drafts or paid ones, nor one switched to no late fees
// (inv.lateFee === 'off'). inv.lateFees counts what was charged, so deleting the line from the invoice waives that fee for good.
const LATE_TIMES = [1, 2, 3, 6, 12];
function cleanLateFee(b, old = {}) {
  const yes = (v) => v === true || v === 'true' || v === 'on';
  const on = yes(b.on); const type = b.type === 'percent' ? 'percent' : 'flat'; const amount = round2(Math.max(0, Number(b.amount) || 0));
  if (on && !(amount > 0)) throw new Error('Enter the late fee amount');
  if (type === 'percent' && amount > 25) throw new Error('A late fee can be at most 25% of the balance');
  if (type === 'flat' && amount > 10000) throw new Error('A late fee can be at most $10,000');
  return { on, type, amount, days: Math.min(90, Math.max(0, Math.round(Number(b.days) || 0))), times: LATE_TIMES.includes(Number(b.times)) ? Number(b.times) : 1,
    email: b.email === undefined ? old.email !== false : yes(b.email), since: on ? (old.on && old.since) || localNow().date : '' };
}
// the next fee this invoice will get: { n, on: the day it's added }, or null
function nextLateFee(inv, cfg = db.company.lateFee || {}) {
  if (!cfg.on || !(cfg.amount > 0) || inv.lateFee === 'off' || inv.imported || !inv.dueDate || inv.status === 'draft' || inv.status === 'paid' || inv.dueDate < (cfg.since || '9999')) return null;
  const n = (inv.lateFees || []).length; if (n >= (cfg.times || 1)) return null;
  return { n: n + 1, on: addDaysYmd(inv.dueDate, (cfg.days || 0) + 1 + 30 * n) };
}
const lateFeeText = (cfg) => (cfg.type === 'percent' ? `${cfg.amount}% of the balance` : money(cfg.amount));
EMAIL_TEMPLATES.lateFee = {
  label: 'Late fee added', description: 'Sent when a late fee is added to a past-due invoice, if you turned this on in App Settings → Payments → Late fees.',
  subject: 'Late fee added to invoice {{invoice_number}}',
  body: '# Invoice {{invoice_number}} is past due\n\nHello {{client_name}},\n\nInvoice {{invoice_number}} was due {{due_date}} and is still unpaid, so a late fee of **{{fee}}** has been added. The balance is now **{{balance}}**.\n\n[View and pay invoice]({{link}})\n\nIf you\x27ve already paid, thank you, and please let us know at {{company_email}}.\n\n{{company_name}}',
  vars: { client_name: 'Client name', company_name: 'Your business name', company_email: 'Your business email', invoice_number: 'Invoice number', due_date: 'Due date', fee: 'The late fee', balance: 'Balance due with the fee', total: 'Invoice total', link: 'Link to view and pay' },
};
function chargeLateFees() {
  const cfg = db.company.lateFee || {}; if (!cfg.on) return 0;
  const today = localNow().date; let n = 0;
  for (const inv of db.invoices) {
    const next = nextLateFee(inv, cfg); if (!next || next.on > today) continue;
    const owed = invoiceCredits(inv).balanceDue; if (!(owed > 0)) continue;
    const amount = round2(cfg.type === 'percent' ? owed * cfg.amount / 100 : cfg.amount); if (!(amount > 0)) continue;
    const late = Math.round((Date.parse(today) - Date.parse(inv.dueDate)) / 864e5);
    inv.items = [...(inv.items || []), { desc: 'Late fee', details: `${cfg.type === 'percent' ? `${cfg.amount}% of ${money(owed)} unpaid` : 'Unpaid'} ${late} day${late === 1 ? '' : 's'} after the due date (${niceDate(inv.dueDate)})`, qty: 1, cost: amount, markup: 0, markupType: 'percent', price: amount, lateFee: true }];
    (inv.lateFees = inv.lateFees || []).push({ n: next.n, date: today, amount });
    computeTotals(inv); n++;
    const c = findClient(inv.clientId);
    if (cfg.email !== false && c && c.email) {
      const email = renderEmail('lateFee', { ...docVars('invoice', inv), fee: money(amount), balance: money(invoiceCredits(inv).balanceDue) });
      notify({ clientId: c.id, channel: 'email', kind: 'invoice', refId: inv.id, refNumber: inv.number, subject: email.subject, html: email.html, body: email.body }).then(() => save()).catch((e) => console.error('late fee email:', e.message));
    }
  }
  return n;
}
// hourly, in every active account with late fees on
function lateFeesAll() {
  for (const t of tenancy.platform().tenants) {
    if (t.status !== 'active') continue;
    tenancy.run(t, () => { if (!(db.company.lateFee || {}).on || !tenancy.has('invoices')) return; try { if (chargeLateFees()) save(); } catch (e) { console.error('late fees:', e.message); } });
  }
}

app.post('/api/invoices/:id/send', async (req, res) => {
  const inv = db.invoices.find((x) => x.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  const channels = (req.body.channels && req.body.channels.length) ? req.body.channels : ['email'];
  const link = invoiceLink(inv); const co = db.company.name;
  const results = [];
  const email = renderEmail('invoice', docVars('invoice', inv));
  if (channels.includes('email') && req.body.email) { const r = await emailDoc(req, 'invoice', inv); if (r.error) return res.status(400).json(r); results.push(...r.results); }
  for (const ch of channels) {
    if (ch === 'email' && req.body.email) continue;
    results.push(await notify({ clientId: inv.clientId, channel: ch, kind: 'invoice', refId: inv.id, refNumber: inv.number,
      subject: email.subject, html: ch === 'email' ? email.html : '', body: ch === 'email' ? email.body : req.body.message ? smsWithLink(req.body.message, 'View and pay your invoice here', link) : `Invoice ${inv.number} (${money(inv.total)}) due ${inv.dueDate}. Pay online: ${shortLink(link)} Reply STOP to opt out.` }));
  }
  if (inv.status === 'draft') inv.status = 'sent';
  save(); res.json({ invoice: withStatus(inv), results });
});
// the short link a text will carry, for the Send Text box's preview
[['quotes', quoteLink], ['invoices', invoiceLink]].forEach(([col, linkFor]) => app.get(`/api/${col}/:id/short-link`, (req, res) => {
  const doc = db[col].find((x) => x.id === req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json({ url: shortLink(linkFor(doc)) });
}));
// the Email box starts from the email template; Print or Save PDF (and the box's PDF attachment) is the quote or invoice as a PDF
[['quotes', 'quote'], ['invoices', 'invoice']].forEach(([col, kind]) => {
  app.get(`/api/${col}/:id/email-draft`, (req, res) => {
    const doc = db[col].find((x) => x.id === req.params.id); if (!doc) return res.status(404).json({ error: 'Not found' });
    const u = currentUser(req); res.json({ ...emailDraft(kind, doc), me: (u && u.email) || '' });
  });
  app.get(`/api/${col}/:id/pdf`, (req, res) => {
    const doc = db[col].find((x) => x.id === req.params.id); if (!doc) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="${pdfName(kind, doc)}"`); res.end(docPdf(kind, doc));
  });
});

// ---------- the Email box (quote and invoice pages) ----------
const docVars = (kind, d) => {
  const base = { client_name: findClient(d.clientId)?.name || '', company_name: db.company.name, company_email: db.company.email || '', total: money(d.total), sent_date: niceDate(iso(new Date())) };
  return kind === 'quote' ? { ...base, quote_number: d.number, quote_title: d.title || '', link: quoteLink(d) } : { ...base, invoice_number: d.number, due_date: niceDate(d.dueDate), link: invoiceLink(d) };
};
const BUTTON_LINE = /^\s*\[([^\]]+)\]\(\{\{\s*link\s*\}\}\)\s*$/m; // the template's button: [View and approve quote]({{link}})
const fillVars = (str, v) => String(str || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in v ? v[k] : m));
// the box's starting subject and message: the template's, without its heading and button (the email puts the button under the message)
function emailDraft(kind, d) {
  const t = emailTemplate(kind); const v = docVars(kind, d);
  const message = fillVars(t.body.replace(BUTTON_LINE, '').split('\n').filter((l) => !/^#\s/.test(l)).join('\n'), v).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
  return { to: findClient(d.clientId)?.email || '', subject: fillVars(t.subject, v), message, button: (t.body.match(BUTTON_LINE) || [])[1] || (kind === 'quote' ? 'View and approve quote' : 'View and pay invoice') };
}
const EMAIL_FILES_MAX = 10 * 1024 * 1024;
const pdfName = (kind, d) => `${kind}_${String(d.number).replace(/[^\w-]+/g, '')}.pdf`;
// sends what the Email box holds: to each address, the message with the button under it, any files (base64 from the browser) and the PDF;
// "Send me a copy" sends the same email to the person sending it
async function emailDoc(req, kind, d) {
  const e = req.body.email; const draft = emailDraft(kind, d);
  const to = [...new Set(String(e.to ?? draft.to).split(/[\s,;]+/).filter(Boolean))];
  if (!to.length) return { error: 'Enter an email address to send to' };
  if (to.length > 5) return { error: 'Send to 5 email addresses at most' };
  const bad = to.find((a) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)); if (bad) return { error: `“${bad}” isn’t an email address` };
  const message = String(e.message ?? draft.message).trim().slice(0, 10000); if (!message) return { error: 'Write a message first' };
  const mail = renderEmail(kind, docVars(kind, d), { subject: String(e.subject || draft.subject).slice(0, 200), body: `${message}\n\n[${draft.button}]({{link}})` });
  const files = (Array.isArray(e.files) ? e.files : []).slice(0, 10).map((f) => ({ name: String(f.name || 'file').replace(/[\r\n"\\/]/g, '').slice(0, 120) || 'file', type: String(f.type || 'application/octet-stream').slice(0, 100), content: Buffer.from(String(f.data || ''), 'base64') }));
  if (files.reduce((n, f) => n + f.content.length, 0) > EMAIL_FILES_MAX) return { error: 'The attachments are over the 10 MB limit' };
  if (e.pdf) files.unshift({ name: pdfName(kind, d), type: 'application/pdf', content: docPdf(kind, d) });
  const results = [];
  for (const addr of to) results.push(await notify({ clientId: d.clientId, channel: 'email', kind, refId: d.id, refNumber: d.number, subject: mail.subject, body: mail.body, html: mail.html, to: addr, attachments: files }));
  const u = currentUser(req);
  if (e.copy && u && u.email) results.push({ channel: 'email', to: `${u.email} (your copy)`, ...(await sendEmail(u.email, mail.subject, mail.body, { html: mail.html, attachments: files })) });
  return { results };
}
// a quote or invoice as a PDF: the business, the client, the line items (an invoice's Client view switches apply), totals, message and contract
function docPdf(kind, d) {
  const q = kind === 'quote'; const co = db.company; const c = findClient(d.clientId) || {}; const x = q ? d : withStatus(d);
  const on = (k) => q || d[k] !== 'off'; const showQty = on('showQty'); const showUnit = on('showUnit'); const showLine = on('showLineTotals');
  const pdf = createPdf(); const L = 54; const R = 558; let y = 64;
  const room = (need) => { if (y + need > 740) { pdf.addPage(); y = 64; } };
  const gray = '#475569'; const soft = '#64748b';
  // the business, and the document's number and dates
  pdf.text(L, y, co.name || '', { size: 18, bold: true }); y += 18;
  for (const t of [co.address, [co.phone ? fmtUsPhone(co.phone) : '', co.email].filter(Boolean).join('  ·  '), co.website, !q && co.taxIdNumber ? `${co.taxIdName || 'Tax ID'}: ${co.taxIdNumber}` : ''].filter(Boolean)) y = pdf.para(L, y, t, 300, { size: 10, color: gray, lineHeight: 14 });
  pdf.text(R, 64, q ? 'QUOTE' : 'INVOICE', { size: 18, bold: true, align: 'right' }); let ry = 84;
  for (const t of q ? [`Quote #${d.number}`, `Created ${niceDate(String(d.createdAt || '').slice(0, 10))}`] : [`Invoice #${d.number}`, `Issued ${niceDate(d.issueDate)}`, `Due ${niceDate(d.dueDate)}`]) { pdf.text(R, ry, t, { size: 10, color: gray, align: 'right' }); ry += 14; }
  y = Math.max(y, ry) + 14; pdf.line(L, y, R, y); y += 26;
  // the client
  pdf.text(L, y, q ? 'PREPARED FOR' : 'BILL TO', { size: 9, bold: true, color: soft }); y += 16;
  pdf.text(L, y, c.company ? `${c.name} (${c.company})` : c.name || '', { size: 11, bold: true }); y += 15;
  for (const t of [c.address, c.email, c.phone ? fmtUsPhone(c.phone) : ''].filter(Boolean)) y = pdf.para(L, y, t, 300, { size: 10, color: gray, lineHeight: 14 });
  const title = q ? d.title : d.subject; if (title) { y += 12; y = pdf.para(L, y, title, R - L, { size: 14, bold: true, lineHeight: 18 }); }
  // line items
  const cQty = 392; const cUnit = 474; const descW = (showQty || showUnit ? 300 : 400);
  const head = () => { pdf.rect(L, y, R - L, 24, { fill: '#f1f5fb' }); pdf.text(L + 8, y + 16, 'Description', { size: 9, bold: true, color: soft }); if (showQty) pdf.text(cQty, y + 16, 'Qty', { size: 9, bold: true, color: soft, align: 'right' }); if (showUnit) pdf.text(cUnit, y + 16, 'Unit price', { size: 9, bold: true, color: soft, align: 'right' }); if (showLine) pdf.text(R - 8, y + 16, 'Total', { size: 9, bold: true, color: soft, align: 'right' }); y += 24; };
  const tl = 340;
  const row = (k, v, bold) => { room(22); pdf.text(tl, y + 14, k, { size: 10.5, bold }); pdf.text(R - 8, y + 14, v, { size: 10.5, bold, align: 'right' }); y += 22; };
  // a quote with options (Good / Better / Best): each option under its own heading with its items and totals, or only the chosen one
  const parts = q ? quoteParts(d) : [{ doc: d }];
  if (parts.length > 1) { y += 16; y = pdf.para(L, y, `${parts.length} options: choose one when you approve`, R - L, { size: 10.5, color: gray, lineHeight: 14 }); }
  for (const part of parts) {
    const dd = part.doc;
    if (part.opt) {
      room(80); y += 30; pdf.text(L, y, `${part.chosen ? 'Chosen option: ' : ''}${part.opt.name}${part.recommended ? '  (Recommended)' : ''}`, { size: 13, bold: true }); if (parts.length > 1) pdf.text(R, y, money(dd.total || 0), { size: 13, bold: true, align: 'right' }); y += 4;
      if (part.opt.desc) for (const t of part.opt.desc.split('\n').filter((t) => t.trim())) y = pdf.para(L, y + 12, t, R - L, { size: 10, color: gray, lineHeight: 13 }) - 12;
    }
    y += 14; head();
    for (const i of dd.items || []) {
      const lines = Math.ceil(pdf.width(i.details || '', 9.5) / descW) + String(i.details || '').split('\n').length;
      if (y + 34 + (i.details ? lines * 13 : 0) > 740) { pdf.addPage(); y = 64; head(); }
      const ind = i.sub ? 16 : 0; const inc = included(i); const hd = heading(i); const top = y + 18; let yy = pdf.para(L + 8 + ind, top, i.desc, descW - ind, { size: 10.5, bold: !i.sub, lineHeight: 14 });
      for (const t of String(i.details || '').split('\n').filter((t) => t.trim())) yy = pdf.para(L + 8 + ind, yy + 1, t, descW - ind, { size: 9.5, color: gray, lineHeight: 13 });
      if (showQty && !inc && !hd) pdf.text(cQty, top, String(i.qty), { size: 10.5, align: 'right' });
      if (showUnit && !inc && !hd) pdf.text(cUnit, top, money(i.price), { size: 10.5, align: 'right' });
      if (showLine && !hd) pdf.text(R - 8, top, inc ? 'Included' : money(round2(i.qty * i.price)), { size: 10.5, align: 'right' });
      y = yy + 6; pdf.line(L, y, R, y);
    }
    // totals
    y += 10;
    row('Subtotal', money(dd.subtotal || 0));
    if (dd.discount > 0) row(discLabel(dd), '-' + money(dd.discount));
    if (Number(dd.taxRate)) row(`${Number(dd.taxRate) === Number(co.taxRate) && co.taxName ? co.taxName : 'Tax'} (${dd.taxRate}%)`, money(dd.tax || 0));
    row(part.opt && parts.length > 1 ? `${part.opt.name} total` : 'Total', money(dd.total || 0), true);
    if (q && dd.depositFee > 0) row(`Required deposit${dd.depositType === 'percent' ? ` (${dd.depositValue}%)` : ''}`, money(dd.depositFee));
  }
  if (!q) {
    const paid = (d.payments || []).reduce((n, pm) => n + (Number(pm.amount) || 0), 0);
    if (d.depositApplied > 0) row('Deposit collected', '-' + money(d.depositApplied));
    if (paid > 0) row('Payments', '-' + money(paid));
    row('Balance due', money(x.balanceDue ?? d.total), true);
  }
  // the client message and the contract / disclaimer
  for (const [h, t] of [['Message', d.notes], [q ? 'Contract / Disclaimer' : 'Terms', d.disclaimer]]) {
    if (!String(t || '').trim()) continue;
    y += 18; room(40); pdf.text(L, y, h.toUpperCase(), { size: 9, bold: true, color: soft }); y += 16;
    for (const para of String(t).split('\n')) { room(14 * Math.max(1, Math.ceil(pdf.width(para, 10) / (R - L)))); y = para.trim() ? pdf.para(L, y, para, R - L, { size: 10, color: '#334155', lineHeight: 14 }) : y + 8; }
  }
  return pdf.toBuffer(`${q ? 'Quote' : 'Invoice'} ${d.number}`);
}

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
  const wasPaid = inv.status === 'paid'; const { balanceDue } = invoiceCredits(inv, true);
  if (balanceDue <= 0.004 && (inv.payments || []).length) {
    const last = [...inv.payments].sort((a, b) => a.date.localeCompare(b.date)).pop();
    Object.assign(inv, { status: 'paid', paidAt: last.date, paymentMethod: last.method });
  } else if (inv.status === 'paid') { Object.assign(inv, { status: 'sent', paidAt: null, paymentMethod: null }); }
  else if (inv.status === 'draft' && (inv.payments || []).length) inv.status = 'sent';
  if (!wasPaid && inv.status === 'paid') askForReview('invoice', inv);
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
app.delete('/api/invoices/:id/payments/:pid', (req, res) => res.status(400).json({ error: 'A recorded payment can’t be deleted' }));

app.post('/api/invoices/:id/mark-paid', (req, res) => {
  const inv = db.invoices.find((x) => x.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  const method = PAY_METHODS[req.body.method] ? req.body.method : 'other'; const owed = invoiceCredits(inv, true).balanceDue; const u = currentUser(req);
  if (owed > 0) inv.payments = [...(inv.payments || []), { id: uid(), amount: owed, method, date: iso(new Date()), reference: '', recordedBy: u ? u.name : '', createdAt: new Date().toISOString() }];
  settleInvoice(inv); if (inv.status !== 'paid') { Object.assign(inv, { status: 'paid', paidAt: iso(new Date()), paymentMethod: method }); askForReview('invoice', inv); }
  save(); res.json(withStatus(inv));
});

app.post('/api/jobs/:id/remind', async (req, res) => {
  const j = db.jobs.find((x) => x.id === req.params.id);
  if (!j) return res.status(404).json({ error: 'Not found' });
  const co = db.company.name;
  const channels = (req.body.channels && req.body.channels.length) ? req.body.channels : [tenancy.has('sms') && findClient(j.clientId)?.smsConsent ? 'sms' : 'email'];
  const email = renderEmail('reminder', { client_name: findClient(j.clientId)?.name || '', company_name: co, job_number: j.number, job_title: j.title, date: niceDate(j.date), time: j.startTime, address: j.address || '' });
  const results = [];
  for (const ch of channels) {
    results.push(await notify({ clientId: j.clientId, channel: ch, kind: 'job', refId: j.id, refNumber: j.number,
      subject: email.subject, html: ch === 'email' ? email.html : '', body: ch === 'email' ? email.body : `Reminder for "${j.title}" on ${j.date} at ${j.startTime}. Reply STOP to opt out.` }));
  }
  res.json({ results }); save();
});
// On my way: the team member heading to the job tells the client when they'll arrive (text if the client agreed to texts and the plan has them, else email).
// Anyone assigned to the job can send it (technicians only have See jobs), and anyone who can edit jobs
const ETA_CHOICES = [5, 10, 15, 20, 30, 45, 60, 90, 120];
app.post('/api/jobs/:id/on-my-way', async (req, res) => {
  const j = db.jobs.find((x) => x.id === req.params.id); if (!j) return res.status(404).json({ error: 'Job not found' });
  const u = currentUser(req);
  if (!(u && ((j.staffIds || []).includes(u.staffId) || can(u, 'jobs.edit')))) return res.status(403).json({ error: 'Only the team on this job can send On my way' });
  if (['completed', 'cancelled'].includes(j.status)) return res.status(400).json({ error: 'This job is already ' + j.status });
  const c = findClient(j.clientId); if (!c) return res.status(400).json({ error: 'This job has no client' });
  const eta = ETA_CHOICES.includes(Number(req.body.eta)) ? Number(req.body.eta) : 30;
  const st = (db.staff || []).find((x) => x.id === u.staffId); const who = String((st && st.name) || u.name || 'Our team').trim();
  const first = who.split(/\s+/)[0];
  const arrive = new Date(Date.now() + eta * 60e3).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: db.company.timeFormat !== '24' });
  const ch = tenancy.has('sms') && c.smsConsent && c.phone ? 'sms' : 'email';
  const email = renderEmail('onMyWay', { client_name: c.name || '', company_name: db.company.name, staff_name: who, eta: `${eta} minutes`, arrival_time: arrive, job_number: j.number, job_title: j.title || '', address: j.address || c.address || '' });
  const r = await notify({ clientId: c.id, channel: ch, kind: 'job', refId: j.id, refNumber: j.number, subject: email.subject, html: ch === 'email' ? email.html : '',
    body: ch === 'email' ? email.body : `${first} is on the way and should arrive in about ${eta} minutes (around ${arrive}). Reply STOP to opt out.` });
  if (r.status !== 'failed') j.onMyWay = { at: new Date().toISOString(), staffId: u.staffId || null, name: who, eta, channel: ch };
  save(); res.json({ result: r, job: j });
});

// ---------- public payment + quote pages ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function shell(title, inner) {
  const co = db.company;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="icon" href="/favicon.ico">
<style>body{font-family:system-ui,sans-serif;background:#f4f6f8;margin:0;color:#111827}.card{max-width:640px;margin:24px auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
h1{margin:0 0 4px;font-size:22px}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px 4px;border-bottom:1px solid #e5e7eb;text-align:left}.r{text-align:right}
.btn{background:${esc(co.brandColor)};color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:16px;cursor:pointer}.btn.alt{background:#fff;color:#111;border:1px solid #d1d5db}.muted{color:#6b7280;font-size:14px}.badge{display:inline-block;padding:2px 10px;border-radius:99px;background:#e5e7eb;font-size:13px}.paid{background:#dcfce7;color:#166534}
input{padding:10px;border:1px solid #d1d5db;border-radius:8px;width:100%;box-sizing:border-box;margin:4px 0 10px}select.ph-cc{padding:10px 8px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#111}</style><script src="/phone.js?v=2" defer></script></head><body><div class="card">
<div class="sh-head" style="display:flex;align-items:center;gap:12px;margin-bottom:16px">${co.logo ? `<img src="${esc(co.logo)}" style="height:48px">` : ''}<div><strong>${esc(co.name)}</strong><div class="muted">${esc(co.email)} · ${esc(co.phone)}</div></div></div>${inner}</div></body></html>`;
}
// a sub item at $0: the client sees "Included" instead of prices
const included = (i) => !!i.sub && !(i.qty * i.price);
const heading = (i) => !!i.matrix; // a matrix line: its sizes and colors are the priced lines under it
// o.qty / o.unit / o.line = false hide those columns (invoice "Client view" switches); o.invoice shows the deposit credit
function itemsTable(d, o = {}) {
  const qty = o.qty !== false; const unit = o.unit !== false; const line = o.line !== false; const span = 1 + qty + unit;
  const row = (label, value) => `<tr><td colspan="${span}" class="r">${label}</td><td class="r">${value}</td></tr>`;
  return `<table><tr><th>Description</th>${qty ? '<th class="r">Qty</th>' : ''}${unit ? '<th class="r">Price</th>' : ''}<th class="r">${line ? 'Amount' : ''}</th></tr>${d.items.map((i) => { const inc = included(i); const hd = heading(i); return `<tr><td${i.sub ? ' style="padding-left:28px"' : ''}>${hd ? `<strong>${esc(i.desc)}</strong>` : esc(i.desc)}${i.details ? `<div class="muted" style="white-space:pre-line">${esc(i.details)}</div>` : ''}</td>${qty ? `<td class="r">${inc || hd ? '' : i.qty}</td>` : ''}${unit ? `<td class="r">${inc || hd ? '' : money(i.price)}</td>` : ''}<td class="r">${hd ? '' : inc ? (line || !unit ? 'Included' : '') : line ? money(i.qty * i.price) : ''}</td></tr>`; }).join('')}
${row('Subtotal', money(d.subtotal))}${d.discount > 0 ? row(esc(discLabel(d)), '−' + money(d.discount)) : ''}${row(`${esc(Number(d.taxRate) === Number(db.company.taxRate) && db.company.taxName ? db.company.taxName : 'Tax')} (${d.taxRate}%)`, money(d.tax))}${row('<strong>Total</strong>', `<strong>${money(d.total)}</strong>`)}
${o.invoice ? (d.depositApplied > 0 ? row(`Deposit collected (quote ${esc(d.depositQuote)}, ${esc(niceDate(d.depositAppliedAt))})`, '−' + money(d.depositApplied)) + row('<strong>Balance due</strong>', `<strong>${money(d.balanceDue)}</strong>`) : '')
    : d.depositFee > 0 ? row(`Deposit${d.depositType === 'percent' ? ` (${d.depositValue}%)` : ''}`, money(d.depositFee)) + row('Balance after deposit', money(d.total - d.depositFee)) : ''}</table>`;
}

// Paying outside the app: Zelle, Venmo, Cash App and PayPal. None of them tells us a payment arrived, so the client says they sent it
// (the business gets an email and a "… sent" badge) and the business records it (Collect payment / Record deposit) once it shows up.
// Venmo, Cash App and PayPal.me take a link with the amount filled in; Zelle has no links, so the client copies the email or phone.
const PAY_APPS = [
  { key: 'venmo', label: 'Venmo', allow: 'allowVenmo', field: 'venmoHandle', host: /^venmo\.com\/(?:u\/)?/i, what: 'username', eg: '@YourBusiness', show: (h) => '@' + h,
    link: (h, amt, memo) => `https://venmo.com/${encodeURIComponent(h)}?txn=pay&amount=${amt}&note=${encodeURIComponent(memo)}` },
  { key: 'cashapp', label: 'Cash App', allow: 'allowCashapp', field: 'cashappTag', host: /^cash\.app\//i, what: '$Cashtag', eg: '$YourBusiness', show: (h) => '$' + h,
    link: (h, amt) => `https://cash.app/$${encodeURIComponent(h)}/${amt}` },
  { key: 'paypal', label: 'PayPal', allow: 'allowPaypal', field: 'paypalHandle', host: /^paypal\.me\//i, what: 'PayPal.me name', eg: 'paypal.me/YourBusiness', show: (h) => 'paypal.me/' + h,
    link: (h, amt) => `https://paypal.me/${encodeURIComponent(h)}/${amt}` },
];
const PAY_VIA = { zelle: 'Zelle', ...Object.fromEntries(PAY_APPS.map((m) => [m.key, m.label])) };
// '' clears it; null means it isn't a handle
function payHandle(v, host) {
  const h = String(v || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(host, '').replace(/^[@$]/, '').replace(/[/?#].*$/, '');
  return !h ? '' : /^[A-Za-z0-9_.-]{1,40}$/.test(h) ? h : null;
}
// the ways this quote or invoice can be paid outside the app (each switched on or off per document, like card payments)
function offlineMethods(doc) {
  if (!tenancy.has('zelle')) return [];
  const c = db.company; const on = (k) => doc[k] !== 'off';
  return [c.zelleRecipient && on('allowZelle') ? { key: 'zelle', label: 'Zelle' } : null, ...PAY_APPS.filter((m) => c[m.field] && on(m.allow))].filter(Boolean);
}
// base: the page's address; "I've sent it" posts to base/sent/<method>
function offlineBox(doc, amount, memo, base) {
  const methods = offlineMethods(doc); if (!methods.length) return '';
  const wrap = (html) => `<div style="background:#f5f3ff;padding:16px;border-radius:8px;margin-top:16px;border:1px solid #c4b5fd">${html}</div>`;
  if (doc.zelleSentAt) return wrap(`<p style="margin:0">✓ You told us you sent this payment by ${esc(PAY_VIA[doc.sentVia] || 'Zelle')} on ${esc(niceDate(doc.zelleSentAt))}. We'll confirm it once it arrives.</p>`);
  const amt = (Math.round(amount * 100) / 100).toFixed(2); const sm = 'padding:6px 12px;font-size:14px';
  const sent = (m) => `<form method="post" action="${esc(`${base}/sent/${m.key}`)}" style="margin-top:10px"><button class="btn alt" style="${sm}">I've sent the payment by ${esc(m.label)}</button></form>`;
  const box = (m) => {
    if (m.key === 'zelle') {
      const z = db.company.zelleRecipient;
      return `<h3 style="margin:0 32px 12px 0">Pay with Zelle</h3>
<p style="margin:0 0 6px">Send <strong>${money(amount)}</strong> with Zelle to:</p>
<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><strong style="font-size:18px">${esc(z)}</strong><button type="button" class="btn alt" style="${sm}" data-v="${esc(z)}" onclick="navigator.clipboard.writeText(this.dataset.v);this.textContent='Copied'">Copy</button></div>
${db.company.zelleName ? `<div class="muted">Registered to ${esc(db.company.zelleName)}. Check this name before you send.</div>` : ''}
<p class="muted" style="margin-bottom:0">Use your bank's app or the Zelle app, and put <strong>${esc(memo)}</strong> in the memo.</p>${sent(m)}`;
    }
    const h = db.company[m.field];
    return `<h3 style="margin:0 32px 12px 0">Pay with ${esc(m.label)}</h3>
<p style="margin:0 0 10px">Send <strong>${money(amount)}</strong> to <strong>${esc(m.show(h))}</strong>.</p>
<a class="btn" href="${esc(m.link(h, amt, memo))}" target="_blank" rel="noopener">Open ${esc(m.label)}</a>
<p class="muted" style="margin-bottom:0">Check the amount, and put <strong>${esc(memo)}</strong> in the note.</p>${sent(m)}`;
  };
  // one tile per app in its brand colors; tapping it opens that app's instructions in a pop-up (a <dialog>)
  const tile = (m) => `<button type="button" class="pa-t pa-${m.key}" data-pay="${m.key}" aria-haspopup="dialog" aria-label="Pay with ${esc(m.label)}">${PAY_TILE[m.key]}</button>`;
  const pop = (m) => `<dialog class="pa-d" id="pa-${m.key}" aria-label="Pay with ${esc(m.label)}"><button type="button" class="pa-x" data-close aria-label="Close">×</button>${box(m)}</dialog>`;
  return `<style>.pa{margin-top:16px}.pa-h{font-weight:600;margin:0 0 8px}.pa-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px}
.pa-t{display:flex;align-items:center;justify-content:center;gap:6px;height:54px;border-radius:10px;border:1px solid transparent;cursor:pointer;font:700 19px/1 system-ui,-apple-system,sans-serif;color:#fff;padding:0 10px}
.pa-t:focus-visible{outline:3px solid #2563eb;outline-offset:2px}.pa-t:hover{filter:brightness(1.06)}
.pa-zelle{background:#6d1ed4}.pa-venmo{background:#008cff;font-style:italic;letter-spacing:-.02em}.pa-cashapp{background:#00d64f}.pa-paypal{background:#fff;border-color:#d1d5db;font-style:italic}
.pa-zelle b,.pa-venmo b,.pa-cashapp b{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:#fff;font-size:17px;font-style:normal;flex:none}
.pa-zelle b{color:#6d1ed4}.pa-venmo b{color:#008cff;font-style:italic;font-weight:800}.pa-cashapp b{color:#00d64f}.pa-zelle svg{width:18px;height:18px}
.pa-paypal b{color:#003087}.pa-paypal i{color:#009cde}
.pa-d{border:0;border-radius:14px;padding:22px 20px 20px;width:min(420px,calc(100% - 32px));box-shadow:0 20px 50px rgba(0,0,0,.25)}.pa-d::backdrop{background:rgba(15,23,42,.5)}
.pa-x{position:absolute;top:10px;right:12px;border:0;background:none;font-size:26px;line-height:1;cursor:pointer;color:#6b7280;padding:4px 8px}</style>
<div class="pa"><p class="pa-h">Pay with an app</p><div class="pa-g">${methods.map(tile).join('')}</div>${methods.map(pop).join('')}</div>
<script>(function(){var r=document.currentScript.previousElementSibling;
r.addEventListener('click',function(e){var t=e.target.closest('[data-pay]');if(t){var d=r.querySelector('#pa-'+t.dataset.pay);if(d&&d.showModal)d.showModal();return}
var d=e.target.closest('dialog');if(!d)return;var b=d.getBoundingClientRect(),out=e.target===d&&(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom);
if(out||e.target.closest('[data-close]'))d.close()});})();</script>`;
}
// a small white badge with each app's mark before its name (Zelle: the Z with its line through the top and bottom)
const PAY_TILE = { zelle: '<b><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M5.5 6.5h13v2.6L10 15.9h8.5v2.6h-13v-2.6L14 9.1H5.5z"/><rect x="10.9" y="3" width="2.2" height="4.5" rx=".4"/><rect x="10.9" y="16.5" width="2.2" height="4.5" rx=".4"/></svg></b>Zelle', venmo: '<b>V</b>venmo', cashapp: '<b>$</b>Cash App', paypal: '<b>Pay</b><i>Pal</i>' };
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
const PAY_DEFAULTS = { quoteCard: true, quoteAch: false, invoiceCard: true, invoiceAch: false, link: true, tips: false, notifyEmail: true, emailReceipts: true, disabled: false };
// tips on invoices paid online (Payments → Settings → Tips): the client picks one of these percentages of the balance, or types an amount
const TIP_PCTS = [10, 15, 20];
const tipMax = (due) => round2(Math.max(due, 100)); // no more than the balance (or $100 on a small one): catches a typo like 500 for 5.00
function readTip(b, due) {
  const pct = Number(b.tipPct); if (TIP_PCTS.includes(pct)) return round2(due * pct / 100);
  if (b.tipPct !== 'other') return 0;
  const v = round2(Number(String(b.tipAmount || '').replace(/[$,\s]/g, ''))); return v > 0 ? Math.min(v, tipMax(due)) : 0;
}
const paySettings = () => ({ ...PAY_DEFAULTS, ...(db.company.paySettings || {}) });
// the online methods a client can use for an invoice or a quote deposit ([] = none); bank (ACH) needs a live Stripe connection
function onlineMethods(kind, doc) {
  const s = paySettings(); if (s.disabled || !tenancy.has('onlinePayments') || doc.allowCard === 'off' || !stripeKey()) return []; // not set up yet: no card option for clients
  return [s[kind + 'Card'] && 'card', s[kind + 'Ach'] && stripeKey() && 'us_bank_account'].filter(Boolean);
}
const payButtonLabel = (methods, amount, what = '') => (methods.length > 1 ? `Pay ${what}${money(amount)} online` : methods[0] === 'us_bank_account' ? `Pay ${what}${money(amount)} from your bank` : `Pay ${what}${money(amount)} with card`);
// a Checkout page for one amount; meta = { invoiceId } or { quoteId }; methods = Stripe payment method types
async function stripeCheckout({ amount, name, client, meta, successUrl, cancelUrl, methods = ['card'], tip = 0 }) {
  const p = {
    mode: 'payment', 'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)), 'line_items[0][price_data][product_data][name]': name,
    success_url: successUrl + (successUrl.includes('?') ? '&' : '?') + 'session_id={CHECKOUT_SESSION_ID}', cancel_url: cancelUrl,
    'payment_intent_data[description]': `${db.company.name}: ${name}${tip > 0 ? ` + ${money(tip)} tip` : ''}`,
  };
  if (tip > 0) { // its own line on the Checkout page; metadata.tip tells applyStripeSession how much of the total is the tip
    Object.assign(p, { 'line_items[1][quantity]': '1', 'line_items[1][price_data][currency]': 'usd', 'line_items[1][price_data][unit_amount]': String(Math.round(tip * 100)), 'line_items[1][price_data][product_data][name]': 'Tip' });
    meta = { ...meta, tip: tip.toFixed(2) };
  }
  for (const [k, v] of Object.entries(meta)) { p[`metadata[${k}]`] = v; p[`payment_intent_data[metadata][${k}]`] = v; }
  const fee = Number(tenancy.platform().settings.platformFeePercent) || 0; // your cut of each card payment, through Stripe Connect only
  if (connectedAccount() && fee > 0) p['payment_intent_data[application_fee_amount]'] = String(Math.round(amount * fee)); // amount is dollars, fee is %; never taken from a tip
  if (client && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email || '')) p.customer_email = client.email; // Stripe emails the receipt
  methods.forEach((m, i) => { p[`payment_method_types[${i}]`] = m; });
  if (methods.includes('card') && paySettings().link) p[`payment_method_types[${methods.length}]`] = 'link'; // Link next to cards (Payments → Settings)
  return stripeLib.checkoutSession(stripeKey(), p, connectedAccount()); // a method that isn't switched on in their Stripe account is dropped
}
// record a paid Checkout session on its invoice or quote (safe to call more than once for the same session)
function applyStripeSession(s) {
  if (!s || s.payment_status !== 'paid') return null;
  clearPayCache(); // a new payment: the Payments page asks Stripe again
  const amount = round2((Number(s.amount_total) || 0) / 100); const meta = s.metadata || {};
  const tip = meta.invoiceId ? Math.min(amount, Math.max(0, round2(Number(meta.tip) || 0))) : 0; // a tip the client added on the invoice page
  const tell = (what, clientId) => {
    if (tip > 0) what += ` (including a ${money(tip)} tip)`;
    const c = findClient(clientId); const set = paySettings();
    if (set.emailReceipts && c && c.email) { // receipt to the client, from the business
      const rm = renderEmail('receipt', { client_name: c.name, company_name: db.company.name, amount: money(amount), paid_for: what, date: niceDate(iso(new Date())), reference: s.payment_intent || s.id });
      notify({ clientId, channel: 'email', kind: 'receipt', refId: meta.invoiceId || meta.quoteId, refNumber: '', subject: rm.subject, body: rm.text, html: rm.html }).then(() => save()).catch(() => {});
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
    inv.payments = [...(inv.payments || []), { id: uid(), amount: round2(amount - tip), ...(tip > 0 ? { tip } : {}), method: 'stripe', date: iso(new Date()), reference: s.payment_intent || s.id, recordedBy: 'Stripe', createdAt: new Date().toISOString() }];
    Object.assign(inv, { paidAmount: round2(amount - tip), stripeSessionId: s.id, stripePaymentIntent: s.payment_intent || null }); settleInvoice(inv);
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
// settings (owner/admin only: no role permission opens these)
app.put('/api/payments/settings', (req, res) => {
  const b = req.body || {}; const s = paySettings();
  for (const k of Object.keys(PAY_DEFAULTS)) if (k in b) s[k] = b[k] === true;
  db.company.paySettings = s; save(); res.json(s);
});
// what Stripe knows: balance, payouts, disputes, and each charge's status and payout date (keyed by payment intent, the reference on recorded payments)
// Stripe's answer for the Payments page is kept for a minute per account, so going back and forth is instant;
// a new payment, a refund or an account update from Stripe clears it
const payCache = new Map(); // account id -> { at, data }
const clearPayCache = () => { try { payCache.delete(tenancy.current().id); } catch (e) { /* no account in this context */ } };
// the day Stripe next pays out money that's already available, from the account's payout schedule (null for manual payouts or no schedule):
// daily is the next weekday after today (today's run has already paid out what was available then); weekly and monthly are the next
// payout day from today on (a monthly day past the end of a short month is that month's last day)
function nextPayoutDay(sch, now = new Date()) {
  if (!sch || !['daily', 'weekly', 'monthly'].includes(sch.interval)) return null;
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const weekly = sch.weekly_payout_days || [sch.weekly_anchor || 'monday'];
  const monthly = (sch.monthly_payout_days || [sch.monthly_anchor || 1]).map(Number);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (sch.interval === 'daily' ? 1 : 0), 12);
  for (let i = 0; i < 62; i++, d.setDate(d.getDate() + 1)) {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const hit = sch.interval === 'daily' ? d.getDay() % 6 !== 0 : sch.interval === 'weekly' ? weekly.includes(DAYS[d.getDay()]) : monthly.some((m) => Math.min(m, last) === d.getDate());
    if (hit) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
}
// Stripe's side of the Payments page (also used for the payouts CSV)
async function stripePayments(fresh) {
  if (!tenancy.has('onlinePayments') || !stripeKey()) return { connected: false };
  const key = tenancy.current().id; const hit = payCache.get(key);
  if (hit && Date.now() - hit.at < 60e3 && !fresh) return { ...hit.data, cachedAt: new Date(hit.at).toISOString() };
  let failed = 0; const get = (ep) => stripeApi('GET', ep).catch((e) => { failed++; console.error('Stripe:', e.message); return null; });
  // charges without their fee details (the heavy part); payout dates come from the balance list fetched alongside
  const [bal, charges, payouts, disputes, txns, account] = await Promise.all([get('balance'), get('charges?limit=100'), get('payouts?limit=100&expand[]=data.destination'), get('disputes?limit=100'), get('balance_transactions?limit=100'),
    stripeApi('GET', 'account').catch(() => null)]); // only for the payout schedule: without it the money that's ready just shows "Next payout"
  const day = (t) => (t ? iso(new Date(t * 1000)) : null); const usd = (l) => round2((l || []).filter((x) => x.currency === 'usd').reduce((s, x) => s + x.amount, 0) / 100);
  const acct = (d) => (d && typeof d === 'object' ? { name: d.bank_name || d.brand || 'Bank account', last4: d.last4 || '' } : null);
  const charge = {}; const availOn = {}; for (const t of (txns && txns.data) || []) if (t.source) availOn[t.source] = t.available_on;
  const oldest = Math.min(...((txns && txns.data) || []).map((t) => t.created), Infinity);
  for (const c of (charges && charges.data) || []) if (c.payment_intent) {
    // older than the balance list: its money was paid out long ago
    charge[c.payment_intent] = { payoutDate: day(availOn[c.id]), paidOut: !availOn[c.id] && c.created < oldest,
      status: c.disputed ? 'disputed' : c.refunded ? 'refunded' : c.amount_refunded ? 'partly refunded' : c.status === 'failed' ? 'failed' : c.status === 'pending' ? 'processing' : 'succeeded' };
  }
  const pl = (payouts && payouts.data) || []; const dl = (disputes && disputes.data) || [];
  // upcoming payouts, soonest first: payouts already on their way to the bank, then money that becomes available on a known day
  // (it's paid out on the account's payout schedule from then), then money that's available now and waiting for the next payout
  const due = {}; for (const t of (txns && txns.data) || []) if (t.status === 'pending' && t.currency === 'usd') { const d = day(t.available_on); due[d] = (due[d] || 0) + t.net; }
  const upcoming = [...pl.filter((p) => ['pending', 'in_transit'].includes(p.status)).map((p) => ({ date: day(p.arrival_date), amount: round2(p.amount / 100), inTransit: true, bank: acct(p.destination) })),
    ...Object.entries(due).filter(([, c]) => c > 0).map(([date, c]) => ({ date, amount: round2(c / 100) }))];
  const ready = bal ? usd(bal.available) : 0; if (ready > 0) upcoming.push({ date: nextPayoutDay(account && account.settings && account.settings.payouts && account.settings.payouts.schedule), amount: ready, next: true });
  upcoming.sort((a, b) => (!a.date ? -1 : !b.date ? 1 : a.date < b.date ? -1 : a.date > b.date ? 1 : a.next ? -1 : 0)); // undated first; on the same day, what's ready now first
  const out = { connected: true, mode: stripeMode(), feePercent: connectedAccount() ? Number(tenancy.platform().settings.platformFeePercent) || 0 : 0, balance: bal ? { available: usd(bal.available), pending: usd(bal.pending) } : null, charges: charge, upcoming,
    payouts: pl.map((p) => ({ id: p.id, amount: round2(p.amount / 100), arrival: day(p.arrival_date), created: day(p.created), status: p.status, method: p.method === 'instant' ? 'instant' : 'standard', bank: acct(p.destination) })),
    bank: (pl.map((p) => acct(p.destination)).find(Boolean)) || null,
    disputes: { open: dl.filter((d) => /needs_response|under_review/.test(d.status)).length, total: dl.length }, partial: failed > 0 };
  if (!failed) payCache.set(key, { at: Date.now(), data: out }); // only a complete answer is kept
  return out;
}
app.get('/api/payments/stripe', async (req, res) => res.json(await stripePayments(!!req.query.fresh)));
// Payouts tab → Email CSV: the payouts shown (by type and dates) as a spreadsheet, emailed to whoever asked
app.post('/api/payments/payouts/email', async (req, res) => {
  const u = currentUser(req); if (!u.email) return res.status(400).json({ error: 'Your login has no email address' });
  const S = await stripePayments(false); if (!S.connected) return res.status(400).json({ error: 'Card payments aren’t set up, so there are no payouts yet' });
  const b = req.body || {}; const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  const list = (S.payouts || []).filter((p) => (!b.method || b.method === 'all' || p.method === b.method) && (!ok(b.from) || p.arrival >= b.from) && (!ok(b.to) || p.arrival <= b.to));
  if (!list.length) return res.status(400).json({ error: 'No payouts match these filters' });
  const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const STATUS = { paid: 'Paid', pending: 'Pending', in_transit: 'In transit', canceled: 'Canceled', failed: 'Failed' };
  const csv = [['Arrival date', 'Payout ID', 'Type', 'Status', 'Amount', 'Bank account'].join(','), ...list.map((p) => [p.arrival, p.id, p.method === 'instant' ? 'Instant' : 'Standard', STATUS[p.status] || p.status, p.amount.toFixed(2), p.bank ? `${p.bank.name} ••••${p.bank.last4}` : ''].map(cell).join(','))].join('\r\n');
  const range = ok(b.from) || ok(b.to) ? ` from ${ok(b.from) ? niceDate(b.from) : 'the start'} to ${ok(b.to) ? niceDate(b.to) : 'today'}` : '';
  const sent = await sendEmail(u.email, `Payouts for ${db.company.name || 'your business'}`, `Hi ${u.name.split(/\s+/)[0]},\n\nAttached are ${list.length} payout${list.length === 1 ? '' : 's'}${range}, as a spreadsheet (CSV) you can open in Excel, Numbers or Google Sheets.\n\nTotal: ${money(list.reduce((s, p) => s + p.amount, 0))}`,
    { attachments: [{ name: `payouts-${iso(new Date())}.csv`, type: 'text/csv', content: '\ufeff' + csv }] });
  if (sent.status === 'failed') return res.status(502).json({ error: sent.detail || 'The email couldn’t be sent' });
  res.json({ ok: true, to: u.email, count: list.length, status: sent.status });
});
// ---------- one payment (Payments → a row): what was paid, by whom, how, and when the money reaches the bank ----------
// ids as on the Payments list: an invoice payment's id, "i-<invoice>" (an invoice marked paid before payments were itemized), "q-<quote>" (a deposit)
function findPayment(rowId) {
  const id = String(rowId || '');
  if (id.startsWith('q-')) { const q = db.quotes.find((x) => x.id === id.slice(2)); return q && q.depositPaidAt ? { kind: 'quote', doc: q, p: { id, amount: Number(q.depositPaidAmount ?? q.depositFee) || 0, method: q.depositMethod || 'other', date: q.depositPaidAt.slice(0, 10), reference: q.depositReference || '', refunds: q.depositRefunds || [] }, what: `the deposit on quote ${q.number}` } : null; }
  if (id.startsWith('i-')) { const inv = db.invoices.find((x) => x.id === id.slice(2)); return inv && inv.paidAt ? { kind: 'invoice', doc: inv, p: { id, amount: Number(inv.paidAmount || inv.total) || 0, method: inv.paymentMethod || 'other', date: inv.paidAt.slice(0, 10), reference: '' }, what: `invoice ${inv.number}` } : null; }
  for (const inv of db.invoices) { const p = (inv.payments || []).find((x) => x.id === id); if (p) return { kind: 'invoice', doc: inv, p, what: `invoice ${inv.number}` }; }
  return null;
}
async function paymentDetail(f) {
  const c = findClient(f.doc.clientId); const p = f.p;
  const out = { payment: { id: p.id, amount: round2((Number(p.amount) || 0) + (Number(p.tip) || 0)), tip: round2(Number(p.tip) || 0), method: p.method, date: (p.date || '').slice(0, 10), reference: p.reference || '', recordedBy: p.recordedBy || '', createdAt: p.createdAt || '', note: p.note || '',
      refunds: (p.refunds || []).map((r) => ({ id: r.id, amount: r.amount, at: r.at, by: r.by || '', reason: r.reason || '', note: r.note || '', status: r.status || 'succeeded', stripe: !!r.stripeRefundId })), refunded: refundedOf(p.refunds), refundable: !p.id.startsWith('i-') },
    doc: { kind: f.kind, id: f.doc.id, number: f.doc.number, total: f.doc.total }, client: c ? { id: c.id, name: c.name, company: c.company || '', email: c.email || '', phone: c.phone || '', address: c.address || '' } : null,
    receipts: db.notifications.filter((n) => n.kind === 'receipt' && n.refId === f.doc.id).slice(0, 5).map((n) => ({ at: n.at, to: n.to, status: n.status })), stripe: null };
  // a card or bank payment through Stripe: the charge's details, fees, and the payout it's in
  if (p.method === 'stripe' && /^pi_/.test(p.reference) && stripeKey()) {
    try {
      const pi = await stripeApi('GET', `payment_intents/${p.reference}?expand[]=latest_charge.balance_transaction`); const ch = pi.latest_charge || {}; const bt = ch.balance_transaction || {};
      const pm = ch.payment_method_details || {}; const card = pm.card; const bank = pm.us_bank_account; const ad = (ch.billing_details && ch.billing_details.address) || {};
      const day = (t) => (t ? new Date(t * 1000).toISOString() : null);
      let payout = null;
      if (bt.available_on) { // the first payout made once the money became available holds it (automatic payouts)
        const po = await stripeApi('GET', `payouts?limit=100&created[gte]=${bt.available_on - 86400}`).catch(() => null);
        const first = ((po && po.data) || []).filter((x) => x.created >= bt.available_on - 3600 && x.status !== 'canceled' && x.status !== 'failed').sort((a, b) => a.created - b.created)[0];
        payout = first ? { status: first.status === 'paid' ? 'deposited' : 'on_the_way', date: day(first.arrival_date) } : { status: 'upcoming', date: day(bt.available_on), estimate: true };
      }
      out.stripe = {
        status: ch.disputed ? 'disputed' : ch.refunded ? 'refunded' : ch.amount_refunded ? 'partly refunded' : ch.status === 'failed' ? 'failed' : ch.status === 'pending' ? 'processing' : 'succeeded',
        created: day(ch.created || pi.created), chargeId: ch.id || '', paymentIntent: pi.id, receiptUrl: ch.receipt_url || '',
        type: pm.type || '', card: card ? { brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year, funding: card.funding, wallet: card.wallet ? card.wallet.type : '' } : null,
        bank: bank ? { name: bank.bank_name || 'Bank account', last4: bank.last4 || '' } : null, link: pm.type === 'link' ? { email: (pm.link && pm.link.email) || '' } : null,
        name: (ch.billing_details && ch.billing_details.name) || '', address: [ad.line1, ad.line2, ad.city, [ad.state, ad.postal_code].filter(Boolean).join(' '), ad.country].filter(Boolean).join(', '),
        refunded: round2((ch.amount_refunded || 0) / 100), fee: bt.fee != null ? round2(bt.fee / 100) : null, net: bt.net != null ? round2(bt.net / 100) : null, payout,
      };
    } catch (e) { out.stripeError = e.message; }
  }
  return out;
}
app.get('/api/payment-detail/:id', async (req, res) => {
  const f = findPayment(req.params.id); if (!f) return res.status(404).json({ error: 'Payment not found' });
  res.json(await paymentDetail(f));
});
// Issue a refund: card and bank payments go back through Stripe; payments you recorded (cash, check…) are marked refunded, since you return that money yourself
const REFUND_REASONS = { requested_by_customer: 'Requested by the client', duplicate: 'Duplicate payment', fraudulent: 'Fraudulent', other: 'Other' };
app.post('/api/payment-detail/:id/refund', async (req, res) => {
  if (!isAdmin(currentUser(req))) return res.status(403).json({ error: 'Only the account owner or an admin can issue refunds' });
  const f = findPayment(req.params.id); if (!f) return res.status(404).json({ error: 'Payment not found' });
  if (f.p.id.startsWith('i-')) return res.status(400).json({ error: 'This older payment wasn’t itemized, so it can’t be refunded here. Remove the payment from the invoice instead.' });
  const b = req.body || {}; const amount = round2(Number(b.amount)); const left = round2((Number(f.p.amount) || 0) + (Number(f.p.tip) || 0) - refundedOf(f.p.refunds));
  if (!(amount > 0)) return res.status(400).json({ error: 'Enter the amount to refund' });
  if (amount > left + 0.004) return res.status(400).json({ error: left > 0 ? `You can refund up to ${money(left)}` : 'This payment has already been refunded in full' });
  const reason = REFUND_REASONS[b.reason] ? b.reason : 'requested_by_customer'; const note = String(b.note || '').trim().slice(0, 500);
  const r = { id: uid(), amount, reason, note, at: new Date().toISOString(), by: currentUser(req).name || '', status: 'succeeded' };
  if (f.p.method === 'stripe') {
    if (!/^pi_/.test(f.p.reference || '') || !stripeKey()) return res.status(400).json({ error: 'This online payment can’t be refunded from here. Refund it in your Stripe dashboard.' });
    try {
      const sr = await stripeApi('POST', 'refunds', { payment_intent: f.p.reference, amount: String(Math.round(amount * 100)), ...(reason !== 'other' ? { reason } : {}), 'metadata[by]': r.by, 'metadata[payment]': f.p.id });
      Object.assign(r, { stripeRefundId: sr.id, status: sr.status === 'succeeded' ? 'succeeded' : sr.status === 'failed' || sr.status === 'canceled' ? sr.status : 'pending' });
    } catch (e) { return res.status(502).json({ error: `Stripe couldn’t refund this payment: ${e.message}` }); }
  } else if (['demo', 'demo-card'].includes(f.p.method)) return res.status(400).json({ error: 'Demo payments charged nobody, so there’s nothing to refund' });
  clearPayCache(); // the Payments page shows the refund right away
  if (f.kind === 'quote') { f.doc.depositRefunds = [...(f.doc.depositRefunds || []), r]; }
  else { f.p.refunds = [...(f.p.refunds || []), r]; settleInvoice(f.doc); }
  save(); res.json(await paymentDetail(findPayment(req.params.id)));
});
// Download PDF: a receipt for this payment
app.get('/api/payment-detail/:id/pdf', async (req, res) => {
  const f = findPayment(req.params.id); if (!f) return res.status(404).json({ error: 'Payment not found' });
  const d = await paymentDetail(f); const P = d.payment; const X = d.stripe; const co = db.company; const C = d.client;
  const pdf = createPdf(); const L = 54; const R = 558; let y = 64;
  // the business
  pdf.text(L, y, co.name || 'Receipt', { size: 18, bold: true }); y += 18;
  for (const s of [co.address, [co.phone ? fmtUsPhone(co.phone) : '', co.email].filter(Boolean).join('  ·  '), co.website].filter(Boolean)) { y = pdf.para(L, y, s, 300, { size: 10, color: '#475569', lineHeight: 14 }); }
  pdf.text(R, 64, 'PAYMENT RECEIPT', { size: 11, bold: true, color: '#475569', align: 'right' });
  pdf.text(R, 82, `Receipt for ${d.doc.kind === 'quote' ? 'Quote' : 'Invoice'} #${d.doc.number}`, { size: 10, color: '#475569', align: 'right' });
  pdf.text(R, 96, `Paid ${niceDate(P.date)}`, { size: 10, color: '#475569', align: 'right' });
  y = Math.max(y, 110) + 16; pdf.line(L, y, R, y); y += 34;
  pdf.text(L, y, 'Amount paid', { size: 10, color: '#475569' }); y += 30; pdf.text(L, y, money(P.amount), { size: 30, bold: true }); y += 30;
  if (P.refunded) { pdf.text(L, y, `Refunded ${money(P.refunded)}  ·  Net paid ${money(P.amount - P.refunded)}`, { size: 11, color: '#b91c1c' }); y += 18; }
  y += 14;
  // who paid, and how
  const top = y; pdf.text(L, y, 'RECEIVED FROM', { size: 9, bold: true, color: '#64748b' }); y += 16;
  if (C) { pdf.text(L, y, C.company ? `${C.name} (${C.company})` : C.name, { size: 11, bold: true }); y += 15; for (const s of [C.address, C.email, C.phone ? fmtUsPhone(C.phone) : ''].filter(Boolean)) y = pdf.para(L, y, s, 230, { size: 10, color: '#334155', lineHeight: 14 }); }
  let y2 = top; const M = 320; pdf.text(M, y2, 'PAYMENT DETAILS', { size: 9, bold: true, color: '#64748b' }); y2 += 16;
  const brand = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover' };
  const how = X ? (X.card ? `${brand[X.card.brand] || X.card.brand || 'Card'} •••• ${X.card.last4}${X.card.wallet ? ` (${{ apple_pay: 'Apple Pay', google_pay: 'Google Pay', link: 'Link' }[X.card.wallet] || 'digital wallet'})` : ''}` : X.bank ? `${X.bank.name} •••• ${X.bank.last4}` : X.link ? 'Link' : 'Online payment')
    : { cash: 'Cash', check: 'Check', card: 'Credit/debit card', bank: 'Bank payment', zelle: 'Zelle', cashapp: 'Cash App', paypal: 'PayPal', venmo: 'Venmo' }[P.method] || 'Other';
  for (const [k, v] of [['Method', how], ['Date', niceDate(P.date)], ['Transaction', X ? X.chargeId || X.paymentIntent : P.reference], ['Applied to', `${d.doc.kind === 'quote' ? 'Deposit on quote' : 'Invoice'} #${d.doc.number}`]]) {
    if (!v) continue; pdf.text(M, y2, k, { size: 10, color: '#64748b' }); y2 = pdf.para(M + 78, y2, v, R - M - 78, { size: 10, lineHeight: 14 }) + 2;
  }
  y = Math.max(y, y2) + 22;
  // summary
  pdf.rect(L, y, R - L, P.refunded ? 92 : 66, { fill: '#f1f5fb' }); y += 24;
  const row = (k, v, bold) => { pdf.text(L + 14, y, k, { size: 11, bold }); pdf.text(R - 14, y, v, { size: 11, bold, align: 'right' }); y += 22; };
  row('Payment amount', money(P.amount)); if (P.refunded) row('Refunded', '-' + money(P.refunded)); row('Total paid', money(P.amount - P.refunded), true);
  y += 30; pdf.text(L, y, `Thank you for your business${co.name ? ', from all of us at ' + co.name : ''}.`, { size: 11, color: '#334155' });
  pdf.text(306, 760, `Receipt generated ${niceDate(iso(new Date()))}`, { size: 8, color: '#94a3b8', align: 'center' });
  const name = `Receipt-${String(d.doc.number).replace(/[^\w-]+/g, '')}-${P.date}.pdf`;
  res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${name}"`); res.end(pdf.toBuffer(`Receipt ${d.doc.number}`));
});
// send (or resend) a receipt for one payment to the client's email
app.post('/api/payment-detail/:id/receipt', async (req, res) => {
  const f = findPayment(req.params.id); if (!f) return res.status(404).json({ error: 'Payment not found' });
  const c = findClient(f.doc.clientId); if (!c || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email || '')) return res.status(400).json({ error: 'This client has no email address. Add one to their client details first.' });
  const rm = renderEmail('receipt', { client_name: c.name, company_name: db.company.name, amount: money(Number(f.p.amount) || 0), paid_for: f.what, date: niceDate((f.p.date || '').slice(0, 10)), reference: f.p.reference || f.doc.number });
  const n = await notify({ clientId: c.id, channel: 'email', kind: 'receipt', refId: f.doc.id, refNumber: f.doc.number, subject: rm.subject, body: rm.text, html: rm.html }); save();
  if (n.status === 'failed') return res.status(502).json({ error: n.detail || 'The receipt couldn’t be sent' });
  res.json({ ok: true, to: c.email, status: n.status });
});

function tellBusinessSent(via, what, amount, clientName) {
  if (!db.company.email) return;
  sendTemplate('zelleReported', db.company.email, { client: clientName || 'A client', amount: money(amount), what, method: PAY_VIA[via], business: db.company.name, account_url: baseUrl() }).catch(() => {});
}

// Add a tip: No tip / 10% / 15% / 20% / Other; the pay button shows the new total as they choose (Checkout gets a separate Tip line)
function tipPicker(due, methods) {
  const c = esc(db.company.brandColor);
  const opt = (v, label, sub, on) => `<label class="tip-o"><input type="radio" name="tipPct" value="${v}" ${on ? 'checked' : ''}><span>${label}${sub ? `<small>${sub}</small>` : ''}</span></label>`;
  return `<style>.tip{border:0;margin:0 0 14px;padding:0;min-width:0}.tip legend{font-weight:600;margin-bottom:8px;padding:0}.tip-g{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.tip-o{position:relative}.tip-o input{position:absolute;opacity:0;pointer-events:none}
.tip-o span{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:52px;padding:6px 4px;border:1px solid #d1d5db;border-radius:8px;cursor:pointer;font-size:15px;text-align:center}.tip-o small{font-size:12px;color:#6b7280;font-weight:400}
.tip-o input:checked+span{border-color:${c};box-shadow:0 0 0 1px ${c};font-weight:600}.tip-o input:focus-visible+span{outline:2px solid ${c};outline-offset:2px}
.tip-x{display:none;margin-top:10px}.tip-x.on{display:block}@media(max-width:420px){.tip-g{grid-template-columns:repeat(3,1fr)}}</style>
<fieldset class="tip"><legend>Add a tip?</legend><div class="tip-g">${opt('0', 'No tip', '', true)}${TIP_PCTS.map((p) => opt(p, p + '%', money(round2(due * p / 100)))).join('')}${opt('other', 'Other', '')}</div>
<label class="tip-x" id="tipX">Tip amount<input name="tipAmount" type="text" inputmode="decimal" placeholder="$0.00" autocomplete="off"></label>
<p class="muted" style="margin:8px 0 0">Tips go to ${esc(db.company.name)}.</p></fieldset>
<script>(function(){var due=${due},max=${tipMax(due)},f=document.currentScript.closest('form'),x=f.querySelector('#tipX'),base=${JSON.stringify(payButtonLabel(methods, 0)).replace(/</g, '\\u003c')};
function m(v){return '$'+v.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g,',')}
function tip(){var c=f.querySelector('[name=tipPct]:checked'),v=c?c.value:'0';x.classList.toggle('on',v==='other');if(v==='other'){var t=parseFloat(String(f.tipAmount.value).replace(/[$,\\s]/g,''));return t>0?Math.min(Math.round(t*100)/100,max):0}return Math.round(due*Number(v))/100}
function up(){var t=tip(),b=f.querySelector('#payBtn');if(b)b.textContent=base.replace('$0.00',m(due+t))+(t>0?' (includes '+m(t)+' tip)':'')}
f.addEventListener('change',function(e){up();if(e.target.value==='other')f.tipAmount.focus()});f.tipAmount.addEventListener('input',up);document.addEventListener('DOMContentLoaded',up);})();</script>`;
}
app.get('/pay/:token', (req, res) => {
  const inv = db.invoices.find((x) => x.token === req.params.token);
  if (!inv) return res.status(404).send(shell('Not found', '<h1>Invoice not found</h1>'));
  const c = findClient(inv.clientId); const x = withStatus(inv); const st = x.displayStatus; const due = x.balanceDue;
  const live = !!stripeKey(); const on = (k) => inv[k] !== 'off'; const methods = onlineMethods('invoice', inv);
  const account = db.invoices.filter((i) => i.clientId === inv.clientId && i.status !== 'paid' && i.status !== 'draft').reduce((s, i) => s + withStatus(i).balanceDue, 0);
  const card = !methods.length ? '' : live
    ? `<form method="post" action="/pay/${esc(inv.token)}/checkout">${paySettings().tips && due > 0 ? tipPicker(due, methods) : ''}<button class="btn" id="payBtn">${payButtonLabel(methods, due)}</button></form>${methods.length > 1 ? '<p class="muted">Card or bank account (ACH)</p>' : ''}`
    : '';
  const zelle = offlineBox(inv, due, `Invoice ${inv.number}`, `/pay/${inv.token}`);
  const preview = !!currentUser(req); const payOff = (html) => (preview ? previewOff(html, 'opacity:.55') : html);
  const previewNote = preview ? `<p style="margin:12px 0;padding:12px 16px;border-radius:10px;background:#fdf2dc;color:#6b4a00;font-size:14px">${PREVIEW_NOTE}</p>` : '';
  res.send(shell(`Invoice ${inv.number}`, `<h1>Invoice ${esc(inv.number)} <span class="badge ${st === 'paid' ? 'paid' : ''}">${esc(st === 'overdue' ? 'past due' : st)}</span></h1>
${st === 'overdue' && on('showLateStamp') ? '<div style="display:inline-block;margin:8px 0;padding:4px 14px;border:2px solid #dc2626;color:#dc2626;border-radius:6px;font-weight:800;letter-spacing:.08em;transform:rotate(-2deg)">PAST DUE</div>' : ''}
${db.company.taxIdNumber ? `<div class="muted">${esc(db.company.taxIdName || 'Tax ID')}: ${esc(db.company.taxIdNumber)}</div>` : ''}<div class="muted">Billed to ${esc(c?.name)}${inv.subject ? ` · ${esc(inv.subject)}` : ''} · Issued ${esc(niceDate(inv.issueDate))} · Due ${inv.dueDate && inv.dueDate <= inv.issueDate ? 'upon receipt' : esc(niceDate(inv.dueDate))}</div>
${itemsTable(x, { qty: on('showQty'), unit: on('showUnit'), line: on('showLineTotals'), invoice: true })}
${on('showAccountBalance') && st !== 'paid' && account > 0 ? `<p class="muted" style="text-align:right">Account balance (all open invoices): <strong>${money(account)}</strong></p>` : ''}
${(() => { const next = st !== 'paid' && nextLateFee(inv); return next ? `<p class="muted" style="text-align:right">${next.n > 1 ? 'Another late fee' : 'A late fee'} of ${esc(lateFeeText(db.company.lateFee))} is added if this invoice isn’t paid by ${esc(niceDate(addDaysYmd(next.on, -1)))}.</p>` : ''; })()}
${inv.notes ? `<p style="white-space:pre-wrap">${esc(inv.notes)}</p>` : ''}
${previewNote}${st === 'paid' ? `<p>Paid on ${esc(niceDate(inv.paidAt))}. Thank you!</p>${reviewPrompt(inv, preview)}` : payOff(card + zelle) + (!card && !zelle ? `<p class="muted">Please contact ${esc(db.company.name)} at ${esc(db.company.phone || db.company.email)} to arrange payment.</p>` : '')}
${inv.disclaimer ? `<div style="margin:16px 0;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;white-space:pre-wrap" class="muted">${esc(inv.disclaimer)}</div>` : `<p class="muted">${esc(db.company.invoiceFooter)}</p>`}`));
});
app.use('/pay', express.urlencoded({ extended: false }));
// the client says they paid outside the app: zelleSentAt is when (for any method; the name is older than the others), sentVia is how.
// /zelle-sent is the older address, still answered for pages already open.
const invoiceSent = (req, res) => {
  const inv = db.invoices.find((x) => x.token === req.params.token);
  if (!inv) return res.status(404).send('Not found');
  const via = req.params.via || 'zelle';
  if (inv.status !== 'paid' && !inv.zelleSentAt && offlineMethods(inv).some((m) => m.key === via)) { inv.zelleSentAt = iso(new Date()); inv.sentVia = via; save(); tellBusinessSent(via, `invoice ${inv.number}`, withStatus(inv).balanceDue, findClient(inv.clientId)?.name); }
  res.redirect(`/pay/${inv.token}`);
};
app.post('/pay/:token/sent/:via', invoiceSent); app.post('/pay/:token/zelle-sent', invoiceSent);
app.post('/pay/:token/checkout', async (req, res) => {
  const inv = db.invoices.find((x) => x.token === req.params.token);
  if (!inv || !stripeKey() || !onlineMethods('invoice', inv).length) return res.status(400).send('Payments unavailable');
  const due = withStatus(inv).balanceDue;
  if (inv.status === 'paid' || !(due > 0)) return res.redirect(`/pay/${inv.token}`);
  try {
    const tip = paySettings().tips ? readTip(req.body || {}, due) : 0;
    const s = await stripeCheckout({ amount: due, tip, name: `Invoice ${inv.number}`, client: findClient(inv.clientId), meta: { invoiceId: inv.id }, successUrl: `${baseUrl()}/pay/${inv.token}/success`, cancelUrl: `${baseUrl()}/pay/${inv.token}`, methods: onlineMethods('invoice', inv) });
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
  if (q.status === 'sent' && !q.viewPushedAt && !currentUser(req)) { // the client's first look, not the team's own preview
    q.viewPushedAt = new Date().toISOString(); save();
    pushTo(usersWhoCan('quotes'), 'quoteViewed', { title: 'Client viewed quote', body: `${c ? c.name : 'A client'} viewed quote ${q.number}${q.title ? ` (${q.title})` : ''}`, url: `/quotes/edit?id=${q.id}` });
  }
  let depositSection = '';
  if (q.status === 'approved' && !q.signedAt) depositSection = quoteSignBox(q); // every approved quote is signed next, deposit or not
  else if (q.status === 'approved' && q.depositFee > 0) {
    if (!q.depositPaidAt) {
      depositSection = `<div style="background:#fef3c7;padding:16px;border-radius:8px;margin-top:16px;border:1px solid #fcd34d">
<h3 style="margin-top:0">Deposit required: ${money(q.depositFee)}</h3>
<p>Your quote has been signed. A deposit of ${money(q.depositFee)} is required to proceed with the work.</p>
${onlineMethods('quote', q).length ? `<form method="post" action="/p/quote/${esc(q.token)}/pay-deposit" style="display:flex;gap:8px">
<button class="btn">${payButtonLabel(onlineMethods('quote', q), q.depositFee, 'deposit of ')}</button>
</form>` : ''}
${offlineBox(q, q.depositFee, `Deposit for quote ${q.number}`, `/p/quote/${q.token}`)}
${!onlineMethods('quote', q).length && !offlineMethods(q).length ? `<p class="muted">Please contact ${esc(db.company.name)} at ${esc(db.company.phone || db.company.email)} to arrange your deposit payment.</p>` : ''}
</div>`;
    } else {
      depositSection = `<div style="background:#f0fdf4;padding:16px;border-radius:8px;margin-top:16px;border:1px solid #86efac">
<h3 style="margin-top:0">✓ Deposit paid</h3>
<p>Thank you! Your deposit of ${money(q.depositPaidAmount ?? q.depositFee)} has been received. We will begin work shortly.</p>
</div>`;
    }
  }
  const signed = q.signedAt ? `<div style="margin-top:16px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:8px"><strong>✓ Signed${q.signedName ? ` by ${esc(q.signedName)}` : ''}</strong> <span class="muted">· ${esc(niceDate(q.signedAt.slice(0, 10)))}</span>${q.signature ? `<img src="${esc(q.signature.file)}" alt="Signature" style="display:block;max-width:100%;width:320px;margin-top:8px">` : ''}</div>` : '';
  res.send(quoteView(q, c, { signed, depositSection, sent: req.query.changes === 'sent', preview: !!currentUser(req) && req.query.collect !== '1', business: !!currentUser(req) }));
});
// ---------- the client's quote page, laid out like the client hub: the hub's menu on the left (behind Menu on phones),
// the quote in the middle and what to do next on the right (on top on phones, where the quote folds away under Hide Quote) ----------
const QV_ICON = { // the same icons as the client hub (CP_ICON in public/pages.js)
  requests: '<path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M4 13h4l1.5 2.5h5L16 13h4"/><path d="M12 4v7m-3-3 3 3 3-3"/>',
  estimates: '<circle cx="10" cy="10" r="5"/><path d="m14 14 6 6"/><path d="M8.5 10h3M10 8.5v3"/>',
  appointments: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4m8-4v4"/>',
  invoices: '<path d="M6 3h9l4 4v14H6z"/><path d="M14.5 10.5c-.4-.9-1.3-1.5-2.5-1.5-1.4 0-2.5.8-2.5 1.9 0 2.6 5 1.4 5 4 0 1.1-1.1 1.9-2.5 1.9-1.2 0-2.1-.6-2.5-1.5M12 7.5V9m0 8v1.5"/>',
  reviews: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  wallet: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
  contact: '<path d="M5 4h3.5l1.5 4.5-2 1.5a12 12 0 0 0 6 6l1.5-2 4.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5A16.5 16.5 0 0 1 3.5 5.5 1.5 1.5 0 0 1 5 4z"/>',
  refer: '<path d="M7 11v9H4v-9zM7 11l4-7c1.4 0 2.3 1 2 2.4L12.5 10H18a2 2 0 0 1 2 2.3l-1.1 6A2 2 0 0 1 17 20H7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', menu: '<path d="M4 7h13M4 12h16M4 17h13"/><path d="M17 9l3 3-3 3"/>', back: '<path d="M19 12H5m6-6-6 6 6 6"/>', chev: '<path d="m6 15 6-6 6 6"/>',
};
const qvIcon = (k, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${QV_ICON[k]}</svg>`;
const QV_STATUS = { draft: ['Draft', 'grey'], sent: ['Awaiting response', 'wait'], approved: ['Approved', 'ok'], converted: ['Approved', 'ok'], declined: ['Declined', 'no'] };
const QV_CSS = `.qv-biz{position:sticky;top:0;z-index:40;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;padding:6px 12px;padding-top:calc(6px + env(safe-area-inset-top));background:#032b3a;color:#fff;font-size:14px}.qv-biz a{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 16px 0 10px;border-radius:99px;background:rgba(255,255,255,.14);color:#fff;font-size:16px;font-weight:700;text-decoration:none}.qv-biz span{opacity:.8;text-align:right}.qv-is-biz .qv-side{top:52px;height:calc(100vh - 52px)}
@media (max-width:900px){.qv-is-biz .qv-top{top:52px}}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f5f3;color:#032b3a;font-size:15px}
.qv{display:flex;min-height:100vh}.qv-side{width:186px;flex:none;background:#fff;border-right:1px solid #e4e1dc;padding:24px 7px;position:sticky;top:0;height:100vh;overflow-y:auto}
.qv-brand{display:flex;justify-content:center;padding:4px 8px 22px}.qv-brand img{max-width:140px;max-height:100px;object-fit:contain}.qv-mono{width:72px;height:72px;border-radius:16px;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700}
.qv-co{font-weight:700;font-size:14px;padding:16px 8px 12px}.qv-side hr{border:0;border-top:1px solid #e4e1dc;margin:8px}
.qv-new{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 12px;height:40px;border:1px solid #d7d3cc;border-radius:8px;color:var(--brand);font-weight:600;font-size:14px;text-decoration:none}.qv-new:hover{background:#efede9}
.qv-nav{display:flex;align-items:center;gap:14px;padding:9px 8px;margin:2px 0;border-radius:8px;color:#032b3a;font-size:14px;font-weight:600;text-decoration:none}.qv-nav svg{flex:none}.qv-nav:hover{background:#efede9}.qv-nav.on{background:#e9e6e0}.qv-refer{color:#3a7d1f}
.qv-top{display:none}.qv-wrap{flex:1;min-width:0}.qv-main{padding:28px 40px 48px}
.qv-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,422px);gap:32px;align-items:start}
.qv-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.qv-tb{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border:1px solid #d7d3cc;border-radius:8px;background:#f6f5f3;color:#032b3a;font:inherit;font-size:14px;font-weight:600;text-decoration:none;cursor:pointer}.qv-tb:hover{background:#efede9}
.qv-docwrap{grid-column:1;grid-row:1}.qv-act{grid-column:2;grid-row:1;margin-top:56px;background:#fff;border:1px solid #e4e1dc;border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:16px}
.qv-doc{background:#fff;border:1px solid #e4e1dc;border-radius:8px}.qv-doc>summary{display:none}.qv-body{padding:32px 32px 40px}
.qv-hd{display:grid;grid-template-columns:1fr 232px;border-bottom:3px solid #d5dbdf;padding-bottom:12px}
.qv-hd-l{padding-right:16px}.qv-hd-r{border-left:3px solid #d5dbdf;padding:30px 0 0 24px;display:grid;grid-template-columns:auto 1fr;gap:4px 40px;align-content:start;font-size:14px}
.qv-no{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:14px;margin-bottom:6px}.qv-who{font-weight:700;font-size:16px;margin:4px 0 2px}.qv-hd-l>div:not([class]),.qv-ph{display:block;font-size:14px;line-height:1.45}.qv-ph{color:inherit;text-decoration:none}
.qv-pill{display:inline-flex;align-items:center;gap:7px;padding:3px 10px;border-radius:99px;font-size:12px;white-space:nowrap}.qv-pill::before{content:'';width:8px;height:8px;border-radius:50%;background:currentColor}
.qv-pill.wait{background:#f6efc4;color:#5f5a1e}.qv-pill.wait::before{background:#c9b23f}.qv-pill.ok{background:#e5f4e3;color:#2c6a1b}.qv-pill.no{background:#fbe9e7;color:#a8321f}.qv-pill.grey{background:#eef0f1;color:#3d4b50}.qv-pill.chg{background:#fdf2dc;color:#8a5a00}
.qv-items{margin-top:48px}.qv-ih,.qv-it{display:grid;grid-template-columns:minmax(0,1fr) 64px 110px 100px;gap:0 12px}.qv-ih{font-weight:700;font-size:16px;padding-bottom:14px}.qv-ih span:not(:first-child),.qv-n{text-align:right}
.qv-it{padding:14px 0 18px;border-bottom:1px solid #e4e1dc;font-size:14px}.qv-it.sub .qv-it-d{padding-left:24px;border-left:2px solid #e4e1dc}.qv-it strong{display:block;margin-bottom:8px}.qv-it p{margin:0;white-space:pre-line;line-height:1.45;max-width:260px}.qv-l{display:none}
.qv-tot{display:grid;grid-template-columns:1fr 244px;border-top:3px solid #d5dbdf;margin-top:32px}.qv-tot>div:last-child{border-left:1px solid #d5dbdf;border-bottom:3px solid #d5dbdf}
.qv-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0 8px 8px;border-bottom:1px solid #e4e1dc;font-size:14px}.qv-row:last-child{border-bottom:0}
.qv-text{margin-top:20px;font-size:14px;line-height:1.45;white-space:pre-line}
.qv-pick{margin:28px 0 0;font-size:15px;font-weight:600}.qv-opt{margin-top:24px;padding:20px 20px 4px;border:2px solid #e4e1dc;border-radius:12px}.qv-opt.rec{border-color:var(--brand)}.qv-opt .qv-items{margin-top:16px}.qv-opt .qv-tot{margin-top:16px}
.qv-oh h2{margin:0;font-size:19px}.qv-on{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px}.qv-oh p{margin:8px 0 0;font-size:14px;line-height:1.45;color:#5b6b70;white-space:pre-line}
.qv-rec{padding:3px 10px;border-radius:99px;background:var(--brand);color:#fff;font-size:12px;font-weight:700}.qv-ot{margin-left:auto;font-size:19px;font-weight:700}
.qv-btn.qv-obtn{height:auto;min-height:40px;padding:8px 12px;text-align:center;line-height:1.3}
@media (max-width:900px){.qv-opt{padding:16px 16px 4px;margin:20px -4px 0}.qv-opt .qv-items{margin-top:4px}.qv-ot{font-size:18px}}
.qv-btn{display:flex;align-items:center;justify-content:center;width:100%;height:40px;border:1px solid #d7d3cc;border-radius:8px;background:#fff;color:#032b3a;font:inherit;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none}.qv-btn:hover{background:#f6f5f3}
.qv-btn.primary{background:var(--brand);border-color:var(--brand);color:#fff}.qv-btn.primary:hover{filter:brightness(.94)}.qv-act form{margin:0}
.qv-chg>summary{list-style:none}.qv-chg>summary::-webkit-details-marker{display:none}.qv-chg[open]>summary{display:none}
.qv-chg textarea{width:100%;min-height:110px;padding:10px;border:1px solid #d7d3cc;border-radius:8px;font:inherit;font-size:14px;resize:vertical;margin:8px 0 10px}.qv-chg label{font-weight:600;font-size:14px}
.qv-link{background:none;border:0;padding:0;color:#5b6b70;font:inherit;font-size:13px;text-decoration:underline;cursor:pointer}
.qv-note{font-size:13px;line-height:1.45;color:#5b6b70;white-space:pre-line}.qv-note strong{color:#032b3a}.qv-msg{padding:12px 14px;border-radius:8px;background:#e5f4e3;color:#2c6a1b;font-size:14px}.qv-preview{padding:12px 14px;border-radius:8px;background:#fdf2dc;color:#6b4a00;font-size:14px;line-height:1.45}
.preview-off .qv-btn,.preview-off .qv-link,.preview-off .btn,.preview-off summary{opacity:.5;cursor:not-allowed;pointer-events:none}
.qv-pdf-m{display:none}.qv-act .btn{background:var(--brand);color:#fff;border:0;border-radius:8px;padding:11px 18px;font:inherit;font-size:15px;font-weight:600;cursor:pointer}.qv-act .btn.alt{background:#fff;color:#032b3a;border:1px solid #d7d3cc}.qv-act .muted{color:#5b6b70;font-size:13px}
.qv-act input[type=text]{padding:10px;border:1px solid #d7d3cc;border-radius:8px;width:100%;margin:4px 0 10px;font:inherit}.qv-act>div[style]{margin-top:0!important}
.qv-nav:focus-visible,.qv-btn:focus-visible,.qv-tb:focus-visible,.qv-new:focus-visible,.qv-burger:focus-visible,.qv-doc>summary:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
@media (max-width:900px){
 .qv{display:block}.qv-side{display:none}.qv-side.open{display:block;position:fixed;inset:73px 0 0;z-index:30;width:auto;height:auto;border-right:0;padding:8px 16px}.qv-side.open .qv-brand,.qv-side.open .qv-co{display:none}
 .qv-top{display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:31;height:73px;padding:0 16px;background:#fff;box-shadow:0 2px 8px rgba(3,43,58,.08)}
 .qv-burger{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border:0;background:none;color:#032b3a;font:inherit;font-size:11px;font-weight:600;cursor:pointer}.qv-top img{max-height:40px;max-width:110px}.qv-top .qv-mono{width:40px;height:40px;font-size:16px;border-radius:10px}
 .qv-main{padding:24px 16px 40px}.qv-grid{display:flex;flex-direction:column;align-items:stretch;gap:16px}.qv-bar{display:none}
 .qv-act{order:-1;margin:0;padding:0;background:none;border:0}.qv-act .qv-btn{height:48px;font-size:17px}
 .qv-doc>summary{display:flex;justify-content:space-between;align-items:center;padding:20px;font-weight:700;font-size:17px;cursor:pointer;list-style:none}.qv-doc>summary::-webkit-details-marker{display:none}
 .qv-doc>summary svg{color:var(--brand);transition:transform .15s}.qv-doc:not([open])>summary svg{transform:rotate(180deg)}.qv-doc[open]>summary{border-bottom:1px solid #e4e1dc}.qv-doc:not([open]) .qv-hide,.qv-doc[open] .qv-show{display:none}
 .qv-body{padding:20px 20px 28px}.qv-hd{display:block;border-bottom:1px solid #e4e1dc;margin:0 -20px;padding:0 20px 20px}.qv-hd-r{border:0;padding:12px 0 0;grid-template-columns:1fr 1fr;font-size:15px}
 .qv-no{font-size:15px;color:#5b6b70}.qv-hd-l>div:not([class]),.qv-ph{font-size:15px}.qv-ph{color:var(--brand)}.qv-items{margin-top:8px}.qv-ih{display:none}
 .qv-it{grid-template-columns:repeat(3,minmax(0,1fr));gap:0;padding:20px 0 0;border-bottom:0}.qv-it-d{grid-column:1/-1;padding-bottom:12px;border-bottom:1px solid #d5dbdf}.qv-it p{max-width:none;font-size:15px}.qv-it strong{font-size:16px}
 .qv-n{padding:12px 12px 12px 0;border-bottom:1px solid #d5dbdf;font-size:15px}.qv-n+.qv-n{border-left:1px solid #d5dbdf}.qv-l{display:block;font-weight:700;text-transform:uppercase;font-size:14px;margin-bottom:6px}
 .qv-tot{display:block;margin-top:36px}.qv-tot>div:first-child{display:none}.qv-tot>div:last-child{border:0}.qv-row{padding:14px 0;font-size:15px}
 .qv-pdf-m{display:flex;margin-top:24px}}`;
function quoteView(q, c, { signed, depositSection, sent, preview, business }) {
  const co = db.company; const brand = accentColor() || brandLib.siteColor('--brand') || DEFAULT_BUTTON; // the same color as the client hub
  const hub = tenancy.has('clientPortal') && c && c.portalToken ? `/client-portal?c=${encodeURIComponent(c.portalToken)}` : '';
  const logo = co.logo ? `<img src="${esc(co.logo)}" alt="${esc(co.name)}">` : `<div class="qv-mono">${esc((co.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</div>`;
  const nav = [[['requests', 'Requests'], ['estimates', 'Estimates'], ['appointments', 'Appointments'], ['invoices', 'Invoices'], ...(tenancy.has('reviews') ? [['reviews', 'Reviews']] : [])], [['wallet', 'Wallet']], [['contact', 'Contact Us']]]
    .map((g) => g.map(([k, l]) => `<a class="qv-nav ${k === 'estimates' ? 'on' : ''}" href="${hub}#${k}">${qvIcon(k)}<span>${l}</span></a>`).join('')).join('<hr>')
    + (tenancy.has('referrals') ? `<hr><a class="qv-nav qv-refer" href="${hub}#refer">${qvIcon('refer')}<span>Refer a Friend</span></a>` : '');
  const side = hub ? `<aside class="qv-side" id="qvMenu"><div class="qv-brand">${logo}</div><div class="qv-co">${esc(co.name)}</div>${business ? `<span class="qv-new" style="opacity:.5;cursor:not-allowed" title="Only your client can send a request">${qvIcon('plus', 18)} New Request</span>` : `<a class="qv-new" href="${hub}#new-request">${qvIcon('plus', 18)} New Request</a>`}<nav aria-label="Client hub">${nav}</nav></aside>` : '';
  const top = `<header class="qv-top">${hub ? `<button type="button" class="qv-burger" aria-expanded="false" aria-controls="qvMenu" onclick="var o=document.getElementById('qvMenu').classList.toggle('open');this.setAttribute('aria-expanded',o)">${qvIcon('menu', 30)}Menu</button>` : '<span></span>'}${logo}</header>`;
  const open = q.status === 'sent' || q.status === 'draft'; const chg = open && q.changesRequestedAt && (q.changeRequests || []).length;
  const [label, tone] = chg ? ['Changes requested', 'chg'] : QV_STATUS[q.status] || [q.status, 'grey'];
  const addr = q.address || (c && c.address) || '';
  const taxName = Number(q.taxRate) === Number(co.taxRate) && co.taxName ? co.taxName : 'Tax';
  const row = (l, v) => `<div class="qv-row"><span>${l}</span><span>${v}</span></div>`;
  const totalsOf = (d) => row('Subtotal', money(d.subtotal)) + (d.discount > 0 ? row(esc(discLabel(d)), '−' + money(d.discount)) : '')
    + (Number(d.taxRate) ? row(`${esc(taxName)} (${d.taxRate}%)`, money(d.tax)) : '') + row('Total', money(d.total))
    + (d.depositFee > 0 ? row(`Deposit${d.depositType === 'percent' ? ` (${d.depositValue}%)` : ''}`, money(d.depositFee)) : '');
  const itemsOf = (d) => (d.items || []).map((i) => `<div class="qv-it${i.sub ? ' sub' : ''}"><div class="qv-it-d"><strong>${esc(i.desc)}</strong>${i.details ? `<p>${esc(i.details)}</p>` : ''}</div>
${heading(i) ? '<div class="qv-n"></div><div class="qv-n"></div><div class="qv-n"></div>' : included(i) ? '<div class="qv-n"></div><div class="qv-n"></div><div class="qv-n"><span class="qv-l">Total</span>Included</div>' : `<div class="qv-n"><span class="qv-l">Qty.</span>${esc(String(i.qty))}</div><div class="qv-n"><span class="qv-l">Unit price</span>${money(i.price)}</div><div class="qv-n"><span class="qv-l">Total</span>${money(i.qty * i.price)}</div>`}</div>`).join('');
  // Good / Better / Best: each option with its own items and totals until one is chosen; then only that one
  const parts = quoteParts(q); const many = parts.length > 1;
  const optHead = (p) => (p.opt ? `<div class="qv-oh" id="opt-${esc(p.opt.id)}"><div class="qv-on"><h2>${p.chosen ? 'Your choice: ' : ''}${esc(p.opt.name)}</h2>${p.recommended ? '<span class="qv-rec">Recommended</span>' : ''}${many ? `<span class="qv-ot">${money(p.doc.total)}</span>` : ''}</div>${p.opt.desc ? `<p>${esc(p.opt.desc)}</p>` : ''}</div>` : '');
  const body = parts.map((p) => `<section class="${p.opt ? 'qv-opt' : ''}${p.recommended ? ' rec' : ''}">${optHead(p)}<div class="qv-items"><div class="qv-ih"><span>Product / Service</span><span>Qty.</span><span>Unit Price</span><span>Total</span></div>${itemsOf(p.doc)}</div>
<div class="qv-tot"><div></div><div>${totalsOf(p.doc)}</div></div></section>`).join('');
  const depositNote = open && q.depositFee > 0 ? `<div class="qv-note">${q.depositPaidAt ? `<strong>Deposit paid: ${money(q.depositPaidAmount ?? q.depositFee)}.</strong> This estimate was updated. After you approve, you’ll sign it again.` : `<strong>Deposit: ${many && q.depositType === 'percent' ? `${q.depositValue}% of the option you choose` : `${money(q.depositFee)}${q.depositType === 'percent' ? ` (${q.depositValue}% of the total)` : ''}`}.</strong> After you approve, you’ll sign the estimate and pay this deposit before work begins.`}</div>` : '';
  const payDep = (d) => d.depositFee > 0 && !q.depositPaidAt; // a deposit still to pay: the Approve button says so
  const actions = open ? `${sent ? '<div class="qv-msg" role="status">Thanks! We got your changes and will send you an updated estimate.</div>' : ''}
${many ? `<div class="qv-note"><strong>Choose an option to approve.</strong></div>${parts.map((p) => `<form method="post" action="/p/quote/${esc(q.token)}/respond"><input type="hidden" name="opt" value="${esc(p.opt.id)}"><button class="qv-btn${p.recommended ? ' primary' : ''} qv-obtn" name="r" value="approved">Approve ${esc(p.opt.name)}${payDep(p.doc) ? ' and pay deposit' : ''} · ${money(p.doc.total)}</button></form>`).join('')}`
  : `<form method="post" action="/p/quote/${esc(q.token)}/respond"><button class="qv-btn primary" name="r" value="approved">${payDep(q) ? 'Approve and pay deposit' : 'Approve'}</button></form>`}
<details class="qv-chg"><summary class="qv-btn">Request Changes</summary><form method="post" action="/p/quote/${esc(q.token)}/changes">
<label for="qvChg">What would you like changed?</label><textarea id="qvChg" name="message" required maxlength="2000"></textarea><button class="qv-btn primary">Send to ${esc(co.name)}</button></form></details>
${chg ? `<div class="qv-note">You asked for changes on ${esc(niceDate(q.changesRequestedAt.slice(0, 10)))}: “${esc(q.changeRequests[q.changeRequests.length - 1].text)}”</div>` : ''}${depositNote}
<form method="post" action="/p/quote/${esc(q.token)}/respond" onsubmit="return confirm('Decline this estimate?')" style="display:flex;justify-content:center"><button class="qv-link" name="r" value="declined">Decline this estimate</button></form>` : '';
  const act = preview && (actions + depositSection).trim() ? `<div class="qv-preview">${PREVIEW_NOTE}</div>${previewOff(actions + depositSection, 'display:flex;flex-direction:column;gap:16px')}${signed}` : actions + signed + depositSection; const pdf = `/p/quote/${esc(q.token)}/pdf`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Estimate ${esc(q.number)} · ${esc(co.name)}</title><link rel="icon" href="/favicon.ico">
<style>:root{--brand:${esc(brand)}}${QV_CSS}</style></head><body${preview ? ' class="qv-is-biz"' : ''}>${preview ? `<div class="qv-biz"><a href="/quotes/view?id=${esc(q.id)}" onclick="if(history.length>1&&document.referrer.indexOf(location.origin)===0){history.back();return false}">${qvIcon('back', 18)} Back</a><span>Viewing as your client</span></div>` : ''}<div class="qv">${side}<div class="qv-wrap">${top}<main class="qv-main">
<div class="qv-grid"><div class="qv-docwrap"><div class="qv-bar">${hub ? `<a class="qv-tb" href="${hub}#estimates">${qvIcon('back', 18)} Back</a>` : '<span></span>'}<a class="qv-tb" href="${pdf}">Download PDF</a></div>
<details class="qv-doc" open><summary><span><span class="qv-hide">Hide Quote</span><span class="qv-show">Show Quote</span></span>${qvIcon('chev', 22)}</summary><div class="qv-body">
<div class="qv-hd"><div class="qv-hd-l"><div class="qv-no"><span>Estimate #${esc(q.number)}</span><span class="qv-pill ${tone}">${esc(label)}</span></div>
<div class="qv-who">${esc((c && c.name) || '')}</div>${addr ? `<div>${esc(addr)}</div>` : ''}${c && c.phone ? `<a class="qv-ph" href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : ''}</div>
<div class="qv-hd-r"><span>Sent on</span><span>${esc(niceDate(q.sentAt || String(q.createdAt || '').slice(0, 10)))}</span></div></div>
${many ? `<p class="qv-pick">${parts.length} options: choose the one that suits you.</p>` : ''}${body}
${q.notes ? `<div class="qv-text">${esc(q.notes)}</div>` : ''}${q.disclaimer ? `<div class="qv-text">${esc(q.disclaimer)}</div>` : ''}
<a class="qv-btn qv-pdf-m" href="${pdf}">Download PDF</a></div></details></div>
${act.trim() ? `<div class="qv-act">${act}</div>` : ''}</div></main></div></div><script src="/phone.js?v=2" defer></script></body></html>`;
}
// the client signs by drawing (finger, stylus or mouse) or by typing their name, which is written out in a script font; posted as a PNG data URL
function quoteSignBox(q) {
  const tab = 'flex:1;padding:8px;border:0;font-size:15px;cursor:pointer;background:transparent;color:#374151';
  return `<div style="background:#f0fdf4;padding:16px;border-radius:8px;margin-top:16px;border:1px solid #86efac">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap">
<h3 style="margin-top:0">Next step: Review and sign</h3>
<p>To proceed with this quote, please review the terms and sign below.</p>
<form method="post" action="/p/quote/${esc(q.token)}/sign" id="sigForm">
<div role="tablist" style="display:flex;gap:4px;padding:4px;background:#e5e7eb;border-radius:8px;margin-bottom:8px"><button type="button" role="tab" data-mode="drawn" style="${tab}">Draw</button><button type="button" role="tab" data-mode="typed" style="${tab}">Type</button></div>
<div style="position:relative;height:200px;background:#fff;border:1px solid #d1d5db;border-radius:8px;margin-bottom:6px;overflow:hidden"><canvas aria-label="Signature pad" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair"></canvas>
<span style="position:absolute;left:20px;right:20px;bottom:46px;border-bottom:1.5px solid #cbd5e1;pointer-events:none"></span><span id="sigHint" style="position:absolute;left:20px;bottom:52px;color:#94a3b8;font-size:14px;pointer-events:none">Sign here with your finger or mouse</span></div>
<div style="text-align:right;margin-bottom:8px;min-height:20px"><button type="button" id="sigClear" style="background:none;border:0;color:#2563eb;cursor:pointer;font-size:14px">Clear</button></div>
<input type="hidden" name="dataUrl"><input type="hidden" name="sigMode" value="drawn"><label class="muted" for="sigName">Full name</label><input type="text" id="sigName" name="fullName" placeholder="Full name" required maxlength="100" autocomplete="name" value="${esc(findClient(q.clientId)?.name || '')}">
<p id="sigErr" style="color:#dc2626;margin:0 0 8px;display:none"></p>
<button class="btn">Sign agreement</button>
</form></div>
<script>(function(){var f=document.getElementById('sigForm'),cv=f.querySelector('canvas'),x=cv.getContext('2d'),hint=document.getElementById('sigHint'),err=document.getElementById('sigErr'),clr=document.getElementById('sigClear'),nm=f.fullName,tabs=f.querySelectorAll('[data-mode]'),mode='drawn',inked=false,last=null,dpr=Math.max(1,Math.min(3,window.devicePixelRatio||1)),W,H;
var r0=cv.getBoundingClientRect();W=r0.width;H=r0.height;cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);x.setTransform(dpr,0,0,dpr,0,0);x.lineWidth=2.4;x.lineCap='round';x.lineJoin='round';x.strokeStyle=x.fillStyle='#111827';
function wipe(){x.clearRect(0,0,W,H);inked=false;}
function typed(){wipe();var t=nm.value.trim();hint.style.display=t?'none':'';if(!t)return;var s=64;do{x.font='600 '+s+'px "Dancing Script",cursive';s-=2;}while(s>20&&x.measureText(t).width>W-40);x.textBaseline='alphabetic';x.fillText(t,20,H-56);inked=true;}
function setMode(m){mode=m;f.sigMode.value=m;err.style.display='none';tabs.forEach(function(b){var on=b.getAttribute('data-mode')===m;b.setAttribute('aria-selected',on);b.style.background=on?'#fff':'transparent';b.style.fontWeight=on?'600':'400';b.style.boxShadow=on?'0 1px 2px rgba(0,0,0,.1)':'none';});
cv.style.cursor=m==='drawn'?'crosshair':'default';clr.style.visibility=m==='drawn'?'visible':'hidden';hint.textContent=m==='drawn'?'Sign here with your finger or mouse':'Type your name below';
if(m==='typed'){typed();if(document.fonts)document.fonts.load('600 48px "Dancing Script"').then(function(){if(mode==='typed')typed();});}else{wipe();hint.style.display='';}}
tabs.forEach(function(b){b.addEventListener('click',function(){setMode(b.getAttribute('data-mode'));});});
nm.addEventListener('input',function(){if(mode==='typed')typed();});
function at(e){var r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
cv.addEventListener('pointerdown',function(e){if(mode!=='drawn')return;e.preventDefault();cv.setPointerCapture(e.pointerId);last=at(e);x.beginPath();x.arc(last.x,last.y,1.2,0,Math.PI*2);x.fill();inked=true;hint.style.display='none';err.style.display='none';});
cv.addEventListener('pointermove',function(e){if(!last)return;e.preventDefault();(e.getCoalescedEvents?e.getCoalescedEvents():[e]).forEach(function(ev){var p=at(ev);x.beginPath();x.moveTo(last.x,last.y);x.lineTo(p.x,p.y);x.stroke();last=p;});});
cv.addEventListener('pointerup',function(){last=null;});cv.addEventListener('pointercancel',function(){last=null;});
clr.addEventListener('click',function(){wipe();hint.style.display='';});
f.addEventListener('submit',function(e){if(mode==='typed')typed();if(!inked){e.preventDefault();err.textContent=mode==='typed'?'Please type your full name.':'Please sign in the box first, or choose Type.';err.style.display='';return;}f.dataUrl.value=cv.toDataURL('image/png');});
setMode('drawn');})();</script>`;
}
// email the business when a client approves, declines or signs a quote, and log it with the other notifications
function tellBusinessQuote(q, status) {
  const c = findClient(q.clientId);
  const picked = hasOptions(q) && q.chosenOption ? `, choosing ${shownOption(q).name}` : ''; // Good / Better / Best: which option
  if (status === 'approved') pushTo(usersWhoCan('quotes'), 'quoteApproved', { title: 'Client approved quote', body: `${c ? c.name : 'A client'} approved quote ${q.number}${q.title ? ` (${q.title})` : ''}${picked}`, url: `/quotes/edit?id=${q.id}` });
  if (!db.company.email) return;
  const what = `quote ${q.number}${q.title ? ` (${q.title})` : ''}${status === 'approved' ? picked : ''}`;
  const next = status === 'declined' ? 'You can follow up with them, or edit the quote and send it again.'
    : status === 'approved' ? `They’ll sign it next${q.depositFee > 0 ? `, then pay the ${money(q.depositFee)} deposit` : ''}.`
      : q.depositFee > 0 ? `Next they pay the ${money(q.depositFee)} deposit.` : 'It’s ready to schedule as a job.';
  sendTemplate('quoteStatus', db.company.email, { client: c ? c.name : 'A client', status, what, total: money(q.total), next, business: db.company.name, account_url: baseUrl() }).then((sent) => {
    db.notifications.unshift({ id: uid(), at: new Date().toISOString(), clientId: q.clientId, clientName: c ? c.name : '', channel: 'email', kind: 'quote-status', refId: q.id, refNumber: q.number, to: db.company.email, subject: sent.subject, body: sent.text, status: sent.status, detail: sent.detail }); save();
  }).catch(() => {});
}
app.use('/p', express.urlencoded({ extended: false }));

// ---------- client reviews ----------
// When a job is completed or an invoice is paid, the client is emailed a private link (/p/review/<token>) to rate the work. Reviews show on the Reviews page.
// One ask per piece of work (a job and its invoices count as one), and at most one in REVIEW_ASK_GAP_DAYS per client, so regular clients aren't asked after every visit.
// Email only: clients agreed to texts about their quotes, invoices and appointments, not requests like this.
const REVIEW_ASK_GAP_DAYS = 30;
const reviewSettings = () => ({ afterJob: true, afterInvoice: true, notifyEmail: true, ...(db.reviewSettings || {}) });
const clientReviews = () => (db.clientReviews = db.clientReviews || []);
const reviewRefs = (kind, doc) => { const job = kind === 'job' ? doc : doc.jobId && db.jobs.find((j) => j.id === doc.jobId); return job ? [job.id, ...db.invoices.filter((i) => i.jobId === job.id || (i.jobIds || []).includes(job.id)).map((i) => i.id)] : [doc.id]; };
function reviewRecord(kind, doc) {
  const refs = reviewRefs(kind, doc); let r = clientReviews().find((x) => refs.includes(x.refId));
  if (!r) { r = { id: uid(), token: token(), clientId: doc.clientId, kind, refId: doc.id, refNumber: doc.number, title: (kind === 'job' ? doc.title : doc.subject) || '', createdAt: new Date().toISOString() }; clientReviews().push(r); save(); }
  return r;
}
const reviewLink = (r) => baseUrl() + '/p/review/' + r.token;
function askForReview(kind, doc) {
  if (!tenancy.has('reviews') || !reviewSettings()[kind === 'job' ? 'afterJob' : 'afterInvoice']) return;
  const c = findClient(doc.clientId); if (!c || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email || '')) return;
  const refs = reviewRefs(kind, doc); if (clientReviews().some((x) => refs.includes(x.refId) && (x.emailedAt || x.submittedAt))) return;
  const since = new Date(Date.now() - REVIEW_ASK_GAP_DAYS * 864e5).toISOString();
  if (clientReviews().some((x) => x.clientId === c.id && ((x.emailedAt || '') > since || (x.submittedAt || '') > since))) return;
  const r = reviewRecord(kind, doc); r.emailedAt = new Date().toISOString(); save();
  const m = renderEmail('reviewRequest', { client_name: c.name, company_name: db.company.name, work: r.title || 'your recent work', link: reviewLink(r) });
  notify({ clientId: c.id, channel: 'email', kind: 'review', refId: doc.id, refNumber: doc.number, subject: m.subject, body: m.text, html: m.html })
    .then((n) => { if (n.status === 'failed') delete r.emailedAt; save(); }).catch(() => {}); // a failed email can be asked again next time
}
// the paid invoice page's button, so clients without an email address (and those who come back to pay) can leave one too
// the business previewing a client's quote or invoice page sees the client's buttons greyed out (they'd act for the client otherwise);
// the quote editor's Collect Signature opens the quote page with ?collect=1 so the client can approve and sign on the business's device
const PREVIEW_NOTE = 'You’re previewing as the business, so these buttons are turned off. Your client can use them.';
const previewOff = (html, style = '') => (html.trim() ? `<fieldset disabled class="preview-off" onclick="event.preventDefault()" style="border:0;margin:0;padding:0;min-width:0;${style}">${html}</fieldset>` : '');
function reviewPrompt(inv, preview) {
  if (!tenancy.has('reviews') || !reviewSettings().afterInvoice) return '';
  const refs = reviewRefs('invoice', inv); if (clientReviews().some((x) => refs.includes(x.refId) && x.submittedAt)) return '';
  if (preview) return '<p><span class="btn" style="display:inline-block;opacity:.5;cursor:not-allowed" title="Only your client can leave a review">Leave a review</span></p>';
  return `<p><a class="btn" style="display:inline-block;text-decoration:none" href="/p/review/${esc(reviewRecord('invoice', inv).token)}">Leave a review</a></p>`;
}
function tellBusinessReview(r, edited) {
  const c = findClient(r.clientId); const name = c ? c.name : 'A client';
  pushTo(usersWhoCan('reviews'), 'review', { title: edited ? `Review updated: ${r.stars} stars` : `New ${r.stars}-star review`, body: r.comment ? `${name}: ${r.comment.slice(0, 120)}` : name, url: '/reviews' });
  if (!reviewSettings().notifyEmail || !db.company.email) return;
  sendTemplate(edited ? 'reviewUpdated' : 'reviewReceived', db.company.email, { client: name, rating: `${r.stars} out of 5 stars`, work: r.title || r.refNumber || 'their recent work', comment: [...(r.answers || []).map((a) => `${a.question} ${answerText(a)}`), r.comment].filter(Boolean).join('\n'), business: db.company.name, link: `${baseUrl()}/reviews` }).then((sent) => {
    db.notifications.unshift({ id: uid(), at: new Date().toISOString(), clientId: r.clientId, clientName: name, channel: 'email', kind: 'review', refId: r.refId, refNumber: r.refNumber, to: db.company.email, subject: sent.subject, body: sent.text, status: sent.status, detail: sent.detail }); save();
  }).catch(() => {});
}
const REVIEW_STYLE = '<style>.rv-stars{display:inline-flex;flex-direction:row-reverse;gap:4px;margin:4px 0 14px}.rv-stars input{position:absolute;opacity:0;width:1px;height:1px;margin:0;padding:0}.rv-stars label{font-size:42px;line-height:1;color:#d1d5db;cursor:pointer}.rv-stars input:checked~label,.rv-stars label:hover,.rv-stars label:hover~label{color:#f59e0b}.rv-stars input:focus-visible+label{outline:2px solid #2563eb;border-radius:4px}textarea{padding:10px;border:1px solid #d1d5db;border-radius:8px;width:100%;box-sizing:border-box;margin:4px 0 14px;font:inherit}.rv-shown{color:#f59e0b;font-size:28px;letter-spacing:2px}.rv-shown i{font-style:normal;color:#d1d5db}.rv-media{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.rv-media img,.rv-media video{height:120px;max-width:100%;border-radius:8px;display:block;background:#000}.rv-add{display:block;width:100%;box-sizing:border-box;padding:12px;margin:0 0 14px;border:1px solid #d1d5db;border-radius:99px;background:#f3f4f6;color:#111827;font:inherit;font-weight:600;text-align:center;cursor:pointer}.rv-tiles{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}.rv-tile{position:relative;width:72px;height:72px;border-radius:8px;background:#111827;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;overflow:hidden}.rv-tile img{width:100%;height:100%;object-fit:cover}.rv-tile button{position:absolute;top:2px;right:2px;width:22px;height:22px;border:0;border-radius:50%;background:rgba(0,0,0,.7);color:#fff;cursor:pointer;line-height:1;padding:0}</style>';
const reviewPage = (inner) => shell('Leave a review', REVIEW_STYLE + inner);
// the business's own questions (Reviews → Your questions): each is asked on the modules it picks. A review keeps the wording it was answered with, so later edits don't change it.
const REVIEW_MODULES = ['job', 'invoice']; const REVIEW_Q_TYPES = ['stars', 'yesno', 'text'];
const reviewQuestionsFor = (kind) => (db.reviewQuestions || []).filter((q) => q.modules.includes(kind));
function reviewQuestionField(q, value) {
  const name = 'q_' + q.id; const need = q.required ? ' required' : ''; const legend = `<div style="font-weight:600;margin-bottom:4px">${esc(q.text)}${q.required ? '' : ' <span class="muted" style="font-weight:400">(optional)</span>'}</div>`;
  if (q.type === 'stars') return `<div>${legend}<div class="rv-stars" role="radiogroup" aria-label="${esc(q.text)}">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="${name}_${n}" name="${name}" value="${n}"${need}${Number(value) === n ? ' checked' : ''}><label for="${name}_${n}" title="${n} out of 5" aria-label="${n} out of 5 stars">★</label>`).join('')}</div></div>`;
  if (q.type === 'yesno') return `<div style="margin-bottom:14px">${legend}${['Yes', 'No'].map((v) => `<label style="margin-right:18px"><input type="radio" name="${name}" value="${v}" style="width:auto;margin:0 6px 0 0"${need}${value === v ? ' checked' : ''}>${v}</label>`).join('')}</div>`;
  return `<div>${legend}<textarea name="${name}" rows="3" maxlength="1000"${need}>${esc(value)}</textarea></div>`;
}
function readReviewAnswers(kind, body) {
  const answers = [];
  for (const q of reviewQuestionsFor(kind)) {
    const raw = String(body['q_' + q.id] || '').trim();
    const ok = q.type === 'stars' ? ['1', '2', '3', '4', '5'].includes(raw) : q.type === 'yesno' ? ['Yes', 'No'].includes(raw) : !!raw;
    if (!ok) { if (q.required) return { error: `Please answer: ${q.text}` }; continue; }
    answers.push({ questionId: q.id, question: q.text, type: q.type, answer: q.type === 'stars' ? Number(raw) : raw.slice(0, 1000) });
  }
  return { answers };
}
const answerText = (a) => (a.type === 'stars' ? `${a.answer} out of 5` : a.answer);
// adds the photo and video picker (without JavaScript the form still sends the review): the review saves first, then each file goes up
const reviewFormScript = (r) => `<script>(function(){var T=${JSON.stringify(r.token)},have=${JSON.stringify(reviewMediaForClient(r)).replace(/</g, '\\u003c')},gone=[],added=[],f=document.querySelector('form'),box=document.getElementById('rvTiles'),inp=document.getElementById('rvFiles'),btn=f.querySelector('.btn'),base='/p/review/'+T+'/media';document.getElementById('rvAdd').hidden=false;
function tile(src,video,rm){var d=document.createElement('div');d.className='rv-tile';if(video)d.textContent='Video';else{var i=document.createElement('img');i.src=src;i.alt='';d.appendChild(i)}var b=document.createElement('button');b.type='button';b.textContent='×';b.setAttribute('aria-label','Remove');b.onclick=rm;d.appendChild(b);box.appendChild(d)}
function draw(){box.textContent='';have.forEach(function(m){tile(m.url,m.type==='video',function(){gone.push(m.id);have=have.filter(function(x){return x!==m});draw()})});added.forEach(function(x){var v=/^video/.test(x.type);tile(v?'':URL.createObjectURL(x),v,function(){added=added.filter(function(y){return y!==x});draw()})})}
inp.onchange=function(){[].forEach.call(inp.files,function(x){var v=/^video/.test(x.type);if(have.length+added.length>=${REVIEW_MEDIA_COUNT})return alert('Up to ${REVIEW_MEDIA_COUNT} photos and videos on a review');if(x.size>(v?${REVIEW_VIDEO_MAX}:${REVIEW_PHOTO_MAX}))return alert(x.name+' is too large. Photos can be up to 15 MB and videos up to 100 MB.');added.push(x)});inp.value='';draw()};
f.onsubmit=async function(e){e.preventDefault();btn.disabled=true;btn.textContent='Sending…';try{var r=await fetch(f.action,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(f))});if(!r.ok){document.open();document.write(await r.text());document.close();return}var bad=0;for(var i=0;i<gone.length;i++)await fetch(base+'/'+gone[i],{method:'DELETE'});for(var n=0;n<added.length;n++){btn.textContent='Uploading '+(n+1)+' of '+added.length+'…';try{var u=await fetch(base,{method:'POST',headers:{'Content-Type':added[n].type||'application/octet-stream'},body:added[n]});if(!u.ok)bad++}catch(x){bad++}}if(bad)alert('Your review was saved, but '+bad+' file'+(bad===1?'':'s')+' didn’t upload. Choose Edit your review to try again.');location.href='/p/review/'+T}catch(x){btn.disabled=false;btn.textContent='Try again';alert('That didn’t send. Please check your connection and try again.')}};draw()})();</script>`;
function reviewForm(r, error) {
  const c = findClient(r.clientId);
  const answerOf = (q) => ((r.answers || []).find((a) => a.questionId === q.id) || {}).answer;
  return reviewPage(`<h1>${r.submittedAt ? 'Edit your review' : 'How did we do?'}</h1><p class="muted">${c ? `${esc(c.name)}, tell` : 'Tell'} ${esc(db.company.name)} about ${esc(r.title || 'your recent work')}. Your review goes to the business and isn’t posted publicly.</p>
${error ? `<p style="color:#b91c1c">${esc(error)}</p>` : ''}<form method="post" action="/p/review/${esc(r.token)}"><div style="font-weight:600;margin-bottom:4px">Your overall rating</div><div class="rv-stars" role="radiogroup" aria-label="Your rating">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="st${n}" name="stars" value="${n}" required${r.stars === n ? ' checked' : ''}><label for="st${n}" title="${n} out of 5" aria-label="${n} out of 5 stars">★</label>`).join('')}</div>
${reviewQuestionsFor(r.kind).map((q) => reviewQuestionField(q, answerOf(q))).join('')}<textarea id="comment" name="comment" rows="5" maxlength="2000" aria-label="Your review" placeholder="Share details of your own experience with ${esc(db.company.name)}">${esc(r.comment)}</textarea><div class="rv-tiles" id="rvTiles"></div><label class="rv-add" id="rvAdd" hidden>Add photos &amp; videos<input type="file" id="rvFiles" multiple accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm" style="display:none"></label><button class="btn">${r.submittedAt ? 'Save changes' : 'Send review'}</button></form>${reviewFormScript(r)}`);
}
// a review is the client's: only they can write or change it, from the emailed link or the client portal. Someone logged in to the business (including "Log in as Client") can only look
const REVIEW_STAFF_ONLY_VIEW = 'You’re logged in to the business account, so you can view reviews but not write or change them.';
// photos and videos on a review: sent one at a time after the review is saved, as the file itself rather than JSON because videos are large.
// The kind of file is read from its first bytes, never from what the browser says, and only these are kept, so an upload can't be a web page.
const REVIEW_MEDIA_COUNT = 10; const REVIEW_PHOTO_MAX = 15e6; const REVIEW_VIDEO_MAX = 100e6; const REVIEW_MEDIA_GRACE = 15 * 60e3;
function sniffReviewMedia(b) {
  const at = (i, s) => b.toString('latin1', i, i + s.length) === s;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'photo' };
  if (at(0, '\x89PNG')) return { ext: 'png', type: 'photo' };
  if (at(0, 'GIF8')) return { ext: 'gif', type: 'photo' };
  if (at(0, 'RIFF') && at(8, 'WEBP')) return { ext: 'webp', type: 'photo' };
  if (at(0, '\x1a\x45\xdf\xa3')) return { ext: 'webm', type: 'video' };
  if (at(4, 'ftypqt')) return { ext: 'mov', type: 'video' };
  if (at(4, 'ftyp') && !/^(heic|heix|hevc|mif1|msf1|avif)/.test(b.toString('latin1', 8, 12))) return { ext: 'mp4', type: 'video' };
  return null;
}
const reviewMediaForClient = (r) => (r.media || []).map(({ id, url, type }) => ({ id, url, type }));
// a photo added just after sending is part of the review; later it counts as an edit
const reviewMediaChanged = (r) => { if (Date.now() - Date.parse(r.submittedAt) > REVIEW_MEDIA_GRACE) r.editedAt = new Date().toISOString(); };
async function addReviewMedia(r, req, res) {
  const fail = (status, error) => { res.setHeader('Connection', 'close'); return res.status(status).json({ error }); };
  if (!r.submittedAt) return fail(400, 'Send the review first');
  if ((r.media || []).length >= REVIEW_MEDIA_COUNT) return fail(400, `Up to ${REVIEW_MEDIA_COUNT} photos and videos on a review`);
  if (/json|urlencoded/i.test(req.headers['content-type'] || '')) return fail(400, 'Choose a photo or video');
  if (Number(req.headers['content-length']) > REVIEW_VIDEO_MAX) return fail(413, 'Videos can be up to 100 MB');
  const dir = uploadDir(); fs.mkdirSync(dir, { recursive: true }); const tmp = path.join(dir, `tmp-${token()}.part`); let size = 0; let head = Buffer.alloc(0);
  try {
    await require('stream/promises').pipeline(req, async function* (src) {
      for await (const chunk of src) { size += chunk.length; if (size > REVIEW_VIDEO_MAX) throw Object.assign(new Error('Videos can be up to 100 MB'), { status: 413 }); if (head.length < 16) head = Buffer.concat([head, chunk]).subarray(0, 16); yield chunk; }
    }, fs.createWriteStream(tmp));
    const kind = sniffReviewMedia(head); if (!kind) throw Object.assign(new Error('Choose a JPEG, PNG, GIF or WebP photo, or an MP4, MOV or WebM video'), { status: 400 });
    if (kind.type === 'photo' && size > REVIEW_PHOTO_MAX) throw Object.assign(new Error('Photos can be up to 15 MB'), { status: 413 });
    if ((r.media || []).length >= REVIEW_MEDIA_COUNT) throw Object.assign(new Error(`Up to ${REVIEW_MEDIA_COUNT} photos and videos on a review`), { status: 400 });
    const file = `review-${token()}.${kind.ext}`; fs.renameSync(tmp, path.join(dir, file));
    r.media = [...(r.media || []), { id: uid(), url: '/uploads/' + file, type: kind.type, size, at: new Date().toISOString() }]; reviewMediaChanged(r); save();
    res.status(201).json(reviewForClient(r));
  } catch (e) { fs.rm(tmp, { force: true }, () => {}); if (!res.headersSent) fail(e.status || 400, e.status ? e.message : 'That file didn’t finish uploading. Please try again.'); }
}
function removeReviewMedia(r, mid, res) {
  const m = (r.media || []).find((x) => x.id === mid); if (!m) return res.status(404).json({ error: 'Not found' });
  r.media = r.media.filter((x) => x !== m); fs.rm(path.join(uploadDir(), path.basename(m.url)), { force: true }, () => {}); reviewMediaChanged(r); save(); res.json(reviewForClient(r));
}
const reviewMediaHtml = (r) => (r.media || []).length ? `<div class="rv-media">${r.media.map((m) => (m.type === 'video' ? `<video src="${esc(m.url)}" controls preload="metadata" playsinline></video>` : `<a href="${esc(m.url)}" target="_blank" rel="noopener"><img src="${esc(m.url)}" alt="Photo from the review"></a>`)).join('')}</div>` : '';
// one review, new or edited: answers an error message, or nothing once it's saved. Answers to questions the business has since removed stay as they were
function submitReview(r, body) {
  const stars = Number(body.stars); if (![1, 2, 3, 4, 5].includes(stars)) return 'Choose a star rating first.';
  const read = readReviewAnswers(r.kind, body); if (read.error) return read.error;
  const current = reviewQuestionsFor(r.kind).map((q) => q.id); const answers = [...read.answers, ...(r.answers || []).filter((a) => !current.includes(a.questionId))];
  const comment = String(body.comment || '').trim().slice(0, 2000); const now = new Date().toISOString();
  if (!r.submittedAt) { Object.assign(r, { stars, answers, comment, submittedAt: now }); save(); tellBusinessReview(r); return ''; }
  const sameAnswers = (x) => JSON.stringify([...x].map((a) => [a.questionId, a.answer]).sort());
  if (r.stars === stars && r.comment === comment && sameAnswers(r.answers || []) === sameAnswers(answers)) return ''; // nothing changed
  Object.assign(r, { stars, answers, comment, editedAt: now }); save(); tellBusinessReview(r, true); return '';
}
const reviewForClient = (r) => ({ id: r.id, kind: r.kind, refNumber: r.refNumber, title: r.title, stars: r.stars, comment: r.comment, submittedAt: r.submittedAt, editedAt: r.editedAt || '', reply: r.reply ? { comment: r.reply.comment, updatedAt: r.reply.updatedAt } : null, media: reviewMediaForClient(r), answers: (r.answers || []).map((a) => ({ questionId: a.questionId, question: a.question, type: a.type, answer: a.answer })) });
// the client portal: this client's completed jobs and paid invoices with no review yet. A job and its invoices are one piece of work, listed once, as the job
function reviewableFor(c) {
  const seen = new Set(); const out = [];
  const add = (kind, doc, date) => {
    const refs = reviewRefs(kind, doc); if (refs.some((x) => seen.has(x))) return; refs.forEach((x) => seen.add(x));
    const r = clientReviews().find((x) => refs.includes(x.refId)); if (r && r.submittedAt) return;
    out.push({ kind: r ? r.kind : kind, id: r ? r.refId : doc.id, number: r ? r.refNumber : doc.number, title: (r ? r.title : kind === 'job' ? doc.title : doc.subject) || '', date: String(date || '').slice(0, 10), refs });
  };
  for (const j of db.jobs) if (j.clientId === c.id && j.status === 'completed') add('job', j, j.date);
  for (const i of db.invoices) if (i.clientId === c.id && i.status === 'paid') add('invoice', i, i.paidAt);
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
app.post('/api/portal/:token/reviews', (req, res) => {
  const c = db.clients.find((x) => x.portalToken === req.params.token); if (!c) return res.status(404).json({ error: 'Invalid portal link' });
  if (!tenancy.has('reviews')) return res.status(403).json({ error: 'Reviews aren’t available' });
  if (currentUser(req)) return res.status(403).json({ error: REVIEW_STAFF_ONLY_VIEW });
  const b = req.body || {}; const item = reviewableFor(c).find((x) => x.kind === b.kind && x.id === b.id); // only their own finished work, not yet reviewed
  if (!item) return res.status(400).json({ error: 'This has already been reviewed' });
  const doc = (item.kind === 'job' ? db.jobs : db.invoices).find((x) => x.id === item.id); if (!doc) return res.status(404).json({ error: 'Not found' });
  const r = reviewRecord(item.kind, doc); const error = submitReview(r, b); if (error) return res.status(400).json({ error });
  res.status(201).json(reviewForClient(r));
});
app.put('/api/portal/:token/reviews/:id', (req, res) => {
  const c = db.clients.find((x) => x.portalToken === req.params.token); if (!c) return res.status(404).json({ error: 'Invalid portal link' });
  if (!tenancy.has('reviews')) return res.status(403).json({ error: 'Reviews aren’t available' });
  if (currentUser(req)) return res.status(403).json({ error: REVIEW_STAFF_ONLY_VIEW });
  const r = clientReviews().find((x) => x.id === req.params.id && x.clientId === c.id && x.submittedAt); if (!r) return res.status(404).json({ error: 'Review not found' });
  const error = submitReview(r, req.body || {}); if (error) return res.status(400).json({ error });
  res.json(reviewForClient(r));
});
const portalReview = (req, res) => {
  const c = db.clients.find((x) => x.portalToken === req.params.token); if (!c) { res.status(404).json({ error: 'Invalid portal link' }); return null; }
  if (!tenancy.has('reviews')) { res.status(403).json({ error: 'Reviews aren’t available' }); return null; }
  if (currentUser(req)) { res.status(403).json({ error: REVIEW_STAFF_ONLY_VIEW }); return null; }
  const r = clientReviews().find((x) => x.id === req.params.id && x.clientId === c.id && x.submittedAt); if (!r) res.status(404).json({ error: 'Review not found' });
  return r || null;
};
app.post('/api/portal/:token/reviews/:id/media', async (req, res) => { const r = portalReview(req, res); if (r) await addReviewMedia(r, req, res); });
app.delete('/api/portal/:token/reviews/:id/media/:mid', (req, res) => { const r = portalReview(req, res); if (r) removeReviewMedia(r, req.params.mid, res); });
// the same from the emailed link
const linkReview = (req, res) => {
  const r = clientReviews().find((x) => x.token === req.params.token); if (!r) { res.status(404).json({ error: 'Review link not found' }); return null; }
  if (!tenancy.has('reviews')) { res.status(403).json({ error: 'Reviews aren’t available' }); return null; }
  if (currentUser(req)) { res.status(403).json({ error: REVIEW_STAFF_ONLY_VIEW }); return null; }
  return r;
};
app.post('/p/review/:token/media', async (req, res) => { const r = linkReview(req, res); if (r) await addReviewMedia(r, req, res); });
app.delete('/p/review/:token/media/:mid', (req, res) => { const r = linkReview(req, res); if (r) removeReviewMedia(r, req.params.mid, res); });
app.get('/p/review/:token', (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex');
  const r = clientReviews().find((x) => x.token === req.params.token);
  if (!r) return res.status(404).send(shell('Not found', '<h1>Review link not found</h1>'));
  if (r.submittedAt && req.query.edit && tenancy.has('reviews')) return res.send(reviewForm(r));
  if (!r.submittedAt) return res.send(tenancy.has('reviews') ? reviewForm(r) : shell('Reviews', `<h1>Reviews are closed</h1><p class="muted">${esc(db.company.name)} isn’t taking reviews here right now.</p>`));
  const g = connOf('google'); const google = g && g.reviews !== false && /^https:\/\//.test(g.reviewUrl || '') ? g.reviewUrl : ''; // offered whatever the rating: asking only happy clients is against Google's review rules
  res.send(reviewPage(`<h1>Thank you!</h1><div class="rv-shown" aria-label="${r.stars} out of 5 stars">${'★'.repeat(r.stars)}<i>${'★'.repeat(5 - r.stars)}</i></div>${(r.answers || []).map((a) => `<p style="margin:8px 0"><strong>${esc(a.question)}</strong><br>${esc(answerText(a))}</p>`).join('')}${r.comment ? `<p style="white-space:pre-wrap">${esc(r.comment)}</p>` : ''}${reviewMediaHtml(r)}${r.reply ? `<div style="margin:12px 0;padding:12px 14px;border-left:3px solid ${esc(db.company.brandColor)};background:#f9fafb"><strong>Reply from ${esc(db.company.name)}</strong><p style="margin:6px 0 0;white-space:pre-wrap">${esc(r.reply.comment)}</p></div>` : ''}<p class="muted">Your review was sent to ${esc(db.company.name)}.${tenancy.has('reviews') && !currentUser(req) ? ` <a href="/p/review/${esc(r.token)}?edit=1">Edit your review</a>` : ''}</p>${google ? `<p><a class="btn alt" style="display:inline-block;text-decoration:none" href="${esc(google)}" target="_blank" rel="noopener noreferrer">Share it on Google too</a></p>` : ''}`));
});
app.post('/p/review/:token', (req, res) => {
  const r = clientReviews().find((x) => x.token === req.params.token);
  if (!r) return res.status(404).send(shell('Not found', '<h1>Review link not found</h1>'));
  if (!tenancy.has('reviews')) return res.redirect(`/p/review/${r.token}`);
  if (currentUser(req)) return res.status(403).send(reviewForm(r, REVIEW_STAFF_ONLY_VIEW));
  const error = submitReview(r, req.body); if (error) return res.status(400).send(reviewForm(r, error));
  res.redirect(303, `/p/review/${r.token}`);
});
// the Reviews page: what clients sent (never the private link) and the automatic-ask switches
app.get('/api/reviews/client', (req, res) => {
  const done = clientReviews().filter((r) => r.submittedAt).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  res.json({ questions: db.reviewQuestions || [], settings: reviewSettings(), gapDays: REVIEW_ASK_GAP_DAYS, waiting: clientReviews().filter((r) => r.emailedAt && !r.submittedAt).length, total: done.length, average: done.length ? done.reduce((s, r) => s + r.stars, 0) / done.length : 0,
    reviews: done.map((r) => { const c = findClient(r.clientId); return { id: r.id, clientId: c ? r.clientId : '', clientName: c ? c.name : 'Former client', kind: r.kind, refId: r.refId, refNumber: r.refNumber, title: r.title, stars: r.stars, answers: r.answers || [], comment: r.comment, submittedAt: r.submittedAt, editedAt: r.editedAt || '', reply: r.reply || null, media: reviewMediaForClient(r) }; }) });
});
// the business's side of a client review: it can't change the review, only reply. The client sees the reply, and is emailed the first time
const clientReviewById = (id) => clientReviews().find((x) => x.id === id && x.submittedAt);
app.put('/api/reviews/client/:id/reply', async (req, res) => {
  const r = clientReviewById(req.params.id); if (!r) return res.status(404).json({ error: 'Review not found' });
  const comment = String((req.body && req.body.comment) || '').trim(); if (!comment) return res.status(400).json({ error: 'Write a reply first' });
  if (comment.length > 2000) return res.status(400).json({ error: 'Keep the reply under 2,000 characters' });
  const first = !r.reply; const u = currentUser(req); r.reply = { comment, by: u ? u.name : '', updatedAt: new Date().toISOString() }; save();
  const c = findClient(r.clientId);
  if (first && c && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email || '')) {
    const m = renderEmail('reviewReply', { client_name: c.name, company_name: db.company.name, work: r.title || 'your recent work', reply: comment, link: reviewLink(r) });
    notify({ clientId: c.id, channel: 'email', kind: 'review', refId: r.refId, refNumber: r.refNumber, subject: m.subject, body: m.text, html: m.html }).then(() => save()).catch(() => {});
  }
  res.json(r.reply);
});
app.delete('/api/reviews/client/:id/reply', (req, res) => {
  const r = clientReviewById(req.params.id); if (!r) return res.status(404).json({ error: 'Review not found' });
  delete r.reply; save(); res.json({ ok: true });
});
app.put('/api/reviews/questions', (req, res) => {
  const list = req.body && req.body.questions; if (!Array.isArray(list)) return res.status(400).json({ error: 'Nothing to save' });
  if (list.length > 20) return res.status(400).json({ error: 'Up to 20 questions' });
  const out = [];
  for (const q of list) {
    const text = String((q && q.text) || '').trim().slice(0, 200); if (!text) return res.status(400).json({ error: 'Write every question, or remove the empty one' });
    const modules = REVIEW_MODULES.filter((m) => Array.isArray(q.modules) && q.modules.includes(m)); if (!modules.length) return res.status(400).json({ error: `Choose Jobs or Invoices for “${text}”` });
    out.push({ id: /^[a-z0-9]{4,40}$/i.test(q.id || '') ? q.id : uid(), text, type: REVIEW_Q_TYPES.includes(q.type) ? q.type : 'text', modules, required: !!q.required });
  }
  db.reviewQuestions = out; save(); res.json(out);
});
app.put('/api/reviews/settings', (req, res) => {
  const s = reviewSettings(); for (const k of Object.keys(s)) if (req.body && k in req.body) s[k] = !!req.body[k];
  db.reviewSettings = s; save(); res.json(s);
});
app.get('/p/quote/:token/pdf', (req, res) => {
  const q = db.quotes.find((x) => x.token === req.params.token); if (!q) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${pdfName('quote', q)}"`); res.end(docPdf('quote', q));
});
// Request Changes: the client says what they'd like changed and the business is emailed; the quote stays open to approve once it's updated
app.post('/p/quote/:token/changes', (req, res) => {
  const q = db.quotes.find((x) => x.token === req.params.token); if (!q) return res.status(404).send('Not found');
  const text = String((req.body && req.body.message) || '').trim().slice(0, 2000);
  if (!text || !['sent', 'draft'].includes(q.status)) return res.redirect(`/p/quote/${q.token}`);
  q.changeRequests = [...(q.changeRequests || []), { at: new Date().toISOString(), text }].slice(-20); q.changesRequestedAt = q.changeRequests[q.changeRequests.length - 1].at; save();
  const c = findClient(q.clientId); const who = c ? c.name : 'A client'; const what = `quote ${q.number}${q.title ? ` (${q.title})` : ''}`;
  if (db.company.email) {
    const subject = `${who} asked for changes to ${what}`; const body = `${who} asked for changes to ${what}:\n\n${text}\n\nUpdate the quote and send it again: ${baseUrl()}/quotes/edit?id=${q.id}`;
    sendEmail(db.company.email, subject, body).then((sent) => { db.notifications.unshift({ id: uid(), at: q.changesRequestedAt, clientId: q.clientId, clientName: c ? c.name : '', channel: 'email', kind: 'quote-status', refId: q.id, refNumber: q.number, to: db.company.email, subject, body, status: sent.status, detail: sent.detail }); save(); }).catch(() => {});
  }
  res.redirect(`/p/quote/${q.token}?changes=sent`);
});
app.post('/p/quote/:token/respond', (req, res) => {
  const q = db.quotes.find((x) => x.token === req.params.token);
  if (!q) return res.status(404).send('Not found');
  if (['sent', 'draft'].includes(q.status)) {
    const approve = req.body.r !== 'declined'; const pick = pickOption(q, req.body.opt); if (approve && pick === false) return res.redirect(`/p/quote/${q.token}`); // each option has its own Approve button
    q.status = approve ? 'approved' : 'declined'; q.respondedAt = iso(new Date()); if (approve && pick) { q.chosenOption = pick; computeTotals(q); } save(); tellBusinessQuote(q, q.status);
  }
  res.redirect(`/p/quote/${q.token}`);
});
app.post('/p/quote/:token/sign', (req, res) => {
  const q = db.quotes.find((x) => x.token === req.params.token);
  if (!q || q.status !== 'approved') return res.status(400).send('Quote not available for signing');
  if (q.signedAt) return res.redirect(`/p/quote/${q.token}`); // already signed (a double submit)
  const back = (msg) => res.status(400).send(shell('Signature needed', `<h1>Signature needed</h1><p>${esc(msg)}</p><p><a href="/p/quote/${esc(q.token)}">Back to the quote</a></p>`));
  const name = String(req.body.fullName || '').trim().slice(0, 100); if (!name) return back('Please type your full name.');
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(req.body.dataUrl || '');
  if (!m || m[1].length < 200) return back('Please sign in the box first.');
  if (m[1].length > 2e6) return back('That signature image is too large.');
  const file = `sig-${token()}.png`; // unguessable name: uploads are served without login
  fs.writeFileSync(path.join(uploadDir(), file), Buffer.from(m[1], 'base64'));
  removeSignatureFile(q);
  q.signedAt = iso(new Date()); q.signedName = name; q.signature = { file: `/uploads/${file}`, method: req.body.sigMode === 'typed' ? 'typed' : 'drawn' };
  if (q.depositFee > 0 && !q.depositStatus) q.depositStatus = 'pending';
  addSignedNote('quote', q); save(); tellBusinessQuote(q, 'signed');
  res.redirect(`/p/quote/${q.token}`);
});
const depositSent = (req, res) => {
  const q = db.quotes.find((x) => x.token === req.params.token);
  if (!q) return res.status(404).send('Not found');
  const via = req.params.via || 'zelle';
  if (q.depositFee > 0 && !q.depositPaidAt && !q.zelleSentAt && offlineMethods(q).some((m) => m.key === via)) { q.zelleSentAt = iso(new Date()); q.sentVia = via; save(); tellBusinessSent(via, `the deposit on quote ${q.number}`, q.depositFee, findClient(q.clientId)?.name); }
  res.redirect(`/p/quote/${q.token}`);
};
app.post('/p/quote/:token/sent/:via', depositSent); app.post('/p/quote/:token/zelle-sent', depositSent);
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
  if (!onlineMethods('quote', q).length) return res.status(400).send('Online payment is not available for this quote'); // only once card payments are set up
  if (q.depositPaidAt) return res.redirect(`/p/quote/${q.token}`);
  stripeCheckout({ amount: q.depositFee, name: `Deposit for Quote ${q.number}`, client: findClient(q.clientId), meta: { quoteId: q.id }, successUrl: `${baseUrl()}/p/quote/${q.token}/deposit-success`, cancelUrl: `${baseUrl()}/p/quote/${q.token}`, methods: onlineMethods('quote', q) })
      .then((s) => res.redirect(303, s.url))
      .catch((e) => res.status(502).send(shell('Payment error', `<h1>Payment error</h1><p>${esc(e.message)}</p><p><a href="/p/quote/${esc(q.token)}">Back to the quote</a></p>`)));
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
  if (q.depositPaidAt) return res.status(400).json({ error: 'The deposit is already paid. Edit the quote to change it.' });
  q.depositType = 'flat'; q.depositValue = Number(req.body.depositFee) || 0; computeTotals(q);
  if (!q.depositStatus) q.depositStatus = q.depositFee > 0 ? 'pending' : null;
  save();
  res.json(q);
});

// ---------- client portal data ----------
// strip what clients must not see: internal notes and the business's cost/markup per line
function forClient(doc) {
  const { internalNotes, noteEntries, ...rest } = doc;
  return { ...rest, items: (doc.items || []).map(({ cost, markup, markupType, matrix, ...it }) => it) };
}
// a client's visits: schedule details only (no internal notes, prices or line items)
const PORTAL_JOB_FIELDS = ['id', 'number', 'title', 'description', 'date', 'startTime', 'endTime', 'address', 'status'];
const jobForClient = (j) => ({ ...Object.fromEntries(PORTAL_JOB_FIELDS.map((k) => [k, j[k]])), forms: sharedForms(j) }); // forms: finished checklists the business shares
const REQ_FIELDS = ['id', 'title', 'details', 'address', 'propertyId', 'preferredDate', 'preferredTime', 'status', 'createdAt'];
const requestForClient = (r) => Object.fromEntries(REQ_FIELDS.map((k) => [k, r[k]]));
app.get('/api/portal/:token', (req, res) => {
  const c = db.clients.find((x) => x.portalToken === req.params.token);
  if (!c) return res.status(404).json({ error: 'Invalid portal link' });
  res.json({
    company: { name: db.company.name, logo: db.company.logo, email: db.company.email, phone: db.company.phone, accentColor: accentColor(), address: db.company.addressPrivate ? '' : db.company.address, website: db.company.website, hours: db.company.showHours ? db.company.hours || null : null },
    client: { id: c.id, name: c.name, email: c.email, phone: c.phone, address: c.address, smsConsent: !!c.smsConsent, smsBrand: smsBrand() },
    referralLink: tenancy.has('referrals') ? referralLink(c) : null,
    reviews: !tenancy.has('reviews') ? null : (db.clientReviews || []).filter((r) => r.clientId === c.id && r.submittedAt).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map(reviewForClient),
    reviewable: tenancy.has('reviews') ? reviewableFor(c) : [],
    reviewsViewOnly: !!currentUser(req),
    reviewQuestions: tenancy.has('reviews') ? Object.fromEntries(REVIEW_MODULES.map((m) => [m, reviewQuestionsFor(m).map(({ id, text, type, required }) => ({ id, text, type, required }))])) : {},
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
// the text-message opt-in on the public forms: unticked to start, as carriers require (shown word for word on /sms-consent, lib/legal.js)
const smsConsentBox = (values) => `<label style="display:flex;gap:10px;align-items:flex-start;margin:0 0 12px;font-size:14px;line-height:1.45;color:#374151"><input type="checkbox" name="smsConsent" value="1"${values.smsConsent ? ' checked' : ''} style="width:auto;margin:3px 0 0;flex:none">
<span>Text me updates from ${esc(smsBrand())} about my request, quotes, invoices and appointments with ${esc(db.company.name)}. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help. Agreeing isn’t a condition of service. See the <a href="/terms#sms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</span></label>`;
const smsConsentFrom = (b, phone, source) => (b.smsConsent && phone ? { at: new Date().toISOString(), source } : null);
// on the thank-you page, so people who ticked the box know what comes next
const smsSignedUp = (b, phone) => (b.smsConsent && phone ? `<p class="muted">You’re signed up for texts from ${esc(smsBrand())} about your request, quotes, invoices and appointments at ${esc(phone)}. You’ll get a text from ${esc(smsBrand())} confirming it. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to any text to opt out, HELP for help.</p>` : '');
function referPage(c, { error, values = {} } = {}) {
  const v = (k) => esc(values[k] || '');
  const first = String(c.name || '').trim().split(/\s+/)[0];
  return shell(`${db.company.name}: request service`, `<h1>Get work done with ${esc(db.company.name)}</h1>
<p class="muted">${first ? `${esc(first)} recommended us. ` : ''}Tell us what you need and we'll get back to you${db.company.phone ? `, or call <a href="tel:${esc(db.company.phone)}">${esc(db.company.phone)}</a>` : ''}.</p>
${error ? `<p style="color:#b91c1c;font-weight:600">${esc(error)}</p>` : ''}
<form method="post" style="margin-top:16px">
<label>Your name*<input name="name" required maxlength="100" value="${v('name')}" autocomplete="name"></label>
<label>Email<input name="email" type="email" maxlength="120" value="${v('email')}" autocomplete="email"></label>
<label>Phone<input name="phone" type="tel" maxlength="40" value="${v('phone')}" autocomplete="tel"></label>
${smsConsentBox(values)}
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
  const done = shell('Request sent', `<h1>Thanks${clip('name', 100) ? ', ' + esc(clip('name', 100).split(/\s+/)[0]) : ''}!</h1><p class="muted">We got your request and will be in touch soon.</p>${smsSignedUp(b, clip('phone', 40))}`);
  if (b.website) return res.send(done); // honeypot: bots fill every field
  const ip = req.socket.remoteAddress; const now = Date.now(); const hits = (referHits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (hits.length >= 5) return res.status(429).send(referPage(c, { error: 'Too many requests from this connection. Please call or email us instead.', values: b }));
  const name = clip('name', 100); const title = clip('title', 120); const email = clip('email', 120).toLowerCase(); const phone = clip('phone', 40);
  if (!name || !title) return res.status(400).send(referPage(c, { error: 'Please enter your name and what you need done.', values: b }));
  if (!email && !phone) return res.status(400).send(referPage(c, { error: 'Please give us an email or phone number so we can reach you.', values: b }));
  hits.push(now); referHits.set(ip, hits);
  const created = iso(new Date());
  const lead = { id: uid(), name, email, phone, address: clip('address', 300), company: '', tags: ['Referral'], notes: `Referred by ${c.name}`, referredBy: c.id, smsConsent: smsConsentFrom(b, phone, 'referral form'), portalToken: token(), createdAt: created };
  db.clients.push(lead);
  db.requests = db.requests || [];
  const r = { id: uid(), clientId: lead.id, title, details: clip('details', 4000), address: lead.address, preferredDate: '', preferredTime: 'any', status: 'new', referredBy: c.id, createdAt: new Date().toISOString() };
  db.requests.push(r);
  const details = emails.details([['Name', name], ['Phone', phone], ['Email', email], ['Address', r.address || 'not given'], ['Referred by', c.name]]);
  const sent = await sendTemplate('referral', db.company.email, { name, referrer: c.name, title, details, request: r.details, business: db.company.name, account_url: baseUrl() });
  db.notifications.unshift({ id: uid(), at: r.createdAt, clientId: lead.id, clientName: name, channel: 'email', kind: 'referral', refId: r.id, refNumber: '', to: db.company.email || '', subject: `Referral: ${title}`, body: sent.text, status: sent.status, detail: sent.detail });
  save(); pushNewRequest('request', lead, r); res.send(done); optInText(lead).catch(() => {});
});

// ---------- online booking: <account address>/book, linked from the Google Business Profile ("Book" button) and the business's own website ----------
// New clients ask for work here; it arrives as a request (and a lead, unless the email or phone matches a client already).
const bookHits = new Map(); // ip -> [timestamps]: at most 5 bookings per hour per address
// The booking widget: <script src="<account address>/book/widget.js" data-mode="inline|button|float" data-text="Book now" data-color="#hex"></script>
// on the business's own website. inline puts the form where the script is; button puts a button there and float one in the page's corner,
// each opening the form in a popup. The form is /book?embed=1 in an iframe, which tells the widget its height so it never scrolls inside.
const HEX = /^#[0-9a-f]{6}$/i;
app.get('/book/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8'); res.setHeader('Cache-Control', 'public, max-age=600');
  if (!tenancy.has('onlineBooking')) return res.end('/* Online booking isn’t included in this business’s plan. */\n');
  const cfg = { color: HEX.test(db.company.brandColor || '') ? db.company.brandColor : '#2563eb', title: `Book with ${db.company.name || 'us'}` };
  res.end(`/* ${String(db.company.name || '').replace(/\*\//g, '')} online booking */
(function () {
  var s = document.currentScript; if (!s || s.getAttribute('data-wp-done')) return; s.setAttribute('data-wp-done', '1');
  var cfg = ${JSON.stringify(cfg).replace(/</g, '\\u003c')};
  var base = new URL(s.src).origin; var d = s.dataset; var mode = /^(button|float)$/.test(d.mode || '') ? d.mode : 'inline';
  var color = /^#[0-9a-fA-F]{6}$/.test(d.color || '') ? d.color : cfg.color;
  var src = function (inPopup) { return base + '/book?embed=1&site=' + encodeURIComponent(location.hostname) + (color !== cfg.color ? '&color=' + encodeURIComponent(color) : '') + (inPopup ? '&in=popup' : '') + (d.ref ? '&ref=' + encodeURIComponent(d.ref) : ''); };
  function frame(inPopup) {
    var f = document.createElement('iframe'); f.src = src(inPopup); f.title = cfg.title; f.setAttribute('scrolling', 'no');
    f.style.cssText = 'display:block;width:100%;height:760px;border:0;background:transparent;color-scheme:light';
    var loads = 0;
    window.addEventListener('message', function (e) {
      if (e.source !== f.contentWindow || e.origin !== base || !e.data || !e.data.wpBook) return;
      if (e.data.h) f.style.height = Math.ceil(e.data.h) + 'px';
      if (e.data.load && ++loads > 1) { var r = f.getBoundingClientRect(); if (r.top < 0 || r.top > innerHeight) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); } // after sending: show the thank-you
    });
    return f;
  }
  if (mode === 'inline') { var w = document.createElement('div'); w.style.cssText = 'max-width:640px;margin:0 auto'; w.appendChild(frame(false)); s.parentNode.insertBefore(w, s.nextSibling); return; }
  var b = document.createElement('button'); b.type = 'button'; b.textContent = (d.text || 'Book now').slice(0, 40);
  b.style.cssText = 'font:600 16px/1.2 system-ui,-apple-system,sans-serif;background:' + color + ';color:#fff;border:0;border-radius:8px;padding:13px 22px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.18)' + (mode === 'float' ? ';position:fixed;right:20px;bottom:20px;z-index:2147482000;border-radius:999px' : '');
  var open = null; var back = null; var overflow = '';
  function close() { if (!open) return; open.remove(); open = null; document.documentElement.style.overflow = overflow; document.removeEventListener('keydown', esc); if (back) back.focus(); }
  function esc(e) { if (e.key === 'Escape') close(); }
  b.addEventListener('click', function () {
    if (open) return; back = document.activeElement;
    var o = document.createElement('div'); o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', cfg.title);
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 12px;box-sizing:border-box';
    var box = document.createElement('div'); box.style.cssText = 'position:relative;width:100%;max-width:600px;margin:auto 0;background:#fff;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.3);overflow:hidden';
    var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.innerHTML = '&times;';
    x.style.cssText = 'position:absolute;top:8px;right:8px;width:40px;height:40px;border:0;border-radius:50%;background:#f3f4f6;color:#111827;font:400 26px/1 system-ui,sans-serif;cursor:pointer;z-index:1';
    x.addEventListener('click', close); o.addEventListener('click', function (e) { if (e.target === o) close(); });
    box.appendChild(x); box.appendChild(frame(true)); o.appendChild(box);
    overflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(o); open = o; document.addEventListener('keydown', esc); x.focus();
  });
  if (mode === 'float') document.body ? document.body.appendChild(b) : document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(b); });
  else s.parentNode.insertBefore(b, s.nextSibling);
})();
`);
});
app.use('/book', express.urlencoded({ extended: false }));
app.use('/book', (req, res, next) => (tenancy.has('onlineBooking') ? next() : res.status(404).send(shell('Page not found', '<h1>Page not found</h1><p class="muted">Online booking isn’t available for this business.</p>'))));
// ?embed=1: inside the widget's iframe on the business's website (no business header, no page margins; ?in=popup: no border either).
// It posts its height to the widget on load and whenever it changes. ?color=#hex: the widget's button color for the Send button too
const bookEmbed = (req) => { const q = req.query || {}; return q.embed === '1' ? { popup: q.in === 'popup', color: HEX.test(q.color || '') ? q.color : '' } : null; };
function bookShell(title, inner, embed) {
  const html = shell(title, inner); if (!embed) return html;
  const css = `<style>html,body{background:transparent;color-scheme:light}.card{max-width:none;margin:0;box-shadow:none;${embed.popup ? 'border:0;border-radius:0;padding:24px 24px 20px}h1{padding-right:44px' : 'border:1px solid #e5e7eb;padding:24px'}}.sh-head{display:none!important}${embed.color ? `.btn{background:${embed.color}}` : ''}@media(max-width:480px){.card{padding:18px 16px}}</style>`;
  const js = `<script>(function(){var t=window.parent;if(t===window)return;var h=function(load){t.postMessage({wpBook:1,h:document.documentElement.scrollHeight,load:load?1:0},'*')};addEventListener('load',function(){h(1)});if(window.ResizeObserver)new ResizeObserver(function(){h(0)}).observe(document.body)})()</script>`;
  // links to the Terms and Privacy Policy open in a new tab, not inside the little frame
  return html.replace('</head>', css + '</head>').replace('</body>', js + '</body>').replace(/<a href="\//g, '<a target="_blank" rel="noopener" href="/');
}
// Settings → Online Booking: the booking page link, the widget script, whether Google's Book button is on, and the last 30 days' bookings
app.get('/api/booking', (req, res) => {
  const since = new Date(Date.now() - 30 * 864e5).toISOString(); const recent = (db.requests || []).filter((r) => r.source === 'booking' && r.createdAt >= since);
  const sites = {}; for (const r of recent) if (r.site) sites[r.site] = (sites[r.site] || 0) + 1;
  const g = connOf('google');
  res.json({ url: bookingUrl(), script: `${bookingUrl()}/widget.js`, color: HEX.test(db.company.brandColor || '') ? db.company.brandColor : '#2563eb', google: { connected: !!g, booking: !!(g && g.booking) },
    last30: { total: recent.length, website: recent.filter((r) => r.site).length, sites: Object.entries(sites).sort((a, b) => b[1] - a[1]).slice(0, 5) } });
});
function bookPage({ error, values = {}, embed = null } = {}) {
  const v = (k) => esc(values[k] || ''); const sel = (k, x) => (values[k] === x ? ' selected' : '');
  const field = 'padding:10px;border:1px solid #d1d5db;border-radius:8px;width:100%;box-sizing:border-box;margin:4px 0 10px;font:inherit';
  return bookShell(`${db.company.name}: book online`, `<h1>Book with ${esc(db.company.name)}</h1>
<p class="muted">Tell us what you need and when suits you. We'll confirm a time with you${db.company.phone ? `, or call <a href="tel:${esc(db.company.phone)}">${esc(fmtUsPhone(db.company.phone))}</a>` : ''}.</p>
${error ? `<p style="color:#b91c1c;font-weight:600">${esc(error)}</p>` : ''}
<form method="post" style="margin-top:16px">
<label>Your name*<input name="name" required maxlength="100" value="${v('name')}" autocomplete="name"></label>
<label>Email<input name="email" type="email" maxlength="120" value="${v('email')}" autocomplete="email"></label>
<label>Phone<input name="phone" type="tel" maxlength="40" value="${v('phone')}" autocomplete="tel"></label>
${smsConsentBox(values)}
<label>Service address<input name="address" maxlength="300" value="${v('address')}" autocomplete="street-address"></label>
<label>What do you need done?*<input name="title" required maxlength="120" value="${v('title')}"></label>
<label>Details<textarea name="details" rows="4" maxlength="4000" style="${field}">${v('details')}</textarea></label>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label>Preferred day<input name="preferredDate" type="date" min="${iso(new Date())}" value="${v('preferredDate')}"></label>
<label>Preferred time<select name="preferredTime" style="${field}"><option value="any">Any time</option><option value="morning"${sel('preferredTime', 'morning')}>Morning</option><option value="afternoon"${sel('preferredTime', 'afternoon')}>Afternoon</option><option value="evening"${sel('preferredTime', 'evening')}>Evening</option></select></label></div>
<input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<button class="btn">Send booking request</button></form>`, embed);
}
app.get('/book', (req, res) => { if (req.query.ref) jobPosts.visit(String(req.query.ref)); res.send(bookPage({ embed: bookEmbed(req) })); }); // ?ref=<post>: opened from a job's social post
app.post('/book', async (req, res) => {
  const b = req.body || {}; const clip = (k, n) => String(b[k] || '').trim().slice(0, n); const embed = bookEmbed(req);
  const done = bookShell('Booking request sent', `<h1>Thanks${clip('name', 100) ? ', ' + esc(clip('name', 100).split(/\s+/)[0]) : ''}!</h1><p class="muted">We got your request and will be in touch soon to confirm a time.</p>${smsSignedUp(b, clip('phone', 40))}`, embed);
  if (b.website) return res.send(done); // honeypot: bots fill every field
  const ip = req.socket.remoteAddress; const now = Date.now(); const hits = (bookHits.get(ip) || []).filter((t) => now - t < 3600e3);
  const again = (status, error) => res.status(status).send(bookPage({ error, values: b, embed }));
  if (hits.length >= 5) return again(429, 'Too many requests from this connection. Please call or email us instead.');
  const name = clip('name', 100); const title = clip('title', 120); const email = normEmail(clip('email', 120)); const phone = clip('phone', 40);
  if (!name || !title) return again(400, 'Please enter your name and what you need done.');
  if (!email && !phone) return again(400, 'Please give us an email or phone number so we can reach you.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return again(400, 'Please check your email address.');
  // the website the widget is on (its host name), shown on the request and in the email
  const site = embed && /^[a-z0-9.-]{1,100}$/i.test(String(req.query.site || '')) ? String(req.query.site).toLowerCase().replace(/^www\./, '') : '';
  hits.push(now); bookHits.set(ip, hits);
  const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);
  let c = db.clients.find((x) => (email && normEmail(x.email) === email) || (digits(phone).length === 10 && digits(x.phone) === digits(phone)));
  const isNew = !c;
  if (!c) { c = { id: uid(), name, email, phone, address: clip('address', 300), company: '', tags: ['Online booking'], notes: site ? `Booked online on ${site}` : 'Booked online', portalToken: token(), createdAt: iso(new Date()) }; db.clients.push(c); }
  // consent covers the number typed on this form: an existing client's texts go to their saved number, so it has to be the same one
  const optedIn = !c.smsConsent && (!c.phone || digits(c.phone) === digits(phone)) && smsConsentFrom(b, phone, 'booking form');
  if (optedIn) { c.smsConsent = optedIn; c.phone = c.phone || phone; }
  const preferredDate = /^\d{4}-\d{2}-\d{2}$/.test(b.preferredDate || '') && b.preferredDate >= iso(new Date()) ? b.preferredDate : '';
  const preferredTime = ['morning', 'afternoon', 'evening'].includes(b.preferredTime) ? b.preferredTime : 'any';
  db.requests = db.requests || [];
  const r = { id: uid(), clientId: c.id, title, details: clip('details', 4000), address: clip('address', 300) || c.address || '', preferredDate, preferredTime, status: 'new', source: 'booking', ...(site ? { site } : {}), ...(jobPosts.refOf(String(req.query.ref || '')) ? { fromPost: String(req.query.ref) } : {}), createdAt: new Date().toISOString() };
  db.requests.push(r);
  const details = emails.details([['Name', name + (isNew ? ' (new lead)' : '')], ['Phone', phone || c.phone], ['Email', email || c.email], ['Address', r.address || 'not given'], ['Preferred', `${preferredDate || 'any day'}, ${preferredTime === 'any' ? 'any time' : preferredTime}`], ['From', site ? `Booking form on ${site}` : 'Online booking']]);
  const sent = await sendTemplate('workRequest', db.company.email, { client: name, title, details, request: r.details, business: db.company.name, account_url: baseUrl() });
  db.notifications.unshift({ id: uid(), at: r.createdAt, clientId: c.id, clientName: c.name, channel: 'email', kind: 'request', refId: r.id, refNumber: '', to: db.company.email || '', subject: `New request: ${title}`, body: sent.text, status: sent.status, detail: sent.detail });
  save(); pushNewRequest('booking', c, r); res.send(done); if (optedIn) optInText(c).catch(() => {});
});

// ---------- the business page (lib/business-page.js): <account address>/card, which the business QR code opens ----------
const bizPage = () => businessPage.view(db.businessPage, db.company);
const pageBook = () => (tenancy.has('onlineBooking') ? bookingUrl() : '');
app.use('/card', express.urlencoded({ extended: false }));
// ?qr=1: a scan of the QR code, counted, and turned away once the scan limit or end date is reached
// What's new: the bell lists the latest three; See all changes opens ideas.<domain>/changelog
app.get('/api/changelog', (req, res) => res.json(changelog.latest(Math.min(20, Number(req.query.limit) || 3))));
app.get('/changelog', (req, res) => res.redirect(301, tenancy.ideasUrl() + '/changelog')); // the page moved to ideas.<domain>, for old links
app.get('/card', (req, res) => {
  const p = bizPage();
  if (req.query.qr) {
    const scans = (db.businessPage && db.businessPage.scans) || 0;
    if (!businessPage.qrActive(p, scans, localNow().date)) return res.status(410).send(businessPage.expiredPage(p.name));
    db.businessPage = { ...(db.businessPage || {}), scans: scans + 1 }; save();
  }
  res.send(businessPage.render(p, { book: pageBook(), back: req.query.preview === '1' })); // ?preview=1: opened from the app, with a Back button
});
app.get('/card/contact.vcf', (req, res) => {
  const p = bizPage(); res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${(p.name || 'contact').replace(/[^\w -]+/g, '').trim() || 'contact'}.vcf"`);
  res.end(businessPage.vcard(p, `${baseUrl()}/card`));
});
// Exchange contact: the visitor's details become a lead and a request, like an online booking
app.post('/card/exchange', async (req, res) => {
  const p = bizPage(); const b = req.body || {}; const clip = (k, n) => String(b[k] || '').trim().slice(0, n);
  const again = (status, error) => res.status(status).send(businessPage.render(p, { book: pageBook(), error, values: b }));
  if (!p.exchange) return res.redirect('/card');
  if (b.website) return res.send(businessPage.render(p, { book: pageBook(), done: true, values: b })); // honeypot: bots fill every field
  const ip = req.socket.remoteAddress; const now = Date.now(); const hits = (bookHits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (hits.length >= 5) return again(429, 'Too many messages from this connection. Please call or email us instead.');
  const name = clip('name', 100); const email = normEmail(clip('email', 120)); const phone = clip('phone', 40);
  if (!name) return again(400, 'Please enter your name.');
  if (!email && !phone) return again(400, 'Please give us an email or phone number so we can reach you.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return again(400, 'Please check your email address.');
  hits.push(now); bookHits.set(ip, hits);
  const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);
  let c = db.clients.find((x) => (email && normEmail(x.email) === email) || (digits(phone).length === 10 && digits(x.phone) === digits(phone)));
  const isNew = !c;
  if (!c) { c = { id: uid(), name, email, phone, address: '', company: '', tags: ['Business page'], notes: 'Left their details on the business page', portalToken: token(), createdAt: iso(new Date()) }; db.clients.push(c); }
  db.requests = db.requests || [];
  const r = { id: uid(), clientId: c.id, title: 'Contact from your business page', details: clip('message', 2000), address: c.address || '', preferredDate: '', preferredTime: 'any', status: 'new', source: 'business page', createdAt: new Date().toISOString() };
  db.requests.push(r);
  const details = emails.details([['Name', name + (isNew ? ' (new lead)' : '')], ['Phone', phone || c.phone], ['Email', email || c.email], ['From', 'Business page']]);
  const sent = await sendTemplate('workRequest', db.company.email, { client: name, title: r.title, details, request: r.details, business: db.company.name, account_url: baseUrl() });
  db.notifications.unshift({ id: uid(), at: r.createdAt, clientId: c.id, clientName: c.name, channel: 'email', kind: 'request', refId: r.id, refNumber: '', to: db.company.email || '', subject: `New request: ${r.title}`, body: sent.text, status: sent.status, detail: sent.detail });
  save(); pushNewRequest('request', c, r); res.send(businessPage.render(p, { book: pageBook(), done: true, values: b }));
});
// Settings → Business Page: the page, its address, and how many times the QR code has been scanned
const pageView = () => ({ page: bizPage(), scans: (db.businessPage && db.businessPage.scans) || 0, url: `${baseUrl()}/card`, companyLogo: db.company.logo || '', covers: businessPage.COVERS, icons: Object.fromEntries(Object.entries(businessPage.ICON_NAMES).map(([k, n]) => [k, { name: n, svg: businessPage.ICON[k] }])), qrLogos: businessPage.QR_LOGOS, qrFonts: businessPage.QR_FONTS, networks: Object.fromEntries(Object.entries(businessPage.NETWORKS).map(([k, [n, h]]) => [k, { name: n, handle: !!h }])) });
app.get('/api/business-page', (req, res) => res.json(pageView()));
// a new logo or cover arrives as a data URL; it's saved in the account's uploads, and the one it replaces is deleted
const PAGE_IMG = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/;
const pageImage = (v, old) => {
  const m = PAGE_IMG.exec(v || ''); if (!m) return null;
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > 5e6) throw Object.assign(new Error('Images can be up to 5 MB'), { status: 400 });
  const file = `page-${token()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`; fs.writeFileSync(path.join(uploadDir(), file), buf);
  const was = /^\/uploads\/(page-[\w-]+\.\w+)$/.exec(old || ''); if (was) fs.rm(path.join(uploadDir(), was[1]), { force: true }, () => {});
  return `/uploads/${file}`;
};
// logo: a new image, '' for none, or the saved address; cover: a sample's name, a new image, or the saved address
const pageImages = (b, old) => {
  const logo = pageImage(b.logo, old.logo) ?? (b.logo === '' || b.logo === db.company.logo || b.logo === old.logo ? b.logo : old.logo);
  const cover = businessPage.COVERS[b.cover] ? b.cover : pageImage(b.cover, old.cover) ?? (b.cover === old.cover ? old.cover : 'sky');
  const drop = (u) => { const m = /^\/uploads\/(page-[\w-]+\.\w+)$/.exec(u || ''); if (m && u !== logo && u !== cover) fs.rm(path.join(uploadDir(), m[1]), { force: true }, () => {}); };
  drop(old.logo); drop(old.cover); return { logo, cover };
};
app.put('/api/business-page', (req, res) => {
  if (!isAdmin(currentUser(req))) return res.status(403).json({ error: 'Only the account owner or an admin can change the business page' });
  const b = req.body || {};
  try {
    const page = businessPage.clean(b); const old = bizPage();
    const q = b.qr || {}; const qr = businessPage.cleanQr(q);
    // the QR code's logo: a sample, the company logo, a new image or the saved one; its background picture: a new image, the saved one or none
    qr.logo = businessPage.QR_LOGOS.includes(q.logo) || !q.logo ? q.logo || '' : pageImage(q.logo, old.qr.logo) ?? (q.logo === old.qr.logo ? q.logo : '');
    qr.bgImg = !q.bgImg ? '' : pageImage(q.bgImg, old.qr.bgImg) ?? (q.bgImg === old.qr.bgImg ? q.bgImg : '');
    for (const k of ['logo', 'bgImg']) { const was = /^\/uploads\/(page-[\w-]+\.\w+)$/.exec(old.qr[k] || ''); if (was && qr[k] !== old.qr[k] && !PAGE_IMG.test(q[k] || '')) fs.rm(path.join(uploadDir(), was[1]), { force: true }, () => {}); }
    db.businessPage = { ...page, ...pageImages(b, old), qr, scans: (db.businessPage && db.businessPage.scans) || 0 };
    if (b.resetScans) db.businessPage.scans = 0;
    save(); res.json(pageView());
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});
// the phone preview while editing: the page as it would look, images shown straight from the browser, nothing saved
app.post('/api/business-page/preview', (req, res) => {
  const b = req.body || {}; let page; try { page = businessPage.clean(b); } catch (e) { return res.json({ error: e.message }); } // the preview keeps showing the last good version
  const pick = (v, old) => (PAGE_IMG.test(v || '') || v === '' || v === db.company.logo || v === old || businessPage.COVERS[v] ? v : old);
  const old = bizPage();
  res.json({ html: businessPage.render({ ...old, ...page, logo: pick(b.logo, old.logo), cover: pick(b.cover, old.cover) }, { book: pageBook(), preview: true }) });
});

// a client asks for work from their portal: saved as a request and emailed to the business
app.post('/api/portal/:token/requests', async (req, res) => {
  const c = db.clients.find((x) => x.portalToken === req.params.token);
  if (!c) return res.status(404).json({ error: 'Invalid portal link' });
  if (currentUser(req)) return res.status(403).json({ error: 'You’re logged in to the business account, so you can’t send a request for your client.' });
  db.requests = db.requests || [];
  const b = req.body || {}; const clip = (v, n) => String(v || '').trim().slice(0, n);
  const title = clip(b.title, 120); if (!title) return res.status(400).json({ error: 'Tell us what you need done' });
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  if (db.requests.filter((r) => r.clientId === c.id && r.createdAt > dayAgo).length >= 10) return res.status(429).json({ error: 'You’ve sent several requests today. Please call or email us instead.' });
  const preferredDate = /^\d{4}-\d{2}-\d{2}$/.test(b.preferredDate || '') ? b.preferredDate : '';
  const preferredTime = ['morning', 'afternoon', 'evening'].includes(b.preferredTime) ? b.preferredTime : 'any';
  const phone = clip(b.phone, 40); const optedIn = !c.smsConsent && smsConsentFrom(b, phone, 'client portal');
  if (b.smsConsent && !c.smsConsent && String(phone).replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Enter your mobile number with the area code to get texts' });
  if (optedIn) { c.smsConsent = optedIn; c.phone = phone; } // the number they just agreed to be texted at
  const r = { id: uid(), clientId: c.id, title, details: clip(b.details, 4000), address: clip(b.address, 300) || c.address || '', preferredDate, preferredTime, status: 'new', createdAt: new Date().toISOString() };
  db.requests.push(r);
  const details = emails.details([['Client', c.name], ['Phone', c.phone], ['Email', c.email], ['Address', r.address || 'not given'], ['Preferred', `${preferredDate || 'any day'}, ${preferredTime === 'any' ? 'any time' : preferredTime}`]]);
  const sent = await sendTemplate('workRequest', db.company.email, { client: c.name, title, details, request: r.details, business: db.company.name, account_url: baseUrl() });
  db.notifications.unshift({ id: uid(), at: r.createdAt, clientId: c.id, clientName: c.name, channel: 'email', kind: 'request', refId: r.id, refNumber: '', to: db.company.email || '', subject: `New request: ${title}`, body: sent.text, status: sent.status, detail: sent.detail });
  save(); pushNewRequest('request', c, r); res.status(201).json({ ...requestForClient(r), smsConsent: !!c.smsConsent, phone: c.phone }); if (optedIn) optInText(c).catch(() => {});
});

// ---------- reports ----------
const monthKey = (d) => String(d).slice(0, 7);
function lastMonths(n) {
  const out = []; const now = new Date();
  for (let i = n - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }
  return out;
}
// ---------- report categories (Products & services → Category): ?cat=<name> shows one category, ?cat=__none what has none (and whole-business expenses), no cat everything ----------
const wantCat = (req) => { const c = req.query.cat; return c === undefined || c === '' ? null : c === '__none' ? '' : cleanCat(c); };
const catIs = (c, want) => want === null || String(c || '').toLowerCase() === String(want).toLowerCase();
const lineAmt = (i) => Math.abs((Number(i.qty) || 0) * (Number(i.price) || 0));
// each line's category: its own (saved with it), else its catalog item's, else (a line typed in by hand, a late fee) the document's only category
function lineCats(doc) {
  const own = (doc.items || []).map((i) => cleanCat(i.cat) || catalogCat(i.desc));
  const only = new Set(own.filter(Boolean).map((c) => c.toLowerCase())).size === 1 ? own.find(Boolean) : '';
  return own.map((c) => c || only);
}
// the part of a document (by its line amounts) in the category, 0 to 1
function catShare(doc, want) {
  if (want === null) return 1;
  const cats = lineCats(doc); let all = 0; let mine = 0;
  (doc.items || []).forEach((i, k) => { all += lineAmt(i); if (catIs(cats[k], want)) mine += lineAmt(i); });
  return all ? mine / all : want === '' ? 1 : 0;
}
// the category most of these documents' money is in ('' when none has one)
function mainCat(docs) {
  const t = {}; for (const d of docs) { const cats = lineCats(d); (d.items || []).forEach((i, k) => { if (cats[k]) t[cats[k]] = (t[cats[k]] || 0) + lineAmt(i) + 1e-9; }); }
  return (Object.entries(t).sort((a, b) => b[1] - a[1])[0] || [''])[0];
}
const jobInvoices = (j) => db.invoices.filter((i) => (i.jobId === j.id || (i.jobIds || []).includes(j.id)) && i.status !== 'draft');
const jobCat = (j) => mainCat([j]) || mainCat(jobInvoices(j));
// an expense counts toward the category picked on it, else its job's, else the whole business ('')
function expenseCats() {
  const memo = new Map();
  return (e) => { const own = cleanCat(e.bizCat); if (own || !e.jobId) return own;
    if (!memo.has(e.jobId)) { const j = db.jobs.find((x) => x.id === e.jobId); memo.set(e.jobId, j ? jobCat(j) : ''); } return memo.get(e.jobId); };
}
app.get('/api/reports', (req, res) => {
  const want = wantCat(req); const months = lastMonths(12); const w = (i) => catShare(i, want);
  const paid = db.invoices.filter((i) => i.status === 'paid' && w(i) > 0);
  const pending = db.invoices.filter((i) => i.status !== 'paid' && i.status !== 'draft' && w(i) > 0);
  const sum = (list) => round2(list.reduce((s, i) => s + (Number(i.total) || 0) * w(i), 0));
  const revenueByMonth = months.map((m) => ({ month: m, revenue: sum(paid.filter((i) => monthKey(i.paidAt) === m)) }));
  const svc = {};
  db.invoices.filter((i) => i.status !== 'draft').forEach((i) => { const cats = lineCats(i); (i.items || []).forEach((it, k) => { if (!catIs(cats[k], want)) return; const s = svc[it.desc] || (svc[it.desc] = { name: it.desc, count: 0, revenue: 0 }); s.count += it.qty; s.revenue += it.qty * it.price; }); });
  const popularServices = Object.values(svc).map((s) => ({ ...s, revenue: round2(s.revenue) })).sort((a, b) => b.count - a.count || b.revenue - a.revenue);
  // paid revenue in the last 12 months by category (always every category, so they can be compared)
  const byCat = {};
  for (const i of db.invoices) {
    if (i.status !== 'paid' || !months.includes(monthKey(i.paidAt))) continue;
    const cats = lineCats(i); const part = {}; let all = 0;
    (i.items || []).forEach((it, k) => { const c = cats[k] || ''; part[c] = (part[c] || 0) + lineAmt(it); all += lineAmt(it); });
    if (!all) { part[''] = 1; all = 1; }
    for (const [c, a] of Object.entries(part)) byCat[c] = (byCat[c] || 0) + (Number(i.total) || 0) * a / all;
  }
  const byCategory = Object.keys(byCat).some(Boolean) ? Object.entries(byCat).map(([name, revenue]) => ({ name, revenue: round2(revenue) })).filter((x) => x.revenue).sort((a, b) => b.revenue - a.revenue) : [];
  const thisMonth = months[months.length - 1]; const ec = expenseCats();
  const totalExpenses = round2(db.expenses.filter((e) => catIs(ec(e), want)).reduce((s, e) => s + e.amount, 0));
  res.json({
    revenueByMonth, popularServices, byCategory,
    thisMonthRevenue: revenueByMonth[revenueByMonth.length - 1].revenue,
    paidTotal: sum(paid), paidCount: paid.length,
    pendingTotal: sum(pending), pendingCount: pending.length,
    overdueTotal: sum(pending.filter((i) => invoiceStatus(i) === 'overdue')),
    totalExpenses, thisMonth,
  });
});

// ---------- Financial Reports → Profit & loss, Job profit, Unpaid invoices (accounting-style reports) ----------
const validDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const inRange = (d, from, to) => { const k = String(d || '').slice(0, 10); return !!k && k >= from && k <= to; };
// a quote's or invoice's lines, net of its discount and before sales tax: what was sold, for income by service
function netLines(doc) {
  const sub = Number(doc.subtotal) || 0; const f = sub ? (sub - (Number(doc.discount) || 0)) / sub : 0; const cats = lineCats(doc);
  return (doc.items || []).map((i, k) => ({ name: i.desc || 'Other', amount: (Number(i.qty) || 0) * (Number(i.price) || 0) * f, cat: cats[k] }));
}
// share of a payment that is income (the rest is sales tax collected for the state)
const preTaxShare = (doc) => (Number(doc.total) > 0 ? Math.max(0, Math.min(1, (doc.total - (Number(doc.tax) || 0)) / doc.total)) : 1);
// every amount of money in (and refunds out), dated: invoice payments, invoices marked paid before payments were itemized, quote deposits
function cashMoves() {
  const out = [];
  const add = (doc, kind, date, amount) => { if (date && amount) out.push({ doc, kind, date: String(date).slice(0, 10), amount: round2(amount) }); };
  const refunds = (doc, kind, list) => (list || []).filter((r) => r.status !== 'failed' && r.status !== 'canceled').forEach((r) => add(doc, kind, r.at, -(Number(r.amount) || 0)));
  for (const inv of db.invoices) {
    if ((inv.payments || []).length) inv.payments.forEach((p) => { add(inv, 'invoice', p.date, Number(p.amount) || 0); refunds(inv, 'invoice', p.refunds); });
    else if (inv.status === 'paid' && inv.paidAt) add(inv, 'invoice', inv.paidAt, Number(inv.paidAmount || inv.total) || 0);
  }
  for (const q of db.quotes) if (q.depositPaidAt) { add(q, 'quote', q.depositPaidAt, Number(q.depositPaidAmount ?? q.depositFee) || 0); refunds(q, 'quote', q.depositRefunds); }
  return out;
}
// want: one category's income and expenses (see wantCat); null for everything
function profitLoss(from, to, basis, want = null) {
  const income = {}; let tax = 0; const months = {};
  const month = (d) => months[d.slice(0, 7)] || (months[d.slice(0, 7)] = { month: d.slice(0, 7), income: 0, expenses: 0 });
  const addIncome = (name, amt, d) => { if (!amt) return; income[name] = (income[name] || 0) + amt; month(d).income += amt; };
  if (basis === 'accrual') { // income when invoiced
    for (const inv of db.invoices) {
      const d = String(inv.issueDate || inv.createdAt || '').slice(0, 10);
      if (inv.status === 'draft' || !inRange(d, from, to)) continue;
      netLines(inv).forEach((l) => { if (catIs(l.cat, want)) addIncome(l.name, l.amount, d); }); tax += (Number(inv.tax) || 0) * catShare(inv, want);
    }
  } else { // income when paid: each payment split across the lines it paid for, sales tax taken out
    for (const m of cashMoves()) {
      if (!inRange(m.date, from, to)) continue;
      const share = preTaxShare(m.doc); const lines = netLines(m.doc); const base = lines.reduce((s, l) => s + l.amount, 0);
      const net = m.amount * share; const w = catShare(m.doc, want); tax += (m.amount - net) * w;
      if (m.kind === 'quote') addIncome('Deposits received', net * w, m.date);
      else if (!base) { if (catIs('', want)) addIncome('Other income', net, m.date); }
      else lines.forEach((l) => { if (catIs(l.cat, want)) addIncome(l.name, net * l.amount / base, m.date); });
    }
  }
  const exp = {}; const ec = expenseCats(); let shared = 0;
  for (const e of db.expenses) {
    const d = String(e.date || '').slice(0, 10); if (!inRange(d, from, to)) continue;
    if (!catIs(ec(e), want)) { if (!ec(e)) shared += Number(e.amount) || 0; continue; }
    const c = e.category || 'Other'; exp[c] = (exp[c] || 0) + (Number(e.amount) || 0); month(d).expenses += Number(e.amount) || 0;
  }
  const list = (o) => Object.entries(o).map(([name, amount]) => ({ name, amount: round2(amount) })).filter((x) => x.amount).sort((a, b) => b.amount - a.amount);
  const incomeList = list(income); const expList = list(exp);
  const totalIncome = round2(incomeList.reduce((s, x) => s + x.amount, 0)); const totalExpenses = round2(expList.reduce((s, x) => s + x.amount, 0));
  return { basis, from, to, income: incomeList, expenses: expList, totalIncome, totalExpenses, net: round2(totalIncome - totalExpenses), margin: totalIncome ? Math.round((totalIncome - totalExpenses) / totalIncome * 1000) / 10 : null, taxCollected: round2(tax),
    sharedExpenses: round2(shared), // with one category picked: whole-business expenses (no category, no job) left out
    byMonth: Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({ month: m.month, income: round2(m.income), expenses: round2(m.expenses), net: round2(m.income - m.expenses) })) };
}
// each job's invoiced amount (before tax) against the expenses logged to it; want: only the jobs whose main category it is
function jobProfit(from, to, want = null) {
  const labor = laborByJob(); // hours logged to each job (Timesheets) at each person's pay rate
  return db.jobs.filter((j) => inRange(j.date || j.createdAt, from, to)).map((j) => {
    const invs = jobInvoices(j); const category = mainCat([j]) || mainCat(invs);
    if (!catIs(category, want)) return null;
    // an invoice for several jobs (batch invoicing) counts this job's own lines, less their share of any discount
    const part = (i) => { if (!(i.jobIds || []).length) return (Number(i.subtotal) || 0) - (Number(i.discount) || 0);
      const lines = (i.items || []).filter((x) => !x.lateFee); const mine = lines.filter((x) => x.job === j.id).reduce((s, x) => s + x.qty * x.price, 0); const all = lines.reduce((s, x) => s + x.qty * x.price, 0);
      return mine - (all ? (Number(i.discount) || 0) * mine / all : 0); };
    const revenue = round2(invs.reduce((s, i) => s + part(i), 0));
    const expenses = round2(db.expenses.filter((e) => e.jobId === j.id).reduce((s, e) => s + (Number(e.amount) || 0), 0));
    const laborCost = round2(labor[j.id] || 0); const costs = round2(expenses + laborCost);
    const profit = round2(revenue - costs);
    return { id: j.id, number: j.number, title: j.title, client: (findClient(j.clientId) || {}).name || '', date: String(j.date || j.createdAt || '').slice(0, 10), status: j.status, category, invoices: invs.length, revenue, expenses, labor: laborCost, costs, profit, margin: revenue ? Math.round(profit / revenue * 1000) / 10 : null };
  }).filter((j) => j && (j.revenue || j.costs)).sort((a, b) => b.date.localeCompare(a.date));
}
// unpaid invoices by how long past due, as of today; want: only invoices whose main category it is
function receivablesAging(want = null) {
  const today = iso(new Date()); const BUCKETS = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90']; const zero = () => Object.fromEntries(BUCKETS.map((b) => [b, 0]));
  const bucket = (days) => (days <= 0 ? 'current' : days <= 30 ? 'd1_30' : days <= 60 ? 'd31_60' : days <= 90 ? 'd61_90' : 'd90');
  const invoices = []; const byClient = {}; const totals = zero();
  for (const inv of db.invoices) {
    if (inv.status === 'draft' || inv.status === 'paid' || !catIs(mainCat([inv]), want)) continue;
    const { balanceDue } = invoiceCredits(inv); if (balanceDue <= 0) continue;
    const days = inv.dueDate ? Math.floor((Date.parse(today) - Date.parse(inv.dueDate)) / 864e5) : 0; const b = bucket(days);
    const c = findClient(inv.clientId) || {}; const row = byClient[inv.clientId] || (byClient[inv.clientId] = { clientId: inv.clientId, client: c.name || 'Unknown client', ...zero(), total: 0 });
    row[b] += balanceDue; row.total += balanceDue; totals[b] += balanceDue;
    invoices.push({ id: inv.id, number: inv.number, client: c.name || '', issueDate: inv.issueDate, dueDate: inv.dueDate, daysOverdue: Math.max(0, days), bucket: b, balance: balanceDue, total: inv.total });
  }
  const r2 = (o) => { BUCKETS.concat('total').forEach((k) => { if (k in o) o[k] = round2(o[k]); }); return o; };
  return { asOf: today, buckets: BUCKETS, totals: r2({ ...totals, total: BUCKETS.reduce((s, b) => s + totals[b], 0) }), clients: Object.values(byClient).map(r2).sort((a, b) => b.total - a.total), invoices: invoices.sort((a, b) => b.daysOverdue - a.daysOverdue) };
}
const reportRange = (req) => {
  const today = iso(new Date()); const from = validDay(req.query.from) ? req.query.from : `${today.slice(0, 4)}-01-01`; const to = validDay(req.query.to) ? req.query.to : today;
  return from <= to ? [from, to] : [to, from];
};
app.get('/api/reports/profit-loss', (req, res) => { const [from, to] = reportRange(req); res.json(profitLoss(from, to, req.query.basis === 'accrual' ? 'accrual' : 'cash', wantCat(req))); });
app.get('/api/reports/jobs', (req, res) => { const [from, to] = reportRange(req); res.json({ from, to, jobs: jobProfit(from, to, wantCat(req)) }); });
app.get('/api/reports/aging', (req, res) => res.json(receivablesAging(wantCat(req))));

// ---------- Reports → every list report (GET /api/reports/list/<key>?from=&to=) ----------
// Each report is { columns, rows, stats, note, dated }. A column is { k, l (label), t: text|money|num|hrs|date|pct, sum (total it) };
// a row's "<k>$" is a link for that column (the app links it, the CSV leaves it out). dated: the from/to dates apply.
const cName = (id) => (findClient(id) || {}).name || '';
const staffName = (id) => (db.staff.find((s) => s.id === id) || {}).name || '';
const day = (d) => String(d || '').slice(0, 10);
const titleCase = (s) => String(s || '').replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const PAY_NAMES = { cash: 'Cash', check: 'Check', card: 'Credit/debit card', bank: 'Bank payment', zelle: 'Zelle', cashapp: 'Cash App', paypal: 'PayPal', venmo: 'Venmo', stripe: 'Online card (Stripe)', demo: 'Demo checkout', drawn: 'Client credit', other: 'Other', manual: 'Other' };
const payName = (m) => PAY_NAMES[m] || (m ? titleCase(m) : 'Other');
const invLink = (i) => '/invoices/view?id=' + i.id; const jobLink = (j) => '/jobs/edit?id=' + j.id; const qLink = (q) => '/quotes/edit?id=' + q.id; const clientLink = (id) => '/clients/view?id=' + id;
const jobHours = (j) => { const t = (s) => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? +m[1] + m[2] / 60 : null; }; const a = t(j.startTime); const b = t(j.endTime); return a !== null && b !== null && b > a ? b - a : 0; };
const isWon = (q) => !!q.signedAt || ['approved', 'converted'].includes(q.status);
const pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : null);
const nOf = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// where a client came from: a referral link, else their first request's source (online booking, business page, a social post), else added by the business
function leadSource(c) {
  if (c.referredBy) return 'Referral';
  const r = (db.requests || []).filter((x) => x.clientId === c.id).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0];
  if (r && r.fromPost) return 'Social post';
  if (r && r.source === 'booking') return r.site ? 'Website booking' : 'Online booking';
  if (r && r.source === 'business page') return 'Business page';
  if (r && r.referredBy) return 'Referral';
  return 'Added by you';
}
// paid money in each client's name (payments and deposits less refunds), optionally within dates
function paidByClient(from, to) { const out = {}; for (const m of cashMoves()) if (!from || inRange(m.date, from, to)) out[m.doc.clientId] = (out[m.doc.clientId] || 0) + m.amount; return out; }
function freqText(rule) {
  if (!rule) return ''; const n = Number(rule.every) || 1; const unit = { day: 'day', week: 'week', month: 'month' }[rule.freq] || rule.freq;
  const D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`) + (rule.freq === 'week' && (rule.days || []).length ? ' on ' + rule.days.map((d) => D[d]).join(', ') : '');
}
const rMoney = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const weekStart = (d) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - x.getUTCDay()); return x.toISOString().slice(0, 10); };
// a bar chart's buckets (days, weeks or months by how long the dates are); series: [{ name, pts: [[date, value]] }]; money: the values are dollars
function chartOf(from, to, series, money = true) {
  const all = series.flatMap((x) => x.pts.map((p) => p[0])).filter(Boolean).sort(); if (!all.length) return null;
  const today = iso(new Date()); const a = from > '1000' ? from : all[0]; const b = to < '9000' ? to : (all[all.length - 1] > today ? all[all.length - 1] : today);
  const days = (Date.parse(b) - Date.parse(a)) / 864e5; const unit = days <= 31 ? 'day' : days <= 200 ? 'week' : 'month';
  const keyOf = (d) => (unit === 'month' ? d.slice(0, 7) : unit === 'day' ? d : weekStart(d));
  const keys = []; const cur = new Date((unit === 'week' ? weekStart(a) : unit === 'month' ? a.slice(0, 7) + '-01' : a) + 'T12:00:00Z'); const end = new Date(b + 'T12:00:00Z');
  while (cur <= end && keys.length < 400) { keys.push(keyOf(cur.toISOString().slice(0, 10))); if (unit === 'day') cur.setUTCDate(cur.getUTCDate() + 1); else if (unit === 'week') cur.setUTCDate(cur.getUTCDate() + 7); else cur.setUTCMonth(cur.getUTCMonth() + 1); }
  return { unit, money, labels: keys, series: series.map((x) => { const m = {}; x.pts.forEach(([d, v]) => { if (d) { const k = keyOf(d); m[k] = (m[k] || 0) + v; } }); return { name: x.name, total: round2(x.pts.reduce((t, p) => t + p[1], 0)), values: keys.map((k) => round2(m[k] || 0)) }; }) };
}
// a side card: each status (or method, category) with how many and how much
function breakdown(title, rows, key, amt, fmt = 'money') { const by = {}; rows.forEach((r) => { const k = r[key] || '—'; const o = by[k] || (by[k] = { l: k, n: 0, v: 0 }); o.n++; o.v += amt ? Number(r[amt]) || 0 : 0; });
  return { title, fmt: amt ? fmt : '', rows: Object.values(by).map((o) => ({ ...o, v: round2(o.v) })).sort((a, b) => b.v - a.v || b.n - a.n) }; }
const REPORTS = {
  transactions(from, to) {
    const rows = [];
    for (const m of cashMoves()) {
      if (!inRange(m.date, from, to)) continue; const d = m.doc; const isQ = m.kind === 'quote';
      const pay = isQ ? null : (d.payments || []).find((p) => day(p.date) === m.date && Math.abs((Number(p.amount) || 0) - m.amount) < 0.01);
      const method = isQ ? d.depositMethod : pay ? pay.method : d.paidMethod || '';
      rows.push({ date: m.date, type: m.amount < 0 ? 'Refund' : isQ ? 'Deposit' : 'Payment', client: cName(d.clientId), 'client$': clientLink(d.clientId), doc: d.number, 'doc$': isQ ? qLink(d) : invLink(d),
        method: payName(method), reference: (pay && pay.reference) || (isQ ? d.depositReference : '') || '', tip: round2(Number(pay && pay.tip) || 0), amount: m.amount });
    }
    rows.sort((a, b) => b.date.localeCompare(a.date));
    const inn = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0); const out = -rows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0);
    return { dated: true, rows, chart: chartOf(from, to, [{ name: 'Money in', pts: rows.filter((r) => r.amount > 0).map((r) => [r.date, r.amount]) }, { name: 'Refunds', pts: rows.filter((r) => r.amount < 0).map((r) => [r.date, -r.amount]) }]), side: breakdown('By method', rows, 'method', 'amount'), stats: [['Money in', rMoney(inn), nOf(rows.filter((r) => r.amount > 0).length, 'payment or deposit', 'payments and deposits')], ['Refunds', rMoney(out)], ['Net received', rMoney(inn - out)]],
      columns: [{ k: 'date', l: 'Date', t: 'date' }, { k: 'type', l: 'Type' }, { k: 'client', l: 'Client' }, { k: 'doc', l: 'Invoice / quote' }, { k: 'method', l: 'Method' }, { k: 'reference', l: 'Reference' }, { k: 'tip', l: 'Tip', t: 'money', sum: 1 }, { k: 'amount', l: 'Amount', t: 'money', sum: 1 }],
      note: 'Every payment on an invoice, every quote deposit, and refunds (as minus amounts), by the date they were made. Amounts include sales tax.' };
  },
  invoices(from, to) {
    const rows = db.invoices.filter((i) => inRange(i.issueDate || i.createdAt, from, to)).map((i) => { const c = invoiceCredits(i);
      return { number: i.number, 'number$': invLink(i), client: cName(i.clientId), 'client$': clientLink(i.clientId), subject: i.subject || '', issued: day(i.issueDate || i.createdAt), due: day(i.dueDate), status: titleCase(invoiceStatus(i)),
        subtotal: round2(Number(i.subtotal) || 0), discount: round2(Number(i.discount) || 0), tax: round2(Number(i.tax) || 0), total: round2(Number(i.total) || 0), paid: i.status === 'draft' ? 0 : round2((Number(i.total) || 0) - c.balanceDue), balance: i.status === 'draft' ? 0 : c.balanceDue }; })
      .sort((a, b) => b.issued.localeCompare(a.issued));
    const live = rows.filter((r) => r.status !== 'Draft'); const s = (k) => live.reduce((a, r) => a + r[k], 0);
    return { dated: true, rows, chart: chartOf(from, to, [{ name: 'Invoices issued', pts: live.map((r) => [r.issued, r.total]) }, { name: 'Payments collected', pts: cashMoves().filter((m) => m.kind === 'invoice' && inRange(m.date, from, to)).map((m) => [m.date, m.amount]) }]), side: breakdown('Status overview', rows, 'status', 'total'), stats: [['Invoiced', rMoney(s('total')), nOf(live.length, 'invoice', 'invoices') + ' (drafts left out)'], ['Paid', rMoney(s('paid'))], ['Still owed', rMoney(s('balance')), live.filter((r) => r.status === 'Overdue').length + ' overdue']],
      columns: [{ k: 'number', l: 'Invoice' }, { k: 'client', l: 'Client' }, { k: 'subject', l: 'Subject' }, { k: 'issued', l: 'Issued', t: 'date' }, { k: 'due', l: 'Due', t: 'date' }, { k: 'status', l: 'Status' },
        { k: 'subtotal', l: 'Subtotal', t: 'money', sum: 1 }, { k: 'discount', l: 'Discount', t: 'money', sum: 1 }, { k: 'tax', l: 'Tax', t: 'money', sum: 1 }, { k: 'total', l: 'Total', t: 'money', sum: 1 }, { k: 'paid', l: 'Paid', t: 'money', sum: 1 }, { k: 'balance', l: 'Balance', t: 'money', sum: 1 }],
      note: 'Invoices by issue date. Paid includes a quote deposit credited to the invoice.' };
  },
  projected() {
    const today = iso(new Date()); const in30 = iso(new Date(Date.now() + 30 * 864e5)); const rows = [];
    for (const i of db.invoices) { if (i.status === 'draft' || i.status === 'paid') continue; const bal = invoiceCredits(i).balanceDue; if (bal <= 0) continue;
      const due = day(i.dueDate); rows.push({ due, when: !due || due <= today ? (due < today ? 'Overdue' : 'Due today') : due <= in30 ? 'Next 30 days' : 'Later', number: i.number, 'number$': invLink(i), client: cName(i.clientId), 'client$': clientLink(i.clientId), issued: day(i.issueDate), total: round2(Number(i.total) || 0), balance: bal }); }
    rows.sort((a, b) => (a.due || '9').localeCompare(b.due || '9')); const s = (f) => rows.filter(f).reduce((a, r) => a + r.balance, 0);
    return { rows, side: breakdown('When', rows, 'when', 'balance'), stats: [['Awaiting payment', rMoney(s(() => true)), nOf(rows.length, 'invoice', 'invoices')], ['Overdue', rMoney(s((r) => r.when === 'Overdue'))], ['Due in the next 30 days', rMoney(s((r) => r.when === 'Due today' || r.when === 'Next 30 days'))], ['Due later', rMoney(s((r) => r.when === 'Later'))]],
      columns: [{ k: 'due', l: 'Due', t: 'date' }, { k: 'when', l: 'When' }, { k: 'number', l: 'Invoice' }, { k: 'client', l: 'Client' }, { k: 'issued', l: 'Issued', t: 'date' }, { k: 'total', l: 'Invoice total', t: 'money', sum: 1 }, { k: 'balance', l: 'Expected', t: 'money', sum: 1 }],
      note: 'Money you can expect from invoices that have been sent and not paid in full, by due date.' };
  },
  balances() {
    const by = {}; const paid = paidByClient(); const last = {};
    for (const m of cashMoves()) if (m.amount > 0 && (!last[m.doc.clientId] || m.date > last[m.doc.clientId])) last[m.doc.clientId] = m.date;
    for (const i of db.invoices) { if (i.status === 'draft') continue; const r = by[i.clientId] || (by[i.clientId] = { client: cName(i.clientId), 'client$': clientLink(i.clientId), invoices: 0, invoiced: 0, balance: 0, unpaid: 0 });
      r.invoices++; r.invoiced += Number(i.total) || 0; const b = invoiceCredits(i).balanceDue; r.balance += b; if (b > 0) r.unpaid++; }
    const rows = Object.entries(by).map(([id, r]) => ({ ...r, invoiced: round2(r.invoiced), paid: round2(paid[id] || 0), balance: round2(r.balance), last: last[id] || '' })).sort((a, b) => b.balance - a.balance || a.client.localeCompare(b.client));
    return { rows, stats: [['Clients owing', rows.filter((r) => r.balance > 0).length], ['Total owed', rMoney(rows.reduce((s, r) => s + r.balance, 0))], ['Total paid to date', rMoney(rows.reduce((s, r) => s + r.paid, 0))]],
      columns: [{ k: 'client', l: 'Client' }, { k: 'invoices', l: 'Invoices', t: 'num', sum: 1 }, { k: 'unpaid', l: 'Unpaid', t: 'num', sum: 1 }, { k: 'invoiced', l: 'Invoiced', t: 'money', sum: 1 }, { k: 'paid', l: 'Paid', t: 'money', sum: 1 }, { k: 'balance', l: 'Balance', t: 'money', sum: 1 }, { k: 'last', l: 'Last payment', t: 'date' }],
      note: 'Every client with an invoice: what they’ve been invoiced, paid (deposits included, refunds taken off) and still owe, as of today.' };
  },
  visits(from, to) { return jobRows(db.jobs.filter((j) => inRange(j.date || j.createdAt, from, to)), 'Every job and visit by its scheduled date, including each visit of a repeating job.', from, to); },
  oneoff(from, to) { return jobRows(db.jobs.filter((j) => !j.seriesId && inRange(j.date || j.createdAt, from, to)), 'Jobs that don’t repeat, by scheduled date.', from, to); },
  recurring(from, to) {
    const today = iso(new Date());
    const rows = (db.jobSeries || []).map((s) => { const all = db.jobs.filter((j) => j.seriesId === s.id).sort((a, b) => String(a.date).localeCompare(String(b.date))); if (!all.length) return null;
      const inR = all.filter((j) => inRange(j.date, from, to)); const first = all[0]; const next = all.find((j) => j.date >= today && j.status === 'scheduled');
      const invoiced = round2(inR.reduce((sum, j) => sum + jobInvoices(j).filter((i) => !(i.jobIds || []).length).reduce((a, i) => a + (Number(i.subtotal) || 0) - (Number(i.discount) || 0), 0), 0));
      return { title: first.title || 'Job', 'title$': jobLink(next || all[all.length - 1]), client: cName(first.clientId), 'client$': clientLink(first.clientId), repeats: freqText(s.rule), started: day(s.start || first.date), status: s.ended || !next ? 'Ended' : 'Active',
        visits: inR.length, completed: inR.filter((j) => j.status === 'completed').length, next: next ? next.date : '', team: [...new Set(all.flatMap((j) => j.staffIds || []))].map(staffName).filter(Boolean).join(', '), invoiced }; }).filter(Boolean)
      .sort((a, b) => (a.status === b.status ? a.client.localeCompare(b.client) : a.status === 'Active' ? -1 : 1));
    return { dated: true, rows, stats: [['Repeating jobs', rows.length, rows.filter((r) => r.status === 'Active').length + ' active'], ['Visits in these dates', rows.reduce((s, r) => s + r.visits, 0)], ['Invoiced', rMoney(rows.reduce((s, r) => s + r.invoiced, 0)), 'Before sales tax']],
      columns: [{ k: 'title', l: 'Job' }, { k: 'client', l: 'Client' }, { k: 'repeats', l: 'Repeats' }, { k: 'started', l: 'Started', t: 'date' }, { k: 'status', l: 'Status' }, { k: 'visits', l: 'Visits', t: 'num', sum: 1 }, { k: 'completed', l: 'Completed', t: 'num', sum: 1 }, { k: 'next', l: 'Next visit', t: 'date' }, { k: 'team', l: 'Team' }, { k: 'invoiced', l: 'Invoiced', t: 'money', sum: 1 }],
      note: 'Each repeating job (service plans included). Visits, completed and invoiced count the visits in these dates.' };
  },
  requests(from, to) {
    const rows = (db.requests || []).filter((r) => inRange(r.createdAt, from, to)).map((r) => ({ date: day(r.createdAt), client: cName(r.clientId), 'client$': clientLink(r.clientId), title: r.title || '', source: r.referredBy ? 'Referral' : r.fromPost ? 'Social post' : { booking: 'Online booking', 'business page': 'Business page', business: 'Taken by you', portal: 'Client portal' }[r.source] || titleCase(r.source || 'Client portal'),
      status: titleCase(r.status), preferred: day(r.preferredDate), address: r.address || '' })).sort((a, b) => b.date.localeCompare(a.date));
    return { dated: true, rows, chart: chartOf(from, to, [{ name: 'Requests', pts: rows.map((r) => [r.date, 1]) }], false), side: breakdown('Came from', rows, 'source'), stats: [['Requests', rows.length], ['New', rows.filter((r) => r.status === 'New').length, 'Not answered yet']],
      columns: [{ k: 'date', l: 'Received', t: 'date' }, { k: 'client', l: 'Client' }, { k: 'title', l: 'Request' }, { k: 'source', l: 'Came from' }, { k: 'status', l: 'Status' }, { k: 'preferred', l: 'Preferred date', t: 'date' }, { k: 'address', l: 'Address' }],
      note: 'Work requests from online booking, the client portal, referrals, your business page, and ones you took down yourself.' };
  },
  quotes(from, to) {
    const rows = db.quotes.filter((q) => inRange(q.createdAt, from, to)).map((q) => ({ number: q.number, 'number$': qLink(q), client: cName(q.clientId), 'client$': clientLink(q.clientId), title: q.title || '', created: day(q.createdAt), status: titleCase(q.status), approved: day(q.signedAt),
      subtotal: round2(Number(q.subtotal) || 0), total: round2(Number(q.total) || 0), deposit: round2(Number(q.depositFee) || 0), depositPaid: q.depositPaidAt ? round2(Number(q.depositPaidAmount ?? q.depositFee) || 0) : 0,
      job: (db.jobs.find((j) => j.quoteId === q.id) || {}).number || '', won: isWon(q) })).sort((a, b) => b.created.localeCompare(a.created));
    const sent = rows.filter((r) => r.status !== 'Draft'); const won = rows.filter((r) => r.won);
    const wonPts = db.quotes.filter((q) => isWon(q) && inRange(q.signedAt || q.createdAt, from, to)).map((q) => [day(q.signedAt || q.createdAt), Number(q.total) || 0]); rows.forEach((r) => delete r.won);
    return { dated: true, rows, chart: chartOf(from, to, [{ name: 'Quoted', pts: sent.map((r) => [r.created, r.total]) }, { name: 'Approved', pts: wonPts }]), side: breakdown('Status overview', rows, 'status', 'total'), stats: [['Quotes', rows.length, rMoney(sent.reduce((s, r) => s + r.total, 0)) + ' quoted (drafts left out)'], ['Approved', won.length, rMoney(won.reduce((s, r) => s + r.total, 0))], ['Approval rate', sent.length ? pct(won.length, sent.length) + '%' : '—', 'Of quotes sent']],
      columns: [{ k: 'number', l: 'Quote' }, { k: 'client', l: 'Client' }, { k: 'title', l: 'Title' }, { k: 'created', l: 'Created', t: 'date' }, { k: 'status', l: 'Status' }, { k: 'approved', l: 'Approved', t: 'date' },
        { k: 'subtotal', l: 'Subtotal', t: 'money', sum: 1 }, { k: 'total', l: 'Total', t: 'money', sum: 1 }, { k: 'deposit', l: 'Deposit asked', t: 'money', sum: 1 }, { k: 'depositPaid', l: 'Deposit paid', t: 'money', sum: 1 }, { k: 'job', l: 'Job' }],
      note: 'Quotes by the date they were made. Totals are the chosen option’s (or the recommended one’s until the client picks).' };
  },
  productivity(from, to) {
    const logged = {}; if (tenancy.has('timesheets')) for (const e of timeList()) if (e.end && inRange(e.start, from, to)) logged[e.staffId] = (logged[e.staffId] || 0) + entryHours(e);
    const rows = db.staff.map((s) => { const J = db.jobs.filter((j) => (j.staffIds || []).includes(s.id) && j.status !== 'cancelled' && inRange(j.date, from, to)); const done = J.filter((j) => j.status === 'completed');
      // a completed job's invoiced amount (before tax) is shared equally by its team
      const revenue = done.reduce((sum, j) => sum + jobInvoices(j).filter((i) => !(i.jobIds || []).length).reduce((a, i) => a + (Number(i.subtotal) || 0) - (Number(i.discount) || 0), 0) / Math.max(1, (j.staffIds || []).length), 0);
      return { name: s.name, role: s.role || '', jobs: J.length, completed: done.length, scheduled: Math.round(J.reduce((a, j) => a + jobHours(j), 0) * 100) / 100, logged: Math.round((logged[s.id] || 0) * 100) / 100, revenue: round2(revenue), perHour: logged[s.id] ? round2(revenue / logged[s.id]) : 0 }; })
      .sort((a, b) => b.revenue - a.revenue || b.jobs - a.jobs);
    const cols = [{ k: 'name', l: 'Team member' }, { k: 'role', l: 'Role' }, { k: 'jobs', l: 'Jobs & visits', t: 'num', sum: 1 }, { k: 'completed', l: 'Completed', t: 'num', sum: 1 }, { k: 'scheduled', l: 'Scheduled hours', t: 'hrs', sum: 1 }];
    if (tenancy.has('timesheets')) cols.push({ k: 'logged', l: 'Hours logged', t: 'hrs', sum: 1 });
    cols.push({ k: 'revenue', l: 'Revenue', t: 'money', sum: 1 }); if (tenancy.has('timesheets')) cols.push({ k: 'perHour', l: 'Revenue per hour', t: 'money' });
    return { dated: true, rows, columns: cols, stats: [['Jobs & visits', rows.reduce((s, r) => s + r.jobs, 0)], ['Completed', rows.reduce((s, r) => s + r.completed, 0)], ['Revenue from completed work', rMoney(rows.reduce((s, r) => s + r.revenue, 0)), 'Before sales tax']],
      note: `Each team member’s jobs and visits in these dates (cancelled ones left out). Scheduled hours come from each job’s start and end times.${tenancy.has('timesheets') ? ' Hours logged are their Timesheets entries.' : ''} Revenue is what completed jobs were invoiced (before tax), shared equally by the people on the job.` };
  },
  products(from, to) {
    const by = {}; const row = (name, cat) => { const k = String(name || 'Other').trim().toLowerCase(); return by[k] || (by[k] = { name: String(name || 'Other').trim(), category: cat || '', quoted: 0, quotedAmt: 0, jobQty: 0, sold: 0, soldAmt: 0 }); };
    for (const q of db.quotes) { if (q.status === 'draft' || !inRange(q.createdAt, from, to)) continue; const cats = lineCats(q); (q.items || []).forEach((i, k) => { const r = row(i.desc, cats[k]); r.quoted += Number(i.qty) || 0; r.quotedAmt += lineAmt(i); }); }
    for (const j of db.jobs) { if (j.status === 'cancelled' || !inRange(j.date, from, to)) continue; const cats = lineCats(j); (j.items || []).forEach((i, k) => { row(i.desc, cats[k]).jobQty += Number(i.qty) || 0; }); }
    for (const v of db.invoices) { if (v.status === 'draft' || !inRange(v.issueDate || v.createdAt, from, to)) continue; const cats = lineCats(v); (v.items || []).forEach((i, k) => { if (i.lateFee) return; const r = row(i.desc, cats[k]); r.sold += Number(i.qty) || 0; r.soldAmt += lineAmt(i); }); }
    const rows = Object.values(by).map((r) => ({ ...r, quotedAmt: round2(r.quotedAmt), soldAmt: round2(r.soldAmt), avg: r.sold ? round2(r.soldAmt / r.sold) : 0 })).sort((a, b) => b.soldAmt - a.soldAmt || b.quotedAmt - a.quotedAmt);
    return { dated: true, rows, stats: [['Items used', rows.length], ['Invoiced', rMoney(rows.reduce((s, r) => s + r.soldAmt, 0)), 'Before discounts and tax'], ['Quoted', rMoney(rows.reduce((s, r) => s + r.quotedAmt, 0))]],
      columns: [{ k: 'name', l: 'Product / service' }, { k: 'category', l: 'Category' }, { k: 'quoted', l: 'Qty quoted', t: 'num', sum: 1 }, { k: 'quotedAmt', l: 'Quoted', t: 'money', sum: 1 }, { k: 'jobQty', l: 'Qty on jobs', t: 'num', sum: 1 }, { k: 'sold', l: 'Qty invoiced', t: 'num', sum: 1 }, { k: 'soldAmt', l: 'Invoiced', t: 'money', sum: 1 }, { k: 'avg', l: 'Avg price', t: 'money' }],
      note: 'Every line on quotes (by date made), jobs (by scheduled date) and invoices (by issue date), grouped by name. Drafts, cancelled jobs and late fees are left out.' };
  },
  timesheets(from, to) {
    const time = (s) => { const d = new Date(s); return isNaN(d) ? '' : d.toISOString(); };
    const rows = timeList().filter((e) => inRange(e.start, from, to)).map((e) => { const j = e.jobId && db.jobs.find((x) => x.id === e.jobId);
      return { date: day(e.start), name: staffName(e.staffId) || 'Former team member', job: j ? `${j.number} ${j.title || ''}`.trim() : '', ...(j ? { 'job$': jobLink(j) } : {}), client: j ? cName(j.clientId) : '', start: time(e.start), end: e.end ? time(e.end) : '', hours: Math.round(entryHours(e) * 100) / 100, approved: e.approvedAt ? 'Yes' : 'No', note: e.note || '' }; })
      .sort((a, b) => b.start.localeCompare(a.start));
    return { dated: true, rows, chart: chartOf(from, to, [{ name: 'Hours', pts: rows.map((r) => [r.date, r.hours]) }], false), side: breakdown('By team member', rows, 'name', 'hours', 'hrs'), stats: [['Hours logged', (Math.round(rows.reduce((s, r) => s + r.hours, 0) * 10) / 10) + ' h', nOf(rows.length, 'entry', 'entries')], ['Waiting for approval', rows.filter((r) => r.approved === 'No').length]],
      columns: [{ k: 'date', l: 'Date', t: 'date' }, { k: 'name', l: 'Team member' }, { k: 'job', l: 'Job' }, { k: 'client', l: 'Client' }, { k: 'start', l: 'Start', t: 'time' }, { k: 'end', l: 'End', t: 'time' }, { k: 'hours', l: 'Hours', t: 'hrs', sum: 1 }, { k: 'approved', l: 'Approved' }, { k: 'note', l: 'Note' }],
      note: 'Every time entry from Timesheets that started in these dates. An entry still on the clock counts up to now.' };
  },
  clients(from, to) {
    const paid = paidByClient(); const owed = {}; for (const i of db.invoices) if (i.status !== 'draft') owed[i.clientId] = (owed[i.clientId] || 0) + invoiceCredits(i).balanceDue;
    const rows = db.clients.filter((c) => inRange(c.createdAt, from, to)).map((c) => ({ name: c.name, 'name$': clientLink(c.id), company: c.company || '', source: leadSource(c), created: day(c.createdAt), tags: (c.tags || []).join(', '),
      jobs: db.jobs.filter((j) => j.clientId === c.id && j.status !== 'cancelled').length, paid: round2(paid[c.id] || 0), balance: round2(owed[c.id] || 0) })).sort((a, b) => b.created.localeCompare(a.created) || a.name.localeCompare(b.name));
    return { dated: true, rows, chart: chartOf(from, to, [{ name: 'New clients', pts: rows.map((r) => [r.created, 1]) }], false), side: breakdown('Lead source', rows, 'source'), stats: [['Clients added', rows.length], ['Paid to date', rMoney(rows.reduce((s, r) => s + r.paid, 0)), 'By these clients']],
      columns: [{ k: 'name', l: 'Client' }, { k: 'company', l: 'Company' }, { k: 'source', l: 'Lead source' }, { k: 'created', l: 'Added', t: 'date' }, { k: 'tags', l: 'Tags' }, { k: 'jobs', l: 'Jobs', t: 'num', sum: 1 }, { k: 'paid', l: 'Paid to date', t: 'money', sum: 1 }, { k: 'balance', l: 'Owes', t: 'money', sum: 1 }],
      note: 'Clients added in these dates, with where they came from. Pick “All time” for every client.' };
  },
  leadsource(from, to) {
    const by = {}; const src = {}; db.clients.forEach((c) => { src[c.id] = leadSource(c); });
    const row = (s) => by[s] || (by[s] = { source: s, clients: 0, requests: 0, quotes: 0, won: 0, jobs: 0, revenue: 0 });
    for (const c of db.clients) if (inRange(c.createdAt, from, to)) row(src[c.id]).clients++;
    for (const r of db.requests || []) if (src[r.clientId] && inRange(r.createdAt, from, to)) row(src[r.clientId]).requests++;
    for (const q of db.quotes) if (src[q.clientId] && q.status !== 'draft' && inRange(q.createdAt, from, to)) { const r = row(src[q.clientId]); r.quotes++; if (isWon(q)) r.won++; }
    for (const j of db.jobs) if (src[j.clientId] && j.status !== 'cancelled' && inRange(j.date, from, to)) row(src[j.clientId]).jobs++;
    for (const m of cashMoves()) if (src[m.doc.clientId] && inRange(m.date, from, to)) row(src[m.doc.clientId]).revenue += m.amount;
    const rows = Object.values(by).map((r) => ({ ...r, revenue: round2(r.revenue), rate: r.quotes ? pct(r.won, r.quotes) : null })).sort((a, b) => b.revenue - a.revenue || b.clients - a.clients);
    return { dated: true, rows, side: { title: 'Revenue by lead source', fmt: 'money', rows: rows.map((r) => ({ l: r.source, n: r.clients, v: r.revenue })) }, stats: [['Revenue', rMoney(rows.reduce((s, r) => s + r.revenue, 0)), 'Received in these dates'], ['New clients', rows.reduce((s, r) => s + r.clients, 0)]],
      columns: [{ k: 'source', l: 'Lead source' }, { k: 'clients', l: 'New clients', t: 'num', sum: 1 }, { k: 'requests', l: 'Requests', t: 'num', sum: 1 }, { k: 'quotes', l: 'Quotes', t: 'num', sum: 1 }, { k: 'won', l: 'Approved', t: 'num', sum: 1 }, { k: 'rate', l: 'Approval rate', t: 'pct' }, { k: 'jobs', l: 'Jobs & visits', t: 'num', sum: 1 }, { k: 'revenue', l: 'Revenue', t: 'money', sum: 1 }],
      note: 'A client’s lead source is a referral link, else where their first request came from (online booking, your business page, a social post), else “Added by you”. Revenue is money received in these dates (tax included).' };
  },
  communications(from, to) {
    const rows = (db.notifications || []).filter((n) => inRange(n.at, from, to)).map((n) => ({ at: n.at, client: n.clientName || cName(n.clientId), ...(n.clientId ? { 'client$': clientLink(n.clientId) } : {}), channel: n.channel === 'sms' ? 'Text' : titleCase(n.channel), kind: titleCase(n.kind), ref: n.refNumber || '', to: n.to || '', subject: n.subject || (n.body || '').slice(0, 80), status: titleCase(n.status) }))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return { dated: true, rows, chart: chartOf(from, to, [{ name: 'Messages', pts: rows.map((r) => [day(r.at), 1]) }], false), side: breakdown('About', rows, 'kind'), stats: [['Messages', rows.length], ['Emails', rows.filter((r) => r.channel === 'Email').length], ['Texts', rows.filter((r) => r.channel === 'Text').length], ['Failed', rows.filter((r) => r.status === 'Failed').length]],
      columns: [{ k: 'at', l: 'Sent', t: 'time' }, { k: 'client', l: 'Client' }, { k: 'channel', l: 'Channel' }, { k: 'kind', l: 'About' }, { k: 'ref', l: 'Number' }, { k: 'to', l: 'To' }, { k: 'subject', l: 'Subject' }, { k: 'status', l: 'Status' }],
      note: 'Every email and text Worklio Pro sent for you, to clients and to your team. The Notifications Log shows each message in full.' };
  },
  contacts() {
    const rows = db.clients.map((c) => ({ name: c.name, 'name$': clientLink(c.id), company: c.company || '', email: c.email || '', phone: c.phone || '', address: c.address || '', texts: c.smsConsent ? 'Yes' : 'No', portal: c.portalToken ? 'Yes' : 'No' })).sort((a, b) => a.name.localeCompare(b.name));
    return { rows, stats: [['Clients', rows.length], ['With an email', rows.filter((r) => r.email).length], ['Agreed to texts', rows.filter((r) => r.texts === 'Yes').length]],
      columns: [{ k: 'name', l: 'Client' }, { k: 'company', l: 'Company' }, { k: 'email', l: 'Email' }, { k: 'phone', l: 'Phone' }, { k: 'address', l: 'Address' }, { k: 'texts', l: 'Texts OK' }],
      note: 'Every client and how to reach them. Texts OK: the client agreed to get text messages.' };
  },
  properties() {
    const rows = [];
    for (const c of db.clients) { const P = Array.isArray(c.properties) && c.properties.length ? c.properties : String(c.address || '').trim() ? [{ street1: c.address }] : [];
      P.forEach((p) => rows.push({ client: c.name, 'client$': clientLink(c.id), name: p.name || '', street: [p.street1, p.street2].filter(Boolean).join(', '), city: p.city || '', state: p.state || '', zip: p.zip || '', contacts: (p.contacts || []).length,
        jobs: db.jobs.filter((j) => j.clientId === c.id && (p.id ? j.propertyId === p.id : true) && j.status !== 'cancelled').length })); }
    rows.sort((a, b) => a.client.localeCompare(b.client));
    return { rows, stats: [['Properties', rows.length], ['Clients with more than one', new Set(rows.map((r) => r.client)).size < rows.length ? rows.length - new Set(rows.map((r) => r.client)).size : 0, 'Extra properties']],
      columns: [{ k: 'client', l: 'Client' }, { k: 'name', l: 'Property' }, { k: 'street', l: 'Street' }, { k: 'city', l: 'City' }, { k: 'state', l: 'State' }, { k: 'zip', l: 'ZIP' }, { k: 'contacts', l: 'Contacts', t: 'num' }, { k: 'jobs', l: 'Jobs', t: 'num', sum: 1 }],
      note: 'Every client property. A client without properties shows their address.' };
  },
  reengage() {
    const today = iso(new Date()); const yearAgo = iso(new Date(Date.now() - 365 * 864e5)); const paid = paidByClient();
    const rows = db.clients.map((c) => { const J = db.jobs.filter((j) => j.clientId === c.id); const done = J.filter((j) => j.status === 'completed').sort((a, b) => String(b.date).localeCompare(String(a.date)));
      if (!done.length || done[0].date >= yearAgo || J.some((j) => j.status === 'scheduled' && j.date >= today)) return null;
      return { name: c.name, 'name$': clientLink(c.id), email: c.email || '', phone: c.phone || '', last: done[0].date, lastJob: `${done[0].number} ${done[0].title || ''}`.trim(), 'lastJob$': jobLink(done[0]), jobs: done.length, paid: round2(paid[c.id] || 0) }; })
      .filter(Boolean).sort((a, b) => b.paid - a.paid);
    return { rows, stats: [['Clients to win back', rows.length], ['They’ve paid you', rMoney(rows.reduce((s, r) => s + r.paid, 0)), 'In all']],
      columns: [{ k: 'name', l: 'Client' }, { k: 'email', l: 'Email' }, { k: 'phone', l: 'Phone' }, { k: 'last', l: 'Last job', t: 'date' }, { k: 'lastJob', l: 'Job' }, { k: 'jobs', l: 'Jobs done', t: 'num', sum: 1 }, { k: 'paid', l: 'Paid in all', t: 'money', sum: 1 }],
      note: 'Clients you’ve done work for whose last completed job was over 12 months ago, with nothing scheduled. Good people to reach out to.' };
  },
  memberships() {
    const rows = memberships().map((m) => ({ client: cName(m.clientId), 'client$': clientLink(m.clientId), plan: m.name || '', price: round2(Number(m.price) || 0), interval: titleCase(m.interval), start: day(m.start), status: titleCase(m.status), next: m.status === 'active' ? day(m.nextBill) : '', bills: (m.bills || []).length }))
      .sort((a, b) => (a.status === b.status ? a.client.localeCompare(b.client) : a.status === 'Active' ? -1 : 1));
    const act = rows.filter((r) => r.status === 'Active'); const yr = { Month: 12, Quarter: 4, Year: 1 };
    return { rows, side: breakdown('By plan', rows.filter((r) => r.status === 'Active'), 'plan', 'price'), stats: [['Active members', act.length], ['Yearly value', rMoney(act.reduce((s, r) => s + r.price * (yr[r.interval] || 1), 0)), 'Of active plans']],
      columns: [{ k: 'client', l: 'Client' }, { k: 'plan', l: 'Plan' }, { k: 'price', l: 'Price', t: 'money' }, { k: 'interval', l: 'Billed every' }, { k: 'start', l: 'Started', t: 'date' }, { k: 'status', l: 'Status' }, { k: 'next', l: 'Next bill', t: 'date' }, { k: 'bills', l: 'Invoices made', t: 'num', sum: 1 }],
      note: 'Every client on a service plan.' };
  },
  expenses(from, to) {
    const rows = db.expenses.filter((e) => inRange(e.date, from, to)).map((e) => { const j = e.jobId && db.jobs.find((x) => x.id === e.jobId);
      return { date: day(e.date), category: e.category || 'Other', vendor: e.vendor || '', description: e.description || '', job: j ? `${j.number} ${j.title || ''}`.trim() : '', ...(j ? { 'job$': jobLink(j) } : {}), client: j ? cName(j.clientId) : '', amount: round2(Number(e.amount) || 0) }; })
      .sort((a, b) => b.date.localeCompare(a.date));
    const cats = {}; rows.forEach((r) => { cats[r.category] = (cats[r.category] || 0) + r.amount; }); const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
    return { dated: true, rows, chart: chartOf(from, to, [{ name: 'Expenses', pts: rows.map((r) => [r.date, r.amount]) }]), side: breakdown('By category', rows, 'category', 'amount'), stats: [['Expenses', rMoney(rows.reduce((s, r) => s + r.amount, 0)), rows.length + ' logged'], ['On jobs', rMoney(rows.filter((r) => r.job).reduce((s, r) => s + r.amount, 0))], ['Biggest category', top ? top[0] : '—', top ? rMoney(top[1]) : '']],
      columns: [{ k: 'date', l: 'Date', t: 'date' }, { k: 'category', l: 'Category' }, { k: 'vendor', l: 'Vendor' }, { k: 'description', l: 'Description' }, { k: 'job', l: 'Job' }, { k: 'client', l: 'Client' }, { k: 'amount', l: 'Amount', t: 'money', sum: 1 }],
      note: 'Every expense logged in these dates.' };
  },
};
function jobRows(list, note, from, to) {
  const rows = list.map((j) => { const inv = jobInvoices(j); const own = inv.filter((i) => !(i.jobIds || []).length);
    return { date: day(j.date || j.createdAt), time: j.startTime ? j.startTime + (j.endTime ? '–' + j.endTime : '') : 'Anytime', number: j.number, 'number$': jobLink(j), title: j.title || '', client: cName(j.clientId), 'client$': clientLink(j.clientId),
      team: (j.staffIds || []).map(staffName).filter(Boolean).join(', '), status: titleCase(j.status), repeats: j.seriesId ? 'Yes' : 'No', address: j.address || '', total: round2(Number(j.total) || 0),
      invoiced: round2(inv.reduce((s, i) => s + (Number(i.total) || 0) * ((i.jobIds || []).length && !own.includes(i) ? 0 : 1), 0)) }; }).sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time));
  const n = (s) => rows.filter((r) => r.status === s).length;
  return { dated: true, rows, chart: chartOf(from, to, [{ name: 'Jobs & visits', pts: rows.map((r) => [r.date, 1]) }], false), side: breakdown('Status overview', rows, 'status', 'invoiced'), stats: [['Jobs & visits', rows.length], ['Completed', n('Completed')], ['Scheduled', n('Scheduled')], ['Invoiced', rMoney(rows.reduce((s, r) => s + r.invoiced, 0)), 'Invoices made for these jobs']],
    columns: [{ k: 'date', l: 'Date', t: 'date' }, { k: 'time', l: 'Time' }, { k: 'number', l: 'Job' }, { k: 'title', l: 'Title' }, { k: 'client', l: 'Client' }, { k: 'team', l: 'Team' }, { k: 'status', l: 'Status' }, { k: 'repeats', l: 'Repeats' }, { k: 'address', l: 'Address' }, { k: 'total', l: 'Job total', t: 'money', sum: 1 }, { k: 'invoiced', l: 'Invoiced', t: 'money', sum: 1 }],
    note };
}
const REPORT_FEATURE = { quotes: 'quotes', timesheets: 'timesheets', memberships: 'servicePlans', expenses: 'expenses', recurring: 'recurringJobs' };
app.get('/api/reports/list/:key', (req, res) => {
  const fn = Object.prototype.hasOwnProperty.call(REPORTS, req.params.key) && REPORTS[req.params.key]; if (!fn) return res.status(404).json({ error: 'No such report' });
  const f = REPORT_FEATURE[req.params.key]; if (f && !tenancy.has(f)) return res.status(403).json({ error: 'This report isn’t in your plan' });
  const [from, to] = req.query.from === 'all' ? ['0000-01-01', '9999-12-31'] : reportRange(req);
  res.json({ key: req.params.key, from, to, ...fn(from, to) });
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
// a client's work requests (online booking and the client portal), newest first, for their profile page
app.get('/api/clients/:id/requests', (req, res) => res.json((db.requests || []).filter((r) => r.clientId === req.params.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(requestForClient)));
// a request the business takes down itself (a call, a text): from the client's profile or one of their properties
app.post('/api/clients/:id/requests', (req, res) => {
  const c = findClient(req.params.id); if (!c) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {}; const clip = (v, n) => String(v || '').trim().slice(0, n);
  const title = clip(b.title, 120); if (!title) return res.status(400).json({ error: 'Say what the client needs done' });
  db.requests = db.requests || [];
  const r = { id: uid(), clientId: c.id, title, details: clip(b.details, 4000), address: clip(b.address, 300) || c.address || '', propertyId: clip(b.propertyId, 40),
    preferredDate: /^\d{4}-\d{2}-\d{2}$/.test(b.preferredDate || '') ? b.preferredDate : '', preferredTime: ['morning', 'afternoon', 'evening'].includes(b.preferredTime) ? b.preferredTime : 'any',
    status: 'new', source: 'business', createdAt: new Date().toISOString() };
  db.requests.push(r); save(); res.status(201).json(requestForClient(r));
});
// Send Login Email on a client's profile: their client portal link, by email
app.post('/api/clients/:id/portal-email', async (req, res) => {
  const c = findClient(req.params.id); if (!c) return res.status(404).json({ error: 'Not found' });
  if (!c.email) return res.status(400).json({ error: 'Add the client’s email address first' });
  const email = renderEmail('portal', { client_name: c.name, company_name: db.company.name || '', link: `${baseUrl()}/client-portal?c=${c.portalToken}` });
  const r = await notify({ clientId: c.id, channel: 'email', kind: 'portal', refId: c.id, refNumber: '', subject: email.subject, html: email.html, body: email.body });
  save(); if (r.status === 'failed') return res.status(502).json({ error: r.detail || 'The email couldn’t be sent' }); res.json(r);
});
// merge duplicate clients into one profile: move their records over, fill empty details, combine tags and notes
app.post('/api/clients/merge', (req, res) => {
  const keep = findClient(req.body && req.body.keepId);
  const others = [...new Set((req.body && req.body.mergeIds) || [])].filter((id) => id !== (keep && keep.id)).map(findClient).filter(Boolean);
  if (!keep || !others.length) return res.status(400).json({ error: 'Choose a client to keep and at least one to merge into it' });
  const ids = new Set(others.map((c) => c.id));
  for (const col of ['quotes', 'jobs', 'invoices', 'notifications', 'requests', 'tasks', 'clientReviews']) (db[col] || []).forEach((x) => { if (ids.has(x.clientId)) { x.clientId = keep.id; if (col === 'notifications') x.clientName = keep.name; } });
  const tags = (c) => (Array.isArray(c.tags) ? c.tags : String(c.tags || '').split(',')).map((t) => t.trim()).filter(Boolean);
  // properties (older profiles have only an address) and contacts are combined; a property already on the kept profile isn't added twice
  const props = (c) => (Array.isArray(c.properties) ? c.properties : String(c.address || '').trim() ? [{ id: c.id === keep.id ? 'p0' : uid(), name: '', street1: c.address.trim(), street2: '', city: '', state: '', zip: '', country: '', contacts: [] }] : []);
  const addrOf = (p) => [p.street1, p.street2, p.city, [p.state, p.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ').toLowerCase();
  keep.properties = props(keep);
  for (const o of others) for (const p of props(o)) if (!keep.properties.some((k) => addrOf(k) === addrOf(p))) keep.properties.push({ ...p, id: keep.properties.some((k) => k.id === p.id) ? uid() : p.id });
  keep.contacts = [...(keep.contacts || []), ...others.flatMap((o) => o.contacts || [])];
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
  const sec = secrets(); if (sec.stripeAccountId && (!sec.stripeChargesEnabled || sec.stripeAccountType === 'embedded')) await syncStripeAccount(); // e.g. just back from Stripe, or a new payout bank set in the app
  const s = secrets(); const pay = tenancy.has('onlinePayments');
  res.json({
    email: !!emailProvider(), sms: smsReady(), ai: !!process.env.ANTHROPIC_API_KEY,
    serverEmail: !!serverEmailProvider(),
    payments: !!stripeKey(), paymentsMode: stripeKey() ? stripeMode() : null,
    stripe: pay ? {
      available: !!stripeLib.platformKey(), accountId: s.stripeAccountId || null, accountType: s.stripeAccountId ? s.stripeAccountType || 'standard' : null, methods: setupMethods(), bank: s.stripeBank || null, due: s.stripeDue || 0, payoutsEnabled: !!s.stripePayoutsEnabled,
      chargesEnabled: !!s.stripeChargesEnabled, detailsSubmitted: !!s.stripeDetailsSubmitted, name: s.stripeAccountName || '',
      ownKeys: !!s.stripeSecretKey && !connectedAccount(), serverKey: tenancy.isDefault() && !s.stripeSecretKey && !connectedAccount() && !!process.env.STRIPE_SECRET_KEY,
      feePercent: Number(tenancy.platform().settings.platformFeePercent) || 0, // charged only on payments through Connect
    } : null,
  });
});

// ---------- Account Connections: Google Business Profile, Facebook and Instagram (lib/social.js), and Bluesky (lib/bluesky.js) ----------
// The sign-in returns to the platform address, which calls saveConnection inside this account. Tokens stay in the account's secrets.
const SOCIAL_KINDS = ['google', 'facebook', ...Object.keys(networks.NETWORKS)];
const connOf = (kind) => (secrets().social || {})[kind] || null;
function setConnection(kind, conn) {
  const sec = { ...secrets() }; sec.social = { ...(sec.social || {}) }; if (conn) sec.social[kind] = conn; else delete sec.social[kind]; db.secrets = sec; save();
  const t = tenancy.current(); t.social = Object.keys(sec.social); tenancy.savePlatform(); // Alpha shows how many businesses use each connection
}
function saveConnection(kind, conn) {
  const old = connOf(kind); if (kind === 'google' && old && old.booking && old.location === conn.location) conn.booking = true; // reconnecting keeps online booking on
  setConnection(kind, conn);
}
// a refreshed sign-in is saved at once (lib/networks.js, lib/social.js), inside the account whose request or check refreshed it
networks.onRenew(() => save()); social.onRenew(() => save());
// a connection the network has signed out (conn.broken): Account Connections and Marketing show it with a Reconnect button, and the owner is
// emailed once. Connecting again replaces the connection, which clears it; a later call that works clears it too.
const CONN_LABEL = { google: 'Google Business Profile', facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', pinterest: 'Pinterest', threads: 'Threads', tiktok: 'TikTok', youtube: 'YouTube' };
function markBroken(kind, e) {
  const c = connOf(kind); if (!c || !e || !e.reconnect) return;
  if (c.broken) return; c.broken = { at: new Date().toISOString() }; save();
  const name = CONN_LABEL[kind] || kind; const o = db.users.find((x) => x.role === 'owner');
  if (o && o.email) sendTemplate('accountActivity', o.email, { title: `Reconnect ${name}`, message: `${name} has signed Worklio Pro out, so posts can’t go there until it’s connected again. Open Account Connections and click Reconnect next to ${name}, then sign in to ${name}. It takes about a minute, and nothing you’ve posted is lost.`, link: `${baseUrl()}/settings/connections#conn-${kind}` }, { server: true }).catch(() => {});
}
const markWorking = (kind) => { const c = connOf(kind); if (c && c.broken) { delete c.broken; save(); } };
// LinkedIn makes the business sign in again once a year however often the sign-in is renewed: warn the owner two weeks ahead, once
function warnEnding(kind) {
  const c = connOf(kind); if (!c || c.broken || !c.refreshExpiresAt || c.refreshExpiresAt - Date.now() > 14 * 864e5 || c.endWarned === c.refreshExpiresAt) return;
  c.endWarned = c.refreshExpiresAt; save();
  const name = CONN_LABEL[kind] || kind; const o = db.users.find((x) => x.role === 'owner'); const when = new Date(c.refreshExpiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  if (o && o.email) sendTemplate('accountActivity', o.email, { title: `Reconnect ${name} by ${when}`, message: `${name} asks you to sign in again every so often, and your sign-in ends on ${when}. Open Account Connections and click Reconnect next to ${name} before then so posts keep going out.`, link: `${baseUrl()}/settings/connections#conn-${kind}` }, { server: true }).catch(() => {});
}
// a few times a day: renew each account's social sign-ins before they run out, so they last while the business isn't posting
let keepTick = false;
async function keepConnections() {
  if (keepTick) return; keepTick = true;
  try {
    for (const t of tenancy.platform().tenants.filter((x) => x.status === 'active')) { // every account: t.social isn't set on accounts that connected before it was added
      await tenancy.run(t, async () => {
        for (const kind of Object.keys(secrets().social || {})) {
          const c = connOf(kind); if (!c || c.broken || !(kind === 'google' || networks.has(kind))) continue;
          try { if (kind === 'google') { if (c.refreshToken) await social.googleKeepAlive(c); } else await networks.keepAlive(kind, c); }
          catch (e) { if (e.reconnect) markBroken(kind, e); else console.error('keeping connections:', t.slug, kind, e.message); }
          warnEnding(kind);
        }
      }).catch((e) => console.error('keeping connections:', t.slug, e.message));
    }
  } finally { keepTick = false; }
}
const bookingUrl = () => `${baseUrl()}/book`;
function connectionsView() {
  const g = connOf('google'); const f = connOf('facebook'); const bs = connOf('bluesky'); const x = connOf('x');
  const view = {
    google: { available: social.available('google'), connected: !!g, title: g ? g.title : '', address: g ? g.address : '', mapsUrl: g ? g.mapsUrl : '', reviewUrl: g ? g.reviewUrl : '', choices: g ? g.choices || 1 : 0,
      reviews: !!(g && g.reviews !== false), booking: !!(g && g.booking), bookingUrl: bookingUrl(), bookingPlan: tenancy.has('onlineBooking'), reviewsPlan: tenancy.has('reviews') },
    facebook: { available: social.available('facebook'), connected: !!f, name: f ? f.name : '', link: f ? f.link : '', choices: f ? f.choices || 1 : 0 },
    bluesky: { available: social.available('bluesky'), connected: !!bs, handle: bs ? bs.handle : '' }, // the business's own handle and app password: nothing for the platform to set up
    x: { available: social.available('x'), connected: !!x, username: x ? x.username : '', name: x ? x.name : '' }, // the business's own X developer app
    ...Object.fromEntries(Object.keys(networks.NETWORKS).map((k) => { const c = connOf(k); return [k, { available: social.available(k), connected: !!c, name: c ? c.name || '' : '', username: c ? c.username || '' : '', link: c ? c.link || '' : '', choices: c ? c.choices || 1 : 0 }]; })),
    postsPlan: tenancy.has('socialPosts'),
  };
  for (const k of SOCIAL_KINDS) { const c = connOf(k); if (c && view[k]) { view[k].broken = !!c.broken; if (c.refreshExpiresAt && c.refreshExpiresAt - Date.now() < 14 * 864e5) view[k].endsAt = new Date(c.refreshExpiresAt).toISOString(); } }
  return view;
}
const connKind = (req, res) => {
  const kind = req.params.kind; if (!SOCIAL_KINDS.includes(kind)) { res.status(404).json({ error: 'Unknown connection' }); return null; }
  if (!isAdmin(currentUser(req))) { res.status(403).json({ error: 'Only the account owner or an admin can manage connections' }); return null; }
  return kind;
};
// a Google or Meta call failed: the message, and a saved token refresh either way
const connFail = (res, e, kind) => { if (kind) markBroken(kind, e); save(); res.status(e.status || 502).json({ error: e.message, reconnect: !!e.reconnect }); };
app.get('/api/connections', (req, res) => res.json(connectionsView()));
// Bluesky: the handle and an app password, checked by signing in before they're saved
const adminOnly = (req, res) => { if (isAdmin(currentUser(req))) return true; res.status(403).json({ error: 'Only the account owner or an admin can manage connections' }); return false; };
app.post('/api/connections/bluesky', async (req, res) => {
  if (!adminOnly(req, res)) return; if (!social.available('bluesky')) return res.status(503).json({ error: 'This connection isn’t available yet.' }); const b = req.body || {};
  try { setConnection('bluesky', await bluesky.connect(b.handle, b.appPassword)); res.json(connectionsView()); } catch (e) { res.status(e.status || 502).json({ error: e.message }); }
});
app.delete('/api/connections/bluesky', (req, res) => { if (!adminOnly(req, res)) return; setConnection('bluesky', null); res.json(connectionsView()); }); // the business can also revoke the app password in Bluesky
// X: the keys from the business's own X developer app, checked with X before they're saved
app.post('/api/connections/x', async (req, res) => {
  if (!adminOnly(req, res)) return; if (!social.available('x')) return res.status(503).json({ error: 'This connection isn’t available yet.' });
  try { setConnection('x', await xposts.connect(req.body || {})); res.json(connectionsView()); } catch (e) { res.status(e.status || 502).json({ error: e.message }); }
});
app.delete('/api/connections/x', (req, res) => { if (!adminOnly(req, res)) return; setConnection('x', null); res.json(connectionsView()); }); // the business can also regenerate the keys in its X app
app.post('/api/connections/:kind/start', (req, res) => {
  const kind = connKind(req, res); if (!kind) return;
  if (!social.available(kind)) return res.status(503).json({ error: 'This connection isn’t available yet.' });
  const back = (req.body || {}).back === '/social-posts' ? '/social-posts' : ''; // connecting from Marketing returns there
  res.json({ url: (networks.has(kind) ? networks.startUrl : social.startUrl)(kind, tenancy.current().id, currentUser(req).id, back) });
});
app.delete('/api/connections/:kind', async (req, res) => {
  const kind = connKind(req, res); if (!kind) return; const c = connOf(kind);
  if (c && kind === 'google') { if (c.bookingLink) await social.googleBookingLink(c, '').catch(() => {}); await social.googleRevoke(c); }
  if (c && networks.has(kind) && networks.NETWORKS[kind].revoke) await networks.NETWORKS[kind].revoke(c);
  // Facebook and an Instagram connected the old way (through Facebook) share one Facebook sign-in: only give up its access once neither uses it
  if (c && c.userToken && (kind === 'facebook' || kind === 'instagram')) { const other = connOf(kind === 'facebook' ? 'instagram' : 'facebook'); if (!other || other.userToken !== c.userToken) await social.metaRevoke(c); }
  setConnection(kind, null); res.json(connectionsView());
});
// another Business Profile location, Facebook Page, LinkedIn page or Pinterest board the same sign-in manages
app.get('/api/connections/:kind/choices', async (req, res) => {
  const kind = connKind(req, res); if (!kind) return; const c = connOf(kind); if (!c) return res.status(400).json({ error: 'Connect it first' });
  try {
    if (networks.has(kind)) { const n = networks.NETWORKS[kind]; const list = n.choices ? await n.choices(c) : []; save(); return res.json(list); } // a LinkedIn page or Pinterest board
    const list = kind === 'google' ? (await social.googleLocations(c)).map((l) => ({ id: l.location, label: l.title, sub: l.address, current: l.location === c.location }))
      : (await social.metaChoices(kind, c)).map((x) => ({ id: x.id, label: x.label, sub: '', current: x.id === c.pageId }));
    save(); res.json(list);
  } catch (e) { connFail(res, e, kind); }
});
app.put('/api/connections/:kind', async (req, res) => {
  const kind = connKind(req, res); if (!kind) return; const c = connOf(kind); if (!c) return res.status(400).json({ error: 'Connect it first' });
  const b = req.body || {};
  try {
    if (b.choice && kind === 'google') {
      const locs = await social.googleLocations(c); const l = locs.find((x) => x.location === b.choice); if (!l) return res.status(400).json({ error: 'Choose one of your Business Profile locations' });
      if (c.bookingLink) await social.googleBookingLink(c, '').catch(() => {}); // the booking button moves with the location
      Object.assign(c, l, { choices: locs.length }); if (c.booking) await social.googleBookingLink(c, bookingUrl());
    } else if (b.choice && networks.has(kind)) {
      if (!networks.NETWORKS[kind].choose) return res.status(400).json({ error: 'There’s nothing to choose for this connection' });
      await networks.NETWORKS[kind].choose(c, String(b.choice));
    } else if (b.choice) {
      const list = await social.metaChoices(kind, c); const x = list.find((y) => y.id === b.choice); if (!x) return res.status(400).json({ error: 'Choose one of the accounts listed' });
      Object.assign(c, { pageId: x.page.id, name: x.page.name, link: x.page.link, token: x.page.token, choices: list.length });
    }
    if (kind === 'google' && 'reviews' in b) c.reviews = !!b.reviews;
    if (kind === 'google' && 'booking' in b) {
      if (b.booking && !tenancy.has('onlineBooking')) return res.status(403).json({ error: 'Online booking isn’t included in your plan' });
      await social.googleBookingLink(c, b.booking ? bookingUrl() : ''); c.booking = !!b.booking;
    }
    setConnection(kind, c); res.json(connectionsView());
  } catch (e) { connFail(res, e, kind); }
});

// ---------- Settings → QuickBooks & Xero (lib/accounting.js): clients, invoices, payments and expenses sent to the business's books ----------
// One way, Worklio → QuickBooks Online or Xero, every 15 minutes once turned on (and with Sync now). db.accounting holds the settings and
// what's been sent (map: our id → their id, plus a fingerprint so an edited invoice or expense is sent again); the tokens stay in the secrets.
// Only records dated on or after the start date are sent, so books already kept by hand don't get duplicates.
const books = () => db.accounting || null;
const booksConn = () => secrets().accounting || null;
const hashOf = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const booksDay = (s) => String(s || '').slice(0, 10);
const BOOKS_MAP = () => ({ clients: {}, invoices: {}, payments: {}, expenses: {} });
function saveAccounting(kind, conn) {
  const old = books(); const remoteId = conn.realmId || conn.tenantId; const now = new Date().toISOString();
  const keep = old && old.provider === kind && old.remoteId === remoteId; // the same company again: keep what was already sent
  db.accounting = keep ? { ...old, company: conn.company, needsReconnect: false } : { provider: kind, remoteId, company: conn.company, connectedAt: now, startDate: iso(new Date()).slice(0, 8) + '01', settings: {}, categoryAccounts: {}, auto: false, map: BOOKS_MAP(), errors: {}, log: [] };
  db.secrets = { ...secrets(), accounting: conn }; save();
  const t = tenancy.current(); t.accounting = kind; tenancy.savePlatform(); // Alpha shows how many businesses use each
}
// what's been paid on an invoice, as payments for the books: the quote deposit credited to it, then each payment less its refunds
function booksPayments(inv) {
  const cr = invoiceCredits(inv, true); const out = [];
  if (cr.depositApplied > 0) out.push({ key: 'dep-' + inv.id, amount: cr.depositApplied, date: cr.depositAppliedAt, reference: `Deposit, quote ${cr.depositQuote}`.slice(0, 21), note: `Deposit paid on quote ${cr.depositQuote} (Worklio Pro)` });
  if ((inv.payments || []).length) {
    for (const p of inv.payments) { const amount = paidPart(p); if (amount > 0 && !/^demo/.test(p.method || '')) out.push({ key: p.id, amount, date: p.date, reference: p.reference || '', note: `${p.method || 'Payment'} (Worklio Pro)` }); }
  } else if (inv.status === 'paid' && inv.paidAt && !/^demo/.test(inv.paymentMethod || '')) {
    const amount = round2(Math.min(Number(inv.paidAmount || inv.total) || 0, (inv.total || 0) - cr.depositApplied)); if (amount > 0) out.push({ key: 'i-' + inv.id, amount, date: inv.paidAt, reference: '', note: `${inv.paymentMethod || 'Payment'} (Worklio Pro)` });
  }
  return out;
}
const booksInvoiceHash = (inv) => hashOf([inv.number, inv.clientId, inv.issueDate, inv.dueDate, inv.items, inv.discount, inv.tax, inv.total, inv.notes]);
const booksExpenseHash = (e) => hashOf([e.date, e.amount, e.category, e.vendor, e.description, e.jobId]);
const booksInvoicesDue = (B) => db.invoices.filter((inv) => !inv.imported && inv.status !== 'draft' && booksDay(inv.issueDate || inv.createdAt) >= (B.startDate || '') && (B.map.invoices[inv.id] || {}).h !== booksInvoiceHash(inv));
const booksExpensesDue = (B) => db.expenses.filter((e) => !e.imported && booksDay(e.date) >= (B.startDate || '') && (B.map.expenses[e.id] || {}).h !== booksExpenseHash(e));
// payments waiting: only on invoices already in the books (an invoice waiting goes first, then its payments)
const booksPaymentsDue = (B) => db.invoices.filter((inv) => B.map.invoices[inv.id]).flatMap((inv) => booksPayments(inv).filter((p) => !B.map.payments[p.key]).map((p) => ({ inv, p })));
const booksRunning = new Set(); // accounts syncing right now
// retry: Sync now tries everything again; the automatic run leaves a record that failed in the last 6 hours, unchanged, for later
async function syncBooks({ limit = 150, retry = false } = {}) {
  const B = books(); const conn = booksConn(); const P = B && accounting.PROVIDERS[B.provider];
  if (!B || !conn || !P) throw Object.assign(new Error('Connect QuickBooks or Xero first'), { status: 400 });
  const tid = tenancy.current().id; if (booksRunning.has(tid)) return { busy: true };
  booksRunning.add(tid);
  B.map = { ...BOOKS_MAP(), ...(B.map || {}) }; B.errors = B.errors || {}; B.log = B.log || []; const map = B.map;
  let sent = 0; let failed = 0; let stop = null; let options = null; const now = () => new Date().toISOString();
  const pace = () => new Promise((r) => setTimeout(r, P.pace));
  const full = () => stop || sent + failed >= limit;
  const log = (kind, label, ok, msg) => { B.log.unshift({ at: now(), kind, label, ok, msg: msg || '' }); if (B.log.length > 100) B.log.length = 100; };
  const skip = (key, h) => { const e = B.errors[key]; return !retry && e && e.h === h && Date.now() - Date.parse(e.at) < 6 * 3600e3; };
  const attempt = async (key, h, kind, label, fn) => {
    try { await fn(); delete B.errors[key]; sent++; log(kind, label, true); } catch (e) {
      failed++; B.errors[key] = { kind, label, msg: String(e.message || 'Something went wrong').slice(0, 500), at: now(), h }; log(kind, label, false, e.message);
      if (e.reconnect || e.busy || e.status === 502) stop = e; // no point going on: signed out, rate-limited or the service is down
    }
    await pace(); if (sent % 10 === 0) save();
  };
  const customer = async (clientId) => {
    const c = findClient(clientId); if (!c) throw new Error('The client on this invoice was deleted');
    const h = hashOf([c.name, c.company, c.email, c.phone, c.address]); const m = map.clients[c.id];
    if (m && m.h === h) return m.rid;
    const rid = await P.customer(conn, c, m && m.rid); await pace(); map.clients[c.id] = { rid, h }; return rid;
  };
  try {
    for (const inv of booksInvoicesDue(B)) {
      if (full()) break; const h = booksInvoiceHash(inv); const key = 'inv:' + inv.id; if (skip(key, h)) continue; const m = map.invoices[inv.id];
      await attempt(key, h, 'invoice', `Invoice ${inv.number}`, async () => { P.checkInvoice(B.settings || {}, inv); const customerId = await customer(inv.clientId); map.invoices[inv.id] = { rid: await P.invoice(conn, inv, { settings: B.settings || {}, customerId }, m && m.rid), h }; });
    }
    for (const { inv, p } of booksPaymentsDue(B)) {
      if (full()) break; const key = 'pay:' + p.key; const h = hashOf([p.amount, p.date]); if (skip(key, h)) continue;
      await attempt(key, h, 'payment', `${money(p.amount)} paid on invoice ${inv.number}`, async () => { const customerId = await customer(inv.clientId); map.payments[p.key] = { rid: await P.payment(conn, p, { settings: B.settings || {}, customerId, invoiceId: map.invoices[inv.id].rid }), invoiceId: inv.id }; });
    }
    for (const e of booksExpensesDue(B)) {
      if (full()) break; const h = booksExpenseHash(e); const key = 'exp:' + e.id; if (skip(key, h)) continue; const m = map.expenses[e.id]; const job = e.jobId && db.jobs.find((j) => j.id === e.jobId);
      await attempt(key, h, 'expense', `${e.category || 'Expense'} ${money(e.amount)}${e.vendor ? ` · ${e.vendor}` : ''}`, async () => {
        if (!options) options = await P.options(conn);
        map.expenses[e.id] = { rid: await P.expense(conn, e, { settings: B.settings || {}, options, categoryAccount: (B.categoryAccounts || {})[e.category] || '', job: job ? job.number : '' }, m && m.rid), h };
      });
    }
  } finally {
    B.lastSyncAt = now(); B.lastResult = { sent, failed, stopped: stop ? stop.message : '', more: !stop && sent + failed >= limit };
    if (stop && stop.reconnect) B.needsReconnect = true;
    save(); booksRunning.delete(tid);
  }
  return B.lastResult;
}
function booksView() {
  const B = books(); const conn = booksConn();
  const providers = Object.entries(accounting.PROVIDERS).map(([id, p]) => ({ id, name: p.name, available: social.available(id) }));
  const base = { plan: tenancy.has('accounting'), providers, sandbox: social.apps().quickbooks.sandbox };
  if (!B || !conn) return { ...base, connected: null };
  const map = { ...BOOKS_MAP(), ...(B.map || {}) }; const BB = { ...B, map };
  return { ...base, connected: B.provider, name: accounting.PROVIDERS[B.provider].name, company: B.company, connectedAt: B.connectedAt, startDate: B.startDate, settings: B.settings || {}, categoryAccounts: B.categoryAccounts || {}, auto: !!B.auto,
    lastSyncAt: B.lastSyncAt || null, lastResult: B.lastResult || null, needsReconnect: !!B.needsReconnect, syncing: booksRunning.has(tenancy.current().id),
    sent: { clients: Object.keys(map.clients).length, invoices: Object.keys(map.invoices).length, payments: Object.keys(map.payments).length, expenses: Object.keys(map.expenses).length },
    waiting: { invoices: booksInvoicesDue(BB).length, payments: booksPaymentsDue(BB).length, expenses: booksExpensesDue(BB).length },
    errors: Object.values(B.errors || {}).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50).map(({ h, ...e }) => e), log: (B.log || []).slice(0, 30),
    categories: [...new Set(db.expenses.map((e) => e.category).filter(Boolean))].sort() };
}
const booksAdmin = (req, res) => { if (isAdmin(currentUser(req))) return true; res.status(403).json({ error: 'Only the account owner or an admin can manage QuickBooks and Xero' }); return false; };
app.get('/api/accounting', (req, res) => res.json(booksView()));
app.post('/api/accounting/:kind/start', (req, res) => {
  if (!booksAdmin(req, res)) return; const kind = req.params.kind;
  if (!accounting.has(kind)) return res.status(404).json({ error: 'Unknown connection' });
  if (!social.available(kind)) return res.status(503).json({ error: 'This connection isn’t available yet.' });
  const B = books(); if (B && booksConn() && B.provider !== kind) return res.status(400).json({ error: `Disconnect ${accounting.PROVIDERS[B.provider].name} first` });
  res.json({ url: accounting.startUrl(kind, tenancy.current().id, currentUser(req).id) });
});
// the accounts, products and tax rates in the connected books, for the settings
app.get('/api/accounting/options', async (req, res) => {
  if (!booksAdmin(req, res)) return; const B = books(); const conn = booksConn(); if (!B || !conn) return res.status(400).json({ error: 'Connect QuickBooks or Xero first' });
  try { const o = await accounting.PROVIDERS[B.provider].options(conn); save(); res.json(o); } catch (e) { if (e.reconnect) { B.needsReconnect = true; } save(); res.status(e.status || 502).json({ error: e.message }); }
});
app.put('/api/accounting', (req, res) => {
  if (!booksAdmin(req, res)) return; const B = books(); if (!B || !booksConn()) return res.status(400).json({ error: 'Connect QuickBooks or Xero first' });
  const b = req.body || {}; const str = (v) => String(v || '').trim().slice(0, 100);
  if ('startDate' in b) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.startDate))) return res.status(400).json({ error: 'Choose the date to start sending from' }); B.startDate = b.startDate; }
  if (b.settings && typeof b.settings === 'object') B.settings = Object.fromEntries(['itemId', 'salesAccount', 'taxType', 'depositAccount', 'bankAccount', 'expenseAccount'].map((k) => [k, str(k in b.settings ? b.settings[k] : (B.settings || {})[k])]));
  if (b.categoryAccounts && typeof b.categoryAccounts === 'object') B.categoryAccounts = Object.fromEntries(Object.entries(b.categoryAccounts).slice(0, 200).map(([k, v]) => [String(k).slice(0, 100), str(v)]).filter(([, v]) => v));
  if ('auto' in b) B.auto = b.auto === true;
  save(); res.json(booksView());
});
app.post('/api/accounting/sync', async (req, res) => {
  if (!booksAdmin(req, res)) return; const B = books();
  if (!B || !booksConn()) return res.status(400).json({ error: 'Connect QuickBooks or Xero first' });
  if (!social.available(B.provider)) return res.status(503).json({ error: `${accounting.PROVIDERS[B.provider].name} isn’t available right now` });
  B.needsReconnect = false; // runs in the background (Xero allows 60 calls a minute): the page checks back until it's done
  syncBooks({ retry: true }).catch((e) => console.error('accounting sync:', e.message)); res.json(booksView());
});
// clear what was sent, so everything from the start date goes again (e.g. after deleting it in the books)
app.post('/api/accounting/reset', (req, res) => {
  if (!booksAdmin(req, res)) return; const B = books(); if (!B) return res.status(400).json({ error: 'Connect QuickBooks or Xero first' });
  B.map = BOOKS_MAP(); B.errors = {}; save(); res.json(booksView());
});
app.delete('/api/accounting', async (req, res) => {
  if (!booksAdmin(req, res)) return; const B = books(); const conn = booksConn();
  if (B && conn) await accounting.PROVIDERS[B.provider].revoke(conn);
  const sec = { ...secrets() }; delete sec.accounting; db.secrets = sec; if (B) B.auto = false; save(); // what was sent stays, in case the same company connects again
  const t = tenancy.current(); delete t.accounting; tenancy.savePlatform(); res.json(booksView());
});
// every 15 minutes: each account with sync turned on sends what's new, one account at a time
let booksTick = false;
async function syncAllBooks() {
  if (booksTick) return; booksTick = true;
  try {
    for (const t of tenancy.platform().tenants.filter((x) => x.accounting && x.status === 'active')) {
      await tenancy.run(t, async () => { const B = books(); if (!B || !B.auto || B.needsReconnect || !booksConn() || !tenancy.has('accounting') || !social.available(B.provider)) return; await syncBooks({ limit: 100 }); })
        .catch((e) => console.error('accounting sync:', t.slug, e.message));
    }
  } finally { booksTick = false; }
}

// ---------- App Marketplace (lib/marketplace.js): apps that connect today, and "I want this" for the ones on the way ----------
function liveAppState(a, u) {
  if (a.id === 'gcal' || a.id === 'outlook' || a.id === 'applecal') return { planOk: true, available: true, connected: !!(u && u.calFeed) }; // each login's own calendar link (Preferences)
  if (accounting.has(a.id)) { const B = books(); return { planOk: tenancy.has('accounting'), available: social.available(a.id), connected: !!(B && B.provider === a.id && booksConn()) }; }
  const planOk = !a.feature || tenancy.has(a.feature);
  if (SOCIAL_KINDS.includes(a.id)) return { planOk, available: social.available(a.id), connected: !!connOf(a.id) };
  if (a.id === 'bluesky' || a.id === 'x') return { planOk, available: social.available(a.id), connected: !!connOf(a.id) }; // the business's own app password or X app: nothing for the platform to set up
  if (a.id === 'stripe') { const s = secrets(); const on = !!stripeKey() && (!!s.stripeChargesEnabled || !!s.stripeSecretKey || (tenancy.isDefault() && !!process.env.STRIPE_SECRET_KEY)); return { planOk, available: on || !!stripeLib.platformKey(), connected: on }; }
  if (a.id === 'homedepot') return { planOk, available: homeDepot.ready(), connected: !!hdSettings().on };
  if (a.id === 'claude') { const on = !!process.env.ANTHROPIC_API_KEY; return { planOk, available: on, connected: on }; }
  return { planOk, available: false, connected: false };
}
const marketplaceView = (u) => {
  const P = tenancy.platform(); const mine = marketplace.requestedBy(P, tenancy.current().id);
  return { categories: marketplace.CATEGORIES, apps: marketplace.catalog().filter((a) => a.feature !== 'ai' || tenancy.aiOn('aiDescriptions')).map((a) => ({ ...a, ...(a.live ? liveAppState(a, u) : { requested: mine.includes(a.id) }) })) };
};
const marketplaceWho = (req) => { const u = currentUser(req); const t = tenancy.current(); return { t: t.id, company: db.company.name || t.slug, account: tenancy.tenantUrl(t), name: u.name, email: u.email }; };
const marketplaceAdmin = (req, res) => { if (!marketplace.isOn(tenancy.platform())) { res.status(404).json({ error: 'The App Marketplace isn’t available' }); return false; } if (isAdmin(currentUser(req))) return true; res.status(403).json({ error: 'Only the account owner or an admin can manage apps' }); return false; };
app.get('/api/marketplace', (req, res) => { if (marketplaceAdmin(req, res)) res.json(marketplaceView(currentUser(req))); });
// Home Depot (lib/homedepot.js): turned on in the marketplace, with the ZIP code for local prices and the markup added to the price picked
const hdSettings = () => db.homeDepot || {};
const hdView = () => { const h = hdSettings(); return { available: homeDepot.ready(), on: !!h.on && tenancy.has('services') && marketplace.isOn(tenancy.platform()), zip: h.zip || '', markup: Number(h.markup) || 0 }; };
app.get('/api/home-depot', (req, res) => res.json(hdView()));
app.put('/api/home-depot', (req, res) => {
  if (!marketplaceAdmin(req, res)) return; const b = req.body || {};
  if (!tenancy.has('services')) return res.status(403).json({ error: 'Products & services aren’t included in your plan' });
  if (b.on && !homeDepot.ready()) return res.status(503).json({ error: 'Home Depot search isn’t available yet' });
  const zip = String(b.zip || '').trim(); if (zip && !/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'Enter a 5-digit ZIP code, or leave it empty' });
  const markup = Number(b.markup) || 0; if (markup < 0 || markup > 500) return res.status(400).json({ error: 'Markup must be between 0% and 500%' });
  db.homeDepot = { on: !!b.on, zip, markup: Math.round(markup * 10) / 10 }; save(); res.json(hdView());
});
app.get('/api/home-depot/search', async (req, res) => {
  if (!hdView().on) return res.status(400).json({ error: 'Turn on Home Depot in Settings → App Marketplace first' });
  try { res.json({ products: await homeDepot.search(req.query.q, { zip: hdSettings().zip, account: tenancy.current().id }) }); } catch (e) { res.status(e.status || 502).json({ error: e.message }); }
});
// "I want this" (on: true) or take it back (on: false)
app.post('/api/marketplace/:id/request', (req, res) => {
  if (!marketplaceAdmin(req, res)) return;
  try { marketplace.request(tenancy.platform(), req.params.id, marketplaceWho(req), !!(req.body && req.body.on)); tenancy.savePlatform(); res.json(marketplaceView(currentUser(req))); } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});
// an app that isn't listed
app.post('/api/marketplace/suggest', (req, res) => {
  if (!marketplaceAdmin(req, res)) return;
  try { marketplace.suggest(tenancy.platform(), marketplaceWho(req), req.body || {}); tenancy.savePlatform(); res.json({ ok: true }); } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

// Google reviews (the Reviews page): read straight from the Business Profile; replies show publicly on Google
app.get('/api/reviews', async (req, res) => {
  const c = connOf('google'); if (!c || c.reviews === false) return res.json({ connected: !!c, on: false });
  try { const r = await social.googleReviews(c, String(req.query.page || '')); markWorking('google'); save(); res.json({ connected: true, on: true, title: c.title, mapsUrl: c.mapsUrl, reviewUrl: c.reviewUrl, ...r }); } catch (e) { connFail(res, e, 'google'); }
});
const canReply = (req, res) => { const u = currentUser(req); if (can(u, 'reviews')) return true; res.status(403).json({ error: 'Ask a manager or admin to reply to reviews' }); return false; };
app.put('/api/reviews/reply', async (req, res) => {
  if (!canReply(req, res)) return; const c = connOf('google'); if (!c) return res.status(400).json({ error: 'Connect your Google Business Profile first' });
  const comment = String((req.body && req.body.comment) || '').trim(); if (!comment) return res.status(400).json({ error: 'Write a reply first' });
  if (comment.length > 4000) return res.status(400).json({ error: 'Keep the reply under 4,000 characters' });
  try { const r = await social.googleReply(c, String(req.body.name || ''), comment); save(); res.json({ comment: r.comment || comment, updatedAt: r.updateTime || new Date().toISOString() }); } catch (e) { connFail(res, e, 'google'); }
});
app.delete('/api/reviews/reply', async (req, res) => {
  if (!canReply(req, res)) return; const c = connOf('google'); if (!c) return res.status(400).json({ error: 'Connect your Google Business Profile first' });
  try { await social.googleDeleteReply(c, String(req.query.name || '')); save(); res.json({ ok: true }); } catch (e) { connFail(res, e, 'google'); }
});

// Social Posts: project photos to the connected Facebook Page and Instagram account. Photos arrive as JPEGs (the browser converts them)
// and are saved in the account's uploads, because Facebook and Instagram fetch them from a public address.
// Bluesky gets the photos themselves (jpegs); a Google post gets a Book button while the Business Profile's booking button is on
const POST_TO = { facebook: (c, p) => social.facebookPost(c, p), instagram: (c, p) => networks.NETWORKS.instagram.post(c, p), bluesky: (c, p) => bluesky.post(c, p),
  google: (c, p) => social.googlePost(c, { ...p, book: p.ref || (c.booking && tenancy.has('onlineBooking') ? bookingUrl() : '') }), // p.ref: a job post's tracked booking link
  // LinkedIn uploads the photos itself; a Pin links to the business's website (or its booking page); TikTok fetches the photos from the
  // <slug>.<root domain> address, the one verified in the TikTok app, with the options picked in the form
  linkedin: (c, p) => networks.NETWORKS.linkedin.post(c, p),
  pinterest: (c, p) => networks.NETWORKS.pinterest.post(c, { ...p, link: p.ref || db.company.website || (tenancy.has('onlineBooking') ? bookingUrl() : baseUrl()) }),
  threads: (c, p) => networks.NETWORKS.threads.post(c, p),
  tiktok: (c, p) => networks.NETWORKS.tiktok.post(c, { ...p, images: p.paths.map((u) => tenancy.subdomainUrl(tenancy.current()) + u) }),
  // YouTube takes only the post's video; X gets the photos themselves, posted with the business's own X app
  youtube: (c, p) => networks.NETWORKS.youtube.post(c, p),
  x: (c, p) => xposts.post(c, p),
};
// each network's caption limit, photo limit and whether it needs a photo or video (Bluesky and X check their own in lib/bluesky.js and lib/xposts.js)
const POST_LIMITS = { facebook: { text: 63206, photos: 10 }, google: { text: social.GOOGLE_POST_MAX, photos: 10, needsText: true },
  ...Object.fromEntries(Object.entries(networks.NETWORKS).map(([k, n]) => [k, n.limits])) };
const NET_NAMES = { facebook: 'Facebook', instagram: 'Instagram', google: 'Google', bluesky: 'Bluesky', x: 'X', ...Object.fromEntries(Object.entries(networks.NETWORKS).map(([k, n]) => [k, n.name])) };
// ---------- the business's own automations (lib/business-automations.js) ----------
const portalLink = (c) => { if (!c.portalToken) { c.portalToken = token(); save(); } return `${baseUrl()}/client-portal?c=${c.portalToken}`; };
const bizAuto = require('./lib/business-automations')({ db, save, uid, token, iso, niceDate, money, findClient, tenancy, localNow, withStatus, quoteLink, invoiceLink, portalLink, baseUrl, renderEmail, notify, sendEmail, pushTo, jobCrew, pushTime, reviewRecord, reviewLink });
// Snap to quote (lib/snap-quote.js): a draft quote from job site photos and the tech's notes
const snapQuote = require('./lib/snap-quote')({ db, save, uid, tenancy, aiClient, saveNoteFiles, computeTotals, nextNumber, token, iso, findClient });
app.get('/api/snap-quote', (req, res) => res.json(snapQuote.status()));
app.post('/api/snap-quote', async (req, res) => {
  try { const r = await snapQuote.draft(req.body || {}, currentUser(req)); res.status(201).json({ quote: r.quote, questions: r.questions, usage: r.usage }); }
  catch (e) { if (!e.status) console.error('snap to quote:', e.message); res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong' }); }
});
// Every job markets itself (lib/job-posts.js): a finished job's photos become a post waiting in Marketing for approval
const jobPosts = require('./lib/job-posts')({ db, save, uid, tenancy, uploadDir, findClient, aiClient, pushTo, usersWhoCan, sendTemplate, baseUrl, localNow });
const autoRoute = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { if (!e.status) console.error('automations:', e.message); res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong' }); } };
app.get('/api/automations', autoRoute(() => bizAuto.view()));
app.post('/api/automations', autoRoute((req) => { bizAuto.create(req.body || {}); return bizAuto.view(); }));
app.post('/api/automations/preview', autoRoute((req) => bizAuto.preview(req.body || {})));
app.post('/api/automations/test', autoRoute((req) => bizAuto.test(req.body || {}, currentUser(req).email)));
app.put('/api/automations/:id', autoRoute((req) => { bizAuto.update(req.params.id, req.body || {}); return bizAuto.view(); }));
app.post('/api/automations/:id', autoRoute((req) => { bizAuto.setEnabled(req.params.id, !!(req.body || {}).on); return bizAuto.view(); }));
app.delete('/api/automations/:id', autoRoute((req) => { bizAuto.remove(req.params.id); return bizAuto.view(); }));
// the unsubscribe link in automation emails: a button, not a plain visit, so email scanners that open links don't unsubscribe anyone
const autoUnsubPage = (c, tk) => {
  const off = bizAuto.isOptedOut(c);
  return shell('Email preferences', `<h1>${off ? 'You’re unsubscribed' : 'Unsubscribe?'}</h1><p class="muted">${off ? `You won’t get automated emails from ${esc(db.company.name)}. You’ll still get quotes and invoices they send you.` : `Stop automated emails from ${esc(db.company.name)}, such as reminders and follow-ups. You’ll still get quotes and invoices they send you.`}</p>
<form method="post" action="/p/automations/${esc(tk)}${off ? '?on=1' : ''}"><button class="btn" type="submit">${off ? 'Subscribe again' : 'Unsubscribe'}</button></form>`);
};
app.get('/p/automations/:token', (req, res) => { const c = bizAuto.clientByToken(req.params.token); if (!c) return res.status(404).send(shell('Link not found', '<h1>This link isn’t valid</h1>')); res.send(autoUnsubPage(c, req.params.token)); });
app.post('/p/automations/:token', (req, res) => { const c = bizAuto.clientByToken(req.params.token); if (!c) return res.status(404).send(shell('Link not found', '<h1>This link isn’t valid</h1>')); bizAuto.setOptOut(c, !req.query.on); res.send(autoUnsubPage(c, req.params.token)); });
app.get('/api/social-posts', (req, res) => {
  const f = connOf('facebook'); const i = connOf('instagram'); const bs = connOf('bluesky'); const g = connOf('google'); const x = connOf('x');
  const net = Object.fromEntries(Object.keys(networks.NETWORKS).map((k) => { const c = connOf(k); return [k, c ? { name: c.name || '', username: c.username || '' } : null]; }));
  res.json({ posts: (db.socialPosts || []).slice(0, 100), facebook: f ? { name: f.name, link: f.link } : null, instagram: i ? { username: i.username } : null, bluesky: bs ? { handle: bs.handle } : null, google: g ? { title: g.title } : null,
    x: x ? { name: x.name, username: x.username } : null, ...net });
});
// a post's video (for YouTube), sent as the file itself before the post because videos are large. It's kept until the post goes out,
// then deleted; one that's never posted is cleared after a day. The kind is read from its first bytes, as for review videos.
const POST_VIDEO_MAX = 500e6; const POST_VIDEO_RE = /^\/uploads\/(post-video-[\w-]+\.(mp4|mov|webm))$/;
app.post('/api/social-posts/video', async (req, res) => {
  const fail = (status, error) => { res.setHeader('Connection', 'close'); return res.status(status).json({ error }); };
  if (!connOf('youtube')) return fail(400, 'Connect YouTube first');
  if (Number(req.headers['content-length']) > POST_VIDEO_MAX) return fail(413, 'Videos can be up to 500 MB');
  const dir = uploadDir(); fs.mkdirSync(dir, { recursive: true });
  for (const n of fs.readdirSync(dir)) if (/^post-video-/.test(n)) { const p = path.join(dir, n); try { if (Date.now() - fs.statSync(p).mtimeMs > 864e5) fs.rmSync(p, { force: true }); } catch (e) { /* already gone */ } }
  const tmp = path.join(dir, `tmp-${token()}.part`); let size = 0; let head = Buffer.alloc(0);
  try {
    await require('stream/promises').pipeline(req, async function* (src) {
      for await (const chunk of src) { size += chunk.length; if (size > POST_VIDEO_MAX) throw Object.assign(new Error('Videos can be up to 500 MB'), { status: 413 }); if (head.length < 16) head = Buffer.concat([head, chunk]).subarray(0, 16); yield chunk; }
    }, fs.createWriteStream(tmp));
    const kind = sniffReviewMedia(head); if (!kind || kind.type !== 'video') throw Object.assign(new Error('Choose an MP4, MOV or WebM video'), { status: 400 });
    const file = `post-video-${token()}.${kind.ext}`; fs.renameSync(tmp, path.join(dir, file));
    res.status(201).json({ video: '/uploads/' + file, size });
  } catch (e) { fs.rm(tmp, { force: true }, () => {}); if (!res.headersSent) fail(e.status || 400, e.status ? e.message : 'The video didn’t finish uploading. Please try again.'); }
});
// what the TikTok account may post right now: who can see it and whether comments can be on (TikTok asks apps to check before each post)
app.get('/api/social-posts/tiktok', async (req, res) => {
  const c = connOf('tiktok'); if (!c) return res.status(400).json({ error: 'Connect TikTok first' });
  try { const r = await networks.NETWORKS.tiktok.creator(c); markWorking('tiktok'); save(); res.json(r); } catch (e) { markBroken('tiktok', e); save(); res.status(e.status || 502).json({ error: e.message, reconnect: !!e.reconnect }); }
});
app.post('/api/social-posts', async (req, res) => {
  const b = req.body || {}; const caption = String(b.caption || '').trim();
  // a job's drafted post (Every job markets itself): its link to the booking page is tagged so visits and requests from it are counted
  const draft = b.draftId ? jobPosts.waiting(String(b.draftId)) : null;
  if (b.draftId && !draft) return res.status(400).json({ error: 'This post has already gone out or was skipped' });
  const ref = draft && tenancy.has('onlineBooking') ? `${bookingUrl()}?ref=${draft.id}` : '';
  const capFor = (k) => { if (!ref || !['facebook', 'linkedin', 'threads'].includes(k)) return caption; const c = `${caption}\n\nBook online: ${ref}`; return c.length <= ((POST_LIMITS[k] || {}).text || Infinity) ? c : caption; };
  const to = Object.keys(POST_TO).filter((k) => (b.to || []).includes(k) && connOf(k));
  if (!to.length) return res.status(400).json({ error: 'Choose where to post' });
  const imgs = Array.isArray(b.images) ? b.images : [];
  if (imgs.length > 10) return res.status(400).json({ error: 'Choose up to 10 photos' });
  for (const k of to) { // before posting anywhere
    const L = POST_LIMITS[k]; if (!L) continue;
    if (caption.length > L.text) return res.status(400).json({ error: `${NET_NAMES[k]} posts can be up to ${L.text.toLocaleString('en-US')} characters` });
    if (L.needsPhoto && !imgs.length) return res.status(400).json({ error: `${NET_NAMES[k]} posts need at least one photo` });
    if (L.needsText && !caption) return res.status(400).json({ error: `${NET_NAMES[k]} posts need a caption` });
  }
  if (to.includes('tiktok') && !(b.tiktok && b.tiktok.privacy)) return res.status(400).json({ error: 'Choose who can see the TikTok post' });
  // the video uploaded just before (only YouTube uses it)
  const vm = POST_VIDEO_RE.exec(String(b.video || '')); const vfile = vm && path.join(uploadDir(), vm[1]);
  const video = to.includes('youtube') && vfile && fs.existsSync(vfile) ? { file: vfile, size: fs.statSync(vfile).size, ext: vm[2] } : null;
  if (to.includes('youtube') && !video) return res.status(400).json({ error: 'YouTube posts need a video' });
  if (to.includes('youtube') && !networks.YT_PRIVACY[(b.youtube || {}).privacy]) return res.status(400).json({ error: 'Choose who can see the YouTube video' });
  if (!imgs.length && !caption && !video) return res.status(400).json({ error: 'Add a photo or write a caption' });
  const bufs = [];
  for (const d of imgs) {
    const m = /^data:image\/jpeg;base64,(.+)$/.exec(d || ''); if (!m) return res.status(400).json({ error: 'Photos must be JPEG images' });
    const buf = Buffer.from(m[1], 'base64'); if (buf.length > 8e6) return res.status(400).json({ error: 'Each photo must be under 8 MB' }); bufs.push(buf);
  }
  if (to.includes('bluesky')) { const bad = bluesky.problem({ caption, jpegs: bufs }); if (bad) return res.status(400).json({ error: bad }); } // before posting anywhere
  if (to.includes('x')) { const bad = xposts.problem({ caption, jpegs: bufs }); if (bad) return res.status(400).json({ error: bad }); }
  if (to.includes('google') && caption.length > social.GOOGLE_POST_MAX) return res.status(400).json({ error: `Google posts can be up to ${social.GOOGLE_POST_MAX.toLocaleString('en-US')} characters` });
  if (to.includes('google') && !caption) return res.status(400).json({ error: 'Google posts need a caption' });
  const images = bufs.map((buf) => { const file = `post-${Date.now()}-${uid()}.jpg`; fs.writeFileSync(path.join(uploadDir(), file), buf); return `/uploads/${file}`; });
  const post = { id: uid(), caption, images, ...(video ? { video: true } : {}), results: {}, createdAt: new Date().toISOString(), by: currentUser(req).name || '' };
  for (const k of to) {
    try {
      const r = await POST_TO[k](connOf(k), { caption: capFor(k), ref, images: images.map((u) => baseUrl() + u), paths: images, jpegs: bufs, video, options: k === 'tiktok' ? b.tiktok : k === 'youtube' ? b.youtube : undefined });
      markWorking(k);
      post.results[k] = { status: 'posted', url: k === 'facebook' ? `https://www.facebook.com/${r.post_id || r.id}` : k === 'bluesky' || k === 'x' || networks.has(k) ? r.url : k === 'google' ? r.searchUrl || connOf('google').mapsUrl || '' : r.permalink || `https://www.instagram.com/${connOf(k).username}` };
    } catch (e) { markBroken(k, e); post.results[k] = { status: 'failed', error: e.message, ...(e.reconnect ? { reconnect: true } : {}) }; }
  }
  if (video && post.results.youtube.status === 'posted') fs.rm(video.file, { force: true }, () => {}); // kept after a failure, so posting again doesn't need a new upload
  if (draft) { post.jobId = draft.jobId; if (Object.values(post.results).some((r) => r.status === 'posted')) jobPosts.posted(draft.id, post, currentUser(req).name || ''); }
  db.socialPosts = [post, ...(db.socialPosts || [])].slice(0, 500); save();
  res.status(201).json(post);
});
// Every job markets itself: Marketing → Ready to post (anyone with Social posts); the on/off switch and the owner's emails: owner or admin
const jpRoute = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { if (!e.status) console.error('job posts:', e.message); res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong' }); } };
const jpPlan = () => { if (!tenancy.has('jobPosts')) throw Object.assign(new Error('Every job markets itself isn’t included in your plan'), { status: 403 }); };
app.get('/api/social-posts/jobs', jpRoute(() => jobPosts.view()));
app.put('/api/social-posts/jobs/settings', jpRoute((req) => { jpPlan(); if (!isAdmin(currentUser(req))) throw Object.assign(new Error('Ask the account owner or an admin'), { status: 403 }); return jobPosts.setSettings(req.body || {}); }));
app.put('/api/social-posts/jobs/:id', jpRoute((req) => { jpPlan(); return jobPosts.edit(req.params.id, req.body || {}); }));
app.post('/api/social-posts/jobs/:id/caption', jpRoute((req) => { jpPlan(); return jobPosts.rewrite(req.params.id, String((req.body || {}).tone || '')); }));
app.delete('/api/social-posts/jobs/:id', jpRoute((req) => { jpPlan(); jobPosts.skip(req.params.id); return jobPosts.view(); }));
// takes a post off this list only: it stays on the networks it was posted to
app.delete('/api/social-posts/:id', (req, res) => {
  if (!isAdmin(currentUser(req))) return res.status(403).json({ error: 'Ask the account owner or an admin' });
  db.socialPosts = (db.socialPosts || []).filter((p) => p.id !== req.params.id); save(); res.json({ ok: true });
});

// ---------- Account and billing: the business's own subscription to this service (owner only) ----------
// Plans are billed by the platform's Stripe account (lib/platform.js sign-up checkout); t.billing holds the Stripe customer and subscription.
// The owner changes the plan, card and billing details here; Stripe charges the subscription automatically.
const ownerOnly = (req, res) => { const u = currentUser(req); if (u && u.role === 'owner') return true; res.status(403).json({ error: 'Only the account owner can manage billing' }); return false; };
// seeing the plans and choosing one: the owner, or also an admin while the account is paused
const planChooser = (req, res) => (isAdmin(currentUser(req)) && isPaused()) || ownerOnly(req, res);
const billingCall = (method, endpoint, params) => (method === 'POST' && endpoint === 'checkout/sessions' ? stripeLib.checkoutSession(stripeLib.platformKey(), params) : stripeLib.request(stripeLib.platformKey(), method, endpoint, params)); // Checkout pages offer Link next to cards
const unix = (t) => (t ? iso(new Date(t * 1000)) : null);
app.get('/api/account/billing', async (req, res) => {
  if (!planChooser(req, res)) return;
  const t = tenancy.current(); const P = tenancy.platform(); const plan = tenancy.planOf(t); const b = t.billing || {}; let charge = stripeLib.planCharge(plan, b.interval);
  const out = { activeSince: (b.paidAt || t.createdAt || '').slice(0, 10), status: t.status, paused: pausedInfo(t), isOwner: currentUser(req).role === 'owner', plan: { id: plan.id, name: plan.name, price: plan.price || '', charge, maxUsers: plan.maxUsers || 0, extraUser: plan.extraUser || null, locked: plan.locked || null },
    productName: P.settings.productName, contactEmail: P.settings.contactEmail, live: !!stripeLib.platformKey(), billed: !!(b.customerId && stripeLib.platformKey()),
    demo: !!b.demo, managed: !tenancy.isDefault(), plans: P.plans.filter((p) => !p.hidden || p.id === plan.id).map((x) => x.id === plan.id ? plan : x).map((p) => ({ id: p.id, name: p.name, price: p.price || '', description: p.description || '', hidden: !!p.hidden, maxUsers: p.maxUsers || 0, extraUser: p.maxUsers > 0 && p.extraUser ? p.extraUser : null, locked: !!p.locked, features: tenancy.FEATURES.filter((f) => (p.features || []).includes(f.key)).map((f) => f.label), month: (stripeLib.planCharge(p, 'month') || {}).interval === 'month' ? stripeLib.planCharge(p, 'month').cents / 100 : null, year: (stripeLib.planCharge(p, 'year') || {}).interval === 'year' ? stripeLib.planCharge(p, 'year').cents / 100 : null })),
    interval: charge ? charge.interval : b.interval || 'month', popularPlan: P.settings.popularPlan || '', alwaysIncluded: tenancy.ALWAYS_INCLUDED,
    card: null, customer: null, subscription: null, invoices: [], endsAt: b.endsAt || null, trial: onTrial(t) ? { endsAt: t.expiresAt, code: b.trial.code, cancelled: !!b.trial.cancelled, prepaid: !!b.trial.prepaid } : null, prepaidUntil: supporters.lockedUntil(t), pendingPlan: b.pendingPlanId ? (P.plans.find((p) => p.id === b.pendingPlanId) || {}).name || null : null,
    retention: retentionInfo(t), usage: { clients: db.clients.length, quotes: db.quotes.length, jobs: db.jobs.length, invoices: db.invoices.length, logins: db.users.length, extraLogins: extraCount(plan), texts: smsUsage() } };
  const sc = stripeLib.seatCharge(plan, out.interval); if (sc && out.usage.extraLogins) out.extra = { count: out.usage.extraLogins, cents: sc.cents, interval: sc.interval };
  out.matrixAddon = matrixInfo(t); // paid add-on (or included by Alpha); out.matrix below: its line on the subscription
  if (out.billed) {
    const get = (ep) => billingCall('GET', ep).catch((e) => { console.error('Billing:', e.message); return null; });
    const [cust, sub, inv] = await Promise.all([get(`customers/${encodeURIComponent(b.customerId)}?expand[]=invoice_settings.default_payment_method`),
      b.subscriptionId ? get(`subscriptions/${encodeURIComponent(b.subscriptionId)}?expand[]=default_payment_method`) : null, get(`invoices?customer=${encodeURIComponent(b.customerId)}&limit=24`)]);
    const pm = (sub && typeof sub.default_payment_method === 'object' && sub.default_payment_method) || (cust && cust.invoice_settings && typeof cust.invoice_settings.default_payment_method === 'object' && cust.invoice_settings.default_payment_method);
    if (pm && pm.card) out.card = { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
    else if (pm && pm.type === 'link') out.link = { email: (pm.link && pm.link.email) || '' }; // paying with Link
    if (cust && !cust.deleted) out.customer = { name: cust.name || (pm && pm.billing_details && pm.billing_details.name) || b.ownerName || '', email: cust.email || b.email || '', address: cust.address || (pm && pm.billing_details && pm.billing_details.address) || null };
    if (sub) {
      const item = planItem(sub); const price = item && item.price; const seats = seatItem(sub);
      out.subscription = { status: sub.status, cancelAtPeriodEnd: !!sub.cancel_at_period_end, cancelAt: unix(sub.cancel_at), startedAt: unix(sub.start_date),
        periodEnd: unix(sub.current_period_end || (item && item.current_period_end)), amount: price && price.unit_amount != null ? round2(price.unit_amount / 100) : charge ? charge.cents / 100 : null,
        interval: (price && price.recurring && price.recurring.interval) || (charge && charge.interval) || 'month' };
      if (out.subscription.startedAt) out.activeSince = out.subscription.startedAt;
      out.interval = out.subscription.interval; out.plan.charge = charge = stripeLib.planCharge(plan, out.interval);
      if (charge && price && price.unit_amount != null && charge.interval === out.interval && !charge.regular) out.plan.charge = charge = { ...charge, cents: price.unit_amount }; // what Stripe really charges
      const sc2 = stripeLib.seatCharge(plan, out.interval);
      if ((((seats && seats.quantity) || 0) !== extraCount(plan) || !!matrixItem(sub) !== matrixBilled(t)) && !tenancy.isDefault(t)) seatsChanged(); // out of step (e.g. a failed update): fix it for the next bill
      const mx = matrixItem(sub); if (mx) out.matrix = { cents: (mx.price && mx.price.unit_amount) || 0, interval: (mx.price && mx.price.recurring && mx.price.recurring.interval) || out.interval };
      out.extra = seats ? { count: seats.quantity || 0, cents: (seats.price && seats.price.unit_amount) || 0, interval: out.interval } : out.usage.extraLogins && sc2 ? { count: out.usage.extraLogins, cents: sc2.cents, interval: sc2.interval } : null;
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
// ---------- extra logins: past a plan's included logins (maxUsers), a plan with extraUser (Alpha → Plans) bills each one ----------
// They're a second line on the account's Stripe subscription ("Extra logins" × how many), in the subscription's billing period.
// An account can add them while it can be billed: a subscription (or demo billing), a free trial (the extras go on the subscription
// made when a card is added), or a server without Stripe (nothing is charged). Trial pages and prepaid codes otherwise keep the cap.
const canBuyExtra = (t, p) => !!(p && p.maxUsers > 0 && Number(p.extraUser) > 0) && (!stripeLib.platformKey() || onTrial(t) || t.status === 'suspended' || !!(t.billing && (t.billing.subscriptionId || t.billing.demo))); // suspended: reopening goes through Checkout, extras included
const extraCount = (p, users = db.users.length) => (p && p.maxUsers > 0 && Number(p.extraUser) > 0 ? Math.max(0, users - p.maxUsers) : 0);
async function seatProduct() {
  const P = tenancy.platform(); P.stripeProducts = P.stripeProducts || {}; const k = `${stripeLib.modeOf(stripeLib.platformKey())}:seats`;
  if (P.stripeProducts[k]) return P.stripeProducts[k];
  const p = await billingCall('POST', 'products', { name: `${P.settings.productName} extra logins`, 'metadata[seats]': '1' });
  P.stripeProducts[k] = p.id; tenancy.savePlatform(); return p.id;
}
const seatProductId = () => ((tenancy.platform().stripeProducts || {})[`${stripeLib.modeOf(stripeLib.platformKey())}:seats`]) || '';
const productOf = (item) => (item && item.price && (typeof item.price.product === 'object' ? item.price.product.id : item.price.product)) || '';
const isSeatItem = (item) => !!seatProductId() && productOf(item) === seatProductId();
// the plan's own line on a subscription (not the extra logins or an add-on)
const planItem = (sub) => { const items = (sub && sub.items && sub.items.data) || []; return items.find((i) => !isSeatItem(i) && !isMatrixItem(i)) || items[0]; };
const seatItem = (sub) => ((sub && sub.items && sub.items.data) || []).find(isSeatItem) || null;
// subscription update fields that set the extra logins line to `count` for plan p in `interval` (as items[n]); {} when nothing changes.
// Sent in the same update as a plan or billing period change, since every line on a subscription must share one period.
async function seatParams(sub, p, interval, count, n = 1) {
  const k = (f) => `items[${n}]${f}`;
  const cur = seatItem(sub); const c = count > 0 && stripeLib.seatCharge(p, interval);
  if (!c) return cur ? { [k('[id]')]: cur.id, [k('[deleted]')]: 'true' } : {};
  const same = cur && cur.quantity === count && cur.price && cur.price.unit_amount === c.cents && cur.price.recurring && cur.price.recurring.interval === c.interval;
  if (same) return {};
  return { ...(cur ? { [k('[id]')]: cur.id } : {}), [k('[quantity]')]: String(count), [k('[price_data][currency]')]: 'usd', [k('[price_data][product]')]: await seatProduct(),
    [k('[price_data][unit_amount]')]: String(c.cents), [k('[price_data][recurring][interval]')]: c.interval };
}
// bring the extra logins line in line with the account's logins now (after an invite, a removed login, a new subscription).
// The difference for the rest of the period goes on the next bill.
async function syncSeats(t) {
  if (!stripeLib.platformKey() || !t.billing || !t.billing.subscriptionId) return;
  const sub = await liveSubscription(t.billing); if (!sub) return;
  const plan = tenancy.planOf(t); const item = planItem(sub); const interval = (item && item.price && item.price.recurring && item.price.recurring.interval) || t.billing.interval || 'month';
  const p = await extraLines(sub, plan, interval, extraCount(plan), t, 0); // and the matrix add-on line, if it's out of step
  if (Object.keys(p).length) await billingCall('POST', `subscriptions/${sub.id}`, { ...p, proration_behavior: 'create_prorations' });
}
const seatsChanged = () => { const t = tenancy.current(); if (!tenancy.isDefault(t)) syncSeats(t).catch((e) => console.error(`Extra logins for ${t.slug}:`, e.message)); };
// ---------- paid add-ons: matrix pricing ($10/month, App Settings → General → Matrix line items) ----------
// The owner adds it in the app; it's a line of its own on the subscription ("Matrix pricing"), in the subscription's billing period
// (yearly: the plan's yearly discount). Removing it takes the line off with no refund and keeps the add-on until the period ends.
// On a free trial it's free until the trial ends: the line goes on the subscription made when a card is added.
// Accounts Alpha includes it for (t.matrixPricing) and the default account never pay for it.
const MATRIX_ADDON = 10; // dollars a month
const matrixCharge = (p, interval) => stripeLib.addonCharge(MATRIX_ADDON, p, interval);
const matrixBilled = (t) => !matrixFree(t) && !!(t.addons && t.addons.matrix && !t.addons.matrix.endsAt); // should have a line on the subscription
async function matrixProduct() {
  const P = tenancy.platform(); P.stripeProducts = P.stripeProducts || {}; const k = `${stripeLib.modeOf(stripeLib.platformKey())}:matrix`;
  if (P.stripeProducts[k]) return P.stripeProducts[k];
  const p = await billingCall('POST', 'products', { name: `${P.settings.productName} matrix pricing`, 'metadata[addon]': 'matrix' });
  P.stripeProducts[k] = p.id; tenancy.savePlatform(); return p.id;
}
const matrixProductId = () => ((tenancy.platform().stripeProducts || {})[`${stripeLib.modeOf(stripeLib.platformKey())}:matrix`]) || '';
const isMatrixItem = (item) => !!matrixProductId() && productOf(item) === matrixProductId();
const matrixItem = (sub) => ((sub && sub.items && sub.items.data) || []).find(isMatrixItem) || null;
// subscription update fields that put the matrix line on (or take it off) as items[n]; {} when nothing changes. A line already in the
// right period keeps its price (what they signed up at); a change of billing period reprices it.
async function matrixParams(sub, p, interval, on, n = 1) {
  const k = (f) => `items[${n}]${f}`; const cur = matrixItem(sub);
  if (!on) return cur ? { [k('[id]')]: cur.id, [k('[deleted]')]: 'true' } : {};
  if (cur && cur.price && cur.price.recurring && cur.price.recurring.interval === interval) return {};
  const c = matrixCharge(p, interval); if (!c) return {};
  return { ...(cur ? { [k('[id]')]: cur.id } : {}), [k('[quantity]')]: '1', [k('[price_data][currency]')]: 'usd', [k('[price_data][product]')]: await matrixProduct(),
    [k('[price_data][unit_amount]')]: String(c.cents), [k('[price_data][recurring][interval]')]: c.interval };
}
// every line beside the plan's (extra logins, then add-ons) from items[n] on, for a subscription update in plan p's `interval`
async function extraLines(sub, p, interval, count, t, n = 1) {
  const s = await seatParams(sub, p, interval, count, n);
  return { ...s, ...(await matrixParams(sub, p, interval, matrixBilled(t), Object.keys(s).length ? n + 1 : n)) };
}
// what the app and the billing page show about the add-on
function matrixInfo(t) {
  if (tenancy.isDefault(t)) return null; const a = matrixPaid(t); const plan = tenancy.planOf(t);
  const c = matrixCharge(plan, (t.billing && t.billing.interval) || 'month');
  return { state: t.matrixPricing ? 'included' : a ? (a.endsAt ? 'ending' : 'on') : 'off', since: a ? a.since : null, endsAt: a && a.endsAt ? a.endsAt : null, cents: c ? c.cents : 0, interval: c ? c.interval : 'month', monthly: MATRIX_ADDON };
}
// the owner adds or removes it (App Settings → General → Matrix line items)
app.post('/api/account/addons/matrix', async (req, res) => {
  if (!ownerOnly(req, res)) return;
  const t = tenancy.current(); const b = t.billing || (t.billing = {}); const u = currentUser(req); const on = !!(req.body && req.body.on);
  if (matrixFree(t)) return res.status(400).json({ error: 'Matrix pricing is already included in your account' });
  if (t.status === 'suspended') return res.status(400).json({ error: 'Your account is paused. Choose a plan in Account and billing to reopen it first.' });
  const a = t.addons && t.addons.matrix; const today = iso(new Date());
  if (a && a.endsAt && a.endsAt < today) { delete t.addons.matrix; } // ended: as if never added
  const cur = t.addons && t.addons.matrix;
  if (on && cur && !cur.endsAt) return res.status(400).json({ error: 'Matrix pricing is already on' });
  if (!on && (!cur || cur.endsAt)) return res.status(400).json({ error: 'Matrix pricing isn’t on' });
  const plan = tenancy.planOf(t); const price = (c) => `${money(c.cents / 100).replace(/\.00$/, '')}/${c.interval}`;
  try {
    const sub = stripeLib.platformKey() ? await liveSubscription(b) : null;
    const item = sub && planItem(sub); const interval = (item && item.price && item.price.recurring && item.price.recurring.interval) || b.interval || 'month';
    const c = matrixCharge(plan, interval); const paying = sub && sub.status !== 'trialing'; let message;
    if (on) {
      if (stripeLib.platformKey() && !sub && !onTrial(t) && !b.demo) return res.status(400).json({ error: supporters.lockedUntil(t) ? 'Your plan is prepaid with no card on file. Add a card in Account and billing first, or contact us to add matrix pricing.' : 'Add-ons are billed with a paid plan. Choose one in Account and billing first.' });
      const keep = !!(cur && cur.endsAt); // removed earlier this period, which is already paid for
      t.addons = t.addons || {}; t.addons.matrix = { since: keep ? cur.since : today, by: u.email };
      if (sub) await billingCall('POST', `subscriptions/${sub.id}`, { ...(await matrixParams(sub, plan, interval, true, 0)), proration_behavior: keep || !paying ? 'none' : 'create_prorations' });
      message = !c || (!stripeLib.platformKey()) || b.demo ? 'Matrix pricing is on.'
        : paying ? (keep ? `Matrix pricing is back on. It’s already paid through this billing period, then it’s ${price(c)} again.` : `Matrix pricing is on: ${price(c)}, added to your subscription. The part of this billing period that’s left is on your next bill.`)
        : `Matrix pricing is on. It’s free until your trial ends${t.expiresAt ? ` on ${niceDate(t.expiresAt)}` : ''}, then ${price(c)} with your plan.`;
      tellPlatform(`Add-on: ${t.name} added matrix pricing`, `${u.name} (${u.email}) added matrix pricing to ${t.name}${c ? ` (${price(c)})` : ''}.`);
    } else {
      if (sub) { const p = await matrixParams(sub, plan, interval, false, 0); if (Object.keys(p).length) await billingCall('POST', `subscriptions/${sub.id}`, { ...p, proration_behavior: 'none' }); }
      const end = paying && periodEndOf(sub);
      if (end && end > today) { cur.endsAt = iso(new Date(Date.parse(end + 'T12:00:00Z') - 864e5)); message = `Matrix pricing stays on until ${niceDate(cur.endsAt)}, the end of the period you’ve paid for. You won’t be charged for it again.`; }
      else { delete t.addons.matrix; message = 'Matrix pricing is off.'; }
      tellPlatform(`Add-on: ${t.name} removed matrix pricing`, `${u.name} (${u.email}) removed matrix pricing from ${t.name}.${cur.endsAt ? ` It stays on until ${niceDate(cur.endsAt)}.` : ''}`);
    }
    tenancy.savePlatform();
    res.json({ ok: true, message, account: { matrixPricing: matrixAllowed(t), matrixAddon: matrixInfo(t) } });
  } catch (e) { stripeError(res, 'change matrix pricing', e); }
});
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
// ---------- the Board (lib/forum.js): owners and admins of every business post feature requests and vote, on ideas.<domain> (lib/ideas.js) ----------
forum.init({
  send: (key, to, vars) => sendTemplate(key, to, vars, { server: true }),
  notifyTo: () => tenancy.platform().settings.contactEmail || '',
  // a login who can still use the forum (an owner or admin of that account), for reply emails
  user: (slug, id) => { const t = tenancy.platform().tenants.find((x) => x.slug === slug); return t ? tenancy.run(t, () => { const u = db.users.find((x) => x.id === id); return u && isAdmin(u) && !staffBlocked(u) ? { name: u.name, email: u.email } : null; }) : null; },
});
forum.seedRoadmap(); // once: the team's roadmap posts (lib/forum.js)
forum.roadmapShipped(); // once each: features shipped in Beta (Nov 6, and checklists & forms on Nov 8) move to Beta on the Roadmap (lib/forum.js)
// the Board's posts are on ideas.<domain> now: old /forum links (and emails) go to its Feedback page
app.get('/forum', (req, res) => res.redirect(301, tenancy.ideasUrl() + '/feedback'));
// ---------- Support Access (lib/support.js): any login can grant the platform's support team access for four weeks ----------
support.setOwnerLookup((t) => tenancy.run(t, () => { const o = db.users.find((u) => u.role === 'owner'); return o && { id: o.id, name: o.name }; }));
// the console's one-time link: signs the support admin in as the person who granted access, until the grant ends or is revoked
app.get('/support-login', (req, res) => {
  const t = tenancy.current(); const s = support.redeem(t, req.query.token);
  const user = s && db.users.find((u) => u.id === s.userId && u.passwordHash && !staffBlocked(u));
  if (!user) return res.status(400).send(notice('This support link doesn’t work', 'It was already used, is more than a few minutes old, or support access has ended. Get a new link from Alpha.'));
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
const tellSupportAdmin = (r, title, message) => { if (r.adminEmail) sendTemplate('accountActivity', r.adminEmail, { title, message, link: `${tenancy.platformUrl()}/alpha` }, { server: true }).catch(() => {}); };
// ---------- the referral program (lib/referrals.js; set up in Alpha → Pricing): the business's Refer & earn page ----------
const defaultT = () => tenancy.platform().tenants.find((t) => tenancy.isDefault(t)) || tenancy.platform().tenants[0];
referrals.init({
  sendTemplate: (key, to, vars, opts = {}) => tenancy.run(defaultT(), () => sendTemplate(key, to, vars, { server: true, ...opts })),
  ownerOf: (t) => tenancy.run(t, () => { const o = db.users.find((u) => u.role === 'owner'); return o ? { name: o.name, email: o.email } : null; }),
  tellPlatform: (title, message) => { const to = tenancy.platform().settings.contactEmail; if (to) tenancy.run(defaultT(), () => sendTemplate('accountActivity', to, { title, message, link: `${tenancy.platformUrl()}/alpha#discounts` }, { server: true })).catch(() => {}); },
});
const referralGate = (req, res) => { if (referrals.openTo(tenancy.current())) return true; res.status(404).json({ error: 'The referral program isn’t available' }); return false; };
app.get('/api/rewards', (req, res) => { if (referralGate(req, res)) res.json(referrals.pageFor(tenancy.current())); });
app.post('/api/rewards/invite', async (req, res) => {
  if (!referralGate(req, res)) return;
  try { const r = await referrals.invite(tenancy.current(), currentUser(req), req.body || {}); res.json({ ...referrals.pageFor(tenancy.current()), emailed: r.emailed, detail: r.detail }); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
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
// a Founding Supporter code (lib/supporters.js) on an existing account: prepaid months of the code's plan.
// A live subscription switches to that plan (no charge now) and its next charge moves out by the months; otherwise the
// account runs on the plan with no card until the last prepaid day, like a free trial.
app.post('/api/account/billing/redeem', async (req, res) => {
  if (!ownerOnly(req, res)) return;
  const t = tenancy.current(); const u = currentUser(req); const b = t.billing || (t.billing = {});
  if (tenancy.isDefault(t)) return res.status(400).json({ error: 'Your platform’s own account doesn’t have a plan' });
  const ck = supporters.check(req.body && req.body.code);
  if (!ck) return res.status(400).json({ error: 'That isn’t a supporter code. Discount codes are used when you sign up or choose a plan.' });
  if (ck.error) return res.status(400).json({ error: ck.error });
  const to = ck.plan;
  const bp = supporters.backerPlan(to.id === t.planId ? tenancy.planOf(t) : to, ck.p.tier); // the plan as a backer gets it: their price and logins (Advanced: 10)
  if (bp.maxUsers > 0 && db.users.length > bp.maxUsers && !canBuyExtra(t, bp)) { const extra = db.users.length - bp.maxUsers;
    return res.status(400).json({ error: `This code is for ${to.name}, which includes ${logins(bp.maxUsers)}, and you have ${db.users.length}. Remove login access for ${extra} team member${extra === 1 ? '' : 's'} first (Manage team → open a team member → Remove login access), then redeem it.` }); }
  try {
    const sub = stripeLib.platformKey() ? await liveSubscription(b) : null; let until; let message;
    if (sub) {
      const item = planItem(sub); const end = Math.max(sub.trial_end || 0, sub.current_period_end || item.current_period_end || 0, Math.floor(Date.now() / 1000)); // the next charge, as referral credit does
      const next = new Date(end * 1000); next.setUTCMonth(next.getUTCMonth() + ck.months);
      const p = { trial_end: String(Math.floor(next.getTime() / 1000)), proration_behavior: 'none', cancel_at_period_end: 'false', 'metadata[planId]': to.id };
      // after the prepaid months they pay the Founding Supporter price (or less, if this account is already locked lower)
      const c = stripeLib.planCharge(bp, (item.price.recurring && item.price.recurring.interval) || b.interval);
      if (c && t.planId === to.id && item.price.unit_amount > 0 && item.price.unit_amount < c.cents) c.cents = item.price.unit_amount; // already paying less: never raised
      if (c) Object.assign(p, { 'items[0][id]': item.id, 'items[0][price_data][currency]': 'usd', 'items[0][price_data][product]': await planProduct(to), 'items[0][price_data][unit_amount]': String(c.cents), 'items[0][price_data][recurring][interval]': c.interval }, await extraLines(sub, bp, c.interval, extraCount(bp), t)); // extra logins only past the backer's included ones
      await billingCall('POST', `subscriptions/${sub.id}`, p);
      t.planId = to.id; delete b.pendingPlanId; delete b.endsAt; until = iso(new Date(next.getTime() - 864e5));
      message = `You’re on ${to.name}, prepaid until ${niceDate(until)}. Your next charge${c ? ` of ${money(c.cents / 100)}` : ''} is on ${niceDate(iso(next))}.`;
    } else {
      const today = iso(new Date()); const from = onTrial(t) && t.expiresAt >= today ? iso(new Date(Date.parse(t.expiresAt + 'T12:00:00Z') + 864e5)) : today; // a trial's remaining days come first
      until = supporters.startPrepaid(t, ck, from);
      message = `You’re on ${to.name}, prepaid until ${niceDate(until)}. No card needed until then; add one before that date to keep your account after it.`;
    }
    supporters.redeemed(t, ck, until); // saves
    supporters.sendThanks(t, u.email, u.name, (k, to, v) => sendTemplate(k, to, v, { server: true })).catch(() => {}); // the thank-you email with the good news
    tellPlatform(`Supporter code redeemed: ${t.name}`, `${u.name} (${u.email}) redeemed ${ck.p.name}’s Founding Supporter code ${ck.p.code.code} on ${t.name}: ${ck.months} months of ${to.name}, prepaid until ${niceDate(until)}.`);
    res.json({ ok: true, message });
  } catch (e) { stripeError(res, 'redeem the code', e); }
});
// switch plan: paid → paid changes the subscription price now (difference charged or credited, prorated);
// → free takes effect when the paid period ends; free/no subscription → paid goes through Stripe Checkout
app.post('/api/account/billing/plan', async (req, res) => {
  if (!planChooser(req, res)) return;
  const t = tenancy.current(); const P = tenancy.platform(); const u = currentUser(req);
  if (tenancy.isDefault(t)) return res.status(400).json({ error: 'Your platform’s own account doesn’t have a plan to change' });
  const pick = P.plans.find((p) => p.id === (req.body && req.body.planId) && !p.hidden); if (!pick) return res.status(400).json({ error: 'Choose a plan' });
  const to = pick.id === t.planId ? tenancy.planOf(t) : pick; // the current plan at the price it's locked at, e.g. monthly → yearly
  const locked = supporters.lockedUntil(t); // prepaid months from a supporter code are for one plan
  if (locked) return res.status(400).json({ error: `Your ${tenancy.planOf(t).name} plan is prepaid until ${niceDate(locked)}, so it can’t be changed before then. Contact us if you need a different plan.` });
  const from = tenancy.planOf(t); const b = t.billing || (t.billing = {});
  if (to.id !== t.planId && to.maxUsers > 0 && db.users.length > to.maxUsers && !canBuyExtra(t, to)) { const extra = db.users.length - to.maxUsers; // a smaller team plan: remove the extra logins first
    return res.status(400).json({ error: `${to.name} includes ${logins(to.maxUsers)} and you have ${db.users.length}. Remove login access for ${extra} team member${extra === 1 ? '' : 's'} first (Manage team → open a team member → Remove login access), then switch.`, upgrade: 'users' }); }
  const want = req.body.interval === 'year' ? 'year' : 'month'; const c = stripeLib.planCharge(to, want);
  if (c && c.interval !== want) return res.status(400).json({ error: `${to.name} isn’t available ${want === 'year' ? 'yearly' : 'monthly'}` });
  const label = `${to.name}${c ? ` (${want === 'year' ? 'yearly' : 'monthly'})` : ''}`;
  if (t.status === 'suspended') return reopen(req, res, t, to, c, label);
  const switched = (message) => { if (c) b.interval = c.interval; if (t.planId === to.id && !onTrial(t)) delete t.expiresAt; tenancy.savePlatform(); if (c && t.planId === to.id && !onTrial(t)) referrals.paid(t).catch(() => {}); tellPlatform(`Plan changed: ${t.name} → ${label}`, `${u.name} (${u.email}) changed ${t.name} from ${from.name} to ${label}. ${message}`); res.json({ ok: true, message }); };
  try {
    const sub = stripeLib.platformKey() ? await liveSubscription(b) : null;
    const nowItem = sub && planItem(sub); const nowInterval = (nowItem && nowItem.price.recurring && nowItem.price.recurring.interval) || b.interval || 'month';
    if (to.id === t.planId && !b.pendingPlanId && (!c || c.interval === nowInterval)) return res.status(400).json({ error: `You’re already on ${label}` });
    if (onTrial(t) && !sub) { // free trial, no card yet: switch now; a paid plan stays free until the trial ends, a free plan ends the trial
      t.planId = to.id; if (!c) { b.status = 'free'; delete b.trial; delete t.expiresAt; return switched(`You’re now on ${to.name}.`); }
      return switched(`You’re now on ${label}. It’s free until your trial ends on ${niceDate(t.expiresAt)}. Add a card before then to keep your account.`);
    }
    if (!stripeLib.platformKey()) { t.planId = to.id; delete b.pendingPlanId; delete b.endsAt; return switched(`You’re now on ${label}.`); } // no Stripe on this server: demo
    if (!c) { // free plan
      if (!sub) { t.planId = to.id; delete b.pendingPlanId; delete b.endsAt; return switched(`You’re now on ${to.name}.`); }
      if (to.id === t.planId) { delete b.pendingPlanId; delete b.endsAt; await billingCall('POST', `subscriptions/${sub.id}`, { cancel_at_period_end: 'false' }); return switched(`You’ll stay on ${to.name}.`); }
      await billingCall('POST', `subscriptions/${sub.id}`, { cancel_at_period_end: 'true' });
      b.pendingPlanId = to.id; b.endsAt = periodEndOf(sub);
      return switched(`You’ll move to ${to.name} on ${niceDate(b.endsAt)}, when your paid period ends. You won’t be charged again.`);
    }
    if (sub) {
      const item = planItem(sub); const extra = extraCount(to); const sc = extra && stripeLib.seatCharge(to, c.interval);
      const s2 = await billingCall('POST', `subscriptions/${sub.id}`, { 'items[0][id]': item.id, 'items[0][price_data][currency]': 'usd', 'items[0][price_data][product]': await planProduct(to),
        'items[0][price_data][unit_amount]': String(c.cents), 'items[0][price_data][recurring][interval]': c.interval, proration_behavior: 'always_invoice', payment_behavior: 'error_if_incomplete',
        cancel_at_period_end: 'false', 'metadata[planId]': to.id, ...(await extraLines(sub, to, c.interval, extra, t)) });
      const plus = sc ? `, plus ${money(sc.cents / 100)} each ${sc.interval} for each of your ${extra} extra login${extra === 1 ? '' : 's'}` : '';
      t.planId = to.id; delete b.pendingPlanId; delete b.endsAt; b.subscriptionStatus = s2.status; if (c.regular) tenancy.lockSale(t, to.id, stripeLib.saleLock(to)); // switched at a sale price: kept for good
      return switched(c.interval !== nowInterval ? `You’re now on ${label}. Your unused time is credited and the new ${c.interval}ly price of ${money(c.cents / 100)}${plus} is charged now; it renews every ${c.interval}.`
        : `You’re now on ${label}. Any difference for the rest of this billing period is charged or credited now, and you’ll pay ${money(c.cents / 100)} each ${c.interval}${plus} from your next bill.`);
    }
    // no paid subscription yet: pay at Stripe Checkout; the plan switches when the payment goes through
    const s = await subscribeSession(t, u, to, c); res.json({ redirect: s.url });
  } catch (e) { stripeError(res, 'change the plan', e); }
});
// a paused account choosing a plan: a paid plan goes to Stripe Checkout and reopens the account when it's paid (no trial);
// a free plan, or any plan on a server without Stripe, reopens it now
async function reopen(req, res, t, to, c, label) {
  const P = tenancy.platform(); const u = currentUser(req); const b = t.billing || (t.billing = {});
  if (!canReopen(t)) return res.status(400).json({ error: `Your account was paused by ${P.settings.productName}.${P.settings.contactEmail ? ` Contact ${P.settings.contactEmail} to reopen it.` : ' Contact us to reopen it.'}` });
  try {
    if (c && stripeLib.platformKey()) {
      if (await liveSubscription(b)) return res.status(400).json({ error: 'Your last payment didn’t go through. Update your card and we’ll retry it and reopen your account.' });
      const s = await subscribeSession(t, u, to, c, { trial: false }); return res.json({ redirect: s.url });
    }
    const from = tenancy.planOf(t); t.planId = to.id; tenancy.resume(t); delete t.expiresAt; delete b.pendingPlanId; delete b.endsAt;
    if (c) b.interval = c.interval; else { b.status = 'free'; delete b.trial; }
    tenancy.savePlatform(); tellPlatform(`Account reopened: ${t.name} → ${label}`, `${u.name} (${u.email}) reopened ${t.name} on ${label} (was ${from.name}).`);
    res.json({ ok: true, message: `Your account is open again on ${label}.` });
  } catch (e) { stripeError(res, 'start the payment', e); }
}
// Stripe Checkout for a new subscription. On a free trial the card is saved now and the first charge waits until the trial ends
// (Stripe needs that to be at least 48 hours away, so a trial in its last two days gets the extra time).
async function subscribeSession(t, u, to, c, { trial = onTrial(t) } = {}) {
  const b = t.billing || {};
  const p = { mode: 'subscription', client_reference_id: t.id, 'metadata[tenantId]': t.id, 'metadata[planId]': to.id, 'metadata[interval]': c.interval, 'subscription_data[metadata][tenantId]': t.id,
    'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][product]': await planProduct(to),
    'line_items[0][price_data][unit_amount]': String(c.cents), 'line_items[0][price_data][recurring][interval]': c.interval, 'payment_method_types[0]': 'card',
    success_url: `${baseUrl()}/settings/billing?checkout={CHECKOUT_SESSION_ID}`, cancel_url: `${baseUrl()}/settings/billing` };
  const extra = extraCount(to); const sc = extra && stripeLib.seatCharge(to, c.interval); // logins past the plan's included ones, as a second line
  if (sc) Object.assign(p, { 'line_items[1][quantity]': String(extra), 'line_items[1][price_data][currency]': 'usd', 'line_items[1][price_data][product]': await seatProduct(),
    'line_items[1][price_data][unit_amount]': String(sc.cents), 'line_items[1][price_data][recurring][interval]': sc.interval });
  const mc = matrixBilled(t) && matrixCharge(to, c.interval); const mi = sc ? 2 : 1; // the matrix pricing add-on, as the next line
  if (mc) Object.assign(p, { [`line_items[${mi}][quantity]`]: '1', [`line_items[${mi}][price_data][currency]`]: 'usd', [`line_items[${mi}][price_data][product]`]: await matrixProduct(),
    [`line_items[${mi}][price_data][unit_amount]`]: String(mc.cents), [`line_items[${mi}][price_data][recurring][interval]`]: mc.interval });
  if (b.customerId) p.customer = b.customerId; else p.customer_email = u.email;
  Object.assign(p, stripeLib.saleLockMeta(to)); // a sale price is kept for good once this goes through (billing/return, or the webhook)
  Object.assign(p, referrals.bankedTrial(t)); // free months earned by referring other businesses
  if (b.retention && b.retention.pending && b.retention.coupon) p['discounts[0][coupon]'] = await discountsLib.stripeCoupon(stripeLib.platformKey(), b.retention.coupon); // a stay offer claimed during the trial
  if (trial) {
    const end = Math.max(Math.floor((Date.parse(t.expiresAt) + 864e5) / 1000), Math.ceil(Date.now() / 1000) + 49 * 3600);
    if (!(Number(p['subscription_data[trial_end]']) > end)) p['subscription_data[trial_end]'] = String(end);
    p['metadata[firstCharge]'] = unix(Number(p['subscription_data[trial_end]']));
  }
  return billingCall('POST', 'checkout/sessions', p);
}
// back from Checkout (new subscription) or the card page (new card): check the session with Stripe, then apply it
app.post('/api/account/billing/return', async (req, res) => {
  if (!planChooser(req, res)) return;
  const t = tenancy.current(); const b = t.billing || (t.billing = {}); const id = String((req.body && req.body.sessionId) || '');
  if (!/^cs_[A-Za-z0-9_]+$/.test(id) || !stripeLib.platformKey()) return res.status(400).json({ error: 'That payment link isn’t valid' });
  try {
    const s = await billingCall('GET', `checkout/sessions/${encodeURIComponent(id)}?expand[]=setup_intent`);
    if (!s.metadata || s.metadata.tenantId !== t.id || s.status !== 'complete') return res.status(400).json({ error: 'That payment wasn’t completed' });
    if (s.mode === 'subscription') {
      const to = tenancy.platform().plans.find((p) => p.id === s.metadata.planId);
      if (to && s.subscription && b.subscriptionId !== s.subscription) {
        const from = tenancy.planOf(t); t.planId = to.id; tenancy.lockSale(t, to.id, s.metadata);
        delete t.expiresAt; // paid for a plan: no end date
        Object.assign(b, { customerId: s.customer, subscriptionId: s.subscription, status: 'paid', subscriptionStatus: 'active', interval: s.metadata.interval === 'year' ? 'year' : 'month' }); delete b.pendingPlanId; delete b.endsAt; delete b.demo;
        if (canReopen(t)) { tenancy.resume(t); delete b.trial; } delete b.pausedForBilling;
        if (b.retention) delete b.retention.pending; // a stay offer from the trial is on this subscription now
        referrals.useBanked(t, s.metadata.creditUntil); referrals.paid(t).catch(() => {}); // free months from referrals; and reward whoever referred this account
        tenancy.savePlatform(); tellPlatform(`New subscription: ${t.name} → ${to.name}`, `${currentUser(req).name} subscribed ${t.name} to ${to.name} (was ${from.name}).`);
      }
      return res.json({ ok: true, message: s.metadata.firstCharge ? `Your card is saved. Your ${to ? to.name : ''} plan’s first payment is on ${niceDate(s.metadata.firstCharge)}.` : to ? `You’re now on ${to.name}. Thank you!` : 'Payment received' });
    }
    const pm = s.setup_intent && s.setup_intent.payment_method; if (!pm) return res.status(400).json({ error: 'No card was saved' });
    await useCard(b, typeof pm === 'string' ? pm : pm.id);
    if (tenancy.pauseReason(t) === 'billing') {
      const sub = await liveSubscription(b);
      if (sub && sub.status === 'active') { tenancy.resume(t); b.subscriptionStatus = 'active'; tenancy.savePlatform(); tellPlatform(`Account reopened: ${t.name}`, `${currentUser(req).name} updated the card for ${t.name}; the unpaid bill went through and the account is open again.`); return res.json({ ok: true, message: 'Your card is updated and your payment went through. Your account is open again.' }); }
      return res.json({ ok: true, message: 'Your card is updated, but the unpaid bill still didn’t go through. Try another card, or contact your bank.' });
    }
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
  if (!planChooser(req, res)) return;
  if (!stripeLib.platformKey()) return res.status(400).json({ error: 'Card payments aren’t set up on this server' });
  const t = tenancy.current();
  try {
    if (onTrial(t) && !(await liveSubscription(t.billing))) { // free trial: the card goes on a subscription to the current plan, charged when the trial ends
      const plan = tenancy.planOf(t); const c = stripeLib.planCharge(plan, t.billing.interval);
      if (c) { const s = await subscribeSession(t, currentUser(req), plan, c); return res.json({ redirect: s.url }); }
    }
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
// ---------- Modify subscription (Account and billing): the offers made before cancelling ----------
// The steps, the offers' terms and the reasons are set in Alpha → Accounts → Cancellation flow (lib/retention.js), which also logs each flow.
// One stay discount per account: the stay offer (when the reason leads to it) or the parting gift. On a paid subscription Stripe
// applies the coupon now; during a free trial it's kept, with the terms of the day, and applied when the card is added.
function retentionInfo(t) {
  const C = retention.config(); const b = t.billing || {}; const r = b.retention || {}; const trial = onTrial(t) && !(b.trial && b.trial.prepaid);
  // only a free trial (not a paid or prepaid account), and only when it has C.extend.within days or fewer left (t.expiresAt is its last day)
  const end = Date.parse((t.expiresAt || '') + 'T00:00:00Z'); const from = new Date((Number.isFinite(end) ? end : Date.now()) - C.extend.within * 864e5);
  return { offer: r.offer || null, pending: !!r.pending, extendDays: C.extend.days, extendFrom: from.toISOString().slice(0, 10),
    canExtend: C.extend.on && trial && t.status === 'active' && (t.expiresAt || '') >= iso(new Date()) && !(b.trial && b.trial.extended) && !b.subscriptionId && Date.now() >= from.getTime(), // an ended (paused) trial can’t be extended extended: !!(b.trial && b.trial.extended),
    config: (({ extend, sprint, tour, stay, lose, feedback, gift, password, yearly, reasons }) => ({ extend, sprint, tour, stay, lose, feedback, gift, password, yearly, reasons }))(C) };
}
const flowId = (req) => String((req.body && req.body.flowId) || '');
// the popup reports the reason picked, the offer shown, feedback, and a setup plan, tour or closing the popup without cancelling
app.post('/api/account/billing/flow', (req, res) => {
  if (!ownerOnly(req, res)) return;
  const t = tenancy.current(); const u = currentUser(req); const b = req.body || {};
  if (b.reason) retention.start(t, u, { id: b.flowId, reason: b.reason }, { plan: tenancy.planOf(t).name, trial: onTrial(t) });
  retention.note(t, b.flowId, { offer: b.offer, gift: b.gift, ...('feedback' in b ? { feedback: b.feedback } : {}), outcome: ['sprint', 'tour', 'closed'].includes(b.outcome) ? b.outcome : '' });
  res.json({ ok: true });
});
app.post('/api/account/billing/retain', async (req, res) => {
  if (!ownerOnly(req, res)) return;
  if (isPaused()) return res.status(403).json({ error: 'Your account is paused. Choose a plan to make changes again.', paused: true }); // offers are only for an account that’s still running
  const t = tenancy.current(); const b = t.billing || (t.billing = {}); const u = currentUser(req); const what = String((req.body && req.body.offer) || ''); const C = retention.config();
  if (what === 'extend') {
    const ri = retentionInfo(t);
    if (!ri.canExtend) return res.status(400).json({ error: !onTrial(t) || (b.trial && b.trial.prepaid) ? 'Only free trials can be extended' : b.trial.extended ? 'Your trial has already been extended' : `Your trial can be extended from ${niceDate(ri.extendFrom)}, when it has ${C.extend.within} days or fewer left` });
    t.expiresAt = new Date(Date.parse(t.expiresAt) + C.extend.days * 864e5).toISOString().slice(0, 10); b.trial.extended = new Date().toISOString(); delete b.trial.cancelled; tenancy.savePlatform();
    retention.note(t, flowId(req), { outcome: 'extended' });
    tellPlatform(`Trial extended: ${t.name}`, `${u.name} (${u.email}) extended the free trial for ${t.name} by ${C.extend.days} days, to ${niceDate(t.expiresAt)}.`);
    return res.json({ ok: true, message: `Your trial now runs until ${niceDate(t.expiresAt)}` });
  }
  if (!['stay', 'gift'].includes(what) || !C[what].on) return res.status(400).json({ error: 'That offer isn’t available' });
  const o = retention.coupon(what);
  if (b.retention && b.retention.offer) return res.status(400).json({ error: 'You’ve already claimed a discount' });
  if (!stripeLib.platformKey()) return res.status(400).json({ error: 'Card payments aren’t set up on this server' });
  const pc = stripeLib.planCharge(tenancy.planOf(t), b.interval); if (!pc) return res.status(400).json({ error: 'Your plan has nothing to discount' });
  if (pc.interval !== 'month' && !C.yearly) return res.status(400).json({ error: 'Stay discounts are for monthly billing' });
  try {
    const sub = await liveSubscription(b);
    if (sub) await billingCall('POST', `subscriptions/${sub.id}`, { 'discounts[0][coupon]': await discountsLib.stripeCoupon(stripeLib.platformKey(), o), ...(sub.cancel_at_period_end ? { cancel_at_period_end: 'false' } : {}) });
    else if (!onTrial(t)) return res.status(400).json({ error: 'This account doesn’t have a subscription to discount' });
    b.retention = { offer: what, coupon: o, at: new Date().toISOString(), pending: !sub }; if (!sub && b.trial) delete b.trial.cancelled; if (sub) { delete b.endsAt; delete b.pendingPlanId; }
    tenancy.savePlatform(); retention.note(t, flowId(req), { outcome: what });
    tellPlatform(`Stay offer claimed: ${t.name}`, `${u.name} (${u.email}) claimed ${o.label} on the ${tenancy.planOf(t).name} plan for ${t.name} instead of cancelling.`);
    res.json({ ok: true, message: sub ? `Done: ${o.label}` : `Done: ${o.label}, applied when you add a card` });
  } catch (e) { stripeError(res, 'apply the discount', e); }
});
app.post('/api/account/billing/cancel', async (req, res) => {
  if (!ownerOnly(req, res)) return;
  const t = tenancy.current(); const b = t.billing || {}; const undo = !!(req.body && req.body.undo); const u = currentUser(req);
  if (!undo && u.passwordHash && retention.config().password.on) { // cancelling is confirmed with the owner's password (Modify subscription → Cancel plan; Alpha can turn it off)
    const key = 'pw|' + u.id; if (tooMany(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    if (!checkPassword(String((req.body && req.body.password) || ''), u)) { recordFailure(key); return res.status(400).json({ error: 'That password is incorrect' }); }
  }
  if (onTrial(t)) { // free trial, no card: it keeps working until the trial's last day, then pauses (undo keeps the trial going)
    if (undo) delete b.trial.cancelled; else { b.trial.cancelled = new Date().toISOString(); retention.note(t, flowId(req), { outcome: 'cancelled' }); } tenancy.savePlatform();
    tellPlatform(`${undo ? 'Trial cancellation withdrawn' : 'Trial cancelled'}: ${t.name}`, `${u.name} (${u.email}) ${undo ? 'kept the free trial' : `cancelled the free trial for ${t.name}. It keeps working until ${niceDate(t.expiresAt)}, then it’s paused`}.${!undo && req.body && req.body.reason ? `\n\nReason: ${req.body.reason}` : ''}`);
    return res.json({ ok: true, message: undo ? 'Your free trial continues' : `Your trial is cancelled. You can use ${tenancy.platform().settings.productName} until ${niceDate(t.expiresAt)}.` });
  }
  if (!stripeLib.platformKey()) return res.status(400).json({ error: 'This account doesn’t have a subscription to cancel. Contact us to close it.' });
  try {
    const sub = await liveSubscription(b); if (!sub) return res.status(400).json({ error: 'This account doesn’t have a subscription to cancel. Contact us to close it.' });
    const s = await billingCall('POST', `subscriptions/${sub.id}`, { cancel_at_period_end: undo ? 'false' : 'true', ...(undo ? {} : { 'cancellation_details[comment]': String((req.body && req.body.reason) || '').slice(0, 500) }) });
    delete b.pendingPlanId; if (undo) delete b.endsAt; else { b.endsAt = periodEndOf(s); retention.note(t, flowId(req), { outcome: 'cancelled' }); } tenancy.savePlatform();
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
    industry: db.company.industry || '', industryOther: db.company.industryOther || '',
    lastLoginAt: db.users.map((u) => u.lastLoginAt || '').sort().pop() || null };
});
const helpApp = require('./lib/help')({ sendTemplate, normEmail, emails });
const ideasApp = require('./lib/ideas')({
  // a one-time pass from GET /ideas/sso: { tenantId, userId } once, then it's gone
  claim: (tok) => { const k = sha(String(tok || '')); const x = ideasPasses.get(k); ideasPasses.delete(k); return x && x.expires > Date.now() ? x : null; },
  // who an ideas.<domain> session is: the login as the Board sees it, or null when it's gone or deactivated
  actor: (tenantId, userId) => {
    const t = tenancy.platform().tenants.find((x) => x.id === tenantId); if (!t) return null;
    return tenancy.run(t, () => {
      const u = db.users.find((x) => x.id === userId); if (!u || !u.passwordHash || staffBlocked(u)) return null;
      return { t: t.slug, u: u.id, name: u.name, email: u.email, role: u.role, company: db.company.name || t.slug, admin: isAdmin(u), url: tenancy.tenantUrl(t) };
    });
  },
  sha,
});
const legal = require('./lib/legal');
// moving a business's records over from another app: done from Alpha only (lib/data-import.js); imported records are marked imported
const dataImport = require('./lib/data-import')({ db, save, uid, token, iso, round2, computeTotals, cleanCat, invoiceCredits, nextNumber, docPrefix, NUMBERING });
const platformApp = require('./lib/platform')({
  hashPassword, checkPassword, sha, normEmail, cookies, tooMany, recordFailure, clearFailures: (k) => failures.delete(k),
  createOwner, ownerLink, sendVerifyEmail, sendPasswordReset, loginsFor, handoffUrl, tenantStats, endSupportSessions, sendEmail, sendTemplate, sendSms, emailProvider: serverEmailProvider, applyStripeSession, syncStripeAccount, resetDemo, saveConnection, saveAccounting, setCompanyEmail: (e) => { if (!db.company.email) { db.company.email = e; save(); } }, setCompanyPhone: (p) => { if (p && !db.company.phone) { db.company.phone = p; save(); } },
  setCompanyIndustry: (i) => { Object.assign(db.company, i); save(); },
  planProduct, // the Stripe product for a plan (Alpha → an account → Subscription → Change plan)
  planItem, seatItem, seatParams, extraCount, extraLines, matrixItem, syncSeats, // a subscription’s plan line, extra logins line and add-on lines
  dataImport, // Alpha → an account → Import data
});
// which app answers: the platform's (its own domain, or /alpha… while developing) or an account's
const PLATFORM_PATHS = /^\/(alpha(\/.*)?|platform(\/.*)?|stripe\/go\/[a-z]+|oauth\/(google|meta|tiktok|linkedin|pinterest|threads|quickbooks|xero)\/callback|home|features|marketing|partners(\/[a-f0-9]+)?|go\/[A-Za-z0-9_-]+|quote-from-photos|good-better-best|pricing|signup|sign-in|supporters|industries(\/[a-z-]+)?|checkout\/.*|checkout\.(js|html)|api\/platform\/.*|api\/site(\/.*)?)$/;
function dispatch(req, res) {
  // www. → the bare domain, so search engines see one copy of each page (the canonical links name the bare domain). Page loads only: a form or webhook posted to www. still works
  if (!tenancy.devMode && /^(GET|HEAD)$/.test(req.method) && tenancy.hostOnly(req.headers.host) === 'www.' + tenancy.PLATFORM_DOMAIN) { res.writeHead(301, { Location: tenancy.platformUrl() + req.url }); return res.end(); }
  if (brandLib.serve(req, res) || brandLib.serveTheme(req, res)) return; // the application logo and website colors (lib/brand.js), on every address
  if (tiktokLib.serve(req, res)) return; // Alpha → Social photos and videos (lib/tiktok.js): TikTok downloads them from here
  if (maintenance.handle(req, res)) return; // maintenance mode (Alpha → Settings): the maintenance page for everyone but you
  const p = req.url.split('?')[0]; const r = tenancy.resolve(req.headers.host);
  // robots.txt, sitemap.xml, and no search results for account apps, client links or Alpha (lib/seo.js)
  if (seo.handle(req, res, tenancy.isHelpHost(req.headers.host) ? 'help' : r.kind === 'platform' ? 'platform' : 'account')) return;
  if ((r.kind === 'platform' || tenancy.isHelpHost(req.headers.host) || tenancy.isIdeasHost(req.headers.host)) && brandLib.serveIcon(req, res)) return; // the app icon (Settings → Your product); accounts use it too, through their /favicon.ico
  if (chat.handle(req, res, { tenant: r.kind === 'tenant' ? r.tenant : null })) return; // the chat button (lib/chat.js), on every address
  // pages and API replies depend on who is logged in: hosting caches (e.g. SiteGround's dynamic cache) must never store or share them
  if (!/\.(js|css|png|jpe?g|gif|webp|svg|ico|woff2?)$/i.test(p)) res.setHeader('Cache-Control', 'private, no-store');
  else if (/\.(js|css)$/i.test(p)) res.setHeader('Cache-Control', 'no-cache'); // the app's code: always check for a newer version, so a deploy shows up right away
  if (legal.kindOf(p)) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(legal.page(legal.kindOf(p))); } // Terms + Privacy: the same on every address
  // Intuit's "Disconnect URL": where QuickBooks sends someone who disconnects the app from inside QuickBooks. The token is revoked on their side, so the next sync asks the account to reconnect
  // Intuit's "Connect/Reconnect URL" (and Launch URL): sign in, then the account's Settings → QuickBooks & Xero, where Connect starts
  if (/^\/oauth\/quickbooks\/(connect|reconnect|launch)\/?$/.test(p)) { res.writeHead(302, { Location: `${tenancy.platformUrl()}/sign-in?next=${encodeURIComponent('/settings/accounting')}` }); return res.end(); }
  if (/^\/oauth\/quickbooks\/disconnect(ed)?\/?$/.test(p)) {
    const name = tenancy.platform().settings.productName || 'Worklio Pro';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(notice('QuickBooks disconnected', `QuickBooks is no longer connected to ${esc(name)}, and nothing more will be sent to it. Clients, invoices and payments already sent stay in QuickBooks.<br><br>To connect again, sign in to ${esc(name)} and go to Settings → QuickBooks &amp; Xero.<br><br><a href="${tenancy.platformUrl()}/oauth/quickbooks/connect">Sign in to reconnect</a>`));
  }
  const sl = /^\/s\/([a-z0-9]{7})$/.exec(p); const slTo = sl && shortLinks()[sl[1]]; // a short link from a text
  if (slTo) { res.writeHead(302, { Location: slTo }); return res.end(); }
  if (sl) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(notice('Link not found', 'This link isn’t valid. Check the text you were sent, or contact the business that sent it.')); }
  if (tenancy.isHelpHost(req.headers.host)) return helpApp(req, res);
  if (tenancy.isIdeasHost(req.headers.host)) return ideasApp(req, res); // the public Roadmap, Feedback and Changelog (lib/ideas.js)
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
  if (!a) { console.error(P.admins.length ? `No Alpha login with that email. Alpha logins: ${P.admins.map((x) => x.email).join(', ')}` : 'There is no Alpha login yet: open /alpha to create one'); process.exit(1); }
  if (pw.length < 10) { console.error('Password must be at least 10 characters'); process.exit(1); }
  Object.assign(a, (({ salt, hash }) => ({ salt, passwordHash: hash }))(hashPassword(pw)));
  for (const [k, s] of Object.entries(P.sessions)) if (s.adminId === a.id) delete P.sessions[k]; // log out everywhere
  tenancy.savePlatform(); console.log(`Platform password updated for ${a.email}`); process.exit(0);
}
setTimeout(remindExpiring, 10e3); setInterval(remindExpiring, 3600e3); // reminder emails before an account's last day of access
setTimeout(() => bizAuto.runAll().catch((e) => console.error('automations:', e.message)), 30e3); setInterval(() => bizAuto.runAll().catch((e) => console.error('automations:', e.message)), 3600e3); // checks every automation hourly
const jobPostsMonthly = () => { for (const t of tenancy.platform().tenants) if (t.status === 'active') tenancy.run(t, () => { try { jobPosts.monthlyReport(); } catch (e) { console.error('job posts:', e.message); } }); };
setTimeout(jobPostsMonthly, 40e3); setInterval(jobPostsMonthly, 3600e3); // Every job markets itself: last month's results on the 1st
setTimeout(billMemberships, 35e3); setInterval(billMemberships, 3600e3); // service plans: each billing period's invoice
setTimeout(lateFeesAll, 50e3); setInterval(lateFeesAll, 3600e3); // late fees on past-due invoices (App Settings → Payments → Late fees)
setTimeout(extendSeries, 25e3); setInterval(extendSeries, 3600e3); // recurring jobs: make visits as the months go by
setTimeout(pushOverviews, 20e3); setInterval(pushOverviews, 15 * 60e3); // the morning's Today's work overview notifications
setTimeout(() => keepConnections().catch(() => {}), 90e3); setInterval(() => keepConnections().catch(() => {}), 6 * 3600e3); // social sign-ins: renewed before they run out
setTimeout(() => syncAllBooks().catch(() => {}), 45e3); setInterval(() => syncAllBooks().catch(() => {}), 15 * 60e3); // QuickBooks & Xero: send what's new
require('http').createServer(dispatch).listen(PORT, () => {
  console.log(`App running at ${BASE_URL}`);
  console.log(tenancy.devMode ? `Alpha console: ${BASE_URL}/alpha (set PLATFORM_DOMAIN to host accounts on their own addresses)` : `Platform: ${tenancy.platformUrl()}  ·  accounts at <address>.${tenancy.PLATFORM_DOMAIN}`);
});
