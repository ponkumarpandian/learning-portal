import { useId, type ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** decorative icon before the word (emoji or "Aa") */
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Extra line under the control, e.g. "Space is always cosy and dark 🌌" */
  note?: ReactNode;
}

/**
 * A pill track of ≥52px segments backed by real radios (arrow keys work). Selected = --tab-on with a
 * 3px --go border and --ink text (never small text on --go).
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
  note,
}: SegmentedControlProps<T>) {
  const id = useId();
  return (
    <div className="setting">
      <h3 id={`${id}-h`}>{label}</h3>
      <div className="seg" role="radiogroup" aria-labelledby={`${id}-h`}>
        {options.map((o) => (
          <label key={o.value}>
            <input
              className="sr-only"
              type="radio"
              name={id}
              value={o.value}
              checked={value === o.value}
              disabled={disabled}
              onChange={() => onChange(o.value)}
            />
            {o.icon && <span aria-hidden="true">{o.icon}</span>}
            {o.label}
          </label>
        ))}
      </div>
      {note && <p className="muted setting-note">{note}</p>}
    </div>
  );
}
