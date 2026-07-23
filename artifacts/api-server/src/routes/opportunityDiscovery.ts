// Phase 15 — Institutional Opportunity Discovery Engine.
//
// Thin route wrapper, zero business logic of its own — every real operation
// (scan orchestration, screener filtering, ranking, bucketing, comparison)
// lives in lib/opportunityDiscovery.ts, itself a pure composition layer over
// already-shipped engines (see that file's own header comment). This route
// only: resolves the request, resolves optional watchlist/portfolio context
// for bucket #9/#10, calls the library, and serializes the response.
import { Router, type IRouter } from "express";
import { db, investingHoldingsTable, investingPortfoliosTable, investingSavedScreensTable, valueWatchlistTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import {
  ScanOpportunitiesBody,
  ScanOpportunitiesResponse,
  CompareOpportunitiesRouteResponse,
  GetSavedScreensResponse,
  CreateSavedScreenBody,
  CreateSavedScreenResponse,
  UpdateSavedScreenBody,
  UpdateSavedScreenResponse,
  DeleteSavedScreenResponse,
} from "@workspace/api-zod";
import { getFundamentalsProvider } from "../lib/fundamentals.js";
import {
  scanOpportunities,
  applyScreenerFilters,
  rankOpportunities,
  bucketOpportunities,
  compareOpportunities,
  buildOpportunityRow,
  type OpportunityScreenerFilters,
} from "../lib/opportunityDiscovery.js";
import { resolveFundamentals } from "../lib/fundamentals.js";
import { buildValueResearchReport } from "../lib/valueReport.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

router.post("/opportunity-discovery/scan", async (req, res): Promise<void> => {
  const parsed = ScanOpportunitiesBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const userId = await getScopedUserId(req);
  const provider = await getFundamentalsProvider(userId);

  const scan = await scanOpportunities(
    provider,
    { symbols: body.symbols, forceRefresh: body.forceRefresh },
    userId,
  );

  const filters: OpportunityScreenerFilters = (body.filters ?? {}) as OpportunityScreenerFilters;
  const screened = applyScreenerFilters(scan.rows, filters);
  const ranked = rankOpportunities(screened.rows);

  let watchlistSymbols: string[] | undefined;
  if (body.watchlistAware) {
    const rows = await db
      .select({ symbol: valueWatchlistTable.symbol })
      .from(valueWatchlistTable)
      .where(eq(valueWatchlistTable.userId, userId));
    watchlistSymbols = rows.map((r) => r.symbol);
  }

  let portfolioSymbols: string[] | undefined;
  if (body.portfolioId != null) {
    const [portfolio] = await db
      .select({ id: investingPortfoliosTable.id })
      .from(investingPortfoliosTable)
      .where(and(eq(investingPortfoliosTable.id, body.portfolioId), eq(investingPortfoliosTable.userId, userId)));
    if (portfolio) {
      const holdingRows = await db
        .select({ symbol: investingHoldingsTable.symbol })
        .from(investingHoldingsTable)
        .where(and(eq(investingHoldingsTable.portfolioId, body.portfolioId), eq(investingHoldingsTable.userId, userId)));
      portfolioSymbols = holdingRows.map((r) => r.symbol);
    }
  }

  const buckets = bucketOpportunities(scan.rows, { watchlistSymbols, portfolioSymbols });

  res.json(
    ScanOpportunitiesResponse.parse({
      universeSize: scan.universeSize,
      unresolvedSymbols: scan.unresolvedSymbols,
      scannedAt: scan.scannedAt,
      unavailableFilters: screened.unavailableFilters,
      totalBeforeFilter: screened.totalBeforeFilter,
      rows: ranked,
      buckets,
    }),
  );
});

router.get("/opportunity-discovery/compare", async (req, res): Promise<void> => {
  const raw = typeof req.query.symbols === "string" ? req.query.symbols : "";
  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);
  const userId = await getScopedUserId(req);
  const provider = await getFundamentalsProvider(userId);

  const settled = await Promise.all(
    symbols.map(async (symbol) => {
      const f = await resolveFundamentals(provider, symbol);
      if (!f) return null;
      const report = await buildValueResearchReport(symbol, f.asOf, provider, f, undefined, userId);
      if (!report) return null;
      return buildOpportunityRow(f, report);
    }),
  );
  const rows = settled.filter((r): r is NonNullable<typeof r> => r !== null);
  const comparison = compareOpportunities(rows);
  res.json(CompareOpportunitiesRouteResponse.parse(comparison));
});

function savedScreenItem(r: typeof investingSavedScreensTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    filters: r.filtersJson,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/opportunity-discovery/saved-screens", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(investingSavedScreensTable)
    .where(eq(investingSavedScreensTable.userId, userId))
    .orderBy(desc(investingSavedScreensTable.createdAt));
  res.json(GetSavedScreensResponse.parse(rows.map(savedScreenItem)));
});

router.post("/opportunity-discovery/saved-screens", async (req, res): Promise<void> => {
  const parsed = CreateSavedScreenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .insert(investingSavedScreensTable)
    .values({ userId, name: parsed.data.name, filtersJson: parsed.data.filters })
    .returning();
  res.json(CreateSavedScreenResponse.parse(savedScreenItem(row)));
});

router.patch("/opportunity-discovery/saved-screens/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid saved screen id" });
    return;
  }
  const parsed = UpdateSavedScreenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const patch: Partial<typeof investingSavedScreensTable.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.filters !== undefined) patch.filtersJson = parsed.data.filters;

  const userId = await getScopedUserId(req);
  const [row] = await db
    .update(investingSavedScreensTable)
    .set(patch)
    .where(and(eq(investingSavedScreensTable.id, id), eq(investingSavedScreensTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Saved screen not found" });
    return;
  }
  res.json(UpdateSavedScreenResponse.parse(savedScreenItem(row)));
});

router.delete("/opportunity-discovery/saved-screens/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid saved screen id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(investingSavedScreensTable)
    .where(and(eq(investingSavedScreensTable.id, id), eq(investingSavedScreensTable.userId, userId)))
    .returning({ id: investingSavedScreensTable.id });
  res.json(DeleteSavedScreenResponse.parse({ success: !!row }));
});

export default router;
