/* The free invoice generator and estimate template (lib/doc-maker.js): the form on the left draws the document on the right as you type.
   "Download PDF" prints only the document (a copy in #dm-print), so the browser can save it as a PDF. Nothing is sent anywhere:
   the business details, logo, color and notes are remembered in this browser (localStorage), everything else starts fresh. */
(() => {
  const $ = (s) => document.querySelector(s);
  const D = JSON.parse($('#dm-data').textContent); const est = D.mode === 'estimate';
  const KEY = 'wp-docmaker-business';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lines = (s) => esc(s).replace(/\n/g, '<br>');
  const num = (id) => Math.max(0, parseFloat(($('#dm-' + id) || {}).value) || 0);
  const usd = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const nice = (v) => { if (!v) return ''; const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* private window or full storage: fine, it just isn't remembered */ } };
  let logo = saved.logo || ''; let items = D.items.map(([d, q, r]) => ({ d, q, r }));

  // ---------- the line items ----------
  function drawItems() {
    $('#dm-items').innerHTML = `<div class="dm-ih" aria-hidden="true"><span>Description</span><span>Qty</span><span>Price</span><span></span></div>` + items.map((it, n) => `<div class="dm-it" data-n="${n}">
      <input aria-label="Description" data-k="d" value="${esc(it.d)}" placeholder="Describe the work">
      <input aria-label="Quantity" data-k="q" type="number" inputmode="decimal" min="0" step="any" value="${esc(it.q)}">
      <span class="calc-in"><i>$</i><input aria-label="Price" data-k="r" type="number" inputmode="decimal" min="0" step="any" value="${esc(it.r)}"></span>
      <button type="button" class="dm-x" aria-label="Remove this line" title="Remove">×</button></div>`).join('');
  }
  $('#dm-items').addEventListener('input', (e) => { const row = e.target.closest('.dm-it'); if (!row || !e.target.dataset.k) return; items[row.dataset.n][e.target.dataset.k] = e.target.value; draw(); });
  $('#dm-items').addEventListener('click', (e) => { const x = e.target.closest('.dm-x'); if (!x) return; items.splice(+x.closest('.dm-it').dataset.n, 1); if (!items.length) items.push({ d: '', q: 1, r: 0 }); drawItems(); draw(); });
  $('#dm-add').addEventListener('click', () => { items.push({ d: '', q: 1, r: 0 }); drawItems(); draw(); const all = document.querySelectorAll('.dm-it input[data-k="d"]'); all[all.length - 1].focus(); });

  // ---------- the document ----------
  function paper() {
    const color = $('#dm-color').value || '#2563eb'; const v = (id) => $('#dm-' + id).value.trim();
    const rows = items.filter((it) => String(it.d).trim() || Number(it.r)).map((it) => { const q = Math.max(0, parseFloat(it.q) || 0); const r = Math.max(0, parseFloat(it.r) || 0); return { d: it.d, q, r, a: q * r }; });
    const sub = rows.reduce((s, r) => s + r.a, 0); const disc = Math.min(num('disc'), sub); const tax = (sub - disc) * num('tax') / 100; const total = sub - disc + tax;
    const paid = est ? 0 : Math.min(num('paid'), total); const dep = est ? total * Math.min(num('dep'), 100) / 100 : 0;
    const label = est ? 'Estimate' : 'Invoice'; const biz = v('from') || 'Your business name';
    const tr = (k, val, cls = '') => `<tr class="${cls}"><th>${k}</th><td>${val}</td></tr>`;
    return `<div class="dp" style="--dp:${esc(color)}">
      <div class="dp-top">
        <div class="dp-from">${logo ? `<img class="dp-logo" src="${logo}" alt="">` : ''}<b>${esc(biz)}</b><span>${lines(v('from2'))}</span></div>
        <div class="dp-meta"><h2>${label}</h2><table>${tr(label + ' #', esc(v('num')))}${tr('Date', nice(v('date')))}${v('due') ? tr(est ? 'Valid until' : 'Due', nice(v('due'))) : ''}</table></div>
      </div>
      <div class="dp-to"><span>${est ? 'Prepared for' : 'Bill to'}</span><b>${esc(v('to')) || '&nbsp;'}</b><span>${lines(v('to2'))}</span></div>
      <table class="dp-lines"><thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${esc(r.d)}</td><td>${r.q.toLocaleString('en-US')}</td><td>${usd(r.r)}</td><td>${usd(r.a)}</td></tr>`).join('') || '<tr><td colspan="4" class="dp-empty">Add a line for each charge</td></tr>'}</tbody></table>
      <table class="dp-tot">${tr('Subtotal', usd(sub))}${disc ? tr('Discount', '−' + usd(disc)) : ''}${num('tax') ? tr(`Tax (${num('tax')}%)`, usd(tax)) : ''}
        ${est ? tr('Total', usd(total), 'dp-big') + (dep ? tr(`Deposit to start (${Math.min(num('dep'), 100)}%)`, usd(dep), 'dp-due') : '')
    : tr('Total', usd(total), paid ? '' : 'dp-big') + (paid ? tr('Paid', '−' + usd(paid)) + tr('Balance due', usd(total - paid), 'dp-big') : '')}</table>
      ${v('notes') ? `<div class="dp-notes"><span>${est ? 'Terms' : 'Notes'}</span><p>${lines(v('notes'))}</p></div>` : ''}
      ${est && $('#dm-sign').checked ? `<div class="dp-sign"><p>To accept this estimate, sign and date below.</p><div><span>Client signature</span><span>Date</span></div></div>` : ''}
      <div class="dp-foot">Made with the free ${est ? 'estimate template' : 'invoice generator'} from ${esc(D.product)}</div>
    </div>`;
  }
  function draw() { $('#dm-paper').innerHTML = paper(); }
  // the business details are remembered as they're typed
  $('#dm').addEventListener('input', (e) => {
    const map = { 'dm-from': 'from', 'dm-from2': 'from2', 'dm-color': 'color', 'dm-notes': est ? 'notesE' : 'notesI' }; const k = map[e.target.id];
    if (k) { saved[k] = e.target.value; save(); } if (!e.target.closest('.dm-it')) draw();
  });
  $('#dm-sign') && $('#dm-sign').addEventListener('change', draw);

  // ---------- the logo: shrunk to at most 600 px so it stays small enough to remember ----------
  function showLogo() { $('#dm-logo-box').innerHTML = logo ? `<img src="${logo}" alt="Your logo">` : 'Logo'; $('#dm-logo-x').hidden = !logo; }
  $('#dm-logo').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return; const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 600 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      logo = c.toDataURL(/png|svg|gif|webp/.test(file.type) ? 'image/png' : 'image/jpeg', 0.9); saved.logo = logo; save(); showLogo(); draw();
    };
    img.onerror = () => { URL.revokeObjectURL(url); alert('That file couldn’t be opened as a picture. Try a PNG or JPG.'); };
    img.src = url; e.target.value = '';
  });
  $('#dm-logo-x').addEventListener('click', () => { logo = ''; delete saved.logo; save(); showLogo(); draw(); });

  // ---------- Download PDF: print a copy of the document on its own ----------
  $('#dm-print').addEventListener('click', () => {
    let box = $('#dm-print-copy'); if (!box) { box = document.createElement('div'); box.id = 'dm-print-copy'; document.body.appendChild(box); }
    box.innerHTML = paper(); document.documentElement.classList.add('dm-printing');
    const title = document.title; const v = (id) => $('#dm-' + id).value.trim(); document.title = [est ? 'Estimate' : 'Invoice', v('num'), v('to')].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]/g, '');
    const done = () => { document.documentElement.classList.remove('dm-printing'); document.title = title; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done); setTimeout(() => window.print(), 50);
  });
  $('#dm-reset').addEventListener('click', () => { start(true); });

  function start(fresh) {
    const today = new Date(); const due = new Date(); due.setDate(due.getDate() + (est ? 30 : 14));
    $('#dm-from').value = saved.from || ''; $('#dm-from2').value = saved.from2 || ''; $('#dm-color').value = saved.color || '#2563eb';
    $('#dm-notes').value = saved[est ? 'notesE' : 'notesI'] ?? D.notes; $('#dm-date').value = iso(today); $('#dm-due').value = iso(due);
    if (fresh) { $('#dm-to').value = ''; $('#dm-to2').value = ''; $('#dm-disc').value = 0; $('#dm-tax').value = 0; if ($('#dm-paid')) $('#dm-paid').value = 0; if ($('#dm-dep')) $('#dm-dep').value = 25; items = [{ d: '', q: 1, r: 0 }]; }
    drawItems(); showLogo(); draw();
  }
  start(false);
})();
