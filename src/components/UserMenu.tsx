import { LogOut, Monitor, Moon, Sun, User as UserIcon, Users } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { JoinClassDialog } from "@/components/JoinClassDialog";

interface UserMenuProps {
  /**
   * When true, the menu renders in place (for embedding inside a nav bar).
   * When false/omitted, it pins itself to the top-right of the viewport —
   * the legacy behaviour used on pages that don't have a shell.
   */
  inline?: boolean;
}

/**
 * "Who am I" button. Shows the user's initials in a circle; dropdown offers
 * theme switching and sign-out. Signed-out → a neat "Sign in" button.
 *
 * With `inline`, the component sits wherever it's placed. Without it,
 * the component is fixed to the top-right corner (used as a fallback).
 */
export function UserMenu({ inline = false }: UserMenuProps) {
  const { user, profile, isTeacher, signOut } = useAuth();
  const { preference, setTheme } = useTheme();

  // Signed-out users get a prominent "Sign in" button when inline, so the
  // top bar still has something on the right.
  if (!user) {
    if (!inline) return null;
    return (
      <Button
        asChild
        size="sm"
        variant="outline"
        className="h-8 gap-1.5 border-primary/30 bg-card text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
      >
        <a href="/login">Sign in</a>
      </Button>
    );
  }

  const displayName =
    profile?.display_name ||
    profile?.full_name ||
    user.email ||
    "Account";

  const initials = getInitials(
    profile?.display_name || profile?.full_name || user.email || "U"
  );

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out");
    } catch {
      toast.error("Sign-out failed");
    }
  };

  const wrapper = inline
    ? ""
    : "fixed right-3 top-3 z-50 sm:right-4 sm:top-4";

  return (
    <div className={wrapper}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full border-primary/30 bg-card/90 text-xs font-bold text-primary shadow-sm backdrop-blur hover:bg-card"
            aria-label="Account menu"
          >
            {initials}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-start gap-2">
            <UserIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {displayName}
              </p>
              {user.email && user.email !== displayName && (
                <p className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </p>
              )}
              {isTeacher && (
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                  Teacher
                </p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Theme switcher — three-state: light / dark / system */}
          <DropdownMenuLabel className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Appearance
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setTheme("light")}
            className="cursor-pointer"
          >
            <Sun className="mr-2 h-4 w-4" />
            Light
            {preference === "light" && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme("dark")}
            className="cursor-pointer"
          >
            <Moon className="mr-2 h-4 w-4" />
            Dark
            {preference === "dark" && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme("system")}
            className="cursor-pointer"
          >
            <Monitor className="mr-2 h-4 w-4" />
            System
            {preference === "system" && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Join a class — opens a dialog for entering a join code */}
          <JoinClassDialog
            trigger={
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={(e) => e.preventDefault()}
              >
                <Users className="mr-2 h-4 w-4" />
                Join a class
              </DropdownMenuItem>
            }
          />

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function getInitials(nameOrEmail: string): string {
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return "?";
  // If it looks like an email, use the first letter of the local part.
  if (trimmed.includes("@")) {
    return trimmed[0].toUpperCase();
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
