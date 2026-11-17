// Marketing → Plan (part of the Marketing suite): every week, 3 to 5 suggested social posts for the business, written by Claude from its
// trade, services and town, the season, jobs finished lately (with their photos), new good reviews and open days on the schedule.
// Nothing goes out until someone approves it: they check the post, change what they like, pick the day, time and networks, and approve.
// Approved posts are posted at their time by the scheduler (tick, every minute) through the same code as Social posting (h.sendPost).
// A suggestion nobody approved before its time is marked expired. Each post links to the booking page with ?ref=<id>, so visits and
// booking requests from it are counted like a job's post.
// db.planPosts: [{ id, batch, kind, title, caption, ai, jobId, reviewId, picked: [urls] | null, day, time, to: [], status: 'suggested' |
//   'scheduled' | 'posting' | 'posted' | 'failed' | 'skipped' | 'expired', images: [/uploads/post-….jpg], createdAt, approvedAt, by,
//   postedAt, postId, results, error, visits: { 'YYYY-MM': n } }]
// db.planSettings: { on, notify, perWeek, lastBatch: { from, to, at }, uses: { 'YYYY-MM': n }, emailedAt }
const fs = require('fs');
const path = require('path');
const stockPhotos = require('./stock-photos');

const KEEP = 300;
const NETS = ['facebook', 'instagram', 'google', 'linkedin', 'threads', 'pinterest', 'bluesky', 'x', 'tiktok']; // TikTok with the options picked on the card; YouTube needs a video
const KINDS = { showcase: 'Job showcase', review: 'Review shoutout', seasonal: 'Seasonal', tip: 'Helpful tip', openings: 'Open spots', local: 'Local' };
const TONES = { friendly: 'Make it warm and friendly, like a neighbor would say it.', proud: 'Make it proud and upbeat.', professional: 'Make it polished and businesslike.',
  shorter: 'Keep it to one or two short lines plus the hashtags.' };
const MONTHLY_AI = 40; // "Suggest again" (5 each) and "Write it again" (1 each) in a month; the Monday batch doesn't count
const PER_WEEK = [3, 4, 5];
const MAX_PHOTOS = 10;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const weekday = (d) => new Date(d + 'T12:00:00Z').getUTCDay(); // 0 Sunday
const dayName = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

module.exports = (h) => {
  const { db, save, uid, tenancy, aiClient, localNow, pushTo, usersWhoCan, sendTemplate, baseUrl, jobPosts, uploadDir, sendPost, postProblem, connected, bookingRef } = h;
  const items = () => (db.planPosts = db.planPosts || []);
  const settings = () => ({ on: true, notify: true, perWeek: 4, uses: {}, ...(db.planSettings || {}) });
  const setSetting = (o) => { db.planSettings = { ...settings(), ...o }; };
  const included = () => tenancy.has('marketingSuite') && tenancy.has('socialPosts');
  const aiReady = () => !!aiClient() && tenancy.aiOn('aiCaptions');
  const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
  const month = () => localNow().date.slice(0, 7);
  const used = () => (settings().uses || {})[month()] || 0;
  const spend = (n) => { const s = settings(); setSetting({ uses: { [month()]: (s.uses[month()] || 0) + n } }); };
  const nowKey = () => { const n = localNow(); return `${n.date}T${n.time}`; };
  const keyOf = (x) => `${x.day}T${x.time}`;
  const writing = new Set(); // businesses whose batch is being written (one module serves every business)
  const tid = () => tenancy.current().id; const making = () => writing.has(tid());

  // ---------- what Claude is told about the business ----------
  const trade = () => { const c = db.company || {}; return String(c.industryOther || c.industry || '').slice(0, 60); };
  const town = () => { const c = db.company || {}; return [c.addrCity, c.addrState].filter(Boolean).join(', ') || ''; };
  const usedJobs = () => new Set([...items().map((x) => x.jobId), ...(db.jobPosts || []).filter((d) => d.status === 'posted').map((d) => d.jobId)].filter(Boolean));
  const usedReviews = () => new Set(items().map((x) => x.reviewId).filter(Boolean));
  function recentJobs() {
    const since = addDays(localNow().date, -45); const skip = usedJobs();
    return db.jobs.filter((j) => j.status === 'completed' && !skip.has(j.id) && String(j.completedAt || j.date || '').slice(0, 10) >= since)
      .map((j) => ({ j, photos: jobPosts.photosOf(j) })).filter((x) => x.photos.length)
      .sort((a, b) => String(b.j.completedAt || b.j.date).localeCompare(String(a.j.completedAt || a.j.date))).slice(0, 6);
  }
  function goodReviews() {
    const since = new Date(Date.now() - 120 * 864e5).toISOString(); const skip = usedReviews();
    return (db.clientReviews || []).filter((r) => r.submittedAt && r.submittedAt >= since && r.stars >= 4 && String(r.comment || '').trim().length >= 15 && !skip.has(r.id)).slice(-4).reverse();
  }
  // weekdays in the batch with no visits booked: a reason for an "open spots" post
  function openDays(from, to) {
    const out = []; for (let d = from; d <= to; d = addDays(d, 1)) { const wd = weekday(d); if (wd === 0 || wd === 6) continue; if (!db.jobs.some((j) => j.date === d && j.status === 'scheduled')) out.push(d); }
    return out.slice(0, 3);
  }

  // ---------- writing a week's posts ----------
  const SCHEMA = { type: 'object', additionalProperties: false, required: ['posts'], properties: { posts: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['kind', 'title', 'caption', 'art', 'photo', 'jobId', 'reviewId', 'day', 'time'],
    properties: { kind: { type: 'string', enum: Object.keys(KINDS) }, title: { type: 'string' }, caption: { type: 'string' }, art: { type: 'string' }, photo: { type: 'string' }, jobId: { type: 'string' }, reviewId: { type: 'string' },
      day: { type: 'string', format: 'date' }, time: { type: 'string' } } } } } };
  const ruleText = `Rules for every post:
- Base it only on the facts given. Don't invent prices, discounts, offers, brands, guarantees, awards, years in business or details that aren't given.
- Never name or describe a client, the people in photos, a street or a house number. The town is fine. Quote reviews as "a client" or "one of our clients".
- Don't write a phone number or a link: a booking link is added separately.
- A strong first line, one to three short sentences, a short friendly invitation to get in touch, then 3 to 5 relevant local hashtags. An emoji or two is fine. Under 600 characters.`;
  async function callClaude(system, text, schema) {
    const Anthropic = require('@anthropic-ai/sdk');
    let r;
    try {
      r = await aiClient().beta.messages.create({
        model: 'claude-opus-5-5', max_tokens: 16000, output_config: { effort: 'medium', ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', // if the request is declined, the API retries it on a suitable fallback model
        system, messages: [{ role: 'user', content: text }],
      });
    } catch (e) {
      console.error('AI marketing plan failed:', e.message);
      if (e instanceof Anthropic.AuthenticationError) throw fail('The AI service rejected the API key. Ask your administrator to check ANTHROPIC_API_KEY.', 502);
      if (e instanceof Anthropic.RateLimitError) throw fail('The AI is busy right now. Try again in a minute.', 503);
      throw fail('Couldn’t reach the AI service. Try again.', 502);
    }
    if (r.stop_reason === 'refusal') throw fail('The AI couldn’t write this. Try again or write it yourself.', 422);
    if (r.stop_reason === 'max_tokens') throw fail('The AI’s answer was cut off. Try again.', 502);
    return r.content.filter((x) => x.type === 'text').map((x) => x.text).join('').trim();
  }
  function facts(from, to, n) {
    const c = db.company || {}; const jobs = recentJobs(); const revs = goodReviews(); const open = openDays(from, to);
    const services = (db.services || []).filter((s) => s.type !== 'product').map((s) => s.name).filter(Boolean).slice(0, 25);
    const recent = items().filter((x) => ['scheduled', 'posted'].includes(x.status)).slice(0, 10).map((x) => `- ${x.title}`);
    const lines = [`Business: ${c.name || 'a local home service business'}`, c.industry ? `Trade: ${c.industryOther || c.industry}` : '', town() ? `Area: ${town()}${c.addrCountry ? `, ${c.addrCountry}` : ''}` : '',
      services.length ? `Services: ${services.join(', ')}` : '', `Today: ${dayName(localNow().date)}`, `Plan ${n} posts for ${dayName(from)} to ${dayName(to)}. Each "day" must be one of these dates: ${Array.from({ length: 7 }, (_, i) => addDays(from, i)).filter((d) => d <= to).join(', ')}.`,
      jobs.length ? `Jobs finished lately (each has photos; a "showcase" post uses one, with its jobId):\n${jobs.map(({ j, photos }) => { const its = (j.items || []).map((x) => x && String(x.desc || x.name || '').split('\n')[0].slice(0, 60)).filter(Boolean).slice(0, 5); return `- jobId ${j.id}: ${j.title || 'Job'}${its.length ? ` (work: ${its.join(', ')})` : ''}${jobPosts.townOf(j) ? ` in ${jobPosts.townOf(j)}` : ''}, ${photos.length} photo${photos.length === 1 ? '' : 's'}`; }).join('\n')}` : 'No recent jobs with photos.',
      revs.length ? `New good reviews (a "review" post quotes one, with its reviewId):\n${revs.map((r) => `- reviewId ${r.id}: ${r.stars} stars${r.title ? ` for ${String(r.title).slice(0, 60)}` : ''}: "${String(r.comment).replace(/\s+/g, ' ').slice(0, 300)}"`).join('\n')}` : 'No new reviews to share.',
      open.length ? `Weekdays with nothing booked yet (an "openings" post can say there's room on these days): ${open.map(dayName).join(', ')}` : '',
      recent.length ? `Recent posts (don't repeat these ideas):\n${recent.join('\n')}` : ''];
    return { text: lines.filter(Boolean).join('\n\n'), jobs, revs };
  }
  async function aiBatch(from, to, n) {
    const F = facts(from, to, n);
    const system = `You plan social media posts for a local home service business: one week of posts for its Facebook, Instagram, Google Business Profile and similar accounts, for people in its area.
Plan a varied week: use a recent job ("showcase") and a review ("review") when they're given, then fill the rest with seasonal posts (what people in this area need at this time of year, local holidays and weather), helpful tips that show expertise, "openings" when days are open, or "local" posts about the area. No two posts of the same idea. Spread them over different days, at times people scroll (7–9 AM, 12–1 PM or 6–8 PM), as HH:MM 24-hour.
jobId and reviewId: the id from the facts for showcase and review posts, otherwise an empty string. title: a short label for the business owner (under 50 characters), not shown in the post. art: the words printed big on the post's picture, a short headline that catches the eye (2 to 6 words, under 40 characters, no hashtags, emoji or quotes), for example "Is your lawn winter ready?" or "Fall cleanup, done right". photo: 2 to 4 English words to search a stock photo library for a real photo of the post's subject (the thing, place or work, not people's names or the town), for example "gutter cleaning", "autumn lawn leaves" or "modern kitchen remodel"; an empty string for showcase and review posts.
${ruleText}`;
    const out = JSON.parse(await callClaude(system, F.text, SCHEMA));
    return (out.posts || []).slice(0, n).map((p) => ({ kind: KINDS[p.kind] ? p.kind : 'tip', title: String(p.title || '').slice(0, 80), caption: String(p.caption || '').trim().slice(0, 2200), art: String(p.art || '').replace(/[#"“”]/g, '').trim().slice(0, 60), photo: String(p.photo || '').trim().slice(0, 60),
      jobId: F.jobs.some(({ j }) => j.id === p.jobId) ? p.jobId : '', reviewId: F.revs.some((r) => r.id === p.reviewId) ? p.reviewId : '', day: p.day, time: p.time, ai: true }));
  }
  // without AI (no key, or AI captions off in Alpha): posts from recent jobs and reviews, and a general one, for the business to edit
  function plainBatch(n) {
    const name = String((db.company || {}).name || 'us').replace(/\.+$/, ''); const out = []; // "Co." doesn't end a sentence with ".."
    for (const { j } of recentJobs().slice(0, 2)) { const t = jobPosts.townOf(j); out.push({ kind: 'showcase', jobId: j.id, title: j.title || 'Recent job', art: `${j.title || 'Another job'}, done!`.slice(0, 60), caption: `${j.title || 'Another job'}${t ? ` in ${t}` : ''}, done! ✅\n\nNeed a hand with yours? Get in touch with ${name} for a quote.` }); }
    for (const r of goodReviews().slice(0, 1)) out.push({ kind: 'review', reviewId: r.id, title: 'Review shoutout', caption: `⭐️⭐️⭐️⭐️⭐️ “${String(r.comment).trim().slice(0, 300)}”\n\nThank you to one of our clients for the kind words! Need help? Get in touch with ${name}.` });
    const area = town() ? ` in ${town().split(',')[0]}` : '';
    const services = (db.services || []).filter((s) => s.type !== 'product' && s.name).map((s) => s.name);
    for (const s of services.slice(0, 2)) out.push({ kind: 'tip', title: s.slice(0, 60), art: `Need ${s.toLowerCase()}?`.slice(0, 60), photo: s.slice(0, 60), caption: `Thinking about ${s.toLowerCase()}? ${name} can help${area}. Send us a message with what you need and we’ll get back to you with a quote. 👍` });
    out.push({ kind: 'local', title: 'Booking now', photo: trade(), art: `Now booking${area}`, caption: `${name} is booking now${area}. Tell us what you need and we’ll get you a quote. 👋` });
    out.push({ kind: 'local', title: 'Thank you', photo: trade(), art: 'Thank you for a great season!', caption: `A big thank you to everyone${area} who trusted ${name} with their projects this season. 🙏 Need a hand with something? We’re just a message away.` });
    return out.slice(0, n).map((p) => ({ jobId: '', reviewId: '', ai: false, ...p }));
  }
  // spread posts without a good day and time over the batch, one a day where possible
  function placeTimes(list, from, to) {
    const days = []; for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
    const now = nowKey(); const taken = new Set();
    list.forEach((p, i) => {
      if (!DAY_RE.test(p.day || '') || p.day < from || p.day > to) p.day = days[Math.min(days.length - 1, Math.round(i * (days.length - 1) / Math.max(1, list.length - 1)))];
      if (!TIME_RE.test(p.time || '')) p.time = ['08:00', '12:00', '18:30'][i % 3];
      while ((keyOf(p) <= now || taken.has(p.day)) && p.day < to) p.day = addDays(p.day, 1);
      if (keyOf(p) <= now) p.time = '20:00';
      taken.add(p.day);
    });
    return list.filter((p) => keyOf(p) > now);
  }
  // a new batch: the next 7 days from tomorrow (from today on a Monday morning). Suggestions still waiting from earlier batches are replaced.
  async function makeBatch({ manual } = {}) {
    if (!included()) throw fail('The marketing plan is part of the Marketing suite', 403);
    if (making()) throw fail('Your posts are being written. Give it a minute.', 409);
    if (manual && aiReady() && used() + 5 > MONTHLY_AI) throw fail(`You’ve used this month’s ${MONTHLY_AI} AI suggestions. New ones come every Monday, and you can still edit and approve these.`, 429);
    const n = localNow(); const from = weekday(n.date) === 1 && n.hour < 10 ? n.date : addDays(n.date, 1); const to = addDays(from, 6); const count = settings().perWeek;
    const me = tid(); writing.add(me);
    try {
      let list; let ai = false;
      if (aiReady()) { try { list = await aiBatch(from, to, count); ai = true; } catch (e) { if (manual) throw e; console.error('marketing plan:', e.message); } }
      if (!list || !list.length) list = plainBatch(count);
      list = placeTimes(list, from, to);
      if (manual && ai) spend(5);
      const nets = connected().filter((k) => NETS.includes(k)); const at = new Date().toISOString(); const batch = from;
      for (const x of items()) if (x.status === 'suggested') x.status = 'replaced';
      db.planPosts = [...list.map((p) => ({ id: uid(), batch, status: 'suggested', picked: null, to: nets, createdAt: at, ...p })), ...items().filter((x) => x.status !== 'replaced')].slice(0, KEEP);
      setSetting({ lastBatch: { from, to, at } }); save();
      if (!manual) announce(list.length, from);
      return view();
    } finally { writing.delete(me); }
  }
  // tell the people who can post, and email the owner (at most once a day)
  function announce(n, from) {
    if (!n) return;
    pushTo(usersWhoCan('social'), 'jobPost', { title: 'This week’s posts are ready', body: `${n} suggested post${n === 1 ? '' : 's'} for the week of ${dayName(from)}. Check them and approve the ones you like.`, url: '/marketing/plan' });
    const s = settings(); if (!s.notify || (s.emailedAt && Date.now() - new Date(s.emailedAt) < 20 * 3600e3)) return;
    const o = db.users.find((u) => u.role === 'owner'); if (!o || !o.email) return;
    setSetting({ emailedAt: new Date().toISOString() }); save();
    sendTemplate('accountActivity', o.email, { title: `${n} posts are ready for this week`,
      message: `Your marketing plan has ${n} suggested social posts for the week of ${dayName(from)}, written for your business and the season. Check each one in Marketing → Plan, change anything you like, and approve it. Nothing is posted until you approve it.`,
      link: `${baseUrl()}/marketing/plan` }, { server: true }).catch(() => {});
  }

  // ---------- the scheduler (every minute) ----------
  async function tick() {
    if (!included()) return;
    const s = settings(); const n = localNow();
    // the Monday batch, from 6 AM where the business is (or the first time, once the plan is on)
    if (s.on && !making() && n.hour >= 6 && (!s.lastBatch || (weekday(n.date) === 1 && s.lastBatch.from < n.date && Date.now() - new Date(s.lastBatch.at) > 3 * 864e5))) {
      makeBatch().catch((e) => console.error('marketing plan:', e.message));
    }
    const now = nowKey(); let changed = false;
    for (const x of items()) {
      if (x.status === 'suggested' && keyOf(x) < now) { x.status = 'expired'; changed = true; }
      if (x.status === 'posting' && Date.now() - new Date(x.postingAt || 0) > 15 * 60e3) { Object.assign(x, { status: 'failed', error: 'Posting was interrupted. Check your accounts before trying again.' }); changed = true; } // the server restarted mid-post
    }
    if (changed) save();
    for (const x of items().filter((y) => y.status === 'scheduled' && keyOf(y) <= now)) await publish(x);
  }
  async function publish(x) {
    x.status = 'posting'; x.postingAt = new Date().toISOString(); save();
    let post;
    try {
      const bufs = (x.images || []).map((u) => fs.readFileSync(path.join(uploadDir(), path.basename(u))));
      const to = x.to.filter((k) => connected().includes(k));
      if (!to.length) throw fail('None of the networks it was going to is connected now');
      const bad = postProblem({ to, caption: x.caption, bufs }); if (bad) throw fail(bad);
      post = await sendPost({ to, caption: x.caption, images: x.images || [], bufs, ref: bookingRef(x.id), tiktok: x.tiktok, by: x.by ? `${x.by} (Plan)` : 'Marketing plan', planId: x.id });
    } catch (e) { post = null; x.error = e.message; }
    const ok = post && Object.values(post.results).some((r) => r.status === 'posted');
    Object.assign(x, ok ? { status: 'posted', postedAt: post.createdAt, postId: post.id, results: post.results, error: '' } : { status: 'failed', results: post ? post.results : {}, error: x.error || (post && Object.values(post.results)[0].error) || 'It couldn’t be posted' });
    save();
    const failed = post ? Object.entries(post.results).filter(([, r]) => r.status !== 'posted') : [];
    if (!ok || failed.length) pushTo(usersWhoCan('social'), 'jobPost', { title: ok ? 'A scheduled post partly failed' : 'A scheduled post didn’t go out', body: `${x.title}: ${ok ? `not posted to ${failed.map(([k]) => k).join(', ')}` : x.error}`, url: '/marketing/plan' });
  }

  // ---------- for the Plan page ----------
  const jobOf = (x) => x.jobId && db.jobs.find((j) => j.id === x.jobId);
  function photosFor(x) {
    const j = jobOf(x); if (!j) return [];
    const all = jobPosts.photosOf(j); const mine = Array.isArray(x.picked) ? x.picked.filter((u) => all.some((p) => p.url === u)) : null; const picked = mine && x.picked.length ? mine : all.slice(0, 4).map((p) => p.url);
    return all.slice(0, 30).map((p) => ({ ...p, picked: picked.includes(p.url) }));
  }
  function itemView(x) {
    const j = jobOf(x); const r = x.reviewId && (db.clientReviews || []).find((y) => y.id === x.reviewId);
    return { id: x.id, kind: x.kind, kindName: KINDS[x.kind] || 'Post', title: x.title, caption: x.caption, art: x.art || x.title || '', photo: x.photo || [x.title, x.kind === 'tip' ? '' : trade()].filter(Boolean).join(' ').slice(0, 60), bg: x.bg === undefined ? null : x.bg, ai: !!x.ai, day: x.day, time: x.time, to: x.to || [], status: x.status,
      jobId: x.jobId || '', jobTitle: j ? `${j.number ? j.number + ' · ' : ''}${j.title || 'Job'}` : '', review: r ? { stars: r.stars, comment: String(r.comment || '').slice(0, 300) } : null,
      photos: ['suggested', 'expired', 'skipped'].includes(x.status) ? photosFor(x) : [], images: x.images || [], error: x.error || '', results: x.results || {}, postedAt: x.postedAt || '', by: x.by || '',
      visits: Object.values(x.visits || {}).reduce((a, b) => a + b, 0), requests: (db.requests || []).filter((q) => q.fromPost === x.id).length };
  }
  function view() {
    const s = settings(); const since = addDays(localNow().date, -186); // about 6 months back, for the month view
    return { included: included(), ai: aiReady(), booking: tenancy.has('onlineBooking'), making: making(), today: localNow().date, now: nowKey(),
      settings: { on: s.on, notify: s.notify, perWeek: s.perWeek, graphics: s.graphics !== false }, brand: brand(), stock: stockPhotos.ready(), lastBatch: s.lastBatch || null, aiLeft: Math.max(0, MONTHLY_AI - used()), aiMonthly: MONTHLY_AI,
      nets: connected().filter((k) => NETS.includes(k)), kinds: KINDS,
      items: items().filter((x) => !['replaced', 'deleted'].includes(x.status) && (x.day >= since || ['scheduled', 'posting', 'failed', 'suggested'].includes(x.status))).sort((a, b) => keyOf(a).localeCompare(keyOf(b))).map(itemView) };
  }
  // what the browser draws each post's picture with: logo, brand color, name and town
  const brand = () => { const c = db.company || {}; return { name: String(c.name || '').trim(), logo: /^\/uploads\//.test(c.logo || '') ? c.logo : '', color: /^#[0-9a-f]{6}$/i.test(c.brandColor || '') ? c.brandColor : '#0f766e', town: (c.addrCity || '').trim() }; };
  const own = (id) => { const x = items().find((y) => y.id === id); if (!x) throw fail('Post not found', 404); return x; };
  const editable = (x) => { if (!['suggested', 'expired', 'skipped'].includes(x.status)) throw fail(x.status === 'posted' ? 'This post has already gone out' : 'Unschedule it first to change it'); };
  function when(x, b) {
    if (b.day !== undefined) { if (!DAY_RE.test(String(b.day))) throw fail('Pick a day'); x.day = String(b.day); }
    if (b.time !== undefined) { if (!TIME_RE.test(String(b.time))) throw fail('Pick a time'); x.time = String(b.time); }
  }
  async function edit(id, b) {
    const x = own(id); editable(x);
    if (b.caption !== undefined) x.caption = String(b.caption || '').slice(0, 2200);
    if (b.art !== undefined) x.art = String(b.art || '').slice(0, 60);
    if (b.photo !== undefined) x.photo = String(b.photo || '').trim().slice(0, 60);
    if (b.bg !== undefined) x.bg = await stockPhotos.keep(b.bg, uploadDir()); // '' = the brand color; a picked photo is saved in uploads
    if (b.title !== undefined) x.title = String(b.title || '').slice(0, 80);
    if (Array.isArray(b.to)) x.to = b.to.filter((k) => NETS.includes(k));
    if (Array.isArray(b.picked)) { const j = jobOf(x); const all = j ? jobPosts.photosOf(j).map((p) => p.url) : []; const list = b.picked.filter((u) => all.includes(u)); if (list.length > MAX_PHOTOS) throw fail(`Choose up to ${MAX_PHOTOS} photos`); x.picked = list; }
    when(x, b); save(); return itemView(x);
  }
  async function rewrite(id, tone) {
    const x = own(id); editable(x);
    if (!aiReady()) throw fail('Writing posts with AI isn’t available right now', 503);
    if (used() + 1 > MONTHLY_AI) throw fail(`You’ve used this month’s ${MONTHLY_AI} AI rewrites. You can still edit the post yourself.`, 429);
    const j = jobOf(x); const r = x.reviewId && (db.clientReviews || []).find((y) => y.id === x.reviewId); const c = db.company || {};
    const about = [`Business: ${c.name || 'a local home service business'}`, c.industry ? `Trade: ${c.industryOther || c.industry}` : '', town() ? `Area: ${town()}` : '', `Post idea: ${KINDS[x.kind] || 'Post'}: ${x.title}`,
      j ? `Job: ${j.title || ''}${jobPosts.townOf(j) ? ` in ${jobPosts.townOf(j)}` : ''}` : '', r ? `Review (${r.stars} stars): "${String(r.comment || '').slice(0, 300)}"` : '', `Posting on ${dayName(x.day)}`, `The current post:\n${x.caption}`].filter(Boolean).join('\n');
    const text = await callClaude(`You rewrite one social media post for a local home service business. Keep the same idea and facts.
${TONES[tone] || TONES.friendly}
${ruleText}
Reply with the post only: plain text, no quotes, no labels.`, about);
    if (!text) throw fail('The AI returned an empty post. Try again.', 502);
    spend(1); x.caption = text.replace(/^["“](.*)["”]$/s, '$1').slice(0, 2200); x.ai = true; save(); return itemView(x);
  }
  // approve: the photos arrive as JPEGs from the browser (as for Social posting) and are kept in uploads until it's posted
  function approve(id, b, by) {
    const x = own(id); editable(x);
    if (b.caption !== undefined) x.caption = String(b.caption || '').trim().slice(0, 2200);
    if (b.art !== undefined) x.art = String(b.art || '').slice(0, 60);
    when(x, b);
    const to = (Array.isArray(b.to) ? b.to : x.to).filter((k) => NETS.includes(k) && connected().includes(k));
    if (!to.length) throw fail('Choose where to post');
    const imgs = Array.isArray(b.images) ? b.images : []; if (imgs.length > MAX_PHOTOS) throw fail(`Choose up to ${MAX_PHOTOS} photos`);
    const bufs = imgs.map((d) => { const m = /^data:image\/jpeg;base64,(.+)$/.exec(d || ''); if (!m) throw fail('Photos must be JPEG images'); const buf = Buffer.from(m[1], 'base64'); if (buf.length > 8e6) throw fail('Each photo must be under 8 MB'); return buf; });
    const bad = postProblem({ to, caption: x.caption, bufs }); if (bad) throw fail(bad);
    // TikTok: who can see it, comments and the promotional label, chosen for each post as TikTok requires (checked again when it's posted)
    const tt = b.tiktok || {}; if (to.includes('tiktok') && !tt.privacy) throw fail('Choose who can see the TikTok post');
    x.tiktok = to.includes('tiktok') ? { privacy: String(tt.privacy).slice(0, 40), comments: !!tt.comments, brand: !!tt.brand } : null;
    if (keyOf(x) < addDays(localNow().date, -1)) throw fail('Pick a day that hasn’t passed');
    dropImages(x);
    x.images = bufs.map((buf) => { const file = `post-${Date.now()}-${uid()}.jpg`; fs.writeFileSync(path.join(uploadDir(), file), buf); return `/uploads/${file}`; });
    Object.assign(x, { to, status: 'scheduled', approvedAt: new Date().toISOString(), by: by || '', error: '' }); save(); return view();
  }
  const dropImages = (x) => { for (const u of x.images || []) fs.rm(path.join(uploadDir(), path.basename(u)), { force: true }, () => {}); x.images = []; };
  function unschedule(id) {
    const x = own(id); if (!['scheduled', 'failed'].includes(x.status)) throw fail(x.status === 'posted' ? 'This post has already gone out' : 'It isn’t scheduled');
    dropImages(x); x.status = keyOf(x) < nowKey() ? 'expired' : 'suggested'; save(); return view();
  }
  function skip(id) { const x = own(id); if (['posted', 'posting'].includes(x.status)) throw fail('This post has already gone out'); dropImages(x); x.status = 'skipped'; save(); return view(); }
  // a skipped or expired suggestion, back to approve (tomorrow at the same time if its day has passed)
  // delete a skipped or expired post for good: it's hidden but kept, so its job or review isn't suggested again
  function remove(id) { const x = own(id); if (!['skipped', 'expired'].includes(x.status)) throw fail('Only skipped posts can be deleted'); dropImages(x); x.status = 'deleted'; x.caption = ''; save(); return view(); }
  function revive(id) { const x = own(id); if (!['skipped', 'expired'].includes(x.status)) throw fail('It isn’t skipped'); if (keyOf(x) < nowKey()) x.day = addDays(localNow().date, 1); x.status = 'suggested'; save(); return view(); }
  function retry(id) { const x = own(id); if (x.status !== 'failed') throw fail('Only a post that didn’t go out can be tried again'); const n = localNow(); Object.assign(x, { status: 'scheduled', day: n.date, time: n.time, error: '' }); save(); return view(); }
  function setSettings(b) {
    const o = {}; if (b.on !== undefined) o.on = !!b.on; if (b.notify !== undefined) o.notify = !!b.notify; if (b.graphics !== undefined) o.graphics = !!b.graphics;
    if (b.perWeek !== undefined) { const n = Number(b.perWeek); if (!PER_WEEK.includes(n)) throw fail('Choose 3, 4 or 5 posts a week'); o.perWeek = n; }
    setSetting(o); save(); return view();
  }
  // a visit to the booking page from a plan post's link (?ref=<id>)
  function visit(ref) { const x = items().find((y) => y.id === ref && y.status === 'posted'); if (!x) return false; const m = new Date().toISOString().slice(0, 7); x.visits = { ...(x.visits || {}), [m]: ((x.visits || {})[m] || 0) + 1 }; save(); return true; }
  const refOf = (ref) => (items().some((y) => y.id === ref && y.status === 'posted') ? ref : '');
  const monthVisits = () => { const m = {}; for (const x of items()) for (const [k, n] of Object.entries(x.visits || {})) m[k] = (m[k] || 0) + n; return m; };
  const counts = () => ({ suggested: items().filter((x) => x.status === 'suggested').length, scheduled: items().filter((x) => x.status === 'scheduled').length, failed: items().filter((x) => x.status === 'failed').length });

  return { tick, makeBatch, view, edit, rewrite, approve, unschedule, skip, remove, revive, retry, setSettings, visit, refOf, monthVisits, counts, NETS };
};
