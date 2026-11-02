export interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  big?: boolean;
}

/** Pill progress bar: --surface2 track, --go fill with a --go-d inner bottom. */
export function ProgressBar({ value, max, label, big }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={big ? 'prog is-big' : 'prog'}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}
