# Strategy Framework — Integration Points

Phase 30. This document is the audit-to-integration map: what existing
functionality was found, what was reused as-is, and exactly where the
Strategy Framework was wired into it.

## Audit summary (pre-implementation)

| Existing surface | What was found | Reuse decision |
|---|---|---|
| **Institutional Trade Workspace** (`TradeWorkspace.tsx`) | Already has an AI Trading Coach panel with per-coach links (Structure/Liquidity/Session/Risk/Trade Plan/Journal/Scenario, Phase 29) | Added one more outbound link ("Register or review your own Strategy Framework") right after the existing Trading AI Coach link. No panel logic duplicated. |
| **Market Structure Workbench** | A dedicated deterministic Market Structure engine (`lib/tradingMarketStructure.ts`) already exists and is already one of the 8 coach types | Reused as an `EvidenceSourceType` (`"structure"`) — Strategy Framework never recomputes structure, it only cites it. |
| **Liquidity & Session Workbench** | Dedicated Liquidity/Session engines already exist and are already coach types | Reused as two `EvidenceSourceType`s (`"liquidity"`, `"session"`). |
| **Trade Planning Studio** | A full Trade Plan/Risk Studio workflow (Phase 28) with its own coach | Added the same outbound link pattern as Trade Workspace. Reused as `EvidenceSourceType`s `"trade-plan"` and `"risk"`. |
| **Trading AI Coach** (`TradingAICoach.tsx`, Phase 29) | 8 deterministic coaches (structure/liquidity/session/risk/trade-plan/journal/scenario/general) already exist, with a shared `TRADING_COACH_LABELS`/`TRADING_COACH_DISCLAIMER` pattern | Extended the *same* `TradingCoachType` union with a 9th value, `"strategy"`, reusing the existing disclaimer/label infrastructure rather than a parallel one. Added an outbound link from this page to the Strategy Framework page. |
| **Trading Journal** | Already a coach type (`"journal"`) and already has its own persistence | Reused as `EvidenceSourceType` (`"journal"`) — no new journal functionality. |
| **Risk Studio** | Already a coach type (`"risk"`) | Reused as `EvidenceSourceType` (`"risk"`). |
| **Reporting Centre** (`lib/institutionalReporting.ts`, Phase 22) | An established `InstitutionalReportType` union + per-type builder function pattern, already at 11 report types | Added a 12th type, `strategy-framework-summary`, following the exact existing pattern (`REPORT_TYPE_META` entry, a `build*Report()` function, a route, a frontend hook wire-up) — no new reporting architecture. |
| **Learning Centre** (`lib/learningPaths.ts`, Phase 8/21) | An established `LearningPath[]` catalog + Learning Progress persistence, already at 10 paths | Added an 11th path, `strategy-framework`, reusing the existing `glossaryCategory: "trading"` and the existing `learning_progress` table/route/hook unmodified. |
| **Navigation / Command Palette** | `nav-items.ts` is the single source of truth both the sidebar nav and the Command Palette read from | Added one entry; the Command Palette inherited it automatically, with no separate Command Palette code to touch. |
| **Executive Dashboard design language** | Established Card/Badge/Skeleton/testid conventions already used by every Trading Engine page since Phase 23 | The new Strategy Framework page reuses these components directly — no new design system. |

**Genuine gaps identified** (nothing pre-existing covered these — all net
new this phase):

- No strategy registry of any kind existed. `STRATEGY_REGISTRY` in
  `lib/trading/strategyService.ts` (a Phase 24 stub) is a hardcoded,
  read-only, in-memory list unrelated to per-user data — it was left
  untouched; the new `trading_strategies` table is the real, persisted
  registry going forward.
- No checklist engine existed anywhere in the codebase (the existing
  Trade Workspace "checklist" concept, `src/lib/trade-checklist.ts`
  from Phase 25, is a fixed, hardcoded pre-trade checklist specific to
  options income trades — not user-authorable, not reusable across
  strategies). The new Checklist Engine is generic and user-authored.
- No evidence-citation vocabulary existed connecting a user's own
  checklist item to a specific platform output.
- No 9th coach type existed for a user's own strategy metadata.

## Integration points actually wired

1. **Trade Workspace** (`TradeWorkspace.tsx`) — one new link in the AI
   Trading Coach Panel header, `data-testid="link-open-strategy-framework"`.
2. **Trade Planning Studio** (`TradePlanningStudio.tsx`) — same link
   pattern, same testid convention.
3. **Trading AI Coach** (`TradingAICoach.tsx`) — one new link in the page
   header, `data-testid="link-trading-coach-open-strategy-framework"`.
4. **Reporting Centre** (`ReportingCentre.tsx`) — `ReportType` union,
   `REPORT_TYPE_VALUES` array, a new `sfsRes` query hook
   (`useGetStrategyFrameworkSummaryReport`), and its entry in the
   `activeResult` dispatch — the report type itself already appears in
   the report-type `<Select>` because that list is populated dynamically
   from the backend's `GET /reporting/types` endpoint (no separate
   frontend label list to maintain).
5. **Learning Centre** (`learn/LearningCentre.tsx`) — one new overview
   tile, `data-testid="link-overview-strategy-framework"`, linking to
   `/strategy-framework`, mirroring the existing Trading AI Coach tile.
6. **Navigation** (`nav-items.ts`) — one new entry ("Strategy Framework",
   `Layers` icon, `/strategy-framework`), positioned directly after
   Trading AI Coach.
7. **Command Palette** — inherits the new nav entry automatically; no
   separate integration code exists to modify.
8. **Routing** (`App.tsx`) — one new lazy-loaded route,
   `/strategy-framework` → `StrategyFramework.tsx`.
9. **Backend routing** (`routes/index.ts`) — two new routers mounted,
   `tradingStrategiesRouter` and `tradingStrategyChecklistsRouter`.
10. **Trading Coach backend** (`routes/tradingCoach.ts`) — one new
    literal-path route registered before the existing generic coach
    route (see `docs/Strategy-Architecture.md` for why ordering
    matters here).

## What was deliberately left untouched

- `STRATEGY_REGISTRY` (`lib/trading/strategyService.ts`) — a
  pre-existing Phase 24 stub, unrelated to per-user persisted strategy
  metadata. Not removed, not renamed, not repurposed.
- `src/lib/trade-checklist.ts` (Phase 25) — the fixed, options-specific
  pre-trade checklist used by the Trade Workspace. Not merged into or
  replaced by the new generic Checklist Engine; they serve different
  purposes (one fixed operational checklist vs. many user-authored
  strategy checklists).
- Every existing deterministic engine (Market Structure, Liquidity,
  Session, Risk, Trade Planning) — read from only through the Evidence
  Framework's citation packaging, never recomputed, forked, or
  modified.
- `execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
  `autoAdjustment.ts` — zero-line diff, confirmed via `git diff --stat`
  before and after this phase's implementation.
