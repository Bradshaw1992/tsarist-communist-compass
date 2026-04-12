// =============================================================================
// FirstLoginWelcome — one-time orientation card for new signed-in users
// =============================================================================
// Shown on the Dashboard after first sign-in. Walks the student through the
// four tabs and five activity types in ~30 seconds of reading. Dismissed via
// a button, stored in localStorage so it never returns.
//
// The card is warm and informational — no pop-up modal, no blocking overlay.
// It sits inline in the Dashboard flow so the student can scroll past it.
// =============================================================================

import { useState } from "react";
import {
  BookOpen,
  Compass,
  Crosshair,
  Dices,
  LayoutDashboard,
  PenLine,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "russia-first-login-dismissed";

function isDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function FirstLoginWelcome() {
  const [dismissed, setDismissed] = useState(isDismissed);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignored
    }
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
