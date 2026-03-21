import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { ocrPrompt } from "@/lib/prompts";

export async function POST(request: Request) {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;

  if (!image) {
    return Response.json({ error: "No image provided" }, { status: 400 });
  }

  const bytes = await image.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mimeType = image.type || "image/jpeg";

  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: `data:${mimeType};base64,${base64}`,
          },
          {
            type: "text",
            text: ocrPrompt(),
          },
        ],
      },
    ],
  });

  return Response.json({ text });
}
