// Phase 42 — Institutional Portfolio Monitoring & Compliance Engine.
//
// PURE PRESENTATION LAYER over already-computed, already-tested backend
// data (lib/complianceEngine.ts, lib/compliancePolicies.ts). Monitoring
// only. No trade recommendations, no buy/sell signals, no portfolio
// optimisation, no auto rebalancing, no auto execution, no AI predictions,
// no forecasting, no machine learning, no broker integration changes.
//
// Every figure is a direct read from:
//   - GET /compliance/dashboard      — the full Compliance Summary, every
//     category-grouped limit, Policy Violations, and the Compliance
//     Timeline (reused from the Risk & Exposure Engine's own Concentration
//     Timeline).
//   - GET /compliance/policy-types   — the fixed, documented set of policy
//     types this phase implements, with suggested default values.
//   - GET/POST/PATCH/DELETE /compliance/policies — the user's own
//     configurable Policy Engine.
//   - GET /compliance/coach          — the deterministic AI Coach.
//   - GET /compliance/learning       — Learning Centre integration.
//   - GET /reporting/compliance-report,
//     GET /reporting/policy-monitoring-report — Reporting Centre links.

import { useState, useMemo } from "react";
import { Link } from "wouter";
import {
  useGetMonitoringComplianceDashboard,
  getGetMonitoringComplianceDashboardQueryKey,
  useListCompliancePolicyTypes,
  useListCompliancePolicies,
  getListCompliancePoliciesQueryKey,
  useCreateCompliancePolicy,
  useUpdateCompliancePolicy,
  useDeleteCompliancePolicy,
  useListComplianceCoachTopics,
  useListComplianceLearning,
} from "@workspace/api-client-react";
import type { CompliancePolicyEvaluation, CompliancePolicyTypeMeta } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, GraduationCap, FileBarChart2, ShieldCheck, ListChecks, GraduationCap as LearnIcon } from "lucide-react";

function fmt(n: number | null | undefined, unit: CompliancePolicyTypeMeta["unit"] | undefined): string {
  if (n == null) return "—";
  if (unit === "usd") return `$${n.toLocaleString()}`;
  if (unit === "pct") return `${n}%`;
  return `${n}`;
}

function statusBadgeClass(status: string): string {
  if (status === "compliant") return "border-emerald-500/40 text-emerald-400";
  if (status === "breach") return "border-red-500/40 text-red-400";
  return "border-border text-muted-foreground";
}

function EvaluationRow({ e }: { e: CompliancePolicyEvaluation }) {
  return (
    <div className="flex items-center justify-between text-xs" data-testid={`evaluation-${e.policyId}`}>
      <span className="truncate pr-2">
        {e.label}
        {e.targetKey ? <span className="text-muted-foreground"> ({e.targetKey})</span> : null}
      </span>
      <span className="text-muted-foreground whitespace-nowrap">
        current {e.currentValue ?? "—"} / limit {e.limitValue}
      </span>
      <Badge variant="outline" className={`text-[10px] ml-2 ${statusBadgeClass(e.status)}`}>
        {e.status}
      </Badge>
    </div>
  );
}

function LimitSection({ title, description, evaluations, testId }: { title: string; description?: string; evaluations: CompliancePolicyEvaluation[]; testId: string }) {
  return (
    <Card className="bg-card border-border" data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-1.5">
        {evaluations.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-testid={`${testId}-empty`}>
            No policy configured for this category yet.
          </p>
        ) : (
          evaluations.map((e) => <EvaluationRow key={e.policyId} e={e} />)
        )}
      </CardContent>
    </Card>
  );
}

export default function MonitoringComplianceEngine() {
  const dashboardQuery = useGetMonitoringComplianceDashboard({ query: { queryKey: getGetMonitoringComplianceDashboardQueryKey() } });
  const policyTypesQuery = useListCompliancePolicyTypes();
  const policiesQuery = useListCompliancePolicies({ query: { queryKey: getListCompliancePoliciesQueryKey() } });
  const coachQuery = useListComplianceCoachTopics();
  const learningQuery = useListComplianceLearning();
  const queryClient = useQueryClient();

  const createMutation = useCreateCompliancePolicy();
  const updateMutation = useUpdateCompliancePolicy();
  const deleteMutation = useDeleteCompliancePolicy();

  const dashboard = dashboardQuery.data;
  const policyTypes = policyTypesQuery.data ?? [];
  const policies = policiesQuery.data ?? [];

  const [selectedType, setSelectedType] = useState<string>("");
  const [targetKey, setTargetKey] = useState<string>("");
  const [limitValue, setLimitValue] = useState<string>("");

  const selectedMeta = useMemo(() => policyTypes.find((t) => t.policyType === selectedType) ?? null, [policyTypes, selectedType]);

  function invalidatePolicies() {
    queryClient.invalidateQueries({ queryKey: getListCompliancePoliciesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetMonitoringComplianceDashboardQueryKey() });
  }

  function selectType(policyType: string) {
    setSelectedType(policyType);
    const meta = policyTypes.find((t) => t.policyType === policyType);
    setLimitValue(meta ? String(meta.defaultLimitValue) : "");
    setTargetKey("");
  }

  function createPolicy() {
    if (!selectedMeta) return;
    const v = Number(limitValue);
    if (Number.isNaN(v)) return;
    createMutation.mutate(
      {
        data: {
          policyType: selectedMeta.policyType,
          label: selectedMeta.label,
          targetKey: targetKey.trim() === "" ? undefined : targetKey.trim(),
          direction: selectedMeta.direction,
          limitValue: v,
        },
      },
      { onSuccess: invalidatePolicies },
    );
  }

  function toggleEnabled(id: number, enabled: boolean) {
    updateMutation.mutate({ id, data: { enabled } }, { onSuccess: invalidatePolicies });
  }

  function deletePolicy(id: number) {
    deleteMutation.mutate({ id }, { onSuccess: invalidatePolicies });
  }

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="monitoring-compliance-engine">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-amber-400" /> Institutional Portfolio Monitoring & Compliance Engine
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Continuously evaluate portfolio state against user-defined policies, allocation limits, concentration thresholds and risk rules. Monitoring only — no trade
          recommendations, no buy/sell signals, no portfolio optimisation, no auto rebalancing, no auto execution, no AI predictions, no forecasting, no machine learning.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="mce-labels">
          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
            Monitoring & Compliance
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Monitoring Only — No Recommendations
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard" data-testid="tab-mce-dashboard">
            <ShieldCheck className="w-4 h-4 mr-1" /> Compliance Dashboard
          </TabsTrigger>
          <TabsTrigger value="policies" data-testid="tab-mce-policies">
            <ListChecks className="w-4 h-4 mr-1" /> Policy Configuration
          </TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-mce-learning">
            <GraduationCap className="w-4 h-4 mr-1" /> Coach & Learning
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-mce-reporting">
            <FileBarChart2 className="w-4 h-4 mr-1" /> Reporting
          </TabsTrigger>
        </TabsList>

        {/* ─── Compliance Dashboard ───────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {dashboardQuery.isLoading ? (
            <Skeleton className="h-96" />
          ) : dashboardQuery.isError || !dashboard ? (
            <p className="text-xs text-destructive flex items-center gap-1" data-testid="mce-dashboard-error">
              <AlertTriangle className="w-3.5 h-3.5" /> Unable to load the Monitoring & Compliance dashboard.
            </p>
          ) : (
            <>
              <Card className="bg-card border-border" data-testid="panel-mce-summary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Compliance Summary</CardTitle>
                  <CardDescription className="text-xs">{dashboard.complianceSummary.summary}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total policies</p>
                    <p className="text-sm">{dashboard.complianceSummary.totalPolicies}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Compliant</p>
                    <p className="text-sm text-emerald-400">{dashboard.complianceSummary.compliantCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Breach</p>
                    <p className="text-sm text-red-400">{dashboard.complianceSummary.breachCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Overall status</p>
                    <Badge variant="outline" className={`text-[10px] ${dashboard.complianceSummary.overallStatus === "breach" ? "border-red-500/40 text-red-400" : dashboard.complianceSummary.overallStatus === "compliant" ? "border-emerald-500/40 text-emerald-400" : "border-border text-muted-foreground"}`}>
                      {dashboard.complianceSummary.overallStatus.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-mce-violations">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Policy Violations</CardTitle>
                  <CardDescription className="text-xs">Deterministic observations only — never a recommended action.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {dashboard.policyViolations.length === 0 ? (
                    <p className="text-xs text-muted-foreground" data-testid="mce-violations-empty">
                      No enabled policy is currently in breach.
                    </p>
                  ) : (
                    dashboard.policyViolations.map((e) => <EvaluationRow key={e.policyId} e={e} />)
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <LimitSection title="Allocation Limits" evaluations={dashboard.allocationLimits} testId="panel-mce-allocation-limits" />
                <LimitSection title="Sector Limits" evaluations={dashboard.sectorLimits} testId="panel-mce-sector-limits" />
                <LimitSection title="Asset Limits" evaluations={dashboard.assetLimits} testId="panel-mce-asset-limits" />
                <LimitSection title="Position Limits" evaluations={dashboard.positionLimits} testId="panel-mce-position-limits" />
                <LimitSection title="Strategy Limits" evaluations={dashboard.strategyLimits} testId="panel-mce-strategy-limits" />
                <LimitSection title="Greeks Limits" evaluations={dashboard.greeksLimits} testId="panel-mce-greeks-limits" />
                <LimitSection title="Buying Power Limits" evaluations={dashboard.buyingPowerLimits} testId="panel-mce-buying-power-limits" />
                <LimitSection title="Income Stability Limits" evaluations={dashboard.incomeStabilityLimits} testId="panel-mce-income-stability-limits" />
                <LimitSection title="Diversification Limits" evaluations={dashboard.diversificationLimits} testId="panel-mce-diversification-limits" />
              </div>

              <Card className="bg-card border-border" data-testid="panel-mce-timeline">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Compliance Timeline</CardTitle>
                  <CardDescription className="text-xs">{dashboard.complianceTimelineNote}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {dashboard.complianceTimeline.length === 0 ? (
                    <p className="text-xs text-muted-foreground" data-testid="mce-timeline-empty">
                      No historical data points yet.
                    </p>
                  ) : (
                    dashboard.complianceTimeline.map((t, i) => (
                      <div key={`${t.date}-${i}`} className="text-xs">
                        <span className="text-muted-foreground">
                          {t.date} [{t.source}]:
                        </span>{" "}
                        {t.detail}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Policy Configuration ───────────────────────────────────────── */}
        <TabsContent value="policies" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-mce-new-policy">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">New Policy</CardTitle>
              <CardDescription className="text-xs">
                Suggested default values are reused from the same named caps used elsewhere in the platform. Every value is yours to accept or edit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedType} onValueChange={selectType}>
                <SelectTrigger className="bg-background" data-testid="new-policy-type-select">
                  <SelectValue placeholder="Select a policy type…" />
                </SelectTrigger>
                <SelectContent>
                  {policyTypes.map((t) => (
                    <SelectItem key={t.policyType} value={t.policyType}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedMeta && (
                <div className="space-y-2" data-testid="new-policy-fields">
                  <p className="text-xs text-muted-foreground">{selectedMeta.description}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-24">Target (optional)</span>
                    <Input
                      className="h-7 w-40 bg-background"
                      placeholder="e.g. AAPL, Technology"
                      value={targetKey}
                      onChange={(e) => setTargetKey(e.target.value)}
                      data-testid="new-policy-target-key"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-24">Limit ({selectedMeta.direction})</span>
                    <Input
                      type="number"
                      className="h-7 w-32 bg-background"
                      value={limitValue}
                      onChange={(e) => setLimitValue(e.target.value)}
                      data-testid="new-policy-limit-value"
                    />
                  </div>
                  <Button size="sm" onClick={createPolicy} disabled={createMutation.isPending} data-testid="new-policy-create-btn">
                    {createMutation.isPending ? "Creating…" : "Create Policy"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border" data-testid="panel-mce-policy-list">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Your Policies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {policiesQuery.isLoading ? (
                <Skeleton className="h-32" />
              ) : policies.length === 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="mce-policies-empty">
                  No compliance policies configured yet.
                </p>
              ) : (
                policies.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs border-b border-border pb-2 last:border-0" data-testid={`policy-row-${p.id}`}>
                    <div className="min-w-0">
                      <p className="truncate">
                        {p.label}
                        {p.targetKey ? <span className="text-muted-foreground"> ({p.targetKey})</span> : null}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {p.direction} {p.limitValue}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={p.enabled} onCheckedChange={(checked) => toggleEnabled(p.id, checked)} data-testid={`policy-enabled-${p.id}`} />
                      <Button size="sm" variant="ghost" onClick={() => deletePolicy(p.id)} data-testid={`policy-delete-${p.id}`}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Coach & Learning ───────────────────────────────────────────── */}
        <TabsContent value="learning" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-mce-coach">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">AI Coach</CardTitle>
              <CardDescription className="text-xs">
                Deterministic explanations of portfolio monitoring, compliance concepts, risk limits, capital limits, and governance — never a recommended trade.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {coachQuery.isLoading ? (
                <Skeleton className="h-32" />
              ) : (
                <div className="space-y-3" data-testid="mce-coach-topics">
                  {(coachQuery.data ?? []).map((t) => (
                    <div key={t.topic} data-testid={`mce-coach-topic-${t.topic}`}>
                      <p className="text-sm font-semibold">{t.title}</p>
                      {t.explanation.map((p, i) => (
                        <p key={i} className="text-xs text-muted-foreground mt-1">
                          {p}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border" data-testid="panel-mce-learning">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <LearnIcon className="w-4 h-4" /> Learning Centre — By Topic
              </CardTitle>
              <CardDescription className="text-xs">Existing Learning Centre content connected to each topic. No duplicated content.</CardDescription>
            </CardHeader>
            <CardContent>
              {learningQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-3" data-testid="mce-learning-by-topic">
                  {(learningQuery.data ?? []).map((bundle) => (
                    <div key={bundle.topic} data-testid={`mce-learning-topic-${bundle.topic}`}>
                      <p className="text-xs font-semibold">{bundle.topic.replace(/_/g, " ")}</p>
                      <ul className="space-y-0.5">
                        {bundle.links.map((l) => (
                          <li key={`${l.pathKey}-${l.topicKey}`}>
                            <Link href={l.href} className="text-xs text-primary hover:underline" data-testid={`mce-learning-link-${l.pathKey}-${l.topicKey}`}>
                              {l.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Reporting ───────────────────────────────────────────────────── */}
        <TabsContent value="reporting" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-mce-reporting">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Compliance Reporting</CardTitle>
              <CardDescription className="text-xs">Compliance Report and Policy Monitoring Report, reused from the platform's own Institutional Reporting Centre.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/reporting-centre?reportType=compliance-report" className="text-xs text-primary hover:underline block" data-testid="link-report-compliance-report">
                Generate Compliance Report →
              </Link>
              <Link href="/reporting-centre?reportType=policy-monitoring-report" className="text-xs text-primary hover:underline block" data-testid="link-report-policy-monitoring-report">
                Generate Policy Monitoring Report →
              </Link>
              <Link href="/reporting-centre" className="text-xs text-primary hover:underline block" data-testid="link-reporting-centre">
                Open the Institutional Reporting Centre →
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
