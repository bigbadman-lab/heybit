import "./lib/bootstrap.js";
import { readCanonicalRuntime, reportLine, type RuntimeReadResult } from "./lib/launch-report.js";
import { createAnonClient, createServiceRoleClient } from "./lib/supabase.js";

const service = await readRole("service");
const anon = await readRole("anon");
const launchState = service.status === "ok" ? service.runtime.launchState : "UNAVAILABLE";
const row = service.status === "ok" ? "PASS" : "FAIL";
const serviceLabel = service.status === "ok" ? "PASS" : "FAIL";
const anonLabel = anon.status === "ok" ? "PASS" : "FAIL";
const ok = service.status === "ok" && anon.status === "ok";

process.stdout.write(
  [
    "HEYBIT — SUPABASE CHECK",
    "",
    reportLine("Service role read", serviceLabel),
    reportLine("Anon read", anonLabel),
    reportLine("Runtime row", row),
    reportLine("Launch state", launchState),
    "",
    "Read-only. No rows were written.",
    "",
    `VERDICT: ${ok ? "PASS" : "BLOCKED"}`,
    "",
  ].join("\n"),
);

process.exit(ok ? 0 : 1);

async function readRole(role: "service" | "anon"): Promise<RuntimeReadResult> {
  try {
    const client = role === "service" ? createServiceRoleClient() : createAnonClient();
    return await readCanonicalRuntime(client);
  } catch {
    return { status: "unavailable" };
  }
}
