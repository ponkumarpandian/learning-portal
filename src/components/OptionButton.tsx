import type { ChangeEvent } from 'react';

export type OptionState = 'idle' | 'right' | 'tried';

export interface OptionButtonProps {
  name: string;
  value: string;
  /** A, B, C, D */
  letter: string;
  text: string;
  checked: boolean;
  onChange: (value: string, e: ChangeEvent<HTMLInputElement>) => void;
  /** right = --ok colours + ⭐ · tried = soft amber (never red, §12) */
  state?: OptionState;
  disabled?: boolean;
}

/**
 * An answer choice (§15.6): ≥ 64px (68 here), A/B/C/D key in a rounded square, 3px border, the
 * subject colour (--s from a parent) when selected. A visually hidden radio keeps it keyboard-native:
 * Tab into the group, arrow keys to choose.
 */
export function OptionButton({
  name,
  value,
  letter,
  text,
  checked,
  onChange,
  state = 'idle',
  disabled,
}: OptionButtonProps) {
  const cls = [
    'option',
    state === 'right' && 'is-right',
    state === 'tried' && 'is-tried',
    disabled && 'is-locked',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <label className={cls}>
      <input
        className="sr-only"
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(value, e)}
      />
      <span className="key" aria-hidden="true">
        {letter}
      </span>
      <span className="o-text">{text}</span>
      <span className="o-mark" aria-hidden="true">
        {state === 'right' ? '⭐' : state === 'tried' ? '💡' : ''}
      </span>
    </label>
  );
}
