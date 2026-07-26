// v1.4.0, Sprint L1 — Learning Centre Foundation.
//
// The shared "related glossary terms" badge list — previously copy-pasted
// identically in LearningPaths.tsx's plain-topic fallback and again in the
// new LessonRenderer.tsx (and in a slightly-renamed-testid form inside the
// pre-existing ExplainButton.tsx). Extracted here so all three render
// exactly the same markup from one place, per the sprint's "no duplicated
// functionality" requirement — never a fabricated link, since keys always
// come from an already-fetched topic/explanation's own relatedGlossaryKeys.

import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export function RelatedGlossaryBadges({
  keys,
  testIdPrefix = "link-glossary",
}: {
  keys: string[];
  /** Distinguishes this instance's links from another RelatedGlossaryBadges
   * rendered elsewhere on the same page (e.g. ExplainButton's own
   * "link-explain-glossary-" prefix vs. the lesson view's default). */
  testIdPrefix?: string;
}) {
  if (keys.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((k) => (
        <Link key={k} href={`/learn/glossary/${k}`} data-testid={`${testIdPrefix}-${k}`}>
          <Badge variant="outline" className="text-[9px] cursor-pointer hover:border-indigo-500/40">
            {k}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
