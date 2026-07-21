// Phase 22 — Institutional Reporting & Client Presentation Engine.
//
// PURE PRESENTATION LAYER. This page introduces no new valuation model, no
// new scoring system, and no new investment recommendation — every report
// it renders is a direct read of one of the GET /reporting/* endpoints
// (lib/institutionalReporting.ts), itself a pure composition over
// already-shipped engines (ValueResearchReport, InstitutionalDecisionAnalysis,
// InvestmentMemo, CoachExplanation, PortfolioIntelligenceAnalysis,
// PortfolioOptimisationAnalysis, OpportunityScanResult, platform_notifications,
// WatchlistTargetCheck, CrossEngineDailyReport, LearningProgressSummary).
//
// Every one of the 12 report-type hooks below is mounted unconditionally
// (Rules of Hooks) but gated via `enabled` on the currently-selected report
// type AND an explicit "Generate Report" click — never fetched as a side
// effect of typing into the builder form.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import {
  useGetReportTypes,
  getGetReportTypesQueryKey,
  useGetInvestmentCommitteeReport,
  getGetInvestmentCommitteeReportQueryKey,
  useGetCompanyResearchReport,
  getGetCompanyResearchReportQueryKey,
  useGetPortfolioReviewReport,
  getGetPortfolioReviewReportQueryKey,
  useGetPortfolioHealthReport,
  getGetPortfolioHealthReportQueryKey,
  useGetWatchlistReport,
  getGetWatchlistReportQueryKey,
  useGetOpportunityDiscoveryReport,
  getGetOpportunityDiscoveryReportQueryKey,
  useGetMonitoringSummaryReport,
  getGetMonitoringSummaryReportQueryKey,
  useGetAiCoachLearningSummaryReport,
  getGetAiCoachLearningSummaryReportQueryKey,
  useGetExecutiveSummaryReport,
  getGetExecutiveSummaryReportQueryKey,
  useGetTradePlanningSummaryReport,
  getGetTradePlanningSummaryReportQueryKey,
  useGetStrategyFrameworkSummaryReport,
  getGetStrategyFrameworkSummaryReportQueryKey,
  useGetTradingAnalyticsSummaryReport,
  getGetTradingAnalyticsSummaryReportQueryKey,
  useGetExecutiveIntelligenceSummaryReport,
  getGetExecutiveIntelligenceSummaryReportQueryKey,
  useGetOptionsIncomeSummaryReport,
  getGetOptionsIncomeSummaryReportQueryKey,
  useGetOptionsPortfolioReviewReport,
  getGetOptionsPortfolioReviewReportQueryKey,
  useGetPositionLifecycleSummaryReport,
  getGetPositionLifecycleSummaryReportQueryKey,
  useSaveInstitutionalReport,
  useListInstitutionalReports,
  getListInstitutionalReportsQueryKey,
  useGetSavedInstitutionalReport,
  getGetSavedInstitutionalReportQueryKey,
  useDeleteInstitutionalReport,
  useGetPortfolios,
  type InstitutionalReport,
  type InstitutionalReportListItem,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FileBarChart, Search, Save, Printer, ChevronLeft, ChevronRight, Trash2, GitCompare, Grid3x3 } from "lucide-react";

type ReportType =
  | "investment-committee"
  | "company-research"
  | "portfolio-review"
  | "portfolio-health"
  | "watchlist"
  | "opportunity-discovery"
  | "monitoring-summary"
  | "ai-coach-summary"
  | "executive-summary"
  | "trade-planning-summary"
  | "strategy-framework-summary"
  | "trading-analytics-summary"
  | "executive-intelligence-summary"
  | "options-income-summary"
  | "options-portfolio-review"
  | "position-lifecycle-summary";

type Density = "executive" | "detailed" | "presentation";

interface GeneratedTarget {
  type: ReportType;
  symbol: string;
  portfolioId: number | null;
}

const REPORT_TYPE_VALUES: ReportType[] = [
  "investment-committee",
  "company-research",
  "portfolio-review",
  "portfolio-health",
  "watchlist",
  "opportunity-discovery",
  "monitoring-summary",
  "ai-coach-summary",
  "executive-summary",
  "trade-planning-summary",
  "strategy-framework-summary",
  "trading-analytics-summary",
  "executive-intelligence-summary",
  "options-income-summary",
  "options-portfolio-review",
  "position-lifecycle-summary",
];

export default function ReportingCentre() {
  const { toast } = useToast();

  const { data: reportTypes } = useGetReportTypes({ query: { queryKey: getGetReportTypesQueryKey() } });
  const { data: portfolios } = useGetPortfolios();

  const [reportType, setReportType] = useState<ReportType>("executive-summary");
  const [symbolInput, setSymbolInput] = useState("");
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [generated, setGenerated] = useState<GeneratedTarget | null>(null);
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string> | null>(null);
  const [density, setDensity] = useState<Density>("detailed");
  const [slideIndex, setSlideIndex] = useState(0);
  const [viewTab, setViewTab] = useState("preview");

  // Deep-link support: ?reportType=&symbol=&portfolioId= (mirrors
  // DecisionEngine.tsx's/InstitutionalAICoach.tsx's own established ?symbol=
  // precedent) — lets the "Generate Report" links added across the other 10
  // integration surfaces land here pre-filled and auto-generated.
  const search = useSearch();
  const autoRanRef = useRef<string | null>(null);
  useEffect(() => {
    if (autoRanRef.current === search) return;
    const params = new URLSearchParams(search);
    const t = params.get("reportType") as ReportType | null;
    const sym = params.get("symbol");
    const pid = params.get("portfolioId");
    if (!t || !REPORT_TYPE_VALUES.includes(t)) return;
    autoRanRef.current = search;
    setReportType(t);
    if (sym) setSymbolInput(sym);
    const parsedPortfolioId = pid && Number.isInteger(Number(pid)) ? Number(pid) : null;
    setPortfolioId(parsedPortfolioId);
    setSelectedSectionIds(null);
    setSlideIndex(0);
    setGenerated({ type: t, symbol: (sym ?? "").toUpperCase(), portfolioId: parsedPortfolioId });
  }, [search]);

  const meta = reportTypes?.find((m) => m.reportType === reportType);

  const icRes = useGetInvestmentCommitteeReport(generated?.symbol || "PLACEHOLDER", {
    query: { queryKey: getGetInvestmentCommitteeReportQueryKey(generated?.symbol || "PLACEHOLDER"), enabled: generated?.type === "investment-committee" && !!generated.symbol },
  });
  const crRes = useGetCompanyResearchReport(generated?.symbol || "PLACEHOLDER", {
    query: { queryKey: getGetCompanyResearchReportQueryKey(generated?.symbol || "PLACEHOLDER"), enabled: generated?.type === "company-research" && !!generated.symbol },
  });
  const prRes = useGetPortfolioReviewReport(generated?.portfolioId ?? 0, {
    query: { queryKey: getGetPortfolioReviewReportQueryKey(generated?.portfolioId ?? 0), enabled: generated?.type === "portfolio-review" && !!generated.portfolioId },
  });
  const phRes = useGetPortfolioHealthReport(generated?.portfolioId ?? 0, {
    query: { queryKey: getGetPortfolioHealthReportQueryKey(generated?.portfolioId ?? 0), enabled: generated?.type === "portfolio-health" && !!generated.portfolioId },
  });
  const wlRes = useGetWatchlistReport({ query: { queryKey: getGetWatchlistReportQueryKey(), enabled: generated?.type === "watchlist" } });
  const odRes = useGetOpportunityDiscoveryReport({ query: { queryKey: getGetOpportunityDiscoveryReportQueryKey(), enabled: generated?.type === "opportunity-discovery" } });
  const msRes = useGetMonitoringSummaryReport({ query: { queryKey: getGetMonitoringSummaryReportQueryKey(), enabled: generated?.type === "monitoring-summary" } });
  const acRes = useGetAiCoachLearningSummaryReport({ query: { queryKey: getGetAiCoachLearningSummaryReportQueryKey(), enabled: generated?.type === "ai-coach-summary" } });
  const esRes = useGetExecutiveSummaryReport({ query: { queryKey: getGetExecutiveSummaryReportQueryKey(), enabled: generated?.type === "executive-summary" } });
  const tpsRes = useGetTradePlanningSummaryReport({ query: { queryKey: getGetTradePlanningSummaryReportQueryKey(), enabled: generated?.type === "trade-planning-summary" } });
  const sfsRes = useGetStrategyFrameworkSummaryReport({ query: { queryKey: getGetStrategyFrameworkSummaryReportQueryKey(), enabled: generated?.type === "strategy-framework-summary" } });
  const tasRes = useGetTradingAnalyticsSummaryReport({ query: { queryKey: getGetTradingAnalyticsSummaryReportQueryKey(), enabled: generated?.type === "trading-analytics-summary" } });
  const eisRes = useGetExecutiveIntelligenceSummaryReport({ query: { queryKey: getGetExecutiveIntelligenceSummaryReportQueryKey(), enabled: generated?.type === "executive-intelligence-summary" } });
  const oisRes = useGetOptionsIncomeSummaryReport({ query: { queryKey: getGetOptionsIncomeSummaryReportQueryKey(), enabled: generated?.type === "options-income-summary" } });
  const oprRes = useGetOptionsPortfolioReviewReport({ query: { queryKey: getGetOptionsPortfolioReviewReportQueryKey(), enabled: generated?.type === "options-portfolio-review" } });
  const plsRes = useGetPositionLifecycleSummaryReport({ query: { queryKey: getGetPositionLifecycleSummaryReportQueryKey(), enabled: generated?.type === "position-lifecycle-summary" } });

  interface SimpleQueryState {
    data?: InstitutionalReport;
    isLoading: boolean;
    isError: boolean;
  }

  const activeResult = useMemo((): SimpleQueryState | null => {
    if (!generated) return null;
    const byType: Record<ReportType, SimpleQueryState> = {
      "investment-committee": icRes,
      "company-research": crRes,
      "portfolio-review": prRes,
      "portfolio-health": phRes,
      watchlist: wlRes,
      "opportunity-discovery": odRes,
      "monitoring-summary": msRes,
      "ai-coach-summary": acRes,
      "executive-summary": esRes,
      "trade-planning-summary": tpsRes,
      "strategy-framework-summary": sfsRes,
      "trading-analytics-summary": tasRes,
      "executive-intelligence-summary": eisRes,
      "options-income-summary": oisRes,
      "options-portfolio-review": oprRes,
      "position-lifecycle-summary": plsRes,
    };
    return byType[generated.type];
  }, [generated, icRes, crRes, prRes, phRes, wlRes, odRes, msRes, acRes, esRes, tpsRes, sfsRes, tasRes, eisRes, oisRes, oprRes, plsRes]);

  const report = activeResult?.data as InstitutionalReport | undefined;
  const isLoading = activeResult?.isLoading ?? false;
  const isError = activeResult?.isError ?? false;

  const visibleSections = useMemo(() => {
    if (!report) return [];
    if (!selectedSectionIds) return report.sections;
    return report.sections.filter((s) => selectedSectionIds.has(s.id));
  }, [report, selectedSectionIds]);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (meta?.requiresSymbol && !symbolInput.trim()) return;
    if (meta?.requiresPortfolio && portfolioId == null) return;
    setSelectedSectionIds(null);
    setSlideIndex(0);
    setGenerated({ type: reportType, symbol: symbolInput.trim().toUpperCase(), portfolioId });
  };

  const saveMutation = useSaveInstitutionalReport();
  const handleSave = () => {
    if (!generated) return;
    saveMutation.mutate(
      { data: { reportType: generated.type, symbol: generated.symbol || undefined, portfolioId: generated.portfolioId ?? undefined } },
      {
        onSuccess: () => {
          toast({ title: "Report saved" });
          savedListRefetch();
        },
        onError: () => toast({ title: "Could not save this report", variant: "destructive" }),
      },
    );
  };

  const { data: savedReports, refetch: savedListRefetch } = useListInstitutionalReports({
    query: { queryKey: getListInstitutionalReportsQueryKey() },
  });
  const [openSavedId, setOpenSavedId] = useState<number | null>(null);
  const { data: openedSaved } = useGetSavedInstitutionalReport(openSavedId ?? 0, {
    query: { queryKey: getGetSavedInstitutionalReportQueryKey(openSavedId ?? 0), enabled: !!openSavedId },
  });
  const deleteMutation = useDeleteInstitutionalReport();

  // ── Comparison Report — pure frontend composition of two already-generated
  // Single Company Research Reports, per the Phase 22 audit's own resolved
  // design decision (no new backend endpoint, no duplicated logic). ─────────
  const [compareASymbol, setCompareASymbol] = useState("");
  const [compareBSymbol, setCompareBSymbol] = useState("");
  const [compareTarget, setCompareTarget] = useState<{ a: string; b: string } | null>(null);
  const compareARes = useGetCompanyResearchReport(compareTarget?.a || "PLACEHOLDER", {
    query: { queryKey: getGetCompanyResearchReportQueryKey(compareTarget?.a || "PLACEHOLDER"), enabled: !!compareTarget?.a },
  });
  const compareBRes = useGetCompanyResearchReport(compareTarget?.b || "PLACEHOLDER", {
    query: { queryKey: getGetCompanyResearchReportQueryKey(compareTarget?.b || "PLACEHOLDER"), enabled: !!compareTarget?.b },
  });
  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compareASymbol.trim() || !compareBSymbol.trim()) return;
    setCompareTarget({ a: compareASymbol.trim().toUpperCase(), b: compareBSymbol.trim().toUpperCase() });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="hidden print:block print:p-8" id="reporting-centre-print-area">
        {report && <PrintableReport report={report} sections={visibleSections} />}
      </div>

      <div className="print:hidden space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-indigo-400" /> Institutional Reporting Centre
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Converts the platform's own existing, already-computed research, decision, portfolio, opportunity,
            monitoring, and learning outputs into professional reports for investment committees, portfolio reviews,
            and client presentations — never a new valuation model, scoring system, or investment recommendation.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2" data-testid="reporting-centre-labels">
            <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-400" data-testid="badge-reporting-institutional-reporting">
              Institutional Reporting
            </Badge>
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground" data-testid="badge-reporting-evidence-based">
              Evidence Based
            </Badge>
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground" data-testid="badge-reporting-deterministic">
              Deterministic
            </Badge>
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground" data-testid="badge-reporting-professional">
              Professional
            </Badge>
          </div>
          {/* Phase 34 — Cross-Engine Orchestration & Unified Workspace. Pure
              navigation, no fetch. */}
          <Link href="/cross-engine-workspace?tab=shortcuts" className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 mt-2" data-testid="link-open-cross-engine-workspace">
            <Grid3x3 className="w-3 h-3" /> Open Cross-Engine Workspace →
          </Link>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Report Builder</CardTitle>
            <CardDescription>Choose a report type and its inputs, then generate.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="flex flex-wrap gap-2 items-center">
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger className="w-[260px]" data-testid="select-report-type">
                  <SelectValue placeholder="Report type" />
                </SelectTrigger>
                <SelectContent>
                  {(reportTypes ?? []).map((m) => (
                    <SelectItem key={m.reportType} value={m.reportType}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {meta?.requiresSymbol && (
                <Input
                  value={symbolInput}
                  onChange={(e) => setSymbolInput(e.target.value)}
                  placeholder="Symbol, e.g. AAPL"
                  className="max-w-[160px]"
                  data-testid="input-reporting-symbol"
                />
              )}
              {meta?.requiresPortfolio && (
                <Select value={portfolioId ? String(portfolioId) : ""} onValueChange={(v) => setPortfolioId(v ? Number(v) : null)}>
                  <SelectTrigger className="w-[220px]" data-testid="select-reporting-portfolio">
                    <SelectValue placeholder="Select a portfolio" />
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
              <Button type="submit" size="sm" className="gap-1.5" data-testid="button-generate-report">
                <Search className="w-4 h-4" /> Generate Report
              </Button>
            </form>
            {meta && <p className="text-xs text-muted-foreground mt-2">{meta.description}</p>}
          </CardContent>
        </Card>

        {!generated && (
          <div className="text-sm text-muted-foreground" data-testid="reporting-centre-empty">
            Select a report type above and generate a report to preview, select sections, and export.
          </div>
        )}

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {isError && (
          <div className="text-sm text-destructive" data-testid="reporting-centre-error">
            Could not generate this report — check the symbol/portfolio and try again.
          </div>
        )}

        {report && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base" data-testid="reporting-report-title">
                  {report.title}
                </CardTitle>
                <CardDescription>{report.subtitle}</CardDescription>
              </div>
              <div className="flex gap-2 shrink-0">
                <Select value={density} onValueChange={(v) => setDensity(v as Density)}>
                  <SelectTrigger className="w-[140px]" data-testid="select-report-density">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="executive">Executive</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleSave} data-testid="button-save-report">
                  <Save className="w-4 h-4" /> Save Report
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={viewTab} onValueChange={setViewTab}>
                <TabsList>
                  <TabsTrigger value="preview" data-testid="tab-report-preview">
                    Report Preview
                  </TabsTrigger>
                  <TabsTrigger value="sections" data-testid="tab-section-selector">
                    Section Selector
                  </TabsTrigger>
                  <TabsTrigger value="export" data-testid="tab-export-preview">
                    Export Preview
                  </TabsTrigger>
                  <TabsTrigger value="presentation" data-testid="tab-presentation-view">
                    Presentation View
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="mt-4 space-y-4" data-testid="report-preview-content">
                  {visibleSections.map((s) => (
                    <div key={s.id} className="border-b border-border pb-3 last:border-0">
                      <h3 className="font-semibold text-foreground">{s.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{s.body}</p>
                      {density === "detailed" && s.bullets && s.bullets.length > 0 && (
                        <ul className="list-disc list-inside text-xs text-muted-foreground mt-2 space-y-0.5">
                          {s.bullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground italic pt-2">{report.disclaimer}</p>
                </TabsContent>

                <TabsContent value="sections" className="mt-4 space-y-2" data-testid="section-selector-content">
                  {report.sections.map((s) => {
                    const checked = selectedSectionIds ? selectedSectionIds.has(s.id) : true;
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const base = selectedSectionIds ?? new Set(report.sections.map((x) => x.id));
                            const next = new Set(base);
                            if (v) next.add(s.id);
                            else next.delete(s.id);
                            setSelectedSectionIds(next);
                          }}
                          data-testid={`checkbox-section-${s.id}`}
                        />
                        {s.title}
                      </label>
                    );
                  })}
                </TabsContent>

                <TabsContent value="export" className="mt-4 space-y-4" data-testid="export-preview-content">
                  <div className="border border-border rounded-md p-4 bg-background">
                    <h2 className="text-lg font-bold">{report.title}</h2>
                    <p className="text-sm text-muted-foreground">{report.subtitle}</p>
                    <div className="mt-4 space-y-3">
                      {visibleSections.map((s) => (
                        <div key={s.id}>
                          <h4 className="font-semibold text-sm">{s.title}</h4>
                          <p className="text-xs text-muted-foreground">{s.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" className="gap-1.5" onClick={() => window.print()} data-testid="button-print-report">
                    <Printer className="w-4 h-4" /> Print / Save as PDF
                  </Button>
                </TabsContent>

                <TabsContent value="presentation" className="mt-4" data-testid="presentation-view-content">
                  {visibleSections.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sections selected.</p>
                  ) : (
                    <div className="border border-border rounded-md p-8 min-h-[240px] flex flex-col justify-center bg-background">
                      <h2 className="text-xl font-bold text-center" data-testid="presentation-slide-title">
                        {visibleSections[Math.min(slideIndex, visibleSections.length - 1)].title}
                      </h2>
                      <p className="text-sm text-muted-foreground text-center mt-3">
                        {visibleSections[Math.min(slideIndex, visibleSections.length - 1)].body}
                      </p>
                      <div className="flex items-center justify-center gap-3 mt-6">
                        <Button
                          size="icon"
                          variant="outline"
                          disabled={slideIndex === 0}
                          onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                          data-testid="button-presentation-prev"
                          aria-label="Previous slide"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-xs text-muted-foreground" data-testid="presentation-slide-counter">
                          {Math.min(slideIndex, visibleSections.length - 1) + 1} / {visibleSections.length}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          disabled={slideIndex >= visibleSections.length - 1}
                          onClick={() => setSlideIndex((i) => Math.min(visibleSections.length - 1, i + 1))}
                          data-testid="button-presentation-next"
                          aria-label="Next slide"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Saved Reports</CardTitle>
          </CardHeader>
          <CardContent>
            {(savedReports ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="saved-reports-empty">
                No reports saved yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {(savedReports as InstitutionalReportListItem[]).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm border-b border-border pb-1.5 last:border-0">
                    <button type="button" className="text-left hover:underline" onClick={() => setOpenSavedId(r.id)} data-testid={`saved-report-${r.id}`}>
                      {r.title}
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate({ id: r.id }, { onSuccess: () => savedListRefetch() })}
                      data-testid={`button-delete-saved-report-${r.id}`}
                      aria-label={`Delete saved report: ${r.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {openedSaved && (
              <div className="mt-4 border-t border-border pt-4" data-testid="opened-saved-report">
                <h3 className="font-semibold">{(openedSaved as { report: InstitutionalReport }).report.title}</h3>
                <p className="text-sm text-muted-foreground">{(openedSaved as { report: InstitutionalReport }).report.subtitle}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-1.5">
              <GitCompare className="w-4 h-4" /> Comparison Report
            </CardTitle>
            <CardDescription>Side-by-side Single Company Research Reports for two symbols.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCompare} className="flex flex-wrap gap-2 items-center mb-4">
              <Input value={compareASymbol} onChange={(e) => setCompareASymbol(e.target.value)} placeholder="Symbol A" className="max-w-[140px]" data-testid="input-compare-symbol-a" />
              <Input value={compareBSymbol} onChange={(e) => setCompareBSymbol(e.target.value)} placeholder="Symbol B" className="max-w-[140px]" data-testid="input-compare-symbol-b" />
              <Button type="submit" size="sm" data-testid="button-compare-reports">
                Compare
              </Button>
            </form>
            {compareTarget && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="comparison-report-content">
                {[compareARes, compareBRes].map((res, i) => {
                  const r = res.data as InstitutionalReport | undefined;
                  return (
                    <div key={i} className="border border-border rounded-md p-3">
                      {res.isLoading && <Skeleton className="h-16 w-full" />}
                      {res.isError && <p className="text-sm text-destructive">Unresolvable symbol.</p>}
                      {r && (
                        <>
                          <h4 className="font-semibold text-sm">{r.title}</h4>
                          <p className="text-xs text-muted-foreground">{r.subtitle}</p>
                          <div className="mt-2 space-y-1.5">
                            {r.sections.slice(0, 5).map((s) => (
                              <div key={s.id}>
                                <span className="text-xs font-medium">{s.title}: </span>
                                <span className="text-xs text-muted-foreground">{s.body}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PrintableReport({ report, sections }: { report: InstitutionalReport; sections: InstitutionalReport["sections"] }) {
  return (
    <div>
      <h1 className="text-2xl font-bold">{report.title}</h1>
      <p className="text-muted-foreground">{report.subtitle}</p>
      <div className="mt-6 space-y-4">
        {sections.map((s) => (
          <div key={s.id}>
            <h3 className="font-semibold">{s.title}</h3>
            <p className="text-sm">{s.body}</p>
            {s.bullets && s.bullets.length > 0 && (
              <ul className="list-disc list-inside text-sm mt-1">
                {s.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs italic mt-6">{report.disclaimer}</p>
    </div>
  );
}
