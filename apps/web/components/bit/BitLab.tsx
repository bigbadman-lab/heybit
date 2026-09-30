"use client";

import { useEffect, useRef, useState } from "react";
import { BitMascot3D } from "./BitMascot3D";
import {
  BIT_COMPARE_MODES,
  BIT_MASCOT_STATES,
  BIT_REFERENCE_PATH,
  EVENT_DURATION_MS,
  type BitCompareMode,
  type BitMascotState,
} from "./bit-mascot.constants";
import { referenceFrame } from "./bit-mascot.state";

export function BitLab() {
  const [state, setState] = useState<BitMascotState>("IDLE");
  const [intensity, setIntensity] = useState(0.2);
  const [forceReduced, setForceReduced] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const [debugOrbit, setDebugOrbit] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [compare, setCompare] = useState<BitCompareMode>("SPLIT");
  const [replaySignal, setReplaySignal] = useState(0);
  const [loop, setLoop] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.45);
  const [referenceSize, setReferenceSize] = useState(0);
  const referencePane = useRef<HTMLDivElement>(null);
  const reducedMotion = systemReduced || forceReduced;
  const reactionMs = EVENT_DURATION_MS[state];
  const showModel = compare !== "REFERENCE";
  const showReference = compare !== "3D";

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setSystemReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const pane = referencePane.current;
    if (!pane) {
      return;
    }
    const apply = () => {
      const box = pane.getBoundingClientRect();
      setReferenceSize(referenceFrame(box.width, box.height));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [compare]);

  return (
    <main className="bit-lab">
      <div className={`bit-view bit-view-${compare.toLowerCase()}`}>
        {showReference ? (
          <div className="bit-pane" ref={referencePane}>
            {/* The approved mark is a static file, including inside noscript. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BIT_REFERENCE_PATH}
              alt="Approved BIT logo"
              className={compare === "OVERLAY" ? "bit-overlay" : "bit-reference"}
              style={
                referenceSize > 0
                  ? {
                      width: referenceSize,
                      height: referenceSize,
                      opacity: compare === "OVERLAY" ? overlayOpacity : 1,
                    }
                  : undefined
              }
            />
          </div>
        ) : null}
        {showModel ? (
          <div className="bit-pane">
            <BitMascot3D
              state={state}
              intensity={intensity}
              reducedMotion={reducedMotion}
              debugOrbit={debugOrbit}
              resetSignal={resetSignal}
              replaySignal={replaySignal}
              loop={loop}
            />
          </div>
        ) : null}
      </div>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BIT_REFERENCE_PATH} alt="BIT" />
      </noscript>
      <section className="bit-controls" aria-label="Mascot review">
        <p className="eyebrow">BIT visual lab</p>
        <div className="bit-states" role="group" aria-label="Comparison">
          {BIT_COMPARE_MODES.map((mode) => (
            <button key={mode} type="button" aria-pressed={compare === mode} onClick={() => setCompare(mode)}>
              {mode}
            </button>
          ))}
        </div>
        <div className="bit-states" role="group" aria-label="Mascot state">
          {BIT_MASCOT_STATES.map((item) => (
            <button key={item} type="button" aria-pressed={state === item} onClick={() => setState(item)}>
              {item}
            </button>
          ))}
        </div>
        <p className="bit-readout">
          {reactionMs ? `${state} ${reactionMs} ms` : `${state} holds`}
        </p>
        <div className="bit-states">
          <button type="button" onClick={() => setReplaySignal((value) => value + 1)}>
            Replay
          </button>
          <label>
            <input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} />
            Loop
          </label>
        </div>
        <label>
          Intensity {intensity.toFixed(1)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={intensity}
            onChange={(event) => setIntensity(Number(event.target.value))}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={reducedMotion}
            disabled={systemReduced}
            onChange={(event) => setForceReduced(event.target.checked)}
          />
          Reduced motion
        </label>
        <label>
          <input type="checkbox" checked={debugOrbit} onChange={(event) => setDebugOrbit(event.target.checked)} />
          Debug orbit
        </label>
        {compare === "OVERLAY" ? (
          <label>
            Overlay {overlayOpacity.toFixed(2)}
            <input
              type="range"
              min={0.15}
              max={0.75}
              step={0.05}
              value={overlayOpacity}
              onChange={(event) => setOverlayOpacity(Number(event.target.value))}
            />
          </label>
        ) : null}
        <button type="button" onClick={() => setResetSignal((value) => value + 1)}>
          Reset camera
        </button>
      </section>
    </main>
  );
}
