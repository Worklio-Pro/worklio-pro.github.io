// Slack (App Marketplace → Slack): a message in the business's Slack channel when a request comes in, a quote is approved or an invoice is paid.
// The platform's Slack app keys are set in Alpha → Settings → Integrations → Slack (or SLACK_CLIENT_ID / SLACK_CLIENT_SECRET).
// The business clicks Connect, picks a channel on Slack's own page ("Add to Slack" with the incoming-webhook scope), and Slack sends it back
// to /oauth/slack/callback with a webhook address for that channel. The webhook and token live in the account's secrets and never reach the browser.
const crypto = require('crypto');
const social = require('./social');

// what the business can turn on and off, in the order shown
const EVENTS = { request: 'New requests and online bookings', quoteApproved: 'Quotes approved by clients', invoicePaid: 'Invoices paid' };

const fail = (message, status, extra) => Object.assign(new Error(message), { status }, extra || {});
const ready = () => social.ready('slack');

function startUrl(tenantId, userId) {
  const a = social.apps().slack;
  const state = social.sign({ k: 'slack', t: tenantId, u: userId, n: crypto.randomBytes(6).toString('hex'), exp: Date.now() + 15 * 60e3 });
  return 'https://slack.com/oauth/v2/authorize?' + new URLSearchParams({ client_id: a.id, scope: 'incoming-webhook', redirect_uri: social.redirectUri('slack'), state });
}

async function slackApi(method, params) {
  let r;
  try { r = await fetch(`https://slack.com/api/${method}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params), signal: AbortSignal.timeout(20000) }); }
  catch (e) { throw fail('Couldn’t reach Slack. Try again.', 502); }
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw fail(`Slack said: ${j.error || `the request failed (${r.status})`}`, 400);
  return j;
}

// the sign-in code → the channel's webhook
async function connect(code) {
  const a = social.apps().slack;
  const j = await slackApi('oauth.v2.access', { client_id: a.id, client_secret: a.secret, code, redirect_uri: social.redirectUri('slack') });
  const w = j.incoming_webhook || {};
  if (!/^https:\/\/hooks\.slack\.com\//.test(w.url || '')) throw fail('Slack didn’t give us a channel to post to. Connect again and pick a channel.', 400);
  return { webhook: w.url, channel: String(w.channel || '').slice(0, 100), channelId: String(w.channel_id || '').slice(0, 40), configUrl: /^https:\/\//.test(w.configuration_url || '') ? w.configuration_url : '',
    team: String((j.team && j.team.name) || '').slice(0, 100), teamId: String((j.team && j.team.id) || '').slice(0, 40), token: j.access_token || '', connectedAt: new Date().toISOString() };
}

// Slack's answers when the channel or the app is gone: the business has to connect again
const GONE = /no_service|no_team|channel_not_found|channel_is_archived|invalid_token|action_prohibited|team_disabled|no_active_hooks|posting_to_general_channel_denied/;
async function post(conn, text, link) {
  const blocks = [{ type: 'section', text: { type: 'mrkdwn', text } }];
  if (link) blocks.push({ type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: link.label }, url: link.url }] });
  let r;
  try { r = await fetch(conn.webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: text.replace(/\*/g, ''), blocks, unfurl_links: false }), signal: AbortSignal.timeout(15000) }); }
  catch (e) { throw fail('Couldn’t reach Slack', 502); }
  const body = await r.text().catch(() => '');
  if (r.ok) return true;
  if (r.status === 404 || r.status === 410 || r.status === 403 || GONE.test(body)) throw fail('Slack stopped taking messages for this channel (it was removed, archived or the app was uninstalled). Connect Slack again.', 400, { reconnect: true });
  throw fail(`Slack turned the message down (${r.status}${body ? `: ${body.slice(0, 80)}` : ''})`, 502);
}

async function revoke(conn) { if (conn && conn.token) await slackApi('auth.revoke', { token: conn.token }).catch(() => {}); }

// Slack's mrkdwn: &, < and > must be escaped in anything a person typed
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = { EVENTS, ready, startUrl, connect, post, revoke, esc };
