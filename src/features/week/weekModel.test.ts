import { loadContent } from '@/content';
import { catchUpCount, dayLessons, weekDays } from './weekModel';

const bundle = loadContent();

describe('weekDays', () => {
  it('lays out Mon–Sun of this week around today (Fri 6 Nov 2026)', () => {
    const days = weekDays(bundle, '2026-11-06', 'this');
    expect(days.map((d) => d.dateKey)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(days.map((d) => d.when)).toEqual(['past', 'past', 'past', 'past', 'today', 'future', 'future']);
    expect(days[0]!.subjectIds).toEqual(['maths', 'physics', 'english', 'geography']);
  });

  it('last week is all in the past, even on a Monday', () => {
    const days = weekDays(bundle, '2026-11-02', 'last');
    expect(days[0]!.dateKey).toBe('2026-10-26');
    expect(days[6]!.dateKey).toBe('2026-11-01');
    expect(days.every((d) => d.when === 'past')).toBe(true);
  });
});

describe('dayLessons', () => {
  const mon = { weekday: 'mon' as const };

  it.each([
    // [when, done slot indices, states of Maths(1) Physics(3) English(7) Geography(8)]
    ['past', [], ['catchup', 'catchup', 'catchup', 'catchup']],
    ['past', [1, 7], ['done', 'catchup', 'done', 'catchup']],
    ['today', [3], ['today', 'done', 'today', 'today']],
    ['future', [], ['locked', 'locked', 'locked', 'locked']],
  ] as const)('%s with %j done → %j', (when, done, states) => {
    const lessons = dayLessons(bundle, { ...mon, when }, new Set(done));
    expect(lessons.map((l) => l.index)).toEqual([1, 3, 7, 8]);
    expect(lessons.map((l) => l.state)).toEqual(states);
    expect(catchUpCount(lessons)).toBe(states.filter((s) => s === 'catchup').length);
  });

  it('only study stones are listed; tests, revise and review are "soon", not catch-ups', () => {
    const sun = dayLessons(bundle, { weekday: 'sun', when: 'past' }, new Set());
    expect(sun.map((l) => [l.index, l.slot.kind, l.state])).toEqual([
      [0, 'revise', 'soon'],
      [1, 'test', 'soon'],
      [2, 'review', 'soon'],
      [5, 'fixit', 'soon'], // a fix-it across 4 subjects has no single lesson to play yet
    ]);
    // a single-subject fix-it plays the next lesson, so a missed one is a catch-up
    const sat = dayLessons(bundle, { weekday: 'sat', when: 'past' }, new Set());
    expect(sat.find((l) => l.index === 7)).toMatchObject({ state: 'catchup', name: 'English' });
  });
});
