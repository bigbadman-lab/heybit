import "./lib/bootstrap.js";
import { formatPreflight, runPreflight } from "./lib/preflight.js";

const report = await runPreflight();
process.stdout.write(formatPreflight(report));
process.exit(report.phase4Ok ? 0 : 1);
