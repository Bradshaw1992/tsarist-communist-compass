import { LogOut, User as UserIcon } from "lucide-react";
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

/**
 * Tiny fixed-position "who am I" button, visible in the top-right when a
 * user is signed in. Shows initials in a circle; dropdown offers sign-out.
 * Intentionally unobtrusive — the full nav-bar/profile UX is planned for
 * a later step.
 */
export function UserMenu() {
  const { user, profile, isTeacher, signOut } = useAuth();

  if (!user) return null;

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

  return (
    <div className="fixed right-3 top-3 z-50 sm:right-4 sm:top-4">
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
