import "./lib/bootstrap.js";
import { reportLine } from "./lib/launch-report.js";
import { checkAlchemy } from "../apps/worker/src/alchemy.js";

const status = await checkAlchemy(process.env);
const ok = status.rpc === "PASS" && status.network === "MAINNET" && status.wss === "PASS" && status.slot !== null;

process.stdout.write(
  [
    "HEYBIT — ALCHEMY CHECK",
    "",
    reportLine("RPC", status.rpc),
    reportLine("Network", status.network),
    reportLine("Current slot", status.slot === null ? "unavailable" : String(status.slot)),
    reportLine("WSS", status.wss),
    "",
    "Read-only. No transactions were sent.",
    "",
    `VERDICT: ${ok ? "PASS" : "BLOCKED"}`,
    "",
  ].join("\n"),
);

process.exit(ok ? 0 : 1);
