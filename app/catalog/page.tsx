"use client";

import { useState, lazy, Suspense } from "react";
import hemingway from "@/data/library/hemingway.json";
import poe from "@/data/library/poe.json";
import twain from "@/data/library/twain.json";
import kafka from "@/data/library/kafka.json";
import woolf from "@/data/library/woolf.json";
import fitzgerald from "@/data/library/fitzgerald.json";
import { computeUniformityScore } from "@/components/VoiceShape";
import { statFingerprintToRadar } from "@/lib/fingerprint";

const VoiceShape = lazy(() => import("@/components/VoiceShape"));

interface Author {
  id: string;
  name: string;
  work: string;
  stats: Record<string, number>;
  radar: { label: string; value: number }[];
  voice: {
    emotionalTemperature: string;
    sensoryPalette: string;
    tonalRegister: string;
    imageryDensity: string;
  };
  sampleText: string;
}

// Recompute radar from stats using tightened literary-prose normalization
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rawAuthors = [hemingway, poe, twain, kafka, woolf, fitzgerald] as any[];
const colors = ["#f59e0b", "#8b5cf6", "#3b82f6", "#ef4444", "#ec4899", "#22c55e"];
const catalog: { data: Author; color: string }[] = rawAuthors.map((a, i) => ({
  data: { ...a, radar: statFingerprintToRadar(a.stats) } as Author,
  color: colors[i],
}));

export default function CatalogPage() {
  const [source, setSource] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const sourceAuthor = catalog.find((a) => a.data.id === source);
  const targetAuthor = catalog.find((a) => a.data.id === target);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Voice Catalog</h1>
            <p className="text-zinc-500 mt-1">
              Select a source voice and a target. See how they compare. Start coaching.
            </p>
          </div>
          {source && target && source !== target && (
            <a
              href={`/?source=${source}&target=${target}`}
              className="px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors text-sm font-[family-name:var(--font-geist-mono)]"
            >
              COACH {sourceAuthor?.data.name.split(" ").pop()?.toUpperCase()} → {targetAuthor?.data.name.split(" ").pop()?.toUpperCase()}
            </a>
          )}
        </div>

        {/* Selection bar */}
        {(source || target) && (
          <div className="flex gap-4 mb-8 p-4 border border-zinc-800 rounded-lg">
            <div className="flex-1">
              <div className="text-[10px] text-zinc-600 font-[family-name:var(--font-geist-mono)] mb-1">SOURCE</div>
              {sourceAuthor ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: sourceAuthor.color }} />
                  <span className="text-sm font-semibold">{sourceAuthor.data.name}</span>
                  <button onClick={() => setSource(null)} className="text-xs text-zinc-600 hover:text-zinc-400 ml-2">clear</button>
                </div>
              ) : (
                <div className="text-sm text-zinc-600">Click a card to select</div>
              )}
            </div>
            <div className="w-px bg-zinc-800" />
            <div className="flex-1">
              <div className="text-[10px] text-zinc-600 font-[family-name:var(--font-geist-mono)] mb-1">TARGET</div>
              {targetAuthor ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: targetAuthor.color }} />
                  <span className="text-sm font-semibold">{targetAuthor.data.name}</span>
                  <button onClick={() => setTarget(null)} className="text-xs text-zinc-600 hover:text-zinc-400 ml-2">clear</button>
                </div>
              ) : (
                <div className="text-sm text-zinc-600">{source ? "Now pick a target" : "Click a card to select"}</div>
              )}
            </div>
          </div>
        )}

        {/* Author grid */}
        <div className="grid grid-cols-3 gap-5">
          {catalog.map(({ data, color }) => {
            const radarValues = data.radar.map((r) => r.value);
            const score = computeUniformityScore(radarValues);
            const isSource = source === data.id;
            const isTarget = target === data.id;
            const isExpanded = expanded === data.id;

            return (
              <div
                key={data.id}
                className={`border rounded-xl overflow-hidden transition-all cursor-pointer ${
                  isSource
                    ? "border-amber-500/60 ring-1 ring-amber-500/30"
                    : isTarget
                      ? "border-blue-500/60 ring-1 ring-blue-500/30"
                      : "border-zinc-800 hover:border-zinc-600"
                }`}
                onClick={() => {
                  if (!source || isSource) {
                    setSource(isSource ? null : data.id);
                  } else if (!target || isTarget) {
                    setTarget(isTarget ? null : data.id);
                  } else {
                    setTarget(data.id);
                  }
                }}
              >
                {/* 3D Shape */}
                <div style={{ height: 260 }} className="relative">
                  <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-zinc-700">Loading...</div>}>
                    <VoiceShape values={radarValues} color={color} rotateSpeed={0.08} detail={2} />
                  </Suspense>
                  {(isSource || isTarget) && (
                    <div className={`absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-[family-name:var(--font-geist-mono)] font-bold ${
                      isSource ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"
                    }`}>
                      {isSource ? "SOURCE" : "TARGET"}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm">{data.name}</div>
                      <div className="text-[11px] text-zinc-600">{data.work}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold font-[family-name:var(--font-geist-mono)]" style={{ color }}>
                        {score}
                      </span>
                      <div className="text-[9px] text-zinc-600">distinctiveness</div>
                    </div>
                  </div>

                  {/* Voice tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {[data.voice.emotionalTemperature, data.voice.tonalRegister].map((tag) => (
                      <span key={tag} className="px-2 py-0.5 text-[10px] border border-zinc-800 rounded text-zinc-500 font-[family-name:var(--font-geist-mono)]">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Metric bars */}
                  <div className="space-y-1">
                    {data.radar.map((r) => (
                      <div key={r.label} className="flex items-center gap-2 text-[10px]">
                        <span className="text-zinc-600 w-24 truncate">{r.label}</span>
                        <div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${r.value * 100}%`, background: color }} />
                        </div>
                        <span className="text-zinc-600 w-6 text-right font-[family-name:var(--font-geist-mono)]">
                          {(r.value * 100).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded(isExpanded ? null : data.id);
                    }}
                    className="text-[10px] text-zinc-600 hover:text-zinc-400 font-[family-name:var(--font-geist-mono)]"
                  >
                    {isExpanded ? "COLLAPSE" : "SAMPLE TEXT"}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 p-3 bg-zinc-950 rounded text-[11px] text-zinc-500 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {data.sampleText.slice(0, 600)}...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison panel */}
        {source && target && source !== target && sourceAuthor && targetAuthor && (
          <div className="mt-10 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-bold mb-6 font-[family-name:var(--font-geist-mono)]">
              {sourceAuthor.data.name} → {targetAuthor.data.name}
            </h2>

            <div className="grid grid-cols-2 gap-8">
              {/* Side by side shapes */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-amber-900/30 rounded-lg p-3">
                    <div className="text-[10px] text-amber-400/60 font-[family-name:var(--font-geist-mono)] mb-1">SOURCE</div>
                    <div style={{ height: 200 }}>
                      <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-zinc-700">...</div>}>
                        <VoiceShape values={sourceAuthor.data.radar.map((r) => r.value)} color={sourceAuthor.color} rotateSpeed={0.1} detail={2} />
                      </Suspense>
                    </div>
                  </div>
                  <div className="border border-blue-900/30 rounded-lg p-3">
                    <div className="text-[10px] text-blue-400/60 font-[family-name:var(--font-geist-mono)] mb-1">TARGET</div>
                    <div style={{ height: 200 }}>
                      <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-zinc-700">...</div>}>
                        <VoiceShape values={targetAuthor.data.radar.map((r) => r.value)} color={targetAuthor.color} rotateSpeed={0.1} detail={2} />
                      </Suspense>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metric comparison */}
              <div className="space-y-3">
                <div className="text-xs text-zinc-500 font-[family-name:var(--font-geist-mono)] mb-2">METRIC DELTA</div>
                {sourceAuthor.data.radar.map((sr, i) => {
                  const tr = targetAuthor.data.radar[i];
                  const delta = tr.value - sr.value;
                  return (
                    <div key={sr.label} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-zinc-500">{sr.label}</span>
                        <span className={`font-[family-name:var(--font-geist-mono)] ${delta > 0.05 ? "text-green-400" : delta < -0.05 ? "text-red-400" : "text-zinc-600"}`}>
                          {delta > 0 ? "+" : ""}{(delta * 100).toFixed(0)}
                        </span>
                      </div>
                      <div className="relative h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                        <div className="absolute h-full rounded-full" style={{ width: `${sr.value * 100}%`, background: sourceAuthor.color, opacity: 0.5 }} />
                        <div className="absolute h-full rounded-full" style={{ width: `${tr.value * 100}%`, background: targetAuthor.color, opacity: 0.5 }} />
                      </div>
                    </div>
                  );
                })}

                {/* Voice comparison */}
                <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
                  <div>
                    <div className="text-amber-400/60 font-[family-name:var(--font-geist-mono)] mb-1">SOURCE VOICE</div>
                    <div className="text-zinc-500 italic">{sourceAuthor.data.voice.emotionalTemperature}</div>
                    <div className="text-zinc-500 italic">{sourceAuthor.data.voice.tonalRegister}</div>
                  </div>
                  <div>
                    <div className="text-blue-400/60 font-[family-name:var(--font-geist-mono)] mb-1">TARGET VOICE</div>
                    <div className="text-zinc-500 italic">{targetAuthor.data.voice.emotionalTemperature}</div>
                    <div className="text-zinc-500 italic">{targetAuthor.data.voice.tonalRegister}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="mt-8 text-center">
          <a href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors font-[family-name:var(--font-geist-mono)]">
            ← BACK TO GRIMOIRE
          </a>
        </div>
      </div>
    </div>
  );
}
