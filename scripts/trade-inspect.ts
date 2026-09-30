import "./lib/bootstrap.js";
import { getBitRuntime } from "@heybit/shared";
import { parseTrade } from "@heybit/shared/trade";
import { createReadOnlyConnection, readAlchemyConfig } from "../apps/worker/src/alchemy.js";
import { fromConfirmedTransaction } from "../apps/worker/src/decode-transaction.js";
import { reportLine } from "./lib/launch-report.js";
import { createAnonClient } from "./lib/supabase.js";

const signature = process.argv.slice(2).find((arg) => arg !== "--mint" && !arg.startsWith("-"));
const mintFlag = process.argv.indexOf("--mint");
const explicitMint = mintFlag >= 0 ? process.argv[mintFlag + 1] : undefined;

if (!signature || signature === explicitMint) {
  process.stdout.write("BLOCKED\n\nA public transaction signature is required.\nNo writes were performed.\n");
  process.exit(1);
}

const mint = explicitMint ?? (await canonicalMint());
if (!mint) {
  process.stdout.write(
    "BLOCKED\n\nNo canonical mint is set.\nPass --mint <PUBLIC_MINT> to inspect against an explicit mint.\nNo writes were performed.\n",
  );
  process.exit(1);
}

const config = readAlchemyConfig(process.env);
if (!config) {
  process.stdout.write("BLOCKED\n\nAlchemy RPC configuration is missing.\nNo writes were performed.\n");
  process.exit(1);
}

try {
  const connection = createReadOnlyConnection(config.rpcUrl);
  const response = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  const tx = fromConfirmedTransaction(signature, response);
  const parsed = tx ? parseTrade(tx, mint, new Date().toISOString()) : null;
  const classification = !tx ? "NOT FOUND" : parsed?.kind === "trade" ? parsed.event.type : "IGNORE";
  const relevant = parsed?.kind === "trade" ? "YES" : "NO";
  const sol = parsed?.kind === "trade" ? String(parsed.event.solAmount) : "n/a";
  const tokens = parsed?.kind === "trade" && parsed.event.tokenAmount !== null ? String(parsed.event.tokenAmount) : "n/a";

  process.stdout.write(
    [
      "HEYBIT — TRADE INSPECT",
      "",
      reportLine("Signature", signature),
      reportLine("Relevant to mint", relevant),
      reportLine("Classification", classification),
      reportLine("SOL amount", sol),
      reportLine("Token amount", tokens),
      "",
      reportLine("Writes", "NONE"),
      "",
    ].join("\n"),
  );
  process.exit(parsed?.kind === "trade" ? 0 : 1);
} catch {
  process.stdout.write("BLOCKED\n\nThe transaction could not be read.\nNo writes were performed.\n");
  process.exit(1);
}

async function canonicalMint(): Promise<string | null> {
  try {
    const runtime = await getBitRuntime(createAnonClient());
    return runtime.canonicalMint;
  } catch {
    return null;
  }
}
