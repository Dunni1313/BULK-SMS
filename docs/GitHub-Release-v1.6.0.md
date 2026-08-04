# GitHub Release — v1.6.0 (prepared, not yet published)

**Status:** The annotated tag `v1.6.0` was created locally against commit
`2c1c06cfe9784e337ae582fbbf00d711ab604537` (the PR #47 merge commit on
`main`), but could not be pushed to `origin` — this session's git proxy
returned `HTTP 403` on two consecutive attempts (`git push origin
v1.6.0`), and no tag/release-creation tool is available in this
session's GitHub MCP toolset (only read tools exist: `get_tag`,
`get_release_by_tag`, `list_tags`, `list_releases`,
`get_latest_release`). This is the same limitation already documented
for the `v1.0.0` release. **A human with real push access must run the
two manual steps below.**

## Manual steps required

1. **Push the tag** (already created in this session's local clone —
   if working from a fresh clone instead, first run
   `git tag -a v1.6.0 2c1c06cfe9784e337ae582fbbf00d711ab604537 -m "Version 1.6.0 ..."`
   using the tag message below):
   ```
   git push origin v1.6.0
   ```
2. **Publish the GitHub Release** from that tag using the title and body
   below (via the GitHub web UI's "Draft a new release" flow, or
   `gh release create v1.6.0 --title "..." --notes-file docs/GitHub-Release-v1.6.0.md`
   using this file's "Release body" section only).

## Tag

- **Tag name:** `v1.6.0`
- **Commit:** `2c1c06cfe9784e337ae582fbbf00d711ab604537`
- **Tag message:**
  ```
  Version 1.6.0

  AI Trading Coach
  Guided Workflow
  UX Transformation
  UX Polish Phase 1
  Beta Certified
  ```

## Release title

```
Version 1.6.0 — Beta Certified
```

## Release body

```markdown
## Major Highlights

- **AI Trading Coach** — deterministic, checklist-driven trading
  guidance (`AiTradingCoachPanel`), collapsed by default in this
  release so it no longer dominates the page. See
  `docs/v1.6.0-Sprint-01-AI-Trading-Coach-Guided-Workflow.md`.
- **Guided Workflow** — onboarding tours (First Trade, First Research,
  First Journal, First Portfolio Review) built on existing UI
  primitives, mounted on the Command Centre. See
  `docs/v1.6.0-Sprint-02-Guided-Workflow-UX-Onboarding.md`.
- **UX Transformation** — a new reusable `PageShell` (title,
  description, journey step, next action, related modules, contextual
  help) replacing duplicated header implementations across the golden
  path, plus an expanded `PlatformJourneyNav`. See
  `docs/v1.6.0-Sprint-03-UX-Transformation.md`.
- **UX Polish (Phase 1)** — AI Trading Coach checklist collapse,
  Execution & Lifecycle Manager vs. Trade Execution Center
  disambiguation, a real fix for Trading Research showing "Sign in"
  while authenticated, sidebar tooltip clarity, and plain-English
  wording passes. See `docs/v1.6.0-UX-Polish-Phase-1.md`.
- **Product Experience improvements** — findings and rationale from a
  full product experience review, prioritised and partly implemented
  this release. See `docs/v1.6.0-Product-Experience-Review.md`.
- **Navigation improvements** — journey-stage expansion, sidebar
  tooltips, and cross-page linking between related but distinct
  systems (Execution & Lifecycle Manager / Trade Execution Center;
  the two Trade Plan systems).
- **Beta documentation** — a full beta programme kit: Release Notes,
  Testing Guide, Feedback Questions, Success Metrics, Issue Triage, and
  Operations Guide.
- **Repository stabilisation** — protected trading/execution files
  (`execution.ts`, `optionsMath.ts`, `risk.ts`, `autoExecution.ts`,
  `autoAdjustment.ts`) remain zero-line diff across this entire release
  cycle.

## Validation Summary

- **TypeScript** — clean across all workspace projects.
- **Backend** — 258/258 test files, 3,181/3,181 tests passing (run
  twice for stability, both fully clean).
- **Frontend** — 188/188 test files, 2,399/2,399 tests passing.
- **E2E** — Playwright `e2e` CI job passed on both merged PRs (#46, #47).
- **Production build** — succeeds (exit 0), both packages.

## Known Limitations

See `docs/v1.6.0-Known-Limitations.md` for the full, current list of
intentionally-unfinished items, deferred work, and what beta feedback
is actually useful for right now — not duplicated here to avoid the two
copies drifting out of sync.
```
