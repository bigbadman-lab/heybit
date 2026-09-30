import "./lib/bootstrap.js";
import { checkLocalEnv, formatEnvReport } from "./lib/env-check.js";
import { loadManifest } from "./lib/manifest.js";

const report = checkLocalEnv(loadManifest(), process.env);
process.stdout.write(formatEnvReport(report));
process.exit(report.ok ? 0 : 1);
