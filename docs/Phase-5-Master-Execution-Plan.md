# Phase 5 — Draft Execution Plan (AWAITING OWNER DECISIONS BEFORE FINALIZATION)

**Status: DRAFT.** Not approved. No sprint under this plan has begun. Per the established per-sprint process, this document is presented for review; several genuine scope decisions (§2) must be resolved by the project owner before it can be finalized the way `docs/Phase-4-Master-Execution-Plan.md` was finalized before Sprint 52 began. Sprint numbering continues the project's single global counter: Phase 1 was Sprints 1–10, Phase 2 was Sprints 11–31, Phase 3 was Sprints 32–51, Phase 4 was Sprints 52–64 (61 shipped: 12 sprints; Sprint 62 blocked, open). **Phase 5 would begin at Sprint 65.**

**Prepared after:** Phase 4's close (`docs/Phase-4-Final-Completion-Report.md`), a fresh reconciliation of `docs/DK-AI-OS-Architecture-Blueprint.md`'s original 7-phase roadmap against what this repository's own phase-by-phase execution actually did (which diverged from the Blueprint's literal phase numbering — disclosed below), and direct inspection of the current codebase.

---

## 0. Reconciling the Blueprint's Original Roadmap With What Actually Shipped

The Blueprint (§5) laid out 7 phases: Foundation → Investing Engine → Trading Engine → **Options Income Engine (move + harden existing code)** → **Integration** → Testing → Production. This repository's actual execution diverged from that numbering starting at Phase 4 — a deliberate, disclosed choice each time, not drift:

- **Phase 1–3 matched the Blueprint exactly:** Foundation, Investing Engine, Trading Engine.
- **The executed "Phase 4"** (`docs/Phase-4-Master-Execution-Plan.md`, Sprints 52–64) was **not** the Blueprint's original Phase 4 ("Options Income Engine — move + harden"). It was a fresh architecture review's own construction: platform hardening, frontend performance, and — genuinely significant for this reconciliation — **it already delivered a meaningful slice of the Blueprint's original Phase 5 ("Integration")**: the Cross-Engine Command Center (Sprint 54, "one screen showing Engine 1 + Engine 2 for the same symbol"), the Macro/Regime Side-by-Side View (Sprint 55, three engines' regime reads together), and Alerts & Notifications (Sprint 56, the platform's first push-based capability, satisfying part of the Blueprint's "Notification delivery" deliverable).

**Net effect: the Blueprint's original Phase 4 (Options Income move+harden) was never executed as its own phase, and Phase 5 (Integration) is now partially, not fully, satisfied.** Direct inspection at Phase 5-planning time confirms what's actually still missing from each:

**From the Blueprint's original Phase 4 (Options Income Engine), still outstanding:**
- The "composable strategy builder" — confirmed by direct inspection of `optionsMath.ts`: today there are exactly 4 hand-built strategy functions (`buildIronCondor`, `buildIronFly`, `buildCalendarSpread`-equivalent, `buildEarnings`, keyed by a `WIN_RATE_BASE` lookup of `iron_condor`/`iron_fly`/`calendar_spread`/`earnings`), not a generalized composable engine. This is squarely inside `optionsMath.ts`, a CLAUDE.md-protected file.
- Live-data end-to-end verification for the options engine's own providers remains unproven (distinct from, but analogous to, Sprint 62's still-blocked Engine 1 live-provider verification).
- The `trades` table was never migrated into a "shared Portfolio DB schema" — Phase 1 Sprint 4/7 added `userId` scoping to it in place, which satisfied the *multi-tenancy* half of "move to shared platform," but no cross-engine portfolio schema unification happened.

**From the Blueprint's original Phase 5 (Integration), still outstanding after Phase 4's partial delivery:**
- **Unified Portfolio Dashboard (stocks + options combined)** — does not exist. Engine 1 has `PortfolioConstruction.tsx` (target-weight stock holdings), Engine 3 has `Portfolio.tsx`/`PortfolioAI.tsx` (real trades-backed account tracking). They remain two separate pages/data models, never combined into one view.
- **Cross-engine Reporting** — `dailyReport.ts` remains Engine-3-only (options-income-scoped); no report spans all three engines.
- **Unified Settings UI** — `settings` is already one shared per-user table/route (`routes/settings.ts`, since Phase 1 Sprint 5), so the *data layer* is already unified; whether the `Settings.tsx` *page* should be reorganized around this fact is a smaller, optional UX question, not a backend gap.
- **Cross-engine AI Assistant routing** — does not exist. Three separate coach chat surfaces exist today (`Assistant.tsx` for Engine 3, `StockResearch.tsx`'s Ask panel for Engine 1, `TradingResearch.tsx`'s coach panel for Engine 2), each its own page, no single chat surface that auto-routes by detected intent the way the Blueprint's own §5 text describes reusing `routes/ai.ts`'s existing intent-detection pattern for.
- **Notification delivery beyond in-app** (email/push/webhook) — Sprint 56 shipped in-app only, by the project owner's own explicit choice at that sprint's kickoff (no real SMTP/push credentials or infrastructure existed in this session). This remains exactly as blocked as it was at Sprint 56 — nothing has changed.

**Genuinely new since the Blueprint was written, not in its original 7-phase list at all, and not resolved by Phase 4:**
- Sprint 62 (Live FMP/Alpha Vantage Provider Verification) — still blocked on credentials.
- Two housekeeping items flagged since the original Technical Audit, confirmed still unresolved by direct inspection: `ravish-trading-engine.zip` (860KB, still at the repo root) and `artifacts/mockup-sandbox` (still present, still undecided).
- Two items from CLAUDE.md §3's own outstanding-decisions list, unresolved for multiple phases now: `stock_analysis_history` per-user-vs-shared caching (item #3), the `OPENAI_API_KEY` deprecation window (item #7).
- The Blueprint's own Phase 6 (Testing/Security Audit) — explicitly framed as "not the only place tests get written" but as a "formal checkpoint" — has never been run as its own dedicated phase; every sprint across Phases 1–4 added its own tests continuously (matching the Blueprint's own stated intent), but no dedicated cross-engine security/load/chaos-testing pass has happened.

This reconciliation is why Phase 5 cannot simply be "run the Blueprint's Phase 5 verbatim" — a meaningful fraction of it already shipped under a different name, and a meaningful fraction of the Blueprint's *Phase 4* is still owed. This plan treats Phase 5 as: **finish what Phase 4 (Blueprint) and Phase 5 (Blueprint) actually still owe, resolve the remaining standing decisions, and leave a clean assessment of whether Phase 6 (Testing/Security Audit) is next.**

---

## 1. Candidate Sprint List (draft — not yet approved)

| # | Candidate sprint | Blueprint origin | Effort (rough) | Touches protected files? |
|---|---|---|---|---|
| 65a | Housekeeping: resolve `ravish-trading-engine.zip` and `artifacts/mockup-sandbox` | Technical Audit (pre-Phase-1) | XS | No |
| 65b | Close `stock_analysis_history` per-user-vs-shared caching decision (CLAUDE.md §3 item #3) | Phase 1 plan's own deferred item | S | No |
| 65c | Close the `OPENAI_API_KEY` deprecation window (CLAUDE.md §3 item #7) | Phase 1 Sprint 2's own deferred item | XS | No |
| — | Options Income Engine — Composable Strategy Builder | Blueprint Phase 4 | L, **high-stakes** | **Yes — `optionsMath.ts`/`execution.ts`** |
| — | Options Income Engine — Live-Data End-to-End Verification | Blueprint Phase 4 | M (conditional on live broker/data credentials, likely blocked the same way Sprint 62 is) | Read-only verification, not a modification, but of protected-adjacent providers |
| — | Unified Portfolio Dashboard (stocks + options) | Blueprint Phase 5 | L | No (new composition page, reads existing tables) |
| — | Cross-Engine Daily Report | Blueprint Phase 5 | M | No |
| — | Cross-Engine AI Assistant Routing (one chat surface, auto-routes by engine) | Blueprint Phase 5 | M–L | No (reuses `routes/ai.ts`'s existing intent-detection pattern per the Blueprint's own suggestion) |
| — | Notification Delivery — Email/Push channels | Blueprint Phase 5 | Conditional — blocked without real SMTP/push credentials, same class of blocker as Sprint 62 |  No |
| — | Testing & Security Audit checkpoint | Blueprint Phase 6 | M–L | Read-only audit of protected files, no modification without separate approval |

This is a candidate list, not a committed roadmap — several entries above are mutually exclusive with "do nothing here yet" depending on the decisions in §2.

---

## 2. Genuine Owner Decisions Required Before This Plan Can Be Finalized

Unlike Phase 4's own planning (which needed only one flagged decision, the notification delivery channel, resolved via `AskUserQuestion` at Sprint 56's kickoff), Phase 5's candidate scope surfaces several real, materially-different-outcome choices that were not pre-resolved by any prior sprint or owner instruction. None of these should be inferred or guessed:

1. **Composable Strategy Builder scope, given CLAUDE.md rule 1** ("Never modify options execution logic... without explicit, specific approval for that exact change"). Generalizing 4 hand-built strategy functions in `optionsMath.ts` into a composable engine is squarely "options execution logic"-adjacent, the single highest-consequence item in this entire candidate list per the Blueprint's own words ("the single highest-consequence mistake available in this entire roadmap is here"). Is this in scope for Phase 5 at all, and if so, does it get its own isolated sprint with maximum scrutiny, or stay deferred indefinitely?
2. **Unified Portfolio Dashboard**: is combining Engine 1's target-weight stock holdings (Portfolio Construction) and Engine 3's real trades-backed account (Portfolio/Portfolio AI) into one view actually wanted, given they represent genuinely different things (a target allocation model vs. a live P&L ledger)? A dashboard that merely *displays both side by side* (like Sprint 50's Institutional Dashboard already does for Engine 2 signals) is a very different, much lower-risk scope than one that tries to compute a真 blended net-worth figure across both.
3. **Cross-Engine AI Assistant Routing**: three separate, already-working coach panels exist today. Is a fourth, unifying "one chat box, auto-routed" surface actually wanted, or would it just add a redundant entry point alongside three that already work well (the same "don't build for a hypothetical" discipline this project has otherwise held)?
4. **Notification Delivery beyond in-app**: still blocked exactly like Sprint 62 — no real SMTP/push credentials or infrastructure exist in this session. Confirm this stays deferred (matching Sprint 56's own precedent), or is there a plan to obtain credentials?
5. **Testing & Security Audit checkpoint (Blueprint Phase 6)**: should this be scheduled now, given four phases of continuous-but-never-formally-audited testing, or does it make more sense after whichever of the above ships (so there's more surface to audit at once)?
6. **Housekeeping items** (`ravish-trading-engine.zip`, `artifacts/mockup-sandbox`): both flagged since the original Technical Audit, both cheap to resolve (archive/delete/document), both still genuinely awaiting an owner decision on disposition — not something to guess at.

**No code will be written under this plan until these are resolved and the resulting scope is presented back for final approval**, per the same process every phase in this project has followed.
