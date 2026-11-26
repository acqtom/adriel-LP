import { TZ, rangeWhere } from './period.js';

// Ad / source label: utm_content, else utm_campaign, else utm_source.
export const CHANNEL = `coalesce(nullif(ad, ''), nullif(campaign, ''), nullif(source, ''), 'Direct / none')`;

import { isQualifiedLead } from './score.js';

// Qualified call: booked, can invest in the program and has $100k+ for the project (see lib/score.js).
export const QUALIFIED_LABEL = 'can invest + $100k+ capital';

const n = (v) => Number(v) || 0;

// Funnel numbers: the date range plus the device and ad/source filters.
export async function funnelStats(sql, f) {
  const params = [];
  let w = rangeWhere(f, params);
  if (f.device === 'mobile' || f.device === 'desktop') { params.push(f.device); w += ` and device = $${params.length}`; }
  if (f.channel) { params.push(f.channel); w += ` and ${CHANNEL} = $${params.length}`; }

  const cols = `count(*)::int as visits,
    count(*) filter (where vsl_played)::int as plays,
    avg(least(vsl_max / nullif(vsl_dur, 0), 1)) filter (where vsl_played and vsl_dur > 0) as engagement,
    count(*) filter (where cardinality(buttons) > 0)::int as clickers,
    count(*) filter (where form_started or submitted)::int as form_started,
    count(*) filter (where submitted)::int as submitted,
    count(*) filter (where booked)::int as booked`;

  const [sum, steps, buttons, vsl, bySource] = await Promise.all([
    sql.query(`select ${cols} from visits where ${w}`, params),
    sql.query(`select form_step, submitted, booked, no_calendar, count(*)::int as n from visits
               where ${w} and (form_started or submitted) group by 1, 2, 3, 4`, params),
    sql.query(`select b, count(*)::int as n from visits, unnest(buttons) as b where ${w} group by b`, params),
    sql.query(`select floor(vsl_max)::int as s, count(*)::int as n, max(vsl_dur) as dur from visits
               where ${w} and vsl_played group by 1 order by 1`, params),
    sql.query(`select ${CHANNEL} as channel, ${cols} from visits where ${w} group by 1 order by 2 desc limit 100`, params),
  ]);

  const norm = (r) => ({
    visits: n(r.visits), plays: n(r.plays), engagement: r.engagement == null ? null : n(r.engagement),
    clickers: n(r.clickers), formStarted: n(r.form_started), submitted: n(r.submitted), booked: n(r.booked),
  });

  return {
    summary: norm(sum[0] || {}),
    steps: steps.map((r) => ({ step: n(r.form_step), submitted: !!r.submitted, booked: !!r.booked, noCalendar: !!r.no_calendar, n: n(r.n) })),
    buttons: Object.fromEntries(buttons.map((r) => [r.b, n(r.n)])),
    vsl: {
      watched: vsl.map((r) => [n(r.s), n(r.n)]),
      duration: Math.max(0, ...vsl.map((r) => n(r.dur))),
    },
    bySource: bySource.map((r) => ({ channel: r.channel, ...norm(r) })),
  };
}

// Counts that ad costs divide by: every device and source in the date range.
export async function adCounts(sql, r) {
  const p1 = [], p2 = [];
  const [v] = await sql.query(
    `select count(*) filter (where submitted)::int as submitted, count(*) filter (where booked)::int as booked
     from visits where ${rangeWhere(r, p1)}`, p1);
  const leads = await sql.query(
    `select answers from leads where booked and ${rangeWhere(r, p2)}`, p2);
  return {
    submitted: n(v?.submitted),
    booked: n(v?.booked),
    qualified: leads.filter((l) => isQualifiedLead(l.answers || {})).length,
  };
}

export async function channelOptions(sql, r) {
  const p = [];
  const rows = await sql.query(
    `select ${CHANNEL} as channel, count(*)::int as n from visits where ${rangeWhere(r, p)} group by 1 order by 2 desc limit 100`, p);
  return rows.map((x) => x.channel);
}

export async function vslTrackingStart(sql) {
  const [r] = await sql.query(`select min(created_at) as t from visits where vsl_played`);
  return r?.t || null;
}

export { TZ };
