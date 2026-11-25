// The public site's "Resources" menu (header) and footer, written once for every public page: the static ones (home, pricing, features, marketing,
// Snap to quote, Good / Better / Best, partners) through their <!--resources-menu--> and <!--site-footer--> markers (lib/platform.js), and the generated
// ones (industries, compare, free tools, guides, supporters) through lib/industries.js shell(). Plain links rendered on the server, so search engines follow them.
// The footer lists the top items of each section plus an "All …" link, not every page (the sitemap has every page; long sitewide link lists look like stuffing).
// A new free tool shows up here from lib/free-tools.js TOOLS, a new competitor from lib/alternatives.js RIVALS.
const tenancy = require('./tenancy');
const icons = require('./icons');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const product = () => esc(tenancy.platform().settings.productName || 'Worklio Pro');
const icon = (k) => icons.svg(icons.LIBRARY[k][1]);
// required when used: free-tools and alternatives load lib/industries.js, whose shell() loads this file
const tools = () => require('./free-tools').TOOLS;
const rivals = () => require('./alternatives').RIVALS;
const helpUrl = () => tenancy.helpUrl();
const changelogUrl = () => tenancy.ideasUrl() + '/changelog';

// the header's Resources menu (public/menu.js opens it, like Features and Industries): three groups of links, each with an icon, a name and a
// one-line note, and the two newest guides on a pinboard to the right (taped photos, like the home page). Styles: public/home.css, "Resources menu".
const TOOL_NOTES = { '/tools/pricing-calculator': 'Work out what to charge for a job', '/tools/invoice-generator': 'A PDF invoice with your logo, in a minute',
  '/tools/estimate-template': 'Line by line, with a deposit and signature', '/tools/google-review-qr-code': 'Turn happy clients into Google reviews' };
function menu() {
  const item = (href, ic, name, note) => `<a href="${esc(href)}"><span class="r-ic">${icon(ic)}</span><span class="r-tx"><b>${esc(name)}</b><small>${esc(note)}</small></span></a>`;
  const group = (title, href, items) => `<div class="r-group"><a class="r-head" href="${esc(href)}">${title}</a>${items.join('')}</div>`;
  const groups = [
    group('Free tools', '/tools', tools().map((t) => item(t.path, t.icon, t.short, TOOL_NOTES[t.path] || ''))),
    group('Learn', '/guides', [item('/guides', 'book', 'Guides', 'Pricing, marketing and running the business'), item(helpUrl(), 'help', 'Help center', 'Step-by-step how-tos for the app'),
      item(changelogUrl(), 'sparkle', 'What’s new', 'Every new feature, as it ships')]),
    group('Compare', '/compare', [item('/compare', 'sliders', 'All comparisons', 'Side by side, with real prices'),
      ...rivals().map((r) => item(`/compare/${r.slug}`, 'target', `${r.name} alternative`, `${product()} vs ${r.name}`))]),
  ];
  // the pinboard: the two newest guides (with a photo when the guide or its trade has one)
  let latest = [];
  try { const g = require('./guides'); latest = g.published().slice(0, 2).map((x) => ({ x, hero: g.heroOf(x), min: g.readMinutes(x) })); } catch { /* guides not set up */ }
  const pin = ({ x, hero, min }) => `<a class="r-pin" href="/guides/${esc(x.slug)}"><span class="r-photo">${hero ? `<img src="${esc(hero.src)}" alt="" loading="lazy" width="320" height="180">` : `<span class="r-nophoto">${icon('book')}</span>`}</span><b>${esc(x.title)}</b><small>${min} min read</small></a>`;
  const board = latest.length ? `<div class="r-board"><p class="r-board-h">Fresh guides <span class="r-hand">new every week</span></p>${latest.map(pin).join('')}<a class="r-more" href="/guides">All guides →</a></div>` : '';
  return `<div class="h-menu"><button type="button" class="h-menu-btn" aria-expanded="false" aria-controls="resources-menu">Resources<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
<div class="h-drop h-drop-res" id="resources-menu" hidden><div class="r-wrap${board ? '' : ' r-noboard'}"><div class="r-groups">${groups.join('')}</div>${board}</div></div></div>`;
}

// the trades named in the footer (the rest are one click away on /industries)
const FOOT_INDUSTRIES = ['hvac', 'plumbing', 'electrical', 'lawn-care', 'house-cleaning', 'roofing', 'pest-control', 'painting'];

// the footer's first column: the logo (Alpha → Settings → Logo; light and dark versions, drawn with public/brand.js's classes) or the name,
// the contact phone and email (Alpha → Settings → Your product) and the social accounts (Alpha → Settings → SEO), each shown only when set
const SOCIAL = { facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube', x: 'X', tiktok: 'TikTok', kickstarter: 'Kickstarter' };
const KICKSTARTER = '<path d="M8.5 4v16M8.5 12.5 15.5 4M10.5 10l5.5 10"/>';
const lineIcon = (paths) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
function about() {
  const P = tenancy.platform(); const s = P.settings; const b = require('./brand').brand(); const ICON = require('./business-page').ICON;
  const img = (src, cls) => `<img class="brand-img ${cls}" src="${esc(src)}" alt="${b.logoHasName ? product() : ''}" height="34" loading="lazy">`;
  const logo = b.logo ? (b.logoDark ? img(b.logo, 'lg-l') + img(b.logoDark, 'lg-d') : img(b.logo, 'lg-solo')) : '';
  const name = logo && b.logoHasName ? '' : `<b class="pname">${product()}</b>`;
  const tel = s.contactPhone ? `<a href="tel:${esc(s.contactPhone.replace(/[^\d+]/g, ''))}">${lineIcon(ICON.phone)}${esc(s.contactPhone)}</a>` : '';
  const mail = s.contactEmail ? `<a href="mailto:${esc(s.contactEmail)}">${lineIcon(ICON.email)}${esc(s.contactEmail)}</a>` : '';
  const social = (P.seo && P.seo.social) || {};
  const nets = Object.keys(SOCIAL).filter((k) => /^https:\/\//.test(social[k] || ''));
  return `<div class="h-foot-about">
        <a class="h-foot-logo" href="/">${logo}${name}</a>
        <p>Quotes, scheduling, invoicing and payments for field service businesses, from solo pros to full crews.</p>
        ${tel || mail ? `<p class="h-foot-contact">${tel}${mail}</p>` : ''}
        ${nets.length ? `<p class="h-foot-social">${nets.map((k) => `<a href="${esc(social[k])}" target="_blank" rel="noopener me" aria-label="${product()} on ${SOCIAL[k]}" title="${SOCIAL[k]}">${lineIcon(k === 'kickstarter' ? KICKSTARTER : ICON[k])}</a>`).join('')}</p>` : ''}
      </div>`;
}

function footer() {
  const ind = require('./industries');
  const byslug = Object.fromEntries(ind.INDUSTRIES.map((i) => [i.slug, i]));
  const col = (title, links) => `<div><p class="h-foot-h">${title}</p><ul>${links.filter(Boolean).map(([href, name]) => `<li><a href="${esc(href)}">${esc(name)}</a></li>`).join('')}</ul></div>`;
  let partnersOn = false; try { partnersOn = require('./partners').program().enabled; } catch { /* not set up */ }
  const supporters = require('./supporters').footerLink();
  return `<footer class="h-foot h-foot-big"><div class="h-wrap">
    <div class="h-foot-main">
      ${about()}
      <nav class="h-foot-cols" aria-label="Footer">
        ${col('Product', [['/features', 'Features'], ['/good-better-best', 'Good / Better / Best quotes'], ['/quote-from-photos', 'Snap to quote'], ['/marketing', 'Every job markets itself'], ['/pricing', 'Pricing'], [changelogUrl(), 'What’s new']])}
        ${col('Industries', [...FOOT_INDUSTRIES.filter((s) => byslug[s]).map((s) => [`/industries/${s}`, byslug[s].name]), ['/industries', 'All industries →']])}
        ${col('Free tools', [...tools().map((t) => [t.path, t.name]), ['/tools', 'All free tools →']])}
        ${col('Compare', [...rivals().map((r) => [`/compare/${r.slug}`, `${r.name} alternative`]), ['/compare', 'All comparisons →']])}
        ${col('Resources', [['/guides', 'Guides'], [helpUrl(), 'Help center'], partnersOn && ['/partners', 'Creator partners'], ['/sign-in', 'Log in']])}
      </nav>
    </div>
    <div class="h-foot-bottom">
      <span>© <span id="yr">${new Date().getFullYear()}</span> <span class="pname">${product()}</span>${require('./legal').owner()}</span>
      <nav class="h-foot-legal" aria-label="Legal">${supporters}<a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a><a href="/sms-consent">Text Message Opt-In</a></nav>
    </div>
  </div></footer>`;
}

// a static page's markers
const fill = (html) => html.replace('<!--resources-menu-->', menu()).replace('<!--site-footer-->', footer());

module.exports = { menu, footer, fill };
