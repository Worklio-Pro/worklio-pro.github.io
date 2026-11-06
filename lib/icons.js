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
  autoPlay: ['Play loop', '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M10 8.5v7l5.5-3.5z"/>'],
  // more choices (Nov 2026)
  grid: ['Grid', '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'],
  layers: ['Layers', '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'],
  activity: ['Activity', '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>'],
  route: ['Route', '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/>'],
  navigation: ['Navigation', '<path d="M3 11l19-9-9 19-2-8z"/>'],
  globe: ['Globe', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'],
  building: ['Building', '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M10 22v-4h4v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>'],
  store: ['Store', '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 11v10h14V11M10 21v-5h4v5"/>'],
  hammer: ['Hammer', '<path d="M15 12l-8.5 8.5a2.1 2.1 0 0 1-3-3L12 9"/><path d="M17.6 15L22 10.6 13.4 2 9 6.4z"/>'],
  tools: ['Toolbox', '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 13h20M10 12v3h4v-3"/>'],
  hardHat: ['Hard hat', '<path d="M4 17v-2a8 8 0 0 1 16 0v2"/><path d="M10 7.3V5h4v2.3"/><rect x="2" y="17" width="20" height="3" rx="1"/>'],
  bolt: ['Lightning', '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'],
  drop: ['Water drop', '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'],
  leaf: ['Leaf', '<path d="M5 21c.5-4.5 2.5-8 7-10"/><path d="M8.5 17.5C4 13 6 4 20 4c0 13-8 16-11.5 13.5z"/>'],
  tree: ['Tree', '<path d="M12 22v-7M9 18l3-3 3 3"/><path d="M7 15a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 15z"/>'],
  sun: ['Sun', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'],
  snowflake: ['Snowflake', '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 3l3 2 3-2M9 21l3-2 3 2"/>'],
  flame: ['Flame', '<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7z"/>'],
  paint: ['Paint roller', '<rect x="3" y="3" width="15" height="6" rx="2"/><path d="M18 6h3v5h-9v3"/><rect x="10" y="14" width="4" height="8" rx="1"/>'],
  brush: ['Brush', '<path d="M9.1 11.6L18 2.7a2 2 0 0 1 2.9 2.9l-8.9 8.9"/><path d="M7 14a3 3 0 0 0-3 3c0 1.5-1 2.5-2 3 4 1 9 0 9-4a3 3 0 0 0-4-2z"/>'],
  key: ['Key', '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M17 6l3 3M15 8l2 2"/>'],
  lock: ['Lock', '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'],
  phone: ['Phone', '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'],
  smartphone: ['Smartphone', '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>'],
  chat: ['Chat bubbles', '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>'],
  send: ['Send', '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>'],
  link: ['Link', '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'],
  heart: ['Heart', '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>'],
  award: ['Award', '<circle cx="12" cy="8" r="6"/><path d="M8.2 13L7 22l5-3 5 3-1.2-9"/>'],
  gift: ['Gift', '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>'],
  flag: ['Flag', '<path d="M4 22V4M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1"/>'],
  target: ['Target', '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'],
  rocket: ['Rocket', '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="M12 15l-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>'],
  lightbulb: ['Light bulb', '<path d="M9 18h6M10 22h4"/><path d="M15 14c.2-1 .7-1.7 1.5-2.5A6 6 0 1 0 6 8c0 1.5.5 2.5 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/>'],
  book: ['Book', '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>'],
  bookmark: ['Bookmark', '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'],
  archive: ['Archive', '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>'],
  files: ['Files', '<path d="M15 2H9a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7z"/><path d="M15 2v5h5M3 7v13a2 2 0 0 0 2 2h10"/>'],
  checklist: ['Checklist', '<path d="M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17M11 6h10M11 12h10M11 18h10"/>'],
  kanban: ['Board', '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/><path d="M5.5 7h1M11.5 7h1M17.5 7h1"/>'],
  timer: ['Timer', '<circle cx="12" cy="14" r="8"/><path d="M12 10v4l2 2M10 2h4"/>'],
  history: ['History', '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>'],
  refresh: ['Repeat', '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'],
  search: ['Search', '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'],
  filter: ['Filter', '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>'],
  sliders: ['Sliders', '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'],
  cart: ['Cart', '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/>'],
  bank: ['Bank', '<path d="M3 21h18M3 10h18M5 6l7-3 7 3M5 10v11M10 10v11M14 10v11M19 10v11"/>'],
  coins: ['Coins', '<circle cx="8" cy="8" r="6"/><path d="M18.1 10.4A6 6 0 1 1 10.3 18M7 6h1v4"/><path d="M16.7 13.9l.7.7-2.8 2.8"/>'],
  banknote: ['Cash', '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>'],
  package: ['Package', '<path d="M16.5 9.4L7.5 4.2"/><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>'],
  car: ['Car', '<path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><path d="M3 12h18"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M9.5 17h5"/>'],
  video: ['Video', '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/>'],
  monitor: ['Monitor', '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'],
  wifi: ['Wi-Fi', '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20h.01"/>'],
  cloud: ['Cloud', '<path d="M17.5 19H8a6 6 0 1 1 5.7-8h1.8a4.5 4.5 0 0 1 2 8.5z"/>'],
  database: ['Database', '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'],
  printer: ['Printer', '<path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="9" rx="2"/><path d="M6 14h12v8H6z"/>'],
  upload: ['Upload', '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'],
  download: ['Download', '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'],
  info: ['Info', '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>'],
  help: ['Help', '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>'],
  alert: ['Warning', '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'],
  eye: ['Eye', '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'],
  userPlus: ['Add person', '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>'],
  bug: ['Bug', '<path d="M9 7a3 3 0 0 1 6 0"/><rect x="7" y="7" width="10" height="14" rx="5"/><path d="M12 11v10M3 10l4 2M21 10l-4 2M2 15h5M17 15h5M3 20l4-2M21 20l-4-2"/>'],
  waves: ['Waves', '<path d="M2 7c2 0 2-1.5 4-1.5S8 7 10 7s2-1.5 4-1.5S16 7 18 7s2-1.5 4-1.5M2 12.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/>'],
};
// the business app's menu, in order, with each link's default icon (keep in step with NAV in public/app.js)
const LINKS = [
  ['/business-overview', 'Home', 'Operations', 'home'], ['/calendar', 'Calendar', 'Operations', 'calendar'],
  ['/clients', 'Clients', 'Operations', 'users'], ['/quotes', 'Quotes', 'Operations', 'document'], ['/jobs', 'Jobs', 'Operations', 'briefcase'],
  ['/invoices', 'Invoices', 'Operations', 'receipt'], ['/payments', 'Payments', 'Money', 'card'], ['/services', 'Products & Services', 'Money', 'tag'], ['/expenses', 'Expenses', 'Money', 'wallet'],
  ['/reports', 'Financial Reports', 'Money', 'barChart'], ['/tax-summary', 'Tax Summary', 'Money', 'percent'], ['/reviews', 'Reviews', 'Marketing', 'star'], ['/social-posts', 'Marketing', 'Marketing', 'megaphone'], ['/automations', 'Automations', 'Marketing', 'autoPlay'],
  ['/project-gallery', 'Project Gallery', 'Records', 'image'], ['/notifications', 'Notifications Log', 'Records', 'bell'],
].map(([path, label, group, icon]) => ({ path, label, group, default: icon }));

const GROUPS = ['Operations', 'Money', 'Marketing', 'Records'];
// the menu's order and sections (Alpha → Settings → Menu, drag and drop): saved as [{ path, group }]; links added later go at the end of their own section
function order() {
  const saved = (tenancy.platform().settings.navOrder || []).filter((o) => LINKS.some((l) => l.path === o.path) && GROUPS.includes(o.group));
  const out = saved.filter((o, i) => saved.findIndex((x) => x.path === o.path) === i);
  for (const l of LINKS) if (!out.some((o) => o.path === l.path)) { const at = out.map((o) => o.group).lastIndexOf(l.group); out.splice(at < 0 ? out.length : at + 1, 0, { path: l.path, group: l.group }); }
  return GROUPS.flatMap((g) => out.filter((o) => o.group === g)); // sections always in the same order
}
function setOrder(list) {
  const bad = () => Object.assign(new Error('That menu order isn’t complete. Reload and try again.'), { status: 400 });
  if (!Array.isArray(list) || list.length !== LINKS.length) throw bad();
  const clean = list.map((o) => ({ path: String(o.path), group: String(o.group) }));
  if (new Set(clean.map((o) => o.path)).size !== LINKS.length || !clean.every((o) => LINKS.some((l) => l.path === o.path) && GROUPS.includes(o.group))) throw bad();
  tenancy.platform().settings.navOrder = clean; tenancy.savePlatform();
}
function resetOrder() { delete tenancy.platform().settings.navOrder; tenancy.savePlatform(); }
const chosen = () => tenancy.platform().settings.navIcons || {};
const iconFor = (l) => (LIBRARY[chosen()[l.path]] ? chosen()[l.path] : l.default);
// for the business app: each menu link's icon drawing
const navIcons = () => Object.fromEntries(LINKS.map((l) => [l.path, LIBRARY[iconFor(l)][1]]));
// for Alpha
const view = () => ({ groups: GROUPS, custom: !!tenancy.platform().settings.navOrder, library: Object.entries(LIBRARY).map(([key, [label, d]]) => ({ key, label, d })),
  links: order().map((o) => { const l = LINKS.find((x) => x.path === o.path); return { ...l, group: o.group, defaultGroup: l.group, icon: iconFor(l) }; }) });
function choose(path, icon) {
  if (!LINKS.some((l) => l.path === path)) throw Object.assign(new Error('Unknown menu link'), { status: 404 });
  if (icon && !LIBRARY[icon]) throw Object.assign(new Error('Choose one of the icons'), { status: 400 });
  const s = tenancy.platform().settings; s.navIcons = { ...(s.navIcons || {}) };
  if (!icon || icon === LINKS.find((l) => l.path === path).default) delete s.navIcons[path]; else s.navIcons[path] = icon; // the default isn't stored
  tenancy.savePlatform();
}
// one icon as an inline SVG, drawn like the app's menu (public/app.js svgIcon); the public pages' Features and Industries menus use it too
const svg = (d, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

module.exports = { LIBRARY, svg, navIcons, view, choose, order, setOrder, resetOrder };
