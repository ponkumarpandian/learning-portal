import type { ComponentType } from 'react';

/** What every §7.5 visual receives: the scene props with the fired steps merged on top. */
export interface VisualProps {
  props: Record<string, unknown>;
  /** subject id for colours (subjectVars); the player also sets the vars on the stage */
  subjectId?: string;
  /** reduced motion: draw still end-state frames, no looping */
  reduced: boolean;
}

export type VisualComponent = ComponentType<VisualProps>;

/** Ease used for step-to-step tweens (matches --ease-out). */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** A DOM-id-safe version of React's useId() output (for clipPath / gradient ids). */
export const svgId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '');
