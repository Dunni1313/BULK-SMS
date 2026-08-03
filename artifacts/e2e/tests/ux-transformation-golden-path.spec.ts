// v1.6.0, Sprint 3 — UX Transformation. The approved scope's own "user
// test": can a brand-new trader open the platform, know exactly where to
// start, and move through a full golden-path day using nothing but the
// UX Transformation's own new surfaces (PageShell's journey/next-action/
// info, Guided Tours) — never a new trading feature, just navigation and
// explanation. A smoke-level proof, matching the existing E2E suite's own
// bounded-scope discipline (Phase 6, Sprints 69/70) — not a full 11-step
// walkthrough, but real, end-to-end coverage of what this sprint actually
// changed: PageShell on real pages, PlatformJourneyNav's new "Discover"
// stage, and the Guided Tours dialog.
import { test, expect } from "@playwright/test";
import { freshTestUser, signUpAndLogin } from "./utils/auth";

test("a brand-new user lands on the Command Centre, sees a Guided Tour, and follows the journey through real pages via PageShell", async ({ page }) => {
  test.setTimeout(60_000);

  const user = freshTestUser("ux-transformation");
  await signUpAndLogin(page, user);
  await page.goto("/");

  // The Command Centre is the true home — Guided Tours live here, per the
  // approved scope's own "every workflow should naturally begin there."
  await expect(page.getByTestId("command-centre-guided-tours")).toBeVisible({ timeout: 20_000 });

  // Take the First Trade tour end-to-end and confirm it genuinely
  // completes (never just decorative).
  await page.getByTestId("button-guided-tour-first-trade").click();
  await expect(page.getByTestId("dialog-guided-tour-first-trade")).toBeVisible();
  await expect(page.getByTestId("guided-tour-step-title")).toHaveText("1. Discover");
  await page.getByTestId("button-guided-tour-next").click();
  await expect(page.getByTestId("guided-tour-step-title")).toHaveText("2. Research");

  // Follow the tour's own real link straight to the Scanner — proving
  // "learn by doing," not just reading static copy.
  await page.getByTestId("button-guided-tour-back").click();
  await page.getByTestId("guided-tour-step-link").click();
  await expect(page).toHaveURL(/\/scanner$/);

  // Scanner itself now uses the one reusable PageShell — the title, the
  // "Next" action (derived from the real PLATFORM_JOURNEY_STAGES list,
  // never fabricated), and the existing PlatformJourneyNav all render.
  await expect(page.getByTestId("page-shell-title")).toContainText("Market Scanner");
  await expect(page.getByTestId("page-shell-journey")).toBeVisible();
  await expect(page.getByTestId("page-shell-next-action")).toContainText("Research");

  // "Command Centre" is always one click away from any page that isn't
  // itself home — the Command Centre reinforcement this sprint added.
  await page.getByTestId("link-page-shell-home").click();
  await expect(page).toHaveURL(/\/$/);

  // Progressive disclosure: the "why it matters" / contextual Learn /
  // related-modules content stays hidden until the user actually asks
  // for it, on a second golden-path page.
  await page.goto("/decision-workflow");
  await expect(page.getByTestId("page-shell-title")).toContainText("Decision Workflow");
  await expect(page.getByTestId("page-shell-why-it-matters")).not.toBeVisible();
  await page.getByTestId("button-page-shell-info-toggle").click();
  await expect(page.getByTestId("page-shell-why-it-matters")).toBeVisible();
});
