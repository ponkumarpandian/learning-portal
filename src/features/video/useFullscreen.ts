import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Full screen on the player frame: the Fullscreen API where it exists (and is allowed), otherwise a
 * fixed full-window layout (iPad Safari only lets <video> go full screen).
 */
export function useFullscreen<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  full: boolean;
  pseudo: boolean;
  toggle: () => void;
  /** leave full screen (a checkpoint's feedback sheet is portalled to <body>, outside the frame) */
  exit: () => void;
} {
  const ref = useRef<T | null>(null);
  const [native, setNative] = useState(false);
  const [css, setCss] = useState(false);
  useEffect(() => {
    const on = () =>
      setNative(document.fullscreenElement !== null && document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  useEffect(() => {
    if (!css) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCss(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [css]);
  const toggle = useCallback(() => {
    const el = ref.current;
    if (css) return setCss(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
      return;
    }
    if (el && typeof el.requestFullscreen === 'function') {
      el.requestFullscreen().catch(() => setCss(true));
    } else setCss(true);
  }, [css]);
  const exit = useCallback(() => {
    setCss(false);
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
  }, []);
  return { ref, full: native || css, pseudo: css, toggle, exit };
}
