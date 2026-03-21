import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { judgePrompt } from "@/lib/prompts";

function parseVerdict(raw: string): {
  sameAuthor: boolean;
  confidence: number;
  reasoning: string;
} | null {
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const v = JSON.parse(cleaned);
    return {
      sameAuthor: v.sameAuthor ?? false,
      confidence: v.confidence ?? 0,
      reasoning: v.reasoning ?? "No reasoning provided",
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const { originalText, generatedText } = await request.json();

  if (!originalText || !generatedText) {
    return Response.json(
      { error: "originalText and generatedText required" },
      { status: 400 }
    );
  }

  // Run judge twice with swapped positions to cancel position bias
  const [run1, run2] = await Promise.all([
    generateText({
      model: google("gemini-3.1-pro-preview"),
      prompt: judgePrompt({ textA: originalText, textB: generatedText }),
      temperature: 0.1,
      maxOutputTokens: 200,
    }),
    generateText({
      model: google("gemini-3.1-pro-preview"),
      prompt: judgePrompt({ textA: generatedText, textB: originalText }),
      temperature: 0.1,
      maxOutputTokens: 200,
    }),
  ]);

  const v1 = parseVerdict(run1.text);
  const v2 = parseVerdict(run2.text);

  // Both failed to parse
  if (!v1 && !v2) {
    return Response.json({
      sameAuthor: false,
      confidence: 0,
      reasoning: "Judge response could not be parsed",
      raw: [run1.text, run2.text],
    });
  }

  // One failed: use the other
  if (!v1) return Response.json(v2);
  if (!v2) return Response.json(v1);

  // Both succeeded: average confidence, majority vote
  const avgConfidence = Math.round(((v1.confidence + v2.confidence) / 2) * 100) / 100;

  if (v1.sameAuthor === v2.sameAuthor) {
    // Agreement: use averaged confidence
    return Response.json({
      sameAuthor: v1.sameAuthor,
      confidence: avgConfidence,
      reasoning: v1.reasoning,
      dualRun: true,
      agreement: true,
    });
  }

  // Disagreement: lower confidence, side with higher-confidence run
  const winner = v1.confidence >= v2.confidence ? v1 : v2;
  return Response.json({
    sameAuthor: winner.sameAuthor,
    confidence: Math.round(avgConfidence * 0.7 * 100) / 100,
    reasoning: `Split verdict (position bias detected). ${winner.reasoning}`,
    dualRun: true,
    agreement: false,
  });
}
