// ideas.<platform domain>: a public page anyone can open, with the Roadmap (feature requests that are planned, in progress or done),
// Feedback (every feature request by votes) and the Changelog. Posting, voting and commenting happen on the app's Board, after Log in.
// "ideas" is a reserved address (lib/tenancy.js), so no account can take it.
const tenancy = require('./tenancy');
const forum = require('./forum');
const changelog = require('./changelog');
const brandLib = require('./brand');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (d, n = 18) => `<svg viewBox="0 0 24 24" width="${n}" height="${n}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  roadmap: '<path d="m9 4-6 2.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  feedback: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  changelog: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  comment: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
};
const TABS = [['/', 'roadmap', 'Roadmap'], ['/feedback', 'feedback', 'Feedback'], ['/changelog', 'changelog', 'Changelog']];
const ROADMAP = [['planned', 'Planned'], ['progress', 'In progress'], ['done', 'Done']];

function logo() {
  const b = brandLib.brand(); const name = esc(b.name || 'Worklio Pro');
  if (!b.logo) return `<span class="id-name">${name}</span>`;
  const img = b.logoDark ? `<picture><source srcset="${esc(b.logoDark)}" media="(prefers-color-scheme: dark)"><img src="${esc(b.logo)}" alt="${b.logoHasName ? name : ''}"></picture>` : `<img src="${esc(b.logo)}" alt="${b.logoHasName ? name : ''}">`;
  return img + (b.logoHasName ? '' : `<span class="id-name">${name}</span>`);
}

const votes = (n) => `<span class="id-votes" title="${n} vote${n === 1 ? '' : 's'}">${svg(ICON.up, 14)}${n}</span>`;
const byVotes = (a, b) => b.likes - a.likes || b.at.localeCompare(a.at);

// every category of the Board, with how many feature requests it has; each opens its own list
function categories(ideas) {
  return `<h1 class="id-h">Categories</h1><div class="id-cats">${Object.entries(forum.CATEGORIES).map(([k, label]) => `<a class="id-cat" href="/feedback/${k}" data-q><span>${esc(label)}</span><b>${ideas.filter((x) => x.category === k).length}</b></a>`).join('')}</div>`;
}

function roadmap() {
  const ideas = forum.publicIdeas();
  return `${categories(ideas)}<h1 class="id-h">Roadmap</h1><div class="id-cols">${ROADMAP.map(([k, label]) => {
    const list = ideas.filter((x) => x.status === k).sort(byVotes);
    return `<section class="id-col"><h2><i class="id-st id-${k}"></i>${label}<span>${list.length}</span></h2>${list.map((x) => `<div class="id-card" data-q>${votes(x.likes)}<span>${esc(x.title)}</span></div>`).join('') || '<p class="id-empty">Nothing here yet</p>'}</section>`;
  }).join('')}</div>`;
}

// Feedback: the categories down the left; a new post box and the category's feature requests on the right.
// Create Post logs in, then opens the Board in the app with the post filled in (posting needs a business login)
function feedback(cat) {
  const ideas = forum.publicIdeas().filter((x) => !cat || x.category === cat).sort(byVotes);
  const now = Date.now(); const trend = (x) => (x.likes + x.comments) / Math.pow((now - new Date(x.at)) / 864e5 + 2, 1.2); // recent likes and comments count most
  const C = forum.CATEGORIES; const sel = cat || '';
  const side = [['', 'All categories'], ...Object.entries(C)].map(([k, l]) => `<a href="/feedback${k ? '/' + k : ''}"${k === sel ? ' class="on" aria-current="page"' : ''}>${esc(l)}</a>`).join('');
  const pick = cat ? `<input type="hidden" name="cat" value="${cat}">` : `<select name="cat" required aria-label="Category"><option value="">Category</option>${Object.entries(C).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>`;
  const rows = ideas.map((x) => `<div class="id-post" data-q data-likes="${x.likes}" data-at="${esc(x.at)}" data-trend="${trend(x).toFixed(4)}"><div class="id-pt"><strong>${esc(x.title)}</strong>${x.excerpt ? `<p>${esc(x.excerpt)}</p>` : ''}<span class="id-pm"><span class="id-cm">${svg(ICON.comment, 14)}${x.comments}</span>${x.status !== 'open' ? `<span class="id-badge id-${esc(x.status)}">${esc(x.statusLabel)}</span>` : ''}</span></div>${votes(x.likes)}</div>`).join('');
  return `<div class="id-fb"><aside class="id-side"><h2>Categories</h2><nav aria-label="Categories">${side}</nav></aside>
<div class="id-fmain"><h1 class="id-h">${cat ? esc(C[cat]) : 'All feature requests'}</h1>
<form class="id-new" id="idNew" data-signin="${esc(tenancy.platformUrl())}/sign-in"><input name="title" maxlength="140" required placeholder="Short, descriptive title" aria-label="Title">
<label for="idBody">Details</label><textarea id="idBody" name="body" rows="3" maxlength="6000" placeholder="Any additional details…"></textarea>
<div class="id-nfoot"><span class="id-nnote">You’ll log in to post it.</span>${pick}<button type="reset" class="id-btn id-plain">Cancel</button><button class="id-btn">Create Post</button></div></form>
<div class="id-posts"><div class="id-phead"><label>Showing <select id="idSort"><option value="trend">Trending</option><option value="top">Top</option><option value="new">New</option></select> posts</label><span class="id-psearch">${svg(ICON.search, 16)}<input type="search" id="idQ" placeholder="Search…" aria-label="Search posts"></span></div>
<div id="idList">${rows || `<p class="id-empty id-pad">No feature requests ${cat ? 'in this category ' : ''}yet. Be the first to post one.</p>`}</div></div></div></div>
<script>
(function(){var f=document.getElementById('idNew');f.addEventListener('submit',function(e){e.preventDefault();var q=new URLSearchParams({new:'1',cat:f.cat.value,title:f.title.value.trim(),body:f.body.value.trim()});location.href=f.dataset.signin+'?next='+encodeURIComponent('/forum?'+q.toString());});
var list=document.getElementById('idList'),rows=[].slice.call(list.querySelectorAll('.id-post')),s=document.getElementById('idSort'),q=document.getElementById('idQ');
function sort(){var k=s.value;rows.sort(function(a,b){return k==='new'?b.dataset.at.localeCompare(a.dataset.at):k==='top'?b.dataset.likes-a.dataset.likes:b.dataset.trend-a.dataset.trend;}).forEach(function(r){list.appendChild(r);});}
s.addEventListener('change',sort);sort();
q.addEventListener('input',function(){var w=q.value.trim().toLowerCase();rows.forEach(function(r){r.hidden=!!w&&r.textContent.toLowerCase().indexOf(w)<0;});});})();
</script>`;
}

const changes = () => `<h1 class="id-h">Changelog</h1><p class="id-sub">The latest improvements and updates.</p>${changelog.entriesHtml()}`;

function page(cur, body) {
  const b = brandLib.brand(); const title = `${cur === '/' ? 'Roadmap' : cur === '/feedback' ? 'Feedback' : cur.startsWith('/feedback/') ? esc(forum.CATEGORIES[cur.slice(10)] || '') : cur === '/changelog' ? 'Changelog' : 'Not found'} · ${b.name || 'Worklio Pro'} Ideas`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="color-scheme" content="light dark"><link rel="icon" href="/favicon.ico">
<script>try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}</script>
<style>
:root{--bg:#fff;--card:#fff;--text:#1d2330;--muted:#5f6878;--line:#dfe2e7;--soft:#f3f5f8;--brand:#2563eb;--btn-text:#fff;--new:#1f8a4c;--improved:#2f6fdb;--fixed:#8a5a00;--focus:#2563eb;--planned:#2f6fdb;--progress:#c27c0e;--done:#1f8a4c}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#12151b;--card:#1b1f27;--text:#e8ebf0;--muted:#9aa3b2;--line:#2c323d;--soft:#20252e;--new:#4cc583;--improved:#6ea0f5;--fixed:#e0b04f;--focus:#6ea0f5;--planned:#6ea0f5;--progress:#e0b04f;--done:#4cc583}}
:root[data-theme=dark]{--bg:#12151b;--card:#1b1f27;--text:#e8ebf0;--muted:#9aa3b2;--line:#2c323d;--soft:#20252e;--new:#4cc583;--improved:#6ea0f5;--fixed:#e0b04f;--focus:#6ea0f5;--planned:#6ea0f5;--progress:#e0b04f;--done:#4cc583}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.id-wrap{max-width:1000px;margin:0 auto;padding:0 16px}
header{border-bottom:1px solid var(--line);background:var(--bg)}
.id-bar{display:flex;align-items:center;gap:12px;height:64px}
.id-logo{display:flex;align-items:center;gap:10px;margin-right:auto;min-width:0;color:var(--text);text-decoration:none}
.id-logo img{display:block;max-height:36px;max-width:200px;object-fit:contain}
.id-name{font-size:20px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.id-btn{display:inline-flex;align-items:center;height:36px;padding:0 16px;border-radius:6px;background:var(--brand);color:var(--btn-text);font-size:15px;font-weight:600;text-decoration:none;white-space:nowrap;border:1px solid var(--brand)}
.id-btn:hover{filter:brightness(1.08)}
.id-ghost{background:none;color:var(--brand)}
.id-nav{display:flex;align-items:center;gap:6px;height:48px}
.id-tab,.id-sbtn{display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 12px;color:var(--muted);font:inherit;font-size:15px;letter-spacing:.01em;text-decoration:none;border:0;border-bottom:2px solid transparent;background:none;cursor:pointer}
.id-tab:first-child{margin-left:-12px}
.id-tab:hover,.id-sbtn:hover{color:var(--text)}
.id-tab.on{color:var(--brand);border-bottom-color:var(--brand)}
.id-sbtn{margin-left:auto;margin-right:-12px}
.id-search{display:none;align-items:center;gap:8px;margin-left:auto;flex:0 1 320px;min-width:0}
.id-search input{flex:1;min-width:0;font:inherit;font-size:15px;padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--text)}
.id-search input::-webkit-search-cancel-button{display:none}
.id-search button{display:inline-flex;border:0;background:none;color:var(--muted);cursor:pointer;padding:6px}
.id-nav.searching .id-sbtn{display:none}.id-nav.searching .id-search{display:flex}
main.id-wrap{padding-top:28px;padding-bottom:64px}
.id-h{font-size:18px;font-weight:700;margin:0 0 18px}
.id-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.id-top .id-h{margin:0}
.id-sub{color:var(--muted);margin:6px 0 20px}
.id-cats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px 20px;margin-bottom:36px}
.id-cat{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--text);font-size:15px;font-weight:600;text-decoration:none}
.id-cat:hover{border-color:var(--brand)}.id-cat b{font-size:13px;color:var(--muted)}
.id-crumb{margin:0 0 12px}.id-crumb a{display:inline-flex;align-items:center;gap:4px;color:var(--muted);font-size:14px;text-decoration:none}.id-crumb a:hover{color:var(--text)}
.id-fb{display:grid;grid-template-columns:260px 1fr;gap:32px;align-items:start}
.id-side{position:sticky;top:16px;max-height:calc(100vh - 32px);overflow:auto}
.id-side h2{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:2px 12px 10px}
.id-side a{display:block;padding:7px 12px;border-radius:6px;color:var(--text);font-size:15px;text-decoration:none}
.id-side a:hover{background:var(--soft)}.id-side a.on{background:var(--soft);font-weight:600}
.id-fmain{min-width:0}
.id-new{border:1px solid var(--line);border-radius:8px;background:var(--card);margin-bottom:18px}
.id-new input[name=title]{display:block;width:100%;border:0;background:none;color:var(--text);font:inherit;font-size:17px;padding:16px 16px 8px}
.id-new label{display:block;font-size:14px;font-weight:600;padding:6px 16px 0}
.id-new textarea{display:block;width:100%;border:0;background:none;color:var(--text);font:inherit;font-size:15px;padding:6px 16px 12px;resize:vertical}
.id-new input:focus,.id-new textarea:focus{outline:none}.id-new:focus-within{border-color:var(--brand)}
.id-nfoot{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;padding:10px 12px;border-top:1px solid var(--line)}
.id-nnote{margin-right:auto;color:var(--muted);font-size:13px}
.id-nfoot select{max-width:180px}
.id-nfoot select,.id-phead select{font:inherit;font-size:15px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--text)}
.id-plain{background:var(--card);color:var(--text);border-color:var(--line)}
.id-posts{border:1px solid var(--line);border-radius:8px;background:var(--card);overflow:hidden}
.id-phead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 16px;background:var(--soft);border-bottom:1px solid var(--line)}
.id-phead label{display:flex;align-items:center;gap:8px;font-size:16px}
.id-psearch{position:relative;display:flex;align-items:center;flex:0 1 200px;min-width:140px}.id-psearch svg{position:absolute;left:10px;color:var(--muted)}
.id-psearch input{width:100%;font:inherit;font-size:15px;padding:7px 10px 7px 32px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--text)}
.id-post{display:flex;align-items:center;gap:16px;padding:14px 16px;border-top:1px solid var(--line)}.id-post:first-child{border-top:0}
.id-pt{flex:1;min-width:0}.id-pt strong{display:block;font-size:15px}
.id-pt p{margin:2px 0 4px;color:var(--muted);font-size:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.id-pm{display:flex;align-items:center;gap:12px}.id-pm .id-badge{margin:0}
.id-pad{padding:16px}
.id-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.id-col{border:1px solid var(--line);border-radius:8px;padding:14px;background:var(--card);min-width:0}
.id-col h2{display:flex;align-items:center;gap:8px;font-size:15px;margin:0 0 10px}.id-col h2 span{margin-left:auto;color:var(--muted);font-size:13px;font-weight:600}
.id-st{width:10px;height:10px;border-radius:50%;background:var(--muted)}.id-st.id-planned{background:var(--planned)}.id-st.id-progress{background:var(--progress)}.id-st.id-done{background:var(--done)}
.id-card{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid var(--line);font-size:15px;font-weight:600}
.id-votes{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-width:40px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;font-size:13px;font-weight:700;line-height:1.1;color:var(--text);flex:none}
.id-list{border-top:1px solid var(--line)}
.id-row{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}
.id-rt{flex:1;min-width:0}.id-rt strong{display:block;font-size:16px}
.id-badge{display:inline-block;margin-top:4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.id-badge.id-planned{color:var(--planned)}.id-badge.id-progress{color:var(--progress)}.id-badge.id-done{color:var(--done)}
.id-cm{display:inline-flex;align-items:center;gap:5px;color:var(--muted);font-size:14px}
.id-empty{color:var(--muted);font-size:15px;margin:8px 0}
.id-none{color:var(--muted);padding:20px 0}
[data-q][hidden]{display:none}
${changelog.ENTRY_CSS}
@media (max-width:760px){.id-fb{grid-template-columns:1fr;gap:16px}.id-side{position:static;max-height:none}.id-side nav{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}.id-side a{white-space:nowrap;border:1px solid var(--line);border-radius:99px;padding:5px 12px;font-size:14px}.id-side h2{margin-left:0}.id-nnote{flex-basis:100%}.id-cats{grid-template-columns:repeat(2,1fr);gap:12px}.id-cols{grid-template-columns:1fr}.id-sbtn span{display:none}.id-search{flex:1}}
@media (max-width:480px){.id-cats{grid-template-columns:1fr}.id-tab span{display:none}.id-tab{padding:0 14px}}
</style>
<link rel="stylesheet" href="/theme.css">
</head>
<body>
<header><div class="id-wrap">
<div class="id-bar"><a class="id-logo" href="/">${logo()}</a><a class="id-btn" href="${esc(tenancy.platformUrl())}/sign-in">Log in</a></div>
<nav class="id-nav" aria-label="Ideas">${TABS.filter(([p]) => p === '/changelog' || forum.isOn()).map(([p, k, label]) => `<a class="id-tab${p === cur || (p === '/feedback' && cur.startsWith('/feedback/')) ? ' on' : ''}" href="${p}"${p === cur ? ' aria-current="page"' : ''} aria-label="${label}">${svg(ICON[k])}<span>${label}</span></a>`).join('')}
<button type="button" class="id-sbtn" aria-label="Search">${svg(ICON.search)}<span>Search</span></button>
<div class="id-search" role="search"><input type="search" placeholder="Search" aria-label="Search this page" autocomplete="off"><button type="button" aria-label="Close search">${svg(ICON.close)}</button></div>
</nav>
</div></header>
<main class="id-wrap">${body}<p class="id-none" hidden>Nothing matches your search.</p></main>
<script>
(function(){var nav=document.querySelector('.id-nav'),q=nav.querySelector('input'),none=document.querySelector('.id-none'),items=[].slice.call(document.querySelectorAll('[data-q],.cl-entry'));
function f(){var w=q.value.trim().toLowerCase(),n=0;items.forEach(function(e){var ok=!w||e.textContent.toLowerCase().indexOf(w)>=0;e.hidden=!ok;if(ok)n++;});none.hidden=!w||n>0;}
nav.querySelector('.id-sbtn').addEventListener('click',function(){nav.classList.add('searching');q.focus();});
nav.querySelector('.id-search button').addEventListener('click',function(){q.value='';f();nav.classList.remove('searching');});
q.addEventListener('input',f);q.addEventListener('keydown',function(e){if(e.key==='Escape'){q.value='';f();nav.classList.remove('searching');}});})();
</script>
</body>
</html>`;
}

// answers every request to ideas.<domain>
module.exports = function ideasApp(req, res) {
  const p = req.url.split('?')[0].replace(/\/+$/, '') || '/';
  const send = (status, html) => { res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(req.method === 'HEAD' ? '' : html); };
  if (!/^(GET|HEAD)$/.test(req.method)) return send(405, page('', '<h1 class="id-h">Not allowed</h1>'));
  if (p === '/changelog') return send(200, page(p, changes()));
  if (p === '/' && !forum.isOn()) { res.writeHead(302, { Location: '/changelog' }); return res.end(); } // the Board is closed: only the changelog
  if (p === '/') return send(200, page(p, roadmap()));
  const old = /^\/category\/([a-z-]+)$/.exec(p); if (old) { res.writeHead(301, { Location: '/feedback/' + old[1] }); return res.end(); }
  const cat = /^\/feedback\/([a-z-]+)$/.exec(p);
  if (cat && forum.CATEGORIES[cat[1]] && forum.isOn()) return send(200, page(p, feedback(cat[1])));
  if (p === '/feedback') return send(200, forum.isOn() ? page(p, feedback()) : page(p, '<h1 class="id-h">Feedback is closed right now</h1>'));
  send(404, page('', '<h1 class="id-h">Page not found</h1><p class="id-sub"><a href="/">Go to the Roadmap</a></p>'));
};
