import { useState, useMemo, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useQuizQuestionsForSpec } from "@/hooks/useRevisionData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, CheckCircle2, XCircle, RotateCcw, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

interface PrecisionDrillerProps {
  specId: number;
}

type Assessment = "knew" | "missed";

interface HistoryEntry {
  revealed: boolean;
  assessment?: Assessment;
}

export function PrecisionDriller({ specId }: PrecisionDrillerProps) {
  const questions = useQuizQuestionsForSpec(specId);
  const storageKey = `driller-answers-${specId}`;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ knew: 0, missed: 0 });
  const [history, setHistory] = useState<Record<number, HistoryEntry>>({});
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const question = useMemo(() => questions[currentIndex], [questions, currentIndex]);

  const currentUserAnswer = userAnswers[currentIndex] ?? "";

  // Persist answers to localStorage
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(userAnswers)); } catch {}
  }, [userAnswers, storageKey]);

  const handleReveal = () => setRevealed(true);

  const handleAnswerChange = (value: string) => {
    setUserAnswers((prev) => ({ ...prev, [currentIndex]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleReveal();
    }
  };

  const handleSelfAssess = useCallback((knew: boolean) => {
    trackEvent("driller_assess", { result: knew ? "got_it" : "missed_it", spec_id: specId, driller: "precision" });
    setHistory((prev) => ({
      ...prev,
      [currentIndex]: { revealed: true, assessment: knew ? "knew" : "missed" },
    }));
    setStats((prev) => ({
      knew: prev.knew + (knew ? 1 : 0),
      missed: prev.missed + (knew ? 0 : 1),
    }));
    if (currentIndex + 1 < questions.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      const next = history[nextIdx];
      setRevealed(next?.revealed ?? false);
    }
  }, [currentIndex, questions.length, history]);

  const navigateTo = useCallback((index: number) => {
    setCurrentIndex(index);
    const entry = history[index];
    setRevealed(entry?.revealed ?? false);
  }, [history]);

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
    setRevealed(false);
    setStats({ knew: 0, missed: 0 });
    setHistory({});
    setUserAnswers({});
    try { localStorage.removeItem(storageKey); } catch {}
  }, [storageKey]);

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No quiz questions available for this specification point.
      </div>
    );
  }

  const prevEntry = history[currentIndex];
  const alreadyAssessed = !!prevEntry?.assessment;

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

          {/* Optional answer input — only before reveal */}
          {!alreadyAssessed && !revealed && (
            <div className="mt-4">
              <Textarea
                value={currentUserAnswer}
                onChange={(e) => handleAnswerChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer here (optional)..."
                className="resize-none text-sm"
                rows={3}
              />
            </div>
          )}

          {/* Already assessed — show result */}
          {alreadyAssessed && (
            <div className="mt-6 space-y-4">
              {currentUserAnswer.trim() && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Answer</h4>
                  <p className="text-sm leading-relaxed text-foreground/80">{currentUserAnswer}</p>
                </div>
              )}
              <div className="rounded-lg border border-border bg-muted/50 p-5">
                <h4 className="mb-1 font-serif text-sm font-semibold text-primary">Model Answer</h4>
                <p className="text-sm leading-relaxed text-foreground/80">{question.correct_answer}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-2 text-sm text-foreground/70">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <div className="space-y-0.5">
                    <p>Workpack: {question.level_3_feedback.workpack_ref}</p>
                    <p>Textbook: {question.level_3_feedback.textbook_ref}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                {prevEntry.assessment === "knew" ? (
                  <span className="flex items-center gap-1.5 text-primary">
                    <CheckCircle2 className="h-4 w-4" /> You knew this
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-destructive">
                    <XCircle className="h-4 w-4" /> You missed this
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Not yet revealed */}
          {!alreadyAssessed && !revealed && (
            <div className="mt-4">
              <Button onClick={handleReveal} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Eye className="mr-1.5 h-4 w-4" />
                Reveal Answer
              </Button>
            </div>
          )}

          {/* Revealed, awaiting self-assessment */}
          {!alreadyAssessed && revealed && (
            <div className="mt-6 animate-flip-in space-y-4">
              {currentUserAnswer.trim() && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Answer</h4>
                  <p className="text-sm leading-relaxed text-foreground/80">{currentUserAnswer}</p>
                </div>
              )}
              <div className="rounded-lg border-2 border-primary/30 bg-muted/50 p-5">
                <h4 className="mb-2 font-serif text-sm font-semibold uppercase tracking-wider text-primary">
                  Official Answer
                </h4>
                <p className="font-serif text-base leading-relaxed text-foreground">
                  {question.correct_answer}
                </p>
              </div>
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
                <Button onClick={() => handleSelfAssess(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  I got it
                </Button>
                <Button onClick={() => handleSelfAssess(false)} variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  <XCircle className="mr-1.5 h-4 w-4" />
                  I missed it
                </Button>
              </div>
            </div>
          )}

          {/* Navigation + Restart */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                onClick={() => navigateTo(currentIndex - 1)}
                disabled={currentIndex === 0}
                variant="outline"
                size="lg"
                className="min-h-[44px] min-w-[44px] gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <Button
                onClick={() => navigateTo(currentIndex + 1)}
                disabled={currentIndex >= questions.length - 1}
                variant="outline"
                size="lg"
                className="min-h-[44px] min-w-[44px] gap-1.5"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
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
