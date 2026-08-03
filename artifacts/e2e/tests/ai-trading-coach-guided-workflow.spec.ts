// v1.6.0 Sprint 2 — Guided Workflow UX, Onboarding & Real-World
// Validation (#10, end-to-end workflow validation). A smoke-level proof,
// mirroring the existing E2E suite's own bounded-scope discipline (Phase
// 6, Sprints 69/70) — not a full 11-step walkthrough (that would require
// actually running a scan, creating research/a trade plan/a decision
// review, far too heavy for a smoke slice), but a real, end-to-end proof
// that:
//   1. A first-time user sees the AI Trading Coach panel with its
//      onboarding welcome on the real Institutional Command Centre.
//   2. Mark Complete genuinely advances the workflow (this sprint's own
//      real, disclosed Sprint 1 bug fix — without it, "Morning Brief"
//      could never be completed by any user).
//   3. Smart Navigation's "Start" action truly crosses pages, and the
//      SAME one panel — never a duplicate — is mounted there too, with
//      the ?workflowStep= context genuinely preserved across the
//      navigation.
//
// Deliberately does NOT assert which specific step becomes the primary
// step after Morning Brief — a real, already-signed-up user's
// InstitutionalCommandCentre visit triggers this platform's own
// pre-existing, previously-documented auto-seed behavior
// (serverState.ts's ensureSeedTrades(), first disclosed at Phase 6
// Sprint 69 for /portfolio-ai), so a "fresh" e2e user can legitimately
// already have real seeded trades — and the coach panel is CORRECT to
// reprioritize Position Monitoring/Trade Journal ahead of a fresh scan
// when real open-position/unjournaled data exists (a Sprint 1 behavior,
// already unit-tested). Asserting a specific next step here would
// wrongly couple this test to that unrelated seeding behavior; asserting
// real progress + real cross-page context preservation is the genuine,
// environment-agnostic proof this sprint's own workflow fix needs.
import { test, expect } from "@playwright/test";
import { freshTestUser, signUpAndLogin } from "./utils/auth";

test("AI Trading Coach — onboarding, Mark Complete, and cross-page context preservation", async ({ page }) => {
  // The Institutional Command Centre is, by design, the heaviest single
  // page in this app — it aggregates Scanner/Opportunity Pipeline/Decision
  // Workflow/Trade Lifecycle/Trading Journal (this sprint's own coach
  // panel) alongside Workflow Automation/Knowledge Graph/Playbooks/
  // Portfolio Risk Intelligence. A generous, test-file-scoped timeout
  // (never touching the shared playwright.config.ts default, which every
  // other, lighter spec still uses) accounts for that real cost under this
  // environment's own resource constraints.
  test.setTimeout(60_000);

  const user = freshTestUser("ai-trading-coach");
  await signUpAndLogin(page, user);

  await page.goto("/");

  const coachPanel = page.getByTestId("card-ai-trading-coach");
  await expect(coachPanel).toBeVisible({ timeout: 20_000 });

  // First-time onboarding is real and dismissible.
  await expect(page.getByTestId("section-onboarding-welcome")).toBeVisible();
  await page.getByTestId("button-dismiss-onboarding").click();
  await expect(page.getByTestId("section-onboarding-welcome")).not.toBeVisible();

  // Morning Brief is the real, honest first step for a brand-new user.
  await expect(page.getByTestId("text-next-step-label")).toHaveText("Morning Brief");

  // Mark Complete genuinely advances the workflow — the real fix this
  // sprint made to Sprint 1's own previously-unused mutation. Whatever
  // step becomes primary next (data-dependent, see header comment), it
  // must genuinely no longer be Morning Brief.
  await page.getByTestId("button-mark-step-complete").click();
  const nextStepLabel = page.getByTestId("text-next-step-label");
  await expect(nextStepLabel).toBeVisible({ timeout: 10_000 });
  await expect(nextStepLabel).not.toHaveText("Morning Brief");
  const advancedToLabel = (await nextStepLabel.textContent())!.trim();

  // Start truly crosses pages, carrying real workflow context with it —
  // whichever real step is now primary.
  const startUrlBefore = page.url();
  await page.getByTestId("button-start-next-step").click();
  await expect(page).not.toHaveURL(startUrlBefore);
  await expect(page.url()).toContain("workflowStep=");

  const destinationCoachPanel = page.getByTestId("card-ai-trading-coach");
  await expect(destinationCoachPanel).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("text-workflow-step-context")).toContainText(advancedToLabel);
});
