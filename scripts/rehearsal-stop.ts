import "./lib/bootstrap.js";
import { getBitRuntime } from "@heybit/shared";
import { BIT_REHEARSAL_ID, formatRehearsalStatus, isRehearsalEffective, readRehearsal } from "@heybit/shared/rehearsal";
import { createServiceRoleClient } from "./lib/supabase.js";

const SCHEMA_ERROR_CODES = new Set(["PGRST205", "42P01", "PGRST204"]);

if (process.argv.slice(2).length > 0) {
  console.error("rehearsal:stop takes no arguments.");
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
if (stored.status === "none") {
  console.log("No rehearsal record.");
  process.exit(0);
}

const nowMs = Date.now();
if (!isRehearsalEffective(stored.record, nowMs)) {
  console.log(
    formatRehearsalStatus({
      permanent,
      rehearsal: stored.record,
      nowMs,
    }),
  );
  process.exit(0);
}

const stoppedAt = new Date(nowMs).toISOString();
const written = await client
  .from("bit_rehearsal")
  .update({ stopped_at: stoppedAt })
  .eq("id", BIT_REHEARSAL_ID)
  .is("stopped_at", null);
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
    rehearsal: { ...stored.record, stoppedAt },
    nowMs,
  }),
);
