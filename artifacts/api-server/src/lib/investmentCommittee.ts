// Phase 2, Sprint 17 — AI Investment Committee, Core (approved Phase 2 plan,
// Sprint 17). A pure ORCHESTRATION layer, not a fourth analyst: it takes Graham's,
// Buffett's, and Tom Nash's independently-computed outputs and combines them into
// one consolidated recommendation + confidence score. Nothing here recomputes a
// valuation, a quality score, or any pillar — every number is sourced from an
// already-computed analyst output.
//
// Graham and Buffett are pure valuation models — they only produce a categorical
// `rating` (Cheap/Fair/Expensive/Very Expensive), not a Buy/Hold/Wait verdict. Per
// the approved Sprint 17 decision, each casts its Committee vote via a bucket
// collapse of that rating (Cheap -> Buy, Fair -> Hold, Expensive/Very Expensive ->
// Wait), with confidence reusing the EXACT SAME rating->score table Tom Nash's own
// Valuation pillar already uses (`VALUATION_RATING_SCORE`, exported from
// tomNashEngine.ts) — zero new scoring logic, one more consumer of an existing
// table. Tom Nash (Sprint 16) already produces a real, holistic {verdict,
// convictionScore} and votes with that directly.
//
// Agreement classification reuses marginOfSafety.ts's own generic
// `classifyAgreementSignal()` (extracted, Sprint 17) — the same
// unanimous/majority/split/insufficient-data algorithm already proven for the
// Consolidated Margin of Safety, now applied to 3 Buy/Hold/Wait votes instead of 4
// valuation ratings.
//
// Per the approved Sprint 17 decision, when all voters genuinely disagree (split),
// the consolidated verdict defaults to "Hold" — the safe, neutral call — rather
// than forcing a Buy or Wait from a coin-flip. The agreement signal is always
// surfaced so a user can see the level of consensus behind the recommendation.
//
// Deterministic, rule-based reasoning only this sprint — no LLM narration. Real
// ai-core-narrated synthesis is explicitly deferred to a later Committee
// enhancement sprint, once the aggregation logic itself is stable.

import type { GrahamValuation } from "./grahamValuation.js";
import type { BuffettValuation } from "./buffettValuation.js";
import type { TomNashAnalysis } from "./tomNashEngine.js";
import { VALUATION_RATING_SCORE } from "./tomNashEngine.js";
import { classifyAgreementSignal, type AgreementSignal } from "./marginOfSafety.js";

function round(x: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}

export type CommitteeVerdict = "Buy" | "Hold" | "Wait";
export type CommitteeAnalyst = "Graham" | "Buffett" | "Tom Nash";

export interface CommitteeVote {
  analyst: CommitteeAnalyst;
  verdict: CommitteeVerdict;
  confidence: number; // 0-100
  rationale: string;
}

export interface InvestmentCommitteeAnalysis {
  votes: CommitteeVote[]; // only analysts that produced a usable vote; never fabricated for an unavailable model
  consolidatedVerdict: CommitteeVerdict;
  confidenceScore: number; // 0-100, average of the actual votes cast
  agreement: AgreementSignal;
  reasoning: string[];
  summary: string;
}

// Approved Sprint 17 mapping — isolated here, reusing Tom Nash's own valuation
// rating->score table for confidence, so refining either never touches Graham/
// Buffett/DCF/the blended model's own computation.
const RATING_TO_VERDICT: Record<string, CommitteeVerdict> = {
  Cheap: "Buy",
  Fair: "Hold",
  Expensive: "Wait",
  "Very Expensive": "Wait",
};

function valuationVote(analyst: "Graham" | "Buffett", model: GrahamValuation | BuffettValuation): CommitteeVote | null {
  if (!model.available) return null;
  return {
    analyst,
    verdict: RATING_TO_VERDICT[model.rating],
    confidence: VALUATION_RATING_SCORE[model.rating],
    rationale: model.summary,
  };
}

function tomNashVote(tomNash: TomNashAnalysis): CommitteeVote {
  return {
    analyst: "Tom Nash",
    verdict: tomNash.verdict,
    confidence: tomNash.convictionScore,
    rationale: tomNash.summary,
  };
}

function tallyMajorityVerdict(votes: CommitteeVote[]): CommitteeVerdict {
  const counts = new Map<CommitteeVerdict, number>();
  for (const v of votes) counts.set(v.verdict, (counts.get(v.verdict) ?? 0) + 1);
  let best = votes[0].verdict;
  let bestCount = 0;
  for (const v of votes) {
    const c = counts.get(v.verdict)!;
    if (c > bestCount) {
      best = v.verdict;
      bestCount = c;
    }
  }
  return best;
}

export function synthesizeInvestmentCommittee(
  graham: GrahamValuation,
  buffett: BuffettValuation,
  tomNash: TomNashAnalysis,
): InvestmentCommitteeAnalysis {
  const votes: CommitteeVote[] = [
    valuationVote("Graham", graham),
    valuationVote("Buffett", buffett),
    tomNashVote(tomNash),
  ].filter((v): v is CommitteeVote => v != null);

  const agreement = classifyAgreementSignal(votes.map((v) => v.verdict));

  let consolidatedVerdict: CommitteeVerdict;
  if (agreement === "split") {
    consolidatedVerdict = "Hold";
  } else {
    // unanimous, majority, or a single voter (insufficient-data) all resolve the
    // same way: the verdict with the most votes (a lone voter trivially "wins").
    consolidatedVerdict = tallyMajorityVerdict(votes);
  }

  const confidenceScore = round(votes.reduce((a, v) => a + v.confidence, 0) / votes.length);

  const reasoning = votes.map((v) => `${v.analyst}: ${v.verdict} (confidence ${v.confidence}/100) — ${v.rationale}`);
  const agreementText =
    agreement === "unanimous"
      ? "all voting analysts agree"
      : agreement === "majority"
        ? "most voting analysts agree, though not all"
        : agreement === "split"
          ? "voting analysts are genuinely split — defaulting to the neutral Hold call"
          : "too few analysts voted to assess agreement";
  reasoning.push(`Consolidated: ${consolidatedVerdict} — ${agreementText}.`);

  const summary =
    `Investment Committee: ${consolidatedVerdict} (confidence ${confidenceScore}/100), based on ${votes.length} of 3 ` +
    `analyst votes (${votes.map((v) => v.analyst).join(", ")}); ${agreementText}.`;

  return { votes, consolidatedVerdict, confidenceScore, agreement, reasoning, summary };
}
