# mockup-sandbox

**Status: intentionally kept, as active design/prototyping tooling — not part of the shipped product.**

This is a standalone Vite + React + Radix-UI (shadcn-style component library) playground used for building and previewing UI mockups in isolation, before a design pattern is ported into the real application (`artifacts/ravish-trading`). It is a workspace package (`@workspace/mockup-sandbox`) with its own `package.json`, `vite.config.ts`, and `tsconfig.json`, and it is included in every `pnpm run typecheck` / `pnpm run build` pass across this whole project's history — it is validated continuously, just never deployed.

## Why it exists

`docs/DK-Option-Engine-Technical-Audit.md` (§5.6, Q8) and `docs/DK-AI-OS-Architecture-Blueprint.md` (§4) both flagged this directory early on: it was unclear whether it was still active tooling or leftover scaffolding, and its fate ("archive or document ongoing purpose") was left as an open decision carried across every subsequent phase.

**Resolved in Sprint 65 (Phase 5):** it is kept as active design tooling, not archived or deleted. It has no wiring into `artifacts/api-server` or `artifacts/ravish-trading` and is not part of the deployed application — it is a separate sandbox for iterating on component/page mockups before real implementation work happens elsewhere in the monorepo.

## What NOT to expect here

- No production routes, no live data, no auth, no database access.
- Not covered by the application's own test suites (`@workspace/api-server`, `@workspace/ravish-trading`) — it has its own `typecheck` script only, run as part of the monorepo-wide `pnpm run typecheck`.
- Changes here never affect the shipped product directly; a design validated in this sandbox is ported deliberately, by hand, into the real application when it's ready.
