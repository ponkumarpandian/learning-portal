import { loadContent, type Lesson, type Slot } from '@/content';
import type { LessonProgressRecord } from '@/db/repos';
import type { GradeResult } from '@/engine/grading';
import {
  EYE_BREAK_AFTER_SEC,
  EYE_BREAK_SNOOZE_SEC,
  answerHomework,
  canGoBack,
  canGoNext,
  caterpillarFor,
  checkScore,
  completesLesson,
  currentQuestion,
  emptyData,
  eyeBreakDue,
  freshEyes,
  goBack,
  goNext,
  lessonAfter,
  pickLesson,
  planFlow,
  recordAnswer,
  resolveSlot,
  restoreData,
  resumeIndex,
  rewatchFor,
  similarQuestion,
  skippedEyeBreak,
  slotKeyOf,
  starsFor,
  tickEyes,
  tookEyeBreak,
  type FlowPlan,
  type LessonData,
  type Position,
} from './lessonFlow';

const bundle = loadContent();
const chem = bundle.chapters.find((c) => c.id === 'che-matter')!;
const phys = bundle.chapters.find((c) => c.id === 'phy-light')!;
const che1 = chem.lessons[0]!;
const phy1 = phys.lessons[0]!;
const FRI_CHEM = bundle.timetable.days.fri.findIndex((s) => s.subject === 'chemistry');
const MON_PHYS = bundle.timetable.days.mon.findIndex((s) => s.subject === 'physics');
const slot45: Slot = { kind: 'lesson', start: '18:30', end: '19:15', subject: 'chemistry' };
const hw45: Slot = { kind: 'homework_lesson', start: '18:30', end: '19:15', subject: 'chemistry' };
const hw50: Slot = { ...hw45, end: '19:20' };

const ok: GradeResult = { score: 1, correct: true, yourAnswer: 'a', correctAnswer: 'a' };
const notQuite: GradeResult = { score: 0, correct: false, yourAnswer: 'b', correctAnswer: 'a' };
const rec = (result: GradeResult) => ({
  response: { type: 'mcq' as const, choice: 'x' },
  result,
  tries: 1,
  revealed: false,
});

const progress = (
  lessonId: string,
  status: LessonProgressRecord['status'],
  slotKey: string,
  at = 1,
): LessonProgressRecord => ({
  lessonId,
  status,
  step: 0,
  data: { slotKey },
  startedAt: at,
  updatedAt: at,
  completedAt: status === 'done' ? at : undefined,
});

describe('resolveSlot (§5.2)', () => {
  it('finds the timetable slots the tests rely on', () => {
    expect(FRI_CHEM).toBe(4);
    expect(MON_PHYS).toBe(3);
  });

  it.each([
    // [date, slot, today, kind]
    ['2026-11-06', String(FRI_CHEM), '2026-11-06', 'lesson'], // Friday chemistry, today
    ['2026-11-07', '2', '2026-11-06', 'other_day'], // tomorrow is locked
    ['2026-11-05', '1', '2026-11-06', 'lesson'], // yesterday's physics: open, to catch up
    ['2026-10-26', '3', '2026-11-06', 'lesson'], // last week's Monday physics: still open
    ['2026-11-01', '0', '2026-11-06', 'coming_soon'], // last Sunday's revise is still "soon"
    ['2026-11-08', '0', '2026-11-08', 'coming_soon'], // Sunday revise (4 subjects)
    ['2026-11-08', '1', '2026-11-08', 'coming_soon'], // Sunday test
    ['2026-11-07', '7', '2026-11-07', 'lesson'], // Saturday English fix-it → plays the next lesson
    ['2026-11-06', '0', '2026-11-06', 'coming_soon'], // an activity / break has no lesson
    ['2026-11-06', '99', '2026-11-06', 'invalid'],
    ['nope', '1', '2026-11-06', 'invalid'],
    ['2026-11-06', 'x', '2026-11-06', 'invalid'],
  ])('%s #%s (today %s) → %s', (date, slot, today, kind) => {
    expect(resolveSlot(bundle, date, slot, today).kind).toBe(kind);
  });

  it('knows past from future, and builds the slot key', () => {
    expect(resolveSlot(bundle, '2026-11-07', '2', '2026-11-06')).toMatchObject({ when: 'future' });
    expect(resolveSlot(bundle, '2026-11-05', '1', '2026-11-06')).toMatchObject({
      kind: 'lesson',
      past: true,
      slotKey: '2026-11-05#1',
      subject: { id: 'physics' },
    });
    expect(resolveSlot(bundle, '2026-11-06', '4', '2026-11-06')).toMatchObject({ past: false });
    expect(resolveSlot(bundle, '2026-11-06', '4', '2026-11-06')).toMatchObject({
      slotKey: '2026-11-06#4',
      slotIndex: 4,
      subject: { id: 'chemistry' },
    });
  });
});

describe('pickLesson (§9.2)', () => {
  it('starts the chemistry queue at che-matter-1, then che-matter-2 once it is done', () => {
    expect(pickLesson(bundle, 'chemistry', '2026-11-06#4', [])?.lesson.id).toBe('che-matter-1');
    const after = pickLesson(bundle, 'chemistry', '2026-11-07#2', [
      progress('che-matter-1', 'done', '2026-11-06#4'),
    ]);
    expect(after?.lesson.id).toBe('che-matter-2');
    expect(after?.lastDone?.id).toBe('che-matter-1');
    expect(after?.resume).toBeUndefined();
  });

  it('resumes the lesson already started in this slot (even a finished one)', () => {
    const recs = [progress('che-matter-1', 'done', '2026-11-06#4')];
    const p = pickLesson(bundle, 'chemistry', '2026-11-06#4', recs);
    expect(p?.lesson.id).toBe('che-matter-1');
    expect(p?.resume).toBe(recs[0]);
  });

  it('a lesson left unfinished in another slot stays at the front of the queue', () => {
    const p = pickLesson(bundle, 'chemistry', '2026-11-07#2', [
      progress('che-matter-1', 'in_progress', '2026-11-06#4'),
    ]);
    expect(p?.lesson.id).toBe('che-matter-1');
    expect(p?.resume).toBeUndefined();
  });

  it('picks the sample physics lesson, and nothing for a subject with no chapters', () => {
    expect(pickLesson(bundle, 'physics', 'x', [])?.lesson.id).toBe('phy-light-1');
    expect(pickLesson(bundle, 'english', 'x', [])).toBeUndefined();
    expect(pickLesson(bundle, 'physics', 'x', [progress('phy-light-1', 'done', 'y')])).toBeUndefined();
  });

  it('lessonAfter / slotKeyOf', () => {
    expect(lessonAfter(bundle, 'chemistry', 'che-matter-1')?.id).toBe('che-matter-2');
    expect(lessonAfter(bundle, 'chemistry', 'che-matter-4')).toBeUndefined();
    expect(lessonAfter(bundle, 'chemistry', 'nope')).toBeUndefined();
    expect(slotKeyOf(progress('a', 'done', 'k'))).toBe('k');
    expect(slotKeyOf({ data: 3 })).toBeUndefined();
    expect(slotKeyOf(undefined)).toBeUndefined();
  });
});

describe('planFlow (§5.3, §5.4, §6)', () => {
  it('a 45-minute chemistry slot: watch → learn → try → notebook → check (5) → feedback → stars', () => {
    const p = planFlow({ lesson: che1, slot: slot45 });
    expect(p.steps).toEqual(['watch', 'learn', 'try', 'notebook', 'check', 'feedback', 'stars']);
    expect(p.template?.kind).toBe('full');
    expect(p.checkQuestions).toHaveLength(5);
    expect(completesLesson(p)).toBe(true);
  });

  it('the physics lesson opens with its warm-up', () => {
    const slot = bundle.timetable.days.mon[MON_PHYS]!;
    const p = planFlow({ lesson: phy1, slot });
    expect(p.steps[0]).toBe('warmup');
    expect(p.checkQuestions.map((q) => q.id)).toEqual(phy1.check.map((q) => q.id));
  });

  it('a 30-minute slot asks 3 check questions', () => {
    const p = planFlow({ lesson: che1, slot: { ...slot45, end: '19:00' } });
    expect(p.checkQuestions).toHaveLength(3);
  });

  it.each([
    // [homework minutes, steps, kind, check questions]
    [undefined, ['homework_ask'], undefined, 0],
    [0, ['homework_ask', 'watch', 'learn', 'try', 'notebook', 'check', 'feedback', 'stars'], 'full', 5],
    [
      15,
      ['homework_ask', 'homework_timer', 'watch', 'learn', 'try', 'notebook', 'check', 'feedback', 'stars'],
      'full',
      3,
    ],
    // 15 minutes left is under 20 → Check only (§5.3; the engine's table)
    [30, ['homework_ask', 'homework_timer', 'check', 'feedback', 'stars'], 'check_only', 3],
    [45, ['homework_ask', 'homework_timer', 'check', 'feedback', 'stars'], 'check_only', 3],
  ] as const)('homework %s min on a 45-min slot → %j', (hw, steps, kind, n) => {
    const p = planFlow({ lesson: che1, slot: hw45, homeworkMinutes: hw });
    expect(p.steps).toEqual(steps);
    expect(p.template?.kind).toBe(kind);
    expect(p.checkQuestions).toHaveLength(n);
  });

  it('20–29 minutes left → the mini lesson: watch + a 3-question check', () => {
    const p = planFlow({ lesson: che1, slot: hw50, homeworkMinutes: 30 });
    expect(p.template?.kind).toBe('mini');
    expect(p.steps).toEqual(['homework_ask', 'homework_timer', 'watch', 'check', 'feedback', 'stars']);
    expect(p.checkQuestions).toHaveLength(3);
  });

  it('check only uses the last done lesson (or this one when none is done)', () => {
    const che2 = chem.lessons[1]!;
    expect(
      planFlow({ lesson: che2, slot: hw45, homeworkMinutes: 45, lastDone: che1 }).checkQuestions[0]?.id,
    ).toBe(che1.check[0]!.id);
    expect(planFlow({ lesson: che2, slot: hw45, homeworkMinutes: 45 }).checkLesson.id).toBe(che2.id);
    expect(completesLesson(planFlow({ lesson: che2, slot: hw45, homeworkMinutes: 30 }))).toBe(false);
  });

  it('skips steps the lesson has no content for', () => {
    const bare: Lesson = { ...che1, practice: [], notebook: ' ', check: [], warmup: [] };
    expect(planFlow({ lesson: bare, slot: slot45 }).steps).toEqual(['watch', 'learn', 'stars']);
  });
});

describe('caterpillarFor', () => {
  it('maps warm-up to Watch, notebook to Try, feedback to Check; homework is before all of them', () => {
    const full = planFlow({ lesson: phy1, slot: slot45 }).steps;
    expect(caterpillarFor(full, 'warmup')).toMatchObject({ current: 0 });
    expect(caterpillarFor(full, 'notebook')).toMatchObject({ current: 2 });
    expect(caterpillarFor(full, 'feedback')).toMatchObject({ current: 3 });
    expect(caterpillarFor(full, 'stars').steps.map((s) => s.label)).toEqual([
      'Watch',
      'Learn',
      'Try',
      'Check',
      'Stars',
    ]);
    const mini = planFlow({ lesson: che1, slot: hw50, homeworkMinutes: 30 }).steps;
    expect(caterpillarFor(mini, 'homework_timer')).toMatchObject({ current: -1 });
    expect(caterpillarFor(mini, 'check').steps.map((s) => s.label)).toEqual(['Watch', 'Check', 'Stars']);
    expect(caterpillarFor(mini, 'check').current).toBe(1);
  });
});

/** Walks a whole lesson through the model, the way the screen does. */
function walk(lesson: Lesson, plan: FlowPlan, start: Position): Position {
  let pos = start;
  for (let guard = 0; guard < 200; guard++) {
    const step = plan.steps[pos.stepIndex];
    if (step === 'stars') return pos;
    if (step === 'warmup' && pos.data.flashcards.length < (lesson.warmup?.length ?? 0)) {
      pos = { ...pos, data: { ...pos.data, flashcards: [...pos.data.flashcards, true] } };
      continue;
    }
    if (step === 'watch' && !pos.data.watched) {
      expect(canGoNext(pos, lesson, plan)).toBe(false); // never skips the video the first time
      pos = { ...pos, data: { ...pos.data, watched: true, checkpointsAllCorrect: true } };
      continue;
    }
    if (step === 'try' || step === 'check') {
      const kind = step === 'try' ? 'practice' : 'check';
      const q = currentQuestion(kind, pos.data, lesson, plan);
      if (q) {
        expect(canGoNext(pos, lesson, plan)).toBe(false);
        pos = { ...pos, data: recordAnswer(pos.data, kind, q.id, rec(ok)) };
        continue;
      }
    }
    pos = goNext(pos, lesson, plan);
  }
  throw new Error('the lesson never reached the stars');
}

describe('moving through a lesson (§6)', () => {
  it('the sample physics lesson can be completed from start to finish', () => {
    const slot = bundle.timetable.days.mon[MON_PHYS]!;
    const plan = planFlow({ lesson: phy1, slot });
    const end = walk(phy1, plan, { stepIndex: 0, data: emptyData('2026-11-02#3') });
    expect(plan.steps[end.stepIndex]).toBe('stars');
    expect(end.data.practiceDone).toBe(phy1.practice.length);
    expect(checkScore(plan, end.data)).toEqual({ score: 3, max: 3, fraction: 1 });
    expect(starsFor(plan, { ...end.data, checkpoints: { a: true } })).toEqual({
      finish: 1,
      check: 1,
      checkpoints: 1,
      total: 3,
    });
  });

  it('learn cards go one by one; Back walks them back and then to the video', () => {
    const plan = planFlow({ lesson: che1, slot: slot45 });
    let pos: Position = { stepIndex: 0, data: { ...emptyData('k'), watched: true } };
    pos = goNext(pos, che1, plan);
    expect(plan.steps[pos.stepIndex]).toBe('learn');
    expect(pos.data.cardIndex).toBe(0);
    pos = goNext(goNext(pos, che1, plan), che1, plan);
    expect(pos.data.cardIndex).toBe(2);
    pos = goBack(goBack(goBack(pos, che1, plan), che1, plan), che1, plan);
    expect(plan.steps[pos.stepIndex]).toBe('watch');
    // coming forward again opens learn at its first card; Back into learn opens the last card
    pos = goNext(pos, che1, plan);
    expect(pos.data.cardIndex).toBe(0);
    const tryPos = goNext({ ...pos, data: { ...pos.data, cardIndex: che1.cards.length - 1 } }, che1, plan);
    expect(plan.steps[tryPos.stepIndex]).toBe('try');
    expect(goBack(tryPos, che1, plan).data.cardIndex).toBe(che1.cards.length - 1);
  });

  it('cannot skip ahead: Try needs its questions answered, but a step she passed can be revisited', () => {
    const plan = planFlow({ lesson: che1, slot: slot45 });
    const at = (step: string, data: Partial<LessonData> = {}): Position => ({
      stepIndex: plan.steps.indexOf(step as never),
      data: { ...emptyData('k'), ...data },
    });
    expect(canGoNext(at('try'), che1, plan)).toBe(false);
    expect(goNext(at('try'), che1, plan).stepIndex).toBe(plan.steps.indexOf('try'));
    expect(canGoNext(at('try', { furthest: 5 }), che1, plan)).toBe(true);
    expect(canGoNext(at('check'), che1, plan)).toBe(false);
    expect(canGoNext(at('notebook'), che1, plan)).toBe(true);
    expect(canGoNext(at('stars'), che1, plan)).toBe(false);
    expect(canGoBack(at('watch'), plan)).toBe(false);
    expect(goBack(at('watch'), che1, plan).stepIndex).toBe(0);
  });

  it('an unavailable video unlocks Next on the Watch step', () => {
    const plan = planFlow({ lesson: che1, slot: slot45 });
    expect(canGoNext({ stepIndex: 0, data: { ...emptyData('k'), unavailable: true } }, che1, plan)).toBe(
      true,
    );
  });

  it('homework: the answer opens the timer (or the lesson); Back goes to the question only from the timer', () => {
    const input = { lesson: che1, slot: hw50 };
    const thirty = answerHomework(emptyData('k'), 30, input);
    const plan30 = planFlow({ ...input, homeworkMinutes: 30 });
    expect(thirty).toMatchObject({ stepIndex: 1, data: { homeworkMinutes: 30, stepId: 'homework_timer' } });
    expect(canGoBack(thirty, plan30)).toBe(true);
    const watch = goNext(thirty, che1, plan30);
    expect(plan30.steps[watch.stepIndex]).toBe('watch');
    expect(canGoBack(watch, plan30)).toBe(false);
    const none = answerHomework(emptyData('k'), 0, input);
    expect(none.data.stepId).toBe('watch');
    expect(canGoNext({ stepIndex: 0, data: emptyData('k') }, che1, planFlow(input))).toBe(false);
  });

  it('resumes at the saved step id, falling back to the saved index', () => {
    const plan = planFlow({ lesson: che1, slot: slot45 });
    expect(resumeIndex(plan, { ...emptyData('k'), stepId: 'check' }, 0)).toBe(4);
    expect(resumeIndex(plan, emptyData('k'), 2)).toBe(2);
    expect(resumeIndex(plan, emptyData('k'), 99)).toBe(plan.steps.length - 1);
  });

  it('restoreData keeps saved answers for the same slot only', () => {
    const saved = { ...emptyData('k'), practiceDone: 2, answers: { q: { type: 'mcq', choice: 'x' } } };
    expect(restoreData(saved, 'k')).toMatchObject({ practiceDone: 2, answers: saved.answers });
    expect(restoreData(saved, 'other')).toEqual(emptyData('other'));
    expect(restoreData(null, 'k')).toEqual(emptyData('k'));
    expect(restoreData({ slotKey: 'k', watched: true }, 'k')).toMatchObject({
      watched: true,
      flashcards: [],
    });
  });
});

describe('answers, score and stars (§6, §10)', () => {
  const plan = planFlow({ lesson: che1, slot: slot45 });

  it('a practice answer counts once; the check keeps one result per question', () => {
    const q = che1.practice[0]!;
    let d = recordAnswer(emptyData('k'), 'practice', q.id, rec(notQuite));
    d = recordAnswer(d, 'practice', q.id, rec(ok));
    expect(d.practiceDone).toBe(1);
    expect(currentQuestion('practice', d, che1, plan)?.id).toBe(che1.practice[1]!.id);
    d = recordAnswer(d, 'check', plan.checkQuestions[0]!.id, rec(ok));
    expect(Object.keys(d.checkResults)).toHaveLength(1);
    expect(d.answers[q.id]).toEqual({ type: 'mcq', choice: 'x' });
  });

  it('scores the check and gives §10 stars', () => {
    const results = (n: number) =>
      Object.fromEntries(plan.checkQuestions.map((q, i) => [q.id, rec(i < n ? ok : notQuite)]));
    const four = { ...emptyData('k'), checkResults: results(4) };
    expect(checkScore(plan, four)).toEqual({ score: 4, max: 5, fraction: 0.8 });
    expect(starsFor(plan, four)).toEqual({ finish: 1, check: 1, checkpoints: 0, total: 2 });
    const three = { ...emptyData('k'), checkResults: results(3), checkpoints: { a: true, b: true } };
    expect(starsFor(plan, three)).toEqual({ finish: 1, check: 0, checkpoints: 1, total: 2 });
    expect(starsFor(plan, { ...three, checkpoints: { a: true, b: false } }).checkpoints).toBe(0);
    expect(starsFor(plan, { ...three, checkpointsAllCorrect: false }).checkpoints).toBe(0);
    expect(checkScore({ checkQuestions: [] }, four)).toEqual({ score: 0, max: 0, fraction: 0 });
  });
});

describe('video jumps and similar questions (§6.4, §8.4)', () => {
  it('rewatchFor maps a videoRef to which + seekTo', () => {
    expect(rewatchFor({ video: 'primary', scene: 2, at: 4 }, 7)).toEqual({
      which: 'primary',
      seekTo: { scene: 2, at: 4, nonce: 7 },
    });
    expect(rewatchFor(undefined, 1)).toEqual({
      which: 'primary',
      seekTo: { scene: undefined, at: undefined, nonce: 1 },
    });
  });

  it('a "similar one" exists only when a bank question is its variant', () => {
    expect(similarQuestion(phys, 'phy-light-1-c2')?.id).toBe('phy-light-1-q4');
    expect(similarQuestion(chem, che1.check[0]!.id)).toBeUndefined();
  });
});

describe('eye breaks (§7.7)', () => {
  const t45 = planFlow({ lesson: che1, slot: slot45 }).template;
  const t60 = planFlow({ lesson: che1, slot: { ...slot45, end: '19:30' } }).template;

  it('after 20 minutes of screen time; skippable once, then asked again 5 minutes later', () => {
    let s = tickEyes(freshEyes(), EYE_BREAK_AFTER_SEC - 1);
    expect(eyeBreakDue(s, t45)).toBeNull();
    s = tickEyes(s, 1);
    expect(eyeBreakDue(s, t45)).toEqual({ canSkip: true });
    s = skippedEyeBreak(s, t45);
    expect(eyeBreakDue(s, t45)).toBeNull();
    s = tickEyes(s, EYE_BREAK_SNOOZE_SEC);
    expect(eyeBreakDue(s, t45)).toEqual({ canSkip: false });
    s = tookEyeBreak(s, t45);
    expect(s.sinceBreak).toBe(0);
    expect(eyeBreakDue(s, t45)).toBeNull();
  });

  it('a 60-minute lesson also breaks halfway (the 20-minute break near it counts)', () => {
    // 20-min break, then halfway at 30 min is already covered
    let s = tookEyeBreak(tickEyes(freshEyes(), EYE_BREAK_AFTER_SEC), t60);
    expect(s.halfwayDone).toBe(true);
    s = tickEyes(s, 10 * 60);
    expect(eyeBreakDue(s, t60)).toBeNull();
    // a break taken early (at 5 min) leaves the halfway one due at 30 min
    let e = tookEyeBreak(tickEyes(freshEyes(), 5 * 60), t60);
    expect(e.halfwayDone).toBe(false);
    e = tickEyes(e, 25 * 60);
    expect(eyeBreakDue(e, t60)).toEqual({ canSkip: true });
    expect(skippedEyeBreak(e, t60).halfwayDone).toBe(true);
    // a 45-minute lesson has no halfway break
    expect(
      eyeBreakDue({ total: 30 * 60, sinceBreak: 6 * 60, skipped: false, halfwayDone: false }, t45),
    ).toBeNull();
    expect(tookEyeBreak(freshEyes(), undefined).halfwayDone).toBe(false);
  });
});
