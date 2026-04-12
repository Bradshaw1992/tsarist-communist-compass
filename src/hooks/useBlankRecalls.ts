// =============================================================================
// useBlankRecalls — latest-per-spec blank recall history
// =============================================================================
// Pulls the user's blank recall history from Supabase and reduces it to
// "latest attempt per spec". The home page uses this to surface:
//
//   • Continue — the most recent blank recall that still has uncovered
//     concepts (i.e. an open pedagogical loop the student hasn't closed).
//   • Open loops — a count of how many other specs are in that same state.
//
// Anonymous users get an empty list. No writes here — blank recalls are
// written via useHighScores.logBlankRecall elsewhere.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface BlankRecallHistoryRow {
  id: string;
  spec_id: number;
  concepts_total: number;
  concepts_covered: number;
  submitted_at: string;
}

export function useBlankRecalls() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BlankRecallHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setRows([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("user_blank_recalls")
        .select("id, spec_id, concepts_total, concepts_covered, submitted_at")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(500);

      if (cancelled) return;

      if (error) {
        console.error("[useBlankRecalls] fetch error:", error);
        setLoading(false);
        return;
      }

      const mapped: BlankRecallHistoryRow[] = (data ?? []).map((row) => ({
        id: row.id,
        spec_id: row.spec_id,
        concepts_total: row.concepts_total ?? 0,
        concepts_covered: row.concepts_covered ?? 0,
        submitted_at: row.submitted_at,
      }));

      setRows(mapped);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  /**
   * One entry per spec — the most recent attempt. Because rows are fetched
   * in descending order, the first time we see a spec_id is its latest.
   */
  const latestBySpec = useMemo<Record<number, BlankRecallHistoryRow>>(() => {
    const out: Record<number, BlankRecallHistoryRow> = {};
    for (const r of rows) {
      if (!(r.spec_id in out)) out[r.spec_id] = r;
    }
    return out;
  }, [rows]);

  /**
   * The "Continue" candidate — the most recent attempt (any spec) that has
   * uncovered concepts AND where that latest attempt was the one with gaps.
   * Returns null if every recent blank recall is fully covered.
   */
  const continueCandidate = useMemo<BlankRecallHistoryRow | null>(() => {
    for (const r of rows) {
      const latest = latestBySpec[r.spec_id];
      if (latest.id !== r.id) continue; // older attempt, skip
      if (latest.concepts_total > 0 && latest.concepts_covered < latest.concepts_total) {
        return latest;
      }
    }
    return null;
  }, [rows, latestBySpec]);

  /**
   * All specs whose latest blank recall has uncovered concepts.
   * Sorted by submission time, most recent first.
   */
  const openLoops = useMemo<BlankRecallHistoryRow[]>(() => {
    const out: BlankRecallHistoryRow[] = [];
    const seen = new Set<number>();
    for (const r of rows) {
      if (seen.has(r.spec_id)) continue;
      seen.add(r.spec_id);
      if (r.concepts_total > 0 && r.concepts_covered < r.concepts_total) {
        out.push(r);
      }
    }
    return out;
  }, [rows]);

  const missingCount = useCallback(
    (specId: number): number => {
      const latest = latestBySpec[specId];
      if (!latest) return 0;
      return Math.max(0, latest.concepts_total - latest.concepts_covered);
    },
    [latestBySpec]
  );

  return {
    loading,
    rows,
    latestBySpec,
    continueCandidate,
    openLoops,
    missingCount,
  };
}
