// Snap to quote (plan feature snapQuote, Unlimited): photos from the job site and what the tech says or types become a draft quote.
// Claude looks at the photos and notes with the business's Products & services list and answers in a fixed JSON shape (structured output):
// a title, a message to the client, one option or Good / Better / Best options of line items, and questions to check before sending.
// The server builds the quote from that: an item matched to the catalog gets the catalog's name, description and price (never a price from
// the AI); anything else goes in at $0 with needsPrice, and a quote with an unpriced item can't be sent or approved until it's priced.
// It's always a draft with aiDraft set (the "Drafted by AI" banner); nothing is sent. The photos are kept on the quote as an internal note.
// db.snapUsage = { month: 'YYYY-MM', used }: drafts made this month, against the plan's allowance.
const fs = require('fs');
const path = require('path');

const MAX_PHOTOS = 6;
const LIMIT = 200; // drafts a month per account (a plan can set snapLimit)
const CATALOG_MAX = 1500; // a bigger list is narrowed to the items that best match the notes
const SCHEMA = (() => {
  const item = { type: 'object', additionalProperties: false, required: ['catalogId', 'name', 'details', 'qty'], properties: {
    catalogId: { type: 'string', description: 'The id of the matching item from the catalog, or an empty string when nothing in the catalog fits' },
    name: { type: 'string', description: 'Line item name: the catalog item’s name when catalogId is set' },
    details: { type: 'string', description: 'What this line covers on this job, for the client; empty to use the catalog description' },
    qty: { type: 'number', description: 'Quantity in the catalog item’s unit' } } };
  return { type: 'object', additionalProperties: false, required: ['title', 'clientMessage', 'sharedItems', 'options', 'questions'], properties: {
    title: { type: 'string', description: 'Short quote title, e.g. “AC replacement” or “Backyard cleanup”' },
    clientMessage: { type: 'string', description: 'Two or three friendly sentences to the client about the work, in the business’s voice' },
    sharedItems: { type: 'array', items: item, description: 'Items in every option (e.g. a service call fee); all items when there is one option' },
    options: { type: 'array', description: '1 option when the job has no real choices; 2 or 3 (Good / Better / Best) when it does', items: { type: 'object', additionalProperties: false,
      required: ['name', 'description', 'recommended', 'items'], properties: { name: { type: 'string' }, description: { type: 'string', description: 'What’s included, one sentence' },
        recommended: { type: 'boolean' }, items: { type: 'array', items: item } } } },
    questions: { type: 'array', items: { type: 'string' }, description: 'Things the business should check or ask before sending, from what the photos and notes don’t show' },
  } };
})();

module.exports = (h) => {
  const { db, save, uid, tenancy, aiClient, saveNoteFiles, computeTotals, nextNumber, token, iso, findClient } = h;
  const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
  const month = () => new Date().toISOString().slice(0, 7);
  const limit = () => Number(tenancy.planOf(tenancy.current()).snapLimit) || LIMIT;
  const used = () => (db.snapUsage && db.snapUsage.month === month() ? db.snapUsage.used || 0 : 0);
  const ready = () => tenancy.has('snapQuote') && !!aiClient() && tenancy.aiOn('aiSnapQuote');
  const status = () => ({ included: tenancy.has('snapQuote'), ready: ready(), used: used(), limit: limit() });

  // the catalog as Claude sees it; past CATALOG_MAX, the items sharing the most words with the notes (then the rest, in order)
  function catalog(notes) {
    const all = (db.services || []).filter((s) => s && s.name);
    if (all.length <= CATALOG_MAX) return all;
    const words = new Set(String(notes).toLowerCase().match(/[a-z0-9]{3,}/g) || []);
    const score = (s) => (`${s.name} ${s.description || ''}`.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((w) => words.has(w)).length;
    return all.map((s, i) => [score(s), i, s]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, CATALOG_MAX).map((x) => x[2]);
  }
  const line = (s) => `${s.id} | ${s.name} | ${s.type === 'product' ? 'product' : 'service'} | $${Number(s.price) || 0}${s.unit ? ' per ' + s.unit : ''} | ${String(s.description || '').replace(/\s+/g, ' ').slice(0, 160)}`;

  async function ask(photos, notes, client) {
    const list = catalog(notes); const co = db.company;
    const Anthropic = require('@anthropic-ai/sdk');
    let r;
    try {
      r = await aiClient().beta.messages.create({
        model: 'claude-opus-5-5', max_tokens: 16000,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', // if the request is declined, the API retries it on a suitable fallback model
        system: [
          { type: 'text', text: `You draft quotes for ${co.name || 'a home service business'}${co.industry ? `, a ${co.industryOther || co.industry} business` : ''}. A technician on site sent photos of the job and notes on what the client needs. Draft the quote they would write.
Rules:
- Build line items from the business's catalog below whenever an item fits, using its id as catalogId and its name. Choose quantities from the photos and notes.
- When the job needs something the catalog doesn't have, add it with catalogId "" and a clear name. Never state or guess a price anywhere: prices come from the catalog, and the business prices the rest.
- Offer 2 or 3 options (for example Repair / Replace / Replace with a high-efficiency unit) only when the job has real choices; otherwise give exactly 1 option. Mark one option recommended. Put items that belong in every option (a trip charge, haul-away) in sharedItems.
- Don't invent brands, model numbers, sizes, measurements, warranties or conditions the photos and notes don't show. If something important is unclear, add it to questions instead.
- Never mention the client's name or address in the title, items or message.
- Write for the client: plain, friendly and specific to this job.` },
          { type: 'text', text: `Catalog (id | name | type | price | description):\n${list.length ? list.map(line).join('\n') : '(empty: the business has no saved products or services)'}`, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: [...photos.map((p) => ({ type: 'image', source: { type: 'base64', media_type: p.type, data: p.data } })),
          { type: 'text', text: `Technician's notes:\n${notes || '(none: work from the photos)'}${client && client.propertyNote ? `\n\nProperty: ${client.propertyNote}` : ''}` }] }],
      });
    } catch (e) {
      console.error('Snap to quote failed:', e.message);
      if (e instanceof Anthropic.AuthenticationError) throw fail('The AI service rejected the API key. Ask your administrator to check ANTHROPIC_API_KEY.', 502);
      if (e instanceof Anthropic.RateLimitError) throw fail('The AI is busy right now. Try again in a minute.', 503);
      throw fail('Couldn’t reach the AI service. Try again.', 502);
    }
    if (r.stop_reason === 'refusal') throw fail('The AI couldn’t draft a quote from these photos. Try other photos or add more notes.', 422);
    if (r.stop_reason === 'max_tokens') throw fail('The draft came out too long. Try fewer photos or shorter notes.', 422);
    const text = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    try { return JSON.parse(text); } catch (e) { throw fail('The AI returned a draft we couldn’t read. Try again.', 502); }
  }

  // the AI's answer → quote fields; catalog prices only
  function build(out) {
    const byId = new Map((db.services || []).map((s) => [s.id, s]));
    const clip = (v, n) => String(v ?? '').trim().slice(0, n);
    const toItem = (x, opt) => {
      const s = x && x.catalogId ? byId.get(String(x.catalogId)) : null; const qty = Math.max(0, Math.round((Number(x && x.qty) || 1) * 100) / 100) || 1;
      const name = clip(s ? s.name : x && x.name, 200); if (!name) return null;
      const price = s ? Math.max(0, Number(s.price) || 0) : 0;
      return { desc: name, details: clip((x && x.details) || (s && s.description) || '', 2000), qty, cost: price, markup: 0, markupType: 'percent', price, ...(opt ? { opt } : {}), ...(s ? {} : { needsPrice: true }) };
    };
    let opts = (Array.isArray(out.options) ? out.options : []).slice(0, 3).filter((o) => o && Array.isArray(o.items));
    const shared = (out.sharedItems || []).map((x) => toItem(x, '')).filter(Boolean);
    const multi = opts.length >= 2 && tenancy.has('quoteOptions');
    if (!multi && opts.length > 1) opts = [opts.find((o) => o.recommended) || opts[0]]; // no options on the plan: the recommended one
    const fields = { title: clip(out.title, 120), notes: clip(out.clientMessage, 2000) };
    if (multi) {
      const options = opts.map((o, i) => ({ id: uid(), name: clip(o.name, 60) || ['Good', 'Better', 'Best'][i], desc: clip(o.description, 300) }));
      const items = [...shared, ...opts.flatMap((o, i) => o.items.map((x) => toItem(x, options[i].id)).filter(Boolean))];
      const rec = opts.findIndex((o) => o.recommended);
      Object.assign(fields, { items, options, recommended: options[rec >= 0 ? rec : 0].id, chosenOption: '' });
    } else {
      Object.assign(fields, { items: [...shared, ...(opts[0] ? opts[0].items.map((x) => toItem(x, '')).filter(Boolean) : [])], options: [], recommended: '', chosenOption: '' });
    }
    if (!fields.items.length) throw fail('The AI couldn’t find work to quote in these photos and notes. Add a few words about what the client needs.', 422);
    const questions = (Array.isArray(out.questions) ? out.questions : []).map((q) => clip(q, 300)).filter(Boolean).slice(0, 8);
    return { fields, questions };
  }

  // b: { quoteId?, clientId, address, propertyId, photos: [dataUrl], notes }; u: the login
  async function draft(b, u) {
    if (!tenancy.has('snapQuote')) throw fail('Snap to quote is on the Unlimited plan', 403);
    if (!aiClient() || !tenancy.aiOn('aiSnapQuote')) throw fail('Snap to quote isn’t available right now', 503);
    if (used() >= limit()) throw fail(`You’ve used this month’s ${limit()} Snap to quote drafts. More are available on the 1st.`, 429);
    const notes = String(b.notes || '').trim().slice(0, 4000);
    const raw = (Array.isArray(b.photos) ? b.photos : []).slice(0, MAX_PHOTOS + 1);
    if (raw.length > MAX_PHOTOS) throw fail(`Choose up to ${MAX_PHOTOS} photos`);
    const photos = raw.map((d) => /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(d || ''))).map((m) => {
      if (!m) throw fail('Photos must be JPEG, PNG or WebP images'); if (m[2].length > 6.5e6) throw fail('Each photo must be under 5 MB'); return { type: m[1], data: m[2] };
    });
    if (!photos.length && notes.length < 10) throw fail('Add a photo, or say what the client needs');
    let q = null;
    if (b.quoteId) {
      q = db.quotes.find((x) => x.id === b.quoteId); if (!q) throw fail('Quote not found', 404);
      if (q.status !== 'draft' || q.signedAt) throw fail('Only a draft quote can be drafted from photos. Make a new quote instead.');
    } else if (!findClient(b.clientId)) throw fail('Choose the client first');
    const c = findClient(q ? q.clientId : b.clientId);
    const out = await ask(photos, notes, c && { propertyNote: '' });
    const { fields, questions } = build(out);
    db.snapUsage = { month: month(), used: used() + 1 };
    const aiDraft = { at: new Date().toISOString(), by: (u && u.name) || '', photos: photos.length, questions, unpriced: fields.items.filter((i) => i.needsPrice).map((i) => i.desc) };
    if (!q) {
      q = { id: uid(), createdAt: iso(new Date()), number: nextNumber('quotes'), status: 'draft', token: token(), clientId: c.id, address: String(b.address || c.address || '').slice(0, 300), propertyId: String(b.propertyId || '').slice(0, 60),
        taxRate: b.taxRate !== undefined && b.taxRate !== '' ? Number(b.taxRate) || 0 : db.company.taxRate, disclaimer: db.company.quoteDisclaimer ?? 'This quote is valid for the next 30 days, after which values may be subject to change.',
        discountType: 'flat', discountValue: 0, depositType: 'flat', depositValue: 0, internalNotes: '' };
      db.quotes.push(q);
    }
    Object.assign(q, { ...fields, title: q.title && q.title.trim() ? q.title : fields.title, notes: q.notes && q.notes.trim() ? q.notes : fields.notes, aiDraft });
    if (!fields.options.length) { delete q.options; delete q.recommended; delete q.chosenOption; }
    computeTotals(q);
    // the photos and notes stay with the quote as an internal note (clients never see notes)
    if (photos.length || notes) {
      const files = saveNoteFiles(photos.map((p, i) => ({ name: `snap-${i + 1}.${p.type === 'image/png' ? 'png' : p.type === 'image/webp' ? 'webp' : 'jpg'}`, dataUrl: `data:${p.type};base64,${p.data}` })));
      q.noteEntries = [{ id: uid(), text: `Snap to quote${notes ? `: ${notes}` : ''}`, at: new Date().toISOString(), by: (u && u.name) || '', files, links: ['jobs'] }, ...(q.noteEntries || [])];
    }
    save(); return { quote: q, questions, usage: status() };
  }

  // a quote with an item still at $0 from Snap to quote can't go to the client
  const unpricedProblem = (q) => { const i = (q.items || []).find((x) => x.needsPrice && !(Number(x.price) > 0)); return i ? `Set a price for “${i.desc}” first` : ''; };
  // the editors don't know about needsPrice: an item saved again at $0 with the same name keeps it; a price clears it
  function carryNeedsPrice(was, doc) {
    const flagged = new Set((was.items || []).filter((i) => i.needsPrice).map((i) => i.desc));
    for (const i of doc.items || []) { if (Number(i.price) > 0) delete i.needsPrice; else if (flagged.has(i.desc)) i.needsPrice = true; }
    if (doc.aiDraft && doc.status !== 'draft') delete doc.aiDraft; // sent or approved: the banner's job is done
  }
  return { draft, status, unpricedProblem, carryNeedsPrice, SCHEMA };
};
