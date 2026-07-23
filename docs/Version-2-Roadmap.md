# Version 2 — Roadmap Recommendations

**Planning only. Nothing in this document has been implemented.** This is
a set of recommendations for scope, sequencing, and known dependencies for
each named area, written against the actual v1.0.0 codebase (not
speculative) so that whichever items are approved can move directly into
an execution-plan document, following this project's own established
per-phase/per-sprint planning discipline (`CLAUDE.md` §2–3).

## 1. Broker integrations

**Current state**: Alpaca is the only integrated broker (paper trading;
order preview, position reconciliation, portfolio dashboard all built on
it in Engine 3). No other broker is wired in.

**Recommendation**: Generalize the existing `BrokerProvider`-shaped seam
(if one doesn't already exist as a formal interface, extract one from
`execution.ts`'s Alpaca-specific calls — this itself would need the
highest-scrutiny review, since it touches protected files) before adding a
second broker, rather than hand-rolling a second, parallel integration.
Prioritize based on real user demand (which broker do actual users hold
accounts at) rather than technical convenience. **Depends on**: a
decision on whether Version 2 targets live trading at all, or continues
Version 1's paper-trading-only scope.

## 2. Live market data

**Current state**: Engine 1 (`fundamentals.ts`) supports FMP and Alpha
Vantage as live providers; Engine 2 (`tradingMarketData.ts`) has its own
live-provider seam. **Both are wired and tested against mocked responses
but have never been verified against a real, live API call** — no
credentials have ever been available in this build environment (disclosed
at every relevant sprint since Phase 2, Sprint 11).

**Recommendation**: This is the **highest-leverage, lowest-implementation-
risk Version 2 item** — the code already exists and is already tested; it
needs credentials and a verification pass, not new engineering. Should be
the first Version 2 item scheduled once API keys are available, mirroring
the "Sprint 62" pattern already established in this project's own history
(a pure verification pass, no new logic).

## 3. Mobile application

**Current state**: none. The frontend is a React 19 + Vite web SPA with
no mobile-specific build target.

**Recommendation**: Before committing to a native app, evaluate whether a
responsive-web / PWA pass over the existing SPA meets the actual need —
given the platform's data density (dashboards, tables, charts), a true
native mobile experience would likely require redesigning most page
layouts rather than reusing existing components, making this one of the
largest-scope Version 2 items. Recommend scoping this as its own multi-
phase initiative, not a single sprint, and validating demand (which
workflows genuinely need mobile — likely portfolio monitoring and alerts,
not full research workflows) before committing to full native parity.

## 4. Team collaboration

**Current state**: none. The platform is single-user-per-account; there
is no concept of an organization, shared workspace, or multi-user
visibility into the same portfolio/research.

**Recommendation**: This is an architecturally significant addition —
every one of the ~30+ user-scoped tables assumes a 1:1 `user_id` ownership
model (tenant isolation is verified precisely on this assumption,
`lib/tenantIsolation.test.ts`). Introducing shared/team access would need
a deliberate new sharing/permission model layered on top, not a retrofit
of the existing ownership columns — likely its own foundational phase
(comparable in scope to Phase 1's original multi-tenancy work), with an
explicit owner decision on the sharing model (org-level accounts vs.
per-resource sharing grants) before any schema work begins.

## 5. Advanced notifications

**Current state**: in-app notification center only (Phase 6, Sprint 56),
covering watchlist target crossings and risk cap breaches, polled client-
side. No email or push channel exists.

**Recommendation**: The lowest-effort, most self-contained Version 2 item
— `lib/notifications.ts`'s existing alert-generation logic is already
channel-agnostic; adding email (e.g. via a transactional email provider)
or push would mean adding a new delivery adapter alongside the existing
in-app write, not redesigning detection. Needs a provider/credential
decision (which email service, whether push means a mobile app dependency
— see item 3) before implementation.

## 6. AI enhancements

**Current state**: 11 AI coach modules, an AI Investment Committee
synthesis layer, and the shared `ai-core` narration/disclaimer contract
already exist across all three engines.

**Recommendation**: Rather than adding a 12th standalone coach, the higher-
value Version 2 direction is likely **cross-engine AI synthesis** —
e.g. extending the existing Cross-Engine Daily Report or Command Center
with narrated (not just deterministic) cross-engine commentary, reusing
`ai-core`'s existing disclaimer-enforcement pattern rather than building a
new one. Any enhancement here must preserve CLAUDE.md's disclaimer-
invariant rule (route through `narrate()`/`narrateStream()`, never bypass
per-caller) — this is a hard constraint carried into Version 2, not just
Version 1.

## 7. Enterprise administration

**Current state**: a minimal admin role exists (`middlewares/requireAdmin.ts`,
gating the Operations Dashboard), granted only via manual database action
— there is no self-service admin UI, no org/tenant management, no
role hierarchy beyond a single boolean-like admin flag.

**Recommendation**: Scope depends heavily on item 4 (Team collaboration)
— "enterprise administration" without a team/org concept is really just
"a nicer admin panel for the existing single-admin-role model." If Team
Collaboration is approved for Version 2, sequence Enterprise
Administration after it, since a real admin console (user management,
audit log review, org-level settings) needs the org model to administer.

## 8. Performance optimisation

**Current state**: disclosed, not urgent — the frontend main bundle
chunk (559.61 kB) sits over Vite's 500 kB advisory threshold; no other
performance issue was found in RC1's or this release's own reviews.

**Recommendation**: A focused `manualChunks` / further code-splitting
pass, once there's enough real usage data (post-launch) to know which
routes are actually hit most often and would benefit most from being
split out of the shared vendor chunk — optimizing blind, pre-launch, risks
solving the wrong problem. Treat as a maintenance-style Version 2 item,
not a headline feature.

## 9. Future analytics

**Current state**: extensive already — Performance & Attribution,
Portfolio Risk Dashboard, Executive Intelligence, Industry Comparison,
Earnings Intelligence, and more already exist across all three engines.

**Recommendation**: Before adding new analytics, audit actual usage of
what already exists (which reports/dashboards are opened, which are
dormant) — this platform's own history shows a strong tendency to keep
building new analytical modules; the highest-value Version 2 analytics
work may be consolidating/improving discoverability of what's already
built (in the spirit of Phase 44's own Workflow Center) rather than adding
a 30th module. If new analytics are still wanted after that audit, backtest
attribution and multi-account/multi-portfolio roll-up reporting are the
two most-requested categories typical of platforms at this maturity level.

## Sequencing recommendation

If forced to rank, in order of (lowest risk + highest leverage) to
(highest risk + most foundational):

1. Live market data verification (item 2) — pure verification, zero new
   design.
2. Advanced notifications (item 5) — self-contained, additive.
3. Performance optimisation (item 8) — maintenance, low risk.
4. AI enhancements (item 6) — additive, within an existing safety pattern.
5. Broker integrations (item 1) — needs a live-trading scope decision
   first.
6. Future analytics (item 9) — needs a usage audit first.
7. Team collaboration (item 4) — foundational, needs an owner decision on
   the sharing model.
8. Enterprise administration (item 7) — depends on item 4.
9. Mobile application (item 3) — largest scope, needs a demand-validation
   step first.

None of these are committed — this ranking is a planning input for
whoever scopes Version 2's actual first sprint.
