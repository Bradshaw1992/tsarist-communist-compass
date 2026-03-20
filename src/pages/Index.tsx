import { useState, useEffect } from "react";
import { trackPageView } from "@/lib/analytics";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { BlankRecall } from "@/components/tabs/BlankRecall";
import { ExamArchitect } from "@/components/tabs/ExamArchitect";
import { PrecisionDriller } from "@/components/tabs/PrecisionDriller";
import { SpecificKnowledge } from "@/components/tabs/SpecificKnowledge";
import { useRevisionData } from "@/hooks/useRevisionData";
import { useHighScores } from "@/hooks/useHighScores";
import { useIsMobile } from "@/hooks/use-mobile";
import { PenLine, FileText, Crosshair, Zap, X, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/AppSidebar";
import { WelcomeHero } from "@/components/WelcomeHero";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

const Index = () => {
  const [searchParams] = useSearchParams();
  const initialTopic = searchParams.get("topic");
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(
    initialTopic ? parseInt(initialTopic, 10) : null
  );
  const db = useRevisionData();
  const { scores, recordScore } = useHighScores();
  const isMobile = useIsMobile();

  const selectedSpec = selectedSpecId
    ? db.spec_points.find((sp) => sp.id === selectedSpecId)
    : undefined;

  const handleSelect = (id: number) => {
    setSelectedSpecId(id);
    try {
      localStorage.setItem("russia-last-studied", String(id));
    } catch {}
    const spec = db.spec_points.find((sp) => sp.id === id);
    if (spec) {
      trackPageView(`/topic/${id}`, `${spec.title} | AQA 1H Russia Compass`);
    }
  };

  const handleClose = () => setSelectedSpecId(null);

  const handleStartRevising = () => {
    const lastId = localStorage.getItem("russia-last-studied");
    if (lastId) {
      handleSelect(parseInt(lastId, 10));
    } else {
      handleSelect(db.spec_points[0]?.id ?? 1);
    }
  };

  const handleOpenScribe = () => {
    window.open(
      "https://gemini.google.com/gem/1m9H0A3i4EGgdifGheiLlYB0ti1ZY9WO6?usp=sharing",
      "_blank"
    );
  };

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="flex min-h-screen w-full">
        {/* Semantic aside */}
        <aside aria-label="Topic navigation">
          <AppSidebar
            selectedSpecId={selectedSpecId}
            onSelectSpec={handleSelect}
            onNavigateHome={handleClose}
            onOpenScribe={handleOpenScribe}
            scores={scores}
            currentView={selectedSpecId ? "topic" : "home"}
          />
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Sticky top bar */}
          <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-2 backdrop-blur">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <BookOpen className="h-4 w-4 text-accent" />
            <span className="font-serif text-sm font-semibold text-primary">
              AQA 1H Russia Compass
            </span>
          </header>

          {/* Welcome page */}
          <main>
            <WelcomeHero
              onStartRevising={handleStartRevising}
              onOpenScribe={handleOpenScribe}
            />
          </main>
        </div>

        {/* Full-screen revision modal */}
        <Dialog open={!!selectedSpecId} onOpenChange={(open) => !open && handleClose()}>
          <DialogContent className="flex h-[95vh] max-h-[95vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
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
                    <BlankRecall specId={selectedSpecId} specTitle={selectedSpec?.title || ""} onScoreRecord={recordScore} />
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
    </SidebarProvider>
  );
};

export default Index;
