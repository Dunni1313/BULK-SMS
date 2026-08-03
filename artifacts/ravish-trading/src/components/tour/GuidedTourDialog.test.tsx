// v1.6.0, Sprint 3 — UX Transformation. Component coverage for the
// Guided Tour dialog.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GuidedTourDialog } from "./GuidedTourDialog";
import { hasCompletedTour } from "@/lib/guided-tours";

describe("GuidedTourDialog", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the first step of the requested tour when opened", () => {
    render(<GuidedTourDialog tourId="first-trade" open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("guided-tour-step-title")).toHaveTextContent("1. Discover");
  });

  it("advances to the next step and back again", () => {
    render(<GuidedTourDialog tourId="first-trade" open={true} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByTestId("button-guided-tour-next"));
    expect(screen.getByTestId("guided-tour-step-title")).toHaveTextContent("2. Research");
    fireEvent.click(screen.getByTestId("button-guided-tour-back"));
    expect(screen.getByTestId("guided-tour-step-title")).toHaveTextContent("1. Discover");
  });

  it("never allows going before the first step", () => {
    render(<GuidedTourDialog tourId="first-trade" open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByTestId("button-guided-tour-back")).toBeDisabled();
  });

  it("shows a real link to a real route for steps that have one", () => {
    render(<GuidedTourDialog tourId="first-trade" open={true} onOpenChange={vi.fn()} />);
    const link = screen.getByTestId("guided-tour-step-link");
    expect(link).toHaveAttribute("href", "/scanner");
  });

  it("shows a Done button (not Next) only on the final step, and marks the tour completed", () => {
    const onOpenChange = vi.fn();
    render(<GuidedTourDialog tourId="first-research" open={true} onOpenChange={onOpenChange} />);
    // first-research has 3 steps
    fireEvent.click(screen.getByTestId("button-guided-tour-next"));
    fireEvent.click(screen.getByTestId("button-guided-tour-next"));
    expect(screen.queryByTestId("button-guided-tour-next")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-guided-tour-finish")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-guided-tour-finish"));
    expect(hasCompletedTour("first-research")).toBe(true);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Skip closes the dialog without marking the tour completed", () => {
    const onOpenChange = vi.fn();
    render(<GuidedTourDialog tourId="first-journal" open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByTestId("button-guided-tour-skip"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(hasCompletedTour("first-journal")).toBe(false);
  });
});
