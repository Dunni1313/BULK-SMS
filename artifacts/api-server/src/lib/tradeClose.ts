// Shared close-position logic, used by both the manual DELETE /trades/:id route
// and the auto-adjustment loop so a position is always closed and journaled the
// exact same way (status + realized P&L + journal entry) regardless of who pulls
// the trigger.

import { db, tradesTable, journalEntriesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { computeTradeGreeks, getSettingsRow } from "./serverState.js";
import { computeStopLoss } from "./risk.js";

export interface ClosedTrade {
  trade: typeof tradesTable.$inferSelect;
  exitReason: string;
  realizedPnl: number;
  realizedPnlPercent: number;
}

// Close one open/pending trade. `exitReasonOverride` lets the auto-adjustment loop
// label the exit (e.g. "Auto de-risk"); when omitted the reason is derived from the
// stop-loss / profit-target rules exactly as the manual close did.
//
// Phase 1, Sprint 7 — userId is an explicit parameter: the manual DELETE
// /trades/:id route resolves the real authenticated user (or the legacy-owner
// stand-in if not logged in); the auto-adjustment loop keeps passing the same
// legacy-owner id it always has (its real per-user redesign is Sprint 8's job).
export async function closeTradePosition(
  trade: typeof tradesTable.$inferSelect,
  userId: string,
  exitReasonOverride?: string,
): Promise<ClosedTrade> {
  const g = computeTradeGreeks(trade);
  const settings = await getSettingsRow(userId);
  const stopLoss = computeStopLoss(trade.credit, trade.maxLoss, settings.stopLossMultiplier);
  const target75 = trade.maxProfit * (settings.profitTarget75 / 100);

  let exitReason = exitReasonOverride ?? "Manual exit";
  if (!exitReasonOverride) {
    if (g.unrealizedPnl <= stopLoss) exitReason = "Stop loss hit";
    else if (g.unrealizedPnl >= target75) exitReason = "Profit target reached (75%)";
  }

  const [updated] = await db
    .update(tradesTable)
    .set({
      status: "closed",
      closeDate: new Date(),
      exitReason,
      currentPnl: g.unrealizedPnl,
      currentPnlPercent: g.unrealizedPnlPercent,
    })
    .where(and(eq(tradesTable.id, trade.id), eq(tradesTable.userId, userId)))
    .returning();

  const pnl = g.unrealizedPnl;
  await db.insert(journalEntriesTable).values({
    userId,
    tradeId: updated.id,
    title: `Closed ${updated.symbol} ${updated.strategy.replace(/_/g, " ")}`,
    content: `${exitReason}. Realized P&L of $${pnl.toFixed(2)} (${g.unrealizedPnlPercent.toFixed(1)}% of max profit) at close.`,
    mood: pnl >= 0 ? "confident" : "cautious",
    tags: [updated.strategy, exitReason.toLowerCase().includes("stop") || pnl < 0 ? "loss" : "win"],
    strategy: updated.strategy,
    entryCredit: updated.credit,
    maxProfit: updated.maxProfit,
    maxLoss: updated.maxLoss,
    ev: updated.ev,
    pop: updated.pop,
    ravishScore: updated.ravishScore,
    exitReason,
    realizedPnl: pnl,
  });

  return {
    trade: updated,
    exitReason,
    realizedPnl: pnl,
    realizedPnlPercent: g.unrealizedPnlPercent,
  };
}
