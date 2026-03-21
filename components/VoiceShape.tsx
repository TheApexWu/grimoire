"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface VoiceShapeProps {
  /** Normalized 0-1 values for each metric axis */
  values: number[];
  /** Color of the shape */
  color?: string;
  /** Second shape to overlay (target/comparison) */
  targetValues?: number[];
  targetColor?: string;
  /** Auto-rotate speed (0 = no rotation) */
  rotateSpeed?: number;
  /** Size multiplier */
  scale?: number;
  /** Label shown below */
  label?: string;
  /** Icosahedron detail level (2=fast, 3=default, 4=hq) */
  detail?: number;
}

function DeformedSphere({
  values,
  color = "#f43f5e",
  opacity = 0.7,
  wireframe = false,
  rotateSpeed = 0.3,
  detail = 3,
}: {
  values: number[];
  color?: string;
  opacity?: number;
  wireframe?: boolean;
  rotateSpeed?: number;
  detail?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const baseGeo = useMemo(() => new THREE.IcosahedronGeometry(1, detail), [detail]);

  const geometry = useMemo(() => {
    const geo = baseGeo.clone();
    const positions = geo.attributes.position;
    const numAxes = values.length || 1;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);

      // Convert vertex to spherical coords
      const r = Math.sqrt(x * x + y * y + z * z);
      const theta = Math.atan2(Math.sqrt(x * x + z * z), y); // polar angle
      const phi = Math.atan2(z, x); // azimuthal angle

      // Map phi to metric index (distribute metrics around equator)
      const normalizedPhi = (phi + Math.PI) / (2 * Math.PI); // 0 to 1
      const metricIdx = normalizedPhi * numAxes;
      const lowerIdx = Math.floor(metricIdx) % numAxes;
      const upperIdx = (lowerIdx + 1) % numAxes;
      const blend = metricIdx - Math.floor(metricIdx);

      // Interpolate between adjacent metrics
      const metricValue =
        values[lowerIdx] * (1 - blend) + values[upperIdx] * blend;

      // Also blend with polar position (top/bottom converge to average)
      const polarBlend = Math.sin(theta); // 0 at poles, 1 at equator
      const avgValue = values.reduce((a, b) => a + b, 0) / numAxes;
      const finalValue = metricValue * polarBlend + avgValue * (1 - polarBlend);

      // Scale radius: base 0.4, max 1.6 (so distinctive writing is LARGE and spiky)
      const newR = 0.4 + finalValue * 1.2;
      const scale = newR / r;

      positions.setXYZ(i, x * scale, y * scale, z * scale);
    }

    geo.computeVertexNormals();
    return geo;
  }, [baseGeo, values]);

  useFrame((state, delta) => {
    if (meshRef.current && rotateSpeed > 0) {
      meshRef.current.rotation.y += delta * rotateSpeed;
      state.invalidate();
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      {wireframe ? (
        <meshBasicMaterial
          color={color}
          wireframe
          transparent
          opacity={opacity}
        />
      ) : (
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          roughness={0.35}
          metalness={0.15}
        />
      )}
    </mesh>
  );
}

export default function VoiceShape({
  values,
  color = "#f43f5e",
  targetValues,
  targetColor = "#3b82f6",
  rotateSpeed = 0.3,
  scale = 1,
  label,
  detail = 3,
}: VoiceShapeProps) {
  // Ensure we have at least some values
  const safeValues = values.length > 0 ? values : [0.5, 0.5, 0.5, 0.5, 0.5];

  return (
    <div className="relative w-full" style={{ aspectRatio: "1" }}>
      <Canvas
        camera={{ position: [0, 0, 2.8], fov: 50 }}
        style={{ background: "transparent" }}
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-3, -2, -4]} intensity={0.3} color="#6366f1" />
        <pointLight position={[0, 3, 0]} intensity={0.4} color="#f59e0b" />

        <group scale={scale}>
          {/* Target shape (wireframe, behind) */}
          {targetValues && targetValues.length > 0 && (
            <DeformedSphere
              values={targetValues}
              color={targetColor}
              wireframe
              opacity={0.4}
              rotateSpeed={rotateSpeed}
              detail={detail}
            />
          )}

          {/* Main shape (solid) */}
          <DeformedSphere
            values={safeValues}
            color={color}
            opacity={0.75}
            rotateSpeed={rotateSpeed}
            detail={detail}
          />
        </group>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          dampingFactor={0.05}
          makeDefault
        />
      </Canvas>

      {label && (
        <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-zinc-500 font-[family-name:var(--font-geist-mono)]">
          {label}
        </div>
      )}
    </div>
  );
}

/**
 * Compute a "uniformity score" - how flat/robotic the writing is.
 * Low std of radar values = uniform/AI-like. High std = distinctive/human.
 * Returns 0-100 where 100 = maximally distinctive, 0 = perfectly flat.
 */
export function computeUniformityScore(radarValues: number[]): number {
  if (radarValues.length === 0) return 0;
  const mean = radarValues.reduce((a, b) => a + b, 0) / radarValues.length;
  const variance =
    radarValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / radarValues.length;
  const std = Math.sqrt(variance);
  // Normalize: std of 0 = score 0, std of 0.35+ = score 100
  return Math.min(100, Math.round((std / 0.35) * 100));
}

/**
 * Diagnose what's flat or distinctive about the writing.
 */
export function diagnoseWriting(
  radarValues: { label: string; value: number }[]
): { flat: string[]; distinctive: string[] } {
  const mean = radarValues.reduce((s, r) => s + r.value, 0) / radarValues.length;
  const flat: string[] = [];
  const distinctive: string[] = [];

  for (const r of radarValues) {
    const deviation = Math.abs(r.value - mean);
    if (deviation < 0.08) {
      flat.push(r.label);
    } else if (r.value > mean + 0.15) {
      distinctive.push(`${r.label} (high)`);
    } else if (r.value < mean - 0.15) {
      distinctive.push(`${r.label} (low)`);
    }
  }

  return { flat, distinctive };
}
