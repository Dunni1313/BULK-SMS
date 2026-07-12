// Phase 1, Sprint 6 — Better-Auth's own React client, not the Orval/OpenAPI
// codegen pipeline used for the rest of this app's API surface. Better-Auth
// ships a fully-typed client purpose-built for its own endpoints; describing
// those in openapi.yaml and regenerating via Orval would just be a duplicate,
// harder-to-maintain re-implementation of what this already does.
//
// baseURL defaults to same-origin (matching how the rest of the app calls
// `/api/*` today, e.g. src/lib/coach-stream.ts) — only set VITE_AUTH_BASE_URL
// when the frontend is served from a different origin than the API server,
// and see CORS_ALLOWED_ORIGINS in .env.example for the matching server-side
// config that must also be set for that to work.
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_BASE_URL || undefined,
});

export const { useSession, signIn, signUp, signOut } = authClient;
