// Phase 1, Sprint 6 — session-loading middleware. Runs on every request and
// never blocks: it populates req.user/req.authSession when a valid Better-Auth
// session cookie is present, and simply leaves them undefined otherwise. The
// actual access gate is requireAuth.ts (mounted separately, only where a route
// opts in) — none of the existing Sprint 4/5 routes do yet, per the approved
// Phase 1 plan's §4.4/§9: those still resolve the legacy-owner stand-in
// (lib/legacyOwner.ts) until Sprint 7 scopes them by the real authenticated
// user.
import type { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "@workspace/auth";

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      authSession?: { id: string; expiresAt: Date };
    }
  }
}

export async function loadSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (result) {
      req.user = {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.name ?? null,
        role: (result.user as { role?: string }).role ?? "user",
      };
      req.authSession = { id: result.session.id, expiresAt: result.session.expiresAt };
    }
  } catch {
    // A session-lookup failure (malformed cookie, DB hiccup, etc.) must never
    // block the request — it just means the request proceeds unauthenticated.
    // requireAuth() (or a route's own check) is what actually gates access.
  }
  next();
}
