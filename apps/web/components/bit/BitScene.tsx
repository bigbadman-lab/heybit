"use client";

import { forwardRef, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  BIT_BODY_COLOR,
  BIT_BODY_DEPTH,
  BIT_CELL,
  BIT_EYE_COLOR,
  BIT_ROWS,
  EVENT_DURATION_MS,
  silhouetteCells,
  type SilhouetteCell,
} from "./bit-mascot.constants";
import { BIT_EYE_LOOPS, eyeLoopArea } from "./bit-mascot.eyes";
import { signedArea, traceCells, worldPoint, type GridPoint } from "./bit-mascot.geometry";
import {
  cameraForProduction,
  cameraForViewport,
  clampIntensity,
  parseBitMascotState,
  productionHaloScale,
  productionMarkFit,
  sampleMascotPose,
} from "./bit-mascot.state";

const COLS = BIT_ROWS[0]?.length ?? 1;
const ROWS = BIT_ROWS.length;

export function BitScene({
  state,
  intensity,
  reducedMotion,
  debugOrbit,
  resetSignal,
  replaySignal,
  loop,
  production = false,
}: {
  state: string;
  intensity: number;
  reducedMotion: boolean;
  debugOrbit: boolean;
  resetSignal: number;
  replaySignal: number;
  loop: boolean;
  production?: boolean;
}) {
  const parsed = parseBitMascotState(state);
  const level = clampIntensity(intensity);
  return (
    <>
      <ambientLight intensity={1.05} />
      <directionalLight position={[0.15, 0.35, 9]} intensity={0.85} color="#fffaf4" />
      <directionalLight position={[-1.6, 1.4, -2.4]} intensity={0.28} color="#f7f4ee" />
      <ResponsiveCamera
        resetSignal={resetSignal}
        reducedMotion={reducedMotion}
        debugOrbit={debugOrbit}
        production={production}
      />
      <BitRig
        state={parsed}
        intensity={level}
        reducedMotion={reducedMotion}
        replaySignal={replaySignal}
        loop={loop}
        production={production}
      />
      <FrameNudger
        state={parsed}
        intensity={level}
        reducedMotion={reducedMotion}
        resetSignal={resetSignal}
        replaySignal={replaySignal}
        loop={loop}
      />
      {debugOrbit ? <OrbitControls enablePan={false} minDistance={6} maxDistance={16} /> : null}
    </>
  );
}

function BitRig({
  state,
  intensity,
  reducedMotion,
  replaySignal,
  loop,
  production,
}: {
  state: ReturnType<typeof parseBitMascotState>;
  intensity: number;
  reducedMotion: boolean;
  replaySignal: number;
  loop: boolean;
  production: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const leftEye = useRef<THREE.Group>(null);
  const rightEye = useRef<THREE.Group>(null);
  const pixel1 = useRef<THREE.Group>(null);
  const pixel2 = useRef<THREE.Group>(null);
  const sweep = useRef<THREE.Mesh>(null);
  const flash = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const flashMaterial = useMemo(() => radialGlow("#ffffff", 0.55), []);
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: BIT_BODY_COLOR,
        roughness: 1,
        metalness: 0,
        emissive: "#f7f4ee",
        emissiveIntensity: 0.08,
      }),
    [],
  );
  const eyeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: BIT_EYE_COLOR }), []);
  const eyeDark = useMemo(() => new THREE.Color(BIT_EYE_COLOR), []);
  const eyeHot = useMemo(() => new THREE.Color("#ffffff"), []);
  const started = useRef(0);
  const previous = useRef(state);
  const replaySeen = useRef(replaySignal);
  const width = useThree((scene) => scene.size.width);
  const height = useThree((scene) => scene.size.height);

  useEffect(() => {
    return () => {
      bodyMaterial.dispose();
      eyeMaterial.dispose();
      flashMaterial.map?.dispose();
      flashMaterial.dispose();
    };
  }, [bodyMaterial, eyeMaterial, flashMaterial]);

  useFrame((sceneState) => {
    if (previous.current !== state || replaySeen.current !== replaySignal) {
      previous.current = state;
      replaySeen.current = replaySignal;
      started.current = sceneState.clock.elapsedTime;
    }
    const duration = EVENT_DURATION_MS[state];
    let elapsedMs = (sceneState.clock.elapsedTime - started.current) * 1000;
    if (loop && duration && elapsedMs >= duration) {
      started.current += duration / 1000;
      elapsedMs = (sceneState.clock.elapsedTime - started.current) * 1000;
    }
    const pose = sampleMascotPose({
      state,
      intensity,
      reducedMotion,
      timeSec: sceneState.clock.elapsedTime,
      eventElapsedMs: elapsedMs,
      motionGain: width < 700 ? 0.78 : width < 1100 ? 0.9 : 1,
    });
    const fit = production ? productionMarkFit(width, height) : { scale: 1, offsetX: 0, offsetY: 0 };
    if (root.current) {
      const lateral = pose.scale * (1 + (1 - pose.squash) * 0.4);
      root.current.position.set(pose.bodyX * fit.scale + fit.offsetX, pose.bodyY * fit.scale + fit.offsetY, 0);
      root.current.rotation.set(pose.rotX, pose.rotY, pose.rotZ);
      root.current.scale.set(lateral * fit.scale, pose.scale * pose.squash * fit.scale, lateral * fit.scale);
    }
    bodyMaterial.emissiveIntensity = 0.05 + Math.max(0, pose.emissive - 0.3) * 0.9;
    eyeMaterial.color.copy(eyeDark).lerp(eyeHot, pose.eyeFlash);
    if (eyes.current) {
      eyes.current.position.x = pose.eyeShiftX;
    }
    if (leftEye.current) {
      leftEye.current.scale.set(1, pose.eyeScaleY, 1);
    }
    if (rightEye.current) {
      rightEye.current.scale.set(1, pose.eyeScaleY, 1);
    }
    if (pixel1.current) {
      pixel1.current.position.set(pose.pixel1[0], pose.pixel1[1], pose.pixel1[2]);
    }
    if (pixel2.current) {
      pixel2.current.position.set(pose.pixel2[0], pose.pixel2[1], pose.pixel2[2]);
    }
    if (sweep.current) {
      const visible = pose.highlight > 0 && pose.highlight < 1;
      sweep.current.visible = visible;
      sweep.current.position.x = -2.35 + pose.highlight * 4.7;
      const material = sweep.current.material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = Math.sin(pose.highlight * Math.PI) * 0.62;
      }
    }
    if (flash.current) {
      flash.current.visible = pose.flash > 0.01;
      const material = flash.current.material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = pose.flash;
      }
    }
    if (halo.current) {
      const haloScale = production ? productionHaloScale(fit.scale, pose.haloScale) : pose.haloScale;
      halo.current.scale.setScalar(haloScale);
      halo.current.position.set(
        production ? fit.offsetX : 0.15,
        production ? fit.offsetY : -0.05,
        -1.15,
      );
      const material = halo.current.material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = pose.haloOpacity;
      }
    }
  });

  const cells = useMemo(() => silhouetteCells(), []);
  const solid = useMemo(() => cells.filter((cell) => cell.kind === "body" || cell.kind === "eye"), [cells]);
  const firstPixel = useMemo(() => cells.filter((cell) => cell.name === "Pixel_01"), [cells]);
  const secondPixel = useMemo(() => cells.filter((cell) => cell.name === "Pixel_02"), [cells]);
  const bodyGeometry = useMemo(() => extrudeSolid(solid, BIT_BODY_DEPTH), [solid]);
  const frontGeometry = useMemo(() => frontPlate(solid), [solid]);
  const leftGeometry = useMemo(() => extrudeLoop(BIT_EYE_LOOPS.Eye_L, 0.05), []);
  const rightGeometry = useMemo(() => extrudeLoop(BIT_EYE_LOOPS.Eye_R, 0.05), []);
  const pixelGeometry1 = useMemo(() => extrudeCells(firstPixel, 0.16), [firstPixel]);
  const pixelGeometry2 = useMemo(() => extrudeCells(secondPixel, 0.16), [secondPixel]);
  const leftAnchor = useMemo(() => loopAnchor(BIT_EYE_LOOPS.Eye_L), []);
  const rightAnchor = useMemo(() => loopAnchor(BIT_EYE_LOOPS.Eye_R), []);
  const pixelAnchor1 = useMemo(() => anchorOf(firstPixel), [firstPixel]);
  const pixelAnchor2 = useMemo(() => anchorOf(secondPixel), [secondPixel]);
  const frontMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    [],
  );

  useEffect(() => {
    return () => {
      bodyGeometry.dispose();
      frontGeometry.dispose();
      leftGeometry.dispose();
      rightGeometry.dispose();
      pixelGeometry1.dispose();
      pixelGeometry2.dispose();
      frontMaterial.dispose();
    };
  }, [bodyGeometry, frontGeometry, frontMaterial, leftGeometry, pixelGeometry1, pixelGeometry2, rightGeometry]);

  const eyeZ = BIT_BODY_DEPTH / 2 - 0.025 - 0.01;

  return (
    <>
    <SoftHalo ref={halo} tight={production} />
    <group ref={root} name="BIT">
      <mesh name="Body" geometry={bodyGeometry} material={bodyMaterial} />
      <mesh name="Front" geometry={frontGeometry} material={frontMaterial} />
      <group ref={eyes} name="Eyes">
        <group ref={leftEye} name="Eye_L" position={leftAnchor}>
          <mesh geometry={leftGeometry} material={eyeMaterial} position={[-leftAnchor[0], -leftAnchor[1], eyeZ]} />
        </group>
        <group ref={rightEye} name="Eye_R" position={rightAnchor}>
          <mesh geometry={rightGeometry} material={eyeMaterial} position={[-rightAnchor[0], -rightAnchor[1], eyeZ]} />
        </group>
      </group>
      <group name="Pixel_01" position={pixelAnchor1}>
        <group ref={pixel1}>
          <mesh geometry={pixelGeometry1} material={frontMaterial} position={[-pixelAnchor1[0], -pixelAnchor1[1], 0]} />
        </group>
      </group>
      <group name="Pixel_02" position={pixelAnchor2}>
        <group ref={pixel2}>
          <mesh geometry={pixelGeometry2} material={frontMaterial} position={[-pixelAnchor2[0], -pixelAnchor2[1], 0]} />
        </group>
      </group>
      <mesh ref={sweep} position={[0, 0, BIT_BODY_DEPTH / 2 + 0.02]} visible={false}>
        <planeGeometry args={[0.55, ROWS * BIT_CELL * 0.92]} />
        <meshBasicMaterial color="#fffaf2" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={flash} position={[0, 0.1, BIT_BODY_DEPTH / 2 + 0.03]} visible={false} material={flashMaterial}>
        <planeGeometry args={[7.2, 7.2]} />
      </mesh>
    </group>
    </>
  );
}

const SoftHalo = forwardRef<THREE.Mesh, { tight?: boolean }>(function SoftHalo({ tight = false }, ref) {
  const material = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    const gradient = context?.createRadialGradient(64, 64, tight ? 0 : 10, 64, 64, 64);
    if (context && gradient) {
      if (tight) {
        gradient.addColorStop(0, "rgba(255, 250, 244, 0.14)");
        gradient.addColorStop(0.42, "rgba(255, 250, 244, 0.03)");
        gradient.addColorStop(0.7, "rgba(255, 250, 244, 0)");
      } else {
        gradient.addColorStop(0, "rgba(255, 250, 244, 0.34)");
        gradient.addColorStop(0.38, "rgba(255, 250, 244, 0.08)");
      }
      gradient.addColorStop(1, "rgba(255, 250, 244, 0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
  }, [tight]);
  useEffect(() => {
    return () => {
      material.map?.dispose();
      material.dispose();
    };
  }, [material]);
  return (
    <mesh ref={ref} position={[0.15, -0.05, -1.15]} material={material}>
      <planeGeometry args={[16, 16]} />
    </mesh>
  );
});

function ResponsiveCamera({
  resetSignal,
  reducedMotion,
  debugOrbit,
  production,
}: {
  resetSignal: number;
  reducedMotion: boolean;
  debugOrbit: boolean;
  production: boolean;
}) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (reducedMotion || debugOrbit || size.width < 768) {
        pointer.current = { x: 0, y: 0 };
        return;
      }
      pointer.current = {
        x: event.clientX / window.innerWidth - 0.5,
        y: event.clientY / window.innerHeight - 0.5,
      };
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [debugOrbit, reducedMotion, size.width]);

  useFrame(() => {
    if (debugOrbit) {
      return;
    }
    const base = (production ? cameraForProduction : cameraForViewport)(size.width, size.height);
    const parallaxX = reducedMotion ? 0 : pointer.current.x * 0.015;
    const parallaxY = reducedMotion ? 0 : pointer.current.y * 0.006;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, base.x + parallaxX, 3, 0.016);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, base.y - parallaxY, 3, 0.016);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, base.z, 3, 0.016);
    camera.lookAt(0, 0, 0);
  });

  useEffect(() => {
    const base = (production ? cameraForProduction : cameraForViewport)(size.width, size.height);
    camera.position.set(base.x, base.y, base.z);
    camera.lookAt(0, 0, 0);
  }, [camera, production, resetSignal, size.height, size.width]);

  return null;
}

function FrameNudger({
  state,
  intensity,
  reducedMotion,
  resetSignal,
  replaySignal,
  loop,
}: {
  state: string;
  intensity: number;
  reducedMotion: boolean;
  resetSignal: number;
  replaySignal: number;
  loop: boolean;
}) {
  const invalidate = useThree((scene) => scene.invalidate);
  useEffect(() => {
    invalidate();
  }, [state, intensity, reducedMotion, resetSignal, replaySignal, loop, invalidate]);
  return null;
}

function radialGlow(color: string, peakAlpha: number): THREE.MeshBasicMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context?.createRadialGradient(64, 64, 8, 64, 64, 64);
  if (context && gradient) {
    gradient.addColorStop(0, hexAlpha(color, peakAlpha));
    gradient.addColorStop(0.42, hexAlpha(color, peakAlpha * 0.22));
    gradient.addColorStop(1, hexAlpha(color, 0));
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
}

function hexAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function extrudeSolid(cells: SilhouetteCell[], depth: number): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(logoShape(cells), { depth, bevelEnabled: false, curveSegments: 1, steps: 1 });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function frontPlate(cells: SilhouetteCell[]): THREE.BufferGeometry {
  const geometry = new THREE.ShapeGeometry(logoShape(cells));
  geometry.translate(0, 0, BIT_BODY_DEPTH / 2 + 0.004);
  return geometry;
}

function extrudeLoop(loop: readonly (readonly [number, number])[], depth: number): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shapeFromLoop(loop, false), { depth, bevelEnabled: false, curveSegments: 1, steps: 1 });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function logoShape(cells: SilhouetteCell[]): THREE.Shape {
  const traced = traceCells(cells);
  const outer = traced.loops
    .map((loop) => ({ loop, area: signedArea(loop) }))
    .filter((item) => item.area > 0.01)
    .sort((left, right) => right.area - left.area)[0];
  const shape = outer ? pathFromLoop(outer.loop, new THREE.Shape()) : new THREE.Shape();
  shape.holes.push(shapeFromLoop(BIT_EYE_LOOPS.Eye_L, true));
  shape.holes.push(shapeFromLoop(BIT_EYE_LOOPS.Eye_R, true));
  return shape;
}

function shapeFromLoop(loop: readonly (readonly [number, number])[], asHole: boolean): THREE.Shape {
  const points = eyeLoopArea(loop) > 0 === asHole ? [...loop].reverse() : loop;
  const path = new THREE.Shape();
  const first = points[0];
  if (!first) {
    return path;
  }
  path.moveTo(first[0], first[1]);
  for (const point of points.slice(1)) {
    path.lineTo(point[0], point[1]);
  }
  return path;
}

function loopAnchor(loop: readonly (readonly [number, number])[]): [number, number, number] {
  if (loop.length === 0) {
    return [0, 0, 0];
  }
  const x = loop.reduce((sum, point) => sum + point[0], 0) / loop.length;
  const y = loop.reduce((sum, point) => sum + point[1], 0) / loop.length;
  return [x, y, 0];
}

function extrudeCells(cells: SilhouetteCell[], depth: number): THREE.BufferGeometry {
  const traced = traceCells(cells);
  const loops = traced.loops
    .map((loop) => ({ loop, area: signedArea(loop) }))
    .filter((item) => Math.abs(item.area) > 0.01);
  const outer = loops.filter((item) => item.area > 0).sort((left, right) => right.area - left.area)[0];
  if (!outer) {
    return new THREE.BoxGeometry(BIT_CELL, BIT_CELL, depth);
  }
  const shape = pathFromLoop(outer.loop, new THREE.Shape());
  for (const hole of loops.filter((item) => item.area < 0)) {
    shape.holes.push(pathFromLoop(hole.loop, new THREE.Path()));
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1, steps: 1 });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function pathFromLoop<T extends THREE.Path>(loop: GridPoint[], path: T): T {
  const first = loop[0];
  if (!first) {
    return path;
  }
  const [x, y] = worldPoint(first, COLS, ROWS, BIT_CELL);
  path.moveTo(x, y);
  for (const point of loop.slice(1)) {
    const [px, py] = worldPoint(point, COLS, ROWS, BIT_CELL);
    path.lineTo(px, py);
  }
  return path;
}

function anchorOf(cells: SilhouetteCell[]): [number, number, number] {
  if (cells.length === 0) {
    return [0, 0, 0];
  }
  let x = 0;
  let y = 0;
  for (const cell of cells) {
    const point = worldPoint({ c: cell.col + 0.5, y: -cell.row - 0.5 }, COLS, ROWS, BIT_CELL);
    x += point[0];
    y += point[1];
  }
  return [x / cells.length, y / cells.length, 0];
}
