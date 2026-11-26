import { requireAuth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { handle, json } from '../lib/http.js';
import { metaInsights, metaAdInsights } from '../lib/meta.js';
import { resolvePeriod } from '../lib/period.js';
import { adCounts, channelOptions, funnelStats, siteCountsByAd, vslTrackingStart, QUALIFIED_LABEL, TZ } from '../lib/stats.js';

export default handle(async (req, res) => {
  if (!requireAuth(req, res)) return;
  const q = req.query || {};
  const range = resolvePeriod(q);
  const filters = { ...range, device: q.device || '', channel: q.channel || '' };
  const sql = await db();

  const [funnel, counts, meta, channels, vslStart, metaAds, site] = await Promise.all([
    funnelStats(sql, filters),
    adCounts(sql, range),
    metaInsights(sql, range.from, range.to),
    channelOptions(sql, range),
    vslTrackingStart(sql),
    metaAdInsights(sql, range.from, range.to),
    siteCountsByAd(sql, range),
  ]);
  const ads = (metaAds.ads || []).map((a) => ({ ...a, ...(site[a.name] || { leads: 0, calls: 0, qualified: 0 }) }))
    .sort((a, b) => b.spend - a.spend);

  json(res, 200, { range, timezone: TZ, qualifiedLabel: QUALIFIED_LABEL, meta, ads, adsError: metaAds.error || null, counts, funnel, channels, vslStart });
});
