// Phase 42 — Institutional Portfolio Monitoring & Compliance Engine.
import { Router, type IRouter } from "express";
import {
  GetMonitoringComplianceDashboardResponse,
  ListCompliancePolicyTypesResponse,
  ListCompliancePoliciesResponse,
  CreateCompliancePolicyBody,
  GetCompliancePolicyResponse,
  UpdateCompliancePolicyBody,
  UpdateCompliancePolicyResponse,
  DeleteCompliancePolicyResponse,
  ListComplianceCoachTopicsResponse,
  GetComplianceCoachTopicResponse,
  ListComplianceLearningResponse,
  GetComplianceLearningResponse,
} from "@workspace/api-zod";
import { getScopedUserId } from "../lib/tenantScope.js";
import { buildMonitoringComplianceDashboard } from "../lib/complianceEngine.js";
import { POLICY_TYPE_META, POLICY_TYPES, listPolicies, getPolicy, createPolicy, updatePolicy, deletePolicy } from "../lib/compliancePolicies.js";
import type { CompliancePolicyRow } from "@workspace/db";
import { allComplianceTopics, explainComplianceTopic } from "../lib/complianceCoach.js";
import { allComplianceLearning, getComplianceLearning } from "../lib/complianceLearning.js";

const router: IRouter = Router();

function policyToJson(row: CompliancePolicyRow) {
  return {
    id: row.id,
    policyType: row.policyType,
    label: row.label,
    targetKey: row.targetKey,
    direction: row.direction,
    limitValue: row.limitValue,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

router.get("/compliance/dashboard", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const dashboard = await buildMonitoringComplianceDashboard(userId);
  res.json(GetMonitoringComplianceDashboardResponse.parse(dashboard));
});

router.get("/compliance/policy-types", async (_req, res): Promise<void> => {
  res.json(ListCompliancePolicyTypesResponse.parse(POLICY_TYPE_META));
});

router.get("/compliance/policies", async (req, res): Promise<void> => {
  const userId = await getScopedUserId(req);
  const rows = await listPolicies(userId);
  res.json(ListCompliancePoliciesResponse.parse(rows.map(policyToJson)));
});

router.post("/compliance/policies", async (req, res): Promise<void> => {
  const parsed = CreateCompliancePolicyBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!(POLICY_TYPES as readonly string[]).includes(parsed.data.policyType)) {
    res.status(400).json({ error: `Unknown policy type: ${parsed.data.policyType}` });
    return;
  }
  const userId = await getScopedUserId(req);
  const row = await createPolicy(userId, parsed.data);
  res.status(201).json(GetCompliancePolicyResponse.parse(policyToJson(row)));
});

router.get("/compliance/policies/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid policy id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const row = await getPolicy(userId, id);
  if (!row) {
    res.status(404).json({ error: "Policy not found" });
    return;
  }
  res.json(GetCompliancePolicyResponse.parse(policyToJson(row)));
});

router.patch("/compliance/policies/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid policy id" });
    return;
  }
  const parsed = UpdateCompliancePolicyBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = await getScopedUserId(req);
  const row = await updatePolicy(userId, id, parsed.data);
  if (!row) {
    res.status(404).json({ error: "Policy not found" });
    return;
  }
  res.json(UpdateCompliancePolicyResponse.parse(policyToJson(row)));
});

router.delete("/compliance/policies/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid policy id" });
    return;
  }
  const userId = await getScopedUserId(req);
  const deleted = await deletePolicy(userId, id);
  if (!deleted) {
    res.status(404).json({ error: "Policy not found" });
    return;
  }
  res.json(DeleteCompliancePolicyResponse.parse({ success: true }));
});

router.get("/compliance/coach", async (_req, res): Promise<void> => {
  res.json(ListComplianceCoachTopicsResponse.parse(allComplianceTopics()));
});

router.get("/compliance/coach/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const explanation = explainComplianceTopic(topic);
  if (!explanation) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetComplianceCoachTopicResponse.parse(explanation));
});

router.get("/compliance/learning", async (_req, res): Promise<void> => {
  res.json(ListComplianceLearningResponse.parse(allComplianceLearning()));
});

router.get("/compliance/learning/:topic", async (req, res): Promise<void> => {
  const topic = Array.isArray(req.params.topic) ? req.params.topic[0] : req.params.topic;
  const learning = getComplianceLearning(topic);
  if (!learning) {
    res.status(404).json({ error: "Unknown coach topic" });
    return;
  }
  res.json(GetComplianceLearningResponse.parse(learning));
});

export default router;
