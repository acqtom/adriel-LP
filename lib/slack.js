// Slack: one incoming webhook per channel (set in Vercel).
import { HttpError } from './http.js';
import { funnelStats, adCounts } from './stats.js';
import { metaInsights } from './meta.js';
import { resolvePeriod } from './period.js';

const HOOKS = {
  daily: 'SLACK_WEBHOOK_DAILY',
  dropoff: 'SLACK_WEBHOOK_DROPOFF',
  scoring: 'SLACK_WEBHOOK_SCORING',
  booked: 'SLACK_WEBHOOK_BOOKED',
  leads: 'SLACK_WEBHOOK_LEADS',
};
export const CHANNEL_NAMES = { daily: 'Daily metrics', dropoff: 'Form drop-offs', scoring: 'Lead scoring', booked: 'Booked calls', leads: 'New inbound leads' };

function hookUrl(channel) {
  return process.env[HOOKS[channel]] || (channel === 'daily' ? process.env.SLACK_WEBHOOK_URL : '') || '';
}

export async function postSlack(channel, text, blocks) {
  const url = hookUrl(channel);
  if (!url) throw new HttpError(400, `Slack ${CHANNEL_NAMES[channel]} isn't connected. Add ${HOOKS[channel]} in Vercel, then redeploy.`);
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(blocks ? { text, blocks } : { text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new HttpError(502, `Slack refused the ${CHANNEL_NAMES[channel]} message (${r.status}).`);
}

// For automatic alerts: never let Slack problems break the visitor's request.
export async function notify(channel, text, blocks) {
  if (!hookUrl(channel)) return;
  try { await postSlack(channel, text, blocks); } catch (e) { console.error('Slack', channel, e.message); }
}

/* ---------- message building ---------- */
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const md = (text) => ({ type: 'mrkdwn', text });
const section = (text) => ({ type: 'section', text: md(text) });
const fields = (pairs) => {
  const f = pairs.filter(([, v]) => v != null && v !== '').map(([k, v]) => md(`*${k}*\n${v}`));
  const out = [];
  for (let i = 0; i < f.length; i += 10) out.push({ type: 'section', fields: f.slice(i, i + 10) });
  return out;
};
const context = (parts) => ({ type: 'context', elements: [md(parts.filter(Boolean).join('  ·  '))] });
const emailLink = (e) => (e ? `<mailto:${esc(e)}|${esc(e)}>` : '');
const cap = (s, n = 1500) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n) + '…' : s; };

export function utmLine(l) {
  const parts = [l.source && `Source: ${esc(l.source)}`, l.campaign && `Campaign: ${esc(l.campaign)}`, l.ad && `Ad: ${esc(l.ad)}`].filter(Boolean);
  return parts.length ? parts.join('  ·  ') : 'No UTM tags (direct or untagged link)';
}
const who = (l) => esc(l.name || 'Someone');
const tierText = (s) => `${s.tier.emoji} ${s.tier.name} (${s.total}/${s.max})`;

export function newApplicationMsg(l, s) {
  const a = l.answers || {};
  const blocks = [
    section(`📥 *New application: ${who(l)}*  ·  ${tierText(s)}`),
    ...fields([
      ['Email', emailLink(l.email)], ['Phone', esc(l.phone)],
      ['Situation', esc(a.situation)], ['Capital', esc(a.capital)],
      ['Can invest $7K–$12K', esc(a.investment)], ['Qualified', s.qualified ? 'Yes ✅' : 'No'],
    ]),
  ];
  if (a.problems) blocks.push(section(`*Main problems they need help with*\n${esc(cap(a.problems))}`));
  if (a.why_now) blocks.push(section(`*Why they want guidance now*\n${esc(cap(a.why_now))}`));
  blocks.push(context([utmLine(l), l.device && cap1(l.device)]));
  return { text: `New application: ${l.name || 'Someone'} · ${s.tier.name} (${s.total}/${s.max})`, blocks };
}

export function leadScoreMsg(l, s) {
  const contact = [emailLink(l.email), esc(l.phone)].filter(Boolean).join('  ·  ');
  const lines = s.reasons.map((r) => `• ${esc(r.label)}: +${r.pts}`).join('\n');
  const blocks = [
    section(`${s.tier.emoji} *${s.tier.name} lead: ${who(l)}*  ·  ${s.total}/${s.max}${contact ? '\n' + contact : ''}`),
    section(lines),
    context([s.qualified ? '✅ Qualified: can invest and has $100k+ for the project' : '❌ Not qualified: needs to be able to invest and have $100k+ for the project']),
  ];
  return { text: `${s.tier.name} lead: ${l.name || 'Someone'} · ${s.total}/${s.max}`, blocks };
}

export function bookedMsg(l, s) {
  const a = l.answers || {};
  const blocks = [
    section(`📅 *Call booked: ${who(l)}*${s ? '  ·  ' + tierText(s) : ''}`),
    ...fields([
      ['Email', emailLink(l.email)], ['Phone', esc(l.phone)],
      ['Capital', esc(a.capital)], ['Situation', esc(a.situation)],
      ['Can invest $7K–$12K', esc(a.investment)],
    ]),
    context([utmLine(l), 'Call time is in Calendly']),
  ];
  return { text: `Call booked: ${l.name || 'Someone'}`, blocks };
}

export function dropoffMsg(l, where, summary, seconds) {
  const a = l.answers || {};
  const blocks = [
    section(`🚪 *Dropped off at: ${esc(where)}*\n${summary}`),
    ...fields([
      ['Email', emailLink(l.email)], ['Phone', esc(l.phone)],
      ['Situation', esc(a.situation)], ['Capital', esc(a.capital)],
      ['Can invest $7K–$12K', esc(a.investment)],
    ]),
    context([l.device && cap1(l.device), utmLine(l), seconds != null && `${Math.round(seconds)}s on the form`]),
  ];
  return { text: `Dropped off at: ${where}`, blocks };
}
function cap1(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

/* ---------- daily report ---------- */
const money = (v) => (v == null ? '–' : '$' + v.toLocaleString('en-US', { maximumFractionDigits: v >= 100 ? 0 : 2 }));
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1).replace(/\.0$/, '') + '%' : '–');
const per = (spend, count) => (spend != null && count ? spend / count : null);

export async function sendDailyReport(sql) {
  const range = resolvePeriod({ period: 'yesterday' });
  const [f, ad, meta] = await Promise.all([
    funnelStats(sql, range), adCounts(sql, range), metaInsights(sql, range.from, range.to),
  ]);
  const s = f.summary;
  const spend = meta.configured && !meta.error ? meta.spend : null;
  const day = new Date(range.from + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const lines = [
    `*Yesterday's report: ${day}*`,
    `Ad spend: ${money(spend)} · Cost per call: ${money(per(spend, ad.booked))} · Cost per qualified call: ${money(per(spend, ad.qualified))}`,
    `Page visits: ${s.visits} · VSL play rate: ${pct(s.plays, s.visits)} · Button click rate: ${pct(s.clickers, s.visits)}`,
    `Form submits: ${s.submitted} · Calls booked: ${s.booked} (${ad.qualified} qualified) · Visit → booked: ${pct(s.booked, s.visits)}`,
  ];
  if (meta.configured && meta.error) lines.push(`_Meta numbers unavailable: ${meta.error}_`);
  await postSlack('daily', lines.join('\n'));
}

/* ---------- test messages (one per channel) ---------- */
export async function sendTestMessages() {
  const lead = {
    name: 'Test Lead', email: 'test@example.com', phone: '+12015550123', device: 'desktop',
    source: 'facebook', campaign: 'Test campaign', ad: 'Test ad',
    answers: {
      situation: "I'm building on a lot right now", capital: '$300k - $500k',
      investment: 'Yes, I have the resources to pay in full',
      problems: 'This is a test message from the dashboard. Permits and budgeting on my first build.',
    },
  };
  const { scoreLead } = await import('./score.js');
  const s = scoreLead(lead.answers, 0.62);
  const sent = [], failed = [];
  const jobs = {
    leads: () => newApplicationMsg(lead, s),
    scoring: () => leadScoreMsg(lead, s),
    booked: () => bookedMsg(lead, s),
    dropoff: () => dropoffMsg(lead, 'the booking calendar', `${who(lead)} submitted the form but didn’t book a call.`, 164),
    daily: () => ({ text: '✅ *Test:* daily metrics will post here every morning.' }),
  };
  for (const [ch, build] of Object.entries(jobs)) {
    if (!hookUrl(ch)) { failed.push(`${CHANNEL_NAMES[ch]} (no ${HOOKS[ch]})`); continue; }
    const m = build();
    try { await postSlack(ch, `[TEST] ${m.text}`, m.blocks && [section('🧪 _Test message from the dashboard_'), ...m.blocks]); sent.push(CHANNEL_NAMES[ch]); }
    catch (e) { failed.push(`${CHANNEL_NAMES[ch]} (${e.message})`); }
  }
  if (!sent.length) throw new HttpError(400, 'No Slack channels are connected: ' + failed.join(', '));
  return { sent, failed };
}
