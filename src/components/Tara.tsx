import { motion, useReducedMotion } from 'framer-motion';
import { useMascotName } from '@/state/settingsStore';

export type TaraMood = 'happy' | 'cheer' | 'sleepy';

export interface TaraProps {
  mood?: TaraMood;
  /** 'default' 92/116px, 'small' 74/92px, 'fill' fills its parent (sheet icons, app icon) */
  size?: 'default' | 'small' | 'fill';
  /** Accessible name (default "<mascot name> the elephant"); null when decorative next to text that says the same */
  label?: string | null;
  className?: string;
  /** Pops in when first shown (only motion the kid triggered by opening the screen) */
  animateIn?: boolean;
}

const INK = '#1b2845';

/**
 * Tara the elephant (§15.8): round, pink inner ears, rosy cheeks, a white jasmine flower.
 * Coloured by --tara / --tara-ear so she fits every world.
 */
export function Tara({ mood = 'happy', size = 'default', label, className, animateIn }: TaraProps) {
  const reduce = useReducedMotion();
  const mascot = useMascotName();
  const name = label === undefined ? `${mascot} the elephant` : label;
  const cls = ['tara', size === 'small' && 'is-small', size === 'fill' && 'is-fill', className]
    .filter(Boolean)
    .join(' ');
  const a11y = name ? { role: 'img' as const, 'aria-label': name } : { 'aria-hidden': true as const };
  const pop = animateIn && !reduce;

  return (
    <motion.svg
      viewBox="0 0 120 120"
      className={cls}
      focusable="false"
      data-mood={mood}
      {...a11y}
      initial={pop ? { scale: 0.6, rotate: -8, opacity: 0 } : false}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 16 }}
    >
      {/* ears */}
      <ellipse cx="25" cy="56" rx="23" ry="27" fill="var(--tara)" />
      <ellipse cx="27" cy="58" rx="14" ry="18" fill="var(--tara-ear)" />
      <ellipse cx="95" cy="56" rx="23" ry="27" fill="var(--tara)" />
      <ellipse cx="93" cy="58" rx="14" ry="18" fill="var(--tara-ear)" />
      {/* trunk: curls up when cheering */}
      {mood === 'cheer' ? (
        <path
          d="M57 78 C54 92 60 102 70 98 C80 94 82 84 76 80"
          fill="none"
          stroke="var(--tara)"
          strokeWidth="13"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M57 78 C55 92 57 103 66 106 C74 108 79 101 74 96"
          fill="none"
          stroke="var(--tara)"
          strokeWidth="13"
          strokeLinecap="round"
        />
      )}
      {/* head + tuft */}
      <circle cx="60" cy="58" r="33" fill="var(--tara)" />
      <path
        d="M50 30 q4 -8 8 -1 M58 28 q5 -9 9 0"
        fill="none"
        stroke="var(--tara)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* eyes */}
      {mood === 'sleepy' ? (
        <g fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round">
          <path d="M43 56 q5 4 10 0" />
          <path d="M67 56 q5 4 10 0" />
        </g>
      ) : mood === 'cheer' ? (
        <g fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round">
          <path d="M43 57 q5 -7 10 0" />
          <path d="M67 57 q5 -7 10 0" />
        </g>
      ) : (
        <>
          <ellipse cx="48" cy="55" rx="5" ry="6" fill={INK} />
          <ellipse cx="72" cy="55" rx="5" ry="6" fill={INK} />
          <circle cx="49.8" cy="52.8" r="1.9" fill="#fff" />
          <circle cx="73.8" cy="52.8" r="1.9" fill="#fff" />
        </>
      )}
      {/* cheeks */}
      <ellipse cx="40" cy="68" rx="7" ry="4.5" fill="#ff7aa2" opacity=".6" />
      <ellipse cx="80" cy="68" rx="7" ry="4.5" fill="#ff7aa2" opacity=".6" />
      {/* mouth */}
      {mood === 'cheer' ? (
        <path d="M52 73 q8 9 16 0 z" fill={INK} opacity=".7" />
      ) : (
        <path
          d="M53 74 q7 5 14 0"
          fill="none"
          stroke={INK}
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity=".55"
        />
      )}
      {/* jasmine flower (Bharatanatyam) */}
      <g transform="translate(96 28)">
        <g fill="#ffffff" stroke="#dfe6f2" strokeWidth="1">
          {[0, 72, 144, 216, 288].map((r) => (
            <ellipse key={r} rx="4.6" ry="8" transform={`rotate(${r}) translate(0 -6.5)`} />
          ))}
        </g>
        <circle r="3.4" fill="#ffd23f" />
        <ellipse
          cx="-13"
          cy="9"
          rx="3.4"
          ry="5"
          fill="#ffffff"
          stroke="#dfe6f2"
          strokeWidth="1"
          transform="rotate(-35 -13 9)"
        />
      </g>
      {mood === 'sleepy' && (
        <g fill="var(--ink)" fontFamily="var(--font-display)" fontWeight="600" opacity=".75">
          <text x="2" y="22" fontSize="16">
            z
          </text>
          <text x="14" y="12" fontSize="11">
            z
          </text>
        </g>
      )}
    </motion.svg>
  );
}
