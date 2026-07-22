// v1.1.0 — Sidebar Navigation Redesign. Client-side persistence for the
// sidebar's own UI state: which groups are explicitly expanded/collapsed,
// whether compact (icon-only) mode is on, and the user's pinned
// "Frequently Used" routes (in their own chosen order).
//
// This platform has no per-user server-side preference store for UI
// layout state (Settings persists trading/automation configuration, not
// sidebar chrome) — per the redesign spec's own fallback instruction
// ("If no user-preference system exists, use local storage safely"),
// this uses a single localStorage key, matching the exact suggested name.
// Reads/writes are wrapped defensively (private browsing, storage quota,
// or a non-browser test environment must never throw) — the same
// established "localStorage unavailable — simply degrade" discipline
// already used by pages/ResearchTerminal.tsx's own Saved Layouts feature.

import { DEFAULT_PINNED_HREFS } from "./nav-items";

export const SIDEBAR_STORAGE_KEY = "dk-sidebar-navigation-state";

/** Above this width, a first-time visitor gets the full sidebar by
 * default; between this and the mobile breakpoint (768px, see
 * hooks/use-mobile.tsx), a first-time visitor defaults to compact mode —
 * "a narrower sidebar" for tablet-sized viewports, per the redesign spec.
 * Only applies before any preference has ever been saved; a returning
 * user's own explicit choice always wins. */
const TABLET_MAX_WIDTH = 1024;
const MOBILE_MAX_WIDTH = 768;

export interface SidebarPreferences {
  /** Only groups the user has explicitly toggled are present here — a
   * group missing from this map falls back to its own `defaultExpanded`. */
  expandedGroups: Record<string, boolean>;
  compact: boolean;
  pinnedHrefs: string[];
}

function defaultCompactForViewport(): boolean {
  if (typeof window === "undefined") return false;
  const width = window.innerWidth;
  return width >= MOBILE_MAX_WIDTH && width < TABLET_MAX_WIDTH;
}

export function defaultSidebarPreferences(): SidebarPreferences {
  return {
    expandedGroups: {},
    compact: defaultCompactForViewport(),
    pinnedHrefs: [...DEFAULT_PINNED_HREFS],
  };
}

function isValidPreferences(value: unknown): value is SidebarPreferences {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.expandedGroups === "object" &&
    v.expandedGroups !== null &&
    typeof v.compact === "boolean" &&
    Array.isArray(v.pinnedHrefs)
  );
}

export function loadSidebarPreferences(): SidebarPreferences {
  if (typeof window === "undefined") return defaultSidebarPreferences();
  try {
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (!raw) return defaultSidebarPreferences();
    const parsed: unknown = JSON.parse(raw);
    if (!isValidPreferences(parsed)) return defaultSidebarPreferences();
    return parsed;
  } catch {
    // localStorage unavailable (private browsing, quota) or corrupt JSON —
    // fall back to a sensible in-memory default rather than throwing.
    return defaultSidebarPreferences();
  }
}

export function saveSidebarPreferences(prefs: SidebarPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable — the preference simply doesn't persist this
    // session; the sidebar itself keeps working from in-memory state.
  }
}
