// Phase 1, Sprint 6 — Better-Auth server instance, per Owner Decision #1
// (approved Phase 1 Foundation plan §3, §9 Sprint 6).
//
// Points Better-Auth's Drizzle adapter at the EXISTING users table (Sprint 1)
// instead of letting it create its own — usersTable is already the FK target
// for every one of the 13 user-scoped tables from Sprint 3/4/5, so it must
// stay the single source of truth for "who is this user." sessions/accounts/
// verifications are new tables added for this sprint (lib/db/src/schema/).
//
// generateId: "uuid" makes Better-Auth generate real UUIDs (via Postgres's
// gen_random_uuid()) for every model's id, matching every column's type here
// and the users.id convention from Sprint 1 (Owner Decision #5) — Better-Auth's
// own default id format is a short alphanumeric string, which would fail to
// insert into a strict `uuid` column.
import { betterAuth } from "better-auth";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, usersTable, sessionsTable, accountsTable, verificationsTable, recordAuditEvent } from "@workspace/db";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error(
    "BETTER_AUTH_SECRET must be set. Generate one with `openssl rand -base64 32`.",
  );
}

// Comma-separated list, e.g. "https://app.example.com,http://localhost:5173".
// Empty/unset means same-origin only (Better-Auth's default) — safe, but
// cross-origin sign-in from a separately-hosted frontend won't work until
// this is set. See CORS_ALLOWED_ORIGINS in app.ts for the matching CORS
// config; both must list the same origins for cookie-based sessions to work
// cross-origin. Owner Decision #6 (CORS allowed-origin list) is still
// unresolved for a production domain — this is a secure, additive default,
// not a resolution of that decision.
const trustedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const auth = betterAuth({
  secret,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: trustedOrigins.length > 0 ? trustedOrigins : undefined,
  database: drizzleAdapter(db, {
    provider: "pg",
    // NOT usePlural: true — that tells the adapter to pluralize Better-Auth's
    // own default singular modelNames ("user" -> "users") for you. We already
    // pass explicit plural modelNames below matching this schema map's keys
    // 1:1, so setting both double-pluralizes ("users" -> "userss").
    schema: {
      users: usersTable,
      sessions: sessionsTable,
      accounts: accountsTable,
      verifications: verificationsTable,
    },
  }),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  user: {
    modelName: "users",
    fields: {
      name: "displayName",
    },
    additionalFields: {
      // Forward-looking (not enforced by any route in Phase 1). input:false
      // means a client can never self-assign a role at signup or update —
      // only server-side code can change it.
      role: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "user",
      },
    },
  },
  session: {
    modelName: "sessions",
  },
  account: {
    modelName: "accounts",
  },
  verification: {
    modelName: "verifications",
  },
  emailAndPassword: {
    enabled: true,
    // No email-sending infrastructure exists yet anywhere in this codebase
    // (verified: no mailer/SMTP config in Phase 1). Requiring verification
    // would lock every new signup out with no way to complete it — revisit
    // once a real mailer exists.
    requireEmailVerification: false,
  },
  // Phase 1, Sprint 10 — wires the sign-in flow into platform_audit_log (plan
  // §6.2/§6.3). This is the only correct integration point: routes/auth.ts
  // just mounts Better-Auth's own request handler, so no route body of ours
  // ever runs for /sign-in/email — the global after-hook is the sole place
  // that sees both the success and failure outcome.
  //
  // ctx.path is stripped of the /api/auth basePath by Better-Auth itself
  // (confirmed empirically against this exact installed version), so
  // "/sign-in/email" matches regardless of where the router is mounted.
  // ctx.context.newSession is only ever populated when a session was
  // actually created (success); ctx.context.returned is the thrown
  // APIError on failure, whose .body.message is Better-Auth's own generic,
  // already-client-visible "Invalid email or password" — safe to reuse
  // verbatim since it reveals nothing beyond what the client already got.
  //
  // Never logs the submitted email/password, tokens, or cookies — only the
  // resulting userId (on success) and this fixed generic reason (on failure).
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const failed = isAPIError(ctx.context.returned);
      const userId = failed ? null : (ctx.context.newSession?.user?.id ?? null);
      await recordAuditEvent({
        userId,
        engine: "platform",
        eventType: failed ? "auth.login_failed" : "auth.login",
        action: failed ? "rejected" : "executed",
        result: failed ? "failure" : "success",
        resourceType: "session",
        reason: failed ? "Invalid email or password" : null,
      });
    }),
  },
});

export type AuthInstance = typeof auth;
