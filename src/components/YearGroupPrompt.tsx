// =============================================================================
// YearGroupPrompt — soft-gate modal asking the student which year they're in
// =============================================================================
// Shown once per session to any signed-in student whose user_profile has no
// exam_year set and who hasn't explicitly declined ("Prefer not to say").
//
// We store the year they sit (or sat) their A-Level as a smallint — the
// current_year_group(exam_year) SQL function derives Year 12 / Year 13 /
// Left school on the fly from today's date, so no cron job is needed to
// roll students forward each September.
//
// UX:
//   - Three big buttons: Year 12 / Year 13 / I've left school
//   - "Left school" reveals a year picker (last 5 academic years)
//   - "Prefer not to say" link at the bottom records dismissed_at; never asks again
//   - Closing the dialog without picking sets a sessionStorage flag — the
//     prompt will reappear at next login.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GraduationCap, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const SESSION_SKIP_KEY = "russia-year-group-prompt-skipped";

function currentAcademicAnchor(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  return month >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

type ProfileWithYearGroup = {
  exam_year?: number | null;
  year_group_prompt_dismissed_at?: string | null;
};

export function YearGroupPrompt() {
  const { user, profile, refreshProfile } = useAuth();
  const p = profile as (ProfileWithYearGroup | null);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"main" | "left-school">("main");
  const [saving, setSaving] = useState(false);

  const anchor = useMemo(() => currentAcademicAnchor(), []);
  const yearTwelveExamYear = anchor + 2;
  const yearThirteenExamYear = anchor + 1;
  const leftSchoolYears = [anchor, anchor - 1, anchor - 2, anchor - 3, anchor - 4];

  // Decide whether to show. Only signed-in students with no answer + no dismissal
  // + haven't skipped this session.
  useEffect(() => {
    if (!user || !p) return;
    if (p.exam_year != null) return;
    if (p.year_group_prompt_dismissed_at) return;
    let skipped = false;
    try { skipped = sessionStorage.getItem(SESSION_SKIP_KEY) === "1"; } catch {}
    if (skipped) return;
    setOpen(true);
  }, [user, p]);

  const handleClose = (next: boolean) => {
    if (next) return;
    // Closing without picking → session-only skip, comes back next login.
    try { sessionStorage.setItem(SESSION_SKIP_KEY, "1"); } catch {}
    setOpen(false);
    setView("main");
  };

  const saveExamYear = async (examYear: number) => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ exam_year: examYear } as never)
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: "Thanks!", description: "We've saved your year group." });
      setOpen(false);
      setView("main");
    } catch (err) {
      console.error("Failed to save exam_year:", err);
      toast({ title: "Couldn't save", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const declineToAnswer = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ year_group_prompt_dismissed_at: new Date().toISOString() } as never)
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      setOpen(false);
      setView("main");
    } catch (err) {
      console.error("Failed to record dismissal:", err);
      toast({ title: "Couldn't save", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Quick question — which year are you in?
          </DialogTitle>
          <DialogDescription>
            This helps me see who's still using the app each year. It only takes a second, and I won't ask again.
          </DialogDescription>
        </DialogHeader>

        {view === "main" && (
          <div className="space-y-3 pt-2">
            <Button
              onClick={() => saveExamYear(yearTwelveExamYear)}
              disabled={saving}
              className="w-full justify-start"
              size="lg"
              variant="outline"
            >
              I'm in Year 12
              <span className="ml-auto text-xs text-muted-foreground">
                A-Level {yearTwelveExamYear}
              </span>
            </Button>
            <Button
              onClick={() => saveExamYear(yearThirteenExamYear)}
              disabled={saving}
              className="w-full justify-start"
              size="lg"
              variant="outline"
            >
              I'm in Year 13
              <span className="ml-auto text-xs text-muted-foreground">
                A-Level {yearThirteenExamYear}
              </span>
            </Button>
            <Button
              onClick={() => setView("left-school")}
              disabled={saving}
              className="w-full justify-start"
              size="lg"
              variant="outline"
            >
              I've left school
            </Button>

            <div className="flex items-center justify-center pt-2">
              <button
                onClick={declineToAnswer}
                disabled={saving}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Prefer not to say"}
              </button>
            </div>
          </div>
        )}

        {view === "left-school" && (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Which year did you sit your A-Level?</p>
            <div className="grid grid-cols-1 gap-2">
              {leftSchoolYears.map((y) => (
                <Button
                  key={y}
                  onClick={() => saveExamYear(y)}
                  disabled={saving}
                  className="w-full justify-start"
                  size="lg"
                  variant="outline"
                >
                  Sat A-Level in {y}
                </Button>
              ))}
            </div>
            <Button
              onClick={() => setView("main")}
              disabled={saving}
              variant="ghost"
              className="w-full"
              size="sm"
            >
              ← Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
