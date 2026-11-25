// Free Google review link and QR code generator (/tools/google-review-qr-code), for searches like "google review link" or
// "google review qr code". The owner finds their business (name and town, or a Google Maps link: lookup() below asks Google Places
// with the platform's key) and gets Google's write-a-review link for it, a QR code, a "Review us on Google" card to download, a
// printable counter sign and business cards, and a message to send clients. Without a Places key, or when it's not their business,
// they paste their review link (or Place ID) instead. The rest runs in the browser (public/review-qr.js, QR codes from public/qr.js).
// Any other review link (Facebook, Yelp, Nextdoor) works too: the page only checks that it's a web address.
const tenancy = require('./tenancy');
const industries = require('./industries');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const product = () => esc(tenancy.platform().settings.productName || 'Worklio Pro');
const PATH = '/tools/google-review-qr-code';

const FAQ = [
  ['How do I get my Google review link?', 'Type your business name and town above and pick your business; the link that opens Google’s review form for it shows right away. You can also get it from your Google Business Profile: sign in, search for your business and click “Ask for reviews”.'],
  ['My business doesn’t show up. What now?', 'Try the name exactly as it appears on Google, with your town, or paste the link from the Share button on your business in Google Maps. If it still doesn’t show, paste your review link from your Business Profile under “Already have your review link?”.'],
  ['Does this work for Facebook, Yelp or other review sites?', 'Yes. Paste any review link under “Already have your review link?” and the QR code, card, sign and message use it. Change the headline to match the site.'],
  ['Is it really free?', 'Yes, with no sign-up. The QR code points straight at Google’s review form, not through our site, so it keeps working forever.'],
  ['When is the best time to ask for a review?', 'Right after the job, while the client is happy and you’re still there. Hand them a card, or point at the sign on your truck or counter. A short text later the same day works well too.'],
];

const linkHelp = `<ol><li><b>From your Business Profile:</b> sign in to Google, search for your business name, and click <b>Ask for reviews</b> (or <b>Get more reviews</b>). Copy the link and paste it here.</li>
              <li><b>Or with your Place ID:</b> find your business in <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener">Google’s Place ID Finder</a>, copy the ID and paste it here.</li>
              <li><b>Another site?</b> Paste your Facebook, Yelp or Nextdoor review link instead.</li></ol>`;
const linkField = `<label class="dm-f"><span>Review link or Google Place ID</span><input id="rq-link" placeholder="https://g.page/r/…/review  or  ChIJ…"></label>
            <p class="rq-msg" id="rq-msg" role="status"></p>`;

function body() {
  const search = searchOn();
  return `
    <section class="h-hero"><div class="h-wrap i-hero-solo">
      <nav class="i-crumbs" aria-label="Breadcrumb" style="justify-content:center"><a href="/tools">Free tools</a><span aria-hidden="true">/</span><span aria-current="page">Google review link &amp; QR code</span></nav>
      <span class="h-eyebrow">Free tool</span>
      <h1>Google review link &amp; QR code</h1>
      <p class="lead">${search ? 'Find your business, copy your Google review link, and download a “Review us on Google” card with a QR code.' : 'Turn your Google review link into a QR code, a “Review us on Google” card, a counter sign and a message to send after the job.'} Free, with no sign-up.</p>
    </div></section>

    <section class="h-sec" style="padding-top:8px"><div class="h-wrap">
      <div class="rq" id="rq">
        <form class="dm-form" onsubmit="return false" autocomplete="off">
          ${search ? `<fieldset><legend>1. Find your business</legend>
            <div class="rq-find" id="rq-find"><label class="dm-f"><span>Your business name and town</span><input id="rq-q" placeholder="Smith Plumbing, Austin TX" enterkeyhint="search"></label><button type="button" class="btn" id="rq-go">Find my business</button></div>
            <small class="rq-or">Or paste any Google Maps link to your business.</small>
            <p class="rq-msg" id="rq-find-msg" role="status"></p>
            <div class="rq-results" id="rq-results" hidden></div>
            <div class="rq-picked" id="rq-picked" hidden></div>
            <details class="rq-help" id="rq-own"><summary>Already have your review link?</summary>${linkField}${linkHelp}</details>
          </fieldset>` : `<fieldset><legend>1. Your review link</legend>
            ${linkField}
            <details class="rq-help"><summary>Where do I find my link?</summary>${linkHelp}</details>
          </fieldset>`}
          <fieldset><legend>2. Your card and sign</legend>
            <label class="dm-f"><span>Business name</span><input id="rq-name" placeholder="Your business name"></label>
            <label class="dm-f"><span>Headline</span><input id="rq-head" value="Review us on Google"></label>
            <label class="dm-f"><span>Accent color</span><input type="color" id="rq-color" value="#2563eb"></label>
          </fieldset>
        </form>
        <div class="dm-side">
          <div class="rq-out">
            <b class="rq-k">Your review link</b>
            <div class="rq-url" id="rq-url" hidden><a id="rq-test" target="_blank" rel="noopener"></a></div>
            <button type="button" class="btn rq-main" id="rq-copy" disabled>Copy link</button>
            <div class="rq-qr" id="rq-qr"><span>${search ? 'Find your business to see your QR code.' : 'Your QR code shows here once you add your link.'}</span></div>
            <div class="rq-acts">
              <button type="button" class="btn alt" id="rq-png" disabled>Download QR code</button>
              <button type="button" class="btn alt" id="rq-card" disabled>Download card</button>
              <button type="button" class="btn alt" id="rq-sign" disabled>Print a sign</button>
              <button type="button" class="btn alt" id="rq-cards" disabled>Print 10 cards</button>
            </div>
            <small>Test the link on your phone before you print: it should open the review form.</small>
          </div>
          <div class="rq-tpl"><b>A message to send after the job</b>
            <textarea id="rq-text" rows="4" readonly></textarea>
            <button type="button" class="btn alt" id="rq-copy-text" disabled>Copy message</button>
          </div>
          <div class="dm-cta"><a class="btn alt" href="/pricing" data-trial>Ask every client for a review automatically, free for 30 days</a><small>${product()} emails every client a review request after the job, so you never forget to ask.</small></div>
        </div>
      </div>
    </div></section>

    <section class="h-sec" style="padding-top:0"><div class="h-wrap calc-read">
      <h2>How to get more Google reviews</h2>
      <ol>
        <li><b>Ask every client, every time.</b> Most happy clients will leave a review; they just need to be asked and given the link.</li>
        <li><b>Make it one tap.</b> A QR code or a direct link opens the review form, with no searching for your business.</li>
        <li><b>Ask at the right moment.</b> Right after the job is done and paid, while the result is in front of them.</li>
        <li><b>Answer every review.</b> Thank people for good ones and reply calmly to bad ones. Future clients read the replies too.</li>
      </ol>
      <div class="cmp-fit"><h2>Where to put your QR code</h2><p>On the counter sign, on a card you leave after each visit, on your invoices and estimates, on the truck and on job site signs. The more places clients see it, the more reviews you get.</p></div>
    </div></section>

    <section class="h-sec"><div class="h-wrap">
      <div class="h-sec-head"><span class="h-kicker">Questions</span><h2>Review link FAQ</h2></div>
      <div class="h-faq">${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
      <p class="i-more"><a href="/tools">See all our free tools →</a></p>
    </div></section>
    <script src="/qr.js?v=${qrVersion()}"></script>
    <script src="/review-qr.js?v=2"></script>`;
}
// the qr.js version the app already uses, so browsers share one cached copy
const qrVersion = () => { try { const m = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'index.html'), 'utf8').match(/qr\.js\?v=(\d+)/); return m ? m[1] : '1'; } catch (e) { return '1'; } };

const page = () => industries.shell({ head: require('./seo').reviewQrHead(FAQ), body: body() });

// ---------- "Find my business": a search on Google Places, with the platform's key (Alpha → Settings → Integrations → Google Places) ----------
// q is a business name and town, or a Google Maps link to the business. Places Autocomplete (New) answers with each match's Place ID,
// name and address; the review link is built from the Place ID. The key stays on the server. To keep the bill at zero (Google gives
// 10,000 autocomplete requests a month free), each visitor gets SEARCHES_PER_HOUR searches an hour, everyone together DAILY_CAP a day,
// and answers are kept for a day.
const SEARCHES_PER_HOUR = 15; const DAILY_CAP = 300;
const searchOn = () => !!process.env.GOOGLE_PLACES_API_KEY;
const fail = (status, error) => Object.assign(new Error(error), { status });
const hits = new Map(); let day = { date: '', n: 0 }; const cache = new Map();
function allow(ip) {
  const now = Date.now(); const list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (list.length >= SEARCHES_PER_HOUR) throw fail(429, 'That’s a lot of searches. Try again in a little while, or paste your review link below.');
  const today = new Date().toISOString().slice(0, 10); if (day.date !== today) day = { date: today, n: 0 };
  if (day.n >= DAILY_CAP) throw fail(429, 'Business search is busy today. Paste your review link below instead.');
  list.push(now); hits.set(ip, list); day.n++;
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 3600e3)) hits.delete(k);
}
async function autocomplete(input, at) {
  const key = `${input.toLowerCase()}|${at ? at.join(',') : ''}`; const c = cache.get(key); if (c && Date.now() - c.t < 864e5) return c.v;
  const body = { input, includedRegionCodes: ['us'], ...(at ? { locationBias: { circle: { center: { latitude: at[0], longitude: at[1] }, radius: 2000 } } } : {}) };
  const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('Google Places:', r.status, (j.error && j.error.message) || ''); throw fail(502, 'Business search isn’t working right now. Paste your review link below instead.'); }
  const v = (j.suggestions || []).map((s) => s.placePrediction).filter(Boolean).slice(0, 6)
    .map((p) => ({ placeId: p.placeId, name: (p.structuredFormat && p.structuredFormat.mainText && p.structuredFormat.mainText.text) || (p.text && p.text.text) || '', address: (p.structuredFormat && p.structuredFormat.secondaryText && p.structuredFormat.secondaryText.text) || '' }));
  cache.set(key, { t: Date.now(), v }); if (cache.size > 2000) cache.delete(cache.keys().next().value);
  return v;
}
// a Google Maps link: short links (maps.app.goo.gl) are followed, only ever to Google's own addresses; then the Place ID in the link,
// or the business name and map position in it, which are searched for
const GOOGLE_HOST = /^(maps\.app\.goo\.gl|goo\.gl|(www\.|maps\.)?google\.[a-z.]{2,6})$/i;
async function fromMapsLink(raw) {
  let u; try { u = new URL(raw); } catch (e) { throw fail(400, 'That link didn’t work. Copy the link from the Share button on your business in Google Maps.'); }
  for (let n = 0; n < 4 && /goo\.gl$/i.test(u.hostname); n++) {
    if (!GOOGLE_HOST.test(u.hostname)) break;
    const r = await fetch(u.href, { redirect: 'manual', signal: AbortSignal.timeout(6000) }).catch(() => null); const to = r && r.headers.get('location'); if (!to) break;
    u = new URL(to, u);
  }
  if (!GOOGLE_HOST.test(u.hostname)) throw fail(400, 'That isn’t a Google Maps link. Search by your business name and town instead.');
  const id = u.searchParams.get('query_place_id') || u.searchParams.get('placeid') || u.searchParams.get('place_id');
  if (id && /^[\w-]{20,}$/.test(id)) return [{ placeId: id, name: '', address: '' }];
  const m = u.pathname.match(/\/maps\/place\/([^/]+)(?:\/@(-?\d+\.\d+),(-?\d+\.\d+))?/); const q = u.searchParams.get('q');
  const name = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : q || ''; const at = m && m[2] ? [Number(m[2]), Number(m[3])] : null;
  if (!name.trim()) throw fail(400, 'We couldn’t find a business in that link. Search by your business name and town instead.');
  return autocomplete(name.trim().slice(0, 120), at);
}
async function lookup(q, ip) {
  const s = String(q || '').trim().slice(0, 500); if (!searchOn()) throw fail(404, 'Business search isn’t set up. Paste your review link below.');
  if (s.length < 3) throw fail(400, 'Type your business name and town.');
  allow(ip || '');
  return /^(https?:\/\/|maps\.app\.goo\.gl|goo\.gl|(www\.)?google\.)/i.test(s) ? fromMapsLink(/^https?:/i.test(s) ? s : 'https://' + s) : autocomplete(s, null);
}

module.exports = { PATH, page, lookup, searchOn };
