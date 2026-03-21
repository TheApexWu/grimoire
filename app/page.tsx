"use client";

import { useState, useCallback } from "react";
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --- Helpers ---

  const fetchFingerprint = async (text: string) => {
    const res = await fetch("/api/fingerprint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data as { stats: StatFingerprint; radar: RadarPoint[] };
  };

  const fetchVoiceReading = async (text: string) => {
    const res = await fetch("/api/voice-reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    return data.reading as VoiceReading;
  };

  const computeDistance = (a: StatFingerprint, b: StatFingerprint): number => {
    const ranges: Record<keyof StatFingerprint, [number, number]> = {
      monosyllableRatio: [0.5, 1.0],
      sentenceMean: [5, 50],
      sentenceStd: [2, 30],
      sentenceSkew: [-1, 4],
      commaRate: [0, 5],
      semicolonRate: [0, 1],
      periodRate: [0, 3],
      lexicalDiversity: [0.3, 0.85],
      conjunctionDensity: [0, 3],
      paragraphMean: [1, 15],
      paragraphStd: [0, 8],
    };
    let sq = 0;
    const keys = Object.keys(ranges) as (keyof StatFingerprint)[];
    for (const key of keys) {
      const [min, max] = ranges[key];
      const norm = (v: number) => (v - min) / (max - min);
      sq += (norm(a[key]) - norm(b[key])) ** 2;
    }
    return Math.round(Math.sqrt(sq / keys.length) * 1000) / 1000;
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

    try {
      // Fingerprint both in parallel
      const [dataA, dataB] = await Promise.all([
        fetchFingerprint(textA),
        fetchFingerprint(textB),
      ]);
      setFpA(dataA.stats);
      setRadarA(dataA.radar);
      setFpB(dataB.stats);
      setRadarB(dataB.radar);
      const nA = nameA || "Text A";
      const nB = nameB || "Text B";
      setNameA(nA);
      setNameB(nB);
      setDistance(computeDistance(dataA.stats, dataB.stats));
      setView("compare");

      // Voice readings + insights in parallel (non-blocking)
      Promise.all([
        fetchVoiceReading(textA).then((v) => setVoiceA(v)),
        fetchVoiceReading(textB).then((v) => setVoiceB(v)),
        fetch("/api/insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nameA: nA,
            nameB: nB,
            fpA: dataA.stats,
            fpB: dataB.stats,
          }),
        })
          .then((r) => r.json())
          .then((d) => setInsights(d.insights)),
      ]).catch(() => {});
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
    setError("");

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: textA,
          targetSample: textB,
          targetFingerprint: fpB,
          rounds: 3,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Coach request failed");
      }

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

            if (currentEvent === "round-start") {
              setCoachRound(data.round);
            } else if (currentEvent === "round-complete") {
              setCoachConvergence((prev) => [
                ...prev,
                { round: data.round, distance: data.bestDistance },
              ]);
              setCoachPreviewText(data.bestText);
              setCoachRadar(data.bestRadar);
            } else if (currentEvent === "done") {
              setCoachResult({
                results: data.results,
                finalText: data.finalText,
                finalDistance: data.finalDistance,
                finalFingerprint: data.finalFingerprint,
                convergence: data.convergence,
              });
              setCoachRadar(data.finalRadar);
              setView("coached");
            } else if (currentEvent === "error") {
              throw new Error(data.error);
            }
            currentEvent = "";
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coach failed");
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
    setError("");
  }, []);

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
          {view !== "home" && (
            <button
              onClick={reset}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors font-[family-name:var(--font-geist-mono)]"
            >
              START OVER
            </button>
          )}
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
            <div className="text-center space-y-3 pt-4">
              <h2 className="text-4xl font-bold tracking-tight">
                Every writer has a shape you can see
              </h2>
              <p className="text-zinc-400 max-w-xl mx-auto text-lg">
                Capture any writing voice. Study it side by side with your own.
                Then let the agent coach your prose toward the style you want.
              </p>
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
                  10-metric voice comparison
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
                  {coachResult.results.length} rounds, 9 candidates total
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

            <button
              onClick={reset}
              className="w-full py-3 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
            >
              New Comparison
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-800 px-6 py-3">
        <div className="max-w-6xl mx-auto flex justify-between text-xs text-zinc-600 font-[family-name:var(--font-geist-mono)]">
          <span>GRIMOIRE / Zero to Agent 2026</span>
          <span>Capture any voice. Study it. Channel it.</span>
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
    {
      label: "Paragraph Length",
      value: fp.paragraphMean,
      max: 15,
      fmt: (v: number) => `${v.toFixed(1)} sent/para`,
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
