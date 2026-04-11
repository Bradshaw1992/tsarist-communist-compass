import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { SEOHead } from "@/components/SEOHead";
import { toast } from "sonner";

/**
 * Login page — /login
 *
 * Renders Google sign-in and a "continue without signing in" escape hatch.
 * If the user is already signed in, we bounce them back to the dashboard.
 *
 * Microsoft OAuth is deliberately omitted for now. Adding it later is a
 * matter of adding another button that calls signInWithOAuth({ provider:
 * 'azure' }) and configuring the Azure app in the Supabase dashboard.
 */
const LoginPage = () => {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);

  // Already signed in? Send them home.
  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
      // The OAuth flow will redirect the browser, so anything below here
      // usually won't run. If it does (e.g. popup blocker), we reset.
    } catch (err) {
      console.error("[LoginPage] Google sign-in failed:", err);
      toast.error("Sign-in failed. Please try again.");
      setSigningIn(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <SEOHead
        title="Sign in | AQA 1H Russia Compass"
        description="Sign in to track your progress revising AQA 7042/1H: Tsarist and Communist Russia 1855–1964."
        canonicalPath="/login"
      />

      <Card className="w-full max-w-md border-2 shadow-lg">
        <CardContent className="flex flex-col items-center gap-6 p-8 sm:p-10 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <BookOpen className="h-10 w-10 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="font-serif text-2xl font-bold text-primary">
              A-Level Russia
            </h1>
            <p className="font-serif text-sm text-muted-foreground">
              Tsarist &amp; Communist Russia, 1855–1964
            </p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground/80">
              AQA 7042 / 1H
            </p>
          </div>

          <div className="w-full space-y-3 pt-2">
            <Button
              onClick={handleGoogleSignIn}
              disabled={signingIn || loading}
              className="w-full h-12 gap-3 bg-primary text-primary-foreground hover:bg-primary/90"
              size="lg"
            >
              {signingIn ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Redirecting to Google…
                </>
              ) : (
                <>
                  <GoogleIcon />
                  Sign in with Google
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              Any email address works. Your progress will be saved across devices.
            </p>
          </div>

          <div className="w-full border-t border-border pt-4">
            <Link
              to="/"
              className="text-sm font-medium text-muted-foreground hover:text-primary"
            >
              Continue without signing in →
            </Link>
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              You can use every activity, but your progress won't be saved.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/** Inline SVG so we don't have to ship a Google logo asset. */
function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export default LoginPage;
