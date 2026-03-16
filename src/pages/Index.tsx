import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlankRecall } from "@/components/tabs/BlankRecall";
import { ExamArchitect } from "@/components/tabs/ExamArchitect";
import { PrecisionDriller } from "@/components/tabs/PrecisionDriller";
import { SpecificKnowledge } from "@/components/tabs/SpecificKnowledge";
import { WelcomeGuide } from "@/components/WelcomeGuide";
import { useRevisionData } from "@/hooks/useRevisionData";
import { PenLine, FileText, Crosshair, Zap } from "lucide-react";

const Index = () => {
  const [selectedSpecId, setSelectedSpecId] = useState<number | null>(null);
  const db = useRevisionData();
  const selectedSpec = selectedSpecId
    ? db.spec_points.find((sp) => sp.id === selectedSpecId)
    : undefined;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar selectedSpecId={selectedSpecId} onSelectSpec={setSelectedSpecId} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm">
            <SidebarTrigger />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-serif text-lg font-bold text-primary sm:text-xl">
                {selectedSpec?.title ?? "Russia 1855–1964"}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {selectedSpec?.section ?? "Select a specification point to begin"}
              </p>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-5xl">
              {!selectedSpecId ? (
                <WelcomeGuide />
              ) : (
                <Tabs defaultValue="recall" className="space-y-6">
                  <TabsList className="grid w-full max-w-2xl grid-cols-4 bg-secondary">
                    <TabsTrigger value="recall" className="gap-1.5 font-sans text-xs sm:text-sm">
                      <PenLine className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Blank</span> Recall
                    </TabsTrigger>
                    <TabsTrigger value="exam" className="gap-1.5 font-sans text-xs sm:text-sm">
                      <FileText className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Exam</span> Architect
                    </TabsTrigger>
                    <TabsTrigger value="driller" className="gap-1.5 font-sans text-xs sm:text-sm">
                      <Crosshair className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Precision</span> Driller
                    </TabsTrigger>
                    <TabsTrigger value="knowledge" className="gap-1.5 font-sans text-xs sm:text-sm">
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
                    <SpecificKnowledge specId={selectedSpecId} />
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
