/**
 * DigestiveJourney (SPEC §7.5, Biology): the food's path through the alimentary canal, with the
 * digestive glands beside it. Props and layout: ./digestiveJourneyLayout.ts.
 */
import { motion } from 'framer-motion';
import { describeJourney, layoutJourney, parseJourney } from './digestiveJourneyLayout';
import { EASE_OUT, type VisualProps } from './types';
import { useSubjectVars } from './useSubjectVars';
import './visuals.css';

export function DigestiveJourney({ props, subjectId, reduced }: VisualProps) {
  const vars = useSubjectVars(subjectId);
  const scene = parseJourney(props);
  const l = layoutJourney(scene);
  const tween = reduced ? { duration: 0 } : { duration: 0.8, ease: EASE_OUT };

  return (
    <div className="dj" style={vars} role="img" aria-label={describeJourney(scene)}>
      <svg viewBox={`0 0 ${l.width} ${l.height}`} className="dj-svg" aria-hidden="true" focusable="false">
        {l.glands.map((g) => (
          <path key={`j-${g.id}`} d={`M${g.x} ${g.joinY} H${16 + 218}`} className="dj-join" />
        ))}
        {l.arrows.map((a, i) => (
          <g key={`a${i}`}>
            <path d={`M${a.x} ${a.y1} V${a.y2 - 6}`} className="dj-arrow" />
            <path
              d={`M${a.x - 7} ${a.y2 - 10} L${a.x} ${a.y2} L${a.x + 7} ${a.y2 - 10}`}
              className="dj-arrow"
            />
          </g>
        ))}
        {[...l.canal, ...l.glands].map((b) => (
          <g key={b.id}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={14}
              className={b.on ? 'dj-box is-on' : 'dj-box'}
            />
            {b.w < 150 && b.name.includes(' ') ? (
              // a narrow gland box: "Salivary glands" on two lines so it never runs past the edge
              <text x={b.x + 12} y={b.y + b.h / 2 - 3} className="dj-text is-small">
                {b.name.split(' ').map((word, i) => (
                  <tspan key={word} x={b.x + 12} dy={i === 0 ? 0 : 19}>
                    {word}
                  </tspan>
                ))}
              </text>
            ) : (
              <text x={b.x + 14} y={b.y + b.h / 2 + 8} className={b.w < 150 ? 'dj-text is-small' : 'dj-text'}>
                {b.name}
              </text>
            )}
          </g>
        ))}
        {l.food && (
          <motion.circle
            r={11}
            className="dj-food"
            initial={false}
            animate={{ cx: l.food.x, cy: l.food.y }}
            transition={tween}
          />
        )}
      </svg>
      {(scene.label || scene.foodLabel) && (
        <div className="vis-chips" aria-hidden="true">
          {scene.label ? <span className="vis-chip">{scene.label}</span> : <span />}
          {scene.foodLabel && <span className="vis-chip">🟡 {scene.foodLabel}</span>}
        </div>
      )}
    </div>
  );
}
