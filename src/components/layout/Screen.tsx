import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';

let firstScreen = true;

export interface ScreenProps {
  /** id of the screen's h1 (tabIndex -1); focused after in-app navigation so screen readers follow */
  labelledBy: string;
  children: ReactNode;
  className?: string;
}

/** One screen: fades/slides in, labelled by its heading, focuses that heading after navigation. */
export function Screen({ labelledBy, children, className }: ScreenProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (firstScreen) {
      firstScreen = false;
      return;
    }
    const h = document.getElementById(labelledBy);
    h?.focus({ preventScroll: true });
  }, [labelledBy]);

  return (
    <motion.section
      ref={ref}
      className={['screen', className].filter(Boolean).join(' ')}
      aria-labelledby={labelledBy}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}
