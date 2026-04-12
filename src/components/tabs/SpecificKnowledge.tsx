import { useState, useCallback, useEffect, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useFactDrillerForSpec, useTopicNameForSpec } from "@/hooks/useRevisionData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, RotateCcw, Zap, Eye, Trophy, Star,
  BookOpen, ChevronLeft, ChevronRight,
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { ReportIssueDialog, ReportFlagButton } from "@/components/ReportIssueDialog";
import type { FactDrillerQuestion } from "@/types/revision";
import type { DrillerSessionInput } from "@/hooks/useHighScores";
import type { AssessmentInput } from "@/hooks/useWrongAnswers";
import type { PerQuestionEntry } from "@/types/supabase-helpers";

interface SpecificKnowledgeProps {
  specId: number;
  specTitle?: string;
  onSessionComplete?: (session: DrillerSessionInput) => void | Promise<void>;
  onAssessment?: (input: AssessmentInput) => void | Promise<void>;
  /**
   * When provided, the driller ignores its own Supabase-backed question pool
   * and runs through exactly this list instead. Used by the Blank Recall
   * follow-up flow to target concepts the student missed.
   */
  questionsOverride?: FactDrillerQuestion[];
  /** Optional label shown under the page title (e.g. "Follow-up from Blank Recall"). */
  headerLabel?: string;
  /** Called when the student clicks "Done" from the completion screen. Used by
   * the follow-up flow to close the inline driller and return to Blank Recall. */
  onExit?: () => void;
}

const DEFAULT_SESSION_SIZE = 20;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Assessment = "correct" | "missed";

interface HistoryEntry {
  revealed: boolean;
  assessment?: Assessment;
}

export function SpecificKnowledge({
  specId,
  specTitle,
  onSessionComplete,
  onAssessment,
  questionsOverride,
  headerLabel,
  onExit,
}: SpecificKnowledgeProps) {
  const hookQuestions = useFactDrillerForSpec(specId);
  const allQuestions = questionsOverride ?? hookQuestions;
  const isOverride = !!questionsOverride;
  const topicName = useTopicNameForSpec(specId);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");

  const [sessionSeed, setSessionSeed] = useState(0);
  const [retryMode, setRetryMode] = useState(false);
  const [retryQuestions, setRetryQuestions] = useState<FactDrillerQuestion[]>([]);
  const [firstTryPerfect, setFirstTryPerfect] = useState(true);
  const [sessionSize, setSessionSize] = useState(DEFAULT_SESSION_SIZE);

  const initialQuestions = useMemo(
    () => {
      // Override mode: use the pre-built list as-is. The Blank Recall
      // follow-up already decided what should go in here.
      if (isOverride) return allQuestions;
      return shuffle(allQuestions).slice(0, Math.min(sessionSize, allQuestions.length));
    },
    // Include allQuestions so the session reshuffles once Supabase data
    // lands (the array reference changes when the query resolves).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [specId, sessionSeed, allQuestions, sessionSize, isOverride]
  );

  const questions = retryMode ? retryQuestions : initialQuestions;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ correct: 0, missed: 0 });
  const [history, setHistory] = useState<Record<number, HistoryEntry>>({});
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [sessionComplete, setSessionComplete] = useState(false);

  const question = questions[currentIndex];
  const currentUserAnswer = userAnswers[currentIndex] ?? "";
  const totalAnswered = stats.correct + stats.missed;
  const allAnswered = totalAnswered === questions.length;

  useEffect(() => {
    if (allAnswered && questions.length > 0) {
      setSessionComplete(true);
      // Only log the first run through — retry sessions should not overwrite
      // the original percentage for aggregate high-score purposes.
      if (!retryMode && onSessionComplete) {
        const perQuestion: PerQuestionEntry[] = questions.map((q, i) => {
          const entry = history[i];
          return {
            question_id: q.id,
            question_text: q.question,
            user_input: userAnswers[i] ?? undefined,
            result: entry?.assessment === "correct" ? "correct" : "missed",
          };
        });
        void onSessionComplete({
          activity_type: "knowledge_driller",
          spec_id: specId,
          total_questions: questions.length,
          correct_count: stats.correct,
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
    stats.correct,
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

  const handleSelfAssess = useCallback((gotIt: boolean) => {
    trackEvent("driller_assess", { result: gotIt ? "got_it" : "missed_it", spec_id: specId, driller: "sniper_facts" });
    if (!gotIt) setFirstTryPerfect(false);
    setHistory((prev) => ({
      ...prev,
      [currentIndex]: { revealed: true, assessment: gotIt ? "correct" : "missed" },
    }));
    setStats((prev) => ({
      correct: prev.correct + (gotIt ? 1 : 0),
      missed: prev.missed + (gotIt ? 0 : 1),
    }));

    // Push the assessment into the Wrong Answers queue. Retry runs also
    // feed in — a resolve during retry rewards the student by clearing
    // their previous miss.
    const q = questions[currentIndex];
    if (q && onAssessment) {
      void onAssessment({
        question_table: "fact_questions",
        question_id: q.id,
        spec_id: specId,
        question_text: q.question,
        answer: q.answer,
        spec_title: specTitle,
        correct: gotIt,
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
    setStats({ correct: 0, missed: 0 });
    setHistory({});
    setUserAnswers({});
    setSessionComplete(false);
    setRetryMode(false);
    setRetryQuestions([]);
    setFirstTryPerfect(true);
    setSessionSeed((s) => s + 1);
  }, []);

  const handleRetryMissed = useCallback(() => {
    const missed: FactDrillerQuestion[] = [];
    Object.entries(history).forEach(([idx, entry]) => {
      if (entry.assessment === "missed") {
        missed.push(questions[Number(idx)]);
      }
    });
    setRetryQuestions(shuffle(missed));
    setRetryMode(true);
    setCurrentIndex(0);
    setRevealed(false);
    setStats({ correct: 0, missed: 0 });
    setHistory({});
    setUserAnswers({});
    setSessionComplete(false);
    setFirstTryPerfect(false);
  }, [history, questions]);

  if (questions.length === 0 && !sessionComplete) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No rapid-fire questions available for this specification point.
      </div>
    );
  }

  const prevEntry = history[currentIndex];
  const alreadyAssessed = !!prevEntry?.assessment;
  const isMastered = sessionComplete && stats.missed === 0;
  const hasMissed = sessionComplete && stats.missed > 0;

  // --- SESSION COMPLETE ---
  if (sessionComplete) {
    return (
      <div className="space-y-6">
        <Header
          questionsCount={questions.length}
          allCount={allQuestions.length}
          stats={stats}
          retryMode={retryMode}
          label={headerLabel}
        />
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
                  {stats.correct}/{questions.length} Correct
                </h3>
                <p className="text-sm text-muted-foreground">
                  You missed {stats.missed} question{stats.missed > 1 ? "s" : ""}. Retry them to reach mastery.
                </p>
              </>
            )}
            <div className="flex flex-wrap justify-center gap-3 pt-2">
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
              {onExit && (
                <Button onClick={onExit} variant="outline">
                  Back to Blank Recall
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- QUIZ PHASE ---
  if (!question) return null;

  // Show the session-length chooser only before the student has locked in by
  // revealing or assessing anything on Q1, and never during retry runs or when
  // the question set is pre-built by a follow-up flow.
  const showChooser =
    !retryMode && !isOverride && currentIndex === 0 && !revealed && !prevEntry?.assessment && allQuestions.length > 0;

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
          <div className="mb-6">
            <Zap className="mb-2 inline h-4 w-4 text-accent" />
            <div className="flex items-start gap-2">
              <p className="font-serif text-lg font-medium leading-relaxed text-foreground flex-1">
                {question.question}
              </p>
              <ReportFlagButton onClick={() => { setReportText(question.question); setReportOpen(true); }} />
            </div>
          </div>

          {/* Answer input before reveal */}
          {!alreadyAssessed && !revealed && (
            <div className="mb-4">
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
            <div className="space-y-4">
              {currentUserAnswer.trim() && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Answer</h4>
                  <p className="text-sm leading-relaxed text-foreground/80">{currentUserAnswer}</p>
                </div>
              )}
              <div className="rounded-lg border border-border bg-muted/50 p-5">
                <h4 className="mb-1 font-serif text-sm font-semibold text-primary">Model Answer</h4>
                <p className="text-sm leading-relaxed text-foreground/80">{question.answer}</p>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                {prevEntry.assessment === "correct" ? (
                  <span className="flex items-center gap-1.5 text-primary"><CheckCircle2 className="h-4 w-4" /> You got this</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-destructive"><XCircle className="h-4 w-4" /> You missed this</span>
                )}
              </div>
            </div>
          )}

          {/* Reveal button */}
          {!alreadyAssessed && !revealed && (
            <div>
              <Button onClick={handleReveal} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Eye className="mr-1.5 h-4 w-4" />
                Reveal Answer
              </Button>
            </div>
          )}

          {/* Revealed, awaiting self-assessment */}
          {!alreadyAssessed && revealed && (
            <div className="animate-flip-in space-y-4">
              {currentUserAnswer.trim() && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Answer</h4>
                  <p className="text-sm leading-relaxed text-foreground/80">{currentUserAnswer}</p>
                </div>
              )}
              <div className="rounded-lg border-2 border-primary/30 bg-muted/50 p-5">
                <h4 className="mb-2 font-serif text-sm font-semibold uppercase tracking-wider text-primary">Official Answer</h4>
                <p className="font-serif text-base leading-relaxed text-foreground">{question.answer}</p>
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
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restart
            </Button>
          </div>
        </CardContent>
      </Card>

      <ReportIssueDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        section="Knowledge"
        topicName={topicName}
        originalText={reportText}
        questionId={question?.id}
        questionTable="fact_questions"
        specId={specId}
      />
    </div>
  );
}

/* ---- Sub-components ---- */

function Header({ questionsCount, allCount, stats, retryMode, label }: {
  questionsCount: number;
  allCount: number;
  stats: { correct: number; missed: number };
  retryMode: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-bold text-primary">Knowledge Driller</h2>
        {label ? (
          <p className="text-sm font-medium text-accent">{label}</p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {retryMode ? `Retrying ${questionsCount} missed` : `${questionsCount} of ${allCount} questions`} · shuffled each session
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" /> {stats.correct}
        </span>
        <span className="flex items-center gap-1 text-destructive">
          <XCircle className="h-3.5 w-3.5" /> {stats.missed}
        </span>
      </div>
    </div>
  );
}

export function SessionLengthChooser({ value, onChange, maxCount }: {
  value: number;
  onChange: (n: number) => void;
  maxCount: number;
}) {
  // Offer 10 / 20 / 30 as presets where the pool is large enough, then always
  // an "All" option at the tail. "All" collapses into 30 (etc.) automatically
  // if the pool is exactly that size.
  const options = useMemo(() => {
    const presets = [10, 20, 30].filter((n) => n < maxCount);
    const all = maxCount;
    const final = [...presets, all];
    return final.map((n) => ({
      value: n,
      label: n === all ? `All (${n})` : String(n),
    }));
  }, [maxCount]);

  // Clamp the active value to the largest available option so a stale 20 on a
  // small pool still shows a reasonable selection.
  const effective = Math.min(value, maxCount);

  if (options.length <= 1) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-3 text-center sm:flex-row sm:justify-center sm:gap-4">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Session length
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {options.map((opt) => {
          const active = opt.value === effective;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={
                active
                  ? "rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm"
                  : "rounded-md border border-border bg-background px-3 py-1 text-xs font-medium text-foreground/70 hover:border-primary/40 hover:text-foreground"
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
