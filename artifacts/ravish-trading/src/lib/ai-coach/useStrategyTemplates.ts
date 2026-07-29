// v1.5.0 Sprint 9 — AI Strategy Builder. GET /ai-strategy-templates is
// shared, static, cross-coach content (Sprint 9's own "reuse" precedent —
// the same template registry backs Trading/Investing/Options alike), so
// each of the 3 coach pages fetches it once via this tiny shared hook
// rather than duplicating the same fetch-on-mount logic three times.

import { useEffect, useState } from "react";
import { listStrategyTemplates, type StrategyTemplateSummary } from "./strategiesApi";

export function useStrategyTemplates(): StrategyTemplateSummary[] {
  const [templates, setTemplates] = useState<StrategyTemplateSummary[]>([]);

  useEffect(() => {
    listStrategyTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  return templates;
}
