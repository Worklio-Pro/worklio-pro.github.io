// Terms of Service (/terms) and Privacy Policy (/privacy): one page each, served on every address (the platform site,
// every account, and the help center). Names and contact details come from the platform console's Settings.
// Edit the wording here; bump UPDATED when you change it. Have a lawyer review it before relying on it.
const tenancy = require('./tenancy');

const UPDATED = 'October 25, 2026';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function info() {
  const s = tenancy.platform().settings;
  const product = esc(s.productName || 'the service'); const company = esc(s.legalName || s.productName || 'we');
  const email = s.contactEmail ? `<a href="mailto:${esc(s.contactEmail)}">${esc(s.contactEmail)}</a>` : 'the contact form in our help center';
  return { product, company, email, law: esc(s.governingLaw || ''), help: esc(tenancy.helpUrl()) };
}

const terms = ({ product, company, email, law, help }) => `
<p>These Terms of Service (“Terms”) are an agreement between you and ${company} (“we”, “us”) for the use of ${product}, our software for running a service business: quotes, scheduling, jobs, invoices, payments, client messages and the related websites, apps and support (together, the “Service”). By creating an account, logging in or using the Service, you agree to these Terms. If you use the Service for a business, you agree on behalf of that business and confirm you’re allowed to.</p>

<h2 id="accounts">1. Accounts</h2>
<ul><li>Each business gets its own account and web address. The person who creates it is the <strong>account owner</strong> and is responsible for the account, its plan and billing, and everyone they give a login to.</li>
<li>Keep your password secret and your contact details accurate. You’re responsible for activity under your logins; tell us right away if you think someone else has used one.</li>
<li>You must be at least 18 and able to form a binding contract to use the Service.</li></ul>

<h2 id="your-data">2. Your data and your clients’ data</h2>
<ul><li><strong>You own your data.</strong> Everything you and your team put into the Service, including your clients’ names, contact details, addresses, quotes, jobs, invoices, photos and signatures (“Customer Data”), belongs to you.</li>
<li>You give us permission to host, process, transmit and display Customer Data only as needed to provide, secure, support and improve the Service, and as described in our <a href="/privacy">Privacy Policy</a>.</li>
<li>You’re responsible for having the right to collect and use Customer Data, including giving any notices and getting any consents the law requires before you add someone’s details or message them.</li>
<li>You can export your clients, quotes, jobs and invoices at any time from inside the Service.</li></ul>

<h2 id="messages">3. Emails and text messages to your clients</h2>
<p>The Service lets you send quotes, invoices, reminders and other messages by email and text. You are the sender of those messages and are responsible for them. You agree to send messages only to people who have agreed to receive them, to honor opt-out requests (such as replies of “STOP”), and to follow the laws that apply to commercial email and text messaging, including the U.S. CAN-SPAM Act and Telephone Consumer Protection Act where they apply.</p>
<p id="sms"><strong>If you get texts from a business that uses ${product}:</strong> you get them because you agreed to, for example on the business’s booking or request form or by telling the business. They are about your own service: quotes, invoices, payment links and appointment reminders, never marketing. Message frequency varies with your requests and appointments. Msg &amp; data rates may apply. Reply <strong>STOP</strong> to any message to stop getting texts, or <strong>HELP</strong> for help. You can also contact the business directly, or us at ${email}. Carriers aren’t liable for delayed or undelivered messages. Your mobile number and opt-in are never shared or sold to anyone for their marketing.</p>

<h2 id="plans">4. Plans, billing and cancellation</h2>
<ul><li>Paid plans are billed in advance, monthly or yearly, and renew automatically until cancelled. Prices and what each plan includes are shown on our pricing page and in <strong>Account and Billing</strong>.</li>
<li>Payments for your plan are processed by Stripe. You authorize us to charge the card on file for your plan, taxes and any upgrades.</li>
<li>If you upgrade, the difference for the rest of the current period is charged or credited right away. Moving to a lower or free plan takes effect at the end of the paid period.</li>
<li>You can cancel at any time in <strong>Account and Billing</strong>. The Service keeps working until the end of the period you’ve paid for; after that the account is paused. Except where the law requires otherwise, payments are non-refundable and we don’t give credits for partial periods.</li>
<li>If a payment fails, we may pause the account until it’s paid. We may change prices with at least 30 days’ notice; the new price applies from your next renewal.</li></ul>

<h2 id="payments">5. Taking payments from your clients</h2>
<p>Card payments from your clients are processed by Stripe through your own Stripe account. By connecting Stripe you agree to Stripe’s terms, including the <a href="https://stripe.com/legal/connect-account" target="_blank" rel="noopener">Stripe Connected Account Agreement</a>. Money from your clients goes to your Stripe account, not to us. Stripe’s processing fees, and any platform fee shown in the Service before you take payments, are deducted from those payments. You’re responsible for refunds, disputes and chargebacks with your clients. We never see or store full card numbers.</p>

<h2 id="third-party">6. Other services you connect</h2>
<p>Some features work by connecting services run by others, such as Stripe, Twilio, Gmail, SendGrid or another email provider. Your use of those services is governed by their terms, and we aren’t responsible for them. Features marked <strong>Beta</strong> are still being tested; they may change or be removed and may not work perfectly. AI features (such as “Write with AI”) draft text automatically; check anything they write before you use it.</p>

<h2 id="acceptable-use">7. Acceptable use</h2>
<p>You agree not to: break the law or anyone’s rights using the Service; send spam or messages people haven’t agreed to; upload malware or anything harmful; try to get into accounts or systems you don’t have access to; probe, overload or interfere with the Service; copy, resell or reverse engineer it except where the law allows; or use it to build a competing product. We may suspend accounts that break these rules or put the Service or others at risk.</p>

<h2 id="support">8. Support and support access</h2>
<p>We provide help through our <a href="${help}">help center</a> and support requests. We never sign in to your account without permission. If you grant <strong>Support Access</strong> in the Service, you let our support team sign in as the login that granted it, for up to four weeks or until you revoke it, and create, change or delete data as needed to resolve your issue.</p>

<h2 id="ours">9. Our intellectual property</h2>
<p>The Service, including its software, design and content (but not your Customer Data), belongs to us and our licensors. While your account is in good standing, we give you a limited, non-exclusive, non-transferable right to use the Service for your business under these Terms. If you send us feedback or suggestions, we may use them without any obligation to you.</p>

<h2 id="ending">10. Ending your account</h2>
<p>You can stop using the Service and cancel at any time. We may suspend or end your access if you break these Terms, don’t pay, or if we stop offering the Service, giving notice where reasonable. After an account ends, we may delete Customer Data after a reasonable period; export anything you need before then. Sections that by their nature should survive (such as ownership, disclaimers, limits of liability and indemnity) survive the end of these Terms.</p>

<h2 id="disclaimers">11. Disclaimers</h2>
<p>We work hard to keep the Service running and your data safe, but the Service is provided “as is” and “as available”. To the fullest extent the law allows, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose and non-infringement, and we don’t promise the Service will be uninterrupted, error-free, or that messages will always be delivered. Tax, financial and other figures the Service calculates are tools to help you, not professional advice.</p>

<h2 id="liability">12. Limitation of liability</h2>
<p>To the fullest extent the law allows, we won’t be liable for any indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue, data or goodwill, arising from or related to the Service. Our total liability for all claims relating to the Service is limited to the amount you paid us for the Service in the 12 months before the event giving rise to the claim. Some places don’t allow these limits, so they may not all apply to you.</p>

<h2 id="indemnity">13. Indemnity</h2>
<p>You agree to defend and indemnify us against claims, losses and costs (including reasonable legal fees) arising from your Customer Data, the messages you send, your dealings with your clients, or your breach of these Terms or the law.</p>

<h2 id="changes">14. Changes to these Terms</h2>
<p>We may update these Terms from time to time. If a change is significant, we’ll let account owners know by email or in the Service before it takes effect. Continuing to use the Service after a change takes effect means you accept the updated Terms.</p>

<h2 id="general">15. General</h2>
<p>${law ? `These Terms are governed by the laws of ${law}, without regard to its conflict-of-laws rules, and disputes will be resolved in the courts located there. ` : ''}If any part of these Terms can’t be enforced, the rest stays in effect. Not enforcing a right isn’t a waiver of it. You may not transfer these Terms without our consent; we may transfer them with a merger, acquisition or sale of assets. These Terms and the Privacy Policy are the whole agreement between you and us about the Service.</p>

<h2 id="contact">16. Contact</h2>
<p>Questions about these Terms? Contact us at ${email}.</p>`;

const privacy = ({ product, company, email, help }) => `
<p>This Privacy Policy explains how ${company} (“we”, “us”) collects, uses and protects personal information when you use ${product} (the “Service”), our websites and our help center. It also explains the choices you have.</p>

<h2 id="roles">1. Who is responsible for what</h2>
<ul><li><strong>Businesses and their teams.</strong> For the information about business owners and team members who use the Service, and visitors to our websites, we decide how it’s used.</li>
<li><strong>Your clients.</strong> When a business uses the Service to manage its own clients (their names, contact details, addresses, quotes, jobs, invoices, photos and signatures), the business decides how that information is used and we process it on the business’s behalf. If you’re a client of a business that uses ${product}, please contact that business about your information; we’ll help them respond.</li></ul>

<h2 id="collect">2. Information we collect</h2>
<ul><li><strong>Account information:</strong> your name, email, phone number, business name, address, password (stored only as a secure hash), profile photo and access level.</li>
<li><strong>Business information you add:</strong> clients, quotes, jobs, invoices, payments you record, expenses, products and services, schedules, photos, signatures, email templates and settings.</li>
<li><strong>Billing information:</strong> your plan and billing contact details. Card details are collected and stored by Stripe; we receive only limited details such as the card brand, last four digits and expiry date.</li>
<li><strong>Messages:</strong> the emails and text messages sent through the Service and their delivery status, and messages you send to our support team.</li>
<li><strong>Connection details:</strong> settings and keys for services you connect, such as Stripe, Twilio or your email provider. Passwords and keys are never shown back in full.</li>
<li><strong>Technical information:</strong> logs our servers keep to run and protect the Service, such as IP address, browser type, pages requested and times, and login times.</li></ul>

<h2 id="use">3. How we use information</h2>
<ul><li>To provide the Service: show your data to you and your team, send the messages you ask us to send, take payments and keep records.</li>
<li>To bill for your plan, and to send you account, security and service messages.</li>
<li>To provide support, including, only when you grant <strong>Support Access</strong>, signing in as the login that granted it to troubleshoot.</li>
<li>To keep the Service secure, prevent fraud and abuse, and fix problems.</li>
<li>To improve the Service and understand how it’s used.</li>
<li>To meet legal obligations and enforce our <a href="/terms">Terms of Service</a>.</li></ul>
<p>We don’t sell personal information, we don’t share it for cross-context behavioral advertising, and we don’t use your clients’ information to market to them.</p>

<h2 id="sharing">4. Who we share it with</h2>
<p>We share information only with service providers that help us run the Service, under contracts that limit their use of it, and only as needed:</p>
<ul><li><strong>Hosting and infrastructure</strong> providers that run our servers and store data.</li>
<li><strong>Stripe</strong>, for plan billing and, if you connect it, card payments from your clients.</li>
<li><strong>Twilio</strong> and <strong>email providers</strong> (such as Gmail, SendGrid or SMTP services), to deliver the emails and texts you send.</li>
<li><strong>Anthropic</strong>, only when you use “Write with AI”: the product or service name you’re describing is sent to generate a draft.</li></ul>
<p>We may also share information if the law requires it, to protect the rights, safety or property of our users or others, or as part of a merger, acquisition or sale of assets (in which case this policy will continue to apply). Text messaging opt-in data and phone numbers collected for text messages are not shared with third parties for their marketing.</p>

<h2 id="cookies">5. Cookies and local storage</h2>
<p>We use only what the Service needs to work: a cookie that keeps you logged in, and your browser’s local storage to remember your light or dark mode choice. We don’t use advertising or third-party tracking cookies.</p>

<h2 id="retention">6. How long we keep information</h2>
<p>We keep account and business information while the account is open. When an account is deleted, we remove it from the Service; backup copies may be kept for a limited time to recover from mistakes or for legal reasons, then deleted. Server logs are kept only as long as needed for security and troubleshooting.</p>

<h2 id="security">7. Security</h2>
<p>We protect information with measures such as encrypted connections (HTTPS), hashed passwords, hashed session tokens, access levels inside each account, and keeping each business’s data separate. No system is perfectly secure, so please use a strong, unique password and tell us right away if you suspect a problem.</p>

<h2 id="rights">8. Your choices and rights</h2>
<p>You can see and update most of your information in the Service, export your clients, quotes, jobs and invoices, and ask your account owner to remove your login. Depending on where you live (for example in California or the European Economic Area), you may have the right to access, correct, delete or get a copy of your personal information, to object to or limit some uses, and not to be treated differently for exercising these rights. To make a request, contact us at ${email}. We may need to verify your identity. If you’re a client of a business using ${product}, send your request to that business.</p>

<h2 id="children">9. Children</h2>
<p>The Service is for businesses and isn’t meant for children under 16. We don’t knowingly collect their personal information.</p>

<h2 id="international">10. International transfers</h2>
<p>We and our service providers may process information in the United States and other countries whose laws may differ from where you live. Where required, we use appropriate safeguards for these transfers.</p>

<h2 id="changes">11. Changes to this policy</h2>
<p>We may update this policy from time to time. If a change is significant, we’ll let account owners know by email or in the Service before it takes effect. The date at the top shows when it was last updated.</p>

<h2 id="contact">12. Contact</h2>
<p>Questions or requests about privacy? Contact us at ${email}, or visit our <a href="${help}">help center</a>.</p>`;

// how clients agree to texts (/sms-consent): the opt-in evidence carriers ask for in A2P 10DLC campaign registration.
// The checkbox wording matches smsConsentBox in server.js, and the script matches the note on the client form in public/app.js.
const sms = ({ product, company, email }) => `
<p>${company !== product ? `${company} (doing business as ${product}) provides ${product}, software` : `${product} is software`} that service businesses (cleaning, landscaping, HVAC, security installation and similar) use to run their work. Through ${product}, a business can text its own customers about work those customers asked for. This page shows how customers agree to those texts. A business can only text customers who have agreed.</p>

<h2 id="messages">What the texts are about</h2>
<ul><li>A link to view and approve a quote the customer asked for</li>
<li>A link to view and pay an invoice</li>
<li>A reminder before a scheduled appointment</li></ul>
<p>Every text names the business sending it. There are no marketing or promotional texts. <strong>Message frequency varies</strong> with the customer’s requests and appointments, usually a few messages per job. <strong>Msg &amp; data rates may apply.</strong> Reply <strong>STOP</strong> to any message to opt out, or <strong>HELP</strong> for help.</p>

<h2 id="online">1. Online: the booking and request forms</h2>
<p>Customers who book or request work on a business’s online booking form (<code>https://&lt;business&gt;.workliopro.com/book</code>) or referral form enter their mobile number and can tick this box. It starts unticked, and the business can only text them if they tick it:</p>
<div style="border:1px solid var(--line);border-radius:10px;padding:16px;background:var(--soft);margin:12px 0">
<label style="display:flex;gap:10px;align-items:flex-start;font-size:15px;line-height:1.5"><input type="checkbox" disabled style="margin-top:5px;flex:none">
<span>Text me about my request, quotes, invoices and appointments from [Business name]. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out, HELP for help. Agreeing isn’t a condition of service. See the <a href="/terms#sms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</span></label></div>
<p>When the form is sent, ${product} saves the date, time and source of the customer’s agreement on their profile.</p>

<h2 id="verbal">2. In person or by phone: the consent script</h2>
<p>When a customer gives their mobile number in person or over the phone, for example while asking for a quote or booking a visit, the business’s staff read this script before turning texts on:</p>
<div style="border-left:4px solid var(--link);padding:12px 16px;background:var(--soft);margin:12px 0;border-radius:0 10px 10px 0">
<p style="margin:0">“Can we text you at [mobile number] about your quotes, invoices and appointments? Message frequency varies, and msg &amp; data rates may apply. You can reply STOP at any time to opt out, or HELP for help. Agreeing isn’t required to do business with us. Is that OK?”</p></div>
<p>Texts are only turned on if the customer says yes. Staff then tick <strong>Agreed to receive text messages</strong> on the customer’s profile in ${product}, which records the date and time. The same script is shown next to that box. If the customer says no, the box stays unticked and the business can’t text them; they get emails instead.</p>

<h2 id="samples">Sample messages</h2>
<ul><li>Brightside Cleaning: Quote Q-1042 ($480.00) is ready: https://brightside.workliopro.com/q/8f3k2 Reply STOP to opt out.</li>
<li>Brightside Cleaning: Invoice INV-2031 ($325.00) due 2026-11-08. Pay online: https://brightside.workliopro.com/i/7d2m9 Reply STOP to opt out.</li>
<li>Brightside Cleaning: reminder for "Deep clean, 3 bedrooms" on 2026-11-02 at 9:00 AM. Reply STOP to opt out.</li></ul>

<h2 id="optout">Opting out and getting help</h2>
<p>Reply <strong>STOP</strong> (or STOPALL, UNSUBSCRIBE, CANCEL, END or QUIT) to stop all texts; you’ll get one message confirming it. Reply <strong>START</strong> to opt back in. Reply <strong>HELP</strong> for help, or contact us at ${email}. Carriers aren’t liable for delayed or undelivered messages.</p>

<h2 id="privacy">Your number is never shared</h2>
<p>Mobile numbers and text-message opt-in data are never shared with or sold to third parties for their marketing. See the <a href="/privacy">Privacy Policy</a> and the <a href="/terms#sms">Terms of Service</a>.</p>`;

const PAGES = { terms: ['Terms of Service', terms], privacy: ['Privacy Policy', privacy], sms: ['Text Message Opt-In', sms] };
function page(kind) {
  const i = info(); const [title, body] = PAGES[kind]; const other = kind === 'privacy' ? ['/terms', 'Terms of Service'] : ['/privacy', 'Privacy Policy'];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><link rel="icon" href="/favicon.ico">
<title>${title} · ${i.product}</title>
<style>
:root{--bg:#f6f8fc;--card:#fff;--text:#0f172a;--muted:#5b6b82;--line:#dfe6f0;--link:#1d4ed8;--soft:#eef3fb;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0b1220;--card:#121b2f;--text:#e2e8f0;--muted:#94a3b8;--line:#22304d;--link:#93b4fd;--soft:#172440;color-scheme:dark}}
:root[data-theme=dark]{--bg:#0b1220;--card:#121b2f;--text:#e2e8f0;--muted:#94a3b8;--line:#22304d;--link:#93b4fd;--soft:#172440;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:16px;line-height:1.65}
a{color:var(--link)}.wrap{max-width:820px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid var(--line);background:var(--card)}header .wrap{display:flex;justify-content:space-between;align-items:center;gap:12px;height:60px;font-weight:700}
header nav{display:flex;gap:16px;font-size:14px;font-weight:400}header a{text-decoration:none}
main{padding:36px 20px 56px}h1{font-size:34px;margin:0 0 4px;letter-spacing:-.02em;line-height:1.2}.updated{color:var(--muted);margin:0 0 24px}
.doc{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:32px}
.doc h2{font-size:20px;margin:28px 0 8px}.doc>p:first-child{margin-top:0}.doc ul{padding-left:22px}.doc li{margin-bottom:6px}
footer{color:var(--muted);font-size:14px;padding:0 20px 32px}footer a{color:var(--muted)}
@media (max-width:640px){main{padding:24px 16px 40px}.wrap{padding:0 16px}h1{font-size:28px}.doc{padding:20px}header nav a.hide-sm{display:none}}
@media print{header,footer{display:none}.doc{border:0;padding:0}}
</style>
<script>try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}</script></head>
<body><header><div class="wrap"><span>${i.product}</span><nav><a href="${other[0]}">${other[1]}</a><a class="hide-sm" href="${i.help}">Help Center</a></nav></div></header>
<main class="wrap"><h1>${title}</h1><p class="updated">Last updated ${UPDATED}</p><div class="doc">${body(i)}</div></main>
<footer class="wrap"><a href="/terms">Terms of Service</a> · <a href="/privacy">Privacy Policy</a> · <a href="/sms-consent">Text Message Opt-In</a> · <a href="${i.help}">Help Center</a></footer></body></html>`;
}

const kindOf = (p) => ({ '/terms': 'terms', '/privacy': 'privacy', '/sms-consent': 'sms' })[String(p).replace(/\/+$/, '')] || null;
module.exports = { page, kindOf };
