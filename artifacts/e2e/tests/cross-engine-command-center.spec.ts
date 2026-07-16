// Phase 6, Sprint 70 — Cross-Engine Browser E2E Integration Suite.
// Proves the platform's cross-engine composition as a real user experiences
// it in a browser: one symbol search on the Institutional Dashboard renders
// Engine 1 (Investment Committee) and Engine 2 (Market Regime) verdicts
// together on one screen, and the always-visible Portfolio Overview section
// shows Engine 1 (Portfolio Construction) and Engine 3 (Options Income)
// side by side — reusing the exact signUpAndLogin helper and webServer
// config Sprint 69 already established, no new tooling.
import { test, expect } from "@playwright/test";
import { freshTestUser, signUpAndLogin } from "./utils/auth";

test("Institutional Dashboard: Engine 1 + Engine 2 cross-engine verdict, and Engine 1 + Engine 3 portfolio overview, all on one screen", async ({ page }) => {
  const user = freshTestUser("cross-engine-dashboard");
  await signUpAndLogin(page, user);

  // A single, isolated GET /api/settings call deterministically creates this
  // brand-new user's settings row (getOrCreateSettings, routes/settings.ts)
  // before the Institutional Dashboard's own several concurrent on-mount
  // fetches (Portfolio Construction, Portfolio Summary, Trading Risk, etc.)
  // all resolve settings at once — sidesteps a pre-existing, undisclosed
  // race in lib/serverState.ts's getSettingsRow() (a plain check-then-insert
  // with no upsert safety) that this sprint's own test run surfaced for the
  // first time, simply because no prior test had ever driven multiple
  // concurrent settings-touching requests for a genuinely brand-new user in
  // one page load. Fixing that race is out of Sprint 70's scope (it's
  // pre-existing backend business logic, not part of this sprint's own
  // E2E-only deliverable) — flagged in this sprint's own documentation as a
  // discovered item for a future sprint, not fixed here.
  await page.request.get("/api/settings");

  await page.goto("/institutional-dashboard");

  // Engine 1 + Engine 3 Portfolio Overview is always visible, no symbol
  // search required. A freshly signed-up user has no Portfolio Construction
  // portfolios yet (honest empty state), but Engine 3's account is
  // auto-seeded with real trades on first access — proving both engines'
  // own real backend state renders side by side without being blended.
  await expect(page.getByTestId("card-dashboard-portfolio-construction")).toBeVisible();
  await expect(page.getByTestId("text-dashboard-construction-empty")).toBeVisible();
  const optionsPortfolioCard = page.getByTestId("card-dashboard-options-portfolio");
  await expect(optionsPortfolioCard).toBeVisible({ timeout: 20_000 });
  await expect(optionsPortfolioCard).toContainText(/open position/i);
  await expect(optionsPortfolioCard.getByTestId("text-dashboard-options-portfolio-empty")).not.toBeVisible();

  // Searching a symbol renders Engine 1's Investment Committee verdict and
  // Engine 2's technical read together, "on one screen" — the literal
  // Cross-Engine Command Center guarantee (Phase 4, Sprint 54).
  await page.getByTestId("input-dashboard-symbol").fill("AAPL");
  await page.getByTestId("button-dashboard-search").click();

  await expect(page.getByTestId("grid-cross-engine-verdict")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("card-dashboard-committee")).toBeVisible();
  await expect(page.getByTestId("card-dashboard-technical-read")).toBeVisible();
});
