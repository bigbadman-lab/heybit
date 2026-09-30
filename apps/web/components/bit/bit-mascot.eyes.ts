/**
 * Stepped eye openings traced from apps/web/public/brand/bitmain.png.
 * Coordinates are in the same world space as the body grid.
 * Each loop keeps the pixel steps of that eye, including the left eye's inner step.
 */
export const BIT_EYE_LOOPS = {
  Eye_L: [
    [-0.11, 0.5647],
    [-0.286, 0.5647],
    [-0.286, 0.4473],
    [-0.4033, 0.4473],
    [-0.4033, -0.2567],
    [-0.286, -0.2567],
    [-0.286, -0.6673],
    [-0.1687, -0.6673],
    [-0.1687, -0.8433],
    [0.3593, -0.8433],
    [0.3593, -0.6673],
    [0.4767, -0.6673],
    [0.4767, -0.022],
    [0.3593, -0.022],
    [0.3593, 0.4473],
    [0.1833, 0.4473],
    [0.1833, 0.5647],
    [-0.0513, 0.5647],
  ],
  Eye_R: [
    [1.0633, 0.1687],
    [1.0633, -0.1247],
    [1.1807, -0.1247],
    [1.1807, -0.3593],
    [1.7087, -0.3593],
    [1.7087, -0.242],
    [1.826, -0.242],
    [1.826, 0.3447],
    [1.7087, 0.3447],
    [1.7087, 0.814],
    [1.5327, 0.814],
    [1.5327, 0.9313],
    [1.0633, 0.9313],
    [1.0633, 0.814],
    [0.946, 0.814],
    [0.946, 0.4033],
    [1.0633, 0.4033],
    [1.0633, 0.2273],
  ],
} as const;

export type BitEyeName = keyof typeof BIT_EYE_LOOPS;

export function eyeLoopArea(loop: readonly (readonly [number, number])[]): number {
  let sum = 0;
  for (let index = 0; index < loop.length; index += 1) {
    const current = loop[index];
    const next = loop[(index + 1) % loop.length];
    if (!current || !next) {
      continue;
    }
    sum += current[0] * next[1] - next[0] * current[1];
  }
  return sum / 2;
}
