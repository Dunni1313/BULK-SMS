// Phase 3, Sprint 50 — Institutional Trading Engine, Institutional Dashboard
// (approved Phase 3 plan §21/§22's own "Sprint 46 (Dashboard)" acceptance
// bar; see docs/Phase-3-Trading-Engine-Execution-Plan.md's Sprint 50
// as-built note).
//
// Extracted, unmodified, from TradingResearch.tsx (Sprints 40-48) — these
// are pure presentational helpers (badge CSS-class mappers + a currency
// formatter + a trend icon), not engine calculations. Every one of Engine
// 2's actual scores/classifications is computed entirely server-side (Sprints
// 32-49); this module only maps an already-computed string enum to a
// Tailwind class or an icon, so it never duplicates business logic. Both
// TradingResearch.tsx and the new pages/InstitutionalDashboard.tsx import
// from here instead of each defining their own copy, per the explicit
// "reuse... do not duplicate" instruction for this sprint.

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function trendBadgeClass(trend: string): string {
  if (trend === "uptrend") return "border-emerald-500/40 text-emerald-400";
  if (trend === "downtrend") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground";
}

export function TrendIcon({ trend }: { trend: string }) {
  if (trend === "uptrend") return <TrendingUp className="h-4 w-4" />;
  if (trend === "downtrend") return <TrendingDown className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

export function confidenceBadgeClass(level: string): string {
  if (level === "High") return "border-emerald-500/40 text-emerald-400";
  if (level === "Moderate") return "border-amber-500/40 text-amber-400";
  return "border-border text-muted-foreground";
}

export function agreementBadgeClass(agreement: string): string {
  if (agreement === "unanimous") return "border-emerald-500/40 text-emerald-400";
  if (agreement === "majority") return "border-amber-500/40 text-amber-400";
  return "border-border text-muted-foreground";
}

export function regimeBadgeClass(regimeLabel: string): string {
  if (regimeLabel === "trending-bullish") return "border-emerald-500/40 text-emerald-400";
  if (regimeLabel === "trending-bearish") return "border-rose-500/40 text-rose-400";
  if (regimeLabel === "volatile-choppy") return "border-amber-500/40 text-amber-400";
  return "border-border text-muted-foreground";
}

export function volatilityBadgeClass(volatilityRegime: string): string {
  if (volatilityRegime === "high") return "border-amber-500/40 text-amber-400";
  if (volatilityRegime === "low") return "border-sky-500/40 text-sky-400";
  return "border-border text-muted-foreground";
}

export function riskGradeBadgeClass(label: string): string {
  if (label === "Excellent" || label === "Strong") return "border-emerald-500/40 text-emerald-400";
  if (label === "Moderate") return "border-amber-500/40 text-amber-400";
  if (label === "Elevated" || label === "Poor") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground";
}

export function liquidityBandBadgeClass(band: string): string {
  if (band === "High") return "border-emerald-500/40 text-emerald-400";
  if (band === "Moderate") return "border-amber-500/40 text-amber-400";
  return "border-rose-500/40 text-rose-400";
}

export function pressureBadgeClass(direction: string): string {
  if (direction === "buying") return "border-emerald-500/40 text-emerald-400";
  if (direction === "selling") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground";
}
