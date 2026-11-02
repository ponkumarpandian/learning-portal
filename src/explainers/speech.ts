/**
 * Narration for the Concept Explainer (SPEC §7.4): the Web Speech API behind a small, injectable
 * interface so the player can be tested without `speechSynthesis` (jsdom has none → captions only).
 *
 * - Voice: prefer an `en-IN` voice, else any English voice, else `available = false` (captions only).
 *   Voices often arrive late (Chrome fires `voiceschanged`), so `available` is live and `onChange`
 *   tells the player when it flips.
 * - `speak(text, { rate })`: `rate` is the PLAYBACK speed (0.75 / 1 / 1.25); the narrator speaks at
 *   0.95 × that. The player speaks one sentence at a time (`splitSentences`) so captions stay in sync
 *   and Chrome's ~15 s utterance cut-off never bites.
 * - `cancel()` detaches the callbacks of the utterance it stops, so a cancelled sentence never
 *   reports `onEnd` (browsers fire `end`/`error` on cancel).
 */

export interface SpeakOptions {
  /** playback speed; the narrator speaks at NARRATION_RATE × rate */
  rate: number;
  onBoundary?: (charIndex: number) => void;
  onEnd: () => void;
}

export interface Narrator {
  available: boolean;
  speak(text: string, opts: SpeakOptions): void;
  cancel(): void;
  pause(): void;
  resume(): void;
  /** optional: called when `available` may have changed (voices loaded). Returns an unsubscribe. */
  onChange?(cb: () => void): () => void;
}

/** SPEC §7.4: speak at rate 0.95. */
export const NARRATION_RATE = 0.95;

/** A narrator that never speaks (captions-only timing). */
export const silentNarrator: Narrator = {
  available: false,
  speak: () => {},
  cancel: () => {},
  pause: () => {},
  resume: () => {},
};

/** Splits narration into sentences ("Light travels. It is straight!" → 2). Never returns []. */
export function splitSentences(text: string): string[] {
  const parts = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…])\s+(?=[^a-z])/u)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [text.trim()];
}

interface VoiceLike {
  lang: string;
  name: string;
  localService?: boolean;
}

/** en-IN first, then any English voice (local ones before network ones), else undefined. */
export function pickVoice<V extends VoiceLike>(voices: readonly V[]): V | undefined {
  const lang = (v: V) => v.lang.replace('_', '-').toLowerCase();
  const english = voices.filter((v) => lang(v).startsWith('en'));
  const byLocal = (a: V, b: V) => Number(b.localService ?? false) - Number(a.localService ?? false);
  const indian = english.filter((v) => lang(v) === 'en-in').sort(byLocal);
  return indian[0] ?? [...english].sort(byLocal)[0];
}

type Synth = Pick<
  SpeechSynthesis,
  'getVoices' | 'speak' | 'cancel' | 'pause' | 'resume' | 'addEventListener' | 'removeEventListener'
>;

/**
 * The browser's speechSynthesis narrator. Safe to call anywhere: without the API it is a silent
 * narrator with `available = false`.
 */
export function browserNarrator(
  synth: Synth | undefined = typeof window !== 'undefined' ? window.speechSynthesis : undefined,
  Utterance: typeof SpeechSynthesisUtterance | undefined = typeof SpeechSynthesisUtterance !== 'undefined'
    ? SpeechSynthesisUtterance
    : undefined,
): Narrator {
  if (!synth || !Utterance) return { ...silentNarrator };

  let voice: SpeechSynthesisVoice | undefined;
  const listeners = new Set<() => void>();
  const refresh = () => {
    try {
      voice = pickVoice(synth.getVoices());
    } catch {
      voice = undefined;
    }
  };
  refresh();
  const onVoices = () => {
    refresh();
    listeners.forEach((cb) => cb());
  };
  try {
    synth.addEventListener('voiceschanged', onVoices);
  } catch {
    /* very old browsers: voices are what they are */
  }

  let current: SpeechSynthesisUtterance | null = null;
  const detach = (u: SpeechSynthesisUtterance | null) => {
    if (!u) return;
    u.onend = null;
    u.onerror = null;
    u.onboundary = null;
  };

  return {
    get available() {
      return voice !== undefined;
    },
    speak(text, { rate, onBoundary, onEnd }) {
      detach(current);
      synth.cancel();
      if (!voice) {
        onEnd();
        return;
      }
      const u = new Utterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = NARRATION_RATE * rate;
      u.pitch = 1.05;
      const done = () => {
        if (current !== u) return;
        current = null;
        detach(u);
        onEnd();
      };
      u.onend = done;
      u.onerror = done;
      if (onBoundary) u.onboundary = (e) => onBoundary(e.charIndex);
      current = u;
      synth.speak(u);
      // Chrome sometimes starts in a paused state after a previous pause(); nudge it.
      synth.resume();
    },
    cancel() {
      detach(current);
      current = null;
      synth.cancel();
    },
    pause() {
      synth.pause();
    },
    resume() {
      synth.resume();
    },
    onChange(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
