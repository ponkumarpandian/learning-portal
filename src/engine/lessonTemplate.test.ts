import { STANDARD_TEMPLATES, templateFor, type LessonTemplate } from './lessonTemplate';

type Row = Pick<
  LessonTemplate,
  | 'warmupCards'
  | 'videoMaxMinutes'
  | 'videoParts'
  | 'learnCards'
  | 'tryMinutes'
  | 'notebookMinutes'
  | 'checkQuestions'
  | 'eyeBreak'
>;

const T30: Row = {
  warmupCards: 2,
  videoMaxMinutes: 6,
  videoParts: 1,
  learnCards: 4,
  tryMinutes: 8,
  notebookMinutes: 3,
  checkQuestions: 3,
  eyeBreak: false,
};
const T45: Row = {
  warmupCards: 3,
  videoMaxMinutes: 8,
  videoParts: 1,
  learnCards: 6,
  tryMinutes: 12,
  notebookMinutes: 5,
  checkQuestions: 5,
  eyeBreak: false,
};
const T60: Row = {
  warmupCards: 3,
  videoMaxMinutes: 6,
  videoParts: 2,
  learnCards: 8,
  tryMinutes: 15,
  notebookMinutes: 5,
  checkQuestions: 6,
  eyeBreak: true,
};

describe('templateFor: §5.4 table', () => {
  it.each([
    [30, T30],
    [45, T45],
    [60, T60],
  ] as const)('%i-minute slot', (slot, row) => {
    expect(templateFor(slot)).toEqual({ kind: 'full', minutes: slot, ...row, foldCheckIntoDaily: false });
  });

  it('the exported table matches §5.4', () => {
    expect(STANDARD_TEMPLATES).toEqual({ 30: T30, 45: T45, 60: T60 });
  });

  it.each([
    [25, T30], // below 30 → still the 30 template (min 30)
    [35, T30],
    [44, T30],
    [50, T45],
    [59, T45],
    [75, T60],
    [90, T60],
  ] as const)('non-standard %i → nearest lower standard size', (slot, row) => {
    expect(templateFor(slot)).toMatchObject({ kind: 'full', minutes: slot, ...row });
  });
});

describe('templateFor: final lesson of the day', () => {
  it.each([
    [30, 20, T30], // Mon Geography / Tue Biology: 30 − 10 = 20, still the 30 template (min 30)
    [45, 35, T30],
    [60, 50, T45],
  ] as const)('%i-minute slot → %i minutes', (slot, minutes, row) => {
    expect(templateFor(slot, { finalLesson: true })).toEqual({
      kind: 'full',
      minutes,
      ...row,
      foldCheckIntoDaily: true,
    });
  });
});

describe('templateFor: homework-first slots (§5.3)', () => {
  it.each([
    // [slot, homework, kind, minutes left, row]
    [45, 0, 'full', 45, T45],
    [45, 15, 'full', 30, T30],
    [45, 30, 'check_only', 15, undefined],
    [45, 45, 'check_only', 0, undefined],
    [60, 0, 'full', 60, T60],
    [60, 15, 'full', 45, T45],
    [60, 30, 'full', 30, T30],
    [60, 45, 'check_only', 15, undefined],
    // the 20 and 30 boundaries
    [50, 30, 'mini', 20, undefined],
    [49, 30, 'check_only', 19, undefined],
    [59, 30, 'mini', 29, undefined],
    [75, 45, 'full', 30, T30],
  ] as const)('%i slot, %i min homework → %s (%i left)', (slot, homework, kind, minutes, row) => {
    const t = templateFor(slot, { homeworkMinutes: homework });
    expect(t.kind).toBe(kind);
    expect(t.minutes).toBe(minutes);
    expect(t.foldCheckIntoDaily).toBe(false);
    if (row) expect(t).toMatchObject(row);
  });

  it('mini = Watch + 3-question check, nothing else', () => {
    expect(templateFor(50, { homeworkMinutes: 30 })).toEqual({
      kind: 'mini',
      minutes: 20,
      warmupCards: 0,
      videoMaxMinutes: 6,
      videoParts: 1,
      learnCards: 0,
      tryMinutes: 0,
      notebookMinutes: 0,
      checkQuestions: 3,
      eyeBreak: false,
      foldCheckIntoDaily: false,
    });
  });

  it('check_only = 3 questions, no video', () => {
    expect(templateFor(45, { homeworkMinutes: 30 })).toMatchObject({
      kind: 'check_only',
      videoMaxMinutes: 0,
      learnCards: 0,
      checkQuestions: 3,
    });
  });

  it('homework longer than the slot never goes below 0 minutes', () => {
    expect(templateFor(30, { homeworkMinutes: 45 })).toMatchObject({ kind: 'check_only', minutes: 0 });
  });

  it('homework and final lesson stack', () => {
    expect(templateFor(60, { homeworkMinutes: 15, finalLesson: true })).toMatchObject({
      kind: 'full',
      minutes: 35,
      ...T30,
      foldCheckIntoDaily: true,
    });
    expect(templateFor(45, { homeworkMinutes: 15, finalLesson: true })).toMatchObject({
      kind: 'mini',
      minutes: 20,
      foldCheckIntoDaily: true,
    });
  });
});
