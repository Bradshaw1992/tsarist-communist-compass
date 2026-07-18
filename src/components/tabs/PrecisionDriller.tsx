import { useState, useMemo, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useQuizQuestionsForSpec, useTopicNameForSpec } from "@/hooks/useRevisionData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye, CheckCircle2, XCircle, RotateCcw, BookOpen,
  ChevronLeft, ChevronRight, Trophy, Star, Sparkles,
  Loader2, AlertCircle, GraduationCap,
} from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { ReportIssueDialog, ReportFlagButton } from "@/components/ReportIssueDialog";
import { markWithZhukovsky, buildPotemkinHandoff, ZHUKOVSKY_BANDS, type ZhukovskyResult } from "@/lib/zhukovsky";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import type { QuizQuestion } from "@/types/revision";
import type { DrillerSessionInput } from "@/hooks/useHighScores";
import type { AssessmentInput } from "@/hooks/useWrongAnswers";
import type { PerQuestionEntry } from "@/types/supabase-helpers";
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
  const { user } = useAuth();
  const isAnon = !user; // AI marking requires sign-in
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

  // Marking mode: self-marking (default, sound retrieval-practice mechanic) or
  // Zhukovsky (AI marking + feedback). Toggled per session.
  const [markMode, setMarkMode] = useState<"self" | "zhukovsky">("self");
  const [zhukResults, setZhukResults] = useState<Record<number, ZhukovskyResult>>({});
  const [zhukLoading, setZhukLoading] = useState(false);
  const [zhukError, setZhukError] = useState<string | null>(null);

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
    // In Zhukovsky mode, let Enter insert a newline; marking is via the button only.
    if (markMode === "zhukovsky") return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleReveal();
    }
  };

  // Record an assessment (stats, history, Wrong Answers queue). `advance` moves
  // to the next question; Zhukovsky mode records without advancing so the student
  // can read the feedback first. Shared by self-marking and AI marking.
  const recordAssessment = useCallback((knew: boolean, advance: boolean) => {
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

    if (advance && currentIndex + 1 < questions.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      const next = history[nextIdx];
      setRevealed(next?.revealed ?? false);
    }
  }, [currentIndex, questions, history, specId, specTitle, onAssessment]);

  const handleSelfAssess = useCallback((knew: boolean) => {
    trackEvent("driller_assess", { result: knew ? "got_it" : "missed_it", spec_id: specId, driller: "precision" });
    recordAssessment(knew, true);
  }, [recordAssessment, specId]);

  // AI marking: send the typed answer to Zhukovsky, show the level + feedback,
  // and record the result (levels 1-2 = "knew", 3-5 = "missed") without advancing.
  const handleZhukovskyMark = useCallback(async () => {
    const q = questions[currentIndex];
    const answer = (userAnswers[currentIndex] ?? "").trim();
    if (!q || !answer || zhukLoading) return;
    setRevealed(true);
    setZhukError(null);
    setZhukLoading(true);
    trackEvent("zhukovsky_mark", { spec_id: specId, driller: "precision" });
    try {
      const result = await markWithZhukovsky({
        activity: "concept",
        specId,
        questionText: q.question_text,
        modelAnswer: q.correct_answer,
        studentAnswer: answer,
      });
      setZhukResults((prev) => ({ ...prev, [currentIndex]: result }));
      recordAssessment(result.level <= 2, false);
    } catch (err) {
      setZhukError(err instanceof Error ? err.message : "Marking failed. Please try again.");
    } finally {
      setZhukLoading(false);
    }
  }, [currentIndex, questions, userAnswers, zhukLoading, specId, recordAssessment]);

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
    setZhukResults({});
    setZhukError(null);
    setZhukLoading(false);
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

        <PotemkinSessionNudge
          knew={stats.knew}
          total={questions.length}
          retryMode={retryMode}
          topicName={topicName}
        />
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

          {/* Marking mode: self-marking or AI marking with Zhukovsky */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Marking:</span>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setMarkMode("self")}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${markMode === "self" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Self-mark
              </button>
              <button
                type="button"
                onClick={() => setMarkMode("zhukovsky")}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition ${markMode === "zhukovsky" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <GraduationCap className="h-3.5 w-3.5" /> Zhukovsky
              </button>
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

          {/* Already assessed — show Zhukovsky's mark if this question was AI-marked */}
          {alreadyAssessed && (
            zhukResults[currentIndex] ? (
              <ZhukovskyMark
                result={zhukResults[currentIndex]}
                userAnswer={currentUserAnswer}
                officialAnswer={question.correct_answer}
                questionText={question.question_text}
                canNext={currentIndex + 1 < questions.length}
                onNext={() => navigateTo(currentIndex + 1)}
              />
            ) : (
              <AssessedView
                userAnswer={currentUserAnswer}
                correctAnswer={question.correct_answer}
                feedback={question.level_3_feedback}
                assessment={prevEntry.assessment!}
                questionText={question.question_text}
              />
            )
          )}

          {/* Reveal / Mark button */}
          {!alreadyAssessed && !revealed && (
            <div className="mt-4">
              {markMode === "self" ? (
                <Button onClick={handleReveal} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Eye className="mr-1.5 h-4 w-4" />
                  Reveal Answer
                </Button>
              ) : isAnon ? (
                <div className="flex flex-col items-start gap-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <span className="text-sm text-foreground">Sign in (free) to mark your answer with Zhukovsky.</span>
                  <Link to="/login" className="text-sm font-medium text-primary hover:underline">Sign in →</Link>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Button
                    onClick={handleZhukovskyMark}
                    disabled={!currentUserAnswer.trim()}
                    className="w-fit bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <GraduationCap className="mr-1.5 h-4 w-4" />
                    Mark with Zhukovsky
                  </Button>
                  {!currentUserAnswer.trim() && (
                    <span className="text-xs text-muted-foreground">Type an answer above for Zhukovsky to mark.</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Revealed — self-mark assessment */}
          {!alreadyAssessed && revealed && markMode === "self" && (
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
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button onClick={() => handleSelfAssess(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  I got it
                </Button>
                <Button onClick={() => handleSelfAssess(false)} variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  <XCircle className="mr-1.5 h-4 w-4" />
                  I missed it
                </Button>
                <AskPotemkinButton question={question.question_text} answer={question.correct_answer} />
              </div>
            </div>
          )}

          {/* Zhukovsky is marking / errored (the AI result renders above once ready) */}
          {!alreadyAssessed && revealed && markMode === "zhukovsky" && (
            <div className="mt-6 space-y-4">
              {zhukLoading && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Zhukovsky is marking your answer…
                </div>
              )}
              {zhukError && !zhukLoading && (
                <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{zhukError}</span>
                  </div>
                  <Button onClick={handleZhukovskyMark} variant="outline" size="sm">Try again</Button>
                </div>
              )}
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
        questionId={question?.id}
        questionTable="concept_questions"
        specId={specId}
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

function AskPotemkinButton({ question, answer }: { question: string; answer: string }) {
  const ask = () => {
    const prefill = `I got this Driller question wrong: "${question}"\n\nThe correct answer is: "${answer}"\n\nCan you explain why, and what I should remember to get it right next time?`;
    window.dispatchEvent(new CustomEvent("potemkin:open", { detail: { prefill } }));
  };
  return (
    <Button
      onClick={ask}
      variant="outline"
      size="sm"
      className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
    >
      <Sparkles className="h-3.5 w-3.5" />
      Ask Potemkin to explain
    </Button>
  );
}

const ZHUK_LEVEL_STYLES: Record<number, { ring: string; text: string; bg: string }> = {
  1: { ring: "border-emerald-500/40", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/5" },
  2: { ring: "border-teal-500/40", text: "text-teal-600 dark:text-teal-400", bg: "bg-teal-500/5" },
  3: { ring: "border-amber-500/40", text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/5" },
  4: { ring: "border-orange-500/40", text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/5" },
  5: { ring: "border-rose-500/40", text: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/5" },
};

function ZhukovskyMark({ result, userAnswer, officialAnswer, questionText, canNext, onNext }: {
  result: ZhukovskyResult; userAnswer: string; officialAnswer: string; questionText: string; canNext: boolean; onNext: () => void;
}) {
  const style = ZHUK_LEVEL_STYLES[result.level] ?? ZHUK_LEVEL_STYLES[3];
  const label = ZHUKOVSKY_BANDS[result.level] ?? "Marked";
  return (
    <div className="mt-6 animate-flip-in space-y-4">
      {userAnswer.trim() && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Answer</h4>
          <p className="text-sm leading-relaxed text-foreground/80">{userAnswer}</p>
        </div>
      )}
      <div className={`rounded-lg border-2 ${style.ring} ${style.bg} p-5`}>
        <div className="mb-2 flex items-center gap-2">
          <GraduationCap className={`h-4 w-4 ${style.text}`} />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zhukovsky</span>
          <span className={`ml-auto rounded-full border ${style.ring} px-2.5 py-0.5 text-xs font-bold ${style.text}`}>
            {result.level} · {label}
          </span>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{result.feedback}</p>
      </div>
      {result.errors.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5" /> Worth checking
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
            {result.errors.map((e, i) => (
              <li key={i}>{e.correction}</li>
            ))}
          </ul>
        </div>
      )}
      {!result.servedModelAnswer && (
        <div className="rounded-lg border border-border bg-muted/50 p-5">
          <h4 className="mb-1 font-serif text-sm font-semibold text-primary">Model Answer</h4>
          <p className="text-sm leading-relaxed text-foreground/80">{officialAnswer}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <DiscussWithPotemkinButton questionText={questionText} feedback={result.feedback} />
        {canNext && (
          <Button onClick={onNext} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Next question
            <ChevronRight className="ml-1.5 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Hand off from Zhukovsky's mark into a Potemkin conversation, seeded with a short
// message built from the topic + the retrieval question Zhukovsky ended on.
function DiscussWithPotemkinButton({ questionText, feedback }: {
  questionText: string; feedback: string;
}) {
  const discuss = () => {
    const prefill = buildPotemkinHandoff(questionText, feedback);
    window.dispatchEvent(new CustomEvent("potemkin:open", { detail: { prefill } }));
  };
  return (
    <Button onClick={discuss} variant="outline" size="sm" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5">
      <Sparkles className="h-3.5 w-3.5" />
      Discuss with Potemkin
    </Button>
  );
}

function AssessedView({ userAnswer, correctAnswer, feedback, assessment, questionText }: {
  userAnswer: string; correctAnswer: string; feedback: { workpack_ref: string; textbook_ref: string }; assessment: Assessment; questionText: string;
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
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-medium">
        {assessment === "knew" ? (
          <span className="flex items-center gap-1.5 text-primary"><CheckCircle2 className="h-4 w-4" /> You knew this</span>
        ) : (
          <span className="flex items-center gap-1.5 text-destructive"><XCircle className="h-4 w-4" /> You missed this</span>
        )}
        {assessment === "missed" && (
          <AskPotemkinButton question={questionText} answer={correctAnswer} />
        )}
      </div>
    </div>
  );
}

const POTEMKIN_NUDGE_KEY = "russia-potemkin-good-session-nudge-dismissed";

function PotemkinSessionNudge({ knew, total, retryMode, topicName }: {
  knew: number; total: number; retryMode: boolean; topicName?: string;
}) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(POTEMKIN_NUDGE_KEY) === "1"; } catch { return false; }
  });
  if (dismissed || retryMode || total === 0) return null;
  if (knew / total < 0.8) return null;

  const ask = () => {
    const prefill = topicName
      ? `I just scored well on the Driller for "${topicName}". What's a deeper question I should be able to answer about this topic at A-Level?`
      : `I just scored well on a Driller session. What's a deeper question I should be able to answer about this topic at A-Level?`;
    window.dispatchEvent(new CustomEvent("potemkin:open", { detail: { prefill } }));
  };

  const dismiss = () => {
    try { localStorage.setItem(POTEMKIN_NUDGE_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <Card className="mx-auto max-w-2xl border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-2">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-foreground">Curious why?</p>
            <p className="text-muted-foreground">
              You know the facts. Ask Potemkin to push you on what they mean.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button onClick={ask} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Ask Potemkin
          </Button>
          <Button onClick={dismiss} size="sm" variant="ghost">
            Not now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
