import { BIT_RUNTIME_ID, getBitRuntime, isCanonicalMint, type BitRuntime } from "@heybit/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTIVATION_CONTROL = "IMPLEMENTED";
export const RECOVERY_CONTROL = "IMPLEMENTED";

export const CONFIRM_PRODUCTION = "--confirm-production";

export const ALREADY_LIVE_MESSAGE = "ALREADY LIVE — NO WRITE";
export const DIFFERENT_MINT_MESSAGE = "BLOCKED — DIFFERENT PERMANENT MINT ALREADY LIVE";
export const ACTIVATION_READBACK_WARNING =
  "Read-back did not match LIVE. No verified activation. If this row is incorrect, the operator recovery command is npm run launch:recover-prelaunch -- --confirm-production.";
export const RECOVERY_READBACK_WARNING =
  "Read-back did not match PRELAUNCH with no canonical mint. Permanent state was not verified.";

export interface RuntimePatch {
  launch_state: "LIVE" | "PRELAUNCH";
  canonical_mint: string | null;
}

export interface RuntimeWrite {
  patch: RuntimePatch;
  expectPrelaunchEmpty: boolean;
}

/** Writes and reads only the singleton bit_runtime row. */
export interface RuntimeWriter {
  updateRuntime(write: RuntimeWrite): Promise<boolean>;
  readRuntime(): Promise<BitRuntime | null>;
}

export interface ControlOutcome {
  exitCode: number;
  message: string;
  wrote: boolean;
}

type ArgParse = { kind: "help" } | { kind: "refuse"; message: string } | { kind: "ready"; mint: string };
type RecoveryParse = { kind: "help" } | { kind: "refuse"; message: string } | { kind: "ready" };

export function serviceRoleConfigured(env: NodeJS.ProcessEnv): boolean {
  return present(env.SUPABASE_URL) && present(env.SUPABASE_SERVICE_ROLE_KEY);
}

export function parseActivationArgs(argv: string[]): ArgParse {
  if (argv.includes("--help")) {
    return { kind: "help" };
  }
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const positionals = argv.filter((arg) => !arg.startsWith("--"));
  if (flags.some((flag) => flag !== CONFIRM_PRODUCTION)) {
    return { kind: "refuse", message: "Unrecognized argument." };
  }
  if (!flags.includes(CONFIRM_PRODUCTION)) {
    return { kind: "refuse", message: "Activation requires --confirm-production." };
  }
  if (positionals.length === 0) {
    return { kind: "refuse", message: "Mint argument is required." };
  }
  if (positionals.length !== 1 || !isCanonicalMint(positionals[0])) {
    return { kind: "refuse", message: "Mint format is invalid." };
  }
  return { kind: "ready", mint: positionals[0] };
}

export function parseRecoveryArgs(argv: string[]): RecoveryParse {
  if (argv.includes("--help")) {
    return { kind: "help" };
  }
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const positionals = argv.filter((arg) => !arg.startsWith("--"));
  if (positionals.length > 0) {
    return { kind: "refuse", message: "Recovery cannot set a mint." };
  }
  if (flags.some((flag) => flag !== CONFIRM_PRODUCTION)) {
    return { kind: "refuse", message: "Unrecognized argument." };
  }
  if (!flags.includes(CONFIRM_PRODUCTION)) {
    return { kind: "refuse", message: "Recovery requires --confirm-production." };
  }
  return { kind: "ready" };
}

export function decideActivation(input: {
  mint: string;
  permanent: BitRuntime;
  rehearsalActive: boolean;
}): { action: "activate" } | { action: "refuse"; message: string } {
  if (input.rehearsalActive) {
    return { action: "refuse", message: "Activation refused while a rehearsal is active." };
  }
  if (input.permanent.launchState === "LIVE") {
    if (input.permanent.canonicalMint === input.mint) {
      return { action: "refuse", message: ALREADY_LIVE_MESSAGE };
    }
    return { action: "refuse", message: DIFFERENT_MINT_MESSAGE };
  }
  if (input.permanent.canonicalMint !== null) {
    return {
      action: "refuse",
      message: "PRELAUNCH row already has a canonical mint. Recovery or audit is required.",
    };
  }
  return { action: "activate" };
}

export function decideRecovery(permanent: BitRuntime): { action: "recover" } | { action: "refuse"; message: string } {
  if (permanent.launchState === "PRELAUNCH" && permanent.canonicalMint === null) {
    return { action: "refuse", message: "Already PRELAUNCH with no mint. No write." };
  }
  return { action: "recover" };
}

export function activationHelp(): string {
  return [
    "HEYBIT — LAUNCH ACTIVATE",
    "",
    "Operator command. Writes the singleton bit_runtime row only.",
    "",
    "npm run launch:activate -- <OFFICIAL_MINT> --confirm-production",
    "",
    "Requires --confirm-production.",
    "Refuses a missing mint, an invalid mint, an active rehearsal, an already-live row,",
    "and a PRELAUNCH row that already has a canonical mint.",
    "Does not broadcast a Solana transaction.",
    "Does not change rehearsal state.",
    "Does not read a launch boolean from the environment.",
    "",
  ].join("\n");
}

export function recoveryHelp(): string {
  return [
    "HEYBIT — LAUNCH RECOVER PRELAUNCH",
    "",
    "Emergency operator-only command.",
    "Returns the singleton bit_runtime row to PRELAUNCH with no canonical mint.",
    "",
    "npm run launch:recover-prelaunch -- --confirm-production",
    "",
    "Requires --confirm-production.",
    "Does not accept a mint.",
    "Does not run from the worker, the website, an environment flag, or a schedule.",
    "Does not broadcast a Solana transaction.",
    "Does not modify a rehearsal row.",
    "",
  ].join("\n");
}

export function recoverySummary(permanent: BitRuntime, rehearsalActive: boolean | "UNKNOWN"): string {
  const mint = permanent.canonicalMint ?? "none";
  const rehearsal = rehearsalActive === "UNKNOWN" ? "UNKNOWN" : rehearsalActive ? "YES" : "NO";
  return [
    "HEYBIT — LAUNCH RECOVER PRELAUNCH",
    "",
    `launch state ........ ${permanent.launchState}`,
    `canonical mint ...... ${mint}`,
    `rehearsal active .... ${rehearsal}`,
    "",
  ].join("\n");
}

export async function performActivation(input: {
  mint: string;
  permanent: BitRuntime;
  rehearsalActive: boolean;
  writer: RuntimeWriter;
}): Promise<ControlOutcome> {
  const decision = decideActivation(input);
  if (decision.action === "refuse") {
    return { exitCode: 1, message: decision.message, wrote: false };
  }
  const row = await commitActivation(input.writer, input.mint);
  if (!row) {
    return { exitCode: 1, message: ACTIVATION_READBACK_WARNING, wrote: true };
  }
  return { exitCode: 0, message: activationVerified(row), wrote: true };
}

export async function performRecovery(input: {
  permanent: BitRuntime;
  writer: RuntimeWriter;
}): Promise<ControlOutcome> {
  const decision = decideRecovery(input.permanent);
  if (decision.action === "refuse") {
    return { exitCode: 1, message: decision.message, wrote: false };
  }
  const row = await commitRecovery(input.writer);
  if (!row) {
    return { exitCode: 1, message: RECOVERY_READBACK_WARNING, wrote: true };
  }
  return { exitCode: 0, message: recoveryVerified(row), wrote: true };
}

export function supabaseRuntimeWriter(client: SupabaseClient): RuntimeWriter {
  return {
    async updateRuntime(write) {
      try {
        const result = write.expectPrelaunchEmpty
          ? await client
              .from("bit_runtime")
              .update(write.patch)
              .eq("id", BIT_RUNTIME_ID)
              .eq("launch_state", "PRELAUNCH")
              .is("canonical_mint", null)
          : await client.from("bit_runtime").update(write.patch).eq("id", BIT_RUNTIME_ID);
        return !result.error;
      } catch {
        return false;
      }
    },
    async readRuntime() {
      try {
        return await getBitRuntime(client);
      } catch {
        return null;
      }
    },
  };
}

async function commitActivation(writer: RuntimeWriter, mint: string): Promise<BitRuntime | null> {
  await writer.updateRuntime({
    patch: { launch_state: "LIVE", canonical_mint: mint },
    expectPrelaunchEmpty: true,
  });
  const row = await writer.readRuntime();
  if (!row || row.launchState !== "LIVE" || row.canonicalMint !== mint) {
    return null;
  }
  return row;
}

async function commitRecovery(writer: RuntimeWriter): Promise<BitRuntime | null> {
  await writer.updateRuntime({
    patch: { launch_state: "PRELAUNCH", canonical_mint: null },
    expectPrelaunchEmpty: false,
  });
  const row = await writer.readRuntime();
  if (!row || row.launchState !== "PRELAUNCH" || row.canonicalMint !== null) {
    return null;
  }
  return row;
}

function activationVerified(row: BitRuntime): string {
  return [
    "HEYBIT — LAUNCH ACTIVATE",
    "",
    `launch state ........ ${row.launchState}`,
    `canonical mint ...... ${row.canonicalMint}`,
    "",
    "Read-back matched.",
    "No Solana transaction was broadcast.",
    "",
  ].join("\n");
}

function recoveryVerified(row: BitRuntime): string {
  return [
    "HEYBIT — LAUNCH RECOVER PRELAUNCH",
    "",
    `launch state ........ ${row.launchState}`,
    `canonical mint ...... ${row.canonicalMint ?? "none"}`,
    "",
    "Read-back matched.",
    "No Solana transaction was broadcast.",
    "",
  ].join("\n");
}

function present(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}
