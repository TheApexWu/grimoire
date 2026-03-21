import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import {
  computeStatFingerprint,
  compareFingerprints,
  statFingerprintToRadar,
} from "@/lib/fingerprint";
import type { StatFingerprint } from "@/lib/fingerprint";
import { coachPrompt } from "@/lib/prompts";

export async function POST(request: Request) {
  const {
    userText,
    targetSample,
    targetFingerprint,
    rounds = 3,
  } = await request.json();

  if (!userText || !targetSample || !targetFingerprint) {
    return Response.json(
      { error: "userText, targetSample, and targetFingerprint required" },
      { status: 400 }
    );
  }

  const target: StatFingerprint = targetFingerprint;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        let previousGapAnalysis: string | undefined;
        const allResults: {
          round: number;
          candidates: { text: string; distance: number }[];
          bestText: string;
          bestDistance: number;
          gapAnalysis: string;
          bestFingerprint: StatFingerprint;
        }[] = [];

        for (let round = 1; round <= rounds; round++) {
          send("round-start", { round, total: rounds });

          const temperatures = [0.7, 0.9, 1.1];
          const candidatePromises = temperatures.map((temp) =>
            generateText({
              model: google("gemini-3.1-pro-preview"),
              prompt: coachPrompt({
                userText,
                targetSample,
                targetFingerprint: target,
                gapAnalysis: previousGapAnalysis,
                round,
              }),
              temperature: temp,
              maxOutputTokens: 600,
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

          const roundResult = {
            round,
            candidates: scored.map((s) => ({
              text: s.text,
              distance: s.distance,
            })),
            bestText: best.text,
            bestDistance: best.distance,
            gapAnalysis: best.gapAnalysis,
            bestFingerprint: best.fingerprint,
          };

          allResults.push(roundResult);
          previousGapAnalysis = best.gapAnalysis;

          send("round-complete", {
            round,
            bestDistance: best.distance,
            bestText: best.text,
            candidates: roundResult.candidates,
            bestRadar: statFingerprintToRadar(best.fingerprint),
          });
        }

        const final = allResults[allResults.length - 1];
        send("done", {
          finalText: final.bestText,
          finalDistance: final.bestDistance,
          finalFingerprint: final.bestFingerprint,
          finalRadar: statFingerprintToRadar(final.bestFingerprint),
          convergence: allResults.map((r) => ({
            round: r.round,
            distance: r.bestDistance,
          })),
          results: allResults.map((r) => ({
            round: r.round,
            candidates: r.candidates,
            bestText: r.bestText,
            bestDistance: r.bestDistance,
            bestFingerprint: r.bestFingerprint,
          })),
        });
      } catch (err) {
        send("error", {
          error: err instanceof Error ? err.message : "Coach failed",
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
