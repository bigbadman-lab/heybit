"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Provider } from "@reown/appkit-adapter-solana/react";
import { useAppKit, useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { useWalletGate } from "../wallet/ReownProvider";
import { normalizeWalletSignature } from "../../lib/wallet-signature";

const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function HumanJoin() {
  const gate = useWalletGate();
  if (!gate.configured) {
    return <p role="alert">Wallet connect is unavailable.</p>;
  }
  if (!gate.ready) {
    return (
      <>
        <p className="network-kicker">JOIN / HUMAN</p>
        <h1 className="factory-title">CONNECT A WALLET</h1>
        <p className="factory-lead">Your wallet proves account ownership. Your username is what the network sees.</p>
        <div className="factory-form network-form">
          <button type="button" disabled>CONNECT WALLET</button>
        </div>
      </>
    );
  }
  return <ConnectedJoin />;
}

function ConnectedJoin() {
  const router = useRouter();
  const { open } = useAppKit();
  const solana = useAppKitAccount({ namespace: "solana" });
  const active = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Provider>("solana");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const wallet = solana.address && SOLANA_ADDRESS.test(solana.address) ? solana.address : null;
  const connected = Boolean(wallet) && solana.isConnected;
  const wrongNamespace = !connected && (active.isConnected || caipFamily(active) === "eip155");

  async function verify() {
    if (!wallet || !walletProvider || pending) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await verifyWallet(wallet, walletProvider);
      const session = await fetch("/api/v1/auth/wallet/session", { cache: "no-store", credentials: "same-origin" });
      const state: unknown = await session.json().catch(() => null);
      if (!session.ok || !isAuthenticated(state)) {
        throw new Error("The session was not saved. Try again.");
      }
      if (accountUsername(state)) {
        router.push("/network");
      }
      router.refresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The wallet signature was not accepted. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (connected && wallet) {
    return (
      <>
        <p className="network-kicker">JOIN / HUMAN</p>
        <h1 className="factory-title">WALLET</h1>
        <p className="network-note">● CONNECTED</p>
        <p className="network-note">{shorten(wallet)}</p>
        <p className="factory-lead">
          {pending ? "Confirm the signature in your wallet." : "Your wallet proves account ownership. Your username is what the network sees."}
        </p>
        <div className="factory-form network-form">
          <button type="button" onClick={() => void verify()} disabled={pending || !walletProvider}>
            VERIFY WALLET
          </button>
          {error ? <p role="alert">{error}</p> : null}
        </div>
      </>
    );
  }

  return (
    <>
      <p className="network-kicker">JOIN / HUMAN</p>
      <h1 className="factory-title">CONNECT A WALLET</h1>
      <p className="factory-lead">Your wallet proves account ownership. Your username is what the network sees.</p>
      {wrongNamespace ? <p role="alert">Connect a Solana wallet to join.</p> : null}
      <div className="factory-form network-form">
        <button type="button" onClick={() => void open({ view: "Connect" })}>CONNECT WALLET</button>
      </div>
    </>
  );
}

async function verifyWallet(wallet: string, provider: Provider): Promise<void> {
  const challenge = await fetch("/api/v1/auth/wallet/challenge", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
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
  const signed: unknown = await provider.signMessage(new TextEncoder().encode(message));
  const signature = normalizeWalletSignature(signed);
  if (!signature) {
    throw new Error("The wallet signature was not accepted. Try again.");
  }
  const verified = await fetch("/api/v1/auth/wallet/verify", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, chainFamily: "solana", nonce, signature }),
  });
  const payload: unknown = await verified.json().catch(() => null);
  if (!verified.ok) {
    throw new Error(messageOf(payload) ?? "The wallet signature was not accepted. Try again.");
  }
}

function shorten(address: string): string {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function caipFamily(account: object): string | null {
  if (!("caipAddress" in account) || typeof account.caipAddress !== "string") {
    return null;
  }
  const family = account.caipAddress.split(":")[0];
  return family || null;
}

function isAuthenticated(value: unknown): boolean {
  return typeof value === "object" && value !== null && "authenticated" in value && value.authenticated === true;
}

function accountUsername(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("account" in value)) {
    return null;
  }
  const account = value.account;
  if (typeof account !== "object" || account === null || !("username" in account)) {
    return null;
  }
  return typeof account.username === "string" ? account.username : null;
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
