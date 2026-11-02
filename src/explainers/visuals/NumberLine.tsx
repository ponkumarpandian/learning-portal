/**
 * NumberLine (SPEC §7.5, Maths) — minimal Phase 2 version: an integer line with jumps.
 *
 * Props: min (default −5) · max (default 5) · start (default 0) · jumps: number[] (signed steps,
 *        e.g. [3, -5]) · show (how many jumps are drawn so far; step it to animate, default all) ·
 *        mark (a number to ring) · label (chip text)
 */
import { motion } from 'framer-motion';
import { EASE_OUT, type VisualProps } from './types';
import { useSubjectVars } from './useSubjectVars';
import './visuals.css';

const int = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;

/** Where each jump starts and ends. */
function jumpPath(start: number, jumps: readonly number[]): { from: number; to: number }[] {
  let at = start;
  return jumps.map((j) => {
    const from = at;
    at += j;
    return { from, to: at };
  });
}

export function NumberLine({ props, subjectId, reduced }: VisualProps) {
  const vars = useSubjectVars(subjectId);
  let min = int(props.min, -5);
  let max = int(props.max, 5);
  if (max <= min) [min, max] = [Math.min(min, max) - 5, Math.max(min, max) + 5];
  const start = int(props.start, 0);
  const jumps = Array.isArray(props.jumps)
    ? props.jumps.filter((j): j is number => typeof j === 'number' && Number.isFinite(j)).map(Math.round)
    : [];
  const show = Math.max(0, Math.min(jumps.length, int(props.show, jumps.length)));
  const hops = jumpPath(start, jumps);
  const end = hops[show - 1]?.to ?? start;
  const mark = typeof props.mark === 'number' ? Math.round(props.mark) : undefined;
  const label = typeof props.label === 'string' ? props.label : undefined;

  const x0 = 30;
  const x1 = 370;
  const y = 150;
  const span = max - min;
  const X = (n: number) => x0 + ((Math.max(min, Math.min(max, n)) - min) / span) * (x1 - x0);
  const every = span <= 12 ? 1 : span <= 24 ? 2 : 5;
  const ticks = Array.from({ length: span + 1 }, (_, i) => min + i);
  const tween = reduced ? { duration: 0 } : { duration: 0.9, ease: EASE_OUT };

  return (
    <div
      className="nl"
      style={vars}
      role="img"
      aria-label={`Number line from ${min} to ${max}${jumps.length ? `, starting at ${start} and landing on ${end}` : ''}`}
    >
      <svg viewBox="0 0 400 220" className="nl-svg" aria-hidden="true" focusable="false">
        <path
          d={`M${x0 - 14} ${y} H${x1 + 14} M${x0 - 4} ${y - 9} L${x0 - 16} ${y} L${x0 - 4} ${y + 9} M${x1 + 4} ${y - 9} L${x1 + 16} ${y} L${x1 + 4} ${y + 9}`}
          className="nl-line"
        />
        {ticks.map((n) => (
          <g key={n}>
            <path
              d={`M${X(n)} ${y - (n % every === 0 ? 12 : 7)} V${y + (n % every === 0 ? 12 : 7)}`}
              className={n === 0 ? 'nl-zero' : 'nl-tick'}
            />
            {n % every === 0 && (
              <text x={X(n)} y={y + 42} textAnchor="middle" className="nl-text">
                {n < 0 ? `−${-n}` : n}
              </text>
            )}
          </g>
        ))}
        {hops.slice(0, show).map((h, i) => {
          const a = X(h.from);
          const b = X(h.to);
          const lift = 26 + Math.min(70, Math.abs(b - a) * 0.45);
          const d = `M${a} ${y - 14} Q${(a + b) / 2} ${y - 14 - lift * 2} ${b} ${y - 14}`;
          const dir = b >= a ? 1 : -1;
          return (
            <g key={i}>
              <motion.path
                d={d}
                className="nl-jump"
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={tween}
              />
              <path
                d={`M${b - dir * 12} ${y - 30} L${b} ${y - 14} L${b - dir * 2} ${y - 34} Z`}
                className="nl-jump-head"
              />
              <text x={(a + b) / 2} y={y - 22 - lift} textAnchor="middle" className="nl-text">
                {h.to - h.from > 0 ? `+${h.to - h.from}` : `−${h.from - h.to}`}
              </text>
            </g>
          );
        })}
        {jumps.length > 0 && <circle cx={X(start)} cy={y} r={10} className="nl-dot is-start" />}
        <motion.circle
          cy={y}
          r={13}
          className="nl-dot"
          initial={false}
          animate={{ cx: X(end) }}
          transition={tween}
        />
        {mark !== undefined && <circle cx={X(mark)} cy={y} r={20} className="pb-ring" />}
      </svg>
      {label && (
        <div className="vis-chips" aria-hidden="true">
          <span className="vis-chip">{label}</span>
        </div>
      )}
    </div>
  );
}
