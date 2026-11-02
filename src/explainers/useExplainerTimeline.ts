import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { Scene } from '@/content';
import type { Narrator } from './speech';
import { splitSentences } from './speech';
import {
  activeProps,
  buildTimeline,
  captionFor,
  initialState,
  position,
  step,
  type PlayerAction,
  type PlayerState,
} from './timeline';

/** How often scene time advances (ms). Visual tweens are framer-motion's, so this can be coarse. */
export const TICK_MS = 200;

export interface TimelineOptions {
  narrator: Narrator;
  /** settings.narration (the parent can mute it) */
  narrationOn: boolean;
  initialSpeed?: number;
  initialScene?: number;
  autoPlay?: boolean;
}

/** `narrator.available`, kept live (voices often load after the first render). */
function useVoiceAvailable(narrator: Narrator): boolean {
  const [available, setAvailable] = useState(narrator.available);
  useEffect(() => {
    // the narrator may have changed between render and effect
    const sync = () => setAvailable(narrator.available);
    sync();
    return narrator.onChange?.(sync);
  }, [narrator]);
  return available;
}

/**
 * Drives the pure timeline (`./timeline.ts`) with a ticking clock and the narrator:
 * one sentence is spoken at a time; its end moves the captions on. Without a voice (or muted) the
 * captions follow the words-per-second estimate. The tab going hidden pauses playback.
 */
export function useExplainerTimeline(scenes: readonly Scene[], opts: TimelineOptions) {
  const { narrator, narrationOn, initialSpeed = 1, initialScene = 0, autoPlay = false } = opts;
  const voice = useVoiceAvailable(narrator);
  const narrated = voice && narrationOn;
  const [state, dispatch] = useReducer(
    (s: PlayerState, a: PlayerAction) => step(scenes, s, a),
    undefined,
    () => {
      const s0 = initialState(scenes, { speed: initialSpeed, narrated, scene: initialScene });
      return autoPlay ? step(scenes, s0, { type: 'play' }) : s0;
    },
  );
  const timeline = useMemo(() => buildTimeline(scenes), [scenes]);

  useEffect(() => {
    dispatch({ type: 'narrated', on: narrated });
  }, [narrated]);

  // scene clock
  const playing = state.status === 'playing';
  useEffect(() => {
    if (!playing) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.5, Math.max(0, (now - last) / 1000));
      last = now;
      dispatch({ type: 'tick', dt });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  // narration, sentence by sentence
  const scene = scenes[state.scene];
  const speakNow = playing && state.narrated && !state.narrationDone && scene !== undefined;
  const sentenceText = scene ? splitSentences(scene.narration)[state.sentence] : undefined;
  const { scene: sceneIdx, sentence, speed, epoch } = state;
  useEffect(() => {
    if (!speakNow || !sentenceText) return;
    narrator.speak(sentenceText, {
      rate: speed,
      onEnd: () => dispatch({ type: 'sentenceEnd', scene: sceneIdx, sentence }),
    });
    return () => narrator.cancel();
  }, [speakNow, sentenceText, sceneIdx, sentence, speed, epoch, narrator]);

  // stop talking when the player goes away
  useEffect(() => () => narrator.cancel(), [narrator]);

  // a hidden tab pauses (no narration into an empty room)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') dispatch({ type: 'pause' });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const props = useMemo(() => (scene ? activeProps(scene, state.elapsed) : {}), [scene, state.elapsed]);
  const caption = scene ? captionFor(scene, state.sentence) : '';

  const api = {
    play: useCallback(() => dispatch({ type: 'play' }), []),
    pause: useCallback(() => dispatch({ type: 'pause' }), []),
    toggle: useCallback(() => dispatch({ type: 'toggle' }), []),
    seek: useCallback((scene: number, at?: number) => dispatch({ type: 'seek', scene, at }), []),
    back: useCallback((seconds = 10) => dispatch({ type: 'back', seconds }), []),
    setSpeed: useCallback((speed: number) => dispatch({ type: 'speed', speed }), []),
    answered: useCallback(() => dispatch({ type: 'answered' }), []),
    watchAgain: useCallback(() => dispatch({ type: 'watchAgain' }), []),
    restart: useCallback(() => dispatch({ type: 'restart' }), []),
  };

  return {
    state,
    timeline,
    props,
    caption,
    position: position(timeline, state),
    ...api,
  };
}
