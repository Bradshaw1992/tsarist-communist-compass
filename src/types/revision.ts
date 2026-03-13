export interface SpecPoint {
  id: number;
  section: string;
  title: string;
  ko_file: string;
}

export interface RecallSummary {
  spec_id: number;
  title: string;
  section: string;
  summary: {
    sections: { heading: string; content: string[] }[];
    full_text: string;
  };
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
  indicative_content: {
    key_points: string[];
  };
  source_files: {
    question_paper: string;
    mark_scheme: string;
  };
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

export interface RevisionDatabase {
  meta: {
    version: string;
    generated: string;
    syllabus: string;
    spec_point_count: number;
    exam_question_count: number;
    driller_question_count: number;
  };
  spec_points: SpecPoint[];
  tab_recall: RecallSummary[];
  tab_exam: ExamQuestion[];
  tab_driller: QuizQuestion[];
}
