// The Founding Supporters list (managed in Alpha → Promotions → Founding Supporters): a public thank-you page at /supporters
// naming the people who backed the product, e.g. on Kickstarter. Names are grouped by reward tier, biggest first.
// While the list is off, /supporters goes to the home page and the footer link is hidden.
const crypto = require('crypto');
const tenancy = require('./tenancy');
const industries = require('./industries');

const P = () => tenancy.platform();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fail = (msg, status = 400) => { throw Object.assign(new Error(msg), { status }); };
const TIERS = ['Founding Crew', 'Expert', 'Advanced', 'Core', 'Supporter']; // page order; '' is "no tier", listed last
const DEFAULTS = { enabled: false, title: 'Our Founding Supporters', intro: 'These people backed {product} before anyone else did. Thank you for helping us build it.', people: [] };
const store = () => (P().supporters = { ...DEFAULTS, ...(P().supporters || {}) });
const tierOf = (s) => (TIERS.includes(s) ? s : '');
const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80);
const fill = (s) => esc(s).replace(/\{product\}/g, esc(P().settings.productName || 'Worklio Pro'));

const isOn = () => !!store().enabled && store().people.length > 0;
const adminView = () => { const s = store(); return { enabled: s.enabled, title: s.title, intro: s.intro, tiers: TIERS, people: s.people }; };

function saveSettings(b) {
  const s = store(); const title = String(b.title || '').trim();
  if (!title) fail('Give the page a title');
  Object.assign(s, { enabled: !!b.enabled, title: title.slice(0, 80), intro: String(b.intro || '').trim().slice(0, 400) });
  tenancy.savePlatform();
}
// one name per line (e.g. pasted from a Kickstarter backer export); names already on the list are skipped
function add(b) {
  const s = store(); const tier = tierOf(b.tier); const have = new Set(s.people.map((x) => x.name.toLowerCase()));
  const names = String(b.names || '').split(/\r?\n/).map(cleanName).filter(Boolean);
  if (!names.length) fail('Enter at least one name');
  let added = 0;
  for (const name of names) {
    if (have.has(name.toLowerCase())) continue;
    have.add(name.toLowerCase()); s.people.push({ id: crypto.randomBytes(5).toString('hex'), name, tier, addedAt: new Date().toISOString() }); added++;
  }
  tenancy.savePlatform();
  return { added, skipped: names.length - added };
}
function update(id, b) {
  const x = store().people.find((p) => p.id === id); if (!x) fail('That supporter isn’t on the list', 404);
  if ('name' in b) { const name = cleanName(b.name); if (!name) fail('Enter a name'); x.name = name; }
  if ('tier' in b) x.tier = tierOf(b.tier);
  tenancy.savePlatform();
}
function remove(id) {
  const s = store(); const n = s.people.length; s.people = s.people.filter((p) => p.id !== id);
  if (s.people.length === n) fail('That supporter isn’t on the list', 404);
  tenancy.savePlatform();
}

// ---------- the public page ----------
const footerLink = () => (isOn() ? '<a href="/supporters">Founding Supporters</a>' : '');
function page() {
  if (!isOn()) return null;
  const s = store();
  const groups = [...TIERS, ''].map((t) => [t, s.people.filter((p) => p.tier === t).sort((a, b) => a.name.localeCompare(b.name))]).filter(([, l]) => l.length);
  return industries.shell({ title: s.title, description: `The people who backed ${P().settings.productName || 'Worklio Pro'} from the start.`,
    body: `
    <section class="h-hero"><div class="h-wrap i-hero-solo">
      <span class="h-eyebrow">Thank you</span>
      <h1>${esc(s.title)}</h1>
      ${s.intro ? `<p class="lead">${fill(s.intro)}</p>` : ''}
    </div></section>
    <section class="h-sec" style="padding-top:12px"><div class="h-wrap s-tiers">
      ${groups.map(([t, l]) => `<div class="s-tier${t === 'Founding Crew' ? ' s-top' : ''}"><h2>${t ? esc(t) : 'Supporters'} <span>${l.length}</span></h2><ul>${l.map((p) => `<li>${esc(p.name)}</li>`).join('')}</ul></div>`).join('')}
    </div></section>` });
}

module.exports = { TIERS, isOn, adminView, saveSettings, add, update, remove, page, footerLink };
