// The "Industries" menu in the header of the public pages (home, pricing, industries; markup from lib/industries.js)
document.querySelectorAll('.h-menu').forEach((m) => {
  const b = m.querySelector('.h-menu-btn'); const d = m.querySelector('.h-drop');
  const set = (open) => { b.setAttribute('aria-expanded', String(open)); d.hidden = !open; };
  b.addEventListener('click', () => set(d.hidden));
  document.addEventListener('click', (e) => { if (!m.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !d.hidden) { set(false); b.focus(); } });
});
