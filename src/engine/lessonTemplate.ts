/**
 * Lesson templates by slot length — SPEC §5.3 (homework-first slots) and §5.4.
 *
 * The template sets the time budget of a lesson. The lesson's own content wins for cards/practice
 * (all of them are shown); the template decides how many check questions, the eye break and the
 * video limits.
 */

export type TemplateKind = 'full' | 'mini' | 'check_only';

export interface LessonTemplate {
  kind: TemplateKind;
  /** minutes actually available for the lesson (after homework / the final-lesson shrink) */
  minutes: number;
  warmupCards: number;
  videoMaxMinutes: number;
  videoParts: 1 | 2;
  learnCards: number;
  tryMinutes: number;
  notebookMinutes: number;
  checkQuestions: number;
  eyeBreak: boolean;
  /** final lesson of the day: the Lesson Check folds into the Daily Assignment (Phase 3 uses it) */
  foldCheckIntoDaily: boolean;
}

type Body = Omit<LessonTemplate, 'kind' | 'minutes' | 'foldCheckIntoDaily'>;

/** §5.4 table, keyed by the standard slot sizes. */
export const STANDARD_TEMPLATES = {
  30: {
    warmupCards: 2,
    videoMaxMinutes: 6,
    videoParts: 1,
    learnCards: 4,
    tryMinutes: 8,
    notebookMinutes: 3,
    checkQuestions: 3,
    eyeBreak: false,
  },
  45: {
    warmupCards: 3,
    videoMaxMinutes: 8,
    videoParts: 1,
    learnCards: 6,
    tryMinutes: 12,
    notebookMinutes: 5,
    checkQuestions: 5,
    eyeBreak: false,
  },
  60: {
    warmupCards: 3,
    videoMaxMinutes: 6,
    videoParts: 2,
    learnCards: 8,
    tryMinutes: 15,
    notebookMinutes: 5,
    checkQuestions: 6,
    eyeBreak: true,
  },
} as const satisfies Record<30 | 45 | 60, Body>;

/** §5.3: 20–29 minutes left → Watch + 3-question check. */
const MINI: Body = {
  warmupCards: 0,
  videoMaxMinutes: 6,
  videoParts: 1,
  learnCards: 0,
  tryMinutes: 0,
  notebookMinutes: 0,
  checkQuestions: 3,
  eyeBreak: false,
};

/** §5.3: under 20 minutes left → Check only (3 questions on the last lesson). */
const CHECK_ONLY: Body = { ...MINI, videoMaxMinutes: 0 };

/** §5.3 thresholds (minutes left after homework). */
export const MINI_MIN_MINUTES = 20;
export const FULL_MIN_MINUTES = 30;
/** §5.4: the day's final app lesson shrinks by 10 minutes. */
export const FINAL_LESSON_SHRINK = 10;

/**
 * Pick the template for a slot.
 *  - Non-standard lengths use the nearest lower standard size (never below the 30 template).
 *  - `finalLesson`: 10 minutes less, Lesson Check folded into the Daily Assignment.
 *  - `homeworkMinutes` (a homework-first slot, §5.3, 0 = "No"): what is left picks the template, and
 *    only here can it drop to 'mini' (20–29 left) or 'check_only' (under 20 left).
 */
export function templateFor(
  slotMinutes: number,
  opts: { homeworkMinutes?: number; finalLesson?: boolean } = {},
): LessonTemplate {
  const finalLesson = opts.finalLesson ?? false;
  const homeworkSlot = opts.homeworkMinutes !== undefined;
  const minutes = Math.max(
    0,
    slotMinutes - (opts.homeworkMinutes ?? 0) - (finalLesson ? FINAL_LESSON_SHRINK : 0),
  );

  let kind: TemplateKind = 'full';
  let body: Body;
  if (minutes >= 60) body = STANDARD_TEMPLATES[60];
  else if (minutes >= 45) body = STANDARD_TEMPLATES[45];
  else if (minutes >= FULL_MIN_MINUTES || !homeworkSlot) body = STANDARD_TEMPLATES[30];
  else if (minutes >= MINI_MIN_MINUTES) {
    kind = 'mini';
    body = MINI;
  } else {
    kind = 'check_only';
    body = CHECK_ONLY;
  }

  return { kind, minutes, ...body, foldCheckIntoDaily: finalLesson };
}
