import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import confetti from "canvas-confetti";
import { useRecallForSpec } from "@/hooks/useRevisionData";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PenLine, Eye, RotateCcw, AlertTriangle, CheckCircle2, Mic, MicOff, Sparkles, Cpu, Loader2, Trash2, Camera, ExternalLink, Wand2 } from "lucide-react";
import { fuzzyKeywordInText } from "@/lib/fuzzyMatcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import type { KeyConcept } from "@/types/revision";

interface BlankRecallProps {
  specId: number;
  specTitle: string;
  onScoreRecord?: (specId: number, correct: number, total: number) => void;
}

interface AnalysedConcept {
  text: string;
  matchedKeywords: string[]; // keywords/phrases highlighted in the concept text
}

// ─── Local keyword matching (original logic) ───────────────────────────────

function analyseKeyConceptsLocal(userText: string, concepts: KeyConcept[]) {
  const mentioned: AnalysedConcept[] = [];
  const missed: string[] = [];

  for (const kc of concepts) {
    const matched = kc.trigger_keywords.filter((kw) =>
      fuzzyKeywordInText(userText, kw)
    );
    const threshold = kc.trigger_keywords.length <= 1 ? 1 : 2;
    if (matched.length >= threshold) {
      mentioned.push({ text: kc.concept, matchedKeywords: matched });
    } else {
      missed.push(kc.concept);
    }
  }

  return { mentioned, missed };
}

// ─── AI-powered analysis via edge function ─────────────────────────────────

interface AIResult {
  concept: string;
  status: "mentioned" | "missed";
  matched_phrases: string[];
}

function classifyError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("deadline") || lower.includes("aborted") || lower.includes("524") || lower.includes("504")) {
    return "That was a long one! The AI timed out. Try breaking your answer into 1-minute chunks.";
  }
  if (lower.includes("too large") || lower.includes("payload") || lower.includes("413") || lower.includes("too long")) {
    return "Recording is too large. Try speaking a bit more concisely.";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch") || lower.includes("load failed") || lower.includes("networkerror") || lower.includes("offline")) {
    return "Network error. Please check your Wi-Fi and try again.";
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return "Rate limit reached. Please wait a moment and try again.";
  }
  return "Claude is a bit busy! Please try again in 10 seconds or shorten your text.";
}

async function analyseKeyConceptsAI(
  userText: string,
  concepts: KeyConcept[],
  onProgress?: (charCount: number) => void
): Promise<{ mentioned: AnalysedConcept[]; missed: string[] }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const url = `${supabaseUrl}/functions/v1/analyse-recall`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ userText, keyConcepts: concepts }),
    });
  } catch (fetchErr) {
    console.error("[BlankRecall] Network/fetch error:", fetchErr);
    throw new Error(classifyError(fetchErr));
  }

  if (!response.ok) {
    let errMsg = `AI analysis failed (${response.status})`;
    try {
      const errBody = await response.json();
      if (errBody?.error) errMsg = errBody.error;
    } catch {}
    console.error("[BlankRecall] Edge function error:", errMsg);
    throw new Error(classifyError(new Error(errMsg)));
  }

  // ── Read SSE stream ──────────────────────────────────────────────────
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream");

  const decoder = new TextDecoder();
  let buffer = "";
  let resultData: any = null;
  let streamError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") continue;

      try {
        const event = JSON.parse(payload);
        if (event.type === "progress" && onProgress) {
          onProgress(event.length);
        } else if (event.type === "result") {
          resultData = event.data;
        } else if (event.type === "error") {
          streamError = event.error;
        }
      } catch {}
    }
  }

  if (streamError) {
    console.error("[BlankRecall] Stream error:", streamError);
    throw new Error(classifyError(new Error(streamError)));
  }

  if (!resultData?.results) {
    throw new Error("Claude is a bit busy! Please try again in 10 seconds or shorten your text.");
  }

  const results: AIResult[] = resultData.results;
  const mentioned: AnalysedConcept[] = [];
  const missed: string[] = [];

  for (const r of results) {
    if (r.status === "mentioned") {
      mentioned.push({ text: r.concept, matchedKeywords: r.matched_phrases });
    } else {
      missed.push(r.concept);
    }
  }

  return { mentioned, missed };
}

// ─── Highlight helper ──────────────────────────────────────────────────────

function highlightKeywords(text: string, matchedWords: string[]) {
  if (matchedWords.length === 0) return <>{text}</>;
  // Sort by length descending so longer phrases match first
  const sorted = [...matchedWords].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => {
        const isMatch = sorted.some((w) => w.toLowerCase() === part.toLowerCase());
        return isMatch ? (
          <mark key={i} className="rounded-sm bg-success/20 px-0.5 text-foreground">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export function BlankRecall({ specId, specTitle, onScoreRecord }: BlankRecallProps) {
  const recall = useRecallForSpec(specId);
  const storageKey = `blank-recall-${specId}`;

  const [userText, setUserText] = useState(() => {
    try { return localStorage.getItem(storageKey) ?? ""; } catch { return ""; }
  });
  const [revealed, setRevealed] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [analysis, setAnalysis] = useState<{ mentioned: AnalysedConcept[]; missed: string[] } | null>(null);
  const [polishedText, setPolishedText] = useState<string | null>(null);
  const [isPolishing, setIsPolishing] = useState(false);
  const [analyseError, setAnalyseError] = useState<string | null>(null);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [streamingPolish, setStreamingPolish] = useState("");
  const prefixRef = useRef("");

  // Persist text to localStorage
  useEffect(() => {
    try { localStorage.setItem(storageKey, userText); } catch {}
  }, [userText, storageKey]);

  // Reload saved text when specId changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey) ?? "";
      setUserText(saved);
    } catch { setUserText(""); }
    setRevealed(false);
    setAnalysis(null);
    setPolishedText(null);
  }, [storageKey]);

  const handleTranscript = useCallback((text: string) => {
    setUserText(prefixRef.current + text);
  }, []);

  const { isListening, isSupported, toggle } = useSpeechToText({
    onTranscript: handleTranscript,
  });

  const handleStartRecording = () => {
    prefixRef.current = userText ? userText.trimEnd() + " " : "";
    toggle();
  };

  const fireConfetti = () => {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5 } }), 300);
  };

  const handleScoreRecord = (mentioned: number, total: number) => {
    if (onScoreRecord && total > 0) {
      onScoreRecord(specId, mentioned, total);
      const pct = Math.round((mentioned / total) * 100);
      if (pct >= 90) {
        fireConfetti();
        toast.success(`🌟 Topic Mastered! You scored ${pct}%`, { duration: 5000 });
      }
    }
  };

  const handleReveal = async () => {
    if (!recall?.key_concepts) return;
    trackEvent("analyse_recall", { mode: useAI ? "ai" : "local", spec_id: specId });
    setAnalyseError(null);

    if (useAI) {
      setIsAnalysing(true);
      try {
        const result = await analyseKeyConceptsAI(userText, recall.key_concepts);
        setAnalysis(result);
        setRevealed(true);
        handleScoreRecord(result.mentioned.length, result.mentioned.length + result.missed.length);
      } catch (err) {
        console.error("AI analysis error:", err);
        const msg = err instanceof Error ? err.message : "Claude is a bit busy! Please try again in 10 seconds or shorten your text.";
        setAnalyseError(msg);
        toast.error(msg, { duration: 6000 });
      } finally {
        setIsAnalysing(false);
      }
    } else {
      const result = analyseKeyConceptsLocal(userText, recall.key_concepts);
      setAnalysis(result);
      setRevealed(true);
      handleScoreRecord(result.mentioned.length, result.mentioned.length + result.missed.length);
    }
  };

  const handleReset = () => {
    setUserText("");
    setRevealed(false);
    setAnalysis(null);
    setPolishedText(null);
  };

  const handleClearAndNew = () => {
    setUserText("");
    setRevealed(false);
    setAnalysis(null);
    setPolishedText(null);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  const handlePolish = async () => {
    if (!userText.trim()) {
      toast.error("Write or record your recall first before polishing.");
      return;
    }
    setIsPolishing(true);
    setPolishedText(null);
    setStreamingPolish("");
    setPolishError(null);
    trackEvent("polish_transcript", { spec_id: specId });

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `${supabaseUrl}/functions/v1/polish-transcript`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ transcript: userText }),
      });

      if (!response.ok) {
        let errMsg = `Polish failed (${response.status})`;
        try { const b = await response.json(); if (b?.error) errMsg = b.error; } catch {}
        throw new Error(errMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
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
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload);
            if (event.type === "delta" && event.text) {
              fullText += event.text;
              setStreamingPolish(fullText);
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") throw parseErr;
          }
        }
      }

      setPolishedText(fullText);
      setStreamingPolish("");
    } catch (err) {
      console.error("[BlankRecall] Polish error:", err);
      const msg = err instanceof Error ? err.message : "Failed to polish transcript. Please try again.";
      setPolishError(msg);
      toast.error(msg, { duration: 5000 });
    } finally {
      setIsPolishing(false);
    }
  };

  if (!recall) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No recall data available for this specification point.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-bold text-primary">Blank Recall</h2>
          <p className="text-sm text-muted-foreground">
            Active learning — write everything you know, then check your gaps.
          </p>
        </div>

        {/* AI / Local toggle */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="ai-toggle" className="cursor-pointer text-xs font-medium text-muted-foreground">
            Local
          </Label>
          <Switch
            id="ai-toggle"
            checked={useAI}
            onCheckedChange={setUseAI}
            disabled={revealed || isAnalysing}
          />
          <Label htmlFor="ai-toggle" className="cursor-pointer text-xs font-medium text-primary">
            AI
          </Label>
          <Sparkles className={`h-4 w-4 ${useAI ? "text-primary" : "text-muted-foreground"}`} />
        </div>
      </div>

      <Card className="border-2 border-dashed border-accent/40 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-serif text-lg text-primary">
            <PenLine className="h-5 w-5 text-accent" />
            Write everything you know about:
          </CardTitle>
          <p className="font-serif text-base font-medium italic text-foreground/80">
            "{specTitle}"
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder={isListening ? "Listening… speak now" : "Start writing your recall here…"}
            className="min-h-[200px] resize-y border-border bg-background font-sans text-sm leading-relaxed"
            disabled={revealed || isAnalysing}
          />
          {!revealed && !isAnalysing && (
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {/* Handwritten Notes Modal */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="lg" className="min-h-[48px] gap-2">
                    <Camera className="h-5 w-5" />
                    <span className="hidden sm:inline">Use Handwritten Notes</span>
                    <span className="sm:hidden">Notes</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-serif text-lg text-primary">
                      <Camera className="h-5 w-5" />
                      Potemkin Scribe
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <p className="text-sm leading-relaxed text-foreground/80">
                      Working on paper? Upload a photo of your handwritten recall to the <strong>Potemkin Scribe</strong> to turn it into text you can paste here.
                    </p>
                    <a
                      href="https://gemini.google.com/gem/1m9H0A3i4EGgdifGheiLlYB0ti1ZY9WO6?usp=sharing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Potemkin Scribe
                    </a>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Gemini longer recording */}
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-[48px] gap-2 border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-950/40"
                asChild
              >
                <a
                  href="https://gemini.google.com/gem/1KklPWqDQ-aHyCCgNK9LnkEiK64GjQZyL?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Sparkles className="h-5 w-5" />
                  <span className="hidden sm:inline">Longer Recording with Gemini</span>
                  <span className="sm:hidden">Gemini</span>
                </a>
              </Button>

              {/* Voice recording */}
              {isSupported && (
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "outline"}
                  size="lg"
                  onClick={handleStartRecording}
                  className={`min-h-[48px] min-w-[48px] gap-2 ${isListening ? "animate-pulse" : ""}`}
                >
                  {isListening ? (
                    <>
                      <MicOff className="h-5 w-5" />
                      <span className="hidden sm:inline">Stop</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5" />
                      <span className="hidden sm:inline">Record</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {!revealed ? (
          <Button
            onClick={handleReveal}
            disabled={!userText.trim() || isListening || isAnalysing || isPolishing}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isAnalysing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analysing{useAI ? " with AI…" : "…"}
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Analyse{useAI ? " with AI" : ""}
              </>
            )}
          </Button>
        ) : (
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        )}

        {/* AI Polish button */}
        <Button
          onClick={handlePolish}
          disabled={!userText.trim() || isPolishing || isAnalysing || isListening}
          variant="outline"
          className="gap-2 border-accent/50 hover:bg-accent/10"
        >
          {isPolishing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Claude is thinking…
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              ✨ Clean with Claude
            </>
          )}
        </Button>

        <Button onClick={handleClearAndNew} variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Clear &amp; Start New
        </Button>
        {!revealed && (
          <span className="text-xs text-muted-foreground">
            {useAI ? "Using Claude AI for semantic analysis" : "Using local keyword matching"}
          </span>
        )}
      </div>

      {/* Processing feedback banner */}
      {isAnalysing && useAI && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Processing your recall…</p>
              <p className="text-xs text-muted-foreground">
                This might take a moment for longer recordings. The AI is reading through your answer.
              </p>
            </div>
          </CardContent>
        </Card>
      )}



      {revealed && analysis && (
        <div className="space-y-6">
          {/* Score summary */}
          <Card className="border-accent/30">
            <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              <span className="text-sm font-medium text-foreground">
                You covered <strong>{analysis.mentioned.length}</strong> of <strong>{recall.key_concepts.length}</strong> key concepts.
              </span>
              {analysis.missed.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  — {analysis.missed.length} concept{analysis.missed.length !== 1 ? "s" : ""} missed below.
                </span>
              )}
            </CardContent>
          </Card>

          {/* Key Material Mentioned */}
          {analysis.mentioned.length > 0 && (
            <Card className="border-success/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  Key Material Mentioned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 pl-1">
                  {analysis.mentioned.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/80">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success/60" />
                      <span>{highlightKeywords(item.text, item.matchedKeywords)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs italic text-muted-foreground">
                  {useAI
                    ? "Marked by the Potemkin AI — concepts matched semantically against your response."
                    : "Note: This is based on keyword detection. Please verify your own explanations to ensure accuracy."}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Key Material Missed */}
          {analysis.missed.length > 0 ? (
            <Card className="border-destructive/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Key Material Missed
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  These concepts were not detected in your response.
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 pl-1">
                  {analysis.missed.map((concept, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/80">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive/60" />
                      <span>{concept}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-success/30">
              <CardContent className="flex items-center gap-3 p-6">
                <CheckCircle2 className="h-6 w-6 text-success" />
                <p className="font-serif text-base font-medium text-foreground">
                  Excellent — you covered all the key concepts!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Polishing feedback */}
      {isPolishing && (
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-accent" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Claude is thinking…</p>
              <p className="text-xs text-muted-foreground">
                Cleaning your transcript, correcting names, and organising into sections.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Polished output — parchment style */}
      {polishedText && (
        <Card className="relative overflow-hidden border-2 border-amber-600/30 bg-amber-50/80 shadow-md dark:border-amber-500/20 dark:bg-amber-950/20">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgbnVtT2N0YXZlcz0iNCIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWx0ZXI9InVybCgjYSkiIG9wYWNpdHk9Ii40Ii8+PC9zdmc+')]" />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 font-serif text-lg text-amber-800 dark:text-amber-200">
              <Wand2 className="h-5 w-5" />
              Polished Transcript
            </CardTitle>
            <p className="text-xs text-amber-700/70 dark:text-amber-300/50">
              Cleaned by Claude 3.5 Haiku — filler removed, names corrected, structured into sections.
            </p>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none font-serif leading-relaxed text-amber-950 dark:text-amber-100 prose-headings:font-serif prose-headings:text-amber-800 dark:prose-headings:text-amber-200 prose-strong:text-amber-900 dark:prose-strong:text-amber-100 prose-li:marker:text-amber-600"
              dangerouslySetInnerHTML={{
                __html: polishedText
                  .replace(/^## (.+)$/gm, '<h2 class="text-base font-bold mt-4 mb-2">$1</h2>')
                  .replace(/^- (.+)$/gm, '<li>$1</li>')
                  .replace(/(<li>.*<\/li>\n?)+/gs, (match) => `<ul class="list-disc pl-5 space-y-1">${match}</ul>`)
                  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\n{2,}/g, '<br/><br/>')
                  .replace(/\n/g, '<br/>')
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
