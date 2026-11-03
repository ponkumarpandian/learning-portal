/**
 * FractionBar layout (pure, no React) — SPEC §7.5 Maths.
 *
 * Props: bars: [{ parts, shaded, label }] (one row each; `shaded` > `parts` draws extra wholes in the
 *        row, so 9/8 shows one full bar and 1/8 of the next) · sign ("+" "−" ">" "<" "=", drawn
 *        between the rows) · label (chip over the picture) · result (big text under the bars)
 */

export interface Bar {
  parts: number;
  shaded: number;
  label?: string;
}

export interface FractionBarScene {
  bars: Bar[];
  sign?: string;
  label?: string;
  result?: string;
}

export interface Cell {
  x: number;
  w: number;
  on: boolean;
}

export interface Row {
  y: number;
  label?: string;
  /** one rectangle per whole bar in the row */
  wholes: { x: number; w: number }[];
  cells: Cell[];
  /** draw the lines between cells (off when the cells get too thin to see) */
  dividers: boolean;
}

export interface FractionBarLayout {
  width: number;
  height: number;
  rowHeight: number;
  rows: Row[];
  signs: { x: number; y: number; text: string }[];
  result?: { x: number; y: number; text: string };
}

export const MAX_BARS = 6;
export const MAX_PARTS = 60;
export const MAX_WHOLES = 12;
const SIGNS: Record<string, string> = { '+': '+', '-': '−', '−': '−', '>': '>', '<': '<', '=': '=' };

const count = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : undefined;
/** Trimmed text, with a wider gap inside mixed numbers so "1 1/8" never reads as "11/8". */
const text = (v: unknown) =>
  typeof v === 'string' && v.trim() ? v.trim().replace(/(\d) (?=\d+\/\d)/g, '$1 ') : undefined;

/** Scene props → a safe scene (junk values are dropped, numbers clamped). */
export function parseFractionBar(props: Record<string, unknown>): FractionBarScene {
  const raw = Array.isArray(props.bars) ? props.bars : [];
  const bars: Bar[] = [];
  for (const b of raw.slice(0, MAX_BARS)) {
    if (!b || typeof b !== 'object') continue;
    const o = b as Record<string, unknown>;
    const parts = count(o.parts, 1, MAX_PARTS);
    if (parts === undefined) continue;
    const shaded = count(o.shaded, 0, parts * MAX_WHOLES) ?? 0;
    bars.push({ parts, shaded, label: text(o.label) });
  }
  const sign = typeof props.sign === 'string' ? SIGNS[props.sign.trim()] : undefined;
  return { bars, sign, label: text(props.label), result: text(props.result) };
}

export const VIEW_W = 400;
const BAR_X0 = 118;
const BAR_X1 = 390;
const ROW_H = 42;
const WHOLE_GAP = 8;

export function layoutFractionBar(scene: FractionBarScene): FractionBarLayout {
  const top = scene.label ? 58 : 16;
  const gap = scene.sign ? 40 : 18;
  const rows: Row[] = scene.bars.map((b, i) => {
    const y = top + i * (ROW_H + gap);
    const nWholes = Math.max(1, Math.ceil(b.shaded / b.parts));
    const wholeW = (BAR_X1 - BAR_X0 - (nWholes - 1) * WHOLE_GAP) / nWholes;
    const wholes = Array.from({ length: nWholes }, (_, k) => ({
      x: BAR_X0 + k * (wholeW + WHOLE_GAP),
      w: wholeW,
    }));
    const cellW = wholeW / b.parts;
    const cells = wholes.flatMap((wh, k) =>
      Array.from({ length: b.parts }, (_, c) => ({
        x: wh.x + c * cellW,
        w: cellW,
        on: k * b.parts + c < b.shaded,
      })),
    );
    return { y, label: b.label, wholes, cells, dividers: cellW >= 5 };
  });
  const signs =
    scene.sign === undefined
      ? []
      : rows.slice(1).map((r) => ({ x: (BAR_X0 + BAR_X1) / 2, y: r.y - gap / 2 + 9, text: scene.sign! }));
  const last = rows.at(-1);
  const barsBottom = last ? last.y + ROW_H : top - 16;
  const result = scene.result ? { x: VIEW_W / 2, y: barsBottom + 46, text: scene.result } : undefined;
  const height = Math.max(90, result ? result.y + 20 : barsBottom + 16);
  return { width: VIEW_W, height, rowHeight: ROW_H, rows, signs, result };
}

/** What a screen reader hears: "4/9 + 2/9 = 6/9 = 2/3". */
export function describeFractionBar(scene: FractionBarScene): string {
  const labels = scene.bars.map((b) => b.label ?? `${b.shaded} of ${b.parts} parts`);
  const joined = labels.join(scene.sign ? ` ${scene.sign} ` : ', ');
  const parts = [joined, scene.result && (joined ? `= ${scene.result.replace(/^=\s*/, '')}` : scene.result)]
    .filter(Boolean)
    .join(' ');
  return `Fraction bars${parts ? `: ${parts}` : ''}${scene.label ? ` (${scene.label})` : ''}`;
}
