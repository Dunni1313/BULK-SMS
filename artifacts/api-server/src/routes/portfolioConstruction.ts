// Phase 2, Sprint 28 — Portfolio Construction (approved Phase 2 plan, Sprint
// 28). Advisory/education only, same discipline as the Watchlist — nothing
// here ever previews, schedules, or submits any order, and nothing here
// touches a real brokerage account. Deliberately a separate route file (and
// a separate DB table pair) from routes/portfolio.ts, which is the Options
// Income Engine's real, trades-backed account/Greeks tracking — the two are
// unrelated systems that happen to share the word "portfolio".

import { Router, type IRouter } from "express";
import { db, investingPortfoliosTable, investingHoldingsTable, investingRiskSnapshotsTable } from "@workspace/db";
import { and, count, desc, eq } from "drizzle-orm";
import {
  GetPortfoliosResponse,
  CreatePortfolioBody,
  CreatePortfolioResponse,
  GetPortfolioResponse,
  UpdatePortfolioBody,
  UpdatePortfolioResponse,
  DeletePortfolioResponse,
  AddHoldingBody,
  AddHoldingResponse,
  UpdateHoldingBody,
  UpdateHoldingResponse,
  DeleteHoldingResponse,
  GetPortfolioRiskResponse,
  GetPortfolioRiskSnapshotsResponse,
  SaveRiskSnapshotResponse,
} from "@workspace/api-zod";
import { getFundamentalsProvider } from "../lib/fundamentals.js";
import { buildPortfolioAllocation, type PortfolioHoldingInput } from "../lib/portfolioConstruction.js";
import { computePortfolioRiskFromAllocation, type PortfolioRiskAnalysis } from "../lib/investingRisk.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

function holdingItem(r: typeof investingHoldingsTable.$inferSelect) {
  return {
    id: r.id,
    portfolioId: r.portfolioId,
    symbol: r.symbol,
    targetWeightPct: r.targetWeightPct,
    shares: r.shares,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function portfolioSummary(r: typeof investingPortfoliosTable.$inferSelect, holdingsCount: number) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    holdingsCount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/portfolio-construction/portfolios", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await db
    .select()
    .from(investingPortfoliosTable)
    .where(eq(investingPortfoliosTable.userId, userId))
    .orderBy(desc(investingPortfoliosTable.createdAt));

  const counts = await db
    .select({ portfolioId: investingHoldingsTable.portfolioId, n: count() })
    .from(investingHoldingsTable)
    .where(eq(investingHoldingsTable.userId, userId))
    .groupBy(investingHoldingsTable.portfolioId);
  const countByPortfolio = new Map(counts.map((c) => [c.portfolioId, Number(c.n)]));

  res.json(GetPortfoliosResponse.parse(rows.map((r) => portfolioSummary(r, countByPortfolio.get(r.id) ?? 0))));
});

router.post("/portfolio-construction/portfolios", async (req, res): Promise<void> => {
  const parsed = CreatePortfolioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .insert(investingPortfoliosTable)
    .values({
      userId,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
    })
    .returning();
  res.json(CreatePortfolioResponse.parse(portfolioSummary(row, 0)));
});

router.get("/portfolio-construction/portfolios/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid portfolio id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const [portfolio] = await db
    .select()
    .from(investingPortfoliosTable)
    .where(and(eq(investingPortfoliosTable.id, id), eq(investingPortfoliosTable.userId, userId)));
  if (!portfolio) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }
  const holdingRows = await db
    .select()
    .from(investingHoldingsTable)
    .where(and(eq(investingHoldingsTable.portfolioId, id), eq(investingHoldingsTable.userId, userId)))
    .orderBy(desc(investingHoldingsTable.createdAt));

  // Eager, always-live price resolution: bounded by how many holdings one
  // portfolio has (a handful, typically), the same "small, bounded item
  // count -> resolve eagerly" precedent Industry Comparison's Peers tab
  // already established (Sprint 20) — unlike Watchlist's own list-of-many
  // symbols, which stays opt-in-gated (Sprint 27).
  const provider = await getFundamentalsProvider(userId);
  const holdingInputs: PortfolioHoldingInput[] = holdingRows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    targetWeightPct: r.targetWeightPct,
    shares: r.shares,
    notes: r.notes,
  }));
  const allocation = await buildPortfolioAllocation(holdingInputs, provider);

  res.json(
    GetPortfolioResponse.parse({
      id: portfolio.id,
      name: portfolio.name,
      description: portfolio.description,
      createdAt: portfolio.createdAt.toISOString(),
      updatedAt: portfolio.updatedAt.toISOString(),
      allocation,
    }),
  );
});

router.patch("/portfolio-construction/portfolios/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid portfolio id" });
    return;
  }
  const parsed = UpdatePortfolioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const b = parsed.data;
  const patch: Partial<typeof investingPortfoliosTable.$inferInsert> = {};
  if (b.name !== undefined) patch.name = b.name;
  if (b.description !== undefined) patch.description = b.description;

  const userId = await getScopedUserId(req);
  const [row] = await db
    .update(investingPortfoliosTable)
    .set(patch)
    .where(and(eq(investingPortfoliosTable.id, id), eq(investingPortfoliosTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }
  const [{ n }] = await db
    .select({ n: count() })
    .from(investingHoldingsTable)
    .where(eq(investingHoldingsTable.portfolioId, id));
  res.json(UpdatePortfolioResponse.parse(portfolioSummary(row, Number(n))));
});

router.delete("/portfolio-construction/portfolios/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid portfolio id" });
    return;
  }
  const userId = await getScopedUserId(req);
  // Holdings cascade via the DB's own ON DELETE CASCADE (portfolio_id FK) —
  // no separate holdings-delete step needed.
  const [row] = await db
    .delete(investingPortfoliosTable)
    .where(and(eq(investingPortfoliosTable.id, id), eq(investingPortfoliosTable.userId, userId)))
    .returning({ id: investingPortfoliosTable.id });
  res.json(DeletePortfolioResponse.parse({ success: !!row }));
});

router.post("/portfolio-construction/portfolios/:id/holdings", async (req, res): Promise<void> => {
  const portfolioId = Number(req.params.id);
  if (!Number.isInteger(portfolioId)) {
    res.status(400).json({ error: "Invalid portfolio id" });
    return;
  }
  const parsed = AddHoldingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const [portfolio] = await db
    .select({ id: investingPortfoliosTable.id })
    .from(investingPortfoliosTable)
    .where(and(eq(investingPortfoliosTable.id, portfolioId), eq(investingPortfoliosTable.userId, userId)));
  if (!portfolio) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }
  const b = parsed.data;
  const [row] = await db
    .insert(investingHoldingsTable)
    .values({
      userId,
      portfolioId,
      symbol: b.symbol.toUpperCase(),
      targetWeightPct: b.targetWeightPct ?? 0,
      shares: b.shares ?? null,
      notes: b.notes ?? "",
    })
    .returning();
  res.json(AddHoldingResponse.parse(holdingItem(row)));
});

router.patch("/portfolio-construction/portfolios/:id/holdings/:holdingId", async (req, res): Promise<void> => {
  const portfolioId = Number(req.params.id);
  const holdingId = Number(req.params.holdingId);
  if (!Number.isInteger(portfolioId) || !Number.isInteger(holdingId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateHoldingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const b = parsed.data;
  const patch: Partial<typeof investingHoldingsTable.$inferInsert> = {};
  if (b.targetWeightPct !== undefined) patch.targetWeightPct = b.targetWeightPct;
  if (b.shares !== undefined) patch.shares = b.shares;
  if (b.notes !== undefined) patch.notes = b.notes;

  const userId = await getScopedUserId(req);
  const [row] = await db
    .update(investingHoldingsTable)
    .set(patch)
    .where(
      and(
        eq(investingHoldingsTable.id, holdingId),
        eq(investingHoldingsTable.portfolioId, portfolioId),
        eq(investingHoldingsTable.userId, userId),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Holding not found" });
    return;
  }
  res.json(UpdateHoldingResponse.parse(holdingItem(row)));
});

router.delete("/portfolio-construction/portfolios/:id/holdings/:holdingId", async (req, res): Promise<void> => {
  const portfolioId = Number(req.params.id);
  const holdingId = Number(req.params.holdingId);
  if (!Number.isInteger(portfolioId) || !Number.isInteger(holdingId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const [row] = await db
    .delete(investingHoldingsTable)
    .where(
      and(
        eq(investingHoldingsTable.id, holdingId),
        eq(investingHoldingsTable.portfolioId, portfolioId),
        eq(investingHoldingsTable.userId, userId),
      ),
    )
    .returning({ id: investingHoldingsTable.id });
  res.json(DeleteHoldingResponse.parse({ success: !!row }));
});

// Phase 2, Sprint 29 — Portfolio Risk Analysis. Resolves ownership, then
// reuses buildPortfolioAllocation() (the exact same resolution the detail
// route already performs) so concentration/sector/beta scoring is computed
// from real, freshly-resolved market values with zero new provider calls
// beyond what viewing the portfolio already costs. Returns null (caller
// 404s) when the portfolio doesn't exist or isn't the caller's.
async function resolvePortfolioRisk(portfolioId: number, userId: string): Promise<PortfolioRiskAnalysis | null> {
  const [portfolio] = await db
    .select({ id: investingPortfoliosTable.id })
    .from(investingPortfoliosTable)
    .where(and(eq(investingPortfoliosTable.id, portfolioId), eq(investingPortfoliosTable.userId, userId)));
  if (!portfolio) return null;

  const holdingRows = await db
    .select()
    .from(investingHoldingsTable)
    .where(and(eq(investingHoldingsTable.portfolioId, portfolioId), eq(investingHoldingsTable.userId, userId)));

  const provider = await getFundamentalsProvider(userId);
  const holdingInputs: PortfolioHoldingInput[] = holdingRows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    targetWeightPct: r.targetWeightPct,
    shares: r.shares,
    notes: r.notes,
  }));
  const allocation = await buildPortfolioAllocation(holdingInputs, provider);
  return computePortfolioRiskFromAllocation(allocation.holdings);
}

router.get("/portfolio-construction/portfolios/:id/risk", async (req, res): Promise<void> => {
  const portfolioId = Number(req.params.id);
  if (!Number.isInteger(portfolioId)) {
    res.status(400).json({ error: "Invalid portfolio id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const risk = await resolvePortfolioRisk(portfolioId, userId);
  if (!risk) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }
  res.json(GetPortfolioRiskResponse.parse(risk));
});

router.get("/portfolio-construction/portfolios/:id/risk/snapshots", async (req, res): Promise<void> => {
  const portfolioId = Number(req.params.id);
  if (!Number.isInteger(portfolioId)) {
    res.status(400).json({ error: "Invalid portfolio id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const [portfolio] = await db
    .select({ id: investingPortfoliosTable.id })
    .from(investingPortfoliosTable)
    .where(and(eq(investingPortfoliosTable.id, portfolioId), eq(investingPortfoliosTable.userId, userId)));
  if (!portfolio) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }
  const rows = await db
    .select()
    .from(investingRiskSnapshotsTable)
    .where(and(eq(investingRiskSnapshotsTable.portfolioId, portfolioId), eq(investingRiskSnapshotsTable.userId, userId)))
    .orderBy(desc(investingRiskSnapshotsTable.createdAt));
  res.json(
    GetPortfolioRiskSnapshotsResponse.parse(
      rows.map((r) => ({
        id: r.id,
        portfolioId: r.portfolioId,
        overallScore: r.overallScore,
        analysis: r.analysisJson,
        createdAt: r.createdAt.toISOString(),
      })),
    ),
  );
});

// Explicit "Save Snapshot" action only — risk is never persisted
// automatically on a plain GET. Matches Sprint 27/28's never-persist-
// unless-asked discipline.
router.post("/portfolio-construction/portfolios/:id/risk/snapshots", async (req, res): Promise<void> => {
  const portfolioId = Number(req.params.id);
  if (!Number.isInteger(portfolioId)) {
    res.status(400).json({ error: "Invalid portfolio id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const risk = await resolvePortfolioRisk(portfolioId, userId);
  if (!risk) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }
  const [row] = await db
    .insert(investingRiskSnapshotsTable)
    .values({
      userId,
      portfolioId,
      overallScore: risk.overall.score,
      analysisJson: risk,
    })
    .returning();
  res.json(
    SaveRiskSnapshotResponse.parse({
      id: row.id,
      portfolioId: row.portfolioId,
      overallScore: row.overallScore,
      analysis: row.analysisJson,
      createdAt: row.createdAt.toISOString(),
    }),
  );
});

export default router;
