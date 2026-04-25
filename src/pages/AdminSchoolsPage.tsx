// =============================================================================
// AdminSchoolsPage — live "which schools are using the app" view
// =============================================================================
// Pulls user_profiles + their joined school, aggregates by school_urn, and
// renders a sortable table. Also surfaces pending school_requests for triage.
// Admin-only (single-email gate via is_admin() in Postgres + isAdmin in
// AuthContext).
//
// Refreshes on mount and via the Refresh button — no auto-polling.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowDownUp,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface UserRow {
  school_urn: number | null;
  school_set_at: string | null;
}

interface SchoolMeta {
  urn: number;
  name: string;
  town: string | null;
  postcode: string | null;
}

interface SchoolRequestRow {
  id: string;
  requested_name: string;
  requested_town: string | null;
  notes: string | null;
  created_at: string;
}

interface SchoolAgg {
  urn: number;
  name: string;
  town: string | null;
  postcode: string | null;
  users: number;
  recent: number; // last 30 days
  latest: string | null;
}

type SortKey = "users" | "recent" | "name" | "latest";

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const AdminSchoolsPage = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [schools, setSchools] = useState<Map<number, SchoolMeta>>(new Map());
  const [requests, setRequests] = useState<SchoolRequestRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("users");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // 1. All user_profiles (school_urn may be null)
      const { data: userData, error: userErr } = await supabase
        .from("user_profiles")
        .select("school_urn, school_set_at" as never);
      if (userErr) throw userErr;

      // 2. All schools that any user has picked
      const urns = Array.from(
        new Set(
          (userData as unknown as UserRow[])
            .map((u) => u.school_urn)
            .filter((u): u is number => u != null)
        )
      );

      let schoolMap = new Map<number, SchoolMeta>();
      if (urns.length > 0) {
        const { data: schoolData, error: schoolErr } = await supabase
          .from("schools" as never)
          .select("urn, name, town, postcode")
          .in("urn", urns);
        if (schoolErr) throw schoolErr;
        for (const s of (schoolData ?? []) as unknown as SchoolMeta[]) {
          schoolMap.set(s.urn, s);
        }
      }

      // 3. Pending school_requests
      const { data: reqData, error: reqErr } = await supabase
        .from("school_requests" as never)
        .select("id, requested_name, requested_town, notes, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (reqErr) throw reqErr;

      setUsers(userData as unknown as UserRow[]);
      setSchools(schoolMap);
      setRequests((reqData ?? []) as unknown as SchoolRequestRow[]);
    } catch (e) {
      console.error("[TeacherSchools] load failed:", e);
      setError("Couldn't load schools data — check the console.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const stats = useMemo(() => {
    const total = users.length;
    const picked = users.filter((u) => u.school_urn != null).length;
    const distinct = new Set(
      users.map((u) => u.school_urn).filter((u): u is number => u != null)
    ).size;
    return {
      total,
      picked,
      pct: total ? Math.round((100 * picked) / total) : 0,
      distinct,
    };
  }, [users]);

  const aggregated = useMemo(() => {
    const map = new Map<number, SchoolAgg>();
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    for (const u of users) {
      if (u.school_urn == null) continue;
      const meta = schools.get(u.school_urn);
      const existing = map.get(u.school_urn) ?? {
        urn: u.school_urn,
        name: meta?.name ?? `URN ${u.school_urn}`,
        town: meta?.town ?? null,
        postcode: meta?.postcode ?? null,
        users: 0,
        recent: 0,
        latest: null,
      };
      existing.users += 1;
      if (u.school_set_at) {
        const t = new Date(u.school_set_at).getTime();
        if (t >= cutoff) existing.recent += 1;
        if (!existing.latest || u.school_set_at > existing.latest) {
          existing.latest = u.school_set_at;
        }
      }
      map.set(u.school_urn, existing);
    }
    const list = Array.from(map.values());
    list.sort((a, b) => {
      const dir = sortDir === "desc" ? -1 : 1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "users") return (a.users - b.users) * dir;
      if (sortKey === "recent") return (a.recent - b.recent) * dir;
      // latest
      const at = a.latest ? new Date(a.latest).getTime() : 0;
      const bt = b.latest ? new Date(b.latest).getTime() : 0;
      return (at - bt) * dir;
    });
    return list;
  }, [users, schools, sortKey, sortDir]);

  function setSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <GraduationCap className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Admin access required.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <SEOHead
        title="Schools | Admin"
        description="Which schools are using the app."
        canonicalPath="/admin/schools"
      />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-6">
          <Link
            to="/teacher"
            className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Teacher Dashboard
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-serif text-2xl font-bold text-primary">
                Schools
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Live view of which schools your users come from.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Top-line stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total users" value={stats.total} />
          <StatCard
            label="With school"
            value={`${stats.picked}`}
            sub={`${stats.pct}%`}
          />
          <StatCard label="Distinct schools" value={stats.distinct} />
          <StatCard label="Pending requests" value={requests.length} />
        </div>

        {/* Schools table */}
        <section className="mb-8">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <SortHeader
                    label="School"
                    active={sortKey === "name"}
                    dir={sortDir}
                    onClick={() => setSort("name")}
                    align="left"
                  />
                  <th className="px-3 py-2 text-left font-medium">Town</th>
                  <SortHeader
                    label="Users"
                    active={sortKey === "users"}
                    dir={sortDir}
                    onClick={() => setSort("users")}
                  />
                  <SortHeader
                    label="Last 30d"
                    active={sortKey === "recent"}
                    dir={sortDir}
                    onClick={() => setSort("recent")}
                  />
                  <SortHeader
                    label="Latest"
                    active={sortKey === "latest"}
                    dir={sortDir}
                    onClick={() => setSort("latest")}
                  />
                </tr>
              </thead>
              <tbody>
                {loading && aggregated.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : aggregated.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No schools picked yet.
                    </td>
                  </tr>
                ) : (
                  aggregated.map((s) => (
                    <tr key={s.urn} className="border-t border-border/60">
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {s.town ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.users}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.recent || ""}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                        {s.latest ? formatRelative(s.latest) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pending school requests */}
        <section>
          <h2 className="mb-3 font-serif text-lg font-semibold text-primary">
            Pending "school not listed" requests
          </h2>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing to triage.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Town</th>
                    <th className="px-3 py-2 text-left font-medium">Notes</th>
                    <th className="px-3 py-2 text-right font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-t border-border/60 align-top">
                      <td className="px-3 py-2 font-medium">{r.requested_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.requested_town ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.notes ?? ""}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                        {formatRelative(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {requests.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              To resolve: find the school's URN in the schools table, then in
              the SQL editor:
              <code className="ml-1 rounded bg-muted px-1 py-0.5">
                UPDATE school_requests SET status='matched', matched_urn=…,
                resolved_at=now() WHERE id='…';
              </code>
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

// ---- helpers ---------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-2xl font-semibold">{value}</div>
        {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "right",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 font-medium ${align === "left" ? "text-left" : "text-right"}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {label}
        <ArrowDownUp className="h-3 w-3 opacity-60" />
        {active && (
          <span className="text-[9px]">{dir === "desc" ? "▼" : "▲"}</span>
        )}
      </button>
    </th>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export default AdminSchoolsPage;
