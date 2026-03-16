import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useFactDrillerForSpec } from "@/hooks/useRevisionData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, RotateCcw, Zap, ArrowRight, Trophy, AlertTriangle } from "lucide-react";
import { fuzzyCheckAnswer } from "@/lib/fuzzyMatcher";
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

interface MissedItem {
  question: string;
  answer: string;
}

export function SpecificKnowledge({ specId, onScoreRecord }: SpecificKnowledgeProps) {
  const allQuestions = useFactDrillerForSpec(specId);
  const [questions, setQuestions] = useState<FactDrillerQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [correct, setCorrect] = useState(0);
  const [missed, setMissed] = useState<MissedItem[]>([]);
  const [phase, setPhase] = useState<Phase>("quiz");
  const [isRetest, setIsRetest] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Shuffle on mount or specId change
  useEffect(() => {
    if (allQuestions.length > 0) {
      setQuestions(shuffle(allQuestions));
      setCurrentIndex(0);
      setUserInput("");
      setStatus("idle");
      setCorrect(0);
      setMissed([]);
      setPhase("quiz");
      setIsRetest(false);
    }
  }, [allQuestions]);

  // Record score when report phase is reached
  useEffect(() => {
    if (phase === "report" && onScoreRecord && !isRetest) {
      onScoreRecord(specId, correct, questions.length);
    }
  }, [phase, onScoreRecord, specId, correct, questions.length, isRetest]);

  const question = questions[currentIndex];

  const goNext = useCallback(() => {
    if (currentIndex + 1 >= questions.length) {
      setPhase("report");
      // Record score — correct count is current value; for the last question we check status
      // This is called after the answer is processed, so correct/missed are up to date
      return;
    }
    setCurrentIndex((p) => p + 1);
    setUserInput("");
    setStatus("idle");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [currentIndex, questions.length]);

  const handleSubmit = useCallback(() => {
    if (status !== "idle" || !userInput.trim() || !question) return;
    const isCorrect = fuzzyCheckAnswer(userInput, question.valid_synonyms);
    setStatus(isCorrect ? "correct" : "wrong");
    if (isCorrect) {
      setCorrect((p) => p + 1);
      setTimeout(goNext, 800);
    } else {
      setMissed((p) => [...p, { question: question.question, answer: question.answer }]);
    }
  }, [userInput, question, status, goNext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (status === "wrong") goNext();
      else handleSubmit();
    }
  };

  const handleRestart = () => {
    setQuestions(shuffle(allQuestions));
    setCurrentIndex(0);
    setUserInput("");
    setStatus("idle");
    setCorrect(0);
    setMissed([]);
    setPhase("quiz");
    setIsRetest(false);
  };

  const handleRetestWrong = () => {
    // Build new round from missed questions, find matching FactDrillerQuestions
    const missedQs = missed
      .map((m) => allQuestions.find((q) => q.question === m.question))
      .filter(Boolean) as FactDrillerQuestion[];
    setQuestions(shuffle(missedQs));
    setCurrentIndex(0);
    setUserInput("");
    setStatus("idle");
    setCorrect(0);
    setMissed([]);
    setPhase("quiz");
    setIsRetest(true);
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
            {/* Score */}
            <div className="flex items-center gap-4">
              <Trophy className="h-8 w-8 text-accent" />
              <div>
                <p className="text-3xl font-bold text-foreground">{correct}/{total}</p>
                <p className="text-sm text-muted-foreground">{pct}% correct{isRetest ? " (re-test)" : ""}</p>
              </div>
            </div>

            {/* Missed list */}
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

            {/* Actions */}
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

  const borderClass =
    status === "correct" ? "border-success" : status === "wrong" ? "border-destructive" : "border-border";
  const inputClass =
    status === "correct"
      ? "border-success bg-success/10 text-success"
      : status === "wrong"
        ? "border-destructive bg-destructive/10 text-destructive"
        : "";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-bold text-primary">
            {isRetest ? "Re-test: Wrong Answers" : "Specific Knowledge"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Rapid-fire recall — type the answer and hit Enter.
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

      <Card className={`mx-auto max-w-2xl border-2 shadow-lg transition-colors ${borderClass}`}>
        <CardContent className="p-6 sm:p-8">
          <div className="mb-6">
            <Zap className="mb-2 inline h-4 w-4 text-accent" />
            <p className="font-serif text-lg font-medium leading-relaxed text-foreground">
              {question.question}
            </p>
          </div>

          <div className="space-y-3">
            <Input
              ref={inputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer…"
              disabled={status !== "idle"}
              className={`text-base ${inputClass}`}
              autoFocus
            />

            {status === "idle" && (
              <Button onClick={handleSubmit} disabled={!userInput.trim()}>
                Check
              </Button>
            )}

            {status === "correct" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" /> Correct!
                </div>
                <div className="rounded-lg border border-border bg-muted/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Official Answer
                  </p>
                  <p className="mt-1 font-serif text-sm leading-relaxed text-foreground">
                    {question.answer}
                  </p>
                </div>
              </div>
            )}

            {status === "wrong" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Correct Answer
                  </p>
                  <p className="mt-1 font-serif text-sm leading-relaxed text-foreground">
                    {question.answer}
                  </p>
                </div>
                <Button onClick={goNext}>
                  <ArrowRight className="mr-1.5 h-4 w-4" /> Next
                </Button>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={handleRestart} variant="ghost" size="sm">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restart
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
