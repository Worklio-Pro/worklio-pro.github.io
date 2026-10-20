// The help center at help.<platform domain>: articles for anyone using an account, and a contact form for support.
// Public: no login. The articles live in public/help-articles.js; messages join the console's Contact requests.
const path = require('path');
const crypto = require('crypto');
const express = require('./mini-express');
const tenancy = require('./tenancy');

module.exports = function helpApp(h) {
  // h: helpers from server.js: sendEmail, normEmail
  const app = express();
  const PUB = path.join(__dirname, '..', 'public');
  const P = () => tenancy.platform();
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/help/info', (req, res) => res.json({ productName: P().settings.productName, siteUrl: tenancy.platformUrl(), canContact: true }));
  // "Contact support" at the bottom of every page: saved for the platform console (Settings → Contact requests) and emailed to the contact address
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
      const body = `${m.name} sent a message from the ${P().settings.productName} help center.\n\nName: ${m.name}\nEmail: ${m.email}${m.phone ? `\nPhone: ${m.phone}` : ''}${m.company ? `\nBusiness: ${m.company}` : ''}${m.topic ? `\nTopic: ${m.topic}` : ''}${m.page ? `\nPage: ${m.page}` : ''}\n\n${m.message}\n\nReply to this email to answer ${m.name}.`;
      const defaultTenant = P().tenants.find((t) => t.id === P().defaultTenantId) || P().tenants[0];
      const sent = await tenancy.run(defaultTenant, () => h.sendEmail(to, `Help center: ${m.topic || 'question'} from ${m.name}`, body, { server: true, replyTo: m.email })).catch((e) => ({ status: 'failed', detail: e.message }));
      m.emailed = sent.status === 'sent'; tenancy.savePlatform();
    }
    res.json({ ok: true });
  });
  app.get('/help.css', (req, res) => res.sendFile(path.join(PUB, 'help.css')));
  app.get('/help.js', (req, res) => res.sendFile(path.join(PUB, 'help.js')));
  app.get('/help-articles.js', (req, res) => res.sendFile(path.join(PUB, 'help-articles.js')));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(PUB, 'help.html'));
  });
  return app;
};
