import { google } from "@ai-sdk/google";

export const flashLite = google("gemini-2.5-flash-lite");
export const flash = google("gemini-2.5-flash");
export const proPreview = google("gemini-3.1-pro-preview");

export const SAFETY_OFF = {
  google: {
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH" as const, threshold: "BLOCK_NONE" as const },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT" as const, threshold: "BLOCK_NONE" as const },
      { category: "HARM_CATEGORY_HARASSMENT" as const, threshold: "BLOCK_NONE" as const },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT" as const, threshold: "BLOCK_NONE" as const },
    ],
  },
};
