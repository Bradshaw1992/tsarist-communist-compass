// =============================================================================
// useRecentSessions — Dashboard "recent activity" data source
// =============================================================================
// Reads the most recent completed sessions from user_sessions (drillers) and
// user_blank_recalls, unifies them into a single chronological list. The
// Dashboard renders this as the "Recent activity" stream.
//
// This hook is READ-ONLY — writes happen through useHighScores.logSession()
// and useHighScores.logBlankRecall(). No single-instance constraint.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SessionActivityType =
  | "knowledge_driller"
  | "concept_driller"
  | "blank_recall";

export interface RecentSession {
  id: string;
  activityType: SessionActivityType;
  specId: number | null;
  scorePct: number | null;        // 0-100 for drillers, concepts_covered/total for recall
  totalQuestions: number | null;
  correctCount: number | null;
  completedAt: string;            // ISO
}

export function useRecentSessions(limit = 10) {
  const { user } = useAuth();
  const [drillerRows, setDrillerRows] = useState<RecentSession[]>([]);
  const [recallRows, setRecallRows] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setDrillerRows([]);
      setRecallRows([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      // Driller sessions
      supabase
        .from("user_sessions")
        .select("id, activity_type, spec_id, total_questions, correct_count, completed_at")
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(limit),
      // Blank recalls
      supabase
        .from("user_blank_recalls")
        .select("id, spec_id, concepts_total, concepts_covered, submitted_at")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(limit),
    ]).then(([sessResult, recallResult]) => {
      if (cancelled) return;

      if (!sessResult.error && sessResult.data) {
        setDrillerRows(
          sessResult.data.map((r) => ({
            id: r.id,
            activityType: r.activity_type as SessionActivityType,
            specId: r.spec_id,
            totalQuestions: r.total_questions,
            correctCount: r.correct_count,
            scorePct:
              r.total_questions && r.correct_count != null
                ? Math.round((r.correct_count / r.total_questions) * 100)
                : null,
            completedAt: r.completed_at ?? "",
          }))
        );
      }

      if (!recallResult.error && recallResult.data) {
        setRecallRows(
          recallResult.data.map((r) => ({
            id: r.id,
            activityType: "blank_recall" as const,
            specId: r.spec_id,
            totalQuestions: r.concepts_total,
            correctCount: r.concepts_covered,
            scorePct:
              r.concepts_total && r.concepts_total > 0
                ? Math.round(
                    ((r.concepts_covered ?? 0) / r.concepts_total) * 100
                  )
                : null,
            completedAt: r.submitted_at ?? "",
          }))
        );
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user, limit]);

  // Merge + sort chronologically, capped at `limit`.
  const sessions = useMemo<RecentSession[]>(() => {
    return [...drillerRows, ...recallRows]
      .filter((s) => s.completedAt)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, limit);
  }, [drillerRows, recallRows, limit]);

  // This-week stats.
  const thisWeek = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toISOString();
    const recent = sessions.filter((s) => s.completedAt >= weekStr);
    return {
      sessionCount: recent.length,
      questionCount: recent.reduce(
        (acc, s) => acc + (s.totalQuestions ?? 0),
        0
      ),
      blankRecallCount: recent.filter((s) => s.activityType === "blank_recall")
        .length,
    };
  }, [sessions]);

  return { sessions, loading, thisWeek };
}
