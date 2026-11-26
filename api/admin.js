import { requireAuth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { handle, json, readBody } from '../lib/http.js';
import { sendDailyReport, sendTestMessages } from '../lib/slack.js';

export default handle(async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const { action, confirm } = readBody(req);

  if (action === 'slack-test') return json(res, 200, { ok: true, ...(await sendTestMessages()) });
  if (action === 'report') { await sendDailyReport(await db()); return json(res, 200, { ok: true }); }
  if (action === 'reset') {
    if (confirm !== 'RESET') return json(res, 400, { error: 'Type RESET to confirm' });
    const sql = await db();
    await sql.query(`truncate visits, leads`);
    await sql.query(`delete from kv where key like 'meta:%'`);
    return json(res, 200, { ok: true });
  }
  json(res, 400, { error: 'Unknown action' });
});
