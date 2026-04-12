// =============================================================================
// JoinClassDialog — Student enters a join code to enrol in a teacher's class.
// =============================================================================
import { useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface JoinClassDialogProps {
  /** Render the trigger element inline (DropdownMenuItem style). */
  trigger: React.ReactNode;
}

export function JoinClassDialog({ trigger }: JoinClassDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const handleJoin = async () => {
    if (!user) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      toast.error("Please enter a class code");
      return;
    }

    setBusy(true);
    try {
      // Use the server-side RPC (security definer — no need for students
      // to have direct read access to the classes table).
      const { error } = await supabase.rpc("join_class_by_code", {
        p_join_code: trimmed,
      });

      if (error) {
        if (error.message.includes("Invalid join code")) {
          toast.error("No class found with that code. Check with your teacher.");
        } else {
          throw error;
        }
        setBusy(false);
        return;
      }

      toast.success("Joined class!");
      setCode("");
      setOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Something went wrong — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Join a class
          </DialogTitle>
          <DialogDescription>
            Enter the code your teacher gave you.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 pt-2">
          <Input
            placeholder="e.g. RUSSIA6D"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            maxLength={20}
            className="font-mono text-lg tracking-wider uppercase"
            autoFocus
          />
          <Button onClick={handleJoin} disabled={busy || !code.trim()}>
            {busy ? "Joining…" : "Join"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
