import type { EnvManifest } from "./manifest.js";

export type Presence = "PRESENT" | "MISSING";

export interface EnvCheckRow {
  name: string;
  required: boolean;
  presence: Presence;
}

export interface EnvCheckReport {
  rows: EnvCheckRow[];
  ok: boolean;
}

const STATUS_COLUMN = 30;

export function checkLocalEnv(
  manifest: EnvManifest,
  env: NodeJS.ProcessEnv,
): EnvCheckReport {
  const rows = manifest.variables
    .filter((variable) => variable.destinations.includes("local"))
    .map((variable) => {
      const raw = env[variable.name];
      const presence: Presence =
        typeof raw === "string" && raw.trim() !== "" ? "PRESENT" : "MISSING";
      return {
        name: variable.name,
        required: variable.required,
        presence,
      };
    });

  const ok = rows.every((row) => !row.required || row.presence === "PRESENT");
  return { rows, ok };
}

export function formatEnvReport(report: EnvCheckReport): string {
  const lines = [
    "HEYBIT — LOCAL ENV CHECK",
    "",
    "Required: every local variable below.",
    "",
    ...report.rows.map((row) => formatRow(row)),
    "",
    `VERDICT: ${report.ok ? "PASS" : "BLOCKED"}`,
    "",
  ];
  return lines.join("\n");
}

function formatRow(row: EnvCheckRow): string {
  const dots = ".".repeat(Math.max(1, STATUS_COLUMN - row.name.length - 2));
  return `${row.name} ${dots} ${row.presence}`;
}
