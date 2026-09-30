import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { getRepoRoot } from "./manifest.js";

const LOCAL_ENV_FILENAME = ".env.local";

export interface LoadLocalEnvOptions {
  root?: string;
  env?: NodeJS.ProcessEnv;
}

export interface LoadLocalEnvResult {
  loaded: boolean;
}

/**
 * Load static credentials from the repository root `.env.local`.
 * Shell variables already set on `env` are left unchanged.
 * Missing files are ignored. Values are never logged.
 */
export function loadLocalEnv(options: LoadLocalEnvOptions = {}): LoadLocalEnvResult {
  const env = options.env ?? process.env;
  const filePath = path.join(options.root ?? getRepoRoot(), LOCAL_ENV_FILENAME);

  if (!existsSync(filePath)) {
    return { loaded: false };
  }

  const result = loadDotenv({
    path: filePath,
    override: false,
    processEnv: env,
    quiet: true,
  });

  if (result.error) {
    throw new Error("Failed to load .env.local.");
  }

  return { loaded: true };
}
