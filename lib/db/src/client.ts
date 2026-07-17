import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Phase 9 — Production Readiness. The pool previously had no size or
// timeout configuration at all, silently falling back to `pg`'s own
// library defaults (max: 10 connections, no idle timeout, no connection-
// acquisition timeout, no statement timeout). Every route and background
// job in this codebase shares this single pool, so an unbounded query or
// a burst of concurrent requests could previously hold connections open
// indefinitely with no way to recover short of a process restart. These
// are conservative, disclosed defaults — not a claim about the "right"
// value for any specific deployment's real traffic, which nothing in
// this codebase has measured yet — and every one is environment-
// overridable so a real deployment can tune them without a code change.
const DEFAULT_POOL_MAX = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 30_000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: envInt("DB_POOL_MAX", DEFAULT_POOL_MAX),
  idleTimeoutMillis: envInt("DB_POOL_IDLE_TIMEOUT_MS", DEFAULT_IDLE_TIMEOUT_MS),
  connectionTimeoutMillis: envInt("DB_POOL_CONNECTION_TIMEOUT_MS", DEFAULT_CONNECTION_TIMEOUT_MS),
  statement_timeout: envInt("DB_STATEMENT_TIMEOUT_MS", DEFAULT_STATEMENT_TIMEOUT_MS),
});
export const db = drizzle(pool, { schema });
