import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradingCoachSuggestedPrompts } from "./TradingCoachSuggestedPrompts";

describe("TradingCoachSuggestedPrompts", () => {
  it("renders nothing when the prompt list is empty", () => {
    const { container } = render(<TradingCoachSuggestedPrompts prompts={[]} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders every supplied prompt as its own clickable chip", () => {
    render(<TradingCoachSuggestedPrompts prompts={["Explain the Greeks", "Explain this opportunity"]} onSelect={vi.fn()} />);
    expect(screen.getByText("Explain the Greeks")).toBeInTheDocument();
    expect(screen.getByText("Explain this opportunity")).toBeInTheDocument();
  });

  it("calls onSelect with the exact prompt text when clicked", () => {
    const onSelect = vi.fn();
    render(<TradingCoachSuggestedPrompts prompts={["Explain the Greeks"]} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Explain the Greeks"));
    expect(onSelect).toHaveBeenCalledWith("Explain the Greeks");
  });

  it("does not call onSelect when disabled", () => {
    const onSelect = vi.fn();
    render(<TradingCoachSuggestedPrompts prompts={["Explain the Greeks"]} onSelect={onSelect} disabled />);
    fireEvent.click(screen.getByText("Explain the Greeks"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
