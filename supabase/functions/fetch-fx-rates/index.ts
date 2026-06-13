// Wealth Tower — fetch-fx-rates Edge Function
// Fetches USDSGD from exchangerate.host, falls back to open.er-api.com.
// Validates rate (1.0–2.0), inserts an append-only row into fx_rates.
// No hardcoded rates. Uses service role key from env.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAIR = "USDSGD";
const MIN = 1.0, MAX = 2.0;

async function tryExchangerateHost(): Promise<number | null> {
  try {
    const r = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=SGD");
    if (!r.ok) return null;
    const j = await r.json();
    const v = j?.rates?.SGD;
    return typeof v === "number" && isFinite(v) ? v : null;
  } catch { return null; }
}

async function tryErApi(): Promise<number | null> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!r.ok) return null;
    const j = await r.json();
    const v = j?.rates?.SGD;
    return typeof v === "number" && isFinite(v) ? v : null;
  } catch { return null; }
}

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, key);
  const now = new Date().toISOString();

  let rate: number | null = null;
  let source = "none";

  rate = await tryExchangerateHost();
  if (rate !== null) source = "exchangerate.host";
  if (rate === null) { rate = await tryErApi(); if (rate !== null) source = "open.er-api.com"; }

  const valid = rate !== null && rate >= MIN && rate <= MAX;
  const status = valid ? "OK" : "FAILED";

  const row = {
    currency_pair: PAIR,
    rate: valid ? rate : 0,
    source: valid ? source : "none",
    status,
    fetched_at: now,
  };

  const { error } = await supabase.from("fx_rates").insert(row);
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: valid, source: row.source, rate: row.rate, status }), {
    headers: { "Content-Type": "application/json" },
  });
});
