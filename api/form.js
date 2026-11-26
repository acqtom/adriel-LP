// Application form on the home page (/assets/apply.js). Saves answers step by step.
import { db } from '../lib/db.js';
import { handle, json, readBody, str } from '../lib/http.js';

// answer key -> max length
const ANSWERS = { situation: 300, problems: 5000, why_now: 5000, capital: 100, investment: 200 };

export default handle(async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = readBody(req);
  const v = str(b.v, 64);
  if (!v || !/^[\w-]+$/.test(v)) return json(res, 400, { error: 'Bad visit id' });
  const step = Math.max(1, Math.min(50, Math.round(Number(b.step) || 1)));
  const done = b.done === true;
  const noCalendar = done && b.noCalendar === true;

  const answers = {};
  for (const [k, max] of Object.entries(ANSWERS)) {
    const val = str(b.answers?.[k], max);
    if (val) answers[k] = val;
  }
  const c = b.contact || {};
  const name = str(c.name, 120), email = str(c.email, 200), phone = str(c.phone, 40);
  const sms = typeof c.sms === 'boolean' ? c.sms : null;
  if (typeof c.smsMarketing === 'boolean') answers.sms_marketing = c.smsMarketing ? 'Yes' : 'No';
  const utm = b.utm || {};

  const sql = await db();
  await sql.query(
    `update visits set form_started = true, form_step = greatest(form_step, $2),
       submitted = submitted or $3, no_calendar = no_calendar or $4 where id = $1`,
    [v, step, done, noCalendar]);

  if (!Object.keys(answers).length && !name && !email && !phone) return json(res, 200, { ok: true });

  await sql.query(
    `insert into leads (visit_id, status, name, email, phone, sms_consent, answers, source, campaign, ad)
     select $1, $2, $3, $4, $5, $6, $7::jsonb,
            coalesce(nullif(v.source, ''), $8), coalesce(nullif(v.campaign, ''), $9), coalesce(nullif(v.ad, ''), $10)
     from (select 1) as one left join visits v on v.id = $1
     on conflict (visit_id) do update set
       status = case when leads.status = 'submitted' then 'submitted' else excluded.status end,
       name = coalesce(excluded.name, leads.name),
       email = coalesce(excluded.email, leads.email),
       phone = coalesce(excluded.phone, leads.phone),
       sms_consent = coalesce(excluded.sms_consent, leads.sms_consent),
       answers = leads.answers || excluded.answers,
       updated_at = now()`,
    [v, done ? 'submitted' : 'partial', name, email, phone, sms, JSON.stringify(answers),
     str(utm.src), str(utm.cmp), str(utm.ad)]);

  json(res, 200, { ok: true });
});
