// Phase 10 — Institutional Platform Polish & Control Center. A single,
// static list of shortcuts to the platform's own already-existing pages
// — every "action" here is a navigation, never a new capability, matching
// this phase's explicit "do not build major new trading functionality"
// instruction. Shared between the Command Palette's own "Quick Actions"
// group and the Institutional Home page's own Quick Actions widget, so
// the two surfaces can never silently drift out of sync.

import type { LucideIcon } from "lucide-react";
import {
  Search,
  Zap,
  PieChart,
  Landmark,
  BookOpen,
  GraduationCap,
  Sparkles,
  Download,
  Terminal,
  Briefcase,
  ClipboardList,
  Layers,
  BarChart3,
  FileBarChart2,
  Command,
  Waves,
  GitBranch,
} from "lucide-react";

export interface QuickAction {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  // "export" actions are handled specially (a client-side download, not a
  // navigation) — see components/command/CommandPalette.tsx and
  // pages/Home.tsx's own handling of this field.
  kind: "navigate" | "export";
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "open-scanner", label: "Open Scanner", href: "/scanner", icon: Search, kind: "navigate" },
  { id: "run-stress-test", label: "Run Stress Test", href: "/stress-test", icon: Zap, kind: "navigate" },
  { id: "review-portfolio", label: "Review Portfolio", href: "/portfolio-dashboard", icon: PieChart, kind: "navigate" },
  { id: "open-ai-mentor", label: "Open AI Mentor", href: "/institutional-mentor", icon: Landmark, kind: "navigate" },
  { id: "review-journal", label: "Review Journal", href: "/journal", icon: BookOpen, kind: "navigate" },
  { id: "learning-centre", label: "Learning Centre", href: "/learn", icon: GraduationCap, kind: "navigate" },
  { id: "strategy-academy", label: "Strategy Academy", href: "/learn/strategy-academy", icon: Sparkles, kind: "navigate" },
  { id: "export-portfolio", label: "Export Portfolio (CSV)", href: "", icon: Download, kind: "export" },
];

// Phase 34 — Cross-Engine Orchestration & Unified Workspace. A second,
// additive static list — every "action" here is still a pure navigation,
// never a new capability — matching this phase's own "reuse existing
// actions... do not create new business logic" instruction. Distinct from
// QUICK_ACTIONS above (which is Options Income Engine-focused, Phase 10)
// since these are the literal examples the Phase 34 brief itself named:
// Open Research, Open Portfolio, Open Trade Plan, Open Strategy, Open
// Analytics, Open Report, Open Learning, Open Executive Dashboard.
export const CROSS_ENGINE_QUICK_ACTIONS: QuickAction[] = [
  { id: "open-research", label: "Open Research", href: "/research-terminal", icon: Terminal, kind: "navigate" },
  { id: "open-portfolio", label: "Open Portfolio", href: "/stock-analyst/portfolio-construction", icon: Briefcase, kind: "navigate" },
  { id: "open-trade-plan", label: "Open Trade Plan", href: "/trade-planning-studio", icon: ClipboardList, kind: "navigate" },
  { id: "open-strategy", label: "Open Strategy", href: "/strategy-framework", icon: Layers, kind: "navigate" },
  { id: "open-analytics", label: "Open Analytics", href: "/trading-analytics", icon: BarChart3, kind: "navigate" },
  { id: "open-report", label: "Open Report", href: "/reporting-centre", icon: FileBarChart2, kind: "navigate" },
  { id: "open-learning", label: "Open Learning", href: "/learn", icon: GraduationCap, kind: "navigate" },
  { id: "open-executive-dashboard", label: "Open Executive Dashboard", href: "/stock-analyst/executive-dashboard", icon: PieChart, kind: "navigate" },
  { id: "open-executive-intelligence", label: "Open Executive Intelligence", href: "/executive-intelligence", icon: Command, kind: "navigate" },
  { id: "open-options-income-workspace", label: "Open Options Income Workspace", href: "/options-income-workspace", icon: Waves, kind: "navigate" },
  { id: "open-options-lifecycle-manager", label: "Open Position Lifecycle Manager", href: "/options-lifecycle-manager", icon: GitBranch, kind: "navigate" },
];
