// =============================================================================
// TeacherQuestionsPage — Question Review Pipeline at /teacher/questions
// =============================================================================
// Two sections:
//   1. Review queue — pending AI/teacher-submitted questions to approve/edit/reject
//   2. Add question — teacher adds a fact or concept question directly to live
//
// Tabs for Pending / Approved / Rejected with counts.
// =============================================================================

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  Flag,
  Pencil,
  Plus,
  Trash2,
  X,
  Zap,
  Target,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useSpecPoints } from "@/hooks/useRevisionData";
import {
  useTeacherFlags,
  type FlaggedQuestion,
} from "@/hooks/useQuestionFlags";
import {
  useQuestionReview,
  type FactQuestionData,
  type ConceptQuestionData,
  type ReviewItem,
} from "@/hooks/useQuestionReview";

type StatusTab = "pending" | "approved" | "rejected";

const TeacherQuestionsPage = () => {
  const { isTeacher } = useAuth();
  const navigate = useNavigate();
  const specPoints = useSpecPoints();
  const {
    items,
    counts,
    loading,
    fetchItems,
    approve,
    reject,
    addDirect,
  } = useQuestionReview();
  const {
    flags,
    loading: flagsLoading,
    resolveFlags,
    deleteQuestion,
  } = useTeacherFlags();

  const [activeTab, setActiveTab] = useState<StatusTab>("pending");
  const [showAddForm, setShowAddForm] = useState(false);

  const handleTabChange = (tab: StatusTab) => {
    setActiveTab(tab);
    fetchItems(tab);
  };

  if (!isTeacher) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center text-muted-foreground">
        No teacher access.
      </div>
    );
  }

  return (
    <div>
      <SEOHead
        title="Question Review | Teacher | AQA 1H Russia Compass"
        description="Review, approve, and add questions."
        canonicalPath="/teacher/questions"
      />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => navigate("/teacher")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Teacher
          </Button>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">Questions</span>
        </div>

        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileQuestion className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-primary">
                Question Review Pipeline
              </h1>
              <p className="text-xs text-muted-foreground">
                Review pending questions, or add your own directly.
              </p>
            </div>
          </div>
        </header>

        {/* Student-flagged questions */}
        {flags.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-rose-700 dark:text-rose-300">
              <Flag className="h-5 w-5" />
              Flagged by students
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-100 px-1.5 text-[11px] font-bold tabular-nums text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                {flags.length}
              </span>
            </h2>
            <div className="space-y-3">
              {flags.map((f) => (
                <FlaggedCard
                  key={`${f.questionTable}:${f.questionId}`}
                  flag={f}
                  specPoints={specPoints}
                  onResolve={resolveFlags}
                  onDelete={deleteQuestion}
                />
              ))}
            </div>
          </section>
        )}

        {/* Status tabs */}
        <div className="mb-6 flex gap-2">
          {(["pending", "approved", "rejected"] as StatusTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                  : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {tab}
              <span
                className={`ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
                  activeTab === tab
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* Queue items */}
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Loading questions...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-card p-8 text-center shadow-card ring-1 ring-border/60">
            <p className="text-sm text-muted-foreground">
              {activeTab === "pending"
                ? "No questions waiting for review."
                : activeTab === "approved"
                  ? "No approved questions yet."
                  : "No rejected questions."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <ReviewCard
                key={item.id}
                item={item}
                specPoints={specPoints}
                onApprove={approve}
                onReject={reject}
                readOnly={activeTab !== "pending"}
              />
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="my-8 border-t border-border/60" />

        {/* Add question directly */}
        <section>
          {showAddForm ? (
            <AddQuestionForm
              specPoints={specPoints}
              onAdd={addDirect}
              onClose={() => setShowAddForm(false)}
            />
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowAddForm(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add a question directly
            </Button>
          )}
        </section>
      </div>
    </div>
  );
};

// =============================================================================
// ReviewCard — single queue item with approve/edit/reject
// =============================================================================

// =============================================================================
// FlaggedCard — a question flagged by students
// =============================================================================

function FlaggedCard({
  flag,
  specPoints,
  onResolve,
  onDelete,
}: {
  flag: FlaggedQuestion;
  specPoints: { id: number; short_title: string | null; title: string }[];
  onResolve: (flagIds: string[]) => Promise<boolean>;
  onDelete: (
    questionTable: "fact_questions" | "concept_questions",
    questionId: string,
    flagIds: string[]
  ) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const isFact = flag.questionTable === "fact_questions";
  const spec = flag.specId ? specPoints.find((s) => s.id === flag.specId) : null;
  const specLabel = spec
    ? `${flag.specId}. ${spec.short_title ?? spec.title}`
    : flag.specId
      ? `Spec ${flag.specId}`
      : "";

  const handleDismiss = async () => {
    setBusy(true);
    await onResolve(flag.flagIds);
    setBusy(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    await onDelete(flag.questionTable, flag.questionId, flag.flagIds);
    setBusy(false);
  };

  return (
    <div className="rounded-xl bg-card p-5 shadow-card ring-1 ring-rose-200/70 dark:ring-rose-800/40">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          <Flag className="h-3 w-3" />
          {flag.flagCount} flag{flag.flagCount === 1 ? "" : "s"}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
            isFact
              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
              : "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
          }`}
        >
          {isFact ? <Zap className="h-3 w-3" /> : <Target className="h-3 w-3" />}
          {isFact ? "Fact" : "Concept"}
        </span>
        {specLabel && (
          <span className="text-muted-foreground">{specLabel}</span>
        )}
      </div>

      {/* Question + answer */}
      <div className="text-sm font-medium text-foreground">
        {flag.questionText}
      </div>
      <div className="mt-1.5 text-sm text-emerald-700 dark:text-emerald-300">
        {flag.answerText}
      </div>

      {/* Student reasons */}
      {flag.reasons.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Student comments
          </div>
          {flag.reasons.map((r, i) => (
            <div
              key={i}
              className="rounded-md bg-muted/50 px-3 py-1.5 text-xs text-foreground/80"
            >
              "{r}"
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleDismiss}
          disabled={busy}
          className="gap-1.5"
        >
          <Check className="h-3.5 w-3.5" />
          Dismiss flags
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDelete}
          disabled={busy}
          className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete question
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// ReviewCard — single queue item with approve/edit/reject
// =============================================================================

function ReviewCard({
  item,
  specPoints,
  onApprove,
  onReject,
  readOnly,
}: {
  item: ReviewItem;
  specPoints: { id: number; short_title: string | null; title: string }[];
  onApprove: (
    id: string,
    editedData?: FactQuestionData | ConceptQuestionData
  ) => Promise<boolean>;
  onReject: (id: string, reason?: string) => Promise<boolean>;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isFact = item.targetTable === "fact_questions";
  const spec = specPoints.find((s) => s.id === item.specId);
  const specLabel = spec
    ? `${item.specId}. ${spec.short_title ?? spec.title}`
    : `Spec ${item.specId}`;

  // Edit state for fact questions
  const [editQ, setEditQ] = useState(
    isFact
      ? (item.questionData as FactQuestionData).question
      : (item.questionData as ConceptQuestionData).question_text
  );
  const [editA, setEditA] = useState(
    isFact
      ? (item.questionData as FactQuestionData).answer
      : (item.questionData as ConceptQuestionData).correct_answer
  );
  const [editSynonyms, setEditSynonyms] = useState(
    isFact
      ? ((item.questionData as FactQuestionData).valid_synonyms ?? []).join(", ")
      : ""
  );

  const handleApprove = async () => {
    setBusy(true);
    const editedData = editing
      ? isFact
        ? ({
            question: editQ,
            answer: editA,
            valid_synonyms: editSynonyms
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          } as FactQuestionData)
        : ({
            ...(item.questionData as ConceptQuestionData),
            question_text: editQ,
            correct_answer: editA,
          } as ConceptQuestionData)
      : undefined;
    await onApprove(item.id, editedData);
    setBusy(false);
  };

  const handleReject = async () => {
    setBusy(true);
    await onReject(item.id);
    setBusy(false);
  };

  const q = isFact
    ? (item.questionData as FactQuestionData).question
    : (item.questionData as ConceptQuestionData).question_text;
  const a = isFact
    ? (item.questionData as FactQuestionData).answer
    : (item.questionData as ConceptQuestionData).correct_answer;
  const synonyms = isFact
    ? (item.questionData as FactQuestionData).valid_synonyms
    : undefined;

  return (
    <div className="rounded-xl bg-card p-5 shadow-card ring-1 ring-border/60">
      {/* Header row */}
      <div className="mb-3 flex items-center gap-2 text-[11px]">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
            isFact
              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
              : "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
          }`}
        >
          {isFact ? (
            <Zap className="h-3 w-3" />
          ) : (
            <Target className="h-3 w-3" />
          )}
          {isFact ? "Fact" : "Concept"}
        </span>
        <span className="text-muted-foreground">{specLabel}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="text-muted-foreground capitalize">{item.source}</span>
        {item.rejectionReason && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-rose-600 dark:text-rose-400">
              Rejected: {item.rejectionReason}
            </span>
          </>
        )}
      </div>

      {editing ? (
        /* Edit mode */
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Question
            </label>
            <textarea
              value={editQ}
              onChange={(e) => setEditQ(e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              rows={2}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Answer
            </label>
            <textarea
              value={editA}
              onChange={(e) => setEditA(e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              rows={2}
            />
          </div>
          {isFact && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Synonyms (comma separated)
              </label>
              <Input
                value={editSynonyms}
                onChange={(e) => setEditSynonyms(e.target.value)}
                placeholder="e.g. Land Captain, zemsky nachalnik"
              />
            </div>
          )}
        </div>
      ) : (
        /* Display mode */
        <div>
          <div className="text-sm font-medium text-foreground">{q}</div>
          <div className="mt-1.5 text-sm text-emerald-700 dark:text-emerald-300">
            {a}
          </div>
          {synonyms && synonyms.length > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">
              Also accepted: {synonyms.join(", ")}
            </div>
          )}
          {/* Concept question extra fields */}
          {!isFact && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              {expanded ? "Less" : "More details"}
            </button>
          )}
          {!isFact && expanded && (
            <ConceptDetails data={item.questionData as ConceptQuestionData} />
          )}
        </div>
      )}

      {/* Actions */}
      {!readOnly && (
        <div className="mt-4 flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={busy}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Check className="h-3.5 w-3.5" />
            {editing ? "Save & Approve" : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(!editing)}
            disabled={busy}
            className="gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editing ? "Cancel edit" : "Edit"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReject}
            disabled={busy}
            className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ConceptDetails — expanded fields for concept questions
// =============================================================================

function ConceptDetails({ data }: { data: ConceptQuestionData }) {
  return (
    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
      {data.question_type && (
        <div>
          <span className="font-semibold">Type:</span> {data.question_type}
        </div>
      )}
      {data.ko_terms_used && data.ko_terms_used.length > 0 && (
        <div>
          <span className="font-semibold">KO terms:</span>{" "}
          {data.ko_terms_used.join(", ")}
        </div>
      )}
      {data.good_answer_synonym && (
        <div>
          <span className="font-semibold">Right Idea answer:</span>{" "}
          {data.good_answer_synonym}
        </div>
      )}
      {data.workpack_ref && (
        <div>
          <span className="font-semibold">Workpack:</span> {data.workpack_ref}
        </div>
      )}
      {data.textbook_ref && (
        <div>
          <span className="font-semibold">Textbook:</span> {data.textbook_ref}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// AddQuestionForm — add a fact or concept question directly to the live table
// =============================================================================

function AddQuestionForm({
  specPoints,
  onAdd,
  onClose,
}: {
  specPoints: { id: number; short_title: string | null; title: string }[];
  onAdd: (
    targetTable: "fact_questions" | "concept_questions",
    specId: number,
    data: FactQuestionData | ConceptQuestionData
  ) => Promise<boolean>;
  onClose: () => void;
}) {
  const [targetTable, setTargetTable] = useState<
    "fact_questions" | "concept_questions"
  >("fact_questions");
  const [specId, setSpecId] = useState<number>(specPoints[0]?.id ?? 1);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [synonyms, setSynonyms] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    setSuccess(false);

    const data =
      targetTable === "fact_questions"
        ? ({
            question: question.trim(),
            answer: answer.trim(),
            valid_synonyms: synonyms
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          } as FactQuestionData)
        : ({
            question_text: question.trim(),
            correct_answer: answer.trim(),
          } as ConceptQuestionData);

    const ok = await onAdd(targetTable, specId, data);
    setSaving(false);

    if (ok) {
      setSuccess(true);
      setQuestion("");
      setAnswer("");
      setSynonyms("");
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <div className="rounded-xl bg-card p-5 shadow-card ring-1 ring-border/60">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-base font-bold text-primary">
          Add a question directly
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>

      <div className="space-y-4">
        {/* Type toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setTargetTable("fact_questions")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              targetTable === "fact_questions"
                ? "bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Knowledge
          </button>
          <button
            onClick={() => setTargetTable("concept_questions")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              targetTable === "concept_questions"
                ? "bg-purple-100 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-950/50 dark:text-purple-300"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Target className="h-3.5 w-3.5" />
            Concept
          </button>
        </div>

        {/* Spec picker */}
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Spec point
          </label>
          <select
            value={specId}
            onChange={(e) => setSpecId(Number(e.target.value))}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {specPoints.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.id}. {sp.short_title ?? sp.title}
              </option>
            ))}
          </select>
        </div>

        {/* Question */}
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Question
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            rows={2}
            placeholder={
              targetTable === "fact_questions"
                ? "e.g. What treaty ended the Crimean War?"
                : "e.g. How important was the Crimean War in convincing Alexander II to pursue reform?"
            }
          />
        </div>

        {/* Answer */}
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Answer
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            rows={2}
            placeholder={
              targetTable === "fact_questions"
                ? "e.g. Treaty of Paris (1856)"
                : "e.g. The Crimean War exposed Russia's military and economic backwardness..."
            }
          />
        </div>

        {/* Synonyms (fact only) */}
        {targetTable === "fact_questions" && (
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Also accepted (comma separated, optional)
            </label>
            <Input
              value={synonyms}
              onChange={(e) => setSynonyms(e.target.value)}
              placeholder="e.g. Paris Treaty, Treaty of Paris 1856"
            />
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSubmit}
            disabled={saving || !question.trim() || !answer.trim()}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {saving ? "Adding..." : "Add question"}
          </Button>
          {success && (
            <span className="text-sm font-medium text-emerald-600">
              Added!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default TeacherQuestionsPage;
