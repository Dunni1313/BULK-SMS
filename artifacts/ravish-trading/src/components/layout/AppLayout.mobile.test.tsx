// v1.1.0 — Sidebar Navigation Redesign. Mobile-drawer-specific behavior:
// the sidebar renders as a Sheet (components/ui/sidebar.tsx's own
// isMobile branch, unmodified) when useIsMobile() reports true, and per
// the redesign spec must close itself once a route is selected. Kept in
// its own file (mirroring this codebase's own established convention of
// isolating a whole-file hook mock, e.g. coach-slowload.test.ts vs.
// coach-level.test.ts) since forcing "mobile" for every test in this file
// would break AppLayout.test.tsx's own desktop-mode assertions.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useListTradeAdjustments: () => ({ data: [] }),
    useListNotifications: () => ({ data: [] }),
    useCheckNotifications: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateNotification: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock("@/lib/auth-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-client")>("@/lib/auth-client");
  return {
    ...actual,
    useSession: () => ({ data: null }),
  };
});

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

import { AppLayout } from "./AppLayout";

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState(null, "", "/");
});

describe("AppLayout — sidebar mobile drawer (v1.1.0)", () => {
  it("starts closed on mobile, and opening it via the header trigger reveals the nav links", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    expect(screen.queryByTestId("sidebar-link-/trades")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-toggle-compact-sidebar"));
    await waitFor(() => expect(screen.getByTestId("sidebar-link-/trades")).toBeInTheDocument());
  });

  it("closes the drawer after a route is selected", async () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    fireEvent.click(screen.getByTestId("button-toggle-compact-sidebar"));
    await waitFor(() => expect(screen.getByTestId("sidebar-link-/trades")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("sidebar-link-/trades"));
    await waitFor(() => expect(screen.queryByTestId("sidebar-link-/trades")).not.toBeInTheDocument());
  });

  it("keeps search available regardless of the drawer's open/closed state", () => {
    renderWithClient(
      <AppLayout>
        <div>page content</div>
      </AppLayout>,
    );
    // The global search trigger lives in the header, outside the Sheet.
    expect(screen.getByTestId("button-open-command-palette")).toBeInTheDocument();
  });
});
