// Phase 1, Sprint 6 — mounts every Better-Auth endpoint (sign-up, sign-in,
// sign-out, get-session, etc.) at /api/auth/*, plus one small first-party
// endpoint (/api/auth/me) that proves req.user reflects a real, authenticated
// session end-to-end.
//
// IMPORTANT: this router is mounted directly in app.ts, BEFORE
// express.json()/urlencoded() — Better-Auth reads the raw request body itself
// via the Web Fetch Request API, and body-parsing middleware upstream would
// consume the stream first and break every sign-up/sign-in request. Do not
// move this behind the body parsers, and do not add it to routes/index.ts's
// aggregated router (which runs after them).
import { Router, type IRouter } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "@workspace/auth";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

// Registered BEFORE the Better-Auth wildcard mount below — toNodeHandler's
// handler is a plain Node request handler, not Express-aware: it writes its
// own 404 for any path under /auth/* it doesn't recognize instead of calling
// next(), so it would otherwise swallow this route entirely.
//
// Deliberately outside the existing 16-route legacy-owner surface (§4.5) —
// this is the one endpoint in Sprint 6 that uses the real authenticated
// user's id, not the lib/legacyOwner.ts stand-in, proving requireAuth() and
// loadSession() work together correctly.
router.get("/auth/me", requireAuth, (req, res) => {
  res.json({
    id: req.user!.id,
    email: req.user!.email,
    displayName: req.user!.displayName,
    role: req.user!.role,
  });
});

router.all("/auth/*splat", toNodeHandler(auth));

export default router;
