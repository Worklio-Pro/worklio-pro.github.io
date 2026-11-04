// What's new: the updates the bell in the app's top bar lists, newest first, and the /changelog page that shows them all.
// Add an entry at the top for each release. tag: new, improved or fixed. A body line that starts with "- " is a bullet,
// "## " a heading; other lines are paragraphs.
const ENTRIES = [
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

function page(productName) {
  const items = ENTRIES.map((e) => `<article class="cl-entry" id="${esc(e.id)}" data-tag="${esc(e.tag)}">
  <div class="cl-date"><time datetime="${esc(e.date)}">${esc(niceDate(e.date))}</time></div>
  <div class="cl-card"><span class="cl-tag cl-${esc(e.tag)}">${esc(TAGS[e.tag])}</span><h2>${esc(e.title)}</h2>${bodyHtml(e.body)}</div>
</article>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>What’s new</title><meta name="color-scheme" content="light dark"><link rel="icon" href="/favicon.ico">
<script>try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}</script>
<style>
:root{--bg:#f6f7f9;--card:#fff;--text:#1d2330;--muted:#5f6878;--line:#e3e6eb;--new:#1f8a4c;--improved:#2f6fdb;--fixed:#8a5a00;--focus:#2f6fdb}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#12151b;--card:#1b1f27;--text:#e8ebf0;--muted:#9aa3b2;--line:#2c323d;--new:#4cc583;--improved:#6ea0f5;--fixed:#e0b04f;--focus:#6ea0f5}}
:root[data-theme=dark]{--bg:#12151b;--card:#1b1f27;--text:#e8ebf0;--muted:#9aa3b2;--line:#2c323d;--new:#4cc583;--improved:#6ea0f5;--fixed:#e0b04f;--focus:#6ea0f5}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.cl-wrap{max-width:900px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:30px;line-height:1.2;margin:0 0 4px}
.cl-sub{color:var(--muted);margin:0 0 20px}
.cl-tools{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:28px}
.cl-tools input,.cl-tools select{font:inherit;font-size:15px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--text)}
.cl-tools input{flex:1;min-width:0}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.cl-entry{display:grid;grid-template-columns:170px 1fr;gap:20px;padding:24px 0;border-top:1px solid var(--line);scroll-margin-top:16px}
.cl-entry[hidden]{display:none}
.cl-date{color:var(--muted);font-size:14px;padding-top:4px}
.cl-card h2{font-size:21px;line-height:1.3;margin:8px 0 10px}
.cl-card h3{font-size:16px;margin:18px 0 6px}
.cl-card p{margin:0 0 10px}.cl-card ul{margin:0 0 10px;padding-left:22px}.cl-card li{margin:3px 0}
.cl-tag{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:4px;border:1px solid currentColor}
.cl-new{color:var(--new)}.cl-improved{color:var(--improved)}.cl-fixed{color:var(--fixed)}
.cl-entry:target .cl-card h2{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:4px}
.cl-back{display:none;align-items:center;gap:4px;margin:-12px 0 16px -6px;padding:6px 10px 6px 4px;border-radius:8px;color:var(--text);font-size:15px;font-weight:600;text-decoration:none}
.cl-back:hover{background:var(--line)}
.cl-none{color:var(--muted);padding:24px 0;border-top:1px solid var(--line)}
@media (max-width:640px){.cl-back{display:inline-flex}.cl-entry{grid-template-columns:1fr;gap:4px}.cl-date{padding:0}h1{font-size:26px}}
</style>
</head>
<body>
<main class="cl-wrap">
<a class="cl-back" href="/" onclick="if(history.length>1){history.back();return false}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Back</a>
<h1>What’s new</h1>
<p class="cl-sub">The latest improvements and updates to ${esc(productName)}.</p>
<div class="cl-tools" role="search">
<input type="search" id="clq" placeholder="Search updates" aria-label="Search updates" autocomplete="off">
<select id="clt" aria-label="Show"><option value="">All updates</option>${Object.entries(TAGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
</div>
${items}
<p class="cl-none" id="clnone" hidden>No updates match your search.</p>
</main>
<script>
(function(){var q=document.getElementById('clq'),t=document.getElementById('clt'),all=[].slice.call(document.querySelectorAll('.cl-entry'));
function f(){var w=q.value.trim().toLowerCase(),k=t.value,n=0;all.forEach(function(e){var ok=(!k||e.dataset.tag===k)&&(!w||e.textContent.toLowerCase().indexOf(w)>=0);e.hidden=!ok;if(ok)n++;});document.getElementById('clnone').hidden=n>0;}
q.addEventListener('input',f);t.addEventListener('change',f);})();
</script>
</body>
</html>`;
}

module.exports = { ENTRIES, TAGS, latest, page };
