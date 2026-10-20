'use strict';
// The application logo (platform console → Settings → Logo) for any page: brandImg(b, surface) returns the <img> markup, or '' when no logo is set.
// b: { name, logo, logoDark, logoHasName } from the page's API. surface: 'auto' follows the light/dark theme, 'dark' is an always-dark bar.
// Without a dark-background version, the logo sits on a small white tile wherever the background is dark.
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const css = `.brand-img{display:block;height:var(--logo-h,32px);width:auto;max-width:var(--logo-w,200px);object-fit:contain}
.brand-img.on-tile{background:#fff;padding:3px 6px;border-radius:8px;box-sizing:content-box;height:calc(var(--logo-h,32px) - 6px)}
.brand-img.lg-d{display:none}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .brand-img.lg-l{display:none}:root:not([data-theme=light]) .brand-img.lg-d{display:block}
:root:not([data-theme=light]) .brand-img.lg-solo{background:#fff;padding:3px 6px;border-radius:8px;box-sizing:content-box;height:calc(var(--logo-h,32px) - 6px)}}
:root[data-theme=dark] .brand-img.lg-l{display:none}:root[data-theme=dark] .brand-img.lg-d{display:block}
:root[data-theme=dark] .brand-img.lg-solo{background:#fff;padding:3px 6px;border-radius:8px;box-sizing:content-box;height:calc(var(--logo-h,32px) - 6px)}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const img = (src, cls, alt) => `<img class="brand-img ${cls}" src="${esc(src)}" alt="${esc(alt)}">`;
  window.brandImg = (b, surface = 'auto') => {
    if (!b || !b.logo) return '';
    const alt = b.logoHasName ? b.name : '';
    if (surface === 'dark') return b.logoDark ? img(b.logoDark, '', alt) : img(b.logo, 'on-tile', alt);
    return b.logoDark ? img(b.logo, 'lg-l', alt) + img(b.logoDark, 'lg-d', alt) : img(b.logo, 'lg-solo', alt);
  };
}());
