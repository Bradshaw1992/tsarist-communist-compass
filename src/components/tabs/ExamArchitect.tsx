import { useState, useMemo } from "react";
import { useExamQuestionsForSpec } from "@/hooks/useRevisionData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import type { ExamQuestion } from "@/types/revision";

interface ExamArchitectProps {
  specId: number;
}

/** Filter out generic AQA level descriptors and mark scheme boilerplate */
function filterIndicativeContent(points: string[]): string[] {
  const boilerplatePatterns = [
    /^level\s*\d/i,
    /^answers will display/i,
    /^answers will show/i,
    /^the answer will/i,
    /^demonstrates?\s/i,
    /^shows?\s+(a\s+)?(very\s+)?good understanding/i,
    /^provides? some supported/i,
    /^well-organised/i,
    /^step\s*\d/i,
    /^start at the lowest/i,
    /^before you apply/i,
    /^when assigning a level/i,
    /mark scheme/i,
    /standardisation/i,
    /^further copies/i,
    /^copyright/i,
    /^aqa retains/i,
    /associates?\s+(encounter|analyse|participate)/i,
    /^it must be stressed/i,
    /^as preparation/i,
    /^alternative\s+answers/i,
    /descriptor for/i,
    /^this mark scheme/i,
    /^using your understanding/i,
    /^analyse and evaluate/i,
    /^demonstrate,?\s*organise/i,
    /concepts,?\s*as relevant/i,
    /well-substantiated/i,
    /partially substantiated/i,
    /^\d+[-–]\d+$/,
    /^assess the validity/i,
    /^how (significant|successful|important)/i,
    /^'.*'\s*$/,
    /^to what extent/i,
  ];

  return points.filter((point) => {
    const trimmed = point.trim();
    if (trimmed.length < 15) return false;
    return !boilerplatePatterns.some((p) => p.test(trimmed));
  });
}

const TIME_PERIOD_ORDER = [
  "1855-1894",
  "1855-1917",
  "1894-1917",
  "1917-1941",
  "1917-1964",
  "1941-1964",
];

const TIME_PERIOD_LABELS: Record<string, string> = {
  "1855-1894": "1855–1894: Preserving Autocracy",
  "1855-1917": "1855–1917: Tsarist Russia",
  "1894-1917": "1894–1917: Collapse of Autocracy",
  "1917-1941": "1917–1941: Communist Dictatorship",
  "1917-1964": "1917–1964: Soviet Era",
  "1941-1964": "1941–1964: Stalinism & Reaction",
};

export function ExamArchitect({ specId }: ExamArchitectProps) {
  const allQuestions = useExamQuestionsForSpec(specId);

  // Filter out Section A extract/source_analysis questions
  const questions = useMemo(
    () => allQuestions.filter((q) => q.question_type !== "source_analysis"),
    [allQuestions]
  );

  // Group by time_period
  const grouped = useMemo(() => {
    const map = new Map<string, ExamQuestion[]>();
    for (const q of questions) {
      const tp = q.time_period || "Other";
      if (!map.has(tp)) map.set(tp, []);
      map.get(tp)!.push(q);
    }
    // Sort by TIME_PERIOD_ORDER
    const sorted: { period: string; label: string; items: ExamQuestion[] }[] = [];
    const keys = [...map.keys()].sort((a, b) => {
      const ai = TIME_PERIOD_ORDER.indexOf(a);
      const bi = TIME_PERIOD_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    for (const k of keys) {
      sorted.push({
        period: k,
        label: TIME_PERIOD_LABELS[k] || k,
        items: map.get(k)!,
      });
    }
    return sorted;
  }, [questions]);

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No essay questions found for this specification point.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-bold text-primary">Exam Architect</h2>
        <p className="text-sm text-muted-foreground">
          Strategic planning — study real AQA essay questions and indicative content.
        </p>
      </div>

      {grouped.map((group) => (
        <div key={group.period} className="space-y-4">
          <h3 className="font-serif text-base font-semibold text-primary/80 border-b border-border pb-2">
            {group.label}
          </h3>
          {group.items.map((q) => (
            <ExamCard key={q.id} question={q} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ExamCard({ question }: { question: ExamQuestion }) {
  const [showMarkScheme, setShowMarkScheme] = useState(false);

  const filteredPoints = useMemo(
    () => filterIndicativeContent(question.indicative_content.key_points),
    [question.indicative_content.key_points]
  );

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/30 font-sans text-xs">
            {question.year}
          </Badge>
          <Badge variant="secondary" className="font-sans text-xs">
            {question.marks} marks
          </Badge>
          <Badge variant="secondary" className="font-sans text-xs capitalize">
            {question.question_type.replace("_", " ")}
          </Badge>
        </div>
        <CardTitle className="font-serif text-base font-medium leading-relaxed text-foreground">
          <FileText className="mr-2 inline h-4 w-4 text-accent" />
          {question.question_text}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMarkScheme(!showMarkScheme)}
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          <BookOpen className="mr-1.5 h-4 w-4" />
          {showMarkScheme ? "Hide" : "Reveal"} Indicative Content
          {showMarkScheme ? (
            <ChevronUp className="ml-1 h-3 w-3" />
          ) : (
            <ChevronDown className="ml-1 h-3 w-3" />
          )}
        </Button>

        {showMarkScheme && (
          <div className="mt-3 animate-flip-in rounded-lg border border-accent/30 bg-accent/5 p-4">
            <h4 className="mb-2 font-serif text-sm font-semibold text-primary">
              Indicative Content
            </h4>
            {filteredPoints.length > 0 ? (
              <ul className="space-y-1.5">
                {filteredPoints.map((point, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm leading-relaxed text-foreground/80"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {point}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No specific indicative content available for this question. Refer to the mark scheme for guidance.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
