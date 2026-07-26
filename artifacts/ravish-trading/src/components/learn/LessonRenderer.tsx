// v1.4.0, Sprint L1 — Learning Centre Foundation.
//
// The shared lesson layout/renderer — the template every future lesson
// follows, built once here rather than re-authored per topic. Renders a
// LearningTopic's optional, richer fields (per the approved 13-part
// Learning Framework in the Learning Content Master Plan) as a sequence
// of small, reusable LessonSection blocks. Every one of the pre-existing
// 68 topics supplies none of these fields — LearningPaths.tsx's own
// PathDetail falls back to its established plain summary/body/whyItMatters
// rendering whenever a topic has no rich content, so nothing about the
// existing 68 topics' display changes.
//
// Composes, rather than duplicates, three other new-this-sprint shared
// components: BookmarkButton (learning_progress upsert), AskCoachLauncher
// (the existing global Trading Coach panel), and the existing glossary
// Badge/Link pattern already established in LearningPaths.tsx/
// ExplainButton.tsx (relatedGlossaryKeys -> /learn/glossary/:key).

import type { ReactNode } from "react";
import { Link } from "wouter";
import type { LearningTopic } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkButton } from "./BookmarkButton";
import { AskCoachLauncher } from "./AskCoachLauncher";
import { ArrowRight, Clock } from "lucide-react";

const DIFFICULTY_BADGE_CLASS: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  intermediate: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  advanced: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  institutional: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
};

function LessonSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5" data-testid={`lesson-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <h3 className="text-xs font-semibold text-foreground/90">{title}</h3>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 list-disc list-inside">
      {items.map((item, i) => (
        <li key={i} className="text-xs text-muted-foreground leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}

export interface LessonRendererProps {
  topic: LearningTopic;
  pathKey: string;
  /** Every topic in the same path, in order — used to resolve
   * nextStepKeys/the "Next Lesson" fallback (the immediately following
   * topic in this same path) without a second fetch. */
  siblingTopics: LearningTopic[];
  completed: boolean;
  onMarkComplete: () => void;
  markCompletePending: boolean;
}

/** True whenever a topic supplies at least one of the new, optional rich
 * fields — the signal LearningPaths.tsx uses to decide whether to render
 * via this component or fall back to the plain, pre-existing display. */
export function hasRichLessonContent(topic: LearningTopic): boolean {
  return Boolean(
    topic.difficulty ||
      topic.whyItExists ||
      topic.institutionalThinking ||
      (topic.workflowSteps && topic.workflowSteps.length > 0) ||
      (topic.metricsExplained && topic.metricsExplained.length > 0) ||
      topic.workedExample ||
      (topic.commonMistakes && topic.commonMistakes.length > 0) ||
      (topic.riskWarnings && topic.riskWarnings.length > 0) ||
      (topic.bestPractices && topic.bestPractices.length > 0),
  );
}

export function LessonRenderer({
  topic,
  pathKey,
  siblingTopics,
  completed,
  onMarkComplete,
  markCompletePending,
}: LessonRendererProps) {
  const nextKey = topic.nextStepKeys?.[0];
  const nextTopic = nextKey ? siblingTopics.find((t) => t.key === nextKey) : undefined;

  return (
    <div className="space-y-4" data-testid={`lesson-renderer-${topic.key}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {topic.difficulty && (
          <Badge className={`text-[9px] ${DIFFICULTY_BADGE_CLASS[topic.difficulty] ?? ""}`} data-testid={`badge-difficulty-${topic.key}`}>
            {topic.difficulty}
          </Badge>
        )}
        <Badge variant="outline" className="text-[9px] flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" /> {topic.estimatedMinutes} min
        </Badge>
        <BookmarkButton itemType="lesson" itemKey={topic.key} />
      </div>

      <LessonSection title="Overview">
        <div className="space-y-2">
          {topic.body.map((p, i) => (
            <p key={i} className="text-xs text-muted-foreground leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      </LessonSection>

      {topic.whyItExists && (
        <LessonSection title="Why It Exists">
          <p className="text-xs text-muted-foreground leading-relaxed">{topic.whyItExists}</p>
        </LessonSection>
      )}

      <LessonSection title="Why It Matters">
        <div className="rounded-md border border-indigo-500/20 bg-indigo-500/5 p-3">
          <p className="text-xs text-foreground/90">{topic.whyItMatters}</p>
        </div>
      </LessonSection>

      {topic.institutionalThinking && (
        <LessonSection title="Institutional Thinking">
          <p className="text-xs text-muted-foreground leading-relaxed">{topic.institutionalThinking}</p>
        </LessonSection>
      )}

      {topic.workflowSteps && topic.workflowSteps.length > 0 && (
        <LessonSection title="Workflow">
          <ol className="space-y-1 list-decimal list-inside">
            {topic.workflowSteps.map((step, i) => (
              <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
        </LessonSection>
      )}

      {topic.screenWalkthrough && topic.screenWalkthrough.length > 0 && (
        <LessonSection title="Screen Walkthrough">
          <BulletList items={topic.screenWalkthrough} />
        </LessonSection>
      )}

      {topic.metricsExplained && topic.metricsExplained.length > 0 && (
        <LessonSection title="Metrics Explained">
          <dl className="space-y-2">
            {topic.metricsExplained.map((m, i) => (
              <div key={i}>
                <dt className="text-xs font-medium text-foreground/90">{m.term}</dt>
                <dd className="text-xs text-muted-foreground leading-relaxed">{m.explanation}</dd>
              </div>
            ))}
          </dl>
        </LessonSection>
      )}

      {topic.workedExample && (
        <LessonSection title="Worked Example">
          <div className="rounded-md border border-border bg-secondary/20 p-3 space-y-1.5" data-testid="lesson-worked-example">
            <p className="text-xs font-medium text-foreground/90">{topic.workedExample.title}</p>
            <ol className="space-y-1 list-decimal list-inside">
              {topic.workedExample.steps.map((step, i) => (
                <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
            {topic.workedExample.note && (
              <p className="text-[11px] text-muted-foreground/70 italic">{topic.workedExample.note}</p>
            )}
          </div>
        </LessonSection>
      )}

      {topic.commonMistakes && topic.commonMistakes.length > 0 && (
        <LessonSection title="Common Mistakes">
          <BulletList items={topic.commonMistakes} />
        </LessonSection>
      )}

      {topic.riskWarnings && topic.riskWarnings.length > 0 && (
        <LessonSection title="Risk Considerations">
          <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
            <BulletList items={topic.riskWarnings} />
          </div>
        </LessonSection>
      )}

      {topic.bestPractices && topic.bestPractices.length > 0 && (
        <LessonSection title="Best Practices">
          <BulletList items={topic.bestPractices} />
        </LessonSection>
      )}

      {topic.externalHref && (
        <Link href={topic.externalHref} className="block text-xs text-indigo-400 hover:underline" data-testid={`link-topic-external-${topic.key}`}>
          Open the dedicated tool/page →
        </Link>
      )}

      {topic.relatedModuleHrefs && topic.relatedModuleHrefs.length > 0 && (
        <LessonSection title="Related Modules">
          <div className="flex flex-wrap gap-2">
            {topic.relatedModuleHrefs.map((href) => (
              <Link key={href} href={href} data-testid={`link-related-module-${href}`}>
                <Badge variant="outline" className="text-[9px] cursor-pointer hover:border-indigo-500/40 flex items-center gap-1">
                  {href}
                </Badge>
              </Link>
            ))}
          </div>
        </LessonSection>
      )}

      {topic.relatedGlossaryKeys.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {topic.relatedGlossaryKeys.map((k) => (
            <Link key={k} href={`/learn/glossary/${k}`} data-testid={`link-glossary-${k}`}>
              <Badge variant="outline" className="text-[9px] cursor-pointer hover:border-indigo-500/40">
                {k}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {topic.aiCoachPrompts && topic.aiCoachPrompts.length > 0 && (
        <LessonSection title="Ask the AI Coach">
          <AskCoachLauncher suggestedQuestion={topic.aiCoachPrompts[0]} />
        </LessonSection>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <Button
          size="sm"
          variant={completed ? "outline" : "default"}
          className="h-7 text-xs"
          disabled={completed || markCompletePending}
          onClick={onMarkComplete}
          data-testid={`button-mark-complete-${topic.key}`}
        >
          {completed ? "Completed" : "Mark Complete"}
        </Button>
        {nextTopic && (
          <Link
            href={`/learn/paths/${pathKey}/${nextTopic.key}`}
            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline"
            data-testid="link-next-lesson"
          >
            Next: {nextTopic.title} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
