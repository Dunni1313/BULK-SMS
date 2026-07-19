// Phase 2, Sprint 28 — Portfolio Construction. Advisory/education only: this
// page never previews, schedules, or submits any order, and never touches a
// real brokerage account. Distinct from /portfolio (the Options Income
// Engine's real, trades-backed account view).
//
// Phase 13 — Institutional Portfolio Manager. Extended into a tabbed
// experience (Overview/Holdings/Allocation/Quality/Risk/Performance/Income/
// Snapshots/Timeline/Notes) composing the new on-demand
// GET .../portfolios/:id/intelligence endpoint (lib/portfolioIntelligence.ts)
// — every score/allocation figure here is reused, never recomputed on this
// page. The original Holdings table and Risk panel are unchanged in
// substance, only relocated into their own tabs.

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearch, Link } from "wouter";
import {
  useGetPortfolios,
  useCreatePortfolio,
  useDeletePortfolio,
  useGetPortfolio,
  useAddHolding,
  useUpdateHolding,
  useDeleteHolding,
  useGetValueWatchlist,
  useGetPortfolioRisk,
  useSaveRiskSnapshot,
  useGetPortfolioRiskSnapshots,
  useGetPortfolioIntelligence,
  useGetPortfolioWatchlistComparison,
  useGetPortfolioSnapshots,
  useSavePortfolioSnapshot,
  useGetPortfolioNotes,
  useAddPortfolioNote,
  useUpdatePortfolioNote,
  useDeletePortfolioNote,
  getGetPortfoliosQueryKey,
  getGetPortfolioQueryKey,
  getGetPortfolioRiskQueryKey,
  getGetPortfolioRiskSnapshotsQueryKey,
  getGetPortfolioIntelligenceQueryKey,
  getGetPortfolioWatchlistComparisonQueryKey,
  getGetPortfolioSnapshotsQueryKey,
  getGetPortfolioNotesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Plus, Trash2, Star, Save, Pencil, Gavel, Building2, Users } from "lucide-react";

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const fmtPct = (n: number, dp = 1) => `${(n * 100).toFixed(dp)}%`;

function rebalanceBadgeClass(action: string): string {
  if (action === "buy") return "border-emerald-500/40 text-emerald-400";
  if (action === "sell") return "border-rose-500/40 text-rose-400";
  if (action === "hold") return "border-border text-muted-foreground";
  return "border-border text-muted-foreground/60";
}

function riskScoreClass(score: number | null | undefined): string {
  if (score == null) return "border-border text-muted-foreground";
  if (score >= 65) return "border-emerald-500/40 text-emerald-400";
  if (score >= 50) return "border-amber-500/40 text-amber-400";
  return "border-rose-500/40 text-rose-400";
}

function scoreCardBadgeClass(score: number | null): string {
  return riskScoreClass(score);
}

export default function PortfolioConstruction() {
  const { data: portfolios, isLoading: portfoliosLoading } = useGetPortfolios();
  const { data: watchlist } = useGetValueWatchlist();
  const createPortfolio = useCreatePortfolio();
  const deletePortfolio = useDeletePortfolio();
  const addHolding = useAddHolding();
  const updateHolding = useUpdateHolding();
  const deleteHolding = useDeleteHolding();
  const saveRiskSnapshot = useSaveRiskSnapshot();
  const savePortfolioSnapshot = useSavePortfolioSnapshot();
  const addNote = useAddPortfolioNote();
  const updateNote = useUpdatePortfolioNote();
  const deleteNote = useDeletePortfolioNote();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [newTargetWeight, setNewTargetWeight] = useState("");
  const [newShares, setNewShares] = useState("");
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  // Deep-link support (Phase 13): arriving with a ?portfolioId= query param
  // (e.g. from the Command Palette's "Portfolios" group) auto-selects that
  // portfolio, mirroring StockResearch.tsx's own ?symbol= precedent. Runs
  // once per value.
  const search = useSearch();
  const autoSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(search);
    const raw = params.get("portfolioId");
    if (raw && autoSelectedRef.current !== raw) {
      const id = Number(raw);
      if (Number.isInteger(id)) {
        autoSelectedRef.current = raw;
        setSelectedId(id);
      }
    }
  }, [search]);

  const {
    data: detail,
    isLoading: detailLoading,
  } = useGetPortfolio(selectedId ?? 0, {
    query: { queryKey: getGetPortfolioQueryKey(selectedId ?? 0), enabled: selectedId != null },
  });

  const existingSymbols = useMemo(
    () => new Set((detail?.allocation.holdings ?? []).map((h) => h.symbol)),
    [detail],
  );

  const { data: risk, isLoading: riskLoading } = useGetPortfolioRisk(selectedId ?? 0, {
    query: { queryKey: getGetPortfolioRiskQueryKey(selectedId ?? 0), enabled: selectedId != null },
  });
  const { data: snapshots } = useGetPortfolioRiskSnapshots(selectedId ?? 0, {
    query: { queryKey: getGetPortfolioRiskSnapshotsQueryKey(selectedId ?? 0), enabled: selectedId != null },
  });

  const { data: intelligence, isLoading: intelligenceLoading } = useGetPortfolioIntelligence(selectedId ?? 0, {
    query: { queryKey: getGetPortfolioIntelligenceQueryKey(selectedId ?? 0), enabled: selectedId != null },
  });
  const { data: watchlistComparison } = useGetPortfolioWatchlistComparison(selectedId ?? 0, {
    query: { queryKey: getGetPortfolioWatchlistComparisonQueryKey(selectedId ?? 0), enabled: selectedId != null },
  });
  const { data: portfolioSnapshots } = useGetPortfolioSnapshots(selectedId ?? 0, {
    query: { queryKey: getGetPortfolioSnapshotsQueryKey(selectedId ?? 0), enabled: selectedId != null },
  });
  const { data: notes } = useGetPortfolioNotes(selectedId ?? 0, {
    query: { queryKey: getGetPortfolioNotesQueryKey(selectedId ?? 0), enabled: selectedId != null },
  });

  const invalidateIntelligence = () => {
    if (selectedId != null) {
      queryClient.invalidateQueries({ queryKey: getGetPortfolioIntelligenceQueryKey(selectedId) });
      queryClient.invalidateQueries({ queryKey: getGetPortfolioSnapshotsQueryKey(selectedId) });
    }
  };

  const handleSaveSnapshot = () => {
    if (selectedId == null) return;
    saveRiskSnapshot.mutate(
      { id: selectedId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPortfolioRiskSnapshotsQueryKey(selectedId) });
          toast({ title: "Risk snapshot saved" });
        },
        onError: () => toast({ title: "Failed to save risk snapshot", variant: "destructive" }),
      },
    );
  };

  const handleSavePortfolioSnapshot = () => {
    if (selectedId == null) return;
    savePortfolioSnapshot.mutate(
      { id: selectedId },
      {
        onSuccess: () => {
          invalidateIntelligence();
          toast({ title: "Portfolio snapshot saved" });
        },
        onError: () => toast({ title: "Failed to save portfolio snapshot", variant: "destructive" }),
      },
    );
  };

  const handleCreatePortfolio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createPortfolio.mutate(
      { data: { name: newName.trim(), description: newDescription.trim() } },
      {
        onSuccess: (created) => {
          queryClient.invalidateQueries({ queryKey: getGetPortfoliosQueryKey() });
          setNewName("");
          setNewDescription("");
          setSelectedId(created.id);
          toast({ title: `Portfolio "${created.name}" created` });
        },
        onError: () => toast({ title: "Failed to create portfolio", variant: "destructive" }),
      },
    );
  };

  const handleDeletePortfolio = (id: number, name: string) => {
    deletePortfolio.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPortfoliosQueryKey() });
          if (selectedId === id) setSelectedId(null);
          toast({ title: `Portfolio "${name}" deleted` });
        },
        onError: () => toast({ title: "Failed to delete portfolio", variant: "destructive" }),
      },
    );
  };

  const invalidateDetail = () => {
    if (selectedId != null) queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey(selectedId) });
    queryClient.invalidateQueries({ queryKey: getGetPortfoliosQueryKey() });
    invalidateIntelligence();
  };

  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedId == null || !newSymbol.trim()) return;
    addHolding.mutate(
      {
        id: selectedId,
        data: {
          symbol: newSymbol.trim().toUpperCase(),
          targetWeightPct: newTargetWeight ? Number(newTargetWeight) : 0,
          shares: newShares ? Number(newShares) : null,
        },
      },
      {
        onSuccess: () => {
          invalidateDetail();
          setNewSymbol("");
          setNewTargetWeight("");
          setNewShares("");
          toast({ title: `${newSymbol.trim().toUpperCase()} added` });
        },
        onError: () => toast({ title: "Failed to add holding", variant: "destructive" }),
      },
    );
  };

  // Distributes an equal target weight (100 / N) across every watchlist
  // symbol not already in this portfolio — a simple client-side convenience,
  // no new backend endpoint needed for this trivial math.
  const handleAddFromWatchlist = () => {
    if (selectedId == null || !watchlist) return;
    const toAdd = watchlist.map((w) => w.symbol).filter((s) => !existingSymbols.has(s));
    if (toAdd.length === 0) {
      toast({ title: "All watchlist symbols are already in this portfolio" });
      return;
    }
    const equalWeight = Math.round((100 / (existingSymbols.size + toAdd.length)) * 100) / 100;
    Promise.allSettled(
      toAdd.map((symbol) =>
        addHolding.mutateAsync({ id: selectedId, data: { symbol, targetWeightPct: equalWeight } }),
      ),
    ).then((results) => {
      invalidateDetail();
      const added = results.filter((r) => r.status === "fulfilled").length;
      toast({ title: `${added} name${added === 1 ? "" : "s"} added from watchlist` });
    });
  };

  const handleUpdateTargetWeight = (holdingId: number, value: string) => {
    if (selectedId == null) return;
    const n = Number(value);
    if (Number.isNaN(n)) return;
    updateHolding.mutate(
      { id: selectedId, holdingId, data: { targetWeightPct: n } },
      { onSuccess: invalidateDetail, onError: () => toast({ title: "Failed to update target weight", variant: "destructive" }) },
    );
  };

  const handleUpdateShares = (holdingId: number, value: string) => {
    if (selectedId == null) return;
    const n = value === "" ? null : Number(value);
    if (n != null && Number.isNaN(n)) return;
    updateHolding.mutate(
      { id: selectedId, holdingId, data: { shares: n } },
      { onSuccess: invalidateDetail, onError: () => toast({ title: "Failed to update shares", variant: "destructive" }) },
    );
  };

  const handleUpdateCostBasis = (holdingId: number, value: string) => {
    if (selectedId == null) return;
    const n = value === "" ? null : Number(value);
    if (n != null && Number.isNaN(n)) return;
    updateHolding.mutate(
      { id: selectedId, holdingId, data: { avgCostBasis: n } },
      { onSuccess: invalidateDetail, onError: () => toast({ title: "Failed to update cost basis", variant: "destructive" }) },
    );
  };

  const handleDeleteHolding = (holdingId: number, symbol: string) => {
    if (selectedId == null) return;
    deleteHolding.mutate(
      { id: selectedId, holdingId },
      {
        onSuccess: () => {
          invalidateDetail();
          toast({ title: `${symbol} removed` });
        },
        onError: () => toast({ title: "Failed to remove holding", variant: "destructive" }),
      },
    );
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedId == null || !newNoteText.trim()) return;
    addNote.mutate(
      { id: selectedId, data: { note: newNoteText.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPortfolioNotesQueryKey(selectedId) });
          setNewNoteText("");
          toast({ title: "Note added" });
        },
        onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
      },
    );
  };

  const handleSaveEditedNote = (noteId: number) => {
    if (selectedId == null || !editingNoteText.trim()) return;
    updateNote.mutate(
      { id: selectedId, noteId, data: { note: editingNoteText.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPortfolioNotesQueryKey(selectedId) });
          setEditingNoteId(null);
          setEditingNoteText("");
          toast({ title: "Note updated" });
        },
        onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
      },
    );
  };

  const handleDeleteNote = (noteId: number) => {
    if (selectedId == null) return;
    deleteNote.mutate(
      { id: selectedId, noteId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPortfolioNotesQueryKey(selectedId) });
          toast({ title: "Note deleted" });
        },
        onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-indigo-400" /> Institutional Portfolio Manager
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Build a target-allocation portfolio from your watchlist and track quality, risk, diversification,
          performance, and income analytics over time. Education &amp; advisory only — this page never places,
          schedules, or submits any trade.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="portfolio-manager-labels">
          <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-400">
            Institutional Portfolio Manager
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Educational
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
            Data Driven
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Your Portfolios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleCreatePortfolio} className="space-y-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Portfolio name"
                className="bg-background"
                data-testid="new-portfolio-name"
              />
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                className="bg-background"
              />
              <Button type="submit" size="sm" className="w-full gap-1.5" disabled={!newName.trim() || createPortfolio.isPending} data-testid="create-portfolio-button">
                <Plus className="w-3.5 h-3.5" /> Create Portfolio
              </Button>
            </form>

            <div className="space-y-1.5 pt-2">
              {portfoliosLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : !portfolios || portfolios.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No portfolios yet.</p>
              ) : (
                portfolios.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer ${
                      selectedId === p.id ? "border-indigo-500/50 bg-indigo-500/10" : "border-border/60 bg-background/40"
                    }`}
                    onClick={() => setSelectedId(p.id)}
                    data-testid={`portfolio-${p.name}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.holdingsCount} holding{p.holdingsCount === 1 ? "" : "s"}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-rose-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePortfolio(p.id, p.name);
                      }}
                      aria-label={`Delete portfolio ${p.name}`}
                      data-testid={`delete-portfolio-${p.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">{detail ? detail.name : "Select a portfolio"}</CardTitle>
              {detail && (
                <Link
                  href={`/stock-analyst/portfolio-optimisation?portfolioId=${detail.id}`}
                  className="text-xs font-medium text-primary hover:underline shrink-0"
                  data-testid="open-portfolio-optimisation-link"
                >
                  Open Portfolio Optimisation →
                </Link>
              )}
            </div>
            {detail?.description && <CardDescription className="text-[11px]">{detail.description}</CardDescription>}
          </CardHeader>
          <CardContent>
            {selectedId == null ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Select or create a portfolio to view its holdings.
              </p>
            ) : detailLoading || !detail ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : (
              <Tabs defaultValue="overview">
                <TabsList className="flex-wrap h-auto">
                  <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                  <TabsTrigger value="holdings" data-testid="tab-holdings">Holdings</TabsTrigger>
                  <TabsTrigger value="allocation" data-testid="tab-allocation">Allocation</TabsTrigger>
                  <TabsTrigger value="quality" data-testid="tab-quality">Quality</TabsTrigger>
                  <TabsTrigger value="risk" data-testid="tab-risk">Risk</TabsTrigger>
                  <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
                  <TabsTrigger value="income" data-testid="tab-income">Income</TabsTrigger>
                  <TabsTrigger value="snapshots" data-testid="tab-snapshots">Snapshots</TabsTrigger>
                  <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
                </TabsList>

                {/* ─── Overview ──────────────────────────────────────────── */}
                <TabsContent value="overview" className="mt-4 space-y-4">
                  {intelligenceLoading || !intelligence ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={`text-[10px] ${scoreCardBadgeClass(intelligence.qualityScore.score)}`}>
                          Quality: {intelligence.qualityScore.score ?? "N/A"} ({intelligence.qualityScore.label})
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${scoreCardBadgeClass(intelligence.capitalAllocationScore.score)}`}>
                          Capital Allocation: {intelligence.capitalAllocationScore.score ?? "N/A"}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${scoreCardBadgeClass(intelligence.diversificationScore.score)}`}>
                          Diversification: {intelligence.diversificationScore.score ?? "N/A"}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${scoreCardBadgeClass(intelligence.risk.overall.score)}`}>
                          Overall Risk: {intelligence.risk.overall.score ?? "N/A"} ({intelligence.risk.overall.label})
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{intelligence.summary}</p>

                      {watchlistComparison && (
                        <Card className="bg-background/40 border-border/60">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs flex items-center gap-1.5">
                              <Star className="w-3.5 h-3.5 text-indigo-400" /> Watchlist vs. Portfolio
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-xs text-muted-foreground space-y-1">
                            <p>{watchlistComparison.summary}</p>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <Badge variant="outline" className="text-[9px] border-border">In both: {watchlistComparison.inBoth.length}</Badge>
                              <Badge variant="outline" className="text-[9px] border-border">Watchlist only: {watchlistComparison.onlyInWatchlist.length}</Badge>
                              <Badge variant="outline" className="text-[9px] border-border">Portfolio only: {watchlistComparison.onlyInPortfolio.length}</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* ─── Holdings (original content, relocated) ───────────── */}
                <TabsContent value="holdings" className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-border">
                      {detail.allocation.totalMarketValue != null ? fmtUsd(detail.allocation.totalMarketValue) : "Market value unavailable"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-border">
                      Targets sum to {detail.allocation.totalTargetWeightPct}%
                    </Badge>
                    <Button size="sm" variant="outline" className="ml-auto h-7 text-[11px] gap-1" onClick={handleAddFromWatchlist} data-testid="add-from-watchlist">
                      <Star className="w-3 h-3" /> Add from Watchlist
                    </Button>
                  </div>
                  {detail.allocation.targetWeightSumWarning && (
                    <p className="text-[11px] text-amber-400">{detail.allocation.targetWeightSumWarning}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{detail.allocation.summary}</p>

                  <form onSubmit={handleAddHolding} className="flex flex-wrap gap-2 items-end">
                    <Input value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="Symbol" className="bg-background w-24" data-testid="new-holding-symbol" />
                    <Input value={newTargetWeight} onChange={(e) => setNewTargetWeight(e.target.value)} placeholder="Target %" type="number" className="bg-background w-24" />
                    <Input value={newShares} onChange={(e) => setNewShares(e.target.value)} placeholder="Shares" type="number" className="bg-background w-24" />
                    <Button type="submit" size="sm" disabled={!newSymbol.trim() || addHolding.isPending} data-testid="add-holding-button">
                      Add Holding
                    </Button>
                  </form>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left font-medium py-2 pr-3">Symbol</th>
                          <th className="text-right font-medium py-2 pr-3">Target %</th>
                          <th className="text-right font-medium py-2 pr-3">Shares</th>
                          <th className="text-right font-medium py-2 pr-3">Cost Basis</th>
                          <th className="text-right font-medium py-2 pr-3">Price</th>
                          <th className="text-right font-medium py-2 pr-3">Actual %</th>
                          <th className="text-right font-medium py-2 pr-3">Drift</th>
                          <th className="text-right font-medium py-2 pr-3">Rebalance</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {detail.allocation.holdings.map((h) => (
                          <tr key={h.id} className="border-b border-border/40" data-testid={`holding-${h.symbol}`}>
                            <td className="py-2 pr-3 font-medium text-foreground/90">{h.symbol}</td>
                            <td className="py-2 pr-3 text-right">
                              <Input
                                defaultValue={h.targetWeightPct}
                                type="number"
                                className="bg-background h-6 w-16 text-right ml-auto"
                                onBlur={(e) => handleUpdateTargetWeight(h.id, e.target.value)}
                              />
                            </td>
                            <td className="py-2 pr-3 text-right">
                              <Input
                                defaultValue={h.shares ?? ""}
                                type="number"
                                placeholder="—"
                                className="bg-background h-6 w-16 text-right ml-auto"
                                onBlur={(e) => handleUpdateShares(h.id, e.target.value)}
                              />
                            </td>
                            <td className="py-2 pr-3 text-right">
                              <Input
                                defaultValue={h.avgCostBasis ?? ""}
                                type="number"
                                placeholder="—"
                                className="bg-background h-6 w-20 text-right ml-auto"
                                onBlur={(e) => handleUpdateCostBasis(h.id, e.target.value)}
                                data-testid={`cost-basis-input-${h.symbol}`}
                              />
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">{h.currentPrice != null ? fmtUsd(h.currentPrice) : "n/a"}</td>
                            <td className="py-2 pr-3 text-right font-mono">{h.actualWeightPct != null ? `${h.actualWeightPct}%` : "n/a"}</td>
                            <td className="py-2 pr-3 text-right font-mono">{h.driftPct != null ? `${h.driftPct > 0 ? "+" : ""}${h.driftPct}pp` : "n/a"}</td>
                            <td className="py-2 pr-3 text-right">
                              <Badge variant="outline" className={`text-[9px] capitalize ${rebalanceBadgeClass(h.rebalanceAction)}`}>
                                {h.rebalanceAction}
                              </Badge>
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Link href={`/stock-analyst?symbol=${h.symbol}`}>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-muted-foreground hover:text-indigo-400"
                                    aria-label={`Open Value Research for ${h.symbol}`}
                                    data-testid={`value-research-link-${h.symbol}`}
                                  >
                                    <Building2 className="w-3 h-3" />
                                  </Button>
                                </Link>
                                <Link href={`/decision-engine?symbol=${h.symbol}&portfolioId=${selectedId}`}>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-muted-foreground hover:text-indigo-400"
                                    aria-label={`Get decision for ${h.symbol}`}
                                    data-testid={`decision-link-${h.symbol}`}
                                  >
                                    <Gavel className="w-3 h-3" />
                                  </Button>
                                </Link>
                                <Link href={`/stock-analyst/investment-committee?symbol=${h.symbol}&portfolioId=${selectedId}`}>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-muted-foreground hover:text-indigo-400"
                                    aria-label={`Review ${h.symbol} in the Investment Committee`}
                                    data-testid={`committee-link-${h.symbol}`}
                                  >
                                    <Users className="w-3 h-3" />
                                  </Button>
                                </Link>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-muted-foreground hover:text-rose-400"
                                  onClick={() => handleDeleteHolding(h.id, h.symbol)}
                                  aria-label={`Remove holding ${h.symbol}`}
                                  data-testid={`remove-holding-${h.symbol}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {detail.allocation.holdings.length === 0 && (
                      <p className="text-sm text-muted-foreground py-8 text-center">
                        No holdings yet. Add a symbol above or pull names from your watchlist.
                      </p>
                    )}
                  </div>

                  {intelligence && intelligence.holdings.some((h) => h.suggestedShareDelta != null) && (
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-1.5">Position sizing / rebalancing assistant (suggested share delta):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {intelligence.holdings
                          .filter((h) => h.suggestedShareDelta != null)
                          .map((h) => (
                            <Badge key={h.symbol} variant="outline" className={`text-[9px] ${h.suggestedShareDelta! > 0 ? "border-emerald-500/40 text-emerald-400" : h.suggestedShareDelta! < 0 ? "border-rose-500/40 text-rose-400" : "border-border text-muted-foreground"}`}>
                              {h.symbol}: {h.suggestedShareDelta! > 0 ? "+" : ""}{h.suggestedShareDelta} shares
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ─── Allocation ────────────────────────────────────────── */}
                <TabsContent value="allocation" className="mt-4 space-y-4">
                  {intelligenceLoading || !intelligence ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <div className="space-y-4" data-testid="allocation-content">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-[10px] border-border">
                          Largest position: {intelligence.allocation.largestPositionPct != null ? `${intelligence.allocation.largestPositionPct}%` : "N/A"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-border">
                          Top 10 exposure: {intelligence.allocation.top10ExposurePct != null ? `${intelligence.allocation.top10ExposurePct}%` : "N/A"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-border">
                          Cash allocation: {intelligence.allocation.cashAllocationPct != null ? `${intelligence.allocation.cashAllocationPct}%` : "N/A"}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">{intelligence.allocation.cashAllocationNote}</p>

                      {(
                        [
                          ["By Sector", intelligence.allocation.bySector],
                          ["By Industry", intelligence.allocation.byIndustry],
                          ["By Market Cap", intelligence.allocation.byMarketCapBand],
                          ["Growth vs. Value Mix", intelligence.allocation.growthValueMix],
                          ["Quality Mix", intelligence.allocation.qualityMix],
                        ] as const
                      ).map(([label, slices]) => (
                        <div key={label}>
                          <p className="text-xs font-medium text-foreground/90 mb-1">{label}</p>
                          {slices.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">No data available.</p>
                          ) : (
                            <div className="space-y-1">
                              {slices.map((s) => (
                                <div key={s.label} className="flex items-center gap-2 text-[11px]">
                                  <span className="w-32 truncate text-muted-foreground">{s.label}</span>
                                  <div className="flex-1 h-2 rounded-full bg-background/60 overflow-hidden">
                                    <div className="h-full bg-indigo-500/60" style={{ width: `${s.weightPct}%` }} />
                                  </div>
                                  <span className="w-12 text-right font-mono">{s.weightPct}%</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                        <p data-testid="country-unavailable">Country exposure: {intelligence.allocation.byCountry.reason}</p>
                        <p data-testid="currency-unavailable">Currency exposure: {intelligence.allocation.byCurrency.reason}</p>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ─── Quality ───────────────────────────────────────────── */}
                <TabsContent value="quality" className="mt-4 space-y-4">
                  {intelligenceLoading || !intelligence ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={`text-[10px] ${scoreCardBadgeClass(intelligence.qualityScore.score)}`}>
                          Quality: {intelligence.qualityScore.score ?? "N/A"}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${scoreCardBadgeClass(intelligence.capitalAllocationScore.score)}`}>
                          Capital Allocation: {intelligence.capitalAllocationScore.score ?? "N/A"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{intelligence.qualityScore.detail}</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border">
                              <th className="text-left font-medium py-2 pr-3">Symbol</th>
                              <th className="text-right font-medium py-2 pr-3">Quality</th>
                              <th className="text-right font-medium py-2 pr-3">Capital Alloc.</th>
                              <th className="text-right font-medium py-2 pr-3">Growth</th>
                              <th className="text-right font-medium py-2 pr-3">Valuation</th>
                              <th className="text-right font-medium py-2 pr-3">Committee</th>
                            </tr>
                          </thead>
                          <tbody>
                            {intelligence.holdings.map((h) => (
                              <tr key={h.symbol} className="border-b border-border/40">
                                <td className="py-2 pr-3 font-medium text-foreground/90">{h.symbol}</td>
                                <td className="py-2 pr-3 text-right font-mono">{h.qualityScore ?? "n/a"}</td>
                                <td className="py-2 pr-3 text-right font-mono">{h.capitalAllocationScore ?? "n/a"}</td>
                                <td className="py-2 pr-3 text-right font-mono">{h.growthScore ?? "n/a"}</td>
                                <td className="py-2 pr-3 text-right">{h.valuationRating ?? "n/a"}</td>
                                <td className="py-2 pr-3 text-right">{h.committeeVerdict ?? "n/a"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ─── Risk (original panel + extended dimensions) ──────── */}
                <TabsContent value="risk" className="mt-4 space-y-4" data-testid="risk-panel">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[11px]">
                      Concentration, sector exposure, and market-sensitivity (beta) — computed fresh, never stored unless you save a snapshot.
                    </CardDescription>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1 shrink-0"
                      onClick={handleSaveSnapshot}
                      disabled={saveRiskSnapshot.isPending || risk?.overall.score == null}
                      data-testid="save-snapshot-button"
                    >
                      <Save className="w-3 h-3" /> Save Risk Snapshot
                    </Button>
                  </div>
                  {riskLoading || !risk ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${riskScoreClass(risk.overall.score)}`} data-testid="risk-overall-badge">
                          Overall: {risk.overall.score ?? "N/A"} ({risk.overall.label})
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${risk.concentration.capBreached ? "border-rose-500/40 text-rose-400" : "border-border text-muted-foreground"}`}>
                          Concentration: {risk.concentration.score ?? "N/A"}
                          {risk.concentration.largestSymbol ? ` (${risk.concentration.largestSymbol} ${risk.concentration.largestSymbolWeightPct}%)` : ""}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${risk.sectorExposure.capBreached ? "border-rose-500/40 text-rose-400" : "border-border text-muted-foreground"}`}>
                          Sector: {risk.sectorExposure.score ?? "N/A"}
                          {risk.sectorExposure.largestSector ? ` (${risk.sectorExposure.largestSector} ${risk.sectorExposure.largestSectorWeightPct}%)` : ""}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                          Beta: {risk.betaEstimate.portfolioBeta ?? "N/A"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{risk.overall.detail}</p>
                    </div>
                  )}

                  {intelligence && (
                    <div className="pt-3 border-t border-border/60 space-y-2" data-testid="extended-risk">
                      <p className="text-xs font-medium text-foreground/90">Extended Risk Dimensions</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(
                          [
                            ["Cash Risk", intelligence.risk.cashRisk],
                            ["Dividend Dependence", intelligence.risk.dividendDependence],
                            ["Leverage Exposure", intelligence.risk.leverageExposure],
                            ["Quality Drift", intelligence.risk.qualityDrift],
                            ["Portfolio Stability", intelligence.risk.portfolioStability],
                          ] as const
                        ).map(([label, card]) => (
                          <div key={label} className="rounded-md border border-border/60 bg-background/40 p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-medium text-foreground/90">{label}</span>
                              <Badge variant="outline" className={`text-[9px] ${scoreCardBadgeClass(card.score)}`}>
                                {card.score ?? "N/A"}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">{card.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ─── Performance ───────────────────────────────────────── */}
                <TabsContent value="performance" className="mt-4 space-y-4">
                  {intelligenceLoading || !intelligence ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-[10px] border-border">
                          Cost basis: {intelligence.performance.totalCostBasisValue != null ? fmtUsd(intelligence.performance.totalCostBasisValue) : "N/A"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-border">
                          Market value: {intelligence.performance.totalMarketValue != null ? fmtUsd(intelligence.performance.totalMarketValue) : "N/A"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            intelligence.performance.totalUnrealizedPnl == null
                              ? "border-border text-muted-foreground"
                              : intelligence.performance.totalUnrealizedPnl >= 0
                                ? "border-emerald-500/40 text-emerald-400"
                                : "border-rose-500/40 text-rose-400"
                          }`}
                        >
                          Unrealized P&amp;L: {intelligence.performance.totalUnrealizedPnl != null ? fmtUsd(intelligence.performance.totalUnrealizedPnl) : "N/A"}
                          {intelligence.performance.totalUnrealizedPnlPct != null ? ` (${intelligence.performance.totalUnrealizedPnlPct}%)` : ""}
                        </Badge>
                      </div>
                      {intelligence.performance.holdingsWithoutCostBasis.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          No cost basis entered for: {intelligence.performance.holdingsWithoutCostBasis.join(", ")} — enter one on the Holdings tab.
                        </p>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border">
                              <th className="text-left font-medium py-2 pr-3">Symbol</th>
                              <th className="text-right font-medium py-2 pr-3">Cost Basis Value</th>
                              <th className="text-right font-medium py-2 pr-3">Market Value</th>
                              <th className="text-right font-medium py-2 pr-3">Unrealized P&amp;L</th>
                              <th className="text-right font-medium py-2 pr-3">P&amp;L %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {intelligence.holdings.map((h) => (
                              <tr key={h.symbol} className="border-b border-border/40">
                                <td className="py-2 pr-3 font-medium text-foreground/90">{h.symbol}</td>
                                <td className="py-2 pr-3 text-right font-mono">{h.costBasisValue != null ? fmtUsd(h.costBasisValue) : "n/a"}</td>
                                <td className="py-2 pr-3 text-right font-mono">{h.marketValue != null ? fmtUsd(h.marketValue) : "n/a"}</td>
                                <td className="py-2 pr-3 text-right font-mono">{h.unrealizedPnl != null ? fmtUsd(h.unrealizedPnl) : "n/a"}</td>
                                <td className="py-2 pr-3 text-right font-mono">{h.unrealizedPnlPct != null ? `${h.unrealizedPnlPct}%` : "n/a"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ─── Income ────────────────────────────────────────────── */}
                <TabsContent value="income" className="mt-4 space-y-4">
                  {intelligenceLoading || !intelligence ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-[10px] border-border">
                          Portfolio dividend yield: {intelligence.income.portfolioDividendYield != null ? fmtPct(intelligence.income.portfolioDividendYield, 2) : "N/A"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-border">
                          Est. annual income: {intelligence.income.estAnnualDividendIncome != null ? fmtUsd(intelligence.income.estAnnualDividendIncome) : "N/A"}
                        </Badge>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground border-b border-border">
                              <th className="text-left font-medium py-2 pr-3">Symbol</th>
                              <th className="text-right font-medium py-2 pr-3">Dividend Yield</th>
                              <th className="text-right font-medium py-2 pr-3">Dividend / Share</th>
                              <th className="text-right font-medium py-2 pr-3">Est. Annual Income</th>
                            </tr>
                          </thead>
                          <tbody>
                            {intelligence.holdings.map((h) => (
                              <tr key={h.symbol} className="border-b border-border/40">
                                <td className="py-2 pr-3 font-medium text-foreground/90">{h.symbol}</td>
                                <td className="py-2 pr-3 text-right font-mono">{h.dividendYield != null ? fmtPct(h.dividendYield, 2) : "n/a"}</td>
                                <td className="py-2 pr-3 text-right font-mono">{h.dividendPerShare != null ? fmtUsd(h.dividendPerShare) : "n/a"}</td>
                                <td className="py-2 pr-3 text-right font-mono">{h.estAnnualDividendIncome != null ? fmtUsd(h.estAnnualDividendIncome) : "n/a"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ─── Snapshots ─────────────────────────────────────────── */}
                <TabsContent value="snapshots" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-[11px]">
                      Composite Quality / Risk / Diversification snapshots, saved only when you explicitly ask.
                    </CardDescription>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] gap-1 shrink-0"
                      onClick={handleSavePortfolioSnapshot}
                      disabled={savePortfolioSnapshot.isPending}
                      data-testid="save-portfolio-snapshot-button"
                    >
                      <Save className="w-3 h-3" /> Save Portfolio Snapshot
                    </Button>
                  </div>
                  {portfolioSnapshots && portfolioSnapshots.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5" data-testid="portfolio-snapshot-history">
                      {portfolioSnapshots.map((s) => (
                        <Badge key={s.id} variant="outline" className={`text-[9px] ${scoreCardBadgeClass(s.qualityScore)}`}>
                          {new Date(s.createdAt).toLocaleDateString()}: Q{s.qualityScore ?? "N/A"} / R{s.riskScore ?? "N/A"} / D{s.diversificationScore ?? "N/A"}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">No portfolio snapshots saved yet.</p>
                  )}

                  {snapshots && snapshots.length > 0 && (
                    <div className="pt-2 border-t border-border/60">
                      <p className="text-[11px] text-muted-foreground mb-1">Risk-only snapshots ({snapshots.length})</p>
                      <div className="flex flex-wrap gap-1.5" data-testid="snapshot-history">
                        {snapshots.slice(0, 10).map((s) => (
                          <Badge key={s.id} variant="outline" className={`text-[9px] ${riskScoreClass(s.overallScore)}`}>
                            {new Date(s.createdAt).toLocaleDateString()}: {s.overallScore ?? "N/A"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ─── Timeline ──────────────────────────────────────────── */}
                <TabsContent value="timeline" className="mt-4">
                  {!portfolioSnapshots || portfolioSnapshots.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      No saved snapshots yet — save one from the Snapshots tab to start building a timeline.
                    </p>
                  ) : (
                    <div className="space-y-2" data-testid="timeline-content">
                      {[...portfolioSnapshots]
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((s) => (
                          <div key={s.id} className="flex items-center gap-3 text-xs border-b border-border/40 pb-2">
                            <span className="w-28 text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</span>
                            <Badge variant="outline" className={`text-[9px] ${scoreCardBadgeClass(s.qualityScore)}`}>Quality {s.qualityScore ?? "N/A"}</Badge>
                            <Badge variant="outline" className={`text-[9px] ${scoreCardBadgeClass(s.riskScore)}`}>Risk {s.riskScore ?? "N/A"}</Badge>
                            <Badge variant="outline" className={`text-[9px] ${scoreCardBadgeClass(s.diversificationScore)}`}>Diversification {s.diversificationScore ?? "N/A"}</Badge>
                            <span className="text-muted-foreground">{s.holdingsCount} holding{s.holdingsCount === 1 ? "" : "s"}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </TabsContent>

                {/* ─── Notes ─────────────────────────────────────────────── */}
                <TabsContent value="notes" className="mt-4 space-y-4">
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <Textarea
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Add a note about this portfolio's thesis, plans, or observations…"
                      className="bg-background text-xs"
                      data-testid="new-note-textarea"
                    />
                    <Button type="submit" size="sm" disabled={!newNoteText.trim() || addNote.isPending} data-testid="add-note-button">
                      Add Note
                    </Button>
                  </form>

                  {!notes || notes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No notes yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {notes.map((n) => (
                        <div key={n.id} className="rounded-md border border-border/60 bg-background/40 p-2.5" data-testid={`note-${n.id}`}>
                          {editingNoteId === n.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingNoteText}
                                onChange={(e) => setEditingNoteText(e.target.value)}
                                className="bg-background text-xs"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleSaveEditedNote(n.id)} disabled={!editingNoteText.trim() || updateNote.isPending}>
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingNoteId(null)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-xs text-foreground/90 whitespace-pre-wrap">{n.note}</p>
                              <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[10px] text-muted-foreground">{new Date(n.updatedAt).toLocaleString()}</span>
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      setEditingNoteId(n.id);
                                      setEditingNoteText(n.note);
                                    }}
                                    aria-label="Edit note"
                                    data-testid={`edit-note-${n.id}`}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-muted-foreground hover:text-rose-400"
                                    onClick={() => handleDeleteNote(n.id)}
                                    aria-label="Delete note"
                                    data-testid={`delete-note-${n.id}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
