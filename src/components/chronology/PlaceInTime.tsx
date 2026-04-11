// =============================================================================
// PlaceInTime — "Which period does X belong to?" 4-option multiple choice
// =============================================================================
// Fixed 4 options: Part 1 (1855–94), Part 2 (1894–1917), Part 3 (1917–41),
// Part 4 (1941–64). Tap the correct button and the question auto-advances
// after a short pause; tap wrong and the correct button turns green so the
// student sees the right answer before moving on.
//
// Session length defaults to 20 (capped by pool size). Final score screen
// offers "Go again" and "Back to Chronology".
// =============================================================================

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, X, RotateCw } from "lucide-react";
import type { ChronologyRow } from "@/hooks/useChronology";

const PART_LABELS: { id: number; name: string; dates: string }[] = [
  { id: 1, name: "Part 1", dates: "1855–1894" },
  { id: 2, name: "Part 2", dates: "1894–1917" },
  { id: 3, name: "Part 3", dates: "1917–1941" },
  { id: 4, name: "Part 4", dates: "1941–1964" },
];

const DEFAULT_SESSION_SIZE = 20;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface PlaceInTimeProps {
  questions: ChronologyRow[];
}

export function PlaceInTime({ questions }: PlaceInTimeProps) {
  const [version, setVersion] = useState(0);
  const session = useMemo(() => {
    return shuffle(questions.filter((q) => q.correct_part != null)).slice(
      0,
      DEFAULT_SESSION_SIZE
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, version]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  if (session.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center text-muted-foreground">
          No Place-in-Time questions available yet.
        </CardContent>
      </Card>
    );
  }

  const finished = currentIndex >= session.length;
  const q = session[currentIndex];

  const handlePick = (partId: number) => {
    if (picked != null) return;
    setPicked(partId);
    if (partId === q.correct_part) setCorrectCount((c) => c + 1);
    // Pause so student can see the feedback, then advance.
    window.setTimeout(
      () => {
        setPicked(null);
        setCurrentIndex((i) => i + 1);
      },
      partId === q.correct_part ? 900 : 1800
    );
  };

  const handleRestart = () => {
    setVersion((v) => v + 1);
    setCurrentIndex(0);
    setPicked(null);
    setCorrectCount(0);
  };

  if (finished) {
    const pct = Math.round((correctCount / session.length) * 100);
    return (
      <Card className="border-2 shadow-sm">
        <CardContent className="flex flex-col items-center gap-5 py-12 text-center">
          <div className="rounded-full bg-rose-500/10 p-4">
            <Check className="h-8 w-8 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <p className="font-serif text-2xl font-bold text-primary">
              {correctCount} / {session.length}
            </p>
            <p className="text-sm text-muted-foreground">{pct}% correct</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRestart} className="gap-1.5">
              <RotateCw className="h-4 w-4" />
              Go again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium">
          Question {currentIndex + 1} of {session.length}
        </span>
        <Progress
          value={((currentIndex + 1) / session.length) * 100}
          className="h-1.5 flex-1"
        />
        <span className="font-medium tabular-nums">{correctCount} ✓</span>
      </div>

      {/* Question */}
      <Card className="border-2 shadow-sm">
        <CardContent className="py-10 text-center sm:py-14">
          <p className="mx-auto max-w-xl font-serif text-xl font-semibold leading-snug text-primary sm:text-2xl">
            {q.question_text}
          </p>
          {q.hint_date && picked != null && (
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              {q.hint_date}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {PART_LABELS.map((p) => {
          const isPicked = picked === p.id;
          const isCorrect = picked != null && p.id === q.correct_part;
          const isWrong = isPicked && p.id !== q.correct_part;
          return (
            <button
              key={p.id}
              onClick={() => handlePick(p.id)}
              disabled={picked != null}
              className={`flex flex-col items-center gap-0.5 rounded-lg border-2 px-4 py-5 text-center transition-all ${
                isCorrect
                  ? "border-green-500 bg-green-50 dark:bg-green-950/40"
                  : isWrong
                  ? "border-red-500 bg-red-50 dark:bg-red-950/40"
                  : picked != null
                  ? "border-border bg-card opacity-60"
                  : "border-border bg-card hover:border-accent hover:-translate-y-0.5 hover:shadow-sm"
              } disabled:cursor-default`}
            >
              <span className="flex items-center gap-1.5 font-serif text-base font-bold text-primary">
                {p.name}
                {isCorrect && <Check className="h-4 w-4 text-green-600" />}
                {isWrong && <X className="h-4 w-4 text-red-600" />}
              </span>
              <span className="text-xs text-muted-foreground">{p.dates}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
