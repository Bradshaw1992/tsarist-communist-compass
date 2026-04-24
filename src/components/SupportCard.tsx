// =============================================================================
// SupportCard — voluntary "chip in" tip jar for non-UCS users
// =============================================================================
// Shown to anonymous visitors and external (non-UCS) signed-in students.
// Never shown to UCS students. Links to a Stripe Payment Link configured via
// the VITE_STRIPE_TIP_URL environment variable; if the env var isn't set,
// the card silently doesn't render (so nothing breaks during Stripe setup).
//
// Dismiss behaviour: closing the card writes a timestamp to localStorage;
// the card reappears 30 days later so it's gently present rather than a
// one-time ask.
// =============================================================================

import { useState } from "react";
import { ExternalLink, Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShouldShowSupport } from "@/hooks/useShouldShowSupport";

const DISMISS_KEY = "russia-support-card-dismissed-at";
const REAPPEAR_AFTER_DAYS = 30;

function readDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeDismissedAt(ts: number) {
  try {
    localStorage.setItem(DISMISS_KEY, String(ts));
  } catch {
    /* ignored */
  }
}

function isDismissedAndStillFresh(): boolean {
  const ts = readDismissedAt();
  if (ts == null) return false;
  const ageMs = Date.now() - ts;
  const maxAgeMs = REAPPEAR_AFTER_DAYS * 24 * 60 * 60 * 1000;
  return ageMs < maxAgeMs;
}

export function SupportCard() {
  const tipUrl = import.meta.env.VITE_STRIPE_TIP_URL as string | undefined;
  const visibility = useShouldShowSupport();
  const [dismissed, setDismissed] = useState<boolean>(() =>
    isDismissedAndStillFresh(),
  );

  // Don't render:
  //   - if Stripe isn't set up yet (no env var)
  //   - if user is a confirmed in-school student
  //   - if they've dismissed within the last 30 days
  //   - while membership lookup is pending (avoid flicker)
  if (!tipUrl) return null;
  if (visibility !== "show") return null;
  if (dismissed) return null;

  const dismiss = () => {
    writeDismissedAt(Date.now());
    setDismissed(true);
  };

  return (
    <div className="mb-4 rounded-xl bg-rose-50/60 p-5 ring-1 ring-rose-200/60 dark:bg-rose-950/20 dark:ring-rose-800/40 sm:p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          <h2 className="font-serif text-base font-bold text-primary sm:text-lg">
            This app costs real money to run
          </h2>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
        <p>
          I'm a History teacher. I built this on weekends because nothing out
          there quite fit how I teach AQA 7042, and I've been thrilled by the
          uptake — students from beyond my own school are signing up every
          day.
        </p>
        <p>
          But with more users, hosting and especially the AI features are
          starting to cost me a meaningful amount each day. If the app's been
          useful, you can chip in toward the running costs below. Completely
          voluntary — everything stays free either way.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          asChild
          size="sm"
          className="gap-2 bg-rose-600 text-white hover:bg-rose-700"
        >
          <a href={tipUrl} target="_blank" rel="noopener noreferrer">
            Chip in
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Not now
        </Button>
      </div>
    </div>
  );
}
