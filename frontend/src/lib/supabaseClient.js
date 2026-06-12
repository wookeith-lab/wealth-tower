// Wealth Tower — Supabase client (Phase 4.2)
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "Missing Supabase config. Copy .env.example to .env and fill in values."
  );
}

export const supabase = createClient(url, anonKey);

export async function fetchCurrentWealth() {
  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select("net_liquidation, created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchWealthTargets(accountId = "50213686") {
  const { data, error } = await supabase
    .from("wealth_targets")
    .select(
      "initial_capital, target_wealth, target_date, monthly_contribution"
    )
    .eq("account_id", accountId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchSnapshotHistory() {
  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .select("net_liquidation, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
