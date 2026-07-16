// Task #38 — Portfolio AI. Deterministic market-briefing engine.
//
// The Ravish framework has no first-class VIX feed, so we derive a simulated
// market regime from the same canonical snapshots the rest of the engine uses:
// the index/mega-cap IV ranks give a synthetic "VIX" and risk-on/off read, and
// the event-risk calendar supplies the forward catalysts. Pure + deterministic
// per day so the briefing is reproducible within a process/day.
//
// This module's MarketRegime is deliberately separate from Engine 2's
// tradingRegime.ts's own TradingRegimeAnalysis (Phase 3, Sprint 36) — this
// one is an options-IV-derived read for Engine 3's Portfolio AI, that one is
// a real price-action-derived read for the Trading Engine; see
// docs/Phase-3-Trading-Engine-Execution-Plan.md §0 Correction 1 for why they
// are never merged.

import { UNIVERSE_SYMBOLS, getSnapshot, todayStr } from "./optionsMath.js";
import { getUpcomingEvents } from "./eventRisk.js";

export type MarketRegime = "risk_on" | "neutral" | "risk_off";

export interface MarketBriefingEvent {
  type: string;
  label: string;
  date: string;
  daysAway: number;
  impact: "low" | "medium" | "high";
  symbol: string | null;
}

export interface MarketBriefing {
  date: string;
  regime: MarketRegime;
  regimeLabel: string;
  syntheticVix: number; // simulated VIX-style index level
  vixLabel: string;
  avgIvRank: number; // 0-100, average across the universe
  breadth: number; // 0-100, share of universe trading up on the day
  ivEnvironment: string; // premium-selling context
  headline: string;
  drivers: string[];
  catalysts: MarketBriefingEvent[];
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// Convert the index-complex IV ranks into a synthetic VIX level. ETFs (SPY/QQQ/
// IWM) drive the headline number; a 0-100 IV rank maps to a ~11-34 VIX range.
function syntheticVixFrom(etfIvRank: number): number {
  return Math.round((11 + (etfIvRank / 100) * 23) * 10) / 10;
}

export function buildMarketBriefing(now: number = Date.now()): MarketBriefing {
  const date = todayStr(new Date(now));
  const snaps = UNIVERSE_SYMBOLS.map((s) => getSnapshot(s, date)).filter(
    (s): s is NonNullable<typeof s> => s != null,
  );

  const etfs = snaps.filter((s) => ["SPY", "QQQ", "IWM"].includes(s.symbol));
  const etfIvRank = etfs.length ? etfs.reduce((a, s) => a + s.ivRank, 0) / etfs.length : 30;
  const avgIvRank = snaps.length
    ? Math.round(snaps.reduce((a, s) => a + s.ivRank, 0) / snaps.length)
    : 0;
  const upCount = snaps.filter((s) => s.changePercent >= 0).length;
  const breadth = snaps.length ? Math.round((upCount / snaps.length) * 100) : 50;

  const syntheticVix = syntheticVixFrom(etfIvRank);

  // Regime: blend breadth (direction) with the IV environment (fear). High IV +
  // weak breadth = risk-off; calm IV + strong breadth = risk-on.
  const stressScore = clamp(etfIvRank - (breadth - 50), 0, 100);
  const regime: MarketRegime =
    stressScore >= 60 ? "risk_off" : stressScore <= 35 ? "risk_on" : "neutral";

  const regimeLabel =
    regime === "risk_off" ? "Risk-Off" : regime === "risk_on" ? "Risk-On" : "Neutral / Mixed";

  const vixLabel =
    syntheticVix >= 25 ? "Elevated" : syntheticVix >= 18 ? "Normal" : "Subdued";

  const ivEnvironment =
    avgIvRank >= 50
      ? "Rich premium — IV ranks are high, favourable for selling defined-risk spreads."
      : avgIvRank >= 30
        ? "Average premium — selective short-premium setups still pay."
        : "Thin premium — low IV ranks mean smaller credits; be picky on entries.";

  const catalysts: MarketBriefingEvent[] = getUpcomingEvents(UNIVERSE_SYMBOLS, now, 14)
    .filter((e) => e.impact !== "low")
    .slice(0, 6)
    .map((e) => ({
      type: e.type,
      label: e.label,
      date: e.date,
      daysAway: e.daysAway,
      impact: e.impact,
      symbol: e.symbol,
    }));

  const drivers: string[] = [
    `Synthetic VIX ~${syntheticVix} (${vixLabel.toLowerCase()} volatility).`,
    `Market breadth ${breadth}% of the universe higher on the day.`,
    `Average IV rank ${avgIvRank}/100 across the 10-name universe.`,
  ];
  const highImpact = catalysts.filter((c) => c.impact === "high");
  if (highImpact.length > 0) {
    drivers.push(
      `${highImpact.length} high-impact catalyst(s) within two weeks (${highImpact
        .map((c) => c.label)
        .slice(0, 3)
        .join(", ")}).`,
    );
  } else {
    drivers.push("No high-impact catalysts inside the next two weeks.");
  }

  const headline =
    regime === "risk_off"
      ? `Defensive tape: ${regimeLabel.toLowerCase()} with a ${vixLabel.toLowerCase()} synthetic VIX near ${syntheticVix}. Premium is rich but tail risk is live.`
      : regime === "risk_on"
        ? `Constructive tape: ${regimeLabel.toLowerCase()} with ${vixLabel.toLowerCase()} volatility (~${syntheticVix}). Credits are thinner — lean on quality setups.`
        : `Mixed tape: ${regimeLabel.toLowerCase()} conditions, synthetic VIX ~${syntheticVix}. Balance income against the event calendar.`;

  return {
    date,
    regime,
    regimeLabel,
    syntheticVix,
    vixLabel,
    avgIvRank,
    breadth,
    ivEnvironment,
    headline,
    drivers,
    catalysts,
  };
}
