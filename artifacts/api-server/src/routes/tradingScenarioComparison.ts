// Phase 28 — Institutional Trade Planning & Risk Studio.
//
// A stateless, non-persisting preview endpoint — mirrors the Options
// Income Engine's own established Order Preview / Trade Adjustment
// Preview precedent (pure computation, no order, no trade plan, ever
// submitted or saved from this route). Zero business logic of its own:
// calls straight through to lib/tradingScenarioComparison.ts's
// computeScenarioComparison(), itself a thin repeated call of Phase 24's
// own computeRiskParameters() — the exact same math routes/tradingTradePlans.ts's
// real POST /trading/trade-plans already uses when a plan is actually
// saved. 400 for too few/too many scenarios; never fabricates a
// comparison for an empty or oversized scenario list.

import { Router, type IRouter } from "express";
import { CompareTradingScenariosBody, CompareTradingScenariosResponse } from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { getSettingsRow } from "../lib/serverState.js";
import { computeScenarioComparison, MIN_SCENARIOS, MAX_SCENARIOS } from "../lib/tradingScenarioComparison.js";

const router: IRouter = Router();

router.post("/trading/trade-plans/scenarios/compare", async (req, res): Promise<void> => {
  const parsed = CompareTradingScenariosBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const d = parsed.data;
  if (d.scenarios.length < MIN_SCENARIOS || d.scenarios.length > MAX_SCENARIOS) {
    res.status(400).json({ error: `Provide between ${MIN_SCENARIOS} and ${MAX_SCENARIOS} scenarios to compare.` });
    return;
  }

  let accountValue: number | null = d.accountValue ?? null;
  if (accountValue == null) {
    const userId = await getScopedUserId(req);
    const settings = await getSettingsRow(userId);
    accountValue = settings.tradingAccountValue ?? null;
  }

  const result = computeScenarioComparison(d.symbol ? d.symbol.toUpperCase() : null, d.scenarios, accountValue);
  res.json(CompareTradingScenariosResponse.parse(result));
});

export default router;
