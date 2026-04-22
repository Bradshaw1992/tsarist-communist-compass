// =============================================================================
// FeedbackDialog — Users send feedback without needing Tom's email.
// =============================================================================
import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FeedbackDialogProps {
  trigger: React.ReactNode;
}

const COOLDOWN_KEY = "feedback_last_submitted_at";
const COOLDOWN_MS = 60_000; // 1 per minute from same browser

export function FeedbackDialog({ trigger }: FeedbackDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      toast.error("Write something first!");
      return;
    }
    if (trimmedMessage.length > 5000) {
      toast.error("That's a bit long — please keep it under 5000 characters.");
      return;
    }

    // Client-side rate limit
    const lastRaw = localStorage.getItem(COOLDOWN_KEY);
    if (lastRaw) {
      const elapsed = Date.now() - Number(lastRaw);
      if (elapsed < COOLDOWN_MS) {
        const secs = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        toast.error(`Please wait ${secs}s before sending again.`);
        return;
      }
    }

    setBusy(true);
    try {
      const { error } = await supabase.from("user_feedback").insert({
        user_id: user?.id ?? null,
        email: email.trim() || null,
        message: trimmedMessage,
        page_url: typeof window !== "undefined" ? window.location.pathname : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });

      if (error) throw error;

      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      toast.success("Thanks — Tom will see this.");
      setMessage("");
      setEmail("");
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't send — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Send feedback
          </DialogTitle>
          <DialogDescription>
            Found a bug, a mistake, or got an idea? Tom reads every message.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">What's on your mind?</label>
            <Textarea
              placeholder="e.g. 'The chronology driller keeps repeating the same question…'"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={busy}
              rows={5}
              maxLength={5000}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              Your email{" "}
              <span className="font-normal">(optional — if you'd like Tom to reply)</span>
            </label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              maxLength={320}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={busy || !message.trim()}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {busy ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
