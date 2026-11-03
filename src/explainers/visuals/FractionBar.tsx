/**
 * FractionBar (SPEC §7.5, Maths): rows of bars cut into equal parts, with the shaded parts in the
 * subject colour. Props and layout: ./fractionBarLayout.ts.
 */
import { motion } from 'framer-motion';
import { describeFractionBar, layoutFractionBar, parseFractionBar } from './fractionBarLayout';
import { EASE_OUT, type VisualProps } from './types';
import { useSubjectVars } from './useSubjectVars';
import './visuals.css';

export function FractionBar({ props, subjectId, reduced }: VisualProps) {
  const vars = useSubjectVars(subjectId);
  const scene = parseFractionBar(props);
  const l = layoutFractionBar(scene);
  const tween = reduced ? { duration: 0 } : { duration: 0.5, ease: EASE_OUT };
  const h = l.rowHeight;

  return (
    <div className="fb" style={vars} role="img" aria-label={describeFractionBar(scene)}>
      <svg viewBox={`0 0 ${l.width} ${l.height}`} className="fb-svg" aria-hidden="true" focusable="false">
        {l.rows.map((r, i) => (
          // keyed by what the row shows, so a step that changes a bar (5/6 → 15/18) fades the new one in
          <motion.g
            key={`${i}:${r.label ?? ''}:${r.cells.length}`}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={tween}
          >
            {r.label && (
              <text x={106} y={r.y + h / 2 + 8} textAnchor="end" className="fb-label">
                {r.label}
              </text>
            )}
            {r.cells.map((c, k) => (
              <rect
                key={k}
                x={c.x}
                y={r.y}
                width={c.w}
                height={h}
                className={c.on ? 'fb-cell is-on' : 'fb-cell'}
              />
            ))}
            {r.dividers &&
              r.cells.map((c, k) =>
                k === 0 || r.wholes.some((w) => Math.abs(w.x - c.x) < 0.01) ? null : (
                  <path key={`d${k}`} d={`M${c.x} ${r.y} V${r.y + h}`} className="fb-divider" />
                ),
              )}
            {r.wholes.map((w, k) => (
              <rect key={`w${k}`} x={w.x} y={r.y} width={w.w} height={h} rx={4} className="fb-whole" />
            ))}
          </motion.g>
        ))}
        {l.signs.map((s, i) => (
          <text key={`s${i}`} x={s.x} y={s.y} textAnchor="middle" className="fb-sign">
            {s.text}
          </text>
        ))}
        {l.result && (
          <text x={l.result.x} y={l.result.y} textAnchor="middle" className="fb-result">
            {l.result.text}
          </text>
        )}
      </svg>
      {scene.label && (
        <div className="vis-chips" aria-hidden="true">
          <span className="vis-chip">{scene.label}</span>
        </div>
      )}
    </div>
  );
}
