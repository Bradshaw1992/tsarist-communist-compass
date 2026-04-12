// =============================================================================
// RandomPage — random picker + mixed practice sessions at /random
// =============================================================================
// Two modes:
//   1. Single pick — one random spec + one random activity. Previous / Next /
//      Go controls. Student can step back and forward through a history of
//      picks they've seen.
//   2. Mixed practice — student picks a Part (time period), gets a shuffled
//      session of concept + knowledge questions pulled from specs within that
//      Part. Interleaved across specs so the student practises connecting
//      topics within the same era.
//
// The user explicitly said: "I want them to be revising within the four time
// periods as the questions will always cover that time period." So mixed
// practice is scoped per-Part, not cross-course.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Dices,
  PenLine,
  RotateCcw,
  Shuffle,
  Zap,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import {
  useSpecPoints,
  useSpecPointSections,
  type SpecPoint,
} from "@/hooks/useRevisionData";

// ---- Single-pick types ------------------------------------------------------
type ActivityKey = "recall" | "concepts" | "facts";

interface Pick {
  specId: number;
  activity: ActivityKey;
}

interface ActivityMeta {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  blurb: string;
  accent: "emerald" | "purple" | "blue";
}

const ACTIVITY_META: Record<ActivityKey, ActivityMeta> = {
  recall: { name: "Blank Recall", icon: PenLine, blurb: "Write what you know — then see what you missed.", accent: "emerald" },
  concepts: { name: "Concept Driller", icon: Crosshair, blurb: "Significance, causation, the why behind the facts.", accent: "purple" },
  facts: { name: "Knowledge Driller", icon: Zap, blurb: "Rapid-fire recall of the sniper facts.", accent: "blue" },
};
const ACTIVITY_KEYS: ActivityKey[] = ["recall", "concepts", "facts"];

const accentSurface: Record<string, string> = {
  emerald: "bg-emerald-50 ring-emerald-200/70 dark:bg-emerald-950/30 dark:ring-emerald-800/40",
  purple: "bg-purple-50 ring-purple-200/70 dark:bg-purple-950/30 dark:ring-purple-800/40",
  blue: "bg-blue-50 ring-blue-200/70 dark:bg-blue-950/30 dark:ring-blue-800/40",
};
const accentIcon: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  purple: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
};
const accentButton: Record<string, string> = {
  emerald: "bg-emerald-600 hover:bg-emerald-700 text-white",
  purple: "bg-purple-600 hover:bg-purple-700 text-white",
  blue: "bg-blue-600 hover:bg-blue-700 text-white",
};

// ---- Part accents for mixed practice ----------------------------------------
const PART_ACCENTS = [
  { bg: "bg-rose-50 ring-rose-200/70", text: "text-rose-700", active: "bg-rose-100 ring-rose-300" },
  { bg: "bg-amber-50 ring-amber-200/70", text: "text-amber-700", active: "bg-amber-100 ring-amber-300" },
  { bg: "bg-emerald-50 ring-emerald-200/70", text: "text-emerald-700", active: "bg-emerald-100 ring-emerald-300" },
  { bg: "bg-indigo-50 ring-indigo-200/70", text: "text-indigo-700", active: "bg-indigo-100 ring-indigo-300" },
];

function rollPick(specPoints: SpecPoint[], avoid?: Pick): Pick {
  for (let i = 0; i < 10; i += 1) {
    const spec = specPoints[Math.floor(Math.random() * specPoints.length)];
    const activity = ACTIVITY_KEYS[Math.floor(Math.random() * ACTIVITY_KEYS.length)];
    if (!avoid || avoid.specId !== spec.id || avoid.activity !== activity) {
      return { specId: spec.id, activity };
    }
  }
  return { specId: specPoints[0].id, activity: "recall" };
}

// =============================================================================
type Mode = "single" | "mixed";

const RandomPage = () => {
  const navigate = useNavigate();
  const specPoints = useSpecPoints();
  const sections = useSpecPointSections();

  const [mode, setMode] = useState<Mode>("single");

  // ---- Single-pick state ----------------------------------------------------
  const [history, setHistory] = useState<Pick[]>([]);
  const [cursor, setCursor] = useState<number>(-1);

  useEffect(() => {
    if (specPoints.length === 0 || history.length > 0) return;
    setHistory([rollPick(specPoints)]);
    setCursor(0);
  }, [specPoints, history.length]);

  const currentPick = cursor >= 0 ? history[cursor] : null;
  const currentSpec = useMemo<SpecPoint | null>(() => {
    if (!currentPick) return null;
    return specPoints.find((sp) => sp.id === currentPick.specId) ?? null;
  }, [currentPick, specPoints]);
  const meta = currentPick ? ACTIVITY_META[currentPick.activity] : null;
  const Icon = meta?.icon ?? Dices;
  const accent = meta?.accent ?? "emerald";

  const handleNext = () => {
    if (cursor < history.length - 1) { setCursor(cursor + 1); return; }
    const fresh = rollPick(specPoints, currentPick ?? undefined);
    setHistory((prev) => [...prev, fresh]);
    setCursor((c) => c + 1);
  };
  const handlePrev = () => { if (cursor > 0) setCursor(cursor - 1); };
  const handleReset = () => { setHistory([rollPick(specPoints)]); setCursor(0); };
  const handleGo = () => { if (currentPick) navigate(`/spec/${currentPick.specId}/${currentPick.activity}`); };

  // ---- Mixed-practice state -------------------------------------------------
  // null = not selected, -1 = all parts, 0-3 = specific part
  const [mixedPartIdx, setMixedPartIdx] = useState<number | null>(null);

  const handleStartMixed = useCallback(
    (partIdx: number) => {
      let pool: SpecPoint[];
      if (partIdx === -1) {
        // All parts
        pool = specPoints;
      } else {
        const section = sections[partIdx];
        if (!section) return;
        pool = section.points;
      }
      if (pool.length === 0) return;
      const randomSpec = pool[Math.floor(Math.random() * pool.length)];
      const randomActivity: ActivityKey = Math.random() > 0.5 ? "concepts" : "facts";
      navigate(`/spec/${randomSpec.id}/${randomActivity}`);
    },
    [sections, specPoints, navigate]
  );

  return (
    <div>
      <SEOHead
        title="Random practice | AQA 1H Russia Compass"
        description="A random spec point and activity, or a mixed practice session within a time period."
        canonicalPath="/random"
      />

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Random practice
          </div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-primary sm:text-3xl">
            Can't decide where to start?
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a single random activity, or start a mixed practice session
            within a time period.
          </p>
        </header>

        {/* Mode toggle */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setMode("single")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === "single"
                ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Dices className="h-4 w-4" />
            Single pick
          </button>
          <button
            onClick={() => setMode("mixed")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === "mixed"
                ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Shuffle className="h-4 w-4" />
            Mixed practice
          </button>
        </div>

        {/* ============================================================
            Single pick
            ============================================================ */}
        {mode === "single" && (
          <>
            <div
              className={`rounded-2xl p-6 shadow-card ring-1 transition-colors sm:p-8 ${
                meta ? accentSurface[accent] : "bg-card ring-border/60"
              }`}
            >
              {currentPick && currentSpec && meta ? (
                <div className="flex flex-col items-center text-center">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${accentIcon[accent]}`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {meta.name} · Spec {currentSpec.id}
                  </div>
                  <h2 className="mt-2 font-serif text-2xl font-bold leading-tight text-primary sm:text-3xl">
                    {currentSpec.title}
                  </h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">{meta.blurb}</p>
                  <div className="mt-3 text-[11px] text-muted-foreground">{currentSpec.section}</div>
                  <Button
                    size="lg"
                    onClick={handleGo}
                    className={`mt-6 h-12 px-8 text-base font-semibold ${accentButton[accent]}`}
                  >
                    Let's go →
                  </Button>
                </div>
              ) : (
                <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
                  Rolling the dice…
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <Button variant="outline" onClick={handlePrev} disabled={cursor <= 0} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Previous
              </Button>
              <Button variant="ghost" onClick={handleReset} className="gap-1.5 text-muted-foreground" title="Start fresh">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
              <Button variant="outline" onClick={handleNext} disabled={specPoints.length === 0} className="gap-1.5">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {history.length > 1 && (
              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                Pick {cursor + 1} of {history.length}
              </p>
            )}
          </>
        )}

        {/* ============================================================
            Mixed practice — pick a Part, then jump into interleaved drill
            ============================================================ */}
        {mode === "mixed" && (
          <div>
            <p className="mb-4 text-sm text-muted-foreground">
              Pick a time period. You'll get a mix of concept and knowledge
              questions drawn from across that Part of the course.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* All Parts option */}
              <button
                onClick={() => setMixedPartIdx(-1)}
                className={`flex flex-col items-start gap-2 rounded-xl p-4 text-left ring-1 transition-all sm:col-span-2 ${
                  mixedPartIdx === -1
                    ? "bg-primary/10 ring-primary/30"
                    : "bg-card ring-border/60 hover:shadow-card"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Shuffle className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    All Parts
                  </span>
                </div>
                <span className="font-serif text-base font-bold text-primary">
                  Across the whole course
                </span>
                <span className="text-xs text-muted-foreground">
                  {specPoints.length} spec points · 1855–1964 · Concept &amp; Knowledge questions
                </span>
              </button>

              {sections.map((s, idx) => {
                const accent = PART_ACCENTS[idx] ?? PART_ACCENTS[0];
                const partNum = s.title.match(/^Part (\d+)/)?.[1] ?? "";
                const partLabel = s.title.replace(/^Part \d+\s*[-:]\s*/, "");
                const isSelected = mixedPartIdx === idx;
                return (
                  <button
                    key={s.title}
                    onClick={() => setMixedPartIdx(idx)}
                    className={`flex flex-col items-start gap-2 rounded-xl p-4 text-left ring-1 transition-all ${
                      isSelected ? accent.active : `${accent.bg} hover:shadow-card`
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Part {partNum}
                      </span>
                    </div>
                    <span className={`font-serif text-base font-bold ${accent.text}`}>
                      {partLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.points.length} spec points · Concept &amp; Knowledge questions
                    </span>
                  </button>
                );
              })}
            </div>

            {mixedPartIdx != null && (
              <div className="mt-6 text-center">
                <Button
                  size="lg"
                  onClick={() => handleStartMixed(mixedPartIdx)}
                  className="h-12 px-8 text-base font-semibold"
                >
                  <Shuffle className="mr-2 h-5 w-5" />
                  {mixedPartIdx === -1
                    ? "Start mixed session — All Parts"
                    : `Start mixed session — Part ${mixedPartIdx + 1}`}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">
                  {mixedPartIdx === -1
                    ? "Picks a random spec from across the whole course and drops you into a concept or knowledge drill."
                    : `Picks a random spec from Part ${mixedPartIdx + 1} and drops you into a concept or knowledge drill.`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RandomPage;
