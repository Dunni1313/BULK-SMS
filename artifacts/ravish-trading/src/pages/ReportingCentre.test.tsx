// Phase 22 — Institutional Reporting & Client Presentation Engine. Frontend
// smoke tests, following the established mocked-generated-hook pattern (see
// PortfolioConstruction.test.tsx). Every one of the 9 report-type-fetching
// hooks is mocked to return the same shared fixture regardless of which one
// is actually "enabled" — sufficient to prove the page's own rendering,
// section-selection, export, presentation, save, and comparison behavior
// without re-testing each backend endpoint (already covered by
// institutionalReporting.route.test.ts).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";

const mockState = vi.hoisted(() => ({
  reportTypes: [
    { reportType: "investment-committee", label: "Investment Committee Report", description: "d", requiresSymbol: true, requiresPortfolio: false },
    { reportType: "company-research", label: "Single Company Research Report", description: "d", requiresSymbol: true, requiresPortfolio: false },
    { reportType: "portfolio-review", label: "Portfolio Review Report", description: "d", requiresSymbol: false, requiresPortfolio: true },
    { reportType: "portfolio-health", label: "Portfolio Health Report", description: "d", requiresSymbol: false, requiresPortfolio: true },
    { reportType: "watchlist", label: "Watchlist Report", description: "d", requiresSymbol: false, requiresPortfolio: false },
    { reportType: "opportunity-discovery", label: "Opportunity Discovery Report", description: "d", requiresSymbol: false, requiresPortfolio: false },
    { reportType: "monitoring-summary", label: "Monitoring Summary Report", description: "d", requiresSymbol: false, requiresPortfolio: false },
    { reportType: "ai-coach-summary", label: "AI Coach Learning Summary", description: "d", requiresSymbol: false, requiresPortfolio: false },
    { reportType: "executive-summary", label: "Executive Summary", description: "d", requiresSymbol: false, requiresPortfolio: false },
  ] as unknown[],
  portfolios: [{ id: 1, name: "Core Portfolio", holdingsCount: 2 }] as unknown[],
  report: undefined as unknown,
  savedReports: [] as unknown[],
  openedSaved: undefined as unknown,
}));

const saveMutate = vi.fn();
const deleteMutate = vi.fn();
const savedListRefetch = vi.fn();

function fixtureReport(overrides: Record<string, unknown> = {}) {
  return {
    reportType: "executive-summary",
    title: "Executive Summary — 2026-01-15",
    subtitle: "Macro regime: Stable Rates.",
    symbol: null,
    portfolioId: null,
    generatedAt: "2026-01-15T00:00:00.000Z",
    dataSource: "MIXED",
    sections: [
      { id: "executive-summary", title: "Executive Summary", body: "Macro regime: Stable Rates.", bullets: ["Bullet A", "Bullet B"] },
      { id: "investment-committee", title: "Engine 1 — Institutional Investing", body: "Macro regime: Stable Rates. 1 watchlist item tracked." },
      { id: "portfolio-health", title: "Engine 3 — Options Income", body: "Health: 80 (Good). 3 open positions." },
    ],
    disclaimer: "Educational research only — not investment advice.",
    ...overrides,
  };
}

vi.mock("@workspace/api-client-react", async () => {
  const actual = await vi.importActual<typeof import("@workspace/api-client-react")>("@workspace/api-client-react");
  const reportResult = () => ({ data: mockState.report, isLoading: false, isError: false });
  return {
    ...actual,
    useGetReportTypes: () => ({ data: mockState.reportTypes }),
    useGetPortfolios: () => ({ data: mockState.portfolios }),
    useGetInvestmentCommitteeReport: reportResult,
    useGetCompanyResearchReport: reportResult,
    useGetPortfolioReviewReport: reportResult,
    useGetPortfolioHealthReport: reportResult,
    useGetWatchlistReport: reportResult,
    useGetOpportunityDiscoveryReport: reportResult,
    useGetMonitoringSummaryReport: reportResult,
    useGetAiCoachLearningSummaryReport: reportResult,
    useGetExecutiveSummaryReport: reportResult,
    useSaveInstitutionalReport: () => ({ mutate: saveMutate, isPending: false }),
    useListInstitutionalReports: () => ({ data: mockState.savedReports, refetch: savedListRefetch }),
    useGetSavedInstitutionalReport: () => ({ data: mockState.openedSaved }),
    useDeleteInstitutionalReport: () => ({ mutate: deleteMutate, isPending: false }),
  };
});

import ReportingCentre from "./ReportingCentre";

describe("ReportingCentre page", () => {
  beforeEach(() => {
    mockState.report = undefined;
    mockState.savedReports = [];
    mockState.openedSaved = undefined;
    saveMutate.mockReset();
    deleteMutate.mockReset();
    savedListRefetch.mockReset();
  });

  it("renders permanent labels and the honest empty state before generating a report", () => {
    renderWithClient(<ReportingCentre />);
    expect(screen.getByTestId("reporting-centre-labels")).toHaveTextContent("Institutional Reporting");
    expect(screen.getByTestId("reporting-centre-labels")).toHaveTextContent("Evidence Based");
    expect(screen.getByTestId("reporting-centre-labels")).toHaveTextContent("Deterministic");
    expect(screen.getByTestId("reporting-centre-labels")).toHaveTextContent("Professional");
    expect(screen.getByTestId("reporting-centre-empty")).toBeInTheDocument();
  });

  it("generates the default Executive Summary report and shows the Report Preview", async () => {
    mockState.report = fixtureReport();
    renderWithClient(<ReportingCentre />);

    await userEvent.click(screen.getByTestId("button-generate-report"));

    expect(await screen.findByTestId("reporting-report-title")).toHaveTextContent("Executive Summary");
    const preview = screen.getByTestId("report-preview-content");
    expect(within(preview).getByText("Executive Summary")).toBeInTheDocument();
    expect(within(preview).getByText("Bullet A")).toBeInTheDocument();
  });

  it("Section Selector toggling a section removes it from the Report Preview", async () => {
    mockState.report = fixtureReport();
    renderWithClient(<ReportingCentre />);
    await userEvent.click(screen.getByTestId("button-generate-report"));
    await screen.findByTestId("reporting-report-title");

    await userEvent.click(screen.getByTestId("tab-section-selector"));
    await userEvent.click(screen.getByTestId("checkbox-section-portfolio-health"));

    await userEvent.click(screen.getByTestId("tab-report-preview"));
    const preview = screen.getByTestId("report-preview-content");
    expect(within(preview).queryByText("Engine 3 — Options Income")).not.toBeInTheDocument();
    expect(within(preview).getByText("Engine 1 — Institutional Investing")).toBeInTheDocument();
  });

  it("Export Preview shows a printable summary and the Print button never throws", async () => {
    mockState.report = fixtureReport();
    const printSpy = vi.fn();
    Object.defineProperty(window, "print", { value: printSpy, writable: true });
    renderWithClient(<ReportingCentre />);
    await userEvent.click(screen.getByTestId("button-generate-report"));
    await screen.findByTestId("reporting-report-title");

    await userEvent.click(screen.getByTestId("tab-export-preview"));
    expect(screen.getByTestId("export-preview-content")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("button-print-report"));
    expect(printSpy).toHaveBeenCalled();
  });

  it("Presentation View navigates between sections", async () => {
    mockState.report = fixtureReport();
    renderWithClient(<ReportingCentre />);
    await userEvent.click(screen.getByTestId("button-generate-report"));
    await screen.findByTestId("reporting-report-title");

    await userEvent.click(screen.getByTestId("tab-presentation-view"));
    expect(screen.getByTestId("presentation-slide-title")).toHaveTextContent("Executive Summary");
    expect(screen.getByTestId("presentation-slide-counter")).toHaveTextContent("1 / 3");

    await userEvent.click(screen.getByTestId("button-presentation-next"));
    expect(screen.getByTestId("presentation-slide-counter")).toHaveTextContent("2 / 3");
    expect(screen.getByTestId("presentation-slide-title")).toHaveTextContent("Engine 1 — Institutional Investing");

    await userEvent.click(screen.getByTestId("button-presentation-prev"));
    expect(screen.getByTestId("presentation-slide-counter")).toHaveTextContent("1 / 3");
  });

  it("Save Report calls the save mutation with the generated report's own type", async () => {
    mockState.report = fixtureReport();
    renderWithClient(<ReportingCentre />);
    await userEvent.click(screen.getByTestId("button-generate-report"));
    await screen.findByTestId("reporting-report-title");

    await userEvent.click(screen.getByTestId("button-save-report"));
    expect(saveMutate).toHaveBeenCalledWith(
      { data: expect.objectContaining({ reportType: "executive-summary" }) },
      expect.anything(),
    );
  });

  it("Saved Reports lists a real saved report and supports delete", async () => {
    mockState.savedReports = [{ id: 7, reportType: "executive-summary", title: "Executive Summary — 2026-01-15", symbol: null, portfolioId: null, dataSource: "MIXED", createdAt: "2026-01-15T00:00:00.000Z" }];
    renderWithClient(<ReportingCentre />);

    expect(screen.getByTestId("saved-report-7")).toHaveTextContent("Executive Summary — 2026-01-15");
    await userEvent.click(screen.getByTestId("button-delete-saved-report-7"));
    expect(deleteMutate).toHaveBeenCalledWith({ id: 7 }, expect.anything());
  });

  it("honestly shows no saved reports when there are none", () => {
    renderWithClient(<ReportingCentre />);
    expect(screen.getByTestId("saved-reports-empty")).toBeInTheDocument();
  });

  it("Comparison Report renders two side-by-side panels once both symbols are submitted", async () => {
    mockState.report = fixtureReport({ symbol: "AAPL" });
    renderWithClient(<ReportingCentre />);

    await userEvent.type(screen.getByTestId("input-compare-symbol-a"), "AAPL");
    await userEvent.type(screen.getByTestId("input-compare-symbol-b"), "MSFT");
    await userEvent.click(screen.getByTestId("button-compare-reports"));

    const content = await screen.findByTestId("comparison-report-content");
    expect(within(content).getAllByText("Executive Summary — 2026-01-15")).toHaveLength(2);
  });

  it("honestly hides the symbol input for the default Executive Summary report type (no symbol required)", () => {
    renderWithClient(<ReportingCentre />);
    expect(screen.queryByTestId("input-reporting-symbol")).not.toBeInTheDocument();
    expect(screen.queryByTestId("select-reporting-portfolio")).not.toBeInTheDocument();
  });
});
