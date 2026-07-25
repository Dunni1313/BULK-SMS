// Phase 6, Sprint 72 — Frontend Legacy Page Test Coverage, Slice 2.
// Following the established mocked-generated-hook pattern (see
// Login.test.tsx for the wouter useLocation mocking precedent).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const runScannerMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const setLocationMock = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({
  results: undefined as unknown,
  isLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetScannerResults: () => ({ data: mockState.results, isLoading: mockState.isLoading }),
    useRunScanner: () => runScannerMock,
  };
});

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/scanner", setLocationMock],
  };
});

import Scanner from "./Scanner";
import { useTradingCoach } from "@/hooks/use-trading-coach";

// v1.3.1 — AI Trading Coach. A minimal debug consumer proving the
// Scanner row's "Ask AI Trading Coach" trigger sets the shared
// TradingCoachProvider focus correctly — full Coach panel/workspace
// behavior is already covered by TradingCoachWorkspace.test.tsx.
function FocusProbe() {
  const { open, focus } = useTradingCoach();
  return (
    <div data-testid="focus-probe">
      {String(open)}|{focus.symbol ?? ""}|{focus.scannerCandidateLabel ?? ""}
    </div>
  );
}

function scannerResult(over: Record<string, unknown> = {}) {
  return {
    id: 42,
    symbol: "AAPL",
    ravishTier: "elite",
    strategy: "iron_condor",
    daysToExpiry: 30,
    credit: 1.85,
    pop: 78.5,
    ev: 0.62,
    ravishScore: 87,
    eventRiskLevel: "none",
    eventRiskPenalty: null,
    eventRiskEvents: [],
    ...over,
  };
}

describe("Scanner page", () => {
  beforeEach(() => {
    mockState.results = undefined;
    mockState.isLoading = false;
    runScannerMock.mutate.mockReset();
    runScannerMock.isPending = false;
    setLocationMock.mockReset();
  });

  it("shows loading skeletons while scanner results resolve", () => {
    mockState.isLoading = true;
    renderWithClient(<Scanner />);
    expect(screen.getByText("Market Scanner")).toBeInTheDocument();
    expect(document.querySelectorAll("tbody tr").length).toBe(5);
  });

  it("shows an honest empty message when there are no opportunities", () => {
    mockState.results = [];
    renderWithClient(<Scanner />);
    expect(screen.getByText("No opportunities found. Try running a scan.")).toBeInTheDocument();
  });

  it("renders real scanner rows once resolved, including the honest no-event-risk indicator", () => {
    mockState.results = [scannerResult()];
    renderWithClient(<Scanner />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("elite")).toBeInTheDocument();
    expect(screen.getByText("iron condor")).toBeInTheDocument();
    expect(screen.getByText("$1.85")).toBeInTheDocument();
    expect(screen.getByText("87")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument(); // EventRiskBadge's own honest "none" indicator
  });

  it("navigates to the trade ticket when Review is clicked", async () => {
    mockState.results = [scannerResult()];
    renderWithClient(<Scanner />);
    await userEvent.click(screen.getByTestId("button-review-42"));
    expect(setLocationMock).toHaveBeenCalledWith("/ticket/42");
  });

  it("triggers a scan run when Run Scan is clicked", async () => {
    renderWithClient(<Scanner />);
    await userEvent.click(screen.getByRole("button", { name: /run scan/i }));
    expect(runScannerMock.mutate).toHaveBeenCalledWith({ data: {} }, expect.anything());
  });

  it("opens the AI Trading Coach with this candidate's symbol/strategy in focus", async () => {
    mockState.results = [scannerResult()];
    renderWithClient(
      <>
        <Scanner />
        <FocusProbe />
      </>,
    );
    await userEvent.click(screen.getByTestId("button-ask-trading-coach-42"));
    expect(screen.getByTestId("focus-probe")).toHaveTextContent("true|AAPL|AAPL iron condor");
  });
});
