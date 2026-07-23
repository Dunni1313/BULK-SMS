// Phase 19 — Institutional Investment Committee Workbench.
//
// This is a pure integration/workflow layer. It creates ZERO new valuation
// models, ZERO new scoring systems, and duplicates NO existing business
// logic — every figure below reuses an already-shipped hook/component
// exactly as it exists elsewhere in this codebase:
//   - Decision (recommendation, evidence, checklist, risks, catalysts,
//     portfolio fit) → the same GET /stock-analyst/decision/:symbol
//     DecisionEngine.tsx already fetches, via the same undocumented
//     ?portfolioId= query pattern.
//   - Investment Memo → new GET /stock-analyst/investment-memo/:symbol
//     (lib/investmentMemo.ts), itself a pure template composed entirely
//     from the same report/decision fields — see that module's own header
//     comment for the full reuse map.
//   - Decision Timeline / Meeting History / Saved Committee Decisions →
//     useGetDecisionSnapshots/useSaveDecisionSnapshot, the exact hooks
//     DecisionEngine.tsx already uses (investing_decision_snapshots,
//     Phase 14) — zero new persistence.
//   - Committee Dashboard / Active Reviews → the new, cross-symbol
//     GET /stock-analyst/decision/snapshots/recent (same table, symbol
//     filter removed) — the one genuine workflow gap this phase's audit
//     found.
//   - Research Notes → StockResearch.tsx's own exported <ResearchNotesCard>
//     (byte-identical import, not a re-implementation).
import { useState, useEffect, useRef } from "react";
import { useSearch, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetPortfolios,
  useGetDecisionSnapshots,
  useSaveDecisionSnapshot,
  useGetRecentDecisionSnapshots,
  getGetDecisionSnapshotsQueryKey,
} from "@workspace/api-client-react";
import { useInstitutionalDecision, useInvestmentMemo } from "@/hooks/use-institutional-decision";
import { recommendationBadgeClass, checklistBadgeClass } from "@/lib/investing-format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Search, Save, ScrollText, Clock, ShieldAlert, Briefcase, NotebookPen } from "lucide-react";
import { CoachDrawer } from "@/components/coach/CoachDrawer";
import { ResearchNotesCard } from "./StockResearch";

export default function InvestmentCommitteeWorkbench() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [symbolInput, setSymbolInput] = useState("");
  const [symbol, setSymbol] = useState<string | null>(null);
  const [portfolioId, setPortfolioId] = useState<number | null>(null);

  const { data: portfolios } = useGetPortfolios();
  const { data: activeReviews, isLoading: activeReviewsLoading } = useGetRecentDecisionSnapshots();

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

  const { data: decision, isLoading: decisionLoading, isError: decisionError } = useInstitutionalDecision(symbol ?? "", portfolioId);
  const { data: memo, isLoading: memoLoading, isError: memoError } = useInvestmentMemo(symbol ?? "", portfolioId);
  const { data: snapshots } = useGetDecisionSnapshots(symbol ?? "", {
    query: { queryKey: getGetDecisionSnapshotsQueryKey(symbol ?? ""), enabled: !!symbol },
  });
  const saveSnapshot = useSaveDecisionSnapshot();

  function selectSymbol(s: string) {
    const upper = s.trim().toUpperCase();
    if (!upper) return;
    autoRanRef.current = upper;
    setSymbolInput(upper);
    setSymbol(upper);
  }

  function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    selectSymbol(symbolInput);
  }

  function handleRecordDecision() {
    if (!symbol) return;
    saveSnapshot.mutate(
      { symbol },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDecisionSnapshotsQueryKey(symbol) });
          queryClient.invalidateQueries({ queryKey: ["getRecentDecisionSnapshots"] });
          toast({ title: "Committee decision recorded" });
        },
        onError: () => toast({ title: "Failed to record decision", variant: "destructive" }),
      },
    );
  }

  const analyzedPortfolioName = portfolios?.find((p) => p.id === portfolioId)?.name ?? null;

  return (
    <div className="space-y-6" data-testid="investment-committee-workbench">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-400" /> Investment Committee
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          A single, sequential workflow — select a company, review its research/valuation/Decision Engine/Portfolio
          Optimisation/Monitoring outputs, generate a deterministic Investment Memo, and record a Committee decision.
          Every figure below is a direct reuse of an already-computed, already-tested engine.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2" data-testid="committee-labels">
          <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-400">
            Institutional Investment Committee
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

      {/* Committee Dashboard */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Committee Dashboard</CardTitle>
          <CardDescription>Select a company to begin a review, or reopen a recent one from Active Reviews below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAnalyze} className="flex flex-wrap gap-2 items-center">
            <Input
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              placeholder="Symbol, e.g. AAPL"
              className="max-w-[180px]"
              data-testid="input-committee-symbol"
            />
            <Select
              value={portfolioId ? String(portfolioId) : "none"}
              onValueChange={(v) => setPortfolioId(v === "none" ? null : Number(v))}
            >
              <SelectTrigger className="w-[220px]" data-testid="select-committee-portfolio">
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
            <Button type="submit" size="sm" className="gap-1.5" data-testid="button-analyze-committee">
              <Search className="w-4 h-4" /> Review
            </Button>
          </form>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Active Reviews</p>
            {activeReviewsLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : !activeReviews || activeReviews.length === 0 ? (
              <p className="text-xs text-muted-foreground" data-testid="active-reviews-empty">
                No committee decisions recorded yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2" data-testid="active-reviews-list">
                {activeReviews.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectSymbol(s.symbol)}
                    className="text-xs rounded border border-border/60 px-2 py-1 hover:bg-accent flex items-center gap-1.5"
                    data-testid={`active-review-${s.id}`}
                  >
                    <span className="font-medium">{s.symbol}</span>
                    <Badge className={recommendationBadgeClass(s.recommendation)}>{s.recommendation}</Badge>
                    <span className="text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!symbol && (
        <p className="text-sm text-muted-foreground" data-testid="committee-empty">
          Enter a symbol above (optionally with a portfolio for Portfolio Impact context) to begin a review.
        </p>
      )}

      {symbol && (decisionLoading || memoLoading) && <Skeleton className="h-64 w-full" />}
      {symbol && (decisionError || memoError) && (
        <p className="text-sm text-destructive" data-testid="committee-error">
          Unknown symbol: {symbol}
        </p>
      )}

      {symbol && decision && memo && (
        <div data-testid="committee-workspace">
          <Card className="bg-card border-border mb-4">
            <CardContent className="py-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{decision.symbol}</span>
                <Badge className={recommendationBadgeClass(decision.recommendation)} data-testid="committee-recommendation">
                  {decision.recommendation}
                </Badge>
                <Badge variant="outline" className="font-mono">
                  Confidence {decision.confidence}/100
                </Badge>
                {portfolioId && analyzedPortfolioName && (
                  <span className="text-xs text-muted-foreground">vs. {analyzedPortfolioName}</span>
                )}
                <Link
                  href={`/research-terminal?symbol=${decision.symbol}${portfolioId ? `&portfolioId=${portfolioId}` : ""}`}
                  className="text-xs text-primary hover:underline"
                  data-testid="link-research-terminal"
                >
                  Open Research Terminal →
                </Link>
              </div>
              <Button size="sm" onClick={handleRecordDecision} className="gap-1.5" data-testid="button-record-decision">
                <Save className="w-4 h-4" /> Record Committee Decision
              </Button>
            </CardContent>
          </Card>

          <Tabs defaultValue="memo">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="memo" data-testid="tab-memo">Memo Viewer</TabsTrigger>
              <TabsTrigger value="timeline" data-testid="tab-timeline">Decision Timeline</TabsTrigger>
              <TabsTrigger value="evidence" data-testid="tab-evidence">Evidence Panel</TabsTrigger>
              <TabsTrigger value="portfolio-impact" data-testid="tab-portfolio-impact">Portfolio Impact</TabsTrigger>
              <TabsTrigger value="risks-catalysts" data-testid="tab-risks-catalysts">Risks &amp; Catalysts</TabsTrigger>
              <TabsTrigger value="notes" data-testid="tab-research-notes">Research Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="memo" className="mt-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-indigo-400" /> Investment Memo
                    <Badge variant="outline" className="ml-auto text-[10px] border-border">Deterministic</Badge>
                    {symbol && <CoachDrawer symbol={symbol} coach="committee" portfolioId={portfolioId} />}
                  </CardTitle>
                  <CardDescription>{memo.overview}</CardDescription>
                  {symbol && (
                    <Link
                      href={`/reporting-centre?reportType=investment-committee&symbol=${symbol}${portfolioId ? `&portfolioId=${portfolioId}` : ""}`}
                      className="text-xs text-primary hover:underline"
                      data-testid="link-generate-report"
                    >
                      Generate Report →
                    </Link>
                  )}
                </CardHeader>
                <CardContent className="space-y-4" data-testid="memo-content">
                  {memo.sections.map((s) => (
                    <div key={s.heading}>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{s.heading}</h4>
                      {s.paragraphs.map((p, i) => (
                        <p key={i} className="text-sm text-foreground/80 mb-1.5">
                          {p}
                        </p>
                      ))}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-2 border-t border-border">{memo.disclaimer}</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="mt-4 space-y-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" /> Decision Timeline
                  </CardTitle>
                  <CardDescription>Meeting history — every saved Committee decision for this symbol, newest first.</CardDescription>
                </CardHeader>
                <CardContent>
                  {(!snapshots || snapshots.length === 0) ? (
                    <p className="text-sm text-muted-foreground" data-testid="timeline-empty">No committee decisions recorded yet for this symbol.</p>
                  ) : (
                    <div className="space-y-2" data-testid="timeline-list">
                      {snapshots.map((s) => (
                        <div key={s.id} className="flex items-center justify-between rounded border border-border/60 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Badge className={recommendationBadgeClass(s.recommendation)}>{s.recommendation}</Badge>
                            <span className="text-xs text-muted-foreground">Confidence {s.confidence}/100</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
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
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Supporting Metrics (Checklist)</CardTitle></CardHeader>
                <CardContent className="space-y-2" data-testid="evidence-checklist">
                  {decision.checklist.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 py-1">
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.explanation}</p>
                      </div>
                      <Badge className={checklistBadgeClass(item.status)} data-testid={`evidence-checklist-${item.id}`}>
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="portfolio-impact" className="mt-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-indigo-400" /> Portfolio Impact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2" data-testid="portfolio-impact-content">
                  {!decision.portfolioFit.available ? (
                    <p className="text-sm text-muted-foreground">{decision.portfolioFit.reason ?? "No portfolio context supplied."}</p>
                  ) : (
                    <>
                      <p className="text-sm">
                        {decision.portfolioFit.alreadyHeld
                          ? `Already held — current weight ${decision.portfolioFit.currentWeightPct?.toFixed(1) ?? "unknown"}%.`
                          : "Not currently held in the selected portfolio."}
                      </p>
                      {decision.portfolioFit.sectorExposurePct != null && (
                        <p className="text-sm text-muted-foreground">
                          Sector exposure: {decision.portfolioFit.sectorExposurePct.toFixed(1)}% of portfolio.
                        </p>
                      )}
                    </>
                  )}
                  {portfolioId && (
                    <Link
                      href={`/stock-analyst/portfolio-optimisation?portfolioId=${portfolioId}`}
                      className="text-xs text-primary hover:underline block"
                      data-testid="link-review-optimisation"
                    >
                      Review Portfolio Optimisation →
                    </Link>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risks-catalysts" className="mt-4 space-y-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" /> Risks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {decision.risks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None identified.</p>
                  ) : (
                    <ul className="text-sm space-y-1 list-disc pl-4">
                      {decision.risks.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Catalysts</CardTitle></CardHeader>
                <CardContent>
                  {decision.catalysts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None identified.</p>
                  ) : (
                    <ul className="text-sm space-y-1 list-disc pl-4">
                      {decision.catalysts.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <NotebookPen className="w-4 h-4 text-indigo-400" /> Research Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResearchNotesCard symbol={symbol} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
