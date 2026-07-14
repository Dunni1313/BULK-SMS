// Phase 4, Sprint 56 — Alerts & Notifications. Follows this codebase's own
// established reliable test pattern (vi.hoisted() + top-level vi.mock() +
// a static import — see src/test/page-test-pattern.guardrail.test.ts and
// its reference, src/pages/Trades.test.tsx).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  notifications: [] as unknown[],
  checkMutate: vi.fn(),
  updateMutate: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useListNotifications: () => ({ data: mockState.notifications }),
    useCheckNotifications: () => ({ mutate: mockState.checkMutate, isPending: false }),
    useUpdateNotification: () => ({ mutate: mockState.updateMutate, isPending: false }),
  };
});

import { NotificationBell } from "./NotificationBell";

function notification(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    type: "watchlist_target_crossed",
    title: "AAPL: buy price target reached",
    message: "AAPL is now at $195.50, at or below your desired buy price of $200.00.",
    dataSource: "SIMULATED",
    relatedSymbol: "AAPL",
    isRead: false,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe("NotificationBell", () => {
  beforeEach(() => {
    mockState.notifications = [];
    mockState.checkMutate.mockReset();
    mockState.updateMutate.mockReset();
  });

  it("shows no unread badge when there are no notifications", () => {
    renderWithClient(<NotificationBell />);
    expect(screen.queryByTestId("badge-notification-unread-count")).not.toBeInTheDocument();
  });

  it("shows the unread count badge, counting only unread notifications", () => {
    mockState.notifications = [notification({ id: 1, isRead: false }), notification({ id: 2, isRead: true }), notification({ id: 3, isRead: false })];
    renderWithClient(<NotificationBell />);
    expect(screen.getByTestId("badge-notification-unread-count")).toHaveTextContent("2");
  });

  it("shows an honest empty message in the popover when there are no notifications", async () => {
    const user = userEvent.setup();
    renderWithClient(<NotificationBell />);
    await user.click(screen.getByTestId("button-notification-bell"));
    expect(await screen.findByTestId("text-notifications-empty")).toBeInTheDocument();
  });

  it("renders each notification's title, message, and data source badge in the popover", async () => {
    mockState.notifications = [notification()];
    const user = userEvent.setup();
    renderWithClient(<NotificationBell />);
    await user.click(screen.getByTestId("button-notification-bell"));

    const item = await screen.findByTestId("notification-item-1");
    expect(within(item).getByText("AAPL: buy price target reached")).toBeInTheDocument();
    expect(within(item).getByText(/at or below your desired buy price/i)).toBeInTheDocument();
    expect(within(item).getByText("SIMULATED")).toBeInTheDocument();
  });

  it("clicking 'Mark read' on an unread notification submits the correct mutation payload", async () => {
    mockState.notifications = [notification({ id: 7, isRead: false })];
    const user = userEvent.setup();
    renderWithClient(<NotificationBell />);
    await user.click(screen.getByTestId("button-notification-bell"));

    await user.click(await screen.findByTestId("button-mark-read-7"));
    expect(mockState.updateMutate).toHaveBeenCalledWith(
      { id: 7, data: { isRead: true } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("never shows a 'Mark read' action for an already-read notification", async () => {
    mockState.notifications = [notification({ id: 8, isRead: true })];
    const user = userEvent.setup();
    renderWithClient(<NotificationBell />);
    await user.click(screen.getByTestId("button-notification-bell"));

    await screen.findByTestId("notification-item-8");
    expect(screen.queryByTestId("button-mark-read-8")).not.toBeInTheDocument();
  });

  it("clicking 'Check now' triggers the check-notifications mutation", async () => {
    const user = userEvent.setup();
    renderWithClient(<NotificationBell />);
    await user.click(screen.getByTestId("button-notification-bell"));

    await user.click(await screen.findByTestId("button-check-notifications-now"));
    expect(mockState.checkMutate).toHaveBeenCalled();
  });
});
