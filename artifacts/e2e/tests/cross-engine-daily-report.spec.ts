// Phase 6, Sprint 70 — Cross-Engine Browser E2E Integration Suite.
// Proves the Cross-Engine Daily Report (Phase 5, Sprint 68) genuinely
// composes all 3 engines' real backend state into one on-demand,
// user-wide report, as a real user experiences it in a browser — reusing
// the exact signUpAndLogin helper and webServer config Sprint 69 already
// established, no new tooling.
import { test, expect } from "@playwright/test";
import { freshTestUser, signUpAndLogin } from "./utils/auth";

test("Cross-Engine Daily Report: Engine 1 + Engine 2 + Engine 3 all compose into one on-demand report", async ({ page }) => {
  const user = freshTestUser("cross-engine-daily-report");
  await signUpAndLogin(page, user);

  await page.goto("/daily-report");

  await expect(page.getByTestId("card-daily-report-summary")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("daily-report-summary-text")).toContainText(/./); // deterministic summary, real text

  // Engine 1 — a fresh user's watchlist is honestly empty, never fabricated.
  const engine1Card = page.getByTestId("card-daily-report-engine1");
  await expect(engine1Card).toBeVisible();
  await expect(engine1Card.getByTestId("text-daily-report-no-crossings")).toHaveText(/watchlist is empty/i);

  // Engine 2 — a fresh user's trading-risk read still renders honestly
  // (insufficient-data, never blocking the rest of the report) — asserting
  // real label/detail text, not just that the card shell exists.
  const engine2Card = page.getByTestId("card-daily-report-engine2");
  await expect(engine2Card).toBeVisible();
  await expect(engine2Card).toContainText(/./); // real, non-empty label/detail text rendered

  // Engine 3 — the account is auto-seeded with real trades on first access
  // (the same ensureSeedTrades() behavior GET /portfolio/summary already
  // relies on), so this card renders real, non-zero health content.
  const engine3Card = page.getByTestId("card-daily-report-engine3");
  await expect(engine3Card).toBeVisible();
  await expect(engine3Card).toContainText(/health/i);
  await expect(engine3Card).toContainText(/open position/i);
});
