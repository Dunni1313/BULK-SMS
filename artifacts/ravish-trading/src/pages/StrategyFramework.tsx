// Phase 30 — Institutional Strategy Framework.
//
// ARCHITECTURE/FRAMEWORK UI, NOT A STRATEGY IMPLEMENTATION. This page lets a
// user register their OWN methodology as metadata (name, description,
// category, timeframes, markets, required evidence, a checklist template,
// educational notes, references, version), instantiate real Checklist
// instances against it, and consult the deterministic Strategy Coach — it
// never generates a trading signal, predicts a price, or recommends buying
// or selling. No named methodology (ICT/SMC/ASAD/Trader Bill/Tom Nash/Dunni
// Framework) is ever authored by this codebase; a user is free to name
// their own strategy however they like, but the platform never interprets
// that name.
//
// Master-detail layout: Strategy Registry (left) + Strategy Detail (right,
// once selected) — Evidence Viewer, Checklist Viewer, Learning Viewer, and
// the Strategy Coach panel — plus a Guided Learning Mode + Progress Tracker
// section at the bottom, mirroring pages/TradingAICoach.tsx's own Phase 29
// established pattern.

import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListTradingStrategies,
  useCreateTradingStrategy,
  useDeleteTradingStrategy,
  useGetTradingStrategy,
  getGetTradingStrategyQueryKey,
  useListTradingStrategyChecklists,
  getListTradingStrategyChecklistsQueryKey,
  useCreateTradingStrategyChecklist,
  useUpdateTradingStrategyChecklist,
  useDeleteTradingStrategyChecklist,
  useGetTradingCoachStrategyExplanation,
  getGetTradingCoachStrategyExplanationQueryKey,
  useGetLearningPathByKey,
  useGetLearningProgress,
  getGetLearningProgressQueryKey,
  useRecordLearningItemViewed,
  TradingStrategyCategory,
  TradingStrategyRequiredEvidenceItem,
  type TradingStrategy,
  type TradingStrategyChecklist,
} from "@workspace/api-client-react";
import { ListChecks, Layers, GraduationCap, BookOpen, CheckCircle2, Circle, Trash2, MessageCircle } from "lucide-react";

const CATEGORY_OPTIONS = Object.values(TradingStrategyCategory);
const EVIDENCE_OPTIONS = Object.values(TradingStrategyRequiredEvidenceItem);
const EVIDENCE_LABELS: Record<string, string> = {
  structure: "Market Structure Workbench",
  liquidity: "Liquidity & Session Workbench",
  session: "Trading Session",
  risk: "Risk Studio",
  "trade-plan": "Trade Planning Studio",
  journal: "Trading Journal",
  coach: "Trading AI Coach",
};

function NewStrategyForm({ onCreated }: { onCreated: (id: number) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("trend");
  const [timeframes, setTimeframes] = useState("1h, 1D");
  const [markets, setMarkets] = useState("equities");
  const [requiredEvidence, setRequiredEvidence] = useState<string[]>(["structure"]);
  const [checklistText, setChecklistText] = useState("Reviewed market structure|required\nOptional note|optional");
  const [educationalNotes, setEducationalNotes] = useState("");
  const [references, setReferences] = useState("");
  const create = useCreateTradingStrategy();

  const toggleEvidence = (key: string) => {
    setRequiredEvidence((prev) => (prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key]));
  };

  const handleSubmit = () => {
    const checklist = checklistText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, i) => {
        const [label, req] = line.split("|");
        return { id: `item-${i}`, label: (label ?? line).trim(), required: (req ?? "required").trim() !== "optional" };
      });
    create.mutate(
      {
        data: {
          name,
          description,
          category: category as never,
          timeframes: timeframes.split(",").map((t) => t.trim()).filter(Boolean),
          markets: markets.split(",").map((m) => m.trim()).filter(Boolean),
          requiredEvidence: requiredEvidence as never,
          checklist,
          educationalNotes,
          references: references.split("\n").map((r) => r.trim()).filter(Boolean),
        },
      },
      {
        onSuccess: (created) => {
          setName("");
          setDescription("");
          setChecklistText("Reviewed market structure|required\nOptional note|optional");
          onCreated(created.id);
        },
      },
    );
  };

  return (
    <div className="space-y-3" data-testid="form-new-strategy">
      <div className="space-y-1">
        <Label htmlFor="strategy-name">Name</Label>
        <Input id="strategy-name" data-testid="input-strategy-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Setup" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="strategy-description">Description</Label>
        <Textarea
          id="strategy-description"
          data-testid="input-strategy-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div className="space-y-1">
        <Label>Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger data-testid="select-strategy-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="strategy-timeframes">Timeframes (comma-separated)</Label>
        <Input id="strategy-timeframes" data-testid="input-strategy-timeframes" value={timeframes} onChange={(e) => setTimeframes(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="strategy-markets">Markets (comma-separated)</Label>
        <Input id="strategy-markets" data-testid="input-strategy-markets" value={markets} onChange={(e) => setMarkets(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Required Evidence</Label>
        <div className="flex flex-wrap gap-2">
          {EVIDENCE_OPTIONS.map((ev) => (
            <button
              key={ev}
              type="button"
              data-testid={`toggle-evidence-${ev}`}
              onClick={() => toggleEvidence(ev)}
              className={`text-xs px-2 py-1 rounded border ${requiredEvidence.includes(ev) ? "bg-indigo-500/20 border-indigo-500 text-foreground" : "border-border text-muted-foreground"}`}
            >
              {EVIDENCE_LABELS[ev] ?? ev}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="strategy-checklist">Checklist (one per line, "label|required" or "label|optional")</Label>
        <Textarea
          id="strategy-checklist"
          data-testid="input-strategy-checklist"
          value={checklistText}
          onChange={(e) => setChecklistText(e.target.value)}
          rows={3}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="strategy-notes">Educational Notes</Label>
        <Textarea id="strategy-notes" data-testid="input-strategy-notes" value={educationalNotes} onChange={(e) => setEducationalNotes(e.target.value)} rows={2} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="strategy-references">References (one per line)</Label>
        <Textarea id="strategy-references" data-testid="input-strategy-references" value={references} onChange={(e) => setReferences(e.target.value)} rows={2} />
      </div>
      <Button data-testid="button-create-strategy" onClick={handleSubmit} disabled={!name.trim() || !description.trim() || create.isPending}>
        Register Strategy
      </Button>
      {create.isError && (
        <p className="text-sm text-destructive" data-testid="text-create-strategy-error">
          Could not register this strategy — check that every field is well-formed.
        </p>
      )}
    </div>
  );
}

function ChecklistViewer({ strategy }: { strategy: TradingStrategy }) {
  const { data: checklists } = useListTradingStrategyChecklists(strategy.id, {
    query: { queryKey: getListTradingStrategyChecklistsQueryKey(strategy.id) },
  });
  const [symbol, setSymbol] = useState("");
  const createChecklist = useCreateTradingStrategyChecklist();
  const updateChecklist = useUpdateTradingStrategyChecklist();
  const deleteChecklist = useDeleteTradingStrategyChecklist();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selected = checklists?.find((c) => c.id === selectedId) ?? null;

  const toggleItem = (checklist: TradingStrategyChecklist, itemId: string) => {
    const items = checklist.items.map((i) => (i.id === itemId ? { ...i, completed: !i.completed } : i));
    updateChecklist.mutate({ id: checklist.id, data: { items } });
  };

  return (
    <div className="space-y-3" data-testid="panel-checklist-viewer">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Optional symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="max-w-[160px]"
          data-testid="input-checklist-symbol"
        />
        <Button
          size="sm"
          data-testid="button-new-checklist"
          onClick={() =>
            createChecklist.mutate(
              { strategyId: strategy.id, data: { symbol: symbol.trim() || undefined } },
              { onSuccess: (created) => setSelectedId(created.id) },
            )
          }
        >
          New Checklist
        </Button>
      </div>

      {checklists?.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="text-checklists-empty">
          No checklist instances yet for this strategy.
        </p>
      )}

      {checklists && checklists.length > 0 && (
        <ul className="space-y-1" data-testid="list-checklists">
          {checklists.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                data-testid={`button-select-checklist-${c.id}`}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left text-sm p-2 rounded border ${selectedId === c.id ? "border-indigo-500" : "border-border"}`}
              >
                {c.symbol ?? "(no symbol)"} — <Badge variant={c.status === "complete" ? "default" : "secondary"}>{c.status}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="space-y-2 border-t border-border pt-3" data-testid={`checklist-detail-${selected.id}`}>
          {selected.items.map((item) => (
            <div key={item.id} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={item.completed}
                onCheckedChange={() => toggleItem(selected, item.id)}
                data-testid={`checkbox-checklist-item-${item.id}`}
              />
              <div>
                <span>
                  {item.label} {item.required ? <Badge variant="outline" className="ml-1 text-[10px]">required</Badge> : null}
                </span>
                {item.evidenceLinks.length === 0 && (
                  <p className="text-xs text-muted-foreground" data-testid={`text-no-evidence-${item.id}`}>
                    No evidence link attached yet.
                  </p>
                )}
              </div>
            </div>
          ))}
          <Button
            variant="destructive"
            size="sm"
            data-testid={`button-delete-checklist-${selected.id}`}
            onClick={() => {
              deleteChecklist.mutate({ id: selected.id });
              setSelectedId(null);
            }}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Delete this checklist
          </Button>
        </div>
      )}
    </div>
  );
}

function StrategyDetail({ strategyId, onDeleted }: { strategyId: number; onDeleted: () => void }) {
  const { data: strategy, isLoading } = useGetTradingStrategy(strategyId, {
    query: { queryKey: getGetTradingStrategyQueryKey(strategyId) },
  });
  const deleteStrategy = useDeleteTradingStrategy();
  const recordViewed = useRecordLearningItemViewed();
  const { data: coach, isLoading: coachLoading } = useGetTradingCoachStrategyExplanation(strategyId, {
    query: { queryKey: getGetTradingCoachStrategyExplanationQueryKey(strategyId) },
  });

  if (isLoading || !strategy) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4" data-testid={`strategy-detail-${strategyId}`}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle data-testid="text-strategy-detail-name">{strategy.name}</CardTitle>
            <CardDescription>
              {strategy.category} · v{strategy.version}
            </CardDescription>
          </div>
          <Button
            variant="destructive"
            size="sm"
            data-testid="button-delete-strategy"
            onClick={() => deleteStrategy.mutate({ id: strategyId }, { onSuccess: onDeleted })}
          >
            <Trash2 className="w-3 h-3 mr-1" /> Delete
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p data-testid="text-strategy-detail-description">{strategy.description}</p>
          <div className="flex flex-wrap gap-1">
            {strategy.timeframes.map((tf) => (
              <Badge key={tf} variant="secondary">
                {tf}
              </Badge>
            ))}
            {strategy.markets.map((m) => (
              <Badge key={m} variant="outline">
                {m}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="panel-evidence-viewer">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4" /> Evidence Viewer
          </CardTitle>
          <CardDescription>Existing deterministic outputs this strategy's own author considers relevant — never calculated here.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {strategy.requiredEvidence.map((ev) => (
            <Badge key={ev} variant="secondary" data-testid={`badge-evidence-${ev}`}>
              {EVIDENCE_LABELS[ev] ?? ev}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="w-4 h-4" /> Checklist Viewer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChecklistViewer strategy={strategy} />
        </CardContent>
      </Card>

      <Card data-testid="panel-learning-viewer">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Learning Viewer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p data-testid="text-strategy-educational-notes">{strategy.educationalNotes || "No educational notes recorded."}</p>
          {strategy.references.length > 0 && (
            <ul className="list-disc list-inside text-muted-foreground" data-testid="list-strategy-references">
              {strategy.references.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          <Button
            size="sm"
            variant="outline"
            data-testid="button-mark-strategy-learning-viewed"
            onClick={() => recordViewed.mutate({ data: { itemType: "strategy", itemKey: `strategy-framework:${strategy.id}` } })}
          >
            Mark as viewed
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="panel-strategy-coach">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> Strategy Coach
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {coachLoading && <Skeleton className="h-16 w-full" />}
          {coach && (
            <>
              <p data-testid="text-strategy-coach-headline">{coach.headline}</p>
              <p className="text-muted-foreground">{coach.whyThisExists}</p>
              <ul className="space-y-1">
                {coach.metricsUsed.map((m, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-medium">{m.label}:</span> {m.detail}
                  </li>
                ))}
              </ul>
              {coach.risksReducingConfidence.length > 0 && (
                <ul className="list-disc list-inside text-amber-500 text-xs" data-testid="list-strategy-coach-risks">
                  {coach.risksReducingConfidence.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground italic">{coach.disclaimer}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function StrategyFramework() {
  const { data: strategies, isLoading } = useListTradingStrategies();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: guidedPath } = useGetLearningPathByKey("strategy-framework");
  const { data: progress } = useGetLearningProgress({ query: { queryKey: getGetLearningProgressQueryKey() } });
  const completedLessonKeys = new Set(progress?.completedLessonKeys ?? []);
  const strategyFrameworkCompletion = progress?.pathCompletion.find((p) => p.pathKey === "strategy-framework");

  return (
    <div className="p-4 space-y-4" data-testid="page-strategy-framework">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Layers className="w-5 h-5" /> Institutional Strategy Framework
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Register your own trading methodology as metadata — name, category, timeframes, markets, required evidence, and a checklist. This platform
          never implements or evaluates the methodology itself; it only helps you apply it consistently and cite existing deterministic evidence.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1" data-testid="panel-strategy-registry">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Strategy Registry</CardTitle>
            <Button size="sm" data-testid="button-toggle-new-strategy" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "New Strategy"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {showForm && <NewStrategyForm onCreated={(id) => { setSelectedId(id); setShowForm(false); }} />}

            {isLoading && <Skeleton className="h-24 w-full" />}
            {strategies?.length === 0 && !showForm && (
              <p className="text-sm text-muted-foreground" data-testid="text-strategies-empty">
                No strategies registered yet — future phases (and you) can add real methodologies here.
              </p>
            )}
            {strategies && strategies.length > 0 && (
              <ul className="space-y-1" data-testid="list-strategies">
                {strategies.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      data-testid={`button-select-strategy-${s.id}`}
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full text-left text-sm p-2 rounded border ${selectedId === s.id ? "border-indigo-500" : "border-border"}`}
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

        <div className="lg:col-span-2">
          {selectedId ? (
            <StrategyDetail strategyId={selectedId} onDeleted={() => setSelectedId(null)} />
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground" data-testid="text-no-strategy-selected">
                Select a strategy from the registry, or register a new one, to view its detail, checklist, evidence, and learning viewers.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Guided Learning Mode */}
      <Card className="bg-card border-border" data-testid="card-strategy-framework-guided-learning">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="w-4 h-4" /> Guided Learning Mode
          </CardTitle>
          <CardDescription>What a Strategy is, categories and evidence, the Checklist Engine, and the Strategy Coach.</CardDescription>
        </CardHeader>
        <CardContent>
          {!guidedPath && <Skeleton className="h-24 w-full" />}
          {guidedPath && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="list-strategy-framework-guided-topics">
              {guidedPath.topics.map((t) => {
                const done = completedLessonKeys.has(t.key);
                return (
                  <li key={t.key}>
                    <Link
                      href={`/learn/paths/strategy-framework/${t.key}`}
                      className="flex items-start gap-2 p-2 rounded border border-border hover:border-indigo-500/40 text-sm"
                      data-testid={`link-strategy-framework-guided-topic-${t.key}`}
                    >
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <span>
                        <span className="font-medium text-foreground block">{t.title}</span>
                        <span className="text-muted-foreground text-xs">{t.summary}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Progress Tracker */}
      <Card className="bg-card border-border" data-testid="card-strategy-framework-progress-tracker">
        <CardHeader>
          <CardTitle className="text-base">Progress Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!progress && <Skeleton className="h-16 w-full" />}
          {progress && strategyFrameworkCompletion && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Institutional Strategy Framework path</span>
                <span data-testid="text-strategy-framework-progress-path-percent">
                  {strategyFrameworkCompletion.topicsCompleted}/{strategyFrameworkCompletion.topicsTotal} ({strategyFrameworkCompletion.percentComplete}%)
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
