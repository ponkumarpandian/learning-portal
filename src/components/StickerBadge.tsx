import { tokenVars, type ColourVars } from './colours';

export interface StickerBadgeProps {
  name: string;
  emoji: string;
  /** token from tokens.css for the sticker colour (e.g. "biology", "fun", "gold") */
  colour: string;
  locked?: boolean;
  /** slight die-cut tilt in degrees (−6…5) */
  tilt?: number;
}

/** A sticker in the Rewards sticker book. Locked = grey dashed disc with 🔒 (§15.1). */
export function StickerBadge({ name, emoji, colour, locked, tilt = 0 }: StickerBadgeProps) {
  if (locked) {
    return (
      <li className="sticker locked">
        <span className="st-face" aria-hidden="true">
          <span>🔒</span>
        </span>
        <span className="st-name">
          {name}
          <span className="sr-only"> (not yet)</span>
        </span>
      </li>
    );
  }
  const style: ColourVars = { '--c': tokenVars(colour)['--s'] ?? 'var(--fun)', '--r': `${tilt}deg` };
  return (
    <li className="sticker">
      <span className="st-face" style={style} aria-hidden="true">
        {emoji}
      </span>
      <span className="st-name">{name}</span>
    </li>
  );
}
