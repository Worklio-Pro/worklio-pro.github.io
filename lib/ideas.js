// ideas.<platform domain>: a public page anyone can open, with the Roadmap (feature requests that are planned, in progress, in beta or done),
// Feedback (every feature request by votes) and the Changelog. "ideas" is a reserved address (lib/tenancy.js), so no account can take it.
// It uses the business login: someone logged in at <business>.<domain> is logged in here too (the wp_acct cookie names the business,
// GET <business>/ideas/sso hands back a one-time pass), and can then post feature requests and vote. Comments stay on the app's Board.
const tenancy = require('./tenancy');
const forum = require('./forum');
const changelog = require('./changelog');
const crypto = require('crypto');
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
const ROADMAP = [['planned', 'Planned'], ['progress', 'In progress'], ['beta', 'Beta'], ['done', 'Done']];

const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
// Log in: the one sign-in for every business, then back here through the business's /ideas/sso, logged in
const loginUrl = (cur) => `${tenancy.platformUrl()}/sign-in?next=${encodeURIComponent('/ideas/sso?r=' + (cur || '/'))}`;

function logo() {
  const b = brandLib.brand(); const name = esc(b.name || 'Worklio Pro');
  if (!b.logo) return `<span class="id-name">${name}</span>`;
  const img = b.logoDark ? `<picture><source srcset="${esc(b.logoDark)}" media="(prefers-color-scheme: dark)"><img src="${esc(b.logo)}" alt="${b.logoHasName ? name : ''}"></picture>` : `<img src="${esc(b.logo)}" alt="${b.logoHasName ? name : ''}">`;
  return img + (b.logoHasName ? '' : `<span class="id-name">${name}</span>`);
}

// a vote button: logged in, it likes or unlikes the post; logged out, it goes to Log in
const votes = (x) => `<button type="button" class="id-votes${x.liked ? ' on' : ''}" data-like="${esc(x.id)}" aria-pressed="${!!x.liked}" title="${x.liked ? 'Remove your vote' : 'Vote'}"><span class="id-vi">${svg(ICON.up, 14)}</span><span class="id-vn">${x.likes}</span></button>`;
const byVotes = (a, b) => b.likes - a.likes || b.at.localeCompare(a.at);

// every category of the Board (called Boards on the page), with how many feature requests it has; each opens its own list
function categories(ideas) {
  return `<h1 class="id-h">Boards</h1><div class="id-cats">${Object.entries(forum.CATEGORIES).map(([k, label]) => `<a class="id-cat" href="/feedback/${k}" data-q><span>${esc(label)}</span><b>${ideas.filter((x) => x.category === k).length}</b></a>`).join('')}</div>`;
}

function roadmap(who) {
  const ideas = forum.publicIdeas(who);
  return `${categories(ideas)}<h1 class="id-h">Roadmap</h1><div class="id-cols">${ROADMAP.map(([k, label]) => {
    const list = ideas.filter((x) => x.status === k).sort(byVotes);
    return `<section class="id-col"><h2><i class="id-st id-${k}"></i>${label}<span>${list.length}</span></h2>${list.map((x) => `<div class="id-card" data-q>${votes(x)}<span>${esc(x.title)}</span></div>`).join('') || '<p class="id-empty">Nothing here yet</p>'}</section>`;
  }).join('')}</div>`;
}

// Feedback: the categories (Boards) down the left; a new post box and the category's feature requests on the right.
// Create Post posts it (an owner or admin logged in); logged out, it keeps what was typed (sessionStorage), logs in and comes back to finish
function feedback(cat, who) {
  const ideas = forum.publicIdeas(who).filter((x) => !cat || x.category === cat).sort(byVotes);
  const now = Date.now(); const trend = (x) => (x.likes + x.comments) / Math.pow((now - new Date(x.at)) / 864e5 + 2, 1.2); // recent likes and comments count most
  const C = forum.CATEGORIES; const sel = cat || '';
  const side = [['', 'All boards'], ...Object.entries(C)].map(([k, l]) => `<a href="/feedback${k ? '/' + k : ''}"${k === sel ? ' class="on" aria-current="page"' : ''}>${esc(l)}</a>`).join('');
  const pick = cat ? `<input type="hidden" name="cat" value="${cat}">` : `<select name="cat" required aria-label="Board"><option value="">Board</option>${Object.entries(C).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>`;
  const rows = ideas.map((x) => `<div class="id-post" data-q data-likes="${x.likes}" data-at="${esc(x.at)}" data-trend="${trend(x).toFixed(4)}"><div class="id-pt"><strong>${esc(x.title)}</strong>${x.body ? `<p>${esc(x.body)}</p>` : ''}<span class="id-pm"><span class="id-cm">${svg(ICON.comment, 14)}${x.comments}</span>${x.status !== 'open' ? `<span class="id-badge id-${esc(x.status)}">${esc(x.statusLabel)}</span>` : ''}</span></div>${votes(x)}</div>`).join('');
  return `<div class="id-fb"><aside class="id-side"><h2>Boards</h2><nav aria-label="Boards">${side}</nav></aside>
<div class="id-fmain"><h1 class="id-h">${cat ? esc(C[cat]) : 'All feature requests'}</h1>
<form class="id-new" id="idNew" ${who && who.admin ? ' data-post' : ''}><input name="title" maxlength="140" required placeholder="Short, descriptive title" aria-label="Title">
<label for="idBody">Details</label><textarea id="idBody" name="body" rows="3" maxlength="6000" placeholder="Any additional details…"></textarea>
<div class="id-nfoot"><span class="id-nnote" id="idNote">${!who ? 'You’ll log in to post it.' : who.admin ? `Posting as ${esc(who.name)} · ${esc(who.company)}` : 'Only owners and admins can post.'}</span>${pick}<button type="reset" class="id-btn id-plain">Cancel</button><button class="id-btn">Create Post</button></div></form>
<div class="id-posts"><div class="id-phead"><label>Showing <select id="idSort"><option value="trend">Trending</option><option value="top">Top</option><option value="new">New</option></select> posts</label><span class="id-psearch">${svg(ICON.search, 16)}<input type="search" id="idQ" placeholder="Search…" aria-label="Search posts"></span></div>
<div id="idList">${rows || `<p class="id-empty id-pad">No feature requests ${cat ? 'on this board ' : ''}yet. Be the first to post one.</p>`}</div></div></div></div>
<script>
(function(){var f=document.getElementById('idNew');f.addEventListener('submit',function(e){e.preventDefault();var d={cat:f.cat.value,title:f.title.value.trim(),body:f.body.value.trim()};
var login=document.getElementById('idLogin');
if(!f.hasAttribute('data-post')){if(login){try{sessionStorage.setItem('idDraft',JSON.stringify(d));}catch(x){}location.href=login.href;}return;} // logged out: log in, then back here with the post still typed
var b=f.querySelector('button:not([type])'),n=document.getElementById('idNote');b.disabled=true;try{sessionStorage.removeItem('idDraft');}catch(x){}
fetch('/api/posts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'Couldn’t post');location.reload();});}).catch(function(x){n.textContent=x.message;n.classList.add('id-err');b.disabled=false;});});
try{var dr=JSON.parse(sessionStorage.getItem('idDraft')||'null');if(dr&&f.hasAttribute('data-post')){f.title.value=dr.title||'';f.body.value=dr.body||'';if(dr.cat&&f.cat.tagName==='SELECT')f.cat.value=dr.cat;f.title.focus();}}catch(x){}
var list=document.getElementById('idList'),rows=[].slice.call(list.querySelectorAll('.id-post')),s=document.getElementById('idSort'),q=document.getElementById('idQ');
function sort(){var k=s.value;rows.sort(function(a,b){return k==='new'?b.dataset.at.localeCompare(a.dataset.at):k==='top'?b.dataset.likes-a.dataset.likes:b.dataset.trend-a.dataset.trend;}).forEach(function(r){list.appendChild(r);});}
s.addEventListener('change',sort);sort();
q.addEventListener('input',function(){var w=q.value.trim().toLowerCase();rows.forEach(function(r){r.hidden=!!w&&r.textContent.toLowerCase().indexOf(w)<0;});});
// a post longer than its two lines opens in place: click the row (or Show more) to read it all, again to close it
rows.forEach(function(r){var t=r.querySelector('.id-pt'),p=t.querySelector('p');if(!p||p.scrollHeight<=p.clientHeight+1)return;
var b=document.createElement('button');b.type='button';b.className='id-more';b.textContent='Show more';b.setAttribute('aria-expanded','false');p.after(b);t.classList.add('id-clip');
t.addEventListener('click',function(){if(String(getSelection()))return;var o=r.classList.toggle('id-open');b.textContent=o?'Show less':'Show more';b.setAttribute('aria-expanded',String(o));});});})();
</script>`;
}

const changes = () => `<h1 class="id-h">Changelog</h1><p class="id-sub">The latest improvements and updates.</p>${changelog.entriesHtml()}`;

function page(cur, body, who) {
  const b = brandLib.brand(); const title = `${cur === '/' ? 'Roadmap' : cur === '/feedback' ? 'Feedback' : cur.startsWith('/feedback/') ? esc(forum.CATEGORIES[cur.slice(10)] || '') : cur === '/changelog' ? 'Changelog' : 'Not found'} · ${b.name || 'Worklio Pro'} Ideas`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="color-scheme" content="light dark"><link rel="icon" href="/favicon.ico">
<script>try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}</script>
<style>
:root{--bg:#fff;--card:#fff;--text:#1d2330;--muted:#5f6878;--line:#dfe2e7;--soft:#f3f5f8;--brand:#2563eb;--btn-text:#fff;--new:#1f8a4c;--improved:#2f6fdb;--fixed:#8a5a00;--focus:#2563eb;--planned:#2f6fdb;--progress:#c27c0e;--beta:#0f766e;--done:#1f8a4c}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#121b2f;--card:#16213a;--text:#e2e8f0;--muted:#94a3b8;--line:#263556;--soft:#1c2a48;--h-dots:radial-gradient(rgba(148,163,184,.10) 1px,transparent 1.5px);--h-glow:radial-gradient(760px 500px at 8% 0%,rgba(37,99,235,.42),transparent 70%),radial-gradient(660px 520px at 92% 120px,rgba(139,92,246,.30),transparent 70%);--new:#4cc583;--improved:#6ea0f5;--fixed:#e0b04f;--focus:#6ea0f5;--planned:#6ea0f5;--progress:#e0b04f;--beta:#2dd4bf;--done:#4cc583}}
:root[data-theme=dark]{--bg:#121b2f;--card:#16213a;--text:#e2e8f0;--muted:#94a3b8;--line:#263556;--soft:#1c2a48;--h-dots:radial-gradient(rgba(148,163,184,.10) 1px,transparent 1.5px);--h-glow:radial-gradient(760px 500px at 8% 0%,rgba(37,99,235,.42),transparent 70%),radial-gradient(660px 520px at 92% 120px,rgba(139,92,246,.30),transparent 70%);--new:#4cc583;--improved:#6ea0f5;--fixed:#e0b04f;--focus:#6ea0f5;--planned:#6ea0f5;--progress:#e0b04f;--beta:#2dd4bf;--done:#4cc583}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.id-wrap{max-width:1000px;margin:0 auto;padding:0 16px}
header{border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)} /* like the main site's header: solid navy in dark mode, over the glows */
/* dark mode, like the home and pricing pages: blue and violet glows at the top and a faint dot texture ('none' in light mode) */
:root{--h-dots:none;--h-glow:none}
body{background-image:var(--h-glow),var(--h-dots);background-size:100% 900px,100% 900px,24px 24px;background-repeat:no-repeat,no-repeat,repeat}
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
.id-pt.id-clip{cursor:pointer}.id-open .id-pt p{display:block;-webkit-line-clamp:unset;overflow:visible;white-space:pre-line}
.id-more{display:block;margin:0 0 4px;padding:0;border:0;background:none;color:var(--brand);font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.id-pm{display:flex;align-items:center;gap:12px}.id-pm .id-badge{margin:0}
.id-pad{padding:16px}
.id-cols{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
@media (max-width:960px){.id-cols{grid-template-columns:repeat(2,1fr)}}
.id-col{border:1px solid var(--line);border-radius:8px;padding:14px;background:var(--card);min-width:0}
.id-col h2{display:flex;align-items:center;gap:8px;font-size:15px;margin:0 0 10px}.id-col h2 span{margin-left:auto;color:var(--muted);font-size:13px;font-weight:600}
.id-st{width:10px;height:10px;border-radius:50%;background:var(--muted)}.id-st.id-planned{background:var(--planned)}.id-st.id-progress{background:var(--progress)}.id-st.id-beta{background:var(--beta)}.id-st.id-done{background:var(--done)}
.id-card{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid var(--line);font-size:15px;font-weight:600}
.id-votes{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-width:40px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--card);font:inherit;font-size:13px;font-weight:700;line-height:1.1;color:var(--text);flex:none;cursor:pointer}
.id-vi{display:flex}.id-votes:hover{border-color:var(--brand)}.id-votes.on{border-color:var(--brand);color:var(--brand)}.id-votes:disabled{opacity:.6}
.id-me{position:relative}.id-me summary{list-style:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:var(--soft);color:var(--brand);font-size:14px;font-weight:700;cursor:pointer}.id-me summary::-webkit-details-marker{display:none}
.id-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:5;min-width:220px;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--card);box-shadow:0 8px 24px rgba(0,0,0,.12)}
.id-menu strong,.id-menu small{display:block}.id-menu small{color:var(--muted);margin-bottom:8px}
.id-menu a,.id-menu button{display:block;width:100%;padding:8px 0;border:0;border-top:1px solid var(--line);background:none;color:var(--text);font:inherit;font-size:15px;text-align:left;text-decoration:none;cursor:pointer}.id-menu a:hover,.id-menu button:hover{color:var(--brand)}
.id-err{color:#c0362c}
.id-list{border-top:1px solid var(--line)}
.id-row{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}
.id-rt{flex:1;min-width:0}.id-rt strong{display:block;font-size:16px}
.id-badge{display:inline-block;margin-top:4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.id-badge.id-planned{color:var(--planned)}.id-badge.id-progress{color:var(--progress)}.id-badge.id-beta{color:var(--beta)}.id-badge.id-done{color:var(--done)}
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
<div class="id-bar"><a class="id-logo" href="/">${logo()}</a>${who ? `<details class="id-me"><summary aria-label="Your account" title="${esc(who.name)}">${esc(initials(who.name))}</summary><div class="id-menu"><strong>${esc(who.name)}</strong><small>${esc(who.company)}</small>
<a href="${esc(who.url)}">Open ${esc(who.company)}</a><form method="post" action="/logout"><button>Log out</button></form></div></details>` : `<a class="id-btn" id="idLogin" href="${esc(loginUrl(cur))}">Log in</a>`}</div>
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
q.addEventListener('input',f);q.addEventListener('keydown',function(e){if(e.key==='Escape'){q.value='';f();nav.classList.remove('searching');}});
var login=document.getElementById('idLogin');
document.addEventListener('click',function(e){var v=e.target.closest('[data-like]');if(!v)return;if(login){location.href=login.href;return;}v.disabled=true;
fetch('/api/like/'+encodeURIComponent(v.dataset.like),{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'Couldn’t vote');
v.classList.toggle('on',j.liked);v.setAttribute('aria-pressed',j.liked);v.querySelector('.id-vn').textContent=j.likes;var row=v.closest('[data-likes]');if(row)row.dataset.likes=j.likes;});}).catch(function(x){alert(x.message);}).then(function(){v.disabled=false;});});})();
</script>
</body>
</html>`;
}

// ---------- the same login as <business>.<domain> ----------
// sessions live in platform.json (ideasSessions: hash -> { t: account id, u: user id, exp }), 30 days, in an ideas_sid cookie on this address only.
// ideas_chk stops the trip to the business when it just said nobody is logged in (an hour), or after Log out here (30 days, until Log in)
const DAY = 864e5;
const sessions = () => { const P = tenancy.platform(); P.ideasSessions = P.ideasSessions || {}; return P.ideasSessions; };
const cookiesOf = (req) => Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
const cookie = (k, v, secs) => `${k}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${secs}${tenancy.ideasUrl().startsWith('https') ? '; Secure' : ''}`;
const safeBack = (r) => (typeof r === 'string' && /^\/(?!\/)[^\s\\]*$/.test(r) ? r : '/');
const sameSite = (req) => { const o = req.headers.origin; return !o || o === tenancy.ideasUrl(); }; // a post from this site, not another one
function readJson(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 20000) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
}

module.exports = function ideas(hooks) {
  const prune = () => { const now = Date.now(); const all = sessions(); for (const [k, x] of Object.entries(all)) if (x.exp < now) delete all[k]; };
  function me(req) {
    const k = hooks.sha(cookiesOf(req).ideas_sid || ''); const s = sessions()[k];
    if (!s || s.exp < Date.now()) return null;
    const a = hooks.actor(s.t, s.u); if (!a) { delete sessions()[k]; tenancy.savePlatform(); }
    return a;
  }
  const json = (res, status, o) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };

  async function app(req, res) {
    const url = new URL(req.url, 'http://x'); const p = url.pathname.replace(/\/+$/, '') || '/';
    const send = (status, html) => { res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(req.method === 'HEAD' ? '' : html); };
    const go = (to, set) => { res.writeHead(302, { Location: to, ...(set ? { 'Set-Cookie': set } : {}) }); res.end(); };
    const c = cookiesOf(req);

    // back from <business>/ideas/sso
    if (p === '/sso' && req.method === 'GET') {
      const back = safeBack(url.searchParams.get('r'));
      const x = hooks.claim(url.searchParams.get('token'));
      if (!x) return go(back, cookie('ideas_chk', '1', 3600));
      prune(); const tok = crypto.randomBytes(32).toString('hex');
      sessions()[hooks.sha(tok)] = { t: x.tenantId, u: x.userId, exp: Date.now() + 30 * DAY }; tenancy.savePlatform();
      return go(back, [cookie('ideas_sid', tok, 30 * 86400), cookie('ideas_chk', '', 0)]);
    }
    if (p === '/logout' && req.method === 'POST') {
      if (!sameSite(req)) return send(403, page('', '<h1 class="id-h">Not allowed</h1>'));
      delete sessions()[hooks.sha(c.ideas_sid || '')]; tenancy.savePlatform();
      return go('/', [cookie('ideas_sid', '', 0), cookie('ideas_chk', 'out', 30 * 86400)]);
    }
    const who = me(req);

    // posting and voting: an owner or admin of a business, from this site
    if (req.method === 'POST' && (p === '/api/posts' || p.startsWith('/api/like/'))) {
      if (!sameSite(req) || !/^application\/json/.test(req.headers['content-type'] || '')) return json(res, 403, { error: 'Not allowed' });
      if (!who) return json(res, 401, { error: 'Log in to post and vote' });
      if (!who.admin) return json(res, 403, { error: 'The Board is for account owners and admins' });
      const b = await readJson(req);
      try {
        if (p === '/api/posts') return json(res, 200, forum.create(who, { kind: 'idea', category: b.cat, title: b.title, body: b.body }));
        return json(res, 200, forum.like(who, decodeURIComponent(p.slice(10))));
      } catch (e) { return json(res, e.status || 500, { error: e.message }); }
    }
    if (!/^(GET|HEAD)$/.test(req.method)) return send(405, page('', '<h1 class="id-h">Not allowed</h1>', who));

    // logged in at a business but not here yet: ask it (once an hour at most, and not after Log out here)
    if (!who && c.wp_acct && !c.ideas_chk && req.method === 'GET') {
      const t = tenancy.platform().tenants.find((x) => x.slug === c.wp_acct);
      if (t) return go(`${tenancy.subdomainUrl(t)}/ideas/sso?r=${encodeURIComponent(p + url.search)}`);
    }

    if (p === '/changelog') return send(200, page(p, changes(), who));
    if (p === '/' && !forum.isOn()) return go('/changelog'); // the Board is closed: only the changelog
    if (p === '/') return send(200, page(p, roadmap(who), who));
    const old = /^\/category\/([a-z-]+)$/.exec(p); if (old) { res.writeHead(301, { Location: '/feedback/' + old[1] }); return res.end(); }
    const cat = /^\/feedback\/([a-z-]+)$/.exec(p);
    if (cat && forum.CATEGORIES[cat[1]] && forum.isOn()) return send(200, page(p, feedback(cat[1], who), who));
    if (p === '/feedback') return send(200, forum.isOn() ? page(p, feedback(null, who), who) : page(p, '<h1 class="id-h">Feedback is closed right now</h1>', who));
    send(404, page('', '<h1 class="id-h">Page not found</h1><p class="id-sub"><a href="/">Go to the Roadmap</a></p>', who));
  }
  // logged out at the business: logged out here too
  app.logoutUser = (tenantId, userId) => {
    const all = sessions(); let n = 0; for (const [k, x] of Object.entries(all)) if (x.t === tenantId && x.u === userId) { delete all[k]; n++; }
    if (n) tenancy.savePlatform();
  };
  return app;
};
