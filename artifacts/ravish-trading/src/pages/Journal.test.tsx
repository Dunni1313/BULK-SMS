// Phase 6, Sprint 72 — Frontend Legacy Page Test Coverage, Slice 2.
// Following the established mocked-generated-hook + streamCoach mocking
// pattern (see StockResearch.test.tsx / TradingResearch.test.tsx).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const streamCoachMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/coach-stream", () => ({
  streamCoach: streamCoachMock,
}));

const createEntryMock = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const mockState = vi.hoisted(() => ({
  entries: undefined as unknown,
  isLoading: false,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useListJournalEntries: () => ({ data: mockState.entries, isLoading: mockState.isLoading }),
    useCreateJournalEntry: () => createEntryMock,
  };
});

import Journal from "./Journal";

function entry(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "SPY Iron Condor",
    content: "Entered on IV crush setup.",
    mood: "confident",
    createdAt: "2026-07-01T12:00:00.000Z",
    strategy: null,
    exitReason: null,
    realizedPnl: null,
    entryCredit: null,
    maxProfit: null,
    maxLoss: null,
    ev: null,
    pop: null,
    ravishScore: null,
    lessonLearned: null,
    tradeId: null,
    ...over,
  };
}

describe("Journal page", () => {
  beforeEach(() => {
    mockState.entries = undefined;
    mockState.isLoading = false;
    createEntryMock.mutate.mockReset();
    createEntryMock.isPending = false;
    streamCoachMock.mockReset();
  });

  it("shows loading skeletons while entries resolve", () => {
    mockState.isLoading = true;
    renderWithClient(<Journal />);
    expect(screen.getByText("Trade Journal")).toBeInTheDocument();
  });

  it("shows an honest empty message when there are no entries", () => {
    mockState.entries = [];
    renderWithClient(<Journal />);
    expect(screen.getByText("No entries yet. Write your first log.")).toBeInTheDocument();
  });

  it("renders a real entry with its strategy/P&L badges and lesson learned", () => {
    mockState.entries = [
      entry({
        strategy: "iron_condor",
        exitReason: "profit_target",
        realizedPnl: 125.5,
        entryCredit: 200,
        lessonLearned: "Size down on high IV rank entries.",
      }),
    ];
    renderWithClient(<Journal />);
    expect(screen.getByText("SPY Iron Condor")).toBeInTheDocument();
    expect(screen.getByText("confident")).toBeInTheDocument();
    expect(screen.getByText("iron condor")).toBeInTheDocument();
    expect(screen.getByText("profit target")).toBeInTheDocument();
    expect(screen.getByText("+$125.50")).toBeInTheDocument();
    expect(screen.getByText("$200")).toBeInTheDocument();
    expect(screen.getByText("Lesson Learned")).toBeInTheDocument();
    expect(screen.getByText("Size down on high IV rank entries.")).toBeInTheDocument();
  });

  it("shows a negative realized P&L without a fabricated leading plus sign", () => {
    mockState.entries = [entry({ strategy: "iron_fly", realizedPnl: -80 })];
    renderWithClient(<Journal />);
    expect(screen.getByText("-$80.00")).toBeInTheDocument();
  });

  it("submits a new entry with the entered title, content, mood, and lesson", async () => {
    mockState.entries = [];
    renderWithClient(<Journal />);
    await userEvent.type(screen.getByPlaceholderText("E.g. SPY Earnings Trade"), "AAPL Calendar");
    await userEvent.type(screen.getByPlaceholderText("What happened? Why did you enter/exit?"), "Rolled up for credit.");
    await userEvent.click(screen.getByRole("button", { name: "Save Entry" }));

    expect(createEntryMock.mutate).toHaveBeenCalledWith(
      { data: { title: "AAPL Calendar", content: "Rolled up for credit.", mood: "neutral", lessonLearned: "", tags: [] } },
      expect.anything(),
    );
  });

  it("requests and renders an AI Coach review for a closed trade", async () => {
    streamCoachMock.mockImplementation(async (_path, _body, handlers) => {
      handlers.onDone?.({ review: "Solid discipline exiting at the profit target.", source: "llm" });
    });
    mockState.entries = [entry({ strategy: "iron_condor", realizedPnl: 100, tradeId: 55 })];
    renderWithClient(<Journal />);

    await userEvent.click(screen.getByRole("button", { name: /generate coach review/i }));

    expect(streamCoachMock).toHaveBeenCalledWith(
      "/coach/journal-review/stream",
      { tradeId: 55 },
      expect.anything(),
    );
    expect(await screen.findByText("Solid discipline exiting at the profit target.")).toBeInTheDocument();
  });
});
