/** Idle motion per state (pure data for framer-motion): solids jiggle, liquids slide, gases zoom. */
import { jitter, type Pt } from './layout';
import type { Idle } from './scene';

export interface IdleMotion {
  animate: Record<string, number[]>;
  transition: Record<string, unknown>;
}

export function idleMotion(
  idle: Idle,
  i: number,
  heat: number,
  opts: { viscous?: boolean; calm?: boolean; loop?: Pt[] },
): IdleMotion | null {
  const j = jitter(i);
  switch (idle) {
    case 'jiggle': {
      const a = opts.calm ? 0.9 : 1 + heat * 1.8;
      return {
        animate: { x: [0, a, -a * 0.7, a * 0.3, 0], y: [0, -a * 0.6, a * 0.8, -a * 0.4, 0] },
        transition: {
          duration: Math.max(0.22, 0.46 + 0.1 * j - heat * 0.18),
          repeat: Infinity,
          ease: 'easeInOut',
        },
      };
    }
    case 'slide': {
      const a = opts.calm ? 1.4 : 4 + heat * 3;
      const slow = opts.viscous ? 3.4 : 1;
      return {
        animate: { x: [0, a * (j >= 0 ? 1 : -1), -a * 0.6, a * 0.4 * j, 0], y: [0, -1.6, 1.3, -0.7, 0] },
        transition: {
          duration: ((2.3 + 0.6 * j) * slow) / (0.75 + heat * 0.6),
          repeat: Infinity,
          ease: 'easeInOut',
        },
      };
    }
    case 'zoom': {
      const loop = opts.loop ?? [];
      if (!loop.length) return null;
      return {
        animate: { x: [0, ...loop.map((o) => o.x), 0], y: [0, ...loop.map((o) => o.y), 0] },
        transition: { duration: (4.2 + 0.9 * j) / (0.6 + heat * 0.9), repeat: Infinity, ease: 'linear' },
      };
    }
    case 'stream': {
      const o = opts.loop?.[0];
      if (!o || (o.x === 0 && o.y === 0)) return null;
      return {
        animate: { x: [0, o.x], y: [0, o.y] },
        transition: { duration: 0.9, repeat: Infinity, ease: 'linear' },
      };
    }
    case 'burst': {
      const o = opts.loop?.[0];
      if (!o) return null;
      return {
        animate: { x: [0, o.x], y: [0, o.y], opacity: [1, 1, 0] },
        transition: { duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: (i % 8) * 0.12 },
      };
    }
    default:
      return null;
  }
}
