// Daily metrics report for Slack: every dashboard card and chart for yesterday,
// compared with the day before.
import { funnelStats, adCounts, siteCountsByAd } from './stats.js';
import { metaInsights, metaAdInsights } from './meta.js';
import { resolvePeriod, addDays, rangeWhere } from './period.js';
import { STEP_NAMES } from './alerts.js';
import { esc } from './slack.js';

const DASHBOARD_URL = 'https://www.propertyhsu.com/dashboard';
const BUTTONS = [['proof', 'Under the proof cards'], ['breakdown', 'Inside a deal breakdown']];

const ratio = (a, b) => (b ? a / b : null);
const money = (v) => (v == null || !isFinite(v) ? '–' : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = (v, dp = 1) => (v == null || !isFinite(v) ? '–' : (v * 100).toFixed(dp).replace(/\.0+$/, '') + '%');
const freq = (v) => (v == null || !isFinite(v) ? '–' : v.toFixed(2));
const int = (n) => (n || 0).toLocaleString('en-US');
const pl = (n, word) => `${int(n)} ${word}${n === 1 ? '' : 's'}`;
const mmss = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// Change vs the day before. better: 'up' | 'down' | 'neutral'
function change(cur, prev, fmt, better) {
  if (cur == null || !isFinite(cur)) return '';
  if (prev == null || !isFinite(prev)) return '';
  if (Math.abs(cur - prev) < 1e-9) return '  _(same)_';
  const dot = better === 'neutral' ? '⚪' : ((cur > prev) === (better === 'up') ? '🟢' : '🔴');
  return `  ${dot} _(was ${fmt(prev)})_`;
}
const target = (v, goal) => (v == null ? '' : v >= goal ? '  ✅' : '  ❌');
const section = (text) => ({ type: 'section', text: { type: 'mrkdwn', text } });
const divider = { type: 'divider' };

export async function buildDailyReport(sql) {
  const y = resolvePeriod({ period: 'yesterday' });
  const d2 = { from: addDays(y.from, -1), to: addDays(y.to, -1) };
  const [f, fp, c, cp, m, mp, mAds, site] = await Promise.all([
    funnelStats(sql, y), funnelStats(sql, d2), adCounts(sql, y), adCounts(sql, d2),
    metaInsights(sql, y.from, y.to), metaInsights(sql, d2.from, d2.to), metaAdInsights(sql, y.from, y.to),
    siteCountsByAd(sql, y),
  ]);
  const day = new Date(y.from + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const blocks = [section(`📊 *Daily metrics: ${day}*`)];

  /* ---- Ad metrics ---- */
  const ok = (x) => x.configured && !x.error && x.spend != null;
  const A = (x, cc) => {
    const has = ok(x), s = has ? x.spend : null;
    return {
      spend: s, freq: has ? x.frequency : null, cpc: has ? ratio(s, x.linkClicks) : null, ctr: has ? ratio(x.linkClicks, x.impressions) : null,
      hook: has ? ratio(x.views3s, x.impressions) : null, ret: has ? ratio(x.thruplays, x.views3s) : null,
      cpl: s != null ? ratio(s, cc.submitted) : null, cpcall: s != null ? ratio(s, cc.booked) : null, cpq: s != null ? ratio(s, cc.qualified) : null,
    };
  };
  const a = A(m, c), ap = A(mp, cp);
  const adLines = [
    `• *Ad spend:* ${money(a.spend)}${change(a.spend, ap.spend, money, 'neutral')}`,
    `• *Frequency:* ${freq(a.freq)}  (${int(m.reach)} people reached)${change(a.freq, ap.freq, freq, 'neutral')}`,
    `• *Cost per click:* ${money(a.cpc)}  (${int(m.linkClicks)} link clicks)${change(a.cpc, ap.cpc, money, 'down')}`,
    `• *Ad CTR:* ${pct(a.ctr, 2)}  (${int(m.impressions)} impressions)${change(a.ctr, ap.ctr, (v) => pct(v, 2), 'up')}`,
    `• *Ad hook rate:* ${pct(a.hook)}${change(a.hook, ap.hook, pct, 'up')}`,
    `• *Ad retention rate:* ${pct(a.ret)}${change(a.ret, ap.ret, pct, 'up')}`,
    `• *Cost per lead:* ${money(a.cpl)}  (${pl(c.submitted, 'lead')})${change(a.cpl, ap.cpl, money, 'down')}`,
    `• *Cost per call:* ${money(a.cpcall)}  (${pl(c.booked, 'call')})${change(a.cpcall, ap.cpcall, money, 'down')}`,
    `• ⭐ *Cost per qualified call:* ${money(a.cpq)}  (${int(c.qualified)} qualified)${change(a.cpq, ap.cpq, money, 'down')}`,
  ];
  if (!m.configured) adLines.push('_Meta isn’t connected yet, so ad numbers are blank._');
  else if (m.error) adLines.push(`_Meta error: ${esc(m.error)}_`);
  blocks.push(section('📣 *Ad metrics*\n' + adLines.join('\n')));

  /* ---- Top 3 ads by cost per qualified call (Meta spend matched to utm_content = ad name) ---- */
  const metaAds = (mAds.ads || []).map((x) => ({ ...x, ...(site[x.name] || { leads: 0, calls: 0, qualified: 0 }) }));
  const ranked = metaAds.filter((x) => x.qualified > 0).map((x) => ({ ...x, cpq: x.spend / x.qualified }))
    .sort((p, q) => p.cpq - q.cpq).slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  blocks.push(section('🏆 *Top 3 ads by cost per qualified call*\n' + (ranked.length
    ? ranked.map((x, i) => `${medals[i]} *${esc(x.name)}*: ${x.qualified} qualified call${x.qualified === 1 ? '' : 's'} at ${money(x.cpq)} each (${money(x.spend)} spend)`).join('\n')
    : 'No ad produced a qualified call yesterday.')));
  blocks.push(divider);

  /* ---- Funnel metrics ---- */
  const s = f.summary, sp = fp.summary;
  if (!s.visits) {
    blocks.push(section('🧭 *Funnel metrics*\nNo visits were recorded.'));
  } else {
    const vb = ratio(s.booked, s.visits), vbp = ratio(sp.booked, sp.visits);
    const play = ratio(s.plays, s.visits), playp = ratio(sp.plays, sp.visits);
    const clk = ratio(s.clickers, s.visits), clkp = ratio(sp.clickers, sp.visits);
    const comp = ratio(s.submitted, s.formStarted), compp = ratio(sp.submitted, sp.formStarted);
    const sb = ratio(s.booked, s.submitted), sbp = ratio(sp.booked, sp.submitted);
    const n = (v) => int(v);
    blocks.push(section('🧭 *Funnel metrics*\n' + [
      `• ⭐ *Visit → booked call:* ${pct(vb, 2)}  (${n(s.booked)} of ${n(s.visits)})${target(vb, 0.03)}  _target 3–5%_${change(vb, vbp, (v) => pct(v, 2), 'up')}`,
      `• *Page visits:* ${n(s.visits)}${change(s.visits, sp.visits, n, 'up')}`,
      `• *VSL play rate:* ${pct(play)}  (${n(s.plays)} pressed play)${target(play, 0.5)}  _target 50%_${change(play, playp, pct, 'up')}`,
      `• *VSL engagement:* ${pct(s.engagement)}${target(s.engagement, 0.5)}  _target 50%_${change(s.engagement, sp.engagement, pct, 'up')}`,
      `• *Button click rate:* ${pct(clk)}  (${n(s.clickers)} clicked)${change(clk, clkp, pct, 'up')}`,
      `• *Form completion:* ${pct(comp)}  (${n(s.submitted)} of ${n(s.formStarted)} who started)${change(comp, compp, pct, 'up')}`,
      `• *Calls booked:* ${n(s.booked)}${change(s.booked, sp.booked, n, 'up')}`,
      `• *Submits that booked:* ${pct(sb)}${target(sb, 0.84)}  _target 84%_${change(sb, sbp, pct, 'up')}`,
    ].join('\n')));
  }
  blocks.push(divider);

  /* ---- Where people left the form ---- */
  const rows = f.steps, N = STEP_NAMES.length;
  const sum = (fn) => rows.reduce((t, r) => t + (fn(r) ? r.n : 0), 0);
  const formLines = STEP_NAMES.map((name, i) => {
    const step = i + 1;
    const reached = sum((r) => r.submitted || r.step >= step);
    const left = step < N ? sum((r) => !r.submitted && r.step === step) : sum((r) => !r.submitted && r.step >= step);
    return `Q${step} ${esc(name)}: *${left}* left of ${reached} (${pct(ratio(left, reached))})`;
  });
  const calReached = sum((r) => r.submitted && !r.noCalendar), calLeft = sum((r) => r.submitted && !r.noCalendar && !r.booked);
  formLines.push(`Calendar (submitted, didn’t book): *${calLeft}* of ${calReached} (${pct(ratio(calLeft, calReached))})`);
  blocks.push(section('🚪 *Where people left the form*\n' + formLines.join('\n')));

  /* ---- VSL watch time ---- */
  const w = f.vsl.watched, plays = w.reduce((t, r) => t + r[1], 0), dur = f.vsl.duration;
  if (!plays) {
    blocks.push(section('🎬 *VSL watch time*\nNo VSL plays with second-by-second tracking yesterday.'));
  } else {
    const avg = w.reduce((t, r) => t + r[0] * r[1], 0) / plays;
    const at = (share) => pct(ratio(w.reduce((t, r) => t + (r[0] >= share * dur ? r[1] : 0), 0), plays), 0);
    blocks.push(section('🎬 *VSL watch time*\n' + [
      `${int(plays)} play${plays === 1 ? '' : 's'} · average watched ${mmss(avg)}${dur ? ` of ${mmss(dur)}` : ''}`,
      dur ? `Still watching at 25%: *${at(0.25)}* · 50%: *${at(0.5)}* · 75%: *${at(0.75)}* · 95%: *${at(0.95)}*` : '',
    ].filter(Boolean).join('\n')));
  }

  /* ---- Button clicks ---- */
  blocks.push(section('👆 *Button clicks*\n' + BUTTONS.map(([k, label]) => {
    const n = f.buttons[k] || 0;
    return `${esc(label)}: *${n}* (${pct(ratio(n, s.visits))})`;
  }).join('\n')));

  /* ---- By ad (Meta) ---- */
  if (metaAds.length) {
    const top = metaAds.slice().sort((p, q) => q.spend - p.spend).slice(0, 8);
    blocks.push(section('💸 *By ad (Meta)*\n' + top.map((x) =>
      `*${esc(x.name)}*: ${money(x.spend)} · freq ${freq(x.frequency)} · CTR ${pct(ratio(x.linkClicks, x.impressions), 2)} · hook ${pct(ratio(x.views3s, x.impressions))} · ${pl(x.leads, 'lead')} · ${pl(x.calls, 'call')} · ${x.qualified} qualified · ${money(ratio(x.spend, x.calls))}/call`
    ).join('\n')));
  }

  /* ---- By ad / source (site) ---- */
  if (f.bySource.length) {
    blocks.push(section('🔗 *By ad / source (site)*\n' + f.bySource.slice(0, 10).map((r) =>
      `*${esc(r.channel)}*: ${pl(r.visits, 'visit')} · ${pl(r.submitted, 'submit')} · ${int(r.booked)} booked`
    ).join('\n')));
  }

  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text:
    `Changes are vs the day before (🟢 better, 🔴 worse). Days run midnight to midnight New York time; Meta uses the ad account’s time zone. Full dashboard: <${DASHBOARD_URL}|propertyhsu.com/dashboard>` }] });

  return { text: `Daily metrics: ${day}`, blocks };
}
