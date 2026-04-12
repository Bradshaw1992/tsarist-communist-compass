// =============================================================================
// TopNav — persistent top navigation shell
// =============================================================================
// Four primary tabs: Dashboard · Topics · General · Random, plus a review
// queue badge and UserMenu on the right. Sticky at the top of every page.
//
// Tabs are deliberately chunky — text-[15px], 18px icons, generous padding.
// The nav is the primary wayfinding surface for a four-page app and should
// feel like a shelf, not a footer.
// =============================================================================

import { NavLink, Link } from "react-router-dom";
import { LayoutDashboard, BookOpen, Compass, Dices, GraduationCap } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useWrongAnswers } from "@/hooks/useWrongAnswers";

interface Tab {
  to: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  end: boolean;
  teacherOnly?: boolean;
}

const tabs: Tab[] = [
  { to: "/", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, end: true },
  { to: "/topics", label: "Topics", shortLabel: "Topics", icon: BookOpen, end: false },
  { to: "/general", label: "General", shortLabel: "General", icon: Compass, end: false },
  { to: "/random", label: "Random", shortLabel: "Random", icon: Dices, end: false },
  { to: "/teacher", label: "Teacher", shortLabel: "Teach", icon: GraduationCap, end: false, teacherOnly: true },
];

export function TopNav() {
  const { isTeacher } = useAuth();
  const { dueCount, items: wrongAnswers } = useWrongAnswers();
  const totalReview = wrongAnswers.length;

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-5 sm:px-6">
        {/* Wordmark */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 font-serif text-base font-bold leading-none text-primary hover:text-primary/80"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Compass className="h-4 w-4" />
          </span>
          <span className="hidden lg:inline">Russia 1855–1964</span>
        </Link>

        {/* Tabs — chunky */}
        <nav className="flex flex-1 items-center gap-0.5 overflow-x-auto sm:gap-1">
          {tabs.filter((t) => !t.teacherOnly || isTeacher).map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[15px] font-medium transition-colors sm:px-4 sm:py-2.5 ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-[18px] w-[18px]" />
                    {/* Full label on md+, short label on sm, hidden below */}
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="hidden sm:inline md:hidden">{tab.shortLabel}</span>
                    {isActive && (
                      <span className="absolute -bottom-[11px] left-3 right-3 h-[2.5px] rounded-full bg-accent" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Review queue badge */}
        {totalReview > 0 && (
          <Link
            to="/review"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950/70"
            title={`${totalReview} wrong answer${totalReview === 1 ? "" : "s"} to review${dueCount > 0 ? ` (${dueCount} due today)` : ""}`}
          >
            <span className="tabular-nums">{totalReview}</span>
            <span className="hidden md:inline">to review</span>
          </Link>
        )}

        {/* User menu */}
        <div className="shrink-0">
          <UserMenu inline />
        </div>
      </div>
    </header>
  );
}
