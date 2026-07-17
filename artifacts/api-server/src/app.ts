import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors, { type CorsOptions } from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import { loadSession } from "./middlewares/auth";
import { requireAuth } from "./middlewares/requireAuth";
import { generalRateLimiter, authRateLimiter } from "./middlewares/rateLimit";
import { securityHeaders } from "./middlewares/securityHeaders";
import { requestMetrics } from "./lib/requestMetrics";
import { authRequired } from "./lib/tenantScope";
import { logger } from "./lib/logger";

const app: Express = express();

// Phase 9 — Production Readiness. Mounted first (before logging/CORS/
// rate-limiting) so every response, including health checks and
// rate-limited/error responses, carries these headers — see
// middlewares/securityHeaders.ts's own doc comment for what each header
// does and why.
app.use(securityHeaders);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Phase 4, Sprint 52 — the request-volume baseline (lib/requestMetrics.ts's
// own doc comment has the full rationale). Mounted first so it captures
// every request, including health checks, for genuine total-load
// visibility — narrower than that would understate real server load.
app.use(requestMetrics);

// Phase 4, Sprint 52 — TRUST_PROXY (opt-in, unset preserves today's
// behavior) lets a real reverse-proxy deployment configure Express to
// honor X-Forwarded-For for rate-limiting's own IP-based keying. Left
// unset by default — trusting a proxy header without a real proxy in
// front would let a client spoof its own rate-limit key, the same
// "opt-in, safe default" pattern CORS_ALLOWED_ORIGINS/REQUIRE_AUTH already
// established.
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

// Phase 1, Sprint 6 — CORS_ALLOWED_ORIGINS (comma-separated) enables credentialed
// cross-origin requests for a separately-hosted frontend, matching Better-Auth's
// trustedOrigins (lib/auth/src/index.ts). Unset preserves today's fully-open
// cors() behavior unchanged — Owner Decision #6 (production allowed-origin
// list) is still unresolved, so this stays additive/opt-in rather than
// assuming a specific origin list.
const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOptions: CorsOptions =
  corsAllowedOrigins.length > 0 ? { origin: corsAllowedOrigins, credentials: true } : {};
app.use(cors(corsOptions));

// loadSession only reads request headers (the session cookie), so it can run
// before body parsing — populates req.user for every request, blocking none.
app.use(loadSession);

// Health checks stay exempt from auth even when REQUIRE_AUTH=true — mounted
// separately (not part of the aggregated business router) and before the
// requireAuth gate below. Mounting them before the rate limiters too means
// they're never subject to rate-limiting either — a monitoring system
// polling /healthz frequently must never be throttled.
app.use("/api", healthRouter);

// Phase 4, Sprint 52 — general rate limiter, applied from here on to every
// remaining /api route (auth + business). See middlewares/rateLimit.ts's
// own doc comment for the measured-baseline threshold rationale and the
// test-mode skip contract.
app.use("/api", generalRateLimiter);

// Better-Auth's own handler reads the raw request body itself (Web Fetch
// Request API) — must be mounted BEFORE express.json()/urlencoded(), which
// would otherwise consume the body stream first and break sign-up/sign-in.
// authRateLimiter is scoped to the literal "/api/auth" path prefix (not
// "/api" — Express does not restrict a middleware registered alongside a
// router to only the sub-paths that router itself matches; it runs for
// every request under whatever path it's mounted at, so scoping by the
// real path is the only way to apply it to auth routes only, not every
// route in the app) — layered on top of the general limiter above, a
// stricter threshold to slow credential-stuffing/brute-force attempts
// against sign-in/sign-up specifically.
app.use("/api/auth", authRateLimiter);
app.use("/api", authRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Phase 1, Sprint 7 — REQUIRE_AUTH (see lib/tenantScope.ts) gates whether a
// session is actually mandatory for the business routes. Off by default: every
// route below already scopes its own queries via getScopedUserId(), which
// falls back to the legacy-owner stand-in when no session exists, so this
// stays a rollback-safe, additive hardening switch rather than a hard cutover.
if (authRequired()) {
  app.use("/api", requireAuth);
}

app.use("/api", router);

// Phase 9 — Production Readiness. Express 5 auto-forwards both a
// synchronous throw and a rejected async-handler promise to this
// 4-argument middleware (the "error handler" signature — the extra `err`
// first parameter is what Express uses to distinguish it from a normal
// middleware). Without this, Express's own built-in default handler
// takes over, which echoes the error's message/stack straight to the
// client whenever NODE_ENV isn't exactly "production" — an information-
// disclosure risk if that env var is ever unset or misconfigured for a
// real deployment. Logs the real error server-side (via the same pino
// logger every other log line already goes through) and returns a
// generic, disclosure-free message to the caller. Mounted last, so it
// only ever sees errors the routes above it didn't already handle
// themselves.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, path: req.path, method: req.method }, "Unhandled request error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

export default app;
