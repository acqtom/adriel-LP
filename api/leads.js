import { requireAuth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { handle, json } from '../lib/http.js';

export default handle(async (req, res) => {
  if (!requireAuth(req, res)) return;
  const sql = await db();

  if (req.method === 'GET') {
    const rows = await sql.query(
      `select id, visit_id, created_at, updated_at, status, name, email, phone, sms_consent, booked, answers, source, campaign, ad
       from leads order by updated_at desc limit 5000`);
    return json(res, 200, { leads: rows });
  }

  if (req.method === 'DELETE') {
    const id = Number(req.query?.id);
    if (!Number.isInteger(id)) return json(res, 400, { error: 'Bad id' });
    await sql.query(`delete from leads where id = $1`, [id]);
    return json(res, 200, { ok: true });
  }

  json(res, 405, { error: 'Method not allowed' });
});
