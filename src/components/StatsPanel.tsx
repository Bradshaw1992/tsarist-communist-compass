import { Star, Target, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { TopicProgress } from "@/hooks/useHighScores";

interface StatsPanelProps {
  scores: Record<number, TopicProgress>;
  totalTopics: number;
}

export function StatsPanel({ scores, totalTopics }: StatsPanelProps) {
  const entries = Object.values(scores);
  const attempted = entries.length;
  const mastered = entries.filter((s) => s.highScore >= 90).length;
  const avgScore = attempted > 0
    ? Math.round(entries.reduce((sum, s) => sum + s.highScore, 0) / attempted)
    : 0;
  const overallPct = totalTopics > 0 ? Math.round((mastered / totalTopics) * 100) : 0;

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-8">
      <h2 className="text-center font-serif text-xl font-bold text-primary">
        Your Progress
      </h2>

      {/* Overall mastery */}
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-primary/20 bg-primary/5">
            <span className="text-2xl font-bold text-primary">{overallPct}%</span>
          </div>
          <p className="text-sm text-muted-foreground">Overall Mastery</p>
          <Progress value={overallPct} className="h-2 w-full" />
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <Target className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold text-foreground">{attempted}</span>
            <span className="text-[10px] text-muted-foreground">Attempted</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            <span className="text-lg font-bold text-foreground">{mastered}</span>
            <span className="text-[10px] text-muted-foreground">Mastered</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold text-foreground">{avgScore}%</span>
            <span className="text-[10px] text-muted-foreground">Avg Score</span>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {totalTopics - attempted} topics remaining · Score 90%+ in Blank Recall to master a topic
      </p>
    </div>
  );
}
