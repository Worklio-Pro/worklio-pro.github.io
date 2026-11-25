/* The free Google review link and QR code tool (lib/review-qr.js).
   Find my business (when the platform has a Google Places key): the name and town, or a Google Maps link, go to /api/site/review-lookup;
   picking a match puts Google's write-a-review link for it in #rq-link. Or the visitor pastes a review link or Place ID there themselves.
   QR codes come from qr.js. "Download card" draws a 3.5 × 2 in card (1050 × 600 px) as a PNG; "Print a sign" and "Print 10 cards"
   print a copy on its own (#dm-print-copy, the same print rule as the invoice generator). Remembered in this browser only. */
(() => {
  const $ = (s) => document.querySelector(s);
  const KEY = 'wp-review-qr';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* not remembered, still works */ } };
  const btns = ['#rq-png', '#rq-card', '#rq-copy', '#rq-sign', '#rq-cards', '#rq-copy-text'];
  const reviewUrl = (id) => 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(id);
  let link = '';

  // a web address, a Place ID, or nothing usable
  function parse(raw) {
    const s = raw.trim(); if (!s) return { link: '' };
    if (/^[A-Za-z0-9_-]{20,}$/.test(s)) return { link: reviewUrl(s), note: 'Place ID found: this opens Google’s review form for your business.' };
    try { const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); if (!/\./.test(u.hostname)) throw new Error('no host');
      return { link: u.href, note: /google\.|g\.page/.test(u.hostname) ? '' : 'Not a Google link, but that’s fine: any review link works.' }; } catch (e) { return { link: '', error: 'That doesn’t look like a link or a Place ID. Copy the whole link from your Business Profile.' }; }
  }
  const name = () => $('#rq-name').value.trim(); const head = () => $('#rq-head').value.trim() || 'Review us on Google'; const color = () => $('#rq-color').value || '#2563eb';
  const message = () => `Hi! Thanks for choosing ${name() || 'us'}. If you have a minute, would you leave us a quick review? It really helps a small business like ours: ${link}`;

  function draw() {
    const p = parse($('#rq-link').value); link = p.link;
    const msg = $('#rq-msg'); msg.textContent = p.error || p.note || ''; msg.className = 'rq-msg' + (p.error ? ' bad' : '');
    const svg = link ? window.qrSvg(link) : '';
    if (svg) $('#rq-qr').innerHTML = svg; else if (link) $('#rq-qr').innerHTML = '<span>That link is too long for a QR code. Use the short link from your Business Profile.</span>';
    else if ($('#rq-qr svg')) $('#rq-qr').innerHTML = '<span>Your QR code shows here once you add your link.</span>';
    $('#rq-url').hidden = !svg; $('#rq-test').href = link || '#'; $('#rq-test').textContent = link || '';
    btns.forEach((b) => { if ($(b)) $(b).disabled = !svg; }); $('#rq-text').value = svg ? message() : '';
  }
  $('#rq').addEventListener('input', (e) => { if (['rq-link', 'rq-name', 'rq-head', 'rq-color'].includes(e.target.id)) { saved[e.target.id] = e.target.value; save(); } if (e.target.id !== 'rq-q') draw(); });

  // ---------- Find my business ----------
  const find = $('#rq-go');
  function picked(r) {
    $('#rq-link').value = reviewUrl(r.placeId); saved['rq-link'] = $('#rq-link').value;
    if (r.name && !name()) { $('#rq-name').value = r.name; saved['rq-name'] = r.name; }
    saved.picked = r; save(); showPicked(); draw();
    if (window.innerWidth < 960) $('.rq-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function showPicked() {
    const r = saved.picked; const on = !!(r && $('#rq-link').value === reviewUrl(r.placeId));
    $('#rq-picked').hidden = !on; $('#rq-results').hidden = true;
    if (on) $('#rq-picked').innerHTML = `<span class="rq-tick" aria-hidden="true">✓</span><span><b>${esc(r.name || 'Your business')}</b>${r.address ? `<small>${esc(r.address)}</small>` : ''}</span><button type="button" class="dm-link" id="rq-change">Not it? Search again</button>`;
  }
  async function search() {
    const q = $('#rq-q').value.trim(); const m = $('#rq-find-msg'); m.className = 'rq-msg';
    if (q.length < 3) { m.textContent = 'Type your business name and town.'; m.className = 'rq-msg bad'; return; }
    find.disabled = true; find.textContent = 'Searching…'; m.textContent = '';
    try {
      const r = await fetch('/api/site/review-lookup?q=' + encodeURIComponent(q)); const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Business search isn’t working right now. Paste your review link below instead.');
      const list = j.results || [];
      if (!list.length) { m.textContent = 'No businesses found. Try the name as it shows on Google, with your town, or paste your review link below.'; m.className = 'rq-msg bad'; $('#rq-results').hidden = true; return; }
      if (list.length === 1 && !list[0].name) return picked(list[0]); // a Maps link with the Place ID in it
      $('#rq-results').innerHTML = `<p class="rq-k">Pick your business</p>${list.map((x, n) => `<button type="button" class="rq-res" data-n="${n}"><b>${esc(x.name)}</b><small>${esc(x.address)}</small></button>`).join('')}<small class="rq-google">Powered by Google</small>`;
      $('#rq-results').hidden = false; $('#rq-picked').hidden = true; $('#rq-results').onclick = (e) => { const b = e.target.closest('.rq-res'); if (b) picked(list[+b.dataset.n]); };
    } catch (e) { m.textContent = e.message; m.className = 'rq-msg bad'; if ($('#rq-own')) $('#rq-own').open = true; }
    finally { find.disabled = false; find.textContent = 'Find my business'; }
  }
  if (find) {
    find.addEventListener('click', search);
    $('#rq-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    $('#rq-picked').addEventListener('click', (e) => { if (e.target.id === 'rq-change') { $('#rq-picked').hidden = true; $('#rq-q').focus(); $('#rq-q').select(); } });
  }

  const copy = async (text, btn) => { const was = btn.textContent;
    try { await navigator.clipboard.writeText(text); } catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    btn.textContent = 'Copied ✓'; setTimeout(() => { btn.textContent = was; }, 1600); };
  $('#rq-copy').addEventListener('click', (e) => copy(link, e.currentTarget));
  $('#rq-copy-text').addEventListener('click', (e) => copy(message(), e.currentTarget));
  const fileName = (what) => (name() ? name().replace(/[^\w &'-]+/g, '').trim() + ' ' : '') + what + '.png';
  const download = (href, file) => { const a = document.createElement('a'); a.href = href; a.download = file; document.body.appendChild(a); a.click(); a.remove(); };
  $('#rq-png').addEventListener('click', () => download(window.qrPng(link, 1200), fileName('review QR code')));

  // ---------- Download card: 3.5 × 2 in at 300 dpi ----------
  function wrap(g, text, max) { const words = text.split(/\s+/); const out = []; let line = '';
    words.forEach((w) => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }); if (line) out.push(line); return out; }
  $('#rq-card').addEventListener('click', () => {
    const W = 1050; const H = 600; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const font = (w, px) => `${w} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = color(); g.fillRect(0, 0, 24, H);
    const m = window.qrMatrix(link); const q = 440; const k = q / (m.length + 4); const qx = W - q - 50; const qy = (H - q) / 2;
    g.fillStyle = '#000'; m.forEach((row, y) => row.forEach((dark, x) => { if (dark) g.fillRect(qx + (x + 2) * k, qy + (y + 2) * k, Math.ceil(k), Math.ceil(k)); }));
    const left = 80; const max = qx - left - 40; let y = 130;
    if (name()) { g.fillStyle = '#111'; g.font = font(800, 46); wrap(g, name(), max).slice(0, 2).forEach((l) => { g.fillText(l, left, y); y += 56; }); y += 10; }
    g.fillStyle = '#f5b301'; g.font = font(400, 52); g.fillText('★★★★★', left, y + 20); y += 96;
    g.fillStyle = color(); g.font = font(800, 40); wrap(g, head(), max).slice(0, 3).forEach((l) => { g.fillText(l, left, y); y += 50; });
    g.fillStyle = '#555'; g.font = font(500, 26); g.fillText('Scan with your phone’s camera', left, Math.max(y + 24, H - 70));
    download(c.toDataURL('image/png'), fileName('review card'));
  });

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
  if (find) { showPicked(); if ($('#rq-link').value && $('#rq-picked').hidden && $('#rq-own')) $('#rq-own').open = true; }
  draw();
})();
