// =============================================================================
// FirstLoginWelcome — one-time orientation cards for new signed-in users
// =============================================================================
// Two separate inline cards, each with its own dismiss state in localStorage:
//   1. TomWelcomeCard — personal welcome from Tom, shown to External (non-UCS)
//      users only. Includes a Leave feedback button.
//   2. ActivitiesWelcomeCard — the existing tour of tabs and activities,
//      shown to everyone.
// Each card disappears after dismiss and never returns on that device.
// =============================================================================

import { useEffect, useState } from "react";
import {
  BookOpen,
  Compass,
  Crosshair,
  Dices,
  LayoutDashboard,
  MessageSquare,
  PenLine,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const ACTIVITIES_KEY = "russia-first-login-dismissed";
const TOM_KEY = "russia-welcome-from-tom-dismissed";

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
          I built this app because none of the revision resources out there
          quite fit how I teach AQA 7042, and I wanted something my students
          could actually open at 10pm the night before a test.
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
      <TomWelcomeCard />
      <ActivitiesWelcomeCard />
    </>
  );
}
