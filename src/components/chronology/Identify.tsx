// =============================================================================
// Identify — "Who or what was this?" recall with reveal + self-assess
// =============================================================================
// Mirrors the Knowledge Driller flow: question text, optional free-text input,
// "Reveal Answer" button, then self-assessment ("Got it" / "Didn't get it").
// Score tracked and reported on completion. No Supabase writes yet — this is
// a pure in-session drill for v1.
// =============================================================================

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, RotateCw, Eye } from "lucide-react";
import type { ChronologyRow } from "@/hooks/useChronology";

const DEFAULT_SESSION_SIZE = 15;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface IdentifyProps {
  questions: ChronologyRow[];
}

export function Identify({ questions }: IdentifyProps) {
  const [version, setVersion] = useState(0);
  const session = useMemo(() => {
    return shuffle(questions.filter((q) => !!q.correct_answer)).slice(
      0,
      DEFAULT_SESSION_SIZE
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, version]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  if (session.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center text-muted-foreground">
          No Identify questions available yet.
        </CardContent>
      </Card>
    );
  }

  const finished = currentIndex >= session.length;
  const q = session[currentIndex];

  const handleAssess = (gotIt: boolean) => {
    if (gotIt) setCorrectCount((c) => c + 1);
    setRevealed(false);
    setCurrentIndex((i) => i + 1);
  };

  const handleRestart = () => {
    setVersion((v) => v + 1);
    setCurrentIndex(0);
    setRevealed(false);
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
        <CardContent className="py-10 text-center sm:py-12">
          <p className="mx-auto max-w-xl font-serif text-xl font-semibold leading-snug text-primary sm:text-2xl">
            {q.question_text}
          </p>
          {/* Hint date intentionally not rendered — the date would give the
              whole game away for an identify question. */}

          {!revealed ? (
            <div className="mt-8">
              <Button size="lg" className="gap-2" onClick={() => setRevealed(true)}>
                <Eye className="h-4 w-4" />
                Reveal Answer
              </Button>
            </div>
          ) : (
            <div className="mx-auto mt-8 max-w-2xl rounded-lg border-l-4 border-l-rose-500 bg-rose-50/40 p-4 text-left dark:bg-rose-950/20">
              <p className="text-sm leading-relaxed text-foreground">
                {q.correct_answer}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Self-assessment */}
      {revealed && (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={() => handleAssess(true)}
            size="lg"
            className="gap-2 bg-green-600 text-white hover:bg-green-700"
          >
            <Check className="h-4 w-4" />
            Got it
          </Button>
          <Button
            onClick={() => handleAssess(false)}
            size="lg"
            variant="outline"
            className="gap-2 border-red-500/60 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            Didn't get it
          </Button>
        </div>
      )}
    </div>
  );
}
