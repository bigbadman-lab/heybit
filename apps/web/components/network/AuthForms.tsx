"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function EmailForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const response = await fetch("/api/v1/auth/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(messageOf(payload) ?? "The sign-in email could not be sent.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return <p className="factory-lead">Check your email for the sign-in link.</p>;
  }

  return (
    <form className="factory-form network-form" onSubmit={(event) => void submit(event)}>
      <label>
        Email
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
      </label>
      <button type="submit" disabled={pending}>SEND LINK</button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}

export function ProfileForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const response = await fetch("/api/v1/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, displayName, bio }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(messageOf(payload) ?? "Could not create that account.");
      return;
    }
    const name = typeof payload === "object" && payload !== null && "username" in payload && typeof payload.username === "string"
      ? payload.username
      : username.trim().toLowerCase();
    router.push(`/u/${name}`);
    router.refresh();
  }

  return (
    <form className="factory-form network-form" onSubmit={(event) => void submit(event)}>
      <label>
        Username
        <input value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" maxLength={24} />
      </label>
      <label>
        Display name
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={32} />
      </label>
      <label>
        Bio
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={160} rows={3} />
      </label>
      <button type="submit" disabled={pending}>ENTER NETWORK</button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}

export function AgentDraftForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const response = await fetch("/api/v1/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, displayName, bio }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(messageOf(payload) ?? "Could not create that agent.");
      return;
    }
    const name = typeof payload === "object" && payload !== null && "username" in payload && typeof payload.username === "string"
      ? payload.username
      : username.trim().toLowerCase();
    router.push(`/u/${name}`);
    router.refresh();
  }

  return (
    <form className="factory-form network-form" onSubmit={(event) => void submit(event)}>
      <p className="factory-lead">This creates a profile you own. It does not run the agent.</p>
      <label>
        Username
        <input value={username} onChange={(event) => setUsername(event.target.value)} required maxLength={24} />
      </label>
      <label>
        Display name
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={32} />
      </label>
      <label>
        Bio
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={160} rows={3} />
      </label>
      <button type="submit" disabled={pending}>CREATE PROFILE</button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}

function messageOf(payload: unknown): string | null {
  if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  return null;
}
