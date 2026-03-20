import { PenLine, Crosshair, Camera, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeHeroProps {
  onStartRevising: () => void;
  onOpenScribe: () => void;
}

const features = [
  {
    icon: PenLine,
    title: "AI Blank Recall",
    description:
      "Write everything you know, then let AI analyse your response against the official AQA indicative content — instantly revealing gaps in your knowledge.",
  },
  {
    icon: Crosshair,
    title: "Precision Driller",
    subtitle: "720+ Questions",
    description:
      "Target the sniper facts that separate top-band answers: specific dates, edicts, statistics and named individuals across all six rulers.",
  },
  {
    icon: Camera,
    title: "The Scribe",
    description:
      "Photograph your handwritten notes and convert them into digital text for AI-powered analysis — bridging pen-and-paper revision with active recall.",
  },
];

export function WelcomeHero({ onStartRevising, onOpenScribe }: WelcomeHeroProps) {
  return (
    <div className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-card px-6 py-16 sm:py-20 lg:py-24">
        {/* Subtle decorative background */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,hsl(var(--accent)/0.08),transparent)]" />

        <div className="relative mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-accent">
            <BookOpen className="h-3.5 w-3.5" />
            AQA 7042 / 1H Breadth Study
          </div>

          <h1 className="mx-auto mt-6 max-w-2xl font-serif text-3xl font-bold leading-tight text-primary sm:text-4xl lg:text-5xl">
            Master AQA 1H: Tsarist and Communist Russia
            <span className="mt-2 block text-xl font-medium text-muted-foreground sm:text-2xl">
              (1855–1964)
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            The AI-powered active recall tool designed specifically for the AQA breadth study.
            Every question grounded in the official specification.
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
            <Button
              variant="outline"
              size="lg"
              onClick={onOpenScribe}
              className="gap-2 text-base"
            >
              <Camera className="h-4 w-4" />
              Open The Scribe
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-center font-serif text-2xl font-bold text-primary sm:text-3xl">
            Three Tools, One Goal
          </h2>
          <p className="mx-auto mb-10 max-w-lg text-center text-sm text-muted-foreground">
            Active recall strategies backed by cognitive science — tailored to the AQA 7042 specification.
          </p>

          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-accent/40 hover:shadow-md"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground">
                  {f.title}
                </h3>
                {f.subtitle && (
                  <span className="mt-0.5 block text-xs font-semibold text-accent">
                    {f.subtitle}
                  </span>
                )}
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEO text block */}
      <section className="border-t border-border bg-card px-6 py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 font-serif text-2xl font-bold text-primary">
            About the 1H Revision Engine
          </h2>
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              This revision platform is built exclusively for the AQA 7042/1H specification:
              <em> Tsarist and Communist Russia, 1855–1964</em>. It covers the full breadth study
              from the political authority of Alexander&nbsp;II and the emancipation of the serfs
              in 1861, through the revolutionary upheavals of 1905 and 1917, to the consolidation
              of Soviet power under Lenin and Stalin, and Khrushchev's de-Stalinisation programme.
            </p>
            <p>
              Unlike generic revision tools, every question, recall prompt, and mark-scheme extract
              is drawn directly from the AQA specification and official indicative content.
              The <strong>Blank Recall</strong> module uses AI analysis to compare your
              free-text summaries against the key concepts defined in our knowledge organiser
              database — highlighting precisely which political, social, and economic themes
              you've missed.
            </p>
            <p>
              The <strong>Precision Driller</strong> targets the "sniper facts" that
              differentiate top-band answers: specific dates, edicts, statistics, and named
              individuals. The <strong>Exam Architect</strong> provides real past-paper questions
              with full indicative content from AQA mark schemes, allowing you to practise
              25-mark essay planning under timed conditions.
            </p>
            <p>
              Whether you're revising Russification under Alexander&nbsp;III, the impact of
              Witte's economic reforms, the October Manifesto, War Communism, the NEP,
              collectivisation, the Great Terror, or the Virgin Lands scheme, every session
              is grounded in the official AQA course requirements.
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
