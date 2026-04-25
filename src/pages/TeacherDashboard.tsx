// =============================================================================
// TeacherDashboard — class management at /teacher
// =============================================================================
// Shows the teacher's classes with member counts, a "create class" form, and
// join codes for sharing. Click a class → /teacher/class/:classId for the
// student roster and per-student stats.
// =============================================================================

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2,
  ChevronRight,
  Copy,
  FileQuestion,
  GraduationCap,
  MessageSquare,
  Plus,
  Users,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useTeacherClasses } from "@/hooks/useTeacherData";

const TeacherDashboard = () => {
  const { isTeacher, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { classes, loading, createClass } = useTeacherClasses();

  const [showCreate, setShowCreate] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isTeacher && !isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <GraduationCap className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">
          You don't have teacher access. If you should, ask your admin to
          promote your account.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const handleCreate = async () => {
    const name = newClassName.trim();
    if (!name) return;
    setCreating(true);
    const result = await createClass(name);
    setCreating(false);
    if (result) {
      setNewClassName("");
      setShowCreate(false);
    }
  };

  const copyCode = (classId: string, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(classId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div>
      <SEOHead
        title="Teacher Dashboard | AQA 1H Russia Compass"
        description="Manage your classes and monitor student progress."
        canonicalPath="/teacher"
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Teacher Dashboard
          </div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-primary sm:text-3xl">
            Your classes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create classes, share join codes, and monitor how your students are
            doing.
          </p>
        </header>

        {/* Create class */}
        <section className="mb-6">
          {showCreate ? (
            <div className="rounded-xl bg-card p-5 shadow-card ring-1 ring-border/60">
              <h2 className="mb-3 font-serif text-base font-bold text-primary">
                Create a new class
              </h2>
              <div className="flex gap-2">
                <Input
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. 12A Russia"
                  className="max-w-xs"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
                <Button onClick={handleCreate} disabled={creating || !newClassName.trim()}>
                  {creating ? "Creating…" : "Create"}
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreate(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Create class
              </Button>
              {isAdmin && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/teacher/questions")}
                    className="gap-2"
                  >
                    <FileQuestion className="h-4 w-4" />
                    Question pipeline
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/teacher/feedback")}
                    className="gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Feedback
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/admin/schools")}
                    className="gap-2"
                  >
                    <Building2 className="h-4 w-4" />
                    Schools
                  </Button>
                </>
              )}
            </div>
          )}
        </section>

        {/* Class list */}
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Loading classes…
          </div>
        ) : classes.length === 0 ? (
          <div className="rounded-xl bg-card p-8 text-center shadow-card ring-1 ring-border/60">
            <GraduationCap className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No classes yet. Create one and share the join code with your students.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="group flex items-center gap-4 rounded-xl bg-card p-5 shadow-card ring-1 ring-border/60 transition-all hover:shadow-card-hover hover:ring-primary/30"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => navigate(`/teacher/class/${cls.id}`)}
                    className="text-left"
                  >
                    <h3 className="font-serif text-lg font-bold text-primary group-hover:underline">
                      {cls.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {cls.memberCount} student{cls.memberCount === 1 ? "" : "s"} ·
                      Created {relativeTime(cls.createdAt)}
                    </p>
                  </button>
                </div>

                {/* Join code */}
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Join code
                    </div>
                    <div className="font-mono text-base font-bold tracking-wider text-primary">
                      {cls.joinCode}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyCode(cls.id, cls.joinCode);
                    }}
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    title="Copy join code"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  {copiedId === cls.id && (
                    <span className="text-xs font-medium text-emerald-600">
                      Copied!
                    </span>
                  )}
                </div>

                <button
                  onClick={() => navigate(`/teacher/class/${cls.id}`)}
                  className="shrink-0"
                >
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const diffD = diffMs / (1000 * 60 * 60 * 24);
  if (diffD < 1) return "today";
  if (diffD < 7) return `${Math.floor(diffD)}d ago`;
  if (diffD < 30) return `${Math.floor(diffD / 7)}w ago`;
  return `${Math.floor(diffD / 30)}mo ago`;
}

export default TeacherDashboard;
