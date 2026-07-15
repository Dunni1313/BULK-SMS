import { Router, type IRouter } from "express";
import { HealthCheckResponse, GetMonitoringStatusResponse } from "@workspace/api-zod";
import { buildLiveMonitoringStatus } from "../lib/systemHealth.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Phase 6, Sprint 74 — mounted on the same router as /healthz for the same
// reason: an operator/monitoring system needs to poll this without auth
// friction or being rate-limited (see app.ts's own mounting-order comment).
// Database connectivity, job health, and the current request-metrics window
// are all computed fresh on every call; the two audit-log-derived signals
// are read from the periodic monitoring timer's own cache (see
// lib/systemHealth.ts's own header comment for why).
router.get("/monitoring/status", async (_req, res) => {
  const status = await buildLiveMonitoringStatus();
  const data = GetMonitoringStatusResponse.parse(status);
  res.json(data);
});

export default router;
