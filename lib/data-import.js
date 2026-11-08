'use strict';
// Data import from other field service apps (Alpha → Accounts → a business → Import data). Not offered to businesses:
// moving a business's history over is a service sold and done from Alpha.
// The browser parses the CSV export and matches its columns; this file turns the matched rows into the account's records.
// Every record it makes is marked imported: { batch, source, number? } so that
//   - late fees, review requests and QuickBooks / Xero sync leave it alone,
//   - business automations only act on its moments from the day it was imported (and never "New client" for an imported client),
//   - a whole import can be undone from Alpha (db.importLog).
// Payments are written straight onto invoices (no review emails, no checks against today's balance), so history comes in as it was.

const SOURCES = {
  jobber: 'Jobber', housecallpro: 'Housecall Pro', workiz: 'Workiz', servicetitan: 'ServiceTitan', quickbooks: 'QuickBooks',
  square: 'Square', fieldedge: 'FieldEdge', other: 'a spreadsheet',
};
const KINDS = ['clients', 'services', 'quotes', 'jobs', 'invoices', 'payments', 'expenses'];
const MAX_ROWS = 2000; // per request; the browser sends a big file in parts, all in one import

module.exports = function dataImport(H) {
  // H: db, save, uid, token, iso, round2, computeTotals, cleanCat, invoiceCredits, nextNumber, docPrefix, NUMBERING
  const { db } = H;
  const str = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const text = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
  const num = (v) => { if (v === '' || v == null) return null; const n = Number(v); return Number.isFinite(n) ? H.round2(n) : null; };
  const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
  const today = () => H.iso(new Date());
  const notFuture = (d) => (d && d > today() ? today() : d);
  const lc = (s) => String(s || '').trim().toLowerCase();
  const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);
  const log = () => (db.importLog = db.importLog || []);
  const nowIso = () => new Date().toISOString();

  // ---------- clients: found by email, then phone, then name; made when missing ----------
  function cleanClient(c = {}) {
    const name = str(c.name, 200) || str(c.company, 200);
    return { name, company: str(c.company, 200), email: str(String(c.email || '').split(/[\s,;]+/)[0], 200), phone: str(c.phone, 50), address: str(c.address, 500) };
  }
  function findClient(c) {
    const e = lc(c.email); const p = digits(c.phone); const n = lc(c.name); const co = lc(c.company);
    return (e && db.clients.find((x) => lc(x.email) === e))
      || (p.length >= 7 && db.clients.find((x) => digits(x.phone) === p))
      || (n && db.clients.find((x) => lc(x.name) === n && (!co || !x.company || lc(x.company) === co)))
      || (!n && co && db.clients.find((x) => lc(x.company) === co)) || null;
  }
  function clientFor(raw, ctx) {
    const c = cleanClient(raw); if (!c.name && !c.email && !c.phone) return null;
    const found = findClient(c); if (found) return found;
    if (!ctx.opts.createClients || !c.name) return null;
    const doc = { id: H.uid(), ...c, tags: [], notes: '', createdAt: today(), portalToken: H.token(), imported: { batch: ctx.batch.id, source: ctx.source } };
    db.clients.push(doc); ctx.out.clientsCreated++; return doc;
  }

  // ---------- numbers: the old app's number when it's free, else a new one (the old number is kept on imported.number) ----------
  function numberFor(col, raw) {
    const n = str(raw, 30).replace(/^#\s*/, '');
    if (!n || db[col].some((d) => lc(d.number) === lc(n))) return H.nextNumber(col);
    const [pk, key] = H.NUMBERING[col]; const prefix = H.docPrefix(pk);
    const m = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$', 'i').exec(n);
    if (m && Number(m[1]) > db.counters[key]) db.counters[key] = Number(m[1]);
    return n;
  }
  const oldNumber = (raw) => str(raw, 30).replace(/^#\s*/, '');
  // an imported record with this number from the same app (so importing a file twice doesn't double it)
  const already = (col, source, n) => n && db[col].find((d) => d.imported && d.imported.source === source && lc(d.imported.number) === lc(n));
  const byNumber = (col, source, n) => (n ? already(col, source, n) || db[col].find((d) => lc(d.number) === lc(n)) : null);

  // ---------- amounts and lines for quotes, jobs and invoices ----------
  // r.items: lines from a line-item export (several rows per document); otherwise one line for the whole document.
  // The document keeps the old app's subtotal, tax and total so reports match what the business saw there.
  function priceDoc(doc, r, label) {
    const total = num(r.total); const tax = Math.max(0, num(r.tax) || 0); const discount = Math.max(0, num(r.discount) || 0);
    let items = (Array.isArray(r.items) ? r.items : []).map((i) => {
      const qty = num(i.qty) ?? 1; const lineTotal = num(i.lineTotal); const price = num(i.price) ?? (lineTotal != null && qty ? H.round2(lineTotal / qty) : 0);
      return { desc: str(i.desc, 200) || 'Item', details: text(i.details, 2000), qty, cost: price, markup: 0, markupType: 'percent', price };
    }).filter((i) => i.desc);
    const subtotal = num(r.subtotal) ?? (total != null ? H.round2(total - tax + discount) : null);
    if (!items.length) {
      const price = subtotal ?? 0;
      items = [{ desc: str(r.title, 200) || `Work from ${label}`, details: text(r.lineDetails, 2000), qty: 1, cost: price, markup: 0, markupType: 'percent', price }];
    }
    doc.items = items; doc.discountType = 'flat'; doc.discountValue = discount;
    const base = items.reduce((s, i) => s + i.qty * i.price, 0) - discount;
    doc.taxRate = tax > 0 && base > 0 ? Math.round((tax / base) * 1e6) / 1e4 : 0;
    H.computeTotals(doc);
    if (total != null && Math.abs(doc.total - total) > 0.004) { // keep the old app's total; the difference goes in the tax (rounding)
      const t = H.round2(total - (doc.subtotal - doc.discount));
      if (t >= 0) { doc.tax = t; doc.total = total; }
    }
  }

  // ---------- statuses ----------
  const jobStatus = (s, date) => (/cancel/i.test(s) ? 'cancelled' : /complete|closed|done|archiv|finish|invoic|paid/i.test(s) ? 'completed'
    : !s && date && date < today() ? 'completed' : 'scheduled');
  const quoteStatus = (s) => (/approv|accept|won|convert|sold|signed|job/i.test(s) ? 'approved' : /declin|reject|lost|archiv|expire/i.test(s) ? 'declined' : /draft/i.test(s) ? 'draft' : 'sent');
  const METHODS = [['cash', /^cash$|cash payment/i], ['check', /che(ck|que)/i], ['zelle', /zelle/i], ['venmo', /venmo/i], ['paypal', /paypal/i], ['cashapp', /cash ?app/i],
    ['bank', /ach|bank|eft|wire|transfer|e-?check/i], ['card', /card|credit|debit|visa|master|amex|discover|stripe|square|jobber ?pay|payments?$/i]];
  const method = (s) => { const m = METHODS.find(([, re]) => re.test(String(s || ''))); return m ? m[0] : 'other'; };

  // an invoice's status from its payments, without the side effects of the app's own payment recording
  function settle(inv) {
    const pays = inv.payments || []; const { balanceDue } = H.invoiceCredits(inv, true);
    if (pays.length && balanceDue <= 0.004) { const last = [...pays].sort((a, b) => a.date.localeCompare(b.date)).pop(); Object.assign(inv, { status: 'paid', paidAt: last.date, paymentMethod: last.method }); }
    else if (inv.status === 'paid') Object.assign(inv, { status: 'sent', paidAt: null, paymentMethod: null });
    else if (inv.status === 'draft' && pays.length) inv.status = 'sent';
  }
  const payment = (ctx, amount, date, how, reference, extra = {}) => ({ id: H.uid(), amount, method: how, date, reference: str(reference, 120),
    recordedBy: `Imported from ${ctx.label}`, createdAt: nowIso(), imported: { batch: ctx.batch.id, source: ctx.source, ...extra } });

  // ---------- one row of each kind ----------
  const ROW = {
    clients(r, ctx) {
      const c = cleanClient(r); if (!c.name) return 'invalid';
      if (findClient(c)) return 'dupe';
      db.clients.push({ id: H.uid(), ...c, tags: (Array.isArray(r.tags) ? r.tags : String(r.tags || '').split(/[,;]/)).map((t) => str(t, 40)).filter(Boolean).slice(0, 20),
        notes: text(r.notes, 5000), createdAt: day(r.createdDate) || today(), portalToken: H.token(), imported: { batch: ctx.batch.id, source: ctx.source } });
      return 'added';
    },
    services(r, ctx) {
      const name = str(r.name, 200); if (!name) return 'invalid';
      if (db.services.some((s) => lc(s.name) === lc(name))) return 'dupe';
      db.services.push({ id: H.uid(), name, type: /product|material|part/i.test(r.type || '') ? 'product' : 'service', description: text(r.description, 5000),
        price: Math.max(0, num(r.price) || 0), unit: str(r.unit, 40), category: H.cleanCat(r.category), imported: { batch: ctx.batch.id, source: ctx.source } });
      return 'added';
    },
    quotes(r, ctx) {
      const n = oldNumber(r.number); if (already('quotes', ctx.source, n)) return 'dupe';
      const c = clientFor(r.client, ctx); if (!c) return 'noClient';
      const date = notFuture(day(r.date)) || today(); const status = quoteStatus(r.status || '');
      const doc = { id: H.uid(), number: numberFor('quotes', n), clientId: c.id, title: str(r.title, 200), notes: text(r.notes, 5000), status, token: H.token(), createdAt: date,
        sentAt: status === 'draft' ? null : date, ...(status === 'approved' || status === 'declined' ? { respondedAt: notFuture(day(r.closedDate)) || date } : {}),
        depositFee: 0, depositStatus: null, signedAt: null, depositPaidAt: null, imported: { batch: ctx.batch.id, source: ctx.source, number: n } };
      priceDoc(doc, r, ctx.label); db.quotes.push(doc); return 'added';
    },
    jobs(r, ctx) {
      const n = oldNumber(r.number); if (already('jobs', ctx.source, n)) return 'dupe';
      const c = clientFor(r.client, ctx); if (!c) return 'noClient';
      const date = day(r.date) || day(r.closedDate) || ''; const status = jobStatus(r.status || '', date);
      const time = (t) => (/^\d{2}:\d{2}$/.test(t || '') ? t : '');
      const doc = { id: H.uid(), number: numberFor('jobs', n), clientId: c.id, title: str(r.title, 200), description: text(r.description, 5000), date: date || today(),
        startTime: time(r.startTime), endTime: time(r.endTime), anytime: !time(r.startTime), staffIds: [], status, quoteId: null, address: str(r.address, 500) || c.address || '',
        createdAt: date || today(), ...(status === 'completed' ? { completedAt: notFuture(day(r.closedDate) || date) || today() } : {}), imported: { batch: ctx.batch.id, source: ctx.source, number: n } };
      if ((r.total != null && r.total !== '') || (r.items || []).length) priceDoc(doc, r, ctx.label);
      db.jobs.push(doc); return 'added';
    },
    invoices(r, ctx) {
      const n = oldNumber(r.number); const prev = already('invoices', ctx.source, n);
      if (prev && !prev.imported.standIn) return 'dupe';
      if (/void|cancel|bad debt|written off|write.?off/i.test(r.status || '')) return 'void';
      const c = clientFor(r.client, ctx); if (!c) return 'noClient';
      if (prev) { // payments came first: the stand-in invoice made for them gives way to the real one, which takes its payments
        (ctx.batch.standIns = ctx.batch.standIns || []).push(JSON.parse(JSON.stringify(prev)));
        db.invoices = db.invoices.filter((d) => d !== prev);
      }
      const issue = notFuture(day(r.date)) || today(); const draft = /draft/i.test(r.status || '');
      const job = byNumber('jobs', ctx.source, oldNumber(r.jobNumber));
      const doc = { id: H.uid(), number: numberFor('invoices', n), clientId: c.id, jobId: job ? job.id : null, subject: str(r.title, 200), notes: text(r.notes, 5000),
        status: draft ? 'draft' : 'sent', issueDate: issue, dueDate: day(r.dueDate) || issue, sentAt: draft ? null : issue, paidAt: null, token: H.token(), createdAt: issue,
        imported: { batch: ctx.batch.id, source: ctx.source, number: n } };
      priceDoc(doc, r, ctx.label);
      if (prev) { doc.payments = (prev.payments || []).filter((p) => !(p.imported && p.imported.summary)); doc.id = prev.id; doc.token = prev.token; } // same id and link, so undo and client links keep working
      else if (ctx.opts.recordPayments) { // what was paid, from the invoice row (a payments file imported later replaces it with the real payments)
        const total = doc.total; const bal = num(r.balance);
        const paid = num(r.paid) ?? (bal != null ? H.round2(total - bal) : /paid/i.test(r.status || '') && !/unpaid|partial/i.test(r.status || '') ? total : 0);
        if (paid > 0) doc.payments = [payment(ctx, Math.min(paid, total || paid), notFuture(day(r.paidDate)) || issue, method(r.method), '', { summary: true })];
      }
      settle(doc); db.invoices.push(doc); return 'added';
    },
    payments(r, ctx) {
      if (/refund|charge ?back|reversal|void|fail/i.test(r.type || '')) return 'refund'; // money given back isn't a payment received
      const amount = Math.abs(num(r.amount) || 0); if (!(amount > 0)) return 'invalid'; // Jobber lists payments as negative amounts (they lower the balance)
      const c0 = r.client || {}; if (!day(r.date) && !oldNumber(r.invoiceNumber) && !c0.name && !c0.email && !c0.phone && !c0.company) return 'invalid'; // e.g. a report's totals row
      const date = notFuture(day(r.date)) || today(); const how = method(r.method); const ref = str(r.reference, 120);
      let inv = byNumber('invoices', ctx.source, oldNumber(r.invoiceNumber));
      if (!inv) {
        if (ctx.opts.orphanPayments !== 'invoice') return 'noInvoice';
        const c = clientFor(r.client, ctx); if (!c) return 'noClient';
        inv = { id: H.uid(), number: numberFor('invoices', oldNumber(r.invoiceNumber)), clientId: c.id, jobId: null, subject: '', notes: '', status: 'sent', issueDate: date, dueDate: date, sentAt: date,
          paidAt: null, token: H.token(), createdAt: date, imported: { batch: ctx.batch.id, source: ctx.source, number: oldNumber(r.invoiceNumber), standIn: true } }; // the real invoice replaces it if its file comes later
        priceDoc(inv, { total: amount, title: `Payment received (from ${ctx.label})` }, ctx.label); inv.payments = []; db.invoices.push(inv); ctx.out.invoicesCreated++;
      }
      const pays = inv.payments || [];
      if (pays.some((p) => p.imported && !p.imported.summary && p.date === date && Math.abs(p.amount - amount) < 0.005 && (p.reference || '') === ref)) return 'dupe';
      const summaries = pays.filter((p) => p.imported && p.imported.summary); // the invoice row's "amount paid" gives way to the real payments
      if (summaries.length) { (ctx.batch.replaced = ctx.batch.replaced || []).push(...summaries.map((p) => ({ invoiceId: inv.id, payment: p }))); }
      inv.payments = [...pays.filter((p) => !(p.imported && p.imported.summary)), payment(ctx, amount, date, how, ref)];
      settle(inv); return 'added';
    },
    expenses(r, ctx) {
      const amount = num(r.amount); if (!(amount > 0)) return 'invalid';
      const date = notFuture(day(r.date)) || today(); const vendor = str(r.vendor, 200); const description = str(r.description, 500);
      if (db.expenses.some((e) => e.imported && e.imported.source === ctx.source && e.date === date && Math.abs(e.amount - amount) < 0.005 && e.vendor === vendor && e.description === description)) return 'dupe';
      const job = byNumber('jobs', ctx.source, oldNumber(r.jobNumber));
      db.expenses.push({ id: H.uid(), date, category: str(r.category, 60) || 'Other', vendor, description, amount, jobId: job ? job.id : null, bizCat: '', createdAt: date,
        imported: { batch: ctx.batch.id, source: ctx.source } });
      return 'added';
    },
  };

  // ---------- running an import (one request per part of the file) ----------
  // body: { source, kind, file, rows, batchId?, last?, options: { createClients, recordPayments, orphanPayments } }
  function run(body, by) {
    const source = SOURCES[body.source] ? body.source : 'other'; const kind = body.kind;
    if (!KINDS.includes(kind)) throw Object.assign(new Error('Choose what the file holds'), { status: 400 });
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length > MAX_ROWS) throw Object.assign(new Error(`Send up to ${MAX_ROWS} rows at a time`), { status: 400 });
    const o = body.options || {};
    const opts = { createClients: o.createClients !== false, recordPayments: o.recordPayments !== false, orphanPayments: o.orphanPayments === 'skip' ? 'skip' : 'invoice' };
    let batch = body.batchId && log().find((b) => b.id === body.batchId && !b.undoneAt);
    if (body.batchId && !batch) throw Object.assign(new Error('That import was undone or can’t be found. Start again.'), { status: 400 });
    if (!batch) {
      batch = { id: H.uid(), at: nowIso(), by: str(by, 100) || 'Alpha', source, kind, file: str(body.file, 120), options: opts, rows: 0,
        counts: { added: 0, dupe: 0, noClient: 0, noInvoice: 0, void: 0, refund: 0, invalid: 0 }, clientsCreated: 0, invoicesCreated: 0, done: false };
      log().unshift(batch); if (log().length > 100) db.importLog = log().slice(0, 100);
    }
    const ctx = { source, label: SOURCES[source], opts: batch.options, batch, out: { clientsCreated: 0, invoicesCreated: 0 } };
    const counts = { added: 0, dupe: 0, noClient: 0, noInvoice: 0, void: 0, refund: 0, invalid: 0 }; const problems = [];
    rows.forEach((r, i) => {
      let res; try { res = ROW[kind](r || {}, ctx); } catch (e) { res = 'invalid'; problems.push(`Row ${(Number(body.offset) || 0) + i + 1}: ${e.message}`); }
      counts[res] = (counts[res] || 0) + 1;
    });
    batch.rows += rows.length; Object.keys(counts).forEach((k) => { batch.counts[k] = (batch.counts[k] || 0) + counts[k]; });
    batch.clientsCreated += ctx.out.clientsCreated; batch.invoicesCreated += ctx.out.invoicesCreated; if (body.last !== false) batch.done = true;
    H.save();
    return { batchId: batch.id, counts, clientsCreated: ctx.out.clientsCreated, invoicesCreated: ctx.out.invoicesCreated, problems: problems.slice(0, 20), batch };
  }

  // ---------- undo: everything one import made, and the payments it added ----------
  function undo(batchId, by) {
    const b = log().find((x) => x.id === batchId); if (!b) throw Object.assign(new Error('Import not found'), { status: 404 });
    if (b.undoneAt) throw Object.assign(new Error('That import was already undone'), { status: 400 });
    const mine = (d) => d && d.imported && d.imported.batch === b.id; const removed = {}; const count = (k, n) => { if (n) removed[k] = (removed[k] || 0) + n; };
    // stand-in invoices this import replaced get back the payments now on the real invoice (other than this import's own)
    const carry = new Map((b.standIns || []).map((s) => [s.id, ((db.invoices.find((i) => i.id === s.id) || {}).payments || []).filter((p) => !mine(p))]));
    for (const col of ['quotes', 'jobs', 'invoices', 'expenses', 'services']) { const before = db[col].length; db[col] = db[col].filter((d) => !mine(d)); count(col, before - db[col].length); }
    const gone = new Set(); // jobs that no longer exist: invoices and expenses lose the link
    for (const inv of db.invoices) {
      if (inv.jobId && !db.jobs.some((j) => j.id === inv.jobId)) { gone.add(inv.jobId); inv.jobId = null; }
      const n = (inv.payments || []).length; if (!n) continue;
      inv.payments = inv.payments.filter((p) => !mine(p)); count('payments', n - inv.payments.length);
      if (n !== inv.payments.length) settle(inv);
    }
    for (const s of b.standIns || []) {
      const payImport = log().find((x) => x.id === s.imported.batch); if (!payImport || payImport.undoneAt || db.invoices.some((i) => i.id === s.id)) continue;
      s.payments = carry.get(s.id) || []; settle(s); db.invoices.push(s); count('restored', 1);
    }
    for (const r of b.replaced || []) { const inv = db.invoices.find((i) => i.id === r.invoiceId); if (inv && !(inv.payments || []).some((p) => p.id === r.payment.id)) { inv.payments = [...(inv.payments || []), r.payment]; settle(inv); } }
    for (const e of db.expenses) if (e.jobId && !db.jobs.some((j) => j.id === e.jobId)) e.jobId = null;
    // clients it made, unless something else now uses them
    const used = new Set([...db.quotes, ...db.jobs, ...db.invoices, ...(db.requests || []), ...(db.memberships || []), ...(db.tasks || []), ...(db.events || [])].map((d) => d.clientId).filter(Boolean));
    const before = db.clients.length; let kept = 0;
    db.clients = db.clients.filter((c) => { if (!mine(c)) return true; if (used.has(c.id)) { kept++; return true; } return false; });
    count('clients', before - db.clients.length);
    Object.assign(b, { undoneAt: nowIso(), undoneBy: str(by, 100) || 'Alpha', removed, keptClients: kept });
    H.save(); return b;
  }

  const summary = () => ({ sources: SOURCES, kinds: KINDS, maxRows: MAX_ROWS, log: log(),
    totals: { clients: db.clients.length, services: db.services.length, quotes: db.quotes.length, jobs: db.jobs.length, invoices: db.invoices.length, expenses: db.expenses.length } });
  return { run, undo, summary, SOURCES, KINDS };
};
