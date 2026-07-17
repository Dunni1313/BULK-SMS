import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListTradeAdjustments,
  getListTradeAdjustmentsQueryKey,
  TradeAdjustment,
} from "@workspace/api-client-react";
import { useSession, signOut } from "@/lib/auth-client";
import { NotificationBell } from "./NotificationBell";
// Lazy-loaded, not statically imported: the Command Palette (cmdk, its own
// several generated-hook imports, lib/workflows.ts, lib/quick-actions.ts,
// lib/portfolio-export.ts) is only needed once a user actually opens it
// (⌘K/Ctrl+K or the header button) — keeping it out of AppLayout's own
// eagerly-loaded chunk, which every single page renders through, is what
// keeps the main bundle chunk under Sprint 53's own 500 kB threshold.
const CommandPalette = lazy(() =>
  import("@/components/command/CommandPalette").then((m) => ({ default: m.CommandPalette })),
);
import { NAV_ITEMS, LEARN_NAV_ITEMS } from "@/lib/nav-items";
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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Search, Bot } from "lucide-react";

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

  // Phase 10 — the nav item list itself now lives in lib/nav-items.ts, the
  // single, real navigation index the new Command Palette also reads from.
  // Only the "Adjustments" item's own live attentionCount badge is
  // computed here (AppLayout is the only place already polling
  // useListTradeAdjustments for it) and merged in at render time.
  const navItems = NAV_ITEMS;
  const learnItems = LEARN_NAV_ITEMS;

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
                          {item.href === "/adjustments" && attentionCount > 0 ? (
                            <Badge
                              variant="outline"
                              className="ml-auto h-5 min-w-5 justify-center border-amber-500/40 bg-amber-500/15 px-1.5 text-xs text-amber-400"
                            >
                              {attentionCount}
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
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
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
    </SidebarProvider>
  );
}
