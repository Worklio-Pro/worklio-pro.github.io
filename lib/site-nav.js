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

// the header's Resources menu: same markup as the Features and Industries menus (public/menu.js opens it)
function menu() {
  const items = [
    ['/guides', 'book', 'Guides'],
    ...tools().map((t) => [t.path, t.icon, t.short]),
    ['/compare', 'sliders', 'Compare'],
    [helpUrl(), 'help', 'Help center'],
    [changelogUrl(), 'sparkle', 'What’s new'],
  ];
  return `<div class="h-menu"><button type="button" class="h-menu-btn" aria-expanded="false" aria-controls="resources-menu">Resources<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
<div class="h-drop" id="resources-menu" hidden><div class="h-drop-grid">${items.map(([href, ic, name]) => `<a href="${esc(href)}"><span>${icon(ic)}</span>${esc(name)}</a>`).join('')}</div><a class="h-drop-all" href="/tools">See all free tools →</a></div></div>`;
}

// the trades named in the footer (the rest are one click away on /industries)
const FOOT_INDUSTRIES = ['hvac', 'plumbing', 'electrical', 'lawn-care', 'house-cleaning', 'roofing', 'pest-control', 'painting'];

function footer() {
  const ind = require('./industries');
  const byslug = Object.fromEntries(ind.INDUSTRIES.map((i) => [i.slug, i]));
  const col = (title, links) => `<div><p class="h-foot-h">${title}</p><ul>${links.filter(Boolean).map(([href, name]) => `<li><a href="${esc(href)}">${esc(name)}</a></li>`).join('')}</ul></div>`;
  let partnersOn = false; try { partnersOn = require('./partners').program().enabled; } catch { /* not set up */ }
  const supporters = require('./supporters').footerLink();
  return `<footer class="h-foot h-foot-big"><div class="h-wrap">
    <div>
      <div class="h-foot-about"><b class="pname">${product()}</b><p>Quotes, scheduling, invoicing and payments for field service businesses, from solo pros to full crews.</p></div>
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
