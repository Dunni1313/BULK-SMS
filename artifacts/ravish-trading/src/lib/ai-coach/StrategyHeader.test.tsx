// v1.5.0 Sprint 9 — AI Strategy Builder. Rendering/interaction coverage
// for the strategy header — title/description/strategy type/asset
// class/folder/status display and inline edit, pin/archive/delete
// actions, and the version badge, mirroring NotebookHeader.test.tsx's
// own established pattern (Sprint 8). Status-select option-picking is
// not simulated here (matching this codebase's own established
// convention of not driving shadcn/ui Select option-picking through
// jsdom) — the edit form is submitted with its pre-filled default status.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrategyHeader } from "./StrategyHeader";
import type { AiStrategyDetail } from "./strategiesApi";

function detail(overrides: Partial<AiStrategyDetail> = {}): AiStrategyDetail {
  return {
    id: 1,
    coachId: "trading",
    workspaceId: null,
    title: "Breakout playbook",
    description: "A momentum-driven breakout strategy",
    strategyType: "Breakout",
    assetClass: "equities",
    folder: "Trading",
    status: "draft",
    pinned: false,
    archived: false,
    tags: ["momentum"],
    currentVersion: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
    sections: [],
    versions: [],
    ...overrides,
  };
}

const noop = () => {};

describe("StrategyHeader — rendering", () => {
  it("renders the title, description, strategy type/asset class/folder, tags, and version", () => {
    render(<StrategyHeader strategy={detail()} onUpdate={noop} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} />);
    expect(screen.getByTestId("strategy-header-title")).toHaveTextContent("Breakout playbook");
    expect(screen.getByTestId("strategy-header-description")).toHaveTextContent("A momentum-driven breakout strategy");
    expect(screen.getByTestId("strategy-header-meta")).toHaveTextContent("Breakout · equities · Trading");
    expect(screen.getByText("momentum")).toBeInTheDocument();
    expect(screen.getByTestId("strategy-header-version")).toHaveTextContent("v2");
  });

  it("shows the status badge", () => {
    render(<StrategyHeader strategy={detail({ status: "active" })} onUpdate={noop} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} />);
    expect(screen.getByTestId("strategy-header-status-badge")).toHaveTextContent("Active");
  });

  it("shows an archived badge for an archived strategy", () => {
    render(<StrategyHeader strategy={detail({ archived: true })} onUpdate={noop} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });
});

describe("StrategyHeader — actions", () => {
  it("calls onTogglePin with the toggled value", () => {
    const onTogglePin = vi.fn();
    render(<StrategyHeader strategy={detail({ pinned: false })} onUpdate={noop} onTogglePin={onTogglePin} onToggleArchive={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTestId("strategy-header-pin-toggle"));
    expect(onTogglePin).toHaveBeenCalledWith(true);
  });

  it("calls onToggleArchive with the toggled value", () => {
    const onToggleArchive = vi.fn();
    render(<StrategyHeader strategy={detail({ archived: false })} onUpdate={noop} onTogglePin={noop} onToggleArchive={onToggleArchive} onDelete={noop} />);
    fireEvent.click(screen.getByTestId("strategy-header-archive-toggle"));
    expect(onToggleArchive).toHaveBeenCalledWith(true);
  });

  it("calls onDelete", () => {
    const onDelete = vi.fn();
    render(<StrategyHeader strategy={detail()} onUpdate={noop} onTogglePin={noop} onToggleArchive={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("strategy-header-delete"));
    expect(onDelete).toHaveBeenCalled();
  });

  it("calls onOpenVersionHistory when the version badge is clicked", () => {
    const onOpenVersionHistory = vi.fn();
    render(
      <StrategyHeader strategy={detail()} onUpdate={noop} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} onOpenVersionHistory={onOpenVersionHistory} />,
    );
    fireEvent.click(screen.getByTestId("strategy-header-version"));
    expect(onOpenVersionHistory).toHaveBeenCalled();
  });
});

describe("StrategyHeader — inline edit", () => {
  it("opens the edit form pre-filled, then submits an update with every field", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<StrategyHeader strategy={detail()} onUpdate={onUpdate} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} />);

    fireEvent.click(screen.getByTestId("strategy-header-edit-toggle"));
    expect(screen.getByTestId("strategy-header-edit-title")).toHaveValue("Breakout playbook");
    expect(screen.getByTestId("strategy-header-edit-strategy-type")).toHaveValue("Breakout");

    fireEvent.change(screen.getByTestId("strategy-header-edit-title"), { target: { value: "Renamed playbook" } });
    fireEvent.change(screen.getByTestId("strategy-header-edit-strategy-type"), { target: { value: "Pullback" } });
    await fireEvent.click(screen.getByTestId("strategy-header-edit-save"));

    expect(onUpdate).toHaveBeenCalledWith({
      title: "Renamed playbook",
      description: "A momentum-driven breakout strategy",
      strategyType: "Pullback",
      assetClass: "equities",
      folder: "Trading",
      status: "draft",
    });
  });

  it("never submits with an empty title", () => {
    const onUpdate = vi.fn();
    render(<StrategyHeader strategy={detail()} onUpdate={onUpdate} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTestId("strategy-header-edit-toggle"));
    fireEvent.change(screen.getByTestId("strategy-header-edit-title"), { target: { value: "   " } });
    fireEvent.click(screen.getByTestId("strategy-header-edit-save"));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("cancel closes the edit form without calling onUpdate", () => {
    const onUpdate = vi.fn();
    render(<StrategyHeader strategy={detail()} onUpdate={onUpdate} onTogglePin={noop} onToggleArchive={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTestId("strategy-header-edit-toggle"));
    fireEvent.change(screen.getByTestId("strategy-header-edit-title"), { target: { value: "Abandoned" } });
    fireEvent.click(screen.getByTestId("strategy-header-edit-cancel"));
    expect(screen.queryByTestId("strategy-header-edit-form")).not.toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
