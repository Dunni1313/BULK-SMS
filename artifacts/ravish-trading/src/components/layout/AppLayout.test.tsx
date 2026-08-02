// Phase 10 — Institutional Platform Polish & Control Center. Tests for
// AppLayout's own new Command Palette wiring: the visible search trigger
// button and the global ⌘K / Ctrl+K keyboard shortcut. Follows the same
// required-hook-mocking set App.test.tsx already established for
// rendering AppLayout for the first time (Sprint 53) — CommandPalette's
// own data hooks are all enabled-gated (fetch only while open), so they
// need no additional mocking here, matching that established pattern.
//
// v1.1.0 — Sidebar Navigation Redesign added a second describe block below
// covering the new grouped/collapsible/compact/pinned sidebar behavior.
// Active-route tests navigate the same way App.test.tsx's own Sprint 53
// tests do — window.history.pushState() before a fresh render, not a live
// re-render after mount — and every test starts from a clean localStorage
// so no test's saved sidebar preference leaks into another's.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useListTradeAdjustments: () => ({ data: [] }),
    useListNotifications: () => ({ data: [] }),
    useCheckNotifications: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateNotification: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock("@/lib/auth-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-client")>("@/lib/auth-client");
  return {
    ...actual,
    useSession: () => ({ data: null }),
  };
});

import { AppLayout } from "./AppLayout";

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState(null, "", "/");
});

describe("AppLayout — Command Palette wiring", () => {
  it("shows a visible search trigger with the platform-appropriate keyboard hint", () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    const button = screen.getByTestId("button-open-command-palette");
    expect(button).toBeInTheDocument();
    expect(button.textContent).toMatch(/⌘K|Ctrl\+K/);
  });

  it("clicking the search trigger opens the Command Palette", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.queryByTestId("command-palette-input")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-open-command-palette"));
    // The Command Palette is lazy-loaded (kept out of AppLayout's own
    // eagerly-loaded bundle chunk, see AppLayout.tsx's own header comment
    // on the lazy() import) — its first open resolves an async chunk load,
    // so this assertion waits rather than checking synchronously.
    await waitFor(() => expect(screen.getByTestId("command-palette-input")).toBeInTheDocument());
  });

  it("pressing Ctrl+K opens the Command Palette from anywhere on the page", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.queryByTestId("command-palette-input")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() => expect(screen.getByTestId("command-palette-input")).toBeInTheDocument());
  });

  it("pressing Ctrl+K again toggles the palette closed", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await waitFor(() => expect(screen.getByTestId("command-palette-input")).toBeInTheDocument());
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByTestId("command-palette-input")).not.toBeInTheDocument();
  });

  it("the sidebar links to both Personal Dashboard and the Options Command Center at their own distinct routes", () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    // v1.5.0, Sprint 12 — Institutional Command Centre. "Institutional
    // Home" was relocated (relabeled "Personal Dashboard") to
    // "/personal-dashboard" when the new Institutional Command Centre
    // took over "/" — see nav-items.ts's own header comment.
    expect(screen.getByText("Personal Dashboard").closest("a")).toHaveAttribute("href", "/personal-dashboard");
    // Options Command Center is both a default "Frequently Used" pin's
    // sibling and the Home group's own canonical item (v1.1.0 sidebar
    // redesign) — both are real, intentional links to the same route, so
    // this queries by data-testid rather than text to avoid the
    // deliberate duplicate.
    expect(screen.getByTestId("sidebar-link-/command-center")).toHaveAttribute("href", "/command-center");
    expect(screen.getByText("Notifications").closest("a")).toHaveAttribute("href", "/notifications");
  });
});

describe("AppLayout — sidebar navigation redesign (v1.1.0)", () => {
  it("expands Home and Options Trading by default, leaving other groups collapsed", () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    // Home (defaultExpanded) and Options Trading (defaultExpanded).
    expect(screen.getByTestId("sidebar-link-/")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-link-/trades")).toBeInTheDocument();
    // Trading Workbench is not defaultExpanded and nothing makes it the
    // active group on "/", so its items are not in the DOM yet.
    expect(screen.queryByTestId("sidebar-link-/trading-journal")).not.toBeInTheDocument();
  });

  it("clicking a collapsed group's header expands it, revealing its items", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.queryByTestId("sidebar-link-/trading-journal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sidebar-group-trigger-trading-workbench"));
    await waitFor(() => expect(screen.getByTestId("sidebar-link-/trading-journal")).toBeInTheDocument());
  });

  it("clicking an expanded group's header collapses it again", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.getByTestId("sidebar-link-/trades")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sidebar-group-trigger-options-trading"));
    await waitFor(() => expect(screen.queryByTestId("sidebar-link-/trades")).not.toBeInTheDocument());
  });

  it("automatically expands the active route's parent group even though it isn't expanded by default", () => {
    window.history.pushState(null, "", "/trading-journal");
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    // Trading Workbench is collapsed by default, but /trading-journal is
    // its own active route, so its section must already be open.
    expect(screen.getByTestId("sidebar-link-/trading-journal")).toBeInTheDocument();
  });

  it("toggling compact mode hides group labels while every link stays reachable", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.getByText("Options Trading")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-toggle-compact-sidebar"));
    await waitFor(() => expect(screen.queryByText("Options Trading")).not.toBeInTheDocument());
    // Compact mode hides group chrome, not the links themselves.
    expect(screen.getByTestId("sidebar-link-/trades")).toBeInTheDocument();
  });

  it("pinning a non-pinned item adds it to Frequently Used; unpinning removes it again", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.queryByTestId("sidebar-pinned-link-/trades")).not.toBeInTheDocument();
    // The 6 suggested defaults already fill the max-pinned cap (6), so a
    // fresh user must free a slot before pinning a 7th route — the same
    // "up to six pinned routes" cap the redesign spec itself names.
    // Unpin one default first to make room, matching that real constraint.
    fireEvent.click(screen.getByTestId("sidebar-pin-remove-/settings"));
    await waitFor(() => expect(screen.queryByTestId("sidebar-pinned-link-/settings")).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId("sidebar-pin-toggle-/trades"));
    await waitFor(() => expect(screen.getByTestId("sidebar-pinned-link-/trades")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("sidebar-pin-remove-/trades"));
    await waitFor(() => expect(screen.queryByTestId("sidebar-pinned-link-/trades")).not.toBeInTheDocument());
  });

  it("never exceeds the 6-pin cap — pinning a 7th item while all 6 slots are full is a no-op", () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    // All 6 default slots are already full; /trades is not among them.
    fireEvent.click(screen.getByTestId("sidebar-pin-toggle-/trades"));
    expect(screen.queryByTestId("sidebar-pinned-link-/trades")).not.toBeInTheDocument();
  });

  it("reordering a pinned item moves it in the Frequently Used list", async () => {
    const { container } = renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    const pinnedHrefs = () =>
      Array.from(container.querySelectorAll('[data-testid^="sidebar-pinned-link-"]')).map((el) =>
        el.getAttribute("data-testid"),
      );
    const before = pinnedHrefs();
    // v1.5.0, Sprint 12 — Institutional Command Centre took over "/" as
    // the redesign's own first default pin (DEFAULT_PINNED_HREFS).
    expect(before[0]).toBe("sidebar-pinned-link-/");
    fireEvent.click(screen.getByTestId("sidebar-pin-move-down-/"));
    await waitFor(() => expect(pinnedHrefs()[0]).not.toBe("sidebar-pinned-link-/"));
    expect(pinnedHrefs()[1]).toBe("sidebar-pinned-link-/");
  });

  it("persists sidebar preferences under the documented localStorage key", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    fireEvent.click(screen.getByTestId("button-toggle-compact-sidebar"));
    await waitFor(() => {
      const raw = window.localStorage.getItem("dk-sidebar-navigation-state");
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!).compact).toBe(true);
    });
  });

  it("shows an unpin action (not a pin action) for an item that is already pinned", () => {
    // Administration (which owns /settings) isn't expanded by default, so
    // navigate there first to auto-expand it and reach its own list row
    // (distinct from the separate Frequently Used pinned row for the same
    // route).
    window.history.pushState(null, "", "/settings");
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    // Settings is one of the redesign's own suggested default pins.
    const settingsRow = screen.getByTestId("sidebar-link-/settings").closest("li")!;
    expect(within(settingsRow).getByTestId("sidebar-pin-toggle-/settings")).toHaveAttribute(
      "aria-label",
      "Unpin Settings",
    );
  });
});

describe("AppLayout — sidebar accessibility (v1.3.2, Version 1 Polish Sprint)", () => {
  it("exposes the sidebar as a navigation landmark with an accessible name", () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
  });

  it("marks the active route's sidebar link with aria-current=\"page\"", () => {
    // beforeEach already navigates to "/" (Institutional Command Centre,
    // v1.5.0 Sprint 12).
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.getByTestId("sidebar-link-/")).toHaveAttribute("aria-current", "page");
  });

  it("does not mark an inactive route's sidebar link with aria-current", () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.getByTestId("sidebar-link-/trades")).not.toHaveAttribute("aria-current");
  });

  it("moves aria-current to whichever link matches the current route", () => {
    window.history.pushState(null, "", "/trades");
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.getByTestId("sidebar-link-/trades")).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("sidebar-link-/")).not.toHaveAttribute("aria-current");
  });

  it("also marks a Frequently Used pinned link's aria-current when it matches the active route", () => {
    // Scanner is one of the redesign's own suggested default pins
    // (DEFAULT_PINNED_HREFS), distinct from the "/" case already covered
    // by the test above (which is now pinned too, v1.5.0 Sprint 12), so
    // it renders both as a group item and as a Frequently Used pin.
    window.history.pushState(null, "", "/scanner");
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.getByTestId("sidebar-pinned-link-/scanner")).toHaveAttribute("aria-current", "page");
  });

  it("preserves every pre-existing sidebar behaviour alongside the new accessibility attributes", async () => {
    // A compact regression check that the a11y additions are additive only:
    // group expand/collapse, pin/unpin, and compact mode all still work
    // exactly as the v1.1.0 suite above already proves in full detail.
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.queryByTestId("sidebar-link-/trading-journal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sidebar-group-trigger-trading-workbench"));
    await waitFor(() => expect(screen.getByTestId("sidebar-link-/trading-journal")).toBeInTheDocument());
  });
});

describe("AppLayout — sidebar section headers (v1.3.1)", () => {
  it("renders each group's header as a full-width coloured bar with its own theme, per the requested colour mapping", () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    // Options Trading and Options Income Engine — green.
    expect(screen.getByTestId("sidebar-group-trigger-options-trading").className).toContain(
      "bg-sidebar-section-options",
    );
    expect(screen.getByTestId("sidebar-group-trigger-options-income-engine").className).toContain(
      "bg-sidebar-section-options",
    );
    // Portfolio Management — blue.
    expect(screen.getByTestId("sidebar-group-trigger-portfolio-management").className).toContain(
      "bg-sidebar-section-portfolio",
    );
    // Institutional Investing and Value Investing — purple.
    expect(screen.getByTestId("sidebar-group-trigger-institutional-investing").className).toContain(
      "bg-sidebar-section-investing",
    );
    expect(screen.getByTestId("sidebar-group-trigger-value-investing").className).toContain(
      "bg-sidebar-section-investing",
    );
    // Trading Workbench (Institutional Trading Engine) — its own distinct colour.
    expect(screen.getByTestId("sidebar-group-trigger-trading-workbench").className).toContain(
      "bg-sidebar-section-trading",
    );
    // Administration — neutral.
    expect(screen.getByTestId("sidebar-group-trigger-administration").className).toContain(
      "bg-sidebar-section-neutral",
    );
    // Every header bar spans the sidebar's full available width (the
    // negative-margin bleed technique, not an explicit width utility).
    expect(screen.getByTestId("sidebar-group-trigger-options-trading").className).toContain("-mx-2");
    // Bold, uppercase text, rounded corners within the requested 8-12px range.
    expect(screen.getByTestId("sidebar-group-trigger-options-trading").className).toMatch(/font-bold/);
    expect(screen.getByTestId("sidebar-group-trigger-options-trading").className).toMatch(/uppercase/);
    expect(screen.getByTestId("sidebar-group-trigger-options-trading").className).toMatch(/rounded-\[1?0px\]/);
  });

  it("gives the static Frequently Used header the neutral theme, matching its non-interactive, non-collapsible nature", () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    const pinnedHeader = screen.getByTestId("sidebar-group-header-pinned");
    expect(pinnedHeader.className).toContain("bg-sidebar-section-neutral");
    // Non-interactive: no aria-expanded, not a button.
    expect(pinnedHeader.tagName).toBe("DIV");
    expect(pinnedHeader).not.toHaveAttribute("aria-expanded");
  });

  it("reflects each collapsible group's own expand/collapse state via aria-expanded on its coloured header", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    const tradingHeader = screen.getByTestId("sidebar-group-trigger-trading-workbench");
    expect(tradingHeader).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(tradingHeader);
    await waitFor(() => expect(tradingHeader).toHaveAttribute("aria-expanded", "true"));
    fireEvent.click(tradingHeader);
    await waitFor(() => expect(tradingHeader).toHaveAttribute("aria-expanded", "false"));
  });

  it("shows the active route's parent group's coloured header already expanded (aria-expanded=true)", () => {
    window.history.pushState(null, "", "/trading-journal");
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.getByTestId("sidebar-group-trigger-trading-workbench")).toHaveAttribute("aria-expanded", "true");
  });

  it("hides every coloured section header in compact (icon-only) mode while its own child links stay reachable", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.getByTestId("sidebar-group-trigger-options-trading")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-toggle-compact-sidebar"));
    await waitFor(() =>
      expect(screen.queryByTestId("sidebar-group-trigger-options-trading")).not.toBeInTheDocument(),
    );
    // Compact mode hides group header chrome, not the links themselves.
    expect(screen.getByTestId("sidebar-link-/trades")).toBeInTheDocument();
  });

  it("gives every group's header an accessible name combining its icon-adjacent label, reachable via role=button", () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.getByRole("button", { name: "Options Trading" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Portfolio Management" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Institutional Investing" })).toBeInTheDocument();
  });
});

describe("AppLayout — AI Trading Assistant launcher and sidebar navigation (v1.3.1, renamed from \"AI Trading Coach\" in v1.5.0 Sprint 1)", () => {
  it("shows a clear, accessible header launcher for the AI Trading Assistant", () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    const launcher = screen.getByTestId("button-trading-coach-launcher");
    expect(launcher).toBeInTheDocument();
    expect(launcher).toHaveAccessibleName("Open AI Trading Assistant");
  });

  it("keeps the launcher reachable in both expanded and collapsed (compact) sidebar modes", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.getByTestId("button-trading-coach-launcher")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-toggle-compact-sidebar"));
    await waitFor(() =>
      expect(screen.queryByTestId("sidebar-group-trigger-options-trading")).not.toBeInTheDocument(),
    );
    // The launcher lives in the header, not the sidebar, so compact mode
    // never affects it — it's still reachable exactly as before.
    expect(screen.getByTestId("button-trading-coach-launcher")).toBeInTheDocument();
  });

  it("reaches the AI Trading Coach sidebar-nav entry once its (non-default-expanded) group is opened", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.queryByTestId("sidebar-link-/ai-trading-coach")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("sidebar-group-trigger-ai-decision-tools"));
    await waitFor(() => expect(screen.getByTestId("sidebar-link-/ai-trading-coach")).toBeInTheDocument());
    expect(screen.getByTestId("sidebar-link-/ai-trading-coach")).toHaveAttribute("href", "/ai-trading-coach");
  });

  it("keeps the AI Trading Coach sidebar-nav entry reachable in compact (icon-only) mode too", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    fireEvent.click(screen.getByTestId("button-toggle-compact-sidebar"));
    await waitFor(() => expect(screen.getByTestId("sidebar-link-/ai-trading-coach")).toBeInTheDocument());
  });
});
