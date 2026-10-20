// The help center at help.<platform domain>: articles for anyone using an account, and a contact form for support.
// Public: no login. Articles are edited in the platform console → Help Center (lib/help-store.js); messages join the console's Messages → Contact requests.
const path = require('path');
const crypto = require('crypto');
const express = require('./mini-express');
const tenancy = require('./tenancy');
const store = require('./help-store');
const brandLib = require('./brand');

module.exports = function helpApp(h) {
  // h: helpers from server.js: sendTemplate, normEmail, emails
  const app = express();
  const PUB = path.join(__dirname, '..', 'public');
  const P = () => tenancy.platform();
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/help/info', (req, res) => res.json({ productName: P().settings.productName, brand: brandLib.brand(), siteUrl: tenancy.platformUrl(), canContact: true }));
  app.get('/api/help/content', (req, res) => { const H = store.content(); res.json({ topics: H.topics, articles: H.articles, popular: H.popular, suggested: H.suggested }); });
  // "Was this article helpful?": one vote per article per connection a day, 60 votes an hour; a No can come with a short comment
  const voted = new Map(); const voteHits = new Map(); const commentHits = new Map();
  const within = (m, k, n, ms) => { const now = Date.now(); const l = (m.get(k) || []).filter((t) => now - t < ms); if (l.length >= n) return false; l.push(now); m.set(k, l); return true; };
  app.post('/api/help/feedback', (req, res) => {
    const b = req.body || {}; const ip = req.socket.remoteAddress; const slug = String(b.slug || '');
    try {
      if (b.vote === 'yes' || b.vote === 'no') {
        const k = `${ip}|${slug}`; const at = voted.get(k);
        if (at && Date.now() - at < 864e5) return res.json({ ok: true, counted: false });
        if (!within(voteHits, ip, 60, 3600e3)) return res.status(429).json({ error: 'Too many votes from this connection. Try again later.' });
        store.vote(slug, b.vote === 'yes'); voted.set(k, Date.now());
        if (voted.size > 50000) voted.clear(); // keep memory bounded
      } else if (b.comment) {
        if (!within(commentHits, ip, 10, 3600e3)) return res.status(429).json({ error: 'Too many messages from this connection. Try again later.' });
        store.comment(slug, b.comment);
      } else return res.status(400).json({ error: 'Nothing to send' });
    } catch (e) { return res.status(e.status || 500).json({ error: e.message }); }
    res.json({ ok: true, counted: true });
  });
  // "Contact support" at the bottom of every page: saved for the platform console (Messages → Contact requests) and emailed to the contact address
  const hits = new Map(); // ip -> timestamps: 5 messages per hour per address
  app.post('/api/help/contact', async (req, res) => {
    const b = req.body || {}; if (b.website) return res.json({ ok: true }); // hidden field only bots fill in
    const ip = req.socket.remoteAddress; const now = Date.now(); const mine = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
    if (mine.length >= 5) return res.status(429).json({ error: 'Too many messages from this connection. Try again later.' });
    const str = (k, n) => String(b[k] || '').trim().slice(0, n);
    const m = { id: crypto.randomBytes(6).toString('hex'), at: new Date().toISOString(), source: 'help', name: str('name', 100), email: h.normEmail(b.email).slice(0, 200), phone: str('phone', 40),
      company: str('company', 100), topic: str('topic', 60), page: /^https?:\/\//i.test(str('page', 300)) ? str('page', 300) : '', message: str('message', 4000) };
    if (!m.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) return res.status(400).json({ error: 'Enter your name and a valid email address' });
    if (!m.message) return res.status(400).json({ error: 'Tell us what you need help with' });
    mine.push(now); hits.set(ip, mine);
    P().inquiries = P().inquiries || []; P().inquiries.unshift(m); P().inquiries.length = Math.min(P().inquiries.length, 500); tenancy.savePlatform();
    const to = P().settings.contactEmail;
    if (to) {
      const details = h.emails.details([['Name', m.name], ['Email', m.email], ['Phone', m.phone], ['Business', m.company], ['Topic', m.topic], ['Page', m.page]]);
      const defaultTenant = P().tenants.find((t) => t.id === P().defaultTenantId) || P().tenants[0];
      const sent = await tenancy.run(defaultTenant, () => h.sendTemplate('helpMessage', to, { name: m.name, topic: m.topic || 'question', details, message: m.message }, { server: true, replyTo: m.email })).catch((e) => ({ status: 'failed', detail: e.message }));
      m.emailed = sent.status === 'sent'; tenancy.savePlatform();
    }
    res.json({ ok: true });
  });
  app.get('/brand.js', (req, res) => res.sendFile(path.join(PUB, 'brand.js')));
  app.get('/help.css', (req, res) => res.sendFile(path.join(PUB, 'help.css')));
  app.get('/help.js', (req, res) => res.sendFile(path.join(PUB, 'help.js')));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(PUB, 'help.html'));
  });
  return app;
};
