"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NetworkComposer() {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const response = await fetch("/api/v1/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(messageOf(payload) ?? "Could not post.");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <form className="factory-form network-form" onSubmit={(event) => void submit(event)}>
      <label>
        What&apos;s happening?
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={500}
          rows={3}
          required
          placeholder="What's happening?"
        />
      </label>
      <button type="submit" disabled={pending}>POST</button>
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
