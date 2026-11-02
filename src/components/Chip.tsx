import type { ReactNode } from 'react';

export interface ChipProps {
  /** Bold line, e.g. "🔥 6" */
  value: ReactNode;
  /** Small label under it, e.g. "day streak" */
  label: string;
  /** Spoken text when the bold line is mostly emoji (e.g. "6 day streak") */
  srLabel?: string;
}

/** Stat chip: pill on --surface with a 4px ledge (Today: streak / stars / exams). */
export function Chip({ value, label, srLabel }: ChipProps) {
  return (
    <div className="chip">
      {srLabel && <span className="sr-only">{srLabel}</span>}
      <b aria-hidden={srLabel ? true : undefined}>{value}</b>
      <small aria-hidden={srLabel ? true : undefined}>{label}</small>
    </div>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="chips">{children}</div>;
}
