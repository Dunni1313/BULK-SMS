// Phase 1, Sprint 7 (original) / Phase 2, Sprint 28 (extracted into its own
// non-test module so it can be imported without side effects). The shared
// helper Sprint 7's plan asked for: seed one row per user, then prove a
// query scoped by userId (the exact pattern every user-scoped route uses)
// returns ONLY that user's row — never the other user's. Drizzle's generic
// column-inference types don't collapse cleanly over an arbitrary PgTable
// union, so this helper deliberately drops to `any` at its boundary — the
// runtime behavior against the real database is what's actually under test.
//
// Deliberately NOT a `*.test.ts` file: importing a test file into another
// test file would re-execute its own top-level describe()/beforeAll() calls
// as a side effect of the import. This module has none — callers supply
// their own userA/userB (no closed-over module state) — so it's safe to
// import from any test file that needs it.

import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import type { PgTable } from "drizzle-orm/pg-core";
import { expect } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function assertTenantIsolation(
  table: PgTable,
  userA: string,
  userB: string,
  seed: (userId: string) => Record<string, unknown>,
): Promise<void> {
  const t = table as any;
  const [rowA] = await db.insert(t).values(seed(userA)).returning({ id: t.id });
  const [rowB] = await db.insert(t).values(seed(userB)).returning({ id: t.id });

  const seenByA = await db.select().from(t).where(eq(t.userId, userA));
  const seenByB = await db.select().from(t).where(eq(t.userId, userB));

  const idsA = seenByA.map((r: { id: unknown }) => r.id);
  const idsB = seenByB.map((r: { id: unknown }) => r.id);

  expect(idsA).toContain(rowA.id);
  expect(idsA).not.toContain(rowB.id);
  expect(idsB).toContain(rowB.id);
  expect(idsB).not.toContain(rowA.id);
}
/* eslint-enable @typescript-eslint/no-explicit-any */
