// =============================================================================
// ReviewPage
// =============================================================================
// The persistent wrong-answers queue. Anything the student has missed in a
// Knowledge or Concept Driller session (and not yet resolved) lives here
// grouped by specification point. Two actions per row:
//
//   • "I know this now" — marks the row resolved, removes from list.
//   • "Drill this topic" — jumps into the Knowledge Driller for that spec,
//     where the question is still in the pool and getting it right in a
//     future session will auto-resolve via recordAssessment.
//
// Requires a signed-in user — anonymous mode shows a sign-in CTA instead.
// =============================================================================

import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWrongAnswers, type WrongAnswer } from "@/hooks/useWrongAnswers";
import { useSpecPoints } from "@/hooks/useRevisionData";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOHead } from "@/components/SEOHead";
import {
  ArrowLeft, BookOpen, CheckCircle2, ClipboardList, Crosshair, Zap,
} from "lucide-react";

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

const ReviewPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { items, loading, resolveById } = useWrongAnswers();
  const specPoints = useSpecPoints();
  const navigate = useNavigate();

  const specTitleById = useMemo(() => {
    const m = new Map<number, string>();
    for (const sp of specPoints) m.set(sp.id, sp.title);
    return m;
  }, [specPoints]);

  // Group the queue by spec_id, preserving insertion order (most recent first).
  const groups = useMemo(() => {
    const bySpec = new Map<number, WrongAnswer[]>();
    const orphans: WrongAnswer[] = [];
    for (const w of items) {
      if (w.spec_id == null) {
        orphans.push(w);
        continue;
      }
      const list = bySpec.get(w.spec_id) ?? [];
      list.push(w);
      bySpec.set(w.spec_id, list);
    }
    // Sort groups by spec_id asc so they read top-to-bottom through the course.
    const ordered = Array.from(bySpec.entries()).sort(([a], [b]) => a - b);
    return { ordered, orphans };
  }, [items]);

  const pageShell = (body: React.ReactNode) => (
    <div className="min-h-screen bg-background pb-16">
      <SEOHead
        title="Review Queue | AQA 1H Russia Compass"
        description="Persistent wrong-answers queue. Every missed Knowledge or Concept Driller question, grouped by spec point, so you can close the loop."
        canonicalPath="/review"
      />
      <header className="border-b border-border bg-card px-6 py-10 text-center sm:py-14">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-widest text-accent">
            <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
            Review Queue
          </div>
          <h1 className="font-serif text-3xl font-bold text-primary sm:text-4xl">
            Questions to Review
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Anything you've missed in a Knowledge or Concept Driller session
            lives here until you've closed the loop.
          </p>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to topics
          </Button>
        </div>
        {body}
      </section>
    </div>
  );

  if (authLoading) {
    return pageShell(
      <div className="py-16 text-center text-muted-foreground">Loading…</div>
    );
  }

  if (!user) {
    return pageShell(
      <Card className="mx-auto max-w-xl border-2 shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <ClipboardList className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-serif text-xl font-bold text-primary">
            Sign in to use the Review Queue
          </h2>
          <p className="text-sm text-muted-foreground">
            The Review Queue tracks every question you've missed across sessions.
            Progress is tied to your account, so you'll need to sign in before
            it can keep a record.
          </p>
          <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Link to="/login">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return pageShell(
      <div className="py-16 text-center text-muted-foreground">
        Fetching your review queue…
      </div>
    );
  }

  if (items.length === 0) {
    return pageShell(
      <Card className="mx-auto max-w-xl border-2 shadow-sm">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-serif text-xl font-bold text-primary">Nothing to review</h2>
          <p className="text-sm text-muted-foreground">
            Your queue is empty — either you've been nailing every question, or
            you haven't started yet. Head back and run a driller session.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Back to topics</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return pageShell(
    <div className="space-y-8">
      <div className="rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
        <strong className="font-semibold text-foreground">
          {items.length} question{items.length === 1 ? "" : "s"}
        </strong>{" "}
        across{" "}
        <strong className="font-semibold text-foreground">
          {groups.ordered.length} topic{groups.ordered.length === 1 ? "" : "s"}
        </strong>
        . Click <em>I know this now</em> to clear an item, or <em>Drill this topic</em> to
        drop back into the driller and let a correct answer resolve it automatically.
      </div>

      {groups.ordered.map(([specId, rows]) => {
        const title = specTitleById.get(specId) ?? `Topic ${specId}`;
        return (
          <div key={specId} className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-lg font-semibold text-primary">
                <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                  {specId}
                </span>
                {title}
              </h2>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <Link to={`/?topic=${specId}`}>
                  Drill this topic →
                </Link>
              </Button>
            </div>
            <div className="space-y-2">
              {rows.map((w) => (
                <WrongAnswerRow
                  key={w.id}
                  row={w}
                  onResolve={() => void resolveById(w.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {groups.orphans.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-serif text-lg font-semibold text-primary">Uncategorised</h2>
          <div className="space-y-2">
            {groups.orphans.map((w) => (
              <WrongAnswerRow
                key={w.id}
                row={w}
                onResolve={() => void resolveById(w.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewPage;

function WrongAnswerRow({
  row,
  onResolve,
}: {
  row: WrongAnswer;
  onResolve: () => void;
}) {
  const isFact = row.question_table === "fact_questions";
  const Icon = isFact ? Zap : Crosshair;
  return (
    <Card className="border-border">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Icon className="h-3 w-3 text-accent" />
            {isFact ? "Knowledge Driller" : "Concept Driller"}
            <span className="text-muted-foreground/60">·</span>
            <span className="font-normal normal-case tracking-normal">
              missed {formatRelativeTime(row.missed_at)}
            </span>
          </div>
          <p className="font-serif text-sm font-medium leading-relaxed text-foreground">
            {row.snapshot.question || <em className="text-muted-foreground">(no question text)</em>}
          </p>
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <p className="text-xs leading-relaxed text-foreground/80">
              {row.snapshot.answer || <em className="text-muted-foreground">(no answer stored)</em>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 sm:flex-col">
          <Button
            size="sm"
            variant="outline"
            onClick={onResolve}
            className="gap-1.5 whitespace-nowrap"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            I know this now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
