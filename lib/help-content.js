'use strict';
// The help center's starting content: copied into the platform store (platform.json → help) the first time it's needed;
// after that, edit articles in the platform console → Help Center. {product} becomes the product name.
// Articles are plain HTML: <h2> sections, <ol class="steps"> for steps, <div class="note"> / <div class="tip"> callouts.
exports.topics = [
  { slug: 'get-started', icon: 'rocket', title: 'Get Started', desc: 'Hand-picked guides to get {product} set up and running for your business.' },
  { slug: 'schedule', icon: 'calendar', title: 'Schedule', desc: 'Plan your work on the calendar and the dispatch map, set up repeating jobs and remind clients about visits.' },
  { slug: 'work', icon: 'briefcase', title: 'Work', desc: 'Every step of your workflow: quotes, jobs, checklists, invoices, signatures and photos.' },
  { slug: 'clients', icon: 'users', title: 'Clients', desc: 'Add, import and organize clients and their properties, sell service plans, and see what they see in their client portal.' },
  { slug: 'client-communications', icon: 'mail', title: 'Client Communications', desc: 'Emailing and texting quotes and invoices, email templates and the notifications log.' },
  { slug: 'marketing', icon: 'megaphone', title: 'Marketing', desc: 'Google reviews, online booking, social media posts and the apps you connect.' },
  { slug: 'payments', icon: 'card', title: 'Payments', desc: 'Take card payments with Stripe, accept Zelle and record payments you receive.' },
  { slug: 'business-health', icon: 'chart', title: 'Business Health', desc: 'Track expenses, read your financial reports, send your books to QuickBooks or Xero and pull your sales tax summary.' },
  { slug: 'team', icon: 'team', title: 'Team', desc: 'Add team members, set up roles and permissions, track time with timesheets and handle time off requests.' },
  { slug: 'settings', icon: 'gear', title: 'Settings', desc: 'Company profile, regional settings, tax, numbering, branding and your web address.' },
  { slug: 'account', icon: 'user', title: 'Account', desc: 'Your plan and billing, your personal profile, password and login.' },
  { slug: 'getting-help', icon: 'help', title: 'Getting Help', desc: 'Contact support, suggest features on the Ideas site and give our team temporary access to troubleshoot.' },
];

exports.popular = ['first-steps', 'create-send-quote', 'stripe-card-payments'];
exports.suggested = ['How do I create and send a quote?', 'How do I invite my team?', 'What do my clients see in the client portal?'];

exports.articles = [
  /* ===== Get Started ===== */
  { slug: 'first-steps', topic: 'get-started', title: 'First steps: basic account setup', summary: 'The handful of settings to fill in before you send your first quote.', keywords: 'setup start onboarding begin new account',
    body: `<p>A few minutes of setup makes every quote, invoice and email look right. Work through these in order; you can come back and change any of them later.</p>
<h2>1. Add your business details</h2>
<ol class="steps"><li>Click the <strong>gear icon</strong> in the top bar and choose <strong>Company Profile</strong>.</li><li>Enter your business name, email, phone, website and address. These appear on quotes, invoices and client emails.</li><li>Set your <strong>regional settings</strong>: time zone, date format, 12 or 24-hour time and the first day of the week.</li><li>Click <strong>Save</strong>.</li></ol>
<h2>2. Set your defaults</h2>
<p>In <strong>gear → App Settings</strong>, set your default tax rate, the prefixes for quote, invoice and job numbers, and (if your plan includes it) your logo and brand color. See <a href="/articles/app-settings">App settings</a>.</p>
<h2>3. Add your products and services</h2>
<p>Go to <strong>Products &amp; Services</strong> in the sidebar and add what you sell with its cost and markup. Quotes and invoices then fill in prices for you. See <a href="/articles/products-services">Products &amp; services</a>.</p>
<h2>4. Invite your team</h2>
<p>If others work with you, add them under <strong>gear → Manage Team</strong> and invite them to log in. Choose what each role can see and do in <strong>gear → Roles &amp; Permissions</strong>. See <a href="/articles/invite-team">Add team members</a> and <a href="/articles/access-levels">Roles and permissions</a>.</p>
<h2>5. Set up card payments</h2>
<p>Under <strong>gear → App Settings → Card payments</strong>, connect Stripe so clients can pay by card. Emails to your clients are sent for you in your business name, and texts come from {product} with your business name, so there’s nothing to set up for them. See <a href="/articles/stripe-card-payments">Accept card payments</a>.</p>
<h2>6. Connect your marketing accounts</h2>
<p>Connect your Google Business Profile, Facebook Page and Instagram in <strong>gear → Account Connections</strong> to reply to Google reviews, take online bookings and post photos of your work. See <a href="/articles/account-connections">Connect Google, Facebook and Instagram</a>.</p>
<div class="tip">New here? Click the <strong>?</strong> in the top bar and choose <strong>Take a tour of the app</strong> for a one-minute walk around. Not sure where something is? Press <kbd>/</kbd> anywhere in {product} and type what you’re looking for.</div>` },
  { slug: 'finding-your-way', topic: 'get-started', title: 'Finding your way around {product}', summary: 'The sidebar and its search, Settings, the help menu and your account menu.', keywords: 'navigation menu sidebar top bar search layout where',
    body: `<h2>The sidebar</h2>
<p>The left sidebar holds your day-to-day pages, separated by lines: Home, Calendar, Clients, Quotes, Jobs, Timesheets, Service Plans and Invoices; then Payments, Products &amp; Services, Expenses, Financial Reports and Tax Summary; then Reviews, Marketing, Automations, Project Gallery and the Notifications Log.</p>
<ul><li><strong>Search</strong>, under your logo: type a feature name, like “invoice” or “logo”, and press <kbd>Enter</kbd> to jump to it. Press <kbd>/</kbd> or <kbd>⌘</kbd> <kbd>K</kbd> (<kbd>Ctrl</kbd> <kbd>K</kbd> on Windows) from anywhere to start searching.</li><li><strong>Settings</strong>, at the bottom: opens your settings pages in their own menu, grouped into My Business, Business Services and Other Settings; <strong>Team Requests</strong> (time off) is under My Business. <strong>Go Back</strong> returns to the main menu.</li></ul>
<h2>The top bar</h2>
<ul><li><strong>Ideas site</strong> and <strong>Feedback</strong>: suggest features and send us your thoughts. See <a href="/articles/forum-feedback">Suggest features and report issues</a>.</li><li><strong>Help (?)</strong>: opens a panel with quick guides, <strong>Take a tour of the app</strong>, a link to this help center and <strong>Get Support</strong>.</li><li><strong>Your initials</strong>, at the top right: your name and email (click them to open <a href="/articles/my-profile-password">your profile</a>), your business’s <strong>QR code</strong> and <strong>Log out</strong>.</li></ul>
<h2>Take the tour</h2>
<p>The first time you log in, {product} offers a short tour that points out the menu, search, help and settings. Take it again any time from <strong>? → Take a tour of the app</strong>.</p>
<h2>On a phone</h2>
<p>Your most-used pages sit in a bar along the bottom of the screen; tap <strong>More</strong> for the full menu. See <a href="/articles/using-on-phone">Using {product} on your phone</a>.</p>
<div class="note">You only see the pages your role and plan include. If a page you expect is missing, ask your account owner. See <a href="/articles/access-levels">Roles and permissions</a>.</div>` },
  { slug: 'using-on-phone', topic: 'get-started', title: 'Using {product} on your phone', summary: 'The bottom menu, pull to refresh, PDFs, adding quotes, jobs and invoices, and choosing a client on a small screen.', keywords: 'phone mobile iphone android tablet app bottom bar small screen field pull refresh pdf',
    body: `<p>{product} works in your phone’s web browser, so there’s nothing to install. Open your account’s web address and log in. Add it to your home screen from your browser’s share menu to open it like an app.</p>
<h2>Getting around</h2>
<ul><li>The <strong>bottom bar</strong> holds your most-used pages, such as Home, Calendar, Quotes and Jobs. Tap <strong>More</strong> for every other page.</li><li>The top bar shows your company logo (or name). Tap the <strong>?</strong> for help and the <strong>gear</strong> for settings.</li><li>In the app on your home screen, <strong>pull down</strong> at the top of a page to refresh it.</li><li>PDFs (quotes, invoices, checklists and receipts) open inside the app. Tap <strong>Back</strong> to return to where you were.</li></ul>
<h2>Add a quote, job or invoice</h2>
<ol class="steps"><li>Open Quotes, Jobs or Invoices and start a new one.</li><li>The form starts with a <strong>Service for</strong> card. Tap <strong>Select Existing Client</strong>, or type in a new client’s first and last name and property address, and add their phone and email. If the client has more than one property, tap the address to choose which one the work is for.</li><li>Fill in the title, the line items (each with its quantity, unit cost and markup as a percent or a fixed amount) and the rest of the details.</li><li>Tap <strong>Save</strong>.</li></ol>
<h2>Choosing a client</h2>
<p>The client chooser fills the screen. Search by name, address, phone or email, or pick from your <strong>Recent clients</strong>. Tap <strong>Create New Client</strong> at the top to add someone new without leaving the form.</p>
<div class="tip">Out on a job? Open the job and use <strong>More → Collect Signature</strong> to have your client sign on your phone. See <a href="/articles/job-signatures">Collect a client’s signature</a>.</div>` },
  { slug: 'logging-in', topic: 'get-started', title: 'Logging in and your account’s web address', summary: 'Where to log in, accepting an invite and resetting a forgotten password.', keywords: 'login sign in url address subdomain forgot password reset invite',
    body: `<p>Every business on {product} has its own web address, such as <code>yourbusiness.workliopro.com</code>. You, your team and your clients all use that address.</p>
<h2>Accepting an invite</h2>
<ol class="steps"><li>Open the invite email and click the link. Invite links work for 7 days.</li><li>Choose a password (at least 8 characters).</li><li>You’re logged in. Bookmark the address for next time.</li></ol>
<h2>Forgot your password?</h2>
<ol class="steps"><li>Go to your account’s login page and click <strong>Forgot password?</strong></li><li>Enter your email. If it matches a login, we email you a reset link.</li><li>Open the link and choose a new password.</li></ol>
<div class="note">Didn’t get the email? Check your spam folder. If you’re a team member, your account owner can send you a new invite from <strong>Manage Team</strong>.</div>` },

  /* ===== Schedule ===== */
  { slug: 'job-calendar', topic: 'schedule', title: 'Using the calendar', summary: 'See everyone’s jobs, tasks and events by week, day or on a map, add new ones and drag them to reschedule.', keywords: 'calendar schedule schedules week day map view appointments visits tasks events drag reschedule',
    body: `<p><strong>Calendar</strong> in the sidebar shows every job, task and event on a time grid, with the client and the team members assigned.</p>
<h2>Change the view</h2>
<ul><li>Switch between <strong>Day</strong>, <strong>Week</strong> and <strong>Map</strong> at the top right. Map shows one day’s visits on a map, with each person’s route. See <a href="/articles/dispatch-map">Plan the day on the dispatch map</a>.</li><li>Use the arrows to move back and forward, <strong>Today</strong> to jump back to now, or pick a date on the small month calendar.</li><li>Untick a team member under <strong>Team calendars</strong> to hide their work.</li></ul>
<h2>Add a job, task or event</h2>
<ol class="steps"><li>Click a time on the calendar. A small form opens with that date and time filled in. (Drag it by its top bar to move it out of the way.)</li><li>Choose <strong>Job</strong>, <strong>Task</strong> or <strong>Event</strong>, then add a title and, for a job, the client.</li><li>Click <strong>Save</strong>, or <strong>More Options</strong> to finish a job on the full job form.</li></ol>
<h2>Reschedule</h2>
<p>Drag anything on the calendar to another day or time. It keeps its length and saves straight away. Drop it on the <strong>Anytime</strong> row to make it an all-day item.</p>
<h2>Repeating jobs</h2>
<p>A job that repeats (weekly mowing, monthly pool service) puts each visit on the calendar ahead of time. Set it up with <strong>Repeats</strong> on the job. See <a href="/articles/recurring-jobs">Set up a repeating job</a>.</p>
<div class="tip">The week starts on the day set in <strong>App Settings → Regional settings</strong>. See <a href="/articles/company-profile">Company profile</a>.</div>` },
  { slug: 'appointment-reminders', topic: 'schedule', title: 'Send appointment reminders', summary: 'Remind a client about an upcoming visit by email or text.', keywords: 'reminder remind appointment notify client visit',
    body: `<ol class="steps"><li>Open the job from <strong>Jobs</strong> or the <strong>Calendar</strong>.</li><li>Click <strong>More</strong>, then under <strong>Send as…</strong> choose <strong>Email Reminder</strong> (or <strong>Text Reminder</strong> on plans with texting). {product} sends the client a reminder with the job title, date, time and address.</li></ol>
<p>Reminders go by text message if your plan includes texting and the client has <a href="/articles/text-messages">agreed to receive texts</a>, otherwise by email. The wording comes from the <strong>Appointment reminder</strong> template. See <a href="/articles/email-templates">Customize email templates</a>.</p>
<div class="note">If no email or text provider is connected yet, the reminder is recorded in the <a href="/articles/notifications-log">Notifications Log</a> but not delivered.</div>` },

  { slug: 'recurring-jobs', topic: 'schedule', title: 'Set up a repeating job', summary: 'Repeat a job every few days, weeks or months, with each visit scheduled ahead on the calendar.', keywords: 'recurring repeat repeating weekly monthly daily series maintenance lawn pool cleaning visits schedule every',
    body: `<p>For work you do on a schedule, like weekly mowing or a monthly pool service, set the job to repeat. Each visit is an ordinary job with its own number, team, time, invoice and timesheet hours, so you can change one visit without touching the rest.</p>
<div class="note"><strong>Beta.</strong> Recurring jobs is new. Tell us how it works for you with <strong>Feedback</strong> in the top bar.</div>
<h2>How to make a job repeat</h2>
<ol class="steps"><li>Create a job (<strong>Jobs → New Job</strong>), or open one and click the <strong>pencil</strong> on its <strong>Scheduled visit</strong> card.</li><li>Under <strong>Repeats</strong>, choose <strong>Daily</strong>, <strong>Weekly</strong> or <strong>Monthly</strong>.</li><li>Set <strong>Every</strong>: 1 for every week, 2 for every other week, and so on.</li><li>For weekly, tick the days of the week. For monthly, choose the same date each month (the 15th) or the same weekday (the 2nd Tuesday, or the last Friday).</li><li>Choose when it <strong>Ends</strong>: <strong>Never</strong>, <strong>After</strong> a number of visits, or <strong>On</strong> a date. The line under the settings reads the schedule back to you.</li><li>Click <strong>Save</strong>.</li></ol>
<p>On a phone, <strong>Repeats</strong> is on the New job screen and in the job’s Scheduled visit sheet, with the same settings.</p>
<h2>How far ahead visits are made</h2>
<p>Visits are put on the calendar ahead of time: 2 months ahead for daily jobs, 6 months for weekly and 12 months for monthly. More are added on their own as time goes by, so the calendar always looks that far ahead.</p>
<h2>Change one visit or the rest</h2>
<p>When you change a repeating visit’s details, team, instructions or time, {product} asks:</p>
<ul><li><strong>This visit only</strong>: just this visit changes.</li><li><strong>This and following visits</strong>: the fields you changed are copied to every later visit. Anything else on those visits stays as it was.</li></ul>
<p>Changing the repeat settings themselves, or moving the visit to another date, remakes the later visits on the new schedule.</p>
<h2>Stop repeating</h2>
<p>Open the last visit you want and choose <strong>More → Stop Repeating After This Visit</strong>. Later visits are removed.</p>
<div class="tip">Later visits that already have an invoice, timesheet hours, photos, notes or a signature are never removed, whatever you change.</div>
<h2>Finding repeating jobs</h2>
<ul><li>The job page shows the schedule (for example “Every 2 weeks on Mon”), which visit this is (“Visit 3 of 12”) and a link to the next visit.</li><li>The <strong>Jobs</strong> list marks repeating jobs with <strong>↻</strong>.</li></ul>
<p>Recurring jobs is included on every plan. Visits for <a href="/articles/service-plans">service plans</a> are repeating jobs too.</p>` },
  { slug: 'dispatch-map', topic: 'schedule', title: 'Plan the day on the dispatch map', summary: 'See a day’s visits on a map in each person’s color, assign them by dragging and put each route in the best driving order.', keywords: 'dispatch map route routing optimize optimization best order drive driving directions assign technician gps where',
    body: `<p>The <strong>Map</strong> view of the Calendar shows one day’s visits on a map. Each team member’s visits are numbered pins in their color, joined by a line for their route from your business address. The list beside the map groups the visits by person.</p>
<div class="note"><strong>Beta.</strong> The dispatch map is new. Tell us how it works for you with <strong>Feedback</strong> in the top bar.</div>
<h2>How to open the map</h2>
<ol class="steps"><li>Go to <strong>Calendar</strong> in the sidebar.</li><li>Click <strong>Map</strong> next to Day and Week at the top right.</li><li>Use the arrows or <strong>Today</strong> to pick the day.</li></ol>
<p>Click a visit in the list to jump to its pin. Click a pin to see the visit and open the job.</p>
<h2>How to assign a visit</h2>
<ul><li>On a computer, drag a visit in the list onto a team member’s name. Drop it on <strong>Unassigned</strong> to take it off them.</li><li>On a phone (or a computer), click the visit’s pin and choose a person under <strong>Assign to</strong>.</li></ul>
<h2>How to put a route in the best order</h2>
<ol class="steps"><li>Click <strong>Best order</strong> next to a team member’s name.</li><li>{product} shows their visits in the shortest driving order, starting from your business address, with new times, the miles and the drive time saved.</li><li>Change <strong>First visit starts at</strong> if you like. Each visit keeps its length, and the drive between stops is added.</li><li>Click <strong>Save these times</strong> to reschedule them, or <strong>Cancel</strong> to leave things as they are.</li></ol>
<div class="tip">Completed visits aren’t moved. A visit shared with someone else is called out, because its time changes for them too.</div>
<h2>Driving directions</h2>
<p>Click <strong>Directions</strong> next to a person’s name to open Google Maps with a route through their stops in order.</p>
<h2>Good to know</h2>
<ul><li>Add your business address in <strong>Settings → Company Profile</strong> so routes start there.</li><li>Addresses are found on the map the first time they’re shown, which can take a few seconds. A visit whose address can’t be found says so in the list.</li><li>Drive times are estimates from the distance between stops, not live traffic.</li></ul>
<p>The dispatch map is on the Advanced and Unlimited plans. Anyone who can see the Calendar can see the map; assigning and Best order need permission to edit jobs.</p>` },
  { slug: 'calendar-feed', topic: 'schedule', title: 'See your work in Google Calendar, Outlook or Apple Calendar', summary: 'Get your own calendar link so your jobs, tasks and events show up in the calendar app on your phone or computer.', keywords: 'google calendar gcal outlook apple calendar ical ics icalendar webcal feed subscribe sync link phone calendar app',
    body: `<p>Each person on your team can get their own <strong>calendar link</strong>. Add it to Google Calendar, Outlook or Apple Calendar and your work shows up there next to your personal appointments, and keeps itself up to date.</p>
<h2>Get your link</h2>
<ol class="steps"><li>Click the <strong>gear icon</strong> and choose <strong>Preferences</strong>.</li><li>Under <strong>Calendar link</strong>, click <strong>Get my calendar link</strong>.</li><li>Click <strong>Add to Google Calendar</strong>, or <strong>Add to Apple Calendar or Outlook</strong>, and confirm in the app that opens.</li></ol>
<p>You can also click <strong>Copy</strong> and paste the link in yourself:</p>
<ul><li><strong>Google Calendar</strong> (on a computer): next to <strong>Other calendars</strong>, click <strong>+</strong>, then <strong>From URL</strong>. It then shows on your phone too.</li><li><strong>Outlook on the web</strong>: <strong>Add calendar → Subscribe from web</strong>.</li><li><strong>iPhone or iPad</strong>: <strong>Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar</strong>.</li><li><strong>Mac</strong>: in Calendar, <strong>File → New Calendar Subscription</strong>.</li></ul>
<h2>What it shows</h2>
<p>Jobs, tasks and events you’re assigned to, from two months back to a year ahead, and your approved time off. Each job has the client, the address (tap it for directions) and a link back to the job. Prices are never included. Cancelled jobs and finished tasks are left out.</p>
<p>If your access level includes the Calendar, you can choose <strong>Everyone’s schedule</strong> instead, which shows every team member’s work with who’s on each job.</p>
<h2>How quickly changes show</h2>
<p>Your calendar app checks the link for changes on its own. Google Calendar checks every few hours, so a change can take up to a day to show there. Apple Calendar and Outlook usually check more often. The link only goes one way: make changes to jobs here, not in your calendar app.</p>
<h2>Keep it private</h2>
<p>Anyone who has your link can see your schedule, so don’t share it. If it gets out, click <strong>Get a new link</strong>: the old link stops working and you add the new one to your calendar app (and remove the old calendar there). <strong>Turn off</strong> stops it completely. If your login is removed or deactivated, the link stops working.</p>
<div class="note">Your login has to be linked to a team member for work to be assigned to you. If your calendar is empty, ask your account owner to check <strong>Manage Team</strong>.</div>` },
  /* ===== Work ===== */
  { slug: 'create-send-quote', topic: 'work', title: 'Create and send a quote', summary: 'Build a quote with line items, tax and discounts, then send it for your client to approve online.', keywords: 'quote estimate proposal create send approve price',
    body: `<h2>Create the quote</h2>
<ol class="steps"><li>Go to <strong>Quotes</strong> and click <strong>New Quote</strong> (or open a client’s profile and choose <strong>+ Create → Quote</strong>).</li><li>Choose the client: start typing to search by name, address, phone or email, or click <strong>Create new client</strong> at the bottom of the list. If the client has more than one property, pick the one the work is for. See <a href="/articles/client-properties">Clients with several properties</a>.</li><li>Give the quote a title.</li><li>Add line items. Start typing a product or service name to fill it in from your catalog, or type a new one. Each line has a quantity, a cost and a markup (a percentage or a flat amount); {product} works out the price.</li><li>Check the tax rate and, if you like, add a discount (percentage or amount, taken off before tax). The trash can on the tax row removes tax; <strong>Add Tax</strong> brings it back at your default rate.</li><li>Add a message for your client, your contract or disclaimer text, and any internal notes. In the <strong>Client payments</strong> box on the right, choose whether the client can pay a deposit by card or Zelle.</li><li>Click <strong>Save</strong> in the bar at the bottom of the screen.</li></ol>
<h2>Send it</h2>
<ul><li><strong>By text</strong>: click <strong>Send Text</strong> beside <strong>More</strong> (on plans with texting, for clients who have <a href="/articles/text-messages">agreed to receive texts</a>).</li><li><strong>By email</strong>: click <strong>More</strong>, then <strong>Send as… → Email</strong>.</li></ul>
<p>Both let you check and edit the message first. See <a href="/articles/send-email-text">Email or text a quote or invoice</a>.</p>
<h2>What your client does</h2>
<p>Your client gets a link to view the quote online, where they can <strong>Approve</strong> or <strong>Decline</strong> it. When they approve, they sign it, either drawing their signature with a finger or mouse or typing their name, and pay any deposit you asked for.</p>
<p>{product} emails you when a client approves, declines or signs a quote, and the new status shows on the Quotes page.</p>
<h2>Change it later</h2>
<p>Open the quote and click the <strong>pencil</strong> on any section to edit just that part, then <strong>Save</strong>. To start a new quote with the same line items, use <strong>More → Create Similar Quote</strong>. See <a href="/articles/quote-invoice-page">The quote, job and invoice pages</a>.</p>
<div class="tip">Want money up front? <a href="/articles/quote-deposits">Request a deposit</a> before you send. Once it’s approved, <a href="/articles/quote-to-job">turn the quote into a job</a>.</div>` },
  { slug: 'quote-deposits', topic: 'work', title: 'Request a deposit on a quote', summary: 'Ask for a percentage or fixed deposit that the client pays when they approve.', keywords: 'deposit upfront down payment quote advance',
    body: `<ol class="steps"><li>Open the quote and click the <strong>pencil</strong> on its line items (or set it while you create the quote).</li><li>Under the totals, set the <strong>Deposit</strong> as a percentage of the total or a fixed amount. The balance after the deposit is shown below.</li><li>In the <strong>Client payments</strong> box, switch card payments and Zelle on or off for this quote.</li><li>Save and send the quote.</li></ol>
<p>When your client approves the quote, they’re asked to sign it and pay the deposit. With <a href="/articles/stripe-card-payments">Stripe connected</a> they can pay by card or bank; with <a href="/articles/zelle">Zelle</a> turned on they can pay that way.</p>
<h2>Deposit paid another way?</h2>
<p>If the client paid by cash, check or another method, open the quote and choose <strong>More → Mark as… → Deposit Paid</strong>. The deposit is credited when you invoice the job.</p>
<div class="note">A quote with a deposit can be turned into a job once the deposit is paid.</div>` },
  { slug: 'quote-to-job', topic: 'work', title: 'Turn an approved quote into a job', summary: 'Schedule the work from an approved quote without retyping anything.', keywords: 'convert quote job schedule approved',
    body: `<ol class="steps"><li>Open the approved quote and click <strong>More → Convert to Job</strong>.</li><li>Pick the date and start and end times, and tick the team members to assign.</li><li>Click <strong>Create job</strong>. The new job copies the client, title and line items from the quote and appears on the calendar.</li></ol>
<p>The quote is marked as converted, and its More menu then shows <strong>Go to Job</strong> so you can jump straight to it.</p>
<div class="note">Don’t see Convert to Job? The quote needs to be approved first, and if it asks for a deposit, the deposit needs to be paid (or <a href="/articles/quote-deposits">marked as paid</a>).</div>` },
  { slug: 'create-job', topic: 'work', title: 'Create and schedule a job', summary: 'Add a job, assign your team and track it from upcoming to invoiced.', keywords: 'job work order create schedule assign complete status',
    body: `<h2>Create a job</h2>
<ol class="steps"><li>Go to <strong>Jobs</strong> and click <strong>New Job</strong>, or click a time on the <a href="/articles/job-calendar">Calendar</a>.</li><li>Choose the client (and, if they have several, the property). The property address fills in from the client; change it if the work is somewhere else.</li><li>Enter a title and description, the date, and start and end times.</li><li>Tick the team members doing the work.</li><li>If the work repeats, choose how often under <strong>Repeats</strong>. See <a href="/articles/recurring-jobs">Set up a repeating job</a>.</li><li>Add line items if you want them carried onto the invoice.</li><li>Click <strong>Save</strong>.</li></ol>
<h2>The job page</h2>
<p>Open a job to see it laid out in cards: details, line items, the scheduled visit and notes. Click the <strong>pencil</strong> on a card to change just that part. The <strong>More</strong> menu holds <strong>Create Invoice</strong>, <strong>Collect Signature</strong>, the email or text <a href="/articles/appointment-reminders">reminder</a>, <strong>Request Off for This Job</strong>, <strong>Open Calendar</strong> and <strong>Delete</strong>.</p>
<h2>On the day</h2>
<ul><li><strong>On My Way</strong> texts or emails the client your arrival time. See <a href="/articles/on-my-way">Let a client know you’re on the way</a>.</li><li><strong>Clock In</strong> and <strong>Clock Out</strong> record the time spent on the job for timesheets. See <a href="/articles/time-tracking">Clock in and out, and timesheets</a>.</li></ul>
<h2>Job statuses</h2>
<ul><li><strong>Upcoming</strong> / <strong>Today</strong>: scheduled work.</li><li><strong>Late</strong>: the date has passed and the job isn’t completed.</li><li><strong>Requires invoicing</strong>: completed, with no invoice yet.</li><li><strong>Archived</strong> and <strong>Cancelled</strong>: finished or called off.</li></ul>
<h2>Finish the job</h2>
<p>Click <strong>Mark Complete</strong> when the work is done, then <strong>More → Create Invoice</strong> to bill it. Changed your mind? <strong>Reopen</strong> puts it back on the schedule. See <a href="/articles/create-send-invoice">Create and send an invoice</a>.</p>` },
  { slug: 'job-signatures', topic: 'work', title: 'Collect a client’s signature on a job', summary: 'Have your client sign on your phone or tablet when the work is done.', keywords: 'signature sign on-site approval completion',
    body: `<ol class="steps"><li>Open the job on your phone, tablet or computer.</li><li>Click <strong>More → Collect Signature</strong>.</li><li>Check the statement the client is agreeing to (you can edit it), then hand over the device.</li><li>The client signs with a finger or mouse and you click <strong>Save</strong>.</li></ol>
<p>The signature is saved on the job with the date. Technicians can collect signatures; only managers and admins can remove one.</p>
<div class="note">On-site signatures are included on most plans. If you don’t see the button, check your plan.</div>` },
  { slug: 'snap-to-quote', topic: 'work', title: 'Draft a quote from photos with Snap to quote', summary: 'Take photos of the job and say what the client needs. AI drafts the quote from your price list, with options when the job has choices, for you to check and send.', keywords: 'snap to quote photos ai draft quote estimate voice talk dictate mic price list catalog good better best options set a price unlimited',
    body: `<p><strong>Snap to quote</strong> turns a few photos and a quick note into a draft quote. It uses the products and services in your <a href="/articles/products-services">price list</a> for the line items and prices, and offers Good / Better / Best options when the job has real choices. Nothing is sent to the client until you check it and send it.</p>
<div class="note"><strong>Beta.</strong> Snap to quote is new. Tell us how it works for you with <strong>Feedback</strong> in the top bar. It’s on the Unlimited plan, with a monthly allowance of drafts that renews on the 1st.</div>
<h2>Draft a quote</h2>
<ol class="steps"><li>On a phone, go to <strong>Quotes</strong>, tap <strong>+ New Quote</strong>, choose the client and tap <strong>Snap to quote: draft from photos</strong>. On a computer, start a new quote, choose the client and click <strong>Draft from photos</strong>. On a draft quote with no line items yet, the same button is at the top.</li><li>Tap <strong>Take a photo</strong> or <strong>Choose photos</strong> (up to 6).</li><li>Say what the client needs: tap <strong>Talk</strong> and speak, then tap again to stop, or type it. Where the Talk button isn’t shown, use the microphone on your keyboard.</li><li>Tap <strong>Draft quote</strong>. In about 30 seconds the quote opens with its line items, options and a message to the client.</li></ol>
<h2>Check it before you send</h2>
<p>A yellow box at the top says the quote was drafted by AI and lists anything worth checking, for example a detail the photos don’t show. Read every line, and change anything you like.</p>
<ul><li><strong>Prices</strong> come from your price list, never from the AI.</li><li>Work that isn’t on your list is added at <strong>$0</strong> and highlighted. The quote can’t be sent or marked as sent until each of those has a price.</li><li>The photos and your notes are saved on the quote as an internal note, so your team has them on the job. Clients never see internal notes.</li></ul>
<div class="tip">The more of your services are in your price list, the better the drafts. <a href="/articles/products-services">Import your list</a> from a spreadsheet to get started.</div>` },
  { slug: 'quote-options', topic: 'work', title: 'Offer Good / Better / Best options on a quote', summary: 'Give the client two or three options on one quote, each with its own price, and let them pick one when they approve.', keywords: 'good better best options tiers packages choices upsell quote options recommended pick choose',
    body: `<p>Instead of one price, give the client a choice: repair it, replace it, or replace it with the premium model. Each option has its own line items and total, and the client picks one when they approve. Offering options tends to raise what clients spend, and it saves sending three quotes.</p>
<div class="note"><strong>Beta.</strong> Quote options are new. Tell us how they work for you with <strong>Feedback</strong> in the top bar.</div>
<h2>How to add options to a quote</h2>
<ol class="steps"><li>Create or edit a quote. In <strong>Product / Service</strong>, click <strong>Offer options (Good / Better / Best)</strong>. On a phone, tap <strong>Options</strong> on the quote.</li><li>Name each option, for example Repair, Replace and Replace (high efficiency), and add what’s included if you like. Use <strong>+ Add option</strong> for a third.</li><li>Mark one <strong>Recommended</strong> if you want to steer the client. It’s highlighted on their quote.</li><li>Add your line items and set each one’s <strong>Option</strong>. Choose <strong>All options</strong> for items that come with every option, like a service call fee. On a phone, use <strong>+ Add to</strong> under an option.</li><li>Save and send the quote as usual. Each option needs at least one line item of its own before you can send it.</li></ol>
<div class="tip">Discount, tax and the required deposit apply to whichever option the client picks. A deposit set as a percentage is a percentage of that option’s total.</div>
<h2>What your client sees</h2>
<p>Their quote shows every option side by side with its items and total, and an <strong>Approve</strong> button for each. Once they approve one, they sign and pay any deposit as usual, and their quote shows only the option they chose. You’re told which option they picked.</p>
<h2>When the client tells you their choice</h2>
<p>If they pick an option over the phone or in person, open the quote and use <strong>More → Mark as… → Approved</strong> (on a phone, <strong>⋯ → Mark approved</strong>) and choose the option. Collecting their signature on your phone asks for the option too. You can also set <strong>Client chose</strong> next to the status in the quote editor.</p>
<h2>Jobs, invoices and PDFs</h2>
<ul><li>Converting the quote to a job takes only the chosen option’s line items, and so does the invoice made from that job.</li><li>The quote PDF lists every option with its own totals, or only the chosen option once there is one.</li><li>The quotes list shows a quote still waiting on the client as “3 options from” its lowest total.</li></ul>
<p>If you send a quote back to the client (set it to Awaiting response or Draft), their choice is cleared so they can choose again. To go back to a single price, click <strong>Turn off options</strong>: every line item stays on the quote.</p>
<p>Quote options are on the Advanced and Unlimited plans. See <a href="/articles/create-send-quote">Create and send a quote</a>.</p>` },
  { slug: 'job-checklists', topic: 'work', title: 'Use checklists and forms on jobs', summary: 'Make checklists your team fills in on site: inspections, safety checks and required photos.', keywords: 'checklist checklists form forms inspection safety check pass fail photos required template job completion custom forms pdf print service product',
    body: `<p>Checklists and forms are lists your team fills in on a job: an inspection, a safety check, the photos you always need. You make them once, add them to jobs, and the team fills them in on the job page, on a computer or a phone.</p>
<div class="note"><strong>Beta.</strong> Checklists and forms are new. Tell us how they work for you with <strong>Feedback</strong> in the top bar.</div>
<h2>How to make a checklist</h2>
<ol class="steps"><li>Open <strong>gear → Checklists &amp; Forms</strong>.</li><li>Click <strong>New checklist</strong>, or start from one of the samples (job completion, site safety check, equipment inspection) and change it to suit you.</li><li>Give it a name, then add its items. Each item has a type:<ul><li><strong>Checkbox</strong>: tick it off</li><li><strong>Pass / Fail / N/A</strong>: for inspections</li><li><strong>Short answer</strong> or <strong>Long answer</strong>: typed notes</li><li><strong>Number</strong> and <strong>Date</strong></li><li><strong>Choose one</strong>: pick from choices you list, one per line</li><li><strong>Photos</strong>: up to 10, taken with the phone’s camera</li><li><strong>Section heading</strong>: splits a long checklist into parts</li></ul></li><li>Tick <strong>Required</strong> on items that must be filled in. Use the arrows to change the order.</li><li>Choose how it’s used, then click <strong>Save checklist</strong>.</li></ol>
<h2>Choose how a checklist is used</h2>
<p>Under <strong>When it goes on a job</strong>, pick one:</p>
<ul><li><strong>Only when someone adds it from the job page</strong>.</li><li><strong>On every new job automatically</strong>: it goes on every job made from then on, including jobs from quotes, repeating visits and service plan visits.</li><li><strong>On jobs with these products or services</strong>: tick the ones from your <a href="/articles/products-services">Products &amp; Services</a>. It goes on a new job (from a quote too) with one of them as a line item, or on a job that’s still to do when one is added to it. For example, an AC tune-up checklist for jobs with “AC tune-up”.</li></ul>
<p>Then choose the rest:</p>
<ul><li><strong>It has to be finished before the job can be marked complete</strong>: Mark Complete opens the checklist instead until it’s finished.</li><li><strong>Show it in the client’s portal once finished</strong>: your client sees the answers and photos on the visit in their <a href="/articles/client-portal">client portal</a>. You can also turn this on or off on each job.</li></ul>
<div class="tip">Changing a checklist only affects jobs it’s added to afterwards. Checklists already on jobs keep the items they had, so finished ones never change.</div>
<h2>How to add a checklist to a job</h2>
<p>Open the job. In <strong>Checklists &amp; Forms</strong>, click <strong>+ Add</strong> (on a phone, tap <strong>+</strong> next to Checklists &amp; forms) and pick one. A job can have several.</p>
<h2>How to fill one in</h2>
<ol class="steps"><li>Open the job and tap the checklist. It opens full screen on a phone.</li><li>Tick, choose and type your answers. Everything saves as you go, so you can close it and come back later.</li><li>For a photo item, tap <strong>Add photo</strong> to take a picture or choose one.</li><li>Tap <strong>Finish</strong>. If a required item is empty, it’s highlighted in red so you can fill it in.</li></ol>
<p>The job shows each checklist with how far along it is, and <strong>Finished</strong> with who finished it and when. To change a finished one, open it and tap <strong>Edit</strong>.</p>
<h2>Print or send a checklist as a PDF</h2>
<p>Open the checklist and click <strong>PDF</strong>. It opens with your business details, the job, every answer and the photos, ready to print, save or attach to an email. When a finished checklist is shown in the client portal, your client can download their own copy there too (without the names of who filled it in).</p>
<h2>Who can do what</h2>
<p>Everyone who can see a job can fill in its checklists. Adding or removing them, sharing them with the client and making checklists in Settings need the <strong>Create, edit and delete jobs</strong> permission. See <a href="/articles/access-levels">Roles and permissions</a>.</p>
<p>Checklists and forms are on the Advanced and Unlimited plans.</p>` },
  { slug: 'job-photos', topic: 'work', title: 'Add photos to jobs and the project gallery', summary: 'Keep before, progress and after photos for every job in one place.', keywords: 'photos pictures images gallery before after',
    body: `<ol class="steps"><li>Go to <strong>Project Gallery</strong> in the sidebar.</li><li>Click <strong>+ Upload photos</strong>, choose the job they belong to, and pick the type: before, progress or after. Add a caption if you like.</li><li>Open any photo to see it full size, or delete it.</li></ol>
<p>Photos are a great record for warranty questions and for showing off your work.</p>` },
  { slug: 'create-send-invoice', topic: 'work', title: 'Create and send an invoice', summary: 'Bill a finished job or start from scratch, set payment terms and send a pay link.', keywords: 'invoice bill create send due date terms',
    body: `<h2>From a job</h2>
<ol class="steps"><li>Open the completed job and click <strong>More → Create Invoice</strong>. A draft invoice opens with the job’s client and line items, and any deposit already paid is credited.</li><li>Check the details and click <strong>Save</strong>.</li></ol>
<h2>From scratch</h2>
<ol class="steps"><li>Go to <strong>Invoices</strong> and click <strong>New Invoice</strong>.</li><li>Choose the client (and the property, if they have several) and add line items, tax and any discount.</li><li>Choose the <strong>payment terms</strong> (Due upon receipt, Net 7, 14, 15, 30, 45 or 60, or a custom date). The due date fills in for you.</li><li>In the right column, choose how the client can pay (<strong>Client payments</strong>) and what they see on the invoice (<strong>Client view</strong>), such as quantities, unit prices and line totals.</li><li>Click <strong>Save</strong>.</li></ol>
<h2>Send it</h2>
<p>Click <strong>Send Text</strong> to text the invoice, or <strong>More → Send as… → Email</strong> to email it. Your client gets a link to view it and, if you’ve <a href="/articles/stripe-card-payments">connected Stripe</a>, pay online. See <a href="/articles/send-email-text">Email or text a quote or invoice</a>.</p>
<p>Sent it some other way? Use <strong>More → Mark as… → Awaiting Payment</strong> on a draft.</p>
<h2>More options</h2>
<ul><li><strong>Collect Payment</strong>: record cash, check and other payments. See <a href="/articles/record-payment">Record a payment</a>.</li><li><strong>Create Similar Invoice</strong>: a new draft for the same client with the same line items and terms.</li><li><strong>Preview as Client</strong>: see exactly what your client sees.</li><li><strong>Print or Save PDF</strong>: download the invoice as a PDF.</li></ul>` },
  { slug: 'record-payment', topic: 'work', title: 'Record a payment on an invoice', summary: 'Log cash, check, Zelle and other payments, including part payments.', keywords: 'payment record mark paid partial cash check collect',
    body: `<p>Card payments made online through Stripe are recorded automatically. For anything else:</p>
<ol class="steps"><li>Open the invoice and click <strong>More → Collect Payment</strong>.</li><li>Enter the amount (it starts at the balance owed), the date and the method: cash, check, card, bank payment, Zelle, Cash App, PayPal, Venmo or other.</li><li>Click <strong>Save</strong>.</li></ol>
<p>If the amount is less than the balance, the invoice stays open and shows what’s still owed. When the balance reaches zero the invoice is marked <strong>paid</strong>.</p>
<div class="tip">Check the amount before you save: a recorded payment can’t be deleted.</div>` },
  { slug: 'products-services', topic: 'work', title: 'Products & services catalog', summary: 'Save what you sell with costs and markups so quotes and invoices fill in for you.', keywords: 'products services catalog price list items markup ai description home depot materials',
    body: `<ol class="steps"><li>Go to <strong>Products &amp; Services</strong> in the sidebar and click <strong>+ Add Item</strong>.</li><li>Choose whether it’s a <strong>service</strong> or a <strong>product</strong>, then enter the name, a description, the cost and your markup (percentage or flat amount).</li><li>Save. Next time you type its name on a quote or invoice, the details fill in.</li></ol>
<h2>Write with AI</h2>
<p>On plans with AI descriptions, click <strong>Write with AI</strong> on a product or service to draft a description from its name. Edit it as you like before saving.</p>
<p>On quotes and invoices, <strong>Rewrite</strong> in the corner of a line’s description, the Client message or the Contract / Disclaimer box polishes what you typed in the tone you pick. The arrow beside it puts your original text back. Read a rewritten contract before sending it: you’re responsible for its terms.</p>
<h2>Import your price list</h2>
<ol class="steps"><li>On <strong>Products &amp; Services</strong>, click <strong>Import</strong>.</li><li>Choose a CSV file (save your spreadsheet as CSV first).</li><li>Columns are matched for you: name, description, type, price, unit and active. Check them and change any that are wrong.</li><li>Look over the preview. Items already in your list and inactive rows are skipped.</li><li>Click <strong>Import</strong> (it shows how many items will be added).</li></ol>
<h2>Price materials from Home Depot</h2>
<p>Turn on The Home Depot in the <a href="/articles/app-marketplace">App Marketplace</a>, and the product and service form gets a <strong>Search Home Depot</strong> button. Search for an item and pick it: its price fills in with your markup added, and the Home Depot price, model number and link are kept with the item.</p>` },
  { slug: 'quote-invoice-page', topic: 'work', title: 'The quote, job and invoice pages', summary: 'Edit one section at a time, use the More menu, and print or save a PDF.', keywords: 'edit pencil section more menu pdf print copy similar duplicate preview save cancel',
    body: `<p>Open a quote, job or invoice to see it laid out in cards: the client and property, the details, line items, notes and, on the right, client payments and notes for your team.</p>
<h2>Edit one section</h2>
<ol class="steps"><li>Click the <strong>pencil</strong> on the card you want to change.</li><li>Make your changes.</li><li>Click <strong>Save</strong> at the bottom right of that card, or <strong>Cancel</strong> to leave it as it was.</li></ol>
<p>When you create a new quote, job or invoice, <strong>Cancel</strong> and <strong>Save</strong> sit in a bar that stays at the bottom of the screen as you scroll.</p>
<h2>The client card</h2>
<p>Click the <strong>•••</strong> beside the client’s name to <strong>View client profile</strong> or <strong>Edit client details</strong>. While you’re creating or editing, the same menu also has <strong>Change property</strong> and <strong>Change client</strong>. Your unsaved changes are kept while you edit the client.</p>
<h2>The More menu</h2>
<table><thead><tr><th>Page</th><th>What’s in More</th></tr></thead><tbody>
<tr><td><strong>Quote</strong></td><td>Convert to Job, Create Similar Quote, Send as… (Email, Text Message), Mark as… (Awaiting Response, Approved, Deposit Paid), Preview as Client, Collect Signature, Print or Save PDF, Delete</td></tr>
<tr><td><strong>Invoice</strong></td><td>Collect Payment, Create Similar Invoice, Send as… (Email, Text Message), Mark as… (Awaiting Payment), Preview as Client, Print or Save PDF, Delete</td></tr>
<tr><td><strong>Job</strong></td><td>Create Invoice, Collect Signature, Send as… (Email or Text Reminder), Stop Repeating After This Visit (repeating jobs), Request Off for This Job, Open Calendar, Delete</td></tr>
</tbody></table>
<div class="tip">The menu only shows what applies right now: for example, Collect Payment disappears once an invoice is paid, and Text Message shows only for clients who have agreed to texts.</div>` },

  /* ===== Clients ===== */
  { slug: 'add-clients', topic: 'clients', title: 'Add and manage clients', summary: 'Add clients, find them fast and keep their details up to date.', keywords: 'client customer add edit search filter export lead source contacts commercial company',
    body: `<h2>Add a client</h2>
<ol class="steps"><li>Go to <strong>Clients</strong> and click <strong>New Client</strong>. (You can also click <strong>Create new client</strong> at the bottom of the client list on a quote, job or invoice.)</li><li>Under <strong>Primary contact details</strong>, enter their title, first and last name and company name. For a business, tick <strong>Commercial client</strong> to use the company name as the client name.</li><li>Add their phone number and email.</li><li>If you’ll text them, open <strong>Communication settings</strong>, read them the script and tick <strong>Agreed to receive text messages</strong> only if they say yes. See <a href="/articles/text-messages">Send text messages</a>.</li><li>Choose a <strong>Lead source</strong>, such as Google, Referral or Yard sign, so you can see where your work comes from.</li><li>Add other people you deal with at this client under <strong>Additional contacts</strong>.</li><li>Enter the <strong>property address</strong>. Click <strong>Add Another Address</strong> for clients with more than one property. See <a href="/articles/client-properties">Clients with several properties</a>.</li><li>Click <strong>Save Client</strong>.</li></ol>
<h2>Edit a client</h2>
<p>Open the client and click the <strong>pencil</strong> beside their name, then <strong>Update Client</strong>. From a quote, job or invoice, use the <strong>•••</strong> beside the client’s name and choose <strong>Edit client details</strong>; you come back to your work afterwards with nothing lost.</p>
<h2>Find clients</h2>
<p>Use the search box and filters on the Clients page to narrow the list by status or tag, and sort by any column. Click a client to open their <a href="/articles/client-profile">profile</a>.</p>
<p>A client is a <strong>Lead</strong> until they have a job or invoice, then <strong>Active</strong>.</p>
<h2>Export</h2>
<p>Need your list elsewhere? On the Clients page, choose <strong>More Actions → Export to CSV</strong> to download your list.</p>
<div class="tip">Have a list in a spreadsheet already? <a href="/articles/import-clients">Import clients from a CSV file</a>.</div>` },
  { slug: 'client-profile', topic: 'clients', title: 'The client profile', summary: 'Everything about a client on one page: properties, work, billing, schedule, messages and notes.', keywords: 'client profile page details view archive delete merge customize tags notes balance lifetime communication',
    body: `<p>Click a client on the Clients page to open their profile. At the top are their phone, email, whether they’ve agreed to texts, company, lead source and when they became a client.</p>
<h2>Client information</h2>
<ul><li><strong>Properties</strong>: every address you work at for this client. Click one to open it, or the pin to see it on a map.</li><li><strong>Contacts</strong>: other people at this client.</li><li><strong>Work overview</strong>: their requests, quotes, jobs and invoices, with filters.</li><li><strong>Billing</strong>: invoices and payments, and the current balance.</li><li><strong>Client schedule</strong>: their visits and tasks. Click <strong>+</strong> to schedule a job or task.</li><li><strong>Service plan</strong>: the plan the client is on, when they’re next billed and their next plan visit. See <a href="/articles/service-plans">Sell service plans and memberships</a>.</li></ul>
<p>On the right are the client’s <strong>lifetime value</strong> and <strong>current balance</strong>, their <strong>tags</strong>, the <strong>last communication</strong> and internal <strong>notes</strong> for your team.</p>
<h2>Communication</h2>
<p>The <strong>Communication</strong> tab lists every email and text sent to the client, and whether it was delivered. Click one to read it.</p>
<h2>Create work</h2>
<p>Click <strong>+ Create</strong> at the top to start a quote, job or invoice for this client.</p>
<h2>The ••• menu</h2>
<ul><li><strong>Send Login Email</strong>: email the client a link to their <a href="/articles/client-portal">client portal</a>.</li><li><strong>Log in as Client</strong>: open their portal to see what they see.</li><li><strong>Archive</strong>: hide a client you no longer work with. Their records stay, and you can find them with the <strong>Archived</strong> status filter and unarchive them.</li><li><strong>Merge Client</strong>: combine a duplicate profile into this one. See <a href="/articles/merge-clients">Merge duplicate clients</a>.</li><li><strong>Delete Client</strong>: remove the client for good.</li><li><strong>Customize view</strong>: choose which cards the profile shows. This is saved in your browser.</li></ul>` },
  { slug: 'client-properties', topic: 'clients', title: 'Clients with several properties', summary: 'Keep each service address on the client, with its own contacts and tax rate.', keywords: 'property properties address addresses location service address billing address rental landlord property manager tax rate tenant',
    body: `<p>Landlords, property managers and many homeowners have more than one place you work. Give each one its own property on the client, so every quote, job and invoice goes to the right address.</p>
<h2>Add a property</h2>
<ol class="steps"><li>Open the client and click the <strong>pencil</strong> beside their name (or the <strong>+</strong> on the <strong>Properties</strong> card).</li><li>Under <strong>Property address</strong>, click <strong>Add Another Address</strong>.</li><li>Give the property a name if you like (such as “Rental home”) and enter the address.</li><li>Choose its <strong>tax rate</strong>: your company default, no tax, or a custom rate for that location.</li><li>Add <strong>property contacts</strong> for people who only deal with that address, such as tenants.</li><li>Save.</li></ol>
<h2>Billing address</h2>
<p>Tick <strong>Billing address is the same as property address</strong> on the property that receives the bills. Untick it everywhere to enter a separate billing address.</p>
<h2>Choosing a property on a quote, job or invoice</h2>
<p>When you choose a client with several properties, {product} asks <strong>which one this is for</strong>. Pick a property, add a <strong>+ New property</strong>, or <strong>Enter a different address</strong> for this one only. The property’s tax rate is used on the line items.</p>
<p>To change it later, click the <strong>•••</strong> beside the client’s name and choose <strong>Change property</strong>.</p>
<div class="tip">On the client’s profile, the <strong>Work overview</strong> card can be filtered by property, so you can see everything you’ve done at one address.</div>` },
  { slug: 'import-clients', topic: 'clients', title: 'Import clients from a CSV file', summary: 'Bring your existing client list in from a spreadsheet in three steps.', keywords: 'import csv spreadsheet excel upload clients bulk',
    body: `<ol class="steps"><li>Go to <strong>Clients</strong> and choose <strong>More Actions → Import clients</strong> (or search for “Import clients”).</li><li><strong>Choose a CSV file.</strong> Save your spreadsheet as CSV first. Use <strong>Download a sample file</strong> to see the layout.</li><li><strong>Match the columns.</strong> Tell {product} which column holds the name, email, phone, address and so on.</li><li><strong>Review and import.</strong> Check the preview and click Import.</li></ol>
<div class="note">After importing, run <a href="/articles/merge-clients">Merge duplicate clients</a> to tidy up anyone who was already in {product}.</div>
<div class="note">Imported clients haven’t agreed to text messages yet, so they get emails. Tick <strong>Agreed to receive text messages</strong> on a client’s profile once they’ve said yes. See <a href="/articles/text-messages">Send text messages</a>.</div>` },
  { slug: 'merge-clients', topic: 'clients', title: 'Merge duplicate clients', summary: 'Combine duplicate profiles into one so history stays in one place.', keywords: 'merge duplicate combine clients cleanup',
    body: `<h2>From the Clients page</h2>
<ol class="steps"><li>On the <strong>Clients</strong> page, the merge card shows how many possible duplicates there are: clients that share an email, phone number or name.</li><li>Click <strong>Merge Clients</strong> to list them, and tick the profiles that are the same client.</li><li>Click <strong>Merge</strong>, choose the profile to keep, and click <strong>Merge clients</strong>.</li></ol>
<h2>From a client’s profile</h2>
<ol class="steps"><li>Open the client you want to keep and click <strong>••• → Merge Client</strong>.</li><li>Choose the profile to merge into it. Possible duplicates are listed first.</li><li>Click <strong>Merge clients</strong>.</li></ol>
<p>All their quotes, jobs, invoices and messages move to the profile you keep. Empty details on it (email, phone, address, company) are filled in from the others, tags are combined and notes are added together. The other profiles are then deleted.</p>
<div class="note">Only the account owner and admins can merge clients.</div>` },
  { slug: 'client-portal', topic: 'clients', title: 'What clients see in the client portal', summary: 'Your clients’ own page for visits, quotes, invoices, payments and requests.', keywords: 'client portal hub self service requests estimates appointments wallet',
    body: `<p>Every client gets a private portal. To send it to them, open the client’s profile and choose <strong>••• → Send Login Email</strong>. To see it as they do, choose <strong>••• → Log in as Client</strong>.</p>
<p>On a phone, the portal’s sections are in the menu behind the three-line button at the top right.</p>
<h2>In their portal, clients can see</h2>
<ul><li><strong>Requests</strong>: send you a new work request with the details you need.</li><li><strong>Estimates</strong>: their quotes, to view and approve.</li><li><strong>Appointments</strong>: their upcoming and past visits.</li><li><strong>Invoices</strong>: what they owe and what they’ve paid.</li><li><strong>Reviews</strong>: write a review of a completed job or paid invoice, and see the ones they’ve sent you, if your plan includes Reviews.</li><li><strong>Wallet</strong>: their payments.</li><li><strong>Contact Us</strong>: your business contact details.</li></ul>
<p>If your plan includes referrals, clients can also share a referral link. See <a href="/articles/referrals">Referral links</a>.</p>
<div class="note">The portal always shows in light mode with your logo and accent color, so it looks like your business.</div>` },
  { slug: 'referrals', topic: 'clients', title: 'Referral links', summary: 'Let happy clients share a link; the people they refer arrive as leads.', keywords: 'referral refer friend share leads marketing',
    body: `<p>On plans with referrals, every client gets a <strong>Share your referral link</strong> page in their <a href="/articles/client-portal">client portal</a>. When someone opens the link and sends a request, they arrive in your Clients list as a <strong>lead</strong>, so you can follow up with a quote. If they ticked the box to get text messages, their profile shows they’ve <a href="/articles/text-messages">agreed to receive texts</a>.</p>` },

  { slug: 'service-plans', topic: 'clients', title: 'Sell service plans and memberships', summary: 'Plans clients pay for every month, quarter or year, with visits included and a member discount, invoiced and scheduled for you.', keywords: 'service plan plans membership memberships maintenance agreement club subscription recurring billing tune-up mrr discount members',
    body: `<p>A service plan is something your clients pay for on repeat, like “Comfort Club: $19 a month, 2 tune-ups a year and 15% off repairs”. {product} makes each member’s invoices, schedules their visits and takes the member discount off their other work.</p>
<div class="note"><strong>Beta.</strong> Service plans is new. Tell us how it works for you with <strong>Feedback</strong> in the top bar.</div>
<h2>How to make a plan</h2>
<ol class="steps"><li>Go to <strong>Service Plans</strong> in the sidebar and click <strong>New plan</strong>.</li><li>Give it a <strong>Name</strong> and say <strong>What’s included</strong>.</li><li>Set the <strong>Price</strong> and how often it’s <strong>Billed</strong>: every month, quarter or year.</li><li>Choose the <strong>Visits included</strong> each year and how long each visit takes. You can also name the visits (for example “Spring tune-up”).</li><li>Set a <strong>Member discount</strong> if members get money off other work, and tick <strong>Add sales tax</strong> if the plan is taxable.</li><li>Click <strong>Save plan</strong>.</li></ol>
<h2>How to put a client on a plan</h2>
<ol class="steps"><li>Click <strong>Add a client</strong> on Service Plans, or <strong>+ Add a client</strong> on a plan, or use the <strong>Service plan</strong> card on the client’s page.</li><li>Choose the client and the plan.</li><li>Choose when it <strong>Starts</strong> (the first invoice is made that day) and the date of the <strong>First visit</strong>.</li><li>Pick the visit time and the team for the visits.</li><li>Leave <strong>Email each invoice to the client automatically</strong> ticked to send each invoice with its pay link, or untick it to send them yourself.</li><li>Click <strong>Add to plan</strong>.</li></ol>
<h2>What happens next</h2>
<ul><li><strong>Billing</strong>: each billing period an invoice is made for every member and, with automatic emails on, sent with the pay link. A start date in the past catches up on the invoices since then.</li><li><strong>Visits</strong>: the plan’s visits are a <a href="/articles/recurring-jobs">repeating job</a>, scheduled ahead with the time and team you chose. Completed plan visits don’t wait to be invoiced, because the plan already bills for them.</li><li><strong>Discount</strong>: members’ new quotes and invoices get the plan’s discount automatically.</li></ul>
<h2>Keep track</h2>
<p>The top of Service Plans shows your active members, <strong>monthly recurring revenue</strong> and who is billed in the next 30 days. The Members list shows each client’s next bill, next visit and anything unpaid.</p>
<h2>Change, cancel or archive</h2>
<ul><li><strong>Edit a plan</strong>: changes apply to clients who join from now on. Current members keep the price and terms they joined with.</li><li><strong>Cancel a membership</strong>: click <strong>•••</strong> on the member and choose <strong>Cancel membership</strong>. No more invoices are made, and upcoming plan visits nobody has worked on are removed. Invoices already made stay.</li><li><strong>Archive a plan</strong>: a plan clients have been on can’t be deleted, but archiving it stops anyone new joining.</li></ul>
<p>Service plans is on the Advanced and Unlimited plans. Team members need the <strong>Service plans</strong> permission (the Manager role has it to start with). See <a href="/articles/access-levels">Roles and permissions</a>.</p>` },
  /* ===== Client Communications ===== */
  { slug: 'email-templates', topic: 'client-communications', title: 'Customize email templates', summary: 'Change the wording of quote, invoice and reminder emails using placeholders.', keywords: 'email template wording customize message variables placeholders',
    body: `<ol class="steps"><li>Click the <strong>gear icon</strong> and choose <strong>Email Templates</strong>.</li><li>Pick a template: <strong>Quote</strong>, <strong>Invoice</strong>, <strong>Appointment reminder</strong>, <strong>Payment receipt</strong>, <strong>Review request</strong>, <strong>Reply to a review</strong> or <strong>Client portal login</strong>.</li><li>Edit the subject and body. Click a placeholder to insert it.</li><li>Check the preview and save.</li></ol>
<p>The templates are where each email starts. When you email a quote or invoice, you can still change the subject and message for that one client before it goes. See <a href="/articles/send-email-text">Email or text a quote or invoice</a>.</p>
<h2>Placeholders</h2>
<p>Placeholders like <code>{{client_name}}</code>, <code>{{company_name}}</code>, <code>{{total}}</code>, <code>{{due_date}}</code> and <code>{{link}}</code> are swapped for the real details when the email is sent. A few more that are handy:</p>
<ul><li><code>{{company_email}}</code>: your business email, so clients know where to send questions. Works in every template.</li><li><code>{{sent_date}}</code>: the day the quote or invoice is sent, such as “the total as of {{sent_date}}”.</li></ul>
<p>Keep <code>{{link}}</code> in quote and invoice emails so clients can open them online.</p>
<div class="tip">Changed your mind? Use <strong>Reset</strong> to go back to the original wording.</div>` },
  { slug: 'text-messages', topic: 'client-communications', title: 'Send text messages', summary: 'Text quotes, invoices and reminders to clients.', keywords: 'sms text message twilio phone number consent opt in agree stop unsubscribe',
    body: `<p>On plans with text messages, you can send quotes, invoices and appointment reminders by text. There’s nothing to set up: {product} sends them for you. Each text comes from {product} and starts with “{product} for” and your business name, so clients know who it’s from, and ends with “Reply STOP to opt out.” Phone carriers require one registered sender, which is why texts come from {product}.</p>
<div class="note">Each plan includes a number of texts a month; see how many you’ve sent under <strong>Account and Billing</strong>. Every text that goes out counts once, however long it is. You’ll get a heads-up at 80%. If you reach the limit, texts start again on the 1st, and emails still go out. See <a href="/articles/plans-billing">Plans and billing</a> for more.</div>
<h2>Clients have to agree first</h2>
<p>Phone carriers only allow these texts to people who have agreed to them, so {product} only texts clients whose profile says <strong>Agreed to receive text messages</strong>. A client agrees in one of three ways:</p>
<ul><li><strong>Online:</strong> they tick the text-message box when they book on your <strong>online booking</strong> page or send a request through a <a href="/articles/referrals">referral link</a>. Their profile is ticked for you.</li>
<li><strong>In person or by phone:</strong> read them the short script shown under the box on their profile (it covers what you’ll text about, that message and data rates may apply, HELP and STOP, and where to find the terms and privacy policy). Only if they say yes, tick <strong>Agreed to receive text messages</strong> and save.</li>
<li><strong>Client portal:</strong> they tick the text-message box when they send a request from their <a href="/articles/client-portal">client portal</a>.</li></ul>
<p>Whichever way they agree, the client gets one text right away confirming they’re signed up, and how to get help or opt out. {product} records when and how each client agreed. Never tick the box for someone who hasn’t said yes.</p>
<h2>Send a text</h2>
<ol class="steps"><li>Make sure the client has a mobile number and has agreed to texts.</li><li>Open the quote or invoice and click <strong>Send Text</strong>.</li><li>Edit the message if you like (up to 160 characters) and check the preview, which shows the text as your client will get it, with its short link and opt-out.</li><li>Click <strong>Send</strong>, then check the <strong>Notifications Log</strong> to see it was delivered.</li></ol>
<p>If the client hasn’t agreed to texts or has no mobile number, the box tells you, and you can email them instead. Links in texts are short links on your own web address, so clients can see the text is really from you.</p>
<div class="note">If a client replies <strong>STOP</strong>, they won’t get any more texts, and texts to them show as failed in the Notifications Log. Email them instead. They can reply <strong>START</strong> to get texts again.</div>
<div class="note">Client phone numbers need to be correct, including the area code. Numbers starting with + are treated as international.</div>` },
  { slug: 'send-email-text', topic: 'client-communications', title: 'Email or text a quote or invoice', summary: 'Check the message, attach files and the PDF, and send yourself a copy.', keywords: 'send email text sms attachment attach pdf copy cc message subject resend',
    body: `<h2>Email it</h2>
<ol class="steps"><li>Open the quote or invoice and click <strong>More → Send as… → Email</strong>.</li><li><strong>To</strong> starts with the client’s email. Add more addresses, separated by commas.</li><li>The <strong>subject</strong> and <strong>message</strong> start from your <a href="/articles/email-templates">email template</a>. Change them for this client if you like.</li><li>Under <strong>Attachments</strong>, tick the quote or invoice PDF to attach it (click <strong>Preview</strong> to check it), and select or drag in any other files, up to 10 MB in all.</li><li>Tick <strong>Send me a copy</strong> to get one yourself.</li><li>Click <strong>Send Email</strong>.</li></ol>
<p>Under your message, the client sees a button to view and approve the quote, or view and pay the invoice, online.</p>
<h2>Text it</h2>
<p>Click <strong>Send Text</strong> beside <strong>More</strong>, check the message and click <strong>Send</strong>. Texting is on some plans, and only for clients who have agreed to texts. See <a href="/articles/text-messages">Send text messages</a>.</p>
<h2>Did it arrive?</h2>
<p>After sending you’ll see how each message went. Every email and text is also listed in the <a href="/articles/notifications-log">Notifications Log</a> and on the <strong>Communication</strong> tab of the client’s profile.</p>
<div class="tip">Need a paper copy or a file to send another way? Use <strong>More → Print or Save PDF</strong>.</div>` },
  { slug: 'connect-email', topic: 'client-communications', title: 'How emails to clients are sent', summary: 'Client emails go out in your business name, and replies come straight to you.', keywords: 'email gmail sendgrid smtp sender from address reply',
    body: `<p>{product} sends your quotes, invoices, reminders and receipts for you. Clients see your business name as the sender, with your logo at the top, and when they reply, the reply goes to the email address in <strong>gear → Company Profile</strong>.</p>
<p>Change the wording of each email in <strong>gear → Email Templates</strong>.</p>` },
  { slug: 'notifications-log', topic: 'client-communications', title: 'The notifications log', summary: 'See every email and text {product} sent, and whether it was delivered.', keywords: 'notifications log sent emails texts delivered failed history',
    body: `<p><strong>Notifications Log</strong> in the sidebar lists every email and text sent to clients: who it went to, what it was about and its status.</p>
<ul><li><strong>Sent</strong>: delivered to the email or text provider.</li><li><strong>Failed</strong>: something went wrong. Open it to see why, such as a missing email address.</li><li><strong>Simulated</strong>: recorded but not delivered, because no email or text provider is connected yet.</li></ul>
<p>Click any entry to read the full message.</p>` },

  { slug: 'on-my-way', topic: 'client-communications', title: 'Let a client know you’re on the way', summary: 'Tap On My Way on a job to text or email the client your arrival time.', keywords: 'on my way omw eta arrival heading en route text client notify running late',
    body: `<p>Heading to a job? <strong>On My Way</strong> tells the client about when you’ll arrive, so they’re ready for you.</p>
<h2>How to send it</h2>
<ol class="steps"><li>Open the job (on a computer or your phone).</li><li>Click <strong>On My Way</strong>.</li><li>Choose about how long until you arrive, from 5 minutes to 2 hours.</li><li>Click <strong>Send</strong>.</li></ol>
<p>The client gets a text if they’ve agreed to texts and your plan includes text messages; otherwise they get an email. The window shows which before you send. The job then shows <strong>➜ On the way</strong> with the time for the rest of the day.</p>
<h2>Who can send it</h2>
<p>The team members on the job, and anyone who can edit jobs. Team members who can only see their jobs can send it too.</p>
<div class="tip">Change the wording of the email in <strong>Settings → Email Templates → On my way</strong>. See <a href="/articles/email-templates">Customize email templates</a>. Every message sent is in the <a href="/articles/notifications-log">notifications log</a>.</div>` },
  /* ===== Marketing ===== */
  { slug: 'account-connections', topic: 'marketing', title: 'Connect Google and your social media', summary: 'Link your Google Business Profile, Facebook Page, Instagram, LinkedIn, TikTok, Threads, Pinterest and Bluesky to {product}.', keywords: 'account connections connect google business profile facebook page instagram linkedin tiktok threads pinterest bluesky link disconnect social',
    body: `<p>Connect the accounts your business already uses, so you can reply to Google reviews, take bookings from Google and post your work to your social media without leaving {product}. You can also connect them at the top of <strong>Marketing</strong>.</p>
<ol class="steps"><li>Click <strong>Settings</strong> at the bottom of the menu and choose <strong>Account Connections</strong>.</li><li>Click <strong>Connect</strong> beside Google Business Profile, Facebook Business Page or Instagram account.</li><li>Sign in and allow access. If you manage more than one profile or page, choose the one for this business; you can <strong>Change</strong> it later.</li></ol>
<h2>What you need</h2>
<ul><li><strong>Google</strong>: a Google Business Profile you own or manage.</li><li><strong>Facebook</strong>: full admin permissions for the business Page.</li><li><strong>Instagram</strong>: a professional account, either Business or Creator. You sign in with Instagram itself, so you don’t need a Facebook account or Page.</li></ul>
<h2>Once connected</h2>
<ul><li>Google shows its features below it: <a href="/articles/google-reviews">Reviews</a> and <a href="/articles/online-booking">Online booking</a>, each with a <strong>Manage</strong> button.</li><li>Facebook and Instagram let you post from <a href="/articles/social-posts">Marketing</a>.</li></ul>
<p>Click <strong>Disconnect</strong> at any time to unlink an account.</p>
<h2>If an account needs reconnecting</h2>
<p>Worklio Pro keeps your accounts signed in for you, even when you don’t post for a while. A network can still sign Worklio Pro out, for example when you change your password, remove Worklio Pro in that network’s settings, or (for LinkedIn) once a year. When that happens:</p>
<ul><li>The account shows <strong>Needs reconnecting</strong> in Account Connections and in Marketing, and the account owner gets an email.</li><li>Click <strong>Reconnect</strong> and sign in to that network again. It takes about a minute. You don’t need to disconnect first, and nothing you’ve posted is lost.</li><li>For LinkedIn, you’ll see <strong>Reconnect soon</strong> and get an email two weeks before its yearly sign-in ends.</li></ul>
<div class="note">Only the account owner and admins can connect accounts. Account connections, Google reviews and social posts are included on some plans; if you don’t see them, check your plan under <strong>Account and Billing</strong>.</div>` },
  { slug: 'client-reviews', topic: 'marketing', title: 'Get reviews from your clients', summary: 'Clients are asked for a review after a job is completed or an invoice is paid, and you read them under Reviews.', keywords: 'client reviews feedback rating stars ask request email completed job paid invoice',
    body: `<p>When you mark a job complete or an invoice is paid, the client gets an email with a private link to rate the work from 1 to 5 stars and add a comment. Their review shows under <strong>Reviews → From your clients</strong>. Only your team and that client see it: clients can find their own reviews in the <strong>Reviews</strong> section of their <a href="/articles/client-portal">client portal</a>.</p>
<h2>Who gets asked</h2>
<ul><li>Clients with an email address. Review requests aren’t sent by text.</li><li>A job and its invoice count as one request, so the client isn’t asked twice for the same work.</li><li>A client is asked at most once every 30 days, so regular clients aren’t asked after every visit.</li></ul>
<p>A paid invoice’s page also has a <strong>Leave a review</strong> button, which works for clients without an email address.</p>
<h2>Photos and videos</h2>
<p>Clients can add up to 10 photos and videos to a review: photos up to 15 MB, videos up to 100 MB. They show with the review, and only the client can remove them.</p>
<h2>Clients can change their reviews</h2>
<p>A client can edit their review at any time from their client portal or the emailed link. It’s marked <strong>Edited by the client</strong> with the date, and you get the same alerts as a new review; the earlier version isn’t kept. Your team can read reviews and reply, but can’t change them. That includes <strong>Log in as Client</strong>, which shows the portal view-only for reviews.</p>
<h2>Reply to a review</h2>
<p>Click <strong>Reply</strong> under a review on the <strong>From your clients</strong> tab. The client sees your reply in their portal and on their review link, and gets an email the first time you reply. Use <strong>Edit</strong> or <strong>Delete</strong> to change your own reply.</p>
<h2>Reviews from the client portal</h2>
<p>Clients can also write a review themselves from their <a href="/articles/client-portal">client portal</a>, on any completed job or paid invoice they haven’t reviewed. This doesn’t depend on the switches below or the 30-day limit, because nothing is sent to them.</p>
<h2>Ask your own questions</h2>
<p>Under <strong>Your questions</strong>, click <strong>Add question</strong>, choose a star rating, yes or no, or a written answer, and tick <strong>Jobs</strong>, <strong>Invoices</strong> or both to choose which reviews ask it. Tick <strong>Required</strong> if clients must answer. Click <strong>Save questions</strong>. Reviews you already have keep the wording they were answered with.</p>
<h2>Change when clients are asked</h2>
<p>On the <strong>From your clients</strong> tab, turn off <strong>When a job is completed</strong> or <strong>When an invoice is paid</strong>. <strong>Email me new reviews</strong> controls the email you get. Change the request’s wording in <a href="/articles/email-templates">Email Templates</a>.</p>
<div class="note">Anyone whose role includes <strong>Reviews</strong> can read these, reply and change the switches. After sending a review, clients with a connected Google profile are offered a link to share it on Google too, whatever their rating.</div>` },
  { slug: 'google-reviews', topic: 'marketing', title: 'Read and reply to Google reviews', summary: 'See all your Google reviews in one place, reply to them and ask happy clients for more.', keywords: 'google reviews stars rating reply respond business profile review link ask',
    body: `<p>The <strong>Google</strong> tab of <strong>Reviews</strong> in the sidebar shows the reviews on your Google Business Profile. Connect your profile first in <a href="/articles/account-connections">Account Connections</a>.</p>
<h2>Reply to a review</h2>
<ol class="steps"><li>Open <strong>Reviews → Google</strong>. The <strong>Needs a reply</strong> tab lists reviews you haven’t answered yet.</li><li>Click <strong>Reply</strong> under a review and write your reply.</li><li>Click <strong>Post reply</strong>.</li></ol>
<p>Your reply shows publicly on Google under the review. Use <strong>Edit</strong> or <strong>Delete</strong> to change or remove it; deleting it takes it off Google too.</p>
<h2>Ask for reviews</h2>
<p>At the top of the page are your average rating and your <strong>review link</strong>. Click <strong>Copy</strong> and send it to happy clients: it opens Google’s review form for your business.</p>
<div class="tip">Reply to every review, good or bad. A short, friendly thank-you shows future clients you care.</div>
<div class="note">Anyone whose role includes <strong>Reviews</strong> can reply. See <a href="/articles/access-levels">Roles and permissions</a>.</div>` },
  { slug: 'online-booking', topic: 'marketing', title: 'Take bookings online', summary: 'Share your booking page and add a Book button to Google so new clients can ask for a visit.', keywords: 'online booking book button google request lead website booking page schedule appointment new clients',
    body: `<p>Your booking page lets new clients ask for a visit any time. Each request arrives in <strong>Clients</strong> as a lead, and you get an email so you can follow up with a quote.</p>
<h2>Turn it on</h2>
<ol class="steps"><li><a href="/articles/account-connections">Connect your Google Business Profile</a> in <strong>gear → Account Connections</strong>.</li><li>Under Google, find <strong>Online booking</strong> and click <strong>Manage</strong>.</li><li>Turn on <strong>Show a Book button on Google</strong> and click <strong>Save</strong>. Google can take a few hours to show it on your profile in Search and Maps.</li></ol>
<h2>Share your booking page</h2>
<p>The same box shows your booking page’s link. Click <strong>Copy</strong> and add it to your website, social media bio or email signature.</p>
<p>When clients book, they can tick a box to get text messages from you. If they do, their profile shows they’ve <a href="/articles/text-messages">agreed to receive texts</a>, and the lead source is set to <strong>Online booking</strong>.</p>` },
  { slug: 'social-posts', topic: 'marketing', title: 'Post your work to your social media', summary: 'Share project photos with a caption on Facebook, Instagram, LinkedIn, TikTok, Threads, Pinterest, Bluesky and Google Business Profile in one go.', keywords: 'social posts facebook instagram linkedin tiktok threads pinterest pin board bluesky google business profile updates app password post photos marketing before after caption share',
    body: `<p>Before-and-after photos make great posts. <strong>Marketing</strong> in the sidebar posts them to every account you connect at the same time: your Facebook Page, Instagram, LinkedIn company page, TikTok, Threads, a Pinterest board, Bluesky and Google Business Profile. Connect them at the top of the Marketing page, under <strong>Connect your social accounts</strong>, or in <a href="/articles/account-connections">Account Connections</a>.</p>
<h2>Connect Bluesky</h2>
<p>Bluesky connects with an <strong>app password</strong> instead of a sign-in page. In Bluesky, go to <strong>Settings → Privacy and security → App passwords</strong>, add one, then click <strong>+ Connect</strong> on Bluesky and enter your handle and that app password. To stop posting there, disconnect it in Account Connections or revoke the app password in Bluesky.</p>
<h2>Make a post</h2>
<ol class="steps"><li>Open <strong>Marketing</strong> and tick where to post. Each connected account is ticked to start.</li><li>If TikTok is ticked, choose who can see the post, whether comments are on, and whether it promotes your business.</li><li>Click <strong>Choose from Project Gallery</strong> to use photos from your jobs, or <strong>Upload photos</strong>. Add up to 10; the first one is the cover. Pinterest and Google use only the first, and Bluesky takes up to 4.</li><li>Write a caption. The counter shows the shortest limit of the networks you ticked: Bluesky 300, Threads and Pinterest 500, Google 1,500, Instagram 2,200, LinkedIn 3,000 and TikTok 4,000.</li><li>Click <strong>Post now</strong>.</li></ol>
<p>Your posts are listed under <strong>Posted</strong>, with a link to view each one. If a post didn’t go through, the reason is shown under it, with what to do about it.</p>
<p>If a network has signed {product} out (for example after you change your password there), Marketing shows <strong>Needs reconnecting</strong> at the top and on that account. Click <strong>Reconnect</strong> and sign in again; you don’t need to disconnect first. See <a href="/articles/account-connections">Connect Google and your social media</a>.</p>
<div class="note">Instagram, TikTok and Pinterest posts need at least one photo. A Pin goes on the board you chose in Account Connections and links to your website. On LinkedIn, posts go out from the company page you chose. Until TikTok approves the app, TikTok posts can only be private. Bluesky posts can have up to 4 photos and 300 characters; links and #hashtags in the caption are clickable there. Google posts need a caption, show as updates on your Business Profile, and get a <strong>Book</strong> button when <a href="/articles/online-booking">online booking on Google</a> is on. Google checks each post first, so it can take a little while to appear, and it turns down posts with a phone number in the caption.</div>
<div class="tip">Keep your <a href="/articles/job-photos">Project Gallery</a> up to date and you’ll always have something to post.</div>` },
  { slug: 'job-posts', topic: 'marketing', title: 'Turn finished jobs into social posts', summary: 'When a job is completed and has photos, a ready-to-post social post is made for you with a caption. Check it in Marketing and post it in one tap.', keywords: 'every job markets itself job posts finished completed job photos before after caption ai approve ready to post booking link results visits requests monthly email marketing automatic',
    body: `<p>With <strong>Every job markets itself</strong>, the photos your team already takes become marketing. When a job is marked complete and has photos, a post is drafted for you right away: the best photos (before and after first) and a caption that says what was done and names the town. It waits in <strong>Marketing</strong> under <strong>Ready to post</strong>. Nothing is posted until someone approves it.</p>
<div class="note"><strong>Beta.</strong> Every job markets itself is new. Tell us how it works for you with <strong>Feedback</strong> in the top bar.</div>
<h2>Where the photos come from</h2>
<p>The post uses the job’s photos in the <a href="/articles/job-photos">Project Gallery</a> (before, after and progress), photos in the job’s notes, and photos in its checklists. A photo added up to two weeks after the job was completed still makes a post, if the job doesn’t have one yet. Each job gets one post.</p>
<h2>Check it and post it</h2>
<ol class="steps"><li>When a post is ready, people who can post get a notification, and the account owner gets an email (at most once a day). Open <strong>Marketing</strong>.</li><li>Under <strong>Ready to post</strong>, tick the photos to use, up to 10. The first one ticked is the cover. Untick any photo that shows a face, a house number or anything you’d rather keep private.</li><li>Read the caption and change anything you like. To have it written again in another style, click <strong>Friendly</strong>, <strong>Proud</strong>, <strong>Professional</strong> or <strong>Shorter</strong>.</li><li>Tick where to post and click <strong>Post now</strong>. Or click <strong>Skip this one</strong> and it won’t be posted.</li></ol>
<p>The caption is written by AI from the photos and the job’s title and line items. It never names your client, the street or the house number, only the town. Read it before you post: you’re responsible for what goes out. If AI isn’t available, you get a simple caption to edit instead.</p>
<div class="note">Posts from jobs go to Facebook, Instagram, Google Business Profile, LinkedIn, Threads, Pinterest, Bluesky and X. TikTok and YouTube need extra choices, so post those from <strong>New post</strong> on the same page. <a href="/articles/social-posts">Connect your accounts</a> first.</div>
<h2>See what your posts bring in</h2>
<p>With <a href="/articles/online-booking">online booking</a> on, each post links to your booking page with a code for that post: in the caption on Facebook, LinkedIn and Threads, and on the button for Google and Pinterest. Marketing shows this month’s posts from jobs, client reviews, booking page visits and booking requests from your posts, and each post under <strong>Posted from jobs</strong> shows its own visits and requests. On the 1st of each month the account owner gets an email with last month’s numbers.</p>
<h2>Turn it on or off</h2>
<p>The account owner or an admin can untick <strong>Make posts from finished jobs</strong> or <strong>Email the owner when one is ready</strong> at the top of the section. Each person chooses whether they get the notification in <strong>Preferences → Push notifications</strong>. It’s on the Advanced and Unlimited plans.</p>` },
  { slug: 'automations', topic: 'marketing', title: 'Send follow-ups and reminders automatically', summary: 'Build rules that message clients or your team when a quote, invoice, job or client reaches a certain point.', keywords: 'automations automatic follow up reminder rules workflow overdue invoice quote thank you unsubscribe',
    body: `<p><strong>Automations</strong> in the sidebar sends messages on its own, such as a follow-up 3 days after a quote goes unanswered, or a reminder the day before a job.</p>
<ol class="steps"><li>Open <strong>Automations</strong> and pick a template, or click <strong>New automation</strong>.</li><li>Choose the trigger, the number of days and the time to send it.</li><li>Choose who gets it and how, then write the message.</li><li>Click <strong>Who would get this?</strong> to check it, and <strong>Email me a test</strong> to see how it looks.</li><li>Save it, then click <strong>Activate</strong>.</li></ol>
<p>Your automations are listed on the Automations page. Click one to edit, activate, deactivate or delete it.</p>
<p>On the <strong>Job completed</strong> and <strong>Invoice paid</strong> triggers, click <strong>Review link</strong> under the message to add a link to a form where the client reviews that job or invoice. It needs Reviews on your plan.</p>
<p>Each quote, invoice, job or client gets an automation once. If you move a job to another day, its reminder goes out again for the new date.</p>
<div class="note">Turning an automation on only affects what comes due from that day on, so it won’t message old quotes or invoices. Texts only go to clients who agreed to them, and every client email has an unsubscribe link.</div>
<div class="tip">Automations are included on some plans. If you don’t see them, check your plan under <strong>Account and Billing</strong>.</div>`,
  },
  { slug: 'app-marketplace', topic: 'marketing', title: 'The App Marketplace', summary: 'Connect the apps your business uses, and vote for the ones you want next.', keywords: 'app marketplace apps integrations connect home depot quickbooks zapier google facebook instagram stripe vote request suggest',
    body: `<p>Open <strong>gear → App Marketplace</strong> to see every app {product} works with. Browse by category or search, and click an app to read what it does.</p>
<h2>Connect an app</h2>
<p>Apps that are ready show <strong>Connect</strong> (or <strong>Manage</strong> once connected). Google, Facebook and Instagram open <a href="/articles/account-connections">Account Connections</a>, and Stripe opens <a href="/articles/set-up-payments">card payment setup</a>. The <strong>Connected</strong> tab lists the apps you use.</p>
<h2>The Home Depot</h2>
<ol class="steps"><li>Click <strong>Connect</strong> on The Home Depot.</li><li>Turn on <strong>Search Home Depot when adding products and services</strong>.</li><li>Enter your ZIP code for local prices, and the markup to add (with 20%, a $10.00 item is priced at $12.00).</li><li>Click <strong>Save</strong>.</li></ol>
<p>Then use <strong>Search Home Depot</strong> on the <a href="/articles/products-services">product and service form</a>. Prices are the ones on homedepot.com (not Pro Xtra pricing) and can change.</p>
<h2>Want an app that isn’t ready yet?</h2>
<p>Apps marked <strong>Coming soon</strong> have an <strong>I want this</strong> button. The most-wanted apps are built first. Don’t see an app you use? Click <strong>Suggest an app</strong> and tell us what you’d like it to do.</p>` },

  /* ===== Payments ===== */
  { slug: 'stripe-card-payments', topic: 'payments', title: 'Accept card payments with Stripe', summary: 'Let clients pay invoices and deposits by card, straight into your Stripe account.', keywords: 'stripe card credit debit online payments connect pay',
    body: `<ol class="steps"><li>Go to <strong>gear → App Settings</strong> and find <strong>Card payments</strong>.</li><li>Click <strong>Connect with Stripe</strong> and follow Stripe’s steps to create or link your account.</li><li>When you come back, Stripe shows as connected.</li></ol>
<p>For everything Stripe asks for and the settings you can choose, see <a href="/articles/set-up-payments">How to set up card payments</a>.</p>
<p>From then on, invoice links and quote deposits include a <strong>Pay by card</strong> option. Payments go straight to your Stripe account and are recorded on the invoice automatically.</p>
<h2>See your payments</h2>
<p>The <strong>Payments</strong> page in the sidebar shows client payments, payouts to your bank, any disputes and the processing rates. See <a href="/articles/payments-page">The Payments page</a>.</p>
<div class="note">Online card payments are included on some plans. If you don’t see Stripe, check your plan under <strong>Account and Billing</strong>.</div>` },
  { slug: 'zelle', topic: 'payments', title: 'Accept Zelle payments', summary: 'Show your Zelle details on invoices and quotes so clients can pay by bank.', keywords: 'zelle bank transfer pay',
    body: `<ol class="steps"><li>Go to <strong>gear → App Settings</strong> and find <strong>Zelle payments</strong>.</li><li>Enter the email or phone number registered with Zelle and the name clients will see.</li><li>Save. You can then turn on Zelle per invoice or quote.</li></ol>
<p>When a client says they’ve paid by Zelle, you’ll see it on the invoice. Check your bank, then <a href="/articles/record-payment">record the payment</a>.</p>` },
  { slug: 'payments-page', topic: 'payments', title: 'The Payments page', summary: 'Client payments, payouts, disputes and payment settings in one place.', keywords: 'payments payouts disputes processing rates bank',
    body: `<p><strong>Payments</strong> in the sidebar brings together the money coming in:</p>
<ul><li><strong>Client payments</strong>: every payment recorded on an invoice, online or offline.</li><li><strong>Payouts</strong>: transfers from Stripe to your bank account.</li><li><strong>Disputes</strong>: card payments a client has challenged with their bank.</li></ul>
<p>Use <strong>Payment settings</strong> to see processing rates and payout timing, or turn off online payments.</p>` },
  { slug: 'set-up-payments', topic: 'payments', title: 'How to set up card payments', summary: 'Connect Stripe so clients can pay invoices and quote deposits online, and get the money in your bank.', keywords: 'set up setup payments stripe connect card bank account verify business ein ssn payouts online pay ach',
    body: `<p>With card payments turned on, clients can pay invoices and quote deposits online from the link you send them. The money goes to your own Stripe account and then to your bank, and each payment is recorded on its invoice or quote automatically.</p>
<ul><li>Clients can pay by <strong>credit or debit card</strong> (Visa, Mastercard, American Express and Discover), with Apple Pay and Google Pay where their device supports them.</li><li>You can also let them pay <strong>from their bank account (ACH)</strong>.</li><li>The smallest online payment is $0.50.</li></ul>
<div class="note">Only the account <strong>owner</strong> or an <strong>admin</strong> can set up card payments, and your plan needs to include <strong>Online card payments</strong>. Your plan is listed at the top of <strong>gear → App Settings</strong>.</div>
<h2>Before you start</h2>
<p>Setup takes about 10 to 15 minutes. Stripe will ask for:</p>
<ul><li>Your <strong>legal business name</strong> and address, and what your business does</li><li>Your <strong>EIN</strong>, or your <strong>SSN</strong> if you’re a sole proprietor without an EIN</li><li>The owner’s name, date of birth, home address and the last 4 digits of their SSN (Stripe may ask for a photo ID)</li><li>Your business <strong>checking account</strong>: either your online banking sign-in, or the routing and account numbers</li></ul>
<h2>Set up card payments</h2>
<ol class="steps"><li>Go to <strong>gear → App Settings</strong> and find <strong>Card payments</strong>.</li><li>Click <strong>Connect with Stripe</strong>. Stripe’s secure setup page opens.</li><li>Sign in to your Stripe account if you already have one, or create a new one.</li><li>Fill in your business details and verify your identity (see below).</li><li>Add the bank account where you want to receive payouts.</li><li>When you finish, Stripe sends you back to App Settings, where Card payments shows <strong>Connected</strong>.</li></ol>
<figure class="shot"><img src="/img/help/payments-card-payments-connect.png" width="436" alt="The Card payments box in App Settings, showing Not connected and a Connect with Stripe button"><figcaption>gear → App Settings → Card payments, before you connect</figcaption></figure>
<div class="tip">You don’t have to finish in one go. If you stop partway, Card payments shows <strong>Setup not finished</strong>. Click <strong>Finish setting up Stripe</strong> to carry on where you left off.</div>
<h2>Verify your business</h2>
<p>Stripe checks your details to protect you and your clients from fraud, as banks require. On the setup page, choose the business type that matches how you’re registered:</p>
<ul><li><strong>Sole proprietor</strong>: you run the business under your own name. Use your SSN, or your EIN if you have one.</li><li><strong>Company</strong> (LLC, corporation or partnership): use the company’s EIN, and add the people who own or manage it if Stripe asks.</li></ul>
<p>Most businesses are verified within a few minutes. While Stripe reviews your details, Card payments says <strong>Stripe is reviewing your details</strong>. Click <strong>Check again</strong> to see if it’s done. If Stripe needs more information, it emails you, and App Settings shows a button to review your details in Stripe.</p>
<figure class="shot"><img src="/img/help/payments-card-payments-connected.png" width="436" alt="The Card payments box showing Connected and Live, with an Open Stripe dashboard button"><figcaption>Card payments once Stripe has verified your business</figcaption></figure>
<h2>Connect your bank account</h2>
<p>Stripe pays out to a <strong>checking account</strong> in your business’s name. During setup you can:</p>
<ul><li><strong>Sign in to your bank</strong> to connect the account instantly (the quickest way), or</li><li><strong>Enter the routing and account numbers</strong> yourself. Stripe may make small test deposits to confirm the account.</li></ul>
<p>To change the bank account later, sign in to your Stripe dashboard and update it under your payout settings. Payouts already on their way still go to the old account. See <a href="/articles/payout-schedule">When card payments reach your bank: the payout schedule</a> for timing.</p>
<h2>Choose how clients can pay</h2>
<p>Go to <strong>Payments</strong> in the sidebar and click <strong>Settings</strong>:</p>
<ul><li><strong>Client payments</strong>: turn card and bank payments on or off, separately for quote deposits and for invoices.</li><li><strong>Notifications</strong>: get an email when a client pays online, and send clients a receipt automatically.</li><li><strong>Disable payments</strong>: stop all online payments for a while. Zelle details and payments you record yourself keep working.</li></ul>
<figure class="shot"><img src="/img/help/payments-payment-settings.png" width="592" alt="Payment settings with switches for card and bank payments on quotes and invoices, payment notifications and Disable payments"><figcaption>Payments → Settings</figcaption></figure>
<p>To turn off card payments on a single quote or invoice, switch off <strong>Card payments</strong> in its <strong>Client payments</strong> box.</p>
<figure class="shot"><img src="/img/help/payments-invoice-card-switch.png" width="286" alt="The Client payments box on an invoice with a Card payments switch"><figcaption>The Client payments box on an invoice</figcaption></figure>
<h2>Fees</h2>
<p>Stripe charges its standard processing fee on each online payment, and it’s taken out before the payout. If your plan has a platform fee, it’s shown in Payment settings and on App Settings → Card payments. Payments you record yourself, like cash, check and Zelle, have no fees.</p>
<h2>What your clients see</h2>
<p>When you send a quote or invoice, your client’s link shows a <strong>Pay</strong> button with the amount, for example <strong>Pay $250.00 with card</strong>. It opens Stripe’s secure checkout with your business name, and afterwards the payment shows as paid on the invoice or quote, in <strong>Payments</strong>, and in your client’s portal.</p>
<figure class="shot"><img src="/img/help/payments-client-pay-page.png" width="680" alt="An invoice as the client sees it, with a Pay $250.00 with card button"><figcaption>What your client sees when they open the invoice link</figcaption></figure>
<h2>Team permissions</h2>
<ul><li><strong>Owners and admins</strong> can set up card payments and change payment settings.</li><li><strong>Managers</strong> can see the Payments page and record payments on invoices.</li><li><strong>Technicians</strong> don’t see prices or payments.</li></ul>
<h2>Troubleshooting</h2>
<ul><li><strong>Card payments says “Not available yet”</strong>: online payments aren’t switched on for this service yet. Contact us through <strong>Get Support</strong>.</li><li><strong>“Not in your plan”</strong>: choose a plan with Online card payments in <strong>gear → Account and billing</strong>.</li><li><strong>Payouts are on hold</strong>: Stripe needs more information. Open App Settings → Card payments and follow the prompt to review your details in Stripe.</li></ul>` },
  { slug: 'payout-schedule', topic: 'payments', title: 'When card payments reach your bank: the payout schedule', summary: 'How long it takes for online payments to be paid out to your bank, and how to track them.', keywords: 'payout payouts schedule bank deposit when timing upcoming stripe transfer business days ach',
    body: `<p>When a client pays a quote deposit or an invoice online, the money goes to your Stripe account first. Stripe then sends it to your bank account in a <strong>payout</strong>. Here’s how long that takes.</p>
<h2>Your first payout</h2>
<p>You can take card payments as soon as you connect Stripe in <strong>gear → App Settings → Card payments</strong>. Your first payout takes a little longer while Stripe verifies your business:</p>
<ul><li>It usually arrives <strong>7 to 14 days</strong> after your first successful payment. The clock starts at that first payment, not when you connected Stripe.</li><li>Payments you collect during that time are included in the first payout, or in the ones right after it.</li></ul>
<div class="note">Make sure Stripe has everything it needs (your business details, identity and bank account). If Stripe asks for more information, payouts pause until you provide it. App Settings → Card payments shows when something’s missing.</div>
<h2>After your first payout</h2>
<p>Stripe pays out on a rolling schedule: each day’s payments are bundled into one payout, so a single deposit can include several client payments.</p>
<table><tr><th>How the client paid</th><th>Typical time to your bank</th></tr>
<tr><td>Credit or debit card</td><td>2 business days</td></tr>
<tr><td>Bank account (ACH)</td><td>About 4 business days, while the payment clears</td></tr></table>
<p>After Stripe sends a payout, your bank can take another <strong>1 to 2 business days</strong> to post it, so allow up to about a week in total.</p>
<div class="tip">Business days are Monday to Friday. Payments made on weekends or bank holidays start counting on the next business day, and payouts aren’t sent on bank holidays.</div>
<h2>Track your payouts</h2>
<ol class="steps"><li>Click <strong>Payments</strong> in the sidebar.</li><li>On <strong>Overview</strong>, the <strong>Upcoming payouts</strong> box shows the money on its way. Money that’s ready now shows the date of your next payout. Click <strong>View payouts</strong> to see each expected date and amount.</li><li>Open the <strong>Payouts</strong> tab to see payouts already sent: their date, status, amount and the bank account they went to.</li></ol>
<p>Upcoming dates come from Stripe and are estimates until the money is deposited. In the <strong>All payments</strong> list, the <strong>Payout date</strong> column shows when each card payment is (or was) paid out.</p>
<h2>Common questions</h2>
<h3>Why is my payout taking longer than usual?</h3>
<p>Weekends and bank holidays, a first payout, bank (ACH) payments, or Stripe needing more information can all add time. If a payout is more than a few days late, check App Settings → Card payments for anything Stripe needs, then contact us through <strong>Get Support</strong>.</p>
<h3>Can I cancel a payout that’s already been sent?</h3>
<p>No. Once Stripe sends a payout it’s on its way to your bank. If it doesn’t arrive, contact us and we’ll help you trace it with Stripe and your bank.</p>
<h3>Will changing my bank account affect a payout that’s already on its way?</h3>
<p>No. A payout goes to the bank account that was connected when it was sent. A new bank account is used for payouts after the change.</p>
<h3>Can I get paid out faster or on a different schedule?</h3>
<p>Payouts follow your Stripe account’s schedule. Daily payouts are the default and the fastest standard option.</p>` },

  /* ===== Business Health ===== */
  { slug: 'expenses', topic: 'business-health', title: 'Track expenses', summary: 'Log what you spend on materials and running the business.', keywords: 'expenses costs receipts spending materials',
    body: `<ol class="steps"><li>Go to <strong>Expenses</strong> and click <strong>+ Log expense</strong>.</li><li>Enter a description, the vendor, a category, the amount and the date.</li><li>Save.</li></ol>
<p>Expenses feed into your <a href="/articles/financial-reports">financial reports</a>.</p>` },
  { slug: 'financial-reports', topic: 'business-health', title: 'Financial reports', summary: 'Revenue, profit and loss, profit per job and unpaid invoices by age.', keywords: 'reports revenue profit loss p&l income statement job costing margin accounts receivable aging overdue unpaid charts analytics business health cash accrual',
    body: `<p><strong>Financial Reports</strong> shows how the business is doing. Pick a tab at the top:</p>
<ul><li><strong>Overview</strong>: revenue for the last 12 months from paid invoices, paid vs pending invoices, and your most popular services.</li>
<li><strong>Profit &amp; loss</strong>: income minus expenses for the dates you choose, by service and by expense category, with net profit by month. <em>Cash basis</em> counts income on the day it’s paid (deposits included, refunds taken off); <em>Accrual basis</em> counts it on the invoice date. Sales tax is shown on its own, since it’s owed to the state rather than income.</li>
<li><strong>Job profit</strong>: each job’s invoices (before tax, after discounts) against the expenses linked to it in <a href="/articles/expenses">Expenses</a>, with the margin. Link materials and subcontractor costs to their job to see what each one really made. With <a href="/articles/time-tracking">time tracking</a> and pay rates set, the hours clocked on a job are added as <strong>Labor</strong> next to its <strong>Expenses</strong>.</li>
<li><strong>Unpaid invoices</strong>: what clients owe you today, grouped by how long it’s been past due (not yet due, 1–30, 31–60, 61–90 and over 90 days), by client and by invoice.</li></ul>
<p>Each report has <strong>Export CSV</strong> for your accountant and <strong>Print</strong>. To keep QuickBooks Online or Xero up to date as well, see <a href="/articles/quickbooks-xero">Send your books to QuickBooks or Xero</a>.</p>` },
  { slug: 'quickbooks-xero', topic: 'business-health', title: 'Send your books to QuickBooks or Xero', summary: 'Clients, invoices, payments and expenses go to QuickBooks Online or Xero automatically.', keywords: 'quickbooks xero accounting bookkeeping books sync accountant intuit export integration',
    body: `<p>Connect QuickBooks Online or Xero in <strong>Settings → QuickBooks &amp; Xero</strong> (owners and admins), and {product} sends your records there, so you never type an invoice twice.</p>
<div class="note"><strong>Beta.</strong> QuickBooks &amp; Xero sync is new. Tell us how it works for you with <strong>Feedback</strong> in the top bar.</div>
<h2>Set it up</h2>
<ol><li>Choose <strong>Connect</strong> next to QuickBooks Online or Xero, sign in and pick your company.</li>
<li><strong>Send records dated from</strong>: only invoices and expenses from this day on are sent. Pick the day after your books were last brought up to date, so nothing is entered twice.</li>
<li>Choose where things go: the QuickBooks product/service (or Xero sales account) for invoice lines, the account payments are deposited to, and the account expenses are paid from. You can match each expense category to its own expense account.</li>
<li>Tick <strong>Send automatically</strong> and save.</li></ol>
<h2>What’s sent</h2>
<ul><li><strong>Clients</strong> become customers (QuickBooks) or contacts (Xero) when their first invoice goes over. One with the same name already there is used instead of adding a duplicate.</li>
<li><strong>Invoices</strong> (not drafts), with their lines, discount and sales tax. Edit one here and the change is sent too.</li>
<li><strong>Payments</strong> on those invoices, including a quote deposit credited to the invoice.</li>
<li><strong>Expenses</strong>, with the vendor, description and job.</li></ul>
<p>It runs every 15 minutes; <strong>Sync now</strong> sends right away. It’s one way: changes made in QuickBooks or Xero don’t come back here. Refunds and deletions aren’t sent, so record those in your accounting software yourself.</p>
<h2>When something can’t be sent</h2>
<p>It’s listed under <strong>Couldn’t be sent</strong> with the reason, usually a setting that still needs choosing. Fix it and choose <strong>Sync now</strong>. If QuickBooks or Xero signs you out, choose <strong>Connect again</strong>; nothing already sent is sent twice.</p>` },
  { slug: 'tax-summary', topic: 'business-health', title: 'Tax summary', summary: 'Sales tax collected by month, ready for your tax return.', keywords: 'sales tax summary vat collected export csv',
    body: `<p><strong>Tax Summary</strong> totals the sales tax on your paid invoices by month. Use <strong>Export CSV</strong> to send it to your accountant.</p>
<div class="note">Set your default tax rate in <a href="/articles/app-settings">App Settings</a>. You can change the rate on any quote or invoice.</div>` },

  /* ===== Team ===== */
  { slug: 'invite-team', topic: 'team', title: 'Add team members and invite them to log in', summary: 'Add your crew, then send each person an invite to their own login.', keywords: 'team staff employee add invite login user',
    body: `<ol class="steps"><li>Click the <strong>gear icon</strong> and choose <strong>Manage Team</strong>.</li><li>Click <strong>Add Team Member</strong> and enter their name, email, phone and a color (used on the calendar).</li><li>Under <strong>Login access</strong>, choose their <a href="/articles/access-levels">role</a> and click <strong>Invite to log in</strong>.</li></ol>
<p>They get an email with a link to choose a password. The link works for 7 days; you can also copy it and send it yourself.</p>
<h2>Turning off access</h2>
<p>Deactivate a team member to stop their login straight away. Their past jobs stay assigned to them.</p>
<div class="note">Each plan includes a number of logins, counting yours. On a plan with extra logins, such as Advanced, you can invite more people: before the invite goes out you’re shown what the extra login costs a month, and removing someone’s login access takes it off your bill. On other plans, move up a plan under <strong>Account and Billing</strong> when you reach the limit.</div>` },
  { slug: 'access-levels', topic: 'team', title: 'Roles and permissions', summary: 'Choose what each team role can see and do, or make roles of your own.', keywords: 'roles permissions access level admin manager technician owner custom role office',
    body: `<p>Every login has a role. The <strong>Owner</strong> and <strong>Admins</strong> always have full access; every other role has the permissions you give it.</p>
<table><thead><tr><th>Role</th><th>Can do</th></tr></thead><tbody>
<tr><td><strong>Owner</strong></td><td>Everything, including the plan and billing. There’s one owner per account.</td></tr>
<tr><td><strong>Admin</strong></td><td>Everything except the plan and billing: settings, team, money and all work.</td></tr>
<tr><td><strong>Manager</strong> (to start with)</td><td>Runs the work: clients, quotes, jobs and invoices, service plans, the Money section (payments, products &amp; services, expenses, reports and tax), the project gallery, Google reviews and social posts.</td></tr>
<tr><td><strong>Technician</strong> (to start with)</td><td>Sees the calendar, clients and jobs (without prices), and collects signatures.</td></tr>
</tbody></table>
<h2>Change what a role can do</h2>
<ol class="steps"><li>Click the <strong>gear icon</strong> and choose <strong>Roles &amp; Permissions</strong>.</li><li>Tick or untick permissions in a role’s column, such as <strong>See prices on jobs</strong> or <strong>Add and edit clients</strong>. Ticking one that needs another (editing clients needs seeing them) ticks that one too.</li><li>Click <strong>Save roles</strong>. Team members see the change the next time a page loads.</li></ol>
<h2>Make a new role</h2>
<p>Click <strong>+ Add role</strong>, give it a name and a short description, tick its permissions and save. You can remove a role once no one has it.</p>
<h2>Give someone a role</h2>
<p>Open the team member in <strong>gear → Manage Team</strong> and choose their role under <strong>Login access</strong>.</p>
<div class="note">Settings pages (company profile, app settings, team, roles, email templates, connections and billing) are for the Owner and Admins only. Everyone can use <a href="/articles/get-support">Get Support</a>, ask for <a href="/articles/time-off">time off</a>, clock in and see their own <a href="/articles/time-tracking">timesheet</a>, and manage their own <a href="/articles/support-access">Support Access</a>. Anyone who can edit jobs also manages everyone’s timesheets; pay rates are for the Owner and Admins only.</div>` },
  { slug: 'time-off', topic: 'team', title: 'Ask for and approve time off', summary: 'Team members request days or hours off; you approve or decline and reassign their jobs.', keywords: 'time off requests vacation sick day leave holiday approve decline off who is off',
    body: `<p><strong>Team Requests</strong>, under <strong>Settings → My Business</strong>, is where your team asks for time off and you decide. Approved time off shows on the <a href="/articles/job-calendar">Calendar</a>.</p>
<h2>Ask for time off</h2>
<ol class="steps"><li>Go to <strong>Settings → Team Requests</strong> and click <strong>Request time off</strong>. (From a job, use <strong>More → Request Off for This Job</strong> to start with that job’s day and hours.)</li><li>Leave <strong>All day</strong> ticked and choose the first and last day, or untick it to ask for certain hours on one day.</li><li>Give a reason. If you’re assigned to jobs then, they’re listed so your manager knows what needs covering.</li><li>Click <strong>Send request</strong>. You’ll get an email when it’s decided.</li></ol>
<p>Changed your plans? Click <strong>Cancel</strong> beside your request under <strong>Your requests</strong>.</p>
<h2>Approve or decline</h2>
<p>The owner, admins and anyone who can edit jobs get an email for each request, and see it under <strong>Waiting for you</strong>. The Requests link in the sidebar shows how many are waiting.</p>
<ol class="steps"><li>Click <strong>Approve</strong> or <strong>Decline</strong>.</li><li>When approving someone who’s assigned to jobs then, leave the box ticked to take them off those jobs, so you can give the work to someone else in Jobs.</li><li>Add a note if you like, and confirm.</li></ol>
<p><strong>Who’s off</strong> lists everyone with approved time off coming up.</p>
<div class="note">Time off requests are included on some plans.</div>` },

  { slug: 'time-tracking', topic: 'team', title: 'Clock in and out, and timesheets', summary: 'Your team clocks in on jobs; you check, fix and approve their hours and export them for payroll.', keywords: 'time tracking timesheet timesheets clock in clock out hours payroll overtime labor cost pay rate approve punch',
    body: `<p>Your team clocks in and out as they work, and their hours land on the <strong>Timesheets</strong> page. You check them, fix what’s wrong, approve them and export them for payroll. Hours on a job also count as labor cost in Job profit.</p>
<div class="note"><strong>Beta.</strong> Time tracking is new. Tell us how it works for you with <strong>Feedback</strong> in the top bar.</div>
<h2>How to clock in and out</h2>
<ul><li><strong>On a job</strong>: open the job and click <strong>Clock In</strong>. The job shows <strong>⏱ On the clock</strong> while you work. Click <strong>Clock Out</strong> when you’re done.</li><li><strong>Without a job</strong> (shop time, travel): go to <strong>Timesheets</strong>, leave Job as <strong>No job</strong> (or pick one of your jobs) and click <strong>Clock In</strong>.</li></ul>
<p>You can be on the clock for one thing at a time. Team members see only their own hours.</p>
<h2>How to check and approve the week (managers)</h2>
<ol class="steps"><li>Go to <strong>Timesheets</strong> in the sidebar. You see everyone’s hours for this week, by person; use the arrows to change week, or pick one person.</li><li>Look for warnings: hours over 40 in a week show as <strong>overtime</strong>, and an entry over 12 hours is flagged in case someone forgot to clock out.</li><li>Click <strong>Edit</strong> on an entry to fix its times, job or note, or delete it. Click <strong>Add time</strong> to add hours someone didn’t clock.</li><li>Click <strong>Approve</strong> on an entry, <strong>Approve</strong> next to a person for all their entries, or <strong>Approve all</strong>.</li><li>Click <strong>Export CSV</strong> to download the week for payroll.</li></ol>
<div class="tip">Changing an approved entry sends it back for approval.</div>
<h2>Pay rates and labor cost (owner and admins)</h2>
<p>Click <strong>Pay rates</strong> on Timesheets and enter what each person costs you an hour. Only the owner and admins see rates. Timesheets then shows the week’s labor cost, and hours clocked on a job show in <strong>Financial Reports → Job profit</strong> as labor. See <a href="/articles/financial-reports">Financial reports</a>.</p>
<p>Time tracking is on the Advanced and Unlimited plans. Managers are the owner, admins and anyone whose role can edit jobs. See <a href="/articles/access-levels">Roles and permissions</a>.</p>` },
  /* ===== Settings ===== */
  { slug: 'company-profile', topic: 'settings', title: 'Company profile and regional settings', summary: 'Your business details, time zone, date and time formats and business hours.', keywords: 'company profile business details address timezone date format time format week start hours',
    body: `<p>Open <strong>gear → Company Profile</strong>.</p>
<h2>Company details</h2>
<p>Your business name, email, phone, website and address appear on quotes, invoices, emails and the client portal. Add your social media pages under <strong>Social media</strong>, and your tax ID and default tax rate under <strong>Tax settings</strong>.</p>
<h2>Regional settings</h2>
<p>These are in <strong>gear → App Settings → Regional settings</strong>.</p>
<ul><li><strong>Time zone</strong>: used for the calendar and reminders.</li><li><strong>Date format</strong>: for example MM/DD/YYYY or DD/MM/YYYY.</li><li><strong>Time format</strong>: 12-hour (2:30 PM) or 24-hour (14:30).</li><li><strong>First day of the week</strong>: Sunday or Monday, for the calendar.</li></ul>
<h2>Business hours</h2>
<p>Your usual opening times.</p>` },
  { slug: 'app-settings', topic: 'settings', title: 'App settings: tax, numbering and branding', summary: 'Default tax rate, number prefixes, logo, brand color and other defaults.', keywords: 'app settings tax rate prefix numbering branding logo color icon defaults ai',
    body: `<p>Open <strong>gear → App Settings</strong>.</p>
<ul><li><strong>Tax settings</strong>: your default sales tax rate for new quotes and invoices.</li><li><strong>Number prefixes</strong> (if your plan includes them): the letters in front of quote, invoice and job numbers, such as <code>INV-</code>.</li><li><strong>Branding and defaults</strong>: your logo, brand color and accent color for your client portal (on plans with custom branding), plus default notes and payment terms.</li><li><strong>Zelle payments</strong>: see <a href="/articles/zelle">Accept Zelle payments</a>.</li></ul>
<p>This page also shows <strong>Your plan</strong> and what it includes.</p>` },
  { slug: 'custom-domain', topic: 'settings', title: 'Use your own domain', summary: 'Open {product} at your own web address, like app.yourbusiness.com.', keywords: 'custom domain web address dns cname own url',
    body: `<p>On plans with custom domains:</p>
<ol class="steps"><li>Go to <strong>gear → App Settings → Web address</strong> and add your domain, such as <code>app.yourbusiness.com</code>.</li><li>At your domain provider (GoDaddy, Namecheap, Cloudflare…), add the DNS record shown on the page.</li><li>Click <strong>Check now</strong>. DNS changes can take up to a few hours to work.</li><li>Once it’s connected, make it your main address if you want links in emails to use it.</li></ol>
<p>Your original address keeps working too.</p>` },
  { slug: 'dark-mode', topic: 'settings', title: 'Light and dark mode', summary: 'Switch {product} between light, dark and your device’s setting.', keywords: 'dark mode light theme appearance',
    body: `<p>Open <strong>gear → Preferences</strong> and choose <strong>System</strong> (follows your device), <strong>Light</strong> or <strong>Dark</strong>. The choice is saved in your browser.</p>
<p>Your clients always see their portal, quotes and invoices in light mode.</p>` },
  { slug: 'push-notifications', topic: 'settings', title: 'Push notifications', summary: 'Get notified on your phone or computer about today’s work, requests and quotes.', keywords: 'push notifications alerts phone preferences',
    body: `<p>Open <strong>gear → Preferences</strong> and turn on <strong>Notifications on this device</strong>, then choose which ones you want. Do this on each phone or computer you use. Logging out turns them off on that device.</p>
<p>On an iPhone or iPad, first add {product} to your Home Screen (Share → Add to Home Screen) and open it from there. This needs iOS 16.4 or later.</p>
<ul><li><strong>Today’s work overview</strong>: around 7 AM your time, if there are jobs today. The owner and admins get the whole team’s count; everyone else gets their own.</li><li><strong>Today’s schedule changed</strong>: a job today is added, moved, reassigned or cancelled. Goes to the people on the job, the owner and admins, not whoever made the change.</li><li><strong>New request</strong> and <strong>New online booking</strong>: a client asks for work.</li><li><strong>Client viewed quote</strong>: the first time a client opens a sent quote.</li><li><strong>Client approved quote</strong>: a client approves a quote.</li></ul>` },

  /* ===== Account ===== */
  { slug: 'plans-billing', topic: 'account', title: 'Your plan, billing and changing plans', summary: 'See your plan, switch plans, update your card and cancel.', keywords: 'plan billing subscription upgrade downgrade card cancel price',
    body: `<p>Only the account owner can manage billing. Open <strong>gear → Account and Billing</strong>.</p>
<h2>Change plan</h2>
<ol class="steps"><li>Under <strong>Change subscription</strong>, click <strong>Modify subscription</strong> and pick a plan and monthly or yearly billing.</li><li>The page explains exactly what you’ll be charged or credited before you confirm.</li></ol>
<p>Upgrading charges the difference for the rest of the current period. Moving to a free plan takes effect when your paid period ends.</p>
<p>Each plan includes a number of team logins, counting yours. On a plan with extra logins, such as Advanced, each login past the included ones is billed with your plan, monthly or yearly; <strong>Account and Billing</strong> shows how many you have. To move to a plan with fewer logins and no extras, first remove login access for the extra team members (<strong>Manage team</strong> → open a team member → <strong>Remove login access</strong>). Their team member details and work history stay.</p>
<h2>Your price stays yours</h2>
<p>If we raise a plan’s price, accounts already on that plan keep the price they have for as long as they stay on it, including when they switch between monthly and yearly billing. The same goes for a sale price, such as Early Bird: subscribe while the sale is on and you keep it after the sale ends. <strong>Account and Billing</strong> shows when your price is locked. Moving to a different plan uses that plan’s current price.</p>
<h2>Text messages each month</h2>
<p>Each plan with text messages includes a number of texts a month, shown on the pricing page. <strong>Account and Billing</strong> shows how many you’ve sent this month.</p>
<ul><li><strong>What counts:</strong> every text that goes out to a client: quotes, invoices, appointment reminders, On My Way texts, automations, the message confirming a client signed up for texts, and test texts. Each one counts once, however long it is.</li><li><strong>What doesn’t:</strong> emails, and texts that don’t go out (for example to a client who hasn’t agreed to texts).</li><li><strong>Before you run out:</strong> when 80% of the month’s texts are used, the account owner gets an email and owners and admins see a note at the top of the app with how many are left. Closing the note hides it for the rest of the month.</li><li><strong>When you reach the limit:</strong> texts don’t go out until the 1st of next month, and you’ll see a message saying so when you try. Emails keep going. The account owner gets an email as soon as the last text goes out, and owners and admins see a note at the top of the app.</li><li><strong>Each month:</strong> the count starts again on the 1st. Texts you didn’t use don’t carry over.</li></ul>
<p>Need more texts this month? Move up a plan under <strong>Change subscription</strong>. The new plan’s limit applies right away.</p>
<h2>Card and billing details</h2>
<p>Update the card on file and the name, email and address on your bills. See past bills under <strong>Payment history</strong>.</p>
<h2>Cancel</h2>
<ol class="steps"><li>Under <strong>Change subscription</strong>, click <strong>Modify subscription</strong>, then <strong>Show more → Cancel plan</strong>.</li><li>Tell us why you’re leaving. Depending on your answer, we may offer help getting set up, a tour with a specialist, a longer free trial or a discount.</li><li>Leave a short note on what we could do better, then enter your password to confirm.</li></ol>
<p>Cancelling stops future charges. Everything keeps working until the end of the period you’ve paid for; after that the account is paused and your data is kept, so you can come back.</p>
<p>From <strong>Modify subscription</strong> you can also upgrade, downgrade, or extend a free trial by 7 days, once, when it has 5 days or fewer left. Paid and prepaid accounts can’t extend.</p>` },
  { slug: 'my-profile-password', topic: 'account', title: 'Your profile and password', summary: 'Update your name, photo, email and working hours, and change your password.', keywords: 'profile password change photo name email personal',
    body: `<p>Click your name at the bottom of the sidebar to open <strong>My profile</strong>.</p>
<ul><li><strong>Personal info</strong>: your name, email, phone and photo.</li><li><strong>Working hours</strong>: the hours you usually work.</li><li><strong>Change password</strong>: enter your current password and a new one.</li></ul>
<p>Locked out? Use <strong>Forgot password?</strong> on the login page. See <a href="/articles/logging-in">Logging in</a>.</p>` },
  { slug: 'refer-earn', topic: 'account', title: 'Refer & Earn', summary: 'Invite other businesses to {product} and earn credit when they subscribe.', keywords: 'refer referral earn rewards credit free month invite friend business share link',
    body: `<p>Know another business that would like {product}? Open <strong>gear → Refer &amp; Earn</strong> (or <strong>Refer &amp; earn</strong> in the top bar).</p>
<h2>Invite someone</h2>
<ul><li>Click <strong>Copy your referral link</strong> and send it however you like, or use the email, Facebook, LinkedIn and X buttons to share it.</li><li>Or enter their first name, company and email and click <strong>Invite</strong>. We send them one email with your link. Only invite people you know and who are happy to hear from us.</li></ul>
<h2>Your rewards</h2>
<p>You earn credit on your plan for every business that subscribes through your link, and some programs add milestone rewards as you refer more. The page shows the credit you’ve earned and how much is left.</p>
<div class="note">Refer &amp; Earn shows only while the referral program is running. This is for referring other businesses; to have your clients refer friends to you, see <a href="/articles/referrals">Referral links</a>.</div>` },

  /* ===== Getting Help ===== */
  { slug: 'get-support', topic: 'getting-help', title: 'Contact support', summary: 'Send our support team a message from inside {product} or from this help center.', keywords: 'contact support help email message ticket problem',
    body: `<h2>From inside {product}</h2>
<ol class="steps"><li>Click the <strong>?</strong> in the top bar.</li><li>Click <strong>Get Support</strong>.</li><li>Pick a topic, describe what happened, and click <strong>Send message</strong>.</li></ol>
<p>Your business name, plan and the page you were on are included automatically, so we can help faster. We reply by email.</p>
<h2>Can’t log in?</h2>
<p>Use the <a href="/contact">contact form</a> on this help center.</p>
<div class="tip">The more detail the better: what you clicked, what you expected and what happened instead.</div>` },
  { slug: 'forum-feedback', topic: 'getting-help', title: 'Suggest features and report issues', summary: 'Post feature requests and vote on the Ideas site, or send us private feedback.', keywords: 'board boards forum categories feedback feature request idea suggestion issue bug vote like community',
    body: `<h2>The Ideas site</h2>
<p>Go to the <a href="{ideas}/feedback">Ideas site</a> to see what other businesses are asking for. Pick a board, such as Invoices or Calendar &amp; Scheduling, to see the requests about that part of the app. If you’re logged in to {product}, you’re logged in there too.</p>
<ul><li>Post a feature request on the board it’s about.</li><li>Vote for the requests you agree with. The most-voted ideas get our attention first.</li><li>The <strong>Roadmap</strong> shows what’s planned, in progress, in beta and done, and the <strong>Changelog</strong> shows what’s new.</li><li>Each post shows where it stands: New, Under review, Planned, In progress, Beta, Done or Not planned.</li></ul>
<div class="note">Posting and voting are for account owners and admins.</div>
<h2>Private feedback</h2>
<p>Want to tell us something just between us? Click <strong>Feedback</strong> in the top bar and send a message. Need help with a problem? Use <a href="/articles/get-support">Get Support</a> instead, so we can reply.</p>` },
  { slug: 'support-access', topic: 'getting-help', title: 'Give support temporary access to your account', summary: 'Let our team sign in as you to troubleshoot, for four weeks or until you revoke it.', keywords: 'support access grant revoke troubleshoot permission login as',
    body: `<p>Sometimes the quickest way for us to fix a problem is to see exactly what you see. We never get into your account without your permission.</p>
<h2>Grant access</h2>
<ol class="steps"><li>When we ask for access, you get an email. Open <strong>gear → Support Access</strong> (or the <strong>?</strong> menu → <strong>Support Access</strong>).</li><li>Read the request and click <strong>Grant Access</strong>, or <strong>Decline</strong>.</li></ol>
<p>Access lasts four weeks. While it’s on, our team can sign in as you, with your access level, and you’ll see that it’s a support session.</p>
<h2>Revoke access</h2>
<p>Click <strong>Revoke Access</strong> on the same page at any time. Anyone from support who is signed in is signed out straight away. Account owners can also revoke access their team members have granted.</p>
<p>Every request, and when it ended, is listed under <strong>Previous Requests</strong>.</p>` },
];
