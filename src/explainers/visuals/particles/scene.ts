/**
 * ParticleBox: props → a pure scene layout (where every particle sits, which vessel, which extras).
 * The React component (../ParticleBox.tsx) only draws this and animates between layouts.
 */
import {
  BOTTLE_BIG,
  BOTTLE_IN_ROOM,
  ROOM,
  balloonVessel,
  blockBounds,
  bottleVessel,
  bowlVessel,
  clamp01,
  cupVessel,
  flaskVessel,
  gasFill,
  granularFill,
  heapPile,
  lensGrid,
  lerp,
  liquidFill,
  rectVessel,
  solidBlock,
  syringeGeom,
  syringeVessel,
  type BalloonShape,
  type MatterState,
  type Pt,
  type Rect,
  type SyringeGeom,
  type Vessel,
} from './layout';

export const CONTAINERS = [
  'none',
  'box',
  'cup',
  'bowl',
  'flask',
  'syringe',
  'balloon',
  'bottle',
  'room',
] as const;
export type ContainerKind = (typeof CONTAINERS)[number];
export const OBJECTS = ['cup', 'saucer', 'knife', 'spoon', 'stool'] as const;
export type ObjectKind = (typeof OBJECTS)[number];
export const HIGHLIGHTS = ['molecules', 'force', 'space'] as const;
export type Highlight = (typeof HIGHLIGHTS)[number];
export const ROWS = ['shape-volume', 'position', 'compression', 'flow', 'spaces-forces', 'surfaces'] as const;
export type CompareRow = (typeof ROWS)[number];
export const STATES: readonly MatterState[] = ['solid', 'liquid', 'gas'];

/** Every particle slot that is ever drawn (unused ones fade out where they are). */
export const N_MAX = 48;

export interface ParticleProps {
  state: MatterState;
  temperature?: number;
  container: ContainerKind;
  objects: ObjectKind[];
  load: boolean;
  heaped: boolean;
  compress: number;
  pushing: boolean;
  shape: BalloonShape;
  spread: number;
  highlight?: Highlight;
  gap?: number;
  zoom: boolean;
  label?: string;
  glow: boolean;
  viscous: boolean;
  compare: boolean;
  row: CompareRow;
}

const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback;
const optOneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : undefined;
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Reads the free-form scene props (unknown values fall back to safe defaults; never throws). */
export function parseProps(p: Record<string, unknown>): ParticleProps {
  return {
    state: oneOf(STATES, p.state, 'solid'),
    temperature: num(p.temperature),
    container: oneOf(CONTAINERS, p.container, 'box'),
    objects: Array.isArray(p.objects)
      ? p.objects.filter((o): o is ObjectKind => optOneOf(OBJECTS, o) !== undefined)
      : [],
    load: p.load === true,
    heaped: p.heaped === true,
    compress: clamp01(num(p.compress) ?? 0),
    pushing: p.pushing === true,
    shape: oneOf(['round', 'long', 'wavy'] as const, p.shape, 'round'),
    spread: clamp01(num(p.spread) ?? 0),
    highlight: optOneOf(HIGHLIGHTS, p.highlight),
    gap: num(p.gap) === undefined ? undefined : clamp01(num(p.gap)!),
    zoom: p.zoom === true,
    label: typeof p.label === 'string' && p.label.trim() ? p.label.trim() : undefined,
    glow: p.glow === true,
    viscous: p.viscous === true,
    compare: p.compare === true,
    row: oneOf(ROWS, p.row, 'shape-volume'),
  };
}

export type Idle = 'jiggle' | 'slide' | 'zoom' | 'stream' | 'burst' | 'none';

export type Mode =
  'vessel' | 'objects' | 'stool' | 'lens' | 'heap' | 'free' | 'block' | 'gap' | 'plasma' | 'flow';

export interface Layout {
  mode: Mode;
  container: ContainerKind;
  vessel?: Vessel;
  r: number;
  /** N_MAX positions; slots ≥ `count` are hidden */
  pts: Pt[];
  count: number;
  idle: Idle;
  /** per particle, loop offsets for the idle motion (zoom/stream/burst) */
  loops?: Pt[][];
  /** liquid free surface (y) */
  level?: number;
  syringe?: SyringeGeom;
  /** solid block outline (own shape / free surfaces) */
  block?: Rect;
  /** stool scene / lens view */
  lens?: { cx: number; cy: number; R: number };
  /** two-molecule demo */
  pair?: { a: Pt; b: Pt; gap: number };
}

const hideRest = (pts: Pt[]): Pt[] => {
  const n = pts.length || 1;
  return Array.from({ length: N_MAX }, (_, i) => pts[i] ?? pts[i % n] ?? { x: 200, y: 150 });
};

/** Gas loop: 3 other places inside the vessel to zoom through, as offsets from the base point. */
function gasLoops(v: Vessel, base: readonly Pt[], r: number, scale = 1): Pt[][] {
  const sets = [101, 211, 307].map((seed) => gasFill(v, base.length, r, seed));
  return base.map((p, i) =>
    sets.map((s, k) => {
      const q = s[(i * 5 + k * 3) % s.length] ?? p;
      return { x: (q.x - p.x) * scale, y: (q.y - p.y) * scale };
    }),
  );
}

/* ---------- single view (400 × 300) ---------- */

export const SINGLE_VESSELS: Record<Exclude<ContainerKind, 'syringe' | 'balloon'>, () => Vessel> = {
  none: () => rectVessel('none', { x0: 30, y0: 40, x1: 370, y1: 270 }),
  box: () => rectVessel('box', { x0: 108, y0: 60, x1: 292, y1: 252 }),
  cup: () => cupVessel([126, 274], [146, 254], 104, 252),
  bowl: () => bowlVessel(200, 126, 142, 126),
  flask: () => flaskVessel(),
  bottle: () => bottleVessel(BOTTLE_BIG),
  room: () => rectVessel('room', ROOM, 10),
};

export const LENS_SIDE = { cx: 318, cy: 150, R: 66 } as const;

function vesselFor(p: ParticleProps): Vessel {
  if (p.container === 'balloon') return balloonVessel(p.shape);
  if (p.container === 'syringe') return syringeVessel(syringeGeom(false, 0));
  return SINGLE_VESSELS[p.container]();
}

export function singleLayout(p: ParticleProps): Layout {
  const base = { container: p.container };

  if (p.gap !== undefined) {
    const d = 90 + p.gap * 190;
    return {
      ...base,
      mode: 'gap',
      r: 26,
      count: 2,
      idle: 'none',
      pts: hideRest([
        { x: 200 - d / 2, y: 160 },
        { x: 200 + d / 2, y: 160 },
      ]),
      pair: { a: { x: 200 - d / 2, y: 160 }, b: { x: 200 + d / 2, y: 160 }, gap: p.gap },
    };
  }

  if (p.glow) {
    const v = SINGLE_VESSELS.none();
    const pts = gasFill(v, 16, 11);
    return {
      ...base,
      mode: 'plasma',
      vessel: v,
      r: 11,
      count: 16,
      idle: 'zoom',
      pts: hideRest(pts),
      loops: gasLoops(v, pts, 11),
    };
  }

  if (p.zoom) {
    const lens = { cx: 252, cy: 154, R: 108 };
    const pts = lensGrid(N_MAX, lens.cx, lens.cy, lens.R, 15);
    return {
      ...base,
      mode: 'lens',
      lens,
      r: 14,
      count: pts.length,
      idle: p.state === 'solid' ? 'jiggle' : 'slide',
      pts: hideRest(pts),
    };
  }

  if (p.state === 'solid' && p.container === 'none') {
    if (p.objects.includes('stool')) {
      const pts = lensGrid(N_MAX, LENS_SIDE.cx, LENS_SIDE.cy, LENS_SIDE.R, 8.5);
      return {
        ...base,
        mode: 'stool',
        lens: LENS_SIDE,
        r: 8.5,
        count: pts.length,
        idle: 'jiggle',
        pts: hideRest(pts),
      };
    }
    if (p.objects.length) {
      const pts = lensGrid(N_MAX, LENS_SIDE.cx, LENS_SIDE.cy, LENS_SIDE.R, 8.5);
      return {
        ...base,
        mode: 'objects',
        lens: LENS_SIDE,
        r: 8.5,
        count: pts.length,
        idle: 'jiggle',
        pts: hideRest(pts),
      };
    }
    if (p.heaped) {
      const pts = heapPile(36, 200, 246, 8);
      return { ...base, mode: 'heap', r: 8, count: pts.length, idle: 'jiggle', pts: hideRest(pts) };
    }
    const pts = solidBlock(36, 6, 200, 252, 9.5);
    return {
      ...base,
      mode: 'block',
      r: 9.5,
      count: 36,
      idle: 'jiggle',
      pts: hideRest(pts),
      block: blockBounds(pts, 9.5),
    };
  }

  if (p.state === 'gas' && p.container === 'room') {
    const room = SINGLE_VESSELS.room();
    const bottle = bottleVessel(BOTTLE_IN_ROOM);
    const n = 14;
    const inRoom = gasFill(room, n, 8);
    const inBottle = gasFill(bottle, n, 3);
    const pts = inRoom.map((q, i) => {
      const b = inBottle[i] ?? q;
      return { x: lerp(b.x, q.x, p.spread), y: lerp(b.y, q.y, p.spread) };
    });
    return {
      ...base,
      mode: 'vessel',
      vessel: room,
      r: 8,
      count: n,
      idle: 'zoom',
      pts: hideRest(pts),
      loops: gasLoops(room, inRoom, 8, Math.max(0.08, p.spread)),
    };
  }

  // syringe: the plunger rests on a liquid; it moves in for a gas
  if (p.container === 'syringe') {
    if (p.state === 'liquid') {
      const v0 = syringeVessel(syringeGeom(false, 0));
      const { pts, level } = liquidFill(v0, 14, 8);
      const g = { ...syringeGeom(false, 0), head: level - 1 };
      return {
        ...base,
        mode: 'vessel',
        vessel: syringeVessel(g),
        syringe: g,
        r: 8,
        count: pts.length,
        idle: 'slide',
        pts: hideRest(pts),
        level,
      };
    }
    const g = syringeGeom(false, p.state === 'gas' ? p.compress : 0.45);
    const v = syringeVessel(g);
    if (p.state === 'solid') {
      const pts = solidBlock(18, 3, 200, v.floor + 4, 9);
      return {
        ...base,
        mode: 'vessel',
        vessel: v,
        syringe: g,
        r: 9,
        count: 18,
        idle: 'jiggle',
        pts: hideRest(pts),
        block: blockBounds(pts, 9),
      };
    }
    const pts = gasFill(v, 12, 8);
    return {
      ...base,
      mode: 'vessel',
      vessel: v,
      syringe: g,
      r: 8,
      count: 12,
      idle: 'zoom',
      pts: hideRest(pts),
      loops: gasLoops(v, pts, 8),
    };
  }

  if (p.state === 'solid' && p.heaped) {
    const pts = heapPile(36, 200, 246, 8);
    return { ...base, mode: 'heap', r: 8, count: pts.length, idle: 'jiggle', pts: hideRest(pts) };
  }

  const v = vesselFor(p);

  if (p.state === 'solid') {
    if (p.container === 'bowl' || p.container === 'cup') {
      const pts = granularFill(v, 36, 8);
      return {
        ...base,
        mode: 'vessel',
        vessel: v,
        r: 8,
        count: pts.length,
        idle: 'jiggle',
        pts: hideRest(pts),
      };
    }
    const pts = solidBlock(36, 6, 200, v.floor + 3, 9.5);
    return {
      ...base,
      mode: 'vessel',
      vessel: v,
      r: 9.5,
      count: 36,
      idle: 'jiggle',
      pts: hideRest(pts),
      block: blockBounds(pts, 9.5),
    };
  }

  if (p.state === 'liquid') {
    // force / space highlights open the rows up a little so the springs and gaps can be seen;
    // a poured liquid keeps the same number of particles (the same volume) in every vessel
    const spaced = p.highlight === 'space' || p.highlight === 'force';
    const n = p.container === 'box' || p.container === 'none' ? 36 : 20;
    const { pts, level } = liquidFill(v, n, spaced ? 8 : 9, spaced ? 9 : 3.5);
    return {
      ...base,
      mode: 'vessel',
      vessel: v,
      r: spaced ? 8 : 9,
      count: pts.length,
      idle: 'slide',
      pts: hideRest(pts),
      level,
    };
  }

  const n = p.container === 'none' ? 12 : 12;
  const pts = gasFill(v, n, 8.5);
  return {
    ...base,
    mode: p.container === 'none' ? 'free' : 'vessel',
    vessel: v,
    r: 8.5,
    count: n,
    idle: 'zoom',
    pts: hideRest(pts),
    loops: gasLoops(v, pts, 8.5),
  };
}

/* ---------- compare panels (200 × 240) ---------- */

export const PANEL_BOX: Rect = { x0: 16, y0: 22, x1: 184, y1: 222 };
export const PANEL_RAMP = { from: { x: 14, y: 70 }, to: { x: 128, y: 176 } } as const;
export const PANEL_POOL: Rect = { x0: 112, y0: 150, x1: 190, y1: 226 };
export const PANEL_CENTRE = { x: 100, y: 124 } as const;

export function panelLayout(row: CompareRow, state: MatterState, compress: number): Layout {
  const box = rectVessel('box', PANEL_BOX);
  const base = { container: 'box' as ContainerKind };

  if (row === 'compression') {
    if (state === 'solid') {
      const g0 = syringeGeom(true, 0);
      const pts = solidBlock(12, 3, 100, g0.barrel.y1 - 4, 7.5);
      const blk = blockBounds(pts, 7.5);
      const g = { ...g0, head: blk.y0 - 1 };
      return {
        ...base,
        container: 'syringe',
        mode: 'vessel',
        vessel: syringeVessel(g),
        syringe: g,
        r: 7.5,
        count: 12,
        idle: 'jiggle',
        pts: hideRest(pts),
        block: blk,
      };
    }
    if (state === 'liquid') {
      const v0 = syringeVessel(syringeGeom(true, 0));
      const { pts, level } = liquidFill(v0, 12, 7.5);
      const g = { ...syringeGeom(true, 0), head: level - 1 + compress * 6 };
      return {
        ...base,
        container: 'syringe',
        mode: 'vessel',
        vessel: syringeVessel(g),
        syringe: g,
        r: 7.5,
        count: pts.length,
        idle: 'slide',
        pts: hideRest(pts),
        level,
      };
    }
    const g = syringeGeom(true, 0.05 + compress);
    const v = syringeVessel(g);
    const pts = gasFill(v, 7, 7);
    return {
      ...base,
      container: 'syringe',
      mode: 'vessel',
      vessel: v,
      syringe: g,
      r: 7,
      count: 7,
      idle: 'zoom',
      pts: hideRest(pts),
      loops: gasLoops(v, pts, 7),
    };
  }

  if (row === 'flow') {
    if (state === 'solid') {
      const pts = heapPile(15, 100, 210, 8);
      return {
        ...base,
        container: 'none',
        mode: 'heap',
        r: 8,
        count: pts.length,
        idle: 'jiggle',
        pts: hideRest(pts),
      };
    }
    if (state === 'liquid') {
      const pool = rectVessel('pool', PANEL_POOL);
      const { pts: poolPts, level } = liquidFill(pool, 10, 7);
      const { from, to } = PANEL_RAMP;
      const len = Math.hypot(to.x - from.x, to.y - from.y);
      const ux = (to.x - from.x) / len;
      const uy = (to.y - from.y) / len;
      const step = 22;
      const stream: Pt[] = [];
      for (let t = 10; t < len - 6; t += step)
        stream.push({ x: from.x + ux * t + uy * 9, y: from.y + uy * t - ux * 9 });
      const pts = [...stream, ...poolPts];
      const loops = pts.map((_, i) =>
        i < stream.length ? [{ x: ux * step, y: uy * step }] : [{ x: 0, y: 0 }],
      );
      return {
        ...base,
        container: 'none',
        mode: 'flow',
        r: 7,
        count: pts.length,
        idle: 'stream',
        pts: hideRest(pts),
        loops,
        level,
      };
    }
    const n = 8;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { x: PANEL_CENTRE.x + Math.cos(a) * 26, y: PANEL_CENTRE.y + Math.sin(a) * 26 };
    });
    const loops = pts.map((q) => [{ x: (q.x - PANEL_CENTRE.x) * 2.3, y: (q.y - PANEL_CENTRE.y) * 2.3 }]);
    return {
      ...base,
      container: 'none',
      mode: 'flow',
      r: 7,
      count: n,
      idle: 'burst',
      pts: hideRest(pts),
      loops,
    };
  }

  const spaced = row === 'spaces-forces';
  if (state === 'solid') {
    const pts = solidBlock(16, 4, 100, box.floor + 2, 9, spaced ? 4.5 : 1.5);
    return {
      ...base,
      mode: 'vessel',
      vessel: box,
      r: 9,
      count: 16,
      idle: 'jiggle',
      pts: hideRest(pts),
      block: blockBounds(pts, 9),
    };
  }
  if (state === 'liquid') {
    const r = spaced ? 7 : 8;
    const { pts: loose, level } = liquidFill(box, 20, r, spaced ? 11 : 3.5);
    return {
      ...base,
      mode: 'vessel',
      vessel: box,
      r,
      count: loose.length,
      idle: 'slide',
      pts: hideRest(loose),
      level,
    };
  }
  const pts = gasFill(box, 7, 8);
  return {
    ...base,
    mode: 'vessel',
    vessel: box,
    r: 8,
    count: 7,
    idle: 'zoom',
    pts: hideRest(pts),
    loops: gasLoops(box, pts, 8),
  };
}

/** Heat 0..1 from °C (−10 → 0, 110 → 1); particles move faster when hotter. */
export function heat(temperature: number | undefined): number {
  return temperature === undefined ? 0.35 : clamp01((temperature + 10) / 120);
}
