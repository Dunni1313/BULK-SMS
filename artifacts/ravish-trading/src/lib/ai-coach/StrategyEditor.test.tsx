// v1.5.0 Sprint 9 — AI Strategy Builder. Rendering/interaction coverage
// for the strategy editor — the 14 qualitative playbook sections
// (inline edit/save, honest "not defined yet" empty state) and the 3
// reference-kind sections (attachments/research links/notebook
// references: add, list, delete). Dropdown-based "link a notebook/
// conversation" or "reference a workspace file" selection is not
// simulated here, matching NotebookEditor.test.tsx's own established
// convention of not driving shadcn/ui Select option-picking through
// jsdom — only the trigger's presence/absence is asserted.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrategyEditor } from "./StrategyEditor";
import type { AiStrategyDetail } from "./strategiesApi";

function detail(overrides: Partial<AiStrategyDetail> = {}): AiStrategyDetail {
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
    updatedAt: new Date().toISOString(),
    sections: [],
    versions: [],
    ...overrides,
  };
}

const noopAsync = async () => {};

describe("StrategyEditor — qualitative sections", () => {
  it("shows an honest 'not defined yet' message for a section with no content", () => {
    render(<StrategyEditor strategy={detail()} onUpsertSection={noopAsync} onDeleteSection={noopAsync} />);
    expect(screen.getByTestId("strategy-editor-section-entry-empty")).toBeInTheDocument();
  });

  it("renders existing section content", () => {
    render(
      <StrategyEditor
        strategy={detail({
          sections: [{ id: 1, strategyId: 1, kind: "entry", content: "Enter on breakout confirmation", notebook: null, conversation: null, file: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
        })}
        onUpsertSection={noopAsync}
        onDeleteSection={noopAsync}
      />,
    );
    expect(screen.getByTestId("strategy-editor-section-entry-content")).toHaveTextContent("Enter on breakout confirmation");
  });

  it("editing a section calls onUpsertSection with the kind and typed content", () => {
    const onUpsertSection = vi.fn();
    render(<StrategyEditor strategy={detail()} onUpsertSection={onUpsertSection} onDeleteSection={noopAsync} />);
    fireEvent.click(screen.getByTestId("strategy-editor-section-risk-edit-toggle"));
    fireEvent.change(screen.getByTestId("strategy-editor-section-risk-input"), { target: { value: "Never risk more than 1%" } });
    fireEvent.click(screen.getByTestId("strategy-editor-section-risk-save"));
    expect(onUpsertSection).toHaveBeenCalledWith({ kind: "risk", content: "Never risk more than 1%" });
  });

  it("never saves an empty section", () => {
    const onUpsertSection = vi.fn();
    render(<StrategyEditor strategy={detail()} onUpsertSection={onUpsertSection} onDeleteSection={noopAsync} />);
    fireEvent.click(screen.getByTestId("strategy-editor-section-risk-edit-toggle"));
    fireEvent.click(screen.getByTestId("strategy-editor-section-risk-save"));
    expect(onUpsertSection).not.toHaveBeenCalled();
  });

  it("cancel closes the edit form without saving", () => {
    const onUpsertSection = vi.fn();
    render(<StrategyEditor strategy={detail()} onUpsertSection={onUpsertSection} onDeleteSection={noopAsync} />);
    fireEvent.click(screen.getByTestId("strategy-editor-section-risk-edit-toggle"));
    fireEvent.change(screen.getByTestId("strategy-editor-section-risk-input"), { target: { value: "Abandoned" } });
    fireEvent.click(screen.getByTestId("strategy-editor-section-risk-cancel"));
    expect(screen.queryByTestId("strategy-editor-section-risk-input")).not.toBeInTheDocument();
    expect(onUpsertSection).not.toHaveBeenCalled();
  });
});

describe("StrategyEditor — attachments", () => {
  it("shows an honest empty message when nothing is attached", () => {
    render(<StrategyEditor strategy={detail()} onUpsertSection={noopAsync} onDeleteSection={noopAsync} />);
    expect(screen.getByTestId("strategy-editor-attachments-empty")).toBeInTheDocument();
  });

  it("submits a freehand attachment", () => {
    const onUpsertSection = vi.fn();
    render(<StrategyEditor strategy={detail()} onUpsertSection={onUpsertSection} onDeleteSection={noopAsync} />);
    fireEvent.change(screen.getByTestId("strategy-editor-attachment-input"), { target: { value: "Backtest results.xlsx" } });
    fireEvent.click(screen.getByTestId("strategy-editor-attachment-save"));
    expect(onUpsertSection).toHaveBeenCalledWith({ kind: "attachment", content: "Backtest results.xlsx" });
  });

  it("renders an attachment referencing a workspace file by its file name", () => {
    render(
      <StrategyEditor
        strategy={detail({
          sections: [{ id: 1, strategyId: 1, kind: "attachment", content: null, notebook: null, conversation: null, file: { id: 4, fileName: "10-K.pdf", fileUrl: "https://example.com/10-k.pdf" }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
        })}
        onUpsertSection={noopAsync}
        onDeleteSection={noopAsync}
      />,
    );
    expect(screen.getByTestId("strategy-editor-attachment-1")).toHaveTextContent("10-K.pdf");
  });

  it("calls onDeleteSection with the section id when removing an attachment", () => {
    const onDeleteSection = vi.fn();
    render(
      <StrategyEditor
        strategy={detail({
          sections: [{ id: 1, strategyId: 1, kind: "attachment", content: "Backtest results.xlsx", notebook: null, conversation: null, file: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
        })}
        onUpsertSection={noopAsync}
        onDeleteSection={onDeleteSection}
      />,
    );
    fireEvent.click(screen.getByTestId("strategy-editor-attachment-delete-1"));
    expect(onDeleteSection).toHaveBeenCalledWith(1);
  });
});

describe("StrategyEditor — research links", () => {
  it("shows an honest empty message when none are added", () => {
    render(<StrategyEditor strategy={detail()} onUpsertSection={noopAsync} onDeleteSection={noopAsync} />);
    expect(screen.getByTestId("strategy-editor-research-links-empty")).toBeInTheDocument();
  });

  it("submits a research link", () => {
    const onUpsertSection = vi.fn();
    render(<StrategyEditor strategy={detail()} onUpsertSection={onUpsertSection} onDeleteSection={noopAsync} />);
    fireEvent.change(screen.getByTestId("strategy-editor-research-link-input"), { target: { value: "https://example.com/article" } });
    fireEvent.click(screen.getByTestId("strategy-editor-research-link-save"));
    expect(onUpsertSection).toHaveBeenCalledWith({ kind: "research_link", content: "https://example.com/article" });
  });

  it("renders multiple research links as external links", () => {
    render(
      <StrategyEditor
        strategy={detail({
          sections: [
            { id: 1, strategyId: 1, kind: "research_link", content: "https://example.com/a", notebook: null, conversation: null, file: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
            { id: 2, strategyId: 1, kind: "research_link", content: "https://example.com/b", notebook: null, conversation: null, file: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
          ],
        })}
        onUpsertSection={noopAsync}
        onDeleteSection={noopAsync}
      />,
    );
    expect(screen.getByTestId("strategy-editor-research-link-1")).toBeInTheDocument();
    expect(screen.getByTestId("strategy-editor-research-link-2")).toBeInTheDocument();
  });
});

describe("StrategyEditor — notebook references", () => {
  it("shows an honest empty message when nothing is referenced", () => {
    render(<StrategyEditor strategy={detail()} onUpsertSection={noopAsync} onDeleteSection={noopAsync} />);
    expect(screen.getByTestId("strategy-editor-notebook-refs-empty")).toBeInTheDocument();
  });

  it("renders a referenced notebook's title", () => {
    render(
      <StrategyEditor
        strategy={detail({
          sections: [{ id: 1, strategyId: 1, kind: "notebook_reference", content: null, notebook: { id: 9, title: "Research notebook" }, conversation: null, file: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
        })}
        onUpsertSection={noopAsync}
        onDeleteSection={noopAsync}
      />,
    );
    expect(screen.getByTestId("strategy-editor-notebook-ref-1")).toHaveTextContent("Research notebook");
  });

  it("shows the 'link a notebook' picker only when linkable notebooks are available", () => {
    const { rerender } = render(<StrategyEditor strategy={detail()} onUpsertSection={noopAsync} onDeleteSection={noopAsync} linkableNotebooks={[]} />);
    expect(screen.queryByTestId("strategy-editor-link-notebook-select")).not.toBeInTheDocument();

    rerender(
      <StrategyEditor strategy={detail()} onUpsertSection={noopAsync} onDeleteSection={noopAsync} linkableNotebooks={[{ id: 2, title: "Available notebook" }]} />,
    );
    expect(screen.getByTestId("strategy-editor-link-notebook-select")).toBeInTheDocument();
  });
});
