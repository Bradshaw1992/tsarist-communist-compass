import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRIMARY_MODEL = "claude-3-5-haiku-20241022";
const FALLBACK_MODELS = ["claude-3-5-haiku-latest", "claude-3-haiku-20240307"];
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const MAX_USER_TEXT_LENGTH = 10_000;
const MAX_KEY_CONCEPTS = 50;
const MAX_TOKENS = 4096;
const HEARTBEAT_MS = 8000;

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

interface KeyConcept { concept: string; trigger_keywords: string[]; }
interface RequestBody { userText: string; keyConcepts: KeyConcept[]; }

interface NormalizedResult {
  concept: string;
  status: "mentioned" | "missed";
  matched_phrases: string[];
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseJsonFromText(rawText: string): unknown | null {
  const trimmed = rawText.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [withoutFence];
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(withoutFence.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next candidate
    }
  }

  return null;
}

function normalizeResults(raw: unknown, keyConcepts: KeyConcept[]): { results: NormalizedResult[] } | null {
  const rawResults = (raw as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(rawResults)) return null;

  const byIndex = new Map<number, NormalizedResult>();

  for (const entry of rawResults) {
    if (!entry || typeof entry !== "object") continue;

    const item = entry as {
      id?: unknown;
      index?: unknown;
      concept?: unknown;
      status?: unknown;
      matched_phrases?: unknown;
    };

    let index = -1;
    if (typeof item.id === "number" && Number.isInteger(item.id)) {
      index = item.id;
    } else if (typeof item.index === "number" && Number.isInteger(item.index)) {
      index = item.index;
    } else if (typeof item.concept === "string") {
      index = keyConcepts.findIndex((kc) => kc.concept === item.concept);
    }

    if (index < 0 || index >= keyConcepts.length) continue;

    const conceptText = keyConcepts[index].concept;
    const status: "mentioned" | "missed" = item.status === "mentioned" ? "mentioned" : "missed";
    const matchedRaw = Array.isArray(item.matched_phrases) ? item.matched_phrases : [];
    const matchedPhrases = status === "mentioned"
      ? matchedRaw
          .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
          .filter((p) => conceptText.toLowerCase().includes(p.toLowerCase()))
          .slice(0, 4)
      : [];

    byIndex.set(index, {
      concept: conceptText,
      status,
      matched_phrases: matchedPhrases,
    });
  }

  const results: NormalizedResult[] = keyConcepts.map((kc, idx) =>
    byIndex.get(idx) ?? { concept: kc.concept, status: "missed", matched_phrases: [] }
  );

  return { results };
}

async function openAnthropicStream(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
) {
  const models = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastStatus = 500;
  let lastErrorText = "Unknown error";

  for (const model of models) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        stream: true,
        messages: [{ role: "user", content: userPrompt }],
        system: systemPrompt,
      }),
    });

    if (response.ok) {
      return { response, model };
    }

    lastStatus = response.status;
    lastErrorText = await response.text();
    console.error(`Anthropic API error with model ${model}:`, response.status, lastErrorText);

    if (response.status !== 404) break;
  }

  return { response: null, model: null, lastStatus, lastErrorText };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") || "unknown";

    if (isRateLimited(clientIp)) {
      return jsonError("Rate limit exceeded. Please try again in a moment.", 429);
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const { userText, keyConcepts } = (await req.json()) as RequestBody;

    if (!userText || typeof userText !== "string") return jsonError("Missing or invalid userText", 400);
    if (userText.length > MAX_USER_TEXT_LENGTH) return jsonError(`userText too long (max ${MAX_USER_TEXT_LENGTH} characters)`, 400);
    if (!Array.isArray(keyConcepts) || keyConcepts.length === 0) return jsonError("Missing or empty keyConcepts", 400);
    if (keyConcepts.length > MAX_KEY_CONCEPTS) return jsonError(`keyConcepts limit exceeded (max ${MAX_KEY_CONCEPTS})`, 400);

    const safeText = userText.replace(/"""/g, "'''");
    const conceptPayload = keyConcepts.map((kc, index) => ({
      id: index,
      concept: kc.concept,
      trigger_keywords: kc.trigger_keywords,
    }));

    const systemPrompt = `You are the Potemkin History Marker. Your ONLY source of truth is the provided JSON array of key concepts. If a student's answer contains the core meaning of a concept in the JSON, mark it as "Mentioned." Do NOT use outside historical knowledge from the internet. If it is not in the JSON, it does not exist for this marking session.

You will receive:
1. A JSON array of key concepts, each with an integer "id", a "concept" (the full bullet point), and "trigger_keywords".
2. The student's written text.

Your task:
- For each concept, determine if the student has demonstrated knowledge of its core meaning (not just keyword matching — understand semantic intent).
- Return a JSON object with exactly this structure:
{
  "results": [
    {
      "id": <the concept id from the JSON>,
      "status": "mentioned" | "missed",
      "matched_phrases": ["<specific words/phrases FROM the concept text that the student successfully recalled>"]
    }
  ]
}

Rules for "matched_phrases":
- These must be substrings of the concept text (not the student's text).
- They represent the parts of the concept bullet point that the student's answer covers.
- For "missed" concepts, matched_phrases should be an empty array.
- Be generous but accurate: if the student conveys the same idea with different words, still mark the relevant phrase in the concept as matched.
- Keep matched_phrases concise (max 4 short phrases per concept).
- Return only raw JSON (no markdown, no explanation).`;

    const userPrompt = `KEY CONCEPTS JSON:\n${JSON.stringify(conceptPayload)}\n\nSTUDENT'S WRITTEN TEXT:\n"""\n${safeText}\n"""\n\nAnalyse the student's text against ONLY the provided key concepts. Return the JSON result.`;

    const anthropicAttempt = await openAnthropicStream(ANTHROPIC_API_KEY, systemPrompt, userPrompt);

    if (!anthropicAttempt.response) {
      if (anthropicAttempt.lastStatus === 429) return jsonError("Rate limit exceeded. Please try again in a moment.", 429);
      return jsonError(`AI analysis failed (${anthropicAttempt.lastStatus})`, 500);
    }

    const anthropicStream = anthropicAttempt.response;
    const activeModel = anthropicAttempt.model;

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readable = new ReadableStream({
      async start(controller) {
        let heartbeat: number | null = null;
        let resultSent = false;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "started", model: activeModel })}\n\n`));

          heartbeat = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "heartbeat", ts: Date.now() })}\n\n`));
            } catch {
              // stream already closed
            }
          }, HEARTBEAT_MS);

          const reader = anthropicStream.body!.getReader();
          let buffer = "";
          let fullText = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;

              try {
                const event = JSON.parse(jsonStr);
                if (event.type === "content_block_delta" && event.delta?.text) {
                  fullText += event.delta.text;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "progress", length: fullText.length })}\n\n`));
                }
                if (event.type === "error") {
                  const errorMessage = event.error?.message || "AI provider stream error";
                  console.error("Anthropic stream error:", errorMessage);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`));
                }
                if (event.type === "message_stop") {
                  const parsedRaw = parseJsonFromText(fullText);
                  const normalized = parsedRaw ? normalizeResults(parsedRaw, keyConcepts) : null;
                  if (normalized) {
                    resultSent = true;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "result", data: normalized })}\n\n`));
                  } else {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Could not parse AI response" })}\n\n`));
                  }
                }
              } catch { /* skip malformed */ }
            }
          }

          if (!resultSent && fullText) {
            const parsedRaw = parseJsonFromText(fullText);
            const normalized = parsedRaw ? normalizeResults(parsedRaw, keyConcepts) : null;
            if (normalized) {
              resultSent = true;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "result", data: normalized })}\n\n`));
            } else {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Incomplete AI response" })}\n\n`));
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          if (heartbeat) clearInterval(heartbeat);
          controller.close();
        } catch (err) {
          console.error("Stream processing error:", err);
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Stream processing failed" })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            if (heartbeat) clearInterval(heartbeat);
            controller.close();
          } catch { /* controller already closed */ }
        }
      },
    });

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  } catch (error) {
    console.error("analyse-recall error:", error);
    return jsonError("An internal error occurred. Please try again.", 500);
  }
});
