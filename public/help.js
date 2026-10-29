'use strict';
// Help center: home, topic pages, articles, search and the contact form. Content comes from /api/help/content
// (edited in the platform console → Help Center).
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let product = ''; // the product name from the platform console, filled in by /api/help/info
const hcName = () => `${product ? product + ' ' : ''}Help Center`;
const prod = () => esc(product || 'the app');
const fill = (s) => String(s).replace(/\{product\}/g, prod());
let TOPICS = []; let ARTICLES = []; let POPULAR = []; let SUGGESTED = [];
const topicOf = (slug) => TOPICS.find((t) => t.slug === slug) || { slug, title: '', desc: '', icon: 'help' };
const articleOf = (slug) => ARTICLES.find((a) => a.slug === slug);
const inTopic = (slug) => ARTICLES.filter((a) => a.topic === slug);
const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const readMins = (a) => Math.max(1, Math.round(plain(a.body).split(' ').length / 200));

const ic = (d, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
  card: '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  team: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2"/><circle cx="19" cy="10" r="2"/><path d="M7 21v-2a5 5 0 0 1 10 0v2M1 19v-1a3 3 0 0 1 4-2.8M23 19v-1a3 3 0 0 0-4-2.8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.3-2.4 3.9"/><path d="M12 17.2h.01"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
};

/* ===== search: every word must match; title matches rank first ===== */
function search(q) {
  const words = q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
  if (!words.length) return [];
  return ARTICLES.map((a) => {
    const title = fill(a.title).toLowerCase(); const extra = `${a.summary} ${a.keywords || ''} ${topicOf(a.topic).title}`.toLowerCase(); const body = plain(fill(a.body)).toLowerCase();
    let score = 0;
    for (const w of words) { const s = (title.includes(w) ? 6 : 0) + (extra.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0); if (!s) return null; score += s; }
    return { a, score };
  }).filter(Boolean).sort((x, y) => y.score - x.score).map((x) => x.a);
}
const STOP = new Set(['how', 'do', 'does', 'can', 'the', 'and', 'for', 'what', 'my', 'to', 'in', 'of', 'is', 'it', 'on', 'an', 'or', 'with', 'see', 'set', 'up', 'use', 'get', 'where', 'why', 'when', 'who']);
// a search box with live results; Enter opens the highlighted result, or the full results page
function wireSearch(box) {
  const input = $('input', box); const out = $('.hc-results', box); let hits = []; let sel = 0;
  const draw = () => {
    const q = input.value.trim(); hits = search(q).slice(0, 6); sel = 0; out.hidden = !q;
    out.innerHTML = hits.length ? hits.map((a, i) => `<a href="/articles/${a.slug}" data-link class="${i === 0 ? 'act' : ''}">${fill(a.title)}<span>${esc(topicOf(a.topic).title)} · ${fill(a.summary)}</span></a>`).join('')
      + `<a href="/search?q=${encodeURIComponent(q)}" data-link><span>See all results for “${esc(q)}”</span></a>` : `<div class="none">No articles match “${esc(q)}”. <a href="/contact" data-link>Ask our support team</a></div>`;
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => {
    const links = $$('a', out);
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && links.length) { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : links.length - 1)) % links.length; links.forEach((l, i) => l.classList.toggle('act', i === sel)); }
    else if (e.key === 'Enter') { e.preventDefault(); const q = input.value.trim(); if (!q) return; go(links[sel] ? links[sel].getAttribute('href') : `/search?q=${encodeURIComponent(q)}`); }
    else if (e.key === 'Escape') { input.value = ''; out.hidden = true; }
  });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) out.hidden = true; });
}
const searchBox = (value = '') => `<div class="hc-search" role="search">${ic(ICONS.search, 20).replace('<svg', '<svg class="ic"')}<input type="search" placeholder="Search for answers" aria-label="Search the help center" autocomplete="off" value="${esc(value)}"><kbd>/</kbd><div class="hc-results" hidden></div></div>`;

/* ===== pages ===== */
const articleCard = (a) => `<a class="card" href="/articles/${a.slug}" data-link><h3>${fill(a.title)}</h3><p>${fill(a.summary)}</p><span class="meta">${readMins(a)} min read</span></a>`;
const helpBand = () => `<div class="card hc-help"><div><h2>Still need help?</h2><p>Our support team is here for you. Already signed in? Use <strong>? → Get Support</strong> in ${prod()} so we see your account details.</p></div><a class="btn" href="/contact" data-link>${ic(ICONS.chat, 18)} Contact support</a></div>`;
const topicNav = (cur) => `<h3>Topics</h3><nav>${TOPICS.map((t) => `<a href="/topics/${t.slug}" data-link class="${t.slug === cur ? 'on' : ''}">${esc(t.title)}</a>`).join('')}</nav>`;
const crumbs = (items) => `<div class="crumbs"><a href="/" data-link>Help Center</a>${items.map(([href, l]) => ` › ${href ? `<a href="${href}" data-link>${esc(l)}</a>` : esc(l)}`).join('')}</div>`;

function home() {
  return { title: `${hcName()}`, html: `<section class="hc-hero"><div class="wrap"><h1>How can we help?</h1>${searchBox()}
<div class="hc-suggest">${SUGGESTED.map((q) => `<a href="/search?q=${encodeURIComponent(q)}" data-link>${esc(q)}</a>`).join('')}</div></div></section>
<div class="wrap"><section class="hc-sec hc-pop" aria-label="Popular articles"><div class="grid g3">${POPULAR.map(articleOf).filter(Boolean).map(articleCard).join('')}</div></section>
<section class="hc-sec"><h2>What do you want to get done?</h2><div class="grid g3">${TOPICS.map((t) => `<a class="card" href="/topics/${t.slug}" data-link><span class="topic-ic">${ic(ICONS[t.icon])}</span><h3>${esc(t.title)}</h3><p>${fill(t.desc)}</p><span class="meta">${inTopic(t.slug).length} article${inTopic(t.slug).length === 1 ? '' : 's'}</span></a>`).join('')}</div></section>
${helpBand()}</div>` };
}
function topicPage(slug) {
  const t = TOPICS.find((x) => x.slug === slug); if (!t) return notFound();
  return { title: `${t.title} · ${hcName()}`, html: `<div class="wrap">${crumbs([[null, t.title]])}<div class="page"><div><h1 class="page-title">${esc(t.title)}</h1><p class="lead">${fill(t.desc)}</p>
<div class="alist">${inTopic(slug).map((a) => `<a href="/articles/${a.slug}" data-link><strong>${fill(a.title)}</strong><span>${fill(a.summary)} · ${readMins(a)} min read</span></a>`).join('')}</div></div>
<aside class="side">${topicNav(slug)}</aside></div>${helpBand()}</div>` };
}
function articlePage(slug) {
  const a = articleOf(slug); if (!a) return notFound();
  const t = topicOf(a.topic); const more = inTopic(a.topic);
  return { title: `${plain(fill(a.title))} · ${hcName()}`, html: `<div class="wrap">${crumbs([[`/topics/${t.slug}`, t.title], [null, plain(fill(a.title))]])}<div class="page"><div>
<h1 class="page-title">${fill(a.title)}</h1><p class="lead">${fill(a.summary)}</p>
<article class="card article">${fill(a.body)}<div class="feedback" id="feedback" data-slug="${esc(a.slug)}">${votedOn(a.slug) ? '<span>Thanks for your feedback!</span>' : '<span>Was this article helpful?</span><button type="button" data-fb="yes">👍 Yes</button><button type="button" data-fb="no">👎 No</button>'}</div></article></div>
<aside class="side"><h3>In ${esc(t.title)}</h3><nav>${more.map((x) => `<a href="/articles/${x.slug}" data-link class="${x.slug === slug ? 'on' : ''}">${fill(x.title)}</a>`).join('')}</nav>${topicNav(a.topic)}</aside></div>${helpBand()}</div>` };
}
function searchPage(q) {
  const hits = search(q);
  return { title: `Search: ${q} · ${hcName()}`, html: `<section class="hc-hero" style="padding-bottom:40px"><div class="wrap">${searchBox(q)}</div></section><div class="wrap">${crumbs([[null, 'Search']])}
<h1 class="page-title">${hits.length} result${hits.length === 1 ? '' : 's'} for “${esc(q)}”</h1>
${hits.length ? `<div class="alist" style="margin:16px 0 8px">${hits.map((a) => `<a href="/articles/${a.slug}" data-link><strong>${fill(a.title)}</strong><span>${esc(topicOf(a.topic).title)} · ${fill(a.summary)}</span></a>`).join('')}</div>`
    : `<p class="lead">Try different words, or <a href="/" data-link>browse the topics</a>.</p>`}${helpBand()}</div>` };
}
const CONTACT_TOPICS = ['I can’t log in', 'Something isn’t working', 'How do I…?', 'Account and billing', 'Getting started', 'Other'];
function contactPage() {
  return { title: `Contact support · ${hcName()}`, html: `<div class="wrap">${crumbs([[null, 'Contact support']])}<h1 class="page-title">Contact support</h1>
<p class="lead">Tell us what you need help with and we’ll reply by email. If you can sign in, <strong>? → Get Support</strong> inside ${prod()} sends your account details along automatically.</p>
<form class="card form" id="contactForm" novalidate><div class="row"><label>Your name<input name="name" required maxlength="100" autocomplete="name"></label><label>Email<input name="email" type="email" required maxlength="200" autocomplete="email"></label></div>
<div class="row"><label>Business name (optional)<input name="company" maxlength="100" autocomplete="organization"></label><label>Phone (optional)<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label></div>
<label>Topic<select name="topic">${CONTACT_TOPICS.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>
<label>How can we help?<textarea name="message" required maxlength="4000" placeholder="What happened, what you expected, and the steps to see it"></textarea></label>
<label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
<p class="err" id="formErr" role="alert" hidden></p><button class="btn" type="submit">Send message</button></form><div style="height:48px"></div></div>` };
}
function notFound() {
  return { title: `Page not found · ${hcName()}`, html: `<div class="wrap"><div class="card hc-help" style="margin-top:40px"><div><h2>We couldn’t find that page</h2><p>It may have moved. Try searching, or start from the help center home.</p></div><a class="btn" href="/" data-link>Help Center home</a></div></div>` };
}

/* ===== router ===== */
let rendered = false;
function render() {
  const path = location.pathname.replace(/\/+$/, '') || '/'; const q = new URLSearchParams(location.search).get('q') || '';
  const m = path.match(/^\/(topics|articles)\/([a-z0-9-]+)$/);
  const view = path === '/' ? home() : m ? (m[1] === 'topics' ? topicPage(m[2]) : articlePage(m[2])) : path === '/search' ? searchPage(q) : path === '/contact' ? contactPage() : notFound();
  if (rendered) document.title = view.title; rendered = true; // the first page keeps the title the server wrote for search engines
  $('#main').innerHTML = view.html;
  $$('.hc-search', $('#main')).forEach(wireSearch);
  wirePage(); $('.hc-topics').open = false;
}
function go(url) { history.pushState({}, '', url); window.scrollTo(0, 0); render(); $('#main').focus({ preventScroll: true }); }
window.addEventListener('popstate', render);
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  e.preventDefault(); go(a.getAttribute('href'));
});
document.addEventListener('click', (e) => { const d = $('.hc-topics'); if (d.open && !d.contains(e.target)) d.open = false; });
// the phone menu: the hamburger slides the header links and topics in from the right
(() => {
  const burger = $('.hc-burger'); const panel = $('#hcPanel'); const scrim = $('.hc-scrim'); const phone = window.matchMedia('(max-width:640px)');
  const isOpen = () => panel.classList.contains('open');
  const set = (open, refocus) => {
    panel.classList.toggle('open', open); scrim.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open)); document.body.style.overflow = open ? 'hidden' : '';
    if (open) $('.hc-close').focus(); else if (refocus) burger.focus();
  };
  burger.addEventListener('click', () => set(true));
  $('.hc-close').addEventListener('click', () => set(false, true));
  scrim.addEventListener('click', () => set(false, true));
  panel.addEventListener('click', (e) => { if (isOpen() && e.target.closest('a')) set(false); }); // a link was tapped: go there with the menu shut
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) set(false, true); });
  phone.addEventListener('change', () => { if (!phone.matches && isOpen()) set(false); });
})();
// "/" or ⌘K focuses the search box (on pages without one, it goes to the home page's)
document.addEventListener('keydown', (e) => {
  const typing = e.target.closest('input, textarea, select');
  if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); const i = $('.hc-search input'); if (i) i.focus(); else { go('/'); $('.hc-search input').focus(); } }
});
function wirePage() {
  const fb = $('#feedback');
  if (fb) fb.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-fb]'); if (!b) return; const slug = fb.dataset.slug; const yes = b.dataset.fb === 'yes';
    markVoted(slug); sendFeedback({ slug, vote: yes ? 'yes' : 'no' });
    if (yes) { fb.innerHTML = '<span>Thanks for letting us know!</span>'; return; }
    // a No: ask what was missing (optional), so the article can be improved
    fb.innerHTML = `<form class="fb-more"><label>Sorry this didn’t help. What were you looking for? <span class="muted">(optional)</span><textarea name="c" rows="3" maxlength="1000"></textarea></label>
<div class="fb-acts"><button class="btn" type="submit">Send</button><a href="/contact" data-link>Contact support instead</a></div></form>`;
    const f = $('form', fb); $('textarea', f).focus();
    f.addEventListener('submit', (ev) => { ev.preventDefault(); const c = f.c.value.trim(); if (c) sendFeedback({ slug, comment: c }); fb.innerHTML = '<span>Thanks, this helps us improve the article.</span>'; });
  });
  const f = $('#contactForm'); if (!f) return;
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const err = $('#formErr'); err.hidden = true;
    if (!f.reportValidity()) return;
    const btn = $('[type=submit]', f); btn.disabled = true; btn.textContent = 'Sending…';
    const body = { ...Object.fromEntries(new FormData(f)), page: document.referrer && /^https?:/.test(document.referrer) ? document.referrer : location.href };
    try {
      const r = await fetch('/api/help/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.');
      f.outerHTML = `<div class="card sent"><h2>Message sent</h2><p class="lead" style="margin:0 0 18px">Thanks, ${esc(body.name.split(' ')[0])}. We’ll reply to ${esc(body.email)} as soon as we can.</p><a class="btn alt" href="/" data-link>Back to the Help Center</a></div>`;
    } catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; btn.textContent = 'Send message'; }
  });
}

// remembered per browser so the buttons don't come back after voting (the server also counts one vote a day per connection)
const votes = () => { try { return JSON.parse(localStorage.getItem('hc-voted') || '{}'); } catch (e) { return {}; } };
const votedOn = (slug) => !!votes()[slug];
const markVoted = (slug) => { try { localStorage.setItem('hc-voted', JSON.stringify({ ...votes(), [slug]: Date.now() })); } catch (e) { /* private mode */ } };
const sendFeedback = (body) => fetch('/api/help/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});

/* ===== theme + product name ===== */
const THEMES = ['system', 'light', 'dark'];
const theme = () => { try { return localStorage.getItem('theme') || 'system'; } catch (e) { return 'system'; } };
function setTheme(t) {
  if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch (e) { /* private mode */ }
  $('#themeBtn .hc-theme-i').textContent = { system: '◐', light: '☀', dark: '☾' }[t]; $('#themeBtn .hc-theme-l').textContent = { system: 'Theme: match your device', light: 'Theme: light', dark: 'Theme: dark' }[t]; $('#themeBtn').title = `Theme: ${t === 'system' ? 'match your device' : t}`;
}
$('#themeBtn').addEventListener('click', () => setTheme(THEMES[(THEMES.indexOf(theme()) + 1) % THEMES.length]));
setTheme(theme());
$('#year').textContent = new Date().getFullYear();
$('#main').innerHTML = '<div class="wrap" style="padding:48px 20px;color:var(--muted)">Loading…</div>';
Promise.all([fetch('/api/help/content').then((r) => r.json()), fetch('/api/help/info').then((r) => r.json()).catch(() => ({}))]).then(([c, i]) => {
  ({ topics: TOPICS, articles: ARTICLES, popular: POPULAR, suggested: SUGGESTED } = c);
  product = i.productName || product;
  $$('.hc-product').forEach((el) => { el.textContent = product; });
  if (i.brand && i.brand.logo) { $('.hc-brand .hc-mark').outerHTML = brandImg(i.brand, 'dark'); if (i.brand.logoHasName) $('.hc-brand .hc-product').hidden = true; } // the logo from the platform console
  $('#appLink').textContent = `Go to ${product}`; $('#appLink').href = i.siteUrl || '/'; $('#siteLink').href = i.siteUrl || '/';
  $('#topicMenu').innerHTML = $('#drawerTopics').innerHTML = TOPICS.map((t) => `<a href="/topics/${t.slug}" data-link>${ic(ICONS[t.icon] || ICONS.help, 18)}${esc(t.title)}</a>`).join(''); // the header dropdown, and the phone menu's list
  render();
}).catch(() => { $('#main').innerHTML = '<div class="wrap" style="padding:48px 20px">The help center couldn’t load. Refresh the page to try again.</div>'; });
