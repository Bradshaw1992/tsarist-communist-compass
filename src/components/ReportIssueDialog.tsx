import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Flag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface ReportIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: string;
  topicName: string;
  originalText: string;
  /** New: if provided, writes to question_flags instead of content_reports */
  questionId?: string;
  questionTable?: "fact_questions" | "concept_questions";
  specId?: number;
}

export function ReportIssueDialog({
  open, onOpenChange, section, topicName, originalText,
  questionId, questionTable, specId,
}: ReportIssueDialogProps) {
  const { user } = useAuth();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // If we have question details AND a signed-in user, use the new question_flags table
      if (questionId && questionTable && user) {
        const { error } = await supabase.from("question_flags").insert({
          question_table: questionTable,
          question_id: questionId,
          spec_id: specId ?? null,
          flagged_by: user.id,
          reason: comment.trim() || null,
        });
        // Ignore duplicate flag errors (unique constraint)
        if (error && error.code !== "23505") throw error;
      } else {
        // Fallback: legacy content_reports table (for anonymous users or non-driller content)
        const { error } = await supabase.from("content_reports" as any).insert({
          section,
          topic_name: topicName,
          original_text: originalText,
          issue_type: "flagged",
          student_comment: comment,
        } as any);
        if (error) throw error;
      }
      toast({ title: "Flagged", description: "Your teacher will review this question." });
      setComment("");
      onOpenChange(false);
    } catch (err) {
      console.error("Flag submission failed:", err);
      toast({ title: "Failed to submit", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" />
            Flag this question
          </DialogTitle>
          <DialogDescription>
            Think something's wrong? Flag it and your teacher will review it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-md border border-border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground line-clamp-3">{originalText}</p>
          </div>

          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What's wrong with this question? (optional)"
            className="resize-none text-sm"
            rows={3}
          />

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Flag question
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Reusable flag button */
export function ReportFlagButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Flag this question"
      className="inline-flex items-center justify-center rounded p-1 text-muted-foreground/40 transition-colors hover:text-destructive"
    >
      <Flag className="h-3.5 w-3.5" />
    </button>
  );
}
