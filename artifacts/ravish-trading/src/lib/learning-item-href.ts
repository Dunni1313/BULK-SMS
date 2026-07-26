// v1.4.0, Sprint L1 — Learning Centre Foundation.
//
// Resolves a Learning Progress item (lesson/glossary/path/strategy/coach)
// to a real, navigable href — shared between LearningCentre.tsx's Explore
// tab (Recently Viewed / Bookmarks) and CommandPalette.tsx's own Bookmarks
// search group, so the two surfaces never drift out of sync on how a
// bookmarked/recently-viewed item resolves to a page. A lesson's itemKey
// is a topic key, so its owning path must be searched for; every other
// item type's key already maps directly to an existing route. Returns
// null — never a fabricated link — when no real page can be resolved
// (e.g. a "coach" item, which has no dedicated detail page of its own).

import type { LearningBookmarkEntryItemType } from "@workspace/api-client-react";

// LearningHistoryEntry/LearningBookmarkEntry/LearningProgressAction all
// share the exact same string-literal itemType union (lesson/glossary/
// path/strategy/coach) — Orval generates one named type per schema, but
// they're structurally identical, so this one type covers all 3 callers.
export function resolveItemHref(
  itemType: LearningBookmarkEntryItemType,
  itemKey: string,
  paths: { key: string; topics: { key: string }[] }[] | undefined,
): string | null {
  switch (itemType) {
    case "lesson": {
      const owningPath = (paths ?? []).find((p) => p.topics.some((t) => t.key === itemKey));
      return owningPath ? `/learn/paths/${owningPath.key}/${itemKey}` : null;
    }
    case "glossary":
      return `/learn/glossary/${itemKey}`;
    case "path":
      return `/learn/paths/${itemKey}`;
    case "strategy":
      return `/learn/strategy-academy/${itemKey}`;
    case "coach":
      return null;
    default:
      return null;
  }
}
