// A small IMAP reader (no dependencies): logs in over TLS, finds unread emails whose subject has a tag, hands each one over as
// { from, fromName, subject, text, auto } and marks it read. Used by chat (lib/chat.js) so you can answer chats by replying to the email.
const tls = require('tls');

// one connection; cmd() sends a tagged command and resolves with the untagged lines and any literals ({n} blocks, e.g. a whole email)
function open({ host, port = 993, user, pass }, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const sock = tls.connect({ host, port: Number(port) || 993, servername: host });
    let buf = Buffer.alloc(0); let n = 0; let cur = null; let greeted = false; const queue = [];
    const fail = (e) => { if (cur) { cur.reject(e); cur = null; } else reject(e); sock.destroy(); };
    sock.setTimeout(timeout, () => fail(new Error(`${host} didn’t answer in time`)));
    sock.on('error', (e) => fail(new Error(e.code === 'ENOTFOUND' ? `Can’t find the server ${host}` : e.message)));
    const next = () => { if (cur || !queue.length) return; cur = queue.shift(); sock.write(`${cur.tag} ${cur.line}\r\n`); };
    const api = {
      cmd(line) { return new Promise((res, rej) => { queue.push({ tag: 'A' + (++n), line, res, reject: rej, lines: [], lits: [] }); next(); }); },
      close() { try { sock.write('Z LOGOUT\r\n'); } catch (e) { /* closed */ } setTimeout(() => sock.destroy(), 300); },
    };
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        const i = buf.indexOf('\r\n'); if (i < 0) return;
        const line = buf.slice(0, i).toString('utf8'); const lit = /\{(\d+)\}$/.exec(line);
        if (lit) { const size = Number(lit[1]); if (buf.length < i + 2 + size) return; if (cur) cur.lits.push(buf.slice(i + 2, i + 2 + size)); buf = buf.slice(i + 2 + size); if (cur) cur.lines.push(line); continue; }
        buf = buf.slice(i + 2);
        if (!greeted) { greeted = true; if (/^\* (OK|PREAUTH)/i.test(line)) resolve(api); else fail(new Error('The server refused the connection')); continue; }
        if (!cur) continue;
        if (line.startsWith(cur.tag + ' ')) { const ok = /^\S+ OK/i.test(line); const c = cur; cur = null; ok ? c.res({ lines: c.lines, lits: c.lits }) : c.reject(new Error(line.replace(/^\S+ (NO|BAD)\s*(\[[^\]]*\]\s*)?/i, '') || 'The server said no')); next(); }
        else cur.lines.push(line);
      }
    });
  });
}
const q = (s) => '"' + String(s).replace(/(["\\])/g, '\\$1') + '"';

// log in and look at the inbox (the "Test" button in Alpha)
async function test(box) { const s = await open(box); try { await s.cmd(`LOGIN ${q(box.user)} ${q(box.pass)}`); await s.cmd('SELECT INBOX'); } finally { s.close(); } }

// new emails with `tag` in the subject since the last check: each is parsed and passed to onMail. Only the ones onMail takes (returns true) are marked read;
// the rest (e.g. the chat emails sent to you in this same mailbox) are left as they are. `at` remembers where the last check got to: { validity, uid }.
async function fetchTagged(box, tag, onMail, at = {}, max = 25) {
  const s = await open(box);
  try {
    await s.cmd(`LOGIN ${q(box.user)} ${q(box.pass)}`); const sel = await s.cmd('SELECT INBOX');
    const num = (k) => { const m = new RegExp(`\\[${k} (\\d+)\\]`, 'i').exec(sel.lines.join('\n')); return m ? Number(m[1]) : 0; };
    const validity = num('UIDVALIDITY'); const fresh = !at.uid || at.validity !== validity; // first check (or the mailbox was rebuilt): only unread ones
    const r = await s.cmd(fresh ? `UID SEARCH UNSEEN SUBJECT ${q(tag)}` : `UID SEARCH UID ${at.uid + 1}:* SUBJECT ${q(tag)}`);
    const uids = (r.lines.find((l) => /^\* SEARCH/i.test(l)) || '').replace(/^\* SEARCH/i, '').trim().split(/\s+/).filter(Boolean).map(Number).filter((u) => fresh || u > at.uid).sort((x, y) => x - y).slice(0, max);
    let last = fresh ? Math.max(0, (num('UIDNEXT') || 1) - 1) : at.uid;
    for (const uid of uids) {
      const f = await s.cmd(`UID FETCH ${uid} BODY.PEEK[]`); let took = false;
      try { if (f.lits[0]) took = !!(await onMail(parse(f.lits[0]))); } catch (e) { console.error('chat email reply:', e.message); }
      if (took) await s.cmd(`UID STORE ${uid} +FLAGS (\\Seen)`);
      last = Math.max(last, uid);
    }
    return { validity, uid: last };
  } finally { s.close(); }
}

// ---------- reading an email: headers, the plain-text part (or the HTML one, as text), and the new text above the quoted reply ----------
function decodeWords(s) {
  return String(s || '').replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=(\s+(?==\?))?/gi, (m, cs, enc, t) => {
    try { const b = enc.toLowerCase() === 'b' ? Buffer.from(t, 'base64') : Buffer.from(t.replace(/_/g, ' ').replace(/=([0-9a-f]{2})/gi, (x, h) => String.fromCharCode(parseInt(h, 16))), 'latin1'); return new TextDecoder(cs).decode(b); } catch (e) { return t; }
  });
}
function headers(raw) {
  const h = {}; raw.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach((l) => { const i = l.indexOf(':'); if (i > 0) { const k = l.slice(0, i).trim().toLowerCase(); if (!(k in h)) h[k] = l.slice(i + 1).trim(); } });
  return h;
}
const param = (v, name) => { const m = new RegExp(`${name}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, 'i').exec(v || ''); return m ? (m[2] ?? m[1]) : ''; };
function body(buf, h) {
  const enc = (h['content-transfer-encoding'] || '').toLowerCase(); let b = buf;
  if (enc === 'base64') b = Buffer.from(buf.toString('latin1').replace(/\s+/g, ''), 'base64');
  else if (enc === 'quoted-printable') b = Buffer.from(buf.toString('latin1').replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (x, hx) => String.fromCharCode(parseInt(hx, 16))), 'latin1');
  try { return new TextDecoder(param(h['content-type'], 'charset') || 'utf-8').decode(b); } catch (e) { return b.toString('utf8'); }
}
// the parts of a (possibly nested multipart) message: [{ type, text }]
function parts(buf) {
  const s = buf.toString('latin1'); const i = s.search(/\r?\n\r?\n/); const head = i < 0 ? s : s.slice(0, i);
  const h = headers(head); const start = i < 0 ? s.length : i + (s.slice(i, i + 4) === '\r\n\r\n' ? 4 : 2); const type = (h['content-type'] || 'text/plain').split(';')[0].trim().toLowerCase();
  if (type.startsWith('multipart/')) {
    const bd = param(h['content-type'], 'boundary'); if (!bd) return [];
    return s.slice(start).split('--' + bd).slice(1).filter((p) => !p.startsWith('--')).flatMap((p) => parts(Buffer.from(p.replace(/^\r?\n/, ''), 'latin1')));
  }
  if (/attachment/i.test(h['content-disposition'] || '')) return [];
  return [{ type, h, text: body(buf.slice(start), h) }];
}
const htmlText = (t) => t.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '').replace(/<blockquote[\s\S]*$/i, '').replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
// what the person wrote, without the quoted email under it or their signature
function newText(t) {
  let s = String(t).replace(/\r\n/g, '\n');
  const cuts = [/\n[^\n]*\bOn\b[^\n]*(\n[^\n]*)?\bwrote:\s*\n/, /\n-{2,}\s*(Original Message|Forwarded message)/i, /\n_{6,}\s*\n/, /\n-{3,} ?On .*wrote ?-{3,}/i, /\nFrom: [^\n]+\n(Sent|Date): /i, /\n\s*Le .* a écrit ?:/, /\n\s*El .* escribió:/, /\n-- \n/, /\nSent from my (iPhone|iPad|Android|phone)/i, /\nGet Outlook for /i];
  for (const re of cuts) { const m = re.exec('\n' + s); if (m) s = ('\n' + s).slice(0, m.index).slice(1); }
  return s.split('\n').filter((l) => !/^\s*>/.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function parse(buf) {
  const s = buf.toString('latin1'); const i = s.search(/\r?\n\r?\n/); const h = headers(i < 0 ? s : s.slice(0, i));
  const all = parts(buf); const plain = all.find((p) => p.type === 'text/plain'); const html = all.find((p) => p.type === 'text/html');
  const raw = plain ? plain.text : html ? htmlText(html.text) : '';
  const from = decodeWords(h.from || ''); const addr = (/<([^>]+)>/.exec(from) || [, from])[1].trim().toLowerCase();
  return { from: addr, fromName: from.replace(/<[^>]*>/, '').replace(/"/g, '').trim(), subject: decodeWords(h.subject || ''), text: newText(raw),
    auto: /auto-(replied|generated)/i.test(h['auto-submitted'] || '') || /bulk|junk|auto_reply/i.test(h.precedence || '') || 'x-autoreply' in h || 'x-autorespond' in h || /^(auto|automatic)(matic)? ?reply|out of (the )?office/i.test(decodeWords(h.subject || '')) };
}

module.exports = { test, fetchTagged, parse, newText };
