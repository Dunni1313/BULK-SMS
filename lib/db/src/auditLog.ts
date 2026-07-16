// Phase 1, Sprint 10 — the reusable platform_audit_log writer (plan §6.2).
//
// Deliberately lives alongside the schema in @workspace/db rather than a
// dedicated lib/ package: every current and future engine already depends on
// @workspace/db, so this is reachable with zero new dependencies — unlike
// Sprint 9's lib/ai-core extraction, there isn't enough substantial machinery
// here (a single insert) to justify a whole new workspace package.
//
// Best-effort by design, mirroring autoExecutionLog's own audit-write
// philosophy (see lib/autoExecution.ts/lib/autoAdjustment.ts in api-server):
// a failed audit write must never break the caller's actual request. Errors
// are swallowed and reported via `onError` (defaults to console.error) rather
// than thrown, so no call site needs its own try/catch.
//
// SAFETY: never pass passwords, tokens, API keys, cookies, or raw request
// bodies into `metadata`/`reason` — only already-sanitized fields (e.g.
// changed field NAMES, not their values).
import { db } from "./client";
import { platformAuditLogTable } from "./schema/auditLog";

export type AuditEngine = "options_income" | "trading" | "investing" | "platform";
export type AuditResult = "success" | "failure" | "blocked";

export interface AuditEventInput {
  userId?: string | null;
  engine: AuditEngine;
  eventType: string;
  action: string;
  result: AuditResult;
  resourceType?: string | null;
  resourceId?: string | null;
  reason?: string | null;
  runId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAuditEvent(
  input: AuditEventInput,
  onError: (err: unknown) => void = (err) => console.error("[platform_audit_log] write failed", err),
): Promise<void> {
  try {
    await db.insert(platformAuditLogTable).values({
      userId: input.userId ?? null,
      engine: input.engine,
      eventType: input.eventType,
      action: input.action,
      result: input.result,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      reason: input.reason ?? null,
      runId: input.runId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    onError(err);
  }
}
