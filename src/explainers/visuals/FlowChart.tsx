/**
 * FlowChart (SPEC §7.5, History/Civics): boxes from top to bottom, with down arrows for a sequence or
 * without them for a set. Highlighted boxes get a tint and a thick subject-colour edge (ink text stays
 * on a light fill). A newly highlighted box fades its edge in; reduced motion draws the end state.
 * Props and layout: ./flowChartLayout.ts.
 */
import { motion } from 'framer-motion';
import { describeFlow, layoutFlow, parseFlow } from './flowChartLayout';
import { EASE_OUT, type VisualProps } from './types';
import { useSubjectVars } from './useSubjectVars';
import './visuals.css';

export function FlowChart({ props, subjectId, reduced }: VisualProps) {
  const vars = useSubjectVars(subjectId);
  const scene = parseFlow(props);
  const l = layoutFlow(scene);
  const tween = reduced ? { duration: 0 } : { duration: 0.5, ease: EASE_OUT };

  return (
    <div className="fc" style={vars} role="img" aria-label={describeFlow(scene)}>
      <svg viewBox={`0 0 ${l.width} ${l.height}`} className="fc-svg" aria-hidden="true" focusable="false">
        {l.arrows.map((a, i) => (
          <g key={`a${i}`}>
            <path d={`M${a.x} ${a.y1} V${a.y2 - 6}`} className="fc-arrow" />
            <path
              d={`M${a.x - 7} ${a.y2 - 10} L${a.x} ${a.y2} L${a.x + 7} ${a.y2 - 10}`}
              className="fc-arrow"
            />
          </g>
        ))}
        {l.boxes.map((b) => (
          <g key={b.index}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={14} className="fc-box" />
            <motion.rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={14}
              className="fc-box is-on"
              initial={false}
              animate={{ opacity: b.on ? 1 : 0 }}
              transition={tween}
            />
            <text className="fc-text">
              {b.lines.map((line, i) => (
                <tspan key={i} x={b.x + 18} y={b.y + 16 + 21 + i * 27}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        ))}
      </svg>
      {scene.label && (
        <div className="vis-chips" aria-hidden="true">
          <span className="vis-chip">{scene.label}</span>
        </div>
      )}
    </div>
  );
}
