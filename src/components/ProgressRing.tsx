import type { ReactNode } from 'react';

export interface ProgressRingProps {
  value: number;
  max: number;
  label: string;
  /** design px at Big */
  size?: number;
  stroke?: number;
  children?: ReactNode;
}

/** Round progress (today's lessons done out of the total, §5.1). */
export function ProgressRing({ value, max, label, size = 72, stroke = 10, children }: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const rem = `calc(${size} * var(--px))`;
  return (
    <div
      className="pring"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: rem, height: rem }} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          opacity={frac === 0 ? 0 : 1}
        />
      </svg>
      <span className="ring-label" aria-hidden="true">
        {children ?? `${value}/${max}`}
      </span>
    </div>
  );
}
