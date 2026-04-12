// =============================================================================
// Index / Dashboard — the home screen at /
// =============================================================================
// A rich personal landing page for signed-in students. Sections:
//
//   1. Greeting + next-best-action nudge
//   2. Continue (open blank recall) + Review queue — side by side
//   3. Quick-launch trio (one per activity type, targeting weakest/untouched)
//   4. Part progress strips (4 rows, one per course Part)
//   5. Coverage grid (24 dots) + Weakest topics — side by side
//   6. Chronology mini-card
//   7. Recent activity stream (unified: drillers + blank recalls)
//   8. This-week-at-a-glance one-liner
//
// For anonymous visitors: a friendly welcome with a sign-in invitation and
// three entry cards (Topics / General / Random).
//
// Light-and-airy visual language: warm cream page, pure white cards, soft
// shadows, pale accent washes, serif headings.
// =============================================================================

import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  Compass,
  Crosshair,
  Dices,
  LogIn,
  PenLine,
  Sparkles,
  Zap,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSpecPoints,
  useSpecPoint,
  useSpecPointSections,
  type SpecPoint,
} from "@/hooks/useRevisionData";
import { useHighScores, type TopicProgress } from "@/hooks/useHighScores";
import { useWrongAnswers } from "@/hooks/useWrongAnswers";
import { useBlankRecalls } from "@/hooks/useBlankRecalls";
import { useConfidence, type ConfidenceLevel } from "@/hooks/useConfidence";
import { useRecentSessions, type RecentSession } from "@/hooks/useRecentSessions";
import { useChronologyStats } from "@/hooks/useChronology";
import { FirstLoginWelcome } from "@/components/FirstLoginWelcome";

// ---- Accent palettes per Part -----------------------------------------------
const PART_ACCENTS = [
  { bg: "bg-rose-50", bar: "bg-rose-500", text: "text-rose-700 dark:text-rose-300", ring: "ring-rose-200/70 dark:ring-rose-800/40" },
  { bg: "bg-amber-50", bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", ring: "ring-amber-200/70 dark:ring-amber-800/40" },
  { bg: "bg-emerald-50", bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-200/70 dark:ring-emerald-800/40" },
  { bg: "bg-indigo-50", bar: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-300", ring: "ring-indigo-200/70 dark:ring-indigo-800/40" },
];

// ---- Activity type display metadata -----------------------------------------
const ACTIVITY_DISPLAY: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  knowledge_driller: { label: "Knowledge", icon: Zap, color: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  concept_driller: { label: "Concept", icon: Crosshair, color: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" },
  blank_recall: { label: "Blank Recall", icon: PenLine, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
};

// =============================================================================
// Component
// =============================================================================
const Index = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const specPoints = useSpecPoints();
  const sections = useSpecPointSections();
  const { scores } = useHighScores();
  const { items: wrongAnswers, dueToday, dueCount, oldestDueAge } = useWrongAnswers();
  const { continueCandidate, openLoops, missingCount } = useBlankRecalls();
  const { confidence, getConfidence } = useConfidence();
  const { sessions: recentSessions, thisWeek } = useRecentSessions(8);
  const chronoStats = useChronologyStats();

  const continueSpec = useSpecPoint(continueCandidate?.spec_id);

  const firstName = useMemo(() => {
    const name = profile?.display_name || profile?.full_name || user?.email || "";
    if (!name) return "";
    if (name.includes("@")) return name.split("@")[0];
    return name.split(/\s+/)[0];
  }, [profile, user]);

  // ---- Computed data for Dashboard sections --------------------------------

  // Part-level aggregates
  const partStats = useMemo(() => {
    return sections.map((s, idx) => {
      const specs = s.points;
      const touched = specs.filter((sp) => !!scores[sp.id]).length;
      const avg =
        touched > 0
          ? Math.round(
              specs.reduce((acc, sp) => acc + (scores[sp.id]?.highScore ?? 0), 0) /
                specs.length
            )
          : 0;
      const loops = specs.filter(
        (sp) => openLoops.some((ol) => ol.spec_id === sp.id)
      ).length;
      return { section: s, idx, touched, total: specs.length, avg, loops };
    });
  }, [sections, scores, openLoops]);

  // Quick-launch targets: pick one weakest/untouched spec per activity type
  const quickLaunch = useMemo(() => {
    // Sort specs by high score ascending (untouched = 0).
    const sorted = [...specPoints].sort(
      (a, b) => (scores[a.id]?.highScore ?? 0) - (scores[b.id]?.highScore ?? 0)
    );
    const pick = (offset: number) => sorted[offset % sorted.length];
    return [
      { activity: "recall", spec: pick(0), ...ACTIVITY_DISPLAY.blank_recall },
      { activity: "concepts", spec: pick(1), ...ACTIVITY_DISPLAY.concept_driller },
      { activity: "facts", spec: pick(2), ...ACTIVITY_DISPLAY.knowledge_driller },
    ];
  }, [specPoints, scores]);

  // Weakest 3 specs (that have been attempted)
  const weakest = useMemo<(SpecPoint & { pct: number })[]>(() => {
    return specPoints
      .filter((sp) => !!scores[sp.id])
      .map((sp) => ({ ...sp, pct: scores[sp.id].highScore }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3);
  }, [specPoints, scores]);

  // Coverage grid: 24 dots ordered by spec.id, grouped by part
  const coverageDots = useMemo(() => {
    return sections.map((s, idx) => ({
      partIdx: idx,
      specs: s.points.map((sp) => {
        const score = scores[sp.id]?.highScore ?? 0;
        const conf = getConfidence(sp.id);
        let status: "untouched" | "drilled" | "strong" = "untouched";
        if (score >= 70 || conf === "confident") status = "strong";
        else if (score > 0 || conf === "shaky") status = "drilled";
        return { id: sp.id, title: sp.title, status, score };
      }),
    }));
  }, [sections, scores, getConfidence]);

  // Next-best-action: a single, prioritised rule-based nudge
  const nextAction = useMemo<{
    text: string;
    action: string;
    to: string;
  } | null>(() => {
    // 1. Overdue review items
    if (dueCount > 0) {
      return {
        text: `${dueCount} question${dueCount === 1 ? "" : "s"} due for review${
          oldestDueAge ? ` — oldest: ${oldestDueAge}d ago` : ""
        }`,
        action: "Review now",
        to: "/review",
      };
    }
    // 2. Open blank recall loop
    if (continueSpec && continueCandidate) {
      const m = missingCount(continueSpec.id);
      return {
        text: `${m} concept${m === 1 ? "" : "s"} still uncovered on Spec ${continueSpec.id} — ${continueSpec.title}`,
        action: "Continue recall",
        to: `/spec/${continueSpec.id}/recall`,
      };
    }
    // 3. Untouched specs
    const untouched = specPoints.filter((sp) => !scores[sp.id]);
    if (untouched.length > 0) {
      const pick = untouched[0];
      return {
        text: `You haven't tried Spec ${pick.id} — ${pick.title}`,
        action: "Start it",
        to: `/spec/${pick.id}`,
      };
    }
    // 4. Weakest spec
    if (weakest.length > 0 && weakest[0].pct < 70) {
      const w = weakest[0];
      return {
        text: `Spec ${w.id} is your weakest at ${w.pct}% — another drill?`,
        action: "Drill it",
        to: `/spec/${w.id}`,
      };
    }
    // 5. Chronology
    if (chronoStats.total > 0) {
      return {
        text: "All topics drilled! Try a chronology warm-up across the whole course.",
        action: "General &amp; Chronology",
        to: "/general",
      };
    }
    return null;
  }, [
    dueCount,
    oldestDueAge,
    continueSpec,
    continueCandidate,
    missingCount,
    specPoints,
    scores,
    weakest,
    chronoStats,
  ]);

  // ==========================================================================
  // ANONYMOUS LANDING
  // ==========================================================================
  if (!user) {
    return (
      <div>
        <SEOHead
          title="AQA 1H Russia Compass | Tsarist & Communist Russia Revision"
          description="A-Level History revision for AQA 7042/1H: Tsarist and Communist Russia 1855–1964."
          canonicalPath="/"
        />
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <header className="mb-10 text-center">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              AQA 7042 / 1H
            </div>
            <h1 className="font-serif text-3xl font-bold leading-tight text-primary sm:text-4xl">
              Tsarist &amp; Communist Russia
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
              Revise the whole course — 1855 to 1964 — through blank recall,
              concept drilling, knowledge drilling, and past-paper essays.
            </p>
          </header>

          {/* Sign in invitation */}
          <div className="mb-10 rounded-xl bg-primary/5 p-6 sm:p-8">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <LogIn className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold text-primary">
                    Sign in to track your progress
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Your recall scores, review queue and session history stay
                    with you across devices.
                  </p>
                </div>
              </div>
              <Button asChild className="shrink-0">
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </div>

          {/* What is this app? — onboarding for first-timers */}
          <div className="mb-8 rounded-xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <h2 className="mb-3 font-serif text-lg font-bold text-primary">
              What is this app?
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Five ways to revise the AQA 1H Russia course:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span><strong className="text-foreground">Blank Recall</strong> — write everything you know about a topic, then see what you missed. The most effective revision technique for essay-based exams.</span>
              </li>
              <li className="flex items-start gap-2">
                <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
                <span><strong className="text-foreground">Concept Driller</strong> — significance, causation, and the "why" behind the facts. AO1 thinking, not just recall.</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span><strong className="text-foreground">Knowledge Driller</strong> — rapid-fire factual recall. Names, dates, policies, statistics.</span>
              </li>
              <li className="flex items-start gap-2">
                <Compass className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span><strong className="text-foreground">General &amp; Chronology</strong> — whole-course questions spanning all four Parts. Place events in time, identify key figures, sequence pivotal moments.</span>
              </li>
              <li className="flex items-start gap-2">
                <Dices className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                <span><strong className="text-foreground">Random</strong> — can't decide? Let the app pick for you.</span>
              </li>
            </ul>
          </div>

          {/* Entry cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <EntryCard to="/topics" icon={BookOpen} title="Browse topics" desc="Four Parts, 24 spec points." accent="emerald" />
            <EntryCard to="/general" icon={Compass} title="General &amp; chronology" desc="Whole-course questions." accent="rose" />
            <EntryCard to="/random" icon={Dices} title="Random practice" desc="Stop stalling, start drilling." accent="indigo" />
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SIGNED-IN DASHBOARD
  // ==========================================================================
  return (
    <div>
      <SEOHead
        title="Dashboard | AQA 1H Russia Compass"
        description="Your personal revision dashboard for AQA 7042/1H."
        canonicalPath="/"
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {/* First-login orientation (shown once, then dismissed) */}
        <FirstLoginWelcome />

        {/* ================================================================
            1. Greeting + next-best-action
            ================================================================ */}
        <header className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            AQA 7042 / 1H · Dashboard
          </div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-primary sm:text-3xl">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h1>
        </header>

        {nextAction && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl bg-primary/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-accent" />
              <p
                className="text-sm font-medium text-foreground"
                dangerouslySetInnerHTML={{ __html: nextAction.text }}
              />
            </div>
            <Button
              size="sm"
              onClick={() => navigate(nextAction.to)}
              className="shrink-0"
              dangerouslySetInnerHTML={{ __html: nextAction.action }}
            />
          </div>
        )}

        {/* ================================================================
            2. Continue + Review queue — side by side
            ================================================================ */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {/* Continue */}
          {continueSpec && continueCandidate ? (
            <div className="rounded-xl bg-emerald-50 p-5 ring-1 ring-emerald-200/70 dark:bg-emerald-950/30 dark:ring-emerald-800/40">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700/80 dark:text-emerald-300/80">
                Pick up where you left off
              </div>
              <h3 className="mt-1 font-serif text-base font-bold text-emerald-900 dark:text-emerald-100">
                Blank Recall · Spec {continueSpec.id}
              </h3>
              <p className="mt-0.5 text-xs text-emerald-900/80 dark:text-emerald-100/80">
                {continueSpec.title} · {missingCount(continueSpec.id)} concept
                {missingCount(continueSpec.id) === 1 ? "" : "s"} still to drill
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate(`/spec/${continueSpec.id}/recall`)}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Continue
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/spec/${continueSpec.id}`)}
                >
                  Topic page
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-card p-5 shadow-card ring-1 ring-border/60">
              <PenLine className="h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-foreground">No open recall loops</p>
                <p className="text-xs text-muted-foreground">
                  Start a Blank Recall from any topic to create one.
                </p>
              </div>
            </div>
          )}

          {/* Review queue */}
          {wrongAnswers.length > 0 ? (
            <div className="rounded-xl bg-amber-50/80 p-5 ring-1 ring-amber-200/70 dark:bg-amber-950/30 dark:ring-amber-800/40">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-700/80 dark:text-amber-300/80">
                Review queue
              </div>
              <h3 className="mt-1 font-serif text-base font-bold text-amber-900 dark:text-amber-100">
                {wrongAnswers.length} wrong answer
                {wrongAnswers.length === 1 ? "" : "s"}
                {dueCount > 0 ? ` · ${dueCount} due today` : ""}
              </h3>
              {oldestDueAge != null && (
                <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-200/80">
                  Oldest: missed {oldestDueAge} day{oldestDueAge === 1 ? "" : "s"} ago
                </p>
              )}
              <Button
                size="sm"
                onClick={() => navigate("/review")}
                className="mt-3 bg-amber-600 text-white hover:bg-amber-700"
              >
                Review now
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-card p-5 shadow-card ring-1 ring-border/60">
              <Sparkles className="h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-foreground">Review queue clear</p>
                <p className="text-xs text-muted-foreground">
                  No wrong answers to review. Keep it up.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================
            3. Quick-launch trio
            ================================================================ */}
        {specPoints.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Jump in — picked from your weakest
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {quickLaunch.map((ql) => {
                const Ic = ql.icon;
                return (
                  <button
                    key={ql.activity}
                    onClick={() => navigate(`/spec/${ql.spec.id}/${ql.activity}`)}
                    className="group flex items-center gap-3 rounded-xl bg-card p-4 text-left shadow-card ring-1 ring-border/60 transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover:ring-primary/30"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ql.color}`}>
                      <Ic className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {ql.label}
                      </p>
                      <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                        Spec {ql.spec.id} · {ql.spec.title}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ================================================================
            4. Part progress strips
            ================================================================ */}
        {partStats.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Progress by Part
            </h2>
            <div className="space-y-2">
              {partStats.map((ps) => {
                const accent = PART_ACCENTS[ps.idx] ?? PART_ACCENTS[0];
                const partNum = ps.section.title.match(/^Part (\d+)/)?.[1] ?? "";
                const partLabel = ps.section.title.replace(/^Part \d+\s*[-:]\s*/, "");
                const pct = ps.total > 0 ? Math.round((ps.touched / ps.total) * 100) : 0;
                return (
                  <button
                    key={ps.section.title}
                    onClick={() => {
                      try { localStorage.setItem("russia-topics-active-part", String(ps.idx)); } catch {}
                      navigate("/topics");
                    }}
                    className={`group flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 transition-all hover:shadow-card ${accent.bg} ${accent.ring} dark:bg-opacity-30`}
                  >
                    <span className={`h-full w-1 shrink-0 self-stretch rounded-full ${accent.bar}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Part {partNum}
                        </span>
                        <span className="truncate font-serif text-sm font-semibold text-primary">
                          {partLabel}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                        <div
                          className={`h-full rounded-full ${accent.bar} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold tabular-nums text-foreground">
                        {ps.touched}/{ps.total}
                      </p>
                      {ps.avg > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          avg {ps.avg}%
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ================================================================
            5. Coverage grid + Weakest topics — side by side
            ================================================================ */}
        <div className="mb-6 grid gap-4 md:grid-cols-5">
          {/* Coverage grid */}
          <section className="md:col-span-3">
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Course coverage
            </h2>
            <div className="rounded-xl bg-card p-4 shadow-card ring-1 ring-border/60">
              {coverageDots.map((part) => {
                const accent = PART_ACCENTS[part.partIdx] ?? PART_ACCENTS[0];
                return (
                  <div key={part.partIdx} className="mb-2 flex items-center gap-2 last:mb-0">
                    <span className={`inline-block h-3 w-3 shrink-0 rounded-sm ${accent.bar}`} />
                    <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Pt {part.partIdx + 1}
                    </span>
                    <div className="flex gap-1.5">
                      {part.specs.map((sp) => (
                        <button
                          key={sp.id}
                          onClick={() => navigate(`/spec/${sp.id}`)}
                          title={`Spec ${sp.id}: ${sp.title}${sp.score > 0 ? ` — ${sp.score}%` : ""}`}
                          className={`h-5 w-5 rounded-md transition-all hover:scale-125 ${
                            sp.status === "strong"
                              ? `${accent.bar}`
                              : sp.status === "drilled"
                                ? `${accent.bar} opacity-40`
                                : "bg-black/5 dark:bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="mt-3 flex gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-sm bg-primary" /> &gt;70%
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-sm bg-primary opacity-40" /> Drilled
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-sm bg-black/5 dark:bg-white/10" /> Not started
                </span>
              </div>
            </div>
          </section>

          {/* Weakest topics */}
          <section className="md:col-span-2">
            <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Weakest topics
            </h2>
            {weakest.length === 0 ? (
              <div className="rounded-xl bg-card p-4 shadow-card ring-1 ring-border/60 text-sm text-muted-foreground">
                No scores yet. Drill a topic to see your weakest spots here.
              </div>
            ) : (
              <ul className="space-y-2">
                {weakest.map((sp) => (
                  <li key={sp.id}>
                    <button
                      onClick={() => navigate(`/spec/${sp.id}`)}
                      className="group flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3 text-left shadow-card ring-1 ring-border/60 transition-all hover:shadow-card-hover hover:ring-primary/30"
                    >
                      <span className="text-sm font-bold tabular-nums text-muted-foreground">
                        {sp.pct}%
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground group-hover:text-primary">
                        Spec {sp.id} · {sp.title}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Chronology mini-card removed — General tab is always visible in
            the top nav so there's no need to duplicate it on the Dashboard. */}

        {/* ================================================================
            7. Recent activity
            ================================================================ */}
        <section className="mb-6">
          <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Recent activity
          </h2>
          {recentSessions.length === 0 ? (
            <div className="rounded-xl bg-card p-5 text-sm text-muted-foreground shadow-card ring-1 ring-border/60">
              Nothing yet. Start any topic to see your activity here.
            </div>
          ) : (
            <ul className="space-y-2">
              {recentSessions.slice(0, 5).map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  specPoints={specPoints}
                  navigate={navigate}
                />
              ))}
            </ul>
          )}
        </section>

        {/* ================================================================
            8. This week at a glance
            ================================================================ */}
        <footer className="text-center text-[11px] text-muted-foreground">
          This week: {thisWeek.sessionCount} session
          {thisWeek.sessionCount === 1 ? "" : "s"} ·{" "}
          {thisWeek.questionCount} question
          {thisWeek.questionCount === 1 ? "" : "s"} ·{" "}
          {thisWeek.blankRecallCount} blank recall
          {thisWeek.blankRecallCount === 1 ? "" : "s"}
        </footer>
      </div>
    </div>
  );
};

// =============================================================================
// Sub-components
// =============================================================================

function SessionRow({
  session,
  specPoints,
  navigate,
}: {
  session: RecentSession;
  specPoints: SpecPoint[];
  navigate: (to: string) => void;
}) {
  const meta = ACTIVITY_DISPLAY[session.activityType] ?? ACTIVITY_DISPLAY.blank_recall;
  const Icon = meta.icon;
  const spec = specPoints.find((sp) => sp.id === session.specId);
  const scoreLine =
    session.scorePct != null
      ? session.activityType === "blank_recall"
        ? `${session.correctCount}/${session.totalQuestions} concepts`
        : `${session.correctCount}/${session.totalQuestions} · ${session.scorePct}%`
      : "";

  return (
    <li>
      <button
        onClick={() => session.specId ? navigate(`/spec/${session.specId}`) : navigate("/general")}
        className="group flex w-full items-center gap-3 rounded-xl bg-card px-4 py-3 text-left shadow-card ring-1 ring-border/60 transition-all hover:shadow-card-hover hover:ring-primary/30"
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${meta.color}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
            {meta.label}
            {spec ? ` · Spec ${spec.id} · ${spec.title}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {scoreLine}
            {scoreLine && " · "}
            {relativeTime(session.completedAt)}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
      </button>
    </li>
  );
}

function EntryCard({
  to,
  icon: Icon,
  title,
  desc,
  accent,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  accent: "emerald" | "rose" | "indigo";
}) {
  const bg: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  };
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 rounded-xl bg-card p-5 shadow-card ring-1 ring-border/60 transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover:ring-primary/30"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg[accent]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-serif text-base font-bold text-primary" dangerouslySetInnerHTML={{ __html: title }} />
      <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: desc }} />
      <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground group-hover:text-primary">
        Open <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

// =============================================================================
// Helpers
// =============================================================================
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  const diffD = diffH / 24;
  if (diffD < 7) return `${Math.floor(diffD)}d ago`;
  const diffW = diffD / 7;
  if (diffW < 5) return `${Math.floor(diffW)}w ago`;
  return `${Math.floor(diffD / 30)}mo ago`;
}

export default Index;
