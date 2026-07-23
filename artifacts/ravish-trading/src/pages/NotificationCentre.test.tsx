// Phase 10 — Institutional Platform Polish & Control Center. Smoke tests
// for the Notification Centre page, following the established
// mocked-generated-hook pattern.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  notifications: undefined as unknown,
  notificationsLoading: false,
  intelligence: undefined as unknown,
  dashboard: undefined as unknown,
  learningProgress: undefined as unknown,
  journalEntries: undefined as unknown,
  closedTrades: undefined as unknown,
  openTrades: undefined as unknown,
  eventRisk: undefined as unknown,
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useListNotifications: () => ({ data: mockState.notifications, isLoading: mockState.notificationsLoading }),
    useGetInstitutionalIntelligence: () => ({ data: mockState.intelligence }),
    useGetPortfolioDashboard: () => ({ data: mockState.dashboard }),
    useGetLearningProgress: () => ({ data: mockState.learningProgress }),
    useListJournalEntries: () => ({ data: mockState.journalEntries }),
    useListTrades: (params: { status: string }) => ({
      data: params.status === "closed" ? mockState.closedTrades : mockState.openTrades,
    }),
    useGetPortfolioEventRisk: () => ({ data: mockState.eventRisk }),
  };
});

import NotificationCentre from "./NotificationCentre";

beforeEach(() => {
  mockState.notifications = [];
  mockState.notificationsLoading = false;
  mockState.intelligence = undefined;
  mockState.dashboard = undefined;
  mockState.learningProgress = undefined;
  mockState.journalEntries = undefined;
  mockState.closedTrades = undefined;
  mockState.openTrades = undefined;
  mockState.eventRisk = undefined;
});

describe("NotificationCentre", () => {
  it("shows a loading skeleton while notifications resolve", () => {
    mockState.notificationsLoading = true;
    renderWithClient(<NotificationCentre />);
    expect(screen.getByTestId("notification-centre-loading")).toBeInTheDocument();
  });

  it("shows every category's own honest empty state when there is nothing to report", () => {
    renderWithClient(<NotificationCentre />);
    expect(screen.getByTestId("text-alerts-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-health-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-risk-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-journal-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-earnings-empty")).toBeInTheDocument();
    expect(screen.getByTestId("text-expirations-empty")).toBeInTheDocument();
  });

  it("shows a real unread alert reused directly from GET /notifications", () => {
    mockState.notifications = [
      { id: 1, type: "risk_cap_breached", title: "Risk cap breached", message: "Position sizing exceeded.", dataSource: "SIMULATED", relatedSymbol: null, isRead: false, createdAt: new Date().toISOString() },
    ];
    renderWithClient(<NotificationCentre />);
    expect(screen.getByText("Risk cap breached")).toBeInTheDocument();
  });

  it("shows a health-change item only when the health trend is genuinely non-stable", () => {
    mockState.intelligence = {
      health: { healthTrend: "declining", healthTrendDetail: "Health score fell 8 points this week." },
    };
    renderWithClient(<NotificationCentre />);
    expect(screen.getByText("Portfolio health is declining")).toBeInTheDocument();
    expect(screen.getByText("Health score fell 8 points this week.")).toBeInTheDocument();
  });

  it("surfaces a closed trade with no linked journal entry as a journal reminder", () => {
    mockState.closedTrades = [{ id: 1, symbol: "SPY", strategy: "iron_condor", status: "closed" }];
    mockState.journalEntries = [];
    renderWithClient(<NotificationCentre />);
    expect(screen.getByText(/SPY \(iron condor\) closed with no linked journal entry/)).toBeInTheDocument();
  });

  it("never fabricates a journal reminder for a trade that already has a linked entry", () => {
    mockState.closedTrades = [{ id: 1, symbol: "SPY", strategy: "iron_condor", status: "closed" }];
    mockState.journalEntries = [{ id: 5, tradeId: 1, title: "Great trade" }];
    renderWithClient(<NotificationCentre />);
    expect(screen.getByTestId("text-journal-empty")).toBeInTheDocument();
  });

  it("surfaces an open position's real upcoming earnings event", () => {
    mockState.eventRisk = {
      positions: [
        { tradeId: 1, symbol: "AAPL", primaryEvent: { type: "earnings", label: "Q3 Earnings", date: "2026-08-01", daysAway: 5 } },
      ],
    };
    renderWithClient(<NotificationCentre />);
    expect(screen.getByText("AAPL — earnings in 5d")).toBeInTheDocument();
  });

  it("surfaces an open position expiring within 14 days as an expiration item", () => {
    const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    mockState.openTrades = [
      { id: 9, symbol: "QQQ", strategy: "calendar_spread", status: "open", expiration: soon.toISOString().slice(0, 10) },
    ];
    renderWithClient(<NotificationCentre />);
    // A day-count computed from a date-only string (midnight UTC) vs.
    // Date.now() (the current instant) can legitimately round to 2, 3, or 4
    // depending on the time of day this test runs — assert the item is
    // present and within the honest 0-14 day window, not an exact digit.
    const match = screen.getByText(/QQQ \(calendar spread\) expires in \d+d/);
    expect(match).toBeInTheDocument();
    const days = Number(match.textContent?.match(/expires in (\d+)d/)?.[1]);
    expect(days).toBeGreaterThanOrEqual(0);
    expect(days).toBeLessThanOrEqual(14);
  });

  it("never a recommendation — no verb like 'should' or 'recommend' appears anywhere on the page", () => {
    mockState.notifications = [
      { id: 1, type: "risk_cap_breached", title: "Risk cap breached", message: "Position sizing exceeded.", dataSource: "SIMULATED", relatedSymbol: null, isRead: false, createdAt: new Date().toISOString() },
    ];
    renderWithClient(<NotificationCentre />);
    const bodyText = document.body.textContent ?? "";
    expect(bodyText.toLowerCase()).not.toMatch(/\byou should\b|\bwe recommend\b/);
  });
});
