// Phase 35 — Institutional Options Income Engine (Foundation).
//
// ARCHITECTURE-ONLY FOUNDATION PHASE. No live brokerage execution, no
// auto trading, no auto adjustments, no AI predictions, no direction
// forecasting, no position recommendations, no trade alerts, no market
// timing. This file is a pure, deterministic METADATA catalog — "treat
// strategies as reusable templates... metadata only... do not generate
// trades," per the approved brief. Nothing here builds a quote, prices a
// leg, or persists a trade.
//
// Reuses lib/strategyAcademy.ts (Learning Centre content, unmodified —
// confirmed via `git diff` showing zero changes to that file) as the base
// content for 8 of the 9 requested templates, rather than re-authoring
// the same construction/idealMarket/maxProfit/maxLoss/greeksProfile/
// assignmentRisk text a second time. The one genuine gap: Strategy
// Academy's own "vertical_spread" is a single combined entry, but the
// Strategy Library needs "Vertical Credit" and "Vertical Debit" as two
// distinct templates (a real, meaningful distinction for POSITION
// TRACKING — a credit vertical collects a credit at entry with defined
// risk = spread width minus credit; a debit vertical pays a debit at
// entry with defined risk = the debit paid) — both new entries reuse
// vertical_spread's own construction/idealMarket/assignmentRisk text via
// getStrategyAcademyEntry("vertical_spread"), never re-authoring it.

import { allStrategyAcademyEntries, getStrategyAcademyEntry, type StrategyAcademyEntry } from "./strategyAcademy.js";

export type OptionsStrategyLibraryKey =
  | "covered_call"
  | "cash_secured_put"
  | "wheel"
  | "iron_condor"
  | "iron_fly"
  | "calendar"
  | "diagonal"
  | "vertical_credit"
  | "vertical_debit";

// Phase 36 — a small, additive, runtime-checkable export of the same 9
// keys the type above already enumerates (a TS union type has no runtime
// representation of its own), so lib/optionsLifecycleChecklists.ts can
// validate a caller-supplied strategyKey without redefining this list a
// second time.
export const OPTIONS_STRATEGY_TEMPLATE_KEYS: OptionsStrategyLibraryKey[] = [
  "covered_call",
  "cash_secured_put",
  "wheel",
  "iron_condor",
  "iron_fly",
  "calendar",
  "diagonal",
  "vertical_credit",
  "vertical_debit",
];

export type OptionsCollateralType = "stock" | "cash" | "margin" | "defined_risk" | "debit";
export type OptionsIncomeType = "credit" | "debit";

export interface OptionsStrategyTemplate {
  key: OptionsStrategyLibraryKey;
  label: string;
  legCount: number;
  incomeType: OptionsIncomeType;
  collateralType: OptionsCollateralType;
  collateralNote: string;
  builtByThisEngine: boolean;
  summary: string;
  idealMarket: string;
  assignmentRisk: string;
  // The real execution.ts Strategy key ("iron_condor" | "iron_fly" |
  // "calendar_spread" | "earnings") this template maps to, for position
  // rows whose real `trades.strategy` value should surface this
  // template's own metadata — null for templates this engine's own
  // scanner/execution layer never builds.
  executionStrategyKey: string | null;
}

// Maps this library's own key vocabulary onto the underlying
// lib/strategyAcademy.ts entry it reuses, plus the leg count / collateral
// classification a position-tracking template needs (Strategy Academy's
// own shape has no legCount/collateralType field — those are new,
// position-tracking-specific metadata this phase adds, not a duplicate
// of anything Strategy Academy already computes).
const TEMPLATE_META: Record<
  OptionsStrategyLibraryKey,
  { academyKey: string; legCount: number; incomeType: OptionsIncomeType; collateralType: OptionsCollateralType; collateralNote: string; executionStrategyKey: string | null }
> = {
  covered_call: {
    academyKey: "covered_call",
    legCount: 1,
    incomeType: "credit",
    collateralType: "stock",
    collateralNote: "Collateralized by 100 shares of the underlying held per contract sold.",
    executionStrategyKey: null,
  },
  cash_secured_put: {
    academyKey: "cash_secured_put",
    legCount: 1,
    incomeType: "credit",
    collateralType: "cash",
    collateralNote: "Collateralized by cash equal to (strike × 100) per contract sold.",
    executionStrategyKey: null,
  },
  wheel: {
    academyKey: "wheel",
    legCount: 1,
    incomeType: "credit",
    collateralType: "cash",
    collateralNote: "Alternates between cash collateral (the put stage) and stock collateral (the covered-call stage), per lib/strategyAcademy.ts's own cycle description.",
    executionStrategyKey: null,
  },
  iron_condor: {
    academyKey: "iron_condor",
    legCount: 4,
    incomeType: "credit",
    collateralType: "defined_risk",
    collateralNote: "Defined-risk: capital at risk equals the wider spread's width minus the net credit received.",
    executionStrategyKey: "iron_condor",
  },
  iron_fly: {
    academyKey: "iron_fly",
    legCount: 4,
    incomeType: "credit",
    collateralType: "defined_risk",
    collateralNote: "Defined-risk: capital at risk equals the wing width minus the net credit received.",
    executionStrategyKey: "iron_fly",
  },
  calendar: {
    academyKey: "calendar_spread",
    legCount: 2,
    incomeType: "debit",
    collateralType: "debit",
    collateralNote: "Defined-risk: capital at risk is limited to the net debit paid to establish the spread.",
    executionStrategyKey: "calendar_spread",
  },
  diagonal: {
    academyKey: "diagonal_spread",
    legCount: 2,
    incomeType: "debit",
    collateralType: "debit",
    collateralNote: "Defined-risk: capital at risk is limited to the net debit paid, the same shape as a calendar spread.",
    executionStrategyKey: null,
  },
  vertical_credit: {
    academyKey: "vertical_spread",
    legCount: 2,
    incomeType: "credit",
    collateralType: "defined_risk",
    collateralNote: "Defined-risk: capital at risk equals the spread width minus the net credit received.",
    executionStrategyKey: null,
  },
  vertical_debit: {
    academyKey: "vertical_spread",
    legCount: 2,
    incomeType: "debit",
    collateralType: "debit",
    collateralNote: "Defined-risk: capital at risk is limited to the net debit paid to establish the spread.",
    executionStrategyKey: null,
  },
};

const LABELS: Record<OptionsStrategyLibraryKey, string> = {
  covered_call: "Covered Call",
  cash_secured_put: "Cash Secured Put",
  wheel: "Wheel",
  iron_condor: "Iron Condor",
  iron_fly: "Iron Fly",
  calendar: "Calendar",
  diagonal: "Diagonal",
  vertical_credit: "Vertical Credit",
  vertical_debit: "Vertical Debit",
};

function projectTemplate(key: OptionsStrategyLibraryKey): OptionsStrategyTemplate {
  const meta = TEMPLATE_META[key];
  const academy: StrategyAcademyEntry | null = getStrategyAcademyEntry(meta.academyKey);
  if (!academy) {
    // Defensive only — every academyKey above is a real, existing
    // StrategyAcademyKey, confirmed by direct inspection of
    // lib/strategyAcademy.ts before writing this file. Never reachable
    // in practice; honestly surfaced rather than throwing if it ever is.
    return {
      key,
      label: LABELS[key],
      legCount: meta.legCount,
      incomeType: meta.incomeType,
      collateralType: meta.collateralType,
      collateralNote: meta.collateralNote,
      builtByThisEngine: false,
      summary: "Template metadata unavailable.",
      idealMarket: "Unavailable.",
      assignmentRisk: "Unavailable.",
      executionStrategyKey: meta.executionStrategyKey,
    };
  }
  return {
    key,
    label: LABELS[key],
    legCount: meta.legCount,
    incomeType: meta.incomeType,
    collateralType: meta.collateralType,
    collateralNote: meta.collateralNote,
    builtByThisEngine: academy.builtByThisEngine,
    summary: academy.construction,
    idealMarket: academy.idealMarket,
    assignmentRisk: academy.assignmentRisk,
    executionStrategyKey: meta.executionStrategyKey,
  };
}

export function getOptionsStrategyTemplate(key: string): OptionsStrategyTemplate | null {
  if (!(key in TEMPLATE_META)) return null;
  return projectTemplate(key as OptionsStrategyLibraryKey);
}

export function allOptionsStrategyTemplates(): OptionsStrategyTemplate[] {
  return (Object.keys(TEMPLATE_META) as OptionsStrategyLibraryKey[]).map(projectTemplate);
}

// A reverse lookup so the Position Model can resolve a real
// `trades.strategy` value (e.g. "iron_condor") to its own Strategy
// Library template — honestly `null` for a strategy no template maps to.
export function templateForExecutionStrategy(executionStrategyKey: string): OptionsStrategyTemplate | null {
  const match = allOptionsStrategyTemplates().find((t) => t.executionStrategyKey === executionStrategyKey);
  return match ?? null;
}

// Re-exported so callers of this module never need to import
// lib/strategyAcademy.ts separately just to prove reuse in tests.
export { allStrategyAcademyEntries };
