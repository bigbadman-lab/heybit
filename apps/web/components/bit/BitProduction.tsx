"use client";

import { useEffect, useState } from "react";
import { BitMascot3D } from "./BitMascot3D";
import { BIT_FALLBACK_MARK } from "./bit-mascot.constants";
import { useBitVisualPose } from "./use-bit-visual";

/** Production placement. Visual state comes from the reaction feed, not a hard-coded pose. */
export function BitProduction() {
  const pose = useBitVisualPose();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return (
    <figure className="bit-production">
      <BitMascot3D
        state={pose.state}
        intensity={pose.intensity}
        reducedMotion={reducedMotion}
        className="bit-stage bit-production-stage"
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BIT_FALLBACK_MARK} alt="BIT" />
      </noscript>
    </figure>
  );
}
