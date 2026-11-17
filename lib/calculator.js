// Job pricing calculator (/tools/pricing-calculator and /tools/pricing-calculator/<industry slug>): a free tool for searches like
// "how much to charge for a water heater install" or "pressure washing pricing calculator". One page per trade in lib/industries.js,
// each with an example job filled in, a pricing tip for that trade and links to the trade's industry page and the free trial.
// The math runs in the browser (the script at the end of the page):
//   labor = crew × hours × wage; job cost = materials + other costs + labor; overhead = job cost × overhead %
//   price = (job cost + overhead) ÷ (1 − margin %), rounded up to the next $5; profit = price − job cost − overhead
// The example numbers are examples to change, not market rates: the page says so, and never states what a trade "usually" charges.
const tenancy = require('./tenancy');
const industries = require('./industries');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const product = () => esc(tenancy.platform().settings.productName || 'Worklio Pro');
const lower = (n) => n.replace(/\b[A-Z][a-z]/g, (w) => w.toLowerCase()); // 'Lawn care' → 'lawn care', 'HVAC' stays

// d: [materials $, other costs $, crew, hours each, wage $/hr, overhead %, profit margin %]; other: what "other costs" means for the trade
const TRADES = {
  hvac: { job: 'Replace a 3-ton AC condenser', d: [3200, 150, 2, 6, 32, 20, 30], other: 'Permit & refrigerant disposal',
    tip: 'Price installs as a flat package (equipment, labor, permit, haul-away) and repairs from a flat-rate price list, so techs aren’t quoting hourly at the kitchen table. Offer a Good / Better / Best choice of equipment on replacements.' },
  plumbing: { job: 'Replace a 50-gallon gas water heater', d: [900, 75, 1, 4, 35, 20, 30], other: 'Permit & haul-away',
    tip: 'Flat-rate pricing works well for repeat work like water heaters, toilets and faucets. Keep a trip or diagnostic fee for service calls, so the first hour is covered even when the client decides to wait.' },
  electrical: { job: 'Upgrade to a 200-amp panel', d: [1400, 250, 2, 8, 36, 20, 30], other: 'Permit & inspection',
    tip: 'Panel upgrades, EV charger installs and fixture swaps are good candidates for flat prices. Price in the permit and the time to meet the inspector, which are easy to forget on bigger jobs.' },
  'lawn-care': { job: 'Weekly mow, edge and blow on a ¼-acre lot', d: [3, 0, 2, 0.75, 20, 20, 25], other: 'Disposal fees',
    tip: 'Price recurring mowing per visit by lot size and time on site, then check it against your route: a cheaper yard next door to five others can earn more than a pricier one across town.' },
  'house-cleaning': { job: 'Standard clean, 3 bed / 2 bath', d: [10, 0, 2, 2.5, 19, 15, 25], other: 'Other costs',
    tip: 'Charge more for the first deep clean than for recurring visits, and price recurring visits by home size and frequency. Time a few real cleans before setting your rates.' },
  'commercial-cleaning': { job: 'Nightly office clean, 5,000 sq ft', d: [15, 0, 2, 2, 18, 15, 20], other: 'Other costs',
    tip: 'Commercial contracts are usually priced per visit or per month. Work out the time per visit, multiply by visits a month, and add supplies, so a monthly price still covers every night’s labor.' },
  roofing: { job: 'Re-roof 20 squares of asphalt shingle', d: [4200, 600, 4, 10, 28, 20, 25], other: 'Dumpster & permit',
    tip: 'Price roofs by the square, with tear-off layers, steep pitch and extra flashing as separate lines. Include the dumpster and disposal in every quote, not as a surprise at the end.' },
  'pest-control': { job: 'Quarterly general pest service', d: [12, 0, 1, 0.75, 22, 20, 35], other: 'Other costs',
    tip: 'Price the first service higher than recurring ones (it takes longer and uses more product), then sell recurring visits as a plan with a lower price per visit.' },
  'pool-service': { job: 'Weekly pool cleaning with chemicals', d: [15, 0, 1, 0.5, 20, 15, 30], other: 'Other costs',
    tip: 'Most pool routes are a flat monthly price. Watch chemical costs through the season and leave room in your margin for them, or bill chemicals separately.' },
  painting: { job: 'Repaint a 12 × 14 bedroom, walls and ceiling', d: [120, 0, 1, 7, 25, 15, 30], other: 'Other costs',
    tip: 'Most of the cost in painting is labor, so time is everything: count prep (patching, taping, moving furniture) and cleanup, not just the hours with a brush in hand.' },
  handyman: { job: 'Mount a TV and hang three shelves', d: [20, 0, 1, 2, 30, 15, 35], other: 'Other costs',
    tip: 'Set a minimum charge for small jobs so a 30-minute visit still covers the drive, and bundle small tasks into one visit with one price.' },
  'pressure-washing': { job: 'Wash a two-story house exterior', d: [25, 15, 1, 2.5, 22, 15, 35], other: 'Fuel & water',
    tip: 'Price by the square foot or by the surface (house, driveway, deck) with a minimum per visit. Offer add-ons like gutters or a driveway on the same visit, since you’re already set up.' },
  'window-cleaning': { job: 'Clean 25 windows, inside and out', d: [5, 0, 2, 2, 20, 15, 35], other: 'Other costs',
    tip: 'Price per window or per pane, with extra for second-story or hard-to-reach glass, screens and tracks. Offer a discount for recurring service to fill your calendar.' },
  'carpet-cleaning': { job: 'Clean four rooms and a hallway', d: [20, 15, 1, 2.5, 20, 15, 35], other: 'Fuel',
    tip: 'Price per room with a size limit, or per square foot for large areas, and list stairs, pet treatment and protector as add-ons. Set a minimum so small jobs cover the drive.' },
  'tree-care': { job: 'Remove a 40 ft tree and grind the stump', d: [0, 250, 3, 5, 25, 20, 30], other: 'Equipment & dump fees',
    tip: 'Tree work is priced by the job, so look hard at access, height and what’s underneath. Price stump grinding and haul-away as separate lines the client can choose.' },
  moving: { job: 'Two-bedroom local move', d: [60, 120, 3, 6, 20, 15, 25], other: 'Truck fuel',
    tip: 'Local moves are usually hourly per crew with a minimum. Quote the hours from a walkthrough or photos, and add packing materials, stairs and long carries as separate lines.' },
  remodeling: { job: 'Remodel a 5 × 8 bathroom', d: [6500, 700, 2, 60, 32, 20, 25], other: 'Dumpster & permit',
    tip: 'Break big jobs into phases with a deposit and progress payments, and keep allowances for finishes the client hasn’t picked yet, so the price doesn’t move under you.' },
  'decks-fencing': { job: 'Install 150 ft of 6 ft wood privacy fence', d: [3800, 200, 3, 16, 25, 20, 25], other: 'Equipment rental & disposal',
    tip: 'Price fences per linear foot and decks per square foot, with gates, stairs and removal of the old one as separate lines. Lumber prices move, so date your quotes.' },
  flooring: { job: 'Install 500 sq ft of luxury vinyl plank', d: [1600, 120, 2, 10, 26, 15, 30], other: 'Disposal',
    tip: 'Price per square foot for install, and list tear-out, subfloor prep, trim and moving furniture separately. Order and price about 10% extra material for cuts.' },
  'low-voltage': { job: 'Run eight Cat6 drops in an office', d: [450, 0, 2, 8, 28, 20, 35], other: 'Other costs',
    tip: 'Price per drop for standard runs, and quote harder runs (finished ceilings, long distances, firewalls) by the hour. A site walk before quoting avoids most surprises.' },
  networking: { job: 'Set up mesh Wi-Fi and two wired access points', d: [900, 0, 1, 5, 35, 20, 35], other: 'Other costs',
    tip: 'Sell the equipment and setup as a package, and offer a monthly support plan for updates and remote help. It turns one install into recurring income.' },
  'security-cameras': { job: 'Install four PoE cameras and an NVR', d: [1100, 0, 2, 6, 28, 20, 35], other: 'Other costs',
    tip: 'Quote Good / Better / Best camera packages, price each extra camera on its own line, and offer a yearly service plan for cleaning, checks and updates.' },
  'audio-video': { job: 'Mount a TV and install 5.1 surround sound', d: [900, 0, 2, 5, 28, 20, 35], other: 'Other costs',
    tip: 'Price mounting, wire concealment and calibration as separate lines so clients can choose, and package equipment with installation for a single total.' },
};
const GENERAL = { job: 'A typical job', d: [250, 0, 2, 4, 25, 15, 30], other: 'Other costs', tip: 'Start from your real costs, not what competitors charge: what you spend on materials, what you pay your crew, and what it costs to keep the business running. Then add the profit you want on top.' };

const FIELDS = [['mat', 'Materials', '$', 'Parts, equipment and supplies for this job'], ['other', null, '$', 'Anything else this job costs you'],
  ['crew', 'People on the job', '', ''], ['hours', 'Hours each', '', 'Include drive time and cleanup'], ['wage', 'Labor cost per hour', '$', 'What you pay each person, with payroll taxes'],
  ['oh', 'Overhead', '%', 'Insurance, vehicles, tools, software, office: as a % of the job’s cost'], ['margin', 'Profit margin', '%', 'Your profit as a share of the price']];

function calculator(t, slug) {
  const inputs = FIELDS.map(([id, label, unit, hint], n) => `<label class="calc-f"><span>${esc(label || t.other)}</span>
        <span class="calc-in">${unit === '$' ? '<i>$</i>' : ''}<input type="number" inputmode="decimal" min="0" step="any" id="c-${id}" value="${t.d[n]}">${unit === '%' ? '<i>%</i>' : ''}</span>${hint ? `<small>${esc(hint)}</small>` : ''}</label>`).join('');
  return `
      <div class="calc" id="calc">
        <form class="calc-form" onsubmit="return false"><p class="calc-ex">Example: <b>${esc(t.job)}</b>. Change the numbers to your own.</p><div class="calc-grid">${inputs}</div></form>
        <div class="calc-out" aria-live="polite">
          <span class="calc-k">Price to quote</span><b class="calc-price" id="c-price">—</b>
          <dl>
            <div><dt>Labor</dt><dd id="c-labor">—</dd></div><div><dt>Materials &amp; other</dt><dd id="c-direct">—</dd></div>
            <div><dt>Overhead</dt><dd id="c-ohv">—</dd></div><div class="calc-profit"><dt>Your profit</dt><dd id="c-profit">—</dd></div>
            <div><dt>Per hour of crew time</dt><dd id="c-hr">—</dd></div><div><dt>Markup on cost</dt><dd id="c-mu">—</dd></div>
          </dl>
          <a class="btn" href="/pricing${slug ? `?industry=${slug}` : ''}" data-trial>Send this as a quote, free for 30 days</a>
          <small>${product()} turns your prices into quotes clients sign and pay a deposit on, from their phone.</small>
        </div>
      </div>`;
}
const SCRIPT = `<script>
(() => {
  const v = (id) => Math.max(0, parseFloat(document.getElementById('c-' + id).value) || 0);
  const usd = (n) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const set = (id, s) => { document.getElementById('c-' + id).textContent = s; };
  function run() {
    const labor = v('crew') * v('hours') * v('wage'); const direct = v('mat') + v('other'); const cost = labor + direct;
    const oh = cost * v('oh') / 100; const margin = Math.min(v('margin'), 95) / 100; const full = cost + oh;
    const price = full > 0 ? Math.ceil(full / (1 - margin) / 5) * 5 : 0; const hrs = v('crew') * v('hours');
    set('price', usd(price)); set('labor', usd(labor)); set('direct', usd(direct)); set('ohv', usd(oh)); set('profit', usd(price - full));
    set('hr', hrs ? usd(price / hrs) : '—'); set('mu', full ? Math.round((price / full - 1) * 100) + '%' : '—');
  }
  document.getElementById('calc').addEventListener('input', run); run();
})();
</script>`;

const FAQ = (name) => [
  ['What’s the difference between margin and markup?', 'Markup is what you add on top of your cost; margin is the share of the final price that’s profit. A $100 cost marked up 30% sells for $130, but that’s only a 23% margin. To get a 30% margin you charge about $143 (a 43% markup). This calculator works from margin, so the profit you pick is the profit you keep.'],
  ['What counts as overhead?', 'Everything it costs to run the business that isn’t tied to one job: insurance, licenses, vehicles and fuel, tools, phones, software, marketing, an office and your own admin time. Add up a year of it and divide by a year of job costs to get your overhead percentage.'],
  [`How do I use this to price ${name ? lower(name) + ' ' : ''}jobs?`, `Time a few real jobs, put in what they actually cost, and see the price it gives. Save your common jobs as flat prices in a price list, so you quote the same way every time instead of working it out on site.`],
];

const tradeList = (current) => `<div class="calc-trades">${industries.INDUSTRIES.filter((i) => i.slug !== current).map((i) => `<a href="/tools/pricing-calculator/${i.slug}">${esc(i.name)}</a>`).join('')}</div>`;

function body(t, i) {
  const name = i ? i.name : ''; const faq = FAQ(name);
  return {
    faq,
    html: `
    <section class="h-hero"><div class="h-wrap i-hero-solo">
      ${i ? `<nav class="i-crumbs" aria-label="Breadcrumb" style="justify-content:center"><a href="/tools/pricing-calculator">Pricing calculator</a><span aria-hidden="true">/</span><span aria-current="page">${esc(name)}</span></nav>` : ''}
      <span class="h-eyebrow">Free tool</span>
      <h1>${i ? `${esc(name)} pricing calculator` : 'Job pricing calculator'}</h1>
      <p class="lead">Work out what to charge${i ? ` for a ${esc(lower(name))} job` : ''} from your real costs: materials, labor and overhead, plus the profit you want to keep.</p>
    </div></section>

    <section class="h-sec" style="padding-top:8px"><div class="h-wrap">${calculator(t, i && i.slug)}</div></section>

    <section class="h-sec" style="padding-top:0"><div class="h-wrap calc-read">
      <h2>How to price ${i ? `${esc(lower(name))} ` : ''}jobs</h2>
      <ol>
        <li><b>Add up the job’s cost.</b> Materials, anything else the job needs, and labor: the people on the job × their hours × what each one costs you an hour.</li>
        <li><b>Add your overhead.</b> The share of running the business this job should carry: insurance, vehicles, tools, software and the office.</li>
        <li><b>Add your profit.</b> Divide the full cost by (1 − your margin). For a 30% margin, divide by 0.7. That’s the price to quote.</li>
      </ol>
      <div class="cmp-fit"><h2>${i ? `Pricing tip for ${esc(lower(name))}` : 'Start from your costs'}</h2><p>${esc(t.tip)}</p></div>
    </div></section>

    <section class="h-sec"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">Questions</span><h2>Pricing FAQ</h2></div>
      <div class="h-faq">${faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
      ${i ? `<p class="i-more"><a href="/industries/${i.slug}">See how ${product()} helps ${esc(lower(name))} businesses →</a></p>` : ''}
    </div></section>

    <section class="h-sec" style="padding-top:0"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">More calculators</span><h2>${i ? 'Pricing calculators for other trades' : 'Pick your trade'}</h2>${i ? '' : '<p>Each one starts with an example job for that trade.</p>'}</div>
      ${tradeList(i && i.slug)}
    </div></section>
    ${SCRIPT}`,
  };
}

function indexPage() {
  const b = body(GENERAL, null); const seo = require('./seo');
  return industries.shell({ head: seo.calcHead(null, b.faq), body: b.html });
}
function page(slug) {
  const i = industries.INDUSTRIES.find((x) => x.slug === slug); const t = TRADES[slug]; if (!i || !t) return null;
  const b = body(t, i); const seo = require('./seo');
  return industries.shell({ head: seo.calcHead(i, b.faq), body: b.html });
}

module.exports = { TRADES, indexPage, page };
