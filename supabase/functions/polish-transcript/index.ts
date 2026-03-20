import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_TEXT_LENGTH = 15_000;

// Reuse the same rate limiter pattern from analyse-recall
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
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

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      console.error("ANTHROPIC_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "An internal error occurred. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return new Response(
        JSON.stringify({ error: "No transcript provided. Write or record your recall first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (transcript.length > MAX_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Transcript too long (max ${MAX_TEXT_LENGTH} characters). Try a shorter recording.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert A-Level History Scribe. Clean this transcript by removing filler words, correcting historical names (e.g., Pobedonostsev, Zinoviev), and formatting it into three sections: Main Arguments, Key Evidence, and Historiography/Vocabulary. Use markdown formatting with ## headings for each section and bullet points for clarity. Keep the student's original meaning intact — only clean, never add new content.`;

    const safeTranscript = transcript.replace(/"""/g, "'''");

    const authHeaders = {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    };

    // Discover available models dynamically
    const modelsResponse = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: authHeaders,
    });

    if (!modelsResponse.ok) {
      const modelListError = await modelsResponse.text();
      console.error("Anthropic models list error:", modelsResponse.status, modelListError);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const modelsPayload = await modelsResponse.json() as { data?: { id?: string }[] };
    const availableModelIds = (modelsPayload.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id));

    if (availableModelIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prefer Haiku (cheapest/fastest), then Sonnet, then any Claude
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
          max_tokens: 4096,
          messages: [{ role: "user", content: `Here is the raw transcript to clean:\n\n"""\n${safeTranscript}\n"""` }],
          system: systemPrompt,
        }),
      });

      if (attempt.status === 404) continue;

      selectedModel = model;
      response = attempt;
      break;
    }

    if (!response) {
      console.error("All discovered models returned 404");
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }),
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
        JSON.stringify({ error: "An internal error occurred. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicResponse = await response.json();
    const content = anthropicResponse.content?.[0]?.text;

    if (!content) {
      console.error("No content in Anthropic response:", anthropicResponse);
      return new Response(
        JSON.stringify({ error: "An internal error occurred. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ polished: content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("polish-transcript error:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
