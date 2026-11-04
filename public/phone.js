'use strict';
// Every phone number box (<input type="tel">) gets a country code picker in front of it, on every page that loads this script:
// the app, the client portal, the public site, the business page and the booking and referral forms. Boxes added later
// (pop-ups, phone sheets) are picked up too. US and Canada (+1) numbers are written (123) 456-7890 as they're typed;
// other countries' numbers are kept as digits.
// The number is read and saved with its country, the same way the trial sign-up saves it (public/trial.js):
// +1 numbers as "(123) 456-7890", others as "+44 7911123456". input.value and FormData (and so native form posts) both give that,
// so pages read and save phone boxes as before. A box can opt out with data-no-cc (the trial sign-up has its own picker).
(() => {
  if (window.phoneInputs) return; window.phoneInputs = true;
  const COUNTRIES = [['US', '1', 'United States'], ['CA', '1', 'Canada'], ['PR', '1', 'Puerto Rico'], ['MX', '52', 'Mexico'], ['GB', '44', 'United Kingdom'], ['IE', '353', 'Ireland'],
    ['AU', '61', 'Australia'], ['NZ', '64', 'New Zealand'], ['DE', '49', 'Germany'], ['FR', '33', 'France'], ['ES', '34', 'Spain'], ['IT', '39', 'Italy'], ['NL', '31', 'Netherlands'],
    ['BR', '55', 'Brazil'], ['CO', '57', 'Colombia'], ['PH', '63', 'Philippines'], ['IN', '91', 'India'], ['ZA', '27', 'South Africa']];
  const LONGEST = [...COUNTRIES].sort((a, b) => b[1].length - a[1].length); // match +353 before +35…
  const flag = (cc) => String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0)));
  const us = (d) => (d.length > 6 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `(${d.slice(0, 3)}) ${d.slice(3)}` : d.length ? `(${d}` : '');
  const local = (code, d) => (code === '1' ? us(d.replace(/^1(?=\d{10})/, '').slice(0, 10)) : d.slice(0, 14));
  const NATIVE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const raw = (i) => NATIVE.get.call(i); const setRaw = (i, v) => NATIVE.set.call(i, v);
  // a saved number → its country code and national digits (no + : a US/Canada number); null when the country isn't in the list
  function parse(v) {
    const s = String(v ?? '').trim(); let d = s.replace(/\D/g, '');
    if (!s.startsWith('+')) { if (d.length === 11 && d[0] === '1') d = d.slice(1); return { code: '1', d }; }
    const c = LONGEST.find(([, code]) => d.startsWith(code));
    return c ? { code: c[1], cc: c[0], d: d.slice(c[1].length) } : null;
  }

  const css = document.createElement('style');
  css.textContent = `.ph-in{display:flex;align-items:stretch;gap:6px;width:100%;box-sizing:border-box}
.ph-in>select.ph-cc{flex:none;width:auto!important;min-width:0;margin:0!important;height:auto;font:inherit}
.ph-in>input{flex:1 1 auto;width:auto!important;min-width:0;margin:0!important}
.mf .ph-in>select.ph-cc{padding:2px 18px 2px 0}
.fl>.ph-in{position:static;font-size:inherit;color:inherit;gap:10px;align-items:center}
.fl .ph-in>input{border:0;padding:0;height:24px;background:transparent;box-shadow:none;outline:0}
.fl .ph-in>select.ph-cc{border:0;border-right:1px solid var(--line,#e5e7eb);border-radius:0;padding:0 22px 0 0;height:24px;background-color:transparent;box-shadow:none;background-position:right 6px center;color:var(--text,inherit)}`;
  // inside a floating-label box (.fl, .mf) the label's own span sits above; the picker and number share the line below it
  document.head.appendChild(css);

  function enhance(i) {
    if (i.dataset.cc || 'noCc' in i.dataset || i.closest('.tr-phone')) return;
    const start = parse(raw(i)); if (!start) return; // a number from a country we don't list stays as typed
    i.dataset.cc = '1';
    const sel = document.createElement('select'); sel.className = 'ph-cc'; sel.setAttribute('aria-label', 'Country code'); sel.disabled = i.disabled;
    sel.innerHTML = COUNTRIES.map(([cc, code, n]) => `<option value="${cc}" data-code="${code}" title="${n}">${flag(cc)} +${code}</option>`).join('');
    sel.value = start.cc || 'US';
    const box = document.createElement('span'); box.className = 'ph-in';
    const m = getComputedStyle(i); box.style.margin = m.margin; // the box takes the input's spacing
    i.parentNode.insertBefore(box, i); box.append(sel, i);
    const code = () => sel.selectedOptions[0].dataset.code;
    const ph = !i.placeholder || /\d/.test(i.placeholder); // a sample number placeholder follows the country; a floating label's " " is kept
    const syncPh = () => { if (ph) i.placeholder = code() === '1' ? '(123) 456-7890' : 'Phone number'; };
    const value = () => { const d = raw(i).replace(/\D/g, ''); return !d ? '' : code() === '1' ? local('1', d) : `+${code()} ${d}`; };
    const put = (v) => {
      const p = parse(v); if (!p) { setRaw(i, String(v ?? '')); return; }
      if (p.cc) sel.value = p.cc; else if (code() !== '1') sel.value = 'US';
      setRaw(i, local(code(), p.d)); syncPh();
    };
    Object.defineProperty(i, 'value', { configurable: true, get: value, set: put });
    put(raw(i));
    i.addEventListener('input', (e) => {
      const v = raw(i);
      if (/^\s*\+/.test(v)) { const p = parse(v); if (p && p.d) { put(v); return; } return; } // typed or pasted with its country code
      if (e.inputType && e.inputType.startsWith('delete')) return; // backspace isn't fought
      const before = v.slice(0, i.selectionStart ?? v.length).replace(/\D/g, '').length; // keep the cursor after the same digit
      setRaw(i, local(code(), v.replace(/\D/g, '')));
      let pos = 0; const nv = raw(i); for (let n = 0; pos < nv.length && n < before; pos++) if (/\d/.test(nv[pos])) n++;
      try { i.setSelectionRange(pos, pos); } catch (err) { /* not focused */ }
    });
    i.addEventListener('blur', () => { setRaw(i, local(code(), raw(i).replace(/\D/g, ''))); });
    sel.addEventListener('change', () => { setRaw(i, local(code(), raw(i).replace(/\D/g, ''))); syncPh(); i.dispatchEvent(new Event('input', { bubbles: true })); });
    // FormData (and a native form post) gets the number with its country
    const form = i.form; if (form) form.addEventListener('formdata', (e) => { if (i.name && !i.disabled && e.formData.has(i.name)) e.formData.set(i.name, value()); });
    new MutationObserver(() => { sel.disabled = i.disabled; }).observe(i, { attributes: true, attributeFilter: ['disabled'] });
  }
  const scan = (root) => { if (root.matches && root.matches('input[type=tel]')) enhance(root); if (root.querySelectorAll) root.querySelectorAll('input[type=tel]').forEach(enhance); };
  const go = () => { scan(document); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(scan))).observe(document.documentElement, { childList: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
