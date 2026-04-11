import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Persistent "sign in to save progress" banner shown at the top of every
 * page when no auth user is present. Hides automatically once the user
 * logs in. While auth state is still loading we render nothing, to avoid
 * a flash on page load for signed-in users.
 */
export function AnonymousBanner() {
  const { user, loading } = useAuth();

  if (loading || user) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900 shadow-sm dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>
          You're not signed in — your progress isn't being saved.
        </span>
        <Link
          to="/login"
          className="font-semibold underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-50"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
