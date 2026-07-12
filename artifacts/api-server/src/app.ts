import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import { loadSession } from "./middlewares/auth";
import { requireAuth } from "./middlewares/requireAuth";
import { authRequired } from "./lib/tenantScope";
import { logger } from "./lib/logger";

const app: Express = express();

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
// requireAuth gate below.
app.use("/api", healthRouter);

// Better-Auth's own handler reads the raw request body itself (Web Fetch
// Request API) — must be mounted BEFORE express.json()/urlencoded(), which
// would otherwise consume the body stream first and break sign-up/sign-in.
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

export default app;
