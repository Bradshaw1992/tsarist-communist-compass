import { Home, Crosshair, Camera, BarChart3 } from "lucide-react";

interface MobileBottomNavProps {
  activeTab: "home" | "driller" | "scribe" | "stats";
  onNavigate: (tab: "home" | "driller" | "scribe" | "stats") => void;
}

const navItems = [
  { id: "home" as const, label: "Home", icon: Home },
  { id: "driller" as const, label: "Driller", icon: Crosshair },
  { id: "scribe" as const, label: "Scribe", icon: Camera },
  { id: "stats" as const, label: "Stats", icon: BarChart3 },
];

export function MobileBottomNav({ activeTab, onNavigate }: MobileBottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur sm:hidden">
      <div className="flex items-stretch">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
              {item.label}
            </button>
          );
        })}
      </div>
      {/* Safe area for iOS home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
