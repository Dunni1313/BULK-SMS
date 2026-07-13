// Phase 2, Sprint 28 — Portfolio Construction. Advisory/education only: this
// page never previews, schedules, or submits any order, and never touches a
// real brokerage account. Distinct from /portfolio (the Options Income
// Engine's real, trades-backed account view).

import { useState, useMemo } from "react";
import {
  useGetPortfolios,
  useCreatePortfolio,
  useDeletePortfolio,
  useGetPortfolio,
  useAddHolding,
  useUpdateHolding,
  useDeleteHolding,
  useGetValueWatchlist,
  getGetPortfoliosQueryKey,
  getGetPortfolioQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Plus, Trash2, Star } from "lucide-react";

const fmtUsd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function rebalanceBadgeClass(action: string): string {
  if (action === "buy") return "border-emerald-500/40 text-emerald-400";
  if (action === "sell") return "border-rose-500/40 text-rose-400";
  if (action === "hold") return "border-border text-muted-foreground";
  return "border-border text-muted-foreground/60";
}

export default function PortfolioConstruction() {
  const { data: portfolios, isLoading: portfoliosLoading } = useGetPortfolios();
  const { data: watchlist } = useGetValueWatchlist();
  const createPortfolio = useCreatePortfolio();
  const deletePortfolio = useDeletePortfolio();
  const addHolding = useAddHolding();
  const updateHolding = useUpdateHolding();
  const deleteHolding = useDeleteHolding();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [newTargetWeight, setNewTargetWeight] = useState("");
  const [newShares, setNewShares] = useState("");

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-indigo-400" /> Portfolio Construction
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Build a target-allocation portfolio from your watchlist and track actual-vs-target weight drift.
          Education &amp; advisory only — this page never places, schedules, or submits any trade.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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

        <Card className="bg-card border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{detail ? detail.name : "Select a portfolio"}</CardTitle>
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
              <div className="space-y-4">
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
                          <td className="py-2 pr-3 text-right font-mono">{h.currentPrice != null ? fmtUsd(h.currentPrice) : "n/a"}</td>
                          <td className="py-2 pr-3 text-right font-mono">{h.actualWeightPct != null ? `${h.actualWeightPct}%` : "n/a"}</td>
                          <td className="py-2 pr-3 text-right font-mono">{h.driftPct != null ? `${h.driftPct > 0 ? "+" : ""}${h.driftPct}pp` : "n/a"}</td>
                          <td className="py-2 pr-3 text-right">
                            <Badge variant="outline" className={`text-[9px] capitalize ${rebalanceBadgeClass(h.rebalanceAction)}`}>
                              {h.rebalanceAction}
                            </Badge>
                          </td>
                          <td className="py-2 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground hover:text-rose-400"
                              onClick={() => handleDeleteHolding(h.id, h.symbol)}
                              data-testid={`remove-holding-${h.symbol}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
