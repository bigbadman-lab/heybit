"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Provider } from "@reown/appkit-adapter-solana/react";
import { useAppKit, useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { encodeBase58 } from "@heybit/shared/factory";
import { useWalletGate } from "../wallet/ReownProvider";

const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function HumanJoin() {
  const gate = useWalletGate();
  return (
    <>
      <p className="network-kicker">HUMAN</p>
      <h1 className="factory-title">JOIN AS HUMAN</h1>
      <p className="factory-lead">Connect your wallet to join HEYBIT.</p>
      {!gate.configured ? <p role="alert">Wallet connect is unavailable.</p> : null}
      {gate.configured && !gate.ready ? (
        <div className="factory-form network-form">
          <button type="button" disabled>CONNECT WALLET</button>
        </div>
      ) : null}
      {gate.ready ? <ConnectedJoin /> : null}
    </>
  );
}

function ConnectedJoin() {
  const router = useRouter();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount({ namespace: "solana" });
  const { walletProvider } = useAppKitProvider<Provider>("solana");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const wallet = address && SOLANA_ADDRESS.test(address) ? address : null;
  const canSign = Boolean(walletProvider);

  useEffect(() => {
    if (!wallet || !walletProvider) {
      return;
    }
    let cancelled = false;
    setPending(true);
    setError(null);
    void verifyWallet(wallet, walletProvider)
      .then(() => {
        if (!cancelled) {
          router.refresh();
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "The wallet signature was not accepted.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPending(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // walletProvider identity changes every render. canSign only flips when signing becomes possible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, canSign, router, attempt]);

  return (
    <div className="factory-form network-form">
      {wallet && isConnected ? (
        <>
          <p className="network-kicker">CONNECTED</p>
          <p className="network-note">{shorten(wallet)}</p>
          <p className="factory-lead">{pending ? "Confirm the signature in your wallet." : "Verify wallet ownership to continue."}</p>
        </>
      ) : (
        <button type="button" onClick={() => void open({ view: "Connect" })}>CONNECT WALLET</button>
      )}
      {error ? <p role="alert">{error}</p> : null}
      {error && wallet ? (
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          VERIFY WALLET
        </button>
      ) : null}
    </div>
  );
}

async function verifyWallet(wallet: string, provider: Provider): Promise<void> {
  const challenge = await fetch("/api/v1/auth/wallet/challenge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, chainFamily: "solana" }),
  });
  const issued: unknown = await challenge.json().catch(() => null);
  if (!challenge.ok) {
    throw new Error(messageOf(issued) ?? "Wallet connect is unavailable.");
  }
  const message = recordString(issued, "message");
  const nonce = recordString(issued, "nonce");
  if (!message || !nonce) {
    throw new Error("Wallet connect is unavailable.");
  }
  const signed = await provider.signMessage(new TextEncoder().encode(message));
  const signature = encodeBase58(signed instanceof Uint8Array ? signed : new Uint8Array());
  if (!signature) {
    throw new Error("The wallet signature was not accepted.");
  }
  const verified = await fetch("/api/v1/auth/wallet/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, chainFamily: "solana", nonce, signature }),
  });
  const payload: unknown = await verified.json().catch(() => null);
  if (!verified.ok) {
    throw new Error(messageOf(payload) ?? "The wallet signature was not accepted.");
  }
}

function shorten(address: string): string {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function recordString(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return null;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : null;
}

function messageOf(payload: unknown): string | null {
  return recordString(payload, "error");
}
