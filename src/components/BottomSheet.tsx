import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChunkyButton } from './ChunkyButton';

export type SheetTone = 'plain' | 'ok' | 'hint';

export interface SheetAction {
  label: string;
  onClick: () => void;
}

export interface BottomSheetProps {
  open: boolean;
  /** plain (not-ready, leave, grown-ups) has a scrim and is modal; ok/hint are feedback sheets */
  tone?: SheetTone;
  /** 64px icon disc: an emoji or <Tara size="fill" /> */
  icon: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** The one big button. It gets focus when the sheet opens ("Keep going" is the default choice). */
  primary: SheetAction;
  secondary?: SheetAction;
  /** Escape / scrim tap. Defaults to primary.onClick. */
  onDismiss?: () => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Slides up from the bottom (§15.2). Focus moves to the primary button, Tab stays inside a modal
 * sheet, Escape dismisses it, and focus returns to whatever opened it.
 */
export function BottomSheet({
  open,
  tone = 'plain',
  icon,
  title,
  body,
  primary,
  secondary,
  onDismiss,
}: BottomSheetProps) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const sheetRef = useRef<HTMLElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const modal = tone === 'plain';
  const dismiss = onDismiss ?? primary.onClick;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    primaryRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape' && modal) {
      e.stopPropagation();
      dismiss();
      return;
    }
    if (e.key !== 'Tab' || !modal || !sheetRef.current) return;
    const els = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = els[0];
    const last = els[els.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const slide = reduce
    ? { initial: false as const, animate: { y: 0 }, exit: { opacity: 0 } }
    : {
        initial: { y: '105%' },
        animate: { y: 0, transition: { type: 'spring' as const, stiffness: 420, damping: 30 } },
        exit: { y: '105%', transition: { duration: 0.22, ease: 'easeIn' as const } },
      };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {modal && (
            <motion.div
              key="scrim"
              className="scrim"
              data-testid="sheet-scrim"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={dismiss}
            />
          )}
          <motion.section
            key="sheet"
            ref={sheetRef}
            className={`sheet ${tone === 'plain' ? '' : tone}`}
            role="dialog"
            aria-modal={modal || undefined}
            aria-labelledby={titleId}
            onKeyDown={onKeyDown}
            {...slide}
          >
            <div className="sheet-body">
              <div className="sheet-icon" aria-hidden="true">
                {icon}
              </div>
              <div>
                <h2 id={titleId}>{title}</h2>
                {body && <p>{body}</p>}
              </div>
            </div>
            <div className="sheet-actions">
              <ChunkyButton ref={primaryRef} onClick={primary.onClick}>
                {primary.label}
              </ChunkyButton>
              {secondary && (
                <ChunkyButton variant="soft" onClick={secondary.onClick}>
                  {secondary.label}
                </ChunkyButton>
              )}
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
