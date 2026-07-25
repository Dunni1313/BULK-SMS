// v1.3.1 — AI Trading Coach, Frontend UI. The dockable Sheet panel itself
// — proves it mounts the Workspace, reflects the provider's open/closed
// state, and that closing it (via the header's close button) calls back
// into the provider correctly.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEffect } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";
import { useTradingCoach } from "@/hooks/use-trading-coach";

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

import { TradingCoachPanel } from "./TradingCoachPanel";

function OpenOnMount() {
  const { setOpen } = useTradingCoach();
  useEffect(() => setOpen(true), []);
  return <TradingCoachPanel />;
}

beforeEach(() => {
  streamCoachMock.mockReset();
  streamCoachMock.mockResolvedValue(undefined);
});

describe("TradingCoachPanel", () => {
  it("renders nothing visible while closed", () => {
    renderWithClient(<TradingCoachPanel />);
    expect(screen.queryByTestId("trading-coach-workspace")).not.toBeInTheDocument();
  });

  it("mounts the Workspace once opened", async () => {
    renderWithClient(<OpenOnMount />);
    expect(await screen.findByTestId("trading-coach-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("trading-coach-header")).toBeInTheDocument();
  });

  it("closing via the header close button hides the workspace again", async () => {
    const user = userEvent.setup();
    renderWithClient(<OpenOnMount />);
    await screen.findByTestId("trading-coach-workspace");

    await user.click(screen.getByTestId("button-trading-coach-close"));
    await waitFor(() => expect(screen.queryByTestId("trading-coach-workspace")).not.toBeInTheDocument());
  });
});
