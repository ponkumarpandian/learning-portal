/** ParticleBox SVG outlines (pure strings). */
import { ROOM, type Rect } from './layout';

export const PATHS = {
  box: 'M122 60 H278 Q292 60 292 74 V238 Q292 252 278 252 H122 Q108 252 108 238 V74 Q108 60 122 60 Z',
  cup: 'M126 104 L146 245 Q147 252 154 252 L246 252 Q253 252 254 245 L274 104 Z',
  cupStroke: 'M126 104 L146 245 Q147 252 154 252 L246 252 Q253 252 254 245 L274 104',
  bowl: 'M58 126 A142 126 0 0 0 342 126 Z',
  bowlStroke: 'M58 126 A142 126 0 0 0 342 126',
  flask: 'M180 44 V118 L102 244 Q98 252 108 252 H292 Q302 252 298 244 L220 118 V44 Z',
  flaskStroke: 'M180 44 V118 L102 244 Q98 252 108 252 H292 Q302 252 298 244 L220 118 V44',
  bottle:
    'M-56 -36 Q-62 -36 -62 -28 V80 Q-62 90 -52 90 H52 Q62 90 62 80 V-28 Q62 -36 56 -36 H16 V-74 H-16 V-36 Z',
  room: `M${ROOM.x0} ${ROOM.y0} H${ROOM.x1} V${ROOM.y1} H${ROOM.x0} Z`,
} as const;

export const bottleTransform = (at: { x: number; y: number; s: number }) =>
  `translate(${at.x} ${at.y}) scale(${at.s})`;

export function rectPath(r: Rect, rad = 12): string {
  return `M${r.x0 + rad} ${r.y0} H${r.x1 - rad} Q${r.x1} ${r.y0} ${r.x1} ${r.y0 + rad} V${r.y1 - rad} Q${r.x1} ${r.y1} ${r.x1 - rad} ${r.y1} H${r.x0 + rad} Q${r.x0} ${r.y1} ${r.x0} ${r.y1 - rad} V${r.y0 + rad} Q${r.x0} ${r.y0} ${r.x0 + rad} ${r.y0} Z`;
}
