// Meta ad account numbers via the Marketing API, cached for 10 minutes.
const TTL_MS = 10 * 60 * 1000;

function account() { return String(process.env.META_AD_ACCOUNT_ID || '').trim().replace(/^act_/, ''); }
export const metaConfigured = () => !!(process.env.META_ACCESS_TOKEN && account());

async function graph(path, params) {
  const v = process.env.META_API_VERSION || 'v23.0';
  const qs = new URLSearchParams({ ...params, access_token: process.env.META_ACCESS_TOKEN });
  const r = await fetch(`https://graph.facebook.com/${v}/${path}?${qs}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error?.message || `Meta API error ${r.status}`);
  return j;
}

// Per-ad numbers (for the daily report's ad rankings), cached like the account totals.
export async function metaAdInsights(sql, from, to) {
  if (!metaConfigured()) return { configured: false, ads: [] };
  const acct = account();
  const key = `meta-ads2:${acct}:${from}:${to}`;
  const [cached] = await sql.query(`select value, updated_at from kv where key = $1`, [key]);
  if (cached && Date.now() - new Date(cached.updated_at).getTime() < TTL_MS) return cached.value;
  try {
    const ins = await graph(`act_${acct}/insights`, {
      level: 'ad', limit: '500',
      fields: 'ad_id,ad_name,campaign_name,spend,impressions,reach,frequency,inline_link_clicks,actions',
      time_range: JSON.stringify({ since: from, until: to }),
    });
    const ads = (ins.data || []).map((r) => ({
      id: r.ad_id || null,
      name: r.ad_name || 'Unnamed ad',
      campaign: r.campaign_name || '',
      spend: Number(r.spend || 0),
      impressions: Number(r.impressions || 0),
      reach: Number(r.reach || 0),
      frequency: r.frequency != null ? Number(r.frequency) : null,
      linkClicks: Number(r.inline_link_clicks || 0),
      views3s: action(r.actions, 'video_view'),
    }));
    const value = { configured: true, ads };
    await sql.query(
      `insert into kv (key, value, updated_at) values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`, [key, JSON.stringify(value)]);
    return value;
  } catch (e) {
    console.error('Meta ad insights failed:', e.message);
    return cached ? { ...cached.value, stale: true, error: e.message } : { configured: true, ads: [], error: e.message };
  }
}

const action = (list, type) => Number((list || []).find((a) => a.action_type === type)?.value || 0);

export async function metaInsights(sql, from, to) {
  if (!metaConfigured()) return { configured: false };
  const acct = account();
  const key = `meta2:${acct}:${from}:${to}`;
  const [cached] = await sql.query(`select value, updated_at from kv where key = $1`, [key]);
  if (cached && Date.now() - new Date(cached.updated_at).getTime() < TTL_MS) return cached.value;

  try {
    const [acc, ins] = await Promise.all([
      graph(`act_${acct}`, { fields: 'timezone_name' }),
      graph(`act_${acct}/insights`, {
        level: 'account',
        fields: 'spend,impressions,reach,frequency,inline_link_clicks,actions,video_thruplay_watched_actions',
        time_range: JSON.stringify({ since: from, until: to }),
      }),
    ]);
    const r = ins.data?.[0] || {};
    const value = {
      configured: true,
      timezone: acc.timezone_name || null,
      spend: Number(r.spend || 0),
      impressions: Number(r.impressions || 0),
      reach: Number(r.reach || 0),
      frequency: r.frequency != null ? Number(r.frequency) : null,
      linkClicks: Number(r.inline_link_clicks || 0),
      views3s: action(r.actions, 'video_view'),
      thruplays: action(r.video_thruplay_watched_actions, 'video_view'),
      fetchedAt: new Date().toISOString(),
    };
    await sql.query(
      `insert into kv (key, value, updated_at) values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`, [key, JSON.stringify(value)]);
    return value;
  } catch (e) {
    console.error('Meta insights failed:', e.message);
    if (cached) return { ...cached.value, stale: true, error: e.message };
    return { configured: true, error: e.message };
  }
}
