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
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListTradingStrategies,
  useCreateTradingStrategy,
  useDeleteTradingStrategy,
  useGetTradingStrategy,
  getGetTradingStrategyQueryKey,
  useGetLearningPathByKey,
  useGetLearningProgress,
  getGetLearningProgressQueryKey,
  TradingStrategyCategory,
  TradingStrategyRequiredEvidenceItem,
  type TradingStrategy,
} from "@workspace/api-client-react";
import { EvidenceViewer, EVIDENCE_LABELS } from "@/components/strategy/EvidenceViewer";
import { ChecklistReviewPanel } from "@/components/strategy/ChecklistReviewPanel";
import { StrategyLearningPanel } from "@/components/strategy/StrategyLearningPanel";
import { StrategyCoachExplanationPanel } from "@/components/strategy/StrategyCoachExplanationPanel";
import { StrategyValidationSummary } from "@/components/strategy/StrategyValidationSummary";
import { Layers, GraduationCap, CheckCircle2, Circle, Trash2 } from "lucide-react";

const CATEGORY_OPTIONS = Object.values(TradingStrategyCategory);
const EVIDENCE_OPTIONS = Object.values(TradingStrategyRequiredEvidenceItem);

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

function StrategyDetail({ strategyId, onDeleted }: { strategyId: number; onDeleted: () => void }) {
  const { data: strategy, isLoading } = useGetTradingStrategy(strategyId, {
    query: { queryKey: getGetTradingStrategyQueryKey(strategyId) },
  });
  const deleteStrategy = useDeleteTradingStrategy();

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

      <StrategyValidationSummary validation={strategy.validation} />
      <EvidenceViewer requiredEvidence={strategy.requiredEvidence} />
      <ChecklistReviewPanel strategy={strategy} />
      <StrategyLearningPanel strategy={strategy} />
      <StrategyCoachExplanationPanel strategyId={strategyId} />
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
