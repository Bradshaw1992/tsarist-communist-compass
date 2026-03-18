import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const { userText, keyConcepts } = (await req.json()) as RequestBody;

    if (!userText || !keyConcepts?.length) {
      return new Response(
        JSON.stringify({ error: "Missing userText or keyConcepts" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
${userText}
"""

Analyse the student's text against ONLY the provided key concepts. Return the JSON result.`;

    const modelCandidates = [
      "claude-3-5-haiku-latest",
      "claude-3-5-haiku-20241022",
      "claude-3-haiku-20240307",
      "claude-3-5-sonnet-latest",
    ];

    let response: Response | null = null;
    let selectedModel = "";
    const notFoundErrors: string[] = [];

    for (const model of modelCandidates) {
      const attempt = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: "user", content: userPrompt }],
          system: systemPrompt,
        }),
      });

      if (attempt.status === 404) {
        const notFoundText = await attempt.text();
        console.error("Anthropic model not found:", model, notFoundText);
        notFoundErrors.push(`${model}: ${notFoundText}`);
        continue;
      }

      selectedModel = model;
      response = attempt;
      break;
    }

    if (!response) {
      return new Response(
        JSON.stringify({
          error: `AI analysis failed: no available Anthropic model found. Tried ${modelCandidates.join(", ")}.`,
          details: notFoundErrors,
        }),
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
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
