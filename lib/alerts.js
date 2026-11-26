// Slack alerts triggered by the application form and bookings.
import { scoreLead } from './score.js';
import { notify, newApplicationMsg, leadScoreMsg, bookedMsg, dropoffMsg, esc } from './slack.js';

// Short names for each form question, in order (step 1 = first question).
export const STEP_NAMES = [
  'Which situation best describes you?',
  'Main problems they need help with',
  'Why they want guidance now',
  'First name',
  'Phone number',
  'Email',
  'Capital for the project',
  'Can they invest $7K–$12K?',
];

async function vslShare(sql, visitId) {
  const [v] = await sql.query(`select vsl_played, vsl_max, vsl_dur from visits where id = $1`, [visitId]);
  if (!v || !v.vsl_played || !(v.vsl_dur > 0)) return null;
  return Math.min(1, v.vsl_max / v.vsl_dur);
}

export async function scoreAndStore(sql, lead) {
  const s = scoreLead(lead.answers || {}, await vslShare(sql, lead.visit_id));
  await sql.query(`update leads set score = $2 where id = $1`, [lead.id, s.total]);
  return s;
}

export async function onSubmitted(sql, lead) {
  const s = await scoreAndStore(sql, lead);
  const app = newApplicationMsg(lead, s);
  const sc = leadScoreMsg(lead, s);
  await Promise.all([notify('leads', app.text, app.blocks), notify('scoring', sc.text, sc.blocks)]);
}

export async function onBooked(sql, lead) {
  const s = scoreLead(lead.answers || {}, await vslShare(sql, lead.visit_id));
  const m = bookedMsg(lead, s);
  await notify('booked', m.text, m.blocks);
}

// stage: 'calendar' (submitted, left without booking) or 'question' (left partway through)
export async function onDropoff(lead, stage, step, seconds) {
  const name = esc(lead.name || 'Someone');
  let where, summary;
  if (stage === 'calendar') {
    where = 'the booking calendar';
    summary = `${name} submitted the form but didn’t book a call.`;
  } else {
    const i = Math.max(1, Math.min(STEP_NAMES.length, step || 1));
    where = `question ${i} (${STEP_NAMES[i - 1]})`;
    summary = `${name} answered ${i - 1} of ${STEP_NAMES.length} questions, then left.`;
  }
  const m = dropoffMsg(lead, where, summary, seconds);
  await notify('dropoff', m.text, m.blocks);
}
