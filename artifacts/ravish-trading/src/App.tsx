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
import { useEffect } from "react";

// Pages
const NotFound = lazy(() => import("@/pages/not-found"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Scanner = lazy(() => import("./pages/Scanner"));
const OptionChain = lazy(() => import("./pages/OptionChain"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const PortfolioAI = lazy(() => import("./pages/PortfolioAI"));
const Trades = lazy(() => import("./pages/Trades"));
const TradeTicket = lazy(() => import("./pages/TradeTicket"));
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
const OptionsBacktest = lazy(() => import("./pages/OptionsBacktest"));
const InstitutionalDashboard = lazy(() => import("./pages/InstitutionalDashboard"));
const InstitutionalIntelligence = lazy(() => import("./pages/InstitutionalIntelligence"));
const PortfolioAnalyst = lazy(() => import("./pages/PortfolioAnalyst"));
const AITradeJournal = lazy(() => import("./pages/TradeJournal"));
const CrossEngineDailyReport = lazy(() => import("./pages/CrossEngineDailyReport"));
const StockScanner = lazy(() => import("./pages/StockScanner"));
const PortfolioConstruction = lazy(() => import("./pages/PortfolioConstruction"));
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
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
    <AppLayout>
      <Suspense fallback={<PageLoadingFallback />}>
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/" component={CommandCenter} />
          <Route path="/options-dashboard" component={Dashboard} />
          <Route path="/scanner" component={Scanner} />
          <Route path="/options/:symbol" component={OptionChain} />
          <Route path="/portfolio" component={Portfolio} />
          <Route path="/portfolio-ai" component={PortfolioAI} />
          <Route path="/trades" component={Trades} />
          <Route path="/ticket/adjust/:tradeId" component={TradeTicket} />
          <Route path="/ticket/:scannerId" component={TradeTicket} />
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
          <Route path="/daily-report" component={CrossEngineDailyReport} />
          <Route path="/trading-research" component={TradingResearch} />
          <Route path="/trading-journal" component={TradingJournal} />
          <Route path="/trading-backtest" component={TradingBacktest} />
          <Route path="/options-backtest" component={OptionsBacktest} />
          <Route path="/stock-analyst/scanner" component={StockScanner} />
          <Route path="/stock-analyst/portfolio-construction" component={PortfolioConstruction} />
          <Route path="/stock-analyst" component={StockResearch} />
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
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
