// v1.5.0, Sprint 16 — Institutional Workflow Automation Engine.
//
// The one genuinely new server-side detection this sprint adds, wired
// into lib/notifications.ts's own already-existing evaluate/persist/
// scheduler pipeline (Phase 4, Sprint 56) — never a second, duplicate
// notification system. Every other workflow automation named in the
// approved scope (Notebook->Strategy, Strategy->Trade Plan, Trade
// Plan->Decision, Decision->Execution, Portfolio risk->Review, Learning
// weakness->Practice) is modeled purely on the frontend
// (lib/workflowAutomation.ts) as a Task, since those signals only ever
// exist as client-fetched data (notebooks/strategies/trade plans have no
// backend "event" concept, and the portfolio/learning signals are already
// covered by the platform's existing Phase 16 Monitoring Engine alerts —
// see that module's own evaluatePortfolioMonitoringAlerts()). Journal
// reminders are the one case genuinely worth a real, async push
// notification: a closed trade with no journal entry is real server-side
// state (the "trades"/"journal_entries" tables), and the value of the
// reminder specifically comes from surfacing it even when the user isn't
// on the page — the same reasoning Sprint 56 itself already used for
// watchlist/risk alerts.
//
// Reuses the exact "last 20 closed trades checked against which journal
// entries reference them" computation already established in 3 different
// frontend files (useWorkflowSnapshot.ts, useTradeLifecycle.ts,
// InstitutionalCommandCentre.tsx) — a straightforward server-side port,
// never a new formula.

import { db, tradesTable, journalEntriesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import type { AlertCandidate } from "./alertTypes.js";

const RECENT_CLOSED_TRADES_LIMIT = 20;

export async function evaluateJournalReminders(userId: string): Promise<AlertCandidate[]> {
  const closedTrades = await db
    .select({ id: tradesTable.id, symbol: tradesTable.symbol })
    .from(tradesTable)
    .where(and(eq(tradesTable.userId, userId), eq(tradesTable.status, "closed")))
    .orderBy(desc(tradesTable.closeDate))
    .limit(RECENT_CLOSED_TRADES_LIMIT);
  if (closedTrades.length === 0) return [];

  const journalEntries = await db
    .select({ tradeId: journalEntriesTable.tradeId })
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.userId, userId));
  const journaledTradeIds = new Set(journalEntries.map((j) => j.tradeId).filter((id): id is number => id !== null));

  const pending = closedTrades.filter((t) => !journaledTradeIds.has(t.id));
  if (pending.length === 0) return [];

  return [
    {
      type: "journal_entry_pending",
      title: `${pending.length} closed trade${pending.length === 1 ? "" : "s"} still need journaling`,
      message: `${pending.map((t) => t.symbol).join(", ")} — recently closed with no journal entry yet.`,
      // Journal reminders are a fact about your own account records
      // (trades/journal_entries), never a market-data reading — there is
      // no live/simulated provider involved in this detection at all, so
      // neither label is strictly accurate. "SIMULATED" is used
      // honestly-conservatively here (never overclaiming a verified live
      // feed that doesn't exist for this alert), matching this platform's
      // own disclosed default paper-trading posture throughout.
      dataSource: "SIMULATED",
      relatedSymbol: pending.length === 1 ? pending[0].symbol : null,
      dedupKey: "workflow:journal-pending",
      severity: "info",
      previousValue: null,
      currentValue: `${pending.length} pending`,
      evidence: pending.map((t) => `${t.symbol} (trade #${t.id})`),
      recommendedAction: "Log these trades in the Trading Journal or Trade Journal page.",
    },
  ];
}
