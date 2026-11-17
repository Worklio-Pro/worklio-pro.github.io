// Our own color picker. A browser's color window is drawn by the browser and can't be made bigger, so a click on any
// <input type="color"> opens this panel instead: a large color area, a hue bar, a hex box and a row of quick colors.
// Moving in it sets the input's value and fires 'input'; closing fires 'change' if the color changed, so the pages that
// listen to those events (App Settings saves on change) work as before. Esc puts the old color back; Done or a click outside keeps it.
(() => {
  const QUICK = ['#2563eb', '#0ea5e9', '#14b8a6', '#16a34a', '#84cc16', '#eab308', '#f97316', '#dc2626', '#db2777', '#9333ea', '#475569', '#0f172a'];
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
  const rgbToHsv = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b); const d = mx - Math.min(r, g, b);
    const h = !d ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, mx ? d / mx : 0, mx];
  };
  const hsvToHex = (h, s, v) => { const f = (n) => { const k = (n + h / 60) % 6; return 255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))); }; return rgbToHex(f(5), f(3), f(1)); };
  let open = null; // { inp, start, h, s, v, el }

  function close(keep) {
    if (!open) return; const { inp, start, el } = open; open = null; el.remove();
    document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', onKey, true);
    if (!keep && inp.value !== start) { inp.value = start; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    if (inp.value !== start) inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.focus({ preventScroll: true });
  }
  const outside = (e) => { if (open && !open.el.contains(e.target) && e.target !== open.inp) close(true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); } };

  function paint(from) {
    const { inp, h, s, v, el } = open; const hex = hsvToHex(h, s, v);
    el.querySelector('.cpk-sv').style.backgroundColor = `hsl(${h} 100% 50%)`;
    Object.assign(el.querySelector('.cpk-dot').style, { left: s * 100 + '%', top: (1 - v) * 100 + '%', backgroundColor: hex });
    el.querySelector('.cpk-hue i').style.left = (h / 360) * 100 + '%';
    el.querySelector('.cpk-now').style.backgroundColor = hex;
    if (from !== 'hex') el.querySelector('.cpk-hex').value = hex;
    if (inp.value !== hex) { inp.value = hex; inp.dispatchEvent(new Event('input', { bubbles: true })); }
  }
  const setHex = (hex, from) => { const [h, s, v] = rgbToHsv(hexToRgb(hex)); Object.assign(open, { s, v }, s && v ? { h } : {}); paint(from); };
  // drag in the color area or on the hue bar (mouse, pen or finger)
  function drag(area, move) {
    area.addEventListener('pointerdown', (e) => {
      e.preventDefault(); area.setPointerCapture(e.pointerId);
      const at = (ev) => { const r = area.getBoundingClientRect(); move(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); paint(); };
      at(e); area.onpointermove = at; area.onpointerup = () => { area.onpointermove = null; };
    });
  }

  function show(inp) {
    close(true);
    const el = document.createElement('div'); el.className = 'cpk'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Choose a color');
    el.innerHTML = `<div class="cpk-sv" tabindex="0" aria-label="Color area: arrow keys change it"><span class="cpk-dot"></span></div>
<div class="cpk-hue" tabindex="0" aria-label="Hue: arrow keys change it"><i></i></div>
<div class="cpk-row"><span class="cpk-now"></span><input class="cpk-hex" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex color"><button type="button" class="btn cpk-done">Done</button></div>
<div class="cpk-quick">${QUICK.map((c) => `<button type="button" data-c="${c}" style="background:${c}" title="${c}" aria-label="${c}"></button>`).join('')}</div>`;
    document.body.appendChild(el);
    const start = /^#[0-9a-f]{6}$/i.test(inp.value) ? inp.value.toLowerCase() : '#000000';
    open = { inp, start, h: 0, s: 0, v: 0, el }; setHex(start);
    // under the input, or above it when there's no room; on phones it sits at the bottom of the screen (CSS)
    const r = inp.getBoundingClientRect(); const w = el.offsetWidth; const hgt = el.offsetHeight;
    const top = r.bottom + 8 + hgt > innerHeight && r.top - 8 - hgt > 0 ? r.top - 8 - hgt : r.bottom + 8;
    el.style.left = clamp(r.left, 8, innerWidth - w - 8) + 'px'; el.style.top = clamp(top, 8, Math.max(8, innerHeight - hgt - 8)) + 'px';
    drag(el.querySelector('.cpk-sv'), (x, y) => { open.s = x; open.v = 1 - y; });
    drag(el.querySelector('.cpk-hue'), (x) => { open.h = x * 360; });
    el.querySelector('.cpk-sv').addEventListener('keydown', (e) => { const d = { ArrowLeft: [-0.02, 0], ArrowRight: [0.02, 0], ArrowUp: [0, 0.02], ArrowDown: [0, -0.02] }[e.key]; if (!d) return; e.preventDefault(); open.s = clamp(open.s + d[0], 0, 1); open.v = clamp(open.v + d[1], 0, 1); paint(); });
    el.querySelector('.cpk-hue').addEventListener('keydown', (e) => { const d = { ArrowLeft: -3, ArrowDown: -3, ArrowRight: 3, ArrowUp: 3 }[e.key]; if (!d) return; e.preventDefault(); open.h = clamp(open.h + d, 0, 360); paint(); });
    const hex = el.querySelector('.cpk-hex');
    hex.addEventListener('input', () => { let x = hex.value.trim(); if (x && x[0] !== '#') x = '#' + x; if (/^#[0-9a-f]{6}$/i.test(x)) setHex(x.toLowerCase(), 'hex'); });
    hex.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); close(true); } });
    el.querySelector('.cpk-quick').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) setHex(b.dataset.c); });
    el.querySelector('.cpk-done').addEventListener('click', () => close(true));
    setTimeout(() => { document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', onKey, true); });
    el.querySelector('.cpk-sv').focus({ preventScroll: true });
  }

  // every color input on the page, now and later; the browser's own window doesn't open
  document.addEventListener('click', (e) => {
    const inp = e.target.closest && e.target.closest('input[type=color]');
    if (!inp || inp.disabled) return;
    e.preventDefault(); if (open && open.inp === inp) return close(true);
    show(inp);
  }, true);
  addEventListener('resize', () => close(true));
  addEventListener('scroll', (e) => { if (open && !open.el.contains(e.target) && innerWidth > 600) close(true); }, true); // it doesn't follow the page

})();
