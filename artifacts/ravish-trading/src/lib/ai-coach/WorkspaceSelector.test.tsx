// v1.5.0 Sprint 7 — AI Workspaces. Rendering/interaction coverage for the
// compact workspace switcher.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceSelector } from "./WorkspaceSelector";
import type { AiWorkspace } from "./workspacesApi";

function workspace(overrides: Partial<AiWorkspace> = {}): AiWorkspace {
  return {
    id: 1,
    coachId: "trading",
    name: "Q3 research",
    description: null,
    pinned: false,
    archived: false,
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("WorkspaceSelector", () => {
  it("renders a 'no workspace' option plus one option per workspace", () => {
    render(
      <WorkspaceSelector
        workspaces={[workspace({ id: 1, name: "Alpha" }), workspace({ id: 2, name: "Beta" })]}
        activeWorkspaceId={null}
        onChange={() => {}}
      />,
    );
    const select = screen.getByTestId("workspace-selector") as HTMLSelectElement;
    expect(select.options).toHaveLength(3);
    expect(select.options[0].textContent).toBe("All conversations");
    expect(select.options[1].textContent).toBe("Alpha");
    expect(select.options[2].textContent).toBe("Beta");
  });

  it("reflects the active workspace as the selected value", () => {
    render(<WorkspaceSelector workspaces={[workspace({ id: 5, name: "Selected" })]} activeWorkspaceId={5} onChange={() => {}} />);
    const select = screen.getByTestId("workspace-selector") as HTMLSelectElement;
    expect(select.value).toBe("5");
  });

  it("calls onChange with the numeric workspace id when a workspace is selected", () => {
    const onChange = vi.fn();
    render(<WorkspaceSelector workspaces={[workspace({ id: 7, name: "Pick me" })]} activeWorkspaceId={null} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("workspace-selector"), { target: { value: "7" } });
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it("calls onChange with null when 'All conversations' is selected", () => {
    const onChange = vi.fn();
    render(<WorkspaceSelector workspaces={[workspace({ id: 7 })]} activeWorkspaceId={7} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("workspace-selector"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("excludes archived workspaces from the option list", () => {
    render(
      <WorkspaceSelector
        workspaces={[workspace({ id: 1, name: "Active one" }), workspace({ id: 2, name: "Archived one", archived: true })]}
        activeWorkspaceId={null}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByText("Archived one")).not.toBeInTheDocument();
    expect(screen.getByText("Active one")).toBeInTheDocument();
  });

  it("supports a custom 'no workspace' label", () => {
    render(<WorkspaceSelector workspaces={[]} activeWorkspaceId={null} onChange={() => {}} noneLabel="Everything" />);
    expect(screen.getByText("Everything")).toBeInTheDocument();
  });
});
