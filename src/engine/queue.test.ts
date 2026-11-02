import { loadContent, type Chapter, type Lesson, type Plan } from '@/content';
import { findLesson, nextLesson, subjectQueue } from './queue';

const lesson = (id: string): Lesson => ({
  id,
  title: id,
  videos: [],
  cards: [{ title: 'Card', body: 'Body' }],
  practice: [],
  notebook: '',
  check: [],
  keyRules: [],
});

const chapter = (
  id: string,
  over: Partial<Omit<Chapter, 'lessons'>> & { lessons?: string[] } = {},
): Chapter => {
  const { lessons = [`${id}-1`, `${id}-2`], ...rest } = over;
  return {
    id,
    subject: 'physics',
    title: id,
    order: 1,
    status: 'approved',
    questionBank: [],
    ...rest,
    lessons: lessons.map(lesson),
  };
};

const plan = (over: Partial<Plan> = {}): Plan => ({
  startDate: '2026-11-02',
  exams: { mode: 'single', date: 'REPLACE_ME' },
  revisionDays: 7,
  chapterOrder: {},
  taughtAlready: [],
  examPattern: { default: [{ section: 'A', title: 'All', types: ['mcq'], marks: 10 }] },
  ...over,
});

const ids = (qs: { lesson: Lesson }[]) => qs.map((q) => q.lesson.id);

describe('subjectQueue', () => {
  const chapters = [
    chapter('phy-c', { order: 3 }),
    chapter('phy-a', { order: 1 }),
    chapter('phy-b', { order: 2, lessons: ['phy-b-1'] }),
    chapter('phy-draft', { order: 0, status: 'draft' }),
    chapter('che-x', { subject: 'chemistry', order: 0 }),
  ];

  it.each<[string, Plan, string[]]>([
    [
      'by chapter.order when the plan lists nothing',
      plan(),
      ['phy-a-1', 'phy-a-2', 'phy-b-1', 'phy-c-1', 'phy-c-2'],
    ],
    [
      'plan.chapterOrder first',
      plan({ chapterOrder: { physics: ['phy-c', 'phy-a', 'phy-b'] } }),
      ['phy-c-1', 'phy-c-2', 'phy-a-1', 'phy-a-2', 'phy-b-1'],
    ],
    [
      'unlisted chapters after the listed ones, by order',
      plan({ chapterOrder: { physics: ['phy-c'] } }),
      ['phy-c-1', 'phy-c-2', 'phy-a-1', 'phy-a-2', 'phy-b-1'],
    ],
    ['taughtAlready excluded', plan({ taughtAlready: ['phy-a'] }), ['phy-b-1', 'phy-c-1', 'phy-c-2']],
    [
      'listed draft still excluded',
      plan({ chapterOrder: { physics: ['phy-draft', 'phy-b'] } }),
      ['phy-b-1', 'phy-a-1', 'phy-a-2', 'phy-c-1', 'phy-c-2'],
    ],
  ])('%s', (_name, p, expected) => {
    expect(ids(subjectQueue(chapters, p, 'physics'))).toEqual(expected);
  });

  it('ties on order break by id (stable)', () => {
    const tied = [
      chapter('phy-z', { order: 1 }),
      chapter('phy-y', { order: 1 }),
      chapter('phy-y', { order: 1 }),
    ];
    expect(ids(subjectQueue(tied, plan(), 'physics'))).toEqual([
      'phy-y-1',
      'phy-y-2',
      'phy-y-1',
      'phy-y-2',
      'phy-z-1',
      'phy-z-2',
    ]);
  });

  it('other subjects and empty inputs', () => {
    expect(ids(subjectQueue(chapters, plan(), 'chemistry'))).toEqual(['che-x-1', 'che-x-2']);
    expect(subjectQueue(chapters, plan(), 'maths')).toEqual([]);
    expect(subjectQueue([], plan(), 'physics')).toEqual([]);
  });

  it('carries the chapter and does not mutate the input', () => {
    const before = chapters.map((c) => c.id);
    const first = subjectQueue(chapters, plan(), 'physics')[0];
    expect(first?.chapter.id).toBe('phy-a');
    expect(chapters.map((c) => c.id)).toEqual(before);
  });
});

describe('nextLesson', () => {
  const chapters = [chapter('phy-a', { order: 1 }), chapter('phy-b', { order: 2 })];
  it.each<[string[], string | undefined]>([
    [[], 'phy-a-1'],
    [['phy-a-1'], 'phy-a-2'],
    [['phy-a-2'], 'phy-a-1'], // a missed lesson stays at the front
    [['phy-a-1', 'phy-a-2'], 'phy-b-1'],
    [['phy-a-1', 'phy-a-2', 'phy-b-1', 'phy-b-2'], undefined],
  ])('completed %j → %s', (done, expected) => {
    expect(nextLesson(chapters, plan(), 'physics', new Set(done))?.lesson.id).toBe(expected);
  });
});

describe('findLesson', () => {
  const chapters = [chapter('phy-a'), chapter('phy-draft', { status: 'draft' })];
  it.each<[string, string | undefined]>([
    ['phy-a-2', 'phy-a'],
    ['phy-draft-1', 'phy-draft'], // drafts are findable (parent preview)
    ['nope', undefined],
  ])('%s → chapter %s', (id, chapterId) => {
    const found = findLesson(chapters, id);
    expect(found?.chapter.id).toBe(chapterId);
    if (found) expect(found.lesson.id).toBe(id);
  });
});

describe('with the real content', () => {
  const { chapters, plan: realPlan } = loadContent();

  it('chemistry starts at che-matter-1 (approved chapter)', () => {
    expect(nextLesson(chapters, realPlan, 'chemistry', new Set())?.lesson.id).toBe('che-matter-1');
  });

  it('after che-matter-1 comes che-matter-2', () => {
    const next = nextLesson(chapters, realPlan, 'chemistry', new Set(['che-matter-1']));
    expect(next?.lesson.id).toBe('che-matter-2');
    expect(next?.chapter.id).toBe('che-matter');
  });

  it('only approved chapters are queued', () => {
    for (const subject of Object.keys(realPlan.chapterOrder)) {
      for (const item of subjectQueue(chapters, realPlan, subject)) {
        expect(item.chapter.status).toBe('approved');
        expect(item.chapter.subject).toBe(subject);
      }
    }
  });

  it('findLesson finds che-matter-1', () => {
    expect(findLesson(chapters, 'che-matter-1')?.chapter.id).toBe('che-matter');
  });
});
