// Phase 25 — Institutional Trade Workspace.
//
// Real persistence for the TradePlan domain concept (in-memory only since
// Phase 24) — the Trade Workspace's own Trade Plan Panel and its "Save
// Workspace" workflow step are the real UI consumer Phase 24's own
// roadmap named as the trigger for this. Mirrors routes/tradingPositions.ts's
// own list/create/get/update/delete pattern directly. Every query is
// scoped via getScopedUserId(req) and the established and(eq(id),
// eq(userId)) ownership pattern — 404, never a separate 403.
//
// Zero new signal/scoring logic: computeRiskParameters() (Phase 24,
// lib/tradingDomainModel.ts) is the only computation here, and it's pure
// arithmetic over the human's own entry/stop/target/account-risk numbers
// — never a recommendation on whether those levels are good.

import { Router, type IRouter } from "express";
import { db, tradingTradePlansTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import {
  ListTradingTradePlansResponse,
  ListTradingTradePlansResponseItem,
  UpdateTradingTradePlanResponse,
  CreateTradingTradePlanBody,
  UpdateTradingTradePlanBody,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { computeRiskParameters, type TradePlanStatus } from "../lib/tradingDomainModel.js";
import { transitionTradePlanStatus } from "../lib/trading/tradePlanService.js";

const router: IRouter = Router();

function formatPlan(p: typeof tradingTradePlansTable.$inferSelect) {
  return {
    id: p.id,
    symbol: p.symbol,
    direction: p.direction,
    status: p.status,
    thesis: p.thesis,
    risk: {
      accountRiskPct: p.accountRiskPct,
      entryPrice: p.entryPrice,
      stopPrice: p.stopPrice,
      targetPrice: p.targetPrice,
      positionSize: p.positionSize ?? null,
      riskRewardRatio: p.riskRewardRatio ?? null,
    },
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/trading/trade-plans", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const plans = await db
    .select()
    .from(tradingTradePlansTable)
    .where(eq(tradingTradePlansTable.userId, userId))
    .orderBy(desc(tradingTradePlansTable.createdAt));

  res.json(ListTradingTradePlansResponse.parse(plans.map(formatPlan)));
});

router.get("/trading/trade-plans/:symbol", async (req, res): Promise<void> => {
  const symbol = (Array.isArray(req.params.symbol) ? req.params.symbol[0] : req.params.symbol).toUpperCase();
  const userId = await getScopedUserId(req);
  const plans = await db
    .select()
    .from(tradingTradePlansTable)
    .where(and(eq(tradingTradePlansTable.userId, userId), eq(tradingTradePlansTable.symbol, symbol)))
    .orderBy(desc(tradingTradePlansTable.createdAt));

  res.json(ListTradingTradePlansResponse.parse(plans.map(formatPlan)));
});

router.post("/trading/trade-plans", async (req, res): Promise<void> => {
  const parsed = CreateTradingTradePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;
  const userId = await getScopedUserId(req);
  const risk = computeRiskParameters(
    {
      accountRiskPct: d.accountRiskPct,
      entryPrice: d.entryPrice,
      stopPrice: d.stopPrice,
      targetPrice: d.targetPrice,
    },
    d.accountValue ?? null,
  );

  const [plan] = await db
    .insert(tradingTradePlansTable)
    .values({
      userId,
      symbol: d.symbol.toUpperCase(),
      direction: d.direction,
      status: "draft",
      thesis: d.thesis,
      accountRiskPct: d.accountRiskPct,
      entryPrice: d.entryPrice,
      stopPrice: d.stopPrice,
      targetPrice: d.targetPrice,
      positionSize: risk.positionSize,
      riskRewardRatio: risk.riskRewardRatio,
    })
    .returning();

  res.status(201).json(ListTradingTradePlansResponseItem.parse(formatPlan(plan)));
});

router.patch("/trading/trade-plans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateTradingTradePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = await getScopedUserId(req);
  const [existing] = await db
    .select()
    .from(tradingTradePlansTable)
    .where(and(eq(tradingTradePlansTable.id, id), eq(tradingTradePlansTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }

  const d = parsed.data;

  if (d.status) {
    const currentStatus = existing.status as TradePlanStatus;
    const next = transitionTradePlanStatus(
      {
        id: String(existing.id),
        symbol: existing.symbol,
        direction: existing.direction as "long" | "short",
        status: currentStatus,
        thesis: existing.thesis,
        risk: {
          accountRiskPct: existing.accountRiskPct,
          entryPrice: existing.entryPrice,
          stopPrice: existing.stopPrice,
          targetPrice: existing.targetPrice,
          positionSize: existing.positionSize ?? null,
          riskRewardRatio: existing.riskRewardRatio ?? null,
        },
        createdAt: existing.createdAt.toISOString(),
      },
      d.status as TradePlanStatus,
    );
    if (!next) {
      res.status(400).json({ error: `Cannot transition trade plan from '${currentStatus}' to '${d.status}'` });
      return;
    }
  }

  const [plan] = await db
    .update(tradingTradePlansTable)
    .set({
      ...(d.thesis !== undefined ? { thesis: d.thesis } : {}),
      ...(d.status !== undefined ? { status: d.status } : {}),
    })
    .where(and(eq(tradingTradePlansTable.id, id), eq(tradingTradePlansTable.userId, userId)))
    .returning();

  res.json(UpdateTradingTradePlanResponse.parse(formatPlan(plan)));
});

router.delete("/trading/trade-plans/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = await getScopedUserId(req);
  const [plan] = await db
    .delete(tradingTradePlansTable)
    .where(and(eq(tradingTradePlansTable.id, id), eq(tradingTradePlansTable.userId, userId)))
    .returning();

  if (!plan) {
    res.status(404).json({ error: "Trade plan not found" });
    return;
  }

  res.status(204).send();
});

export default router;
