// =============================================================================
// useUserTier — resolves the signed-in user's membership tier.
// =============================================================================
// Calls the `user_tier` Postgres function (SECURITY DEFINER, granted to
// authenticated) which returns 'free' | 'nomenklatura' | 'politburo'. Used to
// decide whether to show the "Upgrade to Nomenklatura" prompts. Returns null
// (and loading) for anonymous users or while the lookup is in flight, so callers
// can avoid a flicker.
// =============================================================================

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type UserTier = "free" | "nomenklatura" | "politburo";

export function useUserTier(): { tier: UserTier | null; loading: boolean } {
  const { user } = useAuth();
  const [tier, setTier] = useState<UserTier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTier(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("user_tier", { p_user_id: user.id })
      .then(({ data, error }) => {
        if (cancelled) return;
        setTier(error || !data ? null : (data as UserTier));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { tier, loading };
}
