export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      chronology_questions: {
        Row: {
          correct_answer: string | null
          correct_option_index: number | null
          correct_part: number | null
          created_at: string
          hint_date: string | null
          id: string
          mode: string
          options: Json | null
          question_text: string
          sequence_data: Json | null
          source: string | null
        }
        Insert: {
          correct_answer?: string | null
          correct_option_index?: number | null
          correct_part?: number | null
          created_at?: string
          hint_date?: string | null
          id?: string
          mode: string
          options?: Json | null
          question_text: string
          sequence_data?: Json | null
          source?: string | null
        }
        Update: {
          correct_answer?: string | null
          correct_option_index?: number | null
          correct_part?: number | null
          created_at?: string
          hint_date?: string | null
          id?: string
          mode?: string
          options?: Json | null
          question_text?: string
          sequence_data?: Json | null
          source?: string | null
        }
        Relationships: []
      }
      class_members: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          student_id: string
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          student_id: string
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          id: string
          join_code: string
          name: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code: string
          name: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
          name?: string
          teacher_id?: string
        }
        Relationships: []
      }
      concept_questions: {
        Row: {
          correct_answer: string
          created_at: string
          good_answer_synonym: string | null
          id: string
          ko_terms_used: Json | null
          legacy_id: string | null
          question_text: string
          question_type: string | null
          source: string | null
          spec_id: number
          textbook_ref: string | null
          workpack_ref: string | null
        }
        Insert: {
          correct_answer: string
          created_at?: string
          good_answer_synonym?: string | null
          id?: string
          ko_terms_used?: Json | null
          legacy_id?: string | null
          question_text: string
          question_type?: string | null
          source?: string | null
          spec_id: number
          textbook_ref?: string | null
          workpack_ref?: string | null
        }
        Update: {
          correct_answer?: string
          created_at?: string
          good_answer_synonym?: string | null
          id?: string
          ko_terms_used?: Json | null
          legacy_id?: string | null
          question_text?: string
          question_type?: string | null
          source?: string | null
          spec_id?: number
          textbook_ref?: string | null
          workpack_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concept_questions_spec_id_fkey"
            columns: ["spec_id"]
            isOneToOne: false
            referencedRelation: "spec_points"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string
          id: string
          issue_type: string
          original_text: string
          resolved: boolean
          section: string
          student_comment: string
          topic_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_type: string
          original_text?: string
          resolved?: boolean
          section: string
          student_comment?: string
          topic_name: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_type?: string
          original_text?: string
          resolved?: boolean
          section?: string
          student_comment?: string
          topic_name?: string
        }
        Relationships: []
      }
      exam_questions: {
        Row: {
          created_at: string
          id: string
          indicative_content: string | null
          marks: number | null
          question_number: string | null
          question_text: string
          question_type: string | null
          section: string
          source_files: Json | null
          spec_ids: number[]
          time_period: string | null
          year: string
        }
        Insert: {
          created_at?: string
          id?: string
          indicative_content?: string | null
          marks?: number | null
          question_number?: string | null
          question_text: string
          question_type?: string | null
          section?: string
          source_files?: Json | null
          spec_ids?: number[]
          time_period?: string | null
          year: string
        }
        Update: {
          created_at?: string
          id?: string
          indicative_content?: string | null
          marks?: number | null
          question_number?: string | null
          question_text?: string
          question_type?: string | null
          section?: string
          source_files?: Json | null
          spec_ids?: number[]
          time_period?: string | null
          year?: string
        }
        Relationships: []
      }
      fact_questions: {
        Row: {
          answer: string
          created_at: string
          id: string
          question: string
          source: string | null
          spec_id: number
          valid_synonyms: Json | null
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          question: string
          source?: string | null
          spec_id: number
          valid_synonyms?: Json | null
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          question?: string
          source?: string | null
          spec_id?: number
          valid_synonyms?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fact_questions_spec_id_fkey"
            columns: ["spec_id"]
            isOneToOne: false
            referencedRelation: "spec_points"
            referencedColumns: ["id"]
          },
        ]
      }
      question_flags: {
        Row: {
          created_at: string
          flagged_by: string
          id: string
          question_id: string
          question_table: string
          reason: string | null
          resolved_at: string | null
          resolved_by: string | null
          spec_id: number | null
        }
        Insert: {
          created_at?: string
          flagged_by: string
          id?: string
          question_id: string
          question_table: string
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          spec_id?: number | null
        }
        Update: {
          created_at?: string
          flagged_by?: string
          id?: string
          question_id?: string
          question_table?: string
          reason?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          spec_id?: number | null
        }
        Relationships: []
      }
      question_review_queue: {
        Row: {
          id: string
          question_data: Json
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          spec_id: number
          status: string
          submitted_at: string
          target_table: string
        }
        Insert: {
          id?: string
          question_data: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          spec_id: number
          status?: string
          submitted_at?: string
          target_table: string
        }
        Update: {
          id?: string
          question_data?: Json
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          spec_id?: number
          status?: string
          submitted_at?: string
          target_table?: string
        }
        Relationships: []
      }
      recall_content: {
        Row: {
          created_at: string
          id: string
          key_concepts: Json
          spec_id: number
          summary: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key_concepts?: Json
          spec_id: number
          summary?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key_concepts?: Json
          spec_id?: number
          summary?: Json
        }
        Relationships: [
          {
            foreignKeyName: "recall_content_spec_id_fkey"
            columns: ["spec_id"]
            isOneToOne: false
            referencedRelation: "spec_points"
            referencedColumns: ["id"]
          },
        ]
      }
      spec_points: {
        Row: {
          id: number
          ko_file: string | null
          part: number
          section: string
          short_title: string | null
          sort_order: number
          title: string
        }
        Insert: {
          id: number
          ko_file?: string | null
          part?: number
          section: string
          short_title?: string | null
          sort_order?: number
          title: string
        }
        Update: {
          id?: number
          ko_file?: string | null
          part?: number
          section?: string
          short_title?: string | null
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      user_blank_recalls: {
        Row: {
          ai_feedback: string | null
          concept_results: Json | null
          concepts_covered: number | null
          concepts_total: number | null
          id: string
          spec_id: number
          submitted_at: string
          user_id: string
          written_text: string | null
        }
        Insert: {
          ai_feedback?: string | null
          concept_results?: Json | null
          concepts_covered?: number | null
          concepts_total?: number | null
          id?: string
          spec_id: number
          submitted_at?: string
          user_id: string
          written_text?: string | null
        }
        Update: {
          ai_feedback?: string | null
          concept_results?: Json | null
          concepts_covered?: number | null
          concepts_total?: number | null
          id?: string
          spec_id?: number
          submitted_at?: string
          user_id?: string
          written_text?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          activity_type: string
          completed_at: string | null
          correct_count: number
          created_at: string
          id: string
          metadata: Json | null
          per_question: Json | null
          spec_id: number | null
          total_questions: number
          user_id: string
        }
        Insert: {
          activity_type: string
          completed_at?: string | null
          correct_count?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          per_question?: Json | null
          spec_id?: number | null
          total_questions?: number
          user_id: string
        }
        Update: {
          activity_type?: string
          completed_at?: string | null
          correct_count?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          per_question?: Json | null
          spec_id?: number | null
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      user_spec_confidence: {
        Row: {
          confidence: string
          spec_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: string
          spec_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: string
          spec_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_wrong_answers: {
        Row: {
          id: string
          missed_at: string
          question_id: string
          question_snapshot: Json | null
          question_table: string
          resolved_at: string | null
          spec_id: number | null
          user_id: string
        }
        Insert: {
          id?: string
          missed_at?: string
          question_id: string
          question_snapshot?: Json | null
          question_table: string
          resolved_at?: string | null
          spec_id?: number | null
          user_id: string
        }
        Update: {
          id?: string
          missed_at?: string
          question_id?: string
          question_snapshot?: Json | null
          question_table?: string
          resolved_at?: string | null
          spec_id?: number | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
