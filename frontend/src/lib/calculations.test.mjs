// Unit tests — Calculation Engine v1.1
// Run: node src/lib/calculations.test.mjs
import {
  daysRemaining, progressPercent, futureValue,
  requiredAnnualReturn, monthsToTarget, projectedCompletionDate,
  onTrackStatus, actualMonthlyReturn
} from "./calculations.js";

let pass = 0, fail = 0;
function check(name, actual, expected, tol = 0) {
  const ok = typeof expected === "number"
    ? Math.abs(actual - expected) <= tol
    : actual === expected;
  if (ok) { pass++; console.log(`  ✅ ${name} → ${typeof actual === 'number' ? actual.toFixed(4) : actual}`); }
  else { fail++; console.log(`  ❌ ${name} → got ${actual}, expected ${expected}`); }
}

const TODAY = new Date("2026-06-11T15:30:00Z"); // tonight, SGT 11:30 PM
const TARGET_DATE = "2028-12-31";
const C_SGD = 3548.90;   // live snapshot tonight (SGD)
const T = 50000;
const m = daysRemaining(TARGET_DATE, TODAY) / 30.4375;

console.log("=== Card 5: Days Remaining ===");
check("days to 2028-12-31", daysRemaining(TARGET_DATE, TODAY), 933, 1);
console.log(`  (months remaining m = ${m.toFixed(2)})`);

console.log("\n=== Card 6: Progress % ===");
check("progress (3548.90, 3500, 50000)", progressPercent(C_SGD, 3500, T), 0.1052, 0.001);
check("progress at goal", progressPercent(50000, 3500, T), 100, 0.0001);
check("progress null when target=initial", progressPercent(100, 50, 50), null);

console.log("\n=== Card 7: Required Annual Return (spec unit tests) ===");
check("PMT=0    → ~181%", requiredAnnualReturn(C_SGD, T, 0, m) * 100, 181, 8);
check("PMT=500  → ~80%", requiredAnnualReturn(C_SGD, T, 500, m) * 100, 80, 8);
check("PMT=1000 → ~28%", requiredAnnualReturn(C_SGD, T, 1000, m) * 100, 28, 6);
check("PMT=1500 → ~0%", requiredAnnualReturn(C_SGD, T, 1500, m) * 100, 0, 6);
check("goal reached → 0", requiredAnnualReturn(60000, T, 0, m), 0);
check("deadline passed → null", requiredAnnualReturn(C_SGD, T, 0, -1), null);

console.log("\n=== PMT=0 reduces to v1.0 closed form ===");
const v10 = Math.pow(T / C_SGD, 1 / (m / 12)) - 1; // (T/C)^(1/years)-1
check("solver matches closed form", requiredAnnualReturn(C_SGD, T, 0, m), v10, 0.0005);

console.log("\n=== Card 8: Projected Completion ===");
check("i=0, PMT=1500 → (T-C)/PMT months", monthsToTarget(C_SGD, T, 1500, 0), (T - C_SGD) / 1500, 0.01);
check("i=0, PMT=0 → null (never)", monthsToTarget(C_SGD, T, 0, 0), null);
check("already reached → 0", monthsToTarget(60000, T, 0, 0.01), 0);
const mt = monthsToTarget(C_SGD, T, 500, 0.02); // 2%/mo + 500/mo
console.log(`  (info: at 2%/mo + SGD500/mo → target in ${mt.toFixed(1)} months ≈ ${(mt/12).toFixed(1)} yrs)`);
const pcd = projectedCompletionDate(C_SGD, T, 500, 0.02, TODAY);
console.log(`  (info: projected date = ${pcd.toISOString().slice(0,10)})`);
check("negative growth, no PMT → null", monthsToTarget(C_SGD, T, 0, -0.01), null);

console.log("\n=== Card 9: On Track? ===");
check("actual 30% vs req 28% → GREEN", onTrackStatus(0.30, 0.28), "GREEN");
check("actual 27% vs req 28% → YELLOW", onTrackStatus(0.27, 0.28), "YELLOW");
check("actual 10% vs req 28% → RED", onTrackStatus(0.10, 0.28), "RED");
check("unreachable → RED", onTrackStatus(0.30, null), "RED");
check("no history → UNKNOWN", onTrackStatus(null, 0.28), "UNKNOWN");

console.log("\n=== Actual return from snapshots (naive) ===");
const snaps = [
  { net_liquidation: 2700.00, created_at: "2026-05-11T00:00:00Z" },
  { net_liquidation: 2757.14, created_at: "2026-06-11T00:00:00Z" },
];
const ar = actualMonthlyReturn(snaps);
check("1 month, 2700→2757.14 ≈ 2.09%/mo", ar * 100, 2.09, 0.15);
check("single snapshot → null", actualMonthlyReturn([snaps[0]]), null);

console.log(`\n========== RESULT: ${pass} passed, ${fail} failed ==========`);
process.exit(fail > 0 ? 1 : 0);
