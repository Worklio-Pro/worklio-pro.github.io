// Industries (/industries and /industries/<slug>): one page per trade, describing how the app helps that kind of business,
// plus the "Industries" menu in the header of the public pages (home, pricing, these pages) and the trades strip on the home page.
// Served by the platform site (lib/platform.js). Edit the wording in INDUSTRIES; {p} becomes the product name.
// Only describe features the app has. Photos are in public/img/industries/<slug>.jpg (Unsplash License: free to use, no attribution needed).
const tenancy = require('./tenancy');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// icons for the "how it helps" cards
const ICONS = {
  quote: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  portal: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  sign: '<path d="M3 17c3-3 5-8 7-8s-1 8 2 8 3-4 5-4 2 3 4 3"/><path d="M3 21h18"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  repeat: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
  member: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14.5-1.5 7 5-3 5 3-1.5-7"/>',
  route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  profit: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
};

// the newer tools (recurring jobs, service plans, dispatch map, timesheets, automations, job profit), in each trade's words: 3 × [icon, title, text] per page.
// Which plan has which is said once on the page (newIntro); keep each line to what the feature really does.
const NEW_TOOLS = {
  hvac: [['member', 'Sell maintenance agreements', 'Put homeowners on a comfort club billed monthly or yearly. Their spring and fall tune-ups are scheduled for you, the invoice goes out with a pay link, and members get their discount on every repair quote.'],
    ['route', 'Dispatch from a map', 'See every tech’s calls on a map in their color, drag an emergency onto whoever is closest, and put each route in the shortest driving order.'],
    ['profit', 'Know what each install earned', 'Job profit puts the equipment, parts and your techs’ clocked hours against the invoice, so you know which installs and which techs make money.']],
  plumbing: [['route', 'Fit the emergency in, drive less', 'See the day on a map, drag the burst pipe onto the plumber who’s nearest, and re-order their remaining stops with Best order.'],
    ['clock', 'Hours from the job site', 'Plumbers clock in and out on the job from their phone. Approve the week, see overtime and export it for payroll.'],
    ['member', 'Drain and water heater plans', 'Sell yearly flush or inspection plans with a member discount. The visit is scheduled and the invoice is sent on its own.']],
  electrical: [['clock', 'Time tracking for crews and apprentices', 'Everyone clocks in on the job, managers approve timesheets with overtime flagged, and labor counts against each job.'],
    ['profit', 'Job costing that’s actually right', 'Wire, breakers, permits and labor hours against the invoice for every job. Sync it all to QuickBooks Online or Xero.'],
    ['member', 'Safety inspection and generator plans', 'Bill generator maintenance or yearly safety inspections as a plan, with the visits booked ahead.']],
  'lawn-care': [['repeat', 'Weekly mowing that schedules itself', 'Set a property to repeat every week or every other week for the season. Every visit is on the calendar with its own crew and invoice, and rain days move one visit or the rest of the season.'],
    ['route', 'Tighter routes, less windshield time', 'See each crew’s stops on a map and put them in the shortest driving order. Directions opens Google Maps through the whole route.'],
    ['member', 'Seasonal care programs', 'Sell a fertilization or full-season program billed monthly. Treatments are booked ahead and members get a discount on extras like mulch and cleanups.']],
  'house-cleaning': [['repeat', 'Recurring cleans on autopilot', 'Weekly, every-other-week or monthly cleans are booked ahead with the same cleaner and time. Skip one for a holiday without touching the rest.'],
    ['clock', 'Cleaner hours for payroll', 'Cleaners clock in when they arrive and out when they leave. Approve the week and export it for payroll.'],
    ['bolt', 'Reminders and thank-yous that send themselves', 'Automations remind clients before a clean, follow up on quotes and thank them afterward, so you’re not texting all evening.']],
  'commercial-cleaning': [['repeat', 'Contracts with nightly or weekly service', 'Set each site to repeat on the days in the contract, like Monday, Wednesday and Friday nights, with the crew assigned to every visit.'],
    ['clock', 'Proof of hours on every site', 'Crews clock in and out at each building. You see who worked where, and for how long, before you invoice and run payroll.'],
    ['profit', 'Which accounts are profitable', 'Job profit shows each site’s revenue against supplies and labor hours, so you can reprice the contracts that don’t pay.']],
  roofing: [['profit', 'Profit on every roof', 'Shingles, dumpsters and crew hours against the invoice for each job, plus profit & loss when you need the big picture.'],
    ['clock', 'Crew hours from the roof', 'Your crew clocks in on the job from their phone, with overtime flagged before payday.'],
    ['member', 'Roof and gutter maintenance plans', 'Sell yearly inspections or twice-a-year gutter cleanings as a plan that bills and schedules itself.']],
  'pest-control': [['repeat', 'Quarterly treatments, never missed', 'Set a treatment to repeat every month or quarter. Every follow-up is on the calendar ahead of time, with the tech assigned.'],
    ['member', 'Protection plans that renew themselves', 'Bill clients monthly, quarterly or yearly for a protection plan. The treatments are scheduled, the invoice is emailed with a pay link, and members get a discount on one-off services.'],
    ['route', 'Routes in driving order', 'Put each tech’s stops for the day in the shortest driving order and send them directions in one tap.']],
  'pool-service': [['repeat', 'Weekly pools on repeat', 'Every pool on your route repeats weekly with the same tech and day. Holidays move one visit, not the whole season.'],
    ['route', 'The route on a map', 'See each tech’s pools on a map and let Best order put them in the shortest driving order.'],
    ['member', 'Monthly service plans', 'Bill weekly cleaning as a monthly plan with the visits included and a member discount on parts and repairs.']],
  painting: [['clock', 'Crew hours on every project', 'Painters clock in on the job, and hours count as labor cost, so you see what each room really cost you.'],
    ['profit', 'Profit per job', 'Paint, supplies and labor against the invoice for every job. Find out which kinds of jobs to chase.'],
    ['bolt', 'Quote follow-ups that win jobs', 'An automation follows up a few days after you send a quote, while the homeowner is still deciding.']],
  handyman: [['route', 'More small jobs in a day', 'See the day’s stops on a map and put them in the shortest driving order, so there’s room for one more job.'],
    ['member', 'Home maintenance memberships', 'Sell a yearly home care plan with a few visits included and a member discount on everything else.'],
    ['clock', 'Track your helpers’ hours', 'Helpers clock in on the job from their phone, and you approve and export the week for payroll.']],
  'pressure-washing': [['repeat', 'Repeat customers on a schedule', 'Set storefronts, drive-thrus and HOAs to repeat monthly or quarterly, each visit booked ahead with its own invoice.'],
    ['route', 'Routes that save fuel', 'See the day’s jobs on a map and put each rig’s stops in the shortest driving order.'],
    ['bolt', 'Follow-ups and review requests', 'Automations follow up on quotes and thank customers after the job, while the before and after is still fresh.']],
  'window-cleaning': [['repeat', 'Storefront routes on repeat', 'Monthly or every-other-week storefronts repeat on their own, with the same crew and day.'],
    ['route', 'Build the route on a map', 'Drag stops between crews and use Best order for the shortest drive.'],
    ['member', 'Residential plans', 'Sell twice-a-year or quarterly window plans that bill and book themselves.']],
  'carpet-cleaning': [['repeat', 'Commercial accounts on repeat', 'Offices and rentals can repeat every month or quarter, each visit with its own invoice.'],
    ['member', 'Annual cleaning plans', 'Sell a yearly plan with cleans included and a member discount on upholstery and stain treatment.'],
    ['route', 'The van’s day in driving order', 'See every stop on a map and put them in the shortest driving order.']],
  'tree-care': [['clock', 'Climber and ground crew hours', 'Everyone clocks in on the job, with overtime flagged and a payroll export at the end of the week.'],
    ['profit', 'Profit on every removal', 'Equipment rental, dump fees and labor hours against the invoice, so you price the next big removal right.'],
    ['member', 'Plant health care programs', 'Sell yearly pruning or treatment programs that schedule and invoice themselves.']],
  moving: [['clock', 'Hourly moves, accurate hours', 'Movers clock in and out on the job, so every hourly move has a real record of time and payroll matches.'],
    ['profit', 'Profit per move', 'Truck, fuel, supplies and crew hours against the invoice for each move.'],
    ['route', 'Crews and trucks on a map', 'See where every crew is booked today and assign the next job to the one nearby.']],
  remodeling: [['clock', 'Labor hours by project', 'Your crew and subs clock in on each project, so labor shows up against the job, not just on payroll.'],
    ['profit', 'Job costing for every remodel', 'Materials, subs and labor against what you invoiced, with profit & loss and QuickBooks or Xero sync for your bookkeeper.'],
    ['bolt', 'Follow up on every bid', 'An automation nudges the homeowner a few days after the quote goes out, so your bid isn’t forgotten.']],
  'decks-fencing': [['profit', 'Know your margin per foot', 'Lumber, hardware and crew hours against the invoice for every build.'],
    ['clock', 'Crew time on site', 'Clock in and out on the job from a phone, with overtime called out before payday.'],
    ['member', 'Staining and sealing plans', 'Sell a yearly deck care plan that books the visit and bills for it automatically.']],
  flooring: [['profit', 'Profit on every install', 'Material, underlayment and installer hours against the invoice for each job.'],
    ['clock', 'Installer hours', 'Installers clock in on the job, and you approve and export timesheets for payroll.'],
    ['bolt', 'Quote follow-ups', 'Automations follow up on quotes you’ve sent so homeowners don’t go with the next bid.']],
  'low-voltage': [['clock', 'Tech hours on every install', 'Techs clock in on the job, so labor on each install is known and payroll is simple.'],
    ['profit', 'Profit per project', 'Cable, jacks and labor against the invoice, with QuickBooks or Xero sync.'],
    ['member', 'Service agreements', 'Sell monthly or yearly support plans with visits included and a member discount on new drops.']],
  networking: [['member', 'Managed service plans', 'Bill monthly or yearly support plans with check-up visits scheduled automatically.'],
    ['repeat', 'Scheduled maintenance visits', 'Set quarterly network check-ups to repeat, each with its own tech and invoice.'],
    ['route', 'On-site calls in driving order', 'See the day’s calls on a map and route each tech the shortest way.']],
  'security-cameras': [['member', 'Monitoring and maintenance plans', 'Bill yearly or monthly camera maintenance plans, with the check-up visits booked for you.'],
    ['profit', 'Profit per system', 'Cameras, NVRs and install hours against the invoice for every job.'],
    ['clock', 'Installer hours', 'Installers clock in on the job and you approve the week for payroll.']],
  'audio-video': [['profit', 'Profit on every install', 'Gear, mounts and install hours against the invoice for every room.'],
    ['member', 'Support plans', 'Sell a yearly support plan with a tune-up visit and a member discount on upgrades.'],
    ['clock', 'Install crew hours', 'Your crew clocks in on the job, with overtime flagged and a payroll export.']],
};
const newIntro = 'Recurring jobs come with every plan. Service plans, the dispatch map, time tracking, job checklists and job profit are on Advanced and Unlimited, and automations on Unlimited.';

// slug, name, emoji (menu), blurb (cards), title + lead (hero), alt (photo), pains (3 × [title, text]),
// helps (4 × [icon, title, text]), steps (Quote, Schedule, Do the work, Get paid), faq ([question, answer])
const INDUSTRIES = [
  { slug: 'hvac', name: 'HVAC', emoji: '❄️', blurb: 'Quote installs and repairs on the spot, dispatch techs and get paid before you leave the driveway.',
    title: 'HVAC software that keeps your techs moving', lead: 'From the no-heat call at 7am to the new system install next week, {p} keeps your quotes, schedule, techs and payments in one place, so the office and the field always know what’s next.',
    alt: 'Two HVAC technicians working on rooftop air conditioning units',
    pains: [['Phones ring off the hook in peak season', 'When the first heat wave hits, every call is urgent. Without one shared schedule, jobs get double-booked or forgotten.'],
      ['Big-ticket quotes stall', 'A new system is a big decision. Paper quotes sit on the kitchen counter while the homeowner gets two more bids.'],
      ['Chasing payments after the fact', 'Invoices written up back at the shop go out days later, and the checks come in even later.']],
    helps: [['quote', 'Good-better-best quotes they can sign', 'Build replacement and repair quotes from your saved equipment and labor prices. Homeowners review them on their phone, sign online and pay a deposit to lock in the install date.'],
      ['calendar', 'A dispatch board for the busy season', 'See every tech’s day on one calendar, drag jobs to reschedule when an emergency comes in, and text clients a heads-up before you arrive.'],
      ['phone', 'Everything the tech needs on site', 'The address, job notes and the client’s history on the tech’s phone. Technicians see the work, never your prices.'],
      ['card', 'Paid at the end of the visit', 'Turn the finished job into an invoice in one tap. Clients pay by card, Zelle or Venmo from a secure link, and the payment lands in your own Stripe account.']],
    steps: ['Quote the new system from the homeowner’s living room; they sign and pay the deposit on the spot.', 'Drop the install on the calendar, assign your crew and send the client a reminder.', 'Your techs have the equipment notes, snap before and after photos and get a sign-off.', 'Invoice in one tap and get paid by card before the van leaves.'],
    faq: [['Can my techs use it from the truck?', 'Yes. Everyone signs in from the browser on their phone, with a simple bottom menu made for the field. There’s nothing to install.'],
      ['Can I save my equipment and labor prices?', 'Yes. Add units, parts and labor to your products and services catalog once, then build quotes from it in a couple of taps. “Write with AI” can draft the descriptions.']] },

  { slug: 'plumbing', name: 'Plumbing', emoji: '🔧', blurb: 'Handle emergency calls, quote repairs on site and collect payment the moment the leak is fixed.',
    title: 'Plumbing software built for the next emergency call', lead: 'Burst pipes don’t wait for the office to open. {p} gives your plumbers the job details on their phone, lets them quote and invoice on site, and gets you paid the same day.',
    alt: 'A plumber in overalls repairing pipes in a bathroom, with a toolbox',
    pains: [['Emergencies blow up the schedule', 'A slab leak comes in at 10am and the rest of the day has to move. Calling around to reshuffle wastes time you don’t have.'],
      ['Quotes on scraps of paper', 'Repipes and water heater swaps get quoted on the back of an invoice pad and are hard to follow up on.'],
      ['No proof when things go wrong', 'Without photos and a signature, a dispute about what was found behind the wall is your word against theirs.']],
    helps: [['calendar', 'Reshuffle the day in seconds', 'Drag jobs between plumbers and time slots when emergencies come in. Everyone sees the change on their phone right away.'],
      ['quote', 'Quotes that turn into jobs', 'Quote a water heater or repipe on site from your saved prices. When the client signs, it becomes a scheduled job with every line item carried over.'],
      ['camera', 'Photos and signatures on every job', 'Snap the corroded fitting before and the clean install after, then get the client’s signature at the door. It’s all saved with the job.'],
      ['card', 'Collect payment on the spot', 'Send the invoice by text before you pack up. Clients pay by card, Zelle or Venmo and the balance updates on its own.']],
    steps: ['Quote the repair on site from your price list; the client approves it on their phone.', 'Fit the job into the day and let the client know when you’ll arrive.', 'Take before and after photos and get a signature when the water’s back on.', 'Invoice by text and get paid before the next call.'],
    faq: [['Can clients request work on their own?', 'Yes. Your online booking page and each client’s portal let them send a work request, which shows up for you as a new request.'],
      ['Can I bring my existing client list?', 'Yes. Import clients from a CSV spreadsheet and merge duplicates in a couple of clicks.']] },

  { slug: 'electrical', name: 'Electrical', emoji: '⚡', blurb: 'Quote panel upgrades and service calls, keep your crews on schedule and get paid faster.',
    title: 'Electrical contractor software that keeps jobs wired together', lead: 'Service calls, panel upgrades, EV chargers and new construction: {p} gives your electricians the schedule, details and paperwork they need, and gives you the numbers to run the business.',
    alt: 'An electrician in a hard hat and gloves working on an electrical box',
    pains: [['Estimates take your evenings', 'Writing up panel upgrade and rewire quotes after a full day on the tools eats into family time.'],
      ['Crews and apprentices in different places', 'Keeping track of who’s on which job, and who’s off next week, takes a dozen texts a day.'],
      ['Not knowing which jobs make money', 'Material costs pile up on receipts, and it’s hard to see what a job really earned.']],
    helps: [['quote', 'Fast, professional estimates', 'Build quotes from saved materials and labor rates in minutes. Clients sign and pay a deposit online, so you can order the panel with confidence.'],
      ['team', 'Your crew, organized', 'Assign electricians and apprentices to jobs on one calendar. Team members request time off in the app and managers see who’s available.'],
      ['receipt', 'Expenses linked to each job', 'Log wire, breakers and permits against the job they were for, so you know exactly what each job earned.'],
      ['chart', 'Reports when your accountant asks', 'Revenue by month, paid vs pending, popular services and sales tax collected, ready to export.']],
    steps: ['Send the panel upgrade quote from your phone; the client signs and pays the deposit.', 'Schedule the crew, and the client gets a reminder before the visit.', 'Your electricians have the notes on site, take photos and collect a sign-off.', 'Invoice in one click and track who’s paid.'],
    faq: [['Can I keep prices hidden from apprentices?', 'Yes. Technicians see their schedule, clients and jobs without any prices. Custom roles let you choose exactly what each role can see.'],
      ['Does it track sales tax?', 'Yes. The tax summary shows sales tax collected by month, and you can export it to CSV.']] },

  { slug: 'lawn-care', name: 'Lawn care & landscaping', emoji: '🌿', blurb: 'Quote installs, organize your crews by day and show off your work with before and after photos.',
    title: 'Lawn care and landscaping software that grows with you', lead: 'Mowing, cleanups, sod, hardscapes and installs: {p} keeps your crews on schedule, your quotes moving and your clients paying on time, all season long.',
    alt: 'Two landscapers mowing and trimming a residential lawn',
    pains: [['The schedule lives in your head', 'When the owner is out on the mower all day, nobody else knows which crew is going where tomorrow.'],
      ['Rain days wreck the week', 'One storm means calling every client and moving every job by hand.'],
      ['Great work, but no one sees it', 'Your best installs never make it onto social media because the photos are buried in someone’s phone.']],
    helps: [['calendar', 'Crews and routes by day', 'See every crew’s week on one calendar. When it rains, drag the day’s jobs to tomorrow and send clients a reminder in one tap.'],
      ['quote', 'Quotes for installs and cleanups', 'Send landscape design, sod and cleanup quotes clients can approve and pay a deposit on from their phone.'],
      ['camera', 'Before and after photos that sell', 'Crews snap photos on every job. Post the best ones straight to Facebook and Instagram.'],
      ['star', 'More reviews and referrals', 'See and reply to your Google reviews in the app, and give happy clients a referral link to share with neighbors.']],
    steps: ['Walk the property and send the quote before you leave; the client signs and pays a deposit.', 'Put the job on the crew’s calendar and remind the client the day before.', 'The crew has the notes, takes before and after photos and gets a sign-off.', 'Invoice when the job’s done and get paid by card, Zelle or Venmo.'],
    faq: [['Can new clients book online?', 'Yes. Share your online booking page from your website or Google Business Profile, and requests come straight in.'],
      ['Will it work on a phone in the sun?', 'Yes. The app is made for phones, with big tap targets and a simple bottom menu.']] },

  { slug: 'house-cleaning', name: 'House cleaning', emoji: '🧽', blurb: 'Book cleans online, keep your cleaners’ day clear and get paid without awkward conversations.',
    title: 'House cleaning software that frees up your evenings', lead: 'Whether you clean every home yourself or run several teams, {p} handles booking, scheduling, reminders and payments, so you can spend less time on the phone and more time growing.',
    alt: 'A cleaner mopping the floor of a bright living room',
    pains: [['Booking by text, all night long', 'New clients message at 10pm asking for a price and a time, and every booking takes a dozen back-and-forth texts.'],
      ['Locked doors and no-shows', 'A team drives across town and the client forgot they were coming.'],
      ['Awkward payment conversations', 'Asking a client for money at the door is uncomfortable, and cash goes missing.']],
    helps: [['portal', 'Online booking', 'New clients request a clean from your booking page, linked from your website and Google profile.'],
      ['message', 'Reminders by text and email', 'Send a visit reminder in one tap so clients leave the key out and the alarm off.'],
      ['team', 'A schedule your cleaners can see', 'Each cleaner sees their own day on their phone, with addresses, entry notes and pet details, and without your prices.'],
      ['card', 'Payments without the awkwardness', 'Clients pay invoices by card, Zelle or Venmo from a secure link. No cash, no checks, no chasing.']],
    steps: ['Send a quote for the deep clean; the client accepts it online.', 'Book the visit, assign a team and send a reminder the day before.', 'Your cleaners have the entry notes, take photos of the finished rooms and get a sign-off.', 'The invoice goes out by text and gets paid by card.'],
    faq: [['Do my cleaners need their own login?', 'Each team member gets their own login, so you control what they see. Cleaners see their schedule and the client’s notes, not your prices.'],
      ['Can clients see their upcoming cleans?', 'Yes. Every client gets a private portal link to see upcoming visits, review quotes and pay invoices, with no password to remember.']] },

  { slug: 'commercial-cleaning', name: 'Commercial cleaning', emoji: '🏢', blurb: 'Win contracts with sharp quotes, keep crews organized across sites and invoice on time.',
    title: 'Commercial cleaning software for janitorial companies', lead: 'Offices, retail, medical and property managers expect professional bids and reliable crews. {p} helps you quote, staff and invoice every site without the spreadsheets.',
    alt: 'A commercial cleaner vacuuming carpet in an office',
    pains: [['Bids that look homemade', 'Facility managers compare you to the big franchises. A plain-text quote doesn’t win the contract.'],
      ['Crews across many sites', 'Night shifts, weekend floor jobs and fill-ins for sick staff are hard to keep straight.'],
      ['Proof of service', 'When a client says the bathroom wasn’t done, you need more than your crew’s word.']],
    helps: [['quote', 'Branded, professional quotes', 'Your logo and colors on every quote and invoice. Clients sign online, so contracts don’t sit in someone’s inbox.'],
      ['calendar', 'Every site on one calendar', 'Schedule crews across buildings and shifts, and see who’s off before you assign the job.'],
      ['camera', 'Photos and sign-offs', 'Crews take photos of finished areas and collect a site manager’s signature, saved with the job.'],
      ['chart', 'Know which accounts pay', 'See paid, pending and overdue totals at a glance, plus expenses linked to each site.']],
    steps: ['Walk the building and send a branded quote the facility manager signs online.', 'Schedule the crew for the site and shift.', 'The crew has the site notes, photographs the finished areas and gets a sign-off.', 'Invoice the account and track payment.'],
    faq: [['Can I use my own web address?', 'Yes. Your account has its own web address, and you can connect your own domain on plans that include it.'],
      ['Can managers run jobs without seeing everything?', 'Yes. Managers run jobs, quotes and invoices, and custom roles let you fine-tune what each role sees.']] },

  { slug: 'roofing', name: 'Roofing & gutters', emoji: '🏠', blurb: 'Send roof quotes with deposits, document every job with photos and keep crews on schedule.',
    title: 'Roofing software for crews that close more jobs', lead: 'Inspections, repairs, replacements and gutters: {p} helps you send quotes homeowners sign the same day, collect deposits for materials and document every roof with photos.',
    alt: 'Two roofers in safety harnesses installing shingles on a house roof',
    pains: [['Losing jobs to slow quotes', 'By the time the estimate is typed up, the homeowner has signed with the roofer who quoted from the driveway.'],
      ['Buying materials before getting paid', 'Shingles, underlayment and dumpsters cost real money up front.'],
      ['Weather and disputes', 'Rain moves the schedule, and homeowners can’t see what’s on their roof.']],
    helps: [['quote', 'Quotes signed from the driveway', 'Send the replacement quote before you leave the property. The homeowner signs online and pays a deposit to cover materials.'],
      ['camera', 'Photos homeowners understand', 'Show the damage, the tear-off and the finished roof with before, progress and after photos saved to the job.'],
      ['calendar', 'Move crews when the weather turns', 'Drag jobs on the calendar and send clients a reminder when the new date is set.'],
      ['card', 'Final payment made easy', 'Deposits are credited on the invoice automatically, so the homeowner only pays the balance due.']],
    steps: ['Inspect the roof and send the quote; the homeowner signs and pays the materials deposit.', 'Schedule the crew and send the homeowner a reminder.', 'Document the tear-off and install with photos and a final sign-off.', 'Invoice the balance and get paid by card.'],
    faq: [['Can I take a percentage deposit?', 'Yes. Ask for a flat amount or a percentage when the quote is approved, and the deposit is credited on the invoice.'],
      ['Can I share project photos on social media?', 'Yes. Post photos from your project gallery straight to Facebook and Instagram.']] },

  { slug: 'pest-control', name: 'Pest control', emoji: '🐜', blurb: 'Keep treatments on schedule, remind clients before visits and document every service.',
    title: 'Pest control software that keeps every treatment on track', lead: 'Inspections, one-time treatments and follow-up visits: {p} keeps your technicians’ routes organized, your clients informed and your invoices paid.',
    alt: 'A pest control technician holding a sprayer',
    pains: [['Missed follow-up visits', 'A follow-up treatment slips through the cracks and the bugs come back, along with an unhappy client.'],
      ['Clients who aren’t home', 'Techs arrive to locked gates and dogs in the yard.'],
      ['No record of what was done', 'When a client calls back, nobody can say what was treated last time.']],
    helps: [['calendar', 'Treatments on one calendar', 'Schedule inspections, treatments and follow-ups, and see every tech’s day at a glance.'],
      ['message', 'Heads-up texts before every visit', 'Remind clients to unlock the gate and bring in the dog, by text or email, in one tap.'],
      ['sign', 'Notes, photos and signatures', 'Techs record what they found, take photos and collect a signature, all saved with the client.'],
      ['card', 'Easy payment for every service', 'Invoices with a pay link, so clients pay by card, Zelle or Venmo without a phone call.']],
    steps: ['Inspect and send the treatment quote; the client approves it online.', 'Schedule the treatment and the follow-up, and remind the client.', 'Record the treatment with notes, photos and a signature.', 'Invoice and get paid from a link.'],
    faq: [['Can I see a client’s history?', 'Yes. Every client record keeps their jobs, quotes, invoices, photos and notes in one place.'],
      ['Does it work for a one-person business?', 'Yes. It works the same whether you’re a crew of one or a fleet of trucks.']] },

  { slug: 'pool-service', name: 'Pool & spa service', emoji: '🏊', blurb: 'Keep weekly visits and repairs organized, send reminders and get paid on time.',
    title: 'Pool service software for cleaners and repair pros', lead: 'Weekly cleanings, openings and closings, pump and heater repairs: {p} keeps every pool on schedule and every invoice paid, so you can spend the day in the field instead of at the desk.',
    alt: 'A pool technician cleaning a swimming pool with a long pole',
    pains: [['Too many pools to track', 'Fifty pools a week, each with its own gate code and quirks, is too much to keep in your head.'],
      ['Repair upsells left on the table', 'Your tech spots a failing pump, but the repair quote never gets written.'],
      ['Clients who pay late', 'Collecting from dozens of homeowners every month takes hours.']],
    helps: [['calendar', 'Every pool on the calendar', 'Plan the week by day and tech, and move visits around when weather or holidays get in the way.'],
      ['quote', 'Repair quotes from the pool deck', 'Turn a worn-out pump into a quote on the spot, with a deposit to order the part.'],
      ['camera', 'Photos that prove the work', 'Show clients the clear water and the new equipment with photos saved to the job.'],
      ['card', 'Payments without the chasing', 'Send invoices by text or email with a secure pay link, and see who’s overdue at a glance.']],
    steps: ['Quote the opening or repair; the client signs and pays online.', 'Schedule the visit and send a reminder.', 'Your tech has the gate code and notes, and takes photos of the finished pool.', 'Invoice and get paid from a link.'],
    faq: [['Can clients request extra service?', 'Yes. Clients can send a work request from their portal, like a green-pool cleanup after a storm.'],
      ['Can I set my own prices for each service?', 'Yes. Save each service with its price in your catalog and reuse it on every quote and invoice.']] },

  { slug: 'painting', name: 'Painting', emoji: '🎨', blurb: 'Send detailed painting quotes, collect deposits and show off your finished projects.',
    title: 'Painting contractor software for interior and exterior pros', lead: 'From a single bedroom to a full exterior, {p} helps you win the job with a clear quote, schedule your painters and get paid when the last coat is dry.',
    alt: 'A painter on a ladder rolling paint onto an exterior wall',
    pains: [['Homeowners comparing three bids', 'A clear, professional quote with every room and surface listed is what wins the job.'],
      ['Paying for paint up front', 'Materials for a full exterior can run into the thousands before you get paid.'],
      ['Change orders and disputes', 'When the client changes the color halfway through, there’s no record of what was agreed.']],
    helps: [['quote', 'Room-by-room quotes', 'List every room, surface and coat from your saved services. Clients approve and sign online, so what was agreed is on record.'],
      ['card', 'Deposits for materials', 'Collect a deposit when the quote is approved, then invoice only the balance at the end.'],
      ['camera', 'A portfolio that sells for you', 'Before and after photos from every job, ready for your website and social media.'],
      ['star', 'Reviews and referrals', 'Reply to Google reviews in the app and give happy clients a referral link to pass along.']],
    steps: ['Walk the rooms and send a detailed quote; the client signs and pays the deposit.', 'Schedule your painters and remind the client.', 'Take before and after photos and get a final walkthrough signature.', 'Invoice the balance and get paid by card.'],
    faq: [['Can I add my logo to quotes?', 'Yes. Your logo and brand color appear on every quote, invoice and client page.'],
      ['Can I write better descriptions for my services?', 'Yes. “Write with AI” drafts clear service descriptions you can edit.']] },

  { slug: 'handyman', name: 'Handyman', emoji: '🛠️', blurb: 'Quote small jobs fast, fit more visits into your day and get paid before you leave.',
    title: 'Handyman software that keeps up with every small job', lead: 'Drywall patches, fixtures, doors, shelves and honey-do lists: {p} helps you quote fast, book efficiently and get paid on the spot, so small jobs add up to a big business.',
    alt: 'A handyman with a tool belt and ladder next to a work van',
    pains: [['Lots of little jobs, lots of admin', 'Every $150 job needs a quote, a booking and an invoice, and the paperwork takes as long as the work.'],
      ['Forgotten details', 'Which hinge was it again? Notes on scraps of paper get lost.'],
      ['Cash and checks', 'Waiting on a check in the mail for a small job isn’t worth the trip to the bank.']],
    helps: [['quote', 'Quotes in under two minutes', 'Pick from your saved services, adjust the price and send it by text. The client approves with a tap.'],
      ['calendar', 'A full day, planned', 'Fit jobs around each other on the calendar and send clients a reminder before you arrive.'],
      ['camera', 'Notes and photos on every job', 'Record exactly what you did and what you need for next time, with photos.'],
      ['card', 'Paid before you pack up', 'Send the invoice from your phone and let the client pay by card, Zelle or Venmo right there.']],
    steps: ['Text a quote for the honey-do list; the client approves it on their phone.', 'Book the visit and send a reminder.', 'Do the work, take photos and get a signature.', 'Invoice and get paid before you leave.'],
    faq: [['Is it too much software for a one-person shop?', 'No. It works the same whether you’re on your own or have a crew. Use only what you need.'],
      ['Can clients book me online?', 'Yes. Share your online booking page and new requests come straight in.']] },

  { slug: 'pressure-washing', name: 'Pressure washing', emoji: '💦', blurb: 'Quote from the driveway, show dramatic before and afters and get paid the same day.',
    title: 'Pressure washing software that makes every job shine', lead: 'Driveways, decks, siding, roofs and storefronts: {p} helps you quote quickly, show off dramatic before and after photos and turn happy clients into referrals.',
    alt: 'A worker in high-visibility gear pressure washing pavement',
    pains: [['Quoting by guesswork', 'Square footage, surface type and add-ons make it easy to underquote when you’re rushing.'],
      ['Seasonal rushes', 'Spring brings a flood of requests, and you can’t answer the phone with a wand in your hand.'],
      ['Results that sell themselves, if anyone sees them', 'The best marketing you have is the before and after, but it stays on your phone.']],
    helps: [['quote', 'Consistent quotes every time', 'Save prices for driveways, decks, siding and add-ons, then build quotes from them in seconds.'],
      ['portal', 'Bookings while you work', 'Clients request quotes from your online booking page, even when you can’t pick up.'],
      ['camera', 'Before and after photos', 'Save the transformation to the job and post it to Facebook and Instagram.'],
      ['star', 'Referrals from happy clients', 'Clients share their referral link and their neighbors arrive as new leads.']],
    steps: ['Quote the driveway and siding from your saved prices; the client accepts online.', 'Schedule the job and remind the client to move the cars.', 'Take the before and after shots and get a sign-off.', 'Invoice and get paid by card the same day.'],
    faq: [['Can I post photos to social media from the app?', 'Yes. Post project photos straight to your Facebook page and Instagram account.'],
      ['Do clients need to download an app?', 'No. Quotes, invoices and the client portal open in any browser.']] },

  { slug: 'window-cleaning', name: 'Window cleaning', emoji: '🪟', blurb: 'Keep residential and storefront routes organized and get paid without chasing.',
    title: 'Window cleaning software for residential and storefront routes', lead: 'Homes, storefronts and offices: {p} keeps your route organized, reminds clients before you arrive and gets invoices paid without a single phone call.',
    alt: 'A window cleaner using a squeegee on a storefront window',
    pains: [['Routes on a spreadsheet', 'Keeping track of which storefronts are due this week takes too much time.'],
      ['Screens, gates and access', 'Clients forget you’re coming and the side gate is locked.'],
      ['Small invoices, slow payments', 'Dozens of small invoices a month add up to a lot of chasing.']],
    helps: [['calendar', 'Your week, organized', 'Plan visits by day and crew, and move them when the weather turns.'],
      ['message', 'Reminders that open gates', 'Clients get a text or email before you arrive, so you’re not left waiting.'],
      ['quote', 'Quick quotes for add-ons', 'Screens, tracks and gutters added to the quote in a tap.'],
      ['card', 'Easy online payments', 'Every invoice has a secure pay link, and you can see paid, pending and overdue totals at a glance.']],
    steps: ['Quote inside and out, with screens; the client approves online.', 'Schedule the visit and send the reminder.', 'Your crew has the notes and takes photos of the finished job.', 'Invoice and get paid by card, Zelle or Venmo.'],
    faq: [['Can my crew see only their own jobs?', 'Each team member sees their schedule and jobs on their phone. Technicians never see prices.'],
      ['Can I import my existing clients?', 'Yes. Import clients from a CSV file and merge any duplicates.']] },

  { slug: 'carpet-cleaning', name: 'Carpet & upholstery cleaning', emoji: '🛋️', blurb: 'Quote by room, book online and get paid the minute the carpet’s dry.',
    title: 'Carpet and upholstery cleaning software', lead: 'Carpets, rugs, upholstery and tile: {p} helps you quote by room, keep your trucks on schedule and get paid before you roll up the hoses.',
    alt: 'A cleaner using an extraction tool on an upholstered ottoman',
    pains: [['Price confusion', 'Clients want to know the price per room before you arrive, and phone quotes lead to surprises at the door.'],
      ['Tight schedules', 'Long jobs and short jobs back to back make it hard to keep the day on time.'],
      ['Stains that “were already there”', 'Without before photos, a pre-existing stain becomes your problem.']],
    helps: [['quote', 'Clear quotes by room', 'Save your per-room, rug and upholstery prices and send a clear quote the client approves before you arrive.'],
      ['calendar', 'A day that runs on time', 'See every truck’s day on one calendar and drag jobs to fit.'],
      ['camera', 'Before photos for peace of mind', 'Photograph stains and wear before you start, and the clean results after.'],
      ['card', 'Paid at the door', 'Invoice from your phone and let the client pay by card on the spot.']],
    steps: ['Send a room-by-room quote; the client approves it online.', 'Book the visit and remind the client to clear the floors.', 'Take before and after photos and get a signature.', 'Invoice and get paid before you roll up the hoses.'],
    faq: [['Can clients see the quote before I arrive?', 'Yes. Quotes go out by email or text, and clients approve and sign them online.'],
      ['Can I track the cost of chemicals and equipment?', 'Yes. Log expenses and link them to jobs, so you know what each job really earned.']] },

  { slug: 'tree-care', name: 'Tree care', emoji: '🌳', blurb: 'Quote removals with photos, collect deposits and keep climbers and ground crews organized.',
    title: 'Tree service software for arborists and removal crews', lead: 'Pruning, removals, stump grinding and storm cleanup: {p} helps you quote big jobs with confidence, schedule the right crew and equipment, and get paid when the logs are hauled away.',
    alt: 'An arborist on a ladder pruning an oak tree, with a chainsaw on the grass',
    pains: [['Big quotes, slow decisions', 'Removals are expensive, and homeowners take their time without a clear quote in hand.'],
      ['Storm season chaos', 'After a storm, everyone needs you today.'],
      ['Liability and proof', 'You need a record of the tree’s condition and the property before you start.']],
    helps: [['quote', 'Detailed quotes with deposits', 'Quote removals, pruning and stump grinding, and collect a deposit when the homeowner signs.'],
      ['calendar', 'Crews and equipment scheduled', 'See climbers and ground crews on one calendar and move jobs fast after a storm.'],
      ['camera', 'Photos before the first cut', 'Document the tree and property before, during and after, saved with the job.'],
      ['team', 'Roles for every crew member', 'Crew leads see the job details they need; your prices stay private.']],
    steps: ['Assess the tree and send the quote; the homeowner signs and pays a deposit.', 'Schedule the crew and remind the client to move the cars.', 'Photograph the job from start to cleanup and get a sign-off.', 'Invoice the balance and get paid.'],
    faq: [['Can I handle storm calls quickly?', 'Yes. Clients request work from your booking page or portal, and you can drop the job on the calendar in seconds.'],
      ['Can I see which services earn the most?', 'Yes. Reports show your most popular services and revenue by month.']] },

  { slug: 'moving', name: 'Moving', emoji: '📦', blurb: 'Send clear moving quotes, collect deposits to hold the date and keep crews on schedule.',
    title: 'Moving company software for local movers', lead: 'Apartments, homes and small offices: {p} helps you quote moves clearly, hold the date with a deposit and keep your crews and trucks on schedule.',
    alt: 'A mover wheeling a stack of boxes on a dolly next to a moving van',
    pains: [['No-shows and cancellations', 'Without a deposit, clients book three movers and cancel two the day before.'],
      ['Crews and trucks to juggle', 'End-of-month weekends are packed and every truck counts.'],
      ['Damage claims', 'Without photos, it’s hard to show what condition furniture was in.']],
    helps: [['card', 'Deposits that hold the date', 'Clients sign the quote and pay a deposit online to lock in their moving day.'],
      ['calendar', 'Crews and trucks on one calendar', 'See every crew’s day and move jobs around when a move runs long.'],
      ['camera', 'Photos before loading', 'Document furniture condition before and after, saved with the job.'],
      ['sign', 'Sign-off at delivery', 'Collect the client’s signature when the last box is in.']],
    steps: ['Send the moving quote; the client signs and pays the deposit to hold the date.', 'Schedule the crew and truck, and remind the client.', 'Photograph furniture before loading and get a signature at delivery.', 'Invoice the balance and get paid by card.'],
    faq: [['Can clients pay the balance online?', 'Yes. The deposit is credited on the invoice, and clients pay the balance by card, Zelle or Venmo from a link.'],
      ['Can I edit the wording of my emails?', 'Yes. Edit the wording of every quote, invoice and reminder message.']] },

  { slug: 'remodeling', name: 'Remodeling & contracting', emoji: '🏗️', blurb: 'Win remodels with professional quotes, collect deposits and keep clients in the loop.',
    title: 'Contractor software for remodelers and builders', lead: 'Kitchens, baths, basements and additions: {p} helps you win bigger projects with professional quotes, collect deposits, keep clients informed and track what each job really earns.',
    alt: 'A contractor standing in a room under renovation',
    pains: [['Clients want updates', 'Homeowners living through a remodel want to know what’s happening, and every update is a phone call.'],
      ['Cash flow on long jobs', 'Materials and subs need paying long before the project is finished.'],
      ['Profit you can’t see', 'Without expenses tied to each job, you only find out what you made at tax time.']],
    helps: [['quote', 'Quotes that win remodels', 'Detailed, branded quotes with every line item. Clients sign online and pay a deposit to get on your schedule.'],
      ['portal', 'A portal for your clients', 'Clients see upcoming visits, quotes and invoices in their own portal, and pay online.'],
      ['receipt', 'Job costing with expenses', 'Link materials, permits and subcontractor costs to the job, so you see the real profit.'],
      ['camera', 'Progress photos', 'Before, progress and after photos for every phase, saved with the project.']],
    steps: ['Send a detailed quote; the client signs and pays a deposit.', 'Schedule each phase and keep the client informed.', 'Document progress with photos and get a sign-off at each milestone.', 'Invoice and track the balance due.'],
    faq: [['Can I take partial payments?', 'Yes. Deposits and partial payments are tracked on every invoice, along with the balance due.'],
      ['Can I see what a job really earned?', 'Yes. Expenses linked to the job show you what it cost against what you invoiced.']] },

  { slug: 'decks-fencing', name: 'Decks & fencing', emoji: '🪵', blurb: 'Quote by the foot, collect material deposits and show off finished builds.',
    title: 'Deck and fence builder software', lead: 'New decks, fence lines, repairs and staining: {p} helps you send clear quotes, collect deposits for lumber and keep your build crews on schedule.',
    alt: 'A crew building a wooden deck in a backyard',
    pains: [['Lumber prices move', 'You need the deposit in hand before you buy materials.'],
      ['Quotes take too long', 'Measuring, pricing and typing up a fence quote eats your evening.'],
      ['Finished work nobody sees', 'A beautiful new deck is your best ad, if people see it.']],
    helps: [['quote', 'Quick quotes from saved prices', 'Save prices per foot, per post and per board, and build quotes from them in minutes.'],
      ['card', 'Deposits for materials', 'Collect a deposit when the quote is approved, so lumber is paid for before you order.'],
      ['calendar', 'Build crews on one calendar', 'Schedule crews across builds and move them when the weather changes.'],
      ['camera', 'Builds worth sharing', 'Before and after photos saved with the job and ready for social media.']],
    steps: ['Measure and send the quote; the client signs and pays the materials deposit.', 'Schedule the build crew and remind the client.', 'Take progress photos and get a final signature.', 'Invoice the balance and get paid.'],
    faq: [['Can I share photos on Facebook and Instagram?', 'Yes. Post project photos from your gallery straight to your social accounts.'],
      ['Do my crew members need an app?', 'No. They sign in from the browser on their phone.']] },

  { slug: 'flooring', name: 'Flooring', emoji: '🧱', blurb: 'Quote by the square foot, schedule installs and collect deposits for materials.',
    title: 'Flooring installer software', lead: 'Hardwood, laminate, tile, vinyl and carpet: {p} helps you quote accurately, collect deposits for materials and keep your installers on schedule.',
    alt: 'A flooring installer laying wood planks in an empty room',
    pains: [['Materials ordered on faith', 'Flooring orders are expensive and non-returnable.'],
      ['Install days that shift', 'Delays upstream push your install, and every client needs a call.'],
      ['Unclear scope', 'Did the quote include baseboards and haul-away? Without a signed quote, it’s a debate.']],
    helps: [['quote', 'Signed quotes with clear scope', 'List materials, square footage, trim and haul-away. The client signs online, so the scope is on record.'],
      ['card', 'Deposits before you order', 'Collect a deposit when the quote is approved, then invoice only the balance.'],
      ['calendar', 'Installers on one calendar', 'Move installs when materials are late and send the client a reminder of the new date.'],
      ['chart', 'Know your numbers', 'Revenue by month, your most popular services and sales tax collected.']],
    steps: ['Measure and send the quote; the client signs and pays the deposit.', 'Schedule the install once the materials arrive.', 'Take before and after photos and get a sign-off.', 'Invoice the balance and get paid by card.'],
    faq: [['Can deposits be a percentage?', 'Yes. Ask for a flat amount or a percentage of the quote.'],
      ['Does it work on a tablet?', 'Yes. It works in the browser on phones, tablets and computers.']] },

  { slug: 'low-voltage', name: 'Low voltage', emoji: '🔌', blurb: 'Quote cabling runs by the drop, keep install crews on schedule and get paid when the job’s tested.',
    title: 'Low voltage contractor software for cabling crews', lead: 'Structured cabling, access control, intercoms and pre-wire for new builds: {p} helps you quote by the drop, collect deposits for materials and keep every crew and job site organized.',
    alt: 'A low voltage technician in a safety vest working with a screwdriver beside an equipment rack',
    pains: [['Quotes that take all night', 'Counting drops, jacks, patch panels and labor for a bid by hand means another evening at the kitchen table.'],
      ['Jobs that wait on other trades', 'Pre-wire can’t start until framing’s done, and trim-out waits on drywall, so the schedule changes every week.'],
      ['Scope creep on every site', '“Can you add two more drops while you’re here?” turns into free work when nothing is written down.']],
    helps: [['quote', 'Quotes by the drop', 'Save your prices per drop, jack, panel and hour, then build cabling quotes in minutes. Clients and general contractors sign online and pay a deposit for materials.'],
      ['calendar', 'Pre-wire and trim-out on one calendar', 'Schedule each phase of a job, drag it when the site isn’t ready and send the client the new date in one tap.'],
      ['camera', 'Photos of every wall before it closes', 'Techs snap the cable runs before drywall goes up and the finished rack after, saved with the job for the next time someone asks where a line goes.'],
      ['receipt', 'Materials tracked against each job', 'Log cable boxes, jacks and hardware against the job they were for, so you know what every install really earned.']],
    steps: ['Walk the site and send the cabling quote; the client signs and pays the materials deposit.', 'Schedule the pre-wire and trim-out, and remind the client before each visit.', 'Your crew has the drop list and notes, photographs the runs and gets a sign-off.', 'Invoice the balance and get paid by card, Zelle or Venmo.'],
    faq: [['Can I add extra work to a job after the quote?', 'Yes. Send a quick quote for the extra drops from your phone. The client signs it online, so the added work is agreed to before you pull the cable.'],
      ['Can I keep my prices hidden from my installers?', 'Yes. Technicians see their schedule, clients and jobs without any prices. Custom roles let you choose exactly what each role can see.']] },

  { slug: 'networking', name: 'Networking & Wi-Fi', emoji: '📶', blurb: 'Quote network installs and service calls, keep techs on schedule and invoice the moment it’s online.',
    title: 'Software for network installers and IT service pros', lead: 'Wi-Fi upgrades, switches and racks, small office networks and the “the internet is down” call: {p} keeps your quotes, techs, client history and payments in one place.',
    alt: 'Rows of green network cables plugged into patch panels and switches in a rack',
    pains: [['Equipment quotes get shopped around', 'A quote for access points, a switch and labor sits in an inbox while the client searches for cheaper hardware.'],
      ['Every network is different', 'Which closet is the rack in? Where’s the modem? Without notes, every return visit starts from scratch.'],
      ['Small service calls that never get billed', 'A quick remote fix or a ten-minute visit is easy to forget to invoice.']],
    helps: [['quote', 'Equipment and labor in one quote', 'Build quotes from your saved hardware and labor prices. Clients review them on their phone, sign online and pay a deposit so you can order the gear.'],
      ['phone', 'Every client’s setup on the tech’s phone', 'Job notes, photos of the rack and the client’s history are with the job, so the next tech knows where everything is.'],
      ['calendar', 'Installs and service calls on one calendar', 'See every tech’s day, fit in urgent outages and text clients a heads-up before you arrive.'],
      ['card', 'Bill every visit, big or small', 'Turn a finished job into an invoice in one tap. Clients pay by card, Zelle or Venmo from a secure link, and the payment lands in your own Stripe account.']],
    steps: ['Survey the space and send the equipment and labor quote; the client signs and pays the deposit.', 'Schedule the install and send the client a reminder.', 'Your tech has the notes on site, photographs the rack and gets a sign-off when everything’s online.', 'Invoice in one tap and get paid before you leave.'],
    faq: [['Can business clients request service on their own?', 'Yes. Your online booking page and each client’s portal let them send a work request, which shows up for you as a new request.'],
      ['Can I see everything we’ve done for a client?', 'Yes. Every client record keeps their jobs, quotes, invoices, photos and notes in one place.']] },

  { slug: 'security-cameras', name: 'Security cameras', emoji: '📹', blurb: 'Quote camera systems on site, collect equipment deposits and show clients every camera you installed.',
    title: 'Security camera installer software', lead: 'Home and business camera systems, doorbells, NVRs and upgrades: {p} helps you quote the system on site, collect a deposit for the equipment and keep every install documented.',
    alt: 'A technician mounting a security camera on a wall',
    pains: [['Equipment costs up front', 'Cameras, recorders and drives add up fast, and you don’t want to buy them before the client commits.'],
      ['Clients compare you to a box store kit', 'A plain price on paper doesn’t show the coverage, the install and the support they’re paying for.'],
      ['“The camera isn’t where we agreed”', 'Without photos and a signature, a dispute over camera placement is your word against theirs.']],
    helps: [['quote', 'Good-better-best camera packages', 'Build 4, 8 and 16 camera options from your saved equipment and labor prices. Clients compare them on their phone, sign online and pay a deposit for the equipment.'],
      ['camera', 'Photos of every camera and its view', 'Techs photograph each mounted camera and the recorder, saved with the job as a record of what was installed and where.'],
      ['sign', 'Sign-off at the end of the install', 'Walk the client through the app and the views, then collect their signature on the job, so everyone agrees the system is done.'],
      ['card', 'Final payment on the spot', 'The deposit is credited on the invoice automatically, so the client only pays the balance by card, Zelle or Venmo before you leave.']],
    steps: ['Walk the property and send the camera package quote; the client signs and pays the equipment deposit.', 'Schedule the install and remind the client the day before.', 'Your techs mount the cameras, photograph each one and get a sign-off.', 'Invoice the balance and get paid by card.'],
    faq: [['Can I take a percentage deposit?', 'Yes. Ask for a flat amount or a percentage when the quote is approved, and the deposit is credited on the invoice.'],
      ['Can I share install photos on social media?', 'Yes. Post photos from your project gallery straight to Facebook and Instagram.']] },

  { slug: 'audio-video', name: 'Audio & video', emoji: '🔊', blurb: 'Quote home theaters and TV mounts, collect deposits for gear and show off the finished rooms.',
    title: 'Audio video installer software for home theaters and more', lead: 'TV mounting, surround sound, whole-home audio, home theaters and conference rooms: {p} helps you quote the gear and labor, schedule your installers and get paid when the room is done.',
    alt: 'A home theater room with a projector screen, speakers and seating',
    pains: [['Big quotes, long decisions', 'A home theater quote with a projector, speakers and seating sits on the counter for weeks without a follow-up.'],
      ['Projects that span many visits', 'Pre-wire during construction, then trim-out months later, then calibration, and the details get lost in between.'],
      ['Your best work stays hidden', 'Beautiful theaters and media rooms never make it online because the photos are stuck on someone’s phone.']],
    helps: [['quote', 'Quotes clients can say yes to', 'Build quotes from your saved TVs, speakers, mounts and labor prices, with options to choose from. Clients sign online and pay a deposit for the equipment.'],
      ['calendar', 'Every visit on one calendar', 'Schedule pre-wire, install and calibration visits, move them when the builder slips and remind the client before each one.'],
      ['camera', 'Before and after photos that sell', 'Installers snap the empty wall and the finished room. Post the best ones straight to Facebook and Instagram.'],
      ['star', 'More reviews and referrals', 'See and reply to your Google reviews in the app, and give happy clients a referral link to share with friends.']],
    steps: ['Design the system and send the quote; the client signs and pays the equipment deposit.', 'Schedule the pre-wire and install visits, and remind the client before each one.', 'Your installers have the notes, take before and after photos and get a sign-off.', 'Invoice the balance and get paid by card, Zelle or Venmo.'],
    faq: [['Can I save my equipment and labor prices?', 'Yes. Add TVs, speakers, mounts and labor to your products and services catalog once, then build quotes from it in a couple of taps. “Write with AI” can draft the descriptions.'],
      ['Do my installers need an app?', 'No. They sign in from the browser on their phone, with a simple bottom menu made for the field.']] },
  { slug: 'garage-doors', name: 'Garage doors', emoji: '🚪', blurb: 'Quote springs, openers and new doors on the spot, keep service calls moving and get paid before you pack up.',
    title: 'Garage door software for service calls and installs', lead: 'Broken springs don’t wait. {p} keeps your service calls, door quotes, techs and payments in one place, so you can take the urgent job and still keep tomorrow’s installs on track.',
    alt: 'A white garage door on a house',
    pains: [['Same-day calls wreck the schedule', 'A stuck door with the car inside is an emergency to the homeowner. Squeezing it in by phone and text means someone else’s appointment gets forgotten.'],
      ['Door quotes go cold', 'Homeowners compare styles, colors and openers. A quote scribbled on a pad loses to a sharp one they can approve on their phone.'],
      ['Parts get left off the invoice', 'Springs, rollers, cables and the trip charge get written down in a hurry, and something always gets missed.']],
    helps: [['quote', 'Repair and new-door quotes with options', 'Save springs, openers, doors and labor in your price list. Offer Good / Better / Best options, and homeowners sign and pay a deposit online.'],
      ['calendar', 'Room for the emergency call', 'Drag the day’s jobs around on one calendar when a broken-spring call comes in, and everyone sees the change on their phone.'],
      ['phone', 'Door details on the tech’s phone', 'The address, door size, notes and photos from the last visit. Technicians see the work, never your prices.'],
      ['card', 'Paid before you leave the driveway', 'Turn the job into an invoice in one tap. Clients pay by card or bank from a secure link, straight to your own Stripe account.']],
    steps: ['Quote a new spring and a tune-up, or three door options, right in the driveway.', 'Put the job on the calendar and send the tech with the right parts on the truck.', 'Your tech snaps before and after photos and gets the client’s signature on their phone.', 'Invoice in one tap and get paid by card before you drive off.'],
    faq: [['Can I sell yearly tune-ups?', 'Yes. Service plans bill members every month, quarter or year and schedule the visits the plan includes. Service plans are on Advanced and Unlimited.'],
      ['Can I add a trip charge to every service call?', 'Yes. Save it in your products and services list once and add it to any quote or invoice in a tap.']] },

  { slug: 'appliance-repair', name: 'Appliance repair', emoji: '🧺', blurb: 'Book service calls, quote parts and labor on the spot and get paid the moment the washer runs again.',
    title: 'Appliance repair software for busy service routes', lead: 'From the dead fridge on Monday to the dishwasher part that arrives Thursday, {p} keeps your calls, quotes, return visits and payments together, so nothing falls through the cracks.',
    alt: 'A washing machine in a laundry room',
    pains: [['Return visits get lost', 'The part is on order, the client is waiting, and the second visit only lives in someone’s memory.'],
      ['Diagnostic fees cause friction', 'Explaining the diagnostic charge, the part and the labor at the door leads to haggling when none of it is written down.'],
      ['Paperwork after the last call', 'Invoices written up at night go out late, and the payments come in even later.']],
    helps: [['quote', 'Diagnosis and repair, clearly priced', 'Save your diagnostic fee, common parts and labor rates. The client approves the repair on their phone before you start.'],
      ['repeat', 'Return visits on the calendar', 'Book the return visit for when the part arrives, on the same client and job, with its own reminder.'],
      ['phone', 'Model numbers and history on site', 'Notes, photos of the model tag and the client’s past repairs on the tech’s phone.'],
      ['card', 'Paid at the door', 'Invoice in one tap. Clients pay by card or bank from a secure link, or with Zelle, Venmo, Cash App or PayPal.']],
    steps: ['Run the diagnosis and send the repair quote; the client approves it on their phone.', 'Order the part and book the return visit on the calendar.', 'Install the part, snap a photo of the model tag and get a signature.', 'Invoice in one tap, with the deposit already taken off.'],
    faq: [['Can I take a deposit before I order a part?', 'Yes. Ask for a deposit on the quote. The client pays it online when they approve, and it comes off the invoice automatically.'],
      ['Can my techs see a client’s past repairs?', 'Yes. Every visit, photo, quote and invoice is saved with the client, so the next tech sees what was done before.']] },

  { slug: 'junk-removal', name: 'Junk removal', emoji: '🚛', blurb: 'Quote from photos, book pickups by the load and get paid before the truck heads to the dump.',
    title: 'Junk removal software that keeps the truck full', lead: 'Clients send photos, you send a price, the truck shows up. {p} turns that into quotes, a schedule your crew can see and payments that land before you reach the transfer station.',
    alt: 'A crew moving furniture beside a truck',
    pains: [['Every job starts with “how much for this?”', 'Photos arrive by text, email and voicemail, and pricing each one by hand eats your evenings.'],
      ['Load sizes cause arguments', 'When the price isn’t written down by load size, “half a truck” turns into a debate in the driveway.'],
      ['End-of-day math never adds up', 'Payments collected on site with no record make the daily totals a guessing game.']],
    helps: [['quote', 'Quotes by load size', 'Save quarter, half and full-load prices plus extras like mattresses and appliances. With Snap to quote on Unlimited, a few photos become a draft quote.'],
      ['route', 'Pickups in driving order', 'See every pickup on one calendar, and on the dispatch map in the shortest driving order.'],
      ['camera', 'Before and after photos', 'Photos saved with the job, ready if a client asks what was taken, and for your next social post.'],
      ['card', 'Paid on the spot', 'Invoice in one tap. Clients pay by card from a secure link, and every payment is recorded.']],
    steps: ['The client sends photos through your online request form; you send a price by load size.', 'Book the pickup and assign the crew.', 'Snap before and after photos and get a sign-off on the phone.', 'Invoice and get paid before the truck pulls away.'],
    faq: [['Can clients send me photos online?', 'Yes. Your online booking form lets clients describe the job and add photos, and the request lands in the app with their contact details.'],
      ['Can I change the price on site if there’s more stuff?', 'Yes. Edit the quote on your phone and the client approves the new total before you load.']] },

  { slug: 'snow-removal', name: 'Snow removal', emoji: '🌨️', blurb: 'Run seasonal contracts and per-push jobs, route the plow trucks and bill every storm without the late nights.',
    title: 'Snow removal software for every storm', lead: 'When the snow starts at 2am, you need to know who’s on which route. {p} keeps your seasonal clients, per-push jobs, crews and invoices in one place, so billing after the storm takes minutes.',
    alt: 'A person shoveling snow',
    pains: [['Every storm is a scramble', 'Who’s on which lot, which driveways come first, which clients pay for salt? It all lives in someone’s head.'],
      ['Billing after the storm takes days', 'Counting pushes and salt runs per client, then writing invoices, eats the days after every snowfall.'],
      ['Contracts get mixed up', 'By February, nobody remembers who’s on a flat seasonal rate and who pays per push.']],
    helps: [['member', 'Seasonal contracts that bill themselves', 'Service plans bill members monthly, quarterly or yearly and keep track of who’s on a plan. Service plans are on Advanced and Unlimited.'],
      ['route', 'Routes in driving order', 'The dispatch map shows each crew’s stops in the shortest driving order.'],
      ['repeat', 'Every push recorded', 'Each push is its own visit on the client, so the storm’s invoice lines are already there.'],
      ['receipt', 'Billing in minutes, not days', 'Invoice every client after the storm with a pay link. Clients pay by card or bank to your own Stripe account.']],
    steps: ['Sign clients up for a seasonal plan or a per-push price before the first flake.', 'When snow hits, open the dispatch map and send each crew their route.', 'Crews mark each stop done on their phone, with a photo of the cleared lot.', 'Send the storm’s invoices and let the card payments come in.'],
    faq: [['Can some clients pay per push and others a flat season?', 'Yes. Put season clients on a service plan and price per-push clients by visit, all in the same account.'],
      ['Can crews clock in for the storm?', 'Yes. Team members clock in and out on their phone, and you approve the hours for payroll. Time tracking is on Advanced and Unlimited.']] },

  { slug: 'irrigation', name: 'Irrigation & sprinklers', emoji: '💧', blurb: 'Book spring start-ups and fall blowouts, fix broken heads on site and bill every visit without the paperwork.',
    title: 'Irrigation software for start-ups, repairs and blowouts', lead: 'Spring start-ups, summer repairs and fall winterizations: {p} keeps every system, visit and payment in one place, so you can run the whole season from your phone.',
    alt: 'A lawn sprinkler watering the grass',
    pains: [['Two seasons crammed into a few weeks', 'Hundreds of start-ups in spring and blowouts in fall, all booked by phone and sticky note.'],
      ['Repairs found on site wait for approval', 'You find six broken heads, but the homeowner isn’t home to say yes to the extra work.'],
      ['Every system is different', 'Zone counts, the controller and the backflow valve live in your memory instead of with the client.']],
    helps: [['member', 'Start-up and blowout plans', 'Sell a yearly plan with the spring start-up and fall winterization; it bills and books the visits for you. Service plans are on Advanced and Unlimited.'],
      ['quote', 'Repairs approved from anywhere', 'Send a quote for the broken heads from the yard. The homeowner approves it on their phone, even from work.'],
      ['phone', 'System notes on every visit', 'Zone count, controller location and photos saved with the client, ready for the next tech.'],
      ['route', 'Start-ups in driving order', 'The dispatch map puts the day’s start-ups in the shortest driving order.']],
    steps: ['Quote the start-up or sell the yearly plan.', 'Schedule spring start-ups by neighborhood, with a reminder to each client.', 'Run the zones, quote any repairs on the spot and snap photos.', 'Invoice in one tap and get paid by card.'],
    faq: [['Do clients get a reminder before their visit?', 'Yes. Clients get a reminder by email before each scheduled visit.'],
      ['Can I keep notes on each client’s system?', 'Yes. Add notes and photos to the client, and they show up on every future visit.']] },

  { slug: 'locksmith', name: 'Locksmith', emoji: '🔑', blurb: 'Answer lockouts fast, quote rekeys and installs on the spot and get paid before you leave the door.',
    title: 'Locksmith software for lockouts, rekeys and installs', lead: 'Lockouts at midnight, rekeys for a new homeowner, a storefront full of new hardware: {p} keeps calls, quotes and payments together, right on your phone.',
    alt: 'Keys and a padlock beside a toolbox',
    pains: [['Emergency calls interrupt everything', 'A lockout means juggling the day’s appointments by text while you drive.'],
      ['Price disputes at the door', 'Without a written quote, the after-hours fee and the hardware turn into an argument.'],
      ['Cash jobs leave no record', 'Payments collected on site with no invoice are hard to track at tax time.']],
    helps: [['quote', 'Approved before you start', 'Send a quote with the after-hours fee and hardware listed. The client approves it on their phone before you pick the lock.'],
      ['calendar', 'Room for the emergency', 'Drag appointments around on one calendar, and everyone sees the change.'],
      ['card', 'Paid on the spot', 'Clients pay by card from a secure link, or with Zelle, Venmo, Cash App or PayPal, and every payment is recorded.'],
      ['chart', 'Know what you earned', 'Revenue, expenses and sales tax in your reports, ready when your accountant asks.']],
    steps: ['Quote the lockout or rekey with the fee spelled out; the client approves on their phone.', 'Put the job on the calendar, or head straight there.', 'Do the work and get a signature on your phone.', 'Invoice in one tap and get paid before you leave.'],
    faq: [['Can I charge more after hours?', 'Yes. Save an after-hours fee as its own item and add it to any quote or invoice.'],
      ['Do I need an office to use it?', 'No. Everything runs in the browser on your phone, so you can quote, schedule and get paid from the van.']] },

  { slug: 'chimney-dryer-vent', name: 'Chimney & dryer vents', emoji: '🔥', blurb: 'Book yearly sweeps and vent cleanings, document every flue with photos and get paid at the hearth.',
    title: 'Chimney and dryer vent software for yearly service', lead: 'Every chimney and dryer vent needs cleaning on a schedule. {p} keeps your clients, yearly visits, inspection photos and payments in one place, so last year’s clients book again.',
    alt: 'A chimney sweep working on a roof',
    pains: [['Last year’s clients forget to call', 'The fall rush is booked solid, but there’s no easy way to bring back last year’s customers.'],
      ['Repairs need proof', 'Telling a homeowner their flue liner is cracked doesn’t land without photos.'],
      ['Booking by phone tag', 'Every appointment takes three calls and two voicemails.']],
    helps: [['member', 'Yearly sweep plans', 'A service plan bills and books the yearly cleaning for you. Service plans are on Advanced and Unlimited.'],
      ['camera', 'Photos that sell the repair', 'Snap the damaged crown or liner and send the repair quote along with the photos.'],
      ['portal', 'Booking without phone tag', 'Clients request a visit from your online booking form and see their visits and invoices in their portal.'],
      ['sign', 'A checklist for every inspection', 'Fill in your inspection checklist on site and share the finished PDF with the client. Checklists are on Advanced and Unlimited.']],
    steps: ['Quote the sweep, or renew last year’s plan.', 'Book the visit and send the client a reminder.', 'Sweep, inspect with your checklist and photograph anything that needs repair.', 'Send the invoice and the repair quote together.'],
    faq: [['Can next year’s cleaning be booked ahead?', 'Yes. Recurring jobs and service plans schedule the next visit ahead, and the client gets a reminder before it.'],
      ['Can I share my inspection report?', 'Yes. Your finished checklist becomes a PDF you can send to the client, photos included.']] },

  { slug: 'concrete-masonry', name: 'Concrete & masonry', emoji: '🪨', blurb: 'Win patios, driveways and walls with clear quotes, collect deposits for materials and show off the finished work.',
    title: 'Concrete and masonry software that wins bigger jobs', lead: 'From a new driveway to a stone retaining wall, {p} helps you send professional quotes, collect material deposits and keep every pour on schedule.',
    alt: 'A mason laying a block wall',
    pains: [['Big quotes take forever to write', 'Square footage, materials, excavation and finishes: every bid turns into a spreadsheet.'],
      ['Weather moves every pour', 'Rain pushes the schedule, and the client and crew hear about it last.'],
      ['Materials bought before you’re paid', 'Concrete and stone get ordered before the client pays a cent.']],
    helps: [['quote', 'Detailed quotes with deposits', 'Build quotes by the square foot from your price list, with Good / Better / Best finishes. Clients sign and pay the material deposit online.'],
      ['calendar', 'Reschedule around the weather', 'Drag the pour to the next dry day, and everyone sees it on their phone.'],
      ['camera', 'A portfolio from every job', 'Before and after photos saved with each job, ready for your next quote or social post.'],
      ['profit', 'Know which jobs pay', 'Job profit shows labor, materials and expenses against the price of every job. It’s on Advanced and Unlimited.']],
    steps: ['Measure on site and send a quote with finish options; the client signs and pays the deposit.', 'Schedule the prep and the pour, and move it if rain comes.', 'Crews snap progress photos and the client signs off.', 'Invoice the balance with the deposit already taken off.'],
    faq: [['Can clients pay in stages?', 'Yes. Ask for a deposit on the quote, and let clients pay part of an invoice now and the rest later. Every payment is tracked on the invoice.'],
      ['Can I see my profit on each job?', 'Yes. Job profit compares the price with labor hours and expenses. It’s on Advanced and Unlimited.']] },

  { slug: 'holiday-lighting', name: 'Holiday lighting', emoji: '🎄', blurb: 'Sell installs, book takedowns and bring back last year’s clients without the spreadsheet.',
    title: 'Holiday lighting software for installs and takedowns', lead: 'Your busiest weeks are packed into the fall. {p} keeps installs, takedowns, crews and payments in one place, with every past display saved for next year.',
    alt: 'A house covered in holiday lights at night',
    pains: [['Six weeks of chaos', 'Every install gets squeezed in between Halloween and the first week of December.'],
      ['Takedowns get forgotten', 'Booking the January takedown is easy to skip once the install is done.'],
      ['Last year’s clients drift away', 'Without a list and a follow-up, repeat customers book whoever calls them first.']],
    helps: [['quote', 'Quotes by the foot', 'Price rooflines, trees and bushes from your price list and offer Good / Better / Best displays. Clients sign and pay a deposit online.'],
      ['calendar', 'Install and takedown booked together', 'Put the takedown on the calendar when you book the install, so January is never forgotten.'],
      ['route', 'Crews in driving order', 'The dispatch map shows the day’s installs in the shortest driving order.'],
      ['star', 'Last year’s displays, saved', 'Past quotes, invoices and photos stay with each client, and automations send follow-ups for you.']],
    steps: ['Measure the roofline and send display options; the client signs and pays the deposit.', 'Book the install and the takedown together.', 'Crews hang the lights, snap photos and get a sign-off.', 'Invoice the balance and get paid by card.'],
    faq: [['Can I see what I installed at a house last year?', 'Yes. Past quotes, invoices and photos are saved with the client.'],
      ['Can I take a deposit to hold the install date?', 'Yes. Ask for a deposit on the quote; the client pays it online when they sign.']] },

  { slug: 'auto-detailing', name: 'Auto detailing & car wash', emoji: '🚗', blurb: 'Book mobile details online, sell wash packages and memberships and get paid in the driveway.',
    title: 'Mobile detailing software for packages and memberships', lead: 'Whether you detail at the client’s home or run a mobile wash route, {p} handles bookings, packages, memberships and payments from your phone.',
    alt: 'A detailer polishing a car with a buffer',
    pains: [['Bookings come in from everywhere', 'DMs, texts and calls all need an answer before someone else books the job.'],
      ['Packages are hard to explain', 'Clients don’t know what a “full detail” includes, so they pick the cheapest.'],
      ['Regulars drift away', 'Without a plan, monthly customers turn into twice-a-year customers.']],
    helps: [['portal', 'Online booking', 'Clients request a detail from your booking form, and the request lands in the app with their details.'],
      ['quote', 'Good / Better / Best packages', 'Show packages side by side, so clients see what each one includes and pick up a level.'],
      ['member', 'Monthly memberships', 'Service plans bill members and book their visits. Service plans are on Advanced and Unlimited.'],
      ['card', 'Paid in the driveway', 'Clients pay by card from a secure link, straight to your own Stripe account.']],
    steps: ['The client books online and picks a package.', 'The visit lands on your calendar with the address and the car.', 'Detail the car and snap before and after photos.', 'Invoice and get paid before you pack up.'],
    faq: [['Can I offer monthly memberships?', 'Yes. Service plans bill members each month and include the visits you set. Service plans are on Advanced and Unlimited.'],
      ['Can clients book online?', 'Yes. Your online booking form takes requests with the client’s details and notes.']] },

  { slug: 'drywall', name: 'Drywall', emoji: '🧰', blurb: 'Quote patches and full hangs, schedule every coat and get paid without the chase.',
    title: 'Drywall software for patches and full hangs', lead: 'From a doorknob hole to a basement full of board, {p} keeps your quotes, crews, multi-day schedules and payments in one place.',
    alt: 'Hands smoothing plaster with a trowel',
    pains: [['Multi-day jobs are hard to schedule', 'Hang, tape, mud and sand need return visits with drying time in between.'],
      ['Small patches don’t pay', 'A thirty-minute patch costs you an hour of driving and paperwork.'],
      ['Change orders turn into arguments', 'Extra damage found behind the wall becomes a debate without a written approval.']],
    helps: [['quote', 'Quotes by the sheet or the patch', 'Save your patch, sheet and finish prices. Clients sign and pay a deposit online.'],
      ['calendar', 'Every coat on the calendar', 'Schedule each visit of a multi-day job, all on the same client and job.'],
      ['sign', 'Changes approved in writing', 'Update the quote on site, and the client approves the change on their phone.'],
      ['card', 'Paid when the last coat dries', 'Invoice the balance in a tap, with the deposit already taken off.']],
    steps: ['Measure and send the quote; the client signs and pays a deposit.', 'Schedule the hang, tape and finish visits.', 'Crews snap photos at each stage and the client signs off.', 'Invoice the balance and get paid by card.'],
    faq: [['Can I set a minimum charge for small patches?', 'Yes. Save a minimum service charge in your price list and add it to small jobs.'],
      ['Can my crew track hours on bigger jobs?', 'Yes. Team members clock in on the job, and the hours count toward job profit. Time tracking is on Advanced and Unlimited.']] },

  { slug: 'tile', name: 'Tile', emoji: '🔲', blurb: 'Quote showers and backsplashes by the square foot, collect material deposits and show off every finished floor.',
    title: 'Tile installer software for quotes and deposits', lead: 'Showers, backsplashes and floors: {p} helps you send detailed quotes, take deposits for tile and keep multi-day installs on schedule.',
    alt: 'A hexagonal tile floor',
    pains: [['Clients change their minds on tile', 'Every material change means a new price, written again by hand.'],
      ['Materials paid for up front', 'Special-order tile gets paid for long before the job is done.'],
      ['Extras sneak in for free', 'The “quick” extra row of tile never makes it onto the invoice.']],
    helps: [['quote', 'Square-foot quotes with options', 'Offer Good / Better / Best tile choices on one quote. The client picks one, signs and pays the deposit online.'],
      ['calendar', 'Multi-day installs, scheduled', 'Demo, prep, set and grout visits on the calendar, all on the same job.'],
      ['camera', 'Your best work, saved', 'Before and after photos with every job, ready for your gallery and social posts.'],
      ['card', 'Balance paid on completion', 'Invoice in one tap, with the deposit already taken off.']],
    steps: ['Measure and send tile options; the client picks one, signs and pays the deposit.', 'Order the tile and schedule each stage of the install.', 'Snap progress photos and get the client’s sign-off.', 'Invoice the balance and get paid by card.'],
    faq: [['Can clients choose between tile options on one quote?', 'Yes. Good / Better / Best options show side by side, and the client approves the one they want.'],
      ['Can I take a deposit for special-order tile?', 'Yes. Set the deposit on the quote, and the client pays it online when they sign.']] },

  { slug: 'insulation', name: 'Insulation', emoji: '🧤', blurb: 'Quote attics and crawl spaces from a quick walk-through, schedule crews and get paid when the job is done.',
    title: 'Insulation contractor software', lead: 'Attics, walls and crawl spaces: {p} turns your walk-through into a quote, a crew schedule and an invoice, with photos to prove the work.',
    alt: 'A worker beside pink fiberglass insulation in a wall',
    pains: [['Nobody sees the finished work', 'Insulation is hidden once it’s in, so clients wonder what they paid for.'],
      ['Quotes need measurements and math', 'Square footage, R-values and depth add up to a long evening of quotes.'],
      ['Crews in different attics', 'Keeping track of which crew is at which house takes calls all day.']],
    helps: [['camera', 'Before and after photos', 'Photos of the empty attic and the finished depth, saved with the client and job.'],
      ['quote', 'Quotes from your price list', 'Save prices by square foot and R-value. Clients sign and pay a deposit online.'],
      ['route', 'Crews on the map', 'The dispatch map shows every crew’s day in driving order.'],
      ['card', 'Paid at the end of the day', 'Invoice in one tap. Clients pay by card or bank from a secure link.']],
    steps: ['Walk the attic and send a quote by R-value; the client signs.', 'Schedule the crew and send the client a reminder.', 'Crews snap before and after photos of the depth.', 'Invoice and get paid by card.'],
    faq: [['Can I keep photos as proof of the work?', 'Yes. Every photo is saved with the client and job, so you have proof of the depth if anyone asks.'],
      ['Can I offer a better R-value as an upgrade?', 'Yes. Good / Better / Best options let the client pick the R-value they want on one quote.']] },

  { slug: 'cabinets-countertops', name: 'Cabinets & countertops', emoji: '🗄️', blurb: 'Quote kitchens with clear options, collect deposits for materials and keep installs on track.',
    title: 'Cabinet and countertop software for installers', lead: 'Kitchen installs have a lot of moving parts. {p} keeps your quotes, deposits, templating, install days and payments in one place.',
    alt: 'A new white kitchen with cabinets and an island',
    pains: [['Options make quotes complicated', 'Door styles, finishes and countertop materials each change the price.'],
      ['Big deposits, loosely tracked', 'Material deposits come in by check and get lost in the notebook.'],
      ['Install days slip', 'Templating, fabrication and install dates move, and the client hears about it last.']],
    helps: [['quote', 'Options on one quote', 'Good / Better / Best options for cabinets and countertops, side by side. The client picks, signs and pays a deposit online.'],
      ['card', 'Deposits and progress payments', 'Take a deposit at signing and let clients pay the balance in parts, all tracked on the invoice.'],
      ['calendar', 'Templating and install days', 'Schedule each visit on the calendar, and clients get a reminder before each one.'],
      ['profit', 'Profit on every kitchen', 'Job profit compares the price with materials and labor. It’s on Advanced and Unlimited.']],
    steps: ['Send options for cabinets and counters; the client signs and pays the deposit.', 'Schedule templating, then the install.', 'Install, snap photos and get the client’s sign-off.', 'Invoice the balance with the deposit taken off.'],
    faq: [['Can clients pay in more than one payment?', 'Yes. You can let clients pay part of an invoice now and the rest later, and every payment is recorded.'],
      ['Can I add my own contract terms to quotes?', 'Yes. Add your terms or disclaimer to quotes, and clients see them before they sign.']] },

  { slug: 'foundation-waterproofing', name: 'Foundation & waterproofing', emoji: '🌧️', blurb: 'Inspect, photograph and quote repairs on site, then schedule crews and collect payments as the job moves along.',
    title: 'Foundation repair and waterproofing software', lead: 'Wet basements and cracked foundations are big decisions for homeowners. {p} helps you show the problem with photos, quote it clearly and keep the work and payments on track.',
    alt: 'A construction worker on a rebar frame',
    pains: [['Homeowners need to see it', 'A crack you found in a dark crawl space is hard to explain at the kitchen table.'],
      ['Big jobs, slow decisions', 'Quotes for thousands of dollars sit on the counter while homeowners collect more bids.'],
      ['Many stages, many crews', 'Excavation, drainage and repairs need different crews on different days.']],
    helps: [['camera', 'Photos that tell the story', 'Snap the cracks and water marks and keep them with the quote and the job.'],
      ['quote', 'Options they can sign', 'Good / Better / Best repair options on one quote, signed with a deposit online.'],
      ['calendar', 'Crews on the right days', 'Schedule each stage of the job and move it when the weather changes.'],
      ['card', 'Progress payments', 'Take a deposit at signing and let clients pay the rest in parts, all tracked on the invoice.']],
    steps: ['Inspect, photograph and send repair options; the client signs and pays a deposit.', 'Schedule excavation and repairs.', 'Crews document each stage with photos.', 'Invoice the balance and get paid.'],
    faq: [['Can I include my warranty terms?', 'Yes. Add your terms or disclaimer to the quote, and clients see them before they sign.'],
      ['Can I use a checklist for inspections?', 'Yes. Build an inspection checklist with notes and photos and fill it in on site. Checklists are on Advanced and Unlimited.']] },

  { slug: 'paving-sealcoating', name: 'Paving & sealcoating', emoji: '🛣️', blurb: 'Quote driveways and lots by the square foot, schedule around the weather and bill every job on the spot.',
    title: 'Paving and sealcoating software', lead: 'Sealcoating season is short and depends on the weather. {p} keeps your quotes, routes, rain delays and payments in one place, so you can move fast when the sun’s out.',
    alt: 'A paving machine laying fresh asphalt',
    pains: [['Rain wrecks the plan', 'Every rainy day means calling a dozen clients to reschedule.'],
      ['Measuring and quoting takes nights', 'Square footage, crack filling and striping all need pricing for every lot.'],
      ['Mailed invoices get paid late', 'Invoices sent after the job come back weeks later, if at all.']],
    helps: [['quote', 'Square-foot quotes', 'Save sealcoat, crack fill and striping prices. Clients approve and pay a deposit online.'],
      ['calendar', 'Rain-day rescheduling', 'Drag jobs to the next dry day, and clients get a reminder for the new date.'],
      ['route', 'Routes by neighborhood', 'The dispatch map puts the day’s jobs in driving order.'],
      ['card', 'Paid on completion', 'Invoice in one tap. Clients pay by card or bank to your own Stripe account.']],
    steps: ['Measure the driveway and send the quote; the client approves it online.', 'Schedule by neighborhood and move jobs when it rains.', 'Crack fill, seal and snap before and after photos.', 'Invoice and get paid by card.'],
    faq: [['Can I bring clients back every year or two?', 'Yes. Recurring jobs schedule the next visit ahead, and service plans bill members on a schedule.'],
      ['Can I quote commercial lots too?', 'Yes. Quotes work the same for any size, with as many lines as you need.']] },

  { slug: 'home-inspection', name: 'Home inspection', emoji: '🔍', blurb: 'Book inspections online, fill in your checklist on site and send the report and invoice the same day.',
    title: 'Home inspection software for bookings, checklists and payments', lead: 'Agents want it fast, buyers want it clear. {p} handles booking, on-site checklists with photos, and payment, so your report and invoice go out the same day.',
    alt: 'A home inspector in a hard hat checking a tablet',
    pains: [['Booking around closings', 'Agents call, buyers text and the calendar fills up with double-bookings.'],
      ['Notes on paper, photos on the phone', 'Matching photos to the right part of the report takes hours.'],
      ['Getting paid before closing', 'Chasing payment while the deal moves forward is awkward for everyone.']],
    helps: [['portal', 'Online booking', 'Clients and agents request an inspection from your booking form.'],
      ['sign', 'Inspection checklists', 'Build your checklist with Pass / Fail, notes and photos, fill it in on site and share the finished PDF. Checklists are on Advanced and Unlimited.'],
      ['card', 'Paid before you leave', 'Send the invoice with a pay link and collect by card or bank.'],
      ['calendar', 'One calendar for every inspection', 'Every inspection on one calendar, with a reminder to the client.']],
    steps: ['The client books online; send the quote for the inspection.', 'Confirm the time on the calendar and send a reminder.', 'Fill in your checklist with photos on site.', 'Share the checklist PDF and the invoice the same day.'],
    faq: [['Can I build my own inspection checklist?', 'Yes. Add checkboxes, Pass / Fail, notes, numbers and photos, and fill it in on your phone. Checklists are on Advanced and Unlimited.'],
      ['Can I offer radon or sewer scope add-ons?', 'Yes. Save add-ons in your price list and add them to any quote.']] },

  { slug: 'home-watch', name: 'Home watch', emoji: '🏡', blurb: 'Check empty and seasonal homes on a schedule, send owners photos and bill monthly without the paperwork.',
    title: 'Home watch software for scheduled checks', lead: 'Owners away for the season want to know their home is fine. {p} schedules your checks, keeps a checklist and photos for every visit and bills owners each month.',
    alt: 'A hand holding a key to a front door',
    pains: [['Owners want proof', 'A phone call saying “all good” doesn’t reassure an owner a thousand miles away.'],
      ['Visits slip through the cracks', 'Weekly and every-other-week checks across dozens of homes are hard to keep straight.'],
      ['Monthly billing by hand', 'Writing the same invoices every month takes an afternoon.']],
    helps: [['repeat', 'Checks on a schedule', 'Recurring jobs put every weekly check on the calendar ahead of time.'],
      ['sign', 'A checklist for every visit', 'Walk the house with your checklist, photos included, and share the finished PDF with the owner. Checklists are on Advanced and Unlimited.'],
      ['member', 'Monthly plans that bill themselves', 'Service plans bill each owner every month and book the visits. Service plans are on Advanced and Unlimited.'],
      ['route', 'Homes in driving order', 'The dispatch map puts the day’s homes in the shortest driving order.']],
    steps: ['Agree on a plan and the check schedule with the owner.', 'The visits land on the calendar automatically.', 'Walk the home with your checklist and snap photos.', 'Share the report, and the plan bills each month.'],
    faq: [['How do owners pay each month?', 'Service plans email each invoice with a pay link every month, and owners pay by card or bank.'],
      ['Can I share the visit report with the owner?', 'Yes. Send the finished checklist as a PDF, with photos.']] },

  { slug: 'solar-panel-cleaning', name: 'Solar panel cleaning', emoji: '☀️', blurb: 'Quote by the panel, book yearly cleanings and keep your routes full all season.',
    title: 'Solar panel cleaning software', lead: 'Clean panels make more power, and owners know it. {p} quotes by the panel, books the yearly cleaning and gets you paid before you come off the roof.',
    alt: 'A worker in a hard hat on solar panels',
    pains: [['One-time jobs, no repeat', 'You clean the panels once and never hear from the owner again.'],
      ['Every quote needs a site visit', 'Counting panels and checking roof access for every quote eats your day.'],
      ['Spread-out routes', 'Jobs across town waste hours of driving.']],
    helps: [['quote', 'Per-panel quotes', 'Save per-panel prices and add-ons like bird guards. With Snap to quote on Unlimited, the client’s photos become a draft quote.'],
      ['repeat', 'Next year’s cleaning booked', 'Recurring jobs schedule the next cleaning before you leave.'],
      ['route', 'Roofs in driving order', 'The dispatch map orders the day’s roofs to cut your driving.'],
      ['card', 'Paid before you leave', 'Invoice in one tap and get paid by card.']],
    steps: ['Quote by the panel from the client’s photos or a quick visit.', 'Book this cleaning and the next one.', 'Clean, snap before and after photos and get a sign-off.', 'Invoice and get paid by card.'],
    faq: [['Can clients send panel photos for a quote?', 'Yes. Your online booking form takes photos with the request.'],
      ['Can I add bird guards to the same job?', 'Yes. Save them in your price list and add them to any quote.']] },

  { slug: 'rental-cleaning', name: 'Vacation rental cleaning', emoji: '🛏️', blurb: 'Schedule turnovers between guests, follow a checklist in every unit and bill hosts without the spreadsheet.',
    title: 'Vacation rental cleaning software for turnovers', lead: 'Check-out at 11, check-in at 4. {p} keeps your turnovers, cleaners, checklists and host billing in one place, so every unit is guest-ready on time.',
    alt: 'A cleaner making a bed',
    pains: [['Tight turnover windows', 'Five hours between guests, and a late cleaner means a bad review for the host.'],
      ['Every unit is different', 'Linens, door codes and supply closets change from unit to unit.'],
      ['Billing hosts for each clean', 'Counting cleans per property at the end of the month takes hours.']],
    helps: [['calendar', 'Turnovers on one calendar', 'Every clean on the calendar, assigned to a cleaner and visible on their phone.'],
      ['sign', 'A checklist for every unit', 'Checklists with required photos, filled in on site. Checklists are on Advanced and Unlimited.'],
      ['phone', 'Unit notes in the cleaner’s pocket', 'The address, notes and photos for each property on the cleaner’s phone.'],
      ['receipt', 'Billing hosts in minutes', 'Invoice each host for their cleans with a pay link.']],
    steps: ['Agree on a price per turnover with the host.', 'Add each turnover to the calendar and assign a cleaner.', 'The cleaner follows the checklist and snaps photos.', 'Invoice the host for the cleans.'],
    faq: [['Can I require photos before a clean is marked done?', 'Yes. Make the checklist required, with photo items, and it has to be finished before the job is complete. Checklists are on Advanced and Unlimited.'],
      ['Can I keep notes for each property?', 'Yes. Notes and photos saved with the client show up on every visit.']] },

  { slug: 'duct-cleaning', name: 'Air duct cleaning', emoji: '🌬️', blurb: 'Quote by the vent, show before and after photos and bring clients back when it’s time again.',
    title: 'Air duct cleaning software', lead: 'Duct cleaning sells on proof. {p} helps you quote by the vent, show the before and after, and book the next cleaning before you leave.',
    alt: 'A technician on a ladder at a ceiling access panel',
    pains: [['Clients can’t see the dirt', 'Without photos, the job looks the same before and after.'],
      ['Cheap ads set the price', '“Whole house for $99” ads make an honest per-vent quote a hard sell.'],
      ['No repeat business', 'Clients forget about you until they see the next ad.']],
    helps: [['camera', 'Before and after photos', 'Snap inside the ducts before and after, and keep the photos with the job.'],
      ['quote', 'Clear per-vent quotes', 'List vents, returns and the dryer vent separately, or offer Good / Better / Best packages.'],
      ['repeat', 'The next cleaning booked ahead', 'Recurring jobs schedule the next cleaning, with a reminder before it.'],
      ['card', 'Paid on site', 'Invoice in one tap and get paid by card.']],
    steps: ['Count the vents and send package options; the client picks one.', 'Book the visit and send a reminder.', 'Clean, snap before and after photos and get a sign-off.', 'Invoice and book the next cleaning.'],
    faq: [['Can I add dryer vent cleaning to the same visit?', 'Yes. Add it as an option or an extra line on the quote.'],
      ['Can I show clients the photos?', 'Yes. Photos are saved with the job, ready to show the client.']] },

  { slug: 'hood-cleaning', name: 'Kitchen hood cleaning', emoji: '🍳', blurb: 'Keep restaurant hood cleanings on schedule, document every visit and bill clients without the paperwork.',
    title: 'Kitchen exhaust hood cleaning software', lead: 'Restaurants need their hoods cleaned on a schedule, after closing. {p} keeps your cleanings, night crews, photos and invoices in one place.',
    alt: 'A cook at the stove in a commercial kitchen',
    pains: [['Schedules set by the fire code', 'Monthly, quarterly and twice-a-year cleanings are easy to miss.'],
      ['Proof for the inspector', 'Owners need before and after photos and a record of every cleaning.'],
      ['Night work, morning paperwork', 'Crews finish at 3am, and the invoices wait until someone gets to them.']],
    helps: [['member', 'Cleanings on a plan', 'Service plans bill monthly, quarterly or yearly and schedule the cleanings the plan includes. Service plans are on Advanced and Unlimited.'],
      ['camera', 'Photos and a checklist every visit', 'Before and after photos and a completed checklist saved with every cleaning. Checklists are on Advanced and Unlimited.'],
      ['clock', 'Night crews, tracked', 'Crews clock in and out on the job. Time tracking is on Advanced and Unlimited.'],
      ['receipt', 'Invoices the same night', 'Invoice in one tap with a pay link, and see who owes what at a glance.']],
    steps: ['Quote the hood system and how often it needs cleaning.', 'The cleanings land on the calendar ahead of time.', 'Clean after close, fill in the checklist and snap photos.', 'Invoice the restaurant with a pay link.'],
    faq: [['Can I give the restaurant a cleaning report?', 'Yes. Send the completed checklist as a PDF, with photos.'],
      ['Can each restaurant have its own schedule?', 'Yes. Each client’s plan or recurring job has its own schedule.']] },

  { slug: 'restoration', name: 'Water & fire restoration', emoji: '🌊', blurb: 'Respond to emergencies, document damage with photos and keep multi-day jobs and payments on track.',
    title: 'Restoration software for water and fire damage', lead: 'Restoration starts with a call at the worst moment of someone’s week. {p} keeps your emergency jobs, photos, drying visits, crews and payments together.',
    alt: 'A house surrounded by floodwater',
    pains: [['Emergencies don’t wait', 'Every flood call means reshuffling crews and equipment by phone.'],
      ['Documentation is everything', 'Photos and notes scattered across phones make the insurance paperwork a nightmare.'],
      ['Many visits per job', 'Drying checks every day for a week are easy to lose track of.']],
    helps: [['camera', 'Photos with every visit', 'Every photo saved with the client and job, ready for the adjuster.'],
      ['calendar', 'Daily drying checks', 'Schedule each monitoring visit on the calendar, on the same job.'],
      ['sign', 'Readings on a checklist', 'Moisture readings and notes on a checklist, filled in on site. Checklists are on Advanced and Unlimited.'],
      ['card', 'Deposits and partial payments', 'Collect a deposit up front and the rest later, all tracked on the invoice.']],
    steps: ['Document the damage and send the quote; the client signs on their phone.', 'Schedule the drying checks and the repairs.', 'Record readings and photos on every visit.', 'Invoice and track every payment.'],
    faq: [['Can I keep all the photos for one job together?', 'Yes. Every photo is saved with the client and the job.'],
      ['Can the client pay part now and part later?', 'Yes. Deposits and partial payments are tracked on the invoice.']] },

  { slug: 'mold-remediation', name: 'Mold remediation', emoji: '🦠', blurb: 'Inspect, photograph and quote on site, then follow a checklist through every stage of the job.',
    title: 'Mold remediation software', lead: 'Mold jobs need careful records from the first look to the final cleaning. {p} keeps your inspections, quotes, photos, checklists and payments in one place.',
    alt: 'A worker in a protective suit and gloves',
    pains: [['Homeowners are worried and unsure', 'A scary word and a big number make clients hesitate without clear proof.'],
      ['Every stage needs a record', 'Containment, removal and cleaning all need notes and photos.'],
      ['Quotes take a second trip', 'Writing the plan at the office means a second visit to present it.']],
    helps: [['camera', 'Photos that explain the problem', 'Snap the affected areas and keep the photos with the quote.'],
      ['quote', 'Quote at the kitchen table', 'Build the quote on your phone, and the client signs and pays the deposit right there.'],
      ['sign', 'A checklist for each stage', 'Containment, removal and cleaning steps on a checklist that must be finished before the job is complete. Checklists are on Advanced and Unlimited.'],
      ['card', 'Paid when it’s done', 'Invoice the balance with the deposit already taken off.']],
    steps: ['Inspect, photograph and send the quote; the client signs.', 'Schedule containment, removal and the final visit.', 'Follow your checklist, with photos at every stage.', 'Invoice the balance and get paid.'],
    faq: [['Can I require a checklist before the job is marked done?', 'Yes. A required checklist has to be finished before the job is marked complete. Checklists are on Advanced and Unlimited.'],
      ['Can I share my notes and photos with the client?', 'Yes. Send the finished checklist as a PDF, with photos.']] },

  { slug: 'backflow-testing', name: 'Backflow testing', emoji: '🚰', blurb: 'Keep yearly tests on schedule, record results on site and bill every device without the paperwork.',
    title: 'Backflow testing software for yearly tests', lead: 'Every backflow device needs a test every year. {p} keeps your devices, due dates, test checklists and invoices in one place, so nothing comes due by surprise.',
    alt: 'A valve on water pipes',
    pains: [['Due dates everywhere', 'Hundreds of devices, each due in a different month.'],
      ['Results on paper', 'Readings written on a form get lost before they reach the water district.'],
      ['Lots of small invoices', 'Every test is a small invoice that still takes time to write.']],
    helps: [['repeat', 'Yearly tests scheduled ahead', 'Recurring jobs put each device’s yearly test on the calendar.'],
      ['sign', 'Test checklists on site', 'Record readings, Pass / Fail and photos on a checklist and share the PDF. Checklists are on Advanced and Unlimited.'],
      ['route', 'Tests in driving order', 'The dispatch map orders the day’s tests to cut your driving.'],
      ['receipt', 'Invoices in one tap', 'Invoice each test with a pay link and see who owes what.']],
    steps: ['Quote the test per device.', 'Yearly tests land on the calendar automatically.', 'Run the test and record the readings on your checklist.', 'Share the results and invoice in one tap.'],
    faq: [['Can I record test readings?', 'Yes. Checklists take numbers, Pass / Fail, notes and photos. Checklists are on Advanced and Unlimited.'],
      ['Do clients get a reminder before their test?', 'Yes. Clients get a reminder before each scheduled visit.']] },

  { slug: 'fire-safety', name: 'Fire safety inspections', emoji: '🧯', blurb: 'Inspect extinguishers and alarms on schedule, record results on site and bill every building without the paperwork.',
    title: 'Fire extinguisher and alarm inspection software', lead: 'Yearly inspections and a lot of small devices: {p} keeps your schedules, inspection checklists, photos and invoices in one place.',
    alt: 'A fire extinguisher mounted on a wall',
    pains: [['Inspections come due all year', 'Every building has its own dates, and missing one is a compliance problem.'],
      ['Device counts on paper', 'Tagging dozens of extinguishers and writing them up later takes hours.'],
      ['Owners need proof, fast', 'Building owners want a record of every inspection when the fire marshal asks.']],
    helps: [['member', 'Inspection plans that bill themselves', 'Service plans bill each client on a schedule and book the inspections. Service plans are on Advanced and Unlimited.'],
      ['sign', 'Inspection checklists', 'Record each device with Pass / Fail, notes and photos, and share the finished PDF. Checklists are on Advanced and Unlimited.'],
      ['route', 'Buildings in driving order', 'The dispatch map puts the day’s buildings in the shortest driving order.'],
      ['receipt', 'Invoices in one tap', 'Invoice each building with a pay link.']],
    steps: ['Quote the inspection by device count.', 'Schedule the yearly inspections ahead.', 'Inspect every device with your checklist.', 'Share the report and invoice in one tap.'],
    faq: [['Can I give the building owner a report?', 'Yes. Send the finished checklist as a PDF, with photos.'],
      ['Can I price by the device?', 'Yes. Save per-device prices and add the count to each quote.']] },

  { slug: 'ev-generators', name: 'EV chargers & generators', emoji: '🔋', blurb: 'Quote installs with clear options, collect equipment deposits and keep install days on track.',
    title: 'Software for EV charger and generator installers', lead: 'Charger and generator installs are bigger jobs with more steps. {p} handles the quote with options, the deposit, the install day and the final invoice in one place.',
    alt: 'An electric car charging at a home',
    pains: [['Options confuse homeowners', 'Charger levels, generator sizes and transfer switches all change the price.'],
      ['Equipment bought up front', 'You buy the unit before the client pays.'],
      ['Permits move the date', 'The install date shifts, and the client hears about it last.']],
    helps: [['quote', 'Options side by side', 'Good / Better / Best options for units and install packages. Clients sign and pay a deposit online.'],
      ['card', 'Deposits for equipment', 'Collect a deposit at signing that covers the unit, tracked on the invoice.'],
      ['calendar', 'Install days that move with permits', 'Drag the install when the inspection date changes, and the client gets a reminder for the new date.'],
      ['member', 'Yearly generator maintenance', 'Sell a maintenance plan that bills and books the yearly service. Service plans are on Advanced and Unlimited.']],
    steps: ['Send install options; the client signs and pays the deposit.', 'Order the unit and schedule the install.', 'Install, snap photos and get the sign-off.', 'Invoice the balance and get paid.'],
    faq: [['Can I sell maintenance plans for generators?', 'Yes. Service plans bill members and schedule the visits the plan includes. Service plans are on Advanced and Unlimited.'],
      ['Can I take a deposit for the equipment?', 'Yes. Set a deposit on the quote; the client pays it online when they sign.']] },

  { slug: 'well-septic', name: 'Well & septic', emoji: '🪣', blurb: 'Schedule pumping and inspections, keep system notes on every property and bill each visit on the spot.',
    title: 'Well and septic service software', lead: 'Every septic tank and well pump has its own history. {p} keeps your system notes, pumping schedules, crews and invoices together, so you know what you’re walking into.',
    alt: 'A worker digging with a shovel',
    pains: [['Where’s the tank lid?', 'Without notes and photos, every visit starts with a search.'],
      ['Clients forget when they’re due', 'Pumping every few years is easy to forget until there’s a backup.'],
      ['Emergencies scramble the route', 'A backed-up system can’t wait until next week.']],
    helps: [['phone', 'System notes and photos', 'Tank size, lid location and photos saved with the client and shown on every visit.'],
      ['repeat', 'The next pumping booked ahead', 'Recurring jobs schedule the next pumping, with a reminder before it.'],
      ['calendar', 'Room for emergencies', 'Drag the day’s jobs around, and the crew sees the change on their phone.'],
      ['card', 'Paid on site', 'Invoice in one tap and get paid by card or bank.']],
    steps: ['Quote the pumping or inspection.', 'Schedule the visit and send a reminder.', 'Find the lid from last time’s photos, do the work and note the tank’s condition.', 'Invoice and book the next pumping.'],
    faq: [['Can I save where the tank is?', 'Yes. Notes and photos saved with the client show up on every visit.'],
      ['Can I use a checklist for inspections?', 'Yes. Build your inspection checklist and fill it in on site. Checklists are on Advanced and Unlimited.']] },

  { slug: 'wildlife-removal', name: 'Wildlife removal', emoji: '🦝', blurb: 'Answer critter calls fast, schedule trap checks and exclusion work and bill each visit without the paperwork.',
    title: 'Wildlife removal software', lead: 'Raccoons in the attic, bats in the eaves: {p} keeps your calls, trap checks, exclusion quotes and payments in one place.',
    alt: 'A raccoon on a lawn',
    pains: [['Trap checks can’t be missed', 'Traps across town need checking every day, without fail.'],
      ['Exclusion quotes need proof', 'Clients won’t pay to seal entry points they can’t see.'],
      ['Many visits, many invoices', 'Setup, checks and removal are all separate trips to keep track of.']],
    helps: [['calendar', 'Trap checks on the calendar', 'Schedule every check as its own visit on the same job.'],
      ['camera', 'Photos that sell the exclusion', 'Snap entry points and damage, and send the exclusion quote with the photos.'],
      ['quote', 'Exclusion quotes they can sign', 'Clients approve the exclusion work and pay a deposit online.'],
      ['card', 'Paid as you go', 'Invoice each visit or the whole job, and track every payment.']],
    steps: ['Inspect and send a quote for removal and exclusion.', 'Set the traps and schedule the daily checks.', 'Remove the animals, seal the entry points and snap photos.', 'Invoice and get paid by card.'],
    faq: [['Can I schedule daily trap checks?', 'Yes. Recurring jobs can repeat daily, each check with its own visit.'],
      ['Can I show the client photos of the entry points?', 'Yes. Photos are saved with the job, ready to show the client.']] },

  { slug: 'pet-waste-removal', name: 'Pet waste removal', emoji: '🐕', blurb: 'Run weekly yard routes, bill subscribers every month and add new yards without adding paperwork.',
    title: 'Pet waste removal software for weekly routes', lead: 'Weekly yards, monthly billing and a route that grows every month: {p} keeps your subscribers, routes and payments running on their own.',
    alt: 'A dog playing with a toy on a lawn',
    pains: [['Weekly routes kept in your head', 'Which yards are Monday and which one has the tricky gate lives in your memory.'],
      ['Billing every month by hand', 'Dozens of small invoices every month take an afternoon.'],
      ['New help doesn’t know the yards', 'The new hire doesn’t know which yard has the dog that bolts.']],
    helps: [['member', 'Subscriptions that bill themselves', 'Service plans bill each yard monthly and book the visits. Service plans are on Advanced and Unlimited.'],
      ['route', 'Routes in driving order', 'The dispatch map lines up the day’s yards in the shortest order.'],
      ['phone', 'Gate and dog notes', 'Gate notes, dog names and photos on the tech’s phone at every stop.'],
      ['repeat', 'Weekly visits on autopilot', 'Recurring jobs schedule every week ahead. In every plan.']],
    steps: ['Quote by the number of dogs and visits per week.', 'Weekly visits land on the calendar.', 'Clean the yard and mark it done, with a photo of the closed gate.', 'Monthly invoices go out with pay links.'],
    faq: [['Can I bill monthly for weekly visits?', 'Yes. Service plans bill each month and include the visits you set. Service plans are on Advanced and Unlimited.'],
      ['Can I add a one-time spring cleanup?', 'Yes. Quote it as its own job, alongside the weekly visits.']] },

  { slug: 'pet-grooming', name: 'Mobile pet grooming', emoji: '🐩', blurb: 'Book grooming appointments online, keep notes on every pet and get paid at the van door.',
    title: 'Mobile pet grooming software', lead: 'Every dog has its own cut, temperament and schedule. {p} keeps your bookings, pet notes, repeat appointments and payments in one place, right from the van.',
    alt: 'A groomer trimming a small white dog',
    pains: [['Rebooking regulars', 'Regulars need a groom every few weeks, and booking each one by text never ends.'],
      ['Every pet is different', 'Cut styles, allergies and behavior notes are scribbled somewhere.'],
      ['Gaps in a full day', 'A forgotten appointment is an empty slot you can’t fill.']],
    helps: [['repeat', 'Regulars on a schedule', 'Recurring jobs book regular grooms ahead of time.'],
      ['phone', 'Notes on every pet', 'Cut style, allergies and behavior notes saved with the client and shown on every visit.'],
      ['portal', 'Online booking', 'New clients request an appointment from your booking form.'],
      ['card', 'Paid at the van', 'Invoice in one tap and get paid by card.']],
    steps: ['Quote by breed, size and service.', 'Book this groom and the regular ones after it.', 'Groom, snap a photo of the finished look and add notes.', 'Invoice and get paid at the van.'],
    faq: [['Can I save notes for each pet?', 'Yes. Notes and photos are saved with the client and show up on every visit.'],
      ['Do clients get a reminder before the groom?', 'Yes. Clients get a reminder before each scheduled visit.']] }

];
const BY_SLUG = Object.fromEntries(INDUSTRIES.map((i) => [i.slug, i]));

// the industry a business picks at sign-up (and in Company Profile): one of the pages above, or Other with their own words.
// Saved in the account's company profile as industry (slug) + industryOther; Alpha counts, filters and targets accounts by it.
// alphabetical, for the Industries menu and the industry dropdowns (the pages and the home strip keep the order above)
const SORTED = [...INDUSTRIES].sort((a, b) => a.name.localeCompare(b.name));
const CHOICES = [...SORTED.map((i) => ({ slug: i.slug, name: i.name })), { slug: 'other', name: 'Other' }];
// { industry, industryOther } to save, or { error }
function choose(slug, other) {
  slug = String(slug || '').trim(); other = String(other || '').trim().slice(0, 80);
  if (!CHOICES.some((c) => c.slug === slug)) return { error: 'Choose your industry' };
  if (slug === 'other' && !other) return { error: 'Tell us your industry' };
  return { industry: slug, industryOther: slug === 'other' ? other : '' };
}
// the name to show: 'HVAC', 'Other: Septic pumping', or '' when not set
const label = (slug, other) => (slug === 'other' ? `Other${other ? ': ' + other : ''}` : (BY_SLUG[slug] || {}).name || '');

const productName = () => tenancy.platform().settings.productName || 'Worklio Pro';
const product = () => esc(productName());
const homeHref = () => (tenancy.devMode ? '/home' : '/');
const fill = (s) => s.replace(/\{p\}/g, product());
const lower = (n) => n.replace(/\b[A-Z][a-z]/g, (w) => w.toLowerCase()); // in a sentence: 'Lawn care' → 'lawn care', 'HVAC' stays
const photo = (i) => `/img/industries/${i.slug}.jpg`;
// industries without a photo yet show their line icon on a tinted panel instead
const HAS_PHOTO = new Set(require('fs').readdirSync(require('path').join(__dirname, '..', 'public', 'img', 'industries')).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4)));
const picture = (i, cls, alt) => (HAS_PHOTO.has(i.slug) ? `<img${cls ? ` class="${cls}"` : ''} src="${photo(i)}" alt="${esc(alt)}" width="1200" height="900"${cls ? '' : ' loading="lazy"'}>`
  : `<span class="i-nophoto${cls ? ' ' + cls : ''}" role="img" aria-label="${esc(i.name)}">${require('./icons').svg(MENU_ICONS[i.slug] || LINE('wrench'), 96)}</span>`);

// the "Industries" dropdown in the header (public/menu.js opens it)
// the Industries menu's line icons, drawn on the same 24×24 grid as the app's menu icons (lib/icons.js); the home page's trades strip uses them too
const LINE = (k) => require('./icons').LIBRARY[k][1];
const MENU_ICONS = {
  hvac: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="m9 3 3 2 3-2M9 21l3-2 3 2"/>',
  plumbing: LINE('wrench'),
  electrical: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  'lawn-care': '<path d="M5 21c.5-4.5 2.5-8 7-10"/><path d="M8.5 17.5C4 13 6 4 20 4c0 13-8 16-11.5 13.5z"/>',
  'house-cleaning': LINE('sparkle'),
  'commercial-cleaning': '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M10 22v-4h4v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  roofing: LINE('home'),
  'pest-control': '<path d="M9 7a3 3 0 0 1 6 0"/><rect x="7" y="7" width="10" height="14" rx="5"/><path d="M12 11v10M3 10l4 2M21 10l-4 2M2 15h5M17 15h5M3 20l4-2M21 20l-4-2"/>',
  'pool-service': '<path d="M2 7c2 0 2-1.5 4-1.5S8 7 10 7s2-1.5 4-1.5S16 7 18 7s2-1.5 4-1.5M2 12.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/>',
  painting: '<rect x="3" y="3" width="15" height="6" rx="2"/><path d="M18 6h3v5h-9v3"/><rect x="10" y="14" width="4" height="8" rx="1"/>',
  handyman: '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 13h20M10 12v3h4v-3"/>',
  'pressure-washing': '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>',
  'window-cleaning': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h18"/>',
  'carpet-cleaning': '<path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3"/><path d="M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2z"/><path d="M5 18v2M19 18v2"/>',
  'tree-care': '<path d="M12 22v-7M9 18l3-3 3 3"/><path d="M7 15a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 15z"/>',
  moving: LINE('box'),
  remodeling: '<path d="M4 17v-2a8 8 0 0 1 16 0v2"/><path d="M10 7.3V5h4v2.3"/><rect x="2" y="17" width="20" height="3" rx="1"/>',
  'decks-fencing': '<path d="M3 21V6l2-3 2 3v15M10 21V6l2-3 2 3v15M17 21V6l2-3 2 3v15M7 9h3M14 9h3M7 16h3M14 16h3"/>',
  flooring: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v6M15 9v6M9 15v6"/>',
  'low-voltage': '<path d="M9 2v5M15 2v5"/><path d="M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>',
  networking: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 20h.01"/>',
  'security-cameras': '<path d="M3 6.5 17 3l1.5 6L4.5 12.5z"/><path d="m18.5 7 3-1 .5 2.5-3 .8M8 11.5 9 15H4v5"/>',
  'audio-video': '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m10 8 5 2.5-5 2.5z"/>',
  'garage-doors': '<path d="M3 21V9l9-6 9 6v12"/><path d="M7 21v-9h10v9M7 15h10M7 18h10"/>',
  'appliance-repair': '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M8 6h.01M11 6h.01"/>',
  'junk-removal': '<path d="M2 6h11v11H2zM13 10h4l4 4v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  'snow-removal': '<path d="M7 15a4 4 0 0 1-.9-7.9 6 6 0 0 1 11.8 0A4 4 0 0 1 17 15z"/><path d="M8 19h.01M12 21h.01M16 19h.01M12 17h.01"/>',
  irrigation: '<path d="M12 21v-6M8 21h8"/><path d="M12 15a3 3 0 0 0 3-3"/><path d="M4 8c2-2 4-3 8-3s6 1 8 3M6 11c1.5-1.3 3.5-2 6-2s4.5.7 6 2"/>',
  locksmith: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>',
  'chimney-dryer-vent': '<path d="M3 21h18M5 21V11l7-6 7 6v10"/><path d="M15 8V3h3v7"/>',
  'concrete-masonry': '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9.3h18M3 14.6h18M9 4v5.3M15 9.3v5.3M9 14.6V20"/>',
  'holiday-lighting': '<path d="M2 5c5 4 15 4 20 0"/><path d="M7 7.5v2M12 8.5v2M17 7.5v2"/><circle cx="7" cy="12" r="2"/><circle cx="12" cy="13" r="2"/><circle cx="17" cy="12" r="2"/>',
  'auto-detailing': '<path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><path d="M3 12h18"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>',
  drywall: '<path d="M3 17l8-8h9v4l-8 8H3z"/><path d="M14 9V4h3"/>',
  tile: '<path d="M12 2l5 5-5 5-5-5zM12 12l5 5-5 5-5-5zM2 12l5-5 5 5-5 5zM12 12l5-5 5 5-5 5z"/>',
  insulation: '<path d="M3 21h18M3 3h18"/><path d="M3 9c2 0 2 2 4.5 2S10 9 12 9s2.5 2 4.5 2S19 9 21 9M3 15c2 0 2 2 4.5 2s2.5-2 4.5-2 2.5 2 4.5 2 2.5-2 4.5-2"/>',
  'cabinets-countertops': '<path d="M2 9h20"/><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M12 9v12M9 14v2M15 14v2"/>',
  'foundation-waterproofing': '<path d="M3 21h18M5 21v-6h14v6"/><path d="M12 2s3.5 4 3.5 6.5a3.5 3.5 0 0 1-7 0C8.5 6 12 2 12 2z"/>',
  'paving-sealcoating': '<path d="M8 3 4 21M16 3l4 18M12 4v3M12 11v3M12 18v2"/>',
  'home-inspection': '<circle cx="10" cy="10" r="6"/><path d="m21 21-6.5-6.5"/><path d="M7.5 11.5V9.5L10 7.5l2.5 2v2"/>',
  'home-watch': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  'solar-panel-cleaning': '<path d="M4 18 6 8h12l2 10z"/><path d="M5 13h14M10 8l-1 10M14 8l1 10M12 18v3M8 21h8"/>',
  'rental-cleaning': '<path d="M3 19V8M21 19v-6a3 3 0 0 0-3-3h-7v6"/><path d="M3 16h18"/><circle cx="7" cy="12" r="2"/>',
  'duct-cleaning': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 12h10M7 15h10"/>',
  'hood-cleaning': '<path d="M9 3h6v5l5 6H4l5-6z"/><path d="M4 14v2h16v-2M8 20h.01M12 20h.01M16 20h.01"/>',
  restoration: '<path d="M12 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9z"/><path d="M3 21c2 0 2-1.5 4.5-1.5S10 21 12 21s2.5-1.5 4.5-1.5S19 21 21 21"/>',
  'mold-remediation': '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="10" r="2"/><circle cx="10" cy="16" r="2.5"/><circle cx="17" cy="17" r="1.5"/>',
  'backflow-testing': '<path d="M2 12h5M17 12h5"/><path d="M7 8v8l5-4zM17 8v8l-5-4z"/><path d="M12 12V5M9 5h6"/>',
  'fire-safety': '<rect x="8" y="8" width="8" height="14" rx="2"/><path d="M10 8V5h4v3M14 5h3l2 2M12 3v2"/>',
  'ev-generators': '<rect x="5" y="3" width="12" height="18" rx="2"/><path d="m12 7-3 5h4l-3 5"/><path d="M17 9h2a1 1 0 0 1 1 1v6"/>',
  'well-septic': '<path d="M3 10h18v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z"/><path d="M9 10V6h6v4M3 14h18"/>',
  'wildlife-removal': '<circle cx="7" cy="9" r="1.8"/><circle cx="12" cy="6.5" r="1.8"/><circle cx="17" cy="9" r="1.8"/><path d="M8 17c0-3 2-5 4-5s4 2 4 5c0 2-2 3-4 2s-4 0-4-2z"/>',
  'pet-waste-removal': '<path d="M4 20 14 10"/><path d="m14 10 3-3 4 4-3 3a3 3 0 0 1-4-4z"/>',
  'pet-grooming': '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.1 8.1 20 20M8.1 15.9 20 4"/>',
};
const menuIcon = (i) => require('./icons').svg(MENU_ICONS[i.slug] || LINE('wrench'));
// the header menu shows the 25 most common industries (5 rows of 5), alphabetical; "See all industries" has the rest
const MENU_SLUGS = ['hvac', 'plumbing', 'electrical', 'lawn-care', 'house-cleaning', 'commercial-cleaning', 'roofing', 'pest-control', 'pool-service', 'painting', 'handyman',
  'pressure-washing', 'window-cleaning', 'carpet-cleaning', 'tree-care', 'moving', 'remodeling', 'decks-fencing', 'flooring', 'garage-doors', 'appliance-repair', 'junk-removal',
  'snow-removal', 'security-cameras', 'auto-detailing'];
const MENU = SORTED.filter((i) => MENU_SLUGS.includes(i.slug));
// the Industries page groups every industry under a heading; an industry missing here lands in the last group.
// The headings and the industries under each are shown in alphabetical order (grouped() sorts them)
const GROUPS = [
  ['Heating, plumbing & electrical', ['hvac', 'plumbing', 'electrical', 'appliance-repair', 'garage-doors', 'ev-generators', 'well-septic', 'chimney-dryer-vent', 'backflow-testing']],
  ['Lawn, yard & outdoor', ['lawn-care', 'tree-care', 'irrigation', 'snow-removal', 'pool-service', 'decks-fencing', 'paving-sealcoating', 'holiday-lighting', 'pet-waste-removal']],
  ['Cleaning', ['house-cleaning', 'commercial-cleaning', 'window-cleaning', 'carpet-cleaning', 'pressure-washing', 'rental-cleaning', 'duct-cleaning', 'hood-cleaning', 'solar-panel-cleaning']],
  ['Building & remodeling', ['remodeling', 'roofing', 'painting', 'flooring', 'handyman', 'drywall', 'tile', 'insulation', 'cabinets-countertops', 'concrete-masonry', 'foundation-waterproofing']],
  ['Restoration, safety & inspections', ['pest-control', 'wildlife-removal', 'restoration', 'mold-remediation', 'home-inspection', 'fire-safety', 'locksmith', 'home-watch']],
  ['Tech, moving & mobile services', ['low-voltage', 'networking', 'security-cameras', 'audio-video', 'moving', 'junk-removal', 'auto-detailing', 'pet-grooming']],
];
const grouped = () => { const seen = new Set(GROUPS.flatMap(([, s]) => s)); const rest = INDUSTRIES.filter((i) => !seen.has(i.slug)).map((i) => i.slug);
  return GROUPS.map(([name, slugs], n) => [name, [...slugs, ...(n === GROUPS.length - 1 ? rest : [])].map((s) => BY_SLUG[s]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))])
    .sort((a, b) => a[0].localeCompare(b[0])); };
const menu = () => `<div class="h-menu"><button type="button" class="h-menu-btn" aria-expanded="false" aria-controls="industries-menu">Industries<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
<div class="h-drop" id="industries-menu" hidden><div class="h-drop-grid">${MENU.map((i) => `<a href="/industries/${i.slug}"><span>${menuIcon(i)}</span>${esc(i.name)}</a>`).join('')}</div><a class="h-drop-all" href="/industries">See all industries →</a></div></div>`;
// the trades strip on the home page: the eleven most common trades with their line icons and a link to all of them, twelve even boxes
const STRIP = ['hvac', 'plumbing', 'electrical', 'lawn-care', 'house-cleaning', 'roofing', 'pest-control', 'painting', 'handyman', 'pressure-washing', 'pool-service'];
const strip = () => `<ul>${STRIP.map((k) => INDUSTRIES.find((i) => i.slug === k)).filter(Boolean).map((i) => `<li><a href="/industries/${i.slug}"><span aria-hidden="true">${menuIcon(i)}</span>${esc(i.name)}</a></li>`).join('')}<li class="h-trades-more"><a href="/industries">+ ${INDUSTRIES.length - STRIP.length} more industries →</a></li></ul>`;

const card = (i) => `<a class="i-card" href="/industries/${i.slug}">${picture(i, '', '')}<span><b>${esc(i.name)}</b><span>${fill(i.blurb)}</span></span></a>`;

// head: the page's title, description, share tags and structured data (lib/seo.js)
function shell({ head, body }) {
  const p = product();
  return require('./site-look').look(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${head}
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="stylesheet" href="/styles.css?v=54">
  <link rel="stylesheet" href="/theme.css">
  <link rel="stylesheet" href="/home.css?v=31">
  <link rel="stylesheet" href="/trial.css?v=1">
</head>
<body>
  <header class="h-top h-has-drawer"><div class="h-wrap">
    <a class="h-brand" href="${homeHref()}"><span class="pname">${p}</span></a>
    <!-- on phones this slides out from the right (menu.js); on wider screens it sits inline in the header -->
    <div class="h-panel" id="h-panel">
      <button type="button" class="h-close" aria-label="Close menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <nav class="h-links" aria-label="Site">${require('./features').menu()}${menu()}${require('./site-nav').menu()}<a href="/pricing">Pricing</a><a href="/sign-in">Log in</a></nav>
      <a class="btn" href="/pricing" data-trial>Start 30-day trial</a>
    </div>
    <button type="button" class="h-burger" aria-expanded="false" aria-controls="h-panel" aria-label="Open menu"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    <div class="h-scrim" aria-hidden="true"></div>
  </div></header>
  <main>${body}
    <section class="h-wrap" style="padding-bottom:20px"><div class="h-cta">
      <h2>Ready to spend less time on paperwork?</h2>
      <p>Set up your account in minutes and send your first quote today.</p>
      <a class="btn" href="/pricing" data-trial>Start your free 30-day trial</a>
      <p class="h-cta-note">Free for 30 days · No credit card needed · <a href="/pricing">See plans &amp; pricing</a></p>
    </div></section>
  </main>
  ${require('./site-nav').footer()}
  <script src="/brand.js?v=1"></script>
  <script src="/menu.js?v=4"></script>
  <script>
    // the logo set in the platform console
    fetch('/api/site').then((r) => r.json()).then((s) => {
      if (s && s.brand && s.brand.logo) document.querySelectorAll('.h-brand').forEach((a) => { a.insertAdjacentHTML('afterbegin', brandImg(s.brand)); a.querySelector('.pname').hidden = s.brand.logoHasName; });
    }).catch(() => {});
  </script>
  <script src="/oauth-buttons.js?v=1"></script>
  <script src="/trial.js?v=8"></script>
  <script src="/phone.js?v=2" defer></script>
  <script src="/chat.js?v=9" data-where="site" defer></script>
</body>
</html>`);
}

function indexPage() {
  return shell({ head: require('./seo').industriesHead(),
    body: `
    <section class="h-hero i-index-hero"><div class="h-wrap i-hero-solo">
      <span class="h-eyebrow">Industries</span>
      <h1>Built for the industries that <em>keep things running</em></h1>
      <p class="lead">Every service business quotes, schedules, does the work and gets paid. ${product()} handles all four, with the details each industry cares about.</p>
      <label class="i-find"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input type="search" id="i-find" placeholder="Find your industry" autocomplete="off" aria-label="Find your industry"></label>
    </div></section>
    <section class="h-sec i-groups-sec"><div class="h-wrap">
      <div class="i-groups">${grouped().map(([name, list]) => `<section class="i-group"><h2>${esc(name)}</h2><ul>${list.map((i) => `<li><a href="/industries/${i.slug}" data-name="${esc(i.name.toLowerCase())}"><span aria-hidden="true">${menuIcon(i)}</span>${esc(i.name)}</a></li>`).join('')}</ul></section>`).join('')}</div>
      <p class="i-none" id="i-none" hidden>No industry by that name yet, but if you quote, schedule and invoice work at your clients’ homes or businesses, ${product()} works for you. <a href="/pricing">See plans</a></p>
      <p class="i-more">Don’t see your industry? If you quote, schedule and invoice work at your clients’ homes or businesses, ${product()} works for you. <a href="/pricing">See plans</a></p>
    </div></section>
    <script>
      // "Find your industry": hides the industries (and headings) that don't match what's typed
      (function () {
        var box = document.getElementById('i-find'); if (!box) return;
        box.addEventListener('input', function () {
          var q = box.value.trim().toLowerCase(), any = false;
          document.querySelectorAll('.i-group').forEach(function (g) {
            var shown = 0;
            g.querySelectorAll('li').forEach(function (li) { var hit = !q || li.firstElementChild.getAttribute('data-name').indexOf(q) > -1; li.hidden = !hit; if (hit) shown++; });
            g.hidden = !shown; if (shown) any = true;
          });
          document.getElementById('i-none').hidden = any;
        });
      })();
    </script>` });
}

function page(slug) {
  const i = BY_SLUG[slug]; if (!i) return null;
  const others = INDUSTRIES.filter((x) => x !== i); const start = INDUSTRIES.indexOf(i) % others.length;
  const related = [...others.slice(start), ...others.slice(0, start)].slice(0, 3);
  const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
  const seo = require('./seo');
  return shell({ head: seo.industryHead(i, i.faq.map(([q, a]) => [q, seo.plain(fill(a))])),
    body: `
    <section class="h-hero"><div class="h-wrap">
      <div>
        <nav class="i-crumbs" aria-label="Breadcrumb"><a href="/industries">Industries</a><span aria-hidden="true">/</span><span aria-current="page">${esc(i.name)}</span></nav>
        <span class="h-eyebrow">${product()} for ${esc(lower(i.name))}</span>
        <h1>${esc(i.title)}</h1>
        <p class="lead">${fill(i.lead)}</p>
        <div class="h-ctas"><a class="btn" href="/pricing?industry=${i.slug}" data-trial>Start your free 30-day trial</a><a class="btn alt" href="#how">See how it helps</a></div>
        <ul class="h-ticks"><li>Free for 30 days</li><li>No credit card needed</li><li>Works on any phone</li></ul>
      </div>
      <div class="h-art">${picture(i, 'i-photo', i.alt)}</div>
    </div></section>

    <section class="h-sec"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">Sound familiar?</span><h2>What slows ${esc(lower(i.name))} businesses down</h2></div>
      <div class="i-pains">${i.pains.map(([t, d]) => `<div class="i-pain"><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
    </div></section>

    <section class="h-sec" id="how" style="padding-top:0"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">How it helps</span><h2>Everything your ${esc(lower(i.name))} business needs, in one place</h2><p>Quotes, scheduling, your team in the field, invoices and payments, all connected to the client they belong to.</p></div>
      <div class="i-helps">${i.helps.map(([k, t, d], n) => `<div class="h-feat"><div class="ic c${(n % 5) + 1}">${icon(k)}</div><h3>${esc(t)}</h3><p>${fill(d)}</p></div>`).join('')}</div>
    </div></section>

${NEW_TOOLS[i.slug] ? `
    <section class="h-sec" style="padding-top:0"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">New in ${product()}</span><h2>Grow your ${esc(lower(i.name))} business without growing the paperwork</h2><p>${esc(newIntro)} <a href="/pricing#compare">Compare plans</a></p></div>
      <div class="i-new">${NEW_TOOLS[i.slug].map(([k, t, d], n) => `<div class="h-feat"><div class="ic c${((n + 2) % 5) + 1}">${icon(k)}</div><h3>${esc(t)}</h3><p>${fill(esc(d))}</p></div>`).join('')}</div>
    </div></section>` : ''}

    <section class="h-sec h-steps-bg"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">A job, start to finish</span><h2>How a ${esc(lower(i.name))} job runs in ${product()}</h2></div>
      <div class="h-steps">${['Quote', 'Schedule', 'Do the work', 'Get paid'].map((h, n) => `<div class="h-step"><h3>${h}</h3><p>${esc(i.steps[n])}</p></div>`).join('')}</div>
    </div></section>

    <section class="h-sec"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">Questions</span><h2>${esc(i.name)} FAQ</h2></div>
      <div class="h-faq">${i.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${fill(a)}</p></details>`).join('')}</div>
    </div></section>

    ${require('./guides').industrySection(i)}

    ${require('./tool-card').card({ tag: 'free, no sign-up', title: `Free tools for ${esc(lower(i.name))}`, more: '<a href="/tools">See all free tools →</a>',
      tiles: [[`/tools/pricing-calculator/${i.slug}`, 'calc', 'Pricing calculator', 'Know what to charge before you quote.'],
        [`/tools/invoice-generator/${i.slug}`, 'invoice', 'Invoice template', 'Starts with example lines for this kind of work.'],
        [`/tools/estimate-template/${i.slug}`, 'estimate', 'Estimate template', 'Line items, a deposit and a signature line.'],
        ['/tools/google-review-qr-code', 'qr', 'Review QR code', 'A counter sign that gets you Google reviews.']] })}
    <div style="height:64px"></div>

    <section class="h-sec" style="padding-top:0"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">More industries</span><h2>Also built for</h2></div>
      <div class="i-cards">${related.map(card).join('')}</div>
      <p class="i-more"><a href="/industries">See all industries →</a></p>
    </div></section>` });
}

module.exports = { INDUSTRIES, CHOICES, choose, label, menu, strip, shell, indexPage, page };
