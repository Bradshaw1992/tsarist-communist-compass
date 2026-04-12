// =============================================================================
// useWrongAnswers
// =============================================================================
// Central Wrong Answers queue. Every time a student self-assesses a question
// in the Knowledge or Concept Driller, the result flows through this hook:
//
//   - correct:  if there was an unresolved row for that (user, question),
//               we mark it resolved (resolved_at = now).
//   - missed:   we upsert an unresolved row capturing a snapshot of the
//               question + answer so the /review page never has to join
//               against the live content tables.
//
// On sign-in the hook fetches all unresolved rows for the user and keeps them
// in React state. On sign-out we clear the local copy.
//
// Anonymous users get a no-op: writes silently drop and the local list stays
// empty. The caller doesn't need to branch.
//
// IMPORTANT: like useHighScores, this hook should be instantiated ONCE in the
// tree (at Index.tsx) and the callbacks passed down as props. Multiple hook
// instances would each hold their own copy of the queue.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

export type WrongAnswerTable = "fact_questions" | "concept_questions";

/** Shape of an unresolved row as held in memory. */
export interface WrongAnswer {
  id: string; // row uuid
  question_table: WrongAnswerTable;
  question_id: string;
  spec_id: number | null;
  missed_at: string;
  /** Denormalised snapshot so /review can render without a join. */
  snapshot: {
    question: string;
    answer: string;
    spec_title?: string;
  };
}

/** Input fired from the tab components on every self-assessment. */
export interface AssessmentInput {
  question_table: WrongAnswerTable;
  question_id: string;
  spec_id: number;
  question_text: string;
  answer: string;
  spec_title?: string;
  correct: boolean;
}

type SnapshotJson = {
  question: string;
  answer: string;
  spec_title?: string;
};

function snapshotFromRow(raw: unknown): SnapshotJson {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      question: typeof o.question === "string" ? o.question : "",
      answer: typeof o.answer === "string" ? o.answer : "",
      spec_title: typeof o.spec_title === "string" ? o.spec_title : undefined,
    };
  }
  return { question: "", answer: "" };
}

export function useWrongAnswers() {
  const { user } = useAuth();
  const [items, setItems] = useState<WrongAnswer[]>([]);
  const [loading, setLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch unresolved queue on sign-in; clear on sign-out.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("user_wrong_answers")
        .select("id, question_table, question_id, spec_id, missed_at, question_snapshot")
        .eq("user_id", user.id)
        .is("resolved_at", null)
        .order("missed_at", { ascending: false })
        .limit(500);

      if (cancelled) return;

      if (error) {
        console.error("[useWrongAnswers] fetch error:", error);
        setLoading(false);
        return;
      }

      const mapped: WrongAnswer[] = (data ?? []).map((row) => ({
        id: row.id,
        question_table: row.question_table as WrongAnswerTable,
        question_id: row.question_id,
        spec_id: row.spec_id,
        missed_at: row.missed_at,
        snapshot: snapshotFromRow(row.question_snapshot),
      }));

      setItems(mapped);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // -------------------------------------------------------------------------
  // Record a self-assessment. Missed → upsert a new unresolved row. Correct
  // → resolve any matching unresolved row.
  // -------------------------------------------------------------------------
  const recordAssessment = useCallback(
    async (input: AssessmentInput) => {
      if (!user) return;

      if (input.correct) {
        // Resolve any existing unresolved row for this question. We don't care
        // if there isn't one — .update is a no-op in that case.
        const { error } = await supabase
          .from("user_wrong_answers")
          .update({ resolved_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("question_table", input.question_table)
          .eq("question_id", input.question_id)
          .is("resolved_at", null);

        if (error) {
          console.error("[useWrongAnswers] resolve failed:", error);
          return;
        }

        // Drop from local queue.
        setItems((prev) =>
          prev.filter(
            (w) =>
              !(
                w.question_table === input.question_table &&
                w.question_id === input.question_id
              )
          )
        );
        return;
      }

      // Missed — upsert. The schema has a partial unique index on
      // (user_id, question_table, question_id) WHERE resolved_at IS NULL, so
      // a straight insert will collide if the student missed the same
      // question twice. We handle that by checking first.
      const existing = items.find(
        (w) =>
          w.question_table === input.question_table &&
          w.question_id === input.question_id
      );
      if (existing) return; // already on the queue

      const snapshot: SnapshotJson = {
        question: input.question_text,
        answer: input.answer,
        ...(input.spec_title ? { spec_title: input.spec_title } : {}),
      };

      const { data, error } = await supabase
        .from("user_wrong_answers")
        .insert({
          user_id: user.id,
          question_table: input.question_table,
          question_id: input.question_id,
          spec_id: input.spec_id,
          question_snapshot: snapshot as unknown as Json,
        })
        .select("id, missed_at")
        .single();

      if (error) {
        // 23505 = unique_violation — safe to ignore, means there's already
        // an unresolved row we missed in the local cache (e.g. stale state).
        const code = (error as unknown as { code?: string }).code;
        if (code !== "23505") {
          console.error("[useWrongAnswers] miss insert failed:", error);
        }
        return;
      }

      setItems((prev) => [
        {
          id: data.id,
          question_table: input.question_table,
          question_id: input.question_id,
          spec_id: input.spec_id,
          missed_at: data.missed_at,
          snapshot,
        },
        ...prev,
      ]);
    },
    [user, items]
  );

  // -------------------------------------------------------------------------
  // Manually resolve a row by id (from the /review page "I know this now"
  // button). Does the same thing as a correct assessment but keyed by row id.
  // -------------------------------------------------------------------------
  const resolveById = useCallback(
    async (rowId: string) => {
      if (!user) return;

      const { error } = await supabase
        .from("user_wrong_answers")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", rowId)
        .eq("user_id", user.id);

      if (error) {
        console.error("[useWrongAnswers] resolveById failed:", error);
        return;
      }

      setItems((prev) => prev.filter((w) => w.id !== rowId));
    },
    [user]
  );

  // -------------------------------------------------------------------------
  // Quick lookup used by spec-card badges — "3 to review on this topic".
  // -------------------------------------------------------------------------
  const countsBySpec = useCallback((): Record<number, number> => {
    const out: Record<number, number> = {};
    for (const w of items) {
      if (w.spec_id == null) continue;
      out[w.spec_id] = (out[w.spec_id] ?? 0) + 1;
    }
    return out;
  }, [items]);

  // -------------------------------------------------------------------------
  // Spaced repetition — client-side scheduling.
  // An item is "due for review" when missed_at is more than 24h ago.
  // This is a simple v1: miss → wait 1 day → review. Get it right →
  // resolved. Get it wrong → stays in queue, missed_at resets.
  // v2 will add server-side next_review_at + interval_days columns for
  // a proper 1-day / 7-day / cleared schedule.
  // -------------------------------------------------------------------------
  const dueToday = useMemo<WrongAnswer[]>(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return items.filter((w) => new Date(w.missed_at).getTime() <= oneDayAgo);
  }, [items]);

  const dueCount = dueToday.length;

  /** Items missed recently (< 24h) — not yet due but still in queue. */
  const pendingCount = items.length - dueCount;

  /** The single oldest due item — useful for "oldest: X days ago" display. */
  const oldestDueAge = useMemo<number | null>(() => {
    if (dueToday.length === 0) return null;
    const oldest = dueToday.reduce((a, b) =>
      new Date(a.missed_at).getTime() < new Date(b.missed_at).getTime()
        ? a
        : b
    );
    return Math.floor(
      (Date.now() - new Date(oldest.missed_at).getTime()) / (24 * 60 * 60 * 1000)
    );
  }, [dueToday]);

  return {
    items,
    loading,
    recordAssessment,
    resolveById,
    countsBySpec,
    // Spaced rep
    dueToday,
    dueCount,
    pendingCount,
    oldestDueAge,
  };
}
