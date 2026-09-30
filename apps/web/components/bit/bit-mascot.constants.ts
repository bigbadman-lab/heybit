export const BIT_MASCOT_STATES = ["IDLE", "NOTICE", "BUY", "SELL", "BUSY", "BURN", "DEX_PAID"] as const;

export type BitMascotState = (typeof BIT_MASCOT_STATES)[number];

export const BIT_COMPARE_MODES = ["3D", "REFERENCE", "SPLIT", "OVERLAY"] as const;

export type BitCompareMode = (typeof BIT_COMPARE_MODES)[number];

/** Canonical BIT mark. The 3D mascot and the static fallback both follow this file. */
export const BIT_REFERENCE_PATH = "/brand/bitmain.png";
export const BIT_FALLBACK_MARK = BIT_REFERENCE_PATH;
export const BIT_GLB_PATH = "/models/BIT.glb";

export const BIT_BACKGROUND = "#070708";
export const BIT_BODY_COLOR = "#ffffff";
export const BIT_EYE_COLOR = "#070708";
export const BIT_CELL = 0.22;
/** Shallow extrusion. The front silhouette stays the identity. */
export const BIT_BODY_DEPTH = 0.26;

/**
 * Traced from apps/web/public/brand/bitmain.png.
 * Top row first. `#` body, `e` eye opening, `a` upper fragment, `b` lower fragment.
 */
export const BIT_ROWS = [
  "...aa..................",
  "...aa..................",
  "....a....#######.......",
  "bb.....###########.....",
  "bb....#############....",
  ".....###############...",
  "....#################..",
  "...###################.",
  "..##############eee###.",
  ".#########ee####eee###.",
  ".#########eee###eee###.",
  "##########eee###eeee###",
  "##########eeee##eeee###",
  "##########eeee###ee####",
  "##########eeee#########",
  "###########ee##########",
  "#######################",
  ".#####################.",
  ".#####################.",
  "..####################.",
  "...##################..",
  "....################...",
  "....######....#####....",
  ".....####......###.....",
] as const;

export const EVENT_DURATION_MS: Partial<Record<BitMascotState, number>> = {
  NOTICE: 640,
  BUY: 680,
  SELL: 740,
  BURN: 840,
  DEX_PAID: 920,
};

export interface SilhouetteCell {
  col: number;
  row: number;
  kind: "body" | "eye" | "pixel";
  name?: "Eye_L" | "Eye_R" | "Pixel_01" | "Pixel_02";
}

export function silhouetteCells(rows: readonly string[] = BIT_ROWS): SilhouetteCell[] {
  const eyeColumns = new Set<number>();
  rows.forEach((row) => {
    for (let col = 0; col < row.length; col += 1) {
      if (row[col] === "e") {
        eyeColumns.add(col);
      }
    }
  });
  const ordered = [...eyeColumns].sort((left, right) => left - right);
  let splitAt = ordered[Math.floor(ordered.length / 2)] ?? 0;
  let widestGap = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const gap = ordered[index] - ordered[index - 1];
    if (gap > widestGap) {
      widestGap = gap;
      splitAt = ordered[index];
    }
  }

  const cells: SilhouetteCell[] = [];
  rows.forEach((row, rowIndex) => {
    for (let col = 0; col < row.length; col += 1) {
      const mark = row[col];
      if (mark === "#") {
        cells.push({ col, row: rowIndex, kind: "body" });
      } else if (mark === "e") {
        cells.push({ col, row: rowIndex, kind: "eye", name: col < splitAt ? "Eye_L" : "Eye_R" });
      } else if (mark === "a") {
        cells.push({ col, row: rowIndex, kind: "pixel", name: "Pixel_01" });
      } else if (mark === "b") {
        cells.push({ col, row: rowIndex, kind: "pixel", name: "Pixel_02" });
      }
    }
  });
  return cells;
}
