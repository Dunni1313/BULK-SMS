// v1.1.0 — Sidebar Navigation Redesign. The sidebar's own content: a
// "Frequently Used" pinned strip, followed by every NAV_GROUPS group
// rendered as its own collapsible section. Extracted out of AppLayout.tsx
// (which still owns the header, session footer, and Command Palette
// wiring) purely to keep that file from becoming a monolith — this
// component owns nothing AppLayout didn't already own before the redesign.
//
// Reuses the existing design system throughout: components/ui/sidebar.tsx
// (Sidebar*, already shadcn-shaped), the new components/ui/collapsible.tsx
// (a thin wrapper over the already-installed @radix-ui/react-collapsible),
// and lucide-react icons already used elsewhere in this app. No new
// dependency was added.

import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Star, Pin, PinOff, ArrowUp, ArrowDown } from "lucide-react";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarSectionHeader } from "@/components/layout/SidebarSectionHeader";
import { NAV_GROUPS, findNavItem, findGroupIdForHref, type NavigationItem } from "@/lib/nav-items";
import type { useSidebarPreferences } from "@/hooks/use-sidebar-preferences";

// Preferences are owned once, by AppLayout (the compact toggle button
// lives in its header, outside this component) — passed down here rather
// than each calling its own useSidebarPreferences(), which would give the
// two components independent, easily-desynced copies of the same state.
type SidebarPreferences = ReturnType<typeof useSidebarPreferences>;

export interface SidebarNavProps {
  /** Number of open positions the deterministic engine flags as needing
   * attention — preserved verbatim from the pre-redesign sidebar, which
   * showed this as a badge on the Adjustments link only. */
  attentionCount: number;
  preferences: SidebarPreferences;
}

export function SidebarNav({ attentionCount, preferences }: SidebarNavProps) {
  const [location] = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const { expandedGroups, compact, pinnedHrefs, isPinned, togglePin, movePinned, setGroupExpanded } = preferences;

  // Which group (if any) owns the page currently being viewed — its
  // section is force-expanded below regardless of the user's own saved
  // collapse preference for it, satisfying "automatically expand its
  // parent section" without discarding that preference once the user
  // navigates elsewhere.
  const activeGroupId = useMemo(() => findGroupIdForHref(location), [location]);

  const pinnedItems = useMemo(
    () => pinnedHrefs.map((href) => findNavItem(href)).filter((item): item is NavigationItem => Boolean(item)),
    [pinnedHrefs],
  );

  // "Keep the active link visible" — once its parent section has expanded
  // (the effect below runs after that render), scroll the active item
  // into view if it isn't already, e.g. deep in a long expanded group.
  useEffect(() => {
    const el = document.querySelector('[data-sidebar="content"] [data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [location]);

  function handleNavigate() {
    // Mobile: close the drawer after a route is selected — the sidebar
    // itself renders as a Sheet on mobile (components/ui/sidebar.tsx's
    // own isMobile branch), which otherwise stays open across navigation.
    if (isMobile) setOpenMobile(false);
  }

  function renderItem(item: NavigationItem) {
    const active = location === item.href;
    const pinned = isPinned(item.href);
    const hasAttentionBadge = item.href === "/adjustments" && attentionCount > 0;
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton asChild isActive={active} tooltip={compact ? item.title : undefined}>
          <Link
            href={item.href}
            onClick={handleNavigate}
            className="flex items-center gap-3 px-4 py-2 text-sm font-medium"
            data-testid={`sidebar-link-${item.href}`}
            data-active={active || undefined}
            aria-current={active ? "page" : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.title}</span>
          </Link>
        </SidebarMenuButton>
        {hasAttentionBadge ? (
          <SidebarMenuBadge className="border border-amber-500/40 bg-amber-500/15 text-amber-400">
            {attentionCount}
          </SidebarMenuBadge>
        ) : null}
        <SidebarMenuAction
          showOnHover
          aria-label={pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
          data-testid={`sidebar-pin-toggle-${item.href}`}
          className={hasAttentionBadge ? "right-6" : undefined}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePin(item.href);
          }}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </SidebarMenuAction>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarContent role="navigation" aria-label="Main navigation">
      {pinnedItems.length > 0 && (
        <SidebarGroup>
          <SidebarSectionHeader
            label="Frequently Used"
            icon={Star}
            theme="neutral"
            interactive={false}
            data-testid="sidebar-group-header-pinned"
          />
          <SidebarGroupContent>
            <SidebarMenu>
              {pinnedItems.map((item, idx) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={location === item.href} tooltip={compact ? item.title : undefined}>
                    <Link
                      href={item.href}
                      onClick={handleNavigate}
                      className="flex items-center gap-3 px-4 py-2 text-sm font-medium"
                      data-testid={`sidebar-pinned-link-${item.href}`}
                      aria-current={location === item.href ? "page" : undefined}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  <div className="absolute top-1.5 right-1 hidden items-center gap-0.5 group-focus-within/menu-item:flex group-hover/menu-item:flex group-data-[collapsible=icon]:hidden">
                    <button
                      type="button"
                      className="text-sidebar-foreground/60 hover:text-sidebar-foreground flex h-5 w-5 items-center justify-center rounded disabled:pointer-events-none disabled:opacity-30"
                      aria-label={`Move ${item.title} up in Frequently Used`}
                      data-testid={`sidebar-pin-move-up-${item.href}`}
                      disabled={idx === 0}
                      onClick={() => movePinned(item.href, "up")}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="text-sidebar-foreground/60 hover:text-sidebar-foreground flex h-5 w-5 items-center justify-center rounded disabled:pointer-events-none disabled:opacity-30"
                      aria-label={`Move ${item.title} down in Frequently Used`}
                      data-testid={`sidebar-pin-move-down-${item.href}`}
                      disabled={idx === pinnedItems.length - 1}
                      onClick={() => movePinned(item.href, "down")}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="text-sidebar-foreground/60 hover:text-sidebar-foreground flex h-5 w-5 items-center justify-center rounded"
                      aria-label={`Unpin ${item.title}`}
                      data-testid={`sidebar-pin-remove-${item.href}`}
                      onClick={() => togglePin(item.href)}
                    >
                      <PinOff className="h-3 w-3" />
                    </button>
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {NAV_GROUPS.map((group) => {
        // Compact (icon-only) mode intentionally skips per-group collapse
        // chrome entirely — with labels already hidden by the sidebar
        // primitive's own icon-mode CSS, a header with no visible text
        // would be meaningless, so every group's items simply render as
        // one continuous icon stack while compact.
        if (compact) {
          return (
            <SidebarGroup key={group.id}>
              <SidebarGroupContent>
                <SidebarMenu>{group.items.map(renderItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        }

        const containsActive = activeGroupId === group.id;
        const explicitlySet = group.id in expandedGroups;
        const persistedOpen = explicitlySet ? expandedGroups[group.id] : (group.defaultExpanded ?? false);
        const open = containsActive || persistedOpen;

        return (
          <Collapsible key={group.id} open={open} onOpenChange={(next) => setGroupExpanded(group.id, next)}>
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarSectionHeader
                  label={group.label}
                  icon={group.icon}
                  theme={group.theme}
                  open={open}
                  data-testid={`sidebar-group-trigger-${group.id}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>{group.items.map(renderItem)}</SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        );
      })}
    </SidebarContent>
  );
}
