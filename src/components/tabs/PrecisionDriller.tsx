import { useState, useMemo, useCallback } from "react";
import { useQuizQuestionsForSpec } from "@/hooks/useRevisionData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, CheckCircle2, XCircle, RotateCcw, BookOpen, FileText } from "lucide-react";

interface PrecisionDrillerProps {
  specId: number;
}

export function PrecisionDriller({ specId }: PrecisionDrillerProps) {
  const questions = useQuizQuestionsForSpec(specId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ knew: 0, missed: 0 });

  const question = useMemo(() => questions[currentIndex], [questions, currentIndex]);

  const handleReveal = () => setRevealed(true);

  const handleSelfAssess = useCallback((knew: boolean) => {
    setStats((prev) => ({
      knew: prev.knew + (knew ? 1 : 0),
      missed: prev.missed + (knew ? 0 : 1),
    }));
    setRevealed(false);
    setCurrentIndex((prev) => (prev + 1) % questions.length);
  }, [questions.length]);

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
    setRevealed(false);
    setStats({ knew: 0, missed: 0 });
  }, []);

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No quiz questions available for this specification point.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-bold text-primary">Precision Driller</h2>
          <p className="text-sm text-muted-foreground">
            Think of the answer, then reveal — honest self-assessment builds stronger recall.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" /> {stats.knew}
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="h-3.5 w-3.5" /> {stats.missed}
          </span>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Question {currentIndex + 1} of {questions.length}
      </div>

      <Card className="mx-auto max-w-2xl border-2 shadow-lg">
        <CardContent className="p-6 sm:p-8">
          <div className="space-y-4">
            <Badge variant="secondary" className="font-sans text-xs capitalize">
              {question.question_type.replace("_", " ")}
            </Badge>
            <p className="font-serif text-lg font-medium leading-relaxed text-foreground">
              {question.question_text}
            </p>
          </div>

          {!revealed && (
            <div className="mt-6">
              <Button
                onClick={handleReveal}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Eye className="mr-1.5 h-4 w-4" />
                Reveal Answer
              </Button>
            </div>
          )}

          {revealed && (
            <div className="mt-6 animate-flip-in space-y-4">
              <div className="rounded-lg border border-border bg-muted/50 p-5">
                <h4 className="mb-1 font-serif text-sm font-semibold text-primary">
                  Model Answer
                </h4>
                <p className="text-sm leading-relaxed text-foreground/80">
                  {question.correct_answer}
                </p>
              </div>

              {/* Source Card */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-2 text-sm text-foreground/70">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <div className="space-y-0.5">
                    <p>Workpack: {question.level_3_feedback.workpack_ref}</p>
                    <p>Textbook: {question.level_3_feedback.textbook_ref}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => handleSelfAssess(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  I knew this
                </Button>
                <Button
                  onClick={() => handleSelfAssess(false)}
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  I missed this
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button onClick={handleReset} variant="ghost" size="sm">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restart
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
