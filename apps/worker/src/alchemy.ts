import { Connection } from "@solana/web3.js";
import { identifyCluster, type SolanaCluster } from "@heybit/shared/trade";

export interface AlchemyStatus {
  rpc: "PASS" | "FAIL";
  network: "MAINNET" | "DEVNET" | "TESTNET" | "UNKNOWN";
  slot: number | null;
  wss: "PASS" | "FAIL";
}

const CLUSTER_LABEL: Record<SolanaCluster, AlchemyStatus["network"]> = {
  mainnet: "MAINNET",
  devnet: "DEVNET",
  testnet: "TESTNET",
  unknown: "UNKNOWN",
};

export function readAlchemyConfig(env: NodeJS.ProcessEnv): { rpcUrl: string; wssUrl: string } | null {
  const rpcUrl = env.ALCHEMY_SOLANA_RPC_URL;
  const wssUrl = env.ALCHEMY_SOLANA_WSS_URL;
  if (!usable(rpcUrl) || !usable(wssUrl)) {
    return null;
  }
  if (!rpcUrl.startsWith("https://") || !wssUrl.startsWith("wss://")) {
    return null;
  }
  return { rpcUrl, wssUrl };
}

export async function checkAlchemy(env: NodeJS.ProcessEnv): Promise<AlchemyStatus> {
  const config = readAlchemyConfig(env);
  if (!config) {
    return { rpc: "FAIL", network: "UNKNOWN", slot: null, wss: "FAIL" };
  }

  try {
    const connection = new Connection(config.rpcUrl, "confirmed");
    const genesis = await connection.getGenesisHash();
    const network = CLUSTER_LABEL[identifyCluster(genesis)];
    if (network !== "MAINNET") {
      return { rpc: "PASS", network, slot: null, wss: "FAIL" };
    }
    const slot = await connection.getSlot("confirmed");
    const wss = await probeWebsocket(config.wssUrl);
    return {
      rpc: "PASS",
      network: "MAINNET",
      slot: Number.isSafeInteger(slot) ? slot : null,
      wss,
    };
  } catch {
    return { rpc: "FAIL", network: "UNKNOWN", slot: null, wss: "FAIL" };
  }
}

export function createReadOnlyConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, "confirmed");
}

export async function probeWebsocket(wssUrl: string, timeoutMs = 8_000): Promise<"PASS" | "FAIL"> {
  return new Promise((resolve) => {
    let settled = false;
    let socket: WebSocket;
    const finish = (value: "PASS" | "FAIL") => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // The socket may already be closed. Do not log the endpoint.
      }
      resolve(value);
    };
    const timer = setTimeout(() => finish("FAIL"), timeoutMs);

    try {
      socket = new WebSocket(wssUrl);
    } catch {
      finish("FAIL");
      return;
    }

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "slotSubscribe" }));
    });
    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as { id?: number; error?: unknown; result?: unknown };
        if (message.id !== 1) {
          return;
        }
        if (message.error || message.result === undefined) {
          finish("FAIL");
          return;
        }
        socket.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "slotUnsubscribe", params: [message.result] }));
        finish("PASS");
      } catch {
        finish("FAIL");
      }
    });
    socket.addEventListener("error", () => {
      finish("FAIL");
    });
  });
}

function usable(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}
