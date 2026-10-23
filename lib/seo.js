// Search engine optimization for the public pages (managed in Alpha → Settings → SEO): each page's title and description,
// canonical links, social share tags (Open Graph, X), structured data (JSON-LD) for Google's rich results, robots.txt,
// sitemap.xml and the X-Robots-Tag header that keeps account apps, client links and Alpha out of search results.
// Titles and descriptions start from RECOMMENDED; a field saved blank in Alpha goes back to the recommended text.
const fs = require('fs');
const path = require('path');
const tenancy = require('./tenancy');
const brandLib = require('./brand');

const P = () => tenancy.platform();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const xml = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const fail = (msg) => { throw Object.assign(new Error(msg), { status: 400 }); };
const industries = () => require('./industries'); // loaded when used: industries.js loads this file for its page shell
const SHARE_IMAGE = '/img/og-default.jpg';

// the pages, in the order Alpha lists them. {product} and the other {tokens} are filled in per page.
const PAGES = {
  home: { label: 'Home page', path: '/', tokens: ['product', 'lowest_price', 'industry_count'] },
  pricing: { label: 'Pricing', path: '/pricing', tokens: ['product', 'lowest_price'] },
  industries: { label: 'Industries list', path: '/industries', tokens: ['product', 'industry_count'] },
  industry: { label: 'Each industry page', path: '/industries/hvac', tokens: ['product', 'industry'], template: true },
  supporters: { label: 'Founding Supporters', path: '/supporters', tokens: ['product'] },
  help: { label: 'Help Center home', path: '/', help: true, tokens: ['product'] },
  helpTopic: { label: 'Each Help Center topic', path: '/topics/get-started', help: true, tokens: ['product', 'topic', 'topic_description'], template: true },
  helpArticle: { label: 'Each Help Center article', path: '/articles/send-a-quote', help: true, tokens: ['product', 'article', 'summary'], template: true },
};
// written for searches like "field service software", "HVAC software", "quoting and invoicing app": titles under ~60 characters
// and descriptions under ~155, so Google shows them whole
const RECOMMENDED = {
  home: { title: '{product}: Field Service Software for Small Businesses', description: 'Quote, schedule, invoice and get paid in one app. {product} helps HVAC, plumbing, cleaning and lawn care businesses run every job from any phone.' },
  pricing: { title: 'Pricing & Plans from {lowest_price}/month | {product}', description: 'Field service software from {lowest_price}/month: quotes, scheduling, invoices, card payments, texting and reports. No contract. Set up in minutes.' },
  industries: { title: 'Field Service Software for {industry_count} Trades | {product}', description: 'Quoting, scheduling and invoicing software built for HVAC, plumbing, electrical, cleaning, lawn care, roofing, pest control and more trades.' },
  industry: { title: '{industry} Software for Quotes & Scheduling | {product}', description: '{industry} software for quotes, scheduling, invoices and card payments. {product} keeps your office, crew and clients in sync from any phone.' },
  supporters: { title: 'Founding Supporters | {product}', description: 'The people who backed {product} from the very start. Thank you to our Founding Supporters for helping us build field service software.' },
  help: { title: '{product} Help Center: Guides & Support', description: 'Step-by-step guides for quotes, scheduling, invoices, payments and your team in {product}, plus a way to reach our support team.' },
  helpTopic: { title: '{topic} | {product} Help Center', description: '{topic_description}' },
  helpArticle: { title: '{article} | {product} Help Center', description: '{summary}' },
};
const SOCIAL = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube', x: 'X (Twitter)', tiktok: 'TikTok', kickstarter: 'Kickstarter' };

const store = () => { const s = (P().seo = P().seo || {}); s.pages = s.pages || {}; s.social = s.social || {}; return s; };
const indexing = () => store().indexing !== false;
const pageText = (key) => ({ title: (store().pages[key] || {}).title || RECOMMENDED[key].title, description: (store().pages[key] || {}).description || RECOMMENDED[key].description });

// ---------- values for the {tokens} ----------
const product = () => P().settings.productName || 'Worklio Pro';
function lowestPrice() {
  const m = P().plans.filter((p) => !p.hidden && Number(p.monthly) > 0).map((p) => Number(p.monthly));
  return m.length ? '$' + Math.min(...m) : '';
}
const baseVars = () => ({ product: product(), lowest_price: lowestPrice(), industry_count: String(industries().INDUSTRIES.length) });
const fill = (s, vars) => String(s).replace(/\{([a-z_]+)\}/g, (m, k) => (k in vars ? vars[k] : m)).replace(/\s+/g, ' ').trim();
// a description cut at a word, for page text used as a description (help summaries can run long)
// "Lawn care & landscaping" → "Lawn Care & Landscaping" for titles; HVAC stays HVAC
const titleCase = (s) => String(s).replace(/\b([a-z])([a-z]*)/g, (m, a, b) => (['and', 'or', 'of', 'for', 'the'].includes(m) ? m : a.toUpperCase() + b));
const short = (s, n = 158) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,;:.]$/, '') + '…');

// ---------- absolute addresses ----------
const siteUrl = () => tenancy.platformUrl().replace(/\/+$/, '');
const helpSite = () => tenancy.helpUrl().replace(/\/+$/, '');
const abs = (u, help) => (/^https?:\/\//.test(u) ? u : (help ? helpSite() : siteUrl()) + u);
const logoUrl = () => { const b = brandLib.brand(); return b.logo ? abs(b.logo) : ''; };
const shareImage = () => abs(store().shareImage || SHARE_IMAGE);
const sameAs = () => Object.keys(SOCIAL).map((k) => store().social[k]).filter(Boolean);

// ---------- structured data ----------
const organization = () => ({ '@type': 'Organization', '@id': siteUrl() + '/#organization', name: product(), url: siteUrl() + '/', ...(logoUrl() ? { logo: logoUrl() } : {}),
  ...(P().settings.contactEmail ? { email: P().settings.contactEmail } : {}), ...(sameAs().length ? { sameAs: sameAs() } : {}) });
const website = () => ({ '@type': 'WebSite', '@id': siteUrl() + '/#website', name: product(), url: siteUrl() + '/', publisher: { '@id': siteUrl() + '/#organization' } });
function software(description, { perPlan = false } = {}) {
  const plans = P().plans.filter((p) => !p.hidden && Number(p.monthly) > 0); const prices = plans.map((p) => Number(p.monthly));
  const app = { '@type': 'SoftwareApplication', name: product(), applicationCategory: 'BusinessApplication', operatingSystem: 'Web browser on any computer, tablet or phone', url: siteUrl() + '/', description, publisher: { '@id': siteUrl() + '/#organization' } };
  if (plans.length) app.offers = perPlan
    ? plans.map((p) => ({ '@type': 'Offer', name: p.name, description: p.description || '', price: String(p.monthly), priceCurrency: 'USD', url: siteUrl() + '/pricing', priceSpecification: { '@type': 'UnitPriceSpecification', price: String(p.monthly), priceCurrency: 'USD', unitText: 'MONTH' } }))
    : { '@type': 'AggregateOffer', lowPrice: String(Math.min(...prices)), highPrice: String(Math.max(...prices)), priceCurrency: 'USD', offerCount: String(plans.length) };
  return app;
}
const faq = (pairs) => (pairs.length ? { '@type': 'FAQPage', mainEntity: pairs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) } : null);
const breadcrumbs = (items) => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })) });
const ld = (items) => { const graph = items.filter(Boolean); return graph.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>` : ''; };
// the FAQ on a static page: <details><summary>question</summary><p>answer</p></details>
const plain = (h) => String(h).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|’/g, '’').replace(/\s+/g, ' ').trim();
const faqFromHtml = (html) => [...String(html).matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)].map((m) => [plain(m[1]), plain(m[2])]);

// ---------- the <head> tags for one page ----------
// key: a PAGES key; o: { path (canonical path), vars (extra tokens), help (on the Help Center's address), noindex, schema: [JSON-LD items] }
function head(key, o = {}) {
  const vars = { ...baseVars(), ...(o.vars || {}) }; const t = pageText(key);
  let title = fill(t.title, vars); const description = short(fill(t.description, vars));
  const brand = ` | ${product()}`; if (title.length > 60 && title.endsWith(brand)) title = title.slice(0, -brand.length); // Google shows the site name anyway; keep the keywords
  const url = abs(o.path || PAGES[key].path, o.help ?? PAGES[key].help); const img = shareImage(); const x = (store().social.xHandle || '').replace(/^@?/, '@');
  const s = store(); const robots = !indexing() || o.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1';
  return [`<title>${esc(title)}</title>`, `<meta name="description" content="${esc(description)}">`, `<meta name="robots" content="${robots}">`, `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="website">`, `<meta property="og:site_name" content="${esc(product())}">`, `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`, `<meta property="og:image" content="${esc(img)}">`, `<meta property="og:image:alt" content="${esc(product())}: field service software">`, `<meta property="og:locale" content="en_US">`,
    `<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:title" content="${esc(title)}">`, `<meta name="twitter:description" content="${esc(description)}">`, `<meta name="twitter:image" content="${esc(img)}">`,
    x.length > 1 ? `<meta name="twitter:site" content="${esc(x)}">` : '',
    s.googleVerification ? `<meta name="google-site-verification" content="${esc(s.googleVerification)}">` : '', s.bingVerification ? `<meta name="msvalidate.01" content="${esc(s.bingVerification)}">` : '',
    ld(o.schema || [])].filter(Boolean).join('\n  ');
}
// a static page (home.html, site.html, help.html): its own <title> and description are replaced by head()
const inject = (html, key, o) => html.replace(/<title>[\s\S]*?<\/title>\s*/, '').replace(/<meta name="description"[^>]*>\s*/, '').replace('</head>', `  ${head(key, o)}\n</head>`);

// ---------- the pages ----------
const homePage = (html) => { const t = pageText('home'); const description = short(fill(t.description, baseVars()));
  return inject(html, 'home', { schema: [organization(), website(), software(description), faq(faqFromHtml(html))] }); };
const pricingPage = (html) => inject(html, 'pricing', { schema: [organization(), software(short(fill(pageText('pricing').description, baseVars())), { perPlan: true }),
  breadcrumbs([['Home', siteUrl() + '/'], ['Pricing', siteUrl() + '/pricing']])] });
const industriesHead = () => head('industries', { schema: [organization(), breadcrumbs([['Home', siteUrl() + '/'], ['Industries', siteUrl() + '/industries']])] });
const industryHead = (i, faqPairs) => head('industry', { path: `/industries/${i.slug}`, vars: { industry: titleCase(i.name) },
  schema: [organization(), breadcrumbs([['Home', siteUrl() + '/'], ['Industries', siteUrl() + '/industries'], [i.name, `${siteUrl()}/industries/${i.slug}`]]), faq(faqPairs)] });
const supportersHead = () => head('supporters', { schema: [organization()] });
// the Help Center: one page for every address (help.js draws it), so the server writes each address's tags
function helpPage(html, reqPath) {
  const H = require('./help-store').content(); const p = reqPath.replace(/\/+$/, '') || '/'; const m = p.match(/^\/(topics|articles)\/([a-z0-9-]+)$/);
  const prod = (s) => String(s || '').replace(/\{product\}/g, product());
  const crumbs = [['Help Center', helpSite() + '/']];
  if (p === '/') return inject(html, 'help', { path: '/', help: true, schema: [organization()] });
  if (m && m[1] === 'topics') { const t = H.topics.find((x) => x.slug === m[2]); if (t) return inject(html, 'helpTopic', { path: p, help: true, vars: { topic: prod(t.title), topic_description: prod(t.desc) }, schema: [breadcrumbs([...crumbs, [prod(t.title), helpSite() + p]])] }); }
  if (m && m[1] === 'articles') { const a = H.articles.find((x) => x.slug === m[2]); if (a) { const t = H.topics.find((x) => x.slug === a.topic);
    return inject(html, 'helpArticle', { path: p, help: true, vars: { article: plain(prod(a.title)), summary: plain(prod(a.summary)) }, schema: [breadcrumbs([...crumbs, ...(t ? [[prod(t.title), `${helpSite()}/topics/${t.slug}`]] : []), [plain(prod(a.title)), helpSite() + p]])] }); } }
  return inject(html, 'help', { path: p, help: true, noindex: true }); // search, contact and unknown addresses stay out of results
}

// ---------- robots.txt, sitemap.xml and the X-Robots-Tag header ----------
// where: 'platform' (the public site), 'help' (the Help Center) or 'account' (a business's app and client links)
const PRIVATE = /^\/(alpha|platform|api|checkout|stripe|oauth|brand\/media-)(\/|$)/;
const indexable = (where, p) => indexing() && (where === 'platform' ? !PRIVATE.test(p) && p !== '/signup' : where === 'help' ? !/^\/(api|search|contact)(\/|$)/.test(p) : false);
function robots(where) {
  if (where === 'account' || !indexing()) return 'User-agent: *\nDisallow: /\n';
  if (where === 'help') return `User-agent: *\nDisallow: /api/\nAllow: /\n\nSitemap: ${helpSite()}/sitemap.xml\n`;
  return `User-agent: *\nDisallow: /alpha\nDisallow: /api/\nDisallow: /checkout/\nAllow: /\n\nSitemap: ${siteUrl()}/sitemap.xml\nSitemap: ${helpSite()}/sitemap.xml\n`;
}
function sitemap(where) {
  let urls;
  if (where === 'help') { const H = require('./help-store').content(); urls = ['/', ...H.topics.map((t) => `/topics/${t.slug}`), ...H.articles.map((a) => `/articles/${a.slug}`)].map((u) => helpSite() + u); }
  else urls = ['/', '/pricing', '/industries', ...industries().INDUSTRIES.map((i) => `/industries/${i.slug}`), ...(require('./supporters').isOn() ? ['/supporters'] : []), '/terms', '/privacy'].map((u) => siteUrl() + u);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${(indexing() ? urls : []).map((u) => `  <url><loc>${xml(u)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
// answers /robots.txt and /sitemap.xml on every address, and marks everything that shouldn't be in search results. True when it answered.
function handle(req, res, where) {
  const p = req.url.split('?')[0];
  if (!indexable(where, p)) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (p === '/robots.txt') { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(robots(where)); return true; }
  if (p === '/sitemap.xml' && where !== 'account') { res.setHeader('Content-Type', 'application/xml; charset=utf-8'); res.end(sitemap(where)); return true; }
  return false;
}

// ---------- Alpha → Settings → SEO ----------
const adminView = () => {
  const s = store();
  return { indexing: indexing(), googleVerification: s.googleVerification || '', bingVerification: s.bingVerification || '', shareImage: s.shareImage || '', defaultShareImage: SHARE_IMAGE,
    social: s.social, socialLabels: SOCIAL, sitemaps: [siteUrl() + '/sitemap.xml', helpSite() + '/sitemap.xml'], robots: siteUrl() + '/robots.txt',
    pages: Object.entries(PAGES).map(([key, pg]) => ({ key, label: pg.label, url: abs(pg.path, pg.help), template: !!pg.template, tokens: pg.tokens, title: (s.pages[key] || {}).title || '', description: (s.pages[key] || {}).description || '', recommended: RECOMMENDED[key] })),
    sample: { ...baseVars(), industry: 'HVAC', topic: 'Get Started', topic_description: `Hand-picked guides to get ${product()} set up and running for your business.`, article: 'Send a quote', summary: 'Build a quote from your saved services, send it by email or text, and let your client approve it online.' } };
};
const VERIFY_RE = /^[A-Za-z0-9_-]{0,100}$/;
// a verification value pasted as the whole tag: keep only its content
const verifyValue = (v) => { const s = String(v || '').trim(); const m = s.match(/content=["']([^"']+)["']/); return m ? m[1] : s; };
function save(b) {
  const s = store();
  if ('indexing' in b) s.indexing = !!b.indexing;
  for (const k of ['googleVerification', 'bingVerification']) if (k in b) { const v = verifyValue(b[k]); if (!VERIFY_RE.test(v)) fail(`That ${k === 'googleVerification' ? 'Google' : 'Bing'} verification code doesn’t look right. Paste the content value from the meta tag.`); s[k] = v; }
  if ('shareImage' in b) { const v = String(b.shareImage || ''); if (v && !/^\/brand\/media-\d+\.(png|jpg|gif|webp)$/.test(v)) fail('Upload the share image here'); s.shareImage = v; }
  if (b.social) for (const k of [...Object.keys(SOCIAL), 'xHandle']) if (k in b.social) {
    const v = String(b.social[k] || '').trim().slice(0, 200);
    if (k === 'xHandle') { if (v && !/^@?[A-Za-z0-9_]{1,15}$/.test(v)) fail('Enter your X handle like @workliopro'); s.social.xHandle = v ? '@' + v.replace(/^@/, '') : ''; continue; }
    if (v && !/^https:\/\/[^\s]+$/.test(v)) fail(`Enter the full ${SOCIAL[k]} address, starting with https://`); s.social[k] = v;
  }
  if (b.pages) for (const [key, v] of Object.entries(b.pages)) {
    if (!PAGES[key] || !v) continue; const title = clip(v.title, 120); const description = clip(v.description, 320);
    // the recommended text is kept as blank, so improvements to it reach pages nobody customized
    s.pages[key] = { title: title === RECOMMENDED[key].title ? '' : title, description: description === RECOMMENDED[key].description ? '' : description };
    if (!s.pages[key].title && !s.pages[key].description) delete s.pages[key];
  }
  tenancy.savePlatform();
}

module.exports = { head, inject, homePage, pricingPage, industriesHead, industryHead, supportersHead, helpPage, handle, adminView, save, plain };
