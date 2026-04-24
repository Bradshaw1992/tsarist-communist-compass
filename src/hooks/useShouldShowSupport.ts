// =============================================================================
// useShouldShowSupport — gate for the tip-jar card and menu item
// =============================================================================
// Returns "show" unless the current user is clearly a UCS (or other real-school)
// student, i.e. signed in and a member of a class that is NOT the external
// catchall. Anonymous visitors and external catchall students both see the
// tip-jar; in-school students never do.
//
// Also returns "pending" while the class membership is being fetched, so the
// calling component can avoid rendering a flicker.
// =============================================================================

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type SupportVisibility = "show" | "hide" | "pending";

export function useShouldShowSupport(): SupportVisibility {
  const { user } = useAuth();
  const [state, setState] = useState<SupportVisibility>("pending");

  useEffect(() => {
    // Anonymous visitor — always eligible to see the tip-jar
    if (!user) {
      setState("show");
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("class_members")
        .select("class_id, classes!inner(is_external_catchall)")
        .eq("student_id", user.id);

      if (cancelled) return;

      if (error || !data || data.length === 0) {
        // No class membership on record — default to show. Safer to offer a
        // tip to a user who "shouldn't" see it than to withhold it from an
        // external student we failed to classify.
        setState("show");
        return;
      }

      // If any membership is NOT the external catch-all, treat them as a
      // real-school student and hide.
      const hasNonExternal = data.some(
        (row) => !(row.classes as { is_external_catchall: boolean })
          ?.is_external_catchall,
      );
      setState(hasNonExternal ? "hide" : "show");
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return state;
}
