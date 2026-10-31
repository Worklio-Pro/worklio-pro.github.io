// A small PDF writer (no dependencies): Letter-size pages of text, lines, boxes and PNG / JPEG images in the built-in Helvetica fonts.
// Coordinates are in points from the top-left (612 × 792); addPage() starts the next page. Used for payment receipts and quote / invoice PDFs.
const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]; // Helvetica, characters 32–126
// characters outside plain ASCII that the built-in fonts have (Windows-1252 positions)
const WIN = { '•': 0x95, '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '…': 0x85, '€': 0x80, '−': 0x2d, '·': 0xb7, '©': 0xa9, '®': 0xae, '°': 0xb0, 'é': 0xe9, 'ñ': 0xf1, 'ü': 0xfc };
const bytes = (s) => [...String(s ?? '')].map((ch) => { const c = ch.charCodeAt(0); return WIN[ch] ?? (c >= 32 && c < 127 ? c : c >= 160 && c < 256 ? c : 63); });
const width = (s, size, bold) => bytes(s).reduce((t, c) => t + (c >= 32 && c < 127 ? W[c - 32] : c === 0x95 ? 350 : 556), 0) * size / 1000 * (bold ? 1.02 : 1); // Helvetica-Bold runs slightly wider
const lit = (s) => '(' + Buffer.from(bytes(s)).toString('latin1').replace(/[\\()]/g, (m) => '\\' + m) + ')';
const zlib = require('zlib');
const rgb = (hex) => { const n = parseInt(String(hex || '#000000').replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' '); };

// a PNG or JPEG as PDF image data: { w, h, rgb: { dict, data }, alpha?: { dict, data } }, or null for anything else
function readImage(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) { // JPEG: the file goes in as it is
    for (let i = 2; i + 9 < buf.length;) {
      if (buf[i] !== 0xff) return null; const m = buf[i + 1]; const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) { const h = buf.readUInt16BE(i + 5); const w = buf.readUInt16BE(i + 7); const n = buf[i + 9];
        return { w, h, rgb: { dict: `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /${n === 1 ? 'DeviceGray' : n === 4 ? 'DeviceCMYK' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode`, data: buf } }; }
      i += 2 + len;
    }
    return null;
  }
  if (buf.toString('latin1', 1, 4) !== 'PNG') return null;
  let w = 0; let h = 0; let depth = 0; let type = 0; let inter = 0; let plte = null; let trns = null; const idat = [];
  for (let i = 8; i + 8 <= buf.length;) {
    const len = buf.readUInt32BE(i); const t = buf.toString('latin1', i + 4, i + 8); const d = buf.subarray(i + 8, i + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; inter = d[12]; } else if (t === 'PLTE') plte = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break;
    i += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]; if (depth !== 8 || inter || !ch) return null; // 8-bit, not interlaced: what browsers and image editors normally save
  const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * ch; const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) { // undo the PNG row filters
    const f = raw[y * (stride + 1)]; const from = y * (stride + 1) + 1; const at = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[at + x - ch] : 0; const b = y ? px[at + x - stride] : 0; const c = x >= ch && y ? px[at + x - stride - ch] : 0;
      const pa = Math.abs(b - c); const pb = Math.abs(a - c); const pc = Math.abs(a + b - 2 * c);
      px[at + x] = (raw[from + x] + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? b : c) : 0)) & 255;
    }
  }
  const rgb = Buffer.alloc(w * h * 3); const al = Buffer.alloc(w * h, 255); let hasAlpha = false;
  for (let i = 0; i < w * h; i++) {
    const o = i * ch; let r; let g; let bl; let aa = 255;
    if (type === 2 || type === 6) { r = px[o]; g = px[o + 1]; bl = px[o + 2]; if (type === 6) aa = px[o + 3]; } else if (type === 3) { const k = px[o]; r = plte[k * 3]; g = plte[k * 3 + 1]; bl = plte[k * 3 + 2]; if (trns && k < trns.length) aa = trns[k]; } else { r = g = bl = px[o]; if (type === 4) aa = px[o + 1]; }
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = bl; al[i] = aa; if (aa !== 255) hasAlpha = true;
  }
  const flate = (data, cs) => ({ dict: `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /${cs} /BitsPerComponent 8 /Filter /FlateDecode`, data: zlib.deflateSync(data) });
  return { w, h, rgb: flate(rgb, 'DeviceRGB'), alpha: hasAlpha ? flate(al, 'DeviceGray') : null };
}

function createPdf() {
  const pages = [[]]; let ops = pages[0]; const images = [];
  const H = 792;
  const api = {
    width,
    // align: 'left' | 'right' | 'center' (x is the right edge or center then); returns the text width
    text(x, y, s, { size = 11, bold = false, color = '#0f172a', align = 'left' } = {}) {
      const w = width(s, size, bold); const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
      ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg ${left.toFixed(2)} ${(H - y).toFixed(2)} Td ${lit(s)} Tj ET`); return w;
    },
    // wraps to maxWidth; returns the y below the last line
    para(x, y, s, maxWidth, o = {}) {
      const size = o.size || 11; const lh = o.lineHeight || size * 1.4; let line = '';
      for (const word of String(s || '').split(/\s+/)) {
        const t = line ? line + ' ' + word : word;
        if (line && width(t, size, o.bold) > maxWidth) { api.text(x, y, line, o); y += lh; line = word; } else line = t;
      }
      if (line) { api.text(x, y, line, o); y += lh; }
      return y;
    },
    line(x1, y1, x2, y2, { color = '#dbe4f0', w = 1 } = {}) { ops.push(`${rgb(color)} RG ${w} w ${x1} ${H - y1} m ${x2} ${H - y2} l S`); },
    addPage() { ops = []; pages.push(ops); },
    // a PNG or JPEG inside a box (top-left x, y; maxW × maxH), keeping its shape. Returns its { w, h } on the page, or null when the file can't be used
    image(buf, x, y, maxW, maxH, { alignRight = false, alignBottom = false } = {}) {
      let img = null; try { img = readImage(buf); } catch (e) { img = null; } if (!img || !img.w || !img.h) return null;
      const k = Math.min(maxW / img.w, maxH / img.h); const w = img.w * k; const h = img.h * k; images.push(img);
      const left = alignRight ? x + maxW - w : x; const top = alignBottom ? y + maxH - h : y;
      ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${left.toFixed(2)} ${(H - top - h).toFixed(2)} cm /Im${images.length} Do Q`); return { w, h };
    },
    rect(x, y, w, h, { fill = '#f1f5fb', stroke = null } = {}) { ops.push(`${rgb(fill)} rg ${stroke ? `${rgb(stroke)} RG 1 w` : ''} ${x} ${H - y - h} ${w} ${h} re ${stroke ? 'B' : 'f'}`); },
    toBuffer(title = 'Document') {
      // 1 catalog, 2 page list, 3–4 fonts, then a page and its content stream for each page, then the document info
      const n = pages.length; const pageId = (i) => 5 + i * 2;
      // images follow the pages (each with its transparency mask, if it has one)
      let next = 5 + n * 2; const imageObjs = []; const refs = images.map((img, i) => { const id = next; next += 1; let dict = img.rgb.dict; if (img.alpha) { dict += ` /SMask ${next} 0 R`; next += 1; } imageObjs.push({ dict, data: img.rgb.data }); if (img.alpha) imageObjs.push(img.alpha); return `/Im${i + 1} ${id} 0 R`; });
      const xobjects = refs.length ? ` /XObject << ${refs.join(' ')} >>` : '';
      const objs = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] /Count ${n} >>`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
        ...pages.flatMap((pg, i) => [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobjects} >> /Contents ${pageId(i) + 1} 0 R >>`, Buffer.from(pg.join('\n'), 'latin1')]),
        ...imageObjs,
        `<< /Title ${lit(title)} /Producer (Worklio Pro) >>`,
      ];
      const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')]; const offsets = []; let len = parts[0].length;
      objs.forEach((o, i) => {
        const body = o && o.dict ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< ${o.dict} /Length ${o.data.length} >>\nstream\n`, 'latin1'), o.data, Buffer.from('\nendstream\nendobj\n', 'latin1')]) : Buffer.isBuffer(o) ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${o.length} >>\nstream\n`, 'latin1'), o, Buffer.from('\nendstream\nendobj\n', 'latin1')])
          : Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1');
        offsets.push(len); parts.push(body); len += body.length;
      });
      const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${objs.length} 0 R >>\nstartxref\n${len}\n%%EOF\n`;
      parts.push(Buffer.from(xref, 'latin1'));
      return Buffer.concat(parts);
    },
  };
  return api;
}
module.exports = { createPdf };
