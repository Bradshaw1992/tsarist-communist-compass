// =============================================================================
// TeacherFeedbackPage — /teacher/feedback
// =============================================================================
// Lists all student feedback submissions with mark-as-read/resolved controls.
// =============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  GraduationCap,
  Inbox,
  Mail,
  MessageSquare,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface FeedbackRow {
  id: string;
  user_id: string | null;
  email: string | null;
  message: string;
  page_url: string | null;
  user_agent: string | null;
  created_at: string;
  read_at: string | null;
  resolved_at: string | null;
}

type Filter = "unresolved" | "all";

const TeacherFeedbackPage = () => {
  const { isTeacher } = useAuth();
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("unresolved");

  useEffect(() => {
    if (!isTeacher) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      let q = supabase
        .from("user_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (filter === "unresolved") q = q.is("resolved_at", null);

      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        console.error(error);
        setItems([]);
      } else {
        setItems(data ?? []);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isTeacher, filter]);

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from("user_feedback")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, read_at: new Date().toISOString() } : it))
      );
    }
  };

  const markResolved = async (id: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("user_feedback")
      .update({ resolved_at: now, read_at: now })
      .eq("id", id);
    if (!error) {
      if (filter === "unresolved") {
        setItems((prev) => prev.filter((it) => it.id !== id));
      } else {
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, resolved_at: now, read_at: now } : it
          )
        );
      }
    }
  };

  if (!isTeacher) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <GraduationCap className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">
          You don't have teacher access.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <SEOHead
        title="Feedback | Teacher Dashboard"
        description="Student feedback submissions."
        canonicalPath="/teacher/feedback"
      />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-6">
          <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
            <Link to="/teacher" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to teacher dashboard
            </Link>
          </Button>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Teacher
          </div>
          <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight">
            Feedback
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Student submissions from the feedback modal. Mark as resolved once
            handled.
          </p>
        </header>

        <div className="mb-4 flex gap-2">
          <Button
            size="sm"
            variant={filter === "unresolved" ? "default" : "outline"}
            onClick={() => setFilter("unresolved")}
          >
            Unresolved
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              {filter === "unresolved"
                ? "No unresolved feedback. Nice work."
                : "No feedback yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={item.id}
                className={`rounded-lg border p-4 shadow-sm ${
                  item.read_at ? "bg-background" : "bg-primary/5 border-primary/30"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>
                      {formatDistanceToNow(new Date(item.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                    {item.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <a
                          href={`mailto:${item.email}`}
                          className="hover:text-primary underline"
                        >
                          {item.email}
                        </a>
                      </span>
                    )}
                    {item.page_url && (
                      <span className="text-muted-foreground/70">
                        on {item.page_url}
                      </span>
                    )}
                    {!item.user_id && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                        anonymous
                      </span>
                    )}
                  </div>
                </div>

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {item.message}
                </p>

                <div className="mt-3 flex items-center justify-end gap-2">
                  {!item.read_at && !item.resolved_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => markRead(item.id)}
                      className="gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Mark read
                    </Button>
                  )}
                  {!item.resolved_at ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markResolved(item.id)}
                      className="gap-1.5"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark resolved
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Resolved
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherFeedbackPage;
