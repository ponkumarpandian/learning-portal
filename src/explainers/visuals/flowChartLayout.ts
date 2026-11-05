/**
 * FlowChart layout (pure, no React) — SPEC §7.5 History/Civics, and any "steps or parts" idea.
 *
 * Boxes from top to bottom, joined by down arrows (a sequence: a timeline, a process, causes → effect)
 * or without arrows (a set: the key elements of a democracy, the parts of a city).
 * Props: nodes (1–6 short texts, in the book's words) · arrows (default true) · highlight (an index,
 *        a list of indexes, or "all") · label (chip, e.g. "p.28")
 * A box's text wraps onto as many lines as it needs, so the box grows; nothing runs past an edge.
 */

export interface FlowScene {
  nodes: string[];
  arrows: boolean;
  highlight: number[];
  label?: string;
}

export const MAX_NODES = 6;
/** Characters per line at 22px in a 368-wide box (Baloo/Nunito average ≈ 11px a character). */
export const LINE_CHARS = 28;

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export function parseFlow(props: Record<string, unknown>): FlowScene {
  const raw = Array.isArray(props.nodes) ? props.nodes : [];
  const nodes = raw
    .map(text)
    .filter((t): t is string => !!t)
    .slice(0, MAX_NODES);
  const h = props.highlight;
  const all = nodes.map((_, i) => i);
  const picked = h === 'all' ? all : Array.isArray(h) ? h : typeof h === 'number' ? [h] : [];
  const highlight = [...new Set(picked)].filter(
    (i): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < nodes.length,
  );
  return { nodes, arrows: props.arrows !== false, highlight, label: text(props.label) };
}

/** Greedy word wrap; a single word longer than a line gets a line of its own. */
export function wrap(s: string, max = LINE_CHARS): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of s.split(/\s+/)) {
    if (!cur) cur = word;
    else if (`${cur} ${word}`.length <= max) cur = `${cur} ${word}`;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export interface FlowBox {
  index: number;
  lines: string[];
  x: number;
  y: number;
  w: number;
  h: number;
  on: boolean;
}

export interface FlowLayout {
  width: number;
  height: number;
  boxes: FlowBox[];
  arrows: { x: number; y1: number; y2: number }[];
}

export const VIEW_W = 400;
const X = 16;
const W = 368;
const LINE_H = 27;
const PAD_Y = 16;
const GAP_ARROW = 30;
const GAP_PLAIN = 14;

export function layoutFlow(scene: FlowScene): FlowLayout {
  const top = scene.label ? 76 : 14;
  const gap = scene.arrows ? GAP_ARROW : GAP_PLAIN;
  const on = new Set(scene.highlight);
  const boxes: FlowBox[] = [];
  let y = top;
  scene.nodes.forEach((n, index) => {
    const lines = wrap(n);
    const h = PAD_Y * 2 + lines.length * LINE_H;
    boxes.push({ index, lines, x: X, y, w: W, h, on: on.has(index) });
    y += h + gap;
  });
  const arrows = scene.arrows
    ? boxes.slice(1).map((b) => ({ x: X + W / 2, y1: b.y - gap + 4, y2: b.y - 4 }))
    : [];
  const last = boxes.at(-1);
  return { width: VIEW_W, height: (last ? last.y + last.h : top) + 14, boxes, arrows };
}

/** What a screen reader hears. */
export function describeFlow(scene: FlowScene): string {
  if (!scene.nodes.length) return scene.label ? `${scene.label}.` : 'A flow chart.';
  const kind = scene.arrows ? 'Flow chart, step by step' : 'Chart';
  const parts = [`${kind}: ${scene.nodes.join(scene.arrows ? ', then ' : '; ')}`];
  if (scene.highlight.length) parts.push(`Showing: ${scene.highlight.map((i) => scene.nodes[i]).join('; ')}`);
  if (scene.label) parts.push(scene.label);
  return parts.join('. ') + '.';
}
