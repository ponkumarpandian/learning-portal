import { useCallback, useLayoutEffect, useRef } from 'react';
import { RestStop } from './RestStop';
import { Stone, type StoneState } from './Stone';
import type { ColourVars } from './colours';
import { trailPath } from './trailPath';

export type TrailItem =
  | {
      type: 'stone';
      key: string;
      name: string;
      emoji: string;
      time: string;
      state: StoneState;
      vars: ColourVars;
      onSelect?: () => void;
    }
  | {
      type: 'rest';
      key: string;
      label: string;
      emoji: string;
      time: string;
      vars?: ColourVars;
      end?: boolean;
      onSelect?: () => void;
    };

export interface TrailProps {
  items: TrailItem[];
  label: string;
  /** Any value that changes the size of labels (e.g. the text size) to force a re-layout */
  relayoutKey?: unknown;
}

/** Zig-zag offsets 50% → 74% → 50% → 26% (§15.3). */
const OFFSETS = [0.5, 0.74, 0.5, 0.26] as const;
const GAP = 22;
const HALO = 18;

interface Metrics {
  above: number;
  below: number;
  half: number;
  now: boolean;
}

function measure(node: HTMLElement): Metrics {
  const rest = node.querySelector<HTMLElement>('.rest');
  if (rest) {
    const h = rest.offsetHeight;
    return { above: h / 2, below: h / 2 + 6, half: rest.offsetWidth / 2, now: false };
  }
  const stone = node.querySelector<HTMLElement>('.stone');
  const label = node.querySelector<HTMLElement>('.stone-label');
  const tag = node.querySelector<HTMLElement>('.tag');
  const size = stone?.offsetWidth ?? 0;
  const now = stone?.classList.contains('now') ?? false;
  const halo = now ? HALO : 0;
  const labelH = label?.offsetHeight ?? 0;
  return {
    above: size / 2 + halo + (tag ? tag.offsetHeight + 4 : 0),
    below: size / 2 + 14 + labelH + 4,
    half: Math.max(size / 2 + halo, (label?.offsetWidth ?? 0) / 2, (tag?.offsetWidth ?? 0) / 2),
    now,
  };
}

/**
 * Today's trail (§15.3): stones and rest stops on a winding SVG path drawn in two layers
 * (a wide soft ground stroke + the kolam dotted line). The walked part (start → now stone) is
 * repeated in gold. Layout is measured, so nothing overlaps at any width or text size; it re-runs
 * on resize (ResizeObserver), when fonts load and when `relayoutKey` changes.
 */
export function Trail({ items, label, relayoutKey }: TrailProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<SVGPathElement>(null);
  const dotsRef = useRef<SVGPathElement>(null);
  const walkedRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const layout = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const W = host.clientWidth;
    if (!W) return; // not visible / no layout engine (tests)
    const nodes = Array.from(host.querySelectorAll<HTMLElement>(':scope .node'));
    let y = 8;
    let nowIdx = -1;
    const pts = nodes.map((n, i) => {
      const m = measure(n);
      y += m.above;
      const x = Math.min(Math.max(W * OFFSETS[i % 4]!, m.half + 2), W - m.half - 2);
      n.style.left = `${x}px`;
      n.style.top = `${y}px`;
      if (m.now) nowIdx = i;
      const p = [x, y] as const;
      y += m.below + GAP;
      return p;
    });
    const H = Math.max(y - GAP + 8, 0);
    host.style.height = `${H}px`;
    const svg = svgRef.current;
    if (svg) {
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', String(W));
      svg.setAttribute('height', String(H));
    }
    const all = trailPath(pts);
    groundRef.current?.setAttribute('d', all);
    dotsRef.current?.setAttribute('d', all);
    walkedRef.current?.setAttribute('d', nowIdx > 0 ? trailPath(pts.slice(0, nowIdx + 1)) : '');
    host.classList.add('is-laid-out');
  }, []);

  useLayoutEffect(() => {
    layout();
    const host = hostRef.current;
    let cancelled = false;
    document.fonts?.ready.then(() => !cancelled && layout()).catch(() => {});
    if (!host || typeof ResizeObserver === 'undefined') return () => void (cancelled = true);
    let lastW = host.clientWidth;
    const ro = new ResizeObserver(() => {
      if (host.clientWidth !== lastW) {
        lastW = host.clientWidth;
        layout();
      }
    });
    ro.observe(host);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [layout, items, relayoutKey]);

  return (
    <div className="trail" ref={hostRef}>
      <svg className="trail-svg" ref={svgRef} aria-hidden="true" focusable="false">
        <path className="trail-ground" ref={groundRef} />
        <path className="trail-dots" ref={dotsRef} />
        <path className="trail-walked" ref={walkedRef} />
      </svg>
      <ol className="trail-list" aria-label={label}>
        {items.map((it, i) => (
          <li className="node" key={it.key} data-type={it.type} style={{ '--i': String(i) } as ColourVars}>
            {it.type === 'stone' ? (
              <Stone
                name={it.name}
                emoji={it.emoji}
                time={it.time}
                state={it.state}
                vars={it.vars}
                onSelect={it.onSelect}
              />
            ) : (
              <RestStop
                label={it.label}
                emoji={it.emoji}
                time={it.time}
                vars={it.vars}
                end={it.end}
                onSelect={it.onSelect}
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
