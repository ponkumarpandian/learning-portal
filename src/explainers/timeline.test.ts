import type { Scene } from '@/content';
import { estimateSceneSeconds } from '@/content/validate';
import {
  activeProps,
  buildTimeline,
  captionFor,
  initialState,
  locate,
  narrationSeconds,
  position,
  sceneName,
  sentenceAt,
  sentenceTimings,
  step,
  stepsFired,
  type PlayerAction,
  type PlayerState,
} from './timeline';

const scene = (over: Partial<Scene> = {}): Scene => ({
  visual: 'ParticleBox',
  props: { state: 'solid' },
  narration: 'One two three. Four five six!',
  minDuration: 4,
  ...over,
});

/** three scenes: 0 plain (4 s), 1 with a checkpoint (6 s), 2 plain (4 s) */
const SCENES: Scene[] = [
  scene(),
  scene({
    minDuration: 6,
    checkpoint: { questionId: 'q-1' },
    steps: [{ at: 2, props: { state: 'liquid' } }],
  }),
  scene({ narration: 'Last one.' }),
];

const run = (s: PlayerState, ...actions: PlayerAction[]) =>
  actions.reduce((acc, a) => step(SCENES, acc, a), s);
const tick = (seconds: number, dt = 0.2): PlayerAction[] =>
  Array.from({ length: Math.round(seconds / dt) }, () => ({ type: 'tick', dt }) as const);
const playing = (over: Partial<PlayerState> = {}) => ({
  ...run(initialState(SCENES), { type: 'play' }),
  ...over,
});

describe('timeline helpers', () => {
  it.each([
    [0, { state: 'solid' }],
    [1.9, { state: 'solid' }],
    [2, { state: 'liquid' }],
    [99, { state: 'liquid' }],
  ])('activeProps at %ss', (t, expected) => {
    expect(activeProps(SCENES[1]!, t)).toEqual(expected);
  });

  it('merges steps in `at` order whatever order they are written in', () => {
    const sc = scene({
      props: { a: 0 },
      steps: [
        { at: 8, props: { a: 2 } },
        { at: 4, props: { a: 1, b: true } },
      ],
    });
    expect(activeProps(sc, 5)).toEqual({ a: 1, b: true });
    expect(activeProps(sc, 9)).toEqual({ a: 2, b: true });
    expect(stepsFired(sc, 5)).toBe(1);
  });

  it('sentence timings share the validator estimate by word count', () => {
    const t = sentenceTimings('One two three. Four five six!');
    expect(t.map((s) => s.text)).toEqual(['One two three.', 'Four five six!']);
    expect(t[1]!.end).toBeCloseTo(narrationSeconds('One two three. Four five six!'));
    expect(t[0]!.end).toBeCloseTo(t[1]!.start);
    expect(sentenceAt(t, 0)).toBe(0);
    expect(sentenceAt(t, t[1]!.start + 0.01)).toBe(1);
    expect(sentenceAt(t, 1e9)).toBe(1);
  });

  it('names scenes by label, else the first words of the narration', () => {
    expect(sceneName(scene({ props: { label: 'Solid' } }))).toBe('Solid');
    expect(
      sceneName(
        scene({
          props: { label: 'Fig. 3.12' },
          narration: 'In solids, the molecules are very tightly packed.',
        }),
      ),
    ).toBe('In solids, the molecules are…');
    expect(sceneName(scene({ narration: 'Look around you. More.' }))).toBe('Look around you');
  });

  it('captions default to the narration sentence; separate captions are spread over it', () => {
    expect(captionFor(SCENES[0]!, 1)).toBe('Four five six!');
    expect(captionFor(scene({ captions: 'Only one caption.' }), 1)).toBe('Only one caption.');
  });

  it('builds the progress bar from estimateSceneSeconds', () => {
    const tl = buildTimeline(SCENES);
    expect(tl.scenes.map((s) => s.duration)).toEqual(SCENES.map(estimateSceneSeconds));
    expect(tl.total).toBe(SCENES.reduce((n, s) => n + estimateSceneSeconds(s), 0));
    expect(tl.scenes[1]).toMatchObject({ start: 4, checkpoint: true });
    expect(position(tl, { scene: 1, elapsed: 2 })).toBe(6);
    expect(locate(tl, 6)).toEqual({ scene: 1, at: 2 });
    expect(locate(tl, 1e6)).toEqual({ scene: 2, at: 0 });
  });
});

describe('player state machine (captions only)', () => {
  it('waits for play, then advances after max(narration, minDuration)', () => {
    const s0 = initialState(SCENES);
    expect(run(s0, ...tick(10)).scene).toBe(0); // not playing yet
    const s = run(s0, { type: 'play' }, ...tick(3.8));
    expect(s).toMatchObject({ scene: 0, status: 'playing' });
    expect(run(s, ...tick(0.4)).scene).toBe(1);
  });

  it('captions follow elapsed time', () => {
    const s = run(playing(), ...tick(narrationSeconds(SCENES[0]!.narration) * 0.75));
    expect(s.sentence).toBe(1);
  });

  it('pauses at the end of a checkpoint scene until answered, then plays the next scene', () => {
    const at = run(playing({ scene: 1 }), ...tick(6.2));
    expect(at).toMatchObject({ status: 'checkpoint', asking: 1, scene: 1 });
    expect(run(at, ...tick(20))).toMatchObject({ status: 'checkpoint', asking: 1 });
    const next = run(at, { type: 'answered' });
    expect(next).toMatchObject({ status: 'playing', scene: 2, asking: null });
    expect(next.answered[1]).toBe(true);
  });

  it('"watch that part again" replays the scene and asks again at its end', () => {
    const at = run(playing({ scene: 1 }), ...tick(6.2));
    const again = run(at, { type: 'watchAgain' });
    expect(again).toMatchObject({ status: 'playing', scene: 1, elapsed: 0, asking: null });
    expect(run(again, ...tick(6.2))).toMatchObject({ status: 'checkpoint', asking: 1 });
  });

  it('ends after the last scene; checkpoints skipped by seeking are asked first', () => {
    const skipped = run(playing(), { type: 'seek', scene: 2 }, ...tick(4.2));
    expect(skipped).toMatchObject({ status: 'checkpoint', asking: 1, sweeping: true });
    expect(run(skipped, { type: 'answered' })).toMatchObject({ status: 'ended' });

    const all = run(playing({ scene: 1 }), ...tick(6.2), { type: 'answered' }, ...tick(4.2));
    expect(all.status).toBe('ended');
    expect(run(all, { type: 'play' })).toMatchObject({ status: 'playing', scene: 0, elapsed: 0 });
  });

  it('pause / toggle / speed', () => {
    const p = run(playing(), { type: 'pause' }, ...tick(5));
    expect(p).toMatchObject({ status: 'paused', elapsed: 0 });
    expect(run(p, { type: 'toggle' }).status).toBe('playing');
    const fast = run(playing(), { type: 'speed', speed: 1.25 }, ...tick(2));
    expect(fast.elapsed).toBeCloseTo(2.5);
    const slow = run(playing(), { type: 'speed', speed: 0.75 }, ...tick(2));
    expect(slow.elapsed).toBeCloseTo(1.5);
    expect(run(playing(), { type: 'speed', speed: 0 }).speed).toBe(1);
  });

  it('back 10 s crosses into the previous scene; seek clamps', () => {
    const s = run(playing({ scene: 2 }), ...tick(2), { type: 'back', seconds: 10 });
    const prev = estimateSceneSeconds(SCENES[1]!);
    expect(s.scene).toBe(1);
    expect(s.elapsed).toBeCloseTo(Math.max(0, prev - 8));
    expect(run(playing(), { type: 'back', seconds: 10 })).toMatchObject({ scene: 0, elapsed: 0 });
    expect(run(playing(), { type: 'seek', scene: 99 }).scene).toBe(2);
    expect(run(playing(), { type: 'seek', scene: 0, at: 999 }).elapsed).toBeLessThan(
      estimateSceneSeconds(SCENES[0]!),
    );
    const paused = run(playing(), { type: 'pause' }, { type: 'seek', scene: 1 });
    expect(paused.status).toBe('paused');
  });
});

describe('player state machine (narrated)', () => {
  const narrated = () => ({ ...run(initialState(SCENES, { narrated: true }), { type: 'play' }) });

  it('sentences end one by one; the scene waits for the voice, then for minDuration', () => {
    let s = run(narrated(), ...tick(5));
    expect(s.scene).toBe(0); // the voice has not finished
    s = run(s, { type: 'sentenceEnd', scene: 0, sentence: 0 });
    expect(s.sentence).toBe(1);
    s = run(s, { type: 'sentenceEnd', scene: 0, sentence: 0 }); // stale event: ignored
    expect(s.sentence).toBe(1);
    s = run(s, { type: 'sentenceEnd', scene: 0, sentence: 1 });
    expect(s).toMatchObject({ scene: 1, status: 'playing' }); // minDuration (4 s) already passed

    let early = run(
      narrated(),
      { type: 'sentenceEnd', scene: 0, sentence: 0 },
      { type: 'sentenceEnd', scene: 0, sentence: 1 },
    );
    expect(early).toMatchObject({ scene: 0, narrationDone: true });
    early = run(early, ...tick(4.2));
    expect(early.scene).toBe(1);
  });

  it('a voice that never finishes cannot hold the scene forever', () => {
    const s = run(narrated(), ...tick(narrationSeconds(SCENES[0]!.narration) * 2 + 6));
    expect(s.scene).toBe(1);
  });

  it('switching narration off mid-scene falls back to caption timing', () => {
    const s = run(narrated(), { type: 'narrated', on: false }, ...tick(4.2));
    expect(s.scene).toBe(1);
  });
});
