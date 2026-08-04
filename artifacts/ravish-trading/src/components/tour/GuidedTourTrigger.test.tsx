// v1.6.0, Sprint 3 — UX Transformation. Component coverage for the
// reusable Guided Tour trigger button.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GuidedTourTrigger } from "./GuidedTourTrigger";
import { markTourCompleted } from "@/lib/guided-tours";

describe("GuidedTourTrigger", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows 'Take the tour' when the tour has never been completed", () => {
    render(<GuidedTourTrigger tourId="first-trade" />);
    expect(screen.getByTestId("button-guided-tour-first-trade")).toHaveTextContent("Take the tour");
  });

  it("shows 'Retake' once the tour has already been completed", () => {
    markTourCompleted("first-trade");
    render(<GuidedTourTrigger tourId="first-trade" />);
    expect(screen.getByTestId("button-guided-tour-first-trade")).toHaveTextContent("Retake");
  });

  it("opens the guided tour dialog when clicked", () => {
    render(<GuidedTourTrigger tourId="first-journal" />);
    expect(screen.queryByTestId("dialog-guided-tour-first-journal")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-guided-tour-first-journal"));
    expect(screen.getByTestId("dialog-guided-tour-first-journal")).toBeInTheDocument();
  });
});
