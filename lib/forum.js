// The Board (lib/forum.js, shown on ideas.<domain> by lib/ideas.js): owners and admins of every business post issues and feature requests, and like, comment and reply.
// It isn't a support queue: it shows what to improve. Managed in Alpha → Help Center → Forum (status, pin, lock, team replies, delete).
// Posts live in platform.json (P().forum.posts); settings in P().settings.forum.
// Everyone in the forum sees a short name (Ann A.) and the business name; Alpha sees the full name, email and account.
const crypto = require('crypto');
const tenancy = require('./tenancy');

const P = () => tenancy.platform();
const save = () => tenancy.savePlatform();
const newId = () => crypto.randomBytes(6).toString('hex');
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const fail = (msg, status = 400) => { throw Object.assign(new Error(msg), { status }); };

const KINDS = { idea: 'Feature request', issue: 'Issue' };
// the part of the app a post is about (shown as Boards); posts from before categories count as Other
const CATEGORIES = { automations: 'Automations', booking: 'Booking & Requests', 'business-page': 'Business Page & QR Code', calendar: 'Calendar & Scheduling', clients: 'Clients', 'client-portal': 'Client Portal',
  expenses: 'Expenses', integrations: 'Integrations', invoices: 'Invoices', jobs: 'Jobs', marketing: 'Marketing', mobile: 'Mobile App', notifications: 'Notifications', payments: 'Payments', quotes: 'Quotes',
  reports: 'Reports', reviews: 'Reviews', team: 'Team & Permissions', other: 'Other' };
const catOf = (p) => (CATEGORIES[p.category] ? p.category : 'other');
const STATUSES = { open: 'New', review: 'Under review', planned: 'Planned', progress: 'In progress', beta: 'Beta', done: 'Done', declined: 'Not planned' };
const DEFAULTS = { on: true, emailNew: true, emailReplies: true };
const settings = () => ({ ...DEFAULTS, ...(P().settings.forum || {}) });
const posts = () => { const p = P(); p.forum = p.forum || { posts: [] }; return p.forum.posts; };
const find = (id) => posts().find((x) => x.id === id) || fail('That post was deleted', 404);
const findComment = (post, cid) => post.comments.find((c) => c.id === cid) || fail('That comment was deleted', 404);

// set by server.js: email someone, and look up a business login (null when it's gone or no longer an owner/admin)
let hooks = { send: async () => {}, user: () => null, notifyTo: () => '' };
const init = (h) => { hooks = { ...hooks, ...h }; };

// actor: a business login { t: account slug, u: user id, name, email, role, company } or the team { team: true, adminId, name }
const key = (a) => (a.team ? 'team' : `${a.t}|${a.u}`);
const shortName = (name) => { const [first, ...rest] = String(name || '').trim().split(/\s+/); const last = rest.pop(); return last ? `${first} ${last[0].toUpperCase()}.` : first || 'Someone'; };
const authorOf = (a) => (a.team ? { team: true, adminId: a.adminId, name: a.name } : { t: a.t, u: a.u, name: clip(a.name, 80), email: a.email, role: a.role, company: clip(a.company, 120) });
const productName = () => P().settings.productName || 'Worklio Pro';
// what other businesses see
const pubAuthor = (x) => (x.team ? { name: `${productName()} team`, team: true } : { name: shortName(x.name), company: x.company });

// rate limits, per login: 10 posts and 60 comments an hour
const hits = new Map();
function limit(a, kind, max) {
  const k = `${kind}|${key(a)}`; const now = Date.now(); const h = (hits.get(k) || []).filter((x) => now - x < 3600e3);
  if (h.length >= max) fail(kind === 'post' ? 'You’ve posted a lot in the last hour. Try again a little later.' : 'You’ve commented a lot in the last hour. Try again a little later.', 429);
  h.push(now); hits.set(k, h);
}
const mine = (x, a) => !a.team && !x.team && x.t === a.t && x.u === a.u;
const comments = (post) => post.comments.filter((c) => !c.deleted);

function summary(p, a) {
  return { id: p.id, at: p.at, kind: p.kind, category: catOf(p), title: p.title, excerpt: p.body.slice(0, 220), status: p.status, pinned: !!p.pinned, locked: !!p.locked,
    author: pubAuthor(p.author), mine: mine(p.author, a), likes: p.likes.length, liked: p.likes.includes(key(a)), comments: comments(p).length, lastAt: p.lastAt || p.at };
}
function detail(p, a) {
  return { ...summary(p, a), body: p.body, editedAt: p.editedAt || null, statusAt: p.statusAt || null,
    comments: p.comments.map((c) => ({ id: c.id, at: c.at, parentId: c.parentId || null, deleted: !!c.deleted, body: c.deleted ? '' : c.body, author: c.deleted ? null : pubAuthor(c.author),
      mine: !c.deleted && mine(c.author, a), likes: c.likes.length, liked: c.likes.includes(key(a)), editedAt: c.editedAt || null })) };
}
const meta = () => ({ kinds: KINDS, statuses: STATUSES, categories: CATEGORIES });
const isOn = () => settings().on;
const closed = () => fail('The Board is closed right now', 404);

/* ===== the business app (owners and admins) ===== */
function list(a) {
  if (!isOn()) closed();
  return { ...meta(), posts: posts().map((p) => summary(p, a)) };
}
function get(id, a) { if (!isOn()) closed(); return { ...meta(), post: detail(find(id), a) }; }
function cleanPost(b) {
  const kind = KINDS[b.kind] ? b.kind : fail('Choose Feature request or Issue');
  const category = CATEGORIES[b.category] ? b.category : fail('Choose a board');
  const title = clip(b.title, 140); if (title.length < 4) fail('Give your post a short title');
  const body = clip(b.body, 6000); if (body.length < 10) fail('Add a few words about it');
  return { kind, category, title, body };
}
function create(a, b) {
  if (!isOn()) closed();
  const c = cleanPost(b || {}); limit(a, 'post', 10);
  const now = new Date().toISOString();
  const p = { id: newId(), at: now, ...c, status: 'open', author: authorOf(a), likes: [key(a)], comments: [], lastAt: now }; // you like your own post to start
  posts().unshift(p); save();
  const s = settings(); const to = hooks.notifyTo();
  if (s.emailNew && to) hooks.send('forumPost', to, { name: a.name, business: a.company, kind: KINDS[p.kind], title: p.title, message: p.body, link: `${tenancy.platformUrl()}/alpha#forum` }).catch(() => {});
  return { post: detail(p, a) };
}
function edit(a, id, b) {
  const p = find(id); if (!mine(p.author, a)) fail('You can only edit your own posts', 403); if (p.locked) fail('This post is locked', 403);
  Object.assign(p, cleanPost({ kind: p.kind, category: catOf(p), title: p.title, body: p.body, ...b }), { editedAt: new Date().toISOString() }); save();
  return { post: detail(p, a) };
}
function remove(a, id) {
  const p = find(id); if (!mine(p.author, a)) fail('You can only delete your own posts', 403);
  P().forum.posts = posts().filter((x) => x !== p); save(); return { ok: true };
}
function like(a, id) {
  if (!isOn()) closed();
  const p = find(id); const k = key(a); p.likes = p.likes.includes(k) ? p.likes.filter((x) => x !== k) : [...p.likes, k]; save();
  return { likes: p.likes.length, liked: p.likes.includes(k) };
}
function likeComment(a, id, cid) {
  if (!isOn()) closed();
  const c = findComment(find(id), cid); if (c.deleted) fail('That comment was deleted', 404);
  const k = key(a); c.likes = c.likes.includes(k) ? c.likes.filter((x) => x !== k) : [...c.likes, k]; save();
  return { likes: c.likes.length, liked: c.likes.includes(k) };
}
// a comment, or a reply to one (replies stay one level deep: a reply to a reply joins the same thread)
function comment(a, id, b) {
  if (!a.team && !isOn()) closed();
  const p = find(id); if (p.locked && !a.team) fail('This post is locked, so it can’t get new comments', 403);
  const body = clip((b || {}).body, 4000); if (!body) fail('Write a comment first');
  let parentId = null;
  if (b.parentId) { const parent = findComment(p, b.parentId); parentId = parent.parentId || parent.id; }
  if (!a.team) limit(a, 'comment', 60);
  const now = new Date().toISOString();
  const c = { id: newId(), at: now, parentId, body, author: authorOf(a), likes: [] };
  p.comments.push(c); p.lastAt = now; save();
  // let the post's author know, and whoever wrote the comment being replied to
  const told = new Set([key(a)]);
  const tell = (who, why) => { if (who.team || told.has(key(who))) return; told.add(key(who)); notify(who, p, why, a, body); };
  if (parentId) tell(findComment(p, parentId).author, 'replied to your comment on');
  tell(p.author, a.team ? 'replied to' : 'commented on');
  return a.team ? { post: adminView(p) } : { post: detail(p, a) };
}
function removeComment(a, id, cid) {
  const p = find(id); const c = findComment(p, cid);
  if (!a.team && !mine(c.author, a)) fail('You can only delete your own comments', 403);
  // a comment with replies leaves a “deleted” line so the replies still make sense
  if (!c.parentId && p.comments.some((x) => x.parentId === c.id && !x.deleted)) Object.assign(c, { deleted: true, body: '', likes: [] });
  else p.comments = p.comments.filter((x) => x !== c && !(x.parentId === c.id));
  save();
  return a.team ? { post: adminView(p) } : { post: detail(p, a) };
}

// emails to a business login about activity on their post or comment (Alpha → Help Center → Forum → Forum settings can turn them off)
const sentRecently = new Map(); // post|login -> time: one email per post per 10 minutes
function notify(who, p, why, from, text) {
  if (!settings().emailReplies) return;
  const k = `${p.id}|${key(who)}`; if (Date.now() - (sentRecently.get(k) || 0) < 600e3) return;
  const u = hooks.user(who.t, who.u); if (!u || !u.email) return; // gone, or no longer an owner or admin
  const t = P().tenants.find((x) => x.slug === who.t); if (!t) return;
  sentRecently.set(k, Date.now());
  const fromName = from.team ? `The ${productName()} team` : `${shortName(from.name)} from ${from.company}`;
  hooks.send('forumActivity', u.email, { name: u.name, title: p.title, what: `${fromName} ${why} your post`, message: text, link: `${tenancy.ideasUrl()}/feedback/${catOf(p)}` }).catch(() => {});
}

/* ===== Alpha ===== */
const fullAuthor = (x) => (x.team ? { team: true, name: x.name } : { name: x.name, email: x.email, role: x.role, company: x.company, account: (() => { const t = P().tenants.find((y) => y.slug === x.t); return t ? tenancy.tenantUrl(t) : ''; })() });
function adminView(p) {
  return { id: p.id, at: p.at, kind: p.kind, category: catOf(p), title: p.title, body: p.body, status: p.status, statusAt: p.statusAt || null, pinned: !!p.pinned, locked: !!p.locked, editedAt: p.editedAt || null, lastAt: p.lastAt || p.at,
    author: fullAuthor(p.author), likes: p.likes.length, comments: p.comments.map((c) => ({ id: c.id, at: c.at, parentId: c.parentId || null, deleted: !!c.deleted, body: c.body, author: c.deleted ? null : fullAuthor(c.author), likes: c.likes.length })) };
}
const adminList = () => ({ ...meta(), settings: settings(), posts: posts().map(adminView) });
const newCount = () => posts().filter((p) => p.status === 'open').length;
// status, pin, lock, type, category; a status change can carry a note, posted as a team reply
function adminUpdate(id, b, admin) {
  const p = find(id); b = b || {};
  if (b.kind !== undefined) p.kind = KINDS[b.kind] ? b.kind : fail('Unknown type');
  if (b.category !== undefined) p.category = CATEGORIES[b.category] ? b.category : fail('Unknown board');
  if (b.pinned !== undefined) p.pinned = !!b.pinned;
  if (b.locked !== undefined) p.locked = !!b.locked;
  let changed = false;
  if (b.status !== undefined && b.status !== p.status) { if (!STATUSES[b.status]) fail('Unknown status'); p.status = b.status; p.statusAt = new Date().toISOString(); changed = true; }
  save();
  const note = clip(b.note, 4000); const team = { team: true, adminId: admin.id, name: admin.name };
  if (note) return comment(team, p.id, { body: changed ? `Status: ${STATUSES[p.status]}\n\n${note}` : note });
  if (changed && p.status !== 'review') notify(p.author, p, `marked “${STATUSES[p.status]}”:`, team, `Status: ${STATUSES[p.status]}`);
  return { post: adminView(p) };
}
// a post by the team itself (Alpha → Board → New post), e.g. a roadmap item: it starts at the status chosen, with no likes
function adminCreate(b, admin) {
  b = b || {}; const c = cleanPost(b);
  const status = b.status === undefined ? 'planned' : STATUSES[b.status] ? b.status : fail('Unknown status');
  const now = new Date().toISOString();
  const p = { id: newId(), at: now, ...c, status, statusAt: now, author: authorOf({ team: true, adminId: admin.id, name: admin.name }), likes: [], comments: [], lastAt: now, pinned: !!b.pinned };
  posts().unshift(p); save();
  return { post: adminView(p) };
}
function adminRemove(id) { find(id); P().forum.posts = posts().filter((x) => x.id !== id); save(); return adminList(); }
function saveSettings(b) {
  const s = settings(); b = b || {};
  P().settings.forum = { on: b.on !== undefined ? !!b.on : s.on, emailNew: b.emailNew !== undefined ? !!b.emailNew : s.emailNew, emailReplies: b.emailReplies !== undefined ? !!b.emailReplies : s.emailReplies };
  save(); return adminList();
}

/* ===== ideas.<domain> (lib/ideas.js): anyone can see feature requests: the title, the start of the post, status and counts (no names or businesses; issues stay in the Board) ===== */
// a: the logged-in business login on ideas.<domain>, if any, for which posts it liked
const publicIdeas = (a) => (isOn() ? posts().filter((p) => p.kind === 'idea')
  .map((p) => ({ id: p.id, at: p.at, category: catOf(p), title: p.title, excerpt: p.body.slice(0, 200), status: p.status, statusLabel: STATUSES[p.status] || STATUSES.open, likes: p.likes.length, liked: !!a && p.likes.includes(key(a)), comments: comments(p).length })) : []);

// once (flag in platform.json): the team's roadmap from the competitor review (Nov 2026) goes on the Board as team posts. A title the Board
// already has (a business may have asked first) is skipped, so their post keeps its likes; change or delete any of these in Alpha → Board
const ROADMAP_2611 = [
  ['done', 'jobs', 'On My Way texts', 'Tap On My Way on a job and pick about how long until you arrive. The client gets a text (or an email) with the arrival time, and the job shows On the way for the day.'],
  ['beta', 'integrations', 'QuickBooks & Xero sync', 'Connect QuickBooks Online or Xero in Settings and your clients, invoices, payments and expenses are sent to your books automatically, from a start date you choose.'],
  ['done', 'reports', 'Job profit report', 'Financial Reports → Job profit: what each job was invoiced against the expenses logged to it, with Profit & loss and Unpaid invoices by age.'],
  ['beta', 'team', 'Time tracking & timesheets', 'Clock in and out of jobs (or the day) from the phone, with timesheets for managers to approve and export for payroll. Hours times each person’s rate adds labor to Job profit.'],
  ['planned', 'notifications', 'Two-way texting inbox', 'Clients’ replies to your texts land in one inbox, threaded per client, so the team can answer from the app.'],
  ['beta', 'jobs', 'Recurring jobs', 'Repeat a job weekly, every 2 weeks, monthly or on a custom schedule (lawn care, cleaning, pool service), with each visit on the calendar.'],
  ['beta', 'payments', 'Service plans & memberships', 'Sell maintenance plans that bill automatically and schedule their visits, e.g. two HVAC tune-ups a year.'],
  ['beta', 'calendar', 'Dispatch map & route optimization', 'See today’s jobs and team on a map, drag to assign, and put each person’s visits in the shortest driving order.'],
  ['planned', 'payments', 'Customer financing', 'Let clients pay for bigger jobs over time, right from the quote, while you get paid in full.'],
  ['planned', 'quotes', 'Good / Better / Best quote options', 'Offer packaged options side by side on a quote and let the client pick one when they approve.'],
  ['planned', 'jobs', 'Job checklists & custom forms', 'Checklists and forms (inspections, safety, photos required) attached to jobs and filled in on site.'],
  ['planned', 'invoices', 'Batch invoicing & late fees', 'Invoice all completed jobs at once, and add a late fee automatically when an invoice is overdue.'],
  ['planned', 'payments', 'Tap to Pay on phone', 'Take a card payment by tapping it on your phone, with no card reader.'],
  ['planned', 'marketing', 'Email marketing campaigns', 'Send seasonal promotions and newsletters to your client list, with simple templates and results.'],
  ['planned', 'notifications', 'Missed-call text-back', 'When you miss a call, the caller gets a text right away with a link to book or request work.'],
  ['planned', 'booking', 'Booking widget for your website', 'Put your online booking form on your own website with a snippet of code.'],
  ['review', 'other', 'Inventory & purchase orders', 'Track parts and materials (in the shop and on each truck) and order more with purchase orders.'],
  ['review', 'clients', 'Equipment history per property', 'Record the equipment at each property (make, model, serial, install date) with its service history.'],
  ['review', 'team', 'Commissions for team members', 'Pay team members a commission on jobs they sell or complete, with a report for payroll.'],
  ['review', 'integrations', 'Zapier & public API', 'Connect Worklio Pro to thousands of other apps through Zapier, and to your own tools with an API.'],
  ['review', 'other', 'Multiple locations', 'Run several branches in one account, each with its own team, schedule and reports.'],
];
function seedRoadmap() {
  const p = P(); if (p.roadmap2611) return;
  const have = new Set(posts().map((x) => String(x.title || '').trim().toLowerCase()));
  const team = { team: true, adminId: null, name: `${productName()} team` }; const now = Date.now();
  // oldest first, so the list reads in this order (newest on top)
  ROADMAP_2611.slice().reverse().forEach(([status, category, title, body], i) => {
    if (have.has(title.toLowerCase())) return;
    const at = new Date(now - (ROADMAP_2611.length - i) * 1000).toISOString();
    posts().unshift({ id: newId(), at, ...cleanPost({ kind: 'idea', category, title, body }), status, statusAt: at, author: authorOf(team), likes: [], comments: [], lastAt: at, pinned: false });
  });
  p.roadmap2611 = true; save();
}
// once (flag in platform.json): what shipped in Beta on Nov 6, 2026 moves to Beta on the Roadmap. The team's own posts get a line on how to
// use it; a business's post with the same title keeps its words, and its author is emailed about the new status. Change any of them in Alpha → Board
const SHIPPED_2611 = [
  ['Time tracking & timesheets', 'Now in Beta: clock in and out on a job’s page or on the new Timesheets page. Managers see everyone’s week with overtime, fix and approve entries and export CSV for payroll; with pay rates set, hours on a job show as labor in Financial Reports → Job profit.'],
  ['Recurring jobs', 'Now in Beta: set Repeats on a job (daily, weekly on chosen days, or monthly on a date or weekday such as the 2nd Tuesday), with an end after N visits or on a date. Each visit is its own job, scheduled ahead, and changes can go to one visit or all the following ones.'],
  ['Service plans & memberships', 'Now in Beta: set up plans on the new Service Plans page (price billed monthly, quarterly or yearly, visits included, member discount) and put clients on them. Invoices are made and emailed each period and the visits are scheduled as a repeating job.'],
  ['Dispatch map & route optimization', 'Now in Beta: Calendar → Map shows a day’s visits in each team member’s color with their route. Drag a visit onto someone to assign it, use Best order for the shortest driving order with new times, and Directions to open the route in Google Maps.'],
  ['QuickBooks & Xero sync', null],
];
// once (flag in platform.json): checklists & forms shipped in Beta on Nov 8, 2026, the same way
const SHIPPED_2611_08 = [
  ['Job checklists & custom forms', 'Now in Beta: make checklists in gear → Checklists & Forms (checkboxes, Pass / Fail / N/A, answers, numbers, dates, choices and photos) and add them to jobs, or to every new job. The team fills them in on the job page; one can be required before the job is marked complete, and finished ones can be shared in the client portal.'],
];
const SHIPPED_2611_08B = [
  ['Good / Better / Best quote options', 'Now in Beta: on a quote, click Offer options (Good / Better / Best) and give each option its own line items; mark one Recommended. The client sees the options side by side and approves one, and only that option goes on the job and invoice.'],
];
// once: the booking widget for the business's website shipped on Nov 8, 2026 (marked Done, as a post with the same title is)
const SHIPPED_2611_08L = [
  ['booking', 'Booking widget for your website', 'Done: gear → Online Booking makes the code for your website. Put the booking form right in your page, or a Book button (where you paste it, or in the corner) that opens it in a popup, in your own button text and color. Requests from it say which website they came from.'],
];
// once: batch invoicing and late fees shipped in Beta on Nov 8, 2026, the same way
const SHIPPED_2611_08I = [
  ['Batch invoicing & late fees', 'Now in Beta: Invoices → Invoice completed jobs turns every finished job without an invoice into invoices in one go, one per job or one per client, emailed right away or kept as drafts. Turn on late fees in App Settings → Late fees: a flat fee or a percentage of the balance, added automatically when an invoice is still unpaid after its due date (once, or every 30 days), never taxed, with an email to the client.'],
];
// once: Every job markets itself shipped in Beta on Nov 8, 2026. Nobody asked for it on the Board, so it goes on as the team's post
// (if a post with the same title is there by then, that one moves to Beta instead, as above)
const SHIPPED_2611_08C = ['marketing', 'Every job markets itself', 'Now in Beta: when a job is completed and has photos, its before and after photos become a ready-to-post social post with a caption written by AI. Check it in Marketing → Ready to post and post it to your connected accounts in one tap. Each post links to your booking page so you can see the requests it brings in.'];
const SHIPPED_2611_08E = ['quotes', 'Snap to quote', 'Now in Beta: on a quote, tap Snap to quote (Draft from photos on a computer), take a few photos and say what the client needs. AI drafts the line items from your price list, with Good / Better / Best options when the job has choices, for you to check and send. On the Unlimited plan.'];
function addShipped(flag, [category, title, body]) {
  const p = P(); if (p[flag]) return;
  if (posts().some((x) => x.kind === 'idea' && String(x.title || '').trim().toLowerCase() === title.toLowerCase())) { p[flag] = true; save(); shipToBeta(flag + 'Beta', [[title, body]]); return; }
  const team = { team: true, adminId: null, name: `${productName()} team` }; const at = new Date().toISOString();
  posts().unshift({ id: newId(), at, ...cleanPost({ kind: 'idea', category, title, body }), status: 'beta', statusAt: at, author: authorOf(team), likes: [], comments: [], lastAt: at, pinned: false });
  p[flag] = true; save();
}
// once: improvements shipped on Nov 8, 2026, added as the team's posts in Done (a post with the same title is marked Done instead)
const SHIPPED_2611_08D = [
  ['marketing', 'Social accounts stay connected', 'Done: connected social accounts are renewed in the background, so they stay signed in even when you don’t post for a while. If a network signs you out anyway, Account Connections and Marketing show Needs reconnecting with a Reconnect button, and the account owner gets an email.'],
  ['notifications', 'A heads-up before texts run out', 'Done: the account owner gets an email when 80% of the month’s texts are used, and owners and admins see a note at the top of the app with how many are left.'],
  ['mobile', 'PDFs in the app and pull to refresh on phones', 'Done: PDFs open inside the app with a Back button, and in the app on your Home Screen you can pull down at the top of a page to refresh it.'],
];
function addDone(flag, list) {
  const p = P(); if (p[flag]) return;
  const team = { team: true, adminId: null, name: `${productName()} team` }; const at = new Date().toISOString();
  for (const [category, title, body] of list) {
    const same = posts().filter((x) => x.kind === 'idea' && String(x.title || '').trim().toLowerCase() === title.toLowerCase());
    if (same.length) {
      for (const x of same) {
        if (x.status === 'done' || x.status === 'declined') continue;
        x.status = 'done'; x.statusAt = at;
        if (x.author && !x.author.team) notify(x.author, x, `marked “${STATUSES.done}”:`, team, `Status: ${STATUSES.done}`);
      }
      continue;
    }
    posts().unshift({ id: newId(), at, ...cleanPost({ kind: 'idea', category, title, body }), status: 'done', statusAt: at, author: authorOf(team), likes: [], comments: [], lastAt: at, pinned: false });
  }
  p[flag] = true; save();
}
function roadmapShipped() {
  shipToBeta('roadmapShipped2611', SHIPPED_2611);
  shipToBeta('roadmapShipped261108', SHIPPED_2611_08);
  shipToBeta('roadmapShipped261108b', SHIPPED_2611_08B);
  addShipped('roadmapShipped261108c', SHIPPED_2611_08C);
  addShipped('roadmapShipped261108e', SHIPPED_2611_08E); // Snap to quote
  addDone('roadmapShipped261108d', SHIPPED_2611_08D);
  shipToBeta('roadmapShipped261108i', SHIPPED_2611_08I); // batch invoicing & late fees
  addDone('roadmapShipped261108l', SHIPPED_2611_08L); // the booking widget
}
function shipToBeta(flag, list) {
  const p = P(); if (p[flag]) return;
  const now = new Date().toISOString(); const team = { team: true, adminId: null, name: `${productName()} team` };
  for (const [title, body] of list) {
    for (const x of posts()) {
      if (x.kind !== 'idea' || String(x.title || '').trim().toLowerCase() !== title.toLowerCase()) continue;
      if (body && x.author && x.author.team) x.body = cleanPost({ kind: 'idea', category: catOf(x), title: x.title, body }).body;
      if (!['open', 'review', 'planned', 'progress'].includes(x.status)) continue;
      x.status = 'beta'; x.statusAt = now;
      if (x.author && !x.author.team) notify(x.author, x, `marked “${STATUSES.beta}”:`, team, `Status: ${STATUSES.beta}`);
    }
  }
  p[flag] = true; save();
}

module.exports = { init, isOn, publicIdeas, CATEGORIES, list, get, create, edit, remove, like, likeComment, comment, removeComment, adminList, adminView, adminCreate, adminUpdate, adminRemove, saveSettings, newCount, KINDS, STATUSES, seedRoadmap, roadmapShipped };
