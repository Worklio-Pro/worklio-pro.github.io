// The Meta Pixel and Google tag on the public marketing pages, for retargeting visitors (IDs: Alpha → Settings → SEO; lib/seo.js adds this script).
// Nothing loads until the visitor accepts, and a browser sending Global Privacy Control counts as declining. The choice can be changed from
// the footer's Cookie choices link or /#cookie-choices (the Privacy Policy links there).
(function () {
  var tag = document.currentScript; var metaId = tag.dataset.meta; var googleId = tag.dataset.google; var KEY = 'adCookies';
  var gpc = navigator.globalPrivacyControl === true;
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function remember(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  var loaded = false;
  function load() {
    if (loaded) return; loaded = true;
    if (metaId) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('set', 'autoConfig', false, metaId); // no reading of form fields or button clicks: the pricing page's sign-up form stays private
      window.fbq('init', metaId); window.fbq('track', 'PageView');
    }
    if (googleId) {
      window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('consent', 'default', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' }); // they accepted
      window.gtag('js', new Date()); window.gtag('config', googleId);
      var g = document.createElement('script'); g.async = true; g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(googleId); document.head.appendChild(g);
    }
  }
  // changing to No: remove what the tags stored on this site, and reload so they stop running
  function clearCookies() {
    var host = location.hostname.replace(/^www\./, '');
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim(); if (!/^(_fbp|_fbc|_ga|_gcl_|_gid)/.test(name)) return;
      ['', '; domain=' + host, '; domain=.' + host].forEach(function (d) { document.cookie = name + '=; path=/; max-age=0' + d; });
    });
  }

  var banner = null;
  function hide() { if (banner) banner.remove(); banner = null; }
  function show() {
    if (banner) return;
    banner = document.createElement('div'); banner.className = 'ad-consent'; banner.setAttribute('role', 'region'); banner.setAttribute('aria-label', 'Cookie choices');
    banner.innerHTML = '<style>.ad-consent{--c-bg:#fff;--c-text:#0f172a;--c-line:#dfe6f0;--c-link:#1d4ed8;position:fixed;left:16px;bottom:16px;z-index:2147482000;box-sizing:border-box;width:420px;max-width:calc(100vw - 100px);padding:16px;border:1px solid var(--c-line);border-radius:14px;background:var(--c-bg);color:var(--c-text);font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 8px 28px rgba(15,23,42,.18)}'
      + '@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .ad-consent{--c-bg:#121b2f;--c-text:#e2e8f0;--c-line:#22304d;--c-link:#93b4fd}}:root[data-theme=dark] .ad-consent{--c-bg:#121b2f;--c-text:#e2e8f0;--c-line:#22304d;--c-link:#93b4fd}'
      + '.ad-consent p{margin:0 0 12px}.ad-consent a{color:var(--c-link)}.ad-consent div{display:flex;flex-wrap:wrap;gap:8px}.ad-consent button{min-height:40px;padding:0 16px;border:1px solid var(--c-line);border-radius:9px;background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer}.ad-consent button[data-yes]{border-color:#2563eb;background:#2563eb;color:#fff}</style>'
      + '<p>May we use advertising cookies from Meta and Google to show you our ads on other sites? See our <a href="/privacy#cookies">Privacy Policy</a>.</p><div><button type="button" data-yes>Accept</button><button type="button" data-no>No thanks</button></div>';
    banner.querySelector('[data-yes]').onclick = function () { remember('yes'); hide(); load(); };
    banner.querySelector('[data-no]').onclick = function () { var was = saved() === 'yes'; remember('no'); hide(); if (was) { clearCookies(); location.reload(); } };
    document.body.appendChild(banner);
  }
  function askIfLinked() { if (location.hash === '#cookie-choices' && !gpc) show(); }

  // also called by site.js, which draws the pricing page's footer itself
  window.cookieChoicesLink = function () {
    if (gpc || document.querySelector('.cookie-choices')) return;
    var foot = document.querySelector('footer'); if (!foot) return;
    var nav = foot.querySelector('nav'); var a = document.createElement('a'); a.href = '#cookie-choices'; a.className = 'cookie-choices'; a.textContent = 'Cookie choices';
    a.onclick = function (e) { e.preventDefault(); show(); };
    if (nav) nav.appendChild(a); else if (foot.textContent.trim()) { foot.appendChild(document.createTextNode(' · ')); foot.appendChild(a); }
  };

  var choice = saved();
  if (gpc) { if (choice === 'yes') clearCookies(); }
  else if (choice === 'yes') load();
  else if (choice !== 'no') show();
  window.cookieChoicesLink(); askIfLinked(); window.addEventListener('hashchange', askIfLinked);
})();
