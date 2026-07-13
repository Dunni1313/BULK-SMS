// Phase 2, Sprint 26 — Tom Nash Investment Engine, Enhancement II. A new,
// self-contained, deterministic macro/interest-rate regime proxy.
//
// Per the approved Sprint 26 decision, this is deliberately NOT a dependency
// on the Options Engine's marketBriefing.ts/optionsMath.ts — that module's
// synthetic VIX reflects options implied volatility, a genuinely different
// signal from a macro rate regime, and Engine 1 should not read Engine 3's
// data for a concept Engine 3 doesn't actually model. No real macro/interest-
// rate feed is wired anywhere in this codebase (roadmap §2 item 8, flagged
// "needs owner OK" since Sprint 11 planning and never resolved until now) —
// this is a deterministic, clearly-SIMULATED placeholder, never a real
// forecast, exactly the same honesty discipline every other aggregate-number
// proxy in this app already follows.
//
// Seeded by the report's own `asOf` date (not wall-clock time), so the same
// date always produces the same regime — reproducible and testable, and
// naturally "changes" only as the calendar date changes, never mid-request.

import { makeRng } from "./deterministic.js";

function round(x: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

export type MacroRegime = "rising_rates" | "falling_rates" | "stable_rates";

export interface MacroContext {
  asOf: string;
  regime: MacroRegime;
  regimeLabel: string;
  rateTrendPct: number; // illustrative fraction; e.g. 0.005 = +50bps over the period
  dataSource: "SIMULATED";
  summary: string;
}

const REGIME_LABELS: Record<MacroRegime, string> = {
  rising_rates: "Rising-Rate Environment",
  falling_rates: "Falling-Rate Environment",
  stable_rates: "Stable-Rate Environment",
};

export function buildMacroContext(asOf: string): MacroContext {
  const rng = makeRng(`macro-regime|${asOf}`);
  const roll = rng();
  const regime: MacroRegime = roll < 0.35 ? "rising_rates" : roll < 0.7 ? "stable_rates" : "falling_rates";

  const rateTrendPct =
    regime === "rising_rates"
      ? round(0.001 + rng() * 0.006)
      : regime === "falling_rates"
        ? round(-(0.001 + rng() * 0.006))
        : round((rng() - 0.5) * 0.001);

  const regimeLabel = REGIME_LABELS[regime];
  const trendSign = rateTrendPct >= 0 ? "+" : "";
  const summary =
    `SIMULATED macro proxy as of ${asOf}: ${regimeLabel.toLowerCase()} (illustrative ${trendSign}${(rateTrendPct * 100).toFixed(2)}pp rate trend). ` +
    "No live macro/interest-rate feed is wired in this session — this is a deterministic placeholder, never a real forecast.";

  return { asOf, regime, regimeLabel, rateTrendPct, dataSource: "SIMULATED", summary };
}
