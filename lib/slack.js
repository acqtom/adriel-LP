import { HttpError } from './http.js';
import { funnelStats, adCounts } from './stats.js';
import { metaInsights } from './meta.js';
import { resolvePeriod } from './period.js';

export async function postSlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) throw new HttpError(400, 'Slack is not connected. Add SLACK_WEBHOOK_URL in Vercel, then redeploy.');
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!r.ok) throw new HttpError(502, `Slack refused the message (${r.status}).`);
}

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
  await postSlack(lines.join('\n'));
}

export async function sendTestMessages() {
  await postSlack('✅ *Test:* the Adriel HSU dashboard is connected to this channel.');
  await postSlack('📝 *Test: new application*\nJane Example · jane@example.com · +1 555 0100\nCapital: $100K+ · Source: facebook / example-ad');
  await postSlack('📅 *Test: call booked*\nJane Example booked a strategy session.');
}
