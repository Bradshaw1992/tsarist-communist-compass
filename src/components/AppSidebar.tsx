import { BookOpen, Compass } from "lucide-react";
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
import { ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AppSidebarProps {
  selectedSpecId: number | null;
  onSelectSpec: (id: number) => void;
  scores: Record<number, TopicProgress>;
}

export function AppSidebar({ selectedSpecId, onSelectSpec, scores }: AppSidebarProps) {
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

      <SidebarContent asChild>
        <nav aria-label="Revision topics">
          {sections.map((section, sIdx) => (
            <Collapsible key={section.title} defaultOpen={sIdx < 2}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer gap-1 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
                    {!collapsed && (
                      <>
                        <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                        <span className="truncate text-[11px] uppercase tracking-wider">
                          {section.title.replace(/^Part \d+ - /, "")}
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
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                                  isMastered
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                    : "bg-sidebar-accent text-sidebar-accent-foreground"
                                }`}>
                                  {sp.id}
                                </span>
                                {!collapsed && (
                                  <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="line-clamp-2 leading-tight">{sp.title}</span>
                                    {progress && (
                                      <span className="mt-0.5 flex items-center gap-1.5">
                                        <Progress value={progress.highScore} className="h-1 w-12" />
                                        <span className={`text-[10px] font-semibold tabular-nums ${
                                          isMastered ? "text-sidebar-primary" : "text-sidebar-foreground/40"
                                        }`}>
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
          ))}
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
