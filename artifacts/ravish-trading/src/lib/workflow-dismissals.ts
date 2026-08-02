// v1.5.0, Sprint 16 — Institutional Workflow Automation Engine.
//
// Client-side persistence for a user's own task dismissals, mirroring
// lib/sidebar-preferences.ts's own established localStorage pattern
// exactly (this platform has no per-user server-side store for this kind
// of lightweight, per-browser UI state — Settings persists trading/
// automation configuration, not workflow-queue chrome). Reads/writes are
// wrapped defensively — private browsing, storage quota, or a non-browser
// test environment must never throw.
//
// A dismissal is keyed by the exact WorkflowTask.id (which is itself
// scoped to the specific entity, e.g. "trade-closed-to-journal:42", never
// the whole automation type) — dismissing one trade plan's journal
// reminder never silently suppresses a different trade plan's own,
// genuinely new reminder later. This is the concrete mechanism behind the
// approved scope's "never hidden automation" workflow rule: a dismissal
// is always a conscious, per-item user action, never a blanket mute.

const WORKFLOW_DISMISSALS_STORAGE_KEY = "dk-workflow-task-dismissals";

function isValidDismissalList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export function loadWorkflowDismissals(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(WORKFLOW_DISMISSALS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!isValidDismissalList(parsed)) return new Set();
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveWorkflowDismissals(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKFLOW_DISMISSALS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage unavailable — the dismissal simply doesn't persist across a
    // reload this session; the task list itself keeps working.
  }
}

export function dismissWorkflowTask(taskId: string): void {
  const ids = loadWorkflowDismissals();
  ids.add(taskId);
  saveWorkflowDismissals(ids);
}

export function undismissWorkflowTask(taskId: string): void {
  const ids = loadWorkflowDismissals();
  ids.delete(taskId);
  saveWorkflowDismissals(ids);
}
