import { runMonitoringStress } from "@heybit/shared/stress";

const report = await runMonitoringStress();
console.log("HEYBIT — MONITORING STRESS");
console.log("");
console.log(`submitted: ${report.submitted}`);
console.log(`unique signatures stored: ${report.uniqueSignatures}`);
console.log(`duplicate submissions: ${report.duplicateSubmissions}`);
console.log(`peak queue depth: ${report.peakQueueDepth}`);
console.log(`max concurrency: ${report.maxConcurrency}`);
console.log(`configured concurrency: ${report.configuredConcurrency}`);
console.log(`retries: ${report.retries}`);
console.log(`permanent failures: ${report.permanentFailures}`);
console.log(`drained: ${report.drained ? "yes" : "no"}`);
console.log(`recent cache size: ${report.recentCacheSize}`);
console.log("");
console.log(report.pass ? "VERDICT: PASS" : "VERDICT: BLOCKED");
process.exit(report.pass ? 0 : 1);
