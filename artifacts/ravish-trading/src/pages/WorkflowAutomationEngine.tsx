// v1.5.0, Sprint 16 — Institutional Workflow Automation Engine.
//
// NOT an automation platform. NOT auto-trading. This page connects every
// existing module — Research/Notebook/Strategy/Trade Plan/Decision
// Workflow/Execution & Lifecycle Manager/Trade Journal/Performance/
// Portfolio & Risk Intelligence/Learning Centre — into one unified,
// dismissible Task list. Nothing here executes a trade, places a broker
// order, or performs a hidden automation: every recommendation is a link
// plus a plain-English explanation of trigger/source module/reason/
// suggested outcome, and every action requires the user to click through
// to the real, already-built module page to act.

import { useState } from "react";
import { Link } from "wouter";
import { useWorkflowAutomation } from "@/lib/useWorkflowAutomation";
import { buildWorkflowCoachNarrative, AUTOMATIC_CONNECTIONS, type WorkflowTask, type WorkflowTaskStatus } from "@/lib/workflowAutomation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AskCoachLauncher } from "@/components/learn/AskCoachLauncher";
import { ModuleLearnTrigger } from "@/components/learn/ModuleLearnTrigger";
import { Workflow, ListChecks, Clock, PauseCircle, CheckCircle2, XCircle, Bot, GraduationCap, Link2, X } from "lucide-react";

function statusBadgeClass(status: WorkflowTaskStatus): string {
  if (status === "completed") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (status === "waiting") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (status === "in-progress") return "bg-sky-500/15 text-sky-400 border-sky-500/30";
  if (status === "dismissed") return "bg-muted text-muted-foreground border-border";
  return "bg-indigo-500/15 text-indigo-400 border-indigo-500/30";
}

function statusIcon(status: WorkflowTaskStatus) {
  if (status === "completed") return CheckCircle2;
  if (status === "waiting") return PauseCircle;
  if (status === "in-progress") return Clock;
  if (status === "dismissed") return XCircle;
  return ListChecks;
}

function statusLabel(status: WorkflowTaskStatus): string {
  if (status === "in-progress") return "In Progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function TaskCard({ task, onDismiss, selected, onSelect }: { task: WorkflowTask; onDismiss: (id: string) => void; selected: boolean; onSelect: (task: WorkflowTask) => void }) {
  const StatusIcon = statusIcon(task.status);
  return (
    <Card
      className={`bg-card border-border transition-colors ${selected ? "border-primary/60" : ""} ${task.status !== "completed" ? "cursor-pointer hover:border-primary/40" : ""}`}
      data-testid={`workflow-task-${task.id}`}
      onClick={() => onSelect(task)}
    >
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium" data-testid={`workflow-task-title-${task.id}`}>{task.title}</p>
          <Badge className={statusBadgeClass(task.status)} data-testid={`workflow-task-status-${task.id}`}>
            <StatusIcon className="h-3 w-3 mr-1" /> {statusLabel(task.status)}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          <span className="font-medium">Originating module:</span> {task.originatingModule}
        </p>
        <p className="text-xs" data-testid={`workflow-task-trigger-${task.id}`}>
          <span className="text-muted-foreground">Trigger: </span>
          {task.trigger}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Why it matters: </span>
          {task.reason}
        </p>
        <p className="text-xs">
          <span className="text-muted-foreground">Suggested outcome: </span>
          {task.suggestedOutcome}
        </p>
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <Link href={task.actionHref}>
            <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`workflow-task-action-${task.id}`}>
              {task.actionLabel}
            </Button>
          </Link>
          {task.relatedLesson && (
            <ModuleLearnTrigger moduleLabel={task.title} pathKey={task.relatedLesson.pathKey} topicKey={task.relatedLesson.topicKey} size="xs" />
          )}
          {task.status !== "completed" && task.status !== "dismissed" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 ml-auto"
              data-testid={`workflow-task-dismiss-${task.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(task.id);
              }}
            >
              <X className="h-3 w-3" /> Dismiss
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AiWorkflowCoachCard({ task, activeCount }: { task: WorkflowTask | null; activeCount: number }) {
  const narrative = buildWorkflowCoachNarrative(task, activeCount);
  return (
    <Card className="bg-card border-border" data-testid="ai-workflow-coach-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4" /> AI Workflow Coach
        </CardTitle>
        <CardDescription>
          {task ? "Explaining the selected task." : "Select a task above for a detailed explanation."} Reuses the platform's existing AI Coach — never a new coach, never a new streaming pipeline.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p data-testid="workflow-coach-summary">{narrative.summary}</p>
        <div>
          <p className="text-xs text-muted-foreground">Why it matters</p>
          <p className="text-sm">{narrative.whyItMatters}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">What happens if ignored</p>
          <p className="text-sm" data-testid="workflow-coach-if-ignored">{narrative.ifIgnored}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Institutional best practice</p>
          <p className="text-sm">{narrative.institutionalBestPractice}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Recommended next action</p>
          <p className="text-sm font-medium">{narrative.recommendedNextAction}</p>
        </div>
        <AskCoachLauncher label="Ask the AI Coach" suggestedQuestion="What should I focus on first in my workflow queue right now?" />
      </CardContent>
    </Card>
  );
}

function AutomaticConnectionsCard() {
  return (
    <Card className="bg-card border-border" data-testid="automatic-connections-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Automatic Connections
        </CardTitle>
        <CardDescription>Steps that never need a task, because they already happen automatically — never a fabricated manual step.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-xs" data-testid="automatic-connections-list">
          {AUTOMATIC_CONNECTIONS.map((c, i) => (
            <li key={i} className="p-2 rounded-md border border-border">
              <p><span className="font-medium">{c.trigger}</span> → {c.outcome}</p>
              <p className="text-muted-foreground mt-0.5">{c.reason}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function WorkflowAutomationEngine() {
  const { loading, activeTasks, recentlyCompleted, dismiss } = useWorkflowAutomation();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTask = activeTasks.find((t) => t.id === selectedTaskId) ?? null;

  return (
    <div className="space-y-6 max-w-7xl" data-testid="page-workflow-automation-engine">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Workflow className="h-6 w-6 text-indigo-400" /> Institutional Workflow Automation Engine
          </h1>
          <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30" data-testid="badge-workflow-automation">
            My Workflow
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Connects Research, Notebook, Strategy, Trade Plan, Decision Workflow, Execution &amp; Lifecycle Manager, Trade
          Journal, Performance, and Portfolio &amp; Risk Intelligence into one workflow queue. This is not an
          automation platform and never auto-trades — every recommendation is a link plus an explanation; nothing
          here executes a trade or a broker action on its own.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">Recommended Tasks</h2>
              {activeTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="workflow-tasks-empty">
                  Nothing needs your attention right now — every connected module is caught up.
                </p>
              ) : (
                <div className="space-y-2" data-testid="workflow-tasks-list">
                  {activeTasks.map((t) => (
                    <TaskCard key={t.id} task={t} onDismiss={dismiss} selected={selectedTaskId === t.id} onSelect={(task) => setSelectedTaskId(task.id)} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Recently Completed Actions
              </h2>
              {recentlyCompleted.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="workflow-recent-completions-empty">
                  Nothing completed in the last 7 days yet.
                </p>
              ) : (
                <ul className="text-xs space-y-1" data-testid="workflow-recent-completions-list">
                  {recentlyCompleted.map((t) => (
                    <li key={t.id} data-testid={`workflow-recent-completion-${t.id}`}>{t.title}</li>
                  ))}
                </ul>
              )}
            </div>

            <AutomaticConnectionsCard />
          </div>

          <div className="space-y-4">
            <AiWorkflowCoachCard task={selectedTask} activeCount={activeTasks.length} />
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Learning Integration
                </CardTitle>
                <CardDescription>Task-linked lessons appear as a "Learn" button directly on their own task card, reusing the Learning Centre.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
