import { useState, useCallback, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useFactDrillerForSpec } from "@/hooks/useRevisionData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw, Zap, Eye, Trophy, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import type { FactDrillerQuestion } from "@/types/revision";

interface SpecificKnowledgeProps {
  specId: number;
  onScoreRecord?: (specId: number, correct: number, total: number) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = "quiz" | "report";
type Assessment = "correct" | "missed";

interface HistoryEntry {
  revealed: boolean;
  assessment?: Assessment;
}

interface MissedItem {
  question: string;
  answer: string;
}

export function SpecificKnowledge({ specId, onScoreRecord }: SpecificKnowledgeProps) {
  const allQuestions = useFactDrillerForSpec(specId);
  const storageKey = `sk-answers-${specId}`;
  const [questions, setQuestions] = useState<FactDrillerQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [missed, setMissed] = useState<MissedItem[]>([]);
  const [phase, setPhase] = useState<Phase>("quiz");
  const [isRetest, setIsRetest] = useState(false);
  const [history, setHistory] = useState<Record<number, HistoryEntry>>({});
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const currentUserAnswer = userAnswers[currentIndex] ?? "";

  // Persist answers to localStorage
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(userAnswers)); } catch {}
  }, [userAnswers, storageKey]);

  const handleAnswerChange = (value: string) => {
    setUserAnswers((prev) => ({ ...prev, [currentIndex]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleReveal();
    }
  };

  useEffect(() => {
    if (allQuestions.length > 0) {
      setQuestions(shuffle(allQuestions));
      setCurrentIndex(0);
      setRevealed(false);
      setCorrect(0);
      setMissed([]);
      setPhase("quiz");
      setIsRetest(false);
      setHistory({});
      setUserAnswers({});
    }
  }, [allQuestions]);

  useEffect(() => {
    if (phase === "report" && onScoreRecord && !isRetest) {
      onScoreRecord(specId, correct, questions.length);
    }
  }, [phase, onScoreRecord, specId, correct, questions.length, isRetest]);

  const question = questions[currentIndex];

  const handleReveal = () => setRevealed(true);

  const advanceTo = useCallback((index: number) => {
    setCurrentIndex(index);
    const entry = history[index];
    setRevealed(entry?.revealed ?? false);
  }, [history]);

  const handleSelfAssess = useCallback((gotIt: boolean) => {
    const q = questions[currentIndex];
    setHistory((prev) => ({
      ...prev,
      [currentIndex]: { revealed: true, assessment: gotIt ? "correct" : "missed" },
    }));
    if (gotIt) {
      setCorrect((p) => p + 1);
    } else {
      setMissed((p) => [...p, { question: q.question, answer: q.answer }]);
    }
    // Auto-advance
    if (currentIndex + 1 < questions.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      const next = history[nextIdx];
      setRevealed(next?.revealed ?? false);
    } else {
      setPhase("report");
    }
  }, [currentIndex, questions, history]);

  const handleRestart = () => {
    setQuestions(shuffle(allQuestions));
    setCurrentIndex(0);
    setRevealed(false);
    setCorrect(0);
    setMissed([]);
    setPhase("quiz");
    setIsRetest(false);
    setHistory({});
    setUserAnswers({});
    try { localStorage.removeItem(storageKey); } catch {}
  };

  const handleRetestWrong = () => {
    const missedQs = missed
      .map((m) => allQuestions.find((q) => q.question === m.question))
      .filter(Boolean) as FactDrillerQuestion[];
    setQuestions(shuffle(missedQs));
    setCurrentIndex(0);
    setRevealed(false);
    setCorrect(0);
    setMissed([]);
    setPhase("quiz");
    setIsRetest(true);
    setHistory({});
    setUserAnswers({});
    try { localStorage.removeItem(storageKey); } catch {}
  };

  if (allQuestions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No rapid-fire questions available for this specification point.
      </div>
    );
  }

  // --- REPORT PHASE ---
  if (phase === "report") {
    const total = questions.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="space-y-6">
        <h2 className="font-serif text-2xl font-bold text-primary">Revision Report</h2>
        <Card className="mx-auto max-w-2xl border-2 border-primary/20 shadow-lg">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-4">
              <Trophy className="h-8 w-8 text-accent" />
              <div>
                <p className="text-3xl font-bold text-foreground">{correct}/{total}</p>
                <p className="text-sm text-muted-foreground">{pct}% correct{isRetest ? " (re-test)" : ""}</p>
              </div>
            </div>
            {missed.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Focus List — {missed.length} question{missed.length > 1 ? "s" : ""} to review
                </div>
                <ul className="space-y-2">
                  {missed.map((m, i) => (
                    <li key={i} className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
                      <p className="font-medium text-foreground">{m.question}</p>
                      <p className="mt-1 text-muted-foreground">
                        <span className="font-semibold text-primary">Answer:</span> {m.answer}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {missed.length === 0 && (
              <p className="text-sm font-medium text-success">Perfect score — no questions to review!</p>
            )}
            <div className="flex flex-wrap gap-3">
              {missed.length > 0 && (
                <Button onClick={handleRetestWrong}>
                  <RotateCcw className="mr-1.5 h-4 w-4" /> Re-test Wrong Answers
                </Button>
              )}
              <Button onClick={handleRestart} variant="outline">
                <RotateCcw className="mr-1.5 h-4 w-4" /> Restart All
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- QUIZ PHASE ---
  if (!question) return null;

  const prevEntry = history[currentIndex];
  const alreadyAssessed = !!prevEntry?.assessment;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-bold text-primary">
            {isRetest ? "Re-test: Wrong Answers" : "Specific Knowledge"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Think of the answer, then reveal — honest self-assessment builds stronger recall.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> {correct}
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="h-3.5 w-3.5" /> {missed.length}
          </span>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Question {currentIndex + 1} of {questions.length}
      </div>

      <Card className="mx-auto max-w-2xl border-2 shadow-lg">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-6">
            <Zap className="mb-2 inline h-4 w-4 text-accent" />
            <p className="font-serif text-lg font-medium leading-relaxed text-foreground">
              {question.question}
            </p>
          </div>

          {/* Optional answer input — only before reveal */}
          {!alreadyAssessed && !revealed && (
            <div className="mb-4">
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
            <div className="space-y-4">
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
                  {question.answer}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                {prevEntry.assessment === "correct" ? (
                  <span className="flex items-center gap-1.5 text-success">
                    <CheckCircle2 className="h-4 w-4" /> You got this
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
            <div>
              <Button onClick={handleReveal} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Eye className="mr-1.5 h-4 w-4" />
                Reveal Answer
              </Button>
            </div>
          )}

          {/* Revealed, awaiting self-assessment */}
          {!alreadyAssessed && revealed && (
            <div className="animate-flip-in space-y-4">
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
                  {question.answer}
                </p>
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
                onClick={() => advanceTo(currentIndex - 1)}
                disabled={currentIndex === 0}
                variant="outline"
                size="lg"
                className="min-h-[44px] min-w-[44px] gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <Button
                onClick={() => advanceTo(currentIndex + 1)}
                disabled={currentIndex >= questions.length - 1}
                variant="outline"
                size="lg"
                className="min-h-[44px] min-w-[44px] gap-1.5"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={handleRestart} variant="ghost" size="sm">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restart
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
