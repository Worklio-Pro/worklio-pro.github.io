// Every job markets itself (plan feature jobPosts, alongside Social media posts). When a job is completed and has photos, a post is
// drafted for Marketing → Ready to post: the job's photos (before and after first) and a caption Claude writes from the photos and the job.
// Nothing goes out until someone who can post (Social posts permission) approves it there; it's then posted through POST /api/social-posts
// with its draftId, to the networks they tick. Each post links to the booking page with ?ref=<draft id>, so visits and booking requests
// from posts are counted for Results and the results email on the 1st. Captions never name the client or the street: only the town.
// db.jobPosts: [{ id, jobId, status: 'writing' | 'ready' | 'posted' | 'skipped', caption, ai, picked: [urls] | null, createdAt,
//   postedAt, postId, by, visits: { 'YYYY-MM': n } }]; db.jobPostSettings: { on, notify, emailedAt, reportSent: 'YYYY-MM' }
const fs = require('fs');
const path = require('path');

const KEEP = 200; // drafts kept (posted and skipped ones drop off the end)
const LATE_DAYS = 14; // photos added this long after a job was completed still make a draft
const MAX_PHOTOS = 10; const DEFAULT_PHOTOS = 4; const AI_PHOTOS = 4;
const TYPE_ORDER = { before: 0, after: 1, progress: 2 };
const MEDIA = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const TONES = { friendly: 'Make it warm and friendly, like a neighbor would say it.', proud: 'Make it proud and upbeat about the work.', professional: 'Make it polished and businesslike.',
  shorter: 'Keep it to one or two short lines plus the hashtags.' };

module.exports = (h) => {
  const { db, save, uid, tenancy, uploadDir, findClient, aiClient, pushTo, usersWhoCan, sendTemplate, baseUrl, localNow } = h;
  const drafts = () => (db.jobPosts = db.jobPosts || []);
  const settings = () => ({ on: true, notify: true, ...(db.jobPostSettings || {}) });
  const setSetting = (o) => { db.jobPostSettings = { ...settings(), ...o }; };
  const included = () => tenancy.has('jobPosts') && tenancy.has('socialPosts');
  const isOn = () => included() && settings().on;
  const aiReady = () => !!aiClient() && tenancy.aiOn('aiCaptions');
  const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
  const month = (at) => String(at || '').slice(0, 7);

  // the town of the job (or the client's address), never the street: "88 Main St, Houston, TX 77002" → "Houston"
  function townOf(j) {
    const c = findClient(j.clientId) || {};
    for (const a of [j.address, c.address]) {
      const parts = String(a || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 3 && /[a-z]/i.test(parts[parts.length - 2])) return parts[parts.length - 2].slice(0, 60);
    }
    return '';
  }
  // every photo on the job: Project Gallery photos (before, after, then progress), photos in the job's notes, then checklist photos
  function photosOf(j) {
    const out = []; const seen = new Set(); const add = (url, label) => { if (url && !seen.has(url) && MEDIA[(url.split('.').pop() || '').toLowerCase()]) { seen.add(url); out.push({ url, label }); } };
    (db.photos || []).filter((p) => p.jobId === j.id).sort((a, b) => (TYPE_ORDER[a.type] ?? 3) - (TYPE_ORDER[b.type] ?? 3) || String(a.createdAt).localeCompare(String(b.createdAt)))
      .forEach((p) => add(p.file, p.type === 'before' ? 'Before' : p.type === 'after' ? 'After' : 'Progress'));
    for (const n of [...(j.noteEntries || [])].reverse()) if (!n.signed) for (const f of n.files || []) if (f.type === 'image') add(f.url, 'Job note');
    for (const form of j.forms || []) for (const f of form.fields || []) if (f.type === 'photo') for (const p of (form.answers || {})[f.id] || []) add(p.url, form.name || 'Checklist');
    return out;
  }
  const pickedOf = (d, j) => { const all = photosOf(j).map((p) => p.url); const mine = Array.isArray(d.picked) ? d.picked.filter((u) => all.includes(u)) : null; return mine && mine.length ? mine : all.slice(0, DEFAULT_PHOTOS); };
  const jobOf = (d) => db.jobs.find((j) => j.id === d.jobId);

  // ---------- the caption ----------
  // without AI (no key, or AI captions off in Alpha): a plain caption from the job, which the business can edit
  function plainCaption(j) {
    const town = townOf(j); const what = String(j.title || 'Another job').trim();
    return `${what}${town ? ` in ${town}` : ''}, done! ✅ Swipe to see the work.\n\nNeed a hand with yours? Get in touch with ${db.company.name || 'us'} for a quote.`;
  }
  // Claude looks at up to 4 of the photos with what the job was (its title and line items, the trade and the town)
  async function aiCaption(d, j, tone) {
    const images = [];
    for (const url of pickedOf(d, j).slice(0, AI_PHOTOS)) {
      const ext = (url.split('.').pop() || '').toLowerCase(); const file = path.join(uploadDir(), path.basename(url));
      try { const buf = fs.readFileSync(file); if (buf.length < 5e6) images.push({ type: 'image', source: { type: 'base64', media_type: MEDIA[ext], data: buf.toString('base64') } }); } catch (e) { /* the photo was removed */ }
    }
    const items = (j.items || []).map((x) => x && String(x.desc || x.name || '').split('\n')[0].slice(0, 80)).filter(Boolean).slice(0, 8);
    const facts = [`Job: ${j.title || 'not given'}`, items.length ? `Work done: ${items.join(', ')}` : '', townOf(j) ? `Town: ${townOf(j)}` : '',
      db.company.industry ? `Trade: ${db.company.industryOther || db.company.industry}` : '', images.length ? `Photos, in order: ${pickedOf(d, j).slice(0, AI_PHOTOS).map((u) => (photosOf(j).find((p) => p.url === u) || {}).label).join(', ')}` : ''].filter(Boolean).join('\n');
    const Anthropic = require('@anthropic-ai/sdk');
    let r;
    try {
      r = await aiClient().beta.messages.create({
        model: 'claude-opus-5-5', max_tokens: 16000, output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', // if the request is declined, the API retries it on a suitable fallback model
        system: `You write social media posts for ${db.company.name || 'a local service business'}, a local home service business, about a job they just finished. The post goes on their Facebook, Instagram, Google Business Profile and similar accounts, for people in their area.
Write one post: a first line that makes a neighbor stop scrolling, one or two short sentences about the work (what was wrong or what was done, and the result), a short friendly invitation to get in touch, then 3 to 5 relevant local hashtags.
Base it only on the photos and the facts given. Don't invent prices, brands, times, guarantees or details the photos and facts don't show. Never name or describe the client, the people in the photos, the street or the house number; the town is fine. Don't write a phone number or a link: one is added separately. An emoji or two is fine.
${TONES[tone] || TONES.friendly}
Reply with the post only: plain text, no quotes, no labels, under 600 characters.`,
        messages: [{ role: 'user', content: [...images, { type: 'text', text: facts }] }],
      });
    } catch (e) {
      console.error('AI job post caption failed:', e.message);
      if (e instanceof Anthropic.AuthenticationError) throw fail('The AI service rejected the API key. Ask your administrator to check ANTHROPIC_API_KEY.', 502);
      if (e instanceof Anthropic.RateLimitError) throw fail('The AI is busy right now. Try again in a minute.', 503);
      throw fail('Couldn’t reach the AI service. Try again.', 502);
    }
    if (r.stop_reason === 'refusal') throw fail('The AI couldn’t write a caption for these photos. Write it yourself or choose other photos.', 422);
    const text = r.content.filter((x) => x.type === 'text').map((x) => x.text).join('').trim().replace(/^["“](.*)["”]$/s, '$1').slice(0, 2000);
    if (!text) throw fail('The AI returned an empty caption. Try again.', 502);
    return text;
  }

  // ---------- making drafts ----------
  // tell the people who can post (push), and email the owner at most once a day
  function announce(d, j) {
    const town = townOf(j);
    pushTo(usersWhoCan('social'), 'jobPost', { title: 'A post is ready to approve', body: `${j.title || 'A finished job'}${town ? ` in ${town}` : ''}: check the photos and caption, then post it`, url: '/social-posts' });
    const s = settings(); if (!s.notify || (s.emailedAt && Date.now() - new Date(s.emailedAt) < 20 * 3600e3)) return;
    const o = db.users.find((u) => u.role === 'owner'); if (!o || !o.email) return;
    const n = drafts().filter((x) => x.status === 'ready').length;
    setSetting({ emailedAt: new Date().toISOString() }); save();
    sendTemplate('accountActivity', o.email, { title: n > 1 ? `${n} posts are ready to approve` : 'A post is ready to approve',
      message: `${j.title || 'A job'}${town ? ` in ${town}` : ''} is done, and its photos are now a ready-to-post social post with a caption. Check it in Marketing, change anything you like, and post it to your accounts with one tap. Nothing is posted until you approve it.`,
      link: `${baseUrl()}/social-posts` }, { server: true }).catch(() => {});
  }
  async function writeDraft(d, j) {
    try { d.caption = aiReady() ? await aiCaption(d, j) : plainCaption(j); d.ai = aiReady(); } catch (e) { d.caption = plainCaption(j); d.ai = false; }
    d.status = 'ready'; save(); announce(d, j);
  }
  // when a job is completed, or a photo is added to a job completed in the last two weeks: one draft per job, ever
  function maybeDraft(j) {
    if (!j || j.status !== 'completed' || !isOn()) return;
    if (drafts().some((x) => x.jobId === j.id)) return;
    const doneAt = j.completedAt || j.date; // jobs finished before completedAt was kept: their visit date
    if (!doneAt || Date.now() - new Date(doneAt) > LATE_DAYS * 864e5) return;
    if (!photosOf(j).length) return;
    const d = { id: uid(), jobId: j.id, status: 'writing', caption: '', ai: false, picked: null, createdAt: new Date().toISOString() };
    db.jobPosts = [d, ...drafts()].slice(0, KEEP); save();
    writeDraft(d, j).catch((e) => console.error('job post:', e.message));
  }

  // ---------- results ----------
  const reqsFrom = (m) => (db.requests || []).filter((r) => r.fromPost && month(r.createdAt) === m);
  function stats(m) {
    return {
      posts: drafts().filter((d) => d.status === 'posted' && month(d.postedAt) === m).length,
      reviews: (db.clientReviews || []).filter((r) => r.submittedAt && month(r.submittedAt) === m).length,
      visits: drafts().reduce((n, d) => n + ((d.visits || {})[m] || 0), 0),
      requests: reqsFrom(m).length,
    };
  }
  const lastMonth = (date) => { const [y, mo] = date.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`; };
  // a visit to the booking page from a post's link (?ref=<draft id>), and whether a booking request came from one
  function visit(ref) { const d = drafts().find((x) => x.id === ref && x.status === 'posted'); if (!d) return; const m = month(new Date().toISOString()); d.visits = { ...(d.visits || {}), [m]: ((d.visits || {})[m] || 0) + 1 }; save(); }
  const refOf = (ref) => (drafts().some((x) => x.id === ref && x.status === 'posted') ? ref : '');

  // on the 1st (from 8 AM where the business is), once: last month's results to the owner, if anything was posted from a job
  function monthlyReport() {
    if (!included()) return; const now = localNow(); if (!now.date.endsWith('-01') || now.hour < 8) return;
    const m = lastMonth(now.date.slice(0, 7) + '-01'); if (settings().reportSent === m) return;
    setSetting({ reportSent: m }); save();
    const s = stats(m); if (!s.posts) return;
    const o = db.users.find((u) => u.role === 'owner'); if (!o || !o.email) return;
    const name = new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }); const n = (k, one, many) => `${s[k]} ${s[k] === 1 ? one : many}`;
    sendTemplate('accountActivity', o.email, { title: `${name}: your jobs made ${n('posts', 'post', 'posts')}`,
      message: `In ${name}, ${n('posts', 'finished job became a social post', 'finished jobs became social posts')}. ${s.reviews ? `Clients left ${n('reviews', 'review', 'reviews')}. ` : ''}${s.visits ? `People opened your booking page from your posts ${s.visits === 1 ? 'once' : `${s.visits} times`}` : 'Nobody has opened your booking page from a post yet'}${s.requests ? `, and ${n('requests', 'booking request came', 'booking requests came')} in from them.` : '.'} See every post in Marketing.`,
      link: `${baseUrl()}/social-posts` }, { server: true }).catch(() => {});
  }

  // ---------- for the Marketing page ----------
  function draftView(d) {
    const j = jobOf(d) || {}; const picked = j.id ? pickedOf(d, j) : [];
    return { id: d.id, status: d.status, jobId: d.jobId, jobNumber: j.number || '', jobTitle: j.title || 'Job removed', town: j.id ? townOf(j) : '', caption: d.caption, ai: !!d.ai,
      photos: j.id ? photosOf(j).slice(0, 30).map((p) => ({ ...p, picked: picked.includes(p.url) })) : [], createdAt: d.createdAt, postedAt: d.postedAt || '', by: d.by || '',
      visits: Object.values(d.visits || {}).reduce((a, b) => a + b, 0), requests: (db.requests || []).filter((r) => r.fromPost === d.id).length,
      results: d.postId ? ((db.socialPosts || []).find((p) => p.id === d.postId) || {}).results || {} : {} };
  }
  function view() {
    const m = month(new Date().toISOString()); const all = drafts();
    return { included: included(), beta: tenancy.isBeta('jobPosts'), settings: { on: settings().on, notify: settings().notify }, ai: aiReady(), booking: tenancy.has('onlineBooking'),
      ready: all.filter((d) => d.status === 'ready' || d.status === 'writing').map(draftView),
      done: all.filter((d) => d.status === 'posted').slice(0, 12).map(draftView),
      stats: { month: stats(m), last: stats(lastMonth(m + '-01')) } };
  }
  const own = (id) => { const d = drafts().find((x) => x.id === id); if (!d) throw fail('Post not found', 404); return d; };
  function edit(id, b) {
    const d = own(id); if (d.status === 'posted') throw fail('This post has already gone out'); const j = jobOf(d); if (!j) throw fail('The job was removed', 404);
    if (b.caption !== undefined) d.caption = String(b.caption || '').slice(0, 2200);
    if (Array.isArray(b.picked)) { const all = photosOf(j).map((p) => p.url); const list = b.picked.filter((u) => all.includes(u)); if (list.length > MAX_PHOTOS) throw fail(`Choose up to ${MAX_PHOTOS} photos`); d.picked = list; }
    save(); return draftView(d);
  }
  async function rewrite(id, tone) {
    const d = own(id); if (d.status === 'posted') throw fail('This post has already gone out'); const j = jobOf(d); if (!j) throw fail('The job was removed', 404);
    if (!aiReady()) throw fail('Writing captions with AI isn’t available right now', 503);
    d.caption = await aiCaption(d, j, tone); d.ai = true; if (d.status === 'writing') d.status = 'ready'; save(); return draftView(d);
  }
  function skip(id) { const d = own(id); if (d.status === 'posted') throw fail('This post has already gone out'); d.status = 'skipped'; save(); }
  // the post went out (to at least one network) through POST /api/social-posts
  function posted(id, post, by) { const d = drafts().find((x) => x.id === id); if (!d) return; Object.assign(d, { status: 'posted', postedAt: post.createdAt, postId: post.id, by }); }
  // a draft still waiting, for POST /api/social-posts
  const waiting = (id) => drafts().find((x) => x.id === id && x.status === 'ready');
  function setSettings(b) { const o = {}; if (b.on !== undefined) o.on = !!b.on; if (b.notify !== undefined) o.notify = !!b.notify; setSetting(o); save(); return view(); }

  return { maybeDraft, view, edit, rewrite, skip, posted, waiting, setSettings, visit, refOf, monthlyReport, townOf };
};
