// Core fingerprint metrics for style analysis
// 6 statistical metrics computed entirely client-side

/**
 * Count syllables in a word using vowel-group heuristic.
 */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 2) return 1;

  let count = 0;
  let prevVowel = false;
  const vowels = "aeiouy";

  for (let i = 0; i < w.length; i++) {
    const isVowel = vowels.includes(w[i]);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }

  if (w.endsWith("e") && !w.endsWith("le") && count > 1) count--;
  if (
    w.endsWith("ed") &&
    w.length > 3 &&
    !w.endsWith("ted") &&
    !w.endsWith("ded")
  ) {
    count = Math.max(1, count - 1);
  }

  return Math.max(1, count);
}

/**
 * 1. Monosyllable ratio
 * % of words that are single-syllable.
 */
export function monosyllableRatio(text: string): number {
  const words = text.match(/[a-zA-Z]+/g);
  if (!words || words.length === 0) return 0;
  const monoCount = words.filter((w) => countSyllables(w) === 1).length;
  return monoCount / words.length;
}

/**
 * 2. Sentence length distribution
 * Mean, std, skew of sentence lengths in words.
 */
export function sentenceLengthDistribution(text: string): {
  mean: number;
  std: number;
  skew: number;
} {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) return { mean: 0, std: 0, skew: 0 };

  const lengths = sentences.map(
    (s) => (s.match(/[a-zA-Z]+/g) || []).length
  );

  const n = lengths.length;
  const mean = lengths.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { mean, std: 0, skew: 0 };

  const variance = lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  if (std === 0) return { mean, std: 0, skew: 0 };

  const skew =
    lengths.reduce((sum, l) => sum + ((l - mean) / std) ** 3, 0) / n;

  return {
    mean: Math.round(mean * 100) / 100,
    std: Math.round(std * 100) / 100,
    skew: Math.round(skew * 100) / 100,
  };
}

/**
 * 3. Punctuation signature
 * Comma, semicolon, period rates per sentence.
 */
export function punctuationSignature(text: string): {
  commaRate: number;
  semicolonRate: number;
  periodRate: number;
} {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const sentenceCount = Math.max(1, sentences.length);
  const commas = (text.match(/,/g) || []).length;
  const semicolons = (text.match(/;/g) || []).length;
  const periods = (text.match(/\./g) || []).length;

  return {
    commaRate: Math.round((commas / sentenceCount) * 1000) / 1000,
    semicolonRate: Math.round((semicolons / sentenceCount) * 1000) / 1000,
    periodRate: Math.round((periods / sentenceCount) * 1000) / 1000,
  };
}

/**
 * 4. Lexical diversity
 * Type-token ratio computed over sliding 100-word windows, then averaged.
 * Higher = more varied vocabulary. Literary fiction ~0.7, pulp ~0.5.
 */
export function lexicalDiversity(text: string): number {
  const words = (text.match(/[a-zA-Z]+/g) || []).map((w) => w.toLowerCase());
  if (words.length < 20) return 0;

  const windowSize = 100;
  if (words.length <= windowSize) {
    const unique = new Set(words).size;
    return Math.round((unique / words.length) * 1000) / 1000;
  }

  let totalTTR = 0;
  let windowCount = 0;

  for (let i = 0; i <= words.length - windowSize; i += 50) {
    const window = words.slice(i, i + windowSize);
    const unique = new Set(window).size;
    totalTTR += unique / windowSize;
    windowCount++;
  }

  return Math.round((totalTTR / windowCount) * 1000) / 1000;
}

/**
 * 5. Conjunction density
 * Rate of coordinating conjunctions (and, but, or, yet, so, nor) per sentence.
 * Hemingway famously high on "and." Poe uses subordination instead.
 */
export function conjunctionDensity(text: string): number {
  const conjunctions = /\b(and|but|or|yet|so|nor)\b/gi;
  const matches = text.match(conjunctions) || [];

  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const sentenceCount = Math.max(1, sentences.length);
  return Math.round((matches.length / sentenceCount) * 1000) / 1000;
}

/**
 * 6. Paragraph rhythm
 * Measures how many sentences per paragraph (mean) and how much that varies (std).
 * Short uniform paragraphs = staccato. Long varied = essayistic.
 */
export function paragraphRhythm(text: string): {
  meanSentences: number;
  stdSentences: number;
} {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) return { meanSentences: 0, stdSentences: 0 };

  const counts = paragraphs.map(
    (p) =>
      p
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0).length
  );

  const n = counts.length;
  const mean = counts.reduce((a, b) => a + b, 0) / n;

  if (n < 2) return { meanSentences: Math.round(mean * 100) / 100, stdSentences: 0 };

  const variance = counts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  return {
    meanSentences: Math.round(mean * 100) / 100,
    stdSentences: Math.round(std * 100) / 100,
  };
}
