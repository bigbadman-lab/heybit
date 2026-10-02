"use client";

import { useEffect, useRef, useState } from "react";
import { commentarySeed, idleCommentaryActive, IDLE_COMMENTARY_MS, spokenLine } from "./bit-commentary";
import { INTRO_FADE_MS, INTRO_HOLD_MS, INTRO_SESSION_KEY, introCanYield, introLines, shouldStartIntro } from "./bit-intro";
import { useBitFeed } from "./use-bit-visual";

const CHAR_MS = 28;
const LINE_GAP_MS = 420;

export function BitSpeech() {
  const feed = useBitFeed();
  const [idleTick, setIdleTick] = useState(0);
  const [introText, setIntroText] = useState<string | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const [dim, setDim] = useState(false);
  const started = useRef(false);
  const firstLineDone = useRef(false);
  const speechRef = useRef(feed.speech);
  speechRef.current = feed.speech;
  const state = feed.pose.state;
  const launchState = feed.presence?.launchState ?? null;
  const spoken = spokenLine({
    launchState,
    reactionText: feed.speech,
    state,
    seed: commentarySeed(state, feed.cueId, idleTick),
  });

  useEffect(() => {
    if (!idleCommentaryActive(state) || introText !== null) {
      return;
    }
    const timer = window.setInterval(() => setIdleTick((tick) => tick + 1), IDLE_COMMENTARY_MS);
    return () => window.clearInterval(timer);
  }, [state, introText]);

  useEffect(() => {
    if (started.current || !feed.presence) {
      return;
    }
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(INTRO_SESSION_KEY) === "1";
    } catch {
      seen = true;
    }
    if (!shouldStartIntro(seen, true)) {
      started.current = true;
      setIntroDone(true);
      return;
    }
    started.current = true;
    const lines = introLines(launchState);
    let cancelled = false;
    let lineIndex = 0;
    let charIndex = 0;
    let pauseUntil = 0;
    let timer = 0;
    let holdTimer = 0;
    let holding = false;
    let released = false;
    const remember = () => {
      try {
        window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
      } catch {
        // Session memory is optional. The intro still ends.
      }
    };
    const release = (immediate: boolean) => {
      if (released || cancelled) {
        return;
      }
      released = true;
      window.clearInterval(timer);
      window.clearTimeout(holdTimer);
      remember();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (immediate || reduced) {
        setDim(false);
        setIntroText(null);
        setIntroDone(true);
        return;
      }
      setDim(true);
      holdTimer = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        setIntroText(null);
        setIntroDone(true);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (!cancelled) {
              setDim(false);
            }
          });
        });
      }, INTRO_FADE_MS);
    };
    timer = window.setInterval(() => {
      if (cancelled) {
        return;
      }
      if (introCanYield(firstLineDone.current, launchState, speechRef.current)) {
        release(true);
        return;
      }
      if (holding || Date.now() < pauseUntil) {
        return;
      }
      const line = lines[lineIndex] ?? "";
      charIndex += 1;
      const shown = lines.slice(0, lineIndex).concat(line.slice(0, charIndex));
      setIntroText(shown.join(" "));
      if (charIndex >= line.length) {
        if (lineIndex === 0) {
          firstLineDone.current = true;
        }
        lineIndex += 1;
        charIndex = 0;
        if (lineIndex >= lines.length) {
          holding = true;
          remember();
          holdTimer = window.setTimeout(() => release(false), INTRO_HOLD_MS);
        } else {
          pauseUntil = Date.now() + LINE_GAP_MS;
        }
      }
    }, CHAR_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.clearTimeout(holdTimer);
    };
  }, [feed.presence, launchState]);

  const showingIntro = introText !== null && !introDone;
  const phrase = showingIntro ? introText : spoken.text;

  return (
    <h1
      key={showingIntro || dim ? "intro" : phrase}
      className={`${showingIntro || spoken.source !== "reaction" ? "bit-speech bit-commentary" : "bit-speech"}${dim ? " is-dim" : ""}`}
    >
      {phrase}
    </h1>
  );
}
