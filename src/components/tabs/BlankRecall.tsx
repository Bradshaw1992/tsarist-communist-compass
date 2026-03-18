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
import { PenLine, Eye, RotateCcw, AlertTriangle, CheckCircle2, Mic, MicOff, Sparkles, Cpu, Loader2, Trash2, Camera, ExternalLink } from "lucide-react";
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

async function analyseKeyConceptsAI(
  userText: string,
  concepts: KeyConcept[]
): Promise<{ mentioned: AnalysedConcept[]; missed: string[] }> {
  const { data, error } = await supabase.functions.invoke("analyse-recall", {
    body: { userText, keyConcepts: concepts },
  });

  if (error) {
    throw new Error(error.message || "AI analysis failed");
  }

  // Handle rate limit / payment errors surfaced from the edge function
  if (data?.error) {
    throw new Error(data.error);
  }

  const results: AIResult[] = data?.results ?? [];

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

  const handleReveal = async () => {
    if (!recall?.key_concepts) return;
    trackEvent("analyse_recall", { mode: useAI ? "ai" : "local", spec_id: specId });

    if (useAI) {
      setIsAnalysing(true);
      try {
        const result = await analyseKeyConceptsAI(userText, recall.key_concepts);
        setAnalysis(result);
        setRevealed(true);
      } catch (err) {
        console.error("AI analysis error:", err);
        toast.error(
          err instanceof Error ? err.message : "AI analysis failed. Try local matching instead.",
          { duration: 5000 }
        );
      } finally {
        setIsAnalysing(false);
      }
    } else {
      const result = analyseKeyConceptsLocal(userText, recall.key_concepts);
      setAnalysis(result);
      setRevealed(true);
    }
  };

  const handleReset = () => {
    setUserText("");
    setRevealed(false);
    setAnalysis(null);
  };

  const handleClearAndNew = () => {
    setUserText("");
    setRevealed(false);
    setAnalysis(null);
    try { localStorage.removeItem(storageKey); } catch {}
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
            <div className="flex items-center justify-end gap-2 pt-2">
              {/* Handwritten Notes Modal */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="lg" className="min-h-[48px] gap-2">
                    <Camera className="h-5 w-5" />
                    <span className="hidden sm:inline">Use Handwritten Notes</span>
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

      <div className="flex items-center gap-3">
        {!revealed ? (
          <Button
            onClick={handleReveal}
            disabled={!userText.trim() || isListening || isAnalysing}
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
    </div>
  );
}
