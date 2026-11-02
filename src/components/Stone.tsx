import type { ColourVars } from './colours';

export type StoneState = 'done' | 'now' | 'later' | 'catchup';

export interface StoneProps {
  name: string;
  emoji: string;
  /** e.g. "5:30–6:15" */
  time: string;
  state: StoneState;
  vars: ColourVars;
  onSelect?: () => void;
}

const SPOKEN: Record<StoneState, string> = {
  done: 'done',
  now: 'up now, start here',
  later: 'later',
  catchup: 'waiting for you, catch up',
};

/**
 * A stepping stone on Today's trail (§15.3). Renders the stone, its "Start here!" tag (now) and its
 * label; the parent positions it (the element is centred on 0,0).
 *  done: subject fill + gold ✓ · now: 104px, white ring, pulsing halo · later: white, dashed border
 *  catchup: soft amber, never red (§5.2)
 */
export function Stone({ name, emoji, time, state, vars, onSelect }: StoneProps) {
  return (
    <div
      className="stone-wrap"
      style={{ ...vars, '--sz': state === 'now' ? 'var(--stone-now)' : 'var(--stone)' } as ColourVars}
    >
      {state === 'now' && (
        <span className="tag" aria-hidden="true">
          Start here!
        </span>
      )}
      <button
        type="button"
        className={`stone ${state}`}
        aria-label={`${name}, ${time}, ${SPOKEN[state]}`}
        onClick={onSelect}
        data-state={state}
      >
        <span aria-hidden="true">{emoji}</span>
        {state === 'done' && (
          <span className="tick" aria-hidden="true">
            ✓
          </span>
        )}
      </button>
      <span className="stone-label" aria-hidden="true">
        <b>{name}</b>
        <small>{time}</small>
      </span>
    </div>
  );
}
