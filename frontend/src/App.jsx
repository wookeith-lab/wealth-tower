// Wealth Tower — Phase 4.1: Tiger → Supabase → Dashboard, end to end.
// Success criterion: render the REAL portfolio value from Supabase.
// No UI polish. No charts. No additional modules.
import { useEffect, useState } from "react";
import { fetchCurrentWealth, fetchWealthTargets } from "./lib/supabaseClient";

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [targets, setTargets] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [snap, tgt] = await Promise.all([
          fetchCurrentWealth(),
          fetchWealthTargets(),
        ]);
        setSnapshot(snap);
        setTargets(tgt);
      } catch (e) {
        setError(e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p>Loading Wealth Tower…</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>🏰 Wealth Tower</h1>
      <h2>Investment Journey — Phase 4.1</h2>

      <section>
        <h3>Card 1 — Current Wealth</h3>
        <p style={{ fontSize: "2.5rem", fontWeight: "bold" }}>
          {snapshot ? Number(snapshot.net_liquidation).toLocaleString("en-SG", {
            minimumFractionDigits: 2,
          }) : "No snapshot found"}
        </p>
        <small>
          Snapshot time:{" "}
          {snapshot ? new Date(snapshot.created_at).toLocaleString("en-SG") : "—"}
        </small>
      </section>

      <section style={{ marginTop: "1.5rem", opacity: 0.8 }}>
        <h3>Targets (from wealth_targets)</h3>
        {targets ? (
          <ul>
            <li>Initial capital: {Number(targets.initial_capital).toLocaleString()}</li>
            <li>Target wealth: {Number(targets.target_wealth).toLocaleString()}</li>
            <li>Target date: {targets.target_date}</li>
            <li>Monthly contribution: {Number(targets.monthly_contribution).toLocaleString()}</li>
          </ul>
        ) : (
          <p>No targets row found.</p>
        )}
      </section>

      <p style={{ marginTop: "2rem", color: "#888" }}>
        ✅ If you can see real numbers above, Tiger → Supabase → Dashboard is
        working end-to-end.
      </p>
    </main>
  );
}
