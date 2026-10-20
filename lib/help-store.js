// Help center content and feedback, kept in the platform store (platform.json):
//   help: { topics, articles, popular, suggested }   edited in the platform console → Help Center
//   helpFeedback: { [article slug]: { yes, no } }    "Was this article helpful?" votes
//   helpComments: [{ id, at, slug, text }]          what people said they were looking for after voting No
const crypto = require('crypto');
const tenancy = require('./tenancy');
const seed = require('./help-content');

const P = () => tenancy.platform();
const ICONS = ['rocket', 'calendar', 'briefcase', 'users', 'mail', 'card', 'chart', 'team', 'gear', 'user', 'help'];
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const slugify = (s) => String(s || '').toLowerCase().replace(/\{product\}/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

// first use: start from the content that shipped with the app
function content() {
  const p = P();
  if (!p.help) { p.help = JSON.parse(JSON.stringify({ topics: seed.topics, articles: seed.articles, popular: seed.popular, suggested: seed.suggested })); tenancy.savePlatform(); }
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
