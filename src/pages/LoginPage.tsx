import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Eye, EyeOff, KeyRound, Loader2, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { SEOHead } from "@/components/SEOHead";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { toast } from "sonner";

type EmailMode = "magic" | "password";
type PasswordView = "login" | "signup" | "forgot";

const LoginPage = () => {
  const {
    user,
    loading,
    signInWithGoogle,
    signInWithMagicLink,
    signInWithPassword,
    signUpWithPassword,
    resetPassword,
  } = useAuth();
  const navigate = useNavigate();

  const [signingIn, setSigningIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [emailMode, setEmailMode] = useState<EmailMode>("magic");
  const [passwordView, setPasswordView] = useState<PasswordView>("login");

  useEffect(() => {
    if (!loading && user) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      toast.error("Sign-in failed. Please try again.");
      setSigningIn(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      await signInWithMagicLink(trimmed);
      setLinkSent(true);
      toast.success("Check your inbox for your login link.");
    } catch {
      toast.error("Failed to send login link. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (passwordView === "forgot") {
      setSubmitting(true);
      try {
        await resetPassword(trimmed);
        setResetSent(true);
        toast.success("Password reset link sent. Check your inbox.");
      } catch {
        toast.error("Failed to send reset link. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (passwordView === "signup") {
        await signUpWithPassword(trimmed, password);
        toast.success("Account created! Check your email to confirm, then sign in.");
      } else {
        await signInWithPassword(trimmed, password);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <SEOHead
        title="Sign in | AQA 1H Russia Compass"
        description="Sign in to track your progress revising AQA 7042/1H: Tsarist and Communist Russia 1855-1964."
        canonicalPath="/login"
      />

      <div className="flex w-full max-w-5xl flex-col items-center gap-6 lg:flex-row lg:items-stretch lg:justify-center">
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

          {/* Google */}
          <div className="w-full pt-2">
            <Button
              onClick={handleGoogleSignIn}
              disabled={signingIn || loading}
              className="w-full h-12 gap-3 bg-primary text-primary-foreground hover:bg-primary/90"
              size="lg"
            >
              {signingIn ? (
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
            <span className="text-xs text-muted-foreground">or use email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Mode toggle */}
          <div className="flex w-full rounded-lg bg-muted p-1">
            <button
              onClick={() => { setEmailMode("magic"); setPassword(""); setResetSent(false); }}
              className={`flex-1 rounded-md py-2 text-xs font-medium transition-colors ${
                emailMode === "magic"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="mr-1.5 inline h-3.5 w-3.5" />
              Magic link
            </button>
            <button
              onClick={() => { setEmailMode("password"); setLinkSent(false); setPasswordView("login"); }}
              className={`flex-1 rounded-md py-2 text-xs font-medium transition-colors ${
                emailMode === "password"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <KeyRound className="mr-1.5 inline h-3.5 w-3.5" />
              Email &amp; password
            </button>
          </div>

          {/* Magic link form */}
          {emailMode === "magic" && (
            linkSent ? (
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
                    disabled={submitting}
                    className="h-12"
                  />
                  <Button
                    type="submit"
                    disabled={submitting || !email.trim()}
                    variant="outline"
                    className="h-12 shrink-0 gap-2 px-4"
                  >
                    {submitting ? (
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
            )
          )}

          {/* Email + password form */}
          {emailMode === "password" && (
            resetSent ? (
              <div className="w-full rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950/30">
                <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  <Mail className="h-4 w-4" />
                  Reset link sent!
                </div>
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                  Check your inbox for <strong>{email}</strong> and follow the link to reset your password.
                </p>
                <button
                  onClick={() => { setResetSent(false); setPasswordView("login"); }}
                  className="mt-2 text-xs text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 underline"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="w-full space-y-3">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="h-12"
                />
                {passwordView !== "forgot" && (
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={passwordView === "signup" ? "Create a password (6+ chars)" : "Password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      className="h-12 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12"
                  size="lg"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : passwordView === "signup" ? (
                    "Create account"
                  ) : passwordView === "forgot" ? (
                    "Send reset link"
                  ) : (
                    "Sign in"
                  )}
                </Button>

                <div className="flex justify-between text-xs">
                  {passwordView === "login" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => { setPasswordView("signup"); setPassword(""); }}
                        className="text-muted-foreground hover:text-primary underline"
                      >
                        Create an account
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPasswordView("forgot"); setPassword(""); }}
                        className="text-muted-foreground hover:text-primary underline"
                      >
                        Forgot password?
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setPasswordView("login"); setPassword(""); }}
                      className="text-muted-foreground hover:text-primary underline"
                    >
                      Back to sign in
                    </button>
                  )}
                </div>
              </form>
            )
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

      {/* "Why I built this" — visible to logged-out users */}
      <Card className="w-full max-w-md border shadow-sm bg-muted/30">
        <CardContent className="flex h-full flex-col gap-4 p-8 sm:p-10">
          <h2 className="font-serif text-xl font-bold text-primary">
            Why I built this
          </h2>
          <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
            <p>
              I'm Tom, an A-Level History teacher. I built this app because none of
              the revision resources out there quite fit how I teach AQA 7042 —
              and I wanted something my students could actually open at 10pm the
              night before a test, not just use in lesson.
            </p>
            <p>
              It's free, open to any student sitting AQA 1H Russia, and I'm
              actively building it. New questions and features land most weeks.
              If it helps, pass it on to a friend.
            </p>
          </div>

          <div className="mt-auto space-y-3 pt-2">
            <p className="text-sm font-medium">
              Found a bug? Got an idea?
            </p>
            <FeedbackDialog
              trigger={
                <Button variant="outline" className="w-full gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Leave feedback
                </Button>
              }
            />
            <p className="text-right text-sm italic text-muted-foreground">
              — Tom
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
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
