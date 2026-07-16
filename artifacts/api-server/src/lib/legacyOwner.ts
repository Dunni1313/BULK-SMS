// Phase 1, Sprint 4 — temporary stand-in for per-request authentication.
//
// Every route in this codebase still operates in a single-tenant context: there
// is no auth layer yet (Sprint 6) and no route is scoped by the calling user
// (Sprint 7). Now that user_id is NOT NULL on the 12 backfilled tables, every
// insert into them must supply *some* value. Until real auth exists, every new
// row is attributed to the same "legacy owner" account that Sprint 4's backfill
// (lib/db/manual-migrations/002_backfill_and_enforce.sql) already attributed
// all pre-existing rows to — this preserves today's single-tenant behavior
// exactly, rather than introducing a second, different placeholder.
//
// Every call site using this helper is expected to be replaced with the
// authenticated request's real userId in Sprint 6/7 — this module exists so
// that replacement is a single point of change, not a re-grep of the codebase.

import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const LEGACY_OWNER_EMAIL = "dunnikarp@gmail.com";

let cachedId: string | null = null;

export async function getLegacyOwnerUserId(): Promise<string> {
  if (cachedId) return cachedId;
  const [row] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, LEGACY_OWNER_EMAIL))
    .limit(1);
  if (!row) {
    throw new Error(
      `Legacy owner user (${LEGACY_OWNER_EMAIL}) not found — run lib/db/manual-migrations/002_backfill_and_enforce.sql first.`,
    );
  }
  cachedId = row.id;
  return cachedId;
}
