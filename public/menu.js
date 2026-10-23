// The "Industries" menu in the header of the public pages (home, pricing, industries; markup from lib/industries.js)
document.querySelectorAll('.h-menu').forEach((m) => {
  const b = m.querySelector('.h-menu-btn'); const d = m.querySelector('.h-drop');
  const set = (open) => { b.setAttribute('aria-expanded', String(open)); d.hidden = !open; };
  b.addEventListener('click', () => set(d.hidden));
  document.addEventListener('click', (e) => { if (!m.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !d.hidden) { set(false); b.focus(); } });
});
// The phone menu on the home page: the hamburger slides the header links and Get started in from the right
document.querySelectorAll('.h-has-drawer').forEach((h) => {
  const burger = h.querySelector('.h-burger'); const panel = h.querySelector('.h-panel'); const scrim = document.querySelector('.h-scrim');
  const phone = window.matchMedia('(max-width:640px)');
  const isOpen = () => panel.classList.contains('open');
  const set = (open, refocus) => {
    panel.classList.toggle('open', open); if (scrim) scrim.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open)); document.body.style.overflow = open ? 'hidden' : '';
    if (open) h.querySelector('.h-close').focus(); else if (refocus) burger.focus();
  };
  burger.addEventListener('click', () => set(true));
  h.querySelector('.h-close').addEventListener('click', () => set(false, true));
  if (scrim) scrim.addEventListener('click', () => set(false, true));
  panel.addEventListener('click', (e) => { if (isOpen() && e.target.closest('a')) set(false); }); // a link was tapped: go there with the menu shut
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen() && !h.querySelector('.h-drop:not([hidden])')) set(false, true); }, true); // capture: runs before the Industries menu's Escape, so Escape with Industries open closes only Industries
  phone.addEventListener('change', () => { if (!phone.matches && isOpen()) set(false); });
});
