// The "Features" menu in the header of the public pages: the 15 features on /features (public/features.html), each linking to its section.
// Same markup and styles as the Industries menu (lib/industries.js, public/menu.js). Keep the anchors in step with the section ids in features.html.
// [section id, icon, name]: icons from the app's menu library (lib/icons.js), so the menu matches the app's sidebar
const FEATURES = [
  ['quotes', 'document', 'Quotes'], ['approvals', 'pen', 'Online approvals'], ['scheduling', 'calendar', 'Scheduling'], ['jobs', 'briefcase', 'Job management'], ['mobile', 'phone', 'Crew app'],
  ['invoicing', 'receipt', 'Invoicing'], ['payments', 'card', 'Online payments'], ['portal', 'home2', 'Client portal'], ['booking', 'calendarCheck', 'Online booking'], ['clients', 'users', 'Client manager'],
  ['photos', 'image', 'Project gallery'], ['team', 'contact', 'Team management'], ['services', 'tag', 'Products & services'], ['expenses', 'wallet', 'Expense tracking'], ['reports', 'barChart', 'Reports'],
];
const icons = require('./icons');
const PHONE = '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>'; // the crew app: not in the menu library
const icon = (k) => icons.svg(k === 'phone' ? PHONE : icons.LIBRARY[k][1]);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// current: on the features page itself, so the button is marked as the page you're on
const menu = (current = false) => `<div class="h-menu"><button type="button" class="h-menu-btn" aria-expanded="false" aria-controls="features-menu"${current ? ' aria-current="page"' : ''}>Features<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
<div class="h-drop" id="features-menu" hidden><div class="h-drop-grid">${FEATURES.map(([id, ic, name]) => `<a href="/features#${id}"><span>${icon(ic)}</span>${esc(name)}</a>`).join('')}</div><a class="h-drop-all" href="/features">See all features →</a></div></div>`;
// a static page's <!--features-menu--> (or <!--features-menu:current--> on /features) becomes the menu
const fill = (html) => html.replace(/<!--features-menu(:current)?-->/g, (m, cur) => menu(!!cur));

module.exports = { FEATURES, menu, fill };
