// Application form on the home page (/assets/apply.js). Saves answers step by step,
// and sends the Slack alerts (new application, lead score, drop-off).
import { db } from '../lib/db.js';
import { handle, json, readBody, str } from '../lib/http.js';
import { onDropoff, onSubmitted } from '../lib/alerts.js';

// answer key -> max length
const ANSWERS = { situation: 300, problems: 5000, why_now: 5000, capital: 100, investment: 200 };

export default handle(async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = readBody(req);
  const v = str(b.v, 64);
  if (!v || !/^[\w-]+$/.test(v)) return json(res, 400, { error: 'Bad visit id' });
  const step = Math.max(1, Math.min(50, Math.round(Number(b.step) || 1)));
  const seconds = Number.isFinite(Number(b.seconds)) ? Math.max(0, Math.min(86400, Math.round(Number(b.seconds)))) : null;
  const sql = await db();

  /* Visitor left the page partway through the form, or on the calendar without booking */
  if (b.left === true) {
    const stage = b.stage === 'calendar' ? 'calendar' : 'question';
    const [lead] = await sql.query(
      `update leads set dropoff_sent = true, form_seconds = coalesce($3, form_seconds), updated_at = now()
       where visit_id = $1 and not dropoff_sent and not booked
         and status = case when $2 = 'calendar' then 'submitted' else 'partial' end
       returning *`, [v, stage, seconds]);
    if (lead) await onDropoff(lead, stage, step, seconds);
    return json(res, 200, { ok: true });
  }

  const done = b.done === true;
  const noCalendar = done && b.noCalendar === true;
  const answers = {};
  for (const [k, max] of Object.entries(ANSWERS)) {
    const val = str(b.answers?.[k], max);
    if (val) answers[k] = val;
  }
  const c = b.contact || {};
  const name = str(c.name, 120), email = str(c.email, 200), phone = str(c.phone, 40);
  const utm = b.utm || {};
  const device = b.device === 'mobile' ? 'mobile' : b.device === 'desktop' ? 'desktop' : null;

  await sql.query(
    `update visits set form_started = true, form_step = greatest(form_step, $2),
       submitted = submitted or $3, no_calendar = no_calendar or $4 where id = $1`,
    [v, step, done, noCalendar]);

  if (!Object.keys(answers).length && !name && !email && !phone) return json(res, 200, { ok: true });

  const [before] = await sql.query(`select status from leads where visit_id = $1`, [v]);
  const [lead] = await sql.query(
    `insert into leads (visit_id, status, name, email, phone, answers, source, campaign, ad, device, form_seconds)
     select $1, $2, $3, $4, $5, $6::jsonb,
            coalesce(nullif(v.source, ''), $7), coalesce(nullif(v.campaign, ''), $8), coalesce(nullif(v.ad, ''), $9),
            coalesce(v.device, $10), $11
     from (select 1) as one left join visits v on v.id = $1
     on conflict (visit_id) do update set
       status = case when leads.status = 'submitted' then 'submitted' else excluded.status end,
       name = coalesce(excluded.name, leads.name),
       email = coalesce(excluded.email, leads.email),
       phone = coalesce(excluded.phone, leads.phone),
       answers = leads.answers || excluded.answers,
       device = coalesce(leads.device, excluded.device),
       form_seconds = coalesce(excluded.form_seconds, leads.form_seconds),
       updated_at = now()
     returning *`,
    [v, done ? 'submitted' : 'partial', name, email, phone, JSON.stringify(answers),
     str(utm.src), str(utm.cmp), str(utm.ad), device, seconds]);

  if (done && before?.status !== 'submitted') await onSubmitted(sql, lead);
  json(res, 200, { ok: true });
});
