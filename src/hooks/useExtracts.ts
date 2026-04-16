// =============================================================================
// useExtracts — extract_sets + extracts fetcher
// =============================================================================
// Pulls all extract sets and their associated extracts from Supabase, cached
// forever via React Query (small dataset, ~5 sets × 3 extracts = trivial).
//
// Each extract set contains a question stem + 3 historian extracts with
// indicative content for self-marking (AQA Section A style).
// =============================================================================

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ExtractData {
  id: string;
  extract_set_id: string;
  label: "A" | "B" | "C";
  historian: string;
  citation: string;
  body: string;
  overall_argument: string;
  sub_arguments: string[];
  corroborating_knowledge: string[];
  challenging_knowledge: string[];
  is_flawed: boolean;
  flaw_notes: string | null;
  position: number;
}

export interface ExtractSetData {
  id: string;
  topic: string;
  date_range: string;
  part_number: number;
  spec_points: number[];
  question_stem: string;
  extracts: ExtractData[];
}

function useExtractSetsQuery() {
  return useQuery({
    queryKey: ["extract_sets"],
    queryFn: async (): Promise<ExtractSetData[]> => {
      // Fetch sets
      const { data: sets, error: setsErr } = await supabase
        .from("extract_sets")
        .select("*")
        .order("part_number");
      if (setsErr) throw setsErr;

      // Fetch all extracts
      const { data: extracts, error: extErr } = await supabase
        .from("extracts")
        .select("*")
        .order("position");
      if (extErr) throw extErr;

      // Merge extracts into sets
      const extBySet = new Map<string, ExtractData[]>();
      for (const e of extracts ?? []) {
        const parsed: ExtractData = {
          id: e.id,
          extract_set_id: e.extract_set_id,
          label: e.label as "A" | "B" | "C",
          historian: e.historian,
          citation: e.citation,
          body: e.body,
          overall_argument: e.overall_argument,
          sub_arguments: (e.sub_arguments as string[]) ?? [],
          corroborating_knowledge: (e.corroborating_knowledge as string[]) ?? [],
          challenging_knowledge: (e.challenging_knowledge as string[]) ?? [],
          is_flawed: e.is_flawed ?? false,
          flaw_notes: e.flaw_notes ?? null,
          position: e.position ?? 1,
        };
        const list = extBySet.get(e.extract_set_id) ?? [];
        list.push(parsed);
        extBySet.set(e.extract_set_id, list);
      }

      return (sets ?? []).map((s) => ({
        id: s.id,
        topic: s.topic,
        date_range: s.date_range,
        part_number: s.part_number,
        spec_points: s.spec_points ?? [],
        question_stem: s.question_stem,
        extracts: extBySet.get(s.id) ?? [],
      }));
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useAllExtractSets(): ExtractSetData[] {
  const { data } = useExtractSetsQuery();
  return data ?? [];
}

export function useExtractSetsLoading(): boolean {
  const { isPending } = useExtractSetsQuery();
  return isPending;
}

export function useExtractSetById(id: string): ExtractSetData | undefined {
  const all = useAllExtractSets();
  return useMemo(() => all.find((s) => s.id === id), [all, id]);
}

export function useExtractSetsByPart(part: number): ExtractSetData[] {
  const all = useAllExtractSets();
  return useMemo(() => all.filter((s) => s.part_number === part), [all, part]);
}

export interface ExtractStats {
  total: number;
  byPart: Record<number, number>;
}

export function useExtractStats(): ExtractStats {
  const all = useAllExtractSets();
  return useMemo(() => {
    const byPart: Record<number, number> = {};
    for (const s of all) {
      byPart[s.part_number] = (byPart[s.part_number] ?? 0) + 1;
    }
    return { total: all.length, byPart };
  }, [all]);
}
