"use client";

import { useEffect, useState } from "react";
import type { PublicAgent } from "@heybit/shared/agent";
import { agentIntroLines, type PublicAgentProfile } from "@heybit/shared/factory";

const ACTIONS = [
  { action: "what_changed", label: "WHAT CHANGED?" },
  { action: "what_watching", label: "WHAT ARE YOU WATCHING?" },
  { action: "summarise_15m", label: "SUMMARISE 15M" },
] as const;

export function AgentRoom({ profile }: { profile: PublicAgentProfile }) {
  const [intro, setIntro] = useState<string | null>(null);
  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [speech, setSpeech] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const key = `heybit.agent.intro.${profile.slug}`;
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(key) === "1";
    } catch {
      seen = true;
    }
    if (seen) {
      return;
    }
    const lines = agentIntroLines(profile);
    let index = 0;
    let chars = 0;
    const timer = window.setInterval(() => {
      const line = lines[index] ?? "";
      chars += 1;
      setIntro(lines.slice(0, index).concat(line.slice(0, chars)).join(" "));
      if (chars >= line.length) {
        index += 1;
        chars = 0;
        if (index >= lines.length) {
          window.clearInterval(timer);
          try {
            window.sessionStorage.setItem(key, "1");
          } catch {
            // Session memory is optional.
          }
          window.setTimeout(() => setIntro(null), 3600);
        }
      }
    }, 28);
    return () => window.clearInterval(timer);
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    const pull = () => {
      void fetch(`/api/agents/${profile.slug}/visual`, { cache: "no-store" })
        .then(async (response) => response.json())
        .then((body: unknown) => {
          if (cancelled || typeof body !== "object" || body === null) {
            return;
          }
          const record = body as { agent?: PublicAgent; speech?: string | null };
          if (record.agent) {
            setAgent(record.agent);
          }
          setSpeech(typeof record.speech === "string" ? record.speech : null);
        })
        .catch(() => undefined);
    };
    pull();
    const timer = window.setInterval(pull, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [profile.slug]);

  const ask = (action: (typeof ACTIONS)[number]["action"]) => {
    setPending(true);
    void fetch(`/api/agents/${profile.slug}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    })
      .then(async (response) => response.json())
      .then((body: unknown) => {
        const text = typeof body === "object" && body !== null && typeof (body as { text?: unknown }).text === "string" ? (body as { text: string }).text : null;
        setAnswer(text && text.trim() !== "" ? text : "i can’t see that right now.");
      })
      .catch(() => setAnswer("i can’t see that right now."))
      .finally(() => setPending(false));
  };

  const lifecycle = agent?.lifecycle ?? "IDLE";
  return (
    <article className={`agent-room accent-${profile.accentKey} avatar-${profile.avatarKey}`}>
      <p className="eyebrow">{profile.personality}</p>
      <h1>{profile.name}</h1>
      <p className="agent-lifecycle">{lifecycleLabel(lifecycle)}</p>
      <p className="agent-mint">{profile.tokenMint}</p>
      <p className="agent-speech">{intro ?? speech ?? "i’m here."}</p>
      <p>BIT STATE {agent?.state ?? "QUIET"}</p>
      <p>LAST 15M {agent?.recent.buyCount ?? "—"} buys · {agent?.recent.sellCount ?? "—"} sells</p>
      <div className="bit-ask-actions">
        {ACTIONS.map((item) => (
          <button key={item.action} type="button" disabled={pending} onClick={() => ask(item.action)}>{item.label}</button>
        ))}
      </div>
      {answer ? <p className="bit-ask-line">{answer}</p> : null}
      <ul className="agent-stream">
        {(agent?.observations ?? []).map((item) => (
          <li key={`${item.atMs}:${item.type}`}>{item.type}{item.solAmount === null ? "" : ` ${item.solAmount} SOL`}</li>
        ))}
      </ul>
    </article>
  );
}

function lifecycleLabel(lifecycle: string): string {
  if (lifecycle === "WATCHING") {
    return "ONLINE · WATCHING CHAIN";
  }
  if (lifecycle === "THINKING") {
    return "ONLINE · THINKING";
  }
  if (lifecycle === "REACTING") {
    return "ONLINE · SPEAKING";
  }
  return "IDLE · WAITING";
}
