// Chat: a chat button on the public site, the help center and inside the business app.
// A bot answers first (your saved answers, AI from the help center when ANTHROPIC_API_KEY is set, or matching help articles);
// "Talk to a person" hands the chat to you in Alpha → Messages → Live chat. Visitors' browsers poll for new messages.
// Chats live in platform.json (P().chats); settings in P().settings.chat.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const tenancy = require('./tenancy');
const helpStore = require('./help-store');

const P = () => tenancy.platform();
const save = () => tenancy.savePlatform();
const id = () => crypto.randomBytes(6).toString('hex');
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const WHERE = ['site', 'help', 'app'];
let notify = () => {}; // set by init: emails you when someone asks for a person, and visitors when you reply while they're away
let agentSeen = 0; // the last time Alpha's Live chat checked in: you're "online" for 90 seconds after
const visitorSeen = new Map(); // chat id -> last poll

const DEFAULTS = {
  on: false, where: ['site', 'help', 'app'], ai: true,
  greeting: 'Hi! 👋 Ask me anything about {product}. I can answer most questions right away, or get you a person.',
  offline: 'No one is available to chat live right now. Leave a message and we’ll reply as soon as possible during business hours{hours}. You can also reach us with our contact form.',
  contactUrl: '{site}/pricing#contact', // the "Contact form" button when no one is available ('' hides it)
  hours: { on: false, tz: 'America/Chicago', days: [1, 2, 3, 4, 5], open: '09:00', close: '17:00' }, // live chat hours: outside them, people see the message above
  answers: [
    { q: 'How much does it cost?', keywords: 'price, pricing, cost, plan, plans, how much', a: 'You can see every plan and what it includes on our pricing page: {site}/pricing' },
    { q: 'Is there a free trial?', keywords: 'trial, free, try', a: 'Ask us about a free trial: tap “Talk to a person” and we’ll set you up.' },
  ],
};
function settings() {
  const s = { ...DEFAULTS, ...(P().settings.chat || {}) };
  s.where = (s.where || []).filter((w) => WHERE.includes(w)); s.answers = Array.isArray(s.answers) ? s.answers : [];
  if (s.offline === 'We’re away right now. Leave your email and we’ll reply there, usually within one business day.') s.offline = DEFAULTS.offline; // the first wording, saved before business hours: use the new one
  s.hours = { ...DEFAULTS.hours, ...(s.hours || {}) };
  return s;
}
const fill = (t) => String(t || '').replace(/\{product\}/g, P().settings.productName).replace(/\{site\}/g, tenancy.platformUrl());
const aiReady = () => !!process.env.ANTHROPIC_API_KEY;
const online = () => Date.now() - agentSeen < 90e3;
// business hours, in the time zone you chose: [weekday 0-6, "HH:MM"] right now there
function nowIn(tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return [['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), `${parts.hour}:${parts.minute}`];
}
const inHours = () => { const h = settings().hours; if (!h.on) return true; try { const [d, t] = nowIn(h.tz); return h.days.includes(d) && t >= h.open && t < h.close; } catch (e) { return true; } };
// someone can chat live: Live chat is open in Alpha (or the pop-out), and it's within business hours if you set them
const available = () => online() && inHours();
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const time12 = (t) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`; };
function hoursText() {
  const h = settings().hours; if (!h.on || !h.days.length) return '';
  const d = [...h.days].sort(); const run = d.every((x, i) => !i || x === d[i - 1] + 1);
  const days = d.length === 7 ? 'every day' : run && d.length > 2 ? `${DAY[d[0]]}–${DAY[d[d.length - 1]]}` : d.map((x) => DAY[x]).join(', ');
  let zone = ''; try { zone = new Intl.DateTimeFormat('en-US', { timeZone: h.tz, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName').value; } catch (e) { /* unknown zone */ }
  return `${days}, ${time12(h.open)}–${time12(h.close)}${zone ? ' ' + zone : ''}`;
}
const awayText = () => fill(settings().offline).replace(/\{hours\}/g, hoursText() ? ` (${hoursText()})` : '');
const contactUrl = () => fill(settings().contactUrl || '');
const chats = () => (P().chats = P().chats || []);

function saveSettings(b) {
  const s = settings(); const out = { ...s };
  if ('on' in b) out.on = !!b.on;
  if ('ai' in b) out.ai = !!b.ai;
  if ('where' in b) out.where = (Array.isArray(b.where) ? b.where : []).filter((w) => WHERE.includes(w));
  if ('greeting' in b) { out.greeting = clip(b.greeting, 500); if (!out.greeting) throw Object.assign(new Error('Write a greeting'), { status: 400 }); }
  if ('offline' in b) out.offline = clip(b.offline, 500) || DEFAULTS.offline;
  if ('contactUrl' in b) { const u = clip(b.contactUrl, 300); if (u && !/^(https?:\/\/|\{site\}|\/)/.test(u)) throw Object.assign(new Error('The contact form link should start with https://, / or {site}'), { status: 400 }); out.contactUrl = u; }
  if ('hours' in b) {
    const h = b.hours || {}; const tm = (v, d) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v || '') ? v : d);
    out.hours = { on: !!h.on, tz: clip(h.tz, 60) || DEFAULTS.hours.tz, days: (Array.isArray(h.days) ? h.days : []).map(Number).filter((x) => x >= 0 && x <= 6), open: tm(h.open, '09:00'), close: tm(h.close, '17:00') };
    try { new Intl.DateTimeFormat('en-US', { timeZone: out.hours.tz }); } catch (e) { throw Object.assign(new Error('Choose a time zone'), { status: 400 }); }
    if (out.hours.on && !out.hours.days.length) throw Object.assign(new Error('Choose the days you’re open'), { status: 400 });
    if (out.hours.on && out.hours.close <= out.hours.open) throw Object.assign(new Error('Closing time must be after opening time'), { status: 400 });
  }
  if ('answers' in b) {
    out.answers = (Array.isArray(b.answers) ? b.answers : []).slice(0, 30).map((x) => ({ q: clip(x.q, 120), keywords: clip(x.keywords, 300), a: clip(x.a, 1500) })).filter((x) => x.q || x.a);
    const bad = out.answers.find((x) => !x.q || !x.a); if (bad) throw Object.assign(new Error('Each saved answer needs a question and an answer'), { status: 400 });
  }
  P().settings.chat = out; save(); return out;
}

// ---------- automated replies ----------
const plain = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => String(s || '').toLowerCase().match(/[a-z0-9']{3,}/g) || [];
const STOP = new Set(['the', 'and', 'for', 'you', 'your', 'how', 'can', 'what', 'with', 'does', 'are', 'this', 'that', 'there', 'have', 'from', 'about', 'when', 'where', 'which', 'will', 'would', 'should', 'could', 'into', 'need', 'want', 'get', 'use']);
function articleMatches(text) {
  const q = words(text).filter((w) => !STOP.has(w)); if (!q.length) return [];
  const H = helpStore.content();
  return H.articles.map((a) => {
    const title = words(fill(a.title)); const sum = words(a.summary); const body = words(plain(a.body));
    const score = q.reduce((s, w) => s + (title.includes(w) ? 5 : 0) + (sum.includes(w) ? 2 : 0) + Math.min(3, body.filter((x) => x === w).length * 0.5), 0);
    return { a, score };
  }).filter((x) => x.score >= 3).sort((x, y) => y.score - x.score).slice(0, 3)
    .map(({ a }) => ({ title: fill(a.title), url: `${tenancy.helpUrl()}/articles/${a.slug}` }));
}
function savedAnswer(text) {
  const t = String(text || '').toLowerCase().trim();
  return settings().answers.find((x) => x.q.toLowerCase() === t || String(x.keywords || '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
    .some((k) => new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(t)));
}
let anthropic = null;
async function aiAnswer(c, text) {
  if (!anthropic) { const Anthropic = require('@anthropic-ai/sdk'); anthropic = new Anthropic(); }
  const H = helpStore.content(); let kb = '';
  for (const a of H.articles) { const piece = `## ${fill(a.title)} (${tenancy.helpUrl()}/articles/${a.slug})\n${fill(plain(a.body))}\n\n`; if (kb.length + piece.length > 120000) break; kb += piece; }
  const plans = P().plans.filter((p) => !p.hidden).map((p) => `- ${p.name}: ${p.price || 'see pricing page'}. ${p.description || ''}`).join('\n');
  const saved = settings().answers.map((x) => `Q: ${fill(x.q)}\nA: ${fill(x.a)}`).join('\n\n');
  const history = c.messages.filter((m) => m.from !== 'system').slice(-10).map((m) => ({ role: m.from === 'visitor' ? 'user' : 'assistant', content: m.text }));
  while (history.length && history[0].role !== 'user') history.shift();
  const r = await anthropic.beta.messages.create({
    model: 'claude-opus-5-5', max_tokens: 2000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { effort: 'low' },
    system: `You are the chat assistant for ${P().settings.productName}, software for field service businesses (quotes, scheduling, invoices, payments). ${c.where === 'app' ? `You're chatting with someone using the app${c.business ? ` for the business "${c.business}"` : ''}.` : 'You’re chatting with a visitor to the website.'}
Answer briefly (under 90 words) in plain, friendly language, using ONLY the facts below. Plain text, no markdown; you may include one or two of the article links below as plain URLs.
If the facts don't answer the question, or it needs a person (billing problems, account changes, bugs, sales negotiation), say so and suggest tapping "Talk to a person". Never invent features, prices or policies.

# Plans
${plans}
Pricing page: ${tenancy.platformUrl()}/pricing

# Saved answers
${saved || '(none)'}

# Help center articles
${kb}`,
    messages: history.length ? history : [{ role: 'user', content: text }],
  });
  if (r.stop_reason === 'refusal') return '';
  return r.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim().slice(0, 2000);
}
async function botReply(c, text) {
  const s = settings(); const ans = savedAnswer(text);
  if (ans) return { text: fill(ans.a) };
  if (s.ai && aiReady()) { try { const t = await aiAnswer(c, text); if (t) return { text: t, ai: true }; } catch (e) { console.error('chat AI:', e.message); } }
  const links = articleMatches(text);
  if (links.length) return { text: links.length === 1 ? 'This article might help:' : 'These articles might help:', links };
  return { text: 'I couldn’t find an answer to that. Want to talk to a person? Tap “Talk to a person” below.', noAnswer: true };
}

// ---------- conversations ----------
const pub = (m) => ({ id: m.id, from: m.from, text: m.text, at: m.at, ...(m.links ? { links: m.links } : {}), ...(m.agent ? { agent: m.agent } : {}) });
const visitorView = (c, after) => ({ id: c.id, status: c.status, online: available(), email: c.email || '', messages: c.messages.filter((m) => !after || m.at > after).map(pub) });
const add = (c, m) => { const msg = { id: id(), at: new Date().toISOString(), ...m }; c.messages.push(msg); c.updatedAt = msg.at; return msg; };
function find(cid, token) { const c = chats().find((x) => x.id === cid); return c && token && c.token === token ? c : null; }
const hits = new Map(); // ip -> timestamps: visitors get 40 messages per 10 minutes
function limited(ip) { const now = Date.now(); const h = (hits.get(ip) || []).filter((t) => now - t < 600e3); if (h.length >= 40) return true; h.push(now); hits.set(ip, h); return false; }

// the visitor's side: /api/chat/... on every address (public site, help center, business app); `ctx` says which address
async function visitorApi(req, res, p, ctx) {
  const send = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
  const s = settings();
  if (p === '/api/chat/config') return send(200, s.on ? { on: true, where: s.where, greeting: fill(s.greeting), suggestions: s.answers.slice(0, 4).map((x) => fill(x.q)), online: available(), contactUrl: contactUrl(), product: P().settings.productName, offline: awayText() } : { on: false });
  if (!s.on) return send(403, { error: 'Chat is turned off' });
  let b = {};
  if (req.method === 'POST') {
    const raw = await new Promise((resolve) => { let d = ''; req.on('data', (x) => { d += x; if (d.length > 20000) req.destroy(); }); req.on('end', () => resolve(d)); });
    try { b = JSON.parse(raw || '{}'); } catch (e) { return send(400, { error: 'Bad request' }); }
  }
  const ip = req.socket.remoteAddress;
  if (req.method === 'POST' && p === '/api/chat/start') {
    if (limited(ip)) return send(429, { error: 'Too many messages. Try again in a few minutes.' });
    const where = WHERE.includes(b.where) ? b.where : 'site'; if (!s.where.includes(where)) return send(403, { error: 'Chat is turned off here' });
    const t = ctx.tenant;
    const c = { id: id(), token: crypto.randomBytes(16).toString('hex'), status: 'bot', where, page: clip(b.page, 300), name: clip(b.name, 100), email: clip(b.email, 200).toLowerCase(),
      business: where === 'app' && t ? t.name : '', tenantId: where === 'app' && t ? t.id : '', createdAt: new Date().toISOString(), messages: [], unread: 0 };
    add(c, { from: 'bot', text: fill(s.greeting) });
    chats().unshift(c); if (chats().length > 1000) P().chats = chats().slice(0, 1000); save();
    return send(200, { token: c.token, ...visitorView(c) });
  }
  const m = /^\/api\/chat\/([a-f0-9]{12})(?:\/(messages|human|read))?$/.exec(p); if (!m) return send(404, { error: 'Not found' });
  const token = req.method === 'GET' ? new URL(req.url, 'http://x').searchParams.get('token') : b.token;
  const c = find(m[1], token); if (!c) return send(404, { error: 'This chat has ended. Start a new one.' });
  visitorSeen.set(c.id, Date.now());
  if (req.method === 'GET' && !m[2]) return send(200, visitorView(c, new URL(req.url, 'http://x').searchParams.get('after') || ''));
  if (req.method !== 'POST') return send(404, { error: 'Not found' });
  if (limited(ip)) return send(429, { error: 'Too many messages. Try again in a few minutes.' });
  if (c.status === 'closed') return send(400, { error: 'This chat has ended. Start a new one.' });
  if (m[2] === 'messages') {
    const text = clip(b.text, 2000); if (!text) return send(400, { error: 'Write a message' });
    const since = c.messages.length ? c.messages[c.messages.length - 1].at : '';
    add(c, { from: 'visitor', text });
    if (c.status === 'bot') { const r = await botReply(c, text); add(c, { from: 'bot', text: r.text, ...(r.links ? { links: r.links } : {}) }); }
    else c.unread = (c.unread || 0) + 1;
    save(); return send(200, visitorView(c, since));
  }
  if (m[2] === 'human') {
    const email = clip(b.email, 200).toLowerCase(); const name = clip(b.name, 100);
    if (!available() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(400, { error: 'Enter your email so we can reply' });
    const note = clip(b.message, 2000); // "leave a message" when no one is available
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(400, { error: 'Check your email address' });
    const since = c.messages[c.messages.length - 1].at;
    if (name) c.name = name; if (email) c.email = email;
    if (c.status === 'bot') {
      c.status = 'waiting'; c.unread = (c.unread || 0) + 1; c.waitingSince = new Date().toISOString();
      if (note) add(c, { from: 'visitor', text: note });
      add(c, { from: 'system', text: available() ? 'Thanks! Someone will be with you shortly. You can keep typing here.' : `Thanks${c.name ? ', ' + c.name.split(/\s+/)[0] : ''}! We got your message and will reply${c.email ? ` to ${c.email}` : ''} as soon as possible${hoursText() ? ` during business hours (${hoursText()})` : ''}. You can add more here.` });
      save(); notify('waiting', c);
    }
    return send(200, visitorView(c, since));
  }
  return send(404, { error: 'Not found' });
}

// ---------- your side (Alpha → Messages → Live chat) ----------
const listRow = (c) => { const last = [...c.messages].reverse().find((m) => m.from !== 'system') || c.messages[c.messages.length - 1];
  return { id: c.id, status: c.status, where: c.where, name: c.name, email: c.email, business: c.business, page: c.page, createdAt: c.createdAt, updatedAt: c.updatedAt, unread: c.unread || 0,
    last: last ? { from: last.from, text: last.text.slice(0, 140) } : null, visitorOnline: Date.now() - (visitorSeen.get(c.id) || 0) < 30e3 }; };
function list() { agentSeen = Date.now(); const avail = inHours(); const order = { waiting: 0, live: 1, bot: 2, closed: 3 }; return { online: true, inHours: avail, hoursText: hoursText(), ai: aiReady(), settings: settings(), chats: chats().slice(0, 200).map(listRow).sort((a, b) => order[a.status] - order[b.status] || (b.updatedAt > a.updatedAt ? 1 : -1)) }; }
function get(cid) { agentSeen = Date.now(); const c = chats().find((x) => x.id === cid); if (!c) throw Object.assign(new Error('Chat not found'), { status: 404 }); if (c.unread) { c.unread = 0; save(); } return { ...listRow(c), messages: c.messages.map(pub) }; }
function reply(cid, text, agent) {
  const c = chats().find((x) => x.id === cid); if (!c) throw Object.assign(new Error('Chat not found'), { status: 404 });
  const t = clip(text, 4000); if (!t) throw Object.assign(new Error('Write a reply'), { status: 400 });
  if (c.status === 'closed') c.status = 'live';
  if (c.status !== 'live') { c.status = 'live'; add(c, { from: 'system', text: `${agent} joined the chat` }); }
  add(c, { from: 'agent', agent, text: t }); c.unread = 0; save();
  // the visitor isn't looking: send the reply by email too
  if (c.email && Date.now() - (visitorSeen.get(c.id) || 0) > 60e3) notify('reply', c, t);
  return get(cid);
}
function close(cid) { const c = chats().find((x) => x.id === cid); if (!c) throw Object.assign(new Error('Chat not found'), { status: 404 }); if (c.status !== 'closed') { c.status = 'closed'; add(c, { from: 'system', text: 'This chat has ended. Start a new one any time.' }); save(); } return get(cid); }
function remove(cid) { P().chats = chats().filter((x) => x.id !== cid); save(); }
const waitingCount = () => chats().filter((c) => c.status === 'waiting' || ((c.status === 'live') && c.unread)).length;

// the chat button script, served on every address
const WIDGET = path.join(__dirname, '..', 'public', 'chat.js');
function handle(req, res, ctx) {
  const p = req.url.split('?')[0];
  if (p === '/chat.js') { res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(fs.readFileSync(WIDGET)); return true; }
  if (!p.startsWith('/api/chat/')) return false;
  visitorApi(req, res, p, ctx).catch((e) => { console.error('chat:', e); if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Something went wrong' })); } });
  return true;
}

module.exports = { init: (o) => { notify = o.notify; }, handle, settings, saveSettings, list, get, reply, close, remove, waitingCount, aiReady };
