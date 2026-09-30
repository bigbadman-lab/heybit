export interface GridPoint {
  c: number;
  y: number;
}

export interface TracedCells {
  loops: GridPoint[][];
}

/** Boundary loops of a cell set. Positive signed area is the outer contour. Negative area is a hole. */
export function traceCells(cells: readonly { col: number; row: number }[]): TracedCells {
  const edges = new Set<string>();
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    const forward = `${x1},${y1}>${x2},${y2}`;
    const back = `${x2},${y2}>${x1},${y1}`;
    if (edges.has(back)) {
      edges.delete(back);
    } else {
      edges.add(forward);
    }
  };

  for (const cell of cells) {
    const x = cell.col;
    const top = -cell.row;
    add(x, top - 1, x + 1, top - 1);
    add(x + 1, top - 1, x + 1, top);
    add(x + 1, top, x, top);
    add(x, top, x, top - 1);
  }

  const outgoing = new Map<string, GridPoint[]>();
  for (const edge of edges) {
    const [from, to] = edge.split(">");
    const [c, y] = to.split(",").map(Number);
    const list = outgoing.get(from) ?? [];
    list.push({ c, y });
    outgoing.set(from, list);
  }

  const used = new Set<string>();
  const loops: GridPoint[][] = [];
  for (const edge of edges) {
    if (used.has(edge)) {
      continue;
    }
    const [from, to] = edge.split(">");
    const [sc, sy] = from.split(",").map(Number);
    const [fc, fy] = to.split(",").map(Number);
    const start = { c: sc, y: sy };
    const loop = [start];
    used.add(edge);
    let prev = start;
    let current = { c: fc, y: fy };
    let guard = 0;
    while ((current.c !== start.c || current.y !== start.y) && guard < 8000) {
      guard += 1;
      loop.push(current);
      const options = outgoing.get(`${current.c},${current.y}`) ?? [];
      const incoming = Math.atan2(current.y - prev.y, current.c - prev.c);
      let best: GridPoint | null = null;
      let bestDelta = Infinity;
      let bestKey = "";
      for (const option of options) {
        const key = `${current.c},${current.y}>${option.c},${option.y}`;
        if (used.has(key)) {
          continue;
        }
        let delta = Math.atan2(option.y - current.y, option.c - current.c) - incoming;
        delta = (delta + Math.PI * 2) % (Math.PI * 2);
        if (delta === 0) {
          delta = Math.PI * 2;
        }
        if (delta < bestDelta) {
          bestDelta = delta;
          best = option;
          bestKey = key;
        }
      }
      if (!best) {
        break;
      }
      used.add(bestKey);
      prev = current;
      current = best;
    }
    if (loop.length >= 3) {
      loops.push(loop);
    }
  }
  return { loops };
}

export function signedArea(loop: readonly GridPoint[]): number {
  let sum = 0;
  for (let index = 0; index < loop.length; index += 1) {
    const current = loop[index];
    const next = loop[(index + 1) % loop.length];
    if (!current || !next) {
      continue;
    }
    sum += current.c * next.y - next.c * current.y;
  }
  return sum / 2;
}

export function worldPoint(point: GridPoint, cols: number, rows: number, cell: number): [number, number] {
  return [(point.c - cols / 2) * cell, (point.y + rows / 2) * cell];
}
