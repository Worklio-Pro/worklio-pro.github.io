// The platform's own emails (sign-up, invites, password resets, support access, notices to you): editable templates
// in the platform console (Messages → Email templates), sent as HTML in the home page's style with a plain-text copy.
// Businesses' emails to their clients (quotes, invoices, reminders) are separate: each account edits those in App Settings.
const tenancy = require('./tenancy');
const brandLib = require('./brand');

// Template text: blank lines split paragraphs, "# " starts the heading, "> " lines are a quoted box,
// **bold**, [text](url) is a link and a line holding only [text](url) is a button. {{name}} fills in a value.
const TEMPLATES = {
  verifyEmail: {
    group: 'users', label: 'Confirm email address', when: 'Right after a business signs up on the pricing page (once a paid plan is paid for).',
    vars: { name: 'Their name', business: 'Business name', link: 'Confirm link (works for 7 days)', account_url: 'Their account’s web address' },
    subject: 'Confirm your email for {{product}}',
    body: `# Confirm your email address

Hi {{name}},

Thanks for signing up {{business}} for {{product}}. Confirm this is your email address so we can reach you about your account.

[Confirm my email]({{link}})

The link works for 7 days. If you didn’t sign up, you can ignore this email.`,
  },
  welcome: {
    group: 'users', label: 'Welcome', when: 'When the owner of a new sign-up confirms their email address.',
    vars: { name: 'Their name', business: 'Business name', account_url: 'Their account’s web address' },
    subject: 'Welcome to {{product}}',
    body: `# Welcome to {{product}}, {{name}}

Your email is confirmed and {{business}} is ready at **{{account_url}}**. Bookmark it: it’s where you and your team log in.

A few things to do first:

**1. Add your services** with their prices, so quotes take minutes.
**2. Invite your team** so they can see their jobs from the truck.
**3. Connect card payments** so clients can pay invoices online.

[Open {{business}}]({{account_url}})

Questions? Just reply to this email.`,
  },
  accountReady: {
    group: 'users', label: 'Account created for a business', when: 'When you create an account in Alpha (Accounts → New account).',
    vars: { name: 'Owner’s name', business: 'Business name', link: 'Link to choose a password (works for 7 days)', account_url: 'Their account’s web address' },
    subject: 'Your {{product}} account for {{business}} is ready',
    body: `# Your account is ready

Hi {{name}},

Your {{product}} account for {{business}} is set up at **{{account_url}}**. Choose your password to log in.

[Choose my password]({{link}})

The link works for 7 days.`,
  },
  alphaInvite: {
    group: 'users', label: 'Alpha support user invite', when: 'When you add a support user in Alpha (Settings → Alpha team).',
    vars: { name: 'Their name', inviter: 'Who added them', link: 'Link to activate and choose a password (works for 7 days)', alpha_url: 'The Alpha address' },
    subject: 'You’re invited to the {{product}} support team',
    body: `# Welcome to the team

Hi {{name}},

{{inviter}} added you as a support user in Alpha, the console for {{product}}. You’ll be able to help with accounts, messages and live chat, and the help center.

Activate your login by choosing a password:

[Activate my account]({{link}})

The link works for 7 days. After that, you log in at {{alpha_url}}.`,
  },
  alphaCode: {
    group: 'users', label: 'Alpha verification code', when: 'When someone uses “Forgot your password?” on the Alpha login page.',
    vars: { name: 'Their name', code: 'The 6-digit code (works for 15 minutes)', alpha_url: 'The Alpha address' },
    subject: '{{code}} is your {{product}} Alpha verification code',
    body: `# Your verification code

Hi {{name}},

Enter this code on the Alpha login page to choose a new password:

**{{code}}**

The code works for 15 minutes. If you didn’t ask for it, you can ignore this email; your password hasn’t changed.`,
  },
  alphaEmailCode: {
    group: 'users', label: 'Alpha new email confirmation', when: 'When someone changes the email of their Alpha login (sent to the new address).',
    vars: { name: 'Their name', code: 'The 6-digit code (works for 15 minutes)' },
    subject: '{{code}} confirms your new {{product}} Alpha email',
    body: `# Confirm your new email

Hi {{name}},

Enter this code in Alpha to start using this address for your login:

**{{code}}**

The code works for 15 minutes. If you didn’t ask for this, you can ignore this email.`,
  },
  alphaEmailChanged: {
    group: 'users', label: 'Alpha email changed notice', when: 'After an Alpha login’s email changes (sent to the old address).',
    vars: { name: 'Their name', new_email: 'The new email address', alpha_url: 'The Alpha address' },
    subject: 'Your {{product}} Alpha login email was changed',
    body: `# Your login email was changed

Hi {{name}},

Your Alpha login now uses **{{new_email}}**. Log in with that address from now on.

If you didn’t make this change, contact the Alpha owner right away.`,
  },
  alphaReset: {
    group: 'users', label: 'Alpha support user password reset', when: 'When you send a support user a password reset from Alpha (Settings → Alpha team).',
    vars: { name: 'Their name', link: 'Link to choose a new password (works for 7 days)', alpha_url: 'The Alpha address' },
    subject: 'Choose a new password for {{product}} Alpha',
    body: `# Choose a new password

Hi {{name}},

Use this link to choose a new password for your Alpha login. Until you do, your old password won’t work.

[Choose a new password]({{link}})

The link works for 7 days. Then log in at {{alpha_url}}.`,
  },
  timeOffRequested: {
    group: 'users', label: 'Time-off request', when: 'When a team member asks for time off (sent to the owner, admins and anyone who can edit jobs).',
    vars: { name: 'Who it’s sent to', person: 'Who asked', when: 'The dates and times', reason: 'Their reason', jobs: 'Jobs they’re assigned to then', business: 'Business name', link: 'Link to the request' },
    subject: '{{person}} asked for time off {{when}}',
    body: `# Time-off request

Hi {{name}},

{{person}} asked for time off **{{when}}**.

> {{reason}}

{{jobs}}

[Review the request]({{link}})`,
  },
  timeOffDecided: {
    group: 'users', label: 'Time-off decision', when: 'When a time-off request is approved or declined (sent to the team member who asked).',
    vars: { name: 'Team member’s name', decision: 'approved or declined', when: 'The dates and times', note: 'A note from whoever decided', decider: 'Who decided', business: 'Business name', link: 'Link to Time Off' },
    subject: 'Your time off {{when}} was {{decision}}',
    body: `# Time off {{decision}}

Hi {{name}},

{{decider}} {{decision}} your time off **{{when}}**.

{{note}}

[See your time off]({{link}})`,
  },
  teamInvite: {
    group: 'users', label: 'Team member invite', when: 'When someone in an account invites a team member to log in.',
    vars: { name: 'Team member’s name', inviter: 'Who invited them', business: 'Business name', link: 'Link to choose a password', days: 'Days the link works' },
    subject: 'You’re invited to {{business}}',
    body: `# You’re invited

Hi {{name}},

{{inviter}} invited you to log in to {{business}}’s scheduling and jobs app on {{product}}.

[Set my password]({{link}})

The link works for {{days}} days.`,
  },
  passwordReset: {
    group: 'users', label: 'Password reset', when: 'When someone clicks “Forgot password?” on an account’s login page.',
    vars: { name: 'Their name', business: 'Business name', link: 'Reset link (works for 1 hour)' },
    subject: 'Reset your {{business}} password',
    body: `# Reset your password

Hi {{name}},

Use the button below to choose a new password for {{business}}. The link works for 1 hour.

[Choose a new password]({{link}})

If you didn’t ask for this, you can ignore this email. Your password stays the same.`,
  },
  supportAccessRequest: {
    group: 'users', label: 'Support access request', when: 'When you ask one of an account’s logins for Support Access.',
    vars: { name: 'Their name', admin: 'Your name', business: 'Business name', reason: 'Why you need access', link: 'Page where they approve or decline' },
    subject: '{{product}} support is asking for access to your {{business}} login',
    body: `# Support is asking for access

Hi {{name}},

{{admin}} from {{product}} support is asking for access to your login at {{business}} to help troubleshoot an issue.

> {{reason}}

Nothing changes until you approve it.

[Review the request]({{link}})`,
  },
  referralInvite: {
    sample: { friend_name: 'Casey', referrer_name: 'Jordan Rivera', referrer_business: 'Rivera HVAC', offer: 'FRIEND30: 30% off the first 3 months', link: 'https://example.com/pricing?ref=a1b2c3d4' },
    group: 'users', label: 'Referral invitation', when: 'When a business invites a friend from its Refer & earn page (the referral program in Alpha → Promotions).',
    vars: { friend_name: 'Friend’s first name', referrer_name: 'Who invited them', referrer_business: 'Their business', offer: 'The friend’s offer (from the referral program)', link: 'Referral link to the pricing page' },
    subject: '{{referrer_name}} invited you to try {{product}}',
    body: `# {{referrer_name}} thinks you’ll like {{product}}

Hi {{friend_name}},

{{referrer_name}} from {{referrer_business}} runs their business on {{product}}: quotes clients approve online, a schedule the whole crew can see, and invoices that get paid by card. They invited you to try it.

> {{offer}}

[See plans and get started]({{link}})

Questions? Reply to this email to reach {{referrer_name}}.`,
  },
  referralCredit: {
    sample: { friend_business: 'Blue Lawn Care', months: '3', total: '6', link: 'https://rivera.example.com/rewards' },
    group: 'users', label: 'Referral credit earned', when: 'When a business someone referred becomes a paying customer.',
    vars: { name: 'Owner’s name', friend_business: 'The business they referred', months: 'Months earned this time', total: 'Months earned in total', link: 'Their Refer & earn page' },
    subject: 'You earned {{months}} free months of {{product}}',
    body: `# You earned {{months}} free months

Hi {{name}},

{{friend_business}} just subscribed to {{product}} with your referral. Thank you!

We added **{{months}} months of credit** to your account ({{total}} months earned so far). Your next charge moves out by {{months}} months, or the free months start when you subscribe.

[See your referrals]({{link}})`,
  },
  referralMilestone: {
    sample: { reward: '$100 prepaid card', count: '3', link: 'https://rivera.example.com/rewards' },
    group: 'users', label: 'Referral milestone reached', when: 'When a business reaches a milestone reward in the referral program.',
    vars: { name: 'Owner’s name', reward: 'The reward unlocked', count: 'Paying referrals it took', link: 'Their Refer & earn page' },
    subject: 'You unlocked a reward: {{reward}}',
    body: `# You unlocked {{reward}}

Hi {{name}},

You’ve referred {{count}} businesses that now subscribe to {{product}}. That unlocks **{{reward}}**.

We’ll be in touch soon to send it your way.

[See your rewards]({{link}})`,
  },
  expiryReminder: {
    sample: { plan: 'Trial', link: 'https://rivera.example.com/settings/billing' },
    group: 'users', label: 'Access ending soon', when: 'A few days before the last day of access you set on an account (the number of days is in Alpha → Settings).',
    vars: { name: 'Owner’s name', business: 'Business name', plan: 'Their plan, e.g. Trial', when: '“today”, “tomorrow” or “on October 28”', days_left: 'Days left', link: 'Their Account and billing page' },
    subject: 'Your {{product}} access ends {{when}}',
    body: `# Your access ends {{when}}

Hi {{name}},

Your {{plan}} access to {{product}} for {{business}} ends {{when}}. After that, your team can’t log in and client links stop working.

Choose a plan to keep going. Your clients, jobs, quotes and invoices stay right where they are.

[Choose a plan]({{link}})

Questions? Just reply to this email.`,
  },
  paymentReceived: {
    group: 'users', label: 'Online payment received', when: 'When a client pays a business online (if the business turned on payment emails).',
    vars: { client: 'Client’s name', amount: 'Amount paid', what: 'What it paid for, e.g. “Invoice 1042”', how: '“online” or “from their bank account”', reference: 'Stripe payment reference', business: 'Business name', account_url: 'The account’s web address' },
    subject: 'Online payment received: {{what}}',
    body: `# You got paid

{{client}} paid **{{amount}}** {{how}} for {{what}}.

Stripe payment: {{reference}}

[Open {{business}}]({{account_url}})`,
  },
  zelleReported: {
    group: 'users', label: 'Zelle payment reported', when: 'When a client says they paid a business by Zelle.',
    vars: { client: 'Client’s name', amount: 'Amount', what: 'What it’s for', business: 'Business name', account_url: 'The account’s web address' },
    subject: 'Zelle payment reported: {{what}}',
    body: `# Zelle payment reported

{{client}} says they sent **{{amount}}** by Zelle for {{what}}.

Check your bank, then mark it paid in the app.

[Open {{business}}]({{account_url}})`,
  },
  referral: {
    sample: { title: 'AC repair' },
    group: 'users', label: 'New referral', when: 'When someone fills in a client’s referral link.',
    vars: { name: 'New lead’s name', referrer: 'Client who referred them', title: 'What they need', details: 'Phone, email, address and referrer', request: 'Their description', business: 'Business name', account_url: 'The account’s web address' },
    subject: 'Referral from {{referrer}}: {{name}} needs {{title}}',
    body: `# New referral: {{title}}

{{details}}

> {{request}}

They’ve been added to your clients as a lead.

[Open {{business}}]({{account_url}})`,
  },
  workRequest: {
    sample: { title: 'AC repair' },
    group: 'users', label: 'New work request', when: 'When a client asks for work from their client portal.',
    vars: { client: 'Client’s name', title: 'What they need', details: 'Phone, email, address and preferred time', request: 'Their description', business: 'Business name', account_url: 'The account’s web address' },
    subject: 'New request from {{client}}: {{title}}',
    body: `# New request: {{title}}

{{details}}

> {{request}}

[Open {{business}}]({{account_url}})`,
  },
  newSignup: {
    group: 'you', label: 'New sign-up', when: 'When a business signs up (sent to your contact email).',
    vars: { owner: 'Owner’s name', email: 'Owner’s email', business: 'Business name', plan: 'Plan', how: 'Free plan, paid by card or demo checkout', account_url: 'Their account’s web address' },
    subject: 'New sign-up: {{business}} ({{plan}})',
    body: `# New sign-up

{{owner}} ({{email}}) signed up **{{business}}** on the {{plan}} plan ({{how}}).

[Open {{business}}]({{account_url}})`,
  },
  contactRequest: {
    group: 'you', label: 'Contact request', when: 'When someone sends “Contact us” on the pricing page.',
    vars: { name: 'Their name', details: 'Email, phone, business and plan', message: 'Their message' },
    subject: '{{product}} enquiry from {{name}}',
    body: `# New message from the pricing page

{{details}}

> {{message}}

Reply to this email to answer {{name}}.`,
  },
  chatWaiting: {
    group: 'you', label: 'Chat: someone wants a person', when: 'When someone taps “Talk to a person” in the chat (Alpha → Messages → Live chat).',
    vars: { name: 'Their name (or “A visitor”)', details: 'Email, business and page', conversation: 'The chat so far', alpha_url: 'Link to Live chat in Alpha' },
    subject: '{{product}} chat: {{name}} wants to talk to a person',
    body: `# {{name}} wants to talk to a person

{{details}}

> {{conversation}}

[Open Live chat]({{alpha_url}})`,
  },
  chatReply: {
    group: 'users', label: 'Chat reply', when: 'When you reply in Live chat and the person has left the page (they gave their email).',
    vars: { name: 'Their name', agent: 'Your name', message: 'Your reply', page: 'The page they chatted from' },
    subject: 'Reply from {{product}}',
    body: `# {{agent}} replied to your chat

> {{message}}

Reply to this email, or pick up the chat where you left off.

[Continue the chat]({{page}})`,
  },
  supportRequest: {
    group: 'you', label: 'Support request', when: 'When someone sends “Get Support” from an account’s help panel.',
    vars: { name: 'Their name', business: 'Business name', subject: 'Their subject or topic', details: 'Email, phone, plan, account and page', message: 'Their message' },
    subject: 'Support request from {{business}}: {{subject}}',
    body: `# Support request from {{business}}

{{details}}

> {{message}}

Reply to this email to answer {{name}}.`,
  },
  helpMessage: {
    group: 'you', label: 'Help center message', when: 'When someone uses the contact form in the help center.',
    vars: { name: 'Their name', topic: 'Topic they picked', details: 'Email, phone, business and page', message: 'Their message' },
    subject: 'Help center: {{topic}} from {{name}}',
    body: `# New message from the help center

{{details}}

> {{message}}

Reply to this email to answer {{name}}.`,
  },
  feedback: {
    group: 'you', label: 'User feedback', when: 'When someone sends feedback from an account’s top bar.',
    vars: { name: 'Their name', business: 'Business name', rating: 'Their rating, e.g. 4/5', kind: 'Type of feedback', details: 'Role, plan, account, page and whether to contact them', message: 'Their message' },
    subject: 'Feedback from {{business}} ({{rating}}): {{kind}}',
    body: `# Feedback from {{business}}

{{details}}

> {{message}}`,
  },
  accountActivity: {
    group: 'you', label: 'Billing and support updates', when: 'Plan changes, new subscriptions, cancellations and Support Access answers.',
    vars: { title: 'What happened, e.g. “Plan changed: Acme → Pro”', message: 'The details', link: 'Where to look' },
    subject: '{{title}}',
    body: `# {{title}}

{{message}}

[Open]({{link}})`,
  },
  test: {
    group: 'you', label: 'Test email', when: 'Settings → Integrations → Send test email.',
    vars: {},
    subject: 'Test email from {{product}}',
    body: `# Email is working

This is a test message from {{product}}. Email delivery is connected.`,
  },
};
// example values for the preview and test sends
const SAMPLE = {
  name: 'Jordan Rivera', owner: 'Jordan Rivera', email: 'jordan@riverahvac.com', business: 'Rivera HVAC', inviter: 'Sam Lee', admin: 'Alex Morgan', days: '7',
  link: 'https://example.com/link', account_url: 'https://rivera.example.com', plan: 'Pro', how: 'paid $49/month by card', reason: 'The schedule isn’t showing next week’s jobs.',
  when: 'on October 28', days_left: '3', subject: 'Invoices', topic: 'Billing', client: 'Pat Chen', amount: '$450.00', what: 'Invoice 1042', how: 'online', reference: 'pi_3Q8x2L', referrer: 'Pat Chen', request: 'The AC upstairs is blowing warm air.', rating: '5/5', kind: 'Idea or suggestion', title: 'Plan changed: Rivera HVAC → Pro',
  details: 'Email: jordan@riverahvac.com\nPhone: (713) 555-0100\nBusiness: Rivera HVAC\nPlan: Pro', message: 'Could invoices show the job photos too? Our clients keep asking for them.',
};

const P = () => tenancy.platform();
const saved = () => P().emailTemplates || {};
const template = (key) => ({ subject: TEMPLATES[key].subject, body: TEMPLATES[key].body, ...(saved()[key] || {}) });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const allVars = (vars) => ({ product: P().settings.productName, year: String(new Date().getFullYear()), ...vars });
const fill = (s, v) => String(s).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in v ? String(v[k] ?? '') : m));

// home page colors (public/styles.css): brand blue, navy, the hero's pale blue, muted gray
const C = { brand: '#2563eb', navy: '#0f1f3d', tint: '#eef3fb', text: '#0f172a', muted: '#64748b', line: '#dbe4f0', soft: '#f8fafc' };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
// values are escaped after the markup is read, so nothing in a value (a client's message, say) can add links or formatting
// color: the button and link color (a business's brand color in its emails to clients)
function html(body, v, color = C.brand) {
  const vals = []; const hold = (k) => { vals.push(k); return `\u0000${vals.length - 1}\u0000`; };
  const src = String(body).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in v ? hold(k) : m));
  const link = (u) => `<a href="${esc(u)}" style="color:${color};font-weight:600;word-break:break-all">${esc(u)}</a>`; // a web address on its own as a value becomes a link
  const put = (s, attr) => s.replace(/\u0000(\d+)\u0000/g, (m, i) => { const val = String(v[vals[i]] ?? ''); return attr ? esc(val) : /^https?:\/\/\S+$/.test(val) ? link(val) : esc(val).replace(/\n/g, '<br>'); });
  const inline = (s) => put(esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a href="${put(u, true)}" style="color:${color};font-weight:600">${t}</a>`));
  return src.trim().split(/\n\s*\n/).map((block) => {
    const b = block.trim(); if (!b.replace(/\u0000(\d+)\u0000/g, (m, i) => String(v[vals[i]] ?? '')).replace(/^>\s?/gm, '').trim()) return ''; // e.g. a quote box whose value is empty
    const btn = b.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (btn) return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:${color};border-radius:10px"><a href="${put(btn[2], true)}" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${put(esc(btn[1]))}</a></td></tr></table>`;
    if (b.startsWith('# ')) return `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:26px;line-height:1.2;letter-spacing:-0.02em;color:${C.text}">${inline(b.slice(2))}</h1>`;
    if (b.split('\n').every((l) => l.startsWith('>'))) return `<div style="margin:0 0 18px;padding:14px 18px;background:${C.soft};border-left:4px solid ${color};border-radius:8px;font-size:15px;line-height:1.6;color:${C.text}">${b.split('\n').map((l) => inline(l.replace(/^>\s?/, ''))).join('<br>')}</div>`;
    return `<p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:${C.text}">${b.split('\n').map(inline).join('<br>')}</p>`;
  }).filter(Boolean).join('\n');
}
// the application logo from Settings → Logo (email clients don't show SVG or WebP, so those keep the standard mark), else a check mark
function header(v) {
  const b = brandLib.brand(); const url = /\.(png|jpg|gif)$/.test(b.logo) ? `${(v.site_url || tenancy.platformUrl()).replace(/\/+$/, '')}${b.logo}` : '';
  const name = `<td style="${url ? 'padding-left:12px;' : 'padding-left:10px;'}font-family:${FONT};font-size:18px;font-weight:800;color:${C.navy};letter-spacing:-0.01em">${esc(v.product)}</td>`;
  const mark = url ? `<td style="vertical-align:middle"><img src="${esc(url)}" alt="${esc(v.product)}" height="40" style="display:block;height:40px;width:auto;max-width:220px;border:0"></td>`
    : `<td style="width:30px;height:30px;background:${C.brand};border-radius:8px;text-align:center;vertical-align:middle;color:#ffffff;font-size:17px;font-weight:800;line-height:30px">&#10003;</td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>${mark}${url && b.logoHasName ? '' : name}</tr></table>`;
}
// head: the header row (the logo); foot: extra lines above "Sent by …"
function layout(content, v, { head = header(v), foot = '' } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(v.product)}</title></head>
<body style="margin:0;padding:0;background:${C.tint};font-family:${FONT};-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.tint}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px">${head}</td></tr>
<tr><td style="background:#ffffff;border:1px solid ${C.line};border-radius:18px;padding:36px 32px 18px;font-family:${FONT}">${content}</td></tr>
<tr><td style="padding:20px 4px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};text-align:center">${foot}Sent by ${esc(v.product)} &middot; &copy; ${esc(v.year)}</td></tr>
</table></td></tr></table></body></html>`;
}
// the plain-text copy: buttons and links become "text: url", markup is dropped
const text = (body, v, signoff = v.product) => fill(String(body).replace(/^# /gm, '').replace(/^>\s?/gm, '  ').replace(/\*\*(.+?)\*\*/g, '$1')
  .replace(/^\[([^\]]+)\]\(([^)\s]+)\)$/gm, '$1: $2').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)'), v).replace(/^\s+$/gm, '').replace(/\n{3,}/g, '\n\n').trim() + (signoff ? `\n\n${signoff}` : '');

function render(key, vars = {}, override) {
  const t = override || template(key); const v = allVars(vars);
  return { subject: fill(t.subject, v).replace(/\s+/g, ' ').trim(), text: text(t.body, v), html: layout(html(t.body, v), v) };
}
// a business's email to its client (quote, invoice, reminder, receipt): the business's logo, name and brand color, still "Sent by <product>"
// co: { name, logoUrl (absolute), color, contact: [phone, email, website] }
function renderBusiness(t, vars, co) {
  const v = allVars(vars); const color = /^#[0-9a-f]{6}$/i.test(co.color || '') ? co.color : C.brand;
  const logo = /\.(png|jpe?g|gif)$/i.test(co.logoUrl || '') ? `<td style="vertical-align:middle;padding-right:12px"><img src="${esc(co.logoUrl)}" alt="" height="44" style="display:block;height:44px;width:auto;max-width:180px;border:0"></td>` : '';
  const head = `<table role="presentation" cellpadding="0" cellspacing="0"><tr>${logo}<td style="font-family:${FONT};font-size:19px;font-weight:800;color:${C.navy};letter-spacing:-0.01em">${esc(co.name)}</td></tr></table>`;
  const contact = (co.contact || []).filter(Boolean); const foot = contact.length ? `<div style="margin-bottom:6px">${esc(co.name)} &middot; ${contact.map(esc).join(' &middot; ')}</div>` : '';
  return { subject: fill(t.subject, v).replace(/\s+/g, ' ').trim(), text: text(t.body, v, ''), html: layout(html(t.body, v, color), v, { head, foot }) };
}
const sample = (key) => ({ ...Object.fromEntries(Object.keys(TEMPLATES[key].vars).map((k) => [k, SAMPLE[k] ?? k])), ...TEMPLATES[key].sample });
const list = () => Object.entries(TEMPLATES).map(([key, d]) => ({ key, group: d.group, label: d.label, when: d.when, vars: { product: 'Your product name', ...d.vars },
  subject: template(key).subject, body: template(key).body, defaultSubject: d.subject, defaultBody: d.body, custom: !!saved()[key] }));
function save(key, { subject, body }) {
  if (!TEMPLATES[key]) throw Object.assign(new Error('Unknown email'), { status: 404 });
  subject = String(subject || '').trim().slice(0, 200); body = String(body || '').trim().slice(0, 10000);
  if (!subject || !body) throw Object.assign(new Error('Write a subject and a message'), { status: 400 });
  const d = TEMPLATES[key]; const all = { ...saved() };
  if (subject === d.subject && body === d.body) delete all[key]; else all[key] = { subject, body };
  P().emailTemplates = all; tenancy.savePlatform();
}
function reset(key) { const all = { ...saved() }; delete all[key]; P().emailTemplates = all; tenancy.savePlatform(); }
// "Name: value" lines for the notices to you, leaving out empty values
const details = (pairs) => pairs.filter(([, val]) => val).map(([k, val]) => `${k}: ${val}`).join('\n');

module.exports = { TEMPLATES, render, renderBusiness, sample, list, save, reset, details };
