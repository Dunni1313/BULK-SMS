// v1.1.0 — Sidebar Navigation Redesign. This file remains the single,
// canonical navigation index for the whole platform (Phase 10's own
// "unify, don't duplicate" goal, extended here) — the Command Palette
// (components/command/CommandPalette.tsx) and the grouped sidebar
// (components/layout/SidebarNav.tsx) both read from the exact same
// NAV_GROUPS array below; neither maintains its own copy.
//
// Every route that was reachable from the sidebar before this redesign
// remains reachable — this is a reorganization into named, collapsible
// groups, not a route removal. Three items (Backtest, Leaderboard,
// Journal — the original Options Engine's own foundational pages, distinct
// from their newer Options-Income/Trading-Engine counterparts) were never
// part of the sidebar redesign specification handed down for this release;
// per "do not remove any existing routes or functionality," they are kept,
// placed in Options Trading alongside the rest of that original flow.
//
// A small number of routes were requested in more than one group in the
// original spec (e.g. Institutional Mentor under both Institutional
// Investing and AI & Decision Tools). Per that same spec's own "prefer a
// single canonical location for each route" instruction, each such route
// appears exactly once below, in its most specific/primary group — see
// docs/v1.1.0-Sidebar-Redesign.md for the full duplicate-resolution table.

import type { LucideIcon } from "lucide-react";
import type { SidebarSectionTheme } from "@/components/layout/SidebarSectionHeader";
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
  GitCompare,
  Wallet,
  Clock,
  ChartColumn,
  ClipboardCheck,
  Scale,
  GitCompareArrows,
  Zap,
  ShieldAlert,
  ShieldCheck,
  Network,
  Gauge,
  BarChart3,
  Sparkles,
  FileBarChart,
  BookMarked,
  Landmark,
  Home,
  Bell,
  Server,
  Gavel,
  Telescope,
  BellRing,
  LayoutPanelLeft,
  Users,
  Terminal,
  FileBarChart2,
  LayoutTemplate,
  LayoutList,
  ListTree,
  Droplets,
  ClipboardList,
  Layers,
  Boxes,
  Grid3x3,
  Waves,
  GitBranch,
  AlertTriangle,
  ListChecks,
  Eye,
  Workflow,
  Command,
  MessageCircle,
} from "lucide-react";

export interface NavigationItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Optional extra search terms for a future keyword-aware search; not
   * yet consumed by CommandPalette (which already fuzzy-matches on
   * `title`), kept for forward compatibility with the requested data shape. */
  keywords?: string[];
}

export interface NavigationGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Whether this group starts expanded for a user with no saved
   * preference yet. Ignored once the user has an explicit saved state
   * for this group (see lib/sidebar-preferences.ts). */
  defaultExpanded?: boolean;
  /** v1.3.1 — Sidebar Section Headers. Which coloured header-bar theme
   * SidebarNav.tsx's SidebarSectionHeader renders this group with. The 4
   * named engine themes (options/portfolio/investing/trading) are used by
   * their own primary group plus that engine's closest sibling group;
   * every other group (including "Frequently Used") uses the neutral
   * premium theme — see docs/v1.3.1-Sidebar-Section-Headers.md for the
   * full, disclosed rationale. */
  theme: SidebarSectionTheme;
  items: NavigationItem[];
}

export const NAV_GROUPS: NavigationGroup[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    defaultExpanded: true,
    theme: "neutral",
    items: [
      { title: "Institutional Home", href: "/", icon: Home },
      { title: "Command Center", href: "/command-center", icon: LayoutDashboard },
      { title: "Notifications", href: "/notifications", icon: Bell },
      { title: "Operations Dashboard", href: "/operations", icon: Server },
    ],
  },
  {
    id: "options-trading",
    label: "Options Trading",
    icon: BarChart3,
    defaultExpanded: true,
    theme: "options",
    items: [
      { title: "Options Dashboard", href: "/options-dashboard", icon: BarChart3 },
      { title: "Scanner", href: "/scanner", icon: Search },
      // v1.2.0 — Trade Execution Center. Placed here (Options Trading), not
      // in the "Trading Workbench" group (Engine 2's own technical-analysis
      // group), since this page's entire workflow composes THIS group's own
      // Scanner/Order Preview/Position Sizing/Adjustments/Trades routes —
      // see docs/v1.2.0-Trade-Execution-Center.md for the disclosed reasoning.
      { title: "Trade Execution Center", href: "/trade-execution-center", icon: ListChecks },
      { title: "Option Chain", href: "/options/SPY", icon: LineChart },
      { title: "Portfolio", href: "/portfolio", icon: PieChart },
      { title: "Trades", href: "/trades", icon: List },
      { title: "Order Preview", href: "/order-preview", icon: ClipboardCheck },
      { title: "Position Sizing", href: "/position-sizing", icon: Scale },
      { title: "Adjustments", href: "/adjustments", icon: Wrench },
      { title: "Adjustment Preview", href: "/adjustment-preview", icon: GitCompareArrows },
      { title: "Options Backtest", href: "/options-backtest", icon: TestTube2 },
      { title: "Event Calendar", href: "/events", icon: CalendarClock },
      // Original Options Engine pages, not named in the redesign spec —
      // preserved here so no existing route/functionality is lost.
      { title: "Backtest", href: "/backtest", icon: FlaskConical },
      { title: "Leaderboard", href: "/scoring", icon: Trophy },
      { title: "Journal", href: "/journal", icon: BookOpen },
    ],
  },
  {
    id: "options-income-engine",
    label: "Options Income Engine",
    icon: Waves,
    theme: "options",
    items: [
      { title: "Options Income Workspace", href: "/options-income-workspace", icon: Waves },
      { title: "Position Lifecycle Manager", href: "/options-lifecycle-manager", icon: GitBranch },
      { title: "Risk & Exposure Engine", href: "/risk-exposure-engine", icon: ShieldAlert },
      { title: "Scenario & Stress Testing Engine", href: "/scenario-engine", icon: AlertTriangle },
      { title: "Performance & Attribution Engine", href: "/performance-attribution-engine", icon: LineChart },
      { title: "Decision Support Engine", href: "/decision-support-engine", icon: Gauge },
      { title: "Rebalancing Engine", href: "/rebalancing-engine", icon: Scale },
      { title: "Monitoring & Compliance Engine", href: "/monitoring-compliance-engine", icon: ShieldCheck },
      { title: "Watchlists & Opportunity Dashboard", href: "/watchlists-engine", icon: Eye },
      { title: "Broker Reconciliation", href: "/broker-reconciliation", icon: GitCompare },
    ],
  },
  {
    id: "portfolio-management",
    label: "Portfolio Management",
    icon: PieChart,
    theme: "portfolio",
    items: [
      { title: "Portfolio AI", href: "/portfolio-ai", icon: BrainCircuit },
      { title: "Portfolio Dashboard", href: "/portfolio-dashboard", icon: Gauge },
      { title: "Institutional Portfolio Workspace", href: "/portfolio-workspace", icon: Workflow },
      { title: "Institutional Workspace", href: "/workspace", icon: LayoutPanelLeft },
      { title: "AI Portfolio Analyst", href: "/portfolio-analyst", icon: FileBarChart },
      { title: "Stress Test", href: "/stress-test", icon: Zap },
      { title: "Event Risk", href: "/event-risk", icon: ShieldAlert },
      { title: "Concentration Risk", href: "/concentration-risk", icon: Network },
      { title: "Performance", href: "/performance", icon: TrendingUp },
      { title: "Trade History", href: "/trade-history", icon: Clock },
      { title: "Trade Performance", href: "/trade-performance", icon: ChartColumn },
      { title: "Paper Portfolio", href: "/paper-portfolio", icon: Wallet },
    ],
  },
  {
    id: "institutional-investing",
    label: "Institutional Investing",
    icon: Building2,
    theme: "investing",
    items: [
      { title: "Institutional Dashboard", href: "/institutional-dashboard", icon: LayoutGrid },
      { title: "Executive Intelligence", href: "/executive-intelligence", icon: Command },
      { title: "Institutional Intelligence", href: "/institutional-intelligence", icon: Sparkles },
      { title: "Institutional Mentor", href: "/institutional-mentor", icon: Landmark },
      { title: "Decision Engine", href: "/decision-engine", icon: Gavel },
      { title: "Investment Committee", href: "/stock-analyst/investment-committee", icon: Users },
      { title: "Opportunity Discovery", href: "/opportunity-discovery", icon: Telescope },
      { title: "Institutional Monitoring", href: "/monitoring-dashboard", icon: BellRing },
      { title: "Daily Report", href: "/daily-report", icon: Newspaper },
      { title: "Research Terminal", href: "/research-terminal", icon: Terminal },
      { title: "Institutional Reporting Centre", href: "/reporting-centre", icon: FileBarChart2 },
      { title: "Institutional AI Coach", href: "/institutional-ai-coach", icon: GraduationCap },
    ],
  },
  {
    id: "value-investing",
    label: "Value Investing",
    icon: Landmark,
    theme: "investing",
    items: [
      { title: "Investing Executive Dashboard", href: "/stock-analyst/executive-dashboard", icon: LayoutList },
      { title: "Value Research", href: "/stock-analyst", icon: Building2 },
      { title: "Stock Scanner", href: "/stock-analyst/scanner", icon: Radar },
      { title: "Portfolio Construction", href: "/stock-analyst/portfolio-construction", icon: Briefcase },
      { title: "Portfolio Optimisation", href: "/stock-analyst/portfolio-optimisation", icon: Scale },
    ],
  },
  {
    id: "trading-workbench",
    label: "Trading Workbench",
    icon: Activity,
    theme: "trading",
    items: [
      { title: "Trading Research", href: "/trading-research", icon: Activity },
      { title: "Trading Journal", href: "/trading-journal", icon: NotebookPen },
      { title: "Trading Backtest", href: "/trading-backtest", icon: History },
      { title: "Trade Workspace", href: "/trade-workspace", icon: LayoutTemplate },
      { title: "Market Structure Workbench", href: "/market-structure-workbench", icon: ListTree },
      { title: "Liquidity & Session Workbench", href: "/liquidity-workbench", icon: Droplets },
      { title: "Trade Planning & Risk Studio", href: "/trade-planning-studio", icon: ClipboardList },
      { title: "Strategy Framework", href: "/strategy-framework", icon: Layers },
      { title: "Strategy Workbench", href: "/strategy-workbench", icon: Boxes },
      { title: "Trading Analytics", href: "/trading-analytics", icon: BarChart3 },
      { title: "Trading AI Coach", href: "/trading-ai-coach", icon: GraduationCap },
    ],
  },
  {
    id: "ai-decision-tools",
    label: "AI & Decision Tools",
    icon: BrainCircuit,
    theme: "neutral",
    items: [
      { title: "AI Assistant", href: "/assistant", icon: MessageSquare },
      { title: "AI Trading Coach", href: "/ai-trading-coach", icon: MessageCircle },
      { title: "AI Trade Journal", href: "/trade-journal-ai", icon: BookMarked },
      { title: "Cross-Engine Workspace", href: "/cross-engine-workspace", icon: Grid3x3 },
    ],
  },
  {
    id: "learning-centre",
    label: "Learning Centre",
    icon: GraduationCap,
    theme: "neutral",
    items: [
      { title: "AI Teacher & Learning Centre", href: "/learn", icon: Sparkles },
      { title: "Learning Paths", href: "/learn/paths", icon: BookOpen },
      { title: "Strategy Academy", href: "/learn/strategy-academy", icon: GraduationCap },
      { title: "Glossary", href: "/learn/glossary", icon: Library },
      { title: "Delta Masterclass", href: "/learn/delta", icon: GraduationCap },
      { title: "Greeks Tutor", href: "/learn/greeks", icon: Library },
      { title: "Trading Quiz", href: "/learn/quiz", icon: BrainCircuit },
      { title: "Trade Lessons", href: "/lessons", icon: BookOpen },
      { title: "Value Investing School", href: "/stock-analyst/value-investing-school", icon: GraduationCap },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: Settings,
    theme: "neutral",
    items: [
      { title: "AutoPilot", href: "/autopilot", icon: Bot },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

/** Flattened view of every navigation item across every group, in group
 * order — the single source CommandPalette's global search reads from, so
 * a route is always searchable regardless of whether its group is
 * currently collapsed in the sidebar. */
export const ALL_NAV_ITEMS: NavigationItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Suggested initial "Frequently Used" pins for a user with no saved
 * preference yet — see lib/sidebar-preferences.ts. */
export const DEFAULT_PINNED_HREFS: string[] = [
  "/command-center",
  "/options-dashboard",
  "/scanner",
  "/portfolio-dashboard",
  "/assistant",
  "/settings",
];

/** Look up a nav item by href — used by the Frequently Used pinned list to
 * resolve a saved href back to its title/icon. */
export function findNavItem(href: string): NavigationItem | undefined {
  return ALL_NAV_ITEMS.find((item) => item.href === href);
}

/** Which group (if any) owns a given href — used to auto-expand the
 * correct parent section for whatever page is currently active. */
export function findGroupIdForHref(href: string): string | undefined {
  return NAV_GROUPS.find((g) => g.items.some((item) => item.href === href))?.id;
}
