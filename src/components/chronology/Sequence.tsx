// =============================================================================
// Sequence — "Put these events in chronological order" (drag to reorder)
// =============================================================================
// Each question has 3-6 events with real dates. The UI shows them in a
// shuffled order; the student drags rows up and down (via @dnd-kit) until
// they're happy, then clicks "Check Order". Each row is marked ✅ or ❌ with
// the real date revealed next to every event.
//
// Sequences span at least a full time period (e.g. 1855-1894) and often the
// whole course (1855-1964) — the point is breadth, not "Sovnarkhozy vs
// Sputnik" level precision.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, GripVertical, RotateCw, X } from "lucide-react";
import type { ChronologyRow } from "@/hooks/useChronology";
import type { ChronologySequenceItem } from "@/hooks/useChronology";

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

interface OrderedItem extends ChronologySequenceItem {
  id: string; // stable @dnd-kit id for this row
}

interface SortableRowProps {
  item: OrderedItem;
  index: number;
  checked: boolean;
  expected: ChronologySequenceItem | null;
}

function SortableRow({ item, index, checked, expected }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: checked });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const isRight = expected ? item.event === expected.event : false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
        checked
          ? isRight
            ? "border-green-500 bg-green-50/60 dark:bg-green-950/30"
            : "border-red-500 bg-red-50/60 dark:bg-red-950/30"
          : isDragging
          ? "border-accent bg-card shadow-md"
          : "border-border bg-card hover:border-accent/60"
      }`}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-bold text-foreground">
        {index + 1}
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
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : isRight ? (
        <Check className="h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <X className="h-4 w-4 shrink-0 text-red-600" />
      )}
    </div>
  );
}

interface SequenceProps {
  questions: ChronologyRow[];
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const q = session[currentIndex];

  // Initialise `order` whenever the session or current question changes.
  // Using useEffect (not setState-during-render) keeps React happy in strict
  // mode and avoids the classic "updating state during render" warning.
  useEffect(() => {
    if (!q) {
      setOrder([]);
      return;
    }
    const shuffled = shuffle(q.sequence_data!).map((it, i) => ({
      ...it,
      id: `${currentIndex}-${i}-${it.event}`,
    }));
    setOrder(shuffled);
    setChecked(false);
  }, [currentIndex, q, version]);

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

  const handleDragEnd = (event: DragEndEvent) => {
    if (checked) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = order.findIndex((i) => i.id === active.id);
    const newIdx = order.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setOrder((items) => arrayMove(items, oldIdx, newIdx));
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
              : "Drag rows to reorder from earliest to latest, then Check Order."}
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={order.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {order.map((item, idx) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    index={idx}
                    checked={checked}
                    expected={correct ? correct[idx] : null}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

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
