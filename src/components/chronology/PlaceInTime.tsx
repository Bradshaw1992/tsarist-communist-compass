// =============================================================================
// PlaceInTime — 4-option MCQ "What was X, and when?"
// =============================================================================
// Each question names a subject (a person, event, policy, or argument) and
// offers four descriptions as options. Three are plausibly wrong — they share
// a keyword with the subject but belong to a different period; one is both
// the correct identification AND implicitly locates the subject in the right
// time period. This tests knowledge + chronology in a single question.
//
// Example:
//   Q: What was the NEP?
//   A1: Lenin's more moderate policies from 1921, reacting to War Communism
//   A2: Stalin's industrialisation drive from 1928 built around Five Year Plans
//   A3: A name for Witte's economic reforms beginning in 1892
//   A4: A set of policies including grain requisitioning and forced labour
//
// Answers are shuffled per-question. Session defaults to 20 questions. Correct
// → auto-advance after 900ms; wrong → pause 2200ms so the student sees which
// option was right.
// =============================================================================

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, RotateCw, X } from "lucide-react";
import type { ChronologyRow } from "@/hooks/useChronology";

const DEFAULT_SESSION_SIZE = 20;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface SessionQuestion {
  id: string;
  question_text: string;
  options: string[]; // shuffled
  correctIndex: number; // index within shuffled options
}

function buildSessionQuestion(q: ChronologyRow): SessionQuestion | null {
  if (!q.options || q.correct_option_index == null) return null;
  const correctText = q.options[q.correct_option_index];
  const shuffled = shuffle(q.options);
  const correctIndex = shuffled.indexOf(correctText);
  return {
    id: q.id,
    question_text: q.question_text,
    options: shuffled,
    correctIndex,
  };
}

interface PlaceInTimeProps {
  questions: ChronologyRow[];
}

export function PlaceInTime({ questions }: PlaceInTimeProps) {
  const [version, setVersion] = useState(0);

  const session = useMemo<SessionQuestion[]>(() => {
    const valid = questions.filter(
      (q) =>
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.correct_option_index != null
    );
    return shuffle(valid)
      .slice(0, DEFAULT_SESSION_SIZE)
      .map(buildSessionQuestion)
      .filter((x): x is SessionQuestion => x != null);
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

  const handlePick = (optionIndex: number) => {
    if (picked != null) return;
    setPicked(optionIndex);
    const isRight = optionIndex === q.correctIndex;
    if (isRight) setCorrectCount((c) => c + 1);
    window.setTimeout(
      () => {
        setPicked(null);
        setCurrentIndex((i) => i + 1);
      },
      isRight ? 900 : 2200
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
          <Button onClick={handleRestart} className="gap-1.5">
            <RotateCw className="h-4 w-4" />
            Go again
          </Button>
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
        <CardContent className="py-8 text-center sm:py-10">
          <p className="mx-auto max-w-xl font-serif text-xl font-semibold leading-snug text-primary sm:text-2xl">
            {q.question_text}
          </p>
        </CardContent>
      </Card>

      {/* Options — stacked full-width because descriptions can be long */}
      <div className="flex flex-col gap-3">
        {q.options.map((opt, idx) => {
          const isPicked = picked === idx;
          const isCorrect = picked != null && idx === q.correctIndex;
          const isWrongPick = isPicked && idx !== q.correctIndex;
          return (
            <button
              key={idx}
              onClick={() => handlePick(idx)}
              disabled={picked != null}
              className={`flex items-start gap-3 rounded-lg border-2 px-4 py-4 text-left text-sm leading-relaxed transition-all sm:text-[15px] ${
                isCorrect
                  ? "border-green-500 bg-green-50 dark:bg-green-950/40"
                  : isWrongPick
                  ? "border-red-500 bg-red-50 dark:bg-red-950/40"
                  : picked != null
                  ? "border-border bg-card opacity-60"
                  : "border-border bg-card hover:border-accent hover:-translate-y-0.5 hover:shadow-sm"
              } disabled:cursor-default`}
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border bg-background font-serif text-[11px] font-bold text-primary">
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="flex-1 text-foreground">{opt}</span>
              {isCorrect && (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              )}
              {isWrongPick && (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
