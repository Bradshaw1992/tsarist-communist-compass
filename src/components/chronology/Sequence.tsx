// =============================================================================
// Sequence — "Put these events in chronological order"
// =============================================================================
// Each question has 3-6 events with real dates. The UI shows them in a
// shuffled order with up/down arrow buttons to reorder. When the student is
// happy they click "Check Order" and each row is marked ✅ (correct position)
// or ❌ (wrong position), with the real date revealed next to every event.
//
// Drag-to-reorder would be nicer but requires a DnD dependency we don't have
// yet. Arrow buttons are a pragmatic v1: accessible, mobile-friendly, no
// new packages. Each "question" = one sequence, so a session is typically
// 5 sequences to cover a decent spread of the course.
// =============================================================================

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowDown, ArrowUp, Check, RotateCw, X } from "lucide-react";
import type { ChronologyRow } from "@/hooks/useChronology";
import type { ChronologySequenceItem } from "@/integrations/supabase/types";

const DEFAULT_SESSION_SIZE = 5;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Parse the date string on a sequence item into a sortable numeric key.
 * Dates in the data are strings like "1861", "March 1917", "1917–18" etc.
 * We strip out the first 4-digit year and, optionally, a month name so
 * same-year events order by month when the data provides one.
 */
function sortKey(s: string): number {
  const yearMatch = s.match(/\d{4}/);
  const year = yearMatch ? parseInt(yearMatch[0], 10) : 0;
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  const lower = s.toLowerCase();
  const mIdx = months.findIndex((m) => lower.includes(m));
  const month = mIdx >= 0 ? mIdx + 1 : 0;
  return year * 100 + month;
}

function correctOrder(items: ChronologySequenceItem[]): ChronologySequenceItem[] {
  return [...items].sort((a, b) => sortKey(a.date) - sortKey(b.date));
}

interface SequenceProps {
  questions: ChronologyRow[];
}

interface OrderedItem extends ChronologySequenceItem {
  key: string;
}

export function Sequence({ questions }: SequenceProps) {
  const [version, setVersion] = useState(0);

  const session = useMemo(() => {
    const valid = questions.filter(
      (q) => Array.isArray(q.sequence_data) && q.sequence_data!.length >= 3
    );
    return shuffle(valid).slice(0, DEFAULT_SESSION_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, version]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [order, setOrder] = useState<OrderedItem[]>([]);
  const [checked, setChecked] = useState(false);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalPositions, setTotalPositions] = useState(0);

  // Lazily initialise order when the session/current question changes.
  const q = session[currentIndex];
  const needsInit =
    q && (order.length === 0 || order[0].key !== `${currentIndex}-0`);
  if (needsInit) {
    const shuffled = shuffle(q.sequence_data!).map((it, i) => ({
      ...it,
      key: `${currentIndex}-${i}`,
    }));
    setOrder(shuffled);
  }

  if (session.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center text-muted-foreground">
          No Sequence questions available yet.
        </CardContent>
      </Card>
    );
  }

  const finished = currentIndex >= session.length;

  if (finished) {
    const pct =
      totalPositions > 0
        ? Math.round((totalCorrect / totalPositions) * 100)
        : 0;
    return (
      <Card className="border-2 shadow-sm">
        <CardContent className="flex flex-col items-center gap-5 py-12 text-center">
          <div className="rounded-full bg-rose-500/10 p-4">
            <Check className="h-8 w-8 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <p className="font-serif text-2xl font-bold text-primary">
              {totalCorrect} / {totalPositions}
            </p>
            <p className="text-sm text-muted-foreground">
              {pct}% of positions correct
            </p>
          </div>
          <Button
            onClick={() => {
              setVersion((v) => v + 1);
              setCurrentIndex(0);
              setOrder([]);
              setChecked(false);
              setTotalCorrect(0);
              setTotalPositions(0);
            }}
            className="gap-1.5"
          >
            <RotateCw className="h-4 w-4" />
            Go again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const move = (from: number, to: number) => {
    if (checked) return;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    setOrder(next);
  };

  const handleCheck = () => {
    const correct = correctOrder(q.sequence_data!);
    let matches = 0;
    order.forEach((item, idx) => {
      if (item.event === correct[idx].event) matches += 1;
    });
    setTotalCorrect((t) => t + matches);
    setTotalPositions((t) => t + order.length);
    setChecked(true);
  };

  const handleNext = () => {
    setChecked(false);
    setOrder([]); // trigger re-init on next render
    setCurrentIndex((i) => i + 1);
  };

  const correct = checked ? correctOrder(q.sequence_data!) : null;

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium">
          Sequence {currentIndex + 1} of {session.length}
        </span>
        <Progress
          value={((currentIndex + 1) / session.length) * 100}
          className="h-1.5 flex-1"
        />
        <span className="font-medium tabular-nums">
          {totalCorrect}/{totalPositions || "—"}
        </span>
      </div>

      {/* Question */}
      <Card className="border-2 shadow-sm">
        <CardContent className="py-7">
          <h3 className="mb-1 font-serif text-base font-semibold text-primary sm:text-lg">
            {q.question_text}
          </h3>
          <p className="mb-5 text-xs text-muted-foreground">
            {checked
              ? "Here's how your order compared to the correct chronology."
              : "Use the arrows to reorder from earliest to latest, then Check Order."}
          </p>

          <div className="space-y-2">
            {order.map((item, idx) => {
              const expected = correct ? correct[idx] : null;
              const isRight = expected ? item.event === expected.event : false;
              return (
                <div
                  key={item.key}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                    checked
                      ? isRight
                        ? "border-green-500 bg-green-50/60 dark:bg-green-950/30"
                        : "border-red-500 bg-red-50/60 dark:bg-red-950/30"
                      : "border-border bg-card"
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-bold text-foreground">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{item.event}</p>
                    {checked && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {isRight
                          ? `✓ ${item.date}`
                          : `✗ actually ${item.date} — should be ${expected?.event} (${expected?.date})`}
                      </p>
                    )}
                  </div>
                  {!checked ? (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => move(idx, idx - 1)}
                        disabled={idx === 0}
                        className="rounded border border-border bg-background p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => move(idx, idx + 1)}
                        disabled={idx === order.length - 1}
                        className="rounded border border-border bg-background p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  ) : isRight ? (
                    <Check className="h-4 w-4 shrink-0 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 shrink-0 text-red-600" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-center">
            {!checked ? (
              <Button size="lg" onClick={handleCheck}>
                Check Order →
              </Button>
            ) : (
              <Button size="lg" onClick={handleNext}>
                {currentIndex + 1 >= session.length
                  ? "Finish"
                  : "Next sequence →"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
