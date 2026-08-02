// v1.5.0 Sprint 9 — AI Strategy Builder. Rendering/interaction coverage
// for the generic, reusable checklist-generation component — explicit
// generate button (never called automatically), honest unavailable
// state, item rendering, and the local-only (never persisted) checkbox
// toggling.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ListChecks } from "lucide-react";
import { StrategyChecklist } from "./StrategyChecklist";

describe("StrategyChecklist", () => {
  it("does not call onGenerate automatically on mount", () => {
    const onGenerate = vi.fn();
    render(<StrategyChecklist title="Setup checklist" icon={ListChecks} onGenerate={onGenerate} />);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("calls onGenerate when the button is clicked and renders no result before that", () => {
    const onGenerate = vi.fn().mockResolvedValue({ available: true, items: ["Confirm trend", "Check volume"] });
    render(<StrategyChecklist title="Setup checklist" icon={ListChecks} onGenerate={onGenerate} testId="checklist" />);
    expect(screen.queryByTestId("checklist-result")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("checklist-generate"));
    expect(onGenerate).toHaveBeenCalled();
  });

  it("renders each item once the checklist resolves", async () => {
    const onGenerate = vi.fn().mockResolvedValue({ available: true, items: ["Confirm trend", "Check volume"] });
    render(<StrategyChecklist title="Setup checklist" icon={ListChecks} onGenerate={onGenerate} testId="checklist" />);
    fireEvent.click(screen.getByTestId("checklist-generate"));

    expect(await screen.findByTestId("checklist-item-0")).toHaveTextContent("Confirm trend");
    expect(screen.getByTestId("checklist-item-1")).toHaveTextContent("Check volume");
  });

  it("honestly shows an unavailable message rather than fabricating items", async () => {
    const onGenerate = vi.fn().mockResolvedValue({ available: false, items: [] });
    render(<StrategyChecklist title="Setup checklist" icon={ListChecks} onGenerate={onGenerate} testId="checklist" />);
    fireEvent.click(screen.getByTestId("checklist-generate"));
    expect(await screen.findByTestId("checklist-unavailable")).toBeInTheDocument();
  });

  it("toggling an item's checkbox marks it as checked, purely as local UI state", async () => {
    const onGenerate = vi.fn().mockResolvedValue({ available: true, items: ["Confirm trend"] });
    render(<StrategyChecklist title="Setup checklist" icon={ListChecks} onGenerate={onGenerate} testId="checklist" />);
    fireEvent.click(screen.getByTestId("checklist-generate"));
    await screen.findByTestId("checklist-item-0");

    const checkbox = screen.getByTestId("checklist-item-check-0");
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    await waitFor(() => expect(checkbox).toBeChecked());
  });
});
