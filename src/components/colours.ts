import type { CSSProperties } from 'react';
import type { Subject } from '@/content';

/** CSS custom properties a component reads its colour from (see ui.css header). */
export type ColourVars = CSSProperties & Record<`--${string}`, string>;

/** Token names that exist in tokens.css as --x, --x-d and --on-x. */
const TOKENS = new Set([
  'maths',
  'physics',
  'chemistry',
  'biology',
  'english',
  'history',
  'geography',
  'tuition',
  'lang',
  'dance',
  'sport',
  'fun',
  'gold',
]);

/**
 * The --<subject> fill each built-in subject token has in tokens.css (the same as the seed
 * subjects.json). A subjects.json colour that differs (a parent override) wins over the token.
 * Keep in step with tokens.css (colours.test.ts + scripts/tokens-sync.test.ts check it).
 */
export const SUBJECT_TOKEN_HEX: Readonly<Record<string, string>> = {
  maths: '#3f7bf6',
  physics: '#7a5af8',
  chemistry: '#14b8a6',
  biology: '#43a047',
  english: '#f0643c',
  history: '#b45309',
  geography: '#0ea5e9',
};

/** Dark text used on light custom fills (the same ink as the Meadow light theme). */
const DARK_ON = '#1b2845';

const safeToken = (t: string) => (/^[a-z][a-z0-9-]*$/.test(t) ? t : 'fun');

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

/** White or dark ink, whichever has the higher WCAG contrast on `hex` (#rrggbb). */
export function onColour(hex: string): string {
  const l = luminance(hex);
  const white = 1.05 / (l + 0.05);
  const dark = (l + 0.05) / (luminance(DARK_ON) + 0.05);
  return white >= dark ? '#ffffff' : DARK_ON;
}

/**
 * Subject colour vars. A built-in subject whose subjects.json colour still matches its tokens.css
 * value uses the token (contrast-checked edge and text). Any other colour (a new subject, or a parent
 * override of a built-in one) uses the JSON hex with a computed edge and on-colour.
 */
export function subjectVars(subject: Pick<Subject, 'id' | 'colour'> | undefined): ColourVars {
  if (!subject) return tokenVars('fun');
  const id = safeToken(subject.id);
  const hex = subject.colour;
  if (TOKENS.has(id) && SUBJECT_TOKEN_HEX[id] === hex.toLowerCase()) return tokenVars(id);
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return TOKENS.has(id) ? tokenVars(id) : tokenVars('fun');
  const edge = `color-mix(in srgb, ${hex} 72%, black)`;
  return { '--s': hex, '--sd': edge, '--on-s': onColour(hex), '--a': hex, '--ad': edge };
}

/** Vars for a named token (activity colours such as "dance", or "gold"). */
export function tokenVars(token: string): ColourVars {
  const t = TOKENS.has(token) ? token : 'fun';
  return {
    '--s': `var(--${t})`,
    '--sd': `var(--${t}-d)`,
    '--on-s': `var(--on-${t})`,
    '--a': `var(--${t})`,
    '--ad': `var(--${t}-d)`,
  };
}
