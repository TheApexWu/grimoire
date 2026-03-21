import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { judgePrompt } from "@/lib/prompts";

export async function POST(request: Request) {
  const { originalText, generatedText } = await request.json();

  if (!originalText || !generatedText) {
    return Response.json(
      { error: "originalText and generatedText required" },
      { status: 400 }
    );
  }

  const { text } = await generateText({
    model: google("gemini-3.1-pro-preview"),
    prompt: judgePrompt({ textA: originalText, textB: generatedText }),
    temperature: 0.1,
    maxOutputTokens: 200,
  });

  // Parse JSON response from judge
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const verdict = JSON.parse(cleaned);
    return Response.json({
      sameAuthor: verdict.sameAuthor ?? false,
      confidence: verdict.confidence ?? 0,
      reasoning: verdict.reasoning ?? "No reasoning provided",
    });
  } catch {
    return Response.json({
      sameAuthor: false,
      confidence: 0,
      reasoning: "Judge response could not be parsed",
      raw: text,
    });
  }
}
