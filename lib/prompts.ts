import type { StatFingerprint } from "./fingerprint";

/**
 * Prompt for subjective voice reading (4 semantic metrics).
 * Returns structured JSON from a single LLM call.
 */
export function voiceReadingPrompt(text: string): string {
  return `You are a literary critic with perfect pitch for prose style. Read this text and characterize its voice along four dimensions. Be precise and specific, not generic.

TEXT:
---
${text.slice(0, 3000)}
---

Return a JSON object with exactly these four fields:

{
  "emotionalTemperature": "<2-4 word description of the emotional register. Examples: 'cold surgical detachment', 'warm domestic intimacy', 'feverish apocalyptic intensity', 'dry amused distance'. NOT just 'positive' or 'negative'.>",
  "sensoryPalette": "<which senses dominate the prose and how. Examples: 'visual-tactile, sun and dust', 'interior-temporal, memory and duration', 'auditory-kinetic, speech and movement'. Identify the 1-2 dominant senses and their texture.>",
  "tonalRegister": "<2-3 word description of formality and stance. Examples: 'formal-earnest', 'casual-ironic', 'biblical-declarative', 'conversational-confessional', 'academic-restrained'.>",
  "imageryDensity": "<concrete vs abstract balance. Examples: 'high concrete, almost photographic', 'abstract-philosophical, ideas over objects', 'moderate, alternating scene and reflection'. How much of the prose paints pictures vs discusses concepts?>"
}

Output ONLY the JSON. No markdown fences, no commentary.`;
}

/**
 * Prompt for the style coach: rewrite user's text toward a target style.
 */
export function coachPrompt(params: {
  userText: string;
  targetSample: string;
  targetFingerprint: StatFingerprint;
  gapAnalysis?: string;
  round: number;
}): string {
  const { userText, targetSample, targetFingerprint, gapAnalysis, round } =
    params;
  const fp = targetFingerprint;

  let prompt = `You are a writing coach. Rewrite the user's text so it matches the rhythm, vocabulary, and punctuation patterns of the target author, while preserving the user's original ideas and meaning.

TARGET AUTHOR SAMPLE:
---
${targetSample.slice(0, 1500)}
---

TARGET STATISTICAL SIGNATURE:
- Monosyllable ratio: ${(fp.monosyllableRatio * 100).toFixed(1)}%
- Average sentence length: ${fp.sentenceMean} words (std dev: ${fp.sentenceStd})
- Comma rate: ${fp.commaRate} per sentence
- Semicolons: ${fp.semicolonRate} per sentence
- Lexical diversity: ${fp.lexicalDiversity} (type-token ratio)
- Conjunctions: ${fp.conjunctionDensity} per sentence

USER'S TEXT TO REWRITE:
---
${userText.slice(0, 1500)}
---

RULES:
- Keep the user's ideas, arguments, and subject matter intact.
- Transform sentence structure, word choices, and punctuation to match the target.
- Match vocabulary complexity. High monosyllable ratio = simpler, concrete words.
- Do NOT parody or exaggerate. Write naturally in the target voice.
- Output ONLY the rewritten text. No commentary.`;

  if (round > 1 && gapAnalysis) {
    prompt += `\n\nMETRIC CORRECTION (round ${round} - HIGHEST PRIORITY):
${gapAnalysis}

These are measured deviations from the target. Fix these FIRST before anything else.`;
  }

  return prompt;
}

/**
 * Prompt for generating new text in a target style.
 */
export function generationPrompt(params: {
  sampleText: string;
  targetFingerprint: StatFingerprint;
  topic?: string;
  gapAnalysis?: string;
  round: number;
}): string {
  const { sampleText, targetFingerprint, topic, gapAnalysis, round } = params;
  const fp = targetFingerprint;

  const topicLine = topic
    ? `Write about: ${topic}`
    : "Write a short passage on any subject the original author might choose.";

  let prompt = `You are a literary style mimic. Write NEW text (150-250 words) matching this voice signature.

SAMPLE TEXT:
---
${sampleText.slice(0, 2000)}
---

TARGET SIGNATURE:
- Monosyllable ratio: ${(fp.monosyllableRatio * 100).toFixed(1)}%
- Sentence length: ${fp.sentenceMean} words (std: ${fp.sentenceStd})
- Commas: ${fp.commaRate}/sent, Semicolons: ${fp.semicolonRate}/sent
- Lexical diversity: ${fp.lexicalDiversity}
- Conjunctions: ${fp.conjunctionDensity}/sent

${topicLine}

Match rhythm, punctuation, vocabulary exactly. No parody. Output ONLY the text.`;

  if (round > 1 && gapAnalysis) {
    prompt += `\n\nMETRIC CORRECTION (round ${round} - HIGHEST PRIORITY):\n${gapAnalysis}\n\nThese are measured deviations from the target. Fix these FIRST.`;
  }

  return prompt;
}

/**
 * LLM judge: blind same-author test.
 */
export function judgePrompt(params: {
  textA: string;
  textB: string;
}): string {
  return `You are a literary forensics expert. Were these two texts written by the same author?

TEXT A:
---
${params.textA.slice(0, 1500)}
---

TEXT B:
---
${params.textB.slice(0, 1500)}
---

Consider sentence structure, word choice, punctuation patterns, and voice.

You MUST respond with ONLY a JSON object, no other text before or after:
{"sameAuthor": true, "confidence": 0.85, "reasoning": "Both texts share..."}

Rules:
- sameAuthor: boolean
- confidence: number between 0.0 and 1.0
- reasoning: one sentence
- Output the JSON object and NOTHING else`;
}

/**
 * Plain-English comparison insights.
 */
export function insightPrompt(params: {
  nameA: string;
  nameB: string;
  fpA: StatFingerprint;
  fpB: StatFingerprint;
}): string {
  const { nameA, nameB, fpA, fpB } = params;
  return `Compare these two writing profiles. Give 3-4 specific, actionable observations a writer could use to shift from one style toward the other.

${nameA}:
- ${(fpA.monosyllableRatio * 100).toFixed(1)}% monosyllabic, avg sentence ${fpA.sentenceMean} words (var: ${fpA.sentenceStd})
- ${fpA.commaRate} commas/sent, ${fpA.semicolonRate} semicolons/sent
- Lexical diversity: ${fpA.lexicalDiversity}, conjunctions: ${fpA.conjunctionDensity}/sent

${nameB}:
- ${(fpB.monosyllableRatio * 100).toFixed(1)}% monosyllabic, avg sentence ${fpB.sentenceMean} words (var: ${fpB.sentenceStd})
- ${fpB.commaRate} commas/sent, ${fpB.semicolonRate} semicolons/sent
- Lexical diversity: ${fpB.lexicalDiversity}, conjunctions: ${fpB.conjunctionDensity}/sent

Write each insight as a short, direct observation. No intro or summary.`;
}

/**
 * OCR text extraction from image.
 */
export function ocrPrompt(): string {
  return `Extract all visible text from this image. Preserve paragraph breaks. Correct obvious OCR artifacts. Output ONLY the extracted text.`;
}
