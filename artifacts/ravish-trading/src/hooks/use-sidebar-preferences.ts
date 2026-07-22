// v1.1.0 — Sidebar Navigation Redesign. React state wrapper around
// lib/sidebar-preferences.ts's pure load/save functions — the single
// place components/layout/SidebarNav.tsx reads/writes group expand
// state, compact mode, and pinned "Frequently Used" routes.

import { useCallback, useEffect, useState } from "react";
import {
  loadSidebarPreferences,
  saveSidebarPreferences,
  type SidebarPreferences,
} from "@/lib/sidebar-preferences";

const MAX_PINNED = 6;

export function useSidebarPreferences() {
  const [prefs, setPrefs] = useState<SidebarPreferences>(() => loadSidebarPreferences());

  // Persist on every change. Cheap (a handful of small fields) and simpler
  // than tracking "did this change really come from the user" — matches
  // pages/ResearchTerminal.tsx's own Saved Layouts persistence style.
  useEffect(() => {
    saveSidebarPreferences(prefs);
  }, [prefs]);

  const setGroupExpanded = useCallback((groupId: string, expanded: boolean) => {
    setPrefs((prev) => ({
      ...prev,
      expandedGroups: { ...prev.expandedGroups, [groupId]: expanded },
    }));
  }, []);

  const setCompact = useCallback((compact: boolean) => {
    setPrefs((prev) => ({ ...prev, compact }));
  }, []);

  const toggleCompact = useCallback(() => {
    setPrefs((prev) => ({ ...prev, compact: !prev.compact }));
  }, []);

  const isPinned = useCallback((href: string) => prefs.pinnedHrefs.includes(href), [prefs.pinnedHrefs]);

  const togglePin = useCallback((href: string) => {
    setPrefs((prev) => {
      if (prev.pinnedHrefs.includes(href)) {
        return { ...prev, pinnedHrefs: prev.pinnedHrefs.filter((h) => h !== href) };
      }
      if (prev.pinnedHrefs.length >= MAX_PINNED) return prev;
      return { ...prev, pinnedHrefs: [...prev.pinnedHrefs, href] };
    });
  }, []);

  const movePinned = useCallback((href: string, direction: "up" | "down") => {
    setPrefs((prev) => {
      const idx = prev.pinnedHrefs.indexOf(href);
      if (idx === -1) return prev;
      const swapWith = direction === "up" ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= prev.pinnedHrefs.length) return prev;
      const next = [...prev.pinnedHrefs];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return { ...prev, pinnedHrefs: next };
    });
  }, []);

  return {
    expandedGroups: prefs.expandedGroups,
    compact: prefs.compact,
    pinnedHrefs: prefs.pinnedHrefs,
    maxPinned: MAX_PINNED,
    setGroupExpanded,
    setCompact,
    toggleCompact,
    isPinned,
    togglePin,
    movePinned,
  };
}
