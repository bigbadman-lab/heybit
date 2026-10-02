import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isCanonicalMint, type BitRuntime } from "@heybit/shared";
import { reactionSchedulerMode } from "@heybit/shared/reaction";
import {
  decideRehearsalStart,
  isRehearsalEffective,
  publicPresence,
  REHEARSAL_DURATION_MS,
  resolveEffective,
  type RehearsalRecord,
} from "@heybit/shared/rehearsal";
import { decideMonitoring } from "@heybit/shared/trade";
import { spokenLine } from "../apps/web/components/bit/bit-commentary.js";
import { visiblePublicSpeech } from "../apps/web/lib/visible-speech.js";
import { listenerForRuntime } from "../apps/worker/src/health.js";
import { projectWorkerRuntime } from "../apps/worker/src/runtime.js";
import { PROHIBITED_ENV_NAMES } from "./lib/manifest.js";
import {
  ACTIVATION_CONTROL,
  ACTIVATION_READBACK_WARNING,
  ALREADY_LIVE_MESSAGE,
  DIFFERENT_MINT_MESSAGE,
  RECOVERY_CONTROL,
  RECOVERY_READBACK_WARNING,
  activationHelp,
  decideActivation,
  decideRecovery,
  parseActivationArgs,
  parseRecoveryArgs,
  performActivation,
  performRecovery,
  recoveryHelp,
  type RuntimeWrite,
  type RuntimeWriter,
} from "./lib/launch-control.js";

const MINT = "1".repeat(32);
const OTHER_MINT = "2".repeat(32);
const STARTED_AT = Date.parse("2026-10-02T15:21:33.399Z");

function runtime(launchState: "PRELAUNCH" | "LIVE", canonicalMint: string | null): BitRuntime {
  return {
    canonicalMint,
    launchState,
    activationTimestamp: "2026-09-30T00:00:00.000Z",
    launchSignature: "preserved-signature",
    launchSlot: 42,
  };
}

function activeRehearsal(): RehearsalRecord {
  return {
    mint: OTHER_MINT,
    startedAt: new Date(STARTED_AT).toISOString(),
    expiresAt: new Date(STARTED_AT + REHEARSAL_DURATION_MS).toISOString(),
    stoppedAt: null,
  };
}

function memoryWriter(initial: BitRuntime, readBack?: () => BitRuntime | null) {
  let row: BitRuntime = { ...initial };
  const writes: RuntimeWrite[] = [];
  const writer: RuntimeWriter = {
    async updateRuntime(write) {
      writes.push(write);
      if (write.expectPrelaunchEmpty && (row.launchState !== "PRELAUNCH" || row.canonicalMint !== null)) {
        return false;
      }
      row = { ...row, launchState: write.patch.launch_state, canonicalMint: write.patch.canonical_mint };
      return true;
    },
    async readRuntime() {
      return readBack ? readBack() : { ...row };
    },
  };
  return { writes, writer, current: () => row };
}

function refused(parse: { kind: string; message?: string }, message: string): void {
  assert.equal(parse.kind, "refuse");
  assert.equal(parse.message, message);
}

test("activation rejects a missing mint, an invalid mint, and a missing confirmation", () => {
  refused(parseActivationArgs(["--confirm-production"]), "Mint argument is required.");
  refused(parseActivationArgs(["--confirm-production", "not-a-mint"]), "Mint format is invalid.");
  refused(parseActivationArgs(["--confirm-production", "0".repeat(32)]), "Mint format is invalid.");
  refused(parseActivationArgs([MINT]), "Activation requires --confirm-production.");
  refused(parseActivationArgs([]), "Activation requires --confirm-production.");
  assert.equal(isCanonicalMint("ExampleMint111111111111111111111111111111"), false);
});

test("activation help never mutates", () => {
  assert.equal(parseActivationArgs(["--help", MINT, "--confirm-production"]).kind, "help");
  assert.match(activationHelp(), /npm run launch:activate -- <OFFICIAL_MINT> --confirm-production/);
  assert.match(activationHelp(), /Does not broadcast a Solana transaction/);
  const help = spawnSync("tsx", ["scripts/launch-activate.ts", "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Does not broadcast a Solana transaction/);
  assert.equal(help.stdout.includes("Read-back matched"), false);
});

test("an active rehearsal blocks activation before any write", async () => {
  const store = memoryWriter(runtime("PRELAUNCH", null));
  const outcome = await performActivation({
    mint: MINT,
    permanent: runtime("PRELAUNCH", null),
    rehearsalActive: true,
    writer: store.writer,
  });
  assert.equal(outcome.exitCode, 1);
  assert.match(outcome.message, /rehearsal is active/);
  assert.equal(outcome.wrote, false);
  assert.equal(store.writes.length, 0);
});

test("PRELAUNCH with no mint activates in a mocked row and preserves other columns", async () => {
  const store = memoryWriter(runtime("PRELAUNCH", null));
  const outcome = await performActivation({
    mint: MINT,
    permanent: runtime("PRELAUNCH", null),
    rehearsalActive: false,
    writer: store.writer,
  });
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.wrote, true);
  assert.match(outcome.message, /launch state \.+ LIVE/);
  assert.match(outcome.message, new RegExp(`canonical mint \\.+ ${MINT}`));
  assert.match(outcome.message, /Read-back matched/);
  assert.equal(store.writes.length, 1);
  assert.deepEqual(store.writes[0]?.patch, { launch_state: "LIVE", canonical_mint: MINT });
  assert.equal(store.writes[0]?.expectPrelaunchEmpty, true);
  assert.deepEqual(Object.keys(store.writes[0]?.patch ?? {}).sort(), ["canonical_mint", "launch_state"]);
  assert.equal(store.current().activationTimestamp, "2026-09-30T00:00:00.000Z");
  assert.equal(store.current().launchSignature, "preserved-signature");
  assert.equal(store.current().launchSlot, 42);
});

test("activation read-back must match or the command fails", async () => {
  const store = memoryWriter(runtime("PRELAUNCH", null), () => runtime("PRELAUNCH", null));
  const outcome = await performActivation({
    mint: MINT,
    permanent: runtime("PRELAUNCH", null),
    rehearsalActive: false,
    writer: store.writer,
  });
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.wrote, true);
  assert.equal(outcome.message, ACTIVATION_READBACK_WARNING);
  assert.match(outcome.message, /launch:recover-prelaunch/);
});

test("LIVE with the same mint refuses without a write", async () => {
  const store = memoryWriter(runtime("LIVE", MINT));
  const outcome = await performActivation({
    mint: MINT,
    permanent: runtime("LIVE", MINT),
    rehearsalActive: false,
    writer: store.writer,
  });
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.message, ALREADY_LIVE_MESSAGE);
  assert.equal(store.writes.length, 0);
});

test("LIVE with a different mint refuses without a write", async () => {
  const decision = decideActivation({
    mint: OTHER_MINT,
    permanent: runtime("LIVE", MINT),
    rehearsalActive: false,
  });
  assert.equal(decision.action, "refuse");
  assert.equal(decision.action === "refuse" && decision.message, DIFFERENT_MINT_MESSAGE);
  const store = memoryWriter(runtime("LIVE", MINT));
  const outcome = await performActivation({
    mint: OTHER_MINT,
    permanent: runtime("LIVE", MINT),
    rehearsalActive: false,
    writer: store.writer,
  });
  assert.equal(store.writes.length, 0);
  assert.equal(outcome.wrote, false);
});

test("PRELAUNCH with an unexpected mint refuses without a write", async () => {
  const store = memoryWriter(runtime("PRELAUNCH", MINT));
  const outcome = await performActivation({
    mint: OTHER_MINT,
    permanent: runtime("PRELAUNCH", MINT),
    rehearsalActive: false,
    writer: store.writer,
  });
  assert.match(outcome.message, /Recovery or audit is required/);
  assert.equal(store.writes.length, 0);
});

test("recovery requires confirmation and cannot set a mint", () => {
  refused(parseRecoveryArgs([]), "Recovery requires --confirm-production.");
  refused(parseRecoveryArgs([MINT, "--confirm-production"]), "Recovery cannot set a mint.");
  assert.equal(parseRecoveryArgs(["--help", "--confirm-production", MINT]).kind, "help");
  assert.match(recoveryHelp(), /Emergency operator-only command/);
  assert.match(recoveryHelp(), /Does not accept a mint/);
  const help = spawnSync("tsx", ["scripts/launch-recover-prelaunch.ts", "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Emergency operator-only/);
  assert.equal(help.stdout.includes("Read-back matched"), false);
  const blocked = spawnSync("tsx", ["scripts/launch-recover-prelaunch.ts", "--confirm-production", "not-a-mint"], {
    encoding: "utf8",
  });
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /Recovery cannot set a mint/);
  assert.equal(blocked.stdout.includes("Read-back matched"), false);
});

test("recovery refuses an already-clean PRELAUNCH row", async () => {
  const store = memoryWriter(runtime("PRELAUNCH", null));
  const outcome = await performRecovery({ permanent: runtime("PRELAUNCH", null), writer: store.writer });
  assert.match(outcome.message, /Already PRELAUNCH with no mint/);
  assert.equal(outcome.wrote, false);
  assert.equal(store.writes.length, 0);
  assert.equal(decideRecovery(runtime("PRELAUNCH", null)).action, "refuse");
});

test("recovery clears an unexpected PRELAUNCH mint without setting a new one", async () => {
  const store = memoryWriter(runtime("PRELAUNCH", MINT));
  const outcome = await performRecovery({ permanent: runtime("PRELAUNCH", MINT), writer: store.writer });
  assert.equal(outcome.exitCode, 0);
  assert.deepEqual(store.writes[0]?.patch, { launch_state: "PRELAUNCH", canonical_mint: null });
  assert.equal(store.current().canonicalMint, null);
});

test("recovery clears a mocked LIVE row and does not write a rehearsal", async () => {
  const store = memoryWriter(runtime("LIVE", MINT));
  const outcome = await performRecovery({ permanent: runtime("LIVE", MINT), writer: store.writer });
  assert.equal(outcome.exitCode, 0);
  assert.deepEqual(store.writes[0]?.patch, { launch_state: "PRELAUNCH", canonical_mint: null });
  assert.equal(store.writes[0]?.expectPrelaunchEmpty, false);
  assert.equal(store.current().canonicalMint, null);
  assert.equal(store.current().launchState, "PRELAUNCH");
  assert.equal(store.current().launchSignature, "preserved-signature");
  assert.match(outcome.message, /Read-back matched/);
  const source = readFileSync(new URL("./launch-recover-prelaunch.ts", import.meta.url), "utf8");
  const library = readFileSync(new URL("./lib/launch-control.ts", import.meta.url), "utf8");
  assert.equal(source.includes("bit_rehearsal"), false);
  assert.equal(library.includes("bit_rehearsal"), false);
  assert.equal(library.includes("bit_reactions"), false);
  assert.match(library, /from\("bit_runtime"\)/);
});

test("recovery read-back failure exits non-zero", async () => {
  const store = memoryWriter(runtime("LIVE", MINT), () => runtime("LIVE", MINT));
  const outcome = await performRecovery({ permanent: runtime("LIVE", MINT), writer: store.writer });
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.message, RECOVERY_READBACK_WARNING);
});

test("permanent LIVE stays ahead of an active rehearsal", () => {
  const permanent = runtime("LIVE", MINT);
  const rehearsal = activeRehearsal();
  assert.equal(isRehearsalEffective(rehearsal, STARTED_AT + 1_000), true);
  const view = resolveEffective(permanent, rehearsal, STARTED_AT + 1_000);
  assert.equal(view.mode, "LIVE");
  assert.equal(view.mint, MINT);
  assert.equal(
    decideRehearsalStart({
      mint: OTHER_MINT,
      duration: "10m",
      permanent,
      existing: null,
      nowMs: STARTED_AT,
    }),
    "permanent-live",
  );
  const projected = projectWorkerRuntime(permanent, rehearsal, STARTED_AT + 1_000);
  assert.equal(projected.label, undefined);
  assert.equal(projected.runtime.canonicalMint, MINT);
});

test("mocked activation propagates to the worker and the website", () => {
  const projected = projectWorkerRuntime(runtime("LIVE", MINT), activeRehearsal(), STARTED_AT + 1_000);
  const gate = listenerForRuntime({ status: "ok", runtime: projected.runtime });
  assert.equal(projected.runtime.canonicalMint, MINT);
  assert.equal(decideMonitoring(projected.runtime).action, "listen");
  assert.equal(gate.listener, "ACTIVE");
  assert.equal(reactionSchedulerMode(projected.runtime.launchState, projected.runtime.canonicalMint), "ACTIVE");
  const presence = publicPresence(projected.runtime, activeRehearsal(), STARTED_AT + 1_000);
  assert.equal(presence.launchState, "LIVE");
  assert.equal(presence.mint, MINT);
  assert.equal(visiblePublicSpeech(presence, "One buy of 0.1 SOL."), "One buy of 0.1 SOL.");
  assert.equal(spokenLine({ launchState: "LIVE", reactionText: "One buy of 0.1 SOL.", state: "IDLE", seed: "idle:0" }).source, "reaction");
});

test("mocked recovery propagates to an idle worker and suppressed speech", () => {
  const recovered = runtime("PRELAUNCH", null);
  const projected = projectWorkerRuntime(recovered, null, STARTED_AT);
  const gate = listenerForRuntime({ status: "ok", runtime: projected.runtime });
  assert.equal(decideMonitoring(projected.runtime).action, "idle");
  assert.equal(gate.listener, "IDLE");
  assert.equal(reactionSchedulerMode(recovered.launchState, recovered.canonicalMint), "IDLE");
  const presence = publicPresence(recovered, null, STARTED_AT);
  assert.equal(presence.launchState, "PRELAUNCH");
  assert.equal(presence.mint, null);
  assert.equal(visiblePublicSpeech(presence, "One buy of 0.1 SOL."), null);
  assert.equal(spokenLine({ launchState: "PRELAUNCH", reactionText: "One buy of 0.1 SOL.", state: "IDLE", seed: "idle:0" }).source, "pool");
});

test("activation and recovery have no broadcast path and no launch boolean", () => {
  const files = [
    readFileSync(new URL("./launch-activate.ts", import.meta.url), "utf8"),
    readFileSync(new URL("./launch-recover-prelaunch.ts", import.meta.url), "utf8"),
    readFileSync(new URL("./lib/launch-control.ts", import.meta.url), "utf8"),
  ];
  const worker = readFileSync(new URL("../apps/worker/src/monitor.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../apps/web/app/api/bit-visual/route.ts", import.meta.url), "utf8");
  const packageJson = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  for (const source of files) {
    assert.equal(source.includes("sendTransaction"), false);
    assert.equal(source.includes("requestAirdrop"), false);
    assert.equal(source.includes("clusterApiUrl"), false);
    for (const name of PROHIBITED_ENV_NAMES) {
      assert.equal(source.includes(name), false, name);
    }
  }
  assert.equal(worker.includes("launch:recover"), false);
  assert.equal(worker.includes("performRecovery"), false);
  assert.equal(route.includes("performRecovery"), false);
  assert.equal(route.includes("launch:activate"), false);
  assert.match(packageJson, /"launch:recover-prelaunch": "tsx scripts\/launch-recover-prelaunch\.ts"/);
  assert.equal(ACTIVATION_CONTROL, "IMPLEMENTED");
  assert.equal(RECOVERY_CONTROL, "IMPLEMENTED");
  const activate = readFileSync(new URL("./launch-activate.ts", import.meta.url), "utf8");
  const recover = readFileSync(new URL("./launch-recover-prelaunch.ts", import.meta.url), "utf8");
  assert.ok(activate.indexOf("parseActivationArgs") < activate.indexOf("createServiceRoleClient()"));
  assert.ok(activate.indexOf("performActivation({") > activate.indexOf("createServiceRoleClient()"));
  assert.ok(recover.indexOf("parseRecoveryArgs") < recover.indexOf("createServiceRoleClient()"));
  assert.ok(recover.indexOf("performRecovery({") > recover.indexOf("createServiceRoleClient()"));
  assert.ok(recover.includes("recover"));
});
