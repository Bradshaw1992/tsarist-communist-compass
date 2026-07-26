import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import confetti from "canvas-confetti";
import { useRecallForSpec, useFactDrillerForSpec } from "@/hooks/useRevisionData";
import { buildFollowUpFactQuestions } from "@/lib/followup";
import { SpecificKnowledge } from "@/components/tabs/SpecificKnowledge";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PenLine, Eye, RotateCcw, AlertTriangle, CheckCircle2, Mic, MicOff, Sparkles, Cpu, Loader2, Trash2, Camera, ExternalLink, GraduationCap } from "lucide-react";
import { fuzzyKeywordInText } from "@/lib/fuzzyMatcher";

import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { markWithZhukovsky, buildPotemkinHandoff, ZHUKOVSKY_BANDS, type ZhukovskyResult } from "@/lib/zhukovsky";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import type { KeyConcept, FactDrillerQuestion } from "@/types/revision";
import type { BlankRecallInput, DrillerSessionInput } from "@/hooks/useHighScores";
import type { AssessmentInput } from "@/hooks/useWrongAnswers";

interface BlankRecallProps {
  specId: number;
  specTitle: string;
  onBlankRecallComplete?: (
    recall: BlankRecallInput
  ) => void | Promise<void>;
  /** Forwarded to the inline follow-up Knowledge Driller so its completion
   * logs a session row like any other driller run. */
  onSessionComplete?: (session: DrillerSessionInput) => void | Promise<void>;
  /** Forwarded to the inline follow-up Knowledge Driller so its per-question
   * assessments feed the wrong-answers queue. */
  onAssessment?: (input: AssessmentInput) => void | Promise<void>;
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

export function BlankRecall({
  specId,
  specTitle,
  onBlankRecallComplete,
  onSessionComplete,
  onAssessment,
}: BlankRecallProps) {
  const recall = useRecallForSpec(specId);
  const { user } = useAuth();
  const isAnon = !user; // AI marking requires sign-in
  const factQuestions = useFactDrillerForSpec(specId);
  const storageKey = `blank-recall-${specId}`;

  // Follow-up driller state. When `followUpQuestions` is set the rest of the
  // Blank Recall UI is replaced by an inline Knowledge Driller running
  // through exactly those questions.
  const [followUpQuestions, setFollowUpQuestions] = useState<FactDrillerQuestion[] | null>(null);

  const [userText, setUserText] = useState(() => {
    try { return localStorage.getItem(storageKey) ?? ""; } catch { return ""; }
  });
  const [revealed, setRevealed] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [analysis, setAnalysis] = useState<{ mentioned: AnalysedConcept[]; missed: string[] } | null>(null);
  // Zhukovsky's overall verdict for AI marking (level + feedback + flagged errors).
  const [zhukResult, setZhukResult] = useState<ZhukovskyResult | null>(null);
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
    setZhukResult(null);
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

  /**
   * Persist a full blank-recall submission. The `mentioned` / `missed`
   * lists come from either the AI edge function or the local keyword
   * matcher — they are merged back into a single ordered list matching
   * the spec's key_concepts[] so teachers can see exactly what was
   * covered and what was missed.
   */
  const handleRecallResult = (
    mentioned: AnalysedConcept[],
    missed: string[]
  ) => {
    const total = mentioned.length + missed.length;
    if (total === 0) return;

    const mentionedSet = new Set(mentioned.map((m) => m.text));
    const concept_results = (recall?.key_concepts ?? []).map((kc) => ({
      concept: kc.concept,
      covered: mentionedSet.has(kc.concept),
    }));

    if (onBlankRecallComplete) {
      void onBlankRecallComplete({
        spec_id: specId,
        written_text: userText,
        concepts_total: total,
        concepts_covered: mentioned.length,
        concept_results,
        ai_feedback: null,
      });
    }

    const pct = Math.round((mentioned.length / total) * 100);
    if (pct >= 90) {
      fireConfetti();
      toast.success(`🌟 Topic Mastered! You scored ${pct}%`, { duration: 5000 });
    }
  };

  const handleReveal = async () => {
    if (!recall?.key_concepts) return;
    trackEvent("analyse_recall", { mode: useAI ? "ai" : "local", spec_id: specId });

    if (useAI) {
      setIsAnalysing(true);
      try {
        const zhuk = await markWithZhukovsky({
          activity: "recall",
          specId,
          studentAnswer: userText,
          keyConcepts: recall.key_concepts.map((kc) => kc.concept),
        });
        // Zhukovsky reconciles coverage server-side and returns every canonical
        // key concept (in Tom's wording) with a covered flag. Split into the
        // existing mentioned/missed checklist. Fall back to local keyword
        // matching only if coverage came back empty.
        const coverage = zhuk.concepts ?? [];
        let result: { mentioned: AnalysedConcept[]; missed: string[] };
        if (coverage.length > 0) {
          result = {
            mentioned: coverage.filter((c) => c.covered).map((c) => ({ text: c.concept, matchedKeywords: [] })),
            missed: coverage.filter((c) => !c.covered).map((c) => c.concept),
          };
        } else {
          result = analyseKeyConceptsLocal(userText, recall.key_concepts);
        }
        setAnalysis(result);
        setZhukResult(zhuk);
        setRevealed(true);
        handleRecallResult(result.mentioned, result.missed);
      } catch (err) {
        // Graceful degradation: an AI-marking outage must never dead-end the
        // student. Fall back to the local keyword matcher (the same check anon
        // users get) AND switch the view to Local mode, so the full Mentioned/
        // Missed breakdown and the "keyword detection" disclaimer actually render
        // (they're gated on !useAI). Surface the server's real reason — a daily-cap
        // message resets at midnight, not "in a moment", so don't hard-code that.
        console.error("AI analysis error:", err);
        const result = analyseKeyConceptsLocal(userText, recall.key_concepts);
        setUseAI(false);
        setZhukResult(null);
        setAnalysis(result);
        setRevealed(true);
        handleRecallResult(result.mentioned, result.missed);
        const reason = err instanceof Error && err.message
          ? err.message
          : "Zhukovsky's AI marking is unavailable right now.";
        toast.info(`${reason} Showing a keyword check instead.`, { duration: 7000 });
      } finally {
        setIsAnalysing(false);
      }
    } else {
      const result = analyseKeyConceptsLocal(userText, recall.key_concepts);
      setAnalysis(result);
      setRevealed(true);
      handleRecallResult(result.mentioned, result.missed);
    }
  };

  const handleReset = () => {
    setUserText("");
    setRevealed(false);
    setAnalysis(null);
    setZhukResult(null);
  };

  const handleClearAndNew = () => {
    setUserText("");
    setRevealed(false);
    setAnalysis(null);
    setZhukResult(null);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  // Build the follow-up question set from the current missed concepts.
  const launchFollowUp = () => {
    if (!recall || !analysis || analysis.missed.length === 0) return;
    const { questions, matchedCount, toppedUpCount } = buildFollowUpFactQuestions({
      missedConcepts: analysis.missed,
      allConcepts: recall.key_concepts,
      factQuestions,
      maxCount: 10,
    });
    if (questions.length === 0) {
      toast.info("No rapid-fire questions available to drill right now.");
      return;
    }
    trackEvent("blank_recall_followup_launch", {
      spec_id: specId,
      missed_concepts: analysis.missed.length,
      matched: matchedCount,
      topped_up: toppedUpCount,
      total: questions.length,
    });
    setFollowUpQuestions(questions);
  };

  if (!recall) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No recall data available for this specification point.
      </div>
    );
  }

  // Follow-up driller takes over the entire tab until the student exits.
  if (followUpQuestions) {
    return (
      <SpecificKnowledge
        specId={specId}
        specTitle={specTitle}
        questionsOverride={followUpQuestions}
        headerLabel="Follow-up from Blank Recall"
        onSessionComplete={onSessionComplete}
        onAssessment={onAssessment}
        onExit={() => setFollowUpQuestions(null)}
      />
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

        {/* Local ⟷ Zhukovsky toggle */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <Cpu className={`h-4 w-4 ${useAI ? "text-muted-foreground" : "text-primary"}`} />
          <Label htmlFor="ai-toggle" className="cursor-pointer text-xs font-medium text-muted-foreground">
            Local
          </Label>
          <Switch
            id="ai-toggle"
            checked={useAI}
            onCheckedChange={setUseAI}
            disabled={revealed || isAnalysing}
          />
          <Label htmlFor="ai-toggle" className={`cursor-pointer text-xs font-medium ${useAI ? "text-primary" : "text-muted-foreground"}`}>
            Zhukovsky
          </Label>
          <GraduationCap className={`h-4 w-4 ${useAI ? "text-primary" : "text-muted-foreground"}`} />
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
          useAI && isAnon ? (
            <div className="flex flex-col items-start gap-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <span className="text-sm text-foreground">Sign in (free) to mark your recall with Zhukovsky — or switch to Local to check it without signing in.</span>
              <Link to="/login" className="text-sm font-medium text-primary hover:underline">Sign in →</Link>
            </div>
          ) : (
          <Button
            onClick={handleReveal}
            disabled={!userText.trim() || isListening || isAnalysing}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isAnalysing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {useAI ? "Marking with Zhukovsky…" : "Analysing…"}
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                {useAI ? "Mark with Zhukovsky" : "Analyse"}
              </>
            )}
          </Button>
          )
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
            {useAI ? "Marked by Zhukovsky" : "Using local keyword matching"}
          </span>
        )}
      </div>

      {/* Processing feedback banner */}
      {isAnalysing && useAI && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">Scribe is cross-referencing your transcript with the AQA 1H spec…</p>
              <p className="text-xs text-muted-foreground">
                Streaming response — this won't time out.
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
              {!useAI && analysis.missed.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  — {analysis.missed.length} concept{analysis.missed.length !== 1 ? "s" : ""} missed below.
                </span>
              )}
            </CardContent>
          </Card>

          {/* Zhukovsky's verdict — level + feedback + flagged errors (AI mode only) */}
          {zhukResult && (
            <Card className="border-primary/30">
              <CardContent className="space-y-3 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zhukovsky</span>
                  <span className="ml-auto rounded-full border border-primary/40 px-2.5 py-0.5 text-xs font-bold text-primary">
                    {zhukResult.level} · {ZHUKOVSKY_BANDS[zhukResult.level] ?? "Marked"}
                  </span>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{zhukResult.feedback}</p>
                {zhukResult.errors.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" /> Worth checking
                    </h4>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
                      {zhukResult.errors.map((e, i) => (
                        <li key={i}>{e.correction}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button
                  onClick={() => {
                    const prefill = buildPotemkinHandoff(recall?.title ?? "this topic", zhukResult.feedback);
                    window.dispatchEvent(new CustomEvent("potemkin:open", { detail: { prefill } }));
                  }}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Discuss with Potemkin
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Key Material Mentioned — LOCAL mode only; in Zhukovsky mode the prose
              feedback replaces the checklist (Tom: "Zhukovsky all the way"). */}
          {!useAI && analysis.mentioned.length > 0 && (
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
                  Note: This is based on keyword detection. Please verify your own explanations to ensure accuracy.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Key Material Missed — LOCAL mode shows the full checklist; the targeted
              follow-up drill shows in both modes (it reads the missed concepts). */}
          {analysis.missed.length > 0 ? (
            <>
              {!useAI && (
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
              )}

              {/* Phase 3: targeted follow-up driller */}
              {factQuestions.length > 0 && (
                <Card className="border-accent/40 bg-accent/5">
                  <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="font-serif text-base font-semibold text-primary">
                        🎯 Want to fix the gaps?
                      </h3>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        I'll pull up to 10 rapid-fire questions from the Knowledge
                        Driller that target exactly the concepts you missed.
                      </p>
                    </div>
                    <Button
                      onClick={launchFollowUp}
                      className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Drill these now →
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            !useAI && (
            <Card className="border-success/30">
              <CardContent className="flex items-center gap-3 p-6">
                <CheckCircle2 className="h-6 w-6 text-success" />
                <p className="font-serif text-base font-medium text-foreground">
                  Excellent — you covered all the key concepts!
                </p>
              </CardContent>
            </Card>
            )
          )}
        </div>
      )}

    </div>
  );
}
