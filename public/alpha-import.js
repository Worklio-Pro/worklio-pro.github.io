'use strict';
// Alpha → Accounts → a business → Import data (lib/data-import.js). Moves a business's records over from Jobber, Housecall Pro,
// Workiz, ServiceTitan, QuickBooks and others, one CSV export at a time. A paid service: businesses can't do this themselves.
// Loaded after platform.js and uses its helpers (A, api, modal, closeModal, toast, esc, $, $$, fmtDate, D).
let IM = null; // { account, summary, step, source, kind, file, headers, rows, map, options, busy, result }

// ---------- CSV ----------
// quoted fields, embedded commas/newlines, "" escapes, BOM; comma, semicolon or tab
function imParseCsv(text) {
  text = text.replace(/^\uFEFF/, ''); const first = text.split(/\r?\n/)[0] || '';
  const delim = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
// "$1,234.56", "(12.00)", "1234" → number; '' when empty
const imMoney = (v) => { let s = String(v ?? '').trim(); if (!s) return ''; const neg = /^\(.*\)$/.test(s) || /^-/.test(s); s = s.replace(/[^0-9.]/g, ''); if (!s) return ''; const n = Number(s); return Number.isFinite(n) ? (neg ? -n : n) : ''; };
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');
// 2025-03-14, 3/14/2025, 14/03/2025 (day first only when it must be), Mar 14, 2025, 14 Mar 2025, with or without a time → YYYY-MM-DD
function imDate(v) {
  const s = String(v ?? '').trim(); if (!s) return ''; let m;
  const ok = (y, mo, d) => { y = Number(y); if (y < 100) y += 2000; mo = Number(mo); d = Number(d); return y > 1970 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(mo)}-${pad(d)}` : ''; };
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s))) return ok(m[1], m[2], m[3]);
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s))) return Number(m[1]) > 12 ? ok(m[3], m[2], m[1]) : ok(m[3], m[1], m[2]);
  const mon = (w) => MONTHS[w.toLowerCase().slice(0, 4)] || MONTHS[w.toLowerCase().slice(0, 3)];
  if ((m = /^([a-z]{3,9})\.? (\d{1,2}),? (\d{4})/i.exec(s)) && mon(m[1])) return ok(m[3], mon(m[1]), m[2]);
  if ((m = /^(\d{1,2}) ([a-z]{3,9})\.?,? (\d{4})/i.exec(s)) && mon(m[2])) return ok(m[3], mon(m[2]), m[1]);
  const t = Date.parse(s); if (!Number.isNaN(t)) { const d = new Date(t); return ok(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  return '';
}
// "9:30 AM", "14:00", "2025-03-14 09:30" → HH:MM
function imTime(v) {
  const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?/i.exec(String(v ?? '')); if (!m) return '';
  let h = Number(m[1]); const ap = (m[3] || '').toLowerCase(); if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0;
  return h < 24 ? `${pad(h)}:${m[2]}` : '';
}

// ---------- what each kind of file can hold, and how its columns are guessed ----------
// [key, label, guess]: guesses are tried in this order, each column used once (headers are lower-cased, "($)" and the like removed)
const IM_CLIENT = [['clientName', 'Client name', /^(client|customer|contact)( ?(full )?name)?$|^(full |display )?name$|^bill(ed)? to$|^customer\/company$/], ['clientFirst', 'Client first name', /^(client |customer )?first( ?name)?$/],
  ['clientLast', 'Client last name', /^(client |customer )?last( ?name)?$|^surname$/], ['company', 'Company', /company|business name|organi[sz]ation/], ['email', 'Email', /e-?mail/], ['phone', 'Phone', /phone|mobile|cell|^tel/],
  ['clientAddress', 'Client address', /billing address|client address|customer address/]];
const IM_ITEMS = [['itemName', 'Line item name', /^(line ?item|item|product|service|product\/service)( ?name)?$/], ['itemDesc', 'Line item description', /^(line ?item|item) ?desc(ription)?$/],
  ['itemQty', 'Line item quantity', /^(qty|quantity)$|^(line ?item|item) ?(qty|quantity)$/], ['itemPrice', 'Line item unit price', /unit ?(price|cost)|^rate$|^(item |line ?item )?price$/],
  ['itemTotal', 'Line item total', /^(line ?item|item|line) ?(total|amount)$|^extended/]];
const IM_DOC_MONEY = [['subtotal', 'Subtotal', /sub-?total|pre-?tax|before tax/], ['discount', 'Discount', /discount/], ['tax', 'Tax amount', /^(sales )?tax( amount| total)?$|^tax \(|^total tax/], ['total', 'Total', /^(grand |invoice |quote |estimate |job )?total|^total amount$|^amount$|^value$/]];
const IM_FIELDS = {
  clients: [['name', 'Full name', /^(client|customer|contact)( ?(full )?name)?$|^(full |display )?name$/], ['first', 'First name', /^(client |customer )?first( ?name)?$|^given name$/], ['last', 'Last name', /^(client |customer )?last( ?name)?$|^(surname|family name)$/],
    ['company', 'Company', /company|business|organi[sz]ation/], ['email', 'Email', /e-?mail/], ['phone', 'Phone', /phone|mobile|cell|^tel/], ['street2', 'Street line 2', /(address|street).*(2|line 2)|^(apt|suite|unit)/],
    ['zip', 'ZIP / postal code', /zip|postal|postcode/], ['city', 'City', /city|town/], ['state', 'State', /^(state|province|region)|state$/], ['address', 'Full address', /formatted|full address|^address$|^(service|billing|property) address$/],
    ['street', 'Street', /street|address( line)? ?1/], ['notes', 'Notes', /note|comment/], ['tags', 'Tags', /^tags?$|label/], ['createdDate', 'Client since', /created|added|client since|customer since/]],
  services: [['name', 'Name', /^(name|item|product|service|title|product\/service)( ?name)?$/], ['type', 'Type (product or service)', /^(item )?type$|^kind$/], ['description', 'Description', /desc/],
    ['price', 'Price', /price|rate|cost|amount/], ['unit', 'Unit', /^unit$|unit of|uom/], ['category', 'Category', /category|group|class/]],
  quotes: [['number', 'Quote number', /^(quote|estimate)? ?(#|no\.?|num(ber)?|id)$|^(quote|estimate)$/], ...IM_DOC_MONEY, ['closedDate', 'Approved / declined date', /approved|accepted|converted|declined|won|closed/],
    ['date', 'Date', /created|sent|issued|^date$|(quote|estimate) date/], ['status', 'Status', /status|stage/], ...IM_CLIENT, ['title', 'Title', /title|subject|(quote|estimate|job) name|description/], ['notes', 'Notes / message', /note|message|comment/], ...IM_ITEMS],
  jobs: [['number', 'Job number', /^(job|work order|wo)? ?(#|no\.?|num(ber)?|id)$|^job$/], ...IM_DOC_MONEY, ['closedDate', 'Completed date', /complet|closed|finish|end date/], ['startTime', 'Start time', /start time|time$/],
    ['endTime', 'End time', /end time/], ['date', 'Date', /start|schedul|^date$|visit|appointment|job date/], ['status', 'Status', /status|stage/], ['jobAddress', 'Job address', /property|service address|job address|location|^address$/],
    ...IM_CLIENT, ['title', 'Title', /title|job name|subject|^job$|summary/], ['description', 'Description / instructions', /desc|instruction|detail|note/], ...IM_ITEMS],
  invoices: [['number', 'Invoice number', /^(invoice|inv)? ?(#|no\.?|num(ber)?|id)$|^invoice$/], ['jobNumber', 'Job number', /^(job|work order|wo) ?(#|no\.?|num(ber)?|id)?$/], ['balance', 'Balance due', /balance|amount due|outstanding|open/],
    ['paid', 'Amount paid', /^(amount )?paid( amount)?$|^payments?( applied| received)?$|collected/], ...IM_DOC_MONEY, ['paidDate', 'Paid date', /paid (date|on)|date paid|payment date|last payment/],
    ['dueDate', 'Due date', /due/], ['date', 'Issue date', /issued?( date)?|invoice date|^date$|created|sent/], ['status', 'Status', /status|stage/], ['method', 'Payment method', /method|tender|paid with/], ...IM_CLIENT,
    ['title', 'Subject', /subject|title|description|memo/], ['notes', 'Notes / message', /note|message|comment/], ...IM_ITEMS],
  payments: [['invoiceNumber', 'Invoice number', /invoice|^inv|applied to/], ['amount', 'Amount', /amount|total|^paid$|payment$/], ['date', 'Date', /date|paid on|received/], ['method', 'Method', /method|type|tender|paid with/],
    ['reference', 'Reference', /reference|^ref|transaction|check ?(#|no)|confirmation|memo|note/], ...IM_CLIENT],
  expenses: [['date', 'Date', /date/], ['amount', 'Amount', /amount|total|cost/], ['vendor', 'Vendor', /vendor|merchant|payee|supplier|store|paid to/], ['category', 'Category', /category|account|type/],
    ['jobNumber', 'Job number', /job/], ['description', 'Description', /desc|item|note|memo|details/]],
};
const IM_KINDS = { clients: 'Clients', services: 'Products & services', jobs: 'Jobs', quotes: 'Quotes / estimates', invoices: 'Invoices', payments: 'Payments', expenses: 'Expenses' };
const IM_ORDER = ['clients', 'services', 'jobs', 'quotes', 'invoices', 'payments', 'expenses']; // so each file can link to the ones before it
const IM_NEEDS = { clients: [['name', 'first', 'last', 'company'], 'the client name'], services: [['name'], 'the item name'], quotes: [['total', 'subtotal', 'itemTotal', 'itemPrice'], 'an amount'],
  jobs: [['date', 'closedDate'], 'the date'], invoices: [['total', 'subtotal', 'itemTotal', 'itemPrice'], 'an amount'], payments: [['amount'], 'the amount'], expenses: [['amount'], 'the amount'] };
const IM_TIPS = {
  jobber: 'In Jobber, each list (Clients, Jobs, Quotes, Invoices) and most reports (Payments, Products & services, Expenses) have an Export / Download CSV button.',
  housecallpro: 'In Housecall Pro, export customers from the Customers list and jobs, estimates, invoices and payments from Reporting (download as CSV).',
  workiz: 'In Workiz, use the Export button on the Clients and Jobs lists, and Reports for payments and invoices.',
  servicetitan: 'In ServiceTitan, run the report you need (Customers, Jobs, Invoices, Payments) and export it to CSV. Excel files must be saved as CSV first.',
  quickbooks: 'In QuickBooks, run Customer Contact List, Invoice List, Transaction List or Sales by Customer Detail and export to CSV (Excel files: save as CSV).',
  square: 'In Square, export customers from the Customers directory and payments and invoices from Reports / Transactions.',
  fieldedge: 'In FieldEdge, export customers, work orders and invoices from their lists or reports as CSV.',
  other: 'Any spreadsheet saved as CSV works, as long as the first row has the column names.',
};
const imClean = (h) => String(h || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[_*]/g, ' ').replace(/\s+/g, ' ').trim();
function imGuess(kind, headers) {
  const map = headers.map(() => ''); const used = new Set(); const H = headers.map(imClean);
  for (const [key, , re] of IM_FIELDS[kind]) {
    if (used.has(key)) continue;
    const i = H.findIndex((h, k) => !map[k] && h && !/label$/.test(h) && re.test(h)); // Google Contacts has "E-mail 1 - Label" next to "E-mail 1 - Value"
    if (i >= 0) { map[i] = key; used.add(key); }
  }
  return map;
}

// ---------- rows → records the server takes ----------
function imRecords() {
  const s = IM; const pick = (row) => { const v = {}; s.map.forEach((k, i) => { if (k && String(row[i] ?? '').trim()) v[k] = (v[k] ? v[k] + ' ' : '') + String(row[i]).trim(); }); return v; };
  const client = (v) => ({ name: v.clientName || [v.clientFirst, v.clientLast].filter(Boolean).join(' '), company: v.company || '', email: v.email || '', phone: v.phone || '', address: v.clientAddress || '' });
  const doc = (v) => ({ number: v.number || '', client: client(v), title: v.title || '', notes: v.notes || '', description: v.description || '', status: v.status || '',
    date: imDate(v.date), dueDate: imDate(v.dueDate), closedDate: imDate(v.closedDate), paidDate: imDate(v.paidDate), startTime: imTime(v.startTime) || (v.date && /\d:\d\d/.test(v.date) ? imTime(v.date) : ''), endTime: imTime(v.endTime),
    subtotal: imMoney(v.subtotal), discount: imMoney(v.discount), tax: imMoney(v.tax), total: imMoney(v.total), paid: imMoney(v.paid), balance: imMoney(v.balance), method: v.method || '', jobNumber: v.jobNumber || '', address: v.jobAddress || '', items: [] });
  const line = (v) => (v.itemName || v.itemDesc || v.itemTotal || v.itemPrice ? { desc: v.itemName || v.itemDesc || 'Item', details: v.itemName && v.itemDesc ? v.itemDesc : '', qty: imMoney(v.itemQty) === '' ? 1 : imMoney(v.itemQty), price: imMoney(v.itemPrice), lineTotal: imMoney(v.itemTotal) } : null);
  const rows = s.rows.map(pick);
  if (s.kind === 'clients') return rows.map((v) => { const city = [v.city, [v.state, v.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return { name: v.name || [v.first, v.last].filter(Boolean).join(' '), company: v.company || '', email: v.email || '', phone: v.phone || '', notes: v.notes || '', tags: v.tags || '', createdDate: imDate(v.createdDate),
      address: (v.address || [v.street, v.street2, city].filter(Boolean).join(', ')).replace(/\s*\n\s*/g, ', ') }; });
  if (s.kind === 'services') return rows.map((v) => ({ name: v.name || '', type: v.type || '', description: v.description || '', price: imMoney(v.price), unit: v.unit || '', category: v.category || '' }));
  if (s.kind === 'payments') return rows.map((v) => ({ invoiceNumber: v.invoiceNumber || '', client: client(v), date: imDate(v.date), amount: imMoney(v.amount), method: v.method || '', reference: v.reference || '' }));
  if (s.kind === 'expenses') return rows.map((v) => ({ date: imDate(v.date), amount: imMoney(v.amount), vendor: v.vendor || '', category: v.category || '', jobNumber: v.jobNumber || '', description: v.description || '' }));
  // quotes, jobs, invoices: with line items mapped, rows with the same number are one document
  const lines = s.map.some((k) => /^item/.test(k)); if (!lines) return rows.map(doc);
  const out = []; const byNum = new Map();
  rows.forEach((v) => {
    const key = String(v.number || '').trim(); let d = key && byNum.get(key);
    if (!d) { d = doc(v); out.push(d); if (key) byNum.set(key, d); }
    const l = line(v); if (l) d.items.push(l);
  });
  out.forEach((d) => { if (d.total === '' && d.items.length) d.total = Math.round(d.items.reduce((t, l) => t + (l.lineTotal !== '' ? l.lineTotal : (l.price || 0) * l.qty), 0) * 100) / 100 + (d.tax || 0) - (d.discount || 0); });
  return out;
}
const imMissing = () => { const [keys, what] = IM_NEEDS[IM.kind]; const has = (k) => IM.map.includes(k) || (k === 'name' && IM.map.includes('clientName'));
  const clientNeeded = ['quotes', 'jobs', 'invoices'].includes(IM.kind) && !['clientName', 'clientFirst', 'clientLast', 'company', 'email', 'phone'].some(has);
  return [...(keys.some(has) ? [] : [what]), ...(clientNeeded ? ['the client (name, email or phone)'] : [])]; };

// ---------- the screens ----------
A.importData = async (d) => {
  const a = D.accounts.find((x) => x.id === d.id);
  IM = { account: a, step: 'home', source: (IM && IM.account.id === a.id && IM.source) || 'jobber', kind: 'clients', options: { createClients: true, recordPayments: true, orphanPayments: 'invoice' } };
  modal(`Import data: ${a.name}`, '<p class="muted">Loading…</p>', { wide: true });
  try { IM.summary = await api('GET', `/api/platform/accounts/${a.id}/import`); } catch (x) { closeModal(); throw x; }
  imRender();
};
function imRender() {
  const s = IM; const m = $('#ov .pf-modal'); if (!m || !s) return;
  const body = s.step === 'home' ? imHome() : s.step === 'pick' ? imPick() : s.step === 'map' ? imMap() : imDone();
  m.innerHTML = `<h2>Import data: ${esc(s.account.name)}</h2>${body}`;
  if (s.step === 'pick') {
    const f = $('#imf', m);
    f.source.addEventListener('change', () => { s.source = f.source.value; $('#imTip', m).textContent = IM_TIPS[s.source]; });
    f.kind.addEventListener('change', () => { s.kind = f.kind.value; });
    f.file.addEventListener('change', async () => {
      const file = f.file.files[0]; if (!file) return;
      if (/\.(xlsx?|numbers|pdf)$/i.test(file.name)) { f.file.value = ''; return toast('Save it as CSV first (File → Save As / Export → CSV), then choose the .csv file', true); }
      const rows = imParseCsv(await file.text());
      if (rows.length < 2) { f.file.value = ''; return toast('Nothing to import: the file needs a header row and at least one row under it', true); }
      const headers = rows[0].map((h, i) => String(h || '').trim() || `Column ${i + 1}`); const width = Math.max(...rows.map((r) => r.length));
      while (headers.length < width) headers.push(`Column ${headers.length + 1}`);
      Object.assign(s, { file: file.name, headers, rows: rows.slice(1), map: imGuess(s.kind, headers), step: 'map', result: null }); imRender();
    });
  }
  if (s.step === 'map') {
    $$('[data-immap]', m).forEach((sel) => sel.addEventListener('change', () => { s.map[Number(sel.dataset.immap)] = sel.value; imRender(); }));
    $$('[data-imopt]', m).forEach((el) => el.addEventListener('change', () => { s.options[el.dataset.imopt] = el.type === 'checkbox' ? el.checked : el.value; }));
  }
}
function imHome() {
  const s = IM; const S = s.summary; const t = S.totals; const live = S.log.filter((b) => !b.undoneAt);
  const said = (b) => { const c = b.counts; const bits = [`${c.added} added`]; if (c.dupe) bits.push(`${c.dupe} already there`); if (c.noClient) bits.push(`${c.noClient} without a client`); if (c.noInvoice) bits.push(`${c.noInvoice} without an invoice`);
    if (c.void) bits.push(`${c.void} void`); if (c.invalid) bits.push(`${c.invalid} unreadable`); if (b.clientsCreated) bits.push(`${b.clientsCreated} new client${b.clientsCreated === 1 ? '' : 's'}`); if (b.invoicesCreated) bits.push(`${b.invoicesCreated} invoice${b.invoicesCreated === 1 ? '' : 's'} made for payments`); return bits.join(' · '); };
  return `<p class="muted" style="margin-top:0">Bring a business’s records over from the app they used before, one CSV export at a time. Only Alpha can do this; the business doesn’t see it.
Imported records don’t get late fees, review emails or QuickBooks/Xero sync, and their automations only act on what happens after the import. Each import can be undone.</p>
<p class="sm" style="margin:0 0 14px"><strong>In the account now:</strong> ${t.clients} clients · ${t.services} products & services · ${t.jobs} jobs · ${t.quotes} quotes · ${t.invoices} invoices · ${t.expenses} expenses</p>
<div class="card" style="margin:0 0 14px;padding:12px 14px"><strong>Best order:</strong> <span class="sm">${IM_ORDER.map((k) => IM_KINDS[k]).join(' → ')}. Jobs link to clients, invoices to jobs (by job number) and payments to invoices (by invoice number), so the earlier files make the later ones fit.</span></div>
<h3 style="font-size:15px;margin:0 0 6px">Imports${S.log.length ? ` (${S.log.length})` : ''}</h3>
${S.log.length ? `<div class="tablewrap"><table class="acc"><thead><tr><th>When</th><th>What</th><th>Result</th><th></th></tr></thead><tbody>${S.log.map((b) => `<tr${b.undoneAt ? ' style="opacity:.6"' : ''}>
<td class="sm">${fmtDate(b.at)}<div>${esc(b.by)}</div></td><td><strong>${esc(IM_KINDS[b.kind] || b.kind)}</strong> from ${esc(S.sources[b.source] || b.source)}<div class="sm">${esc(b.file || '')}${b.done ? '' : ' · <em>stopped part way</em>'}</div></td>
<td class="sm">${esc(said(b))}${b.undoneAt ? `<div><strong>Undone</strong> ${fmtDate(b.undoneAt)} by ${esc(b.undoneBy)}${b.keptClients ? ` (kept ${b.keptClients} client${b.keptClients === 1 ? '' : 's'} still in use)` : ''}</div>` : ''}</td>
<td>${b.undoneAt ? '' : `<button type="button" class="btn alt sm" data-act="imUndo" data-b="${esc(b.id)}">Undo</button>`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted sm" style="margin:0">Nothing imported yet.</p>'}
<div class="foot"><button type="button" class="btn alt" data-act="imBack">Back to account</button><button type="button" class="btn" data-act="imStart">${live.length ? 'Import another file' : 'Import a file'}</button></div>`;
}
function imPick() {
  const s = IM;
  return `<form id="imf"><div class="row"><label>From<select name="source">${Object.entries(IM.summary.sources).map(([k, v]) => `<option value="${k}" ${k === s.source ? 'selected' : ''}>${k === 'other' ? 'Another app or spreadsheet' : esc(v)}</option>`).join('')}</select></label>
<label>The file has<select name="kind">${IM_ORDER.map((k) => `<option value="${k}" ${k === s.kind ? 'selected' : ''}>${IM_KINDS[k]}</option>`).join('')}</select></label></div>
<p class="sm muted" id="imTip" style="margin:0 0 12px">${esc(IM_TIPS[s.source])}</p>
<label>CSV file<input type="file" name="file" accept=".csv,.txt,text/csv"></label>
<p class="sm muted">Choosing the file opens the column matching. Nothing is saved until you press Import.</p>
<div class="foot"><button type="button" class="btn alt" data-act="imHome">Back</button></div></form>`;
}
function imMap() {
  const s = IM; const recs = imRecords(); const miss = imMissing(); const fields = IM_FIELDS[s.kind]; const label = IM.summary.sources[s.source];
  const opt = (k, html) => `<label class="switchline">${html}</label>`;
  const options = [
    ...(['quotes', 'jobs', 'invoices', 'payments'].includes(s.kind) ? [opt('createClients', `<input type="checkbox" data-imopt="createClients" ${s.options.createClients ? 'checked' : ''}> <span>Add clients that aren’t in the account yet (matched by email, then phone, then name)</span>`)] : []),
    ...(s.kind === 'invoices' ? [opt('recordPayments', `<input type="checkbox" data-imopt="recordPayments" ${s.options.recordPayments ? 'checked' : ''}> <span>Record what was paid from this file (amount paid, balance or a Paid status). A payments file imported afterwards replaces these with the real payments.</span>`)] : []),
    ...(s.kind === 'payments' ? [`<label>Payments whose invoice isn’t in the account<select data-imopt="orphanPayments"><option value="invoice" ${s.options.orphanPayments === 'invoice' ? 'selected' : ''}>Make a paid invoice for each, so the money shows in reports</option><option value="skip" ${s.options.orphanPayments === 'skip' ? 'selected' : ''}>Skip them</option></select></label>`] : []),
  ];
  const cols = { clients: [['Name', (r) => r.name], ['Email', (r) => r.email], ['Phone', (r) => r.phone], ['Address', (r) => r.address]], services: [['Name', (r) => r.name], ['Price', (r) => r.price], ['Category', (r) => r.category]],
    payments: [['Invoice', (r) => r.invoiceNumber], ['Client', (r) => r.client.name || r.client.email], ['Date', (r) => r.date], ['Amount', (r) => r.amount], ['Method', (r) => r.method]],
    expenses: [['Date', (r) => r.date], ['Vendor', (r) => r.vendor], ['Category', (r) => r.category], ['Amount', (r) => r.amount]] }[s.kind]
    || [['#', (r) => r.number], ['Client', (r) => r.client.name || r.client.company || r.client.email], ['Date', (r) => r.date], ['Status', (r) => r.status], ['Total', (r) => r.total], ...(s.kind === 'invoices' ? [['Paid', (r) => r.paid !== '' ? r.paid : r.balance !== '' ? `bal ${r.balance}` : '']] : []), ['Lines', (r) => r.items.length || '']];
  return `<p class="muted" style="margin-top:0"><strong>${esc(IM_KINDS[s.kind])}</strong> from ${esc(label)} · ${esc(s.file)} · ${s.rows.length} row${s.rows.length === 1 ? '' : 's'}${recs.length !== s.rows.length ? ` → ${recs.length} record${recs.length === 1 ? '' : 's'} (rows with the same number are one, with its lines)` : ''}</p>
<h3 style="font-size:15px;margin:0 0 6px">Match the columns</h3>
<div class="tablewrap" style="max-height:300px;overflow:auto"><table class="acc"><thead><tr><th>Column in the file</th><th>Example</th><th>Import as</th></tr></thead><tbody>
${s.headers.map((h, i) => `<tr><td class="nm">${esc(h)}</td><td class="sm">${esc(String((s.rows.find((r) => String(r[i] || '').trim()) || [])[i] || '').slice(0, 60))}</td>
<td><select data-immap="${i}" aria-label="Import ${esc(h)} as"><option value="">Don’t import</option>${fields.map(([k, l]) => `<option value="${k}" ${s.map[i] === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
${miss.length ? `<p class="sm" style="color:var(--danger)">Choose the column with ${miss.join(' and ')}.</p>` : ''}
${options.length ? `<div style="margin:12px 0 0">${options.join('')}</div>` : ''}
<h3 style="font-size:15px;margin:14px 0 6px">Preview</h3>
<div class="tablewrap"><table class="acc"><thead><tr>${cols.map(([c]) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${recs.slice(0, 6).map((r) => `<tr>${cols.map(([, f]) => `<td class="sm">${esc(f(r) ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
${recs.length > 6 ? `<p class="sm muted" style="margin:4px 0 0">First 6 of ${recs.length}.</p>` : ''}
<p class="sm muted">Already-imported records with the same number (or the same client, date and amount) are skipped, so the same file can be imported again safely.</p>
<div class="foot"><button type="button" class="btn alt" data-act="imStart">Choose another file</button><button type="button" class="btn" data-act="imRun" ${miss.length || !recs.length ? 'disabled' : ''}>Import ${recs.length} ${esc(IM_KINDS[s.kind].toLowerCase())}</button></div>`;
}
function imDone() {
  const r = IM.result; const c = r.counts; const S = IM.summary;
  const line = (n, what) => (n ? `<li><strong>${n}</strong> ${what}</li>` : '');
  return `<p style="margin-top:0"><strong>${esc(IM_KINDS[IM.kind])}</strong> from ${esc(S.sources[IM.source])} (${esc(IM.file)}) ${r.stopped ? 'stopped part way' : 'imported'}.</p>
<ul>${line(c.added, 'added')}${line(r.clientsCreated, 'new clients made')}${line(r.invoicesCreated, 'paid invoices made for payments with no invoice')}${line(c.dupe, 'already in the account (skipped)')}
${line(c.noClient, 'skipped: no client (map the client columns, or tick “Add clients”)')}${line(c.noInvoice, 'payments skipped: no invoice with that number')}${line(c.void, 'void or written-off invoices skipped')}${line(c.invalid, 'rows without what they need (a name or an amount)')}</ul>
${r.problems.length ? `<details><summary class="sm">Problems (${r.problems.length})</summary><ul class="sm">${r.problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></details>` : ''}
${r.stopped ? `<p class="sm" style="color:var(--danger)">${esc(r.stopped)}</p>` : ''}
<div class="foot"><button type="button" class="btn alt" data-act="imHome">See all imports</button><button type="button" class="btn" data-act="imStart">Import another file</button></div>`;
}

// ---------- actions ----------
A.imBack = () => A.editAccount({ id: IM.account.id });
A.imHome = async () => { IM.step = 'home'; try { IM.summary = await api('GET', `/api/platform/accounts/${IM.account.id}/import`); } catch (x) { toast(x.message, true); } imRender(); };
A.imStart = () => { IM.step = 'pick'; imRender(); };
A.imRun = async (d, el) => {
  const s = IM; const recs = imRecords(); const size = Math.min(500, s.summary.maxRows || 500);
  if (!confirm(`Import ${recs.length} ${IM_KINDS[s.kind].toLowerCase()} into ${s.account.name}?`)) return;
  const m = $('#ov .pf-modal'); m.dataset.sticky = '1'; el.disabled = true; $$('.foot button', m).forEach((b) => { b.disabled = true; });
  const total = { added: 0, dupe: 0, noClient: 0, noInvoice: 0, void: 0, invalid: 0 }; const res = { counts: total, clientsCreated: 0, invoicesCreated: 0, problems: [] }; let batchId = null;
  try {
    for (let i = 0; i < recs.length; i += size) {
      el.textContent = `Importing ${Math.min(i + size, recs.length)} of ${recs.length}…`;
      const r = await api('POST', `/api/platform/accounts/${s.account.id}/import`, { source: s.source, kind: s.kind, file: s.file, rows: recs.slice(i, i + size), offset: i, batchId, last: i + size >= recs.length, options: s.options });
      batchId = r.batchId; Object.keys(r.counts).forEach((k) => { total[k] = (total[k] || 0) + r.counts[k]; });
      res.clientsCreated += r.clientsCreated; res.invoicesCreated += r.invoicesCreated; res.problems.push(...r.problems);
    }
  } catch (x) { res.stopped = `${x.message}. What was imported before this is kept; Undo removes it, or import the file again to carry on (the rows already in are skipped).`; }
  delete m.dataset.sticky; s.result = res; s.step = 'done'; toast(res.stopped ? 'The import stopped part way' : `${total.added} ${IM_KINDS[s.kind].toLowerCase()} imported`, !!res.stopped);
  try { s.summary = await api('GET', `/api/platform/accounts/${s.account.id}/import`); await load(); } catch (x) { /* the counts refresh next time */ }
  imRender();
};
A.imUndo = async (d) => {
  const b = IM.summary.log.find((x) => x.id === d.b); if (!b) return;
  if (!confirm(`Undo the ${IM_KINDS[b.kind].toLowerCase()} import from ${IM.summary.sources[b.source]}${b.file ? ` (${b.file})` : ''}? Everything it added to ${IM.account.name} is removed, including any changes made to those records since. Clients it made that are now used elsewhere are kept.`)) return;
  IM.summary = await api('POST', `/api/platform/accounts/${IM.account.id}/import/${encodeURIComponent(b.id)}/undo`, {});
  toast('Import undone'); try { await load(); } catch (x) { /* ignore */ } imRender();
};
