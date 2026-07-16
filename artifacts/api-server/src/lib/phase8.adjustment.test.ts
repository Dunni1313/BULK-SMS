import { describe, it, expect } from "vitest";
import {
  selectAdjustment,
  evaluateTradeAdjustment,
  AUTO_ACTIONABLE,
  ADJUSTMENT_DISCLAIMER,
  type SelectionInput,
} from "./adjustment.js";
import { autoAdjustAllowed } from "./autoAdjustment.js";
import { enforceDisclaimer } from "./coachLLM.js";
import { COACH_DISCLAIMER } from "./coach.js";

const baseSelection: SelectionInput = {
  isOpen: true,
  profitPct: 0,
  profitTarget50: 50,
  profitTarget75: 75,
  profitTarget90: 90,
  lossPct: 0,
  unrealizedPnl: 0,
  stopLoss: -1000,
  shortBreached: false,
  deltaDrift: false,
  popDrop: false,
  ivExpansion: false,
  dteLow: false,
};

describe("selectAdjustment precedence ladder", () => {
  it("does nothing for a closed position", () => {
    expect(selectAdjustment({ ...baseSelection, isOpen: false }).action).toBe("do_nothing");
  });

  it("closes for profit at the 90% target", () => {
    expect(selectAdjustment({ ...baseSelection, profitPct: 92 }).action).toBe("close_for_profit");
  });

  it("closes for profit at the 75% target", () => {
    expect(selectAdjustment({ ...baseSelection, profitPct: 80 }).action).toBe("close_for_profit");
  });

  it("a breached stop-loss outranks everything else (critical close)", () => {
    const r = selectAdjustment({ ...baseSelection, unrealizedPnl: -1200, stopLoss: -1000, lossPct: 60, shortBreached: true, dteLow: false });
    expect(r.action).toBe("close_for_loss");
    expect(r.severity).toBe("critical");
  });

  it("loss >= 50% with a breached short and time to repair rolls the threatened side", () => {
    const r = selectAdjustment({ ...baseSelection, lossPct: 55, shortBreached: true, dteLow: false, unrealizedPnl: -500, stopLoss: -1000 });
    expect(r.action).toBe("roll_threatened");
  });

  it("loss >= 50% without repair time closes for loss", () => {
    const r = selectAdjustment({ ...baseSelection, lossPct: 55, shortBreached: false, unrealizedPnl: -500, stopLoss: -1000 });
    expect(r.action).toBe("close_for_loss");
  });

  it("short breach with low DTE reduces risk", () => {
    const r = selectAdjustment({ ...baseSelection, shortBreached: true, dteLow: true });
    expect(r.action).toBe("reduce_risk");
  });

  it("short breach with time rolls the threatened side (warning)", () => {
    const r = selectAdjustment({ ...baseSelection, shortBreached: true, dteLow: false });
    expect(r.action).toBe("roll_threatened");
    expect(r.severity).toBe("warning");
  });

  it("delta drift with pop drop + IV expansion converts", () => {
    const r = selectAdjustment({ ...baseSelection, deltaDrift: true, popDrop: true, ivExpansion: true });
    expect(r.action).toBe("convert");
  });

  it("delta drift alone rolls the untested side", () => {
    expect(selectAdjustment({ ...baseSelection, deltaDrift: true }).action).toBe("roll_untested");
  });

  it("pop drop + IV expansion without delta drift converts", () => {
    expect(selectAdjustment({ ...baseSelection, popDrop: true, ivExpansion: true }).action).toBe("convert");
  });

  it("low DTE on a healthy position reduces risk", () => {
    expect(selectAdjustment({ ...baseSelection, dteLow: true }).action).toBe("reduce_risk");
  });

  it("low DTE past the 50% profit band closes for profit", () => {
    expect(selectAdjustment({ ...baseSelection, dteLow: true, profitPct: 55 }).action).toBe("close_for_profit");
  });

  it("partial profit in the 50-75% band takes profit", () => {
    expect(selectAdjustment({ ...baseSelection, profitPct: 60 }).action).toBe("close_for_profit");
  });

  it("nothing actionable holds", () => {
    expect(selectAdjustment(baseSelection).action).toBe("hold");
  });
});

describe("AUTO_ACTIONABLE set", () => {
  it("includes only the de-risk subset", () => {
    expect([...AUTO_ACTIONABLE].sort()).toEqual(["close_for_loss", "close_for_profit", "reduce_risk"]);
  });

  it("never includes structural changes", () => {
    expect(AUTO_ACTIONABLE.has("roll_threatened")).toBe(false);
    expect(AUTO_ACTIONABLE.has("roll_untested")).toBe(false);
    expect(AUTO_ACTIONABLE.has("convert")).toBe(false);
  });
});

const settings = {
  stopLossMultiplier: 2,
  profitTarget50: 50,
  profitTarget75: 75,
  profitTarget90: 90,
  adjDeltaDriftTrigger: 0.3,
  adjPopDropTrigger: 15,
  adjShortStrikeProximityPct: 2.0,
  adjIvExpansionTrigger: 25,
  adjDteTrigger: 21,
};

function ironCondor(overrides: Partial<Parameters<typeof evaluateTradeAdjustment>[0]> = {}) {
  return {
    id: 1,
    symbol: "SPY",
    strategy: "iron_condor",
    status: "open",
    legs: [
      { side: "sell", optionType: "call", strike: 600, quantity: 1, expiration: "2026-07-01" },
      { side: "buy", optionType: "call", strike: 610, quantity: 1, expiration: "2026-07-01" },
      { side: "sell", optionType: "put", strike: 500, quantity: 1, expiration: "2026-07-01" },
      { side: "buy", optionType: "put", strike: 490, quantity: 1, expiration: "2026-07-01" },
    ],
    credit: 200,
    maxProfit: 200,
    maxLoss: 800,
    pop: 75,
    expiration: "2026-07-01",
    entryIv: 0.2,
    ...overrides,
  };
}

describe("evaluateTradeAdjustment", () => {
  it("produces a full deterministic result with disclaimer and signals", () => {
    const r = evaluateTradeAdjustment(ironCondor(), settings);
    expect(r.tradeId).toBe(1);
    expect(r.symbol).toBe("SPY");
    expect(r.disclaimer).toBe(ADJUSTMENT_DISCLAIMER);
    expect(r.signals).toHaveLength(7);
    expect(r.signals.map((s) => s.key)).toContain("delta_drift");
    expect(r.signals.map((s) => s.key)).toContain("iv_expansion");
  });

  it("flags a closed trade as do_nothing and not auto-actionable", () => {
    const r = evaluateTradeAdjustment(ironCondor({ status: "closed" }), settings);
    expect(r.action).toBe("do_nothing");
    expect(r.autoActionable).toBe(false);
  });

  it("uses entry IV for the expansion signal when present", () => {
    const r = evaluateTradeAdjustment(ironCondor(), settings);
    const ivSignal = r.signals.find((s) => s.key === "iv_expansion");
    expect(ivSignal?.label).toBe("IV expansion");
  });

  it("falls back to the IV-rank proxy when entry IV is missing", () => {
    const r = evaluateTradeAdjustment(ironCondor({ entryIv: null }), settings);
    const ivSignal = r.signals.find((s) => s.key === "iv_expansion");
    expect(ivSignal?.label).toBe("IV elevated (rank proxy)");
  });

  it("marks an auto-actionable action as autoActionable only when open", () => {
    const r = evaluateTradeAdjustment(ironCondor(), settings);
    if (AUTO_ACTIONABLE.has(r.action)) {
      expect(r.autoActionable).toBe(true);
    } else {
      expect(r.autoActionable).toBe(false);
    }
  });

  it("triggers the proximity signal when the short call is deeply breached (ITM)", () => {
    // SPY trades around its base; force a clearly breached short call below spot.
    const r = evaluateTradeAdjustment(
      ironCondor({
        legs: [
          { side: "sell", optionType: "call", strike: 1, quantity: 1, expiration: "2026-07-01" },
          { side: "buy", optionType: "call", strike: 11, quantity: 1, expiration: "2026-07-01" },
          { side: "sell", optionType: "put", strike: 0.5, quantity: 1, expiration: "2026-07-01" },
          { side: "buy", optionType: "put", strike: 0.1, quantity: 1, expiration: "2026-07-01" },
        ],
      }),
      settings,
    );
    const prox = r.signals.find((s) => s.key === "short_strike_proximity");
    expect(prox?.triggered).toBe(true);
    expect(prox?.detail).toMatch(/BREACHED/);
    expect(r.threatenedSide).toBe("call");
    expect(r.assignmentRisk).toMatch(/ITM/);
  });

  it("triggers the proximity signal when the short put is deeply breached (ITM)", () => {
    // Force a short put far above spot so spot is well below it (ITM put).
    const r = evaluateTradeAdjustment(
      ironCondor({
        legs: [
          { side: "sell", optionType: "call", strike: 100000, quantity: 1, expiration: "2026-07-01" },
          { side: "buy", optionType: "call", strike: 100010, quantity: 1, expiration: "2026-07-01" },
          { side: "sell", optionType: "put", strike: 99000, quantity: 1, expiration: "2026-07-01" },
          { side: "buy", optionType: "put", strike: 98990, quantity: 1, expiration: "2026-07-01" },
        ],
      }),
      settings,
    );
    const prox = r.signals.find((s) => s.key === "short_strike_proximity");
    expect(prox?.triggered).toBe(true);
    expect(r.threatenedSide).toBe("put");
  });

  it("does not trigger proximity when both shorts are far OTM", () => {
    const r = evaluateTradeAdjustment(
      ironCondor({
        legs: [
          { side: "sell", optionType: "call", strike: 100000, quantity: 1, expiration: "2026-07-01" },
          { side: "buy", optionType: "call", strike: 100010, quantity: 1, expiration: "2026-07-01" },
          { side: "sell", optionType: "put", strike: 1, quantity: 1, expiration: "2026-07-01" },
          { side: "buy", optionType: "put", strike: 0.5, quantity: 1, expiration: "2026-07-01" },
        ],
      }),
      settings,
    );
    const prox = r.signals.find((s) => s.key === "short_strike_proximity");
    expect(prox?.triggered).toBe(false);
  });
});

describe("autoAdjustAllowed gating", () => {
  it("blocks when mode is not full_auto", () => {
    const g = autoAdjustAllowed("semi_auto", true, true);
    expect(g.allowed).toBe(false);
    expect(g.reason).toMatch(/Full-Auto/);
  });

  it("blocks when the master kill switch is off even if auto-adjust is on", () => {
    const g = autoAdjustAllowed("full_auto", false, true);
    expect(g.allowed).toBe(false);
    expect(g.reason).toMatch(/[Mm]aster/);
  });

  it("blocks when the auto-adjust switch is off even with master armed", () => {
    const g = autoAdjustAllowed("full_auto", true, false);
    expect(g.allowed).toBe(false);
    expect(g.reason).toMatch(/Auto-adjust/);
  });

  it("allows only when full_auto AND master kill switch AND auto-adjust switch are all on", () => {
    const g = autoAdjustAllowed("full_auto", true, true);
    expect(g.allowed).toBe(true);
    expect(g.reason).toBeNull();
  });

  it("blocks when not full_auto regardless of switches", () => {
    expect(autoAdjustAllowed("semi_auto", true, true).allowed).toBe(false);
    expect(autoAdjustAllowed("manual", true, true).allowed).toBe(false);
  });
});

describe("coach disclaimer invariant on adjustment narration", () => {
  it("the adjustment advisory is NOT the standard coach disclaimer", () => {
    // Proves the template path needs enforcement — ADJUSTMENT_DISCLAIMER alone would
    // ship an adjustment narration without the mandated COACH_DISCLAIMER.
    expect(ADJUSTMENT_DISCLAIMER.includes(COACH_DISCLAIMER)).toBe(false);
  });

  it("appends COACH_DISCLAIMER to a template/fallback that lacks it", () => {
    const template = `QQQ Iron Condor — recommended action: Hold\n\n${ADJUSTMENT_DISCLAIMER}`;
    const out = enforceDisclaimer(template);
    expect(out.includes(COACH_DISCLAIMER)).toBe(true);
    // The feature-specific advisory is preserved alongside the standard disclaimer.
    expect(out.includes(ADJUSTMENT_DISCLAIMER)).toBe(true);
  });

  it("does not duplicate COACH_DISCLAIMER when already present (LLM path)", () => {
    const text = `Here is the explanation.\n\n${COACH_DISCLAIMER}`;
    const out = enforceDisclaimer(text);
    expect(out).toBe(text);
    const occurrences = out.split(COACH_DISCLAIMER).length - 1;
    expect(occurrences).toBe(1);
  });
});
