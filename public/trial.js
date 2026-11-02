'use strict';
// "Start 30-day trial" on the home page: a two-step sign-up pop-up. Step 1 is the business and how to reach them,
// step 2 the plan, web address and password. The account opens right away on the chosen plan, free for 30 days with no card
// (lib/platform.js, SITE_TRIAL). Without self sign-up the buttons stay links to the pricing page.
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');
  const amount = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const S = await fetch('/api/site').then((r) => r.json()).catch(() => null);
  const plans = S && S.allowSignups ? S.plans.filter((p) => p.monthly || p.yearly) : [];
  if (!plans.length) return;
  const per = (p) => (p.monthly ? { v: p.monthly, per: 'month' } : { v: p.yearly, per: 'year' }); // monthly when the plan has it
  const start = plans.find((p) => p.id === S.signupPlan) || plans[0];
  const root = S.rootDomain;

  function open() {
    const opener = document.activeElement; const old = $('#overlay'); if (old) old.remove();
    const o = document.createElement('div'); o.className = 'overlay'; o.id = 'overlay';
    o.innerHTML = `<div class="modal tr-modal" role="dialog" aria-modal="true" aria-labelledby="trTitle">
<button type="button" class="x tr-x" data-close aria-label="Close">×</button>
<h2 id="trTitle">Start your 30-day free trial</h2>
<div class="tr-box"><ol class="tr-steps"><li class="on" data-step="1"><b>Step 1</b>Tell us about your business</li><li data-step="2"><b>Step 2</b>Trial details</li></ol>
<form id="tr1" novalidate><div class="tr-err"></div>
<input name="company" required maxlength="100" autocomplete="organization" placeholder="Business name" aria-label="Business name">
<input name="name" required maxlength="100" autocomplete="name" placeholder="Full name" aria-label="Full name">
<input name="email" type="email" required maxlength="200" autocomplete="email" placeholder="Email address" aria-label="Email address">
<input name="phone" type="tel" required maxlength="40" autocomplete="tel" placeholder="Phone number" aria-label="Phone number">
<button class="btn tr-go">Go to step 2</button><p class="tr-note">No credit card needed.</p></form>
<form id="tr2" novalidate hidden><div class="tr-err"></div><button type="button" class="tr-back">← Back to step 1</button>
<fieldset class="tr-plans"><legend class="tr-head"><span>Plan</span><span>Price</span></legend>
${plans.map((p) => { const c = per(p); return `<label><input type="radio" name="plan" value="${esc(p.id)}" ${p === start ? 'checked' : ''}><span>${esc(p.name)}</span><span class="tr-price">30 days free, then ${amount(c.v)}/${c.per}</span></label>`; }).join('')}</fieldset>
<label>What kind of work do you do?<select name="industry" required><option value="">Choose your industry</option>${(S.industries || []).map((i) => `<option value="${esc(i.slug)}">${esc(i.name)}</option>`).join('')}</select></label>
<label class="tr-other" hidden>Your industry<input name="industryOther" maxlength="80" placeholder="e.g. Septic pumping"></label>
<label>Your web address<div class="slug"><input name="slug" required maxlength="32" autocomplete="off" spellcheck="false"><span>.${esc(root)}</span></div><div class="hint"></div></label>
<label>Password (8+ characters)<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
<p class="tr-sum"></p>
<label class="tr-agree"><input type="checkbox" name="agree"> <span>I agree to the <a href="/terms" target="_blank" rel="noopener">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>
<button class="btn tr-go">Start my 30-day free trial</button><p class="tr-note">No credit card needed. Add one in Account and billing before your trial ends to keep your account.</p></form></div></div>`;
    document.body.appendChild(o);
    const close = () => { o.remove(); document.removeEventListener('keydown', onKey); if (opener && opener.focus) opener.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', onKey);
    o.addEventListener('mousedown', (e) => { if (e.target === o) close(); });
    o.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    const f1 = $('#tr1', o); const f2 = $('#tr2', o);
    const err = (f, m) => { $('.tr-err', f).innerHTML = m ? `<div class="msg err" role="alert">${m}</div>` : ''; };
    const step = (n) => { f1.hidden = n !== 1; f2.hidden = n !== 2; o.querySelectorAll('[data-step]').forEach((li) => li.classList.toggle('on', li.dataset.step === String(n)));
      const first = [...(n === 1 ? f1 : f2).querySelectorAll('input:not([type=radio]):not([type=checkbox]),select')].find((x) => !x.value); if (first) first.focus(); };
    $('[name=company]', f1).focus();
    f1.addEventListener('submit', (e) => {
      e.preventDefault(); const b = Object.fromEntries(new FormData(f1));
      if (!b.company.trim()) return err(f1, 'Enter your business name.');
      if (!b.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) return err(f1, 'Enter your name and a valid email address.');
      if (b.phone.replace(/\D/g, '').length < 10) return err(f1, 'Enter a phone number we can reach you at.');
      err(f1, ''); if (!slug.dataset.touched) { slug.value = slugify(b.company); check(); } step(2);
    });
    $('.tr-back', f2).addEventListener('click', () => step(1));
    // the web address: made from the business name until it's edited, and checked as it's typed
    const slug = $('[name=slug]', f2); const hint = $('.hint', f2); let t;
    const check = () => { clearTimeout(t); const v = slug.value.trim().toLowerCase(); if (!v) { hint.textContent = ''; return; }
      t = setTimeout(async () => { const r = await (await fetch('/api/site/slug-check?slug=' + encodeURIComponent(v))).json(); hint.className = 'hint ' + (r.ok ? 'good' : 'bad'); hint.textContent = r.ok ? `${v}.${root} is available` : r.error; }, 250); };
    slug.addEventListener('input', () => { slug.dataset.touched = '1'; check(); });
    $('[name=industry]', f2).addEventListener('change', (e) => { $('.tr-other', f2).hidden = e.target.value !== 'other'; if (e.target.value === 'other') $('[name=industryOther]', f2).focus(); });
    const sum = () => { const p = plans.find((x) => x.id === $('[name=plan]:checked', f2).value); const c = per(p);
      const end = new Date(Date.now() + 29 * 864e5).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      $('.tr-sum', f2).innerHTML = `<b>${esc(p.name)}</b> free until ${end}, then ${amount(c.v)}/${c.per} if you keep it.`; };
    f2.addEventListener('change', (e) => { if (e.target.name === 'plan') sum(); }); sum();
    f2.addEventListener('submit', async (e) => {
      e.preventDefault(); const b = { ...Object.fromEntries(new FormData(f1)), ...Object.fromEntries(new FormData(f2)) };
      if (!b.industry) return err(f2, 'Choose the kind of work you do.');
      if (!b.slug.trim()) return err(f2, 'Choose your web address.');
      if (b.password.length < 8) return err(f2, 'Use a password with at least 8 characters.');
      if (!b.agree) return err(f2, 'Agree to the Terms of Service and Privacy Policy to start your trial.');
      const p = plans.find((x) => x.id === b.plan); b.interval = per(p).per; b.slug = b.slug.trim().toLowerCase(); b.trial = true; delete b.agree;
      const btn = $('.tr-go', f2); btn.disabled = true; btn.textContent = 'Starting your trial…'; err(f2, '');
      const r = await fetch('/api/site/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (r && r.ok) { location.href = j.url; return; }
      err(f2, `${esc(j.error || 'Something went wrong. Check your connection and try again.')}${j.signIn ? ' <a href="/sign-in">Log in</a>' : ''}`); // the email already has a login
      btn.disabled = false; btn.textContent = 'Start my 30-day free trial';
    });
  }
  document.querySelectorAll('[data-trial]').forEach((a) => { a.addEventListener('click', (e) => { e.preventDefault(); open(); }); });
  if (location.hash === '#trial') open();
})();
