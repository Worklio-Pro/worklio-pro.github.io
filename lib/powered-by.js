// "Powered by Worklio Pro · Try it free": a small link on everything a business sends its clients (client pages such as pay,
// quote, review and booking, the emails, the PDFs, the business card and the client portal), so the people they work with
// can find the app. Always on for every plan for now; a white-label option can switch it off later.
// - The link is <platform>/from/<account address>?w=<where>: it counts the visit (per month, by where it was clicked), remembers
//   the account in the wp_from cookie for COOKIE_DAYS and opens the home page (its free trial).
// - A sign-up within that time records which account it came from (t.signupFrom) and says so in the new sign-up email.
// Stored in platform.json: poweredBy = { clicks: { 'YYYY-MM': { total, where: { email: n, … } } }, signups: [{ at, tenantId, fromId }] }.
const tenancy = require('./tenancy');

const COOKIE_DAYS = 60;
const WHERE = ['email', 'page', 'pay', 'quote', 'review', 'book', 'card', 'portal', 'pdf'];
const P = () => tenancy.platform();
const product = () => P().settings.productName || 'Worklio Pro';
const store = () => (P().poweredBy = P().poweredBy || { clicks: {}, signups: [] });
const bySlug = (slug) => P().tenants.find((t) => t.slug === String(slug || '').toLowerCase());
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// the link for the account being served (or t), tagged with where it was shown
function url(where, t = tenancy.current()) {
  return `${tenancy.platformUrl()}/from/${encodeURIComponent((t && t.slug) || '')}${WHERE.includes(where) ? `?w=${where}` : ''}`;
}
// for print (PDFs): the address without https:// or ?w=, short enough to type
const shortUrl = (t = tenancy.current()) => url('', t).replace(/^https?:\/\//, '');
// the words, already translated by the caller's tx (client pages and emails are in the client's language)
// without a tx (the business card is English only), {product} is still filled in
const plain = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
// lead: the first words, the same everywhere (pages, emails, PDFs, the business card)
const words = (tx = plain, lead = 'Powered by {product}') => ({ sent: tx(lead, { product: product() }), try: tx('Try it free') });
// the HTML line for client pages: "Powered by Worklio Pro · Try it free", small and grey under the card
// color: for pages with their own colors (the business card passes 'inherit' and dims it)
function html(where, tx, { style = '', color = '#6b7280', lead } = {}) {
  const w = words(tx, lead); const u = esc(url(where));
  return `<p class="wp-sent" style="text-align:center;font:13px/1.5 system-ui,sans-serif;color:${color};margin:16px auto 28px;${style}"><a href="${u}" target="_blank" rel="noopener" style="color:${color};text-decoration:none">${esc(w.sent)}</a> · <a href="${u}" target="_blank" rel="noopener" style="color:${color}">${esc(w.try)}</a></p>`;
}

// GET /from/:slug — count it, remember it, open the home page
function click(slug, where) {
  const t = bySlug(slug); if (!t) return { cookie: null };
  const s = store(); const m = new Date().toISOString().slice(0, 7);
  const row = (s.clicks[m] = s.clicks[m] || { total: 0, where: {} }); row.total++;
  const w = WHERE.includes(where) ? where : 'page'; row.where[w] = (row.where[w] || 0) + 1;
  tenancy.savePlatform();
  return { cookie: `wp_from=${t.slug}; Max-Age=${COOKIE_DAYS * 86400}; Path=/; SameSite=Lax${tenancy.devMode ? '' : '; Secure'}` };
}

// at sign-up: which account's client this came from, if any (never the new account itself)
function signedUp(t, cookieHeader) {
  const m = /(?:^|;\s*)wp_from=([a-z0-9-]+)/i.exec(String(cookieHeader || '')); if (!m) return;
  const from = bySlug(m[1]); if (!from || from.id === t.id) return;
  t.signupFrom = { id: from.id, name: from.name, slug: from.slug, at: new Date().toISOString() };
  store().signups.push({ at: t.signupFrom.at, tenantId: t.id, fromId: from.id });
}
// the line for the new sign-up email
const howNote = (t) => (t && t.signupFrom ? `; came from a “Powered by ${product()}” link on something ${t.signupFrom.name} sent` : '');

module.exports = { product, url, shortUrl, words, html, click, signedUp, howNote, WHERE };
