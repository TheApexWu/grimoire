import { computeStatFingerprint, statFingerprintToRadar } from "@/lib/fingerprint";

export async function POST(request: Request) {
  const { text } = await request.json();

  if (!text || typeof text !== "string" || text.trim().length < 50) {
    return Response.json(
      { error: "Text must be at least 50 characters" },
      { status: 400 }
    );
  }

  const stats = computeStatFingerprint(text);
  const radar = statFingerprintToRadar(stats);

  return Response.json({ stats, radar });
}
