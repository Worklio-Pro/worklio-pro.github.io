// Business automations (Marketing → Automations, the 'automations' plan extra): a business's own messages, sent by rules.
// Not the Alpha one (lib/automations.js), which emails businesses. Each automation has a trigger (e.g. a quote was sent and
// is still unanswered) and conditions, then branches off to one or more branches: each has its own days and send hour, who
// gets it and the message (e.g. email the client after 3 days, and tell the team after 7). The server checks every hour.
// An automation saved before branches had one set of those fields; it becomes one branch with the id 'main', whose sent
// keys keep the old form (automationId|refId|anchor) so nothing goes out twice. Other branches: automationId|branchId|refId|anchor.
// Each quote, job, invoice or client gets an automation once per moment, and only moments due after it was turned on,
// so turning one on never messages old records. Stored per account: automations, automationSent, automationLog, automationOptOut.
const DAY = 864e5;
const fail = (m, status = 400) => Object.assign(new Error(m), { status });
const addDays = (ymd, n) => new Date(Date.parse(String(ymd).slice(0, 10) + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10);

const COMMON_VARS = { client_name: 'Client name', first_name: 'Client’s first name', company_name: 'Your business name', company_phone: 'Your phone number', company_email: 'Your email', portal_link: 'Their client portal' };
const DOC_VARS = {
  quote: { number: 'Quote number', title: 'Quote title', total: 'Quote total', link: 'Link to the quote' },
  invoice: { number: 'Invoice number', title: 'Invoice subject', total: 'Invoice total', balance: 'Balance due', due_date: 'Due date', link: 'Link to view and pay' },
  job: { number: 'Job number', title: 'Job title', date: 'Job date', time: 'Start time', address: 'Job address', link: 'Their client portal' },
  client: {},
};
// sms: false for marketing-style messages. Clients agree to texts about their quotes, invoices and appointments, not to promotions.
const TRIGGERS = {
  quoteSent: { kind: 'quote', label: 'Quote not answered', when: 'days after it was sent, if still unanswered', sms: true },
  quoteApproved: { kind: 'quote', label: 'Quote approved', when: 'days after it was approved', sms: true },
  invoiceDue: { kind: 'invoice', label: 'Invoice coming due', when: 'days before its due date, if unpaid', sms: true },
  invoiceOverdue: { kind: 'invoice', label: 'Invoice overdue', when: 'days after its due date, if unpaid', sms: true },
  invoicePaid: { kind: 'invoice', label: 'Invoice paid', when: 'days after it was paid', sms: true, review: 'invoice' },
  jobUpcoming: { kind: 'job', label: 'Upcoming job', when: 'days before the job', sms: true },
  jobCompleted: { kind: 'job', label: 'Job completed', when: 'days after it was completed', sms: true, review: 'job' },
  clientNew: { kind: 'client', label: 'New client', when: 'days after they were added', sms: false },
  clientQuiet: { kind: 'client', label: 'Client gone quiet', when: 'days after their last job', sms: false },
};
const fill = (s, v) => String(s || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => v[k] ?? '');
const USES_REVIEW = /\{\{\s*review_link\s*\}\}/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// H: what the server shares. reviewRecord, reviewLink, db, save, uid, token, iso, niceDate, money, findClient, tenancy, localNow, invoiceStatus, withStatus, quoteLink, invoiceLink, portalLink, baseUrl, renderEmail, notify, sendEmail, pushTo, usersWhoCan, jobCrew, pushTime
module.exports = (H) => {
  const { db, tenancy } = H;
  const LEGACY = ['days', 'hour', 'to', 'channels', 'subject', 'body', 'smsBody'];
  const list = () => {
    const l = (db.automations = db.automations || []);
    for (const a of l) if (!Array.isArray(a.branches)) { a.branches = [{ id: 'main', ...Object.fromEntries(LEGACY.map((k) => [k, a[k]])) }]; LEGACY.forEach((k) => delete a[k]); }
    return l;
  };
  const sent = () => (db.automationSent = db.automationSent || {});
  const log = () => (db.automationLog = db.automationLog || []);
  const optOut = () => (db.automationOptOut = db.automationOptOut || {});

  // the review link: only after finished work, and only if the plan has Reviews
  const varsFor = (trigger) => ({ ...COMMON_VARS, ...DOC_VARS[TRIGGERS[trigger].kind], ...(TRIGGERS[trigger].review && tenancy.has('reviews') ? { review_link: 'Review link' } : {}) });
  const clientVars = (c) => ({ client_name: c.name, first_name: String(c.name || '').split(/\s+/)[0], company_name: db.company.name || '', company_phone: db.company.phone || '', company_email: db.company.email || '', portal_link: H.portalLink(c) });
  
  // ---------- the moments a trigger is about: one per record it applies to right now ----------
  function moments(a, b) {
    const n = Number(b.days) || 0; const out = [];
    let floor = ''; // an imported record (Alpha → Import data): only its moments from the day it was imported, never its history
    const from = (rec) => { floor = rec && rec.imported ? String((db.importLog || []).find((b) => b.id === rec.imported.batch)?.at || '9999').slice(0, 10) : ''; return true; };
    const add = (c, refId, refNumber, anchor, due, amount, vars, url) => { if (c && due && (!floor || due >= floor)) out.push({ c, refId, refNumber, anchor, due, amount, vars, url }); };
    const qVars = (q) => ({ number: q.number, title: q.title || '', total: H.money(q.total), link: H.quoteLink(q) });
    const iVars = (i) => ({ number: i.number, title: i.subject || '', total: H.money(i.total), balance: H.money(H.withStatus(i).balanceDue ?? i.total), due_date: H.niceDate(i.dueDate), link: H.invoiceLink(i) });
    const jVars = (j, c) => ({ number: j.number, title: j.title || '', date: j.date ? H.niceDate(j.date) : '', time: j.startTime && !j.anytime ? H.pushTime(j.startTime) : '', address: j.address || c.address || '', link: H.portalLink(c) });
    const today = H.localNow().date;
    if (a.trigger === 'quoteSent' || a.trigger === 'quoteApproved') for (const q of db.quotes) {
      const c = H.findClient(q.clientId); if (!c || !from(q)) continue;
      if (a.trigger === 'quoteSent' && q.status === 'sent' && q.sentAt) add(c, q.id, q.number, 'sent:' + q.sentAt, addDays(q.sentAt, n), q.total, qVars(q), `/quotes/edit?id=${q.id}`);
      if (a.trigger === 'quoteApproved' && q.status === 'approved' && q.respondedAt) add(c, q.id, q.number, 'approved', addDays(q.respondedAt, n), q.total, qVars(q), `/quotes/edit?id=${q.id}`);
    }
    if (a.trigger.startsWith('invoice')) for (const i of db.invoices) {
      const c = H.findClient(i.clientId); if (!c || !from(i)) continue;
      const open = i.status !== 'draft' && i.status !== 'paid' && (H.withStatus(i).balanceDue ?? i.total) > 0.004;
      if (a.trigger === 'invoiceDue' && open && i.dueDate) add(c, i.id, i.number, 'due:' + i.dueDate, addDays(i.dueDate, -n), i.total, iVars(i), `/invoices/view?id=${i.id}`);
      if (a.trigger === 'invoiceOverdue' && open && i.dueDate) add(c, i.id, i.number, 'late:' + i.dueDate, addDays(i.dueDate, n), i.total, iVars(i), `/invoices/view?id=${i.id}`);
      if (a.trigger === 'invoicePaid' && i.status === 'paid' && i.paidAt) add(c, i.id, i.number, 'paid', addDays(i.paidAt, n), i.total, iVars(i), `/invoices/view?id=${i.id}`);
    }
    if (a.trigger.startsWith('job')) for (const j of db.jobs) {
      const c = H.findClient(j.clientId); if (!c || !from(j)) continue;
      if (a.trigger === 'jobUpcoming' && j.date && j.date >= today && !['cancelled', 'completed'].includes(j.status)) add(c, j.id, j.number, 'on:' + j.date, addDays(j.date, -n), j.total, jVars(j, c), `/jobs/edit?id=${j.id}`);
      if (a.trigger === 'jobCompleted' && j.status === 'completed' && j.completedAt) add(c, j.id, j.number, 'done', addDays(j.completedAt, n), j.total, jVars(j, c), `/jobs/edit?id=${j.id}`);
    }
    if (a.trigger === 'clientNew' || a.trigger === 'clientQuiet') for (const c of db.clients) {
      if (!c.createdAt || !from(c)) continue;
      if (a.trigger === 'clientNew' && c.imported) continue;
      if (a.trigger === 'clientNew') add(c, c.id, '', 'new', addDays(c.createdAt, n), null, {}, `/clients/view?id=${c.id}`);
      else { // quiet: nothing on the calendar ahead of them, counted from their last job, once per quiet spell
        const dates = db.jobs.filter((j) => j.clientId === c.id && j.date && j.status !== 'cancelled').map((j) => j.date).sort();
        const last = dates[dates.length - 1];
        if (last && last < today) add(c, c.id, '', 'quiet:' + last, addDays(last, n), null, {}, `/clients/view?id=${c.id}`);
      }
    }
    return out;
  }
  const passes = (a, m) => {
    const tags = a.tags || [];
    if (tags.length && !(m.c.tags || []).some((t) => tags.includes(t))) return false;
    if (Number(a.minAmount) > 0 && m.amount != null && Number(m.amount) < Number(a.minAmount)) return false;
    return true;
  };
  // values for a real send. The review record is only made here, so previews and page loads don't create any
  function liveVars(a, b, m) {
    const vars = { ...clientVars(m.c), ...m.vars }; const kind = TRIGGERS[a.trigger].review;
    if (kind && tenancy.has('reviews') && USES_REVIEW.test(`${b.subject} ${b.body} ${b.smsBody}`)) {
      m.review = H.reviewRecord(kind, (kind === 'job' ? db.jobs : db.invoices).find((x) => x.id === m.refId));
      vars.review_link = H.reviewLink(m.review);
    }
    return vars;
  }
  const keyOf = (a, b, m) => (b.id === 'main' ? `${a.id}|${m.refId}|${m.anchor}` : `${a.id}|${b.id}|${m.refId}|${m.anchor}`);
  // a branch only sends what comes due from the day the automation was turned on, or the day the branch was added to it if later
  const startOf = (a, b) => (b.since && b.since > (a.enabledOn || '') ? b.since : a.enabledOn || '');
  // why a client can't get this on a channel ('' = they can)
  function blocked(b, m, ch) {
    if (b.to !== 'client') return '';
    if (ch === 'email') return !EMAIL_RE.test(m.c.email || '') ? 'No email address' : optOut()[m.c.id] ? 'Unsubscribed' : '';
    return !tenancy.has('sms') ? 'Text messages aren’t in your plan' : !m.c.phone ? 'No mobile number' : !m.c.smsConsent ? 'Hasn’t agreed to texts' : '';
  }

  // ---------- sending ----------
  const unsubUrl = (c) => { H.portalLink(c); return `${H.baseUrl()}/p/automations/${c.portalToken}`; }; // portalLink gives an older client a token
  function emailOf(a, b, m) {
    const vars = liveVars(a, b, m);
    const body = b.to === 'client' ? `${b.body}\n\nDon’t want these emails? [Unsubscribe](${unsubUrl(m.c)})` : b.body;
    return H.renderEmail('automation', vars, { subject: b.subject, body });
  }
  function textOf(a, b, m) {
    const t = fill(b.smsBody, liveVars(a, b, m)).trim();
    return /\bSTOP\b/.test(t) ? t : `${t} Reply STOP to opt out.`;
  }
  function record(a, m, channel, to, status, detail) {
    log().unshift({ id: H.uid(), at: new Date().toISOString(), automationId: a.id, automation: a.name, clientId: m.c.id, clientName: m.c.name, refNumber: m.refNumber, channel, to: to || '', status, detail: detail || '' });
    if (log().length > 500) db.automationLog = log().slice(0, 500);
  }
  async function sendOne(a, b, m) {
    let delivered = false; let failed = false; const note = (st) => { if (st === 'failed') failed = true; else delivered = true; };
    for (const ch of b.channels) {
      if (ch === 'push') {
        const crew = TRIGGERS[a.trigger].kind === 'job' ? H.jobCrew(db.jobs.find((j) => j.id === m.refId) || {}) : [];
        const v = liveVars(a, b, m);
        H.pushTo([...db.users.filter((u) => u.role === 'owner' || u.role === 'admin'), ...crew], 'automation', { title: fill(b.subject, v), body: fill(b.body, v).replace(/\s+/g, ' ').slice(0, 160), url: m.url });
        record(a, m, 'push', 'Team', 'sent'); note('sent'); continue;
      }
      const why = blocked(b, m, ch);
      if (why) { record(a, m, ch, '', 'skipped', why); continue; } // nothing to retry: they can't get it this way
      if (b.to === 'team' && !db.company.email) { record(a, m, ch, '', 'skipped', 'No company email'); continue; }
      const e = ch === 'email' ? emailOf(a, b, m) : null;
      const n = await H.notify({ clientId: m.c.id, channel: ch, kind: 'automation', refId: m.refId, refNumber: m.refNumber, subject: e ? e.subject : '', body: e ? e.body : textOf(a, b, m), html: e ? e.html : '', to: b.to === 'team' ? db.company.email : '' });
      record(a, m, ch, n.to, n.status, n.detail); note(n.status);
    }
    if (delivered && m.review && b.to === 'client' && !m.review.emailedAt) m.review.emailedAt = new Date().toISOString(); // counts as asking, so the automatic review request doesn't ask again
    return delivered || !failed;
  }
  let running = false;
  async function runAll() {
    if (running) return; running = true;
    try {
      for (const t of tenancy.platform().tenants) {
        if (t.status !== 'active') continue;
        await tenancy.run(t, () => runAccount().catch((e) => console.error('business automations:', t.id, e.message)));
      }
    } finally { running = false; }
  }
  async function runAccount() {
    if (!tenancy.has('automations') || !(db.automations || []).length) return;
    const { date: today, hour } = H.localNow(); const retries = (db.automationRetry = db.automationRetry || {});
    for (const a of list()) {
      if (!a.enabled) continue;
      for (const b of a.branches) for (const m of moments(a, b)) {
        const k = keyOf(a, b, m);
        if (sent()[k] || m.due > today || m.due < startOf(a, b) || (m.due === today && hour < b.hour) || !passes(a, m)) continue;
        const done = await sendOne(a, b, m);
        retries[k] = (retries[k] || 0) + 1;
        if (done || retries[k] >= 3) { sent()[k] = today; delete retries[k]; a.sentCount = (a.sentCount || 0) + (done ? 1 : 0); a.lastSentAt = done ? new Date().toISOString() : a.lastSentAt; } // a failed send gets three tries, an hour apart
        H.save();
      }
    }
  }

  // ---------- editing ----------
  // one branch: its errors start "Branch 2: " when there's more than one, so the editor can open that branch
  function cleanBranch(x, trigger, n, many, old) {
    const say = (m) => fail(many ? `Branch ${n}: ${m}` : m);
    const b = { id: old ? old.id : H.uid(), days: Math.max(0, Math.min(365, Math.floor(Number(x.days)) || 0)), hour: Math.max(8, Math.min(20, Math.floor(Number(x.hour)) || 9)), to: x.to === 'team' ? 'team' : 'client',
      subject: String(x.subject || '').trim().slice(0, 200), body: String(x.body || '').trim().slice(0, 10000), smsBody: String(x.smsBody || '').trim().slice(0, 480) };
    if (old && old.since) b.since = old.since;
    if (trigger === 'clientQuiet' && b.days < 1) throw say('Choose at least 1 day for a client gone quiet');
    const allowed = b.to === 'team' ? ['email', 'push'] : ['email', ...(TRIGGERS[trigger].sms && tenancy.has('sms') ? ['sms'] : [])];
    b.channels = allowed.filter((c) => (x.channels || []).includes(c));
    if (!b.channels.length) throw say('Choose how to send it');
    if ((b.channels.includes('email') || b.channels.includes('push')) && (!b.subject || !b.body)) throw say('Write a subject and a message');
    if (b.channels.includes('sms') && !b.smsBody) throw say('Write the text message');
    const known = varsFor(trigger);
    for (const m of `${b.subject} ${b.body} ${b.smsBody}`.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) if (!(m[1] in known)) throw say(`{{${m[1]}}} doesn’t work with this trigger. Use the values listed under the message.`);
    return b;
  }
  function clean(x, was) {
    const trigger = TRIGGERS[x.trigger] ? x.trigger : ''; if (!trigger) throw fail('Choose when it should send');
    const a = { ...(was || {}), name: String(x.name || '').trim().slice(0, 80), trigger,
      tags: (Array.isArray(x.tags) ? x.tags : []).map((t) => String(t).trim()).filter(Boolean).slice(0, 20), minAmount: Math.max(0, Number(x.minAmount) || 0) };
    LEGACY.forEach((k) => delete a[k]);
    if (!a.name) throw fail('Give the automation a name');
    const raw = Array.isArray(x.branches) ? x.branches : [x]; // one set of fields, as before branches, is one branch
    if (!raw.length) throw fail('Add at least one branch');
    if (raw.length > 10) throw fail('An automation can have up to 10 branches');
    const had = (was && was.branches) || []; const today = H.localNow().date;
    a.branches = raw.map((r, i) => {
      const old = had.find((h) => h.id === (r && r.id));
      const b = cleanBranch(r || {}, trigger, i + 1, raw.length > 1, old);
      if (!old && was && was.enabled) b.since = today; // added to a live automation: from today on, so it doesn't catch up on old records
      return b;
    });
    return a;
  }
  function create(b) {
    if (list().length >= 50) throw fail('You can have up to 50 automations');
    const a = { id: H.uid(), ...clean(b), enabled: false, enabledOn: '', sentCount: 0, createdAt: new Date().toISOString() };
    list().push(a); H.save(); return a;
  }
  function update(id, b) {
    const i = list().findIndex((x) => x.id === id); if (i < 0) throw fail('Automation not found', 404);
    const was = list()[i]; list()[i] = clean(b, was);
    for (const old of was.branches) if (old.id !== 'main' && !list()[i].branches.some((x) => x.id === old.id)) for (const k of Object.keys(sent())) if (k.startsWith(`${id}|${old.id}|`)) delete sent()[k]; // a removed branch's history
    H.save(); return list()[i];
  }
  function setEnabled(id, on) {
    const a = list().find((x) => x.id === id); if (!a) throw fail('Automation not found', 404);
    if (on && !a.enabled) a.enabledOn = H.localNow().date; // only moments from today on: turning it on never catches up on old records
    a.enabled = !!on; H.save();
  }
  function remove(id) {
    db.automations = list().filter((x) => x.id !== id);
    for (const k of Object.keys(sent())) if (k.startsWith(id + '|')) delete sent()[k];
    H.save();
  }
  // who it would go to in the next 30 days
  function preview(x) {
    const was = x.id ? list().find((y) => y.id === x.id) : null; const a = { ...clean(x, was), id: x.id || '' };
    const today = H.localNow().date; const until = addDays(today, 30); const rows = [];
    a.branches.forEach((b, i) => {
      const from = was && was.enabled ? startOf(a, b) : today;
      for (const m of moments(a, b)) if (passes(a, m) && !sent()[keyOf(a, b, m)] && m.due >= from && m.due <= until) rows.push({ m, b, i });
    });
    rows.sort((p, q) => p.m.due.localeCompare(q.m.due));
    const many = a.branches.length > 1;
    return { total: rows.length, rows: rows.slice(0, 25).map(({ m, b, i }) => ({ client: m.c.name, ref: m.refNumber, due: m.due, branch: many ? i + 1 : 0, skip: b.channels.every((ch) => blocked(b, m, ch)) ? blocked(b, m, b.channels[0]) : '' })) };
  }
  // a sample to the person editing it, with made-up values
  async function test(x, email) { // the branch open in the editor (testBranch), or the first
    const all = clean(x).branches; const b = all[Math.floor(Number(x.testBranch)) || 0] || all[0];
    if (!b.channels.includes('email') && !b.channels.includes('push')) throw fail(`Test emails need an email message${all.length > 1 ? ' in this branch' : ''}; texts can’t be tested from here`);
    if (!EMAIL_RE.test(email || '')) throw fail('Your login has no email address');
    const samples = { client_name: 'Sam Rivera', first_name: 'Sam', number: 'Q-1001', title: 'Backyard refresh', total: '$1,250.00', balance: '$1,250.00', due_date: 'Dec 1, 2026', date: 'Dec 1, 2026', time: '9:00 AM', address: '123 Main St', link: H.baseUrl(), portal_link: H.baseUrl(), review_link: H.baseUrl() };
    const m = H.renderEmail('automation', { company_name: db.company.name || '', company_phone: db.company.phone || '', company_email: db.company.email || '', ...samples }, { subject: `[Test] ${b.subject}`, body: b.body });
    const r = await H.sendEmail(email, m.subject, m.text, { html: m.html });
    if (r.status === 'failed') throw fail(r.detail || 'The test email didn’t send');
    return { to: email, status: r.status };
  }
  const view = () => ({
    automations: list().map((a) => ({ ...a, waiting: a.enabled ? a.branches.reduce((n, b) => n + moments(a, b).filter((m) => passes(a, m) && !sent()[keyOf(a, b, m)] && m.due >= startOf(a, b) && m.due <= H.localNow().date).length, 0) : 0 })),
    log: log().slice(0, 100), triggers: TRIGGERS, vars: Object.fromEntries(Object.keys(TRIGGERS).map((k) => [k, varsFor(k)])),
    sms: tenancy.has('sms'), tags: [...new Set(db.clients.flatMap((c) => c.tags || []))].sort(),
  });
  // the unsubscribe link in client emails
  const clientByToken = (tk) => (tk ? db.clients.find((c) => c.portalToken === tk) : null);
  const isOptedOut = (c) => !!optOut()[c.id];
  const setOptOut = (c, off) => { if (off) optOut()[c.id] = new Date().toISOString(); else delete optOut()[c.id]; H.save(); };

  return { TRIGGERS, runAll, create, update, setEnabled, remove, preview, test, view, clientByToken, isOptedOut, setOptOut };
};
