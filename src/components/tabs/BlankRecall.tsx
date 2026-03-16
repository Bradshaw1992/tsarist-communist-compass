import { useState, useMemo, useCallback, useRef } from "react";
import { useRecallForSpec } from "@/hooks/useRevisionData";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PenLine, Eye, RotateCcw, AlertTriangle, CheckCircle2, Mic, MicOff } from "lucide-react";
import type { KeyConcept } from "@/types/revision";

interface BlankRecallProps {
  specId: number;
  specTitle: string;
}

interface AnalysedConcept {
  text: string;
  matchedKeywords: string[]; // trigger_keywords found in user text
}

function cleanText(text: string): string {
  // Lowercase and strip punctuation for matching
  return text.toLowerCase().replace(/[^\w\s]/g, " ");
}

function analyseKeyConcepts(userText: string, concepts: KeyConcept[]) {
  const cleaned = cleanText(userText);
  const mentioned: AnalysedConcept[] = [];
  const missed: string[] = [];

  for (const kc of concepts) {
    // Find unique keyword matches (case-insensitive, punctuation-stripped)
    const matched = kc.trigger_keywords.filter((kw) =>
      cleaned.includes(cleanText(kw))
    );
    // Threshold: require 2+ matches, unless concept has ≤2 keywords total (then 1)
    const threshold = kc.trigger_keywords.length <= 2 ? 1 : 2;
    if (matched.length >= threshold) {
      mentioned.push({ text: kc.concept, matchedKeywords: matched });
    } else {
      missed.push(kc.concept);
    }
  }

  return { mentioned, missed };
}

function highlightKeywords(text: string, matchedWords: string[]) {
  if (matchedWords.length === 0) return <>{text}</>;
  const escaped = matchedWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) => {
        const isMatch = matchedWords.some((w) => w.toLowerCase() === part.toLowerCase());
        return isMatch ? (
          <mark key={i} className="rounded-sm bg-success/20 px-0.5 text-foreground">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </>
  );
}

export function BlankRecall({ specId, specTitle }: BlankRecallProps) {
  const recall = useRecallForSpec(specId);
  const [userText, setUserText] = useState("");
  const [revealed, setRevealed] = useState(false);
  const prefixRef = useRef("");

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

  const analysis = useMemo(() => {
    if (!revealed || !recall?.key_concepts) return null;
    return analyseKeyConcepts(userText, recall.key_concepts);
  }, [revealed, userText, recall]);

  const handleReveal = () => setRevealed(true);
  const handleReset = () => {
    setUserText("");
    setRevealed(false);
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
      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-bold text-primary">Blank Recall</h2>
        <p className="text-sm text-muted-foreground">
          Active learning — write everything you know, then check your gaps.
        </p>
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
            disabled={revealed}
          />
          {isSupported && !revealed && (
            <div className="flex justify-end pt-2">
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
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {!revealed ? (
          <Button onClick={handleReveal} disabled={!userText.trim() || isListening} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Eye className="mr-2 h-4 w-4" />
            Analyse
          </Button>
        ) : (
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
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
                  Note: This is based on keyword detection. Please verify your own explanations to ensure accuracy.
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
