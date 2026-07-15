# Phase 5 — Final Execution Plan

**Status: FINALIZED.** All four flagged scope decisions have been resolved by the project owner (§2). Sprint 65 is scoped and proposed for approval (§3) but **has not been implemented** — no code has been written under this plan. Sprint numbering continues the project's single global counter: Phase 1 was Sprints 1–10, Phase 2 was Sprints 11–31, Phase 3 was Sprints 32–51, Phase 4 was Sprints 52–64 (12 shipped; Sprint 62 blocked, open). **Phase 5 begins at Sprint 65.**

**Prepared after:** Phase 4's close (`docs/Phase-4-Final-Completion-Report.md`), a fresh reconciliation of `docs/DK-AI-OS-Architecture-Blueprint.md`'s original 7-phase roadmap against what this repository's own phase-by-phase execution actually did (§0, unchanged from the draft), and the project owner's explicit resolution of the four scope decisions the draft surfaced (§2).

---

## 0. Reconciling the Blueprint's Original Roadmap With What Actually Shipped

The Blueprint (§5) laid out 7 phases: Foundation → Investing Engine → Trading Engine → **Options Income Engine (move + harden existing code)** → **Integration** → Testing → Production. This repository's actual execution diverged from that numbering starting at Phase 4 — a deliberate, disclosed choice each time, not drift:

- **Phase 1–3 matched the Blueprint exactly:** Foundation, Investing Engine, Trading Engine.
- **The executed "Phase 4"** (`docs/Phase-4-Master-Execution-Plan.md`, Sprints 52–64) was **not** the Blueprint's original Phase 4 ("Options Income Engine — move + harden"). It was a fresh architecture review's own construction: platform hardening, frontend performance, and — genuinely significant for this reconciliation — **it already delivered a meaningful slice of the Blueprint's original Phase 5 ("Integration")**: the Cross-Engine Command Center (Sprint 54), the Macro/Regime Side-by-Side View (Sprint 55), and Alerts & Notifications (Sprint 56, the platform's first push-based capability, satisfying part of the Blueprint's "Notification delivery" deliverable).

**Net effect: the Blueprint's original Phase 4 (Options Income move+harden) was never executed as its own phase, and Phase 5 (Integration) is now partially, not fully, satisfied.** Direct inspection at Phase 5-planning time confirmed what's actually still missing from each:

**From the Blueprint's original Phase 4 (Options Income Engine), still outstanding:**
- The "composable strategy builder" — confirmed by direct inspection of `optionsMath.ts`: today there are exactly 4 hand-built strategy functions (`buildIronCondor`, `buildIronFly`, a calendar-spread equivalent, `buildEarnings`, keyed by a `WIN_RATE_BASE` lookup of `iron_condor`/`iron_fly`/`calendar_spread`/`earnings`), not a generalized composable engine. This is squarely inside `optionsMath.ts`, a CLAUDE.md-protected file. **Resolved (§2, decision 1): deferred indefinitely.**
- Live-data end-to-end verification for the options engine's own providers remains unproven (distinct from, but analogous to, Sprint 62's still-blocked Engine 1 live-provider verification). **Remains an open candidate, unscheduled (§4).**
- The `trades` table was never migrated into a "shared Portfolio DB schema" — Phase 1 Sprint 4/7 added `userId` scoping to it in place, which satisfied the *multi-tenancy* half of "move to shared platform," but no cross-engine portfolio schema unification happened. Superseded by decision 2 below (side-by-side view only — no schema unification needed for that scope).

**From the Blueprint's original Phase 5 (Integration), still outstanding after Phase 4's partial delivery:**
- **Unified Portfolio Dashboard (stocks + options combined)** — does not exist. **Resolved (§2, decision 2): side-by-side view only, no blended net-worth computation.** Remains an open candidate for a future sprint, unscheduled (§4).
- **Cross-engine Reporting** — `dailyReport.ts` remains Engine-3-only. No decision has been made on this yet; remains an open candidate, unscheduled (§4).
- **Unified Settings UI** — `settings` is already one shared per-user table/route (`routes/settings.ts`, since Phase 1 Sprint 5), so the *data layer* is already unified; whether the `Settings.tsx` *page* should be reorganized is a smaller, optional UX question, not tracked as a Phase 5 deliverable unless separately raised.
- **Cross-engine AI Assistant routing** — does not exist. **Resolved (§2, decision 3): skip. The three existing specialized coach panels (Engine 1/2/3) stay as they are.**
- **Notification delivery beyond in-app** (email/push/webhook) — Sprint 56 shipped in-app only, by the project owner's own explicit choice at that sprint's kickoff (no real SMTP/push credentials or infrastructure existed in this session). **Unchanged, still blocked** — no new decision was needed since nothing about the underlying blocker (no credentials) has changed.

**Genuinely new since the Blueprint was written, not in its original 7-phase list at all, and not resolved by Phase 4:**
- Sprint 62 (Live FMP/Alpha Vantage Provider Verification) — still blocked on credentials. Unaffected by Phase 5.
- Two housekeeping items flagged since the original Technical Audit: `ravish-trading-engine.zip` (860KB, still at the repo root) and `artifacts/mockup-sandbox` (still present, still undecided). **In scope for Sprint 65 (§3) — investigation and a recommendation, not unilateral deletion, per CLAUDE.md rule 4.**
- Two items from CLAUDE.md §3's own outstanding-decisions list: `stock_analysis_history` per-user-vs-shared caching (item #3), the `OPENAI_API_KEY` deprecation window (item #7). **In scope for Sprint 65 (§3).**
- The Blueprint's own Phase 6 (Testing/Security Audit) — has never been run as its own dedicated phase. **Remains an open candidate, unscheduled (§4)** — the project owner did not select this as Sprint 65's priority, so it is deferred behind housekeeping, timing otherwise undecided.

---

## 1. Sequencing Rationale

No better sequencing than the draft's own candidate ordering was found during this finalization pass. The project owner's own choice — housekeeping and outstanding decisions first — matches the exact precedent Phase 4 itself set (Sprint 52, Platform Hardening, ran before any cross-engine feature work) and is the lowest-risk possible opening sprint for a new phase: every item in Sprint 65's scope is either read-only investigation, a documentation-level decision closure, or a small, additive, non-protected-file change — nothing in it touches execution logic, guardrails, or any money-moving path. This is consistent with, not a deviation from, the draft.

---

## 2. Owner Decisions — RESOLVED

| # | Decision | Resolution |
|---|---|---|
| 1 | Composable Strategy Builder (protected `optionsMath.ts`/`execution.ts`) | **Deferred indefinitely.** Not scheduled. Revisit only on a future explicit owner request, with the same maximum-scrutiny process CLAUDE.md rule 1 requires for any change to that code. |
| 2 | Unified Portfolio Dashboard (stocks + options) | **Side-by-side view only** — a page pairing Engine 1's Portfolio Construction and Engine 3's Portfolio/Portfolio AI views, no blended net-worth computation. Not yet scheduled to a specific sprint number; remains an open candidate (§4). |
| 3 | Cross-Engine AI Assistant Routing | **Skip.** The three existing specialized coach panels (options, investing, trading) stay exactly as they are; no fourth unifying chat surface will be built. |
| 4 | Sprint 65 priority | **Housekeeping + outstanding CLAUDE.md decisions first.** Scoped in §3 below. |

**No code will be written under decisions 1–3** (deferred/skipped). Decision 4 is what Sprint 65 (§3) implements, pending the project owner's separate, explicit approval of that specific sprint's proposal.

---

## 3. Sprint 65 — Phase 5 Housekeeping & Outstanding Decisions Closure (PROPOSED, awaiting approval)

See the standalone Sprint 65 Implementation Proposal delivered alongside this plan for the full objective/boundary/acceptance-criteria/risk breakdown. Summary: investigate and resolve, non-destructively, the four items CLAUDE.md and the original Technical Audit have carried open since Phase 1/pre-Phase-1 — `ravish-trading-engine.zip`, `artifacts/mockup-sandbox`, the `stock_analysis_history` per-user-vs-shared-cache decision, and the `OPENAI_API_KEY` deprecation window — closing each with either a safe code change or a documented decision, never a unilateral deletion of flagged legacy content.

---

## 4. Open Candidates — Unscheduled, No Sprint Number Yet

These remain genuine Phase 5 candidates per the Blueprint reconciliation (§0) but were not selected as Sprint 65's priority and have no committed sprint number. Each will need its own kickoff and explicit approval when the project owner chooses to schedule it, per the established per-sprint process:

- **Unified Portfolio Dashboard (side-by-side view only, per decision 2).**
- **Cross-Engine Daily Report** spanning all three engines (Blueprint Phase 5) — no decision made yet on whether this is wanted.
- **Options Income Engine — Live-Data End-to-End Verification** (Blueprint Phase 4) — conditional on live broker/data credentials, likely blocked the same way Sprint 62 is.
- **Testing & Security Audit checkpoint** (Blueprint Phase 6) — a dedicated cross-engine integration/security review. Deferred behind Sprint 65 by the project owner's own priority choice; exact timing otherwise undecided.
- **Notification Delivery — email/push channels** — remains blocked without real SMTP/push credentials or infrastructure, unchanged since Sprint 56.

**No code will be written for any item in this section** until it is separately scoped, presented, and explicitly approved.
