# Grimoire

Agentic writing workshop. Clone any writing voice with statistical proof.

Finalist at Zero to Agent (Vercel x DeepMind), March 2026.

## What it does

Paste any text. Grimoire computes a statistical fingerprint across 7 dimensions (monosyllable ratio, sentence length, sentence variation, comma density, semicolon usage, lexical diversity, conjunction frequency) and renders it as an interactive 3D voice shape. Then an agentic loop rewrites your text toward any target author's profile.

The agent generates 3 candidates per round at varied temperatures, scores each against the target fingerprint locally, keeps the best, and feeds the metric gap back into the next round. 5 rounds of selection pressure. A blind LLM judge with position-bias cancellation validates the result.

Ships with 6 pre-computed voices: Hemingway, Poe, Twain, Kafka, Woolf, Fitzgerald.

## Stack

- Next.js 16 (Turbopack)
- Vercel AI SDK v6
- Google Gemini 3.1 Pro Preview (generation) + Gemini 2.5 Flash Lite (judge, voice reading)
- Three.js / react-three-fiber (3D voice shapes)
- Recharts (convergence visualization)
- ElevenLabs (TTS)
- Clerk (auth)
- Supabase (persistence)

## Pipeline

```
Input (paste or photo OCR)
  -> Fingerprint (7 metrics, client-side, instant)
  -> 3D Voice Shape (icosahedron deformation)
  -> Agent Loop (5 rounds x 3 candidates x 3 temperatures)
     score locally, keep best, feed gap back
  -> Blind Judge (2 swapped runs, majority vote)
  -> Dashboard (convergence chart, shapes, text comparison)
```

## Run locally

```
cp .env.example .env.local  # add your API keys
npm install
npm run dev
```

## License

MIT
