// =============================================================================
// useQuestionFlags — flag questions + teacher view of flagged questions
// =============================================================================
// Two use cases:
//   1. Student: flagQuestion(questionTable, questionId, specId, reason?)
//      — inserts a flag row, idempotent (unique constraint)
//   2. Teacher: useTeacherFlags() — fetches all unresolved flags with counts,
//      plus resolveFlag(flagId) and deleteQuestion(questionTable, questionId)
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ---- Student: flag a question -----------------------------------------------

export function useFlagQuestion() {
  const { user } = useAuth();

  const flagQuestion = useCallback(
    async (
      questionTable: "fact_questions" | "concept_questions",
      questionId: string,
      specId: number | null,
      reason?: string
    ): Promise<boolean> => {
      if (!user) return false;

      const { error } = await (supabase as any).from("question_flags").insert({
        question_table: questionTable,
        question_id: questionId,
        spec_id: specId ?? undefined,
        flagged_by: user.id,
        reason: reason ?? null,
      });

      if (error) {
        // Duplicate flag is fine (unique constraint)
        if (error.code === "23505") return true;
        console.error("[useFlagQuestion] error:", error);
        return false;
      }
      return true;
    },
    [user]
  );

  return { flagQuestion };
}

// ---- Teacher: view and manage flags -----------------------------------------

export interface FlaggedQuestion {
  questionTable: "fact_questions" | "concept_questions";
  questionId: string;
  specId: number | null;
  flagCount: number;
  reasons: string[];
  flagIds: string[];
  firstFlaggedAt: string;
  // The actual question content (fetched separately)
  questionText: string;
  answerText: string;
}

export function useTeacherFlags() {
  const { user, isTeacher } = useAuth();
  const [flags, setFlags] = useState<FlaggedQuestion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFlags = useCallback(async () => {
    if (!user || !isTeacher) {
      setFlags([]);
      return;
    }
    setLoading(true);

    // Get all unresolved flags
    const { data, error } = await (supabase as any)
      .from("question_flags")
      .select("*")
      .is("resolved_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[useTeacherFlags] fetch error:", error);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setFlags([]);
      setLoading(false);
      return;
    }

    // Group by question
    const grouped = new Map<
      string,
      {
        questionTable: "fact_questions" | "concept_questions";
        questionId: string;
        specId: number | null;
        flagCount: number;
        reasons: string[];
        flagIds: string[];
        firstFlaggedAt: string;
      }
    >();

    for (const f of data) {
      const key = `${f.question_table}:${f.question_id}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.flagCount += 1;
        if (f.reason) existing.reasons.push(f.reason);
        existing.flagIds.push(f.id);
        if (f.created_at < existing.firstFlaggedAt) {
          existing.firstFlaggedAt = f.created_at;
        }
      } else {
        grouped.set(key, {
          questionTable: f.question_table as "fact_questions" | "concept_questions",
          questionId: f.question_id,
          specId: f.spec_id,
          flagCount: 1,
          reasons: f.reason ? [f.reason] : [],
          flagIds: [f.id],
          firstFlaggedAt: f.created_at,
        });
      }
    }

    // Fetch the actual question text for each flagged question
    const factIds = [...grouped.values()]
      .filter((g) => g.questionTable === "fact_questions")
      .map((g) => g.questionId);
    const conceptIds = [...grouped.values()]
      .filter((g) => g.questionTable === "concept_questions")
      .map((g) => g.questionId);

    const questionTexts = new Map<string, { q: string; a: string }>();

    if (factIds.length > 0) {
      const { data: facts } = await (supabase as any)
        .from("fact_questions")
        .select("id, question, answer")
        .in("id", factIds);
      for (const f of facts ?? []) {
        questionTexts.set(f.id, { q: f.question, a: f.answer });
      }
    }

    if (conceptIds.length > 0) {
      const { data: concepts } = await (supabase as any)
        .from("concept_questions")
        .select("id, question_text, correct_answer")
        .in("id", conceptIds);
      for (const c of concepts ?? []) {
        questionTexts.set(c.id, { q: c.question_text, a: c.correct_answer });
      }
    }

    // Build final array, sorted by flag count (most flagged first)
    const result: FlaggedQuestion[] = [...grouped.values()]
      .map((g) => {
        const texts = questionTexts.get(g.questionId);
        return {
          ...g,
          questionText: texts?.q ?? "(question deleted)",
          answerText: texts?.a ?? "",
        };
      })
      .sort((a, b) => b.flagCount - a.flagCount);

    setFlags(result);
    setLoading(false);
  }, [user, isTeacher]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  // Resolve all flags for a question (dismiss them)
  const resolveFlags = useCallback(
    async (flagIds: string[]): Promise<boolean> => {
      if (!user) return false;
      const { error } = await (supabase as any)
        .from("question_flags")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .in("id", flagIds);

      if (error) {
        console.error("[useTeacherFlags] resolve error:", error);
        return false;
      }

      setFlags((prev) =>
        prev.filter((f) => !flagIds.some((id) => f.flagIds.includes(id)))
      );
      return true;
    },
    [user]
  );

  // Delete the question from the live table + resolve flags
  const deleteQuestion = useCallback(
    async (
      questionTable: "fact_questions" | "concept_questions",
      questionId: string,
      flagIds: string[]
    ): Promise<boolean> => {
      if (!user) return false;

      const { error } = await (supabase as any)
        .from(questionTable)
        .delete()
        .eq("id", questionId);

      if (error) {
        console.error("[useTeacherFlags] delete question error:", error);
        return false;
      }

      // Resolve the flags
      await resolveFlags(flagIds);
      return true;
    },
    [user, resolveFlags]
  );

  return { flags, loading, fetchFlags, resolveFlags, deleteQuestion };
}
