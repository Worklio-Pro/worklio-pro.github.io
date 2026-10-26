'use strict';
/* ===== app tour: a short spotlight walk through the menu and top bar =====
   Starts by itself once for new logins (me.tourNew, from /api/auth/me) and any time from Help → Take a tour.
   Each step points at the first of its targets that's on screen (sidebar on computers, bottom tabs on phones);
   a step with no target on screen (hidden by the login's role, the plan or the screen size) is left out. */
const tourLink = (p) => [`#side .side-nav a[href="${p}"]`, `#bnav a[href="${p}"]`];
const TOUR_STEPS = [
  { title: () => `Welcome to ${(company.account && company.account.productName) || 'Worklio Pro'}`, text: 'A one-minute look around: where things are, and how work moves from a quote to getting paid. Use the arrow keys or the buttons to move along.' },
  { at: ['#side .side-nav', '#bnav', '#menuBtn'], title: 'Your menu', text: 'Every page lives here, grouped into Operations, Money, Marketing and Records.', alt: 'Your most-used pages are along the bottom. Tap More for the full menu: Operations, Money, Marketing and Records.' },
  { at: tourLink('/business-overview'), title: 'Home', text: 'Your day at a glance: what’s scheduled, what’s waiting on clients and the money coming in.' },
  { at: tourLink('/calendar'), title: 'Calendar', text: 'Schedule jobs, tasks and events, and see who on your team is working when. Click a time to add something.' },
  { at: tourLink('/clients'), title: 'Clients', text: 'Everyone you work for, with their contact details and every quote, job and invoice for them.' },
  { at: tourLink('/quotes'), title: 'Quotes → Jobs → Invoices', text: 'How the work flows: send a quote, your client approves it online, it becomes a scheduled job, and you invoice when it’s done.' },
  { at: tourLink('/payments'), title: 'Money', text: 'Payments, expenses and reports show what came in, what went out and what you made.' },
  { at: ['.tb-search'], title: 'Search', text: 'Type what you’re after, like “new invoice” or “sales tax”, to jump straight there. Press / from any page.' },
  { at: ['#topbar [data-act=openHelp]'], title: 'Help', text: 'Short how-to guides, the Help Center and a way to message support. You can take this tour again from here.' },
  { at: ['#topbar .tb-gear'], title: 'Settings', text: 'Your company profile, team, email templates, payments and plan.' },
  { at: ['#topbar .tb-forum', '#topbar [data-act=feedbackForm]'], title: 'Tell us what to improve', text: 'Suggest features and report issues in the Forum, where other businesses can vote on them, or send us private feedback.', alt: 'Tell us what’s working and what isn’t. Every message is read by the people who build the app.' },
  { at: ['#side .side-user'], title: 'Your profile', text: 'Your name, photo and password. Switch between light and dark mode just above.' },
  { title: 'You’re all set', text: 'Want a checklist for setting up? Get Started walks you through your company details, services and team.', last: true },
];
const tourVisible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight + 200; };
const tourTarget = (s) => { for (const [i, sel] of (s.at || []).entries()) { const el = $(sel); if (tourVisible(el)) return { el, alt: i > 0 }; } return null; };
let tour = null; // { steps, i, box, back (focus to return to) }

function startTour() {
  if (tour) return;
  closeHelp(); closeModal(); $('#side').classList.remove('open');
  const steps = TOUR_STEPS.filter((s) => !s.at || tourTarget(s));
  const box = document.createElement('div'); box.className = 'tour noprint';
  box.innerHTML = `<div class="tour-shade"></div><div class="tour-spot" hidden></div><div class="tour-pop" role="dialog" aria-modal="true" aria-labelledby="tourTitle" aria-describedby="tourText"></div>`;
  document.body.appendChild(box);
  tour = { steps, i: 0, box, back: document.activeElement };
  tourShow();
}
function endTour() {
  if (!tour) return;
  const { box, back } = tour; tour = null; box.remove();
  if (me && me.tourNew) { me.tourNew = false; api('POST', '/api/auth/tour', {}).catch(() => {}); } // seen: don't start by itself again
  if (back && back.focus && document.contains(back)) back.focus();
}
function tourShow() {
  const { steps, i, box } = tour; const s = steps[i];
  const t = s.at && tourTarget(s); // looked up again: the page may have changed since the tour started
  if (s.at && !t) { steps.splice(i, 1); if (tour.i >= steps.length) tour.i = steps.length - 1; return tourShow(); }
  const pop = $('.tour-pop', box);
  const getStarted = s.last && memberCan('/settings/company') && !planLocked('/settings/company');
  pop.innerHTML = `<div class="tour-h"><span class="muted">${i + 1} of ${steps.length}</span><button type="button" class="tour-x" data-tour="end" aria-label="End the tour">${svgIcon(ICONS.close, 18)}</button></div>
<h3 id="tourTitle">${esc(typeof s.title === 'function' ? s.title() : s.title)}</h3><p id="tourText">${esc(t && t.alt && s.alt ? s.alt : s.text)}</p>
<div class="tour-dots" aria-hidden="true">${steps.map((x, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
<div class="tour-foot">${i === 0 ? '<button type="button" class="btn alt" data-tour="end">Skip tour</button>' : '<button type="button" class="btn alt" data-tour="back">Back</button>'}
${s.last ? `${getStarted ? '<button type="button" class="btn alt" data-tour="start">Get Started checklist</button>' : ''}<button type="button" class="btn" data-tour="end">Done</button>` : `<button type="button" class="btn" data-tour="next">${i === 0 ? 'Show me around' : 'Next'}</button>`}</div>`;
  box.classList.toggle('no-spot', !t);
  if (t) t.el.scrollIntoView({ block: 'nearest' });
  tourPlace();
  const main = $('[data-tour=next], .tour-foot [data-tour=end]:last-child', pop); if (main) main.focus();
}
// the spotlight over the target, and the card beside it: right of the sidebar, above the bottom tabs, else below or above
function tourPlace() {
  if (!tour) return;
  const { steps, i, box } = tour; const s = steps[i]; const t = s.at && tourTarget(s);
  const spot = $('.tour-spot', box); const pop = $('.tour-pop', box); const gap = 12; const m = 16;
  spot.hidden = !t;
  if (!t) { Object.assign(pop.style, { left: `${Math.max(m, (innerWidth - pop.offsetWidth) / 2)}px`, top: `${Math.max(m, (innerHeight - pop.offsetHeight) / 2)}px` }); return; }
  const r = t.el.getBoundingClientRect(); const pad = 6;
  const top = Math.max(r.top, 0); const bottom = Math.min(r.bottom, innerHeight); // a tall target (the menu) is cut to the screen
  Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${top - pad}px`, width: `${r.width + pad * 2}px`, height: `${bottom - top + pad * 2}px` });
  const w = pop.offsetWidth; const h = pop.offsetHeight; let x; let y;
  if (r.right + gap + w <= innerWidth - m && r.width < innerWidth / 3) { x = r.right + gap + pad; y = top + Math.min(r.height, bottom - top) / 2 - h / 2; }
  else if (bottom + gap + h <= innerHeight - m) { x = r.left + r.width / 2 - w / 2; y = bottom + gap + pad; }
  else { x = r.left + r.width / 2 - w / 2; y = top - gap - pad - h; }
  pop.style.left = `${Math.min(Math.max(m, x), innerWidth - w - m)}px`; pop.style.top = `${Math.min(Math.max(m, y), innerHeight - h - m)}px`;
}
document.addEventListener('click', (e) => {
  const b = tour && e.target.closest('[data-tour]'); if (!b) return;
  const act = b.dataset.tour;
  if (act === 'next') { tour.i++; tourShow(); }
  else if (act === 'back') { tour.i--; tourShow(); }
  else { endTour(); if (act === 'start') openHelp('start'); }
});
document.addEventListener('keydown', (e) => {
  if (!tour) return;
  if (e.key === 'Escape') { e.stopImmediatePropagation(); endTour(); }
  else if (e.key === 'ArrowRight' && tour.i < tour.steps.length - 1) { e.preventDefault(); tour.i++; tourShow(); }
  else if (e.key === 'ArrowLeft' && tour.i > 0) { e.preventDefault(); tour.i--; tourShow(); }
  else if (e.key === 'Tab') { // keep focus in the card
    const f = $$('button', $('.tour-pop', tour.box)); const k = f.indexOf(document.activeElement);
    e.preventDefault(); f[(k + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
  }
}, true);
addEventListener('resize', tourPlace);
addEventListener('popstate', endTour);
A.startTour = startTour;
