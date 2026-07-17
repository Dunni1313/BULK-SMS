// Phase 10 — Institutional Platform Polish & Control Center. The
// Workspace System + Personal Dashboard's own backing routes. Every
// query is ownership-scoped via getScopedUserId(req) and the established
// and(eq(id), eq(userId)) pattern — 404, never a separate 403, matching
// every user-authored-resource route in this codebase since Sprint 7.
//
// Zero trading, execution, pricing, portfolio, or risk calculations —
// this route only reads/writes UI layout preferences.

import { Router, type IRouter } from "express";
import {
  ListWorkspacesResponse,
  GetActiveWorkspaceResponse,
  CreateWorkspaceBody,
  UpdateWorkspaceBody,
  UpdateWorkspaceResponse,
  DuplicateWorkspaceBody,
  ActivateWorkspaceResponse,
} from "@workspace/api-zod";

// Orval deduplicates structurally-identical response schemas under one
// generated name — the create/duplicate/activate responses are all the
// same shape as UpdateWorkspaceResponse, so it's reused directly here
// rather than referencing names Orval never actually generated (the
// established "rename, don't fight the generator" precedent since
// Sprint 28/39/40/56).
const CreateWorkspaceResponse = UpdateWorkspaceResponse;
const DuplicateWorkspaceResponse = UpdateWorkspaceResponse;
import {
  listWorkspaces,
  getOrCreateActiveWorkspace,
  createWorkspace,
  updateWorkspace,
  duplicateWorkspace,
  deleteWorkspace,
  activateWorkspace,
} from "../lib/dashboardWorkspaces.js";
import { getScopedUserId } from "../lib/tenantScope.js";

const router: IRouter = Router();

function parseId(raw: unknown): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = parseInt(String(value), 10);
  return Number.isNaN(id) ? null : id;
}

router.get("/workspaces", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await listWorkspaces(userId);
  res.json(ListWorkspacesResponse.parse(rows));
});

router.get("/workspaces/active", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const row = await getOrCreateActiveWorkspace(userId);
  res.json(GetActiveWorkspaceResponse.parse(row));
});

router.post("/workspaces", async (req, res): Promise<void> => {
  const parsed = CreateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  try {
    const row = await createWorkspace(userId, parsed.data.name, parsed.data.widgetConfig);
    res.status(201).json(CreateWorkspaceResponse.parse(row));
  } catch (err) {
    // A duplicate (userId, name) violates the partial-independent unique
    // index — surface it as an honest 409, never a generic 500.
    res.status(409).json({ error: `A workspace named "${parsed.data.name}" already exists.` });
    void err;
  }
});

router.patch("/workspaces/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  try {
    const row = await updateWorkspace(userId, id, parsed.data);
    if (!row) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    res.json(UpdateWorkspaceResponse.parse(row));
  } catch (err) {
    res.status(409).json({ error: "A workspace with that name already exists." });
    void err;
  }
});

router.post("/workspaces/:id/duplicate", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = DuplicateWorkspaceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  try {
    const row = await duplicateWorkspace(userId, id, parsed.data.name);
    if (!row) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }
    res.status(201).json(DuplicateWorkspaceResponse.parse(row));
  } catch (err) {
    res.status(409).json({ error: `A workspace named "${parsed.data.name}" already exists.` });
    void err;
  }
});

router.delete("/workspaces/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const outcome = await deleteWorkspace(userId, id);
  if (outcome === "not_found") {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }
  if (outcome === "is_last") {
    res.status(400).json({ error: "Cannot delete your only remaining workspace." });
    return;
  }
  res.status(204).send();
});

router.post("/workspaces/:id/activate", async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const row = await activateWorkspace(userId, id);
  if (!row) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }
  res.json(ActivateWorkspaceResponse.parse(row));
});

export default router;
