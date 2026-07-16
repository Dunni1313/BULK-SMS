import { useState } from "react";
import { useListJournalEntries, useCreateJournalEntry, getListJournalEntriesQueryKey, getGetCoachLessonsQueryKey, JournalEntryInputMood, JournalReviewResult } from "@workspace/api-client-react";
import { streamCoach } from "@/lib/coach-stream";
import { Markdown } from "@/components/ui/markdown";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Bot, Lightbulb, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Journal() {
  const { data: entries, isLoading } = useListJournalEntries();
  const createEntry = useCreateJournalEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<JournalEntryInputMood>("neutral");
  const [lesson, setLesson] = useState("");
  const [reviewingTradeId, setReviewingTradeId] = useState<number | null>(null);
  // Streaming review state for the currently-reviewed trade.
  const [reviewText, setReviewText] = useState("");
  const [reviewLesson, setReviewLesson] = useState("");
  const [reviewSource, setReviewSource] = useState<JournalReviewResult["source"] | null>(null);
  const [reviewPending, setReviewPending] = useState(false);
  const [reviewError, setReviewError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    
    createEntry.mutate(
      { data: { title, content, mood, lessonLearned: lesson, tags: [] } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
          setTitle("");
          setContent("");
          setLesson("");
          setMood("neutral");
          toast({ title: "Journal entry added" });
        },
        onError: () => {
          toast({ title: "Failed to add entry", variant: "destructive" });
        }
      }
    );
  };

  const handleGenerateReview = (tradeId: number) => {
    setReviewingTradeId(tradeId);
    setReviewPending(true);
    setReviewError(false);
    setReviewText("");
    setReviewLesson("");
    setReviewSource(null);

    streamCoach(
      "/coach/journal-review/stream",
      { tradeId },
      {
        onMeta: (data) => {
          const d = data as { source?: JournalReviewResult["source"] };
          if (d.source) setReviewSource(d.source);
          setReviewPending(false);
        },
        onDelta: (text) => setReviewText((prev) => prev + text),
        onDone: (data) => {
          const d = data as {
            review?: string;
            lessonLearned?: string;
            source?: JournalReviewResult["source"];
          };
          if (typeof d.review === "string") setReviewText(d.review);
          if (typeof d.lessonLearned === "string") setReviewLesson(d.lessonLearned);
          if (d.source) setReviewSource(d.source);
          setReviewPending(false);
          queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCoachLessonsQueryKey() });
        },
        onError: () => {
          setReviewError(true);
          setReviewPending(false);
        },
      },
    ).catch(() => {
      setReviewError(true);
      setReviewPending(false);
    });
  };

  const getMoodColor = (m: string) => {
    switch(m) {
      case 'confident': return 'bg-success/20 text-success border-success/30';
      case 'cautious': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'frustrated': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'excited': return 'bg-primary/20 text-primary border-primary/30';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-12">
      <div className="md:col-span-2 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Trade Journal</h1>
        
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-card border-border"><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))
          ) : entries?.length === 0 ? (
            <Card className="bg-card border-border"><CardContent className="p-8 text-center text-muted-foreground">No entries yet. Write your first log.</CardContent></Card>
          ) : (
            entries?.map(entry => (
              <Card key={entry.id} className="bg-card border-border">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{entry.title}</CardTitle>
                    <div className="flex gap-2 items-center">
                      <Badge className={getMoodColor(entry.mood)} variant="outline">
                        {entry.mood}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {format(new Date(entry.createdAt), "MMM d, yyyy HH:mm")}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {entry.strategy && (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="capitalize border-primary/30 text-primary">
                        {entry.strategy.replace(/_/g, " ")}
                      </Badge>
                      {entry.exitReason && (
                        <Badge variant="outline" className="capitalize border-border text-muted-foreground">
                          {entry.exitReason.replace(/_/g, " ")}
                        </Badge>
                      )}
                      {entry.realizedPnl != null && (
                        <Badge
                          variant="outline"
                          className={entry.realizedPnl >= 0 ? "border-success/30 text-success" : "border-destructive/30 text-destructive"}
                        >
                          {entry.realizedPnl >= 0 ? "+" : "-"}${Math.abs(entry.realizedPnl).toFixed(2)}
                        </Badge>
                      )}
                    </div>
                  )}
                  {entry.strategy && (
                    <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {[
                        { label: "Credit", value: entry.entryCredit != null ? `$${entry.entryCredit.toFixed(0)}` : null },
                        { label: "Max P", value: entry.maxProfit != null ? `$${entry.maxProfit.toFixed(0)}` : null },
                        { label: "Max L", value: entry.maxLoss != null ? `$${entry.maxLoss.toFixed(0)}` : null },
                        { label: "EV", value: entry.ev != null ? `$${entry.ev.toFixed(0)}` : null },
                        { label: "POP", value: entry.pop != null ? `${entry.pop.toFixed(0)}%` : null },
                        { label: "Score", value: entry.ravishScore != null ? `${Math.round(entry.ravishScore)}` : null },
                      ]
                        .filter((s) => s.value != null)
                        .map((s) => (
                          <div key={s.label} className="rounded-md border border-border bg-secondary/30 px-2 py-1.5 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                            <p className="font-mono text-sm text-foreground">{s.value}</p>
                          </div>
                        ))}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap text-foreground/90">{entry.content}</p>
                  
                  {entry.lessonLearned && (
                    <div className="mt-4 p-3 bg-secondary/50 rounded-md border border-border">
                      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Lesson Learned</p>
                      <p className="text-sm italic">{entry.lessonLearned}</p>
                    </div>
                  )}

                  {/* AI Coach Integration for closed trades (realizedPnl is set on close) */}
                  {entry.tradeId && entry.realizedPnl != null && (
                    <div className="mt-6">
                      {reviewingTradeId === entry.tradeId ? (
                        reviewPending ? (
                          <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-md space-y-3">
                            <Skeleton className="h-4 w-1/4 bg-indigo-500/20" />
                            <Skeleton className="h-20 w-full bg-indigo-500/10" />
                          </div>
                        ) : reviewError ? (
                          <div className="text-sm text-destructive">Failed to generate review.</div>
                        ) : (
                          <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-md space-y-4 animate-in fade-in">
                            <div className="flex items-center gap-2">
                              <Bot className="w-4 h-4 text-indigo-400" />
                              <h4 className="text-sm font-semibold text-indigo-400">AI Coach Review</h4>
                              {reviewSource === "template" && (
                                <Badge variant="outline" className="ml-auto text-[10px] h-5 border-muted text-muted-foreground bg-muted/20">
                                  Built-in
                                </Badge>
                              )}
                              {reviewSource === "llm" && (
                                <Badge variant="outline" className="ml-auto text-[10px] h-5 border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
                                  AI
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-foreground/90 leading-relaxed border-l-2 border-indigo-500/30 pl-3">
                              <Markdown className="text-sm">{reviewText}</Markdown>
                            </div>
                            
                            {reviewLesson && (
                              <div className="flex gap-3 items-start pt-3 border-t border-indigo-500/20">
                                <Lightbulb className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-foreground/90 italic">
                                  "{reviewLesson}"
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 transition-colors"
                          onClick={() => handleGenerateReview(entry.tradeId!)}
                        >
                          <Bot className="w-4 h-4 mr-2" /> Generate Coach Review
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <div className="md:col-span-1">
        <Card className="bg-card border-border sticky top-6">
          <CardHeader>
            <CardTitle>New Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase">Title</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} required className="bg-background" placeholder="E.g. SPY Earnings Trade" />
              </div>
              
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase">Mood</label>
                <Select value={mood} onValueChange={(v: any) => setMood(v)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confident">Confident</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="cautious">Cautious</SelectItem>
                    <SelectItem value="frustrated">Frustrated</SelectItem>
                    <SelectItem value="excited">Excited</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase">Notes</label>
                <Textarea 
                  value={content} 
                  onChange={e => setContent(e.target.value)} 
                  required 
                  className="bg-background min-h-[150px]" 
                  placeholder="What happened? Why did you enter/exit?"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase">Lesson Learned (Optional)</label>
                <Input value={lesson} onChange={e => setLesson(e.target.value)} className="bg-background" />
              </div>

              <Button type="submit" disabled={createEntry.isPending} className="w-full">
                {createEntry.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
