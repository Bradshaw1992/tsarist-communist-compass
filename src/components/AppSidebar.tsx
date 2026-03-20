import { Compass, Home, Camera, ChevronRight } from "lucide-react";
import { useSpecPointSections } from "@/hooks/useRevisionData";
import { slugify } from "@/lib/slugify";
import type { TopicProgress } from "@/hooks/useHighScores";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";

/** Map AQA section titles to shorter era-based labels */
const ERA_LABELS: Record<string, string> = {
  "Part 1 - Trying to preserve autocracy, 1855-1894": "Alexander II & III (1855–1894)",
  "Part 2 - The collapse of autocracy, 1894-1917": "Nicholas II (1894–1917)",
  "Part 3 - The emergence of Communist dictatorship, 1917-1941": "Lenin & Stalin (1917–1941)",
  "Part 4 - The Stalinist dictatorship and reaction, 1941-1964": "High Stalinism & Khrushchev (1941–1964)",
};

interface AppSidebarProps {
  selectedSpecId: number | null;
  onSelectSpec: (id: number) => void;
  onNavigateHome: () => void;
  onOpenScribe: () => void;
  scores: Record<number, TopicProgress>;
  currentView: "home" | "topic";
}

export function AppSidebar({
  selectedSpecId,
  onSelectSpec,
  onNavigateHome,
  onOpenScribe,
  scores,
  currentView,
}: AppSidebarProps) {
  const sections = useSpecPointSections();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-3 py-4">
          <Compass className="h-6 w-6 shrink-0 text-sidebar-primary" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-serif text-sm font-bold leading-tight text-sidebar-foreground">
                Russia Compass
              </span>
              <span className="text-[10px] leading-tight text-sidebar-foreground/50">
                AQA 7042 / 1H · 1855–1964
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="Revision navigation">
          {/* Home & Scribe links */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentView === "home" && selectedSpecId === null}
                    onClick={onNavigateHome}
                    tooltip="Home — Welcome page"
                    className="text-xs"
                  >
                    <Home className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>Home</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="The Scribe — Handwriting scanner"
                    className="text-xs"
                  >
                    <a
                      href="https://gemini.google.com/gem/1m9H0A3i4EGgdifGheiLlYB0ti1ZY9WO6?usp=sharing"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="The Scribe — Handwriting to digital text converter"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenScribe();
                      }}
                    >
                      <Camera className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>The Scribe</span>}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Topic sections grouped by era */}
          {sections.map((section, sIdx) => {
            const eraLabel = ERA_LABELS[section.title] || section.title.replace(/^Part \d+ - /, "");
            return (
              <Collapsible key={section.title} defaultOpen={sIdx === 0}>
                <SidebarGroup>
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="cursor-pointer gap-1 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
                      {!collapsed && (
                        <>
                          <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                          <span className="truncate text-[11px] uppercase tracking-wider">
                            {eraLabel}
                          </span>
                        </>
                      )}
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {section.points.map((sp) => {
                          const progress = scores[sp.id];
                          const isMastered = progress && progress.highScore >= 90;
                          const slug = slugify(sp.id, sp.title);
                          return (
                            <SidebarMenuItem key={sp.id}>
                              <SidebarMenuButton
                                asChild
                                isActive={selectedSpecId === sp.id}
                                tooltip={`Revision: ${sp.title}`}
                                className="text-xs"
                              >
                                <a
                                  href={`/topic/${slug}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    onSelectSpec(sp.id);
                                  }}
                                  title={`Revision: ${sp.title}`}
                                  aria-label={`Revision: ${sp.title}`}
                                >
                                  <span
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                                      isMastered
                                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                        : "bg-sidebar-accent text-sidebar-accent-foreground"
                                    }`}
                                  >
                                    {sp.id}
                                  </span>
                                  {!collapsed && (
                                    <span className="flex min-w-0 flex-1 flex-col">
                                      <span className="line-clamp-2 leading-tight">
                                        {sp.title}
                                      </span>
                                      {progress && (
                                        <span className="mt-0.5 flex items-center gap-1.5">
                                          <Progress
                                            value={progress.highScore}
                                            className="h-1 w-12"
                                          />
                                          <span
                                            className={`text-[10px] font-semibold tabular-nums ${
                                              isMastered
                                                ? "text-sidebar-primary"
                                                : "text-sidebar-foreground/40"
                                            }`}
                                          >
                                            {progress.highScore}%
                                          </span>
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </a>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })}
        </nav>
      </SidebarContent>

      {!collapsed && (
        <SidebarFooter>
          <div className="px-3 py-3 text-[10px] text-sidebar-foreground/30">
            AQA 7042/1H · Tsarist &amp; Communist Russia
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
