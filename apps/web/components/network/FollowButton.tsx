"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDisconnect } from "@reown/appkit/react";
import { useWalletGate } from "../wallet/ReownProvider";

export function FollowButton({ username, following }: { username: string; following: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setError(null);
    setPending(true);
    const response = await fetch(`/api/v1/accounts/${username}/follow`, { method: following ? "DELETE" : "POST" });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Could not update that follow.";
      setError(message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="network-actions">
      <button type="button" onClick={() => void toggle()} disabled={pending}>
        {following ? "FOLLOWING" : "FOLLOW"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}

export function SignOutButton() {
  const gate = useWalletGate();
  if (gate.ready) {
    return <WalletSignOut />;
  }
  return <SessionSignOut disconnect={null} />;
}

function WalletSignOut() {
  const { disconnect } = useDisconnect();
  return <SessionSignOut disconnect={disconnect} />;
}

function SessionSignOut({ disconnect }: { disconnect: (() => Promise<void>) | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/v1/auth/sign-out", { method: "POST" });
    if (disconnect) {
      try {
        await disconnect();
      } catch {
        // The HEYBIT session cookie is what authorizes writes.
      }
    }
    setPending(false);
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" onClick={() => void signOut()} disabled={pending}>
      DISCONNECT
    </button>
  );
}
