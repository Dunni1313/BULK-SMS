// AI Teacher & Learning Centre sprint — searchable, filterable, cross-linked
// Glossary. Handles both /learn/glossary (search/filter list) and
// /learn/glossary/:key (a deep link from a lesson's or Explain Mode's own
// relatedGlossaryKeys). All filtering is client-side over the full,
// deterministic glossary payload — the backend intentionally has no
// ?q=/?category= query params (avoiding the established Orval path+query
// collision precedent was unnecessary here since this route has no path
// param, but consistent client-side filtering keeps this page simple and
// fast with only ~50 terms).

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useGetGlossary, useRecordLearningItemViewed, type LearningGlossaryTermCategory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Library } from "lucide-react";

const CATEGORY_LABELS: Record<LearningGlossaryTermCategory | "all", string> = {
  all: "All Categories",
  foundations: "Foundations",
  greeks: "Greeks",
  volatility: "Volatility",
  strategies: "Strategies",
  portfolio: "Portfolio",
  performance: "Performance",
  institutional: "Institutional",
};

export default function Glossary() {
  const { key } = useParams<{ key?: string }>();
  const { data: terms, isLoading } = useGetGlossary();
  const recordViewed = useRecordLearningItemViewed();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<LearningGlossaryTermCategory | "all">("all");

  useEffect(() => {
    if (key) recordViewed.mutate({ data: { itemType: "glossary", itemKey: key } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const byKey = useMemo(() => new Map((terms ?? []).map((t) => [t.key, t])), [terms]);

  const filtered = useMemo(() => {
    if (!terms) return [];
    const query = q.trim().toLowerCase();
    return terms.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!query) return true;
      return t.term.toLowerCase().includes(query) || t.definition.toLowerCase().includes(query);
    });
  }, [terms, q, category]);

  const focused = key ? byKey.get(key) : null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Library className="w-6 h-6 text-indigo-400" /> Glossary
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Searchable, cross-linked definitions for every term used across this platform's education content.
        </p>
      </div>

      {key && (
        <Card className="bg-indigo-500/5 border-indigo-500/30" data-testid="card-glossary-focused">
          {!terms ? (
            <CardContent className="pt-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          ) : focused ? (
            <>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {focused.term}
                  <Badge variant="outline" className="text-[9px] uppercase">
                    {focused.category}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-foreground/90" data-testid="text-glossary-focused-definition">
                  {focused.definition}
                </p>
                {focused.relatedTermKeys.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {focused.relatedTermKeys.map((k) => (
                      <Link key={k} href={`/learn/glossary/${k}`} data-testid={`link-related-term-${k}`}>
                        <Badge variant="outline" className="text-[9px] cursor-pointer hover:border-indigo-500/40">
                          {byKey.get(k)?.term ?? k}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="pt-4">
              <p className="text-sm text-destructive" data-testid="text-glossary-not-found">
                Unknown glossary term.
              </p>
            </CardContent>
          )}
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Search terms…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="bg-background"
          data-testid="input-glossary-search"
        />
        <Select value={category} onValueChange={(v) => setCategory(v as LearningGlossaryTermCategory | "all")}>
          <SelectTrigger className="bg-background w-full sm:w-56" data-testid="select-glossary-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-glossary-empty">
          No terms match this search.
        </p>
      ) : (
        <div className="space-y-2" data-testid="list-glossary-terms">
          {filtered.map((t) => (
            <Link key={t.key} href={`/learn/glossary/${t.key}`} data-testid={`link-glossary-term-${t.key}`}>
              <Card className="bg-card border-border hover:border-indigo-500/40 transition-colors cursor-pointer">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{t.term}</span>
                    <Badge variant="outline" className="text-[9px] uppercase">
                      {t.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.definition}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
