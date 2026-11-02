import type { ReactNode } from 'react';
import { Tara, type TaraMood } from './Tara';

export interface SpeechBubbleProps {
  children: ReactNode;
  className?: string;
}

/** Rounded bubble with a rotated-square tail pointing left at Tara. One short line at a time. */
export function SpeechBubble({ children, className }: SpeechBubbleProps) {
  return <div className={['bubble', className].filter(Boolean).join(' ')}>{children}</div>;
}

export interface TaraSaysProps {
  children: ReactNode;
  mood?: TaraMood;
  /** small = 74/92px Tara (all screens except Today) */
  small?: boolean;
}

/** Tara + her speech bubble, as a screen header. */
export function TaraSays({ children, mood, small }: TaraSaysProps) {
  return (
    <header className="hello">
      <Tara mood={mood} size={small ? 'small' : 'default'} animateIn />
      <SpeechBubble>{children}</SpeechBubble>
    </header>
  );
}
