import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Flag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const ISSUE_TYPES = [
  { value: "factual_error", label: "Factual Error" },
  { value: "typo_spelling", label: "Typo / Spelling" },
  { value: "confusing_vague", label: "Confusing / Vague" },
  { value: "not_relevant", label: "Not Relevant" },
] as const;

interface ReportIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: string;
  topicName: string;
  originalText: string;
}

export function ReportIssueDialog({
  open, onOpenChange, section, topicName, originalText,
}: ReportIssueDialogProps) {
  const [issueType, setIssueType] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!issueType) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("content_reports" as any).insert({
        section,
        topic_name: topicName,
        original_text: originalText,
        issue_type: issueType,
        student_comment: comment,
      } as any);
      if (error) throw error;
      toast({ title: "Report received", description: "The Scribe will review this!" });
      setIssueType("");
      setComment("");
      onOpenChange(false);
    } catch (err) {
      console.error("Report submission failed:", err);
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
            Report an Issue
          </DialogTitle>
          <DialogDescription>
            Flag a problem with this content so it can be reviewed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-md border border-border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground line-clamp-3">{originalText}</p>
          </div>

          <Select value={issueType} onValueChange={setIssueType}>
            <SelectTrigger>
              <SelectValue placeholder="Select issue type..." />
            </SelectTrigger>
            <SelectContent>
              {ISSUE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional: describe the issue..."
            className="resize-none text-sm"
            rows={3}
          />

          <Button
            onClick={handleSubmit}
            disabled={!issueType || submitting}
            className="w-full"
          >
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Submit Report
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
      title="Report an issue"
      className="inline-flex items-center justify-center rounded p-1 text-muted-foreground/40 transition-colors hover:text-destructive"
    >
      <Flag className="h-3.5 w-3.5" />
    </button>
  );
}
