// Phase 14 — Institutional Investment Decision Engine. Frontend smoke tests
// for the tabbed page, mirroring PortfolioConstruction.test.tsx's own
// established mocked-generated-hook pattern.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

type HookResult = { data: unknown; isLoading?: boolean; isError?: boolean };

const mockState = vi.hoisted(() => ({
  portfolios: { data: [] as unknown[] } as HookResult,
  decision: { data: undefined as unknown, isLoading: false, isError: false } as HookResult,
  snapshots: { data: [] as unknown[] } as HookResult,
  notes: { data: [] as unknown[] } as HookResult,
}));

const getInstitutionalDecisionMock = vi.hoisted(() => vi.fn());
const saveSnapshotMock = vi.hoisted(() => vi.fn());
const addNoteMock = vi.hoisted(() => vi.fn());
const updateNoteMock = vi.hoisted(() => vi.fn());
const deleteNoteMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: () => mockState.decision,
  };
});

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  return {
    ...actual,
    useGetPortfolios: () => mockState.portfolios,
    useGetDecisionSnapshots: () => mockState.snapshots,
    useGetDecisionNotes: () => mockState.notes,
    useSaveDecisionSnapshot: () => ({ mutate: saveSnapshotMock, isPending: false }),
    useAddDecisionNote: () => ({ mutate: addNoteMock, isPending: false }),
    useUpdateDecisionNote: () => ({ mutate: updateNoteMock, isPending: false }),
    useDeleteDecisionNote: () => ({ mutate: deleteNoteMock, isPending: false }),
    getInstitutionalDecision: getInstitutionalDecisionMock,
  };
});

import DecisionEngine from "./DecisionEngine";

function fixtureDecision(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "AAPL",
    asOf: "2026-01-15",
    kind: "stock",
    price: 150,
    recommendation: "Buy",
    confidence: 82,
    summary: "AAPL: Buy (confidence 82/100). Investment Committee votes Buy.",
    explanation: "Investment Committee votes Buy, and the synthesis score clears the high-conviction bar.",
    drivers: ["Economic Moat: Wide moat — durable advantage."],
    risks: [],
    supportingEvidence: [{ label: "Economic Moat", detail: "Wide moat." }],
    contradictingEvidence: [],
    checklist: Array.from({ length: 15 }, (_, i) => ({
      id: `item-${i}`,
      label: `Item ${i}`,
      status: "pass",
      explanation: `Detail ${i}`,
    })),
    strengths: ["Strong ROIC."],
    weaknesses: [],
    catalysts: ["A re-rating catalyst."],
    thingsToMonitor: ["Watch earnings."],
    whyBuy: ["Strong moat and quality."],
    whyWait: ["No strong signal to wait."],
    whySell: ["No strong bearish evidence identified from currently available data."],
    managementQuality: { available: false, score: null, reason: "unavailable" },
    portfolioFit: { available: false, reason: "No portfolio was supplied." },
    riskChecklistItem: { id: "risk", label: "Risk", status: "unavailable", explanation: "No portfolio selected." },
    diversificationChecklistItem: { id: "diversification", label: "Diversification", status: "unavailable", explanation: "No portfolio selected." },
    disclaimer: "Educational research only — not investment advice.",
    ...overrides,
  };
}

describe("DecisionEngine page", () => {
  beforeEach(() => {
    mockState.portfolios = { data: [] };
    mockState.decision = { data: undefined, isLoading: false, isError: false };
    mockState.snapshots = { data: [] };
    mockState.notes = { data: [] };
    getInstitutionalDecisionMock.mockReset();
    saveSnapshotMock.mockReset();
    addNoteMock.mockReset();
    updateNoteMock.mockReset();
    deleteNoteMock.mockReset();
  });

  it("shows the honest empty state before any symbol is analyzed", () => {
    renderWithClient(<DecisionEngine />);
    expect(screen.getByTestId("decision-engine-empty")).toBeInTheDocument();
    expect(screen.getByTestId("decision-engine-labels")).toHaveTextContent("Institutional Decision Engine");
    expect(screen.getByTestId("decision-engine-labels")).toHaveTextContent("Evidence Based");
  });

  it("renders the recommendation, checklist, and tabs once a decision resolves", async () => {
    mockState.decision = { data: fixtureDecision(), isLoading: false, isError: false };
    renderWithClient(<DecisionEngine />);

    await userEvent.type(screen.getByTestId("input-decision-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-analyze-decision"));

    expect(await screen.findByTestId("decision-recommendation")).toHaveTextContent("Buy");
    expect(screen.getByTestId("decision-confidence")).toHaveTextContent("82/100");

    await userEvent.click(screen.getByTestId("tab-checklist"));
    const panel = screen.getByTestId("checklist-panel");
    expect(within(panel).getAllByText(/^pass$/i).length).toBe(15);
  });

  it("shows an honest error message for an unresolvable symbol", async () => {
    mockState.decision = { data: undefined, isLoading: false, isError: true };
    renderWithClient(<DecisionEngine />);

    await userEvent.type(screen.getByTestId("input-decision-symbol"), "ZZZZ");
    await userEvent.click(screen.getByTestId("button-analyze-decision"));

    expect(await screen.findByTestId("decision-engine-error")).toBeInTheDocument();
  });

  it("Evidence tab shows supporting and contradicting evidence honestly", async () => {
    mockState.decision = {
      data: fixtureDecision({
        supportingEvidence: [{ label: "Moat", detail: "Wide moat." }],
        contradictingEvidence: [{ label: "Valuation", detail: "Expensive." }],
      }),
      isLoading: false,
      isError: false,
    };
    renderWithClient(<DecisionEngine />);
    await userEvent.type(screen.getByTestId("input-decision-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-analyze-decision"));
    await screen.findByTestId("decision-recommendation");

    await userEvent.click(screen.getByTestId("tab-evidence"));
    expect(screen.getByText("Wide moat.")).toBeInTheDocument();
    expect(screen.getByText("Expensive.")).toBeInTheDocument();
  });

  it("History tab shows the honest empty-snapshots message and a Save Snapshot button", async () => {
    mockState.decision = { data: fixtureDecision(), isLoading: false, isError: false };
    renderWithClient(<DecisionEngine />);
    await userEvent.type(screen.getByTestId("input-decision-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-analyze-decision"));
    await screen.findByTestId("decision-recommendation");

    await userEvent.click(screen.getByTestId("tab-history"));
    expect(screen.getByTestId("decision-history-empty")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("button-save-decision-snapshot"));
    expect(saveSnapshotMock).toHaveBeenCalled();
  });

  it("Notes tab submits a new note", async () => {
    mockState.decision = { data: fixtureDecision(), isLoading: false, isError: false };
    renderWithClient(<DecisionEngine />);
    await userEvent.type(screen.getByTestId("input-decision-symbol"), "AAPL");
    await userEvent.click(screen.getByTestId("button-analyze-decision"));
    await screen.findByTestId("decision-recommendation");

    await userEvent.click(screen.getByTestId("tab-notes"));
    await userEvent.type(screen.getByTestId("new-decision-note-text"), "Revisit after earnings.");
    await userEvent.click(screen.getByTestId("button-add-decision-note"));
    expect(addNoteMock).toHaveBeenCalledWith(
      { symbol: "AAPL", data: { note: "Revisit after earnings." } },
      expect.anything(),
    );
  });
});
