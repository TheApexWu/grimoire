"use client";

import { lazy, Suspense } from "react";
import hemingway from "@/data/library/hemingway.json";
import poe from "@/data/library/poe.json";
import twain from "@/data/library/twain.json";
import kafka from "@/data/library/kafka.json";
import woolf from "@/data/library/woolf.json";
import fitzgerald from "@/data/library/fitzgerald.json";
import { computeUniformityScore } from "@/components/VoiceShape";
import { statFingerprintToRadar } from "@/lib/fingerprint";

const VoiceShape = lazy(() => import("@/components/VoiceShape"));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rawAuthors = [hemingway, poe, twain, kafka, woolf, fitzgerald] as any[];
const colors = ["#f59e0b", "#8b5cf6", "#3b82f6", "#ef4444", "#ec4899", "#22c55e"];
const authors = rawAuthors.map((a, i) => ({
  data: { ...a, radar: statFingerprintToRadar(a.stats) },
  color: colors[i],
}));

export default function ShapesPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold tracking-tight mb-3">
            Voice Shapes
          </h1>
          <p className="text-zinc-400 text-lg">
            Every writer has a shape. Flat writing is a sphere. Distinctive writing is angular, asymmetric, alive.
          </p>
          <p className="text-zinc-600 text-sm mt-2">
            Drag to rotate. Each shape is a 3D projection of 7 statistical metrics.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {authors.map(({ data, color }) => {
            const radarValues = data.radar.map((r: { value: number }) => r.value);
            const score = computeUniformityScore(radarValues);
            return (
              <div key={data.id} className="space-y-4">
                <div className="border border-zinc-800 rounded-xl overflow-hidden" style={{ height: 400 }}>
                  <Suspense
                    fallback={
                      <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        Loading...
                      </div>
                    }
                  >
                    <VoiceShape
                      values={radarValues}
                      color={color}
                      rotateSpeed={0.1}
                      label={data.name}
                      detail={2}
                    />
                  </Suspense>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{data.name}</div>
                  <div className="text-xs text-zinc-500">{data.work}</div>
                  <div className="mt-2">
                    <span
                      className="text-2xl font-bold font-[family-name:var(--font-geist-mono)]"
                      style={{ color }}
                    >
                      {score}
                    </span>
                    <span className="text-xs text-zinc-600 ml-2">distinctiveness</span>
                  </div>
                </div>
                <div className="space-y-1.5 px-2">
                  {data.radar.map((r: { label: string; value: number }) => (
                    <div key={r.label} className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-600 w-28 truncate">{r.label}</span>
                      <div className="flex-1 h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${r.value * 100}%`, background: color }}
                        />
                      </div>
                      <span className="text-zinc-500 w-8 text-right font-[family-name:var(--font-geist-mono)]">
                        {(r.value * 100).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
