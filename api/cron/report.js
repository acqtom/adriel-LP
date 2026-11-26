// Daily Slack report, run by the Vercel cron in vercel.json.
// Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set on the project.
import { db } from '../../lib/db.js';
import { handle, json } from '../../lib/http.js';
import { sendDailyReport } from '../../lib/slack.js';
import { sweepDropoffs } from '../../lib/sweep.js';

export default handle(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return json(res, 401, { error: 'Unauthorized' });
  if (!process.env.SLACK_WEBHOOK_DAILY && !process.env.SLACK_WEBHOOK_URL) return json(res, 200, { skipped: 'Slack not connected' });
  const sql = await db();
  await sweepDropoffs(sql, { force: true });
  await sendDailyReport(sql);
  json(res, 200, { ok: true });
});
