import { useState, useEffect, useMemo, useRef } from "react";
import { trackPageView } from "@/lib/analytics";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BlankRecall } from "@/components/tabs/BlankRecall";
import { ExamArchitect } from "@/components/tabs/ExamArchitect";
import { PrecisionDriller } from "@/components/tabs/PrecisionDriller";
import { SpecificKnowledge } from "@/components/tabs/SpecificKnowledge";
import { useRevisionData, useSpecPointSections } from "@/hooks/useRevisionData";
import { useHighScores } from "@/hooks/useHighScores";
import {
  PenLine, FileText, Crosshair, Zap, Search, X, BookOpen, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const Index = () => {
  const [searchParams] = useSearchParams();
  const initialTopic = searchParams.get("topic");
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(
    initialTopic ? parseInt(initialTopic, 10) : null
  );
  const [search, setSearch] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const db = useRevisionData();
  const sections = useSpecPointSections();
  const { scores, recordScore } = useHighScores();
  const headerRef = useRef<HTMLElement>(null);

  const selectedSpec = selectedSpecId
    ? db.spec_points.find((sp) => sp.id === selectedSpecId)
    : undefined;

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
    setSelectedSpecId(id);
    const spec = db.spec_points.find((sp) => sp.id === id);
    if (spec) {
      trackPageView(`/topic/${id}`, `${spec.title} | AQA 1H Russia Compass`);
    }
  };
  const handleClose = () => setSelectedSpecId(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky mini-header */}
      <div
        className={`fixed inset-x-0 top-0 z-50 border-b border-border bg-primary/95 px-4 py-2 text-center text-sm font-semibold text-primary-foreground backdrop-blur transition-transform duration-300 ${
          scrolled ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <BookOpen className="mr-1.5 inline-block h-4 w-4 text-accent" />
        AQA 1H Russia Compass
      </div>

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
              <h2 className="mb-3 font-serif text-base font-semibold text-primary">
                {section.title.replace(/^Part \d+ - /, "")}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.points.map((sp) => {
                  const progress = scores[sp.id];
                  return (
                    <button
                      key={sp.id}
                      onClick={() => handleSelect(sp.id)}
                      className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-accent/50 hover:shadow-md"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
                        {sp.id}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug text-foreground group-hover:text-primary">
                          {sp.title}
                        </p>
                        {progress && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Best: {progress.highScore}% ·{" "}
                            {new Date(progress.lastAttempted).toLocaleDateString()}
                          </p>
                        )}
                      </div>
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
              The <strong>Precision Driller</strong> targets the "sniper facts" that
              differentiate top-band answers: specific dates, edicts, statistics, and named
              individuals from the reigns of Alexander&nbsp;II, Alexander&nbsp;III, Nicholas&nbsp;II,
              Lenin, Stalin, and Khrushchev. Each question is tagged to its specification point,
              and your results feed into a personalised revision report that identifies your
              weakest areas.
            </p>
            <p>
              The <strong>Exam Architect</strong> provides real past-paper questions with full
              indicative content from AQA mark schemes, allowing you to practise 25-mark essay
              planning under timed conditions. Combined with the <strong>Handwriting Bridge</strong>—which
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

      {/* Full-screen revision modal */}
      <Dialog open={!!selectedSpecId} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="flex h-[95vh] max-h-[95vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
          {/* Modal header */}
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-serif text-base font-bold text-primary sm:text-lg">
                {selectedSpec?.title}
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                {selectedSpec?.section}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Tabs */}
          {selectedSpecId && (
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <Tabs defaultValue="recall" className="space-y-5">
                <TabsList className="grid w-full max-w-2xl grid-cols-4 bg-secondary">
                  <TabsTrigger value="recall" className="gap-1.5 text-xs sm:text-sm">
                    <PenLine className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Blank</span> Recall
                  </TabsTrigger>
                  <TabsTrigger value="exam" className="gap-1.5 text-xs sm:text-sm">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Exam</span> Architect
                  </TabsTrigger>
                  <TabsTrigger value="driller" className="gap-1.5 text-xs sm:text-sm">
                    <Crosshair className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Precision</span> Driller
                  </TabsTrigger>
                  <TabsTrigger value="knowledge" className="gap-1.5 text-xs sm:text-sm">
                    <Zap className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Specific</span> Knowledge
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="recall">
                  <BlankRecall specId={selectedSpecId} specTitle={selectedSpec?.title || ""} />
                </TabsContent>
                <TabsContent value="exam">
                  <ExamArchitect specId={selectedSpecId} />
                </TabsContent>
                <TabsContent value="driller">
                  <PrecisionDriller specId={selectedSpecId} />
                </TabsContent>
                <TabsContent value="knowledge">
                  <SpecificKnowledge specId={selectedSpecId} onScoreRecord={recordScore} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
