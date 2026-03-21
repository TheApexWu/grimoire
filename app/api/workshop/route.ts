import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import {
  computeStatFingerprint,
  compareFingerprints,
  statFingerprintToRadar,
} from "@/lib/fingerprint";
import type { StatFingerprint } from "@/lib/fingerprint";
import { coachPrompt, generationPrompt } from "@/lib/prompts";

type Mode = "coach" | "generate";

interface CoachInput {
  mode: "coach";
  userText: string;
  targetSample: string;
  targetFingerprint: StatFingerprint;
  rounds?: number;
}

interface GenerateInput {
  mode: "generate";
  sampleText: string;
  targetFingerprint: StatFingerprint;
  rounds?: number;
  topic?: string;
}

type WorkshopInput = CoachInput | GenerateInput;

export async function POST(request: Request) {
  const body = (await request.json()) as WorkshopInput;
  const mode: Mode = body.mode || "coach";
  const rounds = body.rounds || 3;

  if (mode === "coach") {
    const { userText, targetSample, targetFingerprint } = body as CoachInput;
    if (!userText || !targetSample || !targetFingerprint) {
      return Response.json(
        { error: "userText, targetSample, and targetFingerprint required" },
        { status: 400 }
      );
    }
  } else {
    const { sampleText, targetFingerprint } = body as GenerateInput;
    if (!sampleText || !targetFingerprint) {
      return Response.json(
        { error: "sampleText and targetFingerprint required" },
        { status: 400 }
      );
    }
  }

  const target: StatFingerprint =
    mode === "coach"
      ? (body as CoachInput).targetFingerprint
      : (body as GenerateInput).targetFingerprint;

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
          send("round-start", { round, total: rounds, mode });

          const temperatures = [0.7, 0.9, 1.1];
          const candidatePromises = temperatures.map((temp) => {
            const prompt =
              mode === "coach"
                ? coachPrompt({
                    userText: (body as CoachInput).userText,
                    targetSample: (body as CoachInput).targetSample,
                    targetFingerprint: target,
                    gapAnalysis: previousGapAnalysis,
                    round,
                  })
                : generationPrompt({
                    sampleText: (body as GenerateInput).sampleText,
                    targetFingerprint: target,
                    topic: (body as GenerateInput).topic,
                    gapAnalysis: previousGapAnalysis,
                    round,
                  });

            return generateText({
              model: google("gemini-3.1-pro-preview"),
              prompt,
              temperature: temp,
              maxOutputTokens: mode === "coach" ? 600 : 500,
            });
          });

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
          mode,
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
          error: err instanceof Error ? err.message : "Workshop failed",
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
