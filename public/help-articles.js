'use strict';
// Help center content: topics and articles. {product} is replaced with the product name set in the platform console.
// Articles are plain HTML: <h2> sections, <ol class="steps"> for steps, <div class="note"> / <div class="tip"> callouts.
window.HELP_TOPICS = [
  { slug: 'get-started', icon: 'rocket', title: 'Get Started', desc: 'Hand-picked guides to get {product} set up and running for your business.' },
  { slug: 'schedule', icon: 'calendar', title: 'Schedule', desc: 'Plan your work on the job calendar, set working hours and remind clients about visits.' },
  { slug: 'work', icon: 'briefcase', title: 'Work', desc: 'Every step of your workflow: quotes, jobs, invoices, signatures and photos.' },
  { slug: 'clients', icon: 'users', title: 'Clients', desc: 'Add, import and organize clients, and see what they see in their client portal.' },
  { slug: 'client-communications', icon: 'mail', title: 'Client Communications', desc: 'Email templates, text messages, your own sending address and the notifications log.' },
  { slug: 'payments', icon: 'card', title: 'Payments', desc: 'Take card payments with Stripe, accept Zelle and record payments you receive.' },
  { slug: 'business-health', icon: 'chart', title: 'Business Health', desc: 'Track expenses, read your financial reports and pull your sales tax summary.' },
  { slug: 'team', icon: 'team', title: 'Team', desc: 'Add team members, invite them to log in and choose what each person can access.' },
  { slug: 'settings', icon: 'gear', title: 'Settings', desc: 'Company profile, regional settings, tax, numbering, branding and your web address.' },
  { slug: 'account', icon: 'user', title: 'Account', desc: 'Your plan and billing, your personal profile, password and login.' },
  { slug: 'getting-help', icon: 'help', title: 'Getting Help', desc: 'Contact support and give our team temporary access to troubleshoot an issue.' },
];

window.HELP_POPULAR = ['first-steps', 'create-send-quote', 'stripe-card-payments'];
window.HELP_SUGGESTED = ['How do I create and send a quote?', 'How do I invite my team?', 'What do my clients see in the client portal?'];

window.HELP_ARTICLES = [
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
<p>If others work with you, add them under <strong>gear → Manage Team</strong> and invite them to log in. See <a href="/articles/invite-team">Add team members</a>.</p>
<h2>5. Connect payments and messages</h2>
<p>Under <strong>gear → Account Connections</strong>, connect Stripe to take card payments, and connect email or text messaging so messages come from you. See <a href="/articles/stripe-card-payments">Accept card payments</a>.</p>
<div class="tip">Not sure where something is? Press <kbd>/</kbd> anywhere in {product} and type what you’re looking for.</div>` },
  { slug: 'finding-your-way', topic: 'get-started', title: 'Finding your way around {product}', summary: 'The sidebar, the top bar search, the help menu and the settings menu.', keywords: 'navigation menu sidebar top bar search layout where',
    body: `<h2>The sidebar</h2>
<p>The left sidebar holds your day-to-day pages, grouped into three sections:</p>
<ul><li><strong>Operations</strong>: Home, Job Calendar, Staff Schedules, Clients, Quotes, Jobs and Invoices.</li><li><strong>Money</strong>: Payments, Products &amp; Services, Expenses, Financial Reports and Tax Summary.</li><li><strong>Records</strong>: Project Gallery and the Notifications Log.</li></ul>
<p>At the bottom you’ll find the light/dark theme switch, your name (which opens <a href="/articles/my-profile-password">your profile</a>) and <strong>Log out</strong>. On a phone, tap <strong>☰</strong> to open the sidebar.</p>
<h2>The top bar</h2>
<ul><li><strong>Search</strong>: type a feature name, like “invoice” or “logo”, and press <kbd>Enter</kbd> to jump to it. Press <kbd>/</kbd> or <kbd>⌘</kbd> <kbd>K</kbd> (<kbd>Ctrl</kbd> <kbd>K</kbd> on Windows) from anywhere to start searching.</li><li><strong>Help (?)</strong>: opens a panel with quick guides, a link to this help center and <strong>Get Support</strong>.</li><li><strong>Gear</strong>: all of your settings pages: Company Profile, Manage Team, Email Templates, App Settings, Account Connections, Account and Billing, and Support Access.</li></ul>
<div class="note">You only see the pages your access level and plan include. If a page you expect is missing, ask your account owner. See <a href="/articles/access-levels">Access levels</a>.</div>` },
  { slug: 'logging-in', topic: 'get-started', title: 'Logging in and your account’s web address', summary: 'Where to log in, accepting an invite and resetting a forgotten password.', keywords: 'login sign in url address subdomain forgot password reset invite',
    body: `<p>Every business on {product} has its own web address, such as <code>yourbusiness.workliopro.com</code>. You, your team and your clients all use that address.</p>
<h2>Accepting an invite</h2>
<ol class="steps"><li>Open the invite email and click the link. Invite links work for 7 days.</li><li>Choose a password (at least 8 characters).</li><li>You’re logged in. Bookmark the address for next time.</li></ol>
<h2>Forgot your password?</h2>
<ol class="steps"><li>Go to your account’s login page and click <strong>Forgot password?</strong></li><li>Enter your email. If it matches a login, we email you a reset link.</li><li>Open the link and choose a new password.</li></ol>
<div class="note">Didn’t get the email? Check your spam folder. If you’re a team member, your account owner can send you a new invite from <strong>Manage Team</strong>.</div>` },

  /* ===== Schedule ===== */
  { slug: 'job-calendar', topic: 'schedule', title: 'Using the job calendar', summary: 'See your jobs by month, week or day and schedule new work right from the calendar.', keywords: 'calendar schedule month week day view appointments visits',
    body: `<p><strong>Job Calendar</strong> in the sidebar shows every scheduled job with its time, client and the team members assigned.</p>
<h2>Change the view</h2>
<ul><li>Switch between <strong>Month</strong>, <strong>Week</strong> and <strong>Day</strong> at the top of the calendar.</li><li>Use the arrows to move back and forward, and <strong>Today</strong> to jump back to now.</li></ul>
<h2>Schedule a job from the calendar</h2>
<ol class="steps"><li>Click the day number on the calendar. A new job opens with that date filled in. (Click an existing job to edit it.)</li><li>Choose the client, add a title, start and end times, and tick the team members doing the work.</li><li>Click <strong>Save</strong>. The job appears on the calendar straight away.</li></ol>
<div class="tip">The week starts on the day set in <strong>Company Profile → Regional settings</strong>. See <a href="/articles/company-profile">Company profile</a>.</div>` },
  { slug: 'staff-schedules', topic: 'schedule', title: 'Staff schedules and working hours', summary: 'See who is working when, and set each team member’s usual hours.', keywords: 'staff schedule availability hours roster working time',
    body: `<p><strong>Staff Schedules</strong> shows each team member’s week at a glance: their working hours and the jobs they’re assigned to.</p>
<h2>Set working hours</h2>
<ol class="steps"><li>Go to <strong>gear → Manage Team</strong> and open a team member.</li><li>Under <strong>Schedule → Working hours</strong>, set the days and times they usually work.</li><li>Save. Their hours now show on Staff Schedules.</li></ol>
<p>Team members can also set their own hours from <a href="/articles/my-profile-password">their profile</a>.</p>
<div class="note">Staff Schedules is included on some plans. If you don’t see it, check your plan under <strong>gear → Account and Billing</strong>.</div>` },
  { slug: 'appointment-reminders', topic: 'schedule', title: 'Send appointment reminders', summary: 'Remind a client about an upcoming visit by email or text.', keywords: 'reminder remind appointment notify client visit',
    body: `<ol class="steps"><li>Open the job from <strong>Jobs</strong> or the <strong>Job Calendar</strong>.</li><li>Click <strong>Email reminder to client</strong> (or <strong>Text reminder to client</strong> on plans with texting). {product} sends the client a reminder with the job title, date, time and address.</li></ol>
<p>Reminders go by text message if your plan includes texting, otherwise by email. The wording comes from the <strong>Appointment reminder</strong> template. See <a href="/articles/email-templates">Customize email templates</a>.</p>
<div class="note">If no email or text provider is connected yet, the reminder is recorded in the <a href="/articles/notifications-log">Notifications Log</a> but not delivered.</div>` },

  /* ===== Work ===== */
  { slug: 'create-send-quote', topic: 'work', title: 'Create and send a quote', summary: 'Build a quote with line items, tax and discounts, then send it for your client to approve online.', keywords: 'quote estimate proposal create send approve price',
    body: `<h2>Create the quote</h2>
<ol class="steps"><li>Go to <strong>Quotes</strong> and click <strong>New quote</strong> (or open a client and choose <strong>New quote</strong>).</li><li>Choose the client and give the quote a title.</li><li>Add line items. Start typing a product or service name to fill it in from your catalog, or type a new one. Each line has a quantity, a cost and a markup (a percentage or a flat amount); {product} works out the price.</li><li>Set the tax rate and, if you like, a discount (percentage or amount, taken off before tax).</li><li>Add any notes and your contract or disclaimer text.</li><li>Click <strong>Save</strong>.</li></ol>
<h2>Send it</h2>
<ol class="steps"><li>Open the quote and click <strong>Send</strong>.</li><li>Check the message and send it by email, or by text if your plan includes texting.</li></ol>
<p>Your client gets a link to view the quote online, where they can <strong>Approve</strong> or <strong>Decline</strong> it. You’ll see the new status on the Quotes page.</p>
<div class="tip">Want money up front? <a href="/articles/quote-deposits">Request a deposit</a> before you send. Once it’s approved, <a href="/articles/quote-to-job">turn the quote into a job</a>.</div>` },
  { slug: 'quote-deposits', topic: 'work', title: 'Request a deposit on a quote', summary: 'Ask for a percentage or fixed deposit that the client pays when they approve.', keywords: 'deposit upfront down payment quote advance',
    body: `<ol class="steps"><li>Open the quote.</li><li>Set the <strong>deposit</strong> as a percentage of the total or a fixed amount. The balance after the deposit is shown below.</li><li>Save and send the quote.</li></ol>
<p>When your client approves the quote, they’re asked to sign it and pay the deposit. With <a href="/articles/stripe-card-payments">Stripe connected</a> they can pay by card; with <a href="/articles/zelle">Zelle</a> turned on they can pay that way.</p>
<h2>Deposit paid another way?</h2>
<p>If the client paid by cash, check or another method, open the quote and use <strong>Record deposit payment</strong>. The deposit is credited when you invoice the job.</p>` },
  { slug: 'quote-to-job', topic: 'work', title: 'Turn an approved quote into a job', summary: 'Schedule the work from an approved quote without retyping anything.', keywords: 'convert quote job schedule approved',
    body: `<ol class="steps"><li>Open the approved quote and click <strong>Create job</strong>.</li><li>Pick the date and start and end times, and tick the team members to assign.</li><li>Click <strong>Create job</strong>. The new job copies the client, title and line items from the quote and appears on the calendar.</li></ol>
<p>The quote is marked as converted so you can tell it’s already been scheduled.</p>` },
  { slug: 'create-job', topic: 'work', title: 'Create and schedule a job', summary: 'Add a job, assign your team and track it from upcoming to invoiced.', keywords: 'job work order create schedule assign complete status',
    body: `<h2>Create a job</h2>
<ol class="steps"><li>Go to <strong>Jobs</strong> and click <strong>New job</strong>, or click a day on the <a href="/articles/job-calendar">Job Calendar</a>.</li><li>Choose the client, enter a title and description, the date, start and end times, and the address.</li><li>Tick the team members doing the work.</li><li>Add line items if you want them carried onto the invoice.</li><li>Click <strong>Save</strong>.</li></ol>
<h2>Job statuses</h2>
<ul><li><strong>Upcoming</strong> / <strong>Today</strong>: scheduled work.</li><li><strong>Late</strong>: the date has passed and the job isn’t completed.</li><li><strong>Requires invoicing</strong>: completed, with no invoice yet.</li><li><strong>Archived</strong> and <strong>Cancelled</strong>: finished or called off.</li></ul>
<h2>Finish the job</h2>
<p>Click <strong>Mark complete</strong> when the work is done, then <strong>Create invoice</strong> to bill it. See <a href="/articles/create-send-invoice">Create and send an invoice</a>.</p>` },
  { slug: 'job-signatures', topic: 'work', title: 'Collect a client’s signature on a job', summary: 'Have your client sign on your phone or tablet when the work is done.', keywords: 'signature sign on-site approval completion',
    body: `<ol class="steps"><li>Open the job on your phone, tablet or computer.</li><li>Click <strong>Collect signature</strong>.</li><li>Check the statement the client is agreeing to (you can edit it), then hand over the device.</li><li>The client signs with a finger or mouse and you click <strong>Save</strong>.</li></ol>
<p>The signature is saved on the job with the date. Technicians can collect signatures; only managers and admins can remove one.</p>
<div class="note">On-site signatures are included on most plans. If you don’t see the button, check your plan.</div>` },
  { slug: 'job-photos', topic: 'work', title: 'Add photos to jobs and the project gallery', summary: 'Keep before, progress and after photos for every job in one place.', keywords: 'photos pictures images gallery before after',
    body: `<ol class="steps"><li>Go to <strong>Project Gallery</strong> in the sidebar.</li><li>Click <strong>+ Upload photos</strong>, choose the job they belong to, and pick the type: before, progress or after. Add a caption if you like.</li><li>Open any photo to see it full size, or delete it.</li></ol>
<p>Photos are a great record for warranty questions and for showing off your work.</p>` },
  { slug: 'create-send-invoice', topic: 'work', title: 'Create and send an invoice', summary: 'Bill a finished job or start from scratch, set payment terms and send a pay link.', keywords: 'invoice bill create send due date terms',
    body: `<h2>From a job</h2>
<ol class="steps"><li>Open the completed job and click <strong>Create invoice</strong>. A draft invoice opens with the job’s client and line items, and any deposit already paid is credited.</li><li>Check the details and click <strong>Save</strong>.</li></ol>
<h2>From scratch</h2>
<ol class="steps"><li>Go to <strong>Invoices</strong> and click <strong>New invoice</strong>.</li><li>Choose the client and add line items, tax and any discount.</li><li>Choose the <strong>payment terms</strong> (Due upon receipt, Net 7, 14, 15, 30, 45 or 60, or a custom date). The due date fills in for you.</li><li>Click <strong>Save</strong>.</li></ol>
<h2>Send it</h2>
<p>Click <strong>Send</strong> to email or text the invoice. Your client gets a link to view it and, if you’ve <a href="/articles/stripe-card-payments">connected Stripe</a>, pay by card online.</p>` },
  { slug: 'record-payment', topic: 'work', title: 'Record a payment on an invoice', summary: 'Log cash, check, Zelle and other payments, including part payments.', keywords: 'payment record mark paid partial cash check collect',
    body: `<p>Card payments made online through Stripe are recorded automatically. For anything else:</p>
<ol class="steps"><li>Open the invoice and click <strong>Collect payment</strong>.</li><li>Enter the amount (it starts at the balance owed), the date and the method: cash, check, card, bank payment, Zelle, Cash App, PayPal, Venmo or other.</li><li>Click <strong>Save</strong>.</li></ol>
<p>If the amount is less than the balance, the invoice stays open and shows what’s still owed. When the balance reaches zero the invoice is marked <strong>paid</strong>.</p>
<div class="tip">Recorded the wrong amount? Open the invoice, find the payment in its payment list and delete it, then record it again.</div>` },
  { slug: 'products-services', topic: 'work', title: 'Products & services catalog', summary: 'Save what you sell with costs and markups so quotes and invoices fill in for you.', keywords: 'products services catalog price list items markup ai description',
    body: `<ol class="steps"><li>Go to <strong>Products &amp; Services</strong> in the sidebar and click <strong>+ Add Item</strong>.</li><li>Enter the name, a description, the cost and your markup (percentage or flat amount).</li><li>Save. Next time you type its name on a quote or invoice, the details fill in.</li></ol>
<h2>Write with AI</h2>
<p>On plans with AI descriptions, click <strong>Write with AI</strong> on a product or service to draft a description from its name. Edit it as you like before saving. You can turn this off in <strong>App Settings</strong>.</p>` },

  /* ===== Clients ===== */
  { slug: 'add-clients', topic: 'clients', title: 'Add and manage clients', summary: 'Add clients, find them fast and keep their details up to date.', keywords: 'client customer add edit search filter export lead',
    body: `<h2>Add a client</h2>
<ol class="steps"><li>Go to <strong>Clients</strong> and click <strong>New Client</strong>.</li><li>Enter their name, email, phone and address. Phone numbers format as you type.</li><li>Save.</li></ol>
<h2>Find clients</h2>
<p>Use the search box and filters on the Clients page to narrow the list by status or tag, and sort by any column. Click a client to see their details, quotes, jobs and invoices.</p>
<h2>Export</h2>
<p>Need your list elsewhere? Use <strong>Export to CSV</strong> on the Clients page to download your list.</p>
<div class="tip">Have a list in a spreadsheet already? <a href="/articles/import-clients">Import clients from a CSV file</a>.</div>` },
  { slug: 'import-clients', topic: 'clients', title: 'Import clients from a CSV file', summary: 'Bring your existing client list in from a spreadsheet in three steps.', keywords: 'import csv spreadsheet excel upload clients bulk',
    body: `<ol class="steps"><li>Go to <strong>Clients</strong> and choose <strong>Import</strong> (or search for “Import clients”).</li><li><strong>Choose a CSV file.</strong> Save your spreadsheet as CSV first. Use <strong>Download a sample file</strong> to see the layout.</li><li><strong>Match the columns.</strong> Tell {product} which column holds the name, email, phone, address and so on.</li><li><strong>Review and import.</strong> Check the preview and click Import.</li></ol>
<div class="note">After importing, run <a href="/articles/merge-clients">Merge duplicate clients</a> to tidy up anyone who was already in {product}.</div>` },
  { slug: 'merge-clients', topic: 'clients', title: 'Merge duplicate clients', summary: 'Combine duplicate profiles into one so history stays in one place.', keywords: 'merge duplicate combine clients cleanup',
    body: `<ol class="steps"><li>On the <strong>Clients</strong> page, use the <strong>Merge duplicate clients</strong> card. It shows clients that share an email, phone number or name.</li><li>Tick the profiles that are the same client.</li><li>Click <strong>Merge</strong> and choose which details to keep.</li></ol>
<p>Their quotes, jobs and invoices move to the merged profile.</p>` },
  { slug: 'client-portal', topic: 'clients', title: 'What clients see in the client portal', summary: 'Your clients’ own page for visits, quotes, invoices, payments and requests.', keywords: 'client portal hub self service requests estimates appointments wallet',
    body: `<p>Every client gets a private portal link. Find it on the client’s profile under <strong>Client portal link</strong> and share it with them.</p>
<h2>In their portal, clients can see</h2>
<ul><li><strong>Requests</strong>: send you a new work request with the details you need.</li><li><strong>Estimates</strong>: their quotes, to view and approve.</li><li><strong>Appointments</strong>: their upcoming and past visits.</li><li><strong>Invoices</strong>: what they owe and what they’ve paid.</li><li><strong>Wallet</strong>: their payments.</li><li><strong>Contact Us</strong>: your business contact details.</li></ul>
<p>If your plan includes referrals, clients can also share a referral link. See <a href="/articles/referrals">Referral links</a>.</p>
<div class="note">The portal always shows in light mode with your logo and brand color, so it looks like your business.</div>` },
  { slug: 'referrals', topic: 'clients', title: 'Referral links', summary: 'Let happy clients share a link; the people they refer arrive as leads.', keywords: 'referral refer friend share leads marketing',
    body: `<p>On plans with referrals, every client gets a <strong>Share your referral link</strong> page in their <a href="/articles/client-portal">client portal</a>. When someone opens the link and sends a request, they arrive in your Clients list as a <strong>lead</strong>, so you can follow up with a quote.</p>` },

  /* ===== Client Communications ===== */
  { slug: 'email-templates', topic: 'client-communications', title: 'Customize email templates', summary: 'Change the wording of quote, invoice and reminder emails using placeholders.', keywords: 'email template wording customize message variables placeholders',
    body: `<ol class="steps"><li>Click the <strong>gear icon</strong> and choose <strong>Email Templates</strong>.</li><li>Pick a template: <strong>Quote</strong>, <strong>Invoice</strong> or <strong>Appointment reminder</strong>.</li><li>Edit the subject and body. Click a placeholder to insert it.</li><li>Check the preview and save.</li></ol>
<h2>Placeholders</h2>
<p>Placeholders like <code>{{client_name}}</code>, <code>{{company_name}}</code>, <code>{{total}}</code>, <code>{{due_date}}</code> and <code>{{link}}</code> are swapped for the real details when the email is sent. Keep <code>{{link}}</code> in quote and invoice emails so clients can open them online.</p>
<div class="tip">Changed your mind? Use <strong>Reset</strong> to go back to the original wording.</div>` },
  { slug: 'text-messages', topic: 'client-communications', title: 'Send text messages with Twilio', summary: 'Text quotes, invoices and reminders to clients from your own number.', keywords: 'sms text message twilio phone number',
    body: `<p>On plans with text messages, you can send quotes, invoices and appointment reminders by text.</p>
<ol class="steps"><li>Go to <strong>gear → Account Connections</strong> and open <strong>Twilio text messages</strong>.</li><li>Enter your Twilio account details and the phone number to send from.</li><li>Send yourself a test message to check it works.</li></ol>
<div class="note">Client phone numbers need to be correct, including the area code. Numbers starting with + are treated as international.</div>` },
  { slug: 'connect-email', topic: 'client-communications', title: 'Send email from your own address', summary: 'Connect Gmail, SendGrid or SMTP so client emails come from your business.', keywords: 'email gmail sendgrid smtp sender from address connect',
    body: `<ol class="steps"><li>Go to <strong>gear → Account Connections</strong> and open the email connection.</li><li>Choose <strong>Gmail</strong>, <strong>SendGrid</strong> or <strong>SMTP</strong> and enter the details it asks for.</li><li>Send a test message, then save.</li></ol>
<p>Once connected, quotes, invoices and reminders are sent from your address, and client replies come straight to you.</p>` },
  { slug: 'notifications-log', topic: 'client-communications', title: 'The notifications log', summary: 'See every email and text {product} sent, and whether it was delivered.', keywords: 'notifications log sent emails texts delivered failed history',
    body: `<p><strong>Notifications Log</strong> in the sidebar lists every email and text sent to clients: who it went to, what it was about and its status.</p>
<ul><li><strong>Sent</strong>: delivered to the email or text provider.</li><li><strong>Failed</strong>: something went wrong. Open it to see why, such as a missing email address.</li><li><strong>Simulated</strong>: recorded but not delivered, because no email or text provider is connected yet.</li></ul>
<p>Click any entry to read the full message.</p>` },

  /* ===== Payments ===== */
  { slug: 'stripe-card-payments', topic: 'payments', title: 'Accept card payments with Stripe', summary: 'Let clients pay invoices and deposits by card, straight into your Stripe account.', keywords: 'stripe card credit debit online payments connect pay',
    body: `<ol class="steps"><li>Go to <strong>gear → Account Connections</strong> and find <strong>Stripe</strong>.</li><li>Click <strong>Connect</strong> and follow Stripe’s steps to create or link your account.</li><li>When you come back, Stripe shows as connected.</li></ol>
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
    body: `<ol class="steps"><li>Click the <strong>gear icon</strong> and choose <strong>Manage Team</strong>.</li><li>Click <strong>Add Team Member</strong> and enter their name, email, phone and a color (used on the calendar).</li><li>Under <strong>Login access</strong>, choose their <a href="/articles/access-levels">access level</a> and click <strong>Invite to log in</strong>.</li></ol>
<p>They get an email with a link to choose a password. The link works for 7 days; you can also copy it and send it yourself.</p>
<h2>Turning off access</h2>
<p>Deactivate a team member to stop their login straight away. Their past jobs stay assigned to them.</p>
<div class="note">The number of logins depends on your plan. If you’ve reached the limit, upgrade under <strong>Account and Billing</strong>.</div>` },
  { slug: 'access-levels', topic: 'team', title: 'Access levels: Admin, Manager and Technician', summary: 'What each access level can see and do.', keywords: 'roles permissions access level admin manager technician owner',
    body: `<table><thead><tr><th>Level</th><th>Can do</th></tr></thead><tbody>
<tr><td><strong>Owner</strong></td><td>Everything, including the plan and billing. There’s one owner per account.</td></tr>
<tr><td><strong>Admin</strong></td><td>Everything except the plan and billing: settings, team, money and all work.</td></tr>
<tr><td><strong>Manager</strong></td><td>Runs the work: clients, quotes, jobs and invoices, plus the Money section (payments, products &amp; services, expenses, reports and tax). Can’t change settings or the team.</td></tr>
<tr><td><strong>Technician</strong></td><td>Sees the schedule, clients and the jobs (without prices), and collects signatures. Can’t see quotes, invoices or money.</td></tr>
</tbody></table>
<p>Change someone’s level in <strong>gear → Manage Team</strong>. Everyone, at every level, can use <a href="/articles/get-support">Get Support</a> and their own <a href="/articles/support-access">Support Access</a> page.</p>` },

  /* ===== Settings ===== */
  { slug: 'company-profile', topic: 'settings', title: 'Company profile and regional settings', summary: 'Your business details, time zone, date and time formats and business hours.', keywords: 'company profile business details address timezone date format time format week start hours',
    body: `<p>Open <strong>gear → Company Profile</strong>.</p>
<h2>Company details</h2>
<p>Your business name, email, phone, website and address appear on quotes, invoices, emails and the client portal.</p>
<h2>Regional settings</h2>
<ul><li><strong>Time zone</strong>: used for the calendar and reminders.</li><li><strong>Date format</strong>: for example MM/DD/YYYY or DD/MM/YYYY.</li><li><strong>Time format</strong>: 12-hour (2:30 PM) or 24-hour (14:30).</li><li><strong>First day of the week</strong>: Sunday or Monday, for the calendar.</li></ul>
<h2>Business hours</h2>
<p>Your usual opening times.</p>` },
  { slug: 'app-settings', topic: 'settings', title: 'App settings: tax, numbering and branding', summary: 'Default tax rate, number prefixes, logo, brand color and other defaults.', keywords: 'app settings tax rate prefix numbering branding logo color icon defaults ai',
    body: `<p>Open <strong>gear → App Settings</strong>.</p>
<ul><li><strong>Tax settings</strong>: your default sales tax rate for new quotes and invoices.</li><li><strong>Number prefixes</strong>: the letters in front of quote, invoice and job numbers, such as <code>INV-</code>.</li><li><strong>Branding and defaults</strong>: your logo, brand color and browser icon (on plans with custom branding), plus default notes and payment terms.</li><li><strong>Zelle payments</strong>: see <a href="/articles/zelle">Accept Zelle payments</a>.</li><li><strong>AI assistance</strong>: turn “Write with AI” on or off.</li></ul>
<p>This page also shows <strong>Your plan</strong> and what it includes.</p>` },
  { slug: 'custom-domain', topic: 'settings', title: 'Use your own domain', summary: 'Open {product} at your own web address, like app.yourbusiness.com.', keywords: 'custom domain web address dns cname own url',
    body: `<p>On plans with custom domains:</p>
<ol class="steps"><li>Go to <strong>gear → App Settings → Web address</strong> and add your domain, such as <code>app.yourbusiness.com</code>.</li><li>At your domain provider (GoDaddy, Namecheap, Cloudflare…), add the DNS record shown on the page.</li><li>Click <strong>Check now</strong>. DNS changes can take up to a few hours to work.</li><li>Once it’s connected, make it your main address if you want links in emails to use it.</li></ol>
<p>Your original address keeps working too.</p>` },
  { slug: 'dark-mode', topic: 'settings', title: 'Light and dark mode', summary: 'Switch {product} between light, dark and your device’s setting.', keywords: 'dark mode light theme appearance',
    body: `<p>At the bottom of the sidebar, choose <strong>☀ Light</strong>, <strong>☾ Dark</strong> or <strong>◐ Auto</strong> (follows your device). The choice is saved in your browser.</p>
<p>Your clients always see their portal, quotes and invoices in light mode.</p>` },

  /* ===== Account ===== */
  { slug: 'plans-billing', topic: 'account', title: 'Your plan, billing and changing plans', summary: 'See your plan, switch plans, update your card and cancel.', keywords: 'plan billing subscription upgrade downgrade card cancel price',
    body: `<p>Only the account owner can manage billing. Open <strong>gear → Account and Billing</strong>.</p>
<h2>Change plan</h2>
<ol class="steps"><li>Click <strong>Change subscription</strong> and pick a plan and monthly or yearly billing.</li><li>The page explains exactly what you’ll be charged or credited before you confirm.</li></ol>
<p>Upgrading charges the difference for the rest of the current period. Moving to a free plan takes effect when your paid period ends.</p>
<h2>Card and billing details</h2>
<p>Update the card on file and the name, email and address on your bills. See past bills under <strong>Payment history</strong>.</p>
<h2>Cancel</h2>
<p>Cancelling stops future charges. Everything keeps working until the end of the period you’ve paid for; after that the account is paused and your data is kept, so you can come back.</p>` },
  { slug: 'my-profile-password', topic: 'account', title: 'Your profile and password', summary: 'Update your name, photo, email and working hours, and change your password.', keywords: 'profile password change photo name email personal',
    body: `<p>Click your name at the bottom of the sidebar to open <strong>My profile</strong>.</p>
<ul><li><strong>Personal info</strong>: your name, email, phone and photo.</li><li><strong>Working hours</strong>: the hours you usually work, shown on Staff Schedules.</li><li><strong>Change password</strong>: enter your current password and a new one.</li></ul>
<p>Locked out? Use <strong>Forgot password?</strong> on the login page. See <a href="/articles/logging-in">Logging in</a>.</p>` },

  /* ===== Getting Help ===== */
  { slug: 'get-support', topic: 'getting-help', title: 'Contact support', summary: 'Send our support team a message from inside {product} or from this help center.', keywords: 'contact support help email message ticket problem',
    body: `<h2>From inside {product}</h2>
<ol class="steps"><li>Click the <strong>?</strong> in the top bar.</li><li>Click <strong>Get Support</strong>.</li><li>Pick a topic, describe what happened, and click <strong>Send message</strong>.</li></ol>
<p>Your business name, plan and the page you were on are included automatically, so we can help faster. We reply by email.</p>
<h2>Can’t log in?</h2>
<p>Use the <a href="/contact">contact form</a> on this help center.</p>
<div class="tip">The more detail the better: what you clicked, what you expected and what happened instead.</div>` },
  { slug: 'support-access', topic: 'getting-help', title: 'Give support temporary access to your account', summary: 'Let our team sign in as you to troubleshoot, for four weeks or until you revoke it.', keywords: 'support access grant revoke troubleshoot permission login as',
    body: `<p>Sometimes the quickest way for us to fix a problem is to see exactly what you see. We never get into your account without your permission.</p>
<h2>Grant access</h2>
<ol class="steps"><li>When we ask for access, you get an email. Open <strong>gear → Support Access</strong> (or the <strong>?</strong> menu → <strong>Support Access</strong>).</li><li>Read the request and click <strong>Grant Access</strong>, or <strong>Decline</strong>.</li></ol>
<p>Access lasts four weeks. While it’s on, our team can sign in as you, with your access level, and you’ll see that it’s a support session.</p>
<h2>Revoke access</h2>
<p>Click <strong>Revoke Access</strong> on the same page at any time. Anyone from support who is signed in is signed out straight away. Account owners can also revoke access their team members have granted.</p>
<p>Every request, and when it ended, is listed under <strong>Previous Requests</strong>.</p>` },
];
