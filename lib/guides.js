// Guides (/guides and /guides/<slug>): articles that help service businesses with pricing, getting paid, finding work and running
// the business, mostly written for one industry. They bring in search traffic and point readers at the free tools and the industry pages.
//
// How a guide is made (no writing by hand):
// 1. The weekly writer (a scheduled Claude routine) reads GET /api/site/guides/writer with the writer key: the style guide below,
//    the industries, and every guide so far (so it doesn't repeat one, and sees the changes asked for).
// 2. It researches a topic and sends the guide to POST /api/site/guides/writer/drafts. It's saved as a draft, never shown publicly.
// 3. The reviewer (Alpha → Help Center → Guides → Review emails go to) gets an email with a link to /guides/review/<token>:
//    the guide as it will look, with Publish and Ask for changes. A change request is answered by the writer's next run (PUT …/drafts/<id>).
// Alpha → Help Center → Guides lists them all, to edit, publish, unpublish, re-send or delete.
//
// Kept in the platform store (platform.json) as guides: { items, reviewer, keyHash, shipped }. Guides that ship with the app (lib/guides-content.js)
// are added once, as drafts, and the reviewer is emailed about them.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const tenancy = require('./tenancy');
const industries = require('./industries');

const P = () => tenancy.platform();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fail = (msg, status = 400) => { throw Object.assign(new Error(msg), { status }); };
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const product = () => P().settings.productName || 'Worklio Pro';
const prod = (s) => String(s ?? '').replace(/\{product\}/g, product());
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,88}[a-z0-9])?$/;
const slugify = (s) => String(s || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90).replace(/-+$/, '');
const DEFAULT_REVIEWER = 'paul@workliopro.com';
// the weekly writer's key (its SHA-256; the key itself is only in the routine). Alpha → Guides → New writer key replaces it.
const SHIPPED_KEY_HASH = 'c530c16d78a05b4530c655be34fcbe6d200911881b05b64a968d4cd2ae7856fd';
const CATEGORIES = [['pricing', 'Pricing & quoting'], ['getting-paid', 'Getting paid'], ['finding-work', 'Finding work'], ['running', 'Running the business']];
const catName = (k) => (CATEGORIES.find(([c]) => c === k) || [, 'Guides'])[1];
const ind = (slug) => industries.INDUSTRIES.find((i) => i.slug === slug) || null;
const lower = (n) => String(n).replace(/\b[A-Z][a-z]/g, (w) => w.toLowerCase()); // "Lawn care & landscaping"; HVAC stays HVAC

// what the writer follows, sent with GET /api/site/guides/writer so it can be improved here without touching the routine
const STYLE = `Who reads these: owners of small service businesses (1 to 15 people) in the trades: HVAC, plumbing, cleaning, lawn care, snow removal and the rest. Busy, practical, often reading on a phone between jobs. Many didn't go to business school. They want a straight answer they can use this week.

What a guide is:
- One question, answered properly. The title is the question or the promise ("How to price snow removal contracts", "What to do when a client won't pay"). Aim the title at what people actually type into Google.
- 1,200 to 2,000 words. Long enough to be the best answer on the page, no padding.
- Real numbers. Price ranges, hours, percentages, a worked example with the math shown step by step (a <div class="example"> box). Say where numbers vary (region, season, job size) and give the reader a way to work out their own.
- Written for one industry when the topic allows (set "industry" to its slug). Use "" only for topics every trade shares, and then use examples from two or three different trades.
- Category: one of pricing, getting-paid, finding-work, running.

Voice:
- Plain words, short sentences, second person ("you"). Like a friend who has run a crew for 15 years explaining it over coffee.
- Specific beats general. "A 40-foot driveway with a walk to the door" beats "a typical property".
- Have an opinion and say why ("Don't price per push for commercial lots. Here's what goes wrong.").
- No filler intros ("In today's competitive landscape…"), no "In conclusion", no "game-changer", "leverage", "seamless", "robust", "elevate", "unlock", "navigate the complexities", "it's important to note". No em dashes: use a comma, a colon or a new sentence. No exclamation marks.
- Don't invent facts, statistics, studies, quotes or customers. If you state a figure from research, it must come from a source you read; list those sources. Ranges you estimate yourself are fine when you say they're typical and show how to adjust them.
- Don't give legal or tax advice beyond general pointers ("check your state's rules", "ask your accountant").

Originality (this matters: copying someone's article can get the page taken down):
- Every sentence is your own. Never copy, and never closely reword, any part of another article, guide, forum post or video. If a sentence you wrote sounds like one you read, rewrite it from scratch.
- Other articles (competitors' guides especially) only tell you what people are asking. Don't follow their outline, section order, headings, lists, tables or examples. Build the guide around your own worked example and your own structure.
- Facts and common figures are fine to use (a typical price range, a rule of thumb), stated in your own words and checked against more than one source.
- Quoting: at most one short sentence from any source, in quotation marks, with a link to it. Most guides need no quotes at all.
- No copied tables, charts, templates or checklists. Make your own from your own numbers.
- Never mention or copy a competitor's product, brand or wording in the guide.

Format (the body is HTML; only these are kept):
- Start with 2 or 3 short paragraphs that answer the question straight away, then the detail. No <h1> (the title is shown above).
- <h2> for sections (4 to 7 of them), <h3> under them if needed, <p>, <ul>/<ol>/<li>, <strong>, <em>, <table> with <thead>/<tbody>/<tr>/<th>/<td> for price tables, <blockquote> for a script the reader can say or send word for word.
- Callouts: <div class="example"> for a worked example with the math, <div class="tip"> for a short tip, <div class="note"> for a warning.
- Links: to the free tools where they help (/tools/pricing-calculator/<industry slug>, /tools/estimate-template/<industry slug>, /tools/invoice-generator/<industry slug>, /tools/google-review-qr-code), to /industries/<industry slug>, and to other published guides at /guides/<slug>. External links only to the sources you used. Write {product} for the product's name.
- Mention {product} at most once or twice, only where it genuinely solves the step being described (sending a quote with Good / Better / Best options, a deposit on approval, recurring jobs, card payments, automatic reminders). Never a sales pitch. The page already ends with a sign-up box.
- End with a short "The short version" section: 3 to 5 bullet points.

Photos (they break up the text, so use them):
- Put 2 to 4 photos through the guide, roughly one every 2 or 3 sections, after a section's first paragraph. Never two in a row, and none in the opening or in "The short version".
- Write each as: <figure><img data-photo="what to search for" alt="what the photo shows"><figcaption>One short caption tied to the text</figcaption></figure>
- data-photo is a short stock photo search (2 to 5 words) for a real scene from the job: "snow plow truck driveway", "house cleaner bathroom", "hvac technician furnace". The site finds and saves the photo. Avoid searches for concepts ("pricing", "success", "money"): stock results for those look fake.
- Usually leave out how a photo sits: the page alternates photos across the column, beside the text and as framed snapshots. To choose, write <figure class="wide">, <figure class="side"> (beside the text, good for a portrait photo) or <figure class="snapshot">.
- Don't set "layout": each guide gets a different page layout from the one before it. You may set "scribble" to the 1 to 3 words of the title to underline with a marker (the most important words, like "Snow Removal"); otherwise the last word before a colon is used.
- The top photo is the industry's photo. For a guide for every trade (industry ""), or when that photo doesn't fit the topic, set "photo" to a search for the top photo.

Picking a topic:
- Search what owners in one trade are asking right now: Google's "People also ask" and autocomplete, Reddit (r/smallbusiness, r/HVAC, r/lawncare, r/sweatystartup, r/EntrepreneurRideAlong, trade subreddits), trade forums, and the questions under competitors' guides (Jobber Academy, Housecall Pro blog). Use those only to find the question and see where existing answers fall short, never as a model to write from (see Originality). Prefer questions with real search demand and weak existing answers.
- Think about the season: what is that trade dealing with in the next 4 to 8 weeks? (Snow contracts in fall, AC tune-ups in spring, gutter cleaning in late fall, slow-season cash flow in winter.)
- Rotate industries: don't write for the same industry twice in a row, and favor industries that have no guide yet. Never repeat or closely overlap a topic already in the list.
- Money topics come first: pricing, quoting, deposits, getting paid, raising prices, slow seasons, getting reviews and repeat clients.`;

// ---------- the store ----------
const store = () => { const s = (P().guides = P().guides || {}); s.items = s.items || []; s.shipped = s.shipped || []; if (!s.reviewer) s.reviewer = DEFAULT_REVIEWER; return s; };
const save = () => tenancy.savePlatform();
const byId = (id) => store().items.find((g) => g.id === id);
const published = () => store().items.filter((g) => g.status === 'published').sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
const reviewer = () => store().reviewer;

// ---------- the body: only simple formatting is kept ----------
const TAGS = new Set(['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'div', 'br', 'hr', 'span', 'small', 'sup', 'figure', 'figcaption', 'img']);
// a photo is either one of ours (/img/… on the site, or /guides/img/… saved by fillPhotos) or a placeholder the writer asks for:
// <img data-photo="what to search for" alt="…">, swapped for a stock photo by fillPhotos
const OWN_IMG = /^\/(img|guides\/img)\/[\w./-]+\.(jpe?g|png|webp)$/;
const CALLOUTS = new Set(['example', 'tip', 'note']);
// how a photo in the text sits: across the column, beside the text, or as a framed snapshot. Left out, the layout picks.
const FIGS = ['wide', 'side', 'snapshot'];
// page layouts, so the guides don't all look alike: each new guide takes the next one after the guide before it
const LAYOUTS = ['classic', 'split', 'banner', 'paper'];
function cleanHtml(html) {
  const src = String(html || '').replace(/<(script|style|iframe|object|embed|svg|form|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  return src.split(/(<[^>]*>)/).map((part) => {
    if (!part.startsWith('<')) return part.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const m = part.match(/^<\s*(\/?)\s*([a-zA-Z0-9]+)([^>]*)>$/); if (!m) return '';
    const close = m[1]; const tag = m[2].toLowerCase(); const attrs = m[3]; if (!TAGS.has(tag)) return '';
    if (close) return tag === 'br' || tag === 'hr' ? '' : `</${tag}>`;
    const attr = (name) => { const a = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')); return a ? (a[2] ?? a[3] ?? a[4] ?? '') : ''; };
    if (tag === 'img') { const alt = clip(attr('alt'), 200); const q = clip(attr('data-photo'), 80); const src = attr('src').trim();
      if (q) return `<img data-photo="${esc(q)}" alt="${esc(alt)}">`; return OWN_IMG.test(src) && !src.includes('..') ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy">` : ''; }
    if (tag === 'a') { const href = attr('href').trim(); if (!/^(\/(?!\/)|https:\/\/|#)/.test(href)) return '<a>';
      const ext = /^https:/.test(href); return `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener nofollow"' : ''}>`; }
    if (tag === 'figure') { const c = attr('class').split(/\s+/).find((x) => FIGS.includes(x)); return `<figure${c ? ` class="${c}"` : ''}>`; }
    if (tag === 'div' || tag === 'p') { const c = attr('class').split(/\s+/).find((x) => CALLOUTS.has(x)); return `<${tag}${c ? ` class="${c}"` : ''}>`; }
    if (tag === 'th' || tag === 'td') { const span = Number(attr('colspan')); return `<${tag}${span > 1 && span < 10 ? ` colspan="${span}"` : ''}>`; }
    return `<${tag}>`;
  }).join('').trim();
}
const words = (html) => String(html).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const readMinutes = (g) => Math.max(2, Math.round(words(g.body) / 230));

// ---------- photos ----------
// Stock photos (lib/stock-photos.js: Pixabay, with the key from Alpha → Settings → Integrations → Stock photos) are saved once in
// <data>/guides-img and served at /guides/img/<file>, since Pixabay's own links expire. Without a key the placeholders wait
// (they aren't shown) and Alpha → Guides → Find photos tries again later.
const IMG_DIR = () => path.join(tenancy.DATA_DIR, 'guides-img');
const imgFile = (name) => (/^[\w.-]+\.(jpe?g|png)$/.test(name) && fs.existsSync(path.join(IMG_DIR(), name)) ? path.join(IMG_DIR(), name) : null);
// finder(query, usedIds) → { id, src, by, link } or null
async function stockFinder(query, used) {
  const stock = require('./stock-photos'); if (!stock.ready()) return null;
  const pick = (await stock.search(query)).find((p) => !used.has(p.id)); if (!pick) return null;
  fs.mkdirSync(IMG_DIR(), { recursive: true });
  const kept = await stock.keep(pick, IMG_DIR());
  return { id: pick.id, src: '/guides/img/' + path.basename(kept.src), by: kept.by, link: kept.link, source: kept.source };
}
const PLACEHOLDER = /<img data-photo="([^"]*)" alt="([^"]*)">/g;
const unesc = (s) => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const needsPhotos = (g) => (g.photo && !g.hero) || /<img data-photo="/.test(g.body);
// swaps the placeholders (and the top photo asked for) for photos. Never throws: what can't be found stays a placeholder.
async function fillPhotos(g, finder = stockFinder) {
  if (!g || !needsPhotos(g)) return g;
  g.credits = g.credits || []; const used = new Set(g.credits.map((c) => c.id));
  const find = async (q) => { try { const p = await finder(unesc(q), used); if (p) { used.add(p.id); g.credits.push({ id: p.id, by: p.by, link: p.link, source: p.source || 'Pixabay' }); } return p; } catch (e) { console.error('Guide photo not found:', q, e.message); return null; } };
  if (g.photo && !g.hero) { const p = await find(g.photo); if (p) g.hero = { src: p.src, alt: g.photo }; }
  let body = g.body;
  for (const m of [...g.body.matchAll(PLACEHOLDER)]) { const p = await find(m[1]); if (p) body = body.replace(m[0], `<img src="${esc(p.src)}" alt="${m[2]}" loading="lazy">`); }
  if (body !== g.body || g.hero) { g.body = body; save(); }
  return g;
}
// the photo at the top: the one asked for, or the industry's own (public/img/industries)
const INDUSTRY_PHOTOS = path.join(__dirname, '..', 'public', 'img', 'industries');
function heroOf(g) {
  if (g.hero) return g.hero;
  if (g.industry && fs.existsSync(path.join(INDUSTRY_PHOTOS, g.industry + '.jpg'))) return { src: `/img/industries/${g.industry}.jpg`, alt: ind(g.industry).name };
  return null;
}
// placeholders still waiting for a photo aren't shown (the whole figure goes, caption and all)
const shownBody = (html) => html.replace(/<figure>(?:(?!<\/figure>)[\s\S])*?<img data-photo=[\s\S]*?<\/figure>/g, '').replace(PLACEHOLDER, '');

// ---------- making and changing guides ----------
function clean(b, was) {
  const g = { title: clip(b.title ?? (was && was.title), 140), summary: clip(b.summary ?? (was && was.summary), 320), keywords: clip(b.keywords ?? (was && was.keywords), 300),
    industry: String(b.industry ?? (was && was.industry) ?? ''), category: String(b.category ?? (was && was.category) ?? ''),
    body: 'body' in b ? cleanHtml(String(b.body).slice(0, 120000)) : was ? was.body : '' };
  g.slug = clip(b.slug, 90).toLowerCase() || (was ? was.slug : slugify(g.title));
  if (!g.title) fail('Give the guide a title');
  if (!SLUG_RE.test(g.slug)) fail('The web address can only use lowercase letters, numbers and dashes');
  if (store().items.some((x) => x.slug === g.slug && (!was || x.id !== was.id))) fail(`Another guide already uses /guides/${g.slug}`);
  if (g.slug === 'review') fail('Pick another web address');
  if (g.industry && !ind(g.industry)) fail('Unknown industry: use one of the industry slugs, or "" for every trade');
  if (!CATEGORIES.some(([c]) => c === g.category)) fail(`Category must be one of: ${CATEGORIES.map(([c]) => c).join(', ')}`);
  if (!g.summary) fail('Add a one or two sentence summary');
  if (words(g.body) < 150) fail('The guide is too short');
  g.layout = LAYOUTS.includes(b.layout) ? b.layout : (was && was.layout) || '';
  g.scribble = clip(b.scribble ?? (was && was.scribble), 60); // the words in the title to underline; left out, the last word before a colon
  g.photo = clip(b.photo ?? (was && was.photo), 80); // what the top photo should show, when the industry's photo doesn't fit
  if (was && g.photo !== was.photo) g.hero = null; // asked for another top photo: found again by fillPhotos
  const src = 'sources' in b ? b.sources : was ? was.sources : [];
  g.sources = (Array.isArray(src) ? src : []).slice(0, 15).map((s) => ({ title: clip(s && s.title, 200), url: clip(s && s.url, 500) })).filter((s) => /^https:\/\/\S+$/.test(s.url));
  return g;
}
const now = () => new Date().toISOString();
function create(b, by) {
  const c = clean(b); if (!c.layout) { const last = (store().items[0] || {}).layout; c.layout = LAYOUTS[(LAYOUTS.indexOf(last) + 1) % LAYOUTS.length]; }
  const g = { id: crypto.randomBytes(6).toString('hex'), ...c, status: 'draft', by: by || 'writer', createdAt: now(), updatedAt: now(), token: crypto.randomBytes(18).toString('base64url'), notes: [], revision: 1 };
  store().items.unshift(g); save(); return g;
}
// the writer's revision after "Ask for changes": open notes are marked as answered
function revise(id, b) {
  const g = byId(id); if (!g) fail('Guide not found', 404);
  if (g.status === 'published') fail('That guide is already live. Unpublish it in Alpha first.');
  Object.assign(g, clean(b, g), { status: 'draft', updatedAt: now(), revision: (g.revision || 1) + 1 });
  for (const n of g.notes) if (!n.done) n.done = now();
  save(); return g;
}
// Alpha's edit: any field, any status
function edit(id, b) { const g = byId(id); if (!g) fail('Guide not found', 404); Object.assign(g, clean(b, g), { updatedAt: now() }); save(); return g; }
function publish(id) { const g = byId(id); if (!g) fail('Guide not found', 404); g.status = 'published'; g.publishedAt = g.publishedAt || now(); g.updatedAt = now(); for (const n of g.notes) if (!n.done) n.done = now(); save(); return g; }
function unpublish(id) { const g = byId(id); if (!g) fail('Guide not found', 404); g.status = 'draft'; save(); return g; }
function askChanges(id, note) {
  const g = byId(id); if (!g) fail('Guide not found', 404); const text = clip(note, 2000); if (!text) fail('Say what should change');
  if (g.status === 'published') fail('That guide is already live');
  g.notes.push({ at: now(), text }); g.status = 'changes'; save(); return g;
}
function remove(id) { const s = store(); const i = s.items.findIndex((g) => g.id === id); if (i < 0) fail('Guide not found', 404); s.items.splice(i, 1); save(); }
const byToken = (t) => (t && store().items.find((g) => g.token === t)) || null;

// ---------- the writer's key ----------
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
function writerOk(req) {
  const m = String(req.headers.authorization || '').match(/^Bearer\s+(\S+)$/i); if (!m) return false;
  const want = Buffer.from(store().keyHash || SHIPPED_KEY_HASH, 'hex'); const got = Buffer.from(sha(m[1]), 'hex');
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
function newKey() { const k = 'wg_' + crypto.randomBytes(24).toString('base64url'); store().keyHash = sha(k); save(); return k; }
// no more than 3 new drafts a day from the writer, in case a run loops
const writerRoom = () => store().items.filter((g) => g.by === 'writer' && Date.now() - Date.parse(g.createdAt) < 864e5).length < 3;
const writerView = () => ({
  styleGuide: STYLE, categories: CATEGORIES.map(([slug, name]) => ({ slug, name })), industries: industries.INDUSTRIES.map((i) => ({ slug: i.slug, name: i.name })),
  guides: store().items.map((g) => ({ id: g.id, slug: g.slug, title: g.title, summary: g.summary, industry: g.industry, category: g.category, status: g.status, createdAt: g.createdAt, publishedAt: g.publishedAt || null, url: g.status === 'published' ? `/guides/${g.slug}` : null })),
  changesAsked: store().items.filter((g) => g.status === 'changes').map((g) => ({ id: g.id, slug: g.slug, title: g.title, summary: g.summary, industry: g.industry, category: g.category, keywords: g.keywords, photo: g.photo || '', scribble: g.scribble || '', layout: g.layout || '', sources: g.sources, body: g.body, notes: g.notes.filter((n) => !n.done).map((n) => n.text) })),
});

// ---------- Alpha → Help Center → Guides ----------
const adminView = () => ({ reviewer: reviewer(), customKey: !!store().keyHash, categories: CATEGORIES, layouts: LAYOUTS, items: store().items.map((g) => ({ ...g, words: words(g.body), minutes: readMinutes(g) })) });
function saveSettings(b) { const e = String(b.reviewer || '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail('Enter a valid email address'); store().reviewer = e; save(); }

// the guides that ship with the app: added once each, as drafts. Returns the new ones (the caller emails the reviewer).
function seed() {
  const s = store(); const fresh = [];
  for (const x of require('./guides-content').GUIDES) {
    if (s.shipped.includes(x.key)) continue;
    s.shipped.push(x.key);
    if (s.items.some((g) => g.slug === x.slug)) continue;
    try { const { key, ...b } = x; fresh.push(create(b, 'shipped')); } catch (e) { console.error('Guide not added:', x.slug, e.message); }
  }
  if (!fresh.length) save();
  return fresh;
}
// what the review email says about a guide
const about = (g) => `${g.industry ? `For ${lower(ind(g.industry).name)} businesses` : 'For every trade'} · ${catName(g.category)} · ${words(g.body).toLocaleString('en-US')} words, ${readMinutes(g)} min read`;

// ---------- the public pages ----------
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
const forLine = (g) => (g.industry ? lower(ind(g.industry).name) : 'every trade');
const cardHtml = (g) => { const h = heroOf(g); return `<a class="g-card" href="/guides/${g.slug}" data-ind="${esc(g.industry || 'all')}" data-cat="${esc(g.category)}">${h ? `<img class="g-thumb" src="${esc(h.src)}" alt="" loading="lazy" width="600" height="400">` : ''}<span class="g-cat">${esc(catName(g.category))}</span><b>${esc(prod(g.title))}</b><span>${esc(prod(g.summary))}</span><small><b>${readMinutes(g)} min read</b> · For ${esc(forLine(g))}</small></a>`; };
const toolTiles = (i) => require('./tool-card').card({ tag: 'free, no sign-up', title: i ? `Free tools for ${esc(lower(i.name))}` : 'Free tools for your business', more: '<a href="/tools">See all free tools →</a>',
  tiles: [[`/tools/pricing-calculator${i ? '/' + i.slug : ''}`, 'calc', 'Pricing calculator', 'Know what to charge before you quote.'],
    [`/tools/invoice-generator${i ? '/' + i.slug : ''}`, 'invoice', i ? 'Invoice template' : 'Invoice generator', 'A clean PDF invoice in a couple of minutes.'],
    [`/tools/estimate-template${i ? '/' + i.slug : ''}`, 'estimate', 'Estimate template', 'Line items, a deposit and a signature line.'],
    ['/tools/google-review-qr-code', 'qr', 'Review QR code', 'A counter sign that gets you Google reviews.']] });
function related(g, n = 3) {
  const score = (x) => (g.industry && x.industry === g.industry ? 4 : 0) + (x.category === g.category ? 2 : 0) + (!x.industry ? 1 : 0);
  return published().filter((x) => x.id !== g.id).map((x, i) => [x, score(x), i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).slice(0, n).map(([x]) => x);
}
// ---------- one guide's page ----------
// Four layouts (LAYOUTS), so a reader going from guide to guide doesn't see the same template twice:
//   classic: title, then the top photo taped below it      split: title beside the photo, and an "In this guide" list
//   banner: a wide photo with the title on a card pinned over its bottom edge     paper: the title on a paper note with the photo taped to its corner
// Hand-made touches everywhere: a marker scribble under part of the title, tips as sticky notes, "The short version" on a lined index card,
// photos that alternate between across the column, beside the text and framed snapshots, and a handwritten sign-off.
const layoutOf = (g) => (LAYOUTS.includes(g.layout) ? g.layout : LAYOUTS[parseInt(sha(g.id).slice(0, 6), 16) % LAYOUTS.length]);
const FIG_ORDER = { classic: ['wide', 'side', 'snapshot'], split: ['side', 'snapshot', 'wide'], banner: ['snapshot', 'wide', 'side'], paper: ['snapshot', 'side', 'wide'] };
const headId = (t) => slugify(t.replace(/<[^>]+>/g, '')).slice(0, 60) || 'section';
// the title with a marker scribble under the words asked for, or the last word before a colon or bracket
function titleHtml(g) {
  const t = prod(g.title); const want = g.scribble && t.includes(g.scribble) ? g.scribble : (t.split(/[:(]/)[0].trim().match(/(\S+)$/) || [])[1];
  if (!want) return esc(t);
  const at = t.lastIndexOf(want, g.scribble ? undefined : t.split(/[:(]/)[0].length);
  return at < 0 ? esc(t) : `${esc(t.slice(0, at))}<span class="scribble">${esc(want)}</span>${esc(t.slice(at + want.length))}`;
}
function bodyHtml(g, layout) {
  const seen = new Set(); const toc = [];
  let html = prod(shownBody(g.body)).replace(/<h2>([\s\S]*?)<\/h2>/g, (m, inner) => {
    let id = headId(inner); while (seen.has(id)) id += '-2'; seen.add(id);
    if (!/^the short version$/i.test(inner.replace(/<[^>]+>/g, '').trim())) toc.push([id, inner.replace(/<[^>]+>/g, '')]);
    return `<h2 id="${id}">${inner}</h2>`;
  });
  let n = 0; const order = FIG_ORDER[layout];
  html = html.replace(/<figure( class="(\w+)")?>/g, (m, c, cls) => `<figure class="${cls || order[n++ % order.length]}">`);
  // "The short version" and its list: a lined index card
  html = html.replace(/(<h2 id="[^"]+">\s*The short version\s*<\/h2>)\s*(<(ul|ol)>[\s\S]*?<\/\3>)/i, '<div class="g-index">$1$2</div>');
  return { html, toc };
}
const tocHtml = (toc, cls) => (toc.length > 2 ? `<nav class="g-toc ${cls}" aria-label="In this guide"><b>In this guide</b><ol>${toc.map(([id, t]) => `<li><a href="#${id}">${esc(t)}</a></li>`).join('')}</ol></nav>` : '');
function articleHtml(g) {
  const i = g.industry ? ind(g.industry) : null; const layout = layoutOf(g);
  const rel = related(g); const hero = heroOf(g); const { html, toc } = bodyHtml(g, layout);
  // credits for the photos still in the guide (one removed in an edit drops its credit)
  const credits = (g.credits || []).filter((c) => g.body.includes(`/guides/img/stock-${c.id}.`) || (g.hero && g.hero.src.includes(`stock-${c.id}.`)));
  const img = (cls, w = 1200, h = 800) => (hero ? `<figure class="${cls}"><img src="${esc(hero.src)}" alt="${esc(hero.alt)}" width="${w}" height="${h}" fetchpriority="high"></figure>` : '');
  const crumbs = `<nav class="i-crumbs" aria-label="Breadcrumb"><a href="/guides">Guides</a><span aria-hidden="true">/</span>${i ? `<a href="/industries/${i.slug}">${esc(i.name)}</a>` : `<span>${esc(catName(g.category))}</span>`}</nav>`;
  const when = g.publishedAt ? ` · ${g.updatedAt && g.updatedAt.slice(0, 10) > g.publishedAt.slice(0, 10) ? 'Updated' : 'Published'} ${fmtDate(g.updatedAt && g.updatedAt > g.publishedAt ? g.updatedAt : g.publishedAt)}` : '';
  const titleBits = `${crumbs}
        <span class="h-eyebrow">${esc(catName(g.category))}</span>
        <h1>${titleHtml(g)}</h1>
        <p class="lead">${esc(prod(g.summary))}</p>
        <p class="g-meta"><span class="g-time"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${readMinutes(g)} min read</span> · For ${esc(forLine(g))}${when}</p>`;
  const top = {
    classic: `<header class="g-head h-wrap">${titleBits}</header>${img('g-hero h-wrap')}`,
    split: hero ? `<header class="g-head g-split h-wrap"><div>${titleBits}</div>${img('g-hero-side', 900, 1000)}</header>` : `<header class="g-head h-wrap">${titleBits}</header>`,
    banner: hero ? `${img('g-banner h-wrap', 1600, 700)}<header class="g-head g-over h-wrap"><div class="g-over-card">${titleBits}</div></header>` : `<header class="g-head h-wrap">${titleBits}</header>`,
    paper: `<header class="g-head g-paper h-wrap"><div class="g-paper-card${hero ? ' has-pic' : ''}">${hero ? img('g-pin', 600, 600) : ''}${titleBits}${tocHtml(toc, 'in-card')}</div></header>`,
  }[layout];
  return `
    <article class="g-art g-l-${layout}">
      ${top}
      <div class="g-body h-wrap">${layout === 'split' ? tocHtml(toc, 'scrawl') : ''}${html}
        <p class="g-sign">Written by the ${esc(product())} crew. Something we missed? Ask us in the chat, a real person answers.</p>
        ${(g.sources && g.sources.length) || credits.length ? `<details class="g-sources"><summary>Sources${credits.length ? ' and photos' : ''}</summary><ul>${(g.sources || []).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.title || s.url)}</a></li>`).join('')}${credits.map((c) => `<li>Photo${c.by ? ` by ${esc(c.by)}` : ''} on ${c.link ? `<a href="${esc(c.link)}" target="_blank" rel="noopener nofollow">${esc(c.source)}</a>` : esc(c.source)}</li>`).join('')}</ul></details>` : ''}
      </div>
    </article>
    ${toolTiles(i)}
    <div style="height:56px"></div>
    ${rel.length ? `<section class="h-sec" style="padding-top:0"><div class="h-wrap"><div class="h-sec-head"><span class="h-kicker">Keep reading</span><h2>More guides</h2></div><div class="g-cards">${rel.map(cardHtml).join('')}</div><p class="i-more"><a href="/guides">See all guides →</a></p></div></section>` : ''}`;
}
const css = '<link rel="stylesheet" href="/guides.css?v=3">';
function indexPage() {
  const list = published(); const seo = require('./seo');
  const inds = [...new Set(list.map((g) => g.industry).filter(Boolean))].map(ind).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  return industries.shell({ head: seo.guidesHead() + css, body: `
    <section class="h-hero"><div class="h-wrap i-hero-solo">
      <span class="h-eyebrow">Guides</span>
      <h1>Straight answers for running a service business</h1>
      <p class="lead">What to charge, how to get paid on time, how to find more good clients. Practical guides for the trades, with real numbers and examples you can use this week.</p>
    </div></section>
    <section class="h-sec" style="padding-top:24px"><div class="h-wrap">
      ${list.length > 5 && inds.length ? `<label class="ft-pick-row"><span>Show guides for</span><select id="g-industry"><option value="">Every industry</option>${inds.map((i) => `<option value="${i.slug}">${esc(i.name)}</option>`).join('')}</select></label>` : ''}
      ${list.length ? `<div class="g-cards">${list.map(cardHtml).join('')}</div><p class="g-none" id="g-none" hidden>No guides for that industry yet. The ones for every trade are below it.</p>` : '<p class="g-none">The first guides are on their way. Check back soon.</p>'}
    </div></section>
    <script>
      // "Show guides for": that industry's guides plus the ones for every trade
      (function () {
        var pick = document.getElementById('g-industry'); if (!pick) return;
        function show() { var s = pick.value, n = 0; document.querySelectorAll('.g-cards .g-card').forEach(function (c) { var hit = !s || c.getAttribute('data-ind') === s || c.getAttribute('data-ind') === 'all'; c.hidden = !hit; if (hit && c.getAttribute('data-ind') === s) n++; }); document.getElementById('g-none').hidden = !s || n > 0; try { localStorage.setItem('g-industry', s); } catch (e) {} }
        try { var saved = localStorage.getItem('g-industry'); if (saved && pick.querySelector('option[value="' + saved + '"]')) pick.value = saved; } catch (e) {}
        pick.addEventListener('change', show); show();
      })();
    </script>` });
}
function page(slug) {
  const g = published().find((x) => x.slug === slug); if (!g) return null;
  return industries.shell({ head: require('./seo').guideHead(g, prod, { image: (heroOf(g) || {}).src }) + css, body: articleHtml(g) });
}
// the reviewer's page: the guide as it will look, with Publish and Ask for changes on top. Not in search results.
function reviewPage(token) {
  const g = byToken(token); if (!g) return null;
  const open = g.notes.filter((n) => !n.done);
  const bar = g.status === 'published'
    ? `<div class="g-review is-live"><div><b>This guide is live.</b> <a href="/guides/${g.slug}">See it on the site →</a></div></div>`
    : `<div class="g-review" id="g-review"><div class="g-review-top"><div><b>${g.status === 'changes' ? 'Waiting for changes' : g.revision > 1 ? `Revised draft (version ${g.revision})` : 'Draft'}: not live yet.</b><span>${esc(about(g))}</span></div>
        <div class="g-review-btns"><button type="button" class="btn" data-go="publish">Publish this guide</button><button type="button" class="btn alt" data-go="changes">Ask for changes</button></div></div>
        ${open.length ? `<div class="g-review-notes"><b>You asked for:</b>${open.map((n) => `<p>${esc(n.text)}</p>`).join('')}<small>The writer picks this up on its next run (Mondays and Thursdays) and emails you the new version.</small></div>` : ''}
        <form class="g-review-form" hidden><label for="g-note">What should change? Say it in your own words.</label><textarea id="g-note" rows="4" maxlength="2000" placeholder="For example: too long, cut the history part. Use Midwest prices. Add what to do if a client cancels mid-season." required></textarea><div class="g-review-btns"><button class="btn">Send to the writer</button><button type="button" class="btn alt" data-go="cancel">Cancel</button></div></form>
        <p class="g-review-msg" role="status"></p></div>
      <script>
        (function () {
          var box = document.getElementById('g-review'), form = box.querySelector('form'), msg = box.querySelector('.g-review-msg');
          function send(body) { msg.textContent = 'Saving…'; return fetch('/api/site/guides/review/${esc(token)}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong'); return j; }); }).catch(function (e) { msg.textContent = e.message; throw e; }); }
          box.addEventListener('click', function (e) {
            var b = e.target.closest('[data-go]'); if (!b) return; var go = b.getAttribute('data-go');
            if (go === 'changes') { form.hidden = false; form.querySelector('textarea').focus(); }
            if (go === 'cancel') form.hidden = true;
            if (go === 'publish') { b.disabled = true; send({ action: 'publish' }).then(function (j) { box.className = 'g-review is-live'; box.innerHTML = '<div><b>Published.</b> It’s live now and in the sitemap for Google. <a href="' + j.url + '">See it on the site →</a></div>'; }, function () { b.disabled = false; }); }
          });
          form.addEventListener('submit', function (e) { e.preventDefault(); send({ action: 'changes', note: form.querySelector('textarea').value }).then(function () { form.hidden = true; box.querySelector('.g-review-btns').hidden = true; msg.textContent = 'Sent. The writer will revise it on its next run and email you the new version.'; }); });
        })();
      </script>`;
  return industries.shell({ head: require('./seo').guideHead(g, prod, { noindex: true, image: (heroOf(g) || {}).src }) + css, body: bar + articleHtml(g) });
}
function reviewAction(token, b) {
  const g = byToken(token); if (!g) fail('This review link is no longer valid', 404);
  if (b.action === 'publish') { publish(g.id); return { ok: true, url: `/guides/${g.slug}`, id: g.id }; }
  if (b.action === 'changes') { askChanges(g.id, b.note); return { ok: true }; }
  fail('Unknown action');
}
// on an industry page: its guides, then ones for every trade, up to three
function industrySection(i) {
  const list = published(); const mine = [...list.filter((g) => g.industry === i.slug), ...list.filter((g) => !g.industry)].slice(0, 3);
  if (!mine.length) return '';
  return `<section class="h-sec" style="padding-top:0"><div class="h-wrap"><div class="h-sec-head"><span class="h-kicker">Guides</span><h2>Guides for ${esc(lower(i.name))} businesses</h2></div><div class="g-cards">${mine.map(cardHtml).join('')}</div><p class="i-more"><a href="/guides">See all guides →</a></p></div></section>`;
}
const sitemapPaths = () => ['/guides', ...published().map((g) => `/guides/${g.slug}`)];

module.exports = { STYLE, CATEGORIES, catName, store, reviewer, create, revise, edit, publish, unpublish, askChanges, remove, byId, writerOk, newKey, writerRoom, writerView,
  adminView, saveSettings, seed, fillPhotos, needsPhotos, imgFile, heroOf, about, indexPage, page, reviewPage, reviewAction, industrySection, sitemapPaths, cleanHtml, prod };
