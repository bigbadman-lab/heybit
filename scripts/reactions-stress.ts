import { runReactionStress } from "@heybit/shared/reaction-stress";

const report = await runReactionStress();
console.log("HEYBIT — REACTION STRESS");
console.log("");
console.log(`trade events: ${report.tradeEvents}`);
console.log(`aggregation windows: ${report.windows}`);
console.log(`openai attempts: ${report.openaiAttempts}`);
console.log(`successful reactions: ${report.successfulReactions}`);
console.log(`expired or superseded: ${report.expiredOrSuperseded}`);
console.log(`max openai concurrency: ${report.maxOpenaiConcurrency}`);
console.log(`priority first: ${report.priorityFirst ? "yes" : "no"}`);
console.log(`recovery attempts: ${report.recoveryAttempts}`);
console.log(`duplicate after restart: ${report.duplicateAfterRestart ? "yes" : "no"}`);
console.log("");
console.log(report.pass ? "VERDICT: PASS" : "VERDICT: BLOCKED");
process.exit(report.pass ? 0 : 1);
