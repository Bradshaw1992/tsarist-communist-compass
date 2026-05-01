// =============================================================================
// ExtractsUpdatedAnnouncement — one-time popup for signed-in users
// =============================================================================
// Shown once per device to inform signed-in users that the extract content has
// been rewritten under a new rubric, and that a new "Challenge Extracts" tier
// has been added. Dismissable; never returns once dismissed (one-time only).
//
// Anonymous visitors don't see it — only logged-in students.
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookMarked, Flame } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const DISMISS_KEY = "russia-extracts-v2-announcement-dismissed";

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function ExtractsUpdatedAnnouncement() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only show after auth state is known and only to signed-in users who
    // haven't dismissed it.
    if (loading) return;
    if (!user) return;
    if (isDismissed()) return;
    // Small delay so the popup doesn't hijack initial page paint.
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [user, loading]);

  const dismiss = () => {
    setDismissed();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Extracts updated
            </span>
          </div>
          <DialogTitle className="font-serif text-xl text-primary">
            The extract questions have been rewritten
          </DialogTitle>
          <DialogDescription className="pt-2 text-sm leading-relaxed text-foreground/80">
            Every extract has been redrafted to better match what AQA actually
            tests in Section A — subtler arguments, fewer pre-loaded specifics
            inside the extracts themselves, and the kinds of traps that catch
            most students in exam conditions.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-rose-50/60 p-4 ring-1 ring-rose-200/60 dark:bg-rose-950/20 dark:ring-rose-800/40">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <span className="text-sm font-semibold text-rose-700 dark:text-rose-300">
              New: Challenge Extracts
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground/80">
            Five harder extracts where the argument is genuinely buried —
            written specifically for students aiming at Level 5. They sit in
            their own section on the Extracts page.
          </p>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button asChild variant="ghost" size="sm" onClick={dismiss}>
            <Link to="/extracts">Take a look</Link>
          </Button>
          <Button onClick={dismiss} size="sm">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
