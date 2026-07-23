// Phase 43 — Institutional Watchlists & Opportunity Dashboard.
//
// PURE PRESENTATION LAYER over already-computed, already-tested backend
// data (lib/watchlists.ts, lib/watchlistsEngine.ts). Monitoring and
// organisation only. No trade recommendations, no buy/sell signals, no
// ranked/scored opportunity signal, no portfolio optimisation, no auto
// rebalancing, no auto execution, no auto watchlist generation, no AI
// predictions, no forecasting, no machine learning.
//
// Every figure is a direct read from:
//   - GET /investing/watchlists/dashboard — Watchlist Health, the
//     Cross-Engine Summary, the Opportunity Overview, and the dashboard-
//     level summary, all reused from the Risk & Exposure, Performance,
//     Scenario, Decision Support, and Compliance engines.
//   - GET/POST/PATCH/DELETE /investing/watchlists[/:id] — watchlist CRUD.
//   - POST /investing/watchlists/:id/items[...] — item CRUD.
//   - GET /investing/watchlists/coach — the deterministic AI Coach.
//   - GET /investing/watchlists/learning — Learning Centre integration.
//   - GET /reporting/watchlist-summary-report,
//     GET /reporting/opportunity-dashboard-report — Reporting Centre links.

import { useState } from "react";
import { Link } from "wouter";
import {
  useGetWatchlistsDashboard,
  getGetWatchlistsDashboardQueryKey,
  useListInvestingWatchlists,
  getListInvestingWatchlistsQueryKey,
  useCreateInvestingWatchlist,
  useUpdateInvestingWatchlist,
  useDeleteInvestingWatchlist,
  useGetInvestingWatchlist,
  getGetInvestingWatchlistQueryKey,
  useAddInvestingWatchlistItem,
  useUpdateInvestingWatchlistItem,
  useRemoveInvestingWatchlistItem,
  useListWatchlistsCoachTopics,
  useListWatchlistsLearning,
} from "@workspace/api-client-react";
import type { WatchlistSymbolAnalytics } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, GraduationCap, FileBarChart2, ListPlus, Eye, GraduationCap as LearnIcon } from "lucide-react";

function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString()}`;
}

function complianceBadgeClass(status: string | undefined): string {
  if (status === "compliant") return "border-emerald-500/40 text-emerald-400";
  if (status === "breach") return "border-red-500/40 text-red-400";
  return "border-border text-muted-foreground";
}

function AnalyticsRow({ a }: { a: WatchlistSymbolAnalytics }) {
  const held = a.heldInInvesting || a.heldInTrading || a.heldInOptions;
  return (
    <div className="border-b border-border pb-2 last:border-0 text-xs" data-testid={`opportunity-row-${a.symbol}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold">{a.symbol}</span>
        {a.compliance ? (
          <Badge variant="outline" className={`text-[10px] ${complianceBadgeClass(a.compliance.status)}`}>
            {a.compliance.status}
          </Badge>
        ) : null}
      </div>
      {!held ? (
        <p className="text-muted-foreground mt-0.5" data-testid={`opportunity-row-${a.symbol}-not-held`}>
          Not currently held in any engine.
        </p>
      ) : (
        <div className="text-muted-foreground mt-0.5 space-x-2">
          {a.investing ? <span>Investing: {fmtUsd(a.investing.marketValue)} ({a.investing.weightPct ?? "—"}%)</span> : null}
          {a.trading ? <span>Trading: {a.trading.openPositionsCount} open</span> : null}
          {a.options ? <span>Options: {a.options.openPositionsCount} open</span> : null}
          {a.scenarioWorstCaseImpactDollars != null ? <span>Worst-case scenario impact: {fmtUsd(a.scenarioWorstCaseImpactDollars)}</span> : null}
        </div>
      )}
    </div>
  );
}

function WatchlistDetail({ watchlistId, onClose }: { watchlistId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detailQuery = useGetInvestingWatchlist(watchlistId, { query: { queryKey: getGetInvestingWatchlistQueryKey(watchlistId) } });
  const addItemMutation = useAddInvestingWatchlistItem();
  const updateItemMutation = useUpdateInvestingWatchlistItem();
  const removeItemMutation = useRemoveInvestingWatchlistItem();

  const [symbol, setSymbol] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getGetInvestingWatchlistQueryKey(watchlistId) });
    queryClient.invalidateQueries({ queryKey: getListInvestingWatchlistsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetWatchlistsDashboardQueryKey() });
  }

  function addSymbol() {
    if (!symbol.trim()) return;
    addItemMutation.mutate(
      {
        id: watchlistId,
        data: {
          symbol: symbol.trim(),
          category: category.trim() || undefined,
          tags: tags.trim() ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
          notes: notes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setSymbol("");
          setCategory("");
          setTags("");
          setNotes("");
          invalidate();
        },
      },
    );
  }

  function removeSymbol(itemId: number) {
    removeItemMutation.mutate({ id: watchlistId, itemId }, { onSuccess: invalidate });
  }

  function updateNotes(itemId: number, newNotes: string) {
    updateItemMutation.mutate({ id: watchlistId, itemId, data: { notes: newNotes } }, { onSuccess: invalidate });
  }

  const watchlist = detailQuery.data;

  return (
    <Card className="bg-card border-border" data-testid="panel-watchlist-detail">
      <CardHeader className="pb-2 flex-row items-start justify-between">
        <div>
          <CardTitle className="text-sm">{watchlist?.name ?? "Watchlist"}</CardTitle>
          <CardDescription className="text-xs">{watchlist?.description || "No description."}</CardDescription>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose} data-testid="watchlist-detail-close">
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {detailQuery.isLoading ? (
          <Skeleton className="h-24" />
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground">Symbol</p>
                <Input className="h-7 w-24 bg-background" value={symbol} onChange={(e) => setSymbol(e.target.value)} data-testid="add-item-symbol" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Category</p>
                <Input className="h-7 w-28 bg-background" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="add-item-category" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Tags (comma-separated)</p>
                <Input className="h-7 w-36 bg-background" value={tags} onChange={(e) => setTags(e.target.value)} data-testid="add-item-tags" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Notes</p>
                <Input className="h-7 w-40 bg-background" value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="add-item-notes" />
              </div>
              <Button size="sm" onClick={addSymbol} disabled={addItemMutation.isPending} data-testid="add-item-btn">
                Add Symbol
              </Button>
            </div>

            <div className="space-y-2">
              {(watchlist?.items ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="watchlist-items-empty">
                  No symbols in this watchlist yet.
                </p>
              ) : (
                watchlist!.items.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 text-xs border-b border-border pb-2 last:border-0" data-testid={`item-row-${i.id}`}>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {i.symbol}
                        {i.category ? <span className="text-muted-foreground font-normal"> · {i.category}</span> : null}
                      </p>
                      {i.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {i.tags.map((t) => (
                            <Badge key={t} variant="outline" className="text-[9px]">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <Input
                        className="h-6 mt-1 bg-background text-[10px]"
                        defaultValue={i.notes}
                        placeholder="Notes…"
                        onBlur={(e) => e.target.value !== i.notes && updateNotes(i.id, e.target.value)}
                        data-testid={`item-notes-${i.id}`}
                      />
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeSymbol(i.id)} data-testid={`item-remove-${i.id}`}>
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function WatchlistsEngine() {
  const dashboardQuery = useGetWatchlistsDashboard({ query: { queryKey: getGetWatchlistsDashboardQueryKey() } });
  const watchlistsQuery = useListInvestingWatchlists({ query: { queryKey: getListInvestingWatchlistsQueryKey() } });
  const coachQuery = useListWatchlistsCoachTopics();
  const learningQuery = useListWatchlistsLearning();
  const queryClient = useQueryClient();

  const createMutation = useCreateInvestingWatchlist();
  const updateMutation = useUpdateInvestingWatchlist();
  const deleteMutation = useDeleteInvestingWatchlist();

  const dashboard = dashboardQuery.data;
  const watchlists = watchlistsQuery.data ?? [];

  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<string>("personal");
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<number | null>(null);

  function invalidateWatchlists() {
    queryClient.invalidateQueries({ queryKey: getListInvestingWatchlistsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetWatchlistsDashboardQueryKey() });
  }

  function createWatchlist() {
    if (!newName.trim()) return;
    createMutation.mutate({ data: { name: newName.trim(), kind: newKind } }, { onSuccess: () => { setNewName(""); invalidateWatchlists(); } });
  }

  function archiveWatchlist(id: number, archived: boolean) {
    updateMutation.mutate({ id, data: { archived } }, { onSuccess: invalidateWatchlists });
  }

  function deleteWatchlist(id: number) {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          if (selectedWatchlistId === id) setSelectedWatchlistId(null);
          invalidateWatchlists();
        },
      },
    );
  }

  const personalWatchlists = watchlists.filter((w) => w.kind === "personal");
  const institutionalWatchlists = watchlists.filter((w) => w.kind !== "personal");

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="watchlists-engine">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Eye className="w-6 h-6 text-amber-400" /> Institutional Watchlists & Opportunity Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Organise assets into personal and institutional watchlists and monitor them across the existing Investing, Trading, Options, Risk, Performance, Scenario and Compliance
          engines. Monitoring and organisation only — no trade recommendations, no buy/sell signals, no ranked opportunity score, no portfolio optimisation, no auto watchlist
          generation.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="we-labels">
          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">
            Watchlists & Opportunity
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
          <TabsTrigger value="dashboard" data-testid="tab-we-dashboard">
            <Eye className="w-4 h-4 mr-1" /> Watchlists Dashboard
          </TabsTrigger>
          <TabsTrigger value="watchlists" data-testid="tab-we-watchlists">
            <ListPlus className="w-4 h-4 mr-1" /> Manage Watchlists
          </TabsTrigger>
          <TabsTrigger value="opportunity" data-testid="tab-we-opportunity">
            Opportunity Overview
          </TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-we-learning">
            <GraduationCap className="w-4 h-4 mr-1" /> Coach & Learning
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-we-reporting">
            <FileBarChart2 className="w-4 h-4 mr-1" /> Reporting
          </TabsTrigger>
        </TabsList>

        {/* ─── Watchlists Dashboard ───────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {dashboardQuery.isLoading ? (
            <Skeleton className="h-96" />
          ) : dashboardQuery.isError || !dashboard ? (
            <p className="text-xs text-destructive flex items-center gap-1" data-testid="we-dashboard-error">
              <AlertTriangle className="w-3.5 h-3.5" /> Unable to load the Watchlists Dashboard.
            </p>
          ) : (
            <>
              <Card className="bg-card border-border" data-testid="panel-we-summary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Dashboard Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Watchlists</p>
                    <p className="text-sm">{dashboard.dashboardSummary.watchlistCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Watched symbols</p>
                    <p className="text-sm">{dashboard.dashboardSummary.distinctSymbolCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Held somewhere</p>
                    <p className="text-sm">{dashboard.dashboardSummary.heldSymbolCount}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Policy breaches</p>
                    <p className="text-sm text-red-400">{dashboard.dashboardSummary.policyBreaches.length}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-we-highlights">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Highest Risk / Exposure / Allocation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs">
                  <p data-testid="we-highest-risk">
                    Highest Risk: {dashboard.dashboardSummary.highestRisk ? `${dashboard.dashboardSummary.highestRisk.symbol} — ${dashboard.dashboardSummary.highestRisk.detail}` : "unavailable"}
                  </p>
                  <p data-testid="we-highest-exposure">
                    Highest Exposure: {dashboard.dashboardSummary.highestExposure ? `${dashboard.dashboardSummary.highestExposure.symbol} at ${dashboard.dashboardSummary.highestExposure.weightPct}% (${dashboard.dashboardSummary.highestExposure.engine})` : "unavailable"}
                  </p>
                  <p data-testid="we-highest-allocation">
                    Highest Allocation: {dashboard.dashboardSummary.highestAllocation ? `${dashboard.dashboardSummary.highestAllocation.symbol} at ${fmtUsd(dashboard.dashboardSummary.highestAllocation.marketValue)}` : "unavailable"}
                  </p>
                  <p className="text-muted-foreground">{dashboard.dashboardSummary.scenarioImpact.detail}</p>
                  <p className="text-muted-foreground">{dashboard.dashboardSummary.performanceSummary.detail}</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-we-outstanding-issues">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Outstanding Issues</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs">
                  {dashboard.dashboardSummary.outstandingIssues.map((issue, i) => (
                    <p key={i}>{issue}</p>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-we-health">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Watchlist Health</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dashboard.watchlistHealth.length === 0 ? (
                    <p className="text-xs text-muted-foreground" data-testid="we-health-empty">
                      No watchlists to evaluate yet.
                    </p>
                  ) : (
                    dashboard.watchlistHealth.map((h) => (
                      <div key={h.watchlistId} className="text-xs border-b border-border pb-1.5 last:border-0" data-testid={`health-row-${h.watchlistId}`}>
                        <span className="font-semibold">
                          {h.name} [{h.kind}]
                        </span>
                        : {h.heldCount}/{h.itemCount} held, {h.breachCount} breach(es)
                        {h.totalMarketValue != null ? `, ${fmtUsd(h.totalMarketValue)} market value` : ""}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-we-cross-engine">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Cross-Engine Summary</CardTitle>
                  <CardDescription className="text-xs">
                    Executive Health: {dashboard.crossEngineSummary.executiveHealth.healthScore}/100 ({dashboard.crossEngineSummary.executiveHealth.overallRiskRating.label})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-xs">
                  {dashboard.crossEngineSummary.capitalAllocation.map((c) => (
                    <p key={c.label}>
                      {c.label}: {fmtUsd(c.value)}
                    </p>
                  ))}
                  <p>
                    Investing diversification: {dashboard.crossEngineSummary.investingDiversification.available ? `${dashboard.crossEngineSummary.investingDiversification.score}/100` : "unavailable"}
                  </p>
                  <p>
                    Options diversification: {dashboard.crossEngineSummary.optionsDiversification.available ? `${dashboard.crossEngineSummary.optionsDiversification.score}/100` : "unavailable"}
                  </p>
                  <p>
                    Compliance: {dashboard.crossEngineSummary.complianceSummary.compliantCount} compliant, {dashboard.crossEngineSummary.complianceSummary.breachCount} breach(es)
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Manage Watchlists ──────────────────────────────────────────── */}
        <TabsContent value="watchlists" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-new-watchlist">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">New Watchlist</CardTitle>
              <CardDescription className="text-xs">Nothing is ever auto-created — every watchlist originates from an explicit action.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground">Name</p>
                <Input className="h-7 w-40 bg-background" value={newName} onChange={(e) => setNewName(e.target.value)} data-testid="new-watchlist-name" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Kind</p>
                <Select value={newKind} onValueChange={setNewKind}>
                  <SelectTrigger className="h-7 w-36 bg-background" data-testid="new-watchlist-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="institutional">Institutional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={createWatchlist} disabled={createMutation.isPending} data-testid="new-watchlist-create-btn">
                Create Watchlist
              </Button>
            </CardContent>
          </Card>

          {watchlistsQuery.isLoading ? (
            <Skeleton className="h-32" />
          ) : watchlists.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="we-watchlists-empty">
              No watchlists have been created yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-card border-border" data-testid="panel-personal-watchlists">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Personal Watchlists</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {personalWatchlists.length === 0 ? (
                    <p className="text-xs text-muted-foreground" data-testid="we-personal-empty">
                      No personal watchlists yet.
                    </p>
                  ) : (
                    personalWatchlists.map((w) => (
                      <div key={w.id} className="flex items-center justify-between text-xs border-b border-border pb-1.5 last:border-0" data-testid={`watchlist-row-${w.id}`}>
                        <button className="text-left truncate" onClick={() => setSelectedWatchlistId(w.id)} data-testid={`watchlist-open-${w.id}`}>
                          {w.name} <span className="text-muted-foreground">({w.itemCount})</span>
                          {w.archived ? (
                            <Badge variant="outline" className="text-[9px] ml-1">
                              archived
                            </Badge>
                          ) : null}
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => archiveWatchlist(w.id, !w.archived)} data-testid={`watchlist-archive-${w.id}`}>
                            {w.archived ? "Unarchive" : "Archive"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteWatchlist(w.id)} data-testid={`watchlist-delete-${w.id}`}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border" data-testid="panel-institutional-watchlists">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Institutional Watchlists</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {institutionalWatchlists.length === 0 ? (
                    <p className="text-xs text-muted-foreground" data-testid="we-institutional-empty">
                      No institutional watchlists yet.
                    </p>
                  ) : (
                    institutionalWatchlists.map((w) => (
                      <div key={w.id} className="flex items-center justify-between text-xs border-b border-border pb-1.5 last:border-0" data-testid={`watchlist-row-${w.id}`}>
                        <button className="text-left truncate" onClick={() => setSelectedWatchlistId(w.id)} data-testid={`watchlist-open-${w.id}`}>
                          {w.name} <span className="text-muted-foreground">({w.itemCount})</span>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => archiveWatchlist(w.id, !w.archived)} data-testid={`watchlist-archive-${w.id}`}>
                            {w.archived ? "Unarchive" : "Archive"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteWatchlist(w.id)} data-testid={`watchlist-delete-${w.id}`}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {selectedWatchlistId != null && <WatchlistDetail watchlistId={selectedWatchlistId} onClose={() => setSelectedWatchlistId(null)} />}
        </TabsContent>

        {/* ─── Opportunity Overview ───────────────────────────────────────── */}
        <TabsContent value="opportunity" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-opportunity-overview">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Opportunity Overview</CardTitle>
              <CardDescription className="text-xs">
                Every distinct watched symbol's own allocation, performance, Greeks (where applicable), scenario impact, and compliance status. Monitoring only — never a ranked
                or scored opportunity signal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {dashboardQuery.isLoading ? (
                <Skeleton className="h-48" />
              ) : (dashboard?.opportunityOverview.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="we-opportunity-empty">
                  No watched symbols yet.
                </p>
              ) : (
                dashboard!.opportunityOverview.map((a) => <AnalyticsRow key={a.symbol} a={a} />)
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Coach & Learning ───────────────────────────────────────────── */}
        <TabsContent value="learning" className="space-y-4 mt-4">
          <Card className="bg-card border-border" data-testid="panel-we-coach">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">AI Coach</CardTitle>
              <CardDescription className="text-xs">
                Deterministic explanations of watchlists, research workflow, institutional monitoring, portfolio organisation, and asset tracking — never a recommended trade.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {coachQuery.isLoading ? (
                <Skeleton className="h-32" />
              ) : (
                <div className="space-y-3" data-testid="we-coach-topics">
                  {(coachQuery.data ?? []).map((t) => (
                    <div key={t.topic} data-testid={`we-coach-topic-${t.topic}`}>
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

          <Card className="bg-card border-border" data-testid="panel-we-learning">
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
                <div className="space-y-3" data-testid="we-learning-by-topic">
                  {(learningQuery.data ?? []).map((bundle) => (
                    <div key={bundle.topic} data-testid={`we-learning-topic-${bundle.topic}`}>
                      <p className="text-xs font-semibold">{bundle.topic.replace(/_/g, " ")}</p>
                      <ul className="space-y-0.5">
                        {bundle.links.map((l) => (
                          <li key={`${l.pathKey}-${l.topicKey}`}>
                            <Link href={l.href} className="text-xs text-primary hover:underline" data-testid={`we-learning-link-${l.pathKey}-${l.topicKey}`}>
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
          <Card className="bg-card border-border" data-testid="panel-we-reporting">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Watchlists Reporting</CardTitle>
              <CardDescription className="text-xs">Watchlist Summary Report and Opportunity Dashboard Report, reused from the platform's own Institutional Reporting Centre.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/reporting-centre?reportType=watchlist-summary-report" className="text-xs text-primary hover:underline block" data-testid="link-report-watchlist-summary-report">
                Generate Watchlist Summary Report →
              </Link>
              <Link href="/reporting-centre?reportType=opportunity-dashboard-report" className="text-xs text-primary hover:underline block" data-testid="link-report-opportunity-dashboard-report">
                Generate Opportunity Dashboard Report →
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
