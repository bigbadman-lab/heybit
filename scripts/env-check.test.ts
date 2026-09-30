import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkLocalEnv, formatEnvReport } from "./lib/env-check.js";
import { getRepoRoot, loadManifest, parseManifest, PROHIBITED_ENV_NAMES } from "./lib/manifest.js";

const SECRET = "super-secret-value-should-not-print";

test("parses the committed environment manifest", () => {
  const manifest = loadManifest();
  assert.equal(manifest.version, 1);
  assert.equal(manifest.variables.length, 9);

  const local = manifest.variables.filter((variable) => variable.destinations.includes("local"));
  assert.deepEqual(
    local.map((variable) => variable.name),
    [
      "ALCHEMY_SOLANA_RPC_URL",
      "ALCHEMY_SOLANA_WSS_URL",
      "OPENAI_API_KEY",
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "BIT_DEPLOYER_KEYPAIR_PATH",
    ],
  );
  assert.ok(local.every((variable) => variable.required));
});

test("rejects prohibited launch-toggle names", () => {
  assert.throws(() => {
    parseManifest({
      version: 1,
      rule: "static config only",
      variables: [
        {
          name: "BIT_LIVE",
          destinations: ["local"],
          required: true,
          description: "not allowed",
        },
      ],
    });
  }, /Prohibited launch-toggle/);
});

test("reports presence without printing values", () => {
  const manifest = loadManifest();
  const env: NodeJS.ProcessEnv = {
    ALCHEMY_SOLANA_RPC_URL: SECRET,
    ALCHEMY_SOLANA_WSS_URL: "   ",
    OPENAI_API_KEY: "",
    SUPABASE_URL: "set",
    SUPABASE_ANON_KEY: "set",
    SUPABASE_SERVICE_ROLE_KEY: "set",
  };

  const report = checkLocalEnv(manifest, env);
  const text = formatEnvReport(report);

  assert.equal(report.ok, false);
  assert.match(text, /ALCHEMY_SOLANA_RPC_URL \.+ PRESENT/);
  assert.match(text, /ALCHEMY_SOLANA_WSS_URL \.+ MISSING/);
  assert.match(text, /BIT_DEPLOYER_KEYPAIR_PATH \.+ MISSING/);
  assert.match(text, /VERDICT: BLOCKED/);
  assert.equal(text.includes(SECRET), false);
  assert.equal(text.includes("set"), false);
});

test("passes only when every required local variable is present", () => {
  const manifest = loadManifest();
  const env: NodeJS.ProcessEnv = {};
  for (const variable of manifest.variables) {
    if (variable.destinations.includes("local")) {
      env[variable.name] = "present";
    }
  }

  const report = checkLocalEnv(manifest, env);
  assert.equal(report.ok, true);
  assert.match(formatEnvReport(report), /VERDICT: PASS/);
  assert.equal(formatEnvReport(report).includes("present"), false);
});

test("manifest and env example contain no prohibited launch toggles", () => {
  const manifestText = readFileSync(`${getRepoRoot()}/config/env-manifest.json`, "utf8");
  const exampleText = readFileSync(`${getRepoRoot()}/.env.example`, "utf8");

  for (const name of PROHIBITED_ENV_NAMES) {
    assert.equal(manifestText.includes(`"${name}"`), false);
    assert.equal(new RegExp(`^${name}=`, "m").test(exampleText), false);
  }
});
