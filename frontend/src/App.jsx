// Wealth Tower — Phase 4.2: All 9 cards + manual Refresh Data button.
// Doctrine: every card answers exactly one question. No polish (Phase 4.4).
import { useEffect, useState, useCallback } from "react";
import {
  fetchCurrentWealth,
  fetchWealthTargets,
  fetchSnapshotHistory,
  fetchLatestFxRate,
} from "./lib/supabaseClient";
import {
  daysRemaining,
  progressPercent,
  requiredAnnualReturn,
  projectedCompletionDate,
  onTrackStatus,
  actualMonthlyReturn,
} from "./lib/calculations";

const fmt = (n, dp = 2) =>
  n === null || n === undefined || Number.isNaN(n)
    ? "—"
    : Number(n).toLocaleString("en-SG", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pct = (x) => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);

function Card({ title, children }) {
  return (
    <div style={{ border: "1px solid #444", borderRadius: 8, padding: "1rem" }}>
      <h3 style={{ margin: 0, fontSize: "0.9rem", color: "#888" }}>{title}</h3>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, marginTop: 4 }}>{children}</div>
    </div>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [targets, setTargets] = useState(null);
  const [history, setHistory] = useState([]);
  const [fxRow, setFxRow] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [snap, tgt, hist, fxr] = await Promise.all([
        fetchCurrentWealth(),
        fetchWealthTargets(),
        fetchSnapshotHistory(),
        fetchLatestFxRate(),
      ]);
      setSnapshot(snap);
      setTargets(tgt);
      setHistory(hist);
      setFxRow(fxr);
      setRefreshedAt(new Date());
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading && !snapshot) return <p style={{ padding: "2rem" }}>Loading Wealth Tower…</p>;
  if (error) return <p style={{ padding: "2rem", color: "red" }}>Error: {error}</p>;
  if (!snapshot || !targets)
    return <p style={{ padding: "2rem" }}>No data found — run the Tiger sync first.</p>;

  const fx = fxRow ? Number(fxRow.rate) : 1;
  const BASE = targets.base_currency ?? 'SGD';
  const toBase = (usd) => BASE === 'SGD' ? usd * fx : usd;

  const usdNL = Number(snapshot.net_liquidation);
  const C = toBase(usdNL);
  const I = Number(targets.initial_capital);
  const T = Number(targets.target_wealth);
  const PMT = Number(targets.monthly_contribution ?? 0);
  const days = daysRemaining(targets.target_date);
  const m = days / 30.4375;

  const histConv = history.map(h => ({ ...h, net_liquidation: toBase(Number(h.net_liquidation)) }));

  const ageMin = fxRow ? (Date.now() - new Date(fxRow.fetched_at)) / 60000 : Infinity;
  const fxStale = !fxRow || fxRow.status !== 'OK' || ageMin > 1440;

  const progress = progressPercent(C, I, T);
  const reqAnnual = requiredAnnualReturn(C, T, PMT, m);
  const actMonthly = actualMonthlyReturn(histConv);
  const actAnnual = actMonthly === null ? null : Math.pow(1 + actMonthly, 12) - 1;
  const projDate = projectedCompletionDate(C, T, PMT, actMonthly ?? 0);
  const status = onTrackStatus(actAnnual, reqAnnual);
  const statusIcon = { GREEN: "🟢 On Track", YELLOW: "🟡 Close", RED: "🔴 Behind", UNKNOWN: "⚪ Need more history" }[status];

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <h1>🏰 Wealth Tower — Investment Journey</h1>

      {fxStale && (
        <div style={{ background: "#3a1d1d", border: "1px solid #a33", color: "#fbb", padding: "0.75rem 1rem", borderRadius: 8, margin: "1rem 0", fontWeight: 600 }}>
          ⚠️ FX RATE STALE — last good rate {fxRow ? `${ageMin.toFixed(0)} min old (status: ${fxRow.status})` : "never fetched"}. Wealth figures may be off.
        </div>
      )}

      <div style={{ margin: "1rem 0" }}>
        <button onClick={loadAll} disabled={loading} style={{ padding: "0.5rem 1rem" }}>
          {loading ? "Refreshing…" : "🔄 Refresh Data"}
        </button>
        <small style={{ marginLeft: 12, color: "#888" }}>
          Last refreshed: {refreshedAt ? refreshedAt.toLocaleTimeString("en-SG") : "—"}.
          For fresh Tiger data, first run on Mac Mini:{" "}
          <code>python3 sync_tiger_to_supabase.py</code>
        </small>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
        <Card title="1 · Current Wealth">
          {"S$" + fmt(C)}
          <div style={{ fontSize: "0.7rem", fontWeight: 400, color: "#999", marginTop: 8, lineHeight: 1.5 }}>
            <div><b>Portfolio Source:</b> Tiger Brokers Open API</div>
            <div><b>Portfolio Fetched:</b> {new Date(snapshot.created_at).toLocaleString("en-SG")}</div>
            <div><b>FX Source:</b> {fxRow?.source ?? "—"}</div>
            <div><b>FX Rate:</b> {fx}</div>
            <div><b>FX Fetched:</b> {fxRow ? new Date(fxRow.fetched_at).toLocaleString("en-SG") : "—"}</div>
            <div><b>Calculation:</b> USD {usdNL} × {fx}</div>
            <div><b>Status:</b> {fxStale ? "STALE" : "LIVE"}</div>
          </div>
        </Card>
        <Card title="2 · Initial Capital">{fmt(I)}</Card>
        <Card title="3 · Target Wealth">{fmt(T)}</Card>
        <Card title="4 · Target Date">{targets.target_date}</Card>
        <Card title="5 · Days Remaining">{days}</Card>
        <Card title="6 · Progress">{progress === null ? "—" : `${progress.toFixed(2)}%`}</Card>
        <Card title="7 · Required Annual Return">{reqAnnual === null ? "Unreachable" : pct(reqAnnual)}<div style={{fontSize:"0.7rem",fontWeight:400,color:"#999"}}>with contribution {fmt(PMT)}/mo</div></Card>
        <Card title="8 · Projected Completion">
          {projDate === null ? "Not at current pace" : projDate instanceof Date ? projDate.toLocaleDateString("en-SG") : projDate}
          <div style={{fontSize:"0.7rem",fontWeight:400,color:"#999"}}>actual return (naive): {pct(actAnnual)} /yr — deposits inflate this; TWR in Phase 5</div>
        </Card>
        <Card title="9 · On Track?">{statusIcon}</Card>
        <Card title="FX · USDSGD">
          {fx}
          <div style={{ fontSize: "0.7rem", fontWeight: 400, color: "#999", marginTop: 8, lineHeight: 1.5 }}>
            <div><b>Source:</b> {fxRow?.source ?? "—"}</div>
            <div><b>Status:</b> {fxStale ? "STALE" : "LIVE"}</div>
            <div><b>Last Updated:</b> {fxRow ? new Date(fxRow.fetched_at).toLocaleString("en-SG") : "—"}</div>
            <div><b>Age:</b> {Number.isFinite(ageMin) ? `${Math.round(ageMin)} min` : "—"}</div>
          </div>
        </Card>
      </div>
    </main>
  );
}
