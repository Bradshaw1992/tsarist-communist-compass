// =============================================================================
// ExtractSessionPage — the practice session at /extracts/:setId
// =============================================================================
// Full AQA Section A extract practice:
//
// 1. Student chooses how many extracts (1, 2 or 3)
// 2. Reads extracts + question stem
// 3. For each extract, writes: overall argument, sub-arguments, evaluation
// 4. Reveals indicative content per extract
// 5. Self-marks each extract: Spot On / Right Idea / Missed It
// 6. Session saved to user_extract_attempts (if signed in)
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookMarked,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Lightbulb,
  Minus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExtractSetById } from "@/hooks/useExtracts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ExtractData } from "@/hooks/useExtracts";

type SelfMark = "spot_on" | "right_idea" | "missed";

interface ExtractWorkState {
  argument: string;
  subArguments: string;
  evaluation: string;
  revealed: boolean;
  selfMark: SelfMark | null;
}

const MARK_OPTIONS: { value: SelfMark; label: string; emoji: string; color: string }[] = [
  { value: "spot_on", label: "Spot On", emoji: "✓", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { value: "right_idea", label: "Right Idea", emoji: "~", color: "bg-amber-500 hover:bg-amber-600 text-white" },
  { value: "missed", label: "Missed It", emoji: "✗", color: "bg-red-600 hover:bg-red-700 text-white" },
];

const ExtractSessionPage = () => {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const extractSet = useExtractSetById(setId ?? "");

  // How many extracts to use (choice made before starting)
  const [extractCount, setExtractCount] = useState<number | null>(null);
  // Which extracts are active (selected after choosing count)
  const [activeExtracts, setActiveExtracts] = useState<ExtractData[]>([]);
  // Work state per extract label
  const [work, setWork] = useState<Record<string, ExtractWorkState>>({});
  // Session complete
  const [complete, setComplete] = useState(false);
  // Saving
  const [saving, setSaving] = useState(false);

  // When user picks a count, select extracts
  const handleStart = useCallback(
    (count: number) => {
      if (!extractSet) return;
      const sorted = [...extractSet.extracts].sort((a, b) => a.position - b.position);
      const selected = sorted.slice(0, count);
      setExtractCount(count);
      setActiveExtracts(selected);
      // Init work state
      const init: Record<string, ExtractWorkState> = {};
      for (const e of selected) {
        init[e.label] = {
          argument: "",
          subArguments: "",
          evaluation: "",
          revealed: false,
          selfMark: null,
        };
      }
      setWork(init);
    },
    [extractSet],
  );

  // Update work field for a specific extract
  const updateWork = useCallback(
    (label: string, field: keyof ExtractWorkState, value: string | boolean | SelfMark | null) => {
      setWork((prev) => ({
        ...prev,
        [label]: { ...prev[label], [field]: value },
      }));
    },
    [],
  );

  // Check if all extracts have been self-marked
  const allMarked = useMemo(() => {
    return activeExtracts.length > 0 && activeExtracts.every((e) => work[e.label]?.selfMark !== null);
  }, [activeExtracts, work]);

  // Save attempt to Supabase
  const saveAttempt = useCallback(async () => {
    if (!user || !extractSet || !extractCount) return;
    setSaving(true);
    try {
      const selfMarks: Record<string, string> = {};
      for (const e of activeExtracts) {
        selfMarks[e.label] = work[e.label]?.selfMark ?? "missed";
      }
      const { error } = await supabase.from("user_extract_attempts").insert({
        user_id: user.id,
        extract_set_id: extractSet.id,
        extracts_used: extractCount,
        self_marks: selfMarks,
      });
      if (error) throw error;
    } catch (err) {
      console.error("[ExtractSession] Save error:", err);
      toast.error("Failed to save your attempt.");
    } finally {
      setSaving(false);
    }
  }, [user, extractSet, extractCount, activeExtracts, work]);

  // Complete session
  const handleComplete = useCallback(async () => {
    await saveAttempt();
    setComplete(true);
  }, [saveAttempt]);

  if (!extractSet) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Extract set not found.</p>
          <Link to="/extracts" className="mt-2 text-sm text-primary hover:underline">
            ← Back to Extract Practice
          </Link>
        </div>
      </div>
    );
  }

  // ─── Choice screen ───────────────────────────────────────────────────────
  if (extractCount === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-lg">
          <Link
            to="/extracts"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Extract Practice
          </Link>

          <div className="rounded-xl border-2 bg-card p-6 shadow-lg sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                <BookMarked className="h-5 w-5" />
              </span>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Section A · Extract Question
              </div>
            </div>

            <h1 className="font-serif text-xl font-bold text-primary sm:text-2xl">
              {extractSet.topic}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {extractSet.date_range}
            </p>

            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-foreground">
                How many extracts would you like to practise?
              </p>
              <div className="flex gap-3">
                {[1, 2, 3].filter((n) => n <= extractSet.extracts.length).map((n) => (
                  <Button
                    key={n}
                    variant="outline"
                    size="lg"
                    className="flex-1 h-14 text-lg font-bold"
                    onClick={() => handleStart(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                AQA gives 3 extracts in the real exam. Use fewer for focused practice.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Complete screen ─────────────────────────────────────────────────────
  if (complete) {
    const marks = activeExtracts.map((e) => work[e.label]?.selfMark ?? "missed");
    const spotOn = marks.filter((m) => m === "spot_on").length;
    const rightIdea = marks.filter((m) => m === "right_idea").length;
    const missed = marks.filter((m) => m === "missed").length;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-lg text-center">
          <div className="rounded-xl border-2 bg-card p-8 shadow-lg">
            <div className="mb-4 text-4xl">📝</div>
            <h1 className="font-serif text-2xl font-bold text-primary">
              Session Complete
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {extractSet.topic}
            </p>

            <div className="mt-6 flex justify-center gap-6">
              {spotOn > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{spotOn}</div>
                  <div className="text-xs text-muted-foreground">Spot On</div>
                </div>
              )}
              {rightIdea > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-500">{rightIdea}</div>
                  <div className="text-xs text-muted-foreground">Right Idea</div>
                </div>
              )}
              {missed > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{missed}</div>
                  <div className="text-xs text-muted-foreground">Missed</div>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setExtractCount(null);
                  setComplete(false);
                  setWork({});
                  setActiveExtracts([]);
                }}
              >
                Try Again
              </Button>
              <Button onClick={() => navigate("/extracts")}>
                Back to Extracts
              </Button>
            </div>

            {!user && (
              <p className="mt-4 text-xs text-muted-foreground">
                Sign in to save your progress.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Main practice session ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/extracts"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Extracts</span>
          </Link>
          <div className="flex-1 text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Section A · Extract Question
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => navigate("/extracts")}
          >
            <X className="h-4 w-4 mr-1" /> End
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Question stem */}
        <div className="mb-8 rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-800/50 dark:bg-indigo-950/20">
          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
            Question
          </p>
          <p className="font-serif text-base font-medium leading-relaxed text-foreground sm:text-lg">
            {extractSet.question_stem}
          </p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">[30 marks]</p>
        </div>

        {/* Extracts */}
        {activeExtracts.map((extract) => (
          <ExtractCard
            key={extract.label}
            extract={extract}
            work={work[extract.label]}
            onUpdateWork={(field, value) => updateWork(extract.label, field, value)}
          />
        ))}

        {/* Complete button */}
        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            className="h-14 px-8 text-base"
            disabled={!allMarked || saving}
            onClick={handleComplete}
          >
            {saving ? "Saving…" : allMarked ? "Complete Session" : "Self-mark all extracts to finish"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// ExtractCard — one extract with work area + reveal
// =============================================================================

interface ExtractCardProps {
  extract: ExtractData;
  work: ExtractWorkState;
  onUpdateWork: (field: keyof ExtractWorkState, value: string | boolean | SelfMark | null) => void;
}

function ExtractCard({ extract, work, onUpdateWork }: ExtractCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-6 rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Extract header + body */}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-primary">
              Extract {extract.label}
            </h2>
            <p className="text-xs text-muted-foreground">{extract.citation}</p>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="mt-4 rounded-lg bg-muted/50 p-4 dark:bg-muted/20">
            <p className="font-serif text-[15px] leading-[1.75] text-foreground">
              {extract.body}
            </p>
          </div>
        )}
      </div>

      {/* Work area */}
      <div className="border-t bg-muted/20 p-5 sm:p-6 space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          Your Analysis — Extract {extract.label}
        </h3>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Overall argument of this extract
          </label>
          <textarea
            className="mt-1 w-full rounded-lg border bg-background p-3 text-sm placeholder:text-muted-foreground/60 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            rows={2}
            placeholder="What is the historian's main argument?"
            value={work.argument}
            onChange={(e) => onUpdateWork("argument", e.target.value)}
            disabled={work.revealed}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Sub-arguments (list the specific claims)
          </label>
          <textarea
            className="mt-1 w-full rounded-lg border bg-background p-3 text-sm placeholder:text-muted-foreground/60 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            rows={3}
            placeholder="What specific claims or sub-points does the extract make?"
            value={work.subArguments}
            onChange={(e) => onUpdateWork("subArguments", e.target.value)}
            disabled={work.revealed}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            Evaluation notes (corroborate &amp; challenge with your own knowledge)
          </label>
          <textarea
            className="mt-1 w-full rounded-lg border bg-background p-3 text-sm placeholder:text-muted-foreground/60 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            rows={4}
            placeholder="What contextual knowledge supports or challenges these arguments?"
            value={work.evaluation}
            onChange={(e) => onUpdateWork("evaluation", e.target.value)}
            disabled={work.revealed}
          />
        </div>

        {/* Reveal button */}
        {!work.revealed ? (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => onUpdateWork("revealed", true)}
          >
            <Eye className="h-4 w-4" />
            Reveal Indicative Content
          </Button>
        ) : (
          <>
            {/* Indicative content */}
            <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-800/50 dark:bg-indigo-950/20 space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-bold text-indigo-700 dark:text-indigo-300">
                <Lightbulb className="h-4 w-4" />
                Indicative Content — Extract {extract.label}
              </h4>

              {/* Overall argument */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Overall Argument
                </p>
                <p className="text-sm leading-relaxed text-foreground">
                  {extract.overall_argument}
                </p>
              </div>

              {/* Sub-arguments */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Sub-Arguments to Identify
                </p>
                <ul className="space-y-1">
                  {extract.sub_arguments.map((arg, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <Minus className="mt-1 h-3 w-3 shrink-0 text-indigo-500" />
                      <span>{arg}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Corroborating knowledge */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Knowledge to Corroborate (support the argument)
                </p>
                <ul className="space-y-1.5">
                  {extract.corroborating_knowledge.map((k, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Challenging knowledge */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Knowledge to Challenge (undermine the argument)
                </p>
                <ul className="space-y-1.5">
                  {extract.challenging_knowledge.map((k, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {extract.is_flawed && extract.flaw_notes && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-950/20">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">
                    Key Flaw in This Extract
                  </p>
                  <p className="text-sm text-amber-900 dark:text-amber-200">
                    {extract.flaw_notes}
                  </p>
                </div>
              )}
            </div>

            {/* Self-mark */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                How well did you identify the argument and evaluation?
              </p>
              <div className="flex gap-2">
                {MARK_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onUpdateWork("selfMark", opt.value)}
                    className={`flex-1 rounded-lg py-3 text-center text-sm font-bold transition-all ${
                      work.selfMark === opt.value
                        ? `${opt.color} ring-2 ring-offset-2 ring-offset-background`
                        : work.selfMark !== null
                          ? "bg-muted text-muted-foreground opacity-50"
                          : `${opt.color}`
                    }`}
                  >
                    <span className="mr-1.5">{opt.emoji}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ExtractSessionPage;
