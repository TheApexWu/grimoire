import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { voiceReadingPrompt } from "@/lib/prompts";
import type { VoiceReading } from "@/lib/fingerprint";

export async function POST(request: Request) {
  const { text } = await request.json();

  if (!text || typeof text !== "string" || text.trim().length < 50) {
    return Response.json(
      { error: "Text must be at least 50 characters" },
      { status: 400 }
    );
  }

  const { text: raw } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt: voiceReadingPrompt(text),
    temperature: 0.2,
    maxOutputTokens: 300,
  });

  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const reading: VoiceReading = JSON.parse(cleaned);
    return Response.json({ reading });
  } catch {
    return Response.json({
      reading: {
        emotionalTemperature: "could not determine",
        sensoryPalette: "could not determine",
        tonalRegister: "could not determine",
        imageryDensity: "could not determine",
      },
      raw,
    });
  }
}
