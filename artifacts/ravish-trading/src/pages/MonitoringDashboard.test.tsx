// Phase 16 — Institutional Monitoring & Alerts Engine. Follows this
// codebase's own established reliable test pattern (vi.hoisted() + top-level
// vi.mock() + a static import — see src/test/page-test-pattern.guardrail.test.ts
// and its reference, src/pages/Trades.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  notifications: [] as unknown[],
  notificationsLoading: false,
  alertNotes: [] as unknown[],
  fullCheckMutate: vi.fn(),
  toggleReadMutate: vi.fn(),
  addNoteMutate: vi.fn(),
  deleteNoteMutate: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useListNotifications: () => ({ data: mockState.notifications, isLoading: mockState.notificationsLoading }),
    useFullMonitoringCheck: () => ({ mutate: mockState.fullCheckMutate, isPending: false }),
    useUpdateNotification: () => ({ mutate: mockState.toggleReadMutate, isPending: false }),
    useGetAlertNotes: () => ({ data: mockState.alertNotes, isLoading: false }),
    useAddAlertNote: () => ({ mutate: mockState.addNoteMutate, isPending: false }),
    useDeleteAlertNote: () => ({ mutate: mockState.deleteNoteMutate, isPending: false }),
  };
});

import MonitoringDashboard from "./MonitoringDashboard";

function alert(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    type: "decision_change",
    title: "AAPL: Decision Engine recommendation changed",
    message: "AAPL's recommendation moved from Hold to Sell.",
    dataSource: "SIMULATED",
    relatedSymbol: "AAPL",
    isRead: false,
    severity: "critical",
    previousValue: "Hold",
    currentValue: "Sell",
    evidence: ["Synthesis score: 60 -> 30", "Some rank explanation."],
    recommendedAction: "Review AAPL on the Institutional Decision Engine page.",
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe("MonitoringDashboard", () => {
  beforeEach(() => {
    mockState.notifications = [];
    mockState.notificationsLoading = false;
    mockState.alertNotes = [];
    mockState.fullCheckMutate.mockReset();
    mockState.toggleReadMutate.mockReset();
    mockState.addNoteMutate.mockReset();
    mockState.deleteNoteMutate.mockReset();
  });

  it("shows the permanent labels and a loading skeleton while notifications load", () => {
    mockState.notificationsLoading = true;
    renderWithClient(<MonitoringDashboard />);
    expect(screen.getByTestId("badge-institutional-monitoring")).toBeInTheDocument();
    expect(screen.getByTestId("badge-educational")).toBeInTheDocument();
    expect(screen.getByTestId("badge-deterministic")).toBeInTheDocument();
    expect(screen.getByTestId("badge-evidence-based")).toBeInTheDocument();
    expect(screen.getByTestId("monitoring-dashboard-loading")).toBeInTheDocument();
  });

  it("shows an honest empty message on every tab when there are no alerts", async () => {
    const user = userEvent.setup();
    renderWithClient(<MonitoringDashboard />);
    expect(await screen.findByTestId("text-active-empty")).toBeInTheDocument();

    await user.click(screen.getByTestId("tab-alert-history"));
    expect(await screen.findByTestId("text-history-empty")).toBeInTheDocument();

    await user.click(screen.getByTestId("tab-timeline"));
    expect(await screen.findByTestId("text-timeline-empty")).toBeInTheDocument();
  });

  it("renders every required field on an alert: reason/evidence/previous/current/severity/recommended action/timestamp", async () => {
    mockState.notifications = [alert()];
    renderWithClient(<MonitoringDashboard />);

    const card = await screen.findByTestId("alert-1");
    expect(within(card).getByText("AAPL: Decision Engine recommendation changed")).toBeInTheDocument();
    expect(within(card).getByText("AAPL's recommendation moved from Hold to Sell.")).toBeInTheDocument();
    expect(within(card).getByTestId("badge-severity-1")).toHaveTextContent("critical");
    expect(within(card).getByTestId("text-previous-current-1")).toHaveTextContent("Hold");
    expect(within(card).getByTestId("text-previous-current-1")).toHaveTextContent("Sell");
    expect(within(card).getByTestId("list-evidence-1")).toHaveTextContent("Synthesis score: 60 -> 30");
    expect(within(card).getByTestId("text-recommended-action-1")).toHaveTextContent(/Institutional Decision Engine/);
    expect(within(card).getByTestId("text-timestamp-1")).toBeInTheDocument();
  });

  it("an unread alert appears under Active Alerts, not Alert History", async () => {
    mockState.notifications = [alert({ id: 1, isRead: false })];
    renderWithClient(<MonitoringDashboard />);
    await screen.findByTestId("alert-1");

    const user = userEvent.setup();
    await user.click(screen.getByTestId("tab-alert-history"));
    expect(screen.queryByTestId("alert-1")).not.toBeInTheDocument();
  });

  it("a read alert appears under Alert History, not Active Alerts", async () => {
    mockState.notifications = [alert({ id: 2, isRead: true })];
    const user = userEvent.setup();
    renderWithClient(<MonitoringDashboard />);
    await screen.findByTestId("text-active-empty");

    await user.click(screen.getByTestId("tab-alert-history"));
    expect(await screen.findByTestId("alert-2")).toBeInTheDocument();
  });

  it("filtering by severity hides alerts of a different severity", async () => {
    mockState.notifications = [alert({ id: 1, severity: "critical" }), alert({ id: 2, severity: "info", title: "Info alert" })];
    const user = userEvent.setup();
    renderWithClient(<MonitoringDashboard />);
    await screen.findByTestId("alert-1");
    expect(screen.getByTestId("alert-2")).toBeInTheDocument();

    await user.click(screen.getByTestId("select-filter-severity"));
    await user.click(await screen.findByRole("option", { name: "Critical" }));

    expect(screen.getByTestId("alert-1")).toBeInTheDocument();
    expect(screen.queryByTestId("alert-2")).not.toBeInTheDocument();
  });

  it("filtering by symbol hides alerts for a different symbol", async () => {
    mockState.notifications = [
      alert({ id: 1, relatedSymbol: "AAPL" }),
      alert({ id: 2, relatedSymbol: "MSFT", title: "MSFT alert" }),
    ];
    const user = userEvent.setup();
    renderWithClient(<MonitoringDashboard />);
    await screen.findByTestId("alert-1");

    await user.type(screen.getByTestId("input-filter-symbol"), "msft");
    expect(screen.queryByTestId("alert-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("alert-2")).toBeInTheDocument();
  });

  it("clicking 'Mark read' submits the correct mutation payload", async () => {
    mockState.notifications = [alert({ id: 5, isRead: false })];
    const user = userEvent.setup();
    renderWithClient(<MonitoringDashboard />);
    await screen.findByTestId("alert-5");

    await user.click(screen.getByTestId("button-toggle-read-5"));
    expect(mockState.toggleReadMutate).toHaveBeenCalledWith({ id: 5, data: { isRead: true } });
  });

  it("clicking 'Run Full Check' triggers the full-check mutation", async () => {
    const user = userEvent.setup();
    renderWithClient(<MonitoringDashboard />);
    await user.click(screen.getByTestId("button-run-full-check"));
    expect(mockState.fullCheckMutate).toHaveBeenCalled();
  });

  it("opens the Alert Notes dialog for an alert and shows its notes, and submits a new note", async () => {
    mockState.notifications = [alert({ id: 9 })];
    mockState.alertNotes = [{ id: 1, notificationId: 9, symbol: null, note: "Watching closely.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
    const user = userEvent.setup();
    renderWithClient(<MonitoringDashboard />);
    await screen.findByTestId("alert-9");

    await user.click(screen.getByTestId("button-notes-9"));
    const dialog = await screen.findByTestId("dialog-alert-notes");
    expect(within(dialog).getByText("Watching closely.")).toBeInTheDocument();

    await user.type(within(dialog).getByTestId("input-new-note"), "A new note.");
    await user.click(within(dialog).getByTestId("button-add-note"));
    expect(mockState.addNoteMutate).toHaveBeenCalledWith(
      { data: { notificationId: 9, note: "A new note." } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
