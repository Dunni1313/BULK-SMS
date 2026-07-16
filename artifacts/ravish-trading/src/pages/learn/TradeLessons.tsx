import { useGetCoachLessons, getGetCoachLessonsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Bot, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function TradeLessons() {
  const { data: lessons, isLoading } = useGetCoachLessons({ query: { queryKey: getGetCoachLessonsQueryKey() } });

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Trade Lessons</h1>
        <p className="text-muted-foreground mt-2">Insights generated from your closed trades and journal reviews.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-card border-border">
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : lessons?.length === 0 ? (
        <Card className="bg-card border-dashed border-border py-20">
          <CardContent className="flex flex-col items-center justify-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg font-medium text-foreground">No lessons yet.</p>
            <p className="text-sm mt-1">Close some trades and generate lessons in the Journal to see them here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {lessons?.map(lesson => (
            <Card key={lesson.id} className="bg-card border-border hover:border-indigo-500/30 transition-colors group overflow-hidden">
              <CardHeader className="bg-secondary/10 pb-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 capitalize">
                        {lesson.topic}
                      </Badge>
                      {lesson.source === "llm" && (
                        <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
                          <Bot className="w-3 h-3 mr-1" /> AI
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg leading-snug group-hover:text-indigo-400 transition-colors">
                      {lesson.title}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {lesson.content}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono pt-4 border-t border-border/50">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(lesson.createdAt), "MMM d, yyyy")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
