'use strict';
// Visual editor for help center articles (platform console → Help Center → article editor): a formatting bar over an
// editable area styled like the published article. What it saves is cleaned HTML with only the tags the help center
// styles (headings, paragraphs, bold/italic, links, lists, steps, note/tip boxes, code, keys, tables).
(function () {
  const ALLOWED = new Set(['P', 'H2', 'H3', 'STRONG', 'EM', 'A', 'UL', 'OL', 'LI', 'DIV', 'CODE', 'KBD', 'BR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
  const RENAME = { B: 'STRONG', I: 'EM', H1: 'H2', H4: 'H3', H5: 'H3', H6: 'H3' };
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'META', 'LINK', 'svg', 'SVG', 'IMG', 'VIDEO', 'AUDIO', 'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA']);
  const BLOCK = new Set(['P', 'H2', 'H3', 'UL', 'OL', 'DIV', 'TABLE']);
  const safeHref = (h) => { const v = String(h || '').trim(); return /^(https?:\/\/|mailto:|\/|#)/i.test(v) ? v : ''; };
  const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ===== cleaning: keep only what the help center styles ===== */
  function cleanNode(node) {
    if (node.nodeType === 3) return [document.createTextNode(node.nodeValue)];
    if (node.nodeType !== 1 || DROP.has(node.tagName)) return [];
    const tag = RENAME[node.tagName] || node.tagName;
    const kids = () => [...node.childNodes].flatMap(cleanNode);
    if (tag === 'DIV') {
      const kind = node.classList.contains('note') ? 'note' : node.classList.contains('tip') ? 'tip' : '';
      if (!kind) { const p = document.createElement('p'); kids().forEach((k) => p.appendChild(k)); return [p]; } // plain divs (Enter in some browsers) become paragraphs
      const d = document.createElement('div'); d.className = kind; const k = kids();
      (k.some((n) => n.nodeType === 1 && BLOCK.has(n.tagName)) ? flatten(k, true) : k).forEach((n) => d.appendChild(n)); return [d]; // plain text stays as is; paragraphs and lists stay blocks
    }
    if (tag === 'SPAN' && /font-weight:\s*(bold|[6-9]00)/i.test(node.getAttribute('style') || '')) { const s = document.createElement('strong'); kids().forEach((k) => s.appendChild(k)); return [s]; } // bold pasted from Google Docs
    if (!ALLOWED.has(tag)) return kids(); // spans, fonts and anything else: keep the text, drop the wrapper
    const el = document.createElement(tag);
    if (tag === 'A') { const h = safeHref(node.getAttribute('href')); if (!h) return kids(); el.setAttribute('href', h); }
    if (tag === 'OL' && node.classList.contains('steps')) el.className = 'steps';
    (tag === 'LI' || tag === 'TD' || tag === 'TH' ? flattenInline(kids()) : kids()).forEach((k) => el.appendChild(k));
    if (tag === 'LI' && !el.textContent.trim() && !el.querySelector('br')) return [];
    return [el];
  }
  // list items and table cells: paragraphs inside them become line breaks
  function flattenInline(nodes) {
    const out = [];
    nodes.forEach((n, i) => {
      if (n.nodeType === 1 && (n.tagName === 'P' || n.tagName === 'H2' || n.tagName === 'H3')) { if (out.length && i) out.push(document.createElement('br')); out.push(...n.childNodes); }
      else out.push(n);
    });
    return out;
  }
  // a list of nodes → blocks: loose text and inline tags are wrapped in paragraphs, empty paragraphs dropped
  function flatten(nodes, inBox) {
    const out = []; let run = null;
    const flush = () => { if (run && run.textContent.trim()) { while (run.lastChild && run.lastChild.nodeName === 'BR') run.lastChild.remove(); out.push(run); } run = null; };
    for (const n of nodes) {
      if (n.nodeType === 1 && BLOCK.has(n.tagName)) {
        flush();
        if (/^(P|H2|H3)$/.test(n.tagName) && [...n.childNodes].some((c) => c.nodeType === 1 && BLOCK.has(c.tagName))) { out.push(...flatten([...n.childNodes], inBox)); continue; }
        if (/^(P|H2|H3)$/.test(n.tagName)) { if (!n.textContent.trim()) continue; while (n.lastChild && n.lastChild.nodeName === 'BR') n.lastChild.remove(); }
        if (inBox && n.tagName === 'DIV') { out.push(...flatten([...n.childNodes], true)); continue; } // no boxes inside boxes
        out.push(n);
      } else {
        if (n.nodeType === 3 && !n.nodeValue.trim() && !run) continue;
        if (!run) run = document.createElement('p');
        run.appendChild(n);
      }
    }
    flush(); return out;
  }
  function cleanHtml(html) {
    const t = document.createElement('template'); t.innerHTML = String(html || '');
    return flatten([...t.content.childNodes].flatMap(cleanNode)).map((n) => n.outerHTML).join('\n');
  }

  /* ===== the editor ===== */
  const ic = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const BUTTONS = [
    ['bold', 'Bold (⌘B)', '<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/>'],
    ['italic', 'Italic (⌘I)', '<path d="M19 4h-9M14 20H5M15 4 9 20"/>'],
    ['link', 'Link (⌘K)', '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'],
    '|',
    ['ul', 'Bulleted list', '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'],
    ['ol', 'Numbered list', '<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>'],
    ['steps', 'Steps (numbered circles)', '<circle cx="5" cy="6" r="2.5"/><circle cx="5" cy="18" r="2.5"/><path d="M11 6h10M11 18h10"/>'],
    '|',
    ['note', 'Note box', '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'],
    ['tip', 'Tip box', '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>'],
    '|',
    ['code', 'Code or a setting name', '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'],
    ['kbd', 'Keyboard key', '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'],
    ['product', 'Insert the product name', '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><path d="M7 7h.01"/>'],
    '|',
    ['clear', 'Clear formatting', '<path d="M4 7V4h16v3M9 20h6M12 4v16"/><path d="m3 3 18 18"/>'],
    ['undo', 'Undo (⌘Z)', '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>'],
    ['redo', 'Redo (⇧⌘Z)', '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>'],
  ];

  function create(mount, { html = '', articles = [], onChange = () => {} } = {}) {
    mount.innerHTML = `<div class="rte"><div class="rte-bar" role="toolbar" aria-label="Formatting">
<select class="rte-block" aria-label="Text style"><option value="p">Paragraph</option><option value="h2">Heading</option><option value="h3">Subheading</option></select>
${BUTTONS.map((b) => (b === '|' ? '<span class="rte-sep" aria-hidden="true"></span>' : `<button type="button" class="rte-btn" data-c="${b[0]}" title="${b[1]}" aria-label="${b[1]}">${ic(b[2])}</button>`)).join('')}</div>
<div class="rte-linkbar" hidden><select class="rte-art" aria-label="Link to an article"><option value="">Link to an article…</option>${articles.map((a) => `<option value="${escHtml(a.slug)}">${escHtml(a.title)}</option>`).join('')}</select>
<span class="rte-or">or</span><input class="rte-url" type="text" placeholder="https://… or /articles/…" aria-label="Link address"><button type="button" class="btn sm" data-l="apply">Apply</button><button type="button" class="btn alt sm" data-l="remove">Remove link</button><button type="button" class="btn alt sm" data-l="cancel">Cancel</button></div>
<div class="rte-area hc-preview" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Article" spellcheck="true"></div></div>`;
    const bar = mount.querySelector('.rte-bar'); const area = mount.querySelector('.rte-area'); const block = mount.querySelector('.rte-block');
    const linkbar = mount.querySelector('.rte-linkbar'); const url = mount.querySelector('.rte-url'); const art = mount.querySelector('.rte-art');
    area.innerHTML = cleanHtml(html) || '<p><br></p>';
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* older browsers */ }
    let saved = null; // the selection, kept while the toolbar or link bar has focus
    const exec = (c, v = null) => { restore(); document.execCommand(c, false, v); changed(); };
    const changed = () => { onChange(); state(); };
    const inArea = (n) => n && (n === area || area.contains(n));
    const save = () => { const s = getSelection(); if (s.rangeCount && inArea(s.anchorNode)) saved = s.getRangeAt(0).cloneRange(); };
    function restore() { area.focus(); if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); } }
    const anchor = () => { const s = getSelection(); return s.rangeCount && inArea(s.anchorNode) ? s.anchorNode : saved && saved.startContainer; };
    const closest = (sel) => { let n = anchor(); if (n && n.nodeType === 3) n = n.parentNode; const el = n && n.closest ? n.closest(sel) : null; return el && area.contains(el) && el !== area ? el : null; };
    const topOf = (n) => { while (n && n.parentNode !== area) n = n.parentNode; return n; };
    // the top-level blocks the selection touches
    function selectedBlocks() {
      const r = saved || (getSelection().rangeCount && getSelection().getRangeAt(0)); if (!r) return [];
      const a = topOf(r.startContainer); const b = topOf(r.endContainer); if (!a) return [];
      const out = []; for (let n = a; n; n = n.nextSibling) { if (n.nodeType === 1) out.push(n); if (n === b) break; }
      return out;
    }
    // note / tip boxes: wrap the selected blocks, or unwrap if they're already that kind of box
    function box(kind) {
      restore(); const blocks = selectedBlocks(); if (!blocks.length) return;
      if (blocks.every((b) => b.tagName === 'DIV' && b.classList.contains(kind))) {
        blocks.forEach((b) => { const kids = [...b.childNodes]; const p = document.createElement('p'); if (kids.every((k) => !(k.nodeType === 1 && BLOCK.has(k.tagName)))) { kids.forEach((k) => p.appendChild(k)); b.replaceWith(p); } else b.replaceWith(...kids); });
      } else {
        const d = document.createElement('div'); d.className = kind; blocks[0].before(d);
        blocks.forEach((b) => { if (b.tagName === 'DIV') { d.append(...b.childNodes); b.remove(); } else d.appendChild(b); });
        const s = getSelection(); const r = document.createRange(); r.selectNodeContents(d); r.collapse(false); s.removeAllRanges(); s.addRange(r); save();
      }
      changed();
    }
    // inline code / key: wrap the selection, or unwrap if it's already inside one
    function inline(tag) {
      restore(); const ex = closest(tag);
      if (ex) { ex.replaceWith(...ex.childNodes); changed(); return; }
      const text = getSelection().toString() || (tag === 'kbd' ? 'Enter' : 'code');
      document.execCommand('insertHTML', false, `<${tag}>${escHtml(text)}</${tag}>&#8203;`); changed();
    }
    function lists(kind) {
      restore(); const ol = closest('ol');
      if (kind === 'ul') return exec('insertUnorderedList');
      if (kind === 'steps') {
        if (ol && ol.classList.contains('steps')) return exec('insertOrderedList'); // turn steps off
        if (ol) { ol.classList.add('steps'); return changed(); }
        document.execCommand('insertOrderedList'); const n = closest('ol'); if (n) n.classList.add('steps'); return changed();
      }
      if (ol && ol.classList.contains('steps')) { ol.classList.remove('steps'); return changed(); } // steps → plain numbers
      return exec('insertOrderedList');
    }
    function openLink() {
      save(); const a = closest('a');
      url.value = a ? a.getAttribute('href') : ''; art.value = (url.value.match(/^\/articles\/([a-z0-9-]+)$/) || [])[1] || '';
      linkbar.hidden = false; mount.querySelector('[data-l=remove]').hidden = !a; url.focus();
    }
    function applyLink() {
      const href = (url.value.trim().match(/^(https?:\/\/|mailto:|\/|#)/i) ? '' : url.value.trim().includes('.') ? 'https://' : '') + url.value.trim();
      linkbar.hidden = true; if (!safeHref(href)) { restore(); return; }
      restore(); const a = closest('a');
      if (a) a.setAttribute('href', href);
      else if (getSelection().isCollapsed) { const t = art.value ? (articles.find((x) => x.slug === art.value) || {}).title : href; document.execCommand('insertHTML', false, `<a href="${escHtml(href)}">${escHtml(t || href)}</a>&#8203;`); }
      else document.execCommand('createLink', false, href);
      changed();
    }
    const run = {
      bold: () => exec('bold'), italic: () => exec('italic'), link: openLink, ul: () => lists('ul'), ol: () => lists('ol'), steps: () => lists('steps'),
      note: () => box('note'), tip: () => box('tip'), code: () => inline('code'), kbd: () => inline('kbd'),
      product: () => exec('insertText', '{product}'),
      clear: () => { restore(); ['code', 'kbd', 'a'].forEach((t) => { const e = closest(t); if (e) e.replaceWith(...e.childNodes); }); document.execCommand('removeFormat'); document.execCommand('formatBlock', false, '<p>'); changed(); },
      undo: () => exec('undo'), redo: () => exec('redo'),
    };
    // keep the selection when clicking the toolbar
    bar.addEventListener('mousedown', (e) => { if (e.target.closest('.rte-btn')) e.preventDefault(); });
    bar.addEventListener('click', (e) => { const b = e.target.closest('.rte-btn'); if (b) run[b.dataset.c](); });
    block.addEventListener('mousedown', save);
    block.addEventListener('change', () => { exec('formatBlock', `<${block.value}>`); });
    linkbar.addEventListener('click', (e) => { const b = e.target.closest('[data-l]'); if (!b) return; if (b.dataset.l === 'apply') applyLink(); else if (b.dataset.l === 'remove') { linkbar.hidden = true; restore(); const a = closest('a'); if (a) { a.replaceWith(...a.childNodes); changed(); } } else { linkbar.hidden = true; restore(); } });
    art.addEventListener('change', () => { if (art.value) url.value = `/articles/${art.value}`; });
    url.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); linkbar.hidden = true; restore(); } });
    area.addEventListener('keydown', (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openLink(); }
      if (e.key === 'Tab' && closest('li')) { e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'indent'); changed(); }
    });
    area.addEventListener('input', () => { if (!area.firstElementChild) area.innerHTML = '<p><br></p>'; changed(); });
    // pasted content is cleaned: Word / Google Docs styling goes, structure stays
    area.addEventListener('paste', (e) => {
      e.preventDefault(); const h = e.clipboardData.getData('text/html'); const t = e.clipboardData.getData('text/plain');
      document.execCommand('insertHTML', false, h ? cleanHtml(h) : t.split(/\r?\n\s*\r?\n/).map((p) => `<p>${escHtml(p).replace(/\r?\n/g, '<br>')}</p>`).join(''));
      changed();
    });
    area.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); });
    // highlight the buttons that apply where the cursor is
    function state() {
      if (!inArea(getSelection().anchorNode)) return; save();
      const top = topOf(getSelection().anchorNode); const h = top && /^H[23]$/.test(top.tagName) ? top.tagName.toLowerCase() : 'p'; block.value = h;
      const ol = closest('ol'); const on = {
        bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), link: !!closest('a'), ul: !!closest('ul'), ol: !!ol && !ol.classList.contains('steps'), steps: !!ol && ol.classList.contains('steps'),
        note: !!closest('div.note'), tip: !!closest('div.tip'), code: !!closest('code'), kbd: !!closest('kbd'),
      };
      bar.querySelectorAll('.rte-btn').forEach((b) => { const v = !!on[b.dataset.c]; b.classList.toggle('on', v); if (b.dataset.c in on) b.setAttribute('aria-pressed', String(v)); });
    }
    document.addEventListener('selectionchange', state);
    return {
      html: () => cleanHtml(area.innerHTML).replace(/​/g, ''),
      set: (h) => { area.innerHTML = cleanHtml(h) || '<p><br></p>'; },
      focus: () => area.focus(),
      destroy: () => document.removeEventListener('selectionchange', state),
    };
  }
  window.hcEditor = { create, cleanHtml };
})();
