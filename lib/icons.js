// Icons for the business app's menu (sidebar and phone menu). Alpha → Settings → Menu icons picks one for each link;
// the choices are stored in platform settings (navIcons) and apply to every account. Icons are drawn as SVG strokes
// on a 24×24 grid, so only these built-in shapes can be used (nothing uploaded runs in the app).
const tenancy = require('./tenancy');

const LIBRARY = {
  home: ['Home', '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>'],
  dashboard: ['Dashboard', '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'],
  calendar: ['Calendar', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'],
  calendarCheck: ['Calendar check', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M9 15l2 2 4-4"/>'],
  calendarX: ['Calendar off', '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M10 14l4 4M14 14l-4 4"/>'],
  clock: ['Clock', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
  plane: ['Plane', '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>'],
  inbox: ['Inbox', '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>'],
  users: ['People', '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>'],
  user: ['Person', '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'],
  contact: ['Contact card', '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17a3.5 3.5 0 0 1 7 0M15 10h3M15 14h3"/>'],
  document: ['Document', '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'],
  clipboard: ['Clipboard', '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>'],
  pen: ['Pen', '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'],
  briefcase: ['Briefcase', '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'],
  wrench: ['Wrench', '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>'],
  truck: ['Truck', '<path d="M1 4h13v12H1zM14 8h4l4 4v4h-8"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="17.5" cy="18.5" r="2"/>'],
  receipt: ['Receipt', '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>'],
  card: ['Card', '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'],
  dollar: ['Dollar', '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.3c0 3 6 1.7 6 4.7 0 1.3-1.3 2.5-3 2.5s-3-1.1-3-2.5M12 5.5v13"/>'],
  wallet: ['Wallet', '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M21 12h-6a2 2 0 0 0 0 4h6v-4z"/><path d="M3 7h16"/>'],
  tag: ['Tag', '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="8" cy="8" r="1.5"/>'],
  box: ['Box', '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>'],
  barChart: ['Bar chart', '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-9"/>'],
  trend: ['Trend', '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'],
  pie: ['Pie chart', '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>'],
  percent: ['Percent', '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>'],
  calculator: ['Calculator', '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>'],
  star: ['Star', '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>'],
  thumbsUp: ['Thumbs up', '<path d="M7 11v9H4v-9zM7 11l4-8a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 17.6 20H7"/>'],
  megaphone: ['Megaphone', '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>'],
  share: ['Share', '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'],
  image: ['Photo', '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'],
  camera: ['Camera', '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>'],
  bell: ['Bell', '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'],
  mail: ['Mail', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'],
  message: ['Message', '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/>'],
  list: ['List', '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'],
  folder: ['Folder', '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'],
  map: ['Map pin', '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'],
  home2: ['House', '<path d="M4 10l8-6 8 6v10H4z"/><path d="M10 20v-6h4v6"/>'],
  check: ['Check circle', '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'],
  shield: ['Shield', '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'],
  gear: ['Gear', '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'],
  sparkle: ['Sparkle', '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'],
};
// the business app's menu, in order, with each link's default icon (keep in step with NAV in public/app.js)
const LINKS = [
  ['/business-overview', 'Home', 'Operations', 'home'], ['/calendar', 'Job Calendar', 'Operations', 'calendar'], ['/staff-schedules', 'Staff Schedules', 'Operations', 'clock'],
  ['/requests', 'Requests', 'Operations', 'calendarX'], ['/clients', 'Clients', 'Operations', 'users'], ['/quotes', 'Quotes', 'Operations', 'document'], ['/jobs', 'Jobs', 'Operations', 'briefcase'],
  ['/invoices', 'Invoices', 'Operations', 'receipt'], ['/payments', 'Payments', 'Money', 'card'], ['/services', 'Products & Services', 'Money', 'tag'], ['/expenses', 'Expenses', 'Money', 'wallet'],
  ['/reports', 'Financial Reports', 'Money', 'barChart'], ['/tax-summary', 'Tax Summary', 'Money', 'percent'], ['/reviews', 'Reviews', 'Marketing', 'star'], ['/social-posts', 'Social Posts', 'Marketing', 'megaphone'],
  ['/project-gallery', 'Project Gallery', 'Records', 'image'], ['/notifications', 'Notifications Log', 'Records', 'bell'],
].map(([path, label, group, icon]) => ({ path, label, group, default: icon }));

const chosen = () => tenancy.platform().settings.navIcons || {};
const iconFor = (l) => (LIBRARY[chosen()[l.path]] ? chosen()[l.path] : l.default);
// for the business app: each menu link's icon drawing
const navIcons = () => Object.fromEntries(LINKS.map((l) => [l.path, LIBRARY[iconFor(l)][1]]));
// for Alpha
const view = () => ({ library: Object.entries(LIBRARY).map(([key, [label, d]]) => ({ key, label, d })), links: LINKS.map((l) => ({ ...l, icon: iconFor(l) })) });
function choose(path, icon) {
  if (!LINKS.some((l) => l.path === path)) throw Object.assign(new Error('Unknown menu link'), { status: 404 });
  if (icon && !LIBRARY[icon]) throw Object.assign(new Error('Choose one of the icons'), { status: 400 });
  const s = tenancy.platform().settings; s.navIcons = { ...(s.navIcons || {}) };
  if (!icon || icon === LINKS.find((l) => l.path === path).default) delete s.navIcons[path]; else s.navIcons[path] = icon; // the default isn't stored
  tenancy.savePlatform();
}
module.exports = { navIcons, view, choose };
