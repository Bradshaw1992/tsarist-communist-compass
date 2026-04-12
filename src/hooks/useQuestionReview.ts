// =============================================================================
// useQuestionReview — hook for the Question Review Pipeline
// =============================================================================
// Fetches items from `question_review_queue` and provides actions:
//   - approve(id, editedData?) → inserts into live table, marks approved
//   - reject(id, reason?) → marks rejected
//   - addDirect(targetTable, specId, data) → bypasses queue, straight to live
//
// Only usable by teachers (RLS enforced on the DB side).
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

// ---- Types ------------------------------------------------------------------

export interface ReviewItem {
  id: string;
  specId: number;
  targetTable: "fact_questions" | "concept_questions";
  questionData: FactQuestionData | ConceptQuestionData;
  source: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface FactQuestionData {
  question: string;
  answer: string;
  valid_synonyms?: string[];
}

export interface ConceptQuestionData {
  question_text: string;
  correct_answer: string;
  question_type?: string;
  ko_terms_used?: string[];
  good_answer_synonym?: string;
  workpack_ref?: string;
  textbook_ref?: string;
}

type StatusFilter = "pending" | "approved" | "rejected";

// ---- Hook -------------------------------------------------------------------

export function useQuestionReview() {
  const { user, isTeacher } = useAuth();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  const fetchItems = useCallback(
    async (status: StatusFilter = "pending") => {
      if (!user || !isTeacher) {
        setItems([]);
        return;
      }
      setLoading(true);

      const { data, error } = await supabase
        .from("question_review_queue")
        .select("*")
        .eq("status", status)
        .order("submitted_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("[useQuestionReview] fetch error:", error);
        setLoading(false);
        return;
      }

      setItems(
        (data ?? []).map((r) => ({
          id: r.id,
          specId: r.spec_id,
          targetTable: r.target_table as "fact_questions" | "concept_questions",
          questionData: r.question_data as unknown as
            | FactQuestionData
            | ConceptQuestionData,
          source: r.source,
          status: r.status as "pending" | "approved" | "rejected",
          rejectionReason: r.rejection_reason,
          submittedAt: r.submitted_at,
          reviewedAt: r.reviewed_at,
        }))
      );
      setLoading(false);
    },
    [user, isTeacher]
  );

  // Fetch counts for all statuses
  const fetchCounts = useCallback(async () => {
    if (!user || !isTeacher) return;

    const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
      supabase
        .from("question_review_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("question_review_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),
      supabase
        .from("question_review_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "rejected"),
    ]);

    setCounts({
      pending: pendingRes.count ?? 0,
      approved: approvedRes.count ?? 0,
      rejected: rejectedRes.count ?? 0,
    });
  }, [user, isTeacher]);

  useEffect(() => {
    fetchItems("pending");
    fetchCounts();
  }, [fetchItems, fetchCounts]);

  // ---- Actions --------------------------------------------------------------

  const approve = async (
    id: string,
    editedData?: FactQuestionData | ConceptQuestionData
  ): Promise<boolean> => {
    const item = items.find((i) => i.id === id);
    if (!item || !user) return false;

    const data = editedData ?? item.questionData;

    // Insert into the live table
    if (item.targetTable === "fact_questions") {
      const fd = data as FactQuestionData;
      const { error: insertErr } = await supabase
        .from("fact_questions")
        .insert({
          spec_id: item.specId,
          question: fd.question,
          answer: fd.answer,
          valid_synonyms: (fd.valid_synonyms ?? []) as unknown as Json,
          source: "reviewed",
        });
      if (insertErr) {
        console.error("[useQuestionReview] insert fact error:", insertErr);
        return false;
      }
    } else {
      const cd = data as ConceptQuestionData;
      const { error: insertErr } = await supabase
        .from("concept_questions")
        .insert({
          spec_id: item.specId,
          question_text: cd.question_text,
          correct_answer: cd.correct_answer,
          question_type: cd.question_type ?? null,
          ko_terms_used: (cd.ko_terms_used ?? []) as unknown as Json,
          good_answer_synonym: cd.good_answer_synonym ?? null,
          workpack_ref: cd.workpack_ref ?? null,
          textbook_ref: cd.textbook_ref ?? null,
          source: "reviewed",
        });
      if (insertErr) {
        console.error("[useQuestionReview] insert concept error:", insertErr);
        return false;
      }
    }

    // Mark as approved in the queue
    const { error: updateErr } = await supabase
      .from("question_review_queue")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        // If edited, save the edited version back
        ...(editedData ? { question_data: editedData as unknown as Json } : {}),
      })
      .eq("id", id);

    if (updateErr) {
      console.error("[useQuestionReview] approve error:", updateErr);
      return false;
    }

    // Remove from local state
    setItems((prev) => prev.filter((i) => i.id !== id));
    setCounts((prev) => ({
      ...prev,
      pending: Math.max(0, prev.pending - 1),
      approved: prev.approved + 1,
    }));
    return true;
  };

  const reject = async (id: string, reason?: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from("question_review_queue")
      .update({
        status: "rejected",
        rejection_reason: reason ?? null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("[useQuestionReview] reject error:", error);
      return false;
    }

    setItems((prev) => prev.filter((i) => i.id !== id));
    setCounts((prev) => ({
      ...prev,
      pending: Math.max(0, prev.pending - 1),
      rejected: prev.rejected + 1,
    }));
    return true;
  };

  // Add a question directly to the live table (bypasses queue)
  const addDirect = async (
    targetTable: "fact_questions" | "concept_questions",
    specId: number,
    data: FactQuestionData | ConceptQuestionData
  ): Promise<boolean> => {
    if (!user || !isTeacher) return false;

    if (targetTable === "fact_questions") {
      const fd = data as FactQuestionData;
      const { error } = await supabase.from("fact_questions").insert({
        spec_id: specId,
        question: fd.question,
        answer: fd.answer,
        valid_synonyms: (fd.valid_synonyms ?? []) as unknown as Json,
        source: "teacher",
      });
      if (error) {
        console.error("[useQuestionReview] addDirect fact error:", error);
        return false;
      }
    } else {
      const cd = data as ConceptQuestionData;
      const { error } = await supabase.from("concept_questions").insert({
        spec_id: specId,
        question_text: cd.question_text,
        correct_answer: cd.correct_answer,
        question_type: cd.question_type ?? null,
        ko_terms_used: (cd.ko_terms_used ?? []) as unknown as Json,
        good_answer_synonym: cd.good_answer_synonym ?? null,
        source: "teacher",
      });
      if (error) {
        console.error("[useQuestionReview] addDirect concept error:", error);
        return false;
      }
    }

    return true;
  };

  return {
    items,
    counts,
    loading,
    fetchItems,
    fetchCounts,
    approve,
    reject,
    addDirect,
  };
}
