// The public site's "Resources" menu (header) and footer, written once for every public page: the static ones (home, pricing, features, marketing,
// Snap to quote, Good / Better / Best, partners) through their <!--resources-menu--> and <!--site-footer--> markers (lib/platform.js), and the generated
// ones (industries, compare, free tools, guides, supporters) through lib/industries.js shell(). Plain links rendered on the server, so search engines follow them.
// The footer lists the top items of each section plus an "All …" link, not every page (the sitemap has every page; long sitewide link lists look like stuffing).
// A new free tool shows up here from lib/free-tools.js TOOLS. Competitors are only named on /compare, never in the menus or footer.
const tenancy = require('./tenancy');
const icons = require('./icons');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const product = () => esc(tenancy.platform().settings.productName || 'Worklio Pro');
const icon = (k) => icons.svg(icons.LIBRARY[k][1]);
// required when used: free-tools loads lib/industries.js, whose shell() loads this file
const tools = () => require('./free-tools').TOOLS;
const helpUrl = () => tenancy.helpUrl();
const changelogUrl = () => tenancy.ideasUrl() + '/changelog';

// ---------- the header menus' layout (Features, Industries, Resources; public/menu.js opens them) ----------
// A full-width panel: groups of links under headings (each link an icon tile, a name and, when given, a one-line note) and a pinboard on the
// right with two taped photos, like the home page. Styles: public/home.css, "Header menus".
// item(): svg is the icon's markup; note '' shows the name only
const item = (href, svg, name, note = '') => `<a href="${esc(href)}"><span class="r-ic">${svg}</span><span class="r-tx"><b>${esc(name)}</b>${note ? `<small>${esc(note)}</small>` : ''}</span></a>`;
const group = (title, href, items) => `<div class="r-group">${href ? `<a class="r-head" href="${esc(href)}">${esc(title)}</a>` : `<p class="r-head">${esc(title)}</p>`}${items.join('')}</div>`;
// board(): { title, hand (the handwritten note), pins: [{ href, img, title, meta }], more: [href, text] }; no pins, no board
const board = (b) => (b && b.pins.length ? `<div class="r-board"><p class="r-board-h">${esc(b.title)} <span class="r-hand">${esc(b.hand)}</span></p>${b.pins.map((p) => `<a class="r-pin" href="${esc(p.href)}"><span class="r-photo">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" width="320" height="180">` : `<span class="r-nophoto">${icon('book')}</span>`}</span><b>${esc(p.title)}</b><small>${esc(p.meta)}</small></a>`).join('')}${b.more ? `<a class="r-more" href="${esc(b.more[0])}">${esc(b.more[1])}</a>` : ''}</div>` : '');
// cls: 'r-names' for name-only menus (tighter rows); current: the button is marked as the page you're on
// cols: how many groups sit side by side (default: all of them, at most 4)
function dropMenu({ id, label, current = false, groups, pinboard, cls = '', cols = Math.min(groups.length, 4) }) {
  const bd = board(pinboard);
  return `<div class="h-menu"><button type="button" class="h-menu-btn" aria-expanded="false" aria-controls="${id}"${current ? ' aria-current="page"' : ''}>${esc(label)}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
<div class="h-drop h-drop-cols${cls ? ' ' + cls : ''}" id="${id}" hidden><div class="r-wrap${bd ? '' : ' r-noboard'}"><div class="r-groups" style="--cols:${cols}">${groups.join('')}</div>${bd}</div></div></div>`;
}

// the Resources menu: free tools, learning and comparisons, with the two newest guides pinned up
const TOOL_NOTES = { '/tools/pricing-calculator': 'Work out what to charge for a job', '/tools/invoice-generator': 'A PDF invoice with your logo, in a minute',
  '/tools/estimate-template': 'Line by line, with a deposit and signature', '/tools/google-review-qr-code': 'Turn happy clients into Google reviews' };
function menu() {
  const ic = icon;
  const groups = [
    group('Free tools', '/tools', tools().map((t) => item(t.path, ic(t.icon), t.short, TOOL_NOTES[t.path] || ''))),
    group('Learn', '/guides', [item('/guides', ic('book'), 'Guides', 'Pricing, marketing and running the business'), item(helpUrl(), ic('help'), 'Help center', 'Step-by-step how-tos for the app'),
      item(changelogUrl(), ic('sparkle'), 'What’s new', 'Every new feature, as it ships'), item('/compare', ic('sliders'), 'Compare', 'How we stack up, with real prices')]),
  ]; // competitors aren't named in the menu or footer, only on /compare itself
  // the two newest guides (with a photo when the guide or its trade has one)
  let pins = [];
  try { const g = require('./guides'); pins = g.published().slice(0, 2).map((x) => ({ href: `/guides/${x.slug}`, img: (g.heroOf(x) || {}).src, title: x.title, meta: `${g.readMinutes(x)} min read` })); } catch { /* guides not set up */ }
  return dropMenu({ id: 'resources-menu', label: 'Resources', groups, cols: 3, pinboard: { title: 'Fresh guides', hand: 'new every week', pins, more: ['/guides', 'All guides →'] } });
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
        ${tel || mail ? `<div><p class="h-foot-h">Contact us</p><p class="h-foot-contact">${tel}${mail}</p></div>` : ''}
        ${nets.length ? `<div><p class="h-foot-h">Follow along</p><p class="h-foot-social">${nets.map((k) => `<a href="${esc(social[k])}" target="_blank" rel="noopener me" aria-label="${product()} on ${SOCIAL[k]}" title="${SOCIAL[k]}">${lineIcon(k === 'kickstarter' ? KICKSTARTER : ICON[k])}</a>`).join('')}</p></div>` : ''}
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
        ${col('Resources', [['/guides', 'Guides'], [helpUrl(), 'Help center'], ['/compare', 'Compare'],partnersOn && ['/partners', 'Creator partners'], ['/sign-in', 'Log in']])}
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

module.exports = { menu, footer, fill, dropMenu, item, group };
