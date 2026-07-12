// Phase 1, Sprint 7 — "the leak-closing sprint" (approved Phase 1 plan §4.1,
// §4.3). Every query against a user-scoped table must include a
// `WHERE user_id = :currentUser` predicate; this helper makes resolving
// "which user" the one, easy, consistent thing every route does, so an
// unscoped query has to be a deliberate, visible exception, not an easy
// mistake.
import type { Request } from "express";
import { getLegacyOwnerUserId } from "./legacyOwner.js";

// REQUIRE_AUTH gates whether a session is actually mandatory (see app.ts,
// which only mounts requireAuth on the business router when this is true).
// Off by default: ships this sprint's real per-user scoping without forcing
// a hard login wall on every existing page the moment it merges — flip to
// "true" once you've verified sign-in end-to-end. This is the rollback
// switch the approved plan's Sprint 7 entry calls for ("feature-flag the
// auth requirement... so it can be disabled").
export function authRequired(): boolean {
  return process.env.REQUIRE_AUTH === "true";
}

// Resolves the userId every query in this request should be scoped by.
//   - A real session (req.user, from loadSession) always wins.
//   - No session: falls back to the legacy-owner stand-in, UNLESS
//     REQUIRE_AUTH=true, in which case requireAuth (mounted in app.ts) has
//     already rejected the request before this ever runs, so req.user is
//     always present here — the fallback path is unreachable, not silently
//     wrong.
export async function getScopedUserId(req: Request): Promise<string> {
  if (req.user) return req.user.id;
  return getLegacyOwnerUserId();
}
