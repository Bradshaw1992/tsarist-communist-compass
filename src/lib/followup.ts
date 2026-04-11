// =============================================================================
// Blank Recall → follow-up driller question builder
// =============================================================================
// When a student finishes a Blank Recall with some concepts marked "missed",
// we want to pull a small batch of Knowledge Driller questions that target
// exactly those gaps — so they can close the loop without leaving the flow.
//
// Matching rule:
//   - For each missed concept, look up its trigger_keywords (the same set the
//     marker used to decide the concept was covered).
//   - A fact question matches the concept if its question text or answer
//     contains any of those keywords (case-insensitive substring).
//   - Aggregate matches across all missed concepts, de-duplicated by question id.
//   - Cap at `maxCount` (default 10).
//   - If we end up with fewer than `maxCount`, top up with random unused fact
//     questions from the same spec so the student always gets a full session.
// =============================================================================

import type { FactDrillerQuestion, KeyConcept } from "@/types/revision";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalise(s: string): string {
  return s.toLowerCase();
}

function questionMatchesKeyword(q: FactDrillerQuestion, keyword: string): boolean {
  const kw = normalise(keyword.trim());
  if (kw.length < 3) return false; // don't match "a", "or", etc.
  const haystack = normalise(`${q.question} ${q.answer}`);
  return haystack.includes(kw);
}

export interface FollowUpBuildInput {
  /** Concept texts the student missed, as returned by the recall marker. */
  missedConcepts: string[];
  /** The full KeyConcept list from recall_content for this spec. */
  allConcepts: KeyConcept[];
  /** Full fact question pool for this spec. */
  factQuestions: FactDrillerQuestion[];
  /** Cap on the number of questions returned. */
  maxCount?: number;
}

export interface FollowUpBuildResult {
  /** The filtered + topped-up list of fact questions, in session order. */
  questions: FactDrillerQuestion[];
  /** How many of those matched a missed concept directly. */
  matchedCount: number;
  /** How many are random top-ups added because matches were thin. */
  toppedUpCount: number;
  /** The missed concepts that actually produced at least one match. */
  coveredConcepts: string[];
}

export function buildFollowUpFactQuestions({
  missedConcepts,
  allConcepts,
  factQuestions,
  maxCount = 10,
}: FollowUpBuildInput): FollowUpBuildResult {
  // Look up trigger keywords for each missed concept.
  const conceptMap = new Map<string, KeyConcept>();
  for (const kc of allConcepts) {
    conceptMap.set(kc.concept, kc);
  }

  // For each missed concept, collect the fact questions that match.
  const bucketPerConcept: { concept: string; questions: FactDrillerQuestion[] }[] = [];
  for (const name of missedConcepts) {
    const kc = conceptMap.get(name);
    if (!kc || kc.trigger_keywords.length === 0) continue;

    const matches: FactDrillerQuestion[] = [];
    for (const q of factQuestions) {
      if (kc.trigger_keywords.some((kw) => questionMatchesKeyword(q, kw))) {
        matches.push(q);
      }
    }
    if (matches.length > 0) {
      bucketPerConcept.push({ concept: name, questions: matches });
    }
  }

  // Round-robin through concepts so every missed concept gets at least one
  // slot before any concept gets a second. This matters when the pool is thin.
  const pickedIds = new Set<string>();
  const picked: FactDrillerQuestion[] = [];
  const coveredConcepts: string[] = [];

  let stillAdding = true;
  while (stillAdding && picked.length < maxCount) {
    stillAdding = false;
    for (const bucket of bucketPerConcept) {
      if (picked.length >= maxCount) break;
      const next = bucket.questions.find((q) => !pickedIds.has(q.id));
      if (next) {
        picked.push(next);
        pickedIds.add(next.id);
        if (!coveredConcepts.includes(bucket.concept)) {
          coveredConcepts.push(bucket.concept);
        }
        stillAdding = true;
      }
    }
  }

  const matchedCount = picked.length;

  // Top up with random unused fact questions if we're short. This keeps the
  // session length predictable even when the keyword match is thin.
  if (picked.length < maxCount && factQuestions.length > picked.length) {
    const leftovers = factQuestions.filter((q) => !pickedIds.has(q.id));
    const toAdd = shuffle(leftovers).slice(0, maxCount - picked.length);
    picked.push(...toAdd);
  }

  const toppedUpCount = picked.length - matchedCount;

  // Shuffle the final pool so topped-up questions aren't clumped at the end.
  return {
    questions: shuffle(picked),
    matchedCount,
    toppedUpCount,
    coveredConcepts,
  };
}
