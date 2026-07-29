// v1.5.0 Sprint 10 — Institutional Trade Planner. Rendering/interaction
// coverage for the Checklist Engine's own persistent UI: item rendering
// (required badge, completed strikethrough), the progress bar/percentage,
// completion toggling, adding a hand-written item, deleting an item, and
// applying a named template (Select option-picking itself is not
// simulated, matching this codebase's own established convention — only
// the trigger's presence is asserted).

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradePlanChecklist } from "./TradePlanChecklist";
import type { TradePlanChecklistItem, ChecklistProgress, TradePlanChecklistTemplate } from "./tradePlansApi";

function item(overrides: Partial<TradePlanChecklistItem> = {}): TradePlanChecklistItem {
  return {
    id: 1,
    tradePlanId: 1,
    label: "Confirm entry trigger",
    required: true,
    completed: false,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function progress(overrides: Partial<ChecklistProgress> = {}): ChecklistProgress {
  return { totalItems: 0, completedItems: 0, requiredItems: 0, completedRequiredItems: 0, progressPct: 0, readyForEntry: false, ...overrides };
}

const noop = () => {};

describe("TradePlanChecklist — rendering", () => {
  it("shows an honest empty message with no items", () => {
    render(<TradePlanChecklist items={[]} progress={progress()} onAddItem={noop} onApplyTemplate={noop} onToggleCompleted={noop} onDeleteItem={noop} />);
    expect(screen.getByTestId("trade-plan-checklist-empty")).toBeInTheDocument();
  });

  it("renders each item with its required badge", () => {
    render(
      <TradePlanChecklist
        items={[item({ id: 1, label: "Required item", required: true }), item({ id: 2, label: "Optional item", required: false })]}
        progress={progress({ totalItems: 2, requiredItems: 1 })}
        onAddItem={noop}
        onApplyTemplate={noop}
        onToggleCompleted={noop}
        onDeleteItem={noop}
      />,
    );
    expect(screen.getByText("Required item")).toBeInTheDocument();
    expect(screen.getByTestId("trade-plan-checklist-item-1-required")).toBeInTheDocument();
    expect(screen.getByText("Optional item")).toBeInTheDocument();
    expect(screen.queryByTestId("trade-plan-checklist-item-2-required")).not.toBeInTheDocument();
  });

  it("shows the progress percentage and Ready/Not ready state", () => {
    render(
      <TradePlanChecklist
        items={[item()]}
        progress={progress({ totalItems: 1, completedItems: 1, requiredItems: 1, completedRequiredItems: 1, progressPct: 100, readyForEntry: true })}
        onAddItem={noop}
        onApplyTemplate={noop}
        onToggleCompleted={noop}
        onDeleteItem={noop}
      />,
    );
    expect(screen.getByTestId("trade-plan-checklist-progress-pct")).toHaveTextContent("100% · Ready");
  });
});

describe("TradePlanChecklist — actions", () => {
  it("calls onToggleCompleted with the toggled value", () => {
    const onToggleCompleted = vi.fn();
    render(
      <TradePlanChecklist items={[item({ completed: false })]} progress={progress({ totalItems: 1 })} onAddItem={noop} onApplyTemplate={noop} onToggleCompleted={onToggleCompleted} onDeleteItem={noop} />,
    );
    fireEvent.click(screen.getByTestId("trade-plan-checklist-item-1-checkbox"));
    expect(onToggleCompleted).toHaveBeenCalledWith(1, true);
  });

  it("calls onDeleteItem with the item id", () => {
    const onDeleteItem = vi.fn();
    render(
      <TradePlanChecklist items={[item()]} progress={progress({ totalItems: 1 })} onAddItem={noop} onApplyTemplate={noop} onToggleCompleted={noop} onDeleteItem={onDeleteItem} />,
    );
    fireEvent.click(screen.getByTestId("trade-plan-checklist-item-1-delete"));
    expect(onDeleteItem).toHaveBeenCalledWith(1);
  });

  it("submits a hand-written checklist item with the required flag", () => {
    const onAddItem = vi.fn();
    render(<TradePlanChecklist items={[]} progress={progress()} onAddItem={onAddItem} onApplyTemplate={noop} onToggleCompleted={noop} onDeleteItem={noop} />);
    fireEvent.change(screen.getByTestId("trade-plan-checklist-add-input"), { target: { value: "New item" } });
    fireEvent.click(screen.getByTestId("trade-plan-checklist-add-save"));
    expect(onAddItem).toHaveBeenCalledWith({ label: "New item", required: true });
  });

  it("never adds an item with an empty label", () => {
    const onAddItem = vi.fn();
    render(<TradePlanChecklist items={[]} progress={progress()} onAddItem={onAddItem} onApplyTemplate={noop} onToggleCompleted={noop} onDeleteItem={noop} />);
    fireEvent.click(screen.getByTestId("trade-plan-checklist-add-save"));
    expect(onAddItem).not.toHaveBeenCalled();
  });

  it("shows the template picker only when templates are supplied", () => {
    const templates: TradePlanChecklistTemplate[] = [{ id: "trading-pre-trade", label: "Trading Pre-Trade Checklist", coachId: "trading", description: "", items: [] }];
    const { rerender } = render(<TradePlanChecklist items={[]} progress={progress()} onAddItem={noop} onApplyTemplate={noop} onToggleCompleted={noop} onDeleteItem={noop} />);
    expect(screen.queryByTestId("trade-plan-checklist-template-select")).not.toBeInTheDocument();

    rerender(<TradePlanChecklist items={[]} progress={progress()} templates={templates} onAddItem={noop} onApplyTemplate={noop} onToggleCompleted={noop} onDeleteItem={noop} />);
    expect(screen.getByTestId("trade-plan-checklist-template-select")).toBeInTheDocument();
  });
});
