// factcheck — corpus-grounded fact-checking of A-Level History essays for the
// Google Docs add-on. A sibling of `zhukovsky`, deliberately forked:
//   - AUTH is a shared secret (x-factcheck-secret), NOT a student JWT — the
//     caller is a Google Apps Script running as a teacher, with no Supabase user.
//   - RETRIEVAL is embedding-similarity across ALL specs (an essay spans many
//     spec points), reusing potemkin-chat's embed() + the HYBRID search RPC
//     (vector + keyword, migration 40), rather than zhukovsky's single-spec lookup.
//   - OUTPUT is a list of VERBATIM spans (+ short anchor + confidence) so the
//     Apps Script can locate and highlight/comment them in the doc.
// It lifts the validated CHECKER prompt from zhukovsky almost verbatim; the only
// behavioural change is that it surfaces ALL clear factual errors (not just the
// argument-breaking ones zhukovsky hides from students) and gates on confidence.
//
// The Anthropic + OpenAI keys stay server-side; the script only ever holds the
// shared secret. Spend is capped by its OWN daily budget, ring-fenced from the
// students' £5/day so teacher use can never starve pupils (migration 41).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-factcheck-secret",
};

const PRIMARY_MODEL = "claude-haiku-4-5-20251001";
const FALLBACK_MODELS = ["claude-sonnet-4-5-20250929", "claude-sonnet-4-20250514"];
const EMBED_MODEL = "text-embedding-3-small";

const MAX_ESSAY_CHARS = 12_000;      // ~2,000 words — a full essay plus slack
const MIN_PARAGRAPH_CHARS = 40;      // skip headings / one-liners when retrieving
const MAX_PARAGRAPHS_EMBED = 15;     // cap OpenAI calls per essay
const RETRIEVE_K = 4;                // chunks per paragraph
const MAX_CORPUS_CHARS = 25_000;     // deduped retrieval budget (~6k tokens)
const MAX_TOKENS = 1_500;            // room for several issues
const CONFIDENCE_FLOOR = 0.7;        // drop anything the model is unsure about

// Spend cap. This path has no per-user identity (shared-secret teacher tool), so it
// gets its own daily budget via factcheck_spend() — which records the call and
// returns the spend BEFORE it, so one RPC both meters and gates. Deliberately NOT
// the shared global row: Docs/staff usage must not eat the students' allowance.
const FACTCHECK_CAP_PENCE = 200;     // £2/day for fact-checking ALONE — ring-fenced
                                     // from the students' £5/day (migration 41)
const COST_PER_ESSAY_PENCE = 1.2;    // conservative: retrieval + one Haiku call

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function embed(text: string, openaiKey: string): Promise<number[]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!r.ok) throw new Error(`OpenAI embed failed: ${r.status}`);
  const json = await r.json();
  return json.data[0].embedding;
}

// The fact-check prompt is zhukovsky's CHECKER, adapted for essay-length input and
// a locate-able output. The conservative rules are the false-positive defence and
// are kept verbatim — do NOT loosen them.
const CHECKER = `You fact-check a student's AQA A-Level History essay (Tsarist and Communist Russia 1855-1964). You do NOT grade and you do NOT coach. Your ONLY job is to catch claims that are clearly, checkably FALSE and would mislead the student if left uncorrected.

Flag ONLY:
- a genuinely false factual claim — wrong actor or cause, an event credited with something it did not do, a wrong date on a load-bearing fact, or a clear anachronism (right thing, wrong era)
- a key name or term mangled so badly it is plainly wrong (e.g. "ryiton playform" = Ryutin Platform)

Do NOT flag — these are NOT errors, stay silent:
- an overstatement, simplification or sweeping phrase ("all Russians", "the first ever") — that is nuance, not fact
- an interpretation, judgement, or debated/historiographical point (how significant something was, whether a cause was decisive, whether a death was suicide)
- wording that is imprecise or non-standard but whose meaning is clear
- an ambiguity you have to invent or assume in order to flag it — read the essay in its most sensible sense
- anything that is merely LESS detailed or LESS precise than it could be
- a claim simply because it does NOT appear in the source material — absence from the material is NOT evidence it is false

The SOURCE MATERIAL below shows what THIS course covers: if a claim is consistent with it, DO NOT flag it. Use the material to AVOID contradicting the course, not as a checklist — never flag a claim the material is merely silent about.

CRITICAL — THE SOURCE MATERIAL IS NOT A SPELLING OR FACT AUTHORITY. It includes teaching notes and STUDENT-WRITTEN exemplar answers, which contain their own mistakes and misspellings. It is authoritative for the course's SCOPE and EMPHASIS only. NEVER flag a name, date or claim merely because the source material spells or states it differently — judge proper nouns and facts against REAL HISTORY, not against the material. If the student and the material disagree and the student is historically correct, the material is wrong: say nothing. Only flag a name if it is mangled relative to the real historical name (e.g. "ryiton playform" for Ryutin Platform), never because it differs from the material.

HARD TEST before flagging: you must be able to state the specific correct fact that REPLACES the student's claim (their date/name/cause is X; it was actually Y). If your correction instead says the claim "isn't in the material", that they "may be conflating events", that a term is non-standard or made-up, or asks them to "clarify" — that is NOT an error. Say nothing.

Silence is the normal, correct result — most good writing contains NO errors. Only speak when you are highly confident a claim is factually wrong.

For EACH real error, return an object with:
- "quote": the exact text from the essay that contains the error, copied CHARACTER FOR CHARACTER — same spelling, punctuation and capitalisation, including any of the student's own mistakes. Choose the SHORTEST span that still contains the error. Do NOT paraphrase, correct, or normalise it — it must be findable verbatim in the document.
- "anchor": the single wrong word, number, name or date inside that quote (e.g. "October 1918"), copied verbatim — a short fallback locator.
- "correction": the specific replacing fact in one sentence (their X was actually Y).
- "replacement": the "quote" rewritten with ONLY the factual error fixed — change the minimum necessary (usually one date/name/word) and keep ALL other wording, punctuation and capitalisation identical to the quote. It must be a drop-in substitute for the quote. If the error can't be fixed by a small in-place edit (e.g. a whole false clause), set this to an empty string "".
- "why": a brief reason, 20 words or fewer.
- "confidence": a number 0.0-1.0 — how sure you are this is a clear FACTUAL error rather than interpretation. Be honest; borderline interpretive calls belong below 0.7.

Respond ONLY with JSON: {"issues":[{"quote":"...","anchor":"...","correction":"...","replacement":"...","why":"...","confidence":0.0}]}
If there are no clear factual errors, return {"issues":[]}.`;

async function callAnthropic(
  apiKey: string,
  system: { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[],
  userContent: string,
): Promise<any> {
  let lastErr = "";
  for (const model of [PRIMARY_MODEL, ...FALLBACK_MODELS]) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
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
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    // ---- shared-secret auth (this is a teacher tool, not a student session) ----
    const secret = Deno.env.get("FACTCHECK_SECRET");
    if (!secret) throw new Error("FACTCHECK_SECRET is not configured");
    if (req.headers.get("x-factcheck-secret") !== secret) return jsonError("Unauthorized", 401);

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!ANTHROPIC_API_KEY || !OPENAI_API_KEY || !supabaseUrl || !serviceKey) {
      throw new Error("Server env not configured");
    }
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // ---- RING-FENCED spend cap (migration 41) ----
    // Fact-checking has its OWN daily budget, deliberately separate from the
    // students' £5/day. Teacher/Docs usage must never be able to starve pupils.
    // factcheck_spend records this call and returns the spend BEFORE it.
    const { data: spentBefore, error: spendErr } = await sb.rpc("factcheck_spend", {
      p_cost_pence: COST_PER_ESSAY_PENCE,
    });
    if (!spendErr && Number(spentBefore) >= FACTCHECK_CAP_PENCE) {
      return jsonError("Fact-checking has reached today's limit — it'll be back tomorrow.", 429);
    }

    const body = (await req.json()) as { text?: string };
    const essay = (body.text ?? "").replace(/\r\n/g, "\n").trim();
    if (!essay) return jsonError("Missing essay text", 400);
    if (essay.length > MAX_ESSAY_CHARS) {
      return jsonError(`Essay too long (${essay.length} chars, max ${MAX_ESSAY_CHARS}). Fact-check a section at a time.`, 400);
    }

    // ---- retrieval: embed each substantial paragraph, gather relevant chunks ----
    const paragraphs = essay
      .split(/\n{2,}|\n/)
      .map((p) => p.trim())
      .filter((p) => p.length >= MIN_PARAGRAPH_CHARS)
      .slice(0, MAX_PARAGRAPHS_EMBED);
    const embedTargets = paragraphs.length > 0 ? paragraphs : [essay.slice(0, 2_000)];

    const embeddings = await Promise.all(embedTargets.map((p) => embed(p, OPENAI_API_KEY)));
    const seen = new Set<string>();
    const chunks: string[] = [];
    let corpusChars = 0;
    for (let i = 0; i < embeddings.length; i++) {
      const e = embeddings[i];
      // Hybrid (vector + keyword) so rare named entities in the essay actually
      // retrieve their grounding — pure vector search misses them. Falls back to
      // vector-only if the hybrid RPC isn't present.
      let rows: { source: string; content: string }[] | null = null;
      const hy = await sb.rpc("potemkin_search_hybrid", {
        query_embedding: e,
        query_text: embedTargets[i],
        match_count: RETRIEVE_K,
      });
      if (hy.error) {
        const r = await sb.rpc("potemkin_search", { query_embedding: e, match_count: RETRIEVE_K });
        rows = r.data;
      } else {
        rows = hy.data;
      }
      for (const row of (rows ?? []) as { source: string; content: string }[]) {
        const key = row.content.slice(0, 80);
        if (seen.has(key)) continue;
        const block = `--- ${row.source} ---\n${row.content}`;
        if (corpusChars + block.length > MAX_CORPUS_CHARS) continue;
        seen.add(key);
        chunks.push(block);
        corpusChars += block.length;
      }
    }
    const corpus = chunks.join("\n\n");

    // ---- the fact-check call: conservative CHECKER + retrieved corpus (cached) ----
    const system = [
      { type: "text" as const, text: CHECKER },
      {
        type: "text" as const,
        text: `COURSE MATERIAL (shows the SCOPE and EMPHASIS of this course ONLY — it contains teaching notes and student-written answers and is NOT a fact or spelling authority):\n\n${corpus}`,
        cache_control: { type: "ephemeral" as const },
      },
    ];
    const result = await callAnthropic(ANTHROPIC_API_KEY, system, `STUDENT ESSAY:\n\n${essay}`);

    // ---- validate: keep only confident, LOCATABLE issues (drop hallucinated spans) ----
    const raw = Array.isArray(result.issues) ? result.issues : [];
    const issues = raw
      .filter((i: any) => i && typeof i.quote === "string" && typeof i.correction === "string")
      .map((i: any) => ({
        quote: String(i.quote),
        anchor: typeof i.anchor === "string" ? i.anchor : String(i.quote),
        correction: String(i.correction),
        replacement: typeof i.replacement === "string" ? i.replacement : "",
        why: typeof i.why === "string" ? i.why : "",
        confidence: Number(i.confidence),
      }))
      .filter((i: any) => Number.isFinite(i.confidence) && i.confidence >= CONFIDENCE_FLOOR)
      // the model must have copied a real substring; if neither quote nor anchor is
      // present in the essay it invented the span — drop it rather than mis-highlight.
      .filter((i: any) => essay.includes(i.quote) || essay.includes(i.anchor));

    return new Response(
      JSON.stringify({ issues, checked_paragraphs: embedTargets.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("factcheck error:", err);
    return jsonError("Fact-checking is temporarily unavailable. Please try again.", 500);
  }
});
