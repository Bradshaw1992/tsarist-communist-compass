// =============================================================================
// SpecPage — topic landing page at /spec/:specId
// =============================================================================
// The gateway to a single spec point. Replaces the old full-screen modal that
// lived in Index.tsx. Layout (per plan):
//
//   • Breadcrumb strip back to /
//   • Header: spec number badge, section eyebrow, spec title, aggregate bar
//   • 2x2 activity grid — Blank Recall + Concept Driller on top, Knowledge
//     Driller + Essay Bank below. Click a card → /spec/:specId/:activity
//   • If the student has unresolved wrong answers for this spec, a yellow
//     callout appears below the grid linking to the Review Queue
//
// Progress stats for v1 are intentionally lightweight: question counts on every
// card, plus the aggregate highScore from useHighScores on the two driller
// cards. Per-activity progress splits are a later refinement.
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
import { Card, CardContent } from "@/components/ui/card";
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

  if (!specIdValid) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="text-muted-foreground">That topic doesn't exist.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/">Back to topics</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!spec) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center text-muted-foreground">
          Loading topic…
        </div>
      </div>
    );
  }

  const progress = scores[spec.id];
  const wrongForSpec = wrongAnswers.filter((w) => w.spec_id === spec.id);
  const keyConceptCount = recall?.key_concepts.length ?? 0;

  const activities = [
    {
      key: "recall" as const,
      name: "Blank Recall",
      icon: PenLine,
      description: "Write what you know — AI checks what you missed.",
      accent: "emerald",
      stat:
        keyConceptCount > 0
          ? `${keyConceptCount} key concepts to hit`
          : "Free-text recall",
    },
    {
      key: "concepts" as const,
      name: "Concept Driller",
      icon: Crosshair,
      description: "Significance, causation, and the why behind the facts.",
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
      } for this topic`,
    },
  ];

  const accentBorder: Record<string, string> = {
    emerald: "border-l-4 border-l-emerald-500",
    purple: "border-l-4 border-l-purple-500",
    blue: "border-l-4 border-l-blue-500",
    amber: "border-l-4 border-l-amber-500",
  };
  const accentIcon: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <SEOHead
        title={`${spec.title} | AQA 1H Russia Compass`}
        description={`Revise ${spec.title} for AQA 7042/1H. Blank Recall, Concept Driller, Knowledge Driller, and Essay Bank for ${spec.section}.`}
        canonicalPath={`/spec/${spec.id}`}
      />

      {/* Breadcrumb strip */}
      <div className="border-b border-border bg-card/60 px-4 py-2 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-2 text-xs text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2"
            onClick={() => navigate("/")}
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
      </div>

      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              {spec.id}
            </span>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {spec.section}
            </div>
          </div>
          <h1 className="mt-4 max-w-3xl font-serif text-2xl font-bold leading-tight text-primary sm:text-3xl lg:text-[2rem]">
            {spec.title}
          </h1>
          {progress && (
            <div className="mt-5 flex items-center gap-3">
              <Progress
                value={progress.highScore}
                className="h-1.5 w-full max-w-xs"
              />
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                Best: {progress.highScore}%
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Activity grid */}
      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 font-serif text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Practise this topic
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {activities.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  onClick={() => navigate(`/spec/${spec.id}/${a.key}`)}
                  className={`group flex min-h-[168px] flex-col gap-3 rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md ${accentBorder[a.accent]}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${accentIcon[a.accent]}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-serif text-base font-bold text-primary">
                      {a.name}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {a.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-foreground/80">
                      {a.stat}
                    </span>
                    <span className="text-xs font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100">
                      Open →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Wrong answers for this spec */}
      {wrongForSpec.length > 0 && (
        <section className="px-4 pb-10 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <Card className="border-amber-400/60 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-950/20">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-amber-500/20 p-2">
                    <ClipboardList className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-200">
                      {wrongForSpec.length} question
                      {wrongForSpec.length === 1 ? "" : "s"} to review for this
                      topic
                    </p>
                    <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                      You missed these in previous sessions. Drilling this topic
                      again will surface them — get them right and they'll
                      auto-clear.
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
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  );
};

export default SpecPage;
