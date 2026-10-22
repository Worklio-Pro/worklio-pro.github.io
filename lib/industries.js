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
};

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
      ['card', 'Paid at the end of the visit', 'Turn the finished job into an invoice in one tap. Clients pay by card or Zelle from a secure link, and the payment lands in your own Stripe account.']],
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
      ['card', 'Collect payment on the spot', 'Send the invoice by text before you pack up. Clients pay by card or Zelle and the balance updates on its own.']],
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
    steps: ['Walk the property and send the quote before you leave; the client signs and pays a deposit.', 'Put the job on the crew’s calendar and remind the client the day before.', 'The crew has the notes, takes before and after photos and gets a sign-off.', 'Invoice when the job’s done and get paid by card or Zelle.'],
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
      ['card', 'Payments without the awkwardness', 'Clients pay invoices by card or Zelle from a secure link. No cash, no checks, no chasing.']],
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
      ['card', 'Easy payment for every service', 'Invoices with a pay link, so clients pay by card or Zelle without a phone call.']],
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
      ['card', 'Paid before you pack up', 'Send the invoice from your phone and let the client pay by card or Zelle right there.']],
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
    steps: ['Quote inside and out, with screens; the client approves online.', 'Schedule the visit and send the reminder.', 'Your crew has the notes and takes photos of the finished job.', 'Invoice and get paid by card or Zelle.'],
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
    faq: [['Can clients pay the balance online?', 'Yes. The deposit is credited on the invoice, and clients pay the balance by card or Zelle from a link.'],
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
];
const BY_SLUG = Object.fromEntries(INDUSTRIES.map((i) => [i.slug, i]));

// the industry a business picks at sign-up (and in Company Profile): one of the pages above, or Other with their own words.
// Saved in the account's company profile as industry (slug) + industryOther; Alpha counts, filters and targets accounts by it.
const CHOICES = [...INDUSTRIES.map((i) => ({ slug: i.slug, name: i.name })), { slug: 'other', name: 'Other' }];
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

// the "Industries" dropdown in the header (public/menu.js opens it)
const menu = () => `<div class="h-menu"><button type="button" class="h-menu-btn" aria-expanded="false" aria-controls="industries-menu">Industries<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
<div class="h-drop" id="industries-menu" hidden><div class="h-drop-grid">${INDUSTRIES.map((i) => `<a href="/industries/${i.slug}"><span aria-hidden="true">${i.emoji}</span>${esc(i.name)}</a>`).join('')}</div><a class="h-drop-all" href="/industries">See all industries →</a></div></div>`;
// the trades strip on the home page
const strip = () => `<ul>${INDUSTRIES.map((i) => `<li><a href="/industries/${i.slug}"><span aria-hidden="true">${i.emoji}</span>${esc(i.name)}</a></li>`).join('')}</ul>`;

const card = (i) => `<a class="i-card" href="/industries/${i.slug}"><img src="${photo(i)}" alt="" width="1200" height="900" loading="lazy"><span><b>${esc(i.name)}</b><span>${fill(i.blurb)}</span></span></a>`;

function shell({ title, description, body }) {
  const p = product();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} · ${p}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="color-scheme" content="light dark">
  <link rel="stylesheet" href="/styles.css?v=13">
  <link rel="stylesheet" href="/home.css?v=1">
</head>
<body>
  <header class="h-top"><div class="h-wrap">
    <a class="h-brand" href="${homeHref()}"><i aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></i><span class="pname">${p}</span></a>
    <nav class="h-links" aria-label="Site"><a href="${homeHref()}#features">Features</a>${menu()}<a href="${homeHref()}#how">How it works</a><a href="${homeHref()}#faq">FAQ</a><a href="/pricing">Pricing</a></nav>
    <a class="btn" href="/pricing">Get started</a>
  </div></header>
  <main>${body}
    <section class="h-wrap" style="padding:20px 20px"><div class="h-cta">
      <h2>Ready to spend less time on paperwork?</h2>
      <p>Set up your account in minutes and send your first quote today.</p>
      <a class="btn" href="/pricing">See plans &amp; get started</a>
    </div></section>
  </main>
  <footer class="h-foot"><div class="h-wrap">
    <span>© ${new Date().getFullYear()} ${p}</span>
    <nav aria-label="Footer"><a href="/pricing">Pricing</a><a href="${homeHref()}#features">Features</a><a href="/industries">Industries</a><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a></nav>
  </div></footer>
  <script src="/brand.js?v=1"></script>
  <script src="/menu.js?v=1"></script>
  <script>
    // the logo set in the platform console
    fetch('/api/site').then((r) => r.json()).then((s) => {
      if (s && s.brand && s.brand.logo) document.querySelectorAll('.h-brand').forEach((a) => { a.querySelector('i').outerHTML = brandImg(s.brand); a.querySelector('.pname').hidden = s.brand.logoHasName; });
    }).catch(() => {});
  </script>
  <script src="/chat.js?v=6" data-where="site" defer></script>
</body>
</html>`;
}

function indexPage() {
  return shell({ title: 'Software for every field service industry', description: `Quotes, scheduling, invoices and payments for ${INDUSTRIES.length} kinds of field service businesses, from HVAC and plumbing to cleaning and lawn care.`,
    body: `
    <section class="h-hero"><div class="h-wrap i-hero-solo">
      <span class="h-eyebrow">Industries</span>
      <h1>Built for the trades that <em>keep things running</em></h1>
      <p class="lead">Every service business quotes, schedules, does the work and gets paid. ${product()} handles all four, with the details each trade cares about.</p>
    </div></section>
    <section class="h-sec" style="padding-top:24px"><div class="h-wrap"><div class="i-cards">${INDUSTRIES.map(card).join('')}</div>
      <p class="i-more">Don’t see your trade? If you quote, schedule and invoice work at your clients’ homes or businesses, ${product()} works for you. <a href="/pricing">See plans</a></p>
    </div></section>` });
}

function page(slug) {
  const i = BY_SLUG[slug]; if (!i) return null;
  const others = INDUSTRIES.filter((x) => x !== i); const start = INDUSTRIES.indexOf(i) % others.length;
  const related = [...others.slice(start), ...others.slice(0, start)].slice(0, 3);
  const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
  return shell({ title: `${i.name} software`, description: i.lead.replace(/\{p\}/g, productName()),
    body: `
    <section class="h-hero"><div class="h-wrap">
      <div>
        <nav class="i-crumbs" aria-label="Breadcrumb"><a href="/industries">Industries</a><span aria-hidden="true">/</span><span aria-current="page">${esc(i.name)}</span></nav>
        <span class="h-eyebrow">${product()} for ${esc(lower(i.name))}</span>
        <h1>${esc(i.title)}</h1>
        <p class="lead">${fill(i.lead)}</p>
        <div class="h-ctas"><a class="btn" href="/pricing?industry=${i.slug}">See plans &amp; get started</a><a class="btn alt" href="#how">See how it helps</a></div>
        <ul class="h-ticks"><li>Works on any phone</li><li>Set up in minutes</li><li>No app for clients to install</li></ul>
      </div>
      <div class="h-art"><img class="i-photo" src="${photo(i)}" alt="${esc(i.alt)}" width="1200" height="900"></div>
    </div></section>

    <section class="h-sec"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">Sound familiar?</span><h2>What slows ${esc(lower(i.name))} businesses down</h2></div>
      <div class="i-pains">${i.pains.map(([t, d]) => `<div class="i-pain"><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('')}</div>
    </div></section>

    <section class="h-sec" id="how" style="padding-top:0"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">How it helps</span><h2>Everything your ${esc(lower(i.name))} business needs, in one place</h2><p>Quotes, scheduling, your team in the field, invoices and payments, all connected to the client they belong to.</p></div>
      <div class="i-helps">${i.helps.map(([k, t, d], n) => `<div class="h-feat"><div class="ic c${(n % 5) + 1}">${icon(k)}</div><h3>${esc(t)}</h3><p>${fill(d)}</p></div>`).join('')}</div>
    </div></section>

    <section class="h-sec h-steps-bg"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">A job, start to finish</span><h2>How a ${esc(lower(i.name))} job runs in ${product()}</h2></div>
      <div class="h-steps">${['Quote', 'Schedule', 'Do the work', 'Get paid'].map((h, n) => `<div class="h-step"><h3>${h}</h3><p>${esc(i.steps[n])}</p></div>`).join('')}</div>
    </div></section>

    <section class="h-sec"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">Questions</span><h2>${esc(i.name)} FAQ</h2></div>
      <div class="h-faq">${i.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${fill(a)}</p></details>`).join('')}</div>
    </div></section>

    <section class="h-sec" style="padding-top:0"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">More industries</span><h2>Also built for</h2></div>
      <div class="i-cards">${related.map(card).join('')}</div>
      <p class="i-more"><a href="/industries">See all industries →</a></p>
    </div></section>` });
}

module.exports = { INDUSTRIES, CHOICES, choose, label, menu, strip, indexPage, page };
