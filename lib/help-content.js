'use strict';
// The help center's starting content: copied into the platform store (platform.json → help) the first time it's needed;
// after that, edit articles in the platform console → Help Center. {product} becomes the product name.
// Articles are plain HTML: <h2> sections, <ol class="steps"> for steps, <div class="note"> / <div class="tip"> callouts.
exports.topics = [
  { slug: 'get-started', icon: 'rocket', title: 'Get Started', desc: 'Hand-picked guides to get {product} set up and running for your business.' },
  { slug: 'schedule', icon: 'calendar', title: 'Schedule', desc: 'Plan your work on the calendar, set working hours and remind clients about visits.' },
  { slug: 'work', icon: 'briefcase', title: 'Work', desc: 'Every step of your workflow: quotes, jobs, invoices, signatures and photos.' },
  { slug: 'clients', icon: 'users', title: 'Clients', desc: 'Add, import and organize clients and their properties, and see what they see in their client portal.' },
  { slug: 'client-communications', icon: 'mail', title: 'Client Communications', desc: 'Emailing and texting quotes and invoices, email templates and the notifications log.' },
  { slug: 'marketing', icon: 'megaphone', title: 'Marketing', desc: 'Google reviews, online booking, social media posts and the apps you connect.' },
  { slug: 'payments', icon: 'card', title: 'Payments', desc: 'Take card payments with Stripe, accept Zelle and record payments you receive.' },
  { slug: 'business-health', icon: 'chart', title: 'Business Health', desc: 'Track expenses, read your financial reports and pull your sales tax summary.' },
  { slug: 'team', icon: 'team', title: 'Team', desc: 'Add team members, set up roles and permissions, and handle time off requests.' },
  { slug: 'settings', icon: 'gear', title: 'Settings', desc: 'Company profile, regional settings, tax, numbering, branding and your web address.' },
  { slug: 'account', icon: 'user', title: 'Account', desc: 'Your plan and billing, your personal profile, password and login.' },
  { slug: 'getting-help', icon: 'help', title: 'Getting Help', desc: 'Contact support, suggest features in the forum and give our team temporary access to troubleshoot.' },
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
<p>Under <strong>gear → App Settings → Card payments</strong>, connect Stripe so clients can pay by card. Emails and texts to your clients are sent for you in your business name, so there’s nothing to set up for them. See <a href="/articles/stripe-card-payments">Accept card payments</a>.</p>
<h2>6. Connect your marketing accounts</h2>
<p>Connect your Google Business Profile, Facebook Page and Instagram in <strong>gear → Account Connections</strong> to reply to Google reviews, take online bookings and post photos of your work. See <a href="/articles/account-connections">Connect Google, Facebook and Instagram</a>.</p>
<div class="tip">New here? Click the <strong>?</strong> in the top bar and choose <strong>Take a tour of the app</strong> for a one-minute walk around. Not sure where something is? Press <kbd>/</kbd> anywhere in {product} and type what you’re looking for.</div>` },
  { slug: 'finding-your-way', topic: 'get-started', title: 'Finding your way around {product}', summary: 'The sidebar, the top bar search, the help menu and the settings menu.', keywords: 'navigation menu sidebar top bar search layout where',
    body: `<h2>The sidebar</h2>
<p>The left sidebar holds your day-to-day pages, grouped into sections:</p>
<ul><li><strong>Operations</strong>: Home, Calendar, Requests (time off), Clients, Quotes, Jobs and Invoices.</li><li><strong>Money</strong>: Payments, Products &amp; Services, Expenses, Financial Reports and Tax Summary.</li><li><strong>Marketing</strong>: Reviews and Social Posts.</li><li><strong>Records</strong>: Project Gallery and the Notifications Log.</li></ul>
<p>At the bottom you’ll find your name (which opens <a href="/articles/my-profile-password">your profile</a>) and <strong>Log out</strong>.</p>
<h2>The top bar</h2>
<ul><li><strong>Search</strong>: type a feature name, like “invoice” or “logo”, and press <kbd>Enter</kbd> to jump to it. Press <kbd>/</kbd> or <kbd>⌘</kbd> <kbd>K</kbd> (<kbd>Ctrl</kbd> <kbd>K</kbd> on Windows) from anywhere to start searching.</li><li><strong>Forum</strong> and <strong>Feedback</strong>: suggest features and report issues. See <a href="/articles/forum-feedback">Suggest features and report issues</a>.</li><li><strong>Help (?)</strong>: opens a panel with quick guides, <strong>Take a tour of the app</strong>, a link to this help center and <strong>Get Support</strong>.</li><li><strong>Gear</strong>: all of your settings pages: Company Profile, Manage Team, Roles &amp; Permissions, Email Templates, App Settings, Account Connections, App Marketplace, Account and Billing, Refer &amp; Earn and Support Access.</li></ul>
<h2>Take the tour</h2>
<p>The first time you log in, {product} offers a short tour that points out the menu, search, help and settings. Take it again any time from <strong>? → Take a tour of the app</strong>.</p>
<h2>On a phone</h2>
<p>Your most-used pages sit in a bar along the bottom of the screen; tap <strong>More</strong> for the full menu. See <a href="/articles/using-on-phone">Using {product} on your phone</a>.</p>
<div class="note">You only see the pages your role and plan include. If a page you expect is missing, ask your account owner. See <a href="/articles/access-levels">Roles and permissions</a>.</div>` },
  { slug: 'using-on-phone', topic: 'get-started', title: 'Using {product} on your phone', summary: 'The bottom menu, adding quotes, jobs and invoices, and choosing a client on a small screen.', keywords: 'phone mobile iphone android tablet app bottom bar small screen field',
    body: `<p>{product} works in your phone’s web browser, so there’s nothing to install. Open your account’s web address and log in. Add it to your home screen from your browser’s share menu to open it like an app.</p>
<h2>Getting around</h2>
<ul><li>The <strong>bottom bar</strong> holds your most-used pages, such as Home, Calendar, Quotes and Jobs. Tap <strong>More</strong> for every other page.</li><li>The top bar shows your company logo (or name). Tap the <strong>?</strong> for help and the <strong>gear</strong> for settings.</li></ul>
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
  { slug: 'job-calendar', topic: 'schedule', title: 'Using the calendar', summary: 'See everyone’s jobs, tasks and events by week or day, add new ones and drag them to reschedule.', keywords: 'calendar schedule schedules week day view appointments visits tasks events drag reschedule',
    body: `<p><strong>Calendar</strong> in the sidebar shows every job, task and event on a time grid, with the client and the team members assigned.</p>
<h2>Change the view</h2>
<ul><li>Switch between <strong>Day</strong> and <strong>Week</strong> at the top right.</li><li>Use the arrows to move back and forward, <strong>Today</strong> to jump back to now, or pick a date on the small month calendar.</li><li>Untick a team member under <strong>Team calendars</strong> to hide their work.</li></ul>
<h2>Add a job, task or event</h2>
<ol class="steps"><li>Click a time on the calendar. A small form opens with that date and time filled in. (Drag it by its top bar to move it out of the way.)</li><li>Choose <strong>Job</strong>, <strong>Task</strong> or <strong>Event</strong>, then add a title and, for a job, the client.</li><li>Click <strong>Save</strong>, or <strong>More Options</strong> to finish a job on the full job form.</li></ol>
<h2>Reschedule</h2>
<p>Drag anything on the calendar to another day or time. It keeps its length and saves straight away. Drop it on the <strong>Anytime</strong> row to make it an all-day item.</p>
<div class="tip">The week starts on the day set in <strong>App Settings → Regional settings</strong>. See <a href="/articles/company-profile">Company profile</a>.</div>` },
  { slug: 'appointment-reminders', topic: 'schedule', title: 'Send appointment reminders', summary: 'Remind a client about an upcoming visit by email or text.', keywords: 'reminder remind appointment notify client visit',
    body: `<ol class="steps"><li>Open the job from <strong>Jobs</strong> or the <strong>Calendar</strong>.</li><li>Click <strong>More</strong>, then under <strong>Send as…</strong> choose <strong>Email Reminder</strong> (or <strong>Text Reminder</strong> on plans with texting). {product} sends the client a reminder with the job title, date, time and address.</li></ol>
<p>Reminders go by text message if your plan includes texting and the client has <a href="/articles/text-messages">agreed to receive texts</a>, otherwise by email. The wording comes from the <strong>Appointment reminder</strong> template. See <a href="/articles/email-templates">Customize email templates</a>.</p>
<div class="note">If no email or text provider is connected yet, the reminder is recorded in the <a href="/articles/notifications-log">Notifications Log</a> but not delivered.</div>` },

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
<ol class="steps"><li>Go to <strong>Jobs</strong> and click <strong>New Job</strong>, or click a time on the <a href="/articles/job-calendar">Calendar</a>.</li><li>Choose the client (and, if they have several, the property). The property address fills in from the client; change it if the work is somewhere else.</li><li>Enter a title and description, the date, and start and end times.</li><li>Tick the team members doing the work.</li><li>Add line items if you want them carried onto the invoice.</li><li>Click <strong>Save</strong>.</li></ol>
<h2>The job page</h2>
<p>Open a job to see it laid out in cards: details, line items, the scheduled visit and notes. Click the <strong>pencil</strong> on a card to change just that part. The <strong>More</strong> menu holds <strong>Create Invoice</strong>, <strong>Collect Signature</strong>, the email or text <a href="/articles/appointment-reminders">reminder</a>, <strong>Request Off for This Job</strong>, <strong>Open Calendar</strong> and <strong>Delete</strong>.</p>
<h2>Job statuses</h2>
<ul><li><strong>Upcoming</strong> / <strong>Today</strong>: scheduled work.</li><li><strong>Late</strong>: the date has passed and the job isn’t completed.</li><li><strong>Requires invoicing</strong>: completed, with no invoice yet.</li><li><strong>Archived</strong> and <strong>Cancelled</strong>: finished or called off.</li></ul>
<h2>Finish the job</h2>
<p>Click <strong>Mark Complete</strong> when the work is done, then <strong>More → Create Invoice</strong> to bill it. Changed your mind? <strong>Reopen</strong> puts it back on the schedule. See <a href="/articles/create-send-invoice">Create and send an invoice</a>.</p>` },
  { slug: 'job-signatures', topic: 'work', title: 'Collect a client’s signature on a job', summary: 'Have your client sign on your phone or tablet when the work is done.', keywords: 'signature sign on-site approval completion',
    body: `<ol class="steps"><li>Open the job on your phone, tablet or computer.</li><li>Click <strong>More → Collect Signature</strong>.</li><li>Check the statement the client is agreeing to (you can edit it), then hand over the device.</li><li>The client signs with a finger or mouse and you click <strong>Save</strong>.</li></ol>
<p>The signature is saved on the job with the date. Technicians can collect signatures; only managers and admins can remove one.</p>
<div class="note">On-site signatures are included on most plans. If you don’t see the button, check your plan.</div>` },
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
<tr><td><strong>Job</strong></td><td>Create Invoice, Collect Signature, Send as… (Email or Text Reminder), Request Off for This Job, Open Calendar, Delete</td></tr>
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
<ul><li><strong>Properties</strong>: every address you work at for this client. Click one to open it, or the pin to see it on a map.</li><li><strong>Contacts</strong>: other people at this client.</li><li><strong>Work overview</strong>: their requests, quotes, jobs and invoices, with filters.</li><li><strong>Billing</strong>: invoices and payments, and the current balance.</li><li><strong>Client schedule</strong>: their visits and tasks. Click <strong>+</strong> to schedule a job or task.</li></ul>
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
<h2>In their portal, clients can see</h2>
<ul><li><strong>Requests</strong>: send you a new work request with the details you need.</li><li><strong>Estimates</strong>: their quotes, to view and approve.</li><li><strong>Appointments</strong>: their upcoming and past visits.</li><li><strong>Invoices</strong>: what they owe and what they’ve paid.</li><li><strong>Wallet</strong>: their payments.</li><li><strong>Contact Us</strong>: your business contact details.</li></ul>
<p>If your plan includes referrals, clients can also share a referral link. See <a href="/articles/referrals">Referral links</a>.</p>
<div class="note">The portal always shows in light mode with your logo and accent color, so it looks like your business.</div>` },
  { slug: 'referrals', topic: 'clients', title: 'Referral links', summary: 'Let happy clients share a link; the people they refer arrive as leads.', keywords: 'referral refer friend share leads marketing',
    body: `<p>On plans with referrals, every client gets a <strong>Share your referral link</strong> page in their <a href="/articles/client-portal">client portal</a>. When someone opens the link and sends a request, they arrive in your Clients list as a <strong>lead</strong>, so you can follow up with a quote. If they ticked the box to get text messages, their profile shows they’ve <a href="/articles/text-messages">agreed to receive texts</a>.</p>` },

  /* ===== Client Communications ===== */
  { slug: 'email-templates', topic: 'client-communications', title: 'Customize email templates', summary: 'Change the wording of quote, invoice and reminder emails using placeholders.', keywords: 'email template wording customize message variables placeholders',
    body: `<ol class="steps"><li>Click the <strong>gear icon</strong> and choose <strong>Email Templates</strong>.</li><li>Pick a template: <strong>Quote</strong>, <strong>Invoice</strong>, <strong>Appointment reminder</strong>, <strong>Payment receipt</strong> or <strong>Client portal login</strong>.</li><li>Edit the subject and body. Click a placeholder to insert it.</li><li>Check the preview and save.</li></ol>
<p>The templates are where each email starts. When you email a quote or invoice, you can still change the subject and message for that one client before it goes. See <a href="/articles/send-email-text">Email or text a quote or invoice</a>.</p>
<h2>Placeholders</h2>
<p>Placeholders like <code>{{client_name}}</code>, <code>{{company_name}}</code>, <code>{{total}}</code>, <code>{{due_date}}</code> and <code>{{link}}</code> are swapped for the real details when the email is sent. A few more that are handy:</p>
<ul><li><code>{{company_email}}</code>: your business email, so clients know where to send questions. Works in every template.</li><li><code>{{sent_date}}</code>: the day the quote or invoice is sent, such as “the total as of {{sent_date}}”.</li></ul>
<p>Keep <code>{{link}}</code> in quote and invoice emails so clients can open them online.</p>
<div class="tip">Changed your mind? Use <strong>Reset</strong> to go back to the original wording.</div>` },
  { slug: 'text-messages', topic: 'client-communications', title: 'Send text messages', summary: 'Text quotes, invoices and reminders to clients.', keywords: 'sms text message twilio phone number consent opt in agree stop unsubscribe',
    body: `<p>On plans with text messages, you can send quotes, invoices and appointment reminders by text. There’s nothing to set up: {product} sends them for you, starting with your business name and ending with “Reply STOP to opt out.”</p>
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

  /* ===== Marketing ===== */
  { slug: 'account-connections', topic: 'marketing', title: 'Connect Google, Facebook and Instagram', summary: 'Link your Google Business Profile, Facebook Page and Instagram account to {product}.', keywords: 'account connections connect google business profile facebook page instagram link disconnect social',
    body: `<p>Connect the accounts your business already uses, so you can reply to Google reviews, take bookings from Google and post your work to Facebook and Instagram without leaving {product}.</p>
<ol class="steps"><li>Click the <strong>gear icon</strong> and choose <strong>Account Connections</strong>.</li><li>Click <strong>Connect</strong> beside Google Business Profile, Facebook Business Page or Instagram account.</li><li>Sign in and allow access. If you manage more than one profile or page, choose the one for this business; you can <strong>Change</strong> it later.</li></ol>
<h2>What you need</h2>
<ul><li><strong>Google</strong>: a Google Business Profile you own or manage.</li><li><strong>Facebook</strong>: full admin permissions for the business Page.</li><li><strong>Instagram</strong>: a professional account, either Business or Creator.</li></ul>
<h2>Once connected</h2>
<ul><li>Google shows its features below it: <a href="/articles/google-reviews">Reviews</a> and <a href="/articles/online-booking">Online booking</a>, each with a <strong>Manage</strong> button.</li><li>Facebook and Instagram let you post from <a href="/articles/social-posts">Social Posts</a>.</li></ul>
<p>Click <strong>Disconnect</strong> at any time to unlink an account.</p>
<div class="note">Only the account owner and admins can connect accounts. Account connections, Google reviews and social posts are included on some plans; if you don’t see them, check your plan under <strong>Account and Billing</strong>.</div>` },
  { slug: 'google-reviews', topic: 'marketing', title: 'Read and reply to Google reviews', summary: 'See all your Google reviews in one place, reply to them and ask happy clients for more.', keywords: 'google reviews stars rating reply respond business profile review link ask',
    body: `<p><strong>Reviews</strong> in the sidebar shows the reviews on your Google Business Profile. Connect your profile first in <a href="/articles/account-connections">Account Connections</a>.</p>
<h2>Reply to a review</h2>
<ol class="steps"><li>Open <strong>Reviews</strong>. The <strong>Needs a reply</strong> tab lists reviews you haven’t answered yet.</li><li>Click <strong>Reply</strong> under a review and write your reply.</li><li>Click <strong>Post reply</strong>.</li></ol>
<p>Your reply shows publicly on Google under the review. Use <strong>Edit</strong> or <strong>Delete</strong> to change or remove it; deleting it takes it off Google too.</p>
<h2>Ask for reviews</h2>
<p>At the top of the page are your average rating and your <strong>review link</strong>. Click <strong>Copy</strong> and send it to happy clients: it opens Google’s review form for your business.</p>
<div class="tip">Reply to every review, good or bad. A short, friendly thank-you shows future clients you care.</div>
<div class="note">Anyone whose role includes <strong>Google reviews</strong> can reply. See <a href="/articles/access-levels">Roles and permissions</a>.</div>` },
  { slug: 'online-booking', topic: 'marketing', title: 'Take bookings online', summary: 'Share your booking page and add a Book button to Google so new clients can ask for a visit.', keywords: 'online booking book button google request lead website booking page schedule appointment new clients',
    body: `<p>Your booking page lets new clients ask for a visit any time. Each request arrives in <strong>Clients</strong> as a lead, and you get an email so you can follow up with a quote.</p>
<h2>Turn it on</h2>
<ol class="steps"><li><a href="/articles/account-connections">Connect your Google Business Profile</a> in <strong>gear → Account Connections</strong>.</li><li>Under Google, find <strong>Online booking</strong> and click <strong>Manage</strong>.</li><li>Turn on <strong>Show a Book button on Google</strong> and click <strong>Save</strong>. Google can take a few hours to show it on your profile in Search and Maps.</li></ol>
<h2>Share your booking page</h2>
<p>The same box shows your booking page’s link. Click <strong>Copy</strong> and add it to your website, social media bio or email signature.</p>
<p>When clients book, they can tick a box to get text messages from you. If they do, their profile shows they’ve <a href="/articles/text-messages">agreed to receive texts</a>, and the lead source is set to <strong>Online booking</strong>.</p>` },
  { slug: 'social-posts', topic: 'marketing', title: 'Post your work to Facebook and Instagram', summary: 'Share project photos with a caption on your Facebook Page and Instagram in one go.', keywords: 'social posts facebook instagram post photos marketing before after caption share',
    body: `<p>Before-and-after photos make great posts. <strong>Social Posts</strong> in the sidebar posts them to your Facebook Page and Instagram account at the same time. Connect them first in <a href="/articles/account-connections">Account Connections</a>.</p>
<h2>Make a post</h2>
<ol class="steps"><li>Open <strong>Social Posts</strong> and tick where to post: Facebook, Instagram or both.</li><li>Click <strong>Choose from Project Gallery</strong> to use photos from your jobs, or <strong>Upload photos</strong>. Add up to 10; the first one is the cover.</li><li>Write a caption (up to 2,200 characters).</li><li>Click <strong>Post now</strong>.</li></ol>
<p>Your posts are listed under <strong>Posted</strong>, with a link to view each one. If a post didn’t go through, the reason is shown under it.</p>
<div class="note">Instagram posts need at least one photo.</div>
<div class="tip">Keep your <a href="/articles/job-photos">Project Gallery</a> up to date and you’ll always have something to post.</div>` },
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
  { slug: 'financial-reports', topic: 'business-health', title: 'Financial reports', summary: 'Revenue by month, paid vs pending, popular services and team productivity.', keywords: 'reports revenue profit charts analytics business health',
    body: `<p><strong>Financial Reports</strong> shows how the business is doing:</p>
<ul><li>Total monthly revenue for the last 12 months, from paid invoices.</li><li>Paid vs pending invoices.</li><li>Your most popular services.</li><li>Client acquisition: new clients over time.</li><li>Team productivity: completed jobs per month.</li></ul>
<p>The <strong>Home</strong> page also shows a quick overview of what needs your attention today.</p>` },
  { slug: 'tax-summary', topic: 'business-health', title: 'Tax summary', summary: 'Sales tax collected by month, ready for your tax return.', keywords: 'sales tax summary vat collected export csv',
    body: `<p><strong>Tax Summary</strong> totals the sales tax on your paid invoices by month. Use <strong>Export CSV</strong> to send it to your accountant.</p>
<div class="note">Set your default tax rate in <a href="/articles/app-settings">App Settings</a>. You can change the rate on any quote or invoice.</div>` },

  /* ===== Team ===== */
  { slug: 'invite-team', topic: 'team', title: 'Add team members and invite them to log in', summary: 'Add your crew, then send each person an invite to their own login.', keywords: 'team staff employee add invite login user',
    body: `<ol class="steps"><li>Click the <strong>gear icon</strong> and choose <strong>Manage Team</strong>.</li><li>Click <strong>Add Team Member</strong> and enter their name, email, phone and a color (used on the calendar).</li><li>Under <strong>Login access</strong>, choose their <a href="/articles/access-levels">role</a> and click <strong>Invite to log in</strong>.</li></ol>
<p>They get an email with a link to choose a password. The link works for 7 days; you can also copy it and send it yourself.</p>
<h2>Turning off access</h2>
<p>Deactivate a team member to stop their login straight away. Their past jobs stay assigned to them.</p>
<div class="note">The number of logins depends on your plan. If you’ve reached the limit, upgrade under <strong>Account and Billing</strong>.</div>` },
  { slug: 'access-levels', topic: 'team', title: 'Roles and permissions', summary: 'Choose what each team role can see and do, or make roles of your own.', keywords: 'roles permissions access level admin manager technician owner custom role office',
    body: `<p>Every login has a role. The <strong>Owner</strong> and <strong>Admins</strong> always have full access; every other role has the permissions you give it.</p>
<table><thead><tr><th>Role</th><th>Can do</th></tr></thead><tbody>
<tr><td><strong>Owner</strong></td><td>Everything, including the plan and billing. There’s one owner per account.</td></tr>
<tr><td><strong>Admin</strong></td><td>Everything except the plan and billing: settings, team, money and all work.</td></tr>
<tr><td><strong>Manager</strong> (to start with)</td><td>Runs the work: clients, quotes, jobs and invoices, the Money section (payments, products &amp; services, expenses, reports and tax), the project gallery, Google reviews and social posts.</td></tr>
<tr><td><strong>Technician</strong> (to start with)</td><td>Sees the calendar, clients and jobs (without prices), and collects signatures.</td></tr>
</tbody></table>
<h2>Change what a role can do</h2>
<ol class="steps"><li>Click the <strong>gear icon</strong> and choose <strong>Roles &amp; Permissions</strong>.</li><li>Tick or untick permissions in a role’s column, such as <strong>See prices on jobs</strong> or <strong>Add and edit clients</strong>. Ticking one that needs another (editing clients needs seeing them) ticks that one too.</li><li>Click <strong>Save roles</strong>. Team members see the change the next time a page loads.</li></ol>
<h2>Make a new role</h2>
<p>Click <strong>+ Add role</strong>, give it a name and a short description, tick its permissions and save. You can remove a role once no one has it.</p>
<h2>Give someone a role</h2>
<p>Open the team member in <strong>gear → Manage Team</strong> and choose their role under <strong>Login access</strong>.</p>
<div class="note">Settings pages (company profile, app settings, team, roles, email templates, connections and billing) are for the Owner and Admins only. Everyone can use <a href="/articles/get-support">Get Support</a>, ask for <a href="/articles/time-off">time off</a> and manage their own <a href="/articles/support-access">Support Access</a>.</div>` },
  { slug: 'time-off', topic: 'team', title: 'Ask for and approve time off', summary: 'Team members request days or hours off; you approve or decline and reassign their jobs.', keywords: 'time off requests vacation sick day leave holiday approve decline off who is off',
    body: `<p><strong>Requests</strong> in the sidebar is where your team asks for time off and you decide. Approved time off shows on the <a href="/articles/job-calendar">Calendar</a>.</p>
<h2>Ask for time off</h2>
<ol class="steps"><li>Go to <strong>Requests</strong> and click <strong>Request time off</strong>. (From a job, use <strong>More → Request Off for This Job</strong> to start with that job’s day and hours.)</li><li>Leave <strong>All day</strong> ticked and choose the first and last day, or untick it to ask for certain hours on one day.</li><li>Give a reason. If you’re assigned to jobs then, they’re listed so your manager knows what needs covering.</li><li>Click <strong>Send request</strong>. You’ll get an email when it’s decided.</li></ol>
<p>Changed your plans? Click <strong>Cancel</strong> beside your request under <strong>Your requests</strong>.</p>
<h2>Approve or decline</h2>
<p>The owner, admins and anyone who can edit jobs get an email for each request, and see it under <strong>Waiting for you</strong>. The Requests link in the sidebar shows how many are waiting.</p>
<ol class="steps"><li>Click <strong>Approve</strong> or <strong>Decline</strong>.</li><li>When approving someone who’s assigned to jobs then, leave the box ticked to take them off those jobs, so you can give the work to someone else in Jobs.</li><li>Add a note if you like, and confirm.</li></ol>
<p><strong>Who’s off</strong> lists everyone with approved time off coming up.</p>
<div class="note">Time off requests are included on some plans.</div>` },

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
<ol class="steps"><li>Click <strong>Change subscription</strong> and pick a plan and monthly or yearly billing.</li><li>The page explains exactly what you’ll be charged or credited before you confirm.</li></ol>
<p>Upgrading charges the difference for the rest of the current period. Moving to a free plan takes effect when your paid period ends.</p>
<p>Each plan includes a number of team logins, counting yours. To move to a plan with fewer logins than you use now, first remove login access for the extra team members (<strong>Manage team</strong> → open a team member → <strong>Remove login access</strong>). Their team member details and work history stay.</p>
<h2>Card and billing details</h2>
<p>Update the card on file and the name, email and address on your bills. See past bills under <strong>Payment history</strong>.</p>
<h2>Cancel</h2>
<p>Cancelling stops future charges. Everything keeps working until the end of the period you’ve paid for; after that the account is paused and your data is kept, so you can come back.</p>` },
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
  { slug: 'forum-feedback', topic: 'getting-help', title: 'Suggest features and report issues', summary: 'Post ideas and issues in the forum, vote on others, or send us private feedback.', keywords: 'forum feedback feature request idea suggestion issue bug vote like community',
    body: `<h2>The forum</h2>
<p>Click <strong>Forum</strong> in the top bar to see what other businesses are asking for.</p>
<ul><li>Post a <strong>Feature request</strong> or an <strong>Issue</strong>.</li><li>Like the posts you agree with and add comments. The most-liked ideas get our attention first.</li><li>Each post shows where it stands: New, Under review, Planned, In progress, Done or Not planned.</li></ul>
<div class="note">The forum is for account owners and admins.</div>
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
