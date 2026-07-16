import { Router, type IRouter } from "express";
import {
  GetPerformanceAnalyticsResponse,
  GetEquityCurveResponse,
  GetPerformanceBreakdownResponse,
} from "@workspace/api-zod";
import {
  computeAnalytics,
  getEquityCurve,
  getBreakdown,
  type Period,
  type BreakdownDimension,
} from "../lib/performanceAnalytics.js";

const router: IRouter = Router();

const PERIODS: Period[] = ["1m", "3m", "6m", "1y", "all"];
const DIMENSIONS: BreakdownDimension[] = ["strategy", "ticker", "duration", "delta", "ivrank"];

function parsePeriod(raw: unknown, fallback: Period): Period {
  return PERIODS.includes(raw as Period) ? (raw as Period) : fallback;
}

router.get("/performance/analytics", async (req, res): Promise<void> => {
  const period = parsePeriod(req.query.period, "1y");
  const analytics = computeAnalytics(period);
  res.json(GetPerformanceAnalyticsResponse.parse(analytics));
});

router.get("/performance/equity-curve", async (req, res): Promise<void> => {
  const period = parsePeriod(req.query.period, "1y");
  res.json(GetEquityCurveResponse.parse(getEquityCurve(period)));
});

router.get("/performance/breakdown", async (req, res): Promise<void> => {
  const dimension = req.query.dimension as BreakdownDimension;
  if (!DIMENSIONS.includes(dimension)) {
    res.status(400).json({ error: `dimension must be one of: ${DIMENSIONS.join(", ")}` });
    return;
  }
  const period = parsePeriod(req.query.period, "all");
  res.json(GetPerformanceBreakdownResponse.parse(getBreakdown(dimension, period)));
});

export default router;
