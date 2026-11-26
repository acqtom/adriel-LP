// Days start at midnight New York time.
export const TZ = 'America/New_York';

export function todayNY() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function addDays(d, n) {
  const t = new Date(d + 'T12:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

const RANGES = { today: [0, 0], yesterday: [-1, -1], '7d': [-6, 0], '30d': [-29, 0], '90d': [-89, 0], '12m': [-364, 0] };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(Date.parse(s));

export function resolvePeriod(q = {}) {
  const t = todayNY();
  if (q.period === 'custom' && isDate(q.from) && isDate(q.to)) {
    let [from, to] = [q.from, q.to];
    if (from > to) [from, to] = [to, from];
    return { period: 'custom', from, to };
  }
  const period = RANGES[q.period] ? q.period : '7d';
  const [a, b] = RANGES[period];
  return { period, from: addDays(t, a), to: addDays(t, b) };
}

// SQL condition: column falls within the [from, to] New York days. Appends its params.
export function rangeWhere(r, params, col = 'created_at') {
  params.push(r.from, r.to);
  const a = params.length - 1, b = params.length;
  return `${col} >= ($${a}::date::timestamp at time zone '${TZ}') and ${col} < (($${b}::date + 1)::timestamp at time zone '${TZ}')`;
}
