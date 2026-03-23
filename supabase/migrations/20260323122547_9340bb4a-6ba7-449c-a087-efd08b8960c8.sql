
CREATE TABLE public.content_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  section TEXT NOT NULL,
  topic_name TEXT NOT NULL,
  original_text TEXT NOT NULL DEFAULT '',
  issue_type TEXT NOT NULL,
  student_comment TEXT NOT NULL DEFAULT '',
  resolved BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert reports"
  ON public.content_reports
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
