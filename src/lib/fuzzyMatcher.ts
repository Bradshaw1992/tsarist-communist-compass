/**
 * Historical Fuzzy Matcher
 * Provides typo-tolerant, academically-aware answer matching for quizzes and recall.
 */

// ── Stop words ──
const STOP_WORDS = new Set([
  "the", "a", "an", "of", "in", "to", "was", "is", "and", "for", "by", "with",
  "on", "at", "from", "that", "it", "as", "be", "are", "were", "been", "being",
  "had", "has", "have", "do", "does", "did", "but", "or", "not", "this", "which",
]);

// ── Date / number normalization ──
const MONTH_ABBREVS: Record<string, string> = {
  jan: "january", feb: "february", mar: "march", apr: "april",
  jun: "june", jul: "july", aug: "august", sep: "september",
  sept: "september", oct: "october", nov: "november", dec: "december",
};

const NUMBER_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15",
  sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
  first: "1st", second: "2nd", third: "3rd", fourth: "4th", fifth: "5th",
};

// ── Basic stemmer (suffix stripping) ──
function stem(word: string): string {
  if (word.length < 4) return word;
  return word
    .replace(/isation$|ization$/, "ize")
    .replace(/ising$|izing$/, "ize")
    .replace(/ised$|ized$/, "ize")
    .replace(/ation$/, "ate")
    .replace(/ness$/, "")
    .replace(/ment$/, "")
    .replace(/ful$/, "")
    .replace(/ous$/, "")
    .replace(/ive$/, "")
    .replace(/ism$/, "")
    .replace(/ist$/, "")
    .replace(/ity$/, "")
    .replace(/ies$/, "y")
    .replace(/ing$/, "")
    .replace(/tion$/, "t")
    .replace(/sion$/, "s")
    .replace(/ed$/, "")
    .replace(/ly$/, "")
    .replace(/er$/, "")
    .replace(/es$/, "")
    .replace(/s$/, "");
}

// ── Levenshtein distance ──
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

// ── Text cleaning ──
export function cleanText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeWord(word: string): string {
  const lower = word.toLowerCase();
  // Month abbreviation expansion
  if (MONTH_ABBREVS[lower]) return MONTH_ABBREVS[lower];
  // Number word → digit
  if (NUMBER_WORDS[lower]) return NUMBER_WORDS[lower];
  return lower;
}

function tokenize(text: string): string[] {
  return cleanText(text).split(/\s+/).filter(Boolean);
}

function removeStopWords(tokens: string[]): string[] {
  return tokens.filter((t) => !STOP_WORDS.has(t));
}

function normalizeTokens(tokens: string[]): string[] {
  return tokens.map(normalizeWord);
}

// ── Core matching: does `input` fuzzy-match `target`? ──
function fuzzyWordMatch(inputWord: string, targetWord: string): boolean {
  const a = normalizeWord(inputWord);
  const b = normalizeWord(targetWord);
  if (a === b) return true;
  if (stem(a) === stem(b)) return true;
  // Levenshtein tolerance (only for words ≥ 3 chars to avoid false positives)
  if (a.length >= 3 && b.length >= 3 && levenshtein(a, b) <= 2) return true;
  return false;
}

// ── Public: Check quiz answer (SpecificKnowledge) ──
export function fuzzyCheckAnswer(input: string, synonyms: string[]): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  const inputCleaned = cleanText(trimmed);
  const inputTokens = removeStopWords(normalizeTokens(tokenize(trimmed)));

  for (const synonym of synonyms) {
    const synCleaned = cleanText(synonym);

    // 1. Exact / near-exact after cleaning
    if (inputCleaned === synCleaned) return true;
    if (levenshtein(inputCleaned, synCleaned) <= 2) return true;

    // 2. Contains strategy: if the synonym (core fact) appears in the input
    if (inputCleaned.includes(synCleaned) || synCleaned.includes(inputCleaned)) return true;

    // 3. Token-level matching with stemming + Levenshtein
    const synTokens = removeStopWords(normalizeTokens(tokenize(synonym)));
    if (synTokens.length === 0) continue;

    // Check if all synonym tokens are matched by some input token
    const matchedCount = synTokens.filter((st) =>
      inputTokens.some((it) => fuzzyWordMatch(it, st))
    ).length;

    if (matchedCount === synTokens.length) return true;

    // Also check if all input tokens match synonym tokens (student typed subset)
    if (inputTokens.length > 0) {
      const reverseCount = inputTokens.filter((it) =>
        synTokens.some((st) => fuzzyWordMatch(it, st))
      ).length;
      if (reverseCount === inputTokens.length && inputTokens.length >= synTokens.length * 0.5) {
        return true;
      }
    }
  }

  return false;
}

// ── Public: Check if a keyword fuzzy-matches anywhere in text (BlankRecall) ──
export function fuzzyKeywordInText(text: string, keyword: string): boolean {
  const textCleaned = cleanText(text);
  const kwCleaned = cleanText(keyword);

  // Direct substring
  if (textCleaned.includes(kwCleaned)) return true;

  // Token-level: all keyword tokens must fuzzy-match some text token
  const textTokens = normalizeTokens(tokenize(text));
  const kwTokens = removeStopWords(normalizeTokens(tokenize(keyword)));

  if (kwTokens.length === 0) return false;

  const matchedAll = kwTokens.every((kt) =>
    textTokens.some((tt) => fuzzyWordMatch(tt, kt))
  );

  return matchedAll;
}
