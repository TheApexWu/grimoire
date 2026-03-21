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
  const ranges: Record<keyof StatFingerprint, [number, number]> = {
    monosyllableRatio: [0.5, 1.0],
    sentenceMean: [5, 50],
    sentenceStd: [2, 30],
    sentenceSkew: [-1, 4],
    commaRate: [0, 5],
    semicolonRate: [0, 1],
    periodRate: [0, 3],
    lexicalDiversity: [0.3, 0.85],
    conjunctionDensity: [0, 3],
    paragraphMean: [1, 15],
    paragraphStd: [0, 8],
  };

  const distances: Record<string, number> = {};
  let totalSquared = 0;
  const keys = Object.keys(ranges) as (keyof StatFingerprint)[];

  for (const key of keys) {
    const [min, max] = ranges[key];
    const range = max - min;
    const normTarget = (target[key] - min) / range;
    const normCandidate = (candidate[key] - min) / range;
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
    {
      label: "Paragraph Length",
      value: clamp01((fp.paragraphMean - 1) / 14),
    },
  ];
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
