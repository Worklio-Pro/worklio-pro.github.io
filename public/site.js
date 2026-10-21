'use strict';
// Public pricing page: the plans you sell (from the platform console), and self sign-up when you turn it on.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');

(async () => {
  const S = await (await fetch('/api/site')).json();
  document.title = `Pricing · ${S.productName}`;
  $('#brand').textContent = S.productName;
  if (S.brand && S.brand.logo) { $('.h-brand i').outerHTML = brandImg(S.brand); $('#brand').hidden = S.brand.logoHasName; } // the logo from the platform console
  if (S.home) document.querySelectorAll('[data-home]').forEach((a) => { a.href = S.home + a.dataset.home; });
  const label = Object.fromEntries(S.features.map((f) => [f.key, f.label]));
  const beta = (f) => (f.beta ? ' <span class="beta-tag" title="In beta testing">Beta</span>' : '');
  // the "Most popular" plan, chosen in Alpha → Settings; automatic: the middle one when there are 3 or more
  const picked = S.plans.findIndex((p) => p.id === S.popularPlan);
  const mid = S.popularPlan === 'none' ? -1 : picked >= 0 ? picked : S.plans.length >= 3 ? Math.floor(S.plans.length / 2) : -1;
  // monthly or yearly prices: a switch above the plans once there are prices of both kinds to show
  const both = S.plans.some((p) => p.monthly) && S.plans.some((p) => p.yearly); const best = Math.max(0, ...S.plans.filter((p) => p.monthly && p.yearly).map((p) => Math.round((1 - p.yearly / (p.monthly * 12)) * 100)));
  let period = S.plans.some((p) => p.monthly) ? 'month' : 'year';
  const amount = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const priceHtml = (p) => {
    const y = period === 'year' && p.yearly; const v = y ? p.yearly : p.monthly || p.yearly;
    if (!v) return `<div class="price">${esc(p.priceLabel || p.price || 'Contact us')}</div><div class="per">&nbsp;</div>`;
    const yearly = y || !p.monthly; const save = p.monthly && p.yearly ? Math.round((1 - p.yearly / (p.monthly * 12)) * 100) : 0;
    return `<div class="price">${amount(v)}<small>/${yearly ? 'year' : 'month'}</small></div><div class="per">${yearly ? `${amount(Math.round(v / 12 * 100) / 100)}/month, billed yearly${save > 0 ? ` · <strong>save ${save}%</strong>` : ''}` : period === 'year' ? 'Billed monthly only' : p.yearly ? `or ${amount(p.yearly)}/year` : 'Billed monthly'}</div>`;
  };
  const drawPlans = () => {
    $('#period').innerHTML = both ? `<div class="s-period" role="radiogroup" aria-label="Billing period">${[['month', 'Monthly'], ['year', `Yearly${best > 0 ? ` <span class="s-save">Save up to ${best}%</span>` : ''}`]].map(([k, l]) => `<button type="button" role="radio" aria-checked="${period === k}" class="${period === k ? 'on' : ''}" data-period="${k}">${l}</button>`).join('')}</div>` : '';
    $('#plans').innerHTML = S.plans.map((p, i) => `<article class="card s-plan ${i === mid ? 'pop' : ''}"><span class="s-tag">${i === mid ? 'Most popular' : ''}</span><h2>${esc(p.name)}</h2>
${priceHtml(p)}<p class="desc">${esc(p.description)}</p>
<ul><li>${p.maxUsers ? `${p.maxUsers} team login${p.maxUsers === 1 ? '' : 's'}` : 'Unlimited team logins'}</li>${S.features.filter((f) => p.features.includes(f.key)).map((f) => `<li><span>${esc(label[f.key])}${beta(f)}</span></li>`).join('')}
${S.alwaysIncluded.map((l) => `<li class="base">${esc(l)}</li>`).join('')}</ul>
${S.allowSignups ? `<a class="btn ${i === mid ? '' : 'alt'}" href="#signup" data-plan="${esc(p.id)}">Choose ${esc(p.name)}</a>` : `<button type="button" class="btn ${i === mid ? '' : 'alt'}" data-contact="${esc(p.id)}">Contact us</button>`}</article>`).join('');
  };
  drawPlans();
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-period]'); if (!b) return; period = b.dataset.period; drawPlans(); const sel = $('#sf [name=interval]'); if (sel) { sel.value = period; sel.dispatchEvent(new Event('change')); } });
  $('#foot').innerHTML = 'Questions? <a href="#contact" data-contact="">Contact us</a> · <a href="/terms">Terms of Service</a> · <a href="/privacy">Privacy Policy</a>';
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-contact]'); if (b) { e.preventDefault(); openContact(S, b.dataset.contact); } });
  if (!S.allowSignups) return;
  const cta = $('#topCta'); cta.textContent = 'Get started'; delete cta.dataset.contact;
  // a referral link (/pricing?ref=…) from another business: kept for this visit, so it's still there after looking around
  const qs = new URLSearchParams(location.search); let ref = (qs.get('ref') || '').trim().toLowerCase().slice(0, 20);
  try { if (ref) sessionStorage.setItem('ref', ref); else ref = sessionStorage.getItem('ref') || ''; } catch (e) { /* private mode */ }
  const root = S.rootDomain; const urlCode = (new URLSearchParams(location.search).get('code') || '').trim().slice(0, 30); // a shared link: /pricing?code=SPRING20
  // the sign-up form waits here (hidden) and moves into a pop-up when someone chooses a plan or clicks Get started
  $('#signup').innerHTML = `<form id="sf" novalidate><div id="err"></div><input type="hidden" name="ref" value="${esc(ref)}"><label>Plan<select name="plan">${S.plans.map((p) => `<option value="${esc(p.id)}" ${p.id === S.signupPlan ? 'selected' : ''}>${esc(p.name)}${p.price ? ` (${esc(p.price)})` : ''}</option>`).join('')}</select></label>
${both ? `<label>Billing<select name="interval"><option value="month" ${period === 'month' ? 'selected' : ''}>Monthly</option><option value="year" ${period === 'year' ? 'selected' : ''}>Yearly${best > 0 ? ` (save up to ${best}%)` : ''}</option></select></label>` : ''}
<label>Business name<input name="company" required maxlength="100" autocomplete="organization"></label>
<label>Your web address<div class="slug"><input name="slug" required maxlength="32" autocomplete="off" spellcheck="false"><span>.${esc(root)}</span></div><div class="hint" id="hint"></div></label>
<div class="c-row"><label>Your name<input name="name" required maxlength="100" autocomplete="name"></label>
<label>Email<input name="email" type="email" required autocomplete="email"></label></div>
<label>Password (8+ characters)<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
<label id="codeRow">Discount code (optional)<input name="code" maxlength="30" autocomplete="off" autocapitalize="characters" spellcheck="false" style="text-transform:uppercase" value="${esc(urlCode)}"><div class="hint" id="codeHint"></div></label>
<p class="muted" style="font-size:13px;margin:4px 0 10px">By creating an account, you agree to the <a href="/terms" target="_blank" rel="noopener">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</p><button class="btn go">Create account</button><p class="muted" id="payNote" style="font-size:13px;margin:8px 0 0;text-align:center"></p></form>`;
  const f = $('#sf'); const slug = $('[name=slug]', f); const hint = $('#hint'); let t;
  const check = () => { clearTimeout(t); const v = slug.value.trim().toLowerCase(); if (!v) { hint.textContent = ''; return; }
    t = setTimeout(async () => { const r = await (await fetch('/api/site/slug-check?slug=' + encodeURIComponent(v))).json(); hint.className = 'hint ' + (r.ok ? 'good' : 'bad'); hint.textContent = r.ok ? `${v}.${root} is available` : r.error; }, 250); };
  slug.addEventListener('input', () => { slug.dataset.touched = '1'; check(); });
  $('[name=company]', f).addEventListener('input', (e) => { if (!slug.dataset.touched) { slug.value = slugify(e.target.value); check(); } });
  // paid plans go on to the checkout page after the account is created
  const sel = $('[name=plan]', f); const iv = $('[name=interval]', f);
  // the price the server will charge: the chosen period if the plan has it, otherwise the one it offers
  const chosen = () => { const p = S.plans.find((x) => x.id === sel.value); if (!p) return null; const want = iv ? iv.value : 'month';
    const per = want === 'year' ? (p.yearly ? 'year' : 'month') : (p.monthly ? 'month' : 'year'); const v = per === 'year' ? p.yearly : p.monthly; return v ? { p, v, per } : { p }; };
  const goLabel = () => { const c = chosen(); return c && c.v ? 'Continue to payment' : 'Create account'; };
  const syncPlan = () => { const c = chosen(); $('.go', f).textContent = goLabel(); $('#payNote').textContent = c && c.v ? `Next you’ll pay ${amount(c.v)} for ${c.p.name}, billed every ${c.per}.` : ''; };
  if (iv) iv.addEventListener('change', () => { if (period !== iv.value) { period = iv.value; drawPlans(); } syncPlan(); });
  // the discount code: checked against the chosen plan and billing as it's typed; the server checks it again on sign-up
  const code = $('[name=code]', f); const codeHint = $('#codeHint'); let ct;
  const checkCode = () => { clearTimeout(ct); const v = code.value.trim(); const c = chosen(); $('#codeRow').hidden = !!(c && !c.v) && !v; if (!v) { codeHint.textContent = ''; syncPlan(); return; }
    ct = setTimeout(async () => {
      const r = await fetch('/api/site/discount-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: v, plan: sel.value, interval: iv ? iv.value : 'month', email: $('[name=email]', f).value }) });
      const j = await r.json().catch(() => ({})); if (code.value.trim() !== v) return;
      codeHint.className = 'hint ' + (r.ok ? 'good' : 'bad'); codeHint.textContent = r.ok ? `${j.code}: ${j.summary}` : j.error || 'That code can’t be used';
      const c2 = chosen(); $('#payNote').textContent = r.ok && c2 && c2.v ? `Next you’ll pay ${amount(j.first / 100)} for ${c2.p.name} with your discount.` : $('#payNote').textContent;
    }, 350); };
  code.addEventListener('input', checkCode); sel.addEventListener('change', checkCode); if (iv) iv.addEventListener('change', checkCode);
  sel.addEventListener('change', syncPlan); syncPlan();
  const openSignup = (planId) => {
    if (planId) { sel.value = planId; sel.dispatchEvent(new Event('change')); }
    const opener = document.activeElement; const old = $('#overlay'); if (old) old.remove();
    const o = document.createElement('div'); o.className = 'overlay'; o.id = 'overlay';
    o.innerHTML = '<div class="modal su-modal" role="dialog" aria-modal="true" aria-labelledby="suTitle"><div class="mh"><div><h3 id="suTitle">Create your account</h3><p class="muted" style="margin:2px 0 0;font-size:14px">You’ll be set up in under a minute.</p></div><button type="button" class="x" data-close aria-label="Close">×</button></div><div class="mb"></div></div>';
    $('.mb', o).appendChild(f); document.body.appendChild(o);
    const close = () => { $('#signup').appendChild(f); o.remove(); document.removeEventListener('keydown', onKey); if (opener && opener.focus) opener.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', onKey);
    o.addEventListener('mousedown', (e) => { if (e.target === o) close(); });
    o.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    const first = [...f.querySelectorAll('input:not([type=hidden])')].find((x) => !x.value); (first || $('[name=company]', f)).focus();
  };
  if (urlCode) checkCode();
  if (urlCode || location.hash === '#signup') openSignup();
  if (ref) fetch('/api/site/ref/' + encodeURIComponent(ref)).then((r) => (r.ok ? r.json() : null)).then((L) => {
    if (!L) return; const box = document.createElement('div'); box.className = 'ref-banner';
    box.innerHTML = `<strong>${esc(L.business)} invited you.</strong>${L.offer ? ` Sign up with their link and get ${esc(L.offer)}.` : ' Choose a plan to get started.'}`;
    $('#plans').before(box); if (!code.value && L.code) { code.value = L.code; checkCode(); }
  }).catch(() => {});
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-plan], a[href="#signup"]'); if (!b) return; e.preventDefault(); openSignup(b.dataset.plan); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('.go', f); const b = Object.fromEntries(new FormData(f)); b.slug = b.slug.trim().toLowerCase();
    btn.disabled = true; btn.textContent = 'Creating your account…';
    const r = await fetch('/api/site/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { location.href = j.url; return; }
    $('#err').innerHTML = `<div class="msg err" role="alert">${esc(j.error || 'Something went wrong. Try again.')}</div>`; btn.disabled = false; btn.textContent = goLabel();
  });
})();

// "Contact us": a pop-up form that sends the message to the platform owner
function openContact(S, planId) {
  const close = () => { const o = $('#overlay'); if (o) o.remove(); document.removeEventListener('keydown', onKey); if (opener) opener.focus(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const opener = document.activeElement; close();
  const o = document.createElement('div'); o.className = 'overlay'; o.id = 'overlay';
  o.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ctTitle"><div class="mh"><h3 id="ctTitle">Contact us</h3><button type="button" class="x" data-close aria-label="Close">×</button></div><div class="mb">
<form id="cf" novalidate><div id="cErr"></div><p class="muted" style="margin:0 0 14px">Tell us about your business and we’ll get back to you, usually within one business day.</p>
<div class="c-row"><label>Your name<input name="name" required maxlength="100" autocomplete="name"></label><label>Email<input name="email" type="email" required maxlength="200" autocomplete="email"></label></div>
<div class="c-row"><label>Phone (optional)<input name="phone" type="tel" maxlength="40" autocomplete="tel"></label><label>Business name (optional)<input name="company" maxlength="100" autocomplete="organization"></label></div>
<label>Plan<select name="plan"><option value="">Not sure yet</option>${S.plans.map((p) => `<option value="${esc(p.id)}" ${p.id === planId ? 'selected' : ''}>${esc(p.name)}${p.price ? ` (${esc(p.price)})` : ''}</option>`).join('')}</select></label>
<label>Message<textarea name="message" required maxlength="4000" rows="5" placeholder="What would you like to know?"></textarea></label>
<label class="c-hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
<div class="foot"><button type="button" class="btn alt" data-close>Cancel</button><button class="btn go-c">Send message</button></div></form></div></div>`;
  document.body.appendChild(o); document.addEventListener('keydown', onKey);
  o.addEventListener('mousedown', (e) => { if (e.target === o) close(); });
  o.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  const f = $('#cf', o); $('[name=name]', f).focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(f)); const btn = $('.go-c', f);
    if (!b.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) { $('#cErr').innerHTML = '<div class="msg err" role="alert">Enter your name and a valid email address.</div>'; return; }
    if (!b.message.trim()) { $('#cErr').innerHTML = '<div class="msg err" role="alert">Write a short message.</div>'; return; }
    btn.disabled = true; btn.textContent = 'Sending…';
    const r = await fetch('/api/site/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r && r.ok) { $('.mb', o).innerHTML = `<div class="c-done" role="status"><div class="c-ok">✓</div><h3>Thanks, ${esc(b.name.trim().split(/\s+/)[0])}!</h3><p class="muted">Your message is on its way. We’ll reply to ${esc(b.email.trim())}.</p><div class="foot" style="justify-content:center"><button type="button" class="btn" data-close>Close</button></div></div>`; $('[data-close]', $('.mb', o)).focus(); return; }
    $('#cErr').innerHTML = `<div class="msg err" role="alert">${esc(j.error || 'Your message couldn’t be sent. Check your connection and try again.')}</div>`; btn.disabled = false; btn.textContent = 'Send message';
  });
}
