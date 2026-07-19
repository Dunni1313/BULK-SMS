// Phase 14 — Institutional Investment Decision Engine. Advisory/education
// only: this page never previews, schedules, or submits any order, and
// never touches a real brokerage account (same discipline as Stock Research
// and the Institutional Portfolio Manager).
//
// Pure composition, zero new scoring on this page — every number/label
// rendered here comes straight from GET /stock-analyst/decision/:symbol
// (lib/decisionEngine.ts), which itself reuses Business Quality/Competitive
// Advantage/Management Quality/Capital Allocation/Financial Strength/
// Valuation/Margin of Safety/Investment Committee/Tom Nash — already-shipped
// engines, never recomputed here.

import { useMemo, useRef, useState, useEffect } from "react";
import { useSearch, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetPortfolios,
  useGetDecisionSnapshots,
  useSaveDecisionSnapshot,
  useGetDecisionNotes,
  useAddDecisionNote,
  useUpdateDecisionNote,
  useDeleteDecisionNote,
  getGetInstitutionalDecisionQueryKey,
  getGetDecisionSnapshotsQueryKey,
  getGetDecisionNotesQueryKey,
  getInstitutionalDecision,
} from "@workspace/api-client-react";
import type { InstitutionalDecisionAnalysis } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Gavel, Search, Save, Trash2, Pencil } from "lucide-react";

function recommendationBadgeClass(rec: string): string {
  if (rec === "Buy" || rec === "Accumulate") return "border-emerald-500/40 text-emerald-400";
  if (rec === "Hold") return "border-border text-muted-foreground";
  if (rec === "Reduce") return "border-amber-500/40 text-amber-400";
  return "border-rose-500/40 text-rose-400"; // Sell, Avoid
}

function checklistBadgeClass(status: string): string {
  if (status === "pass") return "border-emerald-500/40 text-emerald-400";
  if (status === "warning") return "border-amber-500/40 text-amber-400";
  if (status === "fail") return "border-rose-500/40 text-rose-400";
  return "border-border text-muted-foreground/60"; // unavailable
}

const fmtPct = (n: number) => `${n}%`;

// Fetches GET /stock-analyst/decision/:symbol, optionally augmented with the
// undocumented (server-side-only) ?portfolioId= query param — the generated
// hook can't express this without re-triggering Orval's known duplicate-
// GetXParams-export collision (first disclosed at Sprint 40 for
// /trading/structure/:symbol's own ?interval=/?lookback= overrides), so this
// page composes a plain useQuery around the same generated fetch function
// instead, matching its own query-key convention plus the optional
// portfolioId.
function useInstitutionalDecision(symbol: string, portfolioId: number | null) {
  return useQuery<InstitutionalDecisionAnalysis>({
    queryKey: [...getGetInstitutionalDecisionQueryKey(symbol), portfolioId ?? null],
    queryFn: async () => {
      if (portfolioId == null) return getInstitutionalDecision(symbol);
      const res = await fetch(`/api/stock-analyst/decision/${encodeURIComponent(symbol)}?portfolioId=${portfolioId}`);
      if (!res.ok) throw new Error(`Unknown symbol: ${symbol}`);
      return res.json();
    },
    enabled: !!symbol,
    retry: false,
  });
}

export default function DecisionEngine() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [symbolInput, setSymbolInput] = useState("");
  const [symbol, setSymbol] = useState<string | null>(null);
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  const { data: portfolios } = useGetPortfolios();

  // Deep-link support: ?symbol= (mirrors StockResearch.tsx's own precedent)
  // and ?portfolioId= (mirrors PortfolioConstruction.tsx's own precedent).
  const search = useSearch();
  const autoRanRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(search);
    const sym = params.get("symbol");
    const pid = params.get("portfolioId");
    if (sym && autoRanRef.current !== sym) {
      autoRanRef.current = sym;
      setSymbolInput(sym);
      setSymbol(sym.toUpperCase());
      if (pid && Number.isInteger(Number(pid))) setPortfolioId(Number(pid));
    }
  }, [search]);

  const { data: decision, isLoading, isError } = useInstitutionalDecision(symbol ?? "", portfolioId);

  const { data: snapshots } = useGetDecisionSnapshots(symbol ?? "", {
    query: { queryKey: getGetDecisionSnapshotsQueryKey(symbol ?? ""), enabled: !!symbol },
  });
  const { data: notes } = useGetDecisionNotes(symbol ?? "", {
    query: { queryKey: getGetDecisionNotesQueryKey(symbol ?? ""), enabled: !!symbol },
  });
  const saveSnapshot = useSaveDecisionSnapshot();
  const addNote = useAddDecisionNote();
  const updateNote = useUpdateDecisionNote();
  const deleteNote = useDeleteDecisionNote();

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    const s = symbolInput.trim().toUpperCase();
    if (!s) return;
    setSymbol(s);
  };

  const handleSaveSnapshot = () => {
    if (!symbol) return;
    saveSnapshot.mutate(
      { symbol },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDecisionSnapshotsQueryKey(symbol) });
          toast({ title: "Decision snapshot saved" });
        },
        onError: () => toast({ title: "Failed to save snapshot", variant: "destructive" }),
      },
    );
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !newNoteText.trim()) return;
    addNote.mutate(
      { symbol, data: { note: newNoteText.trim() } },
      {
        onSuccess: () => {
          setNewNoteText("");
          queryClient.invalidateQueries({ queryKey: getGetDecisionNotesQueryKey(symbol) });
        },
      },
    );
  };

  const handleUpdateNote = (id: number) => {
    updateNote.mutate(
      { id, data: { note: editingNoteText } },
      {
        onSuccess: () => {
          setEditingNoteId(null);
          if (symbol) queryClient.invalidateQueries({ queryKey: getGetDecisionNotesQueryKey(symbol) });
        },
      },
    );
  };

  const handleDeleteNote = (id: number) => {
    deleteNote.mutate(
      { id },
      {
        onSuccess: () => {
          if (symbol) queryClient.invalidateQueries({ queryKey: getGetDecisionNotesQueryKey(symbol) });
        },
      },
    );
  };

  const analyzedPortfolioName = useMemo(
    () => portfolios?.find((p) => p.id === portfolioId)?.name ?? null,
    [portfolios, portfolioId],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Gavel className="w-6 h-6 text-indigo-400" /> Institutional Decision Engine
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          A deterministic Buy/Accumulate/Hold/Reduce/Sell/Avoid recommendation, checklist, and evidence for any
          symbol — pure synthesis of already-computed Business Quality, Competitive Advantage, Management Quality,
          Capital Allocation, Financial Strength, Valuation, Margin of Safety, the Investment Committee, and Tom
          Nash's conviction score. Education &amp; advisory only — never places, schedules, or submits any trade.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="decision-engine-labels">
          <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-400">
            Institutional Decision Engine
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Educational
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Evidence Based
          </Badge>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-4">
          <form onSubmit={handleAnalyze} className="flex flex-wrap gap-2 items-center">
            <Input
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              placeholder="Symbol, e.g. AAPL"
              className="max-w-[180px]"
              data-testid="input-decision-symbol"
            />
            <Select
              value={portfolioId ? String(portfolioId) : "none"}
              onValueChange={(v) => setPortfolioId(v === "none" ? null : Number(v))}
            >
              <SelectTrigger className="w-[220px]" data-testid="select-decision-portfolio">
                <SelectValue placeholder="No portfolio context" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No portfolio context</SelectItem>
                {(portfolios ?? []).map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" className="gap-1.5" data-testid="button-analyze-decision">
              <Search className="w-4 h-4" /> Analyze
            </Button>
          </form>
        </CardContent>
      </Card>

      {!symbol && (
        <p className="text-sm text-muted-foreground" data-testid="decision-engine-empty">
          Enter a symbol above (optionally with a portfolio for Portfolio Fit / Risk / Diversification context) to
          get a deterministic recommendation.
        </p>
      )}

      {symbol && isLoading && <Skeleton className="h-64 w-full" />}
      {symbol && isError && (
        <p className="text-sm text-destructive" data-testid="decision-engine-error">
          Unknown symbol: {symbol}
        </p>
      )}

      {symbol && decision && (
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="evidence" data-testid="tab-evidence">Evidence</TabsTrigger>
            <TabsTrigger value="checklist" data-testid="tab-checklist">Checklist</TabsTrigger>
            <TabsTrigger value="risks" data-testid="tab-risks">Risks</TabsTrigger>
            <TabsTrigger value="catalysts" data-testid="tab-catalysts">Catalysts</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {decision.symbol}
                    <Badge className={recommendationBadgeClass(decision.recommendation)} data-testid="decision-recommendation">
                      {decision.recommendation}
                    </Badge>
                  </CardTitle>
                  <Badge variant="outline" className="font-mono" data-testid="decision-confidence">
                    Confidence {decision.confidence}/100
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                  <Link
                    href={`/stock-analyst/investment-committee?symbol=${decision.symbol}${portfolioId ? `&portfolioId=${portfolioId}` : ""}`}
                    className="text-primary hover:underline"
                    data-testid="link-investment-committee"
                  >
                    Open Investment Committee Workbench →
                  </Link>
                  <Link
                    href={`/research-terminal?symbol=${decision.symbol}${portfolioId ? `&portfolioId=${portfolioId}` : ""}`}
                    className="text-primary hover:underline"
                    data-testid="link-research-terminal"
                  >
                    Open Research Terminal →
                  </Link>
                </p>
                {portfolioId && analyzedPortfolioName && (
                  <p className="text-xs text-muted-foreground">
                    Evaluated against portfolio: {analyzedPortfolioName} —{" "}
                    <Link href={`/stock-analyst/portfolio-optimisation?portfolioId=${portfolioId}`} className="text-primary hover:underline" data-testid="link-portfolio-optimisation">
                      Review Portfolio Optimisation →
                    </Link>
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{decision.summary}</p>
                <p className="text-sm text-muted-foreground">{decision.explanation}</p>
                {decision.drivers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Key drivers</p>
                    <ul className="text-sm space-y-1 list-disc pl-4">
                      {decision.drivers.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Strengths</p>
                    {decision.strengths.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None identified.</p>
                    ) : (
                      <ul className="text-sm space-y-1 list-disc pl-4">
                        {decision.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Weaknesses</p>
                    {decision.weaknesses.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None identified.</p>
                    ) : (
                      <ul className="text-sm space-y-1 list-disc pl-4">
                        {decision.weaknesses.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="outline" data-testid="decision-management-quality">
                    Management:{" "}
                    {decision.managementQuality.available ? `${decision.managementQuality.score}/100` : "unavailable"}
                  </Badge>
                  <Badge variant="outline" data-testid="decision-portfolio-fit">
                    Portfolio Fit: {decision.portfolioFit.available ? (decision.portfolioFit.alreadyHeld ? "Already held" : "Not held") : "unavailable"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t border-border">{decision.disclaimer}</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Why Buy</CardTitle></CardHeader>
                <CardContent>
                  <ul className="text-xs space-y-1 list-disc pl-4">
                    {decision.whyBuy.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Why Wait</CardTitle></CardHeader>
                <CardContent>
                  <ul className="text-xs space-y-1 list-disc pl-4">
                    {decision.whyWait.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Why Sell</CardTitle></CardHeader>
                <CardContent>
                  <ul className="text-xs space-y-1 list-disc pl-4">
                    {decision.whySell.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="evidence" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Supporting Evidence</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {decision.supportingEvidence.length === 0 && <p className="text-xs text-muted-foreground">None.</p>}
                  {decision.supportingEvidence.map((e, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{e.label}:</span> <span className="text-muted-foreground">{e.detail}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Contradicting Evidence</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {decision.contradictingEvidence.length === 0 && <p className="text-xs text-muted-foreground">None.</p>}
                  {decision.contradictingEvidence.map((e, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium">{e.label}:</span> <span className="text-muted-foreground">{e.detail}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="checklist" className="mt-4 space-y-2" data-testid="checklist-panel">
            {decision.checklist.map((item) => (
              <Card key={item.id} className="bg-card border-border">
                <CardContent className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.explanation}</p>
                  </div>
                  <Badge className={checklistBadgeClass(item.status)} data-testid={`checklist-status-${item.id}`}>
                    {item.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="risks" className="mt-4 space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Risks</CardTitle></CardHeader>
              <CardContent>
                {decision.risks.length === 0 && <p className="text-xs text-muted-foreground">None identified.</p>}
                <ul className="text-sm space-y-1 list-disc pl-4">
                  {decision.risks.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Things to Monitor</CardTitle></CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1 list-disc pl-4">
                  {decision.thingsToMonitor.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="catalysts" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Catalysts</CardTitle></CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1 list-disc pl-4">
                  {decision.catalysts.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-4">
            <Button size="sm" onClick={handleSaveSnapshot} className="gap-1.5" data-testid="button-save-decision-snapshot">
              <Save className="w-4 h-4" /> Save Snapshot
            </Button>
            {(!snapshots || snapshots.length === 0) ? (
              <p className="text-sm text-muted-foreground" data-testid="decision-history-empty">No saved snapshots yet.</p>
            ) : (
              <div className="space-y-2" data-testid="decision-history-list">
                {snapshots.map((s) => (
                  <Card key={s.id} className="bg-card border-border">
                    <CardContent className="py-3 flex items-center justify-between">
                      <div>
                        <Badge className={recommendationBadgeClass(s.recommendation)}>{s.recommendation}</Badge>
                        <span className="text-xs text-muted-foreground ml-2">Confidence {s.confidence}/100</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="notes" className="mt-4 space-y-4">
            <form onSubmit={handleAddNote} className="space-y-2">
              <Textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Add a decision note..."
                data-testid="new-decision-note-text"
              />
              <Button type="submit" size="sm" disabled={!newNoteText.trim()} data-testid="button-add-decision-note">
                Add Note
              </Button>
            </form>
            {(!notes || notes.length === 0) ? (
              <p className="text-sm text-muted-foreground" data-testid="decision-notes-empty">No notes yet.</p>
            ) : (
              <div className="space-y-2">
                {notes.map((n) => (
                  <Card key={n.id} className="bg-card border-border" data-testid={`decision-note-${n.id}`}>
                    <CardContent className="py-3 space-y-2">
                      {editingNoteId === n.id ? (
                        <>
                          <Textarea
                            value={editingNoteText}
                            onChange={(e) => setEditingNoteText(e.target.value)}
                            data-testid={`edit-decision-note-text-${n.id}`}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleUpdateNote(n.id)} data-testid={`save-decision-note-${n.id}`}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingNoteId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm">{n.note}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{new Date(n.updatedAt).toLocaleString()}</span>
                            <div className="flex gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingNoteId(n.id);
                                  setEditingNoteText(n.note);
                                }}
                                data-testid={`edit-decision-note-${n.id}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleDeleteNote(n.id)}
                                data-testid={`delete-decision-note-${n.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
