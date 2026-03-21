import {
  monosyllableRatio,
  sentenceLengthDistribution,
  punctuationSignature,
  lexicalDiversity,
  conjunctionDensity,
  paragraphRhythm,
} from "./metrics";

// --- Statistical fingerprint (computed instantly, no API) ---

export interface StatFingerprint {
  monosyllableRatio: number;
  sentenceMean: number;
  sentenceStd: number;
  sentenceSkew: number;
  commaRate: number;
  semicolonRate: number;
  periodRate: number;
  lexicalDiversity: number;
  conjunctionDensity: number;
  paragraphMean: number;
  paragraphStd: number;
}

// --- Subjective voice reading (from LLM) ---

export interface VoiceReading {
  emotionalTemperature: string; // e.g. "cold detachment", "feverish intensity"
  sensoryPalette: string; // e.g. "visual-tactile", "interior-temporal"
  tonalRegister: string; // e.g. "formal-earnest", "casual-ironic"
  imageryDensity: string; // e.g. "high concrete", "abstract-philosophical"
}

// --- Full fingerprint = stats + voice reading ---

export interface Fingerprint {
  stats: StatFingerprint;
  voice: VoiceReading | null; // null until LLM reading completes
}

export interface FingerprintComparison {
  target: StatFingerprint;
  candidate: StatFingerprint;
  distances: Record<string, number>;
  totalDistance: number;
  gapAnalysis: string;
}

/**
 * Compute statistical fingerprint from raw text. Instant, no API call.
 */
export function computeStatFingerprint(text: string): StatFingerprint {
  const mono = monosyllableRatio(text);
  const sent = sentenceLengthDistribution(text);
  const punct = punctuationSignature(text);
  const lex = lexicalDiversity(text);
  const conj = conjunctionDensity(text);
  const para = paragraphRhythm(text);

  return {
    monosyllableRatio: mono,
    sentenceMean: sent.mean,
    sentenceStd: sent.std,
    sentenceSkew: sent.skew,
    commaRate: punct.commaRate,
    semicolonRate: punct.semicolonRate,
    periodRate: punct.periodRate,
    lexicalDiversity: lex,
    conjunctionDensity: conj,
    paragraphMean: para.meanSentences,
    paragraphStd: para.stdSentences,
  };
}

/**
 * Compare two stat fingerprints. Returns per-metric distances and total.
 */
export function compareFingerprints(
  target: StatFingerprint,
  candidate: StatFingerprint
): FingerprintComparison {
  // Only metrics that are reliable on pasted text (no paragraph structure)
  const ranges: Record<string, [number, number]> = {
    monosyllableRatio: [0.5, 1.0],
    sentenceMean: [5, 50],
    sentenceStd: [2, 30],
    sentenceSkew: [-1, 4],
    commaRate: [0, 5],
    semicolonRate: [0, 1],
    periodRate: [0, 3],
    lexicalDiversity: [0.3, 0.85],
    conjunctionDensity: [0, 3],
    // paragraphMean/paragraphStd excluded: unreliable on pasted text without \n\n breaks
  };

  const distances: Record<string, number> = {};
  let totalSquared = 0;
  const keys = Object.keys(ranges) as (keyof StatFingerprint)[];

  for (const key of keys) {
    const [min, max] = ranges[key];
    const range = max - min;
    const normTarget = clamp01((target[key] - min) / range);
    const normCandidate = clamp01((candidate[key] - min) / range);
    const dist = Math.abs(normTarget - normCandidate);
    distances[key] = Math.round(dist * 1000) / 1000;
    totalSquared += dist * dist;
  }

  const totalDistance =
    Math.round(Math.sqrt(totalSquared / keys.length) * 1000) / 1000;

  const gaps = Object.entries(distances)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([metric, dist]) => {
      const tVal = target[metric as keyof StatFingerprint];
      const cVal = candidate[metric as keyof StatFingerprint];
      const direction = cVal > tVal ? "too high" : "too low";
      return `${metric}: ${direction} (target=${tVal}, got=${cVal}, gap=${dist})`;
    });

  return {
    target,
    candidate,
    distances,
    totalDistance,
    gapAnalysis: gaps.join("\n"),
  };
}

/**
 * Radar-chart-friendly format for stat fingerprint. All values normalized to 0-1.
 */
export function statFingerprintToRadar(
  fp: StatFingerprint
): { label: string; value: number }[] {
  return [
    {
      label: "Monosyllable %",
      value: clamp01((fp.monosyllableRatio - 0.5) / 0.5),
    },
    {
      label: "Sentence Length",
      value: clamp01((fp.sentenceMean - 5) / 45),
    },
    {
      label: "Sentence Variation",
      value: clamp01((fp.sentenceStd - 2) / 28),
    },
    {
      label: "Comma Density",
      value: clamp01(fp.commaRate / 5),
    },
    {
      label: "Semicolons",
      value: clamp01(fp.semicolonRate / 1),
    },
    {
      label: "Lexical Diversity",
      value: clamp01((fp.lexicalDiversity - 0.3) / 0.55),
    },
    {
      label: "Conjunctions",
      value: clamp01(fp.conjunctionDensity / 3),
    },
  ];
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Metric-targeted correction: find the worst metric and return
 * a specific, actionable writing instruction to fix it.
 */
const METRIC_ADVICE: Record<
  string,
  { high: string; low: string; label: string }
> = {
  monosyllableRatio: {
    label: "Monosyllable ratio",
    low: "Use shorter, simpler words. Replace polysyllabic words with one-syllable alternatives (e.g. 'got' not 'obtained', 'big' not 'enormous', 'end' not 'terminate').",
    high: "Use more complex, multi-syllable vocabulary. Replace simple words with richer alternatives (e.g. 'illuminate' not 'light', 'contemplate' not 'think').",
  },
  sentenceMean: {
    label: "Sentence length",
    low: "Write longer sentences. Combine short clauses with commas, semicolons, and conjunctions into flowing compound sentences.",
    high: "Break long sentences into shorter ones. Use more periods. Let single ideas stand alone.",
  },
  sentenceStd: {
    label: "Sentence variation",
    low: "Vary sentence lengths dramatically. Alternate between very short punchy sentences and longer flowing ones.",
    high: "Make sentence lengths more uniform. Aim for consistent rhythm rather than dramatic variation.",
  },
  commaRate: {
    label: "Comma density",
    low: "Use more commas. Add subordinate clauses, appositives, and inline lists to create more pauses.",
    high: "Reduce commas. Simplify sentence structure. Remove unnecessary subordinate clauses.",
  },
  semicolonRate: {
    label: "Semicolon usage",
    low: "Use semicolons to join closely related independent clauses instead of periods.",
    high: "Replace semicolons with periods or restructure as single sentences.",
  },
  lexicalDiversity: {
    label: "Vocabulary variety",
    low: "Use more varied vocabulary. Find synonyms instead of repeating the same words.",
    high: "Repeat key words intentionally. Use a narrower, more focused vocabulary.",
  },
  conjunctionDensity: {
    label: "Conjunction frequency",
    low: "Use more conjunctions (and, but, or, yet) to connect clauses within sentences.",
    high: "Reduce conjunctions. Use periods to separate ideas instead of chaining with 'and' or 'but'.",
  },
};

export function metricCorrectionDirective(
  target: StatFingerprint,
  candidate: StatFingerprint
): string {
  const comparison = compareFingerprints(target, candidate);
  const sorted = Object.entries(comparison.distances).sort(
    ([, a], [, b]) => b - a
  );

  const directives: string[] = [];
  const top = sorted.slice(0, 2);

  for (const [metric, dist] of top) {
    if (dist < 0.05) continue;
    const advice = METRIC_ADVICE[metric];
    if (!advice) continue;

    const tVal = target[metric as keyof StatFingerprint];
    const cVal = candidate[metric as keyof StatFingerprint];
    const direction = cVal > tVal ? "high" : "low";
    const pct = (dist * 100).toFixed(0);

    directives.push(
      `PRIORITY FIX - ${advice.label} (${pct}% off target): yours=${typeof cVal === "number" ? cVal.toFixed(2) : cVal}, target=${typeof tVal === "number" ? tVal.toFixed(2) : tVal}. ${advice[direction]}`
    );
  }

  if (directives.length === 0) return "Metrics are close. Maintain current style.";
  return directives.join("\n\n");
}
