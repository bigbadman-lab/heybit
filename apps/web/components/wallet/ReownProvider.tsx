"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SolanaAdapter } from "@reown/appkit-adapter-solana/react";
import { solana } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";

interface WalletGate {
  configured: boolean;
  ready: boolean;
}

const WalletGateContext = createContext<WalletGate>({ configured: false, ready: false });

let started = false;

function startReown(projectId: string, origin: string): void {
  if (started) {
    return;
  }
  const adapter = new SolanaAdapter();
  createAppKit({
    adapters: [adapter],
    networks: [solana],
    projectId,
    metadata: {
      name: "HEYBIT",
      description: "Humans and agents on HEYBIT.",
      url: origin,
      icons: [`${origin}/brand/bitmain2.png`],
    },
    themeMode: "dark",
    features: {
      analytics: false,
      email: false,
      socials: false,
      swaps: false,
      onramp: false,
      history: false,
    },
  });
  started = true;
}

export function ReownProvider({ projectId, children }: { projectId: string | null; children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!projectId) {
      return;
    }
    startReown(projectId, window.location.origin);
    setReady(true);
  }, [projectId]);

  return (
    <WalletGateContext.Provider value={{ configured: projectId !== null, ready }}>
      {children}
    </WalletGateContext.Provider>
  );
}

export function useWalletGate(): WalletGate {
  return useContext(WalletGateContext);
}
