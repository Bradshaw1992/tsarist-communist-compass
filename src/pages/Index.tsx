import { useState, useEffect, useMemo, useRef } from "react";
import { trackPageView } from "@/lib/analytics";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Input } from "@/components/ui/input";
import { useSpecPoints, useSpecPointSections } from "@/hooks/useRevisionData";
import { useHighScores } from "@/hooks/useHighScores";
import { useWrongAnswers } from "@/hooks/useWrongAnswers";
import {
  Search, X, BookOpen, Star, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { StatsPanel } from "@/components/StatsPanel";

const Index = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [mobileTab, setMobileTab] = useState<"home" | "driller" | "scribe" | "stats">("home");
  const specPoints = useSpecPoints();
  const sections = useSpecPointSections();
  const { scores } = useHighScores();
  const { countsBySpec } = useWrongAnswers();
  const reviewCounts = countsBySpec();
  const totalToReview = Object.values(reviewCounts).reduce((a, b) => a + b, 0);
  const headerRef = useRef<HTMLElement>(null);

  // Backwards compat: old links used /?topic=N to auto-open the modal.
  // Now we redirect straight to the topic page at /spec/N.
  useEffect(() => {
    const t = searchParams.get("topic");
    if (t) {
      const id = parseInt(t, 10);
      if (!Number.isNaN(id)) navigate(`/spec/${id}`, { replace: true });
    }
  }, [searchParams, navigate]);

  // Sticky mini-header on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 160);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Filter topics
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

  const handleSelect = (id: number) => {
    try { localStorage.setItem("russia-last-studied", String(id)); } catch {}
    const spec = specPoints.find((sp) => sp.id === id);
    if (spec) {
      trackPageView(`/spec/${id}`, `${spec.title} | AQA 1H Russia Compass`);
    }
    navigate(`/spec/${id}`);
  };

  const handleMobileNav = (tab: "home" | "driller" | "scribe" | "stats") => {
    if (tab === "driller") {
      const lastId = localStorage.getItem("russia-last-studied");
      const targetId = lastId ? parseInt(lastId, 10) : specPoints[0]?.id ?? 1;
      handleSelect(targetId);
      return;
    }
    if (tab === "scribe") {
      window.open(
        "https://gemini.google.com/gem/1m9H0A3i4EGgdifGheiLlYB0ti1ZY9WO6?usp=sharing",
        "_blank"
      );
      return;
    }
    setMobileTab(tab);
  };

  const homepageJsonLd = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "AQA 1H Russia Compass",
    "url": "https://www.tsarist-communist-russia-1h.co.uk/",
    "description": "AI-powered A-Level History revision for AQA 7042/1H: Tsarist and Communist Russia 1855–1964. Active recall, precision drilling, and exam practice.",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "Web",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "GBP" },
    "educationalLevel": "A-Level",
    "about": {
      "@type": "Course",
      "name": "AQA 7042/1H: Tsarist and Communist Russia, 1855–1964",
      "provider": { "@type": "Organization", "name": "AQA" }
    }
  }), []);

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0">
      <SEOHead
        title="AQA 1H Russia Compass | Tsarist & Communist Russia Revision"
        description="AI-powered A-Level History revision for AQA 7042/1H: Tsarist and Communist Russia 1855–1964. Active recall, precision drilling, and exam practice grounded in the specification."
        canonicalPath="/"
        jsonLd={homepageJsonLd}
      />

      {/* Sticky mini-header */}
      <div
        className={`fixed inset-x-0 top-0 z-50 border-b border-border bg-primary/95 px-4 py-2 text-center text-sm font-semibold text-primary-foreground backdrop-blur transition-transform duration-300 ${
          scrolled ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <BookOpen className="mr-1.5 inline-block h-4 w-4 text-accent" />
        AQA 1H Russia Compass
      </div>

      {mobileTab === "stats" ? (
        <div className="sm:hidden">
          <StatsPanel scores={scores} totalTopics={specPoints.length} />
        </div>
      ) : null}

      {/* Main content — always visible on desktop, conditionally on mobile */}
      <div className={mobileTab !== "home" && mobileTab !== "driller" ? "hidden sm:block" : ""}>
        {/* Hero header */}
        <header ref={headerRef} className="border-b border-border bg-card px-6 py-12 text-center sm:py-16">
          <div className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-widest text-accent">
            AQA 7042 / 1H
          </div>
          <h1 className="mx-auto mt-4 max-w-3xl font-serif text-3xl font-bold leading-tight text-primary sm:text-4xl lg:text-[2.75rem]">
            Tsarist and Communist Russia (1855–1964)
            <span className="mt-1 block text-lg font-medium text-muted-foreground sm:text-xl">
              A-Level History Revision
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            AI-powered active recall and precision drilling grounded in the 7042 Specification.
          </p>
          {totalToReview > 0 && (
            <div className="mt-5 flex justify-center">
              <Button
                asChild
                size="sm"
                variant="outline"
                className="gap-2 border-amber-400/60 bg-amber-50/40 text-amber-700 hover:bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-300"
              >
                <Link to="/review">
                  <ClipboardList className="h-4 w-4" />
                  {totalToReview} question{totalToReview === 1 ? "" : "s"} to review
                </Link>
              </Button>
            </div>
          )}
        </header>

        {/* Topic Grid */}
        <section className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            {/* Search */}
            <div className="relative mx-auto mb-8 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Quick search — e.g. 'Stalin', '1861', 'emancipation'…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Grid */}
            {filteredSections.map((section) => (
              <div key={section.title} className="mb-8">
                <h2 className="mb-3 font-serif text-base font-semibold text-primary" role="heading" aria-level={2}>
                  {section.title.replace(/^Part \d+ - /, "")}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {section.points.map((sp) => {
                    const progress = scores[sp.id];
                    const isMastered = progress && progress.highScore >= 90;
                    const toReview = reviewCounts[sp.id] ?? 0;
                    return (
                      <button
                        key={sp.id}
                        onClick={() => handleSelect(sp.id)}
                        className={`group flex flex-col gap-2 rounded-lg border p-4 text-left shadow-sm transition-all hover:shadow-md ${
                          isMastered
                            ? "border-amber-400/60 bg-amber-50/40 hover:border-amber-400 dark:border-amber-500/40 dark:bg-amber-950/20"
                            : "border-border bg-card hover:border-accent/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
                            {sp.id}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-medium leading-snug text-foreground group-hover:text-primary">
                              {sp.title}
                            </h3>
                          </div>
                          {isMastered && (
                            <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                          )}
                        </div>
                        {progress && (
                          <div className="flex items-center gap-2">
                            <Progress
                              value={progress.highScore}
                              className="h-1.5 flex-1"
                            />
                            <span className={`text-[11px] font-semibold tabular-nums ${
                              isMastered ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                            }`}>
                              {progress.highScore}%
                            </span>
                          </div>
                        )}
                        {toReview > 0 && (
                          <div className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                            <ClipboardList className="h-3 w-3" />
                            {toReview} to review
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredSections.length === 0 && (
              <p className="py-12 text-center text-muted-foreground">
                No topics match "<strong>{search}</strong>"
              </p>
            )}
          </div>
        </section>

        {/* SEO Sandwich */}
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
                database—highlighting precisely which political, social, and economic themes
                you've missed.
              </p>
              <p>
                The <strong>Knowledge Driller</strong> targets the "sniper facts" that
                differentiate top-band answers: specific dates, edicts, statistics, and named
                individuals from the reigns of Alexander&nbsp;II, Alexander&nbsp;III, Nicholas&nbsp;II,
                Lenin, Stalin, and Khrushchev. The <strong>Concept Driller</strong> goes one level
                deeper, testing significance, causation, and the key historiographical ideas that
                separate a B from an A*. Each question is tagged to its specification point, and
                your results feed a personalised revision report that surfaces your weakest areas.
              </p>
              <p>
                The <strong>Essay Bank</strong> collects real past-paper questions with full
                indicative content from AQA mark schemes, so you can practise 25-mark essay
                planning under timed conditions. Combined with the <strong>Potemkin Scribe</strong>—which
                converts photographed handwritten notes into analysable digital text—this platform
                supports the complete active-recall workflow recommended by cognitive science research.
              </p>
              <p>
                Whether you're revising Russification under Alexander&nbsp;III, the impact of
                Witte's economic reforms, the October Manifesto, War Communism, the NEP,
                collectivisation, the Great Terror, or the Virgin Lands scheme, every session
                is grounded in the official AQA course requirements. The goal is to move beyond
                <em> knowing </em> the history to <em> analysing </em> it—focusing on the
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

      {/* Mobile bottom nav */}
      <MobileBottomNav activeTab={mobileTab} onNavigate={handleMobileNav} />
    </div>
  );
};

export default Index;
