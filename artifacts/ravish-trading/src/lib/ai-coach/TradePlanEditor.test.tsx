// v1.5.0 Sprint 10 — Institutional Trade Planner. Rendering/interaction
// coverage for the trade plan editor — the 18 qualitative playbook
// sections (inline edit/save, honest "not defined yet" empty state) and
// the 3 reference-kind sections (attachments/research references/
// notebook references: add, list, delete), mirroring
// StrategyEditor.test.tsx's own established pattern (Sprint 9). Dropdown-
// based "link a notebook/conversation" or "reference a workspace file"
// selection is not simulated here, matching this codebase's own
// established convention of not driving shadcn/ui Select option-picking
// through jsdom — only the trigger's presence/absence is asserted.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TradePlanEditor } from "./TradePlanEditor";
import type { TradePlanDetail } from "./tradePlansApi";

function detail(overrides: Partial<TradePlanDetail> = {}): TradePlanDetail {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    strategyId: null,
    title: "Breakout Long",
    plannedAsset: "AAPL",
    assetClass: null,
    direction: "long",
    status: "draft",
    pinned: false,
    tags: [],
    currentVersion: 1,
    executedTradeRef: null,
    executedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
    sections: [],
    versions: [],
    checklistItems: [],
    checklistProgress: { totalItems: 0, completedItems: 0, requiredItems: 0, completedRequiredItems: 0, progressPct: 0, readyForEntry: false },
    ...overrides,
  };
}

const noopAsync = async () => {};

describe("TradePlanEditor — qualitative sections", () => {
  it("shows an honest 'not defined yet' message for a section with no content", () => {
    render(<TradePlanEditor plan={detail()} onUpsertSection={noopAsync} onDeleteSection={noopAsync} />);
    expect(screen.getByTestId("trade-plan-editor-section-entry_zone-empty")).toBeInTheDocument();
  });

  it("renders existing section content", () => {
    render(
      <TradePlanEditor
        plan={detail({
          sections: [
            { id: 1, tradePlanId: 1, kind: "entry_zone", content: "Enter on breakout confirmation", notebook: null, conversation: null, file: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
          ],
        })}
        onUpsertSection={noopAsync}
        onDeleteSection={noopAsync}
      />,
    );
    expect(screen.getByTestId("trade-plan-editor-section-entry_zone-content")).toHaveTextContent("Enter on breakout confirmation");
  });

  it("editing a section calls onUpsertSection with the kind and typed content", () => {
    const onUpsertSection = vi.fn();
    render(<TradePlanEditor plan={detail()} onUpsertSection={onUpsertSection} onDeleteSection={noopAsync} />);
    fireEvent.click(screen.getByTestId("trade-plan-editor-section-stop_loss-edit-toggle"));
    fireEvent.change(screen.getByTestId("trade-plan-editor-section-stop_loss-input"), { target: { value: "Below the swing low" } });
    fireEvent.click(screen.getByTestId("trade-plan-editor-section-stop_loss-save"));
    expect(onUpsertSection).toHaveBeenCalledWith({ kind: "stop_loss", content: "Below the swing low" });
  });

  it("never saves an empty section", () => {
    const onUpsertSection = vi.fn();
    render(<TradePlanEditor plan={detail()} onUpsertSection={onUpsertSection} onDeleteSection={noopAsync} />);
    fireEvent.click(screen.getByTestId("trade-plan-editor-section-stop_loss-edit-toggle"));
    fireEvent.click(screen.getByTestId("trade-plan-editor-section-stop_loss-save"));
    expect(onUpsertSection).not.toHaveBeenCalled();
  });

  it("cancel closes the edit form without saving", () => {
    const onUpsertSection = vi.fn();
    render(<TradePlanEditor plan={detail()} onUpsertSection={onUpsertSection} onDeleteSection={noopAsync} />);
    fireEvent.click(screen.getByTestId("trade-plan-editor-section-stop_loss-edit-toggle"));
    fireEvent.change(screen.getByTestId("trade-plan-editor-section-stop_loss-input"), { target: { value: "Abandoned" } });
    fireEvent.click(screen.getByTestId("trade-plan-editor-section-stop_loss-cancel"));
    expect(screen.queryByTestId("trade-plan-editor-section-stop_loss-input")).not.toBeInTheDocument();
    expect(onUpsertSection).not.toHaveBeenCalled();
  });
});

describe("TradePlanEditor — attachments", () => {
  it("shows an honest empty message when nothing is attached", () => {
    render(<TradePlanEditor plan={detail()} onUpsertSection={noopAsync} onDeleteSection={noopAsync} />);
    expect(screen.getByTestId("trade-plan-editor-attachments-empty")).toBeInTheDocument();
  });

  it("submits a freehand attachment", () => {
    const onUpsertSection = vi.fn();
    render(<TradePlanEditor plan={detail()} onUpsertSection={onUpsertSection} onDeleteSection={noopAsync} />);
    fireEvent.change(screen.getByTestId("trade-plan-editor-attachment-input"), { target: { value: "Chart screenshot" } });
    fireEvent.click(screen.getByTestId("trade-plan-editor-attachment-save"));
    expect(onUpsertSection).toHaveBeenCalledWith({ kind: "attachment", content: "Chart screenshot" });
  });

  it("calls onDeleteSection with the section id when removing an attachment", () => {
    const onDeleteSection = vi.fn();
    render(
      <TradePlanEditor
        plan={detail({
          sections: [{ id: 1, tradePlanId: 1, kind: "attachment", content: "Chart screenshot", notebook: null, conversation: null, file: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
        })}
        onUpsertSection={noopAsync}
        onDeleteSection={onDeleteSection}
      />,
    );
    fireEvent.click(screen.getByTestId("trade-plan-editor-attachment-delete-1"));
    expect(onDeleteSection).toHaveBeenCalledWith(1);
  });
});

describe("TradePlanEditor — research references", () => {
  it("shows an honest empty message when none are added", () => {
    render(<TradePlanEditor plan={detail()} onUpsertSection={noopAsync} onDeleteSection={noopAsync} />);
    expect(screen.getByTestId("trade-plan-editor-research-references-empty")).toBeInTheDocument();
  });

  it("submits a research reference", () => {
    const onUpsertSection = vi.fn();
    render(<TradePlanEditor plan={detail()} onUpsertSection={onUpsertSection} onDeleteSection={noopAsync} />);
    fireEvent.change(screen.getByTestId("trade-plan-editor-research-reference-input"), { target: { value: "https://example.com/article" } });
    fireEvent.click(screen.getByTestId("trade-plan-editor-research-reference-save"));
    expect(onUpsertSection).toHaveBeenCalledWith({ kind: "research_reference", content: "https://example.com/article" });
  });
});

describe("TradePlanEditor — notebook references (Linked Notebook)", () => {
  it("shows an honest empty message when nothing is referenced", () => {
    render(<TradePlanEditor plan={detail()} onUpsertSection={noopAsync} onDeleteSection={noopAsync} />);
    expect(screen.getByTestId("trade-plan-editor-notebook-refs-empty")).toBeInTheDocument();
  });

  it("renders a referenced notebook's title", () => {
    render(
      <TradePlanEditor
        plan={detail({
          sections: [{ id: 1, tradePlanId: 1, kind: "notebook_reference", content: null, notebook: { id: 9, title: "Research notebook" }, conversation: null, file: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
        })}
        onUpsertSection={noopAsync}
        onDeleteSection={noopAsync}
      />,
    );
    expect(screen.getByTestId("trade-plan-editor-notebook-ref-1")).toHaveTextContent("Research notebook");
  });

  it("shows the 'link a notebook' picker only when linkable notebooks are available", () => {
    const { rerender } = render(<TradePlanEditor plan={detail()} onUpsertSection={noopAsync} onDeleteSection={noopAsync} linkableNotebooks={[]} />);
    expect(screen.queryByTestId("trade-plan-editor-link-notebook-select")).not.toBeInTheDocument();

    rerender(
      <TradePlanEditor plan={detail()} onUpsertSection={noopAsync} onDeleteSection={noopAsync} linkableNotebooks={[{ id: 2, title: "Available notebook" }]} />,
    );
    expect(screen.getByTestId("trade-plan-editor-link-notebook-select")).toBeInTheDocument();
  });
});
