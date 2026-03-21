import { generateText } from "ai";
import { flash, SAFETY_OFF } from "@/lib/gemini";
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
    model: flash,
    providerOptions: SAFETY_OFF,
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
