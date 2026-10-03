"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function HumanIdentity({
  username,
  addressLabel,
}: {
  username: string | null;
  addressLabel: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function disconnect() {
    setPending(true);
    await fetch("/api/v1/auth/sign-out", { method: "POST", credentials: "same-origin" });
    try {
      const { disconnectActiveWallet } = await import("../wallet/disconnect-wallet");
      await disconnectActiveWallet();
    } catch {
      // The HEYBIT cookie is what authorizes writes.
    }
    setPending(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="site-session">
      {username ? <Link href={`/u/${username}`}>@{username}</Link> : <span>WALLET VERIFIED</span>}
      {addressLabel ? <span>{addressLabel}</span> : null}
      <button type="button" onClick={() => void disconnect()} disabled={pending}>
        DISCONNECT
      </button>
    </div>
  );
}
