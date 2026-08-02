// v1.5.0, Sprint 12 — Institutional Command Centre. Standalone coverage for
// the newly-extracted shared component, following the same mocked-hook +
// mocked-streamCoach pattern CrossEngineDailyReport.test.tsx already
// established for this exact UI/behavior (that file's own 10 tests keep
// passing unmodified after the extraction, proving the behavior is
// unchanged for that page — this file additionally proves the component's
// own standalone loading/error states, only reachable when it's the sole
// consumer of the report, as it is on the new Command Centre).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: streamCoachMock,
}));

const mockState = vi.hoisted(() => ({
  report: undefined as unknown,
  isLoading: false,
  isError: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetCrossEngineDailyReport: () => ({
      data: mockState.report,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
  };
});

import { DailyBriefingCard } from "./DailyBriefingCard";

function dailyReport(over: Record<string, unknown> = {}) {
  return {
    date: "2026-07-30",
    summary: "Macro regime: Stable-Rate Environment. Watchlist is empty. Trading risk: Excellent.",
    ...over,
  };
}

describe("DailyBriefingCard", () => {
  beforeEach(() => {
    mockState.report = undefined;
    mockState.isLoading = false;
    mockState.isError = false;
    streamCoachMock.mockReset();
  });

  it("shows its own loading state while the report resolves", () => {
    mockState.isLoading = true;
    renderWithClient(<DailyBriefingCard />);
    expect(screen.getByTestId("daily-briefing-card-loading")).toBeInTheDocument();
  });

  it("shows its own honest error state when the report fails to load", () => {
    mockState.isError = true;
    renderWithClient(<DailyBriefingCard />);
    expect(screen.getByTestId("daily-briefing-card-error")).toBeInTheDocument();
  });

  it("renders the deterministic summary and a Narrate My Day button once resolved", () => {
    mockState.report = dailyReport();
    renderWithClient(<DailyBriefingCard />);
    expect(screen.getByTestId("card-daily-report-summary")).toBeInTheDocument();
    expect(screen.getByTestId("daily-report-summary-text")).toHaveTextContent(/Stable-Rate Environment/i);
    expect(screen.getByTestId("narrate-daily-report-button")).toHaveTextContent(/narrate my day/i);
  });

  it("hides the date heading when compact is true, without changing the summary/narrate content", () => {
    mockState.report = dailyReport();
    renderWithClient(<DailyBriefingCard compact />);
    expect(screen.queryByText(/Today — 2026-07-30/)).not.toBeInTheDocument();
    expect(screen.getByTestId("daily-report-summary-text")).toBeInTheDocument();
  });

  it("streams a narration and keeps the deterministic summary visible", async () => {
    streamCoachMock.mockImplementation(async (_path, _body, handlers) => {
      handlers.onDone?.({ narrative: "Quiet day across all 3 engines." });
    });
    mockState.report = dailyReport();
    renderWithClient(<DailyBriefingCard />);

    await userEvent.click(screen.getByTestId("narrate-daily-report-button"));

    expect(await screen.findByText(/quiet day across all 3 engines/i)).toBeInTheDocument();
    expect(screen.getByTestId("daily-report-summary-text")).toHaveTextContent(/Stable-Rate Environment/i);
    expect(streamCoachMock).toHaveBeenCalledWith("/cross-engine-report/narrate/stream", {}, expect.anything());
  });

  it("shows an honest error, never a fabricated narration, when the stream fails", async () => {
    streamCoachMock.mockImplementation(async (_path, _body, handlers) => {
      handlers.onError?.("narration failed");
    });
    mockState.report = dailyReport();
    renderWithClient(<DailyBriefingCard />);

    await userEvent.click(screen.getByTestId("narrate-daily-report-button"));

    expect(await screen.findByTestId("narrate-daily-report-error")).toBeInTheDocument();
  });
});
