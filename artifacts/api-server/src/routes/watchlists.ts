// Phase 43 — Institutional Watchlists & Opportunity Dashboard.
import { Router, type IRouter } from "express";
import {
  ListInvestingWatchlistsResponse,
  CreateInvestingWatchlistBody,
  UpdateInvestingWatchlistResponse,
  ReorderInvestingWatchlistsBody,
  ReorderInvestingWatchlistsResponse,
  GetWatchlistsDashboardResponse,
  GetInvestingWatchlistResponse,
  UpdateInvestingWatchlistBody,
  DeleteInvestingWatchlistResponse,
  AddInvestingWatchlistItemBody,
  UpdateInvestingWatchlistItemResponse,
  ReorderInvestingWatchlistItemsBody,
  ReorderInvestingWatchlistItemsResponse,
  UpdateInvestingWatchlistItemBody,
  RemoveInvestingWatchlistItemResponse,
  ListWatchlistsCoachTopicsResponse,
  GetWatchlistsCoachTopicResponse,
  ListWatchlistsLearningResponse,
  GetWatchlistsLearningResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import {
  listWatchlists,
  getWatchlist,
  createWatchlist,
  updateWatchlist,
  deleteWatchlist,
  reorderWatchlists,
  listItems,
  addItem,
  updateItem,
  removeItem,
  reorderItems,
  countItemsByWatchlist,
} from "../lib/watchlists.js";
import { buildWatchlistsDashboard } from "../lib/watchlistsEngine.js";
import { allWatchlistsTopics, explainWatchlistsTopic } from "../lib/watchlistsCoach.js";
import { allWatchlistsLearning, getWatchlistsLearning } from "../lib/watchlistsLearning.js";
import type { InvestingWatchlistRow, InvestingWatchlistItemRow } from "@workspace/db";

const router: IRouter = Router();

function watchlistToJson(row: InvestingWatchlistRow, itemCount: number) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    description: row.description,
    archived: row.archived,
    sortOrder: row.sortOrder,
    itemCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function itemToJson(row: InvestingWatchlistItemRow) {
  return {
    id: row.id,
    watchlistId: row.watchlistId,
    symbol: row.symbol,
    category: row.category,
    tags: row.tags,
    notes: row.notes,
    sortOrder: row.sortOrder,
    addedAt: row.addedAt.toISOString(),
  };
}

router.get("/investing/watchlists", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await listWatchlists(userId);
  const counts = await countItemsByWatchlist(userId, rows.map((r) => r.id));
  res.json(ListInvestingWatchlistsResponse.parse(rows.map((r) => watchlistToJson(r, counts.get(r.id) ?? 0))));
});

router.post("/investing/watchlists", async (req, res): Promise<void> => {
  const parsed = CreateInvestingWatchlistBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const row = await createWatchlist(userId, parsed.data);
  res.status(201).json(UpdateInvestingWatchlistResponse.parse(watchlistToJson(row, 0)));
});

router.post("/investing/watchlists/reorder", async (req, res): Promise<void> => {
  const parsed = ReorderInvestingWatchlistsBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  await reorderWatchlists(userId, parsed.data.orderedIds);
  res.json(ReorderInvestingWatchlistsResponse.parse({ success: true }));
});

router.get("/investing/watchlists/dashboard", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const dashboard = await buildWatchlistsDashboard(userId);
  res.json(GetWatchlistsDashboardResponse.parse(dashboard));
});

// These static-suffix routes (coach/learning) must be registered BEFORE
// the generic /investing/watchlists/:id family below — Express matches
// route layers of the same HTTP method in registration order, so a GET on
// "/investing/watchlists/coach" would otherwise be swallowed by the
// earlier-registered GET "/investing/watchlists/:id" (with id="coach").

router.get("/investing/watchlists/coach", async (_req, res): Promise<void> => {
  res.json(ListWatchlistsCoachTopicsResponse.parse(allWatchlistsTopics()));
});

router.get("/investing/watchlists/coach/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const explanation = explainWatchlistsTopic(topic);
  if (!explanation) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetWatchlistsCoachTopicResponse.parse(explanation));
});

router.get("/investing/watchlists/learning", async (_req, res): Promise<void> => {
  res.json(ListWatchlistsLearningResponse.parse(allWatchlistsLearning()));
});

router.get("/investing/watchlists/learning/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const learning = getWatchlistsLearning(topic);
  if (!learning) {
    res.status(404).json({ error: "Unknown learning topic" });
    return;
  }
  res.json(GetWatchlistsLearningResponse.parse(learning));
});

router.get("/investing/watchlists/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid watchlist id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const row = await getWatchlist(userId, id);
  if (!row) {
    res.status(404).json({ error: "Watchlist not found" });
    return;
  }
  const items = await listItems(userId, id);
  res.json(GetInvestingWatchlistResponse.parse({ ...watchlistToJson(row, items.length), items: items.map(itemToJson) }));
});

router.patch("/investing/watchlists/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid watchlist id" });
    return;
  }
  const parsed = UpdateInvestingWatchlistBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const row = await updateWatchlist(userId, id, parsed.data);
  if (!row) {
    res.status(404).json({ error: "Watchlist not found" });
    return;
  }
  const counts = await countItemsByWatchlist(userId, [id]);
  res.json(UpdateInvestingWatchlistResponse.parse(watchlistToJson(row, counts.get(id) ?? 0)));
});

router.delete("/investing/watchlists/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid watchlist id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const deleted = await deleteWatchlist(userId, id);
  if (!deleted) {
    res.status(404).json({ error: "Watchlist not found" });
    return;
  }
  res.json(DeleteInvestingWatchlistResponse.parse({ success: true }));
});

router.post("/investing/watchlists/:id/items", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid watchlist id" });
    return;
  }
  const parsed = AddInvestingWatchlistItemBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  // addItem() now signals "watchlist not found" (null) and "already on
  // this watchlist" ("duplicate") via explicit return values (an atomic
  // ON CONFLICT DO NOTHING insert internally) rather than throwing — same
  // honest 404/400 the route has always returned for these two cases,
  // just no longer relying on catching a driver exception. See
  // docs/Database-Concurrency-Fixes.md.
  const row = await addItem(userId, id, parsed.data);
  if (row === null) {
    res.status(404).json({ error: "Watchlist not found" });
    return;
  }
  if (row === "duplicate") {
    res.status(400).json({ error: `${parsed.data.symbol} is already on this watchlist` });
    return;
  }
  res.status(201).json(UpdateInvestingWatchlistItemResponse.parse(itemToJson(row)));
});

router.post("/investing/watchlists/:id/items/reorder", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid watchlist id" });
    return;
  }
  const parsed = ReorderInvestingWatchlistItemsBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  await reorderItems(userId, id, parsed.data.orderedIds);
  res.json(ReorderInvestingWatchlistItemsResponse.parse({ success: true }));
});

router.patch("/investing/watchlists/:id/items/:itemId", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  if (!Number.isInteger(id) || !Number.isInteger(itemId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateInvestingWatchlistItemBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const row = await updateItem(userId, id, itemId, parsed.data);
  if (!row) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json(UpdateInvestingWatchlistItemResponse.parse(itemToJson(row)));
});

router.delete("/investing/watchlists/:id/items/:itemId", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  if (!Number.isInteger(id) || !Number.isInteger(itemId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const removed = await removeItem(userId, id, itemId);
  if (!removed) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json(RemoveInvestingWatchlistItemResponse.parse({ success: true }));
});

export default router;
