// Backup for drop-off alerts. Phones often close a page without telling the site, so any
// form left untouched for 5 minutes gets its drop-off alert here. Runs at most once every
// 2 minutes, piggybacking on normal site traffic (tracking, form saves, dashboard loads).
import { onDropoff, STEP_NAMES } from './alerts.js';

const IDLE = '5 minutes';
const CANT_AFFORD = "I can't afford that level of investment right now";
const ORDER = ['situation', 'problems', 'why_now', 'name', 'phone', 'email', 'capital', 'investment'];

// Furthest question reached, from the saved answers (for visitors with no tracked visit).
function stepFromAnswers(l) {
  const a = { ...(l.answers || {}), name: l.name, phone: l.phone, email: l.email };
  let last = -1;
  ORDER.forEach((k, i) => { if (a[k]) last = i; });
  return Math.min(STEP_NAMES.length, last + 2);
}

export async function sweepDropoffs(sql, { force = false } = {}) {
  try {
    if (!force) {
      const [go] = await sql.query(
        `insert into kv (key, value, updated_at) values ('dropoff-sweep', 'null', now())
         on conflict (key) do update set updated_at = now()
         where kv.updated_at < now() - interval '2 minutes' returning key`);
      if (!go) return 0;
    }
    const rows = await sql.query(
      `update leads l set dropoff_sent = true
       from (
         select l2.id, v.form_step from leads l2 left join visits v on v.id = l2.visit_id
         where not l2.dropoff_sent and not l2.booked
           and l2.updated_at < now() - interval '${IDLE}'
           and l2.updated_at > now() - interval '2 days'
           and (l2.status = 'partial'
                or (l2.status = 'submitted' and (l2.answers->>'investment') is distinct from $1))
         order by l2.updated_at limit 20
       ) x
       where l.id = x.id
       returning l.*, x.form_step as visit_step`, [CANT_AFFORD]);
    for (const lead of rows) {
      const stage = lead.status === 'submitted' ? 'calendar' : 'question';
      const step = Math.max(Number(lead.visit_step) || 0, stepFromAnswers(lead));
      await onDropoff(lead, stage, step, lead.form_seconds);
    }
    return rows.length;
  } catch (e) {
    console.error('Drop-off sweep failed:', e.message);
    return 0;
  }
}
