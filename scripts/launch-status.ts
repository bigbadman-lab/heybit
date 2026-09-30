import "./lib/bootstrap.js";
import { checkAlchemy } from "../apps/worker/src/alchemy.js";
import { checkOpenAi } from "../apps/worker/src/openai-reactions.js";
import { formatLaunchStatus, readCanonicalRuntime } from "./lib/launch-report.js";
import { createServiceRoleClient } from "./lib/supabase.js";

let runtime;
try {
  runtime = await readCanonicalRuntime(createServiceRoleClient());
} catch {
  runtime = { status: "unavailable" as const };
}

const alchemy = await checkAlchemy(process.env);
const openai = await checkOpenAi(process.env);
const live = runtime.status === "ok" && runtime.runtime.launchState === "LIVE" && runtime.runtime.canonicalMint !== null;
process.stdout.write(
  formatLaunchStatus(runtime, alchemy, {
    openai: openai.verdict,
    reactionPipeline: "READY",
    reactionScheduler: live ? "ACTIVE" : "IDLE",
  }),
);
const ready = runtime.status === "ok" && alchemy.rpc === "PASS" && alchemy.wss === "PASS" && openai.verdict === "PASS";
process.exit(ready ? 0 : 1);
