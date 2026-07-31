// v1.5.0, Sprint 16 — Institutional Workflow Automation Engine. Live,
// real-Postgres tests (matching lib/notifications.test.ts's own precedent
// for this kind of database-backed evaluator) using fresh, isolated users
// to avoid colliding with any other concurrently-running test file's own
// shared-legacy-owner-account trades/journal rows.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, tradesTable, journalEntriesTable } from "@workspace/db";
import { evaluateJournalReminders } from "./workflowReminders.js";

async function createUser(label: string): Promise<string> {
  const [row] = await db
    .insert(usersTable)
    .values({ email: `workflow-reminders-${label}-${randomUUID()}@example.com`, displayName: `Workflow Reminders ${label}` })
    .returning({ id: usersTable.id });
  return row.id;
}

async function cleanupUser(userId: string): Promise<void> {
  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, userId));
  await db.delete(tradesTable).where(eq(tradesTable.userId, userId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
}

describe("evaluateJournalReminders", () => {
  const seededUserIds: string[] = [];

  afterAll(async () => {
    for (const id of seededUserIds) await cleanupUser(id);
  });

  it("returns an honest empty result for a user with no closed trades at all", async () => {
    const userId = await createUser("empty");
    seededUserIds.push(userId);
    const candidates = await evaluateJournalReminders(userId);
    expect(candidates).toEqual([]);
  });

  it("returns an honest empty result when every closed trade already has a journal entry", async () => {
    const userId = await createUser("all-journaled");
    seededUserIds.push(userId);
    const [trade] = await db
      .insert(tradesTable)
      .values({ userId, symbol: "AAPL", strategy: "iron_condor", status: "closed", legs: [], closeDate: new Date() })
      .returning({ id: tradesTable.id });
    await db.insert(journalEntriesTable).values({ userId, tradeId: trade.id, title: "AAPL review", content: "Went well." });

    const candidates = await evaluateJournalReminders(userId);
    expect(candidates).toEqual([]);
  });

  it("surfaces a real, aggregate reminder naming every closed trade genuinely missing a journal entry", async () => {
    const userId = await createUser("pending");
    seededUserIds.push(userId);
    await db.insert(tradesTable).values([
      { userId, symbol: "MSFT", strategy: "iron_condor", status: "closed", legs: [], closeDate: new Date() },
      { userId, symbol: "TSLA", strategy: "put_credit_spread", status: "closed", legs: [], closeDate: new Date() },
      // An OPEN trade must never be counted — this reminder is only ever
      // about closed trades, matching this codebase's own established
      // journal-outstanding convention exactly.
      { userId, symbol: "NVDA", strategy: "iron_condor", status: "open", legs: [] },
    ]);

    const candidates = await evaluateJournalReminders(userId);
    expect(candidates).toHaveLength(1);
    const c = candidates[0];
    expect(c.type).toBe("journal_entry_pending");
    expect(c.title).toBe("2 closed trades still need journaling");
    expect(c.message).toMatch(/MSFT/);
    expect(c.message).toMatch(/TSLA/);
    expect(c.message).not.toMatch(/NVDA/);
    expect(c.dedupKey).toBe("workflow:journal-pending");
    expect(c.dataSource).toBe("SIMULATED");
    expect(c.evidence).toHaveLength(2);
  });

  it("never double-counts a closed trade whose journal entry has no lesson learned yet — pending journaling means no entry at all, not an incomplete one", async () => {
    const userId = await createUser("partial-entry");
    seededUserIds.push(userId);
    const [trade] = await db
      .insert(tradesTable)
      .values({ userId, symbol: "AMZN", strategy: "iron_condor", status: "closed", legs: [], closeDate: new Date() })
      .returning({ id: tradesTable.id });
    // A real journal entry exists, just with no lesson learned recorded
    // yet — this is the "journal-pending" lifecycle stage (Sprint 14),
    // genuinely distinct from "no entry at all" — this reminder only
    // covers the latter, honestly.
    await db.insert(journalEntriesTable).values({ userId, tradeId: trade.id, title: "AMZN log", content: "Closed." });

    const candidates = await evaluateJournalReminders(userId);
    expect(candidates).toEqual([]);
  });
});
