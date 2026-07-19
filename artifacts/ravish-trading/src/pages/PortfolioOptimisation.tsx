// Phase 18 — Institutional Portfolio Optimisation Engine. Advisory/education
// only: this page never previews, schedules, or submits any order, and
// never touches a real brokerage account — same discipline as Portfolio
// Construction, Decision Engine, and the Institutional Workspace.
//
// PURE INTEGRATION LAYER. Every figure on this page comes from
// GET /portfolio-construction/portfolios/:id/optimisation
// (lib/portfolioOptimisation.ts), itself a reuse of Portfolio Intelligence
// (Phase 13), the Decision Engine (Phase 14), and Opportunity Discovery
// (Phase 15) — zero new valuation model, zero new score, computed on this
// page. The Comparison View reuses the existing
// GET /opportunity-discovery/compare endpoint directly, unmodified.
import { useEffect, useRef, useState } from "react";
import { useSearch, Link } from "wouter";
import {
  useGetPortfolios,
  useGetPortfolioOptimisation,
  useGetOptimisationReviews,
  useAddOptimisationReview,
  useAddValueWatchlist,
  useListNotifications,
  useCompareOpportunitiesRoute,
  getGetPortfolioOptimisationQueryKey,
  getGetOptimisationReviewsQueryKey,
  getCompareOpportunitiesRouteQueryKey,
  type OptimisationCandidate,
  type OptimisationReplacementOpportunity,
  type OptimisationEvidence,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Star, Save, ArrowRightLeft, Scale, ListChecks, Bell, GraduationCap } from "lucide-react";
import { CoachDrawer } from "@/components/coach/CoachDrawer";

function actionBadgeClass(action: string): string {
  if (action === "exit") return "border-rose-500/40 text-rose-400";
  if (action === "trim") return "border-amber-500/40 text-amber-400";
  if (action === "upgrade") return "border-indigo-500/40 text-indigo-400";
  return "border-border text-muted-foreground";
}

function scoreClass(score: number | null): string {
  if (score == null) return "border-border text-muted-foreground";
  if (score >= 65) return "border-emerald-500/40 text-emerald-400";
  if (score >= 45) return "border-amber-500/40 text-amber-400";
  return "border-rose-500/40 text-rose-400";
}

function EvidencePanel({ evidence }: { evidence: OptimisationEvidence }) {
  return (
    <div className="mt-2 rounded-md border border-border/60 bg-background/40 p-3 space-y-2 text-xs" data-testid="evidence-panel">
      <div className="flex flex-wrap gap-1.5">
        {evidence.metrics.map((m) => (
          <Badge key={m.label} variant="outline" className="text-[10px] border-border">
            {m.label}: {m.value}
          </Badge>
        ))}
      </div>
      <p><span className="font-medium text-foreground/80">Decision Engine:</span> {evidence.decisionEngineRecommendation}</p>
      <p><span className="font-medium text-foreground/80">Investment Committee:</span> {evidence.investmentCommitteeRecommendation}</p>
      <p className="text-muted-foreground">{evidence.rankExplanation}</p>
      <p><span className="font-medium text-foreground/80">Portfolio impact:</span> {evidence.portfolioImpact}</p>
      <p><span className="font-medium text-foreground/80">Risk impact:</span> {evidence.riskImpact}</p>
      <p><span className="font-medium text-foreground/80">Diversification impact:</span> {evidence.diversificationImpact}</p>
    </div>
  );
}

function CandidateCard({
  candidate,
  portfolioId,
  onCompare,
}: {
  candidate: OptimisationCandidate;
  portfolioId: number;
  onCompare: (symbol: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState("");
  const addReview = useAddOptimisationReview();
  const addToWatchlist = useAddValueWatchlist();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function saveReview() {
    addReview.mutate(
      {
        id: portfolioId,
        data: { symbol: candidate.symbol, action: candidate.action, note: noteText || candidate.reason, evidence: candidate.evidence as unknown as Record<string, unknown> },
      },
      {
        onSuccess: () => {
          setNoteText("");
          queryClient.invalidateQueries({ queryKey: getGetOptimisationReviewsQueryKey(portfolioId) });
          toast({ description: `Saved a ${candidate.action} review for ${candidate.symbol}.` });
        },
      },
    );
  }

  return (
    <div className="rounded-md border border-border/60 p-3" data-testid={`candidate-${candidate.symbol}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground/90">{candidate.symbol}</span>
          <Badge variant="outline" className={`text-[10px] uppercase ${actionBadgeClass(candidate.action)}`}>
            {candidate.action}
          </Badge>
          {candidate.weightPct != null && (
            <span className="text-[11px] text-muted-foreground">{candidate.weightPct.toFixed(1)}% of portfolio</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onCompare(candidate.symbol)} data-testid={`compare-${candidate.symbol}`}>
            <ArrowRightLeft className="w-3 h-3 mr-1" /> Compare
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px]"
            onClick={() => addToWatchlist.mutate({ data: { symbol: candidate.symbol } })}
            disabled={addToWatchlist.isPending}
            data-testid={`watchlist-${candidate.symbol}`}
          >
            <Star className="w-3 h-3 mr-1" /> Watchlist
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setExpanded((v) => !v)} data-testid={`toggle-evidence-${candidate.symbol}`}>
            {expanded ? "Hide Evidence" : "Show Evidence"}
          </Button>
          <Link
            href={`/stock-analyst/investment-committee?symbol=${candidate.symbol}&portfolioId=${portfolioId}`}
            className="text-[11px] text-primary hover:underline"
            data-testid={`review-in-committee-${candidate.symbol}`}
          >
            Review in Committee →
          </Link>
          <Link
            href={`/research-terminal?symbol=${candidate.symbol}&portfolioId=${portfolioId}`}
            className="text-[11px] text-primary hover:underline"
            data-testid={`open-terminal-${candidate.symbol}`}
          >
            Open in Terminal →
          </Link>
          <CoachDrawer
            symbol={candidate.symbol}
            coach="portfolio"
            portfolioId={portfolioId}
            trigger={
              <button type="button" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline" data-testid={`ask-coach-${candidate.symbol}`}>
                <GraduationCap className="w-3 h-3" /> Ask the Coach
              </button>
            }
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{candidate.reason}</p>
      {expanded && (
        <>
          <EvidencePanel evidence={candidate.evidence} />
          <div className="flex gap-2 mt-2">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add an optimisation note (optional — defaults to the reason above)…"
              className="text-xs h-16"
              data-testid={`review-note-${candidate.symbol}`}
            />
            <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={saveReview} disabled={addReview.isPending} data-testid={`save-review-${candidate.symbol}`}>
              <Save className="w-3.5 h-3.5 mr-1.5" /> Save Review
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ReplacementCard({ opportunity }: { opportunity: OptimisationReplacementOpportunity }) {
  const [expanded, setExpanded] = useState(false);
  const addToWatchlist = useAddValueWatchlist();

  return (
    <div className="rounded-md border border-border/60 p-3" data-testid={`replacement-${opportunity.symbol}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <span className="font-medium text-foreground/90">{opportunity.symbol}</span>{" "}
          <span className="text-xs text-muted-foreground">{opportunity.name}</span>
          {opportunity.forSymbol && <span className="text-[11px] text-muted-foreground ml-2">replaces {opportunity.forSymbol}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px]"
            onClick={() => addToWatchlist.mutate({ data: { symbol: opportunity.symbol } })}
            disabled={addToWatchlist.isPending}
            data-testid={`watchlist-repl-${opportunity.symbol}`}
          >
            <Star className="w-3 h-3 mr-1" /> Watchlist
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setExpanded((v) => !v)} data-testid={`toggle-evidence-repl-${opportunity.symbol}`}>
            {expanded ? "Hide Evidence" : "Show Evidence"}
          </Button>
        </div>
      </div>
      {expanded && <EvidencePanel evidence={opportunity.evidence} />}
    </div>
  );
}

export default function PortfolioOptimisation() {
  const { data: portfolios, isLoading: portfoliosLoading } = useGetPortfolios();
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [compareSymbol, setCompareSymbol] = useState<string | null>(null);
  const [primarySymbol, setPrimarySymbol] = useState<string | null>(null);

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

  const { data: optimisation, isLoading: optimisationLoading } = useGetPortfolioOptimisation(selectedId ?? 0, {
    query: { queryKey: getGetPortfolioOptimisationQueryKey(selectedId ?? 0), enabled: selectedId != null },
  });
  const { data: reviews, isLoading: reviewsLoading } = useGetOptimisationReviews(selectedId ?? 0, {
    query: { queryKey: getGetOptimisationReviewsQueryKey(selectedId ?? 0), enabled: selectedId != null },
  });

  // Monitoring & Alerts integration: reuse the existing notifications list,
  // filtered to this portfolio's own held symbols — zero new alert-
  // detection logic, purely a read of already-generated alerts.
  const heldSymbolSet = new Set((optimisation?.positionQualityRanking ?? []).map((p) => p.symbol));
  const { data: notifications } = useListNotifications();
  const portfolioAlerts = (notifications ?? []).filter((n) => !n.isRead && n.relatedSymbol && heldSymbolSet.has(n.relatedSymbol));

  const compareSymbols = primarySymbol && compareSymbol ? `${primarySymbol},${compareSymbol}` : "";
  const { data: comparison, isLoading: comparisonLoading } = useCompareOpportunitiesRoute(
    { symbols: compareSymbols },
    { query: { queryKey: getCompareOpportunitiesRouteQueryKey({ symbols: compareSymbols }), enabled: !!compareSymbols } },
  );

  function handleCompare(symbol: string) {
    setPrimarySymbol(symbol);
    setCompareSymbol(null);
    toast({ description: `Pick a symbol below to compare against ${symbol}.` });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Scale className="w-6 h-6 text-indigo-400" /> Portfolio Optimisation
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Deterministic, evidence-based portfolio review — reuses Portfolio Intelligence, the Decision Engine, the
          Investment Committee, and Opportunity Discovery. Never a price prediction, never a return forecast.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="optimisation-permanent-labels">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
            Institutional Portfolio Optimisation
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
            Educational
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
            Deterministic
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-border">
            Evidence Based
          </Badge>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Portfolio</span>
            {portfoliosLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <Select value={selectedId ? String(selectedId) : ""} onValueChange={(v) => setSelectedId(Number(v))}>
                <SelectTrigger className="h-8 w-64 text-xs" data-testid="portfolio-select">
                  <SelectValue placeholder="Select a portfolio…" />
                </SelectTrigger>
                <SelectContent>
                  {(portfolios ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedId != null && (
              <Link href={`/stock-analyst/portfolio-construction?portfolioId=${selectedId}`} className="text-xs text-primary hover:underline ml-auto">
                Open in Portfolio Manager →
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedId == null ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Select a portfolio above to review its optimisation opportunities.
          </CardContent>
        </Card>
      ) : optimisationLoading || !optimisation ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="candidates" data-testid="tab-candidates">Upgrade Analysis</TabsTrigger>
            <TabsTrigger value="opportunities" data-testid="tab-opportunities">Allocation Summary</TabsTrigger>
            <TabsTrigger value="comparison" data-testid="tab-comparison">Comparison View</TabsTrigger>
            <TabsTrigger value="reviews" data-testid="tab-reviews">Saved Reviews</TabsTrigger>
          </TabsList>

          {/* ─── Overview: Portfolio Health, Concentration, Diversification, Position Quality Ranking ─── */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`text-[10px] ${scoreClass(optimisation.health.qualityScore)}`}>
                Quality: {optimisation.health.qualityScore ?? "N/A"} ({optimisation.health.qualityLabel})
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${scoreClass(optimisation.health.diversificationScore)}`}>
                Diversification: {optimisation.health.diversificationScore ?? "N/A"} ({optimisation.health.diversificationLabel})
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${scoreClass(optimisation.health.overallRiskScore)}`}>
                Overall Risk: {optimisation.health.overallRiskScore ?? "N/A"} ({optimisation.health.overallRiskLabel})
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] ${optimisation.concentration.capBreached ? "border-rose-500/40 text-rose-400" : "border-border text-muted-foreground"}`}
              >
                Concentration: {optimisation.concentration.score ?? "N/A"}
                {optimisation.concentration.largestSymbol ? ` (${optimisation.concentration.largestSymbol} ${optimisation.concentration.largestSymbolWeightPct}%)` : ""}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{optimisation.summary}</p>

            {portfolioAlerts.length > 0 && (
              <Card className="bg-background/40 border-border/60" data-testid="portfolio-alerts-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-400" /> Active Alerts for Held Positions ({portfolioAlerts.length})
                  </CardTitle>
                  <CardDescription className="text-[11px]">Reused directly from Institutional Monitoring — no new detection logic.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {portfolioAlerts.map((n) => (
                    <div key={n.id} className="text-xs rounded border border-border/60 px-2 py-1.5">
                      <span className="font-medium text-foreground/90">{n.relatedSymbol}:</span> {n.title}
                    </div>
                  ))}
                  <Link href="/monitoring-dashboard" className="text-xs text-primary hover:underline block mt-1">
                    Open Institutional Monitoring →
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card className="bg-background/40 border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-indigo-400" /> Position Quality Ranking
                </CardTitle>
                <CardDescription className="text-[11px]">Ranked by the Decision Engine's own synthesis score, descending.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border">
                        <th className="text-left font-medium py-2 pr-3">Symbol</th>
                        <th className="text-right font-medium py-2 pr-3">Weight</th>
                        <th className="text-right font-medium py-2 pr-3">Rank Score</th>
                        <th className="text-right font-medium py-2 pr-3">Valuation</th>
                        <th className="text-right font-medium py-2 pr-3">Committee</th>
                        <th className="text-right font-medium py-2 pr-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {optimisation.positionQualityRanking.map((p) => (
                        <tr key={p.symbol} className="border-b border-border/40" data-testid={`ranking-row-${p.symbol}`}>
                          <td className="py-2 pr-3 font-medium text-foreground/90">{p.symbol}</td>
                          <td className="py-2 pr-3 text-right font-mono">{p.weightPct != null ? `${p.weightPct.toFixed(1)}%` : "n/a"}</td>
                          <td className="py-2 pr-3 text-right font-mono">{p.rankScore}</td>
                          <td className="py-2 pr-3 text-right">{p.valuationRating}</td>
                          <td className="py-2 pr-3 text-right">{p.investmentCommitteeVerdict}</td>
                          <td className="py-2 pr-3 text-right">
                            <Badge variant="outline" className={`text-[9px] uppercase ${actionBadgeClass(p.action)}`}>
                              {p.action}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Candidates: Upgrade / Trim / Exit, each with an Evidence Panel ─── */}
          <TabsContent value="candidates" className="mt-4 space-y-4">
            {(["exitCandidates", "trimCandidates", "upgradeCandidates"] as const).map((key) => {
              const list = optimisation[key];
              const label = key === "exitCandidates" ? "Exit Candidates" : key === "trimCandidates" ? "Trim Candidates" : "Upgrade Candidates";
              return (
                <div key={key} data-testid={`section-${key}`}>
                  <h3 className="text-sm font-semibold text-foreground/90 mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-400" /> {label} ({list.length})
                  </h3>
                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">None identified.</p>
                  ) : (
                    <div className="space-y-2">
                      {list.map((c) => (
                        <CandidateCard key={c.symbol} candidate={c} portfolioId={selectedId} onCompare={handleCompare} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* ─── Allocation Summary: capital allocation suggestions, replacement opportunities, cash deployment ─── */}
          <TabsContent value="opportunities" className="mt-4 space-y-4">
            <Card className="bg-background/40 border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Capital Allocation Suggestions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {optimisation.capitalAllocationSuggestions.map((s, i) => (
                  <div key={i} className="text-xs" data-testid={`allocation-suggestion-${i}`}>
                    <span className="font-medium text-foreground/90">{s.action}:</span> <span className="text-muted-foreground">{s.detail}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div>
              <h3 className="text-sm font-semibold text-foreground/90 mb-2">Replacement Opportunities ({optimisation.replacementOpportunities.length})</h3>
              {optimisation.replacementOpportunities.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">None identified.</p>
              ) : (
                <div className="space-y-2">
                  {optimisation.replacementOpportunities.map((r, i) => (
                    <ReplacementCard key={`${r.symbol}-${i}`} opportunity={r} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground/90 mb-2">Cash Deployment Suggestions ({optimisation.cashDeploymentSuggestions.length})</h3>
              {optimisation.cashDeploymentSuggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No meaningful idle cash to deploy.</p>
              ) : (
                <div className="space-y-2">
                  {optimisation.cashDeploymentSuggestions.map((r, i) => (
                    <ReplacementCard key={`${r.symbol}-${i}`} opportunity={r} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ─── Comparison View: reuses GET /opportunity-discovery/compare directly ─── */}
          <TabsContent value="comparison" className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Pick a held position to compare (via "Compare" on a candidate above), then a symbol to compare it against.
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] border-border">Primary: {primarySymbol ?? "none selected"}</Badge>
              <Select value={compareSymbol ?? ""} onValueChange={setCompareSymbol}>
                <SelectTrigger className="h-8 w-56 text-xs" data-testid="compare-against-select">
                  <SelectValue placeholder="Compare against…" />
                </SelectTrigger>
                <SelectContent>
                  {[...optimisation.replacementOpportunities, ...optimisation.cashDeploymentSuggestions]
                    .map((r) => r.symbol)
                    .filter((s, i, arr) => arr.indexOf(s) === i)
                    .map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {comparisonLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : comparison && comparison.rows.length > 0 ? (
              <div className="overflow-x-auto" data-testid="comparison-table">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left font-medium py-2 pr-3">Dimension</th>
                      {comparison.rows.map((r) => (
                        <th key={r.symbol} className="text-right font-medium py-2 pr-3">{r.symbol}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(comparison.bestBy).map(([dimension, bestSymbol]) => (
                      <tr key={dimension} className="border-b border-border/40">
                        <td className="py-2 pr-3 text-muted-foreground">{dimension}</td>
                        {comparison.rows.map((r) => (
                          <td key={r.symbol} className={`py-2 pr-3 text-right ${r.symbol === bestSymbol ? "text-emerald-400 font-medium" : ""}`}>
                            {r.symbol === bestSymbol ? "★" : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Select two symbols above to compare.</p>
            )}
          </TabsContent>

          {/* ─── Saved Reviews ─── */}
          <TabsContent value="reviews" className="mt-4 space-y-2">
            {reviewsLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : !reviews || reviews.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No saved reviews yet.</p>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="rounded-md border border-border/60 p-3 text-xs" data-testid={`review-${r.id}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {r.symbol && <span className="font-medium text-foreground/90">{r.symbol}</span>}
                    <Badge variant="outline" className={`text-[9px] uppercase ${actionBadgeClass(r.action)}`}>
                      {r.action}
                    </Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-foreground/80">{r.note}</p>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
