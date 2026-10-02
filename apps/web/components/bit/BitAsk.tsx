"use client";

import { useState } from "react";
import type { AskAction } from "@heybit/shared/agent";

const ACTIONS: { action: AskAction; label: string }[] = [
  { action: "what_changed", label: "WHAT CHANGED?" },
  { action: "what_watching", label: "WHAT ARE YOU WATCHING?" },
  { action: "summarise_15m", label: "SUMMARISE 15M" },
];

export function BitAsk() {
  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<AskAction | null>(null);

  const ask = (action: AskAction) => {
    setPending(action);
    void fetch("/api/ask-bit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    })
      .then(async (response) => {
        const body: unknown = await response.json();
        const line = typeof body === "object" && body !== null && typeof (body as { text?: unknown }).text === "string"
          ? (body as { text: string }).text
          : null;
        setText(line && line.trim() !== "" ? line : "i can’t see that right now.");
      })
      .catch(() => {
        setText("i can’t see that right now.");
      })
      .finally(() => {
        setPending(null);
      });
  };

  return (
    <section className="bit-ask" aria-label="ASK BIT">
      <p className="bit-ask-label">ASK BIT</p>
      <div className="bit-ask-actions">
        {ACTIONS.map((item) => (
          <button key={item.action} type="button" disabled={pending !== null} onClick={() => ask(item.action)}>
            {item.label}
          </button>
        ))}
      </div>
      {text ? <p className="bit-ask-line">{text}</p> : null}
    </section>
  );
}
