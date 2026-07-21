# Architecture (Version 1)

A top-level orientation. For engine-specific depth, see the linked
documents in each section rather than duplicating them here.

## The three-engine platform

```mermaid
flowchart TB
    subgraph Platform["Shared Platform Layer"]
        Auth[Better-Auth\nauthentication]
        DB[(Postgres\nvia Drizzle)]
        AICore[lib/ai-core\nnarration + disclaimers]
        Reporting[Institutional\nReporting Centre]
        Learning[Learning Centre]
        Audit[platform_audit_log]
        Rate[Rate limiting +\nsecurity headers]
    end

    subgraph Engine1["Engine 1 — Institutional Investing"]
        E1a[Company Research /\nValuation Models]
        E1b[Portfolio Construction /\nWatchlists / Rebalancing]
        E1c[Decision Support /\nCompliance]
        E1Committee[AI Investment Committee]
    end

    subgraph Engine2["Engine 2 — Institutional Trading"]
        E2a[Market Structure /\nMulti-Timeframe / Regime]
        E2b[Liquidity / Probability /\nRisk Management]
        E2c[Trading Journal /\nResearch Workspace]
    end

    subgraph Engine3["Engine 3 — Options Income (foundation)"]
        E3a[Scanner /\nStrategy Builder]
        E3b[Greeks / Portfolio\nExposure]
        E3c[Automation +\nKill Switch]
    end

    Platform --- Engine1
    Platform --- Engine2
    Platform --- Engine3
    Engine1 -. "sector/regime context\n(never blended)" .-> Engine2
```

**Never-blend-across-engines discipline.** Every phase that composes
figures from more than one engine (the Cross-Engine Command Center, the
Cross-Engine Daily Report) keeps each engine's own numbers side by side —
never summed or averaged into a fabricated combined figure. See
`docs/Cross-Engine-Orchestration.md` and `docs/Cross-Engine-Workspace.md`.

## Backend

Express 5, TypeScript, ESM. Every route validates its request/response
against a Zod schema generated from `lib/api-spec/openapi.yaml` — the
single source of truth for the REST contract (see
[`docs/API-Guide.md`](API-Guide.md)). Business logic lives in
`artifacts/api-server/src/lib/*.ts`, one module per concern, almost always
composing already-built modules rather than duplicating logic — every
phase's own completion report in `CLAUDE.md` states exactly what it reused
and what (if anything) was genuinely new.

Five files are under the platform's own maximum-scrutiny protection and
are never modified without explicit, specific approval:
`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
`autoAdjustment.ts`, plus broker integration code.

## Frontend

React 19 + Vite, TypeScript. Every page is route-level code-split via
`React.lazy()` (86 lazy imports covering 74 pages). Data fetching goes
through generated React Query hooks (`@workspace/api-client-react`), never
hand-written `fetch()` calls against undocumented endpoints. Shared UI
primitives (`Card`, `Skeleton`, `Badge`, `Button`) are used near-
universally across pages — see `docs/UI-Standards.md` and
`docs/RC1-UI-UX-Review.md`.

## Database

Postgres via Drizzle ORM. Schema lives in `lib/db/src/schema/*.ts`; every
schema change ships as a hand-written, reviewable SQL script in
`lib/db/manual-migrations/` — this project does not trust `drizzle-kit
push` alone for changes touching existing data (nullable → backfill →
enforce-not-null, per CLAUDE.md rule 7). See
[`docs/RC1-Diagrams-And-Catalogues.md`](RC1-Diagrams-And-Catalogues.md) §4
for the full table inventory.

## AI narration

Every LLM-narrated surface in the platform (the Options AI Coach, the
Investing AI Coach, the Trading AI Coach, the Investment Committee
narrator, the Cross-Engine Daily Report narrator) routes through the same
`lib/ai-core` package: a provider-agnostic `complete()`/`completeStream()`
with caching, single-flight de-duplication, and a disclaimer-enforcement
contract that cannot be bypassed by a new caller (CLAUDE.md rule 6). When
no LLM key is configured, every narration surface falls back to a
deterministic, template-based explanation — never blocks the underlying
deterministic data.

## Multi-engine data flow

Every dashboard-composition module documents, in its own header comment,
exactly which other modules' output it reuses "verbatim, never
recomputed." This is enforced by convention and spot-checked in
`docs/RC1-Repository-Audit.md`, not by a build-time rule — but is
consistently followed across all 44 phases of this project's history.

## Related documents

- `docs/DK-AI-OS-Architecture-Blueprint.md` — the original target
  architecture and phase roadmap this platform was built against.
- `docs/Trading-Engine-Architecture.md`, `docs/Investing-Platform-Architecture.md`,
  `docs/Options-Architecture.md` — per-engine architecture detail.
- `docs/RC1-Diagrams-And-Catalogues.md` — the engine/module dependency
  diagrams, database overview, navigation map, and report/learning/coach
  catalogues.
