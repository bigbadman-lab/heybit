"use client";

import { useEffect, useState } from "react";
import { BitMascot3D } from "./BitMascot3D";
import { BIT_FALLBACK_MARK } from "./bit-mascot.constants";

/** Production placement. Phase 5A keeps BIT in the approved idle pose. */
export function BitProduction() {
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
      <BitMascot3D state="IDLE" intensity={0} reducedMotion={reducedMotion} className="bit-stage bit-production-stage" />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BIT_FALLBACK_MARK} alt="BIT" />
      </noscript>
    </figure>
  );
}
