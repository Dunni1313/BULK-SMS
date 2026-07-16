import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  useListTradeAdjustments,
  getListTradeAdjustmentsQueryKey,
  TradeAdjustment,
} from "@workspace/api-client-react";
import { useSession, signOut } from "@/lib/auth-client";
import { NotificationBell } from "./NotificationBell";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarProvider
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  LayoutDashboard, 
  Search, 
  LineChart, 
  PieChart, 
  List, 
  FlaskConical, 
  Trophy, 
  BookOpen, 
  MessageSquare, 
  TrendingUp, 
  Bot,
  Settings,
  GraduationCap,
  BrainCircuit,
  Library,
  CalendarClock,
  Wrench,
  Building2,
  Radar,
  Briefcase,
  Activity,
  NotebookPen,
  History,
  LayoutGrid,
  TestTube2,
  Newspaper,
  GitCompare
} from "lucide-react";

// A position "needs attention" when the deterministic engine recommends something
// other than holding/doing nothing.
function needsAttention(a: TradeAdjustment): boolean {
  return a.action !== "hold" && a.action !== "do_nothing" && a.severity !== "none";
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { toast } = useToast();
  const { data: session } = useSession();

  // Poll adjustments globally so the nav badge + live alerts work from any page.
  // Shares the query key with the Adjustments/Trades pages so it is deduped.
  const { data: adjustments } = useListTradeAdjustments({
    query: { queryKey: getListTradeAdjustmentsQueryKey(), refetchInterval: 20000 },
  });
  const attention = (adjustments ?? []).filter(needsAttention);
  const attentionCount = attention.length;

  // Live alert: toast when a NEW threatened position appears, regardless of page.
  const seenAttention = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (!adjustments) return;
    const ids = attention.map((a) => a.tradeId);
    if (seenAttention.current === null) {
      seenAttention.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seenAttention.current!.has(id));
    if (fresh.length > 0) {
      const list = attention.filter((a) => fresh.includes(a.tradeId));
      const top = list[0];
      toast({
        title:
          fresh.length === 1 ? `${top.symbol} needs attention` : `${fresh.length} positions need attention`,
        description:
          fresh.length === 1 ? `Recommended: ${top.actionLabel}` : list.map((a) => a.symbol).join(", "),
        variant: list.some((a) => a.severity === "critical") ? "destructive" : "default",
      });
    }
    seenAttention.current = new Set(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustments]);

  const navItems = [
    { title: "Dashboard", href: "/", icon: LayoutDashboard },
    { title: "Portfolio AI", href: "/portfolio-ai", icon: BrainCircuit },
    { title: "Scanner", href: "/scanner", icon: Search },
    { title: "Option Chain", href: "/options/SPY", icon: LineChart },
    { title: "Portfolio", href: "/portfolio", icon: PieChart },
    { title: "Trades", href: "/trades", icon: List },
    { title: "Backtest", href: "/backtest", icon: FlaskConical },
    { title: "Leaderboard", href: "/scoring", icon: Trophy },
    { title: "Journal", href: "/journal", icon: BookOpen },
    { title: "AI Assistant", href: "/assistant", icon: MessageSquare },
    { title: "Performance", href: "/performance", icon: TrendingUp },
    { title: "AutoPilot", href: "/autopilot", icon: Bot },
    { title: "Event Calendar", href: "/events", icon: CalendarClock },
    { title: "Adjustments", href: "/adjustments", icon: Wrench, badge: attentionCount },
    { title: "Institutional Dashboard", href: "/institutional-dashboard", icon: LayoutGrid },
    { title: "Daily Report", href: "/daily-report", icon: Newspaper },
    { title: "Trading Research", href: "/trading-research", icon: Activity },
    { title: "Trading Journal", href: "/trading-journal", icon: NotebookPen },
    { title: "Trading Backtest", href: "/trading-backtest", icon: History },
    { title: "Options Backtest", href: "/options-backtest", icon: TestTube2 },
    { title: "Value Research", href: "/stock-analyst", icon: Building2 },
    { title: "Stock Scanner", href: "/stock-analyst/scanner", icon: Radar },
    { title: "Portfolio Construction", href: "/stock-analyst/portfolio-construction", icon: Briefcase },
    { title: "Broker Reconciliation", href: "/broker-reconciliation", icon: GitCompare },
    { title: "Settings", href: "/settings", icon: Settings },
  ];

  const learnItems = [
    { title: "Delta Masterclass", href: "/learn/delta", icon: GraduationCap },
    { title: "Greeks Tutor", href: "/learn/greeks", icon: Library },
    { title: "Trading Quiz", href: "/learn/quiz", icon: BrainCircuit },
    { title: "Trade Lessons", href: "/lessons", icon: BookOpen },
    { title: "Value Investing School", href: "/stock-analyst/value-investing-school", icon: GraduationCap },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden text-foreground">
        <Sidebar className="border-r border-border bg-sidebar">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-primary font-bold tracking-wider px-4 py-4 text-sm uppercase">DK OPTION ENGINE</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={location === item.href}>
                        <Link href={item.href} className="flex items-center gap-3 px-4 py-2 text-sm font-medium">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                          {"badge" in item && item.badge ? (
                            <Badge
                              variant="outline"
                              className="ml-auto h-5 min-w-5 justify-center border-amber-500/40 bg-amber-500/15 px-1.5 text-xs text-amber-400"
                            >
                              {item.badge}
                            </Badge>
                          ) : null}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-indigo-400 font-bold tracking-wider px-4 py-4 text-xs uppercase flex items-center gap-2">
                <Bot className="w-4 h-4" /> Coach & Learn
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {learnItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={location === item.href}>
                        <Link href={item.href} className="flex items-center gap-3 px-4 py-2 text-sm font-medium hover:text-indigo-300">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Phase 1, Sprint 6 — session status. Signing in does not gate
                any other page yet (Sprint 7's job); this only demonstrates
                that a real Better-Auth session works end-to-end. */}
            <SidebarGroup className="mt-auto">
              <SidebarGroupContent>
                <div className="px-4 py-3 text-xs text-muted-foreground">
                  {session ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">Signed in as {session.user.email}</span>
                      <button
                        type="button"
                        onClick={() => void signOut()}
                        className="shrink-0 font-medium text-primary hover:underline"
                      >
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <Link href="/login" className="font-medium text-primary hover:underline">
                      Sign in
                    </Link>
                  )}
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <div className="flex items-center justify-end border-b border-border px-4 py-2">
            <NotificationBell />
          </div>
          <div className="flex-1 overflow-auto p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
