// =============================================================================
// TeacherClassPage — student roster + stats at /teacher/class/:classId
// =============================================================================
// Shows every student in the class with their aggregated stats in a sortable
// table: sessions, accuracy, blank recalls, wrong answers, last active.
// Click a student → /teacher/class/:classId/student/:studentId for deep-dive.
// =============================================================================

import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronRight,
  Users,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  useClassStudents,
  useTeacherClasses,
  type ClassStudent,
} from "@/hooks/useTeacherData";

type SortKey =
  | "name"
  | "sessions"
  | "accuracy"
  | "blankRecalls"
  | "wrongAnswers"
  | "lastActive";

const TeacherClassPage = () => {
  const { classId } = useParams<{ classId: string }>();
  const { isTeacher } = useAuth();
  const navigate = useNavigate();
  const { classes } = useTeacherClasses();
  const { students, loading } = useClassStudents(classId);

  const [sortKey, setSortKey] = useState<SortKey>("lastActive");
  const [sortAsc, setSortAsc] = useState(false);

  const cls = classes.find((c) => c.id === classId);

  const sorted = useMemo(() => {
    const arr = [...students];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = displayName(a).localeCompare(displayName(b));
          break;
        case "sessions":
          cmp = a.sessionsCount - b.sessionsCount;
          break;
        case "accuracy":
          cmp = a.accuracyPct - b.accuracyPct;
          break;
        case "blankRecalls":
          cmp = a.blankRecallCount - b.blankRecallCount;
          break;
        case "wrongAnswers":
          cmp = a.wrongAnswerCount - b.wrongAnswerCount;
          break;
        case "lastActive":
          cmp = (a.lastActive ?? "").localeCompare(b.lastActive ?? "");
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [students, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

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
        title={`${cls?.name ?? "Class"} | Teacher | AQA 1H Russia Compass`}
        description="Student roster and performance overview."
        canonicalPath={`/teacher/class/${classId}`}
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
          <span className="font-medium text-foreground">
            {cls?.name ?? "Class"}
          </span>
        </div>

        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-primary">
                {cls?.name ?? "Class"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {students.length} student{students.length === 1 ? "" : "s"} ·
                Join code:{" "}
                <span className="font-mono font-bold tracking-wider">
                  {cls?.joinCode ?? "—"}
                </span>
              </p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Loading students…
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-xl bg-card p-8 text-center shadow-card ring-1 ring-border/60">
            <p className="text-sm text-muted-foreground">
              No students yet. Share the join code{" "}
              <span className="font-mono font-bold tracking-wider text-primary">
                {cls?.joinCode}
              </span>{" "}
              with your students so they can join.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-card shadow-card ring-1 ring-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <SortHeader label="Student" sortKey="name" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <SortHeader label="Sessions" sortKey="sessions" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <SortHeader label="Accuracy" sortKey="accuracy" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <SortHeader label="Blank Recalls" sortKey="blankRecalls" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <SortHeader label="Wrong Qs" sortKey="wrongAnswers" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <SortHeader label="Last Active" sortKey="lastActive" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <th className="w-10 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr
                    key={s.userId}
                    onClick={() =>
                      navigate(
                        `/teacher/class/${classId}/student/${s.userId}`
                      )
                    }
                    className="group cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground group-hover:text-primary">
                        {displayName(s)}
                      </div>
                      {s.email && (
                        <div className="text-xs text-muted-foreground">
                          {s.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {s.sessionsCount}
                    </td>
                    <td className="px-4 py-3">
                      {s.totalQuestions > 0 ? (
                        <span
                          className={`font-semibold tabular-nums ${
                            s.accuracyPct >= 70
                              ? "text-emerald-700 dark:text-emerald-300"
                              : s.accuracyPct >= 40
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {s.accuracyPct}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {s.blankRecallCount}
                    </td>
                    <td className="px-4 py-3">
                      {s.wrongAnswerCount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                          {s.wrongAnswerCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {s.lastActive ? relativeTime(s.lastActive) : "Never"}
                    </td>
                    <td className="px-3 py-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ---- Sub-components ---------------------------------------------------------

function SortHeader({
  label,
  sortKey,
  current,
  asc,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  asc: boolean;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th className="px-4 py-3">
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest ${
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
        {active && <span className="text-[8px]">{asc ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

// ---- Helpers ----------------------------------------------------------------

function displayName(s: ClassStudent): string {
  return s.displayName || s.fullName || s.email || "Unknown";
}

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

export default TeacherClassPage;
