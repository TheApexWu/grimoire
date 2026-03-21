import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { insightPrompt } from "@/lib/prompts";
import type { StatFingerprint } from "@/lib/fingerprint";

export async function POST(request: Request) {
  const { nameA, nameB, fpA, fpB } = (await request.json()) as {
    nameA: string;
    nameB: string;
    fpA: StatFingerprint;
    fpB: StatFingerprint;
  };

  if (!fpA || !fpB) {
    return Response.json(
      { error: "fpA and fpB required" },
      { status: 400 }
    );
  }

  const { text } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt: insightPrompt({ nameA, nameB, fpA, fpB }),
    temperature: 0.3,
    maxOutputTokens: 300,
  });

  return Response.json({ insights: text });
}
