// Zhukovsky — AI marking of Concept Driller and Blank Recall answers.
// Named for Vasily Zhukovsky, Alexander II's tutor.
//
// Design (validated 2026-07-18 against 49 teacher-graded answers: ~98% within one
// level, top band unlocked via few-shot). Two Anthropic calls in parallel:
//   1. MARKER  — WITH the per-spec corpus + generic marking guidance + few-shot
//      exemplars from zhukovsky_exemplars + a de-harshened "the sources are not a
//      checklist" prompt. Returns { level 1-5, feedback }. The corpus is the moat:
//      it keeps scope/emphasis to THIS course and lets feedback name course-
//      relevant gaps. Telling it not to treat the corpus as a checklist is what
//      keeps the level accurate rather than harsh.
//   2. FACT-CHECKER — NO corpus (Haiku knows the history cold). Returns errors.
//      Kept separate so it never lowers the level; it catches what the teacher
//      misses and surfaces gently in feedback.
// Level 5 => serve the stored model answer instead of tailored feedback.
//
// Auth/spend/rate-limit mirror analyse-recall. Anonymous browsing is allowed
// (no user => no per-user cap, still IP rate-limited).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRIMARY_MODEL = "claude-haiku-4-5-20251001";
const FALLBACK_MODELS = ["claude-sonnet-4-5-20250929", "claude-sonnet-4-20250514"];
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;
const NON_UCS_DAILY_LIMIT = 40;
const UCS_SCHOOL_URN = "100065";
const MAX_ANSWER_LENGTH = 8_000;
const MAX_CORPUS_CHARS = 55_000; // ~14k tokens; cached per-spec so reads are cheap
const N_EXEMPLARS = 8;
const MAX_TOKENS = 700;
const GLOBAL_MARKING_CAP_PENCE = 500; // £5/day hard stop across ALL AI marking
const COST_PER_MARK_PENCE = 0.6;      // conservative marker+checker estimate (both corpus-cached)
const ALERT_EMAIL = "tom.bradshaw@ucs.org.uk";
const ALERT_FROM = "Tom <tom@tsarist-communist-russia-1h.co.uk>";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) if (now > entry.resetAt) rateLimitMap.delete(ip);
}, RATE_LIMIT_WINDOW_MS);

interface RequestBody {
  activity: "concept" | "recall";
  specId: number;
  questionText?: string;   // concept
  modelAnswer?: string;    // concept — served verbatim on level 5
  studentAnswer: string;
  keyConcepts?: string[];  // recall — the concepts they should have covered
}

interface MarkResult {
  level: number;
  feedback: string;
  errors: { claim: string; correction: string; undermines_argument: boolean }[];
  servedModelAnswer: boolean;
  concepts?: { concept: string; covered: boolean }[]; // recall coverage checklist
}

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Emails Tom once/day, on the mark that tips global spend over the cap. Never
// throws — an alert failure must not break marking.
async function alertCapReached(spentPence: number): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: ALERT_FROM,
        to: ALERT_EMAIL,
        subject: "⚠️ Zhukovsky marking hit today's £5 spend cap",
        text: `AI marking has reached its daily spend cap of £${(GLOBAL_MARKING_CAP_PENCE / 100).toFixed(2)} (about £${(spentPence / 100).toFixed(2)} of estimated spend today). Marking is now paused for everyone until midnight. If this happens often, raise the cap in the zhukovsky function or check for unusual usage.`,
      }),
    });
  } catch (_) {
    // swallow — alerting is best-effort
  }
}

// ---- corpus: spec-tagged chunks + cross-spec marking guidance, priority-ordered, capped ----
const SOURCE_PRIORITY: Record<string, number> = {
  mark_scheme: 0, tbb_guide: 1, spec: 2, organiser: 3, exam: 4, workpack: 5, reading: 6,
};
async function buildCorpus(sb: ReturnType<typeof createClient>, specId: number): Promise<string> {
  // spec-tagged material for this spec point...
  const { data: specChunks } = await sb
    .from("potemkin_chunks")
    .select("content, source_type, source")
    .contains("spec_point", [specId]);
  // ...plus generic cross-spec MARKING GUIDANCE only (AQA marking advice, mark grid,
  // 'how to' guides, the spec) — NOT generic readings, which would be noise.
  const { data: guidance } = await sb
    .from("potemkin_chunks")
    .select("content, source_type, source")
    .eq("spec_point", "{}")
    .in("source_type", ["spec", "tbb_guide"]);

  const all = [...(specChunks ?? []), ...(guidance ?? [])];
  all.sort((a, b) => (SOURCE_PRIORITY[a.source_type] ?? 9) - (SOURCE_PRIORITY[b.source_type] ?? 9));

  const parts: string[] = [];
  let chars = 0;
  for (const c of all) {
    const block = `--- [${c.source_type}] ${c.source} ---\n${c.content}`;
    if (chars + block.length > MAX_CORPUS_CHARS) continue; // skip, keep filling from lower priority
    parts.push(block);
    chars += block.length;
  }
  return parts.join("\n\n");
}

// ---- few-shot exemplars: a diverse, deterministic set (cacheable), spec-preferred ----
async function buildExemplars(sb: ReturnType<typeof createClient>, specId: number): Promise<string> {
  const { data } = await sb
    .from("zhukovsky_exemplars")
    .select("spec_id, question_text, student_answer, level")
    .order("level", { ascending: true })
    .order("id", { ascending: true });
  if (!data || data.length === 0) return "";
  // prefer same-spec, then fill across levels for coverage of the whole scale
  const sameSpec = data.filter((e) => e.spec_id === specId);
  const chosen: typeof data = [];
  const seenLevels = new Set<number>();
  for (const e of [...sameSpec, ...data]) {
    if (chosen.includes(e)) continue;
    // ensure all five levels represented before doubling up
    if (chosen.length < 5 && seenLevels.has(e.level)) continue;
    chosen.push(e);
    seenLevels.add(e.level);
    if (chosen.length >= N_EXEMPLARS) break;
  }
  return chosen
    .map((e) => `QUESTION: ${e.question_text}\nANSWER: ${e.student_answer}\nSCORE: ${e.level}`)
    .join("\n\n---\n\n");
}

const BANDS = `SCORE 1-5 the way the teacher (Tom) does:
1 = Exceptional — you are confident the student can make the arguments AND back them with specific evidence. NOT that they said everything; several different answers can be a 1; short/note-form is fine.
2 = Very good — most of the arguments are there, but missing a key point OR could use more specific evidence.
3 = Good effort — some good ideas, but missing important points and/or specific evidence.
4 = Needs work — only broad strokes, or just one of the major ideas, and lacking specific knowledge. Something positive, but clearly needs work.
5 = Incorrect or a non-answer — generic knowledge anyone could guess, nothing specific, off-topic, or wrong.`;

const ANTIHARSH = `HOW TO USE THE SOURCE MATERIAL: it shows the full range of what COULD be said, for your reference on scope and accuracy. It is NOT a checklist and the student does NOT need to cover it — you can ALWAYS find more in the sources than any student wrote, and that must NOT lower the score. Mark generously, like Tom, who does not require completeness. Judge ONLY: can this student argue the point and support it with specific evidence? Do not deduct for anything they left out relative to the sources. A minor factual slip does not lower the score. There may be several valid "perfect" answers using different evidence — credit a correct, well-evidenced argument even if it differs from the model answer. Stay strictly within what THIS course covers and emphasises.`;

const FEEDBACK_STYLE = `FEEDBACK: warm and encouraging. Open by crediting the argument and evidence they got right. Then, drawing on the source material, name the specific course-relevant points or evidence that would strengthen the answer — framed as things to add, never as what was missing to pass. End with a question that makes them retrieve. Do NOT fact-check here (a separate check handles errors).`;

const CHECKER = `You fact-check a student's AQA A-Level History answer (Tsarist and Communist Russia 1855-1964). You do NOT grade and you do NOT coach. Your ONLY job is to catch a claim that is clearly, checkably FALSE and would mislead the student if left uncorrected.

Flag ONLY:
- a genuinely false factual claim — wrong actor or cause, an event credited with something it did not do, a wrong date on a load-bearing fact, or a clear anachronism (right thing, wrong era)
- a key name or term mangled so badly it is plainly wrong (e.g. "ryiton playform" = Ryutin Platform)

Do NOT flag — these are NOT errors, stay silent:
- an overstatement, simplification or sweeping phrase ("all Russians", "the first ever") — that is nuance, not fact
- an interpretation, judgement, or debated/historiographical point (whether a death was suicide, how significant something was, whether a term is "standard")
- wording that is imprecise or non-standard but whose meaning is clear
- an ambiguity you have to invent or assume in order to flag it — read the answer in its most sensible sense
- anything that is merely LESS detailed or LESS precise than it could be
- a claim, event, or phrase simply because it does NOT appear in the source material — absence from the material is NOT evidence it is false

The SOURCE MATERIAL below is authoritative for THIS course: if the student's claim is consistent with it, DO NOT flag it, even if your own general knowledge disagrees. Use the material to AVOID contradicting the course, not as a checklist — only flag a claim the material (or plain historical fact) positively contradicts, never one it is merely silent about.

HARD TEST before flagging: you must be able to state the specific correct fact that REPLACES the student's claim (their date/name/cause is X; it was actually Y). If your correction instead says the claim "isn't in the material", that they "may be conflating events", that a term is non-standard or made-up, or asks them to "clarify" — that is NOT an error. Say nothing.

Silence is the normal, correct result — most good answers contain NO errors, so return an empty array. Only speak when you are highly confident a claim is factually wrong. If the argument is sound but one supporting detail is off, note it with undermines_argument:false; a claim that breaks the argument gets true.
Respond ONLY with JSON: {"issues":[{"claim":"...","correction":"...","undermines_argument":true|false}]}`;

async function callAnthropic(
  apiKey: string,
  system: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[],
  userContent: string,
  maxTokens = MAX_TOKENS,
): Promise<any> {
  const models = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastErr = "";
  for (const model of models) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    if (res.status === 429 || res.status >= 500) { lastErr = `status ${res.status}`; continue; }
    const j = await res.json();
    if (j.error) { lastErr = j.error.message ?? "api error"; continue; }
    const text = (j.content ?? []).find((b: any) => b.type === "text")?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) { lastErr = "unparseable response"; continue; }
    try { return JSON.parse(m[0]); } catch { lastErr = "invalid JSON"; continue; }
  }
  throw new Error(`All models failed: ${lastErr}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") || "unknown";
    if (isRateLimited(clientIp)) return jsonError("Rate limit exceeded. Please try again in a moment.", 429);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase env not configured");
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Auth: identify the user and apply per-user daily cap. Anonymous is allowed
    // (no cap, still IP-rate-limited). UCS users are unlimited.
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const sbUserClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await sbUserClient.auth.getUser();
      if (userData?.user) {
        userId = userData.user.id;
        const { data: profile } = await sb
          .from("user_profiles").select("school_urn").eq("id", userId).single();
        const isUcs = profile?.school_urn === UCS_SCHOOL_URN;

        // Two caps, checked together via the shared usage table:
        //  - per-user daily count (non-UCS only; UCS effectively unlimited)
        //  - a GLOBAL £5/day marking spend cap that applies to everyone
        // p_skill "mark-recall" is what increments mark_count / accrues cost.
        const { data: limits } = await sb.rpc("potemkin_check_limits", {
          p_user_id: userId,
          p_skill: "mark-recall",
          p_user_daily_limit: isUcs ? 1_000_000 : NON_UCS_DAILY_LIMIT,
          p_global_cap_pence: GLOBAL_MARKING_CAP_PENCE,
        });
        if (limits && !limits.allowed) {
          const capHit = Number(limits.global_spent_pence) >= Number(limits.global_cap_pence);
          return jsonError(
            capHit
              ? "AI marking has reached today's spending limit — it'll be back tomorrow."
              : `You've used today's ${NON_UCS_DAILY_LIMIT} AI mark-ups. Resets at midnight.`,
            429,
          );
        }
        await sb.rpc("potemkin_record_usage", { p_user_id: userId, p_skill: "mark-recall", p_cost_pence: COST_PER_MARK_PENCE });

        // Fire the alert exactly once — on the mark that tips spend over the cap.
        const spentBefore = Number(limits?.global_spent_pence ?? 0);
        if (spentBefore < GLOBAL_MARKING_CAP_PENCE && spentBefore + COST_PER_MARK_PENCE >= GLOBAL_MARKING_CAP_PENCE) {
          await alertCapReached(spentBefore + COST_PER_MARK_PENCE);
        }
      }
    }

    const body = (await req.json()) as RequestBody;
    const { activity, specId, questionText, modelAnswer, studentAnswer, keyConcepts } = body;

    if (activity !== "concept" && activity !== "recall") return jsonError("Invalid activity", 400);
    if (!Number.isInteger(specId) || specId < 1 || specId > 24) return jsonError("Invalid specId", 400);
    if (!studentAnswer || typeof studentAnswer !== "string") return jsonError("Missing studentAnswer", 400);
    if (studentAnswer.length > MAX_ANSWER_LENGTH) return jsonError("Answer too long", 400);
    const answer = studentAnswer.replace(/"""/g, "'''").trim();

    // Build the (cacheable) marker system prompt: instructions + exemplars, then the
    // per-spec corpus as its own cache breakpoint (stable per spec => cheap reads).
    const [corpus, exemplars] = await Promise.all([
      buildCorpus(sb, specId),
      buildExemplars(sb, specId),
    ]);

    const modeLine = activity === "recall"
      ? `This is a BLANK RECALL: the student wrote from memory everything they could about this spec point. The KEY CONCEPTS they were meant to cover are listed. Score the whole recall on the 1-5 ladder; in feedback name the most important concepts they missed; and for EACH listed key concept decide whether they covered it — count it covered if they mention it or clearly convey the idea, even in different words.`
      : `This is a short concept answer to the question below.`;

    // A blank recall covers the WHOLE spec point, so the feedback should be fuller
    // than for a single concept question — more ground to cover.
    const feedbackLength = activity === "recall"
      ? `LENGTH: this is a whole-spec recall, so write a fuller response — aim for ~250-350 words. Cover the most important gaps across the WHOLE spec point (group them sensibly: ideas, individuals/groups, the reaction, etc.), not just one, and still keep the warm, encouraging tone.`
      : `LENGTH: keep it under ~120 words.`;

    const jsonInstruction = activity === "recall"
      ? `Respond ONLY with JSON: {"level":1|2|3|4|5,"feedback":"...","coverage":[{"n":1,"covered":true|false}, ...]} — "n" is the NUMBER of the key concept from the numbered list; include one entry for EVERY numbered key concept and do NOT repeat the concept text.`
      : `Respond ONLY with JSON: {"level":1|2|3|4|5,"feedback":"..."}`;

    const markerSystem = [
      { type: "text" as const, text:
        `You are Zhukovsky, marking AQA A-Level History 7042/1H (Tsarist and Communist Russia 1855-1964) the way the teacher (Tom) does.\n\n${modeLine}\n\n${BANDS}\n\n${ANTIHARSH}\n\n${FEEDBACK_STYLE}\n${feedbackLength}\n\n${exemplars ? `HOW TOM SCORES — study these, especially what separates a 1 from a 2:\n\n${exemplars}\n\n` : ""}${jsonInstruction}` },
      { type: "text" as const, text: `SOURCE MATERIAL (reference only, NOT a checklist):\n\n${corpus}`, cache_control: { type: "ephemeral" as const } },
    ];

    const userForMarker = activity === "recall"
      ? `KEY CONCEPTS THEY SHOULD HAVE COVERED:\n${(keyConcepts ?? []).map((k, i) => `${i + 1}. ${k}`).join("\n")}\n\nSTUDENT RECALL:\n${answer}`
      : `QUESTION: ${questionText ?? ""}\n\nSTUDENT ANSWER: ${answer}`;

    const userForChecker = activity === "recall"
      ? `QUESTION: (blank recall on this spec point)\n\nSTUDENT ANSWER: ${answer}`
      : `QUESTION: ${questionText ?? ""}\n\nSTUDENT ANSWER: ${answer}`;

    // The checker gets the same per-spec corpus as the marker (its own cached block)
    // so it grounds errors in THIS course's material rather than parametric guesses.
    const checkerSystem = [
      { type: "text" as const, text: CHECKER },
      { type: "text" as const, text: `SOURCE MATERIAL (authoritative for this course — treat as ground truth):\n\n${corpus}`, cache_control: { type: "ephemeral" as const } },
    ];

    const [marker, checker] = await Promise.all([
      callAnthropic(ANTHROPIC_API_KEY, markerSystem, userForMarker, activity === "recall" ? 1400 : MAX_TOKENS),
      callAnthropic(ANTHROPIC_API_KEY, checkerSystem, userForChecker),
    ]);

    let level = Number(marker.level);
    if (!Number.isInteger(level) || level < 1 || level > 5) level = 3; // safe fallback
    let feedback = String(marker.feedback ?? "").trim();
    let servedModelAnswer = false;

    // Level 5 (non-answer): don't waste tailored feedback — serve the model answer.
    if (level === 5 && activity === "concept" && modelAnswer) {
      feedback = `There isn't enough here yet to give specific feedback on — this one's about building the knowledge first. Here's a strong answer to learn from:\n\n${modelAnswer}`;
      servedModelAnswer = true;
    }

    // Only surface errors that actually UNDERMINE the answer (Tom's call): the soft,
    // non-argument-breaking notes are the noise students found unhelpful. The hard
    // ones (wrong load-bearing fact) are what "Worth checking" is for.
    const errors = Array.isArray(checker.issues) ? checker.issues.filter(
      (e: any) => e && typeof e.claim === "string" && typeof e.correction === "string"
        && e.undermines_argument === true,
    ) : [];

    // Reconcile coverage server-side by INDEX, not by echoed string. The key
    // concepts are paragraph-length, so the marker can't echo them verbatim —
    // it references each by number instead. We map those numbers back onto the
    // canonical keyConcepts list so every concept is returned in Tom's wording.
    let concepts: { concept: string; covered: boolean }[] | undefined;
    if (activity === "recall" && Array.isArray(keyConcepts)) {
      const coveredByN = new Map<number, boolean>();
      if (Array.isArray(marker.coverage)) {
        for (const c of marker.coverage) {
          if (c && Number.isInteger(Number(c.n))) coveredByN.set(Number(c.n), !!c.covered);
        }
      }
      concepts = keyConcepts.map((concept, i) => ({
        concept,
        covered: coveredByN.get(i + 1) ?? false,
      }));
    }

    const result: MarkResult = { level, feedback, errors, servedModelAnswer, concepts };
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("zhukovsky error:", err);
    return jsonError("Marking is temporarily unavailable. Please try again.", 500);
  }
});
