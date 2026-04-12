// =============================================================================
// TopicsPage — the swift topic chooser at /topics
// =============================================================================
// Four horizontal Part tabs at the top. Click a Part → the grid below swaps
// to that Part's six specs. Click a spec → /spec/:id. Two clicks from the
// home tab into any driller.
//
// Each Part has its own accent colour (rose → amber → emerald → indigo, left
// to right) which tints the tab and the grid's top border. Colour is present
// but soft — never flat fields.
//
// The active tab is remembered in localStorage so that coming back to
// /topics lands you where you were.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck, CircleDashed, CircleMinus } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import {
  useSpecPointSections,
  useSpecPoints,
  type SpecPoint,
} from "@/hooks/useRevisionData";
import { useHighScores } from "@/hooks/useHighScores";
import { useBlankRecalls } from "@/hooks/useBlankRecalls";
import { useWrongAnswers } from "@/hooks/useWrongAnswers";
import { useConfidence, type ConfidenceLevel } from "@/hooks/useConfidence";

const PART_STORAGE_KEY = "russia-topics-active-part";

const partAccents = [
  {
    // Part 1 — rose
    tab: "bg-rose-50 text-rose-900 ring-rose-200/70 dark:bg-rose-950/30 dark:text-rose-100 dark:ring-rose-800/40",
    tabInactive: "hover:bg-rose-50/60 dark:hover:bg-rose-950/20",
    accentBar: "bg-rose-500",
    dot: "bg-rose-500",
  },
  {
    // Part 2 — amber
    tab: "bg-amber-50 text-amber-900 ring-amber-200/70 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-800/40",
    tabInactive: "hover:bg-amber-50/60 dark:hover:bg-amber-950/20",
    accentBar: "bg-amber-500",
    dot: "bg-amber-500",
  },
  {
    // Part 3 — emerald
    tab: "bg-emerald-50 text-emerald-900 ring-emerald-200/70 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-800/40",
    tabInactive: "hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20",
    accentBar: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  {
    // Part 4 — indigo
    tab: "bg-indigo-50 text-indigo-900 ring-indigo-200/70 dark:bg-indigo-950/30 dark:text-indigo-100 dark:ring-indigo-800/40",
    tabInactive: "hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20",
    accentBar: "bg-indigo-500",
    dot: "bg-indigo-500",
  },
];

const TopicsPage = () => {
  const navigate = useNavigate();
  const sections = useSpecPointSections();
  const specPoints = useSpecPoints();
  const { scores } = useHighScores();
  const { missingCount } = useBlankRecalls();
  const { items: wrongAnswers } = useWrongAnswers();
  const { getConfidence, setSpecConfidence } = useConfidence();

  // Remember which Part was last active.
  const [activeIdx, setActiveIdx] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(PART_STORAGE_KEY);
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isNaN(n) ? 0 : Math.max(0, Math.min(3, n));
    } catch {
      return 0;
    }
  });

  // Once sections have loaded, clamp activeIdx in case the number of Parts
  // has changed (shouldn't happen, but safe).
  useEffect(() => {
    if (sections.length > 0 && activeIdx >= sections.length) {
      setActiveIdx(0);
    }
  }, [sections, activeIdx]);

  useEffect(() => {
    try {
      localStorage.setItem(PART_STORAGE_KEY, String(activeIdx));
    } catch {
      // ignored
    }
  }, [activeIdx]);

  const activeSection = sections[activeIdx];
  const activePoints: SpecPoint[] = activeSection?.points ?? [];
  const accent = partAccents[activeIdx] ?? partAccents[0];

  // Pretty label parts
  const partNumber = (title: string) =>
    title.match(/^Part (\d+)/)?.[1] ?? "";
  const partSubtitle = (title: string) =>
    title.replace(/^Part \d+\s*[-:]\s*/, "");

  return (
    <div>
      <SEOHead
        title="Topics | AQA 1H Russia Compass"
        description="Browse all 24 spec points for AQA 7042/1H: Tsarist and Communist Russia 1855–1964, grouped by Part."
        canonicalPath="/topics"
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Page header */}
        <header className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            AQA 7042 / 1H · All topics
          </div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-primary sm:text-3xl">
            Choose a topic
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a Part of the course, then pick a spec point to drill into.
          </p>
        </header>

        {/* Part tabs */}
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {sections.map((s, idx) => {
            const isActive = idx === activeIdx;
            const acc = partAccents[idx] ?? partAccents[0];
            return (
              <button
                key={s.title}
                onClick={() => setActiveIdx(idx)}
                aria-pressed={isActive}
                className={`flex flex-col items-start gap-1 rounded-xl px-4 py-3 text-left ring-1 transition-all ${
                  isActive
                    ? `${acc.tab} shadow-card`
                    : `bg-card text-muted-foreground ring-border/60 ${acc.tabInactive}`
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${acc.dot}`}
                    aria-hidden
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-widest">
                    Part {partNumber(s.title)}
                  </span>
                </div>
                <span
                  className={`font-serif text-sm font-semibold leading-tight sm:text-base ${
                    isActive ? "" : "text-foreground"
                  }`}
                >
                  {partSubtitle(s.title)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Accent bar + spec grid */}
        <div className={`mb-2 h-1 rounded-full ${accent.accentBar}`} />

        {activeSection && (
          <section>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activePoints.map((sp) => {
                const progress = scores[sp.id];
                const missing = missingCount(sp.id);
                const toReview = wrongAnswers.filter(
                  (w) => w.spec_id === sp.id
                ).length;
                const pct = progress?.highScore ?? 0;
                const started = !!progress || missing > 0;
                const conf = getConfidence(sp.id);

                // Untouched cards get a dashed border + lighter wash
                const cardStyle = started
                  ? "bg-card shadow-card ring-1 ring-border/60"
                  : "bg-card/60 shadow-none ring-1 ring-dashed ring-border/40";

                return (
                  <div key={sp.id} className={`group flex flex-col gap-3 rounded-xl p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover:ring-primary/30 ${cardStyle}`}>
                    <button
                      onClick={() => navigate(`/spec/${sp.id}`)}
                      className="flex items-start justify-between gap-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Spec {sp.id}
                        </div>
                        <h3 className="mt-1 font-serif text-base font-bold leading-snug text-primary">
                          {sp.title}
                        </h3>
                      </div>
                      <div className="shrink-0">
                        {started ? (
                          <CircleCheck className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <CircleDashed className="h-5 w-5 text-muted-foreground/30" />
                        )}
                      </div>
                    </button>

                    {/* Confidence toggle */}
                    <div className="flex items-center gap-1">
                      <span className="mr-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        I feel:
                      </span>
                      {(["none", "shaky", "confident"] as ConfidenceLevel[]).map(
                        (level) => (
                          <button
                            key={level}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSpecConfidence(sp.id, level);
                            }}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                              conf === level
                                ? level === "confident"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                  : level === "shaky"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                                    : "bg-muted text-muted-foreground"
                                : "text-muted-foreground/60 hover:bg-muted/60"
                            }`}
                          >
                            {level === "none" ? "?" : level === "shaky" ? "Shaky" : "Got it"}
                          </button>
                        )
                      )}
                    </div>

                    {/* Footer meta line */}
                    <div className="mt-auto flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {progress ? (
                          <span>Best {pct}%</span>
                        ) : (
                          <span className="italic">Not started</span>
                        )}
                        {missing > 0 && (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            {missing} recall gap{missing === 1 ? "" : "s"}
                          </span>
                        )}
                        {toReview > 0 && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                            {toReview} review
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => navigate(`/spec/${sp.id}`)}
                        className="text-[11px] font-semibold text-muted-foreground group-hover:text-primary"
                      >
                        Open →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <p className="mt-10 text-center text-[11px] text-muted-foreground">
          {specPoints.length} specification points · AQA 7042/1H ·
          1855 – 1964
        </p>
      </div>
    </div>
  );
};

export default TopicsPage;
