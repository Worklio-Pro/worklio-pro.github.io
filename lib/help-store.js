// Help center content and feedback, kept in the platform store (platform.json):
//   help: { topics, articles, popular, suggested }   edited in the platform console → Help Center
//   helpFeedback: { [article slug]: { yes, no } }    "Was this article helpful?" votes
//   helpComments: [{ id, at, slug, text }]          what people said they were looking for after voting No
const crypto = require('crypto');
const tenancy = require('./tenancy');
const seed = require('./help-content');

const P = () => tenancy.platform();
const ICONS = ['rocket', 'calendar', 'briefcase', 'users', 'mail', 'megaphone', 'card', 'chart', 'team', 'gear', 'user', 'help'];
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const slugify = (s) => String(s || '').toLowerCase().replace(/\{product\}/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

// first use: start from the content that shipped with the app
// articles added to the app after a help center was set up: added to it once (deleting one afterwards sticks)
const ADDED_LATER = ['payout-schedule', 'set-up-payments', 'using-on-phone', 'quote-invoice-page', 'client-profile', 'client-properties', 'send-email-text',
  'account-connections', 'google-reviews', 'online-booking', 'social-posts', 'app-marketplace', 'time-off', 'refer-earn', 'forum-feedback',
  'quickbooks-xero', 'recurring-jobs', 'dispatch-map', 'service-plans', 'on-my-way', 'time-tracking', 'job-checklists', 'quote-options', 'job-posts', 'snap-to-quote', 'calendar-feed', 'batch-invoicing', 'late-fees', 'service-categories', 'invoice-tips'];
// help center updates that shipped with the app: once each, add the topics a help center doesn't have yet, and bring these
// topics' descriptions and these articles up to date with the shipped content (this replaces console edits to them)
const REFRESHED = [
  { id: '2026-10-29', topics: ['clients', 'client-communications', 'team', 'getting-help'],
    articles: ['first-steps', 'finding-your-way', 'appointment-reminders', 'create-send-quote', 'quote-deposits', 'quote-to-job', 'create-job', 'job-signatures', 'create-send-invoice',
      'record-payment', 'products-services', 'add-clients', 'import-clients', 'merge-clients', 'client-portal', 'email-templates', 'text-messages', 'payout-schedule', 'invite-team', 'access-levels'] },
  // financial reports & QuickBooks/Xero, On My Way, products import, time tracking, recurring jobs, service plans, dispatch map
  { id: '2026-11-06', topics: ['schedule', 'clients', 'business-health', 'team'],
    articles: ['finding-your-way', 'job-calendar', 'create-job', 'quote-invoice-page', 'products-services', 'client-profile', 'financial-reports', 'access-levels'] },
  // extra logins on Advanced, price locks, texts a month
  { id: '2026-11-07', topics: [], articles: ['invite-team', 'plans-billing', 'text-messages'] },
  // checklists & forms: the Work topic mentions them
  { id: '2026-11-08', topics: ['work'], articles: [] },
  // checklists: added for certain products or services, and PDFs
  { id: '2026-11-08b', topics: [], articles: ['job-checklists'] },
  { id: '2026-11-07b', topics: [], articles: ['plans-billing'] }, // sale prices are kept for good
  // texts a month: what counts, the heads-up at 80%, what happens at the limit
  { id: '2026-11-08d', topics: [], articles: ['text-messages', 'plans-billing'] },
  // accounts that need reconnecting: the Reconnect button, the owner's email, LinkedIn's yearly sign-in
  { id: '2026-11-08e', topics: [], articles: ['account-connections'] },
  // Marketing's Reconnect; phones: pull to refresh and PDFs in the app (08e may already have run on live)
  { id: '2026-11-08f', topics: [], articles: ['social-posts', 'using-on-phone'] },
  // Calendar month view
  { id: '2026-11-08g', topics: [], articles: ['job-calendar'] },
  // quote options: the how-to video
  { id: '2026-11-08h', topics: [], articles: ['quote-options'] },
  // batch invoicing and late fees: the invoice article points to them
  { id: '2026-11-08i', topics: [], articles: ['create-send-invoice'] },
  { id: '2026-11-08j', topics: [], articles: ['first-steps', 'job-calendar', 'set-up-payments', 'payout-schedule', 'company-profile', 'custom-domain'] },
  // products & services categories: the catalog, expenses and reports articles point to the new one
  { id: '2026-11-08k', topics: [], articles: ['products-services', 'expenses', 'financial-reports'] },
  // the booking widget: Settings → Online Booking
  { id: '2026-11-08l', topics: [], articles: ['online-booking'] },
  // tips on invoices paid online: Payments → Payment settings → Let clients add a tip
  { id: '2026-11-08m', topics: [], articles: ['stripe-card-payments'] },
  // Products & services: checkboxes with Edit (category, type) and Delete for several items, and Categories → Rename
  { id: '2026-11-08n', topics: [], articles: ['products-services', 'service-categories'] },
  // a line item not in Products & services: offered for the catalog after saving
  { id: '2026-11-08o', topics: [], articles: ['products-services'] },
  // saved discounts (App Settings → General), and Approve and pay deposit on the client's quote
  { id: '2026-11-08p', topics: [], articles: ['create-send-quote'] },
  { id: '2026-11-08q', topics: [], articles: ['create-send-quote'] },
  { id: '2026-11-08r', topics: [], articles: ['create-send-quote'] },
  { id: '2026-11-08s', topics: [], articles: ['create-send-quote'] },
  { id: '2026-11-08t', topics: [], articles: ['create-send-quote'] },
  { id: '2026-11-08u', topics: [], articles: ['create-send-quote'] }, // matrix pricing is a paid add-on
  { id: '2026-11-09a', topics: [], articles: ['financial-reports', 'finding-your-way', 'service-categories', 'time-tracking'] }, // Reports: every report in groups
  { id: '2026-11-09b', topics: [], articles: ['financial-reports'] }, // Reports page: tiles, group buttons, stars
  // App Settings in three tabs; line item ⋯ shortcuts; Snap to quote's Needs a price tag and details page; phones: Clock In and
  // On My Way in the job's ⋯, Roles one at a time, Notifications Log as a list; Preview as Client's Back bar
  { id: '2026-11-09c', topics: [], articles: ['app-settings', 'create-send-quote', 'quote-invoice-page', 'snap-to-quote', 'using-on-phone', 'on-my-way', 'time-tracking', 'access-levels', 'notifications-log'] },
  // Venmo, Cash App and PayPal next to Zelle
  { id: '2026-11-09d', topics: ['payments'], articles: ['zelle'] },
  { id: '2026-11-09e', topics: [], articles: ['zelle'] }, // the pay apps are buttons that open a pop-up
  // Tax Summary left the sidebar: it's opened from Reports → Taxation
  { id: '2026-11-10', topics: [], articles: ['finding-your-way', 'tax-summary'] },
  // expenses: click a row to edit it (no Edit button)
  { id: '2026-11-10b', topics: [], articles: ['expenses'] },
  // review questions can be dragged into a new order
  { id: '2026-11-11', topics: [], articles: ['client-reviews'] },
];
const copy = (x) => JSON.parse(JSON.stringify(x));
function refresh(p, r) {
  seed.topics.forEach((t, i) => {
    const have = p.help.topics.find((x) => x.slug === t.slug);
    if (!have) p.help.topics.splice(Math.min(i, p.help.topics.length), 0, copy(t)); else if (r.topics.includes(t.slug)) have.desc = t.desc;
  });
  for (const a of p.help.articles) {
    const fresh = r.articles.includes(a.slug) && seed.articles.find((x) => x.slug === a.slug);
    if (fresh) Object.assign(a, { title: fresh.title, summary: fresh.summary, keywords: fresh.keywords, body: fresh.body });
  }
}
function content() {
  const p = P();
  if (!p.help) { p.help = copy({ topics: seed.topics, articles: seed.articles, popular: seed.popular, suggested: seed.suggested }); p.helpAdded = [...ADDED_LATER]; p.helpRefreshed = REFRESHED.map((r) => r.id); tenancy.savePlatform(); }
  p.helpRefreshed = p.helpRefreshed || [];
  const due = REFRESHED.filter((r) => !p.helpRefreshed.includes(r.id));
  if (due.length) { due.forEach((r) => { refresh(p, r); p.helpRefreshed.push(r.id); }); tenancy.savePlatform(); }
  p.helpAdded = p.helpAdded || [];
  const add = ADDED_LATER.filter((slug) => !p.helpAdded.includes(slug));
  if (add.length) {
    for (const slug of add) {
      const a = seed.articles.find((x) => x.slug === slug); p.helpAdded.push(slug);
      if (!a || p.help.articles.some((x) => x.slug === slug)) continue;
      const i = p.help.articles.map((x) => x.topic).lastIndexOf(a.topic); // after the last article in its topic
      p.help.articles.splice(i < 0 ? p.help.articles.length : i + 1, 0, JSON.parse(JSON.stringify(a)));
    }
    tenancy.savePlatform();
  }
  if (!p.helpCalendar) { // Job Calendar and Schedules became one page, Calendar: once, bring the help center along
    p.helpCalendar = true; const fresh = seed.articles.find((x) => x.slug === 'job-calendar');
    p.help.articles = p.help.articles.filter((x) => x.slug !== 'staff-schedules');
    for (const a of p.help.articles) {
      if (a.slug === 'job-calendar') Object.assign(a, { title: fresh.title, summary: fresh.summary, keywords: fresh.keywords, body: fresh.body });
      else a.body = String(a.body || '').replace(/Home, Job Calendar, (Staff )?Schedules, Clients/, 'Home, Calendar, Requests, Clients').split('<strong>Job Calendar</strong>').join('<strong>Calendar</strong>')
        .replace('or click a day on the <a href="/articles/job-calendar">Job Calendar</a>', 'or click a time on the <a href="/articles/job-calendar">Calendar</a>').replace(/, shown on (Staff )?Schedules\./, '.');
    }
    for (const t of p.help.topics || []) if (t.slug === 'schedule') t.desc = String(t.desc || '').replace('on the job calendar', 'on the calendar');
    for (const k of ['popular', 'suggested']) if (Array.isArray(p.help[k])) p.help[k] = p.help[k].filter((s) => s !== 'staff-schedules');
    tenancy.savePlatform();
  }
  return p.help;
}
const feedback = () => (P().helpFeedback = P().helpFeedback || {});
const comments = () => (P().helpComments = P().helpComments || []);
const save = () => tenancy.savePlatform();
const fail = (msg) => { const e = new Error(msg); e.status = 400; throw e; };

/* ===== articles ===== */
function cleanArticle(b, slugTaken) {
  const H = content(); const a = { slug: clip(b.slug, 80).toLowerCase() || slugify(b.title), topic: clip(b.topic, 60), title: clip(b.title, 150), summary: clip(b.summary, 300), keywords: clip(b.keywords, 300), body: String(b.body ?? '').slice(0, 60000) };
  if (!a.title) fail('Give the article a title');
  if (!SLUG_RE.test(a.slug)) fail('The web address can only use lowercase letters, numbers and dashes');
  if (slugTaken(a.slug)) fail(`Another article already uses the address /articles/${a.slug}`);
  if (!H.topics.some((t) => t.slug === a.topic)) fail('Choose a topic');
  if (!a.summary) fail('Add a one-line summary');
  if (!a.body.trim()) fail('Write the article');
  return a;
}
function createArticle(b) {
  const H = content(); const a = cleanArticle(b, (s) => H.articles.some((x) => x.slug === s));
  // new articles go to the end of their topic
  const lastInTopic = H.articles.map((x) => x.topic).lastIndexOf(a.topic);
  H.articles.splice(lastInTopic < 0 ? H.articles.length : lastInTopic + 1, 0, a); save(); return a;
}
function updateArticle(slug, b) {
  const H = content(); const i = H.articles.findIndex((x) => x.slug === slug); if (i < 0) fail('Article not found');
  const a = cleanArticle({ ...H.articles[i], ...b }, (s) => s !== slug && H.articles.some((x) => x.slug === s));
  if (a.slug !== slug) { // renamed: carry its votes, comments and popular spot to the new address
    const F = feedback(); if (F[slug]) { F[a.slug] = F[slug]; delete F[slug]; }
    comments().forEach((c) => { if (c.slug === slug) c.slug = a.slug; });
    H.popular = H.popular.map((s) => (s === slug ? a.slug : s));
  }
  H.articles[i] = a; save(); return a;
}
function deleteArticle(slug) {
  const H = content(); if (!H.articles.some((x) => x.slug === slug)) fail('Article not found');
  H.articles = H.articles.filter((x) => x.slug !== slug); H.popular = H.popular.filter((s) => s !== slug); save();
}
// up/down within its topic (topic pages list articles in this order)
function moveArticle(slug, dir) {
  const H = content(); const i = H.articles.findIndex((x) => x.slug === slug); if (i < 0) fail('Article not found');
  const step = dir === 'up' ? -1 : 1; let j = i + step;
  while (j >= 0 && j < H.articles.length && H.articles[j].topic !== H.articles[i].topic) j += step;
  if (j < 0 || j >= H.articles.length) return;
  [H.articles[i], H.articles[j]] = [H.articles[j], H.articles[i]]; save();
}

/* ===== topics + home page ===== */
function saveTopics(list) {
  const H = content(); if (!Array.isArray(list) || !list.length) fail('Keep at least one topic');
  const seen = new Set();
  const topics = list.map((t) => {
    const x = { slug: clip(t.slug, 60).toLowerCase() || slugify(t.title), title: clip(t.title, 80), desc: clip(t.desc, 300), icon: ICONS.includes(t.icon) ? t.icon : 'help' };
    if (!x.title) fail('Every topic needs a name');
    if (!SLUG_RE.test(x.slug)) fail(`“${x.title}”: the web address can only use lowercase letters, numbers and dashes`);
    if (seen.has(x.slug)) fail(`Two topics use the address /topics/${x.slug}`); seen.add(x.slug);
    return x;
  });
  const orphan = H.articles.find((a) => !seen.has(a.topic) && !list.some((t) => t.was === a.topic));
  if (orphan) fail(`“${orphan.title}” is still in a topic you removed. Move or delete its articles first.`);
  // a renamed topic address (was → slug) moves its articles with it
  list.forEach((t, i) => { if (t.was && t.was !== topics[i].slug) H.articles.forEach((a) => { if (a.topic === t.was) a.topic = topics[i].slug; }); });
  H.topics = topics; save(); return H.topics;
}
function saveHome(b) {
  const H = content();
  const popular = (Array.isArray(b.popular) ? b.popular : []).filter((s, i, arr) => s && arr.indexOf(s) === i).slice(0, 3);
  if (popular.some((s) => !H.articles.some((a) => a.slug === s))) fail('Choose popular articles from the list');
  H.popular = popular; H.suggested = (Array.isArray(b.suggested) ? b.suggested : []).map((s) => clip(s, 100)).filter(Boolean).slice(0, 5); save();
}

/* ===== feedback ===== */
function vote(slug, yes) {
  if (!content().articles.some((a) => a.slug === slug)) fail('Article not found');
  const F = feedback(); const f = F[slug] || (F[slug] = { yes: 0, no: 0 });
  f[yes ? 'yes' : 'no'] += 1; save();
}
function comment(slug, text) {
  const t = clip(text, 1000); if (!t) return; if (!content().articles.some((a) => a.slug === slug)) fail('Article not found');
  comments().unshift({ id: crypto.randomBytes(6).toString('hex'), at: new Date().toISOString(), slug, text: t }); P().helpComments.length = Math.min(P().helpComments.length, 500); save();
}
const resetFeedback = (slug) => { delete feedback()[slug]; P().helpComments = comments().filter((c) => c.slug !== slug); save(); };
const deleteComment = (id) => { P().helpComments = comments().filter((c) => c.id !== id); save(); };

module.exports = { ICONS, content, feedback, comments, createArticle, updateArticle, deleteArticle, moveArticle, saveTopics, saveHome, vote, comment, resetFeedback, deleteComment };
