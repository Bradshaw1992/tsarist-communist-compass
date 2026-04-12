// =============================================================================
// useTeacherData — hooks for the Teacher Dashboard
// =============================================================================
// Three hooks, each progressively deeper:
//
//   useTeacherClasses()       — teacher's classes + member counts
//   useClassStudents(classId) — students in a class + aggregated stats
//   useStudentDetail(userId)  — one student's full session + wrong-answer data
//
// All queries rely on Supabase RLS — the teacher can only see data for
// students in their own classes. These hooks are no-ops when the user isn't
// a teacher.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ---- Types ------------------------------------------------------------------

export interface TeacherClass {
  id: string;
  name: string;
  joinCode: string;
  createdAt: string;
  memberCount: number;
}

export interface ClassStudent {
  userId: string;
  email: string;
  displayName: string;
  fullName: string;
  joinedAt: string;
  // Aggregated stats (computed client-side from fetched data)
  sessionsCount: number;
  totalQuestions: number;
  totalCorrect: number;
  accuracyPct: number;
  blankRecallCount: number;
  wrongAnswerCount: number;
  lastActive: string | null;
}

export interface StudentSessionRow {
  id: string;
  activityType: string;
  specId: number | null;
  totalQuestions: number;
  correctCount: number;
  completedAt: string;
}

export interface StudentWrongAnswerRow {
  id: string;
  specId: number | null;
  questionSnapshot: { question: string; answer: string; spec_title?: string };
  missedAt: string;
  resolvedAt: string | null;
}

export interface StudentBlankRecallRow {
  id: string;
  specId: number;
  conceptsTotal: number;
  conceptsCovered: number;
  submittedAt: string;
}

// ---- useTeacherClasses ------------------------------------------------------

export function useTeacherClasses() {
  const { user, isTeacher } = useAuth();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchClasses = async () => {
    if (!user || !isTeacher) { setClasses([]); return; }
    setLoading(true);

    const { data, error } = await (supabase as any)
      .from("classes")
      .select("id, name, join_code, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[useTeacherClasses] fetch error:", error);
      setLoading(false);
      return;
    }

    // Get member counts per class
    const classIds = (data ?? []).map((c) => c.id);
    let memberCounts: Record<string, number> = {};

    if (classIds.length > 0) {
      const { data: members } = await (supabase as any)
        .from("class_members")
        .select("class_id")
        .in("class_id", classIds);

      if (members) {
        for (const m of members) {
          memberCounts[m.class_id] = (memberCounts[m.class_id] ?? 0) + 1;
        }
      }
    }

    setClasses(
      (data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        joinCode: c.join_code,
        createdAt: c.created_at,
        memberCount: memberCounts[c.id] ?? 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchClasses();
  }, [user, isTeacher]);

  const createClass = async (name: string): Promise<TeacherClass | null> => {
    if (!user || !isTeacher) return null;

    // Generate a simple 6-char join code
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await (supabase as any)
      .from("classes")
      .insert({
        teacher_id: user.id,
        name,
        join_code: joinCode,
      })
      .select("id, name, join_code, created_at")
      .single();

    if (error) {
      console.error("[useTeacherClasses] create error:", error);
      return null;
    }

    const newClass: TeacherClass = {
      id: data.id,
      name: data.name,
      joinCode: data.join_code,
      createdAt: data.created_at,
      memberCount: 0,
    };

    setClasses((prev) => [newClass, ...prev]);
    return newClass;
  };

  return { classes, loading, createClass, refetch: fetchClasses };
}

// ---- useClassStudents -------------------------------------------------------

export function useClassStudents(classId: string | undefined) {
  const { user, isTeacher } = useAuth();
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !isTeacher || !classId) {
      setStudents([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      // 1. Get members + profiles
      const { data: members, error: membersErr } = await (supabase as any)
        .from("class_members")
        .select("student_id, joined_at")
        .eq("class_id", classId);

      if (cancelled) return;
      if (membersErr || !members || members.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const studentIds = members.map((m) => m.student_id);

      // 2. Profiles
      const { data: profiles } = await (supabase as any)
        .from("user_profiles")
        .select("id, email, display_name, full_name")
        .in("id", studentIds);

      if (cancelled) return;

      const profileMap = new Map(
        (profiles ?? []).map((p: any) => [p.id, p])
      );

      // 3. Sessions per student
      const { data: sessions } = await (supabase as any)
        .from("user_sessions")
        .select("user_id, total_questions, correct_count, completed_at")
        .in("user_id", studentIds)
        .not("completed_at", "is", null);

      if (cancelled) return;

      // 4. Blank recalls per student
      const { data: recalls } = await (supabase as any)
        .from("user_blank_recalls")
        .select("user_id, submitted_at")
        .in("user_id", studentIds);

      if (cancelled) return;

      // 5. Wrong answers per student (unresolved)
      const { data: wrongs } = await (supabase as any)
        .from("user_wrong_answers")
        .select("user_id")
        .in("user_id", studentIds)
        .is("resolved_at", null);

      if (cancelled) return;

      // Aggregate
      const sessionAgg = new Map<
        string,
        { count: number; total: number; correct: number; lastAt: string }
      >();
      for (const s of sessions ?? []) {
        const prev = sessionAgg.get(s.user_id) ?? {
          count: 0, total: 0, correct: 0, lastAt: "",
        };
        prev.count += 1;
        prev.total += s.total_questions ?? 0;
        prev.correct += s.correct_count ?? 0;
        if (s.completed_at && s.completed_at > prev.lastAt) {
          prev.lastAt = s.completed_at;
        }
        sessionAgg.set(s.user_id, prev);
      }

      const recallCounts = new Map<string, { count: number; lastAt: string }>();
      for (const r of recalls ?? []) {
        const prev = recallCounts.get(r.user_id) ?? { count: 0, lastAt: "" };
        prev.count += 1;
        if (r.submitted_at && r.submitted_at > prev.lastAt) {
          prev.lastAt = r.submitted_at;
        }
        recallCounts.set(r.user_id, prev);
      }

      const wrongCounts = new Map<string, number>();
      for (const w of wrongs ?? []) {
        wrongCounts.set(w.user_id, (wrongCounts.get(w.user_id) ?? 0) + 1);
      }

      const joinedMap = new Map(
        members.map((m) => [m.student_id, m.joined_at])
      );

      const result: ClassStudent[] = studentIds.map((uid) => {
        const p = profileMap.get(uid) as any;
        const sa = sessionAgg.get(uid);
        const rc = recallCounts.get(uid);
        const wc = wrongCounts.get(uid) ?? 0;

        const lastSession = sa?.lastAt ?? "";
        const lastRecall = rc?.lastAt ?? "";
        const lastActive =
          lastSession > lastRecall ? lastSession : lastRecall || null;

        return {
          userId: uid,
          email: p?.email ?? "",
          displayName: p?.display_name ?? "",
          fullName: p?.full_name ?? "",
          joinedAt: joinedMap.get(uid) ?? "",
          sessionsCount: (sa?.count ?? 0) + (rc?.count ?? 0),
          totalQuestions: sa?.total ?? 0,
          totalCorrect: sa?.correct ?? 0,
          accuracyPct:
            sa && sa.total > 0
              ? Math.round((sa.correct / sa.total) * 100)
              : 0,
          blankRecallCount: rc?.count ?? 0,
          wrongAnswerCount: wc,
          lastActive,
        };
      });

      // Sort by last active (most recent first), then name
      result.sort((a, b) => {
        if (a.lastActive && b.lastActive)
          return b.lastActive.localeCompare(a.lastActive);
        if (a.lastActive) return -1;
        if (b.lastActive) return 1;
        return (a.displayName || a.email).localeCompare(
          b.displayName || b.email
        );
      });

      setStudents(result);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isTeacher, classId]);

  return { students, loading };
}

// ---- useStudentDetail -------------------------------------------------------

export function useStudentDetail(studentId: string | undefined) {
  const { user, isTeacher } = useAuth();
  const [sessions, setSessions] = useState<StudentSessionRow[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<StudentWrongAnswerRow[]>([]);
  const [blankRecalls, setBlankRecalls] = useState<StudentBlankRecallRow[]>([]);
  const [profile, setProfile] = useState<{
    email: string;
    displayName: string;
    fullName: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !isTeacher || !studentId) {
      setSessions([]);
      setWrongAnswers([]);
      setBlankRecalls([]);
      setProfile(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const [sessResult, wrongResult, recallResult, profileResult] =
        await Promise.all([
          (supabase as any)
            .from("user_sessions")
            .select(
              "id, activity_type, spec_id, total_questions, correct_count, completed_at"
            )
            .eq("user_id", studentId)
            .not("completed_at", "is", null)
            .order("completed_at", { ascending: false })
            .limit(100),
          (supabase as any)
            .from("user_wrong_answers")
            .select(
              "id, spec_id, question_snapshot, missed_at, resolved_at"
            )
            .eq("user_id", studentId)
            .order("missed_at", { ascending: false })
            .limit(200),
          (supabase as any)
            .from("user_blank_recalls")
            .select(
              "id, spec_id, concepts_total, concepts_covered, submitted_at"
            )
            .eq("user_id", studentId)
            .order("submitted_at", { ascending: false })
            .limit(100),
          (supabase as any)
            .from("user_profiles")
            .select("email, display_name, full_name")
            .eq("id", studentId)
            .maybeSingle(),
        ]);

      if (cancelled) return;

      if (sessResult.data) {
        setSessions(
          sessResult.data.map((r) => ({
            id: r.id,
            activityType: r.activity_type,
            specId: r.spec_id,
            totalQuestions: r.total_questions ?? 0,
            correctCount: r.correct_count ?? 0,
            completedAt: r.completed_at ?? "",
          }))
        );
      }

      if (wrongResult.data) {
        setWrongAnswers(
          wrongResult.data.map((r) => {
            const snap = r.question_snapshot as unknown as {
              question?: string;
              answer?: string;
              spec_title?: string;
            } | null;
            return {
              id: r.id,
              specId: r.spec_id,
              questionSnapshot: {
                question: snap?.question ?? "",
                answer: snap?.answer ?? "",
                spec_title: snap?.spec_title,
              },
              missedAt: r.missed_at,
              resolvedAt: r.resolved_at,
            };
          })
        );
      }

      if (recallResult.data) {
        setBlankRecalls(
          recallResult.data.map((r) => ({
            id: r.id,
            specId: r.spec_id,
            conceptsTotal: r.concepts_total ?? 0,
            conceptsCovered: r.concepts_covered ?? 0,
            submittedAt: r.submitted_at,
          }))
        );
      }

      if (profileResult.data) {
        setProfile({
          email: profileResult.data.email ?? "",
          displayName: profileResult.data.display_name ?? "",
          fullName: profileResult.data.full_name ?? "",
        });
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isTeacher, studentId]);

  // Per-spec aggregates for the student
  const specBreakdown = useMemo(() => {
    const map = new Map<
      number,
      { sessions: number; total: number; correct: number; lastAt: string }
    >();
    for (const s of sessions) {
      if (s.specId == null) continue;
      const prev = map.get(s.specId) ?? {
        sessions: 0, total: 0, correct: 0, lastAt: "",
      };
      prev.sessions += 1;
      prev.total += s.totalQuestions;
      prev.correct += s.correctCount;
      if (s.completedAt > prev.lastAt) prev.lastAt = s.completedAt;
      map.set(s.specId, prev);
    }
    return map;
  }, [sessions]);

  const unresolvedWrongAnswers = useMemo(
    () => wrongAnswers.filter((w) => !w.resolvedAt),
    [wrongAnswers]
  );

  return {
    profile,
    sessions,
    wrongAnswers,
    unresolvedWrongAnswers,
    blankRecalls,
    specBreakdown,
    loading,
  };
}
