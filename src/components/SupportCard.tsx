// =============================================================================
// SupportCard — "Upgrade to Nomenklatura" prompt for free signed-in students
// =============================================================================
// Replaces the old voluntary tip-jar. Shown ONLY to signed-in users whose tier
// is 'free' (hidden for Nomenklatura / Politburo / UCS members, and for
// anonymous visitors who have no account to attribute a purchase to).
//
// Opens the Stripe Payment Link (VITE_STRIPE_MEMBERSHIP_URL) with the user's id
// as client_reference_id so the stripe-webhook grants membership to the right
// account. If the env var isn't set, the card silently doesn't render (so
// nothing breaks before Stripe go-live).
//
// Dismiss: closing writes a timestamp to localStorage; the card reappears 7 days
// later so it's gently present rather than a one-time ask.
// =============================================================================

import { useState } from "react";
import { ExternalLink, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useUserTier } from "@/hooks/useUserTier";

const DISMISS_KEY = "russia-upgrade-card-dismissed-at";
const REAPPEAR_AFTER_DAYS = 7;

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
  const { user } = useAuth();
  const { tier, loading } = useUserTier();
  const membershipUrl = import.meta.env.VITE_STRIPE_MEMBERSHIP_URL as
    | string
    | undefined;
  const [dismissed, setDismissed] = useState<boolean>(() =>
    isDismissedAndStillFresh(),
  );

  // Don't render:
  //   - if Stripe isn't wired yet (no env var)
  //   - for anonymous visitors (no account to attribute a purchase to)
  //   - while the tier is loading (avoid flicker)
  //   - for anyone who already has membership (Nomenklatura / Politburo / UCS)
  //   - if dismissed within the last 7 days
  if (!membershipUrl) return null;
  if (!user) return null;
  if (loading) return null;
  if (tier !== "free") return null;
  if (dismissed) return null;

  const dismiss = () => {
    writeDismissedAt(Date.now());
    setDismissed(true);
  };

  const upgradeUrl =
    `${membershipUrl}?client_reference_id=${encodeURIComponent(user.id)}` +
    (user.email ? `&prefilled_email=${encodeURIComponent(user.email)}` : "");

  return (
    <div className="mb-4 rounded-xl bg-amber-50/70 p-5 ring-1 ring-amber-200/70 dark:bg-amber-950/20 dark:ring-amber-800/40 sm:p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h2 className="font-serif text-base font-bold text-primary sm:text-lg">
            Keep the AI features running
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
          I'm a History teacher, and I built this on weekends to help my
          students. The whole app stays free — the questions, recall, chronology
          and extracts always will.
        </p>
        <p>
          But Potemkin and Zhukovsky use AI that costs me real money every time
          they run. I lost money on the app last year, and these features cost
          more. I'm not trying to make a profit — I just don't want to lose
          money keeping them available.
        </p>
        <p>
          If they're helping you, <strong>Nomenklatura membership</strong> gives
          you a year of much higher daily AI limits for a one-off{" "}
          <strong>£5</strong>. It keeps the lights on.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          asChild
          size="sm"
          className="gap-2 bg-amber-600 text-white hover:bg-amber-700"
        >
          <a href={upgradeUrl} target="_blank" rel="noopener noreferrer">
            Get Nomenklatura — £5
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
