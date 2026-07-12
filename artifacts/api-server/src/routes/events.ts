import { Router, type IRouter } from "express";
import { GetUpcomingEventsResponse } from "@workspace/api-zod";
import { UNIVERSE_SYMBOLS } from "../lib/optionsMath.js";
import { getUpcomingEvents } from "../lib/eventRisk.js";

const router: IRouter = Router();

// Forward-looking economic / market event calendar across the universe.
router.get("/events", async (req, res): Promise<void> => {
  const horizonDays = Number(req.query.horizonDays) || 45;
  const events = getUpcomingEvents(UNIVERSE_SYMBOLS, Date.now(), horizonDays);
  res.json(GetUpcomingEventsResponse.parse(events));
});

export default router;
