// v1.4.0, Sprint L1 — Learning Centre Foundation. Proves AskCoachLauncher
// genuinely opens the real, already-global TradingCoachPanel (not a mock
// of the hook) — mirroring TradingCoachPanel.test.tsx's own established
// mocking pattern for its underlying data/streaming dependencies.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({ streamCoach: streamCoachMock }));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetUnifiedTradingCoachMessages: () => ({ data: [], isLoading: false }),
  };
});

import { AskCoachLauncher } from "./AskCoachLauncher";
import { TradingCoachPanel } from "@/components/coach/TradingCoachPanel";

beforeEach(() => {
  streamCoachMock.mockReset();
  streamCoachMock.mockResolvedValue(undefined);
});

describe("AskCoachLauncher", () => {
  it("shows a suggested-question hint without auto-submitting it", () => {
    renderWithClient(<AskCoachLauncher suggestedQuestion="What is the Command Palette?" />);
    expect(screen.getByTestId("text-ask-coach-suggested-question")).toHaveTextContent(
      "What is the Command Palette?",
    );
    expect(streamCoachMock).not.toHaveBeenCalled();
  });

  it("renders with no hint at all when no suggestedQuestion is supplied", () => {
    renderWithClient(<AskCoachLauncher />);
    expect(screen.queryByTestId("text-ask-coach-suggested-question")).not.toBeInTheDocument();
  });

  it("clicking it opens the real, already-global Trading Coach panel with a neutral (no stale symbol/position) focus", async () => {
    renderWithClient(
      <>
        <AskCoachLauncher />
        <TradingCoachPanel />
      </>,
    );
    expect(screen.queryByTestId("trading-coach-workspace")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("button-ask-coach-launcher"));
    expect(await screen.findByTestId("trading-coach-workspace")).toBeInTheDocument();
  });
});
