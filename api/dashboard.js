import { requireAuth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { handle, json } from '../lib/http.js';
import { metaInsights } from '../lib/meta.js';
import { resolvePeriod } from '../lib/period.js';
import { adCounts, channelOptions, funnelStats, vslTrackingStart, QUALIFIED_MIN, TZ } from '../lib/stats.js';

export default handle(async (req, res) => {
  if (!requireAuth(req, res)) return;
  const q = req.query || {};
  const range = resolvePeriod(q);
  const filters = { ...range, device: q.device || '', channel: q.channel || '' };
  const sql = await db();

  const [funnel, counts, meta, channels, vslStart] = await Promise.all([
    funnelStats(sql, filters),
    adCounts(sql, range),
    metaInsights(sql, range.from, range.to),
    channelOptions(sql, range),
    vslTrackingStart(sql),
  ]);

  json(res, 200, { range, timezone: TZ, qualifiedMin: QUALIFIED_MIN, meta, counts, funnel, channels, vslStart });
});
