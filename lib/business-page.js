// The business page: a one-page digital business card at <account address>/card, which the business QR code opens.
// It shows the logo, name, description, buttons to call, email, visit the website, get directions and book, the business's links,
// a Save contact button (a vCard) and, if turned on, a form for people to leave their details (Exchange contact).
// Settings → Business Page edits it (db.businessPage); anything not set comes from the Company Profile.
// The QR code links to /card?qr=1, so scans are counted and can be limited (a number of scans, or an end date).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const err = (message) => Object.assign(new Error(message), { status: 400 });

// the links a page can have: key, name, and how a handle (@yourbusiness) becomes a link, for networks that use handles
const NETWORKS = {
  facebook: ['Facebook', (h) => `https://www.facebook.com/${h}`], instagram: ['Instagram', (h) => `https://www.instagram.com/${h}`],
  x: ['X', (h) => `https://x.com/${h}`], linkedin: ['LinkedIn', null], youtube: ['YouTube', (h) => `https://www.youtube.com/@${h}`],
  tiktok: ['TikTok', (h) => `https://www.tiktok.com/@${h}`], pinterest: ['Pinterest', (h) => `https://www.pinterest.com/${h}`],
  threads: ['Threads', (h) => `https://www.threads.net/@${h}`], bluesky: ['Bluesky', (h) => `https://bsky.app/profile/${h.includes('.') ? h : h + '.bsky.social'}`],
  google: ['Google reviews', null], yelp: ['Yelp', null], nextdoor: ['Nextdoor', null], whatsapp: ['WhatsApp', (h) => `https://wa.me/${h.replace(/\D/g, '')}`],
};
// the sample cover images: gradients, so there's nothing to load
const COVERS = {
  sky: 'linear-gradient(170deg,#7dd3fc 0%,#e9d5ff 45%,#bae6fd 70%,#38bdf8 100%)', aqua: 'linear-gradient(135deg,#a5f3fc,#38bdf8 60%,#7dd3fc)',
  sunset: 'linear-gradient(180deg,#0d9488 0%,#14b8a6 45%,#f97316 70%,#fb923c 100%)', lime: 'linear-gradient(135deg,#fef08a,#bef264 50%,#86efac)',
  ocean: 'linear-gradient(170deg,#1e3a8a,#0891b2 50%,#f9a8d4)', violet: 'linear-gradient(135deg,#c4b5fd,#a78bfa 45%,#f0abfc 80%,#e0f2fe)',
  night: 'radial-gradient(circle at 70% 30%,#4b5563,#111827 55%,#000)',
};
const HEX = /^#[0-9a-f]{6}$/i;
const COLORS = { pageColor: '#FFFFFF', textColor: '#111111', iconColor: '#111111', buttonColor: '#111111', buttonTextColor: '#FFFFFF' };

// "yourbusiness.com/page" → https://…; a handle → the network's link; anything else → ''
function linkUrl(kind, v) {
  v = String(v || '').trim(); if (!v) return '';
  const N = NETWORKS[kind];
  if (N && N[1] && /^@?[\w.+-]{1,60}$/.test(v) && !/\.(com|net|org|co|app|biz|us)$/i.test(v)) return N[1](v.replace(/^@/, ''));
  const u = /^https?:\/\//i.test(v) ? v : /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v) ? 'https://' + v : '';
  try { const p = new URL(u); return ['http:', 'https:'].includes(p.protocol) && p.hostname.includes('.') ? p.href : ''; } catch (e) { return ''; }
}

// what a page shows before it's been edited: the Company Profile's details and social links
function defaults(co) {
  return {
    name: co.name || '', description: '', email: co.email || '', phone: co.phone || '', website: co.website || '', address: co.addressPrivate ? '' : co.address || '',
    logo: co.logo || '', logoOpacity: 100, cover: 'sky', coverOpacity: 100, ...COLORS, showLabels: true,
    links: Object.entries(co.social || {}).filter(([k]) => NETWORKS[k]).map(([kind, url]) => ({ kind, url })),
    exchange: false, scanLimit: { on: false, max: 100 }, expiry: { on: false, date: '' }, qr: { ...QR_DEFAULT, header: { ...QR_DEFAULT.header }, footer: { ...QR_DEFAULT.footer } },
  };
}
const view = (saved, co) => { const d = defaults(co); const v = { ...d, ...(saved || {}) }; v.qr = { ...d.qr, ...((saved && saved.qr) || {}) }; return v; };

// the QR code's look (Settings → Business Page → QR code appearance); public/qr.js draws it. Its logo is a sample's name
// (QR_LOGOS, drawn in the browser), the company logo, or an uploaded image; the server saves uploads before cleanQr runs
const QR_DEFAULT = { bg: '#FFFFFF', dots: '#000000', mBorder: '#000000', mCenter: '#000000', shape: 'square', dot: 'square', border: 'square', center: 'square', frame: 'none', logo: '', logoClear: true, bgImg: '', bgOpacity: 100,
  header: { text: '', font: 'Arial', color: '#000000' }, footer: { text: '', font: 'Arial', color: '#000000' } };
const QR_CHOICES = { shape: ['square', 'rounded', 'circle'], dot: ['square', 'rounded', 'dots', 'diamond', 'vertical', 'horizontal'], border: ['square', 'rounded', 'circle'], center: ['square', 'circle'], frame: ['none', 'border', 'frame'] };
const QR_FONTS = ['Arial', 'Helvetica', 'Verdana', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Courier New'];
const QR_LOGOS = ['company', 'google', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'x', 'pinterest', 'threads', 'bluesky', 'phone', 'email', 'website', 'book'];
function cleanQr(q = {}) {
  const out = {};
  for (const k of ['bg', 'dots', 'mBorder', 'mCenter']) { if (!HEX.test(q[k] || '')) throw err('Choose each QR code color as a hex code, like #1A2B3C'); out[k] = q[k].toUpperCase(); }
  for (const [k, list] of Object.entries(QR_CHOICES)) out[k] = list.includes(q[k]) ? q[k] : QR_DEFAULT[k];
  out.logoClear = q.logoClear !== false; out.bgOpacity = Math.max(0, Math.min(100, Math.round(Number(q.bgOpacity) || 0)));
  for (const k of ['header', 'footer']) { const t = q[k] || {}; if (t.color && !HEX.test(t.color)) throw err('Choose the text color as a hex code, like #1A2B3C'); out[k] = { text: String(t.text || '').trim().slice(0, 40), font: QR_FONTS.includes(t.font) ? t.font : 'Arial', color: (t.color || '#000000').toUpperCase() }; }
  return out;
}

// checks what Settings → Business Page sent; images (logo, cover) are handled by the server, which saves them first
function clean(b) {
  const s = (k, n) => String(b[k] ?? '').trim().slice(0, n);
  const out = { name: s('name', 100), description: s('description', 500), email: s('email', 120), phone: s('phone', 40), address: s('address', 300), showLabels: b.showLabels !== false, exchange: !!b.exchange };
  if (!out.name) throw err('Enter your company name');
  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) throw err('Check the email address');
  out.website = s('website', 300) ? linkUrl('', s('website', 300)) : ''; if (s('website', 300) && !out.website) throw err('Check the website address, like yourbusiness.com');
  for (const k of ['logoOpacity', 'coverOpacity']) out[k] = Math.max(0, Math.min(100, Math.round(Number(b[k]) || 0)));
  for (const k of Object.keys(COLORS)) { if (!HEX.test(b[k] || '')) throw err('Choose each color as a hex code, like #1A2B3C'); out[k] = b[k].toUpperCase(); }
  out.links = [];
  for (const l of (Array.isArray(b.links) ? b.links : []).slice(0, 20)) {
    const kind = l.kind === 'custom' ? 'custom' : NETWORKS[l.kind] ? l.kind : ''; if (!kind) continue;
    const url = linkUrl(kind, l.url); const label = String(l.label || '').trim().slice(0, 40);
    if (!String(l.url || '').trim()) continue; // a row left empty
    if (!url) throw err(`Check the ${kind === 'custom' ? label || 'custom' : NETWORKS[kind][0]} link${NETWORKS[kind] && NETWORKS[kind][1] ? ', or enter your handle like @yourbusiness' : ''}`);
    if (kind === 'custom' && !label) throw err('Give each custom link a name');
    out.links.push(kind === 'custom' ? { kind, label, url, ...(ICON_NAMES[l.icon] ? { icon: l.icon } : {}) } : { kind, url });
  }
  const max = Math.round(Number(b.scanLimit && b.scanLimit.max) || 0); const date = String((b.expiry && b.expiry.date) || '');
  out.scanLimit = { on: !!(b.scanLimit && b.scanLimit.on), max: Math.max(1, Math.min(1e7, max || 100)) };
  out.expiry = { on: !!(b.expiry && b.expiry.on), date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '' };
  if (out.expiry.on && !out.expiry.date) throw err('Choose the date the QR code stops working');
  return out;
}
// whether a QR scan still opens the page: today is the business's local date (YYYY-MM-DD); the page stops working after its end date
const qrActive = (p, scans, today) => !(p.scanLimit && p.scanLimit.on && scans >= p.scanLimit.max) && !(p.expiry && p.expiry.on && p.expiry.date && today > p.expiry.date);

// simple line icons, drawn in the page's icon color
const ICON = {
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  directions: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  book: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  save: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
  swap: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
  // the networks, as outline icons in the same style (social links show as icons next to Phone, Email and Website)
  facebook: '<circle cx="12" cy="12" r="9"/><path d="M15 7.5h-1.5a2.5 2.5 0 0 0-2.5 2.5v11M8.5 13h6"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7v.01"/>',
  x: '<path d="M4.5 4h4L19.5 20h-4z"/><path d="M19 4l-6 6.8M11 13.2 5 20"/>',
  linkedin: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M8 10.5V16.5M8 7.5v.01M11.5 16.5v-6M11.5 13a2.5 2.5 0 0 1 5 0v3.5"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.3v5.4l4.6-2.7z"/>',
  tiktok: '<path d="M14 3.5v11a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3.5c.4 2.6 2.4 4.6 5 4.8"/>',
  pinterest: '<circle cx="12" cy="12" r="9"/><path d="m11 21 1.8-7.8M9.2 14c-1-.6-1.5-1.6-1.5-2.8C7.7 8.8 9.6 7 12.2 7c2.5 0 4.3 1.6 4.3 4 0 2.6-1.4 4.6-3.4 4.6-1 0-1.6-.6-1.4-1.6"/>',
  threads: '<circle cx="12" cy="12" r="3.5"/><path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.4 6.8"/>',
  bluesky: '<path d="M12 11c-1.4-2.8-4.4-6-6.8-6C3.7 5 3.8 7 4.2 9.3c.5 2.4 2.5 3 4.4 2.8-2.9.6-3.4 2.5-1.5 4.2 2.9 2.6 4.4-1 4.9-2.5.5 1.5 2 5.1 4.9 2.5 1.9-1.7 1.4-3.6-1.5-4.2 1.9.2 3.9-.4 4.4-2.8.4-2.3.5-4.3-1-4.3-2.4 0-5.4 3.2-6.8 6z"/>',
  google: '<path d="M19.2 7.5A8.5 8.5 0 1 0 20.5 12H12.5"/>',
  yelp: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
  nextdoor: '<path d="M3.5 11 12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>',
  whatsapp: '<path d="M3.5 20.5 4.9 16A8.5 8.5 0 1 1 8.2 19.4z"/><path d="M9 8.3c0 3.6 3 6.7 6.7 6.7l.9-1.6-2-1-1 1c-1.3-.5-2.5-1.7-3-3l1-1-1-2z"/>',
};
// more icons a custom link can use (Links → Add custom link), with the networks' icons above
Object.assign(ICON, {
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>', star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
  heart: '<path d="M12 20s-7-4.4-9-8.6C1.6 8.3 3.6 5 6.8 5c2 0 3.4 1.1 5.2 3 1.8-1.9 3.2-3 5.2-3 3.2 0 5.2 3.3 3.8 6.4C19 15.6 12 20 12 20z"/>',
  dollar: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1.2-1.7-2-3-2-1.7 0-3 1-3 2.3 0 3 6 1.7 6 4.6 0 1.3-1.3 2.3-3 2.3-1.4 0-2.6-.8-3.1-2M12 5.5v13"/>',
  document: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>', image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5z"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>', cart: '<path d="M3 4h2.5l2.2 11h10.6L21 7H6.4"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5-3.5-5-1.5S10 8 12 8c2 0 5-.5 5-1.5S13.5 5 12 8z"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>', briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',
  home: '<path d="M3.5 11 12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>', tool: '<path d="M15 4a5 5 0 0 0-4.8 6.4L4 16.6 7.4 20l6.2-6.2A5 5 0 0 0 20 9l-3 3-3-1-1-3 3-3z"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>', leaf: '<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15M5 19l7-7"/>',
  contact: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10.5" r="2.5"/><path d="M5.5 16.5a3.5 3.5 0 0 1 7 0M15 9h3M15 13h3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/>', sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
});
// the icons a custom link can pick, with the names the icon search matches
const ICON_NAMES = { link: 'Link', website: 'Website globe', phone: 'Phone call', email: 'Email mail', book: 'Calendar booking', directions: 'Map location directions', chat: 'Chat message',
  star: 'Star reviews', heart: 'Heart', dollar: 'Money pay dollar', document: 'Document file menu', image: 'Image photo gallery', camera: 'Camera photos', play: 'Play video', music: 'Music',
  cart: 'Cart shop store', gift: 'Gift card', tag: 'Tag price deals', briefcase: 'Briefcase work careers jobs', home: 'Home house', tool: 'Tool wrench service repair', truck: 'Truck delivery',
  leaf: 'Leaf lawn garden', contact: 'Contact card', clock: 'Clock hours', info: 'Info about', shield: 'Shield warranty insurance', sparkle: 'Sparkle clean new',
  ...Object.fromEntries(Object.entries(NETWORKS).map(([k, [n]]) => [k, n])) };
const SHORT = { google: 'Google' }; // a name under an icon has to be short
const icon = (k, size = 26) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const img = (u) => /^(\/uploads\/[\w.-]+|data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+)$/.test(u || '') ? u : '';

// o: { book (the booking page, when the plan has it), back (opened from the app: a Back button at the top left), preview (Settings' phone preview: nothing is sent), done, error, values }
function render(p, o = {}) {
  const tel = String(p.phone || '').replace(/[^\d+]/g, '');
  const acts = [
    tel && ['phone', 'Phone', `tel:${tel}`], p.email && ['email', 'Email', `mailto:${p.email}`], p.website && ['website', 'Website', p.website],
    p.address && ['directions', 'Directions', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`], o.book && ['book', 'Book', o.book],
    ...p.links.filter((l) => l.kind !== 'custom').map((l) => [l.kind, SHORT[l.kind] || NETWORKS[l.kind][0], l.url]),
  ].filter(Boolean);
  // a custom link with an icon joins them; one without stays a button with its name
  acts.splice(acts.length, 0, ...p.links.filter((l) => l.kind === 'custom' && ICON[l.icon]).map((l) => [l.icon, l.label, l.url]));
  const custom = p.links.filter((l) => l.kind === 'custom' && !ICON[l.icon]);
  const cover = img(p.cover) ? `url("${p.cover}") center/cover` : COVERS[p.cover] || COVERS.sky; const logo = img(p.logo);
  const v = o.values || {}; const ext = (u) => (/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : '');
  const exchange = p.exchange ? (o.done ? `<p class="bp-done">Thanks${v.name ? ', ' + esc(String(v.name).split(/\s+/)[0]) : ''}! We got your details and will be in touch.</p>`
    : `<details class="bp-ex"${o.error ? ' open' : ''}><summary class="bp-btn alt">${icon('swap', 20)}Exchange contact</summary>
<form method="post" action="/card/exchange">${o.error ? `<p class="bp-err">${esc(o.error)}</p>` : ''}<input name="name" placeholder="Your name" required maxlength="100" value="${esc(v.name)}" autocomplete="name">
<input name="email" type="email" placeholder="Email" maxlength="120" value="${esc(v.email)}" autocomplete="email"><input name="phone" type="tel" placeholder="Phone" maxlength="40" value="${esc(v.phone)}" autocomplete="tel">
<textarea name="message" rows="3" maxlength="2000" placeholder="How can we help? (optional)">${esc(v.message)}</textarea><input name="website" tabindex="-1" autocomplete="off" class="bp-hp" aria-hidden="true">
<button class="bp-btn"${o.preview ? ' type="button"' : ''}>Send my details</button></form></details>`) : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.name)}</title>${o.preview ? '<base target="_blank">' : ''}
${p.description ? `<meta name="description" content="${esc(p.description)}">` : ''}<meta property="og:title" content="${esc(p.name)}">${logo && !logo.startsWith('data:') ? `<link rel="icon" href="${esc(logo)}">` : ''}
<style>*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:${p.pageColor};color:${p.textColor};min-height:100vh}
.bp{max-width:480px;margin:0 auto;padding-bottom:96px;text-align:center}.bp-cover{height:150px;position:relative;overflow:hidden}.bp-cover i{position:absolute;inset:0;background:${cover};opacity:${p.coverOpacity / 100}}
.bp-logo{width:116px;height:116px;margin:-58px auto 0;position:relative;border-radius:50%;background:${p.pageColor};border:4px solid ${p.pageColor};box-shadow:0 2px 10px rgba(0,0,0,.12);overflow:hidden;display:flex;align-items:center;justify-content:center}
.bp-logo img{width:100%;height:100%;object-fit:contain;opacity:${p.logoOpacity / 100}}.bp-logo b{font-size:40px;color:${p.iconColor}}
h1{margin:16px 20px 6px;font-size:24px}.bp-desc{margin:0 24px 6px;font-size:15px;white-space:pre-line}.bp-addr{margin:0 24px;font-size:13px;opacity:.75}
.bp-acts{display:grid;grid-template-columns:repeat(3,1fr);gap:22px 8px;max-width:330px;margin:24px auto 8px;padding:0 16px}.bp-acts a{display:flex;flex-direction:column;align-items:center;gap:7px;color:${p.iconColor};text-decoration:none;font-size:12px;font-weight:600;min-width:0}.bp-acts svg{width:30px;height:30px}
.bp-links{display:flex;flex-direction:column;gap:10px;margin:18px 20px 0}.bp-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px 16px;border-radius:99px;border:0;background:${p.buttonColor};color:${p.buttonTextColor};font-weight:600;font-size:15px;font-family:inherit;text-decoration:none;cursor:pointer}
.bp-btn.alt{background:transparent;color:${p.textColor};border:1.5px solid ${p.buttonColor}}.bp-ex{margin:12px 20px 0}.bp-ex summary{list-style:none}.bp-ex summary::-webkit-details-marker{display:none}
.bp-ex form{display:flex;flex-direction:column;gap:8px;margin-top:12px;text-align:left}.bp-ex input,.bp-ex textarea{width:100%;padding:11px 12px;border:1px solid rgba(127,127,127,.4);border-radius:10px;font:inherit;background:#fff;color:#111}
.bp-hp{position:absolute;left:-9999px}.bp-err{color:#b91c1c;margin:0;font-size:14px}.bp-done{margin:16px 20px 0;padding:12px;border-radius:12px;background:rgba(22,163,74,.12);font-size:15px}
.bp-back{position:fixed;top:12px;left:12px;z-index:2;display:flex;align-items:center;gap:6px;padding:8px 14px 8px 10px;border-radius:99px;background:rgba(255,255,255,.92);color:#111;font-size:14px;font-weight:600;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.bp-save{position:fixed;left:0;right:0;bottom:0;padding:12px 20px calc(12px + env(safe-area-inset-bottom));background:linear-gradient(transparent,${p.pageColor} 35%)}.bp-save .bp-btn{max-width:440px;margin:0 auto;box-shadow:0 4px 14px rgba(0,0,0,.18)}</style></head>
<body>${o.back ? '<a class="bp-back" href="/settings/business-page" onclick="if(history.length>1){history.back();return false}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Back</a>' : ''}<main class="bp"><div class="bp-cover"><i></i></div><div class="bp-logo">${logo ? `<img src="${esc(logo)}" alt="">` : `<b>${esc((p.name || '?').trim().charAt(0).toUpperCase())}</b>`}</div>
<h1>${esc(p.name)}</h1>${p.description ? `<p class="bp-desc">${esc(p.description)}</p>` : ''}${p.address ? `<p class="bp-addr">${esc(p.address)}</p>` : ''}
${acts.length ? `<nav class="bp-acts">${acts.map(([k, label, href]) => `<a href="${esc(href)}"${ext(href)} aria-label="${esc(label)}">${icon(k)}${p.showLabels ? `<span>${esc(label)}</span>` : ''}</a>`).join('')}</nav>` : ''}
${custom.length ? `<div class="bp-links">${custom.map((l) => `<a class="bp-btn" href="${esc(l.url)}" target="_blank" rel="noopener">${icon('link', 18)}${esc(l.label)}</a>`).join('')}</div>` : ''}
${exchange}</main><div class="bp-save"><a class="bp-btn" href="/card/contact.vcf" download>${icon('save', 20)}Save contact</a></div></body></html>`;
}

// the page when the QR code has reached its scan limit or end date
const expiredPage = (name) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QR code expired</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f6f8;color:#111827;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px;box-sizing:border-box">
<div style="background:#fff;border-radius:16px;padding:32px;max-width:400px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08)"><h1 style="font-size:22px;margin:0 0 8px">This QR code has expired</h1>
<p style="color:#6b7280;margin:0">It no longer opens ${esc(name) || 'this business'}’s page. Ask them for a new one.</p></div></body></html>`;

// Save contact: a vCard (version 3.0) the phone adds to its contacts
function vcard(p, url) {
  const e = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  return ['BEGIN:VCARD', 'VERSION:3.0', `FN:${e(p.name)}`, `ORG:${e(p.name)}`, p.phone && `TEL;TYPE=WORK,VOICE:${e(p.phone)}`, p.email && `EMAIL;TYPE=WORK:${e(p.email)}`,
    p.website && `URL:${e(p.website)}`, p.address && `ADR;TYPE=WORK:;;${e(p.address)};;;;`, p.description && `NOTE:${e(p.description)}`, url && `URL;TYPE=card:${e(url)}`, 'END:VCARD'].filter(Boolean).join('\r\n') + '\r\n';
}

module.exports = { ICON, ICON_NAMES, NETWORKS, COVERS, COLORS, defaults, view, clean, cleanQr, QR_LOGOS, QR_FONTS, render, expiredPage, vcard, qrActive, linkUrl };
