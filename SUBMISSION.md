# Zero to Agent Hackathon Submission

## Team Members
Alex Wu / amadeusWoo

## Project Description
Grimoire clones any writing voice. Paste text, get a statistical fingerprint across 7 dimensions: monosyllable ratio, sentence length, sentence variation, comma density, semicolon usage, lexical diversity, and conjunction frequency. See the fingerprint as an interactive 3D voice shape. Then watch a multi-round agent rewrite your prose toward any target author's profile.

The agent generates 3 candidates per round at varied temperatures, scores each against the fingerprint, keeps the best, and feeds the gap back. Over 5 rounds the output converges toward the target. A blind LLM judge validates whether the result passes as the target author. Ships with 6 pre-computed voices (Hemingway, Poe, Twain, Kafka, Woolf, Fitzgerald). All metrics compute client-side, all AI streams in real time.

## Public GitHub Repository
https://github.com/TheApexWu/grimoire

## Demo Video
[INSERT LINK AFTER RECORDING]

## Partner Technologies Used
- Google Gemini 3.1 Pro Preview (multi-round text generation and style coaching agent)
- Google Gemini 2.5 Flash Lite (voice reading analysis and blind authorship judge)
- Vercel AI SDK v6 (streaming AI responses, multi-model orchestration, SSE endpoints)
- Vercel Next.js 16 with Turbopack (full-stack framework, API routes, server-side rendering)
- Vercel deployment platform (production hosting)

## Vercel Technology Experience
Built the entire application on Next.js 16 with Turbopack and the Vercel AI SDK v6. Used AI SDK's streamText and generateText for all LLM interactions across 4 API routes (analyze, workshop, judge, TTS). Server-sent events stream round-by-round coaching progress to the frontend in real time. The AI SDK's multi-model support let me switch between Gemini Pro for generation and Gemini Flash for fast evaluation within the same agent loop. Next.js API routes handle all server-side logic. Deployed on Vercel.

## Google Technology Experience
Gemini powers the entire intelligence layer. Gemini 3.1 Pro Preview runs the multi-round coaching agent: 3 candidates per round at temperatures 0.7/0.9/1.1, scored against the statistical fingerprint, with gap analysis fed back as structured correction directives. Gemini 2.5 Flash Lite handles the voice reading (emotional temperature, sensory palette, tonal register, imagery density) and the blind authorship judge with dual-run position-bias cancellation. Gemini's multimodal capabilities also power the photo-to-text OCR input path.

## Organizer Feedback
The most interesting constraint was bridging objective metrics with subjective style. Statistical fingerprints can prove convergence numerically, but a reader needs to feel it too. The dual-proof architecture (metrics + LLM judge) emerged from that tension. If I had more time, I'd add a curriculum mode where the agent teaches you to write in the target style yourself, rather than just rewriting for you. The agentic loop pattern (generate, score, rerank, feed back) generalizes well beyond writing style to any domain where you can define a measurable target and iterate toward it.
