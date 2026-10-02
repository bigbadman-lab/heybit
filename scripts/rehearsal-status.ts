import "./lib/bootstrap.js";
import { getBitRuntime } from "@heybit/shared";
import { formatRehearsalStatus, readRehearsal } from "@heybit/shared/rehearsal";
import { createServiceRoleClient } from "./lib/supabase.js";

if (process.argv.slice(2).length > 0) {
  console.error("rehearsal:status takes no arguments.");
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
  console.log(
    formatRehearsalStatus({
      permanent,
      rehearsal: null,
      nowMs: Date.now(),
    }),
  );
  console.error("Rehearsal storage is not ready.");
  process.exit(1);
}
if (stored.status === "unavailable") {
  console.error("Rehearsal storage is unavailable.");
  process.exit(1);
}

console.log(
  formatRehearsalStatus({
    permanent,
    rehearsal: stored.status === "ready" ? stored.record : null,
    nowMs: Date.now(),
  }),
);
