import { useState, useMemo, useCallback, useRef } from "react";
import { useRecallForSpec } from "@/hooks/useRevisionData";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PenLine, Eye, RotateCcw, AlertTriangle, CheckCircle2, Mic, MicOff } from "lucide-react";

interface BlankRecallProps {
  specId: number;
  specTitle: string;
}

/**
 * Generous conceptual matching: extracts substantive multi-word concepts from a bullet,
 * then checks if the *idea* appears in the user's text — not just specific terminology.
 * A bullet is only "missed" if the core historical idea is entirely absent.
 */
function isCovered(userText: string, bullet: string): boolean {
  const userLower = userText.toLowerCase();
  const bulletLower = bullet.toLowerCase();

  // Extract meaningful noun-phrases / named entities (2+ word sequences, proper nouns, dates)
  const namedEntities = bulletLower.match(
    /(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+|(?:18|19|20)\d{2})/gi
  ) || [];

  // Extract conceptual phrases (longer sequences of substantive words)
  const common = new Set([
    "the", "and", "was", "were", "that", "this", "with", "from", "have", "been",
    "they", "their", "which", "also", "more", "than", "into", "would", "could",
    "about", "over", "such", "very", "some", "most", "other", "after", "before",
    "under", "between", "through", "during", "without", "however", "because",
    "these", "those", "had", "for", "not", "but", "are", "its", "his", "her",
    "who", "all", "can", "has", "did", "does", "will", "may", "each", "both",
    "any", "how", "many", "much", "own", "our", "you", "one", "two", "new",
    "there", "where", "when", "what", "then", "led", "made", "gave", "took",
    "used", "became", "meant", "left", "set", "put", "saw", "got", "came",
    "went", "being", "often", "well", "rather", "while", "upon", "still",
  ]);

  const words = bulletLower.match(/\b[a-z'']{3,}\b/g) || [];
  const keyTerms = words.filter(w => !common.has(w) && w.length >= 4);

  // If the bullet is too short or generic, consider it covered
  if (keyTerms.length < 3 && namedEntities.length === 0) return true;

  // Strategy 1: Check if any named entity appears
  const entityHit = namedEntities.some(entity =>
    userLower.includes(entity.toLowerCase())
  );

  // Strategy 2: Check conceptual coverage — require only 25% of key terms
  // (very generous: student described the idea, not the exact words)
  const matched = keyTerms.filter(t => userLower.includes(t));
  const termCoverage = keyTerms.length > 0 ? matched.length / keyTerms.length : 1;

  // Strategy 3: Check for thematic overlap using bigrams from the bullet
  const bulletBigrams: string[] = [];
  for (let i = 0; i < keyTerms.length - 1; i++) {
    bulletBigrams.push(`${keyTerms[i]} ${keyTerms[i + 1]}`);
  }
  // Even partial bigram presence suggests the concept is discussed
  const bigramHit = bulletBigrams.some(bg => {
    const parts = bg.split(" ");
    return parts.every(p => userLower.includes(p));
  });

  // Covered if ANY of: named entity found, 25%+ key terms, or bigram match
  return entityHit || termCoverage >= 0.25 || bigramHit;
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
    // Save current text so transcription appends after it
    prefixRef.current = userText ? userText.trimEnd() + " " : "";
    toggle();
  };

  const missedPoints = useMemo(() => {
    if (!revealed || !recall) return [];
    const missed: { heading: string; points: string[] }[] = [];

    for (const section of recall.summary.sections) {
      const uncovered = section.content.filter(
        bullet => !isCovered(userText, bullet)
      );
      if (uncovered.length > 0) {
        missed.push({
          heading: section.heading || "Key Points",
          points: uncovered,
        });
      }
    }
    return missed;
  }, [revealed, userText, recall]);

  const totalPoints = recall?.summary.sections.reduce((s, sec) => s + sec.content.length, 0) ?? 0;
  const totalMissed = missedPoints.reduce((s, g) => s + g.points.length, 0);
  const totalCovered = totalPoints - totalMissed;

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
            Reveal Gaps
          </Button>
        ) : (
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        )}
      </div>

      {revealed && (
        <div className="space-y-6">
          {/* Score summary */}
          <Card className="border-accent/30">
            <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              <span className="text-sm font-medium text-foreground">
                You covered <strong>{totalCovered}</strong> of <strong>{totalPoints}</strong> key points.
              </span>
              {totalMissed > 0 && (
                <span className="text-sm text-muted-foreground">
                  — {totalMissed} concept{totalMissed !== 1 ? "s" : ""} missed below.
                </span>
              )}
            </CardContent>
          </Card>

          {/* Material Missed */}
          {totalMissed > 0 ? (
            <Card className="border-destructive/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-serif text-lg text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Material Missed
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  These concepts were entirely absent from your response.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {missedPoints.map((group, i) => (
                  <div key={i}>
                    <h4 className="mb-2 font-serif text-sm font-semibold text-primary">
                      {group.heading}
                    </h4>
                    <ul className="space-y-2 pl-1">
                      {group.points.map((point, j) => (
                        <li key={j} className="flex gap-2 text-sm leading-relaxed text-foreground/80">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive/60" />
                          <span className="break-words">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-green-500/30">
              <CardContent className="flex items-center gap-3 p-6">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <p className="font-serif text-base font-medium text-foreground">
                  Excellent — you covered all the key material!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
