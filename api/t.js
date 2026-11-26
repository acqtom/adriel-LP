// Tracking endpoint for the public pages (see /assets/track.js). No login needed.
import { db } from '../lib/db.js';
import { handle, json, readBody, str } from '../lib/http.js';

const num = (v, max) => { const x = Number(v); return Number.isFinite(x) ? Math.min(Math.max(x, 0), max) : 0; };

export default handle(async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = readBody(req);
  const v = str(b.v, 64);
  if (!v || !/^[\w-]+$/.test(v)) return json(res, 400, { error: 'Bad visit id' });
  const sql = await db();

  switch (b.t) {
    case 'visit':
      await sql.query(
        `insert into visits (id, visitor_id, device, source, campaign, ad, referrer, path)
         values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (id) do nothing`,
        [v, str(b.vr, 64), b.dev === 'mobile' ? 'mobile' : 'desktop', str(b.src), str(b.cmp), str(b.ad), str(b.ref, 500), str(b.path, 200)]);
      break;
    case 'click': {
      const key = str(b.b, 30);
      if (!key || !/^[a-z_]+$/.test(key)) break;
      await sql.query(
        `update visits set buttons = case when $2 = any(buttons) then buttons else array_append(buttons, $2) end where id = $1`, [v, key]);
      break;
    }
    case 'vsl':
      await sql.query(
        `update visits set vsl_played = true, vsl_max = greatest(vsl_max, $2), vsl_dur = greatest(vsl_dur, $3) where id = $1`,
        [v, num(b.s, 36000), num(b.d, 36000)]);
      break;
    case 'form':
      await sql.query(
        `update visits set form_started = true, form_step = greatest(form_step, $2) where id = $1`, [v, Math.round(num(b.step, 50))]);
      break;
    case 'booked':
      await sql.query(`update visits set booked = true, booked_at = coalesce(booked_at, now()) where id = $1`, [v]);
      await sql.query(`update leads set booked = true, updated_at = now() where visit_id = $1`, [v]);
      break;
    default:
      return json(res, 400, { error: 'Unknown event' });
  }
  res.statusCode = 204;
  res.end();
});
