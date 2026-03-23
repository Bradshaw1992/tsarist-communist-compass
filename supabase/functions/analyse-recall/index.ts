import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── In-memory rate limiter ────────────────────────────────────────────────
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

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
      return jsonError("Rate limit exceeded. Please try again in a moment.", 429);
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const { userText, keyConcepts } = (await req.json()) as RequestBody;

    // ── Input validation ─────────────────────────────────────────────────
    if (!userText || typeof userText !== "string") {
      return jsonError("Missing or invalid userText", 400);
    }
    if (userText.length > MAX_USER_TEXT_LENGTH) {
      return jsonError(`userText too long (max ${MAX_USER_TEXT_LENGTH} characters)`, 400);
    }
    if (!Array.isArray(keyConcepts) || keyConcepts.length === 0) {
      return jsonError("Missing or empty keyConcepts", 400);
    }
    if (keyConcepts.length > MAX_KEY_CONCEPTS) {
      return jsonError(`keyConcepts limit exceeded (max ${MAX_KEY_CONCEPTS})`, 400);
    }

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

    // ── Discover available models ────────────────────────────────────────
    const modelsResponse = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: authHeaders,
    });

    if (!modelsResponse.ok) {
      const err = await modelsResponse.text();
      console.error("Anthropic models list error:", modelsResponse.status, err);
      return jsonError(`AI analysis failed: unable to list models (${modelsResponse.status})`, 500);
    }

    const modelsPayload = (await modelsResponse.json()) as { data?: { id?: string }[] };
    const availableModelIds = (modelsPayload.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id));

    if (availableModelIds.length === 0) {
      return jsonError("AI analysis failed: no models available for this API key", 500);
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

    // ── Try each model with STREAMING ────────────────────────────────────
    let anthropicStream: Response | null = null;
    let selectedModel = "";

    for (const model of rankedModels) {
      const attempt = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          stream: true,
          messages: [{ role: "user", content: userPrompt }],
          system: systemPrompt,
        }),
      });

      if (attempt.status === 404) {
        continue;
      }

      selectedModel = model;
      anthropicStream = attempt;
      break;
    }

    if (!anthropicStream) {
      return jsonError("AI analysis failed: all models returned not found", 500);
    }

    if (!anthropicStream.ok) {
      const errorText = await anthropicStream.text();
      console.error("Anthropic API error:", anthropicStream.status, errorText, "model:", selectedModel);

      if (anthropicStream.status === 429) {
        return jsonError("Rate limit exceeded. Please try again in a moment.", 429);
      }
      return jsonError(`AI analysis failed (${anthropicStream.status})`, 500);
    }

    // ── Stream Anthropic SSE events through to the client ────────────────
    // We transform Anthropic's SSE stream into a simple text stream that
    // concatenates content_block_delta text pieces, then sends the final
    // assembled JSON as a single flush at the end. This keeps the connection
    // alive (preventing gateway timeouts) while giving the client a clean
    // text/event-stream it can read incrementally.

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const reader = anthropicStream!.body!.getReader();
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
                  // Send a keepalive/progress SSE event
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "progress", length: fullText.length })}\n\n`)
                  );
                }

                if (event.type === "message_stop") {
                  // Parse and send the final result
                  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: "result", data: parsed })}\n\n`)
                    );
                  } else {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Could not parse AI response" })}\n\n`)
                    );
                  }
                }
              } catch {
                // skip malformed SSE lines
              }
            }
          }

          // If we never got message_stop, try to parse what we have
          if (fullText && !fullText.includes('"message_stop"')) {
            const jsonMatch = fullText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[0]);
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "result", data: parsed })}\n\n`)
                );
              } catch {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Incomplete AI response" })}\n\n`)
                );
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Stream processing error:", err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Stream processing failed" })}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("analyse-recall error:", error);
    return jsonError("An internal error occurred. Please try again.", 500);
  }
});
