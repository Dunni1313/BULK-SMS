// v1.5.0 Sprint 2 — AI Coach Framework. Basic rendering/interaction
// coverage for the shared, generic suggestion-chip component.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CoachSuggestionChips } from "./CoachSuggestionChips";

describe("CoachSuggestionChips", () => {
  it("renders nothing when there are no suggestions", () => {
    const { container } = render(<CoachSuggestionChips suggestions={[]} onSelect={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a chip per suggestion using the default testId", () => {
    render(<CoachSuggestionChips suggestions={["Explain the Greeks", "Quiz me"]} onSelect={() => {}} />);
    expect(screen.getByTestId("coach-suggestion-chips")).toBeInTheDocument();
    expect(screen.getByTestId("coach-suggestion-chips-Explain the Greeks")).toBeInTheDocument();
    expect(screen.getByTestId("coach-suggestion-chips-Quiz me")).toBeInTheDocument();
  });

  it("calls onSelect with the exact suggestion text when clicked", () => {
    const onSelect = vi.fn();
    render(<CoachSuggestionChips suggestions={["Review my portfolio"]} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Review my portfolio"));
    expect(onSelect).toHaveBeenCalledWith("Review my portfolio");
  });

  it("never calls onSelect while disabled", () => {
    const onSelect = vi.fn();
    render(<CoachSuggestionChips suggestions={["Review my portfolio"]} onSelect={onSelect} disabled />);
    fireEvent.click(screen.getByText("Review my portfolio"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("supports a caller-supplied testId prefix", () => {
    render(<CoachSuggestionChips suggestions={["Hi"]} onSelect={() => {}} testId="investing-coach-suggestions" />);
    expect(screen.getByTestId("investing-coach-suggestions")).toBeInTheDocument();
    expect(screen.getByTestId("investing-coach-suggestions-Hi")).toBeInTheDocument();
  });
});
