/**
 * The YouTube IFrame Player API (SPEC §7.6), loaded only when a parent-approved video actually plays.
 * Minimal local types (no @types/youtube dependency). Fails (rejects) after `timeoutMs` so the lesson
 * can fall back to the explainer.
 */

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  loadModule?(name: string): void;
  unloadModule?(name: string): void;
  destroy(): void;
}

export interface YTPlayerOptions {
  host?: string;
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onError?: (e: { data: number }) => void;
    onStateChange?: (e: { data: number }) => void;
  };
}

export interface YTNamespace {
  Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer;
}

/** YT.PlayerState.ENDED */
export const YT_ENDED = 0;

type YTWindow = Window & { YT?: Partial<YTNamespace>; onYouTubeIframeAPIReady?: () => void };

let pending: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(timeoutMs = 8000): Promise<YTNamespace> {
  const w = window as YTWindow;
  if (w.YT?.Player) return Promise.resolve(w.YT as YTNamespace);
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    return Promise.reject(new Error('offline'));
  pending ??= new Promise<YTNamespace>((resolve, reject) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (w.YT?.Player) resolve(w.YT as YTNamespace);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      pending = null;
      s.remove();
      reject(new Error('YouTube API failed to load'));
    };
    document.head.appendChild(s);
  });
  return Promise.race([
    pending,
    new Promise<YTNamespace>((_, reject) =>
      setTimeout(() => reject(new Error('YouTube API timed out')), timeoutMs),
    ),
  ]);
}
