// Phase 4, Sprint 53 — Frontend Bundle Code-Splitting (approved Phase 4
// plan, Sprint 53; see docs/Phase-4-Master-Execution-Plan.md's Sprint 53
// as-built note).
//
// Every page component below is loaded via React.lazy() + a dynamic
// import() instead of a static import, so each page becomes its own
// on-demand chunk rather than all of them being bundled into one ~1.5MB
// file loaded up front. This is a pure build-tooling change — every page's
// own component, props, routing path, and behavior are byte-for-byte
// unchanged; only how and when its JS arrives in the browser changed.
// pages/not-found.tsx is lazy-loaded too, for the same "every route is a
// real, on-demand chunk" consistency, even though it's small.
//
// <Suspense> wraps only the <Switch> (inside AppLayout), not the whole
// app shell — the sidebar/nav/header render immediately from the main
// bundle; only the page content area shows PageLoadingFallback while a
// route's own chunk is still downloading.

import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TradingCoachProvider } from "@/hooks/use-trading-coach";
import { useEffect } from "react";

// Pages
const NotFound = lazy(() => import("@/pages/not-found"));
// v1.5.0, Sprint 12 — Institutional Command Centre. Now the "/" landing
// page, superseding Home.tsx there — Home itself is unmodified, just
// relocated to "/personal-dashboard" (see its own header comment), the
// same "move, cross-link, never delete" pattern this codebase already
// used once before when Home.tsx itself superseded the original
// CommandCenter.tsx at "/" (Phase 10).
const InstitutionalCommandCentre = lazy(() => import("./pages/InstitutionalCommandCentre"));
// v1.5.0, Sprint 13 — Institutional Decision Engine. A distinct page from
// the pre-existing DecisionEngine.tsx (/decision-engine) — see that
// route's own line below and nav-items.ts for the disclosed disambiguation.
const DecisionWorkflow = lazy(() => import("./pages/DecisionWorkflow"));
const Home = lazy(() => import("./pages/Home"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const NotificationCentre = lazy(() => import("./pages/NotificationCentre"));
const OperationsDashboard = lazy(() => import("./pages/OperationsDashboard"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Scanner = lazy(() => import("./pages/Scanner"));
const OptionChain = lazy(() => import("./pages/OptionChain"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const PortfolioAI = lazy(() => import("./pages/PortfolioAI"));
const Trades = lazy(() => import("./pages/Trades"));
const TradeTicket = lazy(() => import("./pages/TradeTicket"));
const TradeExecutionCenter = lazy(() => import("./pages/TradeExecutionCenter"));
const Backtest = lazy(() => import("./pages/Backtest"));
const Scoring = lazy(() => import("./pages/Scoring"));
const Journal = lazy(() => import("./pages/Journal"));
const Assistant = lazy(() => import("./pages/Assistant"));
const Performance = lazy(() => import("./pages/Performance"));
const AutoPilot = lazy(() => import("./pages/AutoPilot"));
const Events = lazy(() => import("./pages/Events"));
const Adjustments = lazy(() => import("./pages/Adjustments"));
const StockResearch = lazy(() => import("./pages/StockResearch"));
const TradingResearch = lazy(() => import("./pages/TradingResearch"));
const TradingJournal = lazy(() => import("./pages/TradingJournal"));
const TradingBacktest = lazy(() => import("./pages/TradingBacktest"));
const TradeWorkspace = lazy(() => import("./pages/TradeWorkspace"));
const MarketStructureWorkbench = lazy(() => import("./pages/MarketStructureWorkbench"));
const LiquidityWorkbench = lazy(() => import("./pages/LiquidityWorkbench"));
const TradePlanningStudio = lazy(() => import("./pages/TradePlanningStudio"));
const OptionsBacktest = lazy(() => import("./pages/OptionsBacktest"));
const InstitutionalDashboard = lazy(() => import("./pages/InstitutionalDashboard"));
const InstitutionalIntelligence = lazy(() => import("./pages/InstitutionalIntelligence"));
const PortfolioAnalyst = lazy(() => import("./pages/PortfolioAnalyst"));
const AITradeJournal = lazy(() => import("./pages/TradeJournal"));
const InstitutionalMentor = lazy(() => import("./pages/InstitutionalMentor"));
const CrossEngineDailyReport = lazy(() => import("./pages/CrossEngineDailyReport"));
const StockScanner = lazy(() => import("./pages/StockScanner"));
const PortfolioConstruction = lazy(() => import("./pages/PortfolioConstruction"));
const InstitutionalWorkspace = lazy(() => import("./pages/InstitutionalWorkspace"));
const PortfolioOptimisation = lazy(() => import("./pages/PortfolioOptimisation"));
const InvestmentCommitteeWorkbench = lazy(() => import("./pages/InvestmentCommitteeWorkbench"));
const ResearchTerminal = lazy(() => import("./pages/ResearchTerminal"));
const InstitutionalAICoach = lazy(() => import("./pages/InstitutionalAICoach"));
const TradingAICoach = lazy(() => import("./pages/TradingAICoach"));
const AITradingCoach = lazy(() => import("./pages/AITradingCoach"));
const StrategyFramework = lazy(() => import("./pages/StrategyFramework"));
const StrategyWorkbench = lazy(() => import("./pages/StrategyWorkbench"));
const TradingAnalyticsDashboard = lazy(() => import("./pages/TradingAnalyticsDashboard"));
const ExecutiveIntelligence = lazy(() => import("./pages/ExecutiveIntelligence"));
const CrossEngineWorkspace = lazy(() => import("./pages/CrossEngineWorkspace"));
const OptionsIncomeWorkspace = lazy(() => import("./pages/OptionsIncomeWorkspace"));
const OptionsLifecycleManager = lazy(() => import("./pages/OptionsLifecycleManager"));
const RiskExposureEngine = lazy(() => import("./pages/RiskExposureEngine"));
const PerformanceAttributionEngine = lazy(() => import("./pages/PerformanceAttributionEngine"));
const ScenarioEngine = lazy(() => import("./pages/ScenarioEngine"));
const DecisionSupportEngine = lazy(() => import("./pages/DecisionSupportEngine"));
const RebalancingEngine = lazy(() => import("./pages/RebalancingEngine"));
const MonitoringComplianceEngine = lazy(() => import("./pages/MonitoringComplianceEngine"));
const WatchlistsEngine = lazy(() => import("./pages/WatchlistsEngine"));
const PortfolioWorkspace = lazy(() => import("./pages/PortfolioWorkspace"));
const ReportingCentre = lazy(() => import("./pages/ReportingCentre"));
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const DecisionEngine = lazy(() => import("./pages/DecisionEngine"));
const OpportunityDiscovery = lazy(() => import("./pages/OpportunityDiscovery"));
const MonitoringDashboard = lazy(() => import("./pages/MonitoringDashboard"));
const ValueInvestingSchool = lazy(() => import("./pages/ValueInvestingSchool"));
const PaperTradingReconciliation = lazy(() => import("./pages/PaperTradingReconciliation"));
const PaperPortfolio = lazy(() => import("./pages/PaperPortfolio"));
const TradeHistory = lazy(() => import("./pages/TradeHistory"));
const TradePerformance = lazy(() => import("./pages/TradePerformance"));
const OrderPreview = lazy(() => import("./pages/OrderPreview"));
const PositionSizing = lazy(() => import("./pages/PositionSizing"));
const TradeAdjustmentPreview = lazy(() => import("./pages/TradeAdjustmentPreview"));
const PortfolioStressTest = lazy(() => import("./pages/PortfolioStressTest"));
const PortfolioEventRisk = lazy(() => import("./pages/PortfolioEventRisk"));
const PortfolioConcentration = lazy(() => import("./pages/PortfolioConcentration"));
const PortfolioDashboard = lazy(() => import("./pages/PortfolioDashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const Login = lazy(() => import("./pages/Login"));

// Learn
const DeltaMasterclass = lazy(() => import("./pages/learn/DeltaMasterclass"));
const GreeksTutor = lazy(() => import("./pages/learn/GreeksTutor"));
const TradeLessons = lazy(() => import("./pages/learn/TradeLessons"));
const Quiz = lazy(() => import("./pages/learn/Quiz"));
const LearningCentre = lazy(() => import("./pages/learn/LearningCentre"));
const LearningPaths = lazy(() => import("./pages/learn/LearningPaths"));
const StrategyAcademy = lazy(() => import("./pages/learn/StrategyAcademy"));
const Glossary = lazy(() => import("./pages/learn/Glossary"));

// Phase 9 — a modest default staleTime avoids an immediate, redundant
// refetch every time a component using an already-fresh query remounts
// (e.g. navigating away and back within the window below), while staying
// short enough that no page shows meaningfully outdated data. Any page
// that needs tighter freshness already overrides this per-query (e.g.
// NotificationBell's own 20s poll) — this is only the default floor.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 15_000,
      gcTime: 5 * 60_000,
    },
  },
});

function PageLoadingFallback() {
  return (
    <div className="space-y-4 p-6" data-testid="page-loading-fallback">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function Router() {
  return (
    <TradingCoachProvider>
      <AppLayout>
        <Suspense fallback={<PageLoadingFallback />}>
          <Switch>
          <Route path="/login" component={Login} />
          <Route path="/" component={InstitutionalCommandCentre} />
          <Route path="/decision-workflow" component={DecisionWorkflow} />
          <Route path="/personal-dashboard" component={Home} />
          <Route path="/command-center" component={CommandCenter} />
          <Route path="/notifications" component={NotificationCentre} />
          <Route path="/operations" component={OperationsDashboard} />
          <Route path="/options-dashboard" component={Dashboard} />
          <Route path="/scanner" component={Scanner} />
          <Route path="/options/:symbol" component={OptionChain} />
          <Route path="/portfolio" component={Portfolio} />
          <Route path="/portfolio-ai" component={PortfolioAI} />
          <Route path="/trades" component={Trades} />
          <Route path="/ticket/adjust/:tradeId" component={TradeTicket} />
          <Route path="/ticket/:scannerId" component={TradeTicket} />
          <Route path="/trade-execution-center" component={TradeExecutionCenter} />
          <Route path="/backtest" component={Backtest} />
          <Route path="/scoring" component={Scoring} />
          <Route path="/journal" component={Journal} />
          <Route path="/assistant" component={Assistant} />
          <Route path="/performance" component={Performance} />
          <Route path="/autopilot" component={AutoPilot} />
          <Route path="/events" component={Events} />
          <Route path="/adjustments" component={Adjustments} />
          <Route path="/institutional-dashboard" component={InstitutionalDashboard} />
          <Route path="/institutional-intelligence" component={InstitutionalIntelligence} />
          <Route path="/portfolio-analyst" component={PortfolioAnalyst} />
          <Route path="/trade-journal-ai" component={AITradeJournal} />
          <Route path="/institutional-mentor" component={InstitutionalMentor} />
          <Route path="/decision-engine" component={DecisionEngine} />
          <Route path="/opportunity-discovery" component={OpportunityDiscovery} />
          <Route path="/monitoring-dashboard" component={MonitoringDashboard} />
          <Route path="/daily-report" component={CrossEngineDailyReport} />
          <Route path="/trading-research" component={TradingResearch} />
          <Route path="/trading-journal" component={TradingJournal} />
          <Route path="/trading-backtest" component={TradingBacktest} />
          <Route path="/trade-workspace" component={TradeWorkspace} />
          <Route path="/market-structure-workbench" component={MarketStructureWorkbench} />
          <Route path="/liquidity-workbench" component={LiquidityWorkbench} />
          <Route path="/trade-planning-studio" component={TradePlanningStudio} />
          <Route path="/trading-ai-coach" component={TradingAICoach} />
          <Route path="/ai-trading-coach" component={AITradingCoach} />
          <Route path="/strategy-framework" component={StrategyFramework} />
          <Route path="/strategy-workbench" component={StrategyWorkbench} />
          <Route path="/trading-analytics" component={TradingAnalyticsDashboard} />
          <Route path="/executive-intelligence" component={ExecutiveIntelligence} />
          <Route path="/cross-engine-workspace" component={CrossEngineWorkspace} />
          <Route path="/options-income-workspace" component={OptionsIncomeWorkspace} />
          <Route path="/options-lifecycle-manager" component={OptionsLifecycleManager} />
          <Route path="/risk-exposure-engine" component={RiskExposureEngine} />
          <Route path="/performance-attribution-engine" component={PerformanceAttributionEngine} />
          <Route path="/scenario-engine" component={ScenarioEngine} />
          <Route path="/decision-support-engine" component={DecisionSupportEngine} />
          <Route path="/rebalancing-engine" component={RebalancingEngine} />
          <Route path="/monitoring-compliance-engine" component={MonitoringComplianceEngine} />
          <Route path="/watchlists-engine" component={WatchlistsEngine} />
          <Route path="/portfolio-workspace" component={PortfolioWorkspace} />
          <Route path="/options-backtest" component={OptionsBacktest} />
          <Route path="/stock-analyst/scanner" component={StockScanner} />
          <Route path="/stock-analyst/portfolio-construction" component={PortfolioConstruction} />
          <Route path="/stock-analyst/portfolio-optimisation" component={PortfolioOptimisation} />
          <Route path="/stock-analyst/investment-committee" component={InvestmentCommitteeWorkbench} />
          <Route path="/research-terminal" component={ResearchTerminal} />
          <Route path="/institutional-ai-coach" component={InstitutionalAICoach} />
          <Route path="/reporting-centre" component={ReportingCentre} />
          <Route path="/stock-analyst/executive-dashboard" component={ExecutiveDashboard} />
          <Route path="/stock-analyst" component={StockResearch} />
          <Route path="/workspace" component={InstitutionalWorkspace} />
          <Route path="/broker-reconciliation" component={PaperTradingReconciliation} />
          <Route path="/paper-portfolio" component={PaperPortfolio} />
          <Route path="/trade-history" component={TradeHistory} />
          <Route path="/trade-performance" component={TradePerformance} />
          <Route path="/order-preview" component={OrderPreview} />
          <Route path="/position-sizing" component={PositionSizing} />
          <Route path="/adjustment-preview" component={TradeAdjustmentPreview} />
          <Route path="/stress-test" component={PortfolioStressTest} />
          <Route path="/event-risk" component={PortfolioEventRisk} />
          <Route path="/concentration-risk" component={PortfolioConcentration} />
          <Route path="/portfolio-dashboard" component={PortfolioDashboard} />
          <Route path="/settings" component={Settings} />
          <Route path="/learn/delta" component={DeltaMasterclass} />
          <Route path="/learn/greeks" component={GreeksTutor} />
          <Route path="/lessons" component={TradeLessons} />
          <Route path="/learn/quiz" component={Quiz} />
          <Route path="/learn/paths/:pathKey/:topicKey" component={LearningPaths} />
          <Route path="/learn/paths/:pathKey" component={LearningPaths} />
          <Route path="/learn/paths" component={LearningPaths} />
          <Route path="/learn/strategy-academy/:strategy" component={StrategyAcademy} />
          <Route path="/learn/strategy-academy" component={StrategyAcademy} />
          <Route path="/learn/glossary/:key" component={Glossary} />
          <Route path="/learn/glossary" component={Glossary} />
          <Route path="/learn" component={LearningCentre} />
          <Route path="/stock-analyst/value-investing-school" component={ValueInvestingSchool} />
          <Route component={NotFound} />
          </Switch>
        </Suspense>
      </AppLayout>
    </TradingCoachProvider>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
