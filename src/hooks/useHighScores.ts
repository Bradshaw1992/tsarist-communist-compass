import { useState, useCallback, useEffect } from "react";

export interface TopicProgress {
  highScore: number; // percentage 0-100
  total: number;
  correct: number;
  lastAttempted: string; // ISO date string
}

const STORAGE_KEY = "russia-revision-progress";

function loadAll(): Record<number, TopicProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<number, TopicProgress>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useHighScores() {
  const [scores, setScores] = useState<Record<number, TopicProgress>>(loadAll);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setScores(loadAll());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const recordScore = useCallback((specId: number, correct: number, total: number) => {
    setScores((prev) => {
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      const existing = prev[specId];
      const isNewHigh = !existing || pct > existing.highScore;
      const next = {
        ...prev,
        [specId]: {
          highScore: isNewHigh ? pct : existing.highScore,
          total,
          correct: isNewHigh ? correct : existing.correct,
          lastAttempted: new Date().toISOString(),
        },
      };
      saveAll(next);
      return next;
    });
  }, []);

  const getProgress = useCallback(
    (specId: number): TopicProgress | undefined => scores[specId],
    [scores]
  );

  return { scores, recordScore, getProgress };
}
