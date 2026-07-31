// v1.5.0, Sprint 18 — Institutional Playbooks & Operating Procedures Engine.
//
// Client-side persistence for a user's own "manual" playbook stage
// acknowledgements — mirrors lib/workflow-dismissals.ts's own established
// localStorage pattern exactly (Sprint 16), for the exact same reason:
// this platform has no per-user server-side store for this kind of
// lightweight, per-browser UI state, and building one would mean adding a
// new database table for a sprint whose own explicit scope says "NOT
// another database." Reads/writes are wrapped defensively — private
// browsing, storage quota, or a non-browser test environment must never
// throw.
//
// A "manual" playbook stage (see lib/playbooks.ts's own PlaybookStage
// .signalType) has no real platform signal behind it — there is no
// database table tracking "did you hold the weekly investment committee
// meeting." Acknowledging one of these stages is therefore always a
// self-certified, honest opt-in, never presented as an automatically
// verified reading — see playbookProgress.ts's own status vocabulary.
//
// Keyed by `${playbookId}:${stageId}` (never a per-entity id, unlike
// workflow-dismissals.ts's own per-entity WorkflowTask.id) — a manual
// playbook stage is a process-cadence acknowledgement, not bound to one
// specific Trade Plan or Notebook.

const PLAYBOOK_ACKNOWLEDGEMENTS_STORAGE_KEY = "dk-playbook-stage-acknowledgements";

function isValidAckList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export function loadPlaybookAcknowledgements(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(PLAYBOOK_ACKNOWLEDGEMENTS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!isValidAckList(parsed)) return new Set();
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveAcks(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLAYBOOK_ACKNOWLEDGEMENTS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage unavailable — the acknowledgement simply doesn't persist
    // across a reload this session; the playbook itself keeps working.
  }
}

export function playbookStageAckKey(playbookId: string, stageId: string): string {
  return `${playbookId}:${stageId}`;
}

export function acknowledgePlaybookStage(playbookId: string, stageId: string): void {
  const ids = loadPlaybookAcknowledgements();
  ids.add(playbookStageAckKey(playbookId, stageId));
  saveAcks(ids);
}

export function unacknowledgePlaybookStage(playbookId: string, stageId: string): void {
  const ids = loadPlaybookAcknowledgements();
  ids.delete(playbookStageAckKey(playbookId, stageId));
  saveAcks(ids);
}
