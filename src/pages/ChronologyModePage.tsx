// =============================================================================
// ChronologyModePage — one of the three chronology modes at /chronology/:mode
// =============================================================================
// Generic shell that mounts the right mode component based on :mode:
//
//   place_in_time → PlaceInTime
//   identify      → Identify
//   sequence      → Sequence
//
// Pulls the filtered question pool from useChronologyByMode and passes it in.
// The mode components manage their own session state (shuffle, progress,
// score, restart) so this shell stays thin.
// =============================================================================

import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { PlaceInTime } from "@/components/chronology/PlaceInTime";
import { Identify } from "@/components/chronology/Identify";
import { Sequence } from "@/components/chronology/Sequence";
import {
  useChronologyByMode,
  type ChronologyMode,
} from "@/hooks/useChronology";

const MODE_LABEL: Record<ChronologyMode, string> = {
  place_in_time: "Place in Time",
  identify: "Identify",
  sequence: "Sequence",
};

function isChronologyMode(v: string | undefined): v is ChronologyMode {
  return v === "place_in_time" || v === "identify" || v === "sequence";
}

const ChronologyModePage = () => {
  const { mode } = useParams<{ mode: string }>();
  const navigate = useNavigate();

  // Always call the hook before any conditional returns (rules of hooks).
  // If the mode isn't valid we'll redirect below anyway.
  const safeMode: ChronologyMode = isChronologyMode(mode) ? mode : "place_in_time";
  const questions = useChronologyByMode(safeMode);

  if (!isChronologyMode(mode)) {
    return <Navigate to="/chronology" replace />;
  }

  const label = MODE_LABEL[mode];

  return (
    <div className="min-h-screen bg-background pb-16">
      <SEOHead
        title={`${label} — Chronology | AQA 1H Russia Compass`}
        description={`${label} practice across the whole AQA 7042/1H course: 1855–1964.`}
        canonicalPath={`/chronology/${mode}`}
      />

      {/* Mini top bar */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 px-2"
            onClick={() => navigate("/chronology")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to chronology</span>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Chronology · Whole course
            </div>
            <div className="truncate font-serif text-sm font-bold text-primary sm:text-base">
              {label}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-3xl">
          {mode === "place_in_time" && <PlaceInTime questions={questions} />}
          {mode === "identify" && <Identify questions={questions} />}
          {mode === "sequence" && <Sequence questions={questions} />}
        </div>
      </div>
    </div>
  );
};

export default ChronologyModePage;
