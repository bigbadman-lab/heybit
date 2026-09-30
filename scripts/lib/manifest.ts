import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DESTINATIONS = ["local", "render", "vercel"] as const;

export type Destination = (typeof DESTINATIONS)[number];

export interface EnvVariable {
  name: string;
  destinations: Destination[];
  required: boolean;
  description: string;
}

export interface EnvManifest {
  version: number;
  rule: string;
  variables: EnvVariable[];
}

export const PROHIBITED_ENV_NAMES = [
  "BIT_LIVE",
  "TOKEN_LIVE",
  "MONITOR_ENABLED",
  "REACTIONS_ENABLED",
  "DEX_PAID",
  "BROADCAST_ENABLED",
  "LAUNCH_ENABLED",
] as const;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function getRepoRoot(): string {
  return repoRoot;
}

export function manifestPath(): string {
  return path.join(repoRoot, "config", "env-manifest.json");
}

export function loadManifest(filePath = manifestPath()): EnvManifest {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  return parseManifest(parsed);
}

export function parseManifest(value: unknown): EnvManifest {
  if (typeof value !== "object" || value === null) {
    throw new Error("Environment manifest must be an object.");
  }

  const record = value as Record<string, unknown>;
  if (record.version !== 1) {
    throw new Error("Environment manifest version must be 1.");
  }
  if (typeof record.rule !== "string" || record.rule.trim() === "") {
    throw new Error("Environment manifest rule must be a non-empty string.");
  }
  if (!Array.isArray(record.variables)) {
    throw new Error("Environment manifest variables must be an array.");
  }

  const names = new Set<string>();
  const variables = record.variables.map((entry) => parseVariable(entry, names));

  return {
    version: 1,
    rule: record.rule,
    variables,
  };
}

function parseVariable(value: unknown, names: Set<string>): EnvVariable {
  if (typeof value !== "object" || value === null) {
    throw new Error("Environment manifest variable must be an object.");
  }

  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(record.name)) {
    throw new Error("Environment manifest variable name is invalid.");
  }
  if (names.has(record.name)) {
    throw new Error(`Duplicate environment variable name: ${record.name}`);
  }
  if (PROHIBITED_ENV_NAMES.includes(record.name as (typeof PROHIBITED_ENV_NAMES)[number])) {
    throw new Error(`Prohibited launch-toggle environment variable: ${record.name}`);
  }
  if (!Array.isArray(record.destinations) || record.destinations.length === 0) {
    throw new Error(`Destinations missing for ${record.name}.`);
  }

  const destinations = record.destinations.map((destination) => {
    if (!DESTINATIONS.includes(destination as Destination)) {
      throw new Error(`Unknown destination for ${record.name}.`);
    }
    return destination as Destination;
  });

  if (new Set(destinations).size !== destinations.length) {
    throw new Error(`Duplicate destinations for ${record.name}.`);
  }
  if (typeof record.required !== "boolean") {
    throw new Error(`Required flag missing for ${record.name}.`);
  }
  if (typeof record.description !== "string" || record.description.trim() === "") {
    throw new Error(`Description missing for ${record.name}.`);
  }

  names.add(record.name);

  return {
    name: record.name,
    destinations,
    required: record.required,
    description: record.description,
  };
}
