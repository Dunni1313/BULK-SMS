// v1.5.0 Sprint 7 — AI Workspaces. A compact workspace switcher — for
// placement at the top of a coach panel when the full WorkspaceSidebar
// isn't shown (or as a quick-switch alongside it). Deliberately a plain
// native <select> rather than the app's Radix-based Select component: this
// is a simple, single-value picker with no need for the richer
// popover/portal behavior, and a native element is trivially and reliably
// testable via fireEvent.change — no portal/pointer-capture quirks.

import type { AiWorkspace } from "./workspacesApi";

export interface WorkspaceSelectorProps {
  workspaces: AiWorkspace[];
  activeWorkspaceId: number | null;
  onChange: (id: number | null) => void;
  /** Label for the "no workspace" option — defaults to "All conversations". */
  noneLabel?: string;
  testId?: string;
}

export function WorkspaceSelector({
  workspaces,
  activeWorkspaceId,
  onChange,
  noneLabel = "All conversations",
  testId = "workspace-selector",
}: WorkspaceSelectorProps) {
  return (
    <select
      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground"
      value={activeWorkspaceId ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      data-testid={testId}
      aria-label="Workspace"
    >
      <option value="">{noneLabel}</option>
      {workspaces
        .filter((w) => !w.archived)
        .map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
    </select>
  );
}
