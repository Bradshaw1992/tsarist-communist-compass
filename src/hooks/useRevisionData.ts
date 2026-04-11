import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  ExamQuestion,
  FactDrillerQuestion,
  KeyConcept,
  QuizQuestion,
} from "@/types/revision";

// ----------------------------------------------------------------------------
// Spec points
// ----------------------------------------------------------------------------

export interface SpecPoint {
  id: number;
  part: number;
  section: string;
  title: string;
  short_title: string | null;
  ko_file: string | null;
  sort_order: number;
}

function useSpecPointsQuery() {
  return useQuery({
    queryKey: ["spec_points"],
    queryFn: async (): Promise<SpecPoint[]> => {
      const { data, error } = await supabase
        .from("spec_points")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpecPoint[];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useSpecPoints(): SpecPoint[] {
  const { data } = useSpecPointsQuery();
  return data ?? [];
}

export function useSpecPoint(
  specId: number | null | undefined
): SpecPoint | undefined {
  const points = useSpecPoints();
  return useMemo(
    () => (specId == null ? undefined : points.find((p) => p.id === specId)),
    [points, specId]
  );
}

export function useSpecPointSections() {
  const points = useSpecPoints();
  return useMemo(() => {
    const sections: { title: string; points: SpecPoint[] }[] = [];
    const map = new Map<string, SpecPoint[]>();
    for (const sp of points) {
      if (!map.has(sp.section)) {
        map.set(sp.section, []);
        sections.push({ title: sp.section, points: map.get(sp.section)! });
      }
      map.get(sp.section)!.push(sp);
    }
    return sections;
  }, [points]);
}

export function useTopicNameForSpec(specId: number): string {
  const sp = useSpecPoint(specId);
  return sp?.short_title ?? sp?.title ?? `Topic ${specId}`;
}

// ----------------------------------------------------------------------------
// Blank Recall content
// ----------------------------------------------------------------------------

export interface LegacyRecall {
  spec_id: number;
  title: string;
  section: string;
  summary: { sections: { heading: string; content: string[] }[] };
  key_concepts: KeyConcept[];
}

export function useRecallForSpec(specId: number): LegacyRecall | undefined {
  const sp = useSpecPoint(specId);
  const { data } = useQuery({
    queryKey: ["recall_content", specId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recall_content")
        .select("*")
        .eq("spec_id", specId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!specId,
  });

  return useMemo(() => {
    if (!data || !sp) return undefined;
    const rawSummary = (data.summary as unknown) as
      | { sections?: { heading: string; content: string[] }[] }
      | null;
    return {
      spec_id: data.spec_id,
      title: sp.title,
      section: sp.section,
      summary: { sections: rawSummary?.sections ?? [] },
      key_concepts: (data.key_concepts as unknown as KeyConcept[]) ?? [],
    };
  }, [data, sp]);
}

// ----------------------------------------------------------------------------
// Essay Bank (was Exam Architect) — past paper essays
// ----------------------------------------------------------------------------

export function useExamQuestionsForSpec(specId: number): ExamQuestion[] {
  const { data } = useQuery({
    queryKey: ["exam_questions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_questions")
        .select("*")
        .order("year", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return useMemo(() => {
    if (!data) return [];
    return data
      .filter((q) => Array.isArray(q.spec_ids) && q.spec_ids.includes(specId))
      .map<ExamQuestion>((q) => {
        const sf =
          ((q.source_files as unknown) as
            | { question_paper?: string; mark_scheme?: string }
            | null) ?? null;
        return {
          id: q.id,
          year: q.year,
          section: q.section,
          question_number: q.question_number ?? "",
          question_type: q.question_type ?? "essay",
          marks: q.marks ?? 0,
          question_text: q.question_text,
          spec_ids: q.spec_ids ?? [],
          indicative_content: q.indicative_content ?? "",
          source_files: {
            question_paper: sf?.question_paper ?? "",
            mark_scheme: sf?.mark_scheme ?? "",
          },
          time_period: q.time_period ?? "",
        };
      });
  }, [data, specId]);
}

// ----------------------------------------------------------------------------
// Concept Driller (was Precision Driller / tab_driller)
// ----------------------------------------------------------------------------

export function useQuizQuestionsForSpec(specId: number): QuizQuestion[] {
  const { data } = useQuery({
    queryKey: ["concept_questions", specId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("concept_questions")
        .select("*")
        .eq("spec_id", specId);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!specId,
  });

  return useMemo(() => {
    if (!data) return [];
    return data.map<QuizQuestion>((q) => ({
      id: q.legacy_id ?? q.id,
      spec_id: q.spec_id,
      question_type: q.question_type ?? "significance",
      question_text: q.question_text,
      correct_answer: q.correct_answer,
      ko_terms_used: (q.ko_terms_used as unknown as string[]) ?? [],
      good_answer_synonym: q.good_answer_synonym ?? "",
      level_3_feedback: {
        workpack_ref: q.workpack_ref ?? "",
        textbook_ref: q.textbook_ref ?? "",
      },
    }));
  }, [data]);
}

// ----------------------------------------------------------------------------
// Knowledge Driller (was Specific Knowledge / fact_driller)
// ----------------------------------------------------------------------------

export function useFactDrillerForSpec(specId: number): FactDrillerQuestion[] {
  const { data } = useQuery({
    queryKey: ["fact_questions", specId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fact_questions")
        .select("*")
        .eq("spec_id", specId);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: !!specId,
  });

  return useMemo(() => {
    if (!data) return [];
    return data.map<FactDrillerQuestion>((q) => ({
      id: q.id,
      spec_point_id: q.spec_id,
      question: q.question,
      answer: q.answer,
      valid_synonyms: (q.valid_synonyms as unknown as string[]) ?? [],
    }));
  }, [data]);
}
