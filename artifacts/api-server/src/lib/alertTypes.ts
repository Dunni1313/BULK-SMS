// Version 1 Release Candidate (RC1) hardening — extracted from
// lib/notifications.ts into its own file to break a type-only circular
// dependency between lib/notifications.ts and lib/monitoringEngine.ts
// (notifications.ts imports evaluator functions FROM monitoringEngine.ts;
// monitoringEngine.ts imports the AlertCandidate/AlertSeverity TYPES back
// FROM notifications.ts). The cycle was always erased at compile time
// (every monitoringEngine.ts import of these was already `import type`,
// so it never affected runtime behaviour or `pnpm run typecheck`), but it
// showed up as a real structural cycle in `madge --circular`, which this
// project's own prior Phase 9 Release Checklist tracked as a "zero
// circular dependencies" quality gate. Pure type relocation — no
// behavioural change, no new logic. lib/notifications.ts re-exports these
// three types unchanged so every existing importer (including
// routes/monitoringEngine.ts) keeps compiling with zero changes of its
// own.

export type AlertType =
  | "watchlist_target_crossed"
  | "risk_cap_breached"
  | "decision_change"
  | "valuation_change"
  | "quality_change"
  | "committee_change"
  | "tomnash_change"
  | "financial_deterioration"
  | "dividend_change"
  | "earnings_alert"
  | "portfolio_drift"
  | "sector_concentration_breach"
  | "position_sizing_breach"
  | "opportunity_match";

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertCandidate {
  type: AlertType;
  title: string;
  message: string;
  dataSource: "SIMULATED" | "LIVE";
  relatedSymbol: string | null;
  dedupKey: string;
  // Phase 16 — Reason/Evidence/Previous/Current/Recommended-Action, in
  // addition to the title/message every alert already carried. Optional so
  // every pre-Phase-16 AlertCandidate literal (there are none left after
  // this sprint's own enrichment, but the type stays structurally
  // permissive) still type-checks; every candidate this codebase actually
  // produces now supplies a real severity.
  severity?: AlertSeverity;
  previousValue?: string | null;
  currentValue?: string | null;
  evidence?: string[];
  recommendedAction?: string;
}
