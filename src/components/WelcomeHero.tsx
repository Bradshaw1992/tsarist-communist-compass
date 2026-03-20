import { useState, useMemo } from "react";
import {
  PenLine, Crosshair, Camera, ArrowRight, BookOpen, Search, X, ChevronRight, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useSpecPointSections } from "@/hooks/useRevisionData";
import { slugify } from "@/lib/slugify";
import type { TopicProgress } from "@/hooks/useHighScores";

/** Chronological era labels for SEO-friendly section headings */
const ERA_LABELS: Record<string, { label: string; dates: string }> = {
  "Part 1 - Trying to preserve autocracy, 1855-1894": {
    label: "Tsarist Autocracy",
    dates: "1855–1894",
  },
  "Part 2 - The collapse of autocracy, 1894-1917": {
    label: "The Fall of the Romanovs",
    dates: "1894–1917",
  },
  "Part 3 - The emergence of Communist dictatorship, 1917-1941": {
    label: "The Rise of Communism",
    dates: "1917–1941",
  },
  "Part 4 - The Stalinist dictatorship and reaction, 1941-1964": {
    label: "The Cold War & Khrushchev",
    dates: "1941–1964",
  },
};

const features = [
  {
    icon: PenLine,
    title: "AI Recall",
    description:
      "Write everything you know from memory. Our AI analyses your response against the official AQA indicative content, revealing exactly which key concepts you missed.",
  },
  {
    icon: Crosshair,
    title: "720+ Sniper Questions",
    description:
      "Precision-drilled questions targeting the specific dates, edicts, statistics and named individuals that differentiate top-band A-Level answers.",
  },
  {
    icon: Camera,
    title: "Scribe Handwriting",
    description:
      "Photograph your handwritten revision notes and convert them to digital text — bridging traditional pen-and-paper study with AI-powered active recall.",
  },
];

interface WelcomeHeroProps {
  onSelectTopic: (id: number) => void;
  onStartRevising: () => void;
  onOpenScribe: () => void;
  scores: Record<number, TopicProgress>;
}

export function WelcomeHero({ onSelectTopic, onStartRevising, onOpenScribe, scores }: WelcomeHeroProps) {
  const sections = useSpecPointSections();
  const [search, setSearch] = useState("");

  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections
      .map((s) => ({
        ...s,
        points: s.points.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.section.toLowerCase().includes(q) ||
            String(p.id).includes(q)
        ),
      }))
      .filter((s) => s.points.length > 0);
  }, [sections, search]);

  return (
    <div className="flex-1">
      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden border-b border-border bg-card px-6 py-14 sm:py-18 lg:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--accent)/0.06),transparent)]" />

        <div className="relative mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-accent">
            <BookOpen className="h-3.5 w-3.5" />
            AQA 7042 / 1H Breadth Study
          </div>

          <h1 className="mx-auto mt-6 max-w-2xl font-serif text-3xl font-bold leading-tight text-primary sm:text-4xl lg:text-[2.75rem]">
            AQA 1H Russia: The AI Revision Compass
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            A specialised tool for A-Level History students. Use grounded AI to master
            active recall, precision drilling, and source analysis.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              size="lg"
              onClick={onStartRevising}
              className="gap-2 bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
            >
              Start Revising
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" onClick={onOpenScribe} className="gap-2 text-base">
              <Camera className="h-4 w-4" />
              Open The Scribe
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURE CARDS ═══════════ */}
      <section className="px-6 py-12 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-5 sm:grid-cols-3">
            {features.map((f) => (
              <article
                key={f.title}
                className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-accent/40 hover:shadow-md"
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ TOPIC GRID ═══════════ */}
      <section className="border-t border-border bg-background px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Sticky search */}
          <div className="sticky top-[49px] z-30 -mx-4 mb-8 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="relative mx-auto max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search topics — e.g. 'Stalin', '1861', 'emancipation'…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-9"
                aria-label="Search revision topics"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Era sections */}
          {filteredSections.map((section) => {
            const era = ERA_LABELS[section.title];
            return (
              <div key={section.title} className="mb-10">
                <h2 className="mb-1 font-serif text-xl font-bold text-primary">
                  {era?.label || section.title.replace(/^Part \d+ - /, "")}
                </h2>
                {era && (
                  <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {era.dates}
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {section.points.map((sp) => {
                    const progress = scores[sp.id];
                    const isMastered = progress && progress.highScore >= 90;
                    const slug = slugify(sp.id, sp.title);
                    return (
                      <a
                        key={sp.id}
                        href={`/topic/${slug}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onSelectTopic(sp.id);
                        }}
                        title={`Revision: ${sp.title}`}
                        className={`group flex items-center gap-3 rounded-lg border p-4 transition-all hover:shadow-md ${
                          isMastered
                            ? "border-accent/50 bg-accent/5 hover:border-accent"
                            : "border-border bg-card hover:border-accent/40"
                        }`}
                      >
                        {/* ID badge */}
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                          isMastered
                            ? "bg-accent text-accent-foreground"
                            : "bg-primary text-primary-foreground"
                        }`}>
                          {sp.id}
                        </span>

                        {/* Title + progress */}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm font-medium leading-snug text-foreground group-hover:text-primary">
                            {sp.title}
                          </span>
                          {progress && (
                            <span className="mt-1 flex items-center gap-2">
                              <Progress value={progress.highScore} className="h-1.5 w-16" />
                              <span className={`text-[11px] font-semibold tabular-nums ${
                                isMastered ? "text-accent" : "text-muted-foreground"
                              }`}>
                                {progress.highScore}%
                              </span>
                            </span>
                          )}
                        </span>

                        {/* Arrow / star */}
                        {isMastered ? (
                          <Star className="h-4 w-4 shrink-0 fill-accent text-accent" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredSections.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">
              No topics match "<strong>{search}</strong>"
            </p>
          )}
        </div>
      </section>

      {/* ═══════════ SEO TEXT (300+ words) ═══════════ */}
      <section className="border-t border-border bg-card px-6 py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 font-serif text-2xl font-bold text-primary">
            About the AQA 1H Revision Engine
          </h2>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              This revision platform is built exclusively for the AQA 7042/1H specification:
              <em> Tsarist and Communist Russia, 1855–1964</em>. The breadth study covers over a
              century of Russian history, from the political authority of Tsar Alexander&nbsp;II and
              the emancipation of the serfs in 1861, through the revolutionary upheavals of 1905 and
              February and October 1917, to the consolidation of Soviet power under Lenin and Stalin,
              and Khrushchev's de-Stalinisation programme after 1953.
            </p>
            <p>
              Unlike generic revision tools, every question, recall prompt, and mark-scheme extract
              is drawn directly from the AQA specification and official indicative content. The
              <strong> AI Blank Recall</strong> module compares your free-text summaries against key
              concepts from a comprehensive knowledge-organiser database — highlighting precisely which
              political, social, and economic themes you have missed and where your analysis falls
              short of examiner expectations.
            </p>
            <p>
              The <strong>Precision Driller</strong> targets the "sniper facts" that differentiate
              top-band answers in the 25-mark essay questions: specific dates such as the Emancipation
              Edict of 1861, the October Manifesto of 1905, or the launch of the First Five-Year Plan
              in 1928; named statistics like the 60% of private serfs mortgaged by 1860; and key
              individuals including Witte, Stolypin, Trotsky, Bukharin, and Beria. Each question is
              tagged to its specification point and feeds into a personalised revision report.
            </p>
            <p>
              The <strong>Exam Architect</strong> provides real past-paper questions with full
              indicative content from AQA mark schemes, enabling timed 25-mark essay planning under
              authentic exam conditions. Combined with <strong>The Scribe</strong> — a handwriting
              bridge that converts photographed notes into analysable digital text — this platform
              supports the complete active-recall workflow recommended by cognitive science research
              for long-term retention.
            </p>
            <p>
              Whether you are revising Russification under Alexander&nbsp;III, the Russo-Japanese War,
              the Provisional Government, War Communism, the New Economic Policy, collectivisation and
              the kulaks, the Great Terror and show trials, High Stalinism during the Great Patriotic
              War, or the Virgin Lands scheme and peaceful coexistence under Khrushchev, every revision
              session is grounded in the official AQA 7042 course requirements. The goal is to move
              beyond <em>knowing</em> the history to <em>analysing</em> it — focusing on the
              <strong> Why</strong>, the <strong> How</strong>, and the
              <strong> Significance</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        AQA 7042/1H · Tsarist and Communist Russia, 1855–1964
      </footer>
    </div>
  );
}
