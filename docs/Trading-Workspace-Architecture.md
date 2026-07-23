# Trading Workspace — Architecture (Phase 25)

Technical companion to `docs/Institutional-Trade-Workspace.md` (what/why) and `docs/Trading-Workflow.md` (user workflow). This document covers the concrete backend/frontend wiring.

---

## 1. Backend

### New tables

```
trading_trade_plans          (lib/db/manual-migrations/030_trading_trade_plans.sql)
  id               serial PK
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT
  symbol           text NOT NULL
  direction        text NOT NULL            -- "long" | "short"
  status           text NOT NULL DEFAULT 'draft'  -- draft | active | closed | cancelled
  thesis           text NOT NULL
  account_risk_pct real NOT NULL
  entry_price      real NOT NULL
  stop_price       real NOT NULL
  target_price     real NOT NULL
  position_size    real                     -- nullable: honestly null when accountValue wasn't supplied or stop distance is 0
  risk_reward_ratio real                    -- nullable: honestly null when stop distance is 0
  created_at       timestamptz NOT NULL DEFAULT now()
  updated_at       timestamptz NOT NULL DEFAULT now()  -- $onUpdate

trading_workspace_notes      (lib/db/manual-migrations/031_trading_workspace_notes.sql)
  id               serial PK
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT
  symbol           text NOT NULL
  note             text NOT NULL
  created_at       timestamptz NOT NULL DEFAULT now()
  updated_at       timestamptz NOT NULL DEFAULT now()
```

Both are brand-new tables (zero existing rows), so both are `NOT NULL` from creation except the two honestly-nullable derived fields on `trading_trade_plans` — no nullable→backfill→enforce migration was needed, matching the precedent set by every other from-scratch table in this codebase (`trading_positions`, `investing_research_notes`, etc). Neither table is foreign-keyed to `trading_positions` — a trade plan may never become a position, and a position may exist with no formal plan behind it.

### New library code

- **`artifacts/api-server/src/lib/trading/sessionService.ts`**
  - `activeSessionsAt(date: Date): TradingSessionName[]` — pure, reads `TRADING_SESSION_WINDOWS` (Phase 24), handles the Sydney window's midnight wrap.
  - `buildSessionData(symbol, asOf?): Promise<SessionData | null>` — resolves 15-minute candles via the existing `MarketDataProvider.getCandles()` seam (Sprint 32), filters to the UTC calendar date matching `asOf`, and computes session high/low. Honestly returns `null` for an invalid ticker shape; honestly returns `null` session high/low when no candles fall on the target date (a thin/edge sample), never fabricated from a different day's bars.
  - **Note on `getCandles()`'s own `asOf` contract**: it expects a **date-only** string (`YYYY-MM-DD`, matching `todayStr()`'s own format), not a full ISO timestamp — `sessionService.ts` passes `todayStr(now)` to it while preserving the full instant for the response's own `asOf` field and the session-window comparison.

### New routes

| Route | Method | Purpose |
|---|---|---|
| `/trading/trade-plans` | GET | List the calling user's trade plans, newest first |
| `/trading/trade-plans/:symbol` | GET | List the calling user's trade plans for one symbol |
| `/trading/trade-plans` | POST | Create a plan (status always starts `draft`); derives `positionSize`/`riskRewardRatio` via `computeRiskParameters()` |
| `/trading/trade-plans/:id` | PATCH | Update `thesis` and/or `status` (status transitions validated via `transitionTradePlanStatus()`, 400 on an invalid one) |
| `/trading/trade-plans/:id` | DELETE | Delete a plan |
| `/trading/workspace-notes` | GET | List the calling user's notes, newest first |
| `/trading/workspace-notes/:symbol` | GET | List the calling user's notes for one symbol |
| `/trading/workspace-notes` | POST | Create a note |
| `/trading/workspace-notes/:id` | PATCH | Update a note's text |
| `/trading/workspace-notes/:id` | DELETE | Delete a note |
| `/trading/session/:symbol` | GET | Thin pass-through to `buildSessionData()`; accepts an optional `?asOf=` override |

Every Trade Plan / Workspace Note route is ownership-scoped via `getScopedUserId(req)` and the established `and(eq(id), eq(userId))` pattern — 404 (never a separate 403) for both "doesn't exist" and "isn't yours," matching every route in this codebase since Sprint 7. The Session route needs no ownership scoping — it's read-only market/session data, the same category as `routes/tradingStructure.ts`.

### OpenAPI / codegen

`openapi.yaml` gained a `trading-trade-plans`, `trading-workspace-notes`, and `trading-session` tag, the paths above, and the `TradingTradePlan`/`TradingTradePlanInput`/`TradingTradePlanUpdate`/`TradingTradePlanRisk`, `TradingWorkspaceNote`/`Input`/`Update`, and `TradingSessionData` schemas. `api-zod`/`api-client-react` were regenerated via `pnpm --filter @workspace/api-spec run codegen`. One naming note: Orval only generates a distinct response validator per *named* GET operation — since Trade Plans/Workspace Notes have no single-item `GET /:id` route, their `POST` handlers reuse the array's own per-item schema (`ListTradingTradePlansResponseItem` / `ListTradingWorkspaceNotesResponseItem`) rather than a separate `GetTradingTradePlanResponse` that was never generated.

---

## 2. Frontend

### `src/lib/trade-checklist.ts`

Pure, I/O-free. `buildTradeChecklist(inputs)` takes already-fetched `{ structure?, multiTimeframe?, liquidity?, risk?, tradePlan? }` and returns 6 `ChecklistItem`s (`{ id, label, status, detail }`), `status` one of `pass | warn | fail | unknown`:

| id | pass condition | warn condition | fail condition |
|---|---|---|---|
| `structure-reviewed` | data present | — | — |
| `confluence-reviewed` | agreement not `split` | `trendAgreement === "split"` | — |
| `liquidity-checked` | band not `Low` | `liquidityBand === "Low"` | — |
| `plan-created` | a plan exists | — | — |
| `position-size-computed` | `positionSize !== null` | `positionSize === null` (no account value) | — |
| `risk-within-limits` | `!portfolioBudget.capBreached` | — | `portfolioBudget.capBreached` |

Every item not yet reviewed (its underlying panel hasn't been fetched) is honestly `unknown` — never a fabricated `pass`.

### `pages/TradeWorkspace.tsx`

Replaces Phase 24's static placeholder. Structure:

- **Deep-linking**: `useSymbolFromDeepLink()`, mirroring `InstitutionalWorkspace.tsx`'s own hook exactly (reads `?symbol=` from `useSearch()`, writes back via `useLocation()`'s `navigate`).
- **Keyboard shortcuts**: a single `keydown` listener, mirroring `InstitutionalWorkspace.tsx`'s own — `/` focus search, `Escape` blur, `[`/`]` toggle the left/right panels.
- **Layout**: `ResizablePanelGroup` (horizontal), 3 columns, `autoSaveId="trade-workspace-layout"`:
  - **Left** (collapsible): Instrument Overview, Session Summary, Trade Checklist, Evidence.
  - **Main**: Market Structure Summary, Liquidity Summary, Multi-Timeframe Summary, Trade Plan Panel, Risk Panel — in the workflow's own top-to-bottom order.
  - **Right** (collapsible): Notes, Journal (condensed + quick-add, linking to `/trading-journal`), AI Trading Coach (chat panel reusing `streamCoach()`).
- **Hooks reused unmodified**: `useGetTradingStructure`, `useGetTradingMultiTimeframe`, `useGetTradingLiquidity`, `useGetTradingRisk`, `useListTradingJournalEntries`, `useCreateTradingJournalEntry` — all fetched eagerly per-symbol (unlike `TradingResearch.tsx`'s own on-demand Liquidity tab; this workspace's explicit workflow names "Review Liquidity" as a required sequential step on every visit, so eager fetching is the correct cost/UX tradeoff here).
- **New hooks consumed**: `useGetTradingSession`, `useListTradingTradePlansForSymbol`, `useCreateTradingTradePlan`, `useUpdateTradingTradePlan`, `useDeleteTradingTradePlan`, `useListTradingWorkspaceNotesForSymbol`, `useCreateTradingWorkspaceNote`, `useDeleteTradingWorkspaceNote`.
- **`handleSaveWorkspace()`**: reads the current Trade Plan form state and Notes textarea; if either has genuinely pending content, calls the corresponding create mutation (the exact same one each panel's own Save button calls) and reports via `useToast()` what was actually saved — never a fabricated "saved" confirmation when nothing was pending.

### Navigation

`/trade-workspace` and its nav entry (`Trade Workspace`, `LayoutTemplate` icon) were already wired in Phase 24 (`App.tsx`, `src/lib/nav-items.ts`) — no change needed this phase.

---

## 3. Testing

- **Backend**: `routes/tradingTradePlans.route.test.ts`, `routes/tradingWorkspaceNotes.route.test.ts`, `routes/tradingSession.route.test.ts` (live, real Postgres, SIMULATED path), `lib/trading/sessionService.test.ts` (unit), plus 2 new `tenantIsolation.test.ts` cases for the 2 new tables (reusing the established `assertTenantIsolation` helper).
- **Frontend**: `src/lib/trade-checklist.test.ts` (pure-function unit tests), `pages/TradeWorkspace.test.tsx` (mocked-generated-hook page tests, following `TradingResearch.test.tsx`/`InstitutionalWorkspace.test.tsx`'s own established pattern, including the `fireEvent.change` workaround for `ResizablePanelGroup`'s document-level listener interaction with `userEvent`'s typing simulation).

---

## 4. What was not touched

`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts` — zero-line diff. `autoExecutionLog` — untouched. Every Engine 1 (Investing Engine) file — untouched. No existing Engine 2 route, table, or component's behavior changed; every reused hook is called exactly as `TradingResearch.tsx` already calls it.
