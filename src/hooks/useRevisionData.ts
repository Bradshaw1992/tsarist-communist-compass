import { useMemo } from "react";
import data from "@/data/revision_database.json";
import type { RevisionDatabase } from "@/types/revision";

const db = data as RevisionDatabase;

export function useRevisionData() {
  return db;
}

export function useSpecPointSections() {
  return useMemo(() => {
    const sections: { title: string; points: typeof db.spec_points }[] = [];
    const map = new Map<string, typeof db.spec_points>();
    for (const sp of db.spec_points) {
      if (!map.has(sp.section)) {
        map.set(sp.section, []);
        sections.push({ title: sp.section, points: map.get(sp.section)! });
      }
      map.get(sp.section)!.push(sp);
    }
    return sections;
  }, []);
}

export function useRecallForSpec(specId: number) {
  return useMemo(() => db.tab_recall.find((r) => r.spec_id === specId), [specId]);
}

export function useExamQuestionsForSpec(specId: number) {
  return useMemo(() => db.exam_questions.filter((q) => q.spec_ids.includes(specId)), [specId]);
}

export function useQuizQuestionsForSpec(specId: number) {
  return useMemo(() => db.quiz_questions.filter((q) => q.spec_id === specId), [specId]);
}
