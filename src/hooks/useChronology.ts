// =============================================================================
// useChronology — chronology_questions fetcher
// =============================================================================
// Pulls the curated chronology question bank out of Supabase. Three modes:
//
//   • place_in_time  — "Which period does X belong to?" 4-option multiple choice
//   • identify       — "Who/what was X?" free-text recall with self-assess
//   • sequence       — "Put these events in chronological order" drag-to-reorder
//
// The whole pool is pulled once and cached forever via React Query — there
// are only ~180 questions across the three modes, so loading them all is
// trivial, and filtering client-side keeps the mode pages instant when the
// student bounces between them.
// =============================================================================

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChronologySequenceItem } from "@/types/supabase-helpers";

export type ChronologyMode = "place_in_time" | "identify" | "sequence";

export interface ChronologyRow {
  id: string;
  mode: ChronologyMode;
  question_text: string;
  correct_part: number | null; // legacy field — kept for backwards compat, unused by new MCQ UI
  correct_answer: string | null; // only for identify
  sequence_data: ChronologySequenceItem[] | null; // only for sequence
  options: string[] | null; // only for place_in_time (4 option descriptions)
  correct_option_index: number | null; // only for place_in_time (0–3)
  hint_date: string | null;
  source: string | null;
}

function useChronologyQuery() {
  return useQuery({
    queryKey: ["chronology_questions"],
    queryFn: async (): Promise<ChronologyRow[]> => {
      const { data, error } = await supabase
        .from("chronology_questions")
        .select("*");
      if (error) throw error;
      return (data ?? []) as ChronologyRow[];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useAllChronology(): ChronologyRow[] {
  const { data } = useChronologyQuery();
  return data ?? [];
}

/** Whether the initial chronology fetch is still in flight. */
export function useChronologyLoading(): boolean {
  const { isPending } = useChronologyQuery();
  return isPending;
}

export function useChronologyByMode(mode: ChronologyMode): ChronologyRow[] {
  const all = useAllChronology();
  return useMemo(() => all.filter((q) => q.mode === mode), [all, mode]);
}

export interface ChronologyModeStats {
  place_in_time: number;
  identify: number;
  sequence: number;
  total: number;
}

export function useChronologyStats(): ChronologyModeStats {
  const all = useAllChronology();
  return useMemo(() => {
    const stats: ChronologyModeStats = {
      place_in_time: 0,
      identify: 0,
      sequence: 0,
      total: all.length,
    };
    for (const q of all) stats[q.mode] += 1;
    return stats;
  }, [all]);
}
