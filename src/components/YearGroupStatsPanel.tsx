// =============================================================================
// YearGroupStatsPanel — teacher dashboard breakdown of users by year group
// =============================================================================
// Calls the year_group_stats() RPC, which returns rows like:
//   { school_bucket: 'ucs' | 'external', year_group: 'year_12'|'year_13'|
//                                                    'left_school'|'declined'|
//                                                    'unknown'|'pre_year_12',
//     n: bigint }
// We render a compact table: rows = year groups, columns = UCS / External.
// =============================================================================

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  school_bucket: "ucs" | "external";
  year_group: string;
  n: number;
};

const YEAR_GROUP_LABELS: Array<{ key: string; label: string }> = [
  { key: "year_12", label: "Year 12" },
  { key: "year_13", label: "Year 13" },
  { key: "left_school", label: "Left school" },
  { key: "declined", label: "Prefer not to say" },
  { key: "unknown", label: "Not yet answered" },
];

export function YearGroupStatsPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("year_group_stats" as never);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        return;
      }
      const normalised: Row[] = (data as { school_bucket: string; year_group: string; n: number | string }[]).map((r) => ({
        school_bucket: r.school_bucket as Row["school_bucket"],
        year_group: r.year_group,
        n: typeof r.n === "string" ? parseInt(r.n, 10) : r.n,
      }));
      setRows(normalised);
    })();
    return () => { cancelled = true; };
  }, []);

  const lookup = (bucket: "ucs" | "external", yg: string): number => {
    if (!rows) return 0;
    const found = rows.find((r) => r.school_bucket === bucket && r.year_group === yg);
    return found?.n ?? 0;
  };

  const totalUcs = rows?.filter((r) => r.school_bucket === "ucs").reduce((s, r) => s + r.n, 0) ?? 0;
  const totalExt = rows?.filter((r) => r.school_bucket === "external").reduce((s, r) => s + r.n, 0) ?? 0;

  return (
    <section className="mb-6 rounded-xl bg-card p-5 shadow-card ring-1 ring-border/60">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h2 className="font-serif text-base font-bold text-primary">Users by year group</h2>
      </div>

      {error && (
        <p className="text-sm text-destructive">Couldn't load stats: {error}</p>
      )}

      {!error && !rows && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {!error && rows && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 text-left font-medium"> </th>
                <th className="py-2 text-right font-medium">UCS</th>
                <th className="py-2 text-right font-medium">External</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {YEAR_GROUP_LABELS.map(({ key, label }) => {
                const ucs = lookup("ucs", key);
                const ext = lookup("external", key);
                return (
                  <tr key={key} className="border-b border-border/50 last:border-0">
                    <td className="py-2 text-foreground">{label}</td>
                    <td className="py-2 text-right tabular-nums">{ucs}</td>
                    <td className="py-2 text-right tabular-nums">{ext}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{ucs + ext}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-border bg-muted/30">
                <td className="py-2 font-semibold text-foreground">Total</td>
                <td className="py-2 text-right font-semibold tabular-nums">{totalUcs}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{totalExt}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{totalUcs + totalExt}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
