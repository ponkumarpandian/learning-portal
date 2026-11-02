/**
 * Explainer timeline — the pure part of the player (SPEC §7.2–7.4). No React, no timers, no DOM:
 * `step(scenes, state, action)` is a reducer the `useExplainerTimeline` hook drives with ticks and
 * narration events, so every rule here is unit-tested with plain data.
 *
 * Rules:
 *  - A scene lasts max(narration end, minDuration), then moves on by itself.
 *    · narrated: "narration end" = the narrator finished the last sentence (sentence-by-sentence).
 *    · captions only (no voice, or narration muted): narration end = the estimate from
 *      estimateSceneSeconds (words ÷ 2.3), and the caption sentence follows elapsed time.
 *  - Steps apply when `at` ≤ elapsed (scene seconds), merged over the scene props in order.
 *  - A scene with a checkpoint pauses at its end ('checkpoint') until the question is answered.
 *    "Watch that part again" replays the scene from its start and asks again at its end.
 *  - Reaching the end with checkpoints skipped (by seeking) asks those before 'ended' — "watched"
 *    means every checkpoint was answered (§7.2).
 *  - Speed scales scene time (0.75× / 1× / 1.25×). back(10) crosses into the previous scene.
 */
import type { Scene } from '@/content';
import { estimateSceneSeconds } from '@/content/validate';
import { splitSentences } from './speech';

export const SPEEDS = [0.75, 1, 1.25] as const;
export type Speed = (typeof SPEEDS)[number];

type TimedScene = Pick<Scene, 'narration' | 'minDuration' | 'props' | 'steps' | 'checkpoint' | 'captions'>;

/** Seconds the narration takes at 1× (the validator's estimate, without minDuration). */
export function narrationSeconds(narration: string): number {
  return estimateSceneSeconds({ narration, minDuration: 0 });
}

/** Scene length on the progress bar (estimate): max(narration estimate, minDuration). */
export function sceneSeconds(scene: Pick<Scene, 'narration' | 'minDuration'>): number {
  return estimateSceneSeconds(scene);
}

export interface SentenceTiming {
  text: string;
  start: number;
  end: number;
}

/** Captions-only timing: each sentence gets a share of the narration estimate by word count. */
export function sentenceTimings(narration: string): SentenceTiming[] {
  const sentences = splitSentences(narration);
  const words = sentences.map((s) => s.split(/\s+/).filter(Boolean).length || 1);
  const totalWords = words.reduce((a, b) => a + b, 0);
  const total = narrationSeconds(narration);
  let t = 0;
  return sentences.map((text, i) => {
    const len = (total * (words[i] ?? 1)) / totalWords;
    const out = { text, start: t, end: t + len };
    t += len;
    return out;
  });
}

/** Index of the sentence playing at `t` seconds (clamped to the first/last). */
export function sentenceAt(timings: readonly SentenceTiming[], t: number): number {
  let idx = 0;
  timings.forEach((s, i) => {
    if (s.start <= t) idx = i;
  });
  return idx;
}

/** Scene props with every step whose `at` ≤ elapsed merged on top (in `at` order). */
export function activeProps(scene: Pick<Scene, 'props' | 'steps'>, elapsed: number): Record<string, unknown> {
  const steps = [...(scene.steps ?? [])].sort((a, b) => a.at - b.at);
  let out: Record<string, unknown> = { ...scene.props };
  for (const st of steps) if (st.at <= elapsed) out = { ...out, ...st.props };
  return out;
}

/** How many steps have fired by `elapsed` (0 = only the scene props). */
export function stepsFired(scene: Pick<Scene, 'steps'>, elapsed: number): number {
  return (scene.steps ?? []).filter((s) => s.at <= elapsed).length;
}

/** A short name for the progress bar: the `label` prop, else the first words of the narration. */
export function sceneName(scene: Pick<Scene, 'narration' | 'props'>, maxWords = 5): string {
  const label = scene.props.label;
  if (typeof label === 'string' && label.trim() && !/^fig\.?\s/i.test(label)) return label.trim();
  const first = splitSentences(scene.narration)[0] ?? scene.narration;
  const words = first.replace(/[.!?…,:;—]+$/u, '').split(/\s+/);
  return words.length > maxWords ? `${words.slice(0, maxWords).join(' ')}…` : words.join(' ');
}

/** The caption for a narration sentence. Separate `captions` are spread over the narration. */
export function captionFor(scene: Pick<Scene, 'narration' | 'captions'>, sentence: number): string {
  const spoken = splitSentences(scene.narration);
  if (!scene.captions?.trim()) return spoken[Math.min(sentence, spoken.length - 1)] ?? scene.narration;
  const shown = splitSentences(scene.captions);
  const idx = Math.min(shown.length - 1, Math.floor((sentence * shown.length) / spoken.length));
  return shown[idx] ?? scene.captions;
}

export interface TimelineScene {
  index: number;
  name: string;
  /** seconds from the start of the explainer (estimate) */
  start: number;
  duration: number;
  checkpoint: boolean;
}

export function buildTimeline(
  scenes: readonly Pick<Scene, 'narration' | 'minDuration' | 'props' | 'checkpoint'>[],
): {
  scenes: TimelineScene[];
  total: number;
} {
  let t = 0;
  const out = scenes.map((s, index) => {
    const duration = sceneSeconds(s);
    const row = { index, name: sceneName(s), start: t, duration, checkpoint: Boolean(s.checkpoint) };
    t += duration;
    return row;
  });
  return { scenes: out, total: t };
}

/* ---------- player state machine ---------- */

export type PlayerStatus = 'ready' | 'playing' | 'paused' | 'checkpoint' | 'ended';

export interface PlayerState {
  scene: number;
  /** scene seconds elapsed (scaled by speed) */
  elapsed: number;
  status: PlayerStatus;
  speed: number;
  /** true when a voice speaks the narration (sentence events drive the captions) */
  narrated: boolean;
  /** caption / narration sentence index in the current scene */
  sentence: number;
  narrationDone: boolean;
  /** per scene: its checkpoint has been answered */
  answered: boolean[];
  /** scene whose checkpoint is on screen */
  asking: number | null;
  /** asking the checkpoints that were skipped, after the last scene */
  sweeping: boolean;
  /** bumps on every seek, so narration restarts even inside the same sentence */
  epoch: number;
}

export type PlayerAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  | { type: 'tick'; dt: number }
  | { type: 'sentenceEnd'; scene: number; sentence: number }
  | { type: 'seek'; scene: number; at?: number }
  | { type: 'back'; seconds: number }
  | { type: 'speed'; speed: number }
  | { type: 'narrated'; on: boolean }
  | { type: 'answered' }
  | { type: 'watchAgain' }
  | { type: 'restart' };

export function initialState(
  scenes: readonly TimedScene[],
  opts: { speed?: number; narrated?: boolean; scene?: number } = {},
): PlayerState {
  const scene = clampScene(scenes, opts.scene ?? 0);
  return {
    scene,
    elapsed: 0,
    status: 'ready',
    speed: opts.speed ?? 1,
    narrated: opts.narrated ?? false,
    sentence: 0,
    narrationDone: false,
    answered: scenes.map(() => false),
    asking: null,
    sweeping: false,
    epoch: 0,
  };
}

function clampScene(scenes: readonly unknown[], i: number): number {
  return Math.max(0, Math.min(scenes.length - 1, Math.floor(i)));
}

/** Safety net: a voice that never reports the end still lets the scene finish. */
function narrationTimeout(scene: TimedScene): number {
  return narrationSeconds(scene.narration) * 2 + 5;
}

function sceneComplete(scene: TimedScene, s: PlayerState): boolean {
  return s.narrationDone && s.elapsed >= scene.minDuration;
}

function firstUnanswered(scenes: readonly TimedScene[], s: PlayerState): number {
  return scenes.findIndex((sc, i) => sc.checkpoint && !s.answered[i]);
}

function enterScene(s: PlayerState, scene: number, at = 0, scenes: readonly TimedScene[]): PlayerState {
  const sc = scenes[scene];
  const timings = sc ? sentenceTimings(sc.narration) : [];
  return {
    ...s,
    scene,
    elapsed: at,
    sentence: sentenceAt(timings, at),
    narrationDone: sc ? at >= narrationSeconds(sc.narration) && !s.narrated : false,
    asking: null,
    epoch: s.epoch + 1,
  };
}

/** The scene just finished: ask its checkpoint, go to the next scene, or finish. */
function advance(scenes: readonly TimedScene[], s: PlayerState): PlayerState {
  const sc = scenes[s.scene];
  if (sc?.checkpoint && !s.answered[s.scene]) return { ...s, status: 'checkpoint', asking: s.scene };
  if (s.scene + 1 < scenes.length) return { ...enterScene(s, s.scene + 1, 0, scenes), status: 'playing' };
  return finish(scenes, s);
}

function finish(scenes: readonly TimedScene[], s: PlayerState): PlayerState {
  const missing = firstUnanswered(scenes, s);
  if (missing >= 0) {
    const sc = scenes[missing]!;
    const end = sceneSeconds(sc);
    return {
      ...s,
      scene: missing,
      elapsed: end,
      sentence: Math.max(0, splitSentences(sc.narration).length - 1),
      narrationDone: true,
      status: 'checkpoint',
      asking: missing,
      sweeping: true,
    };
  }
  const last = scenes.length - 1;
  return { ...s, status: 'ended', asking: null, sweeping: false, scene: last, narrationDone: true };
}

export function step(scenes: readonly TimedScene[], s: PlayerState, a: PlayerAction): PlayerState {
  const sc = scenes[s.scene];
  if (!sc) return s;
  switch (a.type) {
    case 'play':
      if (s.status === 'ended') return { ...enterScene(s, 0, 0, scenes), status: 'playing' };
      if (s.status === 'ready' || s.status === 'paused') return { ...s, status: 'playing' };
      return s;
    case 'pause':
      return s.status === 'playing' ? { ...s, status: 'paused' } : s;
    case 'toggle':
      return step(scenes, s, { type: s.status === 'playing' ? 'pause' : 'play' });
    case 'tick': {
      if (s.status !== 'playing' || !(a.dt > 0)) return s;
      const elapsed = s.elapsed + a.dt * s.speed;
      let next: PlayerState = { ...s, elapsed };
      if (!s.narrated) {
        next.sentence = sentenceAt(sentenceTimings(sc.narration), elapsed);
        next.narrationDone = elapsed >= narrationSeconds(sc.narration);
      } else if (elapsed >= narrationTimeout(sc)) {
        next.narrationDone = true;
      }
      if (sceneComplete(sc, next)) next = advance(scenes, next);
      return next;
    }
    case 'sentenceEnd': {
      if (!s.narrated || a.scene !== s.scene || a.sentence !== s.sentence || s.narrationDone) return s;
      const count = splitSentences(sc.narration).length;
      let next: PlayerState =
        a.sentence + 1 < count ? { ...s, sentence: a.sentence + 1 } : { ...s, narrationDone: true };
      if (next.status === 'playing' && sceneComplete(sc, next)) next = advance(scenes, next);
      return next;
    }
    case 'seek': {
      const scene = clampScene(scenes, a.scene);
      const max = sceneSeconds(scenes[scene]!);
      const at = Math.max(0, Math.min(a.at ?? 0, Math.max(0, max - 0.5)));
      const status = s.status === 'paused' ? 'paused' : 'playing';
      return { ...enterScene(s, scene, at, scenes), status, sweeping: false };
    }
    case 'back': {
      const t = s.elapsed - a.seconds;
      if (t >= 0 || s.scene === 0)
        return step(scenes, s, { type: 'seek', scene: s.scene, at: Math.max(0, t) });
      const prev = scenes[s.scene - 1]!;
      return step(scenes, s, { type: 'seek', scene: s.scene - 1, at: Math.max(0, sceneSeconds(prev) + t) });
    }
    case 'speed':
      return a.speed > 0 ? { ...s, speed: a.speed, epoch: s.epoch + 1 } : s;
    case 'narrated':
      return a.on === s.narrated ? s : { ...s, narrated: a.on, epoch: s.epoch + 1 };
    case 'answered': {
      if (s.asking === null) return s;
      const answered = s.answered.map((v, i) => (i === s.asking ? true : v));
      const base: PlayerState = { ...s, answered, asking: null, scene: s.asking };
      if (s.sweeping) return finish(scenes, base);
      if (base.scene + 1 < scenes.length)
        return { ...enterScene(base, base.scene + 1, 0, scenes), status: 'playing' };
      return finish(scenes, base);
    }
    case 'watchAgain': {
      if (s.asking === null) return s;
      return { ...enterScene(s, s.asking, 0, scenes), status: 'playing' };
    }
    case 'restart':
      return { ...enterScene(s, 0, 0, scenes), status: 'playing', sweeping: false };
  }
}

/** Seconds from the start of the explainer (estimate), for the progress bar. */
export function position(
  timeline: { scenes: readonly TimelineScene[] },
  s: Pick<PlayerState, 'scene' | 'elapsed'>,
): number {
  const row = timeline.scenes[s.scene];
  if (!row) return 0;
  return row.start + Math.min(s.elapsed, row.duration);
}

/** Scene index + scene seconds for a global time (estimate) — used by seekTo({ at }). */
export function locate(
  timeline: { scenes: readonly TimelineScene[] },
  t: number,
): { scene: number; at: number } {
  const rows = timeline.scenes;
  for (const r of rows) if (t < r.start + r.duration) return { scene: r.index, at: Math.max(0, t - r.start) };
  const last = rows.at(-1);
  return { scene: last?.index ?? 0, at: 0 };
}
