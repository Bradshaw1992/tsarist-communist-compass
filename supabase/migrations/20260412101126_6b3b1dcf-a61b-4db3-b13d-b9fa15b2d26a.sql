
-- 1. user_profiles
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT, display_name TEXT, full_name TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Teachers can view all profiles" ON public.user_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'teacher')
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, full_name)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. spec_points
CREATE TABLE public.spec_points (
  id INTEGER PRIMARY KEY, part INTEGER NOT NULL DEFAULT 1,
  section TEXT NOT NULL, title TEXT NOT NULL, short_title TEXT, ko_file TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.spec_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read spec_points" ON public.spec_points FOR SELECT USING (true);

-- 3. recall_content
CREATE TABLE public.recall_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id INTEGER NOT NULL REFERENCES public.spec_points(id),
  summary JSONB NOT NULL DEFAULT '{}', key_concepts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recall_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read recall_content" ON public.recall_content FOR SELECT USING (true);

-- 4. exam_questions
CREATE TABLE public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year TEXT NOT NULL, section TEXT NOT NULL DEFAULT '', question_number TEXT,
  question_type TEXT DEFAULT 'essay', marks INTEGER DEFAULT 0,
  question_text TEXT NOT NULL, spec_ids INTEGER[] NOT NULL DEFAULT '{}',
  indicative_content TEXT DEFAULT '', source_files JSONB DEFAULT '{}',
  time_period TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read exam_questions" ON public.exam_questions FOR SELECT USING (true);

-- 5. concept_questions
CREATE TABLE public.concept_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), legacy_id TEXT,
  spec_id INTEGER NOT NULL REFERENCES public.spec_points(id),
  question_type TEXT, question_text TEXT NOT NULL, correct_answer TEXT NOT NULL,
  ko_terms_used JSONB DEFAULT '[]', good_answer_synonym TEXT,
  workpack_ref TEXT, textbook_ref TEXT, source TEXT DEFAULT 'original',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.concept_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read concept_questions" ON public.concept_questions FOR SELECT USING (true);
CREATE POLICY "Teachers can insert concept_questions" ON public.concept_questions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'teacher'));
CREATE POLICY "Teachers can delete concept_questions" ON public.concept_questions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'teacher'));

-- 6. fact_questions
CREATE TABLE public.fact_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id INTEGER NOT NULL REFERENCES public.spec_points(id),
  question TEXT NOT NULL, answer TEXT NOT NULL,
  valid_synonyms JSONB DEFAULT '[]', source TEXT DEFAULT 'original',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fact_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read fact_questions" ON public.fact_questions FOR SELECT USING (true);
CREATE POLICY "Teachers can insert fact_questions" ON public.fact_questions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'teacher'));
CREATE POLICY "Teachers can delete fact_questions" ON public.fact_questions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'teacher'));

-- 7. chronology_questions
CREATE TABLE public.chronology_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL, question_text TEXT NOT NULL,
  correct_part INTEGER, correct_answer TEXT, sequence_data JSONB,
  options JSONB, correct_option_index INTEGER, hint_date TEXT, source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chronology_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read chronology_questions" ON public.chronology_questions FOR SELECT USING (true);

-- 8. classes (NO cross-ref policy yet)
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, join_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage own classes" ON public.classes FOR ALL USING (auth.uid() = teacher_id);

-- 9. class_members
CREATE TABLE public.class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view class members" ON public.class_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_members.class_id AND c.teacher_id = auth.uid()));
CREATE POLICY "Students can view own membership" ON public.class_members FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can join classes" ON public.class_members FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Now add the deferred cross-ref policy on classes
CREATE POLICY "Students can view joined classes" ON public.classes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = classes.id AND cm.student_id = auth.uid()));

-- 10. user_sessions
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, spec_id INTEGER,
  total_questions INTEGER NOT NULL DEFAULT 0, correct_count INTEGER NOT NULL DEFAULT 0,
  per_question JSONB DEFAULT '[]', metadata JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sessions" ON public.user_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.user_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Teachers can view student sessions" ON public.user_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.class_members cm JOIN public.classes c ON c.id = cm.class_id
    WHERE cm.student_id = user_sessions.user_id AND c.teacher_id = auth.uid()));

-- 11. user_blank_recalls
CREATE TABLE public.user_blank_recalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spec_id INTEGER NOT NULL, written_text TEXT DEFAULT '',
  concepts_total INTEGER DEFAULT 0, concepts_covered INTEGER DEFAULT 0,
  concept_results JSONB DEFAULT '[]', ai_feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_blank_recalls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recalls" ON public.user_blank_recalls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recalls" ON public.user_blank_recalls FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Teachers can view student recalls" ON public.user_blank_recalls FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.class_members cm JOIN public.classes c ON c.id = cm.class_id
    WHERE cm.student_id = user_blank_recalls.user_id AND c.teacher_id = auth.uid()));

-- 12. user_wrong_answers
CREATE TABLE public.user_wrong_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_table TEXT NOT NULL, question_id UUID NOT NULL,
  spec_id INTEGER, question_snapshot JSONB DEFAULT '{}',
  missed_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ
);
ALTER TABLE public.user_wrong_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wrong answers" ON public.user_wrong_answers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wrong answers" ON public.user_wrong_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wrong answers" ON public.user_wrong_answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Teachers can view student wrong answers" ON public.user_wrong_answers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.class_members cm JOIN public.classes c ON c.id = cm.class_id
    WHERE cm.student_id = user_wrong_answers.user_id AND c.teacher_id = auth.uid()));
CREATE UNIQUE INDEX idx_wrong_answers_unresolved ON public.user_wrong_answers (user_id, question_table, question_id) WHERE resolved_at IS NULL;

-- 13. user_spec_confidence
CREATE TABLE public.user_spec_confidence (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spec_id INTEGER NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'none',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, spec_id)
);
ALTER TABLE public.user_spec_confidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own confidence" ON public.user_spec_confidence FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own confidence" ON public.user_spec_confidence FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own confidence" ON public.user_spec_confidence FOR UPDATE USING (auth.uid() = user_id);

-- 14. question_flags
CREATE TABLE public.question_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_table TEXT NOT NULL, question_id UUID NOT NULL,
  spec_id INTEGER, flagged_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ, resolved_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.question_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can insert flags" ON public.question_flags FOR INSERT WITH CHECK (auth.uid() = flagged_by);
CREATE POLICY "Teachers can view all flags" ON public.question_flags FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'teacher'));
CREATE POLICY "Teachers can update flags" ON public.question_flags FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'teacher'));
CREATE UNIQUE INDEX idx_question_flags_unique ON public.question_flags (question_table, question_id, flagged_by);

-- 15. question_review_queue
CREATE TABLE public.question_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id INTEGER NOT NULL, target_table TEXT NOT NULL,
  question_data JSONB NOT NULL, source TEXT NOT NULL DEFAULT 'ai',
  status TEXT NOT NULL DEFAULT 'pending', rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ, reviewed_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.question_review_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view review queue" ON public.question_review_queue FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'teacher'));
CREATE POLICY "Teachers can update review queue" ON public.question_review_queue FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'teacher'));
