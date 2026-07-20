// Phase 30 — Institutional Strategy Framework.
//
// ARCHITECTURE AND FRAMEWORK PHASE, NOT A STRATEGY IMPLEMENTATION PHASE.
// Nothing in this file (or anywhere else added this phase) implements a
// named trading methodology (ICT, SMC, ASAD, Trader Bill, Tom Nash, Dunni
// Framework, or any other), generates a trading signal, predicts a price,
// recommends buying or selling, or executes anything against a broker.
// This file defines ONLY the reusable framework future strategies (built
// in later, separately-approved phases) will plug into: a strategy is a
// user-authored METADATA record — name, description, category,
// timeframes, markets, required evidence, a checklist template,
// educational notes, references, version — never a rule engine.
//
// This supersedes-in-scope, but does not modify or delete,
// lib/trading/strategyService.ts's own Phase 24 stub (StrategyCategory,
// StrategyDefinition, STRATEGY_REGISTRY, getStrategyByKey) — that file's
// own exports are untouched (zero lines changed) and remain available;
// this file defines the richer, persisted model this phase's approved
// scope actually calls for, under distinct type names so both modules
// can be imported side by side without collision.
//
// Every "evidence" concept here is a CITATION, never a calculation: an
// EvidenceLink packages a label/detail/optional deep-link URL pointing at
// an already-computed output from another engine module (Market
// Structure, Liquidity, Sessions, Risk, Trade Plans, Journal, AI Coach) —
// this file never imports or calls any of those modules, and never
// fabricates a number.

import type { Timeframe } from "./tradingMarketData.js";

// ─── Strategy Categories ────────────────────────────────────────────────
// Deliberately generic/structural, never a named methodology.

export type StrategyCategory =
  | "trend"
  | "reversal"
  | "breakout"
  | "range"
  | "scalping"
  | "swing"
  | "position"
  | "other";

export const STRATEGY_CATEGORIES: StrategyCategory[] = [
  "trend",
  "reversal",
  "breakout",
  "range",
  "scalping",
  "swing",
  "position",
  "other",
];

export const STRATEGY_CATEGORY_LABELS: Record<StrategyCategory, string> = {
  trend: "Trend Following",
  reversal: "Reversal",
  breakout: "Breakout",
  range: "Range / Mean Reversion",
  scalping: "Scalping",
  swing: "Swing Trading",
  position: "Position Trading",
  other: "Other",
};

// ─── Evidence Framework ─────────────────────────────────────────────────
// The vocabulary of deterministic output sources a strategy/checklist may
// cite. No calculation happens here — this is purely a citation shape.

export type EvidenceSourceType =
  | "structure"
  | "liquidity"
  | "session"
  | "risk"
  | "trade-plan"
  | "journal"
  | "coach";

export const EVIDENCE_SOURCE_TYPES: EvidenceSourceType[] = [
  "structure",
  "liquidity",
  "session",
  "risk",
  "trade-plan",
  "journal",
  "coach",
];

export const EVIDENCE_SOURCE_LABELS: Record<EvidenceSourceType, string> = {
  structure: "Market Structure Workbench",
  liquidity: "Liquidity & Session Workbench",
  session: "Trading Session",
  risk: "Risk Studio",
  "trade-plan": "Trade Planning Studio",
  journal: "Trading Journal",
  coach: "Trading AI Coach",
};

// Deep-link targets an evidence citation's url may point at — reused
// verbatim from the already-shipped pages, never a new route.
export const EVIDENCE_SOURCE_HREFS: Record<EvidenceSourceType, string> = {
  structure: "/market-structure-workbench",
  liquidity: "/liquidity-workbench",
  session: "/liquidity-workbench",
  risk: "/trade-planning-studio",
  "trade-plan": "/trade-planning-studio",
  journal: "/trading-journal",
  coach: "/trading-ai-coach",
};

export interface StrategyEvidenceLink {
  sourceType: EvidenceSourceType;
  label: string;
  detail: string;
  url: string | null;
}

/** Pure constructor — packages an evidence citation, never computes anything. */
export function buildEvidenceLink(
  sourceType: EvidenceSourceType,
  detail: string,
  symbol?: string | null,
): StrategyEvidenceLink {
  const base = EVIDENCE_SOURCE_HREFS[sourceType];
  const url = symbol ? `${base}?symbol=${encodeURIComponent(symbol)}` : base;
  return {
    sourceType,
    label: EVIDENCE_SOURCE_LABELS[sourceType],
    detail,
    url,
  };
}

// ─── Strategy Checklist Framework (template + engine) ───────────────────
// No strategy-specific checklist content is hardcoded anywhere in this
// file — every item is authored by the user as part of their own
// strategy's metadata.

export interface StrategyChecklistItemDefinition {
  id: string;
  label: string;
  required: boolean;
}

export interface StrategyChecklistItemState {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
  notes: string;
  evidenceLinks: StrategyEvidenceLink[];
}

export type ChecklistCompletionStatus = "in_progress" | "complete";

/** Builds a fresh checklist instance's items from a strategy's own template — no state carried over, nothing fabricated. */
export function instantiateChecklistItems(
  template: StrategyChecklistItemDefinition[],
): StrategyChecklistItemState[] {
  return template.map((t) => ({
    id: t.id,
    label: t.label,
    required: t.required,
    completed: false,
    notes: "",
    evidenceLinks: [],
  }));
}

export interface ChecklistCompletionSummary {
  requiredTotal: number;
  requiredCompleted: number;
  optionalTotal: number;
  optionalCompleted: number;
  allRequiredComplete: boolean;
  percentComplete: number;
}

/** Pure derived statistics over an already-persisted checklist's items — honestly 0%, never NaN, for an empty checklist. */
export function computeChecklistCompletion(items: StrategyChecklistItemState[]): ChecklistCompletionSummary {
  const required = items.filter((i) => i.required);
  const optional = items.filter((i) => !i.required);
  const requiredCompleted = required.filter((i) => i.completed).length;
  const optionalCompleted = optional.filter((i) => i.completed).length;
  const totalCompleted = requiredCompleted + optionalCompleted;
  const percentComplete = items.length === 0 ? 0 : Math.round((totalCompleted / items.length) * 100);

  return {
    requiredTotal: required.length,
    requiredCompleted,
    optionalTotal: optional.length,
    optionalCompleted,
    allRequiredComplete: required.length > 0 ? requiredCompleted === required.length : items.length === 0 ? false : true,
    percentComplete,
  };
}

/** A checklist is "complete" iff every required item is done (an empty checklist is honestly never "complete"). */
export function deriveChecklistStatus(items: StrategyChecklistItemState[]): ChecklistCompletionStatus {
  if (items.length === 0) return "in_progress";
  const summary = computeChecklistCompletion(items);
  return summary.allRequiredComplete ? "complete" : "in_progress";
}

export interface StrategyChecklistInstance {
  id: number;
  strategyId: number;
  symbol: string | null;
  status: ChecklistCompletionStatus;
  items: StrategyChecklistItemState[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Strategy Metadata Model ─────────────────────────────────────────────

export interface StrategyMetadataInput {
  name: string;
  description: string;
  category: StrategyCategory;
  timeframes: Timeframe[];
  markets: string[];
  requiredEvidence: EvidenceSourceType[];
  checklist: StrategyChecklistItemDefinition[];
  educationalNotes: string;
  references: string[];
  version: string;
}

export interface StrategyMetadata extends StrategyMetadataInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Strategy Validation Framework ───────────────────────────────────────
// Purely STRUCTURAL validation of a strategy's own metadata — never a
// judgment on whether the strategy itself is "good," which would be
// strategy logic and is explicitly out of scope this phase.

const VALID_TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "1D"];
const VERSION_RE = /^\d+(\.\d+){0,2}$/;

export interface StrategyValidationIssue {
  field: string;
  message: string;
}

export function validateStrategyMetadata(input: StrategyMetadataInput): StrategyValidationIssue[] {
  const issues: StrategyValidationIssue[] = [];

  if (!input.name || !input.name.trim()) issues.push({ field: "name", message: "Name is required." });
  if (!input.description || !input.description.trim())
    issues.push({ field: "description", message: "Description is required." });

  if (!STRATEGY_CATEGORIES.includes(input.category))
    issues.push({ field: "category", message: `Category must be one of: ${STRATEGY_CATEGORIES.join(", ")}.` });

  if (!Array.isArray(input.timeframes) || input.timeframes.length === 0) {
    issues.push({ field: "timeframes", message: "At least one timeframe is required." });
  } else {
    const bad = input.timeframes.filter((t) => !VALID_TIMEFRAMES.includes(t));
    if (bad.length > 0)
      issues.push({ field: "timeframes", message: `Invalid timeframe(s): ${bad.join(", ")}.` });
  }

  if (!Array.isArray(input.markets) || input.markets.length === 0)
    issues.push({ field: "markets", message: "At least one market is required." });

  if (!Array.isArray(input.requiredEvidence) || input.requiredEvidence.length === 0) {
    issues.push({ field: "requiredEvidence", message: "At least one required evidence source is required." });
  } else {
    const bad = input.requiredEvidence.filter((e) => !EVIDENCE_SOURCE_TYPES.includes(e));
    if (bad.length > 0)
      issues.push({ field: "requiredEvidence", message: `Invalid evidence source(s): ${bad.join(", ")}.` });
  }

  if (!Array.isArray(input.checklist) || input.checklist.length === 0) {
    issues.push({ field: "checklist", message: "At least one checklist item is required." });
  } else {
    const emptyLabel = input.checklist.some((c) => !c.id || !c.label || !c.label.trim());
    if (emptyLabel) issues.push({ field: "checklist", message: "Every checklist item needs a non-empty id and label." });
    const ids = input.checklist.map((c) => c.id);
    if (new Set(ids).size !== ids.length)
      issues.push({ field: "checklist", message: "Checklist item ids must be unique." });
  }

  if (!Array.isArray(input.references)) issues.push({ field: "references", message: "References must be a list." });

  if (!input.version || !VERSION_RE.test(input.version))
    issues.push({ field: "version", message: "Version must look like '1.0.0' (digits and dots only)." });

  return issues;
}

export function isStrategyMetadataValid(input: StrategyMetadataInput): boolean {
  return validateStrategyMetadata(input).length === 0;
}

// ─── Strategy Learning Framework projection ──────────────────────────────
// A thin, read-only view of a strategy's own educational fields, reused
// identically by the Learning Centre viewer and the Reporting Centre —
// never a separately-authored lesson.

export interface StrategyLearningSummary {
  id: number;
  name: string;
  category: StrategyCategory;
  version: string;
  educationalNotes: string;
  references: string[];
  requiredEvidence: EvidenceSourceType[];
  checklistItemCount: number;
}

export function toStrategyLearningSummary(meta: StrategyMetadata): StrategyLearningSummary {
  return {
    id: meta.id,
    name: meta.name,
    category: meta.category,
    version: meta.version,
    educationalNotes: meta.educationalNotes,
    references: meta.references,
    requiredEvidence: meta.requiredEvidence,
    checklistItemCount: meta.checklist.length,
  };
}
