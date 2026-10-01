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
  production = false,
}: {
  state?: string;
  intensity?: number;
  reducedMotion?: boolean;
  className?: string;
  debugOrbit?: boolean;
  resetSignal?: number;
  replaySignal?: number;
  loop?: boolean;
  production?: boolean;
}) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    setWebgl(detectWebGl());
  }, []);

  const showCanvas = webgl === true && !shouldUseFallback(webgl);

  return (
    <div className={`${className ?? "bit-stage"}${sceneReady ? " is-live" : ""}`}>
      <BitFallback />
      {showCanvas ? (
        <div className={sceneReady ? "bit-canvas-layer is-ready" : "bit-canvas-layer"}>
          <BitCanvas
            state={state}
            intensity={intensity}
            reducedMotion={reducedMotion}
            debugOrbit={debugOrbit}
            resetSignal={resetSignal}
            replaySignal={replaySignal}
            loop={loop}
            production={production}
            onReady={() => setSceneReady(true)}
          />
        </div>
      ) : null}
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
  production,
  onReady,
}: {
  state: string;
  intensity: number;
  reducedMotion: boolean;
  debugOrbit: boolean;
  resetSignal: number;
  replaySignal: number;
  loop: boolean;
  production: boolean;
  onReady: () => void;
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
    return null;
  }

  const initialCamera = cameraForViewport(1440, 900);
  return (
    <Canvas
      camera={{ position: [initialCamera.x, initialCamera.y, initialCamera.z], fov: 32 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" }}
      frameloop={reducedMotion ? "demand" : "always"}
      onCreated={(state) => {
        state.gl.setClearColor(0x000000, 0);
        onReady();
      }}
      tabIndex={-1}
    >
      <BitScene
        state={state}
        intensity={intensity}
        reducedMotion={reducedMotion}
        debugOrbit={debugOrbit}
        resetSignal={resetSignal}
        replaySignal={replaySignal}
        loop={loop}
        production={production}
      />
    </Canvas>
  );
}

export function BitFallback() {
  return (
    // The static mark must render without the image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={BIT_FALLBACK_MARK} alt="BIT" className="bit-fallback" />
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
