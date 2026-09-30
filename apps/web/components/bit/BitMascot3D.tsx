"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BIT_FALLBACK_MARK } from "./bit-mascot.constants";
import { cameraForViewport, shouldUseFallback } from "./bit-mascot.state";

const BitScene = dynamic(() => import("./BitScene").then((mod) => mod.BitScene), { ssr: false });

export function BitMascot3D({
  state = "IDLE",
  intensity = 0,
  reducedMotion = false,
  className,
  debugOrbit = false,
  resetSignal = 0,
  replaySignal = 0,
  loop = false,
}: {
  state?: string;
  intensity?: number;
  reducedMotion?: boolean;
  className?: string;
  debugOrbit?: boolean;
  resetSignal?: number;
  replaySignal?: number;
  loop?: boolean;
}) {
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    setWebgl(detectWebGl());
  }, []);

  if (webgl === null) {
    return <BitFallback className={className} />;
  }
  if (shouldUseFallback(webgl)) {
    return <BitFallback className={className} />;
  }

  return (
    <div className={className ?? "bit-stage"}>
      <BitCanvas
        state={state}
        intensity={intensity}
        reducedMotion={reducedMotion}
        debugOrbit={debugOrbit}
        resetSignal={resetSignal}
        replaySignal={replaySignal}
        loop={loop}
      />
    </div>
  );
}

function BitCanvas({
  state,
  intensity,
  reducedMotion,
  debugOrbit,
  resetSignal,
  replaySignal,
  loop,
}: {
  state: string;
  intensity: number;
  reducedMotion: boolean;
  debugOrbit: boolean;
  resetSignal: number;
  replaySignal: number;
  loop: boolean;
}) {
  const [Canvas, setCanvas] = useState<typeof import("@react-three/fiber").Canvas | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("@react-three/fiber").then((mod) => {
      if (!cancelled) {
        setCanvas(() => mod.Canvas);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Canvas) {
    return <BitFallback />;
  }

  const initialCamera = cameraForViewport(1440, 900);
  return (
    <Canvas
      camera={{ position: [initialCamera.x, initialCamera.y, initialCamera.z], fov: 32 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      frameloop={reducedMotion ? "demand" : "always"}
    >
      <BitScene
        state={state}
        intensity={intensity}
        reducedMotion={reducedMotion}
        debugOrbit={debugOrbit}
        resetSignal={resetSignal}
        replaySignal={replaySignal}
        loop={loop}
      />
    </Canvas>
  );
}

export function BitFallback({ className }: { className?: string }) {
  return (
    <div className={className ?? "bit-stage"}>
      {/* The static mark must render without the image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BIT_FALLBACK_MARK} alt="BIT" className="bit-fallback" />
    </div>
  );
}

function detectWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
