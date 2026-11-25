// The 23 features, one page each at /features/<slug> (lib/feature-pages.js draws them; the /features overview links to them).
// id: the old anchor on /features (/features#quotes still lands on the page) and the key in lib/features.js (the header menu).
// kicker: the feature's name; badge: New or Updated; headline: the page's big title; intro: the first paragraph; points: what's in it
// (t: title, d: the line under it, badge: New); shot: the screenshot or drawn mock-up. Text is HTML; {product} isn't used here.
module.exports = [
  {
    id: 'quotes', slug: 'quotes', kicker: `Quotes`,
    headline: `Send polished quotes in minutes, not evenings`,
    intro: `Pick services from your price list, adjust quantities, and the totals and sales tax add up for you. Send the quote by email or text while you’re still in the client’s driveway.`,
    points: [
      { t: `Built from your price list`, d: `Saved services fill in the name, description and price.` },
      { t: `Good / Better / Best options`, badge: 'New', d: `Offer 2 or 3 options, each with its own line items and total. The client picks one when they approve. <a href="/good-better-best">See how it works</a>` },
      { t: `Saved discounts and sub items`, badge: 'New', d: `Pick a named discount like “Senior discount (10%)” in a tap, and group parts and add-ons under the main line, shown as “Included” when they’re free.` },
      { t: `Deposits up front`, d: `Ask for a flat or percentage deposit before the work starts.` },
      { t: `Always know where it stands`, d: `Draft, awaiting response, approved or converted at a glance.` },
    ],
    shot: `<figure><div class="f-browser"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i></div>
<img src="/img/features/quotes.webp" alt="A quote for a backyard refresh with tree trimming, lawn maintenance and sprinkler repair line items, subtotal, tax and total" width="1440" height="900" loading="lazy"></div></figure>`,
  },
  {
    id: 'approvals', slug: 'online-approvals', kicker: `Online approvals`,
    headline: `Clients approve with one tap, no printer needed`,
    intro: `Every quote has its own secure link. Your client reviews the line items on their phone, approves it, and pays the deposit on the spot. You get notified right away.`,
    points: [
      { t: `E-signatures`, d: `The client’s approval and signature are saved with the quote.` },
      { t: `Approved quote to job`, d: `Turn it into a scheduled job with every line item carried over. Record the deposit and you’re asked if you want to create the job now.` },
      { t: `Know when they want changes`, badge: 'New', d: `When a client asks for changes, the quote shows their message, the Quotes list flags it, and you get an alert on your phone.` },
    ],
    shot: `<figure><div class="f-browser f-narrow"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i><span>What your client sees</span></div>
<img src="/img/features/approval.webp" alt="The client’s view of quote Q-1001 with line items, the total and Approve quote and Decline buttons" width="820" height="700" loading="lazy"></div></figure>`,
  },
  {
    id: 'scheduling', slug: 'scheduling', kicker: `Scheduling`,
    headline: `See your whole week, and who’s where`,
    intro: `Every job, task and event on one calendar, color-coded by team member. Click an open time to book a job, and drag it to a new slot when plans change.`,
    points: [
      { t: `Day, week and month views`, d: `Switch views and jump to any date from the mini calendar.` },
      { t: `Team calendars`, d: `Show or hide each person’s schedule with a checkbox.` },
      { t: `Team view`, badge: 'New', d: `A column for each person on one day. Drag a job into someone’s column to give it to them, and see each person’s booked hours.` },
      { t: `Drag to schedule`, badge: 'New', d: `Approved quotes that don’t have a job yet wait in a To schedule list. Drag one onto the calendar, then drag its bottom edge to set how long it takes.` },
      { t: `Time off built in`, d: `Approved time off shows up on the schedule automatically.` },
      { t: `In the calendar app you already use`, badge: 'New', d: `A private link puts each person’s jobs in Google Calendar, Outlook or Apple Calendar, and keeps them up to date.` },
    ],
    shot: `<figure><div class="f-browser"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i></div>
<img src="/img/features/calendar.webp" alt="A weekly calendar with jobs color-coded by team member from Monday through Friday" width="1440" height="900" loading="lazy"></div></figure>`,
  },
  {
    id: 'jobs', slug: 'job-management', kicker: `Job management`,
    headline: `Every job, every visit, nothing slips through`,
    intro: `One list of every job with the client, property, schedule and status. See what’s late, what’s coming up, and which finished jobs still need an invoice.`,
    points: [
      { t: `Status at a glance`, d: `Upcoming, late, completed and requires invoicing.` },
      { t: `Filter and search`, d: `By status, team member or client name.` },
    ],
    shot: `<figure><div class="f-browser"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i></div>
<img src="/img/features/jobs.webp" alt="The Jobs list with an overview of late, upcoming and requires-invoicing jobs, and a table of jobs with schedules and status" width="1440" height="900" loading="lazy"></div></figure>`,
  },
  {
    id: 'mobile', slug: 'crew-app', kicker: `Crew app`,
    headline: `Your office, in your crew’s pocket`,
    intro: `Technicians open the job on their phone and get the address, instructions and team in one place. Call, text or map the client with one tap, then mark the job complete.`,
    points: [
      { t: `Nothing to install`, d: `Works in the phone’s browser, with a bottom menu made for the field.` },
      { t: `On-site signatures`, d: `Clients sign off right at the door.` },
      { t: `On My Way texts`, d: `One tap and the client gets an arrival time by text or email.` },
      { t: `No prices for technicians`, d: `Each role sees exactly what it needs.` },
    ],
    shot: `<figure class="f-phone-wrap"><div class="f-phone"><img src="/img/features/mobile.webp" alt="A job on a phone with Call, Text, Email and Map buttons, a Mark Complete button, the scheduled visit and assigned team" width="390" height="844" loading="lazy"></div></figure>`,
  },
  {
    id: 'invoicing', slug: 'invoicing', kicker: `Invoicing`,
    headline: `Turn finished work into an invoice in one click`,
    intro: `Line items come straight from the job, so there’s nothing to retype. Set the payment terms, send it by email or text, and every deposit and payment is tracked against the balance.`,
    points: [
      { t: `Balances that add up`, d: `Invoice balance and the client’s whole account balance.` },
      { t: `Past-due tracking`, d: `Overdue invoices are flagged so you know who to follow up with.` },
      { t: `Invoice every finished job at once`, badge: 'New', d: `One invoice per job or one per client, sent with their pay links in a single step.` },
      { t: `Late fees, if you want them`, badge: 'New', d: `Add a flat fee or a percentage to overdue invoices automatically.` },
    ],
    shot: `<figure><div class="f-browser"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i></div>
<img src="/img/features/invoices.webp" alt="Invoice INV-3010 for Lakeside Apartments with billing details, line items, total and invoice balance" width="1440" height="900" loading="lazy"></div></figure>`,
  },
  {
    id: 'payments', slug: 'online-payments', kicker: `Online payments`,
    headline: `Get paid faster, without chasing checks`,
    intro: `Clients pay from a secure link by card, bank transfer, Zelle, Venmo, Cash App or PayPal. Card and bank payments go straight to your own Stripe account, and the invoice is marked paid automatically.`,
    points: [
      { t: `Card and bank payments`, d: `Through your own Stripe account, with payouts to your bank. Offer either one, or both, on each quote and invoice.` },
      { t: `Zelle, Venmo, Cash App and PayPal`, badge: 'New', d: `A button for each app, with the amount filled in where the app allows. Clients tell you when they’ve sent it, and you confirm it.` },
      { t: `Pay by QR code`, badge: 'New', d: `Show the invoice’s QR code on your phone. The client scans it and pays by card on their own phone, with no card reader, and you see Paid in full in seconds.` },
      { t: `Partial payments`, badge: 'New', d: `Let a client pay part of an invoice now. It shows Partly paid until the rest comes in.` },
      { t: `Every payment logged`, d: `One Payments page with status, method and payout date.` },
      { t: `Tips`, badge: 'New', d: `Let clients add a tip when they pay online. It’s kept apart from the invoice total.` },
      { t: `Receipts in a click`, badge: 'New', d: `Email a receipt for a paid invoice, with the invoice PDF attached.` },
    ],
    shot: `<figure><div class="f-browser f-narrow"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i><span>What your client sees</span></div>
<img src="/img/features/payments.webp" alt="The client’s invoice page with a Pay with card button and Zelle payment details" width="820" height="760" loading="lazy"></div></figure>`,
  },
  {
    id: 'portal', slug: 'client-portal', kicker: `Client portal`,
    headline: `A self-serve portal your clients will actually use`,
    intro: `Each client gets a private link to see upcoming appointments, approve estimates, pay invoices and ask for new work. No app to download and no password to forget.`,
    points: [
      { t: `Pay now, anytime`, d: `Open invoices with a Pay now button and receipts for paid ones.` },
      { t: `Refer a friend`, d: `Happy clients share a link, and their friends arrive as new leads.` },
    ],
    shot: `<figure><div class="f-browser"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i><span>What your client sees</span></div>
<img src="/img/features/portal.webp" alt="The client portal’s Invoices page with the balance due, an invoice awaiting approval with a Pay now button and a paid invoice with a receipt" width="1280" height="800" loading="lazy"></div></figure>`,
  },
  {
    id: 'booking', slug: 'online-booking', kicker: `Online booking`,
    headline: `Take booking requests while you sleep`,
    intro: `Add a booking form to your website and social profiles. New clients tell you what they need, where, and when suits them, and the request lands in your app.`,
    points: [
      { t: `A widget for your website`, badge: 'New', d: `Copy one line of code to add the form to your site, a Book button, or a button in the corner, in your own color.` },
      { t: `New clients added for you`, d: `A client record is created from the request.` },
      { t: `Text-message opt-in`, d: `Clients agree to texts on the form, so reminders are allowed.` },
    ],
    shot: `<figure><div class="f-browser f-narrow"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i><span>Your booking form</span></div>
<img src="/img/features/booking.webp" alt="An online booking form with name, email, phone, service address, what you need done, preferred day and preferred time" width="820" height="890" loading="lazy"></div></figure>`,
  },
  {
    id: 'clients', slug: 'client-manager', kicker: `Client manager`,
    headline: `Every client’s details and history in one place`,
    intro: `Contacts, properties, notes, quotes, jobs and invoices live with the client they belong to. Tag clients, track new leads, and see who you last worked with.`,
    points: [
      { t: `Bring your list`, d: `Import clients from a CSV spreadsheet.` },
      { t: `Clean up duplicates`, d: `Merge two records into one in a couple of clicks.` },
    ],
    shot: `<figure><div class="f-browser"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i></div>
<img src="/img/features/clients.webp" alt="The Clients page with new leads, new clients and total clients, and a list of clients with addresses, status and last activity" width="1440" height="900" loading="lazy"></div></figure>`,
  },
  {
    id: 'photos', slug: 'project-gallery', kicker: `Project gallery`,
    headline: `Before and after photos, saved with every job`,
    intro: `Snap before, progress and after photos on site. They’re filed with the client and job, ready for proof of work, a dispute, or your next social post.`,
    points: [
      { t: `One gallery for everything`, d: `Filter by job and add captions.` },
      { t: `Share your best work`, d: `Post photos to your Facebook Page and Instagram.` },
    ],
    shot: `<figure><div class="f-browser"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i></div>
<img src="/img/features/gallery.webp" alt="The Project Gallery with before, progress and after photos from lawn, gutter, pressure washing and tree trimming jobs" width="1440" height="900" loading="lazy"></div></figure>`,
  },
  {
    id: 'team', slug: 'team-management', kicker: `Team management`,
    headline: `Add your crew and control what each person sees`,
    intro: `Invite team members with their own logins, assign them to jobs, and see each person’s last and next job. Roles decide who can see prices, money and settings.`,
    points: [
      { t: `Roles and permissions`, d: `Owner, admin, manager and technician, or your own roles.` },
      { t: `Working hours`, d: `Set each person’s hours and handle time-off requests.` },
      { id: 'team-location', t: `Team location`, badge: 'New', d: `If you turn it on, each person’s location is saved when they clock in, clock out or tap On My Way, and never in between. Timesheets show how far each clock in was from the job, and the dispatch map shows where everyone was last seen today. Each person is asked first, and saying no never stops them clocking in. On Advanced and Unlimited.` },
      { t: `Two-step login`, badge: 'New', d: `Protect each login with a code from an authenticator app, or require it for your whole team.` },
    ],
    shot: `<figure><div class="f-browser"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i></div>
<img src="/img/features/team.webp" alt="The Manage team page listing team members with their role, last job, next job, status and contact details" width="1440" height="900" loading="lazy"></div></figure>`,
  },
  {
    id: 'services', slug: 'products-and-services', kicker: `Products &amp; services`,
    headline: `One price list for every quote and invoice`,
    intro: `Save your services and products once, with descriptions and prices per visit, hour or job. They fill in with a tap, so every quote is consistent.`,
    points: [
      { t: `Costs and markups`, d: `Know your margin on every line item.` },
      { t: `Categories`, badge: 'New', d: `Group your price list (lawn, irrigation, snow) and see each category’s sales and expenses in reports.` },
      { t: `Change many at once`, d: `Recategorize, rename a category or delete several items in one go.` },
      { t: `AI writing help`, d: `Get a clear description for any service in seconds.` },
    ],
    shot: `<figure><div class="f-browser"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i></div>
<img src="/img/features/services.webp" alt="The Products and services list with gutter cleaning, lawn maintenance, pressure washing, sprinkler repair and tree trimming and their prices" width="1440" height="900" loading="lazy"></div></figure>`,
  },
  {
    id: 'expenses', slug: 'expense-tracking', kicker: `Expense tracking`,
    headline: `Know what every job really earned`,
    intro: `Log fuel, materials, equipment and subcontractor costs as they happen, and link them to the job they were for. Totals by category are always up to date.`,
    points: [
      { t: `Linked to jobs`, d: `See costs next to the revenue they produced.` },
      { t: `Ready for tax time`, d: `Filter by job and see totals by category.` },
    ],
    shot: `<figure><div class="f-browser"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i></div>
<img src="/img/features/expenses.webp" alt="The Expense Tracker with totals by category and a list of expenses with vendor, description and the job they belong to" width="1440" height="900" loading="lazy"></div></figure>`,
  },
  {
    id: 'reports', slug: 'reports', kicker: `Reports`, badge: 'Updated',
    headline: `See how your business is really doing`,
    intro: `Over 20 reports on money, work, clients and expenses: profit &amp; loss, transactions, aged receivables, visits, quotes, team productivity, lead sources and more, all ready when your accountant asks.`,
    points: [
      { t: `Charts and totals`, d: `Each report shows its totals and a chart by day, week or month, for any dates or all time.` },
      { t: `Make it yours`, d: `Search, filter, sort, choose the columns, and star the reports you use most.` },
      { t: `Export to CSV`, d: `Download exactly the rows and columns you see, plus a sales tax summary by month.` },
    ],
    shot: `<figure><div class="f-browser"><div class="f-bar" aria-hidden="true"><i></i><i></i><i></i></div>
<img src="/img/features/reports.webp" alt="Financial Reports with revenue this month, paid and pending invoices, a twelve-month revenue chart and popular services" width="1440" height="900" loading="lazy"></div></figure>`,
  },
  {
    id: 'recurring', slug: 'recurring-jobs', kicker: `Recurring jobs`, badge: 'New',
    headline: `Book the job once. Every visit after that is on the calendar.`,
    intro: `Weekly mowing, monthly pest treatments, quarterly filter changes: set how often a job repeats and every visit is scheduled ahead, each with its own team, time, invoice and hours. Included in every plan.`,
    points: [
      { t: `Any pattern`, d: `Daily, weekly on chosen days, or monthly on a date or a weekday like “the 2nd Tuesday”. End it never, after a number of visits or on a date.` },
      { t: `Change one visit or all that follow`, d: `Move this week’s visit for a holiday, or change the team for the rest of the season.` },
      { t: `Nothing gets lost`, d: `Visits with invoices, photos, notes or hours on them are never removed.` },
    ],
    shot: `<figure aria-label="A repeating job with its upcoming visits"><div class="m-ui">
<h4>Weekly lawn maintenance <span class="m-pill i">↻ Every week on Tue</span></h4><p class="m-sub">Visit 3 of 26 · ends Oct 27</p>
<div class="m-row"><span><b>Tue, May 5</b> · 8:00 am</span><span>Crew A</span><span class="m-pill">Completed</span></div>
<div class="m-row"><span><b>Tue, May 12</b> · 8:00 am</span><span>Crew A</span><span class="m-pill">Invoiced</span></div>
<div class="m-row"><span><b>Tue, May 19</b> · 8:00 am</span><span>Crew A</span><span class="m-pill i">Today</span></div>
<div class="m-row"><span><b>Tue, May 26</b> · 9:30 am</span><span>Crew B</span><span class="m-pill w">Moved</span></div>
<div class="m-row"><span><b>Tue, Jun 2</b> · 8:00 am</span><span>Crew A</span><span class="m-pill v">Scheduled</span></div>
</div></figure>`,
  },
  {
    id: 'service-plans', slug: 'service-plans', kicker: `Service plans &amp; memberships`, badge: 'New',
    headline: `Turn one-time customers into monthly revenue`,
    intro: `Sell maintenance plans and memberships billed every month, quarter or year. Each billing period the invoice is made and emailed with a pay link, the included visits are scheduled for you, and members get their discount on every quote and invoice.`,
    points: [
      { t: `Predictable income`, d: `See active members, monthly recurring revenue and who bills in the next 30 days.` },
      { t: `Visits included`, d: `Tune-ups, treatments or cleanings are booked ahead with the team and time you choose.` },
      { t: `Member pricing`, d: `A member discount applies to new quotes and invoices automatically.` },
    ],
    shot: `<figure aria-label="The Service Plans page with members and monthly recurring revenue"><div class="m-ui">
<h4>Service plans</h4><p class="m-sub">Members renew and get invoiced on their own</p>
<div class="m-stats"><div><b>48</b><span>Active members</span></div><div><b>$1,392</b><span>Monthly recurring</span></div><div><b>17</b><span>Bill in 30 days</span></div></div>
<div class="m-row"><span><b>Comfort Club</b><br>2 tune-ups a year · 15% off repairs</span><span class="m-pill">$19/mo</span></div>
<div class="m-row"><span><b>Pest Shield</b><br>4 treatments a year · 10% off</span><span class="m-pill">$129/qtr</span></div>
<div class="m-row"><span><b>Pool Care Plus</b><br>52 cleanings a year · 20% off parts</span><span class="m-pill">$1,500/yr</span></div>
</div></figure>`,
  },
  {
    id: 'dispatch', slug: 'dispatch-map', kicker: `Dispatch map &amp; route optimization`, badge: 'New',
    headline: `See the whole day on a map, and drive less`,
    intro: `Every visit is a numbered pin in its team member’s color, with each person’s route drawn from your shop. Drag a visit onto someone to assign it, then tap Best order to put their stops in the shortest driving order.`,
    points: [
      { t: `Best order in one tap`, d: `See the new times before you save them; each visit keeps its length and the drive between stops is added.` },
      { t: `Assign by dragging`, d: `Or use Assign to on a pin, which works on phones too.` },
      { t: `Directions for the crew`, d: `Opens Google Maps through all of a person’s stops for the day.` },
    ],
    shot: `<figure aria-label="A dispatch map with three team members' routes and numbered stops"><div class="m-ui">
<h4>Tuesday, May 19 <span class="m-pill">Best order</span></h4>
<svg class="m-map" viewBox="0 0 480 280" role="img" aria-label="Map of three routes from the shop">
<g stroke="currentColor" stroke-opacity=".09" stroke-width="10" fill="none"><path d="M0 70h480M0 160h480M0 240h480M90 0v280M220 0v280M360 0v280"/></g>
<polyline points="230,150 150,70 90,40 40,90" fill="none" stroke="#2563eb" stroke-width="4" stroke-linejoin="round"/>
<polyline points="230,150 300,90 380,60 440,110" fill="none" stroke="#16a34a" stroke-width="4" stroke-linejoin="round"/>
<polyline points="230,150 280,220 180,250 90,210" fill="none" stroke="#ea580c" stroke-width="4" stroke-linejoin="round"/>
<rect x="218" y="138" width="24" height="24" rx="5" fill="#64748b"/><path d="M230 143l7 6v8h-14v-8z" fill="#fff"/>
<g font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="#fff" text-anchor="middle">
<circle cx="150" cy="70" r="12" fill="#2563eb"/><text x="150" y="74">1</text><circle cx="90" cy="40" r="12" fill="#2563eb"/><text x="90" y="44">2</text><circle cx="40" cy="90" r="12" fill="#2563eb"/><text x="40" y="94">3</text>
<circle cx="300" cy="90" r="12" fill="#16a34a"/><text x="300" y="94">1</text><circle cx="380" cy="60" r="12" fill="#16a34a"/><text x="380" y="64">2</text><circle cx="440" cy="110" r="12" fill="#16a34a"/><text x="440" y="114">3</text>
<circle cx="280" cy="220" r="12" fill="#ea580c"/><text x="280" y="224">1</text><circle cx="180" cy="250" r="12" fill="#ea580c"/><text x="180" y="254">2</text><circle cx="90" cy="210" r="12" fill="#ea580c"/><text x="90" y="214">3</text>
</g></svg>
<div class="m-legend"><span><i style="background:#2563eb"></i>Maria · 3 visits</span><span><i style="background:#16a34a"></i>James · 3 visits</span><span><i style="background:#ea580c"></i>Crew B · 3 visits</span></div>
</div></figure>`,
  },
  {
    id: 'timesheets', slug: 'time-tracking', kicker: `Time tracking &amp; timesheets`, badge: 'New',
    headline: `Hours you can trust, ready for payroll`,
    intro: `Your team clocks in and out on the job from their phone. Managers see everyone’s week with overtime flagged, fix and approve entries, and export a CSV for payroll. Hours on a job count as labor cost, so you see what each job really earned.`,
    points: [
      { t: `Clock in on the job`, d: `One tap on the job page, with an “On the clock” badge so nobody forgets.` },
      { t: `Overtime at a glance`, d: `Hours over 40 in a week are called out before payday.` },
      { t: `Pay rates stay private`, d: `Only the owner and admins see them.` },
    ],
    shot: `<figure aria-label="A weekly timesheet with hours per team member and overtime"><div class="m-ui">
<h4>Timesheets · May 18–24 <span class="m-pill">Approved</span></h4><p class="m-sub">Export CSV for payroll</p>
<table class="m-table"><thead><tr><th>Team member</th><th class="n">Regular</th><th class="n">Overtime</th><th class="n">Jobs</th></tr></thead>
<tbody><tr><td>Maria Lopez</td><td class="n">40.0 h</td><td class="n ot">4.5 h</td><td class="n">14</td></tr>
<tr><td>James Carter</td><td class="n">38.25 h</td><td class="n">0</td><td class="n">12</td></tr>
<tr><td>Devon Price</td><td class="n">40.0 h</td><td class="n ot">1.75 h</td><td class="n">15</td></tr>
<tr><td>Sam Nguyen</td><td class="n">22.5 h</td><td class="n">0</td><td class="n">8</td></tr></tbody></table>
</div></figure>`,
  },
  {
    id: 'automations', slug: 'automations', kicker: `Automations`, badge: 'New',
    headline: `Follow-ups that happen without you`,
    intro: `Build simple rules that message clients or your team at the right moment: nudge a quote that hasn’t been approved, remind a client their invoice is due, say thank you after a job, or ask for a review.`,
    points: [
      { t: `Win more quotes`, d: `A friendly follow-up goes out days after a quote is sent, if the client hasn’t answered.` },
      { t: `Get paid sooner`, d: `Reminders before and after an invoice is due.` },
      { t: `Thank-yous on time, every time`, d: `A note after the job is done, sent in your words.` },
      { t: `Alerts in Slack`, badge: 'New', d: `Get a message in your Slack channel when a booking comes in, a quote is approved or an invoice is paid.` },
    ],
    shot: `<figure aria-label="An automation that follows up on unapproved quotes"><div class="m-ui">
<h4>Quote follow-up <span class="m-pill">On</span></h4><p class="m-sub">Runs for every quote you send</p>
<div class="m-flow">
<div class="m-step"><i>1</i><span><b>When a quote is sent</b><small>Any client, any amount</small></span></div><div class="m-arrow">↓</div>
<div class="m-step"><i>2</i><span><b>Wait 3 days</b><small>Skip if it’s been approved</small></span></div><div class="m-arrow">↓</div>
<div class="m-step"><i>3</i><span><b>Text the client</b><small>“Hi Jordan, any questions about your quote? Approve it here…”</small></span></div>
</div>
</div></figure>`,
  },
  {
    id: 'accounting', slug: 'job-profit', kicker: `Job profit &amp; accounting`, badge: 'New',
    headline: `Know which jobs make money, and skip the double entry`,
    intro: `Job profit puts each job’s revenue next to its expenses and labor. Profit &amp; loss and unpaid-invoice aging are one click away. Connect QuickBooks Online or Xero and clients, invoices, payments and expenses are sent over automatically.`,
    points: [
      { t: `Real job costing`, d: `Materials from your expenses plus labor from timesheets.` },
      { t: `Profit &amp; loss`, d: `Cash or accrual, with CSV export and print.` },
      { t: `QuickBooks &amp; Xero sync`, d: `Every 15 minutes, so your bookkeeper always has the latest. (Beta)` },
    ],
    shot: `<figure aria-label="The Job profit report with revenue, expenses, labor and profit per job"><div class="m-ui">
<h4>Job profit · May</h4><p class="m-sub">Revenue against materials and labor</p>
<table class="m-table"><thead><tr><th>Job</th><th class="n">Revenue</th><th class="n">Expenses</th><th class="n">Labor</th><th class="n">Profit</th></tr></thead>
<tbody><tr><td>AC install · Patel</td><td class="n">$7,800</td><td class="n">$3,950</td><td class="n">$720</td><td class="n pos">$3,130</td></tr>
<tr><td>Repipe · Morales</td><td class="n">$4,200</td><td class="n">$1,180</td><td class="n">$960</td><td class="n pos">$2,060</td></tr>
<tr><td>Roof repair · Kim</td><td class="n">$1,650</td><td class="n">$410</td><td class="n">$380</td><td class="n pos">$860</td></tr></tbody></table>
<p class="m-sub" style="margin:12px 0 0">✓ Synced to QuickBooks Online 4 minutes ago</p>
</div></figure>`,
  },
  {
    id: 'checklists', slug: 'checklists-and-forms', kicker: `Checklists &amp; forms`, badge: 'New',
    headline: `Every job done the same right way`,
    intro: `Build the checklists your crew follows on site: inspections, safety checks, the photos you always need. Add one to a job, to every job, or to jobs with a certain service, and your team fills it in on their phone. Make one required, and the job can’t be closed until it’s done.`,
    points: [
      { t: `Pass / Fail, notes and photos`, d: `Checkboxes, answers, numbers, choices and camera photos in one list.` },
      { t: `Nothing skipped`, d: `Required items are flagged, and a required checklist has to be finished before the job is marked complete.` },
      { t: `Proof for the client`, d: `Share the finished checklist in their portal, or send it as a PDF.` },
    ],
    shot: `<figure aria-label="A finished AC tune-up checklist with pass and fail results"><div class="m-ui">
<h4>AC tune-up checklist <span class="m-pill">Finished</span></h4><p class="m-sub">Job #J-2041 · Patel residence · 6 photos</p>
<table class="m-table"><thead><tr><th>Item</th><th class="n">Result</th></tr></thead>
<tbody><tr><td>Filter replaced</td><td class="n pos">✓ Done</td></tr>
<tr><td>Refrigerant pressure in range</td><td class="n pos">Pass</td></tr>
<tr><td>Capacitor reading</td><td class="n ot">Fail</td></tr>
<tr><td>Condensate line flushed</td><td class="n pos">✓ Done</td></tr>
<tr><td>Thermostat calibrated</td><td class="n pos">Pass</td></tr></tbody></table>
<p class="m-sub" style="margin:12px 0 0">Recommended: replace the capacitor before summer</p>
</div></figure>`,
  },
  {
    id: 'languages', slug: 'languages', kicker: `Languages`, badge: 'New',
    headline: `Quotes and invoices in your client’s language`,
    intro: `Speak to every client in the language they’re most comfortable with. Set a language for each client, and their quotes, invoices, reminders and receipts, the PDFs, the pages where they approve and pay, and their client portal all appear in it. You keep working in yours.`,
    points: [
      { t: `Emails in every language, in your words`, d: `Each email has a version for every language you offer, ready to edit, and the app tells you which language an email is going out in.` },
      { t: `Approve, sign and pay in their language`, d: `The quote page, deposits, the pay page and card checkout all match the client’s language.` },
      { t: `The client chooses`, d: `Clients can switch languages in their portal. Spanish is ready today, more languages are on the way, and you can request the one you need.` },
    ],
    shot: `<figure aria-label="An invoice sent to a client in their own language, here Spanish"><div class="m-ui">
<h4>Factura INV-3042 <span class="m-pill">Español</span></h4><p class="m-sub">Para Ana Morales · 13 nov 2026</p>
<table class="m-table"><thead><tr><th>Descripción</th><th class="n">Importe</th></tr></thead>
<tbody><tr><td>Mantenimiento de jardín</td><td class="n">$180.00</td></tr>
<tr><td>Limpieza de canaletas</td><td class="n">$145.00</td></tr>
<tr><td><b>Saldo pendiente</b></td><td class="n"><b>$325.00</b></td></tr></tbody></table>
<p class="m-sub" style="margin:12px 0 0">Pagar ahora · Tarjeta, banco, Zelle o Venmo</p>
</div></figure>`,
  },
];
