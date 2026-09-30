import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buyFixture, FIXTURE_MINT, OBSERVED_AT } from "@heybit/shared/fixtures";
import { parseTrade } from "@heybit/shared/trade";
import { backpressureSelfCheck, runMonitoringStress } from "@heybit/shared/stress";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkAlchemy, type AlchemyStatus } from "../../apps/worker/src/alchemy.js";
import { checkLocalEnv, type EnvCheckReport } from "./env-check.js";
import { reportLine, readCanonicalRuntime, type RuntimeReadResult } from "./launch-report.js";
import { getRepoRoot, loadManifest } from "./manifest.js";
import { createServiceRoleClient } from "./supabase.js";

export interface FoundationCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface PreflightReport {
  checks: FoundationCheck[];
  env: EnvCheckReport;
  runtime: RuntimeReadResult;
  alchemy: AlchemyStatus;
  parserOk: boolean;
  dedupeOk: boolean;
  concurrencyOk: boolean;
  backpressureOk: boolean;
  stressOk: boolean;
  foundationOk: boolean;
  phase31Ok: boolean;
}

const REQUIRED_PATHS = [
  "apps/web",
  "apps/worker",
  "packages/shared",
  "scripts",
  "docs",
  "config",
  "supabase",
  "reports",
  "config/env-manifest.json",
  ".env.example",
  "docs/PROJECT_SPEC.md",
  "docs/ARCHITECTURE.md",
  "docs/ENVIRONMENT.md",
  "docs/LAUNCH_MODEL.md",
  "docs/FINAL_PRELAUNCH_CHECKLIST.md",
  "supabase/migrations/20260930161700_create_bit_runtime.sql",
  "supabase/migrations/20260930163700_create_processed_transactions.sql",
  "package.json",
];

const REQUIRED_SCRIPTS = [
  "typecheck",
  "lint",
  "test",
  "build",
  "env:check",
  "launch:status",
  "launch:preflight",
  "launch:activate",
  "bit:burn",
  "bit:dex-paid",
  "supabase:check",
  "alchemy:check",
  "trade:inspect",
  "monitoring:stress",
  "monitoring:benchmark",
];

export async function runPreflight(env: NodeJS.ProcessEnv = process.env): Promise<PreflightReport> {
  const root = getRepoRoot();
  const missingPaths = REQUIRED_PATHS.filter((relativePath) => !existsSync(path.join(root, relativePath)));
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const missingScripts = REQUIRED_SCRIPTS.filter((name) => !packageJson.scripts?.[name]);
  const checks: FoundationCheck[] = [
    {
      name: "Repository structure",
      ok: missingPaths.length === 0,
      detail: missingPaths.length === 0 ? "present" : `missing ${missingPaths.join(", ")}`,
    },
    {
      name: "Project config",
      ok: existsSync(path.join(root, "config", "env-manifest.json")) && existsSync(path.join(root, ".env.example")),
      detail: "env manifest and .env.example",
    },
    {
      name: "Command surface",
      ok: missingScripts.length === 0,
      detail: missingScripts.length === 0 ? "present" : `missing ${missingScripts.join(", ")}`,
    },
  ];

  const manifest = loadManifest();
  const envReport = checkLocalEnv(manifest, env);
  const runtime = await readRuntime(env);
  const alchemy = await checkAlchemy(env);
  const parserOk = tradeParserOk();
  const dedupeOk = await durableDedupeOk(env);
  const stress = await runMonitoringStress();
  const backpressureOk = await backpressureSelfCheck();
  const concurrencyOk =
    stress.maxConcurrency > 0 && stress.maxConcurrency <= stress.configuredConcurrency && stress.drained;
  const stressOk = stress.pass;
  const foundationOk = checks.every((check) => check.ok);
  const phase31Ok =
    foundationOk &&
    envReport.ok &&
    runtime.status === "ok" &&
    alchemy.rpc === "PASS" &&
    alchemy.network === "MAINNET" &&
    alchemy.wss === "PASS" &&
    parserOk &&
    dedupeOk &&
    concurrencyOk &&
    backpressureOk &&
    stressOk;

  return {
    checks,
    env: envReport,
    runtime,
    alchemy,
    parserOk,
    dedupeOk,
    concurrencyOk,
    backpressureOk,
    stressOk,
    foundationOk,
    phase31Ok,
  };
}

export function formatPreflight(report: PreflightReport): string {
  const launchState = report.runtime.status === "ok" ? report.runtime.runtime.launchState : "UNAVAILABLE";
  return [
    "HEYBIT — PREFLIGHT",
    "",
    reportLine("Repository foundation", report.foundationOk ? "PASS" : "FAIL"),
    reportLine("Local env", report.env.ok ? "PASS" : "BLOCKED"),
    reportLine("Supabase", supabaseLabel(report.runtime)),
    reportLine("Runtime schema", schemaLabel(report.runtime)),
    reportLine("Runtime row", report.runtime.status === "ok" ? "PASS" : "FAIL"),
    reportLine("Alchemy RPC", report.alchemy.rpc),
    reportLine("Alchemy WSS", report.alchemy.wss),
    reportLine("Trade parser", report.parserOk ? "PASS" : "FAIL"),
    reportLine("Durable dedupe", report.dedupeOk ? "PASS" : "FAIL"),
    reportLine("Bounded concurrency", report.concurrencyOk ? "PASS" : "FAIL"),
    reportLine("Backpressure", report.backpressureOk ? "PASS" : "FAIL"),
    reportLine("Stress harness", report.stressOk ? "PASS" : "FAIL"),
    reportLine("Launch state", launchState),
    "",
    reportLine("OpenAI reactions", "NOT IMPLEMENTED"),
    reportLine("Final website", "NOT IMPLEMENTED"),
    reportLine("Production worker", "NOT DEPLOYED"),
    "",
    "Production readiness: NOT PRODUCTION READY",
    "This preflight does not approve a token launch.",
    "",
    `VERDICT: ${report.phase31Ok ? "PHASE 3.1 PASS" : "PHASE 3.1 BLOCKED"}`,
    "",
  ].join("\n");
}

function tradeParserOk(): boolean {
  const parsed = parseTrade(buyFixture(), FIXTURE_MINT, OBSERVED_AT);
  return parsed.kind === "trade" && parsed.event.type === "BUY" && parsed.event.solAmount === 0.5;
}

async function readRuntime(env: NodeJS.ProcessEnv): Promise<RuntimeReadResult> {
  if (!present(env.SUPABASE_URL) || !present(env.SUPABASE_SERVICE_ROLE_KEY)) {
    return { status: "unavailable" };
  }
  try {
    return await readCanonicalRuntime(createServiceRoleClient(env));
  } catch {
    return { status: "unavailable" };
  }
}

async function durableDedupeOk(env: NodeJS.ProcessEnv): Promise<boolean> {
  if (!present(env.SUPABASE_URL) || !present(env.SUPABASE_SERVICE_ROLE_KEY)) {
    return false;
  }
  try {
    const client: SupabaseClient = createServiceRoleClient(env);
    const { error } = await client.from("processed_transactions").select("signature").limit(1);
    return !error;
  } catch {
    return false;
  }
}

function present(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function supabaseLabel(result: RuntimeReadResult): "PASS" | "FAIL" {
  return result.status === "unavailable" ? "FAIL" : "PASS";
}

function schemaLabel(result: RuntimeReadResult): "PASS" | "FAIL" {
  return result.status === "ok" || result.status === "missing-row" || result.status === "malformed" ? "PASS" : "FAIL";
}
