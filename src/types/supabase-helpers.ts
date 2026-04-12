// Local type definitions for types that the auto-generated supabase types.ts
// doesn't export. These are domain types used across the app.

/** Shape of a single item in a chronology sequence_data JSONB array. */
export interface ChronologySequenceItem {
  event: string;
  date: string;
}

/** Shape of a per-question entry stored in user_sessions.per_question JSONB. */
export interface PerQuestionEntry {
  question_id: string;
  question_text: string;
  user_input?: string;
  result: string;
  // Alternative field names used in some contexts
  correct_answer?: string;
  user_answer?: string;
  is_correct?: boolean;
}

/** Shape of a concept result stored in user_blank_recalls.concept_results JSONB. */
export interface ConceptResult {
  concept: string;
  covered: boolean;
  trigger_keywords?: string[];
}
