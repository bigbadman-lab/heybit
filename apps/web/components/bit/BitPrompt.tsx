"use client";

import { terminalPrompt } from "./bit-terminal";
import { useBitFeed } from "./use-bit-visual";

export function BitPrompt() {
  const line = terminalPrompt(useBitFeed().pose.state);

  return (
    <p className="bit-prompt">
      {`> ${line}`}
      <span className="bit-cursor" aria-hidden="true">_</span>
    </p>
  );
}
