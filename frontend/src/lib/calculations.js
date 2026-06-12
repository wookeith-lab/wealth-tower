// ============================================================
// Wealth Tower — Investment Journey Calculation Engine v1.1
// Spec: Dashboard Calculation Specification v1.1 (11 Jun 2026)
// All formulas contribution-aware. PMT = 0 reduces to v1.0 math.
// ============================================================

const MS_PER_DAY = 86400000;
const DAYS_PER_MONTH = 30.4375;

// ---- Card 5: Days Remaining ----
export function daysRemaining(targetDate, today = new Date()) {
  const t = new Date(targetDate);
  const d = Math.ceil((t - today) / MS_PER_DAY);
  return d;
}

// ---- Card 6: Progress % ----
export function progressPercent(current, initial, target) {
  if (target === initial) return null;
  return ((current - initial) / (target - initial)) * 100;
}

// ---- Future value with monthly contributions ----
export function futureValue(C, PMT, i, m) {
  if (i === 0) return C + PMT * m;
  return C * Math.pow(1 + i, m) + (PMT * (Math.pow(1 + i, m) - 1)) / i;
}

// ---- Card 7: Required Annual Return (bisection solver) ----
export function requiredMonthlyReturn(C, T, PMT, m) {
  if (m <= 0) return null;        // deadline passed
  if (C >= T) return 0;           // goal already reached
  let lo = -0.99, hi = 10;        // monthly rate bounds
  if (futureValue(C, PMT, hi, m) < T) return null; // unreachable
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (futureValue(C, PMT, mid, m) < T) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function requiredAnnualReturn(C, T, PMT, m) {
  const i = requiredMonthlyReturn(C, T, PMT, m);
  if (i === null) return null;
  return Math.pow(1 + i, 12) - 1;
}

// ---- Card 8: Projected Completion (months until target at actual rate) ----
export function monthsToTarget(C, T, PMT, iActual) {
  if (C >= T) return 0; // already reached
  if (iActual === 0) {
    if (PMT <= 0) return null;
    return (T - C) / PMT;
  }
  if (iActual > 0) {
    const num = T + PMT / iActual;
    const den = C + PMT / iActual;
    if (den <= 0 || num / den <= 0) return null;
    return Math.log(num / den) / Math.log(1 + iActual);
  }
  // negative growth: simulate up to 1200 months
  let v = C;
  for (let m = 1; m <= 1200; m++) {
    v = v * (1 + iActual) + PMT;
    if (v >= T) return m;
  }
  return null; // not reachable at current pace
}

export function projectedCompletionDate(C, T, PMT, iActual, today = new Date()) {
  const m = monthsToTarget(C, T, PMT, iActual);
  if (m === null) return null;
  if (m > 1200) return "100+ years";
  const d = new Date(today);
  d.setDate(d.getDate() + Math.round(m * DAYS_PER_MONTH));
  return d;
}

// ---- Card 9: On Track? ----
export function onTrackStatus(actualAnnual, requiredAnnual) {
  if (requiredAnnual === null) return "RED";
  if (actualAnnual === null) return "UNKNOWN"; // not enough history yet
  if (actualAnnual >= requiredAnnual) return "GREEN";
  if (actualAnnual >= requiredAnnual * 0.95) return "YELLOW";
  return "RED";
}

// ---- Actual return from snapshot history (naive — Phase 4 version) ----
// LIMITATION (documented, Phase 5 fix): deposits inflate this value.
export function actualMonthlyReturn(snapshots) {
  // snapshots: [{ net_liquidation, created_at }] sorted ASC, need >= 2
  if (!snapshots || snapshots.length < 2) return null;
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const v0 = Number(first.net_liquidation);
  const v1 = Number(last.net_liquidation);
  const months =
    (new Date(last.created_at) - new Date(first.created_at)) /
    (MS_PER_DAY * DAYS_PER_MONTH);
  if (v0 <= 0 || months <= 0) return null;
  return Math.pow(v1 / v0, 1 / months) - 1;
}
