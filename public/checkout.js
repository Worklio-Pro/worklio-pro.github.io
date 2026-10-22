'use strict';
// Checkout after sign-up: review the account and plan, switch plans if wanted, then pay (Stripe Checkout, or a demo without Stripe keys).
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const token = location.pathname.split('/')[2] || '';
const money = (cents) => '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });
const per = (c) => (c.interval === 'year' ? 'year' : 'month');
const api = async (method, url, body) => {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); return j;
};
// what renewals cost, in the small print under the Pay button
const renewText = (c, D) => {
  const full = `${money(c.cents)}/${per(c)}`;
  if (!D) return `Your plan renews every ${per(c)} at ${money(c.cents)} until you cancel.`;
  if (D.duration === 'forever') return `Your plan renews at ${money(D.renews)}/${per(c)} with your discount, until you cancel.`;
  if (D.duration === 'repeating' && c.interval === 'month' && D.months > 1) return `Your discount applies for ${D.months} months, then your plan renews at ${full} until you cancel.`;
  return `After this payment, your plan renews at ${full} until you cancel.`;
};
let codeErr = ''; let codeTyped = '';
let C; let err = new URLSearchParams(location.search).get('unpaid') ? 'Your payment wasn’t completed, so nothing was charged. You can try again below.' : '';

function render() {
  document.title = `Checkout · ${C.productName}`; $('#brand').innerHTML = brandImg(C.brand) + (C.brand && C.brand.logoHasName ? '' : `<span>${esc(C.productName)}</span>`);
  const main = $('#main');
  if (C.status !== 'pending') { // already paid (or moved to a free plan)
    main.innerHTML = `<div class="done"><div class="card pad"><h1 style="margin:0 0 8px;font-size:24px">You’re all set</h1>
<p class="muted">${esc(C.company)} is ready at <strong>${esc(C.address)}</strong>.${C.trialEndsAt ? ` Your free trial runs until ${esc(new Date(C.trialEndsAt + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}, no card needed. Add a card any time in Account and billing.` : ''}</p><a class="btn pay" style="line-height:30px" href="${esc(C.loginUrl)}">Log in to your account</a></div></div>`;
    return;
  }
  const p = C.plan; const c = p.charge; const D = C.discount; const due = D ? D.first : c.cents; const label = Object.fromEntries(C.features.map((f) => [f.key, f.label]));
  const feats = C.features.filter((f) => p.features.includes(f.key)).map((f) => esc(label[f.key]) + (f.beta ? ' <span class="beta-tag" title="In beta testing">Beta</span>' : ''));
  main.innerHTML = `<div class="co"><section>
<h1>Complete your order</h1><p class="lead">Your account is created. Pay for your plan to start using it.</p>
<div class="card pad"><h2>Your account</h2><dl class="acct"><dt>Business</dt><dd>${esc(C.company)}</dd><dt>Web address</dt><dd>${esc(C.address)}</dd><dt>Owner login</dt><dd>${esc(C.email)}</dd></dl></div>
<div class="card pad"><h2 id="planHd">Plan</h2>${C.plans.some((x) => x.monthly && x.yearly) ? `<div class="period" role="radiogroup" aria-label="Billing period">${[['month', 'Monthly'], ['year', 'Yearly']].map(([k, l]) => `<button type="button" role="radio" aria-checked="${C.interval === k}" class="${C.interval === k ? 'on' : ''}" data-period="${k}">${l}</button>`).join('')}</div>` : ''}
<div class="plans" role="radiogroup" aria-labelledby="planHd">
${C.plans.map((x) => `<label class="opt"><input type="radio" name="plan" value="${esc(x.id)}" ${x.id === p.id ? 'checked' : ''}>
<span><span class="nm">${esc(x.name)}</span><span class="ds" style="display:block">${esc(x.description)}</span></span>
<span class="pr">${x.charge ? `${money(x.charge.cents)}/${x.charge.interval === 'year' ? 'yr' : 'mo'}${x.monthly && x.yearly && x.charge.interval === 'year' && x.yearly < x.monthly * 12 ? `<small class="sv">Save ${Math.round((1 - x.yearly / (x.monthly * 12)) * 100)}%</small>` : ''}` : esc(x.priceLabel || x.price || 'Free')}</span></label>`).join('')}
</div></div></section>
<aside class="card pad sum" aria-label="Order summary"><h2>Order summary</h2>
<div id="err">${err ? `<div class="msg err" role="alert">${esc(err)}</div>` : ''}${C.discountNote ? `<div class="msg warn" role="status">${esc(C.discountNote)}</div>` : ''}</div>
<p class="line"><span>${esc(C.productName)} ${esc(p.name)}</span><span>${money(c.cents)}</span></p>
<p class="line muted"><span>Billed every ${per(c)}</span><span>${p.maxUsers ? `${p.maxUsers} login${p.maxUsers === 1 ? '' : 's'}` : 'Unlimited logins'}</span></p>
${D ? `<p class="line disc"><span>Code <strong>${esc(D.code)}</strong> <button type="button" class="linkish" id="rmCode">Remove</button><small>${esc(D.summary)}</small></span><span>−${money(D.off)}</span></p>`
    : `<details class="code"${codeErr ? ' open' : ''}><summary>Have a discount code?</summary><form id="codeForm"><input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Code" aria-label="Discount code" value="${esc(codeTyped)}"><button class="btn alt">Apply</button></form>${codeErr ? `<div class="msg err" role="alert" style="margin:8px 0 0">${esc(codeErr)}</div>` : ''}</details>`}
<p class="line total"><span>Due today</span><span>${money(due)}</span></p>
<button class="btn pay" id="pay"><span class="lock">${C.live ? '🔒 ' : ''}${due ? `Pay ${money(due)} and start` : 'Start my account'}</span></button>
${C.live ? `<p class="fine">You’ll enter your card on Stripe’s secure checkout page. ${renewText(c, D)}${C.testMode ? '<br><strong>Test mode:</strong> use card 4242 4242 4242 4242.' : ''}</p>`
    : '<div class="msg warn" style="margin:12px 0 0;font-size:13px">Demo checkout: card payments aren’t set up yet, so no card is charged. Your account starts right away.</div>'}
<details><summary>What’s included in ${esc(p.name)}</summary><ul>${feats.map((f) => `<li>${f}</li>`).join('')}${C.alwaysIncluded.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></details>
${C.contactEmail ? `<p class="fine">Questions? <a href="mailto:${esc(C.contactEmail)}">${esc(C.contactEmail)}</a></p>` : ''}</aside></div>`;

  const form = $('#codeForm'); if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault(); codeTyped = form.code.value.trim(); if (!codeTyped) return;
    try { C = await api('POST', `/api/site/checkout/${token}/code`, { code: codeTyped }); codeErr = ''; codeTyped = ''; err = ''; render(); } catch (x) { codeErr = x.message; render(); $('#codeForm input').focus(); }
  });
  const rm = $('#rmCode'); if (rm) rm.addEventListener('click', async () => { C = await api('POST', `/api/site/checkout/${token}/code`, { code: '' }); render(); });
  const pick = async (body) => { try { C = await api('POST', `/api/site/checkout/${token}/plan`, { planId: C.plan.id, interval: C.interval, ...body }); err = ''; render(); } catch (e) { err = e.message; render(); } };
  main.querySelectorAll('[name=plan]').forEach((r) => r.addEventListener('change', () => pick({ planId: r.value })));
  main.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => pick({ interval: b.dataset.period })));
  $('#pay').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = C.live ? 'Opening secure checkout…' : 'Starting your account…';
    try { const r = await api('POST', `/api/site/checkout/${token}/pay`); location.href = r.redirect || r.url; }
    catch (x) { err = x.message; C = await api('GET', `/api/site/checkout/${token}`).catch(() => C); render(); } // e.g. the code ran out: show the new total
  });
}

(async () => {
  try { C = await api('GET', `/api/site/checkout/${token}`); render(); }
  catch (e) { $('#main').innerHTML = `<div class="done"><div class="card pad"><h1 style="margin:0 0 8px;font-size:22px">Checkout link not found</h1><p class="muted">${esc(e.message)}</p><a class="btn alt" href="/pricing">Back to pricing</a></div></div>`; }
})();
