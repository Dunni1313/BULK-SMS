// Phase 36 — Institutional Position Lifecycle Manager.
//
// Static institutional checklist TEMPLATES for the 9 Strategy Library
// keys (lib/optionsStrategyLibrary.ts, Phase 35, unmodified — this file
// reuses that module's own OptionsStrategyTemplateKey type rather than
// redefining the 9-strategy list a second time). Checklist DATA only —
// completing every item never submits an order, never triggers an
// adjustment, and never changes a position's lifecycle stage
// automatically. A position's own completion state (which items are
// checked) lives in the options_position_checklists table
// (lib/optionsPositionChecklists.ts route layer), instantiated from
// these templates exactly the way trading_strategy_checklists instances
// are instantiated from their own parent strategy's template
// (lib/tradingStrategyFramework.ts's instantiateChecklistItems(), Phase
// 30) — the same established pattern, applied to a static catalog
// instead of a user-authored one.

import { OPTIONS_STRATEGY_TEMPLATE_KEYS, type OptionsStrategyLibraryKey } from "./optionsStrategyLibrary.js";

export interface ChecklistItemTemplate {
  id: string;
  label: string;
  required: boolean;
}

const COMMON_ENTRY_ITEMS: ChecklistItemTemplate[] = [
  { id: "iv-rank-reviewed", label: "IV rank/percentile reviewed against the strategy's own ideal-market profile", required: true },
  { id: "liquidity-checked", label: "Bid/ask spread and open interest checked for acceptable liquidity", required: true },
  { id: "position-size-set", label: "Position size set within the account's own risk-per-position limit", required: true },
  { id: "exit-plan-defined", label: "Profit target and stop-loss/adjustment trigger defined before entry", required: true },
];

const ASSIGNMENT_RISK_ITEM: ChecklistItemTemplate = {
  id: "assignment-risk-understood",
  label: "Assignment risk on the short leg(s) understood and accepted",
  required: true,
};

const CHECKLIST_TEMPLATES: Record<OptionsStrategyLibraryKey, ChecklistItemTemplate[]> = {
  covered_call: [
    { id: "shares-owned", label: "100 shares per contract already owned (or being acquired simultaneously)", required: true },
    ...COMMON_ENTRY_ITEMS,
    { id: "called-away-accepted", label: "Willingness to have shares called away at the strike accepted", required: true },
    { id: "dividend-date-checked", label: "Ex-dividend date checked for early-assignment risk", required: false },
  ],
  cash_secured_put: [
    { id: "cash-reserved", label: "Full cash collateral (strike × 100 × contracts) reserved", required: true },
    ...COMMON_ENTRY_ITEMS,
    { id: "willing-to-own", label: "Willingness to be assigned and own the underlying at the strike confirmed", required: true },
  ],
  wheel: [
    { id: "cash-reserved", label: "Full cash collateral reserved for the current cash-secured-put leg", required: true },
    ...COMMON_ENTRY_ITEMS,
    { id: "wheel-stage-noted", label: "Current wheel stage (put phase vs. covered-call phase) noted", required: true },
    ASSIGNMENT_RISK_ITEM,
  ],
  iron_condor: [
    ...COMMON_ENTRY_ITEMS,
    { id: "wing-widths-symmetric", label: "Wing widths and short-strike deltas reviewed on both sides", required: true },
    { id: "max-loss-defined", label: "Max loss (spread width minus credit) confirmed within risk tolerance", required: true },
    ASSIGNMENT_RISK_ITEM,
  ],
  iron_fly: [
    ...COMMON_ENTRY_ITEMS,
    { id: "atm-short-strike-confirmed", label: "At-the-money short strike and wing widths confirmed", required: true },
    { id: "max-loss-defined", label: "Max loss (spread width minus credit) confirmed within risk tolerance", required: true },
    ASSIGNMENT_RISK_ITEM,
  ],
  calendar: [
    ...COMMON_ENTRY_ITEMS,
    { id: "term-structure-checked", label: "Front-month/back-month IV term structure checked for a favorable skew", required: true },
    { id: "pin-risk-considered", label: "Pin risk near the short strike at front-month expiration considered", required: false },
  ],
  diagonal: [
    ...COMMON_ENTRY_ITEMS,
    { id: "term-structure-checked", label: "Front-month/back-month IV term structure checked for a favorable skew", required: true },
    { id: "strike-offset-rationale", label: "Rationale for the strike offset between the two legs documented", required: false },
    ASSIGNMENT_RISK_ITEM,
  ],
  vertical_credit: [
    ...COMMON_ENTRY_ITEMS,
    { id: "max-loss-defined", label: "Max loss (spread width minus credit) confirmed within risk tolerance", required: true },
    ASSIGNMENT_RISK_ITEM,
  ],
  vertical_debit: [
    ...COMMON_ENTRY_ITEMS,
    { id: "max-loss-defined", label: "Max loss (net debit paid) confirmed within risk tolerance", required: true },
  ],
};

export function getChecklistTemplate(strategyKey: string): ChecklistItemTemplate[] | null {
  if (!(OPTIONS_STRATEGY_TEMPLATE_KEYS as readonly string[]).includes(strategyKey)) return null;
  return CHECKLIST_TEMPLATES[strategyKey as OptionsStrategyLibraryKey];
}

export function instantiateChecklistItems(strategyKey: string): { id: string; label: string; required: boolean; checked: boolean }[] | null {
  const template = getChecklistTemplate(strategyKey);
  if (!template) return null;
  return template.map((item) => ({ ...item, checked: false }));
}
