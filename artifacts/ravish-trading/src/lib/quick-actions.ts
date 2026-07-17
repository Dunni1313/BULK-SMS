// Phase 10 — Institutional Platform Polish & Control Center. A single,
// static list of shortcuts to the platform's own already-existing pages
// — every "action" here is a navigation, never a new capability, matching
// this phase's explicit "do not build major new trading functionality"
// instruction. Shared between the Command Palette's own "Quick Actions"
// group and the Institutional Home page's own Quick Actions widget, so
// the two surfaces can never silently drift out of sync.

import type { LucideIcon } from "lucide-react";
import { Search, Zap, PieChart, Landmark, BookOpen, GraduationCap, Sparkles, Download } from "lucide-react";

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
