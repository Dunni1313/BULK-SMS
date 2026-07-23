// Phase 11 — Live Market Operations & Production Validation. The first
// route-level use of users.role in this codebase (the field itself has
// existed since Phase 1, Sprint 6 — "role exposed as a read-only
// additionalField... a client can never self-assign a role at signup" —
// but no route ever checked it until now).
//
// Requires requireAuth (or at minimum loadSession) to have already run so
// req.user is populated; returns the same honest 401 requireAuth itself
// returns when there is no session at all, and a distinct 403 when there
// IS a real, authenticated session but its role isn't "admin" — never a
// 404 (unlike this codebase's established ownership-scoping convention,
// which uses 404 for both "doesn't exist" and "isn't yours" to avoid an
// existence leak; that convention doesn't apply here, since Operations
// Dashboard routes aren't per-resource, so there's nothing to leak the
// existence of).
//
// There is deliberately no self-service admin-promotion endpoint anywhere
// in this codebase — granting the "admin" role is a manual, operator-level
// database action (documented in docs/Operations-Runbook.md), matching
// this project's own prior, explicit disclosure that "no role-based admin
// functionality exists today."
import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }
  next();
}
