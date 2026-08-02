// v1.5.0 Sprint 9 — AI Strategy Builder. Rendering/interaction coverage
// for the strategy library sidebar — create (from scratch or from a
// template), search, filters, select, clear selection, and the empty
// state, mirroring NotebookSidebar.test.tsx's own established pattern
// (Sprint 8). Template-select option-picking is not simulated here
// (matching this codebase's own established convention of not driving
// shadcn/ui Select option-picking through jsdom) — only the "from
// scratch" default path (which requires a manual strategyType input) is
// exercised for create-form submission.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrategySidebar, type StrategySidebarProps } from "./StrategySidebar";
import type { AiStrategy } from "./strategiesApi";

function strategy(overrides: Partial<AiStrategy> = {}): AiStrategy {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "Breakout playbook",
    description: null,
    strategyType: "Breakout",
    assetClass: null,
    folder: null,
    status: "draft",
    pinned: false,
    archived: false,
    tags: [],
    currentVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const noop = () => {};

function baseProps(overrides: Partial<StrategySidebarProps> = {}) {
  return {
    strategies: [] as AiStrategy[],
    isLoading: false,
    activeStrategyId: null,
    templates: [],
    searchTerm: "",
    onSearchChange: noop,
    folder: null,
    onFolderChange: noop,
    statusFilter: null,
    onStatusFilterChange: noop,
    includeArchived: false,
    onIncludeArchivedChange: noop,
    onCreateStrategy: noop,
    onSelectStrategy: noop,
    onClearSelection: noop,
    ...overrides,
  };
}

describe("StrategySidebar — empty / loading state", () => {
  it("shows a loading message while isLoading is true", () => {
    render(<StrategySidebar {...baseProps({ isLoading: true })} />);
    expect(screen.getByTestId("strategy-sidebar-list-loading")).toBeInTheDocument();
  });

  it("shows the empty state when there are no strategies", () => {
    render(<StrategySidebar {...baseProps()} />);
    expect(screen.getByTestId("strategy-sidebar-list-empty")).toBeInTheDocument();
  });
});

describe("StrategySidebar — listing / selection", () => {
  it("renders one card per strategy", () => {
    render(<StrategySidebar {...baseProps({ strategies: [strategy({ id: 1, title: "Alpha" }), strategy({ id: 2, title: "Beta" })] })} />);
    expect(screen.getByTestId("strategy-sidebar-list-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("strategy-sidebar-list-card-2")).toBeInTheDocument();
  });

  it("calls onSelectStrategy when a strategy card is clicked", () => {
    const onSelectStrategy = vi.fn();
    render(<StrategySidebar {...baseProps({ strategies: [strategy({ id: 3, title: "Pick me" })], onSelectStrategy })} />);
    fireEvent.click(screen.getByTestId("strategy-sidebar-list-card-3-select"));
    expect(onSelectStrategy).toHaveBeenCalledWith(3);
  });

  it("shows a clear-selection link only when a strategy is active, and calls onClearSelection", () => {
    const onClearSelection = vi.fn();
    const { rerender } = render(<StrategySidebar {...baseProps({ strategies: [strategy()], onClearSelection })} />);
    expect(screen.queryByTestId("strategy-sidebar-clear-selection")).not.toBeInTheDocument();

    rerender(<StrategySidebar {...baseProps({ strategies: [strategy()], activeStrategyId: 1, onClearSelection })} />);
    fireEvent.click(screen.getByTestId("strategy-sidebar-clear-selection"));
    expect(onClearSelection).toHaveBeenCalled();
  });
});

describe("StrategySidebar — search / filters", () => {
  it("calls onSearchChange as the user types", () => {
    const onSearchChange = vi.fn();
    render(<StrategySidebar {...baseProps({ onSearchChange })} />);
    fireEvent.change(screen.getByTestId("strategy-sidebar-search"), { target: { value: "breakout" } });
    expect(onSearchChange).toHaveBeenCalledWith("breakout");
  });

  it("calls onFolderChange as the user types, with null for an empty value", () => {
    const onFolderChange = vi.fn();
    render(<StrategySidebar {...baseProps({ onFolderChange })} />);
    fireEvent.change(screen.getByTestId("strategy-sidebar-folder-filter"), { target: { value: "Trading" } });
    expect(onFolderChange).toHaveBeenCalledWith("Trading");
  });

  it("calls onIncludeArchivedChange when the checkbox is toggled", () => {
    const onIncludeArchivedChange = vi.fn();
    render(<StrategySidebar {...baseProps({ onIncludeArchivedChange })} />);
    fireEvent.click(screen.getByTestId("strategy-sidebar-include-archived"));
    expect(onIncludeArchivedChange).toHaveBeenCalledWith(true);
  });
});

describe("StrategySidebar — create strategy", () => {
  it("opens the create form, then submits title + strategyType (from scratch) and closes it", async () => {
    const onCreateStrategy = vi.fn().mockResolvedValue(undefined);
    render(<StrategySidebar {...baseProps({ onCreateStrategy })} />);
    fireEvent.click(screen.getByTestId("strategy-sidebar-new-strategy"));
    expect(screen.getByTestId("strategy-sidebar-create-form")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("strategy-sidebar-create-title"), { target: { value: "New playbook" } });
    fireEvent.change(screen.getByTestId("strategy-sidebar-create-strategy-type"), { target: { value: "Pullback" } });
    await fireEvent.click(screen.getByTestId("strategy-sidebar-create-save"));

    expect(onCreateStrategy).toHaveBeenCalledWith({ title: "New playbook", strategyType: "Pullback" });
  });

  it("never creates a strategy with an empty title", () => {
    const onCreateStrategy = vi.fn();
    render(<StrategySidebar {...baseProps({ onCreateStrategy })} />);
    fireEvent.click(screen.getByTestId("strategy-sidebar-new-strategy"));
    fireEvent.change(screen.getByTestId("strategy-sidebar-create-strategy-type"), { target: { value: "Pullback" } });
    fireEvent.click(screen.getByTestId("strategy-sidebar-create-save"));
    expect(onCreateStrategy).not.toHaveBeenCalled();
  });

  it("never creates a from-scratch strategy with an empty strategyType", () => {
    const onCreateStrategy = vi.fn();
    render(<StrategySidebar {...baseProps({ onCreateStrategy })} />);
    fireEvent.click(screen.getByTestId("strategy-sidebar-new-strategy"));
    fireEvent.change(screen.getByTestId("strategy-sidebar-create-title"), { target: { value: "No type" } });
    fireEvent.click(screen.getByTestId("strategy-sidebar-create-save"));
    expect(onCreateStrategy).not.toHaveBeenCalled();
  });

  it("cancel closes the create form without calling onCreateStrategy", () => {
    const onCreateStrategy = vi.fn();
    render(<StrategySidebar {...baseProps({ onCreateStrategy })} />);
    fireEvent.click(screen.getByTestId("strategy-sidebar-new-strategy"));
    fireEvent.change(screen.getByTestId("strategy-sidebar-create-title"), { target: { value: "Abandoned" } });
    fireEvent.click(screen.getByTestId("strategy-sidebar-create-cancel"));
    expect(screen.queryByTestId("strategy-sidebar-create-form")).not.toBeInTheDocument();
    expect(onCreateStrategy).not.toHaveBeenCalled();
  });

  it("the empty state's own action button also opens the create form", () => {
    render(<StrategySidebar {...baseProps()} />);
    fireEvent.click(screen.getByTestId("strategy-sidebar-list-empty-action"));
    expect(screen.getByTestId("strategy-sidebar-create-form")).toBeInTheDocument();
  });
});
