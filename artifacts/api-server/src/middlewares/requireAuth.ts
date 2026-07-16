// Phase 1, Sprint 6 — the actual authentication gate. Requires loadSession
// (auth.ts) to have already run so req.user is populated when a valid
// session exists. Ships unused by any existing route in this sprint, per the
// approved Phase 1 plan's rollback note ("feature-flagged... until Sprint 7
// requires it") — Sprint 7 is what applies this broadly across the 16 routes
// listed in the plan's §4.5. It is exercised here only by the new
// /api/auth/me endpoint (routes/auth.ts), which proves it works end-to-end.
import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}
