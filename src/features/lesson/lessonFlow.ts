/**
 * The lesson flow model (SPEC §5.2–5.4, §6, §7.7, §10 stars) — pure, so every step rule is unit-tested.
 *
 * A study slot resolves to one lesson. The slot length (minus homework, §5.3) picks the template
 * (src/engine/lessonTemplate.ts); the template and the lesson's own content decide which steps exist:
 *
 *   homework_ask → homework_timer → warmup → watch → learn → try → notebook → check → feedback → stars
 *
 * She can go back to any earlier step, and forward again up to the furthest step she reached, but a
 * step's own work unlocks the step after it — nothing skips past the Lesson Check.
 * Everything she does lives in `LessonData`, which is autosaved after every step and answer.
 */
import {
  approvedChapters,
  getSubject,
  type Chapter,
  type ContentBundle,
  type Lesson,
  type Question,
  type Slot,
  type Subject,
  type VideoRef,
} from '@/content';
import type { CaterpillarStep } from '@/components/steps';
import { LESSON_STEPS } from '@/components/steps';
import { fromWallTime, zonedParts } from '@/engine/clock';
import type { GradeResult, Response } from '@/engine/grading';
import { templateFor, type LessonTemplate } from '@/engine/lessonTemplate';
import { nextLesson, subjectQueue } from '@/engine/queue';
import type { LessonProgressRecord } from '@/db/repos';
import { slotMinutes } from '../today/todayModel';

/* ---------- slot resolution (§5.2) ---------- */

export type SlotResolution =
  | { kind: 'invalid' }
  | { kind: 'other_day'; when: 'past' | 'future'; slot: Slot; subject?: Subject }
  | { kind: 'coming_soon'; slot: Slot; subject?: Subject }
  | { kind: 'lesson'; slot: Slot; subject: Subject; slotIndex: number; slotKey: string };

/** Slot kinds that play the lesson flow (fix-it's own part arrives in Phase 4: it plays the next lesson). */
const LESSON_KINDS = new Set<Slot['kind']>(['lesson', 'homework_lesson', 'fixit']);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `/lesson/:date/:slot` → what to show. Only today's slots are playable (future days are locked). */
export function resolveSlot(
  b: Pick<ContentBundle, 'timetable' | 'subjects'>,
  date: string,
  slotParam: string,
  todayKey: string,
): SlotResolution {
  if (!DATE_RE.test(date) || !/^\d+$/.test(slotParam)) return { kind: 'invalid' };
  let weekday;
  try {
    weekday = zonedParts(fromWallTime(date, '12:00')).weekday;
  } catch {
    return { kind: 'invalid' };
  }
  const slotIndex = Number(slotParam);
  const slot = b.timetable.days[weekday][slotIndex];
  if (!slot) return { kind: 'invalid' };
  const id = slot.subject ?? (slot.subjects?.length === 1 ? slot.subjects[0] : undefined);
  const subject = id ? getSubject(b, id) : undefined;
  if (date !== todayKey)
    return { kind: 'other_day', when: date < todayKey ? 'past' : 'future', slot, subject };
  if (!LESSON_KINDS.has(slot.kind) || !subject) return { kind: 'coming_soon', slot, subject };
  return { kind: 'lesson', slot, subject, slotIndex, slotKey: `${date}#${slotIndex}` };
}

/* ---------- picking the lesson (§9.2) ---------- */

export interface PickedLesson {
  lesson: Lesson;
  chapter: Chapter;
  /** the saved progress for this slot (resume), if any */
  resume?: LessonProgressRecord;
  /** the subject's most recently finished lesson (check-only questions come from it, §5.3) */
  lastDone?: Lesson;
}

export const slotKeyOf = (rec: Pick<LessonProgressRecord, 'data'> | undefined): string | undefined => {
  const d = rec?.data;
  return d && typeof d === 'object' && 'slotKey' in d && typeof d.slotKey === 'string'
    ? d.slotKey
    : undefined;
};

/**
 * The lesson for a slot: the one already started in this slot (resume), else the first lesson of the
 * subject's queue that is not done yet.
 */
export function pickLesson(
  b: Pick<ContentBundle, 'chapters' | 'plan'>,
  subject: string,
  slotKey: string,
  progress: readonly LessonProgressRecord[],
): PickedLesson | undefined {
  const chapters = approvedChapters(b);
  const queue = subjectQueue(chapters, b.plan, subject);
  const done = progress.filter((p) => p.status === 'done');
  const lastDoneRec = [...done]
    .filter((p) => queue.some((q) => q.lesson.id === p.lessonId))
    .sort((a, c) => (c.completedAt ?? c.updatedAt) - (a.completedAt ?? a.updatedAt))[0];
  const lastDone = lastDoneRec ? queue.find((q) => q.lesson.id === lastDoneRec.lessonId)?.lesson : undefined;

  const mine = progress.find((p) => slotKeyOf(p) === slotKey);
  const resumed = mine && queue.find((q) => q.lesson.id === mine.lessonId);
  if (mine && resumed) return { ...resumed, resume: mine, lastDone };

  const next = nextLesson(chapters, b.plan, subject, new Set(done.map((p) => p.lessonId)));
  return next ? { ...next, lastDone } : undefined;
}

/** The lesson after this one in the subject's queue ("Next time in Chemistry: …"). */
export function lessonAfter(
  b: Pick<ContentBundle, 'chapters' | 'plan'>,
  subject: string,
  lessonId: string,
): Lesson | undefined {
  const queue = subjectQueue(approvedChapters(b), b.plan, subject);
  const i = queue.findIndex((q) => q.lesson.id === lessonId);
  return i >= 0 ? queue[i + 1]?.lesson : undefined;
}

/* ---------- the saved data ---------- */

export type StepId =
  | 'homework_ask'
  | 'homework_timer'
  | 'warmup'
  | 'watch'
  | 'learn'
  | 'try'
  | 'notebook'
  | 'check'
  | 'feedback'
  | 'stars';

/** §5.3 homework answers (minutes; 0 = "No"). */
export const HOMEWORK_CHOICES = [0, 15, 30, 45] as const;

export interface QuestionRecord {
  response: Response;
  result: GradeResult;
  tries: number;
  revealed: boolean;
}

export interface StarBreakdown {
  finish: number;
  check: number;
  checkpoints: number;
  total: number;
}

export interface LessonData {
  slotKey: string;
  stepId?: StepId;
  /** the furthest step index she has reached (she may come forward again up to here) */
  furthest: number;
  /** undefined until she answers the homework question (homework slots only) */
  homeworkMinutes?: number;
  /** warm-up: "I knew it" per card, in order */
  flashcards: boolean[];
  /** reached the end of the video at least once */
  watched: boolean;
  /** no playable video at all → learn with cards */
  unavailable: boolean;
  /** checkpoint question id → right without the answer being shown */
  checkpoints: Record<string, boolean>;
  /** what the player reported when she reached the end */
  checkpointsAllCorrect?: boolean;
  /** the learn card on screen */
  cardIndex: number;
  /** the latest response to every practice / check question */
  answers: Record<string, Response>;
  practiceDone: number;
  practiceResults: Record<string, QuestionRecord>;
  checkResults: Record<string, QuestionRecord>;
  /** reached the stars step (rewards given, slot logged) */
  finished: boolean;
  stars?: StarBreakdown;
}

export function emptyData(slotKey: string): LessonData {
  return {
    slotKey,
    furthest: 0,
    flashcards: [],
    watched: false,
    unavailable: false,
    checkpoints: {},
    cardIndex: 0,
    answers: {},
    practiceDone: 0,
    practiceResults: {},
    checkResults: {},
    finished: false,
  };
}

/** Saved data from Dexie → LessonData (missing fields take their defaults; a different slot starts fresh). */
export function restoreData(raw: unknown, slotKey: string): LessonData {
  const base = emptyData(slotKey);
  if (!raw || typeof raw !== 'object') return base;
  const d = raw as Partial<LessonData>;
  if (d.slotKey !== slotKey) return base;
  return { ...base, ...d, slotKey };
}

/* ---------- the plan of steps ---------- */

export interface FlowPlan {
  /** undefined while a homework slot waits for her answer */
  template?: LessonTemplate;
  steps: StepId[];
  /** the Lesson Check questions (from the last done lesson for check-only) */
  checkQuestions: Question[];
  /** the lesson the check questions belong to */
  checkLesson: Lesson;
}

export interface PlanInput {
  lesson: Lesson;
  slot: Pick<Slot, 'kind' | 'start' | 'end'>;
  homeworkMinutes?: number;
  lastDone?: Lesson;
}

/** §5.3 "Check only": 3 questions on the last lesson. */
export const CHECK_ONLY_QUESTIONS = 3;

export function planFlow({ lesson, slot, homeworkMinutes, lastDone }: PlanInput): FlowPlan {
  const homeworkSlot = slot.kind === 'homework_lesson';
  const steps: StepId[] = [];
  if (homeworkSlot) {
    steps.push('homework_ask');
    if (homeworkMinutes === undefined) return { steps, checkQuestions: [], checkLesson: lesson };
    if (homeworkMinutes > 0) steps.push('homework_timer');
  }
  const template = templateFor(slotMinutes(slot), homeworkSlot ? { homeworkMinutes } : {});
  const checkLesson = template.kind === 'check_only' ? (lastDone ?? lesson) : lesson;
  const checkQuestions = checkLesson.check.slice(0, template.checkQuestions);

  if (template.kind === 'full' && template.warmupCards > 0 && (lesson.warmup?.length ?? 0) > 0)
    steps.push('warmup');
  if (template.kind !== 'check_only') steps.push('watch');
  if (template.learnCards > 0 && lesson.cards.length > 0) steps.push('learn');
  if (template.tryMinutes > 0 && lesson.practice.length > 0) steps.push('try');
  if (template.notebookMinutes > 0 && lesson.notebook.trim()) steps.push('notebook');
  if (checkQuestions.length > 0) steps.push('check', 'feedback');
  steps.push('stars');
  return { template, steps, checkQuestions, checkLesson };
}

/* ---------- the caterpillar (§15.2.4) ---------- */

type Group = 0 | 1 | 2 | 3 | 4;
/** Warm-up counts under Watch, notebook under Try, feedback under Check. Homework is before all of them. */
const GROUP: Record<StepId, Group | null> = {
  homework_ask: null,
  homework_timer: null,
  warmup: 0,
  watch: 0,
  learn: 1,
  try: 2,
  notebook: 2,
  check: 3,
  feedback: 3,
  stars: 4,
};

/** The caterpillar steps this plan uses, and which one is current (-1 = none yet). */
export function caterpillarFor(
  steps: readonly StepId[],
  current: StepId,
): {
  steps: CaterpillarStep[];
  current: number;
} {
  const groups = [...new Set(steps.map((s) => GROUP[s]).filter((g): g is Group => g !== null))].sort();
  const g = GROUP[current];
  return {
    steps: groups.map((i) => LESSON_STEPS[i]!),
    current: g === null ? -1 : groups.indexOf(g),
  };
}

/* ---------- moving between steps ---------- */

export interface Position {
  stepIndex: number;
  data: LessonData;
}

/** Has she done this step's own work (so Next opens the step after it)? */
export function stepComplete(step: StepId, data: LessonData, lesson: Lesson, plan: FlowPlan): boolean {
  switch (step) {
    case 'homework_ask':
      return data.homeworkMinutes !== undefined;
    case 'warmup':
      return data.flashcards.length >= (lesson.warmup?.length ?? 0);
    case 'watch':
      return data.watched || data.unavailable;
    case 'learn':
      return data.cardIndex >= lesson.cards.length - 1;
    case 'try':
      return data.practiceDone >= lesson.practice.length;
    case 'check':
      return plan.checkQuestions.every((q) => data.checkResults[q.id] !== undefined);
    default:
      return true;
  }
}

/** Can Next be tapped? (Her own work done, or she is revisiting a step she has passed.) */
export function canGoNext(pos: Position, lesson: Lesson, plan: FlowPlan): boolean {
  const step = plan.steps[pos.stepIndex];
  if (!step || step === 'stars') return false;
  if (step === 'learn' && pos.data.cardIndex < lesson.cards.length - 1) return true;
  return pos.stepIndex < pos.data.furthest || stepComplete(step, pos.data, lesson, plan);
}

/** Next: the next learn card, else the next step (learn opens on its first card). */
export function goNext(pos: Position, lesson: Lesson, plan: FlowPlan): Position {
  if (!canGoNext(pos, lesson, plan)) return pos;
  const step = plan.steps[pos.stepIndex];
  if (step === 'learn' && pos.data.cardIndex < lesson.cards.length - 1) {
    return { ...pos, data: { ...pos.data, cardIndex: pos.data.cardIndex + 1 } };
  }
  return goTo(pos, pos.stepIndex + 1, plan, 'forward', lesson);
}

/** Back stops at the first lesson step once homework is done (the homework itself is finished). */
export function canGoBack(pos: Position, plan: FlowPlan): boolean {
  const step = plan.steps[pos.stepIndex];
  if (step === 'learn' && pos.data.cardIndex > 0) return true;
  const prev = plan.steps[pos.stepIndex - 1];
  if (!prev) return false;
  if (prev === 'homework_ask' || prev === 'homework_timer') return step === 'homework_timer';
  return true;
}

export function goBack(pos: Position, lesson: Lesson, plan: FlowPlan): Position {
  if (!canGoBack(pos, plan)) return pos;
  const step = plan.steps[pos.stepIndex];
  if (step === 'learn' && pos.data.cardIndex > 0) {
    return { ...pos, data: { ...pos.data, cardIndex: pos.data.cardIndex - 1 } };
  }
  return goTo(pos, pos.stepIndex - 1, plan, 'back', lesson);
}

function goTo(
  pos: Position,
  stepIndex: number,
  plan: FlowPlan,
  dir: 'forward' | 'back',
  lesson: Lesson,
): Position {
  const i = Math.max(0, Math.min(plan.steps.length - 1, stepIndex));
  const step = plan.steps[i];
  const cardIndex =
    step === 'learn' ? (dir === 'forward' ? 0 : Math.max(0, lesson.cards.length - 1)) : pos.data.cardIndex;
  return {
    stepIndex: i,
    data: { ...pos.data, stepId: step, cardIndex, furthest: Math.max(pos.data.furthest, i) },
  };
}

/** Where a saved lesson resumes: its saved step id (indices can shift once homework is answered). */
export function resumeIndex(plan: FlowPlan, data: LessonData, savedStep: number): number {
  const byId = data.stepId ? plan.steps.indexOf(data.stepId) : -1;
  if (byId >= 0) return byId;
  return Math.max(0, Math.min(plan.steps.length - 1, savedStep));
}

/** The homework answer: the plan grows its lesson steps; go to the timer (or straight into the lesson). */
export function answerHomework(
  data: LessonData,
  minutes: number,
  input: Omit<PlanInput, 'homeworkMinutes'>,
): Position {
  const plan = planFlow({ ...input, homeworkMinutes: minutes });
  const stepIndex = 1;
  return {
    stepIndex,
    data: {
      ...data,
      homeworkMinutes: minutes,
      stepId: plan.steps[stepIndex],
      furthest: stepIndex,
      cardIndex: 0,
    },
  };
}

/* ---------- answers ---------- */

/** Record a practice or check answer; returns the new data (the question step moves to its next question). */
export function recordAnswer(
  data: LessonData,
  kind: 'practice' | 'check',
  questionId: string,
  rec: QuestionRecord,
): LessonData {
  const answers = { ...data.answers, [questionId]: rec.response };
  if (kind === 'check')
    return { ...data, answers, checkResults: { ...data.checkResults, [questionId]: rec } };
  const fresh = data.practiceResults[questionId] === undefined;
  return {
    ...data,
    answers,
    practiceResults: { ...data.practiceResults, [questionId]: rec },
    practiceDone: data.practiceDone + (fresh ? 1 : 0),
  };
}

/** The question on screen in a question step (undefined when every one is answered). */
export function currentQuestion(
  kind: 'practice' | 'check',
  data: LessonData,
  lesson: Lesson,
  plan: FlowPlan,
): Question | undefined {
  if (kind === 'practice') return lesson.practice.find((q) => data.practiceResults[q.id] === undefined);
  return plan.checkQuestions.find((q) => data.checkResults[q.id] === undefined);
}

/* ---------- score + stars (§6 step 7, §10) ---------- */

export interface CheckScore {
  score: number;
  max: number;
  /** 0..1 */
  fraction: number;
}

export function checkScore(
  plan: Pick<FlowPlan, 'checkQuestions'>,
  data: Pick<LessonData, 'checkResults'>,
): CheckScore {
  const max = plan.checkQuestions.length;
  const score = plan.checkQuestions.reduce((s, q) => s + (data.checkResults[q.id]?.result.score ?? 0), 0);
  return { score: Math.round(score * 2) / 2, max, fraction: max ? score / max : 0 };
}

/** §10 stars for a lesson. */
export const STARS = { finish: 1, check: 1, checkpoints: 1 } as const;
/** §10: "a Lesson Check of 80% or more". */
export const CHECK_STAR_FRACTION = 0.8;

export function starsFor(plan: Pick<FlowPlan, 'checkQuestions'>, data: LessonData): StarBreakdown {
  const sc = checkScore(plan, data);
  const finish = STARS.finish;
  const check = sc.max > 0 && sc.fraction >= CHECK_STAR_FRACTION ? STARS.check : 0;
  const seen = Object.values(data.checkpoints);
  const checkpoints =
    seen.length > 0 && seen.every(Boolean) && data.checkpointsAllCorrect !== false ? STARS.checkpoints : 0;
  return { finish, check, checkpoints, total: finish + check + checkpoints };
}

/** A full template completes the lesson; mini / check-only put the skipped part back in the queue (§5.3). */
export const completesLesson = (plan: FlowPlan): boolean => plan.template?.kind === 'full';

/* ---------- video jumps (§6 step 4, §8.4) ---------- */

export interface Rewatch {
  which: 'primary' | 'alternate';
  seekTo: { scene?: number; at?: number; nonce: number };
}

export function rewatchFor(ref: VideoRef | undefined, nonce: number): Rewatch {
  return {
    which: ref?.video ?? 'primary',
    seekTo: { scene: ref?.scene, at: ref?.at, nonce },
  };
}

/** "Try a similar one 🔁" — a question-bank item made as a variant of this question. */
export function similarQuestion(
  chapter: Pick<Chapter, 'questionBank'>,
  questionId: string,
): Question | undefined {
  return chapter.questionBank.find((q) => q.variantOf === questionId);
}

/* ---------- eye breaks (§7.7) ---------- */

/** 20-20-20: after 20 minutes of continuous screen time. */
export const EYE_BREAK_AFTER_SEC = 20 * 60;
/** after she skips once, ask again this much later (and that one can't be skipped) */
export const EYE_BREAK_SNOOZE_SEC = 5 * 60;
/** how long the break itself lasts */
export const EYE_BREAK_SEC = 20;
/** a break this close before the halfway point of a 60-minute lesson counts as its halfway break */
export const HALFWAY_WINDOW_SEC = 10 * 60;

export interface EyeState {
  /** screen seconds in this lesson */
  total: number;
  /** screen seconds since the last break */
  sinceBreak: number;
  /** she already skipped one */
  skipped: boolean;
  /** the 60-minute template's halfway break has happened (or was skipped) */
  halfwayDone: boolean;
}

export const freshEyes = (): EyeState => ({ total: 0, sinceBreak: 0, skipped: false, halfwayDone: false });

/** Is a break due now? `canSkip` is true for the first one only. */
export function eyeBreakDue(s: EyeState, template: LessonTemplate | undefined): { canSkip: boolean } | null {
  const halfway =
    !!template?.eyeBreak &&
    !s.halfwayDone &&
    s.total >= (template.minutes * 60) / 2 &&
    s.sinceBreak >= EYE_BREAK_SNOOZE_SEC;
  if (s.sinceBreak >= EYE_BREAK_AFTER_SEC || halfway) return { canSkip: !s.skipped };
  return null;
}

export function tickEyes(s: EyeState, seconds: number): EyeState {
  return { ...s, total: s.total + seconds, sinceBreak: s.sinceBreak + seconds };
}

const nearHalfway = (s: EyeState, template: LessonTemplate | undefined) =>
  s.halfwayDone || (!!template && s.total >= (template.minutes * 60) / 2 - HALFWAY_WINDOW_SEC);

export function tookEyeBreak(s: EyeState, template: LessonTemplate | undefined): EyeState {
  return { ...s, sinceBreak: 0, halfwayDone: nearHalfway(s, template) };
}

export function skippedEyeBreak(s: EyeState, template: LessonTemplate | undefined): EyeState {
  return {
    ...s,
    skipped: true,
    sinceBreak: EYE_BREAK_AFTER_SEC - EYE_BREAK_SNOOZE_SEC,
    halfwayDone: nearHalfway(s, template),
  };
}
