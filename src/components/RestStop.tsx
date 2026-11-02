import type { ColourVars } from './colours';

export interface RestStopProps {
  label: string;
  emoji: string;
  time: string;
  vars?: ColourVars;
  /** The trail's end marker (🌙 Sleep time): dashed --line border, no ledge */
  end?: boolean;
  onSelect?: () => void;
}

/** Pill-shaped marker on the trail for dance, tuition, badminton and the bedtime end (§15.3). */
export function RestStop({ label, emoji, time, vars, end, onSelect }: RestStopProps) {
  return (
    <button type="button" className={end ? 'rest end' : 'rest'} style={vars} onClick={onSelect}>
      <span className="r-emo" aria-hidden="true">
        {emoji}
      </span>
      <span>
        <b>{label}</b>
        <span className="sr-only">, </span>
        <small>{time}</small>
      </span>
    </button>
  );
}
