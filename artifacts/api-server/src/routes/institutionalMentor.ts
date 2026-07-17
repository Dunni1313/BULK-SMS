// Institutional Mentor — Phase 8, Sprint 5.
//
// One dedicated, read-only endpoint: builds the full Institutional
// Mentor result via lib/institutionalMentor.ts, itself a pure
// composition over already-existing, unmodified modules (see that
// file's own header). Never contacts a broker execution endpoint,
// never creates or modifies an order or position, never mutates the
// trades/journal/settings tables. Never writes to intelligence_snapshots
// itself (unlike AI Portfolio Analyst / Institutional Intelligence,
// this module does not call buildInstitutionalIntelligence()) — this
// route triggers no write of any kind.
import { Router, type IRouter } from "express";
import { GetInstitutionalMentorResponse } from "@workspace/api-zod";
import { buildInstitutionalMentor } from "../lib/institutionalMentor.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

router.get("/institutional-mentor", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const result = await buildInstitutionalMentor(userId);
  res.json(GetInstitutionalMentorResponse.parse(result));
});

export default router;
