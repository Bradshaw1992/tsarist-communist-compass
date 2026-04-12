// =============================================================================
// useHighScores
// =============================================================================
// Centralised progress + session-logging hook. The name is historical — it
// began life as a pure localStorage "high score per spec point" tracker.
// Now it does three jobs:
//
//   1. Keeps the `scores` aggregate (highScore + lastAttempted per spec_id)
//      in React state + localStorage, so the topic grid / sidebar can light
//      up mastered topics instantly on page load.
//
//   2. Exposes `logSession` and `logBlankRecall` which persist full session
//      rows to Supabase (user_sessions / user_blank_recalls) when a user is
//      signed in. In anonymous mode these are no-ops for Supabase and just
//      update the local aggregate.
//
//   3. On sign-in, it hydrates `scores` from Supabase so progress carries
//      across devices. Local and remote are merged by taking the max
//      percentage per spec_id.
//
// IMPORTANT: this hook should only be instantiated ONCE in the component
// tree (currently at Index.tsx). Components that need to log sessions
// receive `logSession` / `logBlankRecall` as callback props — otherwise
// multiple hook instances would each hold their own copy of `scores` and
// localStorage updates from one wouldn't be visible to the other until
// the next render cycle.
// =============================================================================

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  ConceptResult,
  Json,
  PerQuestionEntry,
} from "@/integrations/supabase/types";

export interface TopicProgress {
  highScore: number; // percentage 0-100
  total: number;
  correct: number;
  lastAttempted: string; // ISO date string
}

export type DrillerActivityType = "knowledge_driller" | "concept_driller";

export interface DrillerSessionInput {
  activity_type: DrillerActivityType;
  spec_id: number;
  total_questions: number;
  correct_count: number;
  per_question: PerQuestionEntry[];
  metadata?: Record<string, unknown>;
}

export interface BlankRecallInput {
  spec_id: number;
  written_text: string;
  concepts_total: number;
  concepts_covered: number;
  concept_results: ConceptResult[];
  ai_feedback?: string | null;
}

const STORAGE_KEY = "russia-revision-progress";

function loadAll(): Record<number, TopicProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<number, TopicProgress>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full / disabled — fail silently.
  }
}

export function useHighScores() {
  const { user } = useAuth();
  const [scores, setScores] = useState<Record<number, TopicProgress>>(loadAll);

  // ---- Sync across tabs --------------------------------------------------
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setScores(loadAll());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // ---- Hydrate from Supabase on sign-in ----------------------------------
  // Pulls the most recent 500 completed sessions for this user and merges
  // them into the local map. We keep the local max wherever it's higher
  // (e.g. user scored 100% offline and the local value is the truth).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("user_sessions")
        .select("spec_id, correct_count, total_questions, completed_at")
        .eq("user_id", user.id)
        .not("spec_id", "is", null)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(500);

      if (cancelled) return;
      if (error) {
        console.error("[useHighScores] hydrate error:", error);
        return;
      }
      if (!data || data.length === 0) return;

      setScores((prev) => {
        const merged: Record<number, TopicProgress> = { ...prev };
        for (const row of data) {
          if (
            row.spec_id == null ||
            row.total_questions == null ||
            row.correct_count == null ||
            row.total_questions === 0
          ) {
            continue;
          }
          const pct = Math.round(
            (row.correct_count / row.total_questions) * 100
          );
          const existing = merged[row.spec_id];
          if (!existing || pct > existing.highScore) {
            merged[row.spec_id] = {
              highScore: pct,
              total: row.total_questions,
              correct: row.correct_count,
              lastAttempted: row.completed_at ?? new Date().toISOString(),
            };
          } else if (
            row.completed_at &&
            row.completed_at > existing.lastAttempted
          ) {
            // Not a new high, but more recent — update the timestamp only.
            merged[row.spec_id] = {
              ...existing,
              lastAttempted: row.completed_at,
            };
          }
        }
        saveAll(merged);
        return merged;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ---- Aggregate updater (purely local) ---------------------------------
  const recordScore = useCallback(
    (specId: number, correct: number, total: number) => {
      setScores((prev) => {
        const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
        const existing = prev[specId];
        const isNewHigh = !existing || pct > existing.highScore;
        const next: Record<number, TopicProgress> = {
          ...prev,
          [specId]: {
            highScore: isNewHigh ? pct : existing.highScore,
            total,
            correct: isNewHigh ? correct : existing.correct,
            lastAttempted: new Date().toISOString(),
          },
        };
        saveAll(next);
        return next;
      });
    },
    []
  );

  // ---- Session loggers --------------------------------------------------
  const logSession = useCallback(
    async (input: DrillerSessionInput) => {
      // Always update the in-memory + localStorage aggregate first.
      recordScore(input.spec_id, input.correct_count, input.total_questions);

      if (!user) return;

      const { error } = await supabase.from("user_sessions").insert({
        user_id: user.id,
        activity_type: input.activity_type,
        spec_id: input.spec_id,
        total_questions: input.total_questions,
        correct_count: input.correct_count,
        per_question: input.per_question,
        metadata: ((input.metadata ?? {}) as unknown) as Json,
        completed_at: new Date().toISOString(),
      });

      if (error) {
        console.error("[useHighScores] logSession insert failed:", error);
      }
    },
    [user, recordScore]
  );

  const logBlankRecall = useCallback(
    async (input: BlankRecallInput) => {
      recordScore(
        input.spec_id,
        input.concepts_covered,
        input.concepts_total
      );

      if (!user) return;

      const { error } = await supabase.from("user_blank_recalls").insert({
        user_id: user.id,
        spec_id: input.spec_id,
        written_text: input.written_text,
        concepts_total: input.concepts_total,
        concepts_covered: input.concepts_covered,
        concept_results: input.concept_results,
        ai_feedback: input.ai_feedback ?? null,
      });

      if (error) {
        console.error("[useHighScores] logBlankRecall insert failed:", error);
      }
    },
    [user, recordScore]
  );

  const getProgress = useCallback(
    (specId: number): TopicProgress | undefined => scores[specId],
    [scores]
  );

  return {
    scores,
    recordScore,
    logSession,
    logBlankRecall,
    getProgress,
  };
}
