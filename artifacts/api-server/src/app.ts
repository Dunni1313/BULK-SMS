import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import authRouter from "./routes/auth";
import { loadSession } from "./middlewares/auth";
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

// Better-Auth's own handler reads the raw request body itself (Web Fetch
// Request API) — must be mounted BEFORE express.json()/urlencoded(), which
// would otherwise consume the body stream first and break sign-up/sign-in.
app.use("/api", authRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
