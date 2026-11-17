// Comparison pages (/compare and /compare/<slug>): "Jobber alternative", "Worklio Pro vs Housecall Pro" and so on, written for people
// searching for a cheaper or simpler app than the one they have. Served by the platform site (lib/platform.js) in the industry pages' shell.
// Rules for the wording:
// - Only claim features the app has, and say which plan they're on (lib/tenancy.js CORE / ADVANCED; the rest are Unlimited only).
// - Competitor prices: monthly list prices from each company's own pricing page (public/site.js RIVALS uses the same numbers). Recheck
//   them before changing CHECKED, and don't say what a competitor lacks: say what we have. Each page has an honest "may fit better" part.
// - Our prices come live from the plans in Alpha → Pricing, so they follow any price change.
const tenancy = require('./tenancy');
const industries = require('./industries');

const CHECKED = 'November 2026';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const productName = () => tenancy.platform().settings.productName || 'Worklio Pro';
const product = () => esc(productName());
const fill = (s) => String(s).replace(/\{p\}/g, product());

// crews: their monthly price for 1, 5 and 10 users, with the plan it takes ([price, note]); null when they only quote prices
const RIVALS = [
  { slug: 'jobber', name: 'Jobber', blurb: 'The same quotes, scheduling and invoicing, from {p}’s lower monthly price.',
    lead: 'Jobber is a solid field service app, and it’s priced like one: $49 a month for one user and $199 for a team of five. {p} does the day-to-day work your business runs on, quotes, scheduling, invoices and payments, for a lot less each month.',
    crews: [[49, 'Core, 1 user'], [199, 'Connect, 5 users'], [299, 'Connect, 10 users']],
    fit: 'Jobber has been around since 2011 and has a large app marketplace and a native phone app. If you rely on a specific integration we don’t have, or on Jobber’s customer financing, staying may make sense.',
    faq: [['Can I move my clients over from Jobber?', 'Yes. Jobber lets you export your clients, quotes, jobs and invoices as spreadsheets. Ask us about bringing your history over, or import your client list yourself from a CSV file on the Advanced and Unlimited plans.'],
      ['Is {p} as easy to use as Jobber?', 'It’s built around the same steps: quote, schedule, do the work, get paid. Everyone signs in from a browser on any phone or computer, so there’s nothing to install for your crew.']] },
  { slug: 'housecall-pro', name: 'Housecall Pro', blurb: 'Quotes, dispatch and payments for less than Housecall Pro’s entry plan.',
    lead: 'Housecall Pro starts at $79 a month for one user and $189 for five. {p} covers quoting, scheduling, your crew in the field, invoicing and card payments, with plans starting at a fraction of that.',
    crews: [[79, 'Basic, 1 user'], [189, 'Essentials, 5 users'], [399, 'MAX, 8 users + 2 at $35']],
    fit: 'Housecall Pro has extras like customer financing and a two-way texting inbox. If those are central to how you work, it may still be the better fit.',
    faq: [['Can I move my clients over from Housecall Pro?', 'Yes. Export your customers, jobs and invoices from Housecall Pro as spreadsheets. Ask us about bringing your history over, or import your client list yourself from a CSV file on the Advanced and Unlimited plans.'],
      ['Does {p} have Good / Better / Best quotes like Housecall Pro?', 'Yes, on the Advanced and Unlimited plans. Put 2 or 3 options on one quote, each with its own line items and total, and the client picks one when they approve and sign.']] },
  { slug: 'workiz', name: 'Workiz', blurb: 'Prices on our website, not behind a sales call.',
    lead: 'Workiz no longer lists its prices; you get a quote from its sales team. {p}’s prices are on our pricing page, you can start a 30-day trial without talking to anyone, and there’s no contract.',
    crews: null,
    fit: 'Workiz has a built-in business phone system with call tracking and recording. If phone calls are the center of your business and you want that in the same app, Workiz may suit you better.',
    faq: [['Can I move my clients over from Workiz?', 'Yes. Export your clients and jobs from Workiz as spreadsheets. Ask us about bringing your history over, or import your client list yourself from a CSV file on the Advanced and Unlimited plans.'],
      ['Do I have to talk to sales to get started?', 'No. Pick a plan on the pricing page and start your free 30-day trial. No credit card needed, no demo call.']] },
  { slug: 'servicetitan', name: 'ServiceTitan', blurb: 'Field service software sized for a small crew, not a call center.',
    lead: 'ServiceTitan is built for large contractors, with pricing by quote and a long onboarding. If you run a small or growing crew, {p} gives you quotes, scheduling, dispatch, invoicing and payments, set up the same day, at a price on our website.',
    crews: null,
    fit: 'ServiceTitan is made for companies with dozens of technicians: call center tools, inventory and purchase orders, payroll and marketing attribution at scale. If that’s you, it’s built for exactly that.',
    faq: [['Is {p} only for small businesses?', 'It’s made for owner-operators and crews up to a few dozen people. The Unlimited plan has no limit on logins, plus a dispatch map, time tracking, automations and job profit.'],
      ['Can I move my clients over from ServiceTitan?', 'Yes. Export your customers and jobs as spreadsheets. Ask us about bringing your history over, or import your client list yourself from a CSV file on the Advanced and Unlimited plans.']] },
];
const BY_SLUG = Object.fromEntries(RIVALS.map((r) => [r.slug, r]));

// what you get with us, true on every comparison page (plans from lib/tenancy.js)
const REASONS = [
  ['quote', 'Quotes clients sign online', 'Build quotes from your saved prices; clients approve, sign and pay a deposit from their phone. Good / Better / Best options on Advanced and up.'],
  ['calendar', 'Scheduling, recurring jobs and a crew app', 'One calendar for the whole team, jobs that repeat on their own, and the job details on each person’s phone. Nothing to install.'],
  ['card', 'Get paid your way', 'Invoices with Zelle, Venmo, Cash App and PayPal links on every plan, and card payments into your own Stripe account on Advanced and up.'],
  ['camera', 'Every job markets itself', 'Finished-job photos become a ready-to-post social post with a caption written for you. Approve it and it goes to Facebook, Instagram and Google (Advanced and up).'],
  ['chart', 'Reports and QuickBooks or Xero', 'Over 20 reports, expenses, and invoices and payments sent to QuickBooks Online or Xero automatically (Advanced and up).'],
  ['repeat', 'Your price stays your price', 'No contract, and if our prices go up, customers already on a plan keep the price they signed up at for as long as they stay on it.'],
];
const ICONS = { quote: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>',
  repeat: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>' };
const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;

// our cheapest monthly price for a crew of n, from the plans on sale: [price, note]
function ours(n) {
  const plans = tenancy.platform().plans.filter((p) => !p.hidden && Number(p.monthly) > 0);
  const options = plans.map((p) => {
    const max = Number(p.maxUsers) || 0; const extra = Number(p.extraUser) || 0;
    if (max && n > max && !extra) return null;
    const more = max && n > max ? n - max : 0;
    return [Number(p.monthly) + more * extra, `${p.name}, ${max ? (more ? `${max} users + ${more} at $${extra}` : `${n === 1 ? '1 user' : `up to ${max} users`}`) : 'no user limit'}`];
  }).filter(Boolean).sort((a, b) => a[0] - b[0]);
  return options[0] || null;
}
const money = (n) => '$' + Number(n).toLocaleString('en-US');

function priceTable(r) {
  if (!r.crews) return '';
  const rows = [1, 5, 10].map((n, i) => { const us = ours(n); const them = r.crews[i]; if (!us) return '';
    const save = them[0] - us[0];
    return `<tr><th scope="row">${n === 1 ? 'Just you' : `${n} people`}</th><td><b>${money(us[0])}</b><span>${esc(us[1])}</span></td><td><b>${money(them[0])}</b><span>${esc(them[1])}</span></td><td class="cmp-save">${save > 0 ? `${money(save * 12)}/yr` : '—'}</td></tr>`; }).join('');
  return `
    <section class="h-sec" style="padding-top:0"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">Price, side by side</span><h2>What you’d pay each month</h2><p>Monthly billing, list prices. Yearly billing is cheaper with both.</p></div>
      <div class="cmp-wrap"><table class="cmp-table">
        <thead><tr><th scope="col">Team size</th><th scope="col">${product()}</th><th scope="col">${esc(r.name)}</th><th scope="col">You save</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="cmp-note">${esc(r.name)} prices are from its own pricing page, checked ${CHECKED}. Features differ between plans, so compare what you need. <a href="/pricing">See all ${product()} plans</a></p>
    </div></section>`;
}

const card = (r) => `<a class="cmp-card" href="/compare/${r.slug}"><b>${product()} vs ${esc(r.name)}</b><span>${fill(r.blurb)}</span><span class="cmp-go">Compare →</span></a>`;
const disclaimer = (names) => `<p class="cmp-note cmp-legal">${esc(names)} ${names.includes(',') ? 'are trademarks of their owners' : 'is a trademark of its owner'}. ${product()} is not affiliated with ${names.includes(',') ? 'them' : 'it'}. Prices and features change, so check their websites for the latest.</p>`;

function indexPage() {
  return industries.shell({ head: require('./seo').compareHead(),
    body: `
    <section class="h-hero"><div class="h-wrap i-hero-solo">
      <span class="h-eyebrow">Compare</span>
      <h1>Looking for a <em>simpler, lower-cost</em> field service app?</h1>
      <p class="lead">See how ${product()} compares with the apps you may be using now, on price and on what a small service business needs every day.</p>
    </div></section>
    <section class="h-sec" style="padding-top:24px"><div class="h-wrap"><div class="cmp-cards">${RIVALS.map(card).join('')}</div>
      ${disclaimer(RIVALS.map((r) => r.name).join(', '))}
    </div></section>` });
}

function page(slug) {
  const r = BY_SLUG[slug]; if (!r) return null;
  const seo = require('./seo');
  const faq = [...r.faq, ['Is there a free trial?', `Yes. Every plan is free for 30 days, with no credit card needed. If it isn’t for you, there’s nothing to cancel.`]];
  const others = RIVALS.filter((x) => x !== r);
  return industries.shell({ head: seo.rivalHead(r, faq.map(([q, a]) => [fill(q), seo.plain(fill(a))])),
    body: `
    <section class="h-hero"><div class="h-wrap i-hero-solo">
      <nav class="i-crumbs" aria-label="Breadcrumb" style="justify-content:center"><a href="/compare">Compare</a><span aria-hidden="true">/</span><span aria-current="page">${esc(r.name)}</span></nav>
      <span class="h-eyebrow">${esc(r.name)} alternative</span>
      <h1>${product()} vs ${esc(r.name)}</h1>
      <p class="lead">${fill(r.lead)}</p>
      <div class="h-ctas" style="justify-content:center"><a class="btn" href="/pricing" data-trial>Start your free 30-day trial</a><a class="btn alt" href="/features">See every feature</a></div>
      <ul class="h-ticks" style="justify-content:center"><li>Free for 30 days</li><li>No credit card needed</li><li>No contract</li></ul>
    </div></section>
${priceTable(r)}
    <section class="h-sec"${r.crews ? ' style="padding-top:0"' : ''}><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">Why businesses switch</span><h2>Everything you use every day, for less</h2></div>
      <div class="i-helps">${REASONS.map(([k, t, d], n) => `<div class="h-feat"><div class="ic c${(n % 5) + 1}">${icon(k)}</div><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
    </div></section>

    <section class="h-sec" style="padding-top:0"><div class="h-wrap">
      <div class="cmp-fit"><h2>When ${esc(r.name)} may fit better</h2><p>${esc(r.fit)}</p><p>For most owner-operators and small crews who quote, schedule, invoice and get paid, ${product()} does the job for less.</p></div>
    </div></section>

    <section class="h-sec h-steps-bg"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">Switching</span><h2>Moving from ${esc(r.name)} takes an afternoon</h2></div>
      <div class="h-steps">${[['Start your trial', 'Pick a plan and set up your account in minutes. Free for 30 days.'], ['Bring your clients', `Export your list from ${r.name} and import it, or ask us to move your history over.`], ['Add your prices', 'Save your products and services once, then build quotes from them in a couple of taps.'], ['Invite your crew', 'Each person signs in from their phone’s browser. Nothing to install.']].map(([h, d]) => `<div class="h-step"><h3>${esc(h)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
    </div></section>

    <section class="h-sec"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">Questions</span><h2>${product()} vs ${esc(r.name)} FAQ</h2></div>
      <div class="h-faq">${faq.map(([q, a]) => `<details><summary>${fill(esc(q))}</summary><p>${fill(esc(a))}</p></details>`).join('')}</div>
      ${disclaimer(r.name)}
    </div></section>

    <section class="h-sec" style="padding-top:0"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">More comparisons</span><h2>Also comparing</h2></div>
      <div class="cmp-cards">${others.map(card).join('')}</div>
    </div></section>` });
}

module.exports = { RIVALS, CHECKED, indexPage, page, ours };
