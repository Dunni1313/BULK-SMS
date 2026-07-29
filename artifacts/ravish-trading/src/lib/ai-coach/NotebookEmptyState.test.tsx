// v1.5.0 Sprint 8 — AI Research Notebooks. Rendering coverage for the
// notebook-flavoured wrapper over WorkspaceEmptyState (Sprint 7) —
// confirms the reuse actually renders and defaults sensibly.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotebookEmptyState } from "./NotebookEmptyState";

describe("NotebookEmptyState", () => {
  it("renders sensible defaults when no props are given", () => {
    render(<NotebookEmptyState />);
    expect(screen.getByText("No notebooks yet")).toBeInTheDocument();
    expect(screen.getByText("Collect, organise, and refine your AI research in one place.")).toBeInTheDocument();
  });

  it("renders a caller-supplied title and description", () => {
    render(<NotebookEmptyState title="No notebook selected" description="Pick one on the left." />);
    expect(screen.getByText("No notebook selected")).toBeInTheDocument();
    expect(screen.getByText("Pick one on the left.")).toBeInTheDocument();
  });

  it("renders no action button when actionLabel/onAction are omitted", () => {
    render(<NotebookEmptyState />);
    expect(screen.queryByTestId("notebook-empty-state-action")).not.toBeInTheDocument();
  });

  it("renders and wires up an action button when provided", () => {
    const onAction = vi.fn();
    render(<NotebookEmptyState actionLabel="Create one" onAction={onAction} />);
    fireEvent.click(screen.getByTestId("notebook-empty-state-action"));
    expect(onAction).toHaveBeenCalled();
  });

  it("supports a caller-supplied testId prefix", () => {
    render(<NotebookEmptyState testId="custom-empty" />);
    expect(screen.getByTestId("custom-empty")).toBeInTheDocument();
  });
});
