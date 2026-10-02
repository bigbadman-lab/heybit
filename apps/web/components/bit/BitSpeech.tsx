"use client";

import { useEffect, useRef, useState } from "react";
import { commentarySeed, idleCommentaryActive, IDLE_COMMENTARY_MS, spokenLine } from "./bit-commentary";
import { INTRO_SESSION_KEY, introCanYield, introLines, shouldStartIntro } from "./bit-intro";
import { useBitFeed } from "./use-bit-visual";

const CHAR_MS = 28;
const LINE_GAP_MS = 420;

export function BitSpeech() {
  const feed = useBitFeed();
  const [idleTick, setIdleTick] = useState(0);
  const [introText, setIntroText] = useState<string | null>(null);
  const [introDone, setIntroDone] = useState(false);
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
    const finish = () => {
      window.clearInterval(timer);
      try {
        window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
      } catch {
        // Session memory is optional. The intro still ends.
      }
      if (!cancelled) {
        setIntroText(null);
        setIntroDone(true);
      }
    };
    timer = window.setInterval(() => {
      if (cancelled || Date.now() < pauseUntil) {
        return;
      }
      if (introCanYield(firstLineDone.current, launchState, speechRef.current)) {
        finish();
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
          finish();
        } else {
          pauseUntil = Date.now() + LINE_GAP_MS;
        }
      }
    }, CHAR_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [feed.presence, launchState]);

  const showingIntro = introText !== null && !introDone;
  const phrase = showingIntro ? introText : spoken.text;

  return (
    <h1 key={showingIntro ? "intro" : phrase} className={showingIntro || spoken.source !== "reaction" ? "bit-speech bit-commentary" : "bit-speech"}>
      {phrase}
    </h1>
  );
}
