// =============================================================================
// FirstLoginWelcome — one-time orientation cards for new signed-in users
// =============================================================================
// Three separate inline cards, each with its own dismiss state:
//   1. SchoolPromptCard — asks the user to pick their school. Shown to any
//      signed-in user with no school_urn set yet. "Skip for now" only
//      hides for the current session — comes back next login because the
//      data matters.
//   2. TomWelcomeCard — personal welcome from Tom, shown to External (non-UCS)
//      users only. Includes a Leave feedback button.
//   3. ActivitiesWelcomeCard — the existing tour of tabs and activities,
//      shown to everyone.
// =============================================================================

import { useEffect, useState } from "react";
import {
  BookOpen,
  Compass,
  Crosshair,
  Dices,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  PenLine,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { SchoolPicker, type SchoolInfo } from "@/components/SchoolPicker";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const ACTIVITIES_KEY = "russia-first-login-dismissed";
const TOM_KEY = "russia-welcome-from-tom-dismissed";
// Session-scoped (sessionStorage, not localStorage) — comes back next login.
const SCHOOL_SKIP_KEY = "russia-school-prompt-skipped";

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* ignored */
  }
}

// -----------------------------------------------------------------------------
// SchoolPromptCard — ask user to pick their school
// -----------------------------------------------------------------------------
function SchoolPromptCard() {
  const { user, profile, refreshProfile } = useAuth();
  const [skipped, setSkipped] = useState(() => {
    try {
      return sessionStorage.getItem(SCHOOL_SKIP_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestTown, setRequestTown] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [requestSent, setRequestSent] = useState(false);

  // school_urn isn't in the regenerated types yet — read it via cast.
  const schoolUrn =
    (profile as { school_urn?: number | null } | null)?.school_urn ?? null;

  // Hide if: not signed in, no profile yet, school already set, or skipped this session.
  if (!user || !profile || schoolUrn != null || skipped) return null;

  async function handleSelect(urn: number, _school: SchoolInfo) {
    if (!user) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("user_profiles")
      .update({
        school_urn: urn,
        school_set_at: new Date().toISOString(),
      } as never)
      .eq("id", user.id);

    if (err) {
      console.error("[SchoolPrompt] Failed to save:", err);
      setError("Couldn't save — please try again.");
      setSaving(false);
      return;
    }
    await refreshProfile();
    // Card will hide on next render because schoolUrn !== null.
    setSaving(false);
  }

  function handleSkip() {
    setSkipped(true);
    try {
      sessionStorage.setItem(SCHOOL_SKIP_KEY, "1");
    } catch {
      /* ignored */
    }
  }

  async function handleSubmitRequest() {
    if (!user || !requestName.trim()) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("school_requests" as never)
      .insert({
        user_id: user.id,
        requested_name: requestName.trim(),
        requested_town: requestTown.trim() || null,
        notes: requestNotes.trim() || null,
      } as never);
    if (err) {
      console.error("[SchoolPrompt] Failed to submit request:", err);
      setError("Couldn't submit — please try again.");
      setSaving(false);
      return;
    }
    setRequestSent(true);
    setSaving(false);
  }

  return (
    <div className="mb-4 rounded-xl bg-primary/5 p-5 ring-1 ring-primary/10 sm:p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="font-serif text-lg font-bold text-primary">
              Which school are you at?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Helps me see who's using the app and prioritise schools with lots
              of students. Takes 5 seconds.
            </p>
          </div>
        </div>
        <button
          onClick={handleSkip}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label="Skip for now"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {requestSent ? (
        <div className="rounded-md border border-border bg-card p-3 text-sm">
          Thanks — I'll add your school to the list. Welcome aboard.
        </div>
      ) : showRequestForm ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="school-name">School name</Label>
            <Input
              id="school-name"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder="e.g. The Latymer School"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="school-town">Town / city</Label>
            <Input
              id="school-town"
              value={requestTown}
              onChange={(e) => setRequestTown(e.target.value)}
              placeholder="e.g. London"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="school-notes">Anything else? (optional)</Label>
            <Textarea
              id="school-notes"
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
              placeholder="Postcode, country if outside the UK, etc."
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={handleSubmitRequest}
              disabled={saving || !requestName.trim()}
            >
              {saving ? "Submitting…" : "Submit"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowRequestForm(false)}
              disabled={saving}
            >
              Back to search
            </Button>
          </div>
        </div>
      ) : (
        <>
          <SchoolPicker
            value={null}
            onChange={handleSelect}
            onNotListed={() => setShowRequestForm(true)}
          />
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          {saving && (
            <p className="mt-2 text-sm text-muted-foreground">Saving…</p>
          )}
          <div className="mt-3">
            <Button size="sm" variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Hook: returns true if the signed-in user is in a class with is_external_catchall
// -----------------------------------------------------------------------------
function useIsExternalStudent(): boolean | null {
  const { user } = useAuth();
  const [isExternal, setIsExternal] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsExternal(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("class_members")
        .select("class_id, classes!inner(is_external_catchall)")
        .eq("student_id", user.id)
        .eq("classes.is_external_catchall", true)
        .limit(1);
      if (cancelled) return;
      setIsExternal(!error && !!data && data.length > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return isExternal;
}

// -----------------------------------------------------------------------------
// TomWelcomeCard — personal intro + feedback invitation, external users only
// -----------------------------------------------------------------------------
function TomWelcomeCard() {
  const isExternal = useIsExternalStudent();
  const [dismissed, setDismissed] = useState(() => readDismissed(TOM_KEY));

  if (dismissed || !isExternal) return null;

  const dismiss = () => {
    setDismissed(true);
    writeDismissed(TOM_KEY);
  };

  return (
    <div className="mb-4 rounded-xl bg-muted/40 p-5 ring-1 ring-border/60 sm:p-6">
      <div className="mb-3 flex items-start justify-between">
        <h2 className="font-serif text-lg font-bold text-primary">
          A quick hello from Tom
        </h2>
        <button
          onClick={dismiss}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
        <p>
          Welcome — thanks for signing up. I'm Tom, an A-Level History teacher.
          I built this app because the revision resources out there never quite
          fit how I teach AQA 7042 — I wanted one place where students could
          properly drill their knowledge, think through the concepts, and get
          real practice evaluating extracts.
        </p>
        <p>
          It's free, open to any student sitting AQA 1H Russia, and I'm
          actively building it. If something's broken, missing, or wrong, I
          genuinely want to know — that's how it gets better.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <FeedbackDialog
          trigger={
            <Button size="sm" variant="outline" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Leave feedback
            </Button>
          }
        />
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ActivitiesWelcomeCard — existing tour, shown to everyone
// -----------------------------------------------------------------------------
function ActivitiesWelcomeCard() {
  const [dismissed, setDismissed] = useState(() => readDismissed(ACTIVITIES_KEY));

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    writeDismissed(ACTIVITIES_KEY);
  };

  return (
    <div className="mb-6 rounded-xl bg-primary/5 p-5 ring-1 ring-primary/10 sm:p-6">
      <div className="mb-3 flex items-start justify-between">
        <h2 className="font-serif text-lg font-bold text-primary">
          Welcome to Russia Compass
        </h2>
        <button
          onClick={dismiss}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Here's a quick tour so you know what's where:
      </p>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <div className="flex items-start gap-2 text-sm">
          <LayoutDashboard className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <strong className="text-foreground">Dashboard</strong> — your home
            page. Progress, recent activity, what to do next.
          </span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <strong className="text-foreground">Topics</strong> — pick a Part of
            the course, then a spec point, and drill into it.
          </span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <Compass className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <span>
            <strong className="text-foreground">General</strong> — chronology
            questions spanning the whole course, 1855–1964.
          </span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <Dices className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
          <span>
            <strong className="text-foreground">Random</strong> — can't decide?
            Let the app pick for you, or try a mixed session.
          </span>
        </div>
      </div>

      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Inside each topic, you'll find:
      </p>

      <ul className="mb-4 space-y-1.5 text-sm text-muted-foreground">
        <li className="flex items-start gap-2">
          <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            <strong className="text-foreground">Blank Recall</strong> — write
            everything you know, then see what you missed. Best way to prepare
            for essays.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
          <span>
            <strong className="text-foreground">Concept Driller</strong> — the
            "why" behind the facts. Significance, causation, analysis.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <span>
            <strong className="text-foreground">Knowledge Driller</strong> —
            rapid-fire factual recall. Names, dates, policies.
          </span>
        </li>
      </ul>

      <Button size="sm" onClick={dismiss}>
        Got it — let's go
      </Button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// FirstLoginWelcome — composes both cards
// -----------------------------------------------------------------------------
export function FirstLoginWelcome() {
  return (
    <>
      <SchoolPromptCard />
      <TomWelcomeCard />
      <ActivitiesWelcomeCard />
    </>
  );
}
