import type { ReactNode } from 'react';
import { Tara, type TaraMood } from './Tara';

export interface EmptyStateProps {
  title: string;
  body?: ReactNode;
  mood?: TaraMood;
  action?: ReactNode;
  /** heading level: h1 when it is the whole screen */
  as?: 'h1' | 'h2';
  headingId?: string;
}

/** Tara + one friendly line + one action, with the kolam dotted motif (§15.3). */
export function EmptyState({
  title,
  body,
  mood = 'happy',
  action,
  as: H = 'h2',
  headingId,
}: EmptyStateProps) {
  return (
    <div className="card empty">
      <Tara mood={mood} label={null} animateIn />
      <H id={headingId} tabIndex={H === 'h1' ? -1 : undefined}>
        {title}
      </H>
      {body && <p>{body}</p>}
      <div className="kolam-rule" aria-hidden="true" />
      {action}
    </div>
  );
}
