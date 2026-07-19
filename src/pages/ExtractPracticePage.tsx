// =============================================================================
// ExtractPracticePage — landing page at /extracts
// =============================================================================
// Shows available extract sets grouped by Part. Each card shows the topic,
// date range, and number of extracts. Clicking a card navigates to the
// practice session for that extract set.
//
// This is the AQA Section A practice tool: students read historian extracts,
// identify arguments + sub-arguments, write evaluation notes, then reveal
// the indicative content to self-mark.
// =============================================================================

import { useNavigate } from "react-router-dom";
import { FileText, BookMarked, Flame } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { useAllExtractSets, useExtractSetsLoading } from "@/hooks/useExtracts";

const PART_LABELS: Record<number, string> = {
  1: "Part 1 · Trying to Preserve Autocracy, 1855–1894",
  2: "Part 2 · The Collapse of Autocracy, 1894–1917",
  3: "Part 3 · Revolution & Dictatorship, 1917–1941",
  4: "Part 4 · Stalin's Dictatorship & Reaction, 1941–1964",
};

const ExtractPracticePage = () => {
  const navigate = useNavigate();
  const allSets = useAllExtractSets();
  const loading = useExtractSetsLoading();

  // Split standard vs challenge tier
  const standardSets = allSets.filter((s) => !s.is_challenge);
  const challengeSets = allSets.filter((s) => s.is_challenge);

  // Group standard sets by part
  const byPart = new Map<number, typeof standardSets>();
  for (const s of standardSets) {
    const list = byPart.get(s.part_number) ?? [];
    list.push(s);
    byPart.set(s.part_number, list);
  }
  const parts = [...byPart.entries()].sort(([a], [b]) => a - b);

  return (
    <div>
      <SEOHead
        title="Extract Practice | Russia Revision"
        description="Practise Section A extract questions for Tsarist and Communist Russia 1855–1964. Read historian extracts, identify arguments, and self-mark against indicative content."
        canonicalPath="/extracts"
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15">
              <BookMarked className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
            </span>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              AQA Section A · 30 marks
            </div>
          </div>
          <h1 className="mt-3 max-w-3xl font-serif text-2xl font-bold leading-tight text-primary sm:text-3xl">
            Extract Practice
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Read three historian extracts, identify their arguments and
            sub-arguments, then evaluate them using your own knowledge.
            Reveal the indicative content to self-mark.
          </p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            {loading
              ? "Loading extract sets…"
              : `${standardSets.length} extract set${standardSets.length === 1 ? "" : "s"}${challengeSets.length > 0 ? ` · ${challengeSets.length} challenge extract${challengeSets.length === 1 ? "" : "s"}` : ""}`}
          </p>
        </header>

        {/* Sets grouped by Part */}
        {parts.map(([partNum, partSets]) => (
          <section key={partNum} className="mb-8">
            <h2 className="mb-3 font-serif text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {PART_LABELS[partNum] ?? `Part ${partNum}`}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {partSets.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/extracts/${s.id}`)}
                  className="group flex flex-col gap-3 rounded-xl bg-indigo-50/60 p-5 text-left shadow-card ring-1 ring-indigo-200/60 transition-all hover:-translate-y-0.5 hover:bg-indigo-50 hover:shadow-card-hover dark:bg-indigo-950/20 dark:ring-indigo-800/40"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h3 className="font-serif text-base font-bold text-primary">
                    {s.topic}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {s.date_range} · {s.extracts.length} extract{s.extracts.length === 1 ? "" : "s"} from{" "}
                    {s.extracts.map((e) => e.historian).join(", ")}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-foreground/80">
                      30 marks
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary">
                      Start →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}

        {/* Challenge tier — extracts where the argument is extremely subtle */}
        {challengeSets.length > 0 && (
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <h2 className="font-serif text-sm font-semibold uppercase tracking-[0.12em] text-rose-700 dark:text-rose-300">
                Challenge Extracts
              </h2>
            </div>
            <p className="mb-3 max-w-2xl text-xs text-muted-foreground">
              Single extracts where the argument is genuinely buried. Harder
              than the standard sets — for when you're ready to push past
              ordinary difficulty.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {challengeSets.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/extracts/${s.id}`)}
                  className="group flex flex-col gap-3 rounded-xl bg-rose-50/60 p-5 text-left shadow-card ring-1 ring-rose-200/60 transition-all hover:-translate-y-0.5 hover:bg-rose-50 hover:shadow-card-hover dark:bg-rose-950/20 dark:ring-rose-800/40"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300">
                    <Flame className="h-5 w-5" />
                  </div>
                  <h3 className="font-serif text-base font-bold text-primary">
                    {s.topic}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {s.date_range} · {s.extracts[0]?.historian ?? "Single extract"}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-xs font-medium text-rose-700/80 dark:text-rose-300/80">
                      Challenge · 30 marks
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground group-hover:text-rose-700 dark:group-hover:text-rose-300">
                      Start →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {!loading && allSets.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No extract sets loaded yet. Check Supabase for the extract_sets and
            extracts tables.
          </div>
        )}
      </div>
    </div>
  );
};

export default ExtractPracticePage;
