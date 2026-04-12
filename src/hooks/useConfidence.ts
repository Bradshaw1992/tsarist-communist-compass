// =============================================================================
// useConfidence — per-spec self-rated confidence
// =============================================================================
// Students can set a 3-level confidence rating on each spec point:
//   "none"      — haven't a clue / haven't looked at it
//   "shaky"     — I've seen it but wouldn't trust myself
//   "confident" — I know this topic well
//
// The rating feeds into:
//   • Dashboard next-best-action (prioritise "shaky" specs for drilling)
//   • Topics page colour-coding of spec cards
//   • Coverage grid on the Dashboard
//   • Weakest-topics ranking
//
// Storage: localStorage first (instant, works for anonymous users), Supabase
// sync when signed in and when the user_spec_confidence table exists. If the
// table hasn't been created yet the hook silently falls back to localStorage
// only — no crashes, no data loss.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ConfidenceLevel = "none" | "shaky" | "confident";

export type ConfidenceMap = Record<number, ConfidenceLevel>;

const STORAGE_KEY = "russia-spec-confidence";

function loadLocal(): ConfidenceMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocal(map: ConfidenceMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignored
  }
}

export function useConfidence() {
  const { user } = useAuth();
  const [confidence, setConfidence] = useState<ConfidenceMap>(loadLocal);

  // Hydrate from Supabase on sign-in. Merge: Supabase wins where set,
  // local fills gaps.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_spec_confidence" as never)
          .select("spec_id, confidence")
          .eq("user_id", user.id);

        if (cancelled) return;
        if (error) {
          // Table doesn't exist yet — silent fallback.
          return;
        }

        if (data && Array.isArray(data) && data.length > 0) {
          setConfidence((prev) => {
            const merged = { ...prev };
            for (const row of data as { spec_id: number; confidence: string }[]) {
              const val = row.confidence as ConfidenceLevel;
              if (val === "none" || val === "shaky" || val === "confident") {
                merged[row.spec_id] = val;
              }
            }
            saveLocal(merged);
            return merged;
          });
        }
      } catch {
        // Table missing — silent fallback.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Cross-tab sync.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setConfidence(loadLocal());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setSpecConfidence = useCallback(
    async (specId: number, level: ConfidenceLevel) => {
      setConfidence((prev) => {
        const next = { ...prev, [specId]: level };
        saveLocal(next);
        return next;
      });

      if (!user) return;

      // Best-effort Supabase upsert (table may not exist yet).
      try {
        await supabase
          .from("user_spec_confidence" as never)
          .upsert(
            {
              user_id: user.id,
              spec_id: specId,
              confidence: level,
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "user_id,spec_id" }
          );
      } catch {
        // Silent fallback — localStorage still has it.
      }
    },
    [user]
  );

  const getConfidence = useCallback(
    (specId: number): ConfidenceLevel => confidence[specId] ?? "none",
    [confidence]
  );

  return {
    confidence,
    getConfidence,
    setSpecConfidence,
  };
}
