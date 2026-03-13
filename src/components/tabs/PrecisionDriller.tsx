import { useState, useMemo, useCallback } from "react";
import { useQuizQuestionsForSpec } from "@/hooks/useRevisionData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Brain, HelpCircle, ArrowRight, RotateCcw, BookMarked } from "lucide-react";

interface PrecisionDrillerProps {
  specId: number;
}

type AnswerLevel = "exact" | "concept" | "help" | null;

export function PrecisionDriller({ specId }: PrecisionDrillerProps) {
  const questions = useQuizQuestionsForSpec(specId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerLevel, setAnswerLevel] = useState<AnswerLevel>(null);
  const [stats, setStats] = useState({ exact: 0, concept: 0, help: 0 });

  const question = useMemo(() => questions[currentIndex], [questions, currentIndex]);

  const handleAnswer = useCallback(
    (level: AnswerLevel) => {
      setAnswerLevel(level);
      if (level) {
        setStats((prev) => ({ ...prev, [level]: prev[level] + 1 }));
      }
    },
    []
  );

  const handleNext = useCallback(() => {
    setAnswerLevel(null);
    setCurrentIndex((prev) => (prev + 1) % questions.length);
  }, [questions.length]);

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
    setAnswerLevel(null);
    setStats({ exact: 0, concept: 0, help: 0 });
  }, []);

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No quiz questions available for this specification point.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-bold text-primary">Precision Driller</h2>
          <p className="text-sm text-muted-foreground">
            Interactive flashcards — test your knowledge question by question.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> {stats.exact}
          </span>
          <span className="flex items-center gap-1 text-accent">
            <Brain className="h-3.5 w-3.5" /> {stats.concept}
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <HelpCircle className="h-3.5 w-3.5" /> {stats.help}
          </span>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Question {currentIndex + 1} of {questions.length}
      </div>

      {/* Flashcard */}
      <Card className="mx-auto max-w-2xl border-2 shadow-lg">
        <CardContent className="p-6 sm:p-8">
          {/* Front */}
          <div className="space-y-4">
            <Badge variant="secondary" className="font-sans text-xs capitalize">
              {question.question_type.replace("_", " ")}
            </Badge>
            <p className="font-serif text-lg font-medium leading-relaxed text-foreground">
              {question.question_text}
            </p>
          </div>

          {/* Answer buttons */}
          {!answerLevel && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={() => handleAnswer("exact")}
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Exact Term?
              </Button>
              <Button
                onClick={() => handleAnswer("concept")}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Brain className="mr-1.5 h-4 w-4" />
                Got the Concept?
              </Button>
              <Button
                onClick={() => handleAnswer("help")}
                variant="destructive"
              >
                <HelpCircle className="mr-1.5 h-4 w-4" />
                Need Help?
              </Button>
            </div>
          )}

          {/* Back / Feedback */}
          {answerLevel && (
            <div className="mt-6 animate-flip-in space-y-4 rounded-lg border border-border bg-muted/50 p-5">
              <div>
                <h4 className="mb-1 font-serif text-sm font-semibold text-primary">
                  Model Answer
                </h4>
                <p className="text-sm leading-relaxed text-foreground/80">
                  {question.correct_answer}
                </p>
              </div>

              {answerLevel !== "exact" && (
                <div>
                  <h4 className="mb-1 font-serif text-sm font-semibold text-primary">
                    Also Acceptable
                  </h4>
                  <p className="text-sm leading-relaxed text-foreground/70 italic">
                    {question.good_answer_synonym}
                  </p>
                </div>
              )}

              {question.ko_terms_used.length > 0 && (
                <div>
                  <h4 className="mb-1 font-serif text-sm font-semibold text-primary">
                    Key Terms
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {question.ko_terms_used.map((term) => (
                      <Badge key={term} variant="outline" className="text-xs">
                        {term}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {answerLevel === "help" && (
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                    <BookMarked className="mr-1 h-3 w-3" />
                    {question.level_3_feedback.workpack_ref}
                  </Badge>
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                    <BookMarked className="mr-1 h-3 w-3" />
                    {question.level_3_feedback.textbook_ref}
                  </Badge>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button onClick={handleNext} className="bg-primary text-primary-foreground">
                  <ArrowRight className="mr-1.5 h-4 w-4" />
                  Next Question
                </Button>
                <Button onClick={handleReset} variant="outline" size="sm">
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Restart
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
