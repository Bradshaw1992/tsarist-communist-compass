// =============================================================================
// ChronologyPage — landing page at /chronology
// =============================================================================
// Shows the three chronology modes as a card grid with counts pulled from
// the live question pool. Clicking a card navigates to /chronology/:mode,
// which renders the corresponding component (PlaceInTime, Identify, Sequence).
//
// Unlike the spec-point pages, chronology is course-wide: no spec_id filter,
// no progress ring tied to a topic. It's the "zoom out" view of the whole
// 1855–1964 course.
// =============================================================================

import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Compass,
  Clock,
  Search,
  ListOrdered,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { useChronologyStats, useChronologyLoading } from "@/hooks/useChronology";

const ChronologyPage = () => {
  const navigate = useNavigate();
  const stats = useChronologyStats();
  const loading = useChronologyLoading();

  const modes = [
    {
      key: "place_in_time" as const,
      name: "Place in Time",
      icon: Clock,
      description: "Which of the four course periods does this event belong to?",
      count: stats.place_in_time,
      accent: "rose",
    },
    {
      key: "identify" as const,
      name: "Identify",
      icon: Search,
      description: "Who was this person? What was this event or policy?",
      count: stats.identify,
      accent: "blue",
    },
    {
      key: "sequence" as const,
      name: "Sequence",
      icon: ListOrdered,
      description: "Put a set of events in correct chronological order.",
      count: stats.sequence,
      accent: "purple",
    },
  ];

  const accentBorder: Record<string, string> = {
    rose: "border-l-4 border-l-rose-500",
    blue: "border-l-4 border-l-blue-500",
    purple: "border-l-4 border-l-purple-500",
  };
  const accentIcon: Record<string, string> = {
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <SEOHead
        title="Chronology | AQA 1H Russia Compass"
        description="Test your chronology across the whole AQA 1H course: 1855–1964. Place events in time, identify people and events, and sequence key moments in Tsarist and Communist Russia."
        canonicalPath="/chronology"
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
          <span className="font-medium text-foreground">Chronology</span>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10">
              <Compass className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </span>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              1855 – 1964 · Whole course
            </div>
          </div>
          <h1 className="mt-4 max-w-3xl font-serif text-2xl font-bold leading-tight text-primary sm:text-3xl lg:text-[2rem]">
            General Knowledge & Chronology
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The zoom-out view of the whole AQA 1H course. Test whether you can
            place events in the right period, identify the people and policies
            that shaped Tsarist and Communist Russia, and sequence the moments
            that changed everything.
          </p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {loading
              ? "Loading question pool…"
              : `${stats.total} questions across 3 modes`}
          </p>
        </div>
      </header>

      {/* Mode grid */}
      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 font-serif text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pick a mode
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {modes.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => navigate(`/chronology/${m.key}`)}
                  disabled={m.count === 0}
                  className={`group flex min-h-[200px] flex-col gap-3 rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md disabled:opacity-50 ${accentBorder[m.accent]}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${accentIcon[m.accent]}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-serif text-base font-bold text-primary">
                      {m.name}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {m.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-foreground/80">
                      {m.count} question{m.count === 1 ? "" : "s"}
                    </span>
                    <span className="text-xs font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100">
                      Open →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {!loading && stats.total === 0 && (
            <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No chronology questions loaded yet. The curated pool is stored in
              Supabase — check your network tab if this sticks.
            </div>
          )}
        </div>
      </section>

      {/* Back to topics */}
      <section className="px-4 pb-10 sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <Button asChild variant="outline" size="sm">
            <Link to="/">← Back to topics</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ChronologyPage;
