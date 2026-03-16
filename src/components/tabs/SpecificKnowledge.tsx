import { useState, useMemo, useCallback, useRef } from "react";
import { useFactDrillerForSpec } from "@/hooks/useRevisionData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, RotateCcw, Zap, ArrowRight } from "lucide-react";

interface SpecificKnowledgeProps {
  specId: number;
}

function checkAnswer(input: string, synonyms: string[]): boolean {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return false;
  return synonyms.some((s) => trimmed === s.toLowerCase() || trimmed.includes(s.toLowerCase()) || s.toLowerCase().includes(trimmed));
}

export function SpecificKnowledge({ specId }: SpecificKnowledgeProps) {
  const allQuestions = useFactDrillerForSpec(specId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const question = useMemo(() => allQuestions[currentIndex], [allQuestions, currentIndex]);

  const handleSubmit = useCallback(() => {
    if (status !== "idle" || !userInput.trim()) return;
    const isCorrect = checkAnswer(userInput, question.valid_synonyms);
    setStatus(isCorrect ? "correct" : "wrong");
    setStats((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
    }));
    if (isCorrect) {
      setTimeout(() => {
        goNext();
      }, 800);
    }
  }, [userInput, question, status]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % allQuestions.length);
    setUserInput("");
    setStatus("idle");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [allQuestions.length]);

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
    setUserInput("");
    setStatus("idle");
    setStats({ correct: 0, wrong: 0 });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (status === "wrong") {
        goNext();
      } else {
        handleSubmit();
      }
    }
  };

  if (allQuestions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No rapid-fire questions available for this specification point.
      </div>
    );
  }

  const borderClass =
    status === "correct"
      ? "border-success"
      : status === "wrong"
        ? "border-destructive"
        : "border-border";

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
          <h2 className="font-serif text-2xl font-bold text-primary">Specific Knowledge</h2>
          <p className="text-sm text-muted-foreground">
            Rapid-fire recall — type the answer and hit Enter.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> {stats.correct}
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="h-3.5 w-3.5" /> {stats.wrong}
          </span>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Question {currentIndex + 1} of {allQuestions.length}
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
              <Button
                onClick={handleSubmit}
                disabled={!userInput.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Check
              </Button>
            )}

            {status === "correct" && (
              <div className="flex items-center gap-2 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" /> Correct!
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
                <Button onClick={goNext} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <ArrowRight className="mr-1.5 h-4 w-4" /> Next
                </Button>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={handleReset} variant="ghost" size="sm">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restart
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
