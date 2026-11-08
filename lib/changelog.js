// What's new: the updates the bell in the app's top bar lists, newest first, and the Changelog tab on ideas.<domain> (lib/ideas.js) shows them all.
// Add an entry at the top for each release. tag: new, improved or fixed. A body line that starts with "- " is a bullet,
// "## " a heading; other lines are paragraphs.
const ENTRIES = [
  {
    id: 'batch-invoicing-late-fees', date: '2026-11-08', tag: 'new', title: 'Invoice all your completed jobs at once, and late fees',
    body: [
      '## Batch invoicing',
      'Go to Invoices and click Invoice them (or More Actions → Invoice completed jobs).',
      '- Every completed job without an invoice, grouped by client, ready to invoice in one go',
      '- One invoice per job, or one per client with all their jobs on it',
      '- Email them to clients right away with the pay link, or keep them as drafts',
      '- Due dates follow each client’s payment terms',
      '## Late fees',
      'Turn them on in Settings → App Settings → Late fees.',
      '- A flat fee or a percentage of the balance, added when an invoice is still unpaid after its due date',
      '- Once, or again every 30 days while it stays unpaid',
      '- Never taxed or discounted, and the client’s invoice says when the fee will be added',
      '- Clients get an email when a fee is added; switch it off on any invoice, or delete the line to waive it',
    ],
  },
  {
    id: 'calendar-month', date: '2026-11-08', tag: 'new', title: 'Month view on the Calendar',
    body: [
      'See the whole month at a glance. On the Calendar, click Month next to Day and Week.',
      '- Every job, task and event in time order, in each team member’s color, and who’s off',
      '- Click a date (or +more on a busy day) to open that day',
      '- Click an empty part of a day to add a job, task or event on it',
      '- Drag anything to another day to move it; it keeps its time',
    ],
  },
  {
    id: 'calendar-feed', date: '2026-11-08', tag: 'new', title: 'Your work in Google Calendar, Outlook or Apple Calendar',
    body: [
      'Everyone on your team can now see their work in the calendar app they already use.',
      '- Get your own calendar link in Settings → Preferences → Calendar link, then tap Add to Google Calendar or Add to Apple Calendar or Outlook',
      '- Your jobs, tasks, events and time off, with the client, the address and a link back to the job (never prices)',
      '- Changes here show there on their own',
      '- Anyone who can see the whole calendar can show everyone’s schedule instead of just their own',
    ],
  },
  {
    id: 'snap-to-quote', date: '2026-11-08', tag: 'new', title: 'Snap to quote (Beta)',
    body: [
      'Draft a quote from a few photos. Take photos of the job, say what the client needs, and AI drafts the quote for you to check and send.',
      '- Line items and prices come from your own Products & services list, never from the AI',
      '- Good / Better / Best options when the job has real choices, with one recommended',
      '- Anything not on your list is added at $0 and highlighted, and the quote can’t be sent until it’s priced',
      '- A list of things to check before sending, from what the photos don’t show',
      '- Talk instead of typing with the mic button, and the photos and notes stay on the quote for your team',
      'On a phone: Quotes → + New Quote → Snap to quote. On a computer: Draft from photos at the top of a new quote. On the Unlimited plan.',
    ],
  },
  {
    id: 'social-stay-connected', date: '2026-11-08', tag: 'improved', title: 'Social accounts stay connected',
    body: [
      'Your connected social accounts now stay signed in, even when you don’t post for a while.',
      '- Worklio Pro renews your TikTok, Instagram, Threads, LinkedIn, Pinterest, YouTube and Google Business Profile sign-ins in the background, before they run out',
      '- If a network signs you out anyway (say you changed your password), the account shows Needs reconnecting in Account Connections and Marketing, and the account owner gets an email',
      '- Click Reconnect and sign in again; there’s no need to disconnect first, and nothing you’ve posted is lost',
      '- Error messages now say how to fix the problem instead of showing the network’s own error',
      '- LinkedIn asks you to sign in again once a year: you’ll see Reconnect soon and get an email two weeks ahead',
    ],
  },
  {
    id: 'texts-heads-up', date: '2026-11-08', tag: 'improved', title: 'A heads-up before your texts run out',
    body: [
      'The account owner now gets an email when 80% of the month’s texts are used, with how many are sent and how many are left. Owners and admins also see a note at the top of the app.',
      '- When the last text of the month goes out, you’re told straight away',
      '- The owner’s note has Get more texts, which goes to Account and Billing',
    ],
  },
  {
    id: 'phone-pdfs-refresh', date: '2026-11-08', tag: 'improved', title: 'On your phone: PDFs in the app, and pull to refresh',
    body: [
      '- Quote, invoice, checklist and payment PDFs now open inside the app, with a Back button',
      '- In the app on your Home Screen, pull down at the top of a page to refresh it',
      '- Save bars at the bottom of the screen now sit flush with the edge',
    ],
  },
  {
    id: 'quote-options-pick', date: '2026-11-08', tag: 'fixed', title: 'Quote options: saving an approved quote',
    body: [
      'Saving an approved quote with options no longer fails with “Choose the option the client picked”. If the choice isn’t on screen, Worklio Pro asks which option the client picked and saves it.',
      'On a phone, the Options sheet now shows each line item’s option, so a quote that’s already been sent can get its options and their items in one save.',
    ],
  },
  {
    id: 'job-posts', date: '2026-11-08', tag: 'new', title: 'Every job markets itself (Beta)',
    body: [
      'Your finished jobs now market themselves. When a job is completed and has photos, a ready-to-post social post is made for you in Marketing, under Ready to post.',
      '- The job’s before and after photos go first; tick the ones you want',
      '- A caption written by AI from the photos and the job, naming the town but never the client or the street',
      '- Write it again as Friendly, Proud, Professional or Shorter, or edit it yourself',
      '- Post to Facebook, Instagram, Google Business Profile and your other accounts in one tap; nothing goes out until you approve it',
      '- Each post links to your booking page, so you see the visits and booking requests it brings in, with a results email on the 1st of each month',
      'On the Advanced and Unlimited plans.',
    ],
  },
  {
    id: 'quote-options', date: '2026-11-08', tag: 'new', title: 'Good / Better / Best quote options (Beta)',
    body: [
      'Give clients a choice on one quote: repair, replace, or replace with the premium model. Turn it on with Offer options in a quote’s Product / Service section, or Options on a phone.',
      '- Two or three options, each with a name, what’s included and its own line items and total',
      '- Mark one Recommended to highlight it, and put items like a service call fee in every option',
      '- The client sees the options side by side and approves the one they want; you’re told which',
      '- Only the chosen option’s items go on the job and invoice',
      '- Mark a quote approved with the client’s choice when they tell you in person',
      'On the Advanced and Unlimited plans.',
    ],
  },
  {
    id: 'job-checklists', date: '2026-11-08', tag: 'new', title: 'Job checklists & forms (Beta)',
    body: [
      'Make checklists your team fills in on site in the new gear → Checklists & Forms, or start from a sample: job completion, site safety check or equipment inspection.',
      '- Items can be checkboxes, Pass / Fail / N/A, typed answers, numbers, dates, choose-one and photos, each optionally required',
      '- Add a checklist to a job from its page, or have it added automatically to every new job or to jobs with certain products or services',
      '- Fill it in on a phone or computer; answers save as you go and photos come straight from the camera',
      '- Make one required, so a job can’t be marked complete until it’s finished',
      '- Print or save any checklist as a PDF, with its photos',
      '- Share finished checklists with the client in their portal, where they can download a PDF too',
      'On the Advanced and Unlimited plans.',
    ],
  },
  {
    id: 'dispatch-map', date: '2026-11-06', tag: 'new', title: 'Dispatch map & route optimization (Beta)',
    body: [
      'The Calendar has a new Map view, next to Day and Week. It shows one day’s visits on a map: each team member’s visits are numbered pins in their color, with a line for their route from your business address.',
      '- Drag a visit onto someone in the list to assign it, or use Assign to on its pin (works on phones too)',
      '- Best order puts a person’s visits in the shortest driving order and shows the new times before you save them',
      '- Directions opens the route through their stops in Google Maps',
      '- Completed visits aren’t moved, and a visit shared with someone else is called out',
      'On the Advanced and Unlimited plans. Drive times are estimates from the distance between stops.',
    ],
  },
  {
    id: 'service-plans', date: '2026-11-06', tag: 'new', title: 'Service plans & memberships (Beta)',
    body: [
      'Sell maintenance plans like “Comfort Club: $19 a month, 2 tune-ups a year, 15% off repairs” from the new Service Plans page in the sidebar.',
      '- Set the price, billed every month, quarter or year, the visits included and a member discount',
      '- Put clients on a plan from Service Plans or the new Service plan card on their page',
      '- Each billing period an invoice is made for every member and, if you like, emailed with the pay link',
      '- The plan’s visits are scheduled ahead as a repeating job, with the time and team you choose',
      '- Members’ new quotes and invoices get the discount automatically',
      '- See active members, monthly recurring revenue and who bills in the next 30 days',
      'On the Advanced and Unlimited plans. Team members need the new Service plans permission (Managers have it).',
    ],
  },
  {
    id: 'recurring-jobs', date: '2026-11-06', tag: 'new', title: 'Recurring jobs (Beta)',
    body: [
      'Set Repeats on a job for work you do on a schedule. Every visit is its own job, with its own number, team, time, invoice and hours.',
      '- Daily, weekly on the days you pick, or monthly on the same date or the same weekday (the 2nd or last Tuesday)',
      '- Every 1, 2, 3… days, weeks or months, ending never, after a number of visits or on a date',
      '- Visits are put on the calendar months ahead and topped up automatically',
      '- Change one visit, or this and all following visits',
      '- More → Stop Repeating After This Visit',
      '- Works on phones too, from the New job screen and the Scheduled visit sheet',
      'Visits that already have an invoice, hours, photos, notes or a signature are never removed. On every plan.',
    ],
  },
  {
    id: 'time-tracking', date: '2026-11-06', tag: 'new', title: 'Time tracking & timesheets (Beta)',
    body: [
      'Your team clocks in and out on a job’s page, or on the new Timesheets page for time without a job.',
      '- Managers see everyone’s week, with overtime over 40 hours flagged',
      '- Fix or add entries, approve them, and export CSV for payroll',
      '- Team members see only their own hours',
      '- Owners and admins can set pay rates, and hours on a job then count as labor in Financial Reports → Job profit',
      'On the Advanced and Unlimited plans.',
    ],
  },
  {
    id: 'reports-accounting', date: '2026-11-06', tag: 'new', title: 'Profit & loss, job profit, and QuickBooks & Xero sync (Beta)',
    body: [
      '## Financial Reports',
      '- Profit & loss, on a cash or accrual basis',
      '- Job profit: what each job was invoiced against its expenses and labor',
      '- Unpaid invoices grouped by how long they’re past due',
      '- Each with dates, Export CSV and Print',
      '## QuickBooks & Xero (Beta)',
      'Connect QuickBooks Online or Xero in Settings → QuickBooks & Xero. Clients, invoices, payments and expenses are sent there every 15 minutes, from a start date you choose, with Sync now and a list of anything that couldn’t be sent.',
    ],
  },
  {
    id: 'on-my-way', date: '2026-11-06', tag: 'new', title: 'On My Way',
    body: [
      'Tap On My Way on a job and pick about how long until you arrive. The client gets a text (if they’ve agreed to texts) or an email with the arrival time, and the job shows “On the way” for the day.',
      '- On computers and phones, for the team on the job and anyone who edits jobs',
      '- Edit the email’s wording in Email Templates',
    ],
  },
  {
    id: 'services-import', date: '2026-11-06', tag: 'improved', title: 'Import products & services from a CSV file',
    body: [
      'Bring your price list in with Import on Products & Services. Columns are matched for you, and the preview skips items already in your list and inactive rows.',
    ],
  },
  {
    id: 'roadmap-beta', date: '2026-11-06', tag: 'improved', title: 'Roadmap: a Beta column',
    body: [
      'The Roadmap now shows what’s in Beta, between In progress and Done, so you can see what’s ready to try.',
    ],
  },
  {
    id: 'automations-flow', date: '2026-11-06', tag: 'new', title: 'Automations: a visual flow editor',
    body: [
      'Each automation now opens as a flow you can see at a glance. The trigger, wait, who it goes to and each action are cards on a canvas joined by lines.',
      '- Tap a card to change its settings in the panel on the right (a sheet from the bottom on phones)',
      '- Add an action with + and remove one with the × on its card',
      '- Cards that are missing a message show a warning, and a save error opens the step it’s about',
      '- Rename the automation right in the header',
      '- Zoom in and out, or fit the whole flow on screen, with the controls in the corner',
    ],
  },
  {
    id: 'client-hub-quotes', date: '2026-11-06', tag: 'improved', title: 'Client hub: quotes look like the rest of the hub',
    body: [
      'When a client opens a quote, it now sits inside their client hub with the hub menu beside it.',
      '- Approve and Request Changes are on the right, and on top on phones',
      '- Download PDF is right on the quote',
      '- New Request is in the hub menu on every page',
      '- When you preview the hub as your business, buttons like Approve, Pay now and Write a review show greyed out with a note, so you can see exactly what your client sees',
    ],
  },
  {
    id: 'auto-save', date: '2026-11-06', tag: 'improved', title: 'Settings save on their own',
    body: [
      'No more Save buttons. Each field saves as soon as you change it.',
      '- My profile, including your photo',
      '- Company Profile',
      '- Team members in Manage Team',
      '- App Settings: branding colors, invoice footer, regional settings, Zelle and number prefixes',
    ],
  },
  {
    id: 'team-access-fixes', date: '2026-11-06', tag: 'fixed', title: 'Fixes for team member logins',
    body: [
      '- Latest updates now lists the newest changes for everyone on your team',
      '- The client page no longer shows a Create button or blank menu lines to people who can’t use them',
      '- Log in as Client shows only for people who can see prices, since the client hub shows quotes and invoices with prices',
    ],
  },
  {
    id: 'instagram-login', date: '2026-11-06', tag: 'improved', title: 'Instagram connects with Instagram Login',
    body: [
      'Connect Instagram by signing in with Instagram itself. You no longer need a Facebook account or Page.',
      'If you connected Instagram before this change, you’ll be asked to connect it again once.',
    ],
  },
  {
    id: 'phone-numbers', date: '2026-11-06', tag: 'improved', title: 'Phone numbers with country codes',
    body: [
      'Every phone number box now has a country code picker, and US numbers are written (123) 456-7890 as you type.',
      'This works everywhere you or your clients enter a phone number: the app, the client hub, your business page and the booking and referral forms.',
    ],
  },
  {
    id: 'sidebar-collapse', date: '2026-11-06', tag: 'improved', title: 'Collapse the sidebar to icons',
    body: [
      'On a computer, the round button on the sidebar’s edge shrinks the menu to icons for more room. Names show when you hover over an icon, and your browser remembers your choice.',
    ],
  },
  {
    id: 'smaller-nov', date: '2026-11-06', tag: 'improved', title: 'Smaller improvements',
    body: [
      '- Clients list: Phone and Email columns after Name; tap one to call or email',
      '- New industries: Low voltage, Networking & Wi-Fi, Security cameras, and Audio & video',
      '- Calendar quick add: the client search list opens right under its box, and tasks and events have just Save',
      '- Marketing → New post lists only the networks you’ve connected',
      '- Account and Billing: Modify subscription opens a step-by-step window to upgrade or change your plan',
    ],
  },
  {
    id: 'business-page', date: '2026-11-03', tag: 'new', title: 'Business Page: a page for your business that your QR code opens',
    body: [
      'Every business now has its own page with your logo, cover, contact buttons, links and a Book online button. Your QR code opens it, so a scan from a truck, flyer or business card lands on one page with everything a client needs.',
      '## What’s new',
      '- Edit it in Settings → Business Page and see a phone preview as you go',
      '- QR code appearance: colors, shapes, a logo in the middle, a frame and text around the code',
      '- Links for X, Instagram, Facebook, LinkedIn and YouTube with their icons, plus custom links with a name and an icon of your choice',
      '- Drag the dotted handle to put links in any order',
      '- Visitors can save your contact card or send you their details, which come in as a new client and request',
      '- Set a scan limit or an end date for the QR code',
      '## How to get started',
      'Open your initials at the top right, choose the QR code, then Edit business page.',
    ],
  },
  {
    id: 'youtube-x', date: '2026-11-03', tag: 'new', title: 'Marketing: post to YouTube and X',
    body: [
      'Upload a post’s video straight to your YouTube channel with a title and privacy setting, and post photos and captions to X.',
      '- YouTube connects with your Google account',
      '- X connects with your own X developer app keys, so X bills your business directly for what you post',
    ],
  },
  {
    id: 'more-networks', date: '2026-11-03', tag: 'new', title: 'Marketing: LinkedIn, Pinterest, TikTok, Threads, Bluesky and Google posts',
    body: [
      'Connect your business’s social accounts in Marketing and post to them from one place.',
      '- LinkedIn company pages, Pinterest boards, Threads, TikTok and Bluesky',
      '- Google Business Profile updates with a photo, and a Book button while online booking on Google is on',
      '- Each connection is its own card in Account Connections',
    ],
  },
  {
    id: 'new-settings', date: '2026-11-03', tag: 'improved', title: 'A new home for Settings and search',
    body: [
      'Settings now opens its own column in the sidebar, grouped under My Business, Business Services and Other Settings, with Go Back to return.',
      '- Search sits under your business logo in the sidebar',
      '- Your initials at the top right open your name, the business QR code and Log out',
      '- Team Requests moves to Settings → My Business, under Manage Team',
    ],
  },
  {
    id: 'link-checkout', date: '2026-11-02', tag: 'improved', title: 'Faster checkout with Link by Stripe',
    body: [
      'Clients can pay invoices and deposits with a card or Link right on the checkout page. Turn Link off in Payments → Settings if you prefer.',
    ],
  },
  {
    id: 'automations', date: '2026-11-01', tag: 'new', title: 'Automations',
    body: [
      'Build rules that email or text clients, or notify your team, when something happens, such as a job completed or an invoice paid.',
      '- Add a Review link to ask happy clients for a review',
      '- Each automation has its own page to edit, turn on or off, or delete',
    ],
  },
  {
    id: 'client-reviews', date: '2026-10-31', tag: 'new', title: 'Client reviews',
    body: [
      'Clients get a private review link when a job is completed or an invoice is paid. Write your own questions, choose which modules ask them, and read the answers under Reviews.',
      '- Clients can add photos and videos and edit their own reviews',
      '- Reply to a review and the client sees your reply in their portal',
    ],
  },
  {
    id: 'phone-signatures', date: '2026-10-31', tag: 'improved', title: 'Signatures and editing on phones',
    body: [
      '- Collect signature opens a full-screen sideways pad, and a signature on a quote approves it',
      '- Signing adds a note with a signed PDF; quotes, jobs and invoices can collect several signatures',
      '- Add line items from a searchable list of products and services',
      '- Rotating the phone no longer closes open pages',
    ],
  },
];

const TAGS = { new: 'New', improved: 'Improved', fixed: 'Fixed' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const niceDate = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
// the first paragraph, for the bell's short preview
const summary = (e) => (e.body.find((l) => !l.startsWith('## ')) || '').replace(/^- /, '');
const latest = (n) => ENTRIES.slice(0, n).map((e) => ({ id: e.id, date: e.date, tag: e.tag, label: TAGS[e.tag], title: e.title, summary: summary(e) }));

function bodyHtml(lines) {
  let out = ''; let list = false;
  for (const l of lines) {
    if (l.startsWith('- ')) { if (!list) { out += '<ul>'; list = true; } out += `<li>${esc(l.slice(2))}</li>`; continue; }
    if (list) { out += '</ul>'; list = false; }
    out += l.startsWith('## ') ? `<h3>${esc(l.slice(3))}</h3>` : `<p>${esc(l)}</p>`;
  }
  return out + (list ? '</ul>' : '');
}

// the entries, for the Changelog tab on ideas.<domain>
const ENTRY_CSS = `.cl-entry{display:grid;grid-template-columns:170px 1fr;gap:20px;padding:24px 0;border-top:1px solid var(--line);scroll-margin-top:16px}
.cl-entry[hidden]{display:none}
.cl-date{color:var(--muted);font-size:14px;padding-top:4px}
.cl-card h2{font-size:21px;line-height:1.3;margin:8px 0 10px}
.cl-card h3{font-size:16px;margin:18px 0 6px}
.cl-card p{margin:0 0 10px}.cl-card ul{margin:0 0 10px;padding-left:22px}.cl-card li{margin:3px 0}
.cl-tag{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:4px;border:1px solid currentColor}
.cl-new{color:var(--new)}.cl-improved{color:var(--improved)}.cl-fixed{color:var(--fixed)}
.cl-entry:target .cl-card h2{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px}
.cl-none{color:var(--muted);padding:24px 0;border-top:1px solid var(--line)}
.cl-none[hidden]{display:none}
@media (max-width:640px){.cl-entry{grid-template-columns:1fr;gap:4px}.cl-date{padding:0}}`;
const entriesHtml = () => ENTRIES.map((e) => `<article class="cl-entry" id="${esc(e.id)}" data-tag="${esc(e.tag)}">
  <div class="cl-date"><time datetime="${esc(e.date)}">${esc(niceDate(e.date))}</time></div>
  <div class="cl-card"><span class="cl-tag cl-${esc(e.tag)}">${esc(TAGS[e.tag])}</span><h2>${esc(e.title)}</h2>${bodyHtml(e.body)}</div>
</article>`).join('\n');

module.exports = { ENTRIES, TAGS, latest, entriesHtml, ENTRY_CSS };
