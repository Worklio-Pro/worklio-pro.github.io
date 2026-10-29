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
  'account-connections', 'google-reviews', 'online-booking', 'social-posts', 'app-marketplace', 'time-off', 'refer-earn', 'forum-feedback'];
// help center updates that shipped with the app: once each, add the topics a help center doesn't have yet, and bring these
// topics' descriptions and these articles up to date with the shipped content (this replaces console edits to them)
const REFRESHED = [
  { id: '2026-10-29', topics: ['clients', 'client-communications', 'team', 'getting-help'],
    articles: ['first-steps', 'finding-your-way', 'appointment-reminders', 'create-send-quote', 'quote-deposits', 'quote-to-job', 'create-job', 'job-signatures', 'create-send-invoice',
      'record-payment', 'products-services', 'add-clients', 'import-clients', 'merge-clients', 'client-portal', 'email-templates', 'text-messages', 'payout-schedule', 'invite-team', 'access-levels'] },
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
