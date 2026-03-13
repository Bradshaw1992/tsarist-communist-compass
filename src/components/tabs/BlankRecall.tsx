import { useState, useMemo } from "react";
import { useRecallForSpec } from "@/hooks/useRevisionData";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PenLine, Eye, RotateCcw } from "lucide-react";

interface BlankRecallProps {
  specId: number;
  specTitle: string;
}

export function BlankRecall({ specId, specTitle }: BlankRecallProps) {
  const recall = useRecallForSpec(specId);
  const [userText, setUserText] = useState("");
  const [revealed, setRevealed] = useState(false);

  const keywords = useMemo(() => {
    if (!recall) return [];
    const text = recall.summary.full_text;
    // Extract significant words (4+ chars, unique)
    const words = text.match(/\b[A-Za-z'']{4,}\b/g) || [];
    const unique = [...new Set(words.map((w) => w.toLowerCase()))];
    // Filter common words
    const common = new Set(["that", "this", "with", "from", "were", "have", "been", "they", "their", "which", "also", "more", "than", "into", "would", "could", "about", "over", "such", "very", "some", "most", "other", "after", "before", "under", "between", "through", "during", "without", "however", "because", "these", "those"]);
    return unique.filter((w) => !common.has(w));
  }, [recall]);

  const missingKeywords = useMemo(() => {
    if (!revealed) return [];
    const userLower = userText.toLowerCase();
    return keywords.filter((kw) => !userLower.includes(kw));
  }, [revealed, userText, keywords]);

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
            placeholder="Start writing your recall here..."
            className="min-h-[200px] resize-y border-border bg-background font-sans text-sm leading-relaxed"
            disabled={revealed}
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {!revealed ? (
          <Button onClick={handleReveal} disabled={!userText.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90">
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
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg text-primary">Your Response</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                {userText}
              </p>
            </CardContent>
          </Card>

          <Card className="border-accent/30">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-lg text-primary">Model Summary</CardTitle>
              {missingKeywords.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {missingKeywords.length} key terms missing from your response
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {recall.summary.sections.map((section, i) => (
                <div key={i}>
                  {section.heading && (
                    <h4 className="mb-2 font-serif text-sm font-semibold text-primary">
                      {section.heading}
                    </h4>
                  )}
                  <ul className="space-y-2">
                    {section.content.map((para, j) => (
                      <li key={j} className="text-sm leading-relaxed text-foreground/80">
                        <HighlightedText text={para} missing={missingKeywords} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function HighlightedText({ text, missing }: { text: string; missing: string[] }) {
  if (missing.length === 0) return <>{text}</>;

  const missingSet = new Set(missing);
  const parts = text.split(/(\b\w+\b)/g);

  return (
    <>
      {parts.map((part, i) =>
        missingSet.has(part.toLowerCase()) ? (
          <mark key={i} className="rounded-sm bg-highlight px-0.5 font-medium">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
