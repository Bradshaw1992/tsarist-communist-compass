// =============================================================================
// SpecActivityPage — single activity route at /spec/:specId/:activity
// =============================================================================
// Generic shell that mounts one of the four activity components for a given
// spec point. The component is chosen by the :activity URL param:
//
//   recall   → BlankRecall
//   concepts → PrecisionDriller (Concept Driller)
//   facts    → SpecificKnowledge (Knowledge Driller)
//   essays   → ExamArchitect (Essay Bank)
//
// Session-logging + wrong-answer callbacks come from useHighScores +
// useWrongAnswers. React Router only mounts one page at a time, so there's no
// "two hook instances writing to localStorage at once" concern — the instance
// on the dashboard unmounts before this page mounts, and vice versa.
// =============================================================================

import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { BlankRecall } from "@/components/tabs/BlankRecall";
import { ExamArchitect } from "@/components/tabs/ExamArchitect";
import { PrecisionDriller } from "@/components/tabs/PrecisionDriller";
import { SpecificKnowledge } from "@/components/tabs/SpecificKnowledge";
import { useSpecPoint } from "@/hooks/useRevisionData";
import { useHighScores } from "@/hooks/useHighScores";
import { useWrongAnswers } from "@/hooks/useWrongAnswers";

type ActivityKey = "recall" | "concepts" | "facts" | "essays";

const ACTIVITY_LABEL: Record<ActivityKey, string> = {
  recall: "Blank Recall",
  concepts: "Concept Driller",
  facts: "Knowledge Driller",
  essays: "Essay Bank",
};

function isActivityKey(v: string | undefined): v is ActivityKey {
  return v === "recall" || v === "concepts" || v === "facts" || v === "essays";
}

const SpecActivityPage = () => {
  const { specId: specIdParam, activity } = useParams<{
    specId: string;
    activity: string;
  }>();
  const specId = specIdParam ? parseInt(specIdParam, 10) : NaN;
  const navigate = useNavigate();
  const spec = useSpecPoint(Number.isNaN(specId) ? undefined : specId);

  const { logSession, logBlankRecall } = useHighScores();
  const { recordAssessment } = useWrongAnswers();

  if (Number.isNaN(specId) || !isActivityKey(activity)) {
    return <Navigate to="/" replace />;
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

  const label = ACTIVITY_LABEL[activity];

  return (
    <div className="min-h-screen bg-background pb-16">
      <SEOHead
        title={`${label} — ${spec.title} | AQA 1H Russia Compass`}
        description={`${label} practice for ${spec.title}. AQA 7042/1H: Tsarist and Communist Russia 1855–1964.`}
        canonicalPath={`/spec/${spec.id}/${activity}`}
      />

      {/* Mini top bar */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2"
            onClick={() => navigate(`/spec/${spec.id}`)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to topic</span>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {label} · Spec {spec.id}
            </div>
            <div className="truncate font-serif text-sm font-bold text-primary sm:text-base">
              {spec.title}
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden gap-1.5 sm:inline-flex">
            <Link to="/">All topics</Link>
          </Button>
        </div>
      </div>

      {/* Activity body */}
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-5xl">
          {activity === "recall" && (
            <BlankRecall
              specId={spec.id}
              specTitle={spec.title}
              onBlankRecallComplete={logBlankRecall}
              onSessionComplete={logSession}
              onAssessment={recordAssessment}
            />
          )}
          {activity === "concepts" && (
            <PrecisionDriller
              specId={spec.id}
              specTitle={spec.title}
              onSessionComplete={logSession}
              onAssessment={recordAssessment}
            />
          )}
          {activity === "facts" && (
            <SpecificKnowledge
              specId={spec.id}
              specTitle={spec.title}
              onSessionComplete={logSession}
              onAssessment={recordAssessment}
            />
          )}
          {activity === "essays" && <ExamArchitect specId={spec.id} />}
        </div>
      </div>
    </div>
  );
};

export default SpecActivityPage;
