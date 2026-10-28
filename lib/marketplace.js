// App Marketplace (Settings → App Marketplace): other apps a business can use alongside this one.
// "live" apps connect today, on the page named in `go`; the rest are on the way, and a business asks for them with "I want this".
// Requests and suggestions are kept in the platform store, so Alpha (Messages → App requests) sees which apps businesses want most.
const crypto = require('crypto');

const CATEGORIES = ['Accounting', 'Supplies & materials', 'AI assistants', 'Automation', 'Payments & financing', 'Marketing & reviews', 'Scheduling & messaging', 'Team & payroll', 'Photos & documents'];

// mono/bg/fg: the tile drawn for apps without an icon in the app (CONN_ICONS); feature: the plan feature a live app needs
const APPS = [
  { id: 'quickbooks', name: 'QuickBooks Online', category: 'Accounting', featured: true, mono: 'qb', bg: '#2CA01C', site: 'https://quickbooks.intuit.com',
    tagline: 'Send invoices and payments to your books automatically.', about: 'Accounting software from Intuit for small businesses.',
    does: ['Copy clients, invoices and payments to QuickBooks as you create them', 'Match your products and services to QuickBooks items', 'Skip typing the same invoice twice'] },
  { id: 'xero', name: 'Xero', category: 'Accounting', mono: 'x', bg: '#13B5EA', site: 'https://www.xero.com',
    tagline: 'Keep invoices, payments and contacts in step with Xero.', about: 'Online accounting software for small businesses.',
    does: ['Copy invoices and payments to Xero', 'Keep client contact details the same in both', 'Record expenses against the right accounts'] },
  { id: 'freshbooks', name: 'FreshBooks', category: 'Accounting', mono: 'F', bg: '#0075DD', site: 'https://www.freshbooks.com',
    tagline: 'Send invoices and expenses to FreshBooks.', about: 'Accounting and invoicing software for service businesses.',
    does: ['Copy invoices and payments to FreshBooks', 'Send expenses with their receipts'] },
  { id: 'wave', name: 'Wave', category: 'Accounting', mono: 'W', bg: '#1C4FD8', site: 'https://www.waveapps.com',
    tagline: 'Free bookkeeping, kept up to date from your invoices.', about: 'Free accounting software for very small businesses.',
    does: ['Copy invoices and payments to Wave', 'Send expenses to Wave'] },

  { id: 'homedepot', name: 'The Home Depot Pro', category: 'Supplies & materials', featured: true, mono: 'HD', bg: '#F96302', site: 'https://www.homedepot.com/c/Pro_Xtra',
    tagline: 'Price materials and order supplies from your quotes and jobs.', about: 'Home improvement supplies, with Pro Xtra rewards and pricing for trade businesses.',
    does: ['Look up Home Depot products and prices while you build a quote', 'Add a job’s materials to a Home Depot cart for pickup or delivery', 'Bring purchases into Expenses, linked to the job'] },
  { id: 'lowes', name: 'Lowe’s Pro', category: 'Supplies & materials', mono: 'L', bg: '#004990', site: 'https://www.lowes.com/l/pro',
    tagline: 'Order materials for a job and track what you spent.', about: 'Home improvement supplies, with pro pricing and rewards for trade businesses.',
    does: ['Look up Lowe’s products and prices while you quote', 'Bring purchases into Expenses, linked to the job'] },
  { id: 'ferguson', name: 'Ferguson', category: 'Supplies & materials', mono: 'Fg', bg: '#00396B', site: 'https://www.ferguson.com',
    tagline: 'Plumbing, HVAC and waterworks supplies, priced into your quotes.', about: 'A supplier of plumbing, HVAC and waterworks products for trade businesses.',
    does: ['Add Ferguson parts and your account pricing to quotes', 'Bring orders into Expenses, linked to the job'] },
  { id: 'grainger', name: 'Grainger', category: 'Supplies & materials', mono: 'G', bg: '#D9261C', site: 'https://www.grainger.com',
    tagline: 'Maintenance, safety and repair supplies for your crew.', about: 'A supplier of maintenance, repair and safety products.',
    does: ['Add Grainger products to quotes and jobs', 'Bring orders into Expenses'] },

  { id: 'claude', name: 'Claude', category: 'AI assistants', featured: true, icon: 'claude', live: true, feature: 'ai', go: '/services', goLabel: 'Open Products & Services', site: 'https://claude.ai',
    tagline: 'Built in: Claude writes your product and service descriptions.', about: 'An AI assistant made by Anthropic.',
    does: ['“Write with AI” drafts product and service descriptions from their name', 'Works in the catalog and on quote, invoice and job lines', 'Nothing to set up: it’s part of your plan'] },
  { id: 'chatgpt', name: 'ChatGPT', category: 'AI assistants', featured: true, mono: 'GPT', bg: '#10A37F', site: 'https://chatgpt.com',
    tagline: 'Ask ChatGPT about your jobs, clients and schedule.', about: 'An AI assistant made by OpenAI.',
    does: ['Ask questions about your schedule, quotes and invoices in ChatGPT', 'Draft client messages from a job’s details'] },

  { id: 'zapier', name: 'Zapier', category: 'Automation', featured: true, mono: 'Z', bg: '#FF4F00', site: 'https://zapier.com',
    tagline: 'Connect to thousands of apps with no code.', about: 'Automation that links apps together: when something happens in one, do something in another.',
    does: ['Start a Zap when a quote is approved, a job is finished or an invoice is paid', 'Create clients or requests here from your website forms', 'Send new jobs to a spreadsheet, chat channel or CRM'] },
  { id: 'make', name: 'Make', category: 'Automation', mono: 'M', bg: '#6D00CC', site: 'https://www.make.com',
    tagline: 'Build visual automations between your apps.', about: 'A visual tool for automating work between apps.',
    does: ['Run a scenario when a quote, job or invoice changes', 'Create clients from other apps'] },

  { id: 'stripe', name: 'Stripe', category: 'Payments & financing', icon: 'stripe', live: true, feature: 'onlinePayments', go: '/settings#payments', goLabel: 'Open card payments', site: 'https://stripe.com',
    tagline: 'Clients pay invoices and deposits by card.', about: 'Online card payments. The money goes to your own Stripe account.',
    does: ['A Pay button on every invoice and quote deposit', 'Payments are recorded on the invoice automatically', 'Payouts to your bank account'] },
  { id: 'paypal', name: 'PayPal', category: 'Payments & financing', mono: 'P', bg: '#003087', site: 'https://www.paypal.com/business',
    tagline: 'Let clients pay invoices with PayPal or Venmo.', about: 'Online payments that many clients already have an account with.',
    does: ['A PayPal button on invoices', 'Payments recorded on the invoice automatically'] },
  { id: 'square', name: 'Square', category: 'Payments & financing', mono: 'Sq', bg: '#1A1A1A', site: 'https://squareup.com',
    tagline: 'Take card payments in person with a Square reader.', about: 'Card readers and payments for in-person sales.',
    does: ['Charge an invoice on site with a Square reader', 'Payments recorded on the invoice automatically'] },
  { id: 'wisetack', name: 'Wisetack', category: 'Payments & financing', mono: 'W', bg: '#1B2D4F', site: 'https://www.wisetack.com',
    tagline: 'Offer clients monthly payments on bigger jobs.', about: 'Consumer financing for home service businesses.',
    does: ['Show a monthly payment option on quotes', 'Get paid in full while the client pays over time'] },

  { id: 'google', name: 'Google Business Profile', category: 'Marketing & reviews', featured: true, icon: 'google', live: true, feature: 'connections', go: '/settings/connections', goLabel: 'Open Account Connections', site: 'https://www.google.com/business/',
    tagline: 'Reply to Google reviews and take bookings from Google.', about: 'Your business listing on Google Search and Maps.',
    does: ['See and reply to your Google reviews here', 'A Book button on your Google profile', 'Ask happy clients for a review'] },
  { id: 'facebook', name: 'Facebook', category: 'Marketing & reviews', icon: 'facebook', live: true, feature: 'connections', go: '/settings/connections', goLabel: 'Open Account Connections', site: 'https://www.facebook.com/business',
    tagline: 'Post your project photos to your Facebook Page.', about: 'Your business’s Facebook Page.',
    does: ['Post before and after photos from Social Posts'] },
  { id: 'instagram', name: 'Instagram', category: 'Marketing & reviews', icon: 'instagram', live: true, feature: 'connections', go: '/settings/connections', goLabel: 'Open Account Connections', site: 'https://business.instagram.com',
    tagline: 'Share your best work on Instagram.', about: 'Your Instagram professional account (Business or Creator).',
    does: ['Post before and after photos from Social Posts'] },
  { id: 'mailchimp', name: 'Mailchimp', category: 'Marketing & reviews', mono: 'Mc', bg: '#FFE01B', fg: '#241C15', site: 'https://mailchimp.com',
    tagline: 'Keep your client list in Mailchimp for email campaigns.', about: 'Email marketing for small businesses.',
    does: ['Copy clients to a Mailchimp audience as you add them', 'Tag clients by the services they’ve bought'] },
  { id: 'nextdoor', name: 'Nextdoor', category: 'Marketing & reviews', mono: 'N', bg: '#8ED500', fg: '#0B2E13', site: 'https://business.nextdoor.com',
    tagline: 'Get recommended in the neighborhoods you work in.', about: 'The neighborhood network, with business pages and recommendations.',
    does: ['Post finished projects to your Nextdoor business page', 'Ask clients to recommend you'] },
  { id: 'angi', name: 'Angi', category: 'Marketing & reviews', mono: 'A', bg: '#FF6153', site: 'https://www.angi.com/pro',
    tagline: 'Bring Angi leads straight into your client list.', about: 'A marketplace where homeowners find home service pros.',
    does: ['New Angi leads arrive as clients and requests', 'Reply and quote from here'] },
  { id: 'thumbtack', name: 'Thumbtack', category: 'Marketing & reviews', mono: 'T', bg: '#009FD9', site: 'https://www.thumbtack.com/pro',
    tagline: 'Turn Thumbtack leads into quotes faster.', about: 'A marketplace where people hire local pros.',
    does: ['New Thumbtack leads arrive as clients and requests'] },
  { id: 'yelp', name: 'Yelp', category: 'Marketing & reviews', mono: 'Y', bg: '#D32323', site: 'https://business.yelp.com',
    tagline: 'See your Yelp reviews and leads in one place.', about: 'Local business reviews and requests for quotes.',
    does: ['See your Yelp reviews here', 'Yelp quote requests arrive as clients and requests'] },

  { id: 'gcal', name: 'Google Calendar', category: 'Scheduling & messaging', featured: true, mono: '31', bg: '#1A73E8', site: 'https://calendar.google.com',
    tagline: 'See your jobs and visits in Google Calendar.', about: 'Google’s calendar, on your phone and computer.',
    does: ['Each team member sees their visits in their own Google Calendar', 'Changes here update the calendar event'] },
  { id: 'outlook', name: 'Microsoft Outlook', category: 'Scheduling & messaging', mono: 'O', bg: '#0078D4', site: 'https://outlook.com',
    tagline: 'See your jobs and visits in your Outlook calendar.', about: 'Microsoft’s email and calendar.',
    does: ['Each team member sees their visits in Outlook', 'Changes here update the calendar event'] },
  { id: 'slack', name: 'Slack', category: 'Scheduling & messaging', mono: '#', bg: '#4A154B', site: 'https://slack.com',
    tagline: 'Get a message in Slack when work comes in or gets paid.', about: 'Team chat for businesses.',
    does: ['A message when a quote is approved, a request arrives or an invoice is paid', 'Choose which channel gets what'] },

  { id: 'gusto', name: 'Gusto', category: 'Team & payroll', mono: 'g', bg: '#F45D48', site: 'https://gusto.com',
    tagline: 'Send your team’s hours to payroll.', about: 'Payroll, benefits and HR for small businesses.',
    does: ['Send each team member’s hours to Gusto for payroll', 'Keep team members the same in both'] },

  { id: 'companycam', name: 'CompanyCam', category: 'Photos & documents', mono: 'CC', bg: '#0967D2', site: 'https://companycam.com',
    tagline: 'Bring CompanyCam project photos onto your jobs.', about: 'Photo documentation for contractors.',
    does: ['Show a project’s CompanyCam photos on the job', 'Add photos to the Project Gallery'] },
  { id: 'gdrive', name: 'Google Drive', category: 'Photos & documents', mono: 'D', bg: '#188038', site: 'https://drive.google.com',
    tagline: 'Save quotes, invoices and photos to Google Drive.', about: 'File storage from Google.',
    does: ['Save a copy of each sent quote and invoice PDF', 'Back up job photos to a folder per client'] },
];
const byId = Object.fromEntries(APPS.map((a) => [a.id, a]));

// what the app shows; status (live apps) is worked out in server.js, which knows the account's connections
const catalog = () => APPS.map(({ id, name, category, featured, icon, mono, bg, fg, site, tagline, about, does, live, feature, go, goLabel }) =>
  ({ id, name, category, featured: !!featured, icon: icon || null, mono: mono || '', bg: bg || '', fg: fg || '#fff', site, tagline, about, does, live: !!live, feature: feature || null, go: go || '', goLabel: goLabel || '' }));

// platform store: requests[appId] = [{ t, company, account, name, at }] and suggestions of apps not in the list
const store = (P) => { P.appRequests = P.appRequests || {}; P.appSuggestions = P.appSuggestions || []; return P; };
const requestedBy = (P, tenantId) => Object.keys(store(P).appRequests).filter((id) => P.appRequests[id].some((r) => r.t === tenantId));
function request(P, appId, who, on) {
  const a = byId[appId]; if (!a || a.live) throw Object.assign(new Error('Unknown app'), { status: 404 });
  const list = (store(P).appRequests[appId] || []).filter((r) => r.t !== who.t);
  if (on) list.push({ ...who, at: new Date().toISOString() });
  if (list.length) P.appRequests[appId] = list; else delete P.appRequests[appId];
}
function suggest(P, who, b) {
  const app = String(b.app || '').trim().slice(0, 80); if (!app) throw Object.assign(new Error('Enter the app’s name'), { status: 400 });
  const s = { id: crypto.randomBytes(6).toString('hex'), ...who, app, note: String(b.note || '').trim().slice(0, 1000), at: new Date().toISOString() };
  store(P).appSuggestions.unshift(s); P.appSuggestions.length = Math.min(P.appSuggestions.length, 500);
  return s;
}
// for Alpha: the most-wanted apps first, then the suggestions
const requestsView = (P) => ({
  apps: Object.entries(store(P).appRequests).filter(([id]) => byId[id]).map(([id, list]) => ({ id, name: byId[id].name, category: byId[id].category, accounts: [...list].sort((a, b) => b.at.localeCompare(a.at)) }))
    .sort((a, b) => b.accounts.length - a.accounts.length || a.name.localeCompare(b.name)),
  suggestions: P.appSuggestions,
});

module.exports = { CATEGORIES, catalog, requestedBy, request, suggest, requestsView };
