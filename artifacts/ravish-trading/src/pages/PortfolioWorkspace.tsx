// Phase 44 — Institutional Portfolio Workspace & Workflow Center.
//
// PURE PRESENTATION LAYER over already-computed, already-tested backend
// data (lib/portfolioWorkspace.ts, lib/portfolioWorkflows.ts,
// lib/workspacePins.ts). Orchestration and workflow only — no trade
// recommendations, no buy/sell signals, no AI predictions, no portfolio
// optimisation, no auto execution, no auto hedging, no machine learning,
// no market forecasting.
//
// Every figure is a direct read from:
//   - GET /portfolio-workspace/dashboard — Executive Home, Portfolio
//     Snapshot (reused wholesale from the Decision Support Engine),
//     Holdings/Trading/Options/Risk/Performance/Compliance/Watchlists
//     Overview, Recent Reports, Active Workflows, Outstanding Issues.
//   - GET /portfolio-workspace/workflows[/instances] — the Workflow Center
//     catalog and per-user tracked progress.
//   - GET/POST/DELETE /portfolio-workspace/pins[...] — Pinned Resources.
//   - GET/POST /portfolio-workspace/recent-views — Recently Viewed.
//   - GET /portfolio-workspace/quick-actions — the fixed Quick Actions list.
//   - GET /portfolio-workspace/coach — the deterministic AI Coach.
//   - GET /portfolio-workspace/learning — Learning Centre integration.
//   - GET /reporting/portfolio-workspace-summary,
//     GET /reporting/institutional-review-report — Reporting Centre links.

import { useState } from "react";
import { Link } from "wouter";
import {
  useGetPortfolioWorkspaceDashboard,
  useListWorkflowDefinitions,
  useListWorkflowInstances,
  getListWorkflowInstancesQueryKey,
  useStartWorkflowInstance,
  useUpdateWorkflowInstance,
  useDeleteWorkflowInstance,
  useListPinnedResources,
  getListPinnedResourcesQueryKey,
  usePinResource,
  useUnpinResource,
  useListRecentViews,
  getListRecentViewsQueryKey,
  useRecordRecentView,
  useListQuickActions,
  useListWorkspaceCoachTopics,
  useListWorkspaceLearning,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { LayoutDashboard, ListChecks, Pin, GraduationCap, FileBarChart2, Trash2 } from "lucide-react";

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString()}`;
}

function issueSourceBadgeClass(source: string): string {
  if (source === "compliance") return "border-red-500/40 text-red-400";
  if (source === "watchlists") return "border-amber-500/40 text-amber-400";
  return "border-border text-muted-foreground";
}

function DashboardTab() {
  const { data, isLoading, isError } = useGetPortfolioWorkspaceDashboard();

  if (isLoading) return <Skeleton className="h-64 w-full" data-testid="workspace-dashboard-loading" />;
  if (isError || !data) return <p className="text-sm text-destructive" data-testid="workspace-dashboard-error">Failed to load the Portfolio Workspace dashboard.</p>;

  return (
    <div className="space-y-4">
      <Card data-testid="card-executive-home">
        <CardHeader>
          <CardTitle className="text-base">Executive Home</CardTitle>
          <CardDescription>{data.executiveHome.summary}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Overall Health</p>
            <p className="font-semibold">{data.executiveHome.overallHealthScore ?? "n/a"}/100</p>
          </div>
          <div>
            <p className="text-muted-foreground">Alerts</p>
            <p className="font-semibold">{data.executiveHome.alertCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Outstanding Issues</p>
            <p className="font-semibold">{data.executiveHome.outstandingIssueCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Investing Holdings</p>
            <p className="font-semibold">{data.executiveHome.investingHoldingsCount}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-holdings-overview">
          <CardHeader>
            <CardTitle className="text-sm">Holdings Overview</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <p className="text-muted-foreground">{data.holdingsOverview.summary}</p>
            <p>Total Market Value: {fmtUsd(data.holdingsOverview.totalMarketValue)}</p>
            <p>Drifted Holdings: {data.holdingsOverview.driftedHoldingsCount}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-trading-overview">
          <CardHeader>
            <CardTitle className="text-sm">Trading Overview</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <p className="text-muted-foreground">{data.tradingOverview.summary}</p>
            <p>Account Value: {fmtUsd(data.tradingOverview.accountValue)}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-options-overview">
          <CardHeader>
            <CardTitle className="text-sm">Options Overview</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <p className="text-muted-foreground">{data.optionsOverview.summary}</p>
            <p>Buying Power: {fmtUsd(data.optionsOverview.buyingPower)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-compliance-overview">
          <CardHeader>
            <CardTitle className="text-sm">Compliance Overview</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <p>
              {data.complianceOverview.complianceSummary.compliantCount} compliant, {data.complianceOverview.complianceSummary.breachCount} breach(es)
            </p>
            <Link href="/monitoring-compliance-engine" className="text-primary hover:underline" data-testid="link-open-monitoring-compliance-engine">
              Open the Monitoring &amp; Compliance Engine →
            </Link>
          </CardContent>
        </Card>
        <Card data-testid="card-watchlists-overview">
          <CardHeader>
            <CardTitle className="text-sm">Watchlists Overview</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <p>{data.watchlistsOverview.watchlists.length} watchlist(s) on record.</p>
            <Link href="/watchlists-engine" className="text-primary hover:underline" data-testid="link-open-watchlists-engine">
              Open the Watchlists &amp; Opportunity Dashboard →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-recent-reports">
        <CardHeader>
          <CardTitle className="text-sm">Recent Reports</CardTitle>
        </CardHeader>
        <CardContent className="text-xs">
          {data.recentReports.totalReports === 0 ? (
            <p className="text-muted-foreground" data-testid="recent-reports-empty">No reports generated yet.</p>
          ) : (
            <ul className="space-y-1">
              {data.recentReports.recentReports.map((r) => (
                <li key={r.id}>
                  {r.title} <span className="text-muted-foreground">({r.reportType})</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-outstanding-issues">
        <CardHeader>
          <CardTitle className="text-sm">Outstanding Issues</CardTitle>
        </CardHeader>
        <CardContent className="text-xs">
          {data.outstandingIssues.length === 0 ? (
            <p className="text-muted-foreground" data-testid="outstanding-issues-empty">No outstanding issues.</p>
          ) : (
            <ul className="space-y-1">
              {data.outstandingIssues.map((issue, idx) => (
                <li key={`${issue.source}-${issue.code}-${idx}`} className="flex items-center gap-2" data-testid={`outstanding-issue-${idx}`}>
                  <Badge variant="outline" className={`text-[10px] ${issueSourceBadgeClass(issue.source)}`}>
                    {issue.source}
                  </Badge>
                  <span>
                    {issue.label}: {issue.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkflowCenterTab() {
  const queryClient = useQueryClient();
  const { data: catalog, isLoading: catalogLoading } = useListWorkflowDefinitions();
  const { data: instances, isLoading: instancesLoading } = useListWorkflowInstances();
  const startMutation = useStartWorkflowInstance();
  const updateMutation = useUpdateWorkflowInstance();
  const deleteMutation = useDeleteWorkflowInstance();

  if (catalogLoading || instancesLoading) return <Skeleton className="h-64 w-full" data-testid="workflow-center-loading" />;

  const activeInstances = (instances ?? []).filter((i) => i.status === "active");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListWorkflowInstancesQueryKey() });
  }

  return (
    <div className="space-y-4">
      <Card data-testid="card-active-workflows">
        <CardHeader>
          <CardTitle className="text-sm">Active Workflows</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-3">
          {activeInstances.length === 0 ? (
            <p className="text-muted-foreground" data-testid="active-workflows-empty">No workflow currently in progress.</p>
          ) : (
            activeInstances.map((instance) => (
              <div key={instance.id} className="border-b border-border pb-2 last:border-0" data-testid={`active-workflow-${instance.id}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{instance.title}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    data-testid={`button-delete-workflow-instance-${instance.id}`}
                    onClick={() => deleteMutation.mutate({ id: instance.id }, { onSuccess: invalidate })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <Progress value={(instance.completedStepKeys.length / Math.max(instance.totalSteps, 1)) * 100} className="h-1.5 mt-1" />
                <p className="text-muted-foreground mt-1">
                  {instance.completedStepKeys.length}/{instance.totalSteps} step(s) completed
                </p>
                <div className="mt-2 space-y-1">
                  {(catalog ?? []).find((w) => w.key === instance.workflowKey)?.steps.map((step) => {
                    const completed = instance.completedStepKeys.includes(step.key);
                    return (
                      <div key={step.key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={completed}
                          data-testid={`checkbox-step-${instance.id}-${step.key}`}
                          onChange={(e) => updateMutation.mutate({ id: instance.id, data: { stepKey: step.key, completed: e.target.checked } }, { onSuccess: invalidate })}
                        />
                        <Link href={step.linkPath} className="hover:underline">
                          {step.label}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-workflow-catalog">
        <CardHeader>
          <CardTitle className="text-sm">Workflow Catalog</CardTitle>
          <CardDescription>Each workflow guides you through existing modules only — no recommendations, no automation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {(catalog ?? []).map((workflow) => (
            <div key={workflow.key} className="flex items-center justify-between border-b border-border pb-2 last:border-0" data-testid={`workflow-catalog-${workflow.key}`}>
              <div>
                <p className="font-semibold">
                  {workflow.title} <span className="text-muted-foreground">({workflow.cadence})</span>
                </p>
                <p className="text-muted-foreground">{workflow.description}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                data-testid={`button-start-workflow-${workflow.key}`}
                onClick={() => startMutation.mutate({ key: workflow.key }, { onSuccess: invalidate })}
              >
                Start
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspaceTab() {
  const queryClient = useQueryClient();
  const { data: pins, isLoading: pinsLoading } = useListPinnedResources();
  const { data: recentViews, isLoading: recentLoading } = useListRecentViews();
  const { data: quickActions, isLoading: quickActionsLoading } = useListQuickActions();
  const unpinMutation = useUnpinResource();
  const pinMutation = usePinResource();
  const recordViewMutation = useRecordRecentView();

  if (pinsLoading || recentLoading || quickActionsLoading) return <Skeleton className="h-64 w-full" data-testid="workspace-tab-loading" />;

  function handleNavigate(resourceType: string, resourceKey: string, label: string, linkPath: string) {
    recordViewMutation.mutate({ data: { resourceType, resourceKey, label, linkPath } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRecentViewsQueryKey() }) });
  }

  return (
    <div className="space-y-4">
      <Card data-testid="card-quick-actions">
        <CardHeader>
          <CardTitle className="text-sm">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(quickActions ?? []).map((action) => (
            <Link key={action.key} href={action.linkPath} data-testid={`quick-action-${action.key}`}>
              <Button size="sm" variant="outline" onClick={() => handleNavigate("quick-action", action.key, action.label, action.linkPath)}>
                {action.label}
              </Button>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="card-favorites">
        <CardHeader>
          <CardTitle className="text-sm">Favorites (Pinned Resources)</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          {(pins ?? []).length === 0 ? (
            <p className="text-muted-foreground" data-testid="favorites-empty">
              No pinned resources yet. Pin a dashboard, report, watchlist, strategy, or learning topic to see it here.
            </p>
          ) : (
            (pins ?? []).map((pin) => (
              <div key={pin.id} className="flex items-center justify-between" data-testid={`pin-${pin.id}`}>
                <Link href={pin.linkPath} className="hover:underline" onClick={() => handleNavigate(pin.resourceType, pin.resourceKey, pin.label, pin.linkPath)}>
                  {pin.label}
                </Link>
                <Button size="icon" variant="ghost" data-testid={`button-unpin-${pin.id}`} onClick={() => unpinMutation.mutate({ id: pin.id })}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
          <Button
            size="sm"
            variant="ghost"
            data-testid="button-pin-watchlists-engine"
            onClick={() =>
              pinMutation.mutate({
                data: { resourceType: "dashboard", resourceKey: "watchlists-engine", label: "Watchlists & Opportunity Dashboard", linkPath: "/watchlists-engine" },
              })
            }
          >
            <Pin className="w-3.5 h-3.5 mr-1" /> Pin Watchlists Engine
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="card-recently-viewed">
        <CardHeader>
          <CardTitle className="text-sm">Recently Viewed</CardTitle>
        </CardHeader>
        <CardContent className="text-xs">
          {(recentViews ?? []).length === 0 ? (
            <p className="text-muted-foreground" data-testid="recently-viewed-empty">Nothing viewed from the Workspace yet.</p>
          ) : (
            <ul className="space-y-1">
              {(recentViews ?? []).map((view) => (
                <li key={view.id}>
                  <Link href={view.linkPath} className="hover:underline" data-testid={`recent-view-${view.id}`}>
                    {view.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CoachLearningTab() {
  const { data: coachTopics, isLoading: coachLoading } = useListWorkspaceCoachTopics();
  const { data: learningTopics, isLoading: learningLoading } = useListWorkspaceLearning();

  if (coachLoading || learningLoading) return <Skeleton className="h-64 w-full" data-testid="coach-learning-loading" />;

  return (
    <div className="space-y-4">
      <Card data-testid="card-ai-coach">
        <CardHeader>
          <CardTitle className="text-sm">AI Coach</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {(coachTopics ?? []).map((topic) => (
            <div key={topic.topic} data-testid={`coach-topic-${topic.topic}`}>
              <p className="font-semibold">{topic.title}</p>
              {topic.explanation.map((paragraph, idx) => (
                <p key={idx} className="text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground border-t border-border pt-2">{(coachTopics ?? [])[0]?.disclaimer}</p>
        </CardContent>
      </Card>

      <Card data-testid="card-learning-centre">
        <CardHeader>
          <CardTitle className="text-sm">Learning Centre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {(learningTopics ?? []).map((topic) => (
            <div key={topic.topic} data-testid={`learning-topic-${topic.topic}`}>
              <p className="font-semibold capitalize">{topic.topic.replace(/_/g, " ")}</p>
              {topic.links.map((link) => (
                <Link key={`${link.pathKey}-${link.topicKey}`} href={link.href} className="block text-primary hover:underline">
                  {link.title}
                </Link>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportingTab() {
  return (
    <Card data-testid="card-reporting-links">
      <CardHeader>
        <CardTitle className="text-sm">Reporting Centre</CardTitle>
        <CardDescription>Generate and save the Portfolio Workspace Summary Report or the Institutional Review Report.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <Link href="/reporting-centre" className="flex items-center gap-1.5 text-primary hover:underline" data-testid="link-open-reporting-centre">
          <FileBarChart2 className="w-3.5 h-3.5" /> Open the Reporting Centre →
        </Link>
      </CardContent>
    </Card>
  );
}

export default function PortfolioWorkspace() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="space-y-4 p-4 md:p-6" data-testid="page-portfolio-workspace">
      <div>
        <h1 className="text-xl font-semibold">Institutional Portfolio Workspace</h1>
        <p className="text-sm text-muted-foreground">
          The primary operating interface bringing together every completed engine into one workflow-driven experience. Orchestration and workflow only — no trade recommendations, no
          AI predictions, no auto execution.
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <LayoutDashboard className="w-4 h-4 mr-1" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="workflows" data-testid="tab-workflows">
            <ListChecks className="w-4 h-4 mr-1" /> Workflow Center
          </TabsTrigger>
          <TabsTrigger value="workspace" data-testid="tab-workspace">
            <Pin className="w-4 h-4 mr-1" /> Workspace
          </TabsTrigger>
          <TabsTrigger value="coach-learning" data-testid="tab-coach-learning">
            <GraduationCap className="w-4 h-4 mr-1" /> Coach &amp; Learning
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-reporting">
            <FileBarChart2 className="w-4 h-4 mr-1" /> Reporting
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="workflows">
          <WorkflowCenterTab />
        </TabsContent>
        <TabsContent value="workspace">
          <WorkspaceTab />
        </TabsContent>
        <TabsContent value="coach-learning">
          <CoachLearningTab />
        </TabsContent>
        <TabsContent value="reporting">
          <ReportingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
