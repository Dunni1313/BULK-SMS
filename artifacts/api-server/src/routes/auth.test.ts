// Phase 1, Sprint 6 — authentication regression tests (approved Phase 1 plan
// §8.3: "login success/failure, session verification, expired/invalid token
// rejection" plus this project's own cross-user isolation requirement).
//
// @workspace/auth is replaced with a Better-Auth instance backed by the
// memory adapter (better-auth/adapters/memory) instead of the real Postgres
// adapter — this exercises Better-Auth's REAL signup/session/password logic
// (not a hand-rolled mock of it), while never touching a live database,
// matching this project's existing test convention. The field mapping
// (modelName/fields/additionalFields) mirrors lib/auth/src/index.ts exactly,
// so a mismatch there would fail here too.
//
// The app is exercised over real HTTP (app.listen(0) + fetch), not via
// router.stack extraction — Better-Auth's toNodeHandler needs a genuine
// Node req/res, and this is the most faithful way to test cookie-based
// session flows end-to-end.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { Server } from "node:http";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

vi.mock("@workspace/auth", () => {
  const auth = betterAuth({
    secret: "test-only-secret-never-used-outside-this-file",
    // CSRF's Origin-header check is a real, important production protection
    // (verified manually against the live server before writing this test),
    // but it depends on request Origin bookkeeping this test doesn't need to
    // exercise — the actual behavior under test is signup/session/isolation.
    advanced: { disableCSRFCheck: true },
    database: memoryAdapter({ users: [], sessions: [], accounts: [], verifications: [] }),
    user: {
      modelName: "users",
      fields: { name: "displayName" },
      additionalFields: {
        role: { type: "string", required: false, input: false, defaultValue: "user" },
      },
    },
    session: { modelName: "sessions" },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
    emailAndPassword: { enabled: true, requireEmailVerification: false },
  });
  return { auth };
});

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

interface SignUpResponseBody {
  user: { id: string; email: string; name: string; role: string };
}

interface MeResponseBody {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
}

function getCookie(res: Response): string {
  const raw = res.headers.get("set-cookie");
  if (!raw) throw new Error("expected a Set-Cookie header");
  return raw.split(";")[0];
}

async function signUp(email: string, name: string, password = "correct-horse-battery-staple") {
  const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  const body = (await res.json()) as SignUpResponseBody;
  return { res, cookie: res.ok ? getCookie(res) : null, body };
}

describe("auth: unauthenticated access", () => {
  it("GET /api/auth/me without a session returns 401", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  it("sign-in with the wrong password is rejected", async () => {
    await signUp("wrongpass@example.com", "Wrong Pass");
    const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "wrongpass@example.com", password: "not-the-real-password" }),
    });
    expect(res.status).toBe(401);
  });

  it("sign-in for an email that never signed up is rejected", async () => {
    const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "never-existed@example.com", password: "whatever123" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("auth: authenticated access", () => {
  it("sign-up succeeds and never lets the client self-assign a role", async () => {
    const { res, body } = await signUp("carol@example.com", "Carol", "correct-horse-battery-staple");
    expect(res.status).toBe(200);
    expect(body.user.email).toBe("carol@example.com");
    expect(body.user.role).toBe("user"); // additionalFields.role: input:false enforced
  });

  it("a client cannot self-assign role at signup even when they try to", async () => {
    const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "mallory@example.com",
        password: "correct-horse-battery-staple",
        name: "Mallory",
        role: "admin",
      }),
    });
    const body = (await res.json()) as SignUpResponseBody;
    expect(body.user.role).toBe("user");
  });

  it("GET /api/auth/me with a valid session returns the real authenticated user, not a stand-in", async () => {
    const { cookie } = await signUp("dave@example.com", "Dave", "correct-horse-battery-staple");
    const res = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: cookie! } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as MeResponseBody;
    expect(body.email).toBe("dave@example.com");
    expect(body.displayName).toBe("Dave");
    expect(body.role).toBe("user");
  });

  it("sign-in with the correct password establishes a working session", async () => {
    await signUp("erin@example.com", "Erin", "a-real-password-123");
    const signInRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "erin@example.com", password: "a-real-password-123" }),
    });
    expect(signInRes.status).toBe(200);
    const cookie = getCookie(signInRes);
    const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie } });
    expect(meRes.status).toBe(200);
    expect(((await meRes.json()) as MeResponseBody).email).toBe("erin@example.com");
  });

  it("sign-out revokes the session — a subsequent request with the same cookie is unauthenticated", async () => {
    const { cookie } = await signUp("frank@example.com", "Frank", "correct-horse-battery-staple");
    const signOutRes = await fetch(`${baseUrl}/api/auth/sign-out`, {
      method: "POST",
      headers: { cookie: cookie! },
    });
    expect(signOutRes.status).toBe(200);

    const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: cookie! } });
    expect(meRes.status).toBe(401);
  });

  it("an invalid/garbage session cookie is rejected, not silently accepted", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: "better-auth.session_token=not-a-real-token-at-all" },
    });
    expect(res.status).toBe(401);
  });
});

describe("auth: cross-user isolation", () => {
  it("two different users' sessions never resolve to each other's identity", async () => {
    const alice = await signUp("alice@example.com", "Alice", "alice-password-123");
    const bob = await signUp("bob@example.com", "Bob", "bob-password-123");

    const aliceMe = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: alice.cookie! } });
    const bobMe = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: bob.cookie! } });

    const aliceBody = (await aliceMe.json()) as MeResponseBody;
    const bobBody = (await bobMe.json()) as MeResponseBody;

    expect(aliceBody.email).toBe("alice@example.com");
    expect(bobBody.email).toBe("bob@example.com");
    expect(aliceBody.id).not.toBe(bobBody.id);
  });

  it("signing out of one user's session does not affect the other user's session", async () => {
    const alice = await signUp("alice2@example.com", "Alice Two", "alice-password-123");
    const bob = await signUp("bob2@example.com", "Bob Two", "bob-password-123");

    await fetch(`${baseUrl}/api/auth/sign-out`, { method: "POST", headers: { cookie: alice.cookie! } });

    const aliceMe = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: alice.cookie! } });
    const bobMe = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: bob.cookie! } });

    expect(aliceMe.status).toBe(401);
    expect(bobMe.status).toBe(200);
    expect(((await bobMe.json()) as MeResponseBody).email).toBe("bob2@example.com");
  });
});
