// Phase 4, Sprint 56 — Alerts & Notifications (approved Phase 4 plan,
// Sprint 56; see docs/Phase-4-Master-Execution-Plan.md's Sprint 56 as-built
// note). Extracted, unmodified in behavior, from routes/stockAnalyst.ts's
// own private `computeWatchlistTargets()` (Phase 2, Sprint 27) — that
// route is still the only caller until this sprint; lib/notifications.ts is
// the second, which is exactly the trigger this codebase's own established
// "extract on the second real consumer, not preemptively" convention calls
// for (the same precedent as classifyMarginOfSafety(), classifyMoatRating(),
// historyConsistencyScore(), etc.). This relocation changes zero logic —
// confirmed by the pre-existing valueWatchlist.route.test.ts's own
// checkTargets assertions passing unmodified after the move.
//
// Never fabricates a crossed/not-crossed verdict for a target the user
// never set (null, not false) or a symbol that can't be resolved.

import type { valueWatchlistTable } from "@workspace/db";
import type { FundamentalsProvider } from "./fundamentals.js";
import { resolveFundamentals } from "./fundamentals.js";

export interface WatchlistTargetCheck {
  currentPrice: number | null;
  priceTargetCrossed: boolean | null;
  marginOfSafetyTargetCrossed: boolean | null;
}

export async function computeWatchlistTargets(
  row: typeof valueWatchlistTable.$inferSelect,
  provider: FundamentalsProvider,
): Promise<WatchlistTargetCheck> {
  const f = await resolveFundamentals(provider, row.symbol).catch(() => null);
  const currentPrice = f?.price ?? null;
  const priceTargetCrossed =
    currentPrice != null && row.desiredBuyPrice != null ? currentPrice <= row.desiredBuyPrice : null;
  const marginOfSafetyTargetCrossed =
    currentPrice != null && row.fairValueEstimate != null && row.fairValueEstimate > 0
      ? ((row.fairValueEstimate - currentPrice) / row.fairValueEstimate) * 100 >= row.marginOfSafetyTarget
      : null;
  return { currentPrice, priceTargetCrossed, marginOfSafetyTargetCrossed };
}
