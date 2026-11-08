// Alpha → Pricing → Creator partners and Creator program (lib/partners.js). Loaded after platform.js and uses its helpers
// (A, api, modal, closeModal, toast, esc, $, $$, fmtDate, promoView, load, render).
let CR = null; // the program, the creators (applications too), their sign-ups and payouts
const crApps = () => (CR ? CR.creators.filter((c) => c.status === 'applied').length : 0);
const crUsd = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const CR_STATUS = { applied: ['Applied', 'q-sent'], active: ['Active', 'active'], paused: ['Paused', ''], declined: ['Declined', 'q-declined'] };
const CR_REF = { 'signed up': ['Signed up', 'q-sent'], paying: ['Paying', 'active'], stopped: ['Stopped paying', 'q-declined'], closed: ['Closed', ''] };
const crRedraw = () => promoView($('#main'));
const crSet = (r) => { CR = r; crRedraw(); return r; };
// a code suggestion from their name: MIKE20 for Mike Jones with a 20% offer
const crSuggest = (c) => { const o = CR.program.offer; const base = String(c.name || '').split(/\s+/)[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20) || 'CREATOR';
  return base + (o.type === 'percent' ? o.value : o.type === 'trial' ? o.trialDays : ''); };

function creatorsTab(box) {
  if (!CR) { box.innerHTML = '<p class="muted">Loading…</p>'; api('GET', '/api/platform/partners').then(crSet).catch((x) => toast(x.message, true)); return; }
  (promoTab === 'crprogram' ? creatorProgramView : creatorsView)(box);
}

function creatorsView(box) {
  const apps = CR.creators.filter((c) => c.status === 'applied'); const rest = CR.creators.filter((c) => c.status === 'active' || c.status === 'paused');
  const declined = CR.creators.filter((c) => c.status === 'declined'); const owed = rest.reduce((s, c) => s + Math.max(0, c.totals.owed), 0);
  box.innerHTML = `${CR.program.enabled ? '' : '<div class="card" style="max-width:960px;border-left:4px solid var(--warn,#d97706)"><strong>The creator program is off.</strong> <span class="muted">The /partners page goes to the home page and creator links don’t count sign-ups. Set your commission and turn it on in Creator program.</span> <button type="button" class="btn sm" data-act="pricingTab" data-k="crprogram" style="margin-left:6px">Set it up</button></div>'}
<div class="promo-bar"><p class="muted">Trade creators who send you businesses for a cash commission: ${esc(CR.programTerms)}. You pay them yourself and record it here.</p><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn alt" data-act="crCopyPage">Copy page link</button><button class="btn" data-act="crAdd">Add creator</button></span></div>
${owed > 0 ? `<div class="card" style="max-width:960px"><strong>${crUsd(owed)} to pay</strong> <span class="muted">across ${rest.filter((c) => c.totals.owed > 0).length} creator${rest.filter((c) => c.totals.owed > 0).length === 1 ? '' : 's'}: confirmed commission minus what you’ve recorded as paid. Open a creator to record a payout.</span></div>` : ''}
${apps.length ? `<div class="card" style="max-width:960px"><h2>Applications (${apps.length})</h2><div class="tablewrap"><table class="acc"><thead><tr><th>Creator</th><th>Channel</th><th>Trade</th><th>Applied</th><th></th></tr></thead><tbody>
${apps.map((c) => `<tr><td class="nm">${esc(c.name)}<div class="sm">${esc(c.email)}</div></td><td>${c.channel ? `<a href="${esc(c.channel)}" target="_blank" rel="noopener noreferrer">${esc(c.network || 'Open')}</a>` : esc(c.network || '—')}<div class="sm">${esc(c.audience || '')}${c.handle ? ` · ${esc(c.handle)}` : ''}</div></td>
<td>${esc(c.trade || '—')}<div class="sm">${c.runsBusiness === 'no' ? 'Doesn’t run a trade business' : c.runsBusiness === 'yes' ? 'Runs a trade business' : ''}</div></td><td class="sm">${fmtDate(c.appliedAt)}</td>
<td><div class="acts"><button type="button" class="btn alt sm" data-act="crOpen" data-id="${c.id}">View</button><button type="button" class="btn sm" data-act="crApprove" data-id="${c.id}">Approve</button></div></td></tr>`).join('')}</tbody></table></div></div>` : ''}
<div class="card" style="max-width:960px"><h2>Creators</h2>${rest.length ? `<div class="tablewrap"><table class="acc"><thead><tr><th>Creator</th><th>Visits</th><th>Sign-ups</th><th>Paying</th><th>Earned</th><th>To pay</th><th>Status</th></tr></thead><tbody>
${rest.map((c) => `<tr class="click" data-act="crOpen" data-id="${c.id}" style="cursor:pointer"><td class="nm">${esc(c.name)}<div class="sm disc-code">${esc(c.code || '')}</div></td><td>${c.totals.clicks}<div class="sm">${c.totals.clicksMonth} this month</div></td><td>${c.totals.signups}</td><td>${c.totals.paying}</td>
<td>${crUsd(c.totals.earned)}${c.totals.pending ? `<div class="sm">+${crUsd(c.totals.pending)} on hold</div>` : ''}</td><td><strong>${crUsd(c.totals.owed)}</strong></td><td><span class="cstatus ${CR_STATUS[c.status][1]}">${CR_STATUS[c.status][0]}</span></td></tr>`).join('')}</tbody></table></div>`
    : `<p class="muted">No creators yet. Approve an application, or add someone you’ve already talked to with Add creator.</p>`}</div>
${declined.length ? `<details class="card" style="max-width:960px"><summary><strong>Declined (${declined.length})</strong></summary><div class="tablewrap"><table class="acc"><tbody>${declined.map((c) => `<tr><td class="nm">${esc(c.name)}<div class="sm">${esc(c.email)}</div></td><td class="sm">${esc(c.network || '')} ${esc(c.audience || '')}</td><td><div class="acts"><button type="button" class="btn alt sm" data-act="crOpen" data-id="${c.id}">View</button></div></td></tr>`).join('')}</tbody></table></div></details>` : ''}`;
}
A.crCopyPage = () => { const u = `${location.origin}/partners`; navigator.clipboard.writeText(u).then(() => toast('Link to the creator page copied'), () => toast(u)); };
A.crCopy = (d) => navigator.clipboard.writeText(d.text).then(() => toast(d.msg || 'Copied'), () => toast(d.text));

// the creator's details, link, sign-ups and payouts
A.crOpen = (d) => {
  const c = CR.creators.find((x) => x.id === d.id); if (!c) return; const T = c.totals; const own = !!c.terms;
  const field = (k, l, ph = '', max = 200) => `<label>${l}<input name="${k}" value="${esc(c[k] || '')}" maxlength="${max}" placeholder="${esc(ph)}"></label>`;
  const m = modal(c.name, `${c.status === 'active' || c.status === 'paused' ? `<div class="row" style="margin-bottom:6px">
<label>Their link<span style="display:flex;gap:6px"><input readonly value="${esc(c.link)}"><button type="button" class="btn alt sm" data-act="copy">Copy</button></span></label>
<label>Their stats page (private)<span style="display:flex;gap:6px"><input readonly value="${esc(c.stats)}"><button type="button" class="btn alt sm" data-act="copy">Copy</button></span></label></div>
<p class="muted" style="font-size:13px;margin:0 0 10px">Code <strong>${esc(c.code)}</strong>${c.offer ? `: ${esc(c.offer)}` : ''}. Earns ${esc(c.termsText)}. ${T.clicks} visits · ${T.signups} sign-ups · ${T.paying} paying · ${crUsd(T.earned)} confirmed · ${crUsd(T.pending)} on hold · ${crUsd(T.paid)} paid · <strong>${crUsd(T.owed)} to pay</strong></p>
<p style="margin:0 0 12px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn alt sm" data-act="crWelcome" data-id="${c.id}">Copy welcome message</button><button type="button" class="btn alt sm" data-act="crStatus" data-id="${c.id}" data-s="${c.status === 'active' ? 'paused' : 'active'}">${c.status === 'active' ? 'Pause (pauses their code too)' : 'Resume'}</button></p>`
    : c.status === 'applied' ? `<p style="margin:0 0 12px;display:flex;gap:8px"><button type="button" class="btn sm" data-act="crApprove" data-id="${c.id}">Approve</button><button type="button" class="btn alt sm" data-act="crStatus" data-id="${c.id}" data-s="declined">Decline</button></p>`
    : `<p style="margin:0 0 12px"><button type="button" class="btn alt sm" data-act="crStatus" data-id="${c.id}" data-s="applied">Move back to applications</button></p>`}
<form id="crf">${c.message ? `<p class="muted" style="white-space:pre-wrap;font-size:13px;border-left:3px solid var(--line);padding-left:10px">${esc(c.message)}</p>` : ''}
<div class="row">${field('name', 'Name', '', 100)}${field('email', 'Email')}</div>
<div class="row">${field('channel', 'Main channel', 'https://…', 300)}${field('handle', 'Other profiles')}</div>
<div class="row">${field('network', 'Network', 'e.g. TikTok', 40)}${field('audience', 'Audience', 'e.g. 10,000–50,000', 40)}${field('trade', 'Trade', '', 100)}</div>
<div class="row">${field('payTo', 'Pay them by', 'e.g. PayPal: mike@example.com')}${c.code ? field('code', 'Code', '', 30) : ''}</div>
<label class="switchline"><input type="checkbox" name="ownTerms" ${own ? 'checked' : ''}> Their own commission instead of the program’s (${esc(CR.programTerms)})</label>
<div class="row" id="crTerms" ${own ? '' : 'hidden'}><label>Flat per paying business ($)<input name="flat" type="number" min="0" step="0.01" value="${esc(own ? c.terms.flat : CR.program.flat)}"></label><label>Percent of each month (%)<input name="percent" type="number" min="0" max="100" step="0.01" value="${esc(own ? c.terms.percent : CR.program.percent)}"></label><label>For how many months<input name="months" type="number" min="0" max="36" value="${esc(own ? c.terms.months : CR.program.months)}"></label></div>
<p class="muted" style="font-size:12px;margin:-4px 0 8px">A change applies to new sign-ups. Businesses that already signed up keep the terms they came with.</p>
<label>Notes for you<textarea name="notes" rows="2" maxlength="2000">${esc(c.notes || '')}</textarea></label>
<div class="foot"><button type="button" class="btn danger" data-act="crDelete" data-id="${c.id}" style="margin-right:auto">Delete</button><button type="button" class="btn alt" data-act="closeModal">Close</button><button class="btn">Save</button></div></form>
${c.referrals.length ? `<h3 class="hc-h3">Sign-ups (${c.referrals.length})</h3><div class="tablewrap" style="max-height:220px;overflow:auto"><table class="acc">${c.referrals.map((r) => `<tr><td class="nm">${esc(r.business)}<div class="sm">${esc(r.email)} · ${r.via === 'code' ? 'used the code' : 'from the link'}</div></td><td class="sm">${fmtDate(r.signedUpAt)}</td><td><span class="cstatus ${CR_REF[r.status][1]}">${CR_REF[r.status][0]}</span>${r.firstPaidAt ? `<div class="sm">Paying since ${fmtDate(r.firstPaidAt)}</div>` : ''}</td><td class="r">${crUsd(r.earned)}</td></tr>`).join('')}</table></div>` : ''}
${c.status !== 'applied' && c.status !== 'declined' ? `<h3 class="hc-h3">Payouts</h3>${c.payouts.length ? `<div class="tablewrap" style="max-height:180px;overflow:auto"><table class="acc">${c.payouts.map((x) => `<tr><td>${fmtDate(x.at)}</td><td><strong>${crUsd(x.amount)}</strong></td><td class="sm">${esc(x.method || '')}${x.note ? ` · ${esc(x.note)}` : ''}</td><td class="r" style="width:1%"><button type="button" class="icon-x" data-act="crRmPayout" data-id="${c.id}" data-x="${x.id}" title="Remove this payout" aria-label="Remove this payout">×</button></td></tr>`).join('')}</table></div>` : '<p class="muted" style="font-size:13px">Nothing paid yet.</p>'}
<form id="crpay" class="row" style="align-items:end"><label>Amount ($)<input name="amount" type="number" min="0.01" step="0.01" value="${T.owed > 0 ? T.owed : ''}" required></label><label>Date<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label><label>Paid by<input name="method" maxlength="60" placeholder="PayPal, Venmo, bank" value="${esc(c.payTo ? c.payTo.split(':')[0] : '')}"></label><button class="btn alt">Record payout</button></form>` : ''}`, { wide: true });
  const f = $('#crf', m); m.crId = c.id;
  f.ownTerms.addEventListener('change', () => { $('#crTerms', f).hidden = !f.ownTerms.checked; });
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(f));
    b.terms = f.ownTerms.checked ? { flat: b.flat, percent: b.percent, months: b.months } : null; delete b.flat; delete b.percent; delete b.months; delete b.ownTerms;
    try { crSet(await api('PUT', `/api/platform/partners/${c.id}`, b)); await load(); toast('Saved'); A.crOpen({ id: c.id }); } catch (x) { toast(x.message, true); }
  });
  const pay = $('#crpay', m);
  if (pay) pay.addEventListener('submit', async (e) => { e.preventDefault(); try { crSet(await api('POST', `/api/platform/partners/${c.id}/payouts`, Object.fromEntries(new FormData(pay)))); toast('Payout recorded'); A.crOpen({ id: c.id }); } catch (x) { toast(x.message, true); } });
};
A.crWelcome = async (d) => { const r = await api('GET', `/api/platform/partners/${d.id}/welcome`); await navigator.clipboard.writeText(r.welcome).then(() => toast('Welcome message copied: paste it into an email or DM'), () => toast('Couldn’t copy', true)); };
A.crStatus = async (d) => { crSet(await api('PUT', `/api/platform/partners/${d.id}`, { status: d.s })); await load(); toast({ paused: 'Paused, and their code too', active: 'Active again', declined: 'Declined', applied: 'Back in applications' }[d.s]); if ($('#ov')) A.crOpen({ id: d.id }); };
A.crDelete = async (d) => { if (!confirm('Delete this creator? This can’t be undone.')) return; crSet(await api('DELETE', `/api/platform/partners/${d.id}`)); closeModal(); toast('Deleted'); };
A.crRmPayout = async (d) => { if (!confirm('Remove this payout from the record?')) return; crSet(await api('DELETE', `/api/platform/partners/${d.id}/payouts/${d.x}`)); toast('Payout removed'); A.crOpen({ id: d.id }); };

// approve: their code (a new discount code with the program's follower offer, or one you already made), and the welcome email
A.crApprove = (d) => {
  const c = CR.creators.find((x) => x.id === d.id);
  const m = modal(`Approve ${c.name}`, `<form id="cra"><label>Their code<input name="code" value="${esc(c.code || crSuggest(c))}" required maxlength="30" autocapitalize="characters" spellcheck="false" style="text-transform:uppercase"></label>
<p class="muted" style="font-size:13px;margin:-4px 0 10px">A new discount code with the followers’ offer (${esc(CR.offer)}), once per email. If a discount code with this name already exists, it’s used as it is. Their link becomes ${esc(location.origin)}/go/<span id="craSlug">${esc((c.code || crSuggest(c)).toLowerCase())}</span>.</p>
<label class="switchline"><input type="checkbox" name="email" ${c.email ? 'checked' : 'disabled'}> Email them their link, code, stats page and the rules${c.email ? ` (${esc(c.email)})` : ' (add an email first)'}</label>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Approve</button></div></form>`);
  const f = $('#cra', m); f.code.addEventListener('input', () => { $('#craSlug', f).textContent = f.code.value.trim().toLowerCase(); });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const r = await api('POST', `/api/platform/partners/${c.id}/approve`, { code: f.code.value, email: f.email.checked }); CR = r; await load(); closeModal(); crRedraw();
      toast(f.email.checked ? (r.emailed ? `${c.name} approved and emailed` : `${c.name} approved, but the email didn’t send. Use Copy welcome message.`) : `${c.name} approved`, f.email.checked && !r.emailed);
    } catch (x) { toast(x.message, true); }
  });
};
A.crAdd = () => {
  const m = modal('Add a creator', `<form id="crn"><div class="row"><label>Name<input name="name" required maxlength="100"></label><label>Email<input name="email" type="email" maxlength="200"></label></div>
<div class="row"><label>Main channel<input name="channel" maxlength="300" placeholder="https://…"></label><label>Network<input name="network" maxlength="40" placeholder="e.g. TikTok"></label></div>
<label>Their code<input name="code" required maxlength="30" autocapitalize="characters" spellcheck="false" style="text-transform:uppercase" placeholder="e.g. MIKE20"></label>
<p class="muted" style="font-size:13px;margin:-4px 0 10px">Gets the followers’ offer (${esc(CR.offer)}). Copy their welcome message from their page once they’re added.</p>
<div class="foot"><button type="button" class="btn alt" data-act="closeModal">Cancel</button><button class="btn">Add creator</button></div></form>`);
  const f = $('#crn', m); f.name.addEventListener('input', () => { if (!f.code.dataset.typed) f.code.value = crSuggest({ name: f.name.value }); }); f.code.addEventListener('input', () => { f.code.dataset.typed = '1'; });
  f.addEventListener('submit', async (e) => { e.preventDefault(); try { crSet(await api('POST', '/api/platform/partners', Object.fromEntries(new FormData(f)))); await load(); closeModal(); crRedraw(); toast(`${f.name.value} added`); } catch (x) { toast(x.message, true); } });
};

// the program: commission, the hold, how long a link is remembered, and the followers' offer for new creators
function creatorProgramView(box) {
  const p = CR.program; const o = p.offer;
  box.innerHTML = `<form class="card" id="crpf" style="max-width:760px">
<label class="switchline"><input type="checkbox" name="enabled" ${p.enabled ? 'checked' : ''}> <span><strong>Creator program on.</strong> The /partners page takes applications, creator links count sign-ups, and the page is in the sitemap.</span></label>
<h2 style="margin-top:18px">Commission</h2><p class="muted" style="font-size:13px;margin-top:0">What a creator earns for each business they send. Use one or both. Each creator can have their own terms instead.</p>
<div class="row"><label>Flat amount when a business starts paying ($)<input name="flat" type="number" min="0" max="5000" step="0.01" value="${esc(p.flat)}"></label><label>Percent of what it pays each month (%)<input name="percent" type="number" min="0" max="100" step="0.01" value="${esc(p.percent)}"></label><label>For its first … months<input name="months" type="number" min="0" max="36" value="${esc(p.months)}"></label></div>
<div class="row"><label>Hold before it’s confirmed (days)<input name="holdDays" type="number" min="0" max="120" value="${esc(p.holdDays)}"></label><label>Remember a creator’s link for (days)<input name="cookieDays" type="number" min="1" max="365" value="${esc(p.cookieDays)}"></label></div>
<p class="muted" style="font-size:12px;margin:-4px 0 8px">If a business stops paying during the hold, that amount is voided. Monthly commission uses the plan price after the business’s discount.</p>
<h2 style="margin-top:18px">Followers’ offer</h2><p class="muted" style="font-size:13px;margin-top:0">The discount code each newly approved creator gets. Codes already given out keep their terms (change them in Discount codes).</p>
<div class="row"><label>Type<select name="type"><option value="percent" ${o.type === 'percent' ? 'selected' : ''}>Percentage off</option><option value="amount" ${o.type === 'amount' ? 'selected' : ''}>Dollar amount off</option><option value="trial" ${o.type === 'trial' ? 'selected' : ''}>Free trial, no card</option></select></label>
<label data-off>Amount<input name="value" type="number" min="0" step="0.01" value="${esc(o.value)}"></label>
<label data-off>How long<select name="duration"><option value="once" ${o.duration === 'once' ? 'selected' : ''}>The first payment</option><option value="repeating" ${o.duration === 'repeating' ? 'selected' : ''}>A number of months</option><option value="forever" ${o.duration === 'forever' ? 'selected' : ''}>Every payment</option></select></label>
<label data-off data-rep>Months<input name="offerMonths" type="number" min="1" max="36" value="${esc(o.months || 3)}"></label>
<label data-trial>Trial days<input name="trialDays" type="number" min="1" max="90" value="${esc(o.trialDays || 60)}"></label></div>
<p class="muted" style="font-size:12px;margin:-4px 0 8px">Remember your price lock: an “every payment” discount is for good.</p>
<h2 style="margin-top:18px">The page</h2>
<label>Line under the headline on /partners<input name="pitch" maxlength="300" value="${esc(p.pitch)}"></label>
<div class="savebar"><span class="muted">${p.enabled ? `Live at <a href="/partners" target="_blank" rel="noopener">${esc(location.origin)}/partners</a>` : 'Off: /partners goes to the home page.'}</span><button class="btn">Save creator program</button></div></form>`;
  const f = $('#crpf', box);
  const sync = () => { const trial = f.type.value === 'trial'; $$('[data-off]', f).forEach((el) => { el.hidden = trial; }); $$('[data-trial]', f).forEach((el) => { el.hidden = !trial; }); if (!trial) $('[data-rep]', f).hidden = f.duration.value !== 'repeating'; };
  f.type.addEventListener('change', sync); f.duration.addEventListener('change', sync); sync();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(f));
    const body = { enabled: f.enabled.checked, flat: b.flat, percent: b.percent, months: b.months, holdDays: b.holdDays, cookieDays: b.cookieDays, pitch: b.pitch, offer: { type: b.type, value: b.value, duration: b.duration, months: b.offerMonths, trialDays: b.trialDays } };
    try { crSet(await api('PUT', '/api/platform/partners/program', body)); toast(CR.program.enabled ? 'Creator program saved and on' : 'Creator program saved (off)'); } catch (x) { toast(x.message, true); }
  });
}
