// Pre-call engagement: how people use the videos on the confirmation page.
import { requireAuth } from '../lib/auth.js';
import { db } from '../lib/db.js';
import { handle, json } from '../lib/http.js';
import { resolvePeriod, rangeWhere } from '../lib/period.js';
import { SECTIONS, VIDEOS } from '../lib/videos.js';

const n = (v) => Number(v) || 0;

export default handle(async (req, res) => {
  if (!requireAuth(req, res)) return;
  const range = resolvePeriod(req.query || {});
  const sql = await db();
  const p1 = [], p2 = [], p3 = [];

  // A "play" = watched at least 2 seconds with the sound on.
  const [[views], perVideo, perView] = await Promise.all([
    sql.query(`select count(*)::int as views from precall_views where ${rangeWhere(range, p1)}`, p1),
    sql.query(
      `select w.video_id, count(*)::int as plays,
              avg(least(w.watched / nullif(w.dur, 0), 1)) filter (where w.dur > 0) as engagement,
              avg(w.watched) as avg_sec, sum(w.watched) as total_sec, max(w.dur) as dur
       from precall_watch w join precall_views v on v.id = w.view_id
       where w.watched >= 2 and ${rangeWhere(range, p2, 'v.created_at')}
       group by w.video_id`, p2),
    sql.query(
      `select count(*)::int as viewers, coalesce(sum(cnt), 0)::int as plays, coalesce(sum(secs), 0) as secs
       from (select w.view_id, count(*) as cnt, sum(w.watched) as secs
             from precall_watch w join precall_views v on v.id = w.view_id
             where w.watched >= 2 and ${rangeWhere(range, p3, 'v.created_at')}
             group by w.view_id) x`, p3),
  ]);

  const stats = Object.fromEntries(perVideo.map((r) => [r.video_id, r]));
  const videos = VIDEOS.map((v, i) => {
    const r = stats[v.id] || {};
    return {
      ...v, order: i, plays: n(r.plays),
      engagement: r.engagement == null ? null : n(r.engagement),
      avgSec: r.avg_sec == null ? null : n(r.avg_sec),
      totalSec: n(r.total_sec), dur: n(r.dur) || null,
    };
  });
  const pv = perView[0] || {};
  json(res, 200, {
    range, sections: SECTIONS, videos,
    views: n(views?.views), viewers: n(pv.viewers), plays: n(pv.plays), watchSec: n(pv.secs),
  });
});
