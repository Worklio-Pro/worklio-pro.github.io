// The Free tools page (/tools): every free tool on the public site, and each trade's versions of them. Linked from the public
// footers (not the main menu). A new free tool goes in TOOLS here, in lib/seo.js (PAGES, RECOMMENDED, its head and the sitemap)
// and in lib/platform.js (its route).
const tenancy = require('./tenancy');
const industries = require('./industries');
const icons = require('./icons');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const product = () => esc(tenancy.platform().settings.productName || 'Worklio Pro');

// perTrade: the tool has a page for each trade at <path>/<industry slug>
const TOOLS = [
  { path: '/tools/pricing-calculator', icon: 'calculator', name: 'Job pricing calculator', short: 'Pricing calculator', perTrade: true,
    text: 'Work out what to charge from your materials, labor and overhead, plus the profit margin you want to keep.' },
  { path: '/tools/invoice-generator', icon: 'receipt', name: 'Invoice generator', short: 'Invoice template', perTrade: true,
    text: 'Make a professional invoice with your logo, line items and tax, then download it as a PDF to send or print.' },
  { path: '/tools/estimate-template', icon: 'clipboard', name: 'Estimate template', short: 'Estimate template', perTrade: true,
    text: 'Write an estimate with the work line by line, a deposit to start and a signature line, and save it as a PDF.' },
  { path: '/tools/google-review-qr-code', icon: 'star', name: 'Review link & QR code generator', short: 'Review QR code',
    text: 'Turn your Google review link into a QR code, a printable counter sign and business cards, so clients review you in one tap.' },
];
const icon = (k) => `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons.LIBRARY[k][1]}</svg>`;

function page() {
  const per = TOOLS.filter((t) => t.perTrade);
  const html = `
    <section class="h-hero"><div class="h-wrap i-hero-solo">
      <span class="h-eyebrow">Free tools</span>
      <h1>Free tools for service businesses</h1>
      <p class="lead">Price your jobs, send invoices and estimates, and get more reviews. Free to use, with no sign-up, made by the team behind ${product()}.</p>
    </div></section>

    <section class="h-sec" style="padding-top:24px"><div class="h-wrap">
      <div class="ft-cards">${TOOLS.map((t) => `<a class="ft-card" href="${t.path}"><span class="ft-ic">${icon(t.icon)}</span><b>${esc(t.name)}</b><span>${esc(t.text)}</span><em>Open the tool →</em></a>`).join('')}</div>
    </div></section>

    <section class="h-sec" style="padding-top:0"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">By industry</span><h2>Tools for your industry</h2><p>Each one starts with an example job for that industry, so you can see how it works before you put in your own numbers.</p></div>
      <div class="ft-trades">${industries.INDUSTRIES.map((i) => `<div class="ft-trade"><b>${esc(i.name)}</b><span>${per.map((t) => `<a href="${t.path}/${i.slug}">${esc(t.short)}</a>`).join('')}</span></div>`).join('')}</div>
    </div></section>`;
  return industries.shell({ head: require('./seo').toolsHead(), body: html });
}

module.exports = { TOOLS, page };
