import blueprintJson from '@content/test-blueprint.json';
import { bundledRawContent } from './index';
import { rawFromFiles, type RawContent } from './raw';
import { estimateExplainerSeconds, formatPath, friendlyZodMessage, validateContent } from './validate';

/* eslint-disable @typescript-eslint/no-explicit-any */

const src = { pages: [12] };

function question(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    type: 'mcq',
    prompt: `Question ${id}?`,
    difficulty: 'easy',
    marks: 1,
    options: ['A', 'B'],
    answer: 'A',
    explanation: 'Because A.',
    source: src,
    ...over,
  };
}

/** A tiny, fully valid NON-sample content set (zero errors, zero warnings). */
function makeRaw(): RawContent {
  const diffs = [
    'easy',
    'easy',
    'easy',
    'easy',
    'medium',
    'medium',
    'medium',
    'medium',
    'challenge',
    'challenge',
  ];
  const emptyDays = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
  return {
    root: 'content',
    subjects: {
      file: 'content/subjects.json',
      data: [{ id: 'maths', name: 'Maths', emoji: '📘', colour: '#3f7bf6', sessionsPerWeek: 1 }],
    },
    timetable: {
      file: 'content/timetable.json',
      data: {
        timezone: 'Asia/Kolkata',
        bedtime: { schoolNights: '21:45', weekendNights: '22:15' },
        schoolNights: ['sun', 'mon'],
        days: {
          ...emptyDays,
          mon: [
            { start: '16:00', end: '17:00', kind: 'lesson', subject: 'maths' },
            { start: '17:00', end: '17:30', kind: 'break', label: 'Snack', emoji: '🍎' },
          ],
          sat: [{ start: '15:30', end: '16:15', kind: 'test', testId: 'sat', subjects: ['maths'] }],
          sun: [{ start: '09:30', end: '10:30', kind: 'test', testId: 'sun', subjects: ['maths'] }],
        },
      },
    },
    plan: {
      file: 'content/plan.json',
      data: {
        startDate: '2026-11-02',
        exams: { mode: 'single', date: '2027-03-01' },
        revisionDays: 7,
        chapterOrder: { maths: ['m-ch'] },
        taughtAlready: [],
        examPattern: {
          default: [{ section: 'A', title: 'Fill in the blanks', types: ['fill_blank'], marks: 5 }],
        },
      },
    },
    blueprint: { file: 'content/test-blueprint.json', data: structuredClone(blueprintJson) },
    chapters: [
      {
        file: 'content/chapters/maths/ch.json',
        data: {
          id: 'm-ch',
          subject: 'maths',
          title: 'Numbers',
          order: 1,
          status: 'draft',
          book: { title: 'Maths Book', publisher: 'Pub' },
          lessons: [
            {
              id: 'm-ch-1',
              title: 'Lesson one',
              source: src,
              videos: [
                { role: 'primary', kind: 'explainer', explainerId: 'm-ex' },
                {
                  role: 'alternate',
                  kind: 'youtube',
                  youtubeId: 'abcdefghijk',
                  title: 'Clip',
                  start: 0,
                  end: 200,
                  checkpoints: [{ at: 100, questionId: 'm-b1', rewindTo: 80 }],
                },
              ],
              warmup: [{ front: 'F', back: 'B', source: src }],
              cards: [{ title: 'Card', body: 'Body', source: src }],
              practice: [question('m-p1', { hints: ['Think!'] })],
              notebook: 'Do three sums.',
              check: [question('m-c1'), question('m-c2'), question('m-c3')],
              keyRules: ['Rule one.'],
            },
          ],
          questionBank: diffs.map((d, i) => question(`m-b${i + 1}`, { lessonId: 'm-ch-1', difficulty: d })),
        },
      },
    ],
    explainers: [
      {
        file: 'content/explainers/m-ex.json',
        data: {
          id: 'm-ex',
          subject: 'maths',
          title: 'Explainer',
          scenes: [
            { visual: 'NumberLine', props: {}, narration: 'Hello there.', minDuration: 5, source: src },
            {
              visual: 'NumberLine',
              props: {},
              narration: 'Jump!',
              minDuration: 5,
              source: src,
              checkpoint: { questionId: 'm-ex-cp1' },
            },
          ],
          questions: [question('m-ex-cp1')],
        },
      },
    ],
  };
}

const ch = (raw: RawContent): any => raw.chapters[0]!.data;
const lesson = (raw: RawContent): any => ch(raw).lessons[0];
const ex = (raw: RawContent): any => raw.explainers[0]!.data;
const tt = (raw: RawContent): any => raw.timetable!.data;

function expectError(raw: RawContent, ...parts: string[]) {
  const { errors } = validateContent(raw);
  const hit = errors.find((e) => parts.every((p) => e.includes(p)));
  if (!hit)
    throw new Error(
      `Expected an error containing ${JSON.stringify(parts)}, got:\n${errors.join('\n') || '(no errors)'}`,
    );
  return hit;
}

function expectWarning(raw: RawContent, ...parts: string[]) {
  const { warnings } = validateContent(raw);
  const hit = warnings.find((e) => parts.every((p) => e.includes(p)));
  if (!hit)
    throw new Error(
      `Expected a warning containing ${JSON.stringify(parts)}, got:\n${warnings.join('\n') || '(no warnings)'}`,
    );
  return hit;
}

describe('validateContent — baseline', () => {
  it('accepts the minimal valid fixture with no errors or warnings', () => {
    expect(validateContent(makeRaw())).toEqual({ errors: [], warnings: [] });
  });

  it('formats paths like lessons[0].check', () => {
    expect(formatPath(['lessons', 0, 'check'])).toBe('lessons[0].check');
    expect(formatPath([2, 'id'])).toBe('[2].id');
  });

  it('rephrases Zod messages in plain words', () => {
    expect(friendlyZodMessage('Invalid input: expected number, received string')).toBe(
      'should be a number, but found a string',
    );
    expect(friendlyZodMessage('Invalid input: expected array, received undefined')).toBe(
      'is required (an array)',
    );
  });
});

describe('schemas', () => {
  it('reports type errors with file and JSON path', () => {
    const raw = makeRaw();
    ex(raw).scenes[0].minDuration = 'eight';
    expect(
      expectError(raw, 'content/explainers/m-ex.json › scenes[0].minDuration', 'should be a number'),
    ).toBeTruthy();
  });

  it('catches unknown fields (typos)', () => {
    const raw = makeRaw();
    lesson(raw).check[0].optons = ['x'];
    expectError(raw, 'lessons[0].check[0]', 'unknown field', 'optons');
  });

  it('rejects a visual that is not in the §7.5 registry', () => {
    const raw = makeRaw();
    ex(raw).scenes[0].visual = 'Teleporter';
    expectError(raw, 'scenes[0].visual', 'registry');
  });

  it('validates type-specific question fields', () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ answer: 'Z' }, 'is not one of the options'],
      [{ options: ['A'] }, 'needs 2–4 "options"'],
      [{ type: 'true_false', answer: 'yes' }, 'true or false'],
      [{ type: 'numeric', answer: '7' }, 'number "answer"'],
      [{ type: 'match', pairs: [['a', 'b']] }, 'at least 2 "pairs"'],
      [{ type: 'order', sequence: ['one'] }, 'at least 2 items in "sequence"'],
      [{ type: 'short_answer', answer: undefined }, 'needs a "modelAnswer"'],
      [{ type: 'think_write', answer: undefined }, 'needs a "modelAnswer"'],
      [{ type: 'label_diagram', answer: undefined }, 'needs an "image"'],
      [{ type: 'fill_blank', answer: true }, 'text or number "answer"'],
    ];
    for (const [over, msg] of cases) {
      const raw = makeRaw();
      Object.assign(lesson(raw).check[0], over);
      expectError(raw, 'lessons[0].check[0]', msg);
    }
  });

  it('checks HH:MM format and start before end', () => {
    const raw = makeRaw();
    tt(raw).days.mon[0].start = '4:00';
    expectError(raw, 'days.mon[0].start', '24h time');
    const raw2 = makeRaw();
    tt(raw2).days.mon[1].end = '16:30';
    expectError(raw2, 'days.mon[1].end', 'must be before end');
  });

  it('requires per-kind slot fields', () => {
    const raw = makeRaw();
    delete tt(raw).days.mon[0].subject;
    expectError(raw, 'days.mon[0].subject', 'needs a "subject"');
  });

  it('reports a missing core file', () => {
    const raw = makeRaw();
    delete raw.plan;
    expectError(raw, 'content/plan.json', 'file is missing');
  });
});

describe('ids and references', () => {
  it('ids must be unique across all content', () => {
    const raw = makeRaw();
    ex(raw).questions[0].id = 'm-c1';
    ex(raw).scenes[1].checkpoint.questionId = 'm-c1';
    expectError(raw, 'duplicate id "m-c1"', 'already used at');
  });

  it('video checkpoint questionId must exist', () => {
    const raw = makeRaw();
    lesson(raw).videos[1].checkpoints[0].questionId = 'nope';
    expectError(raw, 'lessons[0].videos[1].checkpoints[0].questionId', '"nope" doesn\'t match');
  });

  it("video checkpoint may point at a question of the lesson's explainer", () => {
    const raw = makeRaw();
    lesson(raw).videos[1].checkpoints[0].questionId = 'm-ex-cp1';
    expect(validateContent(raw).errors).toEqual([]);
  });

  it('explainerId must exist', () => {
    const raw = makeRaw();
    lesson(raw).videos[0].explainerId = 'ghost';
    expectError(raw, 'videos[0].explainerId', '"ghost"');
  });

  it('explainer scene checkpoint questionId must exist', () => {
    const raw = makeRaw();
    ex(raw).scenes[1].checkpoint.questionId = 'ghost-q';
    expectError(raw, 'scenes[1].checkpoint.questionId', 'ghost-q');
  });

  it('videoRef must point at an existing video and scene', () => {
    const raw = makeRaw();
    lesson(raw).check[0].videoRef = { video: 'primary', scene: 9 };
    expectError(raw, 'check[0].videoRef.scene', "scene 9 doesn't exist");
    const raw2 = makeRaw();
    lesson(raw2).videos.pop();
    lesson(raw2).check[0].videoRef = { video: 'alternate' };
    expectError(raw2, 'check[0].videoRef.video', 'has none');
    const raw3 = makeRaw();
    ch(raw3).questionBank[0].videoRef = { video: 'alternate', at: 500 };
    expectError(raw3, 'questionBank[0].videoRef.at', 'outside the clip');
  });

  it('variantOf must point at an existing question', () => {
    const raw = makeRaw();
    lesson(raw).check[1].variantOf = 'missing-q';
    expectError(raw, 'check[1].variantOf', 'missing-q');
  });

  it('questionBank questions need a lessonId from the same chapter', () => {
    const raw = makeRaw();
    delete ch(raw).questionBank[0].lessonId;
    expectError(raw, 'questionBank[0].lessonId', 'needs "lessonId"');
    const raw2 = makeRaw();
    ch(raw2).questionBank[0].lessonId = 'other-lesson';
    expectError(raw2, 'questionBank[0].lessonId', "doesn't match any lesson");
  });

  it('chapter and explainer subjects must exist', () => {
    const raw = makeRaw();
    ch(raw).subject = 'french';
    expectError(raw, 'ch.json › subject', 'unknown subject "french"');
  });
});

describe('timetable', () => {
  it('slots must not overlap', () => {
    const raw = makeRaw();
    tt(raw).days.mon[1].start = '16:45';
    expectError(raw, 'days.mon[1]', 'overlaps slot 16:00–17:00');
  });

  it('every slot subject must exist', () => {
    const raw = makeRaw();
    tt(raw).days.sat[0].subjects = ['maths', 'french'];
    expectError(raw, 'days.sat[0].subjects[1]', 'unknown subject "french"');
  });

  it('needs exactly two test slots: sat and sun', () => {
    const raw = makeRaw();
    tt(raw).days.sun = [];
    expectError(raw, 'timetable.json › days', 'exactly 2 test slots');
    const raw2 = makeRaw();
    tt(raw2).days.sun[0].testId = 'sat';
    expectError(raw2, 'exactly 2 test slots');
  });

  it('warns when a subject has no sessionsPerWeek to check against', () => {
    const raw = makeRaw();
    delete (raw.subjects!.data as any)[0].sessionsPerWeek;
    expectWarning(raw, 'subjects.json › [0].sessionsPerWeek', 'not checked for "maths"');
  });

  it('weekly session counts must match sessionsPerWeek', () => {
    const raw = makeRaw();
    tt(raw).days.tue = [{ start: '16:00', end: '16:30', kind: 'revise', subject: 'maths' }];
    expectError(raw, 'Maths ("maths") has 2', 'sessionsPerWeek is 1');
  });
});

describe('lessons', () => {
  it('needs at least 3 check questions', () => {
    const raw = makeRaw();
    lesson(raw).check.pop();
    expect(expectError(raw)).toBeTruthy();
    expect(validateContent(raw).errors).toContain(
      'content/chapters/maths/ch.json › lessons[0].check: needs at least 3 questions (found 2)',
    );
  });

  it('needs a notebook task', () => {
    const raw = makeRaw();
    lesson(raw).notebook = '  ';
    expectError(raw, 'lessons[0].notebook', 'notebook task');
  });

  it('practice questions need hints', () => {
    const raw = makeRaw();
    delete lesson(raw).practice[0].hints;
    expectError(raw, 'practice[0].hints', 'at least 1 hint');
  });

  it('warns about long video segments and too much video per lesson (§7.7)', () => {
    const raw = makeRaw();
    lesson(raw).videos[1].end = 600;
    expectWarning(raw, 'videos[1]', '≤ 8 min');
    const raw2 = makeRaw();
    const v = lesson(raw2).videos[1];
    lesson(raw2).videos = [
      { ...v, role: 'primary', end: 480, checkpoints: [] },
      { ...v, role: 'primary', end: 480, checkpoints: [] },
    ];
    expectWarning(raw2, 'lessons[0].videos', '≤ 15 min');
  });

  it('warns for youtubeId REPLACE_ME', () => {
    const raw = makeRaw();
    lesson(raw).videos[1].youtubeId = 'REPLACE_ME';
    expectWarning(raw, 'videos[1].youtubeId', 'REPLACE_ME');
  });
});

describe('lesson video roles (§7.1)', () => {
  it('allows at most one primary and one alternate', () => {
    const raw = makeRaw();
    lesson(raw).videos[1].role = 'primary';
    expectError(raw, 'lessons[0].videos', 'has 2 "primary" videos', 'at most one alternate');
    const raw2 = makeRaw();
    lesson(raw2).videos.push({ ...lesson(raw2).videos[1], youtubeId: 'zyxwvutsrqp', checkpoints: [] });
    expectError(raw2, 'lessons[0].videos', 'has 2 "alternate" videos');
  });

  it('a real chapter may not play a SAMPLE explainer (§13A)', () => {
    const raw = makeRaw();
    ex(raw).sample = true;
    expectError(raw, 'lessons[0].videos[0].explainerId', 'real chapter uses SAMPLE explainer "m-ex"');
    ch(raw).sample = true;
    expect(validateContent(raw).errors.filter((e) => e.includes('SAMPLE explainer'))).toEqual([]);
  });
});

describe('questionBank and sources (§13, §13A)', () => {
  it('needs ≥10 questions with a difficulty mix (error for real chapters)', () => {
    const raw = makeRaw();
    ch(raw).questionBank = ch(raw).questionBank.slice(0, 9);
    expectError(raw, 'questionBank', 'at least 10 questions', 'found 9');
    const raw2 = makeRaw();
    for (const q of ch(raw2).questionBank) q.difficulty = 'easy';
    expectError(raw2, 'questionBank', '0 challenge');
  });

  it('is only a warning for SAMPLE chapters', () => {
    const raw = makeRaw();
    ch(raw).sample = true;
    ch(raw).questionBank = ch(raw).questionBank.slice(0, 3);
    expect(validateContent(raw).errors.filter((e) => e.includes('questionBank'))).toEqual([]);
    expectWarning(raw, 'questionBank', 'OK for a SAMPLE chapter');
  });

  it('real chapters need a book and a source on every item', () => {
    const raw = makeRaw();
    delete ch(raw).book;
    delete lesson(raw).cards[0].source;
    delete lesson(raw).source;
    delete ch(raw).questionBank[3].source;
    expectError(raw, 'ch.json › book', 'needs "book"');
    expectError(raw, 'lessons[0].cards[0].source', 'page numbers');
    expectError(raw, 'lessons[0].source', 'page numbers');
    expectError(raw, 'questionBank[3].source', 'page numbers');
  });

  it('sample chapters only get one summary warning for missing sources', () => {
    const raw = makeRaw();
    ch(raw).sample = true;
    delete lesson(raw).cards[0].source;
    expect(validateContent(raw).errors).toEqual([]);
    expectWarning(raw, 'SAMPLE chapter: 1 item(s)');
  });

  it('real explainers need a source on every scene', () => {
    const raw = makeRaw();
    delete ex(raw).scenes[0].source;
    expectError(raw, 'm-ex.json › scenes[0].source', 'page numbers');
  });

  it('book questions need bookRef', () => {
    const raw = makeRaw();
    ch(raw).questionBank[0].fromBook = true;
    expectError(raw, 'questionBank[0].bookRef');
  });
});

describe('plan and blueprint', () => {
  it('warns for REPLACE_ME exam dates', () => {
    const raw = makeRaw();
    (raw.plan!.data as any).exams = { mode: 'per_subject', dates: { maths: 'REPLACE_ME' } };
    expectWarning(raw, 'plan.json › exams', 'REPLACE_ME', 'maths');
  });

  it('chapterOrder must list existing chapters', () => {
    const raw = makeRaw();
    (raw.plan!.data as any).chapterOrder.maths.push('m-ghost');
    expectError(raw, 'chapterOrder.maths[1]', '"m-ghost"');
  });

  it('a chapter file with schema errors gives no follow-on "doesn’t match" errors', () => {
    const raw = makeRaw();
    delete ch(raw).status;
    (raw.plan!.data as any).taughtAlready = ['m-ch'];
    const { errors } = validateContent(raw);
    expect(errors).toContain(
      'content/chapters/maths/ch.json › status: is required (one of "draft" | "approved")',
    );
    expect(errors.filter((e) => e.includes("doesn't match any chapter file"))).toEqual([]);
  });

  it('an explainer file with schema errors gives no follow-on explainerId error', () => {
    const raw = makeRaw();
    ex(raw).scenes[0].minDuration = 'eight';
    const { errors } = validateContent(raw);
    expect(errors.filter((e) => e.includes('explainerId'))).toEqual([]);
  });

  it('blueprint structure must add up to sectionMarks', () => {
    const raw = makeRaw();
    (raw.blueprint!.data as any).sectionMarks = 20;
    expectError(raw, 'test-blueprint.json › structure', 'adds up to 15');
  });
});

describe('explainer timing estimate', () => {
  it('uses the longer of narration and minDuration', () => {
    expect(estimateExplainerSeconds({ scenes: [{ narration: 'one two', minDuration: 8 }] as any })).toBe(8);
    const long = Array.from({ length: 46 }, () => 'word').join(' ');
    expect(estimateExplainerSeconds({ scenes: [{ narration: long, minDuration: 1 }] as any })).toBe(20);
  });
});

describe('real content and the broken fixture', () => {
  it('the real /content validates with zero errors', () => {
    const { errors } = validateContent(bundledRawContent());
    expect(errors).toEqual([]);
  });

  it('the broken fixture gives clear errors', () => {
    const files = import.meta.glob<unknown>('/scripts/__fixtures__/broken/**/*.json', {
      eager: true,
      import: 'default',
    });
    const { errors } = validateContent(rawFromFiles(files, '/scripts/__fixtures__/broken'));
    const p = 'scripts/__fixtures__/broken';
    expect(errors).toEqual(
      expect.arrayContaining([
        `${p}/explainers/bad-type.json › scenes[0].minDuration: should be a number, but found a string`,
        expect.stringContaining(
          `${p}/chapters/physics/broken.json › lessons[0].check[1].id: duplicate id "phy-broken-1-c1"`,
        ),
        `${p}/chapters/physics/broken.json › lessons[0].check: needs at least 3 questions (found 2)`,
        `${p}/chapters/physics/broken.json › lessons[0].videos[0].checkpoints[0].questionId: questionId "does-not-exist" doesn't match any question in this chapter`,
        `${p}/timetable.json › days.mon[1]: slot 17:00–17:45 overlaps slot 16:15–17:15 (days.mon[0])`,
      ]),
    );
    expect(errors).toHaveLength(5);
  });
});
