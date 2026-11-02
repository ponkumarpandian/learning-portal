import { motion, useReducedMotion } from 'framer-motion';

const COLOURS = [
  'var(--gold)',
  'var(--go)',
  'var(--s, var(--deco))',
  'var(--catch)',
  'var(--deco2)',
  'var(--tara)',
];
const PIECES = 34;

/**
 * Confetti (§15.9): only for a 100% score, new badges and finishing a test. Pieces fall once and are
 * gone. Nothing at all under reduced motion. Positions are deterministic (no randomness to test).
 */
export function Confetti() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="confetti" aria-hidden="true" data-testid="confetti">
      {Array.from({ length: PIECES }, (_, i) => {
        const left = (i * 37) % 100;
        const drift = ((i * 53) % 60) - 30;
        const delay = ((i * 7) % 10) / 20;
        const spin = (i % 2 ? 1 : -1) * (180 + ((i * 29) % 360));
        const round = i % 3 === 0;
        return (
          <motion.i
            key={i}
            className={round ? 'cf is-round' : 'cf'}
            style={{ left: `${left}%`, background: COLOURS[i % COLOURS.length] }}
            initial={{ y: '-10vh', x: 0, rotate: 0, opacity: 1 }}
            animate={{ y: '105vh', x: drift * 3, rotate: spin, opacity: [1, 1, 0] }}
            transition={{ duration: 2.4 + ((i * 11) % 10) / 10, delay, ease: [0.25, 0.6, 0.45, 1] }}
          />
        );
      })}
    </div>
  );
}
