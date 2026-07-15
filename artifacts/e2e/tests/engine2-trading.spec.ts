// Phase 6, Sprint 69 — first E2E smoke slice, Engine 2 (Trading).
// login -> search a symbol -> see a real, backend-rendered Market Structure
// analysis for that symbol.
import { test, expect } from "@playwright/test";
import { freshTestUser, signUpAndLogin } from "./utils/auth";

test("Engine 2 — Trading: sign up, log in, and view real Market Structure analysis for AAPL", async ({ page }) => {
  const user = freshTestUser("engine2");
  await signUpAndLogin(page, user);

  await page.goto("/trading-research");
  await page.getByTestId("input-trading-research-symbol").fill("AAPL");
  await page.getByTestId("button-trading-research-search").click();

  const structureCard = page.getByTestId("card-market-structure");
  await expect(structureCard).toBeVisible({ timeout: 20_000 });
  await expect(structureCard).toContainText("Market Structure — AAPL");
});
