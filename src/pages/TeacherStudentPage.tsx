// =============================================================================
// TeacherStudentPage — individual student deep-dive
// =============================================================================
// Route: /teacher/class/:classId/student/:studentId
// Shows a student's full profile, per-spec breakdown, session history,
// wrong answers (unresolved first), and blank recall submissions.
// =============================================================================

import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Clock,
  PenLine,
  Target,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  useStudentDetail,
  useTeacherClasses,
} from "@/hooks/useTeacherData";
import { useSpecPoints, type SpecPoint } from "@/hooks/useRevisionData";

// ---- Helpers ----------------------------------------------------------------

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  const diffD = diffH / 24;
  if (diffD < 7) return `${Math.floor(diffD)}d ago`;
  if (diffD < 30) return `${Math.floor(diffD / 7)}w ago`;
  return `${Math.floor(diffD / 30)}mo ago`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function activityLabel(type: string): string {
  switch (type) {
    case "knowledge":
      return "Knowledge Driller";
    case "concepts":
      return "Concept Driller";
    case "facts":
      return "Knowledge Driller";
    case "recall":
      return "Blank Recall";
    default:
      return type;
  }
}

function activityIcon(type: string) {
  switch (type) {
    case "knowledge":
    case "facts":
      return Zap;
    case "concepts":
      return Target;
    case "recall":
      return PenLine;
    default:
      return BookOpen;
  }
}

// =============================================================================

const TeacherStudentPage = () => {
  const { classId, studentId } = useParams<{
    classId: string;
    studentId: string;
  }>();
  const { isTeacher } = useAuth();
  const navigate = useNavigate();
  const { classes } = useTeacherClasses();
  const specPoints = useSpecPoints();

  const {
    profile,
    sessions,
    wrongAnswers,
    unresolvedWrongAnswers,
    blankRecalls,
    specBreakdown,
    loading,
  } = useStudentDetail(studentId);

  const cls = classes.find((c) => c.id === classId);

  // Build a lookup for spec titles
  const specMap = useMemo(() => {
    const m = new Map<number, SpecPoint>();
    for (const sp of specPoints) m.set(sp.id, sp);
    return m;
  }, [specPoints]);

  // Summary stats
  const totalSessions = sessions.length + blankRecalls.length;
  const totalQuestions = sessions.reduce((s, r) => s + r.totalQuestions, 0);
  const totalCorrect = sessions.reduce((s, r) => s + r.correctCount, 0);
  const accuracyPct =
    totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  // Sorted spec breakdown entries
  const specRows = useMemo(() => {
    const rows: {
      specId: number;
      title: string;
      section: string;
      sessions: number;
      total: number;
      correct: number;
      accuracyPct: number;
      lastAt: string;
    }[] = [];

    specBreakdown.forEach((val, specId) => {
      const sp = specMap.get(specId);
      rows.push({
        specId,
        title: sp?.short_title ?? sp?.title ?? `Spec ${specId}`,
        section: sp?.section ?? "",
        sessions: val.sessions,
        total: val.total,
        correct: val.correct,
        accuracyPct:
          val.total > 0 ? Math.round((val.correct / val.total) * 100) : 0,
        lastAt: val.lastAt,
      });
    });

    // Sort by spec ID
    rows.sort((a, b) => a.specId - b.specId);
    return rows;
  }, [specBreakdown, specMap]);

  const displayName =
    profile?.displayName || profile?.fullName || profile?.email || "Student";

  if (!isTeacher) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center text-muted-foreground">
        No teacher access.
      </div>
    );
  }

  return (
    <div>
      <SEOHead
        title={`${displayName} | Teacher | AQA 1H Russia Compass`}
        description="Individual student performance overview."
        canonicalPath={`/teacher/class/${classId}/student/${studentId}`}
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => navigate("/teacher")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Classes
          </Button>
          <span className="text-muted-foreground/50">/</span>
          <button
            onClick={() => navigate(`/teacher/class/${classId}`)}
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {cls?.name ?? "Class"}
          </button>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">{displayName}</span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Loading student data...
          </div>
        ) : (
          <>
            {/* Header + summary stats */}
            <header className="mb-6">
              <h1 className="font-serif text-2xl font-bold text-primary">
                {displayName}
              </h1>
              {profile?.email && (
                <p className="text-sm text-muted-foreground">
                  {profile.email}
                </p>
              )}
            </header>

            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Sessions"
                value={totalSessions}
                icon={<BookOpen className="h-4 w-4" />}
              />
              <StatCard
                label="Questions"
                value={totalQuestions}
                icon={<Zap className="h-4 w-4" />}
              />
              <StatCard
                label="Accuracy"
                value={totalQuestions > 0 ? `${accuracyPct}%` : "—"}
                icon={<Target className="h-4 w-4" />}
                highlight={
                  totalQuestions > 0
                    ? accuracyPct >= 70
                      ? "good"
                      : accuracyPct >= 40
                        ? "ok"
                        : "weak"
                    : undefined
                }
              />
              <StatCard
                label="To review"
                value={unresolvedWrongAnswers.length}
                icon={<TriangleAlert className="h-4 w-4" />}
                highlight={
                  unresolvedWrongAnswers.length > 0 ? "warn" : undefined
                }
              />
            </div>

            {/* Per-spec breakdown */}
            <Section title="Topic breakdown" icon={BookOpen}>
              {specRows.length === 0 ? (
                <EmptyNote>No driller sessions yet.</EmptyNote>
              ) : (
                <div className="overflow-x-auto rounded-xl bg-card shadow-card ring-1 ring-border/60">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left">
                        <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Spec
                        </th>
                        <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Sessions
                        </th>
                        <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Questions
                        </th>
                        <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Accuracy
                        </th>
                        <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          Last
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {specRows.map((r) => (
                        <tr
                          key={r.specId}
                          className="border-b border-border/40 last:border-0"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {r.specId}. {r.title}
                            </div>
                            {r.section && (
                              <div className="text-[11px] text-muted-foreground">
                                {r.section}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">
                            {r.sessions}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">
                            {r.correct}/{r.total}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-semibold tabular-nums ${
                                r.accuracyPct >= 70
                                  ? "text-emerald-700 dark:text-emerald-300"
                                  : r.accuracyPct >= 40
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-rose-700 dark:text-rose-300"
                              }`}
                            >
                              {r.accuracyPct}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {r.lastAt ? relativeTime(r.lastAt) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Recent sessions */}
            <Section title="Recent sessions" icon={Clock}>
              {sessions.length === 0 && blankRecalls.length === 0 ? (
                <EmptyNote>No sessions yet.</EmptyNote>
              ) : (
                <div className="space-y-2">
                  {sessions.slice(0, 20).map((s) => {
                    const sp = s.specId ? specMap.get(s.specId) : null;
                    const Icon = activityIcon(s.activityType);
                    const pct =
                      s.totalQuestions > 0
                        ? Math.round(
                            (s.correctCount / s.totalQuestions) * 100
                          )
                        : 0;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 ring-1 ring-border/60"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground">
                            {activityLabel(s.activityType)}
                            {sp && (
                              <span className="text-muted-foreground">
                                {" "}
                                — {sp.short_title ?? sp.title}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {s.correctCount}/{s.totalQuestions} correct ·{" "}
                            {shortDate(s.completedAt)}
                          </div>
                        </div>
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            pct >= 70
                              ? "text-emerald-700 dark:text-emerald-300"
                              : pct >= 40
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                    );
                  })}

                  {blankRecalls.slice(0, 10).map((r) => {
                    const sp = specMap.get(r.specId);
                    const pct =
                      r.conceptsTotal > 0
                        ? Math.round(
                            (r.conceptsCovered / r.conceptsTotal) * 100
                          )
                        : 0;
                    return (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 rounded-lg bg-card px-4 py-3 ring-1 ring-border/60"
                      >
                        <PenLine className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground">
                            Blank Recall
                            {sp && (
                              <span className="text-muted-foreground">
                                {" "}
                                — {sp.short_title ?? sp.title}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.conceptsCovered}/{r.conceptsTotal} concepts ·{" "}
                            {shortDate(r.submittedAt)}
                          </div>
                        </div>
                        <span
                          className={`text-sm font-semibold tabular-nums ${
                            pct >= 70
                              ? "text-emerald-700 dark:text-emerald-300"
                              : pct >= 40
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* Wrong answers */}
            <Section title="Wrong answers" icon={TriangleAlert}>
              {wrongAnswers.length === 0 ? (
                <EmptyNote>No wrong answers recorded.</EmptyNote>
              ) : (
                <div className="space-y-2">
                  {/* Unresolved first */}
                  {unresolvedWrongAnswers.length > 0 && (
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                      Unresolved ({unresolvedWrongAnswers.length})
                    </div>
                  )}
                  {unresolvedWrongAnswers.slice(0, 30).map((w) => (
                    <WrongAnswerCard key={w.id} w={w} specMap={specMap} />
                  ))}

                  {/* Resolved */}
                  {wrongAnswers.filter((w) => w.resolvedAt).length > 0 && (
                    <div className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Resolved (
                      {wrongAnswers.filter((w) => w.resolvedAt).length})
                    </div>
                  )}
                  {wrongAnswers
                    .filter((w) => w.resolvedAt)
                    .slice(0, 20)
                    .map((w) => (
                      <WrongAnswerCard
                        key={w.id}
                        w={w}
                        specMap={specMap}
                        resolved
                      />
                    ))}
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
};

// ---- Sub-components ---------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: "good" | "ok" | "weak" | "warn";
}) {
  const highlightClass =
    highlight === "good"
      ? "text-emerald-700 dark:text-emerald-300"
      : highlight === "ok"
        ? "text-amber-700 dark:text-amber-300"
        : highlight === "weak"
          ? "text-rose-700 dark:text-rose-300"
          : highlight === "warn"
            ? "text-amber-700 dark:text-amber-300"
            : "text-foreground";

  return (
    <div className="rounded-xl bg-card p-4 shadow-card ring-1 ring-border/60">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-widest">
          {label}
        </span>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${highlightClass}`}>
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-primary">
        <Icon className="h-5 w-5" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground shadow-card ring-1 ring-border/60">
      {children}
    </div>
  );
}

function WrongAnswerCard({
  w,
  specMap,
  resolved,
}: {
  w: {
    id: string;
    specId: number | null;
    questionSnapshot: {
      question: string;
      answer: string;
      spec_title?: string;
    };
    missedAt: string;
    resolvedAt: string | null;
  };
  specMap: Map<number, SpecPoint>;
  resolved?: boolean;
}) {
  const sp = w.specId ? specMap.get(w.specId) : null;
  return (
    <div
      className={`rounded-lg bg-card px-4 py-3 ring-1 ring-border/60 ${
        resolved ? "opacity-60" : ""
      }`}
    >
      <div className="text-sm font-medium text-foreground">
        {w.questionSnapshot.question || "—"}
      </div>
      <div className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
        {w.questionSnapshot.answer || "—"}
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
        {sp && <span>{sp.short_title ?? sp.title}</span>}
        {sp && <span>·</span>}
        <span>Missed {relativeTime(w.missedAt)}</span>
        {w.resolvedAt && (
          <>
            <span>·</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              Resolved {relativeTime(w.resolvedAt)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default TeacherStudentPage;
