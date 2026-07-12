import { Router, type IRouter } from "express";
import {
  GetAutoExecutionStatusResponse,
  RunAutoExecutionCycleResponse,
  GetAutoExecutionLogResponse,
  GetAutoAdjustmentLogResponse,
  RunAutoAdjustmentCycleResponse,
} from "@workspace/api-zod";
import {
  runAutoExecutionCycle,
  getAutoExecutionStatus,
  getAutoExecutionLog,
} from "../lib/autoExecution.js";
import { runAutoAdjustmentCycle } from "../lib/autoAdjustment.js";

const router: IRouter = Router();

router.get("/execution/auto/status", async (req, res): Promise<void> => {
  try {
    const status = await getAutoExecutionStatus();
    res.json(GetAutoExecutionStatusResponse.parse(status));
  } catch (err) {
    req.log.error({ err }, "auto status failed");
    res.status(500).json({ error: "Failed to read auto-execution status" });
  }
});

router.get("/execution/auto/log", async (req, res): Promise<void> => {
  try {
    const log = await getAutoExecutionLog(50);
    res.json(GetAutoExecutionLogResponse.parse(log));
  } catch (err) {
    req.log.error({ err }, "auto log failed");
    res.status(500).json({ error: "Failed to read auto-execution log" });
  }
});

// Audit log filtered to the auto-ADJUSTMENT engine only (kind="adjust"), for the
// Adjustments control panel.
router.get("/execution/auto/adjust/log", async (req, res): Promise<void> => {
  try {
    const allowedDecisions = ["executed", "skipped", "rejected", "blocked"];
    const rawDecision = typeof req.query.decision === "string" ? req.query.decision : undefined;
    const decision = rawDecision && allowedDecisions.includes(rawDecision) ? rawDecision : undefined;
    const rawSymbol = typeof req.query.symbol === "string" ? req.query.symbol.trim() : undefined;
    const symbol = rawSymbol ? rawSymbol.toUpperCase() : undefined;
    const log = await getAutoExecutionLog(50, "adjust", { decision, symbol });
    res.json(GetAutoAdjustmentLogResponse.parse(log));
  } catch (err) {
    req.log.error({ err }, "auto adjust log failed");
    res.status(500).json({ error: "Failed to read auto-adjustment log" });
  }
});

router.post("/execution/auto/run", async (req, res): Promise<void> => {
  try {
    const result = await runAutoExecutionCycle();
    res.json(RunAutoExecutionCycleResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "auto run failed");
    res.status(500).json({ error: "Failed to run auto-execution cycle" });
  }
});

router.post("/execution/auto/adjust/run", async (req, res): Promise<void> => {
  try {
    const result = await runAutoAdjustmentCycle();
    res.json(RunAutoAdjustmentCycleResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "auto adjust run failed");
    res.status(500).json({ error: "Failed to run auto-adjustment cycle" });
  }
});

export default router;
