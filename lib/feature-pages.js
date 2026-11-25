// One page per feature at /features/<slug> (the text is in lib/feature-pages-content.js), and the overview's grid of them on /features.
// Like the guides (lib/guides.js), the pages take turns between four layouts, so going from one feature to the next never shows the same template twice:
//   stage: the title centered, the screenshot taped under it, and what's in it as a two-column checklist
//   split: the title beside the screenshot, and what's in it on a lined index card next to the Help Center links
//   band:  the screenshot on a colored band, the title on a card pinned over its bottom edge, and what's in it as sticky notes
//   paper: the title on a paper note, and what's in it as a numbered marker list beside the screenshot, which stays in view as you scroll
// Every page also has the plans it's on (from Alpha → Plans & features, so it can't go stale), its Help Center articles, the other features in
// its menu group, and previous / next links. public/features.css draws them.
const FEATURES = require('./feature-pages-content');
const menu = require('./features');
const tenancy = require('./tenancy');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const product = () => tenancy.platform().settings.productName || 'Worklio Pro';
const LAYOUTS = ['stage', 'split', 'band', 'paper'];
const CSS = '<link rel="stylesheet" href="/features.css?v=1">';

// per feature: the plan feature keys that switch it on (none: in every plan) and its Help Center articles
const META = {
  quotes: [['quotes'], ['create-send-quote', 'quote-options', 'quote-deposits', 'price-records']],
  approvals: [['quotes'], ['quote-to-job', 'quote-invoice-page', 'change-orders']],
  scheduling: [[], ['job-calendar', 'calendar-feed', 'site-visits']],
  jobs: [[], ['create-job', 'job-photos', 'job-signatures']],
  mobile: [[], ['using-on-phone', 'on-my-way']],
  invoicing: [['invoices'], ['create-send-invoice', 'batch-invoicing', 'late-fees']],
  payments: [['onlinePayments'], ['set-up-payments', 'stripe-card-payments', 'zelle', 'invoice-tips', 'record-payment']],
  portal: [['clientPortal'], ['client-portal']],
  booking: [['onlineBooking'], ['online-booking']],
  clients: [[], ['add-clients', 'client-profile', 'client-properties', 'import-clients', 'merge-clients']],
  photos: [['gallery'], ['job-photos']],
  team: [[], ['invite-team', 'access-levels', 'team-location', 'two-step-login']],
  services: [['services'], ['products-services', 'service-categories']],
  expenses: [['expenses'], ['expenses']],
  reports: [['reports'], ['financial-reports', 'tax-summary']],
  recurring: [['recurringJobs'], ['recurring-jobs']],
  'service-plans': [['servicePlans'], ['service-plans']],
  dispatch: [['dispatchMap'], ['dispatch-map']],
  timesheets: [['timesheets'], ['time-tracking', 'time-off']],
  automations: [['automations'], ['automations', 'appointment-reminders']],
  accounting: [['accounting'], ['profit', 'quickbooks-xero']],
  checklists: [['jobForms'], ['job-checklists']],
  languages: [[], ['client-languages']],
};
// a few words in marker beside each menu group on the overview
const GROUP_NOTES = { 'Win the work': 'from the first call to a signed quote', 'Run the day': 'the whole crew’s day, sorted', 'Get paid': 'money in, books square', Grow: 'more clients, a bigger crew' };

const bySlug = (slug) => FEATURES.find((f) => f.slug === slug);
const groupOf = (f) => (menu.GROUPS.find(([, ids]) => ids.includes(f.id)) || menu.GROUPS[menu.GROUPS.length - 1])[0];
const plainName = (f) => f.kicker.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');

// "In every plan", "On Advanced and Unlimited", or for a Marketing suite piece "On Unlimited, or with the Marketing add-on"
function planLine(f) {
  const keys = META[f.id][0]; if (!keys.length) return 'In every plan';
  const plans = tenancy.platform().plans.filter((p) => !p.hidden).sort((a, b) => Number(a.monthly || 0) - Number(b.monthly || 0));
  const on = plans.filter((p) => keys.every((k) => tenancy.usableFeatures(p.features || []).has(k)));
  const suite = keys.some((k) => (tenancy.FEATURES.find((x) => x.key === k) || {}).partOf === 'marketingSuite');
  if (on.length === plans.length) return 'In every plan';
  const names = on.map((p) => p.name); const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  if (!list) return suite ? 'With the Marketing add-on' : '';
  return `On ${list}${suite ? ', or with the Marketing add-on' : ''}`;
}
// its Help Center articles that still exist, with their titles
function helpLinks(f) {
  let articles = [];
  try { articles = require('./help-store').content().articles; } catch { articles = require('./help-content').articles; }
  const base = tenancy.helpUrl().replace(/\/+$/, '');
  return META[f.id][1].map((s) => articles.find((a) => a.slug === s)).filter(Boolean)
    .map((a) => `<li><a href="${esc(base)}/articles/${a.slug}">${esc(String(a.title).replace(/\{product\}/g, product()))}</a></li>`);
}

// the headline with a marker scribble under its last word or two (the house style from the home page and guides)
function titleHtml(f) {
  const t = f.headline; const m = t.match(/^(.*?)(\S+(?:\s\S+)?)([.!?]?)$/);
  if (!m) return t;
  const words = m[2].split(' ');
  const pick = words.length === 2 && words[1].length < 5 ? m[2] : words[words.length - 1];
  const at = t.lastIndexOf(pick);
  return `${t.slice(0, at)}<span class="scribble">${pick.replace(/[,.!?]$/, '')}</span>${pick.match(/[,.!?]$/) ? pick.slice(-1) : ''}${t.slice(at + pick.length)}`;
}
const badge = (b) => (b ? ` <span class="f-new">${esc(b)}</span>` : '');
const point = (p, n) => `<li${p.id ? ` id="${p.id}"` : ''}>${n != null ? `<i class="fp-n" aria-hidden="true">${n + 1}</i>` : '<i aria-hidden="true">✓</i>'}<span><b>${p.t}${badge(p.badge)}</b>${p.d}</span></li>`;
const CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';

function page(slug) {
  const f = bySlug(slug); if (!f) return null;
  const n = FEATURES.indexOf(f); const layout = LAYOUTS[n % LAYOUTS.length]; const group = groupOf(f);
  const prev = FEATURES[(n + FEATURES.length - 1) % FEATURES.length]; const next = FEATURES[(n + 1) % FEATURES.length];
  const plan = planLine(f); const help = helpLinks(f);
  const shot = (cls) => f.shot.replace(/^<figure( class="f-phone-wrap")?/, (m, phone) => `<figure class="fp-shot t${(n % 5) + 1}${phone ? ' f-phone-wrap' : ''} ${cls}"`);
  const titleBits = `<nav class="i-crumbs" aria-label="Breadcrumb"><a href="/features">Features</a><span aria-hidden="true">/</span><a href="/features#${esc(group.toLowerCase().replace(/\s+/g, '-'))}">${esc(group)}</a></nav>
        <span class="h-eyebrow">${f.kicker}${badge(f.badge)}</span>
        <h1>${titleHtml(f)}</h1>
        <p class="lead">${f.intro}</p>
        ${plan ? `<p class="fp-plan">${CHECK}${esc(plan)} · <a href="/pricing#compare">compare plans</a></p>` : ''}
        <div class="h-ctas"><a class="btn" href="/pricing" data-trial>Try it free for 30 days</a></div>`;
  const helpBox = (cls) => (help.length ? `<aside class="fp-help ${cls}"><b>How to set it up</b><ul>${help.join('')}</ul><small>Step by step in the Help Center</small></aside>` : '');
  const count = f.points.length;
  const body = {
    stage: `<header class="fp-head fp-stage h-wrap">${titleBits}</header>
      <div class="h-wrap fp-stage-shot">${shot('fp-tilt-l')}</div>
      <section class="h-wrap fp-sec"><h2 class="fp-h2">What’s in ${esc(plainName(f))}</h2>
        <div class="fp-stage-grid"><ul class="fp-checks">${f.points.map((p) => point(p)).join('')}</ul>${helpBox('fp-sticky')}</div></section>`,
    split: `<header class="fp-head fp-split h-wrap"><div>${titleBits}</div>${shot('fp-tilt-r')}</header>
      <section class="h-wrap fp-sec fp-split-low"><div class="fp-index"><h2>${count} things it does for you</h2><ul>${f.points.map((p) => point(p)).join('')}</ul></div>${helpBox('fp-plain')}</section>`,
    band: `<div class="fp-band t${(n % 5) + 1}"><div class="h-wrap">${shot('')}</div></div>
      <header class="fp-head fp-over h-wrap"><div class="fp-over-card">${titleBits}</div></header>
      <section class="h-wrap fp-sec"><h2 class="fp-h2 fp-hand">the good bits</h2><ul class="fp-notes">${f.points.map((p) => point(p)).join('')}</ul>${helpBox('fp-strip')}</section>`,
    paper: `<header class="fp-head fp-paper h-wrap"><div class="fp-paper-card">${titleBits}</div></header>
      <section class="h-wrap fp-sec fp-paper-low"><div><h2 class="fp-h2">How it works, point by point</h2><ol class="fp-steps">${f.points.map((p, i) => point(p, i)).join('')}</ol>${helpBox('fp-plain')}</div><div class="fp-pin">${shot('fp-tilt-r')}</div></section>`,
  }[layout];
  // the other features in its menu group (Good / Better / Best, Every job markets itself and Snap to quote included), then previous / next
  const ids = (menu.GROUPS.find(([t]) => t === group) || [, []])[1].filter((id) => id !== f.id && id !== 'team-location');
  const others = ids.map((id) => menu.BY_ID[id]).filter(Boolean).slice(0, 6)
    .map(([id, ic, name, note]) => `<a class="fp-mini" href="${esc(menu.href(id))}"><span class="r-ic">${menu.icon(ic)}</span><span><b>${esc(name)}</b><small>${esc(note)}</small></span></a>`).join('');
  const html = `
    <article class="fp fp-l-${layout}">
      ${body}
    </article>
    ${others ? `<section class="h-sec fp-more"><div class="h-wrap"><div class="h-sec-head"><span class="h-kicker">${esc(group)}</span><h2>Goes hand in hand with</h2></div><div class="fp-minis">${others}</div></div></section>` : ''}
    <nav class="h-wrap fp-pager" aria-label="More features"><a href="/features/${prev.slug}" rel="prev"><small>← Previous</small><b>${prev.kicker}</b></a><a class="fp-all" href="/features">All ${FEATURES.length} features</a><a href="/features/${next.slug}" rel="next"><small>Next →</small><b>${next.kicker}</b></a></nav>
    <dialog class="f-zoom" aria-label="Screenshot"><button type="button" aria-label="Close">×</button><img alt=""></dialog>
    <script>
      // click a screenshot to see it full size; click again, × or Esc to close
      (function () { var z = document.querySelector('.f-zoom'), zi = z.querySelector('img');
        document.querySelectorAll('.fp-shot img').forEach(function (img) { img.addEventListener('click', function () { zi.src = img.currentSrc || img.src; zi.alt = img.alt; z.showModal(); }); });
        z.addEventListener('click', function () { z.close(); }); })();
    </script>`;
  const seo = require('./seo');
  return require('./industries').shell({ head: seo.featureHead(f, plainName(f), group) + CSS, body: html });
}

// the overview's grid (public/features.html's <!--features-grid-->): the menu's groups, each feature a card linking to its page
function grid() {
  return menu.GROUPS.map(([title, ids]) => {
    const cards = ids.filter((id) => id !== 'team-location').map((id) => {
      const m = menu.BY_ID[id]; if (!m) return '';
      const f = FEATURES.find((x) => x.id === id);
      return `<a class="fx-card" href="${esc(menu.href(id))}"><span class="r-ic">${menu.icon(m[1])}</span><b>${esc(m[2])}${f ? badge(f.badge) : ' <span class="f-new">New</span>'}</b><span>${f ? f.headline : esc(m[3])}</span><small>${f ? esc(m[3]) : 'has its own page →'}</small></a>`;
    }).join('');
    return `<section class="fx-group" id="${esc(title.toLowerCase().replace(/\s+/g, '-'))}"><div class="fx-head"><h2>${esc(title)}</h2>${GROUP_NOTES[title] ? `<span class="fx-hand">${esc(GROUP_NOTES[title])}</span>` : ''}</div><div class="fx-cards">${cards}</div></section>`;
  }).join('');
}
// old links to a section of the long page (/features#quotes) go to the feature's own page
const OLD_ANCHORS = () => Object.fromEntries([...FEATURES.map((f) => [f.id, `/features/${f.slug}`]), ['team-location', '/features/team-management#team-location']]);
const fill = (html) => html.replace('<!--features-grid-->', grid())
  .replace('<!--features-anchors-->', `<script>(function () { var to = ${JSON.stringify(OLD_ANCHORS())}[location.hash.slice(1)]; if (to) location.replace(to); })();</script>`);
const sitemapPaths = () => FEATURES.map((f) => `/features/${f.slug}`);

module.exports = { FEATURES, LAYOUTS, page, grid, fill, sitemapPaths, planLine };
