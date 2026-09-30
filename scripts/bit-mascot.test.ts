import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BIT_COMPARE_MODES,
  BIT_FALLBACK_MARK,
  BIT_GLB_PATH,
  BIT_MASCOT_STATES,
  BIT_REFERENCE_PATH,
  BIT_ROWS,
  EVENT_DURATION_MS,
  silhouetteCells,
} from "../apps/web/components/bit/bit-mascot.constants.js";
import { BIT_EYE_LOOPS, eyeLoopArea } from "../apps/web/components/bit/bit-mascot.eyes.js";
import { signedArea, traceCells } from "../apps/web/components/bit/bit-mascot.geometry.js";
import {
  cameraForViewport,
  clampIntensity,
  parseBitMascotState,
  referenceFrame,
  sampleMascotPose,
  shouldUseFallback,
} from "../apps/web/components/bit/bit-mascot.state.js";

const pose = {
  intensity: 0,
  reducedMotion: false,
  timeSec: 1.2,
  eventElapsedMs: 0,
};

test("mascot states are the review set and unknown input settles to idle", () => {
  assert.deepEqual([...BIT_MASCOT_STATES], ["IDLE", "NOTICE", "BUY", "SELL", "BUSY", "BURN", "DEX_PAID"]);
  assert.equal(parseBitMascotState("ROBOT"), "IDLE");
  assert.equal(sampleMascotPose({ ...pose, state: "ROBOT" }).activeState, "IDLE");
});

test("intensity clamps and busy energy follows it", () => {
  assert.equal(clampIntensity(1.4), 1);
  assert.equal(clampIntensity(-2), 0);
  assert.equal(clampIntensity(Number.NaN), 0);
  const calm = sampleMascotPose({ ...pose, state: "BUSY", intensity: 0, timeSec: 0.4 });
  const hot = sampleMascotPose({ ...pose, state: "BUSY", intensity: 1, timeSec: 0.4 });
  assert.ok(hot.emissive > calm.emissive);
  let calmTravel = 0;
  let hotTravel = 0;
  for (let timeSec = 0; timeSec < 2; timeSec += 0.05) {
    const low = sampleMascotPose({ ...pose, state: "BUSY", intensity: 0, timeSec });
    const high = sampleMascotPose({ ...pose, state: "BUSY", intensity: 1, timeSec });
    calmTravel = Math.max(calmTravel, Math.hypot(low.pixel1[0], low.pixel1[1]));
    hotTravel = Math.max(hotTravel, Math.hypot(high.pixel1[0], high.pixel1[1]));
  }
  assert.ok(hotTravel > calmTravel);
});

test("reduced motion holds a static pose", () => {
  const early = sampleMascotPose({ ...pose, state: "BUSY", intensity: 1, reducedMotion: true, timeSec: 0.2 });
  const later = sampleMascotPose({ ...pose, state: "BUSY", intensity: 1, reducedMotion: true, timeSec: 4.8 });
  assert.deepEqual(early, later);
  assert.equal(early.bodyY, 0);
  assert.equal(early.squash, 1);
  for (const state of BIT_MASCOT_STATES) {
    const held = sampleMascotPose({ ...pose, state, intensity: 1, reducedMotion: true, eventElapsedMs: 200 });
    assert.ok(Math.abs(held.bodyY) <= 0.02, `${state} reduced bodyY ${held.bodyY}`);
    assert.ok(Math.abs(held.rotX) <= 0.04 && Math.abs(held.rotY) <= 0.04 && Math.abs(held.rotZ) <= 0.04);
    assert.ok(held.scale >= 0.99 && held.scale <= 1.03);
    assert.equal(held.squash, 1);
  }
});

test("buy lifts, sell dips, and short events return to idle", () => {
  const idle = sampleMascotPose({ ...pose, state: "IDLE" });
  const buy = sampleMascotPose({ ...pose, state: "BUY", eventElapsedMs: 240 });
  const sell = sampleMascotPose({ ...pose, state: "SELL", eventElapsedMs: 180 });
  assert.ok(buy.bodyY > idle.bodyY + 0.12, `buy lift ${buy.bodyY}`);
  assert.ok(sell.bodyY < idle.bodyY - 0.12, `sell dip ${sell.bodyY}`);
  assert.ok(buy.eyeScaleY > sell.eyeScaleY);
  assert.ok(buy.pixel1[1] > 0.03);
  assert.ok(sell.pixel1[1] > 0.02);
  const mobileBuy = sampleMascotPose({ ...pose, state: "BUY", eventElapsedMs: 240, motionGain: 0.78 });
  assert.ok(Math.abs(mobileBuy.bodyY - idle.bodyY) < Math.abs(buy.bodyY - idle.bodyY));
  const notice = sampleMascotPose({ ...pose, state: "NOTICE", eventElapsedMs: 900 });
  assert.equal(notice.activeState, "IDLE");
  assert.deepEqual(notice, idle);
  const busy = sampleMascotPose({ ...pose, state: "BUSY", eventElapsedMs: 10_000 });
  assert.equal(busy.activeState, "BUSY");
  for (const state of ["NOTICE", "BUY", "SELL", "BURN", "DEX_PAID"] as const) {
    const duration = EVENT_DURATION_MS[state] ?? 0;
    const settled = sampleMascotPose({ ...pose, state, eventElapsedMs: duration });
    assert.equal(settled.activeState, "IDLE");
    assert.deepEqual(settled, idle);
  }
});

test("reaction amplitudes stay inside the safe envelope", () => {
  const maxRot = (12 * Math.PI) / 180 + 0.001;
  for (const state of BIT_MASCOT_STATES) {
    const duration = EVENT_DURATION_MS[state] ?? 1_600;
    for (let elapsed = 0; elapsed <= duration; elapsed += 20) {
      const sample = sampleMascotPose({
        ...pose,
        state,
        intensity: 1,
        eventElapsedMs: elapsed,
        timeSec: elapsed / 1000,
      });
      assert.ok(sample.scale >= 0.93 && sample.scale <= 1.08, `${state} scale ${sample.scale}`);
      assert.ok(sample.squash >= 0.93 && sample.squash <= 1.08, `${state} squash ${sample.squash}`);
      assert.ok(Math.abs(sample.rotX) <= maxRot && Math.abs(sample.rotY) <= maxRot && Math.abs(sample.rotZ) <= maxRot);
      assert.ok(Math.hypot(sample.pixel1[0], sample.pixel1[1]) < 0.22);
      assert.ok(Math.hypot(sample.pixel2[0], sample.pixel2[1]) < 0.22);
      assert.ok(Math.abs(sample.bodyY) < 0.45);
    }
  }
  assert.equal(EVENT_DURATION_MS.BUY, 680);
  assert.equal(EVENT_DURATION_MS.SELL, 740);
  assert.equal(EVENT_DURATION_MS.BURN, 840);
  assert.equal(EVENT_DURATION_MS.DEX_PAID, 920);
});

test("the silhouette keeps the logo parts and is not mirrored", () => {
  const cells = silhouetteCells();
  const pixels = cells.filter((cell) => cell.kind === "pixel");
  assert.ok(pixels.filter((cell) => cell.name === "Pixel_01").length >= 2);
  assert.ok(pixels.filter((cell) => cell.name === "Pixel_02").length >= 2);
  assert.ok(cells.some((cell) => cell.name === "Eye_L"));
  assert.ok(cells.some((cell) => cell.name === "Eye_R"));
  assert.equal(BIT_ROWS.every((row) => row.length === BIT_ROWS[0]?.length), true);
  const width = BIT_ROWS[0]?.length ?? 0;
  const body = new Set(cells.filter((cell) => cell.kind === "body").map((cell) => `${cell.col},${cell.row}`));
  const asymmetric = cells.some((cell) => cell.kind === "body" && !body.has(`${width - 1 - cell.col},${cell.row}`));
  assert.equal(asymmetric, true);
  const notch = BIT_ROWS.some((row) => /#[.]{2,}#/.test(row));
  assert.equal(notch, true);
  const traced = traceCells(cells.filter((cell) => cell.kind === "body"));
  const holes = traced.loops.filter((loop) => signedArea(loop) < 0);
  assert.equal(holes.length, 2);
});

test("fallback and the lab use the canonical logo without a backend", () => {
  assert.equal(shouldUseFallback(false), true);
  assert.equal(shouldUseFallback(true), false);
  assert.equal(BIT_REFERENCE_PATH, "/brand/bitmain.png");
  assert.equal(BIT_FALLBACK_MARK, BIT_REFERENCE_PATH);
  assert.equal(BIT_GLB_PATH, "/models/BIT.glb");
  assert.deepEqual([...BIT_COMPARE_MODES], ["3D", "REFERENCE", "SPLIT", "OVERLAY"]);
  const png = readFileSync(new URL("../apps/web/public/brand/bitmain.png", import.meta.url));
  assert.equal(png.subarray(0, 4).toString("hex"), "89504e47");
  const desktop = cameraForViewport(1440, 900);
  const yaw = (Math.atan2(desktop.x, desktop.z) * 180) / Math.PI;
  assert.ok(yaw > 2 && yaw < 5, `desktop yaw ${yaw}`);
  const mobile = cameraForViewport(390, 700);
  assert.ok(Math.atan2(mobile.x, mobile.z) < Math.atan2(desktop.x, desktop.z));
  const leftXs = BIT_EYE_LOOPS.Eye_L.map((point) => point[0]);
  const rightXs = BIT_EYE_LOOPS.Eye_R.map((point) => point[0]);
  assert.ok(Math.max(...leftXs) < Math.min(...rightXs));
  assert.ok(new Set(BIT_EYE_LOOPS.Eye_L.map((point) => point[0].toFixed(3))).size > 2);
  assert.ok(new Set(BIT_EYE_LOOPS.Eye_R.map((point) => point[1].toFixed(3))).size > 2);
  assert.ok(eyeLoopArea(BIT_EYE_LOOPS.Eye_L) !== 0);
  assert.ok(referenceFrame(720, 640) > 0);
  const lab = readFileSync(new URL("../apps/web/components/bit/BitLab.tsx", import.meta.url), "utf8");
  assert.match(lab, /referenceFrame/);
  assert.match(lab, /Overlay/);
  assert.match(lab, /useState<BitMascotState>\("IDLE"\)/);
  assert.match(lab, /useState<BitCompareMode>\("SPLIT"\)/);
  assert.match(lab, /BIT_REFERENCE_PATH/);
  assert.match(lab, /Replay/);
  assert.match(lab, /Loop/);
  const labFiles = [
    "../apps/web/app/lab/bit/page.tsx",
    "../apps/web/components/bit/BitLab.tsx",
    "../apps/web/components/bit/BitMascot3D.tsx",
    "../apps/web/components/bit/BitScene.tsx",
  ];
  for (const relativePath of labFiles) {
    const text = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    for (const forbidden of ["supabase", "openai", "fetch(", "WebSocket", "sendTransaction"]) {
      assert.equal(text.toLowerCase().includes(forbidden.toLowerCase()), false, `${relativePath} contains ${forbidden}`);
    }
  }
});

test("production homepage uses the approved idle mascot without event wiring", () => {
  const page = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  const production = readFileSync(new URL("../apps/web/components/bit/BitProduction.tsx", import.meta.url), "utf8");
  const labPage = readFileSync(new URL("../apps/web/app/lab/bit/page.tsx", import.meta.url), "utf8");
  assert.match(page, /<BitProduction \/>/);
  assert.match(page, /HEYBIT/);
  assert.match(page, /BIT is waking up\./);
  assert.match(page, /BIT runtime:/);
  assert.match(page, /Official mint:/);
  assert.equal(page.includes("Development foundation"), false);
  assert.equal(page.includes("This is not the live BIT website."), false);
  assert.match(production, /<BitMascot3D state="IDLE"/);
  assert.match(production, /BIT_FALLBACK_MARK/);
  assert.match(production, /prefers-reduced-motion/);
  assert.equal(production.includes("debugOrbit"), false);
  assert.equal(production.includes("Replay"), false);
  assert.match(labPage, /<BitLab \/>/);
  for (const forbidden of ["supabase", "openai", "fetch(", "WebSocket", "sendTransaction", "BUY", "SELL", "BURN"]) {
    assert.equal(production.includes(forbidden), false, `production contains ${forbidden}`);
  }
});
