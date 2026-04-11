import { useState, useMemo, useEffect } from "react";
import { useExamQuestionsForSpec } from "@/hooks/useRevisionData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, ChevronDown, ChevronUp, BookOpen, Trash2 } from "lucide-react";
import type { ExamQuestion } from "@/types/revision";

interface ExamArchitectProps {
  specId: number;
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

/** Parse markdown indicative content into structured sections */
function parseIndicativeContent(markdown: string): { type: "heading" | "bullet"; text: string }[] {
  if (!markdown || typeof markdown !== "string") return [];

  const lines = markdown.split("\n").map(l => l.trim()).filter(Boolean);
  const result: { type: "heading" | "bullet"; text: string }[] = [];

  // Filter out generic AQA level descriptors
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
    /^it must be stressed/i,
    /^as preparation/i,
    /^alternative\s+answers/i,
    /descriptor for/i,
    /^this mark scheme/i,
    /^\d+[-–]\d+$/,
    /well-substantiated/i,
    /partially substantiated/i,
  ];

  for (const line of lines) {
    // Strip markdown bold markers for pattern matching
    const plain = line.replace(/\*\*/g, "").trim();
    if (plain.length < 10) continue;
    if (boilerplatePatterns.some(p => p.test(plain))) continue;

    // Detect bold headings like **Arguments Supporting the View**
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      result.push({ type: "heading", text: plain });
    } else {
      // Strip leading "- " for bullets
      const bulletText = line.replace(/^-\s*/, "").trim();
      if (bulletText.length >= 10) {
        result.push({ type: "bullet", text: bulletText });
      }
    }
  }

  return result;
}

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
        <h2 className="font-serif text-2xl font-bold text-primary">Essay Bank</h2>
        <p className="text-sm text-muted-foreground">
          Past-paper reference — real AQA essay questions with full indicative content.
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
  const storageKey = `exam-plan-${question.id}`;

  const [planText, setPlanText] = useState(() => {
    try { return localStorage.getItem(storageKey) ?? ""; } catch { return ""; }
  });

  useEffect(() => {
    try { localStorage.setItem(storageKey, planText); } catch {}
  }, [planText, storageKey]);

  const handleClear = () => {
    setPlanText("");
    try { localStorage.removeItem(storageKey); } catch {}
  };

  const parsedContent = useMemo(
    () => parseIndicativeContent(question.indicative_content),
    [question.indicative_content]
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
      <CardContent className="space-y-3">
        {/* Planning textarea */}
        <div className="space-y-1.5">
          <Textarea
            value={planText}
            onChange={(e) => setPlanText(e.target.value)}
            placeholder="Plan your answer here (optional)..."
            className="min-h-[80px] resize-y text-sm"
            rows={3}
          />
          {planText.trim() && (
            <div className="flex justify-end">
              <Button onClick={handleClear} variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="mr-1 h-3 w-3" />
                Clear &amp; Start New
              </Button>
            </div>
          )}
        </div>

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
            <h4 className="mb-3 font-serif text-sm font-semibold text-primary">
              Indicative Content
            </h4>
            {parsedContent.length > 0 ? (
              <div className="space-y-1">
                {parsedContent.map((item, i) =>
                  item.type === "heading" ? (
                    <h5
                      key={i}
                      className="mt-4 mb-2 font-serif text-sm font-bold text-foreground first:mt-0"
                    >
                      {item.text}
                    </h5>
                  ) : (
                    <div
                      key={i}
                      className="flex gap-2 py-0.5 text-sm leading-relaxed text-foreground/80 pl-2"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <span>{item.text}</span>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No specific indicative content available for this question.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
