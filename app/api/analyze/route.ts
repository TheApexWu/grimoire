import { generateText } from "ai";
import { flashLite, SAFETY_OFF } from "@/lib/gemini";
import {
  computeStatFingerprint,
  statFingerprintToRadar,
  compareFingerprints,
} from "@/lib/fingerprint";
import { voiceReadingPrompt, insightPrompt } from "@/lib/prompts";

interface TextInput {
  text: string;
  name: string;
}

export async function POST(request: Request) {
  const { texts } = (await request.json()) as { texts: TextInput[] };

  if (!texts?.length || texts.length > 2) {
    return Response.json(
      { error: "texts array (1-2 entries) required" },
      { status: 400 }
    );
  }

  for (const t of texts) {
    if (!t.text || t.text.trim().length < 50) {
      return Response.json(
        { error: "Each text must be at least 50 characters" },
        { status: 400 }
      );
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        // Phase 1: Instant fingerprints (pure compute, zero latency)
        const fingerprints = texts.map((t, i) => {
          const stats = computeStatFingerprint(t.text);
          const radar = statFingerprintToRadar(stats);
          return { index: i, name: t.name || `Text ${i + 1}`, stats, radar };
        });

        send("fingerprints", { results: fingerprints });

        // Phase 2: Distance (pure compute, only for 2-text comparison)
        if (texts.length === 2) {
          const comparison = compareFingerprints(
            fingerprints[0].stats,
            fingerprints[1].stats
          );
          send("distance", {
            value: comparison.totalDistance,
            gapAnalysis: comparison.gapAnalysis,
          });
        }

        // Phase 3: LLM calls in parallel (voice readings + insights)
        const llmCalls: Promise<void>[] = [];

        for (let i = 0; i < texts.length; i++) {
          llmCalls.push(
            generateText({
              model: flashLite,
              providerOptions: SAFETY_OFF,
              prompt: voiceReadingPrompt(texts[i].text),
              temperature: 0.2,
              maxOutputTokens: 300,
            }).then(({ text: raw }) => {
              try {
                const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
                const reading = JSON.parse(cleaned);
                send("voice", {
                  index: i,
                  name: fingerprints[i].name,
                  reading,
                });
              } catch {
                send("voice", {
                  index: i,
                  name: fingerprints[i].name,
                  reading: {
                    emotionalTemperature: "could not determine",
                    sensoryPalette: "could not determine",
                    tonalRegister: "could not determine",
                    imageryDensity: "could not determine",
                  },
                });
              }
            })
          );
        }

        if (texts.length === 2) {
          llmCalls.push(
            generateText({
              model: flashLite,
              providerOptions: SAFETY_OFF,
              prompt: insightPrompt({
                nameA: fingerprints[0].name,
                nameB: fingerprints[1].name,
                fpA: fingerprints[0].stats,
                fpB: fingerprints[1].stats,
              }),
              temperature: 0.3,
              maxOutputTokens: 300,
            }).then(({ text }) => {
              send("insights", { text });
            })
          );
        }

        await Promise.all(llmCalls);
        send("done", {});
      } catch (err) {
        send("error", {
          error: err instanceof Error ? err.message : "Analysis failed",
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
