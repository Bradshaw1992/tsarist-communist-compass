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

import { useNavigate } from "react-router-dom";
import { Compass, Clock, Search, ListOrdered } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
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

  const accentSurface: Record<string, string> = {
    rose:
      "bg-rose-50/60 ring-rose-200/60 hover:bg-rose-50 dark:bg-rose-950/20 dark:ring-rose-800/40",
    blue:
      "bg-blue-50/60 ring-blue-200/60 hover:bg-blue-50 dark:bg-blue-950/20 dark:ring-blue-800/40",
    purple:
      "bg-purple-50/60 ring-purple-200/60 hover:bg-purple-50 dark:bg-purple-950/20 dark:ring-purple-800/40",
  };
  const accentIcon: Record<string, string> = {
    rose: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    purple: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  };

  return (
    <div>
      <SEOHead
        title="General & Chronology | AQA 1H Russia Compass"
        description="Test your chronology across the whole AQA 1H course: 1855–1964. Place events in time, identify people and events, and sequence key moments in Tsarist and Communist Russia."
        canonicalPath="/general"
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/15">
              <Compass className="h-5 w-5 text-rose-600 dark:text-rose-300" />
            </span>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              1855 – 1964 · Whole course
            </div>
          </div>
          <h1 className="mt-3 max-w-3xl font-serif text-2xl font-bold leading-tight text-primary sm:text-3xl">
            General Knowledge &amp; Chronology
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The zoom-out view of the whole AQA 1H course. Place events in the
            right period, identify the people and policies, sequence the
            moments that changed everything.
          </p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {loading
              ? "Loading question pool…"
              : `${stats.total} questions across 3 modes`}
          </p>
        </header>

        {/* Mode grid */}
        <section>
          <h2 className="mb-3 font-serif text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
                  className={`group flex flex-col gap-3 rounded-xl p-5 text-left shadow-card ring-1 transition-all hover:-translate-y-0.5 hover:shadow-card-hover disabled:opacity-50 ${accentSurface[m.accent]}`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${accentIcon[m.accent]}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-serif text-base font-bold text-primary">
                    {m.name}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {m.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-foreground/80">
                      {m.count} question{m.count === 1 ? "" : "s"}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary">
                      Open →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {!loading && stats.total === 0 && (
            <div className="mt-6 rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No chronology questions loaded yet. The curated pool is stored in
              Supabase — check your network tab if this sticks.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ChronologyPage;
