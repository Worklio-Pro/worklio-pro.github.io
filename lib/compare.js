// Alpha → Help Center → Comparison (owner only): Worklio Pro against the main competitors.
// Served by GET /api/platform/compare, which only the Alpha owner can call (support logins get 403), so it isn't in the public platform.js.
// Worklio's column comes live from the Board: a row with a Board title shows that post's status.
const COLS = [['Jobber', '~$49–$499/mo'], ['Housecall Pro', '~$79–$329/mo'], ['Workiz', 'Quote only'], ['ServiceTitan', 'Quote only']];
// [group] or [feature, note, Board post title (or '' when Worklio already has it), Jobber, Housecall Pro, Workiz, ServiceTitan]
// y included · p partly or higher plans · a paid add-on · n not offered
const ROWS = [
  ['Sales & billing'],
  ['Quotes with online approval and signature', 'Clients approve and sign online, with deposits', '', 'y', 'y', 'y', 'y'],
  ['Online card payments', '', '', 'y', 'y', 'y', 'y'],
  ['Good / Better / Best quote options', 'Packaged options the client picks from', 'Good / Better / Best quote options', 'p', 'y', 'p', 'y'],
  ['Customer financing', 'Clients pay over time for bigger jobs', 'Customer financing', 'y', 'y', 'y', 'y'],
  ['Batch invoicing & late fees', '', 'Batch invoicing & late fees', 'y', 'y', 'p', 'y'],
  ['Tap to Pay on phone', 'Card payments with no reader', 'Tap to Pay on phone', 'y', 'y', 'y', 'y'],
  ['Service plans & memberships', 'Recurring billing with scheduled visits', 'Service plans & memberships', 'p', 'y', 'p', 'y'],
  ['Scheduling & the field'],
  ['On My Way texts', 'Arrival time sent to the client', 'On My Way texts', 'y', 'y', 'y', 'y'],
  ['Recurring jobs', 'Weekly, monthly or custom repeats', 'Recurring jobs', 'y', 'y', 'y', 'y'],
  ['Time tracking & timesheets', 'Clock in/out, approval, payroll export', 'Time tracking & timesheets', 'y', 'y', 'y', 'y'],
  ['Dispatch map & route optimization', '', 'Dispatch map & route optimization', 'p', 'p', 'y', 'y'],
  ['Job checklists & custom forms', '', 'Job checklists & custom forms', 'y', 'y', 'y', 'y'],
  ['Inventory & purchase orders', '', 'Inventory & purchase orders', 'n', 'n', 'p', 'y'],
  ['Equipment history per property', '', 'Equipment history per property', 'n', 'p', 'n', 'y'],
  ['Clients & communication'],
  ['Client portal', 'Visits, quotes, invoices and requests', '', 'y', 'y', 'y', 'y'],
  ['Online booking', '', '', 'y', 'y', 'y', 'a'],
  ['Booking widget for your website', '', 'Booking widget for your website', 'y', 'y', 'y', 'a'],
  ['Two-way texting inbox', '', 'Two-way texting inbox', 'p', 'y', 'a', 'y'],
  ['Missed-call text-back / AI receptionist', '', 'Missed-call text-back', 'a', 'a', 'a', 'a'],
  ['Marketing'],
  ['Review requests & Google reviews', '', '', 'a', 'y', 'y', 'a'],
  ['Social media posting', 'Facebook, Instagram, TikTok, LinkedIn and more', '', 'n', 'n', 'n', 'n'],
  ['Email marketing campaigns', '', 'Email marketing campaigns', 'a', 'a', 'p', 'a'],
  ['AI writing assistant', '', '', 'y', 'y', 'y', 'y'],
  ['Money, team & integrations'],
  ['Job profit report', 'Revenue against costs per job', 'Job profit report', 'p', 'p', 'y', 'y'],
  ['QuickBooks Online sync', '', 'QuickBooks & Xero sync', 'y', 'p', 'y', 'y'],
  ['Xero sync', '', 'QuickBooks & Xero sync', 'y', 'n', 'n', 'n'],
  ['Custom roles & permissions', '', '', 'p', 'p', 'y', 'y'],
  ['Commissions for team members', '', 'Commissions for team members', 'n', 'p', 'y', 'y'],
  ['Zapier & public API', '', 'Zapier & public API', 'y', 'p', 'y', 'y'],
  ['Multiple locations', '', 'Multiple locations', 'n', 'p', 'p', 'y'],
];
module.exports = { cols: COLS, rows: ROWS };
