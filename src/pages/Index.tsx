import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlankRecall } from "@/components/tabs/BlankRecall";
import { ExamArchitect } from "@/components/tabs/ExamArchitect";
import { PrecisionDriller } from "@/components/tabs/PrecisionDriller";
import { useRevisionData } from "@/hooks/useRevisionData";
import { PenLine, FileText, Crosshair } from "lucide-react";

const Index = () => {
  const [selectedSpecId, setSelectedSpecId] = useState(1);
  const db = useRevisionData();
  const selectedSpec = db.spec_points.find((sp) => sp.id === selectedSpecId);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar selectedSpecId={selectedSpecId} onSelectSpec={setSelectedSpecId} />

        <div className="flex flex-1 flex-col">
          {/* Header */}
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm">
            <SidebarTrigger />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-serif text-lg font-bold text-primary sm:text-xl">
                {selectedSpec?.title}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {selectedSpec?.section}
              </p>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Tabs defaultValue="recall" className="space-y-6">
              <TabsList className="grid w-full max-w-lg grid-cols-3 bg-secondary">
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
            </Tabs>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
