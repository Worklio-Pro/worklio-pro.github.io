// The platform's own emails (sign-up, invites, password resets, support access, notices to you): editable templates
// in the platform console (Messages → Email templates), sent as HTML in the home page's style with a plain-text copy.
// Businesses' emails to their clients (quotes, invoices, reminders) are separate: each account edits those in App Settings.
const tenancy = require('./tenancy');

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
    group: 'users', label: 'Account created for a business', when: 'When you create an account in the platform console (Accounts → New account).',
    vars: { name: 'Owner’s name', business: 'Business name', link: 'Link to choose a password (works for 7 days)', account_url: 'Their account’s web address' },
    subject: 'Your {{product}} account for {{business}} is ready',
    body: `# Your account is ready

Hi {{name}},

Your {{product}} account for {{business}} is set up at **{{account_url}}**. Choose your password to log in.

[Choose my password]({{link}})

The link works for 7 days.`,
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
  subject: 'Invoices', topic: 'Billing', client: 'Pat Chen', amount: '$450.00', what: 'Invoice 1042', how: 'online', reference: 'pi_3Q8x2L', referrer: 'Pat Chen', request: 'The AC upstairs is blowing warm air.', rating: '5/5', kind: 'Idea or suggestion', title: 'Plan changed: Rivera HVAC → Pro',
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
function html(body, v) {
  const vals = []; const hold = (k) => { vals.push(k); return `\u0000${vals.length - 1}\u0000`; };
  const src = String(body).replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in v ? hold(k) : m));
  const put = (s, attr) => s.replace(/\u0000(\d+)\u0000/g, (m, i) => (attr ? esc(v[vals[i]]) : esc(v[vals[i]]).replace(/\n/g, '<br>')));
  const inline = (s) => put(esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a href="${put(u, true)}" style="color:${C.brand};font-weight:600">${t}</a>`));
  return src.trim().split(/\n\s*\n/).map((block) => {
    const b = block.trim(); if (!b.replace(/\u0000(\d+)\u0000/g, (m, i) => String(v[vals[i]] ?? '')).replace(/^>\s?/gm, '').trim()) return ''; // e.g. a quote box whose value is empty
    const btn = b.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (btn) return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:${C.brand};border-radius:10px"><a href="${put(btn[2], true)}" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${put(esc(btn[1]))}</a></td></tr></table>`;
    if (b.startsWith('# ')) return `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:26px;line-height:1.2;letter-spacing:-0.02em;color:${C.text}">${inline(b.slice(2))}</h1>`;
    if (b.split('\n').every((l) => l.startsWith('>'))) return `<div style="margin:0 0 18px;padding:14px 18px;background:${C.soft};border-left:4px solid ${C.brand};border-radius:8px;font-size:15px;line-height:1.6;color:${C.text}">${b.split('\n').map((l) => inline(l.replace(/^>\s?/, ''))).join('<br>')}</div>`;
    return `<p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:${C.text}">${b.split('\n').map(inline).join('<br>')}</p>`;
  }).filter(Boolean).join('\n');
}
function layout(content, v) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(v.product)}</title></head>
<body style="margin:0;padding:0;background:${C.tint};font-family:${FONT};-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.tint}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:30px;height:30px;background:${C.brand};border-radius:8px;text-align:center;vertical-align:middle;color:#ffffff;font-size:17px;font-weight:800;line-height:30px">&#10003;</td>
<td style="padding-left:10px;font-family:${FONT};font-size:18px;font-weight:800;color:${C.navy};letter-spacing:-0.01em">${esc(v.product)}</td></tr></table></td></tr>
<tr><td style="background:#ffffff;border:1px solid ${C.line};border-radius:18px;padding:36px 32px 18px;font-family:${FONT}">${content}</td></tr>
<tr><td style="padding:20px 4px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};text-align:center">Sent by ${esc(v.product)} &middot; &copy; ${esc(v.year)}</td></tr>
</table></td></tr></table></body></html>`;
}
// the plain-text copy: buttons and links become "text: url", markup is dropped
const text = (body, v) => fill(String(body).replace(/^# /gm, '').replace(/^>\s?/gm, '  ').replace(/\*\*(.+?)\*\*/g, '$1')
  .replace(/^\[([^\]]+)\]\(([^)\s]+)\)$/gm, '$1: $2').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)'), v).replace(/^\s+$/gm, '').replace(/\n{3,}/g, '\n\n').trim() + `\n\n${v.product}`;

function render(key, vars = {}, override) {
  const t = override || template(key); const v = allVars(vars);
  return { subject: fill(t.subject, v).replace(/\s+/g, ' ').trim(), text: text(t.body, v), html: layout(html(t.body, v), v) };
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

module.exports = { TEMPLATES, render, sample, list, save, reset, details };
