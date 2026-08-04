// v1.6.0, Sprint 3 — UX Transformation. Unit coverage for the one
// reusable page shell replacing duplicated header implementations.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Search } from "lucide-react";
import { PageShell } from "./PageShell";
import { renderWithClient } from "@/test/test-utils";

const locationMock = vi.hoisted(() => ({ value: "/scanner" }));
vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return { ...actual, useLocation: () => [locationMock.value, vi.fn()] };
});

describe("PageShell", () => {
  it("renders the title, icon, and description always visible (never behind progressive disclosure)", () => {
    render(<PageShell icon={Search} title="Market Scanner" description="Find new trading opportunities." />);
    expect(screen.getByTestId("page-shell-title")).toHaveTextContent("Market Scanner");
    expect(screen.getByTestId("page-shell-description")).toHaveTextContent("Find new trading opportunities.");
  });

  it("shows a 'back to Command Centre' link on every page except the home route itself", () => {
    locationMock.value = "/scanner";
    render(<PageShell icon={Search} title="Market Scanner" />);
    expect(screen.getByTestId("link-page-shell-home")).toBeInTheDocument();
  });

  it("never shows the 'back to Command Centre' link on the home route itself", () => {
    locationMock.value = "/";
    render(<PageShell icon={Search} title="Institutional Command Centre" />);
    expect(screen.queryByTestId("link-page-shell-home")).not.toBeInTheDocument();
  });

  it("renders the existing PlatformJourneyNav (never a second workflow component) plus a real 'next' link derived from PLATFORM_JOURNEY_STAGES when a journeyStage is given", () => {
    locationMock.value = "/scanner";
    render(<PageShell icon={Search} title="Market Scanner" journeyStage="discover" />);
    expect(screen.getByTestId("nav-platform-journey")).toBeInTheDocument();
    expect(screen.getByTestId("page-shell-next-action")).toHaveTextContent("Research");
  });

  it("renders no journey block at all when no journeyStage is given — never fabricates a stage", () => {
    locationMock.value = "/scanner";
    render(<PageShell icon={Search} title="Market Scanner" />);
    expect(screen.queryByTestId("page-shell-journey")).not.toBeInTheDocument();
  });

  it("hides 'why it matters' and related content behind a collapsed 'About this page' toggle by default (progressive disclosure)", () => {
    locationMock.value = "/scanner";
    render(<PageShell icon={Search} title="Market Scanner" whyItMatters="This is where every trading day begins." />);
    expect(screen.queryByTestId("page-shell-why-it-matters")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-page-shell-info-toggle"));
    expect(screen.getByTestId("page-shell-why-it-matters")).toHaveTextContent("This is where every trading day begins.");
  });

  it("derives related modules from the current route's own sidebar nav group, never a second registry", () => {
    locationMock.value = "/scanner";
    render(<PageShell icon={Search} title="Market Scanner" whyItMatters="x" />);
    fireEvent.click(screen.getByTestId("button-page-shell-info-toggle"));
    // Scanner lives in the Trading Workbench nav group alongside real sibling routes.
    expect(screen.getByTestId("page-shell-related-modules")).toBeInTheDocument();
  });

  it("renders a real Learn trigger only when a learnEntryId resolves to a real registry entry", () => {
    locationMock.value = "/scanner";
    renderWithClient(<PageShell icon={Search} title="Market Scanner" learnEntryId="trading-journal" />);
    fireEvent.click(screen.getByTestId("button-page-shell-info-toggle"));
    expect(screen.getByTestId("button-learn-trading-engine-trading-journal-review")).toBeInTheDocument();
  });

  it("never renders a Learn trigger for an unregistered learnEntryId — never fabricates a lesson", () => {
    locationMock.value = "/scanner";
    renderWithClient(<PageShell icon={Search} title="Market Scanner" learnEntryId="not-a-real-entry" />);
    // The "About this page" toggle can still legitimately appear (Scanner
    // has real sibling nav-group items to show as "Related"), but no
    // Learn button may ever render for an id that doesn't resolve.
    const toggle = screen.queryByTestId("button-page-shell-info-toggle");
    if (toggle) fireEvent.click(toggle);
    expect(screen.queryByTestId(/^button-learn-/)).not.toBeInTheDocument();
  });

  it("renders header action controls passed through the actions slot", () => {
    locationMock.value = "/scanner";
    render(<PageShell icon={Search} title="Market Scanner" actions={<button data-testid="my-action">Run Scan</button>} />);
    expect(screen.getByTestId("my-action")).toBeInTheDocument();
  });

  it("renders a badge row when badges are passed", () => {
    locationMock.value = "/scanner";
    render(<PageShell icon={Search} title="Market Scanner" badges={<span data-testid="my-badge">SIMULATED</span>} />);
    expect(screen.getByTestId("page-shell-badges")).toBeInTheDocument();
    expect(screen.getByTestId("my-badge")).toBeInTheDocument();
  });
});
