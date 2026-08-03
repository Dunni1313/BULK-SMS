import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  useListTradeAdjustments,
  getListTradeAdjustmentsQueryKey,
  TradeAdjustment,
} from "@workspace/api-client-react";
import { useSession, signOut } from "@/lib/auth-client";
import { NotificationBell } from "./NotificationBell";
import { SidebarNav } from "./SidebarNav";
// Lazy-loaded, not statically imported: the Command Palette (cmdk, its own
// several generated-hook imports, lib/workflows.ts, lib/quick-actions.ts,
// lib/portfolio-export.ts) is only needed once a user actually opens it
// (⌘K/Ctrl+K or the header button) — keeping it out of AppLayout's own
// eagerly-loaded chunk, which every single page renders through, is what
// keeps the main bundle chunk under Sprint 53's own 500 kB threshold.
const CommandPalette = lazy(() =>
  import("@/components/command/CommandPalette").then((m) => ({ default: m.CommandPalette })),
);
// v1.3.1 — AI Trading Assistant (renamed from "AI Trading Coach" in
// v1.5.0 Sprint 1, label only). Same "keep a modal-triggered surface out of
// the eagerly-loaded main bundle" reasoning as CommandPalette above — the
// panel (react-markdown, the full Workspace component tree) is only ever
// needed once a user actually opens it.
const TradingCoachPanel = lazy(() =>
  import("@/components/coach/TradingCoachPanel").then((m) => ({ default: m.TradingCoachPanel })),
);
import { TradingCoachLauncher } from "@/components/coach/TradingCoachLauncher";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSidebarPreferences } from "@/hooks/use-sidebar-preferences";
import { Search } from "lucide-react";

// A position "needs attention" when the deterministic engine recommends something
// other than holding/doing nothing.
function needsAttention(a: TradeAdjustment): boolean {
  return a.action !== "hold" && a.action !== "do_nothing" && a.severity !== "none";
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const { data: session, isPending: sessionPending } = useSession();
  // Owned once, here, and passed down to SidebarNav — see that file's own
  // header comment on why two independent useSidebarPreferences() calls
  // would desync (the compact toggle button lives in this header, outside
  // SidebarNav itself, so both need the same live state).
  const preferences = useSidebarPreferences();
  const { compact, setCompact } = preferences;

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

  // Phase 10 — the nav item list itself lives in lib/nav-items.ts (now
  // NAV_GROUPS, since the v1.1.0 sidebar redesign), the single, real
  // navigation index the Command Palette also reads from. Only the
  // "Adjustments" item's own live attentionCount badge is computed here
  // (AppLayout is the only place already polling useListTradeAdjustments
  // for it) and passed down to SidebarNav to merge in at render time.

  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <SidebarProvider open={!compact} onOpenChange={(open) => setCompact(!open)}>
      <div className="flex min-h-screen w-full bg-background overflow-hidden text-foreground">
        <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
          <SidebarHeader className="flex flex-row items-center gap-2 border-b border-sidebar-border px-4 py-3">
            <span className="text-primary min-w-0 truncate text-sm font-bold tracking-wider uppercase group-data-[collapsible=icon]:hidden">
              DK OPTION ENGINE
            </span>
          </SidebarHeader>
          <SidebarNav attentionCount={attentionCount} preferences={preferences} />
          {/* Phase 1, Sprint 6 — session status. Signing in does not gate
              any other page yet (Sprint 7's job); this only demonstrates
              that a real Better-Auth session works end-to-end.
              v1.6.0 UX Polish Phase 1 — fixed a real, trust-eroding bug:
              this footer used to render "Sign in" for ANY falsy `session`,
              including the brief, ordinary moment before useSession()'s
              own fetch resolves. On pages that fire a large burst of
              concurrent requests on mount (e.g. Trading Research), that
              momentary pending state could be visibly prolonged, making an
              authenticated user's sidebar read "Sign in" even though their
              own personalized data was already rendering on the page.
              Checking isPending explicitly and rendering a neutral
              skeleton while it's true (never "Sign in") fixes this for
              every page, since AppLayout mounts once for the whole app. */}
          <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
            <div className="px-2 py-1 text-xs text-muted-foreground">
              {sessionPending ? (
                <div className="h-4 w-32 animate-pulse rounded bg-muted/60" data-testid="skeleton-session-status" />
              ) : session ? (
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
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              {/* Lives here, not inside <Sidebar>, deliberately: on mobile
                  the whole Sidebar subtree only renders once its own Sheet
                  is open (components/ui/sidebar.tsx's own isMobile branch)
                  — a trigger placed inside it could never be clicked to
                  open the drawer in the first place. This same trigger
                  also toggles full/compact mode on desktop. */}
              <SidebarTrigger data-testid="button-toggle-compact-sidebar" aria-label="Toggle sidebar" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-2 text-xs text-muted-foreground"
                onClick={() => setPaletteOpen(true)}
                data-testid="button-open-command-palette"
              >
                <Search className="h-3.5 w-3.5" />
                Search or jump to…
                <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                  {typeof navigator !== "undefined" && /Mac/i.test(navigator.platform ?? "") ? "⌘K" : "Ctrl+K"}
                </kbd>
              </Button>
            </div>
            <TradingCoachLauncher />
            <NotificationBell />
          </div>
          <div className="flex-1 overflow-auto p-6">
            {children}
          </div>
        </main>
      </div>
      <Suspense fallback={null}>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </Suspense>
      <Suspense fallback={null}>
        <TradingCoachPanel />
      </Suspense>
    </SidebarProvider>
  );
}
