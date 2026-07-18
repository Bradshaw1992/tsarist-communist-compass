// Client helper for the Zhukovsky AI marker (edge function `zhukovsky`).
// Mirrors the analyse-recall call pattern in BlankRecall.tsx: use the user's
// session JWT when signed in (so the per-user daily cap applies), else the anon
// key (gated only by the per-IP minute limit).

import { SUPABASE_CONFIG } from "@/integrations/supabase/config";
import { supabase } from "@/integrations/supabase/client";

export interface ZhukovskyError {
  claim: string;
  correction: string;
  undermines_argument: boolean;
}

export interface ZhukovskyConceptCoverage {
  concept: string;
  covered: boolean;
}

export interface ZhukovskyResult {
  level: number; // 1-5
  feedback: string;
  errors: ZhukovskyError[];
  servedModelAnswer: boolean;
  concepts?: ZhukovskyConceptCoverage[]; // blank-recall coverage checklist
}

export interface ConceptMarkInput {
  activity: "concept";
  specId: number;
  questionText: string;
  modelAnswer: string;
  studentAnswer: string;
}

export interface RecallMarkInput {
  activity: "recall";
  specId: number;
  studentAnswer: string;
  keyConcepts: string[];
}

// Student-facing band labels (gentler than the internal marking bands).
export const ZHUKOVSKY_BANDS: Record<number, string> = {
  1: "Exceptional",
  2: "Very good",
  3: "Good effort",
  4: "Developing",
  5: "Keep building",
};

// Build a SHORT Potemkin handoff from a Zhukovsky mark. The feedback is written
// to end with a retrieval question, so we seed the chat with just that question
// plus the topic for grounding — not the whole answer + feedback (too long, and
// it blew Potemkin's message cap). Falls back to a generic opener if no question.
export function buildPotemkinHandoff(topic: string, feedback: string): string {
  const questions = feedback.match(/[^.!?]*\?/g);
  const q = questions && questions.length ? questions[questions.length - 1].trim() : "";
  return q
    ? `I'm revising "${topic}". Zhukovsky asked me: "${q}" Can you help me work through it?`
    : `I'm revising "${topic}" and want to push my answer further. Can you help me work through it?`;
}

export async function markWithZhukovsky(
  input: ConceptMarkInput | RecallMarkInput,
): Promise<ZhukovskyResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_CONFIG.url;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_CONFIG.anonKey;
  const url = `${supabaseUrl}/functions/v1/zhukovsky`;

  const { data: { session } } = await supabase.auth.getSession();
  const bearer = session?.access_token ?? supabaseKey;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let msg = `Zhukovsky is unavailable (${response.status}). Please try again.`;
    try {
      const body = await response.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore parse failure, keep the default message
    }
    throw new Error(msg);
  }

  return (await response.json()) as ZhukovskyResult;
}
