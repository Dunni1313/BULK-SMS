// Phase 23 — Executive Dashboard & Production Readiness (consolidation).
// Engine 1's counterpart to src/lib/trading-format.tsx (Engine 2) — the
// same badge-color-mapping and number-formatting helpers were previously
// copy-pasted, byte-identical, across several Institutional Investing
// Engine pages (ResearchTerminal.tsx, DecisionEngine.tsx,
// InvestmentCommitteeWorkbench.tsx, OpportunityDiscovery.tsx,
// StockResearch.tsx, PortfolioConstruction.tsx). Extracted here unmodified
// in behavior; every call site now imports from this module instead of
// redefining its own copy.
//
// fmtPct assumes a 0-1 fraction (the majority convention across these
// pages) — never conflated with a value that's already on a 0-100 scale
// (e.g. a confidence score), which callers format separately.

export function recommendationBadgeClass(rec: string): string {
  if (rec === "Buy" || rec === "Accumulate") return "border-emerald-500/40 text-emerald-400";
  if (rec === "Hold") return "border-border text-muted-foreground";
  if (rec === "Reduce") return "border-amber-500/40 text-amber-400";
  return "border-rose-500/40 text-rose-400"; // Sell, Avoid
}

export function checklistBadgeClass(status: string): string {
  if (status === "pass") return "border-emerald-500/40 text-emerald-400";
  if (status === "warning") return "border-amber-500/40 text-amber-400";
  if (status === "fail") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground/60"; // unavailable
}

export function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export function fmtPct(n: number | null | undefined, dp = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "n/a";
  return `${(n * 100).toFixed(dp)}%`;
}
