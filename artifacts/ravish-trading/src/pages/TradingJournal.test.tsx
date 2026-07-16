// Phase 3, Sprint 46 - Trading Journal frontend smoke test, following the
// established mocked-generated-hook pattern (see TradingResearch.test.tsx,
// PortfolioConstruction.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();

const mockState = vi.hoisted(() => ({
  entries: [] as unknown[],
  isLoading: false,
  isError: false,
  positions: [] as unknown[],
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useListTradingJournalEntries: () => ({
      data: mockState.entries,
      isLoading: mockState.isLoading,
      isError: mockState.isError,
    }),
    useListTradingPositions: () => ({ data: mockState.positions }),
    useCreateTradingJournalEntry: () => ({ mutate: createMutate, isPending: false }),
    useUpdateTradingJournalEntry: () => ({ mutate: updateMutate, isPending: false }),
    useDeleteTradingJournalEntry: () => ({ mutate: deleteMutate, isPending: false }),
  };
});

import TradingJournal from "./TradingJournal";

function journalEntry(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    tradingPositionId: null,
    title: "AAPL breakout follow-through",
    content: "Entered on the structure break, held through the pullback.",
    mood: "confident",
    lessonLearned: "Trust the plan once the level confirms.",
    tags: [],
    setupType: "Breakout",
    entryPrice: 190.5,
    exitPrice: 198.25,
    rMultiple: 2.1,
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
    ...over,
  };
}

describe("TradingJournal page", () => {
  beforeEach(() => {
    mockState.entries = [];
    mockState.isLoading = false;
    mockState.isError = false;
    mockState.positions = [];
    createMutate.mockReset();
    updateMutate.mockReset();
    deleteMutate.mockReset();
  });

  it("shows loading skeletons while entries are loading", () => {
    mockState.isLoading = true;
    renderWithClient(<TradingJournal />);
    expect(screen.getByTestId("page-trading-journal")).toBeInTheDocument();
    expect(screen.queryByText(/No journal entries yet/i)).not.toBeInTheDocument();
  });

  it("shows an honest error message when entries fail to load", () => {
    mockState.isError = true;
    renderWithClient(<TradingJournal />);
    expect(screen.getByText(/Could not load journal entries/i)).toBeInTheDocument();
  });

  it("shows an empty-state message when there are no entries yet", () => {
    renderWithClient(<TradingJournal />);
    expect(screen.getByText(/No journal entries yet/i)).toBeInTheDocument();
  });

  it("renders an entry with its mood badge, trading-specific badges, and lesson learned", () => {
    mockState.entries = [journalEntry()];
    renderWithClient(<TradingJournal />);

    expect(screen.getByTestId("card-journal-entry-1")).toBeInTheDocument();
    expect(screen.getByText("AAPL breakout follow-through")).toBeInTheDocument();
    expect(screen.getByText("confident")).toBeInTheDocument();
    expect(screen.getByText("Breakout")).toBeInTheDocument();
    expect(screen.getByText("Entry $190.50")).toBeInTheDocument();
    expect(screen.getByText("Exit $198.25")).toBeInTheDocument();
    expect(screen.getByText("+2.1R")).toBeInTheDocument();
    expect(screen.getByText("Trust the plan once the level confirms.")).toBeInTheDocument();
  });

  it("renders a negative R-multiple without a leading plus sign", () => {
    mockState.entries = [journalEntry({ id: 2, rMultiple: -1.4 })];
    renderWithClient(<TradingJournal />);
    expect(screen.getByText("-1.4R")).toBeInTheDocument();
  });

  it("submits the new-entry form with the entered values", async () => {
    renderWithClient(<TradingJournal />);

    await userEvent.type(screen.getByTestId("input-journal-title"), "MSFT range fade");
    await userEvent.type(screen.getByTestId("input-journal-content"), "Faded the range high on weak volume.");
    await userEvent.click(screen.getByTestId("button-save-journal-entry"));

    expect(createMutate).toHaveBeenCalledWith(
      {
        data: {
          title: "MSFT range fade",
          content: "Faded the range high on weak volume.",
          mood: "neutral",
          lessonLearned: undefined,
          setupType: undefined,
          entryPrice: undefined,
          exitPrice: undefined,
          rMultiple: undefined,
          tradingPositionId: undefined,
        },
      },
      expect.anything(),
    );
  });

  it("does not submit the new-entry form when title or content is missing", async () => {
    renderWithClient(<TradingJournal />);
    await userEvent.click(screen.getByTestId("button-save-journal-entry"));
    expect(createMutate).not.toHaveBeenCalled();
  });

  it("opens an edit form pre-filled with the entry's own values, and submits the update", async () => {
    mockState.entries = [journalEntry()];
    renderWithClient(<TradingJournal />);

    await userEvent.click(screen.getByTestId("button-edit-entry-1"));

    const editCard = within(screen.getByTestId("card-journal-entry-1-editing"));
    expect(editCard.getByTestId("input-journal-title")).toHaveValue("AAPL breakout follow-through");

    await userEvent.clear(editCard.getByTestId("input-journal-title"));
    await userEvent.type(editCard.getByTestId("input-journal-title"), "AAPL breakout follow-through (revised)");
    await userEvent.click(editCard.getByTestId("button-save-edit-1"));

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        data: expect.objectContaining({ title: "AAPL breakout follow-through (revised)" }),
      }),
      expect.anything(),
    );
  });

  it("cancels an in-progress edit without submitting anything", async () => {
    mockState.entries = [journalEntry()];
    renderWithClient(<TradingJournal />);

    await userEvent.click(screen.getByTestId("button-edit-entry-1"));
    expect(screen.getByTestId("card-journal-entry-1-editing")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("button-cancel-edit-1"));
    expect(screen.queryByTestId("card-journal-entry-1-editing")).not.toBeInTheDocument();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("submits a delete for the clicked entry", async () => {
    mockState.entries = [journalEntry()];
    renderWithClient(<TradingJournal />);

    await userEvent.click(screen.getByTestId("button-delete-entry-1"));

    expect(deleteMutate).toHaveBeenCalledWith({ id: 1 }, expect.anything());
  });
});
