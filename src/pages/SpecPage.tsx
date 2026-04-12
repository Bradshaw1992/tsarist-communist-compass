// =============================================================================
// SpecPage — topic landing page at /spec/:specId
// =============================================================================
// The gateway to a single spec point. Layout:
//
//   • Compact breadcrumb back to /topics
//   • Warm header: spec number, section eyebrow, spec title, thin progress
//   • Four equal activity cards in a row (4 on desktop, 2×2 tablet, stacked
//     on mobile). Order: Blank Recall → Concept → Knowledge → Essay Bank.
//     Blank Recall sits first because it's the pedagogical core, but all
//     four cards carry the same visual weight. Pale accent washes instead
//     of flat coloured bars — warm and airy, not stark.
//   • Wrong-answers-for-spec callout sits beneath, compact.
//
// Cards are deliberately short — no min-height hero tiles. Progress stats
// for v1 are lightweight: aggregate high score on the header, question
// counts per card. Per-activity progress splits are a later refinement.
// =============================================================================

import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Crosshair,
  FileText,
  PenLine,
  Zap,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  useExamQuestionsForSpec,
  useFactDrillerForSpec,
  useQuizQuestionsForSpec,
  useRecallForSpec,
  useSpecPoint,
} from "@/hooks/useRevisionData";
import { useHighScores } from "@/hooks/useHighScores";
import { useWrongAnswers } from "@/hooks/useWrongAnswers";
import { useConfidence, type ConfidenceLevel } from "@/hooks/useConfidence";
import { useRecentSessions } from "@/hooks/useRecentSessions";

const SpecPage = () => {
  const { specId: specIdParam } = useParams<{ specId: string }>();
  const specId = specIdParam ? parseInt(specIdParam, 10) : NaN;
  const specIdValid = !Number.isNaN(specId);
  const navigate = useNavigate();

  const spec = useSpecPoint(specIdValid ? specId : undefined);
  const factQuestions = useFactDrillerForSpec(specIdValid ? specId : 0);
  const conceptQuestions = useQuizQuestionsForSpec(specIdValid ? specId : 0);
  const essayQuestions = useExamQuestionsForSpec(specIdValid ? specId : 0);
  const recall = useRecallForSpec(specIdValid ? specId : 0);

  const { scores } = useHighScores();
  const { items: wrongAnswers } = useWrongAnswers();
  const { getConfidence, setSpecConfidence } = useConfidence();
  const { sessions } = useRecentSessions(20);

  if (!specIdValid) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-muted-foreground">That topic doesn't exist.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/topics">Back to topics</Link>
        </Button>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center text-muted-foreground">
        Loading topic…
      </div>
    );
  }

  const progress = scores[spec.id];
  const wrongForSpec = wrongAnswers.filter((w) => w.spec_id === spec.id);
  const keyConceptCount = recall?.key_concepts.length ?? 0;
  const conf = getConfidence(spec.id);

  // Progress trajectory — last 3 sessions for this spec
  const specSessions = sessions
    .filter((s) => s.specId === spec.id && s.scorePct != null)
    .slice(0, 3);
  const avgScore =
    specSessions.length > 0
      ? Math.round(
          specSessions.reduce((acc, s) => acc + (s.scorePct ?? 0), 0) /
            specSessions.length
        )
      : null;

  const activities = [
    {
      key: "recall" as const,
      name: "Blank Recall",
      icon: PenLine,
      description: "Write what you know — then see what you missed.",
      accent: "emerald",
      stat:
        keyConceptCount > 0
          ? `${keyConceptCount} key concepts`
          : "Free-text recall",
    },
    {
      key: "concepts" as const,
      name: "Concept Driller",
      icon: Crosshair,
      description: "Significance, causation, the why behind the facts.",
      accent: "purple",
      stat: `${conceptQuestions.length} question${
        conceptQuestions.length === 1 ? "" : "s"
      }`,
    },
    {
      key: "facts" as const,
      name: "Knowledge Driller",
      icon: Zap,
      description: "Rapid-fire recall of the sniper facts.",
      accent: "blue",
      stat: `${factQuestions.length} question${
        factQuestions.length === 1 ? "" : "s"
      }`,
    },
    {
      key: "essays" as const,
      name: "Essay Bank",
      icon: FileText,
      description: "Past-paper essays with full indicative content.",
      accent: "amber",
      stat: `${essayQuestions.length} essay${
        essayQuestions.length === 1 ? "" : "s"
      }`,
    },
  ];

  const accentSurface: Record<string, string> = {
    emerald:
      "bg-emerald-50/60 ring-emerald-200/60 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:ring-emerald-800/40",
    purple:
      "bg-purple-50/60 ring-purple-200/60 hover:bg-purple-50 dark:bg-purple-950/20 dark:ring-purple-800/40",
    blue:
      "bg-blue-50/60 ring-blue-200/60 hover:bg-blue-50 dark:bg-blue-950/20 dark:ring-blue-800/40",
    amber:
      "bg-amber-50/60 ring-amber-200/60 hover:bg-amber-50 dark:bg-amber-950/20 dark:ring-amber-800/40",
  };
  const accentIcon: Record<string, string> = {
    emerald:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    purple:
      "bg-purple-500/15 text-purple-700 dark:text-purple-300",
    blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    amber:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  };

  return (
    <div>
      <SEOHead
        title={`${spec.title} | AQA 1H Russia Compass`}
        description={`Revise ${spec.title} for AQA 7042/1H. Blank Recall, Concept Driller, Knowledge Driller, and Essay Bank for ${spec.section}.`}
        canonicalPath={`/spec/${spec.id}`}
      />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => navigate("/topics")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Topics
          </Button>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate">Part {spec.part}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate font-medium text-foreground">
            Spec {spec.id}
          </span>
        </div>

        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
              {spec.id}
            </span>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {spec.section}
            </div>
          </div>
          <h1 className="mt-3 max-w-3xl font-serif text-2xl font-bold leading-tight text-primary sm:text-3xl">
            {spec.title}
          </h1>
          {/* Progress + trajectory */}
          {progress && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3">
                <Progress
                  value={progress.highScore}
                  className="h-1.5 w-full max-w-[14rem]"
                />
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  Best: {progress.highScore}%
                  {avgScore != null && ` · Avg: ${avgScore}%`}
                </span>
              </div>
              {specSessions.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Last {specSessions.length}: {specSessions.map((s) => `${s.scorePct}%`).join(", ")}
                  {specSessions.length >= 2 && (
                    <span className="ml-1">
                      {(specSessions[0].scorePct ?? 0) > (specSessions[specSessions.length - 1].scorePct ?? 0)
                        ? "↑"
                        : (specSessions[0].scorePct ?? 0) < (specSessions[specSessions.length - 1].scorePct ?? 0)
                          ? "↓"
                          : "→"}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Confidence self-rating */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              How do you feel about this topic?
            </span>
            {(["none", "shaky", "confident"] as ConfidenceLevel[]).map(
              (level) => (
                <button
                  key={level}
                  onClick={() => setSpecConfidence(spec.id, level)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    conf === level
                      ? level === "confident"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : level === "shaky"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                      : "text-muted-foreground/60 hover:bg-muted/60"
                  }`}
                >
                  {level === "none" ? "Not sure" : level === "shaky" ? "Shaky" : "Confident"}
                </button>
              )
            )}
          </div>
        </header>

        {/* Activity grid — four equal cards */}
        <section>
          <h2 className="mb-3 font-serif text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Practise this topic
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {activities.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  onClick={() => navigate(`/spec/${spec.id}/${a.key}`)}
                  className={`group flex flex-col gap-3 rounded-xl p-5 text-left shadow-card ring-1 transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${accentSurface[a.accent]}`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${accentIcon[a.accent]}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-serif text-base font-bold text-primary">
                    {a.name}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {a.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-[11px] font-medium text-foreground/80">
                      {a.stat}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-primary">
                      Open →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Wrong answers for this spec */}
        {wrongForSpec.length > 0 && (
          <section className="mt-8">
            <div className="flex flex-col gap-3 rounded-xl bg-amber-50/70 p-4 ring-1 ring-amber-200/70 dark:bg-amber-950/20 dark:ring-amber-800/40 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-amber-500/20 p-1.5">
                  <ClipboardList className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    {wrongForSpec.length} question
                    {wrongForSpec.length === 1 ? "" : "s"} to review for this
                    topic
                  </p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                    Drilling this topic again will surface them — get them
                    right and they'll auto-clear.
                  </p>
                </div>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 border-amber-500/60 bg-white/60 text-amber-800 hover:bg-white dark:bg-amber-950/40 dark:text-amber-200"
              >
                <Link to="/review">Review queue →</Link>
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default SpecPage;
