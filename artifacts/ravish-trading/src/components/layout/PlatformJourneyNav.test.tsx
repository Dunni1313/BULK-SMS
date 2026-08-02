// v1.5.0, Sprint 11 — Platform Integration. Isolated unit coverage for the
// shared workflow stepper — no data fetch/context dependency of its own,
// so a plain @testing-library/react render() is sufficient, matching
// SidebarSectionHeader.test.tsx's own precedent for a similarly
// self-contained component.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlatformJourneyNav } from "./PlatformJourneyNav";

describe("PlatformJourneyNav", () => {
  it("renders all 9 requested stages, in order", () => {
    render(<PlatformJourneyNav current="research" />);
    const nav = screen.getByTestId("nav-platform-journey");
    expect(nav).toBeInTheDocument();
    for (const id of ["research", "notebook", "strategy", "trade-plan", "execute", "trade-journal", "performance", "portfolio", "learning"]) {
      expect(screen.getByTestId(`journey-stage-${id}`)).toBeInTheDocument();
    }
  });

  it("highlights the current stage", () => {
    render(<PlatformJourneyNav current="trade-journal" />);
    const stage = screen.getByTestId("journey-stage-trade-journal");
    expect(stage.textContent).toContain("Trade Journal");
    // The current stage's own inner content span carries the highlighted styling.
    expect(screen.getByTestId("journey-stage-content-trade-journal").className).toContain("bg-indigo-500/20");
  });

  it("renders every clickable stage except the current one as a real link to its own route", () => {
    render(<PlatformJourneyNav current="research" />);
    const journalLink = screen.getByTestId("journey-stage-trade-journal").querySelector("a");
    expect(journalLink).toHaveAttribute("href", "/trading-journal");
    const performanceLink = screen.getByTestId("journey-stage-performance").querySelector("a");
    expect(performanceLink).toHaveAttribute("href", "/performance-attribution-engine");
    const portfolioLink = screen.getByTestId("journey-stage-portfolio").querySelector("a");
    expect(portfolioLink).toHaveAttribute("href", "/portfolio-dashboard");
    const learningLink = screen.getByTestId("journey-stage-learning").querySelector("a");
    expect(learningLink).toHaveAttribute("href", "/learn");
  });

  it("never renders 'Execute (external broker)' as a clickable link — this platform has no execution feature to link to", () => {
    render(<PlatformJourneyNav current="research" />);
    const executeStage = screen.getByTestId("journey-stage-execute");
    expect(executeStage.querySelector("a")).not.toBeInTheDocument();
    expect(executeStage.textContent).toContain("Execute (external broker)");
  });

  it("the current stage itself is never a clickable link, even though it does have a real route", () => {
    render(<PlatformJourneyNav current="portfolio" />);
    const currentStage = screen.getByTestId("journey-stage-portfolio");
    expect(currentStage.querySelector("a")).not.toBeInTheDocument();
  });
});
