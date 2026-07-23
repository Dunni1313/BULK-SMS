# Session Analysis (Phase 27 — Liquidity & Session Workbench)

This document describes the Session Windows model that powers the Liquidity & Session Workbench's Session Overview, Active/Previous Session Summary, Session High/Low Explorer, and Session Comparison panels.

## 1. The 4 real named sessions — no synthetic sessions

The Workbench supports **only** the 4 named trading sessions already defined in the existing, unmodified `TRADING_SESSION_WINDOWS` (`lib/tradingDomainModel.ts`, Phase 25):

| Session | UTC window | Source |
|---|---|---|
| Sydney | 21:00 → 06:00 | `TRADING_SESSION_WINDOWS.sydney` |
| Tokyo | 00:00 → 09:00 | `TRADING_SESSION_WINDOWS.tokyo` |
| London | 07:00 → 16:00 | `TRADING_SESSION_WINDOWS.london` |
| New York | 12:00 → 21:00 | `TRADING_SESSION_WINDOWS.new_york` |

No 5th session, no custom/user-defined session, and no synthetic session window was introduced this phase. `activeSessionsAt(date)` (Phase 25, unmodified) is the same function `sessionService.ts`'s own `buildSessionData()` already used to determine which sessions are open right now — this phase's own `sessionWindows.ts` reuses it unmodified for the exact same purpose.

## 2. Session Windows model (`lib/trading/sessionWindows.ts`)

For each of the 4 sessions, `buildSessionWindows(symbol, asOf?)` computes:

- **`role`** — `"active"` (currently open, from `activeSessionsAt()`), `"previous"` (the non-active session whose own most-recent window closed most recently), `"upcoming"` (the non-active session whose own next window opens soonest), or `"other"` (any remaining non-active session).
- **`startIso`/`endIso`** — the session's own **most recent** occurrence's start/end timestamps. For an active session this is the currently-open window; for a non-active session this is always its most recently-closed window (i.e. always in the past).
- **`nextStartIso`** — a genuinely separate, always-forward-looking timestamp: when this session's window will next open. This is distinct from `startIso` on purpose — a design correction made during this phase's own test-writing: an early draft used `startIso` for the "upcoming session" concept too, but a non-active session's own most-recent occurrence (`startIso`) is mathematically always in the past, which is the wrong semantic for "when does this open next." `nextStartIso` is always `startIso + 24h` for the session's own most recent window, giving the true next occurrence regardless of the session's current role.
- **`durationHours`** — each session spans exactly 9 hours (21→6, 0→9, 7→16, 12→21 all compute to 9), derived purely from each session's own UTC start/end hour, never hardcoded independently of `TRADING_SESSION_WINDOWS`.
- **`high`/`low`/`range`/`candleCount`** — computed by fetching real candles (`MarketDataProvider.getCandles()`, Sprint 32, unmodified) bounded to that specific session window and taking the max high / min low across them. Honestly `null`/`0` when no candle falls inside the window — never a fabricated range (see §3 below).
- **`freshnessMinutes`** — minutes between the window's own end and `asOf` ("now"), an honest staleness indicator for a non-active session's own last-known range.
- **`overlap`** — `true` whenever more than one session is simultaneously active (i.e. `activeSessionNames.length > 1`), reusing `activeSessionsAt()`'s own array length — never a new overlap-detection algorithm.

`buildSessionWindowsFromCandles()` is the pure core (candles already resolved, no I/O); `buildSessionWindows()` is the thin orchestration wrapper that resolves a `MarketDataProvider` and calls it, honestly returning `null` for an unresolvable ticker shape — the same pattern every other Engine 2 "Core" module in this codebase already follows (Sprints 33–38).

## 3. Disclosed, honest data-coverage limitation

The existing, unmodified `SimulatedMarketDataProvider` (`lib/tradingMarketData.ts`, Sprint 32) generates intraday candles only within a stylized ~09:30–16:00 UTC business-hours window (`barTime()`'s own nominal 9:30 session start, spanning `BARS_PER_DAY × INTERVAL_MINUTES` — always exactly 6.5 hours regardless of which intraday interval is requested). This is a real, structural property of the existing, protected-by-precedent market data model, not something introduced or alterable by this phase.

Its consequence for Session Windows:

| Session | UTC window | Overlaps 09:30–16:00 UTC? | Consequence |
|---|---|---|---|
| Sydney | 21:00 → 06:00 | No | `high`/`low`/`range` always `null`, `candleCount` always `0` |
| Tokyo | 00:00 → 09:00 | No | `high`/`low`/`range` always `null`, `candleCount` always `0` |
| London | 07:00 → 16:00 | Fully | Real, non-null high/low/range/candleCount |
| New York | 12:00 → 21:00 | Partially (12:00–16:00) | Real, non-null high/low/range/candleCount, though narrower than its own full 9-hour window |

This is disclosed here, in code comments in `sessionWindows.ts` and `LiquidityWorkbench.tsx`, and directly in the UI (the Session High/Low Explorer panel's own `CardDescription`) rather than hidden. Per this codebase's unbroken "thin/empty sample → honest empty result, never fabricated" discipline (established since Investment Quality's/Competitive Advantage's/Management Quality's own permanently-unavailable metrics, Phase 2), Sydney and Tokyo's own honest `null`/`0` reads are the correct behavior — not a defect to work around by modifying the shared `tradingMarketData.ts`, which would require its own separate, explicitly-approved change outside this integration phase's scope.

## 4. What Session Comparison shows

The Session Comparison panel renders all 4 named sessions side by side — session name, role (active/previous/upcoming/other), duration, range (or an honest "—" when unavailable), and candle count — letting a user directly see, for example, that Sydney/Tokyo's own rows honestly show no range while London/New York's do. This is a pure tabular presentation of `sessionWindows.sessions`, not a new comparison algorithm.
