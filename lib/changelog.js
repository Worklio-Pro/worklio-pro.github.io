// What's new: the updates the bell in the app's top bar lists, newest first, and the Changelog tab on ideas.<domain> (lib/ideas.js) shows them all.
// Add an entry at the top for each release. tag: new, improved or fixed. A body line that starts with "- " is a bullet,
// "## " a heading; other lines are paragraphs.
const ENTRIES = [
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
