// v1.5.0, Sprint 11 — Platform Integration.
//
// The one shared "Learn" surface every major module embeds, per the
// approved scope's explicit instruction: "reuse the existing Learning
// Centre, learning paths, glossary, quizzes and coaching infrastructure
// [...] expose that content contextually from within each module" and
// "do NOT build another Learning Centre." This component introduces zero
// new content, zero new rendering logic, and zero new backend endpoints —
// it is a thin Sheet wrapper around exactly the same fetch-a-path/find-a-
// topic/render-via-LessonRenderer/track-progress pipeline
// pages/learn/LearningPaths.tsx's own PathDetail already implements, so a
// lesson already reviewed for accuracy on the full Learning Centre page
// looks and behaves identically here — the only thing genuinely new is
// *where* it can be opened from (in-page, without navigating away).
//
// LessonRenderer itself already composes the "Coach" surface (via
// AskCoachLauncher, when a topic has aiCoachPrompts) and the "Glossary"
// surface (via RelatedGlossaryBadges) — this drawer does not reimplement
// either. A related-glossary badge still navigates to /learn/glossary/:key
// (that link's own pre-existing behavior, unchanged); everything else in
// the drawer is viewable without leaving the calling page.
import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetLearningPathByKey,
  useGetLearningProgress,
  useRecordLearningItemViewed,
  useRecordLearningItemCompleted,
  getGetLearningPathByKeyQueryKey,
  getGetLearningProgressQueryKey,
} from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Clock, BookOpen, ArrowLeft } from "lucide-react";
import { LessonRenderer, hasRichLessonContent } from "./LessonRenderer";
import { RelatedGlossaryBadges } from "./RelatedGlossaryBadges";

export function ModuleLearnDrawer({
  open,
  onOpenChange,
  moduleLabel,
  pathKey,
  topicKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The calling module's own display name, e.g. "Institutional Trade
   * Planner" — shown in the drawer header so the user always knows what
   * they're looking at, per the "immediately understand what this module
   * is" design principle. */
  moduleLabel: string;
  pathKey: string;
  /** When omitted, the drawer shows the whole path's topic list (matching
   * pages/learn/LearningPaths.tsx's own PathsList->PathDetail behavior
   * with no topicKey) rather than one pre-opened lesson. */
  topicKey?: string;
}) {
  const { data: path, isLoading, isError } = useGetLearningPathByKey(pathKey, {
    query: { enabled: open, queryKey: getGetLearningPathByKeyQueryKey(pathKey) },
  });
  const { data: progress } = useGetLearningProgress({ query: { enabled: open, queryKey: getGetLearningProgressQueryKey() } });
  const recordViewed = useRecordLearningItemViewed();
  const recordCompleted = useRecordLearningItemCompleted();
  const queryClient = useQueryClient();
  const [openTopic, setOpenTopic] = useState<string | null>(topicKey ?? null);

  const completedKeys = new Set(progress?.completedLessonKeys ?? []);

  const markViewed = (key: string) => {
    recordViewed.mutate({ data: { itemType: "lesson", itemKey: key } });
  };
  const markComplete = (key: string) => {
    recordCompleted.mutate(
      { data: { itemType: "lesson", itemKey: key } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetLearningProgressQueryKey() }) },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md md:max-w-xl overflow-y-auto bg-card border-l-border" data-testid="sheet-module-learn">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" /> Learn: {moduleLabel}
          </SheetTitle>
          <SheetDescription>
            Reused directly from the platform's own Learning Centre — the same lesson, in place, without leaving this page.
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="space-y-3" data-testid="text-module-learn-loading">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!isLoading && (isError || !path) && (
          <p className="text-sm text-destructive" data-testid="text-module-learn-not-found">
            This lesson isn't available right now.
          </p>
        )}

        {path && (
          <div className="space-y-4">
            {openTopic && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setOpenTopic(null)}
                data-testid="button-module-learn-back-to-topics"
              >
                <ArrowLeft className="w-3 h-3" /> All {path.title} lessons
              </button>
            )}

            {!openTopic && (
              <div className="space-y-3" data-testid="list-module-learn-topics">
                <p className="text-xs text-muted-foreground">{path.description}</p>
                {path.topics.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className="w-full text-left rounded-md border border-border p-3 hover:border-indigo-500/40 transition-colors"
                    onClick={() => {
                      setOpenTopic(t.key);
                      markViewed(t.key);
                    }}
                    data-testid={`button-module-learn-topic-${t.key}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground flex-1">{t.title}</span>
                      {completedKeys.has(t.key) && (
                        <Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Done</Badge>
                      )}
                      <Badge variant="outline" className="text-[9px] flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> {t.estimatedMinutes} min
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{t.summary}</p>
                  </button>
                ))}
              </div>
            )}

            {openTopic &&
              (() => {
                const t = path.topics.find((topic) => topic.key === openTopic);
                if (!t) return null;
                const completed = completedKeys.has(t.key);
                return hasRichLessonContent(t) ? (
                  <LessonRenderer
                    topic={t}
                    pathKey={path.key}
                    siblingTopics={path.topics}
                    completed={completed}
                    onMarkComplete={() => markComplete(t.key)}
                    markCompletePending={recordCompleted.isPending}
                  />
                ) : (
                  <div className="space-y-3">
                    {t.body.map((p, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                        {p}
                      </p>
                    ))}
                    <div className="rounded-md border border-indigo-500/20 bg-indigo-500/5 p-3">
                      <p className="text-xs text-foreground/90">
                        <span className="font-semibold text-indigo-400">Why it matters: </span>
                        {t.whyItMatters}
                      </p>
                    </div>
                    <RelatedGlossaryBadges keys={t.relatedGlossaryKeys} testIdPrefix="link-module-learn-glossary" />
                  </div>
                );
              })()}

            <Link
              href={topicKey ? `/learn/paths/${pathKey}/${topicKey}` : `/learn/paths/${pathKey}`}
              className="block text-xs text-indigo-400 hover:underline pt-2 border-t border-border"
              data-testid="link-module-learn-open-full-page"
            >
              Open in the full Learning Centre →
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
