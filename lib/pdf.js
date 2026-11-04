// A small PDF writer (no dependencies): Letter-size pages of text, lines and boxes in the built-in Helvetica fonts.
// Coordinates are in points from the top-left (612 × 792); addPage() starts the next page. Used for payment receipts and quote / invoice PDFs.
const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]; // Helvetica, characters 32–126
// characters outside plain ASCII that the built-in fonts have (Windows-1252 positions)
const WIN = { '•': 0x95, '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '…': 0x85, '€': 0x80, '−': 0x2d, '·': 0xb7, '©': 0xa9, '®': 0xae, '°': 0xb0, 'é': 0xe9, 'ñ': 0xf1, 'ü': 0xfc };
const bytes = (s) => [...String(s ?? '')].map((ch) => { const c = ch.charCodeAt(0); return WIN[ch] ?? (c >= 32 && c < 127 ? c : c >= 160 && c < 256 ? c : 63); });
const width = (s, size, bold) => bytes(s).reduce((t, c) => t + (c >= 32 && c < 127 ? W[c - 32] : c === 0x95 ? 350 : 556), 0) * size / 1000 * (bold ? 1.02 : 1); // Helvetica-Bold runs slightly wider
const lit = (s) => '(' + Buffer.from(bytes(s)).toString('latin1').replace(/[\\()]/g, (m) => '\\' + m) + ')';
const rgb = (hex) => { const n = parseInt(String(hex || '#000000').replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' '); };

function createPdf() {
  const pages = [[]]; let ops = pages[0];
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
    rect(x, y, w, h, { fill = '#f1f5fb', stroke = null } = {}) { ops.push(`${rgb(fill)} rg ${stroke ? `${rgb(stroke)} RG 1 w` : ''} ${x} ${H - y - h} ${w} ${h} re ${stroke ? 'B' : 'f'}`); },
    toBuffer(title = 'Document') {
      // 1 catalog, 2 page list, 3–4 fonts, then a page and its content stream for each page, then the document info
      const n = pages.length; const pageId = (i) => 5 + i * 2;
      const objs = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] /Count ${n} >>`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
        ...pages.flatMap((pg, i) => [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId(i) + 1} 0 R >>`, Buffer.from(pg.join('\n'), 'latin1')]),
        `<< /Title ${lit(title)} /Producer (Worklio Pro) >>`,
      ];
      const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')]; const offsets = []; let len = parts[0].length;
      objs.forEach((o, i) => {
        const body = Buffer.isBuffer(o) ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${o.length} >>\nstream\n`, 'latin1'), o, Buffer.from('\nendstream\nendobj\n', 'latin1')])
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
