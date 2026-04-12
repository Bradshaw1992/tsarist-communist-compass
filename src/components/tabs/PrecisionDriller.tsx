import { useState, useMemo, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useQuizQuestionsForSpec, useTopicNameForSpec } from "@/hooks/useRevisionData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye, CheckCircle2, XCircle, RotateCcw, BookOpen,
  ChevronLeft, ChevronRight, Trophy, Star,
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { ReportIssueDialog, ReportFlagButton } from "@/components/ReportIssueDialog";
import type { QuizQuestion } from "@/types/revision";
import type { DrillerSessionInput } from "@/hooks/useHighScores";
import type { AssessmentInput } from "@/hooks/useWrongAnswers";
import type { PerQuestionEntry } from "@/integrations/supabase/types";
import { SessionLengthChooser } from "@/components/tabs/SpecificKnowledge";

interface PrecisionDrillerProps {
  specId: number;
  specTitle?: string;
  onSessionComplete?: (session: DrillerSessionInput) => void | Promise<void>;
  onAssessment?: (input: AssessmentInput) => void | Promise<void>;
}

type Assessment = "knew" | "missed";

interface HistoryEntry {
  revealed: boolean;
  assessment?: Assessment;
}

const DEFAULT_SESSION_SIZE = 10;

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PrecisionDriller({
  specId,
  specTitle,
  onSessionComplete,
  onAssessment,
}: PrecisionDrillerProps) {
  const allQuestions = useQuizQuestionsForSpec(specId);
  const topicName = useTopicNameForSpec(specId);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");

  const [sessionSeed, setSessionSeed] = useState(0);
  const [retryMode, setRetryMode] = useState(false);
  const [retryQuestions, setRetryQuestions] = useState<QuizQuestion[]>([]);
  const [firstTryPerfect, setFirstTryPerfect] = useState(true);
  const [sessionSize, setSessionSize] = useState(DEFAULT_SESSION_SIZE);

  // Shuffle and pick up to sessionSize questions; re-shuffles when sessionSeed
  // changes, when allQuestions resolves from Supabase, or when the length chooser
  // toggles.
  const initialQuestions = useMemo(
    () => shuffleArray(allQuestions).slice(0, Math.min(sessionSize, allQuestions.length)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [specId, sessionSeed, allQuestions, sessionSize]
  );

  const questions = retryMode ? retryQuestions : initialQuestions;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ knew: 0, missed: 0 });
  const [history, setHistory] = useState<Record<number, HistoryEntry>>({});
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [sessionComplete, setSessionComplete] = useState(false);

  const question = questions[currentIndex];
  const currentUserAnswer = userAnswers[currentIndex] ?? "";

  const totalAnswered = stats.knew + stats.missed;
  const allAnswered = totalAnswered === questions.length;

  // Check session completion
  useEffect(() => {
    if (allAnswered && questions.length > 0) {
      setSessionComplete(true);
      // Skip retry runs — only the first pass should update aggregates.
      if (!retryMode && onSessionComplete) {
        const perQuestion: PerQuestionEntry[] = questions.map((q, i) => {
          const entry = history[i];
          return {
            question_id: q.id,
            question_text: q.question_text,
            user_input: userAnswers[i] ?? undefined,
            result: entry?.assessment === "knew" ? "correct" : "missed",
          };
        });
        void onSessionComplete({
          activity_type: "concept_driller",
          spec_id: specId,
          total_questions: questions.length,
          correct_count: stats.knew,
          per_question: perQuestion,
          metadata: { session_length: questions.length },
        });
      }
    }
  }, [
    allAnswered,
    questions,
    retryMode,
    onSessionComplete,
    specId,
    stats.knew,
    history,
    userAnswers,
  ]);

  const handleReveal = () => setRevealed(true);

  const handleAnswerChange = (value: string) => {
    setUserAnswers((prev) => ({ ...prev, [currentIndex]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleReveal();
    }
  };

  const handleSelfAssess = useCallback((knew: boolean) => {
    trackEvent("driller_assess", { result: knew ? "got_it" : "missed_it", spec_id: specId, driller: "precision" });
    if (!knew) setFirstTryPerfect(false);
    setHistory((prev) => ({
      ...prev,
      [currentIndex]: { revealed: true, assessment: knew ? "knew" : "missed" },
    }));
    setStats((prev) => ({
      knew: prev.knew + (knew ? 1 : 0),
      missed: prev.missed + (knew ? 0 : 1),
    }));

    // Feed the Wrong Answers queue. A 'knew' during retry resolves the
    // original miss.
    const q = questions[currentIndex];
    if (q && onAssessment) {
      void onAssessment({
        question_table: "concept_questions",
        question_id: q.id,
        spec_id: specId,
        question_text: q.question_text,
        answer: q.correct_answer,
        spec_title: specTitle,
        correct: knew,
      });
    }

    if (currentIndex + 1 < questions.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      const next = history[nextIdx];
      setRevealed(next?.revealed ?? false);
    }
  }, [currentIndex, questions, history, specId, specTitle, onAssessment]);

  const navigateTo = useCallback((index: number) => {
    setCurrentIndex(index);
    const entry = history[index];
    setRevealed(entry?.revealed ?? false);
  }, [history]);

  const resetSession = useCallback(() => {
    setCurrentIndex(0);
    setRevealed(false);
    setStats({ knew: 0, missed: 0 });
    setHistory({});
    setUserAnswers({});
    setSessionComplete(false);
    setRetryMode(false);
    setRetryQuestions([]);
    setFirstTryPerfect(true);
    setSessionSeed((s) => s + 1); // trigger new shuffle
  }, []);

  const handleRetryMissed = useCallback(() => {
    // Collect the missed questions from the current session
    const missed: QuizQuestion[] = [];
    Object.entries(history).forEach(([idx, entry]) => {
      if (entry.assessment === "missed") {
        missed.push(questions[Number(idx)]);
      }
    });
    setRetryQuestions(shuffleArray(missed));
    setRetryMode(true);
    setCurrentIndex(0);
    setRevealed(false);
    setStats({ knew: 0, missed: 0 });
    setHistory({});
    setUserAnswers({});
    setSessionComplete(false);
    setFirstTryPerfect(false); // already missed on first try
  }, [history, questions]);

  if (questions.length === 0 && !sessionComplete) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No quiz questions available for this specification point.
      </div>
    );
  }

  const prevEntry = history[currentIndex];
  const alreadyAssessed = !!prevEntry?.assessment;
  const isMastered = sessionComplete && stats.missed === 0;
  const hasMissed = sessionComplete && stats.missed > 0;

  // Session complete screen
  if (sessionComplete) {
    return (
      <div className="space-y-6">
        <Header questionsCount={questions.length} allCount={allQuestions.length} stats={stats} retryMode={retryMode} />
        <Card className="mx-auto max-w-2xl border-2 shadow-lg">
          <CardContent className="flex flex-col items-center gap-5 p-8 sm:p-10 text-center">
            {isMastered ? (
              <>
                <div className="rounded-full bg-primary/10 p-4">
                  <Trophy className="h-10 w-10 text-primary" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-primary">
                  Topic Mastery: {questions.length}/{questions.length}
                </h3>
                {firstTryPerfect && !retryMode && (
                  <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-sm px-3 py-1">
                    <Star className="mr-1.5 h-4 w-4 fill-amber-500 text-amber-500" />
                    Perfect Score!
                  </Badge>
                )}
                <p className="text-sm text-muted-foreground">
                  {retryMode
                    ? "You've mastered all the questions you previously missed."
                    : "Excellent recall — you nailed every question."}
                </p>
              </>
            ) : (
              <>
                <div className="rounded-full bg-muted p-4">
                  <BookOpen className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-foreground">
                  {stats.knew}/{questions.length} Correct
                </h3>
                <p className="text-sm text-muted-foreground">
                  You missed {stats.missed} question{stats.missed > 1 ? "s" : ""}. Retry them to reach mastery.
                </p>
              </>
            )}
            <div className="flex gap-3 pt-2">
              {hasMissed && (
                <Button onClick={handleRetryMissed} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Retry Missed Questions
                </Button>
              )}
              <Button onClick={resetSession} variant={hasMissed ? "outline" : "default"}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Restart
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const showChooser =
    !retryMode && currentIndex === 0 && !revealed && !prevEntry?.assessment && allQuestions.length > 0;

  return (
    <div className="space-y-6">
      <Header questionsCount={questions.length} allCount={allQuestions.length} stats={stats} retryMode={retryMode} />

      {showChooser && (
        <SessionLengthChooser
          value={sessionSize}
          onChange={setSessionSize}
          maxCount={allQuestions.length}
        />
      )}

      <div className="text-center text-xs text-muted-foreground">
        {retryMode && <span className="text-destructive font-medium mr-1">Retry ·</span>}
        Question {currentIndex + 1} of {questions.length}
      </div>

      <Card className="mx-auto max-w-2xl border-2 shadow-lg">
        <CardContent className="p-6 sm:p-8">
          <div className="space-y-4">
            <Badge variant="secondary" className="font-sans text-xs capitalize">
              {question.question_type.replace("_", " ")}
            </Badge>
            <div className="flex items-start gap-2">
              <p className="font-serif text-lg font-medium leading-relaxed text-foreground flex-1">
                {question.question_text}
              </p>
              <ReportFlagButton onClick={() => { setReportText(question.question_text); setReportOpen(true); }} />
            </div>
          </div>

          {/* Answer input before reveal */}
          {!alreadyAssessed && !revealed && (
            <div className="mt-4">
              <Textarea
                value={currentUserAnswer}
                onChange={(e) => handleAnswerChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer here (optional)..."
                className="resize-none text-sm"
                rows={3}
              />
            </div>
          )}

          {/* Already assessed */}
          {alreadyAssessed && (
            <AssessedView
              userAnswer={currentUserAnswer}
              correctAnswer={question.correct_answer}
              feedback={question.level_3_feedback}
              assessment={prevEntry.assessment!}
            />
          )}

          {/* Reveal button */}
          {!alreadyAssessed && !revealed && (
            <div className="mt-4">
              <Button onClick={handleReveal} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Eye className="mr-1.5 h-4 w-4" />
                Reveal Answer
              </Button>
            </div>
          )}

          {/* Revealed, awaiting self-assessment */}
          {!alreadyAssessed && revealed && (
            <div className="mt-6 animate-flip-in space-y-4">
              {currentUserAnswer.trim() && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Answer</h4>
                  <p className="text-sm leading-relaxed text-foreground/80">{currentUserAnswer}</p>
                </div>
              )}
              <div className="rounded-lg border-2 border-primary/30 bg-muted/50 p-5">
                <h4 className="mb-2 font-serif text-sm font-semibold uppercase tracking-wider text-primary">Official Answer</h4>
                <p className="font-serif text-base leading-relaxed text-foreground">{question.correct_answer}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-2 text-sm text-foreground/70">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <div className="space-y-0.5">
                    <p>Workpack: {question.level_3_feedback.workpack_ref}</p>
                    <p>Textbook: {question.level_3_feedback.textbook_ref}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={() => handleSelfAssess(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  I got it
                </Button>
                <Button onClick={() => handleSelfAssess(false)} variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  <XCircle className="mr-1.5 h-4 w-4" />
                  I missed it
                </Button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-2">
              <Button onClick={() => navigateTo(currentIndex - 1)} disabled={currentIndex === 0} variant="outline" size="lg" className="min-h-[44px] min-w-[44px] gap-1.5">
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <Button onClick={() => navigateTo(currentIndex + 1)} disabled={currentIndex >= questions.length - 1} variant="outline" size="lg" className="min-h-[44px] min-w-[44px] gap-1.5">
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={resetSession} variant="ghost" size="sm">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restart
            </Button>
          </div>
        </CardContent>
      </Card>

      <ReportIssueDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        section="Driller"
        topicName={topicName}
        originalText={reportText}
      />
    </div>
  );
}

/* ---- Sub-components ---- */

function Header({ questionsCount, allCount, stats, retryMode }: {
  questionsCount: number; allCount: number; stats: { knew: number; missed: number }; retryMode: boolean;
}) {
  return (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-bold text-primary">Concept Driller</h2>
        <p className="text-sm text-muted-foreground">
          {retryMode ? `Retrying ${questionsCount} missed` : `${questionsCount} of ${allCount} questions`} · shuffled each session
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" /> {stats.knew}
        </span>
        <span className="flex items-center gap-1 text-destructive">
          <XCircle className="h-3.5 w-3.5" /> {stats.missed}
        </span>
      </div>
    </div>
  );
}

function AssessedView({ userAnswer, correctAnswer, feedback, assessment }: {
  userAnswer: string; correctAnswer: string; feedback: { workpack_ref: string; textbook_ref: string }; assessment: Assessment;
}) {
  return (
    <div className="mt-6 space-y-4">
      {userAnswer.trim() && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Answer</h4>
          <p className="text-sm leading-relaxed text-foreground/80">{userAnswer}</p>
        </div>
      )}
      <div className="rounded-lg border border-border bg-muted/50 p-5">
        <h4 className="mb-1 font-serif text-sm font-semibold text-primary">Model Answer</h4>
        <p className="text-sm leading-relaxed text-foreground/80">{correctAnswer}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-2 text-sm text-foreground/70">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div className="space-y-0.5">
            <p>Workpack: {feedback.workpack_ref}</p>
            <p>Textbook: {feedback.textbook_ref}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm font-medium">
        {assessment === "knew" ? (
          <span className="flex items-center gap-1.5 text-primary"><CheckCircle2 className="h-4 w-4" /> You knew this</span>
        ) : (
          <span className="flex items-center gap-1.5 text-destructive"><XCircle className="h-4 w-4" /> You missed this</span>
        )}
      </div>
    </div>
  );
}
