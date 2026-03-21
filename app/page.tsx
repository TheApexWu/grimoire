"use client";

import { useState, useCallback, useRef } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

import hemingway from "@/data/fallbacks/hemingway.json";
import poe from "@/data/fallbacks/poe.json";
import twain from "@/data/fallbacks/twain.json";

// --- Types ---

interface StatFingerprint {
  monosyllableRatio: number;
  sentenceMean: number;
  sentenceStd: number;
  sentenceSkew: number;
  commaRate: number;
  semicolonRate: number;
  periodRate: number;
  lexicalDiversity: number;
  conjunctionDensity: number;
  paragraphMean: number;
  paragraphStd: number;
}

interface VoiceReading {
  emotionalTemperature: string;
  sensoryPalette: string;
  tonalRegister: string;
  imageryDensity: string;
}

interface RadarPoint {
  label: string;
  value: number;
}

interface FallbackAuthor {
  id: string;
  name: string;
  work: string;
  stats: StatFingerprint;
  radar: RadarPoint[];
  voice: VoiceReading;
  sampleText: string;
}

interface RoundResult {
  round: number;
  candidates: { text: string; distance: number }[];
  bestText: string;
  bestDistance: number;
  bestFingerprint: StatFingerprint;
}

interface CoachResponse {
  results: RoundResult[];
  finalText: string;
  finalDistance: number;
  finalFingerprint: StatFingerprint;
  convergence: { round: number; distance: number }[];
  convergedEarly?: boolean;
  roundsCompleted?: number;
}

const library: FallbackAuthor[] = [hemingway, poe, twain] as FallbackAuthor[];

type View = "home" | "compare" | "coaching" | "coached";

export default function Home() {
  const [view, setView] = useState<View>("home");

  const [textA, setTextA] = useState("");
  const [nameA, setNameA] = useState("");
  const [fpA, setFpA] = useState<StatFingerprint | null>(null);
  const [radarA, setRadarA] = useState<RadarPoint[]>([]);
  const [voiceA, setVoiceA] = useState<VoiceReading | null>(null);

  const [textB, setTextB] = useState("");
  const [nameB, setNameB] = useState("");
  const [fpB, setFpB] = useState<StatFingerprint | null>(null);
  const [radarB, setRadarB] = useState<RadarPoint[]>([]);
  const [voiceB, setVoiceB] = useState<VoiceReading | null>(null);

  const [insights, setInsights] = useState("");
  const [distance, setDistance] = useState<number | null>(null);

  const [coachResult, setCoachResult] = useState<CoachResponse | null>(null);
  const [coachRadar, setCoachRadar] = useState<RadarPoint[]>([]);
  const [coachRound, setCoachRound] = useState(0);
  const [coachConvergence, setCoachConvergence] = useState<
    { round: number; distance: number }[]
  >([]);
  const [coachPreviewText, setCoachPreviewText] = useState("");
  const [coachCorrection, setCoachCorrection] = useState("");
  const [judgeVerdict, setJudgeVerdict] = useState<{
    sameAuthor: boolean;
    confidence: number;
    reasoning: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { isSignedIn, user } = useUser();

  // --- SSE consumer ---

  const consumeSSE = async (
    res: Response,
    handlers: Record<string, (data: Record<string, unknown>) => void>
  ) => {
    if (!res.ok || !res.body) throw new Error("Stream request failed");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7);
        } else if (line.startsWith("data: ") && currentEvent) {
          const data = JSON.parse(line.slice(6));
          if (currentEvent === "error") throw new Error(data.error);
          handlers[currentEvent]?.(data);
          currentEvent = "";
        }
      }
    }
  };

  // --- Actions ---

  const loadFromLibrary = useCallback(
    (author: FallbackAuthor, side: "A" | "B") => {
      if (side === "A") {
        setTextA(author.sampleText);
        setNameA(author.name);
        setFpA(author.stats);
        setRadarA(author.radar);
        setVoiceA(author.voice);
      } else {
        setTextB(author.sampleText);
        setNameB(author.name);
        setFpB(author.stats);
        setRadarB(author.radar);
        setVoiceB(author.voice);
      }
    },
    []
  );

  const handleImageUpload = useCallback(
    async (side: "A" | "B", file: File) => {
      setLoading(true);
      setError("");
      try {
        const form = new FormData();
        form.append("image", file);
        const res = await fetch("/api/ocr", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (side === "A") setTextA(data.text);
        else setTextB(data.text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "OCR failed");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const runCompare = useCallback(async () => {
    if (textA.trim().length < 50 || textB.trim().length < 50) {
      setError("Both texts need at least 50 characters.");
      return;
    }
    setLoading(true);
    setError("");
    setInsights("");

    const nA = nameA || "Text A";
    const nB = nameB || "Text B";
    setNameA(nA);
    setNameB(nB);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: [
            { text: textA, name: nA },
            { text: textB, name: nB },
          ],
        }),
      });

      await consumeSSE(res, {
        fingerprints: (data) => {
          const results = data.results as { index: number; stats: StatFingerprint; radar: RadarPoint[] }[];
          for (const r of results) {
            if (r.index === 0) { setFpA(r.stats); setRadarA(r.radar); }
            else { setFpB(r.stats); setRadarB(r.radar); }
          }
          setView("compare");
        },
        distance: (data) => {
          setDistance(data.value as number);
        },
        voice: (data) => {
          const reading = data.reading as VoiceReading;
          if (data.index === 0) setVoiceA(reading);
          else setVoiceB(reading);
        },
        insights: (data) => {
          setInsights(data.text as string);
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [textA, textB, nameA, nameB]);

  const runCoach = useCallback(async () => {
    if (!fpB || !textA || !textB) return;
    setView("coaching");
    setLoading(true);
    setCoachResult(null);
    setCoachRadar([]);
    setCoachRound(0);
    setCoachConvergence([]);
    setCoachPreviewText("");
    setJudgeVerdict(null);
    setError("");

    try {
      const res = await fetch("/api/workshop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "coach",
          userText: textA,
          targetSample: textB,
          targetFingerprint: fpB,
          rounds: 3,
        }),
      });

      await consumeSSE(res, {
        "round-start": (data) => {
          setCoachRound(data.round as number);
        },
        "round-complete": (data) => {
          setCoachConvergence((prev) => [
            ...prev,
            { round: data.round as number, distance: data.bestDistance as number },
          ]);
          setCoachPreviewText(data.bestText as string);
          setCoachRadar(data.bestRadar as RadarPoint[]);
          if (data.correction) setCoachCorrection(data.correction as string);
        },
        "converged-early": () => {
          // handled via done event
        },
        done: (data) => {
          setCoachResult({
            results: data.results as RoundResult[],
            finalText: data.finalText as string,
            finalDistance: data.finalDistance as number,
            finalFingerprint: data.finalFingerprint as StatFingerprint,
            convergence: data.convergence as { round: number; distance: number }[],
            convergedEarly: data.convergedEarly as boolean | undefined,
            roundsCompleted: data.roundsCompleted as number | undefined,
          });
          setCoachRadar(data.finalRadar as RadarPoint[]);
          setView("coached");
          // Fire judge in background (non-blocking)
          fetch("/api/judge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              originalText: textB,
              generatedText: data.finalText,
            }),
          })
            .then((r) => r.json())
            .then((v) => setJudgeVerdict(v))
            .catch(() => {});
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workshop failed");
      setView("compare");
    } finally {
      setLoading(false);
    }
  }, [textA, textB, fpB]);

  const reset = useCallback(() => {
    setView("home");
    setTextA("");
    setTextB("");
    setNameA("");
    setNameB("");
    setFpA(null);
    setFpB(null);
    setRadarA([]);
    setRadarB([]);
    setVoiceA(null);
    setVoiceB(null);
    setInsights("");
    setDistance(null);
    setCoachResult(null);
    setCoachRadar([]);
    setCoachCorrection("");
    setJudgeVerdict(null);
    setSaved(false);
    setError("");
  }, []);

  const handleSave = useCallback(async () => {
    if (!coachResult || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameA,
          nameB,
          textA,
          textB,
          fpA,
          fpB,
          coachedText: coachResult.finalText,
          finalDistance: coachResult.finalDistance,
          judgeVerdict,
          userId: user?.id || "anonymous",
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [coachResult, nameA, nameB, textA, textB, fpA, fpB, judgeVerdict, user, saving]);

  const handleTts = useCallback(async (text: string) => {
    if (ttsPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setTtsPlaying(false);
      return;
    }
    setTtsPlaying(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 3000) }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setTtsPlaying(false);
        audioRef.current = null;
        URL.revokeObjectURL(url);
      };
      audio.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : "TTS failed");
      setTtsPlaying(false);
    }
  }, [ttsPlaying]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button onClick={reset} className="text-left">
            <h1 className="text-xl font-bold tracking-tight font-[family-name:var(--font-geist-mono)]">
              GRIMOIRE
            </h1>
            <p className="text-xs text-zinc-500 font-[family-name:var(--font-geist-mono)]">
              agentic writing workshop
            </p>
          </button>
          <div className="flex items-center gap-4">
            {view !== "home" && (
              <button
                onClick={reset}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors font-[family-name:var(--font-geist-mono)]"
              >
                START OVER
              </button>
            )}
            {isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal">
                <button className="text-sm px-3 py-1.5 border border-zinc-700 rounded hover:border-zinc-500 transition-colors font-[family-name:var(--font-geist-mono)]">
                  SIGN IN
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* ========== HOME ========== */}
        {view === "home" && (
          <div className="space-y-10">
            <div className="text-center space-y-4 pt-6">
              <h2 className="text-5xl font-bold tracking-tight leading-tight">
                Every writer has a shape<br />you can see
              </h2>
              <p className="text-zinc-400 max-w-2xl mx-auto text-lg leading-relaxed">
                Capture any writing voice. Study it side by side with your own.
                Then let the agent coach your prose toward the style you want.
              </p>
            </div>

            {/* How it works */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { step: "01", title: "FINGERPRINT", desc: "11 statistical metrics extract the DNA of any writing voice. Instant, deterministic." },
                { step: "02", title: "COMPARE", desc: "Overlaid radar charts + LLM voice readings reveal where two styles diverge." },
                { step: "03", title: "COACH", desc: "3 rounds, 3 candidates per round. The agent rewrites toward the target, guided by metric-targeted corrections." },
                { step: "04", title: "PROVE", desc: "A blind LLM judge reads both texts without labels. Same author? Statistical + perceptual proof." },
              ].map((s) => (
                <div key={s.step} className="border border-zinc-800/60 rounded-lg p-4 space-y-2">
                  <div className="text-xs text-zinc-600 font-[family-name:var(--font-geist-mono)]">{s.step}</div>
                  <div className="text-sm font-semibold text-zinc-200 font-[family-name:var(--font-geist-mono)]">{s.title}</div>
                  <div className="text-xs text-zinc-500 leading-relaxed">{s.desc}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <TextInputPanel
                label="YOUR WRITING"
                sublabel="or any text to analyze"
                name={nameA}
                text={textA}
                onNameChange={setNameA}
                onTextChange={setTextA}
                onImageUpload={(f) => handleImageUpload("A", f)}
                library={library}
                onLibrarySelect={(a) => loadFromLibrary(a, "A")}
                loading={loading}
              />
              <TextInputPanel
                label="COMPARE AGAINST"
                sublabel="a voice you want to study"
                name={nameB}
                text={textB}
                onNameChange={setNameB}
                onTextChange={setTextB}
                onImageUpload={(f) => handleImageUpload("B", f)}
                library={library}
                onLibrarySelect={(a) => loadFromLibrary(a, "B")}
                loading={loading}
              />
            </div>

            <button
              onClick={runCompare}
              disabled={
                loading ||
                textA.trim().length < 50 ||
                textB.trim().length < 50
              }
              className="w-full py-4 bg-white text-black text-lg font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
            >
              {loading ? "Reading..." : "Compare Voices"}
            </button>
          </div>
        )}

        {/* ========== COMPARE ========== */}
        {view === "compare" && fpA && fpB && (
          <div className="space-y-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {nameA} vs {nameB}
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                  statistical fingerprint + LLM voice reading
                </p>
              </div>
              {distance !== null && (
                <div className="text-right">
                  <div className="text-xs text-zinc-500 font-[family-name:var(--font-geist-mono)]">
                    VOICE DISTANCE
                  </div>
                  <div className="text-3xl font-bold font-[family-name:var(--font-geist-mono)]">
                    {distance.toFixed(3)}
                  </div>
                  <div className="text-xs text-zinc-600">
                    {distance < 0.08
                      ? "nearly identical"
                      : distance < 0.15
                        ? "similar voices"
                        : distance < 0.25
                          ? "distinct styles"
                          : "very different"}
                  </div>
                </div>
              )}
            </div>

            {/* Radar overlay */}
            <div className="border border-zinc-800 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-zinc-400 mb-2 font-[family-name:var(--font-geist-mono)]">
                VOICE SHAPES
              </h3>
              <ResponsiveContainer width="100%" height={380}>
                <RadarChart
                  data={radarA.map((a, i) => ({
                    label: a.label,
                    [nameA]: a.value,
                    [nameB]: radarB[i]?.value ?? 0,
                  }))}
                >
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis
                    dataKey="label"
                    tick={{ fill: "#999", fontSize: 11 }}
                  />
                  <Radar
                    name={nameA}
                    dataKey={nameA}
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                  <Radar
                    name={nameB}
                    dataKey={nameB}
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#888" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Voice readings side by side */}
            {(voiceA || voiceB) && (
              <div className="grid grid-cols-2 gap-6">
                {voiceA && (
                  <VoiceCard name={nameA} voice={voiceA} color="amber" />
                )}
                {voiceB && (
                  <VoiceCard name={nameB} voice={voiceB} color="blue" />
                )}
              </div>
            )}

            {/* Stat metrics side by side */}
            <div className="grid grid-cols-2 gap-6">
              <div className="border border-zinc-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-amber-400/80 mb-4 font-[family-name:var(--font-geist-mono)]">
                  {nameA.toUpperCase()} - STATS
                </h3>
                <MetricList fp={fpA} color="amber" />
              </div>
              <div className="border border-zinc-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-blue-400/80 mb-4 font-[family-name:var(--font-geist-mono)]">
                  {nameB.toUpperCase()} - STATS
                </h3>
                <MetricList fp={fpB} color="blue" />
              </div>
            </div>

            {/* LLM Insights */}
            {insights && (
              <div className="border border-zinc-800 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-zinc-400 mb-3 font-[family-name:var(--font-geist-mono)]">
                  WHAT THE NUMBERS MEAN
                </h3>
                <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {insights}
                </div>
              </div>
            )}

            {/* Coach CTA */}
            <div className="border border-zinc-800 rounded-lg p-6 text-center space-y-3">
              <h3 className="text-lg font-semibold">
                Channel {nameB}&apos;s voice
              </h3>
              <p className="text-zinc-500 text-sm max-w-lg mx-auto">
                The style coach agent will rewrite your text with{" "}
                {nameB}&apos;s rhythm and vocabulary. Your ideas, their
                cadence. 3 rounds of selection pressure, 3 candidates per round,
                best survives.
              </p>
              <button
                onClick={runCoach}
                className="px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
              >
                Run Style Coach
              </button>
            </div>
          </div>
        )}

        {/* ========== COACHING (live) ========== */}
        {view === "coaching" && (
          <div className="space-y-8 py-8">
            <div className="flex items-center gap-4">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 border-2 border-zinc-700 rounded-full" />
                <div className="absolute inset-0 border-2 border-white rounded-full border-t-transparent animate-spin" />
              </div>
              <div>
                <p className="text-lg font-semibold">
                  Style Coach Running
                </p>
                <p className="text-zinc-500 text-sm">
                  Round {coachRound} of 3 &middot; 3 candidates per round
                </p>
              </div>
            </div>

            {/* Live convergence */}
            {coachConvergence.length > 0 && (
              <div className="border border-zinc-800 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-zinc-400 mb-3 font-[family-name:var(--font-geist-mono)]">
                  LIVE CONVERGENCE
                </h3>
                <div className="space-y-2">
                  {coachConvergence.map((c) => (
                    <div
                      key={c.round}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="text-zinc-600 font-[family-name:var(--font-geist-mono)] w-20">
                        Round {c.round}
                      </span>
                      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.max(5, (1 - c.distance) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="font-[family-name:var(--font-geist-mono)] text-green-400/80 w-16 text-right">
                        {c.distance.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent correction directive */}
            {coachCorrection && (
              <div className="border border-amber-900/30 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-amber-400/60 mb-2 font-[family-name:var(--font-geist-mono)]">
                  AGENT CORRECTION APPLIED
                </h3>
                <div className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap font-[family-name:var(--font-geist-mono)]">
                  {coachCorrection}
                </div>
              </div>
            )}

            {/* Live radar morphing */}
            {coachRadar.length > 0 && radarB.length > 0 && (
              <div className="border border-zinc-800 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-zinc-400 mb-2 font-[family-name:var(--font-geist-mono)]">
                  VOICE SHAPE (morphing toward target)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart
                    data={radarB.map((b, i) => ({
                      label: b.label,
                      Target: b.value,
                      Current: coachRadar[i]?.value ?? 0,
                    }))}
                  >
                    <PolarGrid stroke="#333" />
                    <PolarAngleAxis
                      dataKey="label"
                      tick={{ fill: "#999", fontSize: 11 }}
                    />
                    <Radar
                      name="Target"
                      dataKey="Target"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.05}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                    <Radar
                      name="Current"
                      dataKey="Current"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.15}
                      strokeWidth={2.5}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#888" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Live preview */}
            {coachPreviewText && (
              <div className="border border-green-900/30 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-green-400/60 mb-2 font-[family-name:var(--font-geist-mono)]">
                  LATEST BEST CANDIDATE
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {coachPreviewText.slice(0, 500)}
                  {coachPreviewText.length > 500 ? "..." : ""}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ========== COACHED ========== */}
        {view === "coached" && coachResult && fpA && fpB && (
          <div className="space-y-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  Your text, channeled toward {nameB}
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                  {coachResult.roundsCompleted || coachResult.results.length} round{(coachResult.roundsCompleted || coachResult.results.length) !== 1 ? "s" : ""}, {(coachResult.roundsCompleted || coachResult.results.length) * 3} candidates evaluated
                  {coachResult.convergedEarly && (
                    <span className="ml-2 text-green-400 font-[family-name:var(--font-geist-mono)]">
                      CONVERGED EARLY
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500 font-[family-name:var(--font-geist-mono)]">
                  DISTANCE TO TARGET
                </div>
                <div className="text-3xl font-bold font-[family-name:var(--font-geist-mono)]">
                  {coachResult.finalDistance.toFixed(3)}
                </div>
              </div>
            </div>

            {/* Triple radar */}
            <div className="border border-zinc-800 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-zinc-400 mb-2 font-[family-name:var(--font-geist-mono)]">
                CONVERGENCE MAP
              </h3>
              <ResponsiveContainer width="100%" height={380}>
                <RadarChart
                  data={radarA.map((a, i) => ({
                    label: a.label,
                    [nameA]: a.value,
                    [nameB]: radarB[i]?.value ?? 0,
                    Coached: coachRadar[i]?.value ?? 0,
                  }))}
                >
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis
                    dataKey="label"
                    tick={{ fill: "#999", fontSize: 11 }}
                  />
                  <Radar
                    name={nameA}
                    dataKey={nameA}
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.05}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                  <Radar
                    name={nameB}
                    dataKey={nameB}
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.05}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                  <Radar
                    name="Coached"
                    dataKey="Coached"
                    stroke="#22c55e"
                    fill="#22c55e"
                    fillOpacity={0.15}
                    strokeWidth={2.5}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#888" }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Convergence line */}
            <div className="border border-zinc-800 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-zinc-400 mb-4 font-[family-name:var(--font-geist-mono)]">
                DISTANCE BY ROUND
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={coachResult.convergence}>
                  <CartesianGrid stroke="#222" />
                  <XAxis
                    dataKey="round"
                    tick={{ fill: "#888", fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: "#888", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #333",
                      borderRadius: "4px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="distance"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: "#22c55e", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Three-column text comparison */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border border-amber-900/40 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-amber-400/80 mb-3 font-[family-name:var(--font-geist-mono)]">
                  YOUR ORIGINAL
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
                  {textA.slice(0, 1200)}
                </p>
              </div>
              <div className="border border-green-800/60 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-green-400 mb-3 font-[family-name:var(--font-geist-mono)]">
                  COACHED OUTPUT
                </h3>
                <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
                  {coachResult.finalText}
                </p>
              </div>
              <div className="border border-blue-900/40 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-blue-400/80 mb-3 font-[family-name:var(--font-geist-mono)]">
                  {nameB.toUpperCase()} SAMPLE
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
                  {textB.slice(0, 1200)}
                </p>
              </div>
            </div>

            {/* Agent round details */}
            <div className="border border-zinc-800 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-zinc-400 mb-3 font-[family-name:var(--font-geist-mono)]">
                AGENT ROUNDS
              </h3>
              <div className="space-y-2">
                {coachResult.results.map((r) => (
                  <div
                    key={r.round}
                    className="flex items-center gap-4 text-sm"
                  >
                    <span className="text-zinc-600 font-[family-name:var(--font-geist-mono)] w-20">
                      Round {r.round}
                    </span>
                    <span className="font-[family-name:var(--font-geist-mono)] text-green-400/80">
                      best={r.bestDistance.toFixed(3)}
                    </span>
                    <span className="text-zinc-600 text-xs">
                      candidates:{" "}
                      {r.candidates
                        .map((c) => c.distance.toFixed(3))
                        .join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* LLM Judge Verdict */}
            {judgeVerdict && (
              <div className="border border-zinc-800 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-zinc-400 mb-3 font-[family-name:var(--font-geist-mono)]">
                  BLIND JUDGE VERDICT
                </h3>
                <div className="flex items-center gap-4">
                  <div
                    className={`text-4xl font-bold font-[family-name:var(--font-geist-mono)] ${
                      judgeVerdict.sameAuthor
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {judgeVerdict.sameAuthor ? "PASS" : "FAIL"}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-zinc-300">
                      {judgeVerdict.reasoning}
                    </div>
                    <div className="text-xs text-zinc-600 mt-1 font-[family-name:var(--font-geist-mono)]">
                      Confidence: {(judgeVerdict.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 mt-3">
                  An LLM was shown the coached output and the target sample
                  without labels, then asked: &quot;same author?&quot;
                </p>
              </div>
            )}
            {!judgeVerdict && view === "coached" && (
              <div className="border border-zinc-800 rounded-lg p-4 text-center text-sm text-zinc-600">
                Running blind judge test...
              </div>
            )}

            {/* Save + TTS action bar */}
            <div className="flex gap-3">
              <button
                onClick={() => handleTts(coachResult.finalText)}
                className="flex-1 py-3 border border-zinc-800 rounded-lg text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors flex items-center justify-center gap-2 font-[family-name:var(--font-geist-mono)] text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {ttsPlaying ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  )}
                </svg>
                {ttsPlaying ? "STOP" : "HEAR THE RHYTHM"}
              </button>
              {isSignedIn ? (
                <button
                  onClick={handleSave}
                  disabled={saved || saving}
                  className="flex-1 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-40 font-[family-name:var(--font-geist-mono)] text-sm"
                >
                  {saved ? "SAVED TO GRIMOIRE" : saving ? "SAVING..." : "SAVE TO GRIMOIRE"}
                </button>
              ) : (
                <SignInButton mode="modal">
                  <button className="flex-1 py-3 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors font-[family-name:var(--font-geist-mono)] text-sm">
                    SIGN IN TO SAVE
                  </button>
                </SignInButton>
              )}
            </div>

            <button
              onClick={reset}
              className="w-full py-3 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
            >
              New Comparison
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto space-y-2">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {["Next.js 16", "Vercel AI SDK", "Gemini 3.1 Pro", "Gemini 2.0 Flash", "Recharts", "Supabase", "Clerk", "Eleven Labs"].map((t) => (
              <span key={t} className="px-2 py-0.5 text-[10px] border border-zinc-800 rounded text-zinc-600 font-[family-name:var(--font-geist-mono)]">
                {t}
              </span>
            ))}
          </div>
          <div className="flex justify-between text-xs text-zinc-600 font-[family-name:var(--font-geist-mono)]">
            <span>GRIMOIRE / Zero to Agent 2026</span>
            <span>Capture any voice. Study it. Channel it.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Components ---

function TextInputPanel({
  label,
  sublabel,
  name,
  text,
  onNameChange,
  onTextChange,
  onImageUpload,
  library,
  onLibrarySelect,
  loading,
}: {
  label: string;
  sublabel: string;
  name: string;
  text: string;
  onNameChange: (v: string) => void;
  onTextChange: (v: string) => void;
  onImageUpload: (f: File) => void;
  library: FallbackAuthor[];
  onLibrarySelect: (a: FallbackAuthor) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-semibold text-zinc-300 font-[family-name:var(--font-geist-mono)]">
          {label}
        </div>
        <div className="text-xs text-zinc-600">{sublabel}</div>
      </div>

      <div className="flex gap-2">
        {library.map((a) => (
          <button
            key={a.id}
            onClick={() => onLibrarySelect(a)}
            className="px-2.5 py-1 text-xs border border-zinc-800 rounded hover:border-zinc-600 hover:text-white transition-colors text-zinc-500"
          >
            {a.name.split(" ").pop()}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Label (your name, author name...)"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-sm focus:outline-none focus:border-zinc-600"
      />

      <div className="relative">
        <textarea
          placeholder="Paste text here (min 50 characters)..."
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          className="w-full h-40 p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm resize-none focus:outline-none focus:border-zinc-600 font-[family-name:var(--font-geist-mono)] text-zinc-300"
        />
        <label className="absolute bottom-3 right-3 p-1.5 bg-zinc-800 rounded cursor-pointer hover:bg-zinc-700 transition-colors">
          <svg
            className="w-4 h-4 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImageUpload(f);
            }}
            className="hidden"
            disabled={loading}
          />
        </label>
      </div>

      {text.length > 0 && (
        <div className="text-xs text-zinc-600 font-[family-name:var(--font-geist-mono)]">
          {text.split(/\s+/).filter(Boolean).length} words
        </div>
      )}
    </div>
  );
}

function VoiceCard({
  name,
  voice,
  color,
}: {
  name: string;
  voice: VoiceReading;
  color: "amber" | "blue";
}) {
  const borderColor =
    color === "amber" ? "border-amber-900/40" : "border-blue-900/40";
  const titleColor =
    color === "amber" ? "text-amber-400/80" : "text-blue-400/80";

  const fields = [
    { label: "Emotional Temperature", value: voice.emotionalTemperature },
    { label: "Sensory Palette", value: voice.sensoryPalette },
    { label: "Tonal Register", value: voice.tonalRegister },
    { label: "Imagery Density", value: voice.imageryDensity },
  ];

  return (
    <div className={`border ${borderColor} rounded-lg p-5`}>
      <h3
        className={`text-sm font-semibold ${titleColor} mb-3 font-[family-name:var(--font-geist-mono)]`}
      >
        {name.toUpperCase()} - VOICE
      </h3>
      <div className="space-y-2.5">
        {fields.map((f) => (
          <div key={f.label}>
            <div className="text-[11px] text-zinc-600 font-[family-name:var(--font-geist-mono)]">
              {f.label}
            </div>
            <div className="text-sm text-zinc-300 italic">{f.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricList({
  fp,
  color,
}: {
  fp: StatFingerprint;
  color: "amber" | "blue";
}) {
  const barColor =
    color === "amber" ? "bg-amber-400/70" : "bg-blue-400/70";

  const metrics = [
    {
      label: "Monosyllable %",
      value: fp.monosyllableRatio,
      max: 1,
      fmt: (v: number) => `${(v * 100).toFixed(1)}%`,
    },
    {
      label: "Avg Sentence",
      value: fp.sentenceMean,
      max: 50,
      fmt: (v: number) => `${v.toFixed(1)} words`,
    },
    {
      label: "Sentence Variation",
      value: fp.sentenceStd,
      max: 30,
      fmt: (v: number) => v.toFixed(1),
    },
    {
      label: "Comma Rate",
      value: fp.commaRate,
      max: 5,
      fmt: (v: number) => `${v.toFixed(2)}/sent`,
    },
    {
      label: "Lexical Diversity",
      value: fp.lexicalDiversity,
      max: 1,
      fmt: (v: number) => v.toFixed(3),
    },
    {
      label: "Conjunctions",
      value: fp.conjunctionDensity,
      max: 3,
      fmt: (v: number) => `${v.toFixed(2)}/sent`,
    },
  ];

  return (
    <div className="space-y-3">
      {metrics.map((m) => (
        <div key={m.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-500">{m.label}</span>
            <span className="font-[family-name:var(--font-geist-mono)] text-zinc-300">
              {m.fmt(m.value)}
            </span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full transition-all duration-500`}
              style={{
                width: `${Math.min(100, (m.value / m.max) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
