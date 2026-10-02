import "./lib/bootstrap.js";
import { decideStalePending, STALE_PENDING_MIN_AGE_MS } from "./lib/stale-reactions.js";
import { createServiceRoleClient } from "./lib/supabase.js";

const confirm = process.argv.includes("--confirm");
const olderThan = process.argv.find((arg) => arg.startsWith("--older-than="));
const nowMs = Date.now();
const cutoffMs = olderThan ? Date.parse(olderThan.slice("--older-than=".length)) : nowMs - STALE_PENDING_MIN_AGE_MS;
const decision = decideStalePending({ nowMs, cutoffMs, rows: [], confirm });

if (decision.refusal) {
  console.error(decision.refusal);
  process.exit(1);
}

const cutoff = new Date(cutoffMs).toISOString();
const client = createServiceRoleClient();
const counted = await client
  .from("bit_reactions")
  .select("id", { count: "exact", head: true })
  .eq("status", "PENDING")
  .lt("created_at", cutoff);

if (counted.error) {
  console.error(counted.error.code ?? "unavailable");
  process.exit(1);
}

const eligible = counted.count ?? 0;
console.log("HEYBIT — STALE PENDING REACTIONS");
console.log("");
console.log(`cutoff .............. ${cutoff}`);
console.log(`eligible PENDING .... ${eligible}`);
console.log("protected window .... 1h");

if (!confirm) {
  console.log("mode ................ dry-run");
  console.log("rows updated ........ 0");
  process.exit(0);
}

const written = await client
  .from("bit_reactions")
  .update({ status: "EXPIRED" })
  .eq("status", "PENDING")
  .lt("created_at", cutoff);

if (written.error) {
  console.error(written.error.code ?? "unavailable");
  process.exit(1);
}

console.log("mode ................ confirm");
console.log(`rows updated ........ ${eligible}`);
