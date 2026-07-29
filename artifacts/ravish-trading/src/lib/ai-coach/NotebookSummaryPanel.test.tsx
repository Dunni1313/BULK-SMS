// v1.5.0 Sprint 8 — AI Research Notebooks. Rendering/interaction coverage
// for the notebook AI-actions panel — every button is an explicit,
// user-triggered call to one of the 4 AI endpoints; none fires
// automatically, and none saves its own output without a further explicit
// "Save to notebook" click.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotebookSummaryPanel } from "./NotebookSummaryPanel";

describe("NotebookSummaryPanel — nothing runs automatically", () => {
  it("calls none of the 4 AI actions on mount", () => {
    const onSummarize = vi.fn();
    const onMergeNotes = vi.fn();
    const onGenerateTakeaways = vi.fn();
    const onGenerateActionItems = vi.fn();
    render(
      <NotebookSummaryPanel
        onSummarize={onSummarize}
        onMergeNotes={onMergeNotes}
        onGenerateTakeaways={onGenerateTakeaways}
        onGenerateActionItems={onGenerateActionItems}
      />,
    );
    expect(onSummarize).not.toHaveBeenCalled();
    expect(onMergeNotes).not.toHaveBeenCalled();
    expect(onGenerateTakeaways).not.toHaveBeenCalled();
    expect(onGenerateActionItems).not.toHaveBeenCalled();
  });
});

describe("NotebookSummaryPanel — summarise notebook", () => {
  it("calls onSummarize when clicked and renders the result", async () => {
    const onSummarize = vi.fn().mockResolvedValue({ summary: "A concise summary.", source: "llm" });
    render(
      <NotebookSummaryPanel
        onSummarize={onSummarize}
        onMergeNotes={vi.fn()}
        onGenerateTakeaways={vi.fn()}
        onGenerateActionItems={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-summary-panel-summarize-button"));
    expect(onSummarize).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("notebook-summary-panel-summary-result")).toHaveTextContent("A concise summary."));
  });

  it("only shows a 'Save to notebook' action when onSaveAsNote is provided, and calls it with the summary text", async () => {
    const onSaveAsNote = vi.fn();
    render(
      <NotebookSummaryPanel
        onSummarize={vi.fn().mockResolvedValue({ summary: "Save me.", source: "template" })}
        onMergeNotes={vi.fn()}
        onGenerateTakeaways={vi.fn()}
        onGenerateActionItems={vi.fn()}
        onSaveAsNote={onSaveAsNote}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-summary-panel-summarize-button"));
    await waitFor(() => expect(screen.getByTestId("notebook-summary-panel-summary-save")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("notebook-summary-panel-summary-save"));
    expect(onSaveAsNote).toHaveBeenCalledWith("summary", "Save me.");
  });
});

describe("NotebookSummaryPanel — merge notes", () => {
  it("calls onMergeNotes when clicked and renders the result", async () => {
    const onMergeNotes = vi.fn().mockResolvedValue({ summary: "Merged executive summary.", source: "llm" });
    render(
      <NotebookSummaryPanel
        onSummarize={vi.fn()}
        onMergeNotes={onMergeNotes}
        onGenerateTakeaways={vi.fn()}
        onGenerateActionItems={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-summary-panel-merge-button"));
    expect(onMergeNotes).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("notebook-summary-panel-merge-result")).toHaveTextContent("Merged executive summary."));
  });
});

describe("NotebookSummaryPanel — key takeaways", () => {
  it("renders each takeaway with a per-item save action", async () => {
    const onSaveAsNote = vi.fn();
    render(
      <NotebookSummaryPanel
        onSummarize={vi.fn()}
        onMergeNotes={vi.fn()}
        onGenerateTakeaways={vi.fn().mockResolvedValue({ available: true, takeaways: ["First takeaway", "Second takeaway"] })}
        onGenerateActionItems={vi.fn()}
        onSaveAsNote={onSaveAsNote}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-summary-panel-takeaways-button"));
    await waitFor(() => expect(screen.getByTestId("notebook-summary-panel-takeaway-0")).toHaveTextContent("First takeaway"));
    expect(screen.getByTestId("notebook-summary-panel-takeaway-1")).toHaveTextContent("Second takeaway");

    fireEvent.click(screen.getByTestId("notebook-summary-panel-takeaway-save-0"));
    expect(onSaveAsNote).toHaveBeenCalledWith("finding", "First takeaway");
  });

  it("honestly reports unavailable rather than fabricating a list", async () => {
    render(
      <NotebookSummaryPanel
        onSummarize={vi.fn()}
        onMergeNotes={vi.fn()}
        onGenerateTakeaways={vi.fn().mockResolvedValue({ available: false, takeaways: [] })}
        onGenerateActionItems={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-summary-panel-takeaways-button"));
    await waitFor(() => expect(screen.getByTestId("notebook-summary-panel-takeaways-unavailable")).toBeInTheDocument());
  });
});

describe("NotebookSummaryPanel — action items", () => {
  it("renders each action item with a per-item save action", async () => {
    const onSaveAsNote = vi.fn();
    render(
      <NotebookSummaryPanel
        onSummarize={vi.fn()}
        onMergeNotes={vi.fn()}
        onGenerateTakeaways={vi.fn()}
        onGenerateActionItems={vi.fn().mockResolvedValue({ available: true, actionItems: ["Review the 10-K"] })}
        onSaveAsNote={onSaveAsNote}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-summary-panel-action-items-button"));
    await waitFor(() => expect(screen.getByTestId("notebook-summary-panel-action-item-0")).toHaveTextContent("Review the 10-K"));

    fireEvent.click(screen.getByTestId("notebook-summary-panel-action-item-save-0"));
    expect(onSaveAsNote).toHaveBeenCalledWith("action_item", "Review the 10-K");
  });

  it("honestly reports unavailable rather than fabricating a list", async () => {
    render(
      <NotebookSummaryPanel
        onSummarize={vi.fn()}
        onMergeNotes={vi.fn()}
        onGenerateTakeaways={vi.fn()}
        onGenerateActionItems={vi.fn().mockResolvedValue({ available: false, actionItems: [] })}
      />,
    );
    fireEvent.click(screen.getByTestId("notebook-summary-panel-action-items-button"));
    await waitFor(() => expect(screen.getByTestId("notebook-summary-panel-action-items-unavailable")).toBeInTheDocument());
  });
});
