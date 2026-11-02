/**
 * ParticleBox geometry — pure functions (no React): vessel shapes and where particles sit.
 *
 * Coordinates are SVG user units. The single view is 400 × 300; a compare panel is 200 × 240.
 * Placement is deterministic (no Math.random) so a scene always looks the same and tests are stable.
 *  - solid:  a tight square block that keeps its own shape (or granules filling a bowl: sugar)
 *  - liquid: hexagonal-ish rows from the bottom up, a little irregular, with ONE flat top; the same
 *            number of particles in every vessel, so the volume stays the same when it is poured
 *  - gas:    a few particles spread over the whole space (low-discrepancy points)
 */

export type MatterState = 'solid' | 'liquid' | 'gas';
export interface Pt {
  x: number;
  y: number;
}
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Vessel {
  kind: string;
  /** is (x, y) inside the space the matter can occupy */
  inside(x: number, y: number): boolean;
  bounds: Rect;
  /** y of the floor the matter rests on */
  floor: number;
}

export const VIEW = { w: 400, h: 300 } as const;
export const PANEL = { w: 200, h: 240 } as const;

/* ---------- helpers ---------- */

export function halton(index: number, base: number): number {
  let f = 1;
  let r = 0;
  let i = index;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

/** Deterministic jitter in [-1, 1] for particle i. */
export function jitter(i: number, salt = 0): number {
  return halton(i * 7 + 3 + salt, 5) * 2 - 1;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function fits(v: Vessel, x: number, y: number, r: number): boolean {
  return (
    v.inside(x, y) && v.inside(x - r, y) && v.inside(x + r, y) && v.inside(x, y + r) && v.inside(x, y - r)
  );
}

/** Pairs of particles closer than `maxDist` (for force springs). */
export function neighbours(pts: readonly Pt[], maxDist: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i]!;
      const b = pts[j]!;
      if (Math.hypot(a.x - b.x, a.y - b.y) <= maxDist) out.push([i, j]);
    }
  return out;
}

/* ---------- vessels ---------- */

export function rectVessel(kind: string, r: Rect, inset = 4): Vessel {
  return {
    kind,
    bounds: r,
    floor: r.y1 - inset,
    inside: (x, y) => x > r.x0 + inset && x < r.x1 - inset && y > r.y0 + inset && y < r.y1 - inset,
  };
}

/** A tapered cup / mug: top edge wider than the bottom. */
export function cupVessel(top: [number, number], bottom: [number, number], y0: number, y1: number): Vessel {
  return {
    kind: 'cup',
    bounds: { x0: top[0], y0, x1: top[1], y1 },
    floor: y1 - 4,
    inside: (x, y) => {
      if (y <= y0 || y >= y1 - 4) return false;
      const t = (y - y0) / (y1 - y0);
      return x > lerp(top[0], bottom[0], t) + 5 && x < lerp(top[1], bottom[1], t) - 5;
    },
  };
}

export function bowlVessel(cx: number, rimY: number, rx: number, ry: number): Vessel {
  return {
    kind: 'bowl',
    bounds: { x0: cx - rx, y0: rimY, x1: cx + rx, y1: rimY + ry },
    floor: rimY + ry - 4,
    inside: (x, y) => y > rimY && ((x - cx) / (rx - 5)) ** 2 + ((y - rimY) / (ry - 5)) ** 2 < 1,
  };
}

export function flaskVessel(): Vessel {
  const neck = { x0: 180, x1: 220, top: 44, shoulder: 118 };
  const bottom = 252;
  return {
    kind: 'flask',
    bounds: { x0: 100, y0: neck.top, x1: 300, y1: bottom },
    floor: bottom - 4,
    inside: (x, y) => {
      if (y <= neck.top || y >= bottom - 4) return false;
      if (y < neck.shoulder) return x > neck.x0 + 4 && x < neck.x1 - 4;
      const half = 20 + ((y - neck.shoulder) / (bottom - neck.shoulder)) * 80 - 5;
      return Math.abs(x - 200) < half;
    },
  };
}

export interface SyringeGeom {
  barrel: Rect;
  /** y of the plunger head's lower face */
  head: number;
  nozzle: Rect;
}

export function syringeGeom(panel: boolean, headFrac: number): SyringeGeom {
  const barrel = panel ? { x0: 70, y0: 44, x1: 130, y1: 206 } : { x0: 166, y0: 56, x1: 234, y1: 244 };
  const span = barrel.y1 - barrel.y0;
  const head = barrel.y0 + 8 + clamp01(headFrac) * span * 0.9;
  const cx = (barrel.x0 + barrel.x1) / 2;
  const nozzle = { x0: cx - 6, y0: barrel.y1, x1: cx + 6, y1: barrel.y1 + (panel ? 16 : 22) };
  return { barrel, head, nozzle };
}

export function syringeVessel(g: SyringeGeom): Vessel {
  return {
    kind: 'syringe',
    bounds: { x0: g.barrel.x0, y0: g.head, x1: g.barrel.x1, y1: g.barrel.y1 },
    floor: g.barrel.y1 - 4,
    inside: (x, y) => x > g.barrel.x0 + 4 && x < g.barrel.x1 - 4 && y > g.head + 3 && y < g.barrel.y1 - 3,
  };
}

/* ---------- balloon (shape: round / long / wavy) ---------- */

export type BalloonShape = 'round' | 'long' | 'wavy';
export const BALLOON_CENTER = { x: 200, y: 146 } as const;

/** Balloon outline radius at angle θ (0 = right, π/2 = down in SVG). */
export function balloonRadius(shape: BalloonShape, theta: number): number {
  const ellipse = (rx: number, ry: number) =>
    (rx * ry) / Math.sqrt((ry * Math.cos(theta)) ** 2 + (rx * Math.sin(theta)) ** 2);
  if (shape === 'long') return ellipse(166, 60);
  if (shape === 'wavy') return ellipse(96, 100) * (1 + 0.13 * Math.sin(6 * theta));
  return ellipse(94, 106);
}

/** Smooth closed path with a fixed number of points, so framer-motion can morph between shapes. */
export function balloonPath(
  shape: BalloonShape,
  cx: number = BALLOON_CENTER.x,
  cy: number = BALLOON_CENTER.y,
): string {
  const n = 48;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const r = balloonRadius(shape, th);
    pts.push({ x: cx + r * Math.cos(th), y: cy + r * Math.sin(th) });
  }
  // Catmull-Rom → cubic Bézier
  let d = `M${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return `${d} Z`;
}

export function balloonVessel(shape: BalloonShape): Vessel {
  const { x: cx, y: cy } = BALLOON_CENTER;
  const rMax = shape === 'long' ? 166 : 110;
  return {
    kind: 'balloon',
    bounds: { x0: cx - rMax, y0: cy - rMax, x1: cx + rMax, y1: cy + rMax },
    floor: cy + 100,
    inside: (x, y) => Math.hypot(x - cx, y - cy) < balloonRadius(shape, Math.atan2(y - cy, x - cx)) - 6,
  };
}

/* ---------- scent bottle (drawn in local coords around 0,0) ---------- */

export const BOTTLE_BIG = { x: 200, y: 160, s: 1 } as const;
export const BOTTLE_IN_ROOM = { x: 84, y: 205, s: 0.34 } as const;

export function bottleVessel(at: { x: number; y: number; s: number }): Vessel {
  const toLocal = (x: number, y: number) => ({ x: (x - at.x) / at.s, y: (y - at.y) / at.s });
  return {
    kind: 'bottle',
    bounds: { x0: at.x - 62 * at.s, y0: at.y - 78 * at.s, x1: at.x + 62 * at.s, y1: at.y + 90 * at.s },
    floor: at.y + 86 * at.s,
    inside: (x, y) => {
      const p = toLocal(x, y);
      if (p.y > -36 && p.y < 84) return Math.abs(p.x) < 56;
      return p.y > -74 && p.y <= -36 && Math.abs(p.x) < 16;
    },
  };
}

export const ROOM: Rect = { x0: 16, y0: 26, x1: 384, y1: 266 };

/* ---------- placement ---------- */

/** Solid: a tight block of `rows × cols` resting on `floorY`, centred on cx. */
export function solidBlock(n: number, cols: number, cx: number, floorY: number, r: number, gap = 1.5): Pt[] {
  const d = 2 * r + gap;
  const rows = Math.ceil(n / cols);
  const pts: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const row = Math.floor(k / cols);
    const col = k % cols;
    pts.push({ x: cx + (col - (cols - 1) / 2) * d, y: floorY - r - (rows - 1 - row) * d });
  }
  return pts;
}

/** Bounding box of a solid block (for outlines / free-surface highlights). */
export function blockBounds(pts: readonly Pt[], r: number): Rect {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return {
    x0: Math.min(...xs) - r - 4,
    y0: Math.min(...ys) - r - 4,
    x1: Math.max(...xs) + r + 4,
    y1: Math.max(...ys) + r + 4,
  };
}

/** Row positions across a vessel at height y (centred), spacing d. */
function rowXs(v: Vessel, y: number, r: number, d: number, offset: number): number[] {
  const { x0, x1 } = v.bounds;
  let left = Infinity;
  let right = -Infinity;
  for (let x = x0; x <= x1; x += 1) {
    if (fits(v, x, y, r)) {
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  if (!Number.isFinite(left)) return [];
  const count = Math.floor((right - left - offset) / d) + 1;
  if (count < 1) return [];
  const used = (count - 1) * d;
  const start = (left + right) / 2 - used / 2 + offset / 2;
  return Array.from({ length: count }, (_, i) => start + i * d);
}

/** Fill rows bottom-up; the last (top) row is filled centre-out so it stays symmetric. */
function fillRows(
  v: Vessel,
  n: number,
  r: number,
  d: number,
  rowH: number,
  hex: boolean,
): { pts: Pt[]; topY: number } {
  const pts: Pt[] = [];
  let y = v.floor - r - 1;
  let row = 0;
  let topY = y;
  while (pts.length < n && y > v.bounds.y0 - r) {
    const xs = rowXs(v, y, r, d, hex && row % 2 ? d / 2 : 0);
    if (xs.length) {
      const mid = (xs.length - 1) / 2;
      const order = xs.map((x, i) => ({ x, k: Math.abs(i - mid) })).sort((a, b) => a.k - b.k);
      for (const o of order) {
        if (pts.length >= n) break;
        pts.push({ x: o.x, y });
      }
      topY = y;
    }
    y -= rowH;
    row++;
  }
  return { pts, topY };
}

/** Liquid: close but irregular rows, one flat free surface at `level`. */
export function liquidFill(v: Vessel, n: number, r: number, gap = 3.5): { pts: Pt[]; level: number } {
  const d = 2 * r + gap;
  const { pts, topY } = fillRows(v, n, r, d, d * 0.88, true);
  const jittered = pts.map((p, i) => ({ x: p.x + jitter(i) * 2.2, y: p.y + jitter(i, 11) * 1.6 }));
  return { pts: jittered, level: topY - r - 4 };
}

/** Granular solid (sugar in a bowl): a tight square grid that follows the vessel. */
export function granularFill(v: Vessel, n: number, r: number): Pt[] {
  const d = 2 * r + 1.5;
  return fillRows(v, n, r, d, d, false).pts;
}

/** Gas: n particles spread over the vessel, far apart. `seed` gives other arrangements (waypoints). */
export function gasFill(v: Vessel, n: number, r: number, seed = 0): Pt[] {
  const { x0, y0, x1, y1 } = v.bounds;
  const pts: Pt[] = [];
  let minD = Math.max(2 * r + 6, Math.sqrt(((x1 - x0) * (y1 - y0)) / Math.max(1, n)) * 0.55);
  let tries = 0;
  for (let i = 1; pts.length < n && i < 5000; i++) {
    const x = x0 + halton(i + seed, 2) * (x1 - x0);
    const y = y0 + halton(i + seed, 3) * (y1 - y0);
    tries++;
    if (tries > 300) {
      minD *= 0.8;
      tries = 0;
    }
    if (!fits(v, x, y, r)) continue;
    if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < minD)) continue;
    pts.push({ x, y });
    tries = 0;
  }
  while (pts.length < n)
    pts.push(pts[pts.length % Math.max(1, pts.length)] ?? { x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
  return pts;
}

/** Sugar heaped on a plate: rows that get shorter towards the top. */
export function heapPile(n: number, cx: number, floorY: number, r: number): Pt[] {
  const d = 2 * r + 1;
  const pts: Pt[] = [];
  let width = 1;
  while ((width * (width + 1)) / 2 < n) width++;
  let row = 0;
  for (let w = width; w > 0 && pts.length < n; w--, row++) {
    for (let i = 0; i < w && pts.length < n; i++) {
      pts.push({ x: cx + (i - (w - 1) / 2) * d, y: floorY - r - row * d * 0.86 });
    }
  }
  return pts;
}

/** Tight grid filling a round lens (the "zoom in" view); edge particles are clipped by the lens. */
export function lensGrid(n: number, cx: number, cy: number, R: number, r: number): Pt[] {
  const d = 2 * r + 2;
  const pts: Pt[] = [];
  const span = Math.floor(R / d) + 1;
  for (let row = -span; row <= span; row++)
    for (let col = -span; col <= span; col++) {
      const x = cx + col * d;
      const y = cy + row * d;
      if (Math.hypot(x - cx, y - cy) <= R + r * 0.4) pts.push({ x, y });
    }
  pts.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  return pts.slice(0, n);
}
