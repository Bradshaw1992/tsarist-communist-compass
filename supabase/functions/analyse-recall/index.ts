import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── In-memory rate limiter (per Deno isolate) ─────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per window per IP

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS);

// ─── Input limits ──────────────────────────────────────────────────────────
const MAX_USER_TEXT_LENGTH = 10_000;
const MAX_KEY_CONCEPTS = 50;

interface KeyConcept {
  concept: string;
  trigger_keywords: string[];
}

interface RequestBody {
  userText: string;
  keyConcepts: KeyConcept[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Rate limiting ────────────────────────────────────────────────────
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    if (isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const { userText, keyConcepts } = (await req.json()) as RequestBody;

    // ── Input validation ─────────────────────────────────────────────────
    if (!userText || typeof userText !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid userText" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (userText.length > MAX_USER_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `userText too long (max ${MAX_USER_TEXT_LENGTH} characters)` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Array.isArray(keyConcepts) || keyConcepts.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing or empty keyConcepts" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (keyConcepts.length > MAX_KEY_CONCEPTS) {
      return new Response(
        JSON.stringify({ error: `keyConcepts limit exceeded (max ${MAX_KEY_CONCEPTS})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize triple-quotes to prevent prompt injection escape
    const safeText = userText.replace(/"""/g, "'''");

    const systemPrompt = `You are the Potemkin History Marker. Your ONLY source of truth is the provided JSON array of key concepts. If a student's answer contains the core meaning of a concept in the JSON, mark it as "Mentioned." Do NOT use outside historical knowledge from the internet. If it is not in the JSON, it does not exist for this marking session.

You will receive:
1. A JSON array of key concepts, each with a "concept" (the full bullet point) and "trigger_keywords".
2. The student's written text.

Your task:
- For each concept, determine if the student has demonstrated knowledge of its core meaning (not just keyword matching — understand semantic intent).
- Return a JSON object with exactly this structure:
{
  "results": [
    {
      "concept": "<the full concept text from the JSON>",
      "status": "mentioned" | "missed",
      "matched_phrases": ["<specific words/phrases FROM the concept text that the student successfully recalled>"]
    }
  ]
}

Rules for "matched_phrases":
- These must be substrings of the concept text (not the student's text).
- They represent the parts of the concept bullet point that the student's answer covers.
- For "missed" concepts, matched_phrases should be an empty array.
- Be generous but accurate: if the student conveys the same idea with different words, still mark the relevant phrase in the concept as matched.`;

    const userPrompt = `KEY CONCEPTS JSON:
${JSON.stringify(keyConcepts, null, 2)}

STUDENT'S WRITTEN TEXT:
"""
${safeText}
"""

Analyse the student's text against ONLY the provided key concepts. Return the JSON result.`;

    const authHeaders = {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    };

    const modelsResponse = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: authHeaders,
    });

    if (!modelsResponse.ok) {
      const modelListError = await modelsResponse.text();
      console.error("Anthropic models list error:", modelsResponse.status, modelListError);
      return new Response(
        JSON.stringify({ error: `AI analysis failed: unable to list Anthropic models (${modelsResponse.status})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const modelsPayload = await modelsResponse.json() as { data?: { id?: string }[] };
    const availableModelIds = (modelsPayload.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id));

    if (availableModelIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "AI analysis failed: no Anthropic models are available for this API key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const modelScore = (id: string) => {
      const lower = id.toLowerCase();
      if (lower.includes("3-5-haiku")) return 5;
      if (lower.includes("haiku")) return 4;
      if (lower.includes("sonnet")) return 3;
      if (lower.includes("claude")) return 2;
      return 1;
    };

    const rankedModels = [...availableModelIds].sort((a, b) => modelScore(b) - modelScore(a));

    let response: Response | null = null;
    let selectedModel = "";

    for (const model of rankedModels) {
      const attempt = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          messages: [{ role: "user", content: userPrompt }],
          system: systemPrompt,
        }),
      });

      if (attempt.status === 404) {
        continue;
      }

      selectedModel = model;
      response = attempt;
      break;
    }

    if (!response) {
      return new Response(
        JSON.stringify({ error: "AI analysis failed: all discovered Anthropic models returned not found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText, "model:", selectedModel);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `AI analysis failed (${response.status})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicResponse = await response.json();
    const content = anthropicResponse.content?.[0]?.text;

    if (!content) {
      throw new Error("No content in Anthropic response");
    }

    // Extract JSON from the response (it might be wrapped in markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from AI response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyse-recall error:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
