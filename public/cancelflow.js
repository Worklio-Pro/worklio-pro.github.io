/* The cancel popup (Modify subscription → Cancel plan): the steps and offers set in Alpha → Accounts → Cancellation flow.
   The business app opens it from Account and billing; Alpha runs it with sample data and o.test = true, which logs, saves and charges nothing.
   cancelFlow(billing, { step, me, company, api, toast, fmtDate, money, billGo, plans, test }) */
(() => {
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const $ = (q, el = document) => el.querySelector(q); const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const MS_IC = {
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>',
  hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2"/>',
  down: '<path d="M4 4h6a6 6 0 0 1 6 6v9"/><path d="m12 15 4 4 4-4"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  next: '<path d="m9 18 6-6-6-6"/>', back: '<path d="M19 12H5M12 19l-7-7 7-7"/>', chev: '<path d="m6 9 6 6 6-6"/>',
  frown: '<circle cx="12" cy="12" r="9"/><path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  alert: '<path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z"/><path d="M12 8v4M12 16h.01"/>',
  circleAlert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  spark: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>', zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>', dollar: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  video: '<path d="m22 8-6 4 6 4z"/><rect x="2" y="6" width="14" height="12" rx="2"/>', check: '<path d="M20 6 9 17l-5-5"/>', gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeOff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a10 10 0 0 0 5.4-1.6M2 2l20 20M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>', undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
};
const msI = (k, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MS_IC[k]}</svg>`;
window.cancelFlow = (B, o) => {
  const d = o; const { me, company, api, fmtDate, money } = o; const T = B.trial; const sub = B.subscription; const ending = sub && sub.cancelAtPeriodEnd; const R = B.retention || {}; const U = B.usage || {};
  // the steps and offers, as set in Alpha → Accounts → Cancellation flow
  const C = R.config || { extend: { on: true }, sprint: { on: true }, tour: { on: true }, stay: { on: true, percent: 15, months: 3 }, lose: { on: true }, feedback: { on: true, required: true }, gift: { on: true, percent: 50 }, password: { on: true }, yearly: false, reasons: [] };
  // its own popup (the app's .overlay/.modal look), so it opens the same way in the app and in Alpha
  const old = document.getElementById('overlay'); if (old) old.remove();
  const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'overlay';
  ov.innerHTML = `<div class="modal ms" role="dialog" aria-modal="true" aria-label="Modify subscription">${o.test ? '<div class="ms-test">Test run: nothing is saved, charged, emailed or logged</div>' : ''}<div class="mb"></div></div>`;
  document.body.appendChild(ov); const box = $('.modal', ov); const mb = $('.mb', ov); const close = () => ov.remove();
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  const onKey = (e) => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', onKey);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`; const amt = (n) => money(n).replace(/\.00$/, '');
  const per = B.interval === 'year' ? 'year' : 'month'; const short = per === 'year' ? 'yr' : 'mo';
  const priceOf = (p) => p[per] || p.month || p.year || 0; const mine = B.plans.find((p) => p.id === B.plan.id);
  const cur = B.plan.charge ? B.plan.charge.cents / 100 : mine ? priceOf(mine) : 0;
  const others = B.plans.filter((p) => p.id !== B.plan.id && !p.hidden);
  const up = others.filter((p) => priceOf(p) > cur).sort((a, b) => priceOf(a) - priceOf(b))[0]; const down = others.some((p) => priceOf(p) < cur);
  const canCancel = !!((sub && !ending) || (T && !T.cancelled && !T.prepaid));
  const endsOn = T ? T.endsAt : sub && sub.periodEnd; const first = esc(String((me && me.name) || '').split(/\s+/)[0] || '');
  // a stay discount: once per account, with a paid subscription or a trial that will become one (monthly billing unless Alpha allows yearly)
  const canDiscount = !R.offer && B.live && !!B.plan.charge && (B.plan.charge.interval === 'month' || C.yearly) && !B.prepaidUntil && canCancel;
  const S = { pct: C.stay.percent, n: C.stay.months, g: C.gift.percent }; const bills = (w) => (S.n > 1 ? `${w} ${S.n} bills` : `${w} bill`);
  const ctx = { reason: null, feedback: '' }; const hist = []; let step = d && d.step === 'reasons' ? 'reasons' : 'menu'; let more = false;
  // the log in Alpha → Accounts → Cancellations: the reason, the offer shown, feedback and how it ended
  const fid = Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => x.toString(16).padStart(2, '0')).join(''); let logged = false;
  const log = (b) => (o.test ? Promise.resolve() : api('POST', '/api/account/billing/flow', { flowId: fid, ...b }).catch(() => {}));
  new MutationObserver((_, mo) => { if (!box.isConnected) { mo.disconnect(); document.removeEventListener('keydown', onKey); if (logged) log({ outcome: 'closed' }); } }).observe(document.body, { childList: true });
  const start = step; const trail = []; let doneMsg = '';
  const go = (s) => { hist.push(step); step = s; draw(); }; const back = () => { step = hist.pop() || 'menu'; draw(); };
  // after the offer: what pauses, feedback, the parting gift, then confirming (each one Alpha can turn off)
  const seq = [C.lose.on && 'lose', C.feedback.on && 'feedback', C.gift.on && canDiscount && 'gift', 'confirm'].filter(Boolean);
  const nextAfter = (s) => seq[seq.indexOf(s) + 1] || seq[0];
  const xBtn = `<button type="button" class="ms-x" data-ms="close" aria-label="Close">${msI('x', 20)}</button>`;
  const head = () => `<div class="ms-top"><button type="button" class="ms-back" data-ms="back">${msI('back', 18)} Back</button>${xBtn}</div>`;
  const banner = (tone, icon, title, text, extra = '') => `<div class="ms-ban ${tone}"><span class="ms-bi">${msI(icon)}</span><div><strong>${title}</strong>${text ? `<p>${text}</p>` : ''}${extra}</div></div>`;
  const rows = (items, tone = '') => `<div class="ms-rows ${tone}">${items.map(([i, t, s]) => `<div class="ms-row"><span class="ms-ri">${msI(i, 18)}</span><div>${t}${s ? `<small>${s}</small>` : ''}</div></div>`).join('')}</div>`;
  const cta = (label, act, alt) => `<button type="button" class="btn ms-cta" data-ms="${act}">${label}</button><button type="button" class="ms-skip" data-ms="next">${alt}</button>`;
  const opt = (tone, icon, title, text, act, dis) => `<button type="button" class="ms-opt ${tone}${dis ? ' dis' : ''}" ${dis ? 'disabled' : `data-ms="${act}"`}><span class="ms-oi">${msI(icon)}</span><span class="ms-ot"><strong>${title}</strong><small>${text}</small></span><span class="ms-chev">${msI('next', 18)}</span></button>`;
  // the offer a reason leads to; if it isn't available here, the tour (when it's on), otherwise straight on
  const avail = { sprint: C.sprint.on, tour: C.tour.on, stay: C.stay.on && canDiscount, extend: !!R.canExtend };
  const offerFor = (r) => (avail[r.offer] ? r.offer : r.offer !== 'none' && avail.tour ? 'tour' : null);
  const REASON_ICONS = ['frown', 'gear', 'wallet', 'compass', 'msg', 'shield', 'spark', 'list'];
  const ask = async (el, subject, message, outcome) => {
    if (o.test) return finish('support', { subject }, el);
    el.disabled = true;
    try { await api('POST', '/api/support', { email: me.email, subject, message, topic: 'Account and billing', page: location.href }); await log({ outcome }); close(); o.toast('Thanks! We’ll email you within one business day to set it up.'); }
    catch (err) { o.toast(err.message, true); el.disabled = false; }
  };
  // what a real run would have done at the end of a test
  const NAMES = { menu: 'Modify subscription', reasons: 'Why are you leaving?', sprint: '5-day setup plan', tour: 'Specialist tour', extend: 'Trial extension', stay: 'Stay discount', lose: 'What they’ll lose', feedback: 'Feedback', gift: 'Parting gift', confirm: 'Confirm cancellation' };
  const finish = (url, body, el) => {
    if (!o.test) return o.billGo(url, body, el);
    const later = (n) => fmtDate(new Date(Date.parse(T.endsAt) + n * 864e5).toISOString().slice(0, 10));
    doneMsg = url === 'support' ? `A “${body.subject}” request would be sent to Messages → Contact requests, and they’d see “Thanks! We’ll email you within one business day.”`
      : /retain/.test(url) ? { extend: `The trial would get ${R.extendDays} more days and end on ${T ? later(R.extendDays) : ''}.`, stay: `${S.pct}% off ${bills(T ? 'their first' : 'their next')} would be applied in Stripe.`, gift: `${S.g}% off their ${T ? 'first' : 'next'} bill would be applied in Stripe.` }[body.offer]
      : `The ${T ? 'free trial' : 'subscription'} would be cancelled. Everything keeps working until ${fmtDate(endsOn)}, then the account is paused.${C.password.on ? ' In a real run, the owner’s password is checked first.' : ''}`;
    step = 'done'; draw();
  };
  const V = {
    done: () => `<div class="ms-top"><span class="ms-hi">${msI('check', 22)}</span>${xBtn}</div>
<h2 class="ms-h">Test finished</h2><p class="ms-sub">${esc(doneMsg)} Nothing was changed.</p>
${ctx.reason ? `<p class="ms-lbl">Reason picked</p>${rows([['msg', esc(ctx.reason.title)]])}` : ''}${ctx.feedback.trim() ? `<p class="ms-lbl">Feedback</p>${rows([['file', esc(ctx.feedback.trim())]])}` : ''}
<p class="ms-lbl">Steps shown</p>${rows(trail.map((k, i) => [i === trail.length - 1 ? 'check' : 'next', `${i + 1}. ${NAMES[k]}`]))}
<button type="button" class="btn ms-cta" data-ms="restart">Run it again</button><button type="button" class="ms-skip" data-ms="close">Close</button>`,
    menu: () => `<div class="ms-top"><span class="ms-hi">${msI('card', 22)}</span>${xBtn}</div>
<h2 class="ms-h">Modify subscription for ${esc(company.name || 'your business')}</h2><p class="ms-sub">Choose how you’d like to update your subscription.</p>
${up ? `<div class="ms-opt ms-up${B.prepaidUntil ? ' dis' : ''}"><span class="ms-oi">${msI('rocket')}</span><span class="ms-ot"><strong>Upgrade to ${esc(up.name)}</strong><b class="ms-price">${amt(priceOf(up))} / ${up[per] ? per : up.month ? 'month' : 'year'}</b>${B.prepaidUntil ? `<small>Prepaid until ${fmtDate(B.prepaidUntil)}</small>` : ''}</span>${B.prepaidUntil ? '' : '<button type="button" class="btn" data-ms="plans">Upgrade</button>'}</div>`
    : `<div class="ms-opt ms-up dis"><span class="ms-oi">${msI('rocket')}</span><span class="ms-ot"><strong>Upgrade your current plan</strong><small>You’re already on the top plan</small></span></div>`}
${T && !T.prepaid && C.extend.on && !R.extended ? opt('', 'hourglass', 'Trial extension', R.canExtend ? `Get ${R.extendDays} more days to try everything` : `You can extend your trial from ${fmtDate(R.extendFrom)}`, 'extend', !R.canExtend) : ''}
${more ? opt('warn', 'down', 'Downgrade plan', B.prepaidUntil ? `Prepaid until ${fmtDate(B.prepaidUntil)}` : down ? 'Move to a smaller plan' : 'You are already on the lowest plan', 'plans', !down || !!B.prepaidUntil)
    + opt('bad', 'x', 'Cancel plan', canCancel ? `I still want to cancel my ${T ? 'free trial' : 'subscription'}` : ending ? 'Your subscription is already cancelled' : T && T.cancelled ? 'Your trial is already cancelled' : T && T.prepaid ? `Prepaid until ${fmtDate(T.endsAt)}. Contact us to close the account.` : 'There’s no subscription to cancel', 'reasons', !canCancel) : ''}
<button type="button" class="ms-more" data-ms="more" aria-expanded="${more}">${more ? 'Collapse' : 'Show more'} <span class="${more ? 'flip' : ''}">${msI('chev', 16)}</span></button>`,
    reasons: () => `<div class="ms-top"><h2 class="ms-h">${first ? `${first}, we’re` : 'We’re'} sorry we haven’t hit the mark yet.</h2>${xBtn}</div>
<p class="ms-sub">We know it’s frustrating when things don’t work as planned. Before you go, tell us what’s standing in your way and let us help fix it.</p>
<div class="ms-list">${C.reasons.map((r, i) => opt('', REASON_ICONS[i % REASON_ICONS.length], esc(r.title), esc(r.text || ''), 'why:' + r.id)).join('')}</div>
<p class="ms-note">${msI('shield', 16)} ${T ? `Your trial ends on ${fmtDate(T.endsAt)}.${B.card ? ' You won’t be charged before then.' : ' Nothing is charged without a card on file.'}` : sub ? `Your next bill is on ${fmtDate(sub.periodEnd)}.` : ''}</p>
<button type="button" class="ms-stay" data-ms="close">${T ? 'Stay on my trial and keep building, no changes made' : 'Keep my subscription, no changes made'}</button>`,
    sprint: () => `${head()}${banner('info', 'cap', 'Let’s get you up and running in 5 days.', 'Not sure it’s for you yet? Follow this short plan with our help and see real results before you decide.')}
<p class="ms-lbl">What we’ll set up together</p>${rows([['list', 'Add your services and price list.', 'So quotes and invoices fill themselves in.'], ['file', 'Send your first quote.', 'Clients approve it online and you can take a deposit.'],
    ['calendar', 'Schedule jobs for you and your team.', 'Everyone sees their day on their phone.'], ['dollar', 'Get paid online.', 'Turn on card payments so invoices get paid faster.'], ['zap', 'Follow up automatically.', 'Reminders for quotes, visits and overdue invoices.']], 'tint')}
<div class="ms-stat">${msI('trend', 18)} We’ll email you within one business day to get started.</div>${cta('Start my 5-day setup plan', 'doSprint', 'I don’t need help setting up')}`,
    tour: () => `${head()}${banner('info', 'video', 'Get a personal tour of what matters to you.', 'Not sure where to start? We’ll connect you with a specialist who can show you the features that fit your business in a quick call.')}
<p class="ms-lbl">What’s included</p>${rows([['check', 'A walkthrough of the app, set up for your business.'], ['check', 'Live Q&amp;A: ask anything.'], ['check', 'Features you might have missed.'], ['gift', 'Help picking the plan that fits your business.']])}
${cta('Talk to a specialist 1-on-1', 'doTour', 'I don’t need a tour')}`,
    extend: () => `${head()}${banner('info', 'hourglass', `Take ${R.extendDays} more days to decide.`, `Your trial ends on ${fmtDate(T.endsAt)}. Extend it once and keep using everything, free, until ${fmtDate(new Date(Date.parse(T.endsAt) + R.extendDays * 864e5).toISOString().slice(0, 10))}.`)}
<p class="ms-lbl">How it works</p>${rows([['cal', `${R.extendDays} more days added to your trial right away.`], ['card', 'Nothing is charged for the extra days.'], ['spark', 'Keep building with every feature of your plan.']])}
${cta(`Extend my trial by ${R.extendDays} days`, 'doExtend', 'I don’t need more time')}`,
    stay: () => `${head()}${banner('info', 'percent', S.n > 1 ? `Let us invest in your ${T ? 'first' : 'next'} ${S.n} months.` : 'Let us take some of the cost.', `Results take time, so we’ll split the cost. Take ${S.pct}% off your ${bills(T ? 'first' : 'next')} so you can focus on growing, not overhead.`, `<span class="ms-pill">${msI('tag', 14)} ${amt(Math.round(cur * (100 - S.pct)) / 100)}/${short} instead of ${amt(cur)}</span>`)}
<p class="ms-lbl">How it works</p>${rows([['percent', `<strong>${S.pct}% off</strong> your ${bills(T ? 'first' : 'next')}, applied automatically.`], ['card', 'No coupon code needed: the discount shows on your bill.'], ['spark', 'Stay and save while you grow your business.']])}
${cta(`Keep my ${S.pct}% discount`, 'doStay', 'I don’t want a discount')}`,
    lose: () => {
      const L = [`Your ${plural(U.clients || 0, 'client')} and their history.`, `${plural(U.quotes || 0, 'quote')}, ${plural(U.jobs || 0, 'job')} and ${plural(U.invoices || 0, 'invoice')}.`, 'Your schedule and calendar.', `Team logins (${U.logins || 1}): nobody can log in.`,
        'Client portal: clients can’t open their quotes or invoices, or pay online.', 'Automations, reminders and follow-ups stop.', 'Review requests and social posts stop.', 'Your business page and online requests.'];
      return `${head()}${banner('bad', 'alert', 'You’ll lose access to everything you’ve built.', `When your ${T ? 'trial' : 'plan'} ends on ${fmtDate(endsOn)}, the account is paused: you and your team can’t log in, and clients can’t open their quotes, invoices or portal. Your data is kept, so you can come back by choosing a plan.`)}
<div class="ms-lose">${L.map((l, i) => `<div class="ms-li${i >= 4 ? ' extra' : ''}">${msI('x', 16)} <span>${esc(l)}</span></div>`).join('')}<button type="button" class="ms-more sm" data-ms="loseMore">View (${L.length - 4} more) <span>${msI('chev', 14)}</span></button></div>
<button type="button" class="btn ms-cta" data-ms="close">Return to my account ${msI('undo', 16)}</button><button type="button" class="ms-skip" data-ms="next">I am sure I want to cancel</button>`;
    },
    feedback: () => `${head()}${banner('soft', 'msg', 'We value your voice.', `Before you go, could you tell us one thing we could have done better? Your feedback helps us build a better ${esc(B.productName || 'app')} for businesses like yours.`)}
<textarea class="ms-ta" id="msFb" rows="7" maxlength="500" placeholder="Tell us what we could improve...">${esc(ctx.feedback)}</textarea>
<button type="button" class="btn ms-cta" data-ms="fbGo" id="msFbGo" ${ctx.feedback.trim() || !C.feedback.required ? '' : 'disabled'}>Submit feedback</button>${C.feedback.required ? '' : '<button type="button" class="ms-skip" data-ms="next">Skip</button>'}`,
    gift: () => `${head()}${banner('info', 'tag', `${C.feedback.on ? 'Thank you for the feedback. ' : ''}Here’s a parting gift before you go.`, `We’d like to offer you ${S.g}% off your ${T ? 'first' : 'next'} bill, so you can stay without the full cost.`, `<span class="ms-pill">${msI('tag', 14)} ${S.g}% off ${T ? 'first' : 'next'} bill</span>`)}
<div class="ms-inv"><div class="ms-lbl" style="margin:0 0 10px">Upcoming bill preview</div><s class="muted">${amt(cur)}/${short}</s><div class="ms-big"><span><b>${amt(Math.round(cur * (100 - S.g)) / 100)}</b> /${short}</span><span class="ms-save">Save ${amt(cur - Math.round(cur * (100 - S.g)) / 100)}</span></div>
<div class="ms-ok"><i></i> Applied as soon as you claim it, no code needed</div></div>
<p class="ms-lbl">How it works</p>${rows([['cal', `${S.g}% off your ${T ? 'first bill, when your trial ends' : 'next bill'}, applied automatically.`], ['card', 'No coupon code needed: the discount shows on your bill.'], ['spark', 'Stay and save while you grow your business.']])}
${cta(`Claim ${S.g}% off &amp; stay`, 'doGift', 'No thanks, continue with cancellation')}`,
    confirm: () => `${head()}${banner('bad', 'alert', 'Confirm cancellation.', C.password.on ? 'Enter your password to confirm cancellation.' : `Everything keeps working until your ${T ? 'trial' : 'subscription'} ends, and you can change your mind any time before then.`)}
<div class="ms-warn">${msI('circleAlert', 18)} <span>Your ${T ? 'trial' : 'subscription'} ends on ${fmtDate(endsOn)}. After that, the account is paused${U.logins > 1 ? ' and your team can’t log in' : ''}.</span></div>
<form id="msPw">${C.password.on ? `<label class="ms-pwl">Password<span class="ms-pw"><input type="password" name="password" required autocomplete="current-password"><button type="button" data-ms="eye" aria-label="Show password">${msI('eye', 18)}</button></span></label>` : ''}
<p class="ms-tos">By confirming, you agree to our <a href="/terms" target="_blank" rel="noopener">terms of service</a>.</p>
<button class="btn danger ms-cta">Confirm cancellation</button></form>`,
  };
  const draw = () => {
    if (step !== 'done' && trail[trail.length - 1] !== step) trail.push(step);
    mb.innerHTML = V[step](); box.scrollIntoView({ block: 'start' });
    if (step === 'gift') log({ gift: true });
    if (step === 'feedback') { const ta = $('#msFb', mb); ta.focus(); ta.addEventListener('input', () => { ctx.feedback = ta.value; $('#msFbGo', mb).disabled = C.feedback.required && !ta.value.trim(); }); }
    if (step === 'confirm') {
      const f = $('#msPw', mb); if (f.password) f.password.focus();
      f.addEventListener('submit', (e) => { e.preventDefault(); finish('/api/account/billing/cancel', { flowId: fid, password: f.password ? f.password.value : '', reason: [ctx.reason && ctx.reason.title, ctx.feedback.trim()].filter(Boolean).join(' — ') }, $('.btn.danger', f)); });
    }
  };
  mb.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ms]'); if (!b) return; const a = b.dataset.ms;
    if (a === 'close') close();
    else if (a === 'restart') { step = start; hist.length = 0; trail.length = 0; ctx.reason = null; ctx.feedback = ''; more = false; draw(); }
    else if (a === 'back') back(); else if (a === 'more') { more = !more; draw(); } else if (a === 'plans') o.plans();
    else if (a.startsWith('why:')) { ctx.reason = C.reasons.find((r) => r.id === a.slice(4)); const o = offerFor(ctx.reason); logged = true; log({ reason: ctx.reason.id, offer: o || 'none' }); go(o || seq[0]); }
    else if (a === 'next') go(nextAfter(step));
    else if (a === 'loseMore') { const el = b.parentElement; const open = el.classList.toggle('open'); b.innerHTML = `${open ? 'View less' : `View (${$$('.extra', el).length} more)`} <span class="${open ? 'flip' : ''}">${msI('chev', 14)}</span>`; }
    else if (a === 'fbGo') { if (logged && ctx.feedback.trim()) log({ feedback: ctx.feedback.trim() }); go(nextAfter('feedback')); }
    else if (a === 'eye') { const i = b.previousElementSibling; const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.innerHTML = msI(show ? 'eyeOff' : 'eye', 18); b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); }
    else if (a === 'doExtend') finish('/api/account/billing/retain', { offer: 'extend', flowId: fid }, b);
    else if (a === 'doStay') finish('/api/account/billing/retain', { offer: 'stay', flowId: fid }, b);
    else if (a === 'doGift') finish('/api/account/billing/retain', { offer: 'gift', flowId: fid }, b);
    else if (a === 'doSprint') ask(b, '5-day setup plan', `${me.name} asked for the 5-day setup plan instead of cancelling${T ? ' their free trial' : ''}.`, 'sprint');
    else if (a === 'doTour') ask(b, 'Specialist tour', `${me.name} asked for a 1-on-1 tour with a specialist instead of cancelling${T ? ' their free trial' : ''}. Reason given: ${(ctx.reason && ctx.reason.title) || 'none'}`, 'tour');
    else go(a); // 'reasons', 'extend' (from the menu)
  });
  draw();
};
})();
