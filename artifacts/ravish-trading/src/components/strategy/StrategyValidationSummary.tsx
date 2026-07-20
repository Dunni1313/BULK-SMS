// Phase 31 — Institutional Strategy Workbench. Renders the strategy's own
// `validation` field (routes/tradingStrategies.ts, backed by
// validateStrategyMetadata()) — an honest read-back of the real structural
// check every persisted strategy already passed at write time, never a
// fabricated "Valid" label. Purely structural: this never judges whether
// the strategy's own methodology is sound, only whether its metadata is
// well-formed.

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { TradingStrategyValidation } from "@workspace/api-client-react";

export function StrategyValidationSummary({ validation }: { validation: TradingStrategyValidation }) {
  return (
    <Card data-testid="panel-validation-summary">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {validation.valid ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 text-amber-400" />}
          Strategy Validation Summary
        </CardTitle>
        <CardDescription>
          A structural check only — non-empty fields, a valid category, unique checklist ids. Never a judgment on whether the strategy itself is sound.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Badge
          data-testid="badge-validation-status"
          variant={validation.valid ? "default" : "destructive"}
        >
          {validation.valid ? "Structurally valid" : `${validation.issues.length} issue(s)`}
        </Badge>
        {!validation.valid && (
          <ul className="list-disc list-inside text-amber-500" data-testid="list-validation-issues">
            {validation.issues.map((issue, i) => (
              <li key={i}>
                <span className="font-medium">{issue.field}:</span> {issue.message}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
