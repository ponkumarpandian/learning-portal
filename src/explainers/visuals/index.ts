/**
 * The §7.5 visual registry. `scene.visual` (a VisualName from @/content) picks the component; a name
 * without an entry yet (Phase 7) renders the player's friendly "picture coming soon" stage.
 */
import type { VisualName } from '@/content';
import { DigestiveJourney } from './DigestiveJourney';
import { FractionBar } from './FractionBar';
import { LightRay } from './LightRay';
import { NumberLine } from './NumberLine';
import { ParticleBox } from './ParticleBox';
import type { VisualComponent } from './types';

export type { VisualComponent, VisualProps } from './types';

export const VISUALS: Partial<Record<VisualName, VisualComponent>> = {
  ParticleBox,
  LightRay,
  NumberLine,
  FractionBar,
  DigestiveJourney,
};
