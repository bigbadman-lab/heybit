import "./lib/bootstrap.js";
import { getBitRuntime, isCanonicalMint } from "@heybit/shared";
import {
  BIT_REHEARSAL_ID,
  decideRehearsalStart,
  formatRehearsalStatus,
  readRehearsal,
  rehearsalWindow,
} from "@heybit/shared/rehearsal";
import { createServiceRoleClient } from "./lib/supabase.js";

const SCHEMA_ERROR_CODES = new Set(["PGRST205", "42P01", "PGRST204"]);

const argv = process.argv.slice(2);
const durations = argv.filter((arg) => arg.startsWith("--duration="));
const positionals = argv.filter((arg) => !arg.startsWith("--"));
const duration = durations.length === 1 ? durations[0].slice("--duration=".length) : null;
const mint = positionals.length === 1 ? positionals[0] : "";

if (duration !== "10m") {
  console.error("Rehearsal duration must be 10m.");
  process.exit(1);
}
if (!isCanonicalMint(mint)) {
  console.error("Rehearsal mint is invalid.");
  process.exit(1);
}

const client = createServiceRoleClient();
let permanent;
try {
  permanent = await getBitRuntime(client);
} catch {
  console.error("Canonical runtime state is unavailable.");
  process.exit(1);
}

const stored = await readRehearsal(client);
if (stored.status === "missing") {
  console.error("Rehearsal storage is not ready.");
  process.exit(1);
}
if (stored.status === "unavailable") {
  console.error("Rehearsal storage is unavailable.");
  process.exit(1);
}

const existing = stored.status === "ready" ? stored.record : null;
const nowMs = Date.now();
const decision = decideRehearsalStart({
  mint,
  duration,
  permanent,
  existing,
  nowMs,
});
if (decision === "permanent-live") {
  console.error("Permanent launch is already live. Rehearsal refused.");
  process.exit(1);
}
if (decision === "already-active") {
  console.error("A rehearsal is already active.");
  process.exit(1);
}
if (decision !== "ok") {
  console.error("Rehearsal could not be started.");
  process.exit(1);
}

const window = rehearsalWindow(nowMs);
const written = await client.from("bit_rehearsal").upsert(
  {
    id: BIT_REHEARSAL_ID,
    mint,
    started_at: window.startedAt,
    expires_at: window.expiresAt,
    stopped_at: null,
  },
  { onConflict: "id" },
);
if (written.error) {
  console.error(
    written.error.code && SCHEMA_ERROR_CODES.has(written.error.code)
      ? "Rehearsal storage is not ready."
      : "Rehearsal storage is unavailable.",
  );
  process.exit(1);
}

console.log(
  formatRehearsalStatus({
    permanent,
    rehearsal: { mint, startedAt: window.startedAt, expiresAt: window.expiresAt, stoppedAt: null },
    nowMs,
  }),
);
