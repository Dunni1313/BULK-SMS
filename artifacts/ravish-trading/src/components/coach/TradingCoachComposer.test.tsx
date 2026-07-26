import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";
import { TradingCoachComposer } from "./TradingCoachComposer";

function setup(overrides: Partial<React.ComponentProps<typeof TradingCoachComposer>> = {}) {
  const props: React.ComponentProps<typeof TradingCoachComposer> = {
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn((e) => e.preventDefault()),
    onStop: vi.fn(),
    onClearConversation: vi.fn(),
    isStreaming: false,
    hasHistory: false,
    ...overrides,
  };
  renderWithClient(<TradingCoachComposer {...props} />);
  return props;
}

describe("TradingCoachComposer", () => {
  it("disables the send button when the input is empty", () => {
    setup({ value: "" });
    expect(screen.getByTestId("button-trading-coach-send")).toBeDisabled();
  });

  it("enables send and submits the form when there is text", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    setup({ value: "What are the risks?", onSubmit });
    const sendButton = screen.getByTestId("button-trading-coach-send");
    expect(sendButton).not.toBeDisabled();
    fireEvent.click(sendButton);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows a Stop button instead of Send while streaming, and clicking it calls onStop", () => {
    const onStop = vi.fn();
    setup({ isStreaming: true, onStop });
    expect(screen.queryByTestId("button-trading-coach-send")).not.toBeInTheDocument();
    const stopButton = screen.getByTestId("button-trading-coach-stop");
    fireEvent.click(stopButton);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("disables the input while streaming", () => {
    setup({ isStreaming: true });
    expect(screen.getByTestId("input-trading-coach-composer")).toBeDisabled();
  });

  it("does not show a Clear conversation control when there is no history", () => {
    setup({ hasHistory: false });
    expect(screen.queryByTestId("button-trading-coach-clear-conversation")).not.toBeInTheDocument();
  });

  it("shows Clear conversation, asks for confirmation, and only clears after confirming", async () => {
    const user = userEvent.setup();
    const onClearConversation = vi.fn();
    setup({ hasHistory: true, onClearConversation });

    await user.click(screen.getByTestId("button-trading-coach-clear-conversation"));
    expect(await screen.findByTestId("dialog-trading-coach-clear-confirm")).toBeInTheDocument();
    // The confirmation copy is honest about what "clear" actually does —
    // it never claims the server-persisted history itself is deleted.
    expect(screen.getByText(/remains saved/i)).toBeInTheDocument();

    expect(onClearConversation).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("button-trading-coach-clear-confirm"));
    expect(onClearConversation).toHaveBeenCalledTimes(1);
  });

  it("cancelling the confirmation dialog never calls onClearConversation", async () => {
    const user = userEvent.setup();
    const onClearConversation = vi.fn();
    setup({ hasHistory: true, onClearConversation });

    await user.click(screen.getByTestId("button-trading-coach-clear-conversation"));
    await user.click(screen.getByTestId("button-trading-coach-clear-cancel"));
    expect(onClearConversation).not.toHaveBeenCalled();
  });
});
