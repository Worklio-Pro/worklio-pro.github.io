/* QR codes for links (byte mode, error correction M, versions 1–10: up to 213 bytes), drawn as SVG or PNG; no library needed */
(function () {
  const ECC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26]; const BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5]; // codewords per block, blocks (level M)
  const rawModules = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataCodewords = (v) => Math.floor(rawModules(v) / 8) - ECC[v - 1] * BLOCKS[v - 1];
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; }; // GF(256)
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => (((x + y) % 2) + (x * y) % 3) % 2 === 0];

  // the modules as rows of true (dark) / false, or null when the text is too long
  function qrMatrix(text) {
    const data = [...new TextEncoder().encode(text)];
    let ver = 1; while (ver <= 10 && 4 + (ver < 10 ? 8 : 16) + data.length * 8 > dataCodewords(ver) * 8) ver++;
    if (ver > 10) return null;
    // the data bits: byte mode, length, bytes, terminator, padding
    const bits = []; const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(data.length, ver < 10 ? 8 : 16); data.forEach((b) => put(b, 8));
    const cap = dataCodewords(ver) * 8; put(0, Math.min(4, cap - bits.length)); put(0, (8 - (bits.length % 8)) % 8);
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
      const d = mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); // level M is 00
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
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.qrMatrix = qrMatrix; root.qrSvg = qrSvg; root.qrPng = qrPng;
})();
