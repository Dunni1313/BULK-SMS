import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";
import { useEffect } from "react";

// Pages
import Dashboard from "./pages/Dashboard";
import Scanner from "./pages/Scanner";
import OptionChain from "./pages/OptionChain";
import Portfolio from "./pages/Portfolio";
import PortfolioAI from "./pages/PortfolioAI";
import Trades from "./pages/Trades";
import TradeTicket from "./pages/TradeTicket";
import Backtest from "./pages/Backtest";
import Scoring from "./pages/Scoring";
import Journal from "./pages/Journal";
import Assistant from "./pages/Assistant";
import Performance from "./pages/Performance";
import AutoPilot from "./pages/AutoPilot";
import Events from "./pages/Events";
import Adjustments from "./pages/Adjustments";
import StockResearch from "./pages/StockResearch";
import StockScanner from "./pages/StockScanner";
import PortfolioConstruction from "./pages/PortfolioConstruction";
import ValueInvestingSchool from "./pages/ValueInvestingSchool";
import Settings from "./pages/Settings";
import Login from "./pages/Login";

// Learn
import DeltaMasterclass from "./pages/learn/DeltaMasterclass";
import GreeksTutor from "./pages/learn/GreeksTutor";
import TradeLessons from "./pages/learn/TradeLessons";
import Quiz from "./pages/learn/Quiz";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={Dashboard} />
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
        <Route path="/stock-analyst/scanner" component={StockScanner} />
        <Route path="/stock-analyst/portfolio-construction" component={PortfolioConstruction} />
        <Route path="/stock-analyst" component={StockResearch} />
        <Route path="/settings" component={Settings} />
        <Route path="/learn/delta" component={DeltaMasterclass} />
        <Route path="/learn/greeks" component={GreeksTutor} />
        <Route path="/lessons" component={TradeLessons} />
        <Route path="/learn/quiz" component={Quiz} />
        <Route path="/stock-analyst/value-investing-school" component={ValueInvestingSchool} />
        <Route component={NotFound} />
      </Switch>
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
