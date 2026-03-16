import { BookOpen } from "lucide-react";
import { useSpecPointSections } from "@/hooks/useRevisionData";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <BookOpen className="h-5 w-5 shrink-0 text-sidebar-primary" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-serif text-sm font-bold leading-tight text-sidebar-foreground">
                AQA 7042/1H
              </span>
              <span className="text-[10px] leading-tight text-sidebar-foreground/60">
                Russia 1855–1964
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section, sIdx) => (
          <Collapsible key={section.title} defaultOpen={sIdx === 0}>
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer gap-1 text-sidebar-foreground/70 hover:text-sidebar-foreground">
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
                    {section.points.map((sp) => (
                      <SidebarMenuItem key={sp.id}>
                        <SidebarMenuButton
                          isActive={selectedSpecId === sp.id}
                          onClick={() => onSelectSpec(sp.id)}
                          tooltip={sp.title}
                          className="text-xs"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-sidebar-accent text-[10px] font-bold text-sidebar-primary">
                            {sp.id}
                          </span>
                          {!collapsed && (
                            <span className="line-clamp-2 leading-tight">{sp.title}</span>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
