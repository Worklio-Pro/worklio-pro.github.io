// The "Features" menu in the header of the public pages: the 23 features on /features (public/features.html), each linking to its section,
// and Good / Better / Best quotes, Every job markets itself and Snap to quote, which have their own pages.
// Laid out like the Resources and Industries menus (lib/site-nav.js dropMenu(), public/menu.js): three groups, each feature with a one-line note,
// and the newest features pinned up on the right. Keep the anchors in step with the section ids in features.html.
// [section id, icon, name, note] (team-location is a line inside the Team management section): icons from the app's menu library (lib/icons.js), so the menu matches the app's sidebar
const FEATURES = [
  ['quotes', 'document', 'Quotes', 'Built from your price list in minutes'], ['approvals', 'pen', 'Online approvals', 'Clients sign and pay the deposit on their phone'],
  ['scheduling', 'calendar', 'Scheduling', 'One calendar for the whole crew'], ['jobs', 'briefcase', 'Job management', 'Every visit, note and photo in one place'],
  ['mobile', 'phone', 'Crew app', 'The day’s jobs on every tech’s phone'], ['invoicing', 'receipt', 'Invoicing', 'Turn a finished job into an invoice'],
  ['payments', 'card', 'Online payments', 'Clients pay by card from the invoice'], ['portal', 'home2', 'Client portal', 'Quotes, invoices and visits in one link'],
  ['booking', 'calendarCheck', 'Online booking', 'New clients request work online'], ['clients', 'users', 'Client manager', 'Contacts, properties and job history'],
  ['photos', 'image', 'Project gallery', 'Before & after photos of your work'], ['team', 'contact', 'Team management', 'Roles, permissions and pay rates'],
  ['team-location', 'map', 'Team location', 'See where your crew is'], ['services', 'tag', 'Products & services', 'Your price list, ready for every quote'],
  ['expenses', 'wallet', 'Expense tracking', 'Costs and receipts on each job'], ['reports', 'barChart', 'Reports', 'Revenue, jobs and team productivity'],
  ['recurring', 'refresh', 'Recurring jobs', 'Weekly, monthly or your own schedule'], ['service-plans', 'award', 'Service plans', 'Maintenance plans with repeat visits'],
  ['dispatch', 'route', 'Dispatch map & routes', 'The day’s jobs on a map'], ['timesheets', 'timer', 'Time tracking', 'Clock in and out from the job'],
  ['automations', 'autoPlay', 'Automations', 'Reminders and follow-ups sent for you'], ['accounting', 'calculator', 'Job profit & QuickBooks', 'Profit per job, synced to your books'],
  ['checklists', 'checklist', 'Checklists & forms', 'The same steps on every job'], ['languages', 'globe', 'Languages', 'Quotes in your client’s language'],
  ['/good-better-best', 'layers', 'Good / Better / Best quotes', 'Two or three options on one quote'], ['/marketing', 'megaphone', 'Every job markets itself', 'Finished jobs become social posts'],
  ['/quote-from-photos', 'camera', 'Snap to quote', 'Photos in, a drafted quote out'], // their own pages
];
// the menu's groups, by id (a feature in no group lands in the last one)
const GROUPS = [
  ['Win the work', ['quotes', '/good-better-best', '/quote-from-photos', 'approvals', 'booking', 'portal', 'languages']],
  ['Run the day', ['scheduling', 'jobs', 'mobile', 'dispatch', 'recurring', 'checklists', 'timesheets']],
  ['Get paid', ['invoicing', 'payments', 'service-plans', 'services', 'expenses', 'accounting', 'reports']],
  ['Grow', ['clients', 'team', 'team-location', 'automations', 'photos', '/marketing']],
];
// pinned up on the right: the newest features, with a photo from their pages
const NEWEST = [['/quote-from-photos', '/img/snap/card-plumber.jpg'], ['/good-better-best', '/img/gbb/roofing.jpg']];
const icons = require('./icons');
const PHONE = '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>'; // the crew app: not in the menu library
const icon = (k) => icons.svg(k === 'phone' ? PHONE : icons.LIBRARY[k][1]);
const href = (id) => (id.startsWith('/') ? id : `/features#${id}`);
const BY_ID = Object.fromEntries(FEATURES.map((f) => [f[0], f]));

// current: on the features page itself, so the button is marked as the page you're on
function menu(current = false) {
  const nav = require('./site-nav');
  const seen = new Set(GROUPS.flatMap(([, ids]) => ids)); const rest = FEATURES.map((f) => f[0]).filter((id) => !seen.has(id));
  const groups = GROUPS.map(([title, ids], n) => nav.group(title, '',[...ids, ...(n === GROUPS.length - 1 ? rest : [])].map((id) => BY_ID[id]).filter(Boolean)
    .map(([id, ic, name, note]) => nav.item(href(id), icon(ic), name, note))));
  const pins = NEWEST.map(([id, img]) => BY_ID[id] && { href: id, img, title: BY_ID[id][2], meta: BY_ID[id][3] }).filter(Boolean);
  return nav.dropMenu({ id: 'features-menu', label: 'Features', current, groups, pinboard: { title: 'Just added', hand: 'fresh off the truck', pins, more: ['/features', 'See all features →'] } });
}
// a static page's <!--features-menu--> (or <!--features-menu:current--> on /features) becomes the menu
const fill = (html) => html.replace(/<!--features-menu(:current)?-->/g, (m, cur) => menu(!!cur));

module.exports = { FEATURES, menu, fill };
