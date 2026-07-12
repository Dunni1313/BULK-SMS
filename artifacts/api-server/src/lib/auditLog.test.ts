// Phase 1, Sprint 10 — platform_audit_log regression suite (approved plan §6,
// §9 Sprint 10). Like lib/tenantIsolation.test.ts and
// lib/autoScheduler.multiUser.test.ts, this talks to a REAL Postgres database
// (via DATABASE_URL) rather than mocking @workspace/db — the thing under test
// is a real row landing in a real table via a real Better-Auth hook and a
// real route handler. This also means @workspace/auth is NOT mocked here
// (unlike routes/auth.test.ts's memory adapter): the audit write goes through
// the real @workspace/db connection regardless of which adapter Better-Auth
// itself uses, so exercising the real hook requires the real Postgres-backed
// instance.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  settingsTable,
  sessionsTable,
  accountsTable,
  platformAuditLogTable,
  autoExecutionLogTable,
  recordAuditEvent,
} from "@workspace/db";

const seededUserIds: string[] = [];

afterAll(async () => {
  for (const userId of seededUserIds) {
    await db.delete(platformAuditLogTable).where(eq(platformAuditLogTable.userId, userId));
    await db.delete(settingsTable).where(eq(settingsTable.userId, userId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    await db.delete(accountsTable).where(eq(accountsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
  }
});

describe("recordAuditEvent — direct unit behavior", () => {
  it("writes a row with a real userId and every field set correctly", async () => {
    const [user] = await db
      .insert(usersTable)
      .values({ email: `audit-unit-${randomUUID()}@example.com`, displayName: "Audit Unit" })
      .returning({ id: usersTable.id });
    seededUserIds.push(user.id);

    await recordAuditEvent({
      userId: user.id,
      engine: "platform",
      eventType: "test.event",
      action: "executed",
      result: "success",
      resourceType: "widget",
      resourceId: "42",
      reason: "unit test",
      runId: "run-1",
      metadata: { foo: "bar" },
    });

    const rows = await db
      .select()
      .from(platformAuditLogTable)
      .where(and(eq(platformAuditLogTable.userId, user.id), eq(platformAuditLogTable.eventType, "test.event")));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      engine: "platform",
      eventType: "test.event",
      action: "executed",
      result: "success",
      resourceType: "widget",
      resourceId: "42",
      reason: "unit test",
      runId: "run-1",
      metadata: { foo: "bar" },
    });
  });

  it("accepts a null userId for system-level events with no acting user", async () => {
    await recordAuditEvent({
      userId: null,
      engine: "platform",
      eventType: "test.system_event",
      action: "executed",
      result: "success",
    });

    const rows = await db
      .select()
      .from(platformAuditLogTable)
      .where(eq(platformAuditLogTable.eventType, "test.system_event"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].userId).toBeNull();
  });

  it("is best-effort: a write failure is reported via onError and never thrown", async () => {
    const errors: unknown[] = [];
    await expect(
      recordAuditEvent(
        {
          // A non-existent userId violates the FK constraint at write time.
          userId: randomUUID(),
          engine: "platform",
          eventType: "test.forced_failure",
          action: "executed",
          result: "success",
        },
        (err) => errors.push(err),
      ),
    ).resolves.toBeUndefined();
    expect(errors).toHaveLength(1);
  });
});

describe("live end-to-end: auth + settings events land in platform_audit_log", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { default: app } = await import("../app.js");
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    server.close();
  });

  function getCookie(res: Response): string {
    const raw = res.headers.get("set-cookie");
    if (!raw) throw new Error("expected a Set-Cookie header");
    return raw.split(";")[0];
  }

  it("a real sign-up does NOT emit an auth.login audit row (out of this sprint's scope — only sign-in does)", async () => {
    const email = `audit-e2e-signup-${randomUUID()}@example.com`;
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "correcthorsebattery", name: "Audit E2E" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: { id: string } };
    seededUserIds.push(body.user.id);

    const rows = await db
      .select()
      .from(platformAuditLogTable)
      .where(eq(platformAuditLogTable.userId, body.user.id));
    expect(rows).toHaveLength(0);
  });

  it("a successful sign-in creates an auth.login audit row with no secrets", async () => {
    const email = `audit-e2e-login-${randomUUID()}@example.com`;
    const password = "correcthorsebattery";
    const signUpRes = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name: "Audit E2E Login" }),
    });
    const { user } = (await signUpRes.json()) as { user: { id: string } };
    seededUserIds.push(user.id);

    const signInRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    expect(signInRes.status).toBe(200);

    const rows = await db
      .select()
      .from(platformAuditLogTable)
      .where(and(eq(platformAuditLogTable.userId, user.id), eq(platformAuditLogTable.eventType, "auth.login")));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      engine: "platform",
      action: "executed",
      result: "success",
      resourceType: "session",
    });
    expect(rows[0].reason).toBeNull();
    // No secrets anywhere in the row.
    const serialized = JSON.stringify(rows[0]);
    expect(serialized).not.toContain(password);
    expect(serialized.toLowerCase()).not.toContain("cookie");
    expect(serialized.toLowerCase()).not.toContain("token");
  });

  it("a failed sign-in creates an auth.login_failed audit row with a generic reason and no PII", async () => {
    const email = `audit-e2e-failedlogin-${randomUUID()}@example.com`;
    const password = "correcthorsebattery";
    const signUpRes = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name: "Audit E2E Failed Login" }),
    });
    const { user } = (await signUpRes.json()) as { user: { id: string } };
    seededUserIds.push(user.id);

    const failRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "wrong-password-entirely" }),
    });
    expect(failRes.status).toBe(401);

    const rows = await db
      .select()
      .from(platformAuditLogTable)
      .where(eq(platformAuditLogTable.eventType, "auth.login_failed"))
      .orderBy(platformAuditLogTable.id);
    const latest = rows[rows.length - 1];
    expect(latest).toBeTruthy();
    expect(latest.userId).toBeNull(); // never attributed to a guessed user id
    expect(latest.result).toBe("failure");
    expect(latest.reason).toBe("Invalid email or password");
    const serialized = JSON.stringify(latest);
    expect(serialized).not.toContain(email);
    expect(serialized).not.toContain("wrong-password-entirely");
    expect(serialized.toLowerCase()).not.toContain("cookie");
  });

  it("PATCH /settings creates a settings.updated audit row carrying only changed field NAMES", async () => {
    const email = `audit-e2e-settings-${randomUUID()}@example.com`;
    const password = "correcthorsebattery";
    const signUpRes = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name: "Audit E2E Settings" }),
    });
    const { user } = (await signUpRes.json()) as { user: { id: string } };
    seededUserIds.push(user.id);
    const cookie = getCookie(signUpRes);

    const patchRes = await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ maxRiskPerTrade: 2.5, alpacaApiKey: "super-secret-broker-key" }),
    });
    expect(patchRes.status).toBe(200);

    const rows = await db
      .select()
      .from(platformAuditLogTable)
      .where(
        and(eq(platformAuditLogTable.userId, user.id), eq(platformAuditLogTable.eventType, "settings.updated")),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0].metadata).toMatchObject({ changedFields: expect.arrayContaining(["maxRiskPerTrade", "alpacaApiKey"]) });
    // The secret VALUE must never appear anywhere in the audit row, only the field NAME.
    const serialized = JSON.stringify(rows[0]);
    expect(serialized).not.toContain("super-secret-broker-key");
  });

  it("none of this sprint's new write paths touch autoExecutionLog", async () => {
    const [{ count: before }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(autoExecutionLogTable);

    // Repeat the exact same auth + settings actions once more.
    const email = `audit-e2e-noleak-${randomUUID()}@example.com`;
    const password = "correcthorsebattery";
    const signUpRes = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name: "Audit E2E No Leak" }),
    });
    const { user } = (await signUpRes.json()) as { user: { id: string } };
    seededUserIds.push(user.id);
    const cookie = getCookie(signUpRes);
    await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "wrong-once-more" }),
    });
    await fetch(`${baseUrl}/api/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ maxRiskPerTrade: 3 }),
    });

    const [{ count: after }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(autoExecutionLogTable);
    expect(after).toBe(before);
  });
});
