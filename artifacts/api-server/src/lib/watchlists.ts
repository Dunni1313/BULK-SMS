// Phase 43 — Institutional Watchlists & Opportunity Dashboard.
//
// CRUD for the one genuinely new persistence primitive this phase
// introduces: named, taggable, manually-orderable watchlists (see
// lib/db/src/schema/investingWatchlists.ts's own header for the full
// design rationale). This file introduces zero valuation/scoring
// logic — it never resolves a symbol's price, allocation, or any other
// computed figure; that is lib/watchlistsEngine.ts's job. No watchlist or
// item is ever auto-created — every row here originates from an explicit
// user action.

import {
  db,
  investingWatchlistsTable,
  investingWatchlistItemsTable,
  type InvestingWatchlistRow,
  type InvestingWatchlistItemRow,
  type InsertInvestingWatchlist,
  type InsertInvestingWatchlistItem,
} from "@workspace/db";
import { and, eq, asc, inArray } from "drizzle-orm";

export const WATCHLIST_KINDS = ["personal", "institutional"] as const;
export type WatchlistKind = (typeof WATCHLIST_KINDS)[number];

// ─── Watchlists ────────────────────────────────────────────────────────

export async function listWatchlists(userId: string): Promise<InvestingWatchlistRow[]> {
  return db
    .select()
    .from(investingWatchlistsTable)
    .where(eq(investingWatchlistsTable.userId, userId))
    .orderBy(asc(investingWatchlistsTable.sortOrder), asc(investingWatchlistsTable.createdAt));
}

export async function getWatchlist(userId: string, id: number): Promise<InvestingWatchlistRow | null> {
  const [row] = await db
    .select()
    .from(investingWatchlistsTable)
    .where(and(eq(investingWatchlistsTable.id, id), eq(investingWatchlistsTable.userId, userId)));
  return row ?? null;
}

export async function createWatchlist(userId: string, input: Omit<InsertInvestingWatchlist, "userId">): Promise<InvestingWatchlistRow> {
  const [row] = await db
    .insert(investingWatchlistsTable)
    .values({ ...input, userId })
    .returning();
  return row;
}

export async function updateWatchlist(userId: string, id: number, input: Partial<Omit<InsertInvestingWatchlist, "userId">>): Promise<InvestingWatchlistRow | null> {
  const [row] = await db
    .update(investingWatchlistsTable)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(investingWatchlistsTable.id, id), eq(investingWatchlistsTable.userId, userId)))
    .returning();
  return row ?? null;
}

// Deletion cascades to the watchlist's own items (ON DELETE CASCADE, see
// the schema's own header comment) — a routine self-service cleanup of
// your own sub-resource, matching investing_holdings' own precedent.
export async function deleteWatchlist(userId: string, id: number): Promise<boolean> {
  const [row] = await db
    .delete(investingWatchlistsTable)
    .where(and(eq(investingWatchlistsTable.id, id), eq(investingWatchlistsTable.userId, userId)))
    .returning({ id: investingWatchlistsTable.id });
  return !!row;
}

export async function reorderWatchlists(userId: string, orderedIds: number[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(investingWatchlistsTable)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(and(eq(investingWatchlistsTable.id, id), eq(investingWatchlistsTable.userId, userId))),
    ),
  );
}

// ─── Items ─────────────────────────────────────────────────────────────

export async function listItems(userId: string, watchlistId: number): Promise<InvestingWatchlistItemRow[]> {
  return db
    .select()
    .from(investingWatchlistItemsTable)
    .where(and(eq(investingWatchlistItemsTable.watchlistId, watchlistId), eq(investingWatchlistItemsTable.userId, userId)))
    .orderBy(asc(investingWatchlistItemsTable.sortOrder), asc(investingWatchlistItemsTable.addedAt));
}

// All of a user's own watchlist items across every list — the composition
// layer's own entry point for building the cross-watchlist dashboard.
export async function listAllItems(userId: string): Promise<InvestingWatchlistItemRow[]> {
  return db.select().from(investingWatchlistItemsTable).where(eq(investingWatchlistItemsTable.userId, userId));
}

export async function getItem(userId: string, watchlistId: number, itemId: number): Promise<InvestingWatchlistItemRow | null> {
  const [row] = await db
    .select()
    .from(investingWatchlistItemsTable)
    .where(and(eq(investingWatchlistItemsTable.id, itemId), eq(investingWatchlistItemsTable.watchlistId, watchlistId), eq(investingWatchlistItemsTable.userId, userId)));
  return row ?? null;
}

export interface AddItemInput extends Omit<InsertInvestingWatchlistItem, "symbol"> {
  symbol: string;
}

export async function addItem(userId: string, watchlistId: number, input: AddItemInput): Promise<InvestingWatchlistItemRow | null> {
  const owned = await getWatchlist(userId, watchlistId);
  if (!owned) return null;
  const [row] = await db
    .insert(investingWatchlistItemsTable)
    .values({ ...input, symbol: input.symbol.toUpperCase().trim(), watchlistId, userId })
    .returning();
  return row;
}

export async function updateItem(
  userId: string,
  watchlistId: number,
  itemId: number,
  input: Partial<Omit<InsertInvestingWatchlistItem, "symbol">> & { symbol?: string },
): Promise<InvestingWatchlistItemRow | null> {
  const patch = { ...input, ...(input.symbol ? { symbol: input.symbol.toUpperCase().trim() } : {}) };
  const [row] = await db
    .update(investingWatchlistItemsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(investingWatchlistItemsTable.id, itemId), eq(investingWatchlistItemsTable.watchlistId, watchlistId), eq(investingWatchlistItemsTable.userId, userId)))
    .returning();
  return row ?? null;
}

export async function removeItem(userId: string, watchlistId: number, itemId: number): Promise<boolean> {
  const [row] = await db
    .delete(investingWatchlistItemsTable)
    .where(and(eq(investingWatchlistItemsTable.id, itemId), eq(investingWatchlistItemsTable.watchlistId, watchlistId), eq(investingWatchlistItemsTable.userId, userId)))
    .returning({ id: investingWatchlistItemsTable.id });
  return !!row;
}

export async function reorderItems(userId: string, watchlistId: number, orderedIds: number[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(investingWatchlistItemsTable)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(and(eq(investingWatchlistItemsTable.id, id), eq(investingWatchlistItemsTable.watchlistId, watchlistId), eq(investingWatchlistItemsTable.userId, userId))),
    ),
  );
}

export async function countItemsByWatchlist(userId: string, watchlistIds: number[]): Promise<Map<number, number>> {
  if (watchlistIds.length === 0) return new Map();
  const rows = await db
    .select({ watchlistId: investingWatchlistItemsTable.watchlistId })
    .from(investingWatchlistItemsTable)
    .where(and(eq(investingWatchlistItemsTable.userId, userId), inArray(investingWatchlistItemsTable.watchlistId, watchlistIds)));
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.watchlistId, (counts.get(r.watchlistId) ?? 0) + 1);
  return counts;
}
