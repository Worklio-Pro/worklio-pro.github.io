// The Free tools page (/tools): every free tool on the public site, then a "Your industry" picker that points the per-industry tools at that industry's versions. Linked from the public
// footers (not the main menu). A new free tool goes in TOOLS here, in lib/seo.js (PAGES, RECOMMENDED, its head and the sitemap)
// and in lib/platform.js (its route).
const tenancy = require('./tenancy');
const industries = require('./industries');
const icons = require('./icons');
const calculator = require('./calculator');

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

    <section class="h-sec" style="padding-top:24px"><div class="h-wrap"><div class="ft-pick">
      <label class="ft-pick-row"><span>Show the tools for</span><select id="ft-industry"><option value="">Any industry</option>${industries.CHOICES.filter((c) => c.slug !== 'other').map((c) => `<option value="${c.slug}">${esc(c.name)}</option>`).join('')}</select></label>
      <div class="ft-cards">${TOOLS.map((t) => `<a class="ft-card" href="${t.path}"${t.perTrade ? ` data-base="${t.path}"` : ''}><span class="ft-ic">${icon(t.icon)}</span><b>${esc(t.name)}</b><span>${esc(t.text)}</span>${t.perTrade ? '<small class="ft-pick-ex" hidden></small>' : ''}<em>Open the tool →</em></a>`).join('')}</div>
    </div></div></section>
    <script>
      // "Show the tools for": points the per-industry tools at that industry's versions and says which example job they start with
      (function () {
        var JOBS = ${JSON.stringify(Object.fromEntries(industries.INDUSTRIES.map((i) => [i.slug, [i.name.replace(/\b[A-Z][a-z]/g, (w) => w.toLowerCase()), (calculator.TRADES[i.slug] || {}).job || '']])))};
        var pick = document.getElementById('ft-industry'); if (!pick) return;
        function show() {
          var s = pick.value, j = JOBS[s];
          document.querySelectorAll('.ft-pick .ft-card[data-base]').forEach(function (a) {
            var ex = a.querySelector('.ft-pick-ex');
            a.href = a.getAttribute('data-base') + (j ? '/' + s : '');
            ex.hidden = !(j && j[1]); ex.textContent = j && j[1] ? j[0].charAt(0).toUpperCase() + j[0].slice(1) + ' example: ' + j[1].charAt(0).toLowerCase() + j[1].slice(1) : '';
          });
          try { localStorage.setItem('ft-industry', s); } catch (e) {}
        }
        try { var saved = localStorage.getItem('ft-industry'); if (saved && JOBS[saved]) pick.value = saved; } catch (e) {}
        pick.addEventListener('change', show); show();
      })();
    </script>`;
  return industries.shell({ head: require('./seo').toolsHead(), body: html });
}

module.exports = { TOOLS, page };
