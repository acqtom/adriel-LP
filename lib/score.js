// Lead score out of 10 from the application answers (and how much of the VSL they watched).
// Adjust the points here; the Slack messages and dashboard use these rules.
export const MAX_SCORE = 10;

const INVESTMENT = {
  'Yes, I have the resources to pay in full': 3,
  "I'd need to split it up into 12-24 payments": 2,
  "I can't afford that level of investment right now": 0,
};
const CANT_AFFORD = "I can't afford that level of investment right now";
const CAPITAL = { '$500k - $1M': 3, '$300k - $500k': 3, '$100k - $300k': 2, '$50k - $100k': 1, 'Under $50k': 0 };
const ACTIVE_DEAL = ["I'm building on a lot right now", 'I have a deal under contract or in due diligence'];
// Qualified: can invest in the program AND has $100k+ for the project.
const QUALIFIED_CAPITAL = ['$500k - $1M', '$300k - $500k', '$100k - $300k'];

export const words = (s) => (String(s || '').trim().match(/\S+/g) || []).length;

export function isQualifiedLead(a = {}) {
  return !!a.investment && a.investment !== CANT_AFFORD && QUALIFIED_CAPITAL.includes(a.capital);
}

// vslShare: 0..1 share of the VSL watched, or null if unknown.
export function scoreLead(a = {}, vslShare = null) {
  const reasons = [];
  let total = 0;
  const add = (label, pts) => { total += pts; reasons.push({ label, pts }); };

  if (a.investment) add(`Can invest: ${a.investment}`, INVESTMENT[a.investment] ?? 0);
  if (a.capital) add(`Capital ${a.capital}`, CAPITAL[a.capital] ?? 0);
  if (a.situation) add(`Situation: ${a.situation}`, ACTIVE_DEAL.includes(a.situation) ? 1 : 0);
  const w = words(a.problems) + words(a.why_now);
  add(`Wrote ${w} word${w === 1 ? '' : 's'} in the open questions`, w >= 50 ? 2 : w >= 15 ? 1 : 0);
  const pct = vslShare == null ? null : Math.round(vslShare * 100);
  add(pct == null ? "VSL: didn't press play" : `Watched ${pct}% of the VSL`, vslShare != null && vslShare >= 0.5 ? 1 : 0);

  const cantAfford = a.investment === CANT_AFFORD;
  const tier = cantAfford || total <= 4 ? { emoji: '🔵', name: 'Cold' }
    : total >= 8 ? { emoji: '🔥', name: 'Hot' } : { emoji: '🟠', name: 'Warm' };
  return { total, max: MAX_SCORE, reasons, tier, qualified: isQualifiedLead(a) };
}
