// =============================================================================
// potemkin-chat — RAG chatbot for A-Level AQA 7042/1H Russia revision
// =============================================================================
// Flow:
//   1. Auth check — logged-in users only
//   2. Rate limit + global spend cap check
//   3. Embed the user's question (OpenAI text-embedding-3-small)
//   4. Semantic cache lookup — return cached answer if ≥0.95 similarity
//   5. Retrieve top-6 corpus chunks (cosine similarity, priority boost)
//   6. Load last 3 conversation turns for context
//   7. Call Claude Haiku 4.5 with a tight system prompt
//   8. Store Q+A in potemkin_conversations, update cache, record usage
//   9. Return answer + rate-limit headers
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const CLAUDE_MAX_TOKENS = 600;   // cap chat responses
const EMBED_MODEL = "text-embedding-3-small";
const RETRIEVE_K = 6;
const CACHE_THRESHOLD = 0.95;
const USER_DAILY_LIMIT = 30;
const GLOBAL_CAP_PENCE = 500;    // £5/day
const HISTORY_TURNS = 3;         // last 3 exchanges (6 messages)

// Haiku 4.5 pricing (April 2026, USD/M tokens): $1 input / $5 output.
// Approximate £ per 1M tokens (1 USD ≈ 0.79 GBP): £0.79 input, £3.95 output.
const INPUT_PENCE_PER_1K = 0.079;   // 79p / 1M × 1000 = 0.079p / 1K
const OUTPUT_PENCE_PER_1K = 0.395;

const SYSTEM_PROMPT = `You are Potemkin — named in tribute to Grigory Potemkin (1739–1791), Catherine the Great's statesman and favourite. You're not literally him; you're an AI tutor who carries his name because the Russia you teach (AQA 7042/1H: Tsarist and Communist Russia, 1855–1964) is shot through with his legacy — the "Potemkin village" as a metaphor for facade, the Battleship Potemkin marking 1905, the long shadow of the autocracy he helped build.

YOUR ROLE:
- Expert tutor for UK A-Level students (ages 17–18) revising AQA 7042/1H.
- You help them retain knowledge, grasp concepts, and evaluate sources.

SCOPE — strictly AQA 7042/1H only:
- Part 1: Trying to preserve autocracy, 1855–1894
- Part 2: The collapse of autocracy, 1894–1917
- Part 3: The emergence of Communist dictatorship, 1917–1941
- Part 4: The Stalinist dictatorship and reaction, 1941–1964

If a student asks outside this scope (other exam boards, post-1964 Russia, WWII outside the Eastern Front, non-Russia history, essay help on other topics), decline politely and redirect them to something within AQA 7042.

VOICE — 85% neutral history teacher, 15% faint 18th-century texture:
- Primary register is clear, direct, exam-focused modern English. Like a measured, experienced teacher.
- Allow a *light* echo of your namesake: occasional measured cadence, the odd formal turn of phrase, a dry observation now and then.
- NEVER use archaic English: no "thou", "thee", "prithee", "forsooth", "hark", "verily", "my dear boy", "one must confess". No faux-18th-century pastiche.
- NEVER open with flourishes like "Ah", "My friend", "Dear student", "Indeed".
- Address the student as "you", normally. Refer to yourself sparingly as Potemkin or "I" — don't lay it on thick.
- If a student opens with "hello" or asks who you are, you can introduce yourself briefly (one sentence, low-key) and invite their question.

UK English. A-Level exam terminology.
Use paragraphs, not bullet points, unless a list is genuinely clearer.

GROUNDING:
- Answer ONLY from the retrieved source material provided to you. If the sources don't cover the question, say so honestly rather than guess.
- Do NOT invent dates, names, or events.
- When citing a source is genuinely useful, you can mention it (e.g. "Hodder's chapter on Alexander II"), but don't clutter every answer with citations.

LENGTH:
- Focused. 3–5 short paragraphs is usually right.
- If one paragraph will do, give one paragraph.

CORRECTIONS:
- If the student's question contains a factual error, gently correct it while answering.`;

// -----------------------------------------------------------------------------
function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonOk(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// -----------------------------------------------------------------------------
async function embed(text: string, openaiKey: string): Promise<number[]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!r.ok) throw new Error(`OpenAI embed failed: ${r.status} ${await r.text()}`);
  const json = await r.json();
  return json.data[0].embedding;
}

// -----------------------------------------------------------------------------
interface ClaudeResponse {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

async function callClaude(
  anthropicKey: string,
  systemBlocks: Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }>,
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ClaudeResponse> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      system: systemBlocks,
      messages,
    }),
  });
  if (!r.ok) throw new Error(`Claude API failed: ${r.status} ${await r.text()}`);
  return await r.json();
}

// -----------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !serviceKey || !anthropicKey || !openaiKey) {
    return jsonError("Server misconfigured", 500);
  }

  // Auth: identify the user from the JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonError("Not authenticated", 401);

  const sbUserClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await sbUserClient.auth.getUser();
  if (userErr || !userData.user) {
    return jsonError("Not authenticated", 401);
  }
  const userId = userData.user.id;

  // Service-role client for everything else (bypasses RLS)
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Parse body
  let body: { session_id?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const message = (body.message ?? "").trim();
  const sessionId = body.session_id;
  if (!message) return jsonError("Empty message", 400);
  if (message.length > 2000) return jsonError("Message too long (max 2000 chars)", 400);
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return jsonError("Invalid session_id", 400);
  }

  // -----------------------------
  // Step 1: rate limit + spend cap
  // -----------------------------
  const { data: limits, error: limitsErr } = await sb.rpc("potemkin_check_limits", {
    p_user_id: userId,
    p_skill: "chat",
    p_user_daily_limit: USER_DAILY_LIMIT,
    p_global_cap_pence: GLOBAL_CAP_PENCE,
  });
  if (limitsErr) return jsonError("Rate-limit check failed", 500);
  if (!limits?.allowed) {
    const reason = limits.global_spent_pence >= limits.global_cap_pence
      ? "Potemkin has hit today's budget. Try again tomorrow."
      : `You've used today's ${USER_DAILY_LIMIT} questions. Resets at midnight.`;
    return jsonError(reason, 429, {
      daily_remaining: 0,
      limits,
    });
  }

  try {
    // -----------------------------
    // Step 2: embed the question
    // -----------------------------
    const queryEmbedding = await embed(message, openaiKey);

    // -----------------------------
    // Step 3: semantic cache check
    // -----------------------------
    const { data: cacheHits } = await sb.rpc("potemkin_cache_lookup", {
      query_embedding: queryEmbedding,
      skill_in: "chat",
      threshold: CACHE_THRESHOLD,
    });

    if (cacheHits && cacheHits.length > 0) {
      const hit = cacheHits[0];
      // Update cache stats
      const { data: prev } = await sb
        .from("potemkin_cache")
        .select("hits")
        .eq("id", hit.cache_id)
        .single();
      await sb
        .from("potemkin_cache")
        .update({
          hits: (prev?.hits ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", hit.cache_id);

      // Store the exchange in the conversation
      await sb.from("potemkin_conversations").insert([
        { user_id: userId, session_id: sessionId, role: "user", content: message },
        { user_id: userId, session_id: sessionId, role: "assistant", content: hit.answer, token_count: 0 },
      ]);

      // Tiny usage cost for the embedding call only
      await sb.rpc("potemkin_record_usage", {
        p_user_id: userId,
        p_skill: "chat",
        p_cost_pence: 0.01, // just the embedding
      });

      return jsonOk({
        answer: hit.answer,
        cached: true,
        daily_remaining: Math.max(0, limits.user_limit - limits.user_count - 1),
      });
    }

    // -----------------------------
    // Step 4: retrieve relevant chunks
    // -----------------------------
    const { data: chunks, error: searchErr } = await sb.rpc("potemkin_search", {
      query_embedding: queryEmbedding,
      match_count: RETRIEVE_K,
    });
    if (searchErr) throw new Error(`Search failed: ${searchErr.message}`);

    const contextText = (chunks ?? [])
      .map((c: { source: string; content: string }, i: number) =>
        `[Source ${i + 1}: ${c.source}]\n${c.content}`
      )
      .join("\n\n---\n\n");

    // -----------------------------
    // Step 5: load recent conversation turns
    // -----------------------------
    const { data: history } = await sb
      .from("potemkin_conversations")
      .select("role, content")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_TURNS * 2);

    const historyOldestFirst = (history ?? []).reverse();

    // -----------------------------
    // Step 6: call Claude
    // -----------------------------
    const systemBlocks = [
      // Persistent rules — cached across calls
      {
        type: "text" as const,
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" as const },
      },
      // Retrieved context — changes per query, not cached
      {
        type: "text" as const,
        text: `RETRIEVED SOURCE MATERIAL FROM AQA 7042 TEXTBOOKS AND READINGS:\n\n${contextText}`,
      },
    ];

    const claudeMessages = [
      ...historyOldestFirst.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const claudeResponse = await callClaude(anthropicKey, systemBlocks, claudeMessages);
    const answerText = claudeResponse.content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .trim();

    if (!answerText) throw new Error("Empty answer from Claude");

    // -----------------------------
    // Step 7: persist + update cache + record usage
    // -----------------------------
    const inputTokens = claudeResponse.usage.input_tokens;
    const outputTokens = claudeResponse.usage.output_tokens;
    const cost =
      (inputTokens / 1000) * INPUT_PENCE_PER_1K +
      (outputTokens / 1000) * OUTPUT_PENCE_PER_1K +
      0.01; // embedding

    // Store conversation
    await sb.from("potemkin_conversations").insert([
      { user_id: userId, session_id: sessionId, role: "user", content: message },
      {
        user_id: userId,
        session_id: sessionId,
        role: "assistant",
        content: answerText,
        token_count: outputTokens,
      },
    ]);

    // Cache the Q+A for future near-identical questions
    await sb.from("potemkin_cache").insert({
      question_text: message,
      question_embedding: queryEmbedding,
      answer: answerText,
      skill: "chat",
      hits: 0,
    });

    // Record usage
    await sb.rpc("potemkin_record_usage", {
      p_user_id: userId,
      p_skill: "chat",
      p_cost_pence: cost,
    });

    return jsonOk({
      answer: answerText,
      cached: false,
      daily_remaining: Math.max(0, limits.user_limit - limits.user_count - 1),
      tokens: { input: inputTokens, output: outputTokens },
    });
  } catch (err) {
    console.error("potemkin-chat error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError(`Potemkin hit a snag: ${message}`, 500);
  }
});
