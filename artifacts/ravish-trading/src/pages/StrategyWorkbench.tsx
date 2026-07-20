// Phase 31 — Institutional Strategy Workbench.
//
// ARCHITECTURE/WORKFLOW UI, NOT A STRATEGY IMPLEMENTATION. This page is the
// orchestration layer over the Phase 30 Institutional Strategy Framework:
// it never implements or evaluates a named trading methodology (ICT/SMC/
// ASAD/Trader Bill/Tom Nash/Dunni Framework), never generates a trading
// signal, and never executes anything against a broker. Every panel below
// either reads already-persisted strategy metadata/checklist state, or
// reuses an already-shipped engine (the Strategy Coach, the Learning
// Centre, the Reporting Centre) exactly as StrategyFramework.tsx (Phase 30)
// already does.
//
// Workflow: Browse Strategy Registry -> Select Strategy -> Review Metadata
// -> Review Checklist -> Review Evidence Requirements -> Compare Strategies
// -> Open Learning -> Consult Strategy Coach -> Record Notes -> Save
// Workspace. The Strategy Browser (left) drives the active-strategy
// Workspace (center) and an optional multi-select Comparison set (below).
//
// Reuses 4 shared components extracted from StrategyFramework.tsx this
// same phase (EvidenceViewer, ChecklistReviewPanel, StrategyLearningPanel,
// StrategyCoachExplanationPanel, StrategyValidationSummary) rather than a
// second, duplicated copy of their logic. Strategy Notes reuse the
// existing trading_workspace_notes table (Phase 25) under a disclosed
// STRATEGY:<id> pseudo-symbol convention (lib/tradingStrategyFramework.ts's
// strategyWorkspaceNoteSymbol(), Phase 31) — no new persistence. Save
// Workspace reuses the exact client-side localStorage Saved-Layouts
// pattern ResearchTerminal.tsx (Phase 20) already established — no new
// persistence there either.

import { useEffect, useState, useCallback } from "react";
import { Link, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useListTradingStrategies,
  useGetTradingStrategy,
  getGetTradingStrategyQueryKey,
  useGetLearningProgress,
  getGetLearningProgressQueryKey,
  useListTradingWorkspaceNotesForSymbol,
  getListTradingWorkspaceNotesForSymbolQueryKey,
  useCreateTradingWorkspaceNote,
  useDeleteTradingWorkspaceNote,
  useGetStrategyFrameworkSummaryReport,
  getGetStrategyFrameworkSummaryReportQueryKey,
} from "@workspace/api-client-react";
import { EvidenceViewer } from "@/components/strategy/EvidenceViewer";
import { ChecklistReviewPanel } from "@/components/strategy/ChecklistReviewPanel";
import { StrategyLearningPanel } from "@/components/strategy/StrategyLearningPanel";
import { StrategyCoachExplanationPanel } from "@/components/strategy/StrategyCoachExplanationPanel";
import { StrategyValidationSummary } from "@/components/strategy/StrategyValidationSummary";
import { compareStrategies } from "@/lib/strategy-comparison";
import { LayoutGrid, GitCompare, StickyNote, FileBarChart2, Save, Trash2 } from "lucide-react";

const WORKFLOW_STEPS = [
  "Browse Strategy Registry",
  "Select Strategy",
  "Review Metadata",
  "Review Checklist",
  "Review Evidence Requirements",
  "Compare Strategies",
  "Open Learning",
  "Consult Strategy Coach",
  "Record Notes",
  "Save Workspace",
];

function strategyNoteSymbol(strategyId: number): string {
  return `STRATEGY:${strategyId}`;
}

interface SavedWorkspaceLayout {
  name: string;
  activeStrategyId: number | null;
  comparisonIds: number[];
}

const WORKSPACE_LAYOUTS_STORAGE_KEY = "strategy-workbench-layouts";

function loadWorkspaceLayouts(): SavedWorkspaceLayout[] {
  try {
    const raw = localStorage.getItem(WORKSPACE_LAYOUTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWorkspaceLayouts(layouts: SavedWorkspaceLayout[]) {
  try {
    localStorage.setItem(WORKSPACE_LAYOUTS_STORAGE_KEY, JSON.stringify(layouts));
  } catch {
    // localStorage unavailable (private browsing, quota) — layouts simply
    // don't persist this session; never a fatal error for a UI preference.
  }
}

function useSavedWorkspaceLayouts() {
  const [layouts, setLayouts] = useState<SavedWorkspaceLayout[]>([]);
  useEffect(() => setLayouts(loadWorkspaceLayouts()), []);

  const save = useCallback((layout: SavedWorkspaceLayout) => {
    setLayouts((prev) => {
      const next = [...prev.filter((l) => l.name !== layout.name), layout];
      saveWorkspaceLayouts(next);
      return next;
    });
  }, []);

  const remove = useCallback((name: string) => {
    setLayouts((prev) => {
      const next = prev.filter((l) => l.name !== name);
      saveWorkspaceLayouts(next);
      return next;
    });
  }, []);

  return { layouts, save, remove };
}

function StrategyNotesPanel({ strategyId }: { strategyId: number }) {
  const symbol = strategyNoteSymbol(strategyId);
  const { data: notes, isLoading } = useListTradingWorkspaceNotesForSymbol(symbol, {
    query: { queryKey: getListTradingWorkspaceNotesForSymbolQueryKey(symbol) },
  });
  const createNote = useCreateTradingWorkspaceNote();
  const deleteNote = useDeleteTradingWorkspaceNote();
  const [draft, setDraft] = useState("");

  return (
    <Card data-testid="panel-strategy-notes">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="w-4 h-4" /> Strategy Notes
        </CardTitle>
        <CardDescription>
          Free-text notes about this review session — reuses the existing Trade Workspace notes system.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <Textarea
            data-testid="input-strategy-note-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Record a note about this strategy review..."
          />
          <Button
            size="sm"
            data-testid="button-add-strategy-note"
            disabled={!draft.trim()}
            onClick={() => {
              createNote.mutate({ data: { symbol, note: draft.trim() } });
              setDraft("");
            }}
          >
            Add
          </Button>
        </div>

        {isLoading && <Skeleton className="h-10 w-full" />}
        {notes?.length === 0 && (
          <p className="text-muted-foreground" data-testid="text-strategy-notes-empty">
            No notes recorded yet for this strategy.
          </p>
        )}
        {notes && notes.length > 0 && (
          <ul className="space-y-2" data-testid="list-strategy-notes">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-2 border-b border-border/50 pb-2" data-testid={`strategy-note-${n.id}`}>
                <span>{n.note}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid={`button-delete-strategy-note-${n.id}`}
                    onClick={() => deleteNote.mutate({ id: n.id })}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StrategyReportViewer() {
  const { data: report, isLoading } = useGetStrategyFrameworkSummaryReport({
    query: { queryKey: getGetStrategyFrameworkSummaryReportQueryKey() },
  });

  return (
    <Card data-testid="panel-strategy-report-viewer">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <FileBarChart2 className="w-4 h-4" /> Strategy Report Viewer
          </CardTitle>
          <CardDescription>Reuses the Reporting Centre's own Strategy Framework Summary report.</CardDescription>
        </div>
        <Link href="/reporting-centre" className="text-xs text-primary hover:underline" data-testid="link-open-reporting-centre">
          Open in Reporting Centre →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {report && (
          <div className="space-y-2" data-testid="strategy-report-sections">
            {report.sections.map((s) => (
              <div key={s.id} data-testid={`report-section-${s.id}`}>
                <p className="font-medium text-foreground">{s.title}</p>
                <p className="text-muted-foreground text-xs">{s.body}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonView({ strategyIds }: { strategyIds: number[] }) {
  const { data: strategies } = useListTradingStrategies();
  const { data: progress } = useGetLearningProgress({ query: { queryKey: getGetLearningProgressQueryKey() } });

  const selected = (strategies ?? []).filter((s) => strategyIds.includes(s.id));
  const rows = compareStrategies(selected, progress?.viewedStrategyKeys ?? []);

  return (
    <Card data-testid="panel-strategy-comparison">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <GitCompare className="w-4 h-4" /> Strategy Comparison
        </CardTitle>
        <CardDescription>Metadata only — categories, markets, timeframes, required evidence, checklist size, references, version, Learning Coverage. Never performance, never a ranking.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="text-comparison-empty">
            Select two or more strategies in the Strategy Browser to compare their metadata.
          </p>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="table-strategy-comparison">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1.5 pr-3">Strategy</th>
                  <th className="text-left py-1.5 pr-3">Category</th>
                  <th className="text-left py-1.5 pr-3">Markets</th>
                  <th className="text-left py-1.5 pr-3">Timeframes</th>
                  <th className="text-left py-1.5 pr-3">Required Evidence</th>
                  <th className="text-left py-1.5 pr-3">Checklist Size</th>
                  <th className="text-left py-1.5 pr-3">References</th>
                  <th className="text-left py-1.5 pr-3">Version</th>
                  <th className="text-left py-1.5 pr-3">Learning Coverage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.strategyId} className="border-b border-border/40" data-testid={`comparison-row-${r.strategyId}`}>
                    <td className="py-1.5 pr-3 font-medium text-foreground">{r.name}</td>
                    <td className="py-1.5 pr-3">{r.category}</td>
                    <td className="py-1.5 pr-3">{r.markets.join(", ")}</td>
                    <td className="py-1.5 pr-3">{r.timeframes.join(", ")}</td>
                    <td className="py-1.5 pr-3">{r.requiredEvidenceCount}</td>
                    <td className="py-1.5 pr-3">{r.checklistSize}</td>
                    <td className="py-1.5 pr-3">{r.referencesCount}</td>
                    <td className="py-1.5 pr-3">{r.version}</td>
                    <td className="py-1.5 pr-3">
                      <Badge variant={r.learningCoverageViewed ? "default" : "secondary"}>{r.learningCoverageViewed ? "viewed" : "not yet viewed"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StrategyWorkbench() {
  const { data: strategies, isLoading } = useListTradingStrategies();
  // Deep-linking: an optional ?strategyId= query param (e.g. a link from the
  // Trade Workspace or Trading AI Coach) opens that strategy directly in the
  // Workspace on load, mirroring learn/LearningCentre.tsx's own ?tab=
  // deep-link precedent (Phase 8).
  const search = useSearch();
  const deepLinkedStrategyId = (() => {
    const raw = new URLSearchParams(search).get("strategyId");
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  })();
  const [activeId, setActiveId] = useState<number | null>(deepLinkedStrategyId);
  const [comparisonIds, setComparisonIds] = useState<number[]>([]);
  const [layoutName, setLayoutName] = useState("");
  const { layouts, save: saveLayout, remove: removeLayout } = useSavedWorkspaceLayouts();

  const { data: activeStrategy } = useGetTradingStrategy(activeId ?? 0, {
    query: { queryKey: getGetTradingStrategyQueryKey(activeId ?? 0), enabled: !!activeId },
  });

  function toggleComparison(id: number) {
    setComparisonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSaveWorkspace() {
    if (!layoutName.trim()) return;
    saveLayout({ name: layoutName.trim(), activeStrategyId: activeId, comparisonIds });
    setLayoutName("");
  }

  function handleLoadWorkspace(layout: SavedWorkspaceLayout) {
    setActiveId(layout.activeStrategyId);
    setComparisonIds(layout.comparisonIds);
  }

  return (
    <div className="p-4 space-y-4" data-testid="page-strategy-workbench">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <LayoutGrid className="w-5 h-5" /> Institutional Strategy Workbench
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Browse your own registered strategies, review their metadata/checklist/evidence, compare them side by side, and consult the
          Strategy Coach — this workbench orchestrates the existing Strategy Framework, it never implements or evaluates a trading
          methodology itself.
        </p>
        <ul className="flex flex-wrap gap-1.5 mt-2" data-testid="list-workflow-steps">
          {WORKFLOW_STEPS.map((step, i) => (
            <li key={step} className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Badge variant="outline" className="text-[9px]">{i + 1}</Badge>
              {step}
              {i < WORKFLOW_STEPS.length - 1 && <span className="mx-0.5">→</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1" data-testid="panel-strategy-browser">
          <CardHeader>
            <CardTitle className="text-base">Strategy Browser</CardTitle>
            <CardDescription>Select a strategy to open it in the Workspace; check strategies to add them to Comparison.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <Skeleton className="h-24 w-full" />}
            {strategies?.length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-workbench-strategies-empty">
                No strategies registered yet — register one in the{" "}
                <Link href="/strategy-framework" className="text-primary hover:underline">
                  Strategy Framework
                </Link>
                .
              </p>
            )}
            {strategies && strategies.length > 0 && (
              <ul className="space-y-1" data-testid="list-workbench-strategies">
                {strategies.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={comparisonIds.includes(s.id)}
                      onCheckedChange={() => toggleComparison(s.id)}
                      data-testid={`checkbox-compare-strategy-${s.id}`}
                    />
                    <button
                      type="button"
                      data-testid={`button-open-strategy-${s.id}`}
                      onClick={() => setActiveId(s.id)}
                      className={`flex-1 text-left text-sm p-2 rounded border ${activeId === s.id ? "border-indigo-500" : "border-border"}`}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground text-xs block">{s.category}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {activeStrategy ? (
            <div className="space-y-4" data-testid="panel-strategy-workspace">
              <Card>
                <CardHeader>
                  <CardTitle data-testid="text-workbench-active-strategy-name">{activeStrategy.name}</CardTitle>
                  <CardDescription>
                    {activeStrategy.category} · v{activeStrategy.version}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm">
                  <p>{activeStrategy.description}</p>
                </CardContent>
              </Card>
              <StrategyValidationSummary validation={activeStrategy.validation} />
              <EvidenceViewer requiredEvidence={activeStrategy.requiredEvidence} />
              <ChecklistReviewPanel strategy={activeStrategy} />
              <StrategyLearningPanel strategy={activeStrategy} />
              <StrategyCoachExplanationPanel strategyId={activeStrategy.id} />
              <StrategyNotesPanel strategyId={activeStrategy.id} />
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground" data-testid="text-no-active-strategy">
                Select a strategy from the Strategy Browser to open its Workspace.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ComparisonView strategyIds={comparisonIds} />
      <StrategyReportViewer />

      <Card data-testid="panel-save-workspace">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Save className="w-4 h-4" /> Save Workspace
          </CardTitle>
          <CardDescription>Saves the active strategy and comparison selection locally in this browser — no server persistence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Workspace name"
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="max-w-[220px]"
              data-testid="input-workspace-layout-name"
            />
            <Button size="sm" data-testid="button-save-workspace" disabled={!layoutName.trim()} onClick={handleSaveWorkspace}>
              Save
            </Button>
          </div>
          {layouts.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-saved-workspaces-empty">
              No saved workspaces yet.
            </p>
          ) : (
            <ul className="space-y-1" data-testid="list-saved-workspaces">
              {layouts.map((l) => (
                <li key={l.name} className="flex items-center justify-between text-sm border-b border-border/40 pb-1">
                  <button
                    type="button"
                    data-testid={`button-load-workspace-${l.name}`}
                    onClick={() => handleLoadWorkspace(l)}
                    className="text-left hover:underline"
                  >
                    {l.name}
                  </button>
                  <Button size="sm" variant="ghost" data-testid={`button-remove-workspace-${l.name}`} onClick={() => removeLayout(l.name)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
