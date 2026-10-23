// The chat button (lib/chat.js): <script src="/chat.js" data-where="site|help|app" defer></script>
// A bot answers first; "Talk to a person" hands the chat to the team in Alpha → Messages → Live chat.
(() => {
  'use strict';
  const where = (document.currentScript && document.currentScript.dataset.where) || 'site';
  if (where === 'app' && location.pathname.startsWith('/client-portal')) return; // a business's clients aren't ours to chat with
  const KEY = 'chat:' + where;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const linkify = (s) => esc(s).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)'"]/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\//, '').slice(0, 60)}</a>`).replace(/\n/g, '<br>');
  const store = { get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }, set(v) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) { /* private mode */ } } };
  const api = async (method, url, body) => {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong'), { status: r.status }); return j;
  };
  const who = () => { try { return typeof me !== 'undefined' && me ? { name: me.name || '', email: me.email || '' } : {}; } catch (e) { return {}; } }; // the logged-in person in the business app

  let C = null; let S = null; let msgs = []; let open = false; let timer = null; let unread = 0; let handoff = false;
  let typing = 0; // bot answers on their way ("Typing…")
  let shown = ''; let footMode = ''; // what's on screen, so checking for new messages doesn't redraw (and steal the typing box) when nothing changed
  const host = document.createElement('div'); host.id = 'chat-root';
  const root = host.attachShadow({ mode: 'open' });

  api('GET', '/api/chat/config').then((cfg) => {
    if (!cfg.on || !cfg.where.includes(where)) return;
    C = cfg; const saved = store.get(); if (saved) S = saved;
    root.innerHTML = `<style>
:host{all:initial}
*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.btn{position:fixed;right:20px;bottom:${where === 'app' ? '20px' : '20px'};z-index:2147483000;width:58px;height:58px;border-radius:50%;border:0;background:var(--brand,#2563eb);color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(15,23,42,.28);display:flex;align-items:center;justify-content:center;transition:transform .15s}
.btn:hover{transform:scale(1.05)}.btn svg{width:28px;height:28px}
.badge{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#dc2626;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff}
.panel{position:fixed;right:20px;bottom:90px;z-index:2147483000;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);background:var(--c-bg);color:var(--c-text);border-radius:16px;box-shadow:0 18px 50px rgba(15,23,42,.3);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--c-line)}
.panel[hidden],.badge[hidden]{display:none}
.top{background:var(--brand,#2563eb);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}
.top strong{display:block;font-size:16px}.top small{display:flex;align-items:center;gap:6px;font-size:12px;opacity:.9}
.dot{width:8px;height:8px;border-radius:50%;background:#4ade80}.dot.off{background:#cbd5e1}
.x{margin-left:auto;background:none;border:0;color:#fff;font-size:24px;line-height:1;cursor:pointer;padding:4px 6px;border-radius:8px}.x:hover{background:rgba(255,255,255,.15)}
.list{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:var(--c-soft)}
.m{max-width:85%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;word-wrap:break-word;overflow-wrap:anywhere}
.m a{color:inherit;text-decoration:underline}
.m.visitor{align-self:flex-end;background:var(--brand,#2563eb);color:#fff;border-bottom-right-radius:4px}
.m.bot,.m.agent{align-self:flex-start;background:var(--c-bg);border:1px solid var(--c-line);border-bottom-left-radius:4px}
.m .who{display:block;font-size:11px;font-weight:700;color:var(--c-muted);margin-bottom:2px}
.m ul{margin:6px 0 0;padding-left:18px}.m li{margin:3px 0}
.sys{align-self:center;text-align:center;font-size:12px;color:var(--c-muted);max-width:90%}
.chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px;background:var(--c-soft)}
.chip{border:1px solid var(--brand,#2563eb);color:var(--brand,#2563eb);background:var(--c-bg);border-radius:99px;padding:6px 12px;font-size:13px;cursor:pointer}
.chip:hover{background:var(--brand,#2563eb);color:#fff}
.foot{border-top:1px solid var(--c-line);padding:10px;background:var(--c-bg)}
form.send{display:flex;gap:8px;align-items:flex-end}
textarea,input{flex:1;width:100%;border:1px solid var(--c-line);border-radius:10px;padding:9px 11px;font-size:14px;background:var(--c-bg);color:var(--c-text);resize:none;max-height:120px}
textarea:focus,input:focus{outline:2px solid var(--brand,#2563eb);outline-offset:-1px}
.go{border:0;background:var(--brand,#2563eb);color:#fff;border-radius:10px;height:38px;padding:0 14px;font-size:14px;font-weight:600;cursor:pointer}
.go:disabled{opacity:.5;cursor:default}
.human{display:block;margin:8px auto 0;background:none;border:0;color:var(--brand,#2563eb);font-size:13px;font-weight:600;cursor:pointer;text-decoration:underline}
.ho{display:grid;gap:8px}.away{margin:0 0 8px;padding:8px 10px;border-radius:10px;background:var(--c-soft);border:1px solid var(--c-line);font-size:13px;line-height:1.45;color:var(--c-text)}.alt-link{display:block;text-align:center;font-size:13px;margin-top:6px;color:var(--brand,#2563eb)}.ho p{margin:0;font-size:13px;color:var(--c-muted)}.ho .row{display:flex;gap:8px}
.err{color:#dc2626;font-size:12px;min-height:0}
.typing{align-self:flex-start;font-size:12px;color:var(--c-muted)}
.attach{flex:none;width:38px;height:38px;border:1px solid var(--c-line);border-radius:10px;background:var(--c-bg);color:var(--c-muted);cursor:pointer;display:flex;align-items:center;justify-content:center}.attach:hover{color:var(--brand,#2563eb);border-color:var(--brand,#2563eb)}.attach svg{width:18px;height:18px}
.m.has-file{padding:4px}.m.has-file .who{padding:4px 8px 0}
.fimg{display:block;max-width:220px;max-height:220px;border-radius:10px}
.fcard{display:flex;align-items:center;gap:10px;padding:8px 10px;color:inherit;text-decoration:none;min-width:180px}.fcard:hover b{text-decoration:underline}
.fcard i{flex:none;width:34px;height:34px;border-radius:8px;background:rgba(127,127,127,.18);display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;font-weight:700}
.fcard span{display:grid;min-width:0}.fcard b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}.fcard small{opacity:.75;font-size:12px}
.fgone{padding:6px 10px;font-size:13px;opacity:.75}
.drop{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;background:rgba(37,99,235,.12);border:3px dashed var(--brand,#2563eb);border-radius:16px;font-weight:700;color:var(--brand,#2563eb);font-size:16px;pointer-events:none}
.drop[hidden]{display:none}
@media (max-width:480px){.panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100%;max-height:100%;border-radius:0}.btn{bottom:${where === 'app' ? '84px' : '16px'};right:16px}}
</style>
<button class="btn" type="button" aria-label="Chat with us"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/></svg><span class="badge" hidden></span></button>
<section class="panel" hidden role="dialog" aria-label="Chat"><div class="top"><div><strong>${esc(C.product)}</strong><small><i class="dot"></i><span class="st"></span></small></div><button class="x" type="button" aria-label="Close chat">×</button></div>
<div class="list" aria-live="polite"></div><div class="drop" hidden>Drop files to send</div><div class="chips"></div><div class="foot"></div></section>`;
    // colors follow the page's light or dark theme
    const theme = () => { const dark = document.documentElement.dataset.theme === 'dark' || (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
      host.style.cssText = dark ? '--c-bg:#121b2f;--c-soft:#0b1220;--c-text:#e2e8f0;--c-muted:#94a3b8;--c-line:#2a3a5a' : '--c-bg:#fff;--c-soft:#f6f8fc;--c-text:#0f172a;--c-muted:#5b6b82;--c-line:#dfe6f0'; };
    theme(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', theme); new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    document.body.appendChild(host);
    $('.btn').addEventListener('click', () => (open ? hide() : show()));
    $('.x').addEventListener('click', hide);
    const panel = $('.panel'); let depth = 0; const drop = (on) => { $('.drop').hidden = !on; };
    panel.addEventListener('dragenter', (e) => { if (!C.files || !e.dataTransfer.types.includes('Files') || (S && S.status === 'closed')) return; e.preventDefault(); depth++; drop(true); });
    panel.addEventListener('dragover', (e) => { if (C.files && e.dataTransfer.types.includes('Files')) e.preventDefault(); });
    panel.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; drop(false); } });
    panel.addEventListener('drop', (e) => { if (!C.files || !e.dataTransfer.files.length) return; e.preventDefault(); depth = 0; drop(false); if (!(S && S.status === 'closed')) sendFiles([...e.dataTransfer.files]); });
    if (S) refresh().then(() => { if (S && ['waiting', 'live'].includes(S.status)) poll(15000); });
  }).catch(() => {});

  const $ = (s) => root.querySelector(s);
  function show() {
    open = true; unread = 0; badge(); $('.panel').hidden = false; $('.btn').setAttribute('aria-expanded', 'true');
    if (!S) { msgs = [{ id: 'g', from: 'bot', text: C.greeting }]; draw(); } else refresh();
    poll(3000); setTimeout(() => { const t = $('textarea'); if (t) t.focus(); }, 50);
  }
  function hide() { open = false; $('.panel').hidden = true; $('.btn').setAttribute('aria-expanded', 'false'); poll(S && ['waiting', 'live'].includes(S.status) ? 15000 : 0); }
  function poll(ms) { clearInterval(timer); timer = ms ? setInterval(refresh, ms) : null; }
  function badge() { const b = $('.badge'); b.hidden = !unread; b.textContent = unread; }
  async function refresh() {
    if (!S) return;
    try {
      const last = msgs.length && msgs[msgs.length - 1].at;
      const r = await api('GET', `/api/chat/${S.id}?token=${encodeURIComponent(S.token)}${last && msgs[0].id !== 'g' ? '&after=' + encodeURIComponent(last) : ''}`);
      merge(r);
    } catch (e) { if (e.status === 404) { S = null; store.set(null); msgs = []; if (open) show(); } }
  }
  function merge(r) {
    const fresh = r.messages.filter((m) => !msgs.some((x) => x.id === m.id));
    if (msgs[0] && msgs[0].id === 'g') msgs = [];
    // a message shown while it was sending (tmp…/up…) is replaced by the saved one, even when a check for new messages brings it back before the send finishes
    const saved = fresh.filter((m) => m.from === 'visitor');
    msgs = msgs.filter((x) => !(/^(tmp|up)/.test(x.id) && saved.some((m) => (x.file ? m.file && m.file.name === x.file.name : m.text === x.text))));
    msgs.push(...fresh.filter((m) => !msgs.some((x) => x.id === m.id))); msgs.sort((a, b) => (a.at < b.at ? -1 : 1));
    S = { ...S, status: r.status, email: r.email }; C.online = r.online; store.set({ id: S.id, token: S.token, status: r.status });
    if (!open && fresh.some((m) => m.from === 'agent')) { unread += fresh.filter((m) => m.from === 'agent').length; badge(); }
    draw();
  }
  function draw() {
    const st = !S || S.status === 'bot' ? 'Ask us anything' : S.status === 'closed' ? 'Chat ended' : C.online ? 'We’re online' : 'Away · leave a message';
    $('.st').textContent = st; $('.dot').classList.toggle('off', !C.online);
    const sig = msgs.map((m) => m.id).join() + '|' + (S ? S.status : '') + '|' + typing;
    if (sig !== shown) { shown = sig;
    $('.list').innerHTML = msgs.map((m) => m.from === 'system' ? `<div class="sys">${esc(m.text)}</div>`
      : `<div class="m ${m.from}${m.file ? ' has-file' : ''}">${m.from === 'agent' ? `<span class="who">${esc(m.agent || 'Support')}</span>` : m.from === 'bot' && S && S.status !== 'bot' ? '<span class="who">Assistant</span>' : ''}${m.file ? fileHtml(m.file) : linkify(m.text)}${m.links ? `<ul>${m.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a></li>`).join('')}</ul>` : ''}</div>`).join('');
    if (typing && S && S.status === 'bot') $('.list').insertAdjacentHTML('beforeend', '<div class="typing">Typing…</div>');
    const l = $('.list'); l.scrollTop = l.scrollHeight; l.querySelectorAll('img').forEach((i) => i.addEventListener('load', () => { l.scrollTop = l.scrollHeight; }, { once: true })); // pictures load after the scroll
    $('.chips').innerHTML = !msgs.some((m) => m.from === 'visitor') && C.suggestions.length ? C.suggestions.map((q) => `<button class="chip" type="button">${esc(q)}</button>`).join('') : '';
    root.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => sendText(b.textContent)));
    }
    drawFoot();
  }
  // the footer is rebuilt only when it has to change (chat ended, the "talk to a person" form, the bot handing over); a draft and focus carry over
  function drawFoot() {
    const mode = (S && S.status === 'closed' ? 'closed' : handoff ? 'handoff' : !S || S.status === 'bot' ? 'bot' : 'live') + (C.online ? '' : '-away');
    if (mode === footMode) return;
    const f = $('.foot'); const old = f.querySelector('textarea'); const draft = old ? old.value : ''; const focused = old && root.activeElement === old;
    footMode = mode;
    if (mode === 'live' || mode === 'bot') setTimeout(() => { const t = f.querySelector('textarea'); if (t && draft) t.value = draft; if (t && focused) t.focus(); });
    if (S && S.status === 'closed') { f.innerHTML = '<button class="go" type="button" style="width:100%">Start a new chat</button>'; f.querySelector('.go').addEventListener('click', () => { S = null; store.set(null); msgs = []; show(); }); return; }
    const contact = C.contactUrl ? `<a class="alt-link" href="${esc(C.contactUrl)}" target="_blank" rel="noopener">Or use our contact form</a>` : '';
    if (handoff) {
      const p = who(); const need = !C.online;
      f.innerHTML = `<form class="ho">${need ? `<p class="away">${esc(C.offline)}</p>` : '<p>We’ll bring someone in. Add your email in case you leave the page.</p>'}<div class="row"><input name="name" placeholder="Your name" maxlength="100" value="${esc(p.name || '')}" autocomplete="name"><input name="email" type="email" placeholder="Email${need ? '' : ' (optional)'}" ${need ? 'required' : ''} value="${esc(p.email || '')}" autocomplete="email"></div>${need ? '<textarea name="message" rows="3" maxlength="2000" placeholder="Your message" aria-label="Your message"></textarea>' : ''}<div class="err"></div><div class="row"><button class="go" type="submit" style="flex:1">${need ? 'Leave a message' : 'Talk to a person'}</button><button class="go" type="button" style="background:transparent;color:var(--c-muted)">Back</button></div>${need ? contact : ''}</form>`;
      const form = f.querySelector('form'); form.querySelector('button[type=button]').addEventListener('click', () => { handoff = false; drawFoot(); });
      form.addEventListener('submit', async (e) => {
        e.preventDefault(); const b = Object.fromEntries(new FormData(form)); const go = form.querySelector('button[type=submit]'); go.disabled = true;
        try { if (!S) await start(); merge(await api('POST', `/api/chat/${S.id}/human`, { token: S.token, ...b })); handoff = false; drawFoot(); poll(3000); }
        catch (x) { go.disabled = false; form.querySelector('.err').textContent = x.message; }
      });
      form.querySelector('input:not([value]), input[value=""]')?.focus();
      return;
    }
    f.innerHTML = `<form class="send">${C.files ? `<button class="attach" type="button" aria-label="Attach a file" title="Attach a photo or file (up to 10 MB)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg></button><input type="file" multiple hidden accept="${ACCEPT}">` : ''}<textarea rows="1" placeholder="Type a message…" maxlength="2000" aria-label="Message"></textarea><button class="go" type="submit">Send</button></form>${!S || S.status === 'bot' ? `<button class="human" type="button">${C.online ? 'Talk to a person' : 'No one’s available live: leave a message'}</button>` : !C.online ? contact : ''}<div class="err"></div>`;
    const form = f.querySelector('form'); const ta = form.querySelector('textarea');
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener('submit', (e) => { e.preventDefault(); const t = ta.value.trim(); if (t) sendText(t); });
    const h = f.querySelector('.human'); if (h) h.addEventListener('click', () => { handoff = true; drawFoot(); });
    const pick = f.querySelector('input[type=file]');
    if (pick) { f.querySelector('.attach').addEventListener('click', () => pick.click()); pick.addEventListener('change', () => { sendFiles([...pick.files]); pick.value = ''; }); }
    ta.addEventListener('paste', (e) => { const files = [...(e.clipboardData ? e.clipboardData.files : [])]; if (files.length && C.files) { e.preventDefault(); sendFiles(files); } }); // a pasted screenshot
  }
  // ---------- files: photos are shrunk to a JPEG on the device first (fast on a phone connection); up to 3 at a time, 10 MB each ----------
  const ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt';
  const OK_EXT = ACCEPT.split(',').map((x) => x.slice(1));
  const size = (n) => (n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB');
  const fileUrl = (f, dl) => `/api/chat/${S.id}/files/${f.id}?token=${encodeURIComponent(S.token)}${dl ? '&download' : ''}`;
  function fileHtml(f) {
    if (f.deleted) return `<div class="fgone">📎 ${esc(f.name)} (no longer available)</div>`;
    if (f.uploading) return `<div class="fgone">Sending ${esc(f.name)}…</div>`;
    if (f.image) return `<a href="${fileUrl(f)}" target="_blank" rel="noopener"><img class="fimg" src="${fileUrl(f)}" alt="${esc(f.name)}"></a>`;
    return `<a class="fcard" href="${fileUrl(f, true)}" download="${esc(f.name)}"><i>${esc(f.name.split('.').pop().toUpperCase().slice(0, 4))}</i><span><b>${esc(f.name)}</b><small>${size(f.size)} · Download</small></span></a>`;
  }
  async function shrink(file) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return { blob: file, name: file.name };
    try {
      const img = await createImageBitmap(file); const k = Math.min(1, 2000 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
      return blob && blob.size < file.size ? { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg' } : { blob: file, name: file.name };
    } catch (e) { return { blob: file, name: file.name }; } // e.g. an iPhone HEIC photo the browser can't read: sent as it is
  }
  async function sendFiles(list) {
    const err = (t) => { const e = root.querySelector('.err'); if (e) e.textContent = t; };
    err(''); if (!list.length) return;
    if (list.length > 3) { err('Send up to 3 files at a time'); list = list.slice(0, 3); }
    for (const file of list) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!file.name.includes('.') || !OK_EXT.includes(ext)) { err(`${file.name} can’t be sent. Send photos, PDFs, Word or Excel files, CSV or text files.`); continue; }
      const tmp = 'up' + Date.now() + Math.random();
      try {
        if (!S) await start();
        msgs.push({ id: tmp, from: 'visitor', text: '', file: { name: file.name, uploading: true }, at: new Date().toISOString() }); draw();
        const { blob, name } = await shrink(file);
        if (blob.size > 10 * 1024 * 1024) throw new Error(`${file.name} is over 10 MB`);
        const r = await fetch(`/api/chat/${S.id}/files?token=${encodeURIComponent(S.token)}&name=${encodeURIComponent(name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'The file couldn’t be sent');
        msgs = msgs.filter((m) => m.id !== tmp); merge(j);
      } catch (x) { msgs = msgs.filter((m) => m.id !== tmp); draw(); err(x.message); }
    }
  }
  async function start() { const p = who(); const r = await api('POST', '/api/chat/start', { where, page: location.href, ...p }); S = { id: r.id, token: r.token, status: r.status }; store.set(S); msgs = []; merge(r); }
  // the box empties as soon as a message is sent, so the next one can be typed while this one goes out
  async function sendText(text) {
    const ta = $('textarea'); if (ta) { ta.value = ''; ta.style.height = 'auto'; } const er = root.querySelector('.err'); if (er) er.textContent = '';
    const tmp = 'tmp' + Date.now();
    try {
      if (!S) await start();
      msgs.push({ id: tmp, from: 'visitor', text, at: new Date().toISOString() }); typing++; draw();
      const r = await api('POST', `/api/chat/${S.id}/messages`, { token: S.token, text });
      typing--; msgs = msgs.filter((m) => m.id !== tmp); merge(r);
    } catch (x) {
      typing = Math.max(0, typing - 1); msgs = msgs.filter((m) => m.id !== tmp); draw();
      const t2 = $('textarea'); if (t2 && !t2.value) t2.value = text; const e2 = root.querySelector('.err'); if (e2) e2.textContent = x.message;
    }
  }
})();
