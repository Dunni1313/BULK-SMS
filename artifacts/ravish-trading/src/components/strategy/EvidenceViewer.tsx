// Phase 30/31 — Institutional Strategy Framework / Strategy Workbench.
//
// A pure, reusable rendering of a strategy's own requiredEvidence list —
// never a calculation, just a citation of which existing deterministic
// engines (Market Structure, Liquidity & Session, Risk, Trade Planning,
// Journal, AI Coach) this strategy's author considers relevant. Shared
// verbatim by StrategyFramework.tsx (Phase 30) and StrategyWorkbench.tsx
// (Phase 31) so the two pages can never silently drift on this rendering.

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";

export const EVIDENCE_LABELS: Record<string, string> = {
  structure: "Market Structure Workbench",
  liquidity: "Liquidity & Session Workbench",
  session: "Trading Session",
  risk: "Risk Studio",
  "trade-plan": "Trade Planning Studio",
  journal: "Trading Journal",
  coach: "Trading AI Coach",
};

export function EvidenceViewer({ requiredEvidence }: { requiredEvidence: string[] }) {
  return (
    <Card data-testid="panel-evidence-viewer">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="w-4 h-4" /> Evidence Viewer
        </CardTitle>
        <CardDescription>Existing deterministic outputs this strategy's own author considers relevant — never calculated here.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {requiredEvidence.length === 0 && (
          <p className="text-sm text-muted-foreground" data-testid="text-evidence-empty">
            No required evidence sources were specified for this strategy.
          </p>
        )}
        {requiredEvidence.map((ev) => (
          <Badge key={ev} variant="secondary" data-testid={`badge-evidence-${ev}`}>
            {EVIDENCE_LABELS[ev] ?? ev}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}
