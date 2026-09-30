import { runMonitoringStress } from "@heybit/shared/stress";

const started = Date.now();
const report = await runMonitoringStress();
const elapsedMs = Date.now() - started;
console.log("HEYBIT — MONITORING BENCHMARK");
console.log("");
console.log("diagnostic only; this is not a throughput gate");
console.log(`elapsed ms: ${elapsedMs}`);
console.log(`submitted: ${report.submitted}`);
console.log(`peak queue depth: ${report.peakQueueDepth}`);
console.log(`max concurrency: ${report.maxConcurrency}`);
console.log(`heap start: ${report.heapStart}`);
console.log(`heap end: ${report.heapEnd}`);
console.log("");
console.log(report.pass ? "VERDICT: PASS" : "VERDICT: BLOCKED");
process.exit(report.pass ? 0 : 1);
