// Settings → QuickBooks & Xero: a business connects its QuickBooks Online or Xero company, and Worklio sends its clients, invoices,
// payments and expenses there (one way: Worklio → the books). The platform's app keys come from Alpha → Settings → Integrations
// (or QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET, XERO_CLIENT_ID / XERO_CLIENT_SECRET in .env); the sign-in returns to
// /oauth/<provider>/callback on the platform address (lib/platform.js), which saves the connection in the business's secrets.
// Each provider has the same shape: startUrl, connect, revoke, options (accounts to choose from) and the push calls the sync uses
// (server.js → accounting sync). A connection holds its tokens; calls refresh them when they're about to run out, and the caller saves.
const crypto = require('crypto');
const social = require('./social');

const err = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });
const app = (kind) => social.apps()[kind];
const form = (o) => new URLSearchParams(Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)));
const basic = (a) => 'Basic ' + Buffer.from(`${a.id}:${a.secret}`).toString('base64');
const round2 = (n) => Math.round(n * 100) / 100;
const day = (s) => String(s || '').slice(0, 10);
const expired = (name) => err(`${name} access ran out. Disconnect it in Settings → QuickBooks & Xero and connect again.`, 400, { reconnect: true });

// fetch, reading JSON; errorOf turns the provider's error body into a message
async function call(name, url, opts, errorOf) {
  let r; try { r = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) }); } catch (e) { throw err(`Couldn’t reach ${name}. Try again in a minute.`, 502); }
  const txt = await r.text(); let j; try { j = txt ? JSON.parse(txt) : {}; } catch (e) { j = { raw: txt.slice(0, 300) }; }
  if (!r.ok) {
    if (r.status === 429) throw err(`${name} is busy (too many requests). The rest syncs on the next run.`, 429, { busy: true });
    throw err(`${name}: ${errorOf(j) || j.error_description || j.error || `answered with an error (${r.status})`}`, r.status === 401 ? 400 : r.status >= 500 ? 502 : 400, r.status === 401 ? { reconnect: true } : {});
  }
  return j;
}

/* ---------- QuickBooks Online ---------- */
const QB_AUTH = 'https://appcenter.intuit.com/connect/oauth2';
const QB_TOKEN = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QB_MINOR = '75';
const qbBase = () => (app('quickbooks').sandbox ? 'https://sandbox-quickbooks.api.intuit.com' : 'https://quickbooks.api.intuit.com');
const qbErr = (j) => { const e = j.Fault && j.Fault.Error && j.Fault.Error[0]; return e ? `${e.Message}${e.Detail && e.Detail !== e.Message ? `: ${e.Detail}` : ''}` : j.error_description || j.error; };
async function qbTokens(params) {
  const a = app('quickbooks');
  const t = await call('QuickBooks', QB_TOKEN, { method: 'POST', headers: { authorization: basic(a), accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body: form(params) }, qbErr);
  return { token: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + (t.expires_in - 120) * 1000, refreshExpiresAt: Date.now() + (t.x_refresh_token_expires_in || 8640000) * 1000 };
}
async function qbToken(conn) {
  if (conn.expiresAt > Date.now()) return conn.token;
  if (!conn.refreshToken || conn.refreshExpiresAt < Date.now()) throw expired('QuickBooks');
  try { Object.assign(conn, await qbTokens({ grant_type: 'refresh_token', refresh_token: conn.refreshToken })); } catch (e) { if (/invalid_grant/i.test(e.message)) throw expired('QuickBooks'); throw e; }
  return conn.token;
}
async function qb(conn, method, path, body) {
  const url = `${qbBase()}/v3/company/${conn.realmId}/${path}${path.includes('?') ? '&' : '?'}minorversion=${QB_MINOR}`;
  const headers = { authorization: `Bearer ${await qbToken(conn)}`, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) };
  return call('QuickBooks', url, { method, headers, body: body ? JSON.stringify(body) : undefined }, qbErr);
}
// a record sent before; null when QuickBooks no longer has it (deleted there), so it's sent again as new. Any other failure stops, so a hiccup never makes a duplicate.
const qbGet = (conn, kind, id) => qb(conn, 'GET', `${kind}/${id}`).catch((e) => { if (e.status === 400 && !e.reconnect && !e.busy) return null; throw e; });
const qbQuery = async (conn, q) => (await qb(conn, 'GET', 'query?query=' + encodeURIComponent(q))).QueryResponse || {};
const qbStr = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
// QuickBooks names: no colons or tabs, at most 100 characters
const qbName = (s) => String(s || '').replace(/[:\t\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
const QB_BANKS = ['Bank', 'Credit Card'];
const QB_EXPENSES = ['Expense', 'Cost of Goods Sold', 'Other Expense'];

const quickbooks = {
  name: 'QuickBooks',
  startUrl: (state) => QB_AUTH + '?' + form({ client_id: app('quickbooks').id, response_type: 'code', scope: 'com.intuit.quickbooks.accounting', redirect_uri: social.redirectUri('quickbooks'), state }),
  async connect(code, query) {
    const realmId = String(query.realmId || ''); if (!/^\d+$/.test(realmId)) throw err('QuickBooks didn’t say which company to connect. Try again.');
    const conn = { realmId, ...(await qbTokens({ grant_type: 'authorization_code', code, redirect_uri: social.redirectUri('quickbooks') })) };
    const info = await qb(conn, 'GET', `companyinfo/${realmId}`).catch(() => ({}));
    const ci = info.CompanyInfo || {}; conn.company = ci.CompanyName || ci.LegalName || 'QuickBooks company'; conn.country = ci.Country || '';
    return conn;
  },
  async revoke(conn) {
    const a = app('quickbooks');
    await call('QuickBooks', 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke', { method: 'POST', headers: { authorization: basic(a), accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ token: conn.refreshToken }) }, qbErr).catch(() => {});
  },
  // what the business picks in its settings: the product/service invoices use, where payments and expenses go
  async options(conn) {
    const accts = (await qbQuery(conn, 'select * from Account where Active = true maxresults 1000')).Account || [];
    const items = (await qbQuery(conn, "select * from Item where Active = true and Type = 'Service' maxresults 1000")).Item || [];
    const a = (x) => ({ id: x.Id, name: x.FullyQualifiedName || x.Name, type: x.AccountType });
    const undeposited = accts.find((x) => x.AccountSubType === 'UndepositedFunds');
    return {
      items: items.map((x) => ({ id: x.Id, name: x.FullyQualifiedName || x.Name })),
      depositAccounts: accts.filter((x) => x.AccountType === 'Bank' || x.AccountSubType === 'UndepositedFunds').map(a),
      bankAccounts: accts.filter((x) => QB_BANKS.includes(x.AccountType)).map(a),
      expenseAccounts: accts.filter((x) => QB_EXPENSES.includes(x.AccountType)).map(a),
      taxRates: null, // US QuickBooks works out sales tax itself; the invoice sends the total
      defaults: { itemId: (items.find((x) => /^services?$/i.test(x.Name)) || items[0] || {}).Id || '', depositAccount: undeposited ? undeposited.Id : '' },
    };
  },
  async customer(conn, c, remoteId) {
    const body = { DisplayName: qbName(c.name) || 'Client', ...(c.company ? { CompanyName: qbName(c.company) } : {}),
      ...(c.email ? { PrimaryEmailAddr: { Address: String(c.email).split(/[,;\s]/)[0] } } : {}), ...(c.phone ? { PrimaryPhone: { FreeFormNumber: String(c.phone).slice(0, 30) } } : {}),
      ...(c.address ? { BillAddr: { Line1: String(c.address).slice(0, 500) } } : {}) };
    if (remoteId) {
      const cur = (await qbGet(conn, 'customer', remoteId) || {}).Customer;
      if (cur && cur.Active !== false) { await qb(conn, 'POST', 'customer', { ...body, Id: cur.Id, SyncToken: cur.SyncToken, sparse: true }).catch(() => {}); return cur.Id; } // a name clash on update keeps the old record
    }
    // one already in QuickBooks with this name (e.g. added by hand): use it, so no duplicates
    const found = ((await qbQuery(conn, `select Id from Customer where DisplayName = '${qbStr(body.DisplayName)}'`)).Customer || [])[0];
    if (found) return found.Id;
    try { return (await qb(conn, 'POST', 'customer', body)).Customer.Id; } catch (e) {
      if (!/Duplicate Name/i.test(e.message)) throw e; // the name belongs to a vendor or employee: add a marker
      return (await qb(conn, 'POST', 'customer', { ...body, DisplayName: qbName(body.DisplayName.slice(0, 88) + ' (client)') })).Customer.Id;
    }
  },
  // the settings an invoice needs, checked before its customer is added
  checkInvoice(S) { if (!S.itemId) throw err('Choose the QuickBooks product/service for invoice lines in Settings → QuickBooks & Xero'); },
  async invoice(conn, inv, ctx, remoteId) {
    const S = ctx.settings; this.checkInvoice(S, inv);
    const taxed = (Number(inv.tax) || 0) > 0;
    const Line = inv.items.filter((i) => i.qty && i.price).map((i) => ({ DetailType: 'SalesItemLineDetail', Amount: round2(i.qty * i.price), Description: [i.desc, i.details].filter(Boolean).join('\n').slice(0, 4000),
      SalesItemLineDetail: { ItemRef: { value: S.itemId }, Qty: i.qty, UnitPrice: i.price, TaxCodeRef: { value: taxed ? 'TAX' : 'NON' } } }));
    if (inv.discount) Line.push({ DetailType: 'DiscountLineDetail', Amount: round2(inv.discount), DiscountLineDetail: { PercentBased: false } });
    const body = { CustomerRef: { value: ctx.customerId }, DocNumber: String(inv.number || '').slice(0, 21), TxnDate: day(inv.issueDate || inv.createdAt), ...(inv.dueDate ? { DueDate: day(inv.dueDate) } : {}),
      Line, ...(taxed ? { TxnTaxDetail: { TotalTax: round2(inv.tax) } } : {}), ...(inv.notes ? { CustomerMemo: { value: String(inv.notes).slice(0, 1000) } } : {}), PrivateNote: `From Worklio Pro, invoice ${inv.number}` };
    if (remoteId) {
      const cur = (await qbGet(conn, 'invoice', remoteId) || {}).Invoice;
      if (cur) return (await qb(conn, 'POST', 'invoice', { ...body, Id: cur.Id, SyncToken: cur.SyncToken, sparse: true })).Invoice.Id;
    }
    return (await qb(conn, 'POST', 'invoice', body)).Invoice.Id;
  },
  async payment(conn, p, ctx) {
    const body = { CustomerRef: { value: ctx.customerId }, TotalAmt: round2(p.amount), TxnDate: day(p.date), ...(p.reference ? { PaymentRefNum: String(p.reference).slice(0, 21) } : {}),
      ...(ctx.settings.depositAccount ? { DepositToAccountRef: { value: ctx.settings.depositAccount } } : {}), PrivateNote: p.note || 'From Worklio Pro',
      Line: [{ Amount: round2(p.amount), LinkedTxn: [{ TxnId: ctx.invoiceId, TxnType: 'Invoice' }] }] };
    return (await qb(conn, 'POST', 'payment', body)).Payment.Id;
  },
  async expense(conn, e, ctx, remoteId) {
    const S = ctx.settings; const acct = (ctx.categoryAccount || S.expenseAccount); const bank = ctx.options.bankAccounts.find((x) => x.id === S.bankAccount);
    if (!acct || !bank) throw err('Choose the expense account and the account expenses are paid from in Settings → QuickBooks & Xero');
    const body = { PaymentType: bank.type === 'Credit Card' ? 'CreditCard' : 'Cash', AccountRef: { value: bank.id }, TxnDate: day(e.date),
      PrivateNote: [e.vendor, e.description, ctx.job ? `Job ${ctx.job}` : ''].filter(Boolean).join(' · ').slice(0, 4000) || 'From Worklio Pro',
      Line: [{ DetailType: 'AccountBasedExpenseLineDetail', Amount: round2(e.amount), Description: [e.category, e.vendor, e.description].filter(Boolean).join(': ').slice(0, 4000), AccountBasedExpenseLineDetail: { AccountRef: { value: acct } } }] };
    if (remoteId) {
      const cur = (await qbGet(conn, 'purchase', remoteId) || {}).Purchase;
      if (cur) return (await qb(conn, 'POST', 'purchase', { ...body, Id: cur.Id, SyncToken: cur.SyncToken, sparse: true })).Purchase.Id;
    }
    return (await qb(conn, 'POST', 'purchase', body)).Purchase.Id;
  },
  pace: 150, // QuickBooks allows 500 requests a minute per company
};

/* ---------- Xero ---------- */
const XE_API = 'https://api.xero.com/api.xro/2.0';
// Xero's granular scopes (required for apps created from March 2026); XERO_SCOPES overrides them for an older app
const XE_SCOPES = () => process.env.XERO_SCOPES || 'openid profile email offline_access accounting.contacts accounting.settings.read accounting.invoices accounting.payments accounting.banktransactions';
const xeErr = (j) => {
  const el = j.Elements && j.Elements[0]; const v = el && el.ValidationErrors && el.ValidationErrors.map((x) => x.Message).join('; ');
  return v || j.Detail || j.Message || j.Title || j.error_description || j.error;
};
async function xeTokens(params) {
  const t = await call('Xero', 'https://identity.xero.com/connect/token', { method: 'POST', headers: { authorization: basic(app('xero')), 'content-type': 'application/x-www-form-urlencoded' }, body: form(params) }, xeErr);
  return { token: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + (t.expires_in - 120) * 1000, refreshExpiresAt: Date.now() + 59 * 864e5 }; // a refresh token lasts 60 days and changes each use
}
async function xeToken(conn) {
  if (conn.expiresAt > Date.now()) return conn.token;
  if (!conn.refreshToken || conn.refreshExpiresAt < Date.now()) throw expired('Xero');
  try { Object.assign(conn, await xeTokens({ grant_type: 'refresh_token', refresh_token: conn.refreshToken })); } catch (e) { if (/invalid_grant/i.test(e.message)) throw expired('Xero'); throw e; }
  return conn.token;
}
async function xe(conn, method, path, body) {
  const headers = { authorization: `Bearer ${await xeToken(conn)}`, 'xero-tenant-id': conn.tenantId, accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) };
  return call('Xero', `${XE_API}/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }, xeErr);
}
const xeStr = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const xeName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 255);
const XE_EXPENSES = ['EXPENSE', 'DIRECTCOSTS', 'OVERHEADS'];
const XE_REVENUE = ['REVENUE', 'SALES', 'OTHERINCOME'];

const xero = {
  name: 'Xero',
  startUrl: (state) => 'https://login.xero.com/identity/connect/authorize?' + form({ response_type: 'code', client_id: app('xero').id, redirect_uri: social.redirectUri('xero'), scope: XE_SCOPES(), state }),
  async connect(code) {
    const conn = await xeTokens({ grant_type: 'authorization_code', code, redirect_uri: social.redirectUri('xero') });
    const list = await call('Xero', 'https://api.xero.com/connections', { headers: { authorization: `Bearer ${conn.token}`, accept: 'application/json' } }, xeErr);
    const orgs = (Array.isArray(list) ? list : []).filter((x) => x.tenantType === 'ORGANISATION');
    if (!orgs.length) throw err('No Xero organisation was shared. Connect again and pick your organisation.');
    const o = orgs.sort((a, b) => String(b.updatedDateUtc || b.createdDateUtc).localeCompare(String(a.updatedDateUtc || a.createdDateUtc)))[0]; // the one just picked
    return { ...conn, tenantId: o.tenantId, connectionId: o.id, company: o.tenantName || 'Xero organisation' };
  },
  async revoke(conn) {
    await call('Xero', 'https://identity.xero.com/connect/revocation', { method: 'POST', headers: { authorization: basic(app('xero')), 'content-type': 'application/x-www-form-urlencoded' }, body: form({ token: conn.refreshToken }) }, xeErr).catch(() => {});
  },
  async options(conn) {
    const accts = ((await xe(conn, 'GET', 'Accounts?where=' + encodeURIComponent('Status=="ACTIVE"'))).Accounts || []);
    const rates = ((await xe(conn, 'GET', 'TaxRates')).TaxRates || []).filter((x) => x.Status === 'ACTIVE' && x.CanApplyToRevenue !== false);
    const a = (x) => ({ id: x.Code || x.AccountID, name: x.Code ? `${x.Code} · ${x.Name}` : x.Name, type: x.Type });
    const coded = accts.filter((x) => x.Code); // invoice lines and spend money need an account code
    return {
      items: null,
      salesAccounts: coded.filter((x) => XE_REVENUE.includes(x.Type)).map(a),
      depositAccounts: coded.filter((x) => x.Type === 'BANK' || x.EnablePaymentsToAccount).map(a),
      bankAccounts: coded.filter((x) => x.Type === 'BANK').map(a),
      expenseAccounts: coded.filter((x) => XE_EXPENSES.includes(x.Type)).map(a),
      taxRates: rates.map((x) => ({ id: x.TaxType, name: `${x.Name} (${Number(x.EffectiveRate || x.DisplayTaxRate || 0)}%)`, rate: Number(x.EffectiveRate || 0) })),
      defaults: { salesAccount: (coded.find((x) => x.Code === '200') || coded.find((x) => XE_REVENUE.includes(x.Type)) || {}).Code || '' },
    };
  },
  async customer(conn, c, remoteId) {
    const body = { Name: xeName(c.name) || 'Client', ...(c.email ? { EmailAddress: String(c.email).split(/[,;\s]/)[0] } : {}),
      ...(c.phone ? { Phones: [{ PhoneType: 'DEFAULT', PhoneNumber: String(c.phone).slice(0, 50) }] } : {}), ...(c.address ? { Addresses: [{ AddressType: 'STREET', AddressLine1: String(c.address).slice(0, 500) }] } : {}) };
    if (remoteId) { await xe(conn, 'POST', 'Contacts', { Contacts: [{ ContactID: remoteId, ...body }] }).catch(() => {}); return remoteId; } // a name clash on update keeps the old record
    const found = ((await xe(conn, 'GET', 'Contacts?where=' + encodeURIComponent(`Name=="${xeStr(body.Name)}"`))).Contacts || [])[0];
    if (found) return found.ContactID;
    return (await xe(conn, 'POST', 'Contacts', { Contacts: [body] })).Contacts[0].ContactID;
  },
  checkInvoice(S, inv) {
    if (!S.salesAccount) throw err('Choose the Xero sales account for invoice lines in Settings → QuickBooks & Xero');
    if ((Number(inv.tax) || 0) > 0 && !S.taxType) throw err('Choose the Xero tax rate for taxed invoices in Settings → QuickBooks & Xero');
  },
  async invoice(conn, inv, ctx, remoteId) {
    const S = ctx.settings; this.checkInvoice(S, inv); const taxed = (Number(inv.tax) || 0) > 0;
    const lines = inv.items.filter((i) => i.qty && i.price).map((i) => ({ Description: [i.desc, i.details].filter(Boolean).join('\n').slice(0, 4000) || 'Service', Quantity: i.qty, UnitAmount: i.price, amount: i.qty * i.price }));
    if (inv.discount) lines.push({ Description: 'Discount', Quantity: 1, UnitAmount: -round2(inv.discount), amount: -inv.discount });
    // our sales tax, spread across the lines so Xero's total matches the invoice to the cent
    const base = lines.reduce((s, l) => s + l.amount, 0); let left = round2(inv.tax || 0);
    const LineItems = lines.map((l, k) => { const t = !taxed ? 0 : k === lines.length - 1 ? left : round2(inv.tax * l.amount / (base || 1)); left = round2(left - t);
      return { Description: l.Description, Quantity: l.Quantity, UnitAmount: l.UnitAmount, AccountCode: S.salesAccount, TaxType: taxed ? S.taxType : 'NONE', ...(taxed ? { TaxAmount: t } : {}) }; });
    const body = { Type: 'ACCREC', Contact: { ContactID: ctx.customerId }, InvoiceNumber: String(inv.number || '').slice(0, 255), Reference: 'Worklio Pro', Date: day(inv.issueDate || inv.createdAt),
      DueDate: day(inv.dueDate || inv.issueDate || inv.createdAt), LineAmountTypes: 'Exclusive', Status: 'AUTHORISED', LineItems };
    return (await xe(conn, 'POST', 'Invoices', { Invoices: [{ ...(remoteId ? { InvoiceID: remoteId } : {}), ...body }] })).Invoices[0].InvoiceID;
  },
  async payment(conn, p, ctx) {
    if (!ctx.settings.depositAccount) throw err('Choose the Xero account payments go to in Settings → QuickBooks & Xero');
    return (await xe(conn, 'PUT', 'Payments', { Payments: [{ Invoice: { InvoiceID: ctx.invoiceId }, Account: { Code: ctx.settings.depositAccount }, Date: day(p.date), Amount: round2(p.amount), Reference: String(p.reference || 'Worklio Pro').slice(0, 255) }] })).Payments[0].PaymentID;
  },
  async expense(conn, e, ctx, remoteId) {
    const S = ctx.settings; const acct = (ctx.categoryAccount || S.expenseAccount);
    if (!acct || !S.bankAccount) throw err('Choose the expense account and the bank account expenses are paid from in Settings → QuickBooks & Xero');
    const body = { Type: 'SPEND', Contact: { Name: xeName(e.vendor) || 'Expenses' }, BankAccount: { Code: S.bankAccount }, Date: day(e.date), Reference: [e.category, ctx.job ? `Job ${ctx.job}` : ''].filter(Boolean).join(' · ').slice(0, 255),
      LineAmountTypes: 'Inclusive', LineItems: [{ Description: [e.description, e.vendor].filter(Boolean).join(' · ').slice(0, 4000) || e.category || 'Expense', Quantity: 1, UnitAmount: round2(e.amount), AccountCode: acct }] };
    return (await xe(conn, 'POST', 'BankTransactions', { BankTransactions: [{ ...(remoteId ? { BankTransactionID: remoteId } : {}), ...body }] })).BankTransactions[0].BankTransactionID;
  },
  pace: 1100, // Xero allows 60 calls a minute per organisation
};

const PROVIDERS = { quickbooks, xero };
const has = (k) => Object.prototype.hasOwnProperty.call(PROVIDERS, k);
const ready = (k) => { const a = app(k); return !!(a && a.id && a.secret); };
const startUrl = (kind, tenantId, userId) => PROVIDERS[kind].startUrl(social.sign({ k: kind, t: tenantId, u: userId, n: crypto.randomBytes(6).toString('hex'), exp: Date.now() + 15 * 60e3 }));

module.exports = { PROVIDERS, has, ready, startUrl };
