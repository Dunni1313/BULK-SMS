# Phase 4 — Master Execution Plan

**Status: PLANNING ONLY. No implementation has begun.** This document is a plan, not a build — per explicit instruction, Phase 4 does not start until the project owner gives a separate, explicit go-ahead, and even then each sprint follows the same present-plan → get-approval → implement → validate → commit process every sprint in Phases 1–3 followed (`CLAUDE.md` §3).

**Prepared after:** Phase 3's close (`docs/Phase-3-Final-Completion-Report.md`), a fresh review of `docs/DK-AI-OS-Architecture-Blueprint.md`, `CLAUDE.md`'s full sprint history (Phases 1–3, 51 shipped sprints), and direct inspection of the current codebase — not from assumption. Sprint numbering continues the project's single global counter: Phase 1 was Sprints 1–10, Phase 2 was Sprints 11–31, Phase 3 was Sprints 32–51. **Phase 4 begins at Sprint 52.**

---

## 1. Framing: What Phase 4 Actually Is

The project owner's own framing for this phase names all three long-term DK engines:

1. **Institutional Investing Engine (Fundamental Analysis)** — Engine 1, built in Phase 2 (Sprints 11–31, 21 sprints, complete).
2. **Institutional Trading Engine** — Engine 2, built in Phase 3 (Sprints 32–51, 20 sprints, complete) — explicitly marked **"now complete"**.
3. **Options Income Engine** — Engine 3, the original pre-existing system — explicitly marked **"enhancements only — core already exists."**

Read together, this frames Phase 4 not as "build a fourth thing" but as **an enhancement and consolidation phase across a platform where all three engines' cores already exist.** By the same logic that makes Engine 3 "enhancements only," Engine 1's core is equally already built — so Phase 4's Engine 1 work is additive depth on top of Phase 2's 21-sprint foundation, not a rebuild. Engine 2 needs no further core work at all (per the explicit "now complete"); its role in Phase 4 is as a **reuse target** — its already-shipped services (Market Data, Structure, Regime, Probability, Risk) are exactly the kind of proven infrastructure a mature platform should lean on rather than reinvent.

Phase 4 therefore has four real workstreams, in this recommended order:

- **A. Platform Cross-Cutting Foundation** — housekeeping items flagged as technical debt across Phases 1–3, done once, centrally, before they compound further.
- **B. Cross-Engine Consolidation & Unification** — the platform-level "one coherent product" work the Blueprint always envisioned but that Phases 1–3 deliberately deferred in favor of proving each engine independently first.
- **C. Options Income Engine (Engine 3) Enhancements** — additive, never touching the protected execution/risk/kill-switch code.
- **D. Institutional Investing Engine (Engine 1) Enhancements** — additive, closing gaps Phase 2's own sprint reports explicitly flagged as deferred future work.

---

## 2. Recommended Implementation Order & Rationale

**A before B before C/D before the closing sprint**, for a concrete reason at each transition:

1. **Platform Foundation first** because every later sprint benefits from it and nothing later depends on it being deferred — rate-limiting and CORS finalization touch routes across all three engines, so doing this once, early, is strictly cheaper than doing it three times or retrofitting it after Engine 3/Engine 1 enhancement sprints add yet more routes.
2. **Cross-Engine Consolidation second** because it's genuinely the highest-value, most Blueprint-aligned work available, and every engine it touches (Engine 1, Engine 2, Engine 3) is already complete and stable — there is no reason to wait for further engine-specific work before building the read-only cross-references the Blueprint always intended. This is also the lowest-risk category of "new" work, since every consolidation sprint below is explicitly read-only/UI-composition, never a rewrite of engine logic.
3. **Options Income Engine (C) before Institutional Investing Engine (D)** because Engine 3's enhancement list (§5 below) is smaller and lower-risk than Engine 1's (§6 below) — shipping the smaller, more bounded workstream first builds momentum and de-risks the larger one. It also respects the natural reading order of the project owner's own numbered list.
4. **A closing unification sprint last**, mirroring the discipline Phase 2's Sprint 31 and Phase 3's Sprint 51 both established: prove the whole phase's work holds together as one coherent product before declaring the phase done.

---

## 3. Recommended Sprint Sequence

| Sprint | Workstream | Module | Summary |
|---|---|---|---|
| 52 | A | Platform Hardening | Rate-limiting middleware (`express-rate-limit` or equivalent) across all routes; finalize the CORS allowed-origin list (`CLAUDE.md` §3, outstanding item #6) — both flagged as open since the original Technical Audit, both worth doing once, centrally. |
| 53 | A | Frontend Bundle Code-Splitting | Route-level `dynamic import()` or `manualChunks` for `ravish-trading`'s now-~1.5MB production bundle (flagged at Phase 3's close, §11 of the completion report) — a pure build-tooling change, zero behavior change, fully covered by the existing frontend test suite. |
| 54 | B | Shared ScoreCard/Hard-Cap-Override Utility | Extract the proven "score 0–100, hard-cap override on a breached threshold" *pattern* — independently reimplemented 3 times now (`portfolioHealth.ts`/`risk.ts` in Engine 3, `investingRisk.ts` in Engine 1, `tradingRisk.ts` in Engine 2) — into a new, generic, opt-in utility. **Never modifies `risk.ts` or any existing risk module** (protected/working code stays untouched); offered only to *future* risk-scoring code. |
| 55 | B | Cross-Engine Command Center | The Blueprint's own "nice-to-have," explicitly flagged in the Phase 3 plan (§4) and deliberately deferred at Sprint 50's kickoff to keep that sprint bounded: extend the Institutional Dashboard (or a new page) to show, for one symbol, Engine 1's Investment Committee verdict *alongside* Engine 2's technical read — a read-only cross-reference, the same disclosed-intentional-coupling pattern Sprint 11 established for `valueReport.ts` reading `optionsMath.ts`'s IV rank. |
| 56 | B | Macro/Regime Side-by-Side View | A small UI addition showing `marketBriefing.ts` (Engine 3), `investingMacro.ts` (Engine 1), and `tradingRegime.ts` (Engine 2)'s three independent regime reads side-by-side for context — pure UI, zero engine-logic merging, directly addresses the "easy to confuse" risk Sprint 36's own disclosed comment flagged. |
| 57 | C | Options Engine-Native Backtesting | A genuine walk-forward options-strategy backtest, applying the *discipline* (not the code) Sprint 49 proved for Engine 2 — replaying real simulated price paths bar-by-bar through actual options-pricing math, rather than `routes/backtest.ts`'s existing fabricated-statistics equity curve. New, parallel module; `routes/backtest.ts` and `optionsMath.ts` are read from, never modified. |
| 58 | C | AI Options Coach — Conversation Memory Parity | Bring the options coach's UI up to the same session-local Q&A history/streaming UX Engine 1's and Engine 2's coach panels already have (Sprints 30, 48) — a frontend-only enhancement; `coach.ts`'s deterministic math and disclaimer enforcement are untouched. |
| 59 | C | Options Engine Route Audit & Hardening | A focused pass over Engine 3's own routes for any gaps Sprint 52's platform-wide rate-limiting pass didn't fully close, given Engine 3's routes sit closest to real (if advisory-only) trading decisions — scoping TBD at kickoff. |
| 60 | D | Document Intelligence — Additional Document Types | Extend `EdgarDocumentProvider` (Sprint 22) to implement 10-Q and earnings-transcript ingestion — the `DocumentType` union already anticipates these; only `"10-K"` is implemented today. Zero interface change needed. |
| 61 | D | AI Investment Committee — LLM-Narrated Synthesis | Upgrade the Investment Committee's Sprint 17 deterministic-only reasoning to genuine `ai-core`-narrated synthesis, the exact upgrade path Sprint 17's own report explicitly named as deferred future work, reusing the `narrate()`/`enforceDisclaimer()` pattern already proven three times (options coach, Engine 1's value coach, Engine 2's trade coach). |
| 62 | D | Live FMP/Alpha Vantage Provider Verification | **Conditional** — only if API credentials become available. Every Phase 2 sprint since Sprint 11 built the live-provider code path but could never verify it end-to-end for lack of a key; this sprint is pure verification (mocked-fetch tests already exist), not new logic, if/when credentials are provided. |
| 63 | D | Management Quality Analysis — LLM-Narrated Dimensions | Fill in the 4 dimensions Sprint 23 explicitly left `unavailable` pending "LLM reading comprehension" (Strategic Consistency, Long-Term Focus, Communication Quality, Shareholder Alignment) — **depends on Sprint 61** proving the LLM-narration-of-structured-financial-data pattern first, since this is the higher-compliance-risk sibling of that same upgrade (per CLAUDE.md's own flagged "highest reputational/compliance risk" framing for this module). |
| 64 | — | Phase 4 Unification & Regression Pass | Mirrors Sprint 31/51's own closing discipline: a full-platform regression proving all 3 engines plus the new Cross-Engine Command Center (Sprint 55) resolve consistently for one symbol, one user, with zero fabricated results anywhere. Closes Phase 4. |

---

## 4. Estimated Sprint Count

**13 sprints (Sprint 52 through Sprint 64), range 10–16**, depending on:

- Whether Sprint 62 (Live Provider Verification) is skipped entirely for lack of credentials (−1 sprint) — the same conditional-sprint shape Phase 3's own Sprint 47/Live-Market-Data-Provider slot had.
- Whether Sprint 59 (Options Engine Route Audit) turns out to need zero additional work once Sprint 52's platform-wide pass is scoped broadly enough (−1 sprint, folded into Sprint 52).
- Whether Sprint 57 (Options-native Backtesting) needs to split into a Core + Route/UI pair, mirroring the exact split Phase 3's own Backtesting sprint (49) avoided needing but several other Phase 3 modules (Structure, Multi-Timeframe, Liquidity, Regime, Probability, Risk) did need (+1 sprint).
- Whether Sprint 61 and Sprint 63 turn out simple enough to merge into one "LLM-narrated synthesis, applied to both the Committee and Management Quality" sprint once actually scoped (−1 sprint), the same kind of merge-opportunity Phase 3's own plan flagged for Multi-Timeframe/Regime Detection before Sprint 34 confirmed they needed to stay separate.

This is a **smaller phase than either Phase 2 (21 sprints) or Phase 3 (20 sprints)**, consistent with the "enhancements only, cores already exist" framing — Phase 4 has no foundational platform-layer work of Phase 1's kind, and no from-scratch engine of Phase 2/3's kind.

---

## 5. Major Milestones

- **Milestone A — Platform Hardened** (Sprints 52–53): rate-limiting live on every route, CORS list finalized, frontend bundle within Vite's default chunk-size warning threshold.
- **Milestone B — One Coherent Platform** (Sprints 54–56): the Cross-Engine Command Center ships — the first point in this project's history where a user can see Engine 1's fundamental verdict, Engine 2's technical read, and Engine 3's options-income context for the same symbol on one screen, the literal fulfillment of the Blueprint's original three-engine vision.
- **Milestone C — Options Income Engine Enhanced** (Sprints 57–59): a genuine walk-forward options backtest exists alongside the legacy statistics-based one; the options coach reaches UX parity with Engines 1/2's coaches.
- **Milestone D — Institutional Investing Engine Enhanced** (Sprints 60–63): Document Intelligence covers more filing types; the AI Investment Committee and (contingent on 61) Management Quality Analysis both gain genuine LLM-narrated reasoning, closing two of Phase 2's own explicitly-disclosed deferred-work items.
- **Milestone E — Phase 4 Complete** (Sprint 64): full-platform regression passes, Phase 4 completion report delivered, mirroring this document's own role at Phase 3's close.

---

## 6. Dependencies

- **Sprint 63 depends on Sprint 61** (see §3) — do not schedule 63 before 61's LLM-narration pattern is proven for structured financial synthesis; the two share almost identical risk profile and technique, so proving it once on the lower-compliance-risk module (the Committee, which never characterizes a named individual) before applying it to the higher-compliance-risk one (Management Quality, which CLAUDE.md itself flags as the highest reputational-risk module in Engine 1) is the correct order, not an arbitrary one.
- **Sprint 62 depends on external credentials**, not on any other sprint — it can run at any point once API keys are available, including in parallel with unrelated work, but produces nothing if credentials never arrive.
- **Sprint 55 depends on nothing new** — both Engine 1's Investment Committee (Phase 2, Sprint 17) and Engine 2's per-symbol signals (Phase 3, Sprints 33–43) are already complete and stable; this is a pure composition sprint the same way Phase 3's own Sprint 50 was.
- **Sprint 57 depends on `optionsMath.ts` being read from, never modified** — this is a hard constraint, not a scheduling dependency: any implementation approach that requires changing `optionsMath.ts`'s own pricing/Greeks logic to build the new backtest engine is out of scope and must be re-planned, per CLAUDE.md rule 1.
- **No sprint in this plan depends on the deferred Live Market-Data Provider** (Engine 2, §25 Decision 7 of the Phase 3 plan) — every Phase 4 sprint above works correctly against SIMULATED data throughout; the deferred item remains available to schedule independently at any future point without blocking anything here.

---

## 7. High-Risk Areas

Ranked by genuine risk, not by effort:

1. **Sprint 57 (Options Engine-Native Backtesting) — highest risk in this plan.** It sits closest to the protected execution/pricing code of any Phase 4 sprint. `optionsMath.ts` must be read from (for realistic Greeks/pricing during the walk-forward simulation) but never modified — the same "read, never write" discipline Engine 1's `valueReport.ts`/`valueInvesting.ts` already proved safe for `optionsMath.ts`'s `getSnapshot()`/`Snapshot` type (Phase 2, Sprint 11). Any design that can't cleanly stay read-only against the protected files must be flagged and re-scoped before implementation, not worked around.
2. **Sprint 63 (Management Quality LLM dimensions) — second-highest, a compliance/reputational risk, not a technical one.** CLAUDE.md already names this "the highest reputational/compliance risk in Engine 1" module category. Phase 2 Sprint 23's own deterministic-only design sidestepped this risk almost entirely by never naming or characterizing a specific executive; any LLM-narrated upgrade must preserve that exact guarantee — narrate only the *company's* process-discipline signals, never a named individual — and this constraint should be restated explicitly and re-confirmed at that sprint's own kickoff, not assumed to carry over silently.
3. **Sprint 52 (Rate-limiting) — moderate technical risk, low business risk.** Rate-limiting misconfigured too aggressively can break legitimate automated flows (the auto-execution scheduler's own internal calls, if they route through rate-limited middleware) — this needs explicit scoping at kickoff to exclude internal/scheduler-originated requests from any per-IP or per-user limit, distinct from external API abuse protection.
4. **Sprint 59 (Options Engine route audit) — low risk, but scope-creep risk is real.** "Audit and harden" sprints have historically been the ones most likely to expand beyond their bound (see Phase 3's own repeated "do not expand scope" instructions across Sprints 38–48); this sprint's kickoff should draw a hard, written boundary before any code is touched.
5. **Everything in Workstream B (Sprints 54–56) is comparatively low risk** — every sprint there is explicitly read-only/UI-composition over already-complete, already-tested engines, the same category of work Phase 3's own Sprints 50/51 proved out safely.

---

## 8. Which Existing Engine 2 Services Should Be Reused

Engine 2 is "now complete" — its value to Phase 4 is entirely as a reuse target, not as a place for more first-party work:

- **`MarketDataProvider` (`lib/tradingMarketData.ts`, Sprint 32)** — the cleanest, most reusable seam in Engine 2. A real, bounded, deterministic SIMULATED candle/quote generator. **Recommended reuse candidate for Sprint 57's Options-Native Backtesting**: rather than inventing a fourth independent SIMULATED price generator for options-strategy backtesting, evaluate whether the underlying-price path `MarketDataProvider` already produces can drive the options-pricing side of that new backtest engine — this would be the first genuine cross-engine *data* reuse in the whole platform (every prior cross-engine interaction has been read-only *analysis* reuse, e.g. Engine 1 reading Engine 3's IV rank, never a shared price-path generator). Must be evaluated, not assumed, at Sprint 57's own kickoff — Engine 2's candle shape (OHLCV) and Engine 3's options-pricing needs (an underlying spot-price path plus IV) may or may not compose cleanly; if they don't, the existing "each engine gets its own independent SIMULATED generator" discipline should simply continue, disclosed the same way as always.
- **`buildProbabilityAnalysis()`/`analyzeProbability()` (`lib/tradingProbability.ts`, Sprint 37)** — a generic driftless-lognormal probability-cone calculator, not options-specific despite living in Engine 2. **Recommended reuse candidate for Sprint 55's Cross-Engine Command Center**: the same probability cone already shown on `TradingResearch.tsx`/`InstitutionalDashboard.tsx` could be surfaced as read-only context next to Engine 3's own options strategies for the same underlying symbol, giving a trader a technical-probability view alongside their options income position — read-only, zero engine-logic change.
- **`classifyAgreementSignal<T>()` (Phase 2 Sprint 17, reused again in Phase 3 Sprint 34/51)** — already proven 3 times across 2 engines. Any new "does everyone agree" scoring introduced in Phase 4 (e.g., a future options-strategy consensus signal) should reuse this generic utility rather than reinvent agreement-bucketing logic a fourth time.
- **`tradingRisk.ts`'s ScoreCard/hard-cap-override shape** — feeds directly into Sprint 54's own extraction (see §3) rather than being reused as-is; the *pattern*, not the file, is the reusable asset.
- **The AI Trade Coach's composition discipline (`routes/tradingCoach.ts`, Sprint 47)** — the cleanest example in the whole codebase of "one call transitively resolves an entire engine's worth of signals with zero duplicate fetches." This exact composition shape (call the deepest already-composed function, read off its nested fields, never re-derive) is the template Sprint 55's Command Center and Sprint 58's Options Coach enhancement should both follow.

**Not recommended for reuse:** `trading_positions`/`trading_journal_entries` (Engine 2's own user-authored data) — these model an active trader's own open positions and reflections, a genuinely different concept from Engine 1's target-weight portfolio construction or Engine 3's executed options trades, and the Phase 3 plan itself explicitly ruled out merging any of these three (§4: "Watchlist/portfolio construction are explicitly NOT shared... Engine 2 gets its own schema, not a repurposing of Engine 1's"). Phase 4 should continue that discipline, not revisit it without a genuinely new reason.

---

## 9. Consolidation Opportunities Across the Platform

Ranked by value-to-risk ratio, highest first:

1. **Shared ScoreCard/hard-cap-override utility (Sprint 54)** — the single best consolidation opportunity in the platform. Three independent, working implementations of the same scoring pattern exist (`portfolioHealth.ts`/`risk.ts` in Engine 3, `investingRisk.ts` in Engine 1, `tradingRisk.ts` in Engine 2), each written from scratch because the prior one lived in a "never touch" or "different engine, deliberately independent" file. Extracting the *pattern* into a generic, opt-in utility — without ever modifying the 3 existing implementations — means the *next* risk-scoring module in this codebase doesn't have to reinvent it a fourth time. Low risk (purely additive), high value (real, disclosed duplication finally addressed without violating engine-independence discipline).
2. **The Cross-Engine Command Center (Sprint 55)** — not code consolidation, but the platform-level consolidation the Blueprint always described: one screen, one symbol, all three engines' own read-only verdicts. This is the most Blueprint-aligned single deliverable available in Phase 4.
3. **Macro/Regime side-by-side view (Sprint 56)** — a smaller version of the same idea, specifically for the three independent regime-detection modules that already cross-reference each other in code comments but have never been shown to a user side-by-side.
4. **AI narration pattern, already consolidated (no new work needed)** — `lib/ai-core` (Phase 1, Sprint 9) already serves 3 coach domains through one shared `narrate()`/`narrateStream()`/`enforceDisclaimer()` machinery. This is Phase 4's proof that the consolidation instinct is right when done at the correct layer (a shared library, not a shared feature) — every recommendation above follows this exact template.
5. **SIMULATED base-price generators — explicitly NOT recommended for consolidation.** Three independent generators exist (`optionsMath.ts`'s `UNIVERSE`, `investingUniverse.ts`'s `INVESTING_UNIVERSE`, `tradingMarketData.ts`'s `TRADING_MARKET_UNIVERSE`), each deliberately duplicating rather than importing the other, each producing a *different* SIMULATED price for the same real-world ticker (e.g., AAPL) depending on which engine you're looking at. This has been disclosed and re-affirmed at every point it came up (Sprints 11, 26, 32) as a deliberate engine-isolation choice, not an oversight. **Recommendation: leave as-is.** The alternative (a shared canonical SIMULATED price-seed layer all three engines read from) would be a genuine architecture change with real coupling risk, for a benefit (numeric consistency across three intentionally-independent SIMULATED views) that no sprint's own acceptance criteria has ever required. If a future sprint's kickoff surfaces a concrete user complaint about this inconsistency, revisit it then, as its own explicitly-scoped decision — not preemptively here.

---

## 10. What This Plan Deliberately Does Not Include

- **No implementation.** Per the explicit instruction, this document is planning only.
- **No work on the protected files** (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`, `autoAdjustment.ts`, `autoExecutionLog`) beyond read-only consultation, anywhere in this plan.
- **No live Market-Data Provider work for Engine 2** — remains deferred per the project owner's own explicit instruction; nothing in Phase 4 requires or blocks on it.
- **No monorepo restructure** — Phase 3's own §25 Decision 1 (no restructure) continues to apply; every new Phase 4 module follows the same flat `artifacts/api-server/src/{routes,lib}` + naming-prefix convention that has held with zero friction across 51 sprints.
- **No forced consolidation of the three SIMULATED price generators** (see §9.5) or the three user-authored position/journal/portfolio schemas (see §8) — both were evaluated and explicitly left alone, for stated reasons, not overlooked.

---

*This plan makes no code changes. Every file path and behavior claim above was verified by direct inspection of the actual repository at the close of Phase 3, not assumed from the Blueprint or prior planning documents alone — the same discipline `docs/Phase-2-Investing-Engine-Execution-Plan.md` §0 and `docs/Phase-3-Trading-Engine-Execution-Plan.md` §0 both established before their own phases began.*
