import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";
import { TradingCoachSuggestedActions } from "./TradingCoachSuggestedActions";

describe("TradingCoachSuggestedActions", () => {
  it("renders nothing when there are no actions", () => {
    const { container } = renderWithClient(<TradingCoachSuggestedActions actions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders each action as a real navigable link to its own href — never a mutation trigger", () => {
    renderWithClient(
      <TradingCoachSuggestedActions
        actions={[
          { label: "Open in Trade Execution Center", href: "/ticket/9" },
          { label: "View Options Dashboard", href: "/options-dashboard" },
        ]}
      />,
    );
    expect(screen.getByTestId("trading-coach-suggested-action-/ticket/9").closest("a")).toHaveAttribute(
      "href",
      "/ticket/9",
    );
    expect(screen.getByTestId("trading-coach-suggested-action-/options-dashboard").closest("a")).toHaveAttribute(
      "href",
      "/options-dashboard",
    );
  });
});
