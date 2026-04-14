import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { SEOHead } from "@/components/SEOHead";
import { toast } from "sonner";

const LoginPage = () => {
  const { user, loading, signInWithGoogle, signInWithMagicLink } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState<"google" | null>(null);
  const [email, setEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleGoogleSignIn = async () => {
    setSigningIn("google");
    try {
      await signInWithGoogle();
    } catch {
      toast.error("Sign-in failed. Please try again.");
      setSigningIn(null);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setSendingLink(true);
    try {
      await signInWithMagicLink(trimmed);
      setLinkSent(true);
      toast.success("Check your inbox — we've sent you a login link.");
    } catch {
      toast.error("Failed to send login link. Please try again.");
    } finally {
      setSendingLink(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <SEOHead
        title="Sign in | AQA 1H Russia Compass"
        description="Sign in to track your progress revising AQA 7042/1H: Tsarist and Communist Russia 1855-1964."
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
              Tsarist &amp; Communist Russia, 1855-1964
            </p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground/80">
              AQA 7042 / 1H
            </p>
          </div>

          {/* OAuth buttons */}
          <div className="w-full space-y-3 pt-2">
            <Button
              onClick={handleGoogleSignIn}
              disabled={!!signingIn || loading}
              className="w-full h-12 gap-3 bg-primary text-primary-foreground hover:bg-primary/90"
              size="lg"
            >
              {signingIn === "google" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Redirecting to Google...
                </>
              ) : (
                <>
                  <GoogleIcon />
                  Sign in with Google
                </>
              )}
            </Button>

          </div>

          {/* Divider */}
          <div className="flex w-full items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Magic link */}
          {linkSent ? (
            <div className="w-full rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950/30">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <Mail className="h-4 w-4" />
                Login link sent!
              </div>
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Check your inbox for <strong>{email}</strong> and click the link to sign in.
              </p>
              <button
                onClick={() => { setLinkSent(false); setEmail(""); }}
                className="mt-2 text-xs text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="w-full space-y-2">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={sendingLink}
                  className="h-12"
                />
                <Button
                  type="submit"
                  disabled={sendingLink || !email.trim()}
                  variant="outline"
                  className="h-12 shrink-0 gap-2 px-4"
                >
                  {sendingLink ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Send link
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                No password needed. We'll email you a one-click login link.
              </p>
            </form>
          )}

          <div className="w-full border-t border-border pt-4">
            <Link
              to="/"
              className="text-sm font-medium text-muted-foreground hover:text-primary"
            >
              Continue without signing in &rarr;
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
