"use client";

import { useMemo, useState } from "react";
import { encodeBase58, PERSONALITIES, AVATARS, ACCENTS, agentIntroLines, previewLine, slugFromName, type AccentKey, type AvatarKey, type Personality } from "@heybit/shared/factory";

export function CreateAgent() {
  const [name, setName] = useState("MOGBIT");
  const [tokenMint, setTokenMint] = useState("");
  const [personality, setPersonality] = useState<Personality>("DEGEN");
  const [avatarKey, setAvatarKey] = useState<AvatarKey>("mark");
  const [accentKey, setAccentKey] = useState<AccentKey>("acid");
  const [wallet, setWallet] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slug = slugFromName(name);
  const preview = useMemo(() => {
    if (!name.trim()) {
      return null;
    }
    return {
      line: previewLine({ name: name.trim(), personality }),
      intro: agentIntroLines({ name: name.trim(), personality, tokenMint: tokenMint || "mint" }),
    };
  }, [name, personality, tokenMint]);

  const connect = async () => {
    setError(null);
    const provider = solanaProvider();
    if (!provider) {
      setError("A Solana wallet in this browser is required to sign.");
      return;
    }
    const connected = await provider.connect();
    const address = connected.publicKey.toString();
    const challenge = await fetch("/api/agents/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: address }),
    });
    const issued: unknown = await challenge.json();
    if (!challenge.ok || typeof issued !== "object" || issued === null || typeof (issued as { message?: unknown }).message !== "string") {
      setError("Sign-in is unavailable.");
      return;
    }
    const message = (issued as { message: string; nonce?: string }).message;
    const nonce = (issued as { nonce?: string }).nonce;
    const signed = await provider.signMessage(new TextEncoder().encode(message));
    const signatureBytes = signed instanceof Uint8Array ? signed : signed.signature;
    const session = await fetch("/api/agents/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: address, nonce, signature: encodeBase58(signatureBytes) }),
    });
    if (!session.ok) {
      setError("The wallet signature was not accepted.");
      return;
    }
    setWallet(address);
  };

  const create = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, tokenMint, personality, avatarKey, accentKey }),
      });
      const body: unknown = await response.json();
      const slugValue = typeof body === "object" && body !== null ? (body as { agent?: { slug?: unknown } }).agent?.slug : null;
      if (response.ok && typeof slugValue === "string") {
        window.location.assign(`/agent/${slugValue}`);
        return;
      }
      const message = typeof body === "object" && body !== null && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : "Agent was not created.";
      setError(message);
    } catch {
      setError("Agent was not created.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="factory-form" onSubmit={(event) => { event.preventDefault(); void create(); }}>
      <label>
        TOKEN
        <input value={tokenMint} onChange={(event) => setTokenMint(event.target.value.trim())} placeholder="Solana token mint" autoComplete="off" spellCheck={false} />
      </label>
      <label>
        IDENTITY
        <input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} autoComplete="off" />
      </label>
      <p className="factory-slug">{slug || "slug"}</p>
      <fieldset>
        <legend>PERSONALITY</legend>
        <div className="factory-choices">
          {PERSONALITIES.map((item) => (
            <button key={item} type="button" aria-pressed={personality === item} onClick={() => setPersonality(item)}>{item}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>AVATAR</legend>
        <div className="factory-choices">
          {AVATARS.map((item) => (
            <button key={item} type="button" aria-pressed={avatarKey === item} onClick={() => setAvatarKey(item)}>{item}</button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>ACCENT</legend>
        <div className="factory-choices">
          {ACCENTS.map((item) => (
            <button key={item} type="button" aria-pressed={accentKey === item} onClick={() => setAccentKey(item)}>{item}</button>
          ))}
        </div>
      </fieldset>
      <section className="factory-preview" data-accent={accentKey} data-avatar={avatarKey}>
        <p>PREVIEW</p>
        <h1>{name.trim() || "unnamed"}</h1>
        <p>{preview?.line}</p>
        <p>{preview?.intro.join(" ")}</p>
      </section>
      <div className="factory-actions">
        {wallet ? <p className="factory-slug">signed in</p> : <button type="button" onClick={() => void connect()}>SIGN IN</button>}
        <button type="submit" disabled={pending || !wallet}>CREATE AGENT</button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}

function solanaProvider(): {
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array }>;
} | null {
  const candidate = (window as Window & { solana?: unknown }).solana;
  if (typeof candidate !== "object" || candidate === null || !("connect" in candidate) || !("signMessage" in candidate)) {
    return null;
  }
  return candidate as {
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    signMessage: (message: Uint8Array) => Promise<Uint8Array | { signature: Uint8Array }>;
  };
}
