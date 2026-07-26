// AI Teacher & Learning Centre sprint — Learning Paths.
//
// Handles 3 routes with one component: /learn/paths (all paths),
// /learn/paths/:pathKey (one path's topics), and
// /learn/paths/:pathKey/:topicKey (a single topic, deep-linkable from
// Explain Mode's relatedLessonHref and from other topics' own
// cross-references). Viewing a topic records Learning Progress (the
// only permitted user-state mutation this sprint introduces, alongside
// the analogous mutation in Glossary.tsx/StrategyAcademy.tsx).

import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import {
  useGetLearningPaths,
  useGetLearningPathByKey,
  useGetLearningProgress,
  useRecordLearningItemViewed,
  useRecordLearningItemCompleted,
  getGetLearningProgressQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { BookOpen, CheckCircle2, Clock, ArrowLeft } from "lucide-react";
import { LessonRenderer, hasRichLessonContent } from "@/components/learn/LessonRenderer";
import { RelatedGlossaryBadges } from "@/components/learn/RelatedGlossaryBadges";

function PathsList() {
  const { data: paths, isLoading } = useGetLearningPaths();
  const { data: progress } = useGetLearningProgress();
  const completionFor = (key: string) => progress?.pathCompletion.find((p) => p.pathKey === key);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-400" /> Learning Paths
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Structured, deterministic learning paths from foundations through institutional risk thinking.
        </p>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="grid-learning-paths">
          {(paths ?? []).map((p) => {
            const completion = completionFor(p.key);
            return (
              <Link key={p.key} href={`/learn/paths/${p.key}`} data-testid={`link-path-${p.key}`}>
                <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{p.title}</CardTitle>
                    <CardDescription className="text-[11px]">{p.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-[11px] text-muted-foreground mb-1">
                      {p.topics.length} topics
                      {completion ? ` — ${completion.topicsCompleted}/${completion.topicsTotal} completed` : ""}
                    </div>
                    <Progress value={completion?.percentComplete ?? 0} className="h-1.5" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PathDetail({ pathKey, topicKey }: { pathKey: string; topicKey?: string }) {
  const { data: path, isLoading, isError } = useGetLearningPathByKey(pathKey);
  const { data: progress } = useGetLearningProgress();
  const recordViewed = useRecordLearningItemViewed();
  const recordCompleted = useRecordLearningItemCompleted();
  const queryClient = useQueryClient();
  const [openTopic, setOpenTopic] = useState<string | null>(topicKey ?? null);

  useEffect(() => {
    if (topicKey) setOpenTopic(topicKey);
  }, [topicKey]);

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

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="text-path-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (isError || !path) {
    return (
      <p className="text-sm text-destructive" data-testid="text-path-not-found">
        Learning path not found.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/learn/paths" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3 h-3" /> All Learning Paths
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-foreground">{path.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{path.description}</p>
      </div>
      <div className="space-y-3" data-testid="list-topics">
        {path.topics.map((t) => {
          const open = openTopic === t.key;
          const completed = completedKeys.has(t.key);
          return (
            <Card key={t.key} className="bg-card border-border" data-testid={`topic-${t.key}`}>
              <CardHeader
                className="pb-2 cursor-pointer"
                onClick={() => {
                  const next = open ? null : t.key;
                  setOpenTopic(next);
                  if (next) markViewed(t.key);
                }}
              >
                <CardTitle className="text-sm flex items-center gap-2">
                  {completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                  )}
                  <span className="flex-1">{t.title}</span>
                  <Badge variant="outline" className="text-[9px] flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> {t.estimatedMinutes} min
                  </Badge>
                </CardTitle>
                <CardDescription className="text-[11px]">{t.summary}</CardDescription>
              </CardHeader>
              {open && (
                <CardContent className="space-y-3">
                  {hasRichLessonContent(t) ? (
                    <LessonRenderer
                      topic={t}
                      pathKey={path.key}
                      siblingTopics={path.topics}
                      completed={completed}
                      onMarkComplete={() => markComplete(t.key)}
                      markCompletePending={recordCompleted.isPending}
                    />
                  ) : (
                    <>
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
                      {t.externalHref && (
                        <Link href={t.externalHref} className="block text-xs text-indigo-400 hover:underline" data-testid={`link-topic-external-${t.key}`}>
                          Open the dedicated tool/page →
                        </Link>
                      )}
                      <RelatedGlossaryBadges keys={t.relatedGlossaryKeys} />
                      <Button
                        size="sm"
                        variant={completed ? "outline" : "default"}
                        className="h-7 text-xs"
                        disabled={completed || recordCompleted.isPending}
                        onClick={() => markComplete(t.key)}
                        data-testid={`button-mark-complete-${t.key}`}
                      >
                        {completed ? "Completed" : "Mark Complete"}
                      </Button>
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function LearningPaths() {
  const { pathKey, topicKey } = useParams<{ pathKey?: string; topicKey?: string }>();
  if (!pathKey) return <PathsList />;
  return <PathDetail pathKey={pathKey} topicKey={topicKey} />;
}
