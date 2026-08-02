// v1.5.0 Sprint 9 — AI Strategy Builder. Rendering coverage for the
// strategy-flavoured wrapper over WorkspaceEmptyState (Sprint 7) —
// confirms the reuse actually renders and defaults sensibly, mirroring
// NotebookEmptyState.test.tsx's own established pattern (Sprint 8).

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrategyEmptyState } from "./StrategyEmptyState";

describe("StrategyEmptyState", () => {
  it("renders sensible defaults when no props are given", () => {
    render(<StrategyEmptyState />);
    expect(screen.getByText("No strategies yet")).toBeInTheDocument();
    expect(screen.getByText(/reusable, structured playbook/i)).toBeInTheDocument();
  });

  it("renders a caller-supplied title and description", () => {
    render(<StrategyEmptyState title="No strategy selected" description="Pick one on the left." />);
    expect(screen.getByText("No strategy selected")).toBeInTheDocument();
    expect(screen.getByText("Pick one on the left.")).toBeInTheDocument();
  });

  it("renders no action button when actionLabel/onAction are omitted", () => {
    render(<StrategyEmptyState />);
    expect(screen.queryByTestId("strategy-empty-state-action")).not.toBeInTheDocument();
  });

  it("renders and wires up an action button when provided", () => {
    const onAction = vi.fn();
    render(<StrategyEmptyState actionLabel="Create one" onAction={onAction} />);
    fireEvent.click(screen.getByTestId("strategy-empty-state-action"));
    expect(onAction).toHaveBeenCalled();
  });

  it("supports a caller-supplied testId prefix", () => {
    render(<StrategyEmptyState testId="custom-empty" />);
    expect(screen.getByTestId("custom-empty")).toBeInTheDocument();
  });
});
