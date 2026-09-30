import "./lib/bootstrap.js";
import { checkAlchemy } from "../apps/worker/src/alchemy.js";
import { formatLaunchStatus, readCanonicalRuntime } from "./lib/launch-report.js";
import { createServiceRoleClient } from "./lib/supabase.js";

let runtime;
try {
  runtime = await readCanonicalRuntime(createServiceRoleClient());
} catch {
  runtime = { status: "unavailable" as const };
}

const alchemy = await checkAlchemy(process.env);
process.stdout.write(formatLaunchStatus(runtime, alchemy));
const ready = runtime.status === "ok" && alchemy.rpc === "PASS" && alchemy.wss === "PASS";
process.exit(ready ? 0 : 1);
