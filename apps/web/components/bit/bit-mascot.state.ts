import {
  BIT_CELL,
  BIT_MASCOT_STATES,
  BIT_ROWS,
  EVENT_DURATION_MS,
  type BitMascotState,
} from "./bit-mascot.constants.js";

export interface MascotPose {
  activeState: BitMascotState;
  bodyX: number;
  bodyY: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  eyeScaleY: number;
  eyeShiftX: number;
  pixel1: [number, number, number];
  pixel2: [number, number, number];
  emissive: number;
  scale: number;
  squash: number;
  highlight: number;
  haloScale: number;
  haloOpacity: number;
  eyeFlash: number;
  flash: number;
}

export function parseBitMascotState(value: string): BitMascotState {
  return BIT_MASCOT_STATES.includes(value as BitMascotState) ? (value as BitMascotState) : "IDLE";
}

export function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export function shouldUseFallback(webglAvailable: boolean): boolean {
  return webglAvailable !== true;
}

const VIEW_MARGIN = 1.16;
/** Image span of the body grid inside bitmain.png, used to register the overlay. */
const GRID_IMAGE_SPAN = 720;
const LOGO_IMAGE_SIZE = 1254;
const MAX_REACTION_RAD = (12 * Math.PI) / 180;

/** Near-front camera. Desktop keeps only a small yaw. Smaller viewports sit closer to straight-on. */
export function cameraForViewport(width: number, height: number): { x: number; y: number; z: number } {
  return frameCamera(width, height, width < 700 ? 0.015 : width < 1100 ? 0.03 : 0.045, 0.004);
}

/** Production first frame. Closer to straight-on so the shallow side does not read as a different mark. */
export function cameraForProduction(width: number, height: number): { x: number; y: number; z: number } {
  return frameCamera(width, height, width < 700 ? 0.008 : width < 1100 ? 0.012 : 0.016, 0.001);
}

/**
 * Fit the production model to the opaque span of bitmain2.png.
 * The PNG mark covers 608×623 of its 1080 square and sits 0.93% below center.
 */
export function productionMarkFit(viewWidth = 1, viewHeight = 1): { scale: number; offsetX: number; offsetY: number } {
  const distance = viewDistance(viewWidth, viewHeight);
  const fov = (32 * Math.PI) / 180;
  const visibleH = 2 * distance * Math.tan(fov / 2);
  const visibleW = visibleH * (viewWidth / Math.max(viewHeight, 1));
  const modelH = BIT_ROWS.length * BIT_CELL;
  const modelW = (BIT_ROWS[0]?.length ?? 1) * BIT_CELL;
  const scaleH = (623 / 1080) / (modelH / visibleH);
  const scaleW = (608 / 1080) / (modelW / visibleW);
  return {
    scale: (scaleH + scaleW) / 2,
    offsetX: 0.0005 * visibleW,
    offsetY: -0.0093 * visibleH,
  };
}

const HALO_PLANE = 16;
const HALO_FADE = 0.7;
const HALO_BODY_RATIO = 1.25;

/** Production halo mesh scale. The visible glow stays near the body and dies before the stage edge. */
export function productionHaloScale(markScale: number, poseHaloScale: number): number {
  const bodyWidth = (BIT_ROWS[0]?.length ?? 1) * BIT_CELL * markScale;
  const plane = (bodyWidth * HALO_BODY_RATIO) / HALO_FADE;
  return poseHaloScale * (plane / HALO_PLANE);
}

function frameCamera(width: number, height: number, yaw: number, lift: number): { x: number; y: number; z: number } {
  const distance = viewDistance(width, height);
  return {
    x: Math.sin(yaw) * distance,
    y: distance * lift,
    z: Math.cos(yaw) * distance,
  };
}

/** Square PNG size, in pixels, that puts the logo on the same center and scale as the 3D grid. */
export function referenceFrame(viewWidth: number, viewHeight: number): number {
  const rows = BIT_ROWS.length;
  const distance = viewDistance(viewWidth, viewHeight);
  const fov = (32 * Math.PI) / 180;
  const visibleHalfH = distance * Math.tan(fov / 2);
  const modelHeight = ((rows * BIT_CELL) / 2 / visibleHalfH) * viewHeight;
  return modelHeight / (GRID_IMAGE_SPAN / LOGO_IMAGE_SIZE);
}

function viewDistance(width: number, height: number): number {
  const aspect = width / Math.max(height, 1);
  const fov = (32 * Math.PI) / 180;
  const cols = BIT_ROWS[0]?.length ?? 1;
  const halfH = (BIT_ROWS.length * BIT_CELL) / 2;
  const halfW = (cols * BIT_CELL) / 2;
  const distV = halfH / Math.tan(fov / 2);
  const horizontal = 2 * Math.atan(Math.tan(fov / 2) * aspect);
  const distH = halfW / Math.tan(horizontal / 2);
  return Math.max(distV, distH) * VIEW_MARGIN;
}

export function sampleMascotPose(input: {
  state: string;
  intensity: number;
  reducedMotion: boolean;
  timeSec: number;
  eventElapsedMs: number;
  motionGain?: number;
}): MascotPose {
  const requested = parseBitMascotState(input.state);
  const intensity = clampIntensity(input.intensity);
  const duration = EVENT_DURATION_MS[requested];
  const activeState = duration !== undefined && input.eventElapsedMs >= duration ? "IDLE" : requested;
  if (input.reducedMotion) {
    return { activeState, ...staticOffsets(activeState, intensity) };
  }
  const idle = idleDrift(input.timeSec);
  const progress = duration ? clamp01(input.eventElapsedMs / duration) : 0;
  const event = attenuate(eventOffsets(activeState, progress, intensity, input.timeSec), input.motionGain ?? 1);
  return {
    activeState,
    bodyX: idle.bodyX + event.bodyX,
    bodyY: idle.bodyY + event.bodyY,
    rotX: clamp(idle.rotX + event.rotX, -MAX_REACTION_RAD, MAX_REACTION_RAD),
    rotY: clamp(idle.rotY + event.rotY, -MAX_REACTION_RAD, MAX_REACTION_RAD),
    rotZ: clamp(idle.rotZ + event.rotZ, -MAX_REACTION_RAD, MAX_REACTION_RAD),
    eyeScaleY: idle.eyeScaleY * event.eyeScaleY,
    eyeShiftX: idle.eyeShiftX + event.eyeShiftX,
    pixel1: addVec(idle.pixel1, event.pixel1),
    pixel2: addVec(idle.pixel2, event.pixel2),
    emissive: idle.emissive + event.emissive,
    scale: clamp(idle.scale * event.scale, 0.93, 1.08),
    squash: clamp(event.squash, 0.93, 1.08),
    highlight: activeState === "DEX_PAID" ? event.highlight : 0,
    haloScale: Math.max(0.8, idle.haloScale * event.haloScale),
    haloOpacity: Math.max(0, idle.haloOpacity * event.haloOpacity),
    eyeFlash: clamp(event.eyeFlash, 0, 1),
    flash: clamp(event.flash, 0, 1),
  };
}

function idleDrift(timeSec: number): Omit<MascotPose, "activeState"> {
  return {
    bodyX: Math.sin(timeSec * 0.11) * 0.004,
    bodyY: Math.sin(timeSec * 0.36) * 0.014,
    rotX: Math.sin(timeSec * 0.13) * 0.003,
    rotY: Math.sin(timeSec * 0.09) * 0.005,
    rotZ: Math.sin(timeSec * 0.07) * 0.002,
    eyeScaleY: blinkScale(timeSec),
    eyeShiftX: Math.sin(timeSec * 0.16) * 0.0015,
    pixel1: [Math.sin(timeSec * 0.22) * 0.004, Math.cos(timeSec * 0.18) * 0.005, 0],
    pixel2: [Math.cos(timeSec * 0.17) * 0.004, Math.sin(timeSec * 0.21) * 0.004, 0],
    emissive: 0.32 + Math.sin(timeSec * 0.22) * 0.02,
    scale: 1,
    squash: 1,
    highlight: 0,
    haloScale: 1,
    haloOpacity: 1,
    eyeFlash: 0,
    flash: 0,
  };
}

function eventOffsets(
  state: BitMascotState,
  progress: number,
  intensity: number,
  timeSec: number,
): Omit<MascotPose, "activeState"> {
  if (state === "NOTICE") {
    return noticeOffsets(progress);
  }
  if (state === "BUY") {
    return buyOffsets(progress);
  }
  if (state === "SELL") {
    return sellOffsets(progress);
  }
  if (state === "BUSY") {
    return busyOffsets(timeSec, intensity);
  }
  if (state === "BURN") {
    return burnOffsets(progress);
  }
  if (state === "DEX_PAID") {
    return dexOffsets(progress);
  }
  return restDeltas();
}

function noticeOffsets(progress: number): Omit<MascotPose, "activeState"> {
  const pose = restDeltas();
  const strike = smoothstep(span(progress, 0.04, 0.34));
  const release = smoothstep(span(progress, 0.52, 1));
  const amount = progress < 0.52 ? strike : 1 - release;
  pose.rotY = -0.1 * amount;
  pose.eyeShiftX = -0.01 * amount;
  pose.eyeScaleY = 1 + 0.07 * Math.sin(Math.min(1, span(progress, 0.08, 0.42)) * Math.PI);
  pose.pixel1 = [-0.035 * amount, 0.02 * amount, 0];
  pose.pixel2 = [-0.028 * amount, 0.012 * amount, 0];
  pose.emissive = 0.04 * amount;
  return pose;
}

function buyOffsets(progress: number): Omit<MascotPose, "activeState"> {
  const pose = restDeltas();
  const windup = span(progress, 0, 0.16);
  const pop = span(progress, 0.16, 0.46);
  const settle = span(progress, 0.46, 1);
  if (progress < 0.16) {
    const t = easeInCubic(windup);
    pose.bodyY = lerp(0, -0.045, t);
    pose.squash = lerp(1, 0.955, t);
    pose.scale = lerp(1, 0.99, t);
    pose.eyeScaleY = lerp(1, 0.94, t);
    pose.rotX = lerp(0, 0.025, t);
    pose.pixel1 = [0, lerp(0, 0.018, t), 0];
    pose.pixel2 = [0, lerp(0, 0.012, t), 0];
    return pose;
  }
  if (progress < 0.46) {
    const lifted = easeOutBack(pop);
    const t = easeOutCubic(pop);
    const kick = easeOutCubic(span(progress, 0.22, 0.46));
    pose.bodyY = lerp(-0.045, 0.26, lifted);
    pose.squash = lerp(0.955, 1.03, t);
    pose.scale = lerp(0.99, 1.04, t);
    pose.rotX = lerp(0.025, -0.15, t);
    pose.rotZ = lerp(0, 0.08, t);
    pose.eyeScaleY = lerp(0.94, 1.12, t);
    pose.emissive = 0.1 * t;
    pose.haloScale = lerp(1, 1.16, t);
    pose.haloOpacity = 1;
    pose.pixel1 = [lerp(0, -0.05, kick), lerp(0.018, 0.09, kick), 0];
    pose.pixel2 = [lerp(0, -0.055, kick), lerp(0.012, 0.065, kick), 0];
    return pose;
  }
  const t = smoothstep(settle);
  pose.bodyY = lerp(0.26, 0, t);
  pose.squash = lerp(1.03, 1, t);
  pose.scale = lerp(1.04, 1, t);
  pose.rotX = lerp(-0.15, 0, t);
  pose.rotZ = lerp(0.08, 0, t);
  pose.eyeScaleY = lerp(1.12, 1, t);
  pose.emissive = lerp(0.1, 0, t);
  pose.haloScale = lerp(1.16, 1, t);
  pose.haloOpacity = 1;
  pose.pixel1 = [lerp(-0.05, 0, t), lerp(0.09, 0, t), 0];
  pose.pixel2 = [lerp(-0.055, 0, t), lerp(0.065, 0, t), 0];
  return pose;
}

function sellOffsets(progress: number): Omit<MascotPose, "activeState"> {
  const pose = restDeltas();
  const windup = span(progress, 0, 0.08);
  const drop = span(progress, 0.08, 0.3);
  const recover = span(progress, 0.34, 1);
  if (progress < 0.08) {
    const t = easeInCubic(windup);
    pose.bodyY = lerp(0, 0.02, t);
    pose.squash = lerp(1, 0.98, t);
    return pose;
  }
  if (progress < 0.34) {
    const t = easeOutCubic(drop);
    pose.bodyY = lerp(0.02, -0.3, t);
    pose.bodyX = lerp(0, 0.05, t);
    pose.squash = lerp(0.98, 0.945, t);
    pose.scale = lerp(1, 0.985, t);
    pose.rotX = lerp(0, 0.09, t);
    pose.rotZ = lerp(0, -0.155, t);
    pose.eyeScaleY = lerp(1, 0.86, t);
    pose.pixel1 = [lerp(0, 0.02, t), lerp(0, 0.1, t), 0];
    pose.pixel2 = [lerp(0, 0.015, t), lerp(0, 0.08, t), 0];
    pose.haloScale = lerp(1, 0.94, t);
    return pose;
  }
  const damp = 1 - smoothstep(recover);
  const bounce = Math.sin(recover * Math.PI) * (1 - recover) * 0.045;
  pose.bodyY = -0.3 * damp + bounce;
  pose.bodyX = 0.05 * damp;
  pose.squash = lerp(0.945, 1, smoothstep(recover));
  pose.scale = lerp(0.985, 1, smoothstep(recover));
  pose.rotX = 0.09 * damp;
  pose.rotZ = -0.155 * damp;
  pose.eyeScaleY = lerp(0.86, 1, smoothstep(recover));
  pose.pixel1 = [0.02 * damp, 0.1 * damp, 0];
  pose.pixel2 = [0.015 * damp, 0.08 * damp, 0];
  pose.haloScale = lerp(0.94, 1, smoothstep(recover));
  return pose;
}

function busyOffsets(timeSec: number, intensity: number): Omit<MascotPose, "activeState"> {
  const pose = restDeltas();
  const tempo = 0.85 + intensity * 1.15;
  const bob = Math.sin(timeSec * tempo * 2.4) * (0.028 + intensity * 0.04);
  const sway = Math.sin(timeSec * (0.65 + intensity * 0.7));
  const orbit = 0.016 + intensity * 0.038;
  const blink = busyBlink(timeSec, 1.7 - intensity * 0.8);
  pose.bodyY = bob;
  pose.rotY = sway * (0.045 + intensity * 0.07);
  pose.rotZ = Math.sin(timeSec * (0.5 + intensity * 0.35) + 0.6) * (0.012 + intensity * 0.02);
  pose.eyeScaleY = blink;
  pose.eyeShiftX = Math.sin(timeSec * (1.3 + intensity * 1.4)) * (0.003 + intensity * 0.008);
  pose.pixel1 = [
    Math.cos(timeSec * (1.05 + intensity * 0.7)) * orbit,
    Math.sin(timeSec * (0.92 + intensity * 0.55)) * orbit * 0.85,
    0,
  ];
  pose.pixel2 = [
    Math.sin(timeSec * (0.88 + intensity * 0.6) + 1.3) * orbit * 0.9,
    Math.cos(timeSec * (1.12 + intensity * 0.5) + 0.4) * orbit,
    0,
  ];
  const breath = Math.sin(timeSec * (1.15 + intensity * 0.8));
  pose.emissive = 0.04 + intensity * 0.12 + Math.sin(timeSec * (1.1 + intensity)) * 0.02;
  pose.haloScale = 1 + breath * (0.02 + intensity * 0.055);
  pose.haloOpacity = 1 - Math.abs(breath) * (0.04 + intensity * 0.08);
  return pose;
}

function burnOffsets(progress: number): Omit<MascotPose, "activeState"> {
  const pose = restDeltas();
  const compress = span(progress, 0, 0.18);
  const burst = span(progress, 0.18, 0.42);
  const settle = span(progress, 0.42, 0.78);
  if (progress < 0.18) {
    const t = easeInCubic(compress);
    pose.squash = lerp(1, 0.945, t);
    pose.scale = lerp(1, 0.985, t);
    pose.pixel1 = [lerp(0, 0.07, t), lerp(0, -0.04, t), 0];
    pose.pixel2 = [lerp(0, 0.08, t), lerp(0, -0.03, t), 0];
    pose.haloScale = lerp(1, 0.92, t);
    return pose;
  }
  if (progress < 0.42) {
    const t = easeOutCubic(burst);
    pose.squash = lerp(0.945, 1.02, t);
    pose.scale = lerp(0.985, 1.055, t);
    pose.emissive = 0.62 * t;
    pose.flash = 0.72 * Math.sin(t * Math.PI);
    pose.eyeFlash = Math.sin(Math.min(1, t) * Math.PI);
    pose.haloScale = lerp(0.92, 1.32, t);
    pose.haloOpacity = 1;
    pose.eyeScaleY = lerp(1, 1.04, t);
    pose.pixel1 = [lerp(0.07, -0.09, t), lerp(-0.04, 0.1, t), 0];
    pose.pixel2 = [lerp(0.08, -0.1, t), lerp(-0.03, 0.07, t), 0];
    return pose;
  }
  const t = easeOutCubic(settle);
  pose.squash = lerp(1.02, 1, t);
  pose.scale = lerp(1.055, 1, t);
  pose.emissive = lerp(0.62, 0, t);
  pose.flash = lerp(0, 0, t);
  pose.eyeFlash = lerp(0, 0, t);
  pose.haloScale = lerp(1.32, 1, t);
  pose.haloOpacity = lerp(1, 1, t);
  pose.eyeScaleY = lerp(1.04, 1, t);
  pose.pixel1 = [lerp(-0.09, 0, t), lerp(0.1, 0, t), 0];
  pose.pixel2 = [lerp(-0.1, 0, t), lerp(0.07, 0, t), 0];
  return pose;
}

function dexOffsets(progress: number): Omit<MascotPose, "activeState"> {
  const pose = restDeltas();
  const pause = span(progress, 0, 0.16);
  const rise = span(progress, 0.16, 0.48);
  const settle = span(progress, 0.62, 1);
  pose.highlight = smoothstep(span(progress, 0.14, 0.78));
  if (progress < 0.16) {
    const t = easeInCubic(pause);
    pose.squash = lerp(1, 0.975, t);
    pose.bodyY = lerp(0, -0.015, t);
    return pose;
  }
  if (progress < 0.62) {
    const t = easeOutCubic(rise);
    const flick = Math.sin(span(progress, 0.2, 0.62) * Math.PI);
    pose.bodyY = lerp(-0.015, 0.12, t);
    pose.rotZ = lerp(0, 0.11, t);
    pose.rotX = lerp(0, -0.06, t);
    pose.scale = lerp(1, 1.025, t);
    pose.eyeScaleY = lerp(0.98, 1.1, t);
    pose.emissive = 0.08 * t;
    pose.haloScale = 1 + flick * 0.14;
    pose.haloOpacity = 1;
    pose.pixel1 = [Math.sin(flick * Math.PI) * 0.045, flick * 0.07, 0];
    pose.pixel2 = [-flick * 0.04, flick * 0.05, 0];
    return pose;
  }
  const t = smoothstep(settle);
  pose.bodyY = lerp(0.12, 0, t);
  pose.rotZ = lerp(0.11, 0, t);
  pose.rotX = lerp(-0.06, 0, t);
  pose.scale = lerp(1.025, 1, t);
  pose.eyeScaleY = lerp(1.1, 1, t);
  pose.emissive = lerp(0.08, 0, t);
  pose.haloScale = lerp(1, 1, t);
  pose.haloOpacity = lerp(1, 1, t);
  return pose;
}

function staticOffsets(state: BitMascotState, intensity: number): Omit<MascotPose, "activeState"> {
  const pose = emptyOffsets();
  if (state === "BUY") {
    pose.bodyY = 0.016;
    pose.eyeScaleY = 1.04;
    pose.emissive = 0.42;
    pose.haloScale = 1.06;
  } else if (state === "SELL") {
    pose.bodyY = -0.016;
    pose.eyeScaleY = 0.94;
    pose.emissive = 0.26;
    pose.haloOpacity = 0.92;
  } else if (state === "NOTICE") {
    pose.rotY = -0.03;
    pose.eyeShiftX = -0.004;
  } else if (state === "BURN") {
    pose.emissive = 0.72;
    pose.flash = 0.28;
    pose.eyeFlash = 0.4;
    pose.haloScale = 1.08;
    pose.scale = 1.015;
  } else if (state === "DEX_PAID") {
    pose.highlight = 0.45;
    pose.emissive = 0.4;
    pose.haloScale = 1.05;
    pose.eyeScaleY = 1.03;
  } else if (state === "BUSY") {
    pose.emissive = 0.36 + intensity * 0.12;
    pose.haloScale = 1 + intensity * 0.04;
  }
  return pose;
}

function emptyOffsets(): Omit<MascotPose, "activeState"> {
  return {
    bodyX: 0,
    bodyY: 0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    eyeScaleY: 1,
    eyeShiftX: 0,
    pixel1: [0, 0, 0],
    pixel2: [0, 0, 0],
    emissive: 0.32,
    scale: 1,
    squash: 1,
    highlight: 0,
    haloScale: 1,
    haloOpacity: 1,
    eyeFlash: 0,
    flash: 0,
  };
}

function restDeltas(): Omit<MascotPose, "activeState"> {
  return {
    bodyX: 0,
    bodyY: 0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    eyeScaleY: 1,
    eyeShiftX: 0,
    pixel1: [0, 0, 0],
    pixel2: [0, 0, 0],
    emissive: 0,
    scale: 1,
    squash: 1,
    highlight: 0,
    haloScale: 1,
    haloOpacity: 1,
    eyeFlash: 0,
    flash: 0,
  };
}

function blinkScale(timeSec: number): number {
  const cycle = 6.4;
  const phase = timeSec % cycle;
  if (phase < 0.08) {
    return 0.985 + (phase / 0.08) * 0.015;
  }
  if (phase > cycle - 0.06) {
    return 1 - ((phase - (cycle - 0.06)) / 0.06) * 0.015;
  }
  return 1;
}

function busyBlink(timeSec: number, cycle: number): number {
  const phase = timeSec % cycle;
  if (phase < 0.07) {
    return 0.9 + (phase / 0.07) * 0.1;
  }
  if (phase > cycle - 0.05) {
    return 1 - ((phase - (cycle - 0.05)) / 0.05) * 0.1;
  }
  return 1;
}

function attenuate(
  pose: Omit<MascotPose, "activeState">,
  gain: number,
): Omit<MascotPose, "activeState"> {
  const scale = clamp(gain, 0.5, 1);
  if (scale === 1) {
    return pose;
  }
  return {
    ...pose,
    bodyX: pose.bodyX * scale,
    bodyY: pose.bodyY * scale,
    rotX: pose.rotX * scale,
    rotY: pose.rotY * scale,
    rotZ: pose.rotZ * scale,
    eyeScaleY: 1 + (pose.eyeScaleY - 1) * scale,
    eyeShiftX: pose.eyeShiftX * scale,
    pixel1: [pose.pixel1[0] * scale, pose.pixel1[1] * scale, pose.pixel1[2] * scale],
    pixel2: [pose.pixel2[0] * scale, pose.pixel2[1] * scale, pose.pixel2[2] * scale],
    scale: 1 + (pose.scale - 1) * scale,
    squash: 1 + (pose.squash - 1) * scale,
    haloScale: 1 + (pose.haloScale - 1) * scale,
  };
}

function addVec(left: [number, number, number], right: [number, number, number]): [number, number, number] {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function span(progress: number, start: number, end: number): number {
  return clamp01((progress - start) / (end - start));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function easeOutCubic(value: number): number {
  const t = clamp01(value);
  return 1 - (1 - t) ** 3;
}

function easeInCubic(value: number): number {
  const t = clamp01(value);
  return t ** 3;
}

function easeOutBack(value: number): number {
  const t = clamp01(value);
  const overshoot = 1.05;
  const c3 = overshoot + 1;
  return 1 + c3 * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}
