/* The free review link and QR code generator (lib/review-qr.js). A pasted link is used as it is; a Google Place ID becomes Google's
   write-a-review link. QR codes come from qr.js. "Print a sign" and "Print 10 cards" print a copy on its own (#dm-print-copy, the same
   print rule as the invoice generator). The link, name, headline and color are remembered in this browser only. */
(() => {
  const $ = (s) => document.querySelector(s);
  const KEY = 'wp-review-qr';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* not remembered, still works */ } };
  const btns = ['#rq-png', '#rq-copy', '#rq-sign', '#rq-cards', '#rq-copy-text'];
  let link = '';

  // a web address, a Place ID, or nothing usable
  function parse(raw) {
    const s = raw.trim(); if (!s) return { link: '' };
    if (/^[A-Za-z0-9_-]{20,}$/.test(s)) return { link: 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(s), note: 'Place ID found: this opens Google’s review form for your business.' };
    try { const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); if (!/\./.test(u.hostname)) throw new Error('no host');
      return { link: u.href, note: /google\.|g\.page/.test(u.hostname) ? '' : 'Not a Google link, but that’s fine: any review link works.' }; } catch (e) { return { link: '', error: 'That doesn’t look like a link or a Place ID. Copy the whole link from your Business Profile.' }; }
  }
  const name = () => $('#rq-name').value.trim(); const head = () => $('#rq-head').value.trim() || 'Leave us a review!'; const color = () => $('#rq-color').value || '#2563eb';
  const message = () => `Hi! Thanks for choosing ${name() || 'us'}. If you have a minute, would you leave us a quick review? It really helps a small business like ours: ${link}`;

  function draw() {
    const p = parse($('#rq-link').value); link = p.link;
    const msg = $('#rq-msg'); msg.textContent = p.error || p.note || ''; msg.className = 'rq-msg' + (p.error ? ' bad' : '');
    const svg = link ? window.qrSvg(link) : '';
    $('#rq-qr').innerHTML = svg || `<span>${link ? 'That link is too long for a QR code. Use the short link from your Business Profile.' : 'Your QR code shows here once you add your link.'}</span>`;
    $('#rq-url').hidden = !svg; $('#rq-test').href = link || '#'; $('#rq-test').textContent = link ? 'Test it: ' + link : '';
    btns.forEach((b) => { $(b).disabled = !svg; }); $('#rq-text').value = svg ? message() : '';
  }
  $('#rq').addEventListener('input', (e) => { if (e.target.id) { saved[e.target.id] = e.target.value; save(); } draw(); });

  const copy = async (text, btn) => { const was = btn.textContent;
    try { await navigator.clipboard.writeText(text); } catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    btn.textContent = 'Copied ✓'; setTimeout(() => { btn.textContent = was; }, 1600); };
  $('#rq-copy').addEventListener('click', (e) => copy(link, e.currentTarget));
  $('#rq-copy-text').addEventListener('click', (e) => copy(message(), e.currentTarget));
  $('#rq-png').addEventListener('click', () => { const a = document.createElement('a'); a.href = window.qrPng(link, 1200); a.download = (name() ? name().replace(/[^\w -]+/g, '').trim() + ' ' : '') + 'review QR code.png'; document.body.appendChild(a); a.click(); a.remove(); });

  // ---------- printing ----------
  const stars = '<span class="rp-stars" aria-hidden="true">★★★★★</span>';
  const sign = () => `<div class="rp-sign" style="--dp:${esc(color())}">${name() ? `<b class="rp-name">${esc(name())}</b>` : ''}${stars}<h2>${esc(head())}</h2><div class="rp-qr">${window.qrSvg(link)}</div><p>Point your phone’s camera at the code, then tap the link.</p></div>`;
  const cards = () => `<div class="rp-cards" style="--dp:${esc(color())}">${Array.from({ length: 10 }, () => `<div class="rp-card"><div>${name() ? `<b>${esc(name())}</b>` : ''}${stars}<span>${esc(head())}</span><small>Scan with your phone’s camera</small></div><div class="rp-qr">${window.qrSvg(link)}</div></div>`).join('')}</div>`;
  function print(html) {
    let box = $('#dm-print-copy'); if (!box) { box = document.createElement('div'); box.id = 'dm-print-copy'; document.body.appendChild(box); }
    box.innerHTML = html; document.documentElement.classList.add('dm-printing');
    const done = () => { document.documentElement.classList.remove('dm-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => window.print(), 50);
  }
  $('#rq-sign').addEventListener('click', () => print(sign()));
  $('#rq-cards').addEventListener('click', () => print(cards()));

  ['rq-link', 'rq-name', 'rq-head', 'rq-color'].forEach((id) => { if (saved[id] != null && saved[id] !== '') $('#' + id).value = saved[id]; });
  draw();
})();
