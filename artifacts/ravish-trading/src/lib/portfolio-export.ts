// Phase 10 — Institutional Platform Polish & Control Center. A genuine,
// read-only client-side CSV export of the user's own open positions
// (Trade rows already fetched via useListTrades({status:"open"}) — no new
// backend endpoint, no new calculation, never a fabricated column).

import type { Trade } from "@workspace/api-client-react";

const COLUMNS: { key: keyof Trade; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "symbol", label: "Symbol" },
  { key: "strategy", label: "Strategy" },
  { key: "status", label: "Status" },
  { key: "openDate", label: "Open Date" },
  { key: "expiration", label: "Expiration" },
  { key: "credit", label: "Credit" },
  { key: "maxProfit", label: "Max Profit" },
  { key: "maxLoss", label: "Max Loss" },
  { key: "currentPnl", label: "Current P/L" },
  { key: "currentPnlPercent", label: "Current P/L %" },
  { key: "pop", label: "POP" },
  { key: "ev", label: "EV" },
  { key: "theta", label: "Theta" },
  { key: "ravishScore", label: "Ravish Score" },
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function tradesToCsv(trades: Trade[]): string {
  const header = COLUMNS.map((c) => csvCell(c.label)).join(",");
  const rows = trades.map((t) => COLUMNS.map((c) => csvCell(t[c.key])).join(","));
  return [header, ...rows].join("\n");
}

export function downloadPortfolioCsv(trades: Trade[], filename = "portfolio-positions.csv"): void {
  const csv = tradesToCsv(trades);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
