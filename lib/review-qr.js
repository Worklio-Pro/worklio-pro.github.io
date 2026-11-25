// Free Google review link and QR code generator (/tools/google-review-qr-code), for searches like "google review qr code" or
// "google review link generator". The owner pastes the review link from their Google Business Profile (or their Place ID, which
// is turned into Google's write-a-review link), and gets a QR code to download, a printable counter sign and business cards, and a
// message to send clients. Everything runs in the browser (public/review-qr.js, QR codes from public/qr.js); nothing is sent to us.
// Any other review link (Facebook, Yelp, Nextdoor) works too: the page only checks that it's a web address.
const tenancy = require('./tenancy');
const industries = require('./industries');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const product = () => esc(tenancy.platform().settings.productName || 'Worklio Pro');
const PATH = '/tools/google-review-qr-code';

const FAQ = [
  ['How do I find my Google review link?', 'Sign in to Google with the account that manages your business, search for your business name, and click “Ask for reviews” (or “Get more reviews”) on your Business Profile. Copy the link it shows and paste it here. It usually looks like g.page/r/…/review.'],
  ['What’s a Place ID, and when do I need it?', 'A Place ID is Google’s code for your business listing. If you can’t get the link from your Business Profile, look your business up in Google’s Place ID Finder, copy the ID (it often starts with ChIJ) and paste it here. We turn it into the link that opens Google’s review form.'],
  ['Does this work for Facebook, Yelp or other review sites?', 'Yes. Paste any review link and the QR code, sign and cards use it. The words on the sign say “review”, not Google, so they fit any site.'],
  ['Is it really free?', 'Yes, with no sign-up. Your link and business name stay in this browser; nothing is sent to us. The QR code points straight at your review link, not through our site, so it keeps working forever.'],
  ['When is the best time to ask for a review?', 'Right after the job, while the client is happy and you’re still there. Hand them a card, or point at the sign on your truck or counter. A short text later the same day works well too.'],
];

function body() {
  return `
    <section class="h-hero"><div class="h-wrap i-hero-solo">
      <nav class="i-crumbs" aria-label="Breadcrumb" style="justify-content:center"><a href="/tools">Free tools</a><span aria-hidden="true">/</span><span aria-current="page">Review QR code</span></nav>
      <span class="h-eyebrow">Free tool</span>
      <h1>Google review link &amp; QR code generator</h1>
      <p class="lead">Turn your Google review link into a QR code clients can scan, plus a printable counter sign, business cards and a message to send after the job. Free, with no sign-up.</p>
    </div></section>

    <section class="h-sec" style="padding-top:8px"><div class="h-wrap">
      <div class="rq" id="rq">
        <form class="dm-form" onsubmit="return false" autocomplete="off">
          <fieldset><legend>1. Your review link</legend>
            <label class="dm-f"><span>Review link or Google Place ID</span><input id="rq-link" placeholder="https://g.page/r/…/review  or  ChIJ…"></label>
            <p class="rq-msg" id="rq-msg" role="status"></p>
            <details class="rq-help"><summary>Where do I find my link?</summary>
              <ol><li><b>From your Business Profile:</b> sign in to Google, search for your business name, and click <b>Ask for reviews</b> (or <b>Get more reviews</b>). Copy the link and paste it above.</li>
              <li><b>Or with your Place ID:</b> find your business in <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener">Google’s Place ID Finder</a>, copy the ID and paste it above. We turn it into Google’s review link.</li>
              <li><b>Another site?</b> Paste your Facebook, Yelp or Nextdoor review link instead.</li></ol>
            </details>
          </fieldset>
          <fieldset><legend>2. Your sign and cards</legend>
            <label class="dm-f"><span>Business name</span><input id="rq-name" placeholder="Your business name"></label>
            <label class="dm-f"><span>Headline</span><input id="rq-head" value="Happy with our work? Leave us a review!"></label>
            <label class="dm-f"><span>Accent color</span><input type="color" id="rq-color" value="#2563eb"></label>
          </fieldset>
        </form>
        <div class="dm-side">
          <div class="rq-out">
            <div class="rq-qr" id="rq-qr"><span>Your QR code shows here once you add your link.</span></div>
            <div class="rq-url" id="rq-url" hidden><a id="rq-test" target="_blank" rel="noopener"></a></div>
            <div class="rq-acts">
              <button type="button" class="btn" id="rq-png" disabled>Download QR code</button>
              <button type="button" class="btn alt" id="rq-copy" disabled>Copy link</button>
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
    <script src="/review-qr.js?v=1"></script>`;
}
// the qr.js version the app already uses, so browsers share one cached copy
const qrVersion = () => { try { const m = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'index.html'), 'utf8').match(/qr\.js\?v=(\d+)/); return m ? m[1] : '1'; } catch (e) { return '1'; } };

const page = () => industries.shell({ head: require('./seo').reviewQrHead(FAQ), body: body() });

module.exports = { PATH, page };
