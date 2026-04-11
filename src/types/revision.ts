// Domain types used by tab components. These are the "legacy shapes" returned
// by the useRevisionData hooks — the hooks translate Supabase rows into these
// shapes so the tab components can stay largely unchanged during the migration.

export interface KeyConcept {
  concept: string;
  trigger_keywords: string[];
}

export interface ExamQuestion {
  id: string;
  year: string;
  section: string;
  question_number: string;
  question_type: string;
  marks: number;
  question_text: string;
  spec_ids: number[];
  indicative_content: string;
  source_files: {
    question_paper: string;
    mark_scheme: string;
  };
  time_period: string;
}

export interface QuizQuestion {
  id: string;
  spec_id: number;
  question_type: string;
  question_text: string;
  correct_answer: string;
  ko_terms_used: string[];
  good_answer_synonym: string;
  level_3_feedback: {
    workpack_ref: string;
    textbook_ref: string;
  };
}

export interface FactDrillerQuestion {
  spec_point_id: number;
  question: string;
  answer: string;
  valid_synonyms: string[];
}
