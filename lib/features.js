// The "Features" menu in the header of the public pages: the 15 features on /features (public/features.html), each linking to its section.
// Same markup and styles as the Industries menu (lib/industries.js, public/menu.js). Keep the anchors in step with the section ids in features.html.
const FEATURES = [
  ['quotes', '📝', 'Quotes'], ['approvals', '✍️', 'Online approvals'], ['scheduling', '📅', 'Scheduling'], ['jobs', '🧰', 'Job management'], ['mobile', '📱', 'Crew app'],
  ['invoicing', '🧾', 'Invoicing'], ['payments', '💳', 'Online payments'], ['portal', '🏠', 'Client portal'], ['booking', '🗓️', 'Online booking'], ['clients', '👥', 'Client manager'],
  ['photos', '📷', 'Project gallery'], ['team', '👷', 'Team management'], ['services', '🏷️', 'Products & services'], ['expenses', '⛽', 'Expense tracking'], ['reports', '📊', 'Reports'],
];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// current: on the features page itself, so the button is marked as the page you're on
const menu = (current = false) => `<div class="h-menu"><button type="button" class="h-menu-btn" aria-expanded="false" aria-controls="features-menu"${current ? ' aria-current="page"' : ''}>Features<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
<div class="h-drop" id="features-menu" hidden><div class="h-drop-grid">${FEATURES.map(([id, emoji, name]) => `<a href="/features#${id}"><span aria-hidden="true">${emoji}</span>${esc(name)}</a>`).join('')}</div><a class="h-drop-all" href="/features">See all features →</a></div></div>`;
// a static page's <!--features-menu--> (or <!--features-menu:current--> on /features) becomes the menu
const fill = (html) => html.replace(/<!--features-menu(:current)?-->/g, (m, cur) => menu(!!cur));

module.exports = { FEATURES, menu, fill };
