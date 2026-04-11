// =============================================================================
// AuthContext
// =============================================================================
// Central auth state for the app. Wraps Supabase Auth and exposes:
//   - user      : the raw auth.users row (or null if signed out / anon)
//   - profile   : the matching public.user_profiles row (or null)
//   - isTeacher : boolean shortcut — profile?.role === 'teacher'
//   - loading   : true until the initial session + profile have been fetched
//   - signInWithGoogle() / signOut()
//
// IMPORTANT: we deliberately treat "no user" as a valid state — the app
// supports anonymous mode. Components should handle `user === null` by
// skipping writes to user_data tables (sessions, wrong answers, etc.),
// not by redirecting. Only the Teacher Dashboard requires a user.
//
// We also handle the "profile row doesn't exist yet" race: on a brand new
// sign-up the handle_new_user() trigger runs inside the same transaction
// as the auth.users insert, so the profile should exist by the time we
// query it. But network hiccups happen, so we retry once after 500ms.
//
// Do NOT modify this file casually — the whole app reads from it.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type UserProfile = Tables<"user_profiles">;

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  isTeacher: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[AuthContext] Failed to fetch profile:", error);
    return null;
  }
  return data;
}

async function fetchProfileWithRetry(
  userId: string,
  attempt = 0
): Promise<UserProfile | null> {
  const profile = await fetchProfile(userId);
  if (profile || attempt >= 2) return profile;
  // Brand-new sign-up: the handle_new_user trigger may still be landing.
  // Brief backoff then retry.
  await new Promise((resolve) => setTimeout(resolve, 500));
  return fetchProfileWithRetry(userId, attempt + 1);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Guard so we don't double-fetch the profile if auth events fire in quick
  // succession (INITIAL_SESSION + TOKEN_REFRESHED can both fire on page load).
  const lastFetchedUserId = useRef<string | null>(null);

  const applySession = useCallback(async (session: Session | null) => {
    const nextUser = session?.user ?? null;
    setUser(nextUser);

    if (!nextUser) {
      lastFetchedUserId.current = null;
      setProfile(null);
      setLoading(false);
      return;
    }

    if (lastFetchedUserId.current === nextUser.id) {
      // Same user as last apply — profile is already loaded.
      setLoading(false);
      return;
    }

    lastFetchedUserId.current = nextUser.id;
    const nextProfile = await fetchProfileWithRetry(nextUser.id);
    setProfile(nextProfile);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // 1. Read the current session (covers page reloads with a cached token).
    supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error("[AuthContext] getSession error:", error);
        setLoading(false);
        return;
      }
      applySession(data.session);
    });

    // 2. Subscribe to further changes (login, logout, token refresh).
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        applySession(session);
      }
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [applySession]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      console.error("[AuthContext] Google sign-in error:", error);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("[AuthContext] Sign-out error:", error);
      throw error;
    }
    // applySession will fire via onAuthStateChange, but clear eagerly for UX.
    setUser(null);
    setProfile(null);
    lastFetchedUserId.current = null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const next = await fetchProfile(user.id);
    setProfile(next);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      isTeacher: profile?.role === "teacher",
      loading,
      signInWithGoogle,
      signOut,
      refreshProfile,
    }),
    [user, profile, loading, signInWithGoogle, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
