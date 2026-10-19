'use strict';
// Public pricing page: the plans you sell (from the platform console), and self sign-up when you turn it on.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');

(async () => {
  const S = await (await fetch('/api/site')).json();
  document.title = `Pricing · ${S.productName}`;
  $('#brand').textContent = S.productName;
  const label = Object.fromEntries(S.features.map((f) => [f.key, f.label]));
  const mid = S.plans.length >= 3 ? Math.floor(S.plans.length / 2) : -1; // highlight the middle plan
  $('#plans').innerHTML = S.plans.map((p, i) => `<article class="card s-plan ${i === mid ? 'pop' : ''}"><span class="s-tag">${i === mid ? 'Most popular' : ''}</span><h2>${esc(p.name)}</h2>
<div class="price">${esc(p.price || 'Contact us')}</div><p class="desc">${esc(p.description)}</p>
<ul><li>${p.maxUsers ? `${p.maxUsers} team login${p.maxUsers === 1 ? '' : 's'}` : 'Unlimited team logins'}</li>${S.features.filter((f) => p.features.includes(f.key)).map((f) => `<li>${esc(label[f.key])}</li>`).join('')}
${S.alwaysIncluded.map((l) => `<li class="base">${esc(l)}</li>`).join('')}</ul>
${S.allowSignups ? `<a class="btn ${i === mid ? '' : 'alt'}" href="#signup" data-plan="${esc(p.id)}">Choose ${esc(p.name)}</a>` : S.contactEmail ? `<a class="btn ${i === mid ? '' : 'alt'}" href="mailto:${esc(S.contactEmail)}?subject=${encodeURIComponent(`${S.productName} ${p.name} plan`)}">Contact us</a>` : ''}</article>`).join('');
  $('#foot').innerHTML = S.contactEmail ? `Questions? Email <a href="mailto:${esc(S.contactEmail)}">${esc(S.contactEmail)}</a>` : '';
  if (!S.allowSignups) return;
  $('#topCta').hidden = false;
  const root = S.rootDomain;
  $('#signup').innerHTML = `<div class="card"><h2>Create your account</h2><p class="muted" style="margin:0 0 16px">You’ll be set up in under a minute.</p>
<form id="sf" novalidate><div id="err"></div><label>Plan<select name="plan">${S.plans.map((p) => `<option value="${esc(p.id)}" ${p.id === S.signupPlan ? 'selected' : ''}>${esc(p.name)}${p.price ? ` (${esc(p.price)})` : ''}</option>`).join('')}</select></label>
<label>Business name<input name="company" required maxlength="100" autocomplete="organization"></label>
<label>Your web address<div class="slug"><input name="slug" required maxlength="32" autocomplete="off" spellcheck="false"><span>.${esc(root)}</span></div><div class="hint" id="hint"></div></label>
<label>Your name<input name="name" required maxlength="100" autocomplete="name"></label>
<label>Email<input name="email" type="email" required autocomplete="email"></label>
<label>Password (8+ characters)<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
<button class="btn go">Create account</button><p class="muted" id="payNote" style="font-size:13px;margin:8px 0 0;text-align:center"></p></form></div>`;
  const f = $('#sf'); const slug = $('[name=slug]', f); const hint = $('#hint'); let t;
  const check = () => { clearTimeout(t); const v = slug.value.trim().toLowerCase(); if (!v) { hint.textContent = ''; return; }
    t = setTimeout(async () => { const r = await (await fetch('/api/site/slug-check?slug=' + encodeURIComponent(v))).json(); hint.className = 'hint ' + (r.ok ? 'good' : 'bad'); hint.textContent = r.ok ? `${v}.${root} is available` : r.error; }, 250); };
  slug.addEventListener('input', () => { slug.dataset.touched = '1'; check(); });
  $('[name=company]', f).addEventListener('input', (e) => { if (!slug.dataset.touched) { slug.value = slugify(e.target.value); check(); } });
  // paid plans go on to the checkout page after the account is created
  const sel = $('[name=plan]', f); const goLabel = () => { const p = S.plans.find((x) => x.id === sel.value); return p && p.paid ? 'Continue to payment' : 'Create account'; };
  const syncPlan = () => { const p = S.plans.find((x) => x.id === sel.value); $('.go', f).textContent = goLabel(); $('#payNote').textContent = p && p.paid ? `Next you’ll pay for ${p.name} (${p.price}).` : ''; };
  sel.addEventListener('change', syncPlan); syncPlan();
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-plan]'); if (b) { sel.value = b.dataset.plan; syncPlan(); } });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const btn = $('.go', f); const b = Object.fromEntries(new FormData(f)); b.slug = b.slug.trim().toLowerCase();
    btn.disabled = true; btn.textContent = 'Creating your account…';
    const r = await fetch('/api/site/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { location.href = j.url; return; }
    $('#err').innerHTML = `<div class="msg err" role="alert">${esc(j.error || 'Something went wrong. Try again.')}</div>`; btn.disabled = false; btn.textContent = goLabel();
  });
})();
