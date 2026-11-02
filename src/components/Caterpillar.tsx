import { LESSON_STEPS, type CaterpillarStep } from './steps';
import type { ColourVars } from './colours';

export interface CaterpillarProps {
  steps?: readonly CaterpillarStep[];
  /** index of the current step; earlier steps are done (gold ✓), later ones white */
  current: number;
  vars?: ColourVars;
}

/** The step caterpillar at the top of a lesson. */
export function Caterpillar({ steps = LESSON_STEPS, current, vars }: CaterpillarProps) {
  return (
    <ol
      className="caterpillar"
      aria-label="Lesson steps"
      style={{ ...vars, '--n': String(steps.length) } as ColourVars}
    >
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'later';
        return (
          <li key={s.label} className={state} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="ball">
              <span aria-hidden="true">{s.emoji}</span>
              {state === 'done' && (
                <span className="tick" aria-hidden="true">
                  ✓
                </span>
              )}
            </span>
            <span className="c-lbl">
              {s.label}
              {state === 'done' && <span className="sr-only">, done</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
