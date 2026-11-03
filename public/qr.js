/* QR codes for links (byte mode, error correction M, or H when a logo covers the middle; versions 1–10: up to 213 bytes at M), drawn as SVG or PNG; no library needed */
(function () {
  // error correction codewords per block and number of blocks, for versions 1–10: level M, and level H (recovers 30%, so a logo can cover part of it)
  const LEVELS = { M: { ecc: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26], blocks: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5], bits: 0 }, H: { ecc: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28], blocks: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8], bits: 2 } };
  const rawModules = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataCodewords = (v, L) => Math.floor(rawModules(v) / 8) - L.ecc[v - 1] * L.blocks[v - 1];
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; }; // GF(256)
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => (((x + y) % 2) + (x * y) % 3) % 2 === 0];

  // the modules as rows of true (dark) / false, or null when the text is too long
  function qrMatrix(text, level = 'M') {
    const L = LEVELS[level] || LEVELS.M; const ECC = L.ecc; const BLOCKS = L.blocks;
    const data = [...new TextEncoder().encode(text)];
    let ver = 1; while (ver <= 10 && 4 + (ver < 10 ? 8 : 16) + data.length * 8 > dataCodewords(ver, L) * 8) ver++;
    if (ver > 10) return null;
    // the data bits: byte mode, length, bytes, terminator, padding
    const bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(data.length, ver < 10 ? 8 : 16); data.forEach((b) => put(b, 8));
    const cap = dataCodewords(ver, L) * 8; put(0, Math.min(4, cap - bits.length)); put(0, (8 - (bits.length % 8)) % 8);
    for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) put(p, 8);
    const bytes = []; for (let i = 0; i < bits.length; i += 8) bytes.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    // Reed–Solomon error correction per block, then interleave
    const deg = ECC[ver - 1]; const gen = new Array(deg).fill(0); gen[deg - 1] = 1;
    for (let i = 0, root = 1; i < deg; i++, root = mul(root, 2)) for (let j = 0; j < deg; j++) { gen[j] = mul(gen[j], root); if (j + 1 < deg) gen[j] ^= gen[j + 1]; }
    const ecc = (d) => { const r = new Array(deg).fill(0); d.forEach((b) => { const f = b ^ r.shift(); r.push(0); gen.forEach((c, i) => { r[i] ^= mul(c, f); }); }); return r; };
    const nb = BLOCKS[ver - 1]; const raw = Math.floor(rawModules(ver) / 8); const shortLen = Math.floor(raw / nb); const numShort = nb - (raw % nb);
    const blocks = []; for (let i = 0, k = 0; i < nb; i++) { const d = bytes.slice(k, k += shortLen - deg + (i < numShort ? 0 : 1)); const e = ecc(d); if (i < numShort) d.push(0); blocks.push(d.concat(e)); }
    const cw = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - deg || j >= numShort) cw.push(b[i]); });
    // function patterns: timing, finders, alignment, version
    const size = ver * 4 + 17; const m = [...Array(size)].map(() => Array(size).fill(false)); const fixed = [...Array(size)].map(() => Array(size).fill(false));
    const set = (x, y, dark) => { m[y][x] = dark; fixed[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([cx, cy]) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx; const y = cy + dy; const d = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } });
    const al = [];
    if (ver > 1) { const n = Math.floor(ver / 7) + 2; const step = Math.floor((ver * 8 + n * 3 + 5) / (n * 4 - 4)) * 2; for (let p = size - 7; al.length < n - 1; p -= step) al.unshift(p); al.unshift(6); }
    al.forEach((a, i) => al.forEach((b, j) => { if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
    const format = (mask) => {
      const d = (L.bits << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); // the level (M 00, H 10) and the mask
      const f = ((d << 10) | r) ^ 0x5412; const bit = (i) => ((f >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    format(0);
    if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const v = (ver << 12) | r; for (let i = 0; i < 18; i++) { const dark = ((v >>> i) & 1) === 1; const a = size - 11 + (i % 3); const b = Math.floor(i / 3); set(a, b, dark); set(b, a, dark); } }
    // the codewords, zigzagging up and down two columns at a time
    let n = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j; const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fixed[y][x] && n < cw.length * 8) { m[y][x] = ((cw[n >>> 3] >>> (7 - (n & 7))) & 1) === 1; n++; }
      }
    }
    // the mask that leaves the fewest long runs, 2×2 blocks and dark/light imbalance
    const flip = (k) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x]; };
    const penalty = () => {
      let p = 0; let dark = 0;
      for (let a = 0; a < size; a++) for (const row of [true, false]) { let run = 1; for (let b = 1; b < size; b++) { const c = row ? m[a][b] : m[b][a]; const prev = row ? m[a][b - 1] : m[b - 1][a]; if (c === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { if (m[y][x]) dark++; if (x < size - 1 && y < size - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3; }
      return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    };
    let best = 0; let low = Infinity;
    for (let k = 0; k < 8; k++) { flip(k); format(k); const p = penalty(); if (p < low) { low = p; best = k; } flip(k); }
    flip(best); format(best);
    return m;
  }
  // an SVG with a 4-module quiet zone
  function qrSvg(text) {
    const m = qrMatrix(text); if (!m) return '';
    const s = m.length + 8; let d = '';
    m.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  }
  // a PNG data URL, about px wide
  function qrPng(text, px = 1024) {
    const m = qrMatrix(text); if (!m) return '';
    const s = m.length + 8; const k = Math.max(1, Math.floor(px / s)); const c = document.createElement('canvas'); c.width = c.height = s * k;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
    m.forEach((row, y) => row.forEach((dark, x) => { if (dark) g.fillRect((x + 4) * k, (y + 4) * k, k, k); }));
    return c.toDataURL('image/png');
  }
  // ---------- a styled QR code (Settings → Business Page → QR code appearance), as SVG; units are modules ----------
  // st: { bg, dots, mBorder, mCenter: colors; shape: square | rounded | circle; dot: square | rounded | dots | diamond | vertical | horizontal;
  //   border: square | rounded | circle (the corner markers' ring); center: square | circle; frame: none | border | frame;
  //   logo: an image address (data: or /uploads/…), logoClear: no dots behind the logo; bgImg, bgOpacity: a picture behind it all;
  //   header, footer: { text, font, color } above and below the code }
  const QR_DEFAULT = { bg: '#ffffff', dots: '#000000', mBorder: '#000000', mCenter: '#000000', shape: 'square', dot: 'square', border: 'square', center: 'square', frame: 'none', logo: '', logoClear: true, bgImg: '', bgOpacity: 100,
    header: { text: '', font: 'Arial', color: '#000000' }, footer: { text: '', font: 'Arial', color: '#000000' } };
  const xe = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const f2 = (v) => +v.toFixed(3);
  const rr = (x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); return `M${f2(x + r)} ${f2(y)}h${f2(w - 2 * r)}a${f2(r)} ${f2(r)} 0 0 1 ${f2(r)} ${f2(r)}v${f2(h - 2 * r)}a${f2(r)} ${f2(r)} 0 0 1 ${f2(-r)} ${f2(r)}h${f2(2 * r - w)}a${f2(r)} ${f2(r)} 0 0 1 ${f2(-r)} ${f2(-r)}v${f2(2 * r - h)}a${f2(r)} ${f2(r)} 0 0 1 ${f2(r)} ${f2(-r)}z`; };
  const circ = (cx, cy, r) => `M${f2(cx - r)} ${f2(cy)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(2 * r)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-2 * r)} 0z`;
  function qrStyled(text, given = {}) {
    const st = { ...QR_DEFAULT, ...given, header: { ...QR_DEFAULT.header, ...(given.header || {}) }, footer: { ...QR_DEFAULT.footer, ...(given.footer || {}) } };
    const m = qrMatrix(text, st.logo ? 'H' : 'M'); if (!m) return '';
    const n = m.length; const round = st.shape === 'circle';
    // the area the code sits in: a 4-module margin, or for a circle, a circle around the code filled with decoration
    let W = round ? Math.ceil(n * Math.SQRT2) + 4 : n + 8; if ((W - n) % 2) W++;
    const head = st.header.text ? 7 : 0; const foot = st.footer.text ? 7 : 0; const fr = st.frame === 'frame' ? 2.4 : st.frame === 'border' ? 0.8 : 0;
    const TW = W + 2 * fr; const TH = W + head + foot + 2 * fr; const ox = fr + (W - n) / 2; const oy = fr + head + (W - n) / 2;
    // which modules are the three corner markers, and which are under the logo
    const inMarker = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    let L = Math.round(n * 0.22); if ((n - L) % 2) L++; const l0 = (n - L) / 2;
    const underLogo = (x, y) => st.logo && st.logoClear && x >= l0 - 1 && x < l0 + L + 1 && y >= l0 - 1 && y < l0 + L + 1;
    // the alignment patterns (5×5, versions 2 and up) are drawn solid in every style, so readers still find them
    const ver = (n - 17) / 4; const al = [];
    if (ver > 1) { const k = Math.floor(ver / 7) + 2; const step = Math.floor((ver * 8 + k * 3 + 5) / (k * 4 - 4)) * 2; for (let q = n - 7; al.length < k - 1; q -= step) al.unshift(q); al.unshift(6); }
    const inAlign = (x, y) => al.some((a, i) => al.some((c, j) => !((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) && Math.abs(x - a) <= 2 && Math.abs(y - c) <= 2));
    const on = (x, y) => x >= 0 && y >= 0 && x < n && y < n && m[y][x] && !inMarker(x, y) && !underLogo(x, y) && !inAlign(x, y);
    let solid = ''; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x] && inAlign(x, y) && !underLogo(x, y)) solid += `M${ox + x} ${oy + y}h1v1h-1z`;
    // the dots, in one path; extra decoration fills a circle's edge (a fixed pattern, kept a module away from the code)
    const cells = []; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (on(x, y)) cells.push([ox + x, oy + y, x, y]);
    if (round) {
      const c = W / 2; const r = W / 2 - 0.6; const g0 = (W - n) / 2;
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
        const cx = x - g0; const cy = y - g0; if (cx >= -1 && cy >= -1 && cx <= n && cy <= n) continue;
        if (Math.hypot(x + 0.5 - c, y + 0.5 - c) > r - 0.5) continue;
        { const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; if (h - Math.floor(h) < 0.45) cells.push([fr + x, fr + head + y, null, null]); }
      }
    }
    let d = '';
    const dotAt = (X, Y) => {
      if (st.dot === 'dots') return circ(X + 0.5, Y + 0.5, 0.45);
      if (st.dot === 'rounded') return rr(X + 0.05, Y + 0.05, 0.9, 0.9, 0.32);
      if (st.dot === 'diamond') return `M${f2(X + 0.5)} ${f2(Y)}l.5 .5-.5 .5-.5-.5z`;
      return `M${f2(X)} ${f2(Y)}h1v1h-1z`;
    };
    if (st.dot === 'vertical' || st.dot === 'horizontal') { // runs of dots joined into rounded bars
      const v = st.dot === 'vertical'; const set = new Set(cells.map(([X, Y]) => `${X},${Y}`)); const done = new Set();
      for (const [X, Y] of cells) {
        const k = `${X},${Y}`; if (done.has(k)) continue; let len = 0;
        while (set.has(v ? `${X},${Y + len}` : `${X + len},${Y}`)) { done.add(v ? `${X},${Y + len}` : `${X + len},${Y}`); len++; }
        d += v ? rr(X + 0.1, Y + 0.05, 0.8, len - 0.1, 0.4) : rr(X + 0.05, Y + 0.1, len - 0.1, 0.8, 0.4);
      }
    } else for (const [X, Y] of cells) d += dotAt(X, Y);
    // the corner markers: a 7×7 ring and a 3×3 center
    let ring = ''; let mid = '';
    for (const [mx, my] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      const X = ox + mx; const Y = oy + my;
      ring += st.border === 'circle' ? circ(X + 3.5, Y + 3.5, 3.5) + circ(X + 3.5, Y + 3.5, 2.5)
        : st.border === 'rounded' ? rr(X, Y, 7, 7, 1.6) + rr(X + 1, Y + 1, 5, 5, 0.9) : `M${X} ${Y}h7v7h-7zM${X + 1} ${Y + 1}v5h5v-5z`;
      mid += st.center === 'circle' ? circ(X + 3.5, Y + 3.5, 1.5) : `M${X + 2} ${Y + 2}h3v3h-3z`;
    }
    // the card: a shape for the background, a picture behind it if chosen, a plate behind the code so it stays readable
    const cardR = st.shape === 'rounded' || st.frame !== 'none' || head || foot ? 3 : 0;
    const card = round && !head && !foot && st.frame === 'none' ? `<circle cx="${TW / 2}" cy="${TH / 2}" r="${W / 2}"/>` : `<rect x="0" y="0" width="${TW}" height="${TH}" rx="${cardR}"/>`;
    const plate = round ? `<circle cx="${fr + W / 2}" cy="${fr + head + W / 2}" r="${W / 2}" fill="${xe(st.bg)}"/>` : `<rect x="${ox - 2}" y="${oy - 2}" width="${n + 4}" height="${n + 4}" rx="${st.shape === 'rounded' ? 2 : 0}" fill="${xe(st.bg)}"/>`;
    const bg = st.bgImg ? `<clipPath id="qrc">${card}</clipPath><image href="${xe(st.bgImg)}" x="0" y="0" width="${TW}" height="${TH}" preserveAspectRatio="xMidYMid slice" opacity="${(st.bgOpacity ?? 100) / 100}" clip-path="url(#qrc)"/>${plate}` : '';
    const frame = st.frame === 'none' ? '' : `<rect x="${fr / 2}" y="${fr / 2}" width="${TW - fr}" height="${TH - fr}" rx="${Math.max(0, 3 - fr / 2)}" fill="none" stroke="${xe(st.dots)}" stroke-width="${fr}"/>`;
    const label = (t, y) => (t.text ? `<text x="${TW / 2}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="${xe(t.font)}, sans-serif" font-size="3.6" font-weight="700" fill="${xe(t.color)}">${xe(t.text)}</text>` : '');
    const logo = st.logo ? `<image href="${xe(st.logo)}" x="${ox + l0 + 0.3}" y="${oy + l0 + 0.3}" width="${L - 0.6}" height="${L - 0.6}" preserveAspectRatio="xMidYMid meet"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f2(TW)} ${f2(TH)}" role="img" aria-label="QR code">${card.replace('/>', ` fill="${xe(st.bg)}"/>`)}${bg}
<path d="${d}${solid}" fill="${xe(st.dots)}"/><path d="${ring}" fill="${xe(st.mBorder)}" fill-rule="evenodd"/><path d="${mid}" fill="${xe(st.mCenter)}"/>${logo}${frame}${label(st.header, fr + head / 2 + 0.4)}${label(st.footer, TH - fr - foot / 2 - 0.4)}</svg>`;
  }
  // the styled code as a PNG data URL, about px wide; images in it must already be data: URLs (an SVG drawn on a canvas can't load others)
  function qrStyledPng(text, st, px = 1200) {
    const svg = qrStyled(text, st); if (!svg) return Promise.resolve('');
    const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg); const k = px / +vb[1];
    return new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = Math.round(+vb[1] * k); c.height = Math.round(+vb[2] * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/png')); };
      img.onerror = reject; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.qrMatrix = qrMatrix; root.qrSvg = qrSvg; root.qrPng = qrPng; root.qrStyled = qrStyled; root.qrStyledPng = qrStyledPng; root.QR_DEFAULT = QR_DEFAULT;
})();
