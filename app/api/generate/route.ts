import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { computeStatFingerprint, compareFingerprints } from "@/lib/fingerprint";
import type { StatFingerprint } from "@/lib/fingerprint";
import { generationPrompt } from "@/lib/prompts";

interface RoundResult {
  round: number;
  candidates: { text: string; distance: number }[];
  bestText: string;
  bestDistance: number;
  gapAnalysis: string;
  bestFingerprint: StatFingerprint;
}

export async function POST(request: Request) {
  const { text, targetFingerprint, rounds = 3, topic } = await request.json();

  if (!text || !targetFingerprint) {
    return Response.json(
      { error: "text and targetFingerprint required" },
      { status: 400 }
    );
  }

  const target: StatFingerprint = targetFingerprint;
  const sampleText = text.slice(0, 3000);
  const results: RoundResult[] = [];
  let previousGapAnalysis: string | undefined;

  for (let round = 1; round <= rounds; round++) {
    const temperatures = [0.7, 0.9, 1.1];
    const candidatePromises = temperatures.map((temp) =>
      generateText({
        model: google("gemini-2.0-flash"),
        prompt: generationPrompt({
          sampleText,
          targetFingerprint: target,
          topic,
          gapAnalysis: previousGapAnalysis,
          round,
        }),
        temperature: temp,
        maxOutputTokens: 500,
      })
    );

    const responses = await Promise.all(candidatePromises);

    const scored = responses.map((r) => {
      const candidateFp = computeStatFingerprint(r.text);
      const comparison = compareFingerprints(target, candidateFp);
      return {
        text: r.text,
        distance: comparison.totalDistance,
        fingerprint: candidateFp,
        gapAnalysis: comparison.gapAnalysis,
      };
    });

    scored.sort((a, b) => a.distance - b.distance);
    const best = scored[0];

    results.push({
      round,
      candidates: scored.map((s) => ({ text: s.text, distance: s.distance })),
      bestText: best.text,
      bestDistance: best.distance,
      gapAnalysis: best.gapAnalysis,
      bestFingerprint: best.fingerprint,
    });

    previousGapAnalysis = best.gapAnalysis;
  }

  return Response.json({
    results,
    finalText: results[results.length - 1].bestText,
    finalDistance: results[results.length - 1].bestDistance,
    finalFingerprint: results[results.length - 1].bestFingerprint,
    convergence: results.map((r) => ({
      round: r.round,
      distance: r.bestDistance,
    })),
  });
}
