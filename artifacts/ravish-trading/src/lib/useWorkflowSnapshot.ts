// v1.5.0, Sprint 12 — Institutional Command Centre.
//
// The Workflow Panel's own "one genuinely new bit of glue logic" — per
// this sprint's explicit reuse mandate, this hook computes NOTHING new: it
// only calls already-existing, already-tested fetch functions (the exact
// same ones useAiNotebooks/useAiStrategies/useTradePlans call internally —
// see notebooksApi.ts/strategiesApi.ts/tradePlansApi.ts, Sprints 7-10) for
// each of the platform's 3 coachIds, then counts/filters the results
// client-side. Deliberately bypasses the full useAiNotebooks/useAiStrategies/
// useTradePlans hooks themselves (which carry a lot of CRUD/selection state
// meant for their own dedicated editor pages, not a lightweight dashboard
// summary) in favor of calling their own underlying list functions
// directly — the same functions, not a re-implementation.
//
// "Journal Entries Outstanding" is the one honest, disclosed piece of
// cross-referencing this hook performs: the last 20 closed options trades
// (lib.ts's own established `journal_entries.trade_id` loose reference,
// unchanged since Phase 1) checked against which already-fetched journal
// entries reference them — never a fabricated count, and deliberately
// bounded (last 20, not "all-time") so this stays a cheap, honest glance
// rather than a full audit.

import { useEffect, useState } from "react";
import { listNotebooks, type AiNotebook } from "./ai-coach/notebooksApi";
import { listStrategies, type AiStrategy } from "./ai-coach/strategiesApi";
import { listTradePlans, type TradePlan } from "./ai-coach/tradePlansApi";
import type { CoachId } from "./ai-coach/capabilityRegistry";

const COACH_IDS: CoachId[] = ["investing", "trading", "options"];

export interface WorkflowSnapshot {
  loading: boolean;
  notebookCount: number;
  strategiesDraftCount: number;
  tradePlansReadyCount: number;
}

export function useWorkflowSnapshot(): WorkflowSnapshot {
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot>({
    loading: true,
    notebookCount: 0,
    strategiesDraftCount: 0,
    tradePlansReadyCount: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [notebooksByCoach, strategiesByCoach, tradePlansByCoach] = await Promise.all([
          Promise.all(COACH_IDS.map((c) => listNotebooks(c).catch((): AiNotebook[] => []))),
          Promise.all(COACH_IDS.map((c) => listStrategies(c).catch((): AiStrategy[] => []))),
          Promise.all(COACH_IDS.map((c) => listTradePlans(c).catch((): TradePlan[] => []))),
        ]);
        if (cancelled) return;
        const notebookCount = notebooksByCoach.reduce((sum, list) => sum + list.length, 0);
        const strategiesDraftCount = strategiesByCoach.reduce(
          (sum, list) => sum + list.filter((s) => s.status === "draft").length,
          0,
        );
        const tradePlansReadyCount = tradePlansByCoach.reduce(
          (sum, list) => sum + list.filter((p) => p.status === "ready").length,
          0,
        );
        setSnapshot({ loading: false, notebookCount, strategiesDraftCount, tradePlansReadyCount });
      } catch {
        if (!cancelled) setSnapshot((prev) => ({ ...prev, loading: false }));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return snapshot;
}
