// v1.4.0, Sprint L1 — Learning Centre Foundation.
//
// The reusable bookmark toggle every future lesson/glossary/path/strategy
// card uses. Reuses the existing learning_progress upsert infrastructure
// via POST /learning-centre/progress/bookmark (lib/learningProgress.ts's
// setBookmarked()) — no new persistence layer, no client-side-only state.
// Bookmarked state itself is read from the already-fetched
// GET /learning-centre/progress response (useGetLearningProgress), the
// same query every other progress-aware component on this page already
// shares — this component never issues its own GET.

import {
  useRecordLearningBookmark,
  useGetLearningProgress,
  getGetLearningProgressQueryKey,
  type LearningProgressActionItemType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck } from "lucide-react";

export function BookmarkButton({
  itemType,
  itemKey,
  label = true,
}: {
  itemType: LearningProgressActionItemType;
  itemKey: string;
  /** Show the "Bookmark"/"Bookmarked" text label alongside the icon. */
  label?: boolean;
}) {
  const { data: progress } = useGetLearningProgress();
  const queryClient = useQueryClient();
  const recordBookmark = useRecordLearningBookmark();

  const bookmarked = (progress?.bookmarks ?? []).some((b) => b.itemType === itemType && b.itemKey === itemKey);

  const toggle = () => {
    recordBookmark.mutate(
      { data: { itemType, itemKey, bookmarked: !bookmarked } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetLearningProgressQueryKey() }) },
    );
  };

  return (
    <Button
      type="button"
      variant={bookmarked ? "secondary" : "outline"}
      size="sm"
      className="h-7 text-xs gap-1.5"
      disabled={recordBookmark.isPending}
      onClick={toggle}
      aria-pressed={bookmarked}
      data-testid={`button-bookmark-${itemType}-${itemKey}`}
    >
      {bookmarked ? <BookmarkCheck className="w-3.5 h-3.5 text-indigo-400" /> : <Bookmark className="w-3.5 h-3.5" />}
      {label && (bookmarked ? "Bookmarked" : "Bookmark")}
    </Button>
  );
}
