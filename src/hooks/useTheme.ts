// =============================================================================
// useTheme — light / dark / system toggle
// =============================================================================
// Reads the saved preference from localStorage (or falls back to the user's
// OS preference), writes the `dark` class onto <html>, and exposes a setter.
// Intentionally tiny — no context provider, no reducers, just a hook that
// the UserMenu calls to switch modes. Dark mode was already defined in
// index.css, we just needed a way to actually turn it on.
// =============================================================================

import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "russia-theme";

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // ignored
  }
  // Light is the default — the app is designed light-first and should look
  // light-first to every new visitor, regardless of what they have their OS
  // set to. Dark mode is a deliberate opt-in from the account menu.
  return "light";
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function applyTheme(pref: ThemePreference) {
  if (typeof document === "undefined") return;
  const isDark = pref === "dark" || (pref === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", isDark);
}

/** Run once at app boot before React paints, so there's no flash. */
export function initTheme() {
  applyTheme(readStoredPreference());
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readStoredPreference);

  // Apply whenever preference changes.
  useEffect(() => {
    applyTheme(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // ignored
    }
  }, [preference]);

  // If the user's preference is "system", react to OS-level changes live.
  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [preference]);

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next);
  }, []);

  const isDark =
    preference === "dark" || (preference === "system" && systemPrefersDark());

  return { preference, setTheme, isDark };
}
