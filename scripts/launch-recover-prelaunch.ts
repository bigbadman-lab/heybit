import "./lib/bootstrap.js";
import { getBitRuntime } from "@heybit/shared";
import { isRehearsalEffective, readRehearsal } from "@heybit/shared/rehearsal";
import {
  parseRecoveryArgs,
  performRecovery,
  recoveryHelp,
  recoverySummary,
  serviceRoleConfigured,
  supabaseRuntimeWriter,
} from "./lib/launch-control.js";
import { createServiceRoleClient } from "./lib/supabase.js";

const parsed = parseRecoveryArgs(process.argv.slice(2));
if (parsed.kind === "help") {
  process.stdout.write(recoveryHelp());
  process.exit(0);
}
if (parsed.kind === "refuse") {
  process.stderr.write(`${parsed.message}\n`);
  process.exit(1);
}
if (!serviceRoleConfigured(process.env)) {
  process.stderr.write("Supabase service-role access is unavailable.\n");
  process.exit(1);
}

const client = createServiceRoleClient();
let permanent;
try {
  permanent = await getBitRuntime(client);
} catch {
  process.stderr.write("Canonical runtime state is unavailable.\n");
  process.exit(1);
}

const stored = await readRehearsal(client);
const rehearsal = stored.status === "ready" ? stored.record : null;
const rehearsalActive = stored.status === "unavailable" ? "UNKNOWN" : isRehearsalEffective(rehearsal, Date.now());
process.stdout.write(`${recoverySummary(permanent, rehearsalActive)}\n`);

const outcome = await performRecovery({
  permanent,
  writer: supabaseRuntimeWriter(client),
});
if (outcome.exitCode === 0) {
  process.stdout.write(outcome.message);
} else {
  process.stderr.write(`${outcome.message}\n`);
}
process.exit(outcome.exitCode);
