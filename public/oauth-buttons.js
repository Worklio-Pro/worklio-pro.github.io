'use strict';
// "Continue with Google" / "Continue with Apple" buttons, for the login page and the sign-up forms (lib/sign-in-with.js on the server).
// oauthButtons(providers, hrefFor): providers from the server (only the ones that are set up); hrefFor(provider) is where each button goes.
(() => {
  const ICONS = {
    google: '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
    apple: '<svg width="18" height="18" viewBox="0 0 17 20" aria-hidden="true"><path fill="currentColor" d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.3c-1.9 3.2-.5 8 1.3 10.6.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.9 3.4-.9s2 .9 3.4.8c1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-3-4.2zM11.5 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg>',
  };
  const NAMES = { google: 'Google', apple: 'Apple' };
  const css = `.oa{display:grid;gap:10px;margin:0 0 4px}
.oa-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:46px;padding:0 14px;border:1px solid var(--border,#cbd5e1);border-radius:8px;background:var(--card,#fff);color:var(--text,#0f172a);font:inherit;font-size:15px;font-weight:600;text-decoration:none;cursor:pointer;box-sizing:border-box}
.oa-btn:hover{border-color:var(--brand,#2563eb);text-decoration:none}.oa-btn:focus-visible{outline:2px solid var(--brand,#2563eb);outline-offset:2px}
.oa-btn.apple{background:#000;color:#fff;border-color:#000}.oa-btn.apple:hover{background:#1f1f1f;border-color:#1f1f1f}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .oa-btn.apple{background:#fff;color:#000;border-color:#fff}}:root[data-theme=dark] .oa-btn.apple{background:#fff;color:#000;border-color:#fff}
.oa-or{display:flex;align-items:center;gap:12px;margin:16px 0;color:var(--muted,#64748b);font-size:13px}.oa-or::before,.oa-or::after{content:"";flex:1;height:1px;background:var(--border,#e2e8f0)}
.oa-who{display:flex;align-items:center;gap:8px;margin:0 0 12px;padding:10px 12px;border-radius:8px;background:var(--surface-2,#f1f5f9);font-size:14px}.oa-who svg{flex:none}`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.oauthButtons = (providers, hrefFor, orText = 'or') => (providers && providers.length
    ? `<div class="oa">${providers.filter((p) => NAMES[p]).map((p) => `<a class="oa-btn ${p}" href="${esc(hrefFor(p))}">${ICONS[p]}<span>Continue with ${NAMES[p]}</span></a>`).join('')}</div><div class="oa-or">${esc(orText)}</div>` : '');
  // "Signed in with Google as you@example.com", on a sign-up form that came back from Google or Apple
  window.oauthWho = (p, email) => `<div class="oa-who">${ICONS[p] || ''}<span>Signed in with ${esc(NAMES[p] || p)} as <strong>${esc(email)}</strong></span></div>`;
  // the page's address without what the sign-in added, for the button's way back (and to tidy the address bar)
  window.oauthClean = () => { const q = new URLSearchParams(location.search); ['oauth', 'oauth_error', 'pick'].forEach((k) => q.delete(k)); const s = q.toString(); return location.pathname + (s ? '?' + s : ''); };
})();
