// v1.3.1 — AI Trading Coach, Frontend UI. The sidebar-nav-reachable
// full-page surface — a thin wrapper around TradingCoachWorkspace, so this
// file only proves the page shell renders and the exact same Workspace
// content (already fully tested in TradingCoachWorkspace.test.tsx) mounts
// correctly here too, with no `onClose` control (there is nothing to close
// — this is a real, permanent page, not a dismissible panel).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithClient } from "@/test/test-utils";

vi.mock("@/lib/coach-stream", () => ({ streamCoach: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>(
    "@workspace/api-client-react",
  );
  return {
    ...actual,
    useGetUnifiedTradingCoachMessages: () => ({ data: [], isLoading: false }),
  };
});

import AITradingCoach from "./AITradingCoach";

beforeEach(() => {
  window.history.pushState(null, "", "/ai-trading-coach");
});

describe("AITradingCoach page", () => {
  it("renders the page shell and the full Coach workspace", () => {
    renderWithClient(<AITradingCoach />);
    expect(screen.getByTestId("page-ai-trading-coach")).toBeInTheDocument();
    expect(screen.getByTestId("trading-coach-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("trading-coach-header")).toBeInTheDocument();
  });

  it("shows no close control — this is a permanent page, not a dismissible panel", () => {
    renderWithClient(<AITradingCoach />);
    expect(screen.queryByTestId("button-trading-coach-close")).not.toBeInTheDocument();
  });

  it("shows the honest empty state before any conversation exists", () => {
    renderWithClient(<AITradingCoach />);
    expect(screen.getByTestId("trading-coach-empty")).toBeInTheDocument();
  });
});
